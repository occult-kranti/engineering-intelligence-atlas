import { describe, expect, it } from 'vitest';
import { MAX_CHAT_MESSAGE_CHARS, parseWebviewRequest } from '../src/chat/protocol.js';
import { buildChatCsp } from '../src/webview/csp.js';

describe('chat webview CSP', () => {
  const csp = buildChatCsp('testnonce123', 'https://file.vscode-resource.test');

  it('has a strict default-src none', () => {
    expect(csp).toContain("default-src 'none'");
  });

  it('allows scripts/styles only via nonce or the extension resource scheme', () => {
    expect(csp).toContain("script-src 'nonce-testnonce123' https://file.vscode-resource.test");
    expect(csp).toContain("style-src 'nonce-testnonce123' https://file.vscode-resource.test");
    expect(csp).not.toContain("'unsafe-inline'");
    expect(csp).not.toContain("'unsafe-eval'");
    expect(csp).not.toContain('http://');
    expect(csp).not.toContain('https://*');
  });

  it('blocks network egress and embedding from the webview', () => {
    expect(csp).toContain("connect-src 'none'");
    expect(csp).toContain("frame-src 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'none'");
    expect(csp).toContain("form-action 'none'");
  });
});

describe('webview message validation', () => {
  it('accepts well-formed messages', () => {
    expect(parseWebviewRequest({ type: 'ready' })).toEqual({ type: 'ready' });
    expect(parseWebviewRequest({ type: 'listSessions' })).toEqual({ type: 'listSessions' });
    expect(parseWebviewRequest({ type: 'selectSession', sessionId: 's1' })).toEqual({
      type: 'selectSession',
      sessionId: 's1',
    });
    expect(parseWebviewRequest({ type: 'send', sessionId: 's1', text: 'hello' })).toEqual({
      type: 'send',
      sessionId: 's1',
      text: 'hello',
    });
    expect(parseWebviewRequest({ type: 'stop', sessionId: 's1' })).toEqual({
      type: 'stop',
      sessionId: 's1',
    });
  });

  it('rejects malformed, oversized, or unknown messages', () => {
    const bad: unknown[] = [
      null,
      undefined,
      42,
      'send',
      {},
      { type: 'unknown' },
      { type: 'send' },
      { type: 'send', sessionId: '', text: 'x' },
      { type: 'send', sessionId: 's1', text: '' },
      { type: 'send', sessionId: 's1', text: '   ' },
      { type: 'send', sessionId: 's1', text: 42 },
      { type: 'send', sessionId: 's1', text: 'x'.repeat(MAX_CHAT_MESSAGE_CHARS + 1) },
      { type: 'send', sessionId: 'a'.repeat(200), text: 'x' },
      { type: 'selectSession', sessionId: 'with\nnewline' },
      { type: 'stop' },
      { type: 'eval', code: 'process.exit(1)' },
    ];
    for (const m of bad) {
      expect(parseWebviewRequest(m), JSON.stringify(m)).toBeNull();
    }
  });

  it('ignores extra fields (no partial trust)', () => {
    expect(parseWebviewRequest({ type: 'send', sessionId: 's1', text: 'hi', token: 'x' })).toEqual({
      type: 'send',
      sessionId: 's1',
      text: 'hi',
    });
  });
});
