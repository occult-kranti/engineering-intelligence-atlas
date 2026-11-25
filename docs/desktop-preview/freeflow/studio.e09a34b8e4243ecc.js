// Freeflow studio orchestrator. Composes buildScene, mountScene, mountControls, mountA11yList and the
// inspector. Performs NO bridge calls, owns no office state or composer; only view preferences/selection.
//
// HOST API
//   const studio = mountStudio(host, {
//     onNavigate(focus), onAction(action, context), heat?(node) -> StudioHeat | null,
//     capabilities?(spec) -> StudioActionState, storage?
//   });
//   studio.update(snapshot, focus?)   // idempotent; keeps camera/selection where records persist
//   studio.setActive(bool)            // false stops controls/motion
//   studio.destroy()
// Heat: callback returns per-node { level: 0..4, label, metric? } or null (shown as unknown).
import { fitBounds, normalizeCamera, worldToScreen, isVisible, screenToWorld } from './camera.457a3ca4fd1e3c65.js';
import { buildUniverse } from './universe.c51a204838c9b47b.js';
import { loadCameraPref, mountControls } from './controls.6c09b8861f669efa.js';
import { buildScene } from './model.21b07fb6c63ec187.js';
import { mountScene } from './scene.0d9d3a2c7c382dda.js';
import { mountA11yList } from './a11y-list.c972998eb8ad6bc6.js';
import { mountInspector } from './inspector.2ad19899cbf7dd2d.js';
const WARN_VISIBLE = 3;
function focusKey(f) {
    return f.kind === 'portfolio' ? 'portfolio' : f.kind === 'company' ? `c:${f.companyId}` : f.kind === 'office' ? `o:${f.companyId}:${f.officeId}` : `d:${f.companyId}:${f.officeId}:${f.departmentId}`;
}
function focusOf(n) {
    if (n.kind === 'folio')
        return { kind: 'company', companyId: n.companyId };
    if (n.kind === 'office' && n.officeId)
        return { kind: 'office', companyId: n.companyId, officeId: n.officeId };
    if ((n.kind === 'room' || n.kind === 'department') && n.officeId)
        return n.departmentId ? { kind: 'department', companyId: n.companyId, officeId: n.officeId, departmentId: n.departmentId } : { kind: 'office', companyId: n.companyId, officeId: n.officeId };
    if (n.kind === 'reference' && n.metadata['portal'] === true)
        return { kind: 'company', companyId: n.companyId };
    return null;
}
function mk(tag, cls, text) {
    const e = document.createElement(tag);
    e.className = cls;
    if (text !== undefined)
        e.textContent = text;
    return e;
}
export function mountStudio(host, options) {
    const root = mk('section', 'ff-studio');
    if (options.continuousCanvas)
        root.classList.add('ff-studio--continuous');
    root.setAttribute('aria-label', 'Office studio');
    const header = mk('header', 'ff-header');
    const left = mk('div', '');
    const crumbs = mk('ol', 'ff-breadcrumbs');
    crumbs.setAttribute('aria-label', 'Scope');
    const title = mk('h1', 'ff-title');
    left.append(crumbs, title);
    const tools = mk('div', 'ff-tools');
    const viewBtn = mk('button', '', 'List view');
    viewBtn.type = 'button';
    viewBtn.setAttribute('aria-pressed', 'false');
    const inspBtn = mk('button', '', 'Inspector');
    inspBtn.type = 'button';
    inspBtn.setAttribute('aria-pressed', 'false');
    tools.append(viewBtn, inspBtn);
    header.append(left, tools);
    const notice = mk('div', 'ff-notice');
    notice.hidden = true;
    const noticeText = mk('span', '');
    const noticeBtn = mk('button', '', 'Show all');
    noticeBtn.type = 'button';
    noticeBtn.setAttribute('aria-expanded', 'false');
    notice.append(noticeText, document.createTextNode(' '), noticeBtn);
    const bench = mk('div', 'ff-workbench');
    const cameraBar = mk('div', 'ff-camera-bar');
    const canvasHost = mk('div', 'ff-canvas-host');
    canvasHost.tabIndex = 0;
    canvasHost.setAttribute('aria-label', 'Office canvas');
    const listHost = mk('div', 'ff-list-host');
    const inspHost = mk('div', '');
    bench.append(canvasHost, listHost, inspHost);
    const status = mk('div', 'ff-status');
    status.setAttribute('role', 'status');
    root.append(header, notice, cameraBar, bench, status);
    host.appendChild(root);
    let snapshot = {};
    let focus = { kind: 'portfolio' };
    let scene = null;
    let focusBounds = null;
    let selectedId = null;
    let selectedThread = null;
    let active = true;
    let destroyed = false;
    let narrow = false;
    let listMode = false;
    let userToggled = false;
    let inspectorOpen = false;
    let warnExpanded = false;
    let currentKey = '';
    // A deep-linked panel can frame before the first snapshot assigns a scope.
    // Adopt that explicit choice once; subsequent scope changes keep normal restore/fit behavior.
    let initialCamera = null;
    let fitPending = false;
    let canvasShown = true;
    let capsFn = options.capabilities ?? null;
    const storage = options.storage === undefined ? undefined : options.storage;
    const cams = new Map();
    const openNode = (n) => {
        if (n.kind === 'restricted')
            return;
        const f = focusOf(n);
        if (f) {
            options.onNavigate(f);
            return;
        }
        if (n.kind === 'whiteboard')
            options.onAction('whiteboard', { companyId: n.companyId, officeId: n.officeId, boardId: n.boardId, roomId: n.roomId, employeeId: n.employeeId, nodeId: n.id });
        else
            options.onAction('ownership', { companyId: n.companyId, officeId: n.officeId, departmentId: n.departmentId, employeeId: n.employeeId, contractId: n.contractId, roomId: n.roomId, nodeId: n.id });
    };
    const inspector = mountInspector(inspHost, {
        onAction: (spec) => options.onAction(spec.action, spec.context),
        onClose: () => { inspectorOpen = false; layout(); },
    });
    inspector.setCapabilities(capsFn);
    let list = mountA11yList(listHost, { onSelect: (id) => selectNode(id, 'list'), onOpen: openNode });
    let sceneR = mountScene(canvasHost, {
        onSelect: (id) => selectNode(id, 'canvas'),
        onOpen: openNode,
        onThreadSelect: (t) => { selectedThread = t ? t.id : null; if (t && !inspectorOpen) {
            inspectorOpen = true;
            layout();
        } syncInspector(); },
        onViewportChange: () => { if (fitPending)
            tryFit(); },
    });
    const onRes = () => { if (fitPending)
        tryFit(); };
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(onRes) : null;
    ro?.observe(canvasHost);
    const onDocVis = () => { if (!document.hidden && fitPending)
        tryFit(); };
    document.addEventListener('visibilitychange', onDocVis);
    let controls = mountControls(cameraBar, {
        viewport: canvasHost,
        getViewportSize: () => sceneR.getViewport(),
        getCamera: () => sceneR.getCamera(),
        setCamera: (c) => sceneR.setCamera(c),
        onCameraChange: (c, ph) => { if (ph === 'end' && currentKey)
            cams.set(currentKey, c); },
        getBounds: () => focusBounds ?? (scene ? scene.bounds : null),
        focusKey: 'pending',
        active: false,
        storage,
        ownsCamera: false,
    });
    function syncControlsActive() { controls.setActive(active && canvasShown && !listMode); }
    function readStored(key) {
        try {
            const st = storage === undefined ? (typeof localStorage !== 'undefined' ? localStorage : null) : storage;
            return loadCameraPref(key, st);
        }
        catch {
            return null;
        }
    }
    function realCanvas() {
        const vp = sceneR.getViewport();
        return canvasHost.clientWidth > 0 && canvasHost.clientHeight > 0 && vp.width > 0 && vp.height > 0 && canvasHost.getClientRects().length > 0;
    }
    function tryFit() {
        if (!scene) {
            fitPending = false;
            return;
        }
        const mem = cams.get(currentKey);
        if (mem) {
            fitPending = false;
            sceneR.setCamera(mem);
            controls.sync();
            return;
        }
        // An empty loading projection has placeholder extents, not a useful saved
        // camera. Wait for actual nodes and the full-size canvas before framing.
        if (!scene.nodes.length) {
            fitPending = true;
            return;
        }
        const saved = readStored(currentKey);
        if (saved) {
            fitPending = false;
            const c = normalizeCamera(saved);
            cams.set(currentKey, c);
            sceneR.setCamera(c);
            controls.sync();
            return;
        }
        if (!active || !canvasShown || listMode || !realCanvas()) {
            fitPending = true;
            return;
        }
        fitPending = false;
        const base = options.continuousCanvas ? normalizeCamera({ ...sceneR.getCamera(), pitch: focus.kind === 'portfolio' ? 26 : 0, yaw: focus.kind === 'portfolio' ? -3 : 0 }) : sceneR.getCamera();
        const c = fitBounds(base, sceneR.getViewport(), focusBounds ?? scene.bounds, options.continuousCanvas ? 90 : 24);
        cams.set(currentKey, c);
        sceneR.setCamera(c);
        controls.sync();
    }
    function applyHeat(sc) {
        const nodes = sc.nodes.map((n) => {
            const h = options.heat?.(n) ?? null;
            const metadata = { ...n.metadata };
            const lv = h ? h.level : undefined;
            const labelOk = !!h && typeof h.label === 'string' && h.label.length > 0;
            if (h && labelOk && lv === 'off') {
                metadata['heatLabel'] = h.label.slice(0, 80);
                metadata['heatLevel'] = 'off';
            }
            else if (h && labelOk && typeof lv === 'number' && Number.isInteger(lv) && lv >= 0 && lv <= 4) {
                metadata['heatLabel'] = h.label.slice(0, 80);
                metadata['heatLevel'] = lv;
                if (h.metric)
                    metadata['heatMetric'] = h.metric.slice(0, 120);
            }
            else {
                metadata['heatLabel'] = h && labelOk && lv === 'unknown' ? h.label.slice(0, 80) : 'Unknown (no metric)';
                metadata['heatLevel'] = 'unknown';
            }
            return { ...n, metadata };
        });
        return { ...sc, nodes };
    }
    function syncInspector() {
        const node = selectedId && scene ? scene.nodes.find((n) => n.id === selectedId) ?? null : null;
        const thread = selectedThread && scene ? scene.threads.find((t) => t.id === selectedThread) ?? null : null;
        inspector.setSelection(node, thread, scene);
    }
    function selectNode(id, from) {
        selectedId = id;
        selectedThread = null;
        if (id && !inspectorOpen) {
            inspectorOpen = true;
            if (!options.continuousCanvas)
                layout();
        }
        if (from !== 'canvas')
            sceneR.select(id);
        if (from !== 'list')
            list.setSelected(id);
        if (id && from === 'list' && !listMode && scene) {
            const n = scene.nodes.find((x) => x.id === id);
            if (n && canvasShown && realCanvas()) {
                const vp = sceneR.getViewport();
                const cam = sceneR.getCamera();
                const c = { x: n.rect.x + n.rect.width / 2, y: n.rect.y + n.rect.height / 2 };
                const vis = isVisible(cam, vp, c);
                const s = worldToScreen(cam, vp, c);
                const m = 40;
                if (!vis || s.x < m || s.y < m || s.x > vp.width - m || s.y > vp.height - m) {
                    // shift camera so the node's projected point lands at viewport center (translation only)
                    const here = screenToWorld(cam, vp, { x: vp.width / 2, y: vp.height / 2 });
                    const there = screenToWorld(cam, vp, s);
                    const next = normalizeCamera({ ...cam, x: vis ? cam.x + (there.x - here.x) : c.x, y: vis ? cam.y + (there.y - here.y) : c.y });
                    sceneR.setCamera(next);
                    cams.set(currentKey, next);
                    controls.sync();
                }
            }
        }
        syncInspector();
        statusLine();
    }
    function statusLine() {
        if (!scene) {
            status.textContent = '';
            return;
        }
        const c = scene.counts;
        const bits = [];
        const add = (k, label) => { const v = c[k]; if (typeof v === 'number')
            bits.push(`${v} ${label}`); };
        add('companies', 'companies');
        add('offices', 'offices');
        add('rooms', 'rooms');
        add('whiteboards', 'boards');
        add('hiredEmployees', 'employee definitions (not processes)');
        add('employees', 'placed employees');
        add('references', 'contracted references (not owned staff)');
        add('runningJobs', 'running jobs');
        add('unknownCostJobs', 'jobs with unknown cost');
        status.textContent = bits.join(' · ');
    }
    function renderHeader() {
        crumbs.replaceChildren();
        scene?.breadcrumbs.forEach((b, i, a) => {
            const li = document.createElement('li');
            const last = i === a.length - 1;
            const btn = mk('button', '', b.label);
            btn.type = 'button';
            if (last)
                btn.setAttribute('aria-current', 'page');
            btn.addEventListener('click', () => options.onNavigate(b.focus));
            li.appendChild(btn);
            if (!last)
                li.appendChild(document.createTextNode(' / '));
            crumbs.appendChild(li);
        });
        title.textContent = scene?.title ?? 'Studio';
        const w = scene?.warnings ?? [];
        notice.hidden = w.length === 0;
        if (w.length) {
            const shown = warnExpanded ? w : w.slice(0, WARN_VISIBLE);
            noticeText.textContent = `${w.length} notice${w.length === 1 ? '' : 's'}: ${shown.join(' ')}`;
            noticeBtn.hidden = w.length <= WARN_VISIBLE;
            noticeBtn.textContent = warnExpanded ? 'Show fewer' : 'Show all';
            noticeBtn.setAttribute('aria-expanded', String(warnExpanded));
        }
    }
    function layout() {
        if (options.continuousCanvas) {
            canvasShown = true;
            listMode = false;
            cameraBar.hidden = false;
            canvasHost.hidden = false;
            listHost.hidden = false;
            inspHost.hidden = false;
            viewBtn.textContent = 'Find company';
            viewBtn.setAttribute('aria-pressed', 'false');
            syncControlsActive();
            return;
        }
        canvasShown = !listMode;
        cameraBar.hidden = listMode;
        canvasHost.hidden = listMode;
        listHost.hidden = !listMode;
        inspHost.hidden = !inspectorOpen;
        syncControlsActive();
        viewBtn.textContent = listMode ? 'Canvas view' : 'List view';
        viewBtn.setAttribute('aria-pressed', String(listMode));
        inspBtn.setAttribute('aria-pressed', String(inspectorOpen));
        if (!listMode && fitPending) {
            tryFit();
            if (fitPending)
                requestAnimationFrame(() => { if (!destroyed && fitPending)
                    tryFit(); });
        }
    }
    const onView = () => { if (options.continuousCanvas) {
        options.onSurface?.('company-directory');
        return;
    } userToggled = true; listMode = !listMode; layout(); };
    const onInsp = () => { if (options.continuousCanvas) {
        options.onSurface?.('object-inspector');
        return;
    } inspectorOpen = !inspectorOpen; layout(); };
    const onWarn = () => { warnExpanded = !warnExpanded; renderHeader(); };
    viewBtn.addEventListener('click', onView);
    inspBtn.addEventListener('click', onInsp);
    noticeBtn.addEventListener('click', onWarn);
    const mq = typeof matchMedia !== 'undefined' ? matchMedia('(max-width: 720px)') : null;
    const onMq = () => { narrow = !!mq?.matches; if (!userToggled && !options.continuousCanvas) {
        listMode = narrow;
        layout();
    } };
    mq?.addEventListener('change', onMq);
    if (mq) {
        narrow = mq.matches;
        listMode = options.continuousCanvas ? false : narrow;
    }
    layout();
    return {
        elements: { root, canvasHost, listHost, world: sceneR.elements.world, inspectorHost: inspHost },
        getCamera: () => sceneR.getCamera(),
        getViewport: () => sceneR.getViewport(),
        setCamera(c) {
            if (destroyed)
                return;
            const camera = normalizeCamera(c);
            fitPending = false;
            if (currentKey)
                cams.set(currentKey, camera);
            else
                initialCamera = camera;
            sceneR.setCamera(camera);
            controls.sync();
        },
        stopMotion() { controls.stopMotion(); },
        showCanvas() { userToggled = true; listMode = false; layout(); },
        frame() { if (focusBounds)
            controls.goTo(fitBounds(sceneR.getCamera(), sceneR.getViewport(), focusBounds, 80)); },
        update(snap, f) {
            if (destroyed)
                return;
            snapshot = snap;
            const nextFocus = f ?? focus;
            const key = (options.continuousCanvas ? 'universe:' : '') + focusKey(nextFocus);
            const changed = key !== currentKey;
            focus = nextFocus;
            const raw = options.continuousCanvas ? buildUniverse(snapshot, focus) : buildScene(snapshot, focus);
            focusBounds = 'focusBounds' in raw ? raw.focusBounds : raw.bounds;
            const built = applyHeat(raw);
            scene = built;
            controls.setBrowseBounds(focus.kind === 'portfolio' && built.nodes.length > 1 ? built.tableBounds ?? null : null);
            if (changed) {
                currentKey = key;
                if (initialCamera) {
                    cams.set(key, initialCamera);
                    initialCamera = null;
                }
                selectedId = null;
                selectedThread = null;
                fitPending = true;
                controls.setBounds(focusBounds);
                sceneR.update(built);
                controls.setFocusKey(key);
                tryFit();
            }
            else {
                controls.setBounds(focusBounds);
                if (selectedId && !built.nodes.some((n) => n.id === selectedId))
                    selectedId = null;
                if (selectedThread && !built.threads.some((t) => t.id === selectedThread))
                    selectedThread = null;
                sceneR.update(built);
                if (fitPending)
                    tryFit();
            }
            list.update(built);
            sceneR.select(selectedId);
            list.setSelected(selectedId);
            renderHeader();
            syncInspector();
            statusLine();
        },
        setActive(a) {
            if (destroyed)
                return;
            active = a;
            root.hidden = !a;
            syncControlsActive();
            if (a) {
                tryFit();
                if (fitPending)
                    requestAnimationFrame(() => { if (!destroyed && fitPending)
                        tryFit(); });
            }
        },
        setCapabilities(fn) { capsFn = fn; inspector.setCapabilities(fn); },
        destroy() {
            if (destroyed)
                return;
            destroyed = true;
            viewBtn.removeEventListener('click', onView);
            inspBtn.removeEventListener('click', onInsp);
            noticeBtn.removeEventListener('click', onWarn);
            mq?.removeEventListener('change', onMq);
            document.removeEventListener('visibilitychange', onDocVis);
            ro?.disconnect();
            controls.destroy();
            sceneR.destroy();
            list.destroy();
            inspector.destroy();
            root.remove();
            scene = null;
        },
    };
}
