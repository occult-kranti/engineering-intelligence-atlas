import "dotenv/config";
import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { and, eq, inArray, sql } from "drizzle-orm";
import { appRouter } from "./router";
import { getDb } from "./queries/connection";
import {
  artifacts,
  budgetLedger,
  dagRevisions,
  enterpriseCompanies,
  enterpriseDepartments,
  enterprisePrograms,
  enterprises,
  memoryEntries,
  projects,
  runNodes,
  runs,
  users,
  workerContracts,
  workers,
  type Run,
  type User,
  type Worker,
} from "@db/schema";
import type { DagSpec, NodeSpec } from "@contracts/dag";
import { sha256Hex } from "@contracts/enterprise";
import {
  EnterpriseError,
  applyBlueprint,
  checkEnterpriseReservation,
  decideContract,
  decideMemory,
  deriveEnterpriseLedger,
  enterpriseLedgerPage,
  enterpriseTimelinePage,
  getEnterpriseSnapshot,
  listMemory,
  previewBlueprint,
  proposeMemory,
  pumpProgram,
  releaseContract,
  startProgram,
  type BlueprintPreviewInput,
} from "./enterprise";
import { claimNextNode, releaseClaim } from "./engine/control-plane";
import { createRunGraph, stopRun } from "./engine/scheduler";
import { appendEvent } from "./engine/events";

/**
 * Enterprise / CEO mode serial DB suite: owner scoping, idempotent
 * materialization, capacity-group aggregate concurrency, contract drain,
 * budget reservation/overrun honesty, the non-bypassable plan gate, program
 * pump recovery, memory hash verification, and incremental ledger/timeline.
 * Runs against the real TiDB instance, serially (DB mutations are ordered).
 */

const DB_OK = !!process.env.DATABASE_URL;
const stamp = Date.now().toString(36);
let ownerA: User;
let ownerB: User;
const createdRunIds: number[] = [];

type Caller = ReturnType<typeof appRouter.createCaller>;
function callerFor(user?: User): Caller {
  return appRouter.createCaller({
    req: new Request("http://enterprise.test/"),
    resHeaders: new Headers(),
    ...(user ? { user } : {}),
  });
}
async function expectTrpcCode(p: Promise<unknown>, code: string) {
  await expect(p).rejects.toMatchObject({ code });
}

const input: BlueprintPreviewInput = {
  preset: "creative_technology_group",
  programId: `ctg-${stamp}`,
  name: `CTG ${stamp}`,
  mission: "Operate a creative technology group for the serial enterprise test.",
  budget: { maxTokens: 4_000_000, maxCalls: 300, maxMinutes: 360, maxCostUsdMicros: 250_000_000 },
  maxReplans: 2,
  maxConcurrentRuns: 4,
};

let enterpriseId = 0;
let programId = 0;

describe.skipIf(!DB_OK)("enterprise CEO mode (real DB)", { timeout: 120_000 }, () => {
  beforeAll(async () => {
    const db = getDb();
    const [a] = await db.insert(users).values({ unionId: `ent-a-${stamp}`, name: "Ent Owner A" });
    const [b] = await db.insert(users).values({ unionId: `ent-b-${stamp}`, name: "Ent Owner B" });
    ownerA = (await db.query.users.findFirst({ where: eq(users.id, Number(a.insertId)) }))!;
    ownerB = (await db.query.users.findFirst({ where: eq(users.id, Number(b.insertId)) }))!;
  }, 60_000);

  afterAll(async () => {
    for (const runId of createdRunIds) {
      try {
        await stopRun(runId, "enterprise-test-cleanup");
      } catch {
        /* already terminal */
      }
    }
  }, 120_000);

  it("previews deterministically and pins blueprint/payload hashes", async () => {
    const p1 = await previewBlueprint(input);
    const p2 = await previewBlueprint(input);
    expect(p1.blueprintHash).toMatch(/^[0-9a-f]{64}$/);
    expect(p1.blueprintHash).toBe(p2.blueprintHash);
    expect(p1.payloadHash).toBe(p2.payloadHash);
    expect(p1.blueprint.companies).toHaveLength(5);
    expect(p1.blueprint.departments).toHaveLength(7);
    expect(p1.blueprint.contracts).toHaveLength(9);
    // Unstaffed honesty: creative skills absent from the vetted registry.
    const music = p1.blueprint.contracts.find((w) => w.discipline === "music-production");
    expect(music?.staffed).toBe(false);
    // Graph/list parity from the shared derivation.
    expect(p1.view.graph.nodes.length).toBe(
      p1.view.lists.companies.length +
        p1.view.lists.departments.length +
        p1.view.lists.contracts.length,
    );
  });

  it("rejects apply without hash pins or with drifted hashes", async () => {
    const preview = await previewBlueprint(input);
    await expect(
      applyBlueprint(ownerA, {
        ...input,
        expectedBlueprintHash: preview.blueprintHash,
        expectedPayloadHash: preview.payloadHash,
        approved: false as never,
      }),
    ).rejects.toMatchObject({ code: "APPROVAL_REQUIRED" });
    await expect(
      applyBlueprint(ownerA, {
        ...input,
        expectedBlueprintHash: sha256Hex("wrong"),
        expectedPayloadHash: preview.payloadHash,
        approved: true,
      }),
    ).rejects.toMatchObject({ code: "BLUEPRINT_DRIFT" });
  });

  it("materializes companies/departments/contracts/DAG drafts idempotently", async () => {
    const preview = await previewBlueprint(input);
    const applied = await applyBlueprint(ownerA, {
      ...input,
      expectedBlueprintHash: preview.blueprintHash,
      expectedPayloadHash: preview.payloadHash,
      approved: true,
    });
    expect(applied.replayed).toBe(false);
    enterpriseId = applied.enterpriseId;
    programId = applied.programId;

    const db = getDb();
    const companies = await db
      .select()
      .from(enterpriseCompanies)
      .where(eq(enterpriseCompanies.enterpriseId, enterpriseId));
    expect(companies).toHaveLength(5);
    // 1:1 with projects; unstaffed companies are honestly inactive.
    for (const c of companies) {
      const project = await db.query.projects.findFirst({ where: eq(projects.id, c.projectId) });
      expect(project?.ownerId).toBe(ownerA.id);
    }
    expect(companies.find((c) => c.key === "music")?.active).toBe(false);
    expect(companies.find((c) => c.key === "shared-services")?.active).toBe(false);
    expect(companies.find((c) => c.key === "software")?.active).toBe(true);

    const departments = await db
      .select()
      .from(enterpriseDepartments)
      .where(eq(enterpriseDepartments.enterpriseId, enterpriseId));
    expect(departments).toHaveLength(7);
    const contracts = await db
      .select()
      .from(workerContracts)
      .where(eq(workerContracts.enterpriseId, enterpriseId));
    expect(contracts).toHaveLength(9);
    expect(contracts.every((c) => c.status === "proposed")).toBe(true);

    // DAG drafts exist and are UNAPPROVED (plan gate preserved).
    for (const c of companies) {
      const rev = await db.query.dagRevisions.findFirst({
        where: and(eq(dagRevisions.projectId, c.projectId), eq(dagRevisions.revision, 1)),
      });
      expect(rev).toBeTruthy();
      expect(rev!.approvedAt).toBeNull();
    }

    // Replay: same blueprint hash returns the same program, no duplicates.
    const replay = await applyBlueprint(ownerA, {
      ...input,
      expectedBlueprintHash: preview.blueprintHash,
      expectedPayloadHash: preview.payloadHash,
      approved: true,
    });
    expect(replay.replayed).toBe(true);
    expect(replay.enterpriseId).toBe(enterpriseId);
    const companiesAfter = await db
      .select()
      .from(enterpriseCompanies)
      .where(eq(enterpriseCompanies.enterpriseId, enterpriseId));
    expect(companiesAfter).toHaveLength(5);
    const contractsAfter = await db
      .select()
      .from(workerContracts)
      .where(eq(workerContracts.enterpriseId, enterpriseId));
    expect(contractsAfter).toHaveLength(9);
  });

  it("denies every enterprise surface to a foreign owner", async () => {
    const foreign = callerFor(ownerB);
    await expectTrpcCode(foreign.enterprise.snapshot({ enterpriseId }), "FORBIDDEN");
    await expectTrpcCode(foreign.enterprise.workers({ enterpriseId }), "FORBIDDEN");
    await expectTrpcCode(
      foreign.enterprise.ledger({ enterpriseId, afterSeq: 0, limit: 10 }),
      "FORBIDDEN",
    );
    await expectTrpcCode(foreign.enterprise.programStart({ programId }), "FORBIDDEN");
    const contract = (await getDb().query.workerContracts.findFirst({
      where: eq(workerContracts.enterpriseId, enterpriseId),
    }))!;
    await expectTrpcCode(
      foreign.enterprise.decideContract({ contractId: contract.id, decision: "approved" }),
      "FORBIDDEN",
    );
    // The owner's own list never leaks the foreign enterprise.
    const mine = await callerFor(ownerB).enterprise.list();
    expect(mine.every((e) => e.id !== enterpriseId)).toBe(true);
  });

  it("blocks program start until every active company plan is human-approved", async () => {
    await expect(startProgram(ownerA, programId)).rejects.toMatchObject({ code: "PLAN_GATE" });
    // createRun's plan gate is equally non-bypassable for company projects.
    const db = getDb();
    const company = await db.query.enterpriseCompanies.findFirst({
      where: and(
        eq(enterpriseCompanies.enterpriseId, enterpriseId),
        eq(enterpriseCompanies.key, "software"),
      ),
    });
    const rev = await db.query.dagRevisions.findFirst({
      where: and(eq(dagRevisions.projectId, company!.projectId), eq(dagRevisions.revision, 1)),
    });
    const { createRun } = await import("./engine/scheduler");
    await expect(
      createRun({
        user: ownerA,
        projectId: company!.projectId,
        dagRevisionId: rev!.id,
        mode: "mock",
        provider: "gateway",
        enterpriseContext: { enterpriseId, companyId: company!.id },
      }),
    ).rejects.toThrowError(/plan is not approved/);
  });

  it("decides contracts with secondee workers and drains/releases honestly", async () => {
    const db = getDb();
    const staffed = await db.query.workerContracts.findFirst({
      where: and(
        eq(workerContracts.enterpriseId, enterpriseId),
        eq(workerContracts.staffed, true),
      ),
    });
    expect(staffed).toBeTruthy();
    const decided = await decideContract(ownerA, staffed!.id, "approved");
    expect(decided.status).toBe("active");
    expect(decided.secondeeWorkerId).toBeTruthy();
    expect(decided.capacityGroupId).toMatch(/^ent-\d+:dept-\d+$/);
    const secondee = await db.query.workers.findFirst({
      where: eq(workers.id, decided.secondeeWorkerId!),
    });
    expect(secondee?.skillRefs[0]?.name).toBe(decided.skillPin.skillId);
    expect(secondee?.capacityGroupId).toBe(decided.capacityGroupId);
    expect(secondee?.departmentId).toBe(decided.departmentId);

    // Unstaffed contracts can never mint a worker.
    const unstaffed = await db.query.workerContracts.findFirst({
      where: and(
        eq(workerContracts.enterpriseId, enterpriseId),
        eq(workerContracts.staffed, false),
      ),
    });
    await expect(decideContract(ownerA, unstaffed!.id, "approved")).rejects.toMatchObject({
      code: "UNSTAFFED",
    });

    // Double-decide is fenced by the guarded status transition.
    await expect(decideContract(ownerA, staffed!.id, "approved")).rejects.toMatchObject({
      code: "BAD_STATE",
    });

    // Release: no in-flight claims ⇒ drains and releases in one pass; the
    // secondee is suspended (no new claims) before the state flips.
    const released = await releaseContract(ownerA, staffed!.id);
    expect(released.status).toBe("released");
    const after = await db.query.workers.findFirst({ where: eq(workers.id, decided.secondeeWorkerId!) });
    expect(after?.status).toBe("suspended");
  });

  it("counts capacity group-wide across origin and secondee workers", async () => {
    // A quiet claimable run in one company project.
    const caller = callerFor(ownerA);
    const project = await caller.projects.create({
      name: `ENT CAP ${stamp}`,
      goal: "capacity group test",
      riskTier: "low",
    });
    const proposal = await caller.dag.proposeSquad({ projectId: project.id, provider: "mock" });
    const spec: DagSpec = structuredClone(proposal.spec);
    const saved = await caller.dag.save({ projectId: project.id, spec });
    if (!saved.saved) throw new Error("save failed");
    await caller.dag.approve({ projectId: project.id, revisionId: saved.revisionId });
    // Two quiet runs (origin project + borrowing project topology): one
    // claimable root node each, so assignment stickiness cannot interfere —
    // only the shared capacityGroupId can block the secondee.
    const db = getDb();
    const mkRun = async (): Promise<Run> => {
      const id = await createRunGraph({
        projectId: project.id,
        dagRevisionId: saved.revisionId,
        mode: "mock",
        providerId: "mock",
        model: "mock-deterministic",
        budget: spec.budget,
        startedBy: ownerA.id,
        nodes: spec.nodes,
      });
      createdRunIds.push(id);
      return (await db.query.runs.findFirst({ where: eq(runs.id, id) }))! as Run;
    };
    const run1 = await mkRun();
    const run2 = await mkRun();
    const node = spec.nodes[0] as NodeSpec;
    await db
      .update(runNodes)
      .set({ state: "ready" })
      .where(
        and(inArray(runNodes.runId, [run1.id, run2.id]), eq(runNodes.nodeKey, node.key)),
      );

    const groupId = `ent-test-${stamp}:dept-1`;
    const mk = async (name: string): Promise<Worker> => {
      const [row] = await db.insert(workers).values({
        projectId: project.id,
        name,
        kind: "subagent",
        role: node.role,
        capabilities: [...node.toolsAllowed],
        skillRefs: [node.skill],
        maxConcurrentClaims: 1,
        capacityGroupId: groupId,
      });
      return (await db.query.workers.findFirst({ where: eq(workers.id, Number(row.insertId)) }))!;
    };
    const origin = await mk(`origin-${stamp}`);
    const secondee = await mk(`secondee-${stamp}`);

    // Origin holds the single group slot; the secondee is denied group-wide
    // even though its personal capacity is free and its node is unclaimed.
    const claim = await claimNextNode(run1, origin, { nodeKey: node.key });
    expect(claim).not.toBeNull();
    expect(await claimNextNode(run2, secondee, { nodeKey: node.key })).toBeNull();
    // Releasing the claim frees the group slot for the secondee.
    await releaseClaim(run1.id, node.key, claim!.leaseToken);
    expect(await claimNextNode(run2, secondee, { nodeKey: node.key })).not.toBeNull();
  });

  it("enforces enterprise envelope and company partitions at reservation", async () => {
    const db = getDb();
    const company = (await db.query.enterpriseCompanies.findFirst({
      where: and(
        eq(enterpriseCompanies.enterpriseId, enterpriseId),
        eq(enterpriseCompanies.key, "software"),
      ),
    }))!;
    // A candidate budget larger than the whole envelope is rejected honestly.
    await expect(
      checkEnterpriseReservation(ownerA.id, {
        enterpriseId,
        companyId: company.id,
        projectId: company.projectId,
        runBudget: { maxTokens: 9_000_000, maxCalls: 500, maxMinutes: 60, maxCostUsd: 5 },
      }),
    ).rejects.toMatchObject({ code: "BUDGET_EXHAUSTED" });
    // Cross-company project spoofing is rejected (owner chain).
    const other = (await db.query.enterpriseCompanies.findFirst({
      where: and(
        eq(enterpriseCompanies.enterpriseId, enterpriseId),
        eq(enterpriseCompanies.key, "ai-cyber"),
      ),
    }))!;
    await expect(
      checkEnterpriseReservation(ownerA.id, {
        enterpriseId,
        companyId: company.id,
        projectId: other.projectId,
        runBudget: { maxTokens: 1000, maxCalls: 1, maxMinutes: 1, maxCostUsd: 0.01 },
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    // A foreign owner cannot even check against this enterprise.
    await expect(
      checkEnterpriseReservation(ownerB.id, {
        enterpriseId,
        companyId: company.id,
        projectId: company.projectId,
        runBudget: { maxTokens: 1000, maxCalls: 1, maxMinutes: 1, maxCostUsd: 0.01 },
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("starts the program after plan approval and never redispatches runIds", async () => {
    const db = getDb();
    // Human plan approval for every company draft (the non-bypassable gate).
    const companies = await db
      .select()
      .from(enterpriseCompanies)
      .where(eq(enterpriseCompanies.enterpriseId, enterpriseId));
    for (const c of companies) {
      await db
        .update(dagRevisions)
        .set({ approvedBy: ownerA.id, approvedAt: new Date() })
        .where(and(eq(dagRevisions.projectId, c.projectId), eq(dagRevisions.revision, 1)));
    }
    await startProgram(ownerA, programId);

    const program = (await db.query.enterprisePrograms.findFirst({
      where: eq(enterprisePrograms.id, programId),
    }))!;
    expect(["dispatching", "running"]).toContain(program.state);
    const dispatched = program.companyRuns.filter((cr) => cr.runId !== null);
    expect(dispatched.length).toBeGreaterThan(0);
    expect(dispatched.length).toBeLessThanOrEqual(4); // maxConcurrentRuns cap
    for (const cr of dispatched) createdRunIds.push(Number(cr.runId));
    // Runs are stamped with the enterprise tags.
    const firstRun = (await db.query.runs.findFirst({
      where: eq(runs.id, Number(dispatched[0]!.runId)),
    }))!;
    expect(firstRun.enterpriseId).toBe(enterpriseId);
    expect(firstRun.enterpriseCompanyId).toBeTruthy();
    // Inactive companies never dispatch.
    for (const key of ["music", "shared-services"]) {
      expect(program.companyRuns.find((cr) => cr.companyKey === key)?.runId).toBeNull();
    }

    // Recovery: pump reattaches — recorded runIds are never redispatched.
    const before = program.companyRuns.map((cr) => cr.runId);
    await pumpProgram(ownerA, programId);
    const after = (await db.query.enterprisePrograms.findFirst({
      where: eq(enterprisePrograms.id, programId),
    }))!;
    expect(after.companyRuns.map((cr) => cr.runId)).toEqual(before);
  });

  it("promotes memory by reference with live hash verification", async () => {
    const db = getDb();
    const program = (await db.query.enterprisePrograms.findFirst({
      where: eq(enterprisePrograms.id, programId),
    }))!;
    const runId = Number(program.companyRuns.find((cr) => cr.runId !== null)!.runId);
    const contentSha = sha256Hex(`memory-content-${stamp}`);
    const [artifactRow] = await db.insert(artifacts).values({
      runId,
      nodeKey: "mem-node",
      kind: "report",
      title: `Enterprise memory source ${stamp}`,
      schemaUri: "atlas://artifacts/report",
      contentSha256: contentSha,
      summary: "extractive summary for the memory test",
      attempt: 1,
    });
    const artifactId = Number(artifactRow.insertId);

    const proposed = await proposeMemory(ownerA, enterpriseId, {
      scope: "enterprise",
      scopeKey: input.programId,
      artifactId,
    });
    await decideMemory(ownerA, proposed.id, "promote");
    let entries = await listMemory(ownerA.id, enterpriseId);
    const promoted = entries.find((e) => e.id === proposed.id);
    expect(promoted?.state).toBe("promoted");
    expect(promoted?.verified).toBe(true);
    expect(promoted?.contentSha256).toBe(contentSha);
    // No body columns: the row carries refs + hash + bounded summary only.
    expect(Object.keys(entries[0]!)).not.toContain("body");
    expect(promoted!.summary.length).toBeLessThanOrEqual(2000);

    // Hash drift (artifact replaced) flips verification honestly.
    await db
      .update(artifacts)
      .set({ contentSha256: sha256Hex("tampered") })
      .where(eq(artifacts.id, artifactId));
    entries = await listMemory(ownerA.id, enterpriseId);
    expect(entries.find((e) => e.id === proposed.id)?.verified).toBe(false);

    // Cross-owner: the artifact is invisible outside the owner's enterprise.
    await expect(
      proposeMemory(ownerB, enterpriseId, {
        scope: "enterprise",
        scopeKey: input.programId,
        artifactId,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    const memRow = await db.query.memoryEntries.findFirst({
      where: eq(memoryEntries.id, proposed.id),
    });
    expect(memRow).toBeTruthy();
  });

  it("derives an incremental ledger and timeline with keyset paging", async () => {
    const db = getDb();
    const program = (await db.query.enterprisePrograms.findFirst({
      where: eq(enterprisePrograms.id, programId),
    }))!;
    // Quiesce: stop the program-dispatched mock runs so background
    // advancement cannot append events mid-assertion (the ledger derives
    // from LIVE run records by design).
    for (const cr of program.companyRuns) {
      if (cr.runId === null) continue;
      try {
        await stopRun(Number(cr.runId), "ledger-test-quiesce");
      } catch {
        /* already terminal */
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // A quiet enterprise-tagged run (never advanced) carries our events.
    const company = (await db.query.enterpriseCompanies.findFirst({
      where: and(
        eq(enterpriseCompanies.enterpriseId, enterpriseId),
        eq(enterpriseCompanies.key, "software"),
      ),
    }))!;
    const rev = (await db.query.dagRevisions.findFirst({
      where: and(eq(dagRevisions.projectId, company.projectId), eq(dagRevisions.revision, 1)),
    }))!;
    const runId = await createRunGraph({
      projectId: company.projectId,
      dagRevisionId: rev.id,
      mode: "mock",
      providerId: "mock",
      model: "mock-deterministic",
      budget: rev.spec.budget,
      startedBy: ownerA.id,
      enterpriseContext: { enterpriseId, companyId: company.id },
      nodes: rev.spec.nodes,
    });
    createdRunIds.push(runId);
    await appendEvent(runId, {
      type: "prompt_compiled",
      actor: "director",
      nodeKey: "ledger-node",
      payload: {
        attempt: 1,
        strategy: "direct_structured",
        bytes: { system: 10, user: 20, total: 30 },
        estimatedTokens: 9,
        seed: "s",
        plan: { strategyVersion: "1", steps: [] },
      },
    });
    await appendEvent(runId, {
      type: "budget_recorded",
      actor: "system",
      nodeKey: "ledger-node",
      payload: {
        attempt: 1,
        promptTokens: 5,
        completionTokens: 4,
        calls: 1,
        costUsdMicros: 9,
        simulated: true,
      },
    });

    const page1 = await enterpriseLedgerPage(ownerA.id, enterpriseId, { afterSeq: 0, limit: 3 });
    expect(page1.entries.length).toBeGreaterThan(0);
    expect(page1.entries.length).toBeLessThanOrEqual(3);
    const seqs = page1.entries.map((e) => e.seq);
    expect([...seqs].sort((a, b) => a - b)).toEqual(seqs);
    // Keyset continuation: strictly increasing, no overlap.
    const page2 = await enterpriseLedgerPage(ownerA.id, enterpriseId, {
      afterSeq: page1.nextAfterSeq ?? 0,
      limit: 100,
    });
    for (const e of page2.entries) expect(e.seq).toBeGreaterThan(page1.nextAfterSeq ?? 0);
    expect(page1.total).toBe(page2.total);

    const full = await deriveEnterpriseLedger(ownerA.id, enterpriseId);
    const promptEntry = full.find((e) => e.kind === "prompt_started" && e.runId === runId);
    expect(promptEntry?.promptSha256).toMatch(/^[0-9a-f]{64}$/);
    const usageEntry = full.find((e) => e.kind === "returned" && e.runId === runId);
    expect(usageEntry?.usage).toEqual({ inputTokens: 5, outputTokens: 4, costUsdMicros: 9 });

    const timeline = await enterpriseTimelinePage(ownerA.id, enterpriseId, { limit: 500 });
    expect(timeline.total).toBe(full.length);
    for (const t of timeline.entries) {
      const source = full.find((l) => l.seq === t.ledgerSeq);
      expect(source).toBeDefined();
      expect(t.ts).toBe(source!.ts);
    }
    // Cross-owner denial on derived surfaces.
    await expect(deriveEnterpriseLedger(ownerB.id, enterpriseId)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("stops runs honestly when actual enterprise usage overruns the envelope", async () => {
    const db = getDb();
    // A quiet run tagged to the enterprise, plus ledger rows whose sum
    // crosses the envelope's token dimension.
    const company = (await db.query.enterpriseCompanies.findFirst({
      where: and(
        eq(enterpriseCompanies.enterpriseId, enterpriseId),
        eq(enterpriseCompanies.key, "software"),
      ),
    }))!;
    const rev = (await db.query.dagRevisions.findFirst({
      where: and(eq(dagRevisions.projectId, company!.projectId), eq(dagRevisions.revision, 1)),
    }))!;
    const runId = await createRunGraph({
      projectId: company!.projectId,
      dagRevisionId: rev!.id,
      mode: "mock",
      providerId: "mock",
      model: "mock-deterministic",
      budget: rev!.spec.budget,
      startedBy: ownerA.id,
      enterpriseContext: { enterpriseId, companyId: company!.id },
      nodes: rev!.spec.nodes,
    });
    createdRunIds.push(runId);
    // Prior usage within the envelope does not stop the run.
    const run = (await db.query.runs.findFirst({ where: eq(runs.id, runId) }))!;
    const { checkEnterpriseOverrun } = await import("./enterprise");
    expect(await checkEnterpriseOverrun(run)).toBe(false);
    // Push actual recorded usage past the envelope (tokens dimension).
    const enterprise = (await db.query.enterprises.findFirst({
      where: eq(enterprises.id, enterpriseId),
    }))!;
    await db.insert(budgetLedger).values({
      runId,
      nodeKey: "overrun-node",
      tokensPrompt: enterprise.budget.maxTokens,
      tokensCompletion: 0,
      calls: 1,
      costUsdMicros: 1,
      enterpriseId,
      enterpriseCompanyId: company!.id,
      attempt: 1,
    });
    expect(await checkEnterpriseOverrun(run)).toBe(true);
    const stopped = (await db.query.runs.findFirst({ where: eq(runs.id, runId) }))!;
    expect(stopped.state).toBe("stopped_budget");
    expect(stopped.endReason).toMatch(/^enterprise:tokens$/);
    // The program is flagged stopped_budget — no silent continuation.
    const program = (await db.query.enterprisePrograms.findFirst({
      where: eq(enterprisePrograms.id, programId),
    }))!;
    expect(program.state).toBe("stopped_budget");
  });

  it("serves a cached snapshot invalidated by version/event-seq", async () => {
    const s1 = await getEnterpriseSnapshot(ownerA.id, enterpriseId);
    const s2 = await getEnterpriseSnapshot(ownerA.id, enterpriseId);
    expect(s1.enterprise.id).toBe(enterpriseId);
    expect(s2).toBe(s1); // identical cache entry, content-keyed
    expect(s1.view).not.toBeNull();
    expect(s1.stewards["evidence-ledger-steward"].providerCalls).toBe(false);
    expect(s1.actions.length).toBe(12);
    // A mutation (event appended by decide below) invalidates the cache.
    const contract = (await getDb().query.workerContracts.findFirst({
      where: and(
        eq(workerContracts.enterpriseId, enterpriseId),
        eq(workerContracts.status, "proposed"),
        eq(workerContracts.staffed, true),
      ),
    }))!;
    if (contract) {
      await decideContract(ownerA, contract.id, "rejected");
      const s3 = await getEnterpriseSnapshot(ownerA.id, enterpriseId);
      expect(s3).not.toBe(s1);
    }
  });
});
