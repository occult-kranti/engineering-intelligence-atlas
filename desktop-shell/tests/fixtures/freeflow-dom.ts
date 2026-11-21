// Deterministic JSDOM fixture for Freeflow mounted-interaction tests.
// Installs globals from one JSDOM window, supports measured geometry, controllable
// ResizeObserver, matchMedia, fake RAF/timeouts, and tracked pointer capture.
import { JSDOM } from 'jsdom';

export interface Geometry { width: number; height: number; left: number; top: number }

export interface FreeflowDom {
  window: Window & typeof globalThis;
  document: Document;
  geometry: Map<Element, Geometry>;
  setGeometry(el: Element, g: Partial<Geometry>): void;
  hide(el: Element): void;
  fireResize(): void;
  setReducedMotion(v: boolean): void;
  setNarrow(v: boolean): void;
  setHidden(v: boolean): void;
  raf: { pending(): number; step(ms?: number): void; drain(max?: number): void };
  timers: { pending(): number; advance(ms: number): void };
  capture: { set: Set<number>; sets: number; releases: number };
  pointer(el: Element, type: string, init: { id?: number; x: number; y: number; pointerType?: string; button?: number }): void;
  wheel(el: Element, init: { x: number; y: number; deltaY: number; ctrlKey?: boolean }): void;
  key(el: Element, key: string, init?: KeyboardEventInit): KeyboardEvent;
  advanceTime(ms: number): void;
  restore(): void;
}

const GLOBAL_KEYS = [
  'window', 'document', 'navigator', 'HTMLElement', 'Element', 'Node', 'SVGElement', 'MouseEvent', 'KeyboardEvent', 'Event',
  'requestAnimationFrame', 'cancelAnimationFrame', 'setTimeout', 'clearTimeout', 'matchMedia', 'ResizeObserver', 'performance', 'CSS', 'localStorage',
] as const;

export function installDom(): FreeflowDom {
  const jsdom = new JSDOM('<!doctype html><html><body></body></html>', { pretendToBeVisual: false, url: 'http://localhost/' });
  const win = jsdom.window as unknown as Window & typeof globalThis;
  const g = globalThis as unknown as Record<string, unknown>;
  const saved = new Map<string, PropertyDescriptor | undefined>();
  for (const k of GLOBAL_KEYS) saved.set(k, Object.getOwnPropertyDescriptor(globalThis, k));

  let now = 0;
  let reduced = false;
  let narrow = false;
  let hiddenDoc = false;
  const geometry = new Map<Element, Geometry>();
  const rafQ = new Map<number, (t: number) => void>();
  let rafId = 0;
  const timerQ = new Map<number, { at: number; fn: () => void }>();
  let timerId = 0;
  const observers = new Set<() => void>();
  const mqListeners = new Set<{ q: string; l: () => void }>();
  const capture = { set: new Set<number>(), sets: 0, releases: 0 };

  const defineG = (k: string, v: unknown) => Object.defineProperty(globalThis, k, { value: v, configurable: true, writable: true });
  defineG('window', win);
  defineG('document', win.document);
  defineG('navigator', win.navigator);
  for (const k of ['HTMLElement', 'Element', 'Node', 'SVGElement', 'MouseEvent', 'KeyboardEvent', 'Event']) defineG(k, (win as unknown as Record<string, unknown>)[k]);
  defineG('performance', { now: () => now });
  defineG('CSS', { escape: (s: string) => s.replace(/([^\w-])/g, '\\$1') });
  defineG('localStorage', win.localStorage);

  const raf = (cb: (t: number) => void) => { const id = ++rafId; rafQ.set(id, cb); return id; };
  const caf = (id: number) => { rafQ.delete(id); };
  defineG('requestAnimationFrame', raf);
  defineG('cancelAnimationFrame', caf);
  (win as unknown as Record<string, unknown>)['requestAnimationFrame'] = raf;
  (win as unknown as Record<string, unknown>)['cancelAnimationFrame'] = caf;
  const st = (fn: () => void, ms = 0) => { const id = ++timerId; timerQ.set(id, { at: now + ms, fn }); return id; };
  const ct = (id: number) => { timerQ.delete(id); };
  defineG('setTimeout', st);
  defineG('clearTimeout', ct);
  (win as unknown as Record<string, unknown>)['setTimeout'] = st;
  (win as unknown as Record<string, unknown>)['clearTimeout'] = ct;

  const mm = (q: string) => ({
    get matches() { return q.includes('reduce') ? reduced : q.includes('max-width') ? narrow : false; },
    media: q,
    addEventListener: (_t: string, l: () => void) => { mqListeners.add({ q, l }); },
    removeEventListener: (_t: string, l: () => void) => { for (const e of [...mqListeners]) if (e.l === l) mqListeners.delete(e); },
  });
  defineG('matchMedia', mm);
  (win as unknown as Record<string, unknown>)['matchMedia'] = mm;

  class RO { cb: () => void; constructor(cb: () => void) { this.cb = cb; observers.add(this.cb); } observe() {} unobserve() {} disconnect() { observers.delete(this.cb); } }
  defineG('ResizeObserver', RO);
  (win as unknown as Record<string, unknown>)['ResizeObserver'] = RO;

  Object.defineProperty(win.document, 'hidden', { configurable: true, get: () => hiddenDoc });

  const proto = win.HTMLElement.prototype as unknown as Record<string, unknown>;
  const geo = (el: Element): Geometry => geometry.get(el) ?? { width: 0, height: 0, left: 0, top: 0 };
  Object.defineProperty(proto, 'clientWidth', { configurable: true, get() { return geo(this as Element).width; } });
  Object.defineProperty(proto, 'clientHeight', { configurable: true, get() { return geo(this as Element).height; } });
  proto['getBoundingClientRect'] = function (this: Element) { const q = geo(this); return { x: q.left, y: q.top, left: q.left, top: q.top, width: q.width, height: q.height, right: q.left + q.width, bottom: q.top + q.height, toJSON() {} }; };
  proto['getClientRects'] = function (this: Element) { const q = geo(this); return q.width > 0 && q.height > 0 ? [proto['getBoundingClientRect'] as never] : []; };
  proto['setPointerCapture'] = (id: number) => { capture.set.add(id); capture.sets++; };
  proto['releasePointerCapture'] = (id: number) => { if (capture.set.delete(id)) capture.releases++; };
  proto['hasPointerCapture'] = (id: number) => capture.set.has(id);

  const dom: FreeflowDom = {
    window: win, document: win.document, geometry,
    setGeometry(el, p) { geometry.set(el, { ...geo(el), ...p }); },
    hide(el) { geometry.set(el, { width: 0, height: 0, left: 0, top: 0 }); },
    fireResize() { for (const cb of [...observers]) cb(); },
    setReducedMotion(v) { reduced = v; },
    setNarrow(v) { narrow = v; for (const e of [...mqListeners]) e.l(); },
    setHidden(v) { hiddenDoc = v; win.document.dispatchEvent(new win.Event('visibilitychange')); },
    raf: {
      pending: () => rafQ.size,
      step(ms = 16) { now += ms; const q = [...rafQ]; rafQ.clear(); for (const [, cb] of q) cb(now); },
      drain(max = 200) { for (let i = 0; i < max && rafQ.size; i++) dom.raf.step(16); },
    },
    timers: {
      pending: () => timerQ.size,
      advance(ms) { now += ms; for (const [id, t] of [...timerQ]) if (t.at <= now) { timerQ.delete(id); t.fn(); } },
    },
    capture,
    pointer(el, type, init) {
      const ev = new win.MouseEvent(type, { bubbles: true, cancelable: true, clientX: init.x, clientY: init.y, button: init.button ?? 0 });
      Object.defineProperty(ev, 'pointerId', { value: init.id ?? 1 });
      Object.defineProperty(ev, 'pointerType', { value: init.pointerType ?? 'mouse' });
      el.dispatchEvent(ev);
    },
    wheel(el, init) {
      const ev = new win.MouseEvent('wheel', { bubbles: true, cancelable: true, clientX: init.x, clientY: init.y, ctrlKey: !!init.ctrlKey });
      Object.defineProperty(ev, 'deltaY', { value: init.deltaY });
      Object.defineProperty(ev, 'deltaMode', { value: 0 });
      el.dispatchEvent(ev);
    },
    key(el, key, init) {
      const ev = new win.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });
      el.dispatchEvent(ev);
      return ev;
    },
    advanceTime(ms) { dom.timers.advance(ms); },
    restore() {
      rafQ.clear(); timerQ.clear(); observers.clear(); mqListeners.clear();
      win.document.body.replaceChildren();
      win.close();
      for (const [k, d] of saved) { if (d) Object.defineProperty(globalThis, k, d); else delete g[k]; }
    },
  };
  return dom;
}
