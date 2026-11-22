/** Durable office definitions are records, not claims that model processes are running. */
export type OfficeEntityStatus = 'active' | 'paused';
export interface OfficeCompany {
  id: string; name: string; repoUrl: string | null; status: OfficeEntityStatus;
  assistantId: string; createdAt: string; source: string;
  importedAt: string | null; githubStatus: 'unchecked' | 'metadata-reviewed';
  visibility?: 'public' | 'private' | null; defaultBranch?: string | null;
  parentCompanyId?: string | null;
}
export interface OfficeLocation {
  id: string; companyId: string; name: string; status: OfficeEntityStatus; assistantId: string; createdAt: string;
}
export interface OfficeDepartment {
  id: string; companyId: string; officeId: string; name: string; status: OfficeEntityStatus; assistantId: string; createdAt: string;
  parentDepartmentId?: string | null;
}
export interface OfficeEmployee {
  id: string; companyId: string | null; officeId: string | null; departmentId: string | null;
  name: string; role: string; kind: 'assistant' | 'specialist';
  status: 'active' | 'paused' | 'fired'; skillPaths: string[]; createdAt: string; updatedAt: string;
  assignmentKey?: string | null;
}
export type OfficeJobStatus = 'queued' | 'waiting-budget' | 'running' | 'paused' | 'cancelled' | 'completed' | 'failed' | 'budget-exhausted' | 'needs-review';
export interface OfficeDurationEstimate { optimisticMinutes: number; likelyMinutes: number; pessimisticMinutes: number }
export interface OfficeJobPair {
  stepId: string; phase: 'primary' | 'review'; peerEmployeeId: string; primaryJobId: string; reviewJobId: string;
}
/** Execution settlement is separate from this independently recorded acceptance. */
export interface OfficeStepReview {
  verdict: 'accepted' | 'revise' | 'blocked'; primaryArtifactSha256: string; reviewArtifactSha256: string;
  primaryArtifactComplete: boolean; summary: string; evidenceRefs: string[]; recordedAt: string;
}
export interface OfficeReviewFailure {
  reason: 'malformed-output' | 'input-budget' | 'artifact-mismatch' | 'recording-unconfirmed';
  summary: string; recordedAt: string;
}
export interface OfficeJob {
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
  pair?: OfficeJobPair | null; requestSha256?: string | null; artifactSha256?: string | null; review?: OfficeStepReview | null;
  /** Complete model-body digest; artifactSha256 still binds the reviewed file. */
  deliverableSha256?: string | null;
  reviewFailure?: OfficeReviewFailure | null;
  improvementSessionId?: string | null; improvementRoute?: OfficeImprovementRoute | null; budgetHoldUsd?: number;
}
export interface OfficeSchedule {
  id: string; companyId: string; name: string; enabled: boolean; everyMinutes: number;
  nextRunAt: string; lastEnqueuedAt: string | null; jobTemplate: Record<string, unknown>;
  lastError?: string | null;
}
export interface OfficeCacheEntry { key: string; companyId: string; artifactUri: string; bytes: number; createdAt: string; expiresAt: string; contentSha256?: string | null }
export interface OfficeCache { enabled: boolean; maxEntries: number; ttlMinutes: number; entries: OfficeCacheEntry[]; hits: number; misses: number }
export interface OfficeKnowledge { id: string; companyId: string; title: string; summary: string; artifactUri: string; createdAt: string }
export interface OfficeEvent { id: string; at: string; actor: string; action: string; entityId: string; summary: string }
export interface OfficeScope { kind: 'company' | 'office' | 'department' | 'employee'; id: string }
export interface OfficePolicy {
  approvalMode: 'review' | 'autonomous'; dispatchPaused: boolean;
  budget: { hardCapUsd: number; hardCapTokens: number | null; warningPercent: number };
}
export interface OfficeBudget {
  heldUsd?: number;
  observedUsd: number; estimatedUsd: number; reservedUsd: number; committedUsd: number; remainingUsd: number;
  committedTokens: number; remainingTokens: number | null; warning: boolean; atCap: boolean;
}
export interface OfficeExternalAttempt {
  attemptId: string; source: string; reservedUsd: number; maxTokens: number;
  usage: { inputTokens: number; outputTokens: number; costUsd: number };
  costStatus: 'reserved' | 'observed' | 'estimated'; settled: boolean; createdAt: string; updatedAt: string;
}
export interface OfficeChatMessage {
  id: string; role: 'user' | 'assistant' | 'system'; content: string; createdAt: string; source: 'user' | 'local' | 'provider' | 'cloud';
}
export interface OfficeChatThread { id: string; scope: OfficeScope; messages: OfficeChatMessage[] }
export interface OfficeGoalStep {
  id: string; title: string; employeeId: string; goal: string; dependsOn: string[]; serviceContractId?: string | null; knowledgeTransferIds?: string[];
  reviewerEmployeeId?: string | null; reviewerServiceContractId?: string | null;
  estimate?: OfficeDurationEstimate | null; reviewEstimate?: OfficeDurationEstimate | null;
}
export interface OfficeGoalRunSettings {
  mode: 'manual' | 'provider'; provider: 'anthropic' | 'openai' | 'ollama'; model: string; authorized: boolean;
  maxTokens: number; maxUsd: number; maxMinutes: number;
  priceRates: { inputUsdPerMillion: number | null; outputUsdPerMillion: number | null };
  allowedTools?: string[];
}
export interface OfficeGoal {
  id: string; companyId: string; scope: OfficeScope; title: string; description: string;
  mode: 'plan' | 'execute'; status: 'draft' | 'planned' | 'running' | 'paused' | 'completed' | 'needs-review';
  maxIterations: number; iteration: number; jobIds: string[]; steps: OfficeGoalStep[]; runSettings: OfficeGoalRunSettings;
  createdAt: string; updatedAt: string;
  stopReason?: string | null;
  sourceRequestId?: string | null; requestSha256?: string | null; sourceMessageId?: string | null;
  improvementSessionId?: string | null;
}
export interface OfficeStickyNote {
  id:string; revision:number; companyId:string; officeId:string; departmentId:string|null;
  kind:'comment'|'todo'; color:'yellow'|'blue'|'green'|'pink'|'purple'|'gray'; text:string;
  status:'open'|'done'|'archived'; ownerEmployeeId:string|null; goalIds:string[]; x:number; y:number;
  createdAt:string; updatedAt:string;
}
export interface OfficeImprovementAllowance {
  id:string; capUsd:number; carriedObservedUsd:number; carriedEstimatedUsd:number; sourceReference:string; createdAt:string;
}
export interface OfficeImprovementBudget {
  capUsd:number; carriedObservedUsd:number; carriedEstimatedUsd:number; observedUsd:number;
  estimatedUsd:number; reservedUsd:number; heldUsd:number; committedUsd:number; remainingUsd:number; effectiveRemainingUsd:number;
}
export interface OfficeImprovementAllowedRoute { provider:'anthropic'|'openai'|'ollama'; model:string }
export interface OfficeImprovementRoute extends OfficeImprovementAllowedRoute {
  priceRates:{inputUsdPerMillion:number;outputUsdPerMillion:number}; source:string;
  observedAt:string; expiresAt:string; maxInputTokens:number; catalogSha256:string; costBasis:'standard-token-rates';
}
export interface OfficeImprovementSession {
  id:string; revision:number; companyId:string; officeId:string; departmentId:string|null; allowanceId:string;
  title:string; objective:string; primaryEmployeeId:string; reviewerEmployeeId:string;
  serviceContractId:string|null; reviewerServiceContractId:string|null; runSettings:OfficeGoalRunSettings;
  allowedRoutes:OfficeImprovementAllowedRoute[]; continuation:'until-budget'|'backlog'; maxCycles:number|null;
  taskNoteIds:string[]; cycle:number; activeGoalId:string|null; goalIds:string[];
  activeNoteId:string|null; activeNoteRevision:number|null;
  status:'paused'|'active'|'waiting-work'|'waiting-budget'|'needs-review'|'completed'|'cancelled';
  stopReason:string|null; recentArtifactSha256s:string[]; createdAt:string; updatedAt:string;
}
export interface OfficeImprovementReceipt {
  id:string; requestSha256:string; action:string; result:Record<string,unknown>; at:string;
}
export interface OfficeCheckpoint { id: string; goalId: string; jobId: string | null; iteration: number; summary: string; artifactUri: string | null; createdAt: string }
export interface OfficeRoom { id: string; name: string; departmentId: string | null; x: number; y: number; width: number; height: number }
export interface OfficeDesk { id: string; roomId: string; employeeId: string; x: number; y: number }
export interface OfficeWhiteboard { id: string; roomId: string; ownerEmployeeId: string; title: string; goalIds: string[]; jobIds: string[]; roadmapItemIds?: string[]; x: number; y: number; revision?: number }
export interface OfficeBlueprint { id: string; companyId: string; officeId: string; rooms: OfficeRoom[]; desks: OfficeDesk[]; whiteboards: OfficeWhiteboard[]; revision?: number }
export type PortfolioServiceKey = 'engineering' | 'design-architecture' | 'research-knowledge' | 'security' | 'hackathon' | 'music-arts';
export interface PortfolioGroup { id: string; name: string; description: string; companyIds: string[]; status: OfficeEntityStatus; createdAt: string; updatedAt: string }
export interface PortfolioService { id: string; key: PortfolioServiceKey; name: string; companyId: string; officeId: string; departmentId: string; employeeIds: string[]; retiredEmployeeIds?: string[]; status: OfficeEntityStatus; createdAt: string; updatedAt: string }
export interface PortfolioServiceContract {
  id: string; serviceId: string; recipientCompanyId: string; recipientOfficeId: string | null; recipientDepartmentId: string | null;
  employeeIds: string[]; allowedTools: string[]; status: 'active' | 'paused' | 'revoked'; createdAt: string; updatedAt: string;
}
export interface PortfolioKnowledgeTransfer {
  id: string; sourceCompanyId: string; recipientCompanyId: string; knowledgeId: string;
  status: 'requested' | 'granted' | 'revoked'; purpose: string; createdAt: string; updatedAt: string;
}
export interface PortfolioRoadmapItem {
  id: string; scope: { kind: 'company' | 'group' | 'global'; id: string }; title: string; description: string;
  ownerEmployeeId: string; departmentId: string | null; serviceContractId: string | null;
  status: 'planned' | 'in-progress' | 'blocked' | 'done'; dependencies: string[]; goalIds: string[]; jobIds: string[];
  evidence: string | null; createdAt: string; updatedAt: string;
  revision?: number; reviewerEmployeeId?: string | null; reviewerServiceContractId?: string | null;
  estimate?: OfficeDurationEstimate | null; reviewEstimate?: OfficeDurationEstimate | null;
}
export interface OfficePortfolio {
  ceo: { enabled: boolean; title: string; focusGroupId: string | null; sharedServicesCompanyId: string | null; updatedAt: string };
  groups: PortfolioGroup[]; services: PortfolioService[]; contracts: PortfolioServiceContract[];
  transfers: PortfolioKnowledgeTransfer[]; roadmap: PortfolioRoadmapItem[];
  recommendations: Array<{ employeeId: string; serviceId: string; reason: string }>;
}
export type DecisionPanelRoleKey = 'engineering' | 'frontend-extensions' | 'backend' | 'database-cache' | 'github-release'
  | 'qa' | 'security' | 'research-knowledge' | 'knowledge' | 'design-architecture' | 'math-geometry' | 'music-arts'
  | 'hackathon' | 'newton' | 'tesla' | 'research-skeptic' | 'resonance-advisor' | 'paired-research' | 'figma-design-systems' | 'directory-steward';
export interface DecisionPanelMember {
  employeeId: string; roleKey: DecisionPanelRoleKey; serviceContractId: string | null; selection: 'reused' | 'hired';
}
export interface DecisionPanelDecision {
  id: string; round: number; verdict: 'accepted' | 'revise' | 'defer' | 'reject';
  summary: string; evidence: string[]; createdAt: string;
}
export interface DecisionPanel {
  id: string; companyId: string; scope: { kind: 'company' | 'group' | 'office' | 'department'; id: string };
  title: string; task: string; focus: 'software' | 'design' | 'research' | 'data';
  status: 'draft' | 'running' | 'review' | 'decided' | 'paused'; members: DecisionPanelMember[];
  round: number; maxRounds: number;
  /** maxUsd bounds the entire panel; maxTokens and maxMinutes bound each request. */
  limits: { maxUsd: number; maxTokens: number; maxMinutes: number };
  goalIds: string[]; roadmapItemIds: string[]; decisions: DecisionPanelDecision[];
  createdAt: string; updatedAt: string;
}
export type AuthorityCapability = 'team.manage' | 'work.manage' | 'knowledge.manage' | 'layout.manage' | 'roadmap.manage' | 'cache.manage' | 'authority.manage' | 'provider.run' | 'github.read_repository' | 'github.publish_changes';
export interface AuthorityScope { kind: 'company' | 'office' | 'department' | 'employee' | 'goal'; id: string }
export interface AuthorityGrant {
  id: string; employeeId: string; scope: AuthorityScope; preset: 'full' | 'partial'; capabilities: AuthorityCapability[];
  type: 'permission' | 'promotion'; title: string | null; issuer: 'owner' | 'donna';
  grantedAt: string; expiresAt: string; revokedAt: string | null; reason: string;
  revokedBy: string | null; revokeReason: string | null; parentGrantIds: string[];
}
export interface AuthorityLedgerEntry {
  id: string; at: string; actor: string; action: string; targetId: string; scope: AuthorityScope | null;
  summary: string; grantId: string | null; outcome: 'applied' | 'denied';
}
export interface OfficeIndexEntry {
  id: string; entityId: string; kind: 'company' | 'office' | 'department' | 'employee' | 'goal' | 'goal-step' | 'job' | 'review' | 'whiteboard' | 'sticky-note' | 'improvement-session' | 'knowledge' | 'artifact' | 'roadmap' | 'operation' | 'authority';
  title: string; companyId: string | null; parentId: string | null; ownerEmployeeId: string | null;
  status: string; updatedAt: string; relatedIds: string[];
  reviewerEmployeeId?: string | null;
}
export interface OfficeAuthority {
  schemaVersion: 1; managedEmployeeIds: string[]; grants: AuthorityGrant[]; ledger: AuthorityLedgerEntry[]; index: OfficeIndexEntry[];
}
export interface OfficeSnapshot {
  /** v1/v2 are historical; v3 fences session budgets and scoped improvement claims. */
  schemaVersion: 1 | 2 | 3; activeCompanyId: string;
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
  stickyNotes?: OfficeStickyNote[]; improvementAllowance?: OfficeImprovementAllowance|null;
  improvementBudget?: OfficeImprovementBudget|null;
  improvementSessions?: OfficeImprovementSession[];
  improvementReceipts?: OfficeImprovementReceipt[];
}
export type OfficeAction = 'create_company' | 'select_company' | 'import_repositories' | 'import_github_account'
  | 'create_office' | 'create_department' | 'set_department_parent' | 'hire_employee' | 'pause_employee' | 'resume_employee' | 'fire_employee'
  | 'pause_company' | 'resume_company' | 'pause_office' | 'resume_office' | 'pause_department' | 'resume_department'
  | 'enqueue_job' | 'claim_job' | 'reserve_job' | 'finish_job' | 'record_step_review' | 'record_review_failure' | 'complete_job' | 'heartbeat_job' | 'cancel_job' | 'pause_job' | 'resume_job'
  | 'create_schedule' | 'pause_schedule' | 'resume_schedule' | 'tick_schedules'
  | 'configure_cache' | 'clear_cache' | 'get_cache' | 'put_cache' | 'add_knowledge'
  | 'configure_policy' | 'reserve_external' | 'settle_external' | 'approve_job' | 'bootstrap_directors'
  | 'post_chat' | 'post_assistant_message' | 'create_goal' | 'create_paired_workflow' | 'plan_goal' | 'set_goal_plan' | 'execute_goal' | 'advance_goal'
  | 'pause_goal' | 'resume_goal' | 'checkpoint_goal' | 'tick_goals' | 'ensure_blueprint' | 'save_blueprint' | 'upsert_room'
  | 'place_employee' | 'upsert_whiteboard' | 'record_github_activity' | 'github_operation'
  | 'configure_ceo' | 'upsert_portfolio_group' | 'ensure_shared_services' | 'optimize_portfolio'
  | 'contract_service' | 'share_knowledge' | 'upsert_roadmap_item' | 'schedule_repository_reviews'
  | 'convene_panel' | 'start_panel_round' | 'record_panel_decision' | 'pause_panel' | 'resume_panel' | 'apply_remote_command'
  | 'grant_authority' | 'promote_employee' | 'revoke_authority' | 'set_authority_enforcement' | 'apply_employee_command' | 'rebuild_office_index' | 'rename_company' | 'set_company_parent' | 'check_worker_authority'
  | 'upsert_sticky_note' | 'archive_sticky_note' | 'register_improvement_allowance' | 'create_improvement_session' | 'control_improvement_session' | 'tick_improvements';
/** Every action has a fixed Rust-side schema; unknown fields are never executed. */
export interface OfficeCommand { action: OfficeAction; [key: string]: unknown }
export interface OfficeResult { ok: boolean; snapshot: OfficeSnapshot | null; error?: string; code?: string; observer?: import('./office-observer').OfficeObservation }

/** Read-only scheduler evidence. This does not attest to provider execution. */
export interface OfficeImprovementCoordinatorStatus {
  sampledAt: string; enabled: boolean; checking: boolean;
  observation: {
    sessionId: string; sessionRevision: number; companyId: string; officeId: string; departmentId: string | null;
    checkedAt: string; outcome: 'checking' | 'blocked' | 'progress' | 'idle';
    reason: 'no-current-eligible-priced-route' | 'attempt-needs-review' | 'improvement-state-needs-review' | null;
  } | null;
}

export interface OfficeWorkerStatus {
  enabled: boolean; running: boolean; activeJobId: string | null; lastError: string | null;
  concurrency?: number; activeJobIds?: string[];
  /** Live generation callbacks, distinct from a loaded model or a claimed job. */
  execution?: { sampledAt:string; activeCalls:Array<{jobId:string;phase:'provider'|'model';startedAt:string}> };
  improvement?: OfficeImprovementCoordinatorStatus;
  /** Latest bounded deterministic reviews. Flagged reports are linked by the job's artifact. */
  sourceReviews?: import('./source-review').SourceReviewReport[];
}
