import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm, symlink, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { MeshoptDecoder } from 'meshoptimizer';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { readColoredTriangleOBJ, documentFromOBJ, createIO, compressDocument, snapshotDocument, assertPreserved, parseGLB, packGLB, readGLB, decompressFile, buildAsset, checkPath, sha256 } from '../preserve.mjs';

const OBJ = '# Original synthetic unit-test geometry, not a monument\nmtllib absent.mtl\nusemtl Solid\nv 0.123456789 0 0 0.123456 0.5 1\nv 1 0 0 0.2 0.3 0.4\nv 0 1 0 0.8 0.7 0.6\nv 0 0 1 1 0 0\nf 3 1 2\nf 1 1 4\nf 4 2 3\n';

async function withOBJ(content, callback) {
  const dir = await mkdtemp(path.join(tmpdir(), 'heritage-preservation-'));
  try {
    const file = path.join(dir, 'source.obj'); await writeFile(file, content);
    return await callback(file, dir);
  } finally { await rm(dir, { recursive: true, force: true }); }
}

test('OBJ preserves source vertex order, RGB, index order and repeated-index faces', async () => withOBJ(OBJ, async file => {
  const result = await readColoredTriangleOBJ(file, sha256(Buffer.from(OBJ)));
  assert.equal(result.evidence.vertices, 4); assert.equal(result.evidence.triangles, 3);
  assert.deepEqual([...result.indices], [2, 0, 1, 0, 0, 3, 3, 1, 2]);
  assert.equal(result.evidence.repeatedIndexTriangles, 1);
  assert.equal(result.positions[0], Math.fround(0.123456789));
  assert.equal(result.colors[0], Math.fround(0.123456));
  assert.ok(result.evidence.precision.position.maxAbsoluteErrorPerAxis[0] > 0);
  assert.equal(result.evidence.materialFilesLoaded, false); assert.equal(result.evidence.uvPresent, false);
}));

for (const [name, source, pattern] of [
  ['NaN coordinate', OBJ.replace('0.123456789', 'NaN'), /Invalid position/],
  ['infinite coordinate', OBJ.replace('0.123456789', '1e999'), /Nonfinite/],
  ['Float32 overflow', OBJ.replace('0.123456789', '1e39'), /Float32-overflow/],
  ['out-of-range color', OBJ.replace('0.123456 0.5 1', '1.1 0.5 1'), /RGB/],
  ['zero index', OBJ.replace('f 3 1 2', 'f 0 1 2'), /positive/],
  ['out-of-bounds index', OBJ.replace('f 3 1 2', 'f 5 1 2'), /out of bounds/],
  ['negative index', OBJ.replace('f 3 1 2', 'f -1 1 2'), /positive/],
  ['UV index', OBJ.replace('f 3 1 2', 'f 3\/1 1 2'), /positive/],
  ['unsupported UV record', OBJ + 'vt 0 0\n', /Unsupported OBJ/],
  ['quad', OBJ.replace('f 3 1 2', 'f 3 1 2 4'), /already-triangulated/],
  ['material traversal', OBJ.replace('absent.mtl', '../hidden.mtl'), /material library/],
]) test(`rejects ${name} without discarding source data`, async () => withOBJ(source, async file => assert.rejects(() => readColoredTriangleOBJ(file), pattern)));

test('source content hash must match the acquisition record', async () => withOBJ(OBJ, async file => assert.rejects(() => readColoredTriangleOBJ(file, '0'.repeat(64)), /SHA256 mismatch/)));

test('source per-vertex normals and v//vn indices are retained without regeneration', async () => {
  const source = OBJ.replace('f 3 1 2', 'vn 0 0 1\nvn 0 0 1\nvn 0 0 1\nvn 1 0 0\nf 3//3 1//1 2//2').replace('f 1 1 4', 'f 1//1 1//1 4//4').replace('f 4 2 3', 'f 4//4 2//2 3//3');
  await withOBJ(source, async file => {
    const parsed = await readColoredTriangleOBJ(file);
    assert.deepEqual([...parsed.normals], [0, 0, 1, 0, 0, 1, 0, 0, 1, 1, 0, 0]);
    assert.equal(parsed.evidence.normalsRegenerated, false);
    assert.equal((await compressDocument(documentFromOBJ(parsed))).checks.accessorBytesEqual, true);
  });
  await withOBJ(source.replace('3//3', '3//1'), async file => assert.rejects(() => readColoredTriangleOBJ(file), /Separate or missing normal/));
});

test('rejects leaf and ancestor symlinks', async () => withOBJ(OBJ, async (file, dir) => {
  const link = path.join(dir, 'linked.obj'); await symlink(file, link); await assert.rejects(() => readColoredTriangleOBJ(link), /Symbolic/);
  const child = path.join(dir, 'child'); await mkdir(child); await symlink(child, path.join(dir, 'linked-dir'));
  await assert.rejects(() => checkPath(path.join(dir, 'linked-dir', 'new.glb'), { missingLeaf: true }), /Symbolic/);
}));

test('lossless compression retains exact Float32/color/index bytes and degenerates, decoded independently by Three.js', async () => withOBJ(OBJ, async file => {
  const data = await readColoredTriangleOBJ(file), doc = documentFromOBJ(data);
  const result = await compressDocument(doc);
  assert.equal(result.checks.indexBytesAndCountsEqual, true);
  const glb = parseGLB(result.compressed);
  assert.ok(glb.json.extensionsRequired.includes('EXT_meshopt_compression'));
  assert.ok(glb.json.bufferViews.some(v => v.extensions?.EXT_meshopt_compression?.byteStride === 12));
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const binary = result.compressed.buffer.slice(result.compressed.byteOffset, result.compressed.byteOffset + result.compressed.byteLength);
  const loaded = await new Promise((resolve, reject) => loader.parse(binary, '', resolve, reject));
  let geometry; loaded.scene.traverse(object => { if (object.isMesh) geometry = object.geometry; });
  assert.deepEqual([...geometry.index.array], [...data.indices]);
  assert.deepEqual([...geometry.attributes.position.array], [...data.positions]);
  assert.deepEqual([...geometry.attributes.color.array], [...data.colors]);
  assert.equal(geometry.index.count, 9);
}));

test('Uint16 triangle indices use exact sequence encoding', async () => withOBJ(OBJ, async file => {
  const parsed = await readColoredTriangleOBJ(file), doc = documentFromOBJ(parsed);
  doc.getRoot().listMeshes()[0].listPrimitives()[0].getIndices().setArray(new Uint16Array(parsed.indices));
  const result = await compressDocument(doc);
  assert.ok(parseGLB(result.compressed).json.bufferViews.some(v => v.extensions?.EXT_meshopt_compression?.mode === 'INDICES'));
  assert.equal(result.checks.indexBytesAndCountsEqual, true);
}));

test('multi-mesh accessor declaration renumbering is compared by unchanged semantic bindings', async () => withOBJ(OBJ, async file => {
  const parsed = await readColoredTriangleOBJ(file), doc = documentFromOBJ(parsed), root = doc.getRoot(), buffer = root.listBuffers()[0];
  const p = doc.createPrimitive().setMode(4).setAttribute('POSITION', doc.createAccessor('second-position').setType('VEC3').setArray(new Float32Array(parsed.positions)).setBuffer(buffer)).setIndices(doc.createAccessor('second-indices').setType('SCALAR').setArray(new Uint32Array(parsed.indices)).setBuffer(buffer));
  const second = doc.createMesh('second').addPrimitive(p); root.listScenes()[0].addChild(doc.createNode('second').setMesh(second));
  const result = await compressDocument(doc);
  assert.equal(result.snapshot.totals.meshCount, 2); assert.equal(result.checks.accessorBytesEqual, true);
}));

test('embedded texture bytes and exact source matrix representation survive', async () => withOBJ(OBJ, async file => {
  const doc = documentFromOBJ(await readColoredTriangleOBJ(file));
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a7ioAAAAASUVORK5CYII=', 'base64');
  const texture = doc.createTexture('synthetic-pixel').setMimeType('image/png').setImage(png);
  doc.getRoot().listMaterials()[0].setBaseColorTexture(texture);
  const io = await createIO(), raw = parseGLB(await io.writeBinary(doc));
  raw.json.nodes[0].matrix = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 1.123456789012345, 2, 3, 1];
  const sourceBytes = packGLB(raw.json, raw.binary), source = await io.readBinary(sourceBytes);
  const result = await compressDocument(source, raw.json);
  assert.deepEqual(parseGLB(result.compressed).json.nodes[0].matrix, raw.json.nodes[0].matrix);
  assert.equal(result.snapshot.textures[0].sha256, sha256(png));
  assert.equal(result.checks.rawJSONTransformEquality, true);
}));

test('corrupt GLB length, external URI and oversized decoding claims fail closed', async () => withOBJ(OBJ, async file => {
  const io = await createIO(), original = Buffer.from(await io.writeBinary(documentFromOBJ(await readColoredTriangleOBJ(file))));
  const corrupt = Buffer.from(original); corrupt.writeUInt32LE(corrupt.length + 4, 8); assert.throws(() => parseGLB(corrupt), /header\/length/);
  const external = parseGLB(original); external.json.buffers[0].uri = 'https://example.invalid/data.bin'; assert.throws(() => parseGLB(packGLB(external.json, external.binary)), /URI/);
  const huge = parseGLB(original); huge.json.bufferViews[0].byteLength = 900_000_000; assert.throws(() => parseGLB(packGLB(huge.json, huge.binary)), /oversized/);
}));

test('decoded NaN positions and bad index buffers are rejected', async () => withOBJ(OBJ, async file => {
  const parsed = await readColoredTriangleOBJ(file), doc = documentFromOBJ(parsed);
  parsed.positions[0] = NaN; assert.throws(() => snapshotDocument(doc), /Nonfinite/);
  parsed.positions[0] = 0; parsed.indices[0] = 99; assert.throws(() => snapshotDocument(doc), /out of bounds/);
}));

test('preservation comparator rejects a changed color, index or transform', async () => withOBJ(OBJ, async file => {
  const doc = documentFromOBJ(await readColoredTriangleOBJ(file)), baseline = snapshotDocument(doc);
  for (const [field, mutate] of [
    ['accessors', x => { x.accessors[0].sha256 = '0'.repeat(64); }],
    ['meshes', x => { x.meshes[0].primitives[0].mode = 0; }],
    ['nodes', x => { x.nodes[0].matrix[12] = 999; }],
  ]) { const changed = structuredClone(baseline); mutate(changed); assert.throws(() => assertPreserved(baseline, changed), new RegExp(field)); }
}));

test('decompression is hash-bound, verified and refuses overwrite', async () => withOBJ(OBJ, async (file, dir) => {
  const result = await compressDocument(documentFromOBJ(await readColoredTriangleOBJ(file)));
  const compressed = path.join(dir, 'source.glb'), output = path.join(dir, 'decoded.glb'); await writeFile(compressed, result.compressed);
  await assert.rejects(() => decompressFile(compressed, output, '0'.repeat(64)), /SHA256 mismatch/);
  const report = await decompressFile(compressed, output, sha256(result.compressed)); assert.equal(report.checks.accessorBytesEqual, true);
  const data = await readFile(output); assert.ok(!parseGLB(data).json.extensionsUsed?.includes('EXT_meshopt_compression'));
  await assert.rejects(() => decompressFile(compressed, output, sha256(result.compressed)), /EEXIST/);
  await readGLB(output, report.sha256);
}));

test('noncommercial asset is excluded from the public-bundle pipeline', async () => withOBJ(OBJ, async (file, dir) => {
  await assert.rejects(() => buildAsset({ id: 'synthetic', format: 'obj', path: file, bytes: Buffer.byteLength(OBJ), sha256: sha256(Buffer.from(OBJ)), license: 'CC-BY-NC-4.0', creator: 'Synthetic fixture', url: 'https://example.invalid/source', rightsReviewed: true, rightsNote: 'Test fixture' }, path.join(dir, 'output')), /noncommercial/);
}));
