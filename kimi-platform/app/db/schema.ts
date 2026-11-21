import {
  mysqlTable,
  mysqlEnum,
  serial,
  varchar,
  text,
  char,
  timestamp,
  bigint,
  double,
  int,
  boolean,
  json,
  uniqueIndex,
  index,
} from "drizzle-orm/mysql-core";
import type { DagSpec, RunBudget, SkillPin } from "../contracts/dag";
import type { SkillManifest, RiskSignal } from "../contracts/skill";
import type {
  RunState,
  RunNodeState,
  ApprovalKind,
  ApprovalState,
  EventActor,
  WorkerKind,
  WorkerStatus,
  AssignmentMode,
  WaitReason,
} from "../contracts/run";
import type { AcceptanceOutcome } from "../contracts/artifacts";
import type {
  AutonomyMode,
  AutonomyScope,
  GoalMode,
  OfficeBlueprintSpec,
  RoomBudgets,
  RoomKind,
} from "../contracts/office";
import type {
  ScopeFlag,
  ResourceTier,
  EvidenceLevel,
  DecompositionVerdict,
} from "../contracts/registry";
import type { EvaluationReport } from "../contracts/evaluation";
import type { ExecutionPlan, RedactionEvent, TruncationEvent } from "../contracts/prompting";
import type {
  ArtifactRef,
  CeoProgramState,
  CompanyKind,
  CompanyRun,
  Discipline,
  EnterpriseBlueprint,
  EnterpriseBudget,
  EnterpriseReservation,
  EnterpriseSkillPin,
  MemoryScope,
  WorkerContractStatus,
} from "../contracts/enterprise";
import type {
  AssistantGate,
  AssistantJobKind,
  AssistantJobSchedule,
  AssistantProposalStatus,
  AssistantRisk,
  AssistantScope,
  RepoAssignmentStatus,
  RepositoryVisibility,
  StudyQueueStatus,
} from "../contracts/assistant";
/**
 * Web-local assistant enums (the shared contract is byte-pinned with the
 * desktop shell, so Slice-A DTO additions live here until both repos bump).
 * Values match donna_vertical_slice_plan.md §3 exactly.
 */
export type AssistantQueueItemKind = "company-run" | "study" | "repository-triage" | "custom";
export type AssistantQueueItemStatus = "queued" | "dispatched" | "done" | "dropped";
export type GithubIntakeMode = "public-anonymous" | "credentialed-approved";
export type AssistantLifecycleStatus = "active" | "paused" | "archived";

export const users = mysqlTable("users", {
  id: serial("id").primaryKey(),
  unionId: varchar("unionId", { length: 255 }).notNull().unique(),
  name: varchar("name", { length: 255 }),
  email: varchar("email", { length: 320 }),
  avatar: text("avatar"),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
  lastSignInAt: timestamp("lastSignInAt").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ── Registry reference data (seeded; shared, readable by any signed-in owner) ──

export const registryRoles = mysqlTable("registry_roles", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull().unique(),
  family: varchar("family", { length: 255 }).notNull(),
  mission: text("mission").notNull(),
  outputs: text("outputs").notNull(),
  skills: text("skills").notNull(),
  senior: text("senior").notNull(),
  interfaces: text("interfaces").notNull(),
  source: varchar("source", { length: 1000 }).notNull(),
});

export const registryResources = mysqlTable(
  "registry_resources",
  {
    id: serial("id").primaryKey(),
    domain: varchar("domain", { length: 255 }).notNull(),
    name: varchar("name", { length: 500 }).notNull(),
    type: varchar("type", { length: 120 }).notNull(),
    level: varchar("level", { length: 120 }).notNull(),
    url: varchar("url", { length: 1000 }).notNull(),
    purpose: text("purpose").notNull(),
    prereqs: text("prereqs").notNull(),
    access: varchar("access", { length: 255 }).notNull(),
    license: varchar("license", { length: 255 }).notNull(),
    caveat: text("caveat").notNull(),
    verified: varchar("verified", { length: 120 }).notNull(),
    /** Link-check evidence level (E3/E2/E1/E0-vendor/E0-stale); "" pre-matrix. */
    evidenceLevel: varchar("evidence_level", { length: 16 })
      .$type<EvidenceLevel | "">()
      .default("")
      .notNull(),
    /** Raw 2026-11-20 link-check bucket (e.g. verified_http200_2026-11-20). */
    linkCheck: varchar("link_check", { length: 120 }).default("").notNull(),
    /** True when the resource 404'd the link check — excluded or flagged everywhere. */
    stale: boolean("stale").default(false).notNull(),
  },
  (t) => [uniqueIndex("registry_resources_url_idx").on(t.url)],
);

// ── Role/resource matrix (normalized, seeded from role_capability_matrix.json) ──

/** Extended per-role profile (1:1 with registry_roles by name/slug). */
export const registryRoleProfiles = mysqlTable(
  "registry_role_profiles",
  {
    id: serial("id").primaryKey(),
    slug: varchar("slug", { length: 255 }).notNull(),
    roleIndex: int("role_index").notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    family: varchar("family", { length: 255 }).notNull(),
    mission: text("mission").notNull(),
    seniorScope: text("senior_scope").notNull(),
    requiredCapabilities: json("required_capabilities").$type<string[]>().notNull(),
    interfaces: json("interfaces").$type<string[]>().notNull(),
    crossCuttingOwnership: json("cross_cutting_ownership").$type<string[]>().notNull(),
    charterSource: varchar("charter_source", { length: 1000 }).notNull(),
    charterEvidenceLevel: varchar("charter_evidence_level", { length: 120 }).notNull(),
    resourcesVerifiedNote: varchar("resources_verified_note", { length: 255 }).notNull(),
    /** Coverage heuristic score — see depthHeuristic label; never job-performance evidence. */
    depthScore: double("depth_score").notNull(),
    depthBand: varchar("depth_band", { length: 60 }).notNull(),
    depthHeuristic: varchar("depth_heuristic", { length: 255 }).notNull(),
    depthFactors: json("depth_factors").$type<Record<string, unknown>>().notNull(),
    capabilityGaps: json("capability_gaps").$type<string[]>().notNull(),
    decompositionVerdict: varchar("decomposition_verdict", { length: 32 })
      .$type<DecompositionVerdict>()
      .notNull(),
    decompositionTriggers: json("decomposition_triggers").$type<string[]>().notNull(),
    decompositionNotes: text("decomposition_notes").notNull(),
    scientificResources: json("scientific_resources").$type<string[]>().notNull(),
    skillPacks: json("skill_packs").$type<string[]>().notNull(),
  },
  (t) => [
    uniqueIndex("registry_role_profiles_slug_idx").on(t.slug),
    index("registry_role_profiles_name_idx").on(t.name),
  ],
);

/** One role→resource link with scope flag, tier, evidence and staleness. */
export const registryRoleResourceLinks = mysqlTable(
  "registry_role_resource_links",
  {
    id: serial("id").primaryKey(),
    /** Stable matrix id (RL-0001 …) — the idempotency key. */
    linkId: varchar("link_id", { length: 32 }).notNull(),
    roleSlug: varchar("role_slug", { length: 255 }).notNull(),
    resourceUrl: varchar("resource_url", { length: 1000 }).notNull(),
    resourceName: varchar("resource_name", { length: 500 }).notNull(),
    domain: varchar("domain", { length: 255 }).notNull(),
    type: varchar("type", { length: 120 }).notNull(),
    catalogLevel: varchar("catalog_level", { length: 255 }).notNull(),
    prerequisite: varchar("prerequisite", { length: 500 }).notNull(),
    flag: mysqlEnum("flag", ["core", "internal", "conditional"])
      .$type<ScopeFlag>()
      .notNull(),
    tier: mysqlEnum("tier", ["foundational", "core", "advanced"])
      .$type<ResourceTier>()
      .notNull(),
    evidence: varchar("evidence", { length: 16 }).$type<EvidenceLevel>().notNull(),
    access: varchar("access", { length: 255 }).notNull(),
    license: varchar("license", { length: 255 }).default("").notNull(),
    /** Conditional admission trigger (empty for core/internal links). */
    trigger: varchar("trigger", { length: 500 }).default("").notNull(),
    evaluationTaskRefs: json("evaluation_task_refs").$type<string[]>().notNull(),
    stale: boolean("stale").default(false).notNull(),
  },
  (t) => [
    uniqueIndex("registry_role_links_link_id_idx").on(t.linkId),
    index("registry_role_links_role_idx").on(t.roleSlug),
    index("registry_role_links_url_idx").on(t.resourceUrl),
  ],
);

/** Charter evaluation tasks (ET-xxx-y) — assessment specs, never run automatically. */
export const registryRoleEvaluationTasks = mysqlTable(
  "registry_role_evaluation_tasks",
  {
    id: serial("id").primaryKey(),
    taskId: varchar("task_id", { length: 32 }).notNull(),
    roleSlug: varchar("role_slug", { length: 255 }).notNull(),
    taskType: varchar("task_type", { length: 60 }).notNull(),
    task: text("task").notNull(),
    evidenceRequired: text("evidence_required").notNull(),
  },
  (t) => [
    uniqueIndex("registry_role_eval_tasks_task_id_idx").on(t.taskId),
    index("registry_role_eval_tasks_role_idx").on(t.roleSlug),
  ],
);

/**
 * Proposed role candidates (e.g. Product Designer / UX Researcher). A
 * candidate is NOT a standing role: it cannot be dispatched or validated as
 * a node role until a human promotes it.
 */
export const registryRoleCandidates = mysqlTable(
  "registry_role_candidates",
  {
    id: serial("id").primaryKey(),
    slug: varchar("slug", { length: 255 }).notNull(),
    name: varchar("name", { length: 500 }).notNull(),
    status: varchar("status", { length: 60 }).default("candidate").notNull(),
    justification: text("justification").notNull(),
    recommendedForm: text("recommended_form").notNull(),
    splitTriggers: json("split_triggers").$type<string[]>().notNull(),
    ownedConditionalCapabilities: json("owned_conditional_capabilities")
      .$type<string[]>()
      .notNull(),
    draftCharter: json("draft_charter").$type<Record<string, unknown>>().notNull(),
  },
  (t) => [uniqueIndex("registry_role_candidates_slug_idx").on(t.slug)],
);

/** Audit gap ledger (GAP-xxx): capability gaps, boundary overlaps, stale/weak links. */
export const registryGaps = mysqlTable(
  "registry_gaps",
  {
    id: serial("id").primaryKey(),
    gapId: varchar("gap_id", { length: 32 }).notNull(),
    category: varchar("category", { length: 60 }).notNull(),
    roleSlug: varchar("role_slug", { length: 255 }).default("").notNull(),
    roleName: varchar("role_name", { length: 500 }).default("").notNull(),
    summary: text("summary").notNull(),
    detail: text("detail").notNull(),
    priority: varchar("priority", { length: 120 }).notNull(),
    recommendedAction: text("recommended_action").notNull(),
    source: varchar("source", { length: 500 }).notNull(),
  },
  (t) => [
    uniqueIndex("registry_gaps_gap_id_idx").on(t.gapId),
    index("registry_gaps_role_idx").on(t.roleSlug),
  ],
);

/** Skill-pack → consuming role slugs (18 curated mappings). */
export const registrySkillMappings = mysqlTable(
  "registry_skill_mappings",
  {
    id: serial("id").primaryKey(),
    skillPack: varchar("skill_pack", { length: 200 }).notNull(),
    consumerRoleCount: int("consumer_role_count").notNull(),
    consumerRoles: json("consumer_roles").$type<string[]>().notNull(),
    note: varchar("note", { length: 1000 }).default("").notNull(),
  },
  (t) => [uniqueIndex("registry_skill_mappings_pack_idx").on(t.skillPack)],
);

// ── Projects & plans ─────────────────────────────────────────────

export const projects = mysqlTable(
  "projects",
  {
    id: serial("id").primaryKey(),
    ownerId: bigint("owner_id", { mode: "number", unsigned: true })
      .notNull()
      .references(() => users.id),
    name: varchar("name", { length: 255 }).notNull(),
    goal: text("goal").notNull(),
    riskTier: mysqlEnum("risk_tier", ["low", "medium", "high"])
      .default("medium")
      .notNull(),
    status: mysqlEnum("status", ["draft", "active", "archived"])
      .default("draft")
      .notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("projects_owner_idx").on(t.ownerId)],
);

export const dagRevisions = mysqlTable(
  "dag_revisions",
  {
    id: serial("id").primaryKey(),
    projectId: bigint("project_id", { mode: "number", unsigned: true })
      .notNull()
      .references(() => projects.id),
    revision: int("revision").notNull(),
    spec: json("spec").$type<DagSpec>().notNull(),
    planHash: char("plan_hash", { length: 64 }).notNull(),
    createdBy: bigint("created_by", { mode: "number", unsigned: true })
      .notNull()
      .references(() => users.id),
    approvedBy: bigint("approved_by", { mode: "number", unsigned: true }),
    approvedAt: timestamp("approved_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [uniqueIndex("dag_revisions_project_revision_idx").on(t.projectId, t.revision)],
);

// ── Skill registry ───────────────────────────────────────────────

export const skills = mysqlTable(
  "skills",
  {
    id: serial("id").primaryKey(),
    /** null = platform-curated seed; otherwise the registering owner. */
    ownerId: bigint("owner_id", { mode: "number", unsigned: true }),
    name: varchar("name", { length: 200 }).notNull(),
    version: varchar("version", { length: 50 }).notNull(),
    description: text("description").notNull(),
    manifest: json("manifest").$type<SkillManifest>().notNull(),
    riskSignals: json("risk_signals").$type<RiskSignal[]>().notNull(),
    /** L2 body text (Markdown body of SKILL.md). Scripts are never stored here. */
    bodyText: text("body_text").notNull(),
    contentSha256: char("content_sha256", { length: 64 }).notNull(),
    status: mysqlEnum("status", [
      "quarantined",
      "vetted",
      "deprecated",
      "suspended",
    ])
      .default("quarantined")
      .notNull(),
    provenanceUrl: varchar("provenance_url", { length: 1000 }).default("").notNull(),
    licenseDeclared: varchar("license_declared", { length: 255 }).default("").notNull(),
    reviewedBy: varchar("reviewed_by", { length: 255 }),
    reviewedAt: timestamp("reviewed_at"),
    reviewNote: text("review_note"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [uniqueIndex("skills_name_version_idx").on(t.name, t.version)],
);

export const skillFiles = mysqlTable(
  "skill_files",
  {
    id: serial("id").primaryKey(),
    skillId: bigint("skill_id", { mode: "number", unsigned: true })
      .notNull()
      .references(() => skills.id),
    path: varchar("path", { length: 500 }).notNull(),
    size: int("size").notNull(),
    sha256: char("sha256", { length: 64 }).notNull(),
    kind: mysqlEnum("kind", ["body", "script", "reference", "asset"]).notNull(),
  },
  (t) => [index("skill_files_skill_idx").on(t.skillId)],
);

// ── Hired specialists (plan-time only) ───────────────────────────

export const agents = mysqlTable(
  "agents",
  {
    id: serial("id").primaryKey(),
    projectId: bigint("project_id", { mode: "number", unsigned: true })
      .notNull()
      .references(() => projects.id),
    skillId: bigint("skill_id", { mode: "number", unsigned: true })
      .notNull()
      .references(() => skills.id),
    role: varchar("role", { length: 255 }).notNull(),
    modelPreference: json("model_preference").$type<string[]>(),
    costClass: mysqlEnum("cost_class", ["low", "medium", "high"])
      .default("medium")
      .notNull(),
    createdByRunId: bigint("created_by_run_id", { mode: "number", unsigned: true }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("agents_project_idx").on(t.projectId)],
);

// ── Runs ─────────────────────────────────────────────────────────

export const runs = mysqlTable(
  "runs",
  {
    id: serial("id").primaryKey(),
    projectId: bigint("project_id", { mode: "number", unsigned: true })
      .notNull()
      .references(() => projects.id),
    dagRevisionId: bigint("dag_revision_id", { mode: "number", unsigned: true })
      .notNull()
      .references(() => dagRevisions.id),
    mode: mysqlEnum("mode", ["mock", "live"]).notNull(),
    provider: varchar("provider", { length: 32 }).notNull(),
    model: varchar("model", { length: 200 }),
    state: mysqlEnum("state", [
      "draft",
      "validating",
      "queued",
      "running",
      "awaiting_approval",
      "paused",
      "completed",
      "failed",
      "failed_validation",
      "stopped_budget",
      "stopped_human",
      "terminated_policy",
    ])
      .$type<RunState>()
      .default("draft")
      .notNull(),
    /** Optimistic-concurrency guard: every run-state transition bumps it. */
    version: int("version").default(1).notNull(),
    /**
     * Explicit parallelism knob. Default 1 = serial dispatch (the budget
     * pre-check math assumes at most one in-flight node per run). >1 opts
     * into bounded concurrent dispatch of independent claimed nodes.
     */
    maxParallelNodes: int("max_parallel_nodes").default(1).notNull(),
    budget: json("budget").$type<RunBudget>().notNull(),
    startedBy: bigint("started_by", { mode: "number", unsigned: true })
      .notNull()
      .references(() => users.id),
    startedAt: timestamp("started_at").defaultNow().notNull(),
    endedAt: timestamp("ended_at"),
    endReason: varchar("end_reason", { length: 500 }),
    /** Active autonomy grant stamped at run start; null ⇒ mode 'all'. */
    autonomyGrantId: bigint("autonomy_grant_id", { mode: "number", unsigned: true }),
    /** Provider goal mode preset applied at prompt compile (design §3). */
    goalMode: varchar("goal_mode", { length: 32 })
      .$type<GoalMode>()
      .default("build")
      .notNull(),
    // ── Enterprise rollup tags (CEO mode); null for non-enterprise runs ──
    /** Enterprise this run was dispatched under (owner chain verified). */
    enterpriseId: bigint("enterprise_id", { mode: "number", unsigned: true }),
    /** enterprise_companies.id of the company whose program this run serves. */
    enterpriseCompanyId: bigint("enterprise_company_id", { mode: "number", unsigned: true }),
    /** worker_contracts.id this run is staffed through, when any. */
    enterpriseContractId: bigint("enterprise_contract_id", { mode: "number", unsigned: true }),
  },
  (t) => [
    index("runs_project_idx").on(t.projectId),
    index("runs_autonomy_grant_idx").on(t.autonomyGrantId),
    index("runs_enterprise_idx").on(t.enterpriseId, t.state),
    index("runs_enterprise_company_idx").on(t.enterpriseCompanyId),
  ],
);

export const runNodes = mysqlTable(
  "run_nodes",
  {
    id: serial("id").primaryKey(),
    runId: bigint("run_id", { mode: "number", unsigned: true })
      .notNull()
      .references(() => runs.id),
    nodeKey: varchar("node_key", { length: 64 }).notNull(),
    agentId: bigint("agent_id", { mode: "number", unsigned: true }),
    contract: json("contract").notNull(),
    state: mysqlEnum("state", [
      "pending",
      "ready",
      "claimed",
      "running",
      "verifying",
      "waiting",
      "paused",
      "accepted",
      "failed",
      "skipped",
      "cancelled",
    ])
      .$type<RunNodeState>()
      .default("pending")
      .notNull(),
    attempts: int("attempts").default(0).notNull(),
    tokensUsed: int("tokens_used").default(0).notNull(),
    callsUsed: int("calls_used").default(0).notNull(),
    startedAt: timestamp("started_at"),
    endedAt: timestamp("ended_at"),
    // ── Control plane (Revision A): claim / lease / OCC metadata ──
    /** Director/manual assignment target; null = unassigned. */
    assignedWorkerId: bigint("assigned_worker_id", { mode: "number", unsigned: true }),
    assignmentMode: mysqlEnum("assignment_mode", ["director", "self-claim", "hybrid"])
      .$type<AssignmentMode>()
      .default("hybrid")
      .notNull(),
    priority: int("priority").default(0).notNull(),
    /** uuid v4 fencing token; null = unclaimed. Globally unique when set. */
    leaseToken: char("lease_token", { length: 36 }),
    /** Worker currently holding the lease (audit; the token is the authority). */
    leaseWorkerId: bigint("lease_worker_id", { mode: "number", unsigned: true }),
    leaseExpiresAt: timestamp("lease_expires_at"),
    heartbeatAt: timestamp("heartbeat_at"),
    waitReason: mysqlEnum("wait_reason", ["dependency", "approval", "event"])
      .$type<WaitReason>(),
    /** Optional milestone grouping for budget rollup / UI grouping. */
    milestoneKey: varchar("milestone_key", { length: 64 }),
    /** Office room rollup tag (design §4.2); null for unseated work. */
    roomKey: varchar("room_key", { length: 64 }),
    /** Optimistic-concurrency guard on every node transition. */
    version: int("version").default(1).notNull(),
  },
  (t) => [
    uniqueIndex("run_nodes_run_key_idx").on(t.runId, t.nodeKey),
    index("run_nodes_claimable_idx").on(t.runId, t.state, t.priority),
    index("run_nodes_lease_idx").on(t.leaseExpiresAt),
    uniqueIndex("run_nodes_lease_token_idx").on(t.leaseToken),
    index("run_nodes_room_idx").on(t.runId, t.roomKey),
  ],
);

export const runEvents = mysqlTable(
  "run_events",
  {
    id: serial("id").primaryKey(),
    runId: bigint("run_id", { mode: "number", unsigned: true })
      .notNull()
      .references(() => runs.id),
    seq: bigint("seq", { mode: "number", unsigned: true }).notNull(),
    nodeKey: varchar("node_key", { length: 64 }),
    type: varchar("type", { length: 64 }).notNull(),
    payload: json("payload").notNull(),
    actor: mysqlEnum("actor", ["director", "node", "human", "system", "worker"])
      .$type<EventActor>()
      .notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [uniqueIndex("run_events_run_seq_idx").on(t.runId, t.seq)],
);

export const approvals = mysqlTable(
  "approvals",
  {
    id: serial("id").primaryKey(),
    runId: bigint("run_id", { mode: "number", unsigned: true })
      .notNull()
      .references(() => runs.id),
    nodeKey: varchar("node_key", { length: 64 }),
    kind: mysqlEnum("kind", [
      "plan",
      "budget-increase",
      "artifact-accept",
      "knowledge-promote",
      "external-action",
    ])
      .$type<ApprovalKind>()
      .notNull(),
    payload: json("payload").notNull(),
    state: mysqlEnum("state", ["pending", "approved", "rejected", "expired"])
      .$type<ApprovalState>()
      .default("pending")
      .notNull(),
    decidedBy: varchar("decided_by", { length: 255 }),
    decidedAt: timestamp("decided_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("approvals_run_idx").on(t.runId)],
);

export const artifacts = mysqlTable(
  "artifacts",
  {
    id: serial("id").primaryKey(),
    runId: bigint("run_id", { mode: "number", unsigned: true })
      .notNull()
      .references(() => runs.id),
    nodeKey: varchar("node_key", { length: 64 }).notNull(),
    kind: varchar("kind", { length: 64 }).notNull(),
    title: varchar("title", { length: 500 }).notNull(),
    schemaUri: varchar("schema_uri", { length: 500 }).notNull(),
    /** Persisted object-storage key; never a presigned URL. null when upload failed. */
    storageKey: varchar("storage_key", { length: 700 }),
    /** Stable storage error code (e.g. STORAGE_NOT_PROVISIONED) when upload failed. */
    storageError: varchar("storage_error", { length: 120 }),
    contentSha256: char("content_sha256", { length: 64 }),
    summary: text("summary"),
    acceptance: json("acceptance").$type<AcceptanceOutcome>(),
    /**
     * Prompt-compiler metadata for this attempt: concise execution plan plus
     * truncation/redaction/degradation accounting. Never raw chain-of-thought.
     */
    promptMeta: json("prompt_meta").$type<ArtifactPromptMeta>(),
    accepted: boolean("accepted").default(false).notNull(),
    reviewedBy: varchar("reviewed_by", { length: 255 }),
    /** Idempotency identity: one artifact row per (run, node, attempt). */
    attempt: int("attempt").default(1).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("artifacts_run_idx").on(t.runId),
    uniqueIndex("artifacts_run_node_attempt_idx").on(t.runId, t.nodeKey, t.attempt),
  ],
);

export const knowledgeDrafts = mysqlTable(
  "knowledge_drafts",
  {
    id: serial("id").primaryKey(),
    projectId: bigint("project_id", { mode: "number", unsigned: true })
      .notNull()
      .references(() => projects.id),
    sourceRunId: bigint("source_run_id", { mode: "number", unsigned: true }),
    title: varchar("title", { length: 500 }).notNull(),
    body: text("body").notNull(),
    state: mysqlEnum("state", ["draft", "in-review", "promoted", "rejected"])
      .default("in-review")
      .notNull(),
    reviewer: varchar("reviewer", { length: 255 }),
    decidedAt: timestamp("decided_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("knowledge_drafts_project_idx").on(t.projectId)],
);

export const budgetLedger = mysqlTable(
  "budget_ledger",
  {
    id: serial("id").primaryKey(),
    runId: bigint("run_id", { mode: "number", unsigned: true })
      .notNull()
      .references(() => runs.id),
    nodeKey: varchar("node_key", { length: 64 }).notNull(),
    tokensPrompt: int("tokens_prompt").notNull(),
    tokensCompletion: int("tokens_completion").notNull(),
    calls: int("calls").notNull(),
    /** Integer USD micros (1e-6 USD); simulated mock cents are flagged in events. */
    costUsdMicros: bigint("cost_usd_micros", {
      mode: "number",
      unsigned: true,
    }).notNull(),
    /** Optional rollup links (Revision A); null for pre-control-plane rows. */
    milestoneKey: varchar("milestone_key", { length: 64 }),
    /** Office room rollup tag copied from run_nodes at dispatch (§4.2). */
    roomKey: varchar("room_key", { length: 64 }),
    /** Enterprise rollup tags copied from the run at dispatch (CEO mode). */
    enterpriseId: bigint("enterprise_id", { mode: "number", unsigned: true }),
    enterpriseCompanyId: bigint("enterprise_company_id", { mode: "number", unsigned: true }),
    enterpriseContractId: bigint("enterprise_contract_id", { mode: "number", unsigned: true }),
    attempt: int("attempt"),
    recordedAt: timestamp("recorded_at").defaultNow().notNull(),
  },
  (t) => [
    index("budget_ledger_run_idx").on(t.runId),
    index("budget_ledger_room_idx").on(t.roomKey),
    index("budget_ledger_enterprise_idx").on(t.enterpriseId, t.enterpriseCompanyId),
  ],
);

// ── Control plane: project worker pool + mutation idempotency ─────

/**
 * Worker pool (Revision A): executors with capacity and capabilities.
 * Project-scoped (owner inherited through project); the director itself is a
 * seeded `kind='director'` worker ("worker 0") so engine dispatch and
 * eligible subagent self-claim share one atomic claim path.
 */
export const workers = mysqlTable(
  "workers",
  {
    id: serial("id").primaryKey(),
    projectId: bigint("project_id", { mode: "number", unsigned: true })
      .notNull()
      .references(() => projects.id),
    name: varchar("name", { length: 255 }).notNull(),
    kind: mysqlEnum("kind", ["director", "subagent", "human-delegate"])
      .$type<WorkerKind>()
      .notNull(),
    /** Matches node contract.role / registry_roles names. */
    role: varchar("role", { length: 255 }).notNull(),
    capabilities: json("capabilities").$type<string[]>().notNull(),
    skillRefs: json("skill_refs").$type<SkillPin[]>().notNull(),
    status: mysqlEnum("status", ["active", "suspended"])
      .$type<WorkerStatus>()
      .default("active")
      .notNull(),
    maxConcurrentClaims: int("max_concurrent_claims").default(1).notNull(),
    leaseTtlSeconds: int("lease_ttl_seconds").default(120).notNull(),
    /** Current office seat (denormalized from office_assignments; same tx). */
    roomKey: varchar("room_key", { length: 64 }),
    /**
     * Enterprise shared-capacity pool id (CEO mode). Workers sharing a
     * capacityGroupId (a department origin worker plus its borrowing-project
     * secondees) draw from ONE group-wide concurrency budget, checked
     * app-side before the claim CAS. null = standalone capacity.
     */
    capacityGroupId: varchar("capacity_group_id", { length: 128 }),
    /** enterprise_departments.id this worker is pooled under, when any. */
    departmentId: bigint("department_id", { mode: "number", unsigned: true }),
    /** Drain target while claims finish; stops new claims when set. */
    pendingRoomKey: varchar("pending_room_key", { length: 64 }),
    /** OCC guard for office seating/reassignment mutations. */
    version: int("version").default(1).notNull(),
    lastSeenAt: timestamp("last_seen_at").defaultNow().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("workers_project_name_idx").on(t.projectId, t.name),
    index("workers_project_role_idx").on(t.projectId, t.role, t.status),
    index("workers_capacity_group_idx").on(t.capacityGroupId),
  ],
);

/**
 * Client idempotency keys for control-plane mutations (claim/complete/etc.).
 * The stored response is replayed verbatim on key replay.
 */
export const idempotencyKeys = mysqlTable(
  "idempotency_keys",
  {
    id: serial("id").primaryKey(),
    ownerId: bigint("owner_id", { mode: "number", unsigned: true })
      .notNull()
      .references(() => users.id),
    scope: varchar("scope", { length: 64 }).notNull(),
    key: varchar("key", { length: 128 }).notNull(),
    response: json("response").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [uniqueIndex("idem_owner_scope_key_idx").on(t.ownerId, t.scope, t.key)],
);

// ── Owner-scoped prompt evaluation reports ───────────────────────

/**
 * Saved deterministic mock-suite evaluation reports. The report JSON carries
 * the suite name/version/hash, the caller-supplied pricing rates, and paired
 * direct_structured + plan_execute baseline metrics. Reports are owner-scoped
 * and immutable once saved.
 */
export const evaluationReports = mysqlTable(
  "evaluation_reports",
  {
    id: serial("id").primaryKey(),
    ownerId: bigint("owner_id", { mode: "number", unsigned: true })
      .notNull()
      .references(() => users.id),
    suiteName: varchar("suite_name", { length: 120 }).notNull(),
    suiteVersion: varchar("suite_version", { length: 40 }).notNull(),
    suiteHash: char("suite_hash", { length: 64 }).notNull(),
    /** Pricing rates used for every cost figure (owner settings or server env). */
    rates: json("rates").$type<{ inputUsdPerMillion: number; outputUsdPerMillion: number; source: string }>().notNull(),
    config: json("config").$type<Record<string, unknown>>().notNull(),
    /** sha256 over the canonical report JSON — identical inputs reproduce it. */
    reportHash: char("report_hash", { length: 64 }).notNull(),
    report: json("report").$type<EvaluationReport>().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("evaluation_reports_owner_idx").on(t.ownerId),
    index("evaluation_reports_suite_idx").on(t.suiteHash),
  ],
);

/** Prompt-compiler metadata persisted per artifact attempt (never raw CoT). */
export interface ArtifactPromptMeta {
  compilerVersion: string;
  strategy: string;
  strategyVersion: string;
  /** Concise execution plan (brief action summaries only). */
  plan: ExecutionPlan;
  routing?: {
    requested: string | null;
    rejected: { strategy: string; reason: string }[];
  };
  bytes: { system: number; user: number; total: number };
  estimatedTokens: number;
  seed: string;
  resourcesIncluded: string[];
  resourcesDropped: { id: string; reason: string }[];
  truncations: TruncationEvent[];
  redactions: RedactionEvent[];
  degraded: boolean;
  degradationNotes: string[];
}

// ── Owner settings (non-secret operator config, e.g. USD pricing rates) ──

export const ownerSettings = mysqlTable(
  "owner_settings",
  {
    id: serial("id").primaryKey(),
    ownerId: bigint("owner_id", { mode: "number", unsigned: true })
      .notNull()
      .references(() => users.id),
    key: varchar("key", { length: 100 }).notNull(),
    value: json("value").notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => [uniqueIndex("owner_settings_owner_key_idx").on(t.ownerId, t.key)],
);

import type {
  IntegrationProvider,
  IntegrationCheckStatus,
} from "../contracts/integrations";

// ── Integration credential vault (owner-scoped, AES-256-GCM) ─────
//
// Plaintext secrets never touch this schema: only ciphertext + iv + authTag,
// encrypted under the server-only INTEGRATION_ENCRYPTION_KEY with AAD binding
// owner/provider/recordKey. API responses must never select ciphertext fields.

export const integrationRecords = mysqlTable(
  "integration_records",
  {
    id: serial("id").primaryKey(),
    ownerId: bigint("owner_id", { mode: "number", unsigned: true })
      .notNull()
      .references(() => users.id),
    provider: mysqlEnum("provider", [
      "openai",
      "anthropic",
      "github",
      "figma",
      "google-drive",
      "mcp",
    ])
      .$type<IntegrationProvider>()
      .notNull(),
    label: varchar("label", { length: 120 }).notNull(),
    /** Random per-record id minted before encryption; part of the AAD. */
    recordKey: char("record_key", { length: 36 }).notNull(),
    /** Base64 AES-256-GCM ciphertext. Never selected into API responses. */
    ciphertext: text("ciphertext"),
    iv: varchar("iv", { length: 24 }).notNull(),
    authTag: varchar("auth_tag", { length: 24 }).notNull(),
    keyVersion: int("key_version").notNull(),
    /** Non-secret metadata (e.g. MCP server URL). No credentials. */
    metadata: json("metadata").$type<Record<string, unknown>>(),
    lastCheckStatus: mysqlEnum("last_check_status", ["unchecked", "ok", "failed"])
      .$type<IntegrationCheckStatus>()
      .default("unchecked")
      .notNull(),
    lastCheckErrorClass: varchar("last_check_error_class", { length: 120 }),
    lastCheckAt: timestamp("last_check_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex("integration_records_owner_provider_label_idx").on(
      t.ownerId,
      t.provider,
      t.label,
    ),
    uniqueIndex("integration_records_record_key_idx").on(t.recordKey),
    index("integration_records_owner_idx").on(t.ownerId),
  ],
);

/** Untrusted discovery output (e.g. MCP tool schemas) — quarantined, never executed. */
export const integrationDiscoveries = mysqlTable(
  "integration_discoveries",
  {
    id: serial("id").primaryKey(),
    ownerId: bigint("owner_id", { mode: "number", unsigned: true })
      .notNull()
      .references(() => users.id),
    recordId: bigint("record_id", { mode: "number", unsigned: true })
      .notNull()
      .references(() => integrationRecords.id),
    kind: varchar("kind", { length: 32 }).notNull(), // e.g. "mcp_tool"
    name: varchar("name", { length: 255 }).notNull(),
    payload: json("payload").notNull(),
    sha256: char("sha256", { length: 64 }).notNull(),
    status: mysqlEnum("status", ["quarantined"]).default("quarantined").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("integration_discoveries_record_idx").on(t.recordId)],
);

export const exportsTable = mysqlTable(
  "exports",
  {
    id: serial("id").primaryKey(),
    projectId: bigint("project_id", { mode: "number", unsigned: true })
      .notNull()
      .references(() => projects.id),
    runId: bigint("run_id", { mode: "number", unsigned: true }),
    format: mysqlEnum("format", ["json", "markdown"]).notNull(),
    storageKey: varchar("storage_key", { length: 700 }),
    storageError: varchar("storage_error", { length: 120 }),
    createdBy: bigint("created_by", { mode: "number", unsigned: true })
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("exports_project_idx").on(t.projectId)],
);

// ── Autonomy grants (design §2.2) ────────────────────────────────

/**
 * Explicit, expiring, revocable autonomy grant — never an ambient setting.
 * At most one active grant per project (enforced transactionally by the
 * supersede UPDATE in autonomy.grant); this index makes the active lookup
 * cheap. max_cost_usd stored as integer micros.
 */
export const autonomyGrants = mysqlTable(
  "autonomy_grants",
  {
    id: serial("id").primaryKey(),
    projectId: bigint("project_id", { mode: "number", unsigned: true })
      .notNull()
      .references(() => projects.id),
    scope: mysqlEnum("scope", ["project", "run"])
      .$type<AutonomyScope>()
      .notNull(),
    /** Set iff scope='run'; the grant dies with that run. */
    runId: bigint("run_id", { mode: "number", unsigned: true }),
    mode: mysqlEnum("mode", ["all", "risk_based", "none"])
      .$type<AutonomyMode>()
      .notNull(),
    /** false ⇒ mode 'none' applies to mock runs only. */
    allowLive: boolean("allow_live").default(false).notNull(),
    // Hard preauthorized ceilings (design §2.1). USD as integer micros.
    maxTokens: int("max_tokens").notNull(),
    maxCalls: int("max_calls").notNull(),
    maxMinutes: int("max_minutes").notNull(),
    maxCostUsdMicros: bigint("max_cost_usd_micros", {
      mode: "number",
      unsigned: true,
    }).notNull(),
    grantedBy: bigint("granted_by", { mode: "number", unsigned: true })
      .notNull()
      .references(() => users.id),
    grantedByName: varchar("granted_by_name", { length: 255 }).notNull(),
    /** Session binding for audit, not enforcement. */
    grantedSessionId: varchar("granted_session_id", { length: 128 }),
    reason: varchar("reason", { length: 500 }).default("").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    revokedAt: timestamp("revoked_at"),
    revokedBy: varchar("revoked_by", { length: 255 }),
    revokeReason: varchar("revoke_reason", { length: 500 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("autonomy_grants_project_idx").on(t.projectId, t.expiresAt),
    index("autonomy_grants_run_idx").on(t.runId),
  ],
);

// ── Office blueprints / rooms / assignments / events (design §4) ──

/** Versioned office blueprint; at most one `active` per project. */
export const officeBlueprints = mysqlTable(
  "office_blueprints",
  {
    id: serial("id").primaryKey(),
    projectId: bigint("project_id", { mode: "number", unsigned: true })
      .notNull()
      .references(() => projects.id),
    revision: int("revision").notNull(),
    spec: json("spec").$type<OfficeBlueprintSpec>().notNull(),
    status: mysqlEnum("status", ["draft", "active", "archived"])
      .default("draft")
      .notNull(),
    /** OCC guard for save/activate. */
    version: int("version").default(1).notNull(),
    createdBy: bigint("created_by", { mode: "number", unsigned: true })
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    activatedAt: timestamp("activated_at"),
  },
  (t) => [
    uniqueIndex("office_blueprints_project_revision_idx").on(t.projectId, t.revision),
    index("office_blueprints_project_status_idx").on(t.projectId, t.status),
  ],
);

/** Materialized room of an active blueprint (capacity + budget envelopes). */
export const officeRooms = mysqlTable(
  "office_rooms",
  {
    id: serial("id").primaryKey(),
    projectId: bigint("project_id", { mode: "number", unsigned: true })
      .notNull()
      .references(() => projects.id),
    blueprintId: bigint("blueprint_id", { mode: "number", unsigned: true })
      .notNull()
      .references(() => officeBlueprints.id),
    roomKey: varchar("room_key", { length: 64 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    kind: mysqlEnum("kind", [
      "director-suite",
      "cartography",
      "research-lab",
      "studio",
      "review",
      "vault",
      "ops",
    ])
      .$type<RoomKind>()
      .notNull(),
    capacity: int("capacity").notNull(),
    /** Case-insensitive regex sources matched against workers.role. */
    eligibleRolePatterns: json("eligible_role_patterns").$type<string[]>().notNull(),
    /** Per-room preauthorization envelopes (USD; storage bytes). */
    budgets: json("budgets").$type<RoomBudgets>().notNull(),
    /** OCC guard for allocate (budget/capacity edits). */
    version: int("version").default(1).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("office_rooms_blueprint_key_idx").on(t.blueprintId, t.roomKey),
    index("office_rooms_project_idx").on(t.projectId, t.roomKey),
  ],
);

/** A worker's seat in a room; optionally linked to a concrete run node. */
export const officeAssignments = mysqlTable(
  "office_assignments",
  {
    id: serial("id").primaryKey(),
    projectId: bigint("project_id", { mode: "number", unsigned: true })
      .notNull()
      .references(() => projects.id),
    roomId: bigint("room_id", { mode: "number", unsigned: true })
      .notNull()
      .references(() => officeRooms.id),
    /** The actual pool worker occupying the seat. */
    workerId: bigint("worker_id", { mode: "number", unsigned: true })
      .notNull()
      .references(() => workers.id),
    /** WorkQueue linkage: the concrete run/node this seat is working, when any. */
    runId: bigint("run_id", { mode: "number", unsigned: true }),
    nodeKey: varchar("node_key", { length: 64 }),
    state: mysqlEnum("state", ["active", "released"])
      .default("active")
      .notNull(),
    /** OCC guard (reassign/release). */
    version: int("version").default(1).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    releasedAt: timestamp("released_at"),
  },
  (t) => [
    index("office_assignments_room_state_idx").on(t.roomId, t.state),
    index("office_assignments_worker_idx").on(t.workerId, t.state),
    index("office_assignments_run_idx").on(t.runId),
  ],
);

/** Project-scoped append-only audit, same discipline as run_events. */
export const officeEvents = mysqlTable(
  "office_events",
  {
    id: serial("id").primaryKey(),
    projectId: bigint("project_id", { mode: "number", unsigned: true })
      .notNull()
      .references(() => projects.id),
    seq: bigint("seq", { mode: "number", unsigned: true }).notNull(),
    type: varchar("type", { length: 64 }).notNull(),
    payload: json("payload").notNull(),
    actor: mysqlEnum("actor", ["director", "node", "human", "system", "worker"])
      .$type<EventActor>()
      .notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [uniqueIndex("office_events_project_seq_idx").on(t.projectId, t.seq)],
);

// ── Whiteboards (design §5) ──────────────────────────────────────

/**
 * Versioned, owner-scoped whiteboard document. Data only — no execution
 * surface: node kinds are a closed enum, content is capped text the server
 * never evaluates.
 */
export const whiteboards = mysqlTable(
  "whiteboards",
  {
    id: serial("id").primaryKey(),
    projectId: bigint("project_id", { mode: "number", unsigned: true })
      .notNull()
      .references(() => projects.id),
    title: varchar("title", { length: 500 }).notNull(),
    /** Snapshot identity (whiteboard_revisions); bumps per applied op-batch. */
    revision: int("revision").default(1).notNull(),
    /** OCC guard on every applyOps (mirrors run_nodes.version discipline). */
    version: int("version").default(1).notNull(),
    /** DAG/runNode ownership: set when a node produced/owns this board. */
    ownerRunId: bigint("owner_run_id", { mode: "number", unsigned: true }),
    ownerNodeKey: varchar("owner_node_key", { length: 64 }),
    status: mysqlEnum("status", ["active", "archived"]).default("active").notNull(),
    /** Single-writer edit lease (uuid token; take-over force-expires). */
    editLeaseToken: char("edit_lease_token", { length: 36 }),
    editLeaseHolder: varchar("edit_lease_holder", { length: 255 }),
    editLeaseExpiresAt: timestamp("edit_lease_expires_at"),
    createdBy: bigint("created_by", { mode: "number", unsigned: true })
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => [index("whiteboards_project_idx").on(t.projectId)],
);

export const whiteboardNodes = mysqlTable(
  "whiteboard_nodes",
  {
    id: serial("id").primaryKey(),
    whiteboardId: bigint("whiteboard_id", { mode: "number", unsigned: true })
      .notNull()
      .references(() => whiteboards.id),
    nodeKey: varchar("node_key", { length: 64 }).notNull(),
    /** Closed kind set — deliberately no executable/embed kind. */
    kind: mysqlEnum("kind", ["text", "sticky", "section", "artifact-ref", "run-node-ref"]).notNull(),
    /** ≤ 20_000 chars, validated at the contract layer. */
    content: text("content").notNull(),
    position: json("position").$type<{ x: number; y: number }>().notNull(),
    /** Reference targets (validated to belong to the same project). */
    refRunId: bigint("ref_run_id", { mode: "number", unsigned: true }),
    refNodeKey: varchar("ref_node_key", { length: 64 }),
    refArtifactId: bigint("ref_artifact_id", { mode: "number", unsigned: true }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [uniqueIndex("whiteboard_nodes_board_key_idx").on(t.whiteboardId, t.nodeKey)],
);

export const whiteboardEdges = mysqlTable(
  "whiteboard_edges",
  {
    id: serial("id").primaryKey(),
    whiteboardId: bigint("whiteboard_id", { mode: "number", unsigned: true })
      .notNull()
      .references(() => whiteboards.id),
    edgeKey: varchar("edge_key", { length: 64 }).notNull(),
    fromKey: varchar("from_key", { length: 64 }).notNull(),
    toKey: varchar("to_key", { length: 64 }).notNull(),
    kind: mysqlEnum("kind", ["link", "flow", "annotation"]).notNull(),
  },
  (t) => [uniqueIndex("whiteboard_edges_board_key_idx").on(t.whiteboardId, t.edgeKey)],
);

/** Append-only notes (no update/delete path; correction = new note). */
export const whiteboardNotes = mysqlTable(
  "whiteboard_notes",
  {
    id: serial("id").primaryKey(),
    whiteboardId: bigint("whiteboard_id", { mode: "number", unsigned: true })
      .notNull()
      .references(() => whiteboards.id),
    /** null = board-level note. */
    nodeKey: varchar("node_key", { length: 64 }),
    /** ≤ 4_000 chars, validated at the contract layer. */
    body: text("body").notNull(),
    author: mysqlEnum("author", ["human", "agent", "system"]).notNull(),
    /** worker/agent id or user name; display + audit only. */
    authorRef: varchar("author_ref", { length: 255 }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("whiteboard_notes_board_idx").on(t.whiteboardId)],
);

/** Immutable per-revision snapshots { nodes, edges } (notes excluded). */
export const whiteboardRevisions = mysqlTable(
  "whiteboard_revisions",
  {
    id: serial("id").primaryKey(),
    whiteboardId: bigint("whiteboard_id", { mode: "number", unsigned: true })
      .notNull()
      .references(() => whiteboards.id),
    revision: int("revision").notNull(),
    doc: json("doc").notNull(),
    createdBy: bigint("created_by", { mode: "number", unsigned: true })
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [uniqueIndex("whiteboard_revisions_board_rev_idx").on(t.whiteboardId, t.revision)],
);

// ── Enterprise / CEO mode (contracts/enterprise.ts) ──────────────
//
// Owner-scoped enterprise graph: an enterprise groups companies (1:1 with
// projects), shared-service departments, cross-company worker contracts,
// reference-only memory, and at most one CEO program per applied blueprint.
// Everything derives from the shared contract module; no raw prompt/secret
// columns exist here by design (memory rows carry refs + hashes only).

/** The enterprise envelope (one row per owner+slug). */
export const enterprises = mysqlTable(
  "enterprises",
  {
    id: serial("id").primaryKey(),
    ownerId: bigint("owner_id", { mode: "number", unsigned: true })
      .notNull()
      .references(() => users.id),
    /** Kebab-case program id from the blueprint (per-owner unique). */
    slug: varchar("slug", { length: 64 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    goal: text("goal").notNull(),
    status: mysqlEnum("status", ["draft", "active", "paused", "archived"])
      .default("draft")
      .notNull(),
    /** Hard enterprise budget envelope (integer micros/minutes/tokens/calls). */
    budget: json("budget").$type<EnterpriseBudget>().notNull(),
    maxConcurrentRuns: int("max_concurrent_runs").default(4).notNull(),
    /** OCC guard; bumped on every enterprise-level mutation. */
    version: int("version").default(1).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex("enterprises_owner_slug_idx").on(t.ownerId, t.slug),
    index("enterprises_owner_status_idx").on(t.ownerId, t.status),
  ],
);

/** A company of the enterprise; 1:1 with a platform project. */
export const enterpriseCompanies = mysqlTable(
  "enterprise_companies",
  {
    id: serial("id").primaryKey(),
    enterpriseId: bigint("enterprise_id", { mode: "number", unsigned: true })
      .notNull()
      .references(() => enterprises.id),
    key: varchar("key", { length: 64 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    kind: mysqlEnum("kind", ["line", "shared-services"])
      .$type<CompanyKind>()
      .notNull(),
    mission: text("mission").notNull(),
    disciplines: json("disciplines").$type<Discipline[]>().notNull(),
    /** Relative capacity weight (partition basis). */
    capacityShare: int("capacity_share").notNull(),
    /** The company's platform project (created at materialization; 1:1). */
    projectId: bigint("project_id", { mode: "number", unsigned: true })
      .notNull()
      .references(() => projects.id),
    /** Inactive companies receive a zero budget reservation. */
    active: boolean("active").default(true).notNull(),
    /** Set by company.archive (assistant slice): terminal, drain+preserve first. */
    archivedAt: timestamp("archived_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("enterprise_companies_ent_key_idx").on(t.enterpriseId, t.key),
    uniqueIndex("enterprise_companies_project_idx").on(t.projectId),
    index("enterprise_companies_ent_active_idx").on(t.enterpriseId, t.active),
  ],
);

/** A disciplinary department (owned by one company, usually shared-services). */
export const enterpriseDepartments = mysqlTable(
  "enterprise_departments",
  {
    id: serial("id").primaryKey(),
    enterpriseId: bigint("enterprise_id", { mode: "number", unsigned: true })
      .notNull()
      .references(() => enterprises.id),
    key: varchar("key", { length: 64 }).notNull(),
    companyId: bigint("company_id", { mode: "number", unsigned: true })
      .notNull()
      .references(() => enterpriseCompanies.id),
    name: varchar("name", { length: 255 }).notNull(),
    discipline: varchar("discipline", { length: 64 })
      .$type<Discipline>()
      .notNull(),
    /**
     * Lifecycle status (assistant slice): paused departments stop new claims
     * (pooled workers suspended); archived is terminal (drain+preserve first).
     */
    status: mysqlEnum("status", ["active", "paused", "archived"])
      .default("active")
      .notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("enterprise_departments_ent_key_idx").on(t.enterpriseId, t.key),
    index("enterprise_departments_company_idx").on(t.companyId),
    index("enterprise_departments_ent_status_idx").on(t.enterpriseId, t.status),
  ],
);

/**
 * A cross-company worker contract. Approving one creates a secondee worker in
 * the borrowing company's project pinned to the same role/skill and sharing
 * the department's capacityGroupId; release drains claims then frees the pool.
 */
export const workerContracts = mysqlTable(
  "worker_contracts",
  {
    id: serial("id").primaryKey(),
    enterpriseId: bigint("enterprise_id", { mode: "number", unsigned: true })
      .notNull()
      .references(() => enterprises.id),
    key: varchar("key", { length: 64 }).notNull(),
    /** Company whose program this contract serves (borrower). */
    companyId: bigint("company_id", { mode: "number", unsigned: true })
      .notNull()
      .references(() => enterpriseCompanies.id),
    /** Department providing the capability (lender). */
    departmentId: bigint("department_id", { mode: "number", unsigned: true })
      .notNull()
      .references(() => enterpriseDepartments.id),
    discipline: varchar("discipline", { length: 64 })
      .$type<Discipline>()
      .notNull(),
    status: mysqlEnum("status", [
      "proposed",
      "active",
      "draining",
      "released",
      "revoked",
    ])
      .$type<WorkerContractStatus>()
      .default("proposed")
      .notNull(),
    /** Contract revision; bumped on every renegotiation/decision. */
    version: int("version").default(1).notNull(),
    /** Fraction (0,1] of the served company's capacity routed here. */
    capacityShare: double("capacity_share").notNull(),
    skillPin: json("skill_pin").$type<EnterpriseSkillPin>().notNull(),
    /** True iff the pinned skill resolved in the vetted registry at apply. */
    staffed: boolean("staffed").default(false).notNull(),
    /** Secondee worker in the borrowing project (null until approved). */
    secondeeWorkerId: bigint("secondee_worker_id", { mode: "number", unsigned: true }),
    /** Shared capacity pool id stamped on origin + secondee workers. */
    capacityGroupId: varchar("capacity_group_id", { length: 128 }),
    decidedBy: varchar("decided_by", { length: 255 }),
    decidedAt: timestamp("decided_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("worker_contracts_ent_key_idx").on(t.enterpriseId, t.key),
    index("worker_contracts_ent_status_idx").on(t.enterpriseId, t.status),
    index("worker_contracts_company_idx").on(t.companyId, t.status),
  ],
);

/**
 * Reference-only enterprise memory. NEVER stores artifact bodies or secrets:
 * only the ArtifactRef (ids + content sha256) plus a bounded extractive
 * summary copied from the artifact row. Promotion is an explicit human
 * decision (pending → promoted/rejected), same discipline as approvals.
 */
export const memoryEntries = mysqlTable(
  "memory_entries",
  {
    id: serial("id").primaryKey(),
    enterpriseId: bigint("enterprise_id", { mode: "number", unsigned: true })
      .notNull()
      .references(() => enterprises.id),
    scope: mysqlEnum("scope", ["enterprise", "company", "department", "office"])
      .$type<MemoryScope>()
      .notNull(),
    /** programId for enterprise scope, else the company/department/office key. */
    scopeKey: varchar("scope_key", { length: 64 }).notNull(),
    artifactRef: json("artifact_ref").$type<ArtifactRef>().notNull(),
    /** Bounded extractive summary (copied, never provider-generated). */
    summary: varchar("summary", { length: 2000 }).default("").notNull(),
    /** Integrity hash; verified against the artifact row on every read. */
    contentSha256: char("content_sha256", { length: 64 }).notNull(),
    state: mysqlEnum("state", ["pending", "promoted", "rejected", "revoked"])
      .default("pending")
      .notNull(),
    decidedBy: varchar("decided_by", { length: 255 }),
    decidedAt: timestamp("decided_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("memory_entries_ent_scope_idx").on(t.enterpriseId, t.scope, t.state),
    index("memory_entries_sha_idx").on(t.contentSha256),
  ],
);

/**
 * The CEO program: one row per applied blueprint (blueprintHash is the
 * idempotency identity — re-applying the same blueprint replays, never
 * duplicates). companyRuns records dispatched run ids so recovery never
 * redispatches an existing run.
 */
export const enterprisePrograms = mysqlTable(
  "enterprise_programs",
  {
    id: serial("id").primaryKey(),
    enterpriseId: bigint("enterprise_id", { mode: "number", unsigned: true })
      .notNull()
      .references(() => enterprises.id),
    /** Idempotency identity: sha256 of the canonical blueprint. */
    blueprintHash: char("blueprint_hash", { length: 64 }).notNull(),
    blueprint: json("blueprint").$type<EnterpriseBlueprint>().notNull(),
    state: mysqlEnum("state", [
      "draft",
      "blueprint_ready",
      "awaiting_plan_approval",
      "dispatching",
      "running",
      "reconciling",
      "completed",
      "failed",
      "stopped_budget",
      "stopped_human",
    ])
      .$type<CeoProgramState>()
      .default("draft")
      .notNull(),
    /** OCC guard on every program mutation. */
    version: int("version").default(1).notNull(),
    /** Recorded company runs (runId null until dispatched; never redispatched). */
    companyRuns: json("company_runs").$type<CompanyRun[]>().notNull(),
    budget: json("budget").$type<EnterpriseBudget>().notNull(),
    maxReplans: int("max_replans").default(2).notNull(),
    maxConcurrentRuns: int("max_concurrent_runs").default(4).notNull(),
    /** Set by program.pause; pump refuses to dispatch while set. */
    pausedAt: timestamp("paused_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex("enterprise_programs_hash_idx").on(t.blueprintHash),
    index("enterprise_programs_ent_state_idx").on(t.enterpriseId, t.state),
  ],
);

/** Project-scoped append-only enterprise audit stream (same discipline as run_events). */
export const enterpriseEvents = mysqlTable(
  "enterprise_events",
  {
    id: serial("id").primaryKey(),
    enterpriseId: bigint("enterprise_id", { mode: "number", unsigned: true })
      .notNull()
      .references(() => enterprises.id),
    seq: bigint("seq", { mode: "number", unsigned: true }).notNull(),
    type: varchar("type", { length: 64 }).notNull(),
    payload: json("payload").notNull(),
    actor: mysqlEnum("actor", ["director", "node", "human", "system", "worker"])
      .$type<EventActor>()
      .notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("enterprise_events_ent_seq_idx").on(t.enterpriseId, t.seq),
    index("enterprise_events_ent_type_idx").on(t.enterpriseId, t.type),
  ],
);

// ── Donna / shared assistants (contracts/assistant.ts) ───────────
//
// Owner-scoped assistant state: deterministic job schedules, typed action
// proposals (SEPARATE from run approvals), generic work queues, draft study
// queues, confirmed repository metadata + routing plans, and refs-only
// knowledge transfer records. No secrets, no artifact bodies, no provider
// output anywhere in these tables (ArtifactRef + hashes only).

/** Assistant job schedule (deterministic, free, never executes proposals). */
export const assistantJobs = mysqlTable(
  "assistant_jobs",
  {
    id: serial("id").primaryKey(),
    ownerId: bigint("owner_id", { mode: "number", unsigned: true })
      .notNull()
      .references(() => users.id),
    enterpriseId: bigint("enterprise_id", { mode: "number", unsigned: true })
      .notNull()
      .references(() => enterprises.id),
    /** Contract AssistantJob.id (per-enterprise unique). */
    jobKey: varchar("job_key", { length: 80 }).notNull(),
    scope: mysqlEnum("scope", ["enterprise", "company", "department", "office"])
      .$type<AssistantScope>()
      .notNull(),
    /** Company/department/office key; "" at enterprise scope. */
    scopeKey: varchar("scope_key", { length: 64 }).default("").notNull(),
    kind: mysqlEnum("kind", [
      "ledger_refresh",
      "cache_refresh",
      "program_pump_mock",
      "repository_sync",
      "study_plan",
    ])
      .$type<AssistantJobKind>()
      .notNull(),
    schedule: json("schedule").$type<AssistantJobSchedule>().notNull(),
    enabled: boolean("enabled").default(true).notNull(),
    /** Epoch ms; null = never runs again (scheduleNextRun terminator). */
    nextRunAt: bigint("next_run_at", { mode: "number", unsigned: true }),
    lastRunAt: bigint("last_run_at", { mode: "number", unsigned: true }),
    runCount: int("run_count").default(0).notNull(),
    maxRuns: int("max_runs"),
    /** Always ZERO_RESERVATION: assistant jobs are free by contract. */
    budget: json("budget").$type<EnterpriseReservation>().notNull(),
    /** OCC guard; claim-first sweep CASes on it. */
    version: int("version").default(1).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex("assistant_jobs_owner_ent_key_idx").on(t.ownerId, t.enterpriseId, t.jobKey),
    index("assistant_jobs_due_idx").on(t.enabled, t.nextRunAt),
    index("assistant_jobs_owner_idx").on(t.ownerId, t.enterpriseId),
  ],
);

/**
 * A typed assistant action proposal — the ONLY path from assistant intent to
 * execution. Deliberately separate from run-scoped `approvals`; the status
 * machine is the contract's (proposed → approved/rejected → executed/failed,
 * or cancelled). expectedVersion is the OCC pin against enterprises.version;
 * payloadHash binds the exact approved payload (sha256 canonical JSON).
 */
export const assistantProposals = mysqlTable(
  "assistant_proposals",
  {
    id: serial("id").primaryKey(),
    ownerId: bigint("owner_id", { mode: "number", unsigned: true })
      .notNull()
      .references(() => users.id),
    enterpriseId: bigint("enterprise_id", { mode: "number", unsigned: true })
      .notNull()
      .references(() => enterprises.id),
    /** Contract AssistantActionProposal.id (per-owner unique). */
    proposalKey: varchar("proposal_key", { length: 80 }).notNull(),
    scope: mysqlEnum("scope", ["enterprise", "company", "department", "office"])
      .$type<AssistantScope>()
      .notNull(),
    actor: varchar("actor", { length: 80 }).notNull(),
    action: varchar("action", { length: 64 }).notNull(),
    payload: json("payload").$type<Record<string, unknown>>().notNull(),
    payloadHash: char("payload_hash", { length: 64 }).notNull(),
    expectedVersion: int("expected_version").notNull(),
    risk: mysqlEnum("risk", ["low", "medium", "high"]).$type<AssistantRisk>().notNull(),
    requiresApproval: boolean("requires_approval").notNull(),
    /** Gates the human explicitly confirmed at decide time (for execute re-check). */
    confirmedGates: json("confirmed_gates").$type<AssistantGate[]>().notNull(),
    status: mysqlEnum("status", [
      "proposed",
      "approved",
      "rejected",
      "executed",
      "failed",
      "cancelled",
    ])
      .$type<AssistantProposalStatus>()
      .default("proposed")
      .notNull(),
    resultSummary: varchar("result_summary", { length: 2000 }).default("").notNull(),
    /** Epoch ms (caller-supplied at propose; server clock at decide/execute). */
    proposedAt: bigint("proposed_at", { mode: "number", unsigned: true }).notNull(),
    decidedAt: bigint("decided_at", { mode: "number", unsigned: true }),
    executedAt: bigint("executed_at", { mode: "number", unsigned: true }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex("assistant_proposals_owner_key_idx").on(t.ownerId, t.proposalKey),
    index("assistant_proposals_ent_status_idx").on(t.enterpriseId, t.status),
    index("assistant_proposals_owner_status_idx").on(t.ownerId, t.status),
  ],
);

/** One work queue per (enterprise, scope, scopeKey); version is the reorder OCC guard. */
export const assistantWorkQueues = mysqlTable(
  "assistant_work_queues",
  {
    id: serial("id").primaryKey(),
    ownerId: bigint("owner_id", { mode: "number", unsigned: true })
      .notNull()
      .references(() => users.id),
    enterpriseId: bigint("enterprise_id", { mode: "number", unsigned: true })
      .notNull()
      .references(() => enterprises.id),
    scope: mysqlEnum("scope", ["enterprise", "company", "department", "office"])
      .$type<AssistantScope>()
      .notNull(),
    scopeKey: varchar("scope_key", { length: 64 }).default("").notNull(),
    /** OCC guard bumped on every add/reorder/status change. */
    version: int("version").default(1).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex("assistant_work_queues_ent_scope_idx").on(t.enterpriseId, t.scope, t.scopeKey),
    index("assistant_work_queues_owner_idx").on(t.ownerId, t.enterpriseId),
  ],
);

/** Dense-positioned queue items (reorder = dense reindex, tie-break by itemKey). */
export const assistantQueueItems = mysqlTable(
  "assistant_queue_items",
  {
    id: serial("id").primaryKey(),
    queueId: bigint("queue_id", { mode: "number", unsigned: true })
      .notNull()
      .references(() => assistantWorkQueues.id),
    itemKey: varchar("item_key", { length: 120 }).notNull(),
    itemKind: mysqlEnum("item_kind", ["company-run", "study", "repository-triage", "custom"])
      .$type<AssistantQueueItemKind>()
      .notNull(),
    refId: varchar("ref_id", { length: 255 }).default("").notNull(),
    title: varchar("title", { length: 200 }).notNull(),
    /** Dense ordering (0-based, contiguous per queue). */
    position: int("position").notNull(),
    status: mysqlEnum("status", ["queued", "dispatched", "done", "dropped"])
      .$type<AssistantQueueItemStatus>()
      .default("queued")
      .notNull(),
    /** sha256 of the canonical enqueue payload (idempotency/dedupe basis). */
    payloadHash: char("payload_hash", { length: 64 }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex("assistant_queue_items_queue_key_idx").on(t.queueId, t.itemKey),
    uniqueIndex("assistant_queue_items_queue_pos_idx").on(t.queueId, t.position),
    index("assistant_queue_items_queue_status_idx").on(t.queueId, t.status),
  ],
);

/**
 * Draft study items derived from seeded registry resources. The contract's
 * `providerCalls: false` is implied (never stored): no paid provider call is
 * ever automatic from this table.
 */
export const studyQueueItems = mysqlTable(
  "study_queue_items",
  {
    id: serial("id").primaryKey(),
    ownerId: bigint("owner_id", { mode: "number", unsigned: true })
      .notNull()
      .references(() => users.id),
    enterpriseId: bigint("enterprise_id", { mode: "number", unsigned: true })
      .notNull()
      .references(() => enterprises.id),
    /** Content-derived contract id `${skillId}:${sha256(ref)[:12]}`. */
    itemKey: varchar("item_key", { length: 120 }).notNull(),
    skillId: varchar("skill_id", { length: 80 }).notNull(),
    /** Reference to a registry resource (URL/id); never inline content. */
    resourceRef: varchar("resource_ref", { length: 500 }).notNull(),
    topic: varchar("topic", { length: 200 }).default("").notNull(),
    goal: varchar("goal", { length: 1000 }).notNull(),
    evaluation: varchar("evaluation", { length: 200 }).default("").notNull(),
    status: mysqlEnum("status", ["draft", "queued", "in-progress", "completed", "dropped"])
      .$type<StudyQueueStatus>()
      .default("draft")
      .notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("study_queue_items_ent_key_idx").on(t.enterpriseId, t.itemKey),
    index("study_queue_items_owner_status_idx").on(t.ownerId, t.status),
  ],
);

/**
 * Confirmed repository metadata (RepositoryMetadataSchema shape). Populated
 * only by an explicit metadata read (public-anonymous or an approved
 * credentialed read through the owner's vault record). No clone, no code,
 * no secrets.
 */
export const repositoryRecords = mysqlTable(
  "repository_records",
  {
    id: serial("id").primaryKey(),
    ownerId: bigint("owner_id", { mode: "number", unsigned: true })
      .notNull()
      .references(() => users.id),
    enterpriseId: bigint("enterprise_id", { mode: "number", unsigned: true })
      .notNull()
      .references(() => enterprises.id),
    url: varchar("url", { length: 512 }).notNull(),
    ownerName: varchar("owner_name", { length: 200 }).notNull(),
    name: varchar("name", { length: 200 }).notNull(),
    description: varchar("description", { length: 2000 }).default("").notNull(),
    language: varchar("language", { length: 80 }),
    topics: json("topics").$type<string[]>().notNull(),
    /** SPDX license id (lowercase) or null when undeclared. */
    license: varchar("license", { length: 80 }),
    archived: boolean("archived").default(false).notNull(),
    defaultBranch: varchar("default_branch", { length: 200 }).notNull(),
    /** Full 40-hex sha of the default-branch HEAD at intake time. */
    commitSha: char("commit_sha", { length: 40 }).notNull(),
    visibility: mysqlEnum("visibility", ["public", "private", "internal"])
      .$type<RepositoryVisibility>()
      .notNull(),
    /** Credentialed reads require the approved proposal's credentials gate. */
    intakeMode: mysqlEnum("intake_mode", ["public-anonymous", "credentialed-approved"])
      .$type<GithubIntakeMode>()
      .notNull(),
    /** Vault record used for a credentialed read (null for public). */
    createdByRecordId: bigint("created_by_record_id", { mode: "number", unsigned: true }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex("repository_records_ent_url_idx").on(t.enterpriseId, t.url),
    index("repository_records_owner_idx").on(t.ownerId, t.enterpriseId),
  ],
);

/**
 * A routing plan for one repository at one commit (routeRepository output).
 * Always a proposal: `assigned` plans only take effect via the approved
 * repository.assign path; proposed_new_structure never creates companies,
 * departments, or roles.
 */
export const repoAssignmentPlans = mysqlTable(
  "repo_assignment_plans",
  {
    id: serial("id").primaryKey(),
    repositoryId: bigint("repository_id", { mode: "number", unsigned: true })
      .notNull()
      .references(() => repositoryRecords.id),
    url: varchar("url", { length: 512 }).notNull(),
    commitSha: char("commit_sha", { length: 40 }).notNull(),
    status: mysqlEnum("status", ["assigned", "quarantined", "proposed_new_structure"])
      .$type<RepoAssignmentStatus>()
      .notNull(),
    companyKey: varchar("company_key", { length: 64 }),
    departmentKey: varchar("department_key", { length: 64 }),
    discipline: varchar("discipline", { length: 64 }).$type<Discipline>(),
    skillId: varchar("skill_id", { length: 80 }),
    confidence: double("confidence").notNull(),
    rationale: varchar("rationale", { length: 2000 }).notNull(),
    readOnly: boolean("read_only").default(true).notNull(),
    redistributionAllowed: boolean("redistribution_allowed").default(false).notNull(),
    notes: json("notes").$type<string[]>().notNull(),
    /** Human who applied the assignment (null until approved apply). */
    appliedBy: varchar("applied_by", { length: 255 }),
    appliedAt: timestamp("applied_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("repo_assignment_plans_repo_sha_idx").on(t.repositoryId, t.commitSha),
    index("repo_assignment_plans_repo_status_idx").on(t.repositoryId, t.status),
  ],
);

/**
 * Refs-only knowledge handoff (KnowledgeTransferRecordSchema): ArtifactRef
 * list + bounded extractive summary, integrity-bound by contentSha256.
 */
export const knowledgeTransfers = mysqlTable(
  "knowledge_transfers",
  {
    id: serial("id").primaryKey(),
    ownerId: bigint("owner_id", { mode: "number", unsigned: true })
      .notNull()
      .references(() => users.id),
    enterpriseId: bigint("enterprise_id", { mode: "number", unsigned: true })
      .notNull()
      .references(() => enterprises.id),
    transferKey: varchar("transfer_key", { length: 80 }).notNull(),
    refs: json("refs").$type<ArtifactRef[]>().notNull(),
    handoff: json("handoff").$type<{ from: string; to: string; summary: string }>().notNull(),
    contentSha256: char("content_sha256", { length: 64 }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("knowledge_transfers_ent_key_idx").on(t.enterpriseId, t.transferKey),
    index("knowledge_transfers_owner_idx").on(t.ownerId, t.enterpriseId),
  ],
);

export type AssistantJobRow = typeof assistantJobs.$inferSelect;
export type AssistantProposalRow = typeof assistantProposals.$inferSelect;
export type AssistantWorkQueueRow = typeof assistantWorkQueues.$inferSelect;
export type AssistantQueueItemRow = typeof assistantQueueItems.$inferSelect;
export type StudyQueueItemRow = typeof studyQueueItems.$inferSelect;
export type RepositoryRecordRow = typeof repositoryRecords.$inferSelect;
export type RepoAssignmentPlanRow = typeof repoAssignmentPlans.$inferSelect;
export type KnowledgeTransferRow = typeof knowledgeTransfers.$inferSelect;

export type Enterprise = typeof enterprises.$inferSelect;
export type EnterpriseCompany = typeof enterpriseCompanies.$inferSelect;
export type EnterpriseDepartment = typeof enterpriseDepartments.$inferSelect;
export type WorkerContractRow = typeof workerContracts.$inferSelect;
export type MemoryEntryRow = typeof memoryEntries.$inferSelect;
export type EnterpriseProgramRow = typeof enterprisePrograms.$inferSelect;
export type EnterpriseEvent = typeof enterpriseEvents.$inferSelect;

export type Worker = typeof workers.$inferSelect;
export type InsertWorker = typeof workers.$inferInsert;
export type IdempotencyKey = typeof idempotencyKeys.$inferSelect;
export type Project = typeof projects.$inferSelect;
export type DagRevision = typeof dagRevisions.$inferSelect;
export type Skill = typeof skills.$inferSelect;
export type SkillFile = typeof skillFiles.$inferSelect;
export type Agent = typeof agents.$inferSelect;
export type Run = typeof runs.$inferSelect;
export type RunNode = typeof runNodes.$inferSelect;
export type RunEvent = typeof runEvents.$inferSelect;
export type Approval = typeof approvals.$inferSelect;
export type Artifact = typeof artifacts.$inferSelect;
export type KnowledgeDraft = typeof knowledgeDrafts.$inferSelect;
export type BudgetLedgerEntry = typeof budgetLedger.$inferSelect;
export type ExportRow = typeof exportsTable.$inferSelect;
export type OwnerSetting = typeof ownerSettings.$inferSelect;
export type RegistryRole = typeof registryRoles.$inferSelect;
export type RegistryResource = typeof registryResources.$inferSelect;
export type RegistryRoleProfile = typeof registryRoleProfiles.$inferSelect;
export type RegistryRoleResourceLink = typeof registryRoleResourceLinks.$inferSelect;
export type RegistryRoleEvaluationTask = typeof registryRoleEvaluationTasks.$inferSelect;
export type RegistryRoleCandidate = typeof registryRoleCandidates.$inferSelect;
export type RegistryGap = typeof registryGaps.$inferSelect;
export type RegistrySkillMapping = typeof registrySkillMappings.$inferSelect;
export type EvaluationReportRow = typeof evaluationReports.$inferSelect;
export type IntegrationRecord = typeof integrationRecords.$inferSelect;
export type IntegrationDiscovery = typeof integrationDiscoveries.$inferSelect;
export type AutonomyGrantRow = typeof autonomyGrants.$inferSelect;
export type OfficeBlueprint = typeof officeBlueprints.$inferSelect;
export type OfficeRoom = typeof officeRooms.$inferSelect;
export type OfficeAssignment = typeof officeAssignments.$inferSelect;
export type OfficeEvent = typeof officeEvents.$inferSelect;
export type Whiteboard = typeof whiteboards.$inferSelect;
export type WhiteboardNodeRow = typeof whiteboardNodes.$inferSelect;
export type WhiteboardEdgeRow = typeof whiteboardEdges.$inferSelect;
export type WhiteboardNoteRow = typeof whiteboardNotes.$inferSelect;
export type WhiteboardRevision = typeof whiteboardRevisions.$inferSelect;
