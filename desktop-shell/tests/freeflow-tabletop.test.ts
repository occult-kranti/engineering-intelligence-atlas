import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { installDom, type FreeflowDom } from './fixtures/freeflow-dom.js';
import { buildUniverse } from '../src/renderer/freeflow/universe.js';
import { mountScene, RICH_NODE_BUDGET, describeNode } from '../src/renderer/freeflow/scene.js';
import { mountStudio } from '../src/renderer/freeflow/studio.js';
import type { FreeflowSnapshot, FreeflowFocus } from '../src/renderer/freeflow/model.js';

let dom: FreeflowDom;
const cleanup: Array<() => void> = [];
beforeEach(() => { dom = installDom(); });
afterEach(() => { for (const fn of cleanup.splice(0)) fn(); dom.restore(); });

function snapshot(): FreeflowSnapshot {
  return {
    companies: [{ id: 'alpha', name: 'Alpha <img src=x>', status: 'active' }, { id: 'empty', name: 'No saved office', status: 'active' }],
    offices: [{ id: 'hq', companyId: 'alpha', name: 'HQ <script>bad()</script>', status: 'active' }],
    blueprints: [{ id: 'plan', companyId: 'alpha', officeId: 'hq', desks: [], whiteboards: [], rooms: [
      { id: 'one', name: 'Review <img src=x onerror=bad()>', departmentId: null, x: 10, y: 10, width: 20, height: 20 },
      { id: 'two', name: 'Work', departmentId: null, x: 50, y: 10, width: 10, height: 20 },
    ] }],
  };
}

function mount() {
  const host = document.createElement('div'); document.body.append(host);
  dom.setGeometry(host, { width: 1600, height: 900, left: 0, top: 0 });
  const opened: string[] = [];
  const renderer = mountScene(host, { onOpen: node => opened.push(node.companyId) });
  cleanup.push(() => renderer.destroy());
  return { host, renderer, opened };
}

describe('tabletop saved blueprint previews', () => {
  it('renders only actual saved room outlines, with source labels kept inert', () => {
    const { host, renderer } = mount();
    const scene = buildUniverse(snapshot(), { kind: 'portfolio' }); renderer.update(scene);
    const plan = host.querySelector('[data-node-id="universe:table-plan:alpha"]')!;
    expect(plan.classList.contains('ff-node--table-plan')).toBe(true);
    expect(plan.querySelectorAll('.ff-table-plan-room')).toHaveLength(2);
    expect(plan.querySelectorAll('img,script,path')).toHaveLength(0);
    expect(plan.querySelector('.ff-table-plan-title')?.textContent).toBe('Alpha <img src=x>');
    expect(plan.querySelector('.ff-table-plan-office-label')?.textContent).toBe('HQ <script>bad()</script>');
    expect(plan.querySelector('.ff-table-plan-room title')?.textContent).toBe('Review <img src=x onerror=bad()>');
    expect(plan.getAttribute('aria-label')).toContain('Saved blueprint preview');
    const empty = host.querySelector('[data-node-id="universe:table-plan:empty"]')!;
    expect(empty.querySelector('svg')).toBeNull();
    expect(empty.textContent).toContain('No saved blueprint');
    expect(host.querySelectorAll('.ff-chair')).toHaveLength(2);
  });

  it('updates real geometry on the same keyed element even when names and room counts do not change', () => {
    const { host, renderer } = mount(), original = snapshot();
    renderer.update(buildUniverse(original, { kind: 'portfolio' }));
    const before = host.querySelector('[data-node-id="universe:table-plan:alpha"]')!;
    const width = before.querySelector('[data-room-id="one"]')!.getAttribute('width');
    const updated: FreeflowSnapshot = { ...original, blueprints: [{ ...original.blueprints![0]!, rooms: original.blueprints![0]!.rooms.map(room => room.id === 'one' ? { ...room, width: 35 } : room) }] };
    renderer.update(buildUniverse(updated, { kind: 'portfolio' }));
    const after = host.querySelector('[data-node-id="universe:table-plan:alpha"]')!;
    expect(after).toBe(before);
    expect(after.querySelector('[data-room-id="one"]')!.getAttribute('width')).not.toBe(width);
    expect(after.querySelectorAll('.ff-table-plan-room')).toHaveLength(2);
  });

  it('opens the same company through the visible action and keyboard entry', () => {
    const { host, renderer, opened } = mount(); renderer.update(buildUniverse(snapshot(), { kind: 'portfolio' }));
    const plan = host.querySelector('[data-node-id="universe:table-plan:alpha"]')!;
    plan.querySelector('.ff-table-plan-open')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    dom.key(plan, 'Enter');
    expect(opened).toEqual(['alpha', 'alpha']);
  });

  it('uses Studio company navigation without a separate page or mutated native state', () => {
    const host = document.createElement('div'); document.body.append(host);
    const nav: FreeflowFocus[] = [];
    const studio = mountStudio(host, { continuousCanvas: true, storage: null, onNavigate: focus => nav.push(focus), onAction: () => { throw Error('Preview must only navigate'); } });
    cleanup.push(() => studio.destroy());
    dom.setGeometry(studio.elements.canvasHost, { width: 1200, height: 800, left: 0, top: 0 }); dom.fireResize();
    const snap = snapshot(), saved = JSON.stringify(snap);
    studio.update(snap, { kind: 'portfolio' }); dom.raf.drain();
    const world = studio.elements.world;
    const plan = world.querySelector('[data-node-id="universe:table-plan:alpha"]')!;
    dom.key(plan, 'Enter');
    expect(nav).toEqual([{ kind: 'company', companyId: 'alpha' }]);
    studio.update(snap, nav[0]!); dom.raf.drain();
    expect(studio.elements.world).toBe(world);
    expect(world.querySelector('[data-node-id="universe:blueprint:room:alpha:hq:one"]')).not.toBeNull();
    expect(JSON.stringify(snap)).toBe(saved);
  });

  it('keeps chairs ahead of previews within the shared node budget for a fully visible 200-company table', () => {
    const { host, renderer } = mount();
    const companies = Array.from({ length: 200 }, (_, i) => ({ id: `c${String(i).padStart(3, '0')}`, name: `Company ${i}`, status: 'active' }));
    renderer.setCamera({ x: 0, y: 0, zoom: .02, yaw: 0, pitch: 0, distance: 1800 });
    renderer.update(buildUniverse({ companies }, { kind: 'portfolio' }));
    expect(host.querySelectorAll('.ff-chair')).toHaveLength(200);
    expect(host.querySelectorAll('.ff-node')).toHaveLength(RICH_NODE_BUDGET);
    expect(host.querySelectorAll('.ff-node--table-plan')).toHaveLength(40);
    expect(renderer.stats().total).toBe(400);
    expect(renderer.stats().capped).toBe(true);
  });

  it('keeps selected offscreen previews reachable within capacity for 1000 companies', () => {
    const { host, renderer } = mount();
    const companies = Array.from({ length: 1000 }, (_, i) => ({ id: `c${String(i).padStart(3, '0')}`, name: `Company ${i}`, status: 'active' }));
    renderer.setCamera({ x: 0, y: 0, zoom: .02, yaw: 0, pitch: 0, distance: 1800 });
    renderer.update(buildUniverse({ companies }, { kind: 'portfolio' })); renderer.select('universe:table-plan:c999');
    expect(host.querySelector('[data-node-id="universe:table-plan:c999"]')).not.toBeNull();
    expect(host.querySelectorAll('.ff-node').length).toBeLessThanOrEqual(RICH_NODE_BUDGET);
    expect(renderer.stats().total).toBe(2000);
    const node = buildUniverse(snapshot(), { kind: 'portfolio' }).nodes.find(node => node.blueprintPreview)!;
    expect(describeNode(node)).not.toContain('Contracted staff');
  });
});
