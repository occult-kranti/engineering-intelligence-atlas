// Copies static renderer assets (HTML/CSS/vendored JS) next to the compiled chrome.js.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const src = path.join(here, '..', 'src', 'renderer');
const dest = path.join(here, '..', 'dist', 'renderer');

fs.mkdirSync(dest, { recursive: true });
for (const name of ['chrome.html', 'chrome.css', 'donna.css']) {
  fs.copyFileSync(path.join(src, name), path.join(dest, name));
}

// Vendored runtime libraries (loaded via <script src> under the offline CSP;
// each ships with its license file).
fs.cpSync(path.join(src, 'vendor'), path.join(dest, 'vendor'), { recursive: true });

console.log(`Copied renderer assets to ${dest}`);
