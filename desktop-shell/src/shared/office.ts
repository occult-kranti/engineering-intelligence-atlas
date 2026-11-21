/** Durable office definitions are records, not claims that model processes are running. */
export type OfficeEntityStatus = 'active' | 'paused';
export interface OfficeCompany {
  id: string; name: string; repoUrl: string | null; status: OfficeEntityStatus;
  assistantId: string; createdAt: string; source: string;
  importedAt: string | null; githubStatus: 'unchecked' | 'metadata-reviewed';
  visibility?: 'public' | 'private' | null; defaultBranch?: string | null;
}
export interface OfficeLocation {
  id: string; companyId: string; name: string; status: OfficeEntityStatus; assistantId: string; createdAt: string;
}
export interface OfficeDepartment {
  id: string; companyId: string; officeId: string; name: string; status: OfficeEntityStatus; assistantId: string; createdAt: string;
}
export interface OfficeEmployee {
  id: string; companyId: string | null; officeId: string | null; departmentId: string | null;
  name: string; role: string; kind: 'assistant' | 'specialist';
  status: 'active' | 'paused' | 'fired'; skillPaths: string[]; createdAt: string; updatedAt: string;
  assignmentKey?: string | null;
}
export type OfficeJobStatus = 'queued' | 'waiting-budget' | 'running' | 'paused' | 'cancelled' | 'completed' | 'failed' | 'budget-exhausted' | 'needs-review';
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
export interface OfficeGoalStep { id: string; title: string; employeeId: string; goal: string; dependsOn: string[]; serviceContractId?: string | null; knowledgeTransferIds?: string[] }
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
}
export interface OfficeCheckpoint { id: string; goalId: string; jobId: string | null; iteration: number; summary: string; artifactUri: string | null; createdAt: string }
export interface OfficeRoom { id: string; name: string; departmentId: string | null; x: number; y: number; width: number; height: number }
export interface OfficeDesk { id: string; roomId: string; employeeId: string; x: number; y: number }
export interface OfficeWhiteboard { id: string; roomId: string; ownerEmployeeId: string; title: string; goalIds: string[]; jobIds: string[]; roadmapItemIds?: string[]; x: number; y: number }
export interface OfficeBlueprint { id: string; companyId: string; officeId: string; rooms: OfficeRoom[]; desks: OfficeDesk[]; whiteboards: OfficeWhiteboard[] }
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
  id: string; entityId: string; kind: 'company' | 'office' | 'department' | 'employee' | 'goal' | 'job' | 'knowledge' | 'artifact' | 'roadmap' | 'operation' | 'authority';
  title: string; companyId: string | null; parentId: string | null; ownerEmployeeId: string | null;
  status: string; updatedAt: string; relatedIds: string[];
}
export interface OfficeAuthority {
  schemaVersion: 1; managedEmployeeIds: string[]; grants: AuthorityGrant[]; ledger: AuthorityLedgerEntry[]; index: OfficeIndexEntry[];
}
export interface OfficeSnapshot {
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
export type OfficeAction = 'create_company' | 'select_company' | 'import_repositories' | 'import_github_account'
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
  | 'grant_authority' | 'promote_employee' | 'revoke_authority' | 'set_authority_enforcement' | 'apply_employee_command' | 'rebuild_office_index' | 'rename_company' | 'check_worker_authority';
/** Every action has a fixed Rust-side schema; unknown fields are never executed. */
export interface OfficeCommand { action: OfficeAction; [key: string]: unknown }
export interface OfficeResult { ok: boolean; snapshot: OfficeSnapshot | null; error?: string; code?: string }

export interface OfficeWorkerStatus {
  enabled: boolean; running: boolean; activeJobId: string | null; lastError: string | null;
  concurrency?: number; activeJobIds?: string[];
}
