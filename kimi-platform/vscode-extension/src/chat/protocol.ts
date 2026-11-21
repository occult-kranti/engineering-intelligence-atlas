/**
 * Webview <-> extension-host postMessage protocol with strict runtime
 * validation. Every message from the webview is validated here before any
 * action is taken; unknown/ malformed messages are dropped.
 *
 * Pure module — no 'vscode' / 'node:*' imports.
 */

export const MAX_CHAT_MESSAGE_CHARS = 8_000;
export const MAX_SESSION_ID_CHARS = 128;

// -- webview -> extension ----------------------------------------------------

export type WebviewRequest =
  | { type: 'ready' }
  | { type: 'listSessions' }
  | { type: 'selectSession'; sessionId: string }
  | { type: 'send'; sessionId: string; text: string }
  | { type: 'stop'; sessionId: string };

function isId(v: unknown, max = MAX_SESSION_ID_CHARS): v is string {
  return typeof v === 'string' && v.length > 0 && v.length <= max && !/[\r\n]/.test(v);
}

/**
 * Validate a raw postMessage payload from the webview. Returns the parsed
 * message or null when it must be ignored. Anything not matching the schema
 * exactly is rejected (no partial trust).
 */
export function parseWebviewRequest(raw: unknown): WebviewRequest | null {
  if (!raw || typeof raw !== 'object') return null;
  const m = raw as Record<string, unknown>;
  switch (m.type) {
    case 'ready':
      return { type: 'ready' };
    case 'listSessions':
      return { type: 'listSessions' };
    case 'selectSession':
      return isId(m.sessionId) ? { type: 'selectSession', sessionId: m.sessionId } : null;
    case 'send':
      if (!isId(m.sessionId)) return null;
      if (typeof m.text !== 'string') return null;
      if (m.text.trim().length === 0) return null;
      if (m.text.length > MAX_CHAT_MESSAGE_CHARS) return null;
      return { type: 'send', sessionId: m.sessionId, text: m.text };
    case 'stop':
      return isId(m.sessionId) ? { type: 'stop', sessionId: m.sessionId } : null;
    default:
      return null;
  }
}

// -- extension -> webview ----------------------------------------------------

export interface ChatMessageView {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  ts: string;
  state?: 'complete' | 'stopped' | 'error';
}

export interface SessionView {
  id: string;
  title: string;
  updatedAt: string;
}

export type HostMessage =
  | {
      type: 'state';
      paired: boolean;
      sessions: SessionView[];
      activeSessionId: string | null;
      messages: ChatMessageView[];
      /** True while a send is in flight — shows a pending indicator + stop. */
      pending: boolean;
      error: string | null;
    }
  | { type: 'appended'; message: ChatMessageView; pending: boolean }
  | { type: 'pending'; pending: boolean }
  | { type: 'error'; message: string };
