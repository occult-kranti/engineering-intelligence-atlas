#!/usr/bin/env node
// Only reviewed runtime modules; no CDN, npm lifecycle, provider or auto-update.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dependencies = path.join(root, 'integrations/heritage-assets/node_modules');
const destination = path.join(root, 'projects/architecture-library/site-models/vendor');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const files = [
  ['three/build/three.module.js', 'three.module.mjs'],
  ['three/build/three.core.js', 'three.core.mjs'],
  ['three/examples/jsm/loaders/GLTFLoader.js', 'GLTFLoader.mjs'],
  ['three/examples/jsm/controls/OrbitControls.js', 'OrbitControls.mjs'],
  ['three/examples/jsm/utils/BufferGeometryUtils.js', 'BufferGeometryUtils.mjs'],
  ['three/LICENSE', 'THREE-LICENSE.md'],
  ['meshoptimizer/meshopt_decoder.mjs', 'meshopt_decoder.mjs'],
  ['meshoptimizer/LICENSE.md', 'MESHOPT-LICENSE.md'],
];
for (const [name, expected] of [['three', '0.187.0'], ['meshoptimizer', '1.2.0']]) {
  const pkg = JSON.parse(fs.readFileSync(path.join(dependencies, name, 'package.json'), 'utf8'));
  if (pkg.version !== expected) throw new Error(`Unreviewed ${name} version`);
}
fs.mkdirSync(destination, { recursive: true });
const receipt = [];
for (const [source, target] of files) {
  const original = fs.readFileSync(path.join(dependencies, source));
  const text = original.toString('utf8').replaceAll("from 'three'", "from './three.module.mjs'")
    .replaceAll("'./three.core.js'", "'./three.core.mjs'")
    .replaceAll("'../utils/BufferGeometryUtils.js'", "'./BufferGeometryUtils.mjs'");
  fs.writeFileSync(path.join(destination, target), text);
  receipt.push({ source, target, sourceSha256: hash(original), outputSha256: hash(text), bytes: Buffer.byteLength(text) });
}
fs.writeFileSync(path.join(destination, 'manifest.json'), JSON.stringify({
  schemaVersion: 1, packages: { three: '0.187.0', meshoptimizer: '1.2.0' },
  changes: 'Relative ESM import paths and .mjs extensions only; no runtime logic edits.', files: receipt,
}, null, 2) + '\n');
console.log(JSON.stringify({ status: 'vendored', files: receipt.length, bytes: receipt.reduce((sum, item) => sum + item.bytes, 0) }));
