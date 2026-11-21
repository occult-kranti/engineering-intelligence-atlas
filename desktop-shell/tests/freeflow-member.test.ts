// @vitest-environment node
import { afterEach, beforeEach, expect, it } from 'vitest';
import { installDom, type FreeflowDom } from './fixtures/freeflow-dom.js';
import { projectMemberSnapshot, mountMemberStudio, type MemberStudio } from '../src/renderer/freeflow/member.js';
import { buildScene } from '../src/renderer/freeflow/model.js';
import { actionsForNode, rowsForNode } from '../src/renderer/freeflow/inspector.js';

let dom: FreeflowDom; let studio: MemberStudio | null = null;
beforeEach(() => { dom = installDom(); });
afterEach(() => { studio?.destroy(); studio = null; dom.restore(); });
const dto = () => ({
  company: { id: 'visible', name: 'Visible company', status: 'active', repoUrl: 'SECRET' },
  membership: { role: 'viewer' }, access: { mode: 'member', restrictedRegions: [{ id: 'private-workspace' }] },
  companies: [{ id: 'private', name: 'SECRET' }], employees: [{ id: 'hidden', name: 'SECRET' }],
  offices: [{ id: 'office', companyId: 'visible', name: 'Main', status: 'active' }, { id: 'hidden', companyId: 'private', name: 'SECRET' }],
  departments: [{ id: 'dept', companyId: 'visible', officeId: 'office', name: 'Design', status: 'active' }],
  roleCards: [{ id: 'local', name: 'Local', role: 'Designer', kind: 'specialist', shared: false, status: 'active', officeId: 'office', departmentId: 'dept' },
    { id: 'shared', name: 'Shared observer', role: 'Observer', shared: true, availability: 'active', provenance: 'service-contract', toolAccess: true }],
  blueprints: [{ id: 'bp', officeId: 'office', rooms: [{ id: 'room', name: 'Studio', departmentId: 'dept', x: 0, y: 0, width: 1, height: 1 }],
    desks: [{ id: 'desk', roomId: 'room', employeeId: 'shared', x: .2, y: .3 }], whiteboards: [] }],
  jobs: [{ id: 'job', employeeId: 'local', officeId: 'office', departmentId: 'dept', status: 'completed', goal: 'SECRET', artifactUri: 'SECRET', leaseToken: 'SECRET' }],
});

it('keeps only authorized member fields and treats shared roles as references without tool grants', () => {
  const projected = projectMemberSnapshot(dto());
  expect(JSON.stringify(projected)).not.toContain('SECRET');
  expect(projected.companies).toHaveLength(1); expect(projected.offices).toHaveLength(1);
  const scene = buildScene(projected, { kind: 'company', companyId: 'visible' });
  const shared = scene.nodes.find((n) => n.employeeId === 'shared')!;
  expect(shared.kind).toBe('reference'); expect(shared.metadata.toolAccess).toBe(false);
  expect(scene.nodes.filter((n) => n.employeeId === 'shared')).toHaveLength(1);
  const restricted = scene.nodes.find((n) => n.kind === 'restricted')!;
  expect(restricted.companyId).toBe(''); expect(restricted.counts).toEqual({});
  expect(actionsForNode(restricted)).toEqual([]); expect(rowsForNode(restricted)).toContainEqual(['Access', 'Restricted']);
  expect(scene.breadcrumbs.some((b) => b.focus.kind === 'portfolio')).toBe(false);
});

it('rejects an owner snapshot and clears a previously mounted view when access is lost', () => {
  expect(() => projectMemberSnapshot({ companies: [{ id: 'owner' }] })).toThrow();
  const host = document.createElement('div'); document.body.append(host);
  studio = mountMemberStudio(host, dto());
  expect(host.querySelector('.ff-studio')).not.toBeNull();
  const actions = [...host.querySelectorAll<HTMLButtonElement>('.ff-inspector-actions button')];
  expect(actions.length).toBeGreaterThan(0); expect(actions.every((b) => b.disabled)).toBe(true);
  expect(() => studio!.update({ ok: false, error: 'access denied' })).toThrow();
  expect(host.querySelector('.ff-studio')).toBeNull();
});

it('preserves valid dotted native IDs and rejects reserved traversal identifiers', () => {
  const input = dto(); input.company.id = 'example.company';
  const view = projectMemberSnapshot(input); expect(view.companies![0]!.id).toBe('example.company');
  input.company.id = '..'; expect(() => projectMemberSnapshot(input)).toThrow();
});

it('department navigation includes descendants with bounded paths and no authority inference', () => {
  const input = dto();
  input.departments.push({ id: 'child', companyId: 'visible', officeId: 'office', name: 'Research', status: 'active', parentDepartmentId: 'dept' } as never);
  input.blueprints[0]!.rooms.push({ id: 'child-room', name: 'Lab', departmentId: 'child', x: .1, y: .1, width: .5, height: .5 });
  const projected = projectMemberSnapshot(input);
  const parent = buildScene(projected, { kind: 'department', companyId: 'visible', officeId: 'office', departmentId: 'dept' });
  expect(parent.nodes.find((n) => n.roomId === 'child-room')?.metadata.assignment).toBe('Design / Research');
  const child = buildScene(projected, { kind: 'department', companyId: 'visible', officeId: 'office', departmentId: 'child' });
  expect(child.breadcrumbs.map((b) => b.label)).toEqual(['Visible company', 'Main', 'Design', 'Research']);
  expect(child.nodes.some((n) => n.roomId === 'room')).toBe(false);
});
