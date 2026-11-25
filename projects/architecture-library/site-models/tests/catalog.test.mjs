import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { validateCatalog, localPath, externalUrl, assertEmbeddedGlb } from '../catalog-core.mjs';
const root = new URL('../', import.meta.url);
const catalog = JSON.parse(fs.readFileSync(new URL('catalog.json', root)));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const copy = () => structuredClone(catalog);

test('all published captures have byte hashes, accurate declared density, embedded resources and preserved accessors', () => {
  validateCatalog(catalog); assert.equal(catalog.assets.length, 7);
  let bytes = 0, triangles = 0;
  for (const asset of catalog.assets) {
    const binary = fs.readFileSync(new URL(asset.file, root)); bytes += binary.length;
    assert.equal(binary.length, asset.bytes); assert.equal(sha(binary), asset.sha256);
    const glb = assertEmbeddedGlb(binary.buffer.slice(binary.byteOffset, binary.byteOffset + binary.byteLength));
    let sourceTriangles = 0;
    for (const mesh of glb.meshes) for (const primitive of mesh.primitives) {
      assert.equal(primitive.mode ?? 4, 4);
      sourceTriangles += primitive.indices !== undefined ? glb.accessors[primitive.indices].count / 3 : glb.accessors[primitive.attributes.POSITION].count / 3;
    }
    assert.equal(sourceTriangles, asset.triangles); triangles += sourceTriangles;
    const receipt = JSON.parse(fs.readFileSync(new URL(asset.evidence, root)));
    for (const key of ['accessorBytesEqual','indexBytesAndCountsEqual','textureBytesEqual','nodeTransformsEqual','hierarchyEqual','materialPropertiesEqual']) assert.equal(receipt.preservation[key], true, `${asset.id}/${key}`);
    assert.equal(receipt.output.web.sha256, asset.sha256);
    assert.equal(sha(fs.readFileSync(new URL(asset.preview, root))), receipt.previewSha256);
    assert.equal(asset.metric.measurementEnabled, false);
  }
  assert.equal(bytes, 144173560); assert.equal(triangles, 8584116);
  assert(bytes < 160 * 1048576);
});

test('noncommercial and view-only sources cannot enter the public model bundle', () => {
  for (const license of ['CC-BY-NC-4.0', 'unknown', null]) {
    const data = copy(); data.assets[0].license.spdx = license;
    assert.throws(() => validateCatalog(data), /Research-only or view-only/);
  }
  const data = copy(); data.references[0].file = 'assets/restricted.glb';
  assert.throws(() => validateCatalog(data), /Restricted reference/);
});

test('unknown scale cannot become a supported measurement or a precision claim', () => {
  for (const change of [{ verified:true }, { units:'metres' }, { measurementEnabled:true }, { independentErrorMetres:0.001 }, { crs:'EPSG:4326' }]) {
    const data = copy(); Object.assign(data.assets[0].metric, change);
    assert.throws(() => validateCatalog(data), /metric accuracy/);
  }
});

test('catalog rejects path injection, duplicate identities, missing hashes and oversized models', () => {
  for (const file of ['../private.glb','/absolute.glb','assets/../private.glb','assets/.secret.glb','https://example.com/a.glb','assets/a.glb?x=1']) assert.throws(() => localPath(file));
  for (const url of ['javascript:alert(1)','http://example.com','https://user:secret@example.com']) assert.throws(() => externalUrl(url));
  for (const change of [{bytes:64*1048576+1},{sha256:'unknown'},{file:'other/model.glb'},{triangles:NaN}]) {
    const data = copy();Object.assign(data.assets[0],change); assert.throws(() => validateCatalog(data));
  }
  const data=copy();data.assets[1].id=data.assets[0].id;assert.throws(()=>validateCatalog(data),/duplicate/);
});

test('GLB preflight rejects malformed headers and external resources', () => {
  assert.throws(() => assertEmbeddedGlb(new ArrayBuffer(20)), /Invalid/);
  const text = Buffer.from(JSON.stringify({asset:{version:'2.0'},buffers:[{uri:'https://example.com/buffer.bin',byteLength:4}]}));
  const json = Buffer.concat([text, Buffer.alloc((4-text.length%4)%4,32)]), file=Buffer.alloc(20+json.length);
  file.writeUInt32LE(0x46546c67,0);file.writeUInt32LE(2,4);file.writeUInt32LE(file.length,8);file.writeUInt32LE(json.length,12);file.writeUInt32LE(0x4e4f534a,16);json.copy(file,20);
  assert.throws(()=>assertEmbeddedGlb(file.buffer.slice(file.byteOffset,file.byteOffset+file.byteLength)),/External/);
});

test('vendored ESM runtime and licenses match pinned file receipts', () => {
  const manifest = JSON.parse(fs.readFileSync(new URL('vendor/manifest.json',root)));
  assert.deepEqual(manifest.packages,{three:'0.187.0',meshoptimizer:'1.2.0'});
  for(const file of manifest.files)assert.equal(sha(fs.readFileSync(new URL(`vendor/${file.target}`,root))),file.outputSha256);
});

test('accuracy baseline distinguishes preserving downloads from altered preview imports', () => {
  const baseline = JSON.parse(fs.readFileSync(new URL('capture-requirements.json', root))).currentBaseline;
  for (const record of baseline.sacredSiteRecords) {
    const asset = catalog.assets.find(item => item.id === record.siteId);
    const receipt = JSON.parse(fs.readFileSync(new URL(asset.evidence, root)));
    assert.equal(record.sourceTopologyPreservedInGlb, true);
    assert.equal(record.publishedGlb.sha256, asset.sha256);
    assert.equal(record.publishedGlb.triangles, record.sourceTriangles);
    assert.equal(record.previewInspection.importedTriangles, receipt.previewInspection.triangles);
    assert.equal(record.previewInspection.importRemovedFaces, asset.triangles - receipt.previewInspection.triangles);
    assert.notEqual(record.previewInspection.sha256, record.publishedGlb.sha256);
  }
  const kailasa = catalog.assets.find(item => item.id === 'kailasa-context');
  const receipt = JSON.parse(fs.readFileSync(new URL(kailasa.evidence, root)));
  assert.equal(baseline.kailasaPreview.publishedGlbSha256, kailasa.sha256);
  assert.equal(baseline.kailasaPreview.publishedTriangles, kailasa.triangles);
  assert.equal(baseline.kailasaPreview.previewTriangles, receipt.previewInspection.triangles);
  assert.match(kailasa.previewNote, /136,498/);
  assert.match(kailasa.previewNote, /136,499/);
});
