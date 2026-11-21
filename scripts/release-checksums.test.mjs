#!/usr/bin/env node
// Focused tests for release-checksums.mjs. Disposable temp files only; no build, provider or network.
// Run: node scripts/release-checksums.test.mjs   (no node:test runner; plain assertions, nonzero exit on failure)
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const script = join(dirname(fileURLToPath(import.meta.url)), 'release-checksums.mjs');
const sha = (text) => createHash('sha256').update(text).digest('hex');

function run(dir, manifest) {
  return spawnSync(process.execPath, [script, dir, manifest], { encoding: 'utf8' });
}
function put(dir, rel, content) {
  const full = join(dir, rel);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, content);
  return full;
}
function fullSet(dir) {
  put(dir, 'daftar-1.0.0.AppImage', 'appimage-bytes');
  put(dir, 'windows/daftar-1.0.0-windows-x64.exe', 'exe-bytes');
  put(dir, 'windows/daftar-1.0.0-windows-x64.zip', 'zip-bytes');
  put(dir, 'android/app-debug.apk', 'apk-bytes');
  put(dir, 'editor/daftar-1.0.0.vsix', 'vsix-bytes');
}

const cases = [];
const test = (name, fn) => cases.push({ name, fn });

test('valid set of all families yields deterministic sorted checksums', () => {
  const dir = mkdtempSync(join(tmpdir(), 'rc-valid-'));
  try {
    fullSet(dir);
    const manifest = join(dir, 'SHA256SUMS');
    const first = run(dir, manifest);
    assert.equal(first.status, 0, first.stderr);
    const text1 = readFileSync(manifest, 'utf8');
    const expected = [
      [sha('apk-bytes'), 'app-debug.apk'],
      [sha('appimage-bytes'), 'daftar-1.0.0.AppImage'],
      [sha('vsix-bytes'), 'daftar-1.0.0.vsix'],
      [sha('exe-bytes'), 'daftar-1.0.0-windows-x64.exe'],
      [sha('zip-bytes'), 'daftar-1.0.0-windows-x64.zip'],
    ].sort((a, b) => (a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0)).map(([d, n]) => `${d}  ${n}`).join('\n') + '\n';
    assert.equal(text1, expected);
    const second = run(dir, manifest);
    assert.equal(second.status, 0, second.stderr);
    assert.equal(readFileSync(manifest, 'utf8'), text1, 'rerun is deterministic and does not self-include');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('an extra zero-byte ZIP fails instead of being omitted', () => {
  const dir = mkdtempSync(join(tmpdir(), 'rc-empty-'));
  try {
    fullSet(dir);
    put(dir, 'windows/extra-empty.zip', '');
    const manifest = join(dir, 'SHA256SUMS');
    const result = run(dir, manifest);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Empty release asset/);
    assert.equal(existsSync(manifest), false, 'no manifest written on failure');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('a missing asset family fails', () => {
  const dir = mkdtempSync(join(tmpdir(), 'rc-missing-'));
  try {
    put(dir, 'daftar.AppImage', 'a');
    put(dir, 'windows/daftar.exe', 'b');
    put(dir, 'windows/daftar.zip', 'c');
    put(dir, 'android/app-debug.apk', 'd');
    const result = run(dir, join(dir, 'SHA256SUMS'));
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Missing required release asset family: \*\.vsix/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('duplicate basenames in different directories fail', () => {
  const dir = mkdtempSync(join(tmpdir(), 'rc-dup-'));
  try {
    fullSet(dir);
    put(dir, 'other/app-debug.apk', 'different-bytes');
    const result = run(dir, join(dir, 'SHA256SUMS'));
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Duplicate release asset basename: app-debug\.apk/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('checksum output inside the release dir is excluded from itself', () => {
  const dir = mkdtempSync(join(tmpdir(), 'rc-self-'));
  try {
    fullSet(dir);
    const manifest = join(dir, 'windows', 'bundle.zip');
    const result = run(dir, manifest);
    assert.equal(result.status, 0, result.stderr);
    const text = readFileSync(manifest, 'utf8');
    assert.equal(text.includes('bundle.zip'), false);
    assert.equal(text.trim().split('\n').length, 5);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('usage error without arguments exits 2', () => {
  const result = spawnSync(process.execPath, [script], { encoding: 'utf8' });
  assert.equal(result.status, 2);
});

let failed = 0;
for (const { name, fn } of cases) {
  try { fn(); console.log(`ok - ${name}`); }
  catch (error) { failed += 1; console.error(`not ok - ${name}\n${error && error.stack ? error.stack : error}`); }
}
if (failed) { console.error(`${failed} of ${cases.length} release-checksum tests failed`); process.exit(1); }
console.log(`${cases.length} release-checksum tests passed`);
