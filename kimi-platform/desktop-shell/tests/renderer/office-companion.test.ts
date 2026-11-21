// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { BridgeAdapter } from '../../src/renderer/office/bridge';
import { createOfficeApp } from '../../src/renderer/office/app';
import { setAppReduceMotion } from '../../src/renderer/office/motion';
import { flush, makeFakePanzoom, makeMockBridge, mountChromeDom, type MockBridge } from './helpers';

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

async function openConnections(root: HTMLElement): Promise<void> {
  root.querySelector<HTMLButtonElement>('#tab-connections')?.click();
  await flush();
}

beforeEach(() => {
  document.body.innerHTML = '';
  // Reduced motion: dialogs settle synchronously between modal steps.
  setAppReduceMotion(true);
  return () => setAppReduceMotion(false);
});

describe('companion controls', () => {
  it('shows the honest requires-desktop-0.4 panel on a v3 bridge', async () => {
    const { root, app } = bootApp(makeMockBridge({ v3: true }));
    await app.show();
    await openConnections(root);
    const slot = root.querySelector('#companion-slot');
    expect(slot?.textContent).toContain('requires desktop 0.4 runtime');
    expect(slot?.querySelector('button:not([disabled])')).toBeNull();
  });

  it('shows status without ever displaying a token; enable reveals it once in a modal', async () => {
    const mock = makeMockBridge({ v4: true });
    const { root, app } = bootApp(mock);
    await app.show();
    await openConnections(root);

    const slot = root.querySelector('#companion-slot')!;
    expect(slot.textContent).toContain('disabled');
    expect(slot.textContent).toContain('not paired');
    expect(slot.textContent).not.toContain('pair-token');

    slot.querySelector<HTMLButtonElement>('button:not(.secondary)')?.click();
    await flush();
    // Token appears ONLY inside the one-shot modal, with the copy-once warning.
    const modal = document.querySelector('#overlay-root .modal-backdrop:not(.hidden)');
    expect(modal?.textContent).toContain('pair-token-shown-once');
    expect(modal?.textContent).toContain('shown exactly once');
    modal?.querySelector<HTMLButtonElement>('button:not(.secondary)')?.click();
    await flush();

    // After close: token wiped everywhere, status shows capability only.
    expect(document.querySelector('#overlay-root')?.textContent ?? '').not.toContain('pair-token-shown-once');
    const slotAfter = root.querySelector('#companion-slot')!;
    expect(slotAfter.textContent).toContain('paired (token stored, never displayed)');
    expect(slotAfter.textContent).toContain('127.0.0.1:47120');
    expect(slotAfter.textContent).not.toContain('pair-token-shown-once');
  });

  it('disable asks for destructive confirmation; regenerate re-reveals a token once', async () => {
    const mock = makeMockBridge({ v4: true, companion: { enabled: true, running: true, port: 47120, paired: true } });
    const { root, app } = bootApp(mock);
    await app.show();
    await openConnections(root);
    const slot = root.querySelector('#companion-slot')!;

    // Regenerate: confirm dialog, then one-shot token modal.
    const regen = Array.from(slot.querySelectorAll<HTMLButtonElement>('button')).find((b) =>
      b.textContent?.includes('Regenerate'),
    );
    regen?.click();
    await flush();
    document.querySelector<HTMLButtonElement>('#overlay-root .modal-backdrop:not(.hidden) button.danger')?.click();
    await flush();
    const tokenModal = document.querySelector('#overlay-root .modal-backdrop:not(.hidden)');
    expect(tokenModal?.textContent).toContain('pair-token-regenerated');
    tokenModal?.querySelector<HTMLButtonElement>('button:not(.secondary)')?.click();
    await flush();
    expect(mock.calls.companionRegenerate).toBe(1);

    // Disable: destructive confirm.
    const disable = Array.from(slot.querySelectorAll<HTMLButtonElement>('button')).find((b) =>
      b.textContent?.includes('Disable'),
    );
    disable?.click();
    await flush();
    document.querySelector<HTMLButtonElement>('#overlay-root .modal-backdrop:not(.hidden) button.danger')?.click();
    await flush();
    expect(mock.calls.companionDisable).toBe(1);
    expect(root.querySelector('#companion-slot')?.textContent).toContain('disabled');
  });

  it('fails closed when OS secure storage is unavailable', async () => {
    const mock = makeMockBridge({ v4: true, companion: { encryptionAvailable: false } });
    const { root, app } = bootApp(mock);
    await app.show();
    await openConnections(root);
    const slot = root.querySelector('#companion-slot')!;
    expect(slot.textContent).toContain('OS secure storage is unavailable');
    expect(slot.querySelector<HTMLButtonElement>('button:not(.secondary)')?.disabled).toBe(true);
  });
});
