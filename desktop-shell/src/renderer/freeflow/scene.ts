// Freeflow spatial scene renderer. Keyed DOM/CSS3D world layer; no bridge, storage or network access.
// Nothing executes on import. All snapshot-derived text is written via textContent.
//
// DOM CLASS CONTRACT (for the next CSS packet):
//   .ff-scene                 host root (role=application, tabindex=-1)
//   .ff-table                 tactile conference table / drafting mat (behind world)
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

export const RICH_NODE_BUDGET = 240;
export const THREAD_BUDGET = 160;
const SVGNS = 'http://www.w3.org/2000/svg';

export interface SceneCallbacks {
  onSelect?(nodeId: string | null, node: SceneNode | null): void;
  onOpen?(node: SceneNode): void;
  onViewportChange?(size: Size): void;
  onThreadSelect?(thread: SceneThread | null): void;
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
  const bits = [n.kind === 'reference' ? 'Contracted staff reference' : n.kind, n.label];
  if (n.subtitle) bits.push(n.subtitle);
  if (n.status) bits.push(`status ${n.status}`);
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

function buildNode(n: SceneNode): HTMLElement {
  const e = el('div', `ff-node ff-node--${n.kind}`);
  e.setAttribute('role', 'button');
  e.dataset.nodeId = n.id;
  e.dataset.kind = n.kind;
  e.appendChild(el('div', 'ff-node-paper'));
  return e;
}

function fillNode(e: HTMLElement, n: SceneNode, lod: 'rich' | 'simple', selected: boolean): void {
  e.style.cssText = `position:absolute;left:0;top:0;width:${Math.max(1, fin(n.rect.width))}px;height:${Math.max(1, fin(n.rect.height))}px;transform:translate(${fin(n.rect.x)}px,${fin(n.rect.y)}px)`;
  e.dataset.lod = lod;
  e.dataset.status = n.status;
  e.classList.toggle('is-selected', selected);
  e.setAttribute('aria-label', describeNode(n));
  e.setAttribute('aria-pressed', String(selected));
  e.tabIndex = selected ? 0 : -1;
  const key = `${n.label}|${n.subtitle}|${n.status}|${countsText(n)}|${lod}|${n.rect.width}x${n.rect.height}`;
  if (e.dataset.sig === key) return;
  e.dataset.sig = key;
  const paper = e.firstElementChild as HTMLElement;
  paper.replaceChildren(detailSvg(n, lod));
  const title = el('div', 'ff-node-title', n.label);
  paper.appendChild(title);
  if (lod === 'rich' || n.kind === 'folio') {
    if (n.subtitle) paper.appendChild(el('div', 'ff-node-sub', n.subtitle));
    if (n.kind === 'employee' || n.kind === 'reference') {
      const mono = n.metadata['monogram'];
      paper.insertBefore(el('div', 'ff-node-monogram', typeof mono === 'string' ? mono : '?'), title);
    }
    paper.appendChild(el('div', 'ff-node-status', n.status));
    const c = countsText(n);
    if (c && lod === 'rich') paper.appendChild(el('div', 'ff-node-counts', c));
    if (n.kind === 'folio' || n.kind === 'office' || n.kind === 'room') {
      const open = el('span', 'ff-node-open', 'Open ↵');
      open.setAttribute('aria-hidden', 'true');
      paper.appendChild(open);
    }
  }
}

export function mountScene(host: HTMLElement, callbacks: SceneCallbacks = {}): SceneRenderer {
  const root = el('div', 'ff-scene');
  root.setAttribute('role', 'application');
  root.setAttribute('aria-label', 'Freeflow spatial scene');
  root.tabIndex = -1;
  const table = el('div', 'ff-table');
  table.appendChild(el('div', 'ff-grid'));
  const world = el('div', 'ff-world');
  world.style.cssText = 'position:absolute;left:0;top:0;transform-origin:0 0;will-change:transform';
  const threadsSvg = svg('svg', { class: 'ff-threads', width: '1', height: '1', 'aria-hidden': 'true', focusable: 'false' });
  threadsSvg.style.cssText = 'position:absolute;left:0;top:0;overflow:visible;pointer-events:none';
  const nodeLayer = el('div', 'ff-nodes');
  world.append(threadsSvg, nodeLayer);
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
  let destroyed = false;
  const live = new Map<string, HTMLElement>();
  const threadEls = new Map<string, SVGPathElement>();
  const nodesById = new Map<string, SceneNode>();
  let labelEl: SVGTextElement | null = null;
  const st: SceneStats = { total: 0, visible: 0, rich: 0, simple: 0, threads: 0, threadsVisible: 0, domCreated: 0, domRemoved: 0, updates: 0, cameraUpdates: 0, capped: false, message: '' };

  function paintCamera(): void {
    world.style.transform = cameraTransform(camera, viewport);
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
    if (!scene) {
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
    const cands = scene.nodes.filter((n) => n.id === selectedId || n.id === focusedId || intersects(n.rect, vis));
    // Container-first ordering then smaller (more specific) nodes win the rich budget.
    const rank = (n: SceneNode) => (n.id === selectedId || n.id === focusedId ? 0 : 1);
    const sorted = [...cands].sort((a, b) => rank(a) - rank(b) || a.rect.width * a.rect.height - b.rect.width * b.rect.height);
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
      fillNode(e, n, lod, n.id === selectedId);
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
      p.setAttribute('class', `ff-thread ff-thread--${t.kind === 'service-contract' ? 'contract' : t.kind === 'shared-staff' ? 'staff' : 'ownership'}${t.id === selectedThread ? ' ff-thread--focus' : ''}`);
    }
    for (const [id, p] of threadEls) if (!keep.has(id)) { p.remove(); threadEls.delete(id); }
    st.total = scene.nodes.length; st.visible = chosen.length; st.rich = rich; st.simple = simple;
    st.threads = scene.threads.length; st.threadsVisible = tv;
    st.message = `Showing ${chosen.length} of ${scene.nodes.length} nodes${st.capped ? ' (render budget reached; use the list for all records)' : ''}`;
    budget.textContent = st.message;
    paintThreadLabel();
    updateCaption();
    paintCamera();
  }

  function setEmpty(state: 'empty' | 'loading' | 'missing' | null, text = ''): void {
    empty.hidden = !state;
    if (state) { empty.dataset.state = state; empty.textContent = text; }
  }

  function emitSelect(id: string | null): void {
    callbacks.onSelect?.(id, id ? nodesById.get(id) ?? null : null);
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
    if ((ev.target as HTMLElement).closest?.('.ff-node-open') && id) { const n = nodesById.get(id); if (n) callbacks.onOpen?.(n); return; }
    if (id) { doSelect(id, true); live.get(id)?.focus({ preventScroll: true }); }
  };
  const onDbl = (ev: MouseEvent) => { const id = nodeAt(ev.target); const n = id ? nodesById.get(id) : null; if (n) callbacks.onOpen?.(n); };
  const onKey = (ev: KeyboardEvent) => {
    const id = nodeAt(ev.target);
    if (!id) { if (ev.key === 'Escape') { doSelect(null, true); } return; }
    if (ev.key === 'Enter') { ev.preventDefault(); const n = nodesById.get(id); if (n) callbacks.onOpen?.(n); }
    else if (ev.key === ' ') { ev.preventDefault(); doSelect(id, true); }
    else if (ev.key === 'Escape') { doSelect(null, true); }
  };
  const onFocusIn = (ev: FocusEvent) => { const id = nodeAt(ev.target); if (id) { focusedId = id; live.get(id)?.classList.add('is-focused'); } };
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
      const prevCompany = scene?.focus;
      scene = next;
      if (!next) {
        setEmpty(opts?.loading ? 'loading' : 'empty', opts?.loading ? 'Loading office…' : 'No scope selected.');
        selectedId = null; selectedThread = null; focusedId = null; render();
        return;
      }
      if (prevCompany && JSON.stringify(prevCompany) !== JSON.stringify(next.focus)) { selectedId = null; selectedThread = null; }
      if (!next.nodes.length) setEmpty(next.title.startsWith('Missing') ? 'missing' : 'empty', next.warnings[0] ?? 'Nothing to show in this scope.');
      else setEmpty(null);
      if (selectedId && !next.nodes.some((n) => n.id === selectedId)) selectedId = null;
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
      if (changed) { selectedId = id; render(); emitSelect(id); }
    },
    selectThread(id) {
      selectedThread = id && scene?.threads.some((t) => t.id === id) ? id : null;
      callbacks.onThreadSelect?.(selectedThread ? scene!.threads.find((t) => t.id === selectedThread) ?? null : null);
      render();
    },
    getViewport: () => ({ ...viewport }),
    getCamera: () => ({ ...camera }),
    stats: () => ({ ...st }),
    destroy() {
      if (destroyed) return;
      destroyed = true;
      root.removeEventListener('click', onClick);
      root.removeEventListener('dblclick', onDbl);
      root.removeEventListener('keydown', onKey);
      root.removeEventListener('focusin', onFocusIn);
      root.removeEventListener('focusout', onFocusOut);
      ro?.disconnect(); ro = null;
      if (typeof window !== 'undefined') window.removeEventListener('resize', measure);
      live.clear(); threadEls.clear(); nodesById.clear();
      root.remove();
      scene = null;
    },
  };
}

export const createSceneRenderer = mountScene;
