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

import { type Camera, type Rect, fitBounds, normalizeCamera } from './camera.js';
import { loadCameraPref, mountControls, type Controls } from './controls.js';
import { buildScene, type FreeflowFocus, type FreeflowScene, type FreeflowSnapshot, type SceneNode, type SceneThread } from './model.js';
import { mountScene, type SceneRenderer } from './scene.js';
import { mountA11yList, type A11yList } from './a11y-list.js';
import { mountInspector, type InspectorActionSpec, type InspectorView, type StudioActionContext, type StudioActionKind, type StudioActionState } from './inspector.js';

export type { StudioActionContext, StudioActionKind, StudioActionState, InspectorActionSpec } from './inspector.js';

export interface StudioHeat { level: 0 | 1 | 2 | 3 | 4; label: string; metric?: string }

export interface StudioOptions {
  onNavigate(focus: FreeflowFocus): void;
  onAction(action: StudioActionKind, context: StudioActionContext): void;
  heat?(node: Readonly<SceneNode>): StudioHeat | null | undefined;
  capabilities?(spec: InspectorActionSpec): StudioActionState;
  storage?: Pick<Storage, 'getItem' | 'setItem'> | null;
}

export interface Studio {
  update(snapshot: FreeflowSnapshot, focus?: FreeflowFocus): void;
  setActive(active: boolean): void;
  setCapabilities(fn: ((spec: InspectorActionSpec) => StudioActionState) | null): void;
  destroy(): void;
  elements: { root: HTMLElement; canvasHost: HTMLElement; listHost: HTMLElement };
}

const WARN_VISIBLE = 3;

function focusKey(f: FreeflowFocus): string {
  return f.kind === 'portfolio' ? 'portfolio' : f.kind === 'company' ? `c:${f.companyId}` : f.kind === 'office' ? `o:${f.companyId}:${f.officeId}` : `d:${f.companyId}:${f.officeId}:${f.departmentId}`;
}

function focusOf(n: SceneNode): FreeflowFocus | null {
  if (n.kind === 'folio') return { kind: 'company', companyId: n.companyId };
  if (n.kind === 'office' && n.officeId) return { kind: 'office', companyId: n.companyId, officeId: n.officeId };
  if ((n.kind === 'room' || n.kind === 'department') && n.officeId) return n.departmentId ? { kind: 'department', companyId: n.companyId, officeId: n.officeId, departmentId: n.departmentId } : { kind: 'office', companyId: n.companyId, officeId: n.officeId };
  if (n.kind === 'reference' && n.metadata['portal'] === true) return { kind: 'company', companyId: n.companyId };
  return null;
}

function mk<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

export function mountStudio(host: HTMLElement, options: StudioOptions): Studio {
  const root = mk('section', 'ff-studio');
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
  inspBtn.setAttribute('aria-pressed', 'true');
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
  const canvasHost = mk('div', 'ff-canvas-host');
  canvasHost.tabIndex = 0;
  canvasHost.setAttribute('aria-label', 'Office canvas');
  const listHost = mk('div', 'ff-list-host');
  const inspHost = mk('div', '');
  bench.append(canvasHost, listHost, inspHost);
  const status = mk('div', 'ff-status');
  status.setAttribute('role', 'status');
  root.append(header, notice, bench, status);
  host.appendChild(root);

  let snapshot: FreeflowSnapshot = {};
  let focus: FreeflowFocus = { kind: 'portfolio' };
  let scene: FreeflowScene | null = null;
  let selectedId: string | null = null;
  let selectedThread: string | null = null;
  let active = true;
  let destroyed = false;
  let narrow = false;
  let listMode = false;
  let userToggled = false;
  let inspectorOpen = true;
  let warnExpanded = false;
  let currentKey = '';
  let fitPending = false;
  let capsFn = options.capabilities ?? null;
  const storage = options.storage === undefined ? undefined : options.storage;
  const cams = new Map<string, Camera>();

  const openNode = (n: SceneNode) => {
    const f = focusOf(n);
    if (f) { options.onNavigate(f); return; }
    if (n.kind === 'whiteboard') options.onAction('whiteboard', { companyId: n.companyId, officeId: n.officeId, boardId: n.boardId, roomId: n.roomId, employeeId: n.employeeId, nodeId: n.id });
    else options.onAction('ownership', { companyId: n.companyId, officeId: n.officeId, departmentId: n.departmentId, employeeId: n.employeeId, contractId: n.contractId, roomId: n.roomId, nodeId: n.id });
  };

  const inspector: InspectorView = mountInspector(inspHost, {
    onAction: (spec) => options.onAction(spec.action, spec.context),
    onClose: () => { inspectorOpen = false; layout(); },
  });
  inspector.setCapabilities(capsFn);

  let list: A11yList = mountA11yList(listHost, { onSelect: (id) => selectNode(id, 'list'), onOpen: openNode });
  let sceneR: SceneRenderer = mountScene(canvasHost, {
    onSelect: (id) => selectNode(id, 'canvas'),
    onOpen: openNode,
    onThreadSelect: (t) => { selectedThread = t ? t.id : null; syncInspector(); },
    onViewportChange: () => { if (fitPending) tryFit(); },
  });
  let controls: Controls = mountControls(canvasHost, {
    viewport: canvasHost,
    getViewportSize: () => sceneR.getViewport(),
    getCamera: () => sceneR.getCamera(),
    setCamera: (c) => sceneR.setCamera(c),
    onCameraChange: (c, ph) => { if (ph === 'end') cams.set(currentKey, c); },
    getBounds: () => (scene ? (scene.bounds as Rect) : null),
    focusKey: 'pending',
    active,
    storage,
  });

  function tryFit(): void {
    const vp = sceneR.getViewport();
    if (!scene || !(vp.width > 0 && vp.height > 0) || canvasHost.clientWidth <= 0) { fitPending = true; return; }
    fitPending = false;
    const saved = cams.get(currentKey) ?? loadCameraPref(currentKey, storage === undefined ? (typeof localStorage !== 'undefined' ? localStorage : null) : storage);
    sceneR.setCamera(saved ? normalizeCamera(saved) : fitBounds(sceneR.getCamera(), vp, scene.bounds as Rect, 48));
  }

  function applyHeat(sc: FreeflowScene): FreeflowScene {
    const nodes = sc.nodes.map((n) => {
      const h = options.heat?.(n) ?? null;
      const ok = h && Number.isInteger(h.level) && h.level >= 0 && h.level <= 4 && typeof h.label === 'string' && h.label.length > 0;
      const metadata = { ...n.metadata, heatLabel: ok ? h!.label.slice(0, 80) : 'Unknown (no metric)' };
      if (ok) { metadata['heatLevel'] = h!.level; if (h!.metric) metadata['heatMetric'] = h!.metric.slice(0, 120); }
      return { ...n, metadata };
    });
    return { ...sc, nodes };
  }

  function syncInspector(): void {
    const node = selectedId && scene ? scene.nodes.find((n) => n.id === selectedId) ?? null : null;
    const thread = selectedThread && scene ? scene.threads.find((t) => t.id === selectedThread) ?? null : null;
    inspector.setSelection(node, thread as SceneThread | null, scene);
  }

  function selectNode(id: string | null, from: 'canvas' | 'list' | 'api'): void {
    selectedId = id;
    selectedThread = null;
    if (from !== 'canvas') sceneR.select(id);
    if (from !== 'list') list.setSelected(id);
    if (id && from === 'list' && !listMode && scene) {
      const n = scene.nodes.find((x) => x.id === id);
      if (n) {
        const vp = sceneR.getViewport();
        const cam = sceneR.getCamera();
        const cx = n.rect.x + n.rect.width / 2, cy = n.rect.y + n.rect.height / 2;
        const dx = Math.abs(cx - cam.x) * cam.zoom, dy = Math.abs(cy - cam.y) * cam.zoom;
        if (dx > vp.width / 2 - 40 || dy > vp.height / 2 - 40) sceneR.setCamera({ ...cam, x: cx, y: cy });
      }
    }
    syncInspector();
    statusLine();
  }

  function statusLine(): void {
    if (!scene) { status.textContent = ''; return; }
    const c = scene.counts;
    const bits: string[] = [];
    const add = (k: string, label: string) => { const v = c[k]; if (typeof v === 'number') bits.push(`${v} ${label}`); };
    add('companies', 'companies'); add('offices', 'offices'); add('rooms', 'rooms'); add('whiteboards', 'boards');
    add('hiredEmployees', 'employee definitions (not processes)'); add('employees', 'placed employees'); add('references', 'contracted references (not owned staff)');
    add('runningJobs', 'running jobs'); add('unknownCostJobs', 'jobs with unknown cost');
    status.textContent = bits.join(' · ');
  }

  function renderHeader(): void {
    crumbs.replaceChildren();
    scene?.breadcrumbs.forEach((b, i, a) => {
      const li = document.createElement('li');
      const last = i === a.length - 1;
      const btn = mk('button', '', b.label);
      btn.type = 'button';
      if (last) btn.setAttribute('aria-current', 'page');
      btn.addEventListener('click', () => options.onNavigate(b.focus));
      li.appendChild(btn);
      if (!last) li.appendChild(document.createTextNode(' / '));
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

  function layout(): void {
    canvasHost.style.display = listMode ? 'none' : '';
    listHost.style.display = listMode ? 'block' : '';
    inspHost.hidden = !inspectorOpen;
    viewBtn.textContent = listMode ? 'Canvas view' : 'List view';
    viewBtn.setAttribute('aria-pressed', String(listMode));
    inspBtn.setAttribute('aria-pressed', String(inspectorOpen));
    if (!listMode && fitPending) tryFit();
  }

  const onView = () => { userToggled = true; listMode = !listMode; layout(); };
  const onInsp = () => { inspectorOpen = !inspectorOpen; layout(); };
  const onWarn = () => { warnExpanded = !warnExpanded; renderHeader(); };
  viewBtn.addEventListener('click', onView);
  inspBtn.addEventListener('click', onInsp);
  noticeBtn.addEventListener('click', onWarn);

  const mq = typeof matchMedia !== 'undefined' ? matchMedia('(max-width: 720px)') : null;
  const onMq = () => { narrow = !!mq?.matches; if (!userToggled) { listMode = narrow; layout(); } };
  mq?.addEventListener('change', onMq);
  if (mq) { narrow = mq.matches; listMode = narrow; }
  layout();

  return {
    elements: { root, canvasHost, listHost },
    update(snap, f) {
      if (destroyed) return;
      snapshot = snap;
      const nextFocus = f ?? focus;
      const key = focusKey(nextFocus);
      const changed = key !== currentKey;
      focus = nextFocus;
      const built = applyHeat(buildScene(snapshot, focus));
      scene = built;
      if (changed) {
        if (currentKey) cams.set(currentKey, sceneR.getCamera());
        currentKey = key;
        selectedId = null; selectedThread = null;
        controls.setBounds(built.bounds as Rect);
        sceneR.update(built);
        controls.setFocusKey(key);
        tryFit();
      } else {
        controls.setBounds(built.bounds as Rect);
        if (selectedId && !built.nodes.some((n) => n.id === selectedId)) selectedId = null;
        if (selectedThread && !built.threads.some((t) => t.id === selectedThread)) selectedThread = null;
        sceneR.update(built);
      }
      list.update(built);
      sceneR.select(selectedId);
      list.setSelected(selectedId);
      renderHeader();
      syncInspector();
      statusLine();
    },
    setActive(a) {
      if (destroyed) return;
      active = a;
      controls.setActive(a);
      root.hidden = !a;
    },
    setCapabilities(fn) { capsFn = fn; inspector.setCapabilities(fn); },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      viewBtn.removeEventListener('click', onView);
      inspBtn.removeEventListener('click', onInsp);
      noticeBtn.removeEventListener('click', onWarn);
      mq?.removeEventListener('change', onMq);
      controls.destroy();
      sceneR.destroy();
      list.destroy();
      inspector.destroy();
      root.remove();
      scene = null;
    },
  };
}
