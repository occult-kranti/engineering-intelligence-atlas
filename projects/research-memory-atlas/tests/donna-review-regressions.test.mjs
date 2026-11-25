/** Independent Donna Brain review: synthetic records, no provider requests. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDonnaBrain, brainEvidence, makeBrainNote, readBrainNote } from '../runtime/donna-brain.mjs';

const asOf = '2026-11-25T13:00:00Z';
function fixture() {
  return { schemaVersion: 1, activeCompanyId: 'alpha',
    companies: [{ id: 'alpha', name: 'Alpha', repoUrl: null, status: 'active', assistantId: 'assistant', createdAt: '2026-11-20T00:00:00Z', source: 'fixture', importedAt: null, githubStatus: 'unchecked' }],
    offices: [], departments: [], employees: [], jobs: [], knowledge: [], goals: [], portfolio: { roadmap: [] } };
}
function record(id, options = {}) {
  return { id, companyId: 'alpha', title: 'Synthetic note ' + id,
    summary: makeBrainNote({ type: 'fact', body: 'quasarbattery ' + id, ...options }),
    artifactUri: 'daftar-brain://alpha/note', createdAt: '2026-11-24T00:00:00Z' };
}

test('a never-active correction does not retire the earlier valid evidence', () => {
  const snapshot = fixture();
  snapshot.knowledge.push(record('old'), { ...record('invalid-correction', {
    supersedes: 'old', expiresAt: '2026-11-23T00:00:00Z',
  }), createdAt: '2026-11-25T12:00:00Z' });
  const packet = brainEvidence(snapshot, 'alpha', 'quasarbattery', asOf);
  assert.ok(packet.results.some(result => result.id === 'knowledge:old'));
  assert.ok(packet.results.every(result => result.id !== 'knowledge:invalid-correction'));
  assert.equal(buildDonnaBrain(snapshot, 'alpha').counts.corrections, 0);
});

test('supersedes identifiers retain their schema type instead of regex coercion', () => {
  for (const supersedes of [123, true, ['old'], {}]) {
    assert.throws(() => makeBrainNote({ type: 'fact', body: 'Synthetic note', supersedes }));
    const malformed = JSON.stringify({ kind: 'daftar-brain-note', version: 1,
      type: 'fact', body: 'Synthetic note', tags: [], supersedes, expiresAt: null });
    assert.equal(readBrainNote(malformed), null);
  }
});

test('recognized invalid or unsupported note envelopes do not become ordinary active knowledge', () => {
  for (const change of [{ expiresAt: 'not-an-instant' }, { version: 2 }, { type: 'unsupported-note-kind' }, { version: 2, encodedKey: true }]) {
    const snapshot = fixture();
    const envelope = { kind: 'daftar-brain-note', version: 1, type: 'fact',
      body: 'quasarbattery QUARANTINED_REVIEW_FIXTURE', tags: [], supersedes: null, expiresAt: null, ...change };
    const summary = change.encodedKey ? JSON.stringify(envelope).replace('"kind"', '"\\u006bind"') : JSON.stringify(envelope);
    snapshot.knowledge.push({ ...record('malformed'), summary });
    assert.equal(readBrainNote(snapshot.knowledge[0].summary), null);
    const packet = brainEvidence(snapshot, 'alpha', 'quasarbattery', asOf);
    assert.equal(packet.status, 'no-match');
    assert.ok(!JSON.stringify(packet).includes('QUARANTINED_REVIEW_FIXTURE'));
  }
});
