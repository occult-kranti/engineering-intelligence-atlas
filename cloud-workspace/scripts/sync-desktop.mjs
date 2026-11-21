import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

const root = process.argv[2];
if (!root || !path.isAbsolute(root)) throw Error('Pass the absolute Atlas repository directory.');
const renderer = path.join(root, 'desktop-shell/dist/renderer');
const target = path.resolve('public/workspace');
const bridgePath = path.resolve('scripts/cloud-bridge.js');
fs.mkdirSync(target, { recursive: true });
// The website and native renderer share one measured semantic palette.
fs.copyFileSync(path.join(renderer, 'studio-tokens.css'), path.resolve('app/studio-tokens.css'));
const legacyBridge = path.join(target, 'cloud-bridge.js');
if (!fs.existsSync(bridgePath)) {
  if (!fs.existsSync(legacyBridge)) throw Error('Cloud transport source is missing.');
  fs.copyFileSync(legacyBridge, bridgePath);
}
let html = fs.readFileSync(path.join(renderer, 'chrome.html'), 'utf8');
const files = new Map();
const version = (name, data) => {
  const hash = createHash('sha256').update(data).digest('hex').slice(0, 16);
  const filename = name.replace(/(\.[^.]+)$/, `.${hash}$1`);
  files.set(filename, data);
  return filename;
};
for (const name of ['chrome.css', 'studio-tokens.css', 'chrome.js', 'office-signals.js', 'browser-bridge.js']) {
  const output = version(name, fs.readFileSync(path.join(renderer, name)));
  const reference = new RegExp(`(["'])\\./${name.replaceAll('.', '\\.')}\\1`, 'g');
  if ([...html.matchAll(reference)].length !== 1) throw Error(`Expected one shared renderer reference to ${name}.`);
  html = html.replace(reference, (_, quote) => `${quote}./${output}${quote}`);
}
const bridge = version('cloud-bridge.js', fs.readFileSync(bridgePath));
html = html.replace('</head>', `<script src="./${bridge}"></script></head>`);
const generated = /^(?:chrome\.html|(?:chrome|browser-bridge|cloud-bridge|office-signals)(?:\.[a-f0-9]{16})?\.js|(?:chrome|studio-tokens)(?:\.[a-f0-9]{16})?\.css)$/;
for (const entry of fs.readdirSync(target, { withFileTypes: true })) {
  if (!entry.isDirectory() && generated.test(entry.name)) fs.rmSync(path.join(target, entry.name));
}
for (const [name, data] of files) fs.writeFileSync(path.join(target, name), data);
fs.writeFileSync(path.join(target, 'chrome.html'), html);
console.log('Copied the shared renderer, derived signals and private transport with content-addressed assets.');
