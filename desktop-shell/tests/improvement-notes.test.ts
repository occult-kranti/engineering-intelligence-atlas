import { describe, expect, it } from 'vitest';
import type { SceneNode } from '../src/renderer/freeflow/model.js';
import type { StickyNote } from '../src/renderer/improvement/model.js';
import { projectStickyNotes } from '../src/renderer/improvement/notes.js';
const node = (extra: Partial<SceneNode>): SceneNode => ({ id: 'plan', kind: 'reference', entityId: 'a', companyId: 'a', parentId: null,
  label: 'A', subtitle: '', status: 'active', counts: {}, metadata: { companyFootprint: true, blueprintDetail: 'full' }, rect: { x: 100, y: 100, width: 1120, height: 760 }, ...extra });
const nodes = [node({}), node({ id: 'office', kind: 'office', officeId: 'o', metadata: {} }), node({ id: 'room', kind: 'room', officeId: 'o', departmentId: 'd', metadata: {}, rect: { x: 140, y: 200, width: 240, height: 200 } })];
const note = (extra: Partial<StickyNote> = {}): StickyNote => ({ id: 'n', revision: 0, companyId: 'a', officeId: 'o', departmentId: null,
  kind: 'todo', color: 'yellow', text: 'Check keyboard controls', status: 'open', ownerEmployeeId: null, goalIds: [], x: .8, y: .2, createdAt: '', updatedAt: '', ...extra });
describe('in-world saved sticky projection', () => {
  it('contains company and department notes for every normalized corner without changing native records', () => {
    for (const departmentId of [null, 'd']) for (const x of [0, .5, 1]) for (const y of [0, .5, 1]) {
      const input = note({ departmentId, x, y }), before = structuredClone(input), projected = projectStickyNotes([input], nodes).nodes[0]!;
      const anchor = departmentId ? nodes[2]! : nodes[0]!;
      expect(projected.rect.x).toBeGreaterThanOrEqual(anchor.rect.x); expect(projected.rect.y).toBeGreaterThanOrEqual(anchor.rect.y);
      expect(projected.rect.x + projected.rect.width).toBeLessThanOrEqual(anchor.rect.x + anchor.rect.width);
      expect(projected.rect.y + projected.rect.height).toBeLessThanOrEqual(anchor.rect.y + anchor.rect.height);
      expect(projected.metadata.annotationOnly).toBe(true); expect(input).toEqual(before);
    }
  });
  it('never relocates missing-scope or archived notes to an unrelated company', () => {
    for (const invalid of [{ companyId: 'b' }, { officeId: 'other' }, { departmentId: 'other' }, { status: 'archived' as const }, { x: NaN }, { y: 2 }]) {
      expect(projectStickyNotes([note(invalid)], nodes).nodes).toEqual([]);
    }
  });
  it('caps annotations separately from geometry and preserves literal text, native IDs and stable color', () => {
    const input = Array.from({ length: 100 }, (_, i) => note({ id: `n-${i}`, text: '<img src=x onerror=alert(1)>', color: 'pink' }));
    const result = projectStickyNotes(input, nodes);
    expect(result.nodes).toHaveLength(32); expect(result.omitted).toBe(68);
    expect(result.nodes[0]?.label).toContain('<img'); expect(result.nodes[0]?.metadata.stickyColor).toBe('pink');
    expect(new Set(result.nodes.map(n => n.id)).size).toBe(32);
    expect(projectStickyNotes(Array.from({ length: 2001 }, () => note()), nodes).nodes).toEqual([]);
  });
});
