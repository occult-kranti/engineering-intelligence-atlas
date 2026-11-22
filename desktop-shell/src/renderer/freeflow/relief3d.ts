// Claude Sonnet source d477db0c-77e3-46ae-b9d0-3bb690926d43; local review removed table geometry, repaired error cleanup and camera lifecycle.
import { THREE } from './vendor/three.js';
import { normalizeCamera, normalizeViewport, visibleRect, worldToScreen, isVisible, type Camera, type Size, type Rect } from './camera.js';
import type { FreeflowScene, SceneNode } from './model.js';
import { reliefTransform } from './relief-math.js';

export interface ReliefStats {
  state: 'webgl' | 'fallback' | 'destroyed';
  reason: string;
  frames: number;
  geometries: number;
  materials: number;
  instances: number;
  pending: boolean;
  drawCalls: number;
  triangles: number;
  contextLosses: number;
  /** Semantic surfaces covered by the last successful GPU frame. */
  surfaceIds: readonly string[];
}

export interface ReliefHandle {
  update(scene: FreeflowScene | null): void;
  setCamera(camera: Camera, viewport: Size): void;
  setTheme(theme: 'blueprint' | 'drafting'): void;
  setActive(active: boolean): void;
  stats(): ReliefStats;
  destroy(): void;
}

type Theme = 'blueprint' | 'drafting';
type Bucket = 'slab' | 'floor' | 'wall';

const MAX_NODES = 240;
const MAX_INSTANCES = 2048;
const COORD_LIMIT = 1e7;
const DIM_LIMIT = 2e7;
const CAP: Record<Bucket, number> = { slab: 256, floor: 512, wall: 1280 };

const ROOM_COLORS = ['#e6f0f8', '#e3f2ed', '#f8e9e3', '#eee8f7', '#f8f1df', '#eaf2e3'];
const NEUTRAL_FLOOR = '#eef3f4';

const PALETTE: Record<Theme, { slab: string; wall: string; restricted: string; ambient: number; sun: number }> = {
  blueprint: { slab: '#f8f3e7', wall: '#526b86', restricted: '#18233b', ambient: 0.82, sun: 0.55 },
  drafting: { slab: '#fffdfa', wall: '#56728a', restricted: '#2a3550', ambient: 0.9, sun: 0.4 },
};

interface Item {
  nodeId?: string;
  bucket: Bucket;
  x: number; y: number; z: number; // world rect min corner + base height
  w: number; h: number; d: number; // size in world x, world y, height
  color: string;
}

function isFiniteRect(r: Rect | undefined): r is Rect {
  if (!r) return false;
  const { x, y, width, height } = r as { x: number; y: number; width: number; height: number };
  return (
    Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(width) && Number.isFinite(height) &&
    Math.abs(x) <= COORD_LIMIT && Math.abs(y) <= COORD_LIMIT &&
    Math.abs(x + width) <= COORD_LIMIT && Math.abs(y + height) <= COORD_LIMIT &&
    width > 0 && height > 0 && width <= DIM_LIMIT && height <= DIM_LIMIT
  );
}

function intersects(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

function roomColor(node: SceneNode): string {
  const dep = node.departmentId;
  if (typeof dep !== 'string' || dep.length === 0) return NEUTRAL_FLOOR;
  return ROOM_COLORS[hash(dep) % ROOM_COLORS.length]!;
}

function priority(n: SceneNode): number {
  const md = n.metadata || {};
  if (md.companyFootprint === true) return 0;
  if (n.kind === 'office') return 1;
  if (n.kind === 'room') return 2;
  return 9;
}

function sanitizeReason(e: unknown): string {
  const m = e instanceof Error ? e.message : String(e);
  return m.replace(/[^\w .:,()-]/g, '').slice(0, 120) || 'unknown';
}

/** Builds wall segments strictly inside the rect. Bottom wall (max world y) gets a 22px door gap near the right. */
function wallItems(r: Rect, color: string, height: number, out: Item[]): void {
  const x = r.x, y = r.y, w = r.width, h = r.height;
  const t = Math.min(2.4, w / 8, h / 8);
  if (!(t > 0)) return;
  const z = 0.4;
  out.push({ bucket: 'wall', x, y, z, w, h: t, d: height, color }); // top edge
  out.push({ bucket: 'wall', x, y: y + t, z, w: t, h: h - 2 * t, d: height, color }); // left
  out.push({ bucket: 'wall', x: x + w - t, y: y + t, z, w: t, h: h - 2 * t, d: height, color }); // right
  const by = y + h - t;
  if (w > 80) {
    const gap = 22;
    const gapStart = x + w - t - 14 - gap; // door near right, inside right wall
    const leftLen = gapStart - (x + t);
    if (leftLen > 0) out.push({ bucket: 'wall', x: x + t, y: by, z, w: leftLen, h: t, d: height, color });
    const rightStart = gapStart + gap;
    const rightLen = x + w - t - rightStart;
    if (rightLen > 0) out.push({ bucket: 'wall', x: rightStart, y: by, z, w: rightLen, h: t, d: height, color });
  } else {
    out.push({ bucket: 'wall', x: x + t, y: by, z, w: w - 2 * t, h: t, d: height, color });
  }
}

export function mountRelief3D(host: HTMLElement, onStats?: (s: ReliefStats) => void): ReliefHandle {
  const st: ReliefStats = {
    state: 'fallback', reason: 'init', frames: 0, geometries: 0, materials: 0,
    instances: 0, pending: false, drawCalls: 0, triangles: 0, contextLosses: 0, surfaceIds: [],
  };
  const snapshot = (): ReliefStats => ({ ...st, surfaceIds: [...st.surfaceIds] });
  const emit = (): void => { if (onStats) { try { onStats(snapshot()); } catch { /* consumer error ignored */ } } };

  let destroyed = false;
  let active = true;
  let theme: Theme = 'blueprint';
  let scene: FreeflowScene | null = null;
  let camera: Camera = normalizeCamera({} as Camera);
  let viewport: Size = normalizeViewport({ width: 1, height: 1 } as Size);
  let raf = 0;
  let selectionDirty = true;
  let canvas: HTMLCanvasElement | null = null;
  let restoredOnce = false;
  let lost = false;
  let failed = false;
  let shaderFailed = false;
  let origin = { x: 0, y: 0 };
  let lastSize = '';
  let selectedSurfaceIds: string[] = [];

  // vendor-boundary objects
  let renderer: any = null;
  let threeScene: any = null;
  let threeCamera: any = null;
  let group: any = null;
  let ambient: any = null;
  let sun: any = null;
  let boxGeo: any = null;
  let mats: Record<Bucket, any> | null = null;
  let meshes: Record<Bucket, any> | null = null;
  let counts: Record<Bucket, number> = { slab: 0, floor: 0, wall: 0 };
  let tmp: any = null;
  let tmpColor: any = null;

  const fail = (reason: string, retainForRestore = false): void => {
    failed = true;
    st.state = 'fallback';
    st.reason = reason;
    st.pending = false;
    if (raf && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(raf);
    raf = 0;
    if (canvas) canvas.style.display = 'none';
    st.surfaceIds = [];
    if (!retainForRestore) { lost = false; disposeGpu(true); }
    emit();
  };

  function buildGpu(): boolean {
    try {
      if (typeof document === 'undefined') { fail('no document'); return false; }
      if (!canvas) {
        canvas = document.createElement('canvas');
        canvas.className = 'ff-relief3d';
        canvas.setAttribute('aria-hidden', 'true');
        canvas.style.cssText = 'position:absolute;inset:0;pointer-events:none;width:100%;height:100%;z-index:0;';
        host.appendChild(canvas);
        canvas.addEventListener('webglcontextlost', onLost, false);
        canvas.addEventListener('webglcontextrestored', onRestored, false);
      }
      canvas.style.display = '';
      if (typeof window.WebGL2RenderingContext === 'undefined') { fail('webgl2 unavailable'); return false; }
      const gl = canvas.getContext('webgl2', {
        alpha: true, antialias: true, depth: true, preserveDrawingBuffer: false, powerPreference: 'low-power',
      });
      if (!gl) { fail('webgl2 unavailable'); return false; }
      renderer = new THREE.WebGLRenderer({ canvas, context: gl, alpha: true, antialias: true });
      renderer.debug.onShaderError = () => { shaderFailed = true; };
      renderer.setClearColor(0x000000, 0);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      threeScene = new THREE.Scene();
      threeCamera = new THREE.PerspectiveCamera(45, 1, 1, 1e8);
      threeCamera.up.set(0, 1, 0);
      group = new THREE.Group();
      group.matrixAutoUpdate = false;
      threeScene.add(group);
      ambient = new THREE.AmbientLight(0xffffff, 0.8);
      sun = new THREE.DirectionalLight(0xffffff, 0.5);
      sun.position.set(-400, 600, 900);
      threeScene.add(ambient);
      threeScene.add(sun);
      boxGeo = new THREE.BoxGeometry(1, 1, 1);
      boxGeo.translate(0.5, 0.5, 0.5); // unit box with min corner at origin
      // Drafting surfaces retain their specified color. Lighting belongs on the
      // shallow partitions; it must not turn readable ivory plans muddy grey.
      mats = {
        slab: new THREE.MeshBasicMaterial({ color: 0xffffff }),
        floor: new THREE.MeshBasicMaterial({ color: 0xffffff }),
        wall: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, metalness: 0 }),
      };
      meshes = {} as Record<Bucket, any>;
      (Object.keys(CAP) as Bucket[]).forEach((b) => {
        const m = new THREE.InstancedMesh(boxGeo, mats![b], CAP[b]);
        m.count = 0;
        m.frustumCulled = false;
        m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        m.setColorAt(0, new THREE.Color('#ffffff'));
        group.add(m);
        meshes![b] = m;
      });
      tmp = new THREE.Object3D();
      tmpColor = new THREE.Color();
      st.geometries = 1;
      st.materials = 3;
      failed = false; shaderFailed = false; lastSize = '';
      selectionDirty = true;
      return true;
    } catch (e) {
      fail('init failed: ' + sanitizeReason(e));
      return false;
    }
  }

  function disposeGpu(releaseContext = false): void {
    // One vendor cleanup failure must not prevent the other owners releasing.
    const release = (resource: any): void => { try { resource?.dispose(); } catch { /* best effort per resource */ } };
    if (meshes) (Object.keys(meshes) as Bucket[]).forEach((b) => release(meshes![b]));
    release(boxGeo);
    if (mats) (Object.keys(mats) as Bucket[]).forEach((b) => release(mats![b]));
    release(renderer);
    if (renderer && releaseContext) { try { renderer.forceContextLoss?.(); } catch { /* context already gone */ } }
    renderer = null; threeScene = null; threeCamera = null; group = null; meshes = null; mats = null;
    boxGeo = null; ambient = null; sun = null; tmp = null; tmpColor = null;
    selectedSurfaceIds = []; counts = { slab: 0, floor: 0, wall: 0 };
    st.geometries = 0; st.materials = 0; st.instances = 0; st.surfaceIds = [];
    st.drawCalls = 0; st.triangles = 0;
  }

  function select(): Item[] {
    const items: Item[] = [];
    if (!scene || !Array.isArray(scene.nodes)) return items;
    const view = visibleRect(camera, viewport, 160);
    const screen = { x: -160, y: -160, width: viewport.width + 320, height: viewport.height + 320 };
    const cands: Array<{ node: SceneNode; onScreen: boolean; distance: number }> = [];
    for (const n of scene.nodes) {
      if (!n || !isFiniteRect(n.rect)) continue;
      const md = n.metadata || {};
      const footprint = md.companyFootprint === true;
      if (!footprint && n.kind !== 'office' && n.kind !== 'room' && n.kind !== 'restricted') continue;
      if (!intersects(n.rect, view)) continue;
      const r = n.rect;
      const corners = [{ x: r.x, y: r.y }, { x: r.x + r.width, y: r.y },
        { x: r.x + r.width, y: r.y + r.height }, { x: r.x, y: r.y + r.height }];
      const front = corners.map(p => isVisible(camera, viewport, p));
      if (!front.some(Boolean)) continue;
      const points = corners.map(p => worldToScreen(camera, viewport, p));
      const minX = Math.min(...points.map(p => p.x)), minY = Math.min(...points.map(p => p.y));
      const projected = { x: minX, y: minY, width: Math.max(...points.map(p => p.x)) - minX,
        height: Math.max(...points.map(p => p.y)) - minY };
      // A rectangle crossing the near plane remains a conservative candidate.
      const onScreen = !front.every(Boolean) || intersects(projected, screen);
      const dx = Math.max(r.x - camera.x, 0, camera.x - r.x - r.width);
      const dy = Math.max(r.y - camera.y, 0, camera.y - r.y - r.height);
      cands.push({ node: n, onScreen, distance: dx * dx + dy * dy });
    }
    // The horizon fallback spans the world. Spend the fixed budget on the
    // actual viewport and nearby geometry, not the first companies in storage.
    cands.sort((a, b) => Number(b.onScreen) - Number(a.onScreen) || a.distance - b.distance
      || priority(a.node) - priority(b.node) || a.node.id.localeCompare(b.node.id));
    const chosen = cands.slice(0, MAX_NODES);
    const p = PALETTE[theme];
    for (const { node: n } of chosen) {
      const r = n.rect;
      const md = n.metadata || {};
      if (md.companyFootprint === true) {
        items.push({ nodeId: n.id, bucket: 'slab', x: r.x, y: r.y, z: -1.2, w: r.width, h: r.height, d: 1.2, color: p.slab });
        wallItems(r, p.wall, 7, items);
      } else if (n.kind === 'office') {
        items.push({ nodeId: n.id, bucket: 'floor', x: r.x, y: r.y, z: -0.8, w: r.width, h: r.height, d: 0.8, color: roomColor(n) });
      } else if (n.kind === 'room') {
        items.push({ nodeId: n.id, bucket: 'floor', x: r.x, y: r.y, z: 0, w: r.width, h: r.height, d: 0.4, color: roomColor(n) });
        wallItems(r, p.wall, 14, items);
      } else if (n.kind === 'restricted') {
        items.push({ nodeId: n.id, bucket: 'floor', x: r.x, y: r.y, z: 0, w: r.width, h: r.height, d: 0.4, color: p.restricted });
      }
    }
    return items;
  }

  function rebuildInstances(): void {
    if (!meshes || !tmp) return;
    const items = select();
    counts = { slab: 0, floor: 0, wall: 0 };
    selectedSurfaceIds = [];
    let total = 0;
    for (const it of items) {
      if (total >= MAX_INSTANCES) break;
      const b = it.bucket;
      if (counts[b] >= CAP[b]) continue;
      const i = counts[b]++;
      total++;
      if (it.nodeId) selectedSurfaceIds.push(it.nodeId);
      // Three space: y is negated. Rect min corner (x,y) with height h occupies y in [y, y+h]; mirrored => [-(y+h), -y].
      tmp.position.set(it.x - origin.x, -(it.y + it.h - origin.y), it.z);
      tmp.scale.set(it.w, it.h, it.d);
      tmp.rotation.set(0, 0, 0);
      tmp.updateMatrix();
      meshes[b].setMatrixAt(i, tmp.matrix);
      tmpColor.set(it.color);
      meshes[b].setColorAt(i, tmpColor);
    }
    (Object.keys(meshes) as Bucket[]).forEach((b) => {
      const m = meshes![b];
      m.count = counts[b];
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    });
    st.instances = total;
    selectionDirty = false;
  }

  function applyTheme(): void {
    if (!mats) return;
    const p = PALETTE[theme];
    mats.slab.color.set('#ffffff');
    mats.floor.color.set('#ffffff');
    mats.wall.color.set('#ffffff');
    if (ambient) ambient.intensity = p.ambient;
    if (sun) sun.intensity = p.sun;
  }

  function frame(): void {
    raf = 0;
    st.pending = false;
    if (destroyed || !active || lost || failed || !renderer) return;
    if (typeof document !== 'undefined' && document.hidden) return;
    try {
      const t = reliefTransform({ ...camera, x: camera.x - origin.x, y: camera.y - origin.y }, viewport);
      const dpr = typeof window !== 'undefined' && window.devicePixelRatio ? window.devicePixelRatio : 1;
      const ratio = Math.max(0.5, Math.min(1.5, dpr));
      const sizeKey = `${viewport.width}|${viewport.height}|${ratio}`;
      if (sizeKey !== lastSize) { renderer.setPixelRatio(ratio); renderer.setSize(viewport.width, viewport.height, false); lastSize = sizeKey; }
      threeCamera.fov = (t.fov * 180) / Math.PI;
      threeCamera.aspect = t.aspect;
      threeCamera.position.set(0, 0, t.distance);
      threeCamera.lookAt(0, 0, 0);
      threeCamera.near = 1;
      threeCamera.far = 1e8;
      threeCamera.updateProjectionMatrix();
      group.matrix.fromArray(t.groupMatrix);
      group.matrixWorldNeedsUpdate = true;
      if (selectionDirty) { applyTheme(); rebuildInstances(); }
      renderer.render(threeScene, threeCamera);
      if (shaderFailed) { fail('shader compilation failed'); return; }
      st.frames++;
      st.surfaceIds = selectedSurfaceIds;
      st.drawCalls = renderer.info.render.calls;
      st.triangles = renderer.info.render.triangles;
      if (st.state !== 'webgl') { st.state = 'webgl'; st.reason = 'ok'; }
      emit();
    } catch (e) {
      fail('render failed: ' + sanitizeReason(e));
    }
  }

  function schedule(): void {
    if (destroyed || !active || lost || failed || !renderer || raf) return;
    if (typeof requestAnimationFrame !== 'function') { fail('no requestAnimationFrame'); return; }
    if (typeof document !== 'undefined' && document.hidden) return;
    st.pending = true;
    raf = requestAnimationFrame(frame);
    emit();
  }

  function onVisibility(): void {
    if (typeof document === 'undefined') return;
    if (document.hidden) {
      if (raf && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(raf);
      raf = 0; st.pending = false; emit();
    } else {
      selectionDirty = true;
      schedule();
    }
  }

  function onLost(ev: Event): void {
    if (destroyed || (failed && !lost)) return;
    ev.preventDefault();
    lost = true;
    st.contextLosses++;
    fail('context lost', true);
  }

  function onRestored(): void {
    if (destroyed || !lost) return;
    if (restoredOnce) { fail('context lost; reload to restore'); return; }
    restoredOnce = true;
    disposeGpu();
    lost = false;
    if (buildGpu()) { selectionDirty = true; schedule(); }
  }

  // ---- mount ----
  if (typeof document === 'undefined' || typeof window === 'undefined' || !host) {
    fail('no browser environment');
  } else {
    document.addEventListener('visibilitychange', onVisibility);
    buildGpu();
  }

  return {
    update(s: FreeflowScene | null): void {
      if (destroyed) return;
      scene = s;
      selectionDirty = true;
      schedule();
    },
    setCamera(c: Camera, v: Size): void {
      if (destroyed) return;
      const nc = normalizeCamera(c);
      const nv = normalizeViewport(v);
      // selection only needs rebuild when the visible rect changes materially
      const prev = visibleRect(camera, viewport, 160);
      const next = visibleRect(nc, nv, 160);
      const moved =
        Math.abs(prev.x - next.x) > prev.width * 0.1 || Math.abs(prev.y - next.y) > prev.height * 0.1 ||
        Math.abs(prev.width - next.width) > prev.width * 0.1 || Math.abs(prev.height - next.height) > prev.height * 0.1;
      const nextOrigin = { x: Math.floor(nc.x / 4096) * 4096, y: Math.floor(nc.y / 4096) * 4096 };
      if (nextOrigin.x !== origin.x || nextOrigin.y !== origin.y) { origin = nextOrigin; selectionDirty = true; }
      camera = nc; viewport = nv;
      // Instance selection must follow cumulative movement, including slow pans.
      if (moved || scene) selectionDirty = true;
      schedule();
    },
    setTheme(t: Theme): void {
      if (destroyed) return;
      theme = t === 'drafting' ? 'drafting' : 'blueprint';
      selectionDirty = true;
      schedule();
    },
    setActive(a: boolean): void {
      if (destroyed) return;
      active = !!a;
      if (!active) {
        if (raf && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(raf);
        raf = 0; st.pending = false; emit();
      } else {
        selectionDirty = true;
        schedule();
      }
    },
    stats(): ReliefStats { return snapshot(); },
    destroy(): void {
      if (destroyed) return;
      destroyed = true;
      if (raf && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(raf);
      raf = 0;
      if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVisibility);
      if (canvas) {
        canvas.removeEventListener('webglcontextlost', onLost, false);
        canvas.removeEventListener('webglcontextrestored', onRestored, false);
      }
      disposeGpu(true);
      if (canvas && canvas.parentNode === host) host.removeChild(canvas);
      canvas = null;
      scene = null;
      st.state = 'destroyed'; st.reason = 'destroyed'; st.pending = false;
      emit();
    },
  };
}
