import { describe, expect, it } from 'vitest';
import { buildScene, type FreeflowSnapshot } from '../src/renderer/freeflow/model.js';

const SECRET = 'TOPSECRET-goal-text';
const URI = 'file:///private/secret-artifact.md';

function fixture(): FreeflowSnapshot {
  return {
    companies: [
      { id: 'c-b', name: 'Beta', status: 'active' },
      { id: 'c-a', name: 'Alpha', status: 'active' },
      { id: 'c-s', name: 'Shared', status: 'paused' },
    ],
    offices: [{ id: 'o-a', companyId: 'c-a', name: 'HQ', status: 'active' }, { id: 'o-b', companyId: 'c-b', name: 'Beta HQ', status: 'active' }],
    departments: [{ id: 'd-a', companyId: 'c-a', officeId: 'o-a', name: 'Eng', status: 'active' }, { id: 'd-b', companyId: 'c-b', officeId: 'o-b', name: 'Ops', status: 'active' }, { id: 'd-b2', companyId: 'c-b', officeId: 'o-b', name: 'Unplaced', status: 'active' }],
    employees: [
      { id: 'e-a', companyId: 'c-a', officeId: 'o-a', departmentId: 'd-a', name: 'Ada Lovelace', role: 'Engineer', kind: 'specialist', status: 'active' },
      { id: 'e-b', companyId: 'c-b', officeId: 'o-b', departmentId: 'd-b', name: 'Bo Ops', role: 'Ops', kind: 'specialist', status: 'active' },
      { id: 'e-x', companyId: 'c-b', officeId: 'o-b', departmentId: 'd-b', name: 'Unseated', role: 'Ops', kind: 'specialist', status: 'active' },
      { id: 'e-s', companyId: 'c-s', officeId: null, departmentId: null, name: 'Sam Shared', role: 'Security', kind: 'specialist', status: 'active' },
    ],
    jobs: [
      { id: 'j1', companyId: 'c-s', employeeId: 'e-s', status: 'running', goal: SECRET, artifactUri: URI } as never,
      { id: 'j2', companyId: 'c-a', officeId: 'o-a', employeeId: 'e-s', status: 'queued', serviceContractId: 'k1' },
    ],
    blueprints: [{ id: 'bp-b', companyId: 'c-b', officeId: 'o-b', rooms: [{ id: 'r1', name: 'Room', departmentId: 'd-b', x: 0.1, y: 0.1, width: 0.4, height: 0.4 }], desks: [{ id: 'dk1', roomId: 'r1', employeeId: 'e-b', x: 0.2, y: 0.2 }], whiteboards: [] }],
    portfolio: {
      ceo: { sharedServicesCompanyId: 'c-s' },
      groups: [{ id: 'g1', name: 'G1', companyIds: ['c-a', 'c-b', 'ghost'] }, { id: 'g2', name: 'G2', companyIds: ['c-b'] }],
      services: [{ id: 's1', key: 'security', name: 'Security', companyId: 'c-s', officeId: 'x', departmentId: 'y', employeeIds: ['e-s'], status: 'active' }],
      contracts: [{ id: 'k1', serviceId: 's1', recipientCompanyId: 'c-a', recipientOfficeId: 'o-a', recipientDepartmentId: 'd-a', employeeIds: ['e-s', 'e-gone'], allowedTools: ['github.read_repository'], status: 'active' }],
    },
  };
}

function many(n: number): FreeflowSnapshot {
  return { companies: Array.from({ length: n }, (_, i) => ({ id: `c${String(i).padStart(3, '0')}`, name: `Co ${i}`, status: 'active' })) };
}

describe('freeflow model', () => {
  it('portfolio lists every company once, deterministic across permutations', () => {
    const s = fixture();
    const a = buildScene(s, { kind: 'portfolio' });
    const rev: FreeflowSnapshot = { ...s, companies: [...s.companies!].reverse() };
    const b = buildScene(rev, { kind: 'portfolio' });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(a.nodes.map((n) => n.entityId).sort()).toEqual(['c-a', 'c-b', 'c-s']);
    const beta = a.nodes.find((n) => n.entityId === 'c-b')!;
    expect(beta.metadata.groupIds).toEqual(['g1', 'g2']);
    expect(a.nodes.find((n) => n.entityId === 'c-s')!.subtitle).toContain('Paused');
    expect(a.warnings.some((w) => w.includes('ghost'))).toBe(true);
    expect(a.counts.runningJobs).toBe(1);
  });

  it('does not mutate input', () => {
    const s = fixture();
    const before = JSON.stringify(s);
    buildScene(s, { kind: 'portfolio' });
    buildScene(s, { kind: 'company', companyId: 'c-b' });
    expect(JSON.stringify(s)).toBe(before);
  });

  it('bounds expand with company count and 200 companies have stable unique ids', () => {
    const small = buildScene(many(5), { kind: 'portfolio' });
    const big = buildScene(many(200), { kind: 'portfolio' });
    expect(big.bounds.width * big.bounds.height).toBeGreaterThan(small.bounds.width * small.bounds.height);
    expect(big.nodes).toHaveLength(200);
    expect(new Set(big.nodes.map((n) => n.id)).size).toBe(200);
    expect(JSON.stringify(buildScene(many(200), { kind: 'portfolio' }))).toBe(JSON.stringify(big));
  });

  it('renders 100 rooms and 200 whiteboards without cuts', () => {
    const rooms = Array.from({ length: 100 }, (_, i) => ({ id: `r${i}`, name: `R${i}`, departmentId: null, x: (i % 10) * 100, y: Math.floor(i / 10) * 100, width: 90, height: 90 }));
    const boards = Array.from({ length: 200 }, (_, i) => ({ id: `w${i}`, roomId: `r${i % 100}`, ownerEmployeeId: 'e', title: `B${i}`, goalIds: [], jobIds: [], x: 5, y: 5 }));
    const s: FreeflowSnapshot = { companies: [{ id: 'c', name: 'C', status: 'active' }], offices: [{ id: 'o', companyId: 'c', name: 'O', status: 'active' }], blueprints: [{ id: 'b', companyId: 'c', officeId: 'o', rooms, desks: [], whiteboards: boards }] };
    const sc = buildScene(s, { kind: 'office', companyId: 'c', officeId: 'o' });
    expect(sc.counts.rooms).toBe(100);
    expect(sc.counts.whiteboards).toBe(200);
  });

  it('puts unplaced employees and departments in fallback areas', () => {
    const sc = buildScene(fixture(), { kind: 'company', companyId: 'c-b' });
    const fb = sc.nodes.filter((n) => n.kind === 'fallback' || n.metadata.fallback === true);
    expect(fb.map((n) => n.entityId).sort()).toEqual(['d-b2', 'e-x']);
    expect(sc.counts.employees).toBe(2);
  });

  it('recipient scene shows contracted reference only, scoped and leak free', () => {
    const sc = buildScene(fixture(), { kind: 'company', companyId: 'c-a' });
    const refs = sc.nodes.filter((n) => n.kind === 'reference');
    expect(refs).toHaveLength(1);
    expect(refs[0]!.contractId).toBe('k1');
    expect(refs[0]!.metadata.homeCompanyId).toBe('c-s');
    expect(refs[0]!.metadata.allowedTools).toEqual(['github.read_repository']);
    expect(refs[0]!.counts.jobs).toBe(1); // only recipient-company jobs
    expect(sc.nodes.filter((n) => n.entityId === 'e-s')).toHaveLength(1);
    expect(sc.warnings.some((w) => w.includes('e-gone'))).toBe(true);
    const json = JSON.stringify(sc);
    expect(json).not.toContain(SECRET);
    expect(json).not.toContain(URI);
    expect(sc.threads.some((t) => t.contractId === 'k1' && t.homeCompanyId === 'c-s')).toBe(true);
  });

  it('handles missing scope and empty data', () => {
    const miss = buildScene(fixture(), { kind: 'company', companyId: 'nope' });
    expect(miss.nodes).toEqual([]);
    expect(miss.warnings.length).toBeGreaterThan(0);
    const missOffice = buildScene(fixture(), { kind: 'office', companyId: 'c-a', officeId: 'nope' });
    expect(missOffice.warnings.length).toBeGreaterThan(0);
    const none = buildScene({}, { kind: 'portfolio' });
    expect(none.nodes).toEqual([]);
    expect(none.bounds.width).toBeGreaterThan(0);
  });

  it('department focus lists only that department', () => {
    const sc = buildScene(fixture(), { kind: 'department', companyId: 'c-b', officeId: 'o-b', departmentId: 'd-b' });
    expect(sc.nodes.some((n) => n.entityId === 'd-b2')).toBe(false);
    expect(sc.breadcrumbs).toHaveLength(4);
  });
});
