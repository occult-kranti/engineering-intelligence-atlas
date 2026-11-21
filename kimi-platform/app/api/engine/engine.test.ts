import "dotenv/config";
import { describe, expect, it } from "vitest";
import { validateDag, type ValidationContext } from "./dag-validate";
import type { DagSpec } from "@contracts/dag";
import { defaultNodeBudget, defaultRunBudget, defaultTermination } from "@contracts/dag";
import { mockGenerateStructured } from "./mock";
import { priceUsage } from "./pricing";
import { runBudgetOverrun, nodeBudgetOverrun } from "./scheduler";
import { ArtifactObjectSchema, checkArtifactAcceptance } from "@contracts/artifacts";
import { listGatewayModels } from "../ai/list-models";
import { AiUnavailable, classifyAiError } from "../ai/ai-client";

const SKILL = {
  name: "agent-research-director",
  version: "0.0.0",
  sha256: "a".repeat(64),
};

const baseCtx: ValidationContext = {
  resolveSkill: async (name, version) =>
    name === SKILL.name && version === SKILL.version
      ? {
          status: "vetted",
          contentSha256: SKILL.sha256,
          toolsAllowed: ["read", "summarize", "compare", "cite", "classify", "synthesize"],
        }
      : null,
  roleExists: async (name) => name === "Research Scientist",
  resourceExists: async (url) => url === "https://sfia-online.org/en/sfia-9",
};

function node(
  key: string,
  over: Partial<DagSpec["nodes"][number]> = {},
): DagSpec["nodes"][number] {
  return {
    key,
    role: "Research Scientist",
    skill: { ...SKILL },
    goal: `task ${key}`,
    inputArtifactTypes: [],
    outputArtifactType: "research-brief",
    toolsAllowed: ["read"],
    resourceUrls: [],
    budget: defaultNodeBudget(),
    termination: defaultTermination(),
    ...over,
  };
}

function spec(nodes: DagSpec["nodes"], edges: DagSpec["edges"]): DagSpec {
  return { revision: 1, nodes, edges, budget: defaultRunBudget() };
}

describe("DAG validation (spec §6.2)", () => {
  it("accepts a valid chain", async () => {
    const s = spec(
      [node("a"), node("b", { inputArtifactTypes: ["research-brief"] })],
      [{ from: "a", to: "b", kind: "artifact" }],
    );
    const r = await validateDag(s, baseCtx);
    expect(r.violations).toEqual([]);
    expect(r.ok).toBe(true);
  });
  it("rejects cycles, never resolves them", async () => {
    const s = spec(
      [node("a"), node("b")],
      [
        { from: "a", to: "b", kind: "artifact" },
        { from: "b", to: "a", kind: "artifact" },
      ],
    );
    const r = await validateDag(s, baseCtx);
    expect(r.ok).toBe(false);
    expect(r.violations.some((v) => v.rule === "acyclicity")).toBe(true);
  });
  it("rejects duplicate node keys", async () => {
    const r = await validateDag(spec([node("a"), node("a")], []), baseCtx);
    expect(r.violations.some((v) => v.rule === "unique-keys")).toBe(true);
  });
  it("rejects dangling edges", async () => {
    const r = await validateDag(
      spec([node("a")], [{ from: "a", to: "ghost", kind: "artifact" }]),
      baseCtx,
    );
    expect(r.violations.some((v) => v.rule === "referential-integrity")).toBe(true);
  });
  it("rejects unvetted skills and hash drift", async () => {
    const badHash = await validateDag(
      spec([node("a", { skill: { ...SKILL, sha256: "b".repeat(64) } })], []),
      baseCtx,
    );
    expect(badHash.violations.some((v) => v.rule === "skill-pin")).toBe(true);
    const quarantined: ValidationContext = {
      ...baseCtx,
      resolveSkill: async () => ({
        status: "quarantined",
        contentSha256: SKILL.sha256,
        toolsAllowed: ["read"],
      }),
    };
    const r2 = await validateDag(spec([node("a")], []), quarantined);
    expect(r2.violations.some((v) => v.rule === "skill-pin")).toBe(true);
  });
  it("rejects tool widening beyond the skill manifest", async () => {
    const narrowCtx: ValidationContext = {
      ...baseCtx,
      resolveSkill: async () => ({
        status: "vetted",
        contentSha256: SKILL.sha256,
        toolsAllowed: ["read"],
      }),
    };
    const r = await validateDag(
      spec([node("a", { toolsAllowed: ["read", "synthesize"] })], []),
      narrowCtx,
    );
    expect(r.violations.some((v) => v.rule === "capability-scope")).toBe(true);
  });
  it("rejects node budgets exceeding run budgets and unknown roles", async () => {
    const r = await validateDag(
      spec(
        [
          node("a", {
            role: "Nobody",
            budget: { ...defaultNodeBudget(), maxTokens: 500_000 },
          }),
        ],
        [],
      ),
      baseCtx,
    );
    expect(r.violations.some((v) => v.rule === "budget-sanity")).toBe(true);
    expect(r.violations.some((v) => v.rule === "role-reference")).toBe(true);
  });
  it("rejects contract-typing breaks (missing upstream producer)", async () => {
    const r = await validateDag(
      spec([node("a", { inputArtifactTypes: ["comparison-table"] })], []),
      baseCtx,
    );
    expect(r.violations.some((v) => v.rule === "contract-typing")).toBe(true);
  });
});

describe("mock provider determinism", () => {
  const req = {
    system: "ARTIFACT_TYPE: research-brief",
    prompt: "NODE_GOAL: x\nRUN_ID: 1\nRESOURCE: https://sfia-online.org/en/sfia-9",
    schema: ArtifactObjectSchema,
    maxOutputTokens: 1000,
    artifactType: "research-brief",
  };
  it("same (run seed, node, attempt) → byte-identical artifact", async () => {
    const a = await mockGenerateStructured(req);
    const b = await mockGenerateStructured(req);
    expect(JSON.stringify(a.object)).toBe(JSON.stringify(b.object));
    expect(a.usage.simulated).toBe(true); // labeled mock cents
  });
  it("mock output passes deterministic acceptance checks", async () => {
    const { object } = await mockGenerateStructured(req);
    const o = object as { markdown: string };
    expect(checkArtifactAcceptance("research-brief", o.markdown).ok).toBe(true);
  });
  it("scripted failure is reproducible", async () => {
    const failing = { ...req, prompt: "NODE_GOAL: x [mock:fail]" };
    await expect(mockGenerateStructured(failing)).rejects.toThrow("mock failure");
  });
});

describe("budget enforcement math (tokens / calls / minutes / dollars)", () => {
  it("token overrun", () => {
    const run = { budget: defaultRunBudget() } as Parameters<typeof runBudgetOverrun>[0];
    expect(
      runBudgetOverrun(run, {
        promptTokens: 150_000,
        completionTokens: 60_000,
        calls: 0,
        costUsdMicros: 0,
        elapsedMinutes: 0,
      }),
    ).toBe("tokens");
  });
  it("minute overrun (elapsed-time deadline)", () => {
    const run = { budget: defaultRunBudget() } as Parameters<typeof runBudgetOverrun>[0];
    expect(
      runBudgetOverrun(run, {
        promptTokens: 0,
        completionTokens: 0,
        calls: 0,
        costUsdMicros: 0,
        elapsedMinutes: 61,
      }),
    ).toBe("minutes");
  });
  it("dollar overrun from configured rates", () => {
    const micros = priceUsage(
      { promptTokens: 1_000_000, completionTokens: 1_000_000 },
      { inputUsdPerMillion: 3, outputUsdPerMillion: 15, source: "owner" },
    );
    expect(micros).toBe(18_000_000); // $18 exactly
    const run = {
      budget: { ...defaultRunBudget(), maxCostUsd: 10 },
    } as Parameters<typeof runBudgetOverrun>[0];
    expect(
      runBudgetOverrun(run, {
        promptTokens: 0,
        completionTokens: 0,
        calls: 0,
        costUsdMicros: micros,
        elapsedMinutes: 0,
      }),
    ).toBe("costUsd");
  });
  it("node budget checks tokens/calls/minutes", () => {
    const specNode = node("a");
    const over = nodeBudgetOverrun(
      { tokensUsed: 24_000, callsUsed: 0, startedAt: null } as never,
      specNode,
    );
    expect(over).toBe("tokens");
    const overMin = nodeBudgetOverrun(
      {
        tokensUsed: 0,
        callsUsed: 0,
        startedAt: new Date(Date.now() - 20 * 60_000),
      } as never,
      specNode,
    );
    expect(overMin).toBe("minutes");
  });
});

describe("AI error classification (degradation copy mapping)", () => {
  it("403 access_terminated → AiUnavailable (quota)", () => {
    const err = classifyAiError({
      status: 403,
      responseBody: JSON.stringify({ error: { type: "access_terminated_error" } }),
    });
    expect(err).toBeInstanceOf(AiUnavailable);
  });
  it("429 → retryable transient (engine still never auto-retries billable calls)", () => {
    const err = classifyAiError({ status: 429, responseBody: "{}" });
    expect(err.name).toBe("AiTransient");
  });
});

describe("gateway model discovery (if provisioned)", () => {
  it("listModels returns a defaultModelId — never hardcoded", async () => {
    if (!process.env.KIMI_AGENTGW_API_KEY) {
      console.warn("gateway not provisioned; skipping");
      return;
    }
    const list = await listGatewayModels();
    expect(list.defaultModelId.length).toBeGreaterThan(0);
  });
});
