/**
 * Chat state reducer: pending/stop/error handling with NO fake streaming.
 * A send flips pending=true; the assistant message only appears when the
 * desktop returns the completed reply (or an error/stop ends the wait).
 *
 * Pure module — unit-tested without VS Code.
 */

import type { ChatMessage } from '../bridge/types.js';

export interface ChatUiState {
  pending: boolean;
  error: string | null;
  /** Session ids with an in-flight send (only one at a time is allowed). */
  pendingSessionId: string | null;
}

export const initialChatUiState: ChatUiState = {
  pending: false,
  error: null,
  pendingSessionId: null,
};

export type ChatEvent =
  | { kind: 'send-start'; sessionId: string }
  | { kind: 'send-complete'; sessionId: string; message: ChatMessage }
  | { kind: 'send-error'; sessionId: string; error: string }
  | { kind: 'stopped'; sessionId: string }
  | { kind: 'dismiss-error' };

export function reduceChatUi(state: ChatUiState, ev: ChatEvent): ChatUiState {
  switch (ev.kind) {
    case 'send-start':
      // Reject a second concurrent send: the desktop serializes generation.
      if (state.pending) return state;
      return { pending: true, error: null, pendingSessionId: ev.sessionId };
    case 'send-complete':
      if (!state.pending || state.pendingSessionId !== ev.sessionId) return state;
      return { pending: false, error: null, pendingSessionId: null };
    case 'send-error':
      if (!state.pending || state.pendingSessionId !== ev.sessionId) return state;
      return {
        pending: false,
        error: ev.error.slice(0, 200),
        pendingSessionId: null,
      };
    case 'stopped':
      if (state.pendingSessionId !== ev.sessionId) return state;
      return { pending: false, error: null, pendingSessionId: null };
    case 'dismiss-error':
      return { ...state, error: null };
  }
}

/** User-facing text for a finished assistant message status. */
export function messageStateLabel(status: ChatMessage['status'] | undefined): string | null {
  switch (status) {
    case 'cancelled':
      return 'Generation stopped';
    case 'error':
      return 'Generation failed';
    default:
      return null;
  }
}
