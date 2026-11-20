import fs from 'node:fs';
import path from 'node:path';
import type { ApiProvider, ProviderCredentialStatus, VaultStatus } from '../shared/contract';

/**
 * OS-backed credential vault.
 *
 * API keys are encrypted with Electron's safeStorage (OS keychain: DPAPI on
 * Windows, Keychain on macOS, libsecret/KWallet on Linux) and stored ONLY as
 * encrypted blobs under `userData/vault/`. Metadata (configured flag,
 * timestamps) lives in `vault.json` and never contains key material — not
 * even a last4.
 *
 * Fail-closed: when `safeStorage.isEncryptionAvailable()` is false (e.g. a
 * Linux session with no keyring/unlocked keyring), `setKey` refuses and
 * `getKey` returns null. See SECURITY.md for the rooted/unlocked-device
 * threat model.
 */

export interface SafeStorageLike {
  isEncryptionAvailable(): boolean;
  encryptString(plainText: string): Buffer;
  decryptString(encrypted: Buffer): string;
}

const PROVIDERS: ApiProvider[] = ['openai', 'anthropic'];
const MAX_KEY_LENGTH = 512;

interface VaultMetaFile {
  providers: Partial<Record<ApiProvider, { createdAt: string; updatedAt: string }>>;
}

export function isApiProvider(value: unknown): value is ApiProvider {
  return value === 'openai' || value === 'anthropic';
}

/** Validate a candidate key without retaining or logging any part of it. */
export function validateKeyShape(key: unknown): { ok: boolean; error?: string } {
  if (typeof key !== 'string') return { ok: false, error: 'key must be a string' };
  if (key.length === 0 || key.trim().length === 0) return { ok: false, error: 'key is empty' };
  if (key.length > MAX_KEY_LENGTH) return { ok: false, error: `key exceeds ${MAX_KEY_LENGTH} characters` };
  if (/[\r\n\0]/.test(key)) return { ok: false, error: 'key contains invalid characters' };
  return { ok: true };
}

export class CredentialVault {
  private readonly vaultDir: string;
  private readonly metaPath: string;
  private readonly safeStorage: SafeStorageLike;
  private meta: VaultMetaFile = { providers: {} };

  constructor(userDataPath: string, safeStorage: SafeStorageLike) {
    this.vaultDir = path.join(userDataPath, 'vault');
    this.metaPath = path.join(this.vaultDir, 'vault.json');
    this.safeStorage = safeStorage;
    this.loadMeta();
  }

  private blobPath(provider: ApiProvider): string {
    return path.join(this.vaultDir, `${provider}.bin`);
  }

  private loadMeta(): void {
    try {
      const raw = JSON.parse(fs.readFileSync(this.metaPath, 'utf8')) as VaultMetaFile;
      if (raw && typeof raw === 'object' && raw.providers && typeof raw.providers === 'object') {
        this.meta = { providers: raw.providers };
      }
    } catch {
      // Missing/corrupt metadata: rebuild from blob presence on demand.
      this.meta = { providers: {} };
    }
  }

  private persistMeta(): void {
    fs.mkdirSync(this.vaultDir, { recursive: true });
    const tmp = `${this.metaPath}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(this.meta, null, 2), { encoding: 'utf8', mode: 0o600 });
    fs.renameSync(tmp, this.metaPath);
  }

  /** True only when the OS can actually encrypt right now. */
  encryptionAvailable(): boolean {
    try {
      return this.safeStorage.isEncryptionAvailable();
    } catch {
      return false;
    }
  }

  /**
   * Store a key. Fails closed when OS encryption is unavailable. Only an
   * encrypted blob is ever written; the plaintext argument is used in memory
   * for the encrypt call and then dropped (caller clears its own copy).
   */
  setKey(provider: ApiProvider, key: string): { ok: boolean; error?: string } {
    if (!isApiProvider(provider)) return { ok: false, error: 'unknown provider' };
    const shape = validateKeyShape(key);
    if (!shape.ok) return shape;
    if (!this.encryptionAvailable()) {
      return {
        ok: false,
        error:
          'OS secure storage is unavailable, so keys cannot be saved. ' +
          'Unlock/enable your system keychain (e.g. GNOME Keyring or KWallet) and retry.',
      };
    }
    let blob: Buffer;
    try {
      blob = this.safeStorage.encryptString(key);
    } catch {
      return { ok: false, error: 'OS encryption failed; key was not stored.' };
    }
    try {
      fs.mkdirSync(this.vaultDir, { recursive: true });
      const tmp = `${this.blobPath(provider)}.tmp`;
      fs.writeFileSync(tmp, blob, { mode: 0o600 });
      fs.renameSync(tmp, this.blobPath(provider));
      const now = new Date().toISOString();
      const prev = this.meta.providers[provider];
      this.meta.providers[provider] = { createdAt: prev?.createdAt ?? now, updatedAt: now };
      this.persistMeta();
      return { ok: true };
    } catch {
      return { ok: false, error: 'Failed to write the encrypted key blob.' };
    }
  }

  /**
   * Decrypt a key for main-process use ONLY (provider calls). This value must
   * never be sent over IPC, logged, or persisted. Returns null when no key is
   * stored, encryption is unavailable, or the blob fails to decrypt (tamper).
   */
  getKey(provider: ApiProvider): string | null {
    if (!isApiProvider(provider)) return null;
    if (!this.encryptionAvailable()) return null;
    let blob: Buffer;
    try {
      blob = fs.readFileSync(this.blobPath(provider));
    } catch {
      return null;
    }
    try {
      const key = this.safeStorage.decryptString(blob);
      return validateKeyShape(key).ok ? key : null;
    } catch {
      return null; // tampered blob or changed OS keychain: fail closed
    }
  }

  /** Explicitly remove a stored key. */
  revoke(provider: ApiProvider): { ok: boolean; error?: string } {
    if (!isApiProvider(provider)) return { ok: false, error: 'unknown provider' };
    try {
      fs.rmSync(this.blobPath(provider), { force: true });
      delete this.meta.providers[provider];
      this.persistMeta();
      return { ok: true };
    } catch {
      return { ok: false, error: 'Failed to remove the stored key.' };
    }
  }

  private providerStatus(provider: ApiProvider): ProviderCredentialStatus {
    const exists = fs.existsSync(this.blobPath(provider));
    if (!exists) return { configured: false, readable: false, updatedAt: null };
    // Probe decryptability without exposing anything.
    let readable = false;
    if (this.encryptionAvailable()) {
      try {
        const blob = fs.readFileSync(this.blobPath(provider));
        const probe = this.safeStorage.decryptString(blob);
        readable = validateKeyShape(probe).ok;
      } catch {
        readable = false;
      }
    }
    return { configured: true, readable, updatedAt: this.meta.providers[provider]?.updatedAt ?? null };
  }

  /** Metadata-only status; safe to expose to the renderer. */
  status(): VaultStatus {
    const providers = {} as Record<ApiProvider, ProviderCredentialStatus>;
    for (const p of PROVIDERS) providers[p] = this.providerStatus(p);
    return { encryptionAvailable: this.encryptionAvailable(), providers };
  }
}
