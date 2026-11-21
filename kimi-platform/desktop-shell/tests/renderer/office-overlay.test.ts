// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createOverlayHost } from '../../src/renderer/office/overlay';
import { setAppReduceMotion } from '../../src/renderer/office/motion';

function keydown(target: HTMLElement, key: string, shiftKey = false): void {
  target.dispatchEvent(new KeyboardEvent('keydown', { key, shiftKey, bubbles: true, cancelable: true }));
}

let hostRoot: HTMLElement;

beforeEach(() => {
  document.body.innerHTML = '';
  // Reduced motion: overlays reach their final state synchronously (content
  // is never gated by animation), which also keeps tests deterministic.
  setAppReduceMotion(true);
  hostRoot = document.createElement('div');
  hostRoot.id = 'overlay-root';
  document.body.append(hostRoot);
});

afterEach(() => {
  setAppReduceMotion(false);
});

describe('shared dialog primitive', () => {
  it('confirm resolves true on the confirm button and false on cancel', async () => {
    const host = createOverlayHost(hostRoot);
    const opener = document.createElement('button');
    document.body.append(opener);
    opener.focus();

    const pending = host.confirm({ title: 'Revoke key', message: 'Delete the stored key?', confirmLabel: 'Revoke', danger: true });
    const backdrop = hostRoot.querySelector<HTMLElement>('.modal-backdrop');
    expect(backdrop).not.toBeNull();
    expect(backdrop?.classList.contains('hidden')).toBe(false);
    expect(backdrop?.textContent).toContain('Delete the stored key?');
    // alertdialog semantics for destructive confirms + autofocus on confirm.
    expect(backdrop?.querySelector('[role="alertdialog"]')).not.toBeNull();
    expect(document.activeElement?.textContent).toBe('Revoke');

    backdrop?.querySelector<HTMLButtonElement>('button.danger')?.click();
    await expect(pending).resolves.toBe(true);
    // Exit: hidden again and focus returned to the opener.
    expect(backdrop?.classList.contains('hidden')).toBe(true);
    expect(document.activeElement).toBe(opener);

    const pending2 = host.confirm({ title: 't', message: 'm' });
    const cancel = hostRoot.querySelectorAll<HTMLButtonElement>('.modal-backdrop button.secondary');
    cancel[cancel.length - 1]?.click();
    await expect(pending2).resolves.toBe(false);
  });

  it('Escape closes the dialog (resolves false) and returns focus', async () => {
    const host = createOverlayHost(hostRoot);
    const opener = document.createElement('button');
    document.body.append(opener);
    opener.focus();
    const pending = host.confirm({ title: 't', message: 'm' });
    const backdrop = hostRoot.querySelector<HTMLElement>('.modal-backdrop')!;
    keydown(backdrop, 'Escape');
    await expect(pending).resolves.toBe(false);
    expect(backdrop.classList.contains('hidden')).toBe(true);
    expect(document.activeElement).toBe(opener);
  });

  it('backdrop click closes; clicks inside the dialog do not', async () => {
    const host = createOverlayHost(hostRoot);
    const pending = host.confirm({ title: 't', message: 'm' });
    const backdrop = hostRoot.querySelector<HTMLElement>('.modal-backdrop')!;
    const dialog = backdrop.querySelector<HTMLElement>('.modal')!;
    dialog.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(backdrop.classList.contains('hidden')).toBe(false);
    backdrop.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await expect(pending).resolves.toBe(false);
  });

  it('traps Tab focus inside the dialog (cycles last -> first and first -> last)', async () => {
    const host = createOverlayHost(hostRoot);
    void host.confirm({ title: 't', message: 'm', confirmLabel: 'OK' });
    const backdrop = hostRoot.querySelector<HTMLElement>('.modal-backdrop')!;
    const buttons = Array.from(backdrop.querySelectorAll<HTMLButtonElement>('button'));
    expect(buttons.length).toBeGreaterThanOrEqual(2);
    const first = buttons[0]!;
    const last = buttons[buttons.length - 1]!;

    last.focus();
    keydown(backdrop, 'Tab');
    expect(document.activeElement).toBe(first);
    first.focus();
    keydown(backdrop, 'Tab', true);
    expect(document.activeElement).toBe(last);
  });

  it('revealSecret shows the token once and wipes it from the DOM on close', async () => {
    const host = createOverlayHost(hostRoot);
    const pending = host.revealSecret({ title: 'Pairing token', secret: 'sekret-token-123', message: 'Pair now.' });
    const backdrop = hostRoot.querySelector<HTMLElement>('.modal-backdrop')!;
    expect(backdrop.textContent).toContain('sekret-token-123');
    expect(backdrop.textContent).toContain('shown exactly once');
    backdrop.querySelector<HTMLButtonElement>('button:not(.secondary)')?.click();
    await pending;
    expect(backdrop.textContent).not.toContain('sekret-token-123');
  });

  it('toasts render in the polite region and auto-dismiss', async () => {
    const host = createOverlayHost(hostRoot);
    host.toast('Saved.', { kind: 'ok', durationMs: 10 });
    const region = hostRoot.querySelector('.toast-region');
    expect(region?.getAttribute('aria-live')).toBe('polite');
    expect(region?.textContent).toContain('Saved.');
    await new Promise((r) => setTimeout(r, 40));
    expect(region?.textContent ?? '').not.toContain('Saved.');
  });

  it('attachDialog upgrades static markup with trap/Escape/return-focus', () => {
    const host = createOverlayHost(hostRoot);
    const opener = document.createElement('button');
    document.body.append(opener);
    opener.focus();
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop hidden';
    const inner = document.createElement('div');
    inner.className = 'modal';
    const input = document.createElement('input');
    const closeBtn = document.createElement('button');
    inner.append(input, closeBtn);
    backdrop.append(inner);
    document.body.append(backdrop);

    const dialog = host.attachDialog(backdrop);
    dialog.open();
    expect(backdrop.classList.contains('hidden')).toBe(false);
    expect(backdrop.getAttribute('aria-modal')).toBe('true');
    expect(document.activeElement).toBe(input);
    keydown(backdrop, 'Escape');
    expect(backdrop.classList.contains('hidden')).toBe(true);
    expect(document.activeElement).toBe(opener);
  });
});
