/**
 * v4 companion bridge controls (Connections tab): status, enable/disable,
 * and regenerate-pairing against the real ChatManager/companion API. The
 * pairing token is shown exactly once — inside the enable/regenerate modal
 * with a copy-once warning — and NEVER in the status panel, the DOM after
 * close, logs, or events. When the backend is too old the panel degrades to
 * an honest requires-desktop-0.4 state.
 */

import { BridgeAdapter, UNAVAILABLE_V4 } from './bridge.js';
import { button, clear, el } from './dom.js';
import type { OverlayHost } from './overlay.js';
import type { CompanionStatus } from './types.js';

export interface CompanionDeps {
  container: HTMLElement;
  adapter: BridgeAdapter;
  overlay: OverlayHost;
  announce(message: string): void;
}

export interface CompanionControls {
  refresh(): Promise<void>;
}

export function createCompanionControls(deps: CompanionDeps): CompanionControls {
  const { container, adapter, overlay, announce } = deps;

  function renderUnavailable(): void {
    clear(container);
    const panelBox = el('div', 'panel companion-panel');
    panelBox.append(
      el('h2', '', 'VS Code companion (loopback)'),
      el(
        'p',
        'status warn',
        `Companion controls ${UNAVAILABLE_V4}. The bridge is off by default; update the desktop app to pair a ` +
          'local VS Code extension over 127.0.0.1 with a one-time token.',
      ),
    );
    container.append(panelBox);
  }

  function renderStatus(status: CompanionStatus): void {
    clear(container);
    const panelBox = el('div', 'panel companion-panel');
    panelBox.append(el('h2', '', 'VS Code companion (loopback)'));
    panelBox.append(
      el(
        'p',
        'muted',
        'Optional local bridge for the VS Code extension. Disabled by default. When enabled it listens only on ' +
          '127.0.0.1 and requires the pairing token for every call. The token is shown exactly once when created.',
      ),
    );

    if (!status.encryptionAvailable) {
      panelBox.append(
        el(
          'p',
          'status error',
          'OS secure storage is unavailable — pairing tokens cannot be stored, so the companion cannot be enabled. ' +
            'Unlock your keychain and restart the app.',
        ),
      );
    }

    const rows = el('dl', 'kv');
    const add = (k: string, v: string) => rows.append(el('dt', '', k), el('dd', '', v));
    add('Bridge', status.enabled ? (status.running ? `enabled · listening on 127.0.0.1:${status.port ?? '?'}` : 'enabled (listener not running)') : 'disabled');
    // Honest capability only: whether a token exists — never the token itself.
    add('Pairing', status.paired ? 'paired (token stored, never displayed)' : 'not paired');
    rows.dataset.companionState = status.enabled ? 'enabled' : 'disabled';
    panelBox.append(rows);

    const actions = el('div', 'row wrap');
    if (!status.enabled) {
      const enableBtn = button('', 'Enable companion…', () => void enable());
      enableBtn.disabled = !status.encryptionAvailable;
      actions.append(enableBtn);
    } else {
      const disableBtn = button('secondary', 'Disable companion', () => void disable());
      const regenBtn = button('secondary', 'Regenerate pairing token…', () => void regenerate());
      actions.append(disableBtn, regenBtn);
    }
    panelBox.append(actions);
    container.append(panelBox);
  }

  async function revealToken(result: { token?: string; port?: number; error?: string; ok: boolean }): Promise<void> {
    if (!result.ok || !result.token) {
      announce('Companion action failed.');
      await refresh();
      return;
    }
    const token = result.token;
    await overlay.revealSecret({
      title: 'Pairing token (shown once)',
      secret: token,
      message: `Paste this token into the VS Code extension to pair with the companion on 127.0.0.1${result.port ? `:${result.port}` : ''}.`,
    });
    await refresh();
  }

  async function enable(): Promise<void> {
    const res = await adapter.companionEnable();
    if (!res.ok) {
      announce(`Could not enable the companion: ${res.error}`);
      await refresh();
      return;
    }
    announce('Companion enabled. Save the pairing token now — it is shown once.');
    await revealToken(res.value);
  }

  async function disable(): Promise<void> {
    const ok = await overlay.confirm({
      title: 'Disable companion',
      message: 'Disable the loopback companion bridge? The VS Code extension will lose access immediately.',
      confirmLabel: 'Disable',
      danger: true,
    });
    if (!ok) return;
    const res = await adapter.companionDisable();
    announce(res.ok ? 'Companion disabled.' : `Could not disable the companion: ${res.error}`);
    await refresh();
  }

  async function regenerate(): Promise<void> {
    const ok = await overlay.confirm({
      title: 'Regenerate pairing token',
      message: 'This invalidates the current pairing token. The VS Code extension must be re-paired with the new token.',
      confirmLabel: 'Regenerate token',
      danger: true,
    });
    if (!ok) return;
    const res = await adapter.companionRegenerateToken();
    if (!res.ok) {
      announce(`Could not regenerate the token: ${res.error}`);
      await refresh();
      return;
    }
    announce('New pairing token generated. Save it now — it is shown once.');
    await revealToken(res.value);
  }

  async function refresh(): Promise<void> {
    if (!adapter.capabilities.companion) {
      renderUnavailable();
      return;
    }
    const res = await adapter.companionStatus();
    if (!res.ok) {
      clear(container);
      const panelBox = el('div', 'panel companion-panel');
      panelBox.append(el('h2', '', 'VS Code companion (loopback)'));
      panelBox.append(el('p', 'status error', `Companion status unavailable: ${res.error}`));
      const retry = button('secondary', 'Retry', () => void refresh());
      panelBox.append(retry);
      container.append(panelBox);
      return;
    }
    renderStatus(res.value);
  }

  return { refresh };
}
