import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { and, eq, inArray } from "drizzle-orm";
import { createRouter, authedQuery } from "../middleware";
import { getDb } from "../queries/connection";
import { idempotencyKeys, runNodes, runs, workers, type Worker } from "@db/schema";
import {
  AssignmentModeSchema,
  LEASE_TTL,
  TERMINAL_RUN_STATES,
  WorkerKindSchema,
} from "@contracts/run";
import { SkillPinSchema } from "@contracts/dag";
import {
  assignNode,
  cancelNodeCascade,
  claimNextNode,
  completeClaimedNode,
  ensureDirectorWorker,
  failClaimedNode,
  heartbeatLease,
  reassignNode,
  releaseClaim,
  sweepExpiredLeases,
  FenceError,
} from "../engine/control-plane";
import {
  ensureAdvancing,
  isDuplicateKeyError,
  pauseRun,
  pumpOneNode,
  resumeRun,
  stopRun,
} from "../engine/scheduler";
import { mustOwnProject } from "./planning";

/**
 * Control-plane router (Revision A): owner-scoped tRPC surface for the
 * durable shared roadmap — roadmap status, the project worker pool, atomic
 * claim/pump, and lease lifecycle (heartbeat/release/reassign/cancel/sweep).
 *
 * Every procedure is owner-scoped (mustOwnProject/mustOwnRun). Mutations
 * accept an optional idempotencyKey; a replayed key returns the stored
 * response verbatim without re-executing. Lease-token failures map to
 * CONFLICT (409); nothing here ever executes code.
 */

const idempotencyKeyInput = z.string().min(1).max(128).optional();

function mapControlError(err: unknown): never {
  if (err instanceof TRPCError) throw err;
  if (err instanceof FenceError) {
    throw new TRPCError({ code: "CONFLICT", message: err.message, cause: err });
  }
  throw err;
}

async function mustOwnRun(userId: number, runId: number) {
  const db = getDb();
  const run = await db.query.runs.findFirst({ where: eq(runs.id, runId) });
  if (!run) throw new TRPCError({ code: "NOT_FOUND", message: "run not found" });
  await mustOwnProject(userId, run.projectId);
  return run;
}

async function mustOwnWorker(userId: number, workerId: number): Promise<Worker> {
  const db = getDb();
  const worker = await db.query.workers.findFirst({ where: eq(workers.id, workerId) });
  if (!worker) throw new TRPCError({ code: "NOT_FOUND", message: "worker not found" });
  await mustOwnProject(userId, worker.projectId);
  return worker;
}

/** Replay-safe mutation wrapper (§4.1 idempotency_keys). */
async function withIdempotency<T>(
  ownerId: number,
  scope: string,
  key: string | undefined,
  fn: () => Promise<T>,
): Promise<T> {
  if (!key) return fn();
  const db = getDb();
  const existing = await db.query.idempotencyKeys.findFirst({
    where: and(
      eq(idempotencyKeys.ownerId, ownerId),
      eq(idempotencyKeys.scope, scope),
      eq(idempotencyKeys.key, key),
    ),
  });
  if (existing) return existing.response as T;
  const result = await fn();
  try {
    await db.insert(idempotencyKeys).values({
      ownerId,
      scope,
      key,
      response: result === undefined ? null : (result as object),
    });
  } catch {
    // Concurrent replay inserted first — return the stored response.
    const raced = await db.query.idempotencyKeys.findFirst({
      where: and(
        eq(idempotencyKeys.ownerId, ownerId),
        eq(idempotencyKeys.scope, scope),
        eq(idempotencyKeys.key, key),
      ),
    });
    if (raced) return raced.response as T;
  }
  return result;
}

// ── Workers (pool membership, capacity, eligibility metadata) ────

const workersRouter = createRouter({
  list: authedQuery
    .input(z.object({ projectId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      await mustOwnProject(ctx.user.id, input.projectId);
      return getDb().select().from(workers).where(eq(workers.projectId, input.projectId));
    }),
  register: authedQuery
    .input(
      z.object({
        projectId: z.number().int().positive(),
        name: z.string().min(1).max(255),
        kind: WorkerKindSchema,
        role: z.string().min(1).max(255),
        capabilities: z.array(z.string().min(1).max(120)).max(32).default([]),
        skillRefs: z.array(SkillPinSchema).max(32).default([]),
        maxConcurrentClaims: z.number().int().min(1).max(16).default(1),
        leaseTtlSeconds: z
          .number()
          .int()
          .min(LEASE_TTL.minSeconds)
          .max(LEASE_TTL.maxSeconds)
          .default(LEASE_TTL.defaultSeconds),
        idempotencyKey: idempotencyKeyInput,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await mustOwnProject(ctx.user.id, input.projectId);
      return withIdempotency(ctx.user.id, "workers.register", input.idempotencyKey, async () => {
        const db = getDb();
        try {
          const [row] = await db.insert(workers).values({
            projectId: input.projectId,
            name: input.name,
            kind: input.kind,
            role: input.role,
            capabilities: input.capabilities,
            skillRefs: input.skillRefs,
            maxConcurrentClaims: input.maxConcurrentClaims,
            leaseTtlSeconds: input.leaseTtlSeconds,
          });
          return {
            ok: true as const,
            workerId: Number(row.insertId),
          };
        } catch (err) {
          if (isDuplicateKeyError(err)) {
            throw new TRPCError({
              code: "CONFLICT",
              message: `worker "${input.name}" already exists in this project`,
            });
          }
          throw err;
        }
      });
    }),
  setStatus: authedQuery
    .input(
      z.object({
        workerId: z.number().int().positive(),
        status: z.enum(["active", "suspended"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await mustOwnWorker(ctx.user.id, input.workerId);
      await getDb()
        .update(workers)
        .set({ status: input.status })
        .where(eq(workers.id, input.workerId));
      return { ok: true };
    }),
  /** Worker capacity + lease TTL tuning. */
  setCapacity: authedQuery
    .input(
      z.object({
        workerId: z.number().int().positive(),
        maxConcurrentClaims: z.number().int().min(1).max(16),
        leaseTtlSeconds: z
          .number()
          .int()
          .min(LEASE_TTL.minSeconds)
          .max(LEASE_TTL.maxSeconds)
          .optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await mustOwnWorker(ctx.user.id, input.workerId);
      await getDb()
        .update(workers)
        .set({
          maxConcurrentClaims: input.maxConcurrentClaims,
          ...(input.leaseTtlSeconds ? { leaseTtlSeconds: input.leaseTtlSeconds } : {}),
        })
        .where(eq(workers.id, input.workerId));
      return { ok: true };
    }),
});

// ── Pool (project-wide dispatch control) ─────────────────────────

async function projectActiveRuns(projectId: number, states: string[]) {
  return getDb()
    .select({ id: runs.id, state: runs.state })
    .from(runs)
    .where(and(eq(runs.projectId, projectId), inArray(runs.state, states as never)));
}

const poolRouter = createRouter({
  status: authedQuery
    .input(z.object({ projectId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      await mustOwnProject(ctx.user.id, input.projectId);
      const db = getDb();
      const poolWorkers = await db
        .select()
        .from(workers)
        .where(eq(workers.projectId, input.projectId));
      const activeRuns = await projectActiveRuns(input.projectId, [
        "queued",
        "running",
        "awaiting_approval",
        "paused",
      ]);
      return {
        workers: poolWorkers,
        activeRuns,
        paused: activeRuns.every((r) => r.state === "paused"),
      };
    }),
  /** Pause dispatch for every running/queued run of the project. */
  pause: authedQuery
    .input(z.object({ projectId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      await mustOwnProject(ctx.user.id, input.projectId);
      const who = ctx.user.name ?? `user-${ctx.user.id}`;
      const targets = await projectActiveRuns(input.projectId, ["queued", "running"]);
      let paused = 0;
      for (const r of targets) {
        try {
          await pauseRun(r.id, who);
          paused += 1;
        } catch {
          /* transitioned concurrently — fine */
        }
      }
      return { ok: true, paused };
    }),
  /** Resume every paused run of the project. */
  resume: authedQuery
    .input(z.object({ projectId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      await mustOwnProject(ctx.user.id, input.projectId);
      const who = ctx.user.name ?? `user-${ctx.user.id}`;
      const targets = await projectActiveRuns(input.projectId, ["paused"]);
      let resumed = 0;
      for (const r of targets) {
        try {
          await resumeRun(r.id, who);
          resumed += 1;
        } catch {
          /* transitioned concurrently — fine */
        }
      }
      return { ok: true, resumed };
    }),
  /** Start (seed the director worker + nudge all advanceable runs). */
  start: authedQuery
    .input(z.object({ projectId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      await mustOwnProject(ctx.user.id, input.projectId);
      const director = await ensureDirectorWorker(input.projectId);
      const targets = await projectActiveRuns(input.projectId, ["queued", "running"]);
      for (const r of targets) ensureAdvancing(r.id);
      return { ok: true, directorWorkerId: director.id, advancing: targets.length };
    }),
  /** Stop every active run of the project (human stop semantics). */
  stop: authedQuery
    .input(z.object({ projectId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      await mustOwnProject(ctx.user.id, input.projectId);
      const who = ctx.user.name ?? `user-${ctx.user.id}`;
      const targets = await projectActiveRuns(input.projectId, [
        "queued",
        "running",
        "awaiting_approval",
        "paused",
      ]);
      let stopped = 0;
      for (const r of targets) {
        await stopRun(r.id, who);
        stopped += 1;
      }
      return { ok: true, stopped };
    }),
});

// ── Control plane: status + claim/lease lifecycle ────────────────

export const controlRouter = createRouter({
  workers: workersRouter,
  pool: poolRouter,

  /** Roadmap status: run + DAG nodes (with claim/lease metadata) + workers. */
  roadmapStatus: authedQuery
    .input(z.object({ runId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const run = await mustOwnRun(ctx.user.id, input.runId);
      const db = getDb();
      const nodes = await db.select().from(runNodes).where(eq(runNodes.runId, run.id));
      const poolWorkers = await db
        .select()
        .from(workers)
        .where(eq(workers.projectId, run.projectId));
      const leases = nodes
        .filter((n) => n.leaseToken)
        .map((n) => ({
          nodeKey: n.nodeKey,
          state: n.state,
          workerId: n.leaseWorkerId,
          heartbeatAt: n.heartbeatAt,
          leaseExpiresAt: n.leaseExpiresAt,
        }));
      return { run, nodes, workers: poolWorkers, leases };
    }),

  /** Director/manual assignment of a not-yet-claimed node. */
  assign: authedQuery
    .input(
      z.object({
        runId: z.number().int().positive(),
        nodeKey: z.string().min(1).max(64),
        workerId: z.number().int().positive().nullable(),
        assignmentMode: AssignmentModeSchema.optional(),
        idempotencyKey: idempotencyKeyInput,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const run = await mustOwnRun(ctx.user.id, input.runId);
      if (input.workerId) {
        const worker = await mustOwnWorker(ctx.user.id, input.workerId);
        // Cross-project assignment is forbidden even within one owner.
        if (worker.projectId !== run.projectId) {
          throw new TRPCError({ code: "FORBIDDEN", message: "worker is not in this project" });
        }
      }
      return withIdempotency(ctx.user.id, "control.assign", input.idempotencyKey, async () => {
        try {
          await assignNode(
            run.id,
            input.nodeKey,
            input.workerId,
            ctx.user.name ?? `user-${ctx.user.id}`,
          );
          if (input.assignmentMode) {
            await getDb()
              .update(runNodes)
              .set({ assignmentMode: input.assignmentMode })
              .where(and(eq(runNodes.runId, run.id), eq(runNodes.nodeKey, input.nodeKey)));
          }
          return { ok: true as const };
        } catch (err) {
          mapControlError(err);
        }
      });
    }),

  /**
   * Atomic self-claim of one eligible node for a worker. Returns the claim
   * (lease token included — shown once, to the owner) or claimed:null when
   * nothing is eligible right now (not an error).
   */
  claim: authedQuery
    .input(
      z.object({
        runId: z.number().int().positive(),
        workerId: z.number().int().positive(),
        nodeKey: z.string().min(1).max(64).optional(),
        idempotencyKey: idempotencyKeyInput,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const run = await mustOwnRun(ctx.user.id, input.runId);
      if (TERMINAL_RUN_STATES.has(run.state)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "run is terminal" });
      }
      const worker = await mustOwnWorker(ctx.user.id, input.workerId);
      if (worker.projectId !== run.projectId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "worker is not in this project" });
      }
      return withIdempotency(ctx.user.id, "control.claim", input.idempotencyKey, async () => {
        const claim = await claimNextNode(run, worker, { nodeKey: input.nodeKey });
        if (!claim) return { claimed: null };
        return {
          claimed: {
            nodeKey: claim.nodeKey,
            leaseToken: claim.leaseToken,
            attempt: claim.attempt,
            leaseExpiresAt: claim.node.leaseExpiresAt,
          },
        };
      });
    }),

  /** Claim one eligible node and dispatch it synchronously (fenced path). */
  pump: authedQuery
    .input(
      z.object({
        runId: z.number().int().positive(),
        workerId: z.number().int().positive().optional(),
        idempotencyKey: idempotencyKeyInput,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const run = await mustOwnRun(ctx.user.id, input.runId);
      return withIdempotency(ctx.user.id, "control.pump", input.idempotencyKey, async () => {
        try {
          const pumped = await pumpOneNode(run.id, input.workerId);
          return { pumped };
        } catch (err) {
          mapControlError(err);
        }
      });
    }),

  /** Lease heartbeat: extends expiry; fenced (409) when the token lost. */
  heartbeat: authedQuery
    .input(
      z.object({
        runId: z.number().int().positive(),
        nodeKey: z.string().min(1).max(64),
        leaseToken: z.string().min(1).max(36),
        idempotencyKey: idempotencyKeyInput,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const run = await mustOwnRun(ctx.user.id, input.runId);
      return withIdempotency(ctx.user.id, "control.heartbeat", input.idempotencyKey, async () => {
        try {
          const db = getDb();
          const node = await db.query.runNodes.findFirst({
            where: and(eq(runNodes.runId, run.id), eq(runNodes.nodeKey, input.nodeKey)),
          });
          const ttl = node?.leaseWorkerId
            ? ((await db.query.workers.findFirst({ where: eq(workers.id, node.leaseWorkerId) }))
                ?.leaseTtlSeconds ?? LEASE_TTL.defaultSeconds)
            : LEASE_TTL.defaultSeconds;
          const hb = await heartbeatLease(run.id, input.nodeKey, input.leaseToken, ttl);
          return { ok: true as const, leaseExpiresAt: hb.leaseExpiresAt };
        } catch (err) {
          mapControlError(err);
        }
      });
    }),

  /** Release a claim pre-dispatch: node returns to ready. */
  release: authedQuery
    .input(
      z.object({
        runId: z.number().int().positive(),
        nodeKey: z.string().min(1).max(64),
        leaseToken: z.string().min(1).max(36),
        idempotencyKey: idempotencyKeyInput,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const run = await mustOwnRun(ctx.user.id, input.runId);
      return withIdempotency(ctx.user.id, "control.release", input.idempotencyKey, async () => {
        try {
          await releaseClaim(run.id, input.nodeKey, input.leaseToken);
          return { ok: true as const };
        } catch (err) {
          mapControlError(err);
        }
      });
    }),

  /** Worker completion signal: running → verifying, lease-fenced. */
  complete: authedQuery
    .input(
      z.object({
        runId: z.number().int().positive(),
        nodeKey: z.string().min(1).max(64),
        leaseToken: z.string().min(1).max(36),
        idempotencyKey: idempotencyKeyInput,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const run = await mustOwnRun(ctx.user.id, input.runId);
      return withIdempotency(ctx.user.id, "control.complete", input.idempotencyKey, async () => {
        try {
          await completeClaimedNode(run.id, input.nodeKey, input.leaseToken);
          return { ok: true as const };
        } catch (err) {
          mapControlError(err);
        }
      });
    }),

  /** Worker failure signal: running → failed, lease-fenced. */
  fail: authedQuery
    .input(
      z.object({
        runId: z.number().int().positive(),
        nodeKey: z.string().min(1).max(64),
        leaseToken: z.string().min(1).max(36),
        reason: z.string().min(1).max(500),
        idempotencyKey: idempotencyKeyInput,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const run = await mustOwnRun(ctx.user.id, input.runId);
      return withIdempotency(ctx.user.id, "control.fail", input.idempotencyKey, async () => {
        try {
          await failClaimedNode(run.id, input.nodeKey, input.leaseToken, input.reason);
          return { ok: true as const };
        } catch (err) {
          mapControlError(err);
        }
      });
    }),

  /** Owner override: fence the current lease and retarget assignment. */
  reassign: authedQuery
    .input(
      z.object({
        runId: z.number().int().positive(),
        nodeKey: z.string().min(1).max(64),
        workerId: z.number().int().positive().nullable(),
        idempotencyKey: idempotencyKeyInput,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const run = await mustOwnRun(ctx.user.id, input.runId);
      if (input.workerId) {
        const worker = await mustOwnWorker(ctx.user.id, input.workerId);
        // Cross-project assignment is forbidden even within one owner.
        if (worker.projectId !== run.projectId) {
          throw new TRPCError({ code: "FORBIDDEN", message: "worker is not in this project" });
        }
      }
      return withIdempotency(ctx.user.id, "control.reassign", input.idempotencyKey, async () => {
        try {
          await reassignNode(
            run.id,
            input.nodeKey,
            input.workerId,
            ctx.user.name ?? `user-${ctx.user.id}`,
          );
          return { ok: true as const };
        } catch (err) {
          mapControlError(err);
        }
      });
    }),

  /** Owner cancellation (terminal) with downstream propagation. */
  cancel: authedQuery
    .input(
      z.object({
        runId: z.number().int().positive(),
        nodeKey: z.string().min(1).max(64),
        expectedVersion: z.number().int().positive().optional(),
        idempotencyKey: idempotencyKeyInput,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const run = await mustOwnRun(ctx.user.id, input.runId);
      return withIdempotency(ctx.user.id, "control.cancel", input.idempotencyKey, async () => {
        if (input.expectedVersion !== undefined) {
          const db = getDb();
          const node = await db.query.runNodes.findFirst({
            where: and(eq(runNodes.runId, run.id), eq(runNodes.nodeKey, input.nodeKey)),
          });
          if (node && node.version !== input.expectedVersion) {
            throw new TRPCError({
              code: "CONFLICT",
              message: `version_conflict: node is at version ${node.version}, expected ${input.expectedVersion}`,
            });
          }
        }
        try {
          const cancelled = await cancelNodeCascade(
            run.id,
            input.nodeKey,
            ctx.user.name ?? `user-${ctx.user.id}`,
          );
          return { ok: true as const, cancelled };
        } catch (err) {
          mapControlError(err);
        }
      });
    }),

  /** Run the lease sweeper now (bounded), scoped to this run. */
  sweep: authedQuery
    .input(
      z.object({
        runId: z.number().int().positive(),
        limit: z.number().int().min(1).max(200).default(50),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const run = await mustOwnRun(ctx.user.id, input.runId);
      const result = await sweepExpiredLeases({ runId: run.id, limit: input.limit });
      return result;
    }),
});
