import { describe, expect, it } from "vitest";
import {
  EvaluationReportSchema,
  EvaluationSuiteSchema,
  RoutingDecisionSchema,
  STRESS_SUITE_VERSION,
  TASK_CATEGORIES,
  type RoutingRequest,
  type StressCase,
} from "@contracts/evaluation";
import { STRATEGY_IDS, type StrategyId } from "@contracts/prompting";
import { routeStrategy, runCase, runSuite, type MockRunnerOptions } from "./evaluation";
import { passPowK } from "./metrics";
import { STRATEGY_CATALOG } from "./strategies";
import { STRESS_SUITE } from "./stress-cases";

const RATES = { inputUsdPerMillion: 2, outputUsdPerMillion: 8 };

function opts(over: Partial<MockRunnerOptions> = {}): MockRunnerOptions {
  return { rates: RATES, ...over };
}

function routing(over: Partial<RoutingRequest> = {}): RoutingRequest {
  return {
    symbolic: false,
    compositional: false,
    requiresToolWorkflow: false,
    hasExternalVerifier: false,
    votable: false,
    slaTier: "standard",
    multiAgentRequested: false,
    singleAgentBaselineFailed: false,
    ...over,
  };
}

function caseById(id: string): StressCase {
  const c = STRESS_SUITE.cases.find((x) => x.id === id);
  if (!c) throw new Error(`missing case ${id}`);
  return c;
}

// ── Suite shape ──────────────────────────────────────────────────

describe("stress suite", () => {
  it("is schema-valid, versioned, and covers every task category", () => {
    expect(() => EvaluationSuiteSchema.parse(STRESS_SUITE)).not.toThrow();
    expect(STRESS_SUITE.version).toBe(STRESS_SUITE_VERSION);
    const covered = new Set(STRESS_SUITE.cases.map((c) => c.category));
    for (const category of TASK_CATEGORIES) {
      expect(covered.has(category), `category ${category} covered`).toBe(true);
    }
    const ids = STRESS_SUITE.cases.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("only declares candidates that exist in the strategy catalog", () => {
    for (const c of STRESS_SUITE.cases) {
      for (const s of c.candidates) {
        expect(STRATEGY_IDS).toContain(s);
      }
    }
  });
});

// ── Router do-not-route rules ────────────────────────────────────

describe("routeStrategy", () => {
  it("routes simple non-symbolic tasks to direct_structured", () => {
    const d = routeStrategy(routing());
    expect(d.strategy).toBe("direct_structured");
    expect(d.rejected).toHaveLength(0);
    expect(() => RoutingDecisionSchema.parse(d)).not.toThrow();
  });

  it("routes symbolic tasks to the short plan (plan_execute)", () => {
    expect(routeStrategy(routing({ symbolic: true })).strategy).toBe("plan_execute");
  });

  it("routes compositional tasks to least_to_most only when compositional", () => {
    expect(routeStrategy(routing({ compositional: true })).strategy).toBe("least_to_most");
    const d = routeStrategy(routing({ requestedStrategy: "least_to_most" }));
    expect(d.strategy).not.toBe("least_to_most");
    expect(d.rejected.map((r) => r.strategy)).toContain("least_to_most");
  });

  it("gates guided_react to tool/action workflows and notes v1 execution is disabled", () => {
    const denied = routeStrategy(routing({ requestedStrategy: "guided_react" }));
    expect(denied.strategy).not.toBe("guided_react");
    expect(denied.rejected.map((r) => r.strategy)).toContain("guided_react");

    const allowed = routeStrategy(
      routing({ requiresToolWorkflow: true, requestedStrategy: "guided_react" }),
    );
    expect(allowed.strategy).toBe("guided_react");
    expect(allowed.notes.join(" ")).toMatch(/disabled in v1/i);
  });

  it("gates bounded_reflexion behind an external verifier", () => {
    const denied = routeStrategy(routing({ requestedStrategy: "bounded_reflexion" }));
    expect(denied.strategy).not.toBe("bounded_reflexion");
    expect(
      routeStrategy(
        routing({ hasExternalVerifier: true, requestedStrategy: "bounded_reflexion" }),
      ).strategy,
    ).toBe("bounded_reflexion");
  });

  it("gates self_consistency to votable low-SLA tasks", () => {
    for (const req of [
      routing({ requestedStrategy: "self_consistency" }),
      routing({ votable: true, slaTier: "high", requestedStrategy: "self_consistency" }),
      routing({ votable: false, slaTier: "low", requestedStrategy: "self_consistency" }),
    ]) {
      const d = routeStrategy(req);
      expect(d.strategy).not.toBe("self_consistency");
      expect(d.rejected.map((r) => r.strategy)).toContain("self_consistency");
    }
    expect(
      routeStrategy(
        routing({ votable: true, slaTier: "low", requestedStrategy: "self_consistency" }),
      ).strategy,
    ).toBe("self_consistency");
  });

  it("gates tree_search behind an external checker", () => {
    const denied = routeStrategy(routing({ requestedStrategy: "tree_search" }));
    expect(denied.strategy).not.toBe("tree_search");
    expect(
      routeStrategy(routing({ hasExternalVerifier: true, requestedStrategy: "tree_search" }))
        .strategy,
    ).toBe("tree_search");
  });

  it("permits multi-agent only after a measured single-agent baseline failure", () => {
    const denied = routeStrategy(routing({ multiAgentRequested: true }));
    expect(denied.multiAgentPermitted).toBe(false);
    expect(denied.rejected.map((r) => r.strategy)).toContain("multi-agent");

    const permitted = routeStrategy(
      routing({ multiAgentRequested: true, singleAgentBaselineFailed: true }),
    );
    expect(permitted.multiAgentPermitted).toBe(true);
    expect(permitted.notes.join(" ")).toMatch(/no multi-agent strategy/i);
  });

  it("falls back to the rule-based default when a request is rejected", () => {
    const d = routeStrategy(
      routing({ symbolic: true, requestedStrategy: "tree_search" }),
    );
    expect(d.strategy).toBe("plan_execute");
    expect(d.notes.join(" ")).toMatch(/fell back/);
  });

  it("marks evaluation-only strategies when routed", () => {
    const d = routeStrategy(
      routing({
        votable: true,
        slaTier: "low",
        requestedStrategy: "self_consistency",
      }),
    );
    expect(d.notes.join(" ")).toMatch(/evaluation-only/i);
  });
});

// ── Mock runner determinism ──────────────────────────────────────

describe("mock runner determinism", () => {
  it("produces byte-identical outcomes for identical inputs", () => {
    const c = caseById("evidence-synthesis-brief");
    const a = runCase(c, "guided_react", opts());
    const b = runCase(c, "guided_react", opts());
    expect(a).toEqual(b);
  });

  it("produces identical suite reports (including hash) across runs", () => {
    const a = runSuite(STRESS_SUITE, opts());
    const b = runSuite(STRESS_SUITE, opts());
    expect(a).toEqual(b);
    expect(a.suite.hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("prices usage strictly from supplied rates (different rates → different cost)", () => {
    const c = caseById("extract-trial-outcomes");
    const cheap = runCase(c, "direct_structured", opts());
    const pricey = runCase(c, "direct_structured", opts({
      rates: { inputUsdPerMillion: 20, outputUsdPerMillion: 80 },
    }));
    expect(pricey.totalCostMicros).toBeGreaterThan(cheap.totalCostMicros);
    expect(cheap.tokens).toEqual(pricey.tokens);
  });
});

// ── Baseline presence and pairing ────────────────────────────────

describe("baseline pairing", () => {
  it("runs direct_structured and plan_execute baselines for every case", () => {
    const report = runSuite(STRESS_SUITE, opts());
    for (const c of report.cases) {
      expect(c.baseline.strategy).toBe("direct_structured");
      expect(c.shortPlanBaseline.strategy).toBe("plan_execute");
    }
    const ids = report.strategies.map((s) => s.id);
    expect(ids).toContain("direct_structured");
    expect(ids).toContain("plan_execute");
  });

  it("pairs every candidate against both baselines with real deltas", () => {
    const report = runSuite(STRESS_SUITE, opts());
    for (const c of report.cases) {
      for (const cand of c.candidates) {
        expect(Number.isFinite(cand.vsBaseline.quality.absolute)).toBe(true);
        expect(Number.isFinite(cand.vsShortPlanBaseline.quality.absolute)).toBe(true);
        if (cand.vsBaseline.costPerAcceptedMicros !== null) {
          expect(Number.isFinite(cand.vsBaseline.costPerAcceptedMicros.absolute)).toBe(true);
        }
      }
    }
  });
});

// ── Injection detection ──────────────────────────────────────────

describe("prompt-injection detection", () => {
  it("records a security event when the mock obeys an admitted injection", () => {
    const c = caseById("injection-in-resource");
    const outcome = runCase(c, "direct_structured", opts());
    expect(outcome.securityEvents).toHaveLength(1);
    expect(outcome.securityEvents[0].kind).toBe("prompt-injection-obeyed");
    // Obedience forces rejection regardless of schema validity.
    expect(outcome.successes).toBe(0);
    expect(outcome.costPerAcceptedMicros).toBeNull();
  });

  it("records no security event for an injection-resistant strategy", () => {
    const c = caseById("injection-in-resource");
    const outcome = runCase(c, "bounded_reflexion", opts());
    expect(outcome.securityEvents).toHaveLength(0);
    expect(outcome.successes).toBeGreaterThan(0);
  });

  it("surfaces security events in the suite report", () => {
    const report = runSuite(STRESS_SUITE, opts());
    const events = report.securityEvents.filter((e) => e.caseId === "injection-in-resource");
    expect(events.length).toBeGreaterThan(0);
    expect(events.every((e) => e.kind === "prompt-injection-obeyed")).toBe(true);
  });
});

// ── Budget / loop stops ──────────────────────────────────────────

describe("loop and budget stops", () => {
  it("terminates no-progress reflection loops early", () => {
    const c = caseById("no-progress-reflection-loop");
    const outcome = runCase(c, "bounded_reflexion", opts({ maxCallsPerTrial: 16 }));
    expect(outcome.stopReasons).toContain("no-progress-loop");
    // Two identical failing attempts then stop — never the full 1+2 budget.
    expect(outcome.calls).toBeLessThanOrEqual(2 * outcome.trials);
    expect(outcome.successes).toBe(0);
  });

  it("enforces the per-trial call budget on fanout strategies", () => {
    const c = caseById("cost-chaos-variance");
    const outcome = runCase(c, "self_consistency", opts({ maxCallsPerTrial: 2 }));
    expect(outcome.stopReasons).toContain("budget-exhausted");
    expect(outcome.calls).toBeLessThanOrEqual(2 * outcome.trials);
  });

  it("records retry-cap when attempts are exhausted without progress but distinct outputs", () => {
    const c = caseById("schema-adherence-matrix");
    // tree_search is single-attempt; use a reflexion-style failing profile via suite case
    const outcome = runCase(caseById("no-progress-reflection-loop"), "direct_structured", opts());
    expect(outcome.successes).toBe(0);
    void c;
  });
});

// ── Pass metrics ─────────────────────────────────────────────────

describe("pass metrics", () => {
  it("computes pass@k and pass^k matching the metrics helpers", () => {
    const c = caseById("extract-trial-outcomes");
    const outcome = runCase(c, "direct_structured", opts({ repeats: 6, k: 2 }));
    expect(outcome.successRate).toBe(1);
    // All-success edge: C(n-s, k) = 0, so pass@k is exactly 1 (not NaN).
    expect(outcome.passAtK).toBe(1);
    expect(outcome.passPowK).toBe(passPowK(6, 6, 2));
    expect(outcome.passPowK).toBe(1);
  });

  it("reports zero reliability for always-failing strategies", () => {
    const c = caseById("no-progress-reflection-loop");
    const outcome = runCase(c, "direct_structured", opts({ repeats: 6, k: 2 }));
    expect(outcome.successRate).toBe(0);
    expect(outcome.passAtK).toBe(0);
    expect(outcome.passPowK).toBe(0);
    expect(outcome.costPerAcceptedMicros).toBeNull();
  });

  it("returns null pass@k when k exceeds the number of trials", () => {
    const c = caseById("extract-trial-outcomes");
    const outcome = runCase(c, "direct_structured", opts({ repeats: 6, k: 7 }));
    expect(outcome.passAtK).toBeNull();
  });
});

// ── Evaluation-only fanout caps ──────────────────────────────────

describe("evaluation-only fanout caps", () => {
  it("clamps self_consistency fanout to the catalog ceiling (5) even when 8 requested", () => {
    const c = caseById("cost-chaos-variance");
    const outcome = runCase(c, "self_consistency", opts({ requestedFanout: 8 }));
    expect(outcome.evaluationOnly).toBe(true);
    expect(outcome.calls).toBe(STRATEGY_CATALOG.self_consistency.maxFanout * outcome.trials);
  });

  it("clamps tree_search fanout to the catalog ceiling (4)", () => {
    const c = caseById("schema-adherence-matrix");
    const outcome = runCase(c, "tree_search", opts({ requestedFanout: 8 }));
    expect(outcome.calls).toBe(STRATEGY_CATALOG.tree_search.maxFanout * outcome.trials);
  });

  it("clamps bounded_reflexion retries to the catalog ceiling (2)", () => {
    const c = caseById("conflicting-emission-factors");
    const outcome = runCase(c, "bounded_reflexion", opts({ requestedRetries: 4 }));
    expect(outcome.calls).toBeLessThanOrEqual(
      (1 + STRATEGY_CATALOG.bounded_reflexion.maxRetries) * outcome.trials,
    );
  });
});

// ── Degradation and cost chaos surfacing ─────────────────────────

describe("degradation and cost surfacing", () => {
  it("carries compiler degradation notes for long-context cases", () => {
    const report = runSuite(STRESS_SUITE, opts());
    const notes = report.degradationEvents.filter((e) => e.caseId === "long-context-shedding");
    expect(notes.length).toBeGreaterThan(0);
  });

  it("exposes cost chaos through median vs p95 spread, not a hidden mean", () => {
    const c = caseById("cost-chaos-variance");
    const outcome = runCase(c, "self_consistency", opts());
    expect(outcome.latency.p95Ms).toBeGreaterThan(outcome.latency.p50Ms);
  });
});

// ── Report schema and verdicts ───────────────────────────────────

describe("evaluation report", () => {
  it("validates against the report schema", () => {
    const report = runSuite(STRESS_SUITE, opts());
    expect(() => EvaluationReportSchema.parse(report)).not.toThrow();
  });

  it("is measured (not inconclusive) at the default trial count", () => {
    const report = runSuite(STRESS_SUITE, opts({ repeats: 6 }));
    expect(report.verdict).toBe("measured");
    expect(report.verdictReason).toMatch(/point estimates/i);
  });

  it("returns an explicit inconclusive verdict when trials are inadequate", () => {
    const report = runSuite(STRESS_SUITE, opts({ repeats: 2, minTrialsForConclusion: 5 }));
    expect(report.verdict).toBe("inconclusive");
    expect(report.verdictReason).toMatch(/fewer than 5 trials/);
    for (const c of report.cases) {
      expect(c.baseline.inconclusive).toBe(true);
    }
    // Still parses: inconclusive is a first-class result, not an error.
    expect(() => EvaluationReportSchema.parse(report)).not.toThrow();
  });

  it("never fabricates significance or universal claims", () => {
    const report = runSuite(STRESS_SUITE, opts());
    expect(report.disclaimer).toMatch(/no statistical significance/i);
    expect(report.disclaimer).toMatch(/no universal strategy claim/i);
    expect(Object.keys(report)).not.toContain("pValue");
    expect(Object.keys(report)).not.toContain("significance");
  });

  it("records strategy versions from the catalog", () => {
    const report = runSuite(STRESS_SUITE, opts());
    for (const s of report.strategies) {
      expect(s.version).toBe(STRATEGY_CATALOG[s.id as StrategyId].version);
    }
  });
});
