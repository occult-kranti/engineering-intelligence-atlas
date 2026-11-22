// Freeflow spatial scene renderer. Keyed DOM/CSS3D world layer; no bridge, storage or network access.
// Nothing executes on import. All snapshot-derived text is written via textContent.
//
// DOM CLASS CONTRACT (for the next CSS packet):
//   .ff-scene                 host root (role=application, tabindex=-1)
//   .ff-table                 continuous blueprint grid (no physical table object)
//   .ff-grid                  coordinate grid inside table
//   .ff-world                 CSS3D world layer (transform-origin 0 0, inline transform = cameraTransform)
//   .ff-threads               svg behind cards; .ff-thread[data-kind] + .ff-thread--contract|staff|ownership
//                             .ff-thread--focus on the inspected edge; .ff-thread-label for its label
//   .ff-node                  every node; data-kind, data-lod (rich|simple), data-status; states .is-selected .is-focused
//   .ff-node--folio|office|department|room|employee|whiteboard|reference|fallback
//   .ff-node-paper            sheet/paper surface; .ff-node-svg architectural detail svg
//   .ff-node-title .ff-node-sub .ff-node-monogram .ff-node-status .ff-node-counts .ff-node-open
//   .ff-caption               fixed overlay caption (aria-live=polite): .ff-caption-title .ff-caption-sub
//   .ff-budget                honest "Showing X of Y" message (role=status)
//   .ff-empty                 empty/loading/missing state (data-state=empty|loading|missing)
// Theme variables: --canvas --surface --ink --muted --accent --brand-gold --connection --line --grid-minor --grid-major --heat-*

import {
  type Camera, type Rect, type Size, DEFAULT_CAMERA, cameraTransform, normalizeCamera, visibleRect,
} from './camera.js';
import type { FreeflowScene, SceneNode, SceneThread } from './model.js';
import { mountRelief3D, type ReliefHandle } from './relief3d.js';

export type CanvasNodeAction = 'chat' | 'roadmap' | 'whiteboard' | 'ownership' | 'hire';

export const RICH_NODE_BUDGET = 240;
export const THREAD_BUDGET = 160;
const GRID_MAX_EXTENT = 150000;
// Common multiple of the shipped 16/80, 24/120 and 32/160px grid periods.
// Moving the finite patch must not move its lines relative to native geometry.
const GRID_PHASE = 480;
const SVGNS = 'http://www.w3.org/2000/svg';

export interface SceneCallbacks {
  graphics?: boolean;
  onCanvasAction?(action: CanvasNodeAction, node: SceneNode): void;
  onSelect?(nodeId: string | null, node: SceneNode | null): void;
  onOpen?(node: SceneNode): void;
  onViewportChange?(size: Size): void;
  onThreadSelect?(thread: SceneThread | null): void;
  /** Host should bring an offscreen selected node into view (e.g. center camera on it). */
  onRevealNode?(node: SceneNode): void;
}

export interface SceneStats {
  total: number; visible: number; rich: number; simple: number; threads: number; threadsVisible: number;
  domCreated: number; domRemoved: number; updates: number; cameraUpdates: number; capped: boolean; message: string;
}

export interface SceneRenderer {
  update(scene: FreeflowScene | null, opts?: { loading?: boolean }): void;
  setCamera(camera: Camera): void;
  select(nodeId: string | null): void;
  selectThread(threadId: string | null): void;
  setActive(active: boolean): void;
  getViewport(): Size;
  getCamera(): Camera;
  destroy(): void;
  stats(): SceneStats;
  elements: { root: HTMLElement; table: HTMLElement; world: HTMLElement; threads: SVGSVGElement; caption: HTMLElement; budget: HTMLElement; empty: HTMLElement };
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}
function svg<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string> = {}): SVGElementTagNameMap[K] {
  const e = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  return e;
}
const fin = (n: number) => (Number.isFinite(n) ? n : 0);

function intersects(a: Rect, b: Rect): boolean {
  return a.x <= b.x + b.width && a.x + a.width >= b.x && a.y <= b.y + b.height && a.y + a.height >= b.y;
}

function countsText(n: SceneNode): string {
  return Object.entries(n.counts).filter(([, v]) => v > 0).map(([k, v]) => `${v} ${k}`).join(' · ');
}

export function describeNode(n: SceneNode): string {
  const md = n.metadata || {};
  let prefix: string = n.kind;
  if (n.kind === 'reference') {
    if (md['tableBlueprint'] === true) prefix = 'Saved blueprint preview';
    else if (md['organizational'] === true || md['portal'] === true) prefix = md['role'] === 'parent' ? 'Parent company link' : md['role'] === 'child' ? 'Subcompany link' : 'Company link';
    else if (md['globalAssistant'] === true) prefix = 'Global assistant reference';
    else if (md['serviceHost'] === true || md['layoutOnly'] === true) prefix = 'Service host reference';
    else if (md['memberShared'] === true) prefix = 'Shared employee reference';
    else if (n.employeeId || n.contractId) prefix = 'Contracted staff reference';
    else prefix = 'Reference';
  }
  const bits = [prefix, n.label];
  if (n.subtitle) bits.push(n.subtitle);
  if (n.kind === 'room') bits.push(typeof md['assignment'] === 'string' ? (md['assignment'] as string) : (n.departmentId ? 'Department unavailable' : 'Unassigned department'));
  if (n.status) bits.push(`status ${n.status}`);
  if (typeof md['heatLabel'] === 'string') bits.push(md['heatLabel']);
  const c = countsText(n);
  if (c) bits.push(c);
  return bits.join(', ');
}

/** Architectural SVG detail drawn with DOM APIs from real geometry only. */
function detailSvg(n: SceneNode, lod: 'rich' | 'simple'): SVGSVGElement {
  const w = Math.max(1, fin(n.rect.width)), h = Math.max(1, fin(n.rect.height));
  const s = svg('svg', { class: 'ff-node-svg', viewBox: `0 0 ${w} ${h}`, preserveAspectRatio: 'none', 'aria-hidden': 'true', focusable: 'false' });
  s.appendChild(svg('rect', { class: 'ff-wall', x: '1', y: '1', width: String(w - 2), height: String(h - 2), fill: 'none' }));
  if (lod === 'simple') return s;
  if (n.kind === 'office' || n.kind === 'folio') {
    const step = Math.max(40, Math.round(w / 12));
    for (let x = step; x < w; x += step) s.appendChild(svg('line', { class: 'ff-measure', x1: String(x), y1: '0', x2: String(x), y2: '8' }));
    s.appendChild(svg('line', { class: 'ff-dimension', x1: '8', y1: '14', x2: String(w - 8), y2: '14' }));
  } else if (n.kind === 'room' || n.kind === 'whiteboard') {
    s.appendChild(svg('path', { class: 'ff-door', d: `M ${w * 0.1} ${h} A ${Math.min(24, w * 0.2)} ${Math.min(24, w * 0.2)} 0 0 1 ${w * 0.1 + Math.min(24, w * 0.2)} ${h - Math.min(24, w * 0.2)}`, fill: 'none' }));
  }
  return s;
}

/** Each outline comes from a saved room; each office is fitted separately without invented rooms. */
function tablePlanSvg(n: SceneNode): SVGSVGElement | null {
  const offices = (n.blueprintPreview?.offices ?? []).slice(0, 2);
  if (!offices.some(office => office.rooms.length > 0)) return null;
  const s = svg('svg', { class: 'ff-table-plan-svg', viewBox: '0 0 220 84', 'aria-hidden': 'true', focusable: 'false' });
  let remaining = 32;
  const cellWidth = 220 / offices.length;
  offices.forEach((office, index) => {
    const rooms = office.rooms.slice(0, remaining).filter(room => Object.values(room.rect).every(Number.isFinite) && room.rect.width > 0 && room.rect.height > 0);
    remaining -= rooms.length;
    const label = svg('text', { class: 'ff-table-plan-office-label', x: String(index * cellWidth + 4), y: '10' });
    label.textContent = office.label; s.append(label);
    if (!rooms.length) return;
    const x0 = Math.min(...rooms.map(room => room.rect.x)), y0 = Math.min(...rooms.map(room => room.rect.y));
    const width = Math.max(...rooms.map(room => room.rect.x + room.rect.width)) - x0;
    const height = Math.max(...rooms.map(room => room.rect.y + room.rect.height)) - y0;
    const scale = Math.min((cellWidth - 12) / Math.max(1, width), 64 / Math.max(1, height));
    const ox = index * cellWidth + (cellWidth - width * scale) / 2, oy = 16 + (64 - height * scale) / 2;
    for (const room of rooms) {
      const rect = svg('rect', { class: 'ff-table-plan-room', x: String(ox + (room.rect.x - x0) * scale), y: String(oy + (room.rect.y - y0) * scale), width: String(room.rect.width * scale), height: String(room.rect.height * scale), fill: 'none' });
      rect.dataset.roomId = room.id;
      const title = svg('title'); title.textContent = room.label; rect.append(title); s.append(rect);
    }
  });
  return s;
}

/** Bounded inline SVG chair, decorative only; rotated by seat side, never the label. */
function chairSvg(side: string): SVGSVGElement {
  const s = svg('svg', { class: 'ff-chair-svg', viewBox: '0 0 48 48', 'aria-hidden': 'true', focusable: 'false' });
  const rot = side === 'south' ? 180 : side === 'east' ? 90 : side === 'west' ? -90 : 0;
  const g = svg('g', { transform: `rotate(${rot} 24 24)` });
  g.appendChild(svg('rect', { class: 'ff-chair-back', x: '8', y: '4', width: '32', height: '10', rx: '4' }));
  g.appendChild(svg('rect', { class: 'ff-chair-seat', x: '10', y: '16', width: '28', height: '26', rx: '6' }));
  g.appendChild(svg('rect', { class: 'ff-chair-arm', x: '4', y: '18', width: '5', height: '20', rx: '2' }));
  g.appendChild(svg('rect', { class: 'ff-chair-arm', x: '39', y: '18', width: '5', height: '20', rx: '2' }));
  s.appendChild(g);
  return s;
}

function buildNode(n: SceneNode): HTMLElement {
  const e = el('div', `ff-node ff-node--${n.kind}`);
  e.setAttribute('role', 'button');
  e.dataset.nodeId = n.id;
  e.dataset.kind = n.kind;
  e.appendChild(el('div', 'ff-node-paper'));
  return e;
}

const HEAT_LEVELS = new Set(['0', '1', '2', '3', '4', 'unknown', 'off']);

function heatOf(n: SceneNode): { level: string; label: string; metric: string } | null {
  const m = n.metadata;
  const raw = m['heatLevel'];
  if (raw === undefined || raw === null) return null;
  const level = String(raw);
  if (!HEAT_LEVELS.has(level) || level === 'off') return null;
  const label = typeof m['heatLabel'] === 'string' ? (m['heatLabel'] as string) : (level === 'unknown' ? 'Unknown' : `Level ${level}`);
  const metric = typeof m['heatMetric'] === 'string' ? (m['heatMetric'] as string) : '';
  return { level, label, metric };
}

function applyHeat(e: HTMLElement, paper: HTMLElement, n: SceneNode, lod: 'rich' | 'simple'): void {
  const h = heatOf(n);
  const old = paper.querySelector('.ff-node-heat');
  if (!h) {
    delete e.dataset.heatLevel;
    paper.removeAttribute('data-heat-text');
    old?.remove();
    return;
  }
  e.dataset.heatLevel = h.level;
  const text = h.metric ? `${h.label} · ${h.metric}` : h.label;
  paper.setAttribute('data-heat-text', text);
  if (lod === 'rich' && h.level !== 'unknown') {
    let badge = old as HTMLElement | null;
    if (!badge) { badge = el('span', 'ff-node-heat'); paper.appendChild(badge); }
    badge.textContent = text;
  } else old?.remove();
}

function fillNode(e: HTMLElement, n: SceneNode, lod: 'rich' | 'simple', selected: boolean, tabStop: boolean): void {
  e.style.cssText = `position:absolute;left:0;top:0;width:${Math.max(1, fin(n.rect.width))}px;height:${Math.max(1, fin(n.rect.height))}px;transform:translate(${fin(n.rect.x)}px,${fin(n.rect.y)}px)`;
  e.dataset.lod = lod;
  e.dataset.status = n.status;
  e.classList.toggle('ff-node--table-plan', n.metadata['tableBlueprint'] === true);
  e.classList.toggle('ff-node--company-plan', n.metadata['companyFootprint'] === true);
  e.classList.toggle('ff-node--company-marker', n.metadata['companyMarker'] === true);
  e.dataset.companyFootprint = String(n.metadata['companyFootprint'] === true);
  if (n.metadata['companyFootprint'] === true || n.kind === 'office' || n.kind === 'room') e.dataset.geometry = 'container';
  else delete e.dataset.geometry;
  // Department color conveys a saved assignment, never inferred authority.
  let hue = 2166136261;
  for (const char of n.departmentId ?? '') { hue ^= char.charCodeAt(0); hue = Math.imul(hue, 16777619); }
  const swatches = ['#32639a', '#267b73', '#ac5141', '#7953a1', '#89641f', '#4b763c'];
  e.style.setProperty('--person-color', n.departmentId ? swatches[(hue >>> 0) % swatches.length]! : '#526579');
  e.style.setProperty('--person-ink', '#fff');
  e.style.setProperty('--person-diameter', `${Math.max(10, Math.min(32, n.rect.height - 18))}px`);
  e.style.setProperty('--person-label-size', `${Math.max(9, Math.min(12, n.rect.height * .22))}px`);
  e.classList.toggle('is-selected', selected);
  e.setAttribute('aria-label', describeNode(n));
  e.setAttribute('aria-pressed', String(selected));
  if (n.kind === 'restricted') e.setAttribute('aria-disabled', 'true'); else e.removeAttribute('aria-disabled');
  e.tabIndex = tabStop ? 0 : -1;
  const paper = e.firstElementChild as HTMLElement;
  const hk = heatOf(n);
  const assign = typeof n.metadata['assignment'] === 'string' ? (n.metadata['assignment'] as string) : (n.departmentId ? 'Department unavailable' : 'Unassigned department');
  const key = `${e.getAttribute('aria-label')}|${assign}|${n.departmentId ?? ''}|${n.label}|${n.subtitle}|${n.status}|${countsText(n)}|${lod}|${n.rect.width}x${n.rect.height}|${hk ? `${hk.level}/${hk.label}/${hk.metric}` : 'noheat'}|${n.metadata['blueprintDetail'] ?? ''}|${n.metadata['companyFootprint'] ?? ''}|${n.blueprintPreview ? JSON.stringify(n.blueprintPreview) : ''}`;
  if (e.dataset.sig === key) return;
  e.dataset.sig = key;
  if (n.metadata['companyMarker'] === true) {
    const initials = n.label.trim().split(/\s+/).slice(0, 2).map(word => Array.from(word)[0] ?? '').join('').toUpperCase();
    paper.replaceChildren(el('div', 'ff-node-title', initials || 'CO'));
    return;
  }
  if (n.metadata['companyFootprint'] === true) {
    e.setAttribute('role', 'group');
    const header = el('div', 'ff-company-plan-header');
    header.append(el('div', 'ff-table-plan-title', n.label), el('div', 'ff-table-plan-caption', n.subtitle));
    const boards = el('div', 'ff-company-plan-boards');
    boards.setAttribute('aria-label', `Tools for ${n.label}`);
    for (const [action, label] of [['chat', 'Donna'], ['roadmap', 'Roadmap'], ['whiteboard', 'Whiteboard'], ['ownership', 'Ownership'], ['hire', 'Hire employee']] as const) {
      const button = el('button', 'ff-company-board-action', label); button.type = 'button';
      button.dataset.canvasAction = action;
      button.setAttribute('aria-label', `${label} · ${n.label}`);
      boards.append(button);
    }
    paper.replaceChildren(header, boards);
    if (n.metadata['blueprintDetail'] === 'proxy') {
      const preview = tablePlanSvg(n); if (preview) { preview.classList.add('ff-company-proxy-plan'); paper.append(preview); }
      paper.append(el('span', 'ff-company-proxy-hint', 'Zoom or open this company to explore its rooms'));
    }
    return;
  }
  if (n.metadata['tableBlueprint'] === true) {
    paper.replaceChildren(el('div', 'ff-table-plan-title', n.label));
    const plan = tablePlanSvg(n);
    if (plan) paper.append(plan);
    else paper.append(el('div', 'ff-table-plan-empty', n.blueprintPreview?.officeCount ? 'No saved room geometry' : 'No saved blueprint'));
    paper.append(el('div', 'ff-table-plan-caption', n.subtitle), el('span', 'ff-table-plan-open ff-node-open', 'Open layout ↵'));
    return;
  }
  paper.replaceChildren(detailSvg(n, lod));
  if (n.kind === 'folio' && n.metadata['seat'] === true) {
    const chair = el('div', 'ff-chair');
    chair.setAttribute('aria-hidden', 'true');
    chair.appendChild(chairSvg(String(n.metadata['seatSide'] ?? 'north')));
    paper.appendChild(chair);
    e.classList.add('ff-node--seat');
  }
  if ((n.kind === 'room' || n.kind === 'office') && n.kind === 'room') {
    const tag = el('div', 'ff-segment-tag', assign);
    tag.setAttribute('aria-label', `Department: ${assign}`);
    paper.appendChild(tag);
  }
  const title = el('div', 'ff-node-title', n.label);
  paper.appendChild(title);
  if (n.kind === 'restricted') {
    paper.appendChild(el('div', 'ff-restricted-mark', 'Restricted access'));
    paper.appendChild(el('div', 'ff-node-sub', n.subtitle));
    return;
  }
  if (lod === 'rich' || n.kind === 'folio') {
    if (n.subtitle) paper.appendChild(el('div', 'ff-node-sub', n.subtitle));
    if (n.kind === 'employee' || n.kind === 'reference') {
      const mono = n.metadata['monogram'];
      paper.insertBefore(el('div', 'ff-node-monogram', typeof mono === 'string' ? mono : '?'), title);
    }
    const state = n.kind === 'folio' && n.status === 'active' ? `Company ${Number(n.metadata['seatIndex'] ?? 0) + 1}` : n.status;
    paper.appendChild(el('div', 'ff-node-status', state));
    const c = countsText(n);
    if (c && lod === 'rich') paper.appendChild(el('div', 'ff-node-counts', c));
    if (n.kind === 'folio' || n.kind === 'office' || n.kind === 'room') {
      const open = el('span', 'ff-node-open', 'Open ↵');
      open.setAttribute('aria-hidden', 'true');
      paper.appendChild(open);
    }
  }
  applyHeat(e, paper, n, lod);
}

export function mountScene(host: HTMLElement, callbacks: SceneCallbacks = {}): SceneRenderer {
  const root = el('div', 'ff-scene');
  root.setAttribute('role', 'application');
  root.setAttribute('aria-label', 'Freeflow spatial scene');
  root.tabIndex = -1;
  root.addEventListener('keydown', (ev) => { if (ev.target === root && ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'Home', 'End'].includes(ev.key)) ev.stopPropagation(); }, { capture: false });
  const table = el('div', 'ff-table');
  table.setAttribute('aria-hidden', 'true');
  table.appendChild(el('div', 'ff-grid'));
  const world = el('div', 'ff-world');
  const worldTable = el('div', 'ff-world-table');
  worldTable.setAttribute('aria-hidden', 'true');
  worldTable.hidden = true;
  world.style.cssText = 'position:absolute;left:0;top:0;transform-origin:0 0;will-change:transform';
  const threadsSvg = svg('svg', { class: 'ff-threads', width: '1', height: '1', 'aria-hidden': 'true', focusable: 'false' });
  threadsSvg.style.cssText = 'position:absolute;left:0;top:0;overflow:visible;pointer-events:none';
  const nodeLayer = el('div', 'ff-nodes');
  world.append(worldTable, threadsSvg, nodeLayer);
  let tableSig = '';
  function paintWorldTable(): void {
    const tb = scene?.tableBounds;
    const sig = tb ? `${tb.x}|${tb.y}|${tb.width}|${tb.height}|${scene?.nodes.length ?? 0}` : '';
    if (sig === tableSig) return;
    tableSig = sig;
    if (!tb || !Number.isFinite(tb.width) || !Number.isFinite(tb.height)) { worldTable.hidden = true; return; }
    worldTable.hidden = false;
    worldTable.style.cssText = `position:absolute;left:0;top:0;width:${Math.max(1, tb.width)}px;height:${Math.max(1, tb.height)}px;transform:translate(${tb.x}px,${tb.y}px);pointer-events:none`;
  }
  root.dataset.scope = 'portfolio';
  const caption = el('div', 'ff-caption');
  caption.setAttribute('aria-live', 'polite');
  const capTitle = el('div', 'ff-caption-title'), capSub = el('div', 'ff-caption-sub');
  caption.append(capTitle, capSub);
  const budget = el('div', 'ff-budget');
  budget.setAttribute('role', 'status');
  const empty = el('div', 'ff-empty');
  empty.hidden = true;
  root.append(table, world, caption, budget, empty);
  host.appendChild(root);

  let scene: FreeflowScene | null = null;
  let camera: Camera = { ...DEFAULT_CAMERA };
  let viewport: Size = { width: Math.max(1, host.clientWidth || 1024), height: Math.max(1, host.clientHeight || 768) };
  let selectedId: string | null = null;
  let selectedThread: string | null = null;
  let focusedId: string | null = null;
  let tabId: string | null = null; // roving tab stop
  let destroyed = false;
  let relief: ReliefHandle | null = null;
  let gpuSurfaces = new Set<string>();
  let silent = 0; // suppress callbacks during internal clears
  const live = new Map<string, HTMLElement>();
  const threadEls = new Map<string, SVGPathElement>();
  const nodesById = new Map<string, SceneNode>();
  let labelEl: SVGTextElement | null = null;
  const st: SceneStats = { total: 0, visible: 0, rich: 0, simple: 0, threads: 0, threadsVisible: 0, domCreated: 0, domRemoved: 0, updates: 0, cameraUpdates: 0, capped: false, message: '' };
  let themeObserver: MutationObserver | null = null;
  if (callbacks.graphics) {
    world.style.zIndex = '1';
    relief = mountRelief3D(root, value => {
      root.dataset.graphics = value.state;
      root.dataset.graphicsReason = value.reason;
      for (const key of ['frames', 'geometries', 'materials', 'instances', 'drawCalls', 'triangles', 'contextLosses'] as const) {
        root.dataset[`graphics${key[0]!.toUpperCase()}${key.slice(1)}`] = String(value[key]);
      }
      root.dataset.graphicsPending = String(value.pending);
      gpuSurfaces = new Set(value.state === 'webgl' ? value.surfaceIds : []);
      for (const [id, node] of live) node.dataset.gpuSurface = String(gpuSurfaces.has(id));
    });
    const syncTheme = () => relief?.setTheme(document.documentElement.dataset.theme === 'drafting' ? 'drafting' : 'blueprint');
    syncTheme();
    if (typeof MutationObserver !== 'undefined') {
      themeObserver = new MutationObserver(syncTheme);
      themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    }
  }

  function paintCamera(): void {
    world.style.transform = cameraTransform(camera, viewport);
    relief?.setCamera(camera, viewport);
    // The blueprint grid is in the same world plane as rooms, including tilt.
    const grid = table.firstElementChild as HTMLElement | null;
    if (grid && callbacks.graphics) {
      const vr = visibleRect(camera, viewport, 400);
      const width = Math.min(GRID_MAX_EXTENT, vr.width + GRID_PHASE);
      const height = Math.min(GRID_MAX_EXTENT, vr.height + GRID_PHASE);
      // A capped patch stays around the camera instead of the far corner of an
      // unbounded horizon extent. Uncapped spans still cover the complete view;
      // one phase of padding absorbs the origin's downward snap.
      const snap = (value: number) => Math.floor(value / GRID_PHASE) * GRID_PHASE;
      const x = snap(vr.width + GRID_PHASE > GRID_MAX_EXTENT ? camera.x - width / 2 : vr.x);
      const y = snap(vr.height + GRID_PHASE > GRID_MAX_EXTENT ? camera.y - height / 2 : vr.y);
      grid.style.cssText = `position:absolute;left:0;top:0;transform-origin:0 0;width:${width}px;height:${height}px;transform:${cameraTransform(camera, viewport)} translate(${x}px,${y}px)`;
    }
  }

  function threadPath(t: SceneThread): string | null {
    const a = nodesById.get(t.fromId), b = nodesById.get(t.toId);
    if (!a || !b) return null;
    const x1 = fin(a.rect.x + a.rect.width / 2), y1 = fin(a.rect.y + a.rect.height / 2);
    const x2 = fin(b.rect.x + b.rect.width / 2), y2 = fin(b.rect.y + b.rect.height / 2);
    const mx = (x1 + x2) / 2, bend = Math.min(240, Math.hypot(x2 - x1, y2 - y1) * 0.25);
    return `M ${x1} ${y1} Q ${mx} ${(y1 + y2) / 2 - bend} ${x2} ${y2}`;
  }

  function updateCaption(): void {
    const n = selectedId ? nodesById.get(selectedId) : null;
    capTitle.textContent = n ? n.label : scene?.title ?? '';
    capSub.textContent = n ? [n.kind, n.subtitle, n.status].filter(Boolean).join(' · ') : scene ? scene.breadcrumbs.map((b) => b.label).join(' / ') : '';
  }

  function paintThreadLabel(): void {
    if (labelEl) { labelEl.remove(); labelEl = null; }
    const t = scene?.threads.find((x) => x.id === selectedThread);
    const p = t ? threadEls.get(t.id) : null;
    for (const [id, pe] of threadEls) pe.classList.toggle('ff-thread--focus', id === selectedThread);
    if (!t || !p) return;
    const a = nodesById.get(t.fromId), b = nodesById.get(t.toId);
    if (!a || !b) return;
    labelEl = svg('text', { class: 'ff-thread-label', x: String(fin((a.rect.x + a.rect.width / 2 + b.rect.x + b.rect.width / 2) / 2)), y: String(fin((a.rect.y + a.rect.height / 2 + b.rect.y + b.rect.height / 2) / 2)), 'text-anchor': 'middle' });
    labelEl.textContent = `${t.label}${t.homeCompanyId ? ` · ${t.homeCompanyId}` : ''}`;
    threadsSvg.appendChild(labelEl);
  }

  function render(): void {
    if (destroyed) return;
    st.updates++;
    root.dataset.scope = scene ? (scene.focus.kind === 'portfolio' ? 'portfolio' : 'company') : 'portfolio';
    paintWorldTable();
    if (!scene) {
      relief?.update(null);
      for (const [, e] of live) { e.remove(); st.domRemoved++; }
      live.clear();
      for (const [, p] of threadEls) p.remove();
      threadEls.clear();
      st.total = st.visible = st.rich = st.simple = st.threads = st.threadsVisible = 0;
      return;
    }
    nodesById.clear();
    for (const n of scene.nodes) nodesById.set(n.id, n);
    const vis = visibleRect(camera, viewport, 160);
    // Roving tab stop: selected, else focused, else previous if still eligible, else first visible interactive node.
    const eligible = (n: SceneNode) => intersects(n.rect, vis);
    const interactive = scene.nodes.filter((n) => n.kind !== 'fallback' || true);
    let tab = tabId && nodesById.get(tabId) && eligible(nodesById.get(tabId)!) ? tabId : null;
    if (selectedId && nodesById.get(selectedId) && eligible(nodesById.get(selectedId)!)) tab = selectedId;
    else if (focusedId && nodesById.get(focusedId)) tab = focusedId;
    if (!tab) tab = (interactive.find(eligible) ?? null)?.id ?? null;
    tabId = tab;
    const cands = scene.nodes.filter((n) => n.id === selectedId || n.id === focusedId || n.id === tabId || intersects(n.rect, vis));
    // Keep the parent footprint and its company marker reachable before detail.
    // Dense teams still have an independent searchable native record list.
    const rank = (n: SceneNode) => n.id === selectedId || n.id === focusedId || n.id === tabId ? 0
      : n.metadata['companyFootprint'] === true || n.metadata['companyMarker'] === true ? 1
        : n.kind === 'office' || n.kind === 'room' ? 2 : 3;
    const distance = (r: Rect): number => {
      const dx = Math.max(r.x - camera.x, 0, camera.x - r.x - r.width);
      const dy = Math.max(r.y - camera.y, 0, camera.y - r.y - r.height);
      return dx * dx + dy * dy;
    };
    const companyDistance = new Map<string, number>();
    for (const n of cands) if (n.companyId && n.metadata['companyFootprint'] === true) companyDistance.set(n.companyId, distance(n.rect));
    const proximity = (n: SceneNode) => companyDistance.get(n.companyId ?? '') ?? distance(n.rect);
    // Preserve active focus, then spend the budget near the camera. The
    // conservative horizon extent must not select only the first stored firms.
    const sorted = [...cands].sort((a, b) => Number(rank(b) === 0) - Number(rank(a) === 0)
      || proximity(a) - proximity(b) || rank(a) - rank(b) || distance(a.rect) - distance(b.rect)
      || a.rect.width * a.rect.height - b.rect.width * b.rect.height);
    const chosen = sorted.slice(0, RICH_NODE_BUDGET);
    const chosenIds = new Set(chosen.map((n) => n.id));
    st.capped = cands.length > chosen.length;
    const pxZoom = camera.zoom;
    let rich = 0, simple = 0;
    // Draw order: parents before children (original scene order).
    for (const n of scene.nodes) {
      if (!chosenIds.has(n.id)) continue;
      const lod: 'rich' | 'simple' = pxZoom < 0.25 && (n.kind === 'folio' || n.kind === 'office' || n.kind === 'room') ? 'simple' : pxZoom < 0.12 ? 'simple' : 'rich';
      lod === 'rich' ? rich++ : simple++;
      let e = live.get(n.id);
      if (!e) { e = buildNode(n); live.set(n.id, e); nodeLayer.appendChild(e); st.domCreated++; }
      fillNode(e, n, lod, n.id === selectedId, n.id === tabId);
      e.dataset.gpuSurface = String(gpuSurfaces.has(n.id));
    }
    for (const [id, e] of live) {
      if (chosenIds.has(id)) continue;
      if (e === document.activeElement) focusedId = id;
      e.remove(); live.delete(id); st.domRemoved++;
    }
    // Threads: only those touching visible nodes, bounded.
    let tv = 0;
    const keep = new Set<string>();
    for (const t of scene.threads) {
      if (tv >= THREAD_BUDGET) break;
      if (!(chosenIds.has(t.fromId) || chosenIds.has(t.toId) || t.id === selectedThread)) continue;
      const d = threadPath(t);
      if (!d) continue;
      keep.add(t.id); tv++;
      let p = threadEls.get(t.id);
      if (!p) {
        p = svg('path', { fill: 'none' });
        p.dataset.threadId = t.id;
        threadsSvg.insertBefore(p, threadsSvg.firstChild);
        threadEls.set(t.id, p);
      }
      p.setAttribute('d', d);
      p.dataset.kind = t.kind;
      const kindClass = t.kind === 'service-contract' ? 'contract' : t.kind === 'shared-staff' ? 'staff' : t.kind === 'company-parent' ? 'hierarchy' : 'ownership';
      p.setAttribute('class', `ff-thread ff-thread--${kindClass}${t.id === selectedThread ? ' ff-thread--focus' : ''}`);
      if (t.kind === 'company-parent') {
        p.style.stroke = 'var(--connection)';
        p.style.strokeDasharray = 'none';
      } else {
        p.style.removeProperty('stroke');
        p.style.removeProperty('stroke-dasharray');
      }
    }
    for (const [id, p] of threadEls) if (!keep.has(id)) { p.remove(); threadEls.delete(id); }
    st.total = scene.nodes.length; st.visible = chosen.length; st.rich = rich; st.simple = simple;
    st.threads = scene.threads.length; st.threadsVisible = tv;
    st.message = `Showing ${chosen.length} of ${scene.nodes.length} nodes${st.capped ? ' (render budget reached; use the list for all records)' : ''}`;
    budget.textContent = st.message;
    relief?.update(scene);
    paintThreadLabel();
    updateCaption();
    paintCamera();
  }

  function setEmpty(state: 'empty' | 'loading' | 'missing' | null, text = ''): void {
    empty.hidden = !state;
    if (state) { empty.dataset.state = state; empty.textContent = text; }
  }

  function emitSelect(id: string | null): void {
    if (silent || destroyed) return;
    callbacks.onSelect?.(id, id ? nodesById.get(id) ?? null : null);
  }

  /** Clear selection state (node + thread) and notify only for what actually changed. */
  function clearSelection(): void {
    const hadNode = selectedId !== null;
    const hadThread = selectedThread !== null;
    selectedId = null; selectedThread = null;
    if (hadNode) emitSelect(null);
    if (hadThread && !silent && !destroyed) callbacks.onThreadSelect?.(null);
  }

  function revealIfOffscreen(id: string): void {
    const n = nodesById.get(id);
    if (!n || destroyed) return;
    if (!intersects(n.rect, visibleRect(camera, viewport, 0))) callbacks.onRevealNode?.(n);
  }

  function sceneSig(s: FreeflowScene | null): string { return s ? JSON.stringify(s.focus) : ''; }

  function moveTab(to: SceneNode | undefined, focusIt: boolean): void {
    if (!to) return;
    tabId = to.id;
    focusedId = to.id;
    render();
    const e = live.get(to.id);
    if (e && focusIt) e.focus({ preventScroll: true });
    revealIfOffscreen(to.id);
  }

  /** Reading-order traversal of the nodes currently eligible (visible or selected). */
  function traversal(): SceneNode[] {
    if (!scene) return [];
    const vis = visibleRect(camera, viewport, 0);
    return scene.nodes
      .filter((n) => n.id === selectedId || intersects(n.rect, vis))
      .sort((a, b) => a.rect.y - b.rect.y || a.rect.x - b.rect.x || (a.id < b.id ? -1 : 1));
  }

  function doSelect(id: string | null, emit: boolean): void {
    if (selectedId === id) return;
    const prev = selectedId ? live.get(selectedId) : null;
    selectedId = id;
    if (prev) { prev.classList.remove('is-selected'); prev.setAttribute('aria-pressed', 'false'); prev.tabIndex = -1; }
    const cur = id ? live.get(id) : null;
    if (cur) { cur.classList.add('is-selected'); cur.setAttribute('aria-pressed', 'true'); cur.tabIndex = 0; }
    updateCaption();
    if (emit) emitSelect(id);
  }

  const nodeAt = (t: EventTarget | null): string | null => {
    const e = (t as HTMLElement | null)?.closest?.('.ff-node') as HTMLElement | null;
    return e?.dataset.nodeId ?? null;
  };
  const onClick = (ev: MouseEvent) => {
    const id = nodeAt(ev.target);
    const action = (ev.target as HTMLElement).closest<HTMLButtonElement>('button[data-canvas-action]')?.dataset.canvasAction;
    if (action && id && ['chat', 'roadmap', 'whiteboard', 'ownership', 'hire'].includes(action)) {
      const node = nodesById.get(id); if (node) callbacks.onCanvasAction?.(action as CanvasNodeAction, node);
      ev.stopPropagation(); return;
    }
    if ((ev.target as HTMLElement).closest?.('.ff-node-open') && id) { const n = nodesById.get(id); if (n) callbacks.onOpen?.(n); return; }
    if (id) { doSelect(id, true); live.get(id)?.focus({ preventScroll: true }); }
  };
  const onDbl = (ev: MouseEvent) => { if ((ev.target as HTMLElement).closest?.('button[data-canvas-action]')) return; const id = nodeAt(ev.target); const n = id ? nodesById.get(id) : null; if (n) callbacks.onOpen?.(n); };
  const onKey = (ev: KeyboardEvent) => {
    if ((ev.target as HTMLElement).closest?.('button[data-canvas-action]')) return;
    const id = nodeAt(ev.target);
    const handle = () => { ev.preventDefault(); ev.stopPropagation(); };
    if (!id) {
      if (ev.key === 'Escape') { handle(); clearSelection(); return; }
      // Canvas root focus: Arrow/Home/End enters the node traversal.
      if (ev.target === root && ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'Home', 'End'].includes(ev.key)) {
        const list = traversal();
        if (!list.length) return;
        handle();
        moveTab(ev.key === 'End' || ev.key === 'ArrowLeft' || ev.key === 'ArrowUp' ? list[list.length - 1] : list[0], true);
      }
      return;
    }
    if (ev.key === 'Enter') { handle(); const n = nodesById.get(id); if (n) { doSelect(id, true); callbacks.onOpen?.(n); } }
    else if (ev.key === ' ') { handle(); doSelect(id, true); }
    else if (ev.key === 'Escape') { handle(); clearSelection(); }
    else if (['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'Home', 'End'].includes(ev.key)) {
      handle();
      const list = traversal();
      if (!list.length) return;
      const i = Math.max(0, list.findIndex((n) => n.id === id));
      const fwd = ev.key === 'ArrowRight' || ev.key === 'ArrowDown';
      const target = ev.key === 'Home' ? list[0] : ev.key === 'End' ? list[list.length - 1] : list[Math.min(list.length - 1, Math.max(0, i + (fwd ? 1 : -1)))];
      moveTab(target, true);
    }
  };
  const onFocusIn = (ev: FocusEvent) => {
    const id = nodeAt(ev.target);
    if (!id) return;
    focusedId = id;
    if (tabId !== id) {
      const old = tabId ? live.get(tabId) : null;
      if (old) old.tabIndex = -1;
      tabId = id;
      const cur = live.get(id);
      if (cur) cur.tabIndex = 0;
    }
    live.get(id)?.classList.add('is-focused');
  };
  const onFocusOut = (ev: FocusEvent) => { const id = nodeAt(ev.target); if (id) { live.get(id)?.classList.remove('is-focused'); if (focusedId === id) focusedId = null; } };
  root.addEventListener('click', onClick);
  root.addEventListener('dblclick', onDbl);
  root.addEventListener('keydown', onKey);
  root.addEventListener('focusin', onFocusIn);
  root.addEventListener('focusout', onFocusOut);

  let ro: ResizeObserver | null = null;
  const measure = () => {
    const w = host.clientWidth, h = host.clientHeight;
    if (!(w > 0 && h > 0) || (w === viewport.width && h === viewport.height)) return;
    viewport = { width: w, height: h };
    callbacks.onViewportChange?.({ ...viewport });
    render();
  };
  if (typeof ResizeObserver !== 'undefined') { ro = new ResizeObserver(measure); ro.observe(host); }
  else if (typeof window !== 'undefined') window.addEventListener('resize', measure);

  paintCamera();
  setEmpty('loading', 'Loading office…');

  return {
    elements: { root, table, world, threads: threadsSvg, caption, budget, empty },
    update(next, opts) {
      if (destroyed) return;
      const prevSig = sceneSig(scene);
      const hadScene = scene !== null;
      if (!next) {
        scene = null;
        clearSelection();
        focusedId = null; tabId = null;
        capTitle.textContent = ''; capSub.textContent = ''; budget.textContent = '';
        nodesById.clear();
        setEmpty(opts?.loading ? 'loading' : 'empty', opts?.loading ? 'Loading office…' : 'No scope selected.');
        render();
        return;
      }
      const scopeChanged = hadScene && prevSig !== sceneSig(next);
      scene = next;
      nodesById.clear();
      for (const n of next.nodes) nodesById.set(n.id, n);
      if (scopeChanged) { focusedId = null; tabId = null; clearSelection(); }
      if (!next.nodes.length) setEmpty(next.title.startsWith('Missing') ? 'missing' : 'empty', next.warnings[0] ?? 'Nothing to show in this scope.');
      else setEmpty(null);
      if (selectedId && !nodesById.has(selectedId)) { selectedId = null; emitSelect(null); }
      if (selectedThread && !next.threads.some((t) => t.id === selectedThread)) {
        selectedThread = null;
        if (!silent && !destroyed) callbacks.onThreadSelect?.(null);
      }
      render();
    },
    setCamera(c) {
      if (destroyed) return;
      camera = normalizeCamera(c);
      st.cameraUpdates++;
      render();
    },
    select(id) {
      if (id && !scene?.nodes.some((n) => n.id === id)) return;
      const changed = selectedId !== id;
      if (changed) {
        selectedId = id;
        if (id) tabId = id;
        render();
        silent++;
        try { if (id) revealIfOffscreen(id); } finally { silent--; }
      }
    },
    selectThread(id) {
      const next = id && scene?.threads.some((t) => t.id === id) ? id : null;
      if (next === selectedThread) return;
      selectedThread = next;
      callbacks.onThreadSelect?.(next ? scene!.threads.find((t) => t.id === next) ?? null : null);
      render();
    },
    getViewport: () => ({ ...viewport }),
    getCamera: () => ({ ...camera }),
    setActive: (active) => relief?.setActive(active),
    stats: () => ({ ...st }),
    destroy() {
      if (destroyed) return;
      destroyed = true;
      themeObserver?.disconnect(); themeObserver = null;
      relief?.destroy(); relief = null;
      silent = 1;
      root.removeEventListener('click', onClick);
      root.removeEventListener('dblclick', onDbl);
      root.removeEventListener('keydown', onKey);
      root.removeEventListener('focusin', onFocusIn);
      root.removeEventListener('focusout', onFocusOut);
      ro?.disconnect(); ro = null;
      if (typeof window !== 'undefined') window.removeEventListener('resize', measure);
      live.clear(); threadEls.clear(); nodesById.clear();
      root.remove();
      scene = null; selectedId = null; selectedThread = null; focusedId = null; tabId = null; labelEl = null;
    },
  };
}

export const createSceneRenderer = mountScene;
