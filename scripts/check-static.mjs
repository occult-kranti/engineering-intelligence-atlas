#!/usr/bin/env node
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import { digest, filesUnder, outputDigests, repoRoot, sourceDigest } from './static-build-lib.mjs';
import { scanImports } from './renderer-assets.mjs';

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

// Nested renderer ESM graph: every local import must exist, carry a matching content digest,
// be in the offline precache, and no unversioned leftover may remain. Works with or without
// Freeflow imports present in chrome.js. Uses the builder's bounded scanner (fails closed).
const previewDir = join(directory, 'desktop-preview');
const workerText = read('sw.js');
const graphSeen = new Set();
function verifyGraph(rel, from) {
  const abs = resolve(previewDir, rel);
  assert(abs.startsWith(previewDir + sep), `Renderer import escapes preview tree: ${rel}`);
  assert(existsSync(abs), `Missing renderer module: ${rel}${from ? ` imported by ${from}` : ''}`);
  if (graphSeen.has(rel)) return;
  graphSeen.add(rel);
  const name = rel.split('/').pop();
  const match = /\.([a-f0-9]{16})\.[^./]+$/.exec(name);
  assert(match, `Renderer asset is not content-addressed: ${rel}`);
  assert.equal(digest(readFileSync(abs)).slice(0, 16), match[1], `Stale or wrong hash for renderer asset: ${rel}`);
  assert(workerText.includes(`desktop-preview/${rel}"`), `Renderer asset missing from offline precache: ${rel}`);
  if (/\.m?js$/.test(rel)) {
    for (const found of scanImports(readFileSync(abs, 'utf8'), rel)) {
      assert(found.spec.startsWith('./') || found.spec.startsWith('../'), `Non-relative renderer import "${found.spec}" in ${rel}`);
      const target = join(dirname(rel), found.spec).split(sep).join('/');
      verifyGraph(target, rel);
    }
  }
}
for (const [, reference] of previewHtml.matchAll(/(?:src|href)=["']\.\/([^"'?#]+)["']/g)) {
  if (/\.(?:js|css)$/.test(reference)) verifyGraph(reference, 'chrome.html');
}
const unversioned = filesUnder(join(previewDir, 'freeflow')).filter((f) => !/\.[a-f0-9]{16}\.[^./]+$/.test(f));
assert.equal(unversioned.length, 0, `Unversioned renderer leftovers: ${unversioned.join(', ')}`);
assert(!existsSync(join(previewDir, 'freeflow.css')), 'Unversioned freeflow.css remains');
const graphCss = [...graphSeen].filter((p) => /^freeflow\.[a-f0-9]{16}\.css$/.test(p));
if (/freeflow\.[a-f0-9]{16}\.css/.test(readFileSync(join(previewDir, [...graphSeen].find((p) => /^chrome\./.test(p)) ?? ''), 'utf8')) || graphCss.length) {
  assert.equal(graphCss.length, 1, 'freeflow.css must be referenced once and content-addressed');
}
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
