import "dotenv/config";
import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { createHash } from "node:crypto";
import { appRouter } from "./router";
import { getDb } from "./queries/connection";
import {
  agents,
  approvals,
  artifacts,
  budgetLedger,
  dagRevisions,
  exportsTable,
  knowledgeDrafts,
  projects,
  runEvents,
  runNodes,
  runs,
  skills,
  users,
  type User,
} from "@db/schema";
import type { DagSpec, NodeSpec } from "@contracts/dag";
import { TERMINAL_RUN_STATES } from "@contracts/run";
import { sha256Hex } from "./registry/intake";
import { storage } from "./lib/storage";

/**
 * DB-backed integration suite (spec §11.2): a complete mock project lifecycle
 * against the real provisioned MySQL — registry, project, DAG
 * propose/edit/validate/approve, mock run with per-node approval pause/resume,
 * append-only event sequence, budget termination, artifacts, knowledge review,
 * exports — plus cross-owner and anonymous denial. tRPC is exercised through
 * `appRouter.createCaller` with explicit test-user contexts; no HTTP auth
 * bypass is added anywhere.
 */

const DB_OK = !!process.env.DATABASE_URL;
const SLOW = 420_000; // storage document review can take ~12 s per upload

const stamp = Date.now().toString(36);
let ownerA: User;
let ownerB: User;
const createdProjectIds: number[] = [];
const createdSkillIds: number[] = [];
const createdStorageKeys: string[] = [];

type Caller = ReturnType<typeof appRouter.createCaller>;

function callerFor(user?: User): Caller {
  return appRouter.createCaller({
    req: new Request("http://integration.test/"),
    resHeaders: new Headers(),
    ...(user ? { user } : {}),
  });
}

async function waitRunState(
  caller: Caller,
  runId: number,
  want: string[],
  timeoutMs = 240_000,
) {
  const t0 = Date.now();
  for (;;) {
    const r = await caller.runs.get({ id: runId });
    if (want.includes(r.run.state)) return r;
    if (TERMINAL_RUN_STATES.has(r.run.state)) {
      throw new Error(
        `run ${runId} reached unexpected terminal state "${r.run.state}" (${r.run.endReason ?? "no reason"}) while waiting for ${want.join("|")}`,
      );
    }
    if (Date.now() - t0 > timeoutMs) {
      throw new Error(`timeout waiting for run ${runId} to reach ${want.join("|")} (still ${r.run.state})`);
    }
    await new Promise((r2) => setTimeout(r2, 1_500));
  }
}

async function expectTrpcCode(p: Promise<unknown>, code: string) {
  await expect(p).rejects.toMatchObject({ code });
}

describe.skipIf(!DB_OK)("integration: full mock project lifecycle (real DB)", () => {
  beforeAll(async () => {
    const db = getDb();
    const [a] = await db
      .insert(users)
      .values({ unionId: `itest-owner-a-${stamp}`, name: "ITest Owner A" });
    const [b] = await db
      .insert(users)
      .values({ unionId: `itest-owner-b-${stamp}`, name: "ITest Owner B" });
    ownerA = (await db.query.users.findFirst({
      where: eq(users.id, Number(a.insertId)),
    }))!;
    ownerB = (await db.query.users.findFirst({
      where: eq(users.id, Number(b.insertId)),
    }))!;
  }, 60_000);

  afterAll(async () => {
    const db = getDb();
    try {
      const runRows = createdProjectIds.length
        ? await db
            .select({ id: runs.id })
            .from(runs)
            .where(inArray(runs.projectId, createdProjectIds))
        : [];
      const runIds = runRows.map((r) => r.id);
      if (runIds.length) {
        await db.delete(runEvents).where(inArray(runEvents.runId, runIds));
        await db.delete(budgetLedger).where(inArray(budgetLedger.runId, runIds));
        await db.delete(approvals).where(inArray(approvals.runId, runIds));
        await db.delete(artifacts).where(inArray(artifacts.runId, runIds));
        await db.delete(runNodes).where(inArray(runNodes.runId, runIds));
      }
      if (createdProjectIds.length) {
        await db.delete(runs).where(inArray(runs.projectId, createdProjectIds));
        await db.delete(agents).where(inArray(agents.projectId, createdProjectIds));
        await db
          .delete(dagRevisions)
          .where(inArray(dagRevisions.projectId, createdProjectIds));
        await db
          .delete(knowledgeDrafts)
          .where(inArray(knowledgeDrafts.projectId, createdProjectIds));
        await db
          .delete(exportsTable)
          .where(inArray(exportsTable.projectId, createdProjectIds));
        await db.delete(projects).where(inArray(projects.id, createdProjectIds));
      }
      if (createdSkillIds.length) {
        await db.delete(skills).where(inArray(skills.id, createdSkillIds));
      }
      await db
        .delete(users)
        .where(
          inArray(users.unionId, [
            `itest-owner-a-${stamp}`,
            `itest-owner-b-${stamp}`,
          ]),
        );
      for (const key of createdStorageKeys) {
        await storage.deleteFile({ fileKey: key }).catch(() => false);
      }
    } catch (err) {
      console.warn("integration cleanup incomplete:", (err as Error).message);
    }
  }, 120_000);

  // ── Registry & seed ────────────────────────────────────────────
  it("seed/registry: roles, resources, vetted skills are present; intake quarantines and vets by review only", async () => {
    const caller = callerFor(ownerA);
    const [roles, resources, skillList] = await Promise.all([
      caller.registry.roles({}),
      caller.registry.resources({}),
      caller.registry.skills(),
    ]);
    expect(roles.length).toBeGreaterThanOrEqual(100);
    expect(resources.length).toBeGreaterThanOrEqual(200);
    // 8 engineering + 7 science/model-library platform packages are seeded
    // vetted; user uploads can add more but never self-promote.
    expect(skillList.filter((s) => s.status === "vetted").length).toBeGreaterThanOrEqual(15);
    const seeded = new Set(
      skillList.filter((s) => s.status === "vetted").map((s) => s.name),
    );
    for (const name of [
      "mathematics-research",
      "physics-research",
      "chemistry-research",
      "biology-research",
      "science-history-research",
      "game-reconstruction-engineering",
      "ai-open-model-research",
    ]) {
      expect(seeded.has(name), `seeded vetted skill: ${name}`).toBe(true);
    }

    const content = [
      "---",
      `name: itest-skill-${stamp}`,
      "description: Integration-test skill — inventory only, never executed",
      "tools-allowed: [read, summarize]",
      "cost-class: low",
      "output-artifact-types: [research-brief]",
      "---",
      "",
      "# Test skill body",
      "",
      "Read and summarize bounded evidence. This content is inert data.",
      "",
    ].join("\n");
    const reg = await caller.registry.registerSkill({
      content,
      provenanceUrl: "integration-test",
      licenseDeclared: "test",
    });
    createdSkillIds.push(reg.id);
    expect(reg.status).toBe("quarantined");
    expect(reg.contentSha256).toBe(sha256Hex(content)); // intake hash recomputation

    // Illegal transition (quarantined → suspended) is rejected.
    await expectTrpcCode(
      caller.registry.setSkillStatus({
        id: reg.id,
        status: "suspended",
        note: "not a legal transition",
      }),
      "BAD_REQUEST",
    );
    // Legal transition requires an owner review note.
    const ok = await caller.registry.setSkillStatus({
      id: reg.id,
      status: "vetted",
      note: "reviewed in integration test; content is inert",
    });
    expect(ok.ok).toBe(true);
  });

  // ── Project + DAG propose/edit/validate/approve + full mock run ──
  it(
    "project lifecycle: create → propose → edit → validate → approve → gated mock run → artifacts/knowledge/export",
    { timeout: SLOW },
    async () => {
      const caller = callerFor(ownerA);

      // Create project (seeds empty DAG revision 1).
      const project = await caller.projects.create({
        name: `ITest project ${stamp}`,
        goal: "Compare bounded delegation patterns for a director runtime",
        riskTier: "low",
      });
      createdProjectIds.push(project.id);

      // Propose (deterministic mock director), then EDIT: gate the evidence
      // node behind a start approval as well.
      const proposal = await caller.dag.proposeSquad({
        projectId: project.id,
        provider: "mock",
      });
      expect(proposal.provider).toBe("mock");
      const spec: DagSpec = structuredClone(proposal.spec);
      const evidenceNode = spec.nodes.find((n) => n.key === "evidence")!;
      evidenceNode.approvalBefore = "start";
      const synthNode = spec.nodes.find((n) => n.key === "synthesize")!;
      expect(synthNode.approvalBefore).toBe("accept");

      // Validate (dry run), then save (server re-validates identically).
      const dry = await caller.dag.validate({ projectId: project.id, spec });
      expect(dry.ok).toBe(true);
      const saved = await caller.dag.save({ projectId: project.id, spec });
      expect(saved.saved).toBe(true);
      if (!saved.saved) throw new Error("save failed");

      // Run start is refused before plan approval.
      await expectTrpcCode(
        caller.runs.start({
          projectId: project.id,
          dagRevisionId: saved.revisionId,
          mode: "mock",
          provider: "mock",
        }),
        "PRECONDITION_FAILED",
      );

      // Approve the plan (freezes revision + hash).
      const ap = await caller.dag.approve({
        projectId: project.id,
        revisionId: saved.revisionId,
      });
      expect(ap.ok).toBe(true);

      // Live mode without explicit confirmation is refused (billing gate).
      await expectTrpcCode(
        caller.runs.start({
          projectId: project.id,
          dagRevisionId: saved.revisionId,
          mode: "live",
          provider: "gateway",
        }),
        "PRECONDITION_FAILED",
      );

      // Start the mock run.
      const run = await caller.runs.start({
        projectId: project.id,
        dagRevisionId: saved.revisionId,
        mode: "mock",
        provider: "mock",
      });
      expect(run.state).not.toBe("failed_validation");

      // 1) "scope" dispatches; run must pause at the evidence start gate.
      const paused1 = await waitRunState(caller, run.id, ["awaiting_approval"]);
      const gate1 = paused1.pendingApprovals.find(
        (a) => a.kind === "plan" && a.nodeKey === "evidence",
      );
      expect(gate1).toBeTruthy();
      // Dispatch is really blocked: evidence node is parked in a waiting
      // state (waiting/approval with the control plane) and never dispatched.
      const evNode = paused1.nodes.find((n) => n.nodeKey === "evidence")!;
      expect(["pending", "ready", "waiting"]).toContain(evNode.state);

      // Resume after approval.
      const d1 = await caller.approvals.decide({
        approvalId: gate1!.id,
        decision: "approved",
        note: "integration test approves evidence dispatch",
      });
      expect(d1.ok).toBe(true);

      // 2) Run pauses again at the synthesis artifact-accept gate.
      const paused2 = await waitRunState(caller, run.id, ["awaiting_approval"]);
      const gate2 = paused2.pendingApprovals.find(
        (a) => a.kind === "artifact-accept" && a.nodeKey === "synthesize",
      );
      expect(gate2).toBeTruthy();
      const d2 = await caller.approvals.decide({
        approvalId: gate2!.id,
        decision: "approved",
        note: "artifact meets acceptance checks",
      });
      expect(d2.ok).toBe(true);

      // 3) Completion: every node accepted.
      const done = await waitRunState(caller, run.id, ["completed"]);
      expect(done.nodes.every((n) => n.state === "accepted")).toBe(true);
      expect(done.usage.calls).toBe(spec.nodes.length);

      // Append-only event stream: strictly sequential, contiguous seq 1..N.
      const events = await caller.events.tail({ runId: run.id, afterSeq: 0, limit: 500 });
      expect(events.length).toBeGreaterThan(10);
      events.forEach((e, i) => expect(e.seq).toBe(i + 1));
      const types = new Set(events.map((e) => e.type));
      for (const t of [
        "run_created",
        "run_started",
        "node_state",
        "budget_recorded",
        "artifact_created",
        "approval_requested",
        "approval_decided",
        "run_completed",
      ]) {
        expect(types.has(t as never), `event type ${t}`).toBe(true);
      }
      // Secret canary: no gateway key/URL anywhere in the event stream.
      const eventsJson = JSON.stringify(events);
      for (const secret of [
        process.env.KIMI_AGENTGW_API_KEY,
        process.env.KIMI_AGENTGW_BASE_URL,
      ]) {
        if (secret) expect(eventsJson.includes(secret)).toBe(false);
      }
      // Mock billing disclosure and simulated-cents labeling are present.
      const created = events.find((e) => e.type === "run_created")!;
      expect(JSON.stringify(created.payload)).toContain("no model quota");
      const budgetEvents = events.filter((e) => e.type === "budget_recorded");
      expect(budgetEvents.length).toBe(spec.nodes.length);
      for (const be of budgetEvents) {
        expect((be.payload as { simulated?: boolean }).simulated).toBe(true);
      }

      // Ledger matches node count.
      const ledger = await caller.ledger.byRun({ runId: run.id });
      expect(ledger.length).toBe(spec.nodes.length);

      // Artifacts: storage keys persisted (never URLs); presigned content
      // matches the recorded content hash.
      const arts = await caller.artifacts.listByRun({ runId: run.id });
      expect(arts.length).toBe(spec.nodes.length);
      for (const a of arts) {
        expect(a.storageKey, `artifact ${a.id} storageKey`).toBeTruthy();
        expect(a.storageKey!.startsWith("artifacts/")).toBe(true);
        expect(a.storageKey!.startsWith("http")).toBe(false);
        expect(a.accepted).toBe(true);
        createdStorageKeys.push(a.storageKey!);
      }
      const first = arts[0]!;
      const { url } = await caller.artifacts.downloadUrl({ id: first.id });
      expect(url.startsWith("http")).toBe(true);
      const body = await (await fetch(url)).text();
      expect(createHash("sha256").update(body).digest("hex")).toBe(
        first.contentSha256,
      );

      // Knowledge draft → promotion lands in QUARANTINE, never vetted.
      const draft = await caller.knowledge.submit({
        projectId: project.id,
        sourceRunId: run.id,
        title: "Mock runs reproduce deterministically",
        body: "Lesson: the mock provider is seeded by run/node/attempt; identical inputs give byte-identical artifacts.",
      });
      const reviewed = await caller.knowledge.review({
        draftId: draft.id,
        decision: "promote",
        note: "useful operating lesson",
      });
      expect(reviewed.promotedSkillId).toBeTruthy();
      createdSkillIds.push(reviewed.promotedSkillId!);
      const promoted = await caller.registry.skillDetail({
        id: reviewed.promotedSkillId!,
      });
      expect(promoted.status).toBe("quarantined");

      // Exports: JSON + Markdown through object storage; keys, not URLs.
      for (const format of ["json", "markdown"] as const) {
        const ex = await caller.exports.create({
          projectId: project.id,
          runId: run.id,
          format,
        });
        expect(ex.storageError).toBeNull();
        const rows = await caller.exports.list({ projectId: project.id });
        const row = rows.find((r) => r.id === ex.id)!;
        expect(row.storageKey!.startsWith("exports/")).toBe(true);
        expect(row.storageKey!.startsWith("http")).toBe(false);
        createdStorageKeys.push(row.storageKey!);
        const dl = await caller.exports.downloadUrl({ id: ex.id });
        const text = await (await fetch(dl.url)).text();
        expect(text).toContain(project.name);
      }
    },
  );

  // ── Budget termination ─────────────────────────────────────────
  it(
    "budget termination: call budget exhaustion stops the run with evidence preserved",
    { timeout: SLOW },
    async () => {
      const caller = callerFor(ownerA);
      const project = await caller.projects.create({
        name: `ITest budget ${stamp}`,
        goal: "Budget tripwire integration test",
        riskTier: "low",
      });
      createdProjectIds.push(project.id);

      const proposal = await caller.dag.proposeSquad({
        projectId: project.id,
        provider: "mock",
      });
      const full = structuredClone(proposal.spec);
      // Two-node chain; each node and the run get exactly ONE call.
      const keep = new Set(["scope", "evidence"]);
      const spec: DagSpec = {
        ...full,
        nodes: full.nodes
          .filter((n) => keep.has(n.key))
          .map((n): NodeSpec => ({ ...n, budget: { ...n.budget, maxCalls: 1 } })),
        edges: full.edges.filter((e) => keep.has(e.from) && keep.has(e.to)),
        budget: { maxTokens: 100_000, maxCalls: 1, maxMinutes: 60, maxCostUsd: 5 },
      };
      const dry = await caller.dag.validate({ projectId: project.id, spec });
      expect(dry.ok).toBe(true);
      const saved = await caller.dag.save({ projectId: project.id, spec });
      if (!saved.saved) throw new Error("save failed");
      await caller.dag.approve({ projectId: project.id, revisionId: saved.revisionId });

      const run = await caller.runs.start({
        projectId: project.id,
        dagRevisionId: saved.revisionId,
        mode: "mock",
        provider: "mock",
      });
      const done = await waitRunState(caller, run.id, ["stopped_budget"]);
      expect(done.run.endReason).toContain("calls");

      const events = await caller.events.tail({ runId: run.id, afterSeq: 0, limit: 500 });
      const budgetExceeded = events.find((e) => e.type === "budget_exceeded");
      expect(budgetExceeded).toBeTruthy();
      expect(JSON.stringify(budgetExceeded!.payload)).toContain("calls");

      // Partial-evidence preservation: the finished node's artifact survives
      // and is accepted; the never-dispatched node stays pending.
      const scopeNode = done.nodes.find((n) => n.nodeKey === "scope")!;
      const evidenceNode = done.nodes.find((n) => n.nodeKey === "evidence")!;
      expect(scopeNode.state).toBe("accepted");
      expect(evidenceNode.state).toBe("pending");
      const arts = await caller.artifacts.listByRun({ runId: run.id });
      expect(arts.length).toBe(1);
      expect(arts[0]!.nodeKey).toBe("scope");
      expect(arts[0]!.storageKey).toBeTruthy();
      createdStorageKeys.push(arts[0]!.storageKey!);

      // Human stop is still recorded honestly on a fresh run would be
      // redundant here; instead confirm a terminal run refuses stop.
      await expectTrpcCode(caller.runs.stop({ id: run.id }), "BAD_REQUEST");
    },
  );

  // ── Scripted node failure ──────────────────────────────────────
  it(
    "mock scripted failure fails the node and run honestly, skipping downstream",
    { timeout: SLOW },
    async () => {
      const caller = callerFor(ownerA);
      const project = await caller.projects.create({
        name: `ITest failure ${stamp}`,
        goal: "Failure handling integration test",
        riskTier: "low",
      });
      createdProjectIds.push(project.id);

      const proposal = await caller.dag.proposeSquad({
        projectId: project.id,
        provider: "mock",
      });
      const spec: DagSpec = structuredClone(proposal.spec);
      // Inject the mock provider's scripted-failure directive into the FIRST
      // node's goal (it lands in the prompt, which the mock inspects).
      spec.nodes.find((n) => n.key === "scope")!.goal += " [mock:fail]";
      const saved = await caller.dag.save({ projectId: project.id, spec });
      if (!saved.saved) throw new Error("save failed");
      await caller.dag.approve({ projectId: project.id, revisionId: saved.revisionId });

      const run = await caller.runs.start({
        projectId: project.id,
        dagRevisionId: saved.revisionId,
        mode: "mock",
        provider: "mock",
      });
      const done = await waitRunState(caller, run.id, ["failed"]);
      expect(done.run.endReason).toContain("MockScriptedFailure");
      const nodeStates = new Map(done.nodes.map((n) => [n.nodeKey, n.state]));
      expect(nodeStates.get("scope")).toBe("failed");
      expect(nodeStates.get("evidence")).toBe("skipped");
      expect(nodeStates.get("synthesize")).toBe("skipped");
      const events = await caller.events.tail({ runId: run.id, afterSeq: 0, limit: 500 });
      const errEvent = events.find((e) => e.type === "error");
      expect(errEvent).toBeTruthy();
      expect((errEvent!.payload as { errorKind?: string }).errorKind).toBe(
        "MockScriptedFailure",
      );
    },
  );

  // ── Authorization ──────────────────────────────────────────────
  it("cross-owner and anonymous denial on every owned surface", async () => {
    const a = callerFor(ownerA);
    const b = callerFor(ownerB);
    const anon = callerFor(undefined);

    const project = await a.projects.create({
      name: `ITest authz ${stamp}`,
      goal: "Authorization boundary test",
      riskTier: "low",
    });
    createdProjectIds.push(project.id);

    // Anonymous: every product procedure rejects.
    await expectTrpcCode(anon.projects.list(), "UNAUTHORIZED");
    await expectTrpcCode(anon.projects.get({ id: project.id }), "UNAUTHORIZED");
    await expectTrpcCode(anon.events.tail({ runId: 1 }), "UNAUTHORIZED");
    await expectTrpcCode(anon.registry.skills(), "UNAUTHORIZED");

    // Cross-owner: project/run-scoped surfaces return NOT_FOUND/FORBIDDEN.
    await expectTrpcCode(b.projects.get({ id: project.id }), "NOT_FOUND");
    await expectTrpcCode(
      b.projects.rename({ id: project.id, name: "stolen" }),
      "NOT_FOUND",
    );
    await expectTrpcCode(b.projects.archive({ id: project.id }), "NOT_FOUND");
    await expectTrpcCode(
      b.dag.revisions({ projectId: project.id }),
      "NOT_FOUND",
    );
    await expectTrpcCode(
      b.knowledge.list({ projectId: project.id }),
      "NOT_FOUND",
    );
    await expectTrpcCode(b.exports.list({ projectId: project.id }), "NOT_FOUND");
    const bList = await b.projects.list();
    expect(bList.some((p) => p.id === project.id)).toBe(false);

    // Cross-owner against a real run/artifact/approval/export of owner A:
    // mint them cheaply via a 1-node mock run.
    const proposal = await a.dag.proposeSquad({ projectId: project.id, provider: "mock" });
    const full = structuredClone(proposal.spec);
    const spec: DagSpec = {
      ...full,
      nodes: full.nodes.filter((n) => n.key === "scope"),
      edges: [],
    };
    const saved = await a.dag.save({ projectId: project.id, spec });
    if (!saved.saved) throw new Error("save failed");
    await a.dag.approve({ projectId: project.id, revisionId: saved.revisionId });
    const run = await a.runs.start({
      projectId: project.id,
      dagRevisionId: saved.revisionId,
      mode: "mock",
      provider: "mock",
    });
    await waitRunState(a, run.id, ["completed"]);
    const arts = await a.artifacts.listByRun({ runId: run.id });
    createdStorageKeys.push(...arts.map((x) => x.storageKey!).filter(Boolean));
    const ex = await a.exports.create({ projectId: project.id, runId: run.id, format: "json" });
    const exRows = await a.exports.list({ projectId: project.id });
    const exRow = exRows.find((r) => r.id === ex.id)!;
    createdStorageKeys.push(exRow.storageKey!);

    await expectTrpcCode(b.runs.get({ id: run.id }), "FORBIDDEN");
    await expectTrpcCode(b.runs.stop({ id: run.id }), "FORBIDDEN");
    await expectTrpcCode(b.events.tail({ runId: run.id }), "FORBIDDEN");
    await expectTrpcCode(b.artifacts.listByRun({ runId: run.id }), "FORBIDDEN");
    await expectTrpcCode(
      b.artifacts.downloadUrl({ id: arts[0]!.id }),
      "FORBIDDEN",
    );
    await expectTrpcCode(
      b.artifacts.review({ id: arts[0]!.id, decision: "accept" }),
      "FORBIDDEN",
    );
    await expectTrpcCode(b.exports.downloadUrl({ id: ex.id }), "NOT_FOUND");
    await expectTrpcCode(b.ledger.byRun({ runId: run.id }), "FORBIDDEN");
    // Pending-approvals inbox is owner-scoped.
    const pending = await b.approvals.listPending({});
    expect(pending.some((p) => p.runId === run.id)).toBe(false);
  }, SLOW);
});
