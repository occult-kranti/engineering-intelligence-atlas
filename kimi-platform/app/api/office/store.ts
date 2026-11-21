import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { getDb } from "../queries/connection";
import {
  autonomyGrants,
  budgetLedger,
  artifacts,
  officeAssignments,
  officeBlueprints,
  officeEvents,
  officeRooms,
  projects,
  runNodes,
  runs,
  workers,
  type AutonomyGrantRow,
  type OfficeRoom,
  type Run,
  type Worker,
} from "@db/schema";
import {
  PERMANENT_OFFICE_WORKERS,
  type AutonomyGrant,
  type GrantUsage,
  type OfficeEventType,
  type RoomUsage,
} from "@contracts/office";
import type { EventActor } from "@contracts/run";
import { planGrantExpirations } from "./autonomy";

/**
 * Persistence helpers for the autonomy/office/whiteboard features
 * (design §2.3, §2.5, §4). This is the ONLY module that maps between the
 * grant/room/event rows and the contract shapes the pure modules in
 * ./autonomy.ts, ./allocation.ts, ./whiteboard.ts, ./goal-modes.ts decide
 * over. The pure modules stay DB-free; every guarded write here follows the
 * control-plane discipline (advisory SELECT, then a state-guarded UPDATE —
 * affectedRows is the arbiter; no SKIP LOCKED).
 */

type Tx = Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0];

// ── Autonomy grants ──────────────────────────────────────────────

/** Map a grant row to the contract shape (epoch ms, DB NOW(3) discipline). */
export function toAutonomyGrant(row: AutonomyGrantRow): AutonomyGrant {
  return {
    id: row.id,
    projectId: row.projectId,
    scope: row.scope,
    runId: row.runId ?? null,
    mode: row.mode,
    allowLive: row.allowLive,
    maxTokens: row.maxTokens,
    maxCalls: row.maxCalls,
    maxMinutes: row.maxMinutes,
    maxCostUsdMicros: row.maxCostUsdMicros,
    grantedByName: row.grantedByName,
    reason: row.reason,
    expiresAtMs: row.expiresAt.getTime(),
    revokedAtMs: row.revokedAt ? row.revokedAt.getTime() : null,
    revokedBy: row.revokedBy ?? null,
    revokeReason: row.revokeReason ?? null,
  };
}

/**
 * The project's ACTIVE grant, if any: revoked_at IS NULL AND
 * expires_at > NOW(3) (DB-side clock, same skew discipline as leases).
 * At most one exists — autonomy.grant supersedes transactionally.
 */
export async function loadActiveGrantForProject(
  projectId: number,
): Promise<AutonomyGrant | null> {
  const db = getDb();
  const rows = await db
    .select()
    .from(autonomyGrants)
    .where(
      and(
        eq(autonomyGrants.projectId, projectId),
        isNull(autonomyGrants.revokedAt),
        sql`${autonomyGrants.expiresAt} > NOW(3)`,
      ),
    )
    .orderBy(autonomyGrants.id)
    .limit(2);
  const row = rows[rows.length - 1]; // newest wins defensively
  return row ? toAutonomyGrant(row) : null;
}

/** Load a grant by id in any state (null when missing). */
export async function loadGrantById(id: number): Promise<AutonomyGrant | null> {
  const db = getDb();
  const row = await db.query.autonomyGrants.findFirst({
    where: eq(autonomyGrants.id, id),
  });
  return row ? toAutonomyGrant(row) : null;
}

/**
 * The grant a run was stamped with, resolved FRESH at each dispatch: a
 * mid-run revoke/expiry degrades the next gate to the normal approval flow
 * (design §2.3) — expiry never kills accepted work, it only re-gates.
 */
export async function loadRunGrant(run: Run): Promise<AutonomyGrant | null> {
  if (!run.autonomyGrantId) return null;
  const db = getDb();
  const row = await db.query.autonomyGrants.findFirst({
    where: and(
      eq(autonomyGrants.id, run.autonomyGrantId),
      isNull(autonomyGrants.revokedAt),
      sql`${autonomyGrants.expiresAt} > NOW(3)`,
    ),
  });
  if (!row) return null;
  // Run-scoped binding is single-run: a grant bound to a DIFFERENT run is
  // not this run's grant (concurrent-bind loser degrades to mode 'all').
  if (row.runId !== null && row.runId !== run.id) return null;
  return toAutonomyGrant(row);
}

/**
 * Summed usage over every run sharing the grant (budget_ledger JOIN runs on
 * autonomy_grant_id; design §2.4). Minutes are summed per-run elapsed.
 */
export async function grantUsage(grantId: number): Promise<GrantUsage> {
  const db = getDb();
  const [row] = await db
    .select({
      prompt: sql<number>`COALESCE(SUM(${budgetLedger.tokensPrompt}), 0)`,
      completion: sql<number>`COALESCE(SUM(${budgetLedger.tokensCompletion}), 0)`,
      calls: sql<number>`COALESCE(SUM(${budgetLedger.calls}), 0)`,
      cost: sql<number>`COALESCE(SUM(${budgetLedger.costUsdMicros}), 0)`,
    })
    .from(budgetLedger)
    .innerJoin(runs, eq(budgetLedger.runId, runs.id))
    .where(eq(runs.autonomyGrantId, grantId));
  const grantRuns = await db
    .select({ startedAt: runs.startedAt, endedAt: runs.endedAt })
    .from(runs)
    .where(eq(runs.autonomyGrantId, grantId));
  const nowMs = Date.now();
  const minutes = grantRuns.reduce(
    (acc, r) =>
      acc + (((r.endedAt ?? new Date(nowMs)).getTime() - r.startedAt.getTime()) / 60_000),
    0,
  );
  return {
    tokens: Number(row?.prompt ?? 0) + Number(row?.completion ?? 0),
    calls: Number(row?.calls ?? 0),
    minutes,
    costUsdMicros: Number(row?.cost ?? 0),
  };
}

/**
 * Sweeper pass (design §2.3): expire grants whose TTL lapsed, one guarded
 * update + one `autonomy_expired` office event each. Idempotent on re-run —
 * the revoked_at IS NULL guard makes a second pass a no-op.
 */
export async function expireAutonomyGrants(opts: { limit?: number } = {}): Promise<number> {
  const db = getDb();
  const expired = await db
    .select()
    .from(autonomyGrants)
    .where(
      and(
        isNull(autonomyGrants.revokedAt),
        sql`${autonomyGrants.expiresAt} <= NOW(3)`,
      ),
    )
    .limit(Math.min(opts.limit ?? 50, 200));
  if (!expired.length) return 0;
  const nowMs = Date.now();
  const plan = planGrantExpirations(expired.map(toAutonomyGrant), nowMs);
  // Events are keyed by grant id, never by position: DB NOW(3) and this
  // process's clock can disagree by milliseconds, so a positional index
  // could mismatch rows↔events (and crash on a shorter events array).
  const draftByGrantId = new Map(
    plan.events.map((e) => [(e.payload as { grantId: number }).grantId, e]),
  );
  let swept = 0;
  for (const row of expired) {
    const draft = draftByGrantId.get(row.id);
    if (!draft) continue; // JS-clock view says not expired — next sweep
    const [res] = await db
      .update(autonomyGrants)
      .set({ revokedAt: sql`NOW(3)`, revokedBy: "system", revokeReason: "expired" })
      .where(and(eq(autonomyGrants.id, row.id), isNull(autonomyGrants.revokedAt)));
    if (res.affectedRows !== 1) continue; // revoked concurrently — no event
    swept += 1;
    await appendOfficeEvent(row.projectId, {
      type: draft.type,
      actor: draft.actor,
      payload: draft.payload,
    });
  }
  return swept;
}

// ── Office events (project-scoped append-only stream) ────────────

export interface OfficeEventFields {
  type: OfficeEventType;
  actor: EventActor;
  payload: Record<string, unknown>;
}

/**
 * Transactional variant: appends inside an existing transaction so a state
 * change and its audit event commit atomically. Seq allocation mirrors
 * appendEventTx: the PROJECT row is locked FOR UPDATE, next seq is computed,
 * and the insert lands under the (project_id, seq) unique constraint.
 */
export async function appendOfficeEventTx(
  tx: Tx,
  projectId: number,
  fields: OfficeEventFields,
): Promise<{ seq: number }> {
  await tx
    .select({ id: projects.id })
    .from(projects)
    .where(eq(projects.id, projectId))
    .for("update");
  // Current read (FOR UPDATE), same rationale as appendEventTx: a snapshot
  // aggregate under REPEATABLE READ can miss a concurrent commit and the
  // insert then collides on (project_id, seq).
  const [row] = await tx
    .select({ maxSeq: officeEvents.seq })
    .from(officeEvents)
    .where(eq(officeEvents.projectId, projectId))
    .orderBy(desc(officeEvents.seq))
    .limit(1)
    .for("update");
  const seq = Number(row?.maxSeq ?? 0) + 1;
  await tx.insert(officeEvents).values({
    projectId,
    seq,
    type: fields.type,
    actor: fields.actor,
    payload: fields.payload,
  });
  return { seq };
}

export async function appendOfficeEvent(
  projectId: number,
  fields: OfficeEventFields,
): Promise<{ seq: number }> {
  const db = getDb();
  return db.transaction(async (tx) => appendOfficeEventTx(tx, projectId, fields));
}

// ── Permanent office workers (design §4.3 / §7) ──────────────────

/**
 * Seed the two propose-only permanent workers (Blueprint Ops Manager,
 * Roadmap Cartographer). Idempotent and race-safe via the unique
 * (project_id, name) index — same pattern as ensureDirectorWorker.
 */
export async function ensureOfficeWorkers(projectId: number): Promise<Worker[]> {
  const db = getDb();
  const seeded: Worker[] = [];
  for (const spec of Object.values(PERMANENT_OFFICE_WORKERS)) {
    const existing = await db.query.workers.findFirst({
      where: and(eq(workers.projectId, projectId), eq(workers.name, spec.name)),
    });
    if (existing) {
      seeded.push(existing);
      continue;
    }
    try {
      const [row] = await db.insert(workers).values({
        projectId,
        name: spec.name,
        kind: "subagent",
        role: spec.role,
        capabilities: [...spec.capabilities],
        skillRefs: [],
        maxConcurrentClaims: spec.maxConcurrentClaims,
      });
      seeded.push(
        (await db.query.workers.findFirst({ where: eq(workers.id, Number(row.insertId)) }))!,
      );
    } catch {
      const raced = await db.query.workers.findFirst({
        where: and(eq(workers.projectId, projectId), eq(workers.name, spec.name)),
      });
      if (!raced) throw new Error(`failed to seed office worker ${spec.name}`);
      seeded.push(raced);
    }
  }
  return seeded;
}

/**
 * Ensure a pool worker for a node role (first-run hire-and-populate).
 * Idempotent by (project_id, name); called BEFORE the createRunGraph tx —
 * the tx itself only writes assignments/room tags (design §4.5 step 3).
 */
export async function ensureRoleWorker(
  projectId: number,
  role: string,
  skill: { name: string; version: string; sha256: string },
): Promise<Worker> {
  const db = getDb();
  const name = `role:${role}`.slice(0, 255);
  const existing = await db.query.workers.findFirst({
    where: and(eq(workers.projectId, projectId), eq(workers.name, name)),
  });
  if (existing) return existing;
  try {
    const [row] = await db.insert(workers).values({
      projectId,
      name,
      kind: "subagent",
      role,
      capabilities: ["read", "summarize", "compare", "cite", "classify", "synthesize"],
      skillRefs: [{ name: skill.name, version: skill.version, sha256: skill.sha256 }],
      maxConcurrentClaims: 1,
    });
    return (await db.query.workers.findFirst({ where: eq(workers.id, Number(row.insertId)) }))!;
  } catch {
    const raced = await db.query.workers.findFirst({
      where: and(eq(workers.projectId, projectId), eq(workers.name, name)),
    });
    if (!raced) throw new Error(`failed to seed role worker ${name}`);
    return raced;
  }
}

// ── Room usage rollups (design §4.2/§4.4) ────────────────────────

/**
 * Room usage rollup: tokens/calls/USD from budget_ledger by room_key over
 * the project's runs; minutes from the elapsed time of runs that consumed
 * in this room; storageBytes from artifact payloads attributed via
 * run_nodes.room_key (artifact summaries + hashes — the content bodies live
 * in object storage, so this is an explicit lower-bound rollup, and the
 * storage envelope is a documented SOFT cap: over-cap is a warning state,
 * never silent deletion).
 */
export async function roomUsage(
  projectId: number,
  roomKey: string,
  db: Tx | ReturnType<typeof getDb> = getDb(),
): Promise<RoomUsage> {
  const [row] = await db
    .select({
      prompt: sql<number>`COALESCE(SUM(${budgetLedger.tokensPrompt}), 0)`,
      completion: sql<number>`COALESCE(SUM(${budgetLedger.tokensCompletion}), 0)`,
      calls: sql<number>`COALESCE(SUM(${budgetLedger.calls}), 0)`,
      cost: sql<number>`COALESCE(SUM(${budgetLedger.costUsdMicros}), 0)`,
    })
    .from(budgetLedger)
    .innerJoin(runs, eq(budgetLedger.runId, runs.id))
    .where(and(eq(runs.projectId, projectId), eq(budgetLedger.roomKey, roomKey)));
  const roomRuns = await db
    .selectDistinct({ startedAt: runs.startedAt, endedAt: runs.endedAt })
    .from(budgetLedger)
    .innerJoin(runs, eq(budgetLedger.runId, runs.id))
    .where(and(eq(runs.projectId, projectId), eq(budgetLedger.roomKey, roomKey)));
  const nowMs = Date.now();
  const minutes = roomRuns.reduce(
    (acc, r) =>
      acc + (((r.endedAt ?? new Date(nowMs)).getTime() - r.startedAt.getTime()) / 60_000),
    0,
  );
  const [storage] = await db
    .select({
      bytes: sql<number>`COALESCE(SUM(OCTET_LENGTH(COALESCE(${artifacts.summary}, '')) + OCTET_LENGTH(COALESCE(${artifacts.contentSha256}, ''))), 0)`,
    })
    .from(artifacts)
    .innerJoin(
      runNodes,
      and(eq(artifacts.runId, runNodes.runId), eq(artifacts.nodeKey, runNodes.nodeKey)),
    )
    .innerJoin(runs, eq(artifacts.runId, runs.id))
    .where(and(eq(runs.projectId, projectId), eq(runNodes.roomKey, roomKey)));
  return {
    tokens: Number(row?.prompt ?? 0) + Number(row?.completion ?? 0),
    calls: Number(row?.calls ?? 0),
    minutes,
    costUsdMicros: Number(row?.cost ?? 0),
    storageBytes: Number(storage?.bytes ?? 0),
  };
}

/** Active seat count for a room (permanent system seats count too). */
export async function roomOccupancy(roomId: number): Promise<number> {
  const db = getDb();
  const [row] = await db
    .select({ n: sql<number>`COUNT(*)` })
    .from(officeAssignments)
    .where(and(eq(officeAssignments.roomId, roomId), eq(officeAssignments.state, "active")));
  return Number(row?.n ?? 0);
}

/** Map an office_rooms row to the contract RoomSpec shape. */
export function toRoomSpec(room: OfficeRoom) {
  return {
    key: room.roomKey,
    name: room.name,
    kind: room.kind,
    capacity: room.capacity,
    eligibleRolePatterns: room.eligibleRolePatterns,
    budgets: room.budgets,
  };
}

/** Active claims a worker holds across the project's runs (drain input). */
export async function workerActiveClaims(workerId: number): Promise<number> {
  const db = getDb();
  const [row] = await db
    .select({ n: sql<number>`COUNT(*)` })
    .from(runNodes)
    .where(
      and(
        eq(runNodes.leaseWorkerId, workerId),
        inArray(runNodes.state, ["claimed", "running"]),
      ),
    );
  return Number(row?.n ?? 0);
}

/**
 * Drain completion (design §2.3 reassignment "drain" effect): workers with a
 * pending room transfer and zero active claims are moved in one guarded
 * transition — old seat released, new seat inserted, worker row updated
 * under its OCC version, one audited event. Runs on the boot sweep, never
 * on a timer mid-claim; a concurrent new claim simply defers the transfer
 * to the next pass.
 */
export async function sweepDrainingAssignments(opts: { limit?: number } = {}): Promise<number> {
  const db = getDb();
  const draining = await db
    .select()
    .from(workers)
    .where(sql`${workers.pendingRoomKey} IS NOT NULL`)
    .limit(Math.min(opts.limit ?? 25, 100));
  let completed = 0;
  for (const worker of draining) {
    const claims = await workerActiveClaims(worker.id);
    if (claims > 0) continue; // still draining — transfer on last completion
    const toRoomKey = worker.pendingRoomKey!;
    const blueprint = await db.query.officeBlueprints.findFirst({
      where: and(eq(officeBlueprints.projectId, worker.projectId), eq(officeBlueprints.status, "active")),
    });
    const room = blueprint
      ? await db.query.officeRooms.findFirst({
          where: and(
            eq(officeRooms.blueprintId, blueprint.id),
            eq(officeRooms.roomKey, toRoomKey),
          ),
        })
      : undefined;
    const done = await db.transaction(async (tx) => {
      // Capacity re-check on the target room BEFORE moving (same rule as
      // office.assign): lock the room row and re-count; a full room defers
      // the transfer — the worker stays pending and stops new claims until
      // capacity frees.
      if (room) {
        await tx
          .select({ id: officeRooms.id })
          .from(officeRooms)
          .where(eq(officeRooms.id, room.id))
          .for("update");
        const [occ] = await tx
          .select({ n: sql<number>`COUNT(*)` })
          .from(officeAssignments)
          .where(and(eq(officeAssignments.roomId, room.id), eq(officeAssignments.state, "active")));
        if (Number(occ?.n ?? 0) >= room.capacity) return false; // deferred
      }
      // OCC guard on the worker row is the arbiter: a concurrent reassign
      // bumps the version and this pass loses cleanly.
      const [res] = await tx
        .update(workers)
        .set({
          roomKey: room ? toRoomKey : worker.roomKey,
          pendingRoomKey: null,
          version: sql`${workers.version} + 1`,
        })
        .where(and(eq(workers.id, worker.id), eq(workers.version, worker.version)));
      if (res.affectedRows !== 1) return false;
      const oldSeat = await tx.query.officeAssignments.findFirst({
        where: and(eq(officeAssignments.workerId, worker.id), eq(officeAssignments.state, "active")),
      });
      if (oldSeat) {
        await tx
          .update(officeAssignments)
          .set({ state: "released", releasedAt: new Date(), version: sql`${officeAssignments.version} + 1` })
          .where(and(eq(officeAssignments.id, oldSeat.id), eq(officeAssignments.state, "active")));
      }
      if (room) {
        await tx.insert(officeAssignments).values({
          projectId: worker.projectId,
          roomId: room.id,
          workerId: worker.id,
        });
      }
      await appendOfficeEventTx(tx, worker.projectId, {
        type: "office_agent_reassigned",
        actor: "system",
        payload: {
          agentId: worker.id,
          agentName: worker.name,
          fromRoomKey: worker.roomKey ?? null,
          toRoomKey: room ? toRoomKey : null,
          effect: room ? "drain-complete" : "drain-aborted-room-missing",
        },
      });
      return true;
    });
    if (done) completed += 1;
  }
  return completed;
}
