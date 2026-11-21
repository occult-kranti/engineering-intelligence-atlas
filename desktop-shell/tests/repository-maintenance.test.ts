import { describe, expect, it } from 'vitest';
import { repositoryReviewSchedules } from '../src/main/repositoryMaintenance';
import { assertWorkerCapability } from '../src/main/office';
import type { OfficeCommand, OfficeSnapshot, OfficeJob, OfficePortfolio } from '../src/shared/office';
const request: OfficeCommand = { action: 'schedule_repository_reviews' };
function snapshot(): OfficeSnapshot {
  return { schemaVersion: 1, activeCompanyId: 'a', companies: [{ id: 'a', name: 'Project A', repoUrl: 'https://github.com/example/project-a', status: 'active', assistantId: 'donna', createdAt: '', source: 'fixture', importedAt: null, githubStatus: 'unchecked' }],
    offices: [{ id: 'office', companyId: 'a', name: 'Office', status: 'active', assistantId: 'donna', createdAt: '' }], departments: [],
    employees: [{ id: 'git', companyId: 'a', officeId: 'office', departmentId: null, name: 'GitHub', role: 'Steward', kind: 'specialist', status: 'active', skillPaths: [], assignmentKey: 'github-steward', createdAt: '', updatedAt: '' }], jobs: [], schedules: [], cache: { enabled: false, maxEntries: 20, ttlMinutes: 60, entries: [], hits: 0, misses: 0 }, knowledge: [], events: [], lastAction: null };
}
describe('portfolio repository maintenance schedules', () => {
  it('prepares bounded daily source reviews, paused and without publication capability', () => {
    const [command] = repositoryReviewSchedules(snapshot(), request);
    expect(command).toMatchObject({ action: 'create_schedule', enabled: false, everyMinutes: 1440, companyId: 'a' });
    expect(command?.jobTemplate).toMatchObject({ authorized: false, maxTokens: 48000, maxUsd: .25, allowedTools: ['github.read_repository'], employeeId: 'git' });
  });
  it('does not duplicate an existing review or silently re-enable it', () => {
    const s = snapshot(); s.schedules.push({ id: 's', companyId: 'a', name: 'Repository review · a', enabled: false, everyMinutes: 1440, nextRunAt: '', lastEnqueuedAt: null, jobTemplate: {} });
    expect(repositoryReviewSchedules(s, { ...request, enabled: true })).toEqual([]);
    expect(s.schedules[0]?.enabled).toBe(false);
  });
  it('requires explicit prices when the review model differs from the priced default', () => {
    expect(() => repositoryReviewSchedules(snapshot(), { ...request, model: 'different-model' })).toThrow(/current model prices/);
    expect(repositoryReviewSchedules(snapshot(), { ...request, model: 'different-model', priceRates: { inputUsdPerMillion: 5, outputUsdPerMillion: 25 } })[0]?.jobTemplate).toMatchObject({ model: 'different-model', priceRates: { inputUsdPerMillion: 5, outputUsdPerMillion: 25 } });
  });
  it('selects a requested company and rejects unknown recipients', () => {
    expect(repositoryReviewSchedules(snapshot(), { ...request, companyIds: [] })).toEqual([]);
    expect(() => repositoryReviewSchedules(snapshot(), { ...request, companyIds: ['unknown'] })).toThrow(/no longer exists/);
  });
  it.each([{ everyMinutes: 1 }, { everyMinutes: 10081 }, { everyMinutes: NaN }, { maxUsd: 0 }, { maxUsd: 101 }, { maxTokens: 1000000 }, { provider: 'unknown' }, { enabled: 'true' }, { priceRates: { inputUsdPerMillion: NaN, outputUsdPerMillion: 10 } }, { provider: 'openai' }])('rejects an invalid bounded allocation %j', bad => {
    expect(() => repositoryReviewSchedules(snapshot(), { ...request, ...bad })).toThrow();
  });
  it('requires an active scoped steward and preserves the snapshot', () => {
    const s = snapshot(); s.employees[0]!.status = 'paused'; const before = JSON.stringify(s);
    expect(() => repositoryReviewSchedules(s, request)).toThrow(/steward/);
    expect(JSON.stringify(s)).toBe(before);
  });
  it('does not create a partial batch when the schedule capacity would be exceeded', () => {
    const s = snapshot(); s.schedules = Array.from({ length: 1000 }, (_, i) => ({ id: String(i), companyId: 'a', name: String(i), enabled: false, everyMinutes: 1440, nextRunAt: '', lastEnqueuedAt: null, jobTemplate: {} }));
    expect(() => repositoryReviewSchedules(s, request)).toThrow(/1,000/);
    expect(s.schedules).toHaveLength(1000);
  });
});

describe('managed tool revalidation after a model finishes', () => {
  function assigned() {
    const s = snapshot(); const job = { id: 'j', companyId: 'a', officeId: 'office', departmentId: null, employeeId: 'git', status: 'running', leaseToken: 'lease', authorized: true, allowedTools: ['github.publish_changes'] } as OfficeJob;
    s.jobs.push(job); return { s, job: { ...job } };
  }
  it('allows only the currently assigned and approved capability', () => {
    const { s, job } = assigned(); expect(() => assertWorkerCapability(s, job, 'github.publish_changes')).not.toThrow();
    expect(() => assertWorkerCapability(s, job, 'github.read_repository')).toThrow(/lease/);
  });
  it.each(['lease', 'employee', 'company', 'job', 'approval'])('rejects a changed %s before an external write', kind => {
    const { s, job } = assigned();
    if (kind === 'lease') s.jobs[0]!.leaseToken = 'new';
    if (kind === 'employee') s.employees[0]!.status = 'paused';
    if (kind === 'company') s.companies[0]!.status = 'paused';
    if (kind === 'job') s.jobs[0]!.status = 'paused';
    if (kind === 'approval') s.jobs[0]!.authorized = false;
    expect(() => assertWorkerCapability(s, job, 'github.publish_changes')).toThrow();
  });
  it('rejects a revoked shared capability even though its in-flight provider job can still settle', () => {
    const { s, job } = assigned(); job.serviceContractId = 'contract'; s.jobs[0]!.serviceContractId = 'contract';
    s.departments.push({ id: 'dep', companyId: 'a', officeId: 'office', name: 'Shared', assistantId: 'git', status: 'active', createdAt: '' });
    s.portfolio = { ceo: { enabled: true, title: 'CEO', focusGroupId: null, sharedServicesCompanyId: 'a', updatedAt: '' }, groups: [], services: [{ id: 'service', key: 'engineering', name: 'Engineering', companyId: 'a', officeId: 'office', departmentId: 'dep', employeeIds: ['git'], status: 'active', createdAt: '', updatedAt: '' }], contracts: [{ id: 'contract', serviceId: 'service', recipientCompanyId: 'a', recipientOfficeId: null, recipientDepartmentId: null, employeeIds: ['git'], allowedTools: ['github.publish_changes'], status: 'active', createdAt: '', updatedAt: '' }], transfers: [], roadmap: [], recommendations: [] } as OfficePortfolio;
    expect(() => assertWorkerCapability(s, job, 'github.publish_changes')).not.toThrow();
    s.portfolio.contracts[0]!.status = 'revoked';
    expect(() => assertWorkerCapability(s, job, 'github.publish_changes')).toThrow(/revoked/);
    expect(s.jobs[0]!.status).toBe('running');
  });
  it.each(['worker-home', 'service-host'])('rechecks a paused %s portfolio group before publication', target => {
    const { s, job } = assigned();
    s.companies.push({ ...s.companies[0]!, id: 'home', name: 'Fixture home', repoUrl: null });
    s.offices.push({ ...s.offices[0]!, id: 'home-office', companyId: 'home' });
    if (target === 'worker-home') { s.employees[0]!.companyId = 'home'; s.employees[0]!.officeId = 'home-office'; }
    const host = target === 'service-host' ? 'home' : 'a'; const hostOffice = target === 'service-host' ? 'home-office' : 'office';
    s.departments.push({ id: 'service-department', companyId: host, officeId: hostOffice, name: 'Service', assistantId: 'git', status: 'active', createdAt: '' });
    job.serviceContractId = 'contract'; s.jobs[0]!.serviceContractId = 'contract';
    s.portfolio = { ceo: { enabled: true, title: 'CEO', focusGroupId: null, sharedServicesCompanyId: host, updatedAt: '' },
      groups: [{ id: 'home-group', name: 'Home group', description: '', companyIds: ['home'], status: 'active', createdAt: '', updatedAt: '' }],
      services: [{ id: 'service', key: 'engineering', name: 'Engineering', companyId: host, officeId: hostOffice, departmentId: 'service-department', employeeIds: ['git'], status: 'active', createdAt: '', updatedAt: '' }],
      contracts: [{ id: 'contract', serviceId: 'service', recipientCompanyId: 'a', recipientOfficeId: null, recipientDepartmentId: null, employeeIds: ['git'], allowedTools: ['github.publish_changes'], status: 'active', createdAt: '', updatedAt: '' }], transfers: [], roadmap: [], recommendations: [] };
    expect(() => assertWorkerCapability(s, job, 'github.publish_changes')).not.toThrow();
    s.portfolio.groups[0]!.status = 'paused';
    expect(() => assertWorkerCapability(s, job, 'github.publish_changes')).toThrow(/group/);
    expect(s.jobs[0]!.status).toBe('running');
  });
  it('blocks publication when selected source knowledge was revoked after generation', () => {
    const { s, job } = assigned(); job.knowledgeTransferIds = ['transfer']; s.jobs[0]!.knowledgeTransferIds = ['transfer'];
    s.knowledge.push({ id: 'knowledge', companyId: 'source', title: 'Synthetic source', summary: 'Explicit fixture evidence', artifactUri: '/fixture/evidence', createdAt: '' });
    s.portfolio = { ceo: { enabled: true, title: 'CEO', focusGroupId: null, sharedServicesCompanyId: null, updatedAt: '' }, groups: [], services: [], contracts: [], transfers: [{ id: 'transfer', sourceCompanyId: 'source', recipientCompanyId: 'a', knowledgeId: 'knowledge', status: 'granted', purpose: 'Selected evidence', createdAt: '', updatedAt: '' }], roadmap: [], recommendations: [] };
    expect(() => assertWorkerCapability(s, job, 'github.publish_changes')).not.toThrow();
    s.portfolio.transfers[0]!.status = 'revoked';
    expect(() => assertWorkerCapability(s, job, 'github.publish_changes')).toThrow(/knowledge grant was revoked/);
    expect(s.jobs[0]!.status).toBe('running');
  });
});
