import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { digest, repoRoot, webRoot } from './static-build-lib.mjs';
const compiler = join(webRoot, 'node_modules/typescript/bin/tsc');
if (!existsSync(compiler)) throw new Error('Install locked web dependencies to build the desktop preview.');
const shell = join(repoRoot, 'desktop-shell');
const compiled = spawnSync(process.execPath, [compiler, '-p', join(shell, 'tsconfig.renderer.json')], { cwd: repoRoot, stdio: 'inherit' });
if (compiled.status !== 0) process.exit(compiled.status ?? 1);
const dest = join(webRoot, 'public/desktop-preview');
const assets = new Map();
function contentAddress(name, bytes) {
  const filename = name.replace(/(\.[^.]+)$/, `.${digest(bytes).slice(0, 16)}$1`);
  assets.set(filename, bytes);
  return filename;
}
function rewriteReference(source, original, generated) {
  const reference = new RegExp(`(["'])\\./${original.replaceAll('.', '\\.')}\\1`, 'g');
  if ([...source.matchAll(reference)].length !== 1) throw new Error(`Expected one preview reference to ${original}.`);
  return source.replace(reference, (_, quote) => `${quote}./${generated}${quote}`);
}

// Hash the seed before its bridge, and hash the rewritten bridge before HTML.
// Only this public copy changes; native/file:// renderer references stay intact.
const seed = contentAddress('preview-state.json', readFileSync(join(repoRoot, 'company/preview-state.json')));
const bridge = rewriteReference(readFileSync(join(shell, 'dist/renderer/browser-bridge.js'), 'utf8'), 'preview-state.json', seed);
const references = [
  ['studio-tokens.css', contentAddress('studio-tokens.css', readFileSync(join(shell, 'src/renderer/studio-tokens.css')))],
  ['chrome.css', contentAddress('chrome.css', readFileSync(join(shell, 'src/renderer/chrome.css')))],
  ['office-signals.js', contentAddress('office-signals.js', readFileSync(join(shell, 'dist/renderer/office-signals.js')))],
  ['chrome.js', contentAddress('chrome.js', readFileSync(join(shell, 'dist/renderer/chrome.js')))],
  ['browser-bridge.js', contentAddress('browser-bridge.js', bridge)],
];
let html = readFileSync(join(shell, 'src/renderer/chrome.html'), 'utf8');
for (const [original, generated] of references) html = rewriteReference(html, original, generated);

mkdirSync(dest, { recursive: true });
const generatedFile = /^(?:chrome\.html|(?:chrome|browser-bridge|office-signals)(?:\.[a-f0-9]{16})?\.js|(?:chrome|studio-tokens)(?:\.[a-f0-9]{16})?\.css|preview-state(?:\.[a-f0-9]{16})?\.json)$/;
for (const entry of readdirSync(dest, { withFileTypes: true })) {
  if (generatedFile.test(entry.name) && !entry.isDirectory()) rmSync(join(dest, entry.name));
}
for (const [filename, bytes] of assets) writeFileSync(join(dest, filename), bytes);
writeFileSync(join(dest, 'chrome.html'), html);
console.log('Built desktop preview with content-addressed renderer, styles, bridge and starter state.');
