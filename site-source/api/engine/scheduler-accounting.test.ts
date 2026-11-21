import { beforeEach, describe, expect, it, vi } from "vitest";
import { artifacts, approvals, budgetLedger, runNodes, runs, type Run, type RunNode } from "@db/schema";
import { defaultNodeBudget, defaultRunBudget, defaultTermination, type DagSpec, type NodeSpec } from "@contracts/dag";
import type { UsageRecord } from "@contracts/run";
import { mockArtifactObject } from "./mock";

// The DB, provider and storage are test doubles; the real scheduler and pricing
// execute. These tests are offline transition regressions, not MySQL integration.
const seams = vi.hoisted(() => ({ db: {} as unknown, events: [] as Array<{ type: string; payload: Record<string, unknown> }>, generate: vi.fn(), upload: vi.fn() }));
vi.mock("../queries/connection", () => ({ getDb: () => seams.db }));
vi.mock("../ai/provider", () => ({ getProvider: async () => ({ id: "openai", generateStructured: seams.generate }) }));
vi.mock("../lib/storage", () => ({ storage: { uploadFile: seams.upload } }));
vi.mock("./events", () => ({ appendEvent: async (_runId: number, event: { type: string; payload: Record<string, unknown> }) => { seams.events.push(event); return { seq: seams.events.length }; } }));
const { advanceRun } = await import("./scheduler");

let run: Run;
let row: RunNode;
let spec: DagSpec;
let savedArtifacts: Array<Record<string, unknown>>;
let ledger: Array<{ tokensPrompt: number; tokensCompletion: number; calls: number; costUsdMicros: number }>;
const completeUsage: UsageRecord = { promptTokens: 1000, completionTokens: 50, calls: 1, costUsdMicros: 0, simulated: false, usageReported: true, cacheReadPromptTokens: 700, cacheWritePromptTokens: 100, cacheBreakdownComplete: true };

beforeEach(() => {
  const node: NodeSpec = { key: "research", role: "Research Scientist", goal: "Private owner goal", skill: { name: "research", version: "1", sha256: "a".repeat(64) }, inputArtifactTypes: [], outputArtifactType: "research-brief", toolsAllowed: ["read"], resourceUrls: [], budget: defaultNodeBudget(), termination: defaultTermination() };
  spec = { revision: 1, nodes: [node], edges: [], budget: defaultRunBudget() };
  run = { id: 7, projectId: 1, dagRevisionId: 1, mode: "live", provider: "openai", model: "test-model", state: "running", budget: spec.budget, startedBy: 1, startedAt: new Date(), endedAt: null, endReason: null };
  row = { id: 1, runId: 7, nodeKey: node.key, agentId: 1, contract: node, state: "pending", attempts: 0, tokensUsed: 0, callsUsed: 0, startedAt: null, endedAt: null };
  savedArtifacts = [];
  ledger = [];
  seams.events = [];
  seams.generate.mockReset().mockResolvedValue({ object: mockArtifactObject("fixture", "research-brief", node.goal, []), usage: completeUsage, provider: "openai", model: "test-model" });
  seams.upload.mockReset().mockResolvedValue({ key: "stored/result.md" });
  seams.db = {
    query: {
      runs: { findFirst: async () => ({ ...run }) },
      runNodes: { findFirst: async () => ({ ...row }) },
      dagRevisions: { findFirst: async () => ({ spec }) },
      skills: { findFirst: async () => ({ status: "vetted", contentSha256: node.skill.sha256, bodyText: "Reviewed instructions" }) },
      approvals: { findFirst: async () => undefined },
      ownerSettings: { findFirst: async () => ({ value: { inputUsdPerMillion: 3, outputUsdPerMillion: 15, cacheReadUsdPerMillion: 0.3, cacheWriteUsdPerMillion: 3.75 } }) },
    },
    select: () => ({ from: (table: unknown) => ({ where: async () => {
      if (table === runNodes) return [{ ...row }];
      if (table === budgetLedger) return [{ prompt: ledger.reduce((n, l) => n + l.tokensPrompt, 0), completion: ledger.reduce((n, l) => n + l.tokensCompletion, 0), calls: ledger.reduce((n, l) => n + l.calls, 0), cost: ledger.reduce((n, l) => n + l.costUsdMicros, 0) }];
      throw new Error("Unexpected select in scheduler fixture");
    } }) }),
    insert: (table: unknown) => ({ values: async (value: Record<string, unknown>) => {
      if (table === artifacts) savedArtifacts.push({ ...value, id: 1 });
      else if (table === budgetLedger) ledger.push(value as typeof ledger[number]);
      else if (table !== approvals) throw new Error("Unexpected insert in scheduler fixture");
      return [{ insertId: 1 }];
    } }),
    update: (table: unknown) => ({ set: (value: Record<string, unknown>) => ({ where: async () => {
      if (table === runs) Object.assign(run, value);
      else if (table === runNodes) Object.assign(row, value);
      else if (table === artifacts) Object.assign(savedArtifacts[0]!, value);
      else throw new Error("Unexpected update in scheduler fixture");
    } }) }),
  };
});

describe("scheduler preserves outputs and reconciles cache accounting", () => {
  it("accepts a valid output with category-aware accounting and content-free diagnostics", async () => {
    await advanceRun(run.id);
    expect(run.state).toBe("completed");
    expect(savedArtifacts[0]!.accepted).toBe(true);
    expect(ledger[0]!.costUsdMicros).toBe(1935);
    expect(seams.generate).toHaveBeenCalledTimes(1);
    const prepared = seams.events.find((event) => event.type === "prompt_prepared")!;
    expect(prepared.payload.providerCacheRequested).toBe(true);
    expect(JSON.stringify(prepared.payload)).not.toContain("Private owner goal");
  });

  it("stores the generated artifact before blocking missing usage, without accepting it", async () => {
    seams.generate.mockResolvedValueOnce({ object: mockArtifactObject("fixture", "research-brief", "Goal", []), usage: { promptTokens: 0, completionTokens: 0, calls: 1, costUsdMicros: 0, simulated: false, usageReported: false }, model: "test-model" });
    await advanceRun(run.id);
    expect(seams.upload).toHaveBeenCalledTimes(1);
    expect(savedArtifacts[0]).toMatchObject({ storageKey: "stored/result.md", accepted: false });
    expect(run).toMatchObject({ state: "failed", endReason: "usage_or_cache_pricing_unknown" });
    const created = seams.events.findIndex((event) => event.type === "artifact_created");
    const blocked = seams.events.findIndex((event) => event.type === "budget_blocked");
    expect(created).toBeGreaterThan(-1);
    expect(blocked).toBeGreaterThan(created);
    expect(seams.events.find((event) => event.type === "budget_recorded")!.payload.pricingStatus).toBe("unknown");
  });

  it("does not bypass explicit acceptance approval when a call exhausts its budget", async () => {
    spec.nodes[0]!.approvalBefore = "accept";
    spec.nodes[0]!.budget.maxCalls = 1;
    await advanceRun(run.id);
    expect(savedArtifacts[0]!.accepted).toBe(false);
    expect(row.state).toBe("verifying");
    expect(run).toMatchObject({ state: "stopped_budget", endReason: "node:calls" });
  });

  it("enforces the node dollar cap independently of the larger run cap", async () => {
    spec.nodes[0]!.budget.maxCostUsd = 0.001;
    await advanceRun(run.id);
    expect(savedArtifacts[0]!.storageKey).toBe("stored/result.md");
    expect(run).toMatchObject({ state: "stopped_budget", endReason: "node:costUsd" });
  });

  it("records real storage failure and never accepts an inaccessible artifact", async () => {
    seams.upload.mockRejectedValueOnce(Object.assign(new Error("storage unavailable"), { code: "STORAGE_NOT_PROVISIONED" }));
    await advanceRun(run.id);
    expect(savedArtifacts[0]).toMatchObject({ accepted: false, storageKey: null, storageError: "STORAGE_NOT_PROVISIONED" });
    expect(run.state).toBe("failed");
    expect(seams.events.some((event) => event.type === "artifact_created")).toBe(false);
  });
});
