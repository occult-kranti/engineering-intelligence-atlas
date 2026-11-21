import { describe, it, expect } from 'vitest';
import { observeOffice, type ObserveInput } from '../src/shared/office-observer';
const NOW = Date.parse('2026-11-21T04:00:00Z');
const base = (): ObserveInput => ({ index: { entityCount: 2, updatedAt: '2026-11-21T03:59:00Z' },
  ledger: [{ id: 'l1', jobId: 'j1', kind: 'call', amountUsd: 0.1 }],
  jobs: [{ id: 'j1', status: 'running', updatedAt: '2026-11-21T03:50:00Z' }], now: NOW });
const codes = (input: ObserveInput) => observeOffice(input).issues.map(issue => issue.code);
describe('permanent deterministic observer', () => {
  it('observes empty and valid states without a model call', () => {
    expect(observeOffice({ index: { entityCount: 0 }, ledger: [], jobs: [], now: NOW })).toMatchObject({ health: 'healthy', modelCalls: 0 });
    expect(observeOffice(base()).health).toBe('healthy');
  });
  it('groups duplicate ledger and job identities without truncating equality', () => {
    const input = base(); input.ledger.push(input.ledger[0]!, input.ledger[0]!); input.jobs.push(input.jobs[0]!);
    expect(observeOffice(input).issues.find(issue => issue.code === 'duplicate_ledger_id')?.count).toBe(2);
    expect(codes(input)).toContain('duplicate_job_id');
    const long = 'a'.repeat(100); input.jobs = [{ id: long + '1', status: 'completed' }, { id: long + '2', status: 'completed' }]; input.ledger = [];
    expect(observeOffice(input).health).toBe('healthy');
  });
  it('detects bad monetary values and missing job references', () => {
    const input = base(); input.ledger.push({ id: 'l2', kind: 'x', amountUsd: -1 }, { id: 'l3', kind: 'x', amountUsd: NaN }, { id: 'l4', jobId: 'ghost', kind: 'x', amountUsd: 1 });
    expect(codes(input)).toEqual(expect.arrayContaining(['negative_ledger_amount', 'invalid_ledger_amount', 'ledger_unknown_job']));
  });
  it('flags stale running jobs and malformed or impossible calendar dates', () => {
    const input = base(); input.jobs[0]!.updatedAt = '2026-11-21T03:00:00Z';
    input.jobs.push({ id: 'j2', status: 'running', updatedAt: '2026-02-31T00:00:00Z' });
    input.index = { entityCount: -3, updatedAt: 'yesterday' };
    expect(codes(input)).toEqual(expect.arrayContaining(['stale_running_job', 'invalid_job_date', 'invalid_index_count', 'invalid_index_date']));
  });
  it('is immutable and tolerates malformed input, huge and nonfinite clocks', () => {
    const input = base(), copy = structuredClone(input); observeOffice(input); expect(input).toEqual(copy);
    expect(observeOffice(null as never).health).toBe('attention');
    for (const now of [NaN, Infinity, 9e15]) expect(codes({ ...input, now })).toContain('invalid_now');
  });
  it('bounds diagnostic output under a large corrupt ledger', () => {
    const input = base(); input.ledger = Array.from({ length: 100_000 }, () => ({ id: 'same', kind: 'private text never returned', amountUsd: -1 }));
    const result = observeOffice(input);
    expect(result.issues).toHaveLength(2); expect(result.issues[0]!.count).toBe(100_000);
    expect(JSON.stringify(result)).not.toContain('private text');
  });
  it('uses live heartbeat leases for long jobs and detects expired leases', () => {
    const input = base(); input.jobs[0]!.updatedAt = '2026-11-21T02:00:00Z';
    input.jobs[0]!.leaseExpiresAt = '2026-11-21T04:01:00Z';
    expect(observeOffice(input).health).toBe('healthy');
    input.jobs[0]!.leaseExpiresAt = '2026-11-21T03:59:00Z';
    expect(codes(input)).toContain('expired_job_lease');
  });
});
