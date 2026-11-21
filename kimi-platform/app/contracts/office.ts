import { z } from "zod";
import { BUDGET_CEILINGS, NodeKeySchema } from "./dag";
import { APPROVAL_KINDS, PROVIDER_IDS } from "./run";
import { StrategyIdSchema } from "./prompting";

/**
 * Office/autonomy contracts — single source of truth for the new autonomy
 * modes, provider goal modes, office blueprint allocation, and whiteboard
 * document vocab (autonomy_office_control_design.md §2–§5,
 * office_blueprint_whiteboard_design.md §2/§4/§7).
 *
 * Isolated module: pure zod schemas + vocab only. No DB tables, no router
 * wiring; the engine integration points are described in
 * api/office/*.ts header notes.
 */

// ── Autonomy modes (design §2) ───────────────────────────────────

export const AUTONOMY_MODES = ["all", "risk_based", "none"] as const;
export const AutonomyModeSchema = z.enum(AUTONOMY_MODES);
export type AutonomyMode = z.infer<typeof AutonomyModeSchema>;

export const AUTONOMY_SCOPES = ["project", "run"] as const;
export const AutonomyScopeSchema = z.enum(AUTONOMY_SCOPES);
export type AutonomyScope = z.infer<typeof AutonomyScopeSchema>;

/** Project risk tier (projects.riskTier); gates live autonomy. */
export const RISK_TIERS = ["low", "medium", "high"] as const;
export const RiskTierSchema = z.enum(RISK_TIERS);
export type RiskTier = z.infer<typeof RiskTierSchema>;

/**
 * Hard preauthorization ceilings for mode "none" (and usage caps for
 * "risk_based" live runs). All four are mandatory and nonzero — same rule
 * as DagSpec budgets (spec §6.2 rule 4). USD here; stored as micros.
 */
export const AutonomyBudgetSchema = z.object({
  maxTokens: z.number().int().positive().max(BUDGET_CEILINGS.runMaxTokens),
  maxCalls: z.number().int().positive().max(BUDGET_CEILINGS.runMaxCalls),
  maxMinutes: z.number().positive().max(BUDGET_CEILINGS.runMaxMinutes),
  maxCostUsd: z.number().positive().max(BUDGET_CEILINGS.runMaxCostUsd),
});
export type AutonomyBudget = z.infer<typeof AutonomyBudgetSchema>;

/** Grant lifetime bounds (design §2.3: expiresAt ≤ now + 7 days). */
export const AUTONOMY_GRANT_TTL = {
  minMinutes: 5,
  maxMinutes: 10_080, // 7 days
} as const;

/**
 * An autonomy grant row (mirrors the §2.2 table shape). Explicit, expiring,
 * revocable — never an ambient setting. `maxCostUsdMicros` is integer micros.
 */
export const AutonomyGrantSchema = z.object({
  id: z.number().int().positive(),
  projectId: z.number().int().positive(),
  scope: AutonomyScopeSchema,
  /** Set iff scope='run'; the grant dies with that run. */
  runId: z.number().int().positive().nullable(),
  mode: AutonomyModeSchema,
  /** false ⇒ mode 'none' applies to mock runs only. */
  allowLive: z.boolean(),
  maxTokens: z.number().int().positive(),
  maxCalls: z.number().int().positive(),
  maxMinutes: z.number().positive(),
  maxCostUsdMicros: z.number().int().positive(),
  grantedByName: z.string().min(1).max(255),
  reason: z.string().max(500).default(""),
  /** Epoch milliseconds (DB NOW(3) discipline). */
  expiresAtMs: z.number().int().positive(),
  revokedAtMs: z.number().int().positive().nullable(),
  revokedBy: z.string().max(255).nullable(),
  revokeReason: z.string().max(500).nullable(),
});
export type AutonomyGrant = z.infer<typeof AutonomyGrantSchema>;

/** Grant usage rollup (summed over budget_ledger for runs sharing a grant). */
export const GrantUsageSchema = z.object({
  tokens: z.number().int().nonnegative(),
  calls: z.number().int().nonnegative(),
  minutes: z.number().nonnegative(),
  costUsdMicros: z.number().int().nonnegative(),
});
export type GrantUsage = z.infer<typeof GrantUsageSchema>;

/**
 * Approval kinds a grant can NEVER satisfy (design §2.4 rule 1). Plan
 * approval and the confirmLive billing disclosure are run-start gates, not
 * per-node gates, and are listed here so no resolver path can waive them.
 */
export const NEVER_BYPASSABLE_APPROVAL_KINDS = [
  "plan",
  "budget-increase",
  "knowledge-promote",
  "external-action",
] as const;
export type NeverBypassableApprovalKind =
  (typeof NEVER_BYPASSABLE_APPROVAL_KINDS)[number];

// Compile-time guard: every never-bypassable kind is a real approval kind.
const _neverBypassableCheck: readonly (typeof APPROVAL_KINDS)[number][] =
  NEVER_BYPASSABLE_APPROVAL_KINDS;
void _neverBypassableCheck;

/**
 * Closed set of read-only text artifact types eligible for mode-'none' live
 * bypass (design §2.1). Owner content cannot extend this at runtime — only a
 * contract edit can. Anything else (binary/file/export/publish-ish) requires
 * a human gate.
 */
export const TEXT_ARTIFACT_TYPES = [
  "text",
  "markdown",
  "research-brief",
  "summary",
  "report",
  "memo",
  "analysis",
  "comparison",
  "notes",
  "taxonomy",
  "roadmap",
  "evaluation-report",
] as const;
export type TextArtifactType = (typeof TEXT_ARTIFACT_TYPES)[number];

/** Gate decision returned by the autonomy resolver (design §2.4). */
export const GATE_DECISIONS = ["require", "bypass", "forbidden"] as const;
export const GateDecisionSchema = z.enum(GATE_DECISIONS);
export type GateDecision = z.infer<typeof GateDecisionSchema>;

/**
 * Office-stream (project-scoped) and run-stream audit event types added by
 * the autonomy/office/whiteboard features (design §2.5, §4.4, §5). Append-
 * only; payloads never contain secrets.
 */
export const OFFICE_EVENT_TYPES = [
  "autonomy_granted",
  "autonomy_revoked",
  "autonomy_expired",
  "office_agent_assigned",
  "office_agent_reassigned",
  "office_agent_released",
  "office_run_populated",
  "office_blueprint_activated",
  "office_room_allocated",
  "worker_reassigned",
  "whiteboard_saved",
] as const;
export type OfficeEventType = (typeof OFFICE_EVENT_TYPES)[number];

/** Run-stream additions (actor: "system"; per-node audit of every bypass). */
export const AUTONOMY_RUN_EVENT_TYPES = [
  "grant_budget_exceeded",
  "approval_bypassed",
] as const;
export type AutonomyRunEventType = (typeof AUTONOMY_RUN_EVENT_TYPES)[number];

// ── Provider goal modes (design §3) ──────────────────────────────

export const GOAL_MODES = ["explore", "build", "evaluate", "operate"] as const;
export const GoalModeSchema = z.enum(GOAL_MODES);
export type GoalMode = z.infer<typeof GoalModeSchema>;

/**
 * A goal mode is a prompt/strategy preset — NOT a model id and NOT a vendor
 * capability claim. `.strict()` rejects "model" or any unknown key so a
 * preset can never smuggle a hardcoded or invented model identity; model
 * identity continues to come only from OPENAI_MODEL/ANTHROPIC_MODEL env or
 * gateway listModels() at runtime.
 */
export const GoalModePresetSchema = z
  .object({
    mode: GoalModeSchema,
    /** Must be one of the existing catalog ids — no new strategy machinery. */
    strategyId: StrategyIdSchema,
    /** ≤2000 chars; injected as a labeled, trusted preamble section. */
    preamble: z.string().max(2000).default(""),
    /** Multiplier on node.budget.maxTokens for maxOutputTokens, (0,1]. */
    outputTokenFraction: z.number().positive().max(1).default(1),
  })
  .strict();
export type GoalModePreset = z.infer<typeof GoalModePresetSchema>;

export const GoalModePresetsSchema = z.object({
  explore: GoalModePresetSchema,
  build: GoalModePresetSchema,
  evaluate: GoalModePresetSchema,
  operate: GoalModePresetSchema,
});
export type GoalModePresets = z.infer<typeof GoalModePresetsSchema>;

/** Providers a preset may be stored for (prompt-level; provider-agnostic). */
export const GOAL_MODE_PROVIDERS = PROVIDER_IDS;
export const GoalModeProviderSchema = z.enum(GOAL_MODE_PROVIDERS);

/** ownerSettings key prefix for per-provider preset storage (design §3.3). */
export const GOAL_MODE_SETTINGS_PREFIX = "goal-mode-presets:";

// ── Office blueprint (design §4) ─────────────────────────────────

export const ROOM_KINDS = [
  "director-suite",
  "cartography",
  "research-lab",
  "studio",
  "review",
  "vault",
  "ops",
] as const;
export const RoomKindSchema = z.enum(ROOM_KINDS);
export type RoomKind = z.infer<typeof RoomKindSchema>;

/**
 * Per-room preauthorization envelopes (checked at allocation; rolled up from
 * budget_ledger at runtime). Storage is bytes for whiteboard/artifact
 * payloads attributed to the room. Money in USD here, micros at rest.
 */
export const RoomBudgetsSchema = z.object({
  maxTokens: z.number().int().positive().max(BUDGET_CEILINGS.runMaxTokens),
  maxCalls: z.number().int().positive().max(BUDGET_CEILINGS.runMaxCalls),
  maxMinutes: z.number().positive().max(BUDGET_CEILINGS.runMaxMinutes),
  maxCostUsd: z.number().positive().max(BUDGET_CEILINGS.runMaxCostUsd),
  /** Soft cap: 1 GiB. Over-cap is a warning state, never silent deletion. */
  maxStorageBytes: z.number().int().positive().max(1_073_741_824),
});
export type RoomBudgets = z.infer<typeof RoomBudgetsSchema>;

export const RoomSpecSchema = z.object({
  key: NodeKeySchema, // reuse kebab-case rule
  name: z.string().min(1).max(255),
  kind: RoomKindSchema,
  capacity: z.number().int().min(1).max(32),
  /**
   * Role patterns (case-insensitive regex sources) matched against
   * workers.role / NodeSpec.role — the same predicate as the claim path.
   */
  eligibleRolePatterns: z.array(z.string().min(1).max(200)).max(16).default([]),
  budgets: RoomBudgetsSchema,
});
export type RoomSpec = z.infer<typeof RoomSpecSchema>;

export const OfficeBlueprintSpecSchema = z
  .object({
    revision: z.number().int().positive(),
    /** ≥2: blueprint + cartography system seats always exist. */
    rooms: z.array(RoomSpecSchema).min(2).max(16),
    /**
     * Role → room key. Unmapped roles land in the room with kind "ops"
     * (which must exist if any role is unmapped).
     */
    roleRooms: z.record(z.string().min(1).max(255), NodeKeySchema),
  })
  .strict();
export type OfficeBlueprintSpec = z.infer<typeof OfficeBlueprintSpecSchema>;

/** Room usage rollup (budget_ledger by room_key + artifact byte rollup). */
export const RoomUsageSchema = z.object({
  tokens: z.number().int().nonnegative(),
  calls: z.number().int().nonnegative(),
  minutes: z.number().nonnegative(),
  costUsdMicros: z.number().int().nonnegative(),
  storageBytes: z.number().int().nonnegative(),
});
export type RoomUsage = z.infer<typeof RoomUsageSchema>;

/** Reassignment policy when the agent holds active claims (design §2.3). */
export const CLAIMS_POLICIES = ["drain", "release-requeue"] as const;
export const ClaimsPolicySchema = z.enum(CLAIMS_POLICIES);
export type ClaimsPolicy = z.infer<typeof ClaimsPolicySchema>;

export const ROOM_HEALTH_LEVELS = ["healthy", "strained", "degraded"] as const;
export const RoomHealthLevelSchema = z.enum(ROOM_HEALTH_LEVELS);
export type RoomHealthLevel = z.infer<typeof RoomHealthLevelSchema>;

/**
 * Permanent seeded office workers (design §4.3 / §7). Propose-only: they can
 * never start/stop runs, decide approvals, or mutate workers/run state.
 */
export const PERMANENT_OFFICE_WORKERS = {
  blueprintOps: {
    name: "blueprint-ops",
    title: "Blueprint Ops Manager",
    kind: "subagent",
    role: "blueprint-ops",
    capabilities: ["read", "summarize", "classify"],
    maxConcurrentClaims: 1,
    seatRoomKey: "operations",
  },
  roadmapCartographer: {
    name: "roadmap-cartographer",
    title: "Roadmap Cartographer",
    kind: "subagent",
    role: "roadmap-cartographer",
    capabilities: ["read", "summarize", "compare", "cite"],
    maxConcurrentClaims: 1,
    seatRoomKey: "operations",
  },
} as const;
export const PERMANENT_OFFICE_WORKER_NAMES = [
  PERMANENT_OFFICE_WORKERS.blueprintOps.name,
  PERMANENT_OFFICE_WORKERS.roadmapCartographer.name,
] as const;
export type PermanentOfficeWorkerName =
  (typeof PERMANENT_OFFICE_WORKER_NAMES)[number];

/** First-run "Set up your office" checklist step keys (observed, not declared). */
export const SETUP_STEP_KEYS = [
  "hire-team",
  "populate-rooms",
  "allocate-compute",
  "allocate-work",
] as const;
export const SetupStepKeySchema = z.enum(SETUP_STEP_KEYS);
export type SetupStepKey = z.infer<typeof SetupStepKeySchema>;

// ── Whiteboard (design §5) ───────────────────────────────────────

/** Closed kind set — deliberately no executable/embed kind. */
export const WB_NODE_KINDS = [
  "text",
  "sticky",
  "section",
  "artifact-ref",
  "run-node-ref",
] as const;
export const WbNodeKindSchema = z.enum(WB_NODE_KINDS);
export type WbNodeKind = z.infer<typeof WbNodeKindSchema>;

export const WB_EDGE_KINDS = ["link", "flow", "annotation"] as const;
export const WbEdgeKindSchema = z.enum(WB_EDGE_KINDS);
export type WbEdgeKind = z.infer<typeof WbEdgeKindSchema>;

export const WB_NOTE_AUTHORS = ["human", "agent", "system"] as const;
export const WbNoteAuthorSchema = z.enum(WB_NOTE_AUTHORS);

export const WB_CONTENT_CAP = 20_000;
export const WB_NOTE_CAP = 4_000;
export const WB_MAX_OPS_PER_BATCH = 200;
/** Single-writer edit lease TTL (seconds), same discipline as worker leases. */
export const WB_EDIT_LEASE_TTL_SECONDS = 120;

export const WbNodeSchema = z.object({
  nodeKey: NodeKeySchema,
  kind: WbNodeKindSchema,
  /** Content is data — capped text, never evaluated (injection is inert). */
  content: z.string().max(WB_CONTENT_CAP).default(""),
  position: z.object({ x: z.number(), y: z.number() }),
  /** Reference targets (validated to belong to the same project). */
  refRunId: z.number().int().positive().nullable().default(null),
  refNodeKey: NodeKeySchema.nullable().default(null),
  refArtifactId: z.number().int().positive().nullable().default(null),
});
export type WbNode = z.infer<typeof WbNodeSchema>;

export const WbEdgeSchema = z.object({
  edgeKey: NodeKeySchema,
  fromKey: NodeKeySchema,
  toKey: NodeKeySchema,
  kind: WbEdgeKindSchema,
});
export type WbEdge = z.infer<typeof WbEdgeSchema>;

export const WbNoteSchema = z.object({
  /** null = board-level note. */
  nodeKey: NodeKeySchema.nullable().default(null),
  body: z.string().min(1).max(WB_NOTE_CAP),
  author: WbNoteAuthorSchema,
  /** worker/agent id or user name; display + audit only. */
  authorRef: z.string().min(1).max(255),
});
export type WbNote = z.infer<typeof WbNoteSchema>;

/** Whiteboard op batch — discriminated union (design §5.2). */
export const WhiteboardOpSchema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("addNode"), node: WbNodeSchema }),
  z.object({
    op: z.literal("updateNode"),
    nodeKey: NodeKeySchema,
    patch: WbNodeSchema.partial().omit({ nodeKey: true }),
  }),
  z.object({ op: z.literal("removeNode"), nodeKey: NodeKeySchema }),
  z.object({ op: z.literal("addEdge"), edge: WbEdgeSchema }),
  z.object({ op: z.literal("removeEdge"), edgeKey: NodeKeySchema }),
  z.object({ op: z.literal("addNote"), note: WbNoteSchema }),
]);
export type WhiteboardOp = z.infer<typeof WhiteboardOpSchema>;

export const WB_EXPORT_FORMATS = ["json", "markdown"] as const;
export const WbExportFormatSchema = z.enum(WB_EXPORT_FORMATS);
export type WbExportFormat = z.infer<typeof WbExportFormatSchema>;

export const WB_DRIFT_KINDS = [
  "run-node-ref-missing",
  "artifact-ref-missing",
  "unreferenced-run-node",
] as const;
export const WbDriftKindSchema = z.enum(WB_DRIFT_KINDS);
export type WbDriftKind = z.infer<typeof WbDriftKindSchema>;
