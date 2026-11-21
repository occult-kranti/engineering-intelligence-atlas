// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { installDom, type FreeflowDom } from './fixtures/freeflow-dom.js';
import { buildScene, type FreeflowSnapshot } from '../src/renderer/freeflow/model.js';
import { buildUniverse } from '../src/renderer/freeflow/universe.js';
import { worldToScreen } from '../src/renderer/freeflow/camera.js';
import { mountStudio, type Studio, type StudioActionKind, type StudioActionContext } from '../src/renderer/freeflow/studio.js';
import { mountScene, RICH_NODE_BUDGET, THREAD_BUDGET, type SceneRenderer } from '../src/renderer/freeflow/scene.js';
import { mountA11yList, type A11yList } from '../src/renderer/freeflow/a11y-list.js';

let dom: FreeflowDom;
const cleanups: Array<() => void> = [];

beforeEach(() => { dom = installDom(); });
afterEach(() => { for (const c of cleanups.splice(0)) try { c(); } catch { /* ignore */ } dom.restore(); });

function dense(nEmployees: number): FreeflowSnapshot {
  const rooms = [{ id: 'r1', name: 'Hall', departmentId: null, x: 0, y: 0, width: 800, height: 400 }];
  const employees = Array.from({ length: nEmployees }, (_, i) => ({
    id: `e${String(i).padStart(4, '0')}`, companyId: 'c1', officeId: 'o1', departmentId: null, name: `Emp ${String(i).padStart(4, '0')}`, role: 'Worker', kind: 'specialist', status: 'active',
  }));
  const desks = employees.map((e, i) => ({ id: `dk${i}`, roomId: 'r1', employeeId: e.id, x: (i % 40) / 40, y: Math.floor(i / 40) / Math.ceil(nEmployees / 40) }));
  const boards = employees.slice(0, 200).map((e, i) => ({ id: `w${i}`, roomId: 'r1', ownerEmployeeId: e.id, title: `B${i}`, goalIds: [], jobIds: [], x: 0.5, y: 0.5 }));
  return {
    companies: [{ id: 'c1', name: 'Co', status: 'active' }],
    offices: [{ id: 'o1', companyId: 'c1', name: 'HQ', status: 'active' }],
    departments: [], employees, jobs: [],
    blueprints: [{ id: 'bp', companyId: 'c1', officeId: 'o1', rooms, desks, whiteboards: boards }],
  };
}

function small(extra: Partial<FreeflowSnapshot> = {}): FreeflowSnapshot {
  return {
    companies: [{ id: 'a', name: 'Alpha', status: 'active' }, { id: 'b', name: 'Beta', status: 'active' }],
    offices: [{ id: 'oa', companyId: 'a', name: 'A HQ', status: 'active' }],
    ...extra,
  };
}

interface Mounted { studio: Studio; host: HTMLElement; actions: Array<{ a: StudioActionKind; c: StudioActionContext }>; nav: unknown[] }

function mountS(storage: Pick<Storage, 'getItem' | 'setItem'> | null = null, caps?: Parameters<typeof mountStudio>[1]['capabilities'], continuousCanvas = false): Mounted {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const m: Mounted = { host, actions: [], nav: [], studio: null as never };
  m.studio = mountStudio(host, { onNavigate: (f) => m.nav.push(f), onAction: (a, c) => m.actions.push({ a, c }), storage, capabilities: caps, continuousCanvas });
  cleanups.push(() => m.studio.destroy());
  return m;
}

function measure(m: Mounted, w = 1200, h = 800) {
  dom.setGeometry(m.studio.elements.canvasHost, { width: w, height: h, left: 0, top: 0 });
  dom.fireResize();
}

function worldTransform(m: Mounted): string {
  return (m.studio.elements.canvasHost.querySelector('.ff-world') as HTMLElement).style.transform;
}

describe('freeflow studio (mounted)', () => {
  it('keeps one camera owner: A camera restored from memory with null or throwing storage', () => {
    const throwing = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('denied'); } };
    for (const storage of [null, throwing]) {
      const m = mountS(storage);
      measure(m);
      const snap = small();
      m.studio.update(snap, { kind: 'company', companyId: 'a' });
      measure(m);
      const initial = worldTransform(m);
      const zoomIn = [...m.host.querySelectorAll('.ff-controls button')].find((b) => b.getAttribute('aria-label') === 'Zoom in')!;
      dom.setReducedMotion(true);
      zoomIn.click();
      const changed = worldTransform(m);
      expect(changed).not.toBe(initial);
      m.studio.update(snap, { kind: 'company', companyId: 'b' });
      m.studio.update(snap, { kind: 'company', companyId: 'a' });
      expect(worldTransform(m)).toBe(changed);
    }
  });

  it('hidden initial mount fits once with final geometry and preserves user camera afterwards', () => {
    const store = { m: new Map<string, string>(), getItem(k: string) { return this.m.get(k) ?? null; }, setItem(k: string, v: string) { this.m.set(k, v); } };
    const m = mountS(store);
    m.studio.setActive(false);
    m.studio.update(small(), { kind: 'company', companyId: 'a' });
    expect(store.m.size).toBe(0);
    m.studio.setActive(true);
    expect(store.m.size).toBe(0);
    measure(m, 1600, 900);
    const fitted = worldTransform(m);
    expect(fitted).toContain('translate(800px, 450px)');
    m.studio.update(small(), { kind: 'company', companyId: 'a' });
    expect(worldTransform(m)).toBe(fitted);
  });

  it.each(['before first update', 'after empty update'])('retains explicit panel framing %s through first data, visibility and refresh', (when) => {
    const m = mountS(null, undefined, true);
    const focus = { kind: 'portfolio' } as const;
    // A deep-linked surface can frame before an office snapshot or measured canvas exists.
    m.studio.setActive(false);
    if (when === 'after empty update') m.studio.update({}, focus);
    const requested = { x: -180, y: 1440, zoom: 1.1, yaw: 0, pitch: 0, distance: 1800 };
    m.studio.setCamera(requested);
    m.studio.update({}, focus);
    m.studio.setActive(true);
    measure(m, 1280, 720);
    dom.raf.drain();
    expect(m.studio.getCamera()).toEqual(requested);

    m.studio.update(small(), focus);
    expect(m.studio.getCamera()).toEqual(requested);
    m.studio.setActive(false);
    dom.setHidden(true);
    m.studio.update(small(), focus);
    m.studio.setActive(true);
    dom.setHidden(false);
    measure(m, 1280, 760);
    dom.raf.drain();
    expect(m.studio.getCamera()).toEqual(requested);
    // The host's camera is remembered as a value, not as a mutable caller-owned object.
    requested.y = 9000;
    m.studio.setActive(false);
    m.studio.setActive(true);
    expect(m.studio.getCamera().y).toBe(1440);
  });

  it('consumes pre-snapshot framing for only the initial scope, allowing later company navigation', () => {
    const m = mountS(null, undefined, true);
    measure(m, 1280, 720);
    const requested = { x: -180, y: 1440, zoom: 1.1, yaw: 0, pitch: 0, distance: 1800 };
    m.studio.setCamera(requested);
    m.studio.update({}, { kind: 'portfolio' });
    m.studio.update(small(), { kind: 'portfolio' });
    expect(m.studio.getCamera()).toEqual(requested);

    m.studio.update(small(), { kind: 'company', companyId: 'a' });
    const companyCamera = m.studio.getCamera();
    expect(companyCamera).not.toEqual(requested);
    expect(companyCamera.pitch).toBe(0);
    m.studio.update(small(), { kind: 'portfolio' });
    expect(m.studio.getCamera()).toEqual(requested);
    m.studio.update(small(), { kind: 'company', companyId: 'a' });
    expect(m.studio.getCamera()).toEqual(companyCamera);
  });

  it('still fits the readable table after loading when no explicit host camera was chosen', () => {
    const m = mountS(null, undefined, true);
    m.studio.setActive(false);
    const initial = m.studio.getCamera();
    m.studio.update({}, { kind: 'portfolio' });
    m.studio.setActive(true);
    measure(m, 1280, 720);
    dom.raf.drain();
    expect(m.studio.getCamera()).toEqual(initial);

    const snap = small();
    m.studio.update(snap, { kind: 'portfolio' });
    const fitted = m.studio.getCamera();
    expect(fitted.pitch).toBe(26);
    expect(fitted.yaw).toBe(-3);
    const bounds = buildUniverse(snap, { kind: 'portfolio' }).focusBounds;
    for (const x of [bounds.x, bounds.x + bounds.width]) for (const y of [bounds.y, bounds.y + bounds.height]) {
      const point = worldToScreen(fitted, m.studio.getViewport(), { x, y });
      expect(point.x).toBeGreaterThanOrEqual(89.98);
      expect(point.x).toBeLessThanOrEqual(1190.02);
      expect(point.y).toBeGreaterThanOrEqual(89.98);
      expect(point.y).toBeLessThanOrEqual(630.02);
    }
    m.studio.update(snap, { kind: 'portfolio' });
    m.studio.setActive(false);
    m.studio.setActive(true);
    expect(m.studio.getCamera()).toEqual(fitted);
  });

  it('list mode stops canvas controls; narrow Canvas view usable; inactive studio is disabled', () => {
    const m = mountS();
    measure(m);
    m.studio.update(small(), { kind: 'company', companyId: 'a' });
    const toggle = [...m.host.querySelectorAll('.ff-tools button')].find((b) => /view/.test(b.textContent ?? '')) as HTMLButtonElement;
    toggle.click();
    expect(m.studio.elements.listHost.hidden).toBe(false);
    expect(m.studio.elements.canvasHost.hidden).toBe(true);
    const ctl = m.host.querySelector('.ff-controls') as HTMLElement;
    const bar = m.host.querySelector('.ff-camera-bar') as HTMLElement;
    expect(m.studio.elements.canvasHost.contains(ctl)).toBe(false);
    expect(bar.hidden).toBe(true);
    expect(ctl.dataset.active).toBe('false');
    toggle.click();
    expect(m.studio.elements.canvasHost.hidden).toBe(false);
    expect(bar.hidden).toBe(false);
    expect(ctl.dataset.active).toBe('true');
    m.studio.setActive(false);
    expect(m.studio.elements.root.hidden).toBe(true);
    expect(ctl.dataset.active).toBe('false');
    m.studio.setActive(true);
    expect(ctl.dataset.active).toBe('true');
  });

  it('room shows its name and the actual department label, updating in place', () => {
    const mk = (deptId: string | null, deptName: string, deptCo = 'c1', deptOffice = 'o1'): FreeflowSnapshot => ({
      companies: [{ id: 'c1', name: 'Co', status: 'active' }],
      offices: [{ id: 'o1', companyId: 'c1', name: 'HQ', status: 'active' }],
      departments: [{ id: 'd1', companyId: deptCo, officeId: deptOffice, name: deptName, status: 'active' }, { id: 'd2', companyId: 'c1', officeId: 'o1', name: 'Design department', status: 'active' }],
      employees: [], jobs: [],
      blueprints: [{ id: 'bp', companyId: 'c1', officeId: 'o1', rooms: [{ id: 'r1', name: 'Quiet planning room', departmentId: deptId, x: 0, y: 0, width: 0.5, height: 0.5 }], desks: [], whiteboards: [] }],
    });
    const host = document.createElement('div');
    document.body.appendChild(host);
    dom.setGeometry(host, { width: 1200, height: 800, left: 0, top: 0 });
    const sr: SceneRenderer = mountScene(host, {});
    cleanups.push(() => sr.destroy());
    const focus = { kind: 'company', companyId: 'c1' } as const;
    const room = () => host.querySelector('[data-node-id="room:c1:o1:r1"]') as HTMLElement;
    const tag = () => room().querySelector('.ff-segment-tag')?.textContent;
    const title = () => room().querySelector('.ff-node-title')?.textContent;
    const label = () => room().getAttribute('aria-label') ?? '';
    sr.update(buildScene(mk('d1', 'Research department'), focus));
    expect(title()).toBe('Quiet planning room');
    expect(tag()).toBe('Research department');
    expect(label()).toContain('Quiet planning room');
    expect(label()).toContain('Research department');
    expect(label()).toContain('status saved');
    const el0 = room();
    sr.select('room:c1:o1:r1');
    sr.update(buildScene(mk(null, 'Research department'), focus));
    expect(room()).toBe(el0);
    expect(tag()).toBe('Unassigned department');
    expect(label()).toContain('Unassigned department');
    expect(label()).not.toContain('Research department');
    expect(title()).toBe('Quiet planning room');
    sr.update(buildScene(mk('d2', 'Research department'), focus));
    expect(tag()).toBe('Design department');
    expect(label()).toContain('Design department');
    sr.update(buildScene(mk('d1', 'Renamed department'), focus));
    expect(tag()).toBe('Renamed department');
    expect(label()).toContain('Renamed department');
    sr.update(buildScene(mk('d1', 'Foreign department', 'other', 'o1'), focus));
    expect(tag()).toBe('Department unavailable');
    expect(label()).toContain('Department unavailable');
    expect(label()).not.toContain('Foreign department');
    expect(room()).toBe(el0);
    expect(room().classList.contains('is-selected')).toBe(true);
    const css = String(require('node:fs').readFileSync(require('node:path').resolve(__dirname, '../src/renderer/freeflow.css'), 'utf8'));
    expect(/\.ff-node--room \.ff-node-title\s*\{[^}]*display:\s*none/.test(css)).toBe(false);
  });

  it('mounted scene honors node and thread budgets and reports full counts', () => {
    const snap = dense(300);
    const scene = buildScene(snap, { kind: 'company', companyId: 'c1' });
    expect(scene.nodes.length).toBeGreaterThan(RICH_NODE_BUDGET);
    const host = document.createElement('div');
    document.body.appendChild(host);
    dom.setGeometry(host, { width: 1200, height: 800, left: 0, top: 0 });
    let sr: SceneRenderer = mountScene(host, {});
    cleanups.push(() => sr.destroy());
    sr.setCamera({ x: 400, y: 200, zoom: 0.02, yaw: 0, pitch: 0, distance: 1800 });
    sr.update(scene);
    const nodes = host.querySelectorAll('.ff-node').length;
    expect(nodes).toBeLessThanOrEqual(RICH_NODE_BUDGET);
    expect(host.querySelectorAll('.ff-thread').length).toBeLessThanOrEqual(THREAD_BUDGET);
    const msg = (host.querySelector('.ff-budget') as HTMLElement).textContent ?? '';
    expect(msg).toContain(`of ${scene.nodes.length} nodes`);
    expect(sr.stats().capped).toBe(true);
    const keep = scene.nodes.find((n) => n.kind === 'employee')!;
    sr.select(keep.id);
    expect(host.querySelector(`[data-node-id="${keep.id}"]`)).not.toBeNull();
    sr.update(buildScene(small(), { kind: 'portfolio' }));
    expect(host.querySelector(`[data-node-id="${keep.id}"]`)).toBeNull();
  });

  it('list exposes every record beyond canvas budget and opens the right one', () => {
    const scene = buildScene(dense(300), { kind: 'company', companyId: 'c1' });
    const host = document.createElement('div');
    document.body.appendChild(host);
    const opened: string[] = [];
    const list: A11yList = mountA11yList(host, { onOpen: (n) => opened.push(n.id) });
    cleanups.push(() => list.destroy());
    list.update(scene);
    expect(list.resultCount()).toBe(scene.nodes.length);
    list.setQuery('Emp 0299');
    expect(list.resultCount()).toBe(1);
    const btn = host.querySelector('.ff-list-button') as HTMLElement;
    btn.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    // Click re-renders; follow the current DOM instead of the stale reference.
    const current = host.querySelector('[data-node-id="employee:c1:e0299"]') as HTMLElement;
    expect(current).not.toBeNull();
    expect(current.isConnected).toBe(true);
    current.focus();
    dom.key(current, 'Enter');
    expect(opened).toEqual(['employee:c1:e0299']);
  });

  it('list focus and selection survive same-scope updates, recover on removal, and instances are independent', () => {
    const sel: Array<string | null> = [];
    const mk = () => {
      const host = document.createElement('div');
      document.body.appendChild(host);
      const l = mountA11yList(host, { onSelect: (id) => sel.push(id) });
      cleanups.push(() => l.destroy());
      return { host, l };
    };
    const s1 = buildScene(dense(5), { kind: 'company', companyId: 'c1' });
    const A = mk(); const B = mk();
    A.l.update(s1); B.l.update(s1);
    B.l.setQuery('Emp 0003');
    const emp = A.host.querySelector('[data-node-id="employee:c1:e0002"]') as HTMLElement;
    emp.focus();
    emp.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    const picks = sel.length;
    A.l.update(s1);
    expect(sel.length).toBe(picks);
    expect((document.activeElement as HTMLElement | null)?.dataset.nodeId).toBe('employee:c1:e0002');
    // Another instance changes scope; A's query stays independent.
    A.l.setQuery('Emp');
    B.l.update(buildScene(small(), { kind: 'portfolio' }));
    expect((A.host.querySelector('.ff-list-search') as HTMLInputElement).value).toBe('Emp');
    // Independence: focus in A, update/setSelected on B with identical IDs -> focus stays in A.
    const C = mk();
    C.l.update(s1);
    const aRow = A.host.querySelector('[data-node-id="employee:c1:e0002"]') as HTMLElement;
    aRow.focus();
    expect(document.activeElement).toBe(aRow);
    C.l.update(s1);
    C.l.setSelected('employee:c1:e0002');
    expect(A.host.contains(document.activeElement)).toBe(true);
    expect((document.activeElement as HTMLElement).dataset.nodeId).toBe('employee:c1:e0002');
    // Unrelated input keeps focus during a background update.
    const other = document.createElement('input');
    document.body.appendChild(other);
    other.focus();
    A.l.update(s1);
    expect(document.activeElement).toBe(other);
    // Remove focused row in same scope: focus lands on a connected row inside A, no callbacks.
    A.l.setQuery('');
    const row = A.host.querySelector('[data-node-id="employee:c1:e0002"]') as HTMLElement;
    row.focus();
    expect(document.activeElement).toBe(row);
    const before = sel.length;
    A.l.update(buildScene(dense(2), { kind: 'company', companyId: 'c1' }));
    const now = document.activeElement as HTMLElement;
    expect(now).not.toBe(document.body);
    expect(now.isConnected).toBe(true);
    expect(A.host.contains(now)).toBe(true);
    expect(now.classList.contains('ff-list-button')).toBe(true);
    expect(sel.length).toBe(before);
    // No rows remain: focus goes to this list's search input.
    (A.host.querySelector('[data-node-id]') as HTMLElement).focus();
    A.l.setQuery('zzzz-no-match');
    expect(A.l.resultCount()).toBe(0);
    expect(document.activeElement).toBe(A.l.elements.search);
    expect(sel.length).toBe(before);
  });

  it('mounted capabilities: denied action is disabled, visible reason, zero callbacks; allowed fires once with exact context', () => {
    let allow = false;
    const m = mountS(null, (spec) => (spec.action === 'new-company' ? { enabled: allow, reason: allow ? undefined : 'Not permitted here.' } : { enabled: true }));
    measure(m);
    m.studio.update(small(), { kind: 'portfolio' });
    const inspToggle = [...m.host.querySelectorAll('.ff-tools button')].find((b) => b.textContent === 'Inspector') as HTMLButtonElement;
    inspToggle.click();
    const find = () => [...m.host.querySelectorAll('.ff-inspector-actions button')].find((b) => b.textContent === 'New company') as HTMLButtonElement;
    const denied = find();
    expect(denied.disabled).toBe(true);
    expect(m.host.querySelector('.ff-inspector .ff-notice')?.textContent).toContain('Not permitted here.');
    denied.click();
    expect(m.actions.length).toBe(0);
    allow = true;
    m.studio.setCapabilities((spec) => (spec.action === 'new-company' ? { enabled: allow } : { enabled: true }));
    const ok = find();
    expect(ok.disabled).toBe(false);
    ok.click();
    expect(m.actions).toEqual([{ a: 'new-company', c: {} }]);
  });

  it('selection clears when the selected record is removed or scope changes, and persists on same-scope refresh', () => {
    const m = mountS();
    measure(m);
    const full = buildScene(dense(3), { kind: 'company', companyId: 'c1' });
    void full;
    m.studio.update(dense(3), { kind: 'company', companyId: 'c1' });
    const target = 'employee:c1:e0001';
    const row = m.studio.elements.listHost.querySelector(`[data-node-id="${target}"]`) as HTMLElement;
    row.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    expect(m.host.querySelector('.ff-inspector-header')?.textContent).toBe('Emp 0001');
    m.studio.update(dense(3), { kind: 'company', companyId: 'c1' });
    expect(m.host.querySelector('.ff-inspector-header')?.textContent).toBe('Emp 0001');
    m.studio.update(dense(1), { kind: 'company', companyId: 'c1' });
    expect(m.host.querySelector('.ff-inspector-header')?.textContent).not.toBe('Emp 0001');
    m.studio.update(small(), { kind: 'portfolio' });
    expect(m.host.querySelector('.ff-inspector-header')?.textContent).not.toBe('Emp 0001');
  });
});
