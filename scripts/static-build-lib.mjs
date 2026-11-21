import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const webRoot = join(repoRoot, 'site-source');
export const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');

export function filesUnder(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = join(directory, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`Unexpected symlink in build input: ${full}`);
    return entry.isDirectory() ? filesUnder(full) : [full];
  }).sort();
}

export function sourceDigest() {
  const files = [
    ...filesUnder(join(webRoot, 'src')),
    ...filesUnder(join(webRoot, 'contracts')),
    ...filesUnder(join(webRoot, 'public')).filter(file => !file.includes('/desktop-preview/')),
    ...filesUnder(join(repoRoot, 'desktop-shell/src/renderer')),
    ...filesUnder(join(repoRoot, 'company')),
    ...['build-static.mjs', 'build-desktop-preview.mjs', 'static-build-lib.mjs', 'sync-company.mjs'].map(file => join(repoRoot, 'scripts', file)),
    ...['index.html', 'vite.config.ts', 'tailwind.config.js', 'postcss.config.js',
      'package.json', 'package-lock.json'].map((file) => join(webRoot, file)),
  ].sort();
  return digest(files.map((file) => `${relative(repoRoot, file).replaceAll('\\', '/')}\0${digest(readFileSync(file))}\n`).join(''));
}

export function outputDigests(directory) {
  return Object.fromEntries(filesUnder(directory)
    .filter((file) => relative(directory, file) !== 'build-info.json')
    .map((file) => [relative(directory, file).replaceAll('\\', '/'), digest(readFileSync(file))]));
}
