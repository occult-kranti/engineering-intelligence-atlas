import { describe, expect, it } from 'vitest';
import { buildDonnaTeam, proposeDonnaAction, type DonnaRole, type DonnaSnapshot } from '../src/renderer/freeflow/donna-team.js';

const NOW = Date.parse('2026-11-21T12:00:00Z');
const FOCUS = { kind: 'company', companyId: 'alpha' } as const;
const OPTIONS = { now: NOW };
function employee(id: string, companyId: string | null, officeId: string | null, departmentId: string | null, role = 'Shared assistant', kind = 'assistant') {
  return { id, companyId, officeId, departmentId, name: id, role, kind, status: 'active', skillPaths: [] as string[] };
}
function grant(id = 'g1', employeeId = 'a-donna', kind = 'company', scopeId = 'alpha') {
  return { id, employeeId, scope: { kind, id: scopeId }, capabilities: ['work.manage', 'team.manage'], issuer: 'owner',
    grantedAt: '2026-11-20T12:00:00Z', expiresAt: '2026-11-22T12:00:00Z', revokedAt: null as string | null, parentGrantIds: [] as string[] };
}
function fixture() {
  return {
    companies: [
      { id: 'alpha', name: 'Alpha', status: 'active', assistantId: 'a-donna' },
      { id: 'beta', name: 'Beta', status: 'active', assistantId: 'b-donna' },
      { id: 'shared', name: 'Shared services', status: 'active', assistantId: 's-donna' },
    ],
    offices: [
      { id: 'a-office', companyId: 'alpha', name: 'Main', status: 'active', assistantId: 'a-office-donna' },
      { id: 'b-office', companyId: 'beta', name: 'Beta main', status: 'active', assistantId: 'b-office-donna' },
      { id: 's-office', companyId: 'shared', name: 'Shared main', status: 'active', assistantId: 's-office-donna' },
    ],
    departments: [
      { id: 'a-dept', companyId: 'alpha', officeId: 'a-office', name: 'Engineering', status: 'active', assistantId: 'a-coordinator' },
      { id: 'a-child', companyId: 'alpha', officeId: 'a-office', name: 'Sub department', status: 'active', assistantId: 'child-coordinator' },
      { id: 's-dept', companyId: 'shared', officeId: 's-office', name: 'Repository', status: 'active', assistantId: 's-coordinator' },
    ],
    employees: [employee('donna', null, null, null, 'CEO assistant'), employee('a-donna', 'alpha', null, null),
      employee('b-donna', 'beta', null, null), employee('s-donna', 'shared', null, null),
      employee('a-office-donna', 'alpha', 'a-office', null), employee('a-coordinator', 'alpha', 'a-office', 'a-dept'),
      employee('child-coordinator', 'alpha', 'a-office', 'a-child'),
      employee('shared-repo', 'shared', 's-office', 's-dept', 'Repository integration steward', 'specialist')],
    jobs: [
      { employeeId: 'shared-repo', companyId: 'alpha', officeId: 'a-office', departmentId: 'a-dept', status: 'running' },
      { employeeId: 'shared-repo', companyId: 'beta', officeId: 'b-office', departmentId: null, status: 'running' },
      { employeeId: 'a-donna', companyId: 'alpha', officeId: 'a-office', departmentId: null, status: 'queued' },
    ],
    portfolio: {
      services: [{ id: 'repo-service', companyId: 'shared', officeId: 's-office', departmentId: 's-dept', employeeIds: ['shared-repo'], status: 'active' }],
      contracts: [{ id: 'repo-contract', serviceId: 'repo-service', recipientCompanyId: 'alpha', recipientOfficeId: null as string | null,
        recipientDepartmentId: null as string | null, employeeIds: ['shared-repo'], status: 'active' }],
    },
    authority: { grants: [grant()] },
  } satisfies DonnaSnapshot;
}
function role(snapshot: DonnaSnapshot, kind: DonnaRole, options = OPTIONS) {
  return buildDonnaTeam(snapshot, FOCUS, options).nodes.find(n => n.role === kind)!;
}

describe('Donna canvas crew', () => {
  it('uses actual assistant IDs and explicit organizational links', () => {
    const team = buildDonnaTeam(fixture(), FOCUS, OPTIONS);
    expect(team.nodes.find(n => n.role === 'donna')?.employeeId).toBe('donna');
    expect(team.nodes.find(n => n.role === 'company-assistant')?.employeeId).toBe('a-donna');
    expect(team.nodes.find(n => n.role === 'office-assistant')?.employeeId).toBe('a-office-donna');
    const dept = team.nodes.find(n => n.employeeId === 'a-coordinator')!;
    expect(team.edges).toContainEqual({ from: 'crew:office-assistant:a-office', to: dept.id });
    expect(team.nodes.every(n => n.companyId === 'alpha')).toBe(true);
    expect(role(fixture(), 'company-assistant').reportedRunningJobs).toBe(0);
    expect(role(fixture(), 'company-assistant').queuedJobs).toBe(1);
  });

  it('reports missing or mismatched references honestly without guessing names', () => {
    const s = fixture(); s.companies[0].assistantId = 'b-donna';
    const node = role(s, 'company-assistant');
    expect(node).toMatchObject({ employeeId: null, status: 'unconfigured', execution: 'unconfigured', actions: [] });
    const empty = buildDonnaTeam({}, { kind: 'portfolio' }, OPTIONS);
    expect(empty.nodes).toHaveLength(1);
    expect(empty.nodes[0]).toMatchObject({ employeeId: null, status: 'unconfigured' });
  });

  it('reuses a specialist only through an active matching service contract', () => {
    const s = fixture(), node = role(s, 'repository-steward');
    expect(node).toMatchObject({ employeeId: 'shared-repo', serviceContractId: 'repo-contract', reportedRunningJobs: 1 });
    expect(node.subtitle).not.toContain('running');
    for (const mutate of [
      () => { s.portfolio.contracts[0].status = 'revoked'; },
      () => { s.portfolio.contracts[0].status = 'active'; s.portfolio.services[0].status = 'paused'; },
      () => { s.portfolio.services[0].status = 'active'; s.portfolio.services[0].employeeIds = []; },
    ]) { mutate(); expect(role(s, 'repository-steward').employeeId).toBeNull(); }
  });

  it('does not broaden a department service contract to a company or sibling department', () => {
    const s = fixture(); s.portfolio.contracts[0].recipientOfficeId = 'a-office'; s.portfolio.contracts[0].recipientDepartmentId = 'a-dept';
    expect(role(s, 'repository-steward').employeeId).toBeNull();
    const focused = buildDonnaTeam(s, { kind: 'department', companyId: 'alpha', officeId: 'a-office', departmentId: 'a-dept' }, OPTIONS);
    expect(focused.nodes.find(n => n.role === 'repository-steward')?.employeeId).toBe('shared-repo');
    const sibling = buildDonnaTeam(s, { kind: 'department', companyId: 'alpha', officeId: 'a-office', departmentId: 'a-child' }, OPTIONS);
    expect(sibling.nodes.find(n => n.role === 'repository-steward')?.employeeId).toBeNull();
  });

  it('rejects malformed service membership and paused source companies', () => {
    const s = fixture(); s.employees.find(e => e.id === 'shared-repo')!.departmentId = 'a-dept';
    expect(role(s, 'repository-steward').employeeId).toBeNull();
    s.employees.find(e => e.id === 'shared-repo')!.departmentId = 's-dept'; s.companies[2].status = 'paused';
    expect(role(s, 'repository-steward').employeeId).toBeNull();
  });

  it('does not assign a local specialist whose office or department belongs to another company', () => {
    const s = fixture(); s.portfolio.contracts = [];
    s.employees.push(employee('misplaced', 'alpha', 'b-office', null, 'Repository maintenance', 'specialist'));
    expect(role(s, 'repository-steward').employeeId).toBeNull();
    s.employees.at(-1)!.officeId = 'a-office'; s.employees.at(-1)!.departmentId = 's-dept';
    expect(role(s, 'repository-steward').employeeId).toBeNull();
  });

  it('separates deterministic runtime services from employee definitions', () => {
    const team = buildDonnaTeam(fixture(), FOCUS, { ...OPTIONS, runtimeServices: { sourceReviewer: true, ledgerObserver: true } });
    for (const kind of ['source-reviewer', 'ledger-observer']) {
      expect(team.nodes.find(n => n.role === kind)).toMatchObject({ status: 'runtime-service', execution: 'deterministic-service',
        employeeId: null, reportedRunningJobs: 0, queuedJobs: 0, actions: [] });
    }
    expect(role(fixture(), 'source-reviewer').status).toBe('unconfigured');
  });

  it('exposes grant evidence without declaring authorization', () => {
    const node = role(fixture(), 'company-assistant');
    expect(node.authority).toEqual({ state: 'recorded', grantIds: ['g1'], capabilities: ['team.manage', 'work.manage'] });
    expect('authorized' in node).toBe(false);
  });

  it('fails closed without throwing on incomplete legacy or malformed grant records', () => {
    for (const malformed of [null, {}, { ...grant(), parentGrantIds: undefined }, { ...grant(), parentGrantIds: 'owner' },
      { ...grant(), capabilities: undefined }, { ...grant(), capabilities: [null] }, { ...grant(), scope: null }]) {
      const s = { ...fixture(), authority: { grants: [malformed] } } as unknown as DonnaSnapshot;
      expect(role(s, 'company-assistant').authority).toEqual({ state: 'none', grantIds: [], capabilities: [] });
    }
    const s = { ...fixture(), authority: { grants: null } } as unknown as DonnaSnapshot;
    expect(role(s, 'company-assistant').authority.state).toBe('none');
  });

  it.each(['expired', 'future', 'revoked', 'invalid-calendar', 'wrong-scope'])('rejects %s grant evidence', mutation => {
    const s = fixture(), g = s.authority.grants[0];
    if (mutation === 'expired') g.expiresAt = '2026-11-21T12:00:00Z';
    if (mutation === 'future') g.grantedAt = '2026-11-21T12:00:01Z';
    if (mutation === 'revoked') g.revokedAt = '2026-11-21T11:59:59Z';
    if (mutation === 'invalid-calendar') g.grantedAt = '2026-02-31T12:00:00Z';
    if (mutation === 'wrong-scope') g.scope.id = 'beta';
    expect(role(s, 'company-assistant').authority).toEqual({ state: 'none', grantIds: [], capabilities: [] });
  });

  it('checks delegated grant parents and does not inherit department-parent authority', () => {
    const s = fixture(), g = s.authority.grants[0];
    g.issuer = 'donna'; g.parentGrantIds = ['parent'];
    expect(role(s, 'company-assistant').authority.state).toBe('none');
    const parent = grant('parent', 'donna'); s.authority.grants.push(parent);
    expect(role(s, 'company-assistant').authority.state).toBe('recorded');
    parent.expiresAt = '2026-11-21T11:59:59Z';
    expect(role(s, 'company-assistant').authority.state).toBe('none');
    s.authority.grants = [grant('dept-grant', 'child-coordinator', 'department', 'a-dept')];
    const team = buildDonnaTeam(s, { kind: 'department', companyId: 'alpha', officeId: 'a-office', departmentId: 'a-child' }, OPTIONS);
    expect(team.nodes.find(n => n.employeeId === 'child-coordinator')?.authority.state).toBe('none');
  });

  it('returns no owner identities, activity or authority for member projections', () => {
    const s = { ...fixture(), access: { mode: 'member' } };
    const team = buildDonnaTeam(s, FOCUS, OPTIONS);
    expect(team).toMatchObject({ restricted: true, nodes: [], edges: [], omittedCount: 0 });
    const json = JSON.stringify(team);
    for (const privateValue of ['shared-repo', 'a-donna', 'g1', 'Beta', 'Shared services']) expect(json).not.toContain(privateValue);
  });

  it('rejects inconsistent focus tuples rather than falling back to another company', () => {
    const team = buildDonnaTeam(fixture(), { kind: 'department', companyId: 'beta', officeId: 'b-office', departmentId: 'a-dept' }, OPTIONS);
    expect(team.nodes).toEqual([]);
    expect(team.warnings).toEqual(['The selected scope is missing or inconsistent.']);
  });

  it('fails closed on duplicate employee identities and remains deterministic when arrays reorder', () => {
    const s = fixture(), before = JSON.stringify(s), original = buildDonnaTeam(s, FOCUS, OPTIONS);
    expect(JSON.stringify(s)).toBe(before);
    s.companies.reverse(); s.offices.reverse(); s.departments.reverse(); s.employees.reverse(); s.jobs.reverse();
    expect(buildDonnaTeam(s, FOCUS, OPTIONS)).toEqual(original);
    s.employees.push({ ...s.employees.find(e => e.id === 'a-donna')! });
    expect(role(s, 'company-assistant').employeeId).toBeNull();
  });

  it('bounds large crew projections and reports omitted definitions', () => {
    const s = fixture();
    s.departments = Array.from({ length: 16000 }, (_, i) => ({ id: `dept-${i}`, companyId: 'alpha', officeId: 'a-office', name: `Department ${i}`, status: 'active', assistantId: `employee-${i}` }));
    s.employees.push(...Array.from({ length: 30000 }, (_, i) => employee(`employee-${i}`, 'alpha', 'a-office', i < 16000 ? `dept-${i}` : null)));
    const team = buildDonnaTeam(s, FOCUS, { ...OPTIONS, maxNodes: 40 });
    expect(team.nodes).toHaveLength(40);
    expect(team.omittedCount).toBe(15966);
    expect(team.edges.every(e => team.nodes.some(n => n.id === e.from) && team.nodes.some(n => n.id === e.to))).toBe(true);
  });

  it('does not offer resume on an active child blocked only by a paused ancestor', () => {
    const s = fixture(); s.companies[0].status = 'paused';
    const team = buildDonnaTeam(s, FOCUS, OPTIONS);
    expect(team.nodes.find(n => n.role === 'company-assistant')?.actions).toEqual(['resume-scope']);
    expect(team.nodes.find(n => n.role === 'office-assistant')?.actions).toEqual([]);
  });
});

describe('Donna typed proposals', () => {
  it('drafts a manual goal through native delegated command checks without executing it', () => {
    const s = fixture(), before = JSON.stringify(s), node = role(s, 'company-assistant');
    const result = proposeDonnaAction(s, FOCUS, { nodeId: node.id, intent: 'plan-work', title: ' Review repository ', description: 'Selected company only.' }, OPTIONS);
    expect(result).toEqual({ ok: true, proposal: { actorEmployeeId: 'a-donna', label: 'Draft a scoped goal', requiredCapability: 'work.manage',
      readiness: 'recorded-grant', requiresNativeCheck: true, createsProviderJob: false, mayAdmitQueuedWork: false,
      command: { action: 'apply_employee_command', employeeId: 'a-donna', command: { action: 'create_goal', scope: { kind: 'company', id: 'alpha' },
        title: 'Review repository', description: 'Selected company only.', mode: 'plan', maxIterations: 1 } } } });
    expect(JSON.stringify(s)).toBe(before);
  });

  it('recomputes authority at proposal time and reports missing grants', () => {
    const s = fixture(), nodeId = role(s, 'company-assistant').id;
    s.authority.grants[0].revokedAt = '2026-11-21T11:59:00Z';
    const result = proposeDonnaAction(s, FOCUS, { nodeId, intent: 'pause-scope' }, OPTIONS);
    expect(result.ok && result.proposal.readiness).toBe('needs-authority');
    expect(result.ok && result.proposal.command.command.action).toBe('pause_company');
  });

  it('warns that scope resume may admit already-authorized queued work', () => {
    const s = fixture(); s.companies[0].status = 'paused';
    const result = proposeDonnaAction(s, FOCUS, { nodeId: role(s, 'company-assistant').id, intent: 'resume-scope' }, OPTIONS);
    expect(result.ok && result.proposal.mayAdmitQueuedWork).toBe(true);
    expect(result.ok && result.proposal.command.command.action).toBe('resume_company');
  });

  it('rejects unconfigured staff, member actions and arbitrary action strings', () => {
    const s = fixture(), node = role(s, 'company-assistant');
    expect(proposeDonnaAction(s, FOCUS, { nodeId: role(s, 'source-reviewer').id, intent: 'plan-work', title: 'Test' }, OPTIONS).ok).toBe(false);
    expect(proposeDonnaAction({ ...s, access: { mode: 'member' } }, FOCUS, { nodeId: node.id, intent: 'pause-scope' }, OPTIONS).ok).toBe(false);
    expect(proposeDonnaAction(s, FOCUS, { nodeId: node.id, intent: 'run-shell' as never }, OPTIONS).ok).toBe(false);
    s.employees.find(e => e.id === 'a-donna')!.status = 'fired';
    expect(proposeDonnaAction(s, FOCUS, { nodeId: node.id, intent: 'pause-scope' }, OPTIONS).ok).toBe(false);
  });

  it('enforces UTF-8 input bounds and rejects blank plan titles', () => {
    const s = fixture(), nodeId = role(s, 'company-assistant').id;
    for (const title of ['', ' ', '🙂'.repeat(51)]) expect(proposeDonnaAction(s, FOCUS, { nodeId, intent: 'plan-work', title }, OPTIONS).ok).toBe(false);
    expect(proposeDonnaAction(s, FOCUS, { nodeId, intent: 'plan-work', title: 'Valid', description: 'x'.repeat(16001) }, OPTIONS).ok).toBe(false);
  });
});
