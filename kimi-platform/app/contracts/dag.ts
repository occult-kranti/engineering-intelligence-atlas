import { z } from "zod";

/**
 * DAG contract shared by the frontend editor, the tRPC validators, and the
 * server-side engine. Single source of truth — do not duplicate these shapes.
 */

// Global ceilings. Every numeric limit must be a positive integer within these
// bounds (spec §6.2 rule 4: limits are explicit and nonzero). Money is USD;
// time is minutes (fractional minutes allowed, millisecond precision).
export const BUDGET_CEILINGS = {
  nodeMaxTokens: 2_000_000,
  nodeMaxCalls: 100,
  nodeMaxMinutes: 240,
  nodeMaxCostUsd: 100,
  runMaxTokens: 10_000_000,
  runMaxCalls: 500,
  runMaxMinutes: 480,
  runMaxCostUsd: 1_000,
  maxNodes: 40,
  maxEdges: 120,
} as const;

export const NodeBudgetSchema = z.object({
  maxTokens: z.number().int().positive().max(BUDGET_CEILINGS.nodeMaxTokens),
  maxCalls: z.number().int().positive().max(BUDGET_CEILINGS.nodeMaxCalls),
  maxMinutes: z.number().positive().max(BUDGET_CEILINGS.nodeMaxMinutes),
  maxCostUsd: z.number().positive().max(BUDGET_CEILINGS.nodeMaxCostUsd),
});
export type NodeBudget = z.infer<typeof NodeBudgetSchema>;

export const RunBudgetSchema = z.object({
  maxTokens: z.number().int().positive().max(BUDGET_CEILINGS.runMaxTokens),
  maxCalls: z.number().int().positive().max(BUDGET_CEILINGS.runMaxCalls),
  maxMinutes: z.number().positive().max(BUDGET_CEILINGS.runMaxMinutes),
  maxCostUsd: z.number().positive().max(BUDGET_CEILINGS.runMaxCostUsd),
});
export type RunBudget = z.infer<typeof RunBudgetSchema>;

export const TerminationSchema = z.object({
  maxTurns: z.number().int().positive().max(100),
  noProgressTurns: z.number().int().positive().max(50),
  identicalActionRepeat: z.number().int().positive().max(20),
  maxReplans: z.number().int().max(10),
});
export type Termination = z.infer<typeof TerminationSchema>;

/** MVP tool verbs: read-only research/document verbs only. No exec, no writes. */
export const ALLOWED_TOOL_VERBS = [
  "read",
  "summarize",
  "compare",
  "cite",
  "classify",
  "synthesize",
] as const;
export type ToolVerb = (typeof ALLOWED_TOOL_VERBS)[number];

export const SkillPinSchema = z.object({
  name: z.string().min(1).max(200),
  version: z.string().min(1).max(50),
  sha256: z
    .string()
    .regex(/^[0-9a-f]{64}$/, "sha256 must be 64 lowercase hex chars"),
});
export type SkillPin = z.infer<typeof SkillPinSchema>;

export const NodeKeySchema = z
  .string()
  .min(1)
  .max(64)
  .regex(
    /^[a-z][a-z0-9-]*$/,
    "node keys must be lowercase kebab-case starting with a letter",
  );

export const ApprovalBeforeSchema = z.enum(["start", "accept"]);
export type ApprovalBefore = z.infer<typeof ApprovalBeforeSchema>;

export const NodeSpecSchema = z.object({
  key: NodeKeySchema,
  role: z.string().min(1).max(200),
  skill: SkillPinSchema,
  goal: z.string().min(1).max(4000),
  inputArtifactTypes: z.array(z.string().min(1).max(64)).max(16),
  outputArtifactType: z.string().min(1).max(64),
  toolsAllowed: z.array(z.enum(ALLOWED_TOOL_VERBS)).max(16),
  /** Curated registry resource URLs attached as evidence starting points. */
  resourceUrls: z.array(z.string().url().max(1000)).max(16),
  /**
   * Optional prompt-strategy request (catalog id from contracts/prompting).
   * Validated server-side: only dispatch-eligible strategies
   * (direct_structured, plan_execute, least_to_most, guided_react) may be
   * requested, and the router still applies its task-shape gates; anything
   * evaluation-only or orchestration-requiring is rejected. Absent =
   * direct_structured default routing.
   */
  promptStrategy: z
    .object({
      id: z.string().min(1).max(64),
      fanout: z.number().int().positive().max(8).optional(),
      retries: z.number().int().min(0).max(4).optional(),
    })
    .optional(),
  budget: NodeBudgetSchema,
  termination: TerminationSchema,
  approvalBefore: ApprovalBeforeSchema.optional(),
  /** Layout hint for the editor canvas. Not load-bearing for validation. */
  position: z.object({ x: z.number(), y: z.number() }).optional(),
});
export type NodeSpec = z.infer<typeof NodeSpecSchema>;

export const EdgeSpecSchema = z.object({
  from: NodeKeySchema,
  to: NodeKeySchema,
  kind: z.enum(["artifact", "control"]),
});
export type EdgeSpec = z.infer<typeof EdgeSpecSchema>;

export const DagSpecSchema = z
  .object({
    revision: z.number().int().positive(),
    nodes: z.array(NodeSpecSchema).max(BUDGET_CEILINGS.maxNodes),
    edges: z.array(EdgeSpecSchema).max(BUDGET_CEILINGS.maxEdges),
    budget: RunBudgetSchema,
  })
  .strict();
export type DagSpec = z.infer<typeof DagSpecSchema>;

export const ViolationSchema = z.object({
  rule: z.string(),
  path: z.string(),
  message: z.string(),
});
export type Violation = z.infer<typeof ViolationSchema>;

export const ValidationResultSchema = z.object({
  ok: z.boolean(),
  violations: z.array(ViolationSchema),
});
export type ValidationResult = z.infer<typeof ValidationResultSchema>;

/** Default per-node contract used by the editor and the mock planner. */
export function defaultNodeBudget(): NodeBudget {
  return { maxTokens: 24_000, maxCalls: 6, maxMinutes: 15, maxCostUsd: 0.5 };
}

export function defaultTermination(): Termination {
  return {
    maxTurns: 8,
    noProgressTurns: 3,
    identicalActionRepeat: 2,
    maxReplans: 1,
  };
}

export function defaultRunBudget(): RunBudget {
  return { maxTokens: 200_000, maxCalls: 40, maxMinutes: 60, maxCostUsd: 5 };
}

/** USD is persisted/compared as integer micros (1e-6 USD) to avoid float drift. */
export function usdToMicros(usd: number): number {
  return Math.round(usd * 1_000_000);
}

export function microsToUsd(micros: number): number {
  return micros / 1_000_000;
}
