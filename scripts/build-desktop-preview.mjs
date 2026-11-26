import { copyDonnaStudio } from './donna-studio-assets.mjs';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { repoRoot, webRoot } from './static-build-lib.mjs';
import { buildAssetGraph, hashName, htmlRoots, rewriteHtml, writeAssets } from './renderer-assets.mjs';
import { copyCompanyStudio } from './company-studio-assets.mjs';
const compiler = join(webRoot, 'node_modules/typescript/bin/tsc');
if (!existsSync(compiler)) throw new Error('Install locked web dependencies to build the desktop preview.');
const shell = join(repoRoot, 'desktop-shell');
const compiled = spawnSync(process.execPath, [compiler, '-p', join(shell, 'tsconfig.renderer.json')], { cwd: repoRoot, stdio: 'inherit' });
if (compiled.status !== 0) process.exit(compiled.status ?? 1);
const dest = join(webRoot, 'public/desktop-preview');
const renderer = join(shell, 'dist/renderer');
const source = join(shell, 'src/renderer');

// Hash the seed first, then rewrite its single reference inside the bridge copy
// before the bridge is hashed. Only this public copy changes.
const seedBytes = readFileSync(join(repoRoot, 'company/preview-state.json'));
const seed = hashName('preview-state.json', seedBytes);
const bridgeText = readFileSync(join(renderer, 'browser-bridge.js'), 'utf8');
const seedRef = /(["'])\.\/preview-state\.json\1/g;
if ([...bridgeText.matchAll(seedRef)].length !== 1) throw new Error('Expected one preview reference to preview-state.json.');
const bridge = Buffer.from(bridgeText.replace(seedRef, (_, q) => `${q}./${seed}${q}`));

// CSS comes from source when the renderer build has not copied it.
const overrides = new Map([['browser-bridge.js', bridge]]);
for (const name of ['chrome.css', 'studio-tokens.css', 'freeflow.css', 'resource-library.css', 'canvas-craft.css', 'donna-studio.css', 'hardware-workbench.css', 'brain/panel.css']) {
  if (existsSync(join(source, name))) overrides.set(name, readFileSync(join(source, name)));
}

let html = readFileSync(join(source, 'chrome.html'), 'utf8');
const roots = htmlRoots(html);
const { files, names } = buildAssetGraph(renderer, roots, { overrides });
html = rewriteHtml(html, names, roots);
files.set(hashName('preview-state.json', seedBytes), seedBytes);
files.set('chrome.html', Buffer.from(html));

const legacy = /^(?:chrome\.html|(?:chrome|browser-bridge|office-signals|model-pool|hardware-workbench|donna-studio)(?:\.[a-f0-9]{16})?\.js|(?:chrome|studio-tokens|freeflow|resource-library|canvas-craft|donna-studio|hardware-workbench)(?:\.[a-f0-9]{16})?\.css|preview-state(?:\.[a-f0-9]{16})?\.json)$/;
writeAssets(dest, files, { prune: (rel) => legacy.test(rel) });
copyCompanyStudio(repoRoot, join(dest, 'studios/threejs'));
console.log('Built desktop preview with content-addressed renderer graph, styles, bridge and starter state.');

copyDonnaStudio(repoRoot, join(dest, 'assets/donna-studio'));
