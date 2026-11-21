import "dotenv/config";
import { describe, expect, it, beforeAll, afterAll, vi } from "vitest";

// Remote TiDB round-trips: every test/hook in this file gets a long budget.
vi.setConfig({ testTimeout: 180_000, hookTimeout: 180_000 });
import { and, eq, inArray, sql } from "drizzle-orm";
import { appRouter } from "./router";
import { getDb } from "./queries/connection";
import {
  approvals,
  autonomyGrants,
  budgetLedger,
  officeAssignments,
  officeEvents,
  officeBlueprints,
  officeRooms,
  ownerSettings,
  runEvents,
  runNodes,
  runs,
  users,
  whiteboardRevisions,
  workers,
  exportsTable,
  type User,
} from "@db/schema";
import type { DagSpec } from "@contracts/dag";
import { createRun, createRunGraph, ensureAdvancing, sweepAndAdvanceOnce, stopRun, RunStartError } from "./engine/scheduler";
import { expireAutonomyGrants, loadRunGrant, sweepDrainingAssignments } from "./office/store";
import {
  DEFAULT_GOAL_MODE_PRESETS,
  isDispatchableGoalModePreset,
  resolveGoalModePresets,
} from "./office/goal-modes";
import { isDispatchableStrategy, resolveDispatchStrategy } from "./prompting/evaluation";
import { GOAL_MODES } from "@contracts/office";

/**
 * Autonomy/office/whiteboard integration suite (design §2/§4/§5): real
 * MySQL/TiDB, appRouter.createCaller with explicit user contexts. Covers
 * non-bypassable gates, expired/revoked/over-budget grants, emergency stop,
 * provider model rejection, room capacity/eligibility/drain/release/OCC,
 * first-run rollback, permanent-role restrictions, and whiteboard
 * lease/OCC/refs/drift/export + owner denial.
 */

const DB_OK = !!process.env.DATABASE_URL;
const stamp = Date.now().toString(36);
let ownerA: User;
let ownerB: User;
const createdProjectIds: number[] = [];
const createdRunIds: number[] = [];

type Caller = ReturnType<typeof appRouter.createCaller>;

function callerFor(user?: User): Caller {
  return appRouter.createCaller({
    req: new Request("http://autonomy-office.test/"),
    resHeaders: new Headers(),
    ...(user ? { user } : {}),
  });
}

async function expectTrpcCode(p: Promise<unknown>, code: string) {
  await expect(p).rejects.toMatchObject({ code });
}

async function makeProject(user: User, riskTier: "low" | "medium" | "high" = "low") {
  const caller = callerFor(user);
  const project = await caller.projects.create({
    name: `AO ${stamp} ${Math.random().toString(36).slice(2, 8)}`,
    goal: "Autonomy office test project",
    riskTier,
  });
  createdProjectIds.push(project.id);
  return { caller, project };
}

async function makeChainSpec(user: User, projectId: number, mutate?: (spec: DagSpec) => void) {
  const caller = callerFor(user);
  const proposal = await caller.dag.proposeSquad({ projectId, provider: "mock" });
  const spec: DagSpec = structuredClone(proposal.spec);
  mutate?.(spec);
  const saved = await caller.dag.save({ projectId, spec });
  if (!saved.saved) throw new Error("save failed");
  return { caller, spec, revisionId: saved.revisionId };
}

const GRANT_BUDGETS = { maxTokens: 1_000_000, maxCalls: 500, maxMinutes: 240, maxCostUsd: 25 };

describe.skipIf(!DB_OK)("autonomy grants (§2)", () => {
  it("grant + status + list + supersede; revoke twice ⇒ CONFLICT", async () => {
    const { caller, project } = await makeProject(ownerA);
    const g1 = await caller.autonomy.grant({
      projectId: project.id, mode: "risk_based", budgets: GRANT_BUDGETS, expiresInMinutes: 60,
    });
    expect(g1.grantId).toBeGreaterThan(0);
    const status = await caller.autonomy.status({ projectId: project.id });
    expect(status.activeGrant?.id).toBe(g1.grantId);
    const g2 = await caller.autonomy.grant({
      projectId: project.id, mode: "none", budgets: GRANT_BUDGETS, expiresInMinutes: 60,
    });
    expect(g2.superseded).toContain(g1.grantId);
    const status2 = await caller.autonomy.status({ projectId: project.id });
    expect(status2.activeGrant?.id).toBe(g2.grantId);
    await caller.autonomy.revoke({ grantId: g2.grantId, reason: "done" });
    await expectTrpcCode(caller.autonomy.revoke({ grantId: g2.grantId, reason: "again" }), "CONFLICT");
    const list = await caller.autonomy.list({ projectId: project.id });
    expect(list.length).toBe(2);
    expect(list.every((g) => g.revokedAtMs !== null)).toBe(true);
  });

  it("mode none + allowLive on non-low-risk project ⇒ PRECONDITION_FAILED; owner B denied", async () => {
    const { project } = await makeProject(ownerA, "medium");
    await expectTrpcCode(
      callerFor(ownerA).autonomy.grant({
        projectId: project.id, mode: "none", allowLive: true, budgets: GRANT_BUDGETS, expiresInMinutes: 60,
      }),
      "PRECONDITION_FAILED",
    );
    await expectTrpcCode(
      callerFor(ownerB).autonomy.grant({
        projectId: project.id, mode: "none", budgets: GRANT_BUDGETS, expiresInMinutes: 60,
      }),
      "NOT_FOUND",
    );
  });

  it("expired grant sweep marks revoked + audited; run start with dead grant fails", async () => {
    const { caller, project } = await makeProject(ownerA);
    const g = await caller.autonomy.grant({
      projectId: project.id, mode: "risk_based", budgets: GRANT_BUDGETS, expiresInMinutes: 15,
    });
    const db = getDb();
    await db.update(autonomyGrants).set({ expiresAt: new Date(Date.now() - 60_000) })
      .where(eq(autonomyGrants.id, g.grantId));
    const swept = await expireAutonomyGrants();
    expect(swept).toBeGreaterThanOrEqual(1);
    const events = await db.select().from(officeEvents)
      .where(and(eq(officeEvents.projectId, project.id), eq(officeEvents.type, "autonomy_expired")));
    expect(events.length).toBe(1);
    // second pass is a no-op
    const eventsBefore = (await db.select().from(officeEvents)
      .where(eq(officeEvents.projectId, project.id))).length;
    await expireAutonomyGrants();
    const eventsAfter = (await db.select().from(officeEvents)
      .where(eq(officeEvents.projectId, project.id))).length;
    expect(eventsAfter).toBe(eventsBefore);
    // dead grant cannot start a run
    const { revisionId } = await makeChainSpec(ownerA, project.id);
    await caller.dag.approve({ projectId: project.id, revisionId });
    await expect(
      createRun({ user: ownerA, projectId: project.id, dagRevisionId: revisionId, mode: "mock", provider: "mock", autonomyGrantId: g.grantId }),
    ).rejects.toThrow(/expired or revoked/);
  });

  it("mode 'none' grant + high-risk project ⇒ createRun forbidden; plan approval never waived", async () => {
    const { caller, project } = await makeProject(ownerA, "high");
    const g = await caller.autonomy.grant({
      projectId: project.id, mode: "none", budgets: GRANT_BUDGETS, expiresInMinutes: 60,
    });
    const { revisionId } = await makeChainSpec(ownerA, project.id);
    await caller.dag.approve({ projectId: project.id, revisionId });
    await expect(
      createRun({ user: ownerA, projectId: project.id, dagRevisionId: revisionId, mode: "mock", provider: "mock", autonomyGrantId: g.grantId }),
    ).rejects.toThrow(/high-risk/);
    // and without plan approval the run never starts regardless of any grant
    const { revisionId: rev2 } = await makeChainSpec(ownerA, project.id);
    await expect(
      createRun({ user: ownerA, projectId: project.id, dagRevisionId: rev2, mode: "mock", provider: "mock", autonomyGrantId: g.grantId }),
    ).rejects.toThrow();
  });

  it("ANY live run under a grant with allowLive=false fails closed (risk_based and none)", async () => {
    const { caller, project } = await makeProject(ownerA); // low risk
    const { revisionId } = await makeChainSpec(ownerA, project.id);
    await caller.dag.approve({ projectId: project.id, revisionId });
    for (const mode of ["risk_based", "none"] as const) {
      const g = await caller.autonomy.grant({
        projectId: project.id, mode, allowLive: false, budgets: GRANT_BUDGETS, expiresInMinutes: 60,
      });
      await expect(
        createRun({
          user: ownerA, projectId: project.id, dagRevisionId: revisionId,
          mode: "live", provider: "mock", confirmLive: true, autonomyGrantId: g.grantId,
        }),
      ).rejects.toThrow(/does not preauthorize live runs/);
      // ...while a mock run under the same grant is fine.
      const started = await createRun({
        user: ownerA, projectId: project.id, dagRevisionId: revisionId,
        mode: "mock", provider: "mock", autonomyGrantId: g.grantId,
      });
      createdRunIds.push(started.id);
      await caller.autonomy.revoke({ grantId: g.grantId, reason: "test" });
    }
  });

  it("emergency stop revokes grants, stops active runs, audits once", async () => {
    const { caller, project } = await makeProject(ownerA);
    await caller.autonomy.grant({
      projectId: project.id, mode: "risk_based", budgets: GRANT_BUDGETS, expiresInMinutes: 60,
    });
    const { revisionId } = await makeChainSpec(ownerA, project.id);
    await caller.dag.approve({ projectId: project.id, revisionId });
    const started = await createRun({ user: ownerA, projectId: project.id, dagRevisionId: revisionId, mode: "mock", provider: "mock" });
    createdRunIds.push(started.id);
    const res = await caller.autonomy.emergencyStop({ projectId: project.id, reason: "halt" });
    expect(res.revokedGrants.length).toBe(1);
    expect(res.stoppedRuns).toContain(started.id);
    const db = getDb();
    const run = await db.query.runs.findFirst({ where: eq(runs.id, started.id) });
    expect(run?.state).toBe("stopped_human");
    // replay: nothing left to stop/revoke
    const res2 = await caller.autonomy.emergencyStop({ projectId: project.id, reason: "halt" });
    expect(res2.revokedGrants.length).toBe(0);
    expect(res2.stoppedRuns.length).toBe(0);
  });

  it("grant budget ceiling crossed ⇒ grant_budget_exceeded + stopped_human", async () => {
    const { caller, project } = await makeProject(ownerA);
    const g = await caller.autonomy.grant({
      projectId: project.id, mode: "risk_based",
      budgets: { maxTokens: 10, maxCalls: 1, maxMinutes: 240, maxCostUsd: 1 },
      expiresInMinutes: 60,
    });
    const { spec, revisionId } = await makeChainSpec(ownerA, project.id);
    await caller.dag.approve({ projectId: project.id, revisionId });
    const started = await createRun({ user: ownerA, projectId: project.id, dagRevisionId: revisionId, mode: "mock", provider: "mock", autonomyGrantId: g.grantId });
    createdRunIds.push(started.id);
    const db = getDb();
    const firstNode = spec.nodes[0]!.key;
    await db.insert(budgetLedger).values({
      runId: started.id, nodeKey: firstNode, tokensPrompt: 500, tokensCompletion: 500,
      calls: 2, costUsdMicros: 2_000_000, attempt: 1,
    });
    await sweepAndAdvanceOnce({ runLimit: 50 });
    // advanceRun is in-process-async; poll briefly for the stop
    let run = await db.query.runs.findFirst({ where: eq(runs.id, started.id) });
    for (let i = 0; i < 20 && run?.state !== "stopped_human"; i++) {
      await sweepAndAdvanceOnce({ runLimit: 50 });
      await new Promise((r) => setTimeout(r, 300));
      run = await db.query.runs.findFirst({ where: eq(runs.id, started.id) });
    }
    expect(run?.state).toBe("stopped_human");
    const ev = await db.select().from(runEvents)
      .where(and(eq(runEvents.runId, started.id), eq(runEvents.type, "grant_budget_exceeded")));
    expect(ev.length).toBeGreaterThanOrEqual(1);
  });
});

describe.skipIf(!DB_OK)("goal modes (§3)", () => {
  it("setGoalModePreset round-trip; unknown strategyId rejected by schema", async () => {
    const { caller, project } = await makeProject(ownerA);
    const set = await caller.ai.setGoalModePreset({
      provider: "mock",
      preset: { mode: "explore", strategyId: "least_to_most", preamble: "Survey broadly.", outputTokenFraction: 0.5 },
    });
    expect(set.presets.explore.strategyId).toBe("least_to_most");
    const modes = await caller.ai.goalModes();
    expect(modes.providers.mock.explore.preamble).toBe("Survey broadly.");
    expect(modes.modes).toEqual(["explore", "build", "evaluate", "operate"]);
    await expectTrpcCode(
      caller.ai.setGoalModePreset({
        provider: "mock",
        preset: { mode: "build", strategyId: "not-a-strategy" as never, preamble: "", outputTokenFraction: 1 },
      }),
      "BAD_REQUEST",
    );
    // run stamped with goalMode
    const { revisionId } = await makeChainSpec(ownerA, project.id);
    await caller.dag.approve({ projectId: project.id, revisionId });
    const started = await createRun({ user: ownerA, projectId: project.id, dagRevisionId: revisionId, mode: "mock", provider: "mock", goalMode: "explore" });
    createdRunIds.push(started.id);
    const db = getDb();
    const run = await db.query.runs.findFirst({ where: eq(runs.id, started.id) });
    expect(run?.goalMode).toBe("explore");
  });

  it("every shipped default + resolved preset is dispatchable; evaluate passes the dispatch gate", async () => {
    // Shipped defaults: all four modes route through the normal gate.
    const gateReq = (requestedStrategy: Parameters<typeof resolveDispatchStrategy>[0]["requestedStrategy"]) => ({
      symbolic: false,
      compositional: true,
      requiresToolWorkflow: true,
      hasExternalVerifier: false,
      votable: false,
      slaTier: "standard" as const,
      multiAgentRequested: false,
      singleAgentBaselineFailed: false,
      requestedStrategy,
    });
    for (const mode of GOAL_MODES) {
      const preset = DEFAULT_GOAL_MODE_PRESETS[mode];
      expect(isDispatchableGoalModePreset(preset)).toBe(true);
      const decision = resolveDispatchStrategy(gateReq(preset.strategyId));
      expect(isDispatchableStrategy(decision.strategy)).toBe(true);
    }
    // Evaluate specifically: guided_react, not the evaluation-only self_consistency.
    expect(DEFAULT_GOAL_MODE_PRESETS.evaluate.strategyId).toBe("guided_react");
    const evalDecision = resolveDispatchStrategy(gateReq("guided_react"));
    expect(evalDecision.strategy).toBe("guided_react");
    expect(isDispatchableStrategy(evalDecision.strategy)).toBe(true);
    // ...while the old default is rejected at the gate and falls back.
    const legacyDecision = resolveDispatchStrategy(gateReq("self_consistency"));
    expect(legacyDecision.strategy).not.toBe("self_consistency");
    expect(isDispatchableStrategy(legacyDecision.strategy)).toBe(true);
    // Resolved overrides: corrupt/legacy entries fall back per-mode.
    expect(
      resolveGoalModePresets({
        evaluate: { mode: "evaluate", strategyId: "self_consistency", preamble: "x", outputTokenFraction: 1 },
        build: { mode: "build", strategyId: "bounded_reflexion", preamble: "", outputTokenFraction: 1 },
        explore: { mode: "explore", strategyId: "least_to_most", preamble: "custom", outputTokenFraction: 0.5 },
        bogus: "junk",
      }),
    ).toMatchObject({
      evaluate: { strategyId: "guided_react" }, // legacy non-dispatchable ⇒ fallback
      build: { strategyId: "plan_execute" }, // orchestration-requiring ⇒ fallback
      explore: { strategyId: "least_to_most", preamble: "custom" }, // valid override kept
      operate: { strategyId: "direct_structured" }, // untouched default
    });
    // ai.goalModes exposes the catalog-flag-derived dispatchable ids.
    const { caller } = await makeProject(ownerA);
    const modes = await caller.ai.goalModes();
    expect([...modes.dispatchableStrategyIds].sort()).toEqual(
      ["direct_structured", "guided_react", "least_to_most", "plan_execute"].sort(),
    );
    // Non-dispatchable writes are rejected at the API, not at first dispatch.
    await expectTrpcCode(
      caller.ai.setGoalModePreset({
        provider: "mock",
        preset: { mode: "evaluate", strategyId: "self_consistency", preamble: "x", outputTokenFraction: 1 },
      }),
      "BAD_REQUEST",
    );
    // A legacy stored override (pre-fix row) resolves to the safe default.
    const db = getDb();
    await db.insert(ownerSettings).values({
      ownerId: ownerA.id,
      key: "goal-mode-presets:gateway",
      value: { evaluate: { mode: "evaluate", strategyId: "self_consistency", preamble: "old", outputTokenFraction: 1 } },
    });
    const modes2 = await caller.ai.goalModes();
    expect(modes2.providers.gateway.evaluate.strategyId).toBe("guided_react");
  });
});

describe.skipIf(!DB_OK)("office (§4)", () => {
  it("setup materializes 8 rooms + 2 permanent workers seated; second setup ⇒ CONFLICT", async () => {
    const { caller, project } = await makeProject(ownerA);
    const res = await caller.office.setup({ projectId: project.id });
    expect(res.rooms).toBe(8);
    expect(res.status.rooms.length).toBe(8);
    expect(res.status.permanentWorkers.map((w) => w.name).sort()).toEqual(["blueprint-ops", "roadmap-cartographer"]);
    expect(res.status.permanentWorkers.every((w) => w.roomKey === "operations")).toBe(true);
    const db = getDb();
    const seats = await db.select().from(officeAssignments)
      .where(and(eq(officeAssignments.projectId, project.id), eq(officeAssignments.state, "active")));
    expect(seats.length).toBe(2);
    await expectTrpcCode(caller.office.setup({ projectId: project.id }), "CONFLICT");
  });

  it("assign: capacity, role eligibility, OCC; permanent worker run-link ⇒ FORBIDDEN; permanent release ⇒ FORBIDDEN", async () => {
    const { caller, project } = await makeProject(ownerA);
    await caller.office.setup({ projectId: project.id });
    const db = getDb();
    const rooms = await db.select().from(officeRooms)
      .innerJoin(officeBlueprints, eq(officeRooms.blueprintId, officeBlueprints.id))
      .where(eq(officeBlueprints.projectId, project.id));
    const executive = rooms.find((r) => r.office_rooms.roomKey === "executive")!.office_rooms;
    const qa = rooms.find((r) => r.office_rooms.roomKey === "qa-evidence")!.office_rooms;
    // register a QA-capable worker
    const wRes = await caller.control.workers.register({
      projectId: project.id, name: `qa-${stamp}`, kind: "subagent", role: "qa reviewer",
      capabilities: ["read"], maxConcurrentClaims: 1,
    });
    const workerRow = await db.query.workers.findFirst({ where: eq(workers.id, wRes.workerId) });
    // role mismatch: executive room only seats ^director$
    await expectTrpcCode(
      caller.office.assign({ projectId: project.id, roomId: executive.id, workerId: wRes.workerId, expectedVersion: workerRow!.version }),
      "CONFLICT",
    );
    // stale OCC version loses
    await expectTrpcCode(
      caller.office.assign({ projectId: project.id, roomId: qa.id, workerId: wRes.workerId, expectedVersion: 999 }),
      "CONFLICT",
    );
    const ok = await caller.office.assign({ projectId: project.id, roomId: qa.id, workerId: wRes.workerId, expectedVersion: workerRow!.version });
    expect(ok.assigned).toBe(true);
    // capacity: qa room capacity 2, seat 2 more
    const w2Res = await caller.control.workers.register({ projectId: project.id, name: `qa2-${stamp}`, kind: "subagent", role: "qa tester", capabilities: [], maxConcurrentClaims: 1 });
    const w2row = await db.query.workers.findFirst({ where: eq(workers.id, w2Res.workerId) });
    await caller.office.assign({ projectId: project.id, roomId: qa.id, workerId: w2Res.workerId, expectedVersion: w2row!.version });
    const w3Res = await caller.control.workers.register({ projectId: project.id, name: `qa3-${stamp}`, kind: "subagent", role: "qa auditor", capabilities: [], maxConcurrentClaims: 1 });
    const w3row = await db.query.workers.findFirst({ where: eq(workers.id, w3Res.workerId) });
    await expectTrpcCode(
      caller.office.assign({ projectId: project.id, roomId: qa.id, workerId: w3Res.workerId, expectedVersion: w3row!.version }),
      "CONFLICT",
    );
    // already-seated worker cannot double-seat
    const w1fresh = await db.query.workers.findFirst({ where: eq(workers.id, wRes.workerId) });
    await expectTrpcCode(
      caller.office.assign({ projectId: project.id, roomId: executive.id, workerId: wRes.workerId, expectedVersion: w1fresh!.version }),
      "CONFLICT",
    );
    // permanent worker restrictions
    const perm = (await db.select().from(workers).where(eq(workers.projectId, project.id)))
      .find((x) => x.name === "blueprint-ops")!;
    await expectTrpcCode(
      caller.office.assign({ projectId: project.id, roomId: qa.id, workerId: perm.id, runId: 1, nodeKey: "n1", expectedVersion: perm.version }),
      "FORBIDDEN",
    );
    const permSeat = await db.query.officeAssignments.findFirst({
      where: and(eq(officeAssignments.workerId, perm.id), eq(officeAssignments.state, "active")),
    });
    await expectTrpcCode(
      caller.office.release({ projectId: project.id, assignmentId: permSeat!.id }),
      "FORBIDDEN",
    );
    // release a normal seat works
    const seat = await db.query.officeAssignments.findFirst({
      where: and(eq(officeAssignments.workerId, wRes.workerId), eq(officeAssignments.state, "active")),
    });
    const rel = await caller.office.release({ projectId: project.id, assignmentId: seat!.id });
    expect(rel.released).toBe(true);
    const w1after = await db.query.workers.findFirst({ where: eq(workers.id, wRes.workerId) });
    expect(w1after!.roomKey).toBeNull();
  });

  it("reassign: claims_policy_required then drain; sweeper completes after claims finish", async () => {
    const { caller, project } = await makeProject(ownerA);
    await caller.office.setup({ projectId: project.id });
    const db = getDb();
    const wRes = await caller.control.workers.register({
      projectId: project.id, name: `eng-${stamp}`, kind: "subagent", role: "engineer ops",
      capabilities: [], maxConcurrentClaims: 4,
    });
    const wrow = await db.query.workers.findFirst({ where: eq(workers.id, wRes.workerId) });
    const eng = await db.query.officeRooms.findFirst({
      where: and(eq(officeRooms.projectId, project.id), eq(officeRooms.roomKey, "engineering")),
    });
    const ops = await db.query.officeRooms.findFirst({
      where: and(eq(officeRooms.projectId, project.id), eq(officeRooms.roomKey, "operations")),
    });
    // Head-room so the quiet run's populate seats fit alongside permanent seats.
    await caller.office.allocate({
      projectId: project.id, roomId: ops!.id, budgets: ops!.budgets, capacity: 12, expectedVersion: ops!.version,
    });
    await caller.office.assign({ projectId: project.id, roomId: eng!.id, workerId: wRes.workerId, expectedVersion: wrow!.version });
    // fake an active claim held by this worker
    const { spec, revisionId } = await makeChainSpec(ownerA, project.id);
    const runId = await createRunGraph({
      projectId: project.id, dagRevisionId: revisionId, mode: "mock", providerId: "mock",
      model: "mock-deterministic", budget: spec.budget, startedBy: ownerA.id, nodes: spec.nodes,
    });
    createdRunIds.push(runId);
    await db.update(runNodes)
      .set({ state: "claimed", leaseWorkerId: wRes.workerId, leaseToken: `t-${stamp}`, leaseExpiresAt: new Date(Date.now() + 600_000) })
      .where(and(eq(runNodes.runId, runId), eq(runNodes.nodeKey, spec.nodes[0]!.key)));
    const wfresh = await db.query.workers.findFirst({ where: eq(workers.id, wRes.workerId) });
    await expectTrpcCode(
      caller.office.reassign({ projectId: project.id, workerId: wRes.workerId, toRoomId: ops!.id, expectedVersion: wfresh!.version }),
      "CONFLICT",
    );
    const drain = await caller.office.reassign({
      projectId: project.id, workerId: wRes.workerId, toRoomId: ops!.id, expectedVersion: wfresh!.version, claimsPolicy: "drain",
    });
    expect(drain.effect).toBe("drain");
    const wdrain = await db.query.workers.findFirst({ where: eq(workers.id, wRes.workerId) });
    expect(wdrain!.pendingRoomKey).toBe("operations");
    expect(wdrain!.roomKey).toBe("engineering");
    // sweeper defers while claims exist
    expect(await sweepDrainingAssignments()).toBe(0);
    // claims finish → sweeper completes the transfer
    await db.update(runNodes)
      .set({ state: "accepted", leaseWorkerId: null, leaseToken: null, leaseExpiresAt: null })
      .where(eq(runNodes.runId, runId));
    expect(await sweepDrainingAssignments()).toBeGreaterThanOrEqual(1);
    const wdone = await db.query.workers.findFirst({ where: eq(workers.id, wRes.workerId) });
    expect(wdone!.roomKey).toBe("operations");
    expect(wdone!.pendingRoomKey).toBeNull();
    const newSeat = await db.query.officeAssignments.findFirst({
      where: and(eq(officeAssignments.workerId, wRes.workerId), eq(officeAssignments.state, "active")),
    });
    expect(newSeat?.roomId).toBe(ops!.id);
  });

  it("allocate OCC + capacity-shrink guard", async () => {
    const { caller, project } = await makeProject(ownerA);
    await caller.office.setup({ projectId: project.id });
    const db = getDb();
    const room = await db.query.officeRooms.findFirst({
      where: and(eq(officeRooms.projectId, project.id), eq(officeRooms.roomKey, "engineering")),
    });
    const budgets = { ...room!.budgets, maxTokens: 12345 };
    const ok = await caller.office.allocate({
      projectId: project.id, roomId: room!.id, budgets, expectedVersion: room!.version,
    });
    expect(ok.version).toBe(room!.version + 1);
    await expectTrpcCode(
      caller.office.allocate({ projectId: project.id, roomId: room!.id, budgets, expectedVersion: room!.version }),
      "CONFLICT",
    );
  });

  it("first-run populate seats hired roles; over-capacity plan rolls back fully", async () => {
    const { caller, project } = await makeProject(ownerA);
    await caller.office.setup({ projectId: project.id });
    const db = getDb();
    const ops = await db.query.officeRooms.findFirst({
      where: and(eq(officeRooms.projectId, project.id), eq(officeRooms.roomKey, "operations")),
    });
    const eng = await db.query.officeRooms.findFirst({
      where: and(eq(officeRooms.projectId, project.id), eq(officeRooms.roomKey, "engineering")),
    });
    // Head-room so every hired role seats into the ops fallback room.
    await caller.office.allocate({
      projectId: project.id, roomId: ops!.id, budgets: ops!.budgets, capacity: 12, expectedVersion: ops!.version,
    });
    // Unmapped roles land in the ops fallback room (registry roles only).
    const { spec, revisionId } = await makeChainSpec(ownerA, project.id);
    const runId = await createRunGraph({
      projectId: project.id, dagRevisionId: revisionId, mode: "mock", providerId: "mock",
      model: "mock-deterministic", budget: spec.budget, startedBy: ownerA.id, nodes: spec.nodes,
    });
    createdRunIds.push(runId);
    const seatedNodes = await db.select().from(runNodes).where(eq(runNodes.runId, runId));
    expect(seatedNodes.length).toBe(spec.nodes.length);
    expect(seatedNodes.every((n) => n.roomKey === "operations")).toBe(true);
    const runSeats = await db.select().from(officeAssignments)
      .where(and(eq(officeAssignments.projectId, project.id), eq(officeAssignments.runId, runId)));
    expect(runSeats.length).toBeGreaterThanOrEqual(1);
    const pop = await db.select().from(officeEvents)
      .where(and(eq(officeEvents.projectId, project.id), eq(officeEvents.type, "office_run_populated")));
    expect(pop.length).toBe(1);

    // Over-capacity: map every node role to a 1-seat engineering room ⇒ the
    // whole hire-and-populate tx must roll back (no run, agents, nodes, seats).
    await db.update(officeRooms).set({ capacity: 1 }).where(eq(officeRooms.id, eng!.id));
    const { spec: spec2, revisionId: rev2 } = await makeChainSpec(ownerA, project.id);
    const bp = await db.query.officeBlueprints.findFirst({
      where: and(eq(officeBlueprints.projectId, project.id), eq(officeBlueprints.status, "active")),
    });
    const distinctRoles = [...new Set(spec2.nodes.map((n) => n.role))];
    expect(distinctRoles.length).toBeGreaterThanOrEqual(2);
    const specWithMap = {
      ...bp!.spec,
      roleRooms: Object.fromEntries(distinctRoles.map((r) => [r, "engineering"])),
    };
    await db.update(officeBlueprints).set({ spec: specWithMap }).where(eq(officeBlueprints.id, bp!.id));
    const before = {
      runs: (await db.select().from(runs).where(eq(runs.projectId, project.id))).length,
      assignments: (await db.select().from(officeAssignments).where(eq(officeAssignments.projectId, project.id))).length,
    };
    await expect(
      createRunGraph({
        projectId: project.id, dagRevisionId: rev2, mode: "mock", providerId: "mock",
        model: "mock-deterministic", budget: spec2.budget, startedBy: ownerA.id, nodes: spec2.nodes,
      }),
    ).rejects.toThrow(RunStartError);
    const after = {
      runs: (await db.select().from(runs).where(eq(runs.projectId, project.id))).length,
      assignments: (await db.select().from(officeAssignments).where(eq(officeAssignments.projectId, project.id))).length,
    };
    expect(after).toEqual(before);
  });
});

describe.skipIf(!DB_OK)("whiteboard (§5)", () => {
  it("lease/OCC/refs/revisions/export + owner denial + drift", async () => {
    const { caller, project } = await makeProject(ownerA);
    const callerB = callerFor(ownerB);
    const { spec, revisionId } = await makeChainSpec(ownerA, project.id);
    const runId = await createRunGraph({
      projectId: project.id, dagRevisionId: revisionId, mode: "mock", providerId: "mock",
      model: "mock-deterministic", budget: spec.budget, startedBy: ownerA.id, nodes: spec.nodes,
    });
    createdRunIds.push(runId);
    const db = getDb();

    // owner denial: another owner's board is NOT_FOUND, never leaked
    const foreign = await caller.whiteboard.create({ projectId: project.id, title: "Board A" });
    await expectTrpcCode(callerB.whiteboard.get({ id: foreign.id }), "NOT_FOUND");

    // applyOps without a lease ⇒ PRECONDITION_FAILED
    await expectTrpcCode(
      caller.whiteboard.applyOps({
        id: foreign.id, expectedVersion: 1,
        ops: [{ op: "addNode", node: { nodeKey: "n1", kind: "text", content: "hello", position: { x: 0, y: 0 }, refRunId: null, refNodeKey: null, refArtifactId: null } }],
      }),
      "PRECONDITION_FAILED",
    );
    const lease = await caller.whiteboard.acquireLease({ id: foreign.id });
    expect(lease.token).toBeTruthy();
    expect(lease.version).toBe(2); // acquisition bumps the OCC version

    // bad ref (missing run node) ⇒ BAD_REQUEST; cross-project ref ⇒ FORBIDDEN
    await expectTrpcCode(
      caller.whiteboard.applyOps({
        id: foreign.id, expectedVersion: lease.version, editToken: lease.token,
        ops: [{ op: "addNode", node: { nodeKey: "badref", kind: "run-node-ref", content: "", position: { x: 0, y: 0 }, refRunId: 99999999, refNodeKey: "zzz", refArtifactId: null } }],
      }),
      "BAD_REQUEST",
    );
    const { project: projectB } = await makeProject(ownerB);
    const { spec: specB, revisionId: revB } = await makeChainSpec(ownerB, projectB.id);
    const runIdB = await createRunGraph({
      projectId: projectB.id, dagRevisionId: revB, mode: "mock", providerId: "mock",
      model: "mock-deterministic", budget: specB.budget, startedBy: ownerB.id, nodes: specB.nodes,
    });
    createdRunIds.push(runIdB);
    await expectTrpcCode(
      caller.whiteboard.applyOps({
        id: foreign.id, expectedVersion: lease.version, editToken: lease.token,
        ops: [{ op: "addNode", node: { nodeKey: "xref", kind: "run-node-ref", content: "", position: { x: 0, y: 0 }, refRunId: runIdB, refNodeKey: specB.nodes[0]!.key, refArtifactId: null } }],
      }),
      "FORBIDDEN",
    );

    // valid ops: same-project run-node ref + text + note; revision 2 snapshot exists
    const applied = await caller.whiteboard.applyOps({
      id: foreign.id, expectedVersion: lease.version, editToken: lease.token,
      ops: [
        { op: "addNode", node: { nodeKey: "n1", kind: "text", content: "hello", position: { x: 0, y: 0 }, refRunId: null, refNodeKey: null, refArtifactId: null } },
        { op: "addNode", node: { nodeKey: "ref1", kind: "run-node-ref", content: "", position: { x: 1, y: 1 }, refRunId: runId, refNodeKey: spec.nodes[0]!.key, refArtifactId: null } },
        { op: "addEdge", edge: { edgeKey: "e1", fromKey: "n1", toKey: "ref1", kind: "link" } },
        { op: "addNote", note: { nodeKey: "n1", body: "first note", author: "human", authorRef: ownerA.name ?? "owner" } },
      ],
    });
    expect(applied).toMatchObject({ version: 3, revision: 2, nodes: 2, edges: 1, notes: 1 });
    const revs = await caller.whiteboard.revisions({ id: foreign.id });
    expect(revs.map((r) => r.revision)).toEqual([2, 1]);

    // stale OCC version loses; lease take-over fences the stale holder
    await expectTrpcCode(
      caller.whiteboard.applyOps({
        id: foreign.id, expectedVersion: 1, editToken: lease.token,
        ops: [{ op: "addNote", note: { nodeKey: null, body: "stale", author: "human", authorRef: "x" } }],
      }),
      "CONFLICT",
    );
    const lease2 = await caller.whiteboard.acquireLease({ id: foreign.id });
    expect(lease2.version).toBe(4); // take-over bumps the OCC version again
    // the in-flight write from the stale holder loses its version guard —
    // take-over fences it even when the presented expectedVersion matched
    // the pre-takeover row (3)
    await expectTrpcCode(
      caller.whiteboard.applyOps({
        id: foreign.id, expectedVersion: 3, editToken: lease.token,
        ops: [{ op: "addNote", note: { nodeKey: null, body: "fenced", author: "human", authorRef: "x" } }],
      }),
      "CONFLICT",
    );

    // drift: a live run node with no whiteboard ref is reported
    const got = await caller.whiteboard.get({ id: foreign.id });
    expect(got.drift.some((d) => d.kind === "unreferenced-run-node")).toBe(true);
    expect(got.drift.some((d) => d.kind === "run-node-ref-missing")).toBe(false);
    expect((got.editLease as { token?: string } | null)?.token).toBeUndefined();

    // export succeeds when storage works, and is honest when it doesn't
    try {
      const exp = await caller.whiteboard.export({ id: foreign.id, format: "markdown" });
      expect(exp.storageKey).toBeTruthy();
    } catch (err) {
      expect((err as { code?: string }).code).toBe("PRECONDITION_FAILED");
      const row = await db.query.exportsTable.findFirst({
        where: and(eq(exportsTable.projectId, project.id)),
      });
      expect(row?.storageError).toBeTruthy();
    }

    // archive: guarded flip, second archive CONFLICT, applyOps now CONFLICT
    await caller.whiteboard.archive({ id: foreign.id });
    await expectTrpcCode(caller.whiteboard.archive({ id: foreign.id }), "CONFLICT");
    await expectTrpcCode(
      caller.whiteboard.applyOps({
        id: foreign.id, expectedVersion: lease2.version, editToken: lease2.token,
        ops: [{ op: "addNote", note: { nodeKey: null, body: "post-archive", author: "human", authorRef: "x" } }],
      }),
      "CONFLICT",
    );
    const revCount = await db.select().from(whiteboardRevisions).where(eq(whiteboardRevisions.whiteboardId, foreign.id));
    expect(revCount.length).toBe(2); // append-only, exactly one per applied batch + initial
  });
});

describe.skipIf(!DB_OK)("review interleavings", () => {
  // Budget must exceed the default claim-lease TTL (120s): a transient
  // dispatch error leaves the node claimed until the lease sweep reclaims
  // it, and the run only then advances again.
  async function settleRun(runId: number, want: string[], maxIters = 300) {
    const db = getDb();
    for (let i = 0; i < maxIters; i++) {
      await sweepAndAdvanceOnce({ runLimit: 50 });
      const run = await db.query.runs.findFirst({ where: eq(runs.id, runId) });
      if (run && want.includes(run.state)) return run;
      await new Promise((r) => setTimeout(r, 400));
    }
    const run = await db.query.runs.findFirst({ where: eq(runs.id, runId) });
    throw new Error(`run ${runId} did not reach [${want}] (state=${run?.state})`);
  }

  it("run-scoped grant attaches to an existing run; accept gates bypass; expiry re-gates", async () => {
    const { caller, project } = await makeProject(ownerA); // low risk
    const { spec, revisionId } = await makeChainSpec(ownerA, project.id, (s) => {
      s.nodes[0]!.approvalBefore = "accept";
      if (s.nodes[1]) s.nodes[1].approvalBefore = "accept";
    });
    const runId = await createRunGraph({
      projectId: project.id, dagRevisionId: revisionId, mode: "mock", providerId: "mock",
      model: "mock-deterministic", budget: spec.budget, startedBy: ownerA.id, nodes: spec.nodes,
    });
    createdRunIds.push(runId);
    const db = getDb();

    // Grant AFTER the run exists: attaches atomically (runs.autonomy_grant_id).
    const g = await caller.autonomy.grant({
      projectId: project.id, scope: "run", runId, mode: "none",
      budgets: GRANT_BUDGETS, expiresInMinutes: 60,
    });
    const stamped = await db.query.runs.findFirst({ where: eq(runs.id, runId) });
    expect(stamped?.autonomyGrantId).toBe(g.grantId);
    const grantRow = await db.query.autonomyGrants.findFirst({ where: eq(autonomyGrants.id, g.grantId) });
    expect(grantRow?.runId).toBe(runId);
    // loadRunGrant actually resolves it for the gate path.
    expect((await loadRunGrant(stamped!))?.id).toBe(g.grantId);

    // Dispatch: gated nodes bypass with per-node audit, zero approval rows.
    ensureAdvancing(runId);
    const done = await settleRun(runId, ["completed", "awaiting_approval", "stopped_human"]);
    expect(done.state).toBe("completed");
    const bypassed = await db.select().from(runEvents)
      .where(and(eq(runEvents.runId, runId), eq(runEvents.type, "approval_bypassed")));
    // Both accept-gated nodes bypassed (a retried dispatch re-audits per
    // dispatch, so ≥2 — the key fact is zero approval rows).
    expect(bypassed.length).toBeGreaterThanOrEqual(2);
    const approvalRows = await db.select().from(approvals).where(eq(approvals.runId, runId));
    expect(approvalRows.length).toBe(0);

    // Re-gating run: same gated spec + grant that expires mid-run.
    const { spec: spec2, revisionId: rev2 } = await makeChainSpec(ownerA, project.id, (s) => {
      s.nodes[0]!.approvalBefore = "accept";
      if (s.nodes[1]) s.nodes[1].approvalBefore = "accept";
    });
    const runId2 = await createRunGraph({
      projectId: project.id, dagRevisionId: rev2, mode: "mock", providerId: "mock",
      model: "mock-deterministic", budget: spec2.budget, startedBy: ownerA.id, nodes: spec2.nodes,
    });
    createdRunIds.push(runId2);
    const g2 = await caller.autonomy.grant({
      projectId: project.id, scope: "run", runId: runId2, mode: "none",
      budgets: GRANT_BUDGETS, expiresInMinutes: 60,
    });
    ensureAdvancing(runId2);
    // Wait for the first bypass, then expire the grant before node 2's gate.
    let bypassAtExpire = 0;
    for (let i = 0; i < 300 && bypassAtExpire === 0; i++) {
      await sweepAndAdvanceOnce({ runLimit: 50 });
      const ev = await db.select().from(runEvents)
        .where(and(eq(runEvents.runId, runId2), eq(runEvents.type, "approval_bypassed")));
      bypassAtExpire = ev.length;
      if (bypassAtExpire === 0) await new Promise((r) => setTimeout(r, 300));
    }
    expect(bypassAtExpire).toBeGreaterThanOrEqual(1);
    await db.update(autonomyGrants)
      .set({ expiresAt: new Date(Date.now() - 60_000) })
      .where(eq(autonomyGrants.id, g2.grantId));
    const settled = await settleRun(runId2, ["awaiting_approval", "completed"]);
    expect(settled.state).toBe("awaiting_approval");
    // Re-gating is exact: NOT ONE further bypass after the grant expired —
    // the next gated node fell back to the human approval flow.
    const bypassed2 = await db.select().from(runEvents)
      .where(and(eq(runEvents.runId, runId2), eq(runEvents.type, "approval_bypassed")));
    expect(bypassed2.length).toBe(bypassAtExpire);
    const pending = await db.select().from(approvals)
      .where(and(eq(approvals.runId, runId2), eq(approvals.state, "pending")));
    expect(pending.length).toBe(1);
    await stopRun(runId2, "test cleanup").catch(() => {});

    // Terminal runs reject pre-bound grants.
    await expectTrpcCode(
      caller.autonomy.grant({
        projectId: project.id, scope: "run", runId: runId2, mode: "none",
        budgets: GRANT_BUDGETS, expiresInMinutes: 60,
      }),
      "BAD_REQUEST",
    );
  });

  it("unbound run-scoped grant binds to exactly one run; concurrent second run loses", async () => {
    const { caller, project } = await makeProject(ownerA);
    const { revisionId } = await makeChainSpec(ownerA, project.id);
    await caller.dag.approve({ projectId: project.id, revisionId });
    const g = await caller.autonomy.grant({
      projectId: project.id, scope: "run", mode: "none",
      budgets: GRANT_BUDGETS, expiresInMinutes: 60,
    });
    // Single bind works.
    const first = await createRun({
      user: ownerA, projectId: project.id, dagRevisionId: revisionId,
      mode: "mock", provider: "mock", autonomyGrantId: g.grantId,
    });
    createdRunIds.push(first.id);
    const db = getDb();
    expect((await db.query.autonomyGrants.findFirst({ where: eq(autonomyGrants.id, g.grantId) }))?.runId)
      .toBe(first.id);
    // Second run with the same (now bound) grant is rejected.
    await expect(
      createRun({
        user: ownerA, projectId: project.id, dagRevisionId: revisionId,
        mode: "mock", provider: "mock", autonomyGrantId: g.grantId,
      }),
    ).rejects.toThrow(/is bound to run/);

    // Concurrent bind race on a fresh unbound grant: exactly one winner.
    const g2 = await caller.autonomy.grant({
      projectId: project.id, scope: "run", mode: "none",
      budgets: GRANT_BUDGETS, expiresInMinutes: 60,
    });
    const [ra, rb] = await Promise.allSettled([
      createRun({ user: ownerA, projectId: project.id, dagRevisionId: revisionId, mode: "mock", provider: "mock", autonomyGrantId: g2.grantId }),
      createRun({ user: ownerA, projectId: project.id, dagRevisionId: revisionId, mode: "mock", provider: "mock", autonomyGrantId: g2.grantId }),
    ]);
    const won = [ra, rb].filter((r) => r.status === "fulfilled");
    const lost = [ra, rb].filter((r) => r.status === "rejected");
    expect(won.length).toBe(1);
    expect(lost.length).toBe(1);
    expect(String((lost[0] as PromiseRejectedResult).reason)).toMatch(/bound to a concurrent run|bound to another run/);
    const winnerId = (won[0] as PromiseFulfilledResult<{ id: number }>).value.id;
    createdRunIds.push(winnerId);
    expect((await db.query.autonomyGrants.findFirst({ where: eq(autonomyGrants.id, g2.grantId) }))?.runId)
      .toBe(winnerId);
  });

  it("concurrent autonomy.grant: no 500, exactly one active grant", async () => {
    const { caller, project } = await makeProject(ownerA);
    const [r1, r2] = await Promise.allSettled([
      caller.autonomy.grant({ projectId: project.id, mode: "risk_based", budgets: GRANT_BUDGETS, expiresInMinutes: 60 }),
      caller.autonomy.grant({ projectId: project.id, mode: "none", budgets: GRANT_BUDGETS, expiresInMinutes: 60 }),
    ]);
    expect(r1.status).toBe("fulfilled");
    expect(r2.status).toBe("fulfilled");
    const db = getDb();
    const active = await db.select().from(autonomyGrants)
      .where(and(eq(autonomyGrants.projectId, project.id), sql`${autonomyGrants.revokedAt} IS NULL`));
    expect(active.length).toBe(1);
    const status = await caller.autonomy.status({ projectId: project.id });
    expect(status.activeGrant?.id).toBe(active[0]!.id);
  });

  it("drain completion defers when the target room is full", async () => {
    const { caller, project } = await makeProject(ownerA);
    await caller.office.setup({ projectId: project.id });
    const db = getDb();
    const ops = await db.query.officeRooms.findFirst({
      where: and(eq(officeRooms.projectId, project.id), eq(officeRooms.roomKey, "operations")),
    });
    const eng = await db.query.officeRooms.findFirst({
      where: and(eq(officeRooms.projectId, project.id), eq(officeRooms.roomKey, "engineering")),
    });
    // Head-room so the quiet run's populate seats fit (permanent seats occupy 2).
    await caller.office.allocate({
      projectId: project.id, roomId: ops!.id, budgets: ops!.budgets, capacity: 12, expectedVersion: ops!.version,
    });
    const wRes = await caller.control.workers.register({
      projectId: project.id, name: `drain-${stamp}`, kind: "subagent", role: "engineer ops",
      capabilities: [], maxConcurrentClaims: 4,
    });
    let w = (await db.query.workers.findFirst({ where: eq(workers.id, wRes.workerId) }))!;
    await caller.office.assign({ projectId: project.id, roomId: eng!.id, workerId: w.id, expectedVersion: w.version });
    // Fake an active claim so drain is required.
    const { spec, revisionId } = await makeChainSpec(ownerA, project.id);
    const runId = await createRunGraph({
      projectId: project.id, dagRevisionId: revisionId, mode: "mock", providerId: "mock",
      model: "mock-deterministic", budget: spec.budget, startedBy: ownerA.id, nodes: spec.nodes,
    });
    createdRunIds.push(runId);
    await db.update(runNodes)
      .set({ state: "claimed", leaseWorkerId: w.id, leaseToken: `dt-${stamp}`, leaseExpiresAt: new Date(Date.now() + 600_000) })
      .where(and(eq(runNodes.runId, runId), eq(runNodes.nodeKey, spec.nodes[0]!.key)));
    // Drain is requested while the target still has capacity…
    w = (await db.query.workers.findFirst({ where: eq(workers.id, w.id) }))!;
    await caller.office.reassign({
      projectId: project.id, workerId: w.id, toRoomId: ops!.id, expectedVersion: w.version, claimsPolicy: "drain",
    });
    // …then the room fills to capacity BEFORE the worker's claims finish.
    const opsNow = (await db.query.officeRooms.findFirst({ where: eq(officeRooms.id, ops!.id) }))!;
    const occ = (await db.select().from(officeAssignments)
      .where(and(eq(officeAssignments.roomId, ops!.id), eq(officeAssignments.state, "active")))).length;
    await caller.office.allocate({
      projectId: project.id, roomId: ops!.id, budgets: opsNow.budgets, capacity: occ, expectedVersion: opsNow.version,
    });
    // Claims finish, but the target room is full ⇒ transfer defers.
    await db.update(runNodes)
      .set({ state: "accepted", leaseWorkerId: null, leaseToken: null, leaseExpiresAt: null })
      .where(eq(runNodes.runId, runId));
    expect(await sweepDrainingAssignments()).toBe(0);
    w = (await db.query.workers.findFirst({ where: eq(workers.id, w.id) }))!;
    expect(w.pendingRoomKey).toBe("operations");
    expect(w.roomKey).toBe("engineering");
    // Capacity frees ⇒ the next sweep completes the transfer.
    const opsFresh = (await db.query.officeRooms.findFirst({ where: eq(officeRooms.id, ops!.id) }))!;
    await caller.office.allocate({
      projectId: project.id, roomId: ops!.id, budgets: opsFresh.budgets, capacity: occ + 2, expectedVersion: opsFresh.version,
    });
    expect(await sweepDrainingAssignments()).toBe(1);
    w = (await db.query.workers.findFirst({ where: eq(workers.id, w.id) }))!;
    expect(w.roomKey).toBe("operations");
    expect(w.pendingRoomKey).toBeNull();
  });

  it("control.assign rejects a worker from another project (same owner)", async () => {
    const { caller, project } = await makeProject(ownerA);
    const { project: projectB } = await makeProject(ownerA);
    const { spec, revisionId } = await makeChainSpec(ownerA, project.id);
    const runId = await createRunGraph({
      projectId: project.id, dagRevisionId: revisionId, mode: "mock", providerId: "mock",
      model: "mock-deterministic", budget: spec.budget, startedBy: ownerA.id, nodes: spec.nodes,
    });
    createdRunIds.push(runId);
    const wB = await caller.control.workers.register({
      projectId: projectB.id, name: `xp-${stamp}`, kind: "subagent", role: "engineer",
      capabilities: [], maxConcurrentClaims: 1,
    });
    await expectTrpcCode(
      caller.control.assign({ runId, nodeKey: spec.nodes[0]!.key, workerId: wB.workerId }),
      "FORBIDDEN",
    );
  });

  it("acquireLease idempotency replay returns a redacted re-acquire response", async () => {
    const { caller, project } = await makeProject(ownerA);
    const board = await caller.whiteboard.create({ projectId: project.id, title: "Lease replay" });
    const key = `lease-${stamp}`;
    const first = await caller.whiteboard.acquireLease({ id: board.id, idempotencyKey: key });
    expect(first.token).toBeTruthy();
    expect(first.reacquireRequired).toBe(false);
    const replay = await caller.whiteboard.acquireLease({ id: board.id, idempotencyKey: key });
    expect(replay.token).toBeNull();
    expect((replay as { redacted?: boolean }).redacted).toBe(true);
    expect(replay.reacquireRequired).toBe(true);
    // The redacted replay is NOT a usable lease: applyOps without the real
    // token is locked by the active holder.
    await expectTrpcCode(
      caller.whiteboard.applyOps({
        id: board.id, expectedVersion: first.version, editToken: replay.token ?? undefined,
        ops: [{ op: "addNote", note: { nodeKey: null, body: "x", author: "human", authorRef: "x" } }],
      }),
      "CONFLICT",
    );
  });
});

beforeAll(async () => {
  if (!DB_OK) return;
  const db = getDb();
  const [a] = await db.insert(users).values({ unionId: `ao-owner-a-${stamp}`, name: "AO Owner A" });
  const [b] = await db.insert(users).values({ unionId: `ao-owner-b-${stamp}`, name: "AO Owner B" });
  ownerA = (await db.query.users.findFirst({ where: eq(users.id, Number(a.insertId)) }))!;
  ownerB = (await db.query.users.findFirst({ where: eq(users.id, Number(b.insertId)) }))!;
}, 60_000);

afterAll(async () => {
  if (!DB_OK) return;
  const db = getDb();
  for (const runId of createdRunIds) {
    const run = await db.query.runs.findFirst({ where: eq(runs.id, runId) });
    if (run && !["completed", "failed", "stopped_human", "stopped_budget", "cancelled"].includes(run.state)) {
      await stopRun(runId, "test cleanup").catch(() => {});
    }
  }
  if (createdProjectIds.length) {
    await db.delete(officeEvents).where(inArray(officeEvents.projectId, createdProjectIds)).catch(() => {});
  }
}, 60_000);
