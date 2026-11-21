// Freeflow camera controls. Presentation-only: never touches rooms, staff, permissions or jobs.
// No office/provider commands. Nothing executes on import. No idle RAF.
//
// API for the studio orchestrator:
//   const c = mountControls(host, {
//     viewport, getViewportSize(), getCamera(), setCamera(cam), onCameraChange?(cam, phase),
//     getBounds?(), focusKey?, active?, storage?, ownsCamera?  // default true
//   });
//   c.setBounds(rect); c.setFocusKey(key); c.setActive(bool); c.fit(); c.sync(); c.destroy();
// When ownsCamera is false the host studio owns restore/fit; controls only translate gestures.

import {
  type Camera, type Rect, type Size, type Point, DEFAULT_CAMERA,
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
  ownsCamera?: boolean;
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
  sync(): void;
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

function realSize(s: Size): boolean {
  return !!s && Number.isFinite(s.width) && Number.isFinite(s.height) && s.width > 1 && s.height > 1;
}

/** Camera that keeps world point `anchor` under screen point `to` (translation only). */
function anchorTo(cam: Camera, vpSize: Size, anchor: Point, to: Point): Camera {
  const cur = screenToWorld(cam, vpSize, to);
  return normalizeCamera({ ...cam, x: cam.x + (anchor.x - cur.x), y: cam.y + (anchor.y - cur.y) });
}

export function mountControls(host: HTMLElement, o: ControlsOptions): Controls {
  const vp = o.viewport;
  const storage = o.storage === undefined ? defaultStorage() : o.storage;
  const owns = o.ownsCamera !== false;
  let focusKey = o.focusKey ?? 'default';
  let active = o.active !== false;
  let bounds: Rect | null = o.getBounds?.() ?? null;
  let destroyed = false;
  let raf = 0;
  let anim: { from: Camera; to: Camera; t0: number } | null = null;
  let inertia: { vx: number; vy: number; last: number; anchor: Point; pt: Point } | null = null;
  let wheelTimer = 0;
  const pointers = new Map<number, Point>();
  const captured = new Set<number>();
  let panAnchor: Point | null = null;
  let panVel = { x: 0, y: 0, t: 0, px: 0, py: 0 };
  let pinch: { dist: number; anchor: Point } | null = null;
  let dirty = false;
  let restored = false; // owned restore/fit satisfied for current focus
  const priorTouch = vp.style.touchAction;
  const reduce = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  const root = document.createElement('div');
  root.className = 'ff-controls';
  root.setAttribute('role', 'toolbar');
  root.setAttribute('aria-label', 'Camera controls');
  const angle = document.createElement('span');
  angle.className = 'ff-controls-angle';
  angle.setAttribute('role', 'status');
  angle.setAttribute('aria-live', 'polite');
  const btns: HTMLButtonElement[] = [];
  function btn(label: string, title: string, fn: () => void): HTMLButtonElement {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'ff-ctl'; b.textContent = label; b.title = title; b.setAttribute('aria-label', title);
    b.addEventListener('click', fn);
    btns.push(b); root.appendChild(b); return b;
  }
  const readAngle = () => { const c = o.getCamera(); angle.textContent = `Rotation ${Math.round(c.yaw)}° · Tilt ${Math.round(c.pitch)}° · Zoom ${Math.round(c.zoom * 100)}%`; };

  function emit(cam: Camera, phase: 'frame' | 'end'): void {
    o.setCamera(cam);
    if (phase === 'end') { readAngle(); dirty = false; if (owns || realSize(o.getViewportSize())) saveCameraPref(focusKey, cam, storage); }
    else dirty = true;
    o.onCameraChange?.(cam, phase);
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
      inertia.pt = { x: inertia.pt.x + inertia.vx * dt, y: inertia.pt.y + inertia.vy * dt };
      emit(anchorTo(o.getCamera(), o.getViewportSize(), inertia.anchor, inertia.pt), 'frame');
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
    wheelTimer = window.setTimeout(() => { wheelTimer = 0; commit(); }, 180);
  }
  function pinchDist(): number { const [a, b] = [...pointers.values()]; return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0; }
  function pinchMid(): Point { const [a, b] = [...pointers.values()]; return { x: ((a?.x ?? 0) + (b?.x ?? 0)) / 2, y: ((a?.y ?? 0) + (b?.y ?? 0)) / 2 }; }
  function onDown(e: PointerEvent): void {
    if (!active || destroyed || !onBackground(e) || (e.pointerType === 'mouse' && e.button !== 0)) return;
    stopMotion(); clearTimeout(wheelTimer); wheelTimer = 0;
    pointers.set(e.pointerId, rectPt(e));
    try { vp.setPointerCapture(e.pointerId); captured.add(e.pointerId); } catch { /* not capturable */ }
    const size = o.getViewportSize();
    if (pointers.size === 2) {
      pinch = { dist: pinchDist(), anchor: screenToWorld(o.getCamera(), size, pinchMid()) };
      panAnchor = null;
    } else {
      const p = rectPt(e);
      panAnchor = screenToWorld(o.getCamera(), size, p);
      panVel = { x: 0, y: 0, t: performance.now(), px: p.x, py: p.y };
      vp.classList.add('is-panning');
    }
  }
  function onMove(e: PointerEvent): void {
    if (!pointers.has(e.pointerId) || !active || destroyed) return;
    const p = rectPt(e);
    pointers.set(e.pointerId, p);
    const size = o.getViewportSize();
    if (pointers.size >= 2 && pinch) {
      const d = pinchDist();
      const mid = pinchMid();
      let cam = o.getCamera();
      if (d > 0 && pinch.dist > 0) cam = zoomAt(cam, size, mid, clampN(d / pinch.dist, 0.8, 1.25));
      cam = anchorTo(cam, size, pinch.anchor, mid);
      pinch.dist = d;
      emit(cam, 'frame');
    } else if (panAnchor) {
      const now = performance.now(), dt = Math.max(1, now - panVel.t);
      emit(anchorTo(o.getCamera(), size, panAnchor, p), 'frame');
      panVel = { x: clampN((p.x - panVel.px) / dt, -2, 2), y: clampN((p.y - panVel.py) / dt, -2, 2), t: now, px: p.x, py: p.y };
    }
  }
  function releaseCapture(id: number): void {
    if (captured.delete(id)) { try { vp.releasePointerCapture(id); } catch { /* already released */ } }
  }
  function release(e: PointerEvent | null, fling: boolean): void {
    if (e) { pointers.delete(e.pointerId); releaseCapture(e.pointerId); }
    if (pointers.size < 2) pinch = null;
    if (pointers.size === 0) {
      vp.classList.remove('is-panning');
      const recent = performance.now() - panVel.t < 80;
      const cur = panVel.px !== undefined ? { x: panVel.px, y: panVel.py } : null;
      if (fling && panAnchor && cur && recent && !reduce() && Math.hypot(panVel.x, panVel.y) > 0.15 && active && !destroyed) {
        inertia = { vx: panVel.x, vy: panVel.y, last: performance.now(), anchor: panAnchor, pt: cur };
        raf = requestAnimationFrame(tick);
      } else commit();
      panAnchor = null;
    } else if (pointers.size === 1) {
      const rem = [...pointers.values()][0];
      if (rem) { panAnchor = screenToWorld(o.getCamera(), o.getViewportSize(), rem); panVel = { x: 0, y: 0, t: performance.now(), px: rem.x, py: rem.y }; }
    }
  }
  const onUp = (e: PointerEvent) => release(e, e.type === 'pointerup');
  const onLost = (e: PointerEvent) => { captured.delete(e.pointerId); if (pointers.has(e.pointerId)) release(e, false); };
  function cancelAll(): void {
    for (const id of [...captured]) releaseCapture(id);
    pointers.clear(); pinch = null; panAnchor = null;
    clearTimeout(wheelTimer); wheelTimer = 0;
    vp.classList.remove('is-panning'); stopMotion(); commit();
  }
  const onVis = () => { if (document.hidden) cancelAll(); };
  const onBlur = () => cancelAll();

  function onKey(e: KeyboardEvent): void {
    if (!active || destroyed || e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || isTyping(e.target)) return;
    if (!vp.contains(e.target as Node) && e.target !== vp) return;
    if ((e.target as HTMLElement).closest?.('.ff-node') && ['Enter', ' '].includes(e.key)) return;
    const c = o.getCamera();
    const size = o.getViewportSize();
    // Screen-space step: content follows the arrow direction consistently under any yaw/pitch.
    const pan = (dx: number, dy: number) => {
      const center = { x: size.width / 2, y: size.height / 2 };
      const anchor = screenToWorld(c, size, { x: center.x + dx, y: center.y + dy });
      go(anchorTo(c, size, anchor, center));
    };
    let handled = true;
    switch (e.key) {
      case 'ArrowLeft': pan(-PAN_STEP, 0); break;
      case 'ArrowRight': pan(PAN_STEP, 0); break;
      case 'ArrowUp': pan(0, -PAN_STEP); break;
      case 'ArrowDown': pan(0, PAN_STEP); break;
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

  function applyActive(): void {
    for (const b of btns) b.disabled = !active;
    root.dataset.active = String(active);
    if (active) vp.style.touchAction = 'none';
    else { cancelAll(); vp.style.touchAction = priorTouch; }
  }
  applyActive();

  // Owned restore: saved camera wins; otherwise fit once with a real viewport and bounds.
  function tryOwnedInit(force: boolean): void {
    if (!owns || destroyed || (restored && !force)) return;
    const p = loadCameraPref(focusKey, storage);
    if (p) { restored = true; emit(p, 'end'); return; }
    const b = curBounds();
    const size = o.getViewportSize();
    if (!b || !realSize(size)) return; // wait; never persist a fallback zero-size fit
    restored = true;
    emit(fitBounds(o.getCamera(), size, b, 48), 'end');
  }
  tryOwnedInit(false);

  return {
    elements: { root, angle },
    setBounds(b) { bounds = b; if (owns && !restored) tryOwnedInit(false); },
    setFocusKey(k) {
      if (k === focusKey) return;
      cancelAll();
      focusKey = k; restored = false;
      tryOwnedInit(true);
    },
    setActive(a) { if (a === active) return; active = a; applyActive(); },
    fit, reset, topView, perspective, rotate,
    sync() { if (!destroyed) readAngle(); },
    destroy() {
      if (destroyed) return;
      cancelAll();
      destroyed = true;
      vp.removeEventListener('wheel', onWheel);
      vp.removeEventListener('pointerdown', onDown);
      vp.removeEventListener('pointermove', onMove);
      vp.removeEventListener('pointerup', onUp);
      vp.removeEventListener('pointercancel', onUp);
      vp.removeEventListener('lostpointercapture', onLost);
      vp.removeEventListener('keydown', onKey);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('blur', onBlur);
      vp.style.touchAction = priorTouch;
      root.remove();
    },
  };
}
