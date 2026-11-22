import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { installDom, type FreeflowDom } from './fixtures/freeflow-dom.js';
import { DEFAULT_CAMERA, MAX_COORD, visibleRect, type Camera, type Rect } from '../src/renderer/freeflow/camera.js';
import { mountScene, type SceneRenderer } from '../src/renderer/freeflow/scene.js';

let dom: FreeflowDom;
const renderers: SceneRenderer[] = [];
beforeEach(() => { dom = installDom(); });
afterEach(() => { for (const renderer of renderers.splice(0)) renderer.destroy(); dom.restore(); });

const viewport = { width: 1440, height: 900 };
function mount() {
  const host = document.createElement('div'); document.body.append(host);
  dom.setGeometry(host, { ...viewport, left: 0, top: 0 });
  // Real scene integration in the existing no-WebGL DOM fixture. The grid is
  // still the shared camera's CSS plane, not a mocked geometry helper.
  const renderer = mountScene(host, { graphics: true }); renderers.push(renderer);
  renderer.update({ title: 'Blueprint world', focus: { kind: 'portfolio' }, breadcrumbs: [],
    nodes: [], threads: [], counts: {}, warnings: [], bounds: { x: 0, y: 0, width: 1120, height: 760 } });
  const grid = host.querySelector<HTMLElement>('.ff-grid')!;
  const rect = (): Rect => {
    const origin = /translate\((-?[\d.]+)px,\s*(-?[\d.]+)px\)$/.exec(grid.style.transform);
    expect(origin).not.toBeNull();
    return { x: Number(origin![1]), y: Number(origin![2]), width: Number.parseFloat(grid.style.width), height: Number.parseFloat(grid.style.height) };
  };
  return { host, renderer, grid, rect };
}

function contains(rect: Rect, point: { x: number; y: number }): boolean {
  return point.x >= rect.x && point.x <= rect.x + rect.width && point.y >= rect.y && point.y <= rect.y + rect.height;
}
function fixedPhase(rect: Rect): void {
  // Every shipped minor/major grid period divides 480: base 24/120,
  // company 16/80, and endless blueprint 32/160. Panning must not shift lines.
  for (const period of [16, 24, 32, 80, 120, 160]) {
    expect(Math.abs(rect.x % period)).toBe(0);
    expect(Math.abs(rect.y % period)).toBe(0);
  }
}

describe('bounded blueprint grid placement', () => {
  it.each([
    { name: 'minimum zoom with tilt', camera: { ...DEFAULT_CAMERA, x: 560, y: 380, zoom: .02, pitch: 55 } },
    { name: 'near-horizon fallback', camera: { ...DEFAULT_CAMERA, x: 655248, y: 380, zoom: .7, pitch: 55, distance: 400 } },
  ])('keeps the camera center within the capped grid: $name', ({ camera }) => {
    const { renderer, rect } = mount(); renderer.setCamera(camera);
    const r = rect();
    expect(Object.values(r).every(Number.isFinite)).toBe(true);
    expect(r.width).toBeGreaterThan(0); expect(r.height).toBeGreaterThan(0);
    expect(r.width).toBeLessThanOrEqual(150000); expect(r.height).toBeLessThanOrEqual(150000);
    expect(contains(r, camera)).toBe(true);
    const view = visibleRect(camera, viewport, 400);
    if (view.width > 150000) expect(Math.abs(r.x + r.width / 2 - camera.x)).toBeLessThan(480);
    if (view.height > 150000) expect(Math.abs(r.y + r.height / 2 - camera.y)).toBeLessThan(480);
    fixedPhase(r);
  });

  it('covers the complete padded view when uncapped while preserving line phase across pans and scopes', () => {
    const { renderer, rect } = mount();
    for (const pitch of [0, 42]) for (const delta of [0, 479.25, 480.75, -480.75]) {
      const camera: Camera = { ...DEFAULT_CAMERA, x: 1051 + delta, y: -782 + delta, zoom: .7, pitch, yaw: 37 };
      renderer.setCamera(camera);
      const r = rect(), view = visibleRect(camera, viewport, 400);
      expect(contains(r, { x: view.x, y: view.y })).toBe(true);
      expect(contains(r, { x: view.x + view.width, y: view.y + view.height })).toBe(true);
      expect(r.width).toBeLessThan(150000); expect(r.height).toBeLessThan(150000);
      fixedPhase(r);
    }
  });

  it('reuses one finite grid and one canvas across camera-domain extremes without adding a physical table', () => {
    const { host, renderer, grid, rect } = mount();
    const canvas = host.querySelector('canvas');
    for (const x of [-MAX_COORD, MAX_COORD]) for (const y of [-MAX_COORD, MAX_COORD]) {
      const camera = { ...DEFAULT_CAMERA, x, y, zoom: .02, pitch: 55, distance: 400 };
      renderer.setCamera(camera);
      const r = rect();
      expect(contains(r, camera)).toBe(true);
      for (const value of [r.x, r.y, r.x + r.width, r.y + r.height]) {
        expect(Number.isFinite(value)).toBe(true);
        expect(Math.abs(value)).toBeLessThanOrEqual(MAX_COORD + 150000);
      }
      expect(host.querySelector('.ff-grid')).toBe(grid);
      expect(host.querySelectorAll('canvas')).toHaveLength(1);
      expect(host.querySelector('canvas')).toBe(canvas);
      expect(host.querySelector<HTMLElement>('.ff-world-table')!.hidden).toBe(true);
      fixedPhase(r);
    }
  });
});
