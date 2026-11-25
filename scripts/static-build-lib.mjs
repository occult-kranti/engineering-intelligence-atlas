import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { companyStudioInputs } from './company-studio-assets.mjs';
import { architectureLibraryInputs } from './architecture-library-assets.mjs';

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

export function sourceDigest(root = repoRoot) {
  const sourceWebRoot = join(root, 'site-source');
  const studio = companyStudioInputs(root);
  const architecture = architectureLibraryInputs(root);
  const files = [
    ...filesUnder(join(sourceWebRoot, 'src')),
    ...filesUnder(join(sourceWebRoot, 'contracts')),
    ...filesUnder(join(sourceWebRoot, 'public')).filter(file => !file.includes('/desktop-preview/') && !file.includes('/architecture-library/')),
    ...filesUnder(join(root, 'desktop-shell/src/renderer')),
    ...filesUnder(join(root, 'company')),
    studio.manifestPath, ...studio.assets.map(asset => asset.from),
    architecture.manifestPath, ...architecture.assets.map(asset => asset.from),
    ...['build-static.mjs', 'build-desktop-preview.mjs', 'static-build-lib.mjs', 'sync-company.mjs',
      'company-studio-assets.mjs', 'architecture-library-assets.mjs', 'renderer-assets.mjs'].map(file => join(root, 'scripts', file)),
    ...['index.html', 'vite.config.ts', 'tailwind.config.js', 'postcss.config.js',
      'package.json', 'package-lock.json'].map((file) => join(sourceWebRoot, file)),
  ].sort();
  return digest(files.map((file) => `${relative(root, file).replaceAll('\\', '/')}\0${digest(readFileSync(file))}\n`).join(''));
}

export function outputDigests(directory) {
  return Object.fromEntries(filesUnder(directory)
    .filter((file) => relative(directory, file) !== 'build-info.json')
    .map((file) => [relative(directory, file).replaceAll('\\', '/'), digest(readFileSync(file))]));
}
