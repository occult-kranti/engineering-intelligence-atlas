/**
 * Motion system: duration/easing tokens and the reduced-motion gate shared by
 * every JS animation, panzoom smooth scroll, and CSS (via the
 * `reduce-motion` class on <html>).
 *
 * Two independent signals force reduced motion:
 *   1. the OS setting (prefers-reduced-motion: reduce), and
 *   2. the visible app-level "Reduce motion" toggle (persisted per device).
 * Content is never gated by motion: animations are skipped, never required.
 */

export const MOTION_TOKENS = {
  /** Micro feedback (hover, press). */
  fast: 120,
  /** Standard state changes (tabs, toasts). */
  standard: 200,
  /** Overlays, inspector collapse, camera nudges. */
  slow: 320,
  /** Camera focus flights / emphasis. */
  emphasis: 420,
} as const;

export const MOTION_EASING = {
  out: 'cubic-bezier(0.2, 0, 0, 1)',
  in: 'cubic-bezier(0.4, 0, 1, 1)',
  inout: 'cubic-bezier(0.4, 0, 0.2, 1)',
} as const;

const STORAGE_KEY = 'rd.reduceMotion';

let appReduced = readStored();
const listeners = new Set<(reduced: boolean) => void>();

function readStored(): boolean {
  try {
    return globalThis.localStorage?.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

/** OS-level reduced motion preference (false when matchMedia is unavailable, e.g. jsdom). */
export function osPrefersReducedMotion(): boolean {
  try {
    return (
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    );
  } catch {
    return false;
  }
}

/** The app-level Reduce motion toggle state. */
export function appReduceMotionEnabled(): boolean {
  return appReduced;
}

/** Effective gate for every animation decision. */
export function isMotionReduced(): boolean {
  return appReduced || osPrefersReducedMotion();
}

export function setAppReduceMotion(enabled: boolean): void {
  appReduced = enabled;
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, enabled ? '1' : '0');
  } catch {
    // storage may be unavailable; the in-memory toggle still works
  }
  applyMotionClass();
  for (const listener of listeners) listener(isMotionReduced());
}

export function onMotionPreferenceChange(listener: (reduced: boolean) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Reflect the effective preference as a CSS class so styles can disable animation. */
export function applyMotionClass(target?: HTMLElement): void {
  const root = target ?? (typeof document !== 'undefined' ? document.documentElement : undefined);
  root?.classList.toggle('reduce-motion', isMotionReduced());
}

/** Initialize the class + OS listener once per page. */
export function initMotion(): void {
  applyMotionClass();
  try {
    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', () => applyMotionClass());
    }
  } catch {
    // jsdom / older engines: no OS listener; the app toggle still works
  }
}

/**
 * Run a JS animation only when motion is allowed; otherwise apply the final
 * state immediately. The `apply` callback MUST fully reach the end state when
 * called with progress 1 so content is never gated by motion.
 */
export function animate(
  durationMs: number,
  apply: (progress: number) => void,
  easing: (t: number) => number = easeOutCubic,
): { cancel: () => void } {
  if (isMotionReduced() || typeof requestAnimationFrame !== 'function') {
    apply(1);
    return { cancel: () => undefined };
  }
  let cancelled = false;
  let rafId = 0;
  const start = performance.now();
  const step = (now: number) => {
    if (cancelled) return;
    const t = Math.min(1, (now - start) / durationMs);
    apply(easing(t));
    if (t < 1) rafId = requestAnimationFrame(step);
  };
  rafId = requestAnimationFrame(step);
  return {
    cancel: () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
    },
  };
}

export function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/**
 * Optional view transitions: only for tab/project switches, only when the
 * browser supports them and motion is allowed. Never used on the canvas.
 */
export function withViewTransition(update: () => void): void {
  const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown };
  if (isMotionReduced() || typeof doc.startViewTransition !== 'function') {
    update();
    return;
  }
  doc.startViewTransition(update);
}
