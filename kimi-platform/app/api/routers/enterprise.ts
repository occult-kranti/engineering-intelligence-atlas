import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { desc, eq, sql } from "drizzle-orm";
import { createRouter, authedQuery } from "../middleware";
import { getDb } from "../queries/connection";
import { enterpriseEvents, enterprises } from "@db/schema";
import {
  ENTERPRISE_ACTIONS,
  ENTERPRISE_PRESETS,
  EnterpriseBudgetSchema,
  EnterpriseKeySchema,
  MEMORY_SCOPES,
} from "@contracts/enterprise";
import {
  EnterpriseError,
  applyBlueprint,
  decideContract,
  decideMemory,
  enterpriseLedgerPage,
  enterpriseTimelinePage,
  getEnterpriseSnapshot,
  listEnterpriseWorkers,
  listMemory,
  mustOwnEnterprise,
  pauseProgram,
  previewBlueprint,
  proposeMemory,
  pumpProgram,
  reassignEnterpriseWorker,
  releaseContract,
  resumeProgram,
  revokeMemory,
  searchEnterpriseArtifacts,
  setEnterpriseWorkerCapacity,
  setEnterpriseWorkerSuspended,
  startProgram,
  cancelProgram,
} from "../enterprise";

/**
 * Enterprise / CEO mode router. Every procedure is owner-scoped through
 * mustOwnEnterprise (404 unknown / 403 foreign). Mutations are explicit human
 * actions; queries are pure reads with no execution side effects.
 */

function rethrow(err: unknown): never {
  if (err instanceof EnterpriseError) {
    const code =
      err.code === "NOT_FOUND"
        ? "NOT_FOUND"
        : err.code === "FORBIDDEN"
          ? "FORBIDDEN"
          : err.code === "CONFLICT" || err.code === "BLUEPRINT_DRIFT"
            ? "CONFLICT"
            : err.code === "BUDGET_EXHAUSTED" ||
                err.code === "PLAN_GATE" ||
                err.code === "APPROVAL_REQUIRED" ||
                err.code === "UNSTAFFED" ||
                err.code === "SKILL_UNAVAILABLE" ||
                err.code === "NO_HASH"
              ? "PRECONDITION_FAILED"
              : "BAD_REQUEST";
    throw new TRPCError({ code, message: err.message });
  }
  throw err;
}

const blueprintInput = z
  .object({
    preset: z.enum(ENTERPRISE_PRESETS),
    programId: EnterpriseKeySchema,
    name: z.string().min(1).max(255),
    mission: z.string().min(1).max(2000),
    budget: EnterpriseBudgetSchema,
    maxReplans: z.number().int().min(0).max(10).default(2),
    maxConcurrentRuns: z.number().int().positive().max(4).default(4),
  })
  .strict();

const sha256 = z.string().regex(/^[0-9a-f]{64}$/);

/** Declarative action → procedure mapping (ENTERPRISE_ACTIONS parity). */
export const ACTION_PROCEDURES: Record<string, string> = {
  "blueprint.apply": "enterprise.applyBlueprint",
  "contract.decide": "enterprise.decideContract",
  "contract.release": "enterprise.releaseContract",
  "program.start": "enterprise.programStart",
  "program.pause": "enterprise.programPause",
  "program.resume": "enterprise.programResume",
  "program.cancel": "enterprise.programCancel",
  "worker.reassign": "enterprise.workerReassign",
  "worker.capacity": "enterprise.workerCapacity",
  "worker.suspend": "enterprise.workerSuspend",
  "memory.promote": "enterprise.decideMemory",
  "memory.revoke": "enterprise.revokeMemory",
};

export const enterpriseRouter = createRouter({
  /** CEO overview list: the owner's enterprises with versions and status. */
  list: authedQuery.query(async ({ ctx }) => {
    const db = getDb();
    return db
      .select()
      .from(enterprises)
      .where(eq(enterprises.ownerId, ctx.user.id))
      .orderBy(desc(enterprises.id))
      .limit(50);
  }),

  /** Declarative action registry + the procedures each control dispatches. */
  actions: authedQuery.query(() =>
    ENTERPRISE_ACTIONS.map((a) => ({ ...a, procedure: ACTION_PROCEDURES[a.id] ?? null })),
  ),

  /** Pure blueprint preview: generator + materialization plan + hashes. */
  preview: authedQuery.input(blueprintInput).query(async ({ input }) => {
    try {
      return await previewBlueprint(input);
    } catch (err) {
      rethrow(err);
    }
  }),

  /**
   * Blueprint activation (approval kind "blueprint-activation"): the human
   * approves the exact previewed blueprintHash + payloadHash; drift between
   * preview and apply is a CONFLICT, never a silent re-sign.
   */
  applyBlueprint: authedQuery
    .input(
      blueprintInput.extend({
        expectedBlueprintHash: sha256,
        expectedPayloadHash: sha256,
        approved: z.literal(true),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await applyBlueprint(ctx.user, input);
      } catch (err) {
        rethrow(err);
      }
    }),

  /** Full owner-scoped snapshot (version/event-seq invalidating cache). */
  snapshot: authedQuery
    .input(z.object({ enterpriseId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      try {
        return await getEnterpriseSnapshot(ctx.user.id, input.enterpriseId);
      } catch (err) {
        rethrow(err);
      }
    }),

  decideContract: authedQuery
    .input(
      z.object({
        contractId: z.number().int().positive(),
        decision: z.enum(["approved", "rejected"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await decideContract(ctx.user, input.contractId, input.decision);
      } catch (err) {
        rethrow(err);
      }
    }),

  /** Drain (no new claims) then release once in-flight claims finish. */
  releaseContract: authedQuery
    .input(z.object({ contractId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      try {
        return await releaseContract(ctx.user, input.contractId);
      } catch (err) {
        rethrow(err);
      }
    }),

  proposeMemory: authedQuery
    .input(
      z.object({
        enterpriseId: z.number().int().positive(),
        scope: z.enum(MEMORY_SCOPES),
        scopeKey: EnterpriseKeySchema,
        artifactId: z.number().int().positive(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await proposeMemory(ctx.user, input.enterpriseId, input);
      } catch (err) {
        rethrow(err);
      }
    }),

  /** The memory-promote approval gate (approval kind "memory-promote"). */
  decideMemory: authedQuery
    .input(
      z.object({
        memoryId: z.number().int().positive(),
        decision: z.enum(["promote", "reject"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        await decideMemory(ctx.user, input.memoryId, input.decision);
        return { ok: true };
      } catch (err) {
        rethrow(err);
      }
    }),

  revokeMemory: authedQuery
    .input(z.object({ memoryId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      try {
        await revokeMemory(ctx.user, input.memoryId);
        return { ok: true };
      } catch (err) {
        rethrow(err);
      }
    }),

  /** Reference-only artifact search (title/summary + hashes, never bodies). */
  searchArtifacts: authedQuery
    .input(
      z.object({
        enterpriseId: z.number().int().positive(),
        query: z.string().max(200).default(""),
        limit: z.number().int().positive().max(50).default(25),
      }),
    )
    .query(async ({ ctx, input }) => {
      try {
        return await searchEnterpriseArtifacts(
          ctx.user.id,
          input.enterpriseId,
          input.query,
          input.limit,
        );
      } catch (err) {
        rethrow(err);
      }
    }),

  listMemory: authedQuery
    .input(
      z.object({
        enterpriseId: z.number().int().positive(),
        scope: z.enum(MEMORY_SCOPES).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      try {
        return await listMemory(ctx.user.id, input.enterpriseId, input.scope);
      } catch (err) {
        rethrow(err);
      }
    }),

  programStart: authedQuery
    .input(z.object({ programId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      try {
        await startProgram(ctx.user, input.programId);
        return { ok: true };
      } catch (err) {
        rethrow(err);
      }
    }),

  programPause: authedQuery
    .input(z.object({ programId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      try {
        await pauseProgram(ctx.user, input.programId);
        return { ok: true };
      } catch (err) {
        rethrow(err);
      }
    }),

  programResume: authedQuery
    .input(z.object({ programId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      try {
        await resumeProgram(ctx.user, input.programId);
        return { ok: true };
      } catch (err) {
        rethrow(err);
      }
    }),

  programCancel: authedQuery
    .input(z.object({ programId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      try {
        await cancelProgram(ctx.user, input.programId);
        return { ok: true };
      } catch (err) {
        rethrow(err);
      }
    }),

  /** Manual pump (same idempotent path the boot sweep uses). */
  programPump: authedQuery
    .input(z.object({ programId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      try {
        const { mustOwnProgram } = await import("../enterprise");
        await mustOwnProgram(ctx.user.id, input.programId);
        await pumpProgram(ctx.user, input.programId);
        return { ok: true };
      } catch (err) {
        rethrow(err);
      }
    }),

  /** Derived work ledger (keyset paginated; no provider calls). */
  ledger: authedQuery
    .input(
      z.object({
        enterpriseId: z.number().int().positive(),
        afterSeq: z.number().int().nonnegative().default(0),
        limit: z.number().int().positive().max(200).default(100),
      }),
    )
    .query(async ({ ctx, input }) => {
      try {
        return await enterpriseLedgerPage(ctx.user.id, input.enterpriseId, input);
      } catch (err) {
        rethrow(err);
      }
    }),

  /** Timeline index derived from the ledger (pure contract function). */
  timeline: authedQuery
    .input(
      z.object({
        enterpriseId: z.number().int().positive(),
        afterSeq: z.number().int().nonnegative().default(0),
        limit: z.number().int().positive().max(200).default(100),
      }),
    )
    .query(async ({ ctx, input }) => {
      try {
        return await enterpriseTimelinePage(ctx.user.id, input.enterpriseId, input);
      } catch (err) {
        rethrow(err);
      }
    }),

  /** Append-only enterprise audit stream (keyset on seq). */
  events: authedQuery
    .input(
      z.object({
        enterpriseId: z.number().int().positive(),
        afterSeq: z.number().int().nonnegative().default(0),
        limit: z.number().int().positive().max(500).default(200),
      }),
    )
    .query(async ({ ctx, input }) => {
      try {
        await mustOwnEnterprise(ctx.user.id, input.enterpriseId);
        return getDb()
          .select()
          .from(enterpriseEvents)
          .where(
            sql`${enterpriseEvents.enterpriseId} = ${input.enterpriseId} AND ${enterpriseEvents.seq} > ${input.afterSeq}`,
          )
          .orderBy(enterpriseEvents.seq)
          .limit(input.limit);
      } catch (err) {
        rethrow(err);
      }
    }),

  /** Shared worker pool across company projects (stewards excluded). */
  workers: authedQuery
    .input(z.object({ enterpriseId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      try {
        return await listEnterpriseWorkers(ctx.user.id, input.enterpriseId);
      } catch (err) {
        rethrow(err);
      }
    }),

  workerSuspend: authedQuery
    .input(
      z.object({ workerId: z.number().int().positive(), suspended: z.boolean() }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await setEnterpriseWorkerSuspended(ctx.user, input.workerId, input.suspended);
      } catch (err) {
        rethrow(err);
      }
    }),

  workerCapacity: authedQuery
    .input(
      z.object({
        workerId: z.number().int().positive(),
        maxConcurrentClaims: z.number().int().min(1).max(8),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await setEnterpriseWorkerCapacity(ctx.user, input.workerId, input.maxConcurrentClaims);
      } catch (err) {
        rethrow(err);
      }
    }),

  workerReassign: authedQuery
    .input(
      z.object({
        workerId: z.number().int().positive(),
        departmentId: z.number().int().positive().nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await reassignEnterpriseWorker(ctx.user, input.workerId, input.departmentId);
      } catch (err) {
        rethrow(err);
      }
    }),
});
