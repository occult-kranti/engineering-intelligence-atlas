import fs from 'node:fs';
import type { CredentialProvider, VaultStatus } from '../shared/contract';
import { isCredentialProvider, validateKeyShape } from './vault';

const MAX_FILE_BYTES = 64 * 1024;
const ENV_KEYS: Record<CredentialProvider, string[]> = {
  anthropic: ['ANTHROPIC_API_KEY'], openai: ['OPENAI_API_KEY'], github: ['GITHUB_TOKEN', 'GH_TOKEN'],
};

export interface CredentialImportVault {
  encryptionAvailable(): boolean;
  setKey(provider: CredentialProvider, key: string): { ok: boolean; error?: string };
  status(): VaultStatus;
}
export interface CredentialImportResult { ok: boolean; error?: string; status?: VaultStatus; cancelled?: boolean }

/** The selected file is read only inside main. No key or filename is returned. */
export function importCredentialFromFile(filePath: string, provider: CredentialProvider, vault: CredentialImportVault): CredentialImportResult {
  if (!isCredentialProvider(provider)) return { ok: false, error: 'Unknown credential provider.' };
  if (!vault.encryptionAvailable()) return { ok: false, error: 'Unlock an OS-backed keychain before importing a credential.' };
  let fd: number | undefined;
  const buffer = Buffer.alloc(MAX_FILE_BYTES + 1);
  try {
    if (fs.lstatSync(filePath).isSymbolicLink()) return { ok: false, error: 'Choose a regular credential file, not a symbolic link.' };
    fd = fs.openSync(filePath, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW ?? 0));
    const info = fs.fstatSync(fd);
    if (!info.isFile() || info.size > MAX_FILE_BYTES || info.size === 0) return { ok: false, error: 'Credential file must be a nonempty regular file of at most 64 KiB.' };
    let size = 0;
    while (size < buffer.length) {
      const count = fs.readSync(fd, buffer, size, buffer.length - size, null);
      if (count === 0) break;
      size += count;
    }
    if (size > MAX_FILE_BYTES) return { ok: false, error: 'Credential file exceeds the 64 KiB limit.' };
    const key = parseCredential(buffer.subarray(0, size).toString('utf8'), provider);
    if (key === null) return { ok: false, error: 'Use a single key, a matching environment assignment, or JSON with one matching provider key.' };
    const stored = vault.setKey(provider, key);
    return stored.ok ? { ok: true, status: vault.status() } : { ok: false, error: stored.error ?? 'Credential could not be stored securely.' };
  } catch {
    // Do not surface parse or filesystem errors that could include file content.
    return { ok: false, error: 'Credential file could not be imported. Existing stored credentials were preserved.' };
  } finally {
    buffer.fill(0);
    if (fd !== undefined) fs.closeSync(fd);
  }
}

function parseCredential(raw: string, provider: CredentialProvider): string | null {
  const text = raw.replace(/^\uFEFF/, '').trim();
  let key: unknown;
  if (text.startsWith('{')) {
    const value = JSON.parse(text) as Record<string, unknown>;
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    if (value.provider !== undefined && value.provider !== provider) return null;
    const candidates = [value[provider], ...ENV_KEYS[provider].map(name => value[name]), value.apiKey, value.key, value.token].filter(v => typeof v === 'string') as string[];
    const unique = [...new Set(candidates.map(v => v.trim()).filter(Boolean))];
    if (unique.length !== 1) return null;
    key = unique[0];
  } else {
    const lines = text.split(/\r?\n/).filter(line => line.trim() && !line.trim().startsWith('#'));
    const assignments = lines.map(line => /^(?:export\s+)?([A-Z][A-Z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line.trim())).filter((v): v is RegExpExecArray => !!v);
    const matches = assignments.filter(value => ENV_KEYS[provider].includes(value[1] ?? ''));
    if (matches.length === 1) {
      key = matches[0]![2];
      if (typeof key === 'string' && ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'")))) key = key.slice(1, -1);
    } else if (lines.length === 1 && assignments.length === 0) key = lines[0]!.trim();
    else return null;
  }
  return typeof key === 'string' && validateKeyShape(key).ok ? key : null;
}
