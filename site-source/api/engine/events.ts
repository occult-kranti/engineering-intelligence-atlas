import { eq, sql } from "drizzle-orm";
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
export async function appendEvent(
  runId: number,
  fields: {
    type: EventType;
    actor: EventActor;
    nodeKey?: string | null;
    payload: Record<string, unknown>;
  },
): Promise<{ seq: number }> {
  const db = getDb();
  return db.transaction(async (tx) => {
    await tx
      .select({ id: runs.id })
      .from(runs)
      .where(eq(runs.id, runId))
      .for("update");
    const [row] = await tx
      .select({
        maxSeq: sql<number>`COALESCE(MAX(${runEvents.seq}), 0)`,
      })
      .from(runEvents)
      .where(eq(runEvents.runId, runId));
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
  });
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
