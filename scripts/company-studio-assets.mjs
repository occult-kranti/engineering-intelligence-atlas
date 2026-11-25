import fs from 'node:fs';
import path from 'node:path';

/** Copy the reviewed static workbench from the same allowlist used by its checker. */
export function copyCompanyStudio(repoRoot, destination) {
  const source = path.join(repoRoot, 'projects/threejs-game-studio');
  const manifest = JSON.parse(fs.readFileSync(path.join(source, 'static-assets.json'), 'utf8'));
  if (manifest.schema_version !== 1 || !Array.isArray(manifest.files) || manifest.files.length > 30) throw new Error('Invalid studio asset manifest.');
  for (const relative of manifest.files) {
    if (typeof relative !== 'string' || !/^[A-Za-z0-9_./-]+$/.test(relative) || relative.startsWith('/') || relative.split('/').includes('..')) throw new Error('Invalid studio asset path.');
    const from = path.join(source, relative), to = path.join(destination, relative);
    if (!fs.lstatSync(from).isFile()) throw new Error('Studio assets must be regular files.');
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.copyFileSync(from, to);
  }
}
