/**
 * One shared accessible overlay primitive for the whole renderer: modal
 * dialogs (focus trap, Escape, backdrop click, return-focus, animated
 * enter/exit), destructive confirmations (replaces every window.confirm),
 * one-shot secret reveals (pairing tokens), and toasts.
 *
 * All content is rendered via textContent — never innerHTML — so messages
 * are data, not markup. Animations are transform/opacity only and are
 * skipped entirely when motion is reduced (content is never gated).
 */

import { el, button } from './dom.js';
import { MOTION_TOKENS, isMotionReduced } from './motion.js';

export interface ConfirmOptions {
  title: string;
  message: string;
  /** Secondary, smaller-print explanation. */
  detail?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Destructive styling + the word is repeated in the button. */
  danger?: boolean;
}

export interface DialogController {
  open(): void;
  close(): void;
  isOpen(): boolean;
  /** The element that had focus before the dialog opened (for tests). */
  previouslyFocused(): Element | null;
}

export interface OverlayHost {
  /** Promise-based destructive/neutral confirmation. Never window.confirm. */
  confirm(options: ConfirmOptions): Promise<boolean>;
  /**
   * Show a high-entropy secret exactly once (companion pairing token). The
   * secret lives only in this dialog; closing discards the only rendered copy.
   */
  revealSecret(options: { title: string; secret: string; message: string }): Promise<{ copied: boolean }>;
  toast(message: string, options?: { kind?: 'info' | 'ok' | 'error'; durationMs?: number }): void;
  /** Upgrade an existing .modal-backdrop element into a managed dialog. */
  attachDialog(backdrop: HTMLElement): DialogController;
  /** Number of currently open dialogs (test/inspection hook). */
  activeDialogCount(): number;
  destroy(): void;
}

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]), summary';

function focusables(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (node) => node.offsetParent !== null || node === document.activeElement || !node.closest('[hidden]'),
  );
}

export function createOverlayHost(overlayRoot: HTMLElement): OverlayHost {
  overlayRoot.classList.add('overlay-root');
  const toastRegion = el('div', 'toast-region');
  toastRegion.setAttribute('aria-live', 'polite');
  toastRegion.setAttribute('aria-label', 'Notifications');
  overlayRoot.append(toastRegion);

  /** Stack of open dialogs; only the topmost traps focus / handles Escape. */
  const openDialogs: Array<{ backdrop: HTMLElement; close: (result?: unknown) => void }> = [];

  function trapKeydown(backdrop: HTMLElement, event: KeyboardEvent): void {
    const top = openDialogs[openDialogs.length - 1];
    if (!top || top.backdrop !== backdrop) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      top.close();
      return;
    }
    if (event.key !== 'Tab') return;
    const nodes = focusables(backdrop);
    if (nodes.length === 0) {
      event.preventDefault();
      return;
    }
    const first = nodes[0]!;
    const last = nodes[nodes.length - 1]!;
    const active = document.activeElement;
    if (event.shiftKey && (active === first || !backdrop.contains(active))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (active === last || !backdrop.contains(active))) {
      event.preventDefault();
      first.focus();
    }
  }

  function animateExit(backdrop: HTMLElement, done: () => void): void {
    if (isMotionReduced()) {
      done();
      return;
    }
    backdrop.classList.add('overlay-exit');
    window.setTimeout(done, MOTION_TOKENS.slow);
  }

  function registerDialog(
    backdrop: HTMLElement,
    onClose: (result?: unknown) => void,
    initialFocus?: HTMLElement | null,
  ): DialogController {
    const previouslyFocusedElement = { current: null as Element | null };
    let open = false;

    const keydownHandler = (event: KeyboardEvent) => trapKeydown(backdrop, event);
    const clickHandler = (event: MouseEvent) => {
      if (event.target === backdrop) controller.close();
    };

    const controller: DialogController = {
      open(): void {
        if (open) return;
        open = true;
        previouslyFocusedElement.current = document.activeElement;
        backdrop.classList.remove('hidden', 'overlay-exit');
        backdrop.classList.add('overlay-enter');
        backdrop.setAttribute('role', backdrop.getAttribute('role') ?? 'dialog');
        if (!backdrop.hasAttribute('aria-modal')) backdrop.setAttribute('aria-modal', 'true');
        backdrop.addEventListener('keydown', keydownHandler);
        backdrop.addEventListener('click', clickHandler);
        openDialogs.push({ backdrop, close: (result) => finish(result) });
        const target =
          initialFocus ??
          backdrop.querySelector<HTMLElement>('[data-autofocus]') ??
          focusables(backdrop)[0] ??
          null;
        target?.focus();
      },
      close(): void {
        finish();
      },
      isOpen: () => open,
      previouslyFocused: () => previouslyFocusedElement.current,
    };

    function finish(result?: unknown): void {
      if (!open) return;
      open = false;
      const idx = openDialogs.findIndex((d) => d.backdrop === backdrop);
      if (idx >= 0) openDialogs.splice(idx, 1);
      backdrop.removeEventListener('keydown', keydownHandler);
      backdrop.removeEventListener('click', clickHandler);
      animateExit(backdrop, () => {
        backdrop.classList.add('hidden');
        backdrop.classList.remove('overlay-enter', 'overlay-exit');
      });
      const previous = previouslyFocusedElement.current;
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus();
      onClose(result);
    }

    return controller;
  }

  function confirm(options: ConfirmOptions): Promise<boolean> {
    return new Promise((resolve) => {
      const backdrop = el('div', 'modal-backdrop hidden');
      const dialog = el('div', 'modal modal-confirm');
      dialog.setAttribute('role', options.danger ? 'alertdialog' : 'dialog');
      const titleId = `confirm-title-${Math.random().toString(36).slice(2)}`;
      const descId = `confirm-desc-${Math.random().toString(36).slice(2)}`;
      dialog.setAttribute('aria-labelledby', titleId);
      dialog.setAttribute('aria-describedby', descId);
      backdrop.setAttribute('role', 'presentation');

      const title = el('h2', '', options.title);
      title.id = titleId;
      const message = el('p', 'confirm-message', options.message);
      message.id = descId;
      dialog.append(title, message);
      if (options.detail) dialog.append(el('p', 'muted', options.detail));

      const actions = el('div', 'row dialog-actions');
      const cancelBtn = button('secondary', options.cancelLabel ?? 'Cancel', () => finish(false));
      const confirmBtn = button(options.danger ? 'danger' : '', options.confirmLabel ?? 'Confirm', () => finish(true));
      confirmBtn.setAttribute('data-autofocus', '');
      actions.append(cancelBtn, confirmBtn);
      dialog.append(actions);
      backdrop.append(dialog);
      overlayRoot.append(backdrop);

      let settled = false;
      const controller = registerDialog(
        backdrop,
        () => {
          if (!settled) {
            settled = true;
            resolve(false);
          }
          window.setTimeout(() => backdrop.remove(), isMotionReduced() ? 0 : MOTION_TOKENS.slow);
        },
        confirmBtn,
      );
      function finish(value: boolean): void {
        if (settled) return;
        settled = true;
        resolve(value);
        controller.close();
      }
      cancelBtn.addEventListener('click', () => undefined);
      controller.open();
    });
  }

  function revealSecret(options: { title: string; secret: string; message: string }): Promise<{ copied: boolean }> {
    return new Promise((resolve) => {
      let copied = false;
      const backdrop = el('div', 'modal-backdrop hidden');
      const dialog = el('div', 'modal modal-confirm');
      dialog.setAttribute('role', 'dialog');
      const title = el('h2', '', options.title);
      dialog.append(title, el('p', 'confirm-message', options.message));
      const secretBox = el('code', 'secret-box', options.secret);
      secretBox.setAttribute('aria-label', 'Pairing token. Shown once.');
      dialog.append(secretBox);
      dialog.append(
        el(
          'p',
          'status warn',
          'Copy this token now — it is shown exactly once and is never displayed or logged again. The status panel only ever shows whether a token exists.',
        ),
      );
      const actions = el('div', 'row dialog-actions');
      const copyBtn = button('secondary', 'Copy token', () => {
        copied = true;
        copyBtn.textContent = 'Copied';
        copyBtn.disabled = true;
        void navigator.clipboard?.writeText(options.secret).catch(() => {
          copyBtn.textContent = 'Select and copy manually';
        });
      });
      const doneBtn = button('', 'Done — I saved the token', () => finish());
      doneBtn.setAttribute('data-autofocus', '');
      actions.append(copyBtn, doneBtn);
      dialog.append(actions);
      backdrop.append(dialog);
      overlayRoot.append(backdrop);

      const controller = registerDialog(backdrop, () => {
        // Discard the only rendered copy of the secret.
        secretBox.textContent = '';
        resolve({ copied });
        window.setTimeout(() => backdrop.remove(), isMotionReduced() ? 0 : MOTION_TOKENS.slow);
      });
      function finish(): void {
        controller.close();
      }
      controller.open();
    });
  }

  function toast(message: string, options?: { kind?: 'info' | 'ok' | 'error'; durationMs?: number }): void {
    const kind = options?.kind ?? 'info';
    const item = el('div', `toast toast-${kind}`, message);
    item.setAttribute('role', kind === 'error' ? 'alert' : 'status');
    toastRegion.append(item);
    const ttl = options?.durationMs ?? 4000;
    window.setTimeout(() => {
      if (isMotionReduced()) {
        item.remove();
        return;
      }
      item.classList.add('toast-exit');
      window.setTimeout(() => item.remove(), MOTION_TOKENS.standard);
    }, ttl);
  }

  return {
    confirm,
    revealSecret,
    toast,
    attachDialog: (backdrop: HTMLElement) => registerDialog(backdrop, () => undefined),
    activeDialogCount: () => openDialogs.length,
    destroy(): void {
      openDialogs.splice(0).forEach((d) => d.close());
    },
  };
}
