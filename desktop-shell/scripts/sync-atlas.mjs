#!/usr/bin/env node
/**
 * sync-atlas — copy the built static web atlas into resources/atlas/.
 *
 * Usage:
 *   node scripts/sync-atlas.mjs [--src <dir>]
 *
 * Default source resolution, relative to this repository:
 *   1. ../site-source/dist/public (current web build)
 *   2. ../docs                    (checked-in portable static atlas)
 * Pass --src <dir> to override.
 *
 * The destination resources/atlas/ is deleted and recreated on every run.
 * This script only READS the app workspace; it never modifies it.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..');

function argValue(flag) {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : null;
}

const explicit = argValue('--src');
const candidates = explicit
  ? [path.resolve(explicit)]
  : [path.join(root, '..', 'site-source', 'dist', 'public'), path.join(root, '..', 'docs')];

const source = candidates.find((dir) => fs.existsSync(path.join(dir, 'index.html')));
if (!source) {
  console.error(
    'No atlas build found. Looked for index.html in:\n' +
      candidates.map((c) => `  - ${c}`).join('\n') +
      '\nBuild the web app first (or pass --src <dir>).',
  );
  process.exit(1);
}

const dest = path.join(root, 'resources', 'atlas');
fs.rmSync(dest, { recursive: true, force: true });
fs.mkdirSync(dest, { recursive: true });
fs.cpSync(source, dest, { recursive: true });

const files = [];
(function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p);
    else files.push(p);
  }
})(dest);
console.log(`Synced ${files.length} files from ${source} -> ${dest}`);
