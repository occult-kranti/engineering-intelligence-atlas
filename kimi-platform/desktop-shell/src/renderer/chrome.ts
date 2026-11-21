/**
 * Local chrome/launcher page logic. Runs only on file:// inside the sandboxed
 * shell window. Structural copies of the bridge types live here so the
 * renderer build stays self-contained; src/shared/contract.ts is authoritative.
 */

interface GpuInfo {
  name: string;
  vramTotalBytes: number | null;
  vramFreeBytes: number | null;
  source: 'nvidia-smi' | 'unavailable';
}
interface SystemInfo {
  cpuModel: string;
  logicalCores: number;
  totalRamBytes: number;
  freeRamBytes: number;
  os: { platform: string; release: string; arch: string };
  disk: { totalBytes: number | null; freeBytes: number | null; path: string };
  gpus: GpuInfo[];
  notes: string[];
}
interface RequirementCheck {
  status: 'pass' | 'fail' | 'unknown' | 'not-required';
  requiredBytes: number | null;
  availableBytes: number | null;
  message: string;
}
interface RequirementReport {
  modelId: string;
  checks: { ram: RequirementCheck; disk: RequirementCheck; vram: RequirementCheck };
  canDownload: boolean;
  summary: string;
}
interface CatalogModel {
  id: string;
  family: string;
  task: string;
  name?: string;
  repoId: string;
  revision: string;
  format: string;
  quantization: string | null;
  sizeBytes: number;
  sizeScope?: string;
  files: { path: string; sizeBytes: number; sha256: string | null }[];
  minRamBytes: number | null;
  minVramBytes: number | null;
  license: string;
  licenseUrl?: string;
  sourceUrl: string;
  runtime: string;
  remoteCodeRequired: boolean;
  availability: 'available' | 'unavailable' | 'quarantined';
  availabilityNote?: string;
  notes?: string;
}
interface CatalogResult {
  models: CatalogModel[];
  rejected: { id: string; errors: string[] }[];
  catalogPath: string;
}
interface JobRecord {
  id: string;
  kind: string;
  status: string;
  progress: number | null;
  detail: string;
  error: string | null;
  createdAt: string;
  updatedAt: string;
}

// ---- v2: vault / providers / projects (structural copies of contract.ts) ----

type ApiProvider = 'openai' | 'anthropic';
type ProjectProvider = ApiProvider | 'ollama';
type ProjectNodeRole = 'director' | 'research' | 'build' | 'review' | 'custom';
type NodeStatus = 'pending' | 'running' | 'succeeded' | 'failed' | 'skipped';

interface ProviderCredentialStatus {
  configured: boolean;
  readable: boolean;
  updatedAt: string | null;
}
interface VaultStatus {
  encryptionAvailable: boolean;
  providers: Record<ApiProvider, ProviderCredentialStatus>;
}
interface ModelInfo {
  id: string;
  label: string;
}
interface ListModelsResult {
  ok: boolean;
  models: ModelInfo[];
  error?: string;
}
interface OllamaStatus {
  available: boolean;
  baseUrl: string;
  models: ModelInfo[];
  error: string | null;
}
interface BudgetLimits {
  maxTokens: number;
  maxMinutes: number;
  maxUsd: number;
}
interface PriceRates {
  inputUsdPerMillion: number;
  outputUsdPerMillion: number;
}
interface ProjectNode {
  id: string;
  role: ProjectNodeRole;
  title: string;
  instructions: string;
  dependsOn: string[];
  status: NodeStatus;
  budget: BudgetLimits;
}
interface Project {
  id: string;
  name: string;
  goal: string;
  provider: ProjectProvider;
  model: string;
  nodes: ProjectNode[];
  createdAt: string;
  updatedAt: string;
}
interface ProjectNodeDraft {
  role: ProjectNodeRole;
  title: string;
  instructions: string;
  dependsOn: Array<number | string>;
  budget?: Partial<BudgetLimits>;
}
interface CreateProjectRequest {
  name: string;
  goal: string;
  provider: ProjectProvider;
  model: string;
  nodes?: ProjectNodeDraft[];
}
interface StartRunRequest {
  projectId: string;
  runBudget: BudgetLimits;
  priceRates: PriceRates;
}
type RunStatus = 'running' | 'paused' | 'completed' | 'failed' | 'cancelled' | 'terminated';
interface UsageTotals {
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}
interface RunNodeState {
  status: NodeStatus;
  usage: UsageTotals;
  artifactId: string | null;
  error: string | null;
  startedAt: string | null;
  finishedAt: string | null;
}
interface ProjectRun {
  id: string;
  projectId: string;
  status: RunStatus;
  terminationReason: 'max-tokens' | 'max-minutes' | 'max-usd' | null;
  error: string | null;
  runBudget: BudgetLimits;
  priceRates: PriceRates;
  usage: UsageTotals & { elapsedSeconds: number };
  nodeStates: Record<string, RunNodeState>;
  createdAt: string;
  updatedAt: string;
  finishedAt: string | null;
}
interface ArtifactMeta {
  artifactId: string;
  projectId: string;
  runId: string;
  nodeId: string;
  role: ProjectNodeRole;
  provider: ProjectProvider;
  model: string;
  createdAt: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  promptSha256: string;
  textSha256: string;
}

interface DesktopBridge {
  version: number;
  getSystemInfo(): Promise<SystemInfo>;
  getModelCatalog(): Promise<CatalogResult>;
  checkModelRequirements(modelId: string): Promise<RequirementReport>;
  createVenv(req: { name: string; confirmed: boolean; installHuggingFaceHub?: boolean }): Promise<{
    ok: boolean;
    path?: string;
    pythonPath?: string;
    jobId?: string;
    error?: string;
  }>;
  downloadModel(req: { modelId: string; confirmed: boolean }): Promise<{ ok: boolean; jobId?: string; error?: string }>;
  getJobStatus(jobId?: string): Promise<JobRecord[]>;
  cancelJob(jobId: string): Promise<{ ok: boolean; error?: string }>;
  openOfflineAtlas(): Promise<{ ok: boolean; error?: string }>;
  connectRuntime(url: string): Promise<{ ok: boolean; url?: string; error?: string }>;
  backToLauncher(): Promise<{ ok: boolean }>;
  getSettings(): Promise<{ runtimeUrl: string | null }>;
  openExternal(url: string): Promise<{ ok: boolean; error?: string }>;
  getVaultStatus(): Promise<VaultStatus>;
  setApiKey(provider: ApiProvider, key: string): Promise<{ ok: boolean; error?: string }>;
  revokeApiKey(provider: ApiProvider): Promise<{ ok: boolean; error?: string }>;
  listProviderModels(provider: ProjectProvider): Promise<ListModelsResult>;
  detectOllama(): Promise<OllamaStatus>;
  listProjects(): Promise<Project[]>;
  createProject(req: CreateProjectRequest): Promise<{ ok: boolean; project?: Project; error?: string }>;
  getProject(projectId: string): Promise<Project | null>;
  startRun(req: StartRunRequest): Promise<{ ok: boolean; runId?: string; error?: string }>;
  pauseRun(runId: string): Promise<{ ok: boolean; error?: string }>;
  resumeRun(runId: string): Promise<{ ok: boolean; error?: string }>;
  cancelRun(runId: string): Promise<{ ok: boolean; error?: string }>;
  listRuns(projectId?: string): Promise<ProjectRun[]>;
  readArtifact(
    projectId: string,
    runId: string,
    nodeId: string,
  ): Promise<{ ok: boolean; text?: string; meta?: ArtifactMeta; error?: string }>;
  onJobEvent(listener: (job: JobRecord) => void): () => void;
  onModeChanged(listener: (mode: 'launcher' | 'content', url: string | null) => void): () => void;
  onProjectEvent(listener: (run: ProjectRun) => void): () => void;
}

declare global {
  interface Window {
    desktopBridge?: DesktopBridge;
  }
}

const bridge = window.desktopBridge;

function $(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) throw new Error(`missing element #${id}`);
  return el;
}

function setStatus(el: HTMLElement, message: string, kind: '' | 'ok' | 'error' = ''): void {
  el.textContent = message;
  el.className = `status ${kind}`.trim();
}

function formatBytes(n: number | null): string {
  if (n === null) return 'unknown';
  const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB'];
  let value = n;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value >= 100 || unit === 0 ? 0 : 1)} ${units[unit]}`;
}

// ---------------------------------------------------------------- toolbar

function setMode(mode: 'launcher' | 'content', url: string | null): void {
  $('toolbar').classList.toggle('hidden', mode !== 'content');
  $('launcher-view').classList.toggle('hidden', mode !== 'launcher');
  $('system-view').classList.add('hidden');
  $('projects-view').classList.add('hidden');
  if (mode === 'content') {
    $('content-location').textContent = url ?? '';
    const isRemote = url !== null && (url.startsWith('https://') || url.startsWith('http://'));
    $('open-in-browser').classList.toggle('hidden', !isRemote);
    if (isRemote && url) {
      $('open-in-browser').onclick = () => void bridge?.openExternal(url);
    }
  }
}

// ---------------------------------------------------------------- launcher

function showView(id: 'launcher-view' | 'system-view' | 'projects-view'): void {
  for (const v of ['launcher-view', 'system-view', 'projects-view']) {
    $(v).classList.toggle('hidden', v !== id);
  }
}

function initLauncher(): void {
  $('open-atlas').addEventListener('click', async () => {
    const status = $('atlas-status');
    if (!bridge) {
      setStatus(status, 'Desktop bridge unavailable.', 'error');
      return;
    }
    setStatus(status, 'Opening…');
    const res = await bridge.openOfflineAtlas();
    if (!res.ok) setStatus(status, res.error ?? 'Failed to open atlas.', 'error');
    else setStatus(status, '');
  });

  $('connect-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const status = $('connect-status');
    if (!bridge) {
      setStatus(status, 'Desktop bridge unavailable.', 'error');
      return;
    }
    const input = $('runtime-url') as HTMLInputElement;
    setStatus(status, 'Connecting…');
    const res = await bridge.connectRuntime(input.value);
    if (!res.ok) setStatus(status, res.error ?? 'Connection failed.', 'error');
    else setStatus(status, '');
  });

  $('open-system').addEventListener('click', () => {
    showView('system-view');
    void refreshSystemPanel();
  });

  $('system-back').addEventListener('click', () => showView('launcher-view'));

  $('open-projects').addEventListener('click', () => {
    showView('projects-view');
    void getOfficeApp().show();
  });

  $('projects-back').addEventListener('click', () => showView('launcher-view'));

  void bridge?.getSettings().then((settings) => {
    if (settings.runtimeUrl) {
      ($('runtime-url') as HTMLInputElement).value = settings.runtimeUrl;
    }
  });
}

// ---------------------------------------------------------------- system panel

function renderSystemInfo(info: SystemInfo): void {
  const container = $('sysinfo');
  const rows: [string, string][] = [
    ['CPU', `${info.cpuModel} (${info.logicalCores} logical cores)`],
    ['RAM', `${formatBytes(info.freeRamBytes)} free / ${formatBytes(info.totalRamBytes)} total`],
    ['OS', `${info.os.platform} ${info.os.release} (${info.os.arch})`],
    ['Disk (data dir)', `${formatBytes(info.disk.freeBytes)} free / ${formatBytes(info.disk.totalBytes)} total — ${info.disk.path}`],
  ];
  if (info.gpus.length === 0) {
    rows.push(['GPU', 'None detected via nvidia-smi (VRAM unknown)']);
  } else {
    for (const [i, gpu] of info.gpus.entries()) {
      rows.push([
        `GPU ${i + 1}`,
        `${gpu.name} — VRAM total ${formatBytes(gpu.vramTotalBytes)}, free ${formatBytes(gpu.vramFreeBytes)} (${gpu.source})`,
      ]);
    }
  }
  for (const note of info.notes) rows.push(['Note', note]);
  container.innerHTML = '';
  for (const [k, v] of rows) {
    const dt = document.createElement('dt');
    dt.textContent = k;
    const dd = document.createElement('dd');
    dd.textContent = v;
    container.append(dt, dd);
  }
}

async function refreshCatalog(): Promise<void> {
  if (!bridge) return;
  const container = $('catalog');
  container.innerHTML = '';
  const result = await bridge.getModelCatalog();
  if (result.models.length === 0) {
    const p = document.createElement('p');
    p.className = 'muted';
    p.textContent =
      'The catalog is empty. Reviewed models will appear here after the research lead populates models.catalog.json.';
    container.append(p);
  }
  for (const model of result.models) {
    container.append(renderModelCard(model));
  }
  if (result.rejected.length > 0) {
    setStatus(
      $('catalog-status'),
      `${result.rejected.length} catalog entr${result.rejected.length === 1 ? 'y was' : 'ies were'} rejected by validation and hidden.`,
      'error',
    );
  } else {
    setStatus($('catalog-status'), '');
  }
}

function renderModelCard(model: CatalogModel): HTMLElement {
  const card = document.createElement('div');
  card.className = 'model-card';

  const title = document.createElement('strong');
  title.textContent = model.name ? `${model.name} (${model.id})` : model.id;
  card.append(title);

  const badge = document.createElement('span');
  badge.className = `badge ${model.availability === 'available' ? 'ok' : model.availability === 'unavailable' ? 'unknown' : 'fail'}`;
  badge.textContent =
    model.availability === 'available'
      ? 'available'
      : model.availability === 'unavailable'
        ? 'unavailable (gated)'
        : 'quarantined — research only';
  card.append(document.createTextNode(' '), badge);

  const meta = document.createElement('div');
  meta.className = 'meta';
  meta.textContent =
    `${model.repoId} · ${model.task} · ${model.format}` +
    (model.quantization ? ` (${model.quantization})` : '') +
    ` · ${formatBytes(model.sizeBytes)} · ${model.files.length} file(s) · license: ${model.license}` +
    ` · pinned ${model.revision.slice(0, 12)}…`;
  card.append(meta);

  const runtime = document.createElement('div');
  runtime.className = 'meta';
  runtime.textContent = `Runtime (for your own environment; this shell never runs models): ${model.runtime}`;
  card.append(runtime);

  if (model.availability !== 'available' && model.availabilityNote) {
    const note = document.createElement('div');
    note.className = 'checks';
    note.textContent = model.availabilityNote;
    card.append(note);
  }
  if (model.notes) {
    const notes = document.createElement('div');
    notes.className = 'meta';
    notes.textContent = model.notes;
    card.append(notes);
  }

  const checks = document.createElement('div');
  checks.className = 'checks';
  card.append(checks);

  const row = document.createElement('div');
  row.className = 'row';

  const checkBtn = document.createElement('button');
  checkBtn.className = 'secondary';
  checkBtn.textContent = 'Check requirements';
  checkBtn.onclick = async () => {
    if (!bridge) return;
    const report = await bridge.checkModelRequirements(model.id);
    renderRequirementReport(checks, report);
  };
  row.append(checkBtn);

  if (model.availability === 'available') {
    const downloadBtn = document.createElement('button');
    downloadBtn.textContent = 'Download…';
    downloadBtn.onclick = async () => {
      if (!bridge) return;
      const report = await bridge.checkModelRequirements(model.id);
      renderRequirementReport(checks, report);
      if (!report.canDownload) return;
      const overlays = getOverlayHost();
      const ok = await overlays.confirm({
        title: 'Download model',
        message: `Download ${model.repoId} @ ${model.revision} (${formatBytes(model.sizeBytes)}, ${model.files.length} file(s)) from Hugging Face?`,
        detail: 'Files are stored locally under userData/models, size- and hash-verified when published, and never executed by this shell.',
        confirmLabel: 'Download',
      });
      if (!ok) return;
      const res = await bridge.downloadModel({ modelId: model.id, confirmed: true });
      if (!res.ok) setStatus($('catalog-status'), res.error ?? 'Download failed to start.', 'error');
      else setStatus($('catalog-status'), `Download started (job ${res.jobId}).`, 'ok');
    };
    row.append(downloadBtn);
  } else {
    const disabled = document.createElement('button');
    disabled.disabled = true;
    disabled.className = 'secondary';
    disabled.textContent = model.availability === 'unavailable' ? 'Download disabled (gated)' : 'Download/run disabled';
    row.append(disabled);
  }

  const sourceBtn = document.createElement('button');
  sourceBtn.className = 'secondary';
  sourceBtn.textContent = 'Source ↗';
  sourceBtn.onclick = () => void bridge?.openExternal(model.sourceUrl);
  row.append(sourceBtn);

  if (model.licenseUrl) {
    const licenseBtn = document.createElement('button');
    licenseBtn.className = 'secondary';
    licenseBtn.textContent = 'License ↗';
    licenseBtn.onclick = () => void bridge?.openExternal(model.licenseUrl as string);
    row.append(licenseBtn);
  }

  card.append(row);
  return card;
}

function renderRequirementReport(container: HTMLElement, report: RequirementReport): void {
  container.innerHTML = '';
  for (const [label, c] of Object.entries(report.checks)) {
    const badge = document.createElement('span');
    badge.className = `badge ${c.status === 'pass' || c.status === 'not-required' ? 'ok' : c.status}`;
    badge.textContent = `${label}: ${c.status}`;
    container.append(badge);
  }
  const summary = document.createElement('div');
  summary.textContent = report.summary;
  container.append(summary);
}

// ---------------------------------------------------------------- office (v0.3)

import { BridgeAdapter, type RawBridge } from './office/bridge.js';
import { createOfficeApp, type OfficeApp } from './office/app.js';
import { createOverlayHost, type OverlayHost } from './office/overlay.js';
import { initMotion } from './office/motion.js';
import type { PanzoomInstance } from './office/canvas.js';
import { createEnterpriseApp, type EnterpriseApp } from './enterprise/app.js';

declare global {
  interface Window {
    /** Vendored panzoom UMD global (./vendor/panzoom, MIT — see vendor/panzoom/LICENSE.txt). */
    panzoom?: (elem: HTMLElement, options?: Record<string, unknown>) => PanzoomInstance;
  }
}

let officeApp: OfficeApp | null = null;
let overlayHost: OverlayHost | null = null;

function getOverlayHost(): OverlayHost {
  if (!overlayHost) overlayHost = createOverlayHost($('overlay-root'));
  return overlayHost;
}

function getOfficeApp(): OfficeApp {
  if (!bridge) throw new Error('office requires the desktop bridge');
  if (!officeApp) {
    const panzoomFactory = window.panzoom;
    if (!panzoomFactory) throw new Error('vendored panzoom failed to load');
    officeApp = createOfficeApp({
      root: $('projects-view'),
      adapter: new BridgeAdapter(bridge as unknown as RawBridge),
      panzoomFactory,
      overlay: getOverlayHost(),
    });
  }
  return officeApp;
}

// ---------------------------------------------------------------- CEO (v0.5)

/**
 * The CEO tab lives inside the office chrome (company cards deep-link into
 * the existing Project Office). Tab coordination: office/app.ts owns the
 * five office tabs; this module owns #tab-ceo/#panel-ceo and mirrors the
 * office's APG state on activation, without touching office logic.
 */

const OFFICE_TAB_IDS = ['office', 'roadmap', 'runs', 'skills', 'connections'] as const;

let enterpriseApp: EnterpriseApp | null = null;
let ceoTabActive = false;

function getEnterpriseApp(): EnterpriseApp {
  if (!bridge) throw new Error('CEO mode requires the desktop bridge');
  if (!enterpriseApp) {
    enterpriseApp = createEnterpriseApp({
      root: $('ceo-root'),
      adapter: new BridgeAdapter(bridge as unknown as RawBridge),
      overlay: getOverlayHost(),
      panzoomFactory: window.panzoom ?? null,
      openProject: (projectId) => {
        // Deep-link: switch to the Office tab, then select the company project.
        ($('tab-office') as HTMLButtonElement).click();
        void getOfficeApp().openProject(projectId);
      },
      announce: (message) => {
        $('live-summary').textContent = message;
      },
    });
  }
  return enterpriseApp;
}

function setCeoTabActive(active: boolean): void {
  if (ceoTabActive === active) return;
  ceoTabActive = active;
  const tab = $('tab-ceo') as HTMLButtonElement;
  tab.setAttribute('aria-selected', active ? 'true' : 'false');
  $('panel-ceo').hidden = !active;
  $('projects-view').classList.toggle('ceo-active', active);
  if (active) {
    // Mirror the office's tab-state handling for its five tabs.
    for (const t of OFFICE_TAB_IDS) {
      const officeTab = $(`tab-${t}`) as HTMLButtonElement;
      officeTab.setAttribute('aria-selected', 'false');
      officeTab.tabIndex = -1;
      $(`panel-${t}`).hidden = true;
    }
    tab.tabIndex = 0;
    void getEnterpriseApp().show();
  } else {
    tab.tabIndex = 0; // stays keyboard-reachable even when inactive
    enterpriseApp?.hide();
  }
}

/** Runs after office/app.ts handlers: yield the CEO tab when an office tab wins. */
function deactivateCeoIfOfficeTabSelected(): void {
  if (!ceoTabActive) return;
  const officeSelected = OFFICE_TAB_IDS.some((t) => $(`tab-${t}`).getAttribute('aria-selected') === 'true');
  if (officeSelected) setCeoTabActive(false);
}

function initCeoIntegration(): void {
  $('open-ceo').addEventListener('click', () => {
    showView('projects-view');
    // Await the office's initial load+tab selection BEFORE activating CEO,
    // otherwise the office's own setOfficeTab re-shows its panel over ours.
    void getOfficeApp()
      .show()
      .finally(() => {
        setCeoTabActive(true);
        ($('tab-ceo') as HTMLButtonElement).focus();
      });
  });
  $('tab-ceo').addEventListener('click', () => setCeoTabActive(true));
  // APG arrow parity for the CEO tab (the office's own handler only knows its five).
  $('tab-ceo').addEventListener('keydown', (event) => {
    const key = (event as KeyboardEvent).key;
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(key)) return;
    event.preventDefault();
    const targetId = key === 'ArrowLeft' || key === 'ArrowUp' || key === 'End' ? 'tab-connections' : 'tab-office';
    const target = $(targetId) as HTMLButtonElement;
    target.focus();
    target.click();
  });
  for (const t of OFFICE_TAB_IDS) {
    $(`tab-${t}`).addEventListener('click', () => window.setTimeout(deactivateCeoIfOfficeTabSelected, 0));
  }
  $('projects-view').querySelector('.office-tabs')?.addEventListener('keydown', () => {
    window.setTimeout(deactivateCeoIfOfficeTabSelected, 0);
  });
}

// ---------------------------------------------------------------- venv + jobs

function initVenvForm(): void {
  $('venv-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const status = $('venv-status');
    if (!bridge) {
      setStatus(status, 'Desktop bridge unavailable.', 'error');
      return;
    }
    const name = ($('venv-name') as HTMLInputElement).value;
    const confirmed = ($('venv-confirm') as HTMLInputElement).checked;
    const installHuggingFaceHub = ($('venv-install-hf') as HTMLInputElement).checked;
    if (!confirmed) {
      setStatus(status, 'Please tick the confirmation box first.', 'error');
      return;
    }
    setStatus(status, 'Creating venv…');
    const res = await bridge.createVenv({ name, confirmed, installHuggingFaceHub });
    if (res.ok) setStatus(status, `Venv ready at ${res.path}`, 'ok');
    else setStatus(status, res.error ?? 'Failed to create venv.', 'error');
    void refreshJobs();
  });
}

async function refreshJobs(): Promise<void> {
  if (!bridge) return;
  const jobs = await bridge.getJobStatus();
  renderJobs(jobs);
}

function renderJobs(jobs: JobRecord[]): void {
  const tbody = $('jobs-table').querySelector('tbody');
  if (!tbody) return;
  tbody.innerHTML = '';
  for (const job of [...jobs].sort((a, b) => b.createdAt.localeCompare(a.createdAt))) {
    const tr = document.createElement('tr');
    const pct = job.progress === null ? '—' : `${Math.round(job.progress * 100)}%`;
    const cells = [
      job.id.slice(0, 8),
      job.kind,
      job.error ? `${job.status}: ${job.error}` : job.status,
      pct,
      job.detail,
    ];
    for (const text of cells) {
      const td = document.createElement('td');
      td.textContent = text;
      tr.append(td);
    }
    const actionTd = document.createElement('td');
    if (job.status === 'running' || job.status === 'pending') {
      const cancelBtn = document.createElement('button');
      cancelBtn.className = 'danger';
      cancelBtn.textContent = 'Cancel';
      cancelBtn.onclick = () => void bridge?.cancelJob(job.id).then(() => refreshJobs());
      actionTd.append(cancelBtn);
    }
    tr.append(actionTd);
    tbody.append(tr);
  }
}

async function refreshSystemPanel(): Promise<void> {
  if (!bridge) return;
  const info = await bridge.getSystemInfo();
  renderSystemInfo(info);
  await refreshCatalog();
  await refreshJobs();
}

// ---------------------------------------------------------------- boot

function boot(): void {
  if (!bridge) {
    document.body.innerHTML =
      '<main class="view"><h1>Desktop bridge unavailable</h1><p>This page must run inside the Research Director Desktop shell.</p></main>';
    return;
  }
  initLauncher();
  initVenvForm();
  initCeoIntegration();
  initMotion();
  $('refresh-sysinfo').addEventListener('click', () => void bridge.getSystemInfo().then(renderSystemInfo));
  $('refresh-catalog').addEventListener('click', () => void refreshCatalog());
  $('refresh-jobs').addEventListener('click', () => void refreshJobs());
  $('back-to-launcher').addEventListener('click', () => void bridge.backToLauncher());
  bridge.onModeChanged((mode, url) => setMode(mode, url));
  bridge.onJobEvent(() => {
    if (!$('system-view').classList.contains('hidden')) void refreshJobs();
  });
}

boot();

export {};
