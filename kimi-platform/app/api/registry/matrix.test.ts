import "dotenv/config";
import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { and, eq, inArray } from "drizzle-orm";
import { appRouter } from "../router";
import { getDb } from "../queries/connection";
import {
  agents,
  approvals,
  artifacts,
  budgetLedger,
  dagRevisions,
  evaluationReports,
  ownerSettings,
  projects,
  registryGaps,
  registryResources,
  registryRoleCandidates,
  registryRoleEvaluationTasks,
  registryRoleProfiles,
  registryRoleResourceLinks,
  registryRoles,
  registrySkillMappings,
  runEvents,
  runNodes,
  runs,
  users,
  workers,
  type User,
} from "@db/schema";
import type { DagSpec } from "@contracts/dag";
import { TERMINAL_RUN_STATES } from "@contracts/run";
import { seedRegistryMatrix } from "@db/seed";

/**
 * Role/resource matrix + prompt/evaluation integration suite (real DB):
 * seed counts and idempotency, role coverage API, owner-scoped evaluation
 * API (pricing-gated mock suite, saved reports, determinism, owner denial),
 * proposal coverage, and prompt_compiled dispatch events with degradation
 * metadata. Skipped without DATABASE_URL.
 */

const DB_OK = !!process.env.DATABASE_URL;
const stamp = Date.now().toString(36);
let ownerA: User;
let ownerB: User;
const createdProjectIds: number[] = [];
const createdReportIds: number[] = [];
const createdUserIds: number[] = [];

type Caller = ReturnType<typeof appRouter.createCaller>;
function callerFor(user?: User): Caller {
  return appRouter.createCaller({
    req: new Request("http://matrix.test/"),
    resHeaders: new Headers(),
    ...(user ? { user } : {}),
  });
}

async function waitRunState(caller: Caller, runId: number, want: string[], timeoutMs = 240_000) {
  const t0 = Date.now();
  for (;;) {
    const r = await caller.runs.get({ id: runId });
    if (want.includes(r.run.state)) return r;
    if (TERMINAL_RUN_STATES.has(r.run.state)) {
      throw new Error(`run ${runId} hit unexpected terminal state "${r.run.state}"`);
    }
    if (Date.now() - t0 > timeoutMs) throw new Error(`timeout waiting for run ${runId}`);
    await new Promise((r2) => setTimeout(r2, 1_500));
  }
}

describe.skipIf(!DB_OK)("matrix: seed, coverage, evaluation API, compiled dispatch (real DB)", () => {
  beforeAll(async () => {
    const db = getDb();
    const [a] = await db
      .insert(users)
      .values({ unionId: `mx-owner-a-${stamp}`, name: "MX Owner A" });
    const [b] = await db
      .insert(users)
      .values({ unionId: `mx-owner-b-${stamp}`, name: "MX Owner B" });
    ownerA = (await db.query.users.findFirst({ where: eq(users.id, Number(a.insertId)) }))!;
    ownerB = (await db.query.users.findFirst({ where: eq(users.id, Number(b.insertId)) }))!;
    createdUserIds.push(ownerA.id, ownerB.id);
  }, 60_000);

  afterAll(async () => {
    const db = getDb();
    try {
      const runRows = createdProjectIds.length
        ? await db.select({ id: runs.id }).from(runs).where(inArray(runs.projectId, createdProjectIds))
        : [];
      const runIds = runRows.map((r) => r.id);
      if (runIds.length) {
        await db.delete(runEvents).where(inArray(runEvents.runId, runIds));
        await db.delete(budgetLedger).where(inArray(budgetLedger.runId, runIds));
        await db.delete(approvals).where(inArray(approvals.runId, runIds));
        await db.delete(artifacts).where(inArray(artifacts.runId, runIds));
        await db.delete(runNodes).where(inArray(runNodes.runId, runIds));
        await db.delete(runs).where(inArray(runs.id, runIds));
      }
      if (createdProjectIds.length) {
        await db.delete(workers).where(inArray(workers.projectId, createdProjectIds));
        await db.delete(agents).where(inArray(agents.projectId, createdProjectIds));
        await db.delete(dagRevisions).where(inArray(dagRevisions.projectId, createdProjectIds));
        await db.delete(projects).where(inArray(projects.id, createdProjectIds));
      }
      // FK-safe: every row referencing the test users goes first — saved
      // reports AND any report left behind by a mid-test failure, plus the
      // owner pricing rows written by ai.setPricing.
      if (createdUserIds.length) {
        await db
          .delete(evaluationReports)
          .where(inArray(evaluationReports.ownerId, createdUserIds));
        await db
          .delete(ownerSettings)
          .where(inArray(ownerSettings.ownerId, createdUserIds));
        await db.delete(users).where(inArray(users.id, createdUserIds));
      }
      void createdReportIds;
    } catch (err) {
      console.warn("matrix cleanup incomplete:", (err as Error).message);
    }
  }, 120_000);

  it("seeds the full matrix idempotently (109/436/1756/336/20/1)", async () => {
    const db = getDb();
    const first = await seedRegistryMatrix(db);
    const second = await seedRegistryMatrix(db);
    // Second run inserts nothing — idempotent.
    expect(second).toEqual({
      roles: 0,
      resources: 0,
      profiles: 0,
      links: 0,
      evaluationTasks: 0,
      gaps: 0,
      skillMappings: 0,
      candidates: 0,
    });
    void first;
    const rows = {
      roles: await db.$count(registryRoles),
      resources: await db.$count(registryResources),
      profiles: await db.$count(registryRoleProfiles),
      links: await db.$count(registryRoleResourceLinks),
      tasks: await db.$count(registryRoleEvaluationTasks),
      gaps: await db.$count(registryGaps),
      mappings: await db.$count(registrySkillMappings),
      candidates: await db.$count(registryRoleCandidates),
    };
    expect(rows.roles).toBe(109);
    expect(rows.profiles).toBe(109);
    expect(rows.resources).toBe(436);
    expect(rows.links).toBe(1756);
    expect(rows.tasks).toBe(336);
    expect(rows.mappings).toBe(20);
    expect(rows.candidates).toBe(1);
    expect(rows.gaps).toBe(84);
    // The proposed Product Designer / UX Researcher is a candidate, NOT a standing role.
    const candidate = await db.query.registryRoleCandidates.findFirst({
      where: eq(registryRoleCandidates.slug, "product-designer-ux-researcher"),
    });
    expect(candidate?.status).toBe("candidate");
    const standing = await db.query.registryRoles.findFirst({
      where: eq(registryRoles.name, candidate!.name),
    });
    expect(standing).toBeUndefined();
    // Stale resources are flagged.
    const staleCount = await db.$count(registryResources, eq(registryResources.stale, true));
    expect(staleCount).toBe(3);
  }, 240_000);

  it("serves role coverage with heuristic labels and role detail with explicit gaps", async () => {
    const caller = callerFor(ownerA);
    const coverage = await caller.registry.roleCoverage();
    expect(coverage).toHaveLength(109);
    const cto = coverage.find((c) => c.slug === "chief-technology-officer-vp-engineering")!;
    expect(cto.depthScore).toBeGreaterThan(0);
    expect(cto.depthHeuristic).toMatch(/coverage heuristic/);
    expect(cto.depthHeuristic).toMatch(/not job-performance evidence/);
    expect(cto.linkCounts.core).toBeGreaterThan(0);
    expect(cto.evaluationTaskCount).toBe(3);

    const detail = await caller.registry.roleDetail({
      slug: "chief-technology-officer-vp-engineering",
    });
    expect(detail.resources.length).toBeGreaterThan(0);
    expect(detail.evaluationTasks).toHaveLength(3);
    expect(detail.gapLabels.length).toBeGreaterThan(0); // explicit gap labels
    expect(detail.profile.decomposition.verdict).toBe("split_at_scale");
    expect(detail.profile.decomposition.triggers.length).toBeGreaterThan(0);
    // every link carries evidence/access/license/stale status fields
    for (const r of detail.resources) {
      expect(r.evidence).toBeTruthy();
      expect(r.access).toBeTruthy();
      expect(typeof r.license).toBe("string");
      expect(typeof r.stale).toBe("boolean");
    }
    const candidates = await caller.registry.roleCandidates();
    expect(candidates).toHaveLength(1);
    expect(candidates[0]!.status).toBe("candidate");
  }, 120_000);

  it("returns proposal coverage with relevant resources and gap labels", async () => {
    const caller = callerFor(ownerA);
    const project = await caller.projects.create({
      name: `MX coverage ${stamp}`,
      goal: "Assess kubernetes rollout risks for the mobile platform",
      riskTier: "low",
    });
    createdProjectIds.push(project.id);
    const proposal = await caller.dag.proposeSquad({ projectId: project.id, provider: "mock" });
    expect(proposal.coverage).toHaveLength(proposal.spec.nodes.length);
    for (const cov of proposal.coverage) {
      expect(cov.depthHeuristic).toMatch(/coverage heuristic/);
      expect(Array.isArray(cov.gapLabels)).toBe(true);
      // resources come from role links only; stale are excluded, never selected
      for (const s of cov.resources.selected) {
        expect(s.evidence).not.toBe("E0-stale");
      }
      // core links rank before internal/conditional
      const flags = cov.resources.selected.map((s) => s.flag);
      const rank = { core: 0, conditional: 1, internal: 2 } as const;
      for (let i = 1; i < flags.length; i++) {
        expect(rank[flags[i]!]).toBeGreaterThanOrEqual(rank[flags[i - 1]!]);
      }
      // node resource URLs equal the selection (no arbitrary URLs)
      const node = proposal.spec.nodes.find((n) => n.key === cov.nodeKey)!;
      expect(node.resourceUrls).toEqual(cov.resources.selected.map((s) => s.url));
    }
  }, 120_000);

  it("runs the owner-scoped evaluation API with configured pricing, deterministic reports, and owner denial", async () => {
    const a = callerFor(ownerA);
    const b = callerFor(ownerB);

    const catalog = await a.evaluation.strategies();
    expect(catalog.strategies).toHaveLength(7);
    expect(catalog.dispatchableStrategies).toContain("direct_structured");
    expect(catalog.routingRules.length).toBeGreaterThan(0);
    expect(
      catalog.strategies.find((s) => s.id === "self_consistency")!.dispatchable,
    ).toBe(false);

    const routed = await a.evaluation.route({
      symbolic: false,
      compositional: false,
      requiresToolWorkflow: false,
      hasExternalVerifier: true,
      votable: false,
      slaTier: "standard",
      multiAgentRequested: false,
      singleAgentBaselineFailed: false,
      requestedStrategy: "tree_search",
    });
    expect(routed.dispatch.strategy).not.toBe("tree_search");
    expect(routed.dispatch.rejected[0]!.reason).toMatch(/evaluation-only/);

    const preview = await a.evaluation.preview({
      input: {
        goal: "Preview <<<INJECT>>> the gate\u0007",
        role: "Research Scientist",
        skill: {
          pin: { name: "biology-research", version: "1.2.0", sha256: "a".repeat(64) },
          body: "# Body\nCite or state limitations.",
        },
        resources: [],
        upstream: [],
        output: {
          artifactType: "research-brief",
          requiredSections: ["Summary", "Evidence", "Limitations"],
          requireCitationOrLimitation: true,
        },
        budgets: {},
        strategy: { id: "direct_structured" },
      },
    });
    // redactions are recorded and the injection delimiter is neutralized
    expect(preview.meta.redactions.length).toBeGreaterThan(0);
    expect(preview.user).not.toContain("<<<INJECT>>>");

    // Pricing-gated: refuse when no rate is configured (never fabricated).
    await expect(
      a.evaluation.runMockSuite({ provider: "openai", model: `mx-unpriced-${stamp}` }),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });

    await a.ai.setPricing({
      provider: "openai",
      model: `mx-eval-${stamp}`,
      inputUsdPerMillion: 2,
      outputUsdPerMillion: 8,
    });
    const run1 = await a.evaluation.runMockSuite({
      provider: "openai",
      model: `mx-eval-${stamp}`,
      repeats: 6,
      k: 2,
    });
    createdReportIds.push(run1.id!);
    expect(run1.suite.hash).toMatch(/^[0-9a-f]{64}$/);
    // paired baselines exist for every case
    for (const c of run1.report.cases) {
      expect(c.baseline.strategy).toBe("direct_structured");
      expect(c.shortPlanBaseline.strategy).toBe("plan_execute");
      for (const cand of c.candidates) {
        expect(cand.vsBaseline).toBeTruthy();
        expect(cand.vsShortPlanBaseline).toBeTruthy();
      }
    }
    // determinism: identical config reproduces the identical report hash
    const run2 = await a.evaluation.runMockSuite({
      provider: "openai",
      model: `mx-eval-${stamp}`,
      repeats: 6,
      k: 2,
      save: false,
    });
    expect(run2.reportHash).toBe(run1.reportHash);

    const list = await a.evaluation.reports();
    expect(list.some((r) => r.id === run1.id)).toBe(true);
    const fetched = await a.evaluation.report({ id: run1.id! });
    expect(fetched.reportHash).toBe(run1.reportHash);
    // owner denial: owner B cannot see owner A's report
    await expect(b.evaluation.report({ id: run1.id! })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect((await b.evaluation.reports()).some((r) => r.id === run1.id)).toBe(false);
  }, 300_000);

  it(
    "persists prompt_compiled events and artifact promptMeta with degradation metadata in mock dispatch",
    { timeout: 300_000 },
    async () => {
      const caller = callerFor(ownerA);
      const project = await caller.projects.create({
        name: `MX dispatch ${stamp}`,
        goal: "Compare bounded delegation patterns",
        riskTier: "low",
      });
      createdProjectIds.push(project.id);
      const proposal = await caller.dag.proposeSquad({ projectId: project.id, provider: "mock" });
      const spec: DagSpec = structuredClone(proposal.spec);
      // Request a dispatch-eligible non-default strategy to prove the
      // contract → router → compiler path is honored in dispatch.
      spec.nodes[0]!.promptStrategy = { id: "plan_execute" };
      const saved = await caller.dag.save({ projectId: project.id, spec });
      if (!saved.saved) throw new Error("save failed: " + JSON.stringify(saved.violations));
      await caller.dag.approve({ projectId: project.id, revisionId: saved.revisionId });
      const run = await caller.runs.start({
        projectId: project.id,
        dagRevisionId: saved.revisionId,
        mode: "mock",
        provider: "mock",
        confirmLive: false,
      });
      await waitRunState(caller, run.id, ["completed", "awaiting_approval"]);

      const db = getDb();
      const events = await db
        .select()
        .from(runEvents)
        .where(and(eq(runEvents.runId, run.id), eq(runEvents.type, "prompt_compiled")));
      expect(events.length).toBeGreaterThan(0);
      for (const e of events) {
        const p = e.payload as Record<string, never> & {
          strategy: string;
          plan: { steps: { action: string }[] };
          bytes: { total: number };
          truncations: unknown[];
          redactions: unknown[];
          degraded: boolean;
          degradationNotes: string[];
        };
        expect(p.strategy).toBeTruthy();
        expect(p.plan.steps.length).toBeGreaterThan(0);
        expect(p.bytes.total).toBeGreaterThan(0);
        expect(Array.isArray(p.truncations)).toBe(true);
        expect(Array.isArray(p.redactions)).toBe(true);
        expect(Array.isArray(p.degradationNotes)).toBe(true);
      }
      // the first node honored its plan_execute request
      const first = events.find((e) => e.nodeKey === spec.nodes[0]!.key)!;
      expect((first.payload as { strategy: string }).strategy).toBe("plan_execute");
      // artifacts carry promptMeta with the concise plan (never raw CoT)
      const artifactRows = await db
        .select()
        .from(artifacts)
        .where(eq(artifacts.runId, run.id));
      expect(artifactRows.length).toBeGreaterThan(0);
      for (const a of artifactRows) {
        expect(a.promptMeta?.compilerVersion).toBeTruthy();
        expect(a.promptMeta?.plan.steps.length).toBeGreaterThan(0);
        expect(JSON.stringify(a.promptMeta)).not.toMatch(/"chainOfThought"/i);
      }
    },
  );
});
