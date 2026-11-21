import { z } from "zod";
import { StrategyIdSchema } from "./prompting";
import { PromptCompilerInputSchema } from "./prompting";

/**
 * Prompt evaluation / stress-harness contracts (new file — no existing
 * contract was modified). Single source of truth for versioned stress suites,
 * router decisions, mock-runner outcomes, and evaluation reports.
 *
 * Reporting rules (prompt_control_and_stress_testing.md; Kapoor et al. 2024):
 *   - every comparison is paired with the direct_structured baseline AND the
 *     plan_execute (short-plan) baseline;
 *   - cost and latency are reported alongside quality, always from measured
 *     (here: mock-metered) usage priced at caller-supplied rates;
 *   - no fabricated significance: inadequate sample sizes produce an explicit
 *     "inconclusive" verdict, never a p-value or a universal claim;
 *   - no chain-of-thought is requested, stored, or transported anywhere.
 */

export const EVALUATION_VERSION = "1.0.0" as const;
export const STRESS_SUITE_VERSION = "1.0.0" as const;

// ── Task taxonomy ────────────────────────────────────────────────

export const TASK_CATEGORIES = [
  "direct-extraction",
  "symbolic-math",
  "compositional-planning",
  "evidence-summarization",
  "conflicting-sources",
  "format-schema-adherence",
  "prompt-injection-resistance",
  "long-context-degradation",
  "loop-termination",
  "cost-chaos",
] as const;
export const TaskCategorySchema = z.enum(TASK_CATEGORIES);
export type TaskCategory = z.infer<typeof TaskCategorySchema>;

export const SLA_TIERS = ["low", "standard", "high"] as const;
export const SlaTierSchema = z.enum(SLA_TIERS);
export type SlaTier = z.infer<typeof SlaTierSchema>;

// ── Strategy router ──────────────────────────────────────────────

/**
 * Task shape the router sees. These are measured/declared properties of the
 * task, not vibes: the research rules only permit expensive strategies when
 * the matching structural precondition holds.
 */
export const RoutingRequestSchema = z
  .object({
    /** True for arithmetic/symbolic/exact-answer tasks. */
    symbolic: z.boolean(),
    /** True when later sub-answers depend on earlier ones. */
    compositional: z.boolean(),
    /** True for tool/action (agentic) workflows. */
    requiresToolWorkflow: z.boolean(),
    /** True only when an external, independent verifier/checker exists. */
    hasExternalVerifier: z.boolean(),
    /** True when the answer space is small and majority-agreement is well-defined. */
    votable: z.boolean(),
    slaTier: SlaTierSchema,
    multiAgentRequested: z.boolean().default(false),
    /** True only when a measured single-agent baseline run failed. */
    singleAgentBaselineFailed: z.boolean().default(false),
    /** Optional caller preference; gated against the routing rules. */
    requestedStrategy: StrategyIdSchema.optional(),
  })
  .strict();
export type RoutingRequest = z.infer<typeof RoutingRequestSchema>;

export const RoutingDecisionSchema = z
  .object({
    /** Strategy the router actually permits. */
    strategy: StrategyIdSchema,
    /** Why this strategy was selected. */
    reason: z.string().max(500),
    /** Requested/preferred strategies the rules refuse, with reasons. */
    rejected: z.array(
      z.object({
        strategy: z.string().max(64),
        reason: z.string().max(500),
      }),
    ),
    /** Never true in v1 unless a measured single-agent baseline failed. */
    multiAgentPermitted: z.boolean(),
    /** Execution caveats (e.g., tool execution disabled in v1). */
    notes: z.array(z.string().max(500)),
  })
  .strict();
export type RoutingDecision = z.infer<typeof RoutingDecisionSchema>;

// ── Stress suite ─────────────────────────────────────────────────

/**
 * Per-strategy mock behaviour override. Every field is a fixed input to the
 * deterministic mock — the harness never fabricates measurements; the suite
 * author supplies the behaviour the mock enacts, and the runner meters it.
 */
export const MockStrategyProfileSchema = z
  .object({
    /** Whether the mock emits a schema-valid artifact. */
    schemaValid: z.boolean().optional(),
    /** Rubric scores in [0,1] keyed by rubric dimension. */
    rubric: z.record(z.string(), z.number().min(0).max(1)).optional(),
    /** Whether the mock obeys an injected instruction when one is present. */
    obeysInjection: z.boolean().optional(),
    /** True to simulate a no-progress loop (identical failing attempts). */
    noProgress: z.boolean().optional(),
    /** Base completion tokens per call. */
    completionTokens: z.number().int().positive().optional(),
  })
  .strict();
export type MockStrategyProfile = z.infer<typeof MockStrategyProfileSchema>;

export const MockProfileSchema = z
  .object({
    schemaValid: z.boolean().default(true),
    rubric: z.record(z.string(), z.number().min(0).max(1)),
    obeysInjection: z.boolean().default(false),
    noProgress: z.boolean().default(false),
    completionTokens: z.number().int().positive().default(400),
    /**
     * Deterministic cost/latency spread in [0, 1): 0 = perfectly flat,
     * near 1 = chaotic per-call variance (seeded, reproducible).
     */
    costJitter: z.number().min(0).lt(1).default(0),
    /** Per-strategy overrides keyed by catalog id. */
    perStrategy: z.record(z.string(), MockStrategyProfileSchema).default({}),
  })
  .strict();
export type MockProfile = z.infer<typeof MockProfileSchema>;

export const StressCaseSchema = z
  .object({
    id: z.string().min(1).max(120),
    category: TaskCategorySchema,
    description: z.string().max(1000),
    /**
     * Compiler input template. The runner fills `strategy` per run; any
     * `strategy` present here is ignored. Case fixtures must be small enough
     * to be deterministic — no clocks, no fetches.
     */
    input: PromptCompilerInputSchema,
    /** Task shape used to demonstrate/verify routing for this case. */
    routing: RoutingRequestSchema,
    /** Candidate strategies evaluated against the two baselines. */
    candidates: z.array(StrategyIdSchema).max(8).default([]),
    mock: MockProfileSchema,
    /** Resource id carrying the injection attempt, when applicable. */
    injectionResourceId: z.string().max(200).optional(),
    tags: z.array(z.string().max(60)).max(12).default([]),
  })
  .strict();
export type StressCase = z.infer<typeof StressCaseSchema>;

export const EvaluationSuiteSchema = z
  .object({
    name: z.string().min(1).max(120),
    version: z.string().min(1).max(40),
    cases: z.array(StressCaseSchema).min(1),
  })
  .strict();
export type EvaluationSuite = z.infer<typeof EvaluationSuiteSchema>;

// ── Outcomes and report ──────────────────────────────────────────

export const STOP_REASONS = [
  "completed",
  "no-progress-loop",
  "retry-cap",
  "budget-exhausted",
] as const;
export const StopReasonSchema = z.enum(STOP_REASONS);
export type StopReason = z.infer<typeof StopReasonSchema>;

export const SecurityEventSchema = z
  .object({
    kind: z.enum(["prompt-injection-obeyed"]),
    caseId: z.string(),
    strategy: StrategyIdSchema,
    detail: z.string().max(500),
  })
  .strict();
export type SecurityEvent = z.infer<typeof SecurityEventSchema>;

export const CaseOutcomeSchema = z
  .object({
    caseId: z.string(),
    strategy: StrategyIdSchema,
    strategyVersion: z.string(),
    evaluationOnly: z.boolean(),
    /** Repeated independent trials executed. */
    trials: z.number().int().positive(),
    successes: z.number().int().nonnegative(),
    successRate: z.number().min(0).max(1),
    /** Unbiased pass@k estimator; null when k > trials. */
    passAtK: z.number().min(0).max(1).nullable(),
    /** (s/n)^k repeated-run reliability. */
    passPowK: z.number().min(0).max(1),
    /** Mean weighted rubric score over final artifacts. */
    quality: z.number().min(0).max(1),
    schemaValidityRate: z.number().min(0).max(1),
    tokens: z.object({
      prompt: z.number().int().nonnegative(),
      completion: z.number().int().nonnegative(),
      total: z.number().int().nonnegative(),
    }),
    calls: z.number().int().positive(),
    totalCostMicros: z.number().int().nonnegative(),
    /** Null when nothing was accepted — never fabricated. */
    costPerAcceptedMicros: z.number().nonnegative().nullable(),
    latency: z.object({
      meanMs: z.number().nonnegative(),
      p50Ms: z.number().nonnegative(),
      p95Ms: z.number().nonnegative(),
      maxMs: z.number().nonnegative(),
    }),
    stopReasons: z.array(StopReasonSchema),
    securityEvents: z.array(SecurityEventSchema),
    /** Degradation notes surfaced by the compiler (truncations/drops). */
    degradationNotes: z.array(z.string().max(300)),
    /** True when the trial count is below the conclusive threshold. */
    inconclusive: z.boolean(),
  })
  .strict();
export type CaseOutcome = z.infer<typeof CaseOutcomeSchema>;

export const DeltaSchema = z.object({
  absolute: z.number(),
  relative: z.number().nullable(),
});

export const PairedOutcomeSchema = z
  .object({
    caseId: z.string(),
    category: TaskCategorySchema,
    /** Mandatory direct_structured baseline. */
    baseline: CaseOutcomeSchema,
    /** Mandatory plan_execute (short-plan) baseline. */
    shortPlanBaseline: CaseOutcomeSchema,
    candidates: z.array(
      z.object({
        outcome: CaseOutcomeSchema,
        vsBaseline: z.object({
          quality: DeltaSchema,
          costPerAcceptedMicros: DeltaSchema.nullable(),
        }),
        vsShortPlanBaseline: z.object({
          quality: DeltaSchema,
          costPerAcceptedMicros: DeltaSchema.nullable(),
        }),
      }),
    ),
  })
  .strict();
export type PairedOutcome = z.infer<typeof PairedOutcomeSchema>;

export const EvaluationReportSchema = z
  .object({
    version: z.literal(EVALUATION_VERSION),
    suite: z.object({
      name: z.string(),
      version: z.string(),
      /** sha256 over the canonical suite definition (64 lowercase hex). */
      hash: z.string().regex(/^[0-9a-f]{64}$/),
    }),
    strategies: z.array(
      z.object({
        id: StrategyIdSchema,
        version: z.string(),
        evaluationOnly: z.boolean(),
      }),
    ),
    /** Rates the costs were priced at — supplied by the caller, never baked in. */
    rates: z.object({
      inputUsdPerMillion: z.number().nonnegative(),
      outputUsdPerMillion: z.number().nonnegative(),
    }),
    config: z.object({
      repeats: z.number().int().positive(),
      k: z.number().int().positive(),
      minTrialsForConclusion: z.number().int().positive(),
      qualityThreshold: z.number().min(0).max(1),
    }),
    cases: z.array(PairedOutcomeSchema),
    aggregate: z.object({
      totalCostMicros: z.number().int().nonnegative(),
      medianCostMicros: z.number().nonnegative(),
      p95CostMicros: z.number().nonnegative(),
      medianLatencyMs: z.number().nonnegative(),
      p95LatencyMs: z.number().nonnegative(),
    }),
    securityEvents: z.array(SecurityEventSchema),
    degradationEvents: z.array(
      z.object({ caseId: z.string(), note: z.string().max(300) }),
    ),
    /**
     * Explicit verdict. "inconclusive" whenever any trial count is below the
     * conclusive threshold — the harness never fabricates significance.
     */
    verdict: z.enum(["measured", "inconclusive"]),
    verdictReason: z.string().max(500),
    /**
     * Fixed honesty note: this report contains point estimates only — no
     * significance testing, no universal strategy claims.
     */
    disclaimer: z.string().max(500),
  })
  .strict();
export type EvaluationReport = z.infer<typeof EvaluationReportSchema>;
