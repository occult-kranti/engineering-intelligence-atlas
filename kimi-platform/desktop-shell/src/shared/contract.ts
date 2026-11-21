/**
 * Shared IPC contract between the Electron main process and the local
 * launcher/chrome renderer. The preload script re-declares the channel
 * strings inline because sandboxed preloads cannot require local modules;
 * tests/contract-sync.test.ts keeps the two copies in sync.
 */

export const BRIDGE_VERSION = 6 as const;

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
  // v3: skills, hiring, office, approvals, events, recovery
  listSkills: 'desktop:skills:list',
  hirePreview: 'desktop:projects:hire-preview',
  applyHires: 'desktop:projects:hire-apply',
  updateOfficeProject: 'desktop:projects:update-office',
  reassignNode: 'desktop:projects:reassign',
  getOfficeSnapshot: 'desktop:projects:office-snapshot',
  decideApproval: 'desktop:projects:approval-decide',
  listApprovals: 'desktop:projects:approvals',
  readRunEvents: 'desktop:projects:run-events',
  recoverRun: 'desktop:projects:run-recover',
  // v4: provider-backed Director chat (persistent, local, no secrets)
  chatCreateSession: 'desktop:chat:create',
  chatListSessions: 'desktop:chat:list',
  chatGetSession: 'desktop:chat:get',
  chatSendMessage: 'desktop:chat:send',
  chatStop: 'desktop:chat:stop',
  chatDeleteSession: 'desktop:chat:delete',
  // v4: authenticated loopback VS Code companion bridge (default disabled)
  companionStatus: 'desktop:companion:status',
  companionEnable: 'desktop:companion:enable',
  companionDisable: 'desktop:companion:disable',
  companionRegenerateToken: 'desktop:companion:regenerate-token',
  // main -> renderer events
  // v5: CEO mode (enterprises)
  entList: 'desktop:ent:list',
  entGet: 'desktop:ent:get',
  entCreate: 'desktop:ent:create',
  entUpdate: 'desktop:ent:update',
  entBlueprintPreview: 'desktop:ent:blueprint-preview',
  entBlueprintApply: 'desktop:ent:blueprint-apply',
  entApprovalDecide: 'desktop:ent:approval-decide',
  entContracts: 'desktop:ent:contracts',
  entContractPropose: 'desktop:ent:contract-propose',
  entContractDecide: 'desktop:ent:contract-decide',
  entContractRelease: 'desktop:ent:contract-release',
  entMemory: 'desktop:ent:memory',
  entMemoryPromote: 'desktop:ent:memory-promote',
  entMemoryRevoke: 'desktop:ent:memory-revoke',
  entMemorySearch: 'desktop:ent:memory-search',
  entProgramStart: 'desktop:ent:program-start',
  entProgramPause: 'desktop:ent:program-pause',
  entProgramResume: 'desktop:ent:program-resume',
  entProgramCancel: 'desktop:ent:program-cancel',
  entProgramGet: 'desktop:ent:program-get',
  entProgramPump: 'desktop:ent:program-pump',
  entSnapshot: 'desktop:ent:snapshot',
  entLedger: 'desktop:ent:ledger',
  entTimeline: 'desktop:ent:timeline',
  entEvents: 'desktop:ent:events',
  entWorkerUpdate: 'desktop:ent:worker-update',
  entExport: 'desktop:ent:export',
  entStewards: 'desktop:ent:stewards',
  // v6: Donna / shared assistants (propose -> decide -> execute pipeline,
  // queues, schedules, study, repositories, knowledge, cache, Donna chat).
  // Emergency stop is deliberately ABSENT: it stays on the ungated
  // entProgramCancel / cancelRun / chatStop channels.
  astDefinitions: 'desktop:ast:definitions',
  astGet: 'desktop:ast:get',
  astPropose: 'desktop:ast:propose',
  astDecide: 'desktop:ast:decide',
  astExecute: 'desktop:ast:execute',
  astCancel: 'desktop:ast:cancel',
  astQueueAdd: 'desktop:ast:queue-add',
  astQueueReorder: 'desktop:ast:queue-reorder',
  astWorkerAction: 'desktop:ast:worker-action',
  astLifecycleSet: 'desktop:ast:lifecycle-set',
  astJobUpsert: 'desktop:ast:job-upsert',
  astJobPause: 'desktop:ast:job-pause',
  astJobResume: 'desktop:ast:job-resume',
  astJobDelete: 'desktop:ast:job-delete',
  astJobRunNow: 'desktop:ast:job-run-now',
  astStudyEnqueue: 'desktop:ast:study-enqueue',
  astStudyList: 'desktop:ast:study-list',
  astRepoPreview: 'desktop:ast:repo-preview',
  astRepoFetch: 'desktop:ast:repo-fetch',
  astRepoApply: 'desktop:ast:repo-apply',
  astKnowledgeList: 'desktop:ast:knowledge-list',
  astKnowledgeExport: 'desktop:ast:knowledge-export',
  astCacheInvalidate: 'desktop:ast:cache-invalidate',
  astCacheStatus: 'desktop:ast:cache-status',
  astEvents: 'desktop:ast:events',
  astDonnaPrompt: 'desktop:ast:donna-prompt',
  astDonnaParse: 'desktop:ast:donna-parse',

  jobEvent: 'desktop:event:job',
  modeChanged: 'desktop:event:mode',
  projectEvent: 'desktop:event:project',
  enterpriseEvent: 'desktop:event:enterprise',
  assistantEvent: 'desktop:event:assistant',
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

// ---------------------------------------------------------------------------
// v3: hierarchy, office template, loops
// ---------------------------------------------------------------------------

export type ProjectTemplate = 'standard' | 'office';
export type NodeKind = 'director' | 'subdirector' | 'worker';
export type NodeDepth = 0 | 1 | 2;

/** Bounded review→revise loop policy. maxIterations counts total attempts. */
export interface LoopPolicy {
  /** Total attempts of the loop body, 1..5 (1 = no looping). */
  maxIterations: number;
  /** Stop after this many consecutive revision rounds with no artifact change, 1..5. */
  noProgressLimit: number;
}

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
  // v3 (all optional; absent on legacy standard projects):
  /** Hierarchy kind: director (root) / subdirector / worker. */
  kind?: NodeKind;
  /** Parent node id in the hierarchy, null for the root. */
  parentId?: string | null;
  /** Hierarchy depth 0|1|2 (MAX_DEPTH = 2). */
  depth?: NodeDepth;
  /** Office room assignment (reassignment metadata), canonical room id. */
  roomId?: string | null;
  /** Bundled skill id attached to this node, or null. */
  skillRef?: string | null;
  /** When true, the run waits for an explicit approval before executing this node. */
  approvalBefore?: boolean;
}

/** Persisted office layout metadata (rooms themselves are DERIVED projections). */
export interface OfficeLayoutMeta {
  /** Canonical room ids in display order. */
  roomOrder?: string[];
  /** Optional custom labels per canonical room id. */
  roomLabels?: Record<string, string>;
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
  /** Optimistic-concurrency version; incremented on every validated update. */
  version: number;
  /** Defaults to 'standard' for legacy projects. */
  template?: ProjectTemplate;
  /** Optional goal success criteria (bounded list of short strings). */
  successCriteria?: string[];
  /** Bounded review→revise loop policy; null/absent = legacy single pass. */
  loopPolicy?: LoopPolicy | null;
  /** Office layout metadata only; membership/status are derived. */
  office?: OfficeLayoutMeta;
}

export interface ProjectNodeDraft {
  role: ProjectNodeRole;
  title: string;
  instructions: string;
  /** Dependencies as draft indices (numbers) or explicit node ids (strings). */
  dependsOn: Array<number | string>;
  budget?: Partial<BudgetLimits>;
  // v3 optional hierarchy fields; parentId uses the same index-or-id scheme as dependsOn.
  kind?: NodeKind;
  parentId?: number | string | null;
  depth?: NodeDepth;
  roomId?: string | null;
  skillRef?: string | null;
  approvalBefore?: boolean;
}

export interface CreateProjectRequest {
  name: string;
  goal: string;
  provider: ProjectProvider;
  model: string;
  /** When omitted, a standard Director → Research → Build → Review squad is generated. */
  nodes?: ProjectNodeDraft[];
  /** 'office' generates the Director → Sub-Directors → skill-backed workers hierarchy. */
  template?: ProjectTemplate;
  successCriteria?: string[];
  loopPolicy?: LoopPolicy | null;
}

export interface StartRunRequest {
  projectId: string;
  runBudget: BudgetLimits;
  priceRates: PriceRates;
}

export type RunStatus =
  | 'running'
  | 'paused'
  | 'waiting-approval'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'terminated'
  /** The process died (or was closed) while this run was active; recoverable via recoverRun. */
  | 'interrupted';
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
  /** Number of attempts so far (1 = first execution). */
  attempt?: number;
  /** All attempt artifact ids, oldest first; earlier attempts are never overwritten. */
  artifactIds?: string[];
  /** SHA-256 of the latest artifact text (used for loop no-progress detection). */
  lastArtifactSha256?: string | null;
}

/** Per review-node bounded loop state persisted on the run. */
export interface LoopState {
  /** Number of revision requeues so far (0 = still on the first attempt). */
  iterations: number;
  /** Consecutive revision rounds where every target artifact hash was unchanged. */
  noProgress: number;
  /** Target node id -> artifact hash captured at the last revision decision. */
  targetHashes: Record<string, string>;
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
  /** Bounded review→revise loop state, keyed by review node id. */
  loops?: Record<string, LoopState>;
  createdAt: string;
  updatedAt: string;
  finishedAt: string | null;
}

/** A persisted run-log event (whitelisted fields only — never secrets). */
export interface RunEventRecord {
  ts: string;
  runId: string;
  event: string;
  nodeId?: string;
  status?: string;
  detail?: string;
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

// ---------------------------------------------------------------------------
// v3: skills catalog
// ---------------------------------------------------------------------------

/** Public metadata for one bundled atlas skill. Body content never crosses IPC. */
export interface SkillSummary {
  id: string;
  name: string;
  description: string;
  /** Canonical office room id this skill belongs to (research/engineering/design/…). */
  role: string;
  keywords: string[];
  /** SHA-256 of the SKILL.md body at catalog build time. */
  sha256: string;
  /** Body path relative to the bundled skills root. */
  path: string;
  /** True when the on-disk body still matches sha256 (re-verified at load). */
  verified: boolean;
}

// ---------------------------------------------------------------------------
// v3: hiring (deterministic goal→skill matching + persisted approvals)
// ---------------------------------------------------------------------------

export interface HireAssignment {
  nodeId: string;
  nodeTitle: string;
  skillId: string;
  skillName: string;
  skillSha256: string;
  matchedKeywords: string[];
  score: number;
}

export interface HirePlanPreview {
  projectId: string;
  projectVersion: number;
  assignments: HireAssignment[];
  /** SHA-256 of the canonical assignment payload; decideApproval must present it. */
  planHash: string;
}

export interface ApplyHiresRequest {
  projectId: string;
  /** OCC: must equal the project's current version. */
  expectedVersion: number;
  assignments: Array<{ nodeId: string; skillId: string }>;
  /** Must be true; the renderer must collect an explicit user confirmation. */
  confirmed: boolean;
}

// ---------------------------------------------------------------------------
// v3: persisted keyed approvals
// ---------------------------------------------------------------------------

export type ApprovalKind = 'hire' | 'node';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

export interface ApprovalRecord {
  /** Deterministic key: same kind+scope+payload hash always maps to this id. */
  id: string;
  kind: ApprovalKind;
  projectId: string;
  /** Null for design-time hire approvals. */
  runId: string | null;
  nodeId: string | null;
  /** SHA-256 of the canonical payload; decisions must present the exact hash. */
  payloadHash: string;
  /** Non-secret payload (node titles, skill ids, hashes — never credentials). */
  payload: unknown;
  status: ApprovalStatus;
  createdAt: string;
  decidedAt: string | null;
}

export interface DecideApprovalRequest {
  projectId: string;
  /** Required for run-scoped ('node') approvals; omit for design-time hires. */
  runId?: string | null;
  approvalId: string;
  decision: 'approved' | 'rejected';
  /** Must equal the record's payloadHash — approves exactly the reviewed payload. */
  payloadHash: string;
}

// ---------------------------------------------------------------------------
// v3: office projection + updates
// ---------------------------------------------------------------------------

export interface OfficeRoomMember {
  nodeId: string;
  title: string;
  kind: NodeKind | null;
  role: ProjectNodeRole;
  depth: NodeDepth | null;
  parentId: string | null;
  roomId: string;
  skillRef: string | null;
  /** Live status from the active/selected run, else the node's design-time status. */
  status: NodeStatus;
}

export interface OfficeRoom {
  id: string;
  label: string;
  order: number;
  members: OfficeRoomMember[];
}

export interface OfficeSnapshot {
  projectId: string;
  version: number;
  template: ProjectTemplate;
  runId: string | null;
  rooms: OfficeRoom[];
  /** Parity invariant: nodeCount === sum of room member counts. */
  nodeCount: number;
}

export interface UpdateOfficeProjectRequest {
  projectId: string;
  expectedVersion: number;
  name?: string;
  goal?: string;
  successCriteria?: string[];
  loopPolicy?: LoopPolicy | null;
  office?: OfficeLayoutMeta;
}

export interface ReassignNodeRequest {
  projectId: string;
  nodeId: string;
  expectedVersion: number;
  /** New canonical room id, or null to reset to the derived default. */
  roomId?: string | null;
  /** New parent node id (office template only), validated depth/cycle-safe. */
  parentId?: string | null;
}

// ---------------------------------------------------------------------------
// v4: provider-backed Director chat
// ---------------------------------------------------------------------------

export type ChatMessageStatus = 'completed' | 'pending' | 'error' | 'cancelled';

export interface ChatUsage {
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

/** Provenance for one assistant message. Never contains credentials. */
export interface ChatProvenance {
  provider: ProjectProvider;
  model: string;
  /** Bundled skill ids whose verified SKILL.md excerpts were included. */
  skillIds: string[];
  /** skill id -> catalog sha256 (integrity-proven excerpts only). */
  skillSha256: Record<string, string>;
  promptSha256: string;
  textSha256: string;
}

/**
 * Data-only suggested next step. Renderers/companions MAY present these as
 * buttons; they are never remote commands and carry no executable payload.
 */
export interface ChatAction {
  kind: 'create-project' | 'open-roadmap';
  label: string;
  /** Present only for 'open-roadmap'. */
  projectId?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  status: ChatMessageStatus;
  /** Untrusted display text; renderers must treat it as data, never as code. */
  text: string;
  error: string | null;
  usage: ChatUsage | null;
  provenance: ChatProvenance | null;
  /** Data-only suggestions; always empty for v4 model output. */
  actions: ChatAction[];
  createdAt: string;
  finishedAt: string | null;
}

export interface ChatSession {
  id: string;
  title: string;
  /**
   * v6: 'donna' sessions use the buildDonnaPrompt system prompt (advisory
   * CEO assistant; proposals-only output contract). Absent = 'director'.
   */
  mode?: 'director' | 'donna';
  /** Optional linked project; context is included read-only in prompts. */
  projectId: string | null;
  provider: ProjectProvider;
  model: string;
  /** Selected bundled skill ids (integrity-verified before use). */
  skillIds: string[];
  priceRates: PriceRates;
  /** Hard per-session ceilings (tokens / generation minutes / USD). */
  budget: BudgetLimits;
  /** Cumulative usage across completed assistant messages. */
  usage: ChatUsage & { elapsedSeconds: number };
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
}

/** Session metadata without the (potentially large) message list. */
export type ChatSessionSummary = Omit<ChatSession, 'messages'> & { messageCount: number };

export interface CreateChatSessionRequest {
  title?: string;
  /** v6: defaults to 'director'; 'donna' uses the Donna advisory system prompt. */
  mode?: 'director' | 'donna';
  projectId?: string | null;
  provider: ProjectProvider;
  model: string;
  /** Defaults to the bundled Director pair; every id must be a verified skill. */
  skillIds?: string[];
  priceRates: PriceRates;
  budget?: Partial<BudgetLimits>;
}

export interface SendChatMessageRequest {
  sessionId: string;
  text: string;
  /** Must be true; the caller must collect an explicit user confirmation. */
  confirmed: boolean;
}

/** sendMessage is fire-and-poll: it returns after persisting the pending state. */
export interface SendChatMessageResult {
  ok: boolean;
  userMessageId?: string;
  assistantMessageId?: string;
  error?: string;
}

// ---------------------------------------------------------------------------
// v4: authenticated loopback companion bridge (VS Code extension)
// ---------------------------------------------------------------------------

export interface CompanionStatus {
  /** Persisted non-secret setting; false by default. */
  enabled: boolean;
  /** True when the HTTP listener is actually bound on 127.0.0.1. */
  running: boolean;
  /** Bound loopback port, or null when not running. */
  port: number | null;
  /** False => pairing tokens cannot be stored; enable fails closed. */
  encryptionAvailable: boolean;
  /** True when an encrypted pairing token exists (never the token itself). */
  paired: boolean;
  /** First 12 hex chars of the token's SHA-256 (fingerprint only), or null. */
  tokenFingerprint: string | null;
  /** ISO timestamp of the last pairing/rotation, or null. Never the token. */
  tokenUpdatedAt: string | null;
}

export interface CompanionEnableResult {
  ok: boolean;
  /** High-entropy pairing token, returned exactly ONCE here. Never persisted in plaintext. */
  token?: string;
  port?: number;
  error?: string;
}

// ---------------------------------------------------------------------------
// v5: CEO mode (enterprise) DTOs. Structural mirrors of the main-process
// EnterpriseStore records; nested domain objects reuse shared/enterprise.ts.
// ---------------------------------------------------------------------------

export interface EnterpriseSummaryDto {
  id: string;
  programId: string;
  name: string;
  state: 'draft' | 'materialized';
  version: number;
  blueprintHash: string | null;
  programState: string | null;
  programPaused: boolean;
  companyCount: number;
  departmentCount: number;
  contractCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface EnterpriseApprovalDto {
  id: string;
  kind: string;
  blueprintHash: string;
  payloadHash: string;
  payload: unknown;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  decidedAt: string | null;
}

export interface EnterpriseSeatLeaseDto {
  runId: string;
  fence: number;
  acquiredAt: string;
  expiresAt: string;
  ttlMs: number;
  status: 'active' | 'draining' | 'released';
}

export interface EnterpriseContractRuntimeDto {
  status: string;
  staffed: boolean;
  skillId: string;
  capacityShare: number;
  version: number;
  fenceCounter: number;
  lease: EnterpriseSeatLeaseDto | null;
}

export interface EnterpriseContractDto extends EnterpriseContractRuntimeDto {
  key: string;
  companyKey: string;
  departmentKey: string;
  discipline: string;
}

export interface EnterpriseMemoryDto {
  entry: import('./enterprise').MemoryEntry;
  status: 'promoted' | 'revoked';
  promotedAt: string;
  revokedAt: string | null;
}

export interface EnterpriseRecordDto {
  contractVersion: string;
  id: string;
  programId: string;
  preset: string;
  name: string;
  mission: string;
  provider: ProjectProvider;
  model: string;
  priceRates: PriceRates;
  version: number;
  state: 'draft' | 'materialized';
  blueprint: import('./enterprise').EnterpriseBlueprint | null;
  blueprintHash: string | null;
  program: import('./enterprise').EnterpriseProgram | null;
  programPaused: boolean;
  companies: Record<string, { projectId: string; createdAt: string }>;
  departments: Record<string, { projectId: string; nodeId: string }>;
  contractWorkers: Record<string, { projectId: string; nodeId: string }>;
  contracts: Record<string, EnterpriseContractRuntimeDto>;
  approvals: EnterpriseApprovalDto[];
  memory: EnterpriseMemoryDto[];
  workerOverrides: Record<string, { instructions?: string; budget?: Partial<BudgetLimits> }>;
  ledgerKeys: string[];
  ledgerSeq: number;
  eventSeq: number;
  createdAt: string;
  updatedAt: string;
}

export interface EnterpriseSnapshotDto {
  record: EnterpriseRecordDto;
  view: import('./enterprise').EnterpriseView | null;
  stewards: import('./enterprise').StewardRecommendation[];
}

export interface CreateEnterpriseRequest {
  preset: string;
  programId: string;
  name: string;
  mission: string;
  budget: import('./enterprise').EnterpriseBudget;
  maxReplans?: number;
  maxConcurrentRuns?: number;
  provider: ProjectProvider;
  model: string;
  priceRates?: PriceRates;
}

export interface UpdateEnterpriseRequest {
  id: string;
  expectedVersion: number;
  name?: string;
  mission?: string;
}

export interface EnterpriseBlueprintPreviewRequest {
  enterpriseId: string;
  expectedVersion: number;
  availableSkillIds?: string[];
}

export interface EnterpriseBlueprintPreviewDto {
  blueprint: import('./enterprise').EnterpriseBlueprint;
  blueprintHash: string;
  payload: unknown;
  payloadHash: string;
  expectedVersion: number;
  approval: EnterpriseApprovalDto;
}

export interface EnterpriseBlueprintApplyRequest {
  enterpriseId: string;
  blueprintHash: string;
  payloadHash: string;
  expectedVersion: number;
  confirmed: boolean;
}

export interface EnterpriseApprovalDecideRequest {
  enterpriseId: string;
  approvalId: string;
  decision: 'approved' | 'rejected';
  payloadHash: string;
}

export interface EnterpriseContractProposeRequest {
  enterpriseId: string;
  key: string;
  companyKey: string;
  departmentKey: string;
  discipline: string;
  capacityShare: number;
  skillId: string;
  expectedVersion: number;
}

export interface EnterpriseContractDecideRequest {
  enterpriseId: string;
  contractKey: string;
  decision: 'approved' | 'rejected';
  expectedVersion: number;
}

export interface EnterpriseContractReleaseRequest {
  enterpriseId: string;
  contractKey: string;
  expectedVersion: number;
}

export interface EnterpriseMemoryPromoteRequest {
  enterpriseId: string;
  artifact: import('./enterprise').ArtifactRef;
  scope: string;
  scopeKey: string;
  expectedVersion: number;
}

export interface EnterpriseMemoryRevokeRequest {
  enterpriseId: string;
  scope: string;
  scopeKey: string;
  artifactId: string;
  expectedVersion: number;
}

export interface EnterpriseLedgerRequest {
  enterpriseId: string;
  companyKey?: string;
  workerId?: string;
  departmentKey?: string;
}

export interface EnterprisePagedRequest {
  enterpriseId: string;
  afterIndex?: number;
  limit?: number;
}

export interface EnterpriseWorkerUpdateRequest {
  enterpriseId: string;
  expectedVersion: number;
  op: 'reassign' | 'capacity' | 'suspend' | 'resume' | 'edit';
  companyKey?: string;
  workerId?: string;
  roomId?: string | null;
  parentId?: string | null;
  contractKey?: string;
  capacityShare?: number;
  instructions?: string;
  budget?: Partial<BudgetLimits>;
}

export interface EnterpriseEventDto {
  seq: number;
  ts: string;
  event: string;
  detail?: string;
}

// ---------------------------------------------------------------------------
// v6: Donna / shared assistants. DTOs mirror the main-process AssistantStore;
// domain objects reuse shared/assistant.ts (byte-identical with the web
// contract). No secrets, no artifact bodies, no chain-of-thought ever cross
// IPC. Emergency stop is intentionally NOT an assistant action or channel.
// ---------------------------------------------------------------------------

export interface AssistantDefinitionsDto {
  definitions: import('./assistant').AssistantDefinition[];
  gates: readonly import('./assistant').AssistantGate[];
  actions: Record<import('./assistant').AssistantAction, import('./assistant').AssistantActionPolicy>;
}

export interface AssistantRepositoryDto {
  metadata: import('./assistant').RepositoryMetadata;
  plan: import('./assistant').RepoAssignmentPlan;
  intakeMode: import('./assistant').GithubIntakeMode;
  appliedAt: number | null;
  appliedBy: string | null;
}

export interface AssistantQueueDto {
  queue: import('./assistant').AssistantWorkQueue;
  items: import('./assistant').AssistantQueueItem[];
}

/** Full assistant read model for one enterprise (assistant/state.json). */
export interface AssistantStateDto {
  enterpriseId: string;
  /** OCC token for assistant-local mutations. */
  version: number;
  eventSeq: number;
  proposals: import('./assistant').AssistantActionProposal[];
  queues: AssistantQueueDto[];
  jobs: import('./assistant').AssistantJob[];
  studyItems: import('./assistant').StudyQueueItem[];
  repositories: AssistantRepositoryDto[];
  transfers: import('./assistant').KnowledgeTransferRecord[];
  lifecycle: {
    companies: Record<string, import('./assistant').CompanyLifecycleStatus>;
    departments: Record<string, import('./assistant').DepartmentLifecycleStatus>;
  };
}

export interface AssistantEventDto {
  seq: number;
  ts: string;
  event: string;
  detail?: string;
}

/** main -> renderer push: assistant state changed; refetch astGet. */
export interface AssistantEventPushDto {
  enterpriseId: string;
  version: number;
  eventSeq: number;
  event: string;
  detail?: string;
}

export interface AssistantProposeRequest {
  enterpriseId: string;
  scope: import('./assistant').AssistantScope;
  actor: import('./assistant').AssistantDefinitionId;
  action: import('./assistant').AssistantAction;
  payload: Record<string, unknown>;
}

export interface AssistantDecideRequest {
  enterpriseId: string;
  proposalId: string;
  decision: 'approved' | 'rejected';
  /** Explicitly confirmed gates; every policy-required gate must be present. */
  confirmedGates?: import('./assistant').AssistantGate[];
}

export interface AssistantIdRequest {
  enterpriseId: string;
  proposalId: string;
}

export interface AssistantQueueAddRequest {
  enterpriseId: string;
  scope: import('./assistant').AssistantScope;
  scopeKey: string;
  queueId?: string;
  item: {
    id?: string;
    itemKind: import('./assistant').AssistantQueueItemKind;
    refId: string;
    title?: string;
    payload?: Record<string, unknown>;
  };
  /** OCC: assistant state version (from astGet). */
  expectedVersion: number;
}

export interface AssistantQueueReorderRequest {
  enterpriseId: string;
  queueId: string;
  orderedIds: string[];
  expectedVersion: number;
}

export type AssistantWorkerActionKind = 'worker.hire' | 'worker.pause' | 'worker.resume' | 'worker.fire';

export interface AssistantWorkerActionRequest {
  enterpriseId: string;
  action: AssistantWorkerActionKind;
  /** hire: {contractKey,companyKey,departmentKey,discipline,capacityShare,skillId}; others: {contractKey}. fire adds drain+preserveArtifacts:true. */
  payload: Record<string, unknown>;
  /** OCC: enterprise record version. */
  expectedVersion: number;
  confirmed: boolean;
  confirmedGates?: import('./assistant').AssistantGate[];
}

export interface AssistantLifecycleSetRequest {
  enterpriseId: string;
  target: 'company' | 'department';
  key: string;
  status: 'active' | 'paused' | 'archived';
  /** OCC: enterprise record version. */
  expectedVersion: number;
  confirmed: boolean;
  confirmedGates?: import('./assistant').AssistantGate[];
}

export interface AssistantJobUpsertRequest {
  enterpriseId: string;
  job: {
    id: string;
    scope: import('./assistant').AssistantScope;
    kind: import('./assistant').AssistantJobKind;
    schedule: import('./assistant').AssistantJobSchedule;
    enabled?: boolean;
    maxRuns?: number | null;
  };
  /** OCC: assistant state version. */
  expectedVersion: number;
  confirmed: boolean;
  confirmedGates?: import('./assistant').AssistantGate[];
}

export interface AssistantJobMutationRequest {
  enterpriseId: string;
  jobId: string;
  /** OCC: assistant state version. */
  expectedVersion: number;
  confirmed?: boolean;
  confirmedGates?: import('./assistant').AssistantGate[];
}

export interface AssistantStudyEnqueueRequest {
  enterpriseId: string;
  skillId: string;
  goal: string;
  resources: Array<{ ref: string; topic?: string }>;
  evaluation?: string;
  expectedVersion: number;
}

export interface AssistantRepoPreviewRequest {
  /** https://github.com/<owner>/<repo> only; public metadata read, no persistence. */
  url: string;
}

export interface AssistantRepoFetchRequest {
  enterpriseId: string;
  url: string;
  /** Desktop is public-anonymous only; credentialed reads stay web-only. */
  intakeMode: import('./assistant').GithubIntakeMode;
  expectedVersion: number;
  confirmed: boolean;
  confirmedGates?: import('./assistant').AssistantGate[];
}

export interface AssistantRepoApplyRequest {
  enterpriseId: string;
  url: string;
  expectedVersion: number;
  confirmed: boolean;
  confirmedGates?: import('./assistant').AssistantGate[];
}

export interface AssistantCacheInvalidateRequest {
  enterpriseId: string;
  namespace: import('./assistant').CacheNamespace;
  /** OCC: enterprise record version. */
  expectedVersion: number;
}

export interface AssistantCacheStatusDto {
  namespace: import('./assistant').CacheNamespace;
  keys: number;
}

export interface AssistantEventsRequest {
  enterpriseId: string;
  afterIndex?: number;
  limit?: number;
}

export interface AssistantDonnaPromptRequest {
  enterpriseId: string;
  objective: string;
  includeLedger?: boolean;
  includeRepositories?: boolean;
}

export interface AssistantDonnaParseRequest {
  enterpriseId: string;
  /** Untrusted Donna chat reply text; parsed into strict draft proposals only. */
  text: string;
  scope?: import('./assistant').AssistantScope;
  actor?: import('./assistant').AssistantDefinitionId;
  /** Persist drafts (default true). Parsed proposals are never executed here. */
  persist?: boolean;
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
    attempt?: number,
  ): Promise<{ ok: boolean; text?: string; meta?: ArtifactMeta; error?: string }>;
  // v3: skills, hiring, office, approvals, events, recovery
  listSkills(): Promise<SkillSummary[]>;
  hirePreview(projectId: string): Promise<{ ok: boolean; preview?: HirePlanPreview; error?: string }>;
  applyHires(
    req: ApplyHiresRequest,
  ): Promise<{ ok: boolean; approval?: ApprovalRecord; error?: string }>;
  updateOfficeProject(
    req: UpdateOfficeProjectRequest,
  ): Promise<{ ok: boolean; project?: Project; error?: string }>;
  reassignNode(req: ReassignNodeRequest): Promise<{ ok: boolean; project?: Project; error?: string }>;
  getOfficeSnapshot(projectId: string, runId?: string): Promise<OfficeSnapshot | null>;
  decideApproval(req: DecideApprovalRequest): Promise<{ ok: boolean; approval?: ApprovalRecord; error?: string }>;
  listApprovals(projectId?: string, runId?: string): Promise<ApprovalRecord[]>;
  readRunEvents(
    projectId: string,
    runId: string,
    afterIndex?: number,
  ): Promise<{ ok: boolean; events?: RunEventRecord[]; nextIndex?: number; error?: string }>;
  recoverRun(runId: string): Promise<{ ok: boolean; error?: string }>;
  // v4: Director chat
  chatCreateSession(
    req: CreateChatSessionRequest,
  ): Promise<{ ok: boolean; session?: ChatSession; error?: string }>;
  chatListSessions(): Promise<ChatSessionSummary[]>;
  chatGetSession(sessionId: string): Promise<ChatSession | null>;
  chatSendMessage(req: SendChatMessageRequest): Promise<SendChatMessageResult>;
  chatStop(sessionId: string): Promise<{ ok: boolean; error?: string }>;
  chatDeleteSession(sessionId: string): Promise<{ ok: boolean; error?: string }>;
  // v4: companion bridge control (token is returned only by enable/regenerate)
  companionStatus(): Promise<CompanionStatus>;
  companionEnable(req?: { port?: number }): Promise<CompanionEnableResult>;
  companionDisable(): Promise<{ ok: boolean; error?: string }>;
  companionRegenerateToken(): Promise<CompanionEnableResult>;
  // v5: CEO mode (enterprises)
  entList(): Promise<EnterpriseSummaryDto[]>;
  entGet(id: string): Promise<EnterpriseRecordDto | null>;
  entCreate(req: CreateEnterpriseRequest): Promise<{ ok: boolean; record?: EnterpriseRecordDto; created?: boolean; error?: string }>;
  entUpdate(req: UpdateEnterpriseRequest): Promise<{ ok: boolean; record?: EnterpriseRecordDto; error?: string }>;
  entBlueprintPreview(req: EnterpriseBlueprintPreviewRequest): Promise<{ ok: boolean; preview?: EnterpriseBlueprintPreviewDto; error?: string }>;
  entBlueprintApply(req: EnterpriseBlueprintApplyRequest): Promise<{ ok: boolean; record?: EnterpriseRecordDto; error?: string }>;
  entApprovalDecide(req: EnterpriseApprovalDecideRequest): Promise<{ ok: boolean; approval?: EnterpriseApprovalDto; error?: string }>;
  entContracts(id: string): Promise<EnterpriseContractDto[]>;
  entContractPropose(req: EnterpriseContractProposeRequest): Promise<{ ok: boolean; record?: EnterpriseRecordDto; error?: string }>;
  entContractDecide(req: EnterpriseContractDecideRequest): Promise<{ ok: boolean; record?: EnterpriseRecordDto; error?: string }>;
  entContractRelease(req: EnterpriseContractReleaseRequest): Promise<{ ok: boolean; record?: EnterpriseRecordDto; error?: string }>;
  entMemory(id: string, includeRevoked?: boolean): Promise<EnterpriseMemoryDto[]>;
  entMemoryPromote(req: EnterpriseMemoryPromoteRequest): Promise<{ ok: boolean; approval?: EnterpriseApprovalDto; error?: string }>;
  entMemoryRevoke(req: EnterpriseMemoryRevokeRequest): Promise<{ ok: boolean; error?: string }>;
  entMemorySearch(id: string, query: string): Promise<EnterpriseMemoryDto[]>;
  entProgramStart(req: { enterpriseId: string; expectedVersion: number }): Promise<{ ok: boolean; error?: string }>;
  entProgramPause(id: string): Promise<{ ok: boolean; error?: string }>;
  entProgramResume(id: string): Promise<{ ok: boolean; error?: string }>;
  entProgramCancel(id: string): Promise<{ ok: boolean; error?: string }>;
  entProgramGet(id: string): Promise<import('./enterprise').EnterpriseProgram | null>;
  entProgramPump(id: string): Promise<{ ok: boolean; dispatched?: number; error?: string }>;
  entSnapshot(id: string): Promise<EnterpriseSnapshotDto | null>;
  entLedger(req: EnterpriseLedgerRequest): Promise<import('./enterprise').WorkLedgerEntry[]>;
  entTimeline(req: EnterprisePagedRequest): Promise<{ entries: import('./enterprise').TimelineIndexEntry[]; nextIndex: number }>;
  entEvents(req: EnterprisePagedRequest): Promise<{ events: EnterpriseEventDto[]; nextIndex: number }>;
  entWorkerUpdate(req: EnterpriseWorkerUpdateRequest): Promise<{ ok: boolean; error?: string }>;
  entExport(id: string): Promise<{ ok: boolean; dir?: string; files?: string[]; error?: string }>;
  entStewards(id: string): Promise<import('./enterprise').StewardRecommendation[]>;
  // v6: Donna / shared assistants
  astDefinitions(): Promise<AssistantDefinitionsDto>;
  astGet(enterpriseId: string): Promise<AssistantStateDto | null>;
  astPropose(req: AssistantProposeRequest): Promise<{ ok: boolean; proposal?: import('./assistant').AssistantActionProposal; created?: boolean; error?: string }>;
  astDecide(req: AssistantDecideRequest): Promise<{ ok: boolean; proposal?: import('./assistant').AssistantActionProposal; error?: string }>;
  astExecute(req: AssistantIdRequest): Promise<{ ok: boolean; proposal?: import('./assistant').AssistantActionProposal; error?: string }>;
  astCancel(req: AssistantIdRequest): Promise<{ ok: boolean; proposal?: import('./assistant').AssistantActionProposal; error?: string }>;
  astQueueAdd(req: AssistantQueueAddRequest): Promise<{ ok: boolean; summary?: string; error?: string }>;
  astQueueReorder(req: AssistantQueueReorderRequest): Promise<{ ok: boolean; summary?: string; error?: string }>;
  astWorkerAction(req: AssistantWorkerActionRequest): Promise<{ ok: boolean; summary?: string; error?: string }>;
  astLifecycleSet(req: AssistantLifecycleSetRequest): Promise<{ ok: boolean; summary?: string; error?: string }>;
  astJobUpsert(req: AssistantJobUpsertRequest): Promise<{ ok: boolean; summary?: string; error?: string }>;
  astJobPause(req: AssistantJobMutationRequest): Promise<{ ok: boolean; summary?: string; error?: string }>;
  astJobResume(req: AssistantJobMutationRequest): Promise<{ ok: boolean; summary?: string; error?: string }>;
  astJobDelete(req: AssistantJobMutationRequest): Promise<{ ok: boolean; summary?: string; error?: string }>;
  astJobRunNow(req: AssistantJobMutationRequest): Promise<{ ok: boolean; summary?: string; error?: string }>;
  astStudyEnqueue(req: AssistantStudyEnqueueRequest): Promise<{ ok: boolean; summary?: string; error?: string }>;
  astStudyList(enterpriseId: string): Promise<import('./assistant').StudyQueueItem[]>;
  astRepoPreview(req: AssistantRepoPreviewRequest): Promise<{ ok: boolean; metadata?: import('./assistant').RepositoryMetadata; plan?: import('./assistant').RepoAssignmentPlan; error?: string }>;
  astRepoFetch(req: AssistantRepoFetchRequest): Promise<{ ok: boolean; repository?: AssistantRepositoryDto; error?: string }>;
  astRepoApply(req: AssistantRepoApplyRequest): Promise<{ ok: boolean; summary?: string; error?: string }>;
  astKnowledgeList(enterpriseId: string): Promise<import('./assistant').KnowledgeTransferRecord[]>;
  astKnowledgeExport(enterpriseId: string): Promise<{ ok: boolean; dir?: string; files?: string[]; error?: string }>;
  astCacheInvalidate(req: AssistantCacheInvalidateRequest): Promise<{ ok: boolean; summary?: string; error?: string }>;
  astCacheStatus(enterpriseId: string): Promise<AssistantCacheStatusDto[]>;
  astEvents(req: AssistantEventsRequest): Promise<{ events: AssistantEventDto[]; nextIndex: number }>;
  astDonnaPrompt(req: AssistantDonnaPromptRequest): Promise<{ ok: boolean; prompt?: import('./assistant').DonnaPrompt; error?: string }>;
  astDonnaParse(req: AssistantDonnaParseRequest): Promise<{ ok: boolean; proposals?: import('./assistant').AssistantActionProposal[]; dropped?: number; error?: string }>;
  onAssistantEvent(listener: (event: AssistantEventPushDto) => void): () => void;
  onEnterpriseEvent(listener: (record: EnterpriseRecordDto) => void): () => void;
  onJobEvent(listener: (job: JobRecord) => void): () => void;
  onModeChanged(listener: (mode: ShellMode) => void): () => void;
  onProjectEvent(listener: (run: ProjectRun) => void): () => void;
}
