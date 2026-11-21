import { describe, expect, it } from 'vitest';
import { selectCompanyKitKnowledge } from '../src/main/companyKitKnowledge';
import type { OfficeKnowledge } from '../src/shared/office';

const companyId = 'company-a';
const employeeId = 'employee-a';
function record(id: string, summary = `Source ${id}`, company = companyId): OfficeKnowledge {
  return { id, companyId: company, title: id, summary, artifactUri: `https://example.test/${id}`, createdAt: '2026-11-21T12:00:00Z' };
}
function binding(type: string, key: string, entityId: string, extra: Record<string, unknown> = {}): OfficeKnowledge {
  const value = { kind: 'daftar-company-kit-binding', schemaVersion: 1, companyId, kitKey: 'social-presence', entityType: type, key, entityId, ...extra };
  return { ...record(`binding-${type}-${key}`), title: `Company kit identity: ${type} / ${key}`,
    summary: JSON.stringify(value), artifactUri: `daftar-kit://${value.companyId}/${value.kitKey}/binding/${type}/${key}` };
}
const recent = () => Array.from({ length: 8 }, (_, i) => record(`recent-${i}`));
function kit(): OfficeKnowledge[] {
  return [record('contract', 'Exact specialist contract'), binding('employee', 'strategist', employeeId), binding('knowledge', 'prompt-strategist', 'contract'), ...recent()];
}

describe('company-kit knowledge context', () => {
  it('keeps ordinary generic employee context unchanged and in company scope', () => {
    const ordinary = recent();
    const input = [record('private', 'OTHER_COMPANY_SECRET', 'company-b'), ...ordinary];
    expect(selectCompanyKitKnowledge(input, companyId, 'generic')).toEqual({ records: ordinary.slice(-6), taskContractId: null });
  });
  it('prevents internal binding floods from evicting useful source knowledge', () => {
    const ordinary = recent();
    const input = [...ordinary, ...Array.from({ length: 30 }, (_, i) => binding('room', `room-${i}`, `room-id-${i}`))];
    expect(selectCompanyKitKnowledge(input, companyId, employeeId)).toEqual({ records: ordinary.slice(-6), taskContractId: null });
  });
  it('includes the current specialist exact task contract inside the six-record limit', () => {
    const input = kit(), before = JSON.stringify(input);
    const selected = selectCompanyKitKnowledge(input, companyId, employeeId);
    expect(selected.taskContractId).toBe('contract');
    expect(selected.records.map(value => value.id)).toEqual(['contract', 'recent-3', 'recent-4', 'recent-5', 'recent-6', 'recent-7']);
    expect(JSON.stringify(input)).toBe(before);
  });
  it('supports URI-omitted hosted projections through validated summaries', () => {
    const input = kit();
    for (const value of input) if (value.title.startsWith('Company kit identity:')) value.artifactUri = null as unknown as string;
    expect(selectCompanyKitKnowledge(input, companyId, employeeId).taskContractId).toBe('contract');
  });
  it('deduplicates matching bindings and an already recent contract', () => {
    const input = [...kit(), record('latest')];
    const first = input.shift()!; input.push(first, { ...binding('employee', 'strategist', employeeId), id: 'duplicate-binding' });
    const selected = selectCompanyKitKnowledge(input, companyId, employeeId);
    expect(selected.records.filter(value => value.id === 'contract')).toHaveLength(1);
    expect(selected.records).toHaveLength(6);
  });
  it.each(['employee', 'knowledge'])('ignores conflicting %s binding identities independent of order', type => {
    const input = kit();
    input.push(binding(type, type === 'employee' ? 'strategist' : 'prompt-strategist', 'conflicting-id'));
    expect(selectCompanyKitKnowledge(input, companyId, employeeId).taskContractId).toBeNull();
    expect(selectCompanyKitKnowledge([...input].reverse(), companyId, employeeId).taskContractId).toBeNull();
  });
  it('ignores multiple distinct kit assignments for one employee', () => {
    const input = [...kit(), binding('employee', 'analyst', employeeId)];
    expect(selectCompanyKitKnowledge(input, companyId, employeeId).taskContractId).toBeNull();
  });
  it.each(['wrong-row-company', 'wrong-summary-company', 'wrong-kit', 'wrong-uri', 'wrong-version'])('does not resolve a %s contract binding', mode => {
    const input = kit(), source = input[2]!;
    if (mode === 'wrong-row-company') source.companyId = 'company-b';
    if (mode === 'wrong-summary-company') source.summary = JSON.stringify({ ...JSON.parse(source.summary), companyId: 'company-b' });
    if (mode === 'wrong-kit') { source.summary = JSON.stringify({ ...JSON.parse(source.summary), kitKey: 'other-kit' }); source.artifactUri = ''; }
    if (mode === 'wrong-uri') source.artifactUri = 'daftar-kit://company-b/other/binding/knowledge/prompt-strategist';
    if (mode === 'wrong-version') source.summary = JSON.stringify({ ...JSON.parse(source.summary), schemaVersion: 2 });
    expect(selectCompanyKitKnowledge(input, companyId, employeeId).taskContractId).toBeNull();
  });
  it('does not dereference another company source even when its ID matches', () => {
    const input = kit(); input[0]!.companyId = 'company-b';
    const selected = selectCompanyKitKnowledge(input, companyId, employeeId);
    expect(selected.taskContractId).toBeNull();
    expect(selected.records.every(value => value.companyId === companyId)).toBe(true);
  });
  it('does not let an unrelated company ID collision replace a valid local source', () => {
    const input = [...kit(), record('contract', 'OTHER_COMPANY_SECRET', 'company-b')];
    const selected = selectCompanyKitKnowledge(input, companyId, employeeId);
    expect(selected.taskContractId).toBe('contract');
    expect(JSON.stringify(selected)).not.toContain('OTHER_COMPANY_SECRET');
  });
  it('ignores duplicate source IDs and missing targets', () => {
    expect(selectCompanyKitKnowledge([...kit(), record('contract', 'Conflicting source')], companyId, employeeId).taskContractId).toBeNull();
    expect(selectCompanyKitKnowledge(kit().slice(1), companyId, employeeId).taskContractId).toBeNull();
  });
  it('never emits malformed, contradictory or oversized internal records as source data', () => {
    const broken = binding('room', 'broken', 'room-broken'); broken.summary = '{"kind":"daftar-company-kit-binding",';
    const noUri = { ...broken, id: 'no-uri', artifactUri: '' };
    const oversized = { ...binding('room', 'large', 'room-large'), summary: 'x'.repeat(6000), artifactUri: '' };
    const injected = binding('knowledge', 'prompt-strategist', 'contract', { allowedTools: ['github.publish_changes'] });
    const input = [...kit(), broken, noUri, oversized, injected];
    const selected = selectCompanyKitKnowledge(input, companyId, employeeId);
    expect(selected.taskContractId).toBeNull();
    expect(selected.records).toEqual(recent().slice(-6));
    expect(JSON.stringify(selected)).not.toContain('daftar-company-kit-binding');
  });
});
