import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { architectureLibraryInputs, copyArchitectureLibrary } from './architecture-library-assets.mjs';

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'architecture-assets-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const source = path.join(root, 'projects/architecture-library'); fs.mkdirSync(source, { recursive: true });
  const write = (name, value) => { fs.mkdirSync(path.dirname(path.join(source, name)), { recursive: true }); fs.writeFileSync(path.join(source, name), value); };
  const manifest = files => write('static-assets.json', JSON.stringify({ schemaVersion: 1, files }));
  write('index.html', 'original library'); manifest(['index.html']);
  return { root, source, write, manifest };
}
test('publication copies only reviewed files and preserves exact binary bytes', t => {
  const { root, source, write, manifest } = fixture(t);
  const binary = Buffer.from([0, 255, 39, 11]); write('samples/study.glb', binary); write('private-work.json', 'unpublished');
  manifest(['index.html', 'samples/study.glb']);
  const destination = path.join(root, 'site-source/public/architecture-library');
  copyArchitectureLibrary(root, destination);
  assert.deepEqual(fs.readFileSync(path.join(destination, 'samples/study.glb')), binary);
  assert(!fs.existsSync(path.join(destination, 'private-work.json')));
  assert.equal(architectureLibraryInputs(root).bytes, fs.statSync(path.join(source, 'index.html')).size + binary.length);
});
test('publication rejects traversal, executable payload names, duplicate manifests and oversize assets', t => {
  const { root, write, manifest } = fixture(t);
  for (const files of [['../private.json'], ['a.exe'], ['.env'], ['index.html', 'index.html']]) {
    manifest(files); assert.throws(() => architectureLibraryInputs(root));
  }
  write('large.glb', Buffer.alloc(4 * 1024 * 1024 + 1)); manifest(['large.glb']); assert.throws(() => architectureLibraryInputs(root), /bounded/);
});
test('publication preflights source and destination symlinks before any writes', t => {
  const { root, source, manifest } = fixture(t);
  const external = path.join(root, 'external'); fs.mkdirSync(external);
  fs.writeFileSync(path.join(external, 'private.json'), 'secret fixture');
  fs.symlinkSync(external, path.join(source, 'linked'), process.platform === 'win32' ? 'junction' : 'dir');
  manifest(['linked/private.json']); assert.throws(() => architectureLibraryInputs(root), /symlink/);
  manifest(['index.html']);
  const destination = path.join(root, 'public'); fs.mkdirSync(destination);
  fs.symlinkSync(path.join(external, 'private.json'), path.join(destination, 'index.html'));
  assert.throws(() => copyArchitectureLibrary(root, destination), /symlink/);
  assert.equal(fs.readFileSync(path.join(external, 'private.json'), 'utf8'), 'secret fixture');
});

test('removed or unexpected derived files stop publication instead of leaking into the next build', t => {
  const { root, write, manifest } = fixture(t);
  write('retired.json', '{}'); manifest(['index.html', 'retired.json']);
  const destination = path.join(root, 'site-source/public/architecture-library');
  copyArchitectureLibrary(root, destination);
  manifest(['index.html']);
  assert.throws(() => copyArchitectureLibrary(root, destination), /Unexpected architecture projection/);
  assert(fs.existsSync(path.join(destination, 'retired.json')), 'Preflight must not silently delete unreviewed files');
  fs.unlinkSync(path.join(destination, 'retired.json'));
  copyArchitectureLibrary(root, destination);
});
