import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installDom, type FreeflowDom } from './fixtures/freeflow-dom.js';
import { DEFAULT_CAMERA } from '../src/renderer/freeflow/camera.js';
import type { FreeflowScene, SceneNode } from '../src/renderer/freeflow/model.js';

// Only the renderer boundary is mocked. Real pinned Three geometry, instancing,
// colors and matrices run on the CPU. This suite cannot prove GPU rendering.
const evidence = vi.hoisted(() => ({ renderers: [] as any[], failRender: false, failShader: false }));
vi.mock('../src/renderer/freeflow/vendor/three.js', async importOriginal => {
  const actual = await importOriginal<{ THREE: any }>();
  class CpuRenderer {
    debug: { onShaderError?: () => void } = {};
    info = { render: { calls: 0, triangles: 0 } };
    disposed = 0; lost = 0; frames = 0; ratio = 0;
    size = { width: 0, height: 0 }; scene: any = null;
    geometries = new Set<any>(); materials = new Set<any>();
    geometryDisposals = 0; materialDisposals = 0;
    constructor() { evidence.renderers.push(this); }
    setClearColor() {}
    setPixelRatio(value: number) { this.ratio = value; }
    setSize(width: number, height: number) { this.size = { width, height }; }
    render(scene: any) {
      if (evidence.failRender) throw Error('synthetic renderer failure');
      this.frames++; this.scene = scene;
      this.info.render = { calls: 0, triangles: 0 };
      scene.traverse((node: any) => {
        if (!node.isInstancedMesh) return;
        if (!this.geometries.has(node.geometry)) {
          this.geometries.add(node.geometry);
          node.geometry.addEventListener('dispose', () => this.geometryDisposals++);
        }
        if (!this.materials.has(node.material)) {
          this.materials.add(node.material);
          node.material.addEventListener('dispose', () => this.materialDisposals++);
        }
        expect([...node.instanceMatrix.array].every(Number.isFinite)).toBe(true);
        if (node.count > 0) { this.info.render.calls++; this.info.render.triangles += node.count * 12; }
      });
      if (evidence.failShader) this.debug.onShaderError?.();
    }
    dispose() { this.disposed++; }
    forceContextLoss() { this.lost++; }
  }
  return { THREE: { ...actual.THREE, WebGLRenderer: CpuRenderer } };
});

import { THREE } from '../src/renderer/freeflow/vendor/three.js';
import { mountRelief3D, type ReliefHandle } from '../src/renderer/freeflow/relief3d.js';
import { mountScene } from '../src/renderer/freeflow/scene.js';

let dom: FreeflowDom;
const handles: ReliefHandle[] = [];
beforeEach(() => {
  evidence.renderers.length = 0; evidence.failRender = false; evidence.failShader = false;
  dom = installDom();
  Object.defineProperty(dom.window, 'WebGL2RenderingContext', { configurable: true, value: class CpuContextMarker {} });
  vi.spyOn(dom.window.HTMLCanvasElement.prototype, 'getContext').mockImplementation(type => type === 'webgl2' ? {} as WebGL2RenderingContext : null);
});
afterEach(() => {
  for (const handle of handles.splice(0)) handle.destroy();
  vi.restoreAllMocks(); dom.restore();
});

function node(id: string, rect = { x: 0, y: 0, width: 100, height: 80 }, kind: SceneNode['kind'] = 'room'): SceneNode {
  return { id, kind, entityId: id, companyId: 'company-a', officeId: 'office-a', departmentId: 'department-a',
    parentId: null, label: id, subtitle: '', status: 'active', rect, metadata: {}, counts: {} };
}
function scene(nodes: SceneNode[]): FreeflowScene {
  return { title: 'CPU lifecycle fixture', focus: { kind: 'portfolio' }, breadcrumbs: [], nodes,
    bounds: { x: 0, y: 0, width: 6000, height: 5000 }, threads: [], counts: {}, warnings: [] };
}
function mount() {
  const host = document.createElement('div'); document.body.append(host);
  const handle = mountRelief3D(host); handles.push(handle);
  handle.setCamera(DEFAULT_CAMERA, { width: 1440, height: 900 });
  return { host, handle };
}
function renderer() { return evidence.renderers.at(-1)!; }

describe('blueprint relief adapter CPU lifecycle (mocked WebGLRenderer)', () => {
  it('coalesces updates into one demand frame and reuses fixed geometry/material pools', () => {
    const { handle } = mount(), fixture = scene([node('room')]), original = JSON.stringify(fixture);
    for (let i = 0; i < 100; i++) {
      handle.update(fixture);
      handle.setCamera({ ...DEFAULT_CAMERA, x: i / 10 }, { width: 1440, height: 900 });
      handle.setTheme(i % 2 ? 'drafting' : 'blueprint');
    }
    expect(dom.raf.pending()).toBe(1);
    expect(handle.stats().state).toBe('fallback'); // no successful render yet
    dom.raf.step();
    expect(handle.stats()).toMatchObject({ state: 'webgl', frames: 1, pending: false, geometries: 1, materials: 3, instances: 7 });
    expect(dom.raf.pending()).toBe(0);
    for (let i = 0; i < 25; i++) { handle.update(fixture); dom.raf.step(); }
    expect(renderer().geometries.size).toBe(1);
    expect(renderer().materials.size).toBe(3);
    expect(evidence.renderers).toHaveLength(1);
    expect(handle.stats().frames).toBe(26);
    expect(JSON.stringify(fixture)).toBe(original);
    expect(dom.raf.pending()).toBe(0);
  });

  it('admits bounded visible geometry for 2,000 rooms and ignores nonphysical/invalid nodes', () => {
    const { handle } = mount();
    const rooms = Array.from({ length: 2000 }, (_, i) => node(`room-${i}`, { x: i % 50 * 110, y: Math.floor(i / 50) * 110, width: 100, height: 100 }));
    handle.setCamera({ ...DEFAULT_CAMERA, zoom: 0.02 }, { width: 1440, height: 900 });
    handle.update(scene(rooms)); dom.raf.step();
    expect(handle.stats()).toMatchObject({ instances: 1680, geometries: 1, materials: 3, drawCalls: 2 });
    expect(handle.stats().triangles).toBe(1680 * 12);
    expect(handle.stats().instances).toBeLessThanOrEqual(2048);
    handle.update(scene([
      node('nan', { x: NaN, y: 0, width: 100, height: 80 }),
      node('zero', { x: 0, y: 0, width: 0, height: 80 }),
      node('negative', { x: 0, y: 0, width: 100, height: -1 }),
      node('overflow', { x: 1e7, y: 0, width: 100, height: 80 }),
      node('employee', undefined, 'employee'), node('reference', undefined, 'reference'),
      node('valid'),
    ])); dom.raf.step();
    expect(handle.stats().instances).toBe(7);
  });

  it('keeps real box geometry inside its room and leaves an actual doorway gap', () => {
    const { handle } = mount();
    const room = node('room'); handle.update(scene([room])); dom.raf.step();
    const walls: Array<{ x0: number; x1: number; y0: number; y1: number; z0: number; z1: number }> = [];
    renderer().scene.traverse((mesh: any) => {
      if (!mesh.isInstancedMesh) return;
      for (let index = 0; index < mesh.count; index++) {
        const matrix = new THREE.Matrix4(); mesh.getMatrixAt(index, matrix);
        const a = new THREE.Vector3(0, 0, 0).applyMatrix4(matrix);
        const b = new THREE.Vector3(1, 1, 1).applyMatrix4(matrix);
        const box = { x0: a.x, x1: b.x, y0: -b.y, y1: -a.y, z0: a.z, z1: b.z };
        expect(box.x0).toBeGreaterThanOrEqual(room.rect.x - 1e-5);
        expect(box.x1).toBeLessThanOrEqual(room.rect.x + room.rect.width + 1e-5);
        expect(box.y0).toBeGreaterThanOrEqual(room.rect.y - 1e-5);
        expect(box.y1).toBeLessThanOrEqual(room.rect.y + room.rect.height + 1e-5);
        if (box.z1 > 1) walls.push(box);
      }
    });
    expect(walls).toHaveLength(5);
    const doorwayPoint = { x: 72, y: 79 };
    expect(walls.some(box => doorwayPoint.x > box.x0 && doorwayPoint.x < box.x1 && doorwayPoint.y > box.y0 && doorwayPoint.y < box.y1)).toBe(false);
    expect(walls.some(box => 20 > box.x0 && 20 < box.x1 && 79 > box.y0 && 79 < box.y1)).toBe(true);
  });

  it('grounds shallow partitions with a contained contact threshold without shadow passes or muddying the floor', () => {
    const { handle } = mount(); handle.update(scene([node('room')])); dom.raf.step();
    const floors: any[] = [], walls: any[] = [];
    renderer().scene.traverse((mesh: any) => {
      if (!mesh.isInstancedMesh || !mesh.count) return;
      if (mesh.material.isMeshStandardMaterial) walls.push(mesh); else floors.push(mesh);
    });
    expect(floors).toHaveLength(1); expect(walls).toHaveLength(1);
    expect(floors[0].count).toBe(2);
    expect(floors[0].material.vertexColors).toBe(false);
    expect(walls[0].material.vertexColors).toBe(true);
    const matrix = new THREE.Matrix4(); floors[0].getMatrixAt(0, matrix);
    const edge = new THREE.Vector3(1, 1, 1).applyMatrix4(matrix);
    expect(edge.x).toBeCloseTo(100); expect(edge.z).toBeLessThan(0.4);
    floors[0].getMatrixAt(1, matrix);
    const interior = new THREE.Vector3(0, 0, 0).applyMatrix4(matrix);
    expect(interior.x).toBeGreaterThan(2.4); // contact band is exposed just inside the wall
    expect(interior.z).toBeGreaterThan(0); // no coplanar floor overlap
    expect(walls[0].castShadow).toBe(false); expect(walls[0].receiveShadow).toBe(false);
    expect(renderer().scene.children.filter((n: any) => n.isLight).every((light: any) => !light.castShadow)).toBe(true);
    expect(dom.raf.pending()).toBe(0);
  });

  it('spends the horizon budget on the current distant company and retains per-surface ownership', () => {
    const { handle } = mount();
    const footprints = Array.from({ length: 1000 }, (_, i) => ({
      ...node(`company-${i}`, { x: i * 1312, y: 0, width: 1120, height: 760 }, 'reference'),
      metadata: { companyFootprint: true },
    }));
    const target = footprints[999]!;
    const room = node('target-room', { x: target.rect.x + 450, y: 240, width: 180, height: 240 });
    handle.setCamera({ ...DEFAULT_CAMERA, x: target.rect.x + 560, y: 380, zoom: 0.7, pitch: 55, distance: 400 }, { width: 1440, height: 900 });
    handle.update(scene([...footprints, room]));
    expect(handle.stats().surfaceIds).toEqual([]); // No successful frame yet.
    dom.raf.step();
    const owned = handle.stats().surfaceIds;
    expect(owned).toContain('company-999');
    expect(owned).toContain('target-room');
    expect(owned).not.toContain('company-0');
    expect(owned.length).toBeLessThanOrEqual(240);
    expect(handle.stats().instances).toBeLessThanOrEqual(2048);
    // Presentation consumers cannot mutate the adapter's ownership record.
    (owned as string[]).length = 0;
    expect(handle.stats().surfaceIds).toContain('target-room');
    handle.update(scene([])); dom.raf.step();
    expect(handle.stats().surfaceIds).toEqual([]);
  });

  it('pauses pending work when hidden or inactive, and never reschedules after destruction', () => {
    const { host, handle } = mount(); handle.update(scene([node('room')]));
    expect(dom.raf.pending()).toBe(1);
    handle.setActive(false); expect(dom.raf.pending()).toBe(0);
    handle.update(scene([node('later')])); dom.raf.step(); expect(handle.stats().frames).toBe(0);
    handle.setActive(true); expect(dom.raf.pending()).toBe(1);
    dom.setHidden(true); expect(dom.raf.pending()).toBe(0);
    dom.setHidden(false); expect(dom.raf.pending()).toBe(1); dom.raf.step();
    expect(handle.stats().frames).toBe(1);
    const canvas = host.querySelector('canvas')!;
    handle.update(scene([node('pending')])); expect(dom.raf.pending()).toBe(1);
    handle.destroy(); handle.destroy();
    handle.setActive(true); handle.update(scene([node('too-late')]));
    canvas.dispatchEvent(new dom.window.Event('webglcontextrestored'));
    dom.setHidden(true); dom.setHidden(false); dom.raf.step();
    expect(handle.stats()).toMatchObject({ state: 'destroyed', frames: 1, pending: false, geometries: 0, materials: 0, instances: 0 });
    expect(dom.raf.pending()).toBe(0); expect(host.querySelector('canvas')).toBeNull();
    expect(renderer().disposed).toBe(1); expect(renderer().lost).toBe(1);
  });

  it('handles synthetic context events once without duplicating resources or changing scene data', () => {
    const { host, handle } = mount(), fixture = scene([node('room')]), before = JSON.stringify(fixture);
    handle.update(fixture); dom.raf.step();
    const first = renderer(), canvas = host.querySelector('canvas')!;
    const lost = new dom.window.Event('webglcontextlost', { cancelable: true }); canvas.dispatchEvent(lost);
    expect(lost.defaultPrevented).toBe(true);
    expect(handle.stats()).toMatchObject({ state: 'fallback', reason: 'context lost', contextLosses: 1, pending: false });
    expect(handle.stats().surfaceIds).toEqual([]);
    handle.update(fixture); expect(dom.raf.pending()).toBe(0);
    canvas.dispatchEvent(new dom.window.Event('webglcontextrestored')); dom.raf.step();
    expect(evidence.renderers).toHaveLength(2); expect(first.disposed).toBe(1);
    expect(first.geometryDisposals).toBe(1); expect(first.materialDisposals).toBe(3);
    expect(handle.stats()).toMatchObject({ state: 'webgl', frames: 2, geometries: 1, materials: 3, contextLosses: 1 });
    canvas.dispatchEvent(new dom.window.Event('webglcontextlost', { cancelable: true }));
    canvas.dispatchEvent(new dom.window.Event('webglcontextrestored'));
    expect(handle.stats()).toMatchObject({ state: 'fallback', reason: 'context lost; reload to restore', contextLosses: 2 });
    expect(evidence.renderers).toHaveLength(2); expect(dom.raf.pending()).toBe(0);
    expect(JSON.stringify(fixture)).toBe(before);
  });

  it('balances ownership across 50 reopen/dispose cycles', () => {
    const add = vi.spyOn(document, 'addEventListener'), remove = vi.spyOn(document, 'removeEventListener');
    for (let i = 0; i < 50; i++) {
      const { host, handle } = mount(); handle.update(scene([node(`room-${i}`)])); dom.raf.step();
      handle.destroy(); host.remove();
      expect(dom.raf.pending()).toBe(0); expect(dom.timers.pending()).toBe(0);
    }
    const additions = add.mock.calls.filter(args => args[0] === 'visibilitychange');
    const removals = remove.mock.calls.filter(args => args[0] === 'visibilitychange');
    expect(additions).toHaveLength(50); expect(removals).toHaveLength(50);
    for (const [, listener] of additions) expect(removals.some(args => args[1] === listener)).toBe(true);
    expect(evidence.renderers).toHaveLength(50);
    for (const r of evidence.renderers) {
      expect(r.disposed).toBe(1); expect(r.lost).toBe(1);
      expect(r.geometryDisposals).toBe(1); expect(r.materialDisposals).toBe(3);
    }
    expect(document.querySelectorAll('canvas.ff-relief3d')).toHaveLength(0);
  });

  it('reports unavailable graphics without starting or retrying a renderer', () => {
    vi.mocked(dom.window.HTMLCanvasElement.prototype.getContext).mockReturnValue(null);
    const { host, handle } = mount(); handle.update(scene([node('room')])); dom.raf.step();
    expect(handle.stats()).toMatchObject({ state: 'fallback', reason: 'webgl2 unavailable', frames: 0, instances: 0, pending: false });
    expect(evidence.renderers).toHaveLength(0); expect(dom.raf.pending()).toBe(0);
    expect(host.querySelector('canvas')!.style.display).toBe('none');
    handle.update(scene([node('again')])); handle.setActive(true);
    expect(evidence.renderers).toHaveLength(0); expect(dom.raf.pending()).toBe(0);
  });

  it.each(['render', 'shader'] as const)('keeps %s failures explicit and never reports an unsuccessful frame as ready', kind => {
    evidence.failRender = kind === 'render'; evidence.failShader = kind === 'shader';
    const { host, handle } = mount(); handle.update(scene([node('room')])); dom.raf.step();
    expect(handle.stats().state).toBe('fallback'); expect(handle.stats().frames).toBe(0);
    expect(handle.stats().reason).toMatch(kind === 'render' ? /render failed/ : /shader compilation failed/);
    expect(host.querySelector('canvas')!.style.display).toBe('none');
    expect(handle.stats()).toMatchObject({ geometries: 0, materials: 0, instances: 0, surfaceIds: [] });
    expect(renderer().disposed).toBe(1); expect(renderer().lost).toBe(1);
    handle.update(scene([node('again')])); expect(dom.raf.pending()).toBe(0);
    handle.destroy(); expect(renderer().disposed).toBe(1);
  });

  it('releases every owner immediately after a terminal failure even if one vendor disposer throws', () => {
    const { host, handle } = mount(); handle.update(scene([node('room')])); dom.raf.step();
    const r = renderer();
    const geometry = [...r.geometries][0] as { dispose(): void };
    vi.spyOn(geometry, 'dispose').mockImplementation(() => { throw Error('synthetic disposal failure'); });
    evidence.failRender = true;
    handle.update(scene([node('room')])); dom.raf.step();
    expect(handle.stats()).toMatchObject({ state: 'fallback', geometries: 0, materials: 0, instances: 0, surfaceIds: [] });
    expect(r.materialDisposals).toBe(3); expect(r.disposed).toBe(1); expect(r.lost).toBe(1);
    const canvas = host.querySelector('canvas')!;
    canvas.dispatchEvent(new dom.window.Event('webglcontextlost', { cancelable: true }));
    canvas.dispatchEvent(new dom.window.Event('webglcontextrestored'));
    expect(evidence.renderers).toHaveLength(1);
    expect(handle.stats().reason).toMatch(/render failed/);
    expect(dom.raf.pending()).toBe(0);
  });

  it('transfers only successfully rendered semantic surfaces and restores them on graphics failure', () => {
    const host = document.createElement('div'); document.body.append(host);
    const view = mountScene(host, { graphics: true });
    try {
      view.update(scene([node('room'), node('employee', { x: 15, y: 15, width: 40, height: 40 }, 'employee')]));
      const room = host.querySelector<HTMLElement>('[data-node-id="room"]')!;
      const employee = host.querySelector<HTMLElement>('[data-node-id="employee"]')!;
      expect(room.dataset.gpuSurface).toBe('false');
      dom.raf.step();
      expect(room.dataset.gpuSurface).toBe('true');
      expect(employee.dataset.gpuSurface).toBe('false');
      evidence.failRender = true;
      view.setCamera({ ...DEFAULT_CAMERA, x: 1 }); dom.raf.step();
      expect(room.dataset.gpuSurface).toBe('false');
      expect(view.elements.root.dataset.graphics).toBe('fallback');
    } finally { view.destroy(); host.remove(); }
  });
});
