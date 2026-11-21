/**
 * Renderer-side DTO types for the v0.3 Office & Projects surface.
 *
 * Structural copies of src/shared/contract.ts (authoritative, owned by the
 * runtime agent). v3 bridge methods are feature-detected by the adapter so
 * the renderer keeps working — honestly degraded — against a v2 bridge.
 */

export type ApiProvider = 'openai' | 'anthropic';
export type ProjectProvider = ApiProvider | 'ollama';
export type ProjectNodeRole = 'director' | 'research' | 'build' | 'review' | 'custom';
export type NodeStatus = 'pending' | 'running' | 'succeeded' | 'failed' | 'skipped';

export interface VaultStatus {
  encryptionAvailable: boolean;
  providers: Record<ApiProvider, { configured: boolean; readable: boolean; updatedAt: string | null }>;
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
  baseUrl: string;
  models: ModelInfo[];
  error: string | null;
}

export interface BudgetLimits {
  maxTokens: number;
  maxMinutes: number;
  maxUsd: number;
}
export interface PriceRates {
  inputUsdPerMillion: number;
  outputUsdPerMillion: number;
}

// ---------------------------------------------------------------------------
// v3: hierarchy, office template, loops (aligned to src/shared/contract.ts)
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

export interface ProjectNode {
  id: string;
  role: ProjectNodeRole;
  title: string;
  instructions: string;
  dependsOn: string[];
  status: NodeStatus;
  budget: BudgetLimits;
  // v3 (all optional; absent on legacy standard projects):
  kind?: NodeKind;
  parentId?: string | null;
  depth?: NodeDepth;
  /** Canonical room id (reassignment metadata). Rooms are derived projections. */
  roomId?: string | null;
  /** Bundled skill id attached to this node, or null. */
  skillRef?: string | null;
  /** When true, the run waits for an explicit approval before executing this node. */
  approvalBefore?: boolean;
}

export interface OfficeLayoutMeta {
  roomOrder?: string[];
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
  template?: ProjectTemplate;
  successCriteria?: string[];
  loopPolicy?: LoopPolicy | null;
  office?: OfficeLayoutMeta;
}

export interface ProjectNodeDraft {
  role: ProjectNodeRole;
  title: string;
  instructions: string;
  dependsOn: Array<number | string>;
  budget?: Partial<BudgetLimits>;
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
  /** All attempt artifact ids, oldest first. */
  artifactIds?: string[];
  lastArtifactSha256?: string | null;
}

/** Per review-node bounded loop state persisted on the run. */
export interface LoopState {
  /** Number of revision requeues so far (0 = still on the first attempt). */
  iterations: number;
  /** Consecutive revision rounds where every target artifact hash was unchanged. */
  noProgress: number;
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
// v3: skills catalog, hiring, approvals, office projection
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
  /** Must be true; the renderer collects an explicit user confirmation. */
  confirmed: boolean;
}

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

export interface OfficeRoomMember {
  nodeId: string;
  title: string;
  kind: NodeKind | null;
  role: ProjectNodeRole;
  depth: NodeDepth | null;
  parentId: string | null;
  roomId: string;
  skillRef: string | null;
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

export type ShellMode = 'launcher' | 'content';

// ---------------------------------------------------------------------------
// v4: provider-backed Director chat (aligned to src/shared/contract.ts)
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
  skillIds: string[];
  skillSha256: Record<string, string>;
  promptSha256: string;
  textSha256: string;
}

/** Data-only suggested next step; never a remote command. */
export interface ChatAction {
  kind: 'create-project' | 'open-roadmap';
  label: string;
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
  actions: ChatAction[];
  createdAt: string;
  finishedAt: string | null;
}

export interface ChatSession {
  id: string;
  title: string;
  /** v6: 'donna' sessions use the Donna advisory system prompt. Absent = 'director'. */
  mode?: 'director' | 'donna';
  projectId: string | null;
  provider: ProjectProvider;
  model: string;
  skillIds: string[];
  priceRates: PriceRates;
  budget: BudgetLimits;
  usage: ChatUsage & { elapsedSeconds: number };
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
}

export type ChatSessionSummary = Omit<ChatSession, 'messages'> & { messageCount: number };

export interface CreateChatSessionRequest {
  title?: string;
  /** v6: defaults to 'director'; 'donna' uses the Donna advisory system prompt. */
  mode?: 'director' | 'donna';
  projectId?: string | null;
  provider: ProjectProvider;
  model: string;
  skillIds?: string[];
  priceRates: PriceRates;
  budget?: Partial<BudgetLimits>;
}

export interface SendChatMessageRequest {
  sessionId: string;
  text: string;
  /** Must be true; the renderer collects an explicit user confirmation. */
  confirmed: boolean;
}

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
  enabled: boolean;
  running: boolean;
  port: number | null;
  encryptionAvailable: boolean;
  paired: boolean;
}

export interface CompanionEnableResult {
  ok: boolean;
  /** High-entropy pairing token, returned exactly ONCE. Never persisted in plaintext. */
  token?: string;
  port?: number;
  error?: string;
}
