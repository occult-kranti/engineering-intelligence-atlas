import * as fs from 'node:fs';
import * as path from 'node:path';
import { createHash } from 'node:crypto';

/*
 * Compact role-reference loader.
 *
 * Security notes:
 * - Role metadata is DESCRIPTIVE ONLY. The `capabilities` field is informational text for
 *   prompts and can never grant, expand, or imply any permission or tool access. Workers have
 *   no network tools except individually granted managed GitHub publication.
 * - seedDir is a trusted packaged directory, but its files may be missing or damaged.
 * - Only index.json is read. Documents and examples are returned as relative path strings
 *   (links only) and are never opened here. References are returned as URLs, never fetched.
 * - No module-level cache: every call re-reads the index so updated seed content is reflected.
 * - This function never throws to the caller; any failure yields null.
 */

export interface RoleReference {
  key: string;
  title: string;
  brief: string;
  sha256: string;
  references: Array<{ title: string; url: string }>;
  document: string;
  examples: string[];
  handoff: string;
  capabilities: string[];
}

const MAX_INDEX_BYTES = 200 * 1024;
const MAX_ROLES = 100;
const MAX_EXAMPLES = 12;
const MAX_REFERENCES = 12;
const MAX_CAPABILITIES = 16;
const MAX_CAPABILITY_LEN = 100;
const MAX_TITLE = 160;
const MAX_BRIEF = 8000;
const MAX_HANDOFF = 2000;
const MAX_PATH_LEN = 300;
const MAX_URL_LEN = 2048;
const KEY_RE = /^[a-z0-9-]{1,80}$/;

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function hasControlChars(s: string, allowWhitespace: boolean): boolean {
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c === 0x7f) return true;
    if (c < 0x20) {
      if (allowWhitespace && (c === 0x09 || c === 0x0a || c === 0x0d)) continue;
      return true;
    }
  }
  return false;
}

function validText(v: unknown, max: number, allowWhitespace: boolean): v is string {
  return (
    typeof v === 'string' &&
    v.length > 0 &&
    v.length <= max &&
    v.trim().length > 0 &&
    !hasControlChars(v, allowWhitespace)
  );
}

function validRelPath(v: unknown): v is string {
  if (typeof v !== 'string' || v.length === 0 || v.length > MAX_PATH_LEN) return false;
  if (hasControlChars(v, false)) return false;
  if (v.includes('\\')) return false;
  if (v.startsWith('/') || /^[a-zA-Z]:/.test(v)) return false;
  if (path.isAbsolute(v) || path.win32.isAbsolute(v)) return false;
  const segs = v.split('/');
  for (const s of segs) {
    if (s === '' || s === '.' || s === '..') return false;
  }
  return true;
}

function validUrl(v: unknown): v is string {
  if (typeof v !== 'string' || v.length === 0 || v.length > MAX_URL_LEN) return false;
  if (hasControlChars(v, false) || /\s/.test(v)) return false;
  try {
    const u = new URL(v);
    if (u.protocol !== 'https:') return false;
    if (u.username !== '' || u.password !== '') return false;
    if (u.hostname === '') return false;
    return true;
  } catch {
    return false;
  }
}

function normalizeRole(raw: unknown): Omit<RoleReference, 'sha256'> | null {
  if (!isPlainObject(raw)) return null;
  const { key, title, brief, document, examples, references, handoff, capabilities } = raw;
  if (typeof key !== 'string' || !KEY_RE.test(key)) return null;
  if (!validText(title, MAX_TITLE, false)) return null;
  if (!validText(brief, MAX_BRIEF, true)) return null;
  if (!validText(handoff, MAX_HANDOFF, true)) return null;
  if (!validRelPath(document)) return null;

  if (!Array.isArray(examples) || examples.length > MAX_EXAMPLES) return null;
  const ex: string[] = [];
  for (const e of examples) {
    if (!validRelPath(e)) return null;
    ex.push(e);
  }

  if (!Array.isArray(references) || references.length > MAX_REFERENCES) return null;
  const refs: Array<{ title: string; url: string }> = [];
  for (const r of references) {
    if (!isPlainObject(r)) return null;
    if (!validText(r.title, MAX_TITLE, false)) return null;
    if (!validUrl(r.url)) return null;
    refs.push({ title: r.title as string, url: r.url as string });
  }

  if (!Array.isArray(capabilities) || capabilities.length > MAX_CAPABILITIES) return null;
  const caps: string[] = [];
  for (const c of capabilities) {
    if (!validText(c, MAX_CAPABILITY_LEN, false)) return null;
    caps.push(c);
  }

  return {
    key,
    title,
    brief,
    references: refs,
    document,
    examples: ex,
    handoff,
    capabilities: caps,
  };
}

function hashRole(r: Omit<RoleReference, 'sha256'>): string {
  // Fixed field order and array order => deterministic, independent of index key order
  // and of unrelated roles.
  const canonical = JSON.stringify([
    r.key,
    r.title,
    r.brief,
    r.document,
    r.examples,
    r.references.map((x) => [x.title, x.url]),
    r.handoff,
    r.capabilities,
  ]);
  return createHash('sha256').update(canonical, 'utf8').digest('hex');
}

function isInside(parent: string, child: string): boolean {
  const rel = path.relative(parent, child);
  return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel);
}

function readIndexSafely(seedDir: string): unknown | null {
  const realSeed = fs.realpathSync(seedDir);
  const indexPath = path.join(seedDir, 'role-library', 'index.json');
  const lst = fs.lstatSync(indexPath);
  if (lst.isSymbolicLink() || !lst.isFile()) return null;
  if (lst.size > MAX_INDEX_BYTES) return null;
  const realIndex = fs.realpathSync(indexPath);
  if (!isInside(realSeed, realIndex)) return null;
  const buf = fs.readFileSync(realIndex);
  if (buf.length > MAX_INDEX_BYTES) return null;
  return JSON.parse(buf.toString('utf8'));
}

export function loadRoleReference(
  seedDir: string,
  roleKey: string | null | undefined,
): RoleReference | null {
  try {
    if (typeof seedDir !== 'string' || seedDir.length === 0 || seedDir.includes('\0')) return null;
    if (typeof roleKey !== 'string' || !KEY_RE.test(roleKey)) return null;

    const index = readIndexSafely(seedDir);
    if (!isPlainObject(index)) return null;
    if (index.schemaVersion !== 1) return null;
    if (!Array.isArray(index.roles) || index.roles.length > MAX_ROLES) return null;

    let match: unknown = undefined;
    let matches = 0;
    for (const r of index.roles) {
      if (isPlainObject(r) && r.key === roleKey) {
        matches++;
        match = r;
      }
    }
    if (matches !== 1) return null; // absent or duplicate

    const normalized = normalizeRole(match);
    if (!normalized) return null;
    return { ...normalized, sha256: hashRole(normalized) };
  } catch {
    return null;
  }
}
