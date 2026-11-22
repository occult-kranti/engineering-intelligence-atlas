import { describe, expect, it } from 'vitest';
import { buildScene, type FreeflowSnapshot } from '../src/renderer/freeflow/model.js';
import { buildUniverse, shiftSceneGeometry, TABLE_PREVIEW_OFFICES, TABLE_PREVIEW_ROOMS } from '../src/renderer/freeflow/universe.js';
import { DEFAULT_CAMERA, MAX_COORD, fitBounds } from '../src/renderer/freeflow/camera.js';
import { projectMemberSnapshot } from '../src/renderer/freeflow/member.js';

function company(id: string, name = id) {
  return { id, name, status: 'active' };
}

function fullSnapshot(): FreeflowSnapshot {
  return {
    companies: [company('c1', 'Alpha'), company('c2', 'Beta')],
    offices: [{ id: 'o1', companyId: 'c1', name: 'HQ', status: 'active' }],
    departments: [{ id: 'd1', companyId: 'c1', officeId: 'o1', name: 'Eng', status: 'active' }],
    employees: [{ id: 'e1', companyId: 'c1', officeId: 'o1', departmentId: 'd1', name: 'Ada Lovelace', role: 'Engineer', kind: 'human', status: 'active' }],
    blueprints: [{
      id: 'bp1', companyId: 'c1', officeId: 'o1',
      rooms: [{ id: 'r1', name: 'Room', departmentId: 'd1', x: 0.05, y: 0.05, width: 0.5, height: 0.5 }],
      desks: [{ id: 'dk1', roomId: 'r1', employeeId: 'e1', x: 0.2, y: 0.2 }],
      whiteboards: [],
    }],
  };
}

function manyCompanies(n: number): FreeflowSnapshot {
  const companies = Array.from({ length: n }, (_, i) => company(`c${String(i).padStart(3, '0')}`));
  return { companies };
}

const overlaps = (a: { x: number; y: number; width: number; height: number }, b: typeof a) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
const contains = (o: { x: number; y: number; width: number; height: number }, i: typeof o) =>
  i.x >= o.x - 1e-6 && i.y >= o.y - 1e-6 && i.x + i.width <= o.x + o.width + 1e-6 && i.y + i.height <= o.y + o.height + 1e-6;

describe('buildUniverse', () => {
  it('handles an empty workspace with safe geometry', () => {
    const u = buildUniverse({}, { kind: 'portfolio' });
    expect(u.nodes).toEqual([]);
    expect(u.focusBounds.width).toBeGreaterThan(0);
    expect(u.focusBounds.height).toBeGreaterThan(0);
  });

  it('keeps a readable first-plan window with 200 company markers and no table', () => {
    const snap = manyCompanies(200);
    const u = buildUniverse(snap, { kind: 'portfolio' });
    expect(u.nodes.filter((n) => n.kind === 'folio')).toHaveLength(200);
    expect(u.focusBounds.width).toBeLessThanOrEqual(1200 + 1e-6);
    expect(u.tableBounds).toBeUndefined();
    expect(u.worldMode).toBe('blueprint');
    expect(u.nodes.filter((n) => n.kind === 'folio' && overlaps(u.focusBounds, n.rect))).toHaveLength(1);
    expect(contains(u.bounds, u.focusBounds) || u.bounds.width >= u.focusBounds.width).toBe(true);
    expect(fitBounds(DEFAULT_CAMERA, { width: 1000, height: 700 }, u.focusBounds, 24).zoom).toBeGreaterThanOrEqual(.75);
  });

  it('keeps real blueprints inside their company footprints when a company is selected', () => {
    const snap = fullSnapshot();
    const u = buildUniverse(snap, { kind: 'company', companyId: 'c1' });
    const direct = buildScene(snap, { kind: 'company', companyId: 'c1' });
    expect(u.tableBounds).toBeUndefined();
    expect(u.nodes.filter((n) => n.kind === 'folio')).toHaveLength(2);
    expect(u.nodes.some((n) => n.kind === 'room')).toBe(true);
    expect(u.nodes.some((n) => n.kind === 'employee' && n.entityId === 'e1')).toBe(true);
    const nativeDetails = direct.nodes.filter(node => !(node.kind === 'fallback' && node.metadata.companyLevel === true && !node.counts.employees && !node.counts.globalAssistants));
    const bpNodes = u.nodes.filter((n) => n.id.startsWith('universe:blueprint:') && n.companyId === 'c1');
    expect(bpNodes).toHaveLength(nativeDetails.length);
    expect(new Set(u.nodes.map((n) => n.id)).size).toBe(u.nodes.length);
    const footprint = u.nodes.find(node => node.id === 'universe:table-plan:c1')!;
    expect(bpNodes.every(node => contains(footprint.rect, node.rect))).toBe(true);
    expect(u.focusBounds).toEqual(footprint.rect);
  });

  it('preserves company marker geometry across scope transitions', () => {
    const snap = fullSnapshot();
    const seats = (u: ReturnType<typeof buildUniverse>) =>
      u.nodes.filter((n) => n.kind === 'folio').map((n) => [n.id, n.rect]);
    const p = buildUniverse(snap, { kind: 'portfolio' });
    const c = buildUniverse(snap, { kind: 'company', companyId: 'c1' });
    const o = buildUniverse(snap, { kind: 'office', companyId: 'c1', officeId: 'o1' });
    const d = buildUniverse(snap, { kind: 'department', companyId: 'c1', officeId: 'o1', departmentId: 'd1' });
    expect(seats(c)).toEqual(seats(p));
    expect(seats(o)).toEqual(seats(p));
    expect(seats(d)).toEqual(seats(p));
  });

  it('preserves bounded saved previews inside separate footprints and every company identity', () => {
    const snap = fullSnapshot(), base = buildScene(snap, { kind: 'portfolio' });
    const scene = buildUniverse(snap, { kind: 'portfolio' });
    const plans = scene.nodes.filter(node => node.metadata.tableBlueprint === true);
    expect(plans).toHaveLength(2);
    expect(plans.every(node => contains(scene.bounds, node.rect))).toBe(true);
    expect(overlaps(plans[0]!.rect, plans[1]!.rect)).toBe(false);
    expect(plans.every(node => node.rect.height >= 140 && node.metadata.portal === true)).toBe(true);
    const saved = plans.find(node => node.companyId === 'c1')!;
    expect(saved.parentId).toBeNull();
    expect(saved.blueprintPreview?.offices[0]?.rooms).toEqual([{ id: 'r1', label: 'Room', rect: { x: 43, y: 22, width: 430, height: 220 } }]);
    const empty = plans.find(node => node.companyId === 'c2')!;
    expect(empty.subtitle).toBe('No saved blueprint');
    expect(empty.blueprintPreview?.offices).toEqual([]);
    for (const seat of base.nodes) {
      const projected = scene.nodes.find(node => node.id === seat.id)!;
      const plan = plans.find(node => node.companyId === seat.companyId)!;
      expect(projected.rect.width).toBe(48);
      expect(projected.rect.height).toBe(48);
      expect(projected.metadata.seat).toBe(false);
      expect(projected.metadata.companyMarker).toBe(true);
      expect(projected.parentId).toBe(plan.id);
      expect(contains(plan.rect, projected.rect)).toBe(true);
    }
    expect(base.tableBounds!.height).toBe(136); // buildScene remains unchanged.
  });

  it('admits saved rooms only when both company and office match their owner', () => {
    const base = fullSnapshot();
    const scene = buildUniverse({ ...base,
      offices: [...base.offices!, { id: 'private-office', companyId: 'c2', name: 'Beta office', status: 'active' }],
      blueprints: [...base.blueprints!,
        { ...base.blueprints![0]!, id: 'foreign-plan', companyId: 'c1', officeId: 'private-office', rooms: [{ ...base.blueprints![0]!.rooms[0]!, name: 'FOREIGN_ROOM' }] },
        { ...base.blueprints![0]!, id: 'missing-plan', officeId: 'removed', rooms: [{ ...base.blueprints![0]!.rooms[0]!, name: 'REMOVED_ROOM' }] }],
    }, { kind: 'portfolio' });
    expect(JSON.stringify(scene)).not.toContain('FOREIGN_ROOM');
    expect(JSON.stringify(scene)).not.toContain('REMOVED_ROOM');
    expect(scene.nodes.find(node => node.id === 'universe:table-plan:c1')?.blueprintPreview?.officeCount).toBe(1);
  });

  it('bounds thumbnail offices and rooms, reports omitted coverage and preserves valid geometry', () => {
    const offices = Array.from({ length: 4 }, (_, i) => ({ id: `o${i}`, companyId: 'c1', name: `Office ${i}`, status: 'active' }));
    const rooms = Array.from({ length: 80 }, (_, i) => ({ id: `r${String(i).padStart(3, '0')}`, name: `Room ${i}`, departmentId: null, x: i * 20, y: i % 3 * 20, width: 15, height: 10 }));
    const snap: FreeflowSnapshot = { companies: [company('c1')], offices,
      blueprints: offices.map(office => ({ id: `bp-${office.id}`, companyId: 'c1', officeId: office.id, rooms, desks: [], whiteboards: [] })) };
    const scene = buildUniverse(snap, { kind: 'portfolio' });
    const plan = scene.nodes.find(node => node.metadata.tableBlueprint)!;
    expect(plan.blueprintPreview?.offices).toHaveLength(TABLE_PREVIEW_OFFICES);
    expect(plan.blueprintPreview?.offices.flatMap(office => office.rooms)).toHaveLength(TABLE_PREVIEW_ROOMS);
    expect(plan.blueprintPreview?.offices.every(office => office.rooms.length > 0)).toBe(true);
    expect(plan.subtitle).toBe('Showing 32 of 320 rooms · 2 of 4 offices');
    const reordered = buildUniverse({ ...snap, offices: [...offices].reverse(), blueprints: [...snap.blueprints!].reverse().map(plan => ({ ...plan, rooms: [...plan.rooms].reverse() })) }, { kind: 'portfolio' });
    expect(reordered).toEqual(scene);
  });

  it('rejects nonfinite, negative, zero and extreme room geometry without drawing substitute outlines', () => {
    const base = fullSnapshot(), room = base.blueprints![0]!.rooms[0]!;
    const bad = [{ ...room, id: 'nan', x: NaN }, { ...room, id: 'infinite', width: Infinity }, { ...room, id: 'negative', height: -1 }, { ...room, id: 'zero', width: 0 }, { ...room, id: 'extreme', x: 1e308 }];
    const scene = buildUniverse({ ...base, blueprints: [{ ...base.blueprints![0]!, rooms: bad }] }, { kind: 'portfolio' });
    const plan = scene.nodes.find(node => node.id === 'universe:table-plan:c1')!;
    expect(plan.blueprintPreview?.offices[0]?.rooms).toEqual([]);
    expect(plan.blueprintPreview?.invalidRoomCount).toBe(5);
    expect(plan.subtitle).toContain('0 of 5 rooms');
    expect(plan.subtitle).toContain('5 invalid omitted');
  });

  it('clones nested preview geometry while leaving office-local coordinates unchanged by a world shift', () => {
    const scene = buildUniverse(fullSnapshot(), { kind: 'portfolio' });
    const before = JSON.stringify(scene);
    const shifted = shiftSceneGeometry(scene, 900, -600, { idPrefix: 'copy:' });
    const original = scene.nodes.find(node => node.id === 'universe:table-plan:c1')!;
    const copy = shifted.nodes.find(node => node.id === 'copy:universe:table-plan:c1')!;
    expect(copy.blueprintPreview).toEqual(original.blueprintPreview);
    copy.blueprintPreview!.offices[0]!.rooms[0]!.rect.width = 999;
    copy.blueprintPreview!.offices[0]!.label = 'Changed';
    expect(JSON.stringify(scene)).toBe(before);
  });

  it('retains 1000 company markers and bounded previews without framing the entire world', () => {
    const scene = buildUniverse(manyCompanies(1000), { kind: 'portfolio' });
    expect(scene.nodes.filter(node => node.kind === 'folio')).toHaveLength(1000);
    expect(scene.nodes.filter(node => node.metadata.tableBlueprint)).toHaveLength(1000);
    expect(scene.nodes).toHaveLength(2000);
    expect(scene.focusBounds.width).toBeLessThanOrEqual(1200);
    expect(scene.focusBounds.height).toBeLessThanOrEqual(800);
    expect(new Set(scene.nodes.map(node => node.id)).size).toBe(2000);
  });

  it('keeps every room in the same world position while focusing another office or department', () => {
    const base = fullSnapshot();
    const snap: FreeflowSnapshot = { ...base,
      offices: [...base.offices!, { id: 'o2', companyId: 'c1', name: 'Second office', status: 'active' }],
      departments: [...base.departments!, { id: 'd2', companyId: 'c1', officeId: 'o2', name: 'Research', status: 'active' }],
      employees: [...base.employees!, { id: 'e2', companyId: 'c1', officeId: 'o2', departmentId: 'd2', name: 'Grace', role: 'Researcher', kind: 'specialist', status: 'active' }],
      blueprints: [...base.blueprints!, { id: 'bp2', companyId: 'c1', officeId: 'o2', rooms: [{ id: 'r2', name: 'Lab', departmentId: 'd2', x: .1, y: .1, width: .4, height: .5 }], desks: [{ id: 'desk2', roomId: 'r2', employeeId: 'e2', x: .2, y: .2 }], whiteboards: [] }],
    };
    const c = buildUniverse(snap, { kind: 'company', companyId: 'c1' });
    const o = buildUniverse(snap, { kind: 'office', companyId: 'c1', officeId: 'o2' });
    const d = buildUniverse(snap, { kind: 'department', companyId: 'c1', officeId: 'o2', departmentId: 'd2' });
    const geometry = (scene: typeof c) => scene.nodes.map(node => ({ id: node.id, rect: node.rect, parentId: node.parentId }));
    expect(geometry(o)).toEqual(geometry(c));
    expect(geometry(d)).toEqual(geometry(c));
    expect(o.threads).toEqual(c.threads);
    expect(d.threads).toEqual(c.threads);
    expect(o.focusBounds.width).toBeLessThan(c.focusBounds.width);
    expect(d.focusBounds.width).toBeLessThan(o.focusBounds.width);
    expect(o.warnings.some(warning => warning.includes('outside this scope'))).toBe(false);
    expect(d.nodes.some(node => node.kind === 'room' && node.entityId === 'r1')).toBe(true);
  });

  it('does not mutate input', () => {
    const snap = fullSnapshot();
    const before = JSON.stringify(snap);
    buildUniverse(snap, { kind: 'company', companyId: 'c1' });
    expect(JSON.stringify(snap)).toBe(before);
    const scene = buildScene(snap, { kind: 'company', companyId: 'c1' });
    const sceneBefore = JSON.stringify(scene);
    shiftSceneGeometry(scene, 100, 200, { idPrefix: 'x:' });
    expect(JSON.stringify(scene)).toBe(sceneBefore);
  });

  it('clones mutable geometry, metadata arrays, counts and focus identities', () => {
    const snap: FreeflowSnapshot = { ...fullSnapshot(), portfolio: { groups: [{ id: 'group', name: 'Group', companyIds: ['c1'] }] } };
    const original = buildScene(snap, { kind: 'portfolio' });
    const before = JSON.stringify(original);
    const shifted = shiftSceneGeometry(original, 20, 30, { idPrefix: 'shifted:' });
    shifted.nodes[0]!.rect.x = 999;
    shifted.nodes[0]!.counts.employees = 999;
    (shifted.nodes[0]!.metadata.groupIds as string[]).push('new');
    shifted.breadcrumbs[0]!.label = 'Changed';
    expect(JSON.stringify(original)).toBe(before);
    const focus = { kind: 'company', companyId: 'c1' } as const;
    const composed = buildUniverse(snap, focus);
    (composed.focus as { companyId: string }).companyId = 'changed';
    expect(focus.companyId).toBe('c1');
  });

  it('returns only the member projection for member access, never a global view', () => {
    const snap: FreeflowSnapshot = { ...fullSnapshot(), access: { mode: 'member', role: 'viewer', restricted: true } };
    const focus = { kind: 'company', companyId: 'c1' } as const;
    const u = buildUniverse(snap, focus);
    const direct = buildScene(snap, focus);
    expect(u.nodes).toEqual(direct.nodes);
    expect(u.bounds).toEqual(direct.bounds);
    expect(u.focusBounds).toEqual(direct.bounds);
    expect(u.nodes.some((n) => n.kind === 'folio')).toBe(false);
    expect(u.nodes.some((n) => n.blueprintPreview || n.metadata.tableBlueprint)).toBe(false);
    expect(u.tableBounds).toBeUndefined();
    const p = buildUniverse(snap, { kind: 'portfolio' });
    expect(p.nodes).toEqual(buildScene(snap, { kind: 'portfolio' }).nodes);
  });

  it('never reintroduces owner data discarded by the member DTO projection', () => {
    const projected = projectMemberSnapshot({
      company: { id: 'visible', name: 'Visible company', status: 'active' }, membership: { role: 'viewer' },
      access: { mode: 'member', restrictedRegions: [{ id: 'private-workspace' }] },
      companies: [{ id: 'hidden', name: 'PRIVATE_COMPANY' }],
      employees: [{ id: 'hidden-person', name: 'PRIVATE_PERSON' }],
      offices: [{ id: 'visible-office', companyId: 'visible', name: 'Main', status: 'active' }, { id: 'private-office', companyId: 'hidden', name: 'PRIVATE_OFFICE' }],
      departments: [], roleCards: [], jobs: [], blueprints: [],
    });
    for (const focus of [{ kind: 'portfolio' }, { kind: 'company', companyId: 'visible' }, { kind: 'company', companyId: 'hidden' }] as const) {
      const scene = buildUniverse(projected, focus);
      expect(JSON.stringify(scene)).not.toContain('PRIVATE_');
      expect(scene.nodes.some(node => node.id.startsWith('universe:blueprint:'))).toBe(false);
      expect(scene.nodes.some(node => node.blueprintPreview)).toBe(false);
      expect(scene.nodes.some(node => node.entityId === 'hidden-person')).toBe(false);
    }
  });

  it('returns missing-state warnings for an unknown company', () => {
    const snap = fullSnapshot();
    const u = buildUniverse(snap, { kind: 'company', companyId: 'nope' });
    expect(u.warnings.some((w) => w.includes('nope'))).toBe(true);
    expect(u.focusBounds.width).toBeGreaterThan(0);
    expect(u.nodes.some((n) => n.companyId === 'nope')).toBe(false);
    expect(u.nodes.some((n) => n.id.startsWith('universe:blueprint:'))).toBe(true);
  });

  it('retains the selected company and warns when an office no longer exists', () => {
    const u = buildUniverse(fullSnapshot(), { kind: 'office', companyId: 'c1', officeId: 'removed' });
    expect(u.warnings.some(warning => warning.includes('removed'))).toBe(true);
    expect(u.nodes.some(node => node.kind === 'folio' && node.companyId === 'c2')).toBe(true);
    expect(u.nodes.some(node => node.kind === 'room' && node.companyId === 'c1')).toBe(true);
    expect(Object.values(u.focusBounds).every(Number.isFinite)).toBe(true);
  });

  it('keeps malformed and extreme geometry finite within the camera world', () => {
    const base = fullSnapshot();
    const snap: FreeflowSnapshot = { ...base, blueprints: [{ ...base.blueprints![0]!, rooms: [
      { id: 'large', name: 'Large', departmentId: 'd1', x: 1e308, y: -1e308, width: 1e308, height: 1e308 },
      { id: 'invalid', name: 'Invalid', departmentId: 'd1', x: NaN, y: Infinity, width: -1, height: NaN },
    ], desks: [], whiteboards: [] }] };
    const u = buildUniverse(snap, { kind: 'company', companyId: 'c1' });
    const rects = [u.bounds, u.focusBounds, ...u.nodes.map(node => node.rect)];
    for (const rect of rects) {
      expect(Object.values(rect).every(Number.isFinite)).toBe(true);
      expect(rect.width).toBeGreaterThan(0); expect(rect.height).toBeGreaterThan(0);
      expect(rect.x).toBeGreaterThanOrEqual(-MAX_COORD); expect(rect.y).toBeGreaterThanOrEqual(-MAX_COORD);
      expect(rect.x + rect.width).toBeLessThanOrEqual(MAX_COORD); expect(rect.y + rect.height).toBeLessThanOrEqual(MAX_COORD);
    }
    const regular = buildScene(fullSnapshot(), { kind: 'company', companyId: 'c1' });
    expect(shiftSceneGeometry(regular, NaN, Infinity).nodes.map(node => node.rect)).toEqual(regular.nodes.map(node => node.rect));
  });

  it('retains unique IDs for malformed duplicate companies and deterministic valid reorderings', () => {
    const base = fullSnapshot();
    const malformed: FreeflowSnapshot = { ...base, companies: [...base.companies!, base.companies![0]!] };
    const scene = buildUniverse(malformed, { kind: 'company', companyId: 'c1' });
    expect(new Set(scene.nodes.map(node => node.id)).size).toBe(scene.nodes.length);
    expect(scene.warnings.some(warning => warning.includes('Duplicate'))).toBe(true);
    const a = buildUniverse(base, { kind: 'company', companyId: 'c1' });
    const b = buildUniverse({ ...base, companies: [...base.companies!].reverse(), offices: [...base.offices!].reverse(), employees: [...base.employees!].reverse() }, { kind: 'company', companyId: 'c1' });
    expect(b).toEqual(a);
  });

  it('keeps thread endpoints resolvable and ids unique', () => {
    const snap = fullSnapshot();
    (snap as { portfolio?: unknown }).portfolio = {
      services: [{ id: 's1', key: 'k', name: 'Svc', companyId: 'c2', officeId: 'o2', departmentId: 'd2', employeeIds: [], status: 'active' }],
      contracts: [{ id: 'k1', serviceId: 's1', recipientCompanyId: 'c1', recipientOfficeId: null, recipientDepartmentId: null, employeeIds: [], allowedTools: [], status: 'active' }],
    };
    const u = buildUniverse(snap, { kind: 'company', companyId: 'c1' });
    const ids = new Set(u.nodes.map((n) => n.id));
    expect(ids.size).toBe(u.nodes.length);
    expect(new Set(u.threads.map((t) => t.id)).size).toBe(u.threads.length);
    for (const t of u.threads) {
      expect(ids.has(t.fromId)).toBe(true);
      expect(ids.has(t.toId)).toBe(true);
    }
    // threads were not fabricated beyond portfolio + existing blueprint threads
    const direct = buildScene(snap, { kind: 'company', companyId: 'c1' });
    const port = buildScene(snap, { kind: 'portfolio' });
    expect(u.threads.length).toBeLessThanOrEqual(direct.threads.length + port.threads.length);
  });
});
