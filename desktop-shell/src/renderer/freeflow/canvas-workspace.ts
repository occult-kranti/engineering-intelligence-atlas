// One persistent, view-only layer of live application surfaces inside the Freeflow world.
// Reparenting preserves form identity, handlers and drafts. No bridge or native calls belong here.
import { isVisible, normalizeCamera, worldToScreen, type Camera, type Point, type Size } from './camera.js';
import {
  closePanel, dragPanelRect, focusPanel, framePanelCamera, normalizeWorkspaceState,
  parseWorkspaceState, resizePanelRect, revealPanel, sampleCameraFlight,
  serializeWorkspaceState, setPanelCollapsed, setPanelPinned, updatePanelRect, visiblePanelRect,
  type CanvasPanelSpec, type CanvasPanelState, type WorkspaceState,
} from './workspace.js';

export const CANVAS_LAYOUT_KEY = 'daftar.endless-workspace.layout.v1';
export interface CanvasWorkspacePanel extends CanvasPanelSpec { element: HTMLElement; icon?: string; group?: string }
export interface CanvasWorkspaceOptions {
  world: HTMLElement;
  viewport: HTMLElement;
  getCamera(): Camera;
  setCamera(camera: Camera): void;
  stopMotion(): void;
  showCanvas(): void;
  /** Screen-space space reserved for the host's navigation instruments. */
  getFrameInsets?(): { top: number; bottom: number; left: number; right: number };
  panels: CanvasWorkspacePanel[];
  onPanelChange?(id: string, open: boolean): void;
  onHome?(): void;
  storage?: Storage | null;
}
export interface CanvasWorkspace {
  open(id: string, options?: { frame?: boolean; nearCamera?: boolean }): void;
  close(id: string): void;
  isOpen(id: string): boolean;
  revealElement(element: HTMLElement): boolean;
  refresh(): void;
  destroy(): void;
  elements: { layer: HTMLElement; launcher: HTMLElement };
}
interface LivePanel {
  spec: CanvasWorkspacePanel;
  wrapper: HTMLElement;
  body: HTMLElement;
  grip: HTMLButtonElement;
  pin: HTMLButtonElement;
  collapse: HTMLButtonElement;
  resize: HTMLButtonElement;
  arrange: HTMLButtonElement;
  arrangement: HTMLElement;
  arrangementClose: HTMLButtonElement;
  arrangementSteps: HTMLButtonElement[];
  arrangementStatus: HTMLElement;
  marker: Comment;
  wasHidden: boolean;
  hadHiddenClass: boolean;
}
interface Gesture {
  id: string; pointerId: number; kind: 'drag' | 'resize'; handle: HTMLElement;
  start: Point; camera: Camera; viewport: Size; rect: CanvasPanelState['rect'];
}
let instanceSequence = 0;

export function mountCanvasWorkspace(host: HTMLElement, options: CanvasWorkspaceOptions): CanvasWorkspace {
  const doc = host.ownerDocument;
  const win = doc.defaultView!;
  const mk = <K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, text?: string): HTMLElementTagNameMap[K] => {
    const element = doc.createElement(tag); element.className = cls;
    if (text !== undefined) element.textContent = text;
    return element;
  };
  const button = (cls: string, label: string, text: string): HTMLButtonElement => {
    const element = mk('button', cls, text); element.type = 'button'; element.title = label; element.setAttribute('aria-label', label); return element;
  };
  const layer = mk('div', 'canvas-panel-layer');
  layer.style.cssText = 'position:absolute;left:0;top:0;transform-style:preserve-3d';
  options.world.append(layer);
  const launcher = mk('nav', 'canvas-launcher'); launcher.setAttribute('aria-label', 'Workspace surfaces');
  const home = button('canvas-home', 'Return to the blueprint world', 'Home');
  const finder = button('canvas-find', 'Find a surface', 'Find a surface');
  const shortcuts = mk('div', 'canvas-shortcuts');
  const palette = mk('section', 'canvas-palette'); palette.hidden = true;
  palette.id = `canvas-palette-${++instanceSequence}`; palette.setAttribute('aria-label', 'Find a surface');
  finder.setAttribute('aria-controls', palette.id); finder.setAttribute('aria-expanded', 'false');
  const searchLabel = mk('label', 'canvas-search-label', 'Find a surface');
  const search = mk('input', 'canvas-search'); search.type = 'search'; search.placeholder = 'Search tools, people, settings…'; search.autocomplete = 'off';
  searchLabel.append(search);
  const results = mk('div', 'canvas-search-results');
  const status = mk('span', 'canvas-layout-status'); status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
  palette.append(searchLabel, results); launcher.append(home, finder, shortcuts, palette, status); host.append(launcher);

  let storage: Storage | null = options.storage ?? null;
  if (options.storage === undefined) try { storage = win.localStorage; } catch { /* Session-only layout. */ }
  let saved: string | null = null;
  try { saved = storage?.getItem(CANVAS_LAYOUT_KEY) ?? null; } catch { /* Session-only layout. */ }
  let state = parseWorkspaceState(saved, options.panels);
  const live = new Map<string, LivePanel>();
  const shortButtons = new Map<string, HTMLButtonElement>();
  const seen = new Set(saved ? state.panels.map((p) => p.id) : state.panels.filter((p) => p.open).map((p) => p.id));
  let destroyed = false, focusGuard = false, storageFailed = false;
  let gesture: Gesture | null = null;
  let flightFrame = 0, flightId: string | null = null, flightTarget: Camera | null = null;
  let lastPointerAt = -Infinity, suppressClick = false;
  let clickHandle: HTMLElement | null = null, clickUntil = 0, pendingFrame: string | null = null;
  let arrangedId: string | null = null;
  const mq = typeof win.matchMedia === 'function' ? win.matchMedia('(prefers-reduced-motion: reduce)') : null;
  const current = (id: string): CanvasPanelState | undefined => state.panels.find((p) => p.id === id);
  const size = (): Size => ({ width: Math.max(1, options.viewport.clientWidth), height: Math.max(1, options.viewport.clientHeight) });
  const point = (event: PointerEvent): Point => { const r = options.viewport.getBoundingClientRect(); return { x: event.clientX - r.left, y: event.clientY - r.top }; };
  const safeFocus = (element: HTMLElement): void => { focusGuard = true; try { element.focus({ preventScroll: true }); } finally { focusGuard = false; } };
  function persist(): void {
    if (!storage || destroyed) return;
    try { storage.setItem(CANVAS_LAYOUT_KEY, serializeWorkspaceState(state)); }
    catch { if (!storageFailed) status.textContent = 'Layout changes remain available for this session.'; storageFailed = true; }
  }
  function cancelFlight(): void {
    if (flightFrame) win.cancelAnimationFrame(flightFrame);
    flightFrame = 0; flightId = null; flightTarget = null; pendingFrame = null;
  }
  function frame(id: string): void {
    const panel = current(id); if (!panel?.open || destroyed) return;
    cancelFlight(); options.stopMotion();
    if (!(options.viewport.clientWidth > 0 && options.viewport.clientHeight > 0)) { pendingFrame = id; return; }
    const from = normalizeCamera(options.getCamera());
    const vp = size();
    const requested = options.getFrameInsets?.();
    const bound = (value: number | undefined, limit: number) => Number.isFinite(value) ? Math.max(0, Math.min(limit, value!)) : 0;
    const top = bound(requested?.top, vp.height * .35), bottom = bound(requested?.bottom, vp.height * .35);
    const left = bound(requested?.left, vp.width * .25), right = bound(requested?.right, vp.width * .25);
    const target = framePanelCamera({ ...from, pitch: 0, yaw: 0 }, {width: vp.width-left-right, height: vp.height-top-bottom}, visiblePanelRect(panel), requested ? 8 : 40);
    target.zoom = Math.min(1.25, target.zoom);
    target.x -= (left-right) / (2 * target.zoom);
    target.y -= (top-bottom) / (2 * target.zoom);
    if (mq?.matches || doc.hidden) { options.setCamera(target); return; }
    flightId = id; flightTarget = target;
    let started: number | null = null;
    const tick = (now: number): void => {
      if (destroyed || flightId !== id) return;
      started ??= now;
      const sample = sampleCameraFlight(from, target, now - started);
      options.setCamera(sample.camera);
      if (sample.done) { flightFrame = 0; flightId = null; flightTarget = null; }
      else flightFrame = win.requestAnimationFrame(tick);
    };
    flightFrame = win.requestAnimationFrame(tick);
  }
  function render(): void {
    if (destroyed) return;
    for (const panel of state.panels) {
      const entry = live.get(panel.id); if (!entry) continue;
      const rect = visiblePanelRect(panel);
      entry.wrapper.hidden = !panel.open;
      entry.wrapper.style.cssText = `position:absolute;left:0;top:0;width:${rect.width}px;height:${rect.height}px;transform:translate3d(${rect.x}px,${rect.y}px,0);z-index:${panel.z + 10}`;
      entry.wrapper.classList.toggle('is-active', state.activeId === panel.id);
      entry.wrapper.classList.toggle('is-pinned', panel.pinned);
      entry.wrapper.classList.toggle('is-collapsed', panel.collapsed);
      entry.wrapper.dataset.open = String(panel.open);
      entry.body.hidden = panel.collapsed;
      entry.spec.element.hidden = !panel.open;
      entry.spec.element.classList.toggle('hidden', !panel.open);
      entry.pin.setAttribute('aria-pressed', String(panel.pinned));
      entry.pin.title = panel.pinned ? 'Unlock position' : 'Lock position';
      entry.pin.setAttribute('aria-label', `${panel.pinned ? 'Unlock' : 'Lock'} ${entry.spec.title || panel.id} position`);
      entry.collapse.textContent = panel.collapsed ? '+' : '−';
      entry.collapse.setAttribute('aria-expanded', String(!panel.collapsed));
      entry.collapse.setAttribute('aria-label', `${panel.collapsed ? 'Expand' : 'Collapse'} ${entry.spec.title || panel.id}`);
      entry.resize.hidden = panel.collapsed; entry.resize.disabled = panel.pinned;
      entry.grip.setAttribute('aria-disabled', String(panel.pinned));
      entry.arrange.disabled = !panel.open || panel.pinned || panel.collapsed;
      entry.arrange.title = panel.pinned ? 'Unlock this surface to arrange it.' : panel.collapsed ? 'Expand this surface to arrange it.' : `Arrange ${entry.spec.title || panel.id}`;
      for (const step of entry.arrangementSteps) step.disabled = entry.arrange.disabled;
      if (arrangedId === panel.id && entry.arrange.disabled) closeArrangement(entry.arrangement.contains(doc.activeElement));
      const short = shortButtons.get(panel.id);
      short?.setAttribute('aria-pressed', String(panel.open));
      short?.classList.toggle('is-active', state.activeId === panel.id);
    }
  }
  function endGesture(commit: boolean): void {
    const previous = gesture; if (!previous) return;
    gesture = null;
    const entry = live.get(previous.id);
    if (!commit) state = updatePanelRect(state, previous.id, previous.rect, entry?.spec);
    if (!commit) { suppressClick = false; clickHandle = null; }
    else if (suppressClick) { clickHandle = previous.handle; clickUntil = performance.now() + 500; }
    try { previous.handle.releasePointerCapture(previous.pointerId); } catch { /* Already lost capture. */ }
    entry?.wrapper.classList.remove('is-moving', 'is-resizing');
    render(); if (commit) persist();
  }
  function activate(id: string): void {
    const next = focusPanel(state, id);
    if (next !== state) { state = next; render(); persist(); }
  }
  function closeArrangement(restoreFocus = false): void {
    if (!arrangedId) return;
    const id = arrangedId, entry = live.get(id); arrangedId = null;
    if (!entry) return;
    entry.arrangement.hidden = true; entry.arrange.setAttribute('aria-expanded', 'false');
    if (restoreFocus && !destroyed && current(id)?.open) safeFocus(entry.arrange.disabled ? entry.grip : entry.arrange);
  }
  function toggleArrangement(id: string): void {
    const entry = live.get(id), panel = current(id);
    if (destroyed || !entry || !panel?.open || panel.pinned || panel.collapsed) return;
    if (arrangedId === id) { closeArrangement(true); return; }
    closeArrangement(); cancelFlight(); options.stopMotion(); endGesture(false); activate(id);
    arrangedId = id; entry.arrangement.hidden = false; entry.arrange.setAttribute('aria-expanded', 'true');
    entry.arrangementStatus.textContent = 'Each click changes layout by 20 world units.';
    safeFocus(entry.arrangementSteps[0]!);
  }
  function arrangeStep(id: string, axis: keyof CanvasPanelState['rect'], delta: number): void {
    const entry = live.get(id), panel = current(id);
    if (destroyed || !entry || arrangedId !== id || entry.arrangement.hidden || !panel?.open || panel.pinned || panel.collapsed) return;
    cancelFlight(); options.stopMotion(); endGesture(false);
    const before = state, rect = current(id)!.rect;
    state = updatePanelRect(state, id, { ...rect, [axis]: rect[axis] + delta }, entry.spec);
    render();
    if (state === before) entry.arrangementStatus.textContent = 'The surface has reached its layout limit.';
    else {
      persist(); const next = current(id)!.rect;
      entry.arrangementStatus.textContent = `Position ${Math.round(next.x)}, ${Math.round(next.y)}. Size ${Math.round(next.width)} by ${Math.round(next.height)}.`;
    }
  }
  function open(id: string, settings: { frame?: boolean; nearCamera?: boolean } = {}): void {
    if (destroyed || !live.has(id)) return;
    closeArrangement();
    endGesture(false); options.showCanvas(); options.stopMotion();
    const wasOpen = current(id)!.open;
    // New surfaces start at a usable reading width on phones. A saved or locked
    // world position is never silently resized when switching devices or views.
    if (!seen.has(id) && !current(id)!.pinned && options.viewport.clientWidth > 0 && options.viewport.clientWidth <= 650) {
      const p = current(id)!, vp = size(), inset = options.getFrameInsets?.();
      state = updatePanelRect(state, id, { ...p.rect, width: Math.min(p.rect.width, vp.width - 32), height: Math.min(p.rect.height, Math.max(260, vp.height - (inset?.top ?? 80) - (inset?.bottom ?? 80))) }, live.get(id)!.spec);
    }
    if (!seen.has(id) && settings.nearCamera && !current(id)!.pinned) {
      const p = current(id)!; const c = normalizeCamera(options.getCamera());
      state = updatePanelRect(state, id, { ...p.rect, x: c.x - p.rect.width / 2, y: c.y - p.rect.height / 2 }, live.get(id)!.spec);
    }
    seen.add(id); state = revealPanel(state, id); render(); persist();
    if (!wasOpen) { options.onPanelChange?.(id, true); render(); }
    if (settings.frame !== false) frame(id); else cancelFlight();
    safeFocus(live.get(id)!.grip);
  }
  function close(id: string): void {
    if (destroyed || !current(id)?.open) return;
    if (gesture?.id === id) endGesture(false);
    if (flightId === id) cancelFlight();
    const hadFocus = live.get(id)?.wrapper.contains(doc.activeElement);
    state = closePanel(state, id); render(); persist(); options.onPanelChange?.(id, false); render();
    if (hadFocus) safeFocus(state.activeId ? live.get(state.activeId)!.grip : shortButtons.get(id) ?? finder);
  }
  function begin(event: PointerEvent, id: string, kind: Gesture['kind']): void {
    if (destroyed || event.button !== 0 || !current(id)?.open || current(id)!.pinned) return;
    event.preventDefault(); event.stopPropagation(); cancelFlight(); options.stopMotion(); endGesture(false); activate(id);
    suppressClick = false; clickHandle = null;
    const handle = event.currentTarget as HTMLElement; const panel = current(id)!;
    gesture = { id, kind, handle, pointerId: event.pointerId, rect: { ...panel.rect }, start: point(event), camera: normalizeCamera(options.getCamera()), viewport: size() };
    live.get(id)!.wrapper.classList.add(kind === 'drag' ? 'is-moving' : 'is-resizing');
    try { handle.setPointerCapture(event.pointerId); } catch { /* Window listeners retain the gesture. */ }
    safeFocus(handle);
  }
  const move = (event: PointerEvent): void => {
    if (!gesture || event.pointerId !== gesture.pointerId) return;
    event.preventDefault();
    const g = gesture, spec = live.get(g.id)!.spec, end = point(event);
    const rect = g.kind === 'drag' ? dragPanelRect(g.rect, g.start, end, g.camera, g.viewport, spec) : resizePanelRect(g.rect, g.start, end, g.camera, g.viewport, 'se', spec);
    if (Math.hypot(end.x - g.start.x, end.y - g.start.y) > 3) suppressClick = true;
    state = updatePanelRect(state, g.id, rect, spec); render();
  };
  const finish = (event: PointerEvent): void => { if (gesture?.pointerId === event.pointerId) endGesture(event.type === 'pointerup'); };
  function keyboard(event: KeyboardEvent, id: string, kind: Gesture['kind']): void {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
    event.preventDefault(); event.stopPropagation();
    if (current(id)?.pinned) { status.textContent = 'Unlock this surface to move or resize it.'; return; }
    cancelFlight(); options.stopMotion(); endGesture(false);
    const panel = current(id)!; const amount = event.shiftKey ? 100 : 20;
    const dx = event.key === 'ArrowRight' ? amount : event.key === 'ArrowLeft' ? -amount : 0;
    const dy = event.key === 'ArrowDown' ? amount : event.key === 'ArrowUp' ? -amount : 0;
    const rect = kind === 'drag' ? { ...panel.rect, x: panel.rect.x + dx, y: panel.rect.y + dy } : { ...panel.rect, width: panel.rect.width + dx, height: panel.rect.height + dy };
    state = updatePanelRect(state, id, rect, live.get(id)!.spec); render(); persist();
  }
  function setPalette(show: boolean): void {
    palette.hidden = !show; finder.setAttribute('aria-expanded', String(show));
    if (show) { search.value = ''; renderSearch(); safeFocus(search); } else safeFocus(finder);
  }
  function renderSearch(): void {
    const query = search.value.trim().toLocaleLowerCase(); results.replaceChildren();
    for (const [id, entry] of live) {
      const title = entry.spec.title || id;
      if (query && !`${title} ${entry.spec.group || ''} ${id}`.toLocaleLowerCase().includes(query)) continue;
      const pick = button('canvas-search-result', `Open ${title}`, title); pick.dataset.canvasOpen = id;
      if (entry.spec.group) pick.append(mk('small', '', entry.spec.group));
      pick.onclick = () => { palette.hidden = true; finder.setAttribute('aria-expanded', 'false'); open(id); };
      results.append(pick);
    }
    if (!results.childElementCount) results.append(mk('p', 'canvas-search-empty', 'No surfaces match. Try another name.'));
  }

  for (const panel of state.panels) {
    const spec = options.panels.find((p) => p.id === panel.id)!;
    // A single live DOM element can belong to only one registered panel.
    if ([...live.values()].some((p) => p.spec.element === spec.element) || spec.element === options.world || spec.element.contains(options.world)) continue;
    const wrapper = mk('section', 'canvas-panel'); wrapper.dataset.panelId = spec.id; wrapper.setAttribute('aria-label', spec.title || spec.id);
    const titlebar = mk('header', 'canvas-panel-titlebar');
    const grip = button('canvas-panel-grip', `Move ${spec.title || spec.id}. Arrow keys move; Shift moves farther.`, spec.title || spec.id);
    if (spec.icon) grip.prepend(mk('span', 'canvas-panel-icon', spec.icon));
    const controls = mk('div', 'canvas-panel-controls');
    const focus = button('canvas-panel-focus', `Focus ${spec.title || spec.id}`, '↗');
    const arrange = button('canvas-panel-arrange', `Arrange ${spec.title || spec.id}`, 'Arrange');
    const pin = button('canvas-panel-pin', `Lock ${spec.title || spec.id} position`, '◇');
    const collapse = button('canvas-panel-collapse', `Collapse ${spec.title || spec.id}`, '−');
    const dismiss = button('canvas-panel-close', `Close ${spec.title || spec.id}`, '×');
    controls.append(arrange, focus, pin, collapse, dismiss); titlebar.append(grip, controls);
    const arrangement = mk('section', 'canvas-arrange-popup'); arrangement.hidden = true;
    arrangement.id = `${palette.id}-arrange-${live.size}`; arrangement.setAttribute('role', 'group'); arrangement.setAttribute('aria-label', `Arrange ${spec.title || spec.id}`);
    arrange.setAttribute('aria-controls', arrangement.id); arrange.setAttribute('aria-expanded', 'false');
    const arrangementHeading = mk('div', 'canvas-arrange-heading');
    const arrangementClose = button('canvas-arrange-close', `Close arrangement controls for ${spec.title || spec.id}`, '×');
    arrangementHeading.append(mk('h3', '', 'Arrange surface'), arrangementClose);
    const movement = mk('div', 'canvas-arrange-move'), sizing = mk('div', 'canvas-arrange-size');
    movement.setAttribute('role', 'group'); movement.setAttribute('aria-label', 'Move surface');
    sizing.setAttribute('role', 'group'); sizing.setAttribute('aria-label', 'Resize surface');
    const arrangementSteps: HTMLButtonElement[] = [];
    const steps: Array<{ name: string; label: string; text: string; axis: keyof CanvasPanelState['rect']; delta: number }> = [
      { name: 'left', label: 'Move left', text: '← Left', axis: 'x', delta: -20 },
      { name: 'right', label: 'Move right', text: 'Right →', axis: 'x', delta: 20 },
      { name: 'up', label: 'Move up', text: '↑ Up', axis: 'y', delta: -20 },
      { name: 'down', label: 'Move down', text: 'Down ↓', axis: 'y', delta: 20 },
      { name: 'narrower', label: 'Make narrower', text: 'Narrower', axis: 'width', delta: -20 },
      { name: 'wider', label: 'Make wider', text: 'Wider', axis: 'width', delta: 20 },
      { name: 'shorter', label: 'Make shorter', text: 'Shorter', axis: 'height', delta: -20 },
      { name: 'taller', label: 'Make taller', text: 'Taller', axis: 'height', delta: 20 },
    ];
    for (const step of steps) {
      const control = button('canvas-arrange-step', `${step.label}: ${spec.title || spec.id}`, step.text);
      control.dataset.arrangeAction = step.name; control.onclick = () => arrangeStep(spec.id, step.axis, step.delta);
      (step.axis === 'x' || step.axis === 'y' ? movement : sizing).append(control); arrangementSteps.push(control);
    }
    const arrangementStatus = mk('p', 'canvas-arrange-status'); arrangementStatus.setAttribute('role', 'status'); arrangementStatus.setAttribute('aria-live', 'polite');
    arrangement.append(arrangementHeading, mk('p', 'canvas-arrange-label', 'Move'), movement, mk('p', 'canvas-arrange-label', 'Resize'), sizing, arrangementStatus);
    const body = mk('div', 'canvas-panel-body');
    const resize = button('canvas-panel-resize', `Resize ${spec.title || spec.id}. Arrow keys resize; Shift resizes farther.`, '↘');
    const marker = doc.createComment(`canvas surface ${spec.id}`); spec.element.parentNode?.insertBefore(marker, spec.element);
    const entry: LivePanel = { spec, wrapper, body, grip, pin, collapse, resize, arrange, arrangement, arrangementClose, arrangementSteps, arrangementStatus, marker, wasHidden: spec.element.hidden, hadHiddenClass: spec.element.classList.contains('hidden') };
    live.set(spec.id, entry); body.append(spec.element); wrapper.append(titlebar, arrangement, body, resize); layer.append(wrapper);
    arrange.onclick = () => toggleArrangement(spec.id);
    arrangementClose.onclick = () => { if (!destroyed && arrangedId === spec.id) closeArrangement(true); };
    grip.addEventListener('pointerdown', (event) => begin(event, spec.id, 'drag'));
    resize.addEventListener('pointerdown', (event) => begin(event, spec.id, 'resize'));
    grip.addEventListener('keydown', (event) => keyboard(event, spec.id, 'drag'));
    resize.addEventListener('keydown', (event) => keyboard(event, spec.id, 'resize'));
    const lost = (event: PointerEvent) => { if (gesture?.pointerId === event.pointerId) endGesture(false); };
    grip.addEventListener('lostpointercapture', lost); resize.addEventListener('lostpointercapture', lost);
    focus.onclick = () => open(spec.id);
    pin.onclick = () => { cancelFlight(); endGesture(false); state = setPanelPinned(state, spec.id, !current(spec.id)!.pinned); render(); persist(); };
    collapse.onclick = () => { cancelFlight(); endGesture(false); const collapsed = !current(spec.id)!.collapsed; state = setPanelCollapsed(state, spec.id, collapsed); render(); persist(); if (collapsed && body.contains(doc.activeElement)) safeFocus(grip); };
    dismiss.onclick = () => close(spec.id);
    wrapper.addEventListener('pointerdown', () => activate(spec.id));
    wrapper.addEventListener('focusin', (event) => {
      if (focusGuard || destroyed) return;
      activate(spec.id);
      if (performance.now() - lastPointerAt < 300 || flightId === spec.id) return;
      const vp = size(), camera = options.getCamera(), rect = visiblePanelRect(current(spec.id)!);
      const center = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
      const screen = worldToScreen(camera, vp, center);
      const box = (event.target as HTMLElement).getBoundingClientRect(), viewportBox = options.viewport.getBoundingClientRect();
      const outside = box.width > 0 && box.height > 0 ? box.left < viewportBox.left || box.top < viewportBox.top || box.right > viewportBox.right || box.bottom > viewportBox.bottom : !isVisible(camera, vp, center) || screen.x < 20 || screen.y < 20 || screen.x > vp.width - 20 || screen.y > vp.height - 20;
      if (outside) frame(spec.id);
    });
    const shortcut = button('canvas-shortcut', `Open ${spec.title || spec.id}`, spec.icon || spec.title || spec.id);
    shortcut.dataset.canvasOpen = spec.id;
    if (spec.group) shortcut.dataset.group = spec.group;
    shortcut.onclick = () => open(spec.id);
    shortButtons.set(spec.id, shortcut); shortcuts.append(shortcut);
  }
  state = normalizeWorkspaceState(state, options.panels.filter((p) => live.has(p.id)));
  function interaction(event: Event): void {
    if (event.type === 'pointerdown') {
      lastPointerAt = performance.now();
      if (!palette.hidden && !launcher.contains(event.target as Node)) { palette.hidden = true; finder.setAttribute('aria-expanded', 'false'); }
      if (arrangedId) {
        const entry = live.get(arrangedId);
        if (entry && !entry.arrangement.contains(event.target as Node) && !entry.arrange.contains(event.target as Node)) closeArrangement();
      }
    } else if (event.type === 'keydown') lastPointerAt = -Infinity;
    cancelFlight();
  }
  function keydown(event: KeyboardEvent): void {
    if (event.key !== 'Escape') return;
    if (gesture) { event.preventDefault(); event.stopPropagation(); endGesture(false); return; }
    if (arrangedId) { event.preventDefault(); event.stopPropagation(); closeArrangement(true); return; }
    if (!palette.hidden) { event.preventDefault(); event.stopPropagation(); setPalette(false); }
  }
  const suspend = (): void => { cancelFlight(); endGesture(false); closeArrangement(); };
  const hidden = (): void => { if (doc.hidden) suspend(); };
  const motionChange = (): void => { if (mq?.matches && flightTarget) { const target = flightTarget; cancelFlight(); options.setCamera(target); } };
  const clickGuard = (event: MouseEvent): void => {
    if (!suppressClick) return;
    suppressClick = false;
    if (performance.now() <= clickUntil && clickHandle?.contains(event.target as Node)) { event.preventDefault(); event.stopPropagation(); }
    clickHandle = null;
  };
  finder.onclick = () => setPalette(palette.hidden);
  search.oninput = renderSearch;
  search.onkeydown = (event) => { if (event.key === 'Enter') { event.preventDefault(); (results.querySelector('button') as HTMLButtonElement | null)?.click(); } };
  home.onclick = () => { suspend(); options.stopMotion(); options.showCanvas(); options.onHome?.(); safeFocus(options.viewport); };
  doc.addEventListener('pointerdown', interaction, true);
  doc.addEventListener('wheel', interaction, { capture: true, passive: true });
  doc.addEventListener('keydown', interaction, true);
  doc.addEventListener('keydown', keydown, true);
  layer.addEventListener('click', clickGuard, true);
  win.addEventListener('pointermove', move);
  win.addEventListener('pointerup', finish);
  win.addEventListener('pointercancel', finish);
  win.addEventListener('blur', suspend);
  doc.addEventListener('visibilitychange', hidden);
  mq?.addEventListener('change', motionChange);
  render(); renderSearch();

  return {
    open, close,
    isOpen: (id) => !destroyed && current(id)?.open === true,
    revealElement(element) {
      if (destroyed) return false;
      const entry = [...live.values()].find((p) => p.wrapper.contains(element));
      if (!entry) return false; open(entry.spec.id); return true;
    },
    refresh() { render(); if (pendingFrame && options.viewport.clientWidth > 0 && options.viewport.clientHeight > 0) frame(pendingFrame); },
    elements: { layer, launcher },
    destroy() {
      if (destroyed) return;
      suspend(); destroyed = true;
      doc.removeEventListener('pointerdown', interaction, true);
      doc.removeEventListener('wheel', interaction, true);
      doc.removeEventListener('keydown', interaction, true);
      doc.removeEventListener('keydown', keydown, true);
      layer.removeEventListener('click', clickGuard, true);
      win.removeEventListener('pointermove', move);
      win.removeEventListener('pointerup', finish);
      win.removeEventListener('pointercancel', finish);
      win.removeEventListener('blur', suspend);
      doc.removeEventListener('visibilitychange', hidden);
      mq?.removeEventListener('change', motionChange);
      for (const entry of [...live.values()].reverse()) {
        entry.arrange.onclick = null; entry.arrangementClose.onclick = null;
        for (const control of entry.arrangementSteps) control.onclick = null;
        entry.spec.element.hidden = entry.wasHidden;
        entry.spec.element.classList.toggle('hidden', entry.hadHiddenClass);
        if (entry.marker.parentNode) entry.marker.parentNode.replaceChild(entry.spec.element, entry.marker);
        else entry.spec.element.remove();
      }
      layer.remove(); launcher.remove(); live.clear(); shortButtons.clear();
    },
  };
}
