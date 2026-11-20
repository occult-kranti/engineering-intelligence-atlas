import { describe, expect, it } from 'vitest';
import { isTrustedLocalSender, UntrustedSenderError } from '../src/main/senderGuard';

const SHELL_ID = 1;

function makeEvent(overrides: Partial<{ senderId: number; frameUrl: string | undefined; topUrl: string | null }>) {
  const frameUrl = overrides.frameUrl;
  return {
    sender: { id: overrides.senderId ?? SHELL_ID },
    senderFrame:
      frameUrl === undefined
        ? null
        : { url: frameUrl, top: overrides.topUrl === null ? null : { url: overrides.topUrl ?? frameUrl } },
  };
}

describe('IPC sender validation', () => {
  it('accepts the shell window chrome page (file://)', () => {
    const event = makeEvent({ frameUrl: 'file:///app/dist/renderer/chrome.html' });
    expect(isTrustedLocalSender(event, { id: SHELL_ID })).toBe(true);
  });

  it('rejects a different webContents (wrong sender)', () => {
    const event = makeEvent({ senderId: 999, frameUrl: 'file:///app/dist/renderer/chrome.html' });
    expect(isTrustedLocalSender(event, { id: SHELL_ID })).toBe(false);
  });

  it('rejects remote frames even from the shell webContents', () => {
    expect(isTrustedLocalSender(makeEvent({ frameUrl: 'https://evil.example/page' }), { id: SHELL_ID })).toBe(false);
    expect(isTrustedLocalSender(makeEvent({ frameUrl: undefined }), { id: SHELL_ID })).toBe(false);
  });

  it('rejects subframes (top url differs)', () => {
    const event = makeEvent({ frameUrl: 'file:///x.html', topUrl: 'file:///chrome.html' });
    expect(isTrustedLocalSender(event, { id: SHELL_ID })).toBe(false);
  });

  it('rejects when the shell window is gone', () => {
    const event = makeEvent({ frameUrl: 'file:///app/dist/renderer/chrome.html' });
    expect(isTrustedLocalSender(event, null)).toBe(false);
  });

  it('produces a clear refusal error', () => {
    expect(new UntrustedSenderError().message).toMatch(/Refused/);
  });
});
