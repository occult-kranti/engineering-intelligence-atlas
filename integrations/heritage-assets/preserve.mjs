import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { lstat, readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { createInterface } from 'node:readline';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { Document, NodeIO, Primitive } from '@gltf-transform/core';
import { EXTMeshoptCompression, KHRMaterialsUnlit, KHRMeshQuantization, EXTTextureWebP } from '@gltf-transform/extensions';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';

export const LIMITS = Object.freeze({ sourceBytes: 600 * 1024 ** 2, vertices: 3_000_000, triangles: 6_000_000, lineBytes: 2048, decodedViewBytes: 240 * 1024 ** 2, totalDecodedBytes: 600 * 1024 ** 2, targetBytes: 25 * 1024 ** 2 });
const ID = /^[a-z0-9][a-z0-9-]{0,79}$/;
const SHA = /^[a-f0-9]{64}$/;
const NUMBER = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;
const SUPPORTED = new Set(['EXT_meshopt_compression', 'KHR_materials_unlit', 'KHR_mesh_quantization', 'EXT_texture_webp']);
const TRANSFORM_KEYS = ['matrix', 'translation', 'rotation', 'scale'];

function requireThat(ok, message) { if (!ok) throw new Error(message); }
export function sha256(bytes) { return createHash('sha256').update(bytes).digest('hex'); }
const bytesOf = array => new Uint8Array(array.buffer, array.byteOffset, array.byteLength);

/** Reject links in every existing path component. Content hashes additionally bind source bytes. */
export async function checkPath(filename, { missingLeaf = false } = {}) {
  requireThat(typeof filename === 'string' && path.isAbsolute(filename) && !filename.includes('\0'), 'Expected absolute local path');
  requireThat(!filename.split(path.sep).some(x => x === '..' || x === '.'), 'Path traversal is not accepted');
  let cursor = path.parse(filename).root;
  const parts = filename.slice(cursor.length).split(path.sep).filter(Boolean);
  for (let i = 0; i < parts.length; i++) {
    cursor = path.join(cursor, parts[i]);
    let info;
    try { info = await lstat(cursor); } catch (error) {
      if (error.code === 'ENOENT' && missingLeaf && i === parts.length - 1) return;
      throw error;
    }
    requireThat(!info.isSymbolicLink(), `Symbolic links are not accepted: ${cursor}`);
    if (i < parts.length - 1) requireThat(info.isDirectory(), 'Non-directory path ancestor');
  }
}

async function sourceInfo(filename, expectedHash) {
  await checkPath(filename);
  const info = await stat(filename);
  requireThat(info.isFile() && info.size > 0 && info.size <= LIMITS.sourceBytes, 'Source must be a bounded regular file');
  if (expectedHash !== undefined) requireThat(SHA.test(expectedHash), 'Expected SHA256 is required');
  return info;
}

async function scanLines(filename, callback) {
  const stream = createReadStream(filename);
  const hash = createHash('sha256');
  let sourceBytes = 0;
  stream.on('data', chunk => {
    sourceBytes += chunk.length;
    if (sourceBytes > LIMITS.sourceBytes) stream.destroy(new Error('Source grew beyond the byte limit'));
    else hash.update(chunk);
  });
  const lines = createInterface({ input: stream, crlfDelay: Infinity });
  let lineNumber = 0;
  try {
    for await (let line of lines) {
      lineNumber++;
      requireThat(Buffer.byteLength(line) <= LIMITS.lineBytes, `OBJ line ${lineNumber} exceeds bound`);
      line = line.split('#', 1)[0].trim();
      if (line) callback(line.split(/\s+/), lineNumber);
    }
  } finally { lines.close(); stream.destroy(); }
  return hash.digest('hex');
}

function finiteDecimal(token, label) {
  requireThat(NUMBER.test(token), `Invalid ${label} decimal`);
  const value = Number(token);
  requireThat(Number.isFinite(value) && Number.isFinite(Math.fround(value)), `Nonfinite or Float32-overflow ${label}`);
  return value;
}

function precisionAccumulator() {
  return { maxAbsoluteError: [0, 0, 0], squaredError: [0, 0, 0], worstExamples: [null, null, null], maxFloat64ParsingBound: 0, count: 0 };
}
function trackPrecision(acc, tokens, values) {
  acc.count++;
  for (let axis = 0; axis < 3; axis++) {
    const value = values[axis], rounded = Math.fround(value), error = Math.abs(rounded - value);
    acc.squaredError[axis] += error * error;
    acc.maxFloat64ParsingBound = Math.max(acc.maxFloat64ParsingBound, Math.abs(value) * Number.EPSILON);
    if (error > acc.maxAbsoluteError[axis]) {
      acc.maxAbsoluteError[axis] = error;
      acc.worstExamples[axis] = { decimal: tokens[axis], parsedFloat64: value, float32: rounded, absoluteError: error };
    }
  }
}
function finishPrecision(acc) {
  return { storage: 'IEEE754 Float32', comparison: 'Source decimal parsed as nearest IEEE754 Float64, then Math.fround; parsing bound retained separately.', decimalToFloat32IsLossless: false, sampleCount: acc.count, maxAbsoluteErrorPerAxis: acc.maxAbsoluteError, rmsErrorPerAxis: acc.squaredError.map(x => Math.sqrt(x / acc.count)), conservativeFloat64ParsingBound: acc.maxFloat64ParsingBound, worstExamples: acc.worstExamples };
}

/** Narrow reviewed OBJ subset. Per-vertex normals are retained; unsupported UV/separate-index/polygon data fails. */
export async function readColoredTriangleOBJ(filename, expectedHash) {
  const initial = await sourceInfo(filename, expectedHash);
  let vertexCount = 0, triangleCount = 0, normalCount = 0;
  const materialLibraries = new Set(), materialNames = new Set();
  const firstHash = await scanLines(filename, (tokens, line) => {
    const [kind, ...rest] = tokens;
    if (kind === 'v') {
      requireThat(rest.length === 6, `OBJ line ${line}: expected XYZ and RGB, without homogeneous W`);
      requireThat(++vertexCount <= LIMITS.vertices, 'Vertex limit exceeded');
    } else if (kind === 'vn') {
      requireThat(rest.length === 3, `OBJ line ${line}: expected three normal components`);
      requireThat(++normalCount <= LIMITS.vertices, 'Normal limit exceeded');
    } else if (kind === 'f') {
      requireThat(rest.length === 3, `OBJ line ${line}: only already-triangulated faces are supported`);
      requireThat(++triangleCount <= LIMITS.triangles, 'Triangle limit exceeded');
    } else if (kind === 'mtllib') {
      requireThat(rest.length === 1 && /^[A-Za-z0-9._ -]{1,150}$/.test(rest[0]) && !rest[0].includes('..'), 'Unsafe or unsupported material library reference');
      materialLibraries.add(rest[0]);
    } else if (kind === 'usemtl') {
      requireThat(rest.length === 1 && rest[0].length <= 150, 'Unsupported material name');
      materialNames.add(rest[0]);
    } else requireThat(['o', 'g', 's'].includes(kind), `Unsupported OBJ record ${kind} at line ${line}; no data discarded`);
  });
  requireThat(vertexCount > 0 && triangleCount > 0, 'OBJ requires vertices and triangular faces');
  requireThat(normalCount === 0 || normalCount === vertexCount, 'Only one normal per source vertex is supported; no normals discarded');
  requireThat(!expectedHash || firstHash === expectedHash, 'Source SHA256 mismatch');
  const positions = new Float32Array(vertexCount * 3), colors = new Float32Array(vertexCount * 3), indices = new Uint32Array(triangleCount * 3);
  const normals = normalCount ? new Float32Array(normalCount * 3) : null;
  const positionPrecision = precisionAccumulator(), colorPrecision = precisionAccumulator(), normalPrecision = precisionAccumulator();
  const sourceMin = [Infinity, Infinity, Infinity], sourceMax = [-Infinity, -Infinity, -Infinity];
  let v = 0, f = 0, n = 0;
  const secondHash = await scanLines(filename, tokens => {
    if (tokens[0] === 'v') {
      requireThat(v < vertexCount, 'Source changed during conversion');
      const values = tokens.slice(1).map((x, index) => finiteDecimal(x, index < 3 ? 'position' : 'color'));
      requireThat(values.slice(3).every(x => x >= 0 && x <= 1), 'Vertex RGB must be within [0,1]');
      positions.set(values.slice(0, 3), v * 3); colors.set(values.slice(3), v * 3);
      trackPrecision(positionPrecision, tokens.slice(1, 4), values.slice(0, 3));
      trackPrecision(colorPrecision, tokens.slice(4, 7), values.slice(3));
      for (let axis = 0; axis < 3; axis++) { sourceMin[axis] = Math.min(sourceMin[axis], values[axis]); sourceMax[axis] = Math.max(sourceMax[axis], values[axis]); }
      v++;
    } else if (tokens[0] === 'vn') {
      requireThat(n < normalCount, 'Source changed during conversion');
      const values = tokens.slice(1).map(x => finiteDecimal(x, 'normal'));
      normals.set(values, n * 3); trackPrecision(normalPrecision, tokens.slice(1), values); n++;
    } else if (tokens[0] === 'f') {
      requireThat(f < triangleCount, 'Source changed during conversion');
      for (let corner = 0; corner < 3; corner++) {
        const match = /^([1-9][0-9]*)(?:\/\/([1-9][0-9]*))?$/.exec(tokens[corner + 1]);
        requireThat(match, 'Only positive vertex indices or reviewed v//vn references are supported');
        const index = Number(match[1]);
        requireThat(Number.isSafeInteger(index) && index <= vertexCount, 'OBJ index out of bounds');
        requireThat(normalCount ? Number(match[2]) === index : match[2] === undefined, 'Separate or missing normal indices are unsupported; no vertex expansion or normal regeneration allowed');
        indices[f * 3 + corner] = index - 1;
      }
      f++;
    }
  });
  const final = await stat(filename);
  requireThat(v === vertexCount && f === triangleCount && n === normalCount && firstHash === secondHash && initial.size === final.size && initial.ino === final.ino, 'Source changed during conversion');
  let repeatedIndexTriangles = 0, zeroAreaFloat32Triangles = 0;
  for (let offset = 0; offset < indices.length; offset += 3) {
    const a = indices[offset], b = indices[offset + 1], c = indices[offset + 2];
    if (a === b || b === c || a === c) repeatedIndexTriangles++;
    const u = [0, 1, 2].map(i => positions[b * 3 + i] - positions[a * 3 + i]);
    const w = [0, 1, 2].map(i => positions[c * 3 + i] - positions[a * 3 + i]);
    if (u[1] * w[2] === u[2] * w[1] && u[2] * w[0] === u[0] * w[2] && u[0] * w[1] === u[1] * w[0]) zeroAreaFloat32Triangles++;
  }
  return { positions, colors, normals, indices, evidence: { sourceSha256: firstHash, sourceBytes: initial.size, vertices: vertexCount, triangles: triangleCount, indexCount: indices.length, repeatedIndexTriangles, zeroAreaFloat32Triangles, allFacesRetained: true, sourceBounds: { min: sourceMin, max: sourceMax, dimensions: sourceMax.map((x, i) => x - sourceMin[i]), units: 'unverified source coordinate units' }, precision: { position: finishPrecision(positionPrecision), color: finishPrecision(colorPrecision), normal: normalCount ? finishPrecision(normalPrecision) : null }, coordinateRescale: false, axisConversion: false, vertexReordering: false, indexReordering: false, uvPresent: false, normalsPresent: normalCount > 0, normalsRegenerated: false, materialLibraries: [...materialLibraries], materialNames: [...materialNames], materialFilesLoaded: false, materialNotice: 'Referenced MTL files are not loaded; no UV records or textures are supplied. RGB numbers are retained without a color-space conversion; source color space is unverified.' } };
}

export function documentFromOBJ(parsed, provenance = {}) {
  const doc = new Document(), buffer = doc.createBuffer('source-buffers');
  const position = doc.createAccessor('source-position').setType('VEC3').setArray(parsed.positions).setBuffer(buffer);
  const color = doc.createAccessor('source-color').setType('VEC3').setArray(parsed.colors).setBuffer(buffer);
  const index = doc.createAccessor('source-indices').setType('SCALAR').setArray(parsed.indices).setBuffer(buffer);
  const unlit = doc.createExtension(KHRMaterialsUnlit);
  const material = doc.createMaterial('source-vertex-rgb').setBaseColorFactor([1, 1, 1, 1]).setDoubleSided(true).setExtension('KHR_materials_unlit', unlit.createUnlit());
  const primitive = doc.createPrimitive().setMode(Primitive.Mode.TRIANGLES).setAttribute('POSITION', position).setAttribute('COLOR_0', color).setIndices(index).setMaterial(material);
  if (parsed.normals) primitive.setAttribute('NORMAL', doc.createAccessor('source-normal').setType('VEC3').setArray(parsed.normals).setBuffer(buffer));
  const mesh = doc.createMesh(provenance.id || 'source-mesh').addPrimitive(primitive);
  const node = doc.createNode('source-coordinates-unchanged').setMesh(mesh);
  doc.createScene('source-scene').addChild(node);
  Object.assign(doc.getRoot().getAsset(), { copyright: provenance.creator || '', extras: { source: provenance.url || '', license: provenance.license || '', sourceSha256: parsed.evidence.sourceSha256, sourceCoordinateUnits: 'unverified', conversion: 'XYZ and RGB to Float32; indices exactly preserved; no rescale, reordering, simplification, UV creation or invented detail.' } });
  return doc;
}

// TRIANGLES codec may rotate triples. Encode each Uint32 triple as one lossless
// 12-byte ATTRIBUTES element instead. Uint16 index buffers use the exact INDICES
// sequence codec. This is a codec/layout choice, not a primitive-mode change.
const exactEncoder = {
  ...MeshoptEncoder,
  encodeGltfBuffer(source, count, stride, mode) {
    if (mode === 'TRIANGLES') {
      requireThat(count % 3 === 0, 'Invalid triangle index count');
      if (stride === 4) return MeshoptEncoder.encodeGltfBuffer(source, count / 3, 12, 'ATTRIBUTES');
      requireThat(stride === 2, 'Unsupported index component size');
      return MeshoptEncoder.encodeGltfBuffer(source, count, stride, 'INDICES');
    }
    return MeshoptEncoder.encodeGltfBuffer(source, count, stride, mode);
  },
};

export class ExactMeshoptCompression extends EXTMeshoptCompression {
  write(context) {
    super.write(context);
    for (const view of context.jsonDoc.json.bufferViews || []) {
      const ext = view.extensions?.EXT_meshopt_compression;
      if (ext?.mode !== 'TRIANGLES') continue;
      if (ext.byteStride === 4) { ext.mode = 'ATTRIBUTES'; ext.count /= 3; ext.byteStride = 12; }
      else { requireThat(ext.byteStride === 2, 'Unsupported index component size'); ext.mode = 'INDICES'; }
    }
    return this;
  }
}

export async function createIO() {
  await Promise.all([MeshoptEncoder.ready, MeshoptDecoder.ready]);
  return new NodeIO().registerExtensions([ExactMeshoptCompression, KHRMaterialsUnlit, KHRMeshQuantization, EXTTextureWebP])
    .registerDependencies({ 'meshopt.encoder': exactEncoder, 'meshopt.decoder': MeshoptDecoder });
}

export function parseGLB(input) {
  const b = Buffer.from(input.buffer, input.byteOffset, input.byteLength);
  requireThat(b.length >= 20 && b.length <= LIMITS.sourceBytes && b.toString('ascii', 0, 4) === 'glTF' && b.readUInt32LE(4) === 2 && b.readUInt32LE(8) === b.length, 'Invalid GLB header/length');
  let offset = 12, json = null, binary = null;
  while (offset < b.length) {
    requireThat(offset + 8 <= b.length, 'Truncated GLB chunk header');
    const size = b.readUInt32LE(offset), type = b.readUInt32LE(offset + 4); offset += 8;
    requireThat(size % 4 === 0 && offset + size <= b.length, 'Invalid GLB chunk length');
    if (type === 0x4e4f534a) { requireThat(!json && !binary && size <= 8 * 1024 ** 2, 'Invalid/oversized JSON chunk'); json = JSON.parse(b.subarray(offset, offset + size).toString('utf8')); }
    else if (type === 0x004e4942) { requireThat(json && !binary, 'Invalid BIN chunk order'); binary = b.subarray(offset, offset + size); }
    else throw new Error('Unreviewed GLB chunk type');
    offset += size;
  }
  requireThat(json && binary && json.asset?.version === '2.0', 'GLB JSON/BIN missing');
  for (const ext of json.extensionsUsed || []) requireThat(SUPPORTED.has(ext), `Unsupported extension ${ext}; refusing silent data loss`);
  for (const ext of json.extensionsRequired || []) requireThat(SUPPORTED.has(ext), `Unsupported required extension ${ext}`);
  requireThat(!(json.animations?.length || json.skins?.length || json.cameras?.length), 'Only reviewed static mesh scenes are supported');
  for (const node of json.nodes || []) for (const key of TRANSFORM_KEYS) if (key in node) {
    const size = key === 'matrix' ? 16 : key === 'rotation' ? 4 : 3;
    requireThat(Array.isArray(node[key]) && node[key].length === size && node[key].every(Number.isFinite), 'Invalid/nonfinite node transform');
  }
  for (const accessor of json.accessors || []) {
    requireThat(!accessor.sparse && Number.isSafeInteger(accessor.count) && accessor.count > 0 && accessor.count <= LIMITS.triangles * 3, 'Unsupported/oversized accessor');
  }
  for (const field of ['buffers', 'images']) for (const value of json[field] || []) requireThat(!('uri' in value), 'External/data URI resources are not supported');
  let totalDecoded = 0;
  for (const view of json.bufferViews || []) {
    requireThat(Number.isSafeInteger(view.byteLength) && view.byteLength >= 0 && view.byteLength <= LIMITS.decodedViewBytes, 'Invalid/oversized buffer view');
    const ext = view.extensions?.EXT_meshopt_compression;
    if (ext) {
      requireThat(Number.isSafeInteger(ext.count) && ext.count >= 0 && Number.isSafeInteger(ext.byteStride) && ext.byteStride > 0 && ext.byteStride <= 256 && ext.count * ext.byteStride === view.byteLength, 'Invalid meshopt decoded size');
      requireThat(['ATTRIBUTES', 'TRIANGLES', 'INDICES'].includes(ext.mode), 'Invalid meshopt mode');
      requireThat(ext.buffer === 0 && Number.isSafeInteger(ext.byteLength) && ext.byteLength > 0 && Number.isSafeInteger(ext.byteOffset || 0) && (ext.byteOffset || 0) >= 0 && (ext.byteOffset || 0) + ext.byteLength <= binary.length, 'Meshopt source out of bounds');
    } else requireThat(view.buffer === 0 && Number.isSafeInteger(view.byteOffset || 0) && (view.byteOffset || 0) >= 0 && (view.byteOffset || 0) + view.byteLength <= binary.length, 'Buffer view out of bounds');
    totalDecoded += view.byteLength;
    requireThat(totalDecoded <= LIMITS.totalDecodedBytes, 'Decoded allocation bound exceeded');
  }
  return { json, binary };
}

export function packGLB(json, binary) {
  const raw = Buffer.from(JSON.stringify(json)), jsonSize = (raw.length + 3) & ~3, binSize = (binary.length + 3) & ~3;
  const b = Buffer.alloc(12 + 8 + jsonSize + 8 + binSize);
  b.write('glTF'); b.writeUInt32LE(2, 4); b.writeUInt32LE(b.length, 8);
  b.writeUInt32LE(jsonSize, 12); b.writeUInt32LE(0x4e4f534a, 16); b.fill(0x20, 20, 20 + jsonSize); raw.copy(b, 20);
  b.writeUInt32LE(binSize, 20 + jsonSize); b.writeUInt32LE(0x004e4942, 24 + jsonSize); Buffer.from(binary).copy(b, 28 + jsonSize);
  return b;
}

function rawTransforms(json) { return (json.nodes || []).map(node => Object.fromEntries(TRANSFORM_KEYS.filter(k => k in node).map(k => [k, node[k]]))); }

/** NodeIO decomposes matrices; restore source JSON transforms exactly, without changing hierarchy. */
export function preserveRawTransforms(bytes, originalJSON) {
  if (!originalJSON) return Buffer.from(bytes);
  const { json, binary } = parseGLB(bytes);
  requireThat((json.nodes || []).length === (originalJSON.nodes || []).length, 'Node count changed');
  for (let i = 0; i < (json.nodes || []).length; i++) {
    const source = originalJSON.nodes[i], target = json.nodes[i];
    requireThat(isDeepStrictEqual(source.children || [], target.children || []) && source.mesh === target.mesh, 'Node association changed');
    for (const key of TRANSFORM_KEYS) { delete target[key]; if (key in source) target[key] = structuredClone(source[key]); }
  }
  requireThat(isDeepStrictEqual(rawTransforms(json), rawTransforms(originalJSON)), 'Transform preservation failed');
  return packGLB(json, binary);
}

export function snapshotDocument(doc) {
  const root = doc.getRoot(), nodes = root.listNodes(), meshes = root.listMeshes(), textures = root.listTextures(), materials = root.listMaterials();
  // Writers may renumber accessor declarations while retaining each mesh binding.
  // Compare by deterministic mesh/primitive/semantic identity, never by an incidental
  // JSON declaration index. Shared accessor identity and every byte remain checked.
  const accessors = [], seen = new Set();
  const add = accessor => { if (accessor && !seen.has(accessor)) { seen.add(accessor); accessors.push(accessor); } };
  for (const mesh of meshes) for (const primitive of mesh.listPrimitives()) {
    requireThat(primitive.listTargets().length === 0, 'Morph targets require a separate reviewed preservation contract');
    for (const semantic of primitive.listSemantics().sort()) add(primitive.getAttribute(semantic));
    add(primitive.getIndices());
  }
  const unused = root.listAccessors().filter(a => !seen.has(a));
  unused.sort((a, b) => `${a.getName()}:${a.getType()}:${sha256(bytesOf(a.getArray()))}`.localeCompare(`${b.getName()}:${b.getType()}:${sha256(bytesOf(b.getArray()))}`));
  unused.forEach(add);
  const aIndex = a => a ? accessors.indexOf(a) : null;
  const attributeRecords = accessors.map(a => {
    const data = a.getArray(); requireThat(data && data.length > 0, 'Empty accessor');
    for (const value of data) requireThat(Number.isFinite(value), 'Nonfinite accessor data');
    return { name: a.getName(), type: a.getType(), componentType: a.getComponentType(), normalized: a.getNormalized(), count: a.getCount(), bytes: data.byteLength, sha256: sha256(bytesOf(data)) };
  });
  let vertices = 0, triangles = 0, repeatedIndexTriangles = 0;
  const meshRecords = meshes.map(mesh => ({ name: mesh.getName(), primitives: mesh.listPrimitives().map(p => {
    const position = p.getAttribute('POSITION'), index = p.getIndices();
    requireThat(position && position.getType() === 'VEC3' && p.getMode() === Primitive.Mode.TRIANGLES, 'Expected static triangle positions');
    requireThat(index && index.getType() === 'SCALAR' && !index.getNormalized() && [5123, 5125].includes(index.getComponentType()), 'Expected unsigned indexed triangles');
    const values = index.getArray(); requireThat(values.length % 3 === 0, 'Triangle index count not divisible by three');
    for (const value of values) requireThat(Number.isInteger(value) && value >= 0 && value < position.getCount(), 'Index out of bounds');
    for (const attribute of p.listAttributes()) requireThat(attribute.getCount() === position.getCount(), 'Attribute vertex count mismatch');
    for (let i = 0; i < values.length; i += 3) if (values[i] === values[i + 1] || values[i + 1] === values[i + 2] || values[i] === values[i + 2]) repeatedIndexTriangles++;
    vertices += position.getCount(); triangles += values.length / 3;
    return { mode: p.getMode(), indices: aIndex(index), attributes: Object.fromEntries(p.listSemantics().sort().map(key => [key, aIndex(p.getAttribute(key))])), material: materials.indexOf(p.getMaterial()), targets: p.listTargets().length };
  }) }));
  const textureIndex = x => x ? textures.indexOf(x) : null;
  for (const node of nodes) requireThat(node.getMatrix().every(Number.isFinite), 'Nonfinite node matrix');
  return { accessors: attributeRecords, meshes: meshRecords, textures: textures.map(t => ({ name: t.getName(), mimeType: t.getMimeType(), bytes: t.getImage()?.byteLength || 0, sha256: sha256(t.getImage() || new Uint8Array()) })), materials: materials.map(m => ({ name: m.getName(), baseColorFactor: m.getBaseColorFactor(), emissiveFactor: m.getEmissiveFactor(), metallicFactor: m.getMetallicFactor(), roughnessFactor: m.getRoughnessFactor(), alphaMode: m.getAlphaMode(), alphaCutoff: m.getAlphaCutoff(), doubleSided: m.getDoubleSided(), baseColorTexture: textureIndex(m.getBaseColorTexture()), emissiveTexture: textureIndex(m.getEmissiveTexture()), normalTexture: textureIndex(m.getNormalTexture()), occlusionTexture: textureIndex(m.getOcclusionTexture()), metallicRoughnessTexture: textureIndex(m.getMetallicRoughnessTexture()), extensions: m.listExtensions().map(x => x.extensionName).sort() })), nodes: nodes.map(n => ({ name: n.getName(), matrix: n.getMatrix(), children: n.listChildren().map(x => nodes.indexOf(x)), mesh: n.getMesh() ? meshes.indexOf(n.getMesh()) : null })), scenes: root.listScenes().map(s => ({ name: s.getName(), children: s.listChildren().map(x => nodes.indexOf(x)) })), totals: { meshCount: meshes.length, nodeCount: nodes.length, vertexEntries: vertices, triangles, indices: triangles * 3, repeatedIndexTriangles } };
}

export function assertPreserved(before, after) {
  for (const field of ['accessors', 'meshes', 'textures', 'materials', 'nodes', 'scenes', 'totals']) requireThat(isDeepStrictEqual(before[field], after[field]), `Preservation failure: ${field}`);
  return { accessorBytesEqual: true, indexBytesAndCountsEqual: true, textureBytesEqual: true, materialPropertiesEqual: true, nodeTransformsEqual: true, hierarchyEqual: true, primitiveModesEqual: true, noDecimation: true, noQuantizeTransform: true, noLossyFilters: true };
}

export async function compressDocument(doc, originalJSON = null) {
  const io = await createIO();
  const before = snapshotDocument(doc);
  const existing = doc.getRoot().listExtensionsUsed().find(x => x.extensionName === 'EXT_meshopt_compression');
  if (existing) existing.dispose();
  const decompressed = preserveRawTransforms(await io.writeBinary(doc), originalJSON);
  // Compare a fresh decode to the pre-write data before any compressed output is accepted.
  assertPreserved(before, snapshotDocument(await io.readBinary(decompressed)));
  doc.createExtension(ExactMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE });
  const compressed = preserveRawTransforms(await io.writeBinary(doc), originalJSON);
  const parsed = parseGLB(compressed);
  for (const view of parsed.json.bufferViews || []) {
    const ext = view.extensions?.EXT_meshopt_compression;
    if (ext) requireThat(!ext.filter || ext.filter === 'NONE', 'Lossy compression filter rejected');
  }
  const after = snapshotDocument(await io.readBinary(compressed));
  const checks = assertPreserved(before, after);
  if (originalJSON) requireThat(isDeepStrictEqual(rawTransforms(originalJSON), rawTransforms(parsed.json)), 'Raw transform values changed');
  return { compressed, decompressed, snapshot: before, checks: { ...checks, rawJSONTransformEquality: originalJSON ? true : null }, compression: { extension: 'EXT_meshopt_compression', encoderMethod: 'QUANTIZE', quantizeTransformApplied: false, indices: 'Uint32 triangle triples: ATTRIBUTES/12-byte grouping; Uint16: INDICES sequence; exact order retained', filters: 'NONE', encoderVersion: '1.2.0', gltfTransformVersion: '4.5.1' } };
}

export async function readGLB(filename, expectedHash) {
  await sourceInfo(filename, expectedHash);
  const bytes = await readFile(filename);
  requireThat(!expectedHash || sha256(bytes) === expectedHash, 'Source SHA256 mismatch');
  const parsed = parseGLB(bytes), io = await createIO();
  const doc = await io.readBinary(bytes);
  snapshotDocument(doc); // finite/index validation, including existing quantized context derivatives.
  return { bytes, json: parsed.json, doc };
}

function validateEntry(entry) {
  requireThat(entry && ID.test(entry.id) && ['obj', 'glb', 'inspect-glb'].includes(entry.format), 'Invalid asset identity/format');
  requireThat(SHA.test(entry.sha256) && Number.isSafeInteger(entry.bytes) && entry.bytes > 0 && entry.bytes <= LIMITS.sourceBytes, 'Asset SHA256/size required');
  requireThat(['CC-BY-4.0', 'CC0-1.0'].includes(entry.license), 'This public-bundle pipeline excludes unlicensed and noncommercial assets');
  requireThat(typeof entry.creator === 'string' && entry.creator.trim() && typeof entry.url === 'string' && entry.url.startsWith('https://'), 'Source creator and HTTPS record required');
  requireThat(entry.rightsReviewed === true && typeof entry.rightsNote === 'string' && entry.rightsNote.trim(), 'Explicit rights review note required');
  if (entry.reviewedWebLimitBytes !== undefined) requireThat(Number.isSafeInteger(entry.reviewedWebLimitBytes) && entry.reviewedWebLimitBytes > 0 && entry.reviewedWebLimitBytes <= 64 * 1024 ** 2 && typeof entry.budgetReview === 'string' && entry.budgetReview.trim(), 'Reviewed budget exception requires a bounded value and reason');
}

export async function buildAsset(entry, outputDirectory) {
  validateEntry(entry);
  const info = await sourceInfo(entry.path, entry.sha256); requireThat(info.size === entry.bytes, 'Source size mismatch');
  let doc, originalJSON = null, conversion = null;
  if (entry.format === 'obj') {
    const parsed = await readColoredTriangleOBJ(entry.path, entry.sha256); conversion = parsed.evidence;
    doc = documentFromOBJ(parsed, entry);
  } else {
    const source = await readGLB(entry.path, entry.sha256); doc = source.doc; originalJSON = source.json;
  }
  const sourceSnapshot = snapshotDocument(doc);
  let result;
  if (entry.format === 'inspect-glb') {
    const io = await createIO();
    const ext = doc.getRoot().listExtensionsUsed().find(x => x.extensionName === 'EXT_meshopt_compression'); if (ext) ext.dispose();
    const decompressed = preserveRawTransforms(await io.writeBinary(doc), originalJSON);
    const checks = assertPreserved(sourceSnapshot, snapshotDocument(await io.readBinary(decompressed)));
    result = { compressed: await readFile(entry.path), decompressed, snapshot: sourceSnapshot, checks, compression: { existingBytesPreserved: true, processing: 'Existing meshopt/WebP/quantization preserved; decoded data compared only to supplied processed derivative, not to an unavailable pre-quantization source.' } };
  } else result = await compressDocument(doc, originalJSON);
  await checkPath(outputDirectory, { missingLeaf: true }); await mkdir(outputDirectory, { mode: 0o700 });
  const webName = `${entry.id}.glb`, decodedName = `${entry.id}.decompressed.glb`;
  await writeFile(path.join(outputDirectory, webName), result.compressed, { flag: 'wx' });
  await writeFile(path.join(outputDirectory, decodedName), result.decompressed, { flag: 'wx' });
  const receipt = { schemaVersion: 1, id: entry.id, source: entry, conversion, compression: result.compression, preservation: result.checks, sourceSnapshot: result.snapshot, output: { web: { file: webName, bytes: result.compressed.byteLength, sha256: sha256(result.compressed) }, blenderReady: { file: decodedName, bytes: result.decompressed.byteLength, sha256: sha256(result.decompressed), note: 'No meshopt extension remains. Blender import can change face counts; prior OBJ imports removed 11/12 church/mosque faces for an unverified cause. This decoded GLB retains every source index.' } }, sizeTarget: { bytes: LIMITS.targetBytes, met: result.compressed.byteLength <= LIMITS.targetBytes }, assetAudit: { guidance: ['OpenCodeGameStudios asset-audit', 'OpenCodeGameStudios asset-spec'], scope: 'Applied checks, not the entire upstream workflow or an imported permission grant.', naming: 'Stable lowercase hyphenated site IDs from the approved brief.', specification: 'Preserve all source positions, vertex RGB, indices, texture bytes and transforms; no simplification or invented detail.', formatChecked: true, sourceHashMatched: true, missingReferences: conversion ? conversion.materialLibraries.map(name => ({ name, status: 'referenced MTL not supplied or loaded' })) : [], generatedFilesReferencedByReceipt: true, sizeBudgetBytes: LIMITS.targetBytes, artBible: 'No upstream project art bible exists; the approved source-preservation brief governs.', shaderNotice: conversion ? 'Unlit vertex-color material; no inferred source color-space conversion.' : 'Source material properties retained.' }, scaleVerified: false, coordinateUnits: 'unverified source units; no rescaling performed', generatedAt: new Date().toISOString() };
  const reviewedLimit = entry.reviewedWebLimitBytes ?? LIMITS.targetBytes;
  receipt.releaseBudget = { bytes: reviewedLimit, met: result.compressed.byteLength <= reviewedLimit, review: entry.budgetReview || 'Original 25 MiB target; no exception.' };
  receipt.output.blenderReady.note = 'Meshopt removed and decoded accessors verified. Editor import may change topology; consult the separate actual editor receipt. No face-removal cause is inferred.';
  await writeFile(path.join(outputDirectory, 'receipt.json'), JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' });
  return receipt;
}

export async function decompressFile(input, output, expectedHash) {
  requireThat(SHA.test(expectedHash), 'Decompression requires expected SHA256');
  await checkPath(output, { missingLeaf: true });
  const { doc, json } = await readGLB(input, expectedHash), io = await createIO(), before = snapshotDocument(doc);
  const ext = doc.getRoot().listExtensionsUsed().find(x => x.extensionName === 'EXT_meshopt_compression'); if (ext) ext.dispose();
  const bytes = preserveRawTransforms(await io.writeBinary(doc), json);
  const checks = assertPreserved(before, snapshotDocument(await io.readBinary(bytes)));
  requireThat(!parseGLB(bytes).json.extensionsUsed?.includes('EXT_meshopt_compression'), 'Compression extension not removed');
  await writeFile(output, bytes, { flag: 'wx' });
  return { bytes: bytes.byteLength, sha256: sha256(bytes), checks };
}

async function main(args) {
  const [command, ...rest] = args;
  requireThat(rest.length % 2 === 0, 'Expected paired CLI options');
  const options = {};
  for (let i = 0; i < rest.length; i += 2) { requireThat(/^--[a-z-]+$/.test(rest[i]) && !(rest[i] in options), 'Invalid/duplicate CLI option'); options[rest[i]] = rest[i + 1]; }
  if (command === 'decompress') {
    requireThat(Object.keys(options).sort().join(',') === '--input,--output,--sha256', 'decompress requires --input --output --sha256');
    console.log(JSON.stringify(await decompressFile(options['--input'], options['--output'], options['--sha256']), null, 2)); return;
  }
  requireThat(command === 'build' && Object.keys(options).sort().join(',') === '--manifest,--output', 'Usage: preserve.mjs build --manifest ABSOLUTE_JSON --output NEW_ABSOLUTE_DIRECTORY');
  await checkPath(options['--manifest']);
  const manifestBytes = await readFile(options['--manifest']); requireThat(manifestBytes.length <= 128 * 1024, 'Manifest too large');
  const manifest = JSON.parse(manifestBytes);
  requireThat(manifest.schemaVersion === 1 && Array.isArray(manifest.assets) && manifest.assets.length > 0 && manifest.assets.length <= 12, 'Invalid manifest');
  requireThat(new Set(manifest.assets.map(x => x.id)).size === manifest.assets.length, 'Duplicate asset identities');
  manifest.assets.forEach(validateEntry);
  await checkPath(options['--output'], { missingLeaf: true }); await mkdir(options['--output'], { mode: 0o700 });
  const receipts = [];
  for (const entry of manifest.assets) {
    console.error(`Preserving ${entry.id}`);
    const receipt = await buildAsset(entry, path.join(options['--output'], entry.id)); receipts.push(receipt);
    console.log(JSON.stringify({ id: receipt.id, bytes: receipt.output.web.bytes, triangles: receipt.sourceSnapshot.totals.triangles, sizeTargetMet: receipt.sizeTarget.met, preservationPassed: true }));
  }
  const totalWebBytes = receipts.reduce((sum, row) => sum + row.output.web.bytes, 0);
  const collectionLimit = manifest.collectionBudgetBytes ?? 160 * 1024 ** 2;
  requireThat(Number.isSafeInteger(collectionLimit) && collectionLimit > 0 && collectionLimit <= 160 * 1024 ** 2, 'Invalid collection budget');
  const summary = { schemaVersion: 1, manifestSha256: sha256(manifestBytes), assets: receipts, allSizeTargetsMet: receipts.every(x => x.sizeTarget.met), allReviewedBudgetsMet: receipts.every(x => x.releaseBudget.met) && totalWebBytes <= collectionLimit, totalWebBytes, collectionBudgetBytes: collectionLimit };
  await writeFile(path.join(options['--output'], 'build-receipt.json'), JSON.stringify(summary, null, 2) + '\n', { flag: 'wx' });
  if (!summary.allSizeTargetsMet) console.error('Original 25 MiB target exceeded; see explicit reviewed limits in receipts. No simplification or precision reduction was performed.');
  if (!summary.allReviewedBudgetsMet) { console.error('Reviewed publication budget exceeded.'); process.exitCode = 2; }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main(process.argv.slice(2)).catch(error => { console.error(`Heritage preservation failed: ${error.message}`); process.exitCode = 1; });
