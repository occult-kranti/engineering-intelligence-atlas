import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = process.argv[2];
if (!root || !path.isAbsolute(root)) throw Error('Pass the absolute Atlas repository directory.');
const { buildAssetGraph, hashName, htmlRoots, rewriteHtml, writeAssets } = await import(pathToFileURL(path.join(root, 'scripts/renderer-assets.mjs')).href);
const renderer = path.join(root, 'desktop-shell/dist/renderer');
const source = path.join(root, 'desktop-shell/src/renderer');
const target = path.resolve('public/workspace');
const bridgePath = path.resolve('scripts/cloud-bridge.js');
fs.mkdirSync(target, { recursive: true });
// The website and native renderer share one measured semantic palette.
const tokens = path.join(renderer, 'studio-tokens.css');
fs.copyFileSync(fs.existsSync(tokens) ? tokens : path.join(source, 'studio-tokens.css'), path.resolve('app/studio-tokens.css'));
const legacyBridge = path.join(target, 'cloud-bridge.js');
if (!fs.existsSync(bridgePath)) {
  if (!fs.existsSync(legacyBridge)) throw Error('Cloud transport source is missing.');
  fs.copyFileSync(legacyBridge, bridgePath);
}
let html = fs.readFileSync(path.join(renderer, 'chrome.html'), 'utf8');
const roots = htmlRoots(html);
const { files, names } = buildAssetGraph(renderer, roots);
html = rewriteHtml(html, names, roots);
const bridgeBytes = fs.readFileSync(bridgePath);
const bridge = hashName('cloud-bridge.js', bridgeBytes);
if (!html.includes('</head>')) throw Error('Shared renderer HTML has no head close.');
html = html.replace('</head>', `<script src="./${bridge}"></script></head>`);
files.set(bridge, bridgeBytes);
files.set('chrome.html', Buffer.from(html));
const generated = /^(?:chrome\.html|(?:chrome|browser-bridge|cloud-bridge|office-signals)(?:\.[a-f0-9]{16})?\.js|(?:chrome|studio-tokens|freeflow)(?:\.[a-f0-9]{16})?\.css)$/;
writeAssets(target, files, { prune: (rel) => generated.test(rel) });
console.log('Copied the shared renderer graph, derived signals and private transport with content-addressed assets.');
