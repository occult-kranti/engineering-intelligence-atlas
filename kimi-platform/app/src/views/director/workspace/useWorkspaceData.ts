import { useCallback, useMemo } from "react";
import { trpc } from "@/lib/trpc-client";
import { TERMINAL_RUN_STATES } from "@contracts/run";
import { useNow } from "./useNow";
import {
  deriveMeters,
  deriveQueueRows,
  deriveStageStatuses,
  deriveWorkerViews,
  directorLeaseFrom,
  isBudgetExhausted,
  leaseStatusFrom,
  pickActiveRun,
  providerChips,
  summarizeQueue,
  toApprovalView,
  unavailable,
  live,
  type ApprovalView,
  type Availability,
  type DirectorControlPlane,
  type LeaseStatus,
  type MeterDatum,
  type PoolStatus,
  type ProviderChip,
  type QueueRow,
  type RoadmapSnapshot,
  type StageStatus,
  type WorkerView,
} from "./adapter";
import {
  createNodeControls,
  createPoolControls,
  createWorkerControls,
} from "./controlActions";

/**
 * Workspace data adapter backed by the live control router.
 *
 * Reads: projects, dag.revisions, runs, approvals, artifacts, plus the
 * control plane — control.roadmapStatus (run nodes with claim/lease
 * metadata) and control.pool.status (workers + active runs). Writes go
 * through the controlActions factories (control.pool.*, control.pump,
 * control.sweep, control.workers.*, control.assign/reassign/cancel), which
 * attach idempotency keys, classify errors, and invalidate on every settled
 * attempt. When the control router is unreachable the surfaces degrade to
 * the honest "control data unavailable" state — no fake controls.
 */
export function useWorkspaceData(projectId: number, focusRunId?: number) {
  const projectQ = trpc.projects.get.useQuery({ id: projectId }, { retry: false });
  const revisionsQ = trpc.dag.revisions.useQuery({ projectId }, { retry: false });
  const runsQ = trpc.runs.listByProject.useQuery({ projectId }, { retry: false });
  const approvalsQ = trpc.approvals.listPending.useQuery(
    { projectId },
    { refetchInterval: 3000, retry: false },
  );
  const providersQ = trpc.ai.providers.useQuery(undefined, { retry: false });

  const runs = useMemo(() => runsQ.data ?? [], [runsQ.data]);
  const activeRun = useMemo(() => pickActiveRun(runs, focusRunId), [runs, focusRunId]);

  const runDetailQ = trpc.runs.get.useQuery(
    { id: activeRun?.id ?? 0 },
    {
      enabled: activeRun != null,
      retry: false,
      refetchInterval: (q) =>
        q.state.data && TERMINAL_RUN_STATES.has(q.state.data.run.state) ? false : 4000,
    },
  );
  const artifactsQ = trpc.artifacts.listByRun.useQuery(
    { runId: activeRun?.id ?? 0 },
    { enabled: activeRun != null, refetchInterval: 5000, retry: false },
  );

  // Control plane: roadmap status (nodes + leases + workers) and pool
  // status (workers + active runs + paused). If the backend is not
  // migrated yet these error and the surfaces degrade honestly.
  const poolQ = trpc.control.pool.status.useQuery(
    { projectId },
    { refetchInterval: 5000, retry: false },
  );
  const roadmapStatusQ = trpc.control.roadmapStatus.useQuery(
    { runId: activeRun?.id ?? 0 },
    { enabled: activeRun != null, refetchInterval: 4000, retry: false },
  );

  const utils = trpc.useUtils();

  /** Consistent refresh after every control mutation (success or 409). */
  const invalidateControl = useCallback(() => {
    void poolQ.refetch();
    void roadmapStatusQ.refetch();
    void runDetailQ.refetch();
    void utils.runs.get.invalidate();
    void utils.runs.listByProject.invalidate();
    void utils.approvals.listPending.invalidate();
  }, [poolQ, roadmapStatusQ, runDetailQ, utils]);

  // ── Control mutations (all real; wrapped by controlActions) ──
  const poolStartM = trpc.control.pool.start.useMutation();
  const poolPauseM = trpc.control.pool.pause.useMutation();
  const poolResumeM = trpc.control.pool.resume.useMutation();
  const poolStopM = trpc.control.pool.stop.useMutation();
  const pumpM = trpc.control.pump.useMutation();
  const sweepM = trpc.control.sweep.useMutation();
  const workerRegisterM = trpc.control.workers.register.useMutation();
  const workerStatusM = trpc.control.workers.setStatus.useMutation();
  const workerCapacityM = trpc.control.workers.setCapacity.useMutation();
  const assignM = trpc.control.assign.useMutation();
  const reassignM = trpc.control.reassign.useMutation();
  const cancelM = trpc.control.cancel.useMutation();

  const now = useNow(1000);

  const data = useMemo(() => {
    const latestRevision = revisionsQ.data?.[0] ?? null;
    const roadmap: RoadmapSnapshot = latestRevision
      ? {
          revisionId: latestRevision.id,
          revision: latestRevision.revision,
          approved: !!latestRevision.approvedAt,
          planHash: latestRevision.planHash,
          nodeCount: latestRevision.spec.nodes.length,
          edgeCount: latestRevision.spec.edges.length,
          spec: latestRevision.spec,
        }
      : {
          revisionId: null,
          revision: null,
          approved: false,
          planHash: null,
          nodeCount: 0,
          edgeCount: 0,
          spec: null,
        };

    const detail = runDetailQ.data ?? null;
    const pendingApprovals: ApprovalView[] = (approvalsQ.data ?? []).map(toApprovalView);
    const nodeScopedPending = detail?.pendingApprovals ?? [];

    // Node states: prefer the control-plane snapshot (carries lease/OCC/
    // assignment metadata); fall back to runs.get while it loads.
    const roadmapStatus = roadmapStatusQ.data ?? null;
    const nodeSource = roadmapStatus?.nodes ?? detail?.nodes ?? null;

    // Worker directory (pool status first, roadmap snapshot as fallback).
    const rawWorkers = poolQ.data?.workers ?? roadmapStatus?.workers ?? [];
    const workerName = new Map(rawWorkers.map((w) => [w.id, w.name]));
    const workerNameFor = (id: number) => workerName.get(id);

    // Lease feed from the roadmap snapshot.
    const leaseByNode = new Map(
      (roadmapStatus?.leases ?? []).map((l) => [l.nodeKey, l] as const),
    );
    const leaseFor = (nodeKey: string): Availability<LeaseStatus> => {
      const l = leaseByNode.get(nodeKey);
      if (!l) {
        return unavailable(
          roadmapStatusQ.error
            ? `control-plane API unavailable: ${roadmapStatusQ.error.message}`
            : "no active lease",
        );
      }
      return live(
        leaseStatusFrom(
          (l.workerId != null && workerName.get(l.workerId)) ||
            (l.workerId != null ? `worker #${l.workerId}` : "unclaimed"),
          l.heartbeatAt,
          l.leaseExpiresAt,
          now,
        ),
      );
    };

    const queueRows: QueueRow[] | null = nodeSource
      ? deriveQueueRows(
          nodeSource,
          roadmap.spec,
          nodeScopedPending.map((a) => ({
            id: a.id,
            runId: a.runId,
            nodeKey: a.nodeKey,
            kind: a.kind,
            payload: a.payload,
          })),
          leaseFor,
          { workerName: workerNameFor },
        )
      : null;

    const usage = detail?.usage ?? null;
    const meters: MeterDatum[] | null =
      detail && usage ? deriveMeters(usage, detail.run.budget, detail.run.mode) : null;
    const budgetUsedPct =
      meters && meters.length
        ? Math.round(meters.reduce((s, m) => s + m.pct, 0) / meters.length)
        : null;

    const artifacts = artifactsQ.data ?? null;
    const artifactSummary = artifacts
      ? {
          total: artifacts.length,
          reviewed: artifacts.filter((a) => a.accepted).length,
          storageErrors: artifacts.filter((a) => a.storageError).length,
        }
      : null;

    const queueCounts = queueRows ? summarizeQueue(queueRows) : null;

    const stages: StageStatus[] = deriveStageStatuses({
      project: projectQ.data ?? null,
      roadmap,
      activeRun,
      queueCounts,
      pendingApprovals: pendingApprovals.length,
      artifacts: artifactSummary,
      budgetUsedPct,
    });

    // ── Worker pool view (capacity, staleness, eligibility) ──
    const pendingStartApprovals = new Set(
      nodeScopedPending
        .filter((a) => a.kind === "plan" && a.nodeKey)
        .map((a) => a.nodeKey as string),
    );
    const workerViews: WorkerView[] = deriveWorkerViews(
      rawWorkers,
      nodeSource ?? [],
      roadmap.spec,
      { now, pendingStartApprovals },
    );

    /** Control-plane seam: pool status degrades honestly on error. */
    const poolStatus: Availability<PoolStatus> = poolQ.data
      ? live({
          paused: poolQ.data.paused,
          activeRuns: poolQ.data.activeRuns.map((r) => ({ id: r.id, state: r.state })),
          workers: workerViews,
        })
      : unavailable<PoolStatus>(
          poolQ.error
            ? `worker pool status unavailable: ${poolQ.error.message}`
            : "worker pool status loading",
        );

    const controlPlane: DirectorControlPlane = {
      queue:
        activeRun && queueRows
          ? live({ runId: activeRun.id, rows: queueRows, counts: queueCounts! })
          : null,
      pool: poolStatus,
      controls: poolQ.data
        ? createPoolControls(
            {
              start: poolStartM,
              pause: poolPauseM,
              resume: poolResumeM,
              stop: poolStopM,
              pump: pumpM,
              sweep: sweepM,
            },
            {
              projectId,
              runId: activeRun?.id ?? null,
              invalidate: invalidateControl,
            },
          )
        : null,
      workerControls: poolQ.data
        ? createWorkerControls(
            {
              register: workerRegisterM,
              setStatus: workerStatusM,
              setCapacity: workerCapacityM,
            },
            { projectId, invalidate: invalidateControl },
          )
        : null,
      nodeControls:
        activeRun && poolQ.data
          ? createNodeControls(
              { assign: assignM, reassign: reassignM, cancel: cancelM },
              { runId: activeRun.id, invalidate: invalidateControl },
            )
          : null,
    };

    const directorWorker = rawWorkers.find((w) => w.kind === "director") ?? null;
    const directorLease = directorLeaseFrom(directorWorker, now);
    const poolPaused = poolQ.data?.paused ?? false;

    const providers: ProviderChip[] = providerChips(providersQ.data ?? []);

    return {
      roadmap,
      activeRun,
      runDetail: detail,
      runs,
      queueRows,
      queueCounts,
      meters,
      budgetExhausted:
        activeRun != null && detail
          ? isBudgetExhausted(activeRun, usage)
          : false,
      pendingApprovals,
      artifacts,
      artifactSummary,
      stages,
      controlPlane,
      controlFeedError: roadmapStatusQ.error?.message ?? null,
      directorLease,
      poolPaused,
      providers,
    };
  }, [
    revisionsQ.data,
    runDetailQ.data,
    approvalsQ.data,
    artifactsQ.data,
    activeRun,
    projectQ.data,
    providersQ.data,
    runs,
    poolQ.data,
    poolQ.error,
    roadmapStatusQ.data,
    roadmapStatusQ.error,
    poolStartM,
    poolPauseM,
    poolResumeM,
    poolStopM,
    pumpM,
    sweepM,
    workerRegisterM,
    workerStatusM,
    workerCapacityM,
    assignM,
    reassignM,
    cancelM,
    invalidateControl,
    projectId,
    now,
  ]);

  const apiDown = !!projectQ.error && !projectQ.data;

  return {
    loading: projectQ.isLoading,
    apiDown,
    apiError: projectQ.error?.message ?? null,
    project: projectQ.data ?? null,
    projectMissing: !projectQ.isLoading && !projectQ.error && !projectQ.data,
    ...data,
    queries: {
      projectQ,
      revisionsQ,
      runsQ,
      approvalsQ,
      providersQ,
      runDetailQ,
      artifactsQ,
      poolQ,
      roadmapStatusQ,
    },
  };
}

export type WorkspaceData = ReturnType<typeof useWorkspaceData>;

/** Global pending-approval count for the top-bar pill (works on every route). */
export function usePendingApprovalCount(): Availability<number> {
  const q = trpc.approvals.listPending.useQuery({}, { refetchInterval: 3000, retry: false });
  if (q.error) return unavailable(q.error.message);
  if (!q.data) return unavailable("loading");
  return live(q.data.length);
}
