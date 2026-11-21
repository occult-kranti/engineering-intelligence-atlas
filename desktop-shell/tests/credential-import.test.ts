import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { importCredentialFromFile, type CredentialImportVault } from '../src/main/credentialImport';
import type { CredentialProvider, VaultStatus } from '../src/shared/contract';

const directories: string[] = [];
afterEach(() => { for (const directory of directories.splice(0)) fs.rmSync(directory, { recursive: true, force: true }); });
function fixture(body: string): string {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-credential-test-')); directories.push(directory);
  const file = path.join(directory, 'synthetic.txt'); fs.writeFileSync(file, body, { mode: 0o600 }); return file;
}
function vault(available = true): CredentialImportVault & { writes: Array<{ provider: CredentialProvider; key: string }> } {
  const metadata: VaultStatus = { encryptionAvailable: available, providers: {
    openai: { configured: false, readable: false, updatedAt: null },
    anthropic: { configured: false, readable: false, updatedAt: null },
    github: { configured: false, readable: false, updatedAt: null },
  } };
  const writes: Array<{ provider: CredentialProvider; key: string }> = [];
  return { writes, encryptionAvailable: () => available, status: () => metadata,
    setKey: (provider, key) => { writes.push({ provider, key }); metadata.providers[provider] = { configured: true, readable: true, updatedAt: '2026-01-01T00:00:00Z' }; return { ok: true }; },
  };
}
describe('native credential file import', () => {
  it('stores a synthetic key only in the vault and returns metadata without any key or file path', () => {
    const file = fixture('synthetic-test-credential'); const store = vault(); const result = importCredentialFromFile(file, 'github', store);
    expect(store.writes).toEqual([{ provider: 'github', key: 'synthetic-test-credential' }]);
    expect(result.ok).toBe(true); expect(result.status?.providers.github.readable).toBe(true);
    expect(JSON.stringify(result)).not.toContain('synthetic-test-credential'); expect(JSON.stringify(result)).not.toContain(file);
  });
  it('selects only the requested provider environment assignment', () => {
    const store = vault(); const file = fixture('OPENAI_API_KEY=synthetic-openai\nexport ANTHROPIC_API_KEY="synthetic-anthropic"\n');
    expect(importCredentialFromFile(file, 'anthropic', store).ok).toBe(true);
    expect(store.writes).toEqual([{ provider: 'anthropic', key: 'synthetic-anthropic' }]);
  });
  it('accepts explicit matching JSON and rejects ambiguous or mismatched credentials', () => {
    const store = vault();
    expect(importCredentialFromFile(fixture('{"provider":"github","token":"synthetic-token"}'), 'github', store).ok).toBe(true);
    expect(importCredentialFromFile(fixture('{"provider":"openai","apiKey":"synthetic-other"}'), 'anthropic', store).ok).toBe(false);
    expect(importCredentialFromFile(fixture('{"github":"synthetic-one","token":"synthetic-two"}'), 'github', store).ok).toBe(false);
    expect(store.writes).toHaveLength(1);
  });
  it('refuses unavailable OS storage before reading a file', () => {
    const store = vault(false); const result = importCredentialFromFile('/this-file-does-not-exist', 'github', store);
    expect(result.error).toContain('OS-backed'); expect(store.writes).toHaveLength(0);
  });
  it('refuses symlinks, oversized files and malformed JSON without exposing content', () => {
    const store = vault(); const target = fixture('synthetic-link-secret'); const link = path.join(path.dirname(target), 'linked'); fs.symlinkSync(target, link);
    expect(importCredentialFromFile(link, 'github', store).ok).toBe(false);
    expect(importCredentialFromFile(fixture('x'.repeat(65537)), 'github', store).ok).toBe(false);
    const malformed = importCredentialFromFile(fixture('{"apiKey":"synthetic-parse-secret"'), 'github', store);
    expect(malformed.ok).toBe(false); expect(JSON.stringify(malformed)).not.toContain('synthetic-parse-secret'); expect(store.writes).toHaveLength(0);
  });
});
