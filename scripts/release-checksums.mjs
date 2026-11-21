#!/usr/bin/env node
// Usage: node scripts/release-checksums.mjs <release-dir> <manifest-path>
// Walks only the release artifact directory, requires every asset family, rejects duplicate
// basenames, hashes the actual bytes and writes a sha256sum-style manifest.
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, extname, join, resolve } from 'node:path';

const [dirArg, outArg] = process.argv.slice(2);
if (!dirArg || !outArg) {
  console.error('Usage: release-checksums.mjs <release-dir> <manifest-path>');
  process.exit(2);
}
const root = resolve(dirArg);
const out = resolve(outArg);
const required = ['.AppImage', '.exe', '.zip', '.apk', '.vsix'];

function walk(dir) {
  const found = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...walk(full));
    else if (entry.isFile()) found.push(full);
  }
  return found;
}

const files = walk(root).filter(file => file !== out && required.includes(extname(file)) && statSync(file).size > 0);
const seen = new Map();
for (const file of files) {
  const name = basename(file);
  if (seen.has(name)) {
    console.error(`Duplicate release asset basename: ${name}`);
    process.exit(1);
  }
  seen.set(name, file);
}
for (const ext of required) {
  if (![...seen.keys()].some(name => extname(name) === ext)) {
    console.error(`Missing required release asset family: *${ext}`);
    process.exit(1);
  }
}
const lines = [...seen.keys()].sort().map(name => {
  const digest = createHash('sha256').update(readFileSync(seen.get(name))).digest('hex');
  return `${digest}  ${name}`;
});
writeFileSync(out, lines.join('\n') + '\n');
console.log(`Wrote ${lines.length} checksums to ${out}`);
