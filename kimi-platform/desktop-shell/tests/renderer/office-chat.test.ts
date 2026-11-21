// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { BridgeAdapter } from '../../src/renderer/office/bridge';
import { createOfficeApp } from '../../src/renderer/office/app';
import {
  flush,
  makeFakePanzoom,
  makeMockBridge,
  mountChromeDom,
  sampleChatMessage,
  sampleChatSession,
  type MockBridge,
} from './helpers';

function bootApp(mock: MockBridge) {
  const root = mountChromeDom();
  const { factory } = makeFakePanzoom();
  const app = createOfficeApp({
    root,
    adapter: new BridgeAdapter(mock.bridge),
    panzoomFactory: factory as never,
  });
  return { app, root, mock };
}

/** Wait past the chat render-coalescing window (80ms). */
async function settleChat(): Promise<void> {
  await new Promise((r) => setTimeout(r, 130));
  await flush();
}

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('chat capability honesty', () => {
  it('shows the requires-desktop-0.4 fallback on a v3 bridge (no fake chat UI)', async () => {
    const { root, app } = bootApp(makeMockBridge({ v3: true }));
    await app.show();
    await flush();
    root.querySelector<HTMLButtonElement>('#insp-tab-chat')?.click();
    await flush();
    const panel = root.querySelector('#insp-panel-chat');
    expect(panel?.textContent).toContain('requires desktop 0.4 runtime');
    // The interactive shell is hidden, not faked.
    expect(panel?.querySelector('.chat-shell')?.classList.contains('hidden')).toBe(true);
  });
});

describe('Director chat (v4)', () => {
  function v4Mock() {
    return makeMockBridge({
      v4: true,
      chatSessions: [
        sampleChatSession({
          messages: [
            sampleChatMessage({ id: 'm1', role: 'user', text: 'Hello Director', usage: null, provenance: null }),
            sampleChatMessage({ id: 'm2', text: 'Hello. The atlas study is on track.' }),
          ],
        }),
      ],
    });
  }

  it('lists sessions, renders messages with provenance and no-raw-CoT labeling', async () => {
    const { root, app } = bootApp(v4Mock());
    await app.show();
    await settleChat();

    const panel = root.querySelector('#insp-panel-chat')!;
    const select = panel.querySelector<HTMLSelectElement>('#chat-session-select');
    expect(select?.textContent).toContain('Atlas Study Director');
    expect(panel.querySelectorAll('.chat-msg')).toHaveLength(2);
    expect(panel.textContent).toContain('Hello. The atlas study is on track.');
    expect(panel.textContent).toContain('provenance: openai · gpt-5.2');
    expect(panel.textContent).toContain('raw chain-of-thought is never requested or shown');
    // Budget/rate visibility.
    expect(panel.textContent).toContain('1200/50000 tokens');
    expect(panel.textContent).toContain('rates in $5/M');
  });

  it('sends through the explicit provider-call confirmation (budget visible), then polls the reply', async () => {
    const mock = v4Mock();
    const { root, app } = bootApp(mock);
    await app.show();
    await settleChat();

    const text = root.querySelector<HTMLTextAreaElement>('#chat-composer-text')!;
    text.value = 'What is blocking the run?';
    root.querySelector<HTMLButtonElement>('#chat-send')?.click();
    await flush();

    // Explicit confirmation dialog with budget/rate context — nothing sent yet.
    const dialog = document.querySelector('.overlay-root .modal-backdrop:not(.hidden), #overlay-root .modal-backdrop:not(.hidden)');
    expect(dialog?.textContent).toContain('Send to provider');
    expect(dialog?.textContent).toContain('$0.0100/$2');
    expect(mock.calls.chatSend).toHaveLength(0);
    dialog?.querySelector<HTMLButtonElement>('button:not(.secondary)')?.click();
    await flush();

    expect(mock.calls.chatSend).toEqual([
      { sessionId: 'chat-1', text: 'What is blocking the run?', confirmed: true },
    ]);
    await settleChat();
    const panel = root.querySelector('#insp-panel-chat')!;
    // Pending non-streaming indicator + stop control, no fake streaming.
    expect(panel.textContent).toContain('Director is working…');
    expect(root.querySelector<HTMLButtonElement>('#chat-stop')?.classList.contains('hidden')).toBe(false);

    // The reply completes; a poll picks it up without duplicates.
    mock.completeChat('chat-1', 'Nothing is blocking; the reviewer gate was approved.');
    // app-internal controller polls: trigger via a project event-free path
    await settleChat();
    // Simulate the poll interval firing by waiting past POLL_MS.
    await new Promise((r) => setTimeout(r, 1000));
    await settleChat();
    expect(panel.textContent).toContain('Nothing is blocking');
    expect(panel.querySelectorAll('[data-message-id]')).toHaveLength(4);
    expect(panel.querySelectorAll('.chat-msg.chat-assistant.chat-status-completed').length).toBeGreaterThanOrEqual(2);
  });

  it('does not send when the confirmation is cancelled', async () => {
    const mock = v4Mock();
    const { root, app } = bootApp(mock);
    await app.show();
    await settleChat();
    root.querySelector<HTMLTextAreaElement>('#chat-composer-text')!.value = 'Draft';
    root.querySelector<HTMLButtonElement>('#chat-send')?.click();
    await flush();
    document.querySelector<HTMLButtonElement>('#overlay-root button.secondary, .overlay-root button.secondary')?.click();
    await flush();
    expect(mock.calls.chatSend).toHaveLength(0);
  });

  it('Enter sends, Shift+Enter inserts a newline', async () => {
    const mock = v4Mock();
    const { root, app } = bootApp(mock);
    await app.show();
    await settleChat();
    const text = root.querySelector<HTMLTextAreaElement>('#chat-composer-text')!;
    text.value = 'line one';
    text.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', shiftKey: true, bubbles: true, cancelable: true }));
    await flush();
    expect(mock.calls.chatSend).toHaveLength(0);
    text.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    await flush();
    expect(document.querySelector('#overlay-root .modal-backdrop:not(.hidden)')).not.toBeNull();
  });

  it('stop cancels the pending reply', async () => {
    const mock = v4Mock();
    const { root, app } = bootApp(mock);
    await app.show();
    await settleChat();
    root.querySelector<HTMLTextAreaElement>('#chat-composer-text')!.value = 'go';
    root.querySelector<HTMLButtonElement>('#chat-send')?.click();
    await flush();
    document.querySelector<HTMLButtonElement>('#overlay-root .modal-backdrop:not(.hidden) button:not(.secondary)')?.click();
    await settleChat();

    root.querySelector<HTMLButtonElement>('#chat-stop')?.click();
    await settleChat();
    const panel = root.querySelector('#insp-panel-chat')!;
    expect(panel.textContent).toContain('Stopped before completion.');
    expect(root.querySelector<HTMLButtonElement>('#chat-stop')?.classList.contains('hidden')).toBe(true);
  });

  it('quick actions send real Director messages', async () => {
    const mock = v4Mock();
    const { root, app } = bootApp(mock);
    await app.show();
    await settleChat();
    root.querySelector<HTMLButtonElement>('[data-quick-action="Ask status"]')?.click();
    await flush();
    document.querySelector<HTMLButtonElement>('#overlay-root .modal-backdrop:not(.hidden) button:not(.secondary)')?.click();
    await flush();
    expect(mock.calls.chatSend[0]?.text).toContain('current status');
  });

  it('windows a 500-message history (DOM cap) and pages earlier messages on demand', async () => {
    const messages = Array.from({ length: 500 }, (_, i) =>
      sampleChatMessage({
        id: `bulk-${i}`,
        role: i % 2 === 0 ? 'user' : 'assistant',
        text: `message ${i}`,
      }),
    );
    const mock = makeMockBridge({ v4: true, chatSessions: [sampleChatSession({ messages })] });
    const { root, app } = bootApp(mock);
    await app.show();
    await settleChat();

    const log = root.querySelector('#insp-panel-chat .chat-log')!;
    expect(log.querySelectorAll('[data-message-id]').length).toBeLessThanOrEqual(100);
    expect(log.querySelector('[data-message-id="bulk-499"]')).not.toBeNull();
    expect(log.querySelector('[data-message-id="bulk-0"]')).toBeNull();

    const earlier = root.querySelector<HTMLButtonElement>('.chat-earlier');
    expect(earlier?.classList.contains('hidden')).toBe(false);
    earlier?.click();
    await flush();
    expect(log.querySelector('[data-message-id="bulk-300"]')).not.toBeNull();
    expect(log.querySelectorAll('[data-message-id]').length).toBeLessThanOrEqual(200);
  });

  it('auto-scrolls only when pinned; otherwise shows the new-message pill', async () => {
    const mock = v4Mock();
    const { root, app } = bootApp(mock);
    await app.show();
    await settleChat();

    const log = root.querySelector<HTMLElement>('#insp-panel-chat .chat-log')!;
    // Simulate a long conversation scrolled up (jsdom has no layout).
    Object.defineProperty(log, 'scrollHeight', { value: 2000, configurable: true, writable: true });
    Object.defineProperty(log, 'clientHeight', { value: 300, configurable: true });
    Object.defineProperty(log, 'scrollTop', { value: 0, configurable: true, writable: true });
    log.dispatchEvent(new Event('scroll'));

    // New reply arrives while unpinned: pill appears, no forced scroll.
    mock.chatSessions[0]?.messages.push(
      sampleChatMessage({ id: 'm3', text: 'Unpinned reply', provenance: null }),
    );
    mock.pushEvents([]);
    // Trigger a poll by sending a stop-free refresh: use the project event-free poll via send.
    const panel = root.querySelector('#insp-panel-chat')!;
    // pollOnce is driven by the poll interval only while pending; emulate by
    // completing via a new user send.
    root.querySelector<HTMLTextAreaElement>('#chat-composer-text')!.value = 'ping';
    root.querySelector<HTMLButtonElement>('#chat-send')?.click();
    await flush();
    document.querySelector<HTMLButtonElement>('#overlay-root .modal-backdrop:not(.hidden) button:not(.secondary)')?.click();
    await settleChat();

    const pill = panel.querySelector<HTMLButtonElement>('.chat-new-pill');
    expect(pill?.classList.contains('hidden')).toBe(false);
    expect((log as unknown as { scrollTop: number }).scrollTop).toBe(0);

    // Clicking the pill pins and scrolls to the bottom.
    pill?.click();
    await flush();
    expect(pill?.classList.contains('hidden')).toBe(true);
  });

  it('creates and deletes sessions (delete behind a destructive confirmation)', async () => {
    const mock = v4Mock();
    const { root, app } = bootApp(mock);
    await app.show();
    await settleChat();

    // New session
    const panel = root.querySelector('#insp-panel-chat')!;
    const buttons = Array.from(panel.querySelectorAll<HTMLButtonElement>('.chat-session-bar button'));
    buttons.find((b) => b.textContent === 'New session')?.click();
    await settleChat();
    expect(mock.chatSessions).toHaveLength(2);
    expect(panel.querySelector<HTMLSelectElement>('#chat-session-select')?.value).toBe('chat-2');

    // Delete behind confirmation
    buttons.find((b) => b.textContent === 'Delete')?.click();
    await flush();
    const dialog = document.querySelector('#overlay-root .modal-backdrop:not(.hidden)');
    expect(dialog?.textContent).toContain('Delete chat session');
    dialog?.querySelector<HTMLButtonElement>('button.danger')?.click();
    await settleChat();
    expect(mock.chatSessions).toHaveLength(1);
  });

  it('node inspector Ask-about-this-node sets and clears chat scope', async () => {
    const mock = v4Mock();
    const { root, app } = bootApp(mock);
    await app.show();
    await settleChat();

    root.querySelector<HTMLButtonElement>('.desk[data-node-id="n-builder"]')?.click();
    await flush();
    const askBtn = root.querySelector<HTMLButtonElement>('#node-ask-btn');
    expect(askBtn?.textContent).toBe('Ask about this node');
    askBtn?.click();
    await flush();

    expect(root.querySelector('#insp-tab-chat')?.getAttribute('aria-selected')).toBe('true');
    expect(root.querySelector('#insp-panel-chat')?.textContent).toContain('Scope: Builder');

    // Clearing the scope from the node inspector.
    root.querySelector<HTMLButtonElement>('#insp-tab-node')?.click();
    await flush();
    root.querySelector<HTMLButtonElement>('#node-ask-btn')?.click();
    await flush();
    expect(root.querySelector('#insp-panel-chat')?.textContent).not.toContain('Scope: Builder');
  });
});
