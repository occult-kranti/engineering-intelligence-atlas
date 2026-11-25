#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DATA_FILES, prepareData, safeAssetPath } from './core.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const sha256 = value => createHash('sha256').update(value).digest('hex');
export function readCatalog(root = here) {
  return prepareData(Object.fromEntries(Object.entries(DATA_FILES).map(([key, file]) => [key, JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'))])));
}
function strings(record, keys) {
  for (const key of keys) assert(typeof record[key] === 'string' && record[key].trim().length && record[key].length <= 12000, `${record.id}: invalid ${key}`);
}
function arrays(record, keys) {
  for (const key of keys) assert(Array.isArray(record[key]) && record[key].length && record[key].every(value => typeof value === 'string' && value.trim().length && value.length <= 4000), `${record.id}: invalid ${key}`);
}
function readAsset(root, relative) {
  assert(safeAssetPath(relative), `Unsafe asset path: ${relative}`);
  let current = root;
  for (const part of relative.split('/')) {
    current = path.join(current, part);
    assert(!fs.lstatSync(current).isSymbolicLink(), `Symlink in asset: ${relative}`);
  }
  const stat = fs.statSync(current);
  assert(stat.isFile() && stat.size > 0 && stat.size <= 4 * 1024 * 1024, `Invalid asset size: ${relative}`);
  return fs.readFileSync(current);
}
export function validateSampleProvenance(sample, metadata) {
  assert.deepEqual(metadata.sourceIds, sample.sourceIds, `${sample.id}: catalog and artifact source provenance differ`);
  assert.deepEqual(metadata.elementIds, sample.elementIds, `${sample.id}: catalog and artifact element links differ`);
}
export function validateCatalog(root = here) {
  const data = readCatalog(root);
  assert.equal(data.monuments.asOf, '2026-11-24');
  assert.equal(data.tools.asOf, '2026-11-24');
  strings(data.monuments, ['coverageNote']);
  for (const record of data.monuments.records) {
    strings(record, ['name', 'region', 'country', 'period', 'dateLabel', 'description', 'engineering', 'significance']);
    arrays(record, ['categories', 'structuralSystems', 'materials', 'elements', 'uncertainties']);
    assert(['approximate', 'range', 'year'].includes(record.datePrecision), `${record.id}: dating precision`);
    assert(['extant', 'ruin', 'reconstructed', 'destroyed', 'under_construction'].includes(record.status), `${record.id}: status`);
  }
  for (const element of data.elements.elements) {
    strings(element, ['name', 'family', 'definition', 'loadPath']);
    arrays(element, ['materials', 'uses', 'limitations']);
  }
  for (const tool of data.tools.tools) {
    strings(tool, ['name', 'kind', 'licenseSummary', 'exportGuidance']);
    arrays(tool, ['platforms', 'useCases', 'inputData', 'limitations']);
    assert(['supported', 'manual_review', 'unverified'].includes(tool.automationStatus));
  }
  for (const claim of data.tools.claims) {
    strings(claim, ['claim', 'assessment']);
    assert(['verified', 'partly_supported', 'unverified', 'misleading'].includes(claim.verdict));
  }
  for (const source of data.sources.values()) {
    strings(source, ['title', 'publisher', 'url', 'accessed']); arrays(source, ['supports']);
    assert.equal(source.kind, 'primary', `${source.id}: source kind`);
    assert(/^2026-11-(24|25)$/.test(source.accessed), `${source.id}: retrieval date`);
  }
  const elementIds = new Set(data.elements.elements.map(record => record.id));
  let sampleBytes = 0, triangles = 0;
  for (const sample of data.samples.samples) {
    strings(sample, ['name', 'summary', 'studyType']); arrays(sample, ['elementIds', 'skillPaths', 'limitations']);
    assert(sample.elementIds.every(id => elementIds.has(id)), `${sample.id}: unresolved structural element`);
    for (const skill of sample.skillPaths) {
      assert(/^skills\/[a-z0-9-]+\/SKILL\.md$/.test(skill));
      assert(fs.existsSync(path.resolve(root, '../..', skill)), `${sample.id}: missing skill ${skill}`);
    }
    const metadata = JSON.parse(readAsset(root, sample.files.metadata));
    validateSampleProvenance(sample, metadata);
    assert.equal(metadata.generatorSha256, sha256(readAsset(root, 'samples/generate.py')), `${sample.id}: generator identity changed`);
    assert.equal(metadata.presetsSha256, sha256(readAsset(root, 'samples/presets.json')), `${sample.id}: preset identity changed`);
    assert.equal(metadata.id, sample.id); assert.equal(metadata.sourceKind, 'original-procedural-schematic');
    assert.equal(metadata.isSiteReconstruction, false); assert.equal(metadata.isConstructionDesign, false);
    assert.equal(metadata.units, 'metres'); assert.deepEqual(metadata.externalAssets, []);
    assert(metadata.dimensionsMeters.every(n => Number.isFinite(n) && n > 0 && n <= 100));
    assert(Number.isInteger(metadata.triangleCount) && metadata.triangleCount > 0 && metadata.triangleCount <= 100000);
    triangles += metadata.triangleCount;
    for (const format of ['blend', 'glb', 'preview']) {
      const bytes = readAsset(root, sample.files[format]); sampleBytes += bytes.length;
      assert.equal(metadata.files[format].path, sample.files[format]);
      assert.equal(metadata.files[format].bytes, bytes.length);
      assert.equal(metadata.files[format].sha256, sha256(bytes), `${sample.id}: changed ${format}`);
      if (format === 'glb') {
        assert.equal(bytes.toString('ascii', 0, 4), 'glTF'); assert.equal(bytes.readUInt32LE(4), 2);
        assert.equal(bytes.readUInt32LE(8), bytes.length);
        const jsonLength = bytes.readUInt32LE(12);
        const gltf = JSON.parse(bytes.toString('utf8', 20, 20 + jsonLength));
        assert(gltf.meshes?.length > 0, `${sample.id}: empty glTF`);
        assert((gltf.buffers ?? []).every(buffer => !buffer.uri), `${sample.id}: external glTF buffer`);
        assert((gltf.images ?? []).every(image => !image.uri), `${sample.id}: external glTF image`);
      } else if (format === 'preview') {
        assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
        assert.equal(bytes.readUInt32BE(16), 384); assert.equal(bytes.readUInt32BE(20), 384);
      }
    }
  }
  assert(sampleBytes < 8 * 1024 * 1024, 'Sample payload exceeds 8 MiB.');
  return { schemaVersion: 1, status: 'passed', asOf: data.monuments.asOf,
    monuments: data.monuments.records.length, elements: data.elements.elements.length,
    samples: data.samples.samples.length, tools: data.tools.tools.length, claims: data.tools.claims.length,
    primarySources: data.sources.size, regions: [...new Set(data.monuments.records.map(record => record.region))].sort(),
    firstYear: Math.min(...data.monuments.records.map(record => record.startYear)),
    latestPhaseYear: Math.max(...data.monuments.records.map(record => record.endYear)),
    sampleBinaryBytes: sampleBytes, sampleTriangles: triangles,
    checks: ['required fields and unique IDs', 'resolved primary-source references', 'signed historical intervals without year zero',
      'sample element, skill and provenance links', 'generator/preset identity', 'artifact SHA256 and byte counts', 'embedded glTF buffers and image policy',
      '384px PNG signatures and bounds', '8 MiB sample budget'],
    limitations: ['No live network requests made by this validator.', 'Catalog validation does not establish historical completeness or engineering fitness.'] };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) console.log(JSON.stringify(validateCatalog(), null, 2));
