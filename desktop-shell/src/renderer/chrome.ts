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

function escapeText(s: string): string {
  return s;
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
    void refreshProjectsPanel();
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
    ['CPU', `${escapeText(info.cpuModel)} (${info.logicalCores} logical cores)`],
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
      const ok = window.confirm(
        `Download ${model.repoId} @ ${model.revision} (${formatBytes(model.sizeBytes)}, ${model.files.length} file(s)) from Hugging Face?\n\n` +
          'Files are stored locally under userData/models, size- and hash-verified when published, and never executed by this shell.',
      );
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

// ---------------------------------------------------------------- API keys

const KEY_PROVIDERS: { id: ApiProvider; label: string; hint: string }[] = [
  { id: 'openai', label: 'OpenAI', hint: 'sk-…' },
  { id: 'anthropic', label: 'Anthropic', hint: 'sk-ant-…' },
];

async function refreshKeys(): Promise<void> {
  if (!bridge) return;
  const status = await bridge.getVaultStatus();
  const warning = $('vault-warning');
  warning.classList.toggle('hidden', status.encryptionAvailable);
  if (!status.encryptionAvailable) {
    warning.textContent =
      'OS secure storage is unavailable (no unlocked system keychain). Keys cannot be saved — this shell fails closed. Unlock your keychain (e.g. GNOME Keyring / KWallet) and restart the app.';
  }
  const container = $('key-rows');
  container.innerHTML = '';
  for (const p of KEY_PROVIDERS) {
    const st = status.providers[p.id];
    const row = document.createElement('div');
    row.className = 'row wrap key-row';

    const label = document.createElement('strong');
    label.textContent = p.label;
    row.append(label);

    const badge = document.createElement('span');
    badge.className = `badge ${st.configured && st.readable ? 'ok' : st.configured ? 'fail' : 'unknown'}`;
    badge.textContent = st.configured
      ? st.readable
        ? `configured${st.updatedAt ? ` · ${st.updatedAt.slice(0, 10)}` : ''}`
        : 'stored but unreadable (tampered or keychain changed)'
      : 'not configured';
    row.append(badge);

    const input = document.createElement('input');
    input.type = 'password';
    input.placeholder = `Paste ${p.label} API key (${p.hint})`;
    input.autocomplete = 'off';
    input.disabled = !status.encryptionAvailable;
    row.append(input);

    const setBtn = document.createElement('button');
    setBtn.textContent = 'Save key';
    setBtn.disabled = !status.encryptionAvailable;
    setBtn.onclick = async () => {
      if (!bridge) return;
      const key = input.value;
      // Clear the field immediately: the key must not linger in the DOM.
      input.value = '';
      if (key.trim().length === 0) return;
      const res = await bridge.setApiKey(p.id, key);
      if (!res.ok) setStatus($('proj-status'), res.error ?? 'Failed to save key.', 'error');
      await refreshKeys();
    };
    row.append(setBtn);

    const revokeBtn = document.createElement('button');
    revokeBtn.className = 'danger';
    revokeBtn.textContent = 'Revoke';
    revokeBtn.disabled = !st.configured;
    revokeBtn.onclick = async () => {
      if (!bridge) return;
      if (!window.confirm(`Revoke and permanently delete the stored ${p.label} key from this device?`)) return;
      await bridge.revokeApiKey(p.id);
      await refreshKeys();
    };
    row.append(revokeBtn);

    container.append(row);
  }
}

// ---------------------------------------------------------------- Ollama

async function detectOllamaUi(): Promise<void> {
  if (!bridge) return;
  const status = $('ollama-status');
  setStatus(status, 'Detecting…');
  const res = await bridge.detectOllama();
  const list = $('ollama-models');
  list.innerHTML = '';
  if (!res.available) {
    setStatus(status, res.error ?? 'Ollama unavailable.', 'error');
    return;
  }
  setStatus(status, `Ollama running at ${res.baseUrl} — ${res.models.length} model(s) downloaded.`, 'ok');
  for (const m of res.models) {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'secondary';
    chip.textContent = m.label;
    chip.onclick = () => {
      ($('proj-provider') as HTMLSelectElement).value = 'ollama';
      ($('proj-model') as HTMLInputElement).value = m.id;
    };
    list.append(chip);
  }
}

// ---------------------------------------------------------------- projects

interface SquadDraft {
  role: ProjectNodeRole;
  title: string;
  instructions: string;
  dependsOn: number[];
  maxTokens: number;
  maxMinutes: number;
  maxUsd: number;
}

function standardSquad(): SquadDraft[] {
  return [
    { role: 'director', title: 'Director', instructions: 'Turn the goal into a concrete plan: 3-6 deliverables with acceptance criteria, assigned to the squad roles.', dependsOn: [], maxTokens: 4096, maxMinutes: 5, maxUsd: 0.25 },
    { role: 'research', title: 'Research', instructions: 'Research the goal and the Director plan. Produce organized findings and flag uncertainties.', dependsOn: [0], maxTokens: 8192, maxMinutes: 5, maxUsd: 0.5 },
    { role: 'build', title: 'Build', instructions: 'Using the plan and research, produce the main text deliverable for the goal.', dependsOn: [0, 1], maxTokens: 8192, maxMinutes: 5, maxUsd: 0.5 },
    { role: 'review', title: 'Review', instructions: 'Review the deliverable against the goal. List strengths, gaps, and give a final verdict.', dependsOn: [2], maxTokens: 4096, maxMinutes: 5, maxUsd: 0.25 },
  ];
}

let squadDrafts: SquadDraft[] = standardSquad();
let currentProject: Project | null = null;
let currentRun: ProjectRun | null = null;

function renderSquadEditor(): void {
  const container = $('squad-editor');
  container.innerHTML = '';
  squadDrafts.forEach((draft, i) => {
    const card = document.createElement('div');
    card.className = 'node-card';

    const head = document.createElement('div');
    head.className = 'row wrap';

    const role = document.createElement('select');
    for (const r of ['director', 'research', 'build', 'review', 'custom'] as ProjectNodeRole[]) {
      const opt = document.createElement('option');
      opt.value = r;
      opt.textContent = r;
      role.append(opt);
    }
    role.value = draft.role;
    role.onchange = () => {
      draft.role = role.value as ProjectNodeRole;
    };
    head.append(role);

    const title = document.createElement('input');
    title.type = 'text';
    title.placeholder = 'Title';
    title.value = draft.title;
    title.oninput = () => {
      draft.title = title.value;
    };
    head.append(title);

    const depsLabel = document.createElement('span');
    depsLabel.className = 'muted';
    depsLabel.textContent = 'depends on:';
    head.append(depsLabel);
    squadDrafts.forEach((other, j) => {
      if (j === i) return;
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = draft.dependsOn.includes(j);
      cb.onchange = () => {
        draft.dependsOn = cb.checked ? [...draft.dependsOn, j] : draft.dependsOn.filter((d) => d !== j);
      };
      const lab = document.createElement('label');
      lab.className = 'dep-check';
      lab.append(cb, document.createTextNode(other.title || `node ${j + 1}`));
      head.append(lab);
    });

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'danger';
    removeBtn.textContent = 'Remove';
    removeBtn.onclick = () => {
      squadDrafts = squadDrafts
        .filter((_, j) => j !== i)
        .map((d) => ({ ...d, dependsOn: d.dependsOn.filter((d2) => d2 !== i).map((d2) => (d2 > i ? d2 - 1 : d2)) }));
      renderSquadEditor();
    };
    head.append(removeBtn);
    card.append(head);

    const instructions = document.createElement('textarea');
    instructions.rows = 2;
    instructions.placeholder = 'Instructions for this specialist…';
    instructions.value = draft.instructions;
    instructions.oninput = () => {
      draft.instructions = instructions.value;
    };
    card.append(instructions);

    const budgets = document.createElement('div');
    budgets.className = 'row wrap';
    const addBudget = (labelText: string, value: number, step: number, onChange: (v: number) => void) => {
      const lab = document.createElement('label');
      lab.textContent = labelText;
      const inp = document.createElement('input');
      inp.type = 'number';
      inp.min = '0';
      inp.step = String(step);
      inp.value = String(value);
      inp.oninput = () => onChange(Number(inp.value));
      lab.append(inp);
      budgets.append(lab);
    };
    addBudget('max tokens', draft.maxTokens, 1, (v) => (draft.maxTokens = v));
    addBudget('max minutes', draft.maxMinutes, 0.1, (v) => (draft.maxMinutes = v));
    addBudget('max USD', draft.maxUsd, 0.01, (v) => (draft.maxUsd = v));
    card.append(budgets);

    container.append(card);
  });
}

function initProjectForm(): void {
  $('squad-add').addEventListener('click', () => {
    squadDrafts.push({ role: 'custom', title: `Specialist ${squadDrafts.length + 1}`, instructions: '', dependsOn: [], maxTokens: 4096, maxMinutes: 5, maxUsd: 0.25 });
    renderSquadEditor();
  });
  $('squad-reset').addEventListener('click', () => {
    squadDrafts = standardSquad();
    renderSquadEditor();
  });

  $('proj-list-models').addEventListener('click', async () => {
    if (!bridge) return;
    const status = $('proj-status');
    const provider = ($('proj-provider') as HTMLSelectElement).value as ProjectProvider;
    setStatus(status, 'Listing models (live call)…');
    const res = await bridge.listProviderModels(provider);
    if (!res.ok) {
      setStatus(status, res.error ?? 'Model list failed.', 'error');
      return;
    }
    const select = $('proj-model-select') as HTMLSelectElement;
    select.innerHTML = '';
    select.classList.remove('hidden');
    for (const m of res.models) {
      const opt = document.createElement('option');
      opt.value = m.id;
      opt.textContent = m.label;
      select.append(opt);
    }
    if (res.models.length > 0) {
      ($('proj-model') as HTMLInputElement).value = res.models[0]?.id ?? '';
    }
    setStatus(status, `${res.models.length} model(s) from ${provider}.`, 'ok');
  });

  ($('proj-model-select') as HTMLSelectElement).addEventListener('change', () => {
    const select = $('proj-model-select') as HTMLSelectElement;
    ($('proj-model') as HTMLInputElement).value = select.value;
  });

  $('project-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const status = $('proj-status');
    if (!bridge) {
      setStatus(status, 'Desktop bridge unavailable.', 'error');
      return;
    }
    const req: CreateProjectRequest = {
      name: ($('proj-name') as HTMLInputElement).value,
      goal: ($('proj-goal') as HTMLTextAreaElement).value,
      provider: ($('proj-provider') as HTMLSelectElement).value as ProjectProvider,
      model: ($('proj-model') as HTMLInputElement).value,
      nodes: squadDrafts.map((d) => ({
        role: d.role,
        title: d.title,
        instructions: d.instructions,
        dependsOn: [...d.dependsOn],
        budget: { maxTokens: d.maxTokens, maxMinutes: d.maxMinutes, maxUsd: d.maxUsd },
      })),
    };
    const res = await bridge.createProject(req);
    if (!res.ok || !res.project) {
      setStatus(status, res.error ?? 'Failed to create project.', 'error');
      return;
    }
    setStatus(status, `Project "${res.project.name}" created.`, 'ok');
    ($('proj-name') as HTMLInputElement).value = '';
    ($('proj-goal') as HTMLTextAreaElement).value = '';
    await refreshProjectList();
    selectProject(res.project.id);
  });
}

async function refreshProjectList(): Promise<void> {
  if (!bridge) return;
  const projects = await bridge.listProjects();
  const container = $('project-list');
  container.innerHTML = '';
  if (projects.length === 0) {
    const p = document.createElement('p');
    p.className = 'muted';
    p.textContent = 'No projects yet. Create one above.';
    container.append(p);
    return;
  }
  for (const project of projects) {
    const card = document.createElement('div');
    card.className = 'node-card row space-between';
    const info = document.createElement('div');
    const title = document.createElement('strong');
    title.textContent = project.name;
    const meta = document.createElement('div');
    meta.className = 'meta';
    meta.textContent = `${project.provider} · ${project.model} · ${project.nodes.length} node(s) · ${project.createdAt.slice(0, 10)}`;
    info.append(title, meta);
    const openBtn = document.createElement('button');
    openBtn.className = 'secondary';
    openBtn.textContent = 'Open';
    openBtn.onclick = () => selectProject(project.id);
    card.append(info, openBtn);
    container.append(card);
  }
}

async function selectProject(projectId: string): Promise<void> {
  if (!bridge) return;
  currentProject = await bridge.getProject(projectId);
  if (!currentProject) return;
  $('run-project-name').textContent = `${currentProject.name} (${currentProject.provider} · ${currentProject.model})`;
  const runs = await bridge.listRuns(projectId);
  currentRun = runs[0] ?? null;
  renderRunDetail();
}

function numInput(id: string): number {
  return Number(($(`run-${id}`) as HTMLInputElement).value);
}

async function startRun(): Promise<void> {
  const status = $('run-status');
  if (!bridge || !currentProject) {
    setStatus(status, 'Select a project first.', 'error');
    return;
  }
  const req: StartRunRequest = {
    projectId: currentProject.id,
    runBudget: {
      maxTokens: numInput('max-tokens'),
      maxMinutes: numInput('max-minutes'),
      maxUsd: numInput('max-usd'),
    },
    priceRates: {
      inputUsdPerMillion: Number(($('rate-input') as HTMLInputElement).value),
      outputUsdPerMillion: Number(($('rate-output') as HTMLInputElement).value),
    },
  };
  const res = await bridge.startRun(req);
  if (!res.ok) {
    setStatus(status, res.error ?? 'Failed to start run.', 'error');
    return;
  }
  setStatus(status, `Run ${res.runId} started.`, 'ok');
  await refreshCurrentRun();
}

async function refreshCurrentRun(): Promise<void> {
  if (!bridge || !currentProject) return;
  const runs = await bridge.listRuns(currentProject.id);
  currentRun = runs[0] ?? null;
  renderRunDetail();
}

function runControlsSetEnabled(run: ProjectRun | null): void {
  const active = run !== null && (run.status === 'running' || run.status === 'paused');
  ($('run-start') as HTMLButtonElement).disabled = currentProject === null || active;
  ($('run-pause') as HTMLButtonElement).disabled = !(run !== null && run.status === 'running');
  ($('run-resume') as HTMLButtonElement).disabled = !(run !== null && run.status === 'paused');
  ($('run-cancel') as HTMLButtonElement).disabled = !active;
}

function renderRunDetail(): void {
  const container = $('run-detail');
  container.innerHTML = '';
  $('artifact-view').innerHTML = '';
  runControlsSetEnabled(currentRun);
  if (!currentProject) return;

  const table = document.createElement('table');
  const thead = document.createElement('thead');
  thead.innerHTML = '<tr><th>Node</th><th>Role</th><th>Depends on</th><th>Status</th><th>Tokens</th><th>Cost</th><th></th></tr>';
  table.append(thead);
  const tbody = document.createElement('tbody');
  for (const node of currentProject.nodes) {
    const tr = document.createElement('tr');
    const state = currentRun?.nodeStates[node.id];
    const status = state?.status ?? 'pending';
    const depTitles = node.dependsOn
      .map((d) => currentProject?.nodes.find((n) => n.id === d)?.title ?? d)
      .join(', ');
    for (const text of [node.title, node.role, depTitles || '—']) {
      const td = document.createElement('td');
      td.textContent = text;
      tr.append(td);
    }
    const statusTd = document.createElement('td');
    const badge = document.createElement('span');
    badge.className = `badge ${status === 'succeeded' ? 'ok' : status === 'failed' ? 'fail' : status === 'running' ? 'pass' : 'unknown'}`;
    badge.textContent = state?.error ? `${status}: ${state.error}` : status;
    statusTd.append(badge);
    tr.append(statusTd);

    const tokensTd = document.createElement('td');
    tokensTd.textContent = state ? `${state.usage.inputTokens} in / ${state.usage.outputTokens} out` : '—';
    tr.append(tokensTd);
    const costTd = document.createElement('td');
    costTd.textContent = state ? `$${state.usage.costUsd.toFixed(4)}` : '—';
    tr.append(costTd);

    const artTd = document.createElement('td');
    if (state?.artifactId) {
      const viewBtn = document.createElement('button');
      viewBtn.className = 'secondary';
      viewBtn.textContent = 'Artifact';
      viewBtn.onclick = () => void showArtifact(node.id);
      artTd.append(viewBtn);
    }
    tr.append(artTd);
    tbody.append(tr);
  }
  table.append(tbody);
  container.append(table);

  if (currentRun) {
    const summary = document.createElement('p');
    summary.className = 'meta';
    const term = currentRun.terminationReason ? ` (terminated: ${currentRun.terminationReason})` : '';
    summary.textContent =
      `Run ${currentRun.id.slice(0, 13)}… — ${currentRun.status}${term} · ` +
      `${currentRun.usage.inputTokens + currentRun.usage.outputTokens} tokens · ` +
      `$${currentRun.usage.costUsd.toFixed(4)} · ${Math.round(currentRun.usage.elapsedSeconds)}s`;
    container.prepend(summary);
  }
}

async function showArtifact(nodeId: string): Promise<void> {
  if (!bridge || !currentProject || !currentRun) return;
  const res = await bridge.readArtifact(currentProject.id, currentRun.id, nodeId);
  const container = $('artifact-view');
  container.innerHTML = '';
  if (!res.ok || res.text === undefined || !res.meta) {
    setStatus($('run-status'), res.error ?? 'Artifact unavailable.', 'error');
    return;
  }
  const meta = document.createElement('p');
  meta.className = 'meta';
  meta.textContent =
    `provenance: ${res.meta.provider} · ${res.meta.model} · node ${res.meta.nodeId} · ` +
    `${res.meta.inputTokens} in / ${res.meta.outputTokens} out · $${res.meta.costUsd.toFixed(4)} · ` +
    `sha256 ${res.meta.textSha256.slice(0, 16)}… · ${res.meta.createdAt}`;
  const pre = document.createElement('pre');
  pre.className = 'artifact';
  pre.textContent = res.text;
  container.append(meta, pre);
}

async function refreshProjectsPanel(): Promise<void> {
  await refreshKeys();
  renderSquadEditor();
  await refreshProjectList();
  if (currentProject) await selectProject(currentProject.id);
  else renderRunDetail();
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
  initProjectForm();
  $('refresh-sysinfo').addEventListener('click', () => void bridge.getSystemInfo().then(renderSystemInfo));
  $('refresh-catalog').addEventListener('click', () => void refreshCatalog());
  $('refresh-jobs').addEventListener('click', () => void refreshJobs());
  $('back-to-launcher').addEventListener('click', () => void bridge.backToLauncher());
  $('ollama-detect').addEventListener('click', () => void detectOllamaUi());
  $('projects-refresh').addEventListener('click', () => void refreshProjectsPanel());
  $('run-start').addEventListener('click', () => void startRun());
  $('run-pause').addEventListener('click', () => void (currentRun && bridge.pauseRun(currentRun.id)));
  $('run-resume').addEventListener('click', () => void (currentRun && bridge.resumeRun(currentRun.id)));
  $('run-cancel').addEventListener('click', () => void (currentRun && bridge.cancelRun(currentRun.id)));
  bridge.onModeChanged((mode, url) => setMode(mode, url));
  bridge.onJobEvent(() => {
    if (!$('system-view').classList.contains('hidden')) void refreshJobs();
  });
  bridge.onProjectEvent((run) => {
    if (currentProject && run.projectId === currentProject.id) {
      currentRun = run;
      if (!$('projects-view').classList.contains('hidden')) renderRunDetail();
    }
  });
}

boot();

export {};
