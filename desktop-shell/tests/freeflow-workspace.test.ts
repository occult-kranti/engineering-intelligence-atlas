import { describe, expect, it } from 'vitest';
import { DEFAULT_CAMERA, MAX_COORD, worldToScreen, type Camera, type Rect } from '../src/renderer/freeflow/camera.js';
import {
  MAX_CANVAS_PANELS, MAX_WORKSPACE_BYTES, PANEL_TITLE_HEIGHT, closePanel, dragPanelRect,
  focusPanel, framePanelCamera, normalizePanelRect, normalizeWorkspaceState, panelGridRect,
  panelIsVisible, parseWorkspaceState, resizePanelRect, revealPanel, sampleCameraFlight,
  serializeWorkspaceState, setPanelCollapsed, setPanelPinned, updatePanelRect, visiblePanelRect,
  type CanvasPanelSpec,
} from '../src/renderer/freeflow/workspace.js';

const specs: CanvasPanelSpec[] = [
  { id: 'donna', rect: { x: 30, y: 50, width: 800, height: 600 }, initiallyOpen: true },
  { id: 'models', rect: { x: 1200, y: 50, width: 900, height: 700 } },
  { id: 'blueprint', rect: { x: -1000, y: 200, width: 1000, height: 800 } },
];
const viewport = { width: 1280, height: 800 };
const finiteRect = (r: Rect) => Object.values(r).every(Number.isFinite);

describe('persistent canvas panel state', () => {
  it('restores all registered panels after malformed/oversized or future-version storage', () => {
    for (const value of [null, '', '{', 'x'.repeat(MAX_WORKSPACE_BYTES + 1), '{"version":2,"panels":[]}']) {
      const state = parseWorkspaceState(value, specs);
      expect(state.panels.map((p) => p.id)).toEqual(['donna', 'models', 'blueprint']);
      expect(state.activeId).toBe('donna');
      expect(state.panels[0]!.rect).toEqual(specs[0]!.rect);
    }
  });

  it('admits registered IDs only, deduplicates, strips private values and ignores polluted keys', () => {
    const raw = JSON.parse('{"version":1,"activeId":"unknown","__proto__":{"open":true},"panels":[{"id":"models","open":true,"rect":{"x":88,"y":77,"width":700,"height":500},"token":"secret","formValue":"draft"},{"id":"models","rect":{"x":999}},{"id":"unknown","open":true},{"id":"constructor","open":true}]}');
    const state = normalizeWorkspaceState(raw, specs);
    expect(state.panels).toHaveLength(3);
    expect(state.panels[1]!.rect.x).toBe(88);
    expect(state.activeId).toBe('models');
    const serialized = serializeWorkspaceState(state);
    expect(serialized).not.toMatch(/secret|token|formValue|__proto__|constructor|unknown/);
    expect(({} as Record<string, unknown>).open).toBeUndefined();
  });

  it('does not accept inherited state or inherited geometry values', () => {
    expect(normalizeWorkspaceState(Object.create({ version: 1, panels: [{ id: 'models', open: true }] }), specs).activeId).toBe('donna');
    expect(normalizePanelRect(Object.create({ x: 900, width: 1000 }), specs[0])).toEqual(specs[0]!.rect);
  });

  it('clamps invalid dimensions and all corners to finite world coordinates', () => {
    const state = normalizeWorkspaceState({ version: 1, panels: [{ id: 'donna', rect: { x: Infinity, y: MAX_COORD * 4, width: -2, height: NaN }, z: Infinity }] }, specs);
    const p = state.panels[0]!;
    expect(p.rect.width).toBe(280);
    expect(p.rect.height).toBe(600);
    expect(p.rect.x).toBe(30);
    expect(p.rect.y + p.rect.height).toBe(MAX_COORD);
    expect(finiteRect(p.rect)).toBe(true);
  });

  it('caps registries and malicious saved arrays while avoiding ID collisions', () => {
    const many = Array.from({ length: 30_000 }, (_, i) => ({ id: `panel-${i}`, rect: panelGridRect(i) }));
    const state = normalizeWorkspaceState({ version: 1, panels: Array.from({ length: 30_000 }, () => ({ id: 'bad', open: true })) }, [{ id: '__proto__', rect: specs[0]!.rect }, many[0]!, many[0]!, ...many]);
    expect(state.panels).toHaveLength(MAX_CANVAS_PANELS);
    expect(new Set(state.panels.map((p) => p.id)).size).toBe(MAX_CANVAS_PANELS);
    expect(state.panels.every((p) => finiteRect(p.rect))).toBe(true);
    expect(state.panels.some((p) => p.id === '__proto__')).toBe(false);
  });

  it('reveals a panel without losing its parked position or other panels', () => {
    const original = normalizeWorkspaceState(null, specs);
    const before = JSON.stringify(original);
    const state = revealPanel(original, 'models');
    expect(state.activeId).toBe('models');
    expect(state.panels[0]!.open).toBe(true);
    expect(state.panels[1]!.open).toBe(true);
    expect(state.panels[1]!.rect).toEqual(specs[1]!.rect);
    expect(JSON.stringify(original)).toBe(before);
    expect(revealPanel(state, 'unknown')).toBe(state);
  });

  it('keeps layering bounded after repeated focus changes and is a no-op on current focus', () => {
    let state = revealPanel(normalizeWorkspaceState(null, specs), 'models');
    for (let i = 0; i < 5000; i++) state = focusPanel(state, i % 2 ? 'donna' : 'models');
    expect(state.panels.map((p) => p.z).sort()).toEqual([0, 1, 2]);
    expect(focusPanel(state, state.activeId!)).toBe(state);
    expect(focusPanel(state, 'blueprint')).toBe(state);
  });

  it('closing the active panel activates the next open surface and retains its geometry', () => {
    let state = revealPanel(normalizeWorkspaceState(null, specs), 'models');
    state = updatePanelRect(state, 'models', { x: 88, y: 99, width: 920, height: 710 });
    const closed = closePanel(state, 'models');
    expect(closed.activeId).toBe('donna');
    expect(revealPanel(closed, 'models').panels[1]!.rect).toEqual(state.panels[1]!.rect);
    expect(closePanel(closed, 'donna').activeId).toBeNull();
    expect(closePanel(closed, 'models')).toBe(closed);
  });

  it('position lock prevents movement but still permits explicit close and reopen', () => {
    const state = setPanelPinned(normalizeWorkspaceState(null, specs), 'donna', true);
    expect(updatePanelRect(state, 'donna', { x: 999, y: 999, width: 999, height: 999 })).toBe(state);
    const closed = closePanel(state, 'donna');
    expect(closed.panels[0]!.pinned).toBe(true);
    expect(revealPanel(closed, 'donna').panels[0]!.open).toBe(true);
    expect(updatePanelRect(setPanelPinned(state, 'donna', false), 'donna', { x: 999, y: 999, width: 999, height: 999 }).panels[0]!.rect.x).toBe(999);
  });

  it('collapsing changes presentation height without losing the full content size', () => {
    const state = setPanelCollapsed(normalizeWorkspaceState(null, specs), 'donna', true);
    expect(visiblePanelRect(state.panels[0]!).height).toBe(PANEL_TITLE_HEIGHT);
    expect(state.panels[0]!.rect.height).toBe(600);
    expect(revealPanel(state, 'donna').panels[0]!.collapsed).toBe(false);
  });

  it('roundtrips a strict view-only projection without extra caller fields', () => {
    const state = revealPanel(normalizeWorkspaceState(null, specs), 'models');
    Object.assign(state.panels[0]!, { credentials: 'never persist me', draft: 'private' });
    const json = serializeWorkspaceState(state);
    expect(json).not.toMatch(/credentials|draft|private|never persist/);
    expect(parseWorkspaceState(json, specs)).toEqual(normalizeWorkspaceState(state, specs));
  });

  it('serialization preserves explicitly registered large and compact panel bounds', () => {
    const sizes = [{ id: 'wide', rect: { x: 0, y: 0, width: 5000, height: 4000 }, maxWidth: 6000, maxHeight: 5000 }, { id: 'compact', rect: { x: 0, y: 0, width: 180, height: 60 }, minWidth: 160, minHeight: 48 }];
    const state = normalizeWorkspaceState(null, sizes);
    expect(parseWorkspaceState(serializeWorkspaceState(state), sizes)).toEqual(state);
  });
});

describe('world-space panel geometry', () => {
  it('drag uses inverse perspective/yaw rather than screen-pixel offsets', () => {
    for (const cam of [DEFAULT_CAMERA, { ...DEFAULT_CAMERA, x: 100, y: 50, zoom: 0.7, yaw: 35, pitch: 40 }]) {
      const startWorld = { x: 30, y: 50 }; const endWorld = { x: 180, y: 140 };
      const moved = dragPanelRect(specs[0]!.rect, worldToScreen(cam, viewport, startWorld), worldToScreen(cam, viewport, endWorld), cam, viewport);
      expect(moved.x).toBeCloseTo(180, 6); expect(moved.y).toBeCloseTo(140, 6);
      expect(moved.width).toBe(800);
    }
  });

  it('pointer movement is replayable and does not accumulate drift', () => {
    const before = { ...specs[0]!.rect };
    const args = [before, { x: 200, y: 100 }, { x: 250, y: 175 }, DEFAULT_CAMERA, viewport] as const;
    expect(dragPanelRect(...args)).toEqual(dragPanelRect(...args));
    expect(before).toEqual(specs[0]!.rect);
  });

  it('resize respects edge, minimums and inverse projection at a rotated camera', () => {
    const cam: Camera = { ...DEFAULT_CAMERA, zoom: 0.5, yaw: -45, pitch: 20 };
    const start = worldToScreen(cam, viewport, { x: 800, y: 600 }); const end = worldToScreen(cam, viewport, { x: 950, y: 700 });
    expect(resizePanelRect(specs[0]!.rect, start, end, cam, viewport, 'e').width).toBeCloseTo(950, 6);
    expect(resizePanelRect(specs[0]!.rect, start, end, cam, viewport, 'e').height).toBe(600);
    expect(resizePanelRect(specs[0]!.rect, start, end, cam, viewport, 's').width).toBe(800);
    expect(resizePanelRect(specs[0]!.rect, start, end, cam, viewport, 's').height).toBeCloseTo(700, 6);
    const tiny = resizePanelRect(specs[0]!.rect, { x: 0, y: 0 }, { x: -2000, y: -2000 }, DEFAULT_CAMERA, viewport);
    expect(tiny.width).toBe(280); expect(tiny.height).toBe(180);
  });

  it('world-edge resize does not move its anchor outside the permitted world', () => {
    const rect = { x: MAX_COORD - 800, y: MAX_COORD - 600, width: 800, height: 600 };
    const next = resizePanelRect(rect, { x: 0, y: 0 }, { x: 1000, y: 1000 }, DEFAULT_CAMERA, viewport);
    expect(next).toEqual(rect);
  });

  it('near-horizon and malformed pointer inputs remain finite and bounded', () => {
    const cam = { ...DEFAULT_CAMERA, pitch: 55, distance: 400, zoom: 0.02 };
    for (const end of [{ x: 100, y: 1000 }, { x: 1e30, y: -1e30 }, { x: NaN, y: Infinity }]) {
      for (const r of [dragPanelRect(specs[0]!.rect, { x: 0, y: 0 }, end, cam, viewport), resizePanelRect(specs[0]!.rect, { x: 0, y: 0 }, end, cam, viewport)]) {
        expect(finiteRect(r)).toBe(true);
        expect(r.x).toBeGreaterThanOrEqual(-MAX_COORD); expect(r.x + r.width).toBeLessThanOrEqual(MAX_COORD);
        expect(r.y).toBeGreaterThanOrEqual(-MAX_COORD); expect(r.y + r.height).toBeLessThanOrEqual(MAX_COORD);
      }
    }
    expect(dragPanelRect(specs[0]!.rect, { x: 500, y: 300 }, { x: 100, y: 1000 }, cam, viewport)).toEqual(specs[0]!.rect);
  });

  it('frames a parked panel at phone, desktop and tilted perspective sizes', () => {
    for (const vp of [viewport, { width: 390, height: 680 }]) {
      const rect = specs[2]!.rect;
      const cam = framePanelCamera({ ...DEFAULT_CAMERA, yaw: 20, pitch: 40 }, vp, rect, 24);
      for (const p of [{ x: rect.x, y: rect.y }, { x: rect.x + rect.width, y: rect.y }, { x: rect.x + rect.width, y: rect.y + rect.height }, { x: rect.x, y: rect.y + rect.height }]) {
        const screen = worldToScreen(cam, vp, p);
        expect(screen.x).toBeGreaterThanOrEqual(23.9); expect(screen.x).toBeLessThanOrEqual(vp.width - 23.9);
        expect(screen.y).toBeGreaterThanOrEqual(23.9); expect(screen.y).toBeLessThanOrEqual(vp.height - 23.9);
      }
    }
  });

  it('visibility preserves conservative horizon cases and excludes closed panels', () => {
    let panel = normalizeWorkspaceState(null, specs).panels[0]!;
    expect(panelIsVisible(panel, DEFAULT_CAMERA, viewport)).toBe(true);
    expect(panelIsVisible({ ...panel, open: false }, DEFAULT_CAMERA, viewport)).toBe(false);
    panel = { ...panel, rect: { ...panel.rect, x: 1_000_000, y: 1_000_000 } };
    expect(panelIsVisible(panel, DEFAULT_CAMERA, viewport)).toBe(false);
    expect(panelIsVisible(panel, { ...DEFAULT_CAMERA, pitch: 55, distance: 400 }, { width: 1200, height: 1000 })).toBe(true);
  });

  it('parking remains deterministic and finite at excessive capacity and hostile indexes', () => {
    for (const index of [-100, 0, 1, 47, 100_000, NaN, Infinity]) {
      expect(panelGridRect(index)).toEqual(panelGridRect(index));
      expect(finiteRect(panelGridRect(index, { x: Infinity, y: NaN }, { width: -1, height: Infinity }))).toBe(true);
    }
    expect(panelGridRect(100_000)).toEqual(panelGridRect(MAX_CANVAS_PANELS - 1));
    expect(panelGridRect(0)).not.toEqual(panelGridRect(1));
  });
});

describe('bounded camera flights', () => {
  it('takes the shortest yaw arc and ends at the exact target', () => {
    const from = { ...DEFAULT_CAMERA, yaw: 170 }; const to = { ...DEFAULT_CAMERA, x: 1200, yaw: -170, zoom: 0.4 };
    const halfway = sampleCameraFlight(from, to, 190);
    expect(Math.abs(halfway.camera.yaw)).toBeGreaterThan(170);
    expect(halfway.done).toBe(false);
    expect(sampleCameraFlight(from, to, 380)).toEqual({ camera: to, done: true });
  });

  it('honors instant motion and bounds invalid elapsed/duration inputs', () => {
    const target = { ...DEFAULT_CAMERA, x: 777 };
    expect(sampleCameraFlight(DEFAULT_CAMERA, target, 0, 0)).toEqual({ camera: target, done: true });
    expect(sampleCameraFlight(DEFAULT_CAMERA, target, NaN).camera).toEqual(DEFAULT_CAMERA);
    expect(sampleCameraFlight(DEFAULT_CAMERA, target, -30).camera).toEqual(DEFAULT_CAMERA);
    expect(sampleCameraFlight(DEFAULT_CAMERA, target, 1000, 100_000).done).toBe(true);
    expect(Object.values(sampleCameraFlight(DEFAULT_CAMERA, target, Infinity, Infinity).camera).every(Number.isFinite)).toBe(true);
  });
});
