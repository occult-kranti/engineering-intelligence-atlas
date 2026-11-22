import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { installDom, type FreeflowDom } from './fixtures/freeflow-dom.js';
import { buildUniverse } from '../src/renderer/freeflow/universe.js';
import { mountScene, RICH_NODE_BUDGET, describeNode } from '../src/renderer/freeflow/scene.js';
import { mountStudio, type StudioActionContext, type StudioActionKind } from '../src/renderer/freeflow/studio.js';
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
  const actions: Array<{ action: string; companyId: string; nodeId: string }> = [];
  const renderer = mountScene(host, { onOpen: node => opened.push(node.companyId),
    onCanvasAction: (action, node) => actions.push({ action, companyId: node.companyId, nodeId: node.id }) });
  cleanup.push(() => renderer.destroy());
  return { host, renderer, opened, actions };
}

describe('native blueprint company surfaces', () => {
  it('renders full native rooms and real board controls with source labels kept inert', () => {
    const { host, renderer } = mount();
    renderer.setCamera({ x: 560, y: 820, zoom: .5, yaw: 0, pitch: 0, distance: 1800 });
    const scene = buildUniverse(snapshot(), { kind: 'portfolio' }); renderer.update(scene);
    const plan = host.querySelector('[data-node-id="universe:table-plan:alpha"]')!;
    expect(plan.classList.contains('ff-node--company-plan')).toBe(true);
    expect(plan.getAttribute('role')).toBe('group');
    expect(plan.querySelectorAll('.ff-table-plan-room')).toHaveLength(0);
    expect(plan.querySelectorAll('img,script,path')).toHaveLength(0);
    expect(plan.querySelector('.ff-table-plan-title')?.textContent).toBe('Alpha <img src=x>');
    expect([...plan.querySelectorAll<HTMLButtonElement>('button[data-canvas-action]')].map(button => button.dataset.canvasAction))
      .toEqual(['chat', 'roadmap', 'whiteboard', 'ownership', 'hire']);
    const room = host.querySelector<HTMLElement>('[data-node-id="universe:blueprint:room:alpha:hq:one"]')!;
    const roomNode = scene.nodes.find(node => node.id === room.dataset.nodeId)!;
    expect(room.querySelector('.ff-node-title')?.textContent).toBe('Review <img src=x onerror=bad()>');
    expect(room.querySelectorAll('img,script')).toHaveLength(0);
    expect(Number.parseFloat(room.style.width)).toBeCloseTo(roomNode.rect.width, 7);
    expect(Number.parseFloat(room.style.height)).toBeCloseTo(roomNode.rect.height, 7);
    expect(host.querySelectorAll('.ff-node--room')).toHaveLength(2);
    const office = host.querySelector('[data-node-id="universe:blueprint:office:alpha:hq"]')!;
    expect(office.querySelector('.ff-node-title')?.textContent).toBe('HQ <script>bad()</script>');
    const empty = host.querySelector('[data-node-id="universe:table-plan:empty"]')!;
    expect(empty.querySelector('svg')).toBeNull();
    expect(empty.textContent).toContain('No saved blueprint');
    expect(host.querySelectorAll('.ff-chair')).toHaveLength(0);
    expect(host.querySelectorAll('.ff-node--company-marker')).toHaveLength(2);
  });

  it('retains bounded saved-outline previews only for company proxies', () => {
    const { host, renderer } = mount(), base = snapshot();
    const companies = Array.from({ length: 26 }, (_, i) => ({ id: `a${String(i).padStart(3, '0')}`, name: `Company ${i}`, status: 'active' }));
    const scene = buildUniverse({ ...base, companies: [...companies, ...base.companies!] }, { kind: 'portfolio' });
    expect(scene.nodes.find(node => node.id === 'universe:table-plan:alpha')?.metadata.blueprintDetail).toBe('proxy');
    renderer.update(scene); renderer.select('universe:table-plan:alpha');
    const plan = host.querySelector('[data-node-id="universe:table-plan:alpha"]')!;
    expect(plan.querySelectorAll('.ff-table-plan-room')).toHaveLength(2);
    expect(plan.querySelector('.ff-table-plan-office-label')?.textContent).toBe('HQ <script>bad()</script>');
    expect(plan.querySelector('.ff-table-plan-room title')?.textContent).toBe('Review <img src=x onerror=bad()>');
    expect(plan.querySelectorAll('img,script,path')).toHaveLength(0);
    expect(host.querySelector('[data-node-id="universe:blueprint:room:alpha:hq:one"]')).toBeNull();
    expect(describeNode(scene.nodes.find(node => node.id === 'universe:table-plan:alpha')!)).not.toContain('Contracted staff');
  });

  it('updates actual room geometry on the same keyed native element', () => {
    const { host, renderer } = mount(), original = snapshot();
    renderer.update(buildUniverse(original, { kind: 'portfolio' }));
    const before = host.querySelector<HTMLElement>('[data-node-id="universe:blueprint:room:alpha:hq:one"]')!;
    const width = before.style.width;
    const updated: FreeflowSnapshot = { ...original, blueprints: [{ ...original.blueprints![0]!, rooms: original.blueprints![0]!.rooms.map(room => room.id === 'one' ? { ...room, width: 35 } : room) }] };
    renderer.update(buildUniverse(updated, { kind: 'portfolio' }));
    const after = host.querySelector<HTMLElement>('[data-node-id="universe:blueprint:room:alpha:hq:one"]')!;
    expect(after).toBe(before);
    expect(after.style.width).not.toBe(width);
    expect(host.querySelectorAll('.ff-node--room')).toHaveLength(2);
  });

  it('keeps footprint Enter navigation separate from native button keyboard activation', () => {
    const { host, renderer, opened, actions } = mount(); renderer.update(buildUniverse(snapshot(), { kind: 'portfolio' }));
    const plan = host.querySelector<HTMLElement>('[data-node-id="universe:table-plan:alpha"]')!;
    dom.key(plan, 'Enter');
    expect(opened).toEqual(['alpha']);
    const ownership = plan.querySelector<HTMLButtonElement>('button[data-canvas-action="ownership"]')!;
    ownership.focus();
    expect(dom.key(ownership, 'Enter').defaultPrevented).toBe(false);
    expect(dom.key(ownership, ' ').defaultPrevented).toBe(false);
    expect(opened).toEqual(['alpha']);
    expect(actions).toEqual([]);
    // JSDOM does not synthesize the browser's default click after a keydown.
    ownership.click();
    expect(actions).toEqual([{ action: 'ownership', companyId: 'alpha', nodeId: 'universe:table-plan:alpha' }]);
    expect(opened).toEqual(['alpha']);
    ownership.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    expect(opened).toEqual(['alpha']);
  });

  it('uses Studio company navigation without a separate page or mutated native state', () => {
    const host = document.createElement('div'); document.body.append(host);
    const nav: FreeflowFocus[] = [];
    const studio = mountStudio(host, { continuousCanvas: true, storage: null, onNavigate: focus => nav.push(focus), onAction: () => { throw Error('Enter must only navigate'); } });
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

  it('dispatches every live board action with its own company, including ownership outside the current company', () => {
    const host = document.createElement('div'); document.body.append(host);
    const nav: FreeflowFocus[] = [];
    const actions: Array<{ action: StudioActionKind; context: StudioActionContext }> = [];
    const studio = mountStudio(host, { continuousCanvas: true, storage: null, onNavigate: focus => nav.push(focus),
      onAction: (action, context) => actions.push({ action, context }) });
    cleanup.push(() => studio.destroy());
    dom.setGeometry(studio.elements.canvasHost, { width: 1200, height: 800, left: 0, top: 0 }); dom.fireResize();
    const snap = snapshot(), saved = JSON.stringify(snap);
    studio.update(snap, { kind: 'company', companyId: 'alpha' }); dom.raf.drain();
    studio.setCamera({ x: 560, y: 820, zoom: .5, yaw: 0, pitch: 0, distance: 1800 }); dom.raf.drain();
    const plan = studio.elements.world.querySelector('[data-node-id="universe:table-plan:empty"]')!;
    expect(plan).not.toBeNull();
    const buttons = [...plan.querySelectorAll<HTMLButtonElement>('button[data-canvas-action]')];
    for (const button of buttons) {
      button.focus();
      expect(dom.key(button, 'Enter').defaultPrevented).toBe(false);
      button.click();
    }
    expect(actions.map(item => item.action)).toEqual(['chat', 'roadmap', 'whiteboard', 'ownership', 'hire']);
    expect(actions.every(item => item.context.companyId === 'empty' && item.context.nodeId === 'universe:table-plan:empty')).toBe(true);
    expect(nav).toEqual([]);
    expect(JSON.stringify(snap)).toBe(saved);
    studio.destroy();
    buttons[3]!.click();
    expect(actions).toHaveLength(5);
  });

  it('keeps company entry points and footprints available within the shared DOM budget', () => {
    const { host, renderer } = mount();
    const companies = Array.from({ length: 200 }, (_, i) => ({ id: `c${String(i).padStart(3, '0')}`, name: `Company ${i}`, status: 'active' }));
    renderer.setCamera({ x: 65000, y: 820, zoom: .01, yaw: 0, pitch: 0, distance: 1800 });
    renderer.update(buildUniverse({ companies }, { kind: 'portfolio' }));
    expect(host.querySelectorAll('.ff-chair')).toHaveLength(0);
    expect(host.querySelectorAll('.ff-node').length).toBeLessThanOrEqual(RICH_NODE_BUDGET);
    expect(host.querySelectorAll('.ff-node--company-plan').length).toBeGreaterThan(0);
    expect(host.querySelectorAll('.ff-node--company-marker').length).toBeGreaterThan(0);
    expect(renderer.stats().total).toBe(400);
    expect(renderer.stats().capped).toBe(true);
  });

  it('keeps selected offscreen company controls reachable within capacity for 1000 companies', () => {
    const { host, renderer, opened, actions } = mount();
    const companies = Array.from({ length: 1000 }, (_, i) => ({ id: `c${String(i).padStart(3, '0')}`, name: `Company ${i}`, status: 'active' }));
    renderer.setCamera({ x: 0, y: 0, zoom: .02, yaw: 0, pitch: 0, distance: 1800 });
    renderer.update(buildUniverse({ companies }, { kind: 'portfolio' })); renderer.select('universe:table-plan:c999');
    const plan = host.querySelector('[data-node-id="universe:table-plan:c999"]')!;
    expect(plan).not.toBeNull();
    expect(host.querySelectorAll('.ff-node').length).toBeLessThanOrEqual(RICH_NODE_BUDGET);
    expect(renderer.stats().total).toBe(2000);
    plan.querySelector<HTMLButtonElement>('button[data-canvas-action="ownership"]')!.click();
    dom.key(plan, 'Enter');
    expect(actions).toEqual([{ action: 'ownership', companyId: 'c999', nodeId: 'universe:table-plan:c999' }]);
    expect(opened).toEqual(['c999']);
  });

  it('keeps the camera-local company and its canonical marker when the horizon spans 1000 companies', () => {
    const { host, renderer } = mount();
    const companies = Array.from({ length: 1000 }, (_, i) => ({ id: `c${String(i).padStart(3, '0')}`, name: `Company ${i}`, status: 'active' }));
    const world = buildUniverse({ companies }, { kind: 'portfolio' });
    const current = world.nodes.find(n => n.id === 'universe:table-plan:c999')!;
    renderer.setCamera({ x: current.rect.x + current.rect.width / 2, y: current.rect.y + current.rect.height / 2,
      zoom: .7, yaw: 0, pitch: 55, distance: 400 });
    renderer.update(world);
    expect(host.querySelector('[data-node-id="universe:table-plan:c999"]')).not.toBeNull();
    expect(host.querySelector('[data-node-id="folio:c999"]')).not.toBeNull();
    expect(host.querySelectorAll('.ff-node').length).toBeLessThanOrEqual(RICH_NODE_BUDGET);
  });
});
