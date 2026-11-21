import "dotenv/config";
import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { and, eq, inArray } from "drizzle-orm";
import { appRouter } from "./router";
import { getDb } from "./queries/connection";
import {
  agents,
  approvals,
  artifacts,
  budgetLedger,
  dagRevisions,
  idempotencyKeys,
  projects,
  runEvents,
  runNodes,
  runs,
  users,
  workers,
  type Run,
  type User,
  type Worker,
} from "@db/schema";
import type { DagSpec, NodeSpec } from "@contracts/dag";
import { NODE_MAX_ATTEMPTS, TERMINAL_RUN_STATES } from "@contracts/run";
import {
  cancelNodeCascade,
  checkWorkerEligibility,
  claimNextNode,
  completeClaimedNode,
  heartbeatLease,
  releaseClaim,
  sweepExpiredLeases,
  FenceError,
} from "./engine/control-plane";
import {
  addNodeUsage,
  createRunGraph,
  pauseRun,
  resumeRun,
  stopRun,
} from "./engine/scheduler";

/**
 * Control-plane integration suite (refactor doc §9.7): real MySQL/TiDB,
 * appRouter.createCaller with explicit user contexts. Covers the atomic
 * claim CAS, dependency gating, lease fencing/heartbeat/recovery, guarded
 * approvals, atomic usage accounting, createRun rollback, pause/cancel
 * propagation, eligibility, owner denial, query purity, and the full mock
 * lifecycle through the claim-driven engine.
 */

const DB_OK = !!process.env.DATABASE_URL;
const stamp = Date.now().toString(36);
let ownerA: User;
let ownerB: User;
const createdProjectIds: number[] = [];
const createdWorkerIds: number[] = [];
const createdRunIds: number[] = [];

type Caller = ReturnType<typeof appRouter.createCaller>;

function callerFor(user?: User): Caller {
  return appRouter.createCaller({
    req: new Request("http://control-plane.test/"),
    resHeaders: new Headers(),
    ...(user ? { user } : {}),
  });
}

async function expectTrpcCode(p: Promise<unknown>, code: string) {
  await expect(p).rejects.toMatchObject({ code });
}

/** Build a project + saved/approved 3-node chain (scope→evidence→synthesize). */
async function makeChain(
  user: User,
  opts: { approve?: boolean; mutate?: (spec: DagSpec) => void } = {},
) {
  const caller = callerFor(user);
  const project = await caller.projects.create({
    name: `CP ${stamp} ${Math.random().toString(36).slice(2, 8)}`,
    goal: "Control-plane test project",
    riskTier: "low",
  });
  createdProjectIds.push(project.id);
  const proposal = await caller.dag.proposeSquad({ projectId: project.id, provider: "mock" });
  const spec: DagSpec = structuredClone(proposal.spec);
  opts.mutate?.(spec);
  const saved = await caller.dag.save({ projectId: project.id, spec });
  if (!saved.saved) throw new Error("save failed");
  if (opts.approve !== false) {
    await caller.dag.approve({ projectId: project.id, revisionId: saved.revisionId });
  }
  return { caller, project, spec, revisionId: saved.revisionId };
}

/**
 * Create a run graph WITHOUT kicking the engine: run stays `queued`,
 * nodes stay `pending`, no events. Deterministic claim/lease fixture.
 */
async function makeQuietRun(
  user: User,
  spec: DagSpec,
  revisionId: number,
  projectId: number,
): Promise<Run> {
  const runId = await createRunGraph({
    projectId,
    dagRevisionId: revisionId,
    mode: "mock",
    providerId: "mock",
    model: "mock-deterministic",
    budget: spec.budget,
    startedBy: user.id,
    nodes: spec.nodes,
  });
  createdRunIds.push(runId);
  const db = getDb();
  return (await db.query.runs.findFirst({ where: eq(runs.id, runId) }))!;
}

async function setNodeStateRaw(
  runId: number,
  nodeKey: string,
  state: string,
  extra: Record<string, unknown> = {},
) {
  await getDb()
    .update(runNodes)
    .set({ state: state as never, ...extra })
    .where(and(eq(runNodes.runId, runId), eq(runNodes.nodeKey, nodeKey)));
}

async function getNode(runId: number, nodeKey: string) {
  return (await getDb().query.runNodes.findFirst({
    where: and(eq(runNodes.runId, runId), eq(runNodes.nodeKey, nodeKey)),
  }))!;
}

async function makeWorker(
  projectId: number,
  over: Partial<typeof workers.$inferInsert> = {},
): Promise<Worker> {
  const db = getDb();
  const name = over.name ?? `w-${Math.random().toString(36).slice(2, 10)}`;
  const [row] = await db.insert(workers).values({
    projectId,
    name,
    kind: "subagent",
    role: "Research Scientist",
    capabilities: ["read", "summarize", "compare", "cite", "classify", "synthesize"],
    skillRefs: [],
    ...over,
  });
  createdWorkerIds.push(Number(row.insertId));
  return (await db.query.workers.findFirst({ where: eq(workers.id, Number(row.insertId)) }))!;
}

function nodeSpecOf(spec: DagSpec, key: string): NodeSpec {
  return spec.nodes.find((n) => n.key === key)!;
}

async function workerForNode(projectId: number, spec: DagSpec, key: string, over = {}) {
  const node = nodeSpecOf(spec, key);
  return makeWorker(projectId, {
    role: node.role,
    capabilities: [...node.toolsAllowed],
    skillRefs: [node.skill],
    ...over,
  });
}

async function waitRunState(caller: Caller, runId: number, want: string[], timeoutMs = 120_000) {
  const t0 = Date.now();
  for (;;) {
    const r = await caller.runs.get({ id: runId });
    if (want.includes(r.run.state)) return r;
    if (TERMINAL_RUN_STATES.has(r.run.state)) {
      throw new Error(`run ${runId} reached unexpected terminal ${r.run.state} (${r.run.endReason})`);
    }
    if (Date.now() - t0 > timeoutMs) throw new Error(`timeout waiting for ${want.join("|")}`);
    await new Promise((r2) => setTimeout(r2, 1_000));
  }
}

describe.skipIf(!DB_OK)("control plane (real DB)", () => {
  beforeAll(async () => {
    const db = getDb();
    const [a] = await db
      .insert(users)
      .values({ unionId: `cp-owner-a-${stamp}`, name: "CP Owner A" });
    const [b] = await db
      .insert(users)
      .values({ unionId: `cp-owner-b-${stamp}`, name: "CP Owner B" });
    ownerA = (await db.query.users.findFirst({ where: eq(users.id, Number(a.insertId)) }))!;
    ownerB = (await db.query.users.findFirst({ where: eq(users.id, Number(b.insertId)) }))!;
  }, 60_000);

  afterAll(async () => {
    const db = getDb();
    try {
      if (createdRunIds.length) {
        await db.delete(runEvents).where(inArray(runEvents.runId, createdRunIds));
        await db.delete(budgetLedger).where(inArray(budgetLedger.runId, createdRunIds));
        await db.delete(approvals).where(inArray(approvals.runId, createdRunIds));
        await db.delete(artifacts).where(inArray(artifacts.runId, createdRunIds));
        await db.delete(runNodes).where(inArray(runNodes.runId, createdRunIds));
      }
      if (createdProjectIds.length) {
        await db.delete(runs).where(inArray(runs.projectId, createdProjectIds));
        await db.delete(agents).where(inArray(agents.projectId, createdProjectIds));
        await db.delete(workers).where(inArray(workers.projectId, createdProjectIds));
        await db.delete(dagRevisions).where(inArray(dagRevisions.projectId, createdProjectIds));
        await db.delete(projects).where(inArray(projects.id, createdProjectIds));
      }
      await db.delete(idempotencyKeys).where(inArray(idempotencyKeys.ownerId, [ownerA.id, ownerB.id]));
      await db.delete(users).where(inArray(users.id, [ownerA.id, ownerB.id]));
    } catch (err) {
      console.warn("control-plane cleanup incomplete:", (err as Error).message);
    }
  }, 120_000);

  // ── 1. Simultaneous claims: exactly one winner ─────────────────
  it("claim race: 5 concurrent CAS claims on one ready node — exactly one winner", { timeout: 120_000 }, async () => {
    const { project, spec, revisionId } = await makeChain(ownerA);
    const run = await makeQuietRun(ownerA, spec, revisionId, project.id);
    const scope = nodeSpecOf(spec, "scope");
    await setNodeStateRaw(run.id, "scope", "ready");

    const racers = await Promise.all(
      Array.from({ length: 5 }, () => workerForNode(project.id, spec, "scope")),
    );
    const results = await Promise.all(
      racers.map((w) => claimNextNode(run, w).catch((e) => e)),
    );
    const winners = results.filter((r) => r && !(r instanceof Error));
    expect(winners.length).toBe(1);
    expect(winners[0]!.nodeKey).toBe(scope.key);
    expect(winners[0]!.attempt).toBe(1);

    const node = await getNode(run.id, "scope");
    expect(node.state).toBe("claimed");
    expect(node.leaseToken).toBe(winners[0]!.leaseToken);
    expect(node.attempts).toBe(1);
    expect(node.version).toBe(2); // one CAS won

    // Exactly one claimed event in the audit stream.
    const events = await getDb()
      .select()
      .from(runEvents)
      .where(eq(runEvents.runId, run.id));
    const claimedEvents = events.filter(
      (e) => e.type === "node_state" && (e.payload as { state?: string }).state === "claimed",
    );
    expect(claimedEvents.length).toBe(1);
    expect(claimedEvents[0]!.actor).toBe("worker");

    // The same claim cannot be taken twice — a second claim finds nothing.
    const again = await claimNextNode(
      (await getDb().query.runs.findFirst({ where: eq(runs.id, run.id) }))!,
      racers[0]!,
    );
    expect(again).toBeNull();
  });

  // ── 2. Dependency gating ───────────────────────────────────────
  it("dependency gating: a node is not claimable until all upstreams are accepted", { timeout: 120_000 }, async () => {
    const { project, spec, revisionId } = await makeChain(ownerA);
    const run = await makeQuietRun(ownerA, spec, revisionId, project.id);
    // Force evidence ready even though scope is NOT accepted (corrupt state
    // on purpose: the CAS path must still refuse).
    await setNodeStateRaw(run.id, "evidence", "ready");
    const w = await workerForNode(project.id, spec, "evidence");
    const claim = await claimNextNode(run, w);
    expect(claim).toBeNull();

    // Once the upstream is accepted, the claim succeeds.
    await setNodeStateRaw(run.id, "scope", "accepted");
    const fresh = (await getDb().query.runs.findFirst({ where: eq(runs.id, run.id) }))!;
    const claim2 = await claimNextNode(fresh, w);
    expect(claim2?.nodeKey).toBe("evidence");

    // Pure eligibility function agrees.
    const node = nodeSpecOf(spec, "evidence");
    expect(
      checkWorkerEligibility(w, node, { depsAccepted: false, startApproved: true, mode: "self-claim" }),
    ).toBe("dependencies_unmet");
    expect(
      checkWorkerEligibility(w, node, { depsAccepted: true, startApproved: true, mode: "self-claim" }),
    ).toBeNull();
  });

  // ── 3. Capacity / role / skill / status eligibility ────────────
  it("eligibility: capacity cap, role mismatch, skill-pin mismatch, suspension, assignment mode", { timeout: 120_000 }, async () => {
    // scope and evidence as independent roots so both are claimable at once
    // (evidence's artifact-input requirement drops with the removed edge).
    const { project, spec, revisionId } = await makeChain(ownerA, {
      mutate: (s) => {
        s.edges = s.edges.filter(
          (e) => !(e.from === "scope" && e.to === "evidence"),
        );
        const ev = s.nodes.find((n) => n.key === "evidence")!;
        ev.inputArtifactTypes = [];
      },
    });
    const run = await makeQuietRun(ownerA, spec, revisionId, project.id);
    await setNodeStateRaw(run.id, "scope", "ready");
    await setNodeStateRaw(run.id, "evidence", "ready");
    const node = nodeSpecOf(spec, "scope");

    // Role mismatch.
    const wrongRole = await workerForNode(project.id, spec, "scope", { role: "Not The Role" });
    expect(
      checkWorkerEligibility(wrongRole, node, { depsAccepted: true, startApproved: true, mode: "self-claim" }),
    ).toBe("role_mismatch");
    expect(await claimNextNode(run, wrongRole)).toBeNull();

    // Skill-pin mismatch.
    const wrongPin = await workerForNode(project.id, spec, "scope", {
      skillRefs: [{ name: "other", version: "0.0.1", sha256: "b".repeat(64) }],
    });
    expect(
      checkWorkerEligibility(wrongPin, node, { depsAccepted: true, startApproved: true, mode: "self-claim" }),
    ).toBe("skill_pin_mismatch");

    // Missing capability (toolsAllowed ⊄ capabilities).
    const lowCap = await workerForNode(project.id, spec, "scope", { capabilities: [] });
    expect(
      checkWorkerEligibility(lowCap, node, { depsAccepted: true, startApproved: true, mode: "self-claim" }),
    ).toBe("capability_mismatch");

    // Suspended worker.
    const suspended = await workerForNode(project.id, spec, "scope", { status: "suspended" });
    expect(
      checkWorkerEligibility(suspended, node, { depsAccepted: true, startApproved: true, mode: "self-claim" }),
    ).toBe("worker_suspended");
    expect(await claimNextNode(run, suspended)).toBeNull();

    // Capacity cap: worker with maxConcurrentClaims=1 already holds scope.
    const capped = await workerForNode(project.id, spec, "scope", { maxConcurrentClaims: 1 });
    const first = await claimNextNode(run, capped);
    expect(first?.nodeKey).toBe("scope");
    const fresh = (await getDb().query.runs.findFirst({ where: eq(runs.id, run.id) }))!;
    expect(await claimNextNode(fresh, capped)).toBeNull(); // at capacity
    // A capacity-2 worker gets the other root node.
    const roomy = await workerForNode(project.id, spec, "evidence", { maxConcurrentClaims: 2 });
    const second = await claimNextNode(fresh, roomy);
    expect(second?.nodeKey).toBe("evidence");

    // director-mode assignment is not self-claimable by subagents — except
    // the worker it is explicitly assigned to (release keeps the assignment).
    await releaseClaim(run.id, "evidence", second!.leaseToken);
    await getDb()
      .update(runNodes)
      .set({ assignmentMode: "director" })
      .where(and(eq(runNodes.runId, run.id), eq(runNodes.nodeKey, "evidence")));
    const fresh2 = (await getDb().query.runs.findFirst({ where: eq(runs.id, run.id) }))!;
    const outsider = await workerForNode(project.id, spec, "evidence");
    expect(await claimNextNode(fresh2, outsider)).toBeNull(); // not assignee, director-mode
    const assignee = await claimNextNode(fresh2, roomy); // assigned → may claim
    expect(assignee?.nodeKey).toBe("evidence");
  });

  // ── 4. Heartbeat + wrong/expired lease fencing ─────────────────
  it("heartbeat extends expiry; wrong token and expired lease are fenced", { timeout: 120_000 }, async () => {
    const { project, spec, revisionId } = await makeChain(ownerA);
    const run = await makeQuietRun(ownerA, spec, revisionId, project.id);
    await setNodeStateRaw(run.id, "scope", "ready");
    const w = await workerForNode(project.id, spec, "scope", { leaseTtlSeconds: 30 });
    const claim = (await claimNextNode(run, w))!;
    const before = (await getNode(run.id, "scope")).leaseExpiresAt!;

    await new Promise((r) => setTimeout(r, 1_100));
    const hb = await heartbeatLease(run.id, "scope", claim.leaseToken, w.leaseTtlSeconds);
    expect(hb.leaseExpiresAt.getTime()).toBeGreaterThanOrEqual(before.getTime());

    // Wrong token → fenced.
    await expect(heartbeatLease(run.id, "scope", "00000000-0000-0000-0000-000000000000", 30))
      .rejects.toBeInstanceOf(FenceError);

    // Expire the lease in the past → heartbeat is fenced; sweep recovers.
    await getDb()
      .update(runNodes)
      .set({ leaseExpiresAt: new Date(Date.now() - 60_000) })
      .where(and(eq(runNodes.runId, run.id), eq(runNodes.nodeKey, "scope")));
    await expect(heartbeatLease(run.id, "scope", claim.leaseToken, 30))
      .rejects.toBeInstanceOf(FenceError);

    const swept = await sweepExpiredLeases({ runId: run.id });
    expect(swept.swept).toBe(1);
    expect(swept.recycled).toEqual(["scope"]);
    const node = await getNode(run.id, "scope");
    expect(node.state).toBe("ready"); // attempts(1) < max
    expect(node.leaseToken).toBeNull();

    // Late completion with the old token is fenced (stale writer).
    await expect(completeClaimedNode(run.id, "scope", claim.leaseToken))
      .rejects.toBeInstanceOf(FenceError);

    // Audit: one lease_expired event.
    const events = await getDb().select().from(runEvents).where(eq(runEvents.runId, run.id));
    const expired = events.filter((e) => e.type === "lease_expired");
    expect(expired.length).toBe(1);
    expect((expired[0]!.payload as { recycledTo?: string }).recycledTo).toBe("ready");
  });

  // ── 5. Recovery bounded by max attempts ────────────────────────
  it("sweeper: lease expiry recycles while attempts remain, then fails permanently", { timeout: 120_000 }, async () => {
    const { project, spec, revisionId } = await makeChain(ownerA);
    const run = await makeQuietRun(ownerA, spec, revisionId, project.id);
    await setNodeStateRaw(run.id, "scope", "running", {
      leaseToken: "11111111-1111-1111-1111-111111111111",
      leaseExpiresAt: new Date(Date.now() - 5_000),
      attempts: NODE_MAX_ATTEMPTS, // exhausted
    });
    const swept = await sweepExpiredLeases({ runId: run.id });
    expect(swept.failed).toEqual(["scope"]);
    const node = await getNode(run.id, "scope");
    expect(node.state).toBe("failed");
    expect(node.leaseToken).toBeNull();

    // Complete with the swept token is fenced.
    await expect(
      completeClaimedNode(run.id, "scope", "11111111-1111-1111-1111-111111111111"),
    ).rejects.toBeInstanceOf(FenceError);
  });

  // ── 6. Atomic usage accounting (no lost updates) ───────────────
  it("usage accounting: concurrent increments never lose token/call counts", { timeout: 120_000 }, async () => {
    const { project, spec, revisionId } = await makeChain(ownerA);
    const run = await makeQuietRun(ownerA, spec, revisionId, project.id);
    await setNodeStateRaw(run.id, "scope", "ready");
    const w = await workerForNode(project.id, spec, "scope");
    const claim = (await claimNextNode(run, w))!;
    await setNodeStateRaw(run.id, "scope", "running", { leaseToken: claim.leaseToken });

    const N = 10;
    const results = await Promise.all(
      Array.from({ length: N }, () =>
        addNodeUsage(claim.node.id, claim.leaseToken, { tokens: 7, calls: 1 }),
      ),
    );
    expect(results.every(Boolean)).toBe(true);
    const node = await getNode(run.id, "scope");
    expect(node.tokensUsed).toBe(N * 7);
    expect(node.callsUsed).toBe(N);

    // Wrong token loses everything.
    const bad = await addNodeUsage(claim.node.id, "bad-token", { tokens: 100, calls: 100 });
    expect(bad).toBe(false);
    const after = await getNode(run.id, "scope");
    expect(after.tokensUsed).toBe(N * 7);
  });

  // ── 7. createRun rollback (no half-created run) ────────────────
  it("createRun is transactional: a mid-graph failure leaves zero residual rows", { timeout: 120_000 }, async () => {
    const { project, spec, revisionId } = await makeChain(ownerA);
    const db = getDb();
    const sabotaged: NodeSpec[] = spec.nodes.map((n, i) =>
      i === 2 ? { ...n, key: spec.nodes[0]!.key } : n, // duplicate nodeKey → constraint violation at node 3
    );
    await expect(
      createRunGraph({
        projectId: project.id,
        dagRevisionId: revisionId,
        mode: "mock",
        providerId: "mock",
        model: "mock-deterministic",
        budget: spec.budget,
        startedBy: ownerA.id,
        nodes: sabotaged,
      }),
    ).rejects.toThrow();
    const [runRows, agentRows, nodeRows] = await Promise.all([
      db.select().from(runs).where(eq(runs.projectId, project.id)),
      db.select().from(agents).where(eq(agents.projectId, project.id)),
      db
        .select()
        .from(runNodes)
        .innerJoin(runs, eq(runNodes.runId, runs.id))
        .where(eq(runs.projectId, project.id)),
    ]);
    expect(runRows.length).toBe(0);
    expect(agentRows.length).toBe(0);
    expect(nodeRows.length).toBe(0);
  });

  // ── 8. No double approval (pending-state guard) ────────────────
  it("approvals.decide: two concurrent decides — exactly one succeeds", { timeout: 120_000 }, async () => {
    const { caller, project, spec, revisionId } = await makeChain(ownerA);
    const run = await makeQuietRun(ownerA, spec, revisionId, project.id);
    const db = getDb();
    const [row] = await db.insert(approvals).values({
      runId: run.id,
      nodeKey: "evidence",
      kind: "plan",
      payload: { note: "concurrency probe" },
      state: "pending",
    });
    const approvalId = Number(row.insertId);
    const results = await Promise.allSettled([
      caller.approvals.decide({ approvalId, decision: "approved", note: "first" }),
      caller.approvals.decide({ approvalId, decision: "rejected", note: "second" }),
    ]);
    const ok = results.filter((r) => r.status === "fulfilled");
    expect(ok.length).toBe(1);
    await stopRun(run.id, "tester"); // an "approved" win triggers advancement
    const final = await db.query.approvals.findFirst({ where: eq(approvals.id, approvalId) });
    // A second decide after the fact is a clean BAD_REQUEST.
    await expectTrpcCode(
      caller.approvals.decide({ approvalId, decision: "approved", note: "too late" }),
      "BAD_REQUEST",
    );
    expect(["approved", "rejected"]).toContain(final!.state);
  });

  // ── 9. Pause fences leases; resume re-dispatches ───────────────
  it("pause fences in-flight leases and blocks advancement; resume continues", { timeout: 120_000 }, async () => {
    const { project, spec, revisionId } = await makeChain(ownerA);
    const run = await makeQuietRun(ownerA, spec, revisionId, project.id);
    await setNodeStateRaw(run.id, "scope", "running", {
      leaseToken: "22222222-2222-2222-2222-222222222222",
      leaseWorkerId: null,
      leaseExpiresAt: new Date(Date.now() + 60_000),
    });
    await getDb().update(runs).set({ state: "running" }).where(eq(runs.id, run.id));

    await pauseRun(run.id, "tester");
    const paused = (await getDb().query.runs.findFirst({ where: eq(runs.id, run.id) }))!;
    expect(paused.state).toBe("paused");
    const node = await getNode(run.id, "scope");
    expect(node.state).toBe("ready"); // lease revoked, fenced
    expect(node.leaseToken).toBeNull();

    // Late heartbeat from the fenced holder loses.
    await expect(heartbeatLease(run.id, "scope", "22222222-2222-2222-2222-222222222222", 30))
      .rejects.toBeInstanceOf(FenceError);

    await resumeRun(run.id, "tester");
    const resumed = (await getDb().query.runs.findFirst({ where: eq(runs.id, run.id) }))!;
    expect(resumed.state).toBe("running");
    await stopRun(run.id, "tester");
  });

  // ── 10. Cancellation propagation ───────────────────────────────
  it("cancel propagates downstream, preserves accepted upstream, fences leases", { timeout: 120_000 }, async () => {
    const { project, spec, revisionId } = await makeChain(ownerA);
    const run = await makeQuietRun(ownerA, spec, revisionId, project.id);
    await setNodeStateRaw(run.id, "scope", "accepted");
    await setNodeStateRaw(run.id, "evidence", "running", {
      leaseToken: "33333333-3333-3333-3333-333333333333",
      leaseExpiresAt: new Date(Date.now() + 60_000),
    });
    const cancelled = await cancelNodeCascade(run.id, "evidence", "tester");
    // Expected: evidence + every downstream node (BFS over spec.edges).
    const expected = new Set(["evidence"]);
    let frontier = ["evidence"];
    while (frontier.length) {
      const next: string[] = [];
      for (const e of spec.edges) {
        if (frontier.includes(e.from) && !expected.has(e.to)) {
          expected.add(e.to);
          next.push(e.to);
        }
      }
      frontier = next;
    }
    expect(cancelled.sort()).toEqual([...expected].sort());
    expect((await getNode(run.id, "scope")).state).toBe("accepted"); // untouched
    expect((await getNode(run.id, "evidence")).leaseToken).toBeNull();
    // Terminal nodes are not re-cancelled.
    await expect(cancelNodeCascade(run.id, "evidence", "tester")).rejects.toBeInstanceOf(FenceError);
  });

  // ── 11. Idempotency keys ───────────────────────────────────────
  it("idempotency: replayed claim key returns the stored response, one claim only", { timeout: 120_000 }, async () => {
    const { caller, project, spec, revisionId } = await makeChain(ownerA);
    const run = await makeQuietRun(ownerA, spec, revisionId, project.id);
    await setNodeStateRaw(run.id, "scope", "ready");
    const w = await workerForNode(project.id, spec, "scope");
    const key = `claim-${stamp}-1`;
    const r1 = await caller.control.claim({ runId: run.id, workerId: w.id, idempotencyKey: key });
    expect(r1.claimed).toBeTruthy();
    const r2 = await caller.control.claim({ runId: run.id, workerId: w.id, idempotencyKey: key });
    // Replayed verbatim (the stored response is JSON; Dates come back as ISO strings).
    expect(r2.claimed?.nodeKey).toBe(r1.claimed?.nodeKey);
    expect(r2.claimed?.leaseToken).toBe(r1.claimed?.leaseToken);
    expect(r2.claimed?.attempt).toBe(r1.claimed?.attempt);
    const node = await getNode(run.id, "scope");
    expect(node.attempts).toBe(1); // claimed exactly once
  });

  // ── 12. Queries have no write side effects ─────────────────────
  it("runs.get and events.tail are pure reads (no advancement, no events)", { timeout: 120_000 }, async () => {
    const { caller, project, spec, revisionId } = await makeChain(ownerA);
    const run = await makeQuietRun(ownerA, spec, revisionId, project.id);
    const db = getDb();
    const before = await db.select().from(runEvents).where(eq(runEvents.runId, run.id));
    for (let i = 0; i < 3; i++) {
      const got = await caller.runs.get({ id: run.id });
      expect(got.run.state).toBe("queued"); // never auto-advanced by a query
      expect(got.nodes.every((n) => n.state === "pending")).toBe(true);
      await caller.events.tail({ runId: run.id, afterSeq: 0, limit: 100 });
    }
    const after = await db.select().from(runEvents).where(eq(runEvents.runId, run.id));
    expect(after.length).toBe(before.length); // zero writes from queries
    const fresh = (await db.query.runs.findFirst({ where: eq(runs.id, run.id) }))!;
    expect(fresh.state).toBe("queued");
    expect(fresh.version).toBe(1);
  });

  // ── 13. Cross-owner denial ─────────────────────────────────────
  it("cross-owner denial on every control-plane surface", { timeout: 120_000 }, async () => {
    const { project, spec, revisionId } = await makeChain(ownerA);
    const run = await makeQuietRun(ownerA, spec, revisionId, project.id);
    await setNodeStateRaw(run.id, "scope", "ready");
    const w = await workerForNode(project.id, spec, "scope");
    const b = callerFor(ownerB);
    await expectTrpcCode(b.control.roadmapStatus({ runId: run.id }), "NOT_FOUND");
    await expectTrpcCode(b.control.claim({ runId: run.id, workerId: w.id }), "NOT_FOUND");
    await expectTrpcCode(
      b.control.heartbeat({ runId: run.id, nodeKey: "scope", leaseToken: "x" }),
      "NOT_FOUND",
    );
    await expectTrpcCode(
      b.control.cancel({ runId: run.id, nodeKey: "scope" }),
      "NOT_FOUND",
    );
    await expectTrpcCode(b.control.sweep({ runId: run.id }), "NOT_FOUND");
    await expectTrpcCode(b.control.pool.status({ projectId: project.id }), "NOT_FOUND");
    await expectTrpcCode(b.control.pool.pause({ projectId: project.id }), "NOT_FOUND");
    await expectTrpcCode(b.control.workers.list({ projectId: project.id }), "NOT_FOUND");
    await expectTrpcCode(b.control.workers.setStatus({ workerId: w.id, status: "suspended" }), "NOT_FOUND");
    await expectTrpcCode(
      b.control.workers.setCapacity({ workerId: w.id, maxConcurrentClaims: 4 }),
      "NOT_FOUND",
    );
    // Anonymous
    const anon = callerFor(undefined);
    await expectTrpcCode(anon.control.roadmapStatus({ runId: run.id }), "UNAUTHORIZED");
    await expectTrpcCode(anon.control.workers.list({ projectId: project.id }), "UNAUTHORIZED");
  });

  // ── 14. Worker registration + capacity via API ─────────────────
  it("workers.register/setCapacity/pool surfaces work owner-scoped", { timeout: 120_000 }, async () => {
    const { caller, project } = await makeChain(ownerA);
    const reg = await caller.control.workers.register({
      projectId: project.id,
      name: `api-worker-${stamp}`,
      kind: "subagent",
      role: "Research Scientist",
      capabilities: ["read"],
      skillRefs: [],
      maxConcurrentClaims: 2,
      leaseTtlSeconds: 60,
      idempotencyKey: `reg-${stamp}`,
    });
    expect(reg.ok).toBe(true);
    // Replay returns the same response, no duplicate row.
    const replay = await caller.control.workers.register({
      projectId: project.id,
      name: `api-worker-${stamp}`,
      kind: "subagent",
      role: "Research Scientist",
      capabilities: ["read"],
      skillRefs: [],
      idempotencyKey: `reg-${stamp}`,
    });
    expect(replay).toEqual(reg);
    const list = await caller.control.workers.list({ projectId: project.id });
    expect(list.filter((x) => x.name === `api-worker-${stamp}`).length).toBe(1);
    const w = list.find((x) => x.name === `api-worker-${stamp}`)!;
    createdWorkerIds.push(w.id);
    expect(w.maxConcurrentClaims).toBe(2);
    await caller.control.workers.setCapacity({ workerId: w.id, maxConcurrentClaims: 4 });
    const after = await caller.control.workers.list({ projectId: project.id });
    expect(after.find((x) => x.id === w.id)!.maxConcurrentClaims).toBe(4);
    // Duplicate name without a key is a CONFLICT.
    await expectTrpcCode(
      caller.control.workers.register({
        projectId: project.id,
        name: `api-worker-${stamp}`,
        kind: "subagent",
        role: "Research Scientist",
      }),
      "CONFLICT",
    );
    const pool = await caller.control.pool.status({ projectId: project.id });
    expect(pool.workers.some((x) => x.id === w.id)).toBe(true);
  });

  // ── 15. Full mock lifecycle through the claim-driven engine ────
  it("mock run lifecycle: claim events present, budgets and approvals intact", { timeout: 120_000 }, async () => {
    const { caller, project, spec, revisionId } = await makeChain(ownerA);
    const run = await caller.runs.start({
      projectId: project.id,
      dagRevisionId: revisionId,
      mode: "mock",
      provider: "mock",
    });
    createdRunIds.push(run.id);
    // synthesize has an accept gate in the mock proposal.
    const paused = await waitRunState(caller, run.id, ["awaiting_approval", "completed"]);
    if (paused.run.state === "awaiting_approval") {
      const gate = paused.pendingApprovals[0]!;
      await caller.approvals.decide({ approvalId: gate.id, decision: "approved", note: "ok" });
    }
    const done = await waitRunState(caller, run.id, ["completed"]);
    expect(done.nodes.every((n) => n.state === "accepted")).toBe(true);

    const events = await caller.events.tail({ runId: run.id, afterSeq: 0, limit: 500 });
    events.forEach((e, i) => expect(e.seq).toBe(i + 1));
    // Nodes went through the claim protocol (claimed → running → accepted).
    const claimed = events.filter(
      (e) => e.type === "node_state" && (e.payload as { state?: string }).state === "claimed",
    );
    expect(claimed.length).toBe(spec.nodes.length);
    // Ledger and artifact idempotency identity.
    const ledger = await caller.ledger.byRun({ runId: run.id });
    expect(ledger.length).toBe(spec.nodes.length);
    expect(ledger.every((l) => l.attempt === 1)).toBe(true);
    const arts = await caller.artifacts.listByRun({ runId: run.id });
    expect(arts.length).toBe(spec.nodes.length);
    expect(arts.every((a) => a.attempt === 1 && a.accepted)).toBe(true);
    // Director worker row exists ("worker 0").
    const pool = await caller.control.pool.status({ projectId: project.id });
    expect(pool.workers.some((w) => w.kind === "director")).toBe(true);
    // Roadmap status exposes nodes + leases shape.
    const status = await caller.control.roadmapStatus({ runId: run.id });
    expect(status.nodes.length).toBe(spec.nodes.length);
  });

  // ── 16. Pump endpoint dispatches one claimed node ──────────────
  it("control.pump claims and dispatches exactly one eligible node", { timeout: 120_000 }, async () => {
    const { caller, project, spec, revisionId } = await makeChain(ownerA);
    const run = await makeQuietRun(ownerA, spec, revisionId, project.id);
    const r1 = await caller.control.pump({ runId: run.id });
    expect(r1.pumped).toBeTruthy();
    expect((await getNode(run.id, "scope")).state).toBe("accepted");
    // Only one node dispatched; the rest are still pending.
    expect((await getNode(run.id, "evidence")).state).toBe("pending");
    const r2 = await caller.control.pump({ runId: run.id });
    expect(r2.pumped?.nodeKey).toBe("evidence");
    await stopRun(run.id, "tester");
  });
});
