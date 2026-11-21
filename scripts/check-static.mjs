#!/usr/bin/env node
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import { digest, filesUnder, outputDigests, repoRoot, sourceDigest } from './static-build-lib.mjs';

const directory = join(repoRoot, 'docs');
const read = (file) => readFileSync(join(directory, file), 'utf8');
const manifest = JSON.parse(read('build-info.json'));
assert.equal(manifest.schemaVersion, 1, 'Unknown build manifest format');
assert.equal(manifest.buildMode, 'static');
assert.equal(manifest.sourceSha256, sourceDigest(), 'docs/ is stale; run node scripts/build-static.mjs');
assert.deepEqual(manifest.files, outputDigests(directory), 'Static files differ from build-info.json');

function verifyReference(fromFile, reference) {
  if (/^(?:data:|https?:|#)/i.test(reference)) return;
  assert(!reference.startsWith('/'), `Root-absolute asset breaks Pages/offline: ${fromFile}: ${reference}`);
  const clean = decodeURIComponent(reference.split(/[?#]/)[0]);
  if (!clean) return;
  const target = resolve(dirname(fromFile), clean);
  assert(target.startsWith(directory + sep), `Asset escapes static directory: ${reference}`);
  assert(existsSync(target), `Missing asset: ${reference} (from ${fromFile})`);
}

const index = read('index.html');
assert.match(index, /<div id="root">/);
const entries = [...index.matchAll(/(?:src|href)=["']([^"']+)["']/g)];
assert(entries.some((match) => /\.js(?:$|\?)/.test(match[1])), 'No JavaScript entry found');
for (const [, reference] of entries) verifyReference(join(directory, 'index.html'), reference);

// A fresh document must never reuse an older unversioned preview asset. The
// bridge's seed belongs to the same immutable release and must work offline.
const previewHtml = read('desktop-preview/chrome.html');
for (const [, reference] of previewHtml.matchAll(/(?:src|href)=["']([^"']+)["']/g)) {
  verifyReference(join(directory, 'desktop-preview/chrome.html'), reference);
}
const previewAssets = [];
function previewAssetReference(source, name) {
  const [stem, extension] = [name.slice(0, name.lastIndexOf('.')), name.slice(name.lastIndexOf('.') + 1)];
  const pattern = new RegExp(`(["'])\\./(${stem}\\.([a-f0-9]{16})\\.${extension})\\1`, 'g');
  const matches = [...source.matchAll(pattern)];
  assert.equal(matches.length, 1, `Expected one content-addressed preview reference for ${name}`);
  const [, , filename, hash] = matches[0];
  assert.equal(digest(readFileSync(join(directory, 'desktop-preview', filename))).slice(0, 16), hash, `Preview content hash mismatch: ${filename}`);
  assert(!existsSync(join(directory, 'desktop-preview', name)), `Unversioned preview asset remains: ${name}`);
  previewAssets.push(filename);
  return filename;
}
for (const name of ['studio-tokens.css', 'chrome.css', 'office-signals.js', 'chrome.js']) previewAssetReference(previewHtml, name);
const bridgeFile = previewAssetReference(previewHtml, 'browser-bridge.js');
previewAssetReference(read('desktop-preview/' + bridgeFile), 'preview-state.json');
const worker = read('sw.js');
for (const filename of previewAssets) {
  assert(worker.includes(`url:"desktop-preview/${filename}"`) || worker.includes(`"url":"desktop-preview/${filename}"`), `Preview asset missing from offline precache: ${filename}`);
}

const pwa = JSON.parse(read('manifest.webmanifest'));
assert.equal(pwa.start_url, './', 'PWA must launch relative to its installation path');
for (const icon of pwa.icons ?? []) verifyReference(join(directory, 'manifest.webmanifest'), icon.src);
for (const file of filesUnder(directory)) {
  assert(!/(?:^|[\\/])(?:\.env(?:\.|$)|boot\.js$)/.test(file), 'Server/runtime files must not be published');
  if (file.endsWith('.css')) {
    for (const [, , reference] of readFileSync(file, 'utf8').matchAll(/url\(\s*(["']?)([^\s)'"]+)\1\s*\)/g)) {
      verifyReference(file, reference);
    }
  }
}
const register = read('registerSW.js');
assert(!/register\(["']\//.test(register), 'Service worker registration must be relative');
assert(existsSync(join(directory, '.nojekyll')));
console.log(`Static integrity passed: ${Object.keys(manifest.files).length} files; portable entry, CSS, PWA and service worker paths.`);
