#!/usr/bin/env node
/**
 * Sync the Engineering Intelligence Atlas web build into the Android shell.
 *
 * Copies the latest static build from ../app/dist (or ../app/dist/public when
 * that layout is used) into ./www/atlas, and vendors the Capacitor web runtime
 * modules used by the launcher into ./www/vendor.
 *
 * Usage: npm run sync:atlas
 */
import { cpSync, existsSync, mkdirSync, rmSync, copyFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const appRoot = resolve(root, '..', 'app');

function pickAtlasSource() {
  const candidates = [join(appRoot, 'dist', 'public'), join(appRoot, 'dist')];
  for (const dir of candidates) {
    if (existsSync(join(dir, 'index.html'))) return dir;
  }
  throw new Error(
    `No atlas build found. Expected index.html in one of: ${candidates.join(', ')}. ` +
      'Run the web build in ../app first.',
  );
}

function syncAtlas() {
  const src = pickAtlasSource();
  const dest = join(root, 'www', 'atlas');
  rmSync(dest, { recursive: true, force: true });
  mkdirSync(dest, { recursive: true });
  cpSync(src, dest, { recursive: true });
  const files = readdirSync(dest);
  console.log(`[sync] atlas: ${src} -> ${dest} (${files.length} top-level entries)`);
  if (!existsSync(join(dest, 'index.html'))) {
    throw new Error('[sync] atlas copy is missing index.html');
  }
}

function syncFonts(atlasSrc) {
  // Copy latin Manrope woff2 files (content-hashed names) to stable paths so
  // the launcher can share the atlas's visual identity without a build step.
  const assetsDir = join(atlasSrc, 'assets');
  const dest = join(root, 'www', 'fonts');
  rmSync(dest, { recursive: true, force: true });
  mkdirSync(dest, { recursive: true });
  const wanted = new Map();
  for (const file of readdirSync(assetsDir)) {
    const m = file.match(/^manrope-latin-(\d+)-normal-.+\.woff2$/);
    if (m) wanted.set(m[1], file);
  }
  for (const [weight, file] of [...wanted.entries()].sort()) {
    copyFileSync(join(assetsDir, file), join(dest, `manrope-${weight}.woff2`));
    console.log(`[sync] font: manrope latin ${weight}`);
  }
}

function syncVendor() {
  const dest = join(root, 'www', 'vendor');
  rmSync(dest, { recursive: true, force: true });
  mkdirSync(dest, { recursive: true });
  const coreSrc = join(root, 'node_modules', '@capacitor/core', 'dist', 'index.js');
  if (!existsSync(coreSrc)) throw new Error(`[sync] missing ${coreSrc} — run npm install first`);
  copyFileSync(coreSrc, join(dest, 'capacitor-core.js'));
  console.log('[sync] vendor: @capacitor/core/dist/index.js -> www/vendor/capacitor-core.js');
  // Minimal ESM shim for the Preferences plugin. On device, registerPlugin
  // returns the native implementation; the web fallback is unnecessary here
  // because the launcher uses localStorage when no native bridge is present.
  const shim = [
    "import { registerPlugin } from '@capacitor/core';",
    "export const Preferences = registerPlugin('Preferences');",
    '',
  ].join('\n');
  writeFileSync(join(dest, 'capacitor-preferences.js'), shim);
  console.log('[sync] vendor: wrote capacitor-preferences.js shim');
}

syncAtlas();
syncFonts(pickAtlasSource());
syncVendor();
console.log('[sync] done');
