import { describe, expect, it } from "vitest";
import type { RoutingRequest } from "@contracts/evaluation";
import type { NodeSpec } from "@contracts/dag";
import {
  DISPATCHABLE_STRATEGIES,
  isDispatchableStrategy,
  resolveDispatchStrategy,
} from "./evaluation";
import { routingRequestForNode } from "../engine/prompt";
import { compilePrompt } from "./compiler";
import { PromptBudgetSchema } from "@contracts/prompting";

/**
 * Dispatch gate: evaluation-only or orchestration-requiring strategies can
 * never enter normal dispatch; direct_structured is the default;
 * plan_execute / least_to_most / guided_react only when the contract and
 * task route allow.
 */

function req(over: Partial<RoutingRequest> = {}): RoutingRequest {
  return {
    symbolic: false,
    compositional: false,
    requiresToolWorkflow: false,
    hasExternalVerifier: true,
    votable: false,
    slaTier: "standard",
    multiAgentRequested: false,
    singleAgentBaselineFailed: false,
    ...over,
  };
}

describe("dispatch gate", () => {
  it("marks exactly the four cheap single-call strategies dispatchable", () => {
    expect([...DISPATCHABLE_STRATEGIES].sort()).toEqual(
      ["direct_structured", "guided_react", "least_to_most", "plan_execute"].sort(),
    );
    expect(isDispatchableStrategy("self_consistency")).toBe(false);
    expect(isDispatchableStrategy("tree_search")).toBe(false);
    expect(isDispatchableStrategy("bounded_reflexion")).toBe(false);
  });

  it("defaults to direct_structured for simple tasks", () => {
    const d = resolveDispatchStrategy(req());
    expect(d.strategy).toBe("direct_structured");
    expect(d.rejected).toHaveLength(0);
  });

  it("rejects evaluation-only self_consistency even when its router preconditions hold", () => {
    const d = resolveDispatchStrategy(
      req({ requestedStrategy: "self_consistency", votable: true, slaTier: "low" }),
    );
    expect(d.strategy).not.toBe("self_consistency");
    expect(isDispatchableStrategy(d.strategy)).toBe(true);
    expect(d.rejected.some((r) => r.strategy === "self_consistency")).toBe(true);
    expect(d.rejected[0]!.reason).toMatch(/evaluation-only/);
  });

  it("rejects evaluation-only tree_search even with an external verifier", () => {
    const d = resolveDispatchStrategy(
      req({ requestedStrategy: "tree_search", hasExternalVerifier: true }),
    );
    expect(d.strategy).not.toBe("tree_search");
    expect(d.rejected[0]!.reason).toMatch(/evaluation-only/);
  });

  it("rejects orchestration-requiring bounded_reflexion in normal dispatch", () => {
    const d = resolveDispatchStrategy(
      req({ requestedStrategy: "bounded_reflexion", hasExternalVerifier: true }),
    );
    expect(d.strategy).not.toBe("bounded_reflexion");
    expect(d.rejected[0]!.reason).toMatch(/orchestration/);
  });

  it("allows plan_execute / least_to_most / guided_react only when the route allows", () => {
    expect(resolveDispatchStrategy(req({ requestedStrategy: "plan_execute" })).strategy).toBe(
      "plan_execute",
    );
    expect(
      resolveDispatchStrategy(req({ requestedStrategy: "least_to_most", compositional: true }))
        .strategy,
    ).toBe("least_to_most");
    // gated out without the compositional precondition
    const ltm = resolveDispatchStrategy(req({ requestedStrategy: "least_to_most" }));
    expect(ltm.strategy).not.toBe("least_to_most");
    expect(
      resolveDispatchStrategy(
        req({ requestedStrategy: "guided_react", requiresToolWorkflow: true }),
      ).strategy,
    ).toBe("guided_react");
    const gr = resolveDispatchStrategy(req({ requestedStrategy: "guided_react" }));
    expect(gr.strategy).not.toBe("guided_react");
  });
});

describe("routingRequestForNode", () => {
  const node: NodeSpec = {
    key: "synthesize",
    role: "Research Scientist",
    skill: { name: "biology-research", version: "1.2.0", sha256: "a".repeat(64) },
    goal: "Synthesize findings",
    inputArtifactTypes: ["research-brief", "comparison-table"],
    outputArtifactType: "synthesis-draft",
    toolsAllowed: ["read", "summarize"],
    resourceUrls: [],
    budget: { maxTokens: 24_000, maxCalls: 6, maxMinutes: 15, maxCostUsd: 0.5 },
    termination: { maxTurns: 8, noProgressTurns: 3, identicalActionRepeat: 2, maxReplans: 1 },
  };

  it("derives task shape from the contract (compositional, doc-action workflow, external verifier)", () => {
    const r = routingRequestForNode(node);
    expect(r.compositional).toBe(true);
    expect(r.requiresToolWorkflow).toBe(true);
    expect(r.hasExternalVerifier).toBe(true);
    expect(r.votable).toBe(false);
    expect(r.requestedStrategy).toBeUndefined();
  });

  it("carries a dispatch-eligible requested strategy through", () => {
    const r = routingRequestForNode({ ...node, promptStrategy: { id: "plan_execute" } });
    const d = resolveDispatchStrategy(r);
    expect(d.strategy).toBe("plan_execute");
  });
});

describe("compiled dispatch prompt", () => {
  it("produces degradation metadata and a concise plan, never CoT fields", () => {
    const compiled = compilePrompt({
      goal: "Summarize battery recycling economics",
      role: "Research Scientist",
      skill: {
        pin: { name: "biology-research", version: "1.2.0", sha256: "a".repeat(64) },
        body: "# Skill\n" + "x".repeat(20_000),
      },
      resources: [
        {
          id: "RL-0001",
          title: "Big excerpt",
          url: "https://example.org/big",
          excerpt: "y".repeat(5_000),
          relevance: 0.9,
          level: "excerpt",
          trust: "untrusted",
        },
      ],
      upstream: [],
      output: {
        artifactType: "research-brief",
        requiredSections: ["Summary", "Evidence", "Limitations"],
        requireCitationOrLimitation: true,
      },
      budgets: { ...PromptBudgetSchema.parse({}), maxSkillBytes: 1_000, maxResourceBytes: 500 },
      strategy: { id: "direct_structured" },
      context: { runId: 7, nodeKey: "evidence" },
    });
    expect(compiled.meta.degraded).toBe(true);
    expect(compiled.meta.truncations.length).toBeGreaterThan(0);
    expect(compiled.meta.degradationNotes.length).toBeGreaterThan(0);
    // plan steps are concise action summaries within the strict schema caps
    for (const step of compiled.plan.steps) {
      expect(step.action.length).toBeLessThanOrEqual(500);
      expect(Object.keys(step).sort()).toEqual(
        step.evidence ? ["action", "evidence", "index"] : ["action", "index"],
      );
    }
    expect(JSON.stringify(compiled)).not.toMatch(/chain-of-thought"?\s*:/i);
  });
});
