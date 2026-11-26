import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createActivityJournal, ActivityJournalError } from '../activity-journal.mjs';
import { ACTIVITY_JOURNAL_SCHEMAS, ACTIVITY_JOURNAL_LIMITS, validateActivityJournalOperation } from '../activity-journal-contract.mjs';

const event = (extra = {}) => ({ family: 'host', operation: 'submit', outcome: 'accepted', companyId: 'acme', employeeId: 'donna', ...extra });
function fixture(t, options = {}) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'daftar-journal-')); const services = [];
  const open = () => { const service = createActivityJournal({ stateDir: directory, now: () => 1000, ...options }); services.push(service); return service; };
  const service = open(); t.after(async () => { for (const item of services) await item.close().catch(() => {}); fs.rmSync(directory, { recursive: true, force: true }); });
  return { service, open, directory, registry: path.join(directory, 'activity-journal', 'registry.json') };
}
const rejects = (promise, code) => assert.rejects(promise, error => error instanceof ActivityJournalError && error.code === code);

test('metadata survives restart in private storage with monotonically increasing sequence', async t => {
  const f = fixture(t); const first = await f.service.record(event({ requestId: 'request-one', durationMs: 12.4 }));
  assert.deepEqual(first, { ok: true, recorded: true, sequence: 1, degraded: false, fenced: false });
  if (process.platform !== 'win32') { assert.equal(fs.statSync(f.registry).mode & 0o777, 0o600); assert.equal(fs.statSync(path.dirname(f.registry)).mode & 0o777, 0o700); }
  assert.throws(() => f.open(), error => error.code === 'JOURNAL_BUSY');
  await f.service.close(); const reopened = f.open(); assert.equal((await reopened.record(event())).sequence, 2);
  const rows = await reopened.query(); assert.deepEqual(rows.events.map(item => item.sequence), [1, 2]); assert.equal(rows.events[0].durationMs, 12);
  assert.equal(rows.events[0].recordedAt, '1970-01-01T00:00:01.000Z'); assert.equal(rows.nextAfterSequence, 2); assert.equal(rows.retentionGap, false);
});

test('concurrent metadata records serialize, and filtered pagination never returns another scope', async t => {
  const f = fixture(t); const receipts = await Promise.all(Array.from({ length: 60 }, (_, index) => f.service.record(event({ companyId: index % 2 ? 'other' : 'acme', employeeId: index % 3 ? 'alice' : 'bob', outcome: index % 4 ? 'success' : 'error', requestId: `request-${index}` }))));
  assert.deepEqual(receipts.map(item => item.sequence), Array.from({ length: 60 }, (_, index) => index + 1));
  const first = await f.service.query({ companyId: 'acme', employeeId: 'alice', outcome: 'success', limit: 3 });
  assert.equal(first.events.length, 3); assert.equal(first.hasMore, true); assert.ok(first.events.every(row => row.companyId === 'acme' && row.employeeId === 'alice' && row.outcome === 'success'));
  const second = await f.service.query({ companyId: 'acme', employeeId: 'alice', outcome: 'success', limit: 100, afterSequence: first.nextAfterSequence });
  assert.equal(second.hasMore, false); assert.equal(second.nextAfterSequence, 60); assert.ok(second.events.every(row => row.sequence > first.nextAfterSequence));
  const future = await f.service.query({ afterSequence: 900 }); assert.deepEqual(future.events, []); assert.equal(future.nextAfterSequence, 900);
});

test('retention preserves a bounded suffix and explicitly reports a lost cursor range after restart', async t => {
  const f = fixture(t); await f.service.close();
  const events = Array.from({ length: 1000 }, (_, index) => ({ sequence: index + 1, recordedAt: '1970-01-01T00:00:01.000Z', ...event() }));
  fs.writeFileSync(f.registry, JSON.stringify({ version: 1, lastSequence: 1000, events }), { mode: 0o600 });
  const reopened = f.open(); await reopened.record(event()); await reopened.record(event());
  const query = await reopened.query({ limit: 1 }); assert.equal(query.events[0].sequence, 3); assert.equal(query.retentionGap, true); assert.deepEqual(query.missingSequenceRange, { from: 1, to: 2 });
  assert.equal(query.hasMore, true); assert.equal(query.nextAfterSequence, 3); assert.equal(query.latestSequence, 1002); assert.equal(query.droppedEvents, 2);
  assert.equal((await reopened.query({ afterSequence: 2 })).retentionGap, false);
  const status = await reopened.status(); assert.equal(status.activity.eventCount, 1000); assert.ok(fs.statSync(f.registry).size <= ACTIVITY_JOURNAL_LIMITS.registryBytes);
});

test('summary cache is scoped, bounded, deterministic and invalidated by new events', async t => {
  const f = fixture(t);
  await f.service.record(event({ outcome: 'success', durationMs: 10 })); await f.service.record(event({ companyId: 'other', outcome: 'error', code: 'SYNTHETIC_FAILURE', durationMs: 999 }));
  const first = await f.service.summarize({ companyId: 'acme' }); const again = await f.service.summarize({ companyId: 'acme' });
  assert.equal(first.cacheHit, false); assert.equal(again.cacheHit, true); assert.deepEqual(first.summary, again.summary); assert.equal(first.summary.eventCount, 1); assert.equal(first.summary.duration.totalMs, 10); assert.deepEqual(first.summary.byCode, {});
  first.summary.byOutcome.success = 999; assert.equal((await f.service.summarize({ companyId: 'acme' })).summary.byOutcome.success, 1);
  await f.service.record(event({ outcome: 'error', code: 'DENIED' })); const refreshed = await f.service.summarize({ companyId: 'acme' });
  assert.equal(refreshed.cacheHit, false); assert.equal(refreshed.summary.eventCount, 2); assert.equal(refreshed.summary.byCode.DENIED, 1); assert.equal(refreshed.summary.llmCalls, false);
  for (let i = 0; i < 100; i++) await f.service.summarize({ companyId: `company-${i}` });
  assert.equal((await f.service.status()).activity.summaryCacheEntries, 64); assert.equal((await f.service.summarize({ companyId: 'acme' })).cacheHit, false);
});

test('unexpected fields, secret-shaped identifiers and malformed metadata are never persisted or echoed', async t => {
  const f = fixture(t); const before = fs.readFileSync(f.registry);
  for (const invalid of [event({ command: 'secret command' }), event({ prompt: 'secret prompt' }), event({ error: { stack: 'private stack' } }), event({ apiKey: 'secret-key' }), event({ jobId: 'sk-ant-privatefixture' }), event({ requestId: 'github_pat_privatefixture' }), event({ code: 'BAD\n' }), event({ companyId: 'acme\n' }), event({ outcome: 'free text' }), event({ family: 'unknown' }), event({ operation: 'curl_private_secret' }), event({ durationMs: Infinity })]) {
    const result = await f.service.record(invalid); assert.equal(result.recorded, false); assert.equal(result.code, 'JOURNAL_INPUT_INVALID'); assert.equal(result.degraded, false);
    assert.ok(!JSON.stringify(result).includes('privatefixture')); assert.ok(!JSON.stringify(result).includes('secret command'));
  }
  assert.deepEqual(fs.readFileSync(f.registry), before); assert.equal((await f.service.query()).events.length, 0);
  assert.equal((await f.service.record(event({ operation: 'godMode' }))).recorded, true);
  assert.equal((await f.service.record({ family: 'worker', operation: 'generate', outcome: 'success' })).recorded, true);
  assert.deepEqual(Object.keys(ACTIVITY_JOURNAL_SCHEMAS), ['status', 'query', 'summarize']);
  assert.throws(() => validateActivityJournalOperation('query', { limit: 101 }), ActivityJournalError);
  assert.throws(() => validateActivityJournalOperation('query', { afterSequence: -1 }), ActivityJournalError);
});

for (const committed of [false, true]) test(`uncertain ${committed ? 'after' : 'before'}-rename failure is a handled diagnostic and fences further reads/writes`, async t => {
  const f = fixture(t); await f.service.record(event()); await f.service.summarize(); const original = fs.renameSync;
  fs.renameSync = (source, target) => { if (target === f.registry) { if (committed) original(source, target); throw Object.assign(new Error('private details must never escape'), { code: 'EIO' }); } return original(source, target); };
  let result; try { result = await f.service.record(event({ requestId: 'uncertain-record' })); } finally { fs.renameSync = original; }
  assert.deepEqual(result, { ok: false, recorded: false, code: 'JOURNAL_STATE_UNCERTAIN', degraded: true, fenced: true });
  const status = await f.service.status(); assert.equal(status.activity.latestSequence, null); assert.equal(status.activity.lastAcknowledgedSequence, 1); assert.equal(status.activity.available, false); assert.equal(status.activity.summaryCacheEntries, 0);
  await rejects(f.service.query(), 'JOURNAL_STATE_UNCERTAIN'); await rejects(f.service.summarize(), 'JOURNAL_STATE_UNCERTAIN');
  assert.equal((await f.service.record(event())).recorded, false);
  await f.service.close(); const reopened = f.open(); const query = await reopened.query(); assert.equal(query.latestSequence, committed ? 2 : 1);
  assert.equal((await reopened.record(event())).sequence, committed ? 3 : 2);
});

test('corrupt saved history fails closed and is preserved byte-for-byte', async t => {
  const f = fixture(t); await f.service.close();
  for (const contents of ['not json', JSON.stringify({ version: 1, lastSequence: 2, events: [{ sequence: 2, recordedAt: '1970-01-01T00:00:01.000Z', ...event(), command: 'private-source' }] }), JSON.stringify({ version: 1, lastSequence: 9, events: [] })]) {
    fs.writeFileSync(f.registry, contents, { mode: 0o600 }); assert.throws(() => f.open(), error => error instanceof ActivityJournalError && error.code === 'JOURNAL_STATE_INVALID' && !error.message.includes('private-source'));
    assert.equal(fs.readFileSync(f.registry, 'utf8'), contents); assert.equal(fs.existsSync(path.join(path.dirname(f.registry), 'owner.lock')), false);
  }
});

test('invalid clocks are handled and closed journals reject reads without disrupting caller receipts', async t => {
  const f = fixture(t, { now: () => { throw new Error('private clock error'); } });
  const result = await f.service.record(event()); assert.equal(result.code, 'JOURNAL_CLOCK_INVALID'); assert.equal(result.degraded, false); assert.equal((await f.service.query()).events.length, 0);
  await f.service.close(); await f.service.close();
  for (const request of [f.service.status(), f.service.query(), f.service.summarize()]) await rejects(request, 'JOURNAL_CLOSED');
  const receipt = { ok: true, id: 'already-committed' }; const diagnostic = await f.service.record(event());
  assert.equal(diagnostic.code, 'JOURNAL_CLOSED'); assert.equal(diagnostic.recorded, false); assert.deepEqual(receipt, { ok: true, id: 'already-committed' });
});
