export function localPath(value) {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_.-]+)*\.[a-zA-Z0-9]+$/.test(value)
    || value.split('/').some(part => part === '..' || part.startsWith('.'))) throw new Error('Invalid local asset path');
  return value;
}
export function externalUrl(value) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password) throw new Error('Sources must use public HTTPS URLs');
  return url.href;
}
export const formatInteger = value => new Intl.NumberFormat('en').format(value);
export const formatBytes = value => `${(value / 1048576).toFixed(1)} MB`;
export function validateCatalog(catalog) {
  if (catalog?.schemaVersion !== 1 || !Array.isArray(catalog.assets) || !catalog.assets.length || catalog.assets.length > 20
    || !Array.isArray(catalog.references) || catalog.references.length > 20) throw new Error('Unsupported capture catalog');
  const ids = new Set();
  for (const asset of catalog.assets) {
    if (!/^[a-z0-9-]+$/.test(asset.id) || ids.has(asset.id)) throw new Error('Invalid or duplicate capture ID');
    ids.add(asset.id);
    for (const key of ['name', 'shortName', 'location', 'kind', 'summary', 'qualityLabel', 'attribution']) {
      if (typeof asset[key] !== 'string' || !asset[key].trim() || asset[key].length > 1600) throw new Error(`Missing capture ${key}`);
    }
    for (const key of ['triangles', 'vertices', 'bytes']) {
      if (!Number.isSafeInteger(asset[key]) || asset[key] <= 0) throw new Error(`Invalid capture ${key}`);
    }
    if (asset.bytes > 64 * 1048576 || !/^[a-f0-9]{64}$/.test(asset.sha256)) throw new Error('Unbounded or unverified capture payload');
    localPath(asset.file); localPath(asset.preview); localPath(asset.evidence);
    if (!asset.file.startsWith('assets/') || !asset.file.endsWith('.glb')) throw new Error('Capture model is outside the reviewed asset directory');
    externalUrl(asset.sourceUrl); externalUrl(asset.license.url);
    if (asset.license.spdx !== 'CC-BY-4.0' || asset.license.bundleStatus !== 'attribution-required') throw new Error('Research-only or view-only geometry is not a public model');
    // Current collection has no independent control data. This gate must change
    // deliberately, with a new accuracy contract, before measurements can appear.
    if (asset.metric?.verified !== false || asset.metric?.units !== null || asset.metric?.measurementEnabled !== false
      || asset.metric?.crs !== null || asset.metric?.independentErrorMetres !== null) throw new Error('Unsupported metric accuracy claim');
    if (!['dense-exterior', 'context'].includes(asset.detailClass)) throw new Error('Unsupported detail class');
    if (!['full-source-geometry', 'processed-context'].includes(asset.geometryClass)) throw new Error('Unsupported geometry class');
    if (!Array.isArray(asset.limitations) || asset.limitations.length < 2 || !Array.isArray(asset.changes) || !asset.changes.length) throw new Error('Capture limitations and changes are required');
  }
  for (const ref of catalog.references) {
    if (!['noncommercial-reference', 'view-only'].includes(ref.status) || ref.file) throw new Error('Restricted reference must not contain a bundled model');
    externalUrl(ref.url);
  }
  return catalog;
}
export function assertEmbeddedGlb(buffer) {
  const view = new DataView(buffer);
  if (buffer.byteLength < 20 || view.getUint32(0, true) !== 0x46546c67 || view.getUint32(4, true) !== 2
    || view.getUint32(8, true) !== buffer.byteLength || view.getUint32(16, true) !== 0x4e4f534a) throw new Error('Invalid GLB container');
  const length = view.getUint32(12, true);
  if (length > 4 * 1048576 || 20 + length > buffer.byteLength) throw new Error('Invalid GLB metadata size');
  const json = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, 20, length)));
  for (const item of [...(json.buffers || []), ...(json.images || [])]) {
    if (item.uri && !item.uri.startsWith('data:')) throw new Error('External model resources are disabled');
  }
  return json;
}
