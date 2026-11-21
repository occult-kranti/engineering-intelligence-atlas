import { createHash } from "node:crypto";
import {
  EVALUATION_VERSION,
  type CaseOutcome,
  type EvaluationReport,
  type EvaluationSuite,
  type MockStrategyProfile,
  type PairedOutcome,
  type RoutingDecision,
  type RoutingRequest,
  type SecurityEvent,
  type StopReason,
  type StressCase,
} from "@contracts/evaluation";
import type { StrategyId } from "@contracts/prompting";
import { compilePrompt } from "./compiler";
import {
  baselineDelta,
  costMicros,
  costPerAcceptedArtifactMicros,
  latencyStats,
  passAtK,
  passPowK,
  qualityScore,
  sumUsage,
  type CallUsage,
} from "./metrics";
import { STRATEGY_CATALOG, getStrategySpec } from "./strategies";

/**
 * Isolated prompt evaluation / stress harness.
 *
 * Everything in this module is deterministic and offline: the mock provider
 * enacts the behaviour profile declared by each stress case, meters synthetic
 * usage, and prices it at caller-supplied rates. No real provider calls, no
 * clocks, no randomness beyond a sha256-seeded PRNG, and no chain-of-thought
 * anywhere — plans and reflections stay as brief action summaries.
 *
 * The router encodes the research routing rules (see
 * prompt_engineering_methods_and_evaluation.md): cheap baselines by default,
 * expensive strategies only when their structural precondition is met, and no
 * multi-agent unless a measured single-agent baseline failed.
 */

// ── Strategy router ──────────────────────────────────────────────

/**
 * Returns a rejection reason when the strategy's research precondition is not
 * met, or null when routing is permitted.
 */
function gatingViolation(strategy: StrategyId, req: RoutingRequest): string | null {
  switch (strategy) {
    case "direct_structured":
    case "plan_execute":
      return null;
    case "least_to_most":
      return req.compositional
        ? null
        : "least_to_most is reserved for compositional tasks whose later sub-answers depend on earlier ones";
    case "guided_react":
      return req.requiresToolWorkflow
        ? null
        : "guided_react is reserved for tool/action workflows; plain document tasks use direct/plan";
    case "bounded_reflexion":
      return req.hasExternalVerifier
        ? null
        : "bounded_reflexion requires an external verifier — single-LLM self-critique is unreliable without one";
    case "self_consistency":
      if (!req.votable) {
        return "self_consistency requires a votable answer space; agreement is ill-defined for open-ended synthesis";
      }
      if (req.slaTier !== "low") {
        return "self_consistency is k× cost and only permitted for low-SLA tasks";
      }
      return null;
    case "tree_search":
      return req.hasExternalVerifier
        ? null
        : "tree_search requires an external checker to score intermediate states cheaply and deterministically";
  }
}

/** Rule-based default when no (permitted) preference exists. */
function defaultRoute(req: RoutingRequest): { strategy: StrategyId; reason: string } {
  if (req.compositional) {
    return {
      strategy: "least_to_most",
      reason: "compositional task: decompose into ordered subproblems, then compose",
    };
  }
  if (req.symbolic) {
    return {
      strategy: "plan_execute",
      reason: "symbolic task: short plan then execute beats one-pass direct on exact-answer work",
    };
  }
  return {
    strategy: "direct_structured",
    reason: "simple/non-symbolic task: cheapest contract that satisfies the output schema",
  };
}

/**
 * Route a task to a prompt strategy under the research rules. A requested
 * strategy that violates its precondition is rejected with a recorded reason
 * and the router falls back to the rule-based default — it never routes a
 * gated strategy anyway.
 */
export function routeStrategy(req: RoutingRequest): RoutingDecision {
  const rejected: RoutingDecision["rejected"] = [];
  const notes: string[] = [];

  let multiAgentPermitted = false;
  if (req.multiAgentRequested) {
    if (req.singleAgentBaselineFailed) {
      multiAgentPermitted = true;
      notes.push(
        "multi-agent permitted only because a measured single-agent baseline failed; v1 catalog has no multi-agent strategy, so dispatch stays single-agent",
      );
    } else {
      rejected.push({
        strategy: "multi-agent",
        reason:
          "multi-agent is not permitted unless a measured single-agent baseline has failed first",
      });
    }
  }

  let chosen: { strategy: StrategyId; reason: string };
  if (req.requestedStrategy) {
    const violation = gatingViolation(req.requestedStrategy, req);
    if (violation) {
      rejected.push({ strategy: req.requestedStrategy, reason: violation });
      chosen = defaultRoute(req);
      notes.push(
        `requested strategy "${req.requestedStrategy}" rejected by routing rules; fell back to ${chosen.strategy}`,
      );
    } else {
      chosen = {
        strategy: req.requestedStrategy,
        reason: "requested strategy satisfies its routing preconditions",
      };
    }
  } else {
    chosen = defaultRoute(req);
  }

  if (chosen.strategy === "guided_react") {
    notes.push(
      "guided_react tool execution is disabled in v1: action steps are declarative document actions over provided excerpts only",
    );
  }
  const spec = getStrategySpec(chosen.strategy);
  if (spec.evaluationOnly) {
    notes.push(
      `${chosen.strategy} is evaluation-only: compile for offline comparison against direct_structured; not eligible for production dispatch without measured quality-per-dollar lift and pass^k reliability`,
    );
  }

  return {
    strategy: chosen.strategy,
    reason: chosen.reason,
    rejected,
    multiAgentPermitted,
    notes,
  };
}

// ── Normal-dispatch gate ─────────────────────────────────────────

/**
 * Strategies eligible for normal (production) dispatch: cheap, single-call,
 * non-orchestrated. Evaluation-only strategies (self_consistency,
 * tree_search) and orchestration-requiring strategies (bounded_reflexion)
 * may be compiled for offline comparison but can NEVER enter the scheduler's
 * dispatch path.
 */
export const DISPATCHABLE_STRATEGIES = [
  "direct_structured",
  "plan_execute",
  "least_to_most",
  "guided_react",
] as const satisfies readonly StrategyId[];

export function isDispatchableStrategy(id: StrategyId): boolean {
  const spec = getStrategySpec(id);
  return !spec.evaluationOnly && !spec.requiresOrchestration;
}

/**
 * Routing for normal dispatch. On top of the research routing rules, a
 * requested evaluation-only or orchestration-requiring strategy is rejected
 * with a recorded reason and the router falls back to the rule-based default
 * — the expensive strategy is never routed into dispatch anyway. The result
 * is guaranteed dispatchable.
 */
export function resolveDispatchStrategy(req: RoutingRequest): RoutingDecision {
  if (req.requestedStrategy && !isDispatchableStrategy(req.requestedStrategy)) {
    const spec = getStrategySpec(req.requestedStrategy);
    const reason = spec.evaluationOnly
      ? `${req.requestedStrategy} is evaluation-only: compile for offline comparison against direct_structured; never eligible for normal dispatch`
      : `${req.requestedStrategy} requires multi-call orchestration; v1 dispatch is single-call, so it cannot enter normal dispatch`;
    const inner = routeStrategy({ ...req, requestedStrategy: undefined });
    return {
      ...inner,
      rejected: [{ strategy: req.requestedStrategy, reason }, ...inner.rejected],
      notes: [
        `requested strategy "${req.requestedStrategy}" rejected at the dispatch gate; fell back to ${inner.strategy}`,
        ...inner.notes,
      ],
    };
  }
  const decision = routeStrategy(req);
  if (!isDispatchableStrategy(decision.strategy)) {
    // Defensive: the rule-based default is always dispatchable; if routing
    // ever produced a gated strategy, force the baseline rather than dispatch
    // an evaluation-only contract.
    return {
      ...decision,
      strategy: "direct_structured",
      reason: "forced dispatch-eligible baseline",
      notes: [
        ...decision.notes,
        `routed strategy "${decision.strategy}" is not dispatch-eligible; forced direct_structured`,
      ],
    };
  }
  return decision;
}

/** Human/UI-readable statement of the router rules (evaluation API). */
export const ROUTING_RULES: { id: string; rule: string }[] = [
  {
    id: "default-direct",
    rule: "Default is direct_structured: the cheapest contract that satisfies the output schema; it is the mandatory baseline for every comparison.",
  },
  {
    id: "short-plan-symbolic",
    rule: "plan_execute is allowed for symbolic/exact-answer or multi-part goals when the node contract permits it.",
  },
  {
    id: "compositional-ltm",
    rule: "least_to_most is allowed only for compositional tasks whose later sub-answers depend on earlier ones.",
  },
  {
    id: "react-tool-workflow",
    rule: "guided_react is allowed only for tool/action workflows; in v1 its actions are declarative document actions over provided excerpts (no tool execution).",
  },
  {
    id: "reflexion-verifier",
    rule: "bounded_reflexion requires an external verifier and multi-call orchestration — never dispatched in v1.",
  },
  {
    id: "evaluation-only",
    rule: "self_consistency and tree_search are evaluation-only: compilable for offline comparison, never eligible for normal dispatch without measured quality-per-dollar lift and pass^k reliability.",
  },
  {
    id: "multi-agent",
    rule: "Multi-agent is permitted only after a measured single-agent baseline has failed; v1 dispatch stays single-agent regardless.",
  },
];

// ── Deterministic PRNG ───────────────────────────────────────────

function seedFrom(parts: (string | number)[]): number {
  const h = createHash("sha256").update(parts.join("")).digest();
  return h.readUInt32LE(0);
}

/** mulberry32 — tiny deterministic PRNG; seed fully determines the stream. */
function prng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── Mock provider ────────────────────────────────────────────────

export interface MockRates {
  inputUsdPerMillion: number;
  outputUsdPerMillion: number;
}

export interface MockRunnerOptions {
  rates: MockRates;
  /** Independent repeated trials per (case, strategy). */
  repeats?: number;
  /** k for pass@k / pass^k. */
  k?: number;
  /** Quality at or above which a schema-valid artifact counts as accepted. */
  qualityThreshold?: number;
  /** Minimum trials before any delta is reported as conclusive. */
  minTrialsForConclusion?: number;
  /** Hard per-trial call cap (budget guard). */
  maxCallsPerTrial?: number;
  /** Fanout the runner requests for evaluation-only strategies (clamped in code). */
  requestedFanout?: number;
  /** Retries the runner requests (clamped in code). */
  requestedRetries?: number;
}

/**
 * pass@k with the degenerate all-success case handled here (the shared
 * metrics helper is left untouched): C(n-s, k) = 0 when s = n, so the
 * estimator is exactly 1. k > n is not estimable → null.
 */
function safePassAtK(successes: number, trials: number, k: number): number | null {
  if (k > trials) return null;
  if (successes === trials) return 1;
  return passAtK(successes, trials, k);
}

interface ResolvedProfile {
  schemaValid: boolean;
  rubric: Record<string, number>;
  obeysInjection: boolean;
  noProgress: boolean;
  completionTokens: number;
  costJitter: number;
}

function resolveProfile(c: StressCase, strategy: StrategyId): ResolvedProfile {
  const over: MockStrategyProfile = c.mock.perStrategy[strategy] ?? {};
  return {
    schemaValid: over.schemaValid ?? c.mock.schemaValid,
    rubric: over.rubric ?? c.mock.rubric,
    obeysInjection: over.obeysInjection ?? c.mock.obeysInjection,
    noProgress: over.noProgress ?? c.mock.noProgress,
    completionTokens: over.completionTokens ?? c.mock.completionTokens,
    costJitter: c.mock.costJitter,
  };
}

interface MockCall extends CallUsage {
  outputHash: string;
}

/**
 * One deterministic mock completion. Tokens and latency are derived from the
 * compiled prompt bytes plus a seeded jitter stream, so identical inputs give
 * byte-identical measurements.
 */
function mockCall(
  compiledBytes: number,
  estimatedPromptTokens: number,
  profile: ResolvedProfile,
  rand: () => number,
): MockCall {
  const spread = profile.costJitter;
  const jitter = spread === 0 ? 0 : (rand() * 2 - 1) * spread;
  const completionTokens = Math.max(1, Math.round(profile.completionTokens * (1 + jitter)));
  const latencyMs = Math.max(
    1,
    Math.round(50 + compiledBytes / 20 + completionTokens * 2 + jitter * 400),
  );
  return {
    promptTokens: estimatedPromptTokens,
    completionTokens,
    calls: 1,
    latencyMs,
    outputHash: createHash("sha256")
      .update(String(seedFrom([estimatedPromptTokens, completionTokens, latencyMs])))
      .digest("hex"),
  };
}

interface TrialResult {
  accepted: boolean;
  schemaValid: boolean;
  quality: number;
  usages: MockCall[];
  stopReason: StopReason;
  securityEvent: SecurityEvent | null;
}

/**
 * Execute one trial of a compiled strategy plan under the mock provider,
 * honouring bounded fanout (self_consistency samples, tree_search branches)
 * and bounded retries (bounded_reflexion rounds). Loop termination: two
 * byte-identical failing outputs stop the retry loop immediately; a hard
 * per-trial call cap enforces the budget guard.
 */
function runTrial(
  c: StressCase,
  strategy: StrategyId,
  trial: number,
  compiled: { plan: { fanout: number; retries: number; steps: unknown[] }; meta: { estimatedTokens: number; bytes: { total: number }; resourcesIncluded: string[] } },
  profile: ResolvedProfile,
  threshold: number,
  maxCalls: number,
): TrialResult {
  const spec = getStrategySpec(strategy);
  const fanout = spec.evaluationOnly ? compiled.plan.fanout : 1;
  const maxAttempts = strategy === "bounded_reflexion" ? 1 + compiled.plan.retries : 1;
  const usages: MockCall[] = [];
  let stopReason: StopReason = "completed";
  let lastFailHash: string | null = null;
  let accepted = false;
  let schemaValidAny = false;
  let finalQuality = 0;
  let budgetHit = false;

  const injectionAdmitted =
    c.injectionResourceId !== undefined &&
    compiled.meta.resourcesIncluded.includes(c.injectionResourceId);
  const injectionObeyed = injectionAdmitted && profile.obeysInjection;

  const samples: { schemaValid: boolean; quality: number; hash: string }[] = [];

  const takeCall = (
    sample: number,
    attempt: number,
  ): { schemaValid: boolean; quality: number; hash: string } | null => {
    if (usages.length >= maxCalls) {
      budgetHit = true;
      return null;
    }
    const rand = prng(seedFrom([c.id, strategy, "trial", trial, "sample", sample, "attempt", attempt]));
    const usage = mockCall(compiled.meta.bytes.total, compiled.meta.estimatedTokens, profile, rand);
    // A no-progress profile emits a byte-identical output every attempt so the
    // loop detector below has something real to catch.
    if (profile.noProgress) {
      usage.outputHash = createHash("sha256")
        .update(`no-progress:${c.id}:${strategy}:${trial}`)
        .digest("hex");
    }
    usages.push(usage);
    // Reflexion rounds repair schema and nudge quality up deterministically —
    // unless the profile declares a no-progress loop.
    const schemaValid = profile.schemaValid || (attempt > 0 && !profile.noProgress);
    const qualityLift = strategy === "bounded_reflexion" && !profile.noProgress ? attempt * 0.1 : 0;
    const baseQuality = qualityScore(profile.rubric);
    const quality = Math.min(1, baseQuality + qualityLift);
    return { schemaValid, quality, hash: usage.outputHash };
  };

  if (strategy === "self_consistency" || strategy === "tree_search") {
    // Bounded fanout: independent samples / branches, one attempt each.
    for (let s = 0; s < fanout && !budgetHit; s++) {
      const r = takeCall(s, 0);
      if (!r) break;
      samples.push(r);
    }
    if (strategy === "self_consistency") {
      // Aggregate by agreement: accept when a strict majority of samples pass.
      const passing = samples.filter((s) => s.schemaValid && s.quality >= threshold);
      accepted = passing.length > samples.length / 2 && samples.length > 0;
      schemaValidAny = samples.some((s) => s.schemaValid);
      finalQuality = samples.length
        ? samples.reduce((sum, s) => sum + s.quality, 0) / samples.length
        : 0;
    } else {
      // tree_search: score branches, develop the best — outcome is the best sample.
      const best = samples.reduce<(typeof samples)[number] | null>(
        (b, s) => (b === null || s.quality > b.quality ? s : b),
        null,
      );
      accepted = best !== null && best.schemaValid && best.quality >= threshold;
      schemaValidAny = samples.some((s) => s.schemaValid);
      finalQuality = best?.quality ?? 0;
    }
  } else {
    // Single-sample strategies with bounded retry rounds.
    for (let attempt = 0; attempt < maxAttempts && !budgetHit; attempt++) {
      const r = takeCall(0, attempt);
      if (!r) break;
      samples.push(r);
      schemaValidAny = schemaValidAny || r.schemaValid;
      finalQuality = r.quality;
      if (r.schemaValid && r.quality >= threshold) {
        accepted = true;
        break;
      }
      // No-progress detection: identical failing output twice in a row.
      if (r.hash === lastFailHash) {
        stopReason = "no-progress-loop";
        break;
      }
      lastFailHash = r.hash;
      if (attempt === maxAttempts - 1) {
        stopReason = "retry-cap";
      }
    }
  }

  if (budgetHit) stopReason = "budget-exhausted";
  if (injectionObeyed) accepted = false;

  return {
    accepted,
    schemaValid: schemaValidAny,
    quality: finalQuality,
    usages,
    stopReason,
    securityEvent: injectionObeyed
      ? {
          kind: "prompt-injection-obeyed",
          caseId: c.id,
          strategy,
          detail: `mock obeyed injected instruction from resource "${c.injectionResourceId}"; artifact rejected regardless of schema validity`,
        }
      : null,
  };
}

// ── Case / suite execution ───────────────────────────────────────

const DEFAULTS = {
  repeats: 6,
  k: 2,
  qualityThreshold: 0.7,
  minTrialsForConclusion: 5,
  maxCallsPerTrial: 16,
  requestedFanout: 8,
  requestedRetries: 4,
} as const;

/** Run one stress case under one strategy and return the metered outcome. */
export function runCase(
  c: StressCase,
  strategy: StrategyId,
  options: MockRunnerOptions,
): CaseOutcome {
  const repeats = options.repeats ?? DEFAULTS.repeats;
  const k = options.k ?? DEFAULTS.k;
  const threshold = options.qualityThreshold ?? DEFAULTS.qualityThreshold;
  const minTrials = options.minTrialsForConclusion ?? DEFAULTS.minTrialsForConclusion;
  const maxCalls = options.maxCallsPerTrial ?? DEFAULTS.maxCallsPerTrial;
  const spec = getStrategySpec(strategy);

  const compiled = compilePrompt({
    ...c.input,
    strategy: {
      id: strategy,
      fanout: options.requestedFanout ?? DEFAULTS.requestedFanout,
      retries: options.requestedRetries ?? DEFAULTS.requestedRetries,
    },
  });
  const profile = resolveProfile(c, strategy);

  const trials: TrialResult[] = [];
  for (let t = 0; t < repeats; t++) {
    trials.push(runTrial(c, strategy, t, compiled, profile, threshold, maxCalls));
  }

  const successes = trials.filter((t) => t.accepted).length;
  const allUsages = trials.flatMap((t) => t.usages);
  const usage = sumUsage(allUsages);
  const totalCostMicros = allUsages.reduce(
    (sum, u) => sum + costMicros(u, options.rates),
    0,
  );
  const trialLatencies = trials.map((t) =>
    t.usages.reduce((sum, u) => sum + u.latencyMs, 0),
  );
  const lat = latencyStats(trialLatencies);
  const meanQuality =
    trials.length === 0
      ? 0
      : trials.reduce((sum, t) => sum + t.quality, 0) / trials.length;

  return {
    caseId: c.id,
    strategy,
    strategyVersion: spec.version,
    evaluationOnly: spec.evaluationOnly,
    trials: repeats,
    successes,
    successRate: successes / repeats,
    passAtK: safePassAtK(successes, repeats, k),
    passPowK: passPowK(successes, repeats, k),
    quality: meanQuality,
    schemaValidityRate: trials.filter((t) => t.schemaValid).length / repeats,
    tokens: {
      prompt: usage.promptTokens,
      completion: usage.completionTokens,
      total: usage.totalTokens,
    },
    calls: usage.calls,
    totalCostMicros,
    costPerAcceptedMicros: costPerAcceptedArtifactMicros(totalCostMicros, successes),
    latency: {
      meanMs: lat.meanMs,
      p50Ms: lat.p50Ms,
      p95Ms: lat.p95Ms,
      maxMs: lat.maxMs,
    },
    stopReasons: [...new Set(trials.map((t) => t.stopReason))],
    securityEvents: trials
      .map((t) => t.securityEvent)
      .filter((e): e is SecurityEvent => e !== null)
      .slice(0, 1),
    degradationNotes: compiled.meta.degradationNotes,
    inconclusive: repeats < minTrials,
  };
}

function pairedDelta(
  candidate: CaseOutcome,
  baseline: CaseOutcome,
): {
  quality: { absolute: number; relative: number | null };
  costPerAcceptedMicros: { absolute: number; relative: number | null } | null;
} {
  return {
    quality: baselineDelta(candidate.quality, baseline.quality),
    costPerAcceptedMicros:
      candidate.costPerAcceptedMicros === null || baseline.costPerAcceptedMicros === null
        ? null
        : baselineDelta(candidate.costPerAcceptedMicros, baseline.costPerAcceptedMicros),
  };
}

function suiteHash(suite: EvaluationSuite): string {
  return createHash("sha256")
    .update(JSON.stringify({ name: suite.name, version: suite.version, cases: suite.cases }))
    .digest("hex");
}

/**
 * Execute a full suite: for every case, run BOTH baselines
 * (direct_structured and plan_execute) plus the declared candidates, then
 * pair candidate outcomes against both baselines. The report carries only
 * point estimates — never significance claims — and goes explicitly
 * inconclusive when the trial count is inadequate.
 */
export function runSuite(
  suite: EvaluationSuite,
  options: MockRunnerOptions,
): EvaluationReport {
  const repeats = options.repeats ?? DEFAULTS.repeats;
  const k = options.k ?? DEFAULTS.k;
  const threshold = options.qualityThreshold ?? DEFAULTS.qualityThreshold;
  const minTrials = options.minTrialsForConclusion ?? DEFAULTS.minTrialsForConclusion;

  const cases: PairedOutcome[] = [];
  const securityEvents: SecurityEvent[] = [];
  const degradationEvents: { caseId: string; note: string }[] = [];
  const allCosts: number[] = [];
  const allLatencies: number[] = [];
  const usedStrategies = new Set<StrategyId>();

  for (const c of suite.cases) {
    const baseline = runCase(c, "direct_structured", options);
    const shortPlanBaseline = runCase(c, "plan_execute", options);
    usedStrategies.add("direct_structured").add("plan_execute");

    const candidates: PairedOutcome["candidates"] = [];
    for (const strategy of new Set(c.candidates)) {
      if (strategy === "direct_structured" || strategy === "plan_execute") continue;
      const outcome = runCase(c, strategy, options);
      usedStrategies.add(strategy);
      candidates.push({
        outcome,
        vsBaseline: pairedDelta(outcome, baseline),
        vsShortPlanBaseline: pairedDelta(outcome, shortPlanBaseline),
      });
    }

    for (const outcome of [
      baseline,
      shortPlanBaseline,
      ...candidates.map((cd) => cd.outcome),
    ]) {
      securityEvents.push(...outcome.securityEvents);
      allCosts.push(outcome.totalCostMicros);
      allLatencies.push(outcome.latency.p50Ms);
      for (const note of outcome.degradationNotes) {
        degradationEvents.push({ caseId: c.id, note });
      }
    }

    cases.push({ caseId: c.id, category: c.category, baseline, shortPlanBaseline, candidates });
  }

  const costStats = latencyStats(allCosts);
  const latStats = latencyStats(allLatencies);
  const anyInconclusive = cases.some(
    (c) =>
      c.baseline.inconclusive ||
      c.shortPlanBaseline.inconclusive ||
      c.candidates.some((cd) => cd.outcome.inconclusive),
  );

  return {
    version: EVALUATION_VERSION,
    suite: { name: suite.name, version: suite.version, hash: suiteHash(suite) },
    strategies: [...usedStrategies].map((id) => ({
      id,
      version: STRATEGY_CATALOG[id].version,
      evaluationOnly: STRATEGY_CATALOG[id].evaluationOnly,
    })),
    rates: options.rates,
    config: {
      repeats,
      k,
      minTrialsForConclusion: minTrials,
      qualityThreshold: threshold,
    },
    cases,
    aggregate: {
      totalCostMicros: allCosts.reduce((s, v) => s + v, 0),
      medianCostMicros: costStats.p50Ms,
      p95CostMicros: costStats.p95Ms,
      medianLatencyMs: latStats.p50Ms,
      p95LatencyMs: latStats.p95Ms,
    },
    securityEvents,
    degradationEvents,
    verdict: anyInconclusive ? "inconclusive" : "measured",
    verdictReason: anyInconclusive
      ? `one or more outcomes used fewer than ${minTrials} trials; deltas are descriptive point estimates only and no conclusion is drawn`
      : `all outcomes used ≥${minTrials} trials; deltas are descriptive point estimates only (no significance testing)`,
    disclaimer:
      "Point estimates from a deterministic mock harness. No statistical significance is computed or implied, and no universal strategy claim is made — strategies earn production use only by measured quality-per-dollar lift over the direct_structured baseline on real tasks.",
  };
}
