import {
  GoalModePresetSchema,
  type GoalMode,
  type GoalModePreset,
  type GoalModePresets,
} from "@contracts/office";
import { STRATEGY_IDS, type StrategyId } from "@contracts/prompting";
import { isDispatchableStrategy } from "../prompting/evaluation";

/**
 * Provider goal modes (design §3): owner-configurable prompt/strategy
 * presets layered onto the existing ModelProvider seam and the existing
 * prompt-compiler strategy catalog (STRATEGY_IDS). Pure and deterministic:
 * no clocks, no provider SDKs, no model identity.
 *
 * They are NOT:
 *  - model ids — GoalModePresetSchema is .strict() and rejects any "model"
 *    key; model identity comes only from OPENAI_MODEL/ANTHROPIC_MODEL env
 *    or gateway listModels() at runtime;
 *  - vendor capability claims — the catalog ships no per-vendor feature
 *    matrix; availability stays exactly what availabilityFor reports;
 *  - new SDK parameters — generateStructured keeps maxRetries: 0,
 *    abortSignal, maxOutputTokens only.
 *
 * Integration notes (not wired here):
 *  - `buildPrompts(run, node, skillBody, upstreamRefs)` gains the resolved
 *    preset (read once per dispatch from ownerSettings for run.startedBy,
 *    key `goal-mode-presets:<provider>`; absent/invalid ⇒ shipped default
 *    for run.goalMode). The preamble is inserted via `applyGoalMode` as a
 *    labeled, trusted section — never upstream content.
 *  - Router additions live on the existing `ai` router (`ai.goalModes`,
 *    `ai.setGoalModePreset`); the schema rejects model ids at the edge.
 */

/** Shipped defaults (owner-overridable); strategy ids all exist in STRATEGY_IDS. */
export const DEFAULT_GOAL_MODE_PRESETS: GoalModePresets = {
  explore: {
    mode: "explore",
    strategyId: "least_to_most",
    preamble:
      "Decompose the goal into ordered sub-questions. Survey before " +
      "concluding. Cite sources for every claim and flag uncertainty " +
      "explicitly.",
    outputTokenFraction: 1,
  },
  build: {
    mode: "build",
    strategyId: "plan_execute",
    preamble:
      "Produce the contracted artifact directly. Work spec-first: restate " +
      "the required sections, then fill them. No digressions.",
    outputTokenFraction: 1,
  },
  evaluate: {
    mode: "evaluate",
    // guided_react (evidence critique) is dispatchable; self_consistency
    // is evaluationOnly + requiresOrchestration and would fail every
    // normal dispatch gate — never ship it as a preset.
    strategyId: "guided_react",
    preamble:
      "Critique the subject against its acceptance checks. List every " +
      "failure or limitation explicitly before any verdict.",
    outputTokenFraction: 1,
  },
  operate: {
    mode: "operate",
    strategyId: "direct_structured",
    preamble:
      "Be terse and operational. Emit only the contracted output with " +
      "minimal tokens; no preamble, no recap.",
    outputTokenFraction: 0.5,
  },
};

/**
 * Strategy ids a normal (non-orchestrated) dispatch can actually run:
 * !evaluationOnly && !requiresOrchestration, derived from STRATEGY_CATALOG
 * flags — never hardcoded here. A preset pointing anywhere else would fail
 * the dispatch gate on every node.
 */
export const DISPATCHABLE_STRATEGY_IDS: readonly StrategyId[] =
  STRATEGY_IDS.filter(isDispatchableStrategy);

const DISPATCHABLE = new Set<string>(DISPATCHABLE_STRATEGY_IDS);

/** A preset is usable only if its strategy passes the normal dispatch gate. */
export function isDispatchableGoalModePreset(preset: GoalModePreset): boolean {
  return DISPATCHABLE.has(preset.strategyId);
}

/**
 * Merge owner overrides (raw ownerSettings JSON) over the shipped defaults.
 * Per-mode safeParse + dispatchability: an absent, invalid, legacy, or
 * non-dispatchable entry falls back to the shipped default for that mode —
 * a corrupt or stale override degrades one mode safely, never the whole
 * catalog, and can never introduce a model key (strict schema).
 */
export function resolveGoalModePresets(overrides: unknown): GoalModePresets {
  const rec =
    typeof overrides === "object" && overrides !== null
      ? (overrides as Record<string, unknown>)
      : {};
  const resolveOne = (mode: GoalMode): GoalModePreset => {
    const parsed = GoalModePresetSchema.safeParse(rec[mode]);
    return parsed.success && parsed.data.mode === mode && DISPATCHABLE.has(parsed.data.strategyId)
      ? parsed.data
      : DEFAULT_GOAL_MODE_PRESETS[mode];
  };
  return {
    explore: resolveOne("explore"),
    build: resolveOne("build"),
    evaluate: resolveOne("evaluate"),
    operate: resolveOne("operate"),
  };
}

/** The effective preset for one mode. */
export function resolveGoalModePreset(
  presets: GoalModePresets,
  mode: GoalMode,
): GoalModePreset {
  return presets[mode];
}

/**
 * Deterministic maxOutputTokens: node budget token cap scaled by the
 * preset's output fraction, floored at 1 (never zero — same explicit-and-
 * nonzero rule as budgets), and never above the node's own cap.
 */
export function goalModeMaxOutputTokens(
  nodeMaxTokens: number,
  preset: GoalModePreset,
): number {
  return Math.max(
    1,
    Math.min(nodeMaxTokens, Math.floor(nodeMaxTokens * preset.outputTokenFraction)),
  );
}

export interface GoalModePromptResult {
  system: string;
  maxOutputTokens: number;
}

/**
 * Apply a resolved preset to an assembled system prompt: appends one
 * labeled, trusted preamble section and derives the output-token ceiling.
 * The section header is fixed so tests/snapshots can pin it and so upstream
 * (untrusted) content can never impersonate it — it is always the LAST
 * trusted section the director adds.
 */
export function applyGoalMode(input: {
  system: string;
  nodeMaxTokens: number;
  preset: GoalModePreset;
}): GoalModePromptResult {
  const header = `--- GOAL MODE: ${input.preset.mode} (strategy ${input.preset.strategyId}) ---`;
  const body = input.preset.preamble.trim();
  const system = body
    ? `${input.system}\n\n${header}\n${body}`
    : `${input.system}\n\n${header}`;
  return {
    system,
    maxOutputTokens: goalModeMaxOutputTokens(input.nodeMaxTokens, input.preset),
  };
}
