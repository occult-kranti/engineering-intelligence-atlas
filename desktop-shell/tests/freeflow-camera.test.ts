import { describe, expect, it } from 'vitest';
import {
  DEFAULT_CAMERA,
  cameraTransform,
  easeSpring,
  fitBounds,
  interpolateCamera,
  isVisible,
  normalizeCamera,
  screenToWorld,
  visibleRect,
  worldToScreen,
  wrapDegrees,
  zoomAt,
  type Camera,
  type Rect,
  type Size,
} from '../src/renderer/freeflow/camera.js';

const corners = (r: Rect) => [
  { x: r.x, y: r.y },
  { x: r.x + r.width, y: r.y },
  { x: r.x + r.width, y: r.y + r.height },
  { x: r.x, y: r.y + r.height },
];

function expectFits(cam: Camera, vp: Size, bounds: Rect, pad: number) {
  for (const c of corners(bounds)) {
    expect(isVisible(cam, vp, c)).toBe(true);
    const s = worldToScreen(cam, vp, c);
    expect(s.x).toBeGreaterThanOrEqual(pad - 0.05);
    expect(s.x).toBeLessThanOrEqual(vp.width - pad + 0.05);
    expect(s.y).toBeGreaterThanOrEqual(pad - 0.05);
    expect(s.y).toBeLessThanOrEqual(vp.height - pad + 0.05);
  }
}

describe('freeflow camera', () => {
  it('fitBounds counterexample: pitch 35 keeps all corners inside padding', () => {
    const vp = { width: 1200, height: 800 };
    const bounds = { x: 0, y: 0, width: 1000, height: 600 };
    const cam = fitBounds({ ...DEFAULT_CAMERA, pitch: 35, distance: 1800 }, vp, bounds, 48);
    expectFits(cam, vp, bounds, 48);
    expect(cam.zoom).toBeLessThan(1);
  });

  it('fitBounds handles yaw, short distance and negative origin', () => {
    const vp = { width: 1024, height: 768 };
    const bounds = { x: -700, y: -300, width: 900, height: 500 };
    const cam = fitBounds({ ...DEFAULT_CAMERA, pitch: 55, yaw: 30, distance: 400 }, vp, bounds, 40);
    expectFits(cam, vp, bounds, 40);
  });

  it('fits all 4 corners at common viewports, flat and tilted', () => {
    const bounds = { x: 100, y: 50, width: 2400, height: 1500 };
    for (const vp of [
      { width: 1024, height: 768 },
      { width: 1920, height: 1080 },
      { width: 390, height: 720 },
    ]) {
      for (const base of [DEFAULT_CAMERA, { ...DEFAULT_CAMERA, pitch: 35, yaw: 20 }]) {
        const cam = fitBounds(base, vp, bounds, 24);
        expectFits(cam, vp, bounds, 24);
      }
    }
  });

  it('visibleRect counterexample: horizon-crossing view stays conservative', () => {
    const cam: Camera = { ...DEFAULT_CAMERA, pitch: 55, distance: 400 };
    const vp = { width: 1200, height: 1000 };
    const r = visibleRect(cam, vp, 0);
    for (const w of [
      { x: 0, y: 1_000_000 },
      { x: 1_000_000, y: 1_000_000 },
    ]) {
      if (!isVisible(cam, vp, w)) continue;
      const s = worldToScreen(cam, vp, w);
      if (s.x < 0 || s.x > vp.width || s.y < 0 || s.y > vp.height) continue;
      expect(w.x).toBeGreaterThanOrEqual(r.x);
      expect(w.x).toBeLessThanOrEqual(r.x + r.width);
      expect(w.y).toBeGreaterThanOrEqual(r.y);
      expect(w.y).toBeLessThanOrEqual(r.y + r.height);
    }
    expect(Number.isFinite(r.x + r.y + r.width + r.height)).toBe(true);
  });

  it('visibleRect for flat view covers the visible window', () => {
    const vp = { width: 800, height: 600 };
    const r = visibleRect({ ...DEFAULT_CAMERA, x: 100, y: 50, zoom: 2 }, vp, 0);
    expect(r.width).toBeCloseTo(400, 6);
    expect(r.height).toBeCloseTo(300, 6);
    expect(r.x).toBeCloseTo(-100, 6);
  });

  it('roundtrips world/screen with pitch and yaw', () => {
    const vp = { width: 1200, height: 800 };
    for (const cam of [
      { ...DEFAULT_CAMERA, x: 50, y: -40, zoom: 0.7, yaw: 25, pitch: 40 },
      { ...DEFAULT_CAMERA, zoom: 1.5, yaw: -120, pitch: 20, distance: 900 },
    ]) {
      for (const p of [
        { x: 10, y: 20 },
        { x: -300, y: 120 },
        { x: 400, y: -250 },
      ]) {
        const back = screenToWorld(cam, vp, worldToScreen(cam, vp, p));
        expect(back.x).toBeCloseTo(p.x, 6);
        expect(back.y).toBeCloseTo(p.y, 6);
      }
    }
  });

  it('zoomAt keeps the anchor within half a pixel', () => {
    const vp = { width: 1200, height: 800 };
    const cam: Camera = { ...DEFAULT_CAMERA, x: 20, y: 30, yaw: 15, pitch: 30 };
    const anchor = { x: 900, y: 250 };
    const before = screenToWorld(cam, vp, anchor);
    for (const f of [0.5, 1.7, 3]) {
      const next = zoomAt(cam, vp, anchor, f);
      const s = worldToScreen(next, vp, before);
      expect(Math.hypot(s.x - anchor.x, s.y - anchor.y)).toBeLessThanOrEqual(0.5);
    }
  });

  it('handles invalid input finitely', () => {
    const bad = normalizeCamera({ x: NaN, y: Infinity, zoom: -3, yaw: NaN, pitch: 999, distance: 0 });
    for (const v of Object.values(bad)) expect(Number.isFinite(v)).toBe(true);
    expect(bad.pitch).toBe(55);
    const s = worldToScreen(bad, { width: -1, height: NaN }, { x: NaN, y: 5 });
    expect(Number.isFinite(s.x) && Number.isFinite(s.y)).toBe(true);
    const f = fitBounds(DEFAULT_CAMERA, { width: 800, height: 600 }, { x: NaN, y: 0, width: -50, height: 0 }, NaN);
    for (const v of Object.values(f)) expect(Number.isFinite(v)).toBe(true);
    expect(cameraTransform(bad, { width: 800, height: 600 })).not.toMatch(/NaN|Infinity/);
  });

  it('wraps angles and has exact interpolation endpoints', () => {
    expect(wrapDegrees(190)).toBe(-170);
    expect(wrapDegrees(-180)).toBe(180);
    expect(wrapDegrees(720)).toBe(0);
    const a: Camera = { ...DEFAULT_CAMERA, yaw: 170, zoom: 0.5 };
    const b: Camera = { ...DEFAULT_CAMERA, yaw: -170, zoom: 2, x: 100 };
    expect(interpolateCamera(a, b, 0)).toEqual(normalizeCamera(a));
    expect(interpolateCamera(a, b, 1)).toEqual(normalizeCamera(b));
    const mid = interpolateCamera(a, b, 0.5);
    expect(Math.abs(mid.yaw)).toBeCloseTo(180, 6);
    expect(easeSpring(0)).toBe(0);
    expect(easeSpring(1)).toBe(1);
    expect(easeSpring(0.5)).toBeGreaterThan(0);
    expect(easeSpring(0.5)).toBeLessThan(1);
  });

  it('emits CSS transform in documented order', () => {
    const t = cameraTransform({ ...DEFAULT_CAMERA, pitch: 30, yaw: 10, zoom: 2 }, { width: 800, height: 600 });
    expect(t.indexOf('translate(400px')).toBe(0);
    expect(t.indexOf('perspective')).toBeLessThan(t.indexOf('rotateX'));
    expect(t.indexOf('rotateX')).toBeLessThan(t.indexOf('rotate(10deg)'));
    expect(t.indexOf('rotate(10deg)')).toBeLessThan(t.indexOf('scale(2)'));
  });
});
