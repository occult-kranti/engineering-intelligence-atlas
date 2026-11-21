import type { AssignmentMode, WorkerKind, WorkerStatus } from "@contracts/run";
import {
  classifyControlError,
  newIdempotencyKey,
  type ControlActionResult,
  type NodeControls,
  type PoolControls,
  type WorkerControls,
} from "./adapter";

/**
 * Control-action factories: the seam between tRPC mutations and the
 * workspace UI. Each factory takes mutation-like objects (anything with
 * `mutateAsync`) plus an `invalidate` callback, and returns the
 * PoolControls / WorkerControls / NodeControls surfaces from the adapter.
 *
 * Rules enforced here:
 *  - every mutation carries a client idempotency key (safe retry = replay);
 *  - errors are classified into ControlError, never thrown to components;
 *  - `invalidate()` runs on every settled attempt so 409/conflict states
 *    refresh the view instead of leaving it stale;
 *  - nothing fabricates success: a resolved `{ pumped: null }` is reported
 *    as "nothing eligible", a rejected mutation is an error, full stop.
 *
 * The factories are pure glue — unit-tested with mocked mutations, no DOM.
 */

export interface MutationLike<I, O> {
  mutateAsync(input: I): Promise<O>;
}

async function run<T>(
  fn: () => Promise<T>,
  invalidate: () => void,
): Promise<ControlActionResult<T>> {
  try {
    const data = await fn();
    invalidate();
    return { ok: true, data };
  } catch (err) {
    // Conflicts/fences mean the server state moved — refresh so the next
    // deliberate action starts from the truth.
    invalidate();
    return { ok: false, error: classifyControlError(err) };
  }
}

const noRun = <T,>(): ControlActionResult<T> => ({
  ok: false,
  error: {
    kind: "terminal",
    message: "no active run — start a run from the Roadmap stage first",
    recoverable: false,
    hint: "Pool membership works without a run; per-run controls need one.",
  },
});

// ── Pool ──

export interface PoolMutationSet {
  start: MutationLike<{ projectId: number }, { ok: boolean; directorWorkerId: number; advancing: number }>;
  pause: MutationLike<{ projectId: number }, { ok: boolean; paused: number }>;
  resume: MutationLike<{ projectId: number }, { ok: boolean; resumed: number }>;
  stop: MutationLike<{ projectId: number }, { ok: boolean; stopped: number }>;
  pump: MutationLike<
    { runId: number; workerId?: number; idempotencyKey?: string },
    { pumped: { nodeKey: string; attempt: number } | null }
  >;
  sweep: MutationLike<
    { runId: number; limit?: number },
    { swept: number; recycled: string[]; failed: string[] }
  >;
}

export function createPoolControls(
  m: PoolMutationSet,
  opts: {
    projectId: number;
    runId: number | null;
    invalidate(): void;
    keygen?: (scope: string) => string;
  },
): PoolControls {
  const keygen = opts.keygen ?? newIdempotencyKey;
  const inv = opts.invalidate;
  return {
    startPool: () =>
      run(async () => {
        const r = await m.start.mutateAsync({ projectId: opts.projectId });
        return { directorWorkerId: r.directorWorkerId, advancing: r.advancing };
      }, inv),
    pausePool: () =>
      run(async () => {
        const r = await m.pause.mutateAsync({ projectId: opts.projectId });
        return { paused: r.paused };
      }, inv),
    resumePool: () =>
      run(async () => {
        const r = await m.resume.mutateAsync({ projectId: opts.projectId });
        return { resumed: r.resumed };
      }, inv),
    stopPool: () =>
      run(async () => {
        const r = await m.stop.mutateAsync({ projectId: opts.projectId });
        return { stopped: r.stopped };
      }, inv),
    pumpOnce: (workerId?: number) => {
      if (opts.runId == null) return Promise.resolve(noRun());
      const runId = opts.runId;
      return run(
        () =>
          m.pump.mutateAsync({
            runId,
            ...(workerId != null ? { workerId } : {}),
            idempotencyKey: keygen("pump"),
          }),
        inv,
      );
    },
    sweepExpiredLeases: () => {
      if (opts.runId == null) return Promise.resolve(noRun());
      const runId = opts.runId;
      return run(() => m.sweep.mutateAsync({ runId }), inv);
    },
  };
}

// ── Workers ──

export interface WorkerMutationSet {
  register: MutationLike<
    {
      projectId: number;
      name: string;
      kind: WorkerKind;
      role: string;
      capabilities: string[];
      skillRefs: { name: string; version: string; sha256: string }[];
      maxConcurrentClaims: number;
      leaseTtlSeconds: number;
      idempotencyKey?: string;
    },
    { ok: boolean; workerId: number }
  >;
  setStatus: MutationLike<
    { workerId: number; status: WorkerStatus },
    { ok: boolean }
  >;
  setCapacity: MutationLike<
    { workerId: number; maxConcurrentClaims: number; leaseTtlSeconds?: number },
    { ok: boolean }
  >;
}

export function createWorkerControls(
  m: WorkerMutationSet,
  opts: {
    projectId: number;
    invalidate(): void;
    keygen?: (scope: string) => string;
    /** Default lease TTL for registrations (server default is 120 s). */
    defaultLeaseTtlSeconds?: number;
  },
): WorkerControls {
  const keygen = opts.keygen ?? newIdempotencyKey;
  const inv = opts.invalidate;
  return {
    register: (input) =>
      run(
        () =>
          m.register.mutateAsync({
            projectId: opts.projectId,
            name: input.name,
            kind: input.kind,
            role: input.role,
            capabilities: input.capabilities,
            // Skill pins are managed through the plan/registry, not freehand
            // in this form — register with none and pin deliberately later.
            skillRefs: [],
            maxConcurrentClaims: input.maxConcurrentClaims,
            leaseTtlSeconds: input.leaseTtlSeconds ?? opts.defaultLeaseTtlSeconds ?? 120,
            idempotencyKey: keygen("workers.register"),
          }),
        inv,
      ),
    setStatus: (workerId, status) =>
      run(() => m.setStatus.mutateAsync({ workerId, status }), inv),
    setCapacity: (workerId, maxConcurrentClaims, leaseTtlSeconds) =>
      run(
        () =>
          m.setCapacity.mutateAsync({
            workerId,
            maxConcurrentClaims,
            ...(leaseTtlSeconds != null ? { leaseTtlSeconds } : {}),
          }),
        inv,
      ),
  };
}

// ── Nodes ──

export interface NodeMutationSet {
  assign: MutationLike<
    {
      runId: number;
      nodeKey: string;
      workerId: number | null;
      assignmentMode?: AssignmentMode;
      idempotencyKey?: string;
    },
    { ok: boolean }
  >;
  reassign: MutationLike<
    { runId: number; nodeKey: string; workerId: number | null; idempotencyKey?: string },
    { ok: boolean }
  >;
  cancel: MutationLike<
    {
      runId: number;
      nodeKey: string;
      expectedVersion?: number;
      idempotencyKey?: string;
    },
    { ok: boolean; cancelled: string[] }
  >;
}

export function createNodeControls(
  m: NodeMutationSet,
  opts: {
    runId: number;
    invalidate(): void;
    keygen?: (scope: string) => string;
  },
): NodeControls {
  const keygen = opts.keygen ?? newIdempotencyKey;
  const inv = opts.invalidate;
  return {
    assign: (input) =>
      run(
        () =>
          m.assign.mutateAsync({
            runId: opts.runId,
            nodeKey: input.nodeKey,
            workerId: input.workerId,
            ...(input.assignmentMode ? { assignmentMode: input.assignmentMode } : {}),
            idempotencyKey: keygen("assign"),
          }),
        inv,
      ),
    reassign: (input) =>
      run(
        () =>
          m.reassign.mutateAsync({
            runId: opts.runId,
            nodeKey: input.nodeKey,
            workerId: input.workerId,
            idempotencyKey: keygen("reassign"),
          }),
        inv,
      ),
    cancel: (input) =>
      run(
        async () => {
          const r = await m.cancel.mutateAsync({
            runId: opts.runId,
            nodeKey: input.nodeKey,
            ...(input.expectedVersion != null
              ? { expectedVersion: input.expectedVersion }
              : {}),
            idempotencyKey: keygen("cancel"),
          });
          return { cancelled: r.cancelled };
        },
        inv,
      ),
  };
}
