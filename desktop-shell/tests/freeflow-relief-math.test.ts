import { describe, expect, it } from 'vitest';
import {
  DEFAULT_CAMERA, SCREEN_LIMIT, normalizeCamera, normalizeViewport, screenToWorld, worldToScreen,
  type Camera, type Size,
} from '../src/renderer/freeflow/camera.js';
import {
  projectReliefPoint, reliefTransform, type Point3, type ReliefTransform,
} from '../src/renderer/freeflow/relief-math.js';

// Contract: blueprint coordinates are abstract world units, not metres. CSS x
// points right, y down; positive z is raised toward the viewer. Results are CSS
// pixels. Three receives (x,-y,z) exactly once. These are CPU numerical checks,
// not evidence of shader compilation, rasterization, topology, or GPU speed.
const LAPTOPS: Size[] = [{ width: 1440, height: 900 }, { width: 1366, height: 768 }];
const ZOOMS = [0.02, 0.12, 0.7, 1, 1.5, 3.2, 8];
const PITCHES = [0, 15, 35, 45, 55];
const YAWS = [-180, -120, -15, 0, 37, 90, 180];
const ORIGINS = [{ x: 0, y: 0 }, { x: -1_000_000, y: 1_000_000 }, { x: 1_000_000, y: -1_000_000 }];
const DISTANCES = [400, 1800, 6000];

function* cameraCases(): Generator<{ camera: Camera; viewport: Size }> {
  for (const viewport of LAPTOPS) for (const zoom of ZOOMS) for (const pitch of PITCHES)
    for (const yaw of YAWS) for (const origin of ORIGINS) for (const distance of DISTANCES)
      yield { camera: { ...DEFAULT_CAMERA, ...origin, zoom, pitch, yaw, distance }, viewport };
}

/** Consume the exported matrix as a standard column-major graphics client.
 * This does not use the relief projection's rotation/perspective equations. */
function transformPoint(matrix: number[], point: number[], singlePrecision = false): number[] {
  const round = singlePrecision ? Math.fround : (n: number) => n;
  return [0, 1, 2, 3].map(row => {
    let sum = 0;
    for (let column = 0; column < 4; column++)
      sum = round(sum + round(round(matrix[column * 4 + row]!) * round(point[column]!)));
    return sum;
  });
}

function standardPerspective(transform: ReliefTransform, viewport: Size, point: Point3, singlePrecision = false) {
  const p = transformPoint(transform.groupMatrix, [point.x, -point.y, point.z, 1], singlePrecision);
  const cameraDepth = transform.distance - p[2]! / p[3]!;
  const focal = 1 / Math.tan(transform.fov / 2);
  const ndcX = p[0]! / p[3]! * focal / transform.aspect / cameraDepth;
  const ndcY = p[1]! / p[3]! * focal / cameraDepth;
  return { x: (ndcX + 1) * viewport.width / 2, y: (1 - ndcY) * viewport.height / 2, w: cameraDepth / transform.distance };
}

function distance(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

describe('shared blueprint relief projection', () => {
  it('uses radians, CSS pixels and one y-axis conversion with known flat-view answers', () => {
    const viewport = LAPTOPS[0]!;
    const transform = reliefTransform(DEFAULT_CAMERA, viewport);
    expect(transform.groupMatrix).toHaveLength(16);
    expect(transform.fov).toBeGreaterThan(0);
    expect(transform.fov).toBeLessThan(Math.PI);
    expect(2 * transform.distance * Math.tan(transform.fov / 2)).toBeCloseTo(viewport.height, 9);
    expect(transform.aspect).toBe(viewport.width / viewport.height);
    expect(projectReliefPoint(DEFAULT_CAMERA, viewport, { x: 20, y: 30, z: 0 })).toEqual({ x: 740, y: 480, w: 1 });
    const clockwise = standardPerspective(reliefTransform({ ...DEFAULT_CAMERA, yaw: 90 }, viewport), viewport, { x: 20, y: 0, z: 0 });
    expect(clockwise.x).toBeCloseTo(720, 9);
    expect(clockwise.y).toBeCloseTo(470, 9);
    const groundCenter = standardPerspective(reliefTransform({ ...DEFAULT_CAMERA, x: -531, y: 872, zoom: 3.2, pitch: 55, yaw: -120 }, viewport), viewport, { x: -531, y: 872, z: 0 });
    expect(groundCenter.x).toBeCloseTo(720, 9);
    expect(groundCenter.y).toBeCloseTo(450, 9);
  });

  it('matches the existing semantic ground projection across 30,870 far-origin and horizon cases', () => {
    const offsets = [
      { x: 0, y: 0 }, { x: 40, y: -80 }, { x: -270, y: 112 },
      { x: 700, y: 500 }, { x: -1200, y: -1800 },
      { x: 1_000_000, y: -1_000_000 }, { x: -1_000_000, y: 1_000_000 },
    ];
    let checked = 0, worst = 0, worstCase = '';
    for (const { camera, viewport } of cameraCases()) for (const offset of offsets) {
      const p = { x: camera.x + offset.x, y: camera.y + offset.y, z: 0 };
      const expected = worldToScreen(camera, viewport, p), actual = projectReliefPoint(camera, viewport, p);
      const error = distance(expected, actual);
      expect(Number.isFinite(error)).toBe(true);
      if (error > worst) { worst = error; worstCase = JSON.stringify({ camera, viewport, p }); }
      checked++;
    }
    expect(checked).toBe(30_870);
    // Sub-micro-pixel agreement is a numerical alignment check, not a universal
    // geometric epsilon or a claim that float GPU arithmetic is equally exact.
    expect(worst, worstCase).toBeLessThan(1e-7);
  });

  it('independently projects the exported Three matrix for ground and raised points', () => {
    let checked = 0, worst = 0, worstCase = '';
    for (const { camera, viewport } of cameraCases()) {
      const transform = reliefTransform(camera, viewport);
      expect(transform.groupMatrix.every(Number.isFinite)).toBe(true);
      for (const offset of [{ x: -96, y: -64, z: 0 }, { x: 0, y: 0, z: 8 }, { x: 32, y: 70, z: 27 }, { x: 160, y: -100, z: 0 }]) {
        const point = { x: camera.x + offset.x / camera.zoom, y: camera.y + offset.y / camera.zoom, z: offset.z / camera.zoom };
        const actual = standardPerspective(transform, viewport, point);
        // This independent standard camera deliberately has no DOM horizon clamp.
        // Compare only its real front-visible region, away from its near plane.
        expect(actual.w).toBeGreaterThan(0.05);
        const expected = projectReliefPoint(camera, viewport, point);
        const error = distance(actual, expected);
        expect(Number.isFinite(error)).toBe(true);
        if (error > worst) { worst = error; worstCase = JSON.stringify({ camera, viewport, point }); }
        checked++;
      }
    }
    expect(checked).toBe(17_640);
    // Matrix translation cancels coordinates up to 1e6; allow 1e-5 CSS pixels
    // for double-precision cancellation while retaining far sub-pixel alignment.
    expect(worst, worstCase).toBeLessThan(1e-5);
  });

  it('keeps raised relief in front of the floor and tilts it in the correct direction', () => {
    for (const viewport of LAPTOPS) for (const pitch of [15, 35, 55]) for (const yaw of YAWS) {
      const camera = { ...DEFAULT_CAMERA, x: -40, y: 80, zoom: 1.75, pitch, yaw };
      const ground = projectReliefPoint(camera, viewport, { x: camera.x, y: camera.y, z: 0 });
      const raised = projectReliefPoint(camera, viewport, { x: camera.x, y: camera.y, z: 30 });
      expect(raised.x).toBeCloseTo(ground.x, 9);
      expect(raised.y).toBeGreaterThan(ground.y);
      expect(raised.w).toBeLessThan(ground.w);
      expect(distance(raised, standardPerspective(reliefTransform(camera, viewport), viewport, { x: camera.x, y: camera.y, z: 30 }))).toBeLessThan(1e-9);
    }
    const viewport = LAPTOPS[0]!;
    const base = projectReliefPoint(DEFAULT_CAMERA, viewport, { x: 40, y: 0, z: 0 });
    const raised = projectReliefPoint(DEFAULT_CAMERA, viewport, { x: 40, y: 0, z: 30 });
    expect(raised.x - viewport.width / 2).toBeGreaterThan(base.x - viewport.width / 2);
    expect(raised.y).toBe(base.y);
  });

  it('preserves semantic hit coordinates when a projected ground point is inverted', () => {
    let worst = 0;
    for (const viewport of LAPTOPS) for (const origin of ORIGINS) for (const zoom of ZOOMS)
      for (const pitch of [0, 35, 55]) for (const yaw of [-120, 0, 90]) {
        const camera = { ...DEFAULT_CAMERA, ...origin, zoom, pitch, yaw };
        const point = { x: camera.x + 84 / zoom, y: camera.y - 46 / zoom, z: 0 };
        const restored = screenToWorld(camera, viewport, projectReliefPoint(camera, viewport, point));
        worst = Math.max(worst, distance(restored, point));
      }
    expect(worst).toBeLessThan(1e-6);
  });

  it('keeps rebased far-origin matrix arithmetic below a quarter CSS pixel in a Float32 simulation', () => {
    let checked = 0, worst = 0;
    const origins = [{ x: 999_999.875, y: -999_997.625 }, { x: -999_997.625, y: 999_999.875 }, { x: 9_999_990, y: -9_999_990 }];
    for (const viewport of LAPTOPS) for (const origin of origins) for (const zoom of ZOOMS)
      for (const pitch of [0, 35, 55]) for (const yaw of [-120, 0, 90]) {
        const camera = { ...DEFAULT_CAMERA, ...origin, zoom, pitch, yaw, distance: 400 };
        const shift = { x: Math.floor(camera.x / 4096) * 4096, y: Math.floor(camera.y / 4096) * 4096 };
        const rebased = { ...camera, x: camera.x - shift.x, y: camera.y - shift.y };
        for (const offset of [{ x: -96, y: -64, z: 0 }, { x: 32, y: 70, z: 14 }]) {
          const p = { x: camera.x + offset.x / zoom, y: camera.y + offset.y / zoom, z: offset.z / zoom };
          const local = { x: p.x - shift.x, y: p.y - shift.y, z: p.z };
          const expected = projectReliefPoint(camera, viewport, p);
          expect(distance(projectReliefPoint(rebased, viewport, local), expected)).toBeLessThan(1e-7);
          const actual = standardPerspective(reliefTransform(rebased, viewport), viewport, local, true);
          worst = Math.max(worst, distance(actual, expected));
          checked++;
        }
      }
    expect(checked).toBe(756);
    // Per-operation Float32 rounding is a CPU error-budget stress test. Real
    // shader compilers may fuse operations; actual WebGL remains a separate gate.
    expect(worst).toBeLessThan(0.25);
  });

  it('shares normalization for malformed camera, viewport and nonfinite point input', () => {
    const camera: Camera = { x: NaN, y: Infinity, zoom: -2, yaw: NaN, pitch: 900, distance: -Infinity };
    const viewport = { width: -1, height: NaN };
    const normalizedCamera = normalizeCamera(camera), normalizedViewport = normalizeViewport(viewport);
    expect(reliefTransform(camera, viewport)).toEqual(reliefTransform(normalizedCamera, normalizedViewport));
    const p = projectReliefPoint(camera, viewport, { x: NaN, y: Infinity, z: NaN });
    const expected = worldToScreen(camera, viewport, { x: 0, y: 0 });
    expect({ x: p.x, y: p.y }).toEqual(expected);
    expect(Number.isFinite(p.w)).toBe(true);
    expect(p.w).toBeGreaterThanOrEqual(0.05);
  });

  it('clamps the near-horizon projection finitely without claiming that clipped 3D geometry is visible', () => {
    const camera = { ...DEFAULT_CAMERA, pitch: 55, zoom: 8, distance: 400 };
    for (const viewport of LAPTOPS) for (const point of [{ x: 0, y: -1_000_000, z: 0 }, { x: 1_000_000, y: -1_000_000, z: 1_000_000 }]) {
      const p = projectReliefPoint(camera, viewport, point);
      expect(p.w).toBe(0.05);
      expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true);
      expect(Math.abs(p.x - viewport.width / 2)).toBeLessThanOrEqual(SCREEN_LIMIT);
      expect(Math.abs(p.y - viewport.height / 2)).toBeLessThanOrEqual(SCREEN_LIMIT);
    }
  });
});
