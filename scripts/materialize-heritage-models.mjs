#!/usr/bin/env node
/** Restore the three large reviewed GLBs from exact Git-tracked byte parts. No network or recompression. */
import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const DEFAULT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PACK = 'integrations/heritage-assets/packed-models';
const CATALOG = 'projects/architecture-library/site-models/catalog.json';
const ASSET_ROOT = 'projects/architecture-library/site-models/assets';
const IDS = ['st-george-antiochian-orthodox-church', 'el-markaz-islami-mosque', 'giza-plateau'];
const MAX_PART_BYTES = 10 * 1024 * 1024;
const MAX_MODEL_BYTES = 64 * 1024 * 1024;
const MAX_TOTAL_BYTES = 160 * 1024 * 1024;
const HASH = /^[a-f0-9]{64}$/;
const sha256 = value => createHash('sha256').update(value).digest('hex');
const integer = (value, maximum) => Number.isSafeInteger(value) && value > 0 && value <= maximum;

function plainPath(root, relative) {
  if (typeof relative !== 'string' || !/^[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_.-]+)*$/.test(relative)
    || relative.split('/').some(part => part === '.' || part === '..' || part.startsWith('.'))) throw new Error('Unsafe heritage model path');
  const target = path.resolve(root, relative);
  if (!target.startsWith(root + path.sep)) throw new Error('Heritage model path escapes its root');
  let current = path.parse(target).root;
  for (const component of target.slice(current.length).split(path.sep)) {
    current = path.join(current, component);
    try { if (fs.lstatSync(current).isSymbolicLink()) throw new Error(`Symlink rejected: ${current}`); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  return target;
}

function openRegular(root, relative, maximum) {
  const file = plainPath(root, relative);
  const fd = fs.openSync(file, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK);
  try {
    const stat = fs.fstatSync(fd);
    if (!stat.isFile() || stat.size > maximum) throw new Error(`Not a bounded regular file: ${relative}`);
    return { fd, bytes: stat.size };
  } catch (error) { fs.closeSync(fd); throw error; }
}

function readBounded(root, relative, maximum) {
  const { fd, bytes } = openRegular(root, relative, maximum);
  try {
    const result = Buffer.alloc(bytes); let offset = 0;
    while (offset < bytes) {
      const count = fs.readSync(fd, result, offset, bytes - offset, null);
      if (!count) throw new Error(`Truncated heritage file: ${relative}`);
      offset += count;
    }
    if (fs.readSync(fd, Buffer.alloc(1), 0, 1, null)) throw new Error(`Growing heritage file: ${relative}`);
    return result;
  } finally { fs.closeSync(fd); }
}

function verifyFile(root, relative, expected) {
  const { fd, bytes } = openRegular(root, relative, Math.max(MAX_PART_BYTES, expected.bytes));
  try {
    if (bytes !== expected.bytes) throw new Error(`Heritage byte count mismatch: ${relative}`);
    const buffer = Buffer.alloc(Math.min(bytes, 1024 * 1024)); const hash = createHash('sha256'); let total = 0;
    while (total < bytes) {
      const count = fs.readSync(fd, buffer, 0, Math.min(buffer.length, bytes - total), null);
      if (!count) throw new Error(`Truncated heritage file: ${relative}`);
      total += count; hash.update(buffer.subarray(0, count));
    }
    if (fs.readSync(fd, Buffer.alloc(1), 0, 1, null) || hash.digest('hex') !== expected.sha256) throw new Error(`Heritage SHA256 mismatch: ${relative}`);
  } finally { fs.closeSync(fd); }
}

function validateManifest(manifest, catalog) {
  if (manifest?.schemaVersion !== 1 || manifest.encoding !== 'concatenated-original-bytes'
    || !integer(manifest.chunkBytes, MAX_PART_BYTES) || !Array.isArray(manifest.models)
    || manifest.models.length !== IDS.length || !Array.isArray(catalog?.assets)) throw new Error('Invalid heritage packed-model manifest');
  const seen = new Set(); let total = 0, partCount = 0;
  for (const model of manifest.models) {
    if (!IDS.includes(model.id) || seen.has(model.id) || model.target !== `${ASSET_ROOT}/${model.id}.glb`
      || !integer(model.bytes, MAX_MODEL_BYTES) || !HASH.test(model.sha256)
      || !Array.isArray(model.parts) || model.parts.length < 1 || model.parts.length > 32
      || model.parts.length !== Math.ceil(model.bytes / manifest.chunkBytes)) throw new Error('Invalid heritage model identity, path or bounds');
    seen.add(model.id);
    const matches = catalog.assets.filter(asset => asset.id === model.id);
    if (matches.length !== 1 || matches[0].file !== `assets/${model.id}.glb`
      || matches[0].bytes !== model.bytes || matches[0].sha256 !== model.sha256) throw new Error(`Packed model differs from the reviewed catalog: ${model.id}`);
    let bytes = 0;
    model.parts.forEach((part, index) => {
      const expectedName = `${model.id}.${String(index).padStart(3, '0')}.part`;
      const expectedBytes = Math.min(manifest.chunkBytes, model.bytes - index * manifest.chunkBytes);
      if (part.file !== expectedName || !integer(part.bytes, MAX_PART_BYTES) || part.bytes !== expectedBytes || !HASH.test(part.sha256)) throw new Error('Invalid heritage part path, size or hash');
      bytes += part.bytes; partCount++;
    });
    if (bytes !== model.bytes) throw new Error('Heritage parts do not cover the complete model');
    total += bytes;
  }
  if (total > MAX_TOTAL_BYTES || partCount > 32 || manifest.totalBytes !== total) throw new Error('Heritage pack exceeds its total budget or declared size');
}

export function materializeHeritageModels(repoRoot = DEFAULT_ROOT, { verifyOnly = false } = {}) {
  const root = path.resolve(repoRoot);
  if (!fs.lstatSync(root).isDirectory()) throw new Error('Heritage repository root must be a directory');
  const rawManifest = readBounded(root, `${PACK}/manifest.json`, 64 * 1024);
  const manifest = JSON.parse(rawManifest.toString('utf8'));
  const catalog = JSON.parse(readBounded(root, CATALOG, 2 * 1024 * 1024).toString('utf8'));
  validateManifest(manifest, catalog);
  const expectedEntries = new Set(['manifest.json', ...manifest.models.flatMap(model => model.parts.map(part => part.file))]);
  for (const entry of fs.readdirSync(plainPath(root, PACK), { withFileTypes: true })) {
    if (!entry.isFile() || !expectedEntries.has(entry.name)) throw new Error(`Unexpected or symlinked heritage pack entry: ${entry.name}`);
  }
  // Verify the complete pack and every existing target before creating any output.
  const present = new Set();
  for (const model of manifest.models) {
    for (const part of model.parts) verifyFile(root, `${PACK}/${part.file}`, part);
    const destination = plainPath(root, model.target);
    if (fs.existsSync(destination)) { verifyFile(root, model.target, model); present.add(model.id); }
    else if (verifyOnly) throw new Error(`Missing materialized heritage model: ${model.target}`);
  }
  const results = [];
  for (const model of manifest.models) {
    let status = 'already-present';
    if (!present.has(model.id)) {
      const destination = plainPath(root, model.target);
      fs.mkdirSync(path.dirname(destination), { recursive: true }); plainPath(root, model.target);
      const temporary = path.join(path.dirname(destination), `.${model.id}.${randomUUID()}.tmp`);
      let fd;
      try {
        fd = fs.openSync(temporary, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_NOFOLLOW, 0o600);
        const hash = createHash('sha256'); let total = 0;
        for (const part of model.parts) {
          const bytes = readBounded(root, `${PACK}/${part.file}`, MAX_PART_BYTES);
          if (bytes.length !== part.bytes || sha256(bytes) !== part.sha256) throw new Error(`Heritage part changed during assembly: ${part.file}`);
          hash.update(bytes); total += bytes.length;
          for (let offset = 0; offset < bytes.length;) offset += fs.writeSync(fd, bytes, offset, bytes.length - offset);
        }
        if (total !== model.bytes || hash.digest('hex') !== model.sha256) throw new Error(`Assembled heritage model SHA256 mismatch: ${model.id}`);
        fs.fchmodSync(fd, 0o644); fs.fsyncSync(fd); fs.closeSync(fd); fd = undefined;
        plainPath(root, model.target);
        try {
          // A same-directory hard link publishes the completed file atomically without replacing an existing path.
          fs.linkSync(temporary, destination); status = 'materialized';
        } catch (error) {
          if (error.code !== 'EEXIST') throw error;
          verifyFile(root, model.target, model); status = 'already-present';
        }
      } finally {
        if (fd !== undefined) fs.closeSync(fd);
        if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
      }
    }
    results.push({ id: model.id, target: model.target, bytes: model.bytes, sha256: model.sha256, status });
  }
  return { schemaVersion: 1, manifestSha256: sha256(rawManifest), encoding: manifest.encoding, totalBytes: manifest.totalBytes,
    partCount: manifest.models.reduce((count, model) => count + model.parts.length, 0), models: results };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.slice(2).some(arg => arg !== '--check')) throw new Error('Usage: node scripts/materialize-heritage-models.mjs [--check]');
    console.log(JSON.stringify(materializeHeritageModels(DEFAULT_ROOT, { verifyOnly: process.argv.includes('--check') }), null, 2));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
