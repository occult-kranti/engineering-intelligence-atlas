import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, gt, sql } from "drizzle-orm";
import { createRouter, authedQuery } from "../middleware";
import { getDb } from "../queries/connection";
import {
  officeAssignments,
  officeBlueprints,
  officeEvents,
  officeRooms,
  runNodes,
  runs,
  workers,
  type Worker,
} from "@db/schema";
import {
  ClaimsPolicySchema,
  OfficeBlueprintSpecSchema,
  PERMANENT_OFFICE_WORKER_NAMES,
  RoomBudgetsSchema,
  type OfficeBlueprintSpec,
} from "@contracts/office";
import {
  DEFAULT_ROOMS,
  deriveRoomHealth,
  deriveSetupChecklist,
  planAssignment,
  planReassignment,
  type OfficeAgent,
} from "../office/allocation";
import {
  appendOfficeEventTx,
  ensureOfficeWorkers,
  roomUsage,
  toRoomSpec,
} from "../office/store";
import { isDuplicateKeyError } from "../engine/scheduler";
import { mustOwnProject } from "./planning";

/**
 * Office router (design §4): blueprint materialization, room budgets, and
 * transactional worker seating. All mutations follow the control-plane
 * discipline — lock order is worker row THEN room row (ascending), the
 * guarded UPDATE's affectedRows is the arbiter, and every state change
 * lands its office_events audit row in the same transaction.
 */

const idempotencyKeyInput = z.string().min(1).max(128).optional();

type Db = ReturnType<typeof getDb>;
type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

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

async function loadActiveBlueprint(projectId: number) {
  const db = getDb();
  const blueprint = await db.query.officeBlueprints.findFirst({
    where: and(eq(officeBlueprints.projectId, projectId), eq(officeBlueprints.status, "active")),
  });
  if (!blueprint) return null;
  const rooms = await db
    .select()
    .from(officeRooms)
    .where(eq(officeRooms.blueprintId, blueprint.id))
    .orderBy(asc(officeRooms.id));
  return { blueprint, rooms };
}

async function roomOccupancyTx(tx: Tx, roomId: number): Promise<number> {
  const [row] = await tx
    .select({ n: sql<number>`COUNT(*)` })
    .from(officeAssignments)
    .where(and(eq(officeAssignments.roomId, roomId), eq(officeAssignments.state, "active")));
  return Number(row?.n ?? 0);
}

/** The OfficeAgent view model over a locked worker row. */
async function toOfficeAgentTx(tx: Tx, worker: Worker): Promise<OfficeAgent> {
  const [row] = await tx
    .select({ n: sql<number>`COUNT(*)` })
    .from(runNodes)
    .where(
      and(
        eq(runNodes.leaseWorkerId, worker.id),
        sql`${runNodes.state} IN ('claimed','running')`,
      ),
    );
  return {
    workerId: worker.id,
    name: worker.name,
    kind: worker.kind,
    role: worker.role,
    capabilities: worker.capabilities,
    status: worker.status,
    maxConcurrentClaims: worker.maxConcurrentClaims,
    activeClaims: Number(row?.n ?? 0),
    roomKey: worker.roomKey ?? null,
    version: worker.version,
  };
}

const isPermanent = (name: string) =>
  (PERMANENT_OFFICE_WORKER_NAMES as readonly string[]).includes(name);

async function buildStatus(projectId: number) {
  const db = getDb();
  const active = await loadActiveBlueprint(projectId);
  if (!active) {
    return { blueprint: null, rooms: [], permanentWorkers: [], checklist: null };
  }
  const assignments = await db
    .select()
    .from(officeAssignments)
    .where(
      and(
        eq(officeAssignments.projectId, projectId),
        eq(officeAssignments.state, "active"),
      ),
    );
  const pool = await db.select().from(workers).where(eq(workers.projectId, projectId));
  const permanentWorkers = pool.filter((w) => isPermanent(w.name));
  const rooms = [];
  for (const room of active.rooms) {
    const occupancy = assignments.filter((a) => a.roomId === room.id).length;
    const usage = await roomUsage(projectId, room.roomKey);
    const budgetUtilization = Math.max(
      usage.tokens / Math.max(room.budgets.maxTokens, 1),
      usage.costUsdMicros / Math.max(room.budgets.maxCostUsd * 1_000_000, 1),
    );
    const storageUtilization = usage.storageBytes / Math.max(room.budgets.maxStorageBytes, 1);
    rooms.push({
      ...toRoomSpec(room),
      id: room.id,
      version: room.version,
      occupancy,
      usage,
      health: deriveRoomHealth({
        occupancy,
        capacity: room.capacity,
        budgetUtilization,
        storageUtilization,
        anyWaitingOver10Min: false,
        staleLeaseNames: [],
        anyFailedAtMaxAttempts: false,
        providerMisconfigured: false,
        storageErrors: 0,
      }),
      seats: assignments
        .filter((a) => a.roomId === room.id)
        .map((a) => ({
          assignmentId: a.id,
          workerId: a.workerId,
          runId: a.runId,
          nodeKey: a.nodeKey,
          version: a.version,
        })),
    });
  }
  const hired = pool.filter(
    (w) => !isPermanent(w.name) && w.name !== "director" && !w.name.startsWith("role:"),
  );
  const seatsTotal = active.rooms.reduce((acc, r) => acc + r.capacity, 0);
  const checklist = deriveSetupChecklist({
    agentsHired: hired.length + permanentWorkers.length,
    seatsFilled: assignments.length,
    seatsTotal,
    roomsWithAllocation: active.rooms.filter(
      (r) => r.budgets.maxTokens > 0 && r.budgets.maxStorageBytes > 0,
    ).length,
    roomsTotal: active.rooms.length,
    anyTaskRunning: false, // observed per-run; the checklist is advisory
  });
  return {
    blueprint: {
      id: active.blueprint.id,
      revision: active.blueprint.revision,
      version: active.blueprint.version,
      spec: active.blueprint.spec,
    },
    rooms,
    permanentWorkers: permanentWorkers.map((w) => ({
      id: w.id,
      name: w.name,
      role: w.role,
      roomKey: w.roomKey,
    })),
    checklist,
  };
}

export const officeRouter = createRouter({
  /** Active blueprint, room rollups (occupancy/usage/health), checklist. */
  status: authedQuery
    .input(z.object({ projectId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      await mustOwnProject(ctx.user.id, input.projectId);
      return buildStatus(input.projectId);
    }),

  /**
   * Materialize the office (design §4.5): insert blueprint revision 1 with
   * the 8 canonical rooms (or a caller-supplied valid spec), activate it,
   * seed the two propose-only permanent workers and seat them in the
   * Operations Deck — one transaction. CONFLICT when already set up.
   */
  setup: authedQuery
    .input(
      z.object({
        projectId: z.number().int().positive(),
        spec: OfficeBlueprintSpecSchema.optional(),
        idempotencyKey: idempotencyKeyInput,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await mustOwnProject(ctx.user.id, input.projectId);
      return withIdempotency(ctx.user.id, "office.setup", input.idempotencyKey, async () => {
        const db = getDb();
        const existing = await loadActiveBlueprint(input.projectId);
        if (existing) {
          throw new TRPCError({
            code: "CONFLICT",
            message: `project already has an active office blueprint (${existing.blueprint.id})`,
          });
        }
        const spec: OfficeBlueprintSpec =
          input.spec ??
          ({
            revision: 1,
            rooms: [...DEFAULT_ROOMS],
            roleRooms: {},
          } satisfies OfficeBlueprintSpec);
        // Idempotent worker seeding BEFORE the tx (race-safe unique key).
        const permanent = await ensureOfficeWorkers(input.projectId);
        let result: { blueprintId: number; rooms: number };
        try {
          result = await db.transaction(async (tx) => {
          const [bpRow] = await tx.insert(officeBlueprints).values({
            projectId: input.projectId,
            revision: 1,
            spec,
            status: "active",
            createdBy: ctx.user.id,
            activatedAt: new Date(),
          });
          const blueprintId = Number(bpRow.insertId);
          const roomIdByKey = new Map<string, number>();
          for (const room of spec.rooms) {
            const [roomRow] = await tx.insert(officeRooms).values({
              projectId: input.projectId,
              blueprintId,
              roomKey: room.key,
              name: room.name,
              kind: room.kind,
              capacity: room.capacity,
              eligibleRolePatterns: room.eligibleRolePatterns,
              budgets: room.budgets,
            });
            roomIdByKey.set(room.key, Number(roomRow.insertId));
          }
          // Seat the permanent workers (propose-only system seats; they may
          // observe + report + propose, never write/execute — §7).
          const opsRoomId = roomIdByKey.get("operations");
          for (const worker of permanent) {
            if (!opsRoomId) break;
            await tx.insert(officeAssignments).values({
              projectId: input.projectId,
              roomId: opsRoomId,
              workerId: worker.id,
            });
            await tx
              .update(workers)
              .set({ roomKey: "operations", version: sql`${workers.version} + 1` })
              .where(eq(workers.id, worker.id));
          }
          await appendOfficeEventTx(tx, input.projectId, {
            type: "office_blueprint_activated",
            actor: "human",
            payload: {
              blueprintId,
              revision: 1,
              rooms: spec.rooms.length,
              permanentWorkers: permanent.map((w) => w.name),
            },
          });
          return { blueprintId, rooms: spec.rooms.length };
          });
        } catch (err) {
          // Two concurrent setups race the (project_id, revision) unique
          // index — the loser gets CONFLICT, never a raw 500.
          if (isDuplicateKeyError(err)) {
            throw new TRPCError({
              code: "CONFLICT",
              message: "office blueprint was created concurrently — the office is already set up",
            });
          }
          throw err;
        }
        return { ...result, status: await buildStatus(input.projectId) };
      });
    }),

  /** Rooms of the active blueprint with occupancy/usage/seats. */
  rooms: authedQuery
    .input(z.object({ projectId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      await mustOwnProject(ctx.user.id, input.projectId);
      const status = await buildStatus(input.projectId);
      return status.rooms;
    }),

  /**
   * Room budget/capacity editor (design §4.2): OCC-guarded transactional
   * update; shrinking capacity below current occupancy is CONFLICT.
   */
  allocate: authedQuery
    .input(
      z.object({
        projectId: z.number().int().positive(),
        roomId: z.number().int().positive(),
        budgets: RoomBudgetsSchema,
        capacity: z.number().int().min(1).max(64).optional(),
        expectedVersion: z.number().int().min(1),
        idempotencyKey: idempotencyKeyInput,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await mustOwnProject(ctx.user.id, input.projectId);
      return withIdempotency(ctx.user.id, "office.allocate", input.idempotencyKey, async () => {
        const db = getDb();
        return db.transaction(async (tx) => {
          const room = await tx.query.officeRooms.findFirst({
            where: and(eq(officeRooms.id, input.roomId), eq(officeRooms.projectId, input.projectId)),
          });
          if (!room) throw new TRPCError({ code: "NOT_FOUND", message: "room not found" });
          const occupancy = await roomOccupancyTx(tx, room.id);
          if (input.capacity !== undefined && input.capacity < occupancy) {
            throw new TRPCError({
              code: "CONFLICT",
              message: `capacity ${input.capacity} is below current occupancy ${occupancy}`,
            });
          }
          const [res] = await tx
            .update(officeRooms)
            .set({
              budgets: input.budgets,
              ...(input.capacity !== undefined ? { capacity: input.capacity } : {}),
              version: sql`${officeRooms.version} + 1`,
            })
            .where(and(eq(officeRooms.id, room.id), eq(officeRooms.version, input.expectedVersion)));
          if (res.affectedRows !== 1) {
            throw new TRPCError({
              code: "CONFLICT",
              message: `room version conflict (current ${room.version})`,
            });
          }
          await appendOfficeEventTx(tx, input.projectId, {
            type: "office_room_allocated",
            actor: "human",
            payload: {
              roomId: room.id,
              roomKey: room.roomKey,
              budgets: input.budgets,
              capacity: input.capacity ?? room.capacity,
            },
          });
          return { roomId: room.id, version: input.expectedVersion + 1 };
        });
      });
    }),

  /**
   * Seat a worker (design §4.4): lock worker row THEN room row; re-run
   * eligibility/capacity/budget against fresh in-tx state; the guarded
   * worker UPDATE (OCC version) is the arbiter. Permanent workers are
   * propose-only: they may hold a system seat but can never be linked to
   * run/node work.
   */
  assign: authedQuery
    .input(
      z.object({
        projectId: z.number().int().positive(),
        roomId: z.number().int().positive(),
        workerId: z.number().int().positive(),
        runId: z.number().int().positive().optional(),
        nodeKey: z.string().min(1).max(64).optional(),
        expectedVersion: z.number().int().min(1),
        idempotencyKey: idempotencyKeyInput,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await mustOwnProject(ctx.user.id, input.projectId);
      if ((input.runId !== undefined || input.nodeKey !== undefined) && !(input.runId !== undefined && input.nodeKey !== undefined)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "runId and nodeKey must be provided together" });
      }
      return withIdempotency(ctx.user.id, "office.assign", input.idempotencyKey, async () => {
        const db = getDb();
        return db.transaction(async (tx) => {
          // 1. Lock the worker row first (lock order: worker → room).
          const [workerRow] = await tx
            .select()
            .from(workers)
            .where(and(eq(workers.id, input.workerId), eq(workers.projectId, input.projectId)))
            .for("update");
          const worker = workerRow;
          if (!worker) throw new TRPCError({ code: "NOT_FOUND", message: "worker not found" });
          if (isPermanent(worker.name) && input.runId !== undefined) {
            throw new TRPCError({
              code: "FORBIDDEN",
              message: `permanent office worker "${worker.name}" is propose-only and cannot be assigned run work`,
            });
          }
          // 2. Lock the room row.
          const [room] = await tx
            .select()
            .from(officeRooms)
            .where(and(eq(officeRooms.id, input.roomId), eq(officeRooms.projectId, input.projectId)))
            .for("update");
          if (!room) throw new TRPCError({ code: "NOT_FOUND", message: "room not found" });
          // 3. Optional run/node linkage must belong to the same project.
          if (input.runId !== undefined) {
            const node = await tx.query.runNodes.findFirst({
              where: and(eq(runNodes.runId, input.runId), eq(runNodes.nodeKey, input.nodeKey!)),
            });
            if (!node) throw new TRPCError({ code: "NOT_FOUND", message: "run node not found" });
            const runRow = await tx.query.runs.findFirst({
              where: eq(runs.id, input.runId),
            });
            if (!runRow || runRow.projectId !== input.projectId) {
              throw new TRPCError({ code: "NOT_FOUND", message: "run not found in this project" });
            }
          }
          // 4. Re-check eligibility/capacity/budget on fresh in-tx state.
          const agent = await toOfficeAgentTx(tx, worker);
          const occupancy = await roomOccupancyTx(tx, room.id);
          const usage = await roomUsage(input.projectId, room.roomKey, tx);
          const decision = planAssignment({
            agent,
            room: toRoomSpec(room),
            occupancy,
            expectedVersion: input.expectedVersion,
            runId: input.runId,
            nodeKey: input.nodeKey,
            usage,
          });
          if (!decision.ok) {
            const err = decision.error;
            throw new TRPCError({
              code: "CONFLICT",
              message:
                err.error === "version_conflict"
                  ? `worker version conflict (current ${err.currentVersion})`
                  : `worker is ineligible for room ${room.roomKey}: ${err.reasons.join(", ")}`,
            });
          }
          // 5. Guarded worker update (OCC) is the arbiter.
          const [res] = await tx
            .update(workers)
            .set({ roomKey: room.roomKey, version: sql`${workers.version} + 1` })
            .where(and(eq(workers.id, worker.id), eq(workers.version, input.expectedVersion)));
          if (res.affectedRows !== 1) {
            throw new TRPCError({ code: "CONFLICT", message: "worker version conflict" });
          }
          await tx.insert(officeAssignments).values({
            projectId: input.projectId,
            roomId: room.id,
            workerId: worker.id,
            runId: input.runId ?? null,
            nodeKey: input.nodeKey ?? null,
          });
          if (input.runId !== undefined) {
            // Link the concrete run node: OCC-guarded room stamp. The node
            // may be claimed/dispatched concurrently (version bumps on every
            // transition); losing the race rolls the whole assignment back.
            const node = (await tx.query.runNodes.findFirst({
              where: and(eq(runNodes.runId, input.runId), eq(runNodes.nodeKey, input.nodeKey!)),
            }))!;
            const [stamped] = await tx
              .update(runNodes)
              .set({ roomKey: room.roomKey, version: sql`${runNodes.version} + 1` })
              .where(
                and(
                  eq(runNodes.runId, input.runId),
                  eq(runNodes.nodeKey, input.nodeKey!),
                  eq(runNodes.version, node.version),
                ),
              );
            if (stamped.affectedRows !== 1) {
              throw new TRPCError({
                code: "CONFLICT",
                message: `run node ${input.nodeKey} transitioned concurrently (version ${node.version} lost) — retry the assignment`,
              });
            }
          }
          await appendOfficeEventTx(tx, input.projectId, {
            type: decision.plan.event.type,
            actor: "human",
            payload: decision.plan.event.payload,
          });
          return { assigned: true, workerId: worker.id, roomKey: room.roomKey };
        });
      });
    }),

  /**
   * Move a seated worker (design §4.4): release + assign in one
   * transaction. Active claims require an explicit claimsPolicy —
   * "release-requeue" returns claimed nodes to ready immediately; "drain"
   * stops new claims and transfers on last completion (sweeper-driven).
   */
  reassign: authedQuery
    .input(
      z.object({
        projectId: z.number().int().positive(),
        workerId: z.number().int().positive(),
        toRoomId: z.number().int().positive(),
        expectedVersion: z.number().int().min(1),
        claimsPolicy: ClaimsPolicySchema.optional(),
        idempotencyKey: idempotencyKeyInput,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await mustOwnProject(ctx.user.id, input.projectId);
      return withIdempotency(ctx.user.id, "office.reassign", input.idempotencyKey, async () => {
        const db = getDb();
        return db.transaction(async (tx) => {
          const [worker] = await tx
            .select()
            .from(workers)
            .where(and(eq(workers.id, input.workerId), eq(workers.projectId, input.projectId)))
            .for("update");
          if (!worker) throw new TRPCError({ code: "NOT_FOUND", message: "worker not found" });
          if (worker.pendingRoomKey) {
            throw new TRPCError({
              code: "CONFLICT",
              message: `worker is already draining into room ${worker.pendingRoomKey}`,
            });
          }
          const currentSeat = await tx.query.officeAssignments.findFirst({
            where: and(eq(officeAssignments.workerId, worker.id), eq(officeAssignments.state, "active")),
          });
          if (!currentSeat) {
            throw new TRPCError({ code: "CONFLICT", message: "worker has no active seat to reassign" });
          }
          const [fromRoom] = await tx
            .select()
            .from(officeRooms)
            .where(eq(officeRooms.id, currentSeat.roomId))
            .for("update");
          const [toRoom] = await tx
            .select()
            .from(officeRooms)
            .where(and(eq(officeRooms.id, input.toRoomId), eq(officeRooms.projectId, input.projectId)))
            .for("update");
          if (!toRoom) throw new TRPCError({ code: "NOT_FOUND", message: "target room not found" });
          if (fromRoom && fromRoom.id === toRoom.id) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "worker is already seated in that room" });
          }
          const agent = await toOfficeAgentTx(tx, worker);
          const occupancy = await roomOccupancyTx(tx, toRoom.id);
          const usage = await roomUsage(input.projectId, toRoom.roomKey, tx);
          const decision = planReassignment({
            agent,
            fromRoomKey: fromRoom?.roomKey ?? "unknown",
            toRoom: toRoomSpec(toRoom),
            occupancy,
            expectedVersion: input.expectedVersion,
            claimsPolicy: input.claimsPolicy,
            usage,
          });
          if (!decision.ok) {
            const err = decision.error;
            throw new TRPCError({
              code: "CONFLICT",
              message:
                err.error === "version_conflict"
                  ? `worker version conflict (current ${err.currentVersion})`
                  : err.error === "claims_policy_required"
                    ? `worker holds ${err.activeClaims} active claim(s); claimsPolicy is required`
                    : `worker is ineligible for room ${toRoom.roomKey}: ${err.reasons.join(", ")}`,
            });
          }
          const effect = decision.plan.effect.kind;
          if (effect === "drain") {
            // Stop new claims; the sweeper completes the transfer on last
            // completion (guarded by the worker OCC version).
            const [res] = await tx
              .update(workers)
              .set({ pendingRoomKey: toRoom.roomKey, version: sql`${workers.version} + 1` })
              .where(and(eq(workers.id, worker.id), eq(workers.version, input.expectedVersion)));
            if (res.affectedRows !== 1) {
              throw new TRPCError({ code: "CONFLICT", message: "worker version conflict" });
            }
          } else {
            if (effect === "release-requeue") {
              // Return this worker's claimed/running nodes to ready (leases
              // fenced; attempts preserved; engine redispatches honestly).
              await tx
                .update(runNodes)
                .set({
                  state: "ready",
                  leaseToken: null,
                  leaseWorkerId: null,
                  leaseExpiresAt: null,
                  version: sql`${runNodes.version} + 1`,
                })
                .where(
                  and(
                    eq(runNodes.leaseWorkerId, worker.id),
                    sql`${runNodes.state} IN ('claimed','running')`,
                  ),
                );
            }
            const [res] = await tx
              .update(workers)
              .set({ roomKey: toRoom.roomKey, version: sql`${workers.version} + 1` })
              .where(and(eq(workers.id, worker.id), eq(workers.version, input.expectedVersion)));
            if (res.affectedRows !== 1) {
              throw new TRPCError({ code: "CONFLICT", message: "worker version conflict" });
            }
            await tx
              .update(officeAssignments)
              .set({ state: "released", releasedAt: new Date(), version: sql`${officeAssignments.version} + 1` })
              .where(
                and(
                  eq(officeAssignments.id, currentSeat.id),
                  eq(officeAssignments.version, currentSeat.version),
                ),
              );
            await tx.insert(officeAssignments).values({
              projectId: input.projectId,
              roomId: toRoom.id,
              workerId: worker.id,
              runId: currentSeat.runId,
              nodeKey: currentSeat.nodeKey,
            });
          }
          await appendOfficeEventTx(tx, input.projectId, {
            type: decision.plan.event.type,
            actor: "human",
            payload: decision.plan.event.payload,
          });
          return { reassigned: true, workerId: worker.id, effect, toRoomKey: toRoom.roomKey };
        });
      });
    }),

  /**
   * Release a seat (guarded state flip + worker row update, same tx).
   * Permanent workers are never released — their seats are system seats.
   */
  release: authedQuery
    .input(
      z.object({
        projectId: z.number().int().positive(),
        assignmentId: z.number().int().positive(),
        idempotencyKey: idempotencyKeyInput,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await mustOwnProject(ctx.user.id, input.projectId);
      return withIdempotency(ctx.user.id, "office.release", input.idempotencyKey, async () => {
        const db = getDb();
        return db.transaction(async (tx) => {
          const [assignment] = await tx
            .select()
            .from(officeAssignments)
            .where(
              and(eq(officeAssignments.id, input.assignmentId), eq(officeAssignments.projectId, input.projectId)),
            )
            .for("update");
          if (!assignment) throw new TRPCError({ code: "NOT_FOUND", message: "assignment not found" });
          if (assignment.state !== "active") {
            throw new TRPCError({ code: "CONFLICT", message: "assignment is already released" });
          }
          const [worker] = await tx
            .select()
            .from(workers)
            .where(eq(workers.id, assignment.workerId))
            .for("update");
          if (worker && isPermanent(worker.name)) {
            throw new TRPCError({
              code: "FORBIDDEN",
              message: `permanent office worker "${worker.name}" holds a system seat and is never released`,
            });
          }
          const room = await tx.query.officeRooms.findFirst({
            where: eq(officeRooms.id, assignment.roomId),
          });
          const [res] = await tx
            .update(officeAssignments)
            .set({ state: "released", releasedAt: new Date(), version: sql`${officeAssignments.version} + 1` })
            .where(
              and(
                eq(officeAssignments.id, assignment.id),
                eq(officeAssignments.version, assignment.version),
              ),
            );
          if (res.affectedRows !== 1) {
            throw new TRPCError({ code: "CONFLICT", message: "assignment version conflict" });
          }
          if (worker && room && worker.roomKey === room.roomKey && !worker.pendingRoomKey) {
            await tx
              .update(workers)
              .set({ roomKey: null, version: sql`${workers.version} + 1` })
              .where(and(eq(workers.id, worker.id), eq(workers.version, worker.version)));
          }
          await appendOfficeEventTx(tx, input.projectId, {
            type: "office_agent_released",
            actor: "human",
            payload: {
              assignmentId: assignment.id,
              agentId: assignment.workerId,
              agentName: worker?.name ?? null,
              roomKey: room?.roomKey ?? null,
            },
          });
          return { released: true, assignmentId: assignment.id };
        });
      });
    }),

  /** Tail the project-scoped office event stream (append-only audit). */
  events: authedQuery
    .input(
      z.object({
        projectId: z.number().int().positive(),
        afterSeq: z.number().int().min(0).default(0),
        limit: z.number().int().min(1).max(200).default(50),
      }),
    )
    .query(async ({ ctx, input }) => {
      await mustOwnProject(ctx.user.id, input.projectId);
      const db = getDb();
      return db
        .select()
        .from(officeEvents)
        .where(and(eq(officeEvents.projectId, input.projectId), gt(officeEvents.seq, input.afterSeq)))
        .orderBy(desc(officeEvents.seq))
        .limit(input.limit);
    }),
});
