/**
 * Chat sidebar webview (WebviewViewProvider).
 *
 * Security:
 *  - Strict CSP: default-src 'none'; scripts/styles only via nonce or the
 *    extension's own media folder URI.
 *  - The pairing token is NEVER injected into the HTML or any message.
 *  - All webview requests are validated (parseWebviewRequest) and routed
 *    through the extension host -> BridgeClient. The webview holds no
 *    credentials and cannot reach the network itself (CSP connect-src 'none').
 *  - Model output is rendered with textContent only (see media/chat.js).
 *  - No fake streaming: the desktop's send route is fire-and-poll; while the
 *    assistant message is 'pending' we poll getSession with capped backoff
 *    and show only a pending indicator until the reply is complete.
 */

import * as vscode from 'vscode';
import { randomBytes } from 'node:crypto';
import { BridgeError } from '../bridge/errors.js';
import type { BridgeManager } from '../bridge/manager.js';
import type {
  ChatMessage,
  ChatSession,
  ChatSessionSummary,
  ProjectProvider,
} from '../bridge/types.js';
import { parseWebviewRequest, type ChatMessageView, type HostMessage } from '../chat/protocol.js';
import { initialChatUiState, reduceChatUi, type ChatUiState } from '../chat/state.js';
import { buildChatCsp } from './csp.js';

/** How often to poll while a reply is generating (capped backoff). */
const CHAT_POLL_INITIAL_MS = 1_000;
const CHAT_POLL_MAX_MS = 4_000;
/** Give up waiting after 10 minutes (server enforces its own minute budget). */
const CHAT_POLL_DEADLINE_MS = 10 * 60_000;

export class ChatViewProvider implements vscode.WebviewViewProvider {
  static readonly viewType = 'researchDirector.chat';

  #manager: BridgeManager;
  #view: vscode.WebviewView | null = null;
  #ui: ChatUiState = initialChatUiState;
  #sessions: ChatSessionSummary[] = [];
  #activeSessionId: string | null = null;
  #messages: ChatMessage[] = [];
  #paired = false;

  constructor(manager: BridgeManager, private readonly extensionUri: vscode.Uri) {
    this.#manager = manager;
    manager.onDidChangePairing((paired) => {
      this.#paired = paired;
      if (!paired) {
        this.#sessions = [];
        this.#activeSessionId = null;
        this.#messages = [];
        this.#ui = initialChatUiState;
      }
      void this.#pushState();
      if (paired) void this.refreshSessions();
    });
  }

  /** Used by commands (e.g. Ask Director about Selection) to show a send. */
  async reveal(): Promise<void> {
    await vscode.commands.executeCommand('researchDirector.chat.focus');
  }

  resolveWebviewView(view: vscode.WebviewView): void {
    this.#view = view;
    view.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, 'media')],
    };
    view.webview.html = this.#html(view.webview);
    view.webview.onDidReceiveMessage((raw: unknown) => {
      const msg = parseWebviewRequest(raw);
      if (!msg) return; // drop anything malformed
      void this.#handle(msg);
    });
    void this.#manager.isPaired().then((p) => {
      this.#paired = p;
      void this.#pushState();
      if (p) void this.refreshSessions();
    });
  }

  async #handle(msg: NonNullable<ReturnType<typeof parseWebviewRequest>>): Promise<void> {
    try {
      switch (msg.type) {
        case 'ready':
        case 'listSessions':
          await this.refreshSessions();
          return;
        case 'selectSession':
          await this.#selectSession(msg.sessionId);
          return;
        case 'send':
          await this.sendToSession(msg.sessionId, msg.text);
          return;
        case 'stop':
          await this.stopSession(msg.sessionId);
          return;
      }
    } catch (err) {
      this.#ui = reduceChatUi(this.#ui, {
        kind: 'send-error',
        sessionId: this.#ui.pendingSessionId ?? '',
        error: err instanceof Error ? err.message : 'Request failed',
      });
      await this.#pushState();
    }
  }

  async refreshSessions(): Promise<void> {
    if (!(await this.#manager.isPaired())) return;
    this.#sessions = await this.#manager.client().chatListSessions();
    if (!this.#activeSessionId && this.#sessions.length > 0) {
      const first = [...this.#sessions].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
      if (first) {
        await this.#selectSession(first.id);
        return;
      }
    }
    await this.#pushState();
  }

  async #getSessionOrNull(sessionId: string): Promise<ChatSession | null> {
    try {
      return await this.#manager.client().chatGetSession(sessionId);
    } catch (err) {
      if (err instanceof BridgeError && (err.status === 404 || err.code === 'server')) return null;
      throw err;
    }
  }

  async #selectSession(sessionId: string): Promise<void> {
    const session = await this.#getSessionOrNull(sessionId);
    if (!session) return; // stale id; keep current view
    this.#activeSessionId = sessionId;
    this.#messages = session.messages;
    await this.#pushState();
  }

  /**
   * Resolve the session used by "Ask Director about Selection" and by the
   * composer when nothing exists yet. The v4 desktop has no implicit default
   * session, so when none exists we ask for provider/model/price rates once
   * and create it (POST /v1/chat/sessions).
   */
  async ensureDirectorSession(): Promise<string | null> {
    await this.refreshSessions().catch(() => undefined);
    const latest = [...this.#sessions].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
    if (latest) return latest.id;

    const provider = await vscode.window.showQuickPick(
      ['ollama', 'openai', 'anthropic'].map((p) => ({ label: p })),
      { title: 'New Director chat: provider' },
    );
    if (!provider) return null;
    const model = await vscode.window.showInputBox({
      title: 'New Director chat: model id',
      prompt: 'Model id as configured in the desktop app',
      validateInput: (v) => (v.trim().length > 0 && v.length <= 200 ? null : 'Model id required (max 200 chars)'),
    });
    if (model === undefined) return null;
    const inRate = await vscode.window.showInputBox({
      title: 'New Director chat: input price per 1M tokens (USD)',
      value: '0',
      validateInput: (v) => (Number.isFinite(Number(v)) && Number(v) >= 0 ? null : 'Non-negative number required'),
    });
    if (inRate === undefined) return null;
    const outRate = await vscode.window.showInputBox({
      title: 'New Director chat: output price per 1M tokens (USD)',
      value: '0',
      validateInput: (v) => (Number.isFinite(Number(v)) && Number(v) >= 0 ? null : 'Non-negative number required'),
    });
    if (outRate === undefined) return null;

    const res = await this.#manager.client().chatCreateSession({
      title: 'VS Code Director chat',
      provider: provider.label as ProjectProvider,
      model: model.trim(),
      priceRates: { inputUsdPerMillion: Number(inRate), outputUsdPerMillion: Number(outRate) },
    });
    if (!res.ok || !res.session) {
      void vscode.window.showErrorMessage(`Could not create chat session: ${res.error ?? 'unknown error'}`);
      return null;
    }
    await this.refreshSessions();
    await this.#selectSession(res.session.id);
    return res.session.id;
  }

  /**
   * Send user text to a chat session (fire) then poll getSession with capped
   * backoff until the assistant message finishes (no fake streaming).
   * `confirmed: true` is sent; callers collect the confirmation first.
   */
  async sendToSession(sessionId: string, text: string): Promise<void> {
    this.#ui = reduceChatUi(this.#ui, { kind: 'send-start', sessionId });
    await this.#pushState();
    try {
      const res = await this.#manager.client().chatSend(sessionId, { text, confirmed: true });
      if (!res.ok || !res.assistantMessageId) {
        this.#ui = reduceChatUi(this.#ui, {
          kind: 'send-error',
          sessionId,
          error: res.error ?? 'Desktop rejected the message',
        });
        await this.#pushState();
        return;
      }
      await this.#awaitReply(sessionId, res.assistantMessageId);
    } catch (err) {
      this.#ui = reduceChatUi(this.#ui, {
        kind: 'send-error',
        sessionId,
        error: err instanceof Error ? err.message : 'Send failed',
      });
      await this.#pushState();
    }
  }

  async #awaitReply(sessionId: string, assistantMessageId: string): Promise<void> {
    const deadline = Date.now() + CHAT_POLL_DEADLINE_MS;
    let interval = CHAT_POLL_INITIAL_MS;
    for (;;) {
      const session = await this.#getSessionOrNull(sessionId);
      const reply = session?.messages.find((m) => m.id === assistantMessageId);
      if (session && this.#activeSessionId === sessionId) {
        this.#messages = session.messages;
      }
      if (!reply || reply.status !== 'pending') {
        const failed = reply?.status === 'error';
        this.#ui = reduceChatUi(
          this.#ui,
          failed
            ? { kind: 'send-error', sessionId, error: reply.error ?? 'Generation failed' }
            : {
                kind: 'send-complete',
                sessionId,
                message:
                  reply ??
                  ({
                    id: assistantMessageId,
                    role: 'assistant',
                    status: 'cancelled',
                    text: '',
                    error: null,
                    usage: null,
                    provenance: null,
                    actions: [],
                    createdAt: new Date().toISOString(),
                    finishedAt: null,
                  } satisfies ChatMessage),
              },
        );
        await this.#pushState();
        return;
      }
      if (Date.now() > deadline) {
        this.#ui = reduceChatUi(this.#ui, {
          kind: 'send-error',
          sessionId,
          error: 'Timed out waiting for the Director (the desktop may still finish it).',
        });
        await this.#pushState();
        return;
      }
      await this.#pushState(); // keep the pending indicator; no partial text
      await new Promise((r) => setTimeout(r, interval));
      interval = Math.min(interval * 2, CHAT_POLL_MAX_MS);
    }
  }

  async stopSession(sessionId: string): Promise<void> {
    try {
      await this.#manager.client().chatStop(sessionId);
    } finally {
      this.#ui = reduceChatUi(this.#ui, { kind: 'stopped', sessionId });
      const session = await this.#getSessionOrNull(sessionId).catch(() => null);
      if (session && this.#activeSessionId === sessionId) this.#messages = session.messages;
      await this.#pushState();
    }
  }

  async #pushState(): Promise<void> {
    if (!this.#view) return;
    const msg: HostMessage = {
      type: 'state',
      paired: this.#paired,
      sessions: this.#sessions.map((s) => ({ id: s.id, title: s.title, updatedAt: s.updatedAt })),
      activeSessionId: this.#activeSessionId,
      messages: this.#messages
        // In-flight assistant placeholders are represented by the pending
        // indicator only — never rendered as partial/streamed text.
        .filter((m) => !(m.role === 'assistant' && m.status === 'pending'))
        .map(
          (m): ChatMessageView => ({
            id: m.id,
            role: m.role,
            content: m.text,
            ts: m.createdAt,
            state:
              m.status === 'cancelled' ? 'stopped' : m.status === 'error' ? 'error' : 'complete',
          }),
        ),
      pending: this.#ui.pending,
      error: this.#ui.error,
    };
    await this.#view.webview.postMessage(msg);
  }

  #html(webview: vscode.Webview): string {
    const nonce = randomBytes(16).toString('base64');
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'media', 'chat.js'));
    const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'media', 'chat.css'));
    const csp = buildChatCsp(nonce, webview.cspSource);
    // NOTE: no token, host, or port is ever interpolated into this HTML.
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="${csp}">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<link nonce="${nonce}" rel="stylesheet" href="${styleUri}">
<title>Research Director Chat</title>
</head>
<body>
<header class="rd-header">
  <select id="session-select" aria-label="Chat session"></select>
  <button id="refresh" type="button" aria-label="Refresh sessions" title="Refresh sessions">&#x21bb;</button>
</header>
<main id="messages" aria-live="polite" aria-label="Conversation"></main>
<div id="status" role="status" aria-live="assertive"></div>
<footer class="rd-composer">
  <textarea id="input" rows="3" maxlength="8000" aria-label="Message the Director"
    placeholder="Ask the Director…"></textarea>
  <div class="rd-actions">
    <button id="send" type="button">Send</button>
    <button id="stop" type="button" hidden>Stop</button>
  </div>
</footer>
<script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }
}
