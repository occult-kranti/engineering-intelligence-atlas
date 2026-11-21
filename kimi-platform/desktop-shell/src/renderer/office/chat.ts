/**
 * v4 Director chat surface: one project-level Director thread (plus manual
 * sessions), an optional node scope, and an honest requires-desktop-0.4
 * fallback. Fire-and-poll only — there is no streaming anywhere: a pending
 * assistant message shows a static "waiting" indicator and the session is
 * polled until the persisted state changes.
 *
 * Safety invariants:
 *  - Assistant text is rendered via textContent only (never innerHTML).
 *  - Every provider call goes through an explicit confirmation dialog with
 *    budget/rate visibility (confirmed: true).
 *  - Raw chain-of-thought is never requested or displayed; assistant text is
 *    labeled as the Director's summary.
 *  - DOM is windowed (latest N messages) and reconciled by message id, so
 *    rapid polls never duplicate rows and 500-message histories stay cheap.
 */

import { BridgeAdapter, UNAVAILABLE_V4 } from './bridge.js';
import { button, clear, el } from './dom.js';
import type { OverlayHost } from './overlay.js';
import type {
  ChatAction,
  ChatMessage,
  ChatSession,
  ChatSessionSummary,
  Project,
  ProjectProvider,
} from './types.js';

export interface ChatDeps {
  panel: HTMLElement;
  adapter: BridgeAdapter;
  overlay: OverlayHost;
  /** Polite live-region summary announcements (raw chat stays non-live). */
  announce(message: string): void;
  openNewProjectDialog(): void;
  openRoadmap(projectId: string): void;
  getProject(): Project | null;
}

export interface ChatController {
  /** Project context for the project-level Director thread. */
  setProject(project: Project | null): void;
  /** Node inspector scope: "Ask about this node" sets it; chip clears it. */
  setNodeScope(nodeId: string | null, nodeTitle?: string): void;
  reloadSessions(): Promise<void>;
  /** Test hook: one poll cycle for pending assistant messages. */
  pollOnce(): Promise<void>;
  destroy(): void;
  state(): Readonly<ChatViewState>;
}

export interface ChatViewState {
  available: boolean;
  sessions: ChatSessionSummary[];
  session: ChatSession | null;
  nodeScope: { nodeId: string; title: string } | null;
  sending: boolean;
  pendingReply: boolean;
  renderedWindowStart: number;
}

/** Messages kept in the DOM window; earlier history loads on demand. */
const MESSAGE_WINDOW = 100;
const WINDOW_STEP = 100;
const POLL_MS = 900;
/** Batching window for rapid response updates. */
const RENDER_COALESCE_MS = 80;

/** Defensive copy: IPC returns fresh objects, but never alias bridge memory. */
function snapshotSession(session: ChatSession): ChatSession {
  return { ...session, messages: session.messages.map((m) => ({ ...m })) };
}

export function createChatController(deps: ChatDeps): ChatController {
  const { panel, adapter, overlay, announce } = deps;

  const state: ChatViewState = {
    available: adapter.capabilities.chat,
    sessions: [],
    session: null,
    nodeScope: null,
    sending: false,
    pendingReply: false,
    renderedWindowStart: 0,
  };

  let pollTimer: number | null = null;
  let renderTimer: number | null = null;
  /** Reconciliation index: message id -> rendered row (no duplicate renders). */
  const renderedRows = new Map<string, { row: HTMLElement; signature: string }>();
  /** Pinned = auto-scroll; unpinned shows the new-message pill instead. */
  let scrollPinned = true;
  let keyWarning: string | null = null;
  let destroyed = false;

  // ------------------------------------------------------------ static DOM

  const unavailableBox = el('div', 'chat-unavailable');
  const shell = el('div', 'chat-shell');
  const sessionBar = el('div', 'chat-session-bar');
  const sessionSelect = document.createElement('select');
  sessionSelect.id = 'chat-session-select';
  sessionSelect.setAttribute('aria-label', 'Director chat sessions');
  const newSessionBtn = button('secondary', 'New session', () => void createSession());
  const deleteSessionBtn = button('secondary', 'Delete', () => void deleteSession());
  const drawerBtn = button('secondary', 'Pop out', () => toggleDrawer());
  drawerBtn.id = 'chat-drawer-toggle';
  drawerBtn.setAttribute('aria-pressed', 'false');
  sessionBar.append(sessionSelect, newSessionBtn, deleteSessionBtn, drawerBtn);

  const budgetLine = el('p', 'chat-budget muted');
  const scopeChipRow = el('div', 'chat-scope-row');
  const quickActions = el('div', 'chat-quick-actions row wrap');
  for (const [label, text] of [
    ['Ask status', 'What is the current status of this project? Summarize run, approvals, and blockers.'],
    ['Propose hires', 'Propose hires for this project goal from the bundled skill registry.'],
    ['Propose run', 'Propose the next run for this project: node order, budgets, and gates.'],
  ] as const) {
    const chip = button('secondary chat-quick', label, () => void sendWithConfirmation(text));
    chip.dataset.quickAction = label;
    quickActions.append(chip);
  }

  const logWrap = el('div', 'chat-log-wrap');
  const log = el('ol', 'chat-log');
  log.setAttribute('aria-label', 'Director conversation (not live; summaries are announced separately)');
  const earlierBtn = button('secondary chat-earlier', '', () => {
    state.renderedWindowStart = Math.max(0, state.renderedWindowStart - WINDOW_STEP);
    renderLog(true);
  });
  const pill = button('chat-new-pill hidden', 'New messages ↓', () => {
    scrollPinned = true;
    pill.classList.add('hidden');
    scrollToBottom();
  });
  logWrap.append(earlierBtn, log, pill);

  const composer = el('form', 'chat-composer');
  const composerText = document.createElement('textarea');
  composerText.id = 'chat-composer-text';
  composerText.rows = 2;
  composerText.placeholder = 'Message the Director… (Enter sends, Shift+Enter adds a line)';
  composerText.setAttribute('aria-label', 'Message the Director');
  const sendBtn = button('', 'Send', () => undefined);
  sendBtn.id = 'chat-send';
  sendBtn.type = 'submit';
  const stopBtn = button('secondary hidden', 'Stop', () => void stopGeneration());
  stopBtn.id = 'chat-stop';
  composer.append(composerText, sendBtn, stopBtn);
  const chatStatus = el('div', 'chat-status');

  shell.append(sessionBar, budgetLine, scopeChipRow, quickActions, logWrap, composer, chatStatus);
  panel.append(unavailableBox, shell);

  function setStatus(kind: '' | 'ok' | 'error' | 'warn', message: string): void {
    clear(chatStatus);
    if (message) chatStatus.append(el('p', `status ${kind}`.trim(), message));
  }

  // ------------------------------------------------------------ helpers

  function scrollToBottom(): void {
    log.scrollTop = log.scrollHeight;
  }

  function isPinned(): boolean {
    return log.scrollHeight - log.scrollTop - log.clientHeight < 48;
  }

  function toggleDrawer(): void {
    const office = panel.closest('.office');
    if (!office) return;
    const popped = office.classList.toggle('chat-drawer');
    drawerBtn.setAttribute('aria-pressed', popped ? 'true' : 'false');
    drawerBtn.textContent = popped ? 'Dock' : 'Pop out';
  }

  function fmtUsd(usd: number): string {
    return `$${usd.toFixed(4)}`;
  }

  // ------------------------------------------------------------ sessions

  async function reloadSessions(selectId?: string): Promise<void> {
    if (!state.available) return;
    const res = await adapter.chatListSessions();
    if (!res.ok) {
      setStatus('error', res.error);
      return;
    }
    state.sessions = res.value;
    renderSessionSelect(selectId);
    if (state.session === null) {
      const wanted =
        selectId ??
        state.sessions.find((s) => s.projectId !== null && s.projectId === deps.getProject()?.id)?.id ??
        state.sessions[0]?.id ??
        null;
      if (wanted) await openSession(wanted);
      else renderLog();
    }
    renderBudget();
  }

  function renderSessionSelect(selectId?: string): void {
    clear(sessionSelect);
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = state.sessions.length === 0 ? 'No sessions yet' : 'Select a session…';
    sessionSelect.append(placeholder);
    for (const s of state.sessions) {
      const opt = document.createElement('option');
      opt.value = s.id;
      opt.textContent = `${s.title} (${s.provider}, ${s.messageCount} msg)`;
      sessionSelect.append(opt);
    }
    const wanted = selectId ?? state.session?.id ?? '';
    sessionSelect.value = state.sessions.some((s) => s.id === wanted) ? wanted : '';
    deleteSessionBtn.disabled = !state.session;
  }

  async function openSession(sessionId: string): Promise<void> {
    const res = await adapter.chatGetSession(sessionId);
    if (!res.ok) {
      setStatus('error', res.error);
      return;
    }
    if (!res.value) {
      // Deleted elsewhere: refresh the list honestly.
      state.session = null;
      await reloadSessions();
      return;
    }
    state.session = snapshotSession(res.value);
    state.renderedWindowStart = Math.max(0, res.value.messages.length - MESSAGE_WINDOW);
    renderedRows.clear();
    scrollPinned = true;
    renderSessionSelect(sessionId);
    renderBudget();
    renderLog();
    await refreshKeyWarning();
    updatePendingState();
  }

  async function createSession(): Promise<void> {
    const project = deps.getProject();
    const provider: ProjectProvider = project?.provider ?? 'openai';
    const res = await adapter.chatCreateSession({
      title: project ? `${project.name} Director` : 'Director chat',
      projectId: project?.id ?? null,
      provider,
      model: project?.model ?? '',
      priceRates: { inputUsdPerMillion: 0, outputUsdPerMillion: 0 },
    });
    if (!res.ok) {
      setStatus('error', res.error);
      return;
    }
    await reloadSessions(res.value.id);
    await openSession(res.value.id);
    announce(`New Director session ${res.value.title} created.`);
  }

  async function deleteSession(): Promise<void> {
    const session = state.session;
    if (!session) return;
    const ok = await overlay.confirm({
      title: 'Delete chat session',
      message: `Permanently delete “${session.title}” and its ${session.messages.length} message(s)? This cannot be undone.`,
      confirmLabel: 'Delete session',
      danger: true,
    });
    if (!ok) return;
    const res = await adapter.chatDeleteSession(session.id);
    if (!res.ok) {
      setStatus('error', res.error);
      return;
    }
    state.session = null;
    renderedRows.clear();
    await reloadSessions();
    renderLog();
    announce('Director session deleted.');
  }

  // ------------------------------------------------------------ key honesty

  async function refreshKeyWarning(): Promise<void> {
    keyWarning = null;
    const session = state.session;
    if (!session || session.provider === 'ollama') {
      renderBudget();
      return;
    }
    try {
      const vault = await adapter.getVaultStatus();
      const st = vault.providers[session.provider];
      if (!vault.encryptionAvailable || !st.configured || !st.readable) {
        keyWarning = !vault.encryptionAvailable
          ? 'OS secure storage is unavailable; no API key can be stored.'
          : !st.configured
            ? `No ${session.provider} API key is configured. Add one in the Connections tab before sending.`
            : `The stored ${session.provider} key is unreadable (tampered or keychain changed). Re-save it in Connections.`;
      }
    } catch {
      // Vault status unavailable: the send path stays authoritative.
    }
    renderBudget();
  }

  function renderBudget(): void {
    clear(budgetLine);
    const session = state.session;
    if (!session) {
      budgetLine.append(
        document.createTextNode('No session selected. Create one to talk to the Director for this project.'),
      );
      return;
    }
    const used = session.usage;
    const budget = session.budget;
    budgetLine.append(
      document.createTextNode(
        `${session.provider} · ${session.model || 'default model'} · used ${used.inputTokens + used.outputTokens}/${budget.maxTokens} tokens · ` +
          `${fmtUsd(used.costUsd)}/${fmtUsd(budget.maxUsd)} · rates in $${session.priceRates.inputUsdPerMillion}/M, out $${session.priceRates.outputUsdPerMillion}/M`,
      ),
    );
    if (keyWarning) budgetLine.append(el('span', 'status warn', ` ${keyWarning}`));
  }

  // ------------------------------------------------------------ scope chip

  function renderScope(): void {
    clear(scopeChipRow);
    if (!state.nodeScope) return;
    const chip = el('span', 'chat-scope-chip', `Scope: ${state.nodeScope.title}`);
    const clearBtn = button('linklike', 'Clear scope', () => controller.setNodeScope(null));
    scopeChipRow.append(chip, clearBtn);
  }

  // ------------------------------------------------------------ message log

  function messageSignature(msg: ChatMessage): string {
    return `${msg.status}|${msg.text.length}|${msg.error ?? ''}|${msg.finishedAt ?? ''}`;
  }

  function renderMessageRow(msg: ChatMessage): HTMLElement {
    const row = el('li', `chat-msg chat-${msg.role} chat-status-${msg.status}`);
    row.dataset.messageId = msg.id;
    const head = el('div', 'chat-msg-head');
    head.append(el('span', 'chat-msg-role', msg.role === 'user' ? 'You' : 'Director'));
    head.append(el('span', 'meta', msg.createdAt.slice(11, 19)));
    row.append(head);

    if (msg.role === 'assistant' && msg.status === 'pending') {
      // Non-streaming pending indicator: static text, no fake token stream.
      row.append(el('p', 'chat-pending', 'Director is working… (no live stream; the reply appears when complete)'));
    } else if (msg.text) {
      // textContent only — assistant text is data, never markup.
      row.append(el('p', 'chat-msg-text', msg.text));
    }
    if (msg.status === 'error' && msg.error) {
      row.append(el('p', 'status error', `Provider error: ${msg.error}`));
    }
    if (msg.status === 'cancelled') row.append(el('p', 'meta', 'Stopped before completion.'));

    if (msg.role === 'assistant' && msg.status === 'completed') {
      row.append(el('p', 'chat-cot-note meta', 'Director summary — raw chain-of-thought is never requested or shown.'));
      if (msg.usage || msg.provenance) {
        const bits: string[] = [];
        if (msg.provenance) bits.push(`${msg.provenance.provider} · ${msg.provenance.model}`);
        if (msg.usage) {
          bits.push(`${msg.usage.inputTokens} in / ${msg.usage.outputTokens} out`);
          bits.push(fmtUsd(msg.usage.costUsd));
        }
        if (msg.provenance) bits.push(`sha256 ${msg.provenance.textSha256.slice(0, 12)}…`);
        row.append(el('p', 'meta', `provenance: ${bits.join(' · ')}`));
      }
    }

    if (msg.actions.length > 0) {
      const chips = el('div', 'row wrap chat-actions');
      for (const action of msg.actions) chips.append(actionChip(action));
      row.append(chips);
    }
    return row;
  }

  function actionChip(action: ChatAction): HTMLButtonElement {
    return button('secondary chat-action-chip', action.label, () => {
      if (action.kind === 'create-project') deps.openNewProjectDialog();
      else if (action.kind === 'open-roadmap' && action.projectId) deps.openRoadmap(action.projectId);
    });
  }

  function renderLog(rebuild = false): void {
    const session = state.session;
    pill.classList.add('hidden');
    if (!session) {
      clear(log);
      renderedRows.clear();
      earlierBtn.classList.add('hidden');
      log.append(el('li', 'chat-empty muted', 'No Director session yet. Use “New session” to start one.'));
      return;
    }
    // A session is loaded: the empty-state placeholder must not linger.
    log.querySelector('.chat-empty')?.remove();
    const messages = session.messages;
    state.renderedWindowStart = Math.max(0, Math.min(state.renderedWindowStart, Math.max(0, messages.length - 1)));
    const windowStart = messages.length > MESSAGE_WINDOW ? state.renderedWindowStart : 0;
    const visible = messages.slice(windowStart);

    if (rebuild) {
      clear(log);
      renderedRows.clear();
    }
    earlierBtn.classList.toggle('hidden', windowStart === 0);
    earlierBtn.textContent = windowStart > 0 ? `Show ${Math.min(WINDOW_STEP, windowStart)} earlier message(s) of ${windowStart}` : '';

    const wasPinned = scrollPinned || isPinned();
    // Reconcile by message id: update changed rows in place, append new ones,
    // drop rows that fell out of the window — never duplicate a message.
    const keep = new Set(visible.map((m) => m.id));
    for (const [id, entry] of renderedRows) {
      if (!keep.has(id)) {
        entry.row.remove();
        renderedRows.delete(id);
      }
    }
    let anchor: HTMLElement | null = null;
    for (const msg of visible) {
      const existing = renderedRows.get(msg.id);
      const signature = messageSignature(msg);
      if (existing && existing.signature === signature) {
        anchor = existing.row;
        continue;
      }
      const row = renderMessageRow(msg);
      if (existing) {
        existing.row.replaceWith(row);
      } else if (anchor && anchor.nextSibling) {
        log.insertBefore(row, anchor.nextSibling);
      } else if (anchor) {
        log.append(row);
      } else {
        log.append(row);
      }
      renderedRows.set(msg.id, { row, signature });
      anchor = row;
    }

    if (wasPinned) {
      scrollPinned = true;
      scrollToBottom();
    } else {
      scrollPinned = false;
      const newest = messages[messages.length - 1];
      if (newest && renderedRows.get(newest.id)) pill.classList.remove('hidden');
    }
  }

  /** Batched re-render: rapid polls coalesce into one DOM pass. */
  function scheduleRender(): void {
    if (renderTimer !== null) return;
    renderTimer = window.setTimeout(() => {
      renderTimer = null;
      if (!destroyed) {
        renderLog();
        renderBudget();
      }
    }, RENDER_COALESCE_MS);
  }

  // ------------------------------------------------------------ send / stop

  async function sendWithConfirmation(text: string): Promise<void> {
    const trimmed = text.trim();
    if (!trimmed) return;
    if (!state.session) {
      await createSession();
      if (!state.session) return;
    }
    const session = state.session;
    const scoped = state.nodeScope ? `[About node “${state.nodeScope.title}”] ${trimmed}` : trimmed;
    const ok = await overlay.confirm({
      title: 'Send to provider',
      message:
        `This sends your message to ${session.provider} (${session.model || 'default model'}) using your configured key. ` +
        'The provider bills your key per its terms.',
      detail:
        `Session budget: ${session.usage.inputTokens + session.usage.outputTokens}/${session.budget.maxTokens} tokens used · ` +
        `$${session.usage.costUsd.toFixed(4)}/$${session.budget.maxUsd} spent · ` +
        `rates in $${session.priceRates.inputUsdPerMillion}/M out $${session.priceRates.outputUsdPerMillion}/M. Budgets are hard stops.`,
      confirmLabel: 'Send message',
    });
    if (!ok) return;
    await send(scoped);
  }

  async function send(text: string): Promise<void> {
    const session = state.session;
    if (!session || state.sending) return;
    state.sending = true;
    sendBtn.disabled = true;
    const res = await adapter.chatSendMessage({ sessionId: session.id, text, confirmed: true });
    state.sending = false;
    sendBtn.disabled = false;
    if (!res.ok) {
      setStatus('error', res.error);
      return;
    }
    composerText.value = '';
    setStatus('', '');
    announce('Message sent. Waiting for the Director.');
    await pollOnce();
  }

  async function stopGeneration(): Promise<void> {
    const session = state.session;
    if (!session) return;
    const res = await adapter.chatStop(session.id);
    if (!res.ok) {
      setStatus('error', res.error);
      return;
    }
    stopPolling();
    await pollOnce();
    announce('Stopped the Director reply.');
  }

  // ------------------------------------------------------------ polling

  function updatePendingState(): void {
    const pending = state.session?.messages.some((m) => m.role === 'assistant' && m.status === 'pending') ?? false;
    state.pendingReply = pending;
    stopBtn.classList.toggle('hidden', !pending);
    sendBtn.disabled = state.sending;
    if (pending) startPolling();
    else stopPolling();
  }

  function startPolling(): void {
    if (pollTimer !== null) return;
    pollTimer = window.setInterval(() => void pollOnce(), POLL_MS);
  }

  function stopPolling(): void {
    if (pollTimer !== null) {
      window.clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  async function pollOnce(): Promise<void> {
    const session = state.session;
    if (!session || destroyed) return;
    const res = await adapter.chatGetSession(session.id);
    if (!res.ok || !res.value) return;
    const prevSignature = session.messages.map((m) => `${m.id}:${messageSignature(m)}`).join('|');
    const next = snapshotSession(res.value);
    const nextSignature = next.messages.map((m) => `${m.id}:${messageSignature(m)}`).join('|');
    state.session = next;
    updatePendingState();
    if (prevSignature !== nextSignature) {
      const completed = next.messages.some(
        (m, i) => m.status === 'completed' && session.messages[i]?.status === 'pending',
      );
      scheduleRender();
      if (completed) announce('The Director replied.');
    } else {
      renderBudget();
    }
  }

  // ------------------------------------------------------------ wiring

  sessionSelect.addEventListener('change', () => {
    if (sessionSelect.value) void openSession(sessionSelect.value);
  });
  composer.addEventListener('submit', (event) => {
    event.preventDefault();
    void sendWithConfirmation(composerText.value);
  });
  composerText.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void sendWithConfirmation(composerText.value);
    }
  });
  log.addEventListener('scroll', () => {
    scrollPinned = isPinned();
    if (scrollPinned) pill.classList.add('hidden');
  });

  // Initial paint
  clear(unavailableBox);
  if (!state.available) {
    shell.classList.add('hidden');
    unavailableBox.append(
      el('h3', '', 'Director chat'),
      el(
        'p',
        'status warn',
        `Director chat ${UNAVAILABLE_V4}. Update the desktop app to chat with the Director about this project; ` +
          'projects, runs, approvals, and skills above keep working without it.',
      ),
    );
  } else {
    renderScope();
    renderBudget();
    renderLog();
  }

  const controller: ChatController = {
    setProject(project: Project | null): void {
      if (!state.available) return;
      // The project-level Director thread: prefer the session linked to the
      // selected project; fall back to the most recent session.
      const linked = state.sessions.find((s) => s.projectId === (project?.id ?? null));
      if (linked && linked.id !== state.session?.id) {
        void openSession(linked.id);
      } else if (!linked && project && state.session === null) {
        void reloadSessions();
      }
    },
    setNodeScope(nodeId: string | null, nodeTitle?: string): void {
      state.nodeScope = nodeId ? { nodeId, title: nodeTitle ?? nodeId } : null;
      renderScope();
      if (nodeId) composerText.focus();
    },
    reloadSessions,
    pollOnce,
    destroy(): void {
      destroyed = true;
      stopPolling();
      if (renderTimer !== null) window.clearTimeout(renderTimer);
    },
    state: () => state,
  };
  return controller;
}
