// Pure Freeflow camera math. No DOM, storage or bridge access.
// World: 2D plane (x right, y down). Screen: CSS px, origin top-left of viewport.
// Projection chain (matches cameraTransform, transform-origin 0 0):
//   translate(vw/2, vh/2) perspective(d) rotateX(-pitch) rotate(yaw) scale(zoom) translate(-cx, -cy)
export const MIN_ZOOM = 0.02;
export const MAX_ZOOM = 8;
export const MAX_PITCH = 55;
export const MIN_DISTANCE = 400;
export const MAX_DISTANCE = 6000;
export const MAX_COORD = 1e7;
export const NEAR_FRACTION = 0.05;
export const SCREEN_LIMIT = 1e6;
export const DEFAULT_CAMERA = { x: 0, y: 0, zoom: 1, yaw: 0, pitch: 0, distance: 1800 };
const RAD = Math.PI / 180;
function num(v, fallback) {
    return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}
function clamp(v, lo, hi) {
    return v < lo ? lo : v > hi ? hi : v;
}
export function wrapDegrees(deg) {
    if (!Number.isFinite(deg))
        return 0;
    let d = deg % 360;
    if (d > 180)
        d -= 360;
    else if (d <= -180)
        d += 360;
    return d === 0 ? 0 : d;
}
export function normalizeViewport(viewport) {
    const w = num(viewport?.width, 1024);
    const h = num(viewport?.height, 768);
    return { width: w > 0 ? w : 1024, height: h > 0 ? h : 768 };
}
export function normalizeCamera(input) {
    const c = input ?? {};
    return {
        x: clamp(num(c.x, DEFAULT_CAMERA.x), -MAX_COORD, MAX_COORD),
        y: clamp(num(c.y, DEFAULT_CAMERA.y), -MAX_COORD, MAX_COORD),
        zoom: clamp(num(c.zoom, DEFAULT_CAMERA.zoom), MIN_ZOOM, MAX_ZOOM),
        yaw: wrapDegrees(num(c.yaw, DEFAULT_CAMERA.yaw)),
        pitch: clamp(num(c.pitch, DEFAULT_CAMERA.pitch), 0, MAX_PITCH),
        distance: clamp(num(c.distance, DEFAULT_CAMERA.distance), MIN_DISTANCE, MAX_DISTANCE),
    };
}
function local(cam, p) {
    const dx = (p.x - cam.x) * cam.zoom;
    const dy = (p.y - cam.y) * cam.zoom;
    const a = cam.yaw * RAD;
    const cos = Math.cos(a);
    const sin = Math.sin(a);
    return { x: dx * cos - dy * sin, y: dx * sin + dy * cos };
}
function project(cam, vp, p) {
    const l = local(cam, p);
    const t = cam.pitch * RAD;
    const y1 = l.y * Math.cos(t);
    const z = -l.y * Math.sin(t);
    const denom = 1 - z / cam.distance;
    const visible = denom > NEAR_FRACTION;
    const k = 1 / Math.max(denom, NEAR_FRACTION);
    return {
        x: vp.width / 2 + clamp(l.x * k, -SCREEN_LIMIT, SCREEN_LIMIT),
        y: vp.height / 2 + clamp(y1 * k, -SCREEN_LIMIT, SCREEN_LIMIT),
        visible,
    };
}
export function worldToScreen(camera, viewport, world) {
    const cam = normalizeCamera(camera);
    const p = project(cam, normalizeViewport(viewport), { x: num(world.x, 0), y: num(world.y, 0) });
    return { x: p.x, y: p.y };
}
export function isVisible(camera, viewport, world) {
    const cam = normalizeCamera(camera);
    return project(cam, normalizeViewport(viewport), { x: num(world.x, 0), y: num(world.y, 0) }).visible;
}
/** Screen -> world on the z=0 plane. Near-horizon rays are clamped to a finite far point. */
export function screenToWorld(camera, viewport, screen) {
    const cam = normalizeCamera(camera);
    const vp = normalizeViewport(viewport);
    const sx = num(screen.x, vp.width / 2) - vp.width / 2;
    const sy = num(screen.y, vp.height / 2) - vp.height / 2;
    const t = cam.pitch * RAD;
    const cos = Math.cos(t);
    const sin = Math.sin(t);
    let div = cos - (sy * sin) / cam.distance;
    if (div < 1e-9)
        div = 1e-9;
    const ly = clamp(sy / div, -SCREEN_LIMIT * 100, SCREEN_LIMIT * 100);
    const k = Math.max(1 + (ly * sin) / cam.distance, NEAR_FRACTION);
    const lx = clamp(sx * k, -SCREEN_LIMIT * 100, SCREEN_LIMIT * 100);
    const a = cam.yaw * RAD;
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    const dx = lx * ca + ly * sa;
    const dy = -lx * sa + ly * ca;
    return {
        x: clamp(cam.x + dx / cam.zoom, -MAX_COORD, MAX_COORD),
        y: clamp(cam.y + dy / cam.zoom, -MAX_COORD, MAX_COORD),
    };
}
/** Zoom by factor keeping the world point under screenPoint fixed. */
export function zoomAt(camera, viewport, screenPoint, factor) {
    const cam = normalizeCamera(camera);
    const vp = normalizeViewport(viewport);
    const f = Number.isFinite(factor) && factor > 0 ? factor : 1;
    const anchor = screenToWorld(cam, vp, screenPoint);
    const next = normalizeCamera({ ...cam, zoom: cam.zoom * f });
    const mid = screenToWorld(next, vp, screenPoint);
    return normalizeCamera({ ...next, x: next.x + (anchor.x - mid.x), y: next.y + (anchor.y - mid.y) });
}
function normalizeBounds(b) {
    let x = num(b?.x, 0);
    let y = num(b?.y, 0);
    let w = num(b?.width, 0);
    let h = num(b?.height, 0);
    if (w < 0) {
        x += w;
        w = -w;
    }
    if (h < 0) {
        y += h;
        h = -h;
    }
    return { x, y, width: Math.max(w, 1), height: Math.max(h, 1) };
}
function cornersOf(r) {
    return [
        { x: r.x, y: r.y },
        { x: r.x + r.width, y: r.y },
        { x: r.x + r.width, y: r.y + r.height },
        { x: r.x, y: r.y + r.height },
    ];
}
function extent(cam, vp, cs) {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, visible = true;
    for (const c of cs) {
        const p = project(cam, vp, c);
        if (!p.visible)
            visible = false;
        if (p.x < minX)
            minX = p.x;
        if (p.x > maxX)
            maxX = p.x;
        if (p.y < minY)
            minY = p.y;
        if (p.y > maxY)
            maxY = p.y;
    }
    return { minX, maxX, minY, maxY, visible };
}
// Recenter so the projected corner box is centered in the viewport. Moving the camera center
// along the plane moves content opposite, so we apply the world delta of (box mid -> screen center).
// The shift is solved by fixed-point iteration with a Newton-like Jacobian estimate for robustness.
function recenter(cam0, vp, cs) {
    let cam = cam0;
    for (let i = 0; i < 40; i++) {
        const e = extent(cam, vp, cs);
        const ex = (e.minX + e.maxX) / 2 - vp.width / 2;
        const ey = (e.minY + e.maxY) / 2 - vp.height / 2;
        if (Math.abs(ex) < 1e-7 && Math.abs(ey) < 1e-7)
            break;
        // Box mid is off-center by (ex,ey): the world point now at screen center is where the camera
        // looks; we want the camera to look at the world point currently under the box mid.
        const target = screenToWorld(cam, vp, { x: vp.width / 2 + ex, y: vp.height / 2 + ey });
        const here = screenToWorld(cam, vp, { x: vp.width / 2, y: vp.height / 2 });
        cam = normalizeCamera({ ...cam, x: cam.x + (target.x - here.x) * 0.9, y: cam.y + (target.y - here.y) * 0.9 });
    }
    return cam;
}
function fitsAt(base, vp, cs, center, zoom, pad) {
    const cam = recenter(normalizeCamera({ ...base, x: center.x, y: center.y, zoom }), vp, cs);
    const e = extent(cam, vp, cs);
    const eps = 0.01;
    const ok = e.visible && e.minX >= pad - eps && e.maxX <= vp.width - pad + eps && e.minY >= pad - eps && e.maxY <= vp.height - pad + eps;
    return ok ? cam : null;
}
/**
 * Fit bounds in viewport with padding. Binary-searches the largest zoom whose recentered camera
 * (the exact camera returned) keeps all 4 projected corners inside the padded area. If even
 * MIN_ZOOM cannot fit, returns the MIN_ZOOM recentered camera (best effort).
 */
export function fitBounds(camera, viewport, bounds, padding = 48) {
    const base = normalizeCamera(camera);
    const vp = normalizeViewport(viewport);
    const r = normalizeBounds(bounds);
    const pad = clamp(num(padding, 48), 0, Math.min(vp.width, vp.height) / 2 - 1);
    const cs = cornersOf(r);
    const center = { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    let best = fitsAt(base, vp, cs, center, MIN_ZOOM, pad);
    if (!best)
        return recenter(normalizeCamera({ ...base, x: center.x, y: center.y, zoom: MIN_ZOOM }), vp, cs);
    const top = fitsAt(base, vp, cs, center, MAX_ZOOM, pad);
    if (top)
        return top;
    let lo = MIN_ZOOM;
    let hi = MAX_ZOOM;
    for (let i = 0; i < 40; i++) {
        const mid = (lo + hi) / 2;
        const c = fitsAt(base, vp, cs, center, mid, pad);
        if (c) {
            lo = mid;
            best = c;
        }
        else
            hi = mid;
    }
    return best;
}
function fmt(n) {
    return (Math.round(n * 1e6) / 1e6).toString();
}
/** CSS transform for a transform-origin 0 0 world element; matches worldToScreen for points in front of the eye. */
export function cameraTransform(camera, viewport) {
    const cam = normalizeCamera(camera);
    const vp = normalizeViewport(viewport);
    const parts = [`translate(${fmt(vp.width / 2)}px, ${fmt(vp.height / 2)}px)`];
    if (cam.pitch > 0)
        parts.push(`perspective(${fmt(cam.distance)}px)`, `rotateX(${fmt(-cam.pitch)}deg)`);
    if (cam.yaw !== 0)
        parts.push(`rotate(${fmt(cam.yaw)}deg)`);
    parts.push(`scale(${fmt(cam.zoom)})`, `translate(${fmt(-cam.x)}px, ${fmt(-cam.y)}px)`);
    return parts.join(' ');
}
/**
 * Conservative finite world rect covering everything that can appear on screen. If the viewport
 * (grown by margin) reaches the horizon (div<=small), rays are unbounded, so fall back to the
 * full supported world range; otherwise the four corner rays bound the visible quadrilateral.
 */
export function visibleRect(camera, viewport, margin = 64) {
    const cam = normalizeCamera(camera);
    const vp = normalizeViewport(viewport);
    const m = Math.max(0, num(margin, 64));
    const t = cam.pitch * RAD;
    const sin = Math.sin(t);
    const cos = Math.cos(t);
    const maxSy = vp.height / 2 + m;
    // Ray from top edge hits plane only while cos - sy*sin/d > guard (sy is offset from center, downward positive).
    // Points deeper than this bound on the lower side approach the near plane; keep a safe 0.1 margin.
    const lowerDiv = cos - (maxSy * sin) / cam.distance;
    // The sampled corners are conservative only when every rays' denominator stays comfortably positive.
    const guarded = cam.pitch > 0 && lowerDiv < 0.1;
    if (guarded) {
        return { x: -MAX_COORD, y: -MAX_COORD, width: 2 * MAX_COORD, height: 2 * MAX_COORD };
    }
    const pts = [
        { x: -m, y: -m },
        { x: vp.width + m, y: -m },
        { x: vp.width + m, y: vp.height + m },
        { x: -m, y: vp.height + m },
    ].map((s) => screenToWorld(cam, vp, s));
    const minX = Math.min(...pts.map((p) => p.x));
    const maxX = Math.max(...pts.map((p) => p.x));
    const minY = Math.min(...pts.map((p) => p.y));
    const maxY = Math.max(...pts.map((p) => p.y));
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}
export function easeSpring(t) {
    if (!Number.isFinite(t) || t <= 0)
        return 0;
    if (t >= 1)
        return 1;
    const k = 7;
    const raw = 1 - (1 + k * t) * Math.exp(-k * t);
    const end = 1 - (1 + k) * Math.exp(-k);
    return clamp(raw / end, 0, 1);
}
export function interpolateCamera(from, to, t) {
    const a = normalizeCamera(from);
    const b = normalizeCamera(to);
    if (!Number.isFinite(t) || t <= 0)
        return a;
    if (t >= 1)
        return b;
    const dyaw = wrapDegrees(b.yaw - a.yaw);
    return normalizeCamera({
        x: a.x + (b.x - a.x) * t,
        y: a.y + (b.y - a.y) * t,
        zoom: a.zoom * Math.pow(b.zoom / a.zoom, t),
        yaw: a.yaw + dyaw * t,
        pitch: a.pitch + (b.pitch - a.pitch) * t,
        distance: a.distance + (b.distance - a.distance) * t,
    });
}
