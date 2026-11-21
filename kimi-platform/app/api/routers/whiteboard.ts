import { randomUUID } from "node:crypto";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { createRouter, authedQuery } from "../middleware";
import { getDb } from "../queries/connection";
import {
  artifacts,
  exportsTable,
  runNodes,
  runs,
  whiteboardEdges,
  whiteboardNodes,
  whiteboardNotes,
  whiteboardRevisions,
  whiteboards,
  type Whiteboard,
} from "@db/schema";
import { NodeKeySchema } from "@contracts/dag";
import {
  WB_EDIT_LEASE_TTL_SECONDS,
  WB_MAX_OPS_PER_BATCH,
  WbExportFormatSchema,
  WhiteboardOpSchema,
  type WbEdge,
  type WbNode,
  type WbNote,
} from "@contracts/office";
import {
  applyWhiteboardOps,
  detectWhiteboardDrift,
  exportWhiteboard,
  type RefResolution,
  type WbBoard,
} from "../office/whiteboard";
import { storage } from "../lib/storage";
import { mustOwnProject } from "./planning";

/**
 * Whiteboard router (design §5): versioned, owner-scoped, data-only boards.
 * applyOps is one transaction — read, pure decision, OCC-guarded version
 * bump (the arbiter), content rewrite, append-only notes, immutable
 * revision snapshot. References must exist AND belong to the same project
 * (cross-project ⇒ forbidden). No executable content exists anywhere in
 * this pipeline: node kinds are a closed enum, content is capped text the
 * server never evaluates, exports are inert JSON/markdown.
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

/** Load the board row + content rows as the pure WbBoard view. */
async function loadWbBoard(dbOrTx: Tx | Db, row: Whiteboard): Promise<WbBoard> {
  const nodes = await dbOrTx
    .select()
    .from(whiteboardNodes)
    .where(eq(whiteboardNodes.whiteboardId, row.id))
    .orderBy(asc(whiteboardNodes.id));
  const edges = await dbOrTx
    .select()
    .from(whiteboardEdges)
    .where(eq(whiteboardEdges.whiteboardId, row.id))
    .orderBy(asc(whiteboardEdges.id));
  const notes = await dbOrTx
    .select()
    .from(whiteboardNotes)
    .where(eq(whiteboardNotes.whiteboardId, row.id))
    .orderBy(asc(whiteboardNotes.id));
  return {
    id: row.id,
    projectId: row.projectId,
    title: row.title,
    revision: row.revision,
    version: row.version,
    status: row.status,
    nodes: nodes.map(
      (n): WbNode => ({
        nodeKey: n.nodeKey,
        kind: n.kind as WbNode["kind"],
        content: n.content,
        position: n.position,
        refRunId: n.refRunId ?? null,
        refNodeKey: n.refNodeKey ?? null,
        refArtifactId: n.refArtifactId ?? null,
      }),
    ),
    edges: edges.map(
      (e): WbEdge => ({
        edgeKey: e.edgeKey,
        fromKey: e.fromKey,
        toKey: e.toKey,
        kind: e.kind as WbEdge["kind"],
      }),
    ),
    notes: notes.map(
      (n): WbNote => ({
        nodeKey: n.nodeKey ?? null,
        body: n.body,
        author: n.author as WbNote["author"],
        authorRef: n.authorRef,
      }),
    ),
    editLease:
      row.editLeaseToken && row.editLeaseHolder && row.editLeaseExpiresAt
        ? {
            token: row.editLeaseToken,
            holder: row.editLeaseHolder,
            expiresAtMs: row.editLeaseExpiresAt.getTime(),
          }
        : null,
  };
}

async function mustOwnBoard(userId: number, boardId: number) {
  const db = getDb();
  const row = await db.query.whiteboards.findFirst({ where: eq(whiteboards.id, boardId) });
  if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "whiteboard not found" });
  // Cross-owner access is indistinguishable from missing (no existence leak).
  await mustOwnProject(userId, row.projectId);
  return row;
}

/** Sync RefResolver over a pre-fetched cache (the pure layer is DB-free). */
function makeRefResolver(cache: Map<string, RefResolution>) {
  return (ref: { runId: number; nodeKey: string } | { artifactId: number }): RefResolution => {
    const key = "runId" in ref ? `rn:${ref.runId}:${ref.nodeKey}` : `a:${ref.artifactId}`;
    return cache.get(key) ?? { exists: false, projectId: null };
  };
}

async function prefetchRefs(
  tx: Tx,
  board: WbBoard,
  ops: Array<z.infer<typeof WhiteboardOpSchema>>,
): Promise<Map<string, RefResolution>> {
  const cache = new Map<string, RefResolution>();
  const runNodeRefs = new Set<string>();
  const artifactRefs = new Set<number>();
  const collect = (n: Partial<WbNode>) => {
    if (n.refRunId != null && n.refNodeKey) runNodeRefs.add(`${n.refRunId}:${n.refNodeKey}`);
    if (n.refArtifactId != null) artifactRefs.add(n.refArtifactId);
  };
  for (const n of board.nodes) collect(n);
  for (const op of ops) {
    if (op.op === "addNode") collect(op.node);
    if (op.op === "updateNode") collect(op.patch);
  }
  for (const key of runNodeRefs) {
    const [runIdStr, nodeKey] = key.split(":");
    const runId = Number(runIdStr);
    const node = await tx.query.runNodes.findFirst({
      where: and(eq(runNodes.runId, runId), eq(runNodes.nodeKey, nodeKey!)),
    });
    if (!node) {
      cache.set(`rn:${key}`, { exists: false, projectId: null });
    } else {
      const run = await tx.query.runs.findFirst({ where: eq(runs.id, runId) });
      cache.set(`rn:${key}`, { exists: true, projectId: run?.projectId ?? null });
    }
  }
  for (const artifactId of artifactRefs) {
    const artifact = await tx.query.artifacts.findFirst({
      where: eq(artifacts.id, artifactId),
    });
    if (!artifact) {
      cache.set(`a:${artifactId}`, { exists: false, projectId: null });
    } else {
      const run = await tx.query.runs.findFirst({ where: eq(runs.id, artifact.runId) });
      cache.set(`a:${artifactId}`, { exists: true, projectId: run?.projectId ?? null });
    }
  }
  return cache;
}

export const whiteboardRouter = createRouter({
  /** Create a board (+ immutable revision-1 empty snapshot). */
  create: authedQuery
    .input(
      z.object({
        projectId: z.number().int().positive(),
        title: z.string().min(1).max(500),
        ownerRef: z
          .object({ runId: z.number().int().positive(), nodeKey: NodeKeySchema })
          .optional(),
        idempotencyKey: idempotencyKeyInput,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await mustOwnProject(ctx.user.id, input.projectId);
      return withIdempotency(ctx.user.id, "whiteboard.create", input.idempotencyKey, async () => {
        const db = getDb();
        if (input.ownerRef) {
          const node = await db.query.runNodes.findFirst({
            where: and(
              eq(runNodes.runId, input.ownerRef.runId),
              eq(runNodes.nodeKey, input.ownerRef.nodeKey),
            ),
          });
          const run = await db.query.runs.findFirst({ where: eq(runs.id, input.ownerRef.runId) });
          if (!node || !run || run.projectId !== input.projectId) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "ownerRef must name a run node of this project",
            });
          }
        }
        return db.transaction(async (tx) => {
          const [row] = await tx.insert(whiteboards).values({
            projectId: input.projectId,
            title: input.title,
            ownerRunId: input.ownerRef?.runId ?? null,
            ownerNodeKey: input.ownerRef?.nodeKey ?? null,
            createdBy: ctx.user.id,
          });
          const id = Number(row.insertId);
          await tx.insert(whiteboardRevisions).values({
            whiteboardId: id,
            revision: 1,
            doc: { nodes: [], edges: [] },
            createdBy: ctx.user.id,
          });
          return { id, revision: 1, version: 1 };
        });
      });
    }),

  list: authedQuery
    .input(z.object({ projectId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      await mustOwnProject(ctx.user.id, input.projectId);
      const db = getDb();
      return db
        .select({
          id: whiteboards.id,
          title: whiteboards.title,
          revision: whiteboards.revision,
          version: whiteboards.version,
          status: whiteboards.status,
          ownerRunId: whiteboards.ownerRunId,
          ownerNodeKey: whiteboards.ownerNodeKey,
          updatedAt: whiteboards.updatedAt,
        })
        .from(whiteboards)
        .where(eq(whiteboards.projectId, input.projectId))
        .orderBy(desc(whiteboards.updatedAt))
        .limit(100);
    }),

  /**
   * Board + drift report. Drift is derived truth (the live run graph)
   * vs owner intent (the refs); it is REPORTED, never auto-corrected.
   * The edit-lease TOKEN is never returned — only holder/expiry.
   */
  get: authedQuery
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const row = await mustOwnBoard(ctx.user.id, input.id);
      const db = getDb();
      const board = await loadWbBoard(db, row);
      // Live state for drift: this project's run nodes + artifacts.
      // Deterministic and complete w.r.t. the board: recent project runs
      // (stable id order, bounded) UNION every run the board references —
      // a referenced run is never dropped by the recency bound.
      const refRunIds = [
        ...new Set(
          board.nodes.filter((n) => n.refRunId !== null).map((n) => n.refRunId!),
        ),
      ];
      const recentRuns = await db
        .select({ id: runs.id })
        .from(runs)
        .where(eq(runs.projectId, row.projectId))
        .orderBy(desc(runs.id))
        .limit(100);
      const referencedRows = refRunIds.length
        ? await db.select({ id: runs.id }).from(runs).where(inArray(runs.id, refRunIds))
        : [];
      const runIds = [
        ...new Set([...recentRuns.map((r) => r.id), ...referencedRows.map((r) => r.id)]),
      ].sort((a, b) => a - b);
      const runNodeIds = new Set<string>();
      const artifactIds = new Set<number>();
      if (runIds.length) {
        const nodes = await db
          .select({ runId: runNodes.runId, nodeKey: runNodes.nodeKey })
          .from(runNodes)
          .where(inArray(runNodes.runId, runIds))
          .limit(2000);
        for (const n of nodes) runNodeIds.add(`${n.runId}:${n.nodeKey}`);
        const arts = await db
          .select({ id: artifacts.id })
          .from(artifacts)
          .where(inArray(artifacts.runId, runIds))
          .limit(2000);
        for (const a of arts) artifactIds.add(a.id);
      }
      const drift = detectWhiteboardDrift(board, { runNodeIds, artifactIds });
      const { editLease, ...rest } = board;
      return {
        ...rest,
        ownerRunId: row.ownerRunId,
        ownerNodeKey: row.ownerNodeKey,
        editLease: editLease
          ? { holder: editLease.holder, expiresAtMs: editLease.expiresAtMs }
          : null,
        drift,
      };
    }),

  /**
   * Acquire (or take over) the single-writer edit lease. Take-over
   * force-expires the prior holder: their next applyOps is fenced and
   * loses cleanly. Returns the fresh token — the ONLY place it is exposed.
   */
  acquireLease: authedQuery
    .input(
      z.object({
        id: z.number().int().positive(),
        idempotencyKey: idempotencyKeyInput,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const row = await mustOwnBoard(ctx.user.id, input.id);
      if (row.status !== "active") {
        throw new TRPCError({ code: "CONFLICT", message: "whiteboard is archived" });
      }
      // The raw edit token is NEVER persisted into idempotency_keys: the
      // stored replay response carries lease metadata with token=null, so a
      // replayed key cannot resurrect a credential — the caller re-acquires.
      const db = getDb();
      if (input.idempotencyKey) {
        const { idempotencyKeys } = await import("@db/schema");
        const existing = await db.query.idempotencyKeys.findFirst({
          where: and(
            eq(idempotencyKeys.ownerId, ctx.user.id),
            eq(idempotencyKeys.scope, "whiteboard.acquireLease"),
            eq(idempotencyKeys.key, input.idempotencyKey),
          ),
        });
        if (existing) return existing.response as never;
      }
      const token = randomUUID();
      const expiresAt = new Date(Date.now() + WB_EDIT_LEASE_TTL_SECONDS * 1000);
      // The version bump is the OCC arbiter for take-over: any applyOps
      // that read the board BEFORE this acquisition now fails its version
      // guard, so a take-over always fences an in-flight write.
      await db
        .update(whiteboards)
        .set({
          editLeaseToken: token,
          editLeaseHolder: ctx.user.name ?? "owner",
          editLeaseExpiresAt: expiresAt,
          version: sql`${whiteboards.version} + 1`,
        })
        .where(eq(whiteboards.id, input.id));
      const fresh = await db.query.whiteboards.findFirst({
        where: eq(whiteboards.id, input.id),
      });
      const result = {
        token,
        holder: ctx.user.name ?? "owner",
        expiresAtMs: expiresAt.getTime(),
        ttlSeconds: WB_EDIT_LEASE_TTL_SECONDS,
        version: fresh?.version ?? row.version + 1,
        reacquireRequired: false,
      };
      if (input.idempotencyKey) {
        const { idempotencyKeys } = await import("@db/schema");
        try {
          // Replay response: token redacted AND explicitly marked — a caller
          // MUST treat this as "re-acquire required", never as a usable lease.
          await db.insert(idempotencyKeys).values({
            ownerId: ctx.user.id,
            scope: "whiteboard.acquireLease",
            key: input.idempotencyKey,
            response: {
              ...result,
              token: null,
              redacted: true,
              reacquireRequired: true,
            },
          });
        } catch {
          const raced = await db.query.idempotencyKeys.findFirst({
            where: and(
              eq(idempotencyKeys.ownerId, ctx.user.id),
              eq(idempotencyKeys.scope, "whiteboard.acquireLease"),
              eq(idempotencyKeys.key, input.idempotencyKey),
            ),
          });
          if (raced) return raced.response as never;
        }
      }
      return result;
    }),

  /**
   * Apply an op-batch (design §5.2). One transaction: the OCC-guarded
   * version bump commits FIRST (the arbiter), then content/notes/revision
   * writes follow — a losing writer rolls back with CONFLICT and nothing
   * half-applies.
   */
  applyOps: authedQuery
    .input(
      z.object({
        id: z.number().int().positive(),
        expectedVersion: z.number().int().min(1),
        ops: z.array(WhiteboardOpSchema).min(1).max(WB_MAX_OPS_PER_BATCH),
        editToken: z.string().max(64).optional(),
        idempotencyKey: idempotencyKeyInput,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await mustOwnBoard(ctx.user.id, input.id);
      return withIdempotency(ctx.user.id, "whiteboard.applyOps", input.idempotencyKey, async () => {
        const db = getDb();
        return db.transaction(async (tx) => {
          const fresh = await tx.query.whiteboards.findFirst({
            where: eq(whiteboards.id, input.id),
          });
          if (!fresh) throw new TRPCError({ code: "NOT_FOUND", message: "whiteboard not found" });
          const board = await loadWbBoard(tx, fresh);
          const refCache = await prefetchRefs(tx, board, input.ops);
          const result = applyWhiteboardOps({
            board,
            ops: input.ops,
            expectedVersion: input.expectedVersion,
            editToken: input.editToken ?? null,
            nowMs: Date.now(),
            resolveRef: makeRefResolver(refCache),
          });
          if (!result.ok) {
            const err = result.error;
            if (err.error === "version_conflict") {
              throw new TRPCError({
                code: "CONFLICT",
                message: `whiteboard version conflict (current ${err.currentVersion})`,
              });
            }
            if (err.error === "archived") {
              throw new TRPCError({ code: "CONFLICT", message: "whiteboard is archived" });
            }
            if (err.error === "lease_required") {
              throw new TRPCError({
                code: "PRECONDITION_FAILED",
                message: "an edit lease is required — call whiteboard.acquireLease first",
              });
            }
            if (err.error === "locked") {
              throw new TRPCError({
                code: "CONFLICT",
                message: `whiteboard is locked by ${err.holder} until ${new Date(err.expiresAtMs).toISOString()}`,
              });
            }
            if (err.error === "fenced") {
              throw new TRPCError({
                code: "CONFLICT",
                message: `edit lease was taken over by ${err.holder}; your write is fenced — re-acquire the lease`,
              });
            }
            if (err.error === "forbidden") {
              throw new TRPCError({ code: "FORBIDDEN", message: err.message });
            }
            throw new TRPCError({
              code: err.error === "conflict" ? "CONFLICT" : "BAD_REQUEST",
              message: err.message,
            });
          }
          // OCC arbiter: the guarded board update commits before any
          // content write; affectedRows=0 ⇒ a concurrent writer won.
          const [res] = await tx
            .update(whiteboards)
            .set({
              version: sql`${whiteboards.version} + 1`,
              revision: sql`${whiteboards.revision} + 1`,
              updatedAt: new Date(),
            })
            .where(
              and(
                eq(whiteboards.id, input.id),
                eq(whiteboards.version, input.expectedVersion),
                eq(whiteboards.status, "active"),
              ),
            );
          if (res.affectedRows !== 1) {
            throw new TRPCError({ code: "CONFLICT", message: "whiteboard version conflict" });
          }
          // Content rewrite (nodes/edges) + append-only notes + snapshot.
          await tx.delete(whiteboardNodes).where(eq(whiteboardNodes.whiteboardId, input.id));
          if (result.board.nodes.length) {
            await tx.insert(whiteboardNodes).values(
              result.board.nodes.map((n) => ({
                whiteboardId: input.id,
                nodeKey: n.nodeKey,
                kind: n.kind,
                content: n.content,
                position: n.position,
                refRunId: n.refRunId ?? null,
                refNodeKey: n.refNodeKey ?? null,
                refArtifactId: n.refArtifactId ?? null,
              })),
            );
          }
          await tx.delete(whiteboardEdges).where(eq(whiteboardEdges.whiteboardId, input.id));
          if (result.board.edges.length) {
            await tx.insert(whiteboardEdges).values(
              result.board.edges.map((e) => ({
                whiteboardId: input.id,
                edgeKey: e.edgeKey,
                fromKey: e.fromKey,
                toKey: e.toKey,
                kind: e.kind,
              })),
            );
          }
          const newNotes = result.board.notes.slice(board.notes.length);
          if (newNotes.length) {
            await tx.insert(whiteboardNotes).values(
              newNotes.map((n) => ({
                whiteboardId: input.id,
                nodeKey: n.nodeKey ?? null,
                body: n.body,
                author: n.author,
                authorRef: n.authorRef,
              })),
            );
          }
          await tx.insert(whiteboardRevisions).values({
            whiteboardId: input.id,
            revision: result.snapshot.revision,
            doc: result.snapshot.doc,
            createdBy: ctx.user.id,
          });
          return {
            ok: true as const,
            version: result.board.version,
            revision: result.board.revision,
            nodes: result.board.nodes.length,
            edges: result.board.edges.length,
            notes: result.board.notes.length,
          };
        });
      });
    }),

  /** Immutable snapshot list (revision, createdAt, createdBy). */
  revisions: authedQuery
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      await mustOwnBoard(ctx.user.id, input.id);
      const db = getDb();
      return db
        .select({
          revision: whiteboardRevisions.revision,
          createdBy: whiteboardRevisions.createdBy,
          createdAt: whiteboardRevisions.createdAt,
        })
        .from(whiteboardRevisions)
        .where(eq(whiteboardRevisions.whiteboardId, input.id))
        .orderBy(desc(whiteboardRevisions.revision))
        .limit(200);
    }),

  /**
   * Server-rendered export (design §5.3): stored artifact + exports row,
   * honest failure — a storage error records the row with storageError and
   * throws PRECONDITION_FAILED; nothing is ever faked.
   */
  export: authedQuery
    .input(
      z.object({
        id: z.number().int().positive(),
        format: WbExportFormatSchema,
        idempotencyKey: idempotencyKeyInput,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const row = await mustOwnBoard(ctx.user.id, input.id);
      return withIdempotency(ctx.user.id, "whiteboard.export", input.idempotencyKey, async () => {
        const db = getDb();
        const board = await loadWbBoard(db, row);
        const rendered = exportWhiteboard(board, input.format);
        try {
          const saved = await storage.uploadFile({
            fileContent: Buffer.from(rendered.body, "utf8"),
            fileName: `exports/${row.projectId}/whiteboard-${row.id}-r${row.revision}.${input.format === "json" ? "json" : "md"}`,
            contentType: input.format === "json" ? "application/json" : "text/markdown",
          });
          const [inserted] = await db.insert(exportsTable).values({
            projectId: row.projectId,
            runId: null,
            format: input.format,
            storageKey: saved.key,
            createdBy: ctx.user.id,
          });
          return { exportId: Number(inserted.insertId), storageKey: saved.key, storageError: null };
        } catch (err) {
          const code = (err as { code?: string })?.code ?? "STORAGE_UPSTREAM_ERROR";
          await db.insert(exportsTable).values({
            projectId: row.projectId,
            runId: null,
            format: input.format,
            storageKey: null,
            storageError: code,
            createdBy: ctx.user.id,
          });
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: `whiteboard export failed: storage error ${code}. The failure is recorded; nothing was faked.`,
          });
        }
      });
    }),

  /** Archive (guarded status flip; archived boards reject applyOps). */
  archive: authedQuery
    .input(
      z.object({
        id: z.number().int().positive(),
        idempotencyKey: idempotencyKeyInput,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await mustOwnBoard(ctx.user.id, input.id);
      return withIdempotency(ctx.user.id, "whiteboard.archive", input.idempotencyKey, async () => {
        const db = getDb();
        const [res] = await db
          .update(whiteboards)
          .set({ status: "archived", updatedAt: new Date() })
          .where(and(eq(whiteboards.id, input.id), eq(whiteboards.status, "active")));
        if (res.affectedRows !== 1) {
          throw new TRPCError({ code: "CONFLICT", message: "whiteboard is already archived" });
        }
        return { archived: true };
      });
    }),
});
