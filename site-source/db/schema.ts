import {
  mysqlTable,
  mysqlEnum,
  serial,
  varchar,
  text,
  char,
  timestamp,
  bigint,
  int,
  boolean,
  json,
  uniqueIndex,
  index,
} from "drizzle-orm/mysql-core";
import type { DagSpec, RunBudget } from "../contracts/dag";
import type { SkillManifest, RiskSignal } from "../contracts/skill";
import type {
  RunState,
  RunNodeState,
  ApprovalKind,
  ApprovalState,
  EventActor,
} from "../contracts/run";
import type { AcceptanceOutcome } from "../contracts/artifacts";

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
  },
  (t) => [uniqueIndex("registry_resources_url_idx").on(t.url)],
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
    budget: json("budget").$type<RunBudget>().notNull(),
    startedBy: bigint("started_by", { mode: "number", unsigned: true })
      .notNull()
      .references(() => users.id),
    startedAt: timestamp("started_at").defaultNow().notNull(),
    endedAt: timestamp("ended_at"),
    endReason: varchar("end_reason", { length: 500 }),
  },
  (t) => [index("runs_project_idx").on(t.projectId)],
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
      "running",
      "verifying",
      "accepted",
      "failed",
      "skipped",
    ])
      .$type<RunNodeState>()
      .default("pending")
      .notNull(),
    attempts: int("attempts").default(0).notNull(),
    tokensUsed: int("tokens_used").default(0).notNull(),
    callsUsed: int("calls_used").default(0).notNull(),
    startedAt: timestamp("started_at"),
    endedAt: timestamp("ended_at"),
  },
  (t) => [uniqueIndex("run_nodes_run_key_idx").on(t.runId, t.nodeKey)],
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
    actor: mysqlEnum("actor", ["director", "node", "human", "system"])
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
    accepted: boolean("accepted").default(false).notNull(),
    reviewedBy: varchar("reviewed_by", { length: 255 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("artifacts_run_idx").on(t.runId)],
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
    recordedAt: timestamp("recorded_at").defaultNow().notNull(),
  },
  (t) => [index("budget_ledger_run_idx").on(t.runId)],
);

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
export type IntegrationRecord = typeof integrationRecords.$inferSelect;
export type IntegrationDiscovery = typeof integrationDiscoveries.$inferSelect;
