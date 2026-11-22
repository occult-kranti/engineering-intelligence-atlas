// Claude Sonnet source d477db0c-77e3-46ae-b9d0-3bb690926d43; local review removed table geometry, repaired error cleanup and camera lifecycle.
import { THREE } from './vendor/three.c92b1ccf8e35bd65.js';
import { normalizeCamera, normalizeViewport, visibleRect, worldToScreen, isVisible } from './camera.457a3ca4fd1e3c65.js';
import { reliefTransform } from './relief-math.3adcdd7f5ef61da6.js';
const MAX_NODES = 240;
const MAX_INSTANCES = 2048;
const COORD_LIMIT = 1e7;
const DIM_LIMIT = 2e7;
const CAP = { slab: 256, floor: 512, wall: 1280 };
const ROOM_COLORS = ['#e6f0f8', '#e3f2ed', '#f8e9e3', '#eee8f7', '#f8f1df', '#eaf2e3'];
const NEUTRAL_FLOOR = '#eef3f4';
const PALETTE = {
    blueprint: { slab: '#f8f3e7', wall: '#526b86', contact: '#b8cad2', restricted: '#18233b', ambient: 0.82, sun: 0.55 },
    drafting: { slab: '#fffdfa', wall: '#56728a', contact: '#c4d1d5', restricted: '#2a3550', ambient: 0.9, sun: 0.4 },
};
function isFiniteRect(r) {
    if (!r)
        return false;
    const { x, y, width, height } = r;
    return (Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(width) && Number.isFinite(height) &&
        Math.abs(x) <= COORD_LIMIT && Math.abs(y) <= COORD_LIMIT &&
        Math.abs(x + width) <= COORD_LIMIT && Math.abs(y + height) <= COORD_LIMIT &&
        width > 0 && height > 0 && width <= DIM_LIMIT && height <= DIM_LIMIT);
}
function intersects(a, b) {
    return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}
function hash(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return h >>> 0;
}
function roomColor(node) {
    const dep = node.departmentId;
    if (typeof dep !== 'string' || dep.length === 0)
        return NEUTRAL_FLOOR;
    return ROOM_COLORS[hash(dep) % ROOM_COLORS.length];
}
function priority(n) {
    const md = n.metadata || {};
    if (md.companyFootprint === true)
        return 0;
    if (n.kind === 'office')
        return 1;
    if (n.kind === 'room')
        return 2;
    return 9;
}
function sanitizeReason(e) {
    const m = e instanceof Error ? e.message : String(e);
    return m.replace(/[^\w .:,()-]/g, '').slice(0, 120) || 'unknown';
}
/** Builds wall segments strictly inside the rect. Bottom wall (max world y) gets a 22px door gap near the right. */
function wallItems(r, color, height, out) {
    const x = r.x, y = r.y, w = r.width, h = r.height;
    const t = Math.min(2.4, w / 8, h / 8);
    if (!(t > 0))
        return;
    const z = 0.4;
    out.push({ bucket: 'wall', x, y, z, w, h: t, d: height, color }); // top edge
    out.push({ bucket: 'wall', x, y: y + t, z, w: t, h: h - 2 * t, d: height, color }); // left
    out.push({ bucket: 'wall', x: x + w - t, y: y + t, z, w: t, h: h - 2 * t, d: height, color }); // right
    const by = y + h - t;
    if (w > 80) {
        const gap = 22;
        const gapStart = x + w - t - 14 - gap; // door near right, inside right wall
        const leftLen = gapStart - (x + t);
        if (leftLen > 0)
            out.push({ bucket: 'wall', x: x + t, y: by, z, w: leftLen, h: t, d: height, color });
        const rightStart = gapStart + gap;
        const rightLen = x + w - t - rightStart;
        if (rightLen > 0)
            out.push({ bucket: 'wall', x: rightStart, y: by, z, w: rightLen, h: t, d: height, color });
    }
    else {
        out.push({ bucket: 'wall', x: x + t, y: by, z, w: w - 2 * t, h: t, d: height, color });
    }
}
export function mountRelief3D(host, onStats) {
    const st = {
        state: 'fallback', reason: 'init', frames: 0, geometries: 0, materials: 0,
        instances: 0, pending: false, drawCalls: 0, triangles: 0, contextLosses: 0, surfaceIds: [],
    };
    const snapshot = () => ({ ...st, surfaceIds: [...st.surfaceIds] });
    const emit = () => { if (onStats) {
        try {
            onStats(snapshot());
        }
        catch { /* consumer error ignored */ }
    } };
    let destroyed = false;
    let active = true;
    let theme = 'blueprint';
    let scene = null;
    let camera = normalizeCamera({});
    let viewport = normalizeViewport({ width: 1, height: 1 });
    let raf = 0;
    let selectionDirty = true;
    let canvas = null;
    let restoredOnce = false;
    let lost = false;
    let failed = false;
    let shaderFailed = false;
    let origin = { x: 0, y: 0 };
    let lastSize = '';
    let selectedSurfaceIds = [];
    // vendor-boundary objects
    let renderer = null;
    let threeScene = null;
    let threeCamera = null;
    let group = null;
    let ambient = null;
    let sun = null;
    let boxGeo = null;
    let mats = null;
    let meshes = null;
    let counts = { slab: 0, floor: 0, wall: 0 };
    let tmp = null;
    let tmpColor = null;
    const fail = (reason, retainForRestore = false) => {
        failed = true;
        st.state = 'fallback';
        st.reason = reason;
        st.pending = false;
        if (raf && typeof cancelAnimationFrame === 'function')
            cancelAnimationFrame(raf);
        raf = 0;
        if (canvas)
            canvas.style.display = 'none';
        st.surfaceIds = [];
        if (!retainForRestore) {
            lost = false;
            disposeGpu(true);
        }
        emit();
    };
    function buildGpu() {
        try {
            if (typeof document === 'undefined') {
                fail('no document');
                return false;
            }
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
            if (typeof window.WebGL2RenderingContext === 'undefined') {
                fail('webgl2 unavailable');
                return false;
            }
            const gl = canvas.getContext('webgl2', {
                alpha: true, antialias: true, depth: true, preserveDrawingBuffer: false, powerPreference: 'low-power',
            });
            if (!gl) {
                fail('webgl2 unavailable');
                return false;
            }
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
            // Face tint gives shallow partitions a quiet architectural edge without
            // shadow-map passes. Unlit drafting floors deliberately ignore these
            // vertex colors. The same one box geometry remains shared by every pool.
            const normals = boxGeo.getAttribute('normal');
            const colors = new Float32Array(normals.count * 3);
            for (let i = 0; i < normals.count; i++) {
                const shade = normals.getZ(i) > 0 ? 1 : normals.getX(i) > 0 ? 0.82 : normals.getY(i) < 0 ? 0.88 : 0.94;
                colors[i * 3] = shade;
                colors[i * 3 + 1] = shade;
                colors[i * 3 + 2] = shade;
            }
            boxGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
            // Drafting surfaces retain their specified color. Lighting belongs on the
            // shallow partitions; it must not turn readable ivory plans muddy grey.
            mats = {
                slab: new THREE.MeshBasicMaterial({ color: 0xffffff }),
                floor: new THREE.MeshBasicMaterial({ color: 0xffffff }),
                wall: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, metalness: 0, vertexColors: true }),
            };
            meshes = {};
            Object.keys(CAP).forEach((b) => {
                const m = new THREE.InstancedMesh(boxGeo, mats[b], CAP[b]);
                m.count = 0;
                m.frustumCulled = false;
                m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
                m.setColorAt(0, new THREE.Color('#ffffff'));
                group.add(m);
                meshes[b] = m;
            });
            tmp = new THREE.Object3D();
            tmpColor = new THREE.Color();
            st.geometries = 1;
            st.materials = 3;
            failed = false;
            shaderFailed = false;
            lastSize = '';
            selectionDirty = true;
            return true;
        }
        catch (e) {
            fail('init failed: ' + sanitizeReason(e));
            return false;
        }
    }
    function disposeGpu(releaseContext = false) {
        // One vendor cleanup failure must not prevent the other owners releasing.
        const release = (resource) => { try {
            resource?.dispose();
        }
        catch { /* best effort per resource */ } };
        if (meshes)
            Object.keys(meshes).forEach((b) => release(meshes[b]));
        release(boxGeo);
        if (mats)
            Object.keys(mats).forEach((b) => release(mats[b]));
        release(renderer);
        if (renderer && releaseContext) {
            try {
                renderer.forceContextLoss?.();
            }
            catch { /* context already gone */ }
        }
        renderer = null;
        threeScene = null;
        threeCamera = null;
        group = null;
        meshes = null;
        mats = null;
        boxGeo = null;
        ambient = null;
        sun = null;
        tmp = null;
        tmpColor = null;
        selectedSurfaceIds = [];
        counts = { slab: 0, floor: 0, wall: 0 };
        st.geometries = 0;
        st.materials = 0;
        st.instances = 0;
        st.surfaceIds = [];
        st.drawCalls = 0;
        st.triangles = 0;
    }
    function select() {
        const items = [];
        if (!scene || !Array.isArray(scene.nodes))
            return items;
        const view = visibleRect(camera, viewport, 160);
        const screen = { x: -160, y: -160, width: viewport.width + 320, height: viewport.height + 320 };
        const cands = [];
        for (const n of scene.nodes) {
            if (!n || !isFiniteRect(n.rect))
                continue;
            const md = n.metadata || {};
            const footprint = md.companyFootprint === true;
            if (!footprint && n.kind !== 'office' && n.kind !== 'room' && n.kind !== 'restricted')
                continue;
            if (!intersects(n.rect, view))
                continue;
            const r = n.rect;
            const corners = [{ x: r.x, y: r.y }, { x: r.x + r.width, y: r.y },
                { x: r.x + r.width, y: r.y + r.height }, { x: r.x, y: r.y + r.height }];
            const front = corners.map(p => isVisible(camera, viewport, p));
            if (!front.some(Boolean))
                continue;
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
            }
            else if (n.kind === 'office') {
                items.push({ nodeId: n.id, bucket: 'floor', x: r.x, y: r.y, z: -0.8, w: r.width, h: r.height, d: 0.8, color: roomColor(n) });
            }
            else if (n.kind === 'room') {
                // A contained contact band grounds the partitions, and the band visible
                // through their real doorway reads as its threshold. Two floor
                // instances per room remain within the 512-slot pool at MAX_NODES=240.
                const inset = Math.min(4.2, r.width / 8, r.height / 8);
                items.push({ nodeId: n.id, bucket: 'floor', x: r.x, y: r.y, z: 0, w: r.width, h: r.height, d: 0.32, color: p.contact });
                items.push({ bucket: 'floor', x: r.x + inset, y: r.y + inset, z: 0.32,
                    w: r.width - 2 * inset, h: r.height - 2 * inset, d: 0.08, color: roomColor(n) });
                wallItems(r, p.wall, 14, items);
            }
            else if (n.kind === 'restricted') {
                items.push({ nodeId: n.id, bucket: 'floor', x: r.x, y: r.y, z: 0, w: r.width, h: r.height, d: 0.4, color: p.restricted });
            }
        }
        return items;
    }
    function rebuildInstances() {
        if (!meshes || !tmp)
            return;
        const items = select();
        counts = { slab: 0, floor: 0, wall: 0 };
        selectedSurfaceIds = [];
        let total = 0;
        for (const it of items) {
            if (total >= MAX_INSTANCES)
                break;
            const b = it.bucket;
            if (counts[b] >= CAP[b])
                continue;
            const i = counts[b]++;
            total++;
            if (it.nodeId)
                selectedSurfaceIds.push(it.nodeId);
            // Three space: y is negated. Rect min corner (x,y) with height h occupies y in [y, y+h]; mirrored => [-(y+h), -y].
            tmp.position.set(it.x - origin.x, -(it.y + it.h - origin.y), it.z);
            tmp.scale.set(it.w, it.h, it.d);
            tmp.rotation.set(0, 0, 0);
            tmp.updateMatrix();
            meshes[b].setMatrixAt(i, tmp.matrix);
            tmpColor.set(it.color);
            meshes[b].setColorAt(i, tmpColor);
        }
        Object.keys(meshes).forEach((b) => {
            const m = meshes[b];
            m.count = counts[b];
            m.instanceMatrix.needsUpdate = true;
            if (m.instanceColor)
                m.instanceColor.needsUpdate = true;
        });
        st.instances = total;
        selectionDirty = false;
    }
    function applyTheme() {
        if (!mats)
            return;
        const p = PALETTE[theme];
        mats.slab.color.set('#ffffff');
        mats.floor.color.set('#ffffff');
        mats.wall.color.set('#ffffff');
        if (ambient)
            ambient.intensity = p.ambient;
        if (sun)
            sun.intensity = p.sun;
    }
    function frame() {
        raf = 0;
        st.pending = false;
        if (destroyed || !active || lost || failed || !renderer)
            return;
        if (typeof document !== 'undefined' && document.hidden)
            return;
        try {
            const t = reliefTransform({ ...camera, x: camera.x - origin.x, y: camera.y - origin.y }, viewport);
            const dpr = typeof window !== 'undefined' && window.devicePixelRatio ? window.devicePixelRatio : 1;
            const ratio = Math.max(0.5, Math.min(1.5, dpr));
            const sizeKey = `${viewport.width}|${viewport.height}|${ratio}`;
            if (sizeKey !== lastSize) {
                renderer.setPixelRatio(ratio);
                renderer.setSize(viewport.width, viewport.height, false);
                lastSize = sizeKey;
            }
            threeCamera.fov = (t.fov * 180) / Math.PI;
            threeCamera.aspect = t.aspect;
            threeCamera.position.set(0, 0, t.distance);
            threeCamera.lookAt(0, 0, 0);
            threeCamera.near = 1;
            threeCamera.far = 1e8;
            threeCamera.updateProjectionMatrix();
            group.matrix.fromArray(t.groupMatrix);
            group.matrixWorldNeedsUpdate = true;
            if (selectionDirty) {
                applyTheme();
                rebuildInstances();
            }
            renderer.render(threeScene, threeCamera);
            if (shaderFailed) {
                fail('shader compilation failed');
                return;
            }
            st.frames++;
            st.surfaceIds = selectedSurfaceIds;
            st.drawCalls = renderer.info.render.calls;
            st.triangles = renderer.info.render.triangles;
            if (st.state !== 'webgl') {
                st.state = 'webgl';
                st.reason = 'ok';
            }
            emit();
        }
        catch (e) {
            fail('render failed: ' + sanitizeReason(e));
        }
    }
    function schedule() {
        if (destroyed || !active || lost || failed || !renderer || raf)
            return;
        if (typeof requestAnimationFrame !== 'function') {
            fail('no requestAnimationFrame');
            return;
        }
        if (typeof document !== 'undefined' && document.hidden)
            return;
        st.pending = true;
        raf = requestAnimationFrame(frame);
        emit();
    }
    function onVisibility() {
        if (typeof document === 'undefined')
            return;
        if (document.hidden) {
            if (raf && typeof cancelAnimationFrame === 'function')
                cancelAnimationFrame(raf);
            raf = 0;
            st.pending = false;
            emit();
        }
        else {
            selectionDirty = true;
            schedule();
        }
    }
    function onLost(ev) {
        if (destroyed || (failed && !lost))
            return;
        ev.preventDefault();
        lost = true;
        st.contextLosses++;
        fail('context lost', true);
    }
    function onRestored() {
        if (destroyed || !lost)
            return;
        if (restoredOnce) {
            fail('context lost; reload to restore');
            return;
        }
        restoredOnce = true;
        disposeGpu();
        lost = false;
        if (buildGpu()) {
            selectionDirty = true;
            schedule();
        }
    }
    // ---- mount ----
    if (typeof document === 'undefined' || typeof window === 'undefined' || !host) {
        fail('no browser environment');
    }
    else {
        document.addEventListener('visibilitychange', onVisibility);
        buildGpu();
    }
    return {
        update(s) {
            if (destroyed)
                return;
            scene = s;
            selectionDirty = true;
            schedule();
        },
        setCamera(c, v) {
            if (destroyed)
                return;
            const nc = normalizeCamera(c);
            const nv = normalizeViewport(v);
            // selection only needs rebuild when the visible rect changes materially
            const prev = visibleRect(camera, viewport, 160);
            const next = visibleRect(nc, nv, 160);
            const moved = Math.abs(prev.x - next.x) > prev.width * 0.1 || Math.abs(prev.y - next.y) > prev.height * 0.1 ||
                Math.abs(prev.width - next.width) > prev.width * 0.1 || Math.abs(prev.height - next.height) > prev.height * 0.1;
            const nextOrigin = { x: Math.floor(nc.x / 4096) * 4096, y: Math.floor(nc.y / 4096) * 4096 };
            if (nextOrigin.x !== origin.x || nextOrigin.y !== origin.y) {
                origin = nextOrigin;
                selectionDirty = true;
            }
            camera = nc;
            viewport = nv;
            // Instance selection must follow cumulative movement, including slow pans.
            if (moved || scene)
                selectionDirty = true;
            schedule();
        },
        setTheme(t) {
            if (destroyed)
                return;
            theme = t === 'drafting' ? 'drafting' : 'blueprint';
            selectionDirty = true;
            schedule();
        },
        setActive(a) {
            if (destroyed)
                return;
            active = !!a;
            if (!active) {
                if (raf && typeof cancelAnimationFrame === 'function')
                    cancelAnimationFrame(raf);
                raf = 0;
                st.pending = false;
                emit();
            }
            else {
                selectionDirty = true;
                schedule();
            }
        },
        stats() { return snapshot(); },
        destroy() {
            if (destroyed)
                return;
            destroyed = true;
            if (raf && typeof cancelAnimationFrame === 'function')
                cancelAnimationFrame(raf);
            raf = 0;
            if (typeof document !== 'undefined')
                document.removeEventListener('visibilitychange', onVisibility);
            if (canvas) {
                canvas.removeEventListener('webglcontextlost', onLost, false);
                canvas.removeEventListener('webglcontextrestored', onRestored, false);
            }
            disposeGpu(true);
            if (canvas && canvas.parentNode === host)
                host.removeChild(canvas);
            canvas = null;
            scene = null;
            st.state = 'destroyed';
            st.reason = 'destroyed';
            st.pending = false;
            emit();
        },
    };
}
