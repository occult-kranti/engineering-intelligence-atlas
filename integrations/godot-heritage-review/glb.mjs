import { createHash } from 'node:crypto';
export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const ensure = (ok, message) => { if (!ok) throw new Error(message); };
const IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
const multiply = (a, b) => Array.from({ length: 16 }, (_, i) => {
  const col = Math.floor(i / 4), row = i % 4;
  return a[row] * b[col * 4] + a[4 + row] * b[col * 4 + 1] + a[8 + row] * b[col * 4 + 2] + a[12 + row] * b[col * 4 + 3];
});
function matrix(node) {
  if (node.matrix) {
    ensure(!node.translation && !node.rotation && !node.scale, 'Node mixes matrix and TRS');
    ensure(node.matrix.length === 16 && node.matrix.every(Number.isFinite), 'Invalid node matrix');
    ensure(node.matrix[3] === 0 && node.matrix[7] === 0 && node.matrix[11] === 0 && node.matrix[15] === 1, 'Non-affine node matrix');
    return node.matrix;
  }
  const t = node.translation || [0, 0, 0], s = node.scale || [1, 1, 1], q = node.rotation || [0, 0, 0, 1];
  ensure(t.length === 3 && s.length === 3 && q.length === 4 && [...t, ...s, ...q].every(Number.isFinite), 'Invalid node TRS');
  ensure(Math.abs(q.reduce((sum, x) => sum + x * x, 0) - 1) <= 1e-5, 'Rotation quaternion is not unit length');
  const [x, y, z, w] = q;
  return [(1 - 2*y*y - 2*z*z)*s[0], (2*x*y + 2*z*w)*s[0], (2*x*z - 2*y*w)*s[0], 0,
    (2*x*y - 2*z*w)*s[1], (1 - 2*x*x - 2*z*z)*s[1], (2*y*z + 2*x*w)*s[1], 0,
    (2*x*z + 2*y*w)*s[2], (2*y*z - 2*x*w)*s[2], (1 - 2*x*x - 2*y*y)*s[2], 0, ...t, 1];
}
/** Inspect actual uncompressed GLB buffers, not accessor min/max claims. Static scenes only. */
export function inspectGlb(bytes) {
  const b = Buffer.from(bytes);
  ensure(b.length >= 28 && b.length <= 512 * 1024 ** 2 && b.toString('ascii', 0, 4) === 'glTF' && b.readUInt32LE(4) === 2 && b.readUInt32LE(8) === b.length, 'Invalid/bounded GLB header');
  let offset = 12, json, bin;
  while (offset < b.length) {
    ensure(offset + 8 <= b.length, 'Truncated GLB chunk');
    const length = b.readUInt32LE(offset), type = b.readUInt32LE(offset + 4); offset += 8;
    ensure(length % 4 === 0 && offset + length <= b.length, 'Invalid GLB chunk length');
    if (type === 0x4e4f534a) { ensure(!json && offset === 20 && length <= 4 * 1024 ** 2, 'Invalid JSON chunk'); json = JSON.parse(b.toString('utf8', offset, offset + length)); }
    else if (type === 0x004e4942) { ensure(json && !bin, 'Invalid BIN chunk'); bin = b.subarray(offset, offset + length); }
    else throw new Error('Unsupported GLB chunk');
    offset += length;
  }
  ensure(json?.asset?.version === '2.0' && bin, 'GLB requires JSON and embedded BIN');
  ensure(json.buffers?.length === 1 && !json.buffers[0].uri && Number.isInteger(json.buffers[0].byteLength) && json.buffers[0].byteLength <= bin.length, 'Expected one embedded buffer');
  ensure(!(json.images || []).some(i => i.uri && !i.uri.startsWith('data:')), 'External image URIs are not accepted');
  ensure(!(json.animations?.length || json.skins?.length), 'Static audit does not support animation/skin');
  const encoded = JSON.stringify(json);
  ensure(!encoded.includes('EXT_meshopt_compression') && !encoded.includes('KHR_draco_mesh_compression'), 'Decode compressed GLB before engine review');
  const readAccessor = (index, expectedType) => {
    const a = json.accessors?.[index], v = json.bufferViews?.[a?.bufferView];
    ensure(a && v && !a.sparse && v.buffer === 0 && a.type === expectedType && Number.isInteger(a.count) && a.count > 0 && a.count <= 30_000_000, 'Unsupported/invalid accessor');
    const widths = { SCALAR: 1, VEC3: 3, VEC4: 4 }, components = { 5121: 1, 5123: 2, 5125: 4, 5126: 4 };
    const width = widths[a.type], size = components[a.componentType], stride = v.byteStride || width * size;
    const viewStart = v.byteOffset || 0, start = viewStart + (a.byteOffset || 0);
    ensure(size && Number.isInteger(v.byteLength) && Number.isInteger(start) && start >= viewStart && viewStart >= 0 && stride >= width * size && stride % size === 0 && start + (a.count - 1) * stride + width * size <= viewStart + v.byteLength && viewStart + v.byteLength <= json.buffers[0].byteLength, 'Accessor outside bufferView');
    return { count: a.count, componentType: a.componentType, normalized: !!a.normalized, width, get(i, c = 0) {
      const p = start + i * stride + c * size;
      let value = a.componentType === 5126 ? bin.readFloatLE(p) : size === 1 ? bin.readUInt8(p) : size === 2 ? bin.readUInt16LE(p) : bin.readUInt32LE(p);
      if (a.normalized) { ensure(a.componentType === 5121 || a.componentType === 5123, 'Invalid normalized component type'); value /= a.componentType === 5121 ? 255 : 65535; }
      return value;
    } };
  };
  ensure((json.meshes || []).length <= 10000, 'Mesh count exceeds audit bound');
  let declaredVertices = 0, declaredTriangles = 0;
  const meshInfo = (json.meshes || []).map((mesh, meshIndex) => (mesh.primitives || []).map((p, primitiveIndex) => {
    ensure((p.mode ?? 4) === 4 && !p.targets?.length, 'Only static TRIANGLES primitives supported');
    const position = readAccessor(p.attributes?.POSITION, 'VEC3'); ensure(position.componentType === 5126 && !position.normalized, 'POSITION must be Float32');
    const index = p.indices === undefined ? null : readAccessor(p.indices, 'SCALAR');
    ensure(!index || [5121, 5123, 5125].includes(index.componentType) && !index.normalized, 'Invalid index component type');
    const indexCount = index ? index.count : position.count; ensure(indexCount % 3 === 0, 'Triangle index count not divisible by three');
    let maximumIndex = -1;
    if (index) for (let i = 0; i < index.count; i++) { const value = index.get(i); ensure(value < position.count, 'Index outside position accessor'); maximumIndex = Math.max(maximumIndex, value); }
    declaredVertices += position.count; declaredTriangles += indexCount / 3;
    ensure(declaredVertices <= 20_000_000 && declaredTriangles <= 40_000_000, 'Declared geometry exceeds audit bound');
    const colourType = p.attributes?.COLOR_0 === undefined ? null : json.accessors[p.attributes.COLOR_0]?.type;
    ensure(!colourType || ['VEC3', 'VEC4'].includes(colourType), 'Invalid COLOR_0');
    const colour = colourType ? readAccessor(p.attributes.COLOR_0, colourType) : null;
    ensure(!colour || colour.count === position.count, 'Colour count differs from positions');
    if (colour) for (let i = 0; i < colour.count; i++) for (let c = 0; c < colour.width; c++) ensure(Number.isFinite(colour.get(i, c)), 'Non-finite vertex colour');
    return { meshIndex, primitiveIndex, position, vertices: position.count, indexCount: index ? index.count : 0, triangles: indexCount / 3, colourCount: colour ? colour.count : 0, maximumIndex };
  }));
  ensure(meshInfo.length > 0 && meshInfo.length <= 10000, 'Expected bounded mesh collection');
  const scene = json.scenes?.[json.scene ?? 0]; ensure(scene && Array.isArray(scene.nodes), 'No active scene');
  const nodes = json.nodes || []; ensure(nodes.length <= 10000, 'Node count exceeds audit bound');
  const seen = new Set(), stack = scene.nodes.map(index => ({ index, parent: IDENTITY })), instances = [];
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  let vertices = 0, triangles = 0, indexCount = 0, colourCount = 0, surfaces = 0;
  while (stack.length) {
    const { index, parent } = stack.pop(), node = nodes[index]; ensure(Number.isInteger(index) && node && !seen.has(index), 'Invalid/cyclic or multiply-parented node'); seen.add(index);
    const world = multiply(parent, matrix(node)); ensure(world.every(Number.isFinite), 'Non-finite composed transform');
    if (node.mesh !== undefined) {
      const primitives = meshInfo[node.mesh]; ensure(primitives?.length, 'Invalid mesh reference');
      const records = [];
      for (const p of primitives) {
        ensure(vertices + p.vertices <= 20_000_000 && triangles + p.triangles <= 40_000_000, 'Instanced geometry exceeds audit bound');
        for (let i = 0; i < p.vertices; i++) {
          const x = p.position.get(i, 0), y = p.position.get(i, 1), z = p.position.get(i, 2);
          ensure([x, y, z].every(Number.isFinite), 'Non-finite vertex position');
          for (let c = 0; c < 3; c++) { const value = world[c]*x + world[4+c]*y + world[8+c]*z + world[12+c]; ensure(Number.isFinite(value), 'Non-finite world position'); lo[c] = Math.min(lo[c], value); hi[c] = Math.max(hi[c], value); }
        }
        const { position, ...record } = p; records.push(record); vertices += p.vertices; triangles += p.triangles; indexCount += p.indexCount; colourCount += p.colourCount; surfaces++;
      }
      instances.push({ nodeIndex: index, name: node.name || '', worldMatrixColumnMajor: world, primitives: records });
    }
    for (const child of node.children || []) stack.push({ index: child, parent: world });
  }
  ensure(surfaces > 0 && vertices <= 20_000_000 && triangles <= 40_000_000, 'Scene exceeds audit geometry bound');
  return { schemaVersion: 1, inputSha256: sha256(b), inputBytes: b.length, vertices, triangles, indexCount, colourCount, surfaces, meshInstances: instances.length, worldBounds: { minimum: lo, maximum: hi }, instances, units: 'input coordinate units; no scale calibration performed', validation: { positionsFinite: true, coloursFinite: true, indicesInBounds: true, noExternalDependencies: true, staticUncompressedTriangles: true } };
}
