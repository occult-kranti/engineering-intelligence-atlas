import { describe, expect, it } from 'vitest';
import type { FreeflowFocus, FreeflowSnapshot, SceneNode } from '../src/renderer/freeflow/model.js';
import { buildUniverse, companyFootprintAt, COMPANY_FOOTPRINT_HEIGHT, COMPANY_FOOTPRINT_WIDTH, FULL_COMPANY_PLAN_LIMIT, MAX_COMPANY_FOOTPRINTS } from '../src/renderer/freeflow/universe.js';
import { MAX_COORD } from '../src/renderer/freeflow/camera.js';

function fixture(count = 3): FreeflowSnapshot {
  const companies = Array.from({ length: count }, (_, index) => ({ id: `c${String(index).padStart(3, '0')}`,
    name: `Company ${index}`, status: 'active', parentCompanyId: index === 1 ? 'c000' : null }));
  return {
    companies,
    offices: companies.map(company => ({ id: `o-${company.id}`, companyId: company.id, name: 'Office', status: 'active' })),
    departments: companies.map(company => ({ id: `d-${company.id}`, companyId: company.id, officeId: `o-${company.id}`, name: 'Department', status: 'active' })),
    employees: companies.map(company => ({ id: `e-${company.id}`, companyId: company.id, officeId: `o-${company.id}`, departmentId: `d-${company.id}`,
      name: 'Employee', role: 'Engineer', kind: 'specialist', status: 'active' })),
    blueprints: companies.map(company => ({ id: `bp-${company.id}`, companyId: company.id, officeId: `o-${company.id}`,
      rooms: [{ id: `r-${company.id}`, name: 'Saved room', departmentId: `d-${company.id}`, x: .05, y: .08, width: .6, height: .7 }],
      desks: [{ id: `desk-${company.id}`, roomId: `r-${company.id}`, employeeId: `e-${company.id}`, x: .3, y: .5 }],
      whiteboards: [{ id: `board-${company.id}`, roomId: `r-${company.id}`, ownerEmployeeId: `e-${company.id}`, title: 'Saved board', x: .6, y: .2 }] })),
  };
}

const footprints = (scene: ReturnType<typeof buildUniverse>) => scene.nodes.filter(node => node.metadata.companyFootprint === true);
const geometry = (nodes: SceneNode[]) => nodes.map(node => ({ id: node.id, parentId: node.parentId, rect: node.rect }));
const inside = (outer: SceneNode['rect'], inner: SceneNode['rect']) => inner.x >= outer.x - 1e-7 && inner.y >= outer.y - 1e-7
  && inner.x + inner.width <= outer.x + outer.width + 1e-7 && inner.y + inner.height <= outer.y + outer.height + 1e-7;

describe('persistent native blueprint world', () => {
  it('wraps distant slots before the camera limit without collapsing company boundaries', () => {
    const samples = [0, 1, 2, 3, 15000, 15240, 15241, 15242, 15243, 15244, 15245,
      MAX_COMPANY_FOOTPRINTS - 4, MAX_COMPANY_FOOTPRINTS - 3, MAX_COMPANY_FOOTPRINTS - 2, MAX_COMPANY_FOOTPRINTS - 1]
      .map(index => companyFootprintAt(index));
    for (const rect of samples) {
      expect(rect.width).toBe(COMPANY_FOOTPRINT_WIDTH);
      expect(rect.height).toBe(COMPANY_FOOTPRINT_HEIGHT);
      expect(rect.x).toBeGreaterThanOrEqual(0); expect(rect.y).toBeGreaterThanOrEqual(0);
      expect(rect.x + rect.width).toBeLessThanOrEqual(MAX_COORD);
      expect(rect.y + rect.height).toBeLessThanOrEqual(MAX_COORD);
    }
    for (let i = 0; i < samples.length; i++) for (let j = i + 1; j < samples.length; j++) {
      const a = samples[i]!, b = samples[j]!;
      expect(a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height).toBe(false);
    }
    for (const index of [-1, .5, NaN, Infinity, MAX_COMPANY_FOOTPRINTS]) expect(() => companyFootprintAt(index)).toThrow(RangeError);
  });

  it('keeps every small-portfolio plan, room and employee fixed while only focus changes', () => {
    const snapshot = fixture();
    const focuses: FreeflowFocus[] = [{ kind: 'portfolio' }, { kind: 'company', companyId: 'c001' },
      { kind: 'office', companyId: 'c000', officeId: 'o-c000' },
      { kind: 'department', companyId: 'c000', officeId: 'o-c000', departmentId: 'd-c000' }];
    const scenes = focuses.map(focus => buildUniverse(snapshot, focus));
    expect(scenes[0]!.title).toBe('Blueprint world');
    for (const scene of scenes) {
      expect(scene.tableBounds).toBeUndefined();
      expect(scene.worldMode).toBe('blueprint');
      expect(scene.breadcrumbs.find(crumb => crumb.focus.kind === 'portfolio')?.label).toBe('Blueprint world');
      expect(geometry(scene.nodes)).toEqual(geometry(scenes[0]!.nodes));
      expect(scene.threads).toEqual(scenes[0]!.threads);
      expect(scene.nodes.filter(node => node.kind === 'room')).toHaveLength(3);
      expect(scene.nodes.filter(node => node.kind === 'employee')).toHaveLength(3);
      expect(footprints(scene).every(plan => plan.metadata.blueprintDetail === 'full')).toBe(true);
    }
    expect(scenes[2]!.focusBounds).not.toEqual(scenes[0]!.focusBounds);
  });

  it('contains multiple offices, leadership, board owners and global references below the real header/footer', () => {
    const base = fixture(2);
    const snapshot: FreeflowSnapshot = { ...base,
      offices: [...base.offices!, { id: 'second-office', companyId: 'c000', name: 'Research office', status: 'active' }],
      departments: [...base.departments!, { id: 'research', companyId: 'c000', officeId: 'second-office', name: 'Research', status: 'active' }],
      employees: [...base.employees!,
        { id: 'leader', companyId: 'c000', officeId: null, departmentId: null, name: 'Director', role: 'Director', kind: 'human', status: 'active' },
        { id: 'donna', companyId: null, officeId: null, departmentId: null, name: 'Donna', role: 'Assistant', kind: 'assistant', status: 'active' }],
    };
    const scene = buildUniverse(snapshot, { kind: 'portfolio' });
    const plans = new Map(footprints(scene).map(plan => [plan.companyId, plan]));
    for (const node of scene.nodes) {
      const plan = plans.get(node.companyId)!;
      expect(inside(plan.rect, node.rect)).toBe(true);
      if (node.metadata.companyFootprintId) {
        expect(node.metadata.companyFootprintId).toBe(plan.id);
        expect(node.rect.x).toBeGreaterThanOrEqual(plan.rect.x + 32 - 1e-7);
        expect(node.rect.y).toBeGreaterThanOrEqual(plan.rect.y + 92 - 1e-7);
        expect(node.rect.x + node.rect.width).toBeLessThanOrEqual(plan.rect.x + plan.rect.width - 32 + 1e-7);
        expect(node.rect.y + node.rect.height).toBeLessThanOrEqual(plan.rect.y + plan.rect.height - 76 + 1e-7);
      }
      if (node.parentId) expect(scene.nodes.some(candidate => candidate.id === node.parentId)).toBe(true);
    }
    expect(scene.nodes.some(node => node.entityId === 'leader')).toBe(true);
    expect(scene.nodes.some(node => node.metadata.globalAssistant === true)).toBe(true);
    expect(scene.nodes.some(node => node.metadata.organizational === true)).toBe(false);
    const relationship = scene.threads.find(thread => thread.kind === 'company-parent')!;
    expect(relationship).toBeDefined();
    expect([relationship.fromId, relationship.toId].sort()).toEqual(['folio:c000', 'folio:c001']);
    for (const marker of scene.nodes.filter(node => node.kind === 'folio')) {
      expect(marker.metadata.companyMarker).toBe(true);
      expect(marker.metadata.seat).toBe(false);
      expect(marker.rect.width).toBe(48); expect(marker.rect.height).toBe(48);
      expect(marker.parentId).toBe(plans.get(marker.companyId)!.id);
    }
  });

  it('bounds detailed projection while every proxy retains its same footprint and canonical identity', () => {
    const snapshot = fixture(70);
    const left = buildUniverse(snapshot, { kind: 'portfolio' });
    const far = footprints(left).find(plan => plan.companyId === 'c069')!;
    const right = buildUniverse(snapshot, { kind: 'portfolio' }, { detailCenter: { x: far.rect.x, y: far.rect.y } });
    const forced = buildUniverse(snapshot, { kind: 'company', companyId: 'c069' }, { detailCenter: { x: 0, y: 0 } });
    for (const scene of [left, right, forced]) {
      expect(footprints(scene)).toHaveLength(70);
      expect(footprints(scene).filter(plan => plan.metadata.blueprintDetail === 'full')).toHaveLength(FULL_COMPANY_PLAN_LIMIT);
      expect(footprints(scene).filter(plan => plan.metadata.blueprintDetail === 'proxy')).toHaveLength(70 - FULL_COMPANY_PLAN_LIMIT);
      expect(geometry(footprints(scene))).toEqual(geometry(footprints(left)));
      expect(footprints(scene).every(plan => plan.rect.width === COMPANY_FOOTPRINT_WIDTH && plan.rect.height === COMPANY_FOOTPRINT_HEIGHT)).toBe(true);
    }
    expect(far.metadata.blueprintDetail).toBe('proxy');
    expect(footprints(forced).find(plan => plan.companyId === 'c069')!.metadata.blueprintDetail).toBe('full');
    const rightNodes = new Map(right.nodes.map(node => [node.id, node]));
    for (const node of left.nodes) if (rightNodes.has(node.id)) expect(node.rect).toEqual(rightNodes.get(node.id)!.rect);
    expect(buildUniverse(snapshot, { kind: 'portfolio' }, { detailCenter: { x: NaN, y: Infinity } })).toEqual(left);
  });

  it('omits malformed saved room geometry without substituting a room or altering its source record', () => {
    const base = fixture(1), blueprint = base.blueprints![0]!;
    const snapshot: FreeflowSnapshot = { ...base, blueprints: [{ ...blueprint, rooms: [...blueprint.rooms,
      { ...blueprint.rooms[0]!, id: 'invalid', x: NaN }, { ...blueprint.rooms[0]!, id: 'zero', width: 0 }] }] };
    const before = structuredClone(snapshot);
    const scene = buildUniverse(snapshot, { kind: 'portfolio' });
    expect(scene.nodes.filter(node => node.kind === 'room').map(node => node.entityId)).toEqual(['r-c000']);
    expect(footprints(scene)[0]!.blueprintPreview?.invalidRoomCount).toBe(2);
    expect(snapshot).toEqual(before);
  });

  it('keeps footprints disjoint and deterministic after input reorder and output mutation', () => {
    const snapshot = fixture(50), before = structuredClone(snapshot);
    const a = buildUniverse(snapshot, { kind: 'portfolio' });
    const b = buildUniverse({ ...snapshot, companies: [...snapshot.companies!].reverse(), offices: [...snapshot.offices!].reverse(),
      employees: [...snapshot.employees!].reverse(), departments: [...snapshot.departments!].reverse(), blueprints: [...snapshot.blueprints!].reverse() }, { kind: 'portfolio' });
    expect(b).toEqual(a);
    const plans = footprints(a);
    for (let i = 0; i < plans.length; i++) for (let j = i + 1; j < plans.length; j++) {
      const p = plans[i]!.rect, q = plans[j]!.rect;
      expect(p.x < q.x + q.width && q.x < p.x + p.width && p.y < q.y + q.height && q.y < p.y + p.height).toBe(false);
    }
    plans[0]!.rect.x = 999;
    a.nodes.find(node => node.kind === 'employee')!.metadata.blueprintScale = -1;
    expect(snapshot).toEqual(before);
  });
});
