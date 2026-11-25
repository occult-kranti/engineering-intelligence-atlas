import fs from 'node:fs';
import path from 'node:path';

/** Resolve the reviewed inputs used by both copying and static source identity. */
export function companyStudioInputs(repoRoot) {
  const source = path.join(repoRoot, 'projects/threejs-game-studio');
  const manifestPath = path.join(source, 'static-assets.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (manifest.schema_version !== 1 || !Array.isArray(manifest.files) || manifest.files.length > 30) throw new Error('Invalid studio asset manifest.');
  const assets = manifest.files.map(relative => {
    if (typeof relative !== 'string' || !/^[A-Za-z0-9_./-]+$/.test(relative) || relative.startsWith('/') || relative.split('/').includes('..')) throw new Error('Invalid studio asset path.');
    const from = path.join(source, relative);
    if (!fs.lstatSync(from).isFile()) throw new Error('Studio assets must be regular files.');
    return { relative, from };
  });
  return { manifestPath, assets };
}

/** Copy the reviewed static workbench from the same allowlist used by its checker. */
export function copyCompanyStudio(repoRoot, destination) {
  for (const { relative, from } of companyStudioInputs(repoRoot).assets) {
    const to = path.join(destination, relative);
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.copyFileSync(from, to);
  }
}
