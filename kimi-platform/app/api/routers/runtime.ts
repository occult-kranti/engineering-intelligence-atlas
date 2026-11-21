import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, sql } from "drizzle-orm";
import { createRouter, authedQuery } from "../middleware";
import { getDb } from "../queries/connection";
import {
  approvals,
  artifacts,
  budgetLedger,
  exportsTable,
  knowledgeDrafts,
  projects,
  runNodes,
  runs,
  skills,
} from "@db/schema";
import { ProviderIdSchema, RunModeSchema, TERMINAL_RUN_STATES } from "@contracts/run";
import { GoalModeSchema } from "@contracts/office";
import { sha256Hex } from "../registry/intake";
import {
  createRun,
  ensureAdvancing,
  pauseRun,
  resumeRun,
  runUsage,
  setRunState,
  stopRun,
  RunStartError,
} from "../engine/scheduler";
import { listEvents, appendEvent, appendEventTx } from "../engine/events";
import { setNodeState } from "../engine/scheduler";
import { mustOwnProject } from "./planning";
import { storage } from "../lib/storage";

async function mustOwnRun(userId: number, runId: number) {
  const db = getDb();
  const run = await db.query.runs.findFirst({ where: eq(runs.id, runId) });
  if (!run) throw new TRPCError({ code: "NOT_FOUND", message: "run not found" });
  const project = await db.query.projects.findFirst({
    where: eq(projects.id, run.projectId),
  });
  if (!project || project.ownerId !== userId) {
    throw new TRPCError({ code: "FORBIDDEN", message: "not your run" });
  }
  return { run, project };
}

const runsRouter = createRouter({
  start: authedQuery
    .input(
      z.object({
        projectId: z.number().int().positive(),
        dagRevisionId: z.number().int().positive(),
        mode: RunModeSchema,
        provider: ProviderIdSchema.default("gateway"),
        model: z.string().max(200).optional(),
        confirmLive: z.boolean().optional(),
        /** Explicit parallelism opt-in (default 1 = serial, budget-safe). */
        maxParallelNodes: z.number().int().min(1).max(8).optional(),
        /** Active autonomy grant to preauthorize this run (validated in createRun). */
        autonomyGrantId: z.number().int().positive().optional(),
        /** Provider goal-mode preset applied at prompt compile. */
        goalMode: GoalModeSchema.optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await mustOwnProject(ctx.user.id, input.projectId);
      try {
        return await createRun({ user: ctx.user, ...input });
      } catch (err) {
        if (err instanceof RunStartError) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: err.message,
            cause: err,
          });
        }
        throw err;
      }
    }),
  get: authedQuery
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      // Pure read (doc §9.4.4): queries NEVER trigger execution. Advancement
      // comes from mutations plus the boot interval/startup sweep.
      const { run, project } = await mustOwnRun(ctx.user.id, input.id);
      const db = getDb();
      const nodes = await db
        .select()
        .from(runNodes)
        .where(eq(runNodes.runId, run.id));
      const usage = await runUsage(run);
      const pendingApprovals = await db
        .select()
        .from(approvals)
        .where(and(eq(approvals.runId, run.id), eq(approvals.state, "pending")));
      return { run, project, nodes, usage, pendingApprovals };
    }),
  listByProject: authedQuery
    .input(z.object({ projectId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      await mustOwnProject(ctx.user.id, input.projectId);
      return getDb()
        .select()
        .from(runs)
        .where(eq(runs.projectId, input.projectId))
        .orderBy(desc(runs.startedAt))
        .limit(50);
    }),
  stop: authedQuery
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const { run } = await mustOwnRun(ctx.user.id, input.id);
      if (TERMINAL_RUN_STATES.has(run.state)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "run is already terminal" });
      }
      await stopRun(run.id, ctx.user.name ?? `user-${ctx.user.id}`);
      return { ok: true };
    }),
  resume: authedQuery
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const { run } = await mustOwnRun(ctx.user.id, input.id);
      const who = ctx.user.name ?? `user-${ctx.user.id}`;
      if (run.state === "awaiting_approval") {
        const pending = await getDb()
          .select({ id: approvals.id })
          .from(approvals)
          .where(and(eq(approvals.runId, run.id), eq(approvals.state, "pending")))
          .limit(1);
        if (pending.length) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "pending approvals must be decided before resuming",
          });
        }
        await setRunState(run.id, "running", {
          actor: "human",
          fromStates: ["awaiting_approval"],
        });
      } else if (run.state === "paused") {
        await resumeRun(run.id, who);
        return { ok: true };
      }
      ensureAdvancing(run.id);
      return { ok: true };
    }),
  /** Human pause: fences in-flight leases, resumable via resume. */
  pause: authedQuery
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const { run } = await mustOwnRun(ctx.user.id, input.id);
      try {
        await pauseRun(run.id, ctx.user.name ?? `user-${ctx.user.id}`);
      } catch (err) {
        throw new TRPCError({ code: "BAD_REQUEST", message: (err as Error).message });
      }
      return { ok: true };
    }),
});

const eventsRouter = createRouter({
  tail: authedQuery
    .input(
      z.object({
        runId: z.number().int().positive(),
        afterSeq: z.number().int().nonnegative().default(0),
        limit: z.number().int().positive().max(500).default(200),
      }),
    )
    .query(async ({ ctx, input }) => {
      // Pure read — no execution side effects (doc §9.4.4).
      await mustOwnRun(ctx.user.id, input.runId);
      return listEvents(input.runId, input.afterSeq, input.limit);
    }),
});

const approvalsRouter = createRouter({
  listPending: authedQuery
    .input(z.object({ projectId: z.number().int().positive().optional() }))
    .query(async ({ ctx, input }) => {
      const db = getDb();
      const rows = await db
        .select({ approval: approvals, run: runs, project: projects })
        .from(approvals)
        .innerJoin(runs, eq(approvals.runId, runs.id))
        .innerJoin(projects, eq(runs.projectId, projects.id))
        .where(
          and(
            eq(projects.ownerId, ctx.user.id),
            eq(approvals.state, "pending"),
            input.projectId ? eq(projects.id, input.projectId) : sql`1=1`,
          ),
        )
        .orderBy(desc(approvals.createdAt));
      return rows.map((r) => ({
        ...r.approval,
        runState: r.run.state,
        projectName: r.project.name,
      }));
    }),
  /** Atomic decision: approval row update + append-only event in one tx. */
  decide: authedQuery
    .input(
      z.object({
        approvalId: z.number().int().positive(),
        decision: z.enum(["approved", "rejected"]),
        note: z.string().max(2000).default(""),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const approval = await db.query.approvals.findFirst({
        where: eq(approvals.id, input.approvalId),
      });
      if (!approval) throw new TRPCError({ code: "NOT_FOUND" });
      const { run } = await mustOwnRun(ctx.user.id, approval.runId);
      if (approval.state !== "pending") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "approval already decided" });
      }
      const who = ctx.user.name ?? `user-${ctx.user.id}`;
      // Decision + event in ONE transaction, with a pending-state guard on
      // the UPDATE itself (fixes §3.4 double-decide): two concurrent decides
      // — exactly one matches state='pending'; the loser rolls back.
      await db.transaction(async (tx) => {
        const [res] = await tx
          .update(approvals)
          .set({ state: input.decision, decidedBy: who, decidedAt: new Date() })
          .where(and(eq(approvals.id, approval.id), eq(approvals.state, "pending")));
        if (res.affectedRows !== 1) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "approval was already decided by a concurrent request",
          });
        }
        await appendEventTx(tx, run.id, {
          type: "approval_decided",
          actor: "human",
          nodeKey: approval.nodeKey,
          payload: {
            approvalId: approval.id,
            kind: approval.kind,
            decision: input.decision,
            note: input.note,
            decidedBy: who,
          },
        });
      });

      if (input.decision === "approved") {
        if (approval.kind === "artifact-accept" && approval.nodeKey) {
          const payload = approval.payload as { artifactId?: number };
          if (payload.artifactId) {
            await db
              .update(artifacts)
              .set({ accepted: true, reviewedBy: who })
              .where(eq(artifacts.id, payload.artifactId));
          }
          // Guarded: only a node still waiting on this decision transitions.
          await setNodeState(run.id, approval.nodeKey, "accepted", { artifactId: payload.artifactId ?? null, decidedBy: who }, { fromStates: ["verifying"] });
        } else if (approval.kind === "plan" && approval.nodeKey) {
          // Start gate cleared: the waiting node becomes claimable again.
          await setNodeState(run.id, approval.nodeKey, "ready", { decidedBy: who }, { fromStates: ["waiting"] });
        }
        await setRunState(run.id, "running", { fromStates: ["awaiting_approval", "paused"] });
        ensureAdvancing(run.id);
      } else {
        if (approval.kind === "artifact-accept" && approval.nodeKey) {
          await setNodeState(run.id, approval.nodeKey, "failed", { reason: "artifact rejected by owner" }, { fromStates: ["verifying"] });
          await setRunState(run.id, "failed", { endReason: "artifact rejected by owner", actor: "human" });
        } else {
          await setRunState(run.id, "stopped_human", { endReason: "start approval rejected by owner", actor: "human" });
        }
        await appendEvent(run.id, {
          type: "run_state",
          actor: "human",
          payload: { state: "terminal", note: input.note },
        });
      }
      return { ok: true };
    }),
});

const artifactsRouter = createRouter({
  listByRun: authedQuery
    .input(z.object({ runId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      await mustOwnRun(ctx.user.id, input.runId);
      return getDb()
        .select()
        .from(artifacts)
        .where(eq(artifacts.runId, input.runId))
        .orderBy(artifacts.id);
    }),
  /** Fresh presigned URL — keys are persisted, URLs never are. */
  downloadUrl: authedQuery
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const artifact = await db.query.artifacts.findFirst({
        where: eq(artifacts.id, input.id),
      });
      if (!artifact) throw new TRPCError({ code: "NOT_FOUND" });
      await mustOwnRun(ctx.user.id, artifact.runId);
      if (!artifact.storageKey) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `artifact content was never stored (${artifact.storageError ?? "STORAGE_NOT_PROVISIONED"}): the failure was recorded honestly — no file exists to download`,
        });
      }
      try {
        const { url } = await storage.getPresignedUrl({
          key: artifact.storageKey,
          download: true,
        });
        return { url };
      } catch (err) {
        const code = (err as { code?: string })?.code ?? "STORAGE_UPSTREAM_ERROR";
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `storage error ${code}: cannot mint a download URL right now`,
        });
      }
    }),
  /** Independent human review (producer is a node; reviewer is the owner). */
  review: authedQuery
    .input(
      z.object({
        id: z.number().int().positive(),
        decision: z.enum(["accept", "reject"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const artifact = await db.query.artifacts.findFirst({
        where: eq(artifacts.id, input.id),
      });
      if (!artifact) throw new TRPCError({ code: "NOT_FOUND" });
      await mustOwnRun(ctx.user.id, artifact.runId);
      await db
        .update(artifacts)
        .set({
          accepted: input.decision === "accept",
          reviewedBy: ctx.user.name ?? `user-${ctx.user.id}`,
        })
        .where(eq(artifacts.id, artifact.id));
      await appendEvent(artifact.runId, {
        type: "artifact_created",
        actor: "human",
        nodeKey: artifact.nodeKey,
        payload: { artifactId: artifact.id, review: input.decision },
      });
      return { ok: true };
    }),
});

const knowledgeRouter = createRouter({
  list: authedQuery
    .input(z.object({ projectId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      await mustOwnProject(ctx.user.id, input.projectId);
      return getDb()
        .select()
        .from(knowledgeDrafts)
        .where(eq(knowledgeDrafts.projectId, input.projectId))
        .orderBy(desc(knowledgeDrafts.createdAt));
    }),
  submit: authedQuery
    .input(
      z.object({
        projectId: z.number().int().positive(),
        sourceRunId: z.number().int().positive().optional(),
        title: z.string().min(1).max(500),
        body: z.string().min(10).max(50_000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await mustOwnProject(ctx.user.id, input.projectId);
      const [row] = await getDb().insert(knowledgeDrafts).values({
        projectId: input.projectId,
        sourceRunId: input.sourceRunId ?? null,
        title: input.title,
        body: input.body,
        state: "in-review",
      });
      return { id: Number(row.insertId) };
    }),
  /** Promotion creates only a QUARANTINED skill candidate — separate vetting
   * is required before it can ever be assigned to a live run. */
  review: authedQuery
    .input(
      z.object({
        draftId: z.number().int().positive(),
        decision: z.enum(["promote", "reject"]),
        note: z.string().max(2000).default(""),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const draft = await db.query.knowledgeDrafts.findFirst({
        where: eq(knowledgeDrafts.id, input.draftId),
      });
      if (!draft) throw new TRPCError({ code: "NOT_FOUND" });
      await mustOwnProject(ctx.user.id, draft.projectId);
      if (draft.state !== "in-review") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "draft already decided" });
      }
      const who = ctx.user.name ?? `user-${ctx.user.id}`;
      if (input.decision === "reject") {
        await db
          .update(knowledgeDrafts)
          .set({ state: "rejected", reviewer: who, decidedAt: new Date() })
          .where(eq(knowledgeDrafts.id, draft.id));
        return { ok: true, promotedSkillId: null };
      }
      const name = `knowledge-patch-${draft.id}`;
      const content = `---\nname: ${name}\ndescription: ${draft.title}\n---\n\n${draft.body}`;
      const [skillRow] = await db.insert(skills).values({
        ownerId: ctx.user.id,
        name,
        version: "0.1.0",
        description: draft.title,
        manifest: {
          name,
          version: "0.1.0",
          description: draft.title,
          capabilities: [],
          toolsAllowed: [],
          costClass: "low",
          inputArtifactTypes: [],
          outputArtifactTypes: [],
          licenseDeclared: "",
          provenanceUrl: `knowledge-draft:${draft.id}`,
        },
        bodyText: draft.body,
        riskSignals: [{ kind: "hook-config", detail: "unvetted knowledge promotion — quarantined by policy" }],
        contentSha256: sha256Hex(content),
        status: "quarantined",
        provenanceUrl: `knowledge-draft:${draft.id}`,
        licenseDeclared: "",
      });
      await db
        .update(knowledgeDrafts)
        .set({ state: "promoted", reviewer: who, decidedAt: new Date() })
        .where(eq(knowledgeDrafts.id, draft.id));
      return { ok: true, promotedSkillId: Number(skillRow.insertId) };
    }),
});

function buildMarkdownReport(
  project: { name: string; goal: string },
  run: typeof runs.$inferSelect,
  usage: { promptTokens: number; completionTokens: number; calls: number; costUsdMicros: number },
  artifactRows: (typeof artifacts.$inferSelect)[],
): string {
  const lines = [
    `# Research report — ${project.name}`,
    "",
    `- Goal: ${project.goal}`,
    `- Run #${run.id} (${run.mode}, provider ${run.provider}, model ${run.model ?? "n/a"})`,
    `- State: ${run.state}${run.endReason ? ` — ${run.endReason}` : ""}`,
    `- Usage: ${usage.promptTokens + usage.completionTokens} tokens, ${usage.calls} calls, $${(usage.costUsdMicros / 1e6).toFixed(4)}${run.mode === "mock" ? " (simulated mock cents, not billing)" : ""}`,
    "",
    "## Artifacts",
    "",
  ];
  for (const a of artifactRows) {
    lines.push(`### ${a.title}`);
    lines.push(`- node: ${a.nodeKey} · kind: ${a.kind} · sha256: ${a.contentSha256 ?? "n/a"}`);
    lines.push(`- accepted: ${a.accepted ? "yes" : "no"}${a.storageKey ? "" : ` · storage: ${a.storageError ?? "unavailable"}`}`);
    if (a.summary) lines.push(`- summary: ${a.summary}`);
    lines.push("");
  }
  return lines.join("\n");
}

const exportsRouter = createRouter({
  create: authedQuery
    .input(
      z.object({
        projectId: z.number().int().positive(),
        runId: z.number().int().positive().optional(),
        format: z.enum(["json", "markdown"]).default("markdown"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const project = await mustOwnProject(ctx.user.id, input.projectId);
      const db = getDb();
      let run: typeof runs.$inferSelect | null = null;
      let artifactRows: (typeof artifacts.$inferSelect)[] = [];
      let usage = { promptTokens: 0, completionTokens: 0, calls: 0, costUsdMicros: 0 };
      if (input.runId) {
        const owned = await mustOwnRun(ctx.user.id, input.runId);
        run = owned.run;
        artifactRows = await db
          .select()
          .from(artifacts)
          .where(eq(artifacts.runId, run.id));
        const u = await runUsage(run);
        usage = { promptTokens: u.promptTokens, completionTokens: u.completionTokens, calls: u.calls, costUsdMicros: u.costUsdMicros };
      }
      const content =
        input.format === "json"
          ? JSON.stringify({ project: { name: project.name, goal: project.goal }, run, artifacts: artifactRows, usage }, null, 2)
          : run
            ? buildMarkdownReport(project, run, usage, artifactRows)
            : `# Project report — ${project.name}\n\nGoal: ${project.goal}\n\nNo run selected.\n`;
      try {
        const saved = await storage.uploadFile({
          fileContent: Buffer.from(content, "utf8"),
          fileName: `exports/${project.id}/${Date.now()}-report.${input.format === "json" ? "json" : "md"}`,
          contentType: input.format === "json" ? "application/json" : "text/markdown",
        });
        const [row] = await db.insert(exportsTable).values({
          projectId: project.id,
          runId: input.runId ?? null,
          format: input.format,
          storageKey: saved.key,
          createdBy: ctx.user.id,
        });
        return { id: Number(row.insertId), storageError: null };
      } catch (err) {
        const code = (err as { code?: string })?.code ?? "STORAGE_UPSTREAM_ERROR";
        await db.insert(exportsTable).values({
          projectId: project.id,
          runId: input.runId ?? null,
          format: input.format,
          storageKey: null,
          storageError: code,
          createdBy: ctx.user.id,
        });
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `export failed: storage error ${code}. The failure is recorded; nothing was faked.`,
        });
      }
    }),
  list: authedQuery
    .input(z.object({ projectId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      await mustOwnProject(ctx.user.id, input.projectId);
      return getDb()
        .select()
        .from(exportsTable)
        .where(eq(exportsTable.projectId, input.projectId))
        .orderBy(desc(exportsTable.createdAt))
        .limit(50);
    }),
  downloadUrl: authedQuery
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const ex = await db.query.exportsTable.findFirst({
        where: eq(exportsTable.id, input.id),
      });
      if (!ex) throw new TRPCError({ code: "NOT_FOUND" });
      await mustOwnProject(ctx.user.id, ex.projectId);
      if (!ex.storageKey) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `export has no stored file (${ex.storageError ?? "STORAGE_NOT_PROVISIONED"})`,
        });
      }
      const { url } = await storage.getPresignedUrl({ key: ex.storageKey, download: true });
      return { url };
    }),
});

const ledgerRouter = createRouter({
  byRun: authedQuery
    .input(z.object({ runId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      await mustOwnRun(ctx.user.id, input.runId);
      return getDb()
        .select()
        .from(budgetLedger)
        .where(eq(budgetLedger.runId, input.runId))
        .orderBy(budgetLedger.id);
    }),
});

export const runtimeRouter = createRouter({
  runs: runsRouter,
  events: eventsRouter,
  approvals: approvalsRouter,
  artifacts: artifactsRouter,
  knowledge: knowledgeRouter,
  exports: exportsRouter,
  ledger: ledgerRouter,
});
