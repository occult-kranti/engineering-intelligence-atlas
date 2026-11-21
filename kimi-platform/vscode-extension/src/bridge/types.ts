/**
 * Domain types mirrored from desktop-shell src/shared/contract.ts and the
 * actual companion HTTP server in desktop-shell src/main/companion.ts
 * (bridgeVersion 4). All HTTP surface is isolated in routes.ts + client.ts.
 *
 * Pure types only: this file must never import 'vscode' or 'node:*'.
 */

export type ProjectProvider = 'openai' | 'anthropic' | 'ollama';
export type ProjectNodeRole = 'director' | 'research' | 'build' | 'review' | 'custom';
export type NodeStatus = 'pending' | 'running' | 'succeeded' | 'failed' | 'skipped';
export type ProjectTemplate = 'standard' | 'office';
export type NodeKind = 'director' | 'subdirector' | 'worker';
export type NodeDepth = 0 | 1 | 2;

export interface LoopPolicy {
  maxIterations: number;
  noProgressLimit: number;
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

export interface ProjectNode {
  id: string;
  role: ProjectNodeRole;
  title: string;
  instructions: string;
  dependsOn: string[];
  status: NodeStatus;
  budget: BudgetLimits;
  kind?: NodeKind;
  parentId?: string | null;
  depth?: NodeDepth;
  roomId?: string | null;
  skillRef?: string | null;
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
  version: number;
  template?: ProjectTemplate;
  successCriteria?: string[];
  loopPolicy?: LoopPolicy | null;
  office?: OfficeLayoutMeta;
}

/**
 * Project creation payload sent by this extension. Matches the desktop
 * CreateProjectRequest plus the explicit user-confirmation flag required for
 * any state-changing operation.
 */
export interface CreateProjectPayload {
  name: string;
  goal: string;
  provider: ProjectProvider;
  model: string;
  template: ProjectTemplate;
  successCriteria?: string[];
  /** Must be true: the extension collects an explicit user confirmation first. */
  confirmed: true;
}

/**
 * Run start payload (POST /v1/runs/start). The v4 desktop server reads
 * exactly these three fields; the extension still collects a modal user
 * confirmation client-side before sending.
 */
export interface StartRunPayload {
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
  attempt?: number;
  artifactIds?: string[];
  lastArtifactSha256?: string | null;
}

export interface LoopState {
  iterations: number;
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
  loops?: Record<string, LoopState>;
  createdAt: string;
  updatedAt: string;
  finishedAt: string | null;
}

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

export type ApprovalKind = 'hire' | 'node';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

export interface ApprovalRecord {
  id: string;
  kind: ApprovalKind;
  projectId: string;
  runId: string | null;
  nodeId: string | null;
  /** SHA-256 of the canonical payload; decisions must present the exact hash. */
  payloadHash: string;
  payload: unknown;
  status: ApprovalStatus;
  createdAt: string;
  decidedAt: string | null;
}

export interface DecideApprovalPayload {
  projectId: string;
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
  nodeCount: number;
}

export interface ArtifactResult {
  ok: boolean;
  text?: string;
  meta?: ArtifactMeta;
  error?: string;
}

export interface RunEventsResult {
  ok: boolean;
  events?: RunEventRecord[];
  nextIndex?: number;
  error?: string;
}

/** GET /health response (bridgeVersion 4 in the v4 desktop). */
export interface HealthStatus {
  ok: boolean;
  service?: string;
  bridgeVersion?: number;
}

// ---------------------------------------------------------------------------
// Chat (mirrors the v4 desktop contract: ChatMessage / ChatSession / etc.)
// ---------------------------------------------------------------------------

export type ChatMessageStatus = 'completed' | 'pending' | 'error' | 'cancelled';

export interface ChatUsage {
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

export interface ChatProvenance {
  provider: ProjectProvider;
  model: string;
  skillIds: string[];
  skillSha256: Record<string, string>;
  promptSha256: string;
  textSha256: string;
}

export interface ChatAction {
  kind: 'create-project' | 'open-roadmap';
  label: string;
  projectId?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  status: ChatMessageStatus;
  /** Untrusted display text; rendered as data only (textContent). */
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

export interface CreateChatSessionPayload {
  title?: string;
  projectId?: string | null;
  provider: ProjectProvider;
  model: string;
  skillIds?: string[];
  priceRates: PriceRates;
  budget?: Partial<BudgetLimits>;
}

export interface ChatSendPayload {
  text: string;
  /** Must be true; the caller must collect an explicit user confirmation. */
  confirmed: true;
}

/** sendMessage is fire-and-poll: the assistant reply arrives via getSession. */
export interface ChatSendResult {
  ok: boolean;
  userMessageId?: string;
  assistantMessageId?: string;
  error?: string;
}

export interface OkResult {
  ok: boolean;
  error?: string;
}

/**
 * Every companion route answers with an envelope: success is
 * `{ ok: true, <key>: ... }`, failure is HTTP error status with
 * `{ ok: false, error }`. client.ts unwraps these.
 */
export type Envelope<T extends object> = ({ ok: true } & T) | { ok: false; error?: string };

