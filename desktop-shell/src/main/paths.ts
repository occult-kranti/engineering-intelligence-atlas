import path from 'node:path';

/**
 * Resolve `relative` against `root` and guarantee the result stays inside
 * `root`. Throws on any escape attempt (`..`, absolute paths, NUL bytes).
 * Used for venv and model download destinations.
 */
export function resolveContainedPath(root: string, relative: string): string {
  if (relative.includes('\0')) {
    throw new Error('Path contains a NUL byte');
  }
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(resolvedRoot, relative);
  if (resolved !== resolvedRoot && !resolved.startsWith(resolvedRoot + path.sep)) {
    throw new Error(`Path "${relative}" escapes the allowed root "${resolvedRoot}"`);
  }
  return resolved;
}

/**
 * Validate a file path reported by the Hugging Face API before it is used
 * as a local destination. Rejects traversal, absolute paths, backslashes,
 * and NUL bytes.
 */
export function isSafeRepoFilePath(p: string): boolean {
  if (p.length === 0 || p.length > 512) return false;
  if (p.includes('\0')) return false;
  if (p.includes('\\')) return false;
  if (p.startsWith('/') || /^[A-Za-z]:/.test(p)) return false;
  const segments = p.split('/');
  for (const seg of segments) {
    if (seg === '' || seg === '.' || seg === '..') return false;
  }
  return true;
}

/** Validate a venv directory name: simple, portable, no separators. */
export function isValidVenvName(name: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(name) && !name.includes('..');
}
