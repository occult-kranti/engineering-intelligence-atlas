// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { installDom, type FreeflowDom } from './fixtures/freeflow-dom.js';
import { DEFAULT_CAMERA, normalizeCamera, screenToWorld, worldToScreen, type Camera } from '../src/renderer/freeflow/camera.js';
import { mountControls, type Controls } from '../src/renderer/freeflow/controls.js';

const SIZE = { width: 1200, height: 800 };

interface Rig {
  dom: FreeflowDom; vp: HTMLElement; host: HTMLElement; cam: Camera; sets: Camera[]; ends: number;
  mount(o?: { ownsCamera?: boolean; storage?: Pick<Storage, 'getItem' | 'setItem'> | null; focusKey?: string; bounds?: { x: number; y: number; width: number; height: number } | null; active?: boolean }): Controls;
}

let dom: FreeflowDom;
let mounted: Controls[] = [];

function rig(start: Partial<Camera> = {}): Rig {
  const host = document.createElement('div');
  const vp = document.createElement('div');
  document.body.append(host, vp);
  dom.setGeometry(vp, { width: SIZE.width, height: SIZE.height, left: 0, top: 0 });
  const r: Rig = {
    dom, vp, host, cam: normalizeCamera({ ...DEFAULT_CAMERA, ...start }), sets: [], ends: 0,
    mount(o = {}) {
      const c = mountControls(host, {
        viewport: vp,
        getViewportSize: () => ({ width: vp.clientWidth, height: vp.clientHeight }),
        getCamera: () => r.cam,
        setCamera: (cam) => { r.cam = cam; r.sets.push(cam); },
        onCameraChange: (_c, ph) => { if (ph === 'end') r.ends++; },
        getBounds: () => o.bounds ?? null,
        focusKey: o.focusKey ?? 'k',
        active: o.active,
        storage: o.storage === undefined ? null : o.storage,
        ownsCamera: o.ownsCamera,
      });
      mounted.push(c);
      return c;
    },
  };
  return r;
}

function memStore(init: Record<string, string> = {}) {
  const m = new Map(Object.entries(init));
  return { m, getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); } };
}

beforeEach(() => { dom = installDom(); });
afterEach(() => { for (const c of mounted) c.destroy(); mounted = []; dom.restore(); });

describe('freeflow controls (mounted)', () => {
  it('only moves a conference tour after an explicit click and pauses on outside interaction', () => {
    const r = rig(); const c = r.mount();
    c.setBrowseBounds({ x: -3000, y: -120, width: 6000, height: 240 });
    const tour = [...r.host.querySelectorAll('button')].find((b) => b.textContent === 'Auto-pan')!;
    expect(tour.getAttribute('aria-pressed')).toBe('false');
    expect(dom.raf.pending()).toBe(0);
    tour.click(); const x = r.cam.x;
    dom.raf.step(32); expect(r.cam.x).toBeGreaterThan(x);
    expect(tour.getAttribute('aria-pressed')).toBe('true');
    const input = document.createElement('input'); document.body.append(input);
    dom.key(input, 'a');
    const stopped = r.cam.x; dom.raf.step(32);
    expect(r.cam.x).toBe(stopped); expect(dom.raf.pending()).toBe(0);
    expect(tour.getAttribute('aria-pressed')).toBe('false');
  });

  it('stops a tour at the table edge, on view deactivation, and on reduced motion', () => {
    const r = rig(); const c = r.mount();
    c.setBrowseBounds({ x: 0, y: 0, width: 3, height: 3 });
    const tour = [...r.host.querySelectorAll('button')].find((b) => b.textContent === 'Auto-pan')!;
    tour.click(); dom.raf.step(40); dom.raf.step(40);
    expect(r.cam.x).toBe(3); expect(dom.raf.pending()).toBe(0);
    c.setBrowseBounds({ x: 0, y: 0, width: 10000, height: 200 });
    tour.click(); dom.raf.step(); c.setActive(false);
    expect(dom.raf.pending()).toBe(0); expect(tour.getAttribute('aria-pressed')).toBe('false');
    c.setActive(true); tour.click(); dom.raf.step(); dom.setReducedMotion(true); dom.raf.step();
    expect(tour.disabled).toBe(true); expect(dom.raf.pending()).toBe(0);
  });

  it('edge panning is opt-in, ignores touch and nodes, and stops on pointer leave', () => {
    const r = rig(); const c = r.mount(); c.setBrowseBounds({ x: -10000, y: -10000, width: 20000, height: 20000 });
    dom.pointer(r.vp, 'pointermove', { x: 1198, y: 400 });
    expect(dom.raf.pending()).toBe(0);
    const edge = [...r.host.querySelectorAll('button')].find((b) => b.textContent === 'Edge pan')!; edge.click();
    dom.pointer(r.vp, 'pointermove', { x: 1198, y: 400, pointerType: 'touch' }); expect(dom.raf.pending()).toBe(0);
    dom.pointer(r.vp, 'pointermove', { x: 1198, y: 400 }); dom.raf.step(32);
    expect(r.cam.x).toBeGreaterThan(0);
    dom.pointer(r.vp, 'pointerleave', { x: 1201, y: 400 }); expect(dom.raf.pending()).toBe(0);
    const node = document.createElement('div'); node.className = 'ff-node'; r.vp.append(node);
    dom.pointer(node, 'pointermove', { x: 1198, y: 400 }); expect(dom.raf.pending()).toBe(0);
    c.setBrowseBounds(null); expect(edge.hidden).toBe(true); expect(dom.raf.pending()).toBe(0);
  });

  it('keeps the grabbed world point under a tilted pointer drag', () => {
    const r = rig({ pitch: 42, distance: 1800 });
    r.mount();
    const grabbed = screenToWorld(r.cam, SIZE, { x: 600, y: 400 });
    dom.pointer(r.vp, 'pointerdown', { x: 600, y: 400 });
    dom.pointer(r.vp, 'pointermove', { x: 600, y: 500 });
    const s = worldToScreen(r.cam, SIZE, grabbed);
    expect(Math.abs(s.x - 600)).toBeLessThan(1.5);
    expect(Math.abs(s.y - 500)).toBeLessThan(1.5);
    dom.pointer(r.vp, 'pointerup', { x: 600, y: 500 });
  });

  it('rotates via the real button and pans screen-direction at nonzero yaw', () => {
    dom.setReducedMotion(true);
    const r = rig();
    const c = r.mount();
    const rotate = [...r.host.querySelectorAll('button')].find((b) => b.getAttribute('aria-label') === 'Rotate right 15 degrees')!;
    rotate.click();
    expect(r.cam.yaw).toBe(15);
    c.destroy();
    // Keyboard direction invariance across yaw.
    const outcomes: number[] = [];
    for (const yaw of [0, 90]) {
      const q = rig({ yaw });
      q.mount();
      const origin = { x: 0, y: 0 };
      dom.key(q.vp, 'ArrowRight');
      outcomes.push(worldToScreen(q.cam, SIZE, origin).x);
    }
    expect(outcomes[0]).toBeCloseTo(520, 0);
    expect(outcomes[1]).toBeCloseTo(520, 0);
  });

  it('preserves the midpoint anchor during pinch and does not jump after lifting a touch', () => {
    const r = rig({ yaw: 20, pitch: 30 });
    r.mount();
    dom.pointer(r.vp, 'pointerdown', { id: 1, x: 500, y: 350, pointerType: 'touch' });
    dom.pointer(r.vp, 'pointerdown', { id: 2, x: 700, y: 450, pointerType: 'touch' });
    const anchor = screenToWorld(r.cam, SIZE, { x: 600, y: 400 });
    dom.pointer(r.vp, 'pointermove', { id: 2, x: 760, y: 470, pointerType: 'touch' });
    dom.pointer(r.vp, 'pointermove', { id: 1, x: 480, y: 330, pointerType: 'touch' });
    const mid = { x: (760 + 480) / 2, y: (470 + 330) / 2 };
    const s = worldToScreen(r.cam, SIZE, anchor);
    expect(Math.hypot(s.x - mid.x, s.y - mid.y)).toBeLessThan(3);
    expect(r.cam.zoom).toBeGreaterThan(0.02);
    dom.pointer(r.vp, 'pointerup', { id: 1, x: 480, y: 330, pointerType: 'touch' });
    const before = r.cam;
    dom.pointer(r.vp, 'pointermove', { id: 2, x: 760, y: 470, pointerType: 'touch' });
    expect(Math.abs(r.cam.x - before.x)).toBeLessThan(1e-6);
    expect(Math.abs(r.cam.y - before.y)).toBeLessThan(1e-6);
  });

  it('wheel retains the world anchor, commits after debounce, and ignores wheel when disabled; typing fields ignore arrows', () => {
    const r = rig({ x: 40, y: -20 });
    const c = r.mount();
    const p = { x: 900, y: 250 };
    const w = screenToWorld(r.cam, SIZE, p);
    dom.wheel(r.vp, { x: p.x, y: p.y, deltaY: -120 });
    const s = worldToScreen(r.cam, SIZE, w);
    expect(Math.hypot(s.x - p.x, s.y - p.y)).toBeLessThan(0.75);
    expect(r.ends).toBe(0);
    dom.timers.advance(200);
    expect(r.ends).toBe(1);
    c.setActive(false);
    const frozen = r.cam;
    dom.wheel(r.vp, { x: 300, y: 300, deltaY: -240 });
    expect(r.cam).toEqual(frozen);
    c.setActive(true);
    const input = document.createElement('input');
    r.vp.appendChild(input);
    const before = r.cam;
    dom.key(input, 'ArrowLeft');
    expect(r.cam).toEqual(before);
  });

  it('standalone restore: saved camera wins and survives same-key and later bounds', () => {
    const saved = { x: 555, y: -33, zoom: 2, yaw: 0, pitch: 0, distance: 1800 };
    const store = memStore({ 'daftar.freeflow.camera.v1:k': JSON.stringify(saved) });
    const r = rig();
    const c = r.mount({ ownsCamera: true, storage: store, focusKey: 'k' });
    expect(r.cam.x).toBe(555);
    expect(r.cam.zoom).toBe(2);
    c.setFocusKey('k');
    c.setBounds({ x: 0, y: 0, width: 1000, height: 600 });
    expect(r.cam.x).toBe(555);
    expect(r.cam.zoom).toBe(2);
  });

  it('late geometry fits once; ownsCamera false never auto-fits', () => {
    const store = memStore();
    const r = rig();
    dom.hide(r.vp);
    const c = r.mount({ ownsCamera: true, storage: store });
    expect(r.sets.length).toBe(0);
    expect(store.m.size).toBe(0);
    dom.setGeometry(r.vp, { width: SIZE.width, height: SIZE.height });
    c.setBounds({ x: 0, y: 0, width: 2400, height: 1500 });
    expect(r.sets.length).toBe(1);
    const fitted = r.cam;
    c.setBounds({ x: 0, y: 0, width: 9000, height: 9000 });
    expect(r.cam).toEqual(fitted);
    expect(r.sets.length).toBe(1);

    const o = rig();
    const oc = o.mount({ ownsCamera: false, storage: memStore() });
    oc.setBounds({ x: 0, y: 0, width: 500, height: 500 });
    oc.setFocusKey('other');
    expect(o.sets.length).toBe(0);
  });

  it('releases capture/timers/RAF on disable, destroy and focus change; restores touchAction', () => {
    for (const how of ['disable', 'destroy', 'focus'] as const) {
      const r = rig();
      r.vp.style.touchAction = 'pan-y';
      const c = r.mount({ ownsCamera: true, storage: memStore(), bounds: null });
      expect(r.vp.style.touchAction).toBe('none');
      dom.pointer(r.vp, 'pointerdown', { x: 600, y: 400 });
      dom.wheel(r.vp, { x: 600, y: 400, deltaY: -50 });
      expect(dom.capture.set.size).toBeGreaterThan(0);
      expect(r.vp.classList.contains('is-panning') || dom.timers.pending() > 0).toBe(true);
      if (how === 'disable') c.setActive(false);
      else if (how === 'destroy') c.destroy();
      else c.setFocusKey('other');
      expect(dom.capture.set.size).toBe(0);
      expect(dom.timers.pending()).toBe(0);
      expect(dom.raf.pending()).toBe(0);
      expect(r.vp.classList.contains('is-panning')).toBe(false);
      const after = r.sets.length;
      dom.timers.advance(500); dom.raf.drain();
      expect(r.sets.length).toBe(after);
      if (how === 'disable') {
        expect(r.vp.style.touchAction).toBe('pan-y');
        c.setActive(true);
        expect(r.vp.style.touchAction).toBe('none');
        c.destroy();
        expect(r.vp.style.touchAction).toBe('pan-y');
      }
      if (how === 'destroy') expect(r.vp.style.touchAction).toBe('pan-y');
    }
  });

  it('pointercancel and lost capture do not start inertia; hidden document cancels without duplicate commits', () => {
    const r = rig();
    r.mount();
    dom.pointer(r.vp, 'pointerdown', { x: 600, y: 400 });
    dom.pointer(r.vp, 'pointermove', { x: 640, y: 420 });
    dom.pointer(r.vp, 'pointercancel', { x: 640, y: 420 });
    expect(dom.raf.pending()).toBe(0);
    dom.pointer(r.vp, 'pointerdown', { x: 600, y: 400 });
    dom.pointer(r.vp, 'pointermove', { x: 650, y: 430 });
    dom.pointer(r.vp, 'lostpointercapture', { x: 650, y: 430 });
    expect(dom.raf.pending()).toBe(0);
    dom.pointer(r.vp, 'pointerdown', { x: 600, y: 400 });
    dom.pointer(r.vp, 'pointermove', { x: 660, y: 440 });
    const ends = r.ends;
    dom.setHidden(true);
    expect(r.ends).toBe(ends + 1);
    dom.setHidden(true);
    expect(r.ends).toBe(ends + 1);
    expect(dom.capture.set.size).toBe(0);
  });
});
