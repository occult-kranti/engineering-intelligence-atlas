import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { CredentialVault, validateKeyShape, type SafeStorageLike } from '../src/main/vault';

/**
 * Mock safeStorage with real AES-256-GCM so round-trip and tamper behavior
 * are exercised honestly (Electron's safeStorage is unavailable under vitest).
 */
function makeMockSafeStorage(): SafeStorageLike & { available: boolean; key: Buffer } {
  const key = crypto.randomBytes(32);
  return {
    available: true,
    key,
    isEncryptionAvailable() {
      return this.available;
    },
    encryptString(plain: string): Buffer {
      const iv = crypto.randomBytes(12);
      const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
      return Buffer.concat([iv, cipher.update(plain, 'utf8'), cipher.final(), cipher.getAuthTag()]);
    },
    decryptString(blob: Buffer): string {
      const iv = blob.subarray(0, 12);
      const tag = blob.subarray(blob.length - 16);
      const data = blob.subarray(12, blob.length - 16);
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAuthTag(tag);
      return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
    },
  };
}

describe('credential vault', () => {
  let dir: string;
  let storage: ReturnType<typeof makeMockSafeStorage>;
  let vault: CredentialVault;
  const KEY = 'sk-test-0123456789abcdef0123456789abcdef';

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vault-test-'));
    storage = makeMockSafeStorage();
    vault = new CredentialVault(dir, storage);
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('round-trips a key through encrypted blobs only', () => {
    expect(vault.setKey('openai', KEY)).toEqual({ ok: true });
    expect(vault.getKey('openai')).toBe(KEY);

    // The blob on disk is not plaintext.
    const blob = fs.readFileSync(path.join(dir, 'vault', 'openai.bin'));
    expect(blob.toString('utf8')).not.toContain(KEY);
    expect(blob.toString('utf8')).not.toContain('sk-test');

    // Metadata file contains no key material.
    const meta = fs.readFileSync(path.join(dir, 'vault', 'vault.json'), 'utf8');
    expect(meta).not.toContain(KEY);
    expect(meta).not.toContain('sk-test');
    expect(JSON.parse(meta).providers.openai.updatedAt).toBeTruthy();
  });

  it('fails closed on tampered blobs', () => {
    vault.setKey('openai', KEY);
    const blobPath = path.join(dir, 'vault', 'openai.bin');
    const blob = fs.readFileSync(blobPath);
    blob[20] = blob[20] ^ 0xff; // corrupt ciphertext
    fs.writeFileSync(blobPath, blob);

    expect(vault.getKey('openai')).toBeNull();
    const status = vault.status();
    expect(status.providers.openai.configured).toBe(true);
    expect(status.providers.openai.readable).toBe(false);
  });

  it('fails closed when OS encryption is unavailable', () => {
    storage.available = false;
    const res = vault.setKey('openai', KEY);
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/secure storage is unavailable/i);
    expect(vault.getKey('openai')).toBeNull();
    expect(fs.existsSync(path.join(dir, 'vault', 'openai.bin'))).toBe(false);
    expect(vault.status().encryptionAvailable).toBe(false);
  });

  it('revokes explicitly and refuses unknown providers', () => {
    vault.setKey('anthropic', KEY);
    expect(vault.getKey('anthropic')).toBe(KEY);
    expect(vault.revoke('anthropic')).toEqual({ ok: true });
    expect(vault.getKey('anthropic')).toBeNull();
    expect(vault.status().providers.anthropic.configured).toBe(false);
    expect(vault.revoke('not-a-provider' as never).ok).toBe(false);
  });

  it('never discloses key material via status (no key, no last4)', () => {
    vault.setKey('openai', KEY);
    vault.setKey('anthropic', 'sk-ant-secret-zzzz9999');
    const statusJson = JSON.stringify(vault.status());
    expect(statusJson).not.toContain(KEY);
    expect(statusJson).not.toContain('cdef'); // last4 of the OpenAI key
    expect(statusJson).not.toContain('9999'); // last4 of the Anthropic key
    expect(statusJson).not.toContain('sk-');
  });

  it('validates key shape', () => {
    expect(validateKeyShape('').ok).toBe(false);
    expect(validateKeyShape('   ').ok).toBe(false);
    expect(validateKeyShape('a'.repeat(600)).ok).toBe(false);
    expect(validateKeyShape('line1\nline2').ok).toBe(false);
    expect(validateKeyShape(42).ok).toBe(false);
    expect(validateKeyShape(KEY).ok).toBe(true);
  });
});
