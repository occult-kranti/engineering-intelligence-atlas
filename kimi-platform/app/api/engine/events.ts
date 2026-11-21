import { desc, eq, sql } from "drizzle-orm";
import { getDb } from "../queries/connection";
import { runEvents, runs, type RunEvent } from "@db/schema";
import type { EventActor, EventType } from "@contracts/run";

/**
 * Append-only event writer (spec §3.2 invariant 1, §11.1).
 * There is intentionally no update/delete path for run_events anywhere in the
 * codebase. Sequence allocation is transactional with the insert: the run row
 * is locked FOR UPDATE, the next seq is computed, and the event is inserted
 * under the (run_id, seq) unique constraint.
 */
export interface EventFields {
  type: EventType;
  actor: EventActor;
  nodeKey?: string | null;
  payload: Record<string, unknown>;
}

type Tx = Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0];

/**
 * Transactional variant: appends inside an existing transaction so a state
 * transition and its audit event commit atomically (spec §4 invariant 2).
 */
export async function appendEventTx(
  tx: Tx,
  runId: number,
  fields: EventFields,
): Promise<{ seq: number }> {
  await tx
    .select({ id: runs.id })
    .from(runs)
    .where(eq(runs.id, runId))
    .for("update");
  // Current read (FOR UPDATE), not a snapshot read: under REPEATABLE READ a
  // plain aggregate would miss rows a concurrent writer committed after
  // this transaction began — its insert would then collide on
  // (run_id, seq). After the run-row lock above serializes writers, this
  // locking read must see the newest committed seq.
  const [row] = await tx
    .select({ maxSeq: runEvents.seq })
    .from(runEvents)
    .where(eq(runEvents.runId, runId))
    .orderBy(desc(runEvents.seq))
    .limit(1)
    .for("update");
  const seq = Number(row?.maxSeq ?? 0) + 1;
  await tx.insert(runEvents).values({
    runId,
    seq,
    nodeKey: fields.nodeKey ?? null,
    type: fields.type,
    actor: fields.actor,
    payload: fields.payload,
  });
  return { seq };
}

export async function appendEvent(
  runId: number,
  fields: EventFields,
): Promise<{ seq: number }> {
  const db = getDb();
  return db.transaction(async (tx) => appendEventTx(tx, runId, fields));
}

export async function listEvents(
  runId: number,
  afterSeq: number,
  limit = 200,
): Promise<RunEvent[]> {
  const db = getDb();
  return db
    .select()
    .from(runEvents)
    .where(sql`${runEvents.runId} = ${runId} AND ${runEvents.seq} > ${afterSeq}`)
    .orderBy(runEvents.seq)
    .limit(Math.min(limit, 500));
}
