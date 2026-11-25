// View-only state for the endless workspace. These records describe panel geometry and
// presentation; they never contain form values, office state, credentials or permissions.
import { MAX_COORD, DEFAULT_CAMERA, fitBounds, interpolateCamera, normalizeCamera, normalizeViewport, screenToWorld, visibleRect, worldToScreen, } from './camera.457a3ca4fd1e3c65.js';
export const WORKSPACE_VERSION = 1;
export const MAX_CANVAS_PANELS = 48;
export const MAX_WORKSPACE_BYTES = 65_536;
export const PANEL_TITLE_HEIGHT = 48;
export const CANVAS_CAMERA_DURATION = 380;
const DEFAULT_RECT = { x: 0, y: 0, width: 840, height: 640 };
const ID = /^[a-zA-Z0-9][a-zA-Z0-9:_.-]{0,95}$/;
const FORBIDDEN_IDS = new Set(['__proto__', 'constructor', 'prototype']);
const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k) ? o[k] : undefined;
function record(v) {
    if (!v || typeof v !== 'object' || Array.isArray(v))
        return null;
    const p = Object.getPrototypeOf(v);
    return p === Object.prototype || p === null ? v : null;
}
function finite(v, fallback) { return typeof v === 'number' && Number.isFinite(v) ? v : fallback; }
function clamp(v, low, high) { return Math.min(high, Math.max(low, v)); }
function sameRect(a, b) { return a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height; }
function validId(id) { return typeof id === 'string' && ID.test(id) && !FORBIDDEN_IDS.has(id); }
/** Normalize only known geometry fields; prototype/inherited fields are never preferences. */
export function normalizePanelRect(value, spec) {
    const raw = record(value) ?? {};
    const fallback = record(spec?.rect) ?? DEFAULT_RECT;
    const minWidth = clamp(finite(spec?.minWidth, 280), 160, 4096);
    const minHeight = clamp(finite(spec?.minHeight, 180), PANEL_TITLE_HEIGHT, 4096);
    const maxWidth = clamp(finite(spec?.maxWidth, 2400), minWidth, 8192);
    const maxHeight = clamp(finite(spec?.maxHeight, 2400), minHeight, 8192);
    const width = clamp(finite(own(raw, 'width'), finite(fallback.width, DEFAULT_RECT.width)), minWidth, maxWidth);
    const height = clamp(finite(own(raw, 'height'), finite(fallback.height, DEFAULT_RECT.height)), minHeight, maxHeight);
    return {
        x: clamp(finite(own(raw, 'x'), finite(fallback.x, 0)), -MAX_COORD, MAX_COORD - width),
        y: clamp(finite(own(raw, 'y'), finite(fallback.y, 0)), -MAX_COORD, MAX_COORD - height),
        width, height,
    };
}
function admittedSpecs(specs) {
    const result = [];
    const ids = new Set();
    for (const spec of specs) {
        if (result.length === MAX_CANVAS_PANELS)
            break;
        if (!spec || !validId(spec.id) || ids.has(spec.id))
            continue;
        ids.add(spec.id);
        result.push(spec);
    }
    return result;
}
/** Unregistered IDs are dropped. Every registered panel remains reachable after corrupt storage. */
export function normalizeWorkspaceState(value, specs) {
    const admitted = admittedSpecs(specs);
    const raw = record(value);
    const source = raw && own(raw, 'version') === WORKSPACE_VERSION ? raw : null;
    const saved = source ? own(source, 'panels') : null;
    const byId = new Map();
    const known = new Set(admitted.map((s) => s.id));
    if (Array.isArray(saved)) {
        // A malformed preference must not turn startup into an unbounded scan.
        for (const item of saved.slice(0, MAX_CANVAS_PANELS * 8)) {
            const p = record(item);
            const id = p && own(p, 'id');
            if (p && validId(id) && known.has(id) && !byId.has(id))
                byId.set(id, p);
        }
    }
    const panels = admitted.map((spec, index) => {
        const p = byId.get(spec.id);
        const read = (key) => p ? own(p, key) : undefined;
        return {
            id: spec.id, rect: normalizePanelRect(read('rect'), spec),
            open: typeof read('open') === 'boolean' ? read('open') : spec.initiallyOpen === true,
            collapsed: read('collapsed') === true, pinned: read('pinned') === true,
            z: clamp(finite(read('z'), index), 0, MAX_CANVAS_PANELS * 8),
        };
    });
    // Dense layers cannot grow without bound through repeated focus changes.
    const order = [...panels].sort((a, b) => a.z - b.z || admitted.findIndex((s) => s.id === a.id) - admitted.findIndex((s) => s.id === b.id));
    order.forEach((panel, index) => { panel.z = index; });
    const requested = source ? own(source, 'activeId') : null;
    const active = panels.find((p) => p.id === requested && p.open) ?? [...order].reverse().find((p) => p.open);
    return { version: WORKSPACE_VERSION, panels, activeId: active?.id ?? null };
}
export function parseWorkspaceState(text, specs) {
    if (typeof text !== 'string' || text.length > MAX_WORKSPACE_BYTES)
        return normalizeWorkspaceState(null, specs);
    if (new TextEncoder().encode(text).byteLength > MAX_WORKSPACE_BYTES)
        return normalizeWorkspaceState(null, specs);
    try {
        return normalizeWorkspaceState(JSON.parse(text), specs);
    }
    catch {
        return normalizeWorkspaceState(null, specs);
    }
}
/** Serialize a strict projection even if the caller attached unrelated fields to a panel. */
export function serializeWorkspaceState(state) {
    const specs = state.panels.slice(0, MAX_CANVAS_PANELS).map((p) => ({ id: p.id, rect: p.rect, minWidth: 160, minHeight: PANEL_TITLE_HEIGHT, maxWidth: 8192, maxHeight: 8192 }));
    const safe = normalizeWorkspaceState(state, specs);
    return JSON.stringify({ version: safe.version, panels: safe.panels.map((p) => ({ id: p.id, rect: p.rect, open: p.open, collapsed: p.collapsed, pinned: p.pinned, z: p.z })), activeId: safe.activeId });
}
export function focusPanel(state, id) {
    const panel = state.panels.find((p) => p.id === id);
    if (!panel?.open)
        return state;
    const ordered = [...state.panels].sort((a, b) => a.z - b.z).filter((p) => p.id !== id);
    ordered.push(panel);
    const layers = new Map(ordered.map((p, index) => [p.id, index]));
    if (state.activeId === id && state.panels.every((p) => p.z === layers.get(p.id)))
        return state;
    return { ...state, activeId: id, panels: state.panels.map((p) => ({ ...p, z: layers.get(p.id) })) };
}
export function revealPanel(state, id) {
    const panel = state.panels.find((p) => p.id === id);
    if (!panel)
        return state;
    const next = panel.open && !panel.collapsed ? state : { ...state, panels: state.panels.map((p) => p.id === id ? { ...p, open: true, collapsed: false } : p) };
    return focusPanel(next, id);
}
export function closePanel(state, id) {
    const panel = state.panels.find((p) => p.id === id);
    if (!panel?.open)
        return state;
    const panels = state.panels.map((p) => p.id === id ? { ...p, open: false } : p);
    const activeId = state.activeId === id ? [...panels].filter((p) => p.open).sort((a, b) => b.z - a.z)[0]?.id ?? null : state.activeId;
    return { ...state, panels, activeId };
}
export function setPanelCollapsed(state, id, collapsed) {
    const panel = state.panels.find((p) => p.id === id);
    if (!panel || panel.collapsed === collapsed)
        return state;
    return { ...state, panels: state.panels.map((p) => p.id === id ? { ...p, collapsed } : p) };
}
/** Pinned means position/size locked. Closing, reading and editing content remain available. */
export function setPanelPinned(state, id, pinned) {
    const panel = state.panels.find((p) => p.id === id);
    if (!panel || panel.pinned === pinned)
        return state;
    return { ...state, panels: state.panels.map((p) => p.id === id ? { ...p, pinned } : p) };
}
export function updatePanelRect(state, id, rect, spec) {
    const panel = state.panels.find((p) => p.id === id);
    if (!panel || panel.pinned)
        return state;
    const next = normalizePanelRect(rect, { ...spec, rect: panel.rect });
    if (sameRect(panel.rect, next))
        return state;
    return { ...state, panels: state.panels.map((p) => p.id === id ? { ...p, rect: next } : p) };
}
export function visiblePanelRect(panel) {
    return { ...panel.rect, height: panel.collapsed ? PANEL_TITLE_HEIGHT : panel.rect.height };
}
function usablePoint(p) { return Number.isFinite(p.x) && Number.isFinite(p.y); }
function worldDelta(start, end, camera, viewport) {
    if (!usablePoint(start) || !usablePoint(end))
        return null;
    const a = screenToWorld(camera, viewport, start);
    const b = screenToWorld(camera, viewport, end);
    // Rays beyond the horizon and clamped coordinates have no exact inverse on this plane.
    // Ignore that sample instead of teleporting a dragged panel to a finite world boundary.
    const pa = worldToScreen(camera, viewport, a);
    const pb = worldToScreen(camera, viewport, b);
    if (Math.hypot(pa.x - start.x, pa.y - start.y) > 0.5 || Math.hypot(pb.x - end.x, pb.y - end.y) > 0.5)
        return null;
    return { x: b.x - a.x, y: b.y - a.y };
}
/** Use the camera captured on pointerdown; repeated moves are relative to the original rect. */
export function dragPanelRect(rect, start, end, camera, viewport, spec) {
    const base = normalizePanelRect(rect, spec);
    const delta = worldDelta(start, end, camera, viewport);
    return delta ? normalizePanelRect({ ...base, x: base.x + delta.x, y: base.y + delta.y }, { ...spec, rect: base }) : base;
}
export function resizePanelRect(rect, start, end, camera, viewport, edge = 'se', spec) {
    const base = normalizePanelRect(rect, spec);
    const delta = worldDelta(start, end, camera, viewport);
    if (!delta)
        return base;
    const resized = normalizePanelRect({ ...base, width: base.width + (edge !== 's' ? delta.x : 0), height: base.height + (edge !== 'e' ? delta.y : 0) }, { ...spec, rect: base });
    // At world boundaries resizing stops instead of shifting the panel's anchored top-left corner.
    return { ...resized, x: base.x, y: base.y, width: Math.min(resized.width, MAX_COORD - base.x), height: Math.min(resized.height, MAX_COORD - base.y) };
}
export function framePanelCamera(camera, viewport, rect, padding = 36) {
    const bounds = normalizePanelRect(rect, { minHeight: PANEL_TITLE_HEIGHT });
    return fitBounds(normalizeCamera(camera), normalizeViewport(viewport), bounds, clamp(finite(padding, 36), 0, 160));
}
/** Conservative visibility is intentional at a perspective horizon; never cull a focused panel. */
export function panelIsVisible(panel, camera, viewport, margin = 120) {
    if (!panel.open)
        return false;
    const r = visiblePanelRect(panel);
    const v = visibleRect(camera, viewport, margin);
    return r.x <= v.x + v.width && r.x + r.width >= v.x && r.y <= v.y + v.height && r.y + r.height >= v.y;
}
/** Bounded ease-out sample. The host owns one cancellable RAF and reduced-motion policy. */
export function sampleCameraFlight(from, to, elapsedMs, durationMs = CANVAS_CAMERA_DURATION) {
    const duration = clamp(finite(durationMs, CANVAS_CAMERA_DURATION), 0, 1000);
    const elapsed = finite(elapsedMs, 0);
    const t = duration === 0 ? 1 : clamp(elapsed / duration, 0, 1);
    const progress = 1 - (1 - t) ** 3;
    return { camera: interpolateCamera(from ?? DEFAULT_CAMERA, to ?? DEFAULT_CAMERA, progress), done: t >= 1 };
}
/** Deterministic panel parking around the table; caller may supply exact art-directed positions. */
export function panelGridRect(index, anchor = { x: 0, y: 0 }, size = { width: 840, height: 640 }) {
    const i = clamp(Math.floor(finite(index, 0)), 0, MAX_CANVAS_PANELS - 1);
    const base = normalizePanelRect({ x: finite(anchor.x, 0), y: finite(anchor.y, 0), width: size.width, height: size.height });
    return normalizePanelRect({ ...base, x: base.x + (i % 4) * (base.width + 96), y: base.y + Math.floor(i / 4) * (base.height + 112) });
}
