import { useCallback, useMemo, useState } from "react";
import { trpc } from "@/lib/trpc-client";
import type { WbExportFormat as ServerExportFormat } from "@contracts/office";
import {
  live,
  newIdempotencyKey,
  unavailable,
  type Availability,
} from "../workspace/adapter";
import { useNow } from "../workspace/useNow";
import { rebaseWhiteboard } from "./derive";
import {
  classifyWbSaveError,
  mapServerDrift,
  wbDocFromBackend,
  wbOpsFromDiff,
  type BackendWbDoc,
  type BackendWbEdge,
  type BackendWbNode,
} from "./officeAdapter";
import type {
  DriftItem,
  EditLeaseInfo,
  WbRevisionMeta,
  WbSaveResult,
  WhiteboardDoc,
} from "./model";
import type { WbExportPayload } from "./ExportMenu";

export interface ServerExportResult {
  ok: boolean;
  message: string;
  storageKey?: string;
}

/**
 * Whiteboard data hook — the impure seam over the whiteboard router. The
 * board document comes only from whiteboard.get; saves are applyOps diffs
 * with the OCC expectedVersion and the edit-lease token; conflicts surface
 * as version_conflict/fenced for the three-option dialog; rebases fetch the
 * latest board and merge deterministically (rebaseWhiteboard). Export is
 * the server-rendered path (stored artifact row or an honest storage
 * error); client-side SVG/JSON downloads are byte-exact local renders.
 * Nothing is persisted locally-as-if-remote.
 */
export function useWhiteboardData(
  projectId: number,
  ctx: { planHash: string | null; userName: string },
) {
  const listQ = trpc.whiteboard.list.useQuery({ projectId }, { retry: false });
  const [chosenId, setChosenId] = useState<number | null>(null);
  const boardId = useMemo(() => {
    const boards = listQ.data ?? [];
    if (chosenId != null && boards.some((b) => b.id === chosenId)) return chosenId;
    return boards.find((b) => b.status === "active")?.id ?? boards[0]?.id ?? null;
  }, [listQ.data, chosenId]);

  const getQ = trpc.whiteboard.get.useQuery(
    { id: boardId ?? 0 },
    { enabled: boardId != null, refetchInterval: 5000, retry: false },
  );
  const revisionsQ = trpc.whiteboard.revisions.useQuery(
    { id: boardId ?? 0 },
    { enabled: boardId != null, refetchInterval: 10000, retry: false },
  );
  const utils = trpc.useUtils();
  const now = useNow(1000);

  const createM = trpc.whiteboard.create.useMutation();
  const acquireM = trpc.whiteboard.acquireLease.useMutation();
  const applyM = trpc.whiteboard.applyOps.useMutation();
  const exportM = trpc.whiteboard.export.useMutation();

  /** The edit-lease token — memory only; the server is the only other holder. */
  const [editToken, setEditToken] = useState<string | null>(null);

  const refresh = useCallback(() => {
    void getQ.refetch();
    void revisionsQ.refetch();
    void utils.whiteboard.list.invalidate();
  }, [getQ, revisionsQ, utils]);

  const baseline: BackendWbDoc | null = useMemo(() => {
    if (!getQ.data) return null;
    return {
      nodes: getQ.data.nodes as unknown as BackendWbNode[],
      edges: getQ.data.edges as unknown as BackendWbEdge[],
    };
  }, [getQ.data]);

  const doc: Availability<WhiteboardDoc> = useMemo(() => {
    if (listQ.error) return unavailable(`whiteboard list unavailable: ${listQ.error.message}`);
    if (!listQ.data) return unavailable("whiteboard list loading");
    if (boardId == null) {
      return unavailable("no whiteboard yet — create one below (server-side, revision 1)");
    }
    if (getQ.error) return unavailable(`whiteboard unavailable: ${getQ.error.message}`);
    if (!getQ.data) return unavailable("whiteboard loading");
    return live(
      wbDocFromBackend(getQ.data, {
        planHash: ctx.planHash,
        updatedBy: getQ.data.editLease?.holder ?? "—",
      }),
    );
  }, [listQ.data, listQ.error, boardId, getQ.data, getQ.error, ctx.planHash]);

  const drift: DriftItem[] = useMemo(
    () => (getQ.data ? mapServerDrift(getQ.data.drift) : []),
    [getQ.data],
  );

  const lease: Availability<EditLeaseInfo> = useMemo(() => {
    if (boardId == null) return unavailable("no whiteboard");
    if (getQ.error) return unavailable(getQ.error.message);
    if (!getQ.data) return unavailable("loading");
    const l = getQ.data.editLease;
    if (!l) return live({ holder: "no active lease", expiresInSec: 0, heldByYou: false });
    const expiresInSec = Math.round((l.expiresAtMs - now) / 1000);
    return live({
      holder: l.holder,
      expiresInSec,
      heldByYou: editToken != null && l.holder === ctx.userName && expiresInSec > 0,
    });
  }, [boardId, getQ.data, getQ.error, editToken, ctx.userName, now]);

  const revisions: Availability<WbRevisionMeta[]> = useMemo(() => {
    if (boardId == null) return unavailable("no whiteboard");
    if (revisionsQ.error) return unavailable(revisionsQ.error.message);
    if (!revisionsQ.data) return unavailable("loading");
    return live(
      revisionsQ.data.map((r) => ({
        revision: r.revision,
        createdAt: new Date(r.createdAt).toISOString(),
        author: `user #${r.createdBy}`,
        note: "",
      })),
    );
  }, [boardId, revisionsQ.data, revisionsQ.error]);

  const create = useCallback(async (): Promise<{ ok: boolean; message?: string }> => {
    try {
      const res = await createM.mutateAsync({
        projectId,
        title: "Ownership whiteboard",
        idempotencyKey: newIdempotencyKey("whiteboard.create"),
      });
      setChosenId(res.id);
      refresh();
      return { ok: true };
    } catch (e) {
      return { ok: false, message: (e as { message?: string })?.message ?? String(e) };
    }
  }, [createM, projectId, refresh]);

  const acquireLease = useCallback(async (): Promise<void> => {
    if (boardId == null) return;
    try {
      const res = await acquireM.mutateAsync({
        id: boardId,
        idempotencyKey: newIdempotencyKey("whiteboard.acquireLease"),
      });
      setEditToken(res.token);
    } finally {
      void getQ.refetch();
    }
  }, [acquireM, boardId, getQ]);

  const saveOps = useCallback(
    async (targetDoc: WhiteboardDoc, base: BackendWbDoc, expectedVersion: number): Promise<WbSaveResult> => {
      if (boardId == null) {
        return { ok: false, cause: "unavailable", message: "no whiteboard loaded" };
      }
      const diff = wbOpsFromDiff(base, targetDoc);
      if (!diff.ok) return { ok: false, cause: "unavailable", message: diff.message };
      if (!diff.ops.length) {
        return { ok: true, version: expectedVersion, revision: targetDoc.revision };
      }
      try {
        const res = await applyM.mutateAsync({
          id: boardId,
          expectedVersion,
          ops: diff.ops,
          editToken: editToken ?? undefined,
          idempotencyKey: newIdempotencyKey("whiteboard.applyOps"),
        });
        refresh();
        return { ok: true, version: res.version, revision: res.revision };
      } catch (e) {
        void getQ.refetch(); // conflicts mean the view is stale
        const c = classifyWbSaveError(e);
        return { ok: false, cause: c.cause, message: c.message };
      }
    },
    [applyM, boardId, editToken, getQ, refresh],
  );

  const onSave = useCallback(
    async (targetDoc: WhiteboardDoc, expectedVersion: number): Promise<WbSaveResult> => {
      if (!baseline) return { ok: false, cause: "unavailable", message: "board not loaded" };
      return saveOps(targetDoc, baseline, expectedVersion);
    },
    [baseline, saveOps],
  );

  /**
   * 409 path: refetch the latest board, rebase the local draft onto it
   * (deterministic — bindings keyed by dagNodeKey), save as the new head.
   */
  const onSaveAsNewRevision = useCallback(
    async (mine: WhiteboardDoc): Promise<WbSaveResult> => {
      const fresh = await getQ.refetch();
      if (!fresh.data) {
        return { ok: false, cause: "unavailable", message: "could not load the latest board" };
      }
      const latestBase: BackendWbDoc = {
        nodes: fresh.data.nodes as unknown as BackendWbNode[],
        edges: fresh.data.edges as unknown as BackendWbEdge[],
      };
      const latestDoc = wbDocFromBackend(fresh.data, {
        planHash: ctx.planHash,
        updatedBy: fresh.data.editLease?.holder ?? "—",
      });
      const rebased = rebaseWhiteboard(mine, latestDoc);
      return saveOps(rebased, latestBase, fresh.data.version);
    },
    [getQ, ctx.planHash, saveOps],
  );

  const onReloadLatest = useCallback(() => {
    void getQ.refetch();
  }, [getQ]);

  /**
   * Server-rendered export → stored artifact + exports row. A storage
   * failure is recorded server-side and surfaced verbatim — never faked.
   */
  const onServerExport = useCallback(
    async (format: ServerExportFormat): Promise<ServerExportResult> => {
      if (boardId == null) return { ok: false, message: "no whiteboard loaded" };
      try {
        const res = await exportM.mutateAsync({
          id: boardId,
          format,
          idempotencyKey: newIdempotencyKey("whiteboard.export"),
        });
        return {
          ok: true,
          message: `export #${res.exportId} stored at ${res.storageKey}`,
          storageKey: res.storageKey,
        };
      } catch (e) {
        return { ok: false, message: (e as { message?: string })?.message ?? String(e) };
      }
    },
    [exportM, boardId],
  );

  /** Client-side byte-exact downloads (SVG render / JSON document). */
  const onExport = useCallback((payload: WbExportPayload) => {
    if (!payload.content) return;
    const blob = new Blob([payload.content], { type: payload.mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `whiteboard-r${payload.revision}.${payload.format}`;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  return {
    boardId,
    doc,
    drift,
    lease,
    revisions,
    needsCreation: !listQ.error && !!listQ.data && boardId == null,
    createPending: createM.isPending,
    create,
    acquireLease,
    onSave,
    onSaveAsNewRevision,
    onReloadLatest,
    onServerExport,
    onExport,
    exportPending: exportM.isPending,
  };
}

export type WhiteboardData = ReturnType<typeof useWhiteboardData>;
