import { describe, expect, it } from "vitest";
import { defaultRunBudget, defaultNodeBudget, defaultTermination } from "@contracts/dag";
import type { DagSpec } from "@contracts/dag";
import {
  buildRunStartInput,
  classifyControlError,
  deriveMeters,
  deriveQueueRows,
  deriveStageStatuses,
  deriveWorkerViews,
  explainEligibility,
  isBudgetExhausted,
  leaseStatusFrom,
  live,
  newIdempotencyKey,
  pickActiveRun,
  providerChips,
  streamHealth,
  summarizeQueue,
  toApprovalView,
  unavailable,
  type ApprovalLike,
  type RunLike,
  type RunNodeLike,
  type WorkerLike,
} from "./adapter";

const spec: DagSpec = {
  revision: 3,
  budget: defaultRunBudget(),
  nodes: [
    {
      key: "intake",
      role: "Research Scientist",
      skill: { name: "research", version: "1.0.0", sha256: "a".repeat(64) },
      goal: "intake",
      inputArtifactTypes: [],
      outputArtifactType: "research-brief",
      toolsAllowed: ["read"],
      resourceUrls: [],
      budget: defaultNodeBudget(),
      termination: defaultTermination(),
    },
    {
      key: "synth",
      role: "Evidence Synthesizer",
      skill: { name: "synth", version: "2.0.0", sha256: "b".repeat(64) },
      goal: "synthesize",
      inputArtifactTypes: ["research-brief"],
      outputArtifactType: "synthesis-draft",
      toolsAllowed: ["read", "summarize"],
      resourceUrls: [],
      budget: defaultNodeBudget(),
      termination: defaultTermination(),
      approvalBefore: "accept",
    },
  ],
  edges: [{ from: "intake", to: "synth", kind: "artifact" }],
};

const approvals: ApprovalLike[] = [
  { id: 9, runId: 1, nodeKey: "synth", kind: "artifact-accept", payload: { criteria: "schema" } },
];

describe("deriveQueueRows", () => {
  it("maps run nodes to rows with owner, skill pin, and state", () => {
    const nodes: RunNodeLike[] = [
      { nodeKey: "intake", state: "accepted", attempts: 1 },
      { nodeKey: "synth", state: "ready", attempts: 0 },
    ];
    const rows = deriveQueueRows(nodes, spec, approvals);
    expect(rows).toHaveLength(2);
    const synth = rows.find((r) => r.nodeKey === "synth")!;
    expect(synth.awaitingHuman).toBe(true);
    expect(synth.ownerRole).toBe("Owner (you)");
    expect(synth.blockedReason).toBe("awaiting you");
    const intake = rows.find((r) => r.nodeKey === "intake")!;
    expect(intake.ownerRole).toBe("Research Scientist");
    expect(intake.skillPin).toBe("research@1.0.0");
  });

  it("names dependency blockers honestly", () => {
    const nodes: RunNodeLike[] = [
      { nodeKey: "intake", state: "running", attempts: 1 },
      { nodeKey: "synth", state: "pending", attempts: 0 },
    ];
    const rows = deriveQueueRows(nodes, spec, []);
    const synth = rows.find((r) => r.nodeKey === "synth")!;
    expect(synth.blockedReason).toBe("awaits 1 input");
  });

  it("includes unscheduled plan nodes and marks leases unavailable", () => {
    const rows = deriveQueueRows([], spec, []);
    expect(rows).toHaveLength(2);
    expect(rows[0]!.state).toBe("unscheduled");
    expect(rows[0]!.lease.status).toBe("unavailable");
  });

  it("maps assignment, wait reason, version and dependencies from control rows", () => {
    const nodes: RunNodeLike[] = [
      { nodeKey: "intake", state: "running", attempts: 1, version: 4 },
      {
        nodeKey: "synth",
        state: "waiting",
        attempts: 0,
        version: 2,
        waitReason: "dependency",
        assignedWorkerId: 7,
        assignmentMode: "director",
      },
    ];
    const rows = deriveQueueRows(nodes, spec, [], undefined, {
      workerName: (id) => (id === 7 ? "synthesizer-1" : undefined),
    });
    const synth = rows.find((r) => r.nodeKey === "synth")!;
    expect(synth.version).toBe(2);
    expect(synth.assignedWorkerId).toBe(7);
    expect(synth.assignedWorkerName).toBe("synthesizer-1");
    expect(synth.assignmentMode).toBe("director");
    expect(synth.waitReason).toBe("dependency");
    expect(synth.blockedReason).toBe("waiting on intake");
    expect(synth.dependencies).toEqual({ total: 1, unmet: 1, unmetKeys: ["intake"] });
    const intake = rows.find((r) => r.nodeKey === "intake")!;
    expect(intake.assignedWorkerName).toBeNull();
    expect(intake.dependencies.unmet).toBe(0);
  });

  it("falls back to worker #id when the name is unknown", () => {
    const rows = deriveQueueRows(
      [{ nodeKey: "intake", state: "ready", attempts: 0, assignedWorkerId: 99 }],
      spec,
      [],
    );
    expect(rows[0]!.assignedWorkerName).toBe("worker #99");
  });

  it("threads live leases through the leaseFor feed", () => {
    const rows = deriveQueueRows(
      [{ nodeKey: "intake", state: "claimed", attempts: 1 }],
      spec,
      [],
      (key) =>
        key === "intake"
          ? live({
              holder: "director",
              heartbeatAgeSec: 3,
              expiresInSec: 117,
              stale: false,
            })
          : unavailable("no active lease"),
    );
    expect(rows[0]!.lease.status).toBe("live");
  });
});

describe("summarizeQueue", () => {
  it("counts running, blocked, awaiting-human, done", () => {
    const rows = deriveQueueRows(
      [
        { nodeKey: "intake", state: "running", attempts: 2 },
        { nodeKey: "synth", state: "ready", attempts: 0 },
      ],
      spec,
      approvals,
    );
    const c = summarizeQueue(rows);
    expect(c.running).toBe(1);
    expect(c.awaitingHuman).toBe(1);
    expect(c.done).toBe(0);
  });
});

describe("deriveMeters / isBudgetExhausted", () => {
  const run: RunLike = {
    id: 1,
    projectId: 1,
    mode: "mock",
    provider: "mock",
    model: null,
    state: "running",
    budget: defaultRunBudget(),
    endReason: null,
    startedAt: new Date(0),
  };

  it("labels mock USD as simulated", () => {
    const meters = deriveMeters(
      { promptTokens: 100, completionTokens: 50, calls: 1, elapsedMinutes: 1, costUsdMicros: 500, simulated: true },
      run.budget,
      "mock",
    );
    expect(meters.find((m) => m.key === "usd")!.label).toContain("simulated");
  });

  it("flags exhaustion on any dimension and on stopped_budget", () => {
    const maxed = {
      promptTokens: run.budget.maxTokens,
      completionTokens: 0,
      calls: 0,
      elapsedMinutes: 0,
      costUsdMicros: 0,
      simulated: false,
    };
    expect(isBudgetExhausted(run, maxed)).toBe(true);
    expect(
      isBudgetExhausted({ ...run, state: "stopped_budget" }, null),
    ).toBe(true);
    expect(isBudgetExhausted(run, { ...maxed, promptTokens: 10 })).toBe(false);
  });
});

describe("deriveStageStatuses", () => {
  it("marks control stage attention when approvals are pending", () => {
    const stages = deriveStageStatuses({
      project: null,
      roadmap: {
        revisionId: 1,
        revision: 3,
        approved: true,
        planHash: "abc",
        nodeCount: 2,
        edgeCount: 1,
        spec,
      },
      activeRun: null,
      queueCounts: { running: 1, blocked: 0, awaitingHuman: 1, done: 0 },
      pendingApprovals: 1,
      artifacts: { total: 2, reviewed: 1, storageErrors: 1 },
      budgetUsedPct: 40,
    });
    expect(stages.find((s) => s.id === "control")!.attention).toBe(true);
    expect(stages.find((s) => s.id === "evidence")!.sub).toContain("1 storage error");
    expect(stages.find((s) => s.id === "queue")!.sub).toContain("1 running");
  });
});

describe("toApprovalView", () => {
  it("extracts escalation options and caps the excerpt at 3 lines", () => {
    const v = toApprovalView({
      id: 1,
      runId: 2,
      nodeKey: "n",
      kind: "external-action",
      payload: { a: 1, b: 2, c: 3, d: 4, options: ["retry", "reassign"] },
    });
    expect(v.options).toEqual(["retry", "reassign"]);
    expect(v.excerpt.split("\n").length).toBeLessThanOrEqual(3);
  });
});

describe("streamHealth", () => {
  it("distinguishes waiting, flowing, and stale", () => {
    expect(streamHealth([], "running", null, 1000).kind).toBe("waiting");
    const ev = [{ seq: 1, type: "run_started", nodeKey: null, actor: "system", payload: {} }];
    expect(streamHealth(ev, "running", 1000, 2000).kind).toBe("flowing");
    const stale = streamHealth(ev, "running", 0, 60_000);
    expect(stale.kind).toBe("stale");
    // terminal runs never report stale
    expect(streamHealth(ev, "completed", 0, 60_000).kind).toBe("flowing");
  });
});

describe("providerChips / pickActiveRun", () => {
  it("labels providers honestly", () => {
    const chips = providerChips([
      { id: "gateway", configured: true },
      { id: "openai", configured: false, reason: "no key" },
      { id: "mock", configured: true },
    ]);
    expect(chips.find((c) => c.id === "openai")!.label).toContain("unconfigured");
    expect(chips.find((c) => c.id === "mock")!.label).toContain("simulated");
    expect(chips.find((c) => c.id === "gateway")!.tone).toBe("ok");
  });

  it("prefers the focused run, then non-terminal, then latest", () => {
    const mk = (id: number, state: RunLike["state"]): RunLike => ({
      id,
      projectId: 1,
      mode: "mock",
      provider: "mock",
      model: null,
      state,
      budget: defaultRunBudget(),
      endReason: null,
      startedAt: new Date(0),
    });
    const runs = [mk(3, "completed"), mk(2, "running"), mk(1, "failed")];
    expect(pickActiveRun(runs)!.id).toBe(2);
    expect(pickActiveRun(runs, 1)!.id).toBe(1);
    expect(pickActiveRun([mk(3, "completed")])!.id).toBe(3);
    expect(pickActiveRun([])).toBeNull();
  });

  it("unavailable() carries the reason through", () => {
    const u = unavailable<string>("nope");
    expect(u.status).toBe("unavailable");
    if (u.status === "unavailable") expect(u.reason).toBe("nope");
  });
});

// ── Control plane (Revision A): workers, leases, errors ──

const NOW = 1_000_000;

const worker = (over: Partial<WorkerLike> = {}): WorkerLike => ({
  id: 1,
  name: "researcher-1",
  kind: "subagent",
  role: "Research Scientist",
  capabilities: ["read"],
  skillRefs: [{ name: "research", version: "1.0.0" }],
  status: "active",
  maxConcurrentClaims: 2,
  leaseTtlSeconds: 120,
  lastSeenAt: new Date(NOW - 10_000),
  ...over,
});

describe("leaseStatusFrom", () => {
  it("marks an expired lease stale with negative expiry", () => {
    const l = leaseStatusFrom(
      "researcher-1",
      new Date(NOW - 200_000),
      new Date(NOW - 5_000),
      NOW,
    );
    expect(l.stale).toBe(true);
    expect(l.expiresInSec).toBeLessThan(0);
    expect(l.heartbeatAgeSec).toBe(200);
  });

  it("handles a live lease", () => {
    const l = leaseStatusFrom("director", new Date(NOW - 3_000), new Date(NOW + 90_000), NOW);
    expect(l.stale).toBe(false);
    expect(l.expiresInSec).toBe(90);
    expect(l.heartbeatAgeSec).toBe(3);
  });
});

describe("explainEligibility (mirrors the server)", () => {
  const node = spec.nodes[0]!; // intake: Research Scientist, research@1.0.0, tools ["read"]

  it("accepts a matching active subagent", () => {
    expect(
      explainEligibility(worker(), node, { depsAccepted: true, startApproved: true }),
    ).toBeNull();
  });

  it("flags suspension, deps, role, pin, and capability failures", () => {
    expect(
      explainEligibility(worker({ status: "suspended" }), node, {
        depsAccepted: true,
        startApproved: true,
      }),
    ).toBe("worker_suspended");
    expect(
      explainEligibility(worker(), node, { depsAccepted: false, startApproved: true }),
    ).toBe("dependencies_unmet");
    expect(
      explainEligibility(worker({ role: "Evidence Synthesizer" }), node, {
        depsAccepted: true,
        startApproved: true,
      }),
    ).toBe("role_mismatch");
    expect(
      explainEligibility(worker({ skillRefs: [] }), node, {
        depsAccepted: true,
        startApproved: true,
      }),
    ).toBe("skill_pin_mismatch");
    expect(
      explainEligibility(worker({ capabilities: [] }), node, {
        depsAccepted: true,
        startApproved: true,
      }),
    ).toBe("capability_mismatch");
  });

  it("director skips role/pin checks; assignment pins gate other workers", () => {
    expect(
      explainEligibility(worker({ kind: "director", role: "director", skillRefs: [] }), node, {
        depsAccepted: true,
        startApproved: true,
      }),
    ).toBeNull();
    expect(
      explainEligibility(worker({ id: 2 }), node, {
        depsAccepted: true,
        startApproved: true,
        assignedWorkerId: 9,
        workerId: 2,
      }),
    ).toBe("assigned_to_another_worker");
    expect(
      explainEligibility(worker({ id: 2 }), node, {
        depsAccepted: true,
        startApproved: true,
        assignmentMode: "director",
        workerId: 2,
      }),
    ).toBe("director_mode_only");
  });
});

describe("deriveWorkerViews", () => {
  const nodes: RunNodeLike[] = [
    { nodeKey: "intake", state: "ready", attempts: 0 },
    { nodeKey: "synth", state: "running", attempts: 1, leaseWorkerId: 1 },
  ];

  it("computes claims, capacity, staleness and per-node eligibility", () => {
    const views = deriveWorkerViews(
      [
        worker({ id: 1 }),
        worker({
          id: 2,
          name: "idle-mismatch",
          role: "Evidence Synthesizer",
          skillRefs: [{ name: "synth", version: "2.0.0" }],
          capabilities: ["read", "summarize"],
          lastSeenAt: new Date(NOW - 400_000), // stale (> 120s ttl)
        }),
      ],
      nodes,
      spec,
      { now: NOW },
    );
    const w1 = views.find((v) => v.id === 1)!;
    expect(w1.activeClaims).toBe(1);
    expect(w1.claimedNodeKeys).toEqual(["synth"]);
    expect(w1.atCapacity).toBe(false);
    expect(w1.stale).toBe(false);
    expect(w1.lastSeenAgeSec).toBe(10);
    expect(w1.claimableNodeKeys).toEqual(["intake"]);

    const w2 = views.find((v) => v.id === 2)!;
    expect(w2.stale).toBe(true);
    expect(w2.eligibilityFailures).toEqual([
      { nodeKey: "intake", reason: "role_mismatch", label: "role mismatch" },
    ]);
    expect(w2.claimableNodeKeys).toEqual([]);
  });

  it("marks full workers at capacity and suspended workers ineligible", () => {
    const views = deriveWorkerViews(
      [worker({ id: 1, maxConcurrentClaims: 1, status: "suspended" })],
      nodes,
      spec,
      { now: NOW },
    );
    expect(views[0]!.atCapacity).toBe(true);
    expect(views[0]!.suspended).toBe(true);
    expect(views[0]!.eligibilityFailures[0]!.reason).toBe("worker_suspended");
  });

  it("treats a pending start approval as a gate for ready nodes", () => {
    const gatedSpec = {
      ...spec,
      nodes: [{ ...spec.nodes[0]!, approvalBefore: "start" as const }, spec.nodes[1]!],
    };
    const views = deriveWorkerViews([worker()], [nodes[0]!], gatedSpec, {
      now: NOW,
      pendingStartApprovals: new Set(["intake"]),
    });
    expect(views[0]!.eligibilityFailures[0]!.reason).toBe("awaiting_start_approval");
  });
});

describe("classifyControlError", () => {
  const trpcLike = (code: string, httpStatus: number, message: string) => {
    const e = new Error(message) as Error & { data: { code: string; httpStatus: number } };
    e.data = { code, httpStatus };
    return e;
  };

  it("maps 409 claim conflicts to recoverable with refresh guidance", () => {
    const c = classifyControlError(trpcLike("CONFLICT", 409, "node was claimed by another worker"));
    expect(c.kind).toBe("conflict");
    expect(c.recoverable).toBe(true);
  });

  it("distinguishes version_conflict and fenced leases", () => {
    const v = classifyControlError(
      trpcLike("CONFLICT", 409, "version_conflict: node is at version 5, expected 4"),
    );
    expect(v.kind).toBe("conflict");
    expect(v.hint).toContain("refreshed");
    const f = classifyControlError(
      trpcLike("CONFLICT", 409, "lease token is invalid, expired, or revoked (fenced)"),
    );
    expect(f.kind).toBe("stale-lease");
    expect(f.recoverable).toBe(true);
  });

  it("maps paused and terminal to distinct kinds", () => {
    expect(
      classifyControlError(new Error("run is paused — resume it before pumping")).kind,
    ).toBe("paused");
    const t = classifyControlError(new Error("run is terminal — nothing to pump"));
    expect(t.kind).toBe("terminal");
    expect(t.recoverable).toBe(false);
  });

  it("maps forbidden and falls back to unknown-but-honest", () => {
    expect(classifyControlError(trpcLike("FORBIDDEN", 403, "worker is not in this project")).kind).toBe(
      "forbidden",
    );
    const u = classifyControlError(new Error("socket hangup"));
    expect(u.kind).toBe("unknown");
    expect(u.hint).toContain("Nothing was faked");
  });
});

describe("newIdempotencyKey", () => {
  it("is unique, scoped, and within the server limit", () => {
    const a = newIdempotencyKey("pump");
    const b = newIdempotencyKey("pump");
    expect(a).not.toBe(b);
    expect(a.startsWith("dw:pump:")).toBe(true);
    expect(a.length).toBeLessThanOrEqual(128);
  });
});


describe("buildRunStartInput", () => {
  const base = { projectId: 7, dagRevisionId: 42, provider: "mock" as const };

  it("always includes goalMode and includes an eligible project-scoped grant", () => {
    const mock = buildRunStartInput({
      ...base,
      mode: "mock",
      goalMode: "evaluate",
      activeGrant: { id: 101, scope: "project" },
    });
    expect(mock).toEqual({
      projectId: 7,
      dagRevisionId: 42,
      mode: "mock",
      provider: "mock",
      goalMode: "evaluate",
      autonomyGrantId: 101,
    });
    const live = buildRunStartInput({
      ...base,
      mode: "live",
      goalMode: "build",
      activeGrant: { id: 101, scope: "project" },
      confirmLive: true,
    });
    expect(live).toMatchObject({
      mode: "live",
      goalMode: "build",
      autonomyGrantId: 101,
      confirmLive: true,
    });
  });

  it("omits run-scoped grants (bound to a different run) and absent grants", () => {
    const runScoped = buildRunStartInput({
      ...base,
      mode: "mock",
      goalMode: "explore",
      activeGrant: { id: 202, scope: "run" },
    });
    expect(runScoped.goalMode).toBe("explore");
    expect("autonomyGrantId" in runScoped).toBe(false);
    const none = buildRunStartInput({ ...base, mode: "mock", goalMode: "operate", activeGrant: null });
    expect("autonomyGrantId" in none).toBe(false);
    expect("confirmLive" in none).toBe(false);
  });
});
