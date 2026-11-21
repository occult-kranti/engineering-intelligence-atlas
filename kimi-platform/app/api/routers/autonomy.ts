import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, inArray, isNull, like, sql } from "drizzle-orm";
import { createRouter, authedQuery } from "../middleware";
import { getDb } from "../queries/connection";
import { autonomyGrants, officeEvents, projects, runs } from "@db/schema";
import {
  AutonomyBudgetSchema,
  AutonomyModeSchema,
  AutonomyScopeSchema,
  AUTONOMY_GRANT_TTL,
} from "@contracts/office";
import { usdToMicros } from "@contracts/dag";
import { TERMINAL_RUN_STATES } from "@contracts/run";
import {
  planEmergencyStop,
  planGrantRevocation,
  planGrantSupersede,
  validateGrantRequest,
} from "../office/autonomy";
import {
  appendOfficeEventTx,
  grantUsage,
  loadActiveGrantForProject,
  loadGrantById,
  toAutonomyGrant,
} from "../office/store";
import { stopRun } from "../engine/scheduler";
import { mustOwnProject } from "./planning";

/**
 * Autonomy router (design §2.3): owner-only grant lifecycle. Grants are
 * explicit, expiring, revocable rows — never ambient settings. Mode 'none'
 * is a narrow, budget-capped preauthorization; it never waives plan
 * approval, confirmLive, source policy, credentials, or never-bypassable
 * approval classes (enforced by the pure resolveApprovalGate at the two
 * scheduler call sites).
 */

const idempotencyKeyInput = z.string().min(1).max(128).optional();

// Same replay-safe wrapper discipline as the control router.
async function withIdempotency<T>(
  ownerId: number,
  scope: string,
  key: string | undefined,
  fn: () => Promise<T>,
): Promise<T> {
  const db = getDb();
  if (!key) return fn();
  const { idempotencyKeys } = await import("@db/schema");
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

export const autonomyRouter = createRouter({
  /**
   * Raise a new grant: validates the request (TTL bounds; mode 'none' +
   * allowLive requires a low-risk project), supersede-revokes every active
   * grant for the project, inserts the new grant, and appends one audited
   * `autonomy_granted` office event — one transaction (design §2.3).
   */
  grant: authedQuery
    .input(
      z.object({
        projectId: z.number().int().positive(),
        scope: AutonomyScopeSchema.default("project"),
        /**
         * Scope 'run': either an existing run to bind to, or omitted for an
         * UNBOUND run-scoped grant — createRun then binds it atomically to
         * exactly one run (the guarded bind rejects every concurrent run).
         */
        runId: z.number().int().positive().optional(),
        mode: AutonomyModeSchema,
        allowLive: z.boolean().default(false),
        budgets: AutonomyBudgetSchema,
        expiresInMinutes: z
          .number()
          .int()
          .min(AUTONOMY_GRANT_TTL.minMinutes)
          .max(AUTONOMY_GRANT_TTL.maxMinutes),
        reason: z.string().max(500).default(""),
        idempotencyKey: idempotencyKeyInput,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const project = await mustOwnProject(ctx.user.id, input.projectId);
      if (input.scope === "run" && input.runId !== undefined) {
        const db = getDb();
        const run = await db.query.runs.findFirst({ where: eq(runs.id, input.runId) });
        if (!run || run.projectId !== input.projectId) {
          throw new TRPCError({ code: "NOT_FOUND", message: "run not found in this project" });
        }
        // Granting autonomy to a dead run is meaningless — reject honestly.
        if (TERMINAL_RUN_STATES.has(run.state)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `run ${input.runId} is terminal (${run.state}); a grant cannot attach to it`,
          });
        }
      }
      const verdict = validateGrantRequest({
        mode: input.mode,
        allowLive: input.allowLive,
        riskTier: project.riskTier,
        expiresInMinutes: input.expiresInMinutes,
        nowMs: Date.now(),
      });
      if (!verdict.ok) {
        throw new TRPCError({
          code: verdict.error === "live_requires_low_risk" ? "PRECONDITION_FAILED" : "BAD_REQUEST",
          message:
            verdict.error === "live_requires_low_risk"
              ? "mode 'none' with allowLive requires a low-risk project"
              : `grant TTL out of range (${AUTONOMY_GRANT_TTL.minMinutes}..${AUTONOMY_GRANT_TTL.maxMinutes} minutes)`,
        });
      }
      return withIdempotency(ctx.user.id, "autonomy.grant", input.idempotencyKey, async () => {
        const db = getDb();
        return db.transaction(async (tx) => {
          // Serialize concurrent grants for this project: the project row
          // lock is taken FIRST (before insert/supersede/event) so two
          // racing grants order cleanly instead of deadlocking or 500ing —
          // exactly one active grant can ever result.
          await tx
            .select({ id: projects.id })
            .from(projects)
            .where(eq(projects.id, input.projectId))
            .for("update");
          const active = await tx
            .select()
            .from(autonomyGrants)
            .where(and(eq(autonomyGrants.projectId, input.projectId), isNull(autonomyGrants.revokedAt)));
          const [inserted] = await tx.insert(autonomyGrants).values({
            projectId: input.projectId,
            scope: input.scope,
            runId: input.scope === "run" ? (input.runId ?? null) : null,
            mode: input.mode,
            allowLive: input.allowLive,
            maxTokens: input.budgets.maxTokens,
            maxCalls: input.budgets.maxCalls,
            maxMinutes: input.budgets.maxMinutes,
            maxCostUsdMicros: usdToMicros(input.budgets.maxCostUsd),
            grantedBy: ctx.user.id,
            grantedByName: ctx.user.name ?? "owner",
            grantedSessionId: null,
            reason: input.reason,
            expiresAt: new Date(verdict.expiresAtMs),
          });
          const grantId = Number(inserted.insertId);
          // Supersede: one guarded sweep revokes every prior active grant.
          await tx
            .update(autonomyGrants)
            .set({
              revokedAt: sql`NOW(3)`,
              revokedBy: ctx.user.name ?? "owner",
              revokeReason: `superseded by grant ${grantId}`,
            })
            .where(
              and(
                eq(autonomyGrants.projectId, input.projectId),
                isNull(autonomyGrants.revokedAt),
                sql`${autonomyGrants.id} <> ${grantId}`,
              ),
            );
          // A pre-bound run-scoped grant stamps the existing run atomically;
          // a run that already has a grant is CONFLICT (no silent rebind).
          if (input.scope === "run" && input.runId !== undefined) {
            const [stamped] = await tx
              .update(runs)
              .set({ autonomyGrantId: grantId })
              .where(and(eq(runs.id, input.runId), sql`${runs.autonomyGrantId} IS NULL`));
            if (stamped.affectedRows !== 1) {
              throw new TRPCError({
                code: "CONFLICT",
                message: `run ${input.runId} already has an autonomy grant stamped`,
              });
            }
          }
          const plan = planGrantSupersede({
            activeGrants: active.map(toAutonomyGrant),
            newGrantId: grantId,
            mode: input.mode,
            actorName: ctx.user.name ?? "owner",
            nowMs: Date.now(),
          });
          await appendOfficeEventTx(tx, input.projectId, plan.event);
          return { grantId, superseded: plan.supersededGrantIds, expiresAtMs: verdict.expiresAtMs };
        });
      });
    }),

  /**
   * Revoke one grant. Double-revoke is CONFLICT (guarded update,
   * affectedRows=0 — a race, not a silent success).
   */
  revoke: authedQuery
    .input(
      z.object({
        grantId: z.number().int().positive(),
        reason: z.string().min(1).max(500),
        idempotencyKey: idempotencyKeyInput,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const row = await loadGrantById(input.grantId);
      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "grant not found" });
      await mustOwnProject(ctx.user.id, row.projectId);
      return withIdempotency(ctx.user.id, "autonomy.revoke", input.idempotencyKey, async () => {
        const plan = planGrantRevocation({
          grant: row,
          actorName: ctx.user.name ?? "owner",
          reason: input.reason,
          nowMs: Date.now(),
        });
        if (!plan.ok) {
          throw new TRPCError({ code: "CONFLICT", message: "grant is already revoked" });
        }
        const db = getDb();
        return db.transaction(async (tx) => {
          const [res] = await tx
            .update(autonomyGrants)
            .set({ revokedAt: sql`NOW(3)`, revokedBy: ctx.user.name ?? "owner", revokeReason: input.reason })
            .where(and(eq(autonomyGrants.id, input.grantId), isNull(autonomyGrants.revokedAt)));
          if (res.affectedRows !== 1) {
            throw new TRPCError({ code: "CONFLICT", message: "grant is already revoked" });
          }
          await appendOfficeEventTx(tx, row.projectId, plan.event);
          return { revoked: true, grantId: input.grantId };
        });
      });
    }),

  /** Active grant + summed usage across all runs sharing it (§2.3). */
  status: authedQuery
    .input(z.object({ projectId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      await mustOwnProject(ctx.user.id, input.projectId);
      const db = getDb();
      const active = await loadActiveGrantForProject(input.projectId);
      const usage = active ? await grantUsage(active.id) : null;
      const recentEvents = await db
        .select({ seq: officeEvents.seq, type: officeEvents.type, payload: officeEvents.payload, createdAt: officeEvents.createdAt })
        .from(officeEvents)
        .where(and(eq(officeEvents.projectId, input.projectId), like(officeEvents.type, "autonomy_%")))
        .orderBy(desc(officeEvents.seq))
        .limit(20);
      return { activeGrant: active, usage, recentEvents };
    }),

  /** Grant history for the project (revoked/expired included). */
  list: authedQuery
    .input(
      z.object({
        projectId: z.number().int().positive(),
        includeInactive: z.boolean().default(true),
      }),
    )
    .query(async ({ ctx, input }) => {
      await mustOwnProject(ctx.user.id, input.projectId);
      const db = getDb();
      const rows = await db
        .select()
        .from(autonomyGrants)
        .where(
          input.includeInactive
            ? eq(autonomyGrants.projectId, input.projectId)
            : and(eq(autonomyGrants.projectId, input.projectId), isNull(autonomyGrants.revokedAt)),
        )
        .orderBy(desc(autonomyGrants.id))
        .limit(100);
      return rows.map(toAutonomyGrant);
    }),

  /**
   * Emergency stop (design §2.3): revoke ALL active grants, stopRun every
   * active run of the project (guarded transition + lease revocation —
   * in-flight dispatches are fenced, not killed mid-write), one audited
   * `autonomy_revoked` event with { emergency: true }. Idempotent: a replay
   * finds no active grants/runs and stops nothing twice.
   */
  emergencyStop: authedQuery
    .input(
      z.object({
        projectId: z.number().int().positive(),
        reason: z.string().min(1).max(500),
        idempotencyKey: idempotencyKeyInput,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await mustOwnProject(ctx.user.id, input.projectId);
      return withIdempotency(ctx.user.id, "autonomy.emergencyStop", input.idempotencyKey, async () => {
        const db = getDb();
        const activeRows = await db
          .select()
          .from(autonomyGrants)
          .where(and(eq(autonomyGrants.projectId, input.projectId), isNull(autonomyGrants.revokedAt)));
        const activeRuns = await db
          .select({ id: runs.id })
          .from(runs)
          .where(
            and(
              eq(runs.projectId, input.projectId),
              inArray(runs.state, ["queued", "running", "awaiting_approval", "paused"]),
            ),
          );
        const plan = planEmergencyStop({
          projectId: input.projectId,
          activeGrants: activeRows.map(toAutonomyGrant),
          activeRunIds: activeRuns.map((r) => r.id),
          actorName: ctx.user.name ?? "owner",
          reason: input.reason,
          nowMs: Date.now(),
        });
        await db.transaction(async (tx) => {
          await tx
            .update(autonomyGrants)
            .set({ revokedAt: sql`NOW(3)`, revokedBy: ctx.user.name ?? "owner", revokeReason: "emergency" })
            .where(and(eq(autonomyGrants.projectId, input.projectId), isNull(autonomyGrants.revokedAt)));
          await appendOfficeEventTx(tx, input.projectId, plan.event);
        });
        // Guarded stops AFTER the grant revocation commits: stopRun fences
        // in-flight leases via revokeRunLeases and is a no-op for runs that
        // finished concurrently.
        const stoppedRuns: number[] = [];
        for (const runId of plan.stopRunIds) {
          const before = await db.query.runs.findFirst({ where: eq(runs.id, runId) });
          if (!before) continue;
          await stopRun(runId, `emergency stop by ${ctx.user.name}`);
          const after = await db.query.runs.findFirst({ where: eq(runs.id, runId) });
          if (after && after.state === "stopped_human" && before.state !== "stopped_human") {
            stoppedRuns.push(runId);
          }
        }
        return { revokedGrants: plan.revokeGrantIds, stoppedRuns };
      });
    }),
});
