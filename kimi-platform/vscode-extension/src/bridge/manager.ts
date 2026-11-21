/**
 * Pairing state + BridgeClient lifecycle (VS Code glue).
 *
 * Token rules (enforced here and scanned in tests/staticScan.test.ts):
 *  - The pairing token lives ONLY in context.secrets (SecretStorage).
 *  - It is never written to settings.json, workspaceState or globalState.
 *  - It is never passed to the webview or logged.
 *  - Only the loopback host/port (non-secret) is persisted in globalState.
 */

import * as vscode from 'vscode';
import { BridgeClient } from './client.js';
import { parseBridgeAddress, type BridgeAddress } from './url.js';

const TOKEN_KEY = 'research-director.bridge.token';
const ADDRESS_KEY = 'research-director.bridge.address';

export class BridgeManager implements vscode.Disposable {
  #secrets: vscode.SecretStorage;
  #state: vscode.Memento;
  #client: BridgeClient | null = null;
  #address: BridgeAddress | null = null;
  #onDidChange = new vscode.EventEmitter<boolean /* paired */>();
  readonly onDidChangePairing = this.#onDidChange.event;

  constructor(context: vscode.ExtensionContext) {
    this.#secrets = context.secrets;
    this.#state = context.globalState;
    const saved = this.#state.get<{ host: string; port: number }>(ADDRESS_KEY);
    if (saved && typeof saved.host === 'string' && typeof saved.port === 'number') {
      const addr = parseBridgeAddress(saved.host, String(saved.port));
      if (addr) {
        this.#address = addr;
        this.#client = new BridgeClient({ address: addr, getToken: async () => this.#secrets.get(TOKEN_KEY) });
      }
    }
  }

  get address(): BridgeAddress | null {
    return this.#address;
  }

  async isPaired(): Promise<boolean> {
    return this.#client !== null && (await this.#secrets.get(TOKEN_KEY)) !== undefined;
  }

  /** Throws when not paired; callers catch and surface a Pair prompt. */
  client(): BridgeClient {
    if (!this.#client) throw new Error('Not paired with Research Director Desktop.');
    return this.#client;
  }

  /**
   * Pair: persist only the loopback address; the token goes straight into
   * SecretStorage. A health check must succeed before we consider ourselves
   * paired.
   */
  async pair(address: BridgeAddress, token: string): Promise<void> {
    const candidate = new BridgeClient({
      address,
      getToken: async () => token,
      timeoutMs: 5_000,
    });
    await candidate.health(); // throws on unreachable/unauthorized
    await this.#secrets.store(TOKEN_KEY, token);
    await this.#state.update(ADDRESS_KEY, { host: address.host, port: address.port });
    this.#client = new BridgeClient({ address, getToken: async () => this.#secrets.get(TOKEN_KEY) });
    this.#address = address;
    this.#onDidChange.fire(true);
  }

  async disconnect(): Promise<void> {
    await this.#secrets.delete(TOKEN_KEY);
    await this.#state.update(ADDRESS_KEY, undefined);
    this.#client = null;
    this.#address = null;
    this.#onDidChange.fire(false);
  }

  dispose(): void {
    this.#onDidChange.dispose();
  }
}
