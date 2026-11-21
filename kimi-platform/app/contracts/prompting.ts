import { z } from "zod";
import { SkillPinSchema } from "./dag";

/**
 * Prompt-contract compiler contracts (isolated module; not yet wired into the
 * scheduler). Single source of truth for the versioned strategy catalog ids,
 * compiler inputs/outputs, and plan/redaction/truncation metadata shapes.
 *
 * Privacy rule (prompt_engineering_methods_and_evaluation.md): nothing here
 * requests, stores, or transports private chain-of-thought. Plans and
 * reflections are limited to concise plan/evidence/action summaries.
 */

export const PROMPT_COMPILER_VERSION = "1.0.0" as const;

// ── Strategy catalog ids ─────────────────────────────────────────

export const STRATEGY_IDS = [
  "direct_structured",
  "plan_execute",
  "least_to_most",
  "guided_react",
  "bounded_reflexion",
  "self_consistency",
  "tree_search",
] as const;
export const StrategyIdSchema = z.enum(STRATEGY_IDS);
export type StrategyId = z.infer<typeof StrategyIdSchema>;

/**
 * Trust labels for every piece of content entering a prompt. Only the
 * director-issued goal and the vetted, hash-pinned skill body may be
 * "trusted"; upstream artifacts and curated resource content are data, not
 * instructions (skill contract; report R16).
 */
export const TRUST_LABELS = ["trusted", "untrusted"] as const;
export const TrustLabelSchema = z.enum(TRUST_LABELS);
export type TrustLabel = z.infer<typeof TrustLabelSchema>;

// ── Compiler inputs ──────────────────────────────────────────────

/** Progressive-disclosure level of a curated resource (L1 metadata → L3 excerpt). */
export const RESOURCE_LEVELS = ["metadata", "summary", "excerpt"] as const;
export const ResourceLevelSchema = z.enum(RESOURCE_LEVELS);
export type ResourceLevel = z.infer<typeof ResourceLevelSchema>;

/**
 * A curated, role-linked registry resource. `excerpt` is pre-fetched and
 * curator-approved: the compiler NEVER fetches arbitrary URLs (R17).
 */
export const CuratedResourceSchema = z.object({
  id: z.string().min(1).max(200),
  title: z.string().min(1).max(500),
  /** Provenance only — recorded, never fetched by the compiler. */
  url: z.string().url().max(1000).optional(),
  /** Pre-fetched curated content; empty at "metadata" level. */
  excerpt: z.string().max(20_000).default(""),
  /** Curator-assigned relevance in [0, 1]; drives deterministic selection. */
  relevance: z.number().min(0).max(1),
  level: ResourceLevelSchema,
  trust: TrustLabelSchema.default("untrusted"),
});
export type CuratedResource = z.infer<typeof CuratedResourceSchema>;

/**
 * Reference-only upstream handoff (spec §9.2): title + summary + hash, never
 * transcripts. Upstream content is always untrusted data (R16).
 */
export const UpstreamArtifactRefSchema = z.object({
  nodeKey: z.string().min(1).max(64),
  title: z.string().min(1).max(500),
  summary: z.string().max(2000).default(""),
  sha256: z
    .string()
    .regex(/^[0-9a-f]{64}$/, "sha256 must be 64 lowercase hex chars"),
  trust: z.literal("untrusted").default("untrusted"),
});
export type UpstreamArtifactRef = z.infer<typeof UpstreamArtifactRefSchema>;

/** Output contract the artifact must satisfy (validated in code, R2). */
export const OutputContractSchema = z.object({
  artifactType: z.string().min(1).max(64),
  requiredSections: z.array(z.string().min(1).max(120)).min(1).max(16),
  requireCitationOrLimitation: z.boolean().default(true),
});
export type OutputContract = z.infer<typeof OutputContractSchema>;

/** Prompt-assembly byte/item caps. Every cap is explicit and nonzero. */
export const PromptBudgetSchema = z.object({
  /** Hard cap on the assembled system message, in UTF-8 bytes. */
  maxSystemBytes: z.number().int().positive().max(262_144).default(24_000),
  /** Hard cap on the assembled user message, in UTF-8 bytes. */
  maxUserBytes: z.number().int().positive().max(1_000_000).default(48_000),
  /** Cap on the pinned skill body (matches the scheduler's 12k slice). */
  maxSkillBytes: z.number().int().positive().max(50_000).default(12_000),
  /** Max curated resources admitted into the prompt. */
  maxResources: z.number().int().positive().max(16).default(8),
  /** Per-resource excerpt cap. */
  maxResourceBytes: z.number().int().positive().max(20_000).default(2_000),
  /** Max upstream artifact references admitted. */
  maxUpstreamRefs: z.number().int().positive().max(16).default(8),
  /** Per-upstream-summary cap. */
  maxUpstreamSummaryBytes: z.number().int().positive().max(4_000).default(600),
  /** Max concise plan steps the model is asked to emit. */
  maxPlanSteps: z.number().int().positive().max(20).default(8),
});
export type PromptBudget = z.infer<typeof PromptBudgetSchema>;

/**
 * Caller-requested strategy configuration. `fanout`/`retries` are requests;
 * the compiler clamps them to the catalog's per-strategy maxima (R3).
 */
export const StrategyConfigSchema = z.object({
  id: StrategyIdSchema.default("direct_structured"),
  fanout: z.number().int().positive().max(8).optional(),
  retries: z.number().int().min(0).max(4).optional(),
});
export type StrategyConfig = z.infer<typeof StrategyConfigSchema>;

export const PromptCompilerInputSchema = z.object({
  /** Immutable director-issued goal for this node. */
  goal: z.string().min(1).max(4000),
  role: z.string().min(1).max(200),
  /** Vetted skill, pinned by content hash; body verified by the caller. */
  skill: z.object({
    pin: SkillPinSchema,
    body: z.string().max(50_000),
  }),
  resources: z.array(CuratedResourceSchema).max(16).default([]),
  upstream: z.array(UpstreamArtifactRefSchema).max(16).default([]),
  output: OutputContractSchema,
  budgets: PromptBudgetSchema.prefault({}),
  strategy: StrategyConfigSchema.default({ id: "direct_structured" }),
  /**
   * Optional run context used only to derive a deterministic seed label
   * (same scheme as the scheduler: sha256 of "runId:nodeKey").
   */
  context: z
    .object({
      runId: z.number().int().positive(),
      nodeKey: z.string().min(1).max(64),
    })
    .optional(),
});
export type PromptCompilerInput = z.infer<typeof PromptCompilerInputSchema>;

// ── Compiler outputs ─────────────────────────────────────────────

/**
 * One concise execution-plan step. `.strict()` guarantees no chain-of-thought
 * or reasoning-trace fields can appear in a compiled plan.
 */
export const PlanStepSchema = z
  .object({
    index: z.number().int().positive(),
    /** Short imperative action summary (≤2 sentences). */
    action: z.string().min(1).max(500),
    /** Evidence consumed or produced by this step (brief). */
    evidence: z.string().max(500).optional(),
  })
  .strict();
export type PlanStep = z.infer<typeof PlanStepSchema>;

export const ExecutionPlanSchema = z
  .object({
    strategy: StrategyIdSchema,
    strategyVersion: z.string(),
    steps: z.array(PlanStepSchema).max(20),
    /** Resolved (clamped) fanout and retries for the orchestrator. */
    fanout: z.number().int().positive(),
    retries: z.number().int().min(0),
    /** True when the catalog marks the strategy evaluation-only. */
    evaluationOnly: z.boolean(),
    /**
     * True when realizing the plan needs multi-call orchestration (fanout,
     * reflection rounds). v1 compiles the single-call prompt only.
     */
    requiresOrchestration: z.boolean(),
    notes: z.array(z.string().max(500)).max(16),
  })
  .strict();
export type ExecutionPlan = z.infer<typeof ExecutionPlanSchema>;

export const TruncationEventSchema = z.object({
  field: z.string(),
  originalBytes: z.number().int().nonnegative(),
  keptBytes: z.number().int().nonnegative(),
  note: z.string().max(300),
});
export type TruncationEvent = z.infer<typeof TruncationEventSchema>;

export const REDACTION_KINDS = [
  "control-chars",
  "delimiter-escape",
] as const;
export const RedactionKindSchema = z.enum(REDACTION_KINDS);
export const RedactionEventSchema = z.object({
  field: z.string(),
  kind: RedactionKindSchema,
  count: z.number().int().positive(),
});
export type RedactionEvent = z.infer<typeof RedactionEventSchema>;

export const CompiledPromptSchema = z
  .object({
    version: z.literal(PROMPT_COMPILER_VERSION),
    system: z.string().min(1),
    user: z.string().min(1),
    plan: ExecutionPlanSchema,
    meta: z
      .object({
        strategy: StrategyIdSchema,
        resolvedFanout: z.number().int().positive(),
        resolvedRetries: z.number().int().min(0),
        /** Catalog cost multiplier vs the direct_structured baseline. */
        costMultiplier: z.number().positive(),
        evaluationOnly: z.boolean(),
        bytes: z.object({
          system: z.number().int().nonnegative(),
          user: z.number().int().nonnegative(),
          total: z.number().int().nonnegative(),
        }),
        /** Rough planning estimate (bytes / 4); never a metered value. */
        estimatedTokens: z.number().int().nonnegative(),
        /** Deterministic seed label, or "none". */
        seed: z.string(),
        /** Resource ids admitted, in inclusion order. */
        resourcesIncluded: z.array(z.string()),
        resourcesDropped: z.array(
          z.object({ id: z.string(), reason: z.string().max(200) }),
        ),
        truncations: z.array(TruncationEventSchema),
        redactions: z.array(RedactionEventSchema),
        /** True when any truncation or drop occurred. */
        degraded: z.boolean(),
        /** Explicit degradation notes the artifact must surface. */
        degradationNotes: z.array(z.string().max(300)),
      })
      .strict(),
  })
  .strict();
export type CompiledPrompt = z.infer<typeof CompiledPromptSchema>;
