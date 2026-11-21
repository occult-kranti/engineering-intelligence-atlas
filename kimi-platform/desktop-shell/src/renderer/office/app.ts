/**
 * v0.4 Office & Projects application controller.
 *
 * One state store fed exclusively by bridge data; every surface (canvas
 * rooms, sitemap, roadmap SVG + canonical list, runs, skills, connections,
 * inspector, chat) re-renders from it. No innerHTML is used anywhere for
 * model/user content.
 *
 * v0.4 upgrades:
 *  - Async project/run selection is sequenced with monotonically increasing
 *    request ids: the last selection always wins, no mixed-project frames.
 *  - Live project events coalesce into ~200ms incremental updates
 *    (readRunEvents afterIndex/nextIndex) instead of per-event full refetches.
 *  - Timeline DOM is windowed (>500) with scroll/follow preservation;
 *    approvals preserve focus by approval id across re-renders.
 *  - Polite live-region summaries only; raw timeline/chat are not live.
 */

import { BridgeAdapter, UNAVAILABLE_V3 } from './bridge.js';
import { createOfficeCanvas, type OfficeCanvas, type PanzoomFactory } from './canvas.js';
import { createChatController, type ChatController } from './chat.js';
import { createCompanionControls, type CompanionControls } from './companion.js';
import { badgeForStatus, button, clear, el } from './dom.js';
import { initMotion, appReduceMotionEnabled, setAppReduceMotion, withViewTransition } from './motion.js';
import { createOverlayHost, type OverlayHost } from './overlay.js';
import {
  deriveRooms,
  isRecoverable,
  isRunActive,
  roadmapRows,
  roomIdForNode,
  type Room,
} from './derive.js';
import type {
  ApiProvider,
  ApprovalRecord,
  CreateProjectRequest,
  HirePlanPreview,
  Project,
  ProjectProvider,
  ProjectRun,
  ProjectTemplate,
  RunEventRecord,
  RunNodeState,
  SkillSummary,
} from './types.js';

type OfficeTab = 'office' | 'roadmap' | 'runs' | 'skills' | 'connections';
type InspectorTab = 'chat' | 'timeline' | 'approvals' | 'artifacts' | 'node';

const OFFICE_TABS: OfficeTab[] = ['office', 'roadmap', 'runs', 'skills', 'connections'];
const INSPECTOR_TABS: InspectorTab[] = ['chat', 'timeline', 'approvals', 'artifacts', 'node'];

const KEY_PROVIDERS: { id: ApiProvider; label: string; hint: string }[] = [
  { id: 'openai', label: 'OpenAI', hint: 'sk-…' },
  { id: 'anthropic', label: 'Anthropic', hint: 'sk-ant-…' },
];

/** Timeline DOM window: older events stay in state but out of the DOM. */
const TIMELINE_WINDOW = 500;
/** Skills DOM cap; the search box filters the full registry. */
const SKILLS_CAP = 100;
/** Coalescing window for live-event refetches. */
const COALESCE_MS = 200;
/** Polite live-region summaries are throttled to one per interval. */
const ANNOUNCE_THROTTLE_MS = 1200;

/**
 * Local illustration of the office hierarchy the runtime generates for the
 * 'office' template. Clearly labeled as a preview; the authoritative
 * hierarchy comes from the created project.
 */
export function standardOfficeHierarchy(): Array<{ title: string; role: string; parentTitle: string | null }> {
  return [
    { title: 'Director', role: 'director', parentTitle: null },
    { title: 'Research Sub-Director', role: 'research', parentTitle: 'Director' },
    { title: 'Researcher (skill-backed)', role: 'research', parentTitle: 'Research Sub-Director' },
    { title: 'Engineering Sub-Director', role: 'build', parentTitle: 'Director' },
    { title: 'Builder (skill-backed)', role: 'build', parentTitle: 'Engineering Sub-Director' },
    { title: 'Review Sub-Director', role: 'review', parentTitle: 'Director' },
    { title: 'Reviewer (skill-backed)', role: 'review', parentTitle: 'Review Sub-Director' },
  ];
}

interface OfficeState {
  projects: Project[];
  project: Project | null;
  /** Set when the previously selected project disappeared (deleted elsewhere). */
  projectNotice: string | null;
  run: ProjectRun | null;
  runs: ProjectRun[];
  /** Rooms from the v3 office snapshot; null = derive locally from the project. */
  snapshotRooms: Room[] | null;
  events: RunEventRecord[];
  eventsError: string | null;
  approvals: ApprovalRecord[];
  approvalsError: string | null;
  skills: SkillSummary[] | null;
  skillsError: string | null;
  hirePreview: HirePlanPreview | null;
  selectedNodeId: string | null;
  activeTab: OfficeTab;
  inspectorTab: InspectorTab;
  inspectorCollapsed: boolean;
  sitemapOpen: boolean;
}

export interface OfficeAppDeps {
  root: HTMLElement;
  adapter: BridgeAdapter;
  panzoomFactory: PanzoomFactory;
  /** Shared overlay host; created from #overlay-root when omitted. */
  overlay?: OverlayHost;
}

export interface OfficeApp {
  show(): Promise<void>;
  hide(): void;
  /** v0.5: deep-link a project (e.g. from a CEO company card). */
  openProject(projectId: string): Promise<void>;
  /** Test/runtime hook: force a full re-render from current state. */
  renderAll(): void;
  state(): Readonly<OfficeState>;
  destroy(): void;
}

export function createOfficeApp(deps: OfficeAppDeps): OfficeApp {
  const { root, adapter, panzoomFactory } = deps;

  function qs<T extends HTMLElement>(selector: string): T {
    const found = root.querySelector<T>(selector);
    if (!found) throw new Error(`office: missing element ${selector}`);
    return found;
  }

  initMotion();

  const overlay: OverlayHost =
    deps.overlay ?? createOverlayHost(document.getElementById('overlay-root') ?? document.body);

  const state: OfficeState = {
    projects: [],
    project: null,
    projectNotice: null,
    run: null,
    runs: [],
    snapshotRooms: null,
    events: [],
    eventsError: null,
    approvals: [],
    approvalsError: null,
    skills: null,
    skillsError: null,
    hirePreview: null,
    selectedNodeId: null,
    activeTab: 'office',
    inspectorTab: 'chat',
    inspectorCollapsed: false,
    sitemapOpen: false,
  };

  // ------------------------------------------------------------ live region

  // The shared live region lives at body level in chrome.html; fall back to a
  // local one so the app never depends on markup outside its own root.
  const liveRegion: HTMLElement = (() => {
    const found = document.getElementById('live-summary');
    if (found) return found;
    const region = el('div', 'visually-hidden');
    region.id = 'live-summary';
    region.setAttribute('role', 'status');
    region.setAttribute('aria-live', 'polite');
    root.append(region);
    return region;
  })();
  let lastAnnounce = 0;
  let announceTimer: number | null = null;
  let pendingAnnouncement: string | null = null;
  /** Polite summaries only — raw timeline/chat are never live regions. */
  function announce(message: string): void {
    const write = (text: string) => {
      liveRegion.textContent = '';
      // Force a live-region re-announcement of identical consecutive text.
      window.setTimeout(() => {
        liveRegion.textContent = text;
      }, 30);
    };
    const now = Date.now();
    if (now - lastAnnounce >= ANNOUNCE_THROTTLE_MS) {
      lastAnnounce = now;
      write(message);
      return;
    }
    // Throttled: the LATEST summary wins when the window elapses.
    pendingAnnouncement = message;
    if (announceTimer === null) {
      announceTimer = window.setTimeout(() => {
        announceTimer = null;
        lastAnnounce = Date.now();
        if (pendingAnnouncement !== null) {
          write(pendingAnnouncement);
          pendingAnnouncement = null;
        }
      }, ANNOUNCE_THROTTLE_MS - (now - lastAnnounce));
    }
  }

  function summarizeState(): string {
    if (!state.project) return 'No project selected.';
    const run = state.run;
    const pendingApprovals = state.approvals.filter((a) => a.status === 'pending').length;
    const parts = [`Project ${state.project.name}`];
    if (run) {
      const running = Object.values(run.nodeStates).filter((s) => s.status === 'running').length;
      parts.push(`run ${run.status}`, `${running} node(s) running`);
    } else {
      parts.push('no runs yet');
    }
    if (pendingApprovals > 0) parts.push(`${pendingApprovals} pending approval(s)`);
    return parts.join(', ') + '.';
  }

  // ------------------------------------------------------------ selection sequencing

  /**
   * Monotonically increasing selection id. Every async step of a selection
   * re-checks it: only the latest selection may commit state or render, so
   * rapid project/run switches can never produce mixed-project frames.
   */
  let selectionSeq = 0;

  function setProjectStatus(message: string, kind: '' | 'error' | 'warn' = ''): void {
    const elStatus = qs('#project-status');
    clear(elStatus);
    if (message) elStatus.append(el('p', `status ${kind}`.trim(), message));
  }

  // ------------------------------------------------------------ coalescing

  const pendingRefresh = { timeline: false, approvals: false };
  let coalesceTimer: number | null = null;

  /** Coalesce a burst of live events into one incremental refetch+render. */
  function scheduleLiveRefresh(parts: Partial<typeof pendingRefresh>): void {
    if (parts.timeline) pendingRefresh.timeline = true;
    if (parts.approvals) pendingRefresh.approvals = true;
    if (coalesceTimer !== null) return;
    coalesceTimer = window.setTimeout(() => {
      coalesceTimer = null;
      const jobs: Promise<void>[] = [];
      if (pendingRefresh.timeline) jobs.push(fetchIncrementalTimeline());
      if (pendingRefresh.approvals) jobs.push(refreshApprovals());
      pendingRefresh.timeline = false;
      pendingRefresh.approvals = false;
      void Promise.all(jobs);
    }, COALESCE_MS);
  }

  // ------------------------------------------------------------ canvas

  const canvas: OfficeCanvas = createOfficeCanvas({
    viewport: qs('#office-canvas-viewport'),
    world: qs('#office-canvas-world'),
    panzoomFactory,
    onSelectNode: (nodeId) => {
      selectNode(nodeId);
    },
  });

  function selectNode(nodeId: string | null, focusCamera = false): void {
    state.selectedNodeId = nodeId;
    canvas.setSelected(nodeId);
    if (nodeId) {
      setInspectorTab('node');
      if (focusCamera) canvas.focusNode(nodeId);
      const node = state.project?.nodes.find((n) => n.id === nodeId);
      if (node) announce(`Selected ${node.title}.`);
    }
    renderAll();
  }

  let unsubscribeProjectEvents: (() => void) | null = null;
  let resizeObserver: ResizeObserver | null = null;

  function roomsFor(): Room[] {
    if (state.snapshotRooms) return state.snapshotRooms;
    return state.project ? deriveRooms(state.project) : [];
  }

  // ------------------------------------------------------------ chat + companion

  const chat: ChatController = createChatController({
    panel: qs('#insp-panel-chat'),
    adapter,
    overlay,
    announce,
    openNewProjectDialog: () => newProjectDialog.open(),
    openRoadmap: (projectId) => {
      void (async () => {
        await selectProject(projectId);
        setOfficeTab('roadmap');
      })();
    },
    getProject: () => state.project,
  });

  const companion: CompanionControls = createCompanionControls({
    container: qs('#companion-slot'),
    adapter,
    overlay,
    announce,
  });

  // ------------------------------------------------------------ tabs (APG)

  function setOfficeTab(tab: OfficeTab): void {
    state.activeTab = tab;
    withViewTransition(() => {
      for (const t of OFFICE_TABS) {
        const tabBtn = qs(`#tab-${t}`);
        const panel = qs(`#panel-${t}`);
        const active = t === tab;
        tabBtn.setAttribute('aria-selected', active ? 'true' : 'false');
        tabBtn.tabIndex = active ? 0 : -1;
        panel.hidden = !active;
      }
    });
    if (tab === 'skills' && state.skills === null && state.skillsError === null) {
      void loadSkills();
    }
    if (tab === 'connections') void renderConnections();
  }

  function setInspectorTab(tab: InspectorTab): void {
    state.inspectorTab = tab;
    for (const t of INSPECTOR_TABS) {
      const tabBtn = qs(`#insp-tab-${t}`);
      tabBtn.setAttribute('aria-selected', t === tab ? 'true' : 'false');
      tabBtn.tabIndex = t === tab ? 0 : -1;
      qs(`#insp-panel-${t}`).hidden = t !== tab;
    }
    if (state.inspectorCollapsed) toggleInspector(false);
  }

  function toggleInspector(collapse: boolean): void {
    state.inspectorCollapsed = collapse;
    qs('#inspector-body').classList.toggle('collapsed', collapse);
    qs('#office-inspector').classList.toggle('collapsed', collapse);
    const toggle = qs('#inspector-toggle');
    toggle.setAttribute('aria-expanded', collapse ? 'false' : 'true');
    toggle.textContent = collapse ? 'Expand inspector' : 'Collapse inspector';
  }

  /** APG tablist keyboard support: arrows move focus, Home/End jump, roving tabindex. */
  function wireTabKeyboard(nav: HTMLElement, ids: string[], onSelect: (id: string) => void): void {
    nav.addEventListener('keydown', (event) => {
      const keys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'];
      if (!keys.includes(event.key)) return;
      const currentIndex = ids.findIndex((id) => nav.querySelector(`#${id}`) === document.activeElement);
      if (currentIndex < 0) return;
      event.preventDefault();
      let nextIndex = currentIndex;
      if (event.key === 'ArrowRight' || event.key === 'ArrowDown') nextIndex = (currentIndex + 1) % ids.length;
      else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') nextIndex = (currentIndex - 1 + ids.length) % ids.length;
      else if (event.key === 'Home') nextIndex = 0;
      else if (event.key === 'End') nextIndex = ids.length - 1;
      const nextId = ids[nextIndex]!;
      const nextBtn = nav.querySelector<HTMLButtonElement>(`#${nextId}`);
      nextBtn?.focus();
      onSelect(nextId.replace(/^(tab|insp-tab)-/, ''));
    });
  }

  // ------------------------------------------------------------ data loading (sequenced)

  /** Per-selection cursor for incremental event reads. */
  let eventsNextIndex: number | null = null;
  let eventsRunId: string | null = null;

  async function refreshProjects(selectId?: string): Promise<void> {
    const seq = ++selectionSeq;
    state.projects = await adapter.listProjects();
    if (seq !== selectionSeq) return;
    const rail = qs<HTMLSelectElement>('#project-rail');
    clear(rail);
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = state.projects.length === 0 ? 'No projects yet' : 'Select a project…';
    rail.append(placeholder);
    for (const p of state.projects) {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = `${p.name} (${p.provider})`;
      rail.append(opt);
    }
    // Auto-select: explicit choice > current selection > first project.
    const wanted = selectId ?? state.project?.id ?? state.projects[0]?.id ?? '';
    rail.value = state.projects.some((p) => p.id === wanted) ? wanted : '';
    if (rail.value) {
      await selectProject(rail.value);
    } else if (state.project && !state.projects.some((p) => p.id === state.project?.id)) {
      // Deleted elsewhere: honest state, no stale desks.
      state.projectNotice = `Project “${state.project.name}” was deleted outside the app.`;
      state.project = null;
      state.run = null;
      state.runs = [];
      state.snapshotRooms = null;
      state.events = [];
      state.approvals = [];
      chat.setProject(null);
      renderAll();
      announce(state.projectNotice);
    } else {
      renderAll();
    }
  }

  async function refreshSnapshot(): Promise<void> {
    if (!state.project || !adapter.capabilities.officeSnapshot) {
      state.snapshotRooms = null;
      return;
    }
    const res = await adapter.getOfficeSnapshot(state.project.id, state.run?.id);
    if (res.ok && res.value) {
      state.snapshotRooms = [...res.value.rooms]
        .sort((a, b) => a.order - b.order)
        .map((room) => ({ id: room.id, label: room.label, nodeIds: room.members.map((m) => m.nodeId) }));
    } else {
      state.snapshotRooms = null; // honest local derivation fallback
    }
  }

  async function selectProject(projectId: string): Promise<void> {
    const seq = ++selectionSeq;
    setProjectStatus('Loading project…');
    const project = await adapter.getProject(projectId);
    if (seq !== selectionSeq) return; // a newer selection won
    if (!project) {
      state.project = null;
      state.run = null;
      state.runs = [];
      state.snapshotRooms = null;
      state.events = [];
      state.approvals = [];
      state.projectNotice = 'This project no longer exists (deleted outside the app).';
      setProjectStatus(state.projectNotice, 'warn');
      chat.setProject(null);
      renderAll();
      return;
    }
    state.projectNotice = null;
    state.project = project;
    state.selectedNodeId = null;
    state.events = [];
    state.eventsError = null;
    state.approvals = [];
    state.approvalsError = null;
    eventsNextIndex = null;
    eventsRunId = null;
    state.runs = await adapter.listRuns(projectId);
    if (seq !== selectionSeq) return;
    state.run = state.runs[0] ?? null;
    await refreshSnapshot();
    if (seq !== selectionSeq) return;
    setProjectStatus('');
    renderAll();
    announce(summarizeState());
    chat.setProject(project);
    await Promise.all([refreshTimeline(), refreshApprovals()]);
    if (seq !== selectionSeq) return;
  }

  async function refreshRun(): Promise<void> {
    if (!state.project) return;
    const seq = selectionSeq;
    state.runs = await adapter.listRuns(state.project.id);
    if (seq !== selectionSeq) return;
    state.run = state.runs[0] ?? null;
    renderAll();
  }

  async function refreshTimeline(): Promise<void> {
    const seq = selectionSeq;
    if (!state.project || !state.run) {
      state.events = [];
      state.eventsError = null;
      eventsNextIndex = null;
      eventsRunId = null;
      renderTimeline();
      return;
    }
    const runId = state.run.id;
    const res = await adapter.readRunEvents(state.project.id, runId);
    if (seq !== selectionSeq) return;
    if (res.ok) {
      state.events = res.value.events;
      eventsNextIndex = res.value.nextIndex;
      eventsRunId = runId;
      state.eventsError = null;
    } else {
      state.events = [];
      state.eventsError = res.error;
      eventsNextIndex = null;
      eventsRunId = null;
    }
    renderTimeline();
    renderRoadmap();
  }

  /** Incremental append: only events after the last seen index are fetched. */
  async function fetchIncrementalTimeline(): Promise<void> {
    if (!state.project || !state.run) return;
    if (eventsRunId !== state.run.id || eventsNextIndex === null) {
      await refreshTimeline();
      return;
    }
    const seq = selectionSeq;
    const runId = state.run.id;
    const res = await adapter.readRunEvents(state.project.id, runId, eventsNextIndex);
    if (seq !== selectionSeq || state.run?.id !== runId) return;
    if (res.ok) {
      if (res.value.events.length > 0) {
        state.events = state.events.concat(res.value.events);
        renderTimeline();
        renderRoadmap();
      }
      eventsNextIndex = res.value.nextIndex;
      state.eventsError = null;
    } else {
      // Index cursor rejected (log rotated, etc.): fall back to one full read.
      await refreshTimeline();
    }
  }

  async function refreshApprovals(): Promise<void> {
    const seq = selectionSeq;
    if (!state.project) {
      state.approvals = [];
      state.approvalsError = null;
      renderApprovals();
      return;
    }
    const res = await adapter.listApprovals(state.project.id);
    if (seq !== selectionSeq) return;
    if (res.ok) {
      state.approvals = res.value;
      state.approvalsError = null;
    } else {
      state.approvals = [];
      state.approvalsError = res.error;
    }
    renderApprovals();
    renderRunControls();
  }

  // ------------------------------------------------------------ office canvas + sitemap

  function renderOffice(): void {
    canvas.update(state.project, state.run, state.snapshotRooms ?? undefined);
    renderSitemap();
  }

  function renderSitemap(): void {
    const aside = qs('#office-sitemap');
    aside.classList.toggle('hidden', !state.sitemapOpen);
    qs('#sitemap-toggle').setAttribute('aria-expanded', state.sitemapOpen ? 'true' : 'false');
    clear(aside);
    if (!state.sitemapOpen) return;
    aside.append(el('h2', 'sitemap-heading', 'Sitemap'));
    if (!state.project) {
      aside.append(el('p', 'muted', 'No project selected.'));
      return;
    }
    const list = el('ul', 'sitemap-list');
    for (const room of roomsFor()) {
      const roomItem = el('li', 'sitemap-room');
      roomItem.append(el('span', 'sitemap-room-name', room.label));
      const nodeList = el('ul', 'sitemap-nodes');
      for (const nodeId of room.nodeIds) {
        const node = state.project.nodes.find((n) => n.id === nodeId);
        if (!node) continue;
        const status = state.run?.nodeStates[node.id]?.status ?? 'pending';
        const item = el('li');
        const btn = button(
          `sitemap-node${node.id === state.selectedNodeId ? ' selected' : ''}`,
          '',
          () => {
            selectNode(node.id, true);
          },
        );
        btn.dataset.nodeId = node.id;
        btn.append(el('span', `desk-dot status-${status}`), el('span', 'sitemap-node-title', node.title));
        item.append(btn);
        nodeList.append(item);
      }
      roomItem.append(nodeList);
      list.append(roomItem);
    }
    aside.append(list);
  }

  // ------------------------------------------------------------ roadmap

  function renderRoadmap(): void {
    const svgWrap = qs('#roadmap-svg-wrap');
    const listWrap = qs('#roadmap-list-wrap');
    clear(svgWrap);
    clear(listWrap);
    if (!state.project) {
      svgWrap.append(el('p', 'muted', 'Select a project to see its roadmap.'));
      return;
    }
    const project = state.project;
    const rows = roadmapRows(project, state.run, state.events);
    const maxLayer = Math.max(0, ...rows.map((r) => r.layer));

    // SVG DAG: deterministic column-per-layer layout.
    const colW = 260;
    const rowH = 96;
    const perLayerCount = new Map<number, number>();
    const positions = new Map<string, { x: number; y: number }>();
    for (const row of rows) {
      const idx = perLayerCount.get(row.layer) ?? 0;
      perLayerCount.set(row.layer, idx + 1);
      positions.set(row.node.id, { x: 40 + row.layer * colW, y: 40 + idx * rowH });
    }
    const width = 80 + (maxLayer + 1) * colW;
    const height = Math.max(160, 80 + rows.length * rowH);
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    svg.setAttribute('class', 'roadmap-svg');
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', 'Dependency graph of project nodes');
    const mkLine = (x1: number, y1: number, x2: number, y2: number) => {
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', String(x1));
      line.setAttribute('y1', String(y1));
      line.setAttribute('x2', String(x2));
      line.setAttribute('y2', String(y2));
      line.setAttribute('class', 'edge-line');
      return line;
    };
    for (const row of rows) {
      const to = positions.get(row.node.id);
      if (!to) continue;
      for (const dep of row.node.dependsOn) {
        const from = positions.get(dep);
        if (!from) continue;
        svg.append(mkLine(from.x + 180, from.y + 28, to.x, to.y + 28));
      }
    }
    for (const row of rows) {
      const pos = positions.get(row.node.id);
      if (!pos) continue;
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.setAttribute('class', `roadmap-node status-${row.status}`);
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('x', String(pos.x));
      rect.setAttribute('y', String(pos.y));
      rect.setAttribute('width', '180');
      rect.setAttribute('height', '56');
      rect.setAttribute('rx', '8');
      rect.setAttribute('class', 'roadmap-node-box');
      const title = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      title.setAttribute('x', String(pos.x + 12));
      title.setAttribute('y', String(pos.y + 24));
      title.setAttribute('class', 'roadmap-node-title');
      title.textContent = row.node.title;
      const meta = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      meta.setAttribute('x', String(pos.x + 12));
      meta.setAttribute('y', String(pos.y + 44));
      meta.setAttribute('class', 'roadmap-node-meta');
      meta.textContent = `${row.node.role} · ${row.status}${row.loopAttempts > 0 ? ` · attempt ${row.loopAttempts}` : ''}`;
      g.append(rect, title, meta);
      svg.append(g);
    }
    svgWrap.append(svg);

    // Canonical list of the SAME rows.
    const table = el('table', 'roadmap-table');
    const thead = el('thead');
    const headRow = el('tr');
    for (const h of ['Node', 'Role', 'Depends on', 'Owner', 'Attempts', 'Status']) {
      headRow.append(el('th', '', h));
    }
    thead.append(headRow);
    table.append(thead);
    const tbody = el('tbody');
    const byId = new Map(project.nodes.map((n) => [n.id, n]));
    for (const row of rows) {
      const tr = el('tr');
      tr.dataset.nodeId = row.node.id;
      const titleBtn = button('linklike', row.node.title, () => {
        setOfficeTab('office');
        selectNode(row.node.id, true);
      });
      const titleTd = el('td');
      titleTd.append(titleBtn);
      tr.append(titleTd);
      tr.append(el('td', '', row.node.role));
      tr.append(
        el(
          'td',
          '',
          row.node.dependsOn.map((d) => byId.get(d)?.title ?? d).join(', ') || '—',
        ),
      );
      tr.append(el('td', '', row.owner));
      tr.append(el('td', '', String(row.loopAttempts)));
      const statusTd = el('td');
      statusTd.append(badgeForStatus(row.status, row.error));
      tr.append(statusTd);
      tbody.append(tr);
    }
    table.append(tbody);
    listWrap.append(table);
  }

  // ------------------------------------------------------------ runs

  function numInputValue(selector: string, fallback: number): number {
    const input = qs<HTMLInputElement>(selector);
    const value = Number(input.value);
    return Number.isFinite(value) ? value : fallback;
  }

  async function startRun(): Promise<void> {
    const status = qs('#run-status');
    clear(status);
    if (!state.project) {
      status.append(el('p', 'status error', 'Select a project first.'));
      return;
    }
    const res = await adapter.startRun({
      projectId: state.project.id,
      runBudget: {
        maxTokens: numInputValue('#run-max-tokens', 20000),
        maxMinutes: numInputValue('#run-max-minutes', 10),
        maxUsd: numInputValue('#run-max-usd', 1),
      },
      priceRates: {
        inputUsdPerMillion: numInputValue('#rate-input', 0),
        outputUsdPerMillion: numInputValue('#rate-output', 0),
      },
    });
    if (!res.ok) {
      status.append(el('p', 'status error', res.error ?? 'Failed to start run.'));
      return;
    }
    status.append(el('p', 'status ok', `Run ${res.runId} started.`));
    announce(`Run started for ${state.project.name}.`);
    await refreshRun();
    await Promise.all([refreshTimeline(), refreshApprovals()]);
  }

  function renderRunControls(): void {
    const run = state.run;
    qs<HTMLButtonElement>('#run-start').disabled = state.project === null || isRunActive(run);
    qs<HTMLButtonElement>('#run-pause').disabled = !(run !== null && run.status === 'running');
    qs<HTMLButtonElement>('#run-resume').disabled = !(run !== null && run.status === 'paused');
    qs<HTMLButtonElement>('#run-cancel').disabled = !isRunActive(run);

    const recoverBtn = qs<HTMLButtonElement>('#run-recover');
    const recoverNote = qs('#run-recover-note');
    clear(recoverNote);
    if (isRecoverable(run)) {
      if (adapter.capabilities.recovery) {
        recoverBtn.classList.remove('hidden');
        recoverBtn.disabled = false;
        recoverNote.append(
          el(
            'p',
            'muted',
            'Recovery resumes the interrupted run with a fresh wall-clock budget window; token and USD usage so far still count toward the budget.',
          ),
        );
      } else {
        recoverBtn.classList.add('hidden');
        recoverNote.append(
          el(
            'p',
            'status warn',
            `Run is interrupted, but recovery ${UNAVAILABLE_V3}. Update the desktop app, or start a new run.`,
          ),
        );
      }
    } else {
      recoverBtn.classList.add('hidden');
    }
  }

  function renderRuns(): void {
    renderRunControls();
    const live = qs('#run-live');
    clear(live);
    const run = state.run;
    if (!state.project) {
      live.append(el('p', 'muted', 'Select a project to run it.'));
    } else if (run) {
      const term = run.terminationReason ? ` (terminated: ${run.terminationReason})` : '';
      const loops = run.loops
        ? Object.entries(run.loops)
            .filter(([, l]) => l.iterations > 0)
            .map(([nodeId, l]) => {
              const title = state.project?.nodes.find((n) => n.id === nodeId)?.title ?? nodeId;
              return `${title}: ${l.iterations} revision(s), ${l.noProgress} no-progress`;
            })
        : [];
      live.append(
        el(
          'p',
          'meta',
          `Run ${run.id.slice(0, 13)}… — ${run.status}${term} · ` +
            `${run.usage.inputTokens + run.usage.outputTokens} tokens · ` +
            `$${run.usage.costUsd.toFixed(4)} · ${Math.round(run.usage.elapsedSeconds)}s`,
        ),
      );
      for (const line of loops) live.append(el('p', 'meta', `Bounded loop — ${line}`));
      if (run.error) live.append(el('p', 'status error', run.error));
      if (run.status === 'waiting-approval') {
        live.append(el('p', 'status warn', 'Run is waiting for an approval — see the Approvals tab below.'));
      }
    } else {
      live.append(el('p', 'muted', 'No runs yet for this project.'));
    }

    const list = qs('#runs-list');
    clear(list);
    if (state.runs.length === 0) {
      list.append(el('p', 'muted', 'Run history is empty.'));
      return;
    }
    for (const r of state.runs) {
      const row = el('div', 'node-card row space-between');
      const info = el('div');
      info.append(
        el('strong', '', `${r.id.slice(0, 13)}…`),
        el('div', 'meta', `${r.status} · ${r.createdAt.slice(0, 19).replace('T', ' ')} · $${r.usage.costUsd.toFixed(4)}`),
      );
      const openBtn = button('secondary', 'Open', () => {
        const seq = ++selectionSeq;
        state.run = r;
        eventsNextIndex = null;
        eventsRunId = null;
        renderAll();
        void (async () => {
          await refreshTimeline();
          if (seq !== selectionSeq) return;
        })();
      });
      row.append(info, openBtn);
      list.append(row);
    }
  }

  // ------------------------------------------------------------ skills + hiring

  async function loadSkills(): Promise<void> {
    const res = await adapter.listSkills();
    if (res.ok) {
      state.skills = res.value;
      state.skillsError = null;
    } else {
      state.skills = null;
      state.skillsError = res.error;
    }
    renderSkills();
  }

  /**
   * Search bursts coalesce: the first keystroke renders on the next microtask,
   * repeats within the debounce window collapse into a single trailing render.
   */
  let skillsQueued = false;
  let skillsTrailing: number | null = null;
  let skillsLastInput = 0;
  function queueRenderSkills(): void {
    skillsLastInput = Date.now();
    if (skillsQueued) return;
    skillsQueued = true;
    queueMicrotask(() => {
      skillsQueued = false;
      renderSkills();
      if (skillsTrailing !== null) window.clearTimeout(skillsTrailing);
      skillsTrailing = window.setTimeout(() => {
        skillsTrailing = null;
        if (Date.now() - skillsLastInput >= 140) renderSkills();
      }, 150);
    });
  }

  function renderSkills(): void {
    const status = qs('#skills-status');
    const list = qs('#skills-list');
    clear(status);
    clear(list);
    if (state.skillsError !== null) {
      status.append(el('p', 'status warn', `Skill registry unavailable — ${state.skillsError}.`));
    } else if (state.skills === null) {
      status.append(el('p', 'muted', 'Open this tab to load the bundled skill registry.'));
    } else {
      const query = qs<HTMLInputElement>('#skills-search').value.trim().toLowerCase();
      const matches = state.skills.filter(
        (s) =>
          query.length === 0 ||
          s.name.toLowerCase().includes(query) ||
          s.description.toLowerCase().includes(query) ||
          s.role.toLowerCase().includes(query) ||
          s.keywords.some((k) => k.toLowerCase().includes(query)),
      );
      const capped = matches.length > SKILLS_CAP;
      const shown = capped ? matches.slice(0, SKILLS_CAP) : matches;
      status.append(
        el(
          'p',
          'muted',
          capped
            ? `Showing the first ${SKILLS_CAP} of ${matches.length} matching skill(s) (${state.skills.length} bundled) — refine the search.`
            : `${matches.length} of ${state.skills.length} bundled skill(s).`,
        ),
      );
      for (const skill of shown) {
        const card = el('div', 'node-card skill-card');
        const head = el('div', 'row space-between');
        head.append(el('strong', '', skill.name));
        head.append(
          el(
            'span',
            `badge ${skill.verified ? 'ok' : 'fail'}`,
            skill.verified ? 'hash verified' : 'hash mismatch',
          ),
        );
        card.append(head);
        card.append(el('p', 'meta', skill.description));
        card.append(
          el('div', 'meta', `room: ${skill.role} · ${skill.path} · sha256 ${skill.sha256.slice(0, 16)}…`),
        );
        if (skill.keywords.length > 0) {
          const tags = el('div', 'row wrap');
          for (const kw of skill.keywords) tags.append(el('span', 'badge', kw));
          card.append(tags);
        }
        list.append(card);
      }
    }

    // Hire panel honesty
    const previewBtn = qs<HTMLButtonElement>('#hire-preview-btn');
    const applyBtn = qs<HTMLButtonElement>('#hire-apply-btn');
    const hireNote = qs('#hire-note');
    clear(hireNote);
    if (!adapter.capabilities.hires) {
      previewBtn.disabled = true;
      applyBtn.disabled = true;
      hireNote.append(
        el(
          'p',
          'status warn',
          `Goal-based hiring ${UNAVAILABLE_V3}. The registry above and manual project creation still work.`,
        ),
      );
    } else {
      previewBtn.disabled = state.project === null;
      applyBtn.disabled =
        state.hirePreview === null || !qs<HTMLInputElement>('#hire-confirm').checked || !state.project;
    }
    renderHirePreview();
  }

  function renderHirePreview(): void {
    const list = qs('#hire-preview-list');
    clear(list);
    const preview = state.hirePreview;
    if (!preview) return;
    if (preview.assignments.length === 0) {
      list.append(el('p', 'muted', 'No skill matches for this project’s goal.'));
      return;
    }
    list.append(
      el('p', 'meta', `Plan hash ${preview.planHash.slice(0, 16)}… · project version ${preview.projectVersion}`),
    );
    for (const assignment of preview.assignments) {
      const card = el('div', 'node-card');
      card.append(el('strong', '', `${assignment.nodeTitle} → ${assignment.skillName}`));
      card.append(
        el(
          'div',
          'meta',
          `skill ${assignment.skillId} · score ${assignment.score}` +
            (assignment.matchedKeywords.length > 0 ? ` · matched: ${assignment.matchedKeywords.join(', ')}` : ''),
        ),
      );
      list.append(card);
    }
  }

  async function previewHires(): Promise<void> {
    const status = qs('#hire-status');
    clear(status);
    if (!state.project) {
      status.append(el('p', 'status error', 'Select a project first.'));
      return;
    }
    const res = await adapter.hirePreview(state.project.id);
    if (!res.ok) {
      status.append(el('p', 'status error', res.error));
      return;
    }
    state.hirePreview = res.value;
    renderSkills();
    status.append(
      el(
        'p',
        'status ok',
        `${res.value.assignments.length} assignment(s) matched from the goal. Review, tick approval, then apply — a hire approval is created for your decision.`,
      ),
    );
  }

  async function applyHires(): Promise<void> {
    const status = qs('#hire-status');
    clear(status);
    if (!state.project || !state.hirePreview) {
      status.append(el('p', 'status error', 'Preview hires first.'));
      return;
    }
    if (!qs<HTMLInputElement>('#hire-confirm').checked) {
      status.append(el('p', 'status error', 'Tick the explicit approval box first.'));
      return;
    }
    const preview = state.hirePreview;
    const res = await adapter.applyHires({
      projectId: state.project.id,
      expectedVersion: preview.projectVersion,
      assignments: preview.assignments.map((a) => ({ nodeId: a.nodeId, skillId: a.skillId })),
      confirmed: true,
    });
    if (!res.ok) {
      status.append(el('p', 'status error', res.error));
      return;
    }
    state.hirePreview = null;
    qs<HTMLInputElement>('#hire-confirm').checked = false;
    status.append(
      el(
        'p',
        'status ok',
        `Hire plan submitted as approval ${res.value.approval?.id ?? '(pending)'}. Approve or reject it in the Approvals tab.`,
      ),
    );
    await selectProject(state.project.id);
    setInspectorTab('approvals');
  }

  // ------------------------------------------------------------ connections

  async function renderConnections(): Promise<void> {
    await renderKeyRows();
    void companion.refresh();
    const settings = await adapter.getSettings();
    const urlInput = qs<HTMLInputElement>('#conn-runtime-url');
    if (settings.runtimeUrl) urlInput.value = settings.runtimeUrl;
    const status = qs('#conn-runtime-status');
    clear(status);
    status.append(
      el(
        'p',
        'muted',
        settings.runtimeUrl
          ? `Saved runtime URL: ${settings.runtimeUrl}. Connecting opens the hosted runtime in a separate view; this shell stores only the URL.`
          : 'No runtime URL saved. Enter an HTTPS URL and Connect to open the hosted runtime.',
      ),
    );
  }

  async function renderKeyRows(): Promise<void> {
    const vault = await adapter.getVaultStatus();
    const warning = qs('#vault-warning');
    warning.classList.toggle('hidden', vault.encryptionAvailable);
    if (!vault.encryptionAvailable) {
      warning.textContent =
        'OS secure storage is unavailable (no unlocked system keychain). Keys cannot be saved — this shell fails closed. Unlock your keychain and restart the app.';
    }
    const container = qs('#key-rows');
    clear(container);
    for (const p of KEY_PROVIDERS) {
      const st = vault.providers[p.id];
      const row = el('div', 'row wrap key-row');
      row.append(el('strong', '', p.label));
      row.append(
        el(
          'span',
          `badge ${st.configured && st.readable ? 'ok' : st.configured ? 'fail' : 'unknown'}`,
          st.configured
            ? st.readable
              ? `configured${st.updatedAt ? ` · ${st.updatedAt.slice(0, 10)}` : ''}`
              : 'stored but unreadable (tampered or keychain changed)'
            : 'not configured',
        ),
      );
      const input = document.createElement('input');
      input.type = 'password';
      input.placeholder = `Paste ${p.label} API key (${p.hint})`;
      input.autocomplete = 'off';
      input.disabled = !vault.encryptionAvailable;
      row.append(input);
      const setBtn = button('', 'Save key', () => {
        void (async () => {
          const key = input.value;
          input.value = ''; // never let key material linger in the DOM
          if (key.trim().length === 0) return;
          const res = await adapter.setApiKey(p.id, key);
          const status = qs('#conn-status');
          clear(status);
          if (!res.ok) status.append(el('p', 'status error', res.error ?? 'Failed to save key.'));
          await renderKeyRows();
        })();
      });
      setBtn.disabled = !vault.encryptionAvailable;
      row.append(setBtn);
      const revokeBtn = button('danger', 'Revoke', () => {
        void (async () => {
          const ok = await overlay.confirm({
            title: `Revoke ${p.label} key`,
            message: `Revoke and permanently delete the stored ${p.label} key from this device?`,
            detail: 'The encrypted blob is removed from the app data directory. You can save a new key at any time.',
            confirmLabel: 'Revoke key',
            danger: true,
          });
          if (!ok) return;
          const res = await adapter.revokeApiKey(p.id);
          if (!res.ok) qs('#conn-status').append(el('p', 'status error', res.error ?? 'Revoke failed.'));
          else overlay.toast(`${p.label} key revoked.`, { kind: 'ok' });
          await renderKeyRows();
        })();
      });
      revokeBtn.disabled = !st.configured;
      row.append(revokeBtn);
      container.append(row);
    }
  }

  async function listModelsLive(): Promise<void> {
    const status = qs('#conn-models-status');
    clear(status);
    const provider = qs<HTMLSelectElement>('#conn-provider').value as ProjectProvider;
    status.append(el('p', 'muted', 'Listing models (live call)…'));
    const res = await adapter.listProviderModels(provider);
    clear(status);
    if (!res.ok) {
      status.append(el('p', 'status error', res.error ?? 'Model list failed.'));
      return;
    }
    const select = qs<HTMLSelectElement>('#conn-model-select');
    clear(select);
    select.classList.remove('hidden');
    for (const m of res.models) {
      const opt = document.createElement('option');
      opt.value = m.id;
      opt.textContent = m.label;
      select.append(opt);
    }
    status.append(el('p', 'status ok', `${res.models.length} model(s) from ${provider}.`));
  }

  async function detectOllamaUi(): Promise<void> {
    const status = qs('#ollama-status');
    clear(status);
    status.append(el('p', 'muted', 'Detecting…'));
    const res = await adapter.detectOllama();
    clear(status);
    const list = qs('#ollama-models');
    clear(list);
    if (!res.available) {
      status.append(el('p', 'status error', res.error ?? 'Ollama unavailable.'));
      return;
    }
    status.append(
      el('p', 'status ok', `Ollama running at ${res.baseUrl} — ${res.models.length} model(s) downloaded.`),
    );
    for (const m of res.models) {
      const chip = button('secondary', m.label, () => {
        qs<HTMLSelectElement>('#np-provider').value = 'ollama';
        qs<HTMLInputElement>('#np-model').value = m.id;
        newProjectDialog.open();
      });
      list.append(chip);
    }
  }

  // ------------------------------------------------------------ inspector: timeline

  function renderTimeline(): void {
    const panel = qs('#insp-panel-timeline');
    // Follow mode: if the user is at the bottom, stay pinned; otherwise keep scrollTop.
    const prevScrollTop = panel.scrollTop;
    const wasFollowing = panel.scrollHeight - panel.scrollTop - panel.clientHeight < 48;
    clear(panel);
    if (!state.run) {
      panel.append(el('p', 'muted', 'No run selected. Start or open a run to see its persisted event timeline.'));
      return;
    }
    if (state.eventsError !== null) {
      panel.append(
        el(
          'p',
          'status warn',
          `Persisted event timeline unavailable — ${state.eventsError}. Live node statuses above still update from run state.`,
        ),
      );
      return;
    }
    if (state.events.length === 0) {
      panel.append(el('p', 'muted', `Run ${state.run.id.slice(0, 13)}… has no persisted events yet.`));
      return;
    }
    // Windowed DOM: only the latest TIMELINE_WINDOW events are mounted.
    const start = Math.max(0, state.events.length - TIMELINE_WINDOW);
    if (start > 0) {
      panel.append(
        el('p', 'muted', `Showing the latest ${TIMELINE_WINDOW} of ${state.events.length} persisted events.`),
      );
    }
    const list = el('ol', 'timeline-list');
    // Loop revision numbers stay absolute even inside the window.
    let revisionCount = state.events.slice(0, start).filter((ev) => ev.event === 'loop-requeued').length;
    state.events.slice(start).forEach((ev, index) => {
      if (ev.event === 'loop-requeued') {
        revisionCount += 1;
        const marker = el('li', 'timeline-loop-marker', `Loop revision ${revisionCount}`);
        marker.dataset.loop = String(revisionCount);
        list.append(marker);
      }
      const item = el('li', 'timeline-event');
      item.dataset.eventIndex = String(start + index);
      item.append(
        el('span', 'timeline-ts', ev.ts.slice(11, 19)),
        el('span', 'badge', ev.event),
        el('span', 'timeline-msg', ev.detail ?? ev.status ?? ''),
      );
      if (ev.nodeId) item.append(el('span', 'meta', `node ${ev.nodeId.slice(0, 8)}`));
      list.append(item);
    });
    panel.append(list);
    if (wasFollowing) panel.scrollTop = panel.scrollHeight;
    else panel.scrollTop = prevScrollTop;
  }

  // ------------------------------------------------------------ inspector: approvals

  /** Structured one-line summary of an approval payload (raw JSON stays behind a disclosure). */
  function approvalSummaryRows(approval: ApprovalRecord): string[] {
    const payload = approval.payload as Record<string, unknown> | null;
    const rows: string[] = [];
    if (approval.kind === 'hire') {
      const assignments =
        (Array.isArray(payload?.assignments) ? payload?.assignments : Array.isArray(payload?.plan) ? payload?.plan : []) as Array<
          Record<string, unknown>
        >;
      for (const a of assignments) {
        const nodeTitle =
          (typeof a.nodeTitle === 'string' && a.nodeTitle) ||
          state.project?.nodes.find((n) => n.id === a.nodeId)?.title ||
          String(a.nodeId ?? '?');
        const skill = (typeof a.skillName === 'string' && a.skillName) || String(a.skillId ?? '?');
        rows.push(`${nodeTitle} → ${skill}${a.skillId ? ` (${String(a.skillId)})` : ''}`);
      }
    } else {
      const title =
        (typeof payload?.nodeTitle === 'string' && payload.nodeTitle) ||
        state.project?.nodes.find((n) => n.id === approval.nodeId)?.title ||
        approval.nodeId ||
        'node';
      rows.push(`Execute “${title}”${typeof payload?.reason === 'string' ? ` — ${payload.reason}` : ''}`);
    }
    return rows.length > 0 ? rows : ['Review the payload before deciding.'];
  }

  function renderApprovals(): void {
    const panel = qs('#insp-panel-approvals');
    // Preserve focus by approval id across re-renders.
    const active = document.activeElement;
    const focusedCard = active instanceof HTMLElement ? active.closest<HTMLElement>('.approval-card') : null;
    const focusedApprovalId = focusedCard?.dataset.approvalId ?? null;
    const focusedControl = active instanceof HTMLButtonElement ? (active.classList.contains('danger') ? 'reject' : 'approve') : null;
    const prevScrollTop = panel.scrollTop;

    clear(panel);
    const pending = state.approvals.filter((a) => a.status === 'pending').length;
    const countBadge = qs('#approvals-count');
    countBadge.textContent = pending > 0 ? String(pending) : '';
    countBadge.classList.toggle('hidden', pending === 0);
    countBadge.setAttribute('aria-label', `${pending} pending approvals`);

    if (!state.project) {
      panel.append(el('p', 'muted', 'No project selected.'));
      return;
    }
    if (state.approvalsError !== null) {
      panel.append(el('p', 'status warn', `Approval inbox unavailable — ${state.approvalsError}.`));
      return;
    }
    if (state.approvals.length === 0) {
      panel.append(el('p', 'muted', 'No approvals requested for this project.'));
      return;
    }
    for (const approval of state.approvals) {
      const card = el('div', 'node-card approval-card');
      card.dataset.approvalId = approval.id;
      const head = el('div', 'row space-between');
      head.append(el('strong', '', `${approval.kind} approval`), badgeForStatus(approval.status));
      card.append(head);
      const scope = el(
        'div',
        'meta',
        `${approval.runId ? `run ${approval.runId.slice(0, 13)}…` : 'design-time'}` +
          `${approval.nodeId ? ` · node ${approval.nodeId.slice(0, 8)}` : ''}` +
          ` · payload sha256 ${approval.payloadHash.slice(0, 12)}… · requested ${approval.createdAt.slice(0, 19).replace('T', ' ')}`,
      );
      card.append(scope);

      // Structured, readable summary of exactly what is being approved.
      const summaryList = el('ul', 'approval-summary');
      for (const line of approvalSummaryRows(approval)) summaryList.append(el('li', '', line));
      card.append(summaryList);

      // Raw payload (verbatim, non-secret by contract) behind a disclosure.
      const details = el('details', 'approval-raw');
      details.append(el('summary', '', 'Raw payload (JSON)'));
      details.append(el('pre', 'artifact approval-payload', JSON.stringify(approval.payload, null, 2)));
      card.append(details);

      if (approval.status === 'pending') {
        const actions = el('div', 'row');
        const decide = (decision: 'approved' | 'rejected') => {
          void (async () => {
            // Exactly-once: disable both buttons before the call; the inbox is
            // re-rendered from the authoritative list afterwards.
            approveBtn.disabled = true;
            rejectBtn.disabled = true;
            const res = await adapter.decideApproval({
              projectId: approval.projectId,
              runId: approval.runId,
              approvalId: approval.id,
              decision,
              payloadHash: approval.payloadHash,
            });
            if (!res.ok) {
              approveBtn.disabled = false;
              rejectBtn.disabled = false;
              card.append(el('p', 'status error', res.error));
              return;
            }
            announce(`Approval ${decision}: ${approvalSummaryRows(approval)[0] ?? approval.kind}.`);
            await refreshApprovals();
          })();
        };
        const approveBtn = button('', 'Approve', () => decide('approved'));
        const rejectBtn = button('danger', 'Reject', () => {
          void (async () => {
            const ok = await overlay.confirm({
              title: 'Reject approval',
              message: `Reject this ${approval.kind} approval? ${approvalSummaryRows(approval)[0] ?? ''}`,
              detail: `Pinned payload sha256 ${approval.payloadHash.slice(0, 12)}… — rejection is recorded against exactly this payload.`,
              confirmLabel: 'Reject',
              danger: true,
            });
            if (ok) decide('rejected');
          })();
        });
        actions.append(approveBtn, rejectBtn);
        card.append(actions);
      } else {
        card.append(
          el('div', 'meta', `decided ${approval.status} at ${(approval.decidedAt ?? '').slice(0, 19).replace('T', ' ')}`),
        );
      }
      panel.append(card);
    }
    panel.scrollTop = prevScrollTop;

    // Restore focus to the same approval's equivalent control, if it still exists.
    if (focusedApprovalId) {
      const card = panel.querySelector<HTMLElement>(`.approval-card[data-approval-id="${focusedApprovalId}"]`);
      const target =
        focusedControl === 'approve'
          ? card?.querySelector<HTMLButtonElement>('button:not(.danger)')
          : focusedControl === 'reject'
            ? card?.querySelector<HTMLButtonElement>('button.danger')
            : null;
      (target ?? card)?.focus?.();
    }
  }

  // ------------------------------------------------------------ inspector: artifacts

  function renderArtifacts(): void {
    const panel = qs('#insp-panel-artifacts');
    clear(panel);
    if (!state.project || !state.run) {
      panel.append(el('p', 'muted', 'No run selected. Artifacts appear here with full provenance.'));
      return;
    }
    const entries = Object.entries(state.run.nodeStates).filter(([, st]) => st.artifactId !== null);
    if (entries.length === 0) {
      panel.append(el('p', 'muted', 'This run has produced no artifacts yet.'));
      return;
    }
    const list = el('div', 'stack');
    const reader = el('div', 'artifact-reader');
    for (const [nodeId, st] of entries) {
      const node = state.project.nodes.find((n) => n.id === nodeId);
      const row = el('div', 'row space-between node-card');
      const attempts = st.attempt && st.attempt > 1 ? ` · attempt ${st.attempt}` : '';
      row.append(
        el('span', '', node?.title ?? nodeId),
        el('span', 'meta', `artifact ${st.artifactId?.slice(0, 8) ?? ''}…${attempts}`),
      );
      // Attempt selector: earlier attempts are never overwritten, all readable.
      let selectedAttempt: number | undefined;
      const artifactIds = st.artifactIds ?? [];
      if (artifactIds.length > 1) {
        const select = document.createElement('select');
        select.setAttribute('aria-label', `Attempt for ${node?.title ?? nodeId}`);
        select.className = 'attempt-select';
        artifactIds.forEach((artifactId, i) => {
          const opt = document.createElement('option');
          opt.value = String(i + 1);
          opt.textContent = `attempt ${i + 1}${i === artifactIds.length - 1 ? ' (latest)' : ''} · ${artifactId.slice(0, 8)}…`;
          select.append(opt);
        });
        select.value = String(artifactIds.length);
        selectedAttempt = artifactIds.length;
        select.addEventListener('change', () => {
          selectedAttempt = Number(select.value);
        });
        row.append(select);
      }
      const viewBtn = button('secondary', 'Read', () => {
        void (async () => {
          clear(reader);
          reader.append(el('p', 'muted', 'Loading artifact…'));
          const res = await adapter.readArtifact(state.project?.id ?? '', state.run?.id ?? '', nodeId, selectedAttempt);
          clear(reader);
          if (!res.ok || res.text === undefined || !res.meta) {
            reader.append(el('p', 'status error', res.error ?? 'Artifact unavailable.'));
            return;
          }
          reader.append(
            el(
              'p',
              'meta',
              `provenance: ${res.meta.provider} · ${res.meta.model} · node ${res.meta.nodeId.slice(0, 8)} · ` +
                `${res.meta.inputTokens} in / ${res.meta.outputTokens} out · $${res.meta.costUsd.toFixed(4)} · ` +
                `sha256 ${res.meta.textSha256.slice(0, 16)}… · ${res.meta.createdAt}`,
            ),
          );
          reader.append(el('pre', 'artifact', res.text));
        })();
      });
      row.append(viewBtn);
      list.append(row);
    }
    panel.append(list, reader);
  }

  // ------------------------------------------------------------ inspector: node

  function renderNodeInspector(): void {
    const panel = qs('#insp-panel-node');
    clear(panel);
    if (!state.project || !state.selectedNodeId) {
      panel.append(el('p', 'muted', 'Select a desk, roadmap row, or sitemap entry to inspect a node.'));
      return;
    }
    const project = state.project;
    const node = project.nodes.find((n) => n.id === state.selectedNodeId);
    if (!node) {
      panel.append(el('p', 'muted', 'Selected node no longer exists.'));
      return;
    }
    const runState: RunNodeState | undefined = state.run?.nodeStates[node.id];
    const parent = node.parentId ? project.nodes.find((n) => n.id === node.parentId) : undefined;
    const children = project.nodes.filter((n) => n.parentId === node.id);

    const head = el('div', 'row space-between');
    head.append(el('h3', 'node-inspect-title', node.title), badgeForStatus(runState?.status ?? 'pending', runState?.error));
    panel.append(head);

    // Ask the Director about this node (sets/clears chat scope).
    if (adapter.capabilities.chat) {
      const scoped = chat.state().nodeScope?.nodeId === node.id;
      const askBtn = button('secondary', scoped ? 'Clear chat scope for this node' : 'Ask about this node', () => {
        if (chat.state().nodeScope?.nodeId === node.id) {
          chat.setNodeScope(null);
        } else {
          chat.setNodeScope(node.id, node.title);
          setInspectorTab('chat');
          announce(`Chat scope set to ${node.title}.`);
        }
        renderNodeInspector();
      });
      askBtn.id = 'node-ask-btn';
      panel.append(askBtn);
    }

    const kv = el('dl', 'kv');
    const addKv = (k: string, v: string) => {
      kv.append(el('dt', '', k), el('dd', '', v));
    };
    addKv('Role', node.role);
    addKv('Kind', node.kind ?? (node.role === 'director' ? 'director' : 'worker'));
    addKv('Room', roomsFor().find((r) => r.nodeIds.includes(node.id))?.label ?? roomIdForNode(node));
    addKv('Reports to', parent ? parent.title : '—');
    addKv('Direct reports', children.length > 0 ? children.map((c) => c.title).join(', ') : '—');
    addKv('Skill', node.skillRef ?? '—');
    if (node.approvalBefore) addKv('Gate', 'requires approval before execution');
    addKv(
      'Budget',
      `${node.budget.maxTokens} tokens · ${node.budget.maxMinutes} min · $${node.budget.maxUsd}`,
    );
    if (runState) {
      addKv(
        'Usage (this run)',
        `${runState.usage.inputTokens} in / ${runState.usage.outputTokens} out · $${runState.usage.costUsd.toFixed(4)}` +
          (runState.attempt ? ` · attempt ${runState.attempt}` : ''),
      );
    }
    panel.append(kv);
    if (node.instructions) panel.append(el('p', 'meta', node.instructions));

    // Room reassignment editor (optimistic concurrency via expectedVersion).
    const reassignBox = el('div', 'reassign-box');
    reassignBox.append(el('h4', '', 'Room assignment'));
    if (!adapter.capabilities.officeUpdate) {
      reassignBox.append(el('p', 'status warn', `Room reassignment ${UNAVAILABLE_V3}.`));
    } else {
      const rooms = roomsFor();
      const row = el('div', 'row wrap');
      const select = document.createElement('select');
      select.id = 'reassign-room-select';
      const currentRoomId = roomIdForNode(node);
      for (const room of rooms) {
        const opt = document.createElement('option');
        opt.value = room.id;
        opt.textContent = room.label;
        select.append(opt);
      }
      if (!rooms.some((r) => r.id === 'room:custom')) {
        const newOpt = document.createElement('option');
        newOpt.value = 'room:custom';
        newOpt.textContent = 'Specialists (custom)';
        select.append(newOpt);
      }
      select.value = currentRoomId;
      row.append(select);
      const status = el('span', 'status');
      const assignBtn = button('secondary', 'Assign room', () => {
        void (async () => {
          assignBtn.disabled = true;
          status.textContent = '';
          const res = await adapter.reassignNode({
            projectId: project.id,
            nodeId: node.id,
            expectedVersion: project.version ?? 0,
            roomId: select.value,
          });
          assignBtn.disabled = false;
          if (!res.ok) {
            status.className = 'status error';
            status.textContent = res.error;
            // OCC conflicts surface as errors; reload to get the fresh version.
            await selectProject(project.id);
            return;
          }
          status.className = 'status ok';
          status.textContent = 'Room updated.';
          await selectProject(project.id);
        })();
      });
      row.append(assignBtn, status);
      reassignBox.append(row);
    }
    panel.append(reassignBox);
  }

  // ------------------------------------------------------------ new project dialog

  const newProjectDialog = overlay.attachDialog(qs('#new-project-dialog'));

  function renderHierarchyPreview(): void {
    const box = qs('#np-preview');
    clear(box);
    const template = qs<HTMLSelectElement>('#np-template').value as ProjectTemplate;
    box.append(el('h4', '', template === 'office' ? 'Office hierarchy preview (local illustration)' : 'Standard squad preview (local illustration)'));
    const list = el('ul', 'sitemap-list');
    if (template === 'office') {
      const hierarchy = standardOfficeHierarchy();
      const byTitle = new Map<string, HTMLUListElement>();
      byTitle.set('', list);
      for (const member of hierarchy) {
        const item = el('li');
        item.append(el('span', '', `${member.title} — ${member.role}`));
        const childList = el('ul', 'sitemap-nodes');
        item.append(childList);
        byTitle.set(member.title, childList);
        (byTitle.get(member.parentTitle ?? '') ?? list).append(item);
      }
    } else {
      for (const title of ['Director', 'Research', 'Build', 'Review']) {
        const item = el('li');
        item.append(el('span', '', title));
        list.append(item);
      }
    }
    box.append(list);
    box.append(
      el(
        'p',
        'meta',
        adapter.capabilities.hires
          ? 'The runtime generates the authoritative hierarchy on create; skills are matched from your goal via hire preview afterwards.'
          : `The runtime generates the hierarchy on create. Goal-based hire preview ${UNAVAILABLE_V3}.`,
      ),
    );
  }

  function openNewProjectDialog(): void {
    renderHierarchyPreview();
    newProjectDialog.open();
    qs<HTMLInputElement>('#np-name').focus();
  }

  async function submitNewProject(event: Event): Promise<void> {
    event.preventDefault();
    const status = qs('#proj-status');
    clear(status);
    const successCriteria = qs<HTMLTextAreaElement>('#np-success-criteria')
      .value.split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
    // Nodes are generated by the runtime from the template (office hierarchy
    // or legacy standard squad) — the renderer sends no hand-built nodes.
    const req: CreateProjectRequest = {
      name: qs<HTMLInputElement>('#np-name').value,
      goal: qs<HTMLTextAreaElement>('#np-goal').value,
      provider: qs<HTMLSelectElement>('#np-provider').value as ProjectProvider,
      model: qs<HTMLInputElement>('#np-model').value,
      template: qs<HTMLSelectElement>('#np-template').value as ProjectTemplate,
      successCriteria: successCriteria.length > 0 ? successCriteria : undefined,
      loopPolicy: {
        maxIterations: Math.min(5, Math.max(1, numInputValue('#np-loop-max-iterations', 3))),
        noProgressLimit: Math.min(5, Math.max(1, numInputValue('#np-loop-no-progress', 2))),
      },
    };
    const res = await adapter.createProject(req);
    if (!res.ok || !res.project) {
      status.append(el('p', 'status error', res.error ?? 'Failed to create project.'));
      return;
    }
    newProjectDialog.close();
    overlay.toast(`Project “${res.project.name}” created.`, { kind: 'ok' });
    await refreshProjects(res.project.id);
  }

  // ------------------------------------------------------------ wiring

  function renderAll(): void {
    renderOffice();
    renderRoadmap();
    renderRuns();
    renderSkills();
    renderTimeline();
    renderApprovals();
    renderArtifacts();
    renderNodeInspector();
  }

  function wire(): void {
    for (const t of OFFICE_TABS) {
      qs(`#tab-${t}`).addEventListener('click', () => setOfficeTab(t));
    }
    for (const t of INSPECTOR_TABS) {
      qs(`#insp-tab-${t}`).addEventListener('click', () => setInspectorTab(t));
    }
    wireTabKeyboard(qs('.office-tabs'), OFFICE_TABS.map((t) => `tab-${t}`), (id) => setOfficeTab(id as OfficeTab));
    wireTabKeyboard(qs('.inspector-tabs'), INSPECTOR_TABS.map((t) => `insp-tab-${t}`), (id) =>
      setInspectorTab(id as InspectorTab),
    );
    qs('#inspector-toggle').addEventListener('click', () => toggleInspector(!state.inspectorCollapsed));
    qs('#sitemap-toggle').addEventListener('click', () => {
      state.sitemapOpen = !state.sitemapOpen;
      renderSitemap();
    });

    // Camera controls: zoom, reset, and directional pan (non-drag alternative).
    qs('#canvas-zoom-in').addEventListener('click', () => canvas.zoomIn());
    qs('#canvas-zoom-out').addEventListener('click', () => canvas.zoomOut());
    qs('#canvas-reset').addEventListener('click', () => canvas.resetView());
    qs('#canvas-pan-left').addEventListener('click', () => canvas.panBy(160, 0));
    qs('#canvas-pan-right').addEventListener('click', () => canvas.panBy(-160, 0));
    qs('#canvas-pan-up').addEventListener('click', () => canvas.panBy(0, 160));
    qs('#canvas-pan-down').addEventListener('click', () => canvas.panBy(0, -160));
    const viewport = qs('#office-canvas-viewport');
    viewport.addEventListener('keydown', (event) => {
      const step = 140;
      if (event.key === 'ArrowLeft') canvas.panBy(step, 0);
      else if (event.key === 'ArrowRight') canvas.panBy(-step, 0);
      else if (event.key === 'ArrowUp') canvas.panBy(0, step);
      else if (event.key === 'ArrowDown') canvas.panBy(0, -step);
      else if (event.key === '+' || event.key === '=') canvas.zoomIn();
      else if (event.key === '-' || event.key === '_') canvas.zoomOut();
      else return;
      event.preventDefault();
    });
    if (typeof ResizeObserver === 'function') {
      resizeObserver = new ResizeObserver(() => canvas.notifyResize());
      resizeObserver.observe(viewport);
    }

    // App-level Reduce motion toggle (in addition to the OS setting).
    const motionToggle = qs<HTMLInputElement>('#reduce-motion-toggle');
    motionToggle.checked = appReduceMotionEnabled();
    motionToggle.addEventListener('change', () => {
      setAppReduceMotion(motionToggle.checked);
      announce(motionToggle.checked ? 'Reduce motion on: animations are skipped.' : 'Reduce motion off.');
    });

    qs<HTMLSelectElement>('#project-rail').addEventListener('change', (event) => {
      const value = (event.target as HTMLSelectElement).value;
      if (value) void selectProject(value);
    });
    qs('#project-new').addEventListener('click', openNewProjectDialog);
    qs('#np-cancel').addEventListener('click', () => newProjectDialog.close());
    qs('#np-template').addEventListener('change', renderHierarchyPreview);
    qs('#project-form').addEventListener('submit', (event) => void submitNewProject(event));
    qs('#np-list-models').addEventListener('click', () => {
      void (async () => {
        const status = qs('#proj-status');
        clear(status);
        const provider = qs<HTMLSelectElement>('#np-provider').value as ProjectProvider;
        const res = await adapter.listProviderModels(provider);
        if (!res.ok) {
          status.append(el('p', 'status error', res.error ?? 'Model list failed.'));
          return;
        }
        const select = qs<HTMLSelectElement>('#np-model-select');
        clear(select);
        select.classList.remove('hidden');
        for (const m of res.models) {
          const opt = document.createElement('option');
          opt.value = m.id;
          opt.textContent = m.label;
          select.append(opt);
        }
        if (res.models[0]) qs<HTMLInputElement>('#np-model').value = res.models[0].id;
      })();
    });
    qs('#np-model-select').addEventListener('change', () => {
      qs<HTMLInputElement>('#np-model').value = qs<HTMLSelectElement>('#np-model-select').value;
    });

    // Runs
    qs('#run-start').addEventListener('click', () => void startRun());
    qs('#run-pause').addEventListener('click', () => void (state.run && adapter.pauseRun(state.run.id)));
    qs('#run-resume').addEventListener('click', () => void (state.run && adapter.resumeRun(state.run.id)));
    qs('#run-cancel').addEventListener('click', () => void (state.run && adapter.cancelRun(state.run.id)));
    qs('#run-recover').addEventListener('click', () => {
      void (async () => {
        if (!state.run) return;
        const status = qs('#run-status');
        clear(status);
        const res = await adapter.recoverRun(state.run.id);
        if (!res.ok) {
          status.append(el('p', 'status error', res.error));
          return;
        }
        status.append(el('p', 'status ok', 'Interrupted run recovered.'));
        await refreshRun();
        await Promise.all([refreshTimeline(), refreshApprovals()]);
      })();
    });

    // Skills
    qs('#skills-search').addEventListener('input', queueRenderSkills);
    qs('#skills-reload').addEventListener('click', () => void loadSkills());
    qs('#hire-preview-btn').addEventListener('click', () => void previewHires());
    qs('#hire-apply-btn').addEventListener('click', () => void applyHires());
    qs('#hire-confirm').addEventListener('change', renderSkills);

    // Connections
    qs('#conn-list-models').addEventListener('click', () => void listModelsLive());
    qs('#ollama-detect').addEventListener('click', () => void detectOllamaUi());
    qs('#conn-runtime-connect').addEventListener('click', () => {
      void (async () => {
        const status = qs('#conn-runtime-status');
        clear(status);
        const res = await adapter.connectRuntime(qs<HTMLInputElement>('#conn-runtime-url').value);
        if (!res.ok) status.append(el('p', 'status error', res.error ?? 'Connection failed.'));
      })();
    });

    // Live run events: update cheap surfaces immediately from the payload,
    // coalesce refetches (timeline/approvals) into ~200ms incremental reads.
    unsubscribeProjectEvents = adapter.onProjectEvent((run) => {
      if (!state.project || run.projectId !== state.project.id) return;
      const statusChanged = state.run?.status !== run.status;
      state.run = run;
      const idx = state.runs.findIndex((r) => r.id === run.id);
      if (idx >= 0) state.runs[idx] = run;
      else state.runs.unshift(run);
      renderOffice();
      renderRuns();
      renderArtifacts();
      scheduleLiveRefresh({ timeline: true, approvals: true });
      if (statusChanged) announce(summarizeState());
    });
  }

  wire();
  setOfficeTab('office');
  setInspectorTab('timeline');
  renderAll();
  void chat.reloadSessions();

  return {
    async show(): Promise<void> {
      await refreshProjects();
      await chat.reloadSessions();
      chat.setProject(state.project);
    },
    hide(): void {
      // State persists for quick return; nothing to tear down per-show.
    },
    /** v0.5: deep-link a project (e.g. from a CEO company card). */
    async openProject(projectId: string): Promise<void> {
      await refreshProjects();
      await selectProject(projectId);
    },
    renderAll,
    state: () => state,
    destroy(): void {
      unsubscribeProjectEvents?.();
      unsubscribeProjectEvents = null;
      resizeObserver?.disconnect();
      resizeObserver = null;
      if (coalesceTimer !== null) window.clearTimeout(coalesceTimer);
      if (announceTimer !== null) window.clearTimeout(announceTimer);
      chat.destroy();
      canvas.dispose();
    },
  };
}
