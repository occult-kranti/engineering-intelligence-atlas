import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';

type Level = 0 | 1 | 2 | 3 | 4 | 'unknown';
interface Metric { level: Level; value: number | null; numerator: number | null; denominator: number | null; ratio: number | null; unknown: boolean; label: string; detail: string }
interface Group { id: string; name: string; jobs: number; employees: number; workload: Metric; budget: Metric; attention: Metric }
interface Result { scopeValid: boolean; summary: Group; perEmployee: Record<string, Group>; perDepartment: Record<string, Group>; perRoom: Record<string, Group>; globalBudget: Metric; sample: { status: string; stale: boolean; ageMs: number | null }; diagnostics: { duplicateRecords: number; ambiguousPlacements: number; unplacedJobs: number; unknownStatusJobs: number; warnings: string[] }; legend: Record<string, Array<{level: Level; label: string; detail: string}>> }
const source = fs.readFileSync(path.resolve(__dirname, '../src/renderer/office-signals.ts'), 'utf8');
const code = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
const context = vm.createContext({});
new vm.Script(code, { filename: 'office-signals.js' }).runInContext(context);
const api = context.DaftarSignals as { version: number; build(input: unknown, options: Record<string, unknown>): Result };
const NOW = '2026-11-20T18:00:00.000Z';
const build = (snapshot: unknown, options: Record<string, unknown> = {}) => api.build(snapshot, { now: NOW, ...options });
const job = (id: string, changes: Record<string, unknown> = {}) => ({ id, companyId: 'a', officeId: 'a-office', departmentId: 'a-eng', employeeId: 'local', status: 'queued', dependencies: [], costStatus: 'none', usage: { costUsd: 0 }, limits: { maxUsd: 10 }, reservation: null, pendingReservation: null, leaseExpiresAt: null, createdAt: '2020-01-01T00:00:00.000Z', updatedAt: '2020-01-01T00:00:00.000Z', dueAt: '2020-01-01T00:00:00.000Z', ...changes });
function fixture() {
  return {
    companies: [{ id: 'a', name: 'Company A' }, { id: 'b', name: 'Company B' }],
    offices: [{ id: 'a-office', companyId: 'a', name: 'Office A' }, { id: 'b-office', companyId: 'b', name: 'Office B' }],
    departments: [{ id: 'a-eng', companyId: 'a', officeId: 'a-office', name: 'Engineering' }, { id: 'a-design', companyId: 'a', officeId: 'a-office', name: 'Design' }, { id: 'b-eng', companyId: 'b', officeId: 'b-office', name: 'Shared Engineering' }],
    employees: [{ id: 'local', name: 'Local engineer', companyId: 'a', officeId: 'a-office', departmentId: 'a-eng', status: 'active' }, { id: 'designer', name: 'Designer', companyId: 'a', officeId: 'a-office', departmentId: 'a-design', status: 'paused' }, { id: 'shared', name: 'Shared engineer', companyId: 'b', officeId: 'b-office', departmentId: 'b-eng', status: 'active' }],
    jobs: [job('a-queued'), job('a-shared', { employeeId: 'shared', status: 'running', leaseExpiresAt: '2026-11-20T18:05:00.000Z', costStatus: 'reserved', usage: { costUsd: 2 }, reservation: { costUsd: 2 } }), job('b-job', { companyId: 'b', officeId: 'b-office', departmentId: 'b-eng', employeeId: 'shared', status: 'failed', costStatus: 'observed', usage: { costUsd: 7 } })],
    blueprints: [{ id: 'bp-a', companyId: 'a', officeId: 'a-office', rooms: [{ id: 'room-a', departmentId: 'a-eng', name: 'Engineering room' }, { id: 'room-design', departmentId: 'a-design', name: 'Design room' }], desks: [{ id: 'desk-local', roomId: 'room-a', employeeId: 'local' }, { id: 'desk-shared', roomId: 'room-a', employeeId: 'shared' }, { id: 'desk-design', roomId: 'room-design', employeeId: 'designer' }] }],
    portfolio: { contracts: [{ id: 'contract-a', status: 'active', recipientCompanyId: 'a', recipientOfficeId: null, recipientDepartmentId: null, employeeIds: ['shared'] }] },
    policy: { budget: { hardCapUsd: 100 } }, budget: { committedUsd: 14, observedUsd: 7, reservedUsd: 7, estimatedUsd: 0 },
  };
}
const freeze = (value: unknown): void => { if (value && typeof value === 'object') { Object.freeze(value); for (const child of Object.values(value)) freeze(child); } };

describe('shared office signal projection', () => {
  it('exposes a DOM-free classic-script API and never mutates saved records', () => {
    const input = fixture(); const before = JSON.stringify(input); freeze(input);
    expect(api.version).toBe(1); expect(build(input, { companyId: 'a' }).scopeValid).toBe(true);
    expect(JSON.stringify(input)).toBe(before);
    expect(Object.isFrozen(api)).toBe(true);
  });

  it('follows job execution scope for borrowed employees without importing their other-company work', () => {
    const result = build(fixture(), { companyId: 'a', officeId: 'a-office' });
    expect(result.summary.jobs).toBe(2); expect(result.summary.employees).toBe(3);
    expect(result.summary.workload.numerator).toBe(2);
    expect(result.perEmployee.shared.jobs).toBe(1); expect(result.perEmployee.shared.attention.numerator).toBe(0);
    expect(result.perDepartment['a-eng'].jobs).toBe(2); expect(result.perDepartment['b-eng']).toBeUndefined();
    expect(result.perRoom['room-a'].jobs).toBe(2); expect(result.perRoom['room-a'].employees).toBe(2);
    expect(result.summary.budget.numerator).toBe(2); expect(result.summary.budget.denominator).toBe(20);
    const b = build(fixture(), { companyId: 'b' }); expect(b.summary.jobs).toBe(1); expect(b.summary.budget.numerator).toBe(7);
  });

  it('includes inherited active service assignments once and preserves department scope', () => {
    const input = fixture(); input.portfolio.contracts.push({ ...input.portfolio.contracts[0], id: 'contract-a-repeat' });
    const result = build(input, { companyId: 'a', officeId: 'a-office', departmentId: 'a-eng' });
    expect(result.summary.employees).toBe(2); expect(Object.keys(result.perEmployee).sort()).toEqual(['local', 'shared']);
    expect(result.perDepartment['a-design']).toBeUndefined(); expect(result.perRoom['room-design']).toBeUndefined();
    expect(result.summary.jobs).toBe(2);
  });

  it('does not add reservation or pending-admission fields to the native recorded cost', () => {
    const input = fixture(); input.jobs = [
      job('reserved', { costStatus: 'reserved', usage: { costUsd: 2 }, reservation: { costUsd: 2 }, pendingReservation: { costUsd: 9 } }),
      job('waiting', { status: 'waiting-budget', pendingReservation: { costUsd: 3 } }),
      job('estimated', { status: 'needs-review', costStatus: 'estimated', usage: { costUsd: 1.5 }, reservation: { costUsd: 4 } }),
      job('observed', { status: 'completed', costStatus: 'observed', usage: { costUsd: 0.5 }, reservation: { costUsd: 1 } }),
    ];
    const result = build(input, { companyId: 'a' });
    expect(result.summary.budget.numerator).toBe(4); expect(result.summary.budget.denominator).toBe(40);
    expect(result.summary.budget.ratio).toBe(0.1); expect(result.summary.budget.detail).toContain('$2.00 reserved');
    expect(result.summary.budget.detail).toContain('$1.50 estimated');
  });

  it('keeps the native global ceiling separate from summed individual job allowances', () => {
    const input = fixture(); const result = build(input, { companyId: 'a' });
    expect(result.summary.budget.ratio).toBe(0.1);
    expect(result.globalBudget.numerator).toBe(14); expect(result.globalBudget.denominator).toBe(100);
    expect(result.globalBudget.ratio).toBe(0.14); expect(result.globalBudget.detail).toContain('external allocations');
  });

  it('distinguishes no records, observed zero, zero ceilings and missing monetary evidence', () => {
    const input = fixture(); input.jobs = [];
    const absent = build(input, { companyId: 'a' }); expect(absent.summary.workload.level).toBe('unknown');
    expect(absent.summary.budget.level).toBe('unknown'); expect(absent.summary.attention.level).toBe('unknown');
    input.jobs = [job('complete', { status: 'completed' })];
    const zero = build(input, { companyId: 'a' }); expect(zero.summary.workload.level).toBe(0); expect(zero.summary.budget.level).toBe(0); expect(zero.summary.attention.level).toBe(0);
    input.jobs = [job('zero', { limits: { maxUsd: 0 } })];
    expect(build(input).summary.budget.level).toBe('unknown');
    input.jobs = [job('breach', { limits: { maxUsd: 0 }, usage: { costUsd: 1 }, costStatus: 'observed' })];
    const breach = build(input).summary.budget; expect(breach.level).toBe(4); expect(breach.ratio).toBeNull(); expect(breach.label).toBe('Spend with zero allowance');
    input.jobs = [job('missing', { limits: {} })]; expect(build(input).summary.budget.unknown).toBe(true);
    input.jobs = [job('bad', { usage: { costUsd: Number.NaN }, costStatus: 'observed' })]; expect(build(input).summary.budget.unknown).toBe(true);
  });

  it('does not hide a job with zero allowance by combining it with other job allowances', () => {
    const input = fixture(); input.jobs = [job('zero-limit-spend', { limits: { maxUsd: 0 }, costStatus: 'observed', usage: { costUsd: 1 } }), job('large-allowance', { limits: { maxUsd: 100 } })];
    expect(build(input).summary.budget.level).toBe(4); expect(build(input).summary.budget.label).toBe('Spend with zero allowance');
  });

  it('counts native unresolved statuses and distinct attention jobs, without treating dispatch times as deadlines', () => {
    const input = fixture(); input.jobs = [
      job('queued', { dependencies: ['failed'] }), job('running', { status: 'running', leaseExpiresAt: '2026-11-20T17:59:00.000Z', dependencies: ['failed'] }),
      job('paused', { status: 'paused' }), job('waiting', { status: 'waiting-budget' }),
      job('completed', { status: 'completed' }), job('cancelled', { status: 'cancelled' }), job('failed', { status: 'failed' }),
      job('exhausted', { status: 'budget-exhausted' }), job('review', { status: 'needs-review' }),
    ];
    const group = build(input).summary;
    expect(group.workload.numerator).toBe(4); expect(group.workload.level).toBe(2);
    expect(group.attention.numerator).toBe(6); expect(group.attention.level).toBe(4);
    expect(group.attention.detail).toContain('1 expired leases');
    input.jobs = [job('past-dispatch-time')]; expect(build(input).summary.attention.numerator).toBe(0);
  });

  it('keeps absent lease/dependency evidence and unsupported status unknown', () => {
    const input = fixture(); input.jobs = [job('unverified-running', { status: 'running' })];
    expect(build(input).summary.attention.unknown).toBe(true);
    input.jobs = [job('missing-dependency', { dependencies: ['not-in-snapshot'] })];
    expect(build(input).summary.attention.unknown).toBe(true);
    input.jobs = [job('unsupported', { status: 'apparently-good' })];
    const result = build(input); expect(result.summary.workload.unknown).toBe(true); expect(result.summary.attention.unknown).toBe(true); expect(result.diagnostics.unknownStatusJobs).toBe(1);
  });

  it('uses explicit snapshot receipt age, preserving historical values while suppressing stale intensity', () => {
    const input = fixture();
    const fresh = build(input, { companyId: 'a', sampledAt: NOW });
    expect(fresh.sample.status).toBe('fresh'); expect(fresh.summary.workload.level).toBe(1);
    const stale = build(input, { companyId: 'a', sampledAt: '2026-11-20T17:00:00.000Z' });
    expect(stale.sample.stale).toBe(true); expect(stale.summary.workload.level).toBe('unknown'); expect(stale.summary.workload.numerator).toBe(2);
    expect(stale.perRoom['room-a'].budget.level).toBe('unknown'); expect(stale.globalBudget.level).toBe('unknown');
    const unspecified = build(input); expect(unspecified.sample.status).toBe('unknown'); expect(unspecified.sample.ageMs).toBeNull();
    expect(unspecified.summary.workload.unknown).toBe(false);
    expect(build(input, { sampledAt: '2026-11-20T19:00:00.000Z' }).sample.status).toBe('unknown');
    expect(build(input, { now: 'invalid' }).scopeValid).toBe(false);
  });

  it('rejects contradictory scope filters and never falls back to a larger scope', () => {
    for (const options of [{ companyId: 'a', officeId: 'b-office' }, { companyId: 'b', departmentId: 'a-eng' }, { companyId: 'missing' }, { employeeId: 'missing' }]) {
      const result = build(fixture(), options); expect(result.scopeValid).toBe(false); expect(result.summary.jobs).toBe(0); expect(result.summary.workload.level).toBe('unknown'); expect(Object.keys(result.perEmployee)).toHaveLength(0);
    }
    const one = build(fixture(), { companyId: 'a', employeeId: 'shared' }); expect(one.scopeValid).toBe(true); expect(one.summary.jobs).toBe(1); expect(one.summary.budget.numerator).toBe(2);
  });

  it('deduplicates job IDs, service assignments and room placements without double counting', () => {
    const input = fixture(); input.jobs.push(input.jobs[0]);
    input.blueprints[0].rooms.push({ id: 'room-z', departmentId: 'a-eng', name: 'Second engineering room' });
    input.blueprints[0].desks.push({ id: 'duplicate-placement', roomId: 'room-z', employeeId: 'local' });
    const result = build(input, { companyId: 'a' });
    expect(result.summary.jobs).toBe(2); expect(result.diagnostics.duplicateRecords).toBe(1); expect(result.diagnostics.ambiguousPlacements).toBe(1);
    expect(Object.values(result.perRoom).reduce((sum, group) => sum + group.jobs, 0)).toBe(2);
    expect(result.perRoom['room-a'].jobs).toBe(2); expect(result.perRoom['room-z'].jobs).toBe(0);
  });

  it('preserves scope totals when jobs have no room placement', () => {
    const input = fixture(); input.blueprints[0].desks = [];
    const result = build(input, { companyId: 'a' });
    expect(result.summary.jobs).toBe(2); expect(result.diagnostics.unplacedJobs).toBe(2); expect(result.perRoom['room-a'].workload.unknown).toBe(true);
  });

  it('refuses an oversized projection instead of presenting a partial heatmap', () => {
    const input = fixture();
    const tooMany = { ...input, employees: new Array(60_001).fill(input.employees[0]) };
    expect(build(tooMany).scopeValid).toBe(false); expect(build(tooMany).summary.jobs).toBe(0);
    const tooManyLinks = { ...input, portfolio: { contracts: [{ ...input.portfolio.contracts[0], employeeIds: new Array(200_001).fill('shared') }] } };
    expect(build(tooManyLinks).scopeValid).toBe(false);
  });

  it('uses fixed cross-scope thresholds rather than relative rankings', () => {
    const input = fixture(); input.jobs = Array.from({ length: 10 }, (_, i) => job('job-' + i));
    const result = build(input, { companyId: 'a' }); expect(result.summary.workload.level).toBe(4); expect(result.perEmployee.local.workload.level).toBe(4);
    input.jobs = [job('half', { costStatus: 'observed', usage: { costUsd: 5 } })]; expect(build(input).summary.budget.level).toBe(2);
    input.jobs = [job('four-fifths', { costStatus: 'reserved', usage: { costUsd: 8 } })]; expect(build(input).summary.budget.level).toBe(3);
    input.jobs = [job('full', { costStatus: 'estimated', usage: { costUsd: 10 } })]; expect(build(input).summary.budget.level).toBe(4);
    expect(Object.isFrozen(result.legend.workload)).toBe(true);
  });

  it('keeps percentage labels consistent at thresholds and preserves tiny nonzero costs', () => {
    const input = fixture();
    input.jobs = [job('almost-warning', { costStatus: 'observed', usage: { costUsd: 7.999 } })];
    expect(build(input).summary.budget.level).toBe(2); expect(build(input).summary.budget.label).toBe('79% job allowance');
    input.jobs = [job('twenty-nine', { costStatus: 'observed', usage: { costUsd: 2.9 } })];
    expect(build(input).summary.budget.label).toBe('29% job allowance');
    input.jobs = [job('tiny', { costStatus: 'observed', usage: { costUsd: 0.0001 } })];
    expect(build(input).summary.budget.label).toBe('<1% job allowance'); expect(build(input).summary.budget.level).toBe(1);
  });

  it('projects a 5,000-job fixture with exact aggregate and ownership totals', () => {
    const input = fixture();
    input.employees = Array.from({ length: 100 }, (_, i) => ({ ...input.employees[0], id: 'worker-' + i }));
    input.jobs = Array.from({ length: 5000 }, (_, i) => job('job-' + i, { employeeId: 'worker-' + (i % 100), costStatus: 'reserved', usage: { costUsd: 0.25 } }));
    input.blueprints = []; input.portfolio.contracts = [];
    const result = build(input, { companyId: 'a' });
    expect(result.scopeValid).toBe(true); expect(result.summary.jobs).toBe(5000); expect(result.summary.employees).toBe(100); expect(result.summary.budget.numerator).toBe(1250);
    expect(Object.values(result.perEmployee).reduce((sum, group) => sum + group.jobs, 0)).toBe(5000);
    expect(result.perEmployee['worker-99'].jobs).toBe(50);
  });
});
