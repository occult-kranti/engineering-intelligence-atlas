import "dotenv/config";
import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { and, eq, inArray, sql } from "drizzle-orm";
import { appRouter } from "./router";
import { getDb } from "./queries/connection";
import {
  artifacts,
  assistantJobs,
  assistantProposals,
  assistantQueueItems,
  assistantWorkQueues,
  budgetLedger,
  dagRevisions,
  enterpriseCompanies,
  enterpriseDepartments,
  enterprises,
  knowledgeTransfers,
  projects,
  repoAssignmentPlans,
  repositoryRecords,
  runNodes,
  runs,
  studyQueueItems,
  users,
  workerContracts,
  workers,
  type User,
} from "@db/schema";
import { ZERO_RESERVATION, sha256Hex } from "@contracts/enterprise";
import { defaultRunBudget } from "@contracts/dag";
import {
  AssistantError,
  assistantStatus,
  decideProposal,
  executeProposal,
  intakeRepository,
  proposeAction,
  runDirectAction,
  sweepAssistantJobs,
} from "./assistant";
import { releaseContract } from "./enterprise";
import { stopRun } from "./engine/scheduler";

/**
 * Donna / shared assistants serial DB suite (real TiDB, serial within this
 * file — never run concurrently with another DB suite): migration liveness,
 * owner scoping, proposal OCC/concurrent decide, schedule crash/replay and
 * the bounded sweep, fire-with-in-flight drain + artifact preservation,
 * repository credential gates/SSRF/plan-state honesty, knowledge refs,
 * queue/study caps, and the emergency-stop exclusion.
 */

const DB_OK = !!process.env.DATABASE_URL;
const stamp = Date.now().toString(36);
let ownerA: User;
let ownerB: User;

type Caller = ReturnType<typeof appRouter.createCaller>;
function callerFor(user?: User): Caller {
  return appRouter.createCaller({
    req: new Request("http://assistant.test/"),
    resHeaders: new Headers(),
    ...(user ? { user } : {}),
  });
}
async function expectTrpcCode(p: Promise<unknown>, code: string) {
  await expect(p).rejects.toMatchObject({ code });
}

const PLAN_GATE = { approved: true as const, confirmedGates: ["plan-approval" as const] };
const FIRE_GATES = {
  approved: true as const,
  confirmedGates: ["high-risk" as const, "plan-approval" as const],
};
const IMPORT_GATES = {
  approved: true as const,
  confirmedGates: ["external-writes" as const, "credentials" as const, "high-risk" as const],
};

let ent = 0; // main enterprise
let entJobs = 0; // isolated enterprise for schedule sweeps
let softProject = 0;
let sharedProject = 0;
let softCompanyId = 0;
let deptId = 0;

async function makeEnterprise(owner: User, tag: string): Promise<number> {
  const db = getDb();
  const [row] = await db.insert(enterprises).values({
    ownerId: owner.id,
    slug: `ast-${tag}-${stamp}`,
    name: `Assistant ${tag} ${stamp}`,
    goal: "assistant serial test",
    status: "active",
    budget: { maxTokens: 1_000_000, maxCalls: 100, maxMinutes: 60, maxCostUsdMicros: 10_000_000 },
  });
  return Number(row.insertId);
}

async function dueJobCount(enterpriseId: number): Promise<number> {
  const db = getDb();
  const [row] = await db
    .select({ n: sql<number>`COUNT(*)` })
    .from(assistantJobs)
    .where(
      and(
        eq(assistantJobs.enterpriseId, enterpriseId),
        eq(assistantJobs.enabled, true),
        sql`${assistantJobs.nextRunAt} IS NOT NULL AND ${assistantJobs.nextRunAt} <= ${Date.now()}`,
      ),
    );
  return Number(row?.n ?? 0);
}

async function insertDueJobs(enterpriseId: number, count: number, prefix: string): Promise<void> {
  const db = getDb();
  const now = Date.now();
  for (let i = 0; i < count; i++) {
    await db.insert(assistantJobs).values({
      ownerId: ownerA.id,
      enterpriseId,
      jobKey: `${prefix}-${i}`,
      scope: "enterprise",
      kind: "cache_refresh",
      schedule: { type: "one-time", runAt: now - 1000 },
      enabled: true,
      nextRunAt: now - 1000,
      runCount: 0,
      maxRuns: 1,
      budget: ZERO_RESERVATION,
    });
  }
}

describe.skipIf(!DB_OK)("assistant backend (real DB)", { timeout: 180_000 }, () => {
  beforeAll(async () => {
    const db = getDb();
    const [a] = await db.insert(users).values({ unionId: `ast-a-${stamp}`, name: "Ast Owner A" });
    const [b] = await db.insert(users).values({ unionId: `ast-b-${stamp}`, name: "Ast Owner B" });
    ownerA = (await db.query.users.findFirst({ where: eq(users.id, Number(a.insertId)) }))!;
    ownerB = (await db.query.users.findFirst({ where: eq(users.id, Number(b.insertId)) }))!;
    ent = await makeEnterprise(ownerA, "main");
    entJobs = await makeEnterprise(ownerA, "jobs");

    const [p1] = await db
      .insert(projects)
      .values({ ownerId: ownerA.id, name: `ast-soft-${stamp}`, goal: "line company" });
    const [p2] = await db
      .insert(projects)
      .values({ ownerId: ownerA.id, name: `ast-shared-${stamp}`, goal: "shared services" });
    softProject = Number(p1.insertId);
    sharedProject = Number(p2.insertId);
    const [c1] = await db.insert(enterpriseCompanies).values({
      enterpriseId: ent,
      key: "soft",
      name: "Software Co",
      kind: "line",
      mission: "build software",
      disciplines: ["backend-engineering"],
      capacityShare: 60,
      projectId: softProject,
    });
    softCompanyId = Number(c1.insertId);
    const [c2] = await db.insert(enterpriseCompanies).values({
      enterpriseId: ent,
      key: "shared",
      name: "Shared Services",
      kind: "shared-services",
      mission: "operate shared departments",
      disciplines: ["backend-engineering"],
      capacityShare: 40,
      projectId: sharedProject,
    });
    const [d1] = await db.insert(enterpriseDepartments).values({
      enterpriseId: ent,
      key: "svc-backend",
      companyId: Number(c2.insertId),
      name: "Backend Engineering",
      discipline: "backend-engineering",
    });
    deptId = Number(d1.insertId);
    await db.insert(workerContracts).values({
      enterpriseId: ent,
      key: "wc-backend",
      companyId: softCompanyId,
      departmentId: deptId,
      discipline: "backend-engineering",
      status: "proposed",
      capacityShare: 0.5,
      skillPin: { skillId: "agent-research-director", version: "1.0.0", sha256: null },
      staffed: true,
    });
  }, 60_000);

  afterAll(async () => {
    const db = getDb();
    const entRuns = await db
      .select({ id: runs.id, state: runs.state })
      .from(runs)
      .where(eq(runs.enterpriseId, ent));
    for (const r of entRuns) {
      try {
        if (r.state === "running" || r.state === "queued") await stopRun(r.id, "assistant-test-cleanup");
      } catch {
        /* already terminal */
      }
    }
  }, 60_000);

  // ── 1. Migration ───────────────────────────────────────────────

  it("migration 0006 is live and additive", async () => {
    const db = getDb();
    const [tables] = await db.execute(
      sql`SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN ('assistant_jobs','assistant_proposals','assistant_work_queues','assistant_queue_items','study_queue_items','repository_records','repo_assignment_plans','knowledge_transfers')`,
    );
    const names = (tables as unknown as { TABLE_NAME: string }[]).map((r) => r.TABLE_NAME).sort();
    expect(names).toEqual([
      "assistant_jobs",
      "assistant_proposals",
      "assistant_queue_items",
      "assistant_work_queues",
      "knowledge_transfers",
      "repo_assignment_plans",
      "repository_records",
      "study_queue_items",
    ]);
    const [cols] = await db.execute(
      sql`SELECT COLUMN_NAME, COLUMN_DEFAULT FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'enterprise_departments' AND COLUMN_NAME = 'status'`,
    );
    expect((cols as unknown as { COLUMN_NAME: string }[])[0]?.COLUMN_NAME).toBe("status");
    const [ccols] = await db.execute(
      sql`SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'enterprise_companies' AND COLUMN_NAME = 'archived_at'`,
    );
    expect((ccols as unknown as unknown[]).length).toBe(1);
    // Additive: pre-existing enterprise tables are untouched.
    const [old] = await db.execute(
      sql`SELECT COUNT(*) AS n FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN ('enterprises','enterprise_companies','enterprise_departments','worker_contracts','enterprise_programs','enterprise_events','memory_entries')`,
    );
    expect(Number((old as unknown as { n: number }[])[0]?.n)).toBe(7);
  });

  // ── 2. Owner scoping ───────────────────────────────────────────

  it("denies cross-owner access at the API and tRPC layers", async () => {
    await expect(assistantStatus(ownerB.id, ent)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      proposeAction(ownerB, ent, {
        scope: "enterprise",
        actor: "donna",
        action: "cache.invalidate",
        payload: { namespace: "snapshot" },
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(assistantStatus(ownerA.id, 999_999_999)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    const callerB = callerFor(ownerB);
    await expectTrpcCode(callerB.assistant.status({ enterpriseId: ent }), "FORBIDDEN");
    await expectTrpcCode(
      callerB.assistant.propose({
        enterpriseId: ent,
        scope: "enterprise",
        actor: "donna",
        action: "cache.invalidate",
        payload: { namespace: "snapshot" },
      }),
      "FORBIDDEN",
    );
    const callerA = callerFor(ownerA);
    const status = await callerA.assistant.status({ enterpriseId: ent });
    expect(status.definitions.donna.scope).toBe("enterprise");
  });

  // ── 3. Proposal lifecycle: OCC, concurrent decide, gates ───────

  it("runs propose → decide → execute with OCC and event/version bumps", async () => {
    const before = (await getDb().query.enterprises.findFirst({ where: eq(enterprises.id, ent) }))!;
    const { proposal } = await proposeAction(ownerA, ent, {
      scope: "enterprise",
      actor: "donna",
      action: "queue.add",
      payload: {
        scopeKey: "",
        item: { itemKey: "item-1", itemKind: "custom", refId: "", title: "First task" },
      },
    });
    expect(proposal.status).toBe("proposed");
    expect(proposal.expectedVersion).toBe(before.version);
    expect(proposal.payloadHash).toMatch(/^[0-9a-f]{64}$/);

    const decided = await decideProposal(ownerA, proposal.id, "approved", []);
    expect(decided.status).toBe("approved");
    // queue.add needs no approval — but approval is harmless. Execute.
    const executed = await executeProposal(ownerA, proposal.id);
    expect(executed.status).toBe("executed");
    const after = (await getDb().query.enterprises.findFirst({ where: eq(enterprises.id, ent) }))!;
    expect(after.version).toBe(before.version + 1);
    // Re-execute is an idempotent replay.
    const replay = await executeProposal(ownerA, proposal.id);
    expect(replay.status).toBe("executed");
    const queue = await getDb().query.assistantQueueItems.findFirst({
      where: eq(assistantQueueItems.itemKey, "item-1"),
    });
    expect(queue?.title).toBe("First task");
    // Assistant events are appended to the enterprise stream.
    const events = await callerFor(ownerA).assistant.events({ enterpriseId: ent });
    expect(events.some((e) => e.type === "assistant_proposal_executed")).toBe(true);
  });

  it("enforces OCC: executing against a stale version conflicts", async () => {
    const { proposal } = await proposeAction(ownerA, ent, {
      scope: "enterprise",
      actor: "donna",
      action: "cache.invalidate",
      payload: { namespace: "snapshot" },
    });
    // Another mutation advances the enterprise version first.
    await runDirectAction(ownerA, ent, {
      scope: "enterprise",
      actor: "donna",
      action: "cache.invalidate",
      payload: { namespace: "snapshot" },
      id: `occ-bump-${stamp}`,
    });
    await expect(executeProposal(ownerA, proposal.id)).rejects.toMatchObject({
      code: "CONFLICT",
    });
  });

  it("allows exactly one winner on concurrent decide", async () => {
    const { proposal } = await proposeAction(ownerA, ent, {
      id: `race-${stamp}`,
      scope: "enterprise",
      actor: "donna",
      action: "schedule.upsert",
      payload: {
        jobKey: `race-job-${stamp}`,
        kind: "cache_refresh",
        schedule: { type: "one-time", runAt: Date.now() + 3_600_000 },
      },
    });
    const results = await Promise.allSettled([
      decideProposal(ownerA, proposal.id, "approved", ["plan-approval"]),
      decideProposal(ownerA, proposal.id, "approved", ["plan-approval"]),
    ]);
    const ok = results.filter((r) => r.status === "fulfilled");
    // Exactly one decide wins; the loser gets CONFLICT (lost the status CAS)
    // or BAD_STATE (re-read after the winner committed). No lost update.
    const lost = results.filter(
      (r) =>
        r.status === "rejected" &&
        ["CONFLICT", "BAD_STATE"].includes((r.reason as AssistantError).code),
    );
    expect(ok).toHaveLength(1);
    expect(lost).toHaveLength(1);
    await expect(decideProposal(ownerA, proposal.id, "rejected", [])).rejects.toMatchObject({
      code: "BAD_STATE",
    });
  });

  it("enforces gates and drain+preserve at decide time", async () => {
    // schedule.upsert requires the plan-approval gate.
    const { proposal: gated } = await proposeAction(ownerA, ent, {
      id: `gate-${stamp}`,
      scope: "enterprise",
      actor: "donna",
      action: "schedule.upsert",
      payload: {
        jobKey: `gate-job-${stamp}`,
        kind: "cache_refresh",
        schedule: { type: "one-time", runAt: Date.now() + 3_600_000 },
      },
    });
    await expect(decideProposal(ownerA, gated.id, "approved", [])).rejects.toMatchObject({
      code: "GATE_NOT_CONFIRMED",
    });
    // worker.fire without {drain:true,preserveArtifacts:true} fails validation.
    const { proposal: fire } = await proposeAction(ownerA, ent, {
      id: `fire-nodrain-${stamp}`,
      scope: "enterprise",
      actor: "donna",
      action: "worker.fire",
      payload: { contractKey: "wc-backend" },
    });
    await expect(
      decideProposal(ownerA, fire.id, "approved", ["high-risk", "plan-approval"]),
    ).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("rejects emergency-stop-flavoured and unknown actions", async () => {
    await expect(
      proposeAction(ownerA, ent, {
        scope: "enterprise",
        actor: "donna",
        action: "emergency.stop" as never,
        payload: {},
      }),
    ).rejects.toThrowError(/unknown action/);
    await expect(
      proposeAction(ownerA, ent, {
        scope: "enterprise",
        actor: "donna",
        action: "program.stop" as never,
        payload: {},
      }),
    ).rejects.toThrowError(/unknown action/);
  });

  // ── 4. Work queues ─────────────────────────────────────────────

  it("adds and reorders queue items with dense positions and OCC", async () => {
    for (const key of ["q-a", "q-b", "q-c"]) {
      await runDirectAction(ownerA, ent, {
        scope: "company",
        actor: "company-operations-assistant",
        action: "queue.add",
        payload: { scopeKey: "soft", item: { itemKey: key, itemKind: "custom", refId: "", title: key } },
        id: `qadd-${key}-${stamp}`,
      });
    }
    const caller = callerFor(ownerA);
    const view = await caller.assistant.queueGet({ enterpriseId: ent, scope: "company", scopeKey: "soft" });
    expect(view.items.map((i) => i.itemKey)).toEqual(["q-a", "q-b", "q-c"]);
    expect(view.items.map((i) => i.position)).toEqual([0, 1, 2]);

    const reordered = await caller.assistant.queueReorder({
      enterpriseId: ent,
      scope: "company",
      scopeKey: "soft",
      order: ["q-c", "q-a", "q-b"],
      expectedQueueVersion: view.queue!.version,
    });
    expect(reordered.items.map((i) => i.itemKey)).toEqual(["q-c", "q-a", "q-b"]);
    expect(reordered.items.map((i) => i.position)).toEqual([0, 1, 2]);

    // Stale OCC version → CONFLICT.
    await expectTrpcCode(
      caller.assistant.queueReorder({
        enterpriseId: ent,
        scope: "company",
        scopeKey: "soft",
        order: ["q-a", "q-b", "q-c"],
        expectedQueueVersion: view.queue!.version,
      }),
      "CONFLICT",
    );
    // Wrong key set → VALIDATION (400).
    await expectTrpcCode(
      caller.assistant.queueReorder({
        enterpriseId: ent,
        scope: "company",
        scopeKey: "soft",
        order: ["q-a", "q-b"],
      }),
      "BAD_REQUEST",
    );
  });

  // ── 5. Study queue caps / dedupe ───────────────────────────────

  it("enqueues capped, deduped, provider-free study drafts", async () => {
    const first = await runDirectAction(ownerA, ent, {
      scope: "department",
      actor: "department-coordinator",
      action: "study.enqueue",
      payload: { skillId: "agent-research-director", goal: "study the research director skill" },
      id: `study-${stamp}`,
    });
    expect(first.proposal.status).toBe("executed");
    const db = getDb();
    const items = await db
      .select()
      .from(studyQueueItems)
      .where(eq(studyQueueItems.enterpriseId, ent));
    expect(items.length).toBeGreaterThan(0);
    expect(items.length).toBeLessThanOrEqual(32);
    expect(items.every((i) => i.status === "draft")).toBe(true);
    // Idempotent re-enqueue: same content-derived keys, no growth.
    await runDirectAction(ownerA, ent, {
      scope: "department",
      actor: "department-coordinator",
      action: "study.enqueue",
      payload: { skillId: "agent-research-director", goal: "study the research director skill" },
      id: `study-2-${stamp}`,
    });
    const after = await db
      .select()
      .from(studyQueueItems)
      .where(eq(studyQueueItems.enterpriseId, ent));
    expect(after.length).toBe(items.length);
  });

  // ── 6. Schedules: sweep bounds, storms, crash replay ───────────

  it("upserts/pauses/resumes/deletes jobs and runs one-time jobs exactly once", async () => {
    const up = await runDirectAction(ownerA, entJobs, {
      scope: "enterprise",
      actor: "donna",
      action: "schedule.upsert",
      payload: {
        jobKey: "once-1",
        kind: "cache_refresh",
        schedule: { type: "one-time", runAt: Date.now() - 1000 },
      },
      confirmation: PLAN_GATE,
      id: `job-up-1-${stamp}`,
    });
    expect(up.proposal.status).toBe("executed");
    await sweepAssistantJobs({ limit: 25 });
    const db = getDb();
    const job = await db.query.assistantJobs.findFirst({
      where: and(eq(assistantJobs.enterpriseId, entJobs), eq(assistantJobs.jobKey, "once-1")),
    });
    expect(job?.runCount).toBe(1);
    expect(job?.nextRunAt).toBeNull(); // one-time terminator
    // Crash-replay safety: re-sweeping never re-runs the claimed firing.
    await sweepAssistantJobs({ limit: 25 });
    const again = await db.query.assistantJobs.findFirst({
      where: and(eq(assistantJobs.enterpriseId, entJobs), eq(assistantJobs.jobKey, "once-1")),
    });
    expect(again?.runCount).toBe(1);

    // Pause/resume/delete via the direct controls.
    await runDirectAction(ownerA, entJobs, {
      scope: "enterprise",
      actor: "donna",
      action: "schedule.upsert",
      payload: {
        jobKey: "pause-me",
        kind: "ledger_refresh",
        schedule: { type: "interval", intervalMs: 60_000, anchorAt: Date.now() + 60_000 },
      },
      confirmation: PLAN_GATE,
      id: `job-up-2-${stamp}`,
    });
    await runDirectAction(ownerA, entJobs, {
      scope: "enterprise",
      actor: "donna",
      action: "schedule.pause",
      payload: { jobKey: "pause-me" },
      id: `job-pause-${stamp}`,
    });
    let row = await db.query.assistantJobs.findFirst({
      where: and(eq(assistantJobs.enterpriseId, entJobs), eq(assistantJobs.jobKey, "pause-me")),
    });
    expect(row?.enabled).toBe(false);
    expect(row?.nextRunAt).toBeNull();
    await runDirectAction(ownerA, entJobs, {
      scope: "enterprise",
      actor: "donna",
      action: "schedule.resume",
      payload: { jobKey: "pause-me" },
      id: `job-resume-${stamp}`,
    });
    row = await db.query.assistantJobs.findFirst({
      where: and(eq(assistantJobs.enterpriseId, entJobs), eq(assistantJobs.jobKey, "pause-me")),
    });
    expect(row?.enabled).toBe(true);
    expect(row?.nextRunAt).not.toBeNull();
    await runDirectAction(ownerA, entJobs, {
      scope: "enterprise",
      actor: "donna",
      action: "schedule.delete",
      payload: { jobKey: "pause-me" },
      id: `job-del-${stamp}`,
    });
    row = await db.query.assistantJobs.findFirst({
      where: and(eq(assistantJobs.enterpriseId, entJobs), eq(assistantJobs.jobKey, "pause-me")),
    });
    expect(row).toBeUndefined();
  });

  it("skips missed intervals forward (no missed-run storm)", async () => {
    const db = getDb();
    const tenDaysAgo = Date.now() - 10 * 24 * 3600 * 1000;
    await db.insert(assistantJobs).values({
      ownerId: ownerA.id,
      enterpriseId: entJobs,
      jobKey: "storm-check",
      scope: "enterprise",
      kind: "cache_refresh",
      schedule: { type: "interval", intervalMs: 60_000, anchorAt: tenDaysAgo },
      enabled: true,
      nextRunAt: tenDaysAgo,
      runCount: 0,
      maxRuns: null,
      budget: ZERO_RESERVATION,
    });
    await sweepAssistantJobs({ limit: 25 });
    const row = await db.query.assistantJobs.findFirst({
      where: and(eq(assistantJobs.enterpriseId, entJobs), eq(assistantJobs.jobKey, "storm-check")),
    });
    // 14_400 missed intervals collapse into exactly one run; next is in the future.
    expect(row?.runCount).toBe(1);
    expect(row!.nextRunAt!).toBeGreaterThan(Date.now());
    expect(row!.nextRunAt!).toBeLessThanOrEqual(Date.now() + 60_000);
  });

  it("bounds the sweep and never double-runs under concurrency", async () => {
    const db = getDb();
    await insertDueJobs(entJobs, 40, "bulk");
    const first = await sweepAssistantJobs({ limit: 25 });
    expect(first.claimed).toBeLessThanOrEqual(25);
    const [ranAfterFirst] = await db
      .select({ n: sql<number>`COUNT(*)` })
      .from(assistantJobs)
      .where(
        and(
          eq(assistantJobs.enterpriseId, entJobs),
          sql`${assistantJobs.jobKey} LIKE 'bulk-%'`,
          sql`${assistantJobs.runCount} > 0`,
        ),
      );
    expect(Number(ranAfterFirst?.n)).toBeLessThanOrEqual(25);
    // Drain the rest; every job runs exactly once (idempotent crash recovery).
    for (let i = 0; i < 12 && (await dueJobCount(entJobs)) > 0; i++) {
      await sweepAssistantJobs({ limit: 25 });
    }
    const [totalRuns] = await db
      .select({ n: sql<number>`COALESCE(SUM(${assistantJobs.runCount}),0)` })
      .from(assistantJobs)
      .where(and(eq(assistantJobs.enterpriseId, entJobs), sql`${assistantJobs.jobKey} LIKE 'bulk-%'`));
    expect(Number(totalRuns?.n)).toBe(40);

    // Concurrent sweepers race on the claim CAS; no job double-runs.
    await insertDueJobs(entJobs, 10, "race");
    await Promise.all([sweepAssistantJobs({ limit: 25 }), sweepAssistantJobs({ limit: 25 })]);
    const [raceRuns] = await db
      .select({ n: sql<number>`COALESCE(SUM(${assistantJobs.runCount}),0)` })
      .from(assistantJobs)
      .where(and(eq(assistantJobs.enterpriseId, entJobs), sql`${assistantJobs.jobKey} LIKE 'race-%'`));
    expect(Number(raceRuns?.n)).toBe(10);
  });

  it("runs every job kind deterministically with zero provider calls", async () => {
    const db = getDb();
    const [runsBefore] = await db
      .select({ n: sql<number>`COUNT(*)` })
      .from(runs)
      .where(eq(runs.enterpriseId, entJobs));
    const kinds = ["ledger_refresh", "program_pump_mock", "repository_sync", "study_plan"] as const;
    for (const kind of kinds) {
      await db.insert(assistantJobs).values({
        ownerId: ownerA.id,
        enterpriseId: entJobs,
        jobKey: `kind-${kind}`,
        scope: "enterprise",
        kind,
        schedule: { type: "one-time", runAt: Date.now() - 1000 },
        enabled: true,
        nextRunAt: Date.now() - 1000,
        runCount: 0,
        maxRuns: 1,
        budget: ZERO_RESERVATION,
      });
    }
    for (let i = 0; i < 8 && (await dueJobCount(entJobs)) > 0; i++) {
      await sweepAssistantJobs({ limit: 25 });
    }
    for (const kind of kinds) {
      const row = await db.query.assistantJobs.findFirst({
        where: and(eq(assistantJobs.enterpriseId, entJobs), eq(assistantJobs.jobKey, `kind-${kind}`)),
      });
      expect(row?.runCount, kind).toBe(1);
    }
    // No run was ever created: jobs make no provider calls, paid or otherwise.
    const [runsAfter] = await db
      .select({ n: sql<number>`COUNT(*)` })
      .from(runs)
      .where(eq(runs.enterpriseId, entJobs));
    expect(Number(runsAfter?.n)).toBe(Number(runsBefore?.n));
    // study_plan with no contracts drafts nothing; repository_sync queues nothing.
    const study = await db
      .select()
      .from(studyQueueItems)
      .where(eq(studyQueueItems.enterpriseId, entJobs));
    expect(study).toHaveLength(0);
  });

  // ── 7. worker.hire / worker.fire drain + artifact preservation ─

  let secondeeWorkerId = 0;

  it("hires a worker through the approved contract path", async () => {
    await expect(
      runDirectAction(ownerA, ent, {
        scope: "enterprise",
        actor: "donna",
        action: "worker.hire",
        payload: { contractKey: "wc-backend" },
        confirmation: { approved: true, confirmedGates: [] }, // missing plan-approval
        id: `hire-denied-${stamp}`,
      }),
    ).rejects.toMatchObject({ code: "GATE_NOT_CONFIRMED" });

    const hired = await runDirectAction(ownerA, ent, {
      scope: "enterprise",
      actor: "donna",
      action: "worker.hire",
      payload: { contractKey: "wc-backend" },
      confirmation: PLAN_GATE,
      id: `hire-${stamp}`,
    });
    expect(hired.proposal.status).toBe("executed");
    const db = getDb();
    const contract = await db.query.workerContracts.findFirst({
      where: and(eq(workerContracts.enterpriseId, ent), eq(workerContracts.key, "wc-backend")),
    });
    expect(contract?.status).toBe("active");
    secondeeWorkerId = contract!.secondeeWorkerId!;
    expect(secondeeWorkerId).toBeGreaterThan(0);
    const secondee = await db.query.workers.findFirst({ where: eq(workers.id, secondeeWorkerId) });
    expect(secondee?.status).toBe("active");
    expect(secondee?.capacityGroupId).toBe(`ent-${ent}:dept-${deptId}`);
  });

  it("fires with in-flight claims: drains, suspends, preserves artifacts", async () => {
    const db = getDb();
    // In-flight claim held by the secondee + an artifact + ledger usage.
    const [rev] = await db.insert(dagRevisions).values({
      projectId: softProject,
      revision: 1,
      spec: { nodes: [] } as never,
      planHash: sha256Hex(`plan-${stamp}`),
      createdBy: ownerA.id,
      approvedBy: ownerA.id,
      approvedAt: new Date(),
    });
    const [runRow] = await db.insert(runs).values({
      projectId: softProject,
      dagRevisionId: Number(rev.insertId),
      mode: "mock",
      provider: "mock",
      state: "running",
      budget: defaultRunBudget(),
      startedBy: ownerA.id,
      enterpriseId: ent,
      enterpriseCompanyId: softCompanyId,
    });
    const runId = Number(runRow.insertId);
    await db.insert(runNodes).values({
      runId,
      nodeKey: "n1",
      contract: { role: "Researcher", goal: "in-flight" },
      state: "claimed",
      leaseToken: crypto.randomUUID(),
      leaseWorkerId: secondeeWorkerId,
      leaseExpiresAt: new Date(Date.now() + 120_000),
      attempts: 1,
    });
    await db.insert(artifacts).values({
      runId,
      nodeKey: "n1",
      kind: "research-brief",
      title: `In-flight artifact ${stamp}`,
      schemaUri: "contract://artifact",
      contentSha256: sha256Hex(`artifact-${stamp}`),
      summary: "partial result",
      accepted: true,
    });
    await db.insert(budgetLedger).values({
      runId,
      nodeKey: "n1",
      tokensPrompt: 10,
      tokensCompletion: 20,
      calls: 1,
      costUsdMicros: 100,
      enterpriseId: ent,
      attempt: 1,
    });

    const fired = await runDirectAction(ownerA, ent, {
      scope: "enterprise",
      actor: "donna",
      action: "worker.fire",
      payload: { contractKey: "wc-backend", drain: true, preserveArtifacts: true },
      confirmation: FIRE_GATES,
      id: `fire-${stamp}`,
    });
    expect(fired.proposal.status).toBe("executed");
    expect(fired.proposal.resultSummary).toContain("draining");

    const contract = await db.query.workerContracts.findFirst({
      where: and(eq(workerContracts.enterpriseId, ent), eq(workerContracts.key, "wc-backend")),
    });
    expect(contract?.status).toBe("draining"); // in-flight claim blocks release
    const secondee = await db.query.workers.findFirst({ where: eq(workers.id, secondeeWorkerId) });
    expect(secondee?.status).toBe("suspended"); // no new claims

    // Artifact preservation: artifact + ledger rows are untouched.
    const art = await db.query.artifacts.findFirst({ where: eq(artifacts.runId, runId) });
    expect(art?.title).toBe(`In-flight artifact ${stamp}`);
    expect(art?.contentSha256).toBe(sha256Hex(`artifact-${stamp}`));
    const [ledgerCount] = await db
      .select({ n: sql<number>`COUNT(*)` })
      .from(budgetLedger)
      .where(eq(budgetLedger.runId, runId));
    expect(Number(ledgerCount?.n)).toBe(1);

    // Claim finishes → drain completes → released (existing sweep semantics).
    await db
      .update(runNodes)
      .set({ state: "accepted", leaseWorkerId: null, leaseToken: null })
      .where(eq(runNodes.runId, runId));
    const released = await releaseContract(ownerA, contract!.id);
    expect(released.status).toBe("released");
    await stopRun(runId, "assistant-test");
  });

  // ── 8. Department / company lifecycle ──────────────────────────

  it("pauses/resumes departments (suspending pooled workers) and companies", async () => {
    const db = getDb();
    await db.insert(workerContracts).values({
      enterpriseId: ent,
      key: "wc-backend-2",
      companyId: softCompanyId,
      departmentId: deptId,
      discipline: "backend-engineering",
      status: "proposed",
      capacityShare: 0.5,
      skillPin: { skillId: "agent-research-director", version: "1.0.0", sha256: null },
      staffed: true,
    });
    await runDirectAction(ownerA, ent, {
      scope: "enterprise",
      actor: "donna",
      action: "worker.hire",
      payload: { contractKey: "wc-backend-2" },
      confirmation: PLAN_GATE,
      id: `hire2-${stamp}`,
    });
    const paused = await runDirectAction(ownerA, ent, {
      scope: "department",
      actor: "department-coordinator",
      action: "department.pause",
      payload: { departmentKey: "svc-backend" },
      confirmation: PLAN_GATE,
      id: `dept-pause-${stamp}`,
    });
    expect(paused.proposal.status).toBe("executed");
    const dept = await db.query.enterpriseDepartments.findFirst({
      where: eq(enterpriseDepartments.id, deptId),
    });
    expect(dept?.status).toBe("paused");
    const pooled = await db
      .select()
      .from(workers)
      .where(eq(workers.departmentId, deptId));
    expect(pooled.length).toBeGreaterThan(0);
    expect(pooled.every((w) => w.status === "suspended")).toBe(true);

    await runDirectAction(ownerA, ent, {
      scope: "department",
      actor: "department-coordinator",
      action: "department.resume",
      payload: { departmentKey: "svc-backend" },
      confirmation: PLAN_GATE,
      id: `dept-resume-${stamp}`,
    });
    const deptAfter = await db.query.enterpriseDepartments.findFirst({
      where: eq(enterpriseDepartments.id, deptId),
    });
    expect(deptAfter?.status).toBe("active");
    // Workers are NOT silently resumed — explicit worker.resume only.
    const pooledAfter = await db.select().from(workers).where(eq(workers.departmentId, deptId));
    expect(pooledAfter.every((w) => w.status === "suspended")).toBe(true);

    // Company pause/resume/archive.
    await runDirectAction(ownerA, ent, {
      scope: "company",
      actor: "company-operations-assistant",
      action: "company.pause",
      payload: { companyKey: "soft" },
      confirmation: PLAN_GATE,
      id: `co-pause-${stamp}`,
    });
    let company = await db.query.enterpriseCompanies.findFirst({
      where: eq(enterpriseCompanies.id, softCompanyId),
    });
    expect(company?.active).toBe(false);
    await runDirectAction(ownerA, ent, {
      scope: "company",
      actor: "company-operations-assistant",
      action: "company.resume",
      payload: { companyKey: "soft" },
      confirmation: PLAN_GATE,
      id: `co-resume-${stamp}`,
    });
    company = await db.query.enterpriseCompanies.findFirst({
      where: eq(enterpriseCompanies.id, softCompanyId),
    });
    expect(company?.active).toBe(true);
    await runDirectAction(ownerA, ent, {
      scope: "company",
      actor: "company-operations-assistant",
      action: "company.archive",
      payload: { companyKey: "soft", drain: true, preserveArtifacts: true },
      confirmation: FIRE_GATES,
      id: `co-archive-${stamp}`,
    });
    company = await db.query.enterpriseCompanies.findFirst({
      where: eq(enterpriseCompanies.id, softCompanyId),
    });
    expect(company?.active).toBe(false);
    expect(company?.archivedAt).not.toBeNull();
    // Archive is terminal.
    await expect(
      runDirectAction(ownerA, ent, {
        scope: "company",
        actor: "company-operations-assistant",
        action: "company.resume",
        payload: { companyKey: "soft" },
        confirmation: PLAN_GATE,
        id: `co-resume-2-${stamp}`,
      }),
    ).rejects.toMatchObject({ code: "BAD_STATE" });
  });

  // ── 9. Repository gates / SSRF / plan-state honesty ────────────

  it("refuses credentialed intake without the credentials gate + vault record", async () => {
    // Gate missing → rejected BEFORE any network or vault access.
    await expect(
      runDirectAction(ownerA, ent, {
        scope: "enterprise",
        actor: "repository-integration-steward",
        action: "repository.import",
        payload: { url: "https://github.com/octocat/Hello-World", intakeMode: "credentialed-approved", recordId: 1 },
        confirmation: PLAN_GATE, // lacks credentials/external-writes/high-risk
        id: `imp-nogate-${stamp}`,
      }),
    ).rejects.toMatchObject({ code: "GATE_NOT_CONFIRMED" });
    // Gates confirmed but no vault record → CREDENTIAL/NOT_FOUND, no read.
    await expect(
      runDirectAction(ownerA, ent, {
        scope: "enterprise",
        actor: "repository-integration-steward",
        action: "repository.import",
        payload: { url: "https://github.com/octocat/Hello-World", intakeMode: "credentialed-approved" },
        confirmation: IMPORT_GATES,
        id: `imp-norecord-${stamp}`,
      }),
    ).rejects.toThrow();
  });

  it("blocks SSRF: non-GitHub hosts and non-HTTPS URLs never reach the network", async () => {
    await expect(
      intakeRepository(ownerA, ent, {
        url: "https://evil.example.com/owner/repo",
        intakeMode: "public-anonymous",
      }),
    ).rejects.toMatchObject({ code: "CONNECTOR" });
    await expect(
      intakeRepository(ownerA, ent, {
        url: "http://github.com/owner/repo",
        intakeMode: "public-anonymous",
      }),
    ).rejects.toMatchObject({ code: "CONNECTOR" });
    await expect(
      intakeRepository(ownerA, ent, {
        url: "https://github.com.evil.com/owner/repo",
        intakeMode: "public-anonymous",
      }),
    ).rejects.toMatchObject({ code: "CONNECTOR" });
  });

  it("applies routing plans honestly: quarantine blocks assign, hash drift conflicts", async () => {
    const db = getDb();
    const sha = "a".repeat(40);
    const [repoRow] = await db.insert(repositoryRecords).values({
      ownerId: ownerA.id,
      enterpriseId: ent,
      url: "https://github.com/example/archived-lib",
      ownerName: "example",
      name: "archived-lib",
      description: "archived upstream",
      language: "TypeScript",
      topics: ["backend"],
      license: "mit",
      archived: true,
      defaultBranch: "main",
      commitSha: sha,
      visibility: "public",
      intakeMode: "public-anonymous",
    });
    const repoId = Number(repoRow.insertId);
    // Archived → quarantined read-only plan (as routeRepository would emit).
    await db.insert(repoAssignmentPlans).values({
      repositoryId: repoId,
      url: "https://github.com/example/archived-lib",
      commitSha: sha,
      status: "quarantined",
      companyKey: "software",
      departmentKey: "svc-backend-engineering",
      discipline: "backend-engineering",
      skillId: "architecture-database-backend-engineering",
      confidence: 0.55,
      rationale: "archived upstream; quarantined read-only",
      readOnly: true,
      redistributionAllowed: false,
      notes: ["archived upstream: quarantined read-only reference"],
    });
    // Quarantined plans can never be assigned.
    await expect(
      runDirectAction(ownerA, ent, {
        scope: "enterprise",
        actor: "repository-integration-steward",
        action: "repository.assign",
        payload: { url: "https://github.com/example/archived-lib" },
        confirmation: PLAN_GATE,
        id: `assign-quar-${stamp}`,
      }),
    ).rejects.toMatchObject({ code: "BAD_STATE" });
    // Hash drift: plan exists for a DIFFERENT commit → CONFLICT re-inspect.
    await expect(
      runDirectAction(ownerA, ent, {
        scope: "enterprise",
        actor: "repository-integration-steward",
        action: "repository.assign",
        payload: { url: "https://github.com/example/archived-lib", commitSha: "b".repeat(40) },
        confirmation: PLAN_GATE,
        id: `assign-drift-${stamp}`,
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });

    // A proposed_new_structure plan can only be RECORDED, never assigned, and
    // never creates companies/departments.
    const [repo2] = await db.insert(repositoryRecords).values({
      ownerId: ownerA.id,
      enterpriseId: ent,
      url: "https://github.com/example/robotics-kit",
      ownerName: "example",
      name: "robotics-kit",
      description: "robotics outside existing disciplines",
      language: "Python",
      topics: ["robotics"],
      license: null,
      archived: false,
      defaultBranch: "main",
      commitSha: sha,
      visibility: "public",
      intakeMode: "public-anonymous",
    });
    await db.insert(repoAssignmentPlans).values({
      repositoryId: Number(repo2.insertId),
      url: "https://github.com/example/robotics-kit",
      commitSha: sha,
      status: "proposed_new_structure",
      companyKey: null,
      departmentKey: null,
      discipline: null,
      skillId: null,
      confidence: 0.25,
      rationale: "new-domain hint; explicit low-confidence proposal",
      readOnly: true,
      redistributionAllowed: false,
      notes: ["low-confidence explicit proposal"],
    });
    const recorded = await runDirectAction(ownerA, ent, {
      scope: "enterprise",
      actor: "repository-integration-steward",
      action: "repository.propose_structure",
      payload: { url: "https://github.com/example/robotics-kit" },
      confirmation: FIRE_GATES,
      id: `prop-struct-${stamp}`,
    });
    expect(recorded.proposal.status).toBe("executed");
    // No standing roles: company/department counts unchanged (still 2 + 1).
    const [coCount] = await db
      .select({ n: sql<number>`COUNT(*)` })
      .from(enterpriseCompanies)
      .where(eq(enterpriseCompanies.enterpriseId, ent));
    const [deptCount] = await db
      .select({ n: sql<number>`COUNT(*)` })
      .from(enterpriseDepartments)
      .where(eq(enterpriseDepartments.enterpriseId, ent));
    expect(Number(coCount?.n)).toBe(2);
    expect(Number(deptCount?.n)).toBe(1);

    // A clean assigned plan applies exactly once (idempotent second apply).
    const [repo3] = await db.insert(repositoryRecords).values({
      ownerId: ownerA.id,
      enterpriseId: ent,
      url: "https://github.com/example/backend-tool",
      ownerName: "example",
      name: "backend-tool",
      description: "postgres rest api backend",
      language: "TypeScript",
      topics: ["backend", "api", "postgres"],
      license: "mit",
      archived: false,
      defaultBranch: "main",
      commitSha: sha,
      visibility: "public",
      intakeMode: "public-anonymous",
    });
    await db.insert(repoAssignmentPlans).values({
      repositoryId: Number(repo3.insertId),
      url: "https://github.com/example/backend-tool",
      commitSha: sha,
      status: "assigned",
      companyKey: "software",
      departmentKey: "svc-backend-engineering",
      discipline: "backend-engineering",
      skillId: "architecture-database-backend-engineering",
      confidence: 0.85,
      rationale: "matched backend rule",
      readOnly: false,
      redistributionAllowed: true,
      notes: [],
    });
    const applied = await runDirectAction(ownerA, ent, {
      scope: "enterprise",
      actor: "repository-integration-steward",
      action: "repository.assign",
      payload: { url: "https://github.com/example/backend-tool" },
      confirmation: PLAN_GATE,
      id: `assign-ok-${stamp}`,
    });
    expect(applied.proposal.status).toBe("executed");
    const reapplied = await runDirectAction(ownerA, ent, {
      scope: "enterprise",
      actor: "repository-integration-steward",
      action: "repository.assign",
      payload: { url: "https://github.com/example/backend-tool" },
      confirmation: PLAN_GATE,
      id: `assign-ok-2-${stamp}`,
    });
    expect(reapplied.proposal.resultSummary).toContain("idempotent");
  });

  // ── 10. Knowledge transfer refs ────────────────────────────────

  it("records knowledge transfers as refs + handoff metadata only", async () => {
    const db = getDb();
    const art = await db.query.artifacts.findFirst({
      where: eq(artifacts.title, `In-flight artifact ${stamp}`),
    });
    expect(art).toBeDefined();
    const transfer = await runDirectAction(ownerA, ent, {
      scope: "enterprise",
      actor: "donna", // scope coverage: only Donna acts at enterprise scope
      action: "knowledge.transfer",
      payload: {
        transferKey: `handoff-1-${stamp}`,
        artifactIds: [art!.id],
        from: "svc-backend",
        to: "soft",
        summary: "hand off the in-flight findings",
      },
      confirmation: PLAN_GATE,
      id: `kt-${stamp}`,
    });
    expect(transfer.proposal.status).toBe("executed");
    const row = await db.query.knowledgeTransfers.findFirst({
      where: eq(knowledgeTransfers.transferKey, `handoff-1-${stamp}`),
    });
    expect(row).toBeDefined();
    expect(row!.refs).toHaveLength(1);
    expect((row!.refs[0] as { contentSha256: string }).contentSha256).toBe(
      sha256Hex(`artifact-${stamp}`),
    );
    expect(row!.contentSha256).toMatch(/^[0-9a-f]{64}$/);
    // HANDOFFS metadata: a study-kind pointer landed on the enterprise queue.
    const pointer = await db.query.assistantQueueItems.findFirst({
      where: eq(assistantQueueItems.itemKey, `handoff:handoff-1-${stamp}`),
    });
    expect(pointer?.itemKind).toBe("study");
    expect(pointer?.title).toContain("HANDOFF svc-backend → soft");
    // Export is refs-only.
    const exported = await callerFor(ownerA).assistant.knowledgeExport({ enterpriseId: ent });
    expect(exported.length).toBeGreaterThan(0);
    expect(exported[0]!.refs[0]).not.toHaveProperty("body");
    // Cross-artifact (foreign enterprise) refs are refused.
    await expect(
      runDirectAction(ownerA, ent, {
        scope: "enterprise",
        actor: "donna",
        action: "knowledge.transfer",
        payload: { transferKey: `handoff-bad-${stamp}`, artifactIds: [999_999_999], from: "a", to: "b" },
        confirmation: PLAN_GATE,
        id: `kt-bad-${stamp}`,
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  // ── 11. Router surface smoke (proposals list, jobs list, cache) ─

  it("serves owner-scoped router reads that never advance state", async () => {
    const caller = callerFor(ownerA);
    const before = (await getDb().query.enterprises.findFirst({ where: eq(enterprises.id, ent) }))!;
    const proposals = await caller.assistant.proposals({ enterpriseId: ent });
    expect(proposals.length).toBeGreaterThan(0);
    const jobs = await caller.assistant.jobsList({ enterpriseId: entJobs });
    expect(Array.isArray(jobs)).toBe(true);
    const cache = await caller.assistant.cacheStatus({ enterpriseId: ent });
    expect(cache.namespaces.map((n) => n.namespace)).toContain("snapshot");
    const study = await caller.assistant.studyList({ enterpriseId: ent });
    expect(study.length).toBeGreaterThan(0);
    const knowledge = await caller.assistant.knowledgeList({ enterpriseId: ent });
    expect(knowledge.length).toBeGreaterThan(0);
    const repos = await caller.assistant.reposList({ enterpriseId: ent });
    expect(repos.length).toBe(3);
    const after = (await getDb().query.enterprises.findFirst({ where: eq(enterprises.id, ent) }))!;
    expect(after.version).toBe(before.version); // queries never advance
  });
});
