import { describe, expect, it } from "vitest";
import {
  classifyReassignError,
  classifyWbSaveError,
  decodeOwnershipEdgeKey,
  encodeOwnershipEdgeKey,
  emergencyStopConfirmable,
  grantLifecycle,
  grantRequestBlockers,
  mapOfficeStatus,
  mapServerDrift,
  parseGoalModePreset,
  planOfficeMove,
  wbDocFromBackend,
  wbOpsFromDiff,
  type BackendWbDoc,
  type OfficeStatusLike,
} from "./officeAdapter";
import { deriveSetupChecklist, rebaseWhiteboard } from "./derive";

/**
 * Live-wiring tests: office mapping, move planning + conflict
 * classification, observed setup checklist, whiteboard doc mapping + op
 * diff + OCC conflict/rebase + export error classification, goal-mode
 * model rejection, autonomy ineligible/expired/over-budget states, and the
 * emergency-stop gate.
 */

const NOW = Date.parse("2026-11-21T00:00:00Z");

function statusFixture(): OfficeStatusLike {
  return {
    blueprint: { id: 7, revision: 1, version: 1 },
    permanentWorkers: [
      { id: 90, name: "blueprint-ops", role: "blueprint-ops", roomKey: "operations" },
    ],
    rooms: [
      {
        id: 11,
        key: "operations",
        name: "Operations Deck",
        kind: "ops",
        capacity: 2,
        eligibleRolePatterns: ["ops", "cartographer"],
        budgets: {
          maxTokens: 100_000,
          maxCalls: 50,
          maxMinutes: 60,
          maxCostUsd: 10,
          maxStorageBytes: 5_000_000,
        },
        version: 3,
        occupancy: 1,
        usage: { tokens: 4000, calls: 2, minutes: 1, costUsdMicros: 250_000, storageBytes: 100_000 },
        health: { level: "healthy", reasons: [] },
        seats: [{ assignmentId: 501, workerId: 90, runId: null, nodeKey: null, version: 1 }],
      },
      {
        id: 12,
        key: "studio",
        name: "Studio",
        kind: "studio",
        capacity: 2,
        eligibleRolePatterns: ["writer"],
        budgets: {
          maxTokens: 200_000,
          maxCalls: 50,
          maxMinutes: 60,
          maxCostUsd: 20,
          maxStorageBytes: 5_000_000,
        },
        version: 1,
        occupancy: 1,
        usage: { tokens: 0, calls: 0, minutes: 0, costUsdMicros: 0, storageBytes: 0 },
        health: { level: "healthy", reasons: [] },
        seats: [{ assignmentId: 502, workerId: 42, runId: null, nodeKey: null, version: 1 }],
      },
    ],
  };
}

const WORKERS = [
  {
    id: 1,
    name: "director",
    kind: "director",
    role: "director",
    capabilities: [],
    skillRefs: [],
    status: "active",
    maxConcurrentClaims: 1,
    leaseTtlSeconds: 120,
    lastSeenAt: new Date(NOW - 5000),
    roomKey: null,
    version: 1,
  },
  {
    id: 90,
    name: "blueprint-ops",
    kind: "subagent",
    role: "blueprint-ops",
    capabilities: ["read"],
    skillRefs: [],
    status: "active",
    maxConcurrentClaims: 1,
    leaseTtlSeconds: 120,
    lastSeenAt: new Date(NOW - 3000),
    roomKey: "operations",
    version: 2,
  },
  {
    id: 42,
    name: "writer-1",
    kind: "subagent",
    role: "writer",
    capabilities: ["read", "summarize"],
    skillRefs: [{ name: "brief", version: "1.0.0", sha256: "a".repeat(64) }],
    status: "active",
    maxConcurrentClaims: 2,
    leaseTtlSeconds: 120,
    lastSeenAt: new Date(NOW - 10_000),
    roomKey: "studio",
    version: 5,
  },
  {
    id: 43,
    name: "bench-warmer",
    kind: "subagent",
    role: "writer",
    capabilities: [],
    skillRefs: [],
    status: "active",
    maxConcurrentClaims: 1,
    leaseTtlSeconds: 120,
    lastSeenAt: new Date(NOW - 1000),
    roomKey: null,
    version: 1,
  },
];

const NODES = [
  { nodeKey: "task-a", state: "running", attempts: 1, leaseWorkerId: 42, roomKey: "studio" },
  { nodeKey: "task-b", state: "ready", attempts: 0, assignedWorkerId: 42, roomKey: "studio" },
  { nodeKey: "task-c", state: "failed", attempts: 3, roomKey: "studio" },
];

describe("office mapping (office.status → blueprint view model)", () => {
  it("maps rooms, seats, bench, tasks, and budgets from live payloads", () => {
    const bp = mapOfficeStatus(statusFixture(), WORKERS, NODES, {
      now: NOW,
      runMode: "live",
      runBudgetUsdMicros: 100_000_000,
    });
    expect(bp.rooms).toHaveLength(2);
    const ops = bp.rooms[0]!;
    expect(ops.roomKey).toBe("operations");
    expect(ops.agents.map((a) => a.name)).toEqual(["blueprint-ops"]);
    expect(ops.compute.allocUsdMicros).toBe(10_000_000);
    expect(ops.compute.usedUsdMicros).toBe(250_000);
    expect(ops.compute.simulated).toBe(false);
    const studio = bp.rooms[1]!;
    expect(studio.tasks).toEqual({ running: 1, ready: 1, blocked: 0, failed: 1 });
    const writer = studio.agents[0]!;
    expect(writer.version).toBe(5); // OCC token for reassign
    expect(writer.workload.activeClaims).toBe(1);
    expect(writer.currentTasks[0]).toEqual({ nodeKey: "task-a", state: "running", attempt: 1 });
    expect(writer.skillPins[0]!.vetted).toBe(true);
    // director is the orchestrator, never office staff
    const all = [...bp.rooms.flatMap((r) => r.agents), ...bp.bench];
    expect(all.some((a) => a.kind === "director")).toBe(false);
    expect(bp.bench.map((a) => a.workerId)).toEqual([43]);
    expect(bp.runningTasks).toBe(1);
    expect(bp.runBudgetUsdMicros).toBe(100_000_000);
  });

  it("marks mock-run consumption as simulated, never silently real", () => {
    const bp = mapOfficeStatus(statusFixture(), WORKERS, NODES, {
      now: NOW,
      runMode: "mock",
      runBudgetUsdMicros: null,
    });
    expect(bp.rooms[0]!.compute.simulated).toBe(true);
    // no run → the ceiling falls back to the summed allocations
    expect(bp.runBudgetUsdMicros).toBe(30_000_000);
  });
});

describe("move planning + assignment conflicts", () => {
  const rooms = statusFixture().rooms;
  const agent = {
    workerId: 42,
    roomKey: "studio" as string | null,
    version: 5,
    workload: { activeClaims: 0, queued: 0 },
  };

  it("seated → another room is a reassign with expectedVersion", () => {
    const plan = planOfficeMove(agent, "operations", undefined, rooms, 502);
    expect(plan).toEqual({
      kind: "reassign",
      toRoomId: 11,
      workerId: 42,
      expectedVersion: 5,
      claimsPolicy: undefined,
    });
  });

  it("bench → room is an assign; bench → bench is refused", () => {
    const benched = { ...agent, workerId: 43, roomKey: null };
    expect(planOfficeMove(benched, "studio", undefined, rooms, null)).toEqual({
      kind: "assign",
      roomId: 12,
      workerId: 43,
      expectedVersion: 5,
    });
    const refused = planOfficeMove(benched, null, undefined, rooms, null);
    expect(refused.kind).toBe("error");
  });

  it("claims held: policy required; bench release is refused honestly", () => {
    const claimed = { ...agent, workload: { activeClaims: 2, queued: 0 } };
    const needsPolicy = planOfficeMove(claimed, "operations", undefined, rooms, 502);
    expect(needsPolicy).toMatchObject({ kind: "error", error: { cause: "claims_policy_required" } });
    const withPolicy = planOfficeMove(claimed, "operations", "drain", rooms, 502);
    expect(withPolicy).toMatchObject({ kind: "reassign", claimsPolicy: "drain" });
    const release = planOfficeMove(claimed, null, "drain", rooms, 502);
    expect(release).toMatchObject({ kind: "error", error: { cause: "unavailable" } });
  });

  it("same-room moves and unknown rooms are refused before any API call", () => {
    expect(planOfficeMove(agent, "studio", undefined, rooms, 502)).toMatchObject({
      kind: "error",
      error: { cause: "ineligible" },
    });
    expect(planOfficeMove(agent, "nowhere", undefined, rooms, 502)).toMatchObject({
      kind: "error",
      error: { cause: "unavailable" },
    });
  });

  it("release needs the live seat assignment id", () => {
    expect(planOfficeMove(agent, null, undefined, rooms, 502)).toEqual({
      kind: "release",
      assignmentId: 502,
    });
    expect(planOfficeMove(agent, null, undefined, rooms, null)).toMatchObject({
      kind: "error",
      error: { cause: "unavailable" },
    });
  });

  it("classifies server conflicts verbatim", () => {
    expect(
      classifyReassignError(new Error("worker version conflict (current 6)")).cause,
    ).toBe("version_conflict");
    expect(
      classifyReassignError(new Error("worker holds 2 active claim(s); claimsPolicy is required")).cause,
    ).toBe("claims_policy_required");
    expect(
      classifyReassignError(new Error("worker is ineligible for room studio: room at capacity (2/2)")).cause,
    ).toBe("room_at_capacity");
    const other = classifyReassignError(new Error("network unreachable"));
    expect(other.cause).toBe("unavailable");
    expect(other.message).toBe("network unreachable");
  });
});

describe("setup checklist (observed, never declared)", () => {
  it("derives completion from the mapped office state", () => {
    const bp = mapOfficeStatus(statusFixture(), WORKERS, NODES, {
      now: NOW,
      runMode: "live",
      runBudgetUsdMicros: 100_000_000,
    });
    const steps = deriveSetupChecklist({ ...bp, projectId: 1 });
    const byId = new Map(steps.map((s) => [s.id, s]));
    expect(byId.get("hire")!.done).toBe(true); // 2 seated + 1 bench
    expect(byId.get("populate")!.done).toBe(false); // 1 on the bench
    expect(byId.get("allocate")!.done).toBe(true); // all rooms funded, under ceiling
    expect(byId.get("start-work")!.done).toBe(true); // task-a is running
  });

  it("reports zero progress for an empty office instead of faking", () => {
    const steps = deriveSetupChecklist({
      projectId: 1,
      rooms: [],
      bench: [],
      runBudgetUsdMicros: 0,
      runningTasks: 0,
      updatedAt: "",
    });
    const byId = new Map(steps.map((s) => [s.id, s]));
    expect(byId.get("hire")!.done).toBe(false);
    expect(byId.get("populate")!.done).toBe(false);
    expect(byId.get("start-work")!.done).toBe(false);
    // "allocate" is vacuously complete with zero rooms — progress text says 0/0
    expect(byId.get("allocate")!.detail).toContain("0 of 0 rooms funded");
  });
});

// ── Whiteboard ──

const BASE: BackendWbDoc = {
  nodes: [
    {
      nodeKey: "task-one",
      kind: "run-node-ref",
      content: "First task\nbody text",
      position: { x: 10, y: 20 },
      refRunId: 9,
      refNodeKey: "task-a",
      refArtifactId: null,
    },
    {
      nodeKey: "note-one",
      kind: "sticky",
      content: "a note",
      position: { x: 0, y: 0 },
      refRunId: null,
      refNodeKey: null,
      refArtifactId: null,
    },
  ],
  edges: [
    { edgeKey: "own--task-one--r--studio", fromKey: "task-one", toKey: "task-one", kind: "link" },
  ],
};

function getPayload() {
  return {
    projectId: 3,
    revision: 4,
    version: 6,
    nodes: BASE.nodes,
    edges: BASE.edges,
    updatedAt: new Date(NOW),
  };
}

describe("whiteboard mapping", () => {
  it("maps backend nodes/edges into the view model with bindings + ownership", () => {
    const doc = wbDocFromBackend(getPayload(), { planHash: "abc123", updatedBy: "you" });
    expect(doc.version).toBe(6);
    expect(doc.revision).toBe(4);
    const task = doc.nodes.find((n) => n.id === "task-one")!;
    expect(task.kind).toBe("task");
    expect(task.title).toBe("First task");
    expect(task.body).toBe("body text");
    expect(task.binding).toEqual({ dagNodeKey: "task-a", runId: 9 });
    const edge = doc.edges[0]!;
    expect(edge.kind).toBe("ownership");
    expect(edge.ownership).toEqual({ roomKey: "studio" });
  });

  it("ownership edge keys round-trip (room + worker), invalid encodings are refused", () => {
    expect(encodeOwnershipEdgeKey("task-one", { roomKey: "studio" })).toBe(
      "own--task-one--r--studio",
    );
    expect(encodeOwnershipEdgeKey("task-one", { workerId: 42 })).toBe("own--task-one--w--42");
    expect(decodeOwnershipEdgeKey("own--task-one--w--42")).toEqual({ workerId: 42 });
    expect(decodeOwnershipEdgeKey("flow-edge-1")).toBeUndefined();
    // a key that can never satisfy NodeKeySchema returns null, not garbage
    expect(encodeOwnershipEdgeKey("TASK ONE", { roomKey: "studio" })).toBeNull();
  });

  it("emits no ops for an unchanged doc (no fake writes)", () => {
    const doc = wbDocFromBackend(getPayload(), { planHash: null, updatedBy: "you" });
    const diff = wbOpsFromDiff(BASE, doc);
    expect(diff).toEqual({ ok: true, ops: [] });
  });

  it("diffs title/body edits into updateNode ops with recomposed content", () => {
    const doc = wbDocFromBackend(getPayload(), { planHash: null, updatedBy: "you" });
    const edited = {
      ...doc,
      nodes: doc.nodes.map((n) =>
        n.id === "task-one" ? { ...n, title: "Renamed", body: "new body" } : n,
      ),
    };
    const diff = wbOpsFromDiff(BASE, edited);
    expect(diff.ok).toBe(true);
    if (!diff.ok) return;
    expect(diff.ops).toEqual([
      {
        op: "updateNode",
        nodeKey: "task-one",
        patch: { content: "Renamed\nnew body" },
      },
    ]);
  });

  it("diffs ownership cycling into edge replacement ops", () => {
    const doc = wbDocFromBackend(getPayload(), { planHash: null, updatedBy: "you" });
    const cycled = {
      ...doc,
      edges: [
        { id: "own--task-one--w--42", from: "task-one", to: "task-one", kind: "ownership" as const, ownership: { workerId: 42 } },
      ],
    };
    const diff = wbOpsFromDiff(BASE, cycled);
    expect(diff.ok).toBe(true);
    if (!diff.ok) return;
    expect(diff.ops).toEqual([
      {
        op: "addEdge",
        edge: { edgeKey: "own--task-one--w--42", fromKey: "task-one", toKey: "task-one", kind: "link" },
      },
      { op: "removeEdge", edgeKey: "own--task-one--r--studio" },
    ]);
  });

  it("maps server drift to the view vocabulary, message verbatim", () => {
    const items = mapServerDrift([
      { kind: "run-node-ref-missing", nodeKey: "task-one", message: "whiteboard node task-one references missing run node 9:task-a" },
      { kind: "unreferenced-run-node", nodeKey: null, message: "run node 9:task-z has no whiteboard reference" },
    ]);
    expect(items[0]).toMatchObject({ kind: "unbound-task", wbNodeId: "task-one" });
    expect(items[1]).toMatchObject({ kind: "unmapped-dag-node", dagNodeKey: "task-z" });
  });
});

describe("whiteboard OCC conflict / rebase / export errors", () => {
  it("classifies save errors: version conflict, fenced, unavailable", () => {
    expect(classifyWbSaveError(new Error("whiteboard version conflict (current 7)")).cause).toBe(
      "version_conflict",
    );
    expect(
      classifyWbSaveError(new Error("edit lease was taken over by bob; your write is fenced")).cause,
    ).toBe("fenced");
    expect(classifyWbSaveError(new Error("whiteboard is locked by bob until …")).cause).toBe(
      "fenced",
    );
    expect(
      classifyWbSaveError(
        new Error("whiteboard export failed: storage error STORAGE_UPSTREAM_ERROR. The failure is recorded; nothing was faked."),
      ).cause,
    ).toBe("unavailable");
  });

  it("rebase keeps my edits, wins server structure, and re-saves cleanly", () => {
    const mine = wbDocFromBackend(getPayload(), { planHash: null, updatedBy: "you" });
    const myEdit = {
      ...mine,
      nodes: mine.nodes.map((n) => (n.id === "task-one" ? { ...n, title: "Mine" } : n)),
    };
    // Server moved on: new note added, task content changed, version bumped.
    const latestBase: BackendWbDoc = {
      nodes: [
        { ...BASE.nodes[0]!, content: "Server title", position: { x: 99, y: 99 } },
        BASE.nodes[1]!,
        {
          nodeKey: "note-two",
          kind: "sticky",
          content: "server note",
          position: { x: 5, y: 5 },
          refRunId: null,
          refNodeKey: null,
          refArtifactId: null,
        },
      ],
      edges: BASE.edges,
    };
    const latest = wbDocFromBackend(
      { ...getPayload(), version: 7, revision: 5, nodes: latestBase.nodes },
      { planHash: null, updatedBy: "server" },
    );
    const rebased = rebaseWhiteboard(myEdit, latest);
    // my title edit wins; server structure (the new note) is preserved
    expect(rebased.nodes.find((n) => n.id === "task-one")!.title).toBe("Mine");
    expect(rebased.nodes.some((n) => n.id === "note-two")).toBe(true);
    expect(rebased.version).toBe(7);
    // …and the rebased doc diffs cleanly against the fresh baseline
    const diff = wbOpsFromDiff(latestBase, rebased);
    expect(diff.ok).toBe(true);
    if (!diff.ok) return;
    // my title + original body + my position win over the server row
    expect(diff.ops).toEqual([
      {
        op: "updateNode",
        nodeKey: "task-one",
        patch: { content: "Mine\nbody text", position: { x: 10, y: 20 } },
      },
    ]);
  });
});

describe("goal-mode presets", () => {
  const valid = {
    mode: "explore",
    strategyId: "least_to_most",
    preamble: "survey first",
    outputTokenFraction: 0.8,
  };

  it("rejects any preset carrying a model id", () => {
    const res = parseGoalModePreset({ ...valid, model: "gpt-5.2-codex" });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error).toMatch(/model id/);
  });

  it("rejects unknown keys and invalid strategies; accepts a clean preset", () => {
    expect(parseGoalModePreset({ ...valid, vendor: "x" }).ok).toBe(false);
    expect(parseGoalModePreset({ ...valid, strategyId: "invented" }).ok).toBe(false);
    expect(parseGoalModePreset({ ...valid, outputTokenFraction: 2 }).ok).toBe(false);
    const ok = parseGoalModePreset(valid);
    expect(ok.ok).toBe(true);
  });
});

describe("autonomy grant states", () => {
  const base = {
    mode: "none" as const,
    allowLive: true,
    riskTier: "high",
    expiresInMinutes: 60,
    scope: "project" as const,
    runEligible: true,
  };

  it("blocks 'none'+live on a non-low-risk project, with the reason", () => {
    const blockers = grantRequestBlockers(base);
    expect(blockers.some((b) => b.includes("low-risk"))).toBe(true);
    expect(grantRequestBlockers({ ...base, riskTier: "low" })).toEqual([]);
  });

  it("blocks run scope without an eligible run and bad TTLs", () => {
    expect(
      grantRequestBlockers({ ...base, riskTier: "low", scope: "run", runEligible: false }).some(
        (b) => b.includes("non-terminal"),
      ),
    ).toBe(true);
    expect(
      grantRequestBlockers({ ...base, riskTier: "low", expiresInMinutes: 2 }).some((b) =>
        b.includes("5..10080"),
      ),
    ).toBe(true);
  });

  const grant = {
    expiresAtMs: NOW + 60_000,
    revokedAtMs: null as number | null,
    maxTokens: 1000,
    maxCalls: 10,
    maxMinutes: 5,
    maxCostUsdMicros: 1_000_000,
  };

  it("reports active / expired / revoked / over-budget from observed state", () => {
    expect(
      grantLifecycle(grant, { tokens: 10, calls: 1, minutes: 0.5, costUsdMicros: 100 }, NOW).state,
    ).toBe("active");
    expect(grantLifecycle(grant, null, NOW + 120_000).state).toBe("expired");
    expect(grantLifecycle({ ...grant, revokedAtMs: NOW - 1000 }, null, NOW).state).toBe("revoked");
    const over = grantLifecycle(
      grant,
      { tokens: 5000, calls: 1, minutes: 0, costUsdMicros: 0 },
      NOW,
    );
    expect(over.state).toBe("over-budget");
    expect(over.ceilings.find((c) => c.key === "maxTokens")!.breached).toBe(true);
    expect(grantLifecycle(null, null, NOW).state).toBe("none");
  });

  it("emergency stop needs only a typed reason — always available", () => {
    expect(emergencyStopConfirmable("")).toBe(false);
    expect(emergencyStopConfirmable("   ")).toBe(false);
    expect(emergencyStopConfirmable("runaway spend")).toBe(true);
  });
});
