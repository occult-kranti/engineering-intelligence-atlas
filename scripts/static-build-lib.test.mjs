import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { sourceDigest } from './static-build-lib.mjs';
import { copyCompanyStudio } from './company-studio-assets.mjs';
import { copyArchitectureLibrary } from './architecture-library-assets.mjs';

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'daftar-static-inputs-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const write = (relative, value) => {
    const file = path.join(root, relative);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, value);
  };
  for (const relative of ['site-source/src', 'site-source/contracts', 'site-source/public',
    'desktop-shell/src/renderer', 'company']) fs.mkdirSync(path.join(root, relative), { recursive: true });
  for (const filename of ['index.html', 'vite.config.ts', 'tailwind.config.js', 'postcss.config.js', 'package.json', 'package-lock.json']) {
    write(`site-source/${filename}`, '{}');
  }
  for (const filename of ['build-static.mjs', 'build-desktop-preview.mjs', 'static-build-lib.mjs',
    'sync-company.mjs', 'company-studio-assets.mjs', 'architecture-library-assets.mjs', 'renderer-assets.mjs']) write(`scripts/${filename}`, '// fixture');
  write('projects/architecture-library/static-assets.json', JSON.stringify({ schemaVersion: 1, files: ['index.html'] }));
  write('projects/architecture-library/index.html', '<!doctype html><title>Architecture fixture</title>');
  write('projects/threejs-game-studio/static-assets.json', JSON.stringify({ schema_version: 1, files: ['index.html', 'README.md'] }));
  write('projects/threejs-game-studio/index.html', '<!doctype html><title>Fixture</title>');
  write('projects/threejs-game-studio/README.md', 'Original public studio instructions.\n');
  return { root, write };
}

test('a late studio README edit invalidates the public build and its copy can be regenerated', t => {
  const { root, write } = fixture(t);
  const output = path.join(root, 'site-source/public/desktop-preview/studios/threejs');
  copyCompanyStudio(root, output);
  const original = sourceDigest(root);
  const updated = 'Original instructions plus retained upstream asset limitations.\n';
  write('projects/threejs-game-studio/README.md', updated);
  const changed = sourceDigest(root);
  assert.notEqual(changed, original, 'A source README edit must invalidate the previous static build identity');
  assert.notEqual(fs.readFileSync(path.join(output, 'README.md'), 'utf8'), updated);
  copyCompanyStudio(root, output);
  assert.equal(fs.readFileSync(path.join(output, 'README.md'), 'utf8'), updated);
  const regenerated = sourceDigest(root);
  assert.equal(regenerated, changed, 'Refreshing a derived preview must not change the source digest');
  copyCompanyStudio(root, output);
  assert.equal(sourceDigest(root), regenerated, 'Generated preview copies do not feed back into source identity');
});

test('the studio allowlist and asset-building code are covered without reading unprojected runtime files', t => {
  const { root, write } = fixture(t);
  const original = sourceDigest(root);
  write('projects/threejs-game-studio/runs/private-output.json', 'Synthetic non-public output');
  write('projects/threejs-game-studio/upstream/model/README.md', 'Unprojected upstream metadata');
  assert.equal(sourceDigest(root), original);
  write('scripts/company-studio-assets.mjs', '// changed copy implementation');
  const copyChange = sourceDigest(root);
  assert.notEqual(copyChange, original);
  write('scripts/renderer-assets.mjs', '// changed asset graph implementation');
  assert.notEqual(sourceDigest(root), copyChange);
  const beforeManifest = sourceDigest(root);
  write('projects/threejs-game-studio/static-assets.json', JSON.stringify({ schema_version: 1, files: ['index.html'] }));
  assert.notEqual(sourceDigest(root), beforeManifest);
  const withoutReadme = sourceDigest(root);
  write('projects/threejs-game-studio/README.md', 'No longer projected');
  assert.equal(sourceDigest(root), withoutReadme);
});

test('an architecture source change invalidates identity while its derived copy does not feed back', t => {
  const { root, write } = fixture(t);
  const destination = path.join(root, 'site-source/public/architecture-library');
  copyArchitectureLibrary(root, destination);
  const original = sourceDigest(root);
  write('projects/architecture-library/index.html', '<!doctype html><title>New observed phase</title>');
  const changed = sourceDigest(root);
  assert.notEqual(changed, original);
  copyArchitectureLibrary(root, destination);
  assert.equal(sourceDigest(root), changed);
  write('projects/architecture-library/private-notes.json', 'Unprojected synthetic fixture');
  assert.equal(sourceDigest(root), changed);
});
