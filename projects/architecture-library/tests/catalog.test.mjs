import test from 'node:test';
import assert from 'node:assert/strict';
import { DATA_FILES, ERAS, axisYear, filterRecords, groupChronology, intervalPosition, normalize, prepareData, safeAssetPath, yearLabel } from '../core.mjs';
import { readCatalog, validateCatalog, validateSampleProvenance } from '../validate.mjs';

const record = overrides => ({ id: 'test-record', name: 'Göbekli Tepe', country: 'Türkiye', region: 'Western Asia', period: 'Neolithic', categories: ['monument'],
  startYear: -9600, endYear: -8200, materials: ['stone'], elements: ['standing-stone'], structuralSystems: ['post-and-lintel'],
  description: 'Archaeological evidence', engineering: 'Carved masonry', ...overrides });

test('historical axis is chronological across BCE/CE without an invented year zero', () => {
  assert.equal(yearLabel(-9600), '9,600 BCE'); assert.equal(yearLabel(2026), '2,026 CE');
  assert.throws(() => yearLabel(0)); assert.throws(() => yearLabel(NaN));
  assert.equal(axisYear(1) - axisYear(-1), 1);
  const points = filterRecords([record({ id: 'c', startYear: 1, endYear: 3 }), record({ id: 'a', startYear: -2, endYear: -1 }), record({ id: 'b', startYear: -1, endYear: 1 })]);
  assert.deepEqual(points.map(r => r.id), ['a', 'b', 'c']);
});
test('search combines normalized words and independent geography/type filters', () => {
  const records = [record({}), record({ id: 'other', name: 'Other', country: 'Egypt', region: 'Africa', categories: ['pyramid'] })];
  assert.equal(normalize('Göbekli'), 'gobekli');
  assert.deepEqual(filterRecords(records, { query: 'gobekli turkiye', region: 'Western Asia', category: 'monument' }).map(r => r.id), ['test-record']);
  assert.equal(filterRecords(records, { query: 'gobekli', region: 'Africa' }).length, 0);
});
test('period filters include overlapping construction phases; groups include each result once', () => {
  const records = [record({ startYear: 1882, endYear: 2026 })];
  assert.equal(filterRecords(records, { era: 'contemporary' }).length, 1);
  assert.equal(filterRecords(records, { era: 'ancient' }).length, 0);
  assert.equal(groupChronology(records).flatMap(r => r.records).length, 1);
  const position = intervalPosition(records[0], ERAS.find(r => r.id === 'contemporary'));
  assert.equal(position.left, 0); assert.equal(position.width, 100);
});
test('sample paths reject traversal, URLs, backslashes and hidden components', () => {
  assert(safeAssetPath('samples/generated/dome-oculus/sample.glb'));
  for (const input of ['../private.json', '/tmp/x.glb', 'https://example.com/x.png', 'a/../../x.glb', 'a\\x.glb', 'a/.private/file.json', 'a/%2e%2e/file.png']) assert.equal(safeAssetPath(input), false, input);
});
test('catalog rejects unresolved sources, duplicate IDs, unsafe URLs and impossible intervals', () => {
  const original = readCatalog();
  const raw = () => Object.fromEntries(Object.keys(DATA_FILES).map(key => [key, structuredClone(original[key])]));
  let value = raw(); value.monuments.records[0].sourceIds = ['missing']; assert.throws(() => prepareData(value), /Unresolved/);
  value = raw(); value.monuments.records.push(value.monuments.records[0]); assert.throws(() => prepareData(value), /duplicate/);
  value = raw(); value.historySources.sources[0].url = 'javascript:alert(1)'; assert.throws(() => prepareData(value), /Unsafe/);
  value = raw(); value.monuments.records[0].startYear = 0; assert.throws(() => prepareData(value), /interval/);
  value = raw(); value.monuments.records[0].endYear = 2030; assert.throws(() => prepareData(value), /interval/);
});
test('published edition has source-linked records and verified original downloadable artifacts', () => {
  const result = validateCatalog();
  assert(result.monuments >= 60); assert(result.elements >= 30); assert.equal(result.samples, 14);
  assert(result.tools >= 20); assert(result.primarySources >= 100);
  assert(result.firstYear <= -9000); assert(result.latestPhaseYear >= 2025);
});

test('catalog provenance cannot be silently reassigned away from delivered model metadata', () => {
  const sample = { id: 'ring', sourceIds: ['elements-stones'], elementIds: ['standing-stone'] };
  validateSampleProvenance(sample, structuredClone(sample));
  assert.throws(() => validateSampleProvenance({ ...sample, sourceIds: ['elements-steel'] }, sample), /source provenance differ/);
  assert.throws(() => validateSampleProvenance({ ...sample, elementIds: ['diagrid'] }, sample), /element links differ/);
});
