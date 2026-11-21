// Freeflow camera controls. Presentation-only: never touches rooms, staff, permissions or jobs.
// No office/provider commands. Nothing executes on import. No idle RAF.
//
// API for the studio orchestrator:
//   const c = mountControls(host, {
//     viewport,                 // HTMLElement receiving pointer/wheel/touch (the canvas host)
//     getViewportSize(),        // Size of the canvas
//     getCamera(), setCamera(cam), onCameraChange?(cam, phase)  // phase: 'frame'|'end'
//     getBounds?()              // scene bounds Rect for Fit/Reset
//     focusKey?: string, active?: boolean, storage?: Storage|null,
//   });
//   c.setBounds(rect); c.setFocusKey(key); c.setActive(bool); c.fit(); c.destroy();

import {
  type Camera, type Rect, type Size, type Point, DEFAULT_CAMERA, MAX_PITCH,
  easeSpring, fitBounds, interpolateCamera, normalizeCamera, wrapDegrees, zoomAt, screenToWorld,
} from './camera.js';

export interface ControlsOptions {
  viewport: HTMLElement;
  getViewportSize(): Size;
  getCamera(): Camera;
  setCamera(camera: Camera): void;
  onCameraChange?(camera: Camera, phase: 'frame' | 'end'): void;
  getBounds?(): Rect | null;
  focusKey?: string;
  active?: boolean;
  storage?: Pick<Storage, 'getItem' | 'setItem'> | null;
}

export interface Controls {
  setBounds(bounds: Rect | null): void;
  setFocusKey(key: string): void;
  setActive(active: boolean): void;
  fit(): void;
  reset(): void;
  topView(): void;
  perspective(): void;
  rotate(deltaDeg: number): void;
  destroy(): void;
  elements: { root: HTMLElement; angle: HTMLElement };
}

const PREFIX = 'daftar.freeflow.camera.v1:';
const DUR = 360;
const MAX_WHEEL_FACTOR = 1.35;
const PERSPECTIVE_PITCH = 42;
const PAN_STEP = 80;

function clampN(v: number, lo: number, hi: number): number { return v < lo ? lo : v > hi ? hi : v; }

export function normalizeWheelDelta(e: { deltaY: number; deltaMode: number }, pageHeight = 800): number {
  const m = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? pageHeight : 1;
  const d = Number.isFinite(e.deltaY) ? e.deltaY * m : 0;
  return clampN(d, -240, 240);
}

function isTyping(t: EventTarget | null): boolean {
  const e = t as HTMLElement | null;
  if (!e || !e.tagName) return false;
  const tag = e.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.isContentEditable === true || !!e.closest?.('[contenteditable="true"],.donna-dock,.ff-list-search');
}

function validPref(v: unknown): Camera | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  for (const k of ['x', 'y', 'zoom', 'yaw', 'pitch', 'distance']) if (typeof o[k] !== 'number' || !Number.isFinite(o[k] as number)) return null;
  return normalizeCamera(o as Partial<Camera>);
}

export function loadCameraPref(key: string, storage: Pick<Storage, 'getItem'> | null | undefined): Camera | null {
  try { const raw = storage?.getItem(PREFIX + key); return raw ? validPref(JSON.parse(raw)) : null; } catch { return null; }
}
export function saveCameraPref(key: string, cam: Camera, storage: Pick<Storage, 'setItem'> | null | undefined): void {
  try { storage?.setItem(PREFIX + key, JSON.stringify(normalizeCamera(cam))); } catch { /* denied or full: presentation-only */ }
}

function defaultStorage(): Pick<Storage, 'getItem' | 'setItem'> | null {
  try { return typeof localStorage !== 'undefined' ? localStorage : null; } catch { return null; }
}

export function mountControls(host: HTMLElement, o: ControlsOptions): Controls {
  const vp = o.viewport;
  const storage = o.storage === undefined ? defaultStorage() : o.storage;
  let focusKey = o.focusKey ?? 'default';
  let active = o.active !== false;
  let bounds: Rect | null = o.getBounds?.() ?? null;
  let destroyed = false;
  let raf = 0;
  let anim: { from: Camera; to: Camera; t0: number } | null = null;
  let inertia: { vx: number; vy: number; last: number } | null = null;
  let wheelTimer = 0;
  const pointers = new Map<number, Point>();
  let panLast: Point | null = null;
  let panVel = { x: 0, y: 0, t: 0 };
  let pinch: { dist: number } | null = null;
  let dirty = false;
  const reduce = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  const root = document.createElement('div');
  root.className = 'ff-controls';
  root.setAttribute('role', 'toolbar');
  root.setAttribute('aria-label', 'Camera controls');
  const angle = document.createElement('span');
  angle.className = 'ff-controls-angle';
  angle.setAttribute('role', 'status');
  const btns: HTMLButtonElement[] = [];
  function btn(label: string, title: string, fn: () => void): HTMLButtonElement {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'ff-ctl'; b.textContent = label; b.title = title; b.setAttribute('aria-label', title);
    b.addEventListener('click', fn);
    btns.push(b); root.appendChild(b); return b;
  }
  const readAngle = () => { const c = o.getCamera(); angle.textContent = `Rotation ${Math.round(c.yaw)}° · Tilt ${Math.round(c.pitch)}° · Zoom ${Math.round(c.zoom * 100)}%`; };

  function emit(cam: Camera, phase: 'frame' | 'end'): void {
    o.setCamera(cam); readAngle(); o.onCameraChange?.(cam, phase);
    if (phase === 'end') { dirty = false; saveCameraPref(focusKey, cam, storage); } else dirty = true;
  }
  function stopMotion(): void {
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    anim = null; inertia = null;
  }
  function commit(): void { if (dirty) emit(o.getCamera(), 'end'); }
  function tick(now: number): void {
    raf = 0;
    if (destroyed || !active || document.hidden) { stopMotion(); commit(); return; }
    if (anim) {
      const t = clampN((now - anim.t0) / DUR, 0, 1);
      emit(interpolateCamera(anim.from, anim.to, easeSpring(t)), t >= 1 ? 'end' : 'frame');
      if (t >= 1) anim = null;
    } else if (inertia) {
      const dt = Math.min(32, now - inertia.last); inertia.last = now;
      const c = o.getCamera();
      const a = (c.yaw * Math.PI) / 180;
      const dx = (inertia.vx * dt) / c.zoom, dy = (inertia.vy * dt) / c.zoom;
      emit(normalizeCamera({ ...c, x: c.x - (dx * Math.cos(a) + dy * Math.sin(a)), y: c.y - (-dx * Math.sin(a) + dy * Math.cos(a)) }), 'frame');
      inertia.vx *= 0.9; inertia.vy *= 0.9;
      if (Math.hypot(inertia.vx, inertia.vy) < 0.02) { inertia = null; commit(); }
    }
    if ((anim || inertia) && !raf) raf = requestAnimationFrame(tick);
  }
  function go(to: Camera): void {
    if (!active || destroyed) return;
    const target = normalizeCamera(to);
    stopMotion();
    if (reduce() || document.hidden) { emit(target, 'end'); return; }
    anim = { from: o.getCamera(), to: target, t0: performance.now() };
    raf = requestAnimationFrame(tick);
  }
  const curBounds = () => bounds ?? o.getBounds?.() ?? null;
  function fit(): void { const b = curBounds(); if (b) go(fitBounds(o.getCamera(), o.getViewportSize(), b, 48)); }
  function reset(): void { const b = curBounds(); go(b ? fitBounds({ ...DEFAULT_CAMERA }, o.getViewportSize(), b, 48) : { ...DEFAULT_CAMERA }); }
  function topView(): void { go({ ...o.getCamera(), pitch: 0, yaw: 0 }); }
  function perspective(): void { go({ ...o.getCamera(), pitch: PERSPECTIVE_PITCH }); }
  function rotate(d: number): void { const c = o.getCamera(); go({ ...c, yaw: wrapDegrees(c.yaw + d) }); }

  btn('Fit', 'Fit scene to view', fit);
  btn('Reset', 'Reset camera', reset);
  btn('Top', 'Top view', topView);
  btn('3D', 'Perspective view', perspective);
  btn('⟲', 'Rotate left 15 degrees', () => rotate(-15));
  btn('⟳', 'Rotate right 15 degrees', () => rotate(15));
  btn('−', 'Zoom out', () => zoomStep(1 / 1.25));
  btn('+', 'Zoom in', () => zoomStep(1.25));
  root.appendChild(angle);
  host.appendChild(root);
  readAngle();

  function zoomStep(f: number): void {
    const s = o.getViewportSize();
    go(zoomAt(o.getCamera(), s, { x: s.width / 2, y: s.height / 2 }, f));
  }

  const rectPt = (e: { clientX: number; clientY: number }): Point => { const r = vp.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  const onBackground = (e: Event) => !(e.target as HTMLElement | null)?.closest?.('.ff-node,.ff-controls,button,input,textarea,select,a');

  function onWheel(e: WheelEvent): void {
    if (!active || destroyed) return;
    e.preventDefault();
    stopMotion();
    const d = normalizeWheelDelta(e, vp.clientHeight);
    const base = e.ctrlKey ? 0.01 : 0.0022;
    const f = clampN(Math.exp(-d * base), 1 / MAX_WHEEL_FACTOR, MAX_WHEEL_FACTOR);
    emit(zoomAt(o.getCamera(), o.getViewportSize(), rectPt(e), f), 'frame');
    clearTimeout(wheelTimer);
    wheelTimer = window.setTimeout(commit, 180);
  }
  function pinchDist(): number { const [a, b] = [...pointers.values()]; return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0; }
  function onDown(e: PointerEvent): void {
    if (!active || destroyed || !onBackground(e) || (e.pointerType === 'mouse' && e.button !== 0)) return;
    stopMotion();
    pointers.set(e.pointerId, rectPt(e));
    try { vp.setPointerCapture(e.pointerId); } catch { /* not capturable */ }
    if (pointers.size === 2) { pinch = { dist: pinchDist() }; panLast = null; }
    else { panLast = rectPt(e); panVel = { x: 0, y: 0, t: performance.now() }; vp.classList.add('is-panning'); }
  }
  function onMove(e: PointerEvent): void {
    if (!pointers.has(e.pointerId)) return;
    const p = rectPt(e);
    pointers.set(e.pointerId, p);
    if (pointers.size >= 2 && pinch) {
      const d = pinchDist();
      if (d > 0 && pinch.dist > 0) {
        const [a, b] = [...pointers.values()];
        const mid = { x: ((a?.x ?? 0) + (b?.x ?? 0)) / 2, y: ((a?.y ?? 0) + (b?.y ?? 0)) / 2 };
        emit(zoomAt(o.getCamera(), o.getViewportSize(), mid, clampN(d / pinch.dist, 0.8, 1.25)), 'frame');
      }
      pinch.dist = d;
    } else if (panLast) {
      const now = performance.now(), dt = Math.max(1, now - panVel.t);
      const c = o.getCamera();
      const a = (c.yaw * Math.PI) / 180;
      const dx = (p.x - panLast.x) / c.zoom, dy = (p.y - panLast.y) / c.zoom;
      emit(normalizeCamera({ ...c, x: c.x - (dx * Math.cos(a) + dy * Math.sin(a)), y: c.y - (-dx * Math.sin(a) + dy * Math.cos(a)) }), 'frame');
      panVel = { x: clampN((p.x - panLast.x) / dt, -2, 2), y: clampN((p.y - panLast.y) / dt, -2, 2), t: now };
      panLast = p;
    }
  }
  function release(e: PointerEvent | null, fling: boolean): void {
    if (e) pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = null;
    if (pointers.size === 0) {
      vp.classList.remove('is-panning');
      const recent = performance.now() - panVel.t < 80;
      if (fling && panLast && recent && !reduce() && Math.hypot(panVel.x, panVel.y) > 0.15 && active) {
        inertia = { vx: panVel.x, vy: panVel.y, last: performance.now() };
        raf = requestAnimationFrame(tick);
      } else commit();
      panLast = null;
    } else if (pointers.size === 1) panLast = [...pointers.values()][0] ?? null;
  }
  const onUp = (e: PointerEvent) => release(e, e.type === 'pointerup');
  const onLost = (e: PointerEvent) => { if (pointers.has(e.pointerId)) release(e, false); };
  function cancelAll(): void { pointers.clear(); pinch = null; panLast = null; vp.classList.remove('is-panning'); stopMotion(); commit(); }
  const onVis = () => { if (document.hidden) cancelAll(); };
  const onBlur = () => cancelAll();

  function onKey(e: KeyboardEvent): void {
    if (!active || destroyed || e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || isTyping(e.target)) return;
    if (!vp.contains(e.target as Node) && e.target !== vp) return;
    if ((e.target as HTMLElement).closest?.('.ff-node') && ['Enter', ' '].includes(e.key)) return;
    const c = o.getCamera();
    const a = (c.yaw * Math.PI) / 180, st = PAN_STEP / c.zoom;
    const pan = (dx: number, dy: number) => go({ ...c, x: c.x + dx * Math.cos(a) - dy * Math.sin(a), y: c.y + dx * Math.sin(a) + dy * Math.cos(a) });
    let handled = true;
    switch (e.key) {
      case 'ArrowLeft': pan(-st, 0); break;
      case 'ArrowRight': pan(st, 0); break;
      case 'ArrowUp': pan(0, -st); break;
      case 'ArrowDown': pan(0, st); break;
      case '+': case '=': zoomStep(1.25); break;
      case '-': case '_': zoomStep(1 / 1.25); break;
      case 'f': case 'F': fit(); break;
      case '0': reset(); break;
      case 'Escape': cancelAll(); break;
      default: handled = false;
    }
    if (handled) e.preventDefault();
  }

  vp.addEventListener('wheel', onWheel, { passive: false });
  vp.addEventListener('pointerdown', onDown);
  vp.addEventListener('pointermove', onMove);
  vp.addEventListener('pointerup', onUp);
  vp.addEventListener('pointercancel', onUp);
  vp.addEventListener('lostpointercapture', onLost);
  vp.addEventListener('keydown', onKey);
  document.addEventListener('visibilitychange', onVis);
  window.addEventListener('blur', onBlur);
  vp.style.touchAction = 'none';

  function applyActive(): void { for (const b of btns) b.disabled = !active; root.dataset.active = String(active); if (!active) cancelAll(); }
  applyActive();
  void (screenToWorld);

  function restore(): void {
    const p = loadCameraPref(focusKey, storage);
    if (p) emit(p, 'end');
    else { const b = curBounds(); if (b) emit(fitBounds(o.getCamera(), o.getViewportSize(), b, 48), 'end'); }
  }

  return {
    elements: { root, angle },
    setBounds(b) { bounds = b; },
    setFocusKey(k) { if (k === focusKey) return; commit(); stopMotion(); focusKey = k; restore(); },
    setActive(a) { if (a === active) return; active = a; applyActive(); },
    fit, reset, topView, perspective, rotate,
    destroy() {
      if (destroyed) return;
      destroyed = true; stopMotion(); clearTimeout(wheelTimer); commit();
      vp.removeEventListener('wheel', onWheel);
      vp.removeEventListener('pointerdown', onDown);
      vp.removeEventListener('pointermove', onMove);
      vp.removeEventListener('pointerup', onUp);
      vp.removeEventListener('pointercancel', onUp);
      vp.removeEventListener('lostpointercapture', onLost);
      vp.removeEventListener('keydown', onKey);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('blur', onBlur);
      void MAX_PITCH;
      root.remove();
    },
  };
}
