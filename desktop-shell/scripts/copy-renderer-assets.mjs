// Copies static renderer assets (HTML/CSS) next to the compiled chrome.js.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const src = path.join(here, '..', 'src', 'renderer');
const dest = path.join(here, '..', 'dist', 'renderer');

fs.mkdirSync(dest, { recursive: true });
for (const name of ['chrome.html', 'chrome.css', 'studio-tokens.css', 'freeflow.css']) {
  const from = path.join(src, name);
  // freeflow.css is optional so the build works before it is added.
  if (name === 'freeflow.css' && !fs.existsSync(from)) continue;
  fs.copyFileSync(from, path.join(dest, name));
}
console.log(`Copied renderer assets to ${dest}`);
