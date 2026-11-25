/** Independent Round 2 regression cases. Fixtures are synthetic public data. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { MemoryStore } from '../runtime/store.mjs';
import { queryGraph, validateGraph } from '../runtime/graph-core.mjs';

const grant = { allowedScopes: ['public'], policyVersion: 'review-2' };
const asOf = '2026-11-25T12:00:00Z';
function fixture(sourceId = 'source') {
  return { schemaVersion: 1, revision: 'review-fixture',
    sources: [{ id: sourceId, title: 'Synthetic source', url: 'https://example.org/research' }],
    nodes: [{ id: 'matrix', label: 'matrix', type: 'concept', domain: 'memory', summary: 'matrix', source_ids: [sourceId] }], edges: [] };
}
function temporary(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'daftar-memory-review-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

test('parseable but altered disposable cache is recomputed from the authorized snapshot', t => {
  const dir = temporary(t), store = new MemoryStore(dir, grant);
  store.ingest(fixture());
  const first = store.query({ query: 'matrix', asOf });
  const filename = path.join(dir, 'cache', first.cache.key + '.json');
  const cached = JSON.parse(fs.readFileSync(filename, 'utf8'));
  cached.packet.results = [{ id: 'unrelated', scope: 'client-secret', summary: 'Synthetic corrupted cache entry' }];
  fs.writeFileSync(filename, JSON.stringify(cached));
  const recovered = store.query({ query: 'matrix', asOf });
  assert.equal(recovered.cache.hit, false);
  assert.deepEqual(recovered.results, first.results);
  assert.ok(recovered.results.every(result => result.scope === 'public'));
});

test('final metadata respects the UTF-8 budget when no result can be included', () => {
  let accepted = 0;
  for (let length = 160; length <= 205; length++) {
    let packet;
    try { packet = queryGraph(fixture(), { query: 'matrix ' + '漢'.repeat(length), asOf, maxBytes: 1024, maxResults: 0 }, grant); }
    catch (error) { assert.match(error.message, /metadata exceeds packet budget/); continue; }
    accepted++;
    assert.equal(packet.results.length, 0);
    assert.ok(Buffer.byteLength(JSON.stringify(packet)) <= 1024, `Returned packet exceeded budget at query length ${length}`);
  }
  assert.ok(accepted > 0, 'The boundary check must exercise returned packets as well as preflight rejections.');
});

test('optional fields consumed by retrieval are validated before use', () => {
  for (const mutate of [
    graph => { graph.nodes[0].taxonomy_path = { unexpected: 'object' }; },
    graph => { graph.nodes[0].taxonomy_path = ['valid', 42]; },
    graph => { graph.nodes[0].status = { unexpected: 'object' }; },
    graph => { graph.sources[0].access_depth = { unexpected: 'object' }; },
  ]) {
    const graph = fixture(); mutate(graph);
    assert.throws(() => validateGraph(graph));
  }
});

test('maximum-length accepted source IDs survive scope namespacing and keep their citation', t => {
  const graph = fixture('s'.repeat(160)); validateGraph(graph);
  const store = new MemoryStore(temporary(t), grant); store.ingest(graph);
  const loaded = store.load(['public']); validateGraph(loaded);
  assert.equal(loaded.nodes[0].source_ids[0], loaded.sources[0].id);
  assert.equal(loaded.sources[0].url, graph.sources[0].url);
  const packet = store.query({ query: 'matrix', asOf });
  assert.equal(packet.results[0].sources[0].url, graph.sources[0].url);
});
