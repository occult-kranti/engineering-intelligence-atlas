#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { outputDigests, repoRoot, sourceDigest, webRoot } from './static-build-lib.mjs';
import { copyArchitectureLibrary } from './architecture-library-assets.mjs';

const vite = join(webRoot, 'node_modules/vite/bin/vite.js');
if (!existsSync(vite)) throw new Error('Install web dependencies first: npm --prefix site-source ci');
const models = spawnSync(process.execPath, [join(repoRoot, 'scripts/materialize-heritage-models.mjs')], {
  cwd: repoRoot, stdio: 'inherit', env: process.env,
});
if (models.error) throw models.error;
if (models.status !== 0) process.exit(models.status ?? 1);
for (const script of ['sync-company.mjs', 'build-desktop-preview.mjs']) {
  const prepare = spawnSync(process.execPath, [join(repoRoot, 'scripts', script)], { cwd: repoRoot, stdio: 'inherit', env: process.env });
  if (prepare.status !== 0) process.exit(prepare.status ?? 1);
}
copyArchitectureLibrary(repoRoot, join(webRoot, 'public/architecture-library'));
const build = spawnSync(process.execPath, [vite, 'build', '--mode', 'static'], {
  cwd: webRoot, stdio: 'inherit', env: process.env,
});
if (build.error) throw build.error;
if (build.status !== 0) process.exit(build.status ?? 1);

// Only the public client directory can be published. dist/boot.js and runtime
// configuration never enter docs/ or the Pages artifact.
const source = join(webRoot, 'dist/public');
if (!existsSync(join(source, 'index.html'))) throw new Error('Static build did not produce index.html');
const destination = join(repoRoot, 'docs');
rmSync(destination, { recursive: true, force: true });
mkdirSync(destination, { recursive: true });
cpSync(source, destination, { recursive: true });
writeFileSync(join(destination, '.nojekyll'), '');
const manifest = {
  schemaVersion: 1,
  buildMode: 'static',
  sourceSha256: sourceDigest(),
  files: outputDigests(destination),
};
writeFileSync(join(destination, 'build-info.json'), JSON.stringify(manifest, null, 2) + '\n');
const check = spawnSync(process.execPath, [join(repoRoot, 'scripts/check-static.mjs')], {
  cwd: repoRoot, stdio: 'inherit',
});
if (check.status !== 0) process.exit(check.status ?? 1);
console.log(`Published ${Object.keys(manifest.files).length} verified client files to docs/.`);
