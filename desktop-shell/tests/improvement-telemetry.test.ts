import { describe, expect, it } from 'vitest';
import { buildImprovementTelemetry, verifiedAcceptance, type TelemetryOptions } from '../src/renderer/improvement/telemetry.js';

const now = '2026-11-22T12:00:00.000Z';
const before = '2026-11-22T11:59:50.000Z';
const after = '2026-11-22T12:00:05.000Z';
const options: TelemetryOptions = { scope: { companyId: 'a' }, now, sampledAt: now };
function job(extra: Record<string, unknown> = {}) {
  return { id: 'j', companyId: 'a', officeId: 'office-a', departmentId: 'dept-a', employeeId: 'employee-a',
    status: 'queued', costStatus: 'none', usage: { costUsd: 0 }, usageRecorded: false,
    startedAt: null, finishedAt: null, workerId: null, leaseExpiresAt: null, ...extra };
}
function fixture(jobs: ReturnType<typeof job>[] = []) {
  return { companies: [{ id: 'a', name: 'Company A' }, { id: 'b', name: 'Company B' }],
    offices: [{ id: 'office-a', companyId: 'a' }, { id: 'office-b', companyId: 'b' }],
    departments: [{ id: 'dept-a', companyId: 'a', officeId: 'office-a', name: 'Engineering' }],
    employees: [{ id: 'employee-a', companyId: 'a', officeId: 'office-a', departmentId: 'dept-a', name: 'Alice', status: 'active' },
      { id: 'employee-b', companyId: 'b', officeId: 'office-b', departmentId: null, name: 'Bea', status: 'active' }], jobs };
}
const leased = () => job({ status: 'running', startedAt: before, workerId: 'worker', leaseExpiresAt: after });
const workerEvidence: TelemetryOptions['workerEvidence'] = { sampledAt: now, activeCalls: [{ jobId: 'j', phase: 'provider', startedAt: before }] };
function pair() {
  const primaryHash = 'a'.repeat(64), reviewHash = 'b'.repeat(64);
  return [job({ id: 'primary', status: 'completed', finishedAt: before, artifactSha256: primaryHash, goalId: 'goal', goalIteration: 1,
    pair: { stepId: 'step', phase: 'primary', peerEmployeeId: 'employee-b', primaryJobId: 'primary', reviewJobId: 'review' } }),
  job({ id: 'review', employeeId: 'employee-b', status: 'completed', finishedAt: before, artifactSha256: reviewHash, goalId: 'goal', goalIteration: 1,
    pair: { stepId: 'step', phase: 'review', peerEmployeeId: 'employee-a', primaryJobId: 'primary', reviewJobId: 'review' },
    review: { verdict: 'accepted', primaryArtifactComplete: true, primaryArtifactSha256: primaryHash, reviewArtifactSha256: reviewHash, recordedAt: now } })];
}

describe('bounded native improvement telemetry', () => {
  it('does not confuse loaded employees, a current lease, or queued work with provider execution', () => {
    expect(buildImprovementTelemetry(fixture(), options).activity).toMatchObject({ runningEmployees: null, summary: { loadedEmployees: 1, state: 'quiet', executing: null } });
    const preparing = buildImprovementTelemetry(fixture([leased()]), options);
    expect(preparing.activity?.summary).toMatchObject({ state: 'preparing', leasedRunning: 1, executing: null });
    expect(preparing.activity?.summary.label).toContain('leased / preparing');
    expect(buildImprovementTelemetry(fixture([job()]), { ...options, workerEvidence }).activity?.summary).toMatchObject({ state: 'queued', executing: 0 });
    const executing = buildImprovementTelemetry(fixture([leased()]), { ...options, workerEvidence });
    expect(executing.activity).toMatchObject({ runningEmployees: 1, summary: { state: 'running', executing: 1 } });
    expect(executing.nextChangeAt).toBe(after);
  });

  it.each([
    ['expired lease', { leaseExpiresAt: now }], ['missing lease', { leaseExpiresAt: null }],
    ['future start', { startedAt: after }],
    ['unknown employee', { employeeId: 'absent' }],
  ])('withholds execution glow for %s', (_title, changes) => {
    const result = buildImprovementTelemetry(fixture([job({ ...leased(), ...changes })]), { ...options, workerEvidence });
    expect(result.activity?.summary).toMatchObject({ state: 'unknown', executing: 0 });
  });

  it('supports redacted cloud worker IDs only with a fresh matching callback and current lease', () => {
    const snapshot = fixture([job({ ...leased(), workerId: null })]);
    expect(buildImprovementTelemetry(snapshot, options).activity?.summary).toMatchObject({ state: 'unknown', leasedRunning: 0, executing: null });
    expect(buildImprovementTelemetry(snapshot, { ...options, workerEvidence }).activity?.summary).toMatchObject({ state: 'running', leasedRunning: 1, executing: 1 });
    for (const evidence of [
      { ...workerEvidence!, sampledAt: '2026-11-22T11:59:00Z' },
      { sampledAt: now, activeCalls: [{ jobId: 'other-job', phase: 'provider' as const, startedAt: before }] },
      { sampledAt: now, activeCalls: [{ jobId: 'j', phase: 'provider' as const, startedAt: '2026-11-22T11:59:40Z' }] },
    ]) expect(buildImprovementTelemetry(snapshot, { ...options, workerEvidence: evidence }).activity?.summary.state).not.toBe('running');
    expect(buildImprovementTelemetry(fixture([job({ ...leased(), workerId: null, leaseExpiresAt: now })]), { ...options, workerEvidence }).activity?.summary.executing).toBe(0);
  });

  it('accepts the explicit cloud publication freshness window without extending the native default', () => {
    const sampledAt = '2026-11-22T11:59:40Z', snapshot = fixture([job({ ...leased(), workerId: null })]);
    expect(buildImprovementTelemetry(snapshot, { ...options, sampledAt, workerEvidence }).activity?.summary.state).toBe('unknown');
    expect(buildImprovementTelemetry(snapshot, { ...options, sampledAt, workerEvidence, freshnessMs: 45_000 }).activity?.summary.state).toBe('running');
  });

  it('expires snapshot and callback evidence independently without inventing a new observation', () => {
    for (const sampledAt of [undefined, '2026-11-22T11:59:00Z', after, 'not a date']) {
      const result = buildImprovementTelemetry(fixture([leased()]), { ...options, sampledAt, workerEvidence });
      expect(result.activity?.summary).toMatchObject({ state: 'unknown', leasedRunning: null, executing: null });
      expect(result.activity?.runningEmployees).toBeNull();
    }
    const staleCalls = { ...workerEvidence!, sampledAt: '2026-11-22T11:59:00Z' };
    expect(buildImprovementTelemetry(fixture([leased()]), { ...options, workerEvidence: staleCalls }).activity?.summary.state).toBe('preparing');
    const result = buildImprovementTelemetry(fixture([job({ ...leased(), leaseExpiresAt: '2026-11-22T12:01:00Z' })]), { ...options, sampledAt: before, workerEvidence });
    expect(result.nextChangeAt).toBe('2026-11-22T12:00:05.001Z');
  });

  it('rejects malformed or duplicate callback evidence and callbacks predating the claim', () => {
    const invalid = [
      { sampledAt: now, activeCalls: [workerEvidence!.activeCalls[0], workerEvidence!.activeCalls[0]] },
      { sampledAt: now, activeCalls: [{ jobId: 'j', phase: 'claimed', startedAt: before }] },
      { sampledAt: now, activeCalls: [{ jobId: 'j', phase: 'provider', startedAt: after }] },
    ];
    for (const evidence of invalid) expect(buildImprovementTelemetry(fixture([leased()]), { ...options, workerEvidence: evidence as TelemetryOptions['workerEvidence'] }).activity?.summary).toMatchObject({ state: 'preparing', executing: null });
    expect(buildImprovementTelemetry(fixture([leased()]), { ...options, workerEvidence: { sampledAt: now, activeCalls: [{ jobId: 'j', phase: 'model', startedAt: '2026-11-22T11:59:40Z' }] } }).activity?.summary.executing).toBe(0);
  });

  it('scopes activity by executing company and department without pulling in a shared employee’s other work', () => {
    const a = job({ ...leased(), employeeId: 'employee-b' });
    const b = job({ ...leased(), id: 'other', companyId: 'b', officeId: 'office-b', departmentId: null, employeeId: 'employee-b' });
    const result = buildImprovementTelemetry(fixture([a, b]), { ...options, scope: { companyId: 'a', departmentId: 'dept-a' }, workerEvidence });
    expect(result.scope.officeId).toBe('office-a');
    expect(result.activity?.summary).toMatchObject({ jobs: 1, executing: 1, loadedEmployees: 1 });
    expect(result.activity?.perEmployee['employee-b']).toMatchObject({ jobs: 1, loadedEmployees: 0, executing: 1 });
    expect(buildImprovementTelemetry(fixture(), { ...options, scope: { companyId: 'b', departmentId: 'dept-a' } }).available).toBe(false);
  });

  it('keeps observed, estimated and reserved amounts separate without adding pending reservations again', () => {
    const jobs = [job({ id: 'observed', usage: { costUsd: 0.2 }, costStatus: 'observed', usageRecorded: true, pendingReservation: { costUsd: 99 } }),
      job({ id: 'estimate', usage: { costUsd: 0.3 }, costStatus: 'estimated' }),
      job({ id: 'reserve', usage: { costUsd: 0.4 }, costStatus: 'reserved', reservation: { costUsd: 0.4 } })];
    expect(buildImprovementTelemetry(fixture(jobs), options).costs).toEqual({ observedUsd: 0.2, estimatedUsd: 0.3, reservedUsd: 0.4, committedUsd: 0.9, unknownJobs: 0 });
    jobs.push(job({ id: 'incomplete', costStatus: 'observed', usage: { costUsd: 8 }, usageRecorded: false }));
    expect(buildImprovementTelemetry(fixture(jobs), options).costs).toMatchObject({ observedUsd: 0.2, committedUsd: null, unknownJobs: 1 });
  });

  it('uses retained recorded timestamps for output and cost history, with no implied billing ledger or complete history', () => {
    const jobs = [job({ id: 'finished', status: 'completed', finishedAt: before, artifactSha256: 'a'.repeat(64), usage: { costUsd: 1 }, costStatus: 'observed', usageRecorded: true }),
      job({ id: 'undated', status: 'completed', finishedAt: null }),
      job({ id: 'future', status: 'completed', finishedAt: after }),
      job({ id: 'old', status: 'completed', finishedAt: '2026-11-20T10:00:00Z' }),
      job({ id: 'reserved', status: 'running', usage: { costUsd: 20 }, costStatus: 'reserved' })];
    const result = buildImprovementTelemetry(fixture(jobs), options);
    expect(result.history).toMatchObject({ complete: false, basis: 'retained-native-jobs', costBasis: 'completed-job-cost-by-finish-time', undatedJobs: 1, excludedFutureJobs: 1 });
    expect(result.history?.bins.reduce((n, bin) => n + bin.observedUsd, 0)).toBe(1);
    expect(result.history?.bins.reduce((n, bin) => n + bin.finishedJobs, 0)).toBe(1);
    expect(result.history?.bins.at(-1)?.recordedOutputs).toBe(1);
    expect(result.costs?.reservedUsd).toBe(20);
  });

  it('counts an accepted paired artifact once and bins review acceptance at its recorded time', () => {
    const result = buildImprovementTelemetry(fixture(pair()), options);
    expect(result.outputs).toEqual({ recorded: 1, accepted: 1, reviewRepair: 0 });
    expect(result.history?.bins.at(-1)).toMatchObject({ recordedOutputs: 1, acceptedOutputs: 1, finishedJobs: 2 });
  });

  it.each([
    ['changed primary artifact', (p: any) => { p.artifactSha256 = 'c'.repeat(64); }],
    ['changed review artifact', (_p: any, r: any) => { r.artifactSha256 = 'c'.repeat(64); }],
    ['incomplete primary', (_p: any, r: any) => { r.review.primaryArtifactComplete = false; }],
    ['unaccepted review', (_p: any, r: any) => { r.review.verdict = 'revise'; }],
    ['self review', (p: any, r: any) => { r.employeeId = p.employeeId; }],
    ['cross-company review', (_p: any, r: any) => { r.companyId = 'b'; }],
    ['different iteration', (_p: any, r: any) => { r.goalIteration = 2; }],
    ['broken pair peer', (_p: any, r: any) => { r.pair.peerEmployeeId = 'other'; }],
    ['review repair', (_p: any, r: any) => { r.reviewFailure = { reason: 'artifact-mismatch' }; }],
    ['future review', (_p: any, r: any) => { r.review.recordedAt = after; }],
    ['undated completion', (p: any) => { p.finishedAt = null; }],
  ])('does not call output accepted with %s', (_reason, mutate) => {
    const jobs = pair(); mutate(jobs[0], jobs[1]);
    expect(buildImprovementTelemetry(fixture(jobs), options).outputs?.accepted).toBe(0);
  });

  it('fails closed on invalid collections, IDs, scopes and bounds instead of publishing partial charts', () => {
    const cases = [null, {}, { ...fixture(), jobs: [job(), job()] }, { ...fixture(), jobs: [job({ id: '\n' })] },
      { ...fixture(), jobs: Array.from({ length: 60_000 }, (_, i) => job({ id: String(i) })) }];
    for (const input of cases) expect(buildImprovementTelemetry(input, options)).toMatchObject({ available: false, activity: null, costs: null, history: null });
    expect(buildImprovementTelemetry(fixture(), { ...options, scope: { companyId: 'a', officeId: '' } }).available).toBe(false);
    expect(verifiedAcceptance({}, new Map(), NaN)).toBeNull();
    const bounded = buildImprovementTelemetry(fixture(), { ...options, bins: 100000, windowHours: 100000 });
    expect(bounded.history?.bins).toHaveLength(48);
    expect(buildImprovementTelemetry(fixture([job({ status: 'unsupported' })]), options).activity?.summary.state).toBe('unknown');
  });

  it('does not mutate input records or return nonfinite amounts from malformed usage', () => {
    const input = fixture([job({ usage: { costUsd: NaN }, costStatus: 'observed', usageRecorded: true })]);
    const original = structuredClone(input), beforeOptions = structuredClone(options);
    const freeze = (value: any): any => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };
    const result = buildImprovementTelemetry(freeze(input), freeze(options));
    expect(result.costs).toMatchObject({ observedUsd: 0, committedUsd: null, unknownJobs: 1 });
    expect(input).toEqual(original); expect(options).toEqual(beforeOptions);
  });
});
