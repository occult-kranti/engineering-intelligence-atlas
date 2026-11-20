/**
 * Shared IPC contract between the Electron main process and the local
 * launcher/chrome renderer. The preload script re-declares the channel
 * strings inline because sandboxed preloads cannot require local modules;
 * tests/contract-sync.test.ts keeps the two copies in sync.
 */

export const BRIDGE_VERSION = 2 as const;

export const CHANNELS = {
  getSystemInfo: 'desktop:get-system-info',
  getModelCatalog: 'desktop:get-model-catalog',
  checkModelRequirements: 'desktop:check-model-requirements',
  createVenv: 'desktop:create-venv',
  downloadModel: 'desktop:download-model',
  getJobStatus: 'desktop:get-job-status',
  cancelJob: 'desktop:cancel-job',
  openOfflineAtlas: 'desktop:open-offline-atlas',
  connectRuntime: 'desktop:connect-runtime',
  backToLauncher: 'desktop:back-to-launcher',
  getSettings: 'desktop:get-settings',
  openExternal: 'desktop:open-external',
  // credential vault (keys enter main only via setApiKey; never returned)
  getVaultStatus: 'desktop:vault:get-status',
  setApiKey: 'desktop:vault:set-key',
  revokeApiKey: 'desktop:vault:revoke-key',
  // providers (model discovery + Ollama detection)
  listProviderModels: 'desktop:provider:list-models',
  detectOllama: 'desktop:ollama:detect',
  // local projects
  listProjects: 'desktop:projects:list',
  createProject: 'desktop:projects:create',
  getProject: 'desktop:projects:get',
  startRun: 'desktop:projects:run-start',
  pauseRun: 'desktop:projects:run-pause',
  resumeRun: 'desktop:projects:run-resume',
  cancelRun: 'desktop:projects:run-cancel',
  listRuns: 'desktop:projects:runs',
  readArtifact: 'desktop:projects:read-artifact',
  // main -> renderer events
  jobEvent: 'desktop:event:job',
  modeChanged: 'desktop:event:mode',
  projectEvent: 'desktop:event:project',
} as const;

export type ChannelName = (typeof CHANNELS)[keyof typeof CHANNELS];

export type ShellMode = 'launcher' | 'content';

export interface GpuInfo {
  name: string;
  /** Bytes of total VRAM reported by the driver, or null when unknown. */
  vramTotalBytes: number | null;
  /** Bytes of free VRAM reported by the driver, or null when unknown. */
  vramFreeBytes: number | null;
  /** How the VRAM figures were obtained. */
  source: 'nvidia-smi' | 'unavailable';
}

export interface SystemInfo {
  cpuModel: string;
  logicalCores: number;
  totalRamBytes: number;
  freeRamBytes: number;
  os: { platform: string; release: string; arch: string };
  disk: { totalBytes: number | null; freeBytes: number | null; path: string };
  gpus: GpuInfo[];
  /**
   * Human-readable note describing measurement gaps, e.g. when no GPU
   * telemetry tool was available and VRAM is therefore unknown.
   */
  notes: string[];
}

export type RequirementStatus = 'pass' | 'fail' | 'unknown' | 'not-required';

export interface RequirementCheck {
  status: RequirementStatus;
  requiredBytes: number | null;
  availableBytes: number | null;
  message: string;
}

export interface RequirementReport {
  modelId: string;
  checks: { ram: RequirementCheck; disk: RequirementCheck; vram: RequirementCheck };
  /** True only when nothing failed. 'unknown' checks are reported, not failed. */
  canDownload: boolean;
  summary: string;
}

export type ModelAvailability =
  /** Reviewed, verified, downloadable with user confirmation. */
  | 'available'
  /** Verified metadata, but not anonymously downloadable (e.g. HF gated repo). */
  | 'unavailable'
  /** Research-only: requires remote/external code (trust_remote_code-style). Download and run are disabled. */
  | 'quarantined';

export interface CatalogFile {
  path: string;
  sizeBytes: number;
  /** LFS SHA-256 published by HF; null when HF masks it (e.g. gated repos). */
  sha256: string | null;
}

export interface CatalogModel {
  id: string;
  family: string;
  task: string;
  name?: string;
  repoId: string;
  revision: string;
  format: string;
  quantization: string | null;
  /** Total bytes of the reviewed file set; must equal the sum of files[]. */
  sizeBytes: number;
  sizeScope?: string;
  /** Exact reviewed file set; required and non-empty for 'available' models. */
  files: CatalogFile[];
  /** Null means "not declared / not derivable" — reported as unknown, never as zero. */
  minRamBytes: number | null;
  minVramBytes: number | null;
  license: string;
  licenseUrl?: string;
  sourceUrl: string;
  runtime: string;
  remoteCodeRequired: boolean;
  availability: ModelAvailability;
  /** Required whenever availability is not 'available'. */
  availabilityNote?: string;
  notes?: string;
}

export interface CatalogResult {
  models: CatalogModel[];
  /** Entries that failed validation and were excluded, with reasons. */
  rejected: { id: string; errors: string[] }[];
  catalogPath: string;
}

export type JobKind = 'download-model' | 'create-venv';
export type JobStatus = 'pending' | 'running' | 'succeeded' | 'failed' | 'cancelled';

export interface JobRecord {
  id: string;
  kind: JobKind;
  status: JobStatus;
  /** 0..1 progress fraction, or null when indeterminate. */
  progress: number | null;
  detail: string;
  error: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateVenvRequest {
  name: string;
  /** Must be true; the renderer must collect an explicit user confirmation. */
  confirmed: boolean;
  /** Optionally install the pinned huggingface_hub package into the new venv. */
  installHuggingFaceHub?: boolean;
}

export interface CreateVenvResult {
  ok: boolean;
  path?: string;
  pythonPath?: string;
  jobId?: string;
  error?: string;
}

export interface DownloadModelRequest {
  modelId: string;
  /** Must be true; the renderer must collect an explicit user confirmation. */
  confirmed: boolean;
}

export interface ConnectRuntimeResult {
  ok: boolean;
  url?: string;
  error?: string;
}

export interface DesktopSettings {
  /** The only persisted field: a non-secret runtime URL, or null. */
  runtimeUrl: string | null;
}

// ---------------------------------------------------------------------------
// Credential vault (v2)
// ---------------------------------------------------------------------------

export type ApiProvider = 'openai' | 'anthropic';

/** Metadata only. Key material is NEVER exposed over IPC — not even a last4. */
export interface ProviderCredentialStatus {
  configured: boolean;
  /** False when a stored blob exists but cannot be decrypted (tamper / OS keychain change). */
  readable: boolean;
  updatedAt: string | null;
}

export interface VaultStatus {
  /** False when OS safeStorage encryption is unavailable; set-key then fails closed. */
  encryptionAvailable: boolean;
  providers: Record<ApiProvider, ProviderCredentialStatus>;
}

export interface ModelInfo {
  id: string;
  label: string;
}

export interface ListModelsResult {
  ok: boolean;
  models: ModelInfo[];
  error?: string;
}

export interface OllamaStatus {
  available: boolean;
  /** Always a loopback URL (http://127.0.0.1:11434 by default). */
  baseUrl: string;
  models: ModelInfo[];
  error: string | null;
}

// ---------------------------------------------------------------------------
// Local projects (v2)
// ---------------------------------------------------------------------------

export type ProjectProvider = ApiProvider | 'ollama';
export type ProjectNodeRole = 'director' | 'research' | 'build' | 'review' | 'custom';
export type NodeStatus = 'pending' | 'running' | 'succeeded' | 'failed' | 'skipped';

export interface BudgetLimits {
  /** Hard cap on tokens (input + output). Must be a positive finite number. */
  maxTokens: number;
  /** Hard cap on wall-clock minutes. */
  maxMinutes: number;
  /** Hard cap on spend in USD, computed with user-provided price rates. */
  maxUsd: number;
}

/** User-provided price rates; the shell ships no pricing data. */
export interface PriceRates {
  inputUsdPerMillion: number;
  outputUsdPerMillion: number;
}

export interface ProjectNode {
  id: string;
  role: ProjectNodeRole;
  title: string;
  instructions: string;
  dependsOn: string[];
  status: NodeStatus;
  budget: BudgetLimits;
}

export interface Project {
  id: string;
  name: string;
  goal: string;
  provider: ProjectProvider;
  model: string;
  nodes: ProjectNode[];
  createdAt: string;
  updatedAt: string;
}

export interface ProjectNodeDraft {
  role: ProjectNodeRole;
  title: string;
  instructions: string;
  /** Dependencies as draft indices (numbers) or explicit node ids (strings). */
  dependsOn: Array<number | string>;
  budget?: Partial<BudgetLimits>;
}

export interface CreateProjectRequest {
  name: string;
  goal: string;
  provider: ProjectProvider;
  model: string;
  /** When omitted, a standard Director → Research → Build → Review squad is generated. */
  nodes?: ProjectNodeDraft[];
}

export interface StartRunRequest {
  projectId: string;
  runBudget: BudgetLimits;
  priceRates: PriceRates;
}

export type RunStatus = 'running' | 'paused' | 'completed' | 'failed' | 'cancelled' | 'terminated';
export type TerminationReason = 'max-tokens' | 'max-minutes' | 'max-usd' | null;

export interface UsageTotals {
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

export interface RunNodeState {
  status: NodeStatus;
  usage: UsageTotals;
  artifactId: string | null;
  error: string | null;
  startedAt: string | null;
  finishedAt: string | null;
}

export interface ProjectRun {
  id: string;
  projectId: string;
  status: RunStatus;
  terminationReason: TerminationReason;
  error: string | null;
  runBudget: BudgetLimits;
  priceRates: PriceRates;
  usage: UsageTotals & { elapsedSeconds: number };
  nodeStates: Record<string, RunNodeState>;
  createdAt: string;
  updatedAt: string;
  finishedAt: string | null;
}

/** Provenance for a persisted artifact. Never contains credentials. */
export interface ArtifactMeta {
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

/** The versioned bridge exposed to local file:// launcher content only. */
export interface DesktopBridge {
  version: typeof BRIDGE_VERSION;
  getSystemInfo(): Promise<SystemInfo>;
  getModelCatalog(): Promise<CatalogResult>;
  checkModelRequirements(modelId: string): Promise<RequirementReport>;
  createVenv(req: CreateVenvRequest): Promise<CreateVenvResult>;
  downloadModel(req: DownloadModelRequest): Promise<{ ok: boolean; jobId?: string; error?: string }>;
  getJobStatus(jobId?: string): Promise<JobRecord[]>;
  cancelJob(jobId: string): Promise<{ ok: boolean; error?: string }>;
  openOfflineAtlas(): Promise<{ ok: boolean; error?: string }>;
  connectRuntime(url: string): Promise<ConnectRuntimeResult>;
  backToLauncher(): Promise<{ ok: boolean }>;
  getSettings(): Promise<DesktopSettings>;
  openExternal(url: string): Promise<{ ok: boolean; error?: string }>;
  // credential vault: key material flows renderer -> main ONLY, via setApiKey.
  getVaultStatus(): Promise<VaultStatus>;
  setApiKey(provider: ApiProvider, key: string): Promise<{ ok: boolean; error?: string }>;
  revokeApiKey(provider: ApiProvider): Promise<{ ok: boolean; error?: string }>;
  listProviderModels(provider: ProjectProvider): Promise<ListModelsResult>;
  detectOllama(): Promise<OllamaStatus>;
  // local projects
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
  onModeChanged(listener: (mode: ShellMode) => void): () => void;
  onProjectEvent(listener: (run: ProjectRun) => void): () => void;
}
