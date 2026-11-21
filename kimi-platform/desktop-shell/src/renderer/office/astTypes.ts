/**
 * Renderer-side DTO types for the v0.6 Donna / shared-assistant surface.
 *
 * Structural copies of src/shared/assistant.ts and the v6 section of
 * src/shared/contract.ts (both authoritative). The v6 bridge methods are
 * feature-detected by the adapter so the renderer degrades honestly against
 * a v5 bridge ("requires desktop 0.6 runtime"). No secrets, no artifact
 * bodies, and no chain-of-thought ever cross this boundary.
 */

// ---- shared/assistant structural copies (renderer subset) ----

export const ASSISTANT_SCOPES = ['enterprise', 'company', 'department', 'office'] as const;
export type AssistantScope = (typeof ASSISTANT_SCOPES)[number];

export const ASSISTANT_GATES = [
  'plan-approval',
  'credentials',
  'external-writes',
  'code-execution',
  'physical-action',
  'high-risk',
  'live-provider-confirmation',
] as const;
export type AssistantGate = (typeof ASSISTANT_GATES)[number];

export type AssistantDefinitionId =
  | 'donna'
  | 'company-operations-assistant'
  | 'department-coordinator'
  | 'repository-integration-steward';

export interface AssistantDefinition {
  id: AssistantDefinitionId;
  title: string;
  scope: AssistantScope;
  reportsTo: string | null;
  authority: 'advisory' | 'propose-only' | 'execute-approved';
  providerChat: 'none' | 'optional-advisory';
  permanent: boolean;
  mappedRoleIds: string[];
  readPolicies: Array<'enterprise-state' | 'confirmed-public-metadata'>;
  gates: AssistantGate[];
  capabilities: string[];
  description: string;
}

export const ASSISTANT_ACTIONS = [
  'queue.add',
  'queue.reorder',
  'worker.hire',
  'worker.pause',
  'worker.resume',
  'worker.fire',
  'department.pause',
  'department.resume',
  'department.archive',
  'company.pause',
  'company.resume',
  'company.archive',
  'cache.invalidate',
  'schedule.upsert',
  'schedule.pause',
  'schedule.resume',
  'schedule.delete',
  'schedule.run_now',
  'study.enqueue',
  'repository.import',
  'repository.assign',
  'repository.propose_structure',
  'knowledge.transfer',
  'program.pump',
] as const;
export type AssistantAction = (typeof ASSISTANT_ACTIONS)[number];

export type AssistantRisk = 'low' | 'medium' | 'high';

export interface AssistantActionPolicy {
  risk: AssistantRisk;
  requiresApproval: boolean;
  gates: readonly AssistantGate[];
  drainAndPreserve: boolean;
  external: boolean;
  structural: boolean;
  description: string;
}

export type AssistantProposalStatus = 'proposed' | 'approved' | 'rejected' | 'executed' | 'failed' | 'cancelled';

export interface AssistantActionProposal {
  contractVersion: 1;
  id: string;
  scope: AssistantScope;
  actor: AssistantDefinitionId;
  action: AssistantAction;
  payload: Record<string, unknown>;
  risk: AssistantRisk;
  payloadHash: string;
  expectedVersion: number;
  requiresApproval: boolean;
  status: AssistantProposalStatus;
  proposedAt: number;
  decidedAt: number | null;
  executedAt: number | null;
  resultSummary: string;
}

export const ASSISTANT_JOB_KINDS = ['ledger_refresh', 'cache_refresh', 'program_pump_mock', 'repository_sync', 'study_plan'] as const;
export type AssistantJobKind = (typeof ASSISTANT_JOB_KINDS)[number];

export type AssistantJobSchedule =
  | { type: 'one-time'; runAt: number }
  | { type: 'interval'; intervalMs: number; anchorAt: number };

export interface EnterpriseReservation {
  maxTokens: number;
  maxCalls: number;
  maxMinutes: number;
  maxCostUsdMicros: number;
}

export interface AssistantJob {
  contractVersion: 1;
  id: string;
  scope: AssistantScope;
  kind: AssistantJobKind;
  schedule: AssistantJobSchedule;
  enabled: boolean;
  nextRunAt: number | null;
  lastRunAt: number | null;
  runCount: number;
  maxRuns: number | null;
  budget: EnterpriseReservation;
  version: number;
}

export type StudyQueueStatus = 'draft' | 'queued' | 'in-progress' | 'completed' | 'dropped';

export interface StudyQueueItem {
  id: string;
  skillId: string;
  resourceRef: string;
  topic: string;
  goal: string;
  evaluation: string;
  status: StudyQueueStatus;
  providerCalls: false;
}

export type RepositoryVisibility = 'public' | 'private' | 'internal';

export interface RepositoryMetadata {
  url: string;
  owner: string;
  name: string;
  description: string;
  language: string | null;
  topics: string[];
  license: string | null;
  archived: boolean;
  defaultBranch: string;
  commitSha: string;
  visibility: RepositoryVisibility;
}

export type RepoAssignmentStatus = 'assigned' | 'quarantined' | 'proposed_new_structure';

export interface RepoAssignmentPlan {
  contractVersion: 1;
  url: string;
  commitSha: string;
  status: RepoAssignmentStatus;
  companyKey: string | null;
  departmentKey: string | null;
  discipline: string | null;
  skillId: string | null;
  confidence: number;
  rationale: string;
  readOnly: boolean;
  redistributionAllowed: boolean;
  notes: string[];
}

export type GithubIntakeMode = 'public-anonymous' | 'credentialed-approved';

export interface KnowledgeTransferRecord {
  contractVersion: 1;
  id: string;
  refs: Array<{
    artifactId: string;
    runId: string;
    nodeKey: string;
    attempt: number;
    kind: string;
    title: string;
    summary: string;
    contentSha256: string;
  }>;
  handoff: { from: string; to: string; summary: string };
  contentSha256: string;
}

export type AssistantQueueItemKind = 'company-run' | 'study' | 'repository-triage' | 'custom';
export type AssistantQueueItemStatus = 'queued' | 'dispatched' | 'done' | 'dropped';

export interface AssistantWorkQueue {
  contractVersion: 1;
  id: string;
  scope: AssistantScope;
  scopeKey: string;
  version: number;
}

export interface AssistantQueueItem {
  contractVersion: 1;
  id: string;
  queueId: string;
  itemKind: AssistantQueueItemKind;
  refId: string;
  title: string;
  position: number;
  status: AssistantQueueItemStatus;
  payloadHash: string;
  version: number;
}

export const CACHE_NAMESPACES = ['skill-excerpts', 'blueprint', 'snapshot', 'repository-metadata'] as const;
export type CacheNamespace = (typeof CACHE_NAMESPACES)[number];

export type CompanyLifecycleStatus = 'active' | 'paused' | 'archived';
export type DepartmentLifecycleStatus = 'active' | 'paused' | 'archived';

export interface DonnaPrompt {
  system: string;
  user: string;
}

// ---- shared/contract v6 DTO structural copies ----

export interface AssistantDefinitionsDto {
  definitions: AssistantDefinition[];
  gates: readonly AssistantGate[];
  actions: Record<AssistantAction, AssistantActionPolicy>;
}

export interface AssistantRepositoryDto {
  metadata: RepositoryMetadata;
  plan: RepoAssignmentPlan;
  intakeMode: GithubIntakeMode;
  appliedAt: number | null;
  appliedBy: string | null;
}

export interface AssistantQueueDto {
  queue: AssistantWorkQueue;
  items: AssistantQueueItem[];
}

export interface AssistantStateDto {
  enterpriseId: string;
  version: number;
  eventSeq: number;
  proposals: AssistantActionProposal[];
  queues: AssistantQueueDto[];
  jobs: AssistantJob[];
  studyItems: StudyQueueItem[];
  repositories: AssistantRepositoryDto[];
  transfers: KnowledgeTransferRecord[];
  lifecycle: {
    companies: Record<string, CompanyLifecycleStatus>;
    departments: Record<string, DepartmentLifecycleStatus>;
  };
}

export interface AssistantEventDto {
  seq: number;
  ts: string;
  event: string;
  detail?: string;
}

export interface AssistantEventPushDto {
  enterpriseId: string;
  version: number;
  eventSeq: number;
  event: string;
  detail?: string;
}

export interface AssistantProposeRequest {
  enterpriseId: string;
  scope: AssistantScope;
  actor: AssistantDefinitionId;
  action: AssistantAction;
  payload: Record<string, unknown>;
}

export interface AssistantDecideRequest {
  enterpriseId: string;
  proposalId: string;
  decision: 'approved' | 'rejected';
  confirmedGates?: AssistantGate[];
}

export interface AssistantIdRequest {
  enterpriseId: string;
  proposalId: string;
}

export interface AssistantQueueAddRequest {
  enterpriseId: string;
  scope: AssistantScope;
  scopeKey: string;
  queueId?: string;
  item: {
    id?: string;
    itemKind: AssistantQueueItemKind;
    refId: string;
    title?: string;
    payload?: Record<string, unknown>;
  };
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
  payload: Record<string, unknown>;
  expectedVersion: number;
  confirmed: boolean;
  confirmedGates?: AssistantGate[];
}

export interface AssistantLifecycleSetRequest {
  enterpriseId: string;
  target: 'company' | 'department';
  key: string;
  status: 'active' | 'paused' | 'archived';
  expectedVersion: number;
  confirmed: boolean;
  confirmedGates?: AssistantGate[];
}

export interface AssistantJobUpsertRequest {
  enterpriseId: string;
  job: {
    id: string;
    scope: AssistantScope;
    kind: AssistantJobKind;
    schedule: AssistantJobSchedule;
    enabled?: boolean;
    maxRuns?: number | null;
  };
  expectedVersion: number;
  confirmed: boolean;
  confirmedGates?: AssistantGate[];
}

export interface AssistantJobMutationRequest {
  enterpriseId: string;
  jobId: string;
  expectedVersion: number;
  confirmed?: boolean;
  confirmedGates?: AssistantGate[];
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
  url: string;
}

export interface AssistantRepoFetchRequest {
  enterpriseId: string;
  url: string;
  intakeMode: GithubIntakeMode;
  expectedVersion: number;
  confirmed: boolean;
  confirmedGates?: AssistantGate[];
}

export interface AssistantRepoApplyRequest {
  enterpriseId: string;
  url: string;
  expectedVersion: number;
  confirmed: boolean;
  confirmedGates?: AssistantGate[];
}

export interface AssistantCacheInvalidateRequest {
  enterpriseId: string;
  namespace: CacheNamespace;
  expectedVersion: number;
}

export interface AssistantCacheStatusDto {
  namespace: CacheNamespace;
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
  text: string;
  scope?: AssistantScope;
  actor?: AssistantDefinitionId;
  persist?: boolean;
}
