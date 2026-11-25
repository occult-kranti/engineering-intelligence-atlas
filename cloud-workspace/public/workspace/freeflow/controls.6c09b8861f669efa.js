// Freeflow camera controls. Presentation-only: never touches rooms, staff, permissions or jobs.
// No office/provider commands. Nothing executes on import. No idle RAF: browsing is opt-in.
//
// API for the studio orchestrator:
//   const c = mountControls(host, {
//     viewport, getViewportSize(), getCamera(), setCamera(cam), onCameraChange?(cam, phase),
//     getBounds?(), focusKey?, active?, storage?, ownsCamera?  // default true
//   });
//   c.setBounds(rect); c.setFocusKey(key); c.setActive(bool); c.fit(); c.sync(); c.destroy();
// When ownsCamera is false the host studio owns restore/fit; controls only translate gestures.
import { DEFAULT_CAMERA, easeSpring, fitBounds, interpolateCamera, normalizeCamera, wrapDegrees, zoomAt, screenToWorld, } from './camera.457a3ca4fd1e3c65.js';
const PREFIX = 'daftar.freeflow.camera.v1:';
const DUR = 360;
const MAX_WHEEL_FACTOR = 1.35;
const PERSPECTIVE_PITCH = 42;
const PAN_STEP = 80;
function clampN(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
export function normalizeWheelDelta(e, pageHeight = 800) {
    const m = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? pageHeight : 1;
    const d = Number.isFinite(e.deltaY) ? e.deltaY * m : 0;
    return clampN(d, -240, 240);
}
function isTyping(t) {
    const e = t;
    if (!e || !e.tagName)
        return false;
    const tag = e.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.isContentEditable === true || !!e.closest?.('[contenteditable="true"],.donna-dock,.ff-list-search,.canvas-panel,.canvas-launcher');
}
function validPref(v) {
    if (!v || typeof v !== 'object')
        return null;
    const o = v;
    for (const k of ['x', 'y', 'zoom', 'yaw', 'pitch', 'distance'])
        if (typeof o[k] !== 'number' || !Number.isFinite(o[k]))
            return null;
    return normalizeCamera(o);
}
export function loadCameraPref(key, storage) {
    try {
        const raw = storage?.getItem(PREFIX + key);
        return raw ? validPref(JSON.parse(raw)) : null;
    }
    catch {
        return null;
    }
}
export function saveCameraPref(key, cam, storage) {
    try {
        storage?.setItem(PREFIX + key, JSON.stringify(normalizeCamera(cam)));
    }
    catch { /* denied or full: presentation-only */ }
}
function defaultStorage() {
    try {
        return typeof localStorage !== 'undefined' ? localStorage : null;
    }
    catch {
        return null;
    }
}
function realSize(s) {
    return !!s && Number.isFinite(s.width) && Number.isFinite(s.height) && s.width > 1 && s.height > 1;
}
/** Camera that keeps world point `anchor` under screen point `to` (translation only). */
function anchorTo(cam, vpSize, anchor, to) {
    const cur = screenToWorld(cam, vpSize, to);
    return normalizeCamera({ ...cam, x: cam.x + (anchor.x - cur.x), y: cam.y + (anchor.y - cur.y) });
}
export function mountControls(host, o) {
    const vp = o.viewport;
    const storage = o.storage === undefined ? defaultStorage() : o.storage;
    const owns = o.ownsCamera !== false;
    let focusKey = o.focusKey ?? 'default';
    let active = o.active !== false;
    let bounds = o.getBounds?.() ?? null;
    let destroyed = false;
    let raf = 0;
    let anim = null;
    let inertia = null;
    let wheelTimer = 0;
    const pointers = new Map();
    const captured = new Set();
    let panAnchor = null;
    let panVel = { x: 0, y: 0, t: 0, px: 0, py: 0 };
    let pinch = null;
    let dirty = false;
    let restored = false; // owned restore/fit satisfied for current focus
    let browseBounds = null;
    let autoPan = false;
    let edgePan = false;
    let edgeVelocity = null;
    let browseLast = 0;
    const priorTouch = vp.style.touchAction;
    const motionQuery = typeof matchMedia !== 'undefined' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
    const reduce = () => motionQuery?.matches === true;
    const root = document.createElement('div');
    root.className = 'ff-controls';
    root.setAttribute('role', 'toolbar');
    root.setAttribute('aria-label', 'Camera controls');
    const buttons = document.createElement('div');
    buttons.className = 'ff-controls-buttons';
    root.appendChild(buttons);
    const angle = document.createElement('span');
    angle.className = 'ff-controls-angle';
    angle.setAttribute('role', 'status');
    angle.setAttribute('aria-live', 'polite');
    const btns = [];
    function btn(label, title, fn) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'ff-ctl';
        b.textContent = label;
        b.title = title;
        b.setAttribute('aria-label', title);
        b.addEventListener('click', fn);
        btns.push(b);
        buttons.appendChild(b);
        return b;
    }
    const readAngle = () => { const c = o.getCamera(); angle.textContent = `Rotation ${Math.round(c.yaw)}° · Tilt ${Math.round(c.pitch)}° · Zoom ${Math.round(c.zoom * 100)}%`; };
    function emit(cam, phase) {
        o.setCamera(cam);
        if (phase === 'end') {
            readAngle();
            dirty = false;
            if (owns || realSize(o.getViewportSize()))
                saveCameraPref(focusKey, cam, storage);
        }
        else
            dirty = true;
        o.onCameraChange?.(cam, phase);
    }
    function stopMotion() {
        if (raf) {
            cancelAnimationFrame(raf);
            raf = 0;
        }
        anim = null;
        inertia = null;
    }
    function commit() { if (dirty)
        emit(o.getCamera(), 'end'); }
    function tick(now) {
        raf = 0;
        if (destroyed || !active || document.hidden) {
            stopMotion();
            commit();
            return;
        }
        if ((autoPan || edgeVelocity) && (reduce() || isTyping(document.activeElement)))
            pauseBrowsing();
        if (anim) {
            const t = clampN((now - anim.t0) / DUR, 0, 1);
            emit(interpolateCamera(anim.from, anim.to, easeSpring(t)), t >= 1 ? 'end' : 'frame');
            if (t >= 1)
                anim = null;
        }
        else if (inertia) {
            const dt = Math.min(32, now - inertia.last);
            inertia.last = now;
            inertia.pt = { x: inertia.pt.x + inertia.vx * dt, y: inertia.pt.y + inertia.vy * dt };
            emit(anchorTo(o.getCamera(), o.getViewportSize(), inertia.anchor, inertia.pt), 'frame');
            inertia.vx *= 0.9;
            inertia.vy *= 0.9;
            if (Math.hypot(inertia.vx, inertia.vy) < 0.02) {
                inertia = null;
                commit();
            }
        }
        else if ((autoPan || edgeVelocity) && browseBounds) {
            const dt = Math.min(40, Math.max(0, now - browseLast));
            browseLast = now;
            const c = o.getCamera(), s = o.getViewportSize();
            const velocity = edgeVelocity ?? { x: 0.075, y: 0 };
            const center = { x: s.width / 2, y: s.height / 2 };
            const anchor = screenToWorld(c, s, { x: center.x + velocity.x * dt, y: center.y + velocity.y * dt });
            const moved = anchorTo(c, s, anchor, center);
            const b = browseBounds;
            const next = normalizeCamera({ ...moved, x: clampN(moved.x, b.x, b.x + b.width), y: clampN(moved.y, b.y, b.y + b.height) });
            if (next.x === c.x && next.y === c.y) {
                pauseBrowsing();
            }
            else
                emit(next, 'frame');
        }
        if ((anim || inertia || autoPan || edgeVelocity) && !raf)
            raf = requestAnimationFrame(tick);
    }
    function go(to) {
        if (!active || destroyed)
            return;
        pauseBrowsing();
        const target = normalizeCamera(to);
        stopMotion();
        if (reduce() || document.hidden) {
            emit(target, 'end');
            return;
        }
        anim = { from: o.getCamera(), to: target, t0: performance.now() };
        raf = requestAnimationFrame(tick);
    }
    const curBounds = () => bounds ?? o.getBounds?.() ?? null;
    function fit() { const b = curBounds(); if (b)
        go(fitBounds(o.getCamera(), o.getViewportSize(), b, 24)); }
    function reset() { const b = curBounds(); go(b ? fitBounds({ ...DEFAULT_CAMERA }, o.getViewportSize(), b, 24) : { ...DEFAULT_CAMERA }); }
    function topView() { go({ ...o.getCamera(), pitch: 0, yaw: 0 }); }
    function perspective() { go({ ...o.getCamera(), pitch: PERSPECTIVE_PITCH }); }
    function rotate(d) { const c = o.getCamera(); go({ ...c, yaw: wrapDegrees(c.yaw + d) }); }
    btn('Fit', 'Fit scene to view', fit);
    btn('Reset', 'Reset camera', reset);
    btn('Top', 'Top view', topView);
    btn('3D', 'Perspective view', perspective);
    btn('⟲', 'Rotate left 15 degrees', () => rotate(-15));
    btn('⟳', 'Rotate right 15 degrees', () => rotate(15));
    btn('−', 'Zoom out', () => zoomStep(1 / 1.25));
    btn('+', 'Zoom in', () => zoomStep(1.25));
    const edgeButton = btn('Edge pan', 'Toggle edge panning: move the pointer near a canvas edge', () => {
        if (!browseBounds || reduce())
            return;
        pauseBrowsing();
        edgePan = !edgePan;
        updateBrowseButtons();
    });
    const browseButton = btn('Auto-pan', 'Browse company seats automatically. Interact or press again to pause.', () => {
        if (!browseBounds || reduce())
            return;
        if (autoPan) {
            pauseBrowsing();
            return;
        }
        stopMotion();
        edgeVelocity = null;
        const c = o.getCamera(), b = browseBounds;
        // A whole-portfolio fit can make hundreds of company names too small to read.
        // Explicit browsing opens a readable, top-down tour; no camera moves on page load.
        const restart = c.zoom < 0.6 || c.x >= b.x + b.width - 1;
        emit(normalizeCamera({ ...c, zoom: Math.max(0.8, c.zoom), yaw: 0, pitch: 0,
            x: restart ? b.x : clampN(c.x, b.x, b.x + b.width), y: b.y + b.height / 2 }), 'end');
        autoPan = true;
        browseLast = performance.now();
        updateBrowseButtons();
        if (!raf)
            raf = requestAnimationFrame(tick);
    });
    edgeButton.classList.add('ff-ctl-browse');
    browseButton.classList.add('ff-ctl-browse');
    function updateBrowseButtons() {
        edgeButton.hidden = browseButton.hidden = !browseBounds;
        edgeButton.disabled = browseButton.disabled = !active || !browseBounds || reduce();
        edgeButton.setAttribute('aria-pressed', String(edgePan));
        browseButton.setAttribute('aria-pressed', String(autoPan));
        browseButton.textContent = autoPan ? 'Pause tour' : 'Auto-pan';
        edgeButton.title = reduce() ? 'Automatic movement is disabled by reduced-motion preferences.' : 'Move the pointer near an empty canvas edge to pan. Arrow keys also move the view.';
        browseButton.title = reduce() ? 'Automatic movement is disabled by reduced-motion preferences.' : 'Browse company seats. Click, type, or press Escape to pause.';
        vp.classList.toggle('has-edge-pan', edgePan && !!browseBounds && active && !reduce());
    }
    function pauseBrowsing() {
        autoPan = false;
        edgeVelocity = null;
        if (!anim && !inertia && raf) {
            cancelAnimationFrame(raf);
            raf = 0;
        }
        updateBrowseButtons();
        commit();
    }
    updateBrowseButtons();
    root.appendChild(angle);
    host.appendChild(root);
    readAngle();
    function zoomStep(f) {
        const s = o.getViewportSize();
        go(zoomAt(o.getCamera(), s, { x: s.width / 2, y: s.height / 2 }, f));
    }
    const rectPt = (e) => { const r = vp.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    const onBackground = (e) => !e.target?.closest?.('.ff-node,.ff-controls,.canvas-panel,.canvas-launcher,button,input,textarea,select,a');
    function onWheel(e) {
        if (!active || destroyed)
            return;
        if (e.target?.closest?.('.canvas-panel,.canvas-launcher'))
            return;
        e.preventDefault();
        pauseBrowsing();
        stopMotion();
        const d = normalizeWheelDelta(e, vp.clientHeight);
        const base = e.ctrlKey ? 0.01 : 0.0022;
        const f = clampN(Math.exp(-d * base), 1 / MAX_WHEEL_FACTOR, MAX_WHEEL_FACTOR);
        emit(zoomAt(o.getCamera(), o.getViewportSize(), rectPt(e), f), 'frame');
        clearTimeout(wheelTimer);
        wheelTimer = window.setTimeout(() => { wheelTimer = 0; commit(); }, 180);
    }
    function pinchDist() { const [a, b] = [...pointers.values()]; return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0; }
    function pinchMid() { const [a, b] = [...pointers.values()]; return { x: ((a?.x ?? 0) + (b?.x ?? 0)) / 2, y: ((a?.y ?? 0) + (b?.y ?? 0)) / 2 }; }
    function onDown(e) {
        if (!active || destroyed || !onBackground(e) || (e.pointerType === 'mouse' && e.button !== 0))
            return;
        pauseBrowsing();
        stopMotion();
        clearTimeout(wheelTimer);
        wheelTimer = 0;
        pointers.set(e.pointerId, rectPt(e));
        try {
            vp.setPointerCapture(e.pointerId);
            captured.add(e.pointerId);
        }
        catch { /* not capturable */ }
        const size = o.getViewportSize();
        if (pointers.size === 2) {
            pinch = { dist: pinchDist(), anchor: screenToWorld(o.getCamera(), size, pinchMid()) };
            panAnchor = null;
        }
        else {
            const p = rectPt(e);
            panAnchor = screenToWorld(o.getCamera(), size, p);
            panVel = { x: 0, y: 0, t: performance.now(), px: p.x, py: p.y };
            vp.classList.add('is-panning');
        }
    }
    function onMove(e) {
        if (!active || destroyed)
            return;
        if (!pointers.has(e.pointerId)) {
            if (!edgePan || !browseBounds || reduce() || e.pointerType === 'touch' || !onBackground(e) || isTyping(document.activeElement)) {
                if (edgeVelocity)
                    pauseBrowsing();
                return;
            }
            const p = rectPt(e), size = o.getViewportSize(), band = 44;
            const edge = (v, max) => v < band ? -0.32 * (1 - Math.max(0, v) / band) : v > max - band ? 0.32 * (1 - Math.max(0, max - v) / band) : 0;
            const velocity = { x: edge(p.x, size.width), y: edge(p.y, size.height) };
            if (!velocity.x && !velocity.y) {
                if (edgeVelocity)
                    pauseBrowsing();
                return;
            }
            autoPan = false;
            anim = null;
            inertia = null;
            edgeVelocity = velocity;
            browseLast = performance.now();
            updateBrowseButtons();
            if (!raf)
                raf = requestAnimationFrame(tick);
            return;
        }
        const p = rectPt(e);
        pointers.set(e.pointerId, p);
        const size = o.getViewportSize();
        if (pointers.size >= 2 && pinch) {
            const d = pinchDist();
            const mid = pinchMid();
            let cam = o.getCamera();
            if (d > 0 && pinch.dist > 0)
                cam = zoomAt(cam, size, mid, clampN(d / pinch.dist, 0.8, 1.25));
            cam = anchorTo(cam, size, pinch.anchor, mid);
            pinch.dist = d;
            emit(cam, 'frame');
        }
        else if (panAnchor) {
            const now = performance.now(), dt = Math.max(1, now - panVel.t);
            emit(anchorTo(o.getCamera(), size, panAnchor, p), 'frame');
            panVel = { x: clampN((p.x - panVel.px) / dt, -2, 2), y: clampN((p.y - panVel.py) / dt, -2, 2), t: now, px: p.x, py: p.y };
        }
    }
    function releaseCapture(id) {
        if (captured.delete(id)) {
            try {
                vp.releasePointerCapture(id);
            }
            catch { /* already released */ }
        }
    }
    function release(e, fling) {
        if (e) {
            pointers.delete(e.pointerId);
            releaseCapture(e.pointerId);
        }
        if (pointers.size < 2)
            pinch = null;
        if (pointers.size === 0) {
            vp.classList.remove('is-panning');
            const recent = performance.now() - panVel.t < 80;
            const cur = panVel.px !== undefined ? { x: panVel.px, y: panVel.py } : null;
            if (fling && panAnchor && cur && recent && !reduce() && Math.hypot(panVel.x, panVel.y) > 0.15 && active && !destroyed) {
                inertia = { vx: panVel.x, vy: panVel.y, last: performance.now(), anchor: panAnchor, pt: cur };
                raf = requestAnimationFrame(tick);
            }
            else
                commit();
            panAnchor = null;
        }
        else if (pointers.size === 1) {
            const rem = [...pointers.values()][0];
            if (rem) {
                panAnchor = screenToWorld(o.getCamera(), o.getViewportSize(), rem);
                panVel = { x: 0, y: 0, t: performance.now(), px: rem.x, py: rem.y };
            }
        }
    }
    const onUp = (e) => release(e, e.type === 'pointerup');
    const onLost = (e) => { captured.delete(e.pointerId); if (pointers.has(e.pointerId))
        release(e, false); };
    function cancelAll() {
        for (const id of [...captured])
            releaseCapture(id);
        pointers.clear();
        pinch = null;
        panAnchor = null;
        clearTimeout(wheelTimer);
        wheelTimer = 0;
        vp.classList.remove('is-panning');
        pauseBrowsing();
        stopMotion();
        commit();
    }
    const onVis = () => { if (document.hidden)
        cancelAll(); };
    const onBlur = () => cancelAll();
    const onInteraction = (e) => {
        const target = e.target;
        if (target && (edgeButton.contains(target) || browseButton.contains(target)))
            return;
        if (autoPan || edgeVelocity)
            pauseBrowsing();
    };
    const onLeave = () => { if (edgeVelocity)
        pauseBrowsing(); };
    const onMotionPreference = () => { if (reduce()) {
        edgePan = false;
        pauseBrowsing();
    } updateBrowseButtons(); };
    function onKey(e) {
        if (!active || destroyed || e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || isTyping(e.target))
            return;
        if (!vp.contains(e.target) && e.target !== vp)
            return;
        if (e.target.closest?.('.ff-node') && ['Enter', ' '].includes(e.key))
            return;
        const c = o.getCamera();
        const size = o.getViewportSize();
        // Screen-space step: content follows the arrow direction consistently under any yaw/pitch.
        const pan = (dx, dy) => {
            const center = { x: size.width / 2, y: size.height / 2 };
            const anchor = screenToWorld(c, size, { x: center.x + dx, y: center.y + dy });
            go(anchorTo(c, size, anchor, center));
        };
        let handled = true;
        switch (e.key) {
            case 'ArrowLeft':
                pan(-PAN_STEP, 0);
                break;
            case 'ArrowRight':
                pan(PAN_STEP, 0);
                break;
            case 'ArrowUp':
                pan(0, -PAN_STEP);
                break;
            case 'ArrowDown':
                pan(0, PAN_STEP);
                break;
            case '+':
            case '=':
                zoomStep(1.25);
                break;
            case '-':
            case '_':
                zoomStep(1 / 1.25);
                break;
            case 'f':
            case 'F':
                fit();
                break;
            case '0':
                reset();
                break;
            case 'Escape':
                cancelAll();
                break;
            default: handled = false;
        }
        if (handled)
            e.preventDefault();
    }
    vp.addEventListener('wheel', onWheel, { passive: false });
    vp.addEventListener('pointerdown', onDown);
    vp.addEventListener('pointermove', onMove);
    vp.addEventListener('pointerleave', onLeave);
    vp.addEventListener('pointerup', onUp);
    vp.addEventListener('pointercancel', onUp);
    vp.addEventListener('lostpointercapture', onLost);
    vp.addEventListener('keydown', onKey);
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('blur', onBlur);
    document.addEventListener('pointerdown', onInteraction, true);
    document.addEventListener('keydown', onInteraction, true);
    document.addEventListener('focusin', onInteraction, true);
    motionQuery?.addEventListener('change', onMotionPreference);
    function applyActive() {
        for (const b of btns)
            b.disabled = !active;
        updateBrowseButtons();
        root.dataset.active = String(active);
        if (active)
            vp.style.touchAction = 'none';
        else {
            cancelAll();
            vp.style.touchAction = priorTouch;
        }
    }
    applyActive();
    // Owned restore: saved camera wins; otherwise fit once with a real viewport and bounds.
    function tryOwnedInit(force) {
        if (!owns || destroyed || (restored && !force))
            return;
        const p = loadCameraPref(focusKey, storage);
        if (p) {
            restored = true;
            emit(p, 'end');
            return;
        }
        const b = curBounds();
        const size = o.getViewportSize();
        if (!b || !realSize(size))
            return; // wait; never persist a fallback zero-size fit
        restored = true;
        emit(fitBounds(o.getCamera(), size, b, 24), 'end');
    }
    tryOwnedInit(false);
    return {
        elements: { root, angle },
        setBounds(b) { bounds = b; if (owns && !restored)
            tryOwnedInit(false); },
        setBrowseBounds(b) { browseBounds = b; if (!b) {
            edgePan = false;
            pauseBrowsing();
        } updateBrowseButtons(); },
        setFocusKey(k) {
            if (k === focusKey)
                return;
            cancelAll();
            focusKey = k;
            restored = false;
            tryOwnedInit(true);
        },
        setActive(a) { if (a === active)
            return; active = a; applyActive(); },
        fit, reset, topView, perspective, rotate,
        sync() { if (!destroyed)
            readAngle(); },
        stopMotion() { if (!destroyed)
            cancelAll(); },
        goTo(camera) { if (!destroyed) {
            cancelAll();
            go(normalizeCamera(camera));
        } },
        destroy() {
            if (destroyed)
                return;
            cancelAll();
            destroyed = true;
            vp.removeEventListener('wheel', onWheel);
            vp.removeEventListener('pointerdown', onDown);
            vp.removeEventListener('pointermove', onMove);
            vp.removeEventListener('pointerleave', onLeave);
            vp.removeEventListener('pointerup', onUp);
            vp.removeEventListener('pointercancel', onUp);
            vp.removeEventListener('lostpointercapture', onLost);
            vp.removeEventListener('keydown', onKey);
            document.removeEventListener('visibilitychange', onVis);
            window.removeEventListener('blur', onBlur);
            document.removeEventListener('pointerdown', onInteraction, true);
            document.removeEventListener('keydown', onInteraction, true);
            document.removeEventListener('focusin', onInteraction, true);
            motionQuery?.removeEventListener('change', onMotionPreference);
            vp.style.touchAction = priorTouch;
            root.remove();
        },
    };
}
