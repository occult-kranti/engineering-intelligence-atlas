/** Private owner metadata journal. This is neither tenant authentication nor an
 * exactly-once action ledger. Never pass command, prompt, response or key text.
 * Recording is best effort with explicit diagnostics: the caller must preserve
 * a successful operation receipt even when journal persistence is uncertain. */
import path from 'node:path';
import { object } from './host-control-contract.mjs';
import { createPrivateRegistry } from './model-resources-contract.mjs';
import { ActivityJournalError, ACTIVITY_JOURNAL_LIMITS as LIMITS, ACTIVITY_OUTCOMES,
  journalFail as fail, validateActivityRecord, validateActivityJournalOperation } from './activity-journal-contract.mjs';
export { ActivityJournalError } from './activity-journal-contract.mjs';

const bytes = value => Buffer.byteLength(JSON.stringify(value));
function validateState(value) {
  try {
    if (!object(value) || Object.keys(value).some(key => !['version', 'lastSequence', 'events'].includes(key)) || value.version !== 1
        || !Number.isSafeInteger(value.lastSequence) || value.lastSequence < 0 || !Array.isArray(value.events)
        || value.events.length > LIMITS.events || bytes(value) > LIMITS.registryBytes || (value.lastSequence > 0 && !value.events.length)) throw new Error();
    let expected = value.lastSequence - value.events.length + 1;
    for (const event of value.events) {
      if (!object(event) || !Number.isSafeInteger(event.sequence) || event.sequence < 1 || event.sequence !== expected++
          || typeof event.recordedAt !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(event.recordedAt)
          || new Date(event.recordedAt).toISOString() !== event.recordedAt) throw new Error();
      const { sequence, recordedAt, ...metadata } = event;
      if (JSON.stringify(validateActivityRecord(metadata)) !== JSON.stringify(metadata)) throw new Error();
    }
  } catch { fail('JOURNAL_STATE_INVALID', 'The saved activity history is malformed. Preserve it and inspect it locally.', 503); }
}
const matches = (event, filter) => ['companyId', 'employeeId', 'outcome'].every(key => filter[key] === undefined || event[key] === filter[key]);
const sorted = value => Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)));

export function createActivityJournal({ stateDir, now = () => Date.now() } = {}) {
  if (typeof stateDir !== 'string' || !path.isAbsolute(stateDir) || /[\x00-\x1f\x7f]/.test(stateDir) || typeof now !== 'function') fail('JOURNAL_INPUT_INVALID', 'An absolute private state directory and clock function are required.');
  const store = createPrivateRegistry({ stateDir, name: 'activity-journal', initial: { version: 1, lastSequence: 0, events: [] },
    validate: validateState, fail, ErrorType: ActivityJournalError });
  const cache = new Map(); let closing = false, closed = false, closePromise;
  let fenced = false, lastDiagnosticCode = null, recordFailures = 0;
  const boundary = () => { if (closing || closed) fail('JOURNAL_CLOSED', 'The activity journal is closed.', 503); store.assertHealthy(); };
  const retention = () => ({ oldestSequence: store.value.events[0]?.sequence ?? (store.value.lastSequence + 1),
    latestSequence: store.value.lastSequence, droppedEvents: store.value.lastSequence - store.value.events.length });
  const diagnostic = error => {
    const code = error instanceof ActivityJournalError ? error.code : 'JOURNAL_RECORD_FAILED';
    if (code === 'JOURNAL_STATE_UNCERTAIN') { fenced = true; cache.clear(); }
    lastDiagnosticCode = code; recordFailures = Math.min(Number.MAX_SAFE_INTEGER, recordFailures + 1);
    return { ok: false, recorded: false, code, degraded: fenced, fenced };
  };
  const statusView = () => ({ ok: true, activity: { available: !fenced, fenced, degraded: fenced,
    eventCount: store.value.events.length, lastAcknowledgedSequence: store.value.lastSequence,
    latestSequence: fenced ? null : store.value.lastSequence, oldestSequence: store.value.events[0]?.sequence ?? 1,
    droppedEvents: store.value.lastSequence - store.value.events.length, lastDiagnosticCode, recordFailures,
    limits: { ...LIMITS }, summaryCacheEntries: cache.size, metadataOnly: true, ownerScopedFilters: true,
    independentTenantAuthentication: false, automaticRetries: false, llmCalls: false,
    ...(fenced ? { notice: 'Journal write outcome is unknown. Preserve the original operation receipt; reopen and inspect this journal before recording more activity.' } : {}) } });
  return {
    async record(input) {
      try {
        if (closing || closed) fail('JOURNAL_CLOSED', 'The activity journal is closed.', 503);
        return await store.serial(async () => {
          try {
            boundary(); const metadata = validateActivityRecord(input);
            if (store.value.lastSequence >= Number.MAX_SAFE_INTEGER) fail('JOURNAL_CAPACITY', 'The journal sequence space is exhausted.', 409);
            let timestamp; try { timestamp = now(); } catch { fail('JOURNAL_CLOCK_INVALID', 'The activity clock is unavailable.', 503); }
            if (!Number.isSafeInteger(timestamp) || timestamp < 0 || timestamp > 253402300799999) fail('JOURNAL_CLOCK_INVALID', 'The activity clock is invalid.', 503);
            const event = { sequence: store.value.lastSequence + 1, recordedAt: new Date(timestamp).toISOString(), ...metadata };
            store.update(value => {
              value.lastSequence = event.sequence; value.events.push(event);
              if (value.events.length > LIMITS.events) value.events.splice(0, value.events.length - LIMITS.events);
              while (bytes(value) > LIMITS.registryBytes && value.events.length > 1) value.events.shift();
              if (bytes(value) > LIMITS.registryBytes) fail('JOURNAL_CAPACITY', 'Activity metadata exceeds its storage bound.', 409);
            });
            cache.clear(); return { ok: true, recorded: true, sequence: event.sequence, degraded: false, fenced: false };
          } catch (error) { return diagnostic(error); }
        });
      } catch (error) { return diagnostic(error); }
    },
    async status(input = {}) {
      validateActivityJournalOperation('status', input);
      if (closing || closed) fail('JOURNAL_CLOSED', 'The activity journal is closed.', 503);
      try { return await store.serial(async () => { boundary(); return statusView(); }); }
      catch (error) { if (error?.code !== 'JOURNAL_STATE_UNCERTAIN') throw error; fenced = true; cache.clear(); return statusView(); }
    },
    query: (input = {}) => store.serial(async () => {
      boundary(); const filter = validateActivityJournalOperation('query', input), range = retention();
      const selected = store.value.events.filter(event => event.sequence > filter.afterSequence && matches(event, filter));
      const events = selected.slice(0, filter.limit), hasMore = selected.length > events.length;
      const nextAfterSequence = hasMore ? events.at(-1).sequence : Math.max(filter.afterSequence, range.latestSequence);
      const retentionGap = filter.afterSequence < range.oldestSequence - 1;
      return { ok: true, events: structuredClone(events), nextAfterSequence, hasMore, retentionGap, ...range,
        ...(retentionGap ? { missingSequenceRange: { from: filter.afterSequence + 1, to: range.oldestSequence - 1 } } : {}) };
    }),
    summarize: (input = {}) => store.serial(async () => {
      boundary(); const scope = validateActivityJournalOperation('summarize', input), key = JSON.stringify(scope);
      if (cache.has(key)) { const summary = cache.get(key); cache.delete(key); cache.set(key, summary); return { ok: true, summary: structuredClone(summary), cacheHit: true }; }
      const events = store.value.events.filter(event => matches(event, scope)); const byFamily = {}, byOperation = {}, byCode = {};
      const byOutcome = Object.fromEntries(ACTIVITY_OUTCOMES.map(outcome => [outcome, 0])); let totalDurationMs = 0, maximumDurationMs = 0, durationSamples = 0;
      for (const event of events) {
        byFamily[event.family] = (byFamily[event.family] ?? 0) + 1; const operation = `${event.family}.${event.operation}`;
        byOperation[operation] = (byOperation[operation] ?? 0) + 1; byOutcome[event.outcome]++;
        if (event.code) byCode[event.code] = (byCode[event.code] ?? 0) + 1;
        if (event.durationMs !== undefined) { durationSamples++; totalDurationMs += event.durationMs; maximumDurationMs = Math.max(maximumDurationMs, event.durationMs); }
      }
      const summary = { scope, eventCount: events.length, byFamily: sorted(byFamily), byOperation: sorted(byOperation), byOutcome, byCode: sorted(byCode),
        duration: { samples: durationSamples, totalMs: totalDurationMs, maximumMs: durationSamples ? maximumDurationMs : null,
          meanMs: durationSamples ? Math.round(totalDurationMs / durationSamples) : null },
        firstMatchingSequence: events[0]?.sequence ?? null, lastMatchingSequence: events.at(-1)?.sequence ?? null,
        ...retention(), retainedEventsOnly: true, deterministic: true, llmCalls: false };
      if (cache.size >= LIMITS.summaryCache) cache.delete(cache.keys().next().value);
      cache.set(key, summary); return { ok: true, summary: structuredClone(summary), cacheHit: false };
    }),
    close() {
      if (closePromise) return closePromise;
      closing = true; cache.clear(); closePromise = store.close().finally(() => { closed = true; }); return closePromise;
    }
  };
}
