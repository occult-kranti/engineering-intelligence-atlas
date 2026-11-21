import { useCallback, useMemo } from "react";
import { trpc } from "@/lib/trpc-client";
import { usdToMicros } from "@contracts/dag";
import type { RoomBudgets } from "@contracts/office";
import {
  live,
  newIdempotencyKey,
  unavailable,
  type Availability,
  type RunLike,
} from "../workspace/adapter";
import { useNow } from "../workspace/useNow";
import {
  classifyReassignError,
  mapOfficeStatus,
  planOfficeMove,
  type OfficeNodeLike,
  type OfficeWorkerLike,
} from "./officeAdapter";
import type {
  OfficeBlueprintData,
  ReassignInput,
  ReassignResult,
} from "./model";

export interface AllocateRoomInput {
  roomId: number;
  budgets: RoomBudgets;
  capacity?: number;
  expectedVersion: number;
}

export type AllocateRoomResult = { ok: true } | { ok: false; message: string };

/**
 * Office data hook — the impure seam over officeAdapter.ts. Reads the real
 * office router (status) plus the control plane (pool workers, active-run
 * nodes for claims/tasks) and exposes the blueprint Availability envelope,
 * the first-run setup mutation, and the assign/reassign/release/allocate
 * mutations. Every mutation awaits the server; success is only reported
 * after the server confirms, and the office re-reads from server truth.
 */
export function useOfficeData(projectId: number, activeRun: RunLike | null) {
  const statusQ = trpc.office.status.useQuery(
    { projectId },
    { refetchInterval: 5000, retry: false },
  );
  const poolQ = trpc.control.pool.status.useQuery(
    { projectId },
    { refetchInterval: 5000, retry: false },
  );
  const roadmapStatusQ = trpc.control.roadmapStatus.useQuery(
    { runId: activeRun?.id ?? 0 },
    { enabled: activeRun != null, refetchInterval: 4000, retry: false },
  );
  const utils = trpc.useUtils();
  const now = useNow(1000);

  const refresh = useCallback(() => {
    void statusQ.refetch();
    void poolQ.refetch();
    void roadmapStatusQ.refetch();
    void utils.control.pool.status.invalidate();
    void utils.control.roadmapStatus.invalidate();
  }, [statusQ, poolQ, roadmapStatusQ, utils]);

  const setupM = trpc.office.setup.useMutation({ onSuccess: refresh });
  const allocateM = trpc.office.allocate.useMutation();
  const assignM = trpc.office.assign.useMutation();
  const reassignM = trpc.office.reassign.useMutation();
  const releaseM = trpc.office.release.useMutation();

  const workers = useMemo(
    () => (poolQ.data?.workers ?? []) as unknown as OfficeWorkerLike[],
    [poolQ.data],
  );
  const nodes = useMemo(
    () => (roadmapStatusQ.data?.nodes ?? []) as unknown as OfficeNodeLike[],
    [roadmapStatusQ.data],
  );

  const blueprint: Availability<OfficeBlueprintData> = useMemo(() => {
    if (statusQ.error) {
      return unavailable(`office status unavailable: ${statusQ.error.message}`);
    }
    if (!statusQ.data) return unavailable("office status loading");
    if (!statusQ.data.blueprint) {
      return unavailable("no active office blueprint — run first-time setup below");
    }
    return live({
      ...mapOfficeStatus(statusQ.data, workers, nodes, {
        now,
        runMode: activeRun?.mode ?? null,
        runBudgetUsdMicros: activeRun ? usdToMicros(activeRun.budget.maxCostUsd) : null,
      }),
      projectId,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusQ.data, statusQ.error, poolQ.data, roadmapStatusQ.data, activeRun, now, projectId]);

  /** Node lookup for the shared inspector (live run state). */
  const liveNode = useCallback(
    (nodeKey: string) =>
      nodes.find((n) => n.nodeKey === nodeKey) as unknown as
        | import("../workspace/adapter").RunNodeLike
        | undefined,
    [nodes],
  );

  const needsSetup =
    !statusQ.error && !!statusQ.data && statusQ.data.blueprint === null;

  const setup = useCallback(async (): Promise<{ ok: boolean; message?: string }> => {
    try {
      await setupM.mutateAsync({
        projectId,
        idempotencyKey: newIdempotencyKey("office.setup"),
      });
      return { ok: true };
    } catch (e) {
      return { ok: false, message: (e as { message?: string })?.message ?? String(e) };
    }
  }, [setupM, projectId]);

  const onReassign = useCallback(
    async (input: ReassignInput): Promise<ReassignResult> => {
      const status = statusQ.data;
      if (!status?.blueprint) {
        return {
          ok: false,
          error: { cause: "unavailable", message: "office is not set up yet" },
        };
      }
      const bp = blueprint.status === "live" ? blueprint.data : null;
      const agent = bp
        ? [...bp.rooms.flatMap((r) => r.agents), ...bp.bench].find(
            (a) => a.workerId === input.workerId,
          )
        : undefined;
      if (!agent) {
        return {
          ok: false,
          error: {
            cause: "unavailable",
            message: `worker #${input.workerId} is not in the current office view — refresh and retry`,
          },
        };
      }
      const seat = status.rooms
        .flatMap((r) => r.seats)
        .find((s) => s.workerId === input.workerId);
      const plan = planOfficeMove(
        agent,
        input.toRoomKey,
        input.claimsPolicy,
        status.rooms,
        seat?.assignmentId ?? null,
      );
      if (plan.kind === "error") return { ok: false, error: plan.error };
      try {
        if (plan.kind === "assign") {
          await assignM.mutateAsync({
            projectId,
            roomId: plan.roomId,
            workerId: plan.workerId,
            expectedVersion: plan.expectedVersion,
            idempotencyKey: newIdempotencyKey("office.assign"),
          });
        } else if (plan.kind === "reassign") {
          await reassignM.mutateAsync({
            projectId,
            workerId: plan.workerId,
            toRoomId: plan.toRoomId,
            expectedVersion: plan.expectedVersion,
            claimsPolicy: plan.claimsPolicy,
            idempotencyKey: newIdempotencyKey("office.reassign"),
          });
        } else {
          await releaseM.mutateAsync({
            projectId,
            assignmentId: plan.assignmentId,
            idempotencyKey: newIdempotencyKey("office.release"),
          });
        }
        refresh();
        return { ok: true };
      } catch (e) {
        refresh(); // a 409 means the view is stale — show server truth
        return { ok: false, error: classifyReassignError(e) };
      }
    },
    [statusQ.data, blueprint, projectId, assignM, reassignM, releaseM, refresh],
  );

  const allocateRoom = useCallback(
    async (input: AllocateRoomInput): Promise<AllocateRoomResult> => {
      try {
        await allocateM.mutateAsync({
          projectId,
          roomId: input.roomId,
          budgets: input.budgets,
          capacity: input.capacity,
          expectedVersion: input.expectedVersion,
          idempotencyKey: newIdempotencyKey("office.allocate"),
        });
        refresh();
        return { ok: true };
      } catch (e) {
        refresh();
        return { ok: false, message: (e as { message?: string })?.message ?? String(e) };
      }
    },
    [allocateM, projectId, refresh],
  );

  /** roomKey → room id of the active blueprint (for allocate dialogs). */
  const roomIdByKey = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of statusQ.data?.rooms ?? []) m.set(r.key, r.id);
    return m;
  }, [statusQ.data]);

  const roomBudgetsByKey = useMemo(() => {
    const m = new Map<string, { budgets: RoomBudgets; capacity: number; version: number; id: number }>();
    for (const r of statusQ.data?.rooms ?? []) {
      m.set(r.key, { budgets: r.budgets, capacity: r.capacity, version: r.version, id: r.id });
    }
    return m;
  }, [statusQ.data]);

  return {
    blueprint,
    needsSetup,
    setupPending: setupM.isPending,
    setup,
    onReassign,
    allocateRoom,
    roomIdByKey,
    roomBudgetsByKey,
    liveNode,
    statusError: statusQ.error?.message ?? null,
    refresh,
  };
}

export type OfficeData = ReturnType<typeof useOfficeData>;
