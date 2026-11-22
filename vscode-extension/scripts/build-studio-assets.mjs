#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { buildAssetGraph, htmlRoots, rewriteHtml, digest } from '../../scripts/renderer-assets.mjs';

const extensionRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export function buildStudioAssets({ sourceDir = path.join(extensionRoot, '../desktop-shell/dist/renderer'), destDir = path.join(extensionRoot, 'media/studio') } = {}) {
  const source = path.resolve(sourceDir); const destination = path.resolve(destDir);
  if (path.basename(destination) !== 'studio') throw new Error('Generated studio output must use a dedicated studio directory.');
  let html = fs.readFileSync(path.join(source, 'chrome.html'), 'utf8');
  // The extension supplies its bridge before chrome. Never package the preview
  // HTTP bridge, which can load example data in ordinary browsers.
  html = html.replace(/<script\b[^>]*src=["']\.\/browser-bridge\.js["'][^>]*>\s*<\/script>/gi, '');
  const roots = htmlRoots(html);
  if (!roots.includes('chrome.js') || !roots.includes('freeflow.css')) throw new Error('The compiled shared office renderer is incomplete. Build desktop-shell first.');
  if (/<(?:iframe|base)\b/i.test(html) || /\son[a-z]+\s*=/i.test(html)) throw new Error('Unexpected active HTML in the shared renderer.');
  for (const tag of html.matchAll(/<(?:script|link)\b[^>]*(?:src|href)=["']([^"']+)["'][^>]*>/gi)) {
    if (!tag[1].startsWith('./') || /[?#]/.test(tag[1])) throw new Error('Studio assets must be local static files.');
  }
  const graph = buildAssetGraph(source, roots);
  if (graph.files.size > 512) throw new Error('Studio asset graph exceeds its file limit.');
  let total = 0; const files = {};
  for (const [name, bytes] of graph.files) {
    total += bytes.length;
    if (bytes.length > 8 * 1024 * 1024 || total > 40 * 1024 * 1024) throw new Error('Studio asset graph exceeds its byte limit.');
    files[name] = { sha256: digest(bytes), bytes: bytes.length };
  }
  html = rewriteHtml(html, graph.names, roots);
  const manifest = { version: 1, renderer: 'desktop-shared-freeflow', html: 'studio.html', htmlSha256: digest(Buffer.from(html)), roots: roots.map(root => graph.names.get(root)), files };
  const staging = `${destination}.build-${process.pid}`;
  if (fs.existsSync(staging)) throw new Error('A stale studio build directory exists; inspect it first.');
  fs.mkdirSync(staging, { recursive: true });
  try {
    for (const [name, bytes] of graph.files) {
      const filename = path.join(staging, name); fs.mkdirSync(path.dirname(filename), { recursive: true }); fs.writeFileSync(filename, bytes);
    }
    fs.writeFileSync(path.join(staging, 'studio.html'), html);
    fs.writeFileSync(path.join(staging, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
    if (fs.existsSync(destination) && fs.lstatSync(destination).isSymbolicLink()) throw new Error('Studio output cannot be a symlink.');
    fs.rmSync(destination, { recursive: true, force: true }); fs.renameSync(staging, destination);
  } finally { fs.rmSync(staging, { recursive: true, force: true }); }
  return { destination, fileCount: graph.files.size, totalBytes: total, manifest };
}
if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  try { const result = buildStudioAssets(); console.log(JSON.stringify({ ok: true, destination: result.destination, fileCount: result.fileCount, totalBytes: result.totalBytes })); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
