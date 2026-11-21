/**
 * Workspace path containment for "Apply Artifact to Workspace".
 * Pure module — no 'vscode' / 'node:*' imports.
 */

export type PathVerdict =
  | { ok: true; normalized: string }
  | { ok: false; reason: string };

/**
 * Validate a user-entered *workspace-relative* target path.
 * Rejects: empty, absolute (POSIX/Windows/UNC), backslashes, NUL, "."/".."
 * segments, traversal, anything over a sane depth/length.
 * Never trust server-provided absolute paths — this function only accepts
 * relative input typed by (or confirmed by) the user.
 */
export function validateWorkspaceRelativePath(input: string): PathVerdict {
  if (typeof input !== 'string') return { ok: false, reason: 'empty path' };
  const p = input.trim();
  if (p.length === 0) return { ok: false, reason: 'empty path' };
  if (p.includes('\0')) return { ok: false, reason: 'NUL byte in path' };
  if (p.includes('\\')) return { ok: false, reason: 'backslashes are not allowed' };
  if (p.startsWith('/')) return { ok: false, reason: 'absolute paths are not allowed' };
  if (/^[A-Za-z]:/.test(p)) return { ok: false, reason: 'absolute paths are not allowed' };
  if (p.length > 240) return { ok: false, reason: 'path too long' };
  const segments = p.split('/');
  if (segments.length > 16) return { ok: false, reason: 'path too deep' };
  for (const s of segments) {
    if (s.length === 0) return { ok: false, reason: 'empty path segment' };
    if (s === '.' || s === '..') return { ok: false, reason: 'traversal segments are not allowed' };
  }
  return { ok: true, normalized: segments.join('/') };
}

/**
 * Join + containment check against a workspace root (string-level, POSIX).
 * The joined path must stay strictly inside root.
 */
export function joinInsideWorkspace(root: string, relative: string): string | null {
  const verdict = validateWorkspaceRelativePath(relative);
  if (!verdict.ok) return null;
  const normRoot = root.replace(/\\/g, '/').replace(/\/+$/, '');
  if (normRoot.length === 0) return null;
  const joined = `${normRoot}/${verdict.normalized}`;
  if (!joined.startsWith(normRoot + '/')) return null;
  if (joined.split('/').some((s) => s === '..')) return null;
  return joined;
}

/**
 * True when `candidate` (already-joined POSIX path) is strictly inside
 * `root`. Used as a last-line check before any write.
 */
export function isContained(root: string, candidate: string): boolean {
  const r = root.replace(/\\/g, '/').replace(/\/+$/, '');
  const c = candidate.replace(/\\/g, '/');
  return c.startsWith(r + '/') && !c.split('/').some((s) => s === '..');
}
