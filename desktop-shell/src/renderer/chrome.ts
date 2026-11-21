import { mountStudio, type Studio, type StudioHeat, type StudioActionKind, type StudioActionContext, type StudioActionState, type InspectorActionSpec } from './freeflow/studio.js';
import type { FreeflowFocus, FreeflowSnapshot, SceneNode } from './freeflow/model.js';
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
type CredentialProvider = ApiProvider | 'github';
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
  providers: Record<ApiProvider, ProviderCredentialStatus> & { github?: ProviderCredentialStatus };
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

type CompanyTaskStatus = 'todo' | 'in-progress' | 'blocked' | 'done';

interface CompanyRecord {
  id: string;
  name: string;
  repoUrl: string;
  owner: string;
  repo: string;
  defaultBranch: string | null;
  description: string | null;
  registeredAt: string | null;
  lastCheckedAt: string | null;
  githubStatus: 'unchecked' | 'verified' | 'error';
  githubError: string | null;
  stars: number | null;
  openIssues: number | null;
  pushedAt: string | null;
  headSha: string | null;
}

interface CompanyEmployee {
  id: string;
  name: string;
  role: string;
  rolePath: string;
  skillPath: string;
  status: 'ready' | 'running' | 'blocked';
  lastResult: string | null;
}

interface CompanyTask {
  id: string;
  title: string;
  ownerId: string;
  status: CompanyTaskStatus;
  priority: 'P0' | 'P1' | 'P2';
  milestone: string;
  evidence: string | null;
  updatedAt: string;
}

interface CompanyMilestone {
  id: string;
  title: string;
  description: string;
}

interface CompanyActivity {
  id: string;
  at: string;
  employeeId: string;
  kind: string;
  message: string;
}

interface CompanyRepositoryIndex {
  root: string;
  fileCount: number;
  totalBytes: number;
  skippedCount: number;
  truncated: boolean;
  elapsedMs: number;
  workers: number;
  generatedAt: string;
  /** Metadata only. Files are never loaded as code or executed. */
  files: Array<{ path: string; bytes: number; kind: string }>;
}

interface CompanyUsage extends UsageTotals {
  runCount: number;
  completedRuns: number;
  failedRuns: number;
  source: 'local-project-runs';
}

interface CompanySnapshot {
  available: boolean;
  backend: 'rust' | 'unavailable';
  error: string | null;
  company: CompanyRecord | null;
  employees: CompanyEmployee[];
  tasks: CompanyTask[];
  milestones: CompanyMilestone[];
  activity: CompanyActivity[];
  usage: CompanyUsage;
  index: CompanyRepositoryIndex | null;
}

interface RegisterCompanyRequest { repoUrl: string }
interface UpdateCompanyTaskRequest { id: string; status: CompanyTaskStatus; evidence?: string }


/** Durable office definitions are records, not claims that model processes are running. */
type OfficeEntityStatus = 'active' | 'paused';
interface OfficeCompany {
  id: string; name: string; repoUrl: string | null; status: OfficeEntityStatus;
  assistantId: string; createdAt: string; source: string;
  importedAt: string | null; githubStatus: 'unchecked' | 'metadata-reviewed';
  visibility?: 'public' | 'private' | null; defaultBranch?: string | null;
}
interface OfficeLocation {
  id: string; companyId: string; name: string; status: OfficeEntityStatus; assistantId: string; createdAt: string;
}
interface OfficeDepartment {
  id: string; companyId: string; officeId: string; name: string; status: OfficeEntityStatus; assistantId: string; createdAt: string;
}
interface OfficeEmployee {
  id: string; companyId: string | null; officeId: string | null; departmentId: string | null;
  name: string; role: string; kind: 'assistant' | 'specialist';
  status: 'active' | 'paused' | 'fired'; skillPaths: string[]; createdAt: string; updatedAt: string;
  assignmentKey?: string | null;
}
type OfficeJobStatus = 'queued' | 'waiting-budget' | 'running' | 'paused' | 'cancelled' | 'completed' | 'failed' | 'budget-exhausted' | 'needs-review';
interface OfficeJob {
  id: string; companyId: string; officeId: string; departmentId: string | null; employeeId: string;
  goal: string; mode: 'manual' | 'provider'; provider: 'anthropic' | 'openai' | 'ollama'; model: string;
  authorized: boolean; allowedTools: string[]; dependencies: string[];
  contextHash: string | null; cacheKey: string | null; promptVersion: string;
  status: OfficeJobStatus;
  limits: { maxTokens: number; maxUsd: number; maxMinutes: number };
  priceRates: { inputUsdPerMillion: number | null; outputUsdPerMillion: number | null };
  usage: { inputTokens: number; outputTokens: number; costUsd: number };
  costStatus: 'none' | 'reserved' | 'observed' | 'estimated';
  reservation: { inputTokens: number; maxOutputTokens: number; costUsd: number } | null;
  pendingReservation?: { inputTokens: number; maxOutputTokens: number; costUsd: number } | null;
  usageRecorded: boolean;
  createdAt: string; updatedAt: string; dueAt: string; startedAt: string | null; finishedAt: string | null;
  workerId: string | null; leaseToken: string | null; leaseExpiresAt: string | null;
  artifactUri: string | null; summary: string | null; error: string | null; idempotencyKey: string;
  goalId?: string | null; goalIteration?: number | null;
  serviceContractId?: string | null; knowledgeTransferIds?: string[];
}
interface OfficeSchedule {
  id: string; companyId: string; name: string; enabled: boolean; everyMinutes: number;
  nextRunAt: string; lastEnqueuedAt: string | null; jobTemplate: Record<string, unknown>;
  lastError?: string | null;
}
interface OfficeCacheEntry { key: string; companyId: string; artifactUri: string; bytes: number; createdAt: string; expiresAt: string; contentSha256?: string | null }
interface OfficeCache { enabled: boolean; maxEntries: number; ttlMinutes: number; entries: OfficeCacheEntry[]; hits: number; misses: number }
interface OfficeKnowledge { id: string; companyId: string; title: string; summary: string; artifactUri: string; createdAt: string }
interface OfficeEvent { id: string; at: string; actor: string; action: string; entityId: string; summary: string }
interface OfficeScope { kind: 'company' | 'office' | 'department' | 'employee'; id: string }
interface OfficePolicy {
  approvalMode: 'review' | 'autonomous'; dispatchPaused: boolean;
  budget: { hardCapUsd: number; hardCapTokens: number | null; warningPercent: number };
}
interface OfficeBudget {
  observedUsd: number; estimatedUsd: number; reservedUsd: number; committedUsd: number; remainingUsd: number;
  committedTokens: number; remainingTokens: number | null; warning: boolean; atCap: boolean;
}
interface OfficeExternalAttempt {
  attemptId: string; source: string; reservedUsd: number; maxTokens: number;
  usage: { inputTokens: number; outputTokens: number; costUsd: number };
  costStatus: 'reserved' | 'observed' | 'estimated'; settled: boolean; createdAt: string; updatedAt: string;
}
interface OfficeChatMessage {
  id: string; role: 'user' | 'assistant' | 'system'; content: string; createdAt: string; source: 'user' | 'local' | 'provider';
}
interface OfficeChatThread { id: string; scope: OfficeScope; messages: OfficeChatMessage[] }
interface OfficeGoalStep { id: string; title: string; employeeId: string; goal: string; dependsOn: string[]; serviceContractId?: string | null; knowledgeTransferIds?: string[] }
interface OfficeGoalRunSettings {
  mode: 'manual' | 'provider'; provider: 'anthropic' | 'openai' | 'ollama'; model: string; authorized: boolean;
  maxTokens: number; maxUsd: number; maxMinutes: number;
  priceRates: { inputUsdPerMillion: number | null; outputUsdPerMillion: number | null };
  allowedTools?: string[];
}
interface OfficeGoal {
  id: string; companyId: string; scope: OfficeScope; title: string; description: string;
  mode: 'plan' | 'execute'; status: 'draft' | 'planned' | 'running' | 'paused' | 'completed' | 'needs-review';
  maxIterations: number; iteration: number; jobIds: string[]; steps: OfficeGoalStep[]; runSettings: OfficeGoalRunSettings;
  createdAt: string; updatedAt: string;
  stopReason?: string | null;
}
interface OfficeCheckpoint { id: string; goalId: string; jobId: string | null; iteration: number; summary: string; artifactUri: string | null; createdAt: string }
interface OfficeRoom { id: string; name: string; departmentId: string | null; x: number; y: number; width: number; height: number }
interface OfficeDesk { id: string; roomId: string; employeeId: string; x: number; y: number }
interface OfficeWhiteboard { id: string; roomId: string; ownerEmployeeId: string; title: string; goalIds: string[]; jobIds: string[]; roadmapItemIds?: string[]; x: number; y: number }
interface OfficeBlueprint { id: string; companyId: string; officeId: string; rooms: OfficeRoom[]; desks: OfficeDesk[]; whiteboards: OfficeWhiteboard[] }
type PortfolioServiceKey = 'engineering' | 'design-architecture' | 'research-knowledge' | 'security' | 'hackathon' | 'music-arts';
interface PortfolioGroup { id: string; name: string; description: string; companyIds: string[]; status: OfficeEntityStatus; createdAt: string; updatedAt: string }
interface PortfolioService { id: string; key: PortfolioServiceKey; name: string; companyId: string; officeId: string; departmentId: string; employeeIds: string[]; retiredEmployeeIds?: string[]; status: OfficeEntityStatus; createdAt: string; updatedAt: string }
interface PortfolioServiceContract {
  id: string; serviceId: string; recipientCompanyId: string; recipientOfficeId: string | null; recipientDepartmentId: string | null;
  employeeIds: string[]; allowedTools: string[]; status: 'active' | 'paused' | 'revoked'; createdAt: string; updatedAt: string;
}
interface PortfolioKnowledgeTransfer {
  id: string; sourceCompanyId: string; recipientCompanyId: string; knowledgeId: string;
  status: 'requested' | 'granted' | 'revoked'; purpose: string; createdAt: string; updatedAt: string;
}
interface PortfolioRoadmapItem {
  id: string; scope: { kind: 'company' | 'group' | 'global'; id: string }; title: string; description: string;
  ownerEmployeeId: string; departmentId: string | null; serviceContractId: string | null;
  status: 'planned' | 'in-progress' | 'blocked' | 'done'; dependencies: string[]; goalIds: string[]; jobIds: string[];
  evidence: string | null; createdAt: string; updatedAt: string;
}
interface OfficePortfolio {
  ceo: { enabled: boolean; title: string; focusGroupId: string | null; sharedServicesCompanyId: string | null; updatedAt: string };
  groups: PortfolioGroup[]; services: PortfolioService[]; contracts: PortfolioServiceContract[];
  transfers: PortfolioKnowledgeTransfer[]; roadmap: PortfolioRoadmapItem[];
  recommendations: Array<{ employeeId: string; serviceId: string; reason: string }>;
}
type DecisionPanelRoleKey = 'engineering' | 'frontend-extensions' | 'backend' | 'database-cache' | 'github-release'
  | 'qa' | 'security' | 'research-knowledge' | 'knowledge' | 'design-architecture' | 'math-geometry' | 'music-arts'
  | 'hackathon' | 'newton' | 'tesla' | 'research-skeptic' | 'resonance-advisor' | 'paired-research';
interface DecisionPanelMember {
  employeeId: string; roleKey: DecisionPanelRoleKey; serviceContractId: string | null; selection: 'reused' | 'hired';
}
interface DecisionPanelDecision {
  id: string; round: number; verdict: 'accepted' | 'revise' | 'defer' | 'reject';
  summary: string; evidence: string[]; createdAt: string;
}
interface DecisionPanel {
  id: string; companyId: string; scope: { kind: 'company' | 'group' | 'office' | 'department'; id: string };
  title: string; task: string; focus: 'software' | 'design' | 'research' | 'data';
  status: 'draft' | 'running' | 'review' | 'decided' | 'paused'; members: DecisionPanelMember[];
  round: number; maxRounds: number;
  /** maxUsd bounds the entire panel; maxTokens and maxMinutes bound each request. */
  limits: { maxUsd: number; maxTokens: number; maxMinutes: number };
  goalIds: string[]; roadmapItemIds: string[]; decisions: DecisionPanelDecision[];
  createdAt: string; updatedAt: string;
}
interface AuthorityScope { kind:'company'|'office'|'department'|'employee'|'goal'; id:string }
interface AuthorityGrant {
  id:string; employeeId:string; scope:AuthorityScope; type:'permission'|'promotion'; preset:'full'|'partial';
  capabilities:string[]; title:string|null; issuer:'owner'|'donna'; grantedAt:string; expiresAt:string;
  revokedAt:string|null; reason:string; revokedBy:string|null; revokeReason:string|null; parentGrantIds?:string[];
}
interface AuthorityLedgerEntry { id:string; at:string; actor:string; action:string; targetId:string; scope:AuthorityScope|null; summary:string; grantId:string|null; outcome:'applied'|'denied' }
interface OfficeIndexEntry { id:string; entityId:string; kind:string; title:string; companyId:string|null; parentId:string|null; ownerEmployeeId:string|null; status:string; updatedAt:string; relatedIds:string[] }
interface OfficeAuthority { schemaVersion:1; managedEmployeeIds:string[]; grants:AuthorityGrant[]; ledger:AuthorityLedgerEntry[]; index:OfficeIndexEntry[] }
interface OfficeSnapshot {
  schemaVersion: 1; activeCompanyId: string;
  companies: OfficeCompany[]; offices: OfficeLocation[]; departments: OfficeDepartment[]; employees: OfficeEmployee[];
  jobs: OfficeJob[]; schedules: OfficeSchedule[]; cache: OfficeCache; knowledge: OfficeKnowledge[]; events: OfficeEvent[];
  /** Result metadata from the most recent command; never a provider credential. */
  lastAction: Record<string, unknown> | null;
  /** Additive fields are optional for old bridge clients; the native core always migrates them. */
  policy?: OfficePolicy; budget?: OfficeBudget; externalAttempts?: OfficeExternalAttempt[];
  chatThreads?: OfficeChatThread[]; goals?: OfficeGoal[]; checkpoints?: OfficeCheckpoint[]; blueprints?: OfficeBlueprint[];
  portfolio?: OfficePortfolio;
  decisionPanels?: DecisionPanel[];
  authority?: OfficeAuthority;
}
type OfficeAction = 'create_company' | 'select_company' | 'import_repositories' | 'import_github_account'
  | 'create_office' | 'create_department' | 'hire_employee' | 'pause_employee' | 'resume_employee' | 'fire_employee'
  | 'pause_company' | 'resume_company' | 'pause_office' | 'resume_office' | 'pause_department' | 'resume_department'
  | 'enqueue_job' | 'claim_job' | 'reserve_job' | 'finish_job' | 'complete_job' | 'heartbeat_job' | 'cancel_job' | 'pause_job' | 'resume_job'
  | 'create_schedule' | 'pause_schedule' | 'resume_schedule' | 'tick_schedules'
  | 'configure_cache' | 'clear_cache' | 'get_cache' | 'put_cache' | 'add_knowledge'
  | 'configure_policy' | 'reserve_external' | 'settle_external' | 'approve_job' | 'bootstrap_directors'
  | 'post_chat' | 'post_assistant_message' | 'create_goal' | 'plan_goal' | 'set_goal_plan' | 'execute_goal' | 'advance_goal'
  | 'pause_goal' | 'resume_goal' | 'checkpoint_goal' | 'tick_goals' | 'ensure_blueprint' | 'save_blueprint' | 'upsert_room'
  | 'place_employee' | 'upsert_whiteboard' | 'record_github_activity' | 'github_operation'
  | 'configure_ceo' | 'upsert_portfolio_group' | 'ensure_shared_services' | 'optimize_portfolio'
  | 'contract_service' | 'share_knowledge' | 'upsert_roadmap_item' | 'schedule_repository_reviews'
  | 'convene_panel' | 'start_panel_round' | 'record_panel_decision' | 'pause_panel' | 'resume_panel' | 'apply_remote_command'
  | 'grant_authority' | 'promote_employee' | 'revoke_authority' | 'set_authority_enforcement' | 'apply_employee_command' | 'rebuild_office_index';
/** Every action has a fixed Rust-side schema; unknown fields are never executed. */
interface OfficeCommand { action: OfficeAction; [key: string]: unknown }
interface OfficeResult { ok: boolean; snapshot: OfficeSnapshot | null; error?: string; code?: string; queued?: boolean; commandId?: string }

interface OfficeWorkerStatus {
  enabled: boolean; running: boolean; activeJobId: string | null; lastError: string | null;
  concurrency?: number; activeJobIds?: string[];
}

/** Device credentials never leave the desktop main process after configuration. */
interface CloudConnectionStatus {
  configured: boolean;
  connected: boolean;
  url: string | null;
  revision: number | null;
  lastSyncedAt: string | null;
  /** Remote commands fetched but not yet acknowledged; not unsaved local edits. */
  pendingCommands: number;
  error: string | null;
  capability: 'snapshot-and-commands';
  encryptionAvailable: boolean;
}
interface ConfigureCloudRequest {
  url: string;
  /** A device token or pairing JSON containing deviceToken and siteAccessToken. */
  token: string;
}
interface CloudConnectionResult { ok: boolean; status: CloudConnectionStatus; error?: string }

interface DesktopBridge {
  version: number;
  transport?: 'personal-browser' | 'public-preview' | 'cloud-browser';
  openPersonalDashboard?(): Promise<{ok:boolean;url?:string;error?:string}>;
  importCredentialFile?(provider:CredentialProvider): Promise<{ok:boolean;error?:string;cancelled?:boolean;status?:VaultStatus}>;
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
  setApiKey(provider: CredentialProvider, key: string): Promise<{ ok: boolean; error?: string }>;
  revokeApiKey(provider: CredentialProvider): Promise<{ ok: boolean; error?: string }>;
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
  cloudStatus?(): Promise<CloudConnectionStatus>;
  configureCloud?(request: ConfigureCloudRequest): Promise<CloudConnectionResult>;
  syncCloud?(): Promise<CloudConnectionResult>;
  disconnectCloud?(): Promise<CloudConnectionResult>;
  copyEditorPairing?(): Promise<{ok:boolean;expiresAt?:string;error?:string}>;
  sendCloudChat?(request:{scope:OfficeScope;message:string;idempotencyKey:string;goalMode?:string}): Promise<OfficeResult & {reply?:string;usage?:unknown;budget?:unknown;jobId?:string}>;
  officeSnapshot?(): Promise<OfficeResult>;
  officeCommand?(req: OfficeCommand): Promise<OfficeResult>;
  officeWorkerStatus?(): Promise<OfficeWorkerStatus>;
  setOfficeWorker?(req: { enabled: boolean }): Promise<OfficeWorkerStatus>;
  runOfficeQueue?(): Promise<OfficeWorkerStatus>;
  companySnapshot?(): Promise<CompanySnapshot>;
  registerCompany?(req: RegisterCompanyRequest): Promise<CompanySnapshot>;
  refreshCompany?(): Promise<CompanySnapshot>;
  updateCompanyTask?(req: UpdateCompanyTaskRequest): Promise<CompanySnapshot>;
  indexCompanyRepository?(): Promise<CompanySnapshot>;
  onJobEvent(listener: (job: JobRecord) => void): () => void;
  onModeChanged(listener: (mode: 'launcher' | 'content', url: string | null) => void): () => void;
  onProjectEvent(listener: (run: ProjectRun) => void): () => void;
}

declare global {
  interface Window {
    desktopBridge?: DesktopBridge;
    DaftarSignals?: { build(snapshot: unknown, options: {companyId?: string; officeId?: string; departmentId?: string; now: string; sampledAt?: string}): StudioSignals };
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

type ViewName = 'overview' | 'office' | 'projects' | 'team' | 'roadmap' | 'usage' | 'library' | 'models' | 'settings';
const VIEW_IDS: Record<ViewName, string> = {
  office: 'office-view', overview: 'launcher-view', projects: 'projects-view', team: 'team-view', roadmap: 'roadmap-view',
  usage: 'usage-view', library: 'library-view', models: 'system-view', settings: 'settings-view',
};
const VIEW_LABELS: Record<ViewName, string> = {
  overview: 'Overview', office: 'Donna workspace', projects: 'Projects', team: 'Team', roadmap: 'Roadmap',
  usage: 'Usage & activity', library: 'Research library', models: 'Models & system', settings: 'Settings',
};
let activeView: ViewName = 'office';
let contentMode = false;

function setMode(mode: 'launcher' | 'content', url: string | null): void {
  contentMode = mode === 'content';
  $('toolbar').classList.toggle('hidden', !contentMode);
  $('workspace-shell').classList.toggle('hidden', contentMode);
  if (contentMode) {
    $('content-location').textContent = url ?? 'Offline research atlas';
    const isRemote = url !== null && (url.startsWith('https://') || url.startsWith('http://'));
    $('open-in-browser').classList.toggle('hidden', !isRemote);
    if (isRemote && url) $('open-in-browser').onclick = () => void bridge?.openExternal(url);
  }
}

function showView(id: 'launcher-view' | 'system-view' | 'projects-view'): void {
  navigate(id === 'launcher-view' ? 'overview' : id === 'system-view' ? 'models' : 'projects');
}

function navigate(view: ViewName, updateHash = true): void {
  activeView = view;
  for (const [key, id] of Object.entries(VIEW_IDS)) $(id).classList.toggle('hidden', key !== view);
  document.querySelectorAll<HTMLButtonElement>('.nav-item').forEach((button) => {
    const selected = button.dataset.view === view;
    button.classList.toggle('active', selected);
    if (selected) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  });
  $('screen-name').textContent = VIEW_LABELS[view];
  if (updateHash && location.hash !== `#${view}`) history.replaceState(null, '', `#${view}`);
  if (view === 'office') void safeTask(refreshOffice);
  if (view === 'projects') void safeTask(refreshProjectsPanel);
  if (view === 'models') void safeTask(refreshSystemPanel);
  if (view === 'settings') { void safeTask(refreshKeys); void safeTask(refreshCloudConnection); }
  if (view === 'usage' || view === 'overview') void safeTask(refreshWorkspace);
  if (view === 'roadmap') renderRoadmap();
  if (view === 'library') renderIndex();
  ffApplyMode();syncDonnaDock();
  window.scrollTo({ top: 0, behavior: 'instant' });
}

// ---------------------------------------------------------------- launcher

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
    void safeTask(refreshSystemPanel);
  });

  $('system-back').addEventListener('click', () => showView('launcher-view'));

  $('open-projects').addEventListener('click', () => {
    showView('projects-view');
    void safeTask(refreshProjectsPanel);
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
  setActionLabel(sourceBtn,'Source ↗');
  sourceBtn.onclick = () => void bridge?.openExternal(model.sourceUrl);
  row.append(sourceBtn);

  if (model.licenseUrl) {
    const licenseBtn = document.createElement('button');
    licenseBtn.className = 'secondary';
    setActionLabel(licenseBtn,'License ↗');
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
  if (jobs.length === 0) {
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.colSpan = 6;
    cell.className = 'empty-inline';
    cell.textContent = 'No background jobs. Downloads and environment setup appear here.';
    row.append(cell); tbody.append(row);
  }
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

const KEY_PROVIDERS: { id: CredentialProvider; label: string; hint: string }[] = [
  { id: 'openai', label: 'OpenAI', hint: 'sk-…' },
  { id: 'anthropic', label: 'Anthropic', hint: 'sk-ant-…' },
  { id: 'github', label: 'GitHub', hint: 'github_pat_… or ghp_…' },
];

async function refreshKeys(): Promise<void> {
  if (!bridge) return;
  if(bridge.transport==='cloud-browser'){$('vault-warning').classList.add('hidden');noData($('key-rows'),'Donna’s cloud provider credential is held by the private service. Desktop provider keys are managed in the desktop app.');return;}
  const status = await bridge.getVaultStatus();
  const warning = $('vault-warning');
  warning.classList.toggle('hidden', status.encryptionAvailable);
  if (!status.encryptionAvailable) {
    warning.textContent = bridge.transport === 'public-preview'
      ? 'Provider keys are available only in your private desktop workspace; this public preview cannot store credentials.'
      : 'OS secure storage is unavailable (no unlocked system keychain). Keys cannot be saved — this shell fails closed. Unlock your keychain (e.g. GNOME Keyring / KWallet) and restart the app.';
  }
  const container = $('key-rows');
  container.innerHTML = '';
  for (const p of KEY_PROVIDERS) {
    const st = status.providers[p.id] || {configured:false,readable:false,updatedAt:null};
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
    input.setAttribute('aria-label', `${p.label} API key`);
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
      if (!res.ok) setStatus($('key-status'), res.error ?? 'Failed to save key.', 'error');
      await refreshKeys();
    };
    row.append(setBtn);
    const importBtn = document.createElement('button');
    importBtn.className = 'secondary'; importBtn.type = 'button'; importBtn.textContent = 'Import file';
    importBtn.disabled = !status.encryptionAvailable || !bridge.importCredentialFile || bridge.transport === 'public-preview';
    importBtn.onclick = () => workspaceTask(async () => {
      if (!bridge?.importCredentialFile) throw new Error('Credential file import requires the current desktop app.');
      const result = await bridge.importCredentialFile(p.id);
      if(result.cancelled){setStatus($('key-status'),'Credential import cancelled.');return;}
      if (!result.ok) throw new Error(result.error || 'No credential was imported.');
      await refreshKeys(); setStatus($('key-status'), `${p.label} credential imported into encrypted storage.`, 'ok');
    }, 'key-status');
    row.append(importBtn);

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
    role.setAttribute('aria-label', `Specialist ${i + 1} role`);
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
    title.setAttribute('aria-label', `Specialist ${i + 1} title`);
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
    removeBtn.setAttribute('aria-label', `Remove specialist ${draft.title || i + 1}`);
    head.append(removeBtn);
    card.append(head);

    const instructions = document.createElement('textarea');
    instructions.rows = 2;
    instructions.placeholder = 'Instructions for this specialist…';
    instructions.setAttribute('aria-label', `Specialist ${i + 1} instructions`);
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
    $('model-select-label').classList.remove('hidden');
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
  workspaceProjects = projects;
  renderOverview();
  const container = $('project-list');
  container.innerHTML = '';
  if (projects.length === 0) {
    const p = document.createElement('p');
    p.className = 'muted';
    p.className = 'empty-inline';
    p.textContent = 'No projects yet. Open New project below to brief your first team.';
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
  $('run-project-name').textContent = currentProject.name;
  ($('new-project-details') as HTMLDetailsElement).open = false;
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
  if (currentProject.provider !== 'ollama' && (req.priceRates.inputUsdPerMillion <= 0 || req.priceRates.outputUsdPerMillion <= 0)) {
    setStatus(status, 'Enter positive provider pricing before starting a cloud run so the USD limit can be enforced.', 'error');
    document.querySelector<HTMLDetailsElement>('.pricing-details')!.open = true;
    ($('rate-input') as HTMLInputElement).focus();
    return;
  }
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
  $('run-state-pill').textContent = currentRun?.status ?? (currentProject ? 'Ready to run' : 'No run selected');
  $('run-state-pill').className = `pill ${currentRun?.status === 'completed' ? 'ok' : currentRun?.status === 'failed' ? 'error' : 'neutral'}`;
  if (!currentProject) {
    const note = document.createElement('p');
    note.className = 'empty-inline';
    note.textContent = 'Open a project to configure a run and review its artifacts.';
    container.append(note);
    return;
  }

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

// ---------------------------------------------------------------- company workspace
let companyState: CompanySnapshot | null = null;
let workspaceProjects: Project[] = [];
let workspaceRuns: ProjectRun[] = [];
let indexVisible = 100;
let workspaceRefresh: Promise<void> | null = null;
let toastTimer: ReturnType<typeof setTimeout> | null = null;
function toast(message: string): void {
  const el = $('global-status'); el.textContent = message; el.classList.remove('hidden');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add('hidden'), 6500);
}
async function safeTask(task: () => Promise<unknown>): Promise<void> {
  try { await task(); } catch (error) { toast(error instanceof Error ? error.message : 'The operation could not be completed.'); }
}
function number(value: number): string { return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(value); }
function money(value: number): string { return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: value > 0 && value < .01 ? 4 : 2 }).format(value); }
function dateLabel(value: string | null, includeTime = false): string {
  if (!value) return 'Not checked'; const d = new Date(value);
  if (Number.isNaN(d.getTime())) return 'Unknown date';
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', ...(includeTime ? { hour: 'numeric', minute: '2-digit' } as const : {}) }).format(d);
}
function textElement<K extends keyof HTMLElementTagNameMap>(tag: K, text: string, className?: string): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag); element.textContent = text; if (className) element.className = className; return element;
}
function setActionLabel(element: HTMLElement, label: string): void {
  element.textContent = label.replace(/\s*↗$/, '');
  if (label.endsWith('↗')) {
    const icon = svgElement('svg', {viewBox:'0 0 16 16',class:'action-arrow','aria-hidden':'true',focusable:'false'});
    icon.append(svgElement('path', {d:'M4 12 12 4M4 4h8v8'})); element.append(icon);
  }
}
function actionButton(label: string, className = 'text-button'): HTMLButtonElement {
  const button = textElement('button','',className); setActionLabel(button,label); return button;
}
function noData(container: HTMLElement, message: string): void { container.replaceChildren(textElement('p', message, 'empty-inline')); }
function nativeUnavailable(): void { toast('Open the installed desktop app to use this action.'); }
function refreshWorkspace(): Promise<void> {
  if (workspaceRefresh) return workspaceRefresh;
  workspaceRefresh = (async () => {
    if (!bridge) { renderOverview(); renderUsage(); return; }
    const result = await Promise.allSettled([bridge.companySnapshot ? bridge.companySnapshot() : Promise.resolve(null), bridge.listProjects(), bridge.listRuns()]);
    const company = result[0]; if (company?.status === 'fulfilled' && company.value) companyState = company.value;
    if (company?.status === 'rejected') setStatus($('company-status'), 'The company workspace could not be loaded. Refresh to try again.', 'error');
    const projects = result[1]; if (projects?.status === 'fulfilled') workspaceProjects = projects.value;
    const runs = result[2]; if (runs?.status === 'fulfilled') workspaceRuns = runs.value;
    renderCompany(); renderOverview(); renderTeam(); renderRoadmap(); renderUsage(); if (activeView === 'library') renderIndex();
  })().finally(() => { workspaceRefresh = null; });
  return workspaceRefresh;
}
function renderCompany(): void {
  const company = companyState?.company; const ready = companyState?.available === true;
  $('core-label').textContent = workspaceReadOnly() ? 'Starter office preview' : bridge?.transport==='cloud-browser' ? officeState ? 'Private cloud workspace' : 'Cloud workspace not loaded' : bridge?.transport === 'personal-browser' ? 'Private browser workspace' : ready ? 'Native workspace ready' : bridge ? 'Native core unavailable' : 'Desktop preview';
  $('core-note').textContent = workspaceReadOnly() ? 'Example state · read only' : bridge?.transport==='cloud-browser' ? officeState ? 'Desktop executes queued commands' : 'Open welcome to check sign-in' : bridge?.transport === 'personal-browser' ? 'Connected to your desktop app' : ready ? 'Rust core · local persistence' : bridge ? 'Company actions unavailable' : 'Open the installed desktop app';
  if (companyState?.error) setStatus($('company-status'), companyState.error, 'error');
  const label = company?.githubStatus === 'verified' ? 'GitHub verified' : company?.githubStatus === 'error' ? 'Repository check failed' : 'Repository not checked';
  for (const id of ['company-connection', 'settings-repo-status']) {
    $(id).textContent = label; $(id).className = `pill ${company?.githubStatus === 'verified' ? 'ok' : company?.githubStatus === 'error' ? 'error' : 'neutral'}`;
  }
  if (!company) return;
  $('sidebar-company').textContent = officeCompany()?.name || company.name; $('sidebar-company').title = officeCompany()?.name || company.name;
  $('overview-heading').textContent = company.name;
  $('company-description').textContent = company.description || 'Your repository, specialist team, and next release in one place.';
  $('repo-display-name').textContent = company.repo; $('repo-display-owner').textContent = company.owner;
  $('repo-branch').textContent = company.defaultBranch || 'Not checked';
  $('repo-commit').textContent = company.headSha ? company.headSha.slice(0, 8) : 'Not checked';
  $('repo-checked').textContent = dateLabel(company.lastCheckedAt);
  const input = $('company-repo-url') as HTMLInputElement; if (document.activeElement !== input) input.value = company.repoUrl;
  if (company.githubError) setStatus($('company-status'), company.githubError, 'error');
}
function currentTotals(): CompanyUsage {
  if (workspaceRuns.length > 0 || !companyState) {
    return workspaceRuns.reduce<CompanyUsage>((sum, run) => ({ inputTokens: sum.inputTokens + run.usage.inputTokens, outputTokens: sum.outputTokens + run.usage.outputTokens, costUsd: sum.costUsd + run.usage.costUsd, runCount: sum.runCount + 1, completedRuns: sum.completedRuns + (run.status === 'completed' ? 1 : 0), failedRuns: sum.failedRuns + (run.status === 'failed' ? 1 : 0), source: 'local-project-runs' }), { inputTokens: 0, outputTokens: 0, costUsd: 0, runCount: 0, completedRuns: 0, failedRuns: 0, source: 'local-project-runs' });
  }
  return companyState.usage;
}
function renderOverview(): void {
  const usage = currentTotals();
  $('metric-projects').textContent = number(workspaceProjects.length); $('nav-project-count').textContent = number(workspaceProjects.length);
  $('metric-team').textContent = companyState ? number(companyState.employees.length) : '—'; $('nav-team-count').textContent = companyState ? number(companyState.employees.length) : '—';
  $('metric-completed').textContent = number(usage.completedRuns); $('metric-spend').textContent = money(usage.costUsd);
  const active = workspaceRuns.filter((r) => r.status === 'running' || r.status === 'paused').length;
  $('metric-projects-note').textContent = active ? `${active} active run${active === 1 ? '' : 's'}` : workspaceProjects.length ? 'All projects on this device' : 'Ready for your first brief';
  $('metric-completed-note').textContent = usage.runCount ? `${usage.runCount} total run${usage.runCount === 1 ? '' : 's'}` : 'Local project history';
  if (companyState?.company?.githubStatus === 'verified') {
    const next = companyState.tasks.find((t) => t.status === 'in-progress') || companyState.tasks.find((t) => t.status === 'todo');
    $('focus-title').textContent = next?.title || 'Your next chapter starts here.';
    $('focus-description').textContent = next ? `Assigned to ${employeeName(next.ownerId)}. Review the milestone, define the evidence, and keep the release moving.` : 'Create a project and give your specialist team a clear outcome to work toward.';
    setActionLabel($('focus-action'),next ? 'Open roadmap ↗' : 'Create a project ↗');
  }
  const container = $('overview-projects'); container.replaceChildren();
  if (!workspaceProjects.length) {
    const empty = textElement('div', '', 'empty-state'); empty.append(textElement('span', '+', 'empty-symbol'), textElement('h3', 'Start with a clear goal.'), textElement('p', 'Create a project, choose a model, and give your specialists a brief.'));
    const button = textElement('button', 'Create first project', 'secondary'); button.type = 'button'; button.onclick = openNewProject; empty.append(button); container.append(empty);
  } else for (const project of [...workspaceProjects].sort((a,b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 3)) {
    const row = textElement('div', '', 'project-preview-row'); const info = textElement('div', '', 'project-preview-copy');
    info.append(textElement('strong', project.name), textElement('small', `${project.provider} · ${project.nodes.length} specialists · ${dateLabel(project.updatedAt)}`));
    const button = actionButton('↗'); button.type = 'button'; button.setAttribute('aria-label', `Open ${project.name}`); button.onclick = () => { navigate('projects'); void safeTask(() => selectProject(project.id)); };
    row.append(textElement('span', '⌑', 'project-preview-icon'), info, button); container.append(row);
  }
  const roadmap = $('overview-roadmap'); roadmap.replaceChildren(); const tasks = companyState?.tasks.filter((t) => t.status !== 'done').slice(0, 3) || [];
  if (!tasks.length) noData(roadmap, companyState ? 'No open work. Your completed milestones are in Roadmap.' : 'Your company’s milestones will appear here.');
  for (const task of tasks) {
    const row = textElement('div', '', 'roadmap-item'); const copy = textElement('div', '');
    copy.append(textElement('h3', task.title), textElement('small', `${task.priority} · ${employeeName(task.ownerId)} · ${task.status.replace('-', ' ')}`));
    row.append(textElement('span', '', `task-indicator ${task.status}`), copy); roadmap.append(row);
  }
  renderActivity($('overview-activity'), 3);
}
function employeeName(id: string): string { return companyState?.employees.find((employee) => employee.id === id)?.name || id; }
function sourceFileUrl(filePath: string): string | null {
  const company = companyState?.company; if (!company) return null;
  try {
    const repo = new URL(company.repoUrl); if (repo.protocol !== 'https:' || repo.hostname !== 'github.com') return null;
    const parts = filePath.split('/'); if (parts.some((part) => part === '..' || part === '.') || filePath.startsWith('/')) return null;
    const base = repo.pathname.replace(/\/$/, '').replace(/\.git$/, '');
    return `https://github.com${base}/blob/${encodeURIComponent(company.defaultBranch || 'main')}/${parts.map(encodeURIComponent).join('/')}`;
  } catch { return null; }
}
function openExternal(url: string | null): void {
  if (!url) { toast('A repository must be registered first.'); return; } if (!bridge) { nativeUnavailable(); return; }
  void safeTask(async () => { const result = await bridge.openExternal(url); if (!result.ok) throw new Error(result.error || 'This link could not be opened.'); });
}
function renderTeam(): void {
  const grid = $('team-grid'); grid.replaceChildren(); const employees = companyState?.employees || [];
  $('team-summary').textContent = `${employees.length} assigned role${employees.length === 1 ? '' : 's'}`;
  if (!employees.length) { noData(grid, bridge ? 'Team data is unavailable. Check the native workspace in Settings.' : 'Open the desktop app to load the company’s skill-linked team.'); return; }
  for (const employee of employees) {
    const card = textElement('article', '', 'employee-card'); const top = textElement('div', '', 'employee-topline');
    const initials = employee.name.split(/\s+/).map((part) => part[0]).slice(0, 2).join('');
    top.append(textElement('span', initials, 'employee-avatar'), textElement('span', employee.status === 'ready' ? 'Assigned' : employee.status, `badge ${employee.status === 'blocked' ? 'unknown' : 'ok'}`));
    card.append(top, textElement('h2', employee.name), textElement('p', employee.role, 'role-name'), textElement('div', employee.skillPath, 'skill-path'), textElement('p', employee.lastResult || 'Ready for a task with a clear outcome and acceptance criteria.', 'employee-result'));
    const link = actionButton('View skill source ↗'); link.type = 'button'; link.onclick = () => openExternal(sourceFileUrl(employee.skillPath)); card.append(link); grid.append(card);
  }
}
function renderRoadmap(): void {
  const board = $('roadmap-board'); board.replaceChildren(); const tasks = companyState?.tasks || []; const done = tasks.filter((t) => t.status === 'done').length; const progress = $('roadmap-progress'); progress.replaceChildren();
  if (tasks.length) {
    const label = textElement('div', '', 'progress-caption'); label.append(textElement('span', `${done} of ${tasks.length} tasks complete`), textElement('span', `${Math.round(done / tasks.length * 100)}%`));
    const bar = document.createElement('progress'); bar.max = tasks.length; bar.value = done; bar.setAttribute('aria-label', `${done} of ${tasks.length} roadmap tasks complete`); progress.append(label, bar);
  }
  if (!companyState || !companyState.milestones.length) { noData(board, 'The company roadmap will appear when the native workspace loads.'); return; }
  const filter = ($('roadmap-filter') as HTMLSelectElement).value; let visibleTasks = 0;
  for (const milestone of companyState.milestones) {
    const filtered = tasks.filter((task) => task.milestone === milestone.id && (filter === 'all' || task.status === filter));
    if (!filtered.length && filter !== 'all') continue; visibleTasks += filtered.length;
    const column = textElement('section', '', 'milestone-column'); const header = textElement('div', '', 'milestone-heading');
    header.append(textElement('span', `${filtered.length} TASK${filtered.length === 1 ? '' : 'S'}`, 'eyebrow'), textElement('h2', milestone.title), textElement('p', milestone.description)); column.append(header);
    for (const task of filtered) {
      const card = textElement('article', '', 'task-card'); const top = textElement('div', '', 'task-topline'); top.append(textElement('span', task.priority, `priority-${task.priority.toLowerCase()}`), textElement('span', task.id));
      const select = document.createElement('select'); select.setAttribute('aria-label', `Status for ${task.title}`);
      for (const [value,label] of [['todo','To do'], ['in-progress','In progress'], ['blocked','Blocked'], ['done','Done']]) { const option = textElement('option', label || ''); option.value = value || ''; select.append(option); }
      select.value = task.status; select.disabled = !companyState.available || !bridge?.updateCompanyTask;
      const details = document.createElement('details'); details.className = 'task-proof';
      const evidence = document.createElement('textarea'); evidence.rows = 2; evidence.value = task.evidence || ''; evidence.placeholder = 'Commit, test result, or artifact that demonstrates completion'; evidence.setAttribute('aria-label', `Evidence for ${task.title}`);
      details.append(textElement('summary', task.evidence ? 'View completion evidence' : 'Add evidence'), evidence);
      select.onchange = () => {
        if (!bridge?.updateCompanyTask) return; const status = select.value as CompanyTaskStatus;
        if (status === 'done' && !evidence.value.trim()) { select.value = task.status; details.open = true; evidence.focus(); setStatus($('roadmap-status'), 'Add completion evidence, then mark the task Done.', 'error'); return; }
        select.disabled = true;
        void safeTask(async () => { try {
          companyState = await bridge.updateCompanyTask!({ id: task.id, status, evidence: evidence.value.trim() || undefined }); if (companyState.error) throw new Error(companyState.error);
          renderRoadmap(); renderOverview(); renderActivity($('company-activity')); setStatus($('roadmap-status'), 'Task updated.', 'ok');
        } finally { select.disabled = false; } });
      };
      card.append(top, textElement('h3', task.title), textElement('div', employeeName(task.ownerId), 'task-owner'), select, details); column.append(card);
    }
    if (!filtered.length) column.append(textElement('p', 'No tasks in this milestone.', 'empty-inline')); board.append(column);
  }
  if (!visibleTasks && filter !== 'all') noData(board, 'No tasks match this status. Try All work.');
}
function renderActivity(container: HTMLElement, limit = 30): void {
  container.replaceChildren(); const activity = [...(companyState?.activity || [])].sort((a,b) => b.at.localeCompare(a.at)).slice(0, limit);
  if (!activity.length) { noData(container, 'Repository checks and company changes will appear here.'); return; }
  for (const event of activity) {
    const row = textElement('div', '', 'activity-row'); const copy = textElement('div', '', 'activity-copy'); copy.append(textElement('p', event.message), textElement('small', employeeName(event.employeeId)));
    const time = textElement('time', dateLabel(event.at)); time.dateTime = event.at; time.title = dateLabel(event.at, true); row.append(textElement('span', event.kind.includes('error') ? '!' : '✓', 'activity-dot'), copy, time); container.append(row);
  }
}
function svgElement<K extends keyof SVGElementTagNameMap>(tag: K, attributes: Record<string, string | number>): SVGElementTagNameMap[K] {
  const element = document.createElementNS('http://www.w3.org/2000/svg', tag); for (const [key,value] of Object.entries(attributes)) element.setAttribute(key, String(value)); return element;
}
function renderUsage(): void {
  const usage = currentTotals(); $('usage-input').textContent = number(usage.inputTokens); $('usage-output').textContent = number(usage.outputTokens); $('usage-runs').textContent = number(usage.runCount); $('usage-cost').textContent = money(usage.costUsd);
  $('usage-outcomes').textContent = usage.runCount ? `${usage.completedRuns} completed · ${usage.failedRuns} failed` : 'No completed runs yet';
  const tbody = $('usage-table').querySelector('tbody')!; tbody.replaceChildren();
  for (const run of [...workspaceRuns].sort((a,b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 100)) {
    const tr = document.createElement('tr'); const project = workspaceProjects.find((p) => p.id === run.projectId);
    const name = textElement('button', project?.name || run.projectId.slice(0, 12), 'text-button'); name.type = 'button'; name.onclick = () => { navigate('projects'); void safeTask(() => selectProject(run.projectId)); };
    const cell = document.createElement('td'); cell.append(name); tr.append(cell, textElement('td', dateLabel(run.createdAt, true)), textElement('td', run.status), textElement('td', number(run.usage.inputTokens + run.usage.outputTokens)), textElement('td', money(run.usage.costUsd))); tbody.append(tr);
  }
  if (!workspaceRuns.length) { const tr = document.createElement('tr'); const td = textElement('td', 'Your first project run will appear here.', 'empty-inline'); td.colSpan = 5; tr.append(td); tbody.append(tr); }
  renderSpendChart(); renderActivity($('company-activity'));
}
function renderSpendChart(): void {
  const container = $('usage-chart'); container.replaceChildren(); const now = new Date(); now.setHours(0,0,0,0);
  const days = Array.from({ length: 14 }, (_,i) => { const d = new Date(now); d.setDate(d.getDate() - 13 + i); return { date: d, spend: 0 }; });
  for (const run of workspaceRuns) { const date = new Date(run.createdAt); const day = days.find((d) => d.date.toDateString() === date.toDateString()); if (day) day.spend += run.usage.costUsd; }
  const maximum = Math.max(.01, ...days.map((d) => d.spend));
  const svg = svgElement('svg', { viewBox: '0 0 840 220', role: 'img', 'aria-label': 'Daily recorded spending in US dollars, last fourteen days' });
  for (let i = 0; i < 4; i++) {
    const y = 20 + i * 52; svg.append(svgElement('line', { x1: 48, x2: 830, y1: y, y2: y, class: 'chart-grid' }));
    const label = svgElement('text', { x: 2, y: y + 3, class: 'chart-label' }); label.textContent = money(maximum * (1 - i / 3)); svg.append(label);
  }
  days.forEach((day, i) => {
    const x = 57 + i * 55; const h = day.spend / maximum * 156;
    if (h > 0) { const bar = svgElement('rect', { x, y: 176 - h, width: 27, height: Math.max(h, 1), rx: 3, class: 'chart-bar' }); const title = svgElement('title', {}); title.textContent = `${dateLabel(day.date.toISOString())}: ${money(day.spend)}`; bar.append(title); svg.append(bar); }
    if (i % 2 === 0 || i === 13) { const label = svgElement('text', { x: x + 13, y: 205, 'text-anchor': 'middle', class: 'chart-label' }); label.textContent = dateLabel(day.date.toISOString()); svg.append(label); }
  }); container.append(svg);
  if (!days.some((d) => d.spend > 0)) { const empty = textElement('div', '', 'chart-empty'); empty.append(textElement('strong', workspaceRuns.length ? 'No priced usage in this period.' : 'Your first run is the starting point.'), textElement('span', workspaceRuns.length ? 'Recorded costs depend on the price rates you enter.' : 'Spend will appear here when you run a project.')); container.append(empty); }
}
function renderIndex(): void {
  const index = companyState?.index; const list = $('index-files'); list.replaceChildren(); const more = $('index-show-more'); more.classList.add('hidden');
  if (!index) { noData(list, companyState?.available ? 'No index yet. Refresh index to scan the linked repository checkout.' : 'Repository indexing requires the desktop native core.'); return; }
  $('index-summary').textContent = `${number(index.fileCount)} files · ${formatBytes(index.totalBytes)} · ${index.workers} workers · ${Math.round(index.elapsedMs)} ms${index.truncated ? ' · partial inventory' : ''}`;
  const query = ($('index-search') as HTMLInputElement).value.trim().toLowerCase(); const files = index.files.filter((file) => !query || file.path.toLowerCase().includes(query));
  for (const file of files.slice(0,indexVisible)) {
    const row = textElement('div', '', 'file-row'); const path = textElement('button', file.path, 'text-button file-path'); path.type = 'button'; path.onclick = () => openExternal(sourceFileUrl(file.path));
    row.append(path, textElement('span', file.kind), textElement('span', formatBytes(file.bytes))); list.append(row);
  }
  if (!files.length) noData(list, 'No files match this search.');
  if (files.length > indexVisible) { more.classList.remove('hidden'); more.textContent = `Show more · ${number(files.length - indexVisible)} remaining`; }
}
function openNewProject(): void {
  navigate('projects'); ($('new-project-details') as HTMLDetailsElement).open = true; $('new-project-details').scrollIntoView({ behavior: 'auto', block: 'start' }); ($('proj-name') as HTMLInputElement).focus();
}
function initWorkspace(): void {
  document.querySelectorAll<HTMLButtonElement>('[data-view]').forEach((button) => {
    const view = button.dataset.view as ViewName; if (!(view in VIEW_IDS)) return;
    if (button.classList.contains('nav-item')) button.setAttribute('aria-label', VIEW_LABELS[view]); button.addEventListener('click', () => navigate(view));
  });
  $('header-new-project').addEventListener('click', openNewProject); document.querySelectorAll<HTMLButtonElement>('[data-new-project]').forEach((button) => button.addEventListener('click', openNewProject));
  $('workspace-refresh').addEventListener('click', () => void safeTask(refreshWorkspace)); $('usage-refresh').addEventListener('click', () => void safeTask(refreshWorkspace));
  $('focus-action').addEventListener('click', () => {
    if (companyState?.company?.githubStatus !== 'verified') { navigate('settings'); ($('company-repo-url') as HTMLInputElement).focus(); }
    else if (companyState.tasks.some((t) => t.status === 'todo' || t.status === 'in-progress')) navigate('roadmap'); else openNewProject();
  });
  $('open-repository').addEventListener('click', () => openExternal(companyState?.company?.repoUrl || ($('company-repo-url') as HTMLInputElement).value));
  $('roadmap-filter').addEventListener('change', renderRoadmap); $('index-search').addEventListener('input', () => { indexVisible = 100; renderIndex(); }); $('index-show-more').addEventListener('click', () => { indexVisible += 100; renderIndex(); });
  $('company-form').addEventListener('submit', (event) => {
    event.preventDefault(); if (!bridge?.registerCompany) { nativeUnavailable(); return; }
    const button = $('company-register') as HTMLButtonElement; button.disabled = true; setStatus($('company-status'), 'GitHub employee is checking the repository…');
    void safeTask(async () => { try {
      companyState = await bridge.registerCompany!({ repoUrl: ($('company-repo-url') as HTMLInputElement).value.trim() }); renderCompany(); renderOverview(); renderTeam(); renderRoadmap(); renderActivity($('company-activity'));
      if (companyState.error || companyState.company?.githubStatus !== 'verified') setStatus($('company-status'), companyState.error || companyState.company?.githubError || 'Repository verification did not complete.', 'error');
      else { setStatus($('company-status'), 'Repository verified. Your company workspace is ready.', 'ok'); toast('Company registered and verified by the GitHub employee.'); }
    } finally { button.disabled = false; } });
  });
  $('company-refresh').addEventListener('click', () => {
    if (!bridge?.refreshCompany) { nativeUnavailable(); return; } const button = $('company-refresh') as HTMLButtonElement; button.disabled = true; setStatus($('company-status'), 'Checking the latest repository metadata…');
    void safeTask(async () => { try { companyState = await bridge.refreshCompany!(); renderCompany(); renderOverview(); renderActivity($('company-activity')); setStatus($('company-status'), companyState.error || companyState.company?.githubError || 'Repository metadata refreshed.', companyState.error || companyState.company?.githubError ? 'error' : 'ok'); } finally { button.disabled = false; } });
  });
  $('index-repository').addEventListener('click', () => {
    if (!bridge?.indexCompanyRepository) { nativeUnavailable(); return; } const button = $('index-repository') as HTMLButtonElement; button.disabled = true; setStatus($('index-status'), 'Indexing repository metadata…');
    void safeTask(async () => { try { companyState = await bridge.indexCompanyRepository!(); indexVisible = 100; renderIndex(); renderOverview(); setStatus($('index-status'), companyState.error || (companyState.index ? 'Repository inventory refreshed.' : 'No linked checkout is available for indexing.'), companyState.error || !companyState.index ? 'error' : 'ok'); } finally { button.disabled = false; } });
  });
  document.addEventListener('keydown', (event) => {
    const target = event.target as HTMLElement; if (contentMode || event.ctrlKey || event.metaKey || event.altKey || target.isContentEditable || /INPUT|TEXTAREA|SELECT/.test(target.tagName)) return;
    const index = Number(event.key) - 1; if (index >= 0 && index < 9 && /^\d$/.test(event.key)) { event.preventDefault(); navigate((Object.keys(VIEW_IDS) as ViewName[])[index]!); }
  });
  window.addEventListener('hashchange', () => { const view = location.hash.replace('#', '') as ViewName; if (view in VIEW_IDS) navigate(view, false); });
}
// ---------------------------------------------------------------- permanent office control plane
let officeState: OfficeSnapshot | null = null;
let officeSampledAt = '';
let officeWorker: OfficeWorkerStatus | null = null;
let selectedOfficeId = '';
let selectedDepartmentId = '';
let officeTab = 'overview';
let officeRefreshing = false;
let officePoll: ReturnType<typeof setInterval> | null = null;
function officeCompany(): OfficeCompany | undefined { return officeState?.companies.find((c) => c.id === officeState?.activeCompanyId) || officeState?.companies[0]; }
function officeLocation(): OfficeLocation | undefined { return officeState?.offices.find((o) => o.id === selectedOfficeId); }
function scopedEmployees(): OfficeEmployee[] {
  const company = officeCompany();
  return (officeState?.employees || []).filter((e) => e.companyId === null || (e.companyId === company?.id && (!selectedOfficeId || !e.officeId || e.officeId === selectedOfficeId) && (!selectedDepartmentId || !e.departmentId || e.departmentId === selectedDepartmentId)));
}
function scopedJobs(): OfficeJob[] { return (officeState?.jobs || []).filter((j) => j.companyId === officeCompany()?.id && (!selectedOfficeId || j.officeId === selectedOfficeId) && (!selectedDepartmentId || j.departmentId === selectedDepartmentId)); }
function requireOfficeScope(): { companyId: string; officeId: string; departmentId?: string } {
  const company = officeCompany(); if (!company) throw new Error('Create or select a company first.');
  if (!selectedOfficeId) throw new Error('Create or select an office first.');
  return { companyId: company.id, officeId: selectedOfficeId, ...(selectedDepartmentId ? { departmentId: selectedDepartmentId } : {}) };
}
async function refreshOffice(): Promise<void> {
  if (officeRefreshing) return;
  if (!bridge?.officeSnapshot) { $('office-native-status').textContent = 'Desktop required'; noData($('office-employees'), 'Open the desktop app to load your permanent employees.'); return; }
  officeRefreshing = true;
  try {
    const [state, worker] = await Promise.allSettled([bridge.officeSnapshot(), bridge.officeWorkerStatus ? bridge.officeWorkerStatus() : Promise.resolve(null)]);
    if (state.status === 'fulfilled' && state.value.ok && state.value.snapshot) {
      officeState = state.value.snapshot; officeSampledAt = new Date().toISOString(); $('office-native-status').textContent = workspaceReadOnly() ? 'Example workspace · read only' : bridge?.transport==='cloud-browser' ? 'Cloud workspace · desktop projection' : 'Local state loaded'; $('office-native-status').className = 'pill ok';
    } else {
      const error = state.status === 'fulfilled' ? state.value.error : String(state.reason);
      const unloadedHosted=bridge?.transport==='cloud-browser'&&!officeState;
      setStatus($('office-status'), unloadedHosted ? 'Cloud workspace could not be loaded. Open welcome to check sign-in, or refresh to try again.' : error || 'Office state could not be loaded.', 'error'); $('office-native-status').textContent = unloadedHosted ? 'Cloud not loaded' : 'Workspace unavailable'; $('office-native-status').className='pill neutral';
    }
    if (worker.status === 'fulfilled') officeWorker = worker.value;
    renderOffice();
  } finally { officeRefreshing = false; }
}
async function performOffice(command: OfficeCommand, success = 'Workspace updated.'): Promise<void> {
  if (!bridge?.officeCommand) { nativeUnavailable(); return; }
  const result = await bridge.officeCommand(command);
  if (!result.ok || !result.snapshot) throw new Error(result.error || 'The workspace change could not be saved.');
  officeState = appliedOfficeSnapshot(result); renderOffice(); setStatus($('office-status'), success, 'ok');
}
function populateSelect(select: HTMLSelectElement, rows: Array<{ id:string; name:string }>, value: string, empty?: string): void {
  select.replaceChildren();
  if (empty) { const option = textElement('option', empty); option.value = ''; select.append(option); }
  for (const row of rows) { const option = textElement('option', row.name); option.value = row.id; select.append(option); }
  select.value = value;
  if (!select.value && !empty && rows[0]) select.value = rows[0].id;
}
function renderOfficeScope(): void {
  if (!officeState) return;
  const company = officeCompany(); const query = ($('office-company-search') as HTMLInputElement).value.trim().toLowerCase();
  const companies = officeState.companies.filter((c) => c.id === company?.id || !query || `${c.name} ${c.repoUrl || ''}`.toLowerCase().includes(query)).slice(0,2000);
  populateSelect($('office-company-select') as HTMLSelectElement, companies, company?.id || '');
  const offices = officeState.offices.filter((o) => o.companyId === company?.id);
  if (!offices.some((o) => o.id === selectedOfficeId)) selectedOfficeId = offices[0]?.id || '';
  populateSelect($('office-office-select') as HTMLSelectElement, offices, selectedOfficeId, offices.length ? undefined : 'Create an office');
  const departments = officeState.departments.filter((d) => d.officeId === selectedOfficeId);
  if (!departments.some((d) => d.id === selectedDepartmentId)) selectedDepartmentId = '';
  populateSelect($('office-department-select') as HTMLSelectElement, departments, selectedDepartmentId, 'All departments');
  if(company){$('sidebar-company').textContent=company.name;$('sidebar-company').title=company.name;}
  const scope = officeLocation();
  $('office-scope-summary').textContent = company ? `${company.name}${scope ? ` / ${scope.name}` : ' · No office selected'}${selectedDepartmentId ? ` / ${departments.find((d) => d.id === selectedDepartmentId)?.name || ''}` : ''}` : 'Create a company to organize your employees.';
  $('office-scope-state').textContent = company?.status || 'No company';
  $('office-scope-state').className = `pill ${company?.status === 'active' ? 'ok' : 'neutral'}`;
  ($('office-pause-company') as HTMLButtonElement).disabled = !company;
  $('office-pause-company').textContent = company?.status === 'paused' ? 'Resume company' : 'Pause company';
  ($('office-pause-office') as HTMLButtonElement).disabled = !scope;
  $('office-pause-office').textContent = scope?.status === 'paused' ? 'Resume office' : 'Pause office';
  const current = ($('queue-employee') as HTMLSelectElement).value;
  const contracts=scopedServiceContracts();const contractSelect=$('queue-service-contract') as HTMLSelectElement;populateSelect(contractSelect,contracts.map(contract=>({id:contract.id,name:portfolioState()?.services.find(service=>service.id===contract.serviceId)?.name||'Shared service'})),contractSelect.value,'Company employees');const selectedContract=contracts.find(contract=>contract.id===contractSelect.value);
  const employees = (selectedContract?(officeState?.employees||[]).filter(employee=>selectedContract.employeeIds.includes(employee.id)):scopedEmployees()).filter((e) => e.status === 'active');
  populateSelect($('queue-employee') as HTMLSelectElement, employees, current || employees.find((e) => e.id === 'donna')?.id || employees[0]?.id || '');
}
function renderWorker(): void {
  const status = officeWorker;
  $('worker-status').textContent = !status ? 'Unavailable' : status.running ? 'Processing a job' : status.enabled ? 'Dispatcher enabled' : 'Dispatcher off';
  $('worker-status').className = `pill ${status?.enabled || status?.running ? 'ok' : 'neutral'}`;
  $('worker-detail').textContent = status?.activeJobId ? `Active job: ${status.activeJobId}. Stopping dispatch prevents the next job from starting.` : 'Dispatch is opt-in. Due schedules are processed while this desktop app is open.';
  ($('worker-enable') as HTMLButtonElement).disabled = !bridge?.setOfficeWorker || status?.enabled === true;
  ($('worker-disable') as HTMLButtonElement).disabled = !bridge?.setOfficeWorker || !status?.enabled;
  ($('worker-run-once') as HTMLButtonElement).disabled = !bridge?.runOfficeQueue || status?.running === true;
  if(status?.concurrency)$('worker-detail').textContent=`${status.concurrency} worker slots · ${status.activeJobIds?.length||(status.running?1:0)} active. Global reservations and company scopes bound dispatch. Schedules need the app to stay open.`;
  if (status?.lastError) setStatus($('worker-result'), status.lastError, 'error');
}
function renderOffice(): void {
  renderOfficeScope(); renderWorker(); renderUnifiedWorkspace(); if (!officeState) return;
  const employees = scopedEmployees(); const jobs = scopedJobs();
  $('office-active-employees').textContent = number(employees.filter((e) => e.status === 'active').length);
  $('office-queued-jobs').textContent = number(jobs.filter((j) => j.status === 'queued' || j.status === 'waiting-budget').length);
  $('office-running-jobs').textContent = number(jobs.filter((j) => j.status === 'running').length);
  $('office-completed-jobs').textContent = number(jobs.filter((j) => j.status === 'completed').length);
  renderOfficeEmployees(); renderOfficeJobs(); renderOfficeSchedules(); renderOfficeMemory(); renderOfficeEvents($('office-recent-events'), 5); renderOfficeEvents($('office-ledger'), 150);
  $('office-event-count').textContent = `${number(officeState.events.length)} events`;
  if(workspaceReadOnly()) document.querySelectorAll<HTMLButtonElement>('#office-view form button[type="submit"], #worker-enable, #worker-disable, #worker-run-once, #office-clear-cache, #office-pause-company, #office-pause-office').forEach(button=>button.disabled=true);
}
function officeActionButton(label: string, command: OfficeCommand, className = 'secondary'): HTMLButtonElement {
  const button = textElement('button', label, className); button.type = 'button';
  button.disabled=workspaceReadOnly();
  button.onclick = () => { button.disabled = true; void safeTask(async () => { try { await performOffice(command); } finally { button.disabled = false; } }); }; return button;
}
function renderOfficeEmployees(): void {
  const container = $('office-employees'); container.replaceChildren();
  for (const employee of scopedEmployees().slice(0,300)) {
    const card = textElement('article', '', 'employee-card');
    const head = textElement('div', '', 'employee-topline');
    head.append(textElement('span', employee.name.split(/\s+/).map((p) => p[0]).slice(0,2).join(''), 'employee-avatar'), textElement('span', employee.id === 'donna' ? 'Permanent' : employee.status, `badge ${employee.status === 'active' ? 'ok' : 'unknown'}`));
    card.append(head, textElement('h2', employee.name), textElement('p', employee.role, 'role-name'));
    const scope = employee.companyId === null ? 'Shared across all companies' : employee.departmentId ? 'Department employee' : employee.officeId ? 'Office employee' : 'Company assistant';
    card.append(textElement('p', `${employee.kind === 'assistant' ? 'Assistant' : 'Specialist'} · ${scope}`, 'employee-scope'));
    if (employee.skillPaths.length) card.append(textElement('div', employee.skillPaths.join('\n'), 'skill-path'));
    const actions = textElement('div', '', 'employee-actions');
    if (employee.id === 'donna') actions.append(textElement('span', 'Donna stays available as the CEO assistant.', 'form-help'));
    else if (employee.status !== 'fired') {
      actions.append(officeActionButton(employee.status === 'paused' ? 'Resume' : 'Pause', { action: employee.status === 'paused' ? 'resume_employee' : 'pause_employee', employeeId: employee.id }));
      const retire = officeActionButton('Fire employee', { action: 'fire_employee', employeeId: employee.id }, 'danger');
      retire.title = 'End the assignment. Historical work remains in the ledger.'; actions.append(retire);
    } else actions.append(textElement('span', 'Assignment ended. History is retained.', 'form-help'));
    card.append(actions); container.append(card);
  }
  if (!container.children.length) noData(container, 'No employees in this scope. Hire a specialist below.');
}
function renderOfficeJobs(): void {
  const container = $('office-jobs'); container.replaceChildren(); const filter = ($('office-queue-filter') as HTMLSelectElement).value;
  const jobs = scopedJobs().filter((j) => filter === 'all' || j.status === filter).sort((a,b) => b.createdAt.localeCompare(a.createdAt)).slice(0,100);
  for (const job of jobs) {
    const card = textElement('article', '', 'queue-job'); const top = textElement('div', '', 'section-heading');
    top.append(textElement('span', officeState?.employees.find((e) => e.id === job.employeeId)?.name || job.employeeId, 'eyebrow'), textElement('span', job.status.replaceAll('-', ' '), `badge ${job.status === 'completed' ? 'ok' : job.status === 'failed' || job.status === 'budget-exhausted' ? 'fail' : 'unknown'}`));
    const meta = textElement('div', '', 'queue-meta'); meta.append(textElement('span', job.mode === 'provider' ? `${job.provider} · ${job.model}` : 'Manual · no model call'), textElement('span', `${number(job.usage.inputTokens + job.usage.outputTokens)} tokens · ${money(job.usage.costUsd)}${job.costStatus && job.costStatus !== 'none' ? ` (${job.costStatus})` : ''}`), textElement('span', dateLabel(job.createdAt,true)));
    card.append(top, textElement('h3', job.goal), meta);
    if (job.error) card.append(textElement('p', job.error, 'status error'));
    if (job.summary) card.append(textElement('p', job.summary, 'muted'));
    if (job.artifactUri) card.append(textElement('p', job.artifactUri, 'queue-artifact'));
    const actions = textElement('div', '', 'queue-actions');
    if (job.status === 'queued' || job.status === 'running' || job.status === 'waiting-budget') actions.append(officeActionButton('Pause', { action:'pause_job', jobId:job.id }));
    if (job.status === 'paused') actions.append(officeActionButton('Resume', { action:'resume_job', jobId:job.id }));
    if (['queued','waiting-budget','running','paused'].includes(job.status)) actions.append(officeActionButton('Cancel', { action:'cancel_job', jobId:job.id }, 'danger'));
    if(job.mode === 'provider' && !job.authorized && !job.startedAt && ['queued','waiting-budget','needs-review'].includes(job.status)) actions.append(officeActionButton('Approve job',{action:'approve_job',jobId:job.id}));
    if(job.status === 'waiting-budget') actions.append(textElement('span','Global capacity is committed. This job is retained and will wait for available budget.','form-help'));
    if (job.mode === 'manual' && job.status === 'queued') actions.append(textElement('span', 'Manual task stays in the queue for human review; provider dispatch skips it.', 'form-help'));
    if (actions.children.length) card.append(actions); container.append(card);
  }
  if (!jobs.length) noData(container, 'No matching jobs. Add a task below to begin.');
}
function renderOfficeSchedules(): void {
  const container = $('office-schedules'); container.replaceChildren();
  const schedules = officeState?.schedules.filter((s) => s.companyId === officeCompany()?.id) || [];
  for (const schedule of schedules.slice(0,100)) {
    const card = textElement('article', '', 'queue-job'); const head = textElement('div', '', 'section-heading');
    head.append(textElement('h3', schedule.name), textElement('span', schedule.enabled ? 'Scheduled' : 'Paused / finished', `badge ${schedule.enabled ? 'ok' : 'unknown'}`));
    card.append(head, textElement('p', `${dateLabel(schedule.nextRunAt,true)} · ${schedule.everyMinutes ? `Every ${schedule.everyMinutes} minutes` : 'Once'}`, 'muted'), officeActionButton(schedule.enabled ? 'Pause schedule' : 'Resume schedule', { action: schedule.enabled ? 'pause_schedule' : 'resume_schedule', scheduleId:schedule.id })); container.append(card);
  }
  if (!schedules.length) noData(container, 'No schedules for this company.');
}
/** Mirror the worker's metadata classifier; never remove persisted records. */
function isInternalKitKnowledge(note: OfficeKnowledge): boolean {
  let tagged = false;
  if (new TextEncoder().encode(note.summary).length <= 4000) {
    try { const value: unknown = JSON.parse(note.summary); tagged = Boolean(value && typeof value === 'object' && !Array.isArray(value) && (value as Record<string, unknown>).kind === 'daftar-company-kit-binding'); } catch { /* ordinary source prose */ }
  }
  return tagged || (typeof note.artifactUri === 'string' && /^daftar-kit:/i.test(note.artifactUri))
    || note.title.startsWith('Company kit identity:') || /"kind"\s*:\s*"daftar-company-kit-binding"/.test(note.summary);
}
function knowledgeSourceUrls(note: OfficeKnowledge): string[] {
  const candidates = [note.artifactUri, ...(note.summary.match(/https:\/\/[^\s<>"'`]+/gi) || [])];
  const urls = new Set<string>();
  for (const candidate of candidates) {
    if (typeof candidate !== 'string' || candidate.length > 3000) continue;
    let reference = candidate.trim().replace(/[.,;!?]+$/, '');
    // Prose and Markdown commonly wrap a URL in brackets. Preserve balanced
    // parentheses within genuine URLs while removing unmatched closing marks.
    for (const [open, close] of [['(', ')'], ['[', ']'], ['{', '}']]) {
      while (reference.endsWith(close!) && reference.split(close!).length > reference.split(open!).length) reference = reference.slice(0, -1).replace(/[.,;!?]+$/, '');
    }
    try {
      const url = new URL(reference);
      let secretParameter = false;
      for (const parameters of [url.searchParams, new URLSearchParams(url.hash.slice(1))]) {
        parameters.forEach((_value, key) => { if (/token|secret|password|api[-_]?key/i.test(key)) secretParameter = true; });
      }
      if (url.protocol === 'https:' && !url.username && !url.password && !secretParameter) urls.add(url.href);
    } catch { /* local references and malformed URLs remain plain text */ }
    if (urls.size === 8) break;
  }
  return [...urls];
}
function renderOfficeMemory(): void {
  if (!officeState) return; const entries = officeState.cache.entries.filter((e) => e.companyId === officeCompany()?.id);
  $('cache-entries').textContent = number(entries.length); $('cache-size').textContent = formatBytes(entries.reduce((total,e) => total + e.bytes,0)); $('cache-hits').textContent = number(officeState.cache.hits); $('cache-misses').textContent = number(officeState.cache.misses);
  if (!($('office-cache-form').contains(document.activeElement))) {
    ($('cache-enabled') as HTMLInputElement).checked = officeState.cache.enabled; ($('cache-max-entries') as HTMLInputElement).value = String(officeState.cache.maxEntries); ($('cache-ttl') as HTMLInputElement).value = String(officeState.cache.ttlMinutes);
  }
  const container = $('office-knowledge'); container.replaceChildren();
  for (const note of officeState.knowledge.filter((k) => k.companyId === officeCompany()?.id && !isInternalKitKnowledge(k)).slice(-100).reverse()) {
    const item = textElement('article', '', 'knowledge-note'); item.append(textElement('h3', note.title), textElement('p', note.summary), textElement('small', dateLabel(note.createdAt,true)));
    if (note.artifactUri) item.append(textElement('div', note.artifactUri, 'queue-artifact'));
    const urls = knowledgeSourceUrls(note);
    if (urls.length) {
      const links = textElement('div', '', 'queue-actions');
      for (const url of urls) {
        const link = textElement('button', `Open source · ${new URL(url).hostname}`, 'secondary small'); link.type = 'button'; link.title = url;
        link.setAttribute('aria-label', `Open source for ${note.title}: ${url}`); link.onclick = () => openExternal(url); links.append(link);
      }
      item.append(links);
    }
    container.append(item);
  }
  if (!container.children.length) noData(container, 'No reviewed knowledge notes for this company yet.');
}
function renderOfficeEvents(container: HTMLElement, limit: number): void {
  container.replaceChildren(); const query = ($('office-ledger-search') as HTMLInputElement).value.trim().toLowerCase();
  const rows = [...(officeState?.events || [])].filter((e) => container.id !== 'office-ledger' || !query || `${e.action} ${e.summary} ${e.actor} ${e.entityId}`.toLowerCase().includes(query)).sort((a,b) => b.at.localeCompare(a.at)).slice(0,limit);
  for (const event of rows) {
    const row = textElement('div', '', 'activity-row'); const copy = textElement('div', '', 'activity-copy'); copy.append(textElement('p', event.summary), textElement('small', `${event.actor} · ${event.action} · ${event.entityId}`));
    const time = textElement('time', dateLabel(event.at,true)); time.dateTime = event.at; row.append(textElement('span', '·', 'activity-dot'),copy,time); container.append(row);
  }
  if (!rows.length) noData(container,'No events match this view.');
}
function switchOfficeTab(name: string): void {
  officeTab = name; ($('office-tools') as HTMLDetailsElement).open = true;
  document.querySelectorAll<HTMLButtonElement>('[data-office-tab]').forEach((button) => { const selected = button.dataset.officeTab === name; button.classList.toggle('active', selected); button.setAttribute('aria-selected',String(selected)); button.tabIndex = selected ? 0 : -1; });
  document.querySelectorAll<HTMLElement>('.office-tab-panel').forEach((panel) => panel.classList.toggle('hidden',panel.id !== `office-panel-${name}`));
}
function value(id:string):string { return ($(id) as HTMLInputElement).value.trim(); }
function officeQueueDraft(): Record<string,unknown> {
  const scope = requireOfficeScope(); const goal = value('queue-goal'); if (!goal) throw new Error('Write a task goal first.');
  const employeeId = value('queue-employee'); if (!employeeId) throw new Error('Choose an active employee.');
  const mode = value('queue-mode'); const provider = value('queue-provider'); const model = value('queue-model');
  const priceRates = { inputUsdPerMillion:Number(value('queue-rate-input')), outputUsdPerMillion:Number(value('queue-rate-output')) };
  const authorized = ($('queue-authorized') as HTMLInputElement).checked || officeState?.policy?.approvalMode === 'autonomous';
  if (mode === 'provider' && !authorized) throw new Error('Authorize this provider job before adding it to the queue.');
  if (mode === 'provider' && !model) throw new Error('Enter a model ID for the provider job.');
  if (mode === 'provider' && provider !== 'ollama' && (priceRates.inputUsdPerMillion <= 0 || priceRates.outputUsdPerMillion <= 0)) throw new Error('Positive input and output pricing is required for cloud-provider jobs.');
  const limits = { maxTokens:Number(value('queue-max-tokens')), maxUsd:Number(value('queue-max-usd')), maxMinutes:Number(value('queue-max-minutes')) };
  if (Object.values(limits).some((n) => !Number.isFinite(n) || n <= 0) || limits.maxUsd > 100) throw new Error('Use positive budget limits with a maximum of $100 per queued job.');
  return { ...scope,employeeId,goal,mode,provider,model,...(value('queue-service-contract')?{serviceContractId:value('queue-service-contract')}:{}),authorized:mode === 'provider' && authorized,priceRates,...limits,idempotencyKey:crypto.randomUUID() };
}
function bindOfficeForm(id:string, callback:()=>Promise<void>): void {
  $(id).addEventListener('submit',(event) => {
    event.preventDefault(); const button = (event as SubmitEvent).submitter as HTMLButtonElement | null;
    if (button) button.disabled = true;
    void safeTask(async () => { try { await callback(); } finally { if (button) button.disabled = false; } });
  });
}
function initOffice(): void {
  $('office-refresh').addEventListener('click',() => void safeTask(refreshOffice));
  document.querySelectorAll<HTMLButtonElement>('[data-office-tab]').forEach((button) => {
    button.onclick = () => switchOfficeTab(button.dataset.officeTab || 'overview');
    button.addEventListener('keydown',(event) => {
      const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-office-tab]')); const i = buttons.indexOf(button);
      if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') { event.preventDefault(); const next = buttons[(i + (event.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length]!; next.click(); next.focus(); }
    });
  });
  document.querySelectorAll<HTMLButtonElement>('[data-open-office-tab]').forEach((button) => button.onclick = () => switchOfficeTab(button.dataset.openOfficeTab || 'overview'));
  $('office-company-search').addEventListener('input',renderOfficeScope);
  $('office-company-select').addEventListener('change',() => {
    const companyId=value('office-company-select');if(!companyId)return;
    void ffTransitionScope({kind:'company',companyId},null);
  });
  $('office-office-select').addEventListener('change',() => {
    const companyId=officeCompany()?.id;const officeId=value('office-office-select');
    if(!companyId||!officeId){selectedOfficeId=officeId;selectedDepartmentId='';renderOffice();return;}
    void ffTransitionScope({kind:'office',companyId,officeId},null);
  });
  $('office-department-select').addEventListener('change',() => {
    const companyId=officeCompany()?.id;const departmentId=value('office-department-select');const officeId=selectedOfficeId;
    if(!companyId||!officeId){selectedDepartmentId=departmentId;renderOffice();return;}
    void ffTransitionScope(departmentId?{kind:'department',companyId,officeId,departmentId}:{kind:'office',companyId,officeId},null);
  });
  $('office-queue-filter').addEventListener('change',renderOfficeJobs); $('office-ledger-search').addEventListener('input',() => renderOfficeEvents($('office-ledger'),150));
  $('queue-mode').addEventListener('change',() => $('queue-provider-fields').classList.toggle('hidden',value('queue-mode') !== 'provider'));

  $('office-pause-company').addEventListener('click',() => { const company=officeCompany(); if(company) void safeTask(() => performOffice({action:company.status === 'paused' ? 'resume_company':'pause_company',companyId:company.id})); });
  $('office-pause-office').addEventListener('click',() => { const office=officeLocation(); if(office) void safeTask(() => performOffice({action:office.status === 'paused' ? 'resume_office':'pause_office',officeId:office.id})); });
  bindOfficeForm('office-create-company',async () => { await performOffice({action:'create_company',name:value('office-new-company-name'),repoUrl:value('office-new-company-repo') || undefined},'Company and shared assistant created.'); ($('office-create-company') as HTMLFormElement).reset(); });
  bindOfficeForm('office-create-office',async () => { const company=officeCompany(); if(!company) throw new Error('Select a company first.'); await performOffice({action:'create_office',companyId:company.id,name:value('office-new-office-name')},'Office and shared assistant created.'); ($('office-create-office') as HTMLFormElement).reset(); });
  bindOfficeForm('office-create-department',async () => { const scope=requireOfficeScope(); await performOffice({action:'create_department',officeId:scope.officeId,name:value('office-new-department-name')},'Department and shared assistant created.'); ($('office-create-department') as HTMLFormElement).reset(); });
  bindOfficeForm('office-hire-form',async () => { await performOffice({action:'hire_employee',...requireOfficeScope(),name:value('hire-name'),role:value('hire-role'),skillPaths:value('hire-skills').split('\n').map((s)=>s.trim()).filter(Boolean)},'Specialist hired.'); ($('office-hire-form') as HTMLFormElement).reset(); });
  bindOfficeForm('office-queue-form',async () => { await performOffice({action:'enqueue_job',...officeQueueDraft()},'Task queued. It will run only when dispatched.'); });
  bindOfficeForm('office-schedule-form',async () => {
    const jobTemplate=officeQueueDraft(); const date=new Date(value('schedule-at')); if(Number.isNaN(date.getTime()) || date.getTime() <= Date.now()) throw new Error('Choose a future first-run time.');
    await performOffice({action:'create_schedule',companyId:officeCompany()!.id,name:String(jobTemplate.goal).slice(0,100),everyMinutes:Number(value('schedule-repeat')),nextRunAt:date.toISOString(),jobTemplate},'Schedule saved. Local schedules need the desktop app to stay open.'); setStatus($('schedule-status'),'Schedule saved.','ok');
  });
  bindOfficeForm('office-cache-form',async () => { await performOffice({action:'configure_cache',enabled:($('cache-enabled') as HTMLInputElement).checked,maxEntries:Number(value('cache-max-entries')),ttlMinutes:Number(value('cache-ttl'))},'Cache policy saved.'); });
  $('office-clear-cache').addEventListener('click',() => void safeTask(async () => { const company=officeCompany(); if(!company) throw new Error('Select a company first.'); await performOffice({action:'clear_cache',companyId:company.id},'Selected company cache cleared.'); }));
  bindOfficeForm('office-knowledge-form',async () => { const company=officeCompany(); if(!company) throw new Error('Select a company first.'); await performOffice({action:'add_knowledge',companyId:company.id,title:value('knowledge-title'),summary:value('knowledge-summary'),artifactUri:value('knowledge-artifact')},'Knowledge note saved.'); ($('office-knowledge-form') as HTMLFormElement).reset(); });
  bindOfficeForm('office-import-form',async () => {
    if(!bridge?.officeCommand) throw new Error('Public GitHub import is unavailable in this desktop build.');
    setStatus($('office-import-status'),'Reading public repositories from GitHub…'); const previous=officeState?.companies.length || 0;
    const result=await bridge.officeCommand({action:'import_github_account',owner:value('office-github-owner'),includePrivate:($('office-import-private') as HTMLInputElement).checked}); if(!result.ok || !result.snapshot) throw new Error(result.error || 'Repository import failed.'); officeState=appliedOfficeSnapshot(result); renderOffice();
    setStatus($('office-import-status'),`${number(officeState.companies.length)} companies in the workspace · ${number(Math.max(0,officeState.companies.length-previous))} added. Existing repositories were kept.`,'ok');
  });
  for(const [id,enabled] of [['worker-enable',true],['worker-disable',false]] as const) $(id).addEventListener('click',() => void safeTask(async () => {
    if(!bridge?.setOfficeWorker) throw new Error('The dispatcher is unavailable in this build.'); officeWorker=await bridge.setOfficeWorker({enabled}); renderWorker(); setStatus($('worker-result'),enabled ? 'Dispatcher enabled. Authorized due jobs can now run.' : 'Dispatcher stopped. New jobs will remain queued.','ok');
  }));
  $('worker-run-once').addEventListener('click',() => void safeTask(async () => {
    if(!bridge?.runOfficeQueue) throw new Error('The dispatcher is unavailable in this build.'); const button=$('worker-run-once') as HTMLButtonElement; button.disabled=true;
    try { officeWorker=await bridge.runOfficeQueue(); renderWorker(); await refreshOffice(); } finally { button.disabled=officeWorker?.running === true; }
  }));
  officePoll=setInterval(() => { if(activeView === 'office' && !document.hidden && officeWorker?.enabled) void safeTask(refreshOffice); },5000);
  window.addEventListener('beforeunload',() => { if(officePoll) clearInterval(officePoll); });
}


// ---------------------------------------------------------------- unified Donna conversation and spatial workspace
let workspaceTab = 'chat';
let selectedGoalId = '';
let selectedRoomId = '';
let roomDraftDirty = false;
let selectedBoardId = '';
let selectedDeskEmployeeId = '';
let conversationSignature = '';
let blueprintLoading = false;
let spatialSaving = false;
let spatialOfficeId = '';

function workspaceReadOnly(): boolean { return bridge?.transport === 'public-preview'; }
function workspaceAvailable(): boolean {
  return Boolean(officeState?.policy && officeState.chatThreads && officeState.goals && officeState.blueprints);
}
function currentBlueprint(): OfficeBlueprint | undefined {
  return officeState?.blueprints?.find((item) => item.officeId === selectedOfficeId && item.companyId === officeCompany()?.id);
}
function workspaceScope(): OfficeScope {
  const kind = value('chat-scope') as OfficeScope['kind'];
  if (kind === 'employee') { const id = value('chat-employee'); if (!id) throw new Error('Choose an employee for this conversation.'); return {kind,id}; }
  if (kind === 'department') { if (!selectedDepartmentId) throw new Error('Select a department above for this conversation.'); return {kind,id:selectedDepartmentId}; }
  if (kind === 'office') { if (!selectedOfficeId) throw new Error('Select an office above for this conversation.'); return {kind,id:selectedOfficeId}; }
  const company = officeCompany(); if (!company) throw new Error('Select a company first.'); return {kind:'company',id:company.id};
}
function workspaceScopeOrNull(): OfficeScope | null { try { return workspaceScope(); } catch { return null; } }
function scopeLabel(scope: OfficeScope | null): string {
  if (!scope) return 'Select a company and conversation scope';
  const list = scope.kind === 'company' ? officeState?.companies : scope.kind === 'office' ? officeState?.offices : scope.kind === 'department' ? officeState?.departments : officeState?.employees;
  return `${list?.find((item) => item.id === scope.id)?.name || scope.id} · ${scope.kind}`;
}
function scopedGoals(): OfficeGoal[] {
  const companyId = officeCompany()?.id;
  const scope = workspaceScopeOrNull();
  return (officeState?.goals || []).filter((goal) => {
    if (goal.companyId !== companyId) return false;
    if (!scope || scope.kind === 'company') return true;
    if (goal.scope.kind === scope.kind && goal.scope.id === scope.id) return true;
    if (scope.kind === 'employee') return goal.steps.some((step) => step.employeeId === scope.id);
    if (scope.kind === 'office' && goal.scope.kind === 'department') return officeState?.departments.some((d) => d.id === goal.scope.id && d.officeId === scope.id);
    if (goal.scope.kind === 'employee') { const e = officeState?.employees.find((item) => item.id === goal.scope.id); return scope.kind === 'office' ? e?.officeId === scope.id : e?.departmentId === scope.id; }
    return false;
  });
}
async function workspaceCommand(command: OfficeCommand, message = 'Workspace saved.'): Promise<OfficeSnapshot> {
  if (workspaceReadOnly()) throw new Error('The starter office preview is read only. Open your private desktop or browser workspace to save changes.');
  if (!bridge?.officeCommand || !workspaceAvailable()) throw new Error('This action needs the current desktop workspace and native core.');
  const result = await bridge.officeCommand(command);
  if (!result.ok || !result.snapshot) throw new Error(result.error || 'The workspace change could not be saved.');
  officeState = appliedOfficeSnapshot(result); renderOffice(); setStatus($('workspace-action-status'), message, 'ok');
  return result.snapshot;
}
function workspaceTask(task: () => Promise<void>, statusId = 'workspace-action-status'): void {
  void task().catch((error: unknown) => setStatus($(statusId), error instanceof Error ? error.message : String(error), error instanceof QueuedWorkspaceCommand ? '' : 'error'));
}
function workspaceForm(id: string, task: () => Promise<void>, statusId: string): void {
  $(id).addEventListener('submit', (event) => {
    event.preventDefault(); const button = (event as SubmitEvent).submitter as HTMLButtonElement | null;
    if (button) button.disabled = true;
    workspaceTask(async () => { try { await task(); } finally { if (button) button.disabled = !workspaceAvailable() || workspaceReadOnly(); } },statusId);
  });
}
function workspaceButton(label: string, task: () => Promise<void>, kind = 'secondary small'): HTMLButtonElement {
  const button = textElement('button',label,kind); button.type = 'button';
  button.disabled=workspaceReadOnly();
  button.onclick = () => { button.disabled = true; workspaceTask(async () => { try { await task(); } finally { button.disabled = false; } }); };
  return button;
}
function renderWorkspaceControls(): void {
  const oldEmployee = value('chat-employee');
  const employees = scopedEmployees().filter((item) => item.status === 'active');
  populateSelect($('chat-employee') as HTMLSelectElement,employees,oldEmployee || 'donna');
  const scope = workspaceScopeOrNull(); const employee = officeState?.employees.find((item) => item.id === value('chat-employee'));
  $('conversation-title').textContent = bridge?.transport === 'cloud-browser' ? 'Donna · cloud' : value('chat-scope') === 'employee' ? employee?.name || 'Donna' : 'Donna';
  $('conversation-scope').textContent = scopeLabel(scope);
  const available = workspaceAvailable() && !workspaceReadOnly();
  for (const id of ['chat-send','room-save','node-save']) ($(id) as HTMLButtonElement).disabled = !available;
  const policySubmit = $('workspace-policy-form').querySelector<HTMLButtonElement>('button[type="submit"]'); if (policySubmit) policySubmit.disabled = !available;
  if (!available) {
    $('workspace-budget-label').textContent = !bridge ? 'Desktop workspace required' : !officeState ? 'Budget not loaded' : 'Workspace upgrade required';
    $('chat-mode-note').textContent = bridge?.transport==='cloud-browser'&&!officeState ? 'Load your cloud workspace from welcome before starting a conversation.' : bridge ? (workspaceReadOnly() ? 'Example workspace · read only. Open your private workspace to save a goal.' : 'Load the current native workspace to save goals and conversations.') : 'This preview shows the workspace. Open the desktop app to save a goal.';
  } else updateChatMode();
}
function renderConversation(): void {
  const scope = workspaceScopeOrNull();
  const thread = officeState?.chatThreads?.find((item) => item.scope.kind === scope?.kind && item.scope.id === scope.id);
  const goals = scopedGoals();
  const checkpoints = (officeState?.checkpoints || []).filter((item) => item.jobId === null && goals.some((goal) => goal.id === item.goalId));
  const rows: Array<{id:string;role:string;content:string;createdAt:string;source:string;artifactUri?:string|null}> = [...(thread?.messages || []), ...checkpoints.map((item) => ({id:`checkpoint-${item.id}`,role:'checkpoint',content:item.summary,createdAt:item.createdAt,source:'checkpoint',artifactUri:item.artifactUri}))].sort((a,b) => a.createdAt.localeCompare(b.createdAt)).slice(-120);
  const signature = JSON.stringify({scope,rows}); if (signature === conversationSignature) return; conversationSignature = signature;
  const container = $('conversation-messages');
  if (!rows.length) {
    if (!container.querySelector('.conversation-empty')) {
      container.replaceChildren(); const empty = textElement('div','','conversation-empty');
      empty.append(textElement('span','START WITH AN OUTCOME','eyebrow'),textElement('h2','A shared place to think, plan, and do.'),textElement('p','Give Donna a clear goal. The saved plan and its results will stay connected to the people responsible.'));
      container.append(empty);
    }
    return;
  }
  const nearBottom = container.scrollHeight - container.clientHeight - container.scrollTop < 90;
  container.replaceChildren();
  for (const message of rows) {
    const article = textElement('article','',`chat-message ${message.role === 'user' ? 'user' : 'assistant'}`);
    const header = textElement('div','','chat-message-header');
    const speaker = message.role === 'user' ? 'You' : message.role === 'checkpoint' ? 'Saved checkpoint' : (message.source === 'provider' || message.source === 'cloud') ? 'Provider result' : 'Donna';
    const source = message.source === 'user' ? 'Saved brief' : message.source === 'provider' ? 'Provider output' : message.source === 'checkpoint' ? 'Recorded evidence' : message.source === 'cloud' ? 'Synced from website' : 'Local planning';
    const time = textElement('time',dateLabel(message.createdAt,true)); time.dateTime = message.createdAt;
    header.append(textElement('strong',speaker),textElement('span',source,'badge'),time);
    article.append(header,textElement('p',message.content,'chat-message-text'));
    if (message.artifactUri) article.append(textElement('div',message.artifactUri,'queue-artifact'));
    container.append(article);
  }
  if (nearBottom) container.scrollTop = container.scrollHeight;
}
function renderWorkspaceGoals(): void {
  const container = $('workspace-goals'); if(container.contains(document.activeElement)&&document.activeElement?.matches('input,textarea'))return;container.replaceChildren(); const goals = scopedGoals().slice(-40).reverse();
  $('workspace-goal-count').textContent = number(goals.length);
  if (!goals.some((goal) => goal.id === selectedGoalId)) selectedGoalId = goals[0]?.id || '';
  for (const goal of goals) {
    const card = textElement('article','',`goal-card${goal.id === selectedGoalId ? ' selected' : ''}`); card.dataset.goalId = goal.id;
    const goalJobs=(officeState?.jobs||[]).filter(job=>goal.jobIds.includes(job.id));
    const goalStatus=goal.status==='running'?(goalJobs.some(job=>job.status==='running')?'Executing':goalJobs.some(job=>job.status==='waiting-budget')?'Waiting for budget':'Work queued'):goal.status.replaceAll('-',' ');
    const head = textElement('div','','row wrap'); head.append(textElement('span',goalStatus,`badge ${goal.status === 'completed' ? 'ok' : goal.status === 'needs-review' ? 'unknown' : ''}`),textElement('span',goal.mode === 'plan' ? 'Local plan' : 'Bounded goal','form-help'));
    card.append(head,textElement('h3',goal.title),textElement('p',`${goal.steps.length} planned steps · ${goal.jobIds.length} jobs · iteration ${goal.iteration} of ${goal.maxIterations}`));
    if(goal.stopReason)card.append(textElement('p',`Stopped: ${goal.stopReason.replaceAll('-',' ')}`,'goal-stop-reason'));
    if (goal.steps.length) {
      const details = textElement('details','','goal-steps'); const summary = textElement('summary','Plan & ownership'); details.append(summary);
      for (const [index,step] of goal.steps.entries()) { const name = officeState?.employees.find((e) => e.id === step.employeeId)?.name || step.employeeId; const row = textElement('div','','goal-step'); row.append(textElement('strong',`${index+1}. ${step.title}`),textElement('span',name)); details.append(row); }
      card.append(details);
    }
    const actions = textElement('div','','row wrap');
    if (goal.status === 'draft') actions.append(workspaceButton('Build local plan',async () => { await workspaceCommand({action:'plan_goal',goalId:goal.id},'Local goal plan saved.'); }));
    if (goal.mode === 'execute' && ['planned','needs-review'].includes(goal.status) && !goal.jobIds.length) actions.append(workspaceButton(officeState?.policy?.approvalMode === 'review' ? 'Approve & queue' : 'Queue goal',async () => { await workspaceCommand({action:'execute_goal',goalId:goal.id,reviewed:true},'Goal execution requested within its budget.'); }));
    if (['running','planned','needs-review'].includes(goal.status)) actions.append(workspaceButton('Pause',async () => { await workspaceCommand({action:'pause_goal',goalId:goal.id},'Goal paused.'); },'text-button'));
    if (goal.status === 'paused') actions.append(workspaceButton('Resume',async () => { await workspaceCommand({action:'resume_goal',goalId:goal.id},'Goal resumed.'); },'text-button'));
    actions.append(workspaceButton('Map ownership',async () => { selectedGoalId = goal.id; await ensureWorkspaceBlueprint(); switchWorkspaceTab('whiteboard'); resetBoardForm(); ($('node-title') as HTMLInputElement).value = goal.title; ($('node-goal') as HTMLSelectElement).value = goal.id; $('node-title').focus(); },'text-button'));
    card.append(actions);
    if(goal.mode==='execute'&&goal.iteration>0&&goal.iteration<goal.maxIterations&&['completed','needs-review'].includes(goal.status)){
      const details=textElement('details','','goal-steps');details.append(textElement('summary','Request another bounded iteration'));
      const form=textElement('form','','stack goal-advance');const label=textElement('label','Reason for this iteration','field');const reason=document.createElement('textarea');reason.rows=2;reason.required=true;reason.maxLength=2000;reason.setAttribute('aria-label',`Reason to advance ${goal.title}`);label.append(reason);const submit=textElement('button','Queue next iteration','secondary small');submit.type='submit';submit.disabled=workspaceReadOnly();form.append(label,textElement('p','Uses the same owners, per-job caps, and global budget.','form-help'),submit);
      form.onsubmit=(event)=>{event.preventDefault();const text=reason.value.trim();if(!text)return;submit.disabled=true;workspaceTask(async()=>{try{await workspaceCommand({action:'advance_goal',goalId:goal.id,reason:text},'Next bounded iteration requested.');}finally{submit.disabled=workspaceReadOnly();}});};details.append(form);card.append(details);
    }
    container.append(card);
  }
  if (!goals.length) noData(container,'Create a goal to see its plan, owner, and recorded progress here.');
}
function renderWorkspacePolicy(): void {
  const policy = officeState?.policy; const budget = officeState?.budget;
  if (!policy || !budget) return;
  const modeLabel = policy.approvalMode === 'review' ? 'Review mode' : 'Autonomous within limits';
  $('workspace-budget-label').textContent = `${budget.atCap?'Budget hold':policy.dispatchPaused?'Dispatch paused':`${money(budget.remainingUsd)} available`} · ${modeLabel}`;
  $('workspace-policy-summary').textContent = `${modeLabel}${policy.dispatchPaused ? ' · Dispatch paused' : ''} · ${money(policy.budget.hardCapUsd)} global cap`;
  const fraction = Math.max(0,Math.min(1,budget.committedUsd / Math.max(.001,policy.budget.hardCapUsd)));
  $('global-budget-fill').style.width = `${fraction*100}%`;
  $('global-budget-meter').setAttribute('aria-label',`${money(budget.committedUsd)} committed out of ${money(policy.budget.hardCapUsd)} global ceiling`);
  $('global-budget-detail').textContent = `${money(budget.observedUsd)} observed · ${money(budget.estimatedUsd)} conservatively estimated · ${money(budget.reservedUsd)} reserved. ${number(budget.committedTokens)} tokens committed.${budget.remainingTokens === null ? '' : ` ${number(budget.remainingTokens)} tokens available.`}${budget.atCap ? ' Dispatch waits for budget.' : budget.warning ? ' Budget warning threshold reached.' : ''}`;
  if (!$('workspace-policy-form').contains(document.activeElement)) {
    ($('workspace-approval-mode') as HTMLSelectElement).value = policy.approvalMode;
    ($('workspace-global-usd') as HTMLInputElement).value = String(policy.budget.hardCapUsd);
    ($('workspace-global-tokens') as HTMLInputElement).value = policy.budget.hardCapTokens === null ? '' : String(policy.budget.hardCapTokens);
    ($('workspace-warning-percent') as HTMLInputElement).value = String(policy.budget.warningPercent);
    ($('workspace-dispatch-paused') as HTMLInputElement).checked = policy.dispatchPaused;
  }
  $('github-reviewed-label').classList.toggle('hidden',policy.approvalMode === 'autonomous');
  $('chat-authorized').closest('label')?.classList.toggle('hidden',policy.approvalMode === 'autonomous');
  $('queue-authorized').closest('label')?.classList.toggle('hidden',policy.approvalMode === 'autonomous');
}
function appendCanvasGrid(container: HTMLElement): void {
  const svg = svgElement('svg',{viewBox:'0 0 1000 620',preserveAspectRatio:'none',class:'canvas-grid','aria-hidden':'true'});
  let fine = ''; let major = ''; for (let x=0;x<=1000;x+=25) (x%100 === 0 ? major += `M${x} 0V620` : fine += `M${x} 0V620`); for (let y=0;y<=620;y+=25) (y%100 === 0 ? major += `M0 ${y}H1000` : fine += `M0 ${y}H1000`);
  svg.append(svgElement('path',{d:fine}),svgElement('path',{d:major,class:'major-grid'})); container.append(svg);
}
function canvasEmpty(container: HTMLElement,title:string,message:string): void {
  const empty = textElement('div','','canvas-empty'); empty.append(textElement('h3',title),textElement('p',message)); container.append(empty);
}
function renderSpatialSelectors(): void {
  const blueprint = currentBlueprint(); const company = officeCompany();
  const departments = (officeState?.departments || []).filter((item) => item.officeId === selectedOfficeId);
  const employees = (officeState?.employees||[]).filter((item) => item.status !== 'fired' && (!item.companyId || item.companyId===company?.id) && (!item.officeId || item.officeId===selectedOfficeId));
  const goals = (officeState?.goals || []).filter((item) => item.companyId === company?.id);
  const jobRows = scopedJobs().map((item) => ({id:item.id,name:`${item.status} · ${item.goal.slice(0,55)}`}));
  for (const [id,rows,empty] of [
    ['room-department',departments,'Shared office space'],['room-employee',contractedRoomEmployees(value('room-id'),employees),'Choose an employee'],
    ['node-owner',contractedRoomEmployees(value('node-room'),employees,true),'Choose an owner'],['node-room',blueprint?.rooms || [],'Choose a room'],
    ['node-goal',goals.map((goal) => ({id:goal.id,name:goal.title})),'No goal linked'],['node-roadmap',(portfolioState()?.roadmap||[]).filter(item=>company&&roadmapInCompany(item,company.id)).map(item=>({id:item.id,name:item.title})),'No portfolio outcome linked'],['node-job',jobRows,'No job linked'],
  ] as const) { const selected = value(id); populateSelect($(id) as HTMLSelectElement,rows,selected,empty); }
}
function resetRoomForm(): void {
  selectedRoomId = ''; roomDraftDirty = false; ($('workspace-room-form') as HTMLFormElement).reset();
  ($('room-id') as HTMLInputElement).value = ''; $('room-inspector-title').textContent = 'A place for each team.'; $('room-inspector-note').textContent = 'Add a shared room or connect it to a department.'; $('room-save').textContent = 'Add room';
  $('room-people').replaceChildren(); $('workspace-room-assign').classList.add('hidden'); renderSpatialSelectors();
}
function selectRoom(room: OfficeRoom,focus = false): void {
  selectedRoomId = room.id; roomDraftDirty = false; ($('room-id') as HTMLInputElement).value = room.id; ($('room-name') as HTMLInputElement).value = room.name;
  ($('room-department') as HTMLSelectElement).value = room.departmentId || ''; ($('room-x') as HTMLInputElement).value = String(Math.round(room.x*100)); ($('room-y') as HTMLInputElement).value = String(Math.round(room.y*100));
  $('room-inspector-title').textContent = room.name; $('room-inspector-note').textContent = 'Saved room position and employee assignments.'; $('room-save').textContent = 'Save room'; $('workspace-room-assign').classList.remove('hidden');
  const people = $('room-people'); people.replaceChildren(); people.setAttribute('aria-label',`${room.name} employees`);
  const assigned = currentBlueprint()?.desks.filter((desk) => desk.roomId === room.id) || [];
  for (const desk of assigned) { const employee = officeState?.employees.find((item) => item.id === desk.employeeId); if (!employee) continue; const row = textElement('div','','room-person'); row.append(textElement('strong',employee.name),textElement('span',`${employee.role} · ${employee.status}`)); people.append(row); }
  if (!assigned.length) noData(people,'No employees placed in this room.');
  document.querySelectorAll<HTMLElement>('.blueprint-room').forEach((card) => card.classList.toggle('selected',card.dataset.roomId === room.id));
  renderSpatialSelectors();
  if (focus) $('room-name').focus();
}
function spatialPosition(element: HTMLElement,x:number,y:number,width?:number): void { element.style.left = `${Math.max(0,x)*100}%`; element.style.top = `${Math.max(0,y)*620}px`; if (width !== undefined) element.style.width = `${width*100}%`; }
function wireSpatialMove(handle: HTMLButtonElement,element:HTMLElement,x:number,y:number,maxX:number,maxY:number,save:(x:number,y:number)=>Promise<void>,map = {originX:0,originY:0,scaleX:1,scaleY:1}): void {
  if(workspaceReadOnly())return;
  handle.setAttribute('aria-keyshortcuts','ArrowUp ArrowDown ArrowLeft ArrowRight');
  handle.addEventListener('keydown',(event) => {
    const delta = event.shiftKey ? .10 : .02; let dx=0; let dy=0;
    if (event.key === 'ArrowLeft') dx=-delta; else if (event.key === 'ArrowRight') dx=delta; else if (event.key === 'ArrowUp') dy=-delta; else if (event.key === 'ArrowDown') dy=delta; else return;
    event.preventDefault(); if (spatialSaving) return; spatialSaving=true;
    workspaceTask(async () => { try { await save(Math.max(0,Math.min(maxX,x+dx)),Math.max(0,Math.min(maxY,y+dy))); } finally { spatialSaving=false; } });
  });
  handle.addEventListener('pointerdown',(event) => {
    if (event.button !== 0 || element.parentElement?.classList.contains('list-mode')) return;
    const startX=event.clientX; const startY=event.clientY; const parent=element.parentElement; if(!parent) return;
    const width=parent.clientWidth || 1000; let nextX=x; let nextY=y; let moved=false;
    handle.setPointerCapture?.(event.pointerId);
    const move=(e:PointerEvent) => { if(Math.abs(e.clientX-startX)+Math.abs(e.clientY-startY)<5&&!moved)return; moved=true; nextX=Math.max(0,Math.min(maxX,x+(e.clientX-startX)/width/map.scaleX)); nextY=Math.max(0,Math.min(maxY,y+(e.clientY-startY)/620/map.scaleY)); spatialPosition(element,map.originX+nextX*map.scaleX,map.originY+nextY*map.scaleY); };
    const end=() => { handle.removeEventListener('pointermove',move); handle.removeEventListener('pointerup',end); handle.removeEventListener('pointercancel',cancel); if(moved)workspaceTask(()=>save(nextX,nextY)); };
    const cancel=() => { handle.removeEventListener('pointermove',move); handle.removeEventListener('pointerup',end); handle.removeEventListener('pointercancel',cancel); spatialPosition(element,map.originX+x*map.scaleX,map.originY+y*map.scaleY); };
    handle.addEventListener('pointermove',move); handle.addEventListener('pointerup',end,{once:true}); handle.addEventListener('pointercancel',cancel,{once:true});
  });
}
function renderBlueprint(): void {
  const container=$('office-blueprint'); container.replaceChildren(); const blueprint=currentBlueprint();
  container.classList.toggle('list-mode',($('blueprint-list-mode') as HTMLInputElement).checked); appendCanvasGrid(container);
  if (!blueprint?.rooms.length) { canvasEmpty(container,'Room to begin.',workspaceAvailable() ? 'Add a room for a department, then place the people responsible for its work.' : 'Open the desktop workspace to load saved office rooms and employees.'); return; }
  for (const room of blueprint.rooms.slice(0,80)) {
    const card=textElement('article','',`blueprint-room${selectedRoomId===room.id?' selected':''}`); card.dataset.roomId=room.id; spatialPosition(card,room.x,room.y,room.width);card.style.minHeight=`${room.height*620}px`;
    const title=textElement('button',room.name,'blueprint-room-title'); title.type='button'; title.onclick=()=>selectRoom(room);
    title.setAttribute('aria-label',`${room.name}. Select room; arrow keys move it.`);
    const department=officeState?.departments.find((d)=>d.id===room.departmentId); card.append(title,textElement('p',department?.name || 'Shared office space','blueprint-room-subtitle'));
    addStudioHeat(card,currentStudioSignals()?.perRoom[room.id]);
    const occupants=textElement('div','','room-occupants');
    const roomEmployees=blueprint.desks.filter((item)=>item.roomId===room.id).map(desk=>officeState?.employees.find(employee=>employee.id===desk.employeeId)).filter((employee):employee is OfficeEmployee=>Boolean(employee));
    for(const employee of roomEmployees.slice(0,6)) {
      const button=textElement('button',employee.name,`room-occupant${selectedDeskEmployeeId===employee.id?' selected':''}`); button.type='button'; button.title=`${employee.role} · ${employee.status}`;button.replaceChildren(studioAvatar(employee),textElement('span',employee.name,'room-occupant-name'));
      button.onclick=()=>{if(employee.companyId&&employee.companyId!==officeCompany()?.id){selectRoom(room);if(portfolioState()?.services.some(service=>service.companyId===officeCompany()?.id&&service.officeId===selectedOfficeId&&service.employeeIds.includes(employee.id))){setStatus($('room-status'),`${employee.name} is a shared specialist whose original company assignment is preserved. Assign recipient work through that company’s active service contract.`);return;}selectedDepartmentId=room.departmentId||'';renderOfficeScope();const contract=scopedServiceContracts().find(item=>item.employeeIds.includes(employee.id));if(!contract){setStatus($('room-status'),'This historical assignment has no active staffing contract.','error');return;}($('queue-service-contract') as HTMLSelectElement).value=contract.id;renderOfficeScope();($('queue-employee') as HTMLSelectElement).value=employee.id;switchOfficeTab('queue');($('queue-composer') as HTMLDetailsElement).open=true;$('queue-composer').scrollIntoView({block:'nearest'});$('queue-goal').focus();return;}selectedDeskEmployeeId=employee.id;selectedDepartmentId=employee.departmentId||'';renderOfficeScope();renderWorkspaceControls();selectRoom(room);($('chat-scope') as HTMLSelectElement).value='employee';($('chat-employee') as HTMLSelectElement).value=employee.id;switchWorkspaceTab('chat');renderUnifiedWorkspace();$('chat-message').focus();}; occupants.append(button);
    }
    if(roomEmployees.length>6){const more=textElement('button',`+${roomEmployees.length-6} more`,'room-occupant room-occupant-more');more.type='button';more.setAttribute('aria-label',`View all ${roomEmployees.length} employees in ${room.name}`);more.onclick=()=>{selectRoom(room);$('room-people').focus();$('room-people').scrollIntoView({block:'nearest'});};occupants.append(more);}
    if(!occupants.children.length)occupants.append(textElement('span','Place an employee','form-help'));
    const art=svgElement('svg',{viewBox:'0 0 115 54',class:'room-floorplan','aria-hidden':'true'}); art.append(svgElement('rect',{x:10,y:10,width:46,height:26,rx:3}),svgElement('path',{d:'M20 8V4h25v4M20 40v9h25v-9M74 10h30v34H74Z M74 20h30M74 34h30'}));
    const boards=blueprint.whiteboards.filter((board)=>board.roomId===room.id).length;
    card.append(occupants,textElement('span',`${boards} ownership ${boards===1?'card':'cards'}`,'room-work-count'),art);
    wireSpatialMove(title,card,room.x,room.y,1-room.width,1-room.height,async(x,y)=>{await workspaceCommand({action:'upsert_room',officeId:selectedOfficeId,id:room.id,name:room.name,departmentId:room.departmentId,x,y,width:room.width,height:room.height},'Room position saved.'); Array.from(document.querySelectorAll<HTMLElement>('[data-room-id]')).find(item=>item.dataset.roomId===room.id)?.querySelector<HTMLButtonElement>('.blueprint-room-title')?.focus();});
    container.append(card);
  }
  if(selectedRoomId){const room=blueprint.rooms.find((item)=>item.id===selectedRoomId);if(room&&!roomDraftDirty&&!$('workspace-room-form').contains(document.activeElement))selectRoom(room);}
}
function resetBoardForm(): void {
  selectedBoardId='';($('workspace-node-form') as HTMLFormElement).reset();($('node-id') as HTMLInputElement).value='';$('node-inspector-title').textContent='Work with a clear owner.';$('node-save').textContent='Add card';renderSpatialSelectors();
  const blueprint=currentBlueprint();if(blueprint?.rooms[0])($('node-room') as HTMLSelectElement).value=selectedRoomId||blueprint.rooms[0].id;
  if(value('chat-employee'))($('node-owner') as HTMLSelectElement).value=value('chat-employee');
}
function selectBoard(board:OfficeWhiteboard):void {
  selectedBoardId=board.id;($('node-id') as HTMLInputElement).value=board.id;($('node-title') as HTMLInputElement).value=board.title;($('node-owner') as HTMLSelectElement).value=board.ownerEmployeeId;($('node-room') as HTMLSelectElement).value=board.roomId;($('node-goal') as HTMLSelectElement).value=board.goalIds[0]||'';($('node-job') as HTMLSelectElement).value=board.jobIds[0]||'';($('node-roadmap') as HTMLSelectElement).value=board.roadmapItemIds?.[0]||'';($('node-x') as HTMLInputElement).value=String(Math.round(board.x*100));($('node-y') as HTMLInputElement).value=String(Math.round(board.y*100));$('node-inspector-title').textContent=board.title;$('node-save').textContent='Save ownership';
  document.querySelectorAll<HTMLElement>('.ownership-card').forEach((card)=>card.classList.toggle('selected',card.dataset.boardId===board.id));
}
function renderWhiteboard():void {
  const container=$('workspace-whiteboard');container.replaceChildren();const blueprint=currentBlueprint();container.classList.toggle('list-mode',($('whiteboard-list-mode') as HTMLInputElement).checked);appendCanvasGrid(container);
  if(!blueprint?.whiteboards.length){canvasEmpty(container,'An owner for every outcome.',workspaceAvailable()?'Add an ownership card and link it to a goal, a room, and the employee responsible.':'Saved ownership appears when the desktop workspace is connected.');return;}
  const width=container.clientWidth||1000;const lines=svgElement('svg',{viewBox:`0 0 ${width} 620`,preserveAspectRatio:'none',class:'ownership-lines','aria-hidden':'true'});container.append(lines);
  for(const board of blueprint.whiteboards.slice(0,100)){
    const room=blueprint.rooms.find((item)=>item.id===board.roomId);if(!room)continue;
    const employee=officeState?.employees.find((item)=>item.id===board.ownerEmployeeId);const goal=officeState?.goals?.find((item)=>board.goalIds.includes(item.id));const linkedJob=officeState?.jobs.find((item)=>board.jobIds.includes(item.id));const roadmap=portfolioState()?.roadmap.find(item=>board.roadmapItemIds?.includes(item.id));
    const x=Math.max(0,Math.min(.70,room.x+board.x*room.width*.55));const y=Math.max(0,Math.min(.72,room.y+board.y*room.height*.55));
    const card=textElement('article','',`ownership-card${selectedBoardId===board.id?' selected':''}`);card.dataset.boardId=board.id;spatialPosition(card,x,y);card.append(textElement('span',linkedJob?'JOB OWNERSHIP':goal?'GOAL OWNERSHIP':roadmap?'ROADMAP OWNERSHIP':'WORK OWNERSHIP','card-type'));
    const title=textElement('button',board.title,'card-title');title.type='button';title.onclick=()=>selectBoard(board);title.setAttribute('aria-label',`${board.title}. Owned by ${employee?.name||'unknown employee'} in ${room.name}. Arrow keys move the card.`);card.append(title);
    const status=linkedJob?.status||goal?.status||roadmap?.status||'Assigned';card.append(textElement('span',status.replaceAll('-',' '),`badge ${status==='completed'?'ok':status==='needs-review'||status==='waiting-budget'?'unknown':''}`));
    addStudioHeat(card,employee?currentStudioSignals()?.perEmployee[employee.id]:undefined);
    const ownership=textElement('div','','card-ownership');ownership.append(textElement('strong',employee?.name||'Employee unavailable'),textElement('span',room.name));if(goal)ownership.append(textElement('span',`Goal: ${goal.title}`));if(roadmap)ownership.append(textElement('span',`Roadmap: ${roadmap.title}`));if(linkedJob?.artifactUri)ownership.append(textElement('span',`Artifact: ${linkedJob.artifactUri}`));card.append(ownership);
    const desk=blueprint.desks.find((item)=>item.roomId===room.id&&item.employeeId===board.ownerEmployeeId);
    if(desk){const ax=(room.x+desk.x*room.width)*width;const ay=(room.y+desk.y*room.height)*620;lines.append(svgElement('path',{d:`M${x*width+12} ${y*620+70} C${x*width-20} ${y*620+70} ${ax-20} ${ay} ${ax} ${ay}`}),svgElement('circle',{cx:ax,cy:ay,r:4}));}
    wireSpatialMove(title,card,board.x,board.y,1,1,async(nextX,nextY)=>{await workspaceCommand({action:'upsert_whiteboard',officeId:selectedOfficeId,...board,x:nextX,y:nextY},'Ownership card position saved.');Array.from(document.querySelectorAll<HTMLElement>('[data-board-id]')).find(item=>item.dataset.boardId===board.id)?.querySelector<HTMLButtonElement>('.card-title')?.focus();},{originX:room.x,originY:room.y,scaleX:room.width*.55,scaleY:room.height*.55});container.append(card);
  }
}
async function ensureWorkspaceBlueprint():Promise<void>{
  if(!workspaceAvailable()||workspaceReadOnly()||currentBlueprint()||blueprintLoading||!selectedOfficeId)return;blueprintLoading=true;
  try{await workspaceCommand({action:'ensure_blueprint',officeId:selectedOfficeId},'Office blueprint loaded.');}finally{blueprintLoading=false;}
}
function switchWorkspaceTab(name:string):void{
  if(!['chat','blueprint','softboard','timeline','whiteboard','decisions'].includes(name))return;workspaceTab=name;
  document.querySelectorAll<HTMLButtonElement>('[data-workspace-tab]').forEach((button)=>{const active=button.dataset.workspaceTab===name;button.classList.toggle('active',active);button.setAttribute('aria-selected',String(active));button.tabIndex=active?0:-1;});
  document.querySelectorAll<HTMLElement>('.workspace-tab-panel').forEach((panel)=>panel.classList.toggle('hidden',panel.id!==`workspace-panel-${name}`));
  renderUnifiedWorkspace();
}
function renderUnifiedWorkspace():void{
  if(ffStudio)ffRefresh();
  $('workspace-studio-signals').classList.toggle('hidden',workspaceTab==='chat'||workspaceTab==='decisions');
  renderWorkspaceControls();renderPortfolio();renderWorkspaceLocator();renderDecisionPanels();renderCloudConnection();
  if(spatialOfficeId!==selectedOfficeId){spatialOfficeId=selectedOfficeId;resetRoomForm();resetBoardForm();}
  renderWorkspacePolicy();renderConversation();renderWorkspaceGoals();renderSpatialSelectors();renderStudioSignals();renderBlueprint();renderWhiteboard();renderSoftboard();renderStudioRoadmap();syncDonnaDock();
  $('github-repository-label').textContent=officeCompany()?.repoUrl||'Choose a repository company.';
}
function updateChatMode():void{
  if(bridge?.transport==='cloud-browser'){ $('chat-goal-mode').closest('label')?.classList.add('hidden');$('chat-provider-options').classList.add('hidden');$('chat-send').textContent='Ask Donna';$('chat-mode-note').textContent='A real cloud reply. Code and panel jobs wait for a connected desktop; this conversation does not apply changes.';return;}
  const execute=value('chat-goal-mode')==='provider';$('chat-provider-options').classList.toggle('hidden',!execute);$('chat-send').textContent=execute?'Create bounded goal ↑':'Create plan ↑';
  $('chat-mode-note').textContent=execute?(officeState?.policy?.approvalMode==='autonomous'?'Eligible work can queue automatically within every budget cap.':'The goal is planned first. Approve its plan before provider execution.'):'Save a local brief and plan. No provider request.';
}
function boundedUtf8(input:string,maxBytes:number):string{let result='';let size=0;const encoder=new TextEncoder();for(const char of input){const bytes=encoder.encode(char).length;if(size+bytes>maxBytes)break;result+=char;size+=bytes;}return result;}
function chatRunSettings():OfficeGoalRunSettings{
  const provider=value('chat-provider') as ProjectProvider;const mode=value('chat-goal-mode')==='provider'?'provider':'manual';
  const settings:OfficeGoalRunSettings={mode,provider,model:value('chat-model'),authorized:mode==='provider'&&(($('chat-authorized') as HTMLInputElement).checked||officeState?.policy?.approvalMode==='autonomous'),maxTokens:Number(value('chat-max-tokens')),maxUsd:Number(value('chat-max-usd')),maxMinutes:Number(value('chat-max-minutes')),priceRates:{inputUsdPerMillion:Number(value('chat-rate-input')),outputUsdPerMillion:Number(value('chat-rate-output'))}};
  if(mode==='provider'){
    if(!settings.authorized)throw new Error('Authorize provider work for this goal before creating it.');if(!settings.model)throw new Error('Choose a model ID for bounded execution.');
    if(provider!=='ollama'&&(!settings.priceRates.inputUsdPerMillion||settings.priceRates.inputUsdPerMillion<=0||!settings.priceRates.outputUsdPerMillion||settings.priceRates.outputUsdPerMillion<=0))throw new Error('Positive input and output rates are required for cloud execution.');
  }
  if(!Number.isInteger(settings.maxTokens)||settings.maxTokens<1||settings.maxTokens>200000||!Number.isFinite(settings.maxUsd)||settings.maxUsd<=0||settings.maxUsd>100||!Number.isFinite(settings.maxMinutes)||settings.maxMinutes<=0||settings.maxMinutes>120)throw new Error('Use positive token, time, and spending limits, with at most $100 per job.');
  return settings;
}
function initUnifiedWorkspace():void{
  document.querySelectorAll<HTMLButtonElement>('[data-workspace-tab]').forEach((button)=>{button.onclick=()=>switchWorkspaceTab(button.dataset.workspaceTab||'chat');button.addEventListener('keydown',(event)=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const buttons=Array.from(document.querySelectorAll<HTMLButtonElement>('[data-workspace-tab]'));const i=buttons.indexOf(button);const next=event.key==='Home'?buttons[0]:event.key==='End'?buttons.at(-1):buttons[(i+(event.key==='ArrowRight'?1:-1)+buttons.length)%buttons.length];next?.click();next?.focus();});});
  document.querySelectorAll<HTMLButtonElement>('[data-open-workspace-tab]').forEach((button)=>button.onclick=()=>switchWorkspaceTab(button.dataset.openWorkspaceTab||'chat'));
  document.querySelectorAll<HTMLButtonElement>('[data-brief]').forEach((button)=>button.onclick=()=>{($('chat-message') as HTMLTextAreaElement).value=button.dataset.brief||'';$('chat-message').focus();});
  const newBrief=()=>{setPortfolioOpen(false);navigate('office');switchWorkspaceTab('chat');$('chat-message').focus();};$('header-new-goal').onclick=()=>{if(document.body.classList.contains('ff-canvas-mode')){const f=ffFocus;const ctx:StudioActionContext=f.kind==='portfolio'?{}:{companyId:f.companyId,...('officeId' in f&&f.officeId?{officeId:f.officeId}:{}),...(f.kind==='department'?{departmentId:f.departmentId}:{})};ffAction('new-goal' as unknown as StudioActionKind,ctx);}else newBrief();};$('brief-donna').onclick=newBrief;
  $('chat-scope').addEventListener('change',renderUnifiedWorkspace);$('chat-employee').addEventListener('change',renderUnifiedWorkspace);$('chat-goal-mode').addEventListener('change',()=>{updateChatMode();if(value('chat-goal-mode')==='provider')($('chat-provider-options') as HTMLDetailsElement).open=true;});
  $('chat-message').addEventListener('keydown',(event)=>{if(event.key==='Enter'&&(event.ctrlKey||event.metaKey)){event.preventDefault();($('workspace-chat-form') as HTMLFormElement).requestSubmit();}});
  workspaceForm('workspace-chat-form',async()=>{
    const content=value('chat-message');if(!content)throw new Error('Write a goal first.');if(new TextEncoder().encode(content).byteLength>12000)throw new Error('Keep the conversation brief under 12 KB of text.');const scope=workspaceScope();if(bridge?.transport==='cloud-browser'){await sendDonnaCloud(content,scope);return;}const runSettings=chatRunSettings();const maxIterations=Number(value('chat-max-iterations'));if(!Number.isInteger(maxIterations)||maxIterations<1||maxIterations>10)throw new Error('Choose between one and ten goal iterations.');
    setStatus($('chat-status'),'Saving your brief and local plan…');await workspaceCommand({action:'post_chat',scope,content},'Brief saved.');
    const before=new Set((officeState?.goals||[]).map((goal)=>goal.id));const state=await workspaceCommand({action:'create_goal',scope,title:boundedUtf8(content.replace(/\s+/g,' '),120),description:content,mode:runSettings.mode==='provider'?'execute':'plan',maxIterations,runSettings},'Goal saved.');
    const goal=state.goals?.find((item)=>!before.has(item.id));if(!goal)throw new Error('The brief was saved, but no new goal record was returned. Refresh the workspace to inspect it.');selectedGoalId=goal.id;
    await workspaceCommand({action:'plan_goal',goalId:goal.id},'Local goal plan saved.');
    if(runSettings.mode==='provider'&&officeState?.policy?.approvalMode==='autonomous')await workspaceCommand({action:'execute_goal',goalId:goal.id},'Goal queued within the global budget.');
    ($('chat-message') as HTMLTextAreaElement).value='';setStatus($('chat-status'),runSettings.mode==='provider'&&officeState?.policy?.approvalMode==='review'?'Plan saved. Review ownership, then approve the goal to queue its provider jobs.':'Brief and plan saved.','ok');renderUnifiedWorkspace();
  },'chat-status');
  $('workspace-budget-open').onclick=()=>{const details=$('workspace-policy') as HTMLDetailsElement;details.open=!details.open;if(details.open){details.scrollIntoView({block:'nearest'});$('workspace-approval-mode').focus();}};
  workspaceForm('workspace-policy-form',async()=>{
    const hardCapUsd=Number(value('workspace-global-usd'));const tokenText=value('workspace-global-tokens');const hardCapTokens=tokenText?Number(tokenText):null;const warningPercent=Number(value('workspace-warning-percent'));
    if(!Number.isFinite(hardCapUsd)||hardCapUsd<=0||hardCapUsd>100||hardCapTokens!==null&&(!Number.isInteger(hardCapTokens)||hardCapTokens<=0)||!Number.isFinite(warningPercent)||warningPercent<1||warningPercent>100)throw new Error('Set a positive global ceiling up to $100, optional positive token cap, and warning from 1 to 100%.');
    await workspaceCommand({action:'configure_policy',approvalMode:value('workspace-approval-mode'),dispatchPaused:($('workspace-dispatch-paused') as HTMLInputElement).checked,hardCapUsd,hardCapTokens,warningPercent},'Global policy saved.');setStatus($('workspace-policy-status'),'Global budget and approval mode saved.','ok');
  },'workspace-policy-status');
  $('blueprint-add-room').onclick=()=>{resetRoomForm();$('room-name').focus();};$('whiteboard-add-node').onclick=()=>{resetBoardForm();$('node-title').focus();};
  for(const event of ['input','change'])$('workspace-room-form').addEventListener(event,()=>{roomDraftDirty=true;$('room-inspector-note').textContent='Unsaved room details. Save to apply; changing views keeps this draft.';});
  for(const id of ['blueprint-list-mode','whiteboard-list-mode']){$(id).addEventListener('change',renderUnifiedWorkspace);if(window.innerWidth<650)($(id) as HTMLInputElement).checked=true;}
  workspaceForm('workspace-room-form',async()=>{
    const scope=requireOfficeScope();await ensureWorkspaceBlueprint();const name=value('room-name');if(!name)throw new Error('Give this room a name.');const previous=currentBlueprint()?.rooms.find((room)=>room.id===value('room-id'));const x=Number(value('room-x'))/100;const y=Number(value('room-y'))/100;const width=previous?.width||.35;const height=previous?.height||.35;
    if(!Number.isFinite(x)||!Number.isFinite(y)||x<0||y<0||x>1-width||y>1-height)throw new Error('Place the complete room inside the office plan.');
    const state=await workspaceCommand({action:'upsert_room',officeId:scope.officeId,id:previous?.id,name,departmentId:value('room-department')||null,x,y,width,height},'Room saved.');const blueprint=state.blueprints?.find((item)=>item.officeId===scope.officeId);const saved=previous?blueprint?.rooms.find((item)=>item.id===previous.id):blueprint?.rooms.find((item)=>item.name===name);if(saved)selectRoom(saved);setStatus($('room-status'),'Room saved in this office.','ok');
  },'room-status');
  workspaceForm('workspace-room-assign',async()=>{const roomId=value('room-id');const employeeId=value('room-employee');if(!roomId||!employeeId)throw new Error('Select a room and an employee.');await workspaceCommand({action:'place_employee',officeId:selectedOfficeId,roomId,employeeId,x:.2,y:.65},'Employee placed in the selected room.');const room=currentBlueprint()?.rooms.find((item)=>item.id===roomId);if(room)selectRoom(room);},'room-status');
  workspaceForm('workspace-node-form',async()=>{
    const roomId=value('node-room');const ownerEmployeeId=value('node-owner');const title=value('node-title');if(!roomId||!ownerEmployeeId||!title)throw new Error('Give this card a title, owner, and room.');const x=Number(value('node-x'))/100;const y=Number(value('node-y'))/100;if(!Number.isFinite(x)||!Number.isFinite(y)||x<0||x>1||y<0||y>1)throw new Error('Card positions must be between 0 and 100%.');const previous=currentBlueprint()?.whiteboards.find((item)=>item.id===value('node-id'));
    await workspaceCommand({action:'upsert_whiteboard',officeId:selectedOfficeId,id:previous?.id,roomId,ownerEmployeeId,title,goalIds:value('node-goal')?[value('node-goal')]:[],jobIds:value('node-job')?[value('node-job')]:[],roadmapItemIds:value('node-roadmap')?[value('node-roadmap')]:[],x,y},'Ownership card saved.');setStatus($('node-save-status'),'Ownership saved. Linked execution records keep their own scope and evidence.','ok');
  },'node-save-status');
  renderUnifiedWorkspace();
}


// GitHub operations stay within the current company workspace.
async function githubOperation(operation: string,fields:Record<string,unknown> = {}):Promise<Record<string,unknown>>{
  const company=officeCompany();if(!company?.repoUrl)throw new Error('Choose a company with a registered GitHub repository.');
  const state=await workspaceCommand({action:'github_operation',companyId:company.id,operation,...fields},'GitHub operation completed.');
  const result=state.lastAction?.github;if(!result||typeof result!=='object')throw new Error('GitHub returned no operation result. Refresh before continuing.');return result as Record<string,unknown>;
}
function initGitHubTools():void{
  $('github-refresh-branches').onclick=()=>workspaceTask(async()=>{
    setStatus($('github-tools-status'),'Reading branch heads from GitHub…');const result=await githubOperation('branches');const branches=Array.isArray(result.branches)?result.branches:[];const container=$('github-branches');container.replaceChildren();
    for(const raw of branches.slice(0,1000)){if(!raw||typeof raw!=='object')continue;const branch=raw as Record<string,unknown>;if(typeof branch.name!=='string'||typeof branch.sha!=='string')continue;
      const row=textElement('div','','branch-row');const copy=textElement('div','','branch-copy');copy.append(textElement('strong',branch.name),textElement('code',branch.sha));const button=textElement('button','Use branch','secondary small');button.type='button';button.onclick=()=>{($('github-publish-branch') as HTMLInputElement).value=String(branch.name);($('github-expected-head') as HTMLInputElement).value=String(branch.sha);($('github-head') as HTMLInputElement).value=String(branch.name);};row.append(copy,button);if(branch.protected)row.append(textElement('span','Protected','badge'));container.append(row);
    }
    if(!container.children.length)noData(container,'No branches were returned.');setStatus($('github-tools-status'),`${number(branches.length)} branch heads loaded. A protected branch may reject direct publishing.`,'ok');
  },'github-tools-status');
  workspaceForm('github-compare-form',async()=>{
    const result=await githubOperation('compare',{base:value('github-base'),head:value('github-head')});const container=$('github-compare-result');container.replaceChildren();container.append(textElement('h3',`${String(result.status||'Comparison')} · ${String(result.aheadBy??0)} ahead / ${String(result.behindBy??0)} behind`));
    const files=Array.isArray(result.files)?result.files:[];for(const raw of files.slice(0,300)){if(!raw||typeof raw!=='object')continue;const file=raw as Record<string,unknown>;container.append(textElement('p',`${String(file.path||'Unknown file')} · ${String(file.status||'')} · +${String(file.additions??0)} / −${String(file.deletions??0)}`,'github-file'));}
    setStatus($('github-tools-status'),`Comparison returned ${number(files.length)} changed files.`,'ok');
  },'github-tools-status');
  workspaceForm('github-publish-form',async()=>{
    const reviewed=($('github-reviewed') as HTMLInputElement).checked;if(officeState?.policy?.approvalMode!=='autonomous'&&!reviewed)throw new Error('Review the changeset and target branch, then select the review checkbox before publishing.');
    let files:unknown;try{files=JSON.parse(value('github-files'));}catch{throw new Error('The changeset must be a valid JSON array of objects with path and content.');}
    if(!Array.isArray(files)||files.length<1||files.length>100||files.some((item)=>!item||typeof item.path!=='string'||typeof item.content!=='string'))throw new Error('Use 1 to 100 text files, each with a path and content string.');
    const expectedHead=value('github-expected-head').toLowerCase();if(!/^[a-f0-9]{40}$/.test(expectedHead))throw new Error('Use the complete current branch head SHA returned by GitHub.');
    const result=await githubOperation('publish_changes',{branch:value('github-publish-branch'),expectedHead,message:value('github-commit-message'),files,reviewed});
    setStatus($('github-tools-status'),`Published commit ${String(result.commit||'')} to ${String(result.branch||'the selected branch')}.`,'ok');if(typeof result.commit==='string')($('github-expected-head') as HTMLInputElement).value=result.commit;
  },'github-tools-status');
  $('open-personal-dashboard').onclick=()=>workspaceTask(async()=>{if(!bridge?.openPersonalDashboard)throw new Error('Open this control from the installed desktop app to start your private dashboard.');const result=await bridge.openPersonalDashboard();if(!result.ok)throw new Error(result.error||'The private dashboard could not be opened.');setStatus($('personal-dashboard-status'),bridge.transport==='personal-browser'?'You are already using the private dashboard.':'Your private dashboard is open in the browser. Keep the desktop app running.','ok');},'personal-dashboard-status');
}


// ---------------------------------------------------------------- CEO portfolio, using the same saved office and conversation
let portfolioOpen = false;
let groupMembers = new Set<string>();
let contractMembers = new Set<string>();
let contractPickerService = '';
function portfolioState():OfficePortfolio|undefined{return officeState?.portfolio;}
function portfolioCompanies():OfficeCompany[]{return(officeState?.companies||[]).filter(company=>company.id!==portfolioState()?.ceo.sharedServicesCompanyId).sort((a,b)=>a.name.localeCompare(b.name));}
function portfolioReady():boolean{return workspaceAvailable()&&Boolean(portfolioState());}
function setPortfolioOpen(open:boolean):void{
  portfolioOpen=open;if(open)ffOperations=true;$('ceo-panel').classList.toggle('hidden',!open);$('company-workspace').classList.toggle('hidden',open);$('ceo-toggle').setAttribute('aria-expanded',String(open));$('ceo-toggle-arrow').classList.toggle('return-arrow',open);
  const label=$('ceo-toggle').querySelector('strong');if(label)label.textContent=open?'Back to company workspace':'CEO office';if(open)renderPortfolio();syncDonnaDock();
}
function portfolioNavigation(label:string,companyId:string,tab='chat',kind='text-button',officeId?:string,departmentId?:string):HTMLButtonElement{
  const button=actionButton(label,kind);button.type='button';button.onclick=()=>workspaceTask(()=>openPortfolioCompany(companyId,tab,officeId,departmentId),'ceo-status');return button;
}
async function openPortfolioCompany(companyId:string,tab='chat',officeId?:string,departmentId?:string):Promise<void>{
  if(!officeState?.companies.some(company=>company.id===companyId))throw new Error('This company is no longer in the workspace.');
  const focus:FreeflowFocus=departmentId&&officeId?{kind:'department',companyId,officeId,departmentId}:officeId?{kind:'office',companyId,officeId}:{kind:'company',companyId};
  await ffTransitionScope(focus,true);
  if(officeState?.activeCompanyId!==companyId||ffFocus.kind==='portfolio'||ffFocus.companyId!==companyId)return;
  ($('chat-scope') as HTMLSelectElement).value=departmentId?'department':officeId?'office':'company';
  renderOffice();setPortfolioOpen(false);switchWorkspaceTab(tab);$(tab==='chat'?'chat-message':`workspace-tab-${tab}`).focus();
}
function scopeCompanies(item:PortfolioRoadmapItem):string[]{
  if(item.scope.kind==='global')return portfolioCompanies().map(company=>company.id);
  if(item.scope.kind==='company')return[item.scope.id];
  return portfolioState()?.groups.find(group=>group.id===item.scope.id)?.companyIds||[];
}
function roadmapInCompany(item:PortfolioRoadmapItem,companyId:string):boolean{return item.scope.kind==='global'||scopeCompanies(item).includes(companyId);}
function roadmapScopeLabel(item:PortfolioRoadmapItem):string{
  return item.scope.kind==='global'?'Entire portfolio':item.scope.kind==='group'?portfolioState()?.groups.find(group=>group.id===item.scope.id)?.name||'Group unavailable':officeState?.companies.find(company=>company.id===item.scope.id)?.name||'Company unavailable';
}
function filteredPortfolioCompanies():OfficeCompany[]{
  const group=portfolioState()?.groups.find(item=>item.id===value('ceo-roadmap-group'));const companyId=value('ceo-roadmap-company');
  return portfolioCompanies().filter(company=>(!group||group.companyIds.includes(company.id))&&(!companyId||company.id===companyId));
}
function portfolioSelect(id:string,rows:Array<{id:string;name:string}>,empty?:string):void{const select=$(id) as HTMLSelectElement;populateSelect(select,rows,select.value,empty);}
function renderPortfolioSelectors():void{
  const portfolio=portfolioState();if(!portfolio)return;const companies=portfolioCompanies();
  for(const id of ['ceo-roadmap-group','ceo-edit-group','ceo-move-group','ceo-focus-group'])portfolioSelect(id,portfolio.groups,id==='ceo-edit-group'?'Create a group':id==='ceo-focus-group'?'Entire portfolio':id==='ceo-move-group'?'Choose destination':'All groups');
  const group=portfolio.groups.find(item=>item.id===value('ceo-roadmap-group'));portfolioSelect('ceo-roadmap-company',companies.filter(company=>!group||group.companyIds.includes(company.id)),'All companies');
  for(const id of ['ceo-move-company','ceo-contract-company'])portfolioSelect(id,companies,id==='ceo-move-company'?'Choose a company':'Choose recipient');
  const ids=new Set(filteredPortfolioCompanies().map(company=>company.id));portfolioSelect('ceo-roadmap-department',(officeState?.departments||[]).filter(department=>ids.has(department.companyId)).map(department=>({id:department.id,name:`${officeState?.companies.find(company=>company.id===department.companyId)?.name||''} / ${department.name}`})),'All departments');
  portfolioSelect('ceo-contract-service',portfolio.services,'Choose a shared service');renderContractRecipients();renderRoadmapEditorSelectors();
}
function renderPortfolioDirectory():void{
  const container=$('ceo-directory');container.replaceChildren();const portfolio=portfolioState();if(!portfolio){noData(container,'The CEO portfolio loads from the current native workspace.');return;}
  const query=value('ceo-company-search').toLowerCase();const companies=portfolioCompanies();const memberships=new Set(portfolio.groups.flatMap(group=>group.companyIds));let rendered=0;
  const groups:Array<{id:string;name:string;description:string;companyIds:string[];status:string}>=[...portfolio.groups];const ungrouped=companies.filter(company=>!memberships.has(company.id));if(ungrouped.length)groups.push({id:'',name:'Ungrouped projects',description:'Companies awaiting group assignment.',companyIds:ungrouped.map(company=>company.id),status:'active'});
  for(const group of groups){const groupMatch=group.name.toLowerCase().includes(query);const members=companies.filter(company=>group.companyIds.includes(company.id)&&(!query||groupMatch||`${company.name} ${company.repoUrl||''}`.toLowerCase().includes(query)));if(!members.length&&query)continue;
    const details=textElement('details','','portfolio-group');details.open=true;const summary=textElement('summary','');summary.append(textElement('span',group.name),textElement('span',String(members.length),'badge'));details.append(summary);
    const actions=textElement('div','','portfolio-group-tools');if(members[0])actions.append(portfolioNavigation('Open group ↗',members[0].id));if(group.id){const edit=textElement('button','Edit membership','text-button');edit.type='button';edit.onclick=()=>editPortfolioGroup(group.id);actions.append(edit);}details.append(actions);
    for(const company of members){if(rendered>=240)break;rendered++;const row=textElement('div','',`portfolio-company${officeCompany()?.id===company.id?' selected':''}`);row.dataset.companyId=company.id;row.append(portfolioNavigation(company.name,company.id,'chat','portfolio-company-name'));
      const contracts=portfolio.contracts.filter(contract=>contract.status==='active'&&contract.recipientCompanyId===company.id);row.append(textElement('small',`${company.visibility==='private'?'Private company':company.status} · ${contracts.length} shared ${contracts.length===1?'contract':'contracts'}`,'portfolio-company-meta'));
      const links=textElement('div','','portfolio-company-links');links.append(portfolioNavigation('Office',company.id,'blueprint'),portfolioNavigation('Whiteboard',company.id,'whiteboard'));row.append(links);details.append(row);
    }container.append(details);
  }
  const pool=officeState?.companies.find(company=>company.id===portfolio.ceo.sharedServicesCompanyId);if(pool){const row=textElement('div','','portfolio-company');row.append(portfolioNavigation('Shared-services office ↗',pool.id,'blueprint','portfolio-company-name'));container.append(row);}
  if(!container.children.length)noData(container,'No companies match this search.');if(rendered>=240)container.append(textElement('p','Showing the first 240 matches. Refine the search to locate another company.','form-help'));
}
function renderPortfolioRoadmap():void{
  const container=$('ceo-roadmap');container.replaceChildren();const portfolio=portfolioState();if(!portfolio){noData(container,'Portfolio outcomes are unavailable in this build.');return;}
  const companies=new Set(filteredPortfolioCompanies().map(company=>company.id));const groupId=value('ceo-roadmap-group');const departmentId=value('ceo-roadmap-department');const status=value('ceo-roadmap-status');
  const items=portfolio.roadmap.filter(item=>(!departmentId||item.departmentId===departmentId)&&(!status||item.status===status)&&(item.scope.kind==='global'||item.scope.kind==='group'&&item.scope.id===groupId||scopeCompanies(item).some(id=>companies.has(id))));
  $('ceo-roadmap-summary').textContent=`${items.length} outcomes in view · ${items.filter(item=>item.status==='done').length} complete with evidence`;
  for(const item of items.slice(0,80)){const article=textElement('article','','portfolio-outcome');article.dataset.roadmapId=item.id;const head=textElement('div','','portfolio-outcome-heading');head.append(textElement('h4',item.title),textElement('span',item.status.replaceAll('-',' '),`badge ${item.status==='done'?'ok':item.status==='blocked'?'unknown':''}`));article.append(head);if(item.description)article.append(textElement('p',item.description));
    const owner=officeState?.employees.find(employee=>employee.id===item.ownerEmployeeId);const department=officeState?.departments.find(d=>d.id===item.departmentId);article.append(textElement('div',`${roadmapScopeLabel(item)} · ${owner?.name||'Owner unavailable'}${department?` / ${department.name}`:''}${item.serviceContractId?' · shared-service contract':''}`,'outcome-owner'));
    if(item.evidence)article.append(textElement('p',`Evidence: ${item.evidence}`,'form-help'));
    const actions=textElement('div','','row wrap');const edit=textElement('button','Edit outcome','text-button');edit.type='button';edit.onclick=()=>editPortfolioRoadmap(item);actions.append(edit);
    const map=actionButton('Map ownership ↗');map.type='button';map.onclick=()=>workspaceTask(()=>mapRoadmapOwnership(item),'ceo-status');actions.append(map);article.append(actions);container.append(article);
  }
  if(!items.length)noData(container,'No saved outcomes match these filters. Add one with a scope and accountable owner.');if(items.length>80)container.append(textElement('p','Showing the first 80 matches. Filter by group, company, or department.','form-help'));
}
function renderPortfolioServices():void{
  const container=$('ceo-services');container.replaceChildren();const portfolio=portfolioState();if(!portfolio)return;
  const symbols:Record<PortfolioServiceKey,string>={engineering:'M8 4 4 8l4 4m8-8 4 4-4 4M14 2l-4 14','design-architecture':'M3 3h18v18H3Zm0 8h10V3m0 8v10m0-5h8','research-knowledge':'M12 5C8 2 5 3 2 4v15c3-1 6-2 10 1 4-3 7-2 10-1V4c-3-1-6-2-10 1Zm0 0v15',security:'M12 2 3 6v6c0 5 5 8 9 10 4-2 9-5 9-10V6Zm-5 10 3 3 7-7',hackathon:'M14 2 4 14h7l-1 8 10-13h-7Z','music-arts':'M9 17V5l12-3v13M9 9l12-3M9 17c0 2-1 3-3 3s-3-1-3-2 1-3 3-3 3 1 3 2Zm12-2c0 2-1 3-3 3s-3-1-3-2 1-3 3-3 3 1 3 2Z'};
  for(const service of portfolio.services){const card=textElement('article','','portfolio-service');card.dataset.serviceKey=service.key;const contracts=portfolio.contracts.filter(contract=>contract.serviceId===service.id&&contract.status==='active');const employees=service.employeeIds.map(id=>officeState?.employees.find(employee=>employee.id===id)).filter((employee):employee is OfficeEmployee=>Boolean(employee));
    const symbol=svgElement('svg',{viewBox:'0 0 24 24',class:'service-symbol','aria-hidden':'true',focusable:'false'});symbol.append(svgElement('path',{d:symbols[service.key]}));const recipients=new Set(contracts.map(contract=>contract.recipientCompanyId)).size;
    card.append(symbol,textElement('h4',service.name),textElement('span',service.status==='active'?'Staffing ready':'Paused','badge'),textElement('p',`${employees.length} shared ${employees.length===1?'specialist':'specialists'} · ${recipients} recipient ${recipients===1?'company':'companies'}`),textElement('p',employees.map(employee=>employee.name).join(' · ')||'No employee assigned'));
    card.append(portfolioNavigation('Open shared department ↗',service.companyId,'blueprint','text-button',service.officeId,service.departmentId));container.append(card);
  }
  if(!container.children.length)noData(container,'Prepare the shared-team preset to establish six specialties, including hackathon production and music and arts.');
}
function renderPortfolioContracts():void{
  const container=$('ceo-contracts');container.replaceChildren();const portfolio=portfolioState();if(!portfolio)return;
  for(const contract of portfolio.contracts.slice(0,100)){const service=portfolio.services.find(item=>item.id===contract.serviceId);const company=officeState?.companies.find(item=>item.id===contract.recipientCompanyId);const card=textElement('article','','portfolio-contract');card.append(textElement('h4',`${service?.name||'Shared service'} → ${company?.name||'Company unavailable'}`),textElement('p',`${contract.employeeIds.length} assigned people · ${contract.status}${contract.recipientDepartmentId?' · department scope':contract.recipientOfficeId?' · office scope':' · company scope'}`));
    const actions=textElement('div','','row wrap');if(contract.status!=='revoked'){actions.append(workspaceButton(contract.status==='paused'?'Resume contract':'Pause contract',async()=>{await workspaceCommand({action:'contract_service',...contract,status:contract.status==='paused'?'active':'paused'},'Shared-service contract updated.');}));}
    actions.append(portfolioNavigation('Open recipient ↗',contract.recipientCompanyId));card.append(actions);container.append(card);
  }
  if(!container.children.length)noData(container,'No shared-service contracts have been saved.');
}
function renderPortfolioMembers():void{
  const container=$('ceo-group-members');container.replaceChildren();const query=value('ceo-member-search').toLowerCase();const companies=portfolioCompanies().filter(company=>!query||company.name.toLowerCase().includes(query));
  for(const company of companies.slice(0,150)){const label=textElement('label','','check-label');const input=document.createElement('input');input.type='checkbox';input.value=company.id;input.checked=groupMembers.has(company.id);input.onchange=()=>{if(input.checked)groupMembers.add(company.id);else groupMembers.delete(company.id);};label.append(input,textElement('span',company.name));container.append(label);}if(!companies.length)noData(container,'No company matches.');
}
function editPortfolioGroup(id:string):void{
  const group=portfolioState()?.groups.find(item=>item.id===id);($('ceo-edit-group') as HTMLSelectElement).value=group?.id||'';($('ceo-group-name') as HTMLInputElement).value=group?.name||'';($('ceo-group-description') as HTMLTextAreaElement).value=group?.description||'';groupMembers=new Set(group?.companyIds||[]);renderPortfolioMembers();($('ceo-group-editor') as HTMLDetailsElement).open=true;$('ceo-group-editor').scrollIntoView({block:'nearest'});$('ceo-group-name').focus();
}
function renderContractRecipients():void{
  const companyId=value('ceo-contract-company');const offices=(officeState?.offices||[]).filter(office=>office.companyId===companyId);portfolioSelect('ceo-contract-office',offices,'All recipient offices');const officeId=value('ceo-contract-office');portfolioSelect('ceo-contract-department',(officeState?.departments||[]).filter(department=>department.companyId===companyId&&(!officeId||department.officeId===officeId)),'All recipient departments');
  const service=portfolioState()?.services.find(item=>item.id===value('ceo-contract-service'));if(contractPickerService!==service?.id){contractPickerService=service?.id||'';contractMembers=new Set(service?.employeeIds||[]);}
  const container=$('ceo-contract-employees');container.replaceChildren();for(const id of service?.employeeIds||[]){const employee=officeState?.employees.find(item=>item.id===id);if(!employee)continue;const label=textElement('label','','check-label');const input=document.createElement('input');input.type='checkbox';input.value=id;input.checked=contractMembers.has(id);input.onchange=()=>{if(input.checked)contractMembers.add(id);else contractMembers.delete(id);};label.append(input,textElement('span',`${employee.name} · ${employee.role}`));container.append(label);}if(!service)noData(container,'Choose a shared service.');
}
function renderRoadmapEditorSelectors():void{
  const kind=value('ceo-roadmap-scope');const portfolio=portfolioState();const targets=kind==='company'?portfolioCompanies():kind==='group'?portfolio?.groups||[]:[];portfolioSelect('ceo-roadmap-target',targets,kind==='global'?undefined:'Choose a target');$('ceo-roadmap-target-label').classList.toggle('hidden',kind==='global');
  const companyIds=kind==='company'?[value('ceo-roadmap-target')]:kind==='group'?portfolio?.groups.find(group=>group.id===value('ceo-roadmap-target'))?.companyIds||[]:portfolioCompanies().map(company=>company.id);const allowed=new Set(companyIds);const contracts=(portfolio?.contracts||[]).filter(contract=>contract.status==='active'&&allowed.has(contract.recipientCompanyId));const contracted=new Set(contracts.flatMap(contract=>contract.employeeIds));
  portfolioSelect('ceo-roadmap-owner',(officeState?.employees||[]).filter(employee=>employee.status!=='fired'&&(!employee.companyId||allowed.has(employee.companyId)||contracted.has(employee.id))).map(employee=>({id:employee.id,name:`${employee.name} · ${employee.role}`})),'Choose an owner');
  portfolioSelect('ceo-roadmap-owner-department',(officeState?.departments||[]).filter(department=>allowed.has(department.companyId)),'No department');portfolioSelect('ceo-roadmap-contract',contracts.map(contract=>({id:contract.id,name:`${portfolio?.services.find(service=>service.id===contract.serviceId)?.name||'Shared service'} → ${officeState?.companies.find(company=>company.id===contract.recipientCompanyId)?.name||''}`})),'Direct ownership');
}
function editPortfolioRoadmap(item?:PortfolioRoadmapItem):void{
  ($('ceo-roadmap-form') as HTMLFormElement).reset();($('ceo-roadmap-id') as HTMLInputElement).value=item?.id||'';($('ceo-roadmap-title') as HTMLInputElement).value=item?.title||'';($('ceo-roadmap-description') as HTMLTextAreaElement).value=item?.description||'';($('ceo-roadmap-scope') as HTMLSelectElement).value=item?.scope.kind||'global';renderRoadmapEditorSelectors();if(item?.scope.kind!=='global')($('ceo-roadmap-target') as HTMLSelectElement).value=item?.scope.id||'';renderRoadmapEditorSelectors();($('ceo-roadmap-owner') as HTMLSelectElement).value=item?.ownerEmployeeId||'donna';($('ceo-roadmap-owner-department') as HTMLSelectElement).value=item?.departmentId||'';($('ceo-roadmap-contract') as HTMLSelectElement).value=item?.serviceContractId||'';($('ceo-roadmap-edit-status') as HTMLSelectElement).value=item?.status||'planned';($('ceo-roadmap-evidence') as HTMLInputElement).value=item?.evidence||'';($('ceo-roadmap-editor') as HTMLDetailsElement).open=true;$('ceo-roadmap-editor').scrollIntoView({block:'nearest'});$('ceo-roadmap-title').focus();
}
async function mapRoadmapOwnership(item:PortfolioRoadmapItem):Promise<void>{
  const companies=scopeCompanies(item);const companyId=companies.includes(officeCompany()?.id||'')?officeCompany()!.id:companies[0];if(!companyId)throw new Error('Add a company to this roadmap scope before mapping ownership.');
  await openPortfolioCompany(companyId,'whiteboard');await ensureWorkspaceBlueprint();resetBoardForm();($('node-title') as HTMLInputElement).value=item.title;($('node-owner') as HTMLSelectElement).value=item.ownerEmployeeId;($('node-roadmap') as HTMLSelectElement).value=item.id;$('node-title').focus();setStatus($('node-save-status'),'Choose the room, then save this roadmap ownership card.');
}
function optimizeGroups():Array<{id:string;name:string;description:string;companyIds:string[];status:OfficeEntityStatus}>{
  const portfolio=portfolioState();const companies=portfolioCompanies();const groups=(portfolio?.groups||[]).map(group=>({id:group.id,name:group.name,description:group.description,companyIds:[...group.companyIds],status:group.status}));const assigned=new Set(groups.flatMap(group=>group.companyIds));const missing=companies.filter(company=>!assigned.has(company.id)).map(company=>company.id);
  if(missing.length){const fallback=groups.find(group=>group.id==='portfolio-ungrouped');if(fallback)fallback.companyIds.push(...missing);else groups.push({id:'portfolio-ungrouped',name:'Ungrouped projects',description:'Imported companies awaiting membership review. No code-similarity inference has been made.',companyIds:missing,status:'active'});}return groups;
}
function renderPortfolio():void{
  const portfolio=portfolioState();const ready=portfolioReady();const companies=portfolioCompanies();const contracts=(portfolio?.contracts||[]).filter(contract=>contract.status==='active');const shared=new Set((portfolio?.services||[]).flatMap(service=>service.employeeIds));const assignments=contracts.reduce((sum,contract)=>sum+contract.employeeIds.length,0);const live=(officeState?.jobs||[]).filter(job=>job.status==='running');const queued=(officeState?.jobs||[]).filter(job=>['queued','waiting-budget'].includes(job.status)&&job.mode==='provider');
  const groupCount=portfolio?.groups.length||0;
  $('ceo-entry-summary').textContent=ready?`${companies.length} ${companies.length===1?'company':'companies'} · ${groupCount} ${groupCount===1?'group':'groups'} · ${shared.size} shared ${shared.size===1?'specialist':'specialists'}`:'Companies, shared teams, and the portfolio roadmap';$('ceo-company-count').textContent=number(companies.length);$('ceo-group-count').textContent=`${groupCount} portfolio ${groupCount===1?'group':'groups'}`;$('ceo-shared-count').textContent=number(shared.size);$('ceo-reuse-count').textContent=`${assignments} contracted ${assignments===1?'assignment reuses':'assignments reuse'} saved employees`;$('ceo-contract-count').textContent=number(contracts.length);$('ceo-running-count').textContent=number(live.length);$('ceo-queued-count').textContent=`${queued.length} queued provider ${queued.length===1?'request':'requests'}`;$('ceo-directory-count').textContent=number(companies.length);
  $('ceo-operating-state').textContent=!ready?'Current desktop required':portfolio!.ceo.enabled?'Coordination policy enabled':'Coordination policy paused';$('ceo-operating-state').className=`pill ${ready&&portfolio!.ceo.enabled?'ok':'neutral'}`;
  if(portfolio&&!$('ceo-policy-form').contains(document.activeElement)){($('ceo-policy-title') as HTMLInputElement).value=portfolio.ceo.title;($('ceo-enabled') as HTMLInputElement).checked=portfolio.ceo.enabled;}
  renderPortfolioSelectors();if(portfolio&&!$('ceo-policy-form').contains(document.activeElement))($('ceo-focus-group') as HTMLSelectElement).value=portfolio.ceo.focusGroupId||'';
  renderPortfolioDirectory();renderPortfolioRoadmap();renderPortfolioServices();renderPortfolioContracts();renderPortfolioMembers();
  for(const id of ['ceo-optimize','ceo-ensure-services'])($(id) as HTMLButtonElement).disabled=!ready||workspaceReadOnly();
  $('ceo-panel').querySelectorAll<HTMLButtonElement>('form button[type="submit"]').forEach(button=>button.disabled=!ready||workspaceReadOnly());
  renderAuthority();
}
const AUTHORITY_CAPABILITIES:Record<string,string>={
  'team.manage':'Manage teams','work.manage':'Manage jobs and goals','knowledge.manage':'Manage knowledge',
  'layout.manage':'Arrange rooms and ownership','roadmap.manage':'Manage roadmaps','cache.manage':'Clear scoped cache',
  'authority.manage':'Delegate authority','provider.run':'Run approved provider work',
  'github.read_repository':'Read repository evidence','github.publish_changes':'Publish reviewed changes',
};
function authorityReady():boolean{return workspaceAvailable()&&Boolean(officeState?.authority);}
function authorityName(id:string|null|undefined):string{
  if(!id)return 'Workspace';if(id==='owner')return 'You · owner';
  const rows:Array<{id:string;name?:string;title?:string}>=[...(officeState?.employees||[]),...(officeState?.companies||[]),...(officeState?.offices||[]),...(officeState?.departments||[]),...(officeState?.goals||[])];
  const row=rows.find(item=>item.id===id);return row?.name||row?.title||id;
}
function authorityScopeLabel(scope:AuthorityScope|null):string{return scope?`${scope.kind} · ${authorityName(scope.id)}`:'Owner workspace';}
function authorityGrantState(grant:AuthorityGrant,seen=new Set<string>()):'active'|'expired'|'revoked'|'scheduled'|'inherited-ended'{
  if(grant.revokedAt)return 'revoked';if(Date.parse(grant.expiresAt)<=Date.now())return 'expired';
  if(Date.parse(grant.grantedAt)>Date.now())return 'scheduled';if(seen.has(grant.id))return 'inherited-ended';
  const visited=new Set(seen);visited.add(grant.id);
  for(const id of grant.parentGrantIds||[]){const parent=officeState?.authority?.grants.find(g=>g.id===id);if(!parent||authorityGrantState(parent,visited)!=='active')return 'inherited-ended';}
  return 'active';
}
function authorityTargets():void{
  const kind=value('authority-scope');let rows:Array<{id:string;name:string}>=[];
  if(kind==='company')rows=(officeState?.companies||[]).map(x=>({id:x.id,name:x.name}));
  if(kind==='office')rows=(officeState?.offices||[]).map(x=>({id:x.id,name:`${x.name} · ${authorityName(x.companyId)}`}));
  if(kind==='department')rows=(officeState?.departments||[]).map(x=>({id:x.id,name:`${x.name} · ${authorityName(x.companyId)}`}));
  if(kind==='employee')rows=(officeState?.employees||[]).map(x=>({id:x.id,name:x.name}));
  if(kind==='goal')rows=(officeState?.goals||[]).map(x=>({id:x.id,name:x.title}));
  populateSelect($('authority-target') as HTMLSelectElement,rows,value('authority-target')||officeState?.activeCompanyId||'');
}
function renderAuthorityForm():void{
  const promotion=value('authority-type')==='promotion',full=value('authority-preset')==='full';
  $('authority-title-field').classList.toggle('hidden',!promotion);($('authority-title') as HTMLInputElement).required=promotion;
  ($('authority-capabilities') as HTMLFieldSetElement).disabled=full;
  $('authority-grant-submit').textContent=promotion?'Save timed promotion':'Save timed grant';
  $('authority-rights-note').textContent=full?'Full covers the listed in-app capabilities within this scope and time limit. Global budgets, existing job approvals and native validation still apply.':'Partial grants carry only the selected capabilities. Donna can delegate only within her own active scope, capabilities and expiry.';
  const selected=value('authority-employee'),managed=officeState?.authority?.managedEmployeeIds.includes(selected)===true;
  $('authority-enforcement-state').textContent=selected?`${authorityName(selected)} · ${managed?'Live scoped grants required. Expired or revoked grants do not restore access.':'Existing per-job owner authorization. Use the policy below to require live scoped grants.'}`:'Choose an employee to inspect their policy.';
  if(!$('authority-enforcement-form').contains(document.activeElement))($('authority-enforcement') as HTMLSelectElement).value=String(managed);
}
function renderAuthorityGrants():void{
  const selected=value('authority-employee'),grants=(officeState?.authority?.grants||[]).filter(g=>!selected||g.employeeId===selected);
  const area=$('authority-grants');area.replaceChildren();
  $('authority-grant-count').textContent=`${grants.filter(g=>authorityGrantState(g)==='active').length} active`;
  for(const grant of [...grants].reverse().slice(0,60)){
    const state=authorityGrantState(grant),card=textElement('article','',`authority-grant authority-${state}`);card.dataset.grantId=grant.id;
    const head=textElement('div','','authority-record-heading');head.append(textElement('strong',grant.title||'Permission grant'),textElement('span',state==='inherited-ended'?'Inherited authority ended':state,`pill ${state==='active'?'ok':'neutral'}`));
    card.append(head,textElement('p',`${authorityName(grant.employeeId)} · ${authorityScopeLabel(grant.scope)}`,'authority-record-meta'));
    card.append(textElement('p',grant.capabilities.map(c=>AUTHORITY_CAPABILITIES[c]||c).join(' · '),'authority-rights-list'));
    card.append(textElement('p',grant.reason,'authority-reason'),textElement('p',`Issued by ${authorityName(grant.issuer)} · expires ${dateLabel(grant.expiresAt,true)}`,'authority-record-meta'));
    if(grant.parentGrantIds?.length)card.append(textElement('p',`Depends on ${grant.parentGrantIds.length} parent grant${grant.parentGrantIds.length===1?'':'s'}. Revocation or expiry of a parent ends these delegated rights.`,'authority-record-meta'));
    if(grant.revokedAt)card.append(textElement('p',`Revoked ${dateLabel(grant.revokedAt,true)} by ${authorityName(grant.revokedBy)}${grant.revokeReason?` · ${grant.revokeReason}`:''}`,'authority-record-meta'));
    if(!grant.revokedAt&&!workspaceReadOnly()){
      const form=document.createElement('form');form.className='authority-revoke';
      const reason=document.createElement('input');reason.required=true;reason.maxLength=1000;reason.placeholder='Reason for revoking';reason.setAttribute('aria-label',`Reason for revoking ${grant.title||'permission grant'}`);
      const button=textElement('button','Revoke','secondary small');button.type='submit';form.append(reason,button);
      form.onsubmit=event=>{event.preventDefault();workspaceTask(async()=>{if(!reason.value.trim())throw new Error('Record a reason before revoking this assignment.');button.disabled=true;try{await workspaceCommand({action:'revoke_authority',grantId:grant.id,issuer:value('authority-issuer'),reason:reason.value.trim()},'Authority revoked. Saved work and its decision history remain.');setStatus($('authority-status'),'Authority revoked. New delegated actions must satisfy the remaining live grants.','ok');}finally{button.disabled=false;}},'authority-status');};card.append(form);
    }
    area.append(card);
  }
  if(!grants.length)noData(area,authorityReady()?'No timed grants for this employee. Choose a scope and duration to assign responsibility.':'Load a desktop version with authority support to manage permissions.');
}
function humanAuthorityIndex():OfficeIndexEntry[]{
  const internalIds=new Set((officeState?.knowledge||[]).filter(isInternalKitKnowledge).map(note=>note.id));
  return (officeState?.authority?.index||[]).filter(row=>row.kind!=='knowledge'||!internalIds.has(row.entityId));
}
function renderAuthorityRegister():void{
  const query=value('authority-search').toLocaleLowerCase(),filter=value('authority-record-filter');
  const matches=(parts:unknown[])=>parts.map(x=>String(x??'')).join(' ').toLocaleLowerCase().includes(query);
  const index=humanAuthorityIndex().filter(r=>matches([r.kind,r.title,r.entityId,r.status,authorityName(r.companyId),authorityName(r.ownerEmployeeId),r.relatedIds.join(' ')]));
  const ledger=(officeState?.authority?.ledger||[]).filter(r=>matches([r.action,r.summary,r.targetId,authorityName(r.targetId),authorityName(r.actor),authorityScopeLabel(r.scope),r.outcome]));
  $('authority-index-section').classList.toggle('hidden',filter==='ledger');$('authority-ledger-section').classList.toggle('hidden',filter==='index');
  $('authority-register-count').textContent=`${filter==='ledger'?0:index.length} indexed · ${filter==='index'?0:ledger.length} decisions`;
  const indexArea=$('authority-index'),ledgerArea=$('authority-ledger');indexArea.replaceChildren();ledgerArea.replaceChildren();
  for(const row of index.slice(0,80)){
    const card=textElement('article','','authority-index-row');card.dataset.entityId=row.entityId;card.append(textElement('strong',row.title),textElement('p',`${row.kind} · ${row.status} · ${authorityName(row.companyId)}`,'authority-record-meta'));
    if(row.ownerEmployeeId)card.append(textElement('p',`Owner: ${authorityName(row.ownerEmployeeId)}`,'authority-record-meta'));
    if(row.companyId&&officeState?.companies.some(c=>c.id===row.companyId))card.append(portfolioNavigation('Open company',row.companyId));indexArea.append(card);
  }
  for(const row of [...ledger].reverse().slice(0,80)){
    const card=textElement('article','','authority-ledger-row');card.dataset.ledgerId=row.id;const heading=textElement('div','','authority-record-heading');heading.append(textElement('strong',row.action.replaceAll('_',' ')),textElement('span',row.outcome,`pill ${row.outcome==='denied'?'error':'neutral'}`));
    card.append(heading,textElement('p',row.summary),textElement('p',`${authorityName(row.actor)} → ${authorityName(row.targetId)} · ${authorityScopeLabel(row.scope)}`,'authority-record-meta'),textElement('time',dateLabel(row.at,true),'authority-record-meta'));ledgerArea.append(card);
  }
  if(!index.length)noData(indexArea,query?'No indexed records match this search.':'The native core indexes saved companies, people, work and evidence.');
  if(!ledger.length)noData(ledgerArea,query?'No authority decisions match this search.':'Grant, promotion, revocation and policy decisions appear here after they are saved.');
  if(index.length>80)indexArea.append(textElement('p',`Showing 80 of ${index.length}. Narrow the search to find more.`,'form-help'));
  if(ledger.length>80)ledgerArea.append(textElement('p',`Showing the latest 80 of ${ledger.length}. Narrow the search to find earlier decisions.`,'form-help'));
}
function renderAuthority():void{
  const authority=officeState?.authority,available=authorityReady()&&!workspaceReadOnly();
  $('authority-summary').textContent=authority?`${authority.grants.filter(g=>authorityGrantState(g)==='active').length} active grants · ${authority.managedEmployeeIds.length} managed employees · ${humanAuthorityIndex().length} indexed records`:'Current native version required · saved work remains available';
  populateSelect($('authority-employee') as HTMLSelectElement,(officeState?.employees||[]).filter(e=>e.status!=='fired'),value('authority-employee')||'donna');
  authorityTargets();renderAuthorityForm();renderAuthorityGrants();renderAuthorityRegister();
  for(const id of ['authority-grant-submit','authority-enforcement-submit'])($(id) as HTMLButtonElement).disabled=!available;
}
function initAuthority():void{
  const capabilities=$('authority-capabilities');for(const [key,label] of Object.entries(AUTHORITY_CAPABILITIES)){
    const item=document.createElement('label'),input=document.createElement('input');input.type='checkbox';input.value=key;input.name='authority-capability';item.append(input,textElement('span',label));capabilities.append(item);
  }
  function duration(hours:number){const local=new Date(Date.now()+hours*3600000);local.setMinutes(local.getMinutes()-local.getTimezoneOffset());($('authority-expiry') as HTMLInputElement).value=local.toISOString().slice(0,16);}
  duration(24);document.querySelectorAll<HTMLButtonElement>('[data-authority-hours]').forEach(button=>button.onclick=()=>duration(Number(button.dataset.authorityHours)));
  $('authority-scope').addEventListener('change',authorityTargets);for(const id of ['authority-type','authority-preset','authority-issuer'])$(id).addEventListener('change',renderAuthorityForm);
  $('authority-employee').addEventListener('change',()=>{renderAuthorityForm();renderAuthorityGrants();});
  $('authority-search').addEventListener('input',renderAuthorityRegister);$('authority-record-filter').addEventListener('change',renderAuthorityRegister);
  workspaceForm('authority-grant-form',async()=>{
    if(!authorityReady()||workspaceReadOnly())throw new Error('Authority changes require a writable current desktop workspace.');
    const employeeId=value('authority-employee'),scope={kind:value('authority-scope'),id:value('authority-target')},reason=value('authority-reason'),promotion=value('authority-type')==='promotion',title=value('authority-title'),expiry=new Date(value('authority-expiry'));
    const preset=value('authority-preset'),capabilities=Array.from(document.querySelectorAll<HTMLInputElement>('#authority-capabilities input:checked')).map(input=>input.value);
    if(!employeeId||!scope.id||!reason)throw new Error('Choose an employee and scope, then record a reason.');
    if(!Number.isFinite(expiry.getTime())||expiry.getTime()<=Date.now())throw new Error('Choose a future expiry. Saved work is retained when a grant ends.');
    if(promotion&&!title)throw new Error('Give the temporary promotion a title. The employee’s permanent role is preserved.');
    if(preset==='partial'&&!capabilities.length)throw new Error('Select at least one capability for a partial grant.');
    await workspaceCommand({action:promotion?'promote_employee':'grant_authority',employeeId,scope,preset,...(preset==='partial'?{capabilities}:{}),expiresAt:expiry.toISOString(),issuer:value('authority-issuer'),reason,...(promotion?{title}:{})},'Timed authority saved.');
    setStatus($('authority-status'),`${promotion?'Temporary promotion':'Permission grant'} saved with a scope and expiry. The native core checks delegated operations; no provider call was made.`,'ok');
  },'authority-status');
  workspaceForm('authority-enforcement-form',async()=>{
    if(!authorityReady()||workspaceReadOnly())throw new Error('Owner policy changes require a writable current desktop workspace.');
    const employeeId=value('authority-employee'),reason=value('authority-enforcement-reason');if(!employeeId||!reason)throw new Error('Choose an employee and record the policy reason.');
    await workspaceCommand({action:'set_authority_enforcement',employeeId,requireGrants:value('authority-enforcement')==='true',reason},'Owner dispatch policy saved.');
    setStatus($('authority-status'),'Owner dispatch policy saved. Existing budgets and explicit job authorization still apply.','ok');
  },'authority-status');
  $('ceo-authority-editor').addEventListener('toggle',()=>{if(($('ceo-authority-editor') as HTMLDetailsElement).open)renderAuthority();});
  setInterval(()=>{if(portfolioOpen&&!document.hidden&&($('ceo-authority-editor') as HTMLDetailsElement).open&&!$('ceo-authority-editor').contains(document.activeElement))renderAuthority();},30000);
  renderAuthority();
}
function initPortfolio():void{
  $('ceo-toggle').onclick=()=>setPortfolioOpen(!portfolioOpen);$('ceo-company-search').addEventListener('input',renderPortfolioDirectory);$('ceo-member-search').addEventListener('input',renderPortfolioMembers);
  for(const id of ['ceo-roadmap-group','ceo-roadmap-company','ceo-roadmap-department','ceo-roadmap-status'])$(id).addEventListener('change',()=>{renderPortfolioSelectors();renderPortfolioRoadmap();});
  for(const id of ['ceo-roadmap-scope','ceo-roadmap-target'])$(id).addEventListener('change',renderRoadmapEditorSelectors);
  for(const id of ['ceo-contract-service','ceo-contract-company','ceo-contract-office'])$(id).addEventListener('change',renderContractRecipients);
  $('ceo-edit-group').addEventListener('change',()=>editPortfolioGroup(value('ceo-edit-group')));$('ceo-add-roadmap').onclick=()=>editPortfolioRoadmap();
  $('ceo-ensure-services').onclick=()=>workspaceTask(async()=>{await workspaceCommand({action:'ensure_shared_services',preset:'standard'},'Shared-service departments and persistent specialist roles prepared. No provider request was made.');},'ceo-status');
  $('ceo-optimize').onclick=()=>workspaceTask(async()=>{if(!portfolioReady())throw new Error('Load the current native portfolio first.');setPortfolioOpen(true);const groups=optimizeGroups();if(!groups.length)throw new Error('Import or create a company before optimizing the portfolio.');await workspaceCommand({action:'optimize_portfolio',groups,preset:'standard',pauseRedundant:false},'Portfolio membership and shared-service contracts updated. New imports remain in the reviewable Ungrouped projects collection.');setStatus($('ceo-status'),'Shared staffing prepared from saved memberships. This local operation did not call a model.','ok');},'ceo-status');
  workspaceForm('ceo-group-form',async()=>{if(!portfolioReady())throw new Error('Portfolio support is unavailable.');const previous=portfolioState()?.groups.find(group=>group.id===value('ceo-edit-group'));const name=value('ceo-group-name');if(!name)throw new Error('Give the group a name.');const state=await workspaceCommand({action:'upsert_portfolio_group',id:previous?.id,name,description:value('ceo-group-description'),companyIds:Array.from(groupMembers),status:previous?.status||'active'},'Group membership saved.');const saved=state.portfolio?.groups.find(group=>previous?group.id===previous.id:group.name===name);if(saved)editPortfolioGroup(saved.id);setStatus($('ceo-group-status'),'Group membership saved.','ok');},'ceo-group-status');
  workspaceForm('ceo-move-company-form',async()=>{const companyId=value('ceo-move-company');const groupId=value('ceo-move-group');if(!companyId||!groupId)throw new Error('Choose a company and destination group.');const groups=(portfolioState()?.groups||[]).map(group=>({id:group.id,name:group.name,description:group.description,status:group.status,companyIds:group.id===groupId?[...new Set([...group.companyIds,companyId])]:group.companyIds.filter(id=>id!==companyId)}));await workspaceCommand({action:'optimize_portfolio',groups,preset:'standard',pauseRedundant:false},'Company group membership and shared contracts updated.');setStatus($('ceo-move-status'),'Company moved and shared teams updated.','ok');},'ceo-move-status');
  workspaceForm('ceo-contract-form',async()=>{const serviceId=value('ceo-contract-service');const recipientCompanyId=value('ceo-contract-company');if(!serviceId||!recipientCompanyId||!contractMembers.size)throw new Error('Choose a service, recipient, and at least one shared specialist.');const recipientOfficeId=value('ceo-contract-office')||null;const recipientDepartmentId=value('ceo-contract-department')||null;const previous=portfolioState()?.contracts.find(contract=>contract.serviceId===serviceId&&contract.recipientCompanyId===recipientCompanyId&&contract.recipientOfficeId===recipientOfficeId&&contract.recipientDepartmentId===recipientDepartmentId);await workspaceCommand({action:'contract_service',id:previous?.id,serviceId,recipientCompanyId,recipientOfficeId,recipientDepartmentId,employeeIds:Array.from(contractMembers),allowedTools:previous?.allowedTools||[],status:'active'},'Shared-service contract saved.');setStatus($('ceo-contract-status'),'Staffing contract saved with the selected recipient scope.','ok');},'ceo-contract-status');
  workspaceForm('ceo-roadmap-form',async()=>{const previous=portfolioState()?.roadmap.find(item=>item.id===value('ceo-roadmap-id'));const kind=value('ceo-roadmap-scope') as PortfolioRoadmapItem['scope']['kind'];const id=kind==='global'?'portfolio':value('ceo-roadmap-target');const title=value('ceo-roadmap-title');const ownerEmployeeId=value('ceo-roadmap-owner');const status=value('ceo-roadmap-edit-status');const evidence=value('ceo-roadmap-evidence');if(!id||!title||!ownerEmployeeId)throw new Error('Give the outcome a scope, title, and accountable owner.');if(status==='done'&&!evidence)throw new Error('Add completion evidence before marking a portfolio outcome Done.');await workspaceCommand({action:'upsert_roadmap_item',id:previous?.id,scope:{kind,id},title,description:value('ceo-roadmap-description'),ownerEmployeeId,departmentId:value('ceo-roadmap-owner-department')||null,serviceContractId:value('ceo-roadmap-contract')||null,status,evidence:evidence||null,dependencies:previous?.dependencies||[],goalIds:previous?.goalIds||[],jobIds:previous?.jobIds||[]},'Portfolio roadmap outcome saved.');setStatus($('ceo-roadmap-save-status'),'Outcome, ownership, and evidence saved.','ok');},'ceo-roadmap-save-status');
  workspaceForm('ceo-policy-form',async()=>{await workspaceCommand({action:'configure_ceo',enabled:($('ceo-enabled') as HTMLInputElement).checked,title:value('ceo-policy-title'),focusGroupId:value('ceo-focus-group')||null},'CEO coordination policy saved.');setStatus($('ceo-status'),'Saved CEO policy. Worker activity remains controlled by the dispatcher and global budgets.','ok');},'ceo-status');
  workspaceForm('ceo-review-form',async()=>{const companyIds=filteredPortfolioCompanies().map(company=>company.id);if(!companyIds.length)throw new Error('Select at least one company in the portfolio filter.');const provider=value('ceo-review-provider');const model=value('ceo-review-model');const maxUsd=Number(value('ceo-review-usd'));const maxTokens=Number(value('ceo-review-tokens'));const priceRates={inputUsdPerMillion:Number(value('ceo-review-rate-input')),outputUsdPerMillion:Number(value('ceo-review-rate-output'))};if(!model||!Number.isFinite(maxUsd)||maxUsd<=0||maxUsd>100||!Number.isInteger(maxTokens)||maxTokens<1||maxTokens>200000)throw new Error('Use a model, positive token limit, and spend ceiling up to $100.');if(provider!=='ollama'&&(!Number.isFinite(priceRates.inputUsdPerMillion)||!Number.isFinite(priceRates.outputUsdPerMillion)||priceRates.inputUsdPerMillion<=0||priceRates.outputUsdPerMillion<=0))throw new Error('Enter current positive cloud-provider prices.');await workspaceCommand({action:'schedule_repository_reviews',companyIds,everyMinutes:1440,enabled:false,provider,model,maxUsd,maxTokens,priceRates},'Paused recurring repository reviews prepared.');setStatus($('ceo-review-status'),'Daily reviews are prepared and paused. Open a company’s schedules to activate them. Reviews produce proposals; publishing is a separate action.','ok');},'ceo-review-status');
  $('queue-service-contract').addEventListener('change',renderOfficeScope);$('node-room').addEventListener('change',renderSpatialSelectors);renderPortfolio();
}
function contractedRoomEmployees(roomId:string,base:OfficeEmployee[],retainOwner=false):OfficeEmployee[]{
  const room=currentBlueprint()?.rooms.find(item=>item.id===roomId);const ids=new Set(base.map(employee=>employee.id));
  for(const service of portfolioState()?.services||[])if(service.companyId===officeCompany()?.id&&service.officeId===selectedOfficeId&&(!room?.departmentId||service.departmentId===room.departmentId))for(const id of service.employeeIds)ids.add(id);
  for(const contract of portfolioState()?.contracts||[])if(contract.status==='active'&&contract.recipientCompanyId===officeCompany()?.id&&(!contract.recipientOfficeId||contract.recipientOfficeId===selectedOfficeId)&&(!contract.recipientDepartmentId||contract.recipientDepartmentId===room?.departmentId))for(const id of contract.employeeIds)ids.add(id);
  if(retainOwner){const board=currentBlueprint()?.whiteboards.find(item=>item.id===value('node-id'));if(board)ids.add(board.ownerEmployeeId);}
  return(officeState?.employees||[]).filter(employee=>ids.has(employee.id)&&employee.status!=='fired');
}
function scopedServiceContracts():PortfolioServiceContract[]{return(portfolioState()?.contracts||[]).filter(contract=>contract.status==='active'&&contract.recipientCompanyId===officeCompany()?.id&&(!contract.recipientOfficeId||contract.recipientOfficeId===selectedOfficeId)&&(!contract.recipientDepartmentId||contract.recipientDepartmentId===selectedDepartmentId));}


// ---------------------------------------------------------------- studio, connected devices, and decision rooms
class QueuedWorkspaceCommand extends Error {}
function appliedOfficeSnapshot(result: OfficeResult): OfficeSnapshot {
  if (!result.ok || !result.snapshot) throw new Error(result.error || 'The workspace change could not be saved.');
  officeSampledAt = new Date().toISOString();
  if (result.queued) {
    officeState=result.snapshot;renderOffice();
    throw new QueuedWorkspaceCommand(`Queued for desktop confirmation${result.commandId ? ` · ${result.commandId}` : ''}. This change has not been applied yet.`);
  }
  return result.snapshot;
}
function renderWorkspaceLocator(): void {
  $('locator-company').textContent=officeCompany()?.name||'Choose a company';
  $('locator-office').textContent=officeLocation()?.name||'Choose an office';
  $('locator-department').textContent=officeState?.departments.find(item=>item.id===selectedDepartmentId)?.name||'All departments';
  const employees=scopedEmployees().filter(employee=>employee.status==='active');
  const running=scopedJobs().filter(job=>job.status==='running').length;
  $('locator-people').textContent=officeState?`${employees.length} assigned ${employees.length===1?'person':'people'} · ${running} running ${running===1?'request':'requests'}`:'Workspace not loaded';
}
let cloudState: CloudConnectionStatus | null = null;
let cloudBusy = false;
let cloudChatBusy = false;
async function refreshCloudConnection(): Promise<void> {
  if(!bridge?.cloudStatus){renderCloudConnection();return;}
  try{cloudState=await bridge.cloudStatus();renderCloudConnection();}
  catch(error){setStatus($('cloud-status'),error instanceof Error?error.message:'Cloud status could not be loaded.','error');}
}
function renderCloudConnection(): void {
  const preview=workspaceReadOnly();const hosted=bridge?.transport==='cloud-browser';const available=Boolean(bridge?.configureCloud)&&!preview&&!hosted;
  const unloadedHosted=hosted&&!officeState;
  if(hosted){$('core-label').textContent=unloadedHosted?'Cloud workspace not loaded':'Private cloud workspace';$('core-note').textContent=unloadedHosted?'Open welcome to check sign-in':'Desktop executes queued commands';}
  $('cloud-workspace-notice').classList.toggle('hidden',!unloadedHosted);($('cloud-welcome') as HTMLButtonElement).disabled=!bridge?.backToLauncher;
  const label=preview?'Read-only preview':unloadedHosted?'Cloud not loaded':hosted?'Cloud session':cloudState?.connected?'Cloud linked':cloudState?.configured?'Cloud offline':officeState?'Saved locally':'Local workspace';
  $('workspace-save-label').textContent=label;$('workspace-save-status').title=unloadedHosted?'No cloud workspace snapshot is loaded. Open welcome to check sign-in or retry the workspace refresh.':cloudState?.lastSyncedAt?`Last explicit sync: ${dateLabel(cloudState.lastSyncedAt,true)}. New edits remain local until the next sync.`:preview?'Example data only. Changes are disabled.':hosted?'Signed-in cloud conversation; owner commands require desktop acknowledgement.':'Local state and optional cloud connection';
  $('cloud-state').textContent=preview?'Example · unavailable':unloadedHosted?'Cloud not loaded':hosted?'Signed-in cloud view':cloudBusy?'Working…':cloudState?.connected?'Device authenticated':cloudState?.configured?'Connection needs attention':'Not connected';
  $('cloud-state').className=`pill ${!unloadedHosted&&(cloudState?.connected||hosted)?'ok':'neutral'}`;
  $('cloud-local-state').textContent=preview?'Example data':unloadedHosted?'Not loaded':hosted?'Last desktop projection':officeState?'Saved on this device':'Not loaded';
  $('cloud-last-sync').textContent=cloudState?.lastSyncedAt?dateLabel(cloudState.lastSyncedAt,true):'Never';
  $('cloud-revision').textContent=cloudState?.revision===null||cloudState?.revision===undefined?'—':String(cloudState.revision);
  $('cloud-pending').textContent=number(cloudState?.pendingCommands||0);
  if(cloudState?.url&&document.activeElement!==$('cloud-url'))($('cloud-url') as HTMLInputElement).value=cloudState.url;
  for(const id of ['cloud-url','cloud-device-token'])($(id) as HTMLInputElement).disabled=!available||cloudBusy;
  ($('cloud-connect') as HTMLButtonElement).disabled=!available||cloudBusy||cloudState?.encryptionAvailable===false;
  ($('cloud-sync') as HTMLButtonElement).disabled=!available||cloudBusy||!cloudState?.configured;
  ($('cloud-disconnect') as HTMLButtonElement).disabled=!available||cloudBusy||!cloudState?.configured;
  ($('cloud-open-site') as HTMLButtonElement).disabled=(unloadedHosted?!bridge?.backToLauncher:!bridge?.openExternal)||cloudBusy;$('cloud-open-site').textContent=unloadedHosted?'Open welcome / sign in':hosted?'Open device connections':'Open website & sign in';
  ($('editor-pair') as HTMLButtonElement).disabled=!bridge?.copyEditorPairing||preview||hosted;
  if(preview)setStatus($('cloud-status'),'This starter preview cannot connect a device or sync data. Open the private desktop app to pair your account.');
  else if(unloadedHosted)setStatus($('cloud-status'),'Cloud workspace is not loaded. Open welcome to check sign-in, or refresh to try again.');
  else if(hosted)setStatus($('cloud-status'),'This is your cloud conversation and last acknowledged desktop state. Pair a desktop from the website’s account page to process queued owner commands.');
  else if(cloudState?.error)setStatus($('cloud-status'),cloudState.error,'error');
  else if(!available)setStatus($('cloud-status'),'Cloud pairing requires the current desktop app. Your existing workspace remains available.');
}
async function cloudAction(action:()=>Promise<CloudConnectionResult>,success:string):Promise<void>{
  if(cloudBusy)return;cloudBusy=true;renderCloudConnection();setStatus($('cloud-status'),'Contacting your private workspace…');
  try{const result=await action();cloudState=result.status;if(!result.ok)throw new Error(result.error||result.status.error||'The cloud operation did not complete.');setStatus($('cloud-status'),success,'ok');}
  finally{cloudBusy=false;renderCloudConnection();}
}
function cloudWebsiteUrl():string{
  if(bridge?.transport==='cloud-browser')return new URL('/#devices',location.origin).href;
  const url=new URL(value('cloud-url'));if(url.username||url.password||!(url.protocol==='https:'||(url.protocol==='http:'&&['127.0.0.1','localhost'].includes(url.hostname))))throw new Error('Use an HTTPS website URL, without embedded credentials.');return url.href;
}
function initCloudConnection():void{
  $('workspace-save-status').onclick=()=>{navigate('settings');$('cloud-connection-panel').scrollIntoView({block:'start'});$('cloud-open-site').focus();};
  const openWelcome=async()=>{if(!bridge?.backToLauncher)throw new Error('The welcome page is unavailable in this view.');const result=await bridge.backToLauncher();if(!result.ok)throw new Error('The welcome page could not be opened.');};
  $('cloud-welcome').onclick=()=>workspaceTask(openWelcome,'cloud-workspace-notice-message');
  $('cloud-open-site').onclick=()=>workspaceTask(async()=>{if(bridge?.transport==='cloud-browser'&&!officeState){await openWelcome();return;}const url=cloudWebsiteUrl();if(!bridge?.openExternal)throw new Error('Open the private website from your browser.');const result=await bridge.openExternal(url);if(!result.ok)throw new Error(result.error||'The website could not be opened.');setStatus($('cloud-status'),'Website opened. Complete sign-in there and copy its device pairing token.');},'cloud-status');
  $('cloud-connect-form').addEventListener('submit',event=>{event.preventDefault();workspaceTask(async()=>{if(!bridge?.configureCloud||workspaceReadOnly())throw new Error('Device pairing requires the private desktop app.');const token=value('cloud-device-token');($('cloud-device-token') as HTMLInputElement).value='';if(!token)throw new Error('Paste the device token from your signed-in website.');const url=cloudWebsiteUrl();await cloudAction(()=>bridge.configureCloud!({url,token}),'Device authenticated. No snapshot has been uploaded by connecting. Choose Sync now when ready.');},'cloud-status');});
  $('cloud-sync').onclick=()=>workspaceTask(async()=>{if(!bridge?.syncCloud||workspaceReadOnly())throw new Error('Sync requires the private desktop app.');await cloudAction(()=>bridge.syncCloud!(),'Workspace snapshot and fetched owner commands synchronized. See the confirmed time above.');await refreshOffice();},'cloud-status');
  $('cloud-disconnect').onclick=()=>workspaceTask(async()=>{if(!bridge?.disconnectCloud)throw new Error('Cloud disconnect is unavailable.');await cloudAction(()=>bridge.disconnectCloud!(),'Device disconnected. Local work remains on this device.');},'cloud-status');
  $('editor-pair').onclick=()=>workspaceTask(async()=>{if(!bridge?.copyEditorPairing||workspaceReadOnly())throw new Error('VS Code pairing requires the private desktop app.');const result=await bridge.copyEditorPairing();if(!result.ok)throw new Error(result.error||'A pairing link could not be copied.');setStatus($('editor-pair-status'),`One-time connection link copied. In VS Code run Daftar: Connect to desktop and paste it.${result.expiresAt?` Expires ${dateLabel(result.expiresAt,true)}.`:''}`,'ok');},'editor-pair-status');
  renderCloudConnection();void refreshCloudConnection();
}
async function sendDonnaCloud(message:string,scope:OfficeScope):Promise<void>{
  if(cloudChatBusy)return;if(!bridge?.sendCloudChat)throw new Error('The cloud conversation service is unavailable.');cloudChatBusy=true;($('chat-send') as HTMLButtonElement).disabled=true;setStatus($('chat-status'),'Donna is reviewing your brief…');
  try{const result=await bridge.sendCloudChat({scope,message,idempotencyKey:crypto.randomUUID(),goalMode:'manual'});if(!result.ok||!result.snapshot)throw new Error(result.error||'Donna’s cloud request did not complete.');if(!result.reply?.trim())throw new Error('No provider reply was returned. Your brief remains here to retry.');officeState=result.snapshot;officeSampledAt=new Date().toISOString();($('chat-message') as HTMLTextAreaElement).value='';renderOffice();setStatus($('chat-status'),'Cloud reply saved. No repository changes were applied.','ok');}
  finally{cloudChatBusy=false;($('chat-send') as HTMLButtonElement).disabled=workspaceReadOnly();}
}

const DECISION_ROLES:Record<DecisionPanelRoleKey,string>={engineering:'Engineering','frontend-extensions':'Frontend & extensions',backend:'Backend','database-cache':'Database & cache','github-release':'GitHub & release',qa:'Quality & verification',security:'Security','research-knowledge':'Research & knowledge',knowledge:'Knowledge curation','design-architecture':'Design & architecture','math-geometry':'Mathematics & geometry','music-arts':'Music & arts',hackathon:'Hackathon production',newton:'Newton · analytical research',tesla:'Tesla · mechanism research','research-skeptic':'Research skeptic','resonance-advisor':'Resonance advisor','paired-research':'Paired research'};
const DECISION_PRESETS:Record<DecisionPanel['focus'],DecisionPanelRoleKey[]>={software:['engineering','design-architecture','security','qa'],design:['design-architecture','frontend-extensions','qa'],research:['newton','tesla','research-skeptic'],data:['database-cache','security','research-knowledge']};
let selectedDecisionPanelId='';let decisionCompanyId='';let decisionCreating=true;let decisionRoles=new Set<DecisionPanelRoleKey>(DECISION_PRESETS.software);
function selectedDecisionPanel():DecisionPanel|undefined{return officeState?.decisionPanels?.find(panel=>panel.id===selectedDecisionPanelId&&panel.companyId===officeCompany()?.id);}
function decisionReady():boolean{return workspaceAvailable()&&Array.isArray(officeState?.decisionPanels);}
function decisionJobs(panel:DecisionPanel):OfficeJob[]{const ids=new Set((officeState?.goals||[]).filter(goal=>panel.goalIds.includes(goal.id)).flatMap(goal=>goal.jobIds));return(officeState?.jobs||[]).filter(job=>ids.has(job.id));}
function decisionScopeLabel(panel:DecisionPanel):string{const rows=panel.scope.kind==='company'?officeState?.companies:panel.scope.kind==='office'?officeState?.offices:panel.scope.kind==='department'?officeState?.departments:portfolioState()?.groups;return`${rows?.find(row=>row.id===panel.scope.id)?.name||panel.scope.id} · ${panel.scope.kind}`;}
function renderDecisionSelectors():void{
  const kind=value('decision-scope');const company=officeCompany();let rows:Array<{id:string;name:string}>=[];
  if(company){if(kind==='company')rows=[company];else if(kind==='office')rows=(officeState?.offices||[]).filter(office=>office.companyId===company.id);else if(kind==='department')rows=(officeState?.departments||[]).filter(department=>department.companyId===company.id);else rows=(portfolioState()?.groups||[]).filter(group=>group.companyIds.includes(company.id));}
  populateSelect($('decision-scope-target') as HTMLSelectElement,rows,value('decision-scope-target'));
  populateSelect($('decision-roadmap') as HTMLSelectElement,(portfolioState()?.roadmap||[]).filter(item=>company&&roadmapInCompany(item,company.id)).map(item=>({id:item.id,name:item.title})),value('decision-roadmap'),'No outcome linked');
}
function renderDecisionRoleOptions():void{
  const container=$('decision-role-options');container.replaceChildren();
  for(const [key,label]of Object.entries(DECISION_ROLES) as Array<[DecisionPanelRoleKey,string]>){const row=textElement('label','');const input=document.createElement('input');input.type='checkbox';input.value=key;input.checked=decisionRoles.has(key);input.disabled=workspaceReadOnly()||(!input.checked&&decisionRoles.size>=5);input.onchange=()=>{if(input.checked)decisionRoles.add(key);else decisionRoles.delete(key);for(const check of Array.from(container.querySelectorAll<HTMLInputElement>('input')))check.disabled=workspaceReadOnly()||(!check.checked&&decisionRoles.size>=5);};row.append(input,textElement('span',label));container.append(row);}
}
function renderDecisionPanels():void{
  const company=officeCompany();const panels=(officeState?.decisionPanels||[]).filter(panel=>panel.companyId===company?.id).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));
  if(decisionCompanyId!==company?.id){decisionCompanyId=company?.id||'';selectedDecisionPanelId=panels[0]?.id||'';decisionCreating=!panels.length;}
  $('decision-count').textContent=number(panels.length);$('decision-context').textContent=company?`${company.name} · persistent expert panels`:'Choose a company to frame a decision.';renderDecisionSelectors();
  const list=$('decision-list');list.replaceChildren();
  for(const panel of panels.slice(0,60)){const button=textElement('button','',`decision-list-button${selectedDecisionPanelId===panel.id&&!decisionCreating?' selected':''}`);button.type='button';button.dataset.panelId=panel.id;button.setAttribute('aria-pressed',String(selectedDecisionPanelId===panel.id&&!decisionCreating));const running=decisionJobs(panel).filter(job=>job.status==='running').length;button.append(textElement('strong',panel.title),textElement('span',`${panel.status} · round ${panel.round}/${panel.maxRounds}${running?` · ${running} running`:''}`));button.onclick=()=>{selectedDecisionPanelId=panel.id;decisionCreating=false;renderDecisionPanels();$('decision-detail-title').scrollIntoView({block:'nearest'});};list.append(button);}
  if(!panels.length)noData(list,'No panels yet. Start with one question and clear acceptance criteria.');
  const panel=decisionCreating?undefined:selectedDecisionPanel();const available=decisionReady()&&!workspaceReadOnly();($('decision-create') as HTMLButtonElement).disabled=!available;($('decision-new') as HTMLButtonElement).disabled=!available;
  ($('decision-composer') as HTMLDetailsElement).open=decisionCreating;$('decision-detail').classList.toggle('hidden',!panel);
  $('decision-authorized-label').classList.toggle('hidden',officeState?.policy?.approvalMode==='autonomous');
  if(!panel)return;
  $('decision-detail-title').textContent=panel.title;$('decision-detail-scope').textContent=decisionScopeLabel(panel);$('decision-detail-task').textContent=panel.task;
  ($('decision-map-goal') as HTMLButtonElement).disabled=!panel.goalIds.length;
  const jobs=decisionJobs(panel);const live=jobs.filter(job=>job.status==='running').length;const waiting=jobs.filter(job=>job.status==='waiting-budget').length;
  $('decision-detail-state').textContent=panel.status==='running'?live?`${live} ${live===1?'request':'requests'} running`:waiting?'Held for budget':'Review work queued':panel.status==='review'?'Ready for a decision':panel.status==='decided'?'Decision recorded':panel.status==='paused'?'Paused':'Draft · no requests';
  $('decision-detail-state').className=`pill ${panel.status==='review'||panel.status==='decided'?'ok':'neutral'}`;
  const lastGoal=(officeState?.goals||[]).find(goal=>goal.id===panel.goalIds.at(-1));const currentJobs=jobs.filter(job=>lastGoal?.jobIds.includes(job.id));
  const expertPending=currentJobs.some(job=>job.employeeId!=='donna'&&!['completed','failed','cancelled','budget-exhausted','needs-review'].includes(job.status));
  const phase=panel.status==='draft'?0:['review','decided'].includes(panel.status)?3:expertPending?1:2;const phases=$('decision-phases');phases.replaceChildren();
  ['Frame the brief','Expert review','Donna synthesis','Record decision'].forEach((label,index)=>phases.append(textElement('div',label,`decision-phase${index===phase?' current':index<phase?' complete':''}`)));
  const roster=$('decision-roster');roster.replaceChildren();for(const member of panel.members){const employee=officeState?.employees.find(item=>item.id===member.employeeId);const card=textElement('div','','decision-member');const copy=textElement('div','');copy.append(textElement('strong',employee?.name||member.employeeId),textElement('small',`${DECISION_ROLES[member.roleKey]} · ${member.selection==='reused'?'existing employee':'hired for panel'}${member.serviceContractId?' · contracted':''}`));card.append(textElement('span',(employee?.name||member.roleKey).slice(0,1),'decision-member-avatar'),copy);roster.append(card);}
  const spent=jobs.reduce((sum,job)=>sum+job.usage.costUsd,0);$('decision-limits').textContent=`Round ${panel.round} of ${panel.maxRounds} · ${money(panel.limits.maxUsd)} whole-panel ceiling · ${number(panel.limits.maxTokens)} tokens and ${panel.limits.maxMinutes} minutes per request · ${money(spent)} committed (observed, reserved, or estimated). Global limits also apply.`;
  const canStart=panel.round<panel.maxRounds&&panel.status==='draft';
  ($('decision-start') as HTMLButtonElement).disabled=!available||!canStart;$('decision-start').textContent=panel.round?'Start next review round':'Start review round';($('decision-run') as HTMLButtonElement).disabled=!available||!canStart;
  ($('decision-pause') as HTMLButtonElement).disabled=!available||panel.status==='decided';$('decision-pause').textContent=panel.status==='paused'?'Resume panel':'Pause panel';
  $('decision-verdict-form').classList.toggle('hidden',panel.status!=='review');($('decision-record') as HTMLButtonElement).disabled=!available||panel.status!=='review';
  const reports=$('decision-reports');reports.replaceChildren();$('decision-report-count').textContent=number(jobs.length);
  for(const job of jobs.slice(-80)){const synthesis=job.employeeId==='donna';const employee=officeState?.employees.find(item=>item.id===job.employeeId);const report=textElement('details','',`decision-report${synthesis?' synthesis':''}`);report.open=synthesis&&Boolean(job.summary);report.append(textElement('summary',`${synthesis?'Donna · synthesis':employee?.name||job.employeeId} · ${job.status.replaceAll('-',' ')}`));report.append(textElement('p',job.summary||job.error||'No report has been returned for this request.'));report.append(textElement('div',`${job.provider} / ${job.model||'No model'} · ${number(job.usage.inputTokens+job.usage.outputTokens)} tokens · ${money(job.usage.costUsd)} ${job.costStatus||'recorded'}`,'report-meta'));if(job.artifactUri)report.append(textElement('div',job.artifactUri,'queue-artifact'));reports.append(report);}
  if(!jobs.length)noData(reports,'Reports appear only after actual expert requests return. Creating a panel does not generate an opinion.');
  const history=$('decision-history');history.replaceChildren();for(const decision of [...panel.decisions].reverse()){const record=textElement('article','','decision-record');record.append(textElement('h4',`${decision.verdict} · round ${decision.round} · ${dateLabel(decision.createdAt,true)}`),textElement('p',decision.summary));if(decision.evidence.length){const refs=textElement('ul','');decision.evidence.forEach(item=>refs.append(textElement('li',item)));record.append(refs);}history.append(record);}
}
function initDecisionPanels():void{
  const newPanel=()=>{setPortfolioOpen(false);navigate('office');switchWorkspaceTab('decisions');decisionCreating=true;selectedDecisionPanelId='';renderDecisionPanels();$('decision-title').focus();};$('decision-new').onclick=newPanel;
  $('ceo-open-decisions').onclick=()=>{setPortfolioOpen(false);navigate('office');switchWorkspaceTab('decisions');$('workspace-tab-decisions').focus();};
  $('decision-focus').onchange=()=>{decisionRoles=new Set(DECISION_PRESETS[value('decision-focus') as DecisionPanel['focus']]);renderDecisionRoleOptions();};$('decision-scope').onchange=renderDecisionSelectors;
  $('decision-start').onclick=()=>{($('decision-run-options') as HTMLDetailsElement).open=true;$('decision-model').focus();};
  $('decision-to-chat').onclick=()=>{switchWorkspaceTab('chat');$('chat-message').focus();};
  $('decision-map-goal').onclick=()=>workspaceTask(async()=>{const panel=selectedDecisionPanel();const goalId=panel?.goalIds.at(-1);if(!panel||!goalId)throw new Error('Start a panel round before mapping its work.');await ensureWorkspaceBlueprint();switchWorkspaceTab('whiteboard');resetBoardForm();($('node-title') as HTMLInputElement).value=panel.title;($('node-goal') as HTMLSelectElement).value=goalId;($('node-owner') as HTMLSelectElement).value='donna';$('node-title').focus();},'decision-status');
  $('decision-pause').onclick=()=>workspaceTask(async()=>{const panel=selectedDecisionPanel();if(!panel)throw new Error('Choose a panel first.');await workspaceCommand({action:panel.status==='paused'?'resume_panel':'pause_panel',panelId:panel.id},panel.status==='paused'?'Panel resumed.':'Panel paused.');},'decision-status');
  workspaceForm('decision-create-form',async()=>{const company=officeCompany();const title=value('decision-title');const task=value('decision-task');const id=value('decision-scope-target');if(!company||!title||!task||!id)throw new Error('Give the decision a title, brief, and valid scope.');if(decisionRoles.size<1||decisionRoles.size>5)throw new Error('Choose between one and five expert perspectives.');const maxRounds=Number(value('decision-max-rounds'));const maxUsd=Number(value('decision-max-usd'));const maxTokens=Number(value('decision-max-tokens'));const maxMinutes=Number(value('decision-max-minutes'));if(!Number.isInteger(maxRounds)||maxRounds<1||maxRounds>5||!Number.isFinite(maxUsd)||maxUsd<=0||maxUsd>100||!Number.isInteger(maxTokens)||maxTokens<1||maxTokens>200000||!Number.isFinite(maxMinutes)||maxMinutes<=0||maxMinutes>120)throw new Error('Use 1–5 rounds and positive panel limits, with a ceiling no greater than $100.');const before=new Set((officeState?.decisionPanels||[]).map(panel=>panel.id));const state=await workspaceCommand({action:'convene_panel',companyId:company.id,scope:{kind:value('decision-scope'),id},title,task,focus:value('decision-focus'),roleKeys:[...decisionRoles],maxRounds,maxUsd,maxTokens,maxMinutes,roadmapItemIds:value('decision-roadmap')?[value('decision-roadmap')]:[]},'Decision panel saved. No provider request was made.');const created=state.decisionPanels?.find(panel=>!before.has(panel.id));if(created){selectedDecisionPanelId=created.id;decisionCreating=false;renderDecisionPanels();}setStatus($('decision-status'),'Panel created with accountable expert roles. Choose a provider to start its first review round.','ok');},'decision-status');
  workspaceForm('decision-run-form',async()=>{const panel=selectedDecisionPanel();if(!panel)throw new Error('Choose a saved panel first.');const provider=value('decision-provider') as ProjectProvider;const model=value('decision-model');const authorized=($('decision-authorized') as HTMLInputElement).checked||officeState?.policy?.approvalMode==='autonomous';const priceRates={inputUsdPerMillion:Number(value('decision-rate-input')),outputUsdPerMillion:Number(value('decision-rate-output'))};if(!model)throw new Error('Choose a model ID.');if(!authorized)throw new Error('Approve this review round within the saved limits.');if(provider!=='ollama'&&Object.values(priceRates).some(rate=>!Number.isFinite(rate)||rate<=0))throw new Error('Enter current positive input and output prices for this cloud provider.');const runSettings:OfficeGoalRunSettings={mode:'provider',provider,model,authorized,...panel.limits,priceRates};await workspaceCommand({action:'start_panel_round',panelId:panel.id,runSettings,reviewed:true},'Expert review and Donna synthesis queued within the panel allocation.');($('decision-run-options') as HTMLDetailsElement).open=false;setStatus($('decision-status'),'Review round queued. Reports appear as actual jobs return; the dispatcher and global budget govern execution.','ok');},'decision-status');
  workspaceForm('decision-verdict-form',async()=>{const panel=selectedDecisionPanel();if(!panel)throw new Error('Choose a panel first.');const verdict=value('decision-verdict');const summary=value('decision-summary');const evidence=value('decision-evidence').split('\n').map(item=>item.trim()).filter(Boolean);if(!summary)throw new Error('Record the decision and reasoning.');if(verdict==='accepted'&&!evidence.length)throw new Error('Add evidence before accepting this decision.');await workspaceCommand({action:'record_panel_decision',panelId:panel.id,verdict,summary,evidence},'Panel decision recorded with its evidence.');($('decision-verdict-form') as HTMLFormElement).reset();setStatus($('decision-status'),'Decision recorded. Roadmap completion and publishing remain explicit actions.','ok');},'decision-status');
  renderDecisionRoleOptions();renderDecisionPanels();
}

// ---------------------------------------------------------------- connected blueprint studio
interface StudioMetric { level: 0|1|2|3|4|'unknown'; value: number|null; numerator: number|null; denominator: number|null; ratio: number|null; unknown: boolean; label: string; detail: string }
interface StudioSignalGroup { id: string; name: string; workload: StudioMetric; budget: StudioMetric; attention: StudioMetric; jobs: number; employees: number }
interface StudioSignals { summary: StudioSignalGroup; perEmployee: Record<string,StudioSignalGroup>; perDepartment: Record<string,StudioSignalGroup>; perRoom: Record<string,StudioSignalGroup>; legend: Record<'workload'|'budget'|'attention',ReadonlyArray<{level:0|1|2|3|4|'unknown';label:string;detail:string}>>; scopeValid: boolean; sample: unknown }
type StudioHeatMode = 'workload'|'budget'|'attention'|'off';
let studioSignalState: OfficeSnapshot|null = null;
let studioSignalKey = '';
let studioSignals: StudioSignals|null = null;
let softboardEmployeeId = '';
let donnaDockOpen = false;
function studioPreference(key: string, fallback: string): string { try { return localStorage.getItem(`daftar-studio-${key}`) || fallback; } catch { return fallback; } }
function saveStudioPreference(key: string, value: string): void { try { localStorage.setItem(`daftar-studio-${key}`,value); } catch { /* Private browsing can still use the current view. */ } }
function studioHeatMode(): StudioHeatMode { const selected=value('workspace-heat-mode'); return ['workload','budget','attention','off'].includes(selected)?selected as StudioHeatMode:'workload'; }
function currentStudioSignals(): StudioSignals|null {
  const key=[officeCompany()?.id,selectedOfficeId,selectedDepartmentId,signalGeneration()].join('|');
  if(studioSignalState!==officeState||studioSignalKey!==key){studioSignalState=officeState;studioSignalKey=key;studioSignals=null;
    if(officeState&&window.DaftarSignals){try{studioSignals=window.DaftarSignals.build(officeState,{companyId:officeCompany()?.id,officeId:selectedOfficeId||undefined,departmentId:selectedDepartmentId||undefined,now:new Date().toISOString(),...(officeSampledAt?{sampledAt:officeSampledAt}:{})});}catch{/* Missing signals must not look like a healthy zero. */}}
  }
  return studioSignals;
}
function addStudioHeat(element: HTMLElement, group: StudioSignalGroup|undefined, className='heat-reading'): void {
  const mode=studioHeatMode();if(mode==='off'){element.dataset.heatLevel='off';return;}
  const metric=group?.[mode];element.dataset.heatLevel=String(metric?.level??'unknown');
  const reading=textElement('span',metric?.label||'Unknown · no records',className);reading.title=metric?.detail||'No usable records are available for this selection.';element.append(reading);
}
function renderStudioSignals(): void {
  const signals=currentStudioSignals(),mode=studioHeatMode();const summary=$('workspace-signal-summary');summary.replaceChildren();
  if(!signals?.scopeValid){summary.append(textElement('span','Signals unavailable','signal-stat'),textElement('span','Load a valid saved scope to inspect recorded activity.','muted'));}
  else {const group=signals.summary;for(const [number,label] of [[group.employees,'assigned people'],[group.jobs,'recorded jobs']] as const){const item=textElement('span','','signal-stat');item.append(textElement('strong',String(number)),textElement('span',label));summary.append(item);}const item=textElement('span','','signal-stat signal-primary');item.append(textElement('strong',mode==='off'?'Heat map off':group[mode].label),textElement('span',mode==='budget'?'Commitments / recorded job allowances':mode==='attention'?'Exceptions and blocked work':'Saved work in this scope'));summary.append(item);}
  const legend=$('workspace-heat-legend');legend.replaceChildren();
  if(mode==='off'){legend.append(textElement('p','Color overlay is off. Names, counts and recorded statuses remain available.'));return;}
  for(const entry of signals?.legend[mode]||[]){const row=textElement('div','','heat-legend-row');row.dataset.heatLevel=String(entry.level);const swatch=textElement('span',entry.level==='unknown'?'?':String(entry.level),'heat-legend-swatch');swatch.setAttribute('aria-hidden','true');const copy=textElement('span','','heat-legend-copy');copy.append(textElement('strong',entry.label),textElement('small',entry.detail));row.append(swatch,copy);legend.append(row);}
  if(!legend.children.length)legend.append(textElement('p','No signal data is loaded. Unknown values are not treated as zero.'));
}
function studioAvatar(employee: OfficeEmployee): HTMLElement {const initials=employee.name.trim().split(/\s+/).slice(0,2).map(part=>part[0]||'').join('').toUpperCase();const avatar=textElement('span',initials||'AI','studio-avatar');avatar.setAttribute('aria-hidden','true');return avatar;}
function renderSoftboard(): void {
  const board=$('workspace-softboard');board.replaceChildren();const company=officeCompany(),office=officeLocation();if(!company||!office){noData(board,'Select an office to inspect its organization.');return;}
  const query=value('softboard-search').toLowerCase(),signals=currentStudioSignals();const members=scopedEmployees().filter(e=>e.status!=='fired'&&(!query||`${e.name} ${e.role}`.toLowerCase().includes(query)));
  const root=textElement('div','','org-root');const ceo=textElement('button','CEO / Director','org-executive');ceo.type='button';ceo.onclick=()=>{setPortfolioOpen(true);syncDonnaDock();$('ceo-toggle').focus();};root.append(ceo,textElement('span',company.name,'org-company'),textElement('h3',office.name,'org-office'));board.append(root);
  const branches=textElement('div','','org-branches');let rendered=0;const departments=(officeState?.departments||[]).filter(d=>d.officeId===office.id&&(!selectedDepartmentId||d.id===selectedDepartmentId));
  const groups:Array<{id:string;name:string;employees:OfficeEmployee[]}>=[{id:'office-leadership',name:'Office & shared leadership',employees:members.filter(e=>!e.departmentId)},...departments.map(d=>({id:d.id,name:d.name,employees:members.filter(e=>e.departmentId===d.id)}))];
  for(const group of groups){if(query&&!group.employees.length)continue;const branch=textElement('section','','org-branch');branch.setAttribute('aria-label',group.name);const heading=textElement('div','','org-department');heading.append(textElement('h4',group.name),textElement('span',`${group.employees.length} assigned`,'org-count'));if(group.id!=='office-leadership')addStudioHeat(heading,signals?.perDepartment[group.id]);branch.append(heading);const people=textElement('div','','org-people');
    for(const employee of group.employees){if(rendered>=150)break;rendered++;const card=textElement('button','',`org-person${employee.id===softboardEmployeeId?' selected':''}`);card.type='button';card.dataset.employeeId=employee.id;card.setAttribute('aria-pressed',String(employee.id===softboardEmployeeId));const name=textElement('span','','org-person-copy');name.append(textElement('strong',employee.name),textElement('span',employee.role),textElement('small',employee.status==='active'?'Active assignment':employee.status));card.append(studioAvatar(employee),name);addStudioHeat(card,signals?.perEmployee[employee.id]);card.onclick=()=>{softboardEmployeeId=employee.id;renderSoftboard();$('softboard-person-title').focus();};people.append(card);}
    if(!group.employees.length)people.append(textElement('p','No people assigned in this view.','empty-inline'));branch.append(people);branches.append(branch);
  }
  board.append(branches);$('softboard-result-note').textContent=`${rendered} of ${members.length} matching assignments shown. Direct office assignments and shared leadership; contracted staffing stays in service contracts. Select a person to inspect ownership.${members.length>150?' Refine the search to see another person.':''}`;
  if(!members.some(e=>e.id===softboardEmployeeId))softboardEmployeeId='';renderSoftboardInspector();
}
function renderSoftboardInspector():void{
  const employee=scopedEmployees().find(e=>e.id===softboardEmployeeId),detail=$('softboard-person-detail');detail.replaceChildren();$('softboard-person-title').tabIndex=-1;$('softboard-person-title').textContent=employee?.name||'Choose a person.';
  ($('softboard-person-chat') as HTMLButtonElement).disabled=!employee||employee.status!=='active';
  ($('softboard-person-authority') as HTMLButtonElement).disabled=!employee;
  $('softboard-person-chat').title=employee&&employee.status!=='active'?'Resume this employee in the employee register before starting a conversation.':'';
  if(!employee){detail.append(textElement('p','Inspect their role, current records and timed permissions.','muted'));return;}
  detail.append(textElement('p',employee.role,'softboard-role'),textElement('span',employee.status,'badge'));
  if(employee.status!=='active')detail.append(textElement('p','This employee is paused. Ownership remains visible; resume their assignment in the employee register before starting a conversation.','form-help'));
  const signals=currentStudioSignals()?.perEmployee[employee.id];for(const key of ['workload','budget','attention'] as const){const metric=signals?.[key];const item=textElement('div','','inspector-signal');item.dataset.heatLevel=String(metric?.level??'unknown');item.append(textElement('strong',metric?.label||'Unknown · no records'),textElement('small',metric?.detail||'No usable job records in this execution scope.'));detail.append(item);}
  const grants=(officeState?.authority?.grants||[]).filter(g=>g.employeeId===employee.id);detail.append(textElement('p',`${grants.length} recorded permission or promotion ${grants.length===1?'grant':'grants'}. Inspect the authority register for scope, expiry and parent restrictions.`,'form-help'));
  const owned=(portfolioState()?.roadmap||[]).filter(r=>r.ownerEmployeeId===employee.id&&roadmapInCompany(r,officeCompany()?.id||''));detail.append(textElement('p',`${owned.length} roadmap outcomes owned in this company.`,'form-help'));
}
function renderStudioRoadmap():void{
  const container=$('workspace-timeline');container.replaceChildren();const company=officeCompany();const all=(portfolioState()?.roadmap||[]).filter(item=>company&&roadmapInCompany(item,company.id)&&(!selectedDepartmentId||item.departmentId===selectedDepartmentId));const state=value('studio-roadmap-status');const items=all.filter(item=>state==='all'||item.status===state);$('studio-roadmap-summary').textContent=`${items.length} outcomes in view · ${all.filter(item=>item.status==='done').length} completed with recorded evidence · ${all.filter(item=>item.status==='blocked').length} blocked`;
  const stages=[['planned','Planned'],['in-progress','In progress'],['blocked','Blocked'],['done','Done']] as const;let rendered=0;
  for(const [status,label] of stages){if(state!=='all'&&state!==status)continue;const lane=textElement('section','','roadmap-lane');lane.dataset.stage=status;const rows=items.filter(item=>item.status===status);const head=textElement('header','','roadmap-lane-heading');head.append(textElement('h3',label),textElement('span',String(rows.length),'badge'));lane.append(head);
    for(const item of rows){if(rendered>=120)break;rendered++;const card=textElement('article','','studio-outcome');card.dataset.roadmapId=item.id;const owner=officeState?.employees.find(e=>e.id===item.ownerEmployeeId);card.append(textElement('span',roadmapScopeLabel(item),'card-type'),textElement('h4',item.title));if(item.description)card.append(textElement('p',item.description.slice(0,260)));const person=textElement('div','','outcome-person');if(owner)person.append(studioAvatar(owner));person.append(textElement('strong',owner?.name||'Owner unavailable'));card.append(person);const date=new Date(item.updatedAt);card.append(textElement('small',`Updated ${Number.isFinite(date.getTime())?date.toLocaleDateString():'date unavailable'} · ${item.dependencies.length} dependencies`,'outcome-meta'));if(item.evidence)card.append(textElement('p',`Evidence: ${item.evidence}`,'form-help'));const action=textElement('button','Inspect ownership','text-button');action.type='button';action.onclick=()=>{setPortfolioOpen(true);editPortfolioRoadmap(item);syncDonnaDock();};card.append(action);lane.append(card);}
    if(!rows.length)lane.append(textElement('p','No saved outcomes in this stage.','lane-empty'));container.append(lane);
  }
  if(items.length>120)container.append(textElement('p','Showing the first 120 outcomes. Filter by delivery state or department.','form-help'));
}
function syncDonnaDock():void{
  const panel=document.getElementById('donna-conversation'),home=document.getElementById('donna-chat-home'),dock=document.getElementById('donna-dock'),toggle=document.getElementById('donna-dock-toggle'),slot=document.getElementById('donna-dock-slot');if(!panel||!home||!dock||!toggle||!slot)return;
  const canvasMode=document.body.classList.contains('ff-canvas-mode');const available=activeView==='office'&&(canvasMode||workspaceTab!=='chat'||portfolioOpen);const open=available&&donnaDockOpen;
  toggle.classList.toggle('hidden',!available||open);toggle.setAttribute('aria-expanded',String(open));dock.classList.toggle('hidden',!open);if(open){if(panel.parentElement!==slot)slot.append(panel);}else if(panel.parentElement!==home)home.prepend(panel);
}
function initStudio():void{
  const theme=studioPreference('theme','blueprint');document.documentElement.dataset.theme=theme==='drafting'?'drafting':'blueprint';($('workspace-theme') as HTMLSelectElement).value=document.documentElement.dataset.theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content',document.documentElement.dataset.theme==='drafting'?'#F6F2E8':'#151126');
  $('workspace-theme').onchange=()=>{const next=value('workspace-theme')==='drafting'?'drafting':'blueprint';document.documentElement.dataset.theme=next;saveStudioPreference('theme',next);document.querySelector('meta[name="theme-color"]')?.setAttribute('content',next==='drafting'?'#F6F2E8':'#151126');};
  const heat=studioPreference('heat','workload');($('workspace-heat-mode') as HTMLSelectElement).value=['workload','budget','attention','off'].includes(heat)?heat:'workload';
  $('workspace-heat-mode').onchange=()=>{saveStudioPreference('heat',studioHeatMode());renderStudioSignals();renderBlueprint();renderWhiteboard();renderSoftboard();};
  $('softboard-search').oninput=renderSoftboard;$('studio-roadmap-status').onchange=renderStudioRoadmap;
  $('softboard-person-chat').onclick=()=>{const e=scopedEmployees().find(item=>item.id===softboardEmployeeId);if(!e||e.status!=='active')return;renderWorkspaceControls();($('chat-scope') as HTMLSelectElement).value='employee';($('chat-employee') as HTMLSelectElement).value=e.id;switchWorkspaceTab('chat');$('chat-message').focus();};
  $('softboard-person-authority').onclick=()=>{if(!softboardEmployeeId)return;setPortfolioOpen(true);renderAuthority();($('authority-employee') as HTMLSelectElement).value=softboardEmployeeId;renderAuthorityForm();renderAuthorityGrants();($('ceo-authority-editor') as HTMLDetailsElement).open=true;$('authority-employee').focus();$('ceo-authority-editor').scrollIntoView({block:'nearest'});syncDonnaDock();};
  $('donna-dock-toggle').onclick=()=>{donnaDockOpen=true;syncDonnaDock();$('chat-message').focus();};$('donna-dock-close').onclick=()=>{donnaDockOpen=false;syncDonnaDock();$('donna-dock-toggle').focus();};
}

// ---------------------------------------------------------------- Freeflow host
let ffStudio: Studio | null = null;
let ffFocus: FreeflowFocus = { kind: 'portfolio' };
let ffOperations = false;
let ffHeatCache = new Map<string, StudioSignals | null>();
let ffHeatKey = '';
const FF_CLOCK_MS = 30_000;
const FF_SNAPSHOT_IDS = new WeakMap<object, number>();
let ffSnapshotSeq = 0;
let ffHeatTimer: ReturnType<typeof setTimeout> | null = null;
function ffSnapshotId(): number {
  if (!officeState) return 0;
  let id = FF_SNAPSHOT_IDS.get(officeState);
  if (id === undefined) { id = ++ffSnapshotSeq; FF_SNAPSHOT_IDS.set(officeState, id); }
  return id;
}
/** One finite generation shared by Freeflow and legacy signals: snapshot identity + receipt + bounded clock bucket. */
function signalGeneration(): string {
  return `${ffSnapshotId()}|${officeSampledAt}|${Math.floor(Date.now() / FF_CLOCK_MS)}`;
}
function ffHeatVisible(): boolean {
  return !document.hidden && activeView === 'office' && studioHeatMode() !== 'off';
}
function ffStopHeatTimer(): void { if (ffHeatTimer !== null) { clearTimeout(ffHeatTimer); ffHeatTimer = null; } }
function ffScheduleHeatTimer(): void {
  ffStopHeatTimer();
  if (!ffHeatVisible() || !officeState) return;
  const wait = FF_CLOCK_MS - (Date.now() % FF_CLOCK_MS) + 50;
  ffHeatTimer = setTimeout(() => {
    ffHeatTimer = null;
    if (!ffHeatVisible()) return;
    if (ffStudio) ffRefresh();
    renderStudioSignals();
    ffScheduleHeatTimer();
  }, wait);
}
function ffReadOnlyCaps(spec: InspectorActionSpec): StudioActionState {
  if (workspaceReadOnly() && ['new-job','new-company','new-office','new-department','hire'].includes(spec.action)) return { enabled: false, reason: 'Read-only starter preview.' };
  return { enabled: true };
}
function ffFocusFromUrl(): FreeflowFocus {
  const params = new URLSearchParams(location.search); const cid = params.get('company') || params.get('companyId');
  if (cid && officeState?.companies.some((c) => c.id === cid)) return { kind: 'company', companyId: cid };
  return { kind: 'portfolio' };
}
function ffSignalsFor(scope: {companyId?: string; officeId?: string; departmentId?: string}): StudioSignals | null {
  if (!officeState || !window.DaftarSignals) return null;
  const gen = signalGeneration();
  const key = `${scope.companyId||''}|${scope.officeId||''}|${scope.departmentId||''}`;
  if (ffHeatKey !== gen) { ffHeatCache = new Map(); ffHeatKey = gen; }
  const cached = ffHeatCache.get(key);
  if (cached !== undefined) return cached;
  let result: StudioSignals | null = null;
  try { result = window.DaftarSignals.build(officeState, { ...scope, now: new Date().toISOString(), ...(officeSampledAt ? { sampledAt: officeSampledAt } : {}) }); } catch { result = null; }
  ffHeatCache.set(key, result);
  return result;
}
function ffHeat(node: Readonly<SceneNode>): StudioHeat | null {
  const mode = studioHeatMode();
  if (mode === 'off') return { level: 'off', label: 'Heat off' };
  const pick = (g: StudioSignalGroup | undefined): StudioHeat => { const m = g?.[mode]; return m ? { level: m.level, label: m.label, metric: m.detail } : { level: 'unknown', label: 'Unknown (no metric)' }; };
  if (node.kind === 'folio') return pick(ffSignalsFor({ companyId: node.companyId })?.summary);
  const s = ffSignalsFor({ companyId: node.companyId, officeId: node.officeId, departmentId: node.departmentId });
  if (!s) return { level: 'unknown', label: 'Unknown (no metric)' };
  if (node.kind === 'office') return pick(s.summary);
  if (node.kind === 'room' && node.roomId) return pick(s.perRoom[node.roomId]);
  if (node.kind === 'department' && node.departmentId) return pick(s.perDepartment[node.departmentId]);
  if ((node.kind === 'employee') && node.employeeId) return pick(s.perEmployee[node.employeeId]);
  return null;
}
function ffSetNav(name: string): void {
  document.querySelectorAll<HTMLButtonElement>('[data-ff-nav]').forEach((b) => { const on = b.dataset.ffNav === name; b.classList.toggle('active', on); b.setAttribute('aria-pressed', String(on)); });
}
/** Reparent the existing heat select and legend into the persistent canvas bar (no second ID or state). */
function ffMountHeatControls(): void {
  const slot = document.getElementById('ff-heat-controls'); const select = document.getElementById('workspace-heat-mode'); const key = document.querySelector('#workspace-studio-signals .heat-key');
  if (!slot || !select) return;
  const control = select.closest('.signal-control') || select;
  if (!slot.contains(control)) slot.append(control);
  if (key && !slot.contains(key)) slot.append(key);
}
function ffApplyMode(): void {
  const canvas = activeView === 'office' && !ffOperations && !portfolioOpen;
  document.body.classList.toggle('ff-canvas-mode', canvas);
  document.body.classList.toggle('ff-operations', ffOperations);
  $('freeflow-surface').classList.toggle('hidden', activeView !== 'office');
  $('ff-return-studio').classList.toggle('hidden', !ffOperations || ffFocus.kind === 'portfolio');
  ffStudio?.setActive(activeView === 'office' && !portfolioOpen && !ffOperations);
  ffScheduleHeatTimer();
}
/** Single serializer for view mode + company scope. Mode fields never conflict. */
function ffSerializeUrl(): void {
  const url = new URL(location.href);
  url.searchParams.delete('companyId'); url.searchParams.delete('workspace'); url.searchParams.delete('ceo');
  if (ffFocus.kind === 'portfolio') url.searchParams.delete('company'); else url.searchParams.set('company', ffFocus.companyId);
  const canvas = activeView === 'office' && !ffOperations && !portfolioOpen;
  if (portfolioOpen) url.searchParams.set('ceo', 'true');
  else if (!canvas && activeView === 'office' && ['chat','blueprint','softboard','timeline','whiteboard','decisions'].includes(workspaceTab)) url.searchParams.set('workspace', workspaceTab);
  history.replaceState(null, '', url.toString());
}
function ffRefresh(): void {
  if (!ffStudio) return;
  const btn = $('ff-create-blueprint') as HTMLButtonElement;
  const needs = Boolean(officeState && selectedOfficeId && !currentBlueprint() && !workspaceReadOnly() && workspaceAvailable());
  btn.classList.toggle('hidden', !needs);
  ffStudio.update((officeState || {}) as unknown as FreeflowSnapshot, ffFocus);
  $('ff-surface-heat').textContent = studioHeatMode() === 'off' ? 'Heat off' : `Heat: ${studioHeatMode()}`;
  ffApplyMode();
}
/** Serialized, latest-intent company-scope transition. Applies state only after native confirmation. */
interface FfScopeIntent { focus: FreeflowFocus; operations: boolean | null; token: number }
let ffScopeSeq = 0;
let ffScopeChain: Promise<void> = Promise.resolve();
function ffValidateFocus(focus: FreeflowFocus): string | null {
  if (focus.kind === 'portfolio') return null;
  const s = officeState; if (!s) return 'The workspace is not loaded yet.';
  if (!s.companies.some((c) => c.id === focus.companyId)) return 'That company is not in this workspace.';
  if ('officeId' in focus && focus.officeId) {
    const o = s.offices.find((x) => x.id === focus.officeId);
    if (!o || o.companyId !== focus.companyId) return 'That office does not belong to the selected company.';
    if (focus.kind === 'department') {
      const d = s.departments.find((x) => x.id === focus.departmentId);
      if (!d || d.companyId !== focus.companyId || d.officeId !== focus.officeId) return 'That department does not belong to the selected office.';
    }
  }
  return null;
}
function ffCanonicalizeUrl(): void { ffSerializeUrl(); }
/** Align scene, pickers and URL with the ACTUAL canonical snapshot after a failed/queued/superseded transition. */
function ffReconcileToCanonical(): void {
  const s = officeState;
  if (s) {
    const activeId = s.activeCompanyId;
    const f = ffFocus;
    const stillValid = f.kind !== 'portfolio' && f.companyId === activeId && ffValidateFocus(f) === null;
    if (!stillValid) {
      if (f.kind === 'portfolio' && !s.companies.some((c) => c.id === activeId)) { /* stay portfolio */ }
      else if (f.kind === 'portfolio') { /* portfolio stays honest; pickers follow canonical company */ }
      else ffFocus = { kind: 'company', companyId: activeId };
      const offices = s.offices.filter((o) => o.companyId === activeId);
      if (!offices.some((o) => o.id === selectedOfficeId)) selectedOfficeId = offices[0]?.id || '';
      if (!s.departments.some((d) => d.id === selectedDepartmentId && d.officeId === selectedOfficeId)) selectedDepartmentId = '';
    }
  }
  ffCanonicalizeUrl(); renderOffice(); ffRefresh();
}
function ffNavStatus(intent: FfScopeIntent, message: string, kind: '' | 'ok' | 'error'): void {
  if (intent.token !== ffScopeSeq) return; // only the latest intent may publish status
  setStatus($('workspace-action-status'), message, kind);
}
async function ffRunScopeIntent(intent: FfScopeIntent): Promise<void> {
  if (intent.token !== ffScopeSeq) return; // superseded before it started
  const focus = intent.focus;
  const problem = ffValidateFocus(focus);
  if (problem) { ffNavStatus(intent, problem, 'error'); ffReconcileToCanonical(); return; }
  if (focus.kind !== 'portfolio' && officeState && officeState.activeCompanyId !== focus.companyId) {
    if (workspaceReadOnly()) officeState.activeCompanyId = focus.companyId;
    else {
      if (!bridge?.officeCommand) { ffNavStatus(intent, 'Open the installed desktop app to switch companies.', 'error'); ffReconcileToCanonical(); return; }
      ffNavStatus(intent, 'Switching company…', '');
      let result: OfficeResult;
      try { result = await bridge.officeCommand({ action: 'select_company', companyId: focus.companyId }); }
      catch (error) { ffNavStatus(intent, error instanceof Error ? error.message : 'Company selection failed.', 'error'); ffReconcileToCanonical(); return; }
      if (result.ok && result.snapshot) { officeState = result.snapshot; officeSampledAt = new Date().toISOString(); }
      if (!result.ok || !result.snapshot) { ffNavStatus(intent, result.error || 'Company selection failed.', 'error'); ffReconcileToCanonical(); return; }
      if (result.queued) {
        ffNavStatus(intent, `Queued for desktop confirmation${result.commandId ? ` · ${result.commandId}` : ''}. The company has not been switched yet.`, '');
        ffReconcileToCanonical(); return;
      }
      if (intent.token !== ffScopeSeq) { ffReconcileToCanonical(); return; }
      if (result.snapshot.activeCompanyId !== focus.companyId) { ffNavStatus(intent, 'The workspace did not confirm the requested company.', 'error'); ffReconcileToCanonical(); return; }
    }
  }
  if (intent.token !== ffScopeSeq) return; // a newer intent supersedes the confirmed result
  const recheck = ffValidateFocus(focus);
  if (recheck) { ffNavStatus(intent, recheck, 'error'); ffReconcileToCanonical(); return; }
  ffNavStatus(intent, '', '');
  ffFocus = focus;
  if (focus.kind !== 'portfolio') {
    if ('officeId' in focus && focus.officeId) selectedOfficeId = focus.officeId;
    selectedDepartmentId = focus.kind === 'department' ? focus.departmentId : '';
  }
  if (intent.operations !== null) { ffOperations = intent.operations; ffSetNav(intent.operations ? 'operations' : 'table'); }
  ffApplyMode();
  ffCanonicalizeUrl();
  renderOffice();
  ffRefresh();
}
/** Awaitable entry point: resolves after this intent (or a newer one) has been settled. */
function ffFocusMatches(a: FreeflowFocus, b: FreeflowFocus): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === 'portfolio') return true;
  if (b.kind === 'portfolio') return false;
  if (a.companyId !== b.companyId) return false;
  const ao = 'officeId' in a ? a.officeId : undefined; const bo = 'officeId' in b ? b.officeId : undefined;
  if (ao !== bo) return false;
  const ad = a.kind === 'department' ? a.departmentId : undefined; const bd = b.kind === 'department' ? b.departmentId : undefined;
  return ad === bd;
}
/** Resolves true only when this intent is still the latest and the confirmed final scope equals the requested focus. */
function ffTransitionScope(focus: FreeflowFocus, operations: boolean | null = null): Promise<boolean> {
  const requested = { ...focus } as FreeflowFocus;
  const intent: FfScopeIntent = { focus: requested, operations, token: ++ffScopeSeq };
  ffScopeChain = ffScopeChain.then(() => ffRunScopeIntent(intent)).catch((error: unknown) => {
    toast(error instanceof Error ? error.message : 'The company scope could not be changed.');
  });
  return ffScopeChain.then(() => {
    if (intent.token !== ffScopeSeq) return false;
    if (!ffFocusMatches(ffFocus, requested)) return false;
    if (requested.kind !== 'portfolio' && officeState?.activeCompanyId !== requested.companyId) return false;
    if (requested.kind === 'company' && selectedDepartmentId) return false;
    if (requested.kind === 'department' && selectedDepartmentId !== requested.departmentId) return false;
    return true;
  });
}
function ffNavigate(focus: FreeflowFocus): void {
  void ffTransitionScope(focus, null);
}
function ffOpenPanel(selector: string, focusId: string): void {
  let el: HTMLElement | null = document.getElementById(focusId);
  let parent: HTMLElement | null = el;
  while (parent) { if (parent instanceof HTMLDetailsElement) parent.open = true; parent = parent.parentElement; }
  if (!el) return; el.scrollIntoView({ block: 'nearest' });
  if (el.matches('input,select,textarea,button')) el.focus(); else { el.tabIndex = -1; el.focus(); }
  void selector;
}
function ffShowOps(): void { ffOperations = true; ffSetNav('operations'); ffApplyMode(); }
function ffActionFocus(ctx: StudioActionContext): FreeflowFocus | null {
  const companyId = ctx.companyId || officeState?.activeCompanyId; if (!companyId) return null;
  const departmentId = ctx.departmentId; const officeId = ctx.officeId || (departmentId ? officeState?.departments.find((d) => d.id === departmentId)?.officeId : undefined);
  if (departmentId && officeId) return { kind: 'department', companyId, officeId, departmentId };
  if (officeId) return { kind: 'office', companyId, officeId };
  return { kind: 'company', companyId };
}
function ffActionFocusStillCurrent(focus: FreeflowFocus): boolean {
  return ffFocusMatches(ffFocus, focus) && officeState?.activeCompanyId === (focus.kind === 'portfolio' ? '' : focus.companyId);
}
function ffAction(action: StudioActionKind, ctx: StudioActionContext): void {
  const scopeBound: StudioActionKind[] = ['chat', 'new-job', 'ownership', 'jobs', 'manage', 'hire', 'new-office', 'new-department', 'roadmap', 'whiteboard', 'services'];
  if (action === 'new-goal' as unknown as StudioActionKind || scopeBound.includes(action) && (ctx.companyId || ctx.officeId || ctx.departmentId)) {
    const focus = ffActionFocus(ctx);
    if (!focus) { setStatus($('workspace-action-status'), 'Choose a company first.', 'error'); return; }
    void ffTransitionScope(focus, null).then((ok) => {
      if (!ok || !ffActionFocusStillCurrent(focus)) return;
      ffActionConfirmed(action, ctx);
    });
    return;
  }
  ffActionConfirmed(action, ctx);
}
function ffRevealComposer(): void {
  donnaDockOpen = true; ffOperations = false; ffApplyMode();
  workspaceTab = workspaceTab === 'chat' ? 'blueprint' : workspaceTab;
  syncDonnaDock();
  const box = $('chat-message') as HTMLTextAreaElement; box.focus();
}
function ffChatTarget(ctx: StudioActionContext): { ok: boolean; message?: string } {
  const scopeSel = $('chat-scope') as HTMLSelectElement;
  const company = officeCompany();
  if (!ctx.employeeId) {
    scopeSel.value = ctx.departmentId ? 'department' : ctx.officeId ? 'office' : 'company';
    return { ok: true };
  }
  const employee = officeState?.employees.find((e) => e.id === ctx.employeeId);
  if (!employee) return { ok: false, message: 'That employee is no longer in the workspace.' };
  const local = employee.companyId === null ? false : employee.companyId === company?.id;
  if (!local) {
    scopeSel.value = 'company';
    return { ok: true, message: `${employee.name} belongs outside this company, so this conversation is with this company's Donna instead.` };
  }
  scopeSel.value = 'employee';
  renderWorkspaceControls();
  const sel = $('chat-employee') as HTMLSelectElement;
  if (!Array.from(sel.options).some((o) => o.value === employee.id)) return { ok: false, message: `${employee.name} is not eligible for chat in this scope.` };
  sel.value = employee.id;
  return { ok: true };
}
function ffActionConfirmed(action: StudioActionKind, ctx: StudioActionContext): void {
  const readOnly = workspaceReadOnly();
  const toWorkspace = (tab: string, focusId: string) => { ffOperations = true; ffSetNav('operations'); ffApplyMode(); setPortfolioOpen(false); switchWorkspaceTab(tab); window.setTimeout(() => ffOpenPanel('', focusId), 0); };
  switch (action) {
    case 'chat': {
      renderOffice();
      const target = ffChatTarget(ctx);
      renderWorkspaceControls(); conversationSignature = ''; renderConversation(); renderWorkspaceGoals();
      if (!target.ok) { setStatus($('workspace-action-status'), target.message || 'This conversation is unavailable.', 'error'); break; }
      ffRevealComposer();
      setStatus($('chat-status'), target.message || '');
      break;
    }
    case 'jobs': ffShowOps(); setPortfolioOpen(false); switchOfficeTab('queue'); ffOpenPanel('', 'office-queue-filter'); break;
    case 'new-job': {
      const contractSel = $('queue-service-contract') as HTMLSelectElement;
      const wantContract = ctx.contractId || '';
      if (wantContract) {
        const contract = scopedServiceContracts().find((k) => k.id === wantContract);
        if (!contract) { setStatus($('workspace-action-status'), 'That service contract is not active for this scope.', 'error'); break; }
        if (ctx.employeeId && !contract.employeeIds.includes(ctx.employeeId)) { setStatus($('workspace-action-status'), 'That employee is not part of the requested service contract.', 'error'); break; }
        contractSel.value = contract.id;
      } else contractSel.value = '';
      renderOfficeScope();
      const sel = $('queue-employee') as HTMLSelectElement;
      if (ctx.employeeId) {
        if (!Array.from(sel.options).some((o) => o.value === ctx.employeeId)) { setStatus($('workspace-action-status'), 'That employee is not eligible for a new job in this scope.', 'error'); break; }
        sel.value = ctx.employeeId;
      }
      ffShowOps(); switchOfficeTab('queue'); ($('queue-composer') as HTMLDetailsElement).open = true;
      ffOpenPanel('', 'queue-goal'); break;
    }
    case 'new-goal' as unknown as StudioActionKind: {
      renderOffice();
      const target = ffChatTarget(ctx);
      renderWorkspaceControls(); conversationSignature = ''; renderConversation(); renderWorkspaceGoals();
      if (!target.ok) { setStatus($('workspace-action-status'), target.message || 'This conversation is unavailable.', 'error'); break; }
      ffRevealComposer();
      setStatus($('chat-status'), target.message || '');
      break;
    }
    case 'roadmap': ffOperations = true; ffApplyMode(); setPortfolioOpen(false); switchWorkspaceTab('timeline'); break;
    case 'whiteboard': toWorkspace('whiteboard', 'whiteboard-add-node'); if (ctx.boardId) { const b = currentBlueprint()?.whiteboards.find((w) => w.id === ctx.boardId); if (b) selectBoard(b); } break;
    case 'ownership': {
      if (ctx.employeeId && !ctx.boardId) {
        if (!officeState?.employees.some((e) => e.id === ctx.employeeId)) { setStatus($('workspace-action-status'), 'That employee is no longer in the workspace.', 'error'); break; }
        ffShowOps(); setPortfolioOpen(true); renderAuthority();
        ($('ceo-authority-editor') as HTMLDetailsElement).open = true;
        const sel = $('authority-employee') as HTMLSelectElement; sel.value = ctx.employeeId;
        renderAuthorityForm(); renderAuthorityGrants(); ffOpenPanel('', 'authority-employee'); break;
      }
      toWorkspace('whiteboard', 'node-title'); if (ctx.boardId) { const b = currentBlueprint()?.whiteboards.find((w) => w.id === ctx.boardId); if (b) selectBoard(b); } break;
    }
    case 'manage': ffShowOps(); switchOfficeTab('people'); ffOpenPanel('', 'office-employees'); break;
    case 'new-company': ffShowOps(); switchOfficeTab('overview'); ffOpenPanel('', 'office-new-company-name'); break;
    case 'new-office': ffShowOps(); switchOfficeTab('overview'); ffOpenPanel('', 'office-new-office-name'); break;
    case 'new-department': ffShowOps(); switchOfficeTab('overview'); ffOpenPanel('', 'office-new-department-name'); break;
    case 'hire': ffShowOps(); switchOfficeTab('people'); ffOpenPanel('', 'hire-name'); break;
    case 'services': ffShowOps(); setPortfolioOpen(true); ($('ceo-contract-editor') as HTMLDetailsElement).open = true; ffOpenPanel('', 'ceo-contract-service'); if (ctx.contractId) { const sel = $('ceo-contract-service') as HTMLSelectElement; const k = portfolioState()?.contracts.find((c) => c.id === ctx.contractId); if (k) { sel.value = k.serviceId; renderContractRecipients(); } } break;
    case 'settings': navigate('settings'); break;
  }
  if (readOnly) setStatus($('workspace-action-status'), 'Starter preview: navigation only; changes are disabled.');
}
function initFreeflowHost(): void {
  const host = $('freeflow-host');
  ffStudio = mountStudio(host, { onNavigate: ffNavigate, onAction: ffAction, heat: ffHeat, capabilities: ffReadOnlyCaps });
  document.querySelectorAll<HTMLButtonElement>('[data-ff-nav]').forEach((b) => b.addEventListener('click', () => {
    const name = b.dataset.ffNav || 'table'; ffSetNav(name);
    if (name === 'table') { ffOperations = false; setPortfolioOpen(false); ffNavigate({ kind: 'portfolio' }); ffApplyMode(); ffSerializeUrl(); }
    else if (name === 'studio') { ffOperations = false; setPortfolioOpen(false); ffSetNav('table'); ffApplyMode(); ffRefresh(); ffSerializeUrl(); }
    else if (name === 'team') { ffOperations = true; setPortfolioOpen(false); ffApplyMode(); switchWorkspaceTab('softboard'); ffSerializeUrl(); }
    else if (name === 'roadmap') { ffOperations = true; setPortfolioOpen(false); ffApplyMode(); switchWorkspaceTab('timeline'); ffSerializeUrl(); }
    else if (name === 'whiteboard') { ffOperations = true; setPortfolioOpen(false); ffApplyMode(); switchWorkspaceTab('whiteboard'); ffSerializeUrl(); }
    else { ffOperations = true; setPortfolioOpen(false); ffApplyMode(); switchWorkspaceTab('chat'); ffSerializeUrl(); }
  }));
  $('ff-create-blueprint').addEventListener('click', () => workspaceTask(async () => { await ensureWorkspaceBlueprint(); ffRefresh(); }));
  $('workspace-heat-mode').addEventListener('change', ffRefresh);
  $('workspace-theme').addEventListener('change', () => ffRefresh());
  ffMountHeatControls();
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { if (ffStudio) ffRefresh(); renderStudioSignals(); } ffScheduleHeatTimer(); });
  $('workspace-heat-mode').addEventListener('change', ffScheduleHeatTimer);
  window.addEventListener('beforeunload', () => { ffStopHeatTimer(); ffStudio?.destroy(); ffStudio = null; });
  window.addEventListener('pagehide', ffStopHeatTimer);
  window.addEventListener('hashchange', () => { ffApplyMode(); });
}
// ---------------------------------------------------------------- boot
function boot(): void {
  initStudio(); initWorkspace(); initOffice(); initUnifiedWorkspace(); initFreeflowHost(); initGitHubTools(); initPortfolio(); initAuthority(); initDecisionPanels(); initCloudConnection(); initLauncher(); initVenvForm(); initProjectForm(); renderSquadEditor(); renderRunDetail(); renderUsage();
  if (!bridge) {
    $('bridge-notice').classList.remove('hidden'); $('core-label').textContent = 'Desktop preview'; $('core-note').textContent = 'Native actions need the desktop app';
    noData($('team-grid'), 'Open the desktop app to load your skill-linked team.'); noData($('project-list'), 'Create and save projects in the installed desktop app.'); noData($('key-rows'), 'Provider credentials are managed by the desktop app’s secure storage.');
  }
  $('refresh-sysinfo').addEventListener('click', () => bridge ? void safeTask(async () => renderSystemInfo(await bridge.getSystemInfo())) : nativeUnavailable());
  $('refresh-catalog').addEventListener('click', () => bridge ? void safeTask(refreshCatalog) : nativeUnavailable()); $('refresh-jobs').addEventListener('click', () => bridge ? void safeTask(refreshJobs) : nativeUnavailable());
  $('back-to-launcher').addEventListener('click', () => void bridge?.backToLauncher()); $('ollama-detect').addEventListener('click', () => bridge ? void safeTask(detectOllamaUi) : nativeUnavailable()); $('projects-refresh').addEventListener('click', () => bridge ? void safeTask(refreshProjectsPanel) : nativeUnavailable());
  $('run-start').addEventListener('click', () => void safeTask(startRun));
  $('run-pause').addEventListener('click', () => void safeTask(async () => { if (currentRun && bridge) { const r = await bridge.pauseRun(currentRun.id); if (!r.ok) throw new Error(r.error); await refreshCurrentRun(); } }));
  $('run-resume').addEventListener('click', () => void safeTask(async () => { if (currentRun && bridge) { const r = await bridge.resumeRun(currentRun.id); if (!r.ok) throw new Error(r.error); await refreshCurrentRun(); } }));
  $('run-cancel').addEventListener('click', () => void safeTask(async () => { if (currentRun && bridge) { const r = await bridge.cancelRun(currentRun.id); if (!r.ok) throw new Error(r.error); await refreshCurrentRun(); } }));
  bridge?.onModeChanged((mode, url) => setMode(mode, url)); bridge?.onJobEvent(() => { if (activeView === 'models') void safeTask(refreshJobs); });
  bridge?.onProjectEvent((run) => {
    workspaceRuns = [run, ...workspaceRuns.filter((existing) => existing.id !== run.id)];
    if (currentProject && run.projectId === currentProject.id) { currentRun = run; if (activeView === 'projects') renderRunDetail(); }
    if (activeView === 'overview') renderOverview(); if (activeView === 'usage') renderUsage();
  });
  if (workspaceReadOnly()) {
    $('bridge-notice').classList.remove('hidden');
    $('bridge-notice').textContent = 'Starter office preview · data is an example workspace; changes and provider execution require the private desktop/browser workspace.';
    $('core-label').textContent='Starter office preview';$('core-note').textContent='Example state · read only';
  } else if (bridge?.transport === 'personal-browser') { $('core-label').textContent='Private browser workspace'; $('core-note').textContent='Connected to your desktop app'; }
  const route = location.hash.replace('#', '') as ViewName;const params=new URLSearchParams(location.search);const requested=params.get('workspace')||'';const workspaceRoute=['chat','blueprint','softboard','timeline','whiteboard','decisions'].includes(requested)?requested:null;const ceoRoute=params.get('ceo')==='true';
  if(workspaceRoute||ceoRoute)ffOperations=true;ffFocus=params.get('company')||params.get('companyId')?{kind:'company',companyId:params.get('company')||params.get('companyId')||''}:{kind:'portfolio'};
  navigate(workspaceRoute||ceoRoute?'office':route in VIEW_IDS?route:'office',false);if(workspaceRoute)switchWorkspaceTab(workspaceRoute);if(ceoRoute)setPortfolioOpen(true);
  if(workspaceRoute||ceoRoute){const navName=ceoRoute?'operations':workspaceRoute==='softboard'?'team':workspaceRoute==='timeline'?'roadmap':workspaceRoute==='whiteboard'?'whiteboard':'operations';ffSetNav(navName);}
  ffApplyMode();
  const deepLinkFocus=ffFocus;ffFocus={kind:'portfolio'};
  { const status=document.getElementById('workspace-action-status'),bar=document.querySelector('#freeflow-surface .ff-surface-bar');
    if(status&&bar&&!bar.contains(status)){status.classList.add('ff-nav-status');status.setAttribute('role','status');status.setAttribute('aria-live','polite');bar.append(status);} }
  void safeTask(async()=>{
    await refreshWorkspace();
    if(!officeState&&bridge?.officeSnapshot)await refreshOffice();
    if(deepLinkFocus.kind!=='portfolio')await ffTransitionScope(deepLinkFocus,null);
    else ffCanonicalizeUrl();
  });
}
boot();
export {};
