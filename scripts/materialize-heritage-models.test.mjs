import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { materializeHeritageModels } from './materialize-heritage-models.mjs';

const PACK = 'integrations/heritage-assets/packed-models';
const CATALOG = 'projects/architecture-library/site-models/catalog.json';
const IDS = ['st-george-antiochian-orthodox-church', 'el-markaz-islami-mosque', 'giza-plateau'];
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'heritage-parts-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, PACK), { recursive: true });
  fs.mkdirSync(path.dirname(path.join(root, CATALOG)), { recursive: true });
  const originals = new Map(), catalog = { assets: [] };
  const manifest = { schemaVersion: 1, encoding: 'concatenated-original-bytes', chunkBytes: 10, totalBytes: 0, models: [] };
  for (const id of IDS) {
    const bytes = Buffer.from(`Exact original bytes for ${id}.`); originals.set(id, bytes);
    const target = `projects/architecture-library/site-models/assets/${id}.glb`;
    const model = { id, target, bytes: bytes.length, sha256: sha256(bytes), parts: [] };
    for (let offset = 0, index = 0; offset < bytes.length; offset += manifest.chunkBytes, index++) {
      const data = bytes.subarray(offset, offset + manifest.chunkBytes);
      const file = `${id}.${String(index).padStart(3, '0')}.part`;
      fs.writeFileSync(path.join(root, PACK, file), data);
      model.parts.push({ file, bytes: data.length, sha256: sha256(data) });
    }
    catalog.assets.push({ id, file: `assets/${id}.glb`, bytes: bytes.length, sha256: model.sha256 });
    manifest.totalBytes += bytes.length; manifest.models.push(model);
  }
  const save = () => { fs.writeFileSync(path.join(root, PACK, 'manifest.json'), JSON.stringify(manifest)); fs.writeFileSync(path.join(root, CATALOG), JSON.stringify(catalog)); };
  save(); return { root, manifest, catalog, originals, save, target: index => path.join(root, manifest.models[index].target), part: index => path.join(root, PACK, manifest.models[index].parts[0].file) };
}

test('exact multipart roundtrip is atomic per target and repeated runs preserve existing files', t => {
  const f = fixture(t), first = materializeHeritageModels(f.root);
  assert.equal(first.models.length, 3); assert(first.models.every(model => model.status === 'materialized'));
  const before = f.manifest.models.map(model => fs.statSync(path.join(f.root, model.target)).ino);
  for (const model of f.manifest.models) assert.deepEqual(fs.readFileSync(path.join(f.root, model.target)), f.originals.get(model.id));
  const second = materializeHeritageModels(f.root, { verifyOnly: true });
  assert(second.models.every(model => model.status === 'already-present'));
  assert.deepEqual(f.manifest.models.map(model => fs.statSync(path.join(f.root, model.target)).ino), before);
  assert.equal(fs.readdirSync(path.dirname(f.target(0))).filter(name => name.endsWith('.tmp')).length, 0);
});

test('missing or corrupted parts fail the complete preflight before any output is created', t => {
  for (const mode of ['missing', 'corrupt']) {
    const f = fixture(t);
    if (mode === 'missing') fs.unlinkSync(f.part(2));
    else { const content = fs.readFileSync(f.part(2)); content[0] ^= 1; fs.writeFileSync(f.part(2), content); }
    assert.throws(() => materializeHeritageModels(f.root), mode === 'missing' ? /ENOENT/ : /SHA256/);
    assert.equal(fs.existsSync(f.target(0)), false);
  }
});

test('changed existing output is rejected without replacement or partial new outputs', t => {
  for (const mode of ['different-size', 'same-size']) {
    const f = fixture(t); fs.mkdirSync(path.dirname(f.target(2)), { recursive: true });
    const changed = mode === 'same-size' ? Buffer.from(f.originals.get(IDS[2])) : Buffer.from('keep this local work');
    changed[0] ^= 1; fs.writeFileSync(f.target(2), changed);
    assert.throws(() => materializeHeritageModels(f.root), /byte count|SHA256/);
    assert.deepEqual(fs.readFileSync(f.target(2)), changed); assert.equal(fs.existsSync(f.target(0)), false);
  }
});

test('manifest paths, identities, duplicated models and chunk size cannot escape the known allowlist', t => {
  for (const mutate of [
    f => { f.manifest.models[0].target = '../outside.glb'; },
    f => { f.manifest.models[0].parts[0].file = '../outside.part'; },
    f => { f.manifest.models[0].parts[0].file = '/tmp/outside.part'; },
    f => { f.manifest.models[1] = structuredClone(f.manifest.models[0]); },
    f => { f.manifest.chunkBytes = 10 * 1024 * 1024 + 1; },
    f => { f.manifest.models[0].bytes = 64 * 1024 * 1024 + 1; },
  ]) { const f = fixture(t); mutate(f); f.save(); assert.throws(() => materializeHeritageModels(f.root), /Invalid/); assert.equal(fs.existsSync(f.target(2)), false); }
});

test('pack identity must agree with the reviewed model catalog', t => {
  const f = fixture(t); f.catalog.assets[0].sha256 = '0'.repeat(64); f.save();
  assert.throws(() => materializeHeritageModels(f.root), /reviewed catalog/);
  assert.equal(fs.existsSync(f.target(0)), false);
});

test('symlinked source files, source directories, manifests and output paths are rejected', t => {
  for (const kind of ['part', 'directory', 'manifest', 'target', 'target-directory']) {
    const f = fixture(t), external = path.join(f.root, 'external'); fs.mkdirSync(external);
    if (kind === 'part') { const file = f.part(0); fs.copyFileSync(file, path.join(external, 'source')); fs.unlinkSync(file); fs.symlinkSync(path.join(external, 'source'), file); }
    if (kind === 'directory') { const packed = path.join(f.root, PACK); fs.renameSync(packed, path.join(external, 'pack')); fs.symlinkSync(path.join(external, 'pack'), packed); }
    if (kind === 'manifest') { const file = path.join(f.root, PACK, 'manifest.json'); fs.copyFileSync(file, path.join(external, 'manifest')); fs.unlinkSync(file); fs.symlinkSync(path.join(external, 'manifest'), file); }
    if (kind === 'target') { fs.mkdirSync(path.dirname(f.target(0)), { recursive: true }); const file = path.join(external, 'target'); fs.writeFileSync(file, f.originals.get(IDS[0])); fs.symlinkSync(file, f.target(0)); }
    if (kind === 'target-directory') fs.symlinkSync(external, path.dirname(f.target(0)));
    assert.throws(() => materializeHeritageModels(f.root), /[Ss]ymlink/);
  }
});

test('valid part hashes cannot replace the full catalog hash, and failed assembly leaves no partial target', t => {
  const f = fixture(t), data = fs.readFileSync(f.part(0)); data[0] ^= 1; fs.writeFileSync(f.part(0), data);
  f.manifest.models[0].parts[0].sha256 = sha256(data); f.save();
  assert.throws(() => materializeHeritageModels(f.root), /Assembled heritage model SHA256/);
  assert.equal(fs.existsSync(f.target(0)), false);
  assert.deepEqual(fs.readdirSync(path.dirname(f.target(0))), []);
});

test('check mode requires materialized targets and unexpected pack files are rejected', t => {
  const f = fixture(t); assert.throws(() => materializeHeritageModels(f.root, { verifyOnly: true }), /Missing materialized/);
  fs.writeFileSync(path.join(f.root, PACK, 'unreviewed.part'), 'extra');
  assert.throws(() => materializeHeritageModels(f.root), /Unexpected/);
});
