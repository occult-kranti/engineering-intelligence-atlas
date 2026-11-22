import { normalizeCamera, normalizeViewport, SCREEN_LIMIT } from './camera.457a3ca4fd1e3c65.js';
const DEG = Math.PI / 180;
const fin = (v, fallback) => typeof v === 'number' && Number.isFinite(v) ? v : fallback;
const cam = normalizeCamera;
const vp = normalizeViewport;
const bounded = (v) => Math.max(-SCREEN_LIMIT, Math.min(SCREEN_LIMIT, v));
/**
 * Projects a world point (CSS x right, y down, z = height toward viewer) to viewport pixels.
 * Mirrors: translate(w/2,h/2) perspective(d) rotateX(-pitch) rotateZ(yaw) scale(zoom) translate(-cx,-cy).
 * Height z scales with zoom like x/y. Returns screen coords plus the effective perspective denominator.
 */
export function projectReliefPoint(camera, viewport, p) {
    const c = cam(camera);
    const v = vp(viewport);
    const yaw = c.yaw * DEG;
    const pitch = c.pitch * DEG;
    const cy = Math.cos(yaw);
    const sy = Math.sin(yaw);
    const cp = Math.cos(pitch);
    const sp = Math.sin(pitch);
    // translate(-cx,-cy) then scale(zoom)
    const dx = (fin(p.x, 0) - c.x) * c.zoom;
    const dy = (fin(p.y, 0) - c.y) * c.zoom;
    const dz = fin(p.z, 0) * c.zoom;
    // rotateZ(yaw): CSS rotation, y down => x' = x cos - y sin, y' = x sin + y cos
    const rx = dx * cy - dy * sy;
    const ry = dx * sy + dy * cy;
    // rotateX(-pitch): CSS rotateX(a): y' = y cos a - z sin a, z' = y sin a + z cos a, with a = -pitch
    const ay = ry * cp + dz * sp;
    const az = -ry * sp + dz * cp;
    // CSS perspective(d): w = 1 - z/d (z toward viewer is positive). Clamp like the DOM ground path.
    const w = Math.max(0.05, 1 - az / c.distance);
    return {
        x: v.width / 2 + bounded(rx / w),
        y: v.height / 2 + bounded(ay / w),
        w,
    };
}
/** 4x4 column-major multiply: out = a * b. */
function mul(a, b) {
    const o = new Array(16).fill(0);
    for (let col = 0; col < 4; col++) {
        for (let row = 0; row < 4; row++) {
            let s = 0;
            for (let k = 0; k < 4; k++)
                s += a[k * 4 + row] * b[col * 4 + k];
            o[col * 4 + row] = s;
        }
    }
    return o;
}
/**
 * Returns Three-camera parameters and the scene group matrix (column-major for Matrix4.fromArray).
 * Three space is (worldX, -worldY, height). Group = Rx(pitch) * Rz(-yaw) * Scale(zoom) * Translate(-cx, +cy, 0).
 * The Three camera sits at (0,0,distance) looking down -z with up (0,1,0).
 */
export function reliefTransform(camera, viewport) {
    const c = cam(camera);
    const v = vp(viewport);
    const pitch = c.pitch * DEG;
    const yaw = c.yaw * DEG;
    const cp = Math.cos(pitch);
    const sp = Math.sin(pitch);
    const cy = Math.cos(yaw);
    const sy = Math.sin(yaw);
    // Rx(pitch), column-major
    const rx = [
        1, 0, 0, 0,
        0, cp, sp, 0,
        0, -sp, cp, 0,
        0, 0, 0, 1,
    ];
    // Rz(-yaw): rotation by -yaw about z, column-major
    const rz = [
        cy, -sy, 0, 0,
        sy, cy, 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1,
    ];
    const sc = [
        c.zoom, 0, 0, 0,
        0, c.zoom, 0, 0,
        0, 0, c.zoom, 0,
        0, 0, 0, 1,
    ];
    const tr = [
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        -c.x, c.y, 0, 1,
    ];
    const groupMatrix = mul(mul(mul(rx, rz), sc), tr);
    return {
        fov: 2 * Math.atan(v.height / (2 * c.distance)),
        aspect: v.width / v.height,
        distance: c.distance,
        groupMatrix,
    };
}
