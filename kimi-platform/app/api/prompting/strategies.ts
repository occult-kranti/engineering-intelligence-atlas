import type { StrategyId } from "@contracts/prompting";
import { STRATEGY_IDS } from "@contracts/prompting";

/**
 * Versioned prompt-strategy catalog.
 *
 * Every entry records: when to use / when not to use, hard fan-out and retry
 * ceilings (clamped in code regardless of what a caller requests — R3), an
 * approximate cost multiplier vs the direct_structured baseline (a planning
 * estimate, NOT a benchmark measurement), and whether the strategy is
 * evaluation-only pending measured ROI vs the baseline (Kapoor et al. 2024:
 * report cost alongside accuracy; simple baselines often match elaborate
 * scaffolds).
 *
 * There is intentionally no "universal" strategy. The default is
 * direct_structured: the cheapest contract that satisfies the output schema,
 * and the mandatory baseline every expensive strategy is compared against.
 */

export interface StrategySpec {
  id: StrategyId;
  /** Semver of this strategy's prompt template. */
  version: string;
  summary: string;
  whenToUse: string[];
  whenNotToUse: string[];
  /** Absolute fan-out ceiling (parallel samples / branches). */
  maxFanout: number;
  /** Absolute retry/reflection-round ceiling (no automatic billed retry). */
  maxRetries: number;
  /**
   * Approximate expected cost multiplier vs one direct_structured call,
   * derived from call count only (fanout × (1 + retries)). Planning estimate;
   * measure real cost per accepted artifact before enabling in production.
   */
  costMultiplier: number;
  /**
   * Evaluation-only strategies may be compiled for offline comparison but are
   * not eligible for production dispatch until they beat the baseline on
     * measured quality-per-dollar and pass^k reliability.
   */
  evaluationOnly: boolean;
  /** True when realizing the strategy needs multi-call orchestration. */
  requiresOrchestration: boolean;
  notes: string[];
}

export const DEFAULT_STRATEGY: StrategyId = "direct_structured";

export const STRATEGY_CATALOG: Record<StrategyId, StrategySpec> = {
  direct_structured: {
    id: "direct_structured",
    version: "1.0.0",
    summary:
      "Single structured call: goal + contract + evidence in, one schema-valid artifact out. The default and the baseline for all comparisons.",
    whenToUse: [
      "Well-specified single-artifact goals with clear output sections",
      "Non-symbolic synthesis/summarization where deliberation adds no measured lift",
      "Any new task before a more expensive strategy has earned its cost",
    ],
    whenNotToUse: [
      "Genuinely multi-stage goals where decomposition is verifiably needed",
      "High-stakes claims requiring independent re-derivation before acceptance",
    ],
    maxFanout: 1,
    maxRetries: 0,
    costMultiplier: 1.0,
    evaluationOnly: false,
    requiresOrchestration: false,
    notes: [
      "Baseline for every quality/cost comparison; never skipped in evaluation.",
    ],
  },

  plan_execute: {
    id: "plan_execute",
    version: "1.0.0",
    summary:
      "Emit a concise numbered plan (≤N steps) inside the artifact, then execute it section by section in the same call.",
    whenToUse: [
      "Multi-part goals (compare / synthesize / decide) with 3+ required sections",
      "Goals where the acceptance contract is easier to hit against an explicit outline",
    ],
    whenNotToUse: [
      "Simple single-section briefs where the plan would restate the goal",
      "Tight token budgets — the plan costs output tokens",
    ],
    maxFanout: 1,
    maxRetries: 1,
    costMultiplier: 1.5,
    evaluationOnly: false,
    requiresOrchestration: false,
    notes: [
      "Plan is a brief action summary, never private chain-of-thought.",
    ],
  },

  least_to_most: {
    id: "least_to_most",
    version: "1.0.0",
    summary:
      "Decompose into ordered subproblems, answer each in one or two cited sentences, then compose the final artifact from the sub-answers.",
    whenToUse: [
      "Compositional goals whose later parts depend on earlier answers",
      "Evidence matrices and comparisons built row by row",
    ],
    whenNotToUse: [
      "Goals that resist clean decomposition (single holistic judgment)",
      "When subproblem answers cannot be checked independently",
    ],
    maxFanout: 1,
    maxRetries: 1,
    costMultiplier: 2.0,
    evaluationOnly: false,
    requiresOrchestration: false,
    notes: [
      "Sub-answers are evidence summaries; each must cite a provided source or state a limitation.",
    ],
  },

  guided_react: {
    id: "guided_react",
    version: "1.0.0",
    summary:
      "ReAct-shaped discipline without tools: alternate brief plan → action-summary → observation-summary cycles over the PROVIDED documents only.",
    whenToUse: [
      "Evidence-chasing goals where observations must be grounded step by step in the provided resources",
      "Auditable reasoning trails made of short action/observation summaries",
    ],
    whenNotToUse: [
      "v1 tool use of any kind — no tools exist; action steps are declarative document actions only",
      "Tasks where non-informative 'observations' would derail the cycle (documented ReAct weakness)",
    ],
    maxFanout: 1,
    maxRetries: 1,
    costMultiplier: 1.5,
    evaluationOnly: false,
    requiresOrchestration: false,
    notes: [
      "No tools in v1: 'actions' are read/compare/summarize/cite over provided excerpts, never tool calls.",
      "Thoughts are limited to 1–2 sentence action summaries; no chain-of-thought is requested or stored.",
    ],
  },

  bounded_reflexion: {
    id: "bounded_reflexion",
    version: "1.0.0",
    summary:
      "Draft → bounded self-critique against the output contract → revised final. Rounds are hard-capped; the last critique is fed forward as failure text, not a trajectory.",
    whenToUse: [
      "Goals with a deterministic acceptance contract the critique can check against",
      "Draft-quality-sensitive artifacts (syntheses, decision logs)",
    ],
    whenNotToUse: [
      "Hard reasoning tasks with no external verifier — single-LLM self-critique is unreliable there (Stechly et al. 2024)",
      "When weak self-written checks could produce false-positive passes (Reflexion caveat)",
    ],
    maxFanout: 1,
    maxRetries: 2,
    costMultiplier: 2.5,
    evaluationOnly: false,
    requiresOrchestration: true,
    notes: [
      "Single-call mode embeds one critique-and-revise pass; full retry rounds require orchestration.",
      "Critiques are brief contract-check summaries, never private reasoning traces.",
    ],
  },

  self_consistency: {
    id: "self_consistency",
    version: "1.0.0",
    summary:
      "Sample k independent drafts, aggregate by agreement on the load-bearing claims. Expensive; evaluation-only.",
    whenToUse: [
      "Offline evaluation of whether answer variance justifies ensemble cost",
      "High-stakes narrow questions with a verifiable majority answer",
    ],
    whenNotToUse: [
      "Production dispatch without measured ROI vs direct_structured (k× cost)",
      "Open-ended synthesis where 'agreement' is ill-defined",
      "Conflicts between correlated samples — never settle material conflicts by majority vote (skill contract)",
    ],
    maxFanout: 5,
    maxRetries: 0,
    costMultiplier: 5.0,
    evaluationOnly: true,
    requiresOrchestration: true,
    notes: [
      "Compiler emits the per-sample prompt; fan-out and aggregation are the orchestrator's job.",
      "Cost multiplier equals the sample count k (≤ maxFanout).",
    ],
  },

  tree_search: {
    id: "tree_search",
    version: "1.0.0",
    summary:
      "Tree-of-thoughts-style branching: expand b candidate directions per level to depth d, score, prune. Most expensive; evaluation-only.",
    whenToUse: [
      "Offline exploration of genuinely branching problem spaces (plan alternatives)",
      "Research comparisons of search vs single-pass prompting",
    ],
    whenNotToUse: [
      "Any production dispatch in v1 — cost is disproportionate without measured lift",
      "Tasks where intermediate states cannot be scored cheaply and deterministically",
      "Tight budgets: worst case is roughly b^d draft evaluations",
    ],
    maxFanout: 4,
    maxRetries: 0,
    costMultiplier: 8.0,
    evaluationOnly: true,
    requiresOrchestration: true,
    notes: [
      "Depth is capped at 3 by the compiler plan; fanout ≤ maxFanout.",
      "Candidate directions are 1–2 sentence summaries; no reasoning traces.",
    ],
  },
};

const IDS = new Set<string>(STRATEGY_IDS);

export function getStrategySpec(id: string): StrategySpec {
  if (!IDS.has(id)) {
    throw new Error(
      `unknown prompt strategy "${id}"; catalog ids: ${STRATEGY_IDS.join(", ")}`,
    );
  }
  return STRATEGY_CATALOG[id as StrategyId];
}

export interface ResolvedStrategy {
  spec: StrategySpec;
  /** Clamped to the catalog ceiling; ≥1. */
  fanout: number;
  /** Clamped to the catalog ceiling; ≥0. */
  retries: number;
  /** True when the caller asked for more than the catalog allows. */
  clamped: boolean;
}

/** Resolve a requested config against the catalog ceilings (R3: hard caps live in code). */
export function resolveStrategy(
  id: StrategyId,
  requested?: { fanout?: number; retries?: number },
): ResolvedStrategy {
  const spec = getStrategySpec(id);
  const fanout = Math.max(1, Math.min(requested?.fanout ?? 1, spec.maxFanout));
  const retries = Math.max(0, Math.min(requested?.retries ?? 0, spec.maxRetries));
  const clamped =
    (requested?.fanout !== undefined && requested.fanout > spec.maxFanout) ||
    (requested?.retries !== undefined && requested.retries > spec.maxRetries);
  return { spec, fanout, retries, clamped };
}
