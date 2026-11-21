import { describe, expect, it } from 'vitest';
import {
  initialChatUiState,
  messageStateLabel,
  reduceChatUi,
  type ChatUiState,
} from '../src/chat/state.js';
import type { ChatMessage } from '../src/bridge/types.js';

const reply: ChatMessage = {
  id: 'm1',
  role: 'assistant',
  status: 'completed',
  text: 'done',
  error: null,
  usage: null,
  provenance: null,
  actions: [],
  createdAt: '2026-01-01T00:00:00Z',
  finishedAt: '2026-01-01T00:00:01Z',
};

describe('chat pending/stop reducer (no fake streaming)', () => {
  it('send-start flips pending and blocks a second concurrent send', () => {
    const s1 = reduceChatUi(initialChatUiState, { kind: 'send-start', sessionId: 's1' });
    expect(s1.pending).toBe(true);
    expect(s1.pendingSessionId).toBe('s1');
    const s2 = reduceChatUi(s1, { kind: 'send-start', sessionId: 's2' });
    expect(s2).toEqual(s1); // ignored
  });

  it('send-complete clears pending only for the matching session', () => {
    const s1 = reduceChatUi(initialChatUiState, { kind: 'send-start', sessionId: 's1' });
    const wrong = reduceChatUi(s1, { kind: 'send-complete', sessionId: 'other', message: reply });
    expect(wrong.pending).toBe(true);
    const done = reduceChatUi(s1, { kind: 'send-complete', sessionId: 's1', message: reply });
    expect(done).toEqual({ pending: false, error: null, pendingSessionId: null });
  });

  it('send-error surfaces a bounded error and clears pending', () => {
    const s1 = reduceChatUi(initialChatUiState, { kind: 'send-start', sessionId: 's1' });
    const s2 = reduceChatUi(s1, { kind: 'send-error', sessionId: 's1', error: 'x'.repeat(500) });
    expect(s2.pending).toBe(false);
    expect(s2.error).toHaveLength(200);
  });

  it('stopped clears pending for the matching session', () => {
    const s1 = reduceChatUi(initialChatUiState, { kind: 'send-start', sessionId: 's1' });
    const s2 = reduceChatUi(s1, { kind: 'stopped', sessionId: 's1' });
    expect(s2.pending).toBe(false);
    const untouched = reduceChatUi(s1, { kind: 'stopped', sessionId: 'other' });
    expect(untouched.pending).toBe(true);
  });

  it('dismiss-error clears only the error', () => {
    const s: ChatUiState = { pending: false, error: 'boom', pendingSessionId: null };
    expect(reduceChatUi(s, { kind: 'dismiss-error' }).error).toBeNull();
  });

  it('labels cancelled/error assistant messages', () => {
    expect(messageStateLabel('cancelled')).toBe('Generation stopped');
    expect(messageStateLabel('error')).toBe('Generation failed');
    expect(messageStateLabel('completed')).toBeNull();
    expect(messageStateLabel('pending')).toBeNull();
    expect(messageStateLabel(undefined)).toBeNull();
  });
});
