import { describe, expect, it, vi } from "vitest";
import {
  createNodeControls,
  createPoolControls,
  createWorkerControls,
  type MutationLike,
  type NodeMutationSet,
  type PoolMutationSet,
  type WorkerMutationSet,
} from "./controlActions";

/**
 * Control-action tests with mocked tRPC mutations: claim conflict (409),
 * stale lease, paused pool, worker ineligible (pumped:null), cancellation
 * with expectedVersion, duplicate worker registration, and idempotency-key
 * behaviour. No DOM needed — the factories are the UI's action layer.
 */

const conflict = (message: string) => {
  const e = new Error(message) as Error & { data: { code: string; httpStatus: number } };
  e.data = { code: "CONFLICT", httpStatus: 409 };
  return e;
};

const mutation = <I, O>(impl: (input: I) => Promise<O>) => {
  const mutateAsync = vi.fn(impl);
  return { mutateAsync } satisfies MutationLike<I, O>;
};

function poolSet(over: Partial<PoolMutationSet> = {}): PoolMutationSet {
  return {
    start: mutation(async () => ({ ok: true, directorWorkerId: 3, advancing: 2 })),
    pause: mutation(async () => ({ ok: true, paused: 1 })),
    resume: mutation(async () => ({ ok: true, resumed: 1 })),
    stop: mutation(async () => ({ ok: true, stopped: 2 })),
    pump: mutation(async () => ({ pumped: { nodeKey: "intake", attempt: 1 } })),
    sweep: mutation(async () => ({ swept: 1, recycled: ["a"], failed: [] })),
    ...over,
  };
}

describe("createPoolControls", () => {
  it("start/pause/resume/stop are owner-scoped by projectId and invalidate", async () => {
    const m = poolSet();
    const invalidate = vi.fn();
    const c = createPoolControls(m, { projectId: 7, runId: 11, invalidate });

    const started = await c.startPool();
    expect(started).toEqual({ ok: true, data: { directorWorkerId: 3, advancing: 2 } });
    expect(m.start.mutateAsync).toHaveBeenCalledWith({ projectId: 7 });

    await c.pausePool();
    expect(m.pause.mutateAsync).toHaveBeenCalledWith({ projectId: 7 });
    await c.resumePool();
    await c.stopPool();
    expect(m.stop.mutateAsync).toHaveBeenCalledWith({ projectId: 7 });
    expect(invalidate).toHaveBeenCalledTimes(4);
  });

  it("pumpOnce sends an idempotency key and reports a real claim", async () => {
    const m = poolSet();
    const keys: string[] = [];
    const c = createPoolControls(m, {
      projectId: 7,
      runId: 11,
      invalidate: () => undefined,
      keygen: (scope) => {
        const k = `test:${scope}:${keys.length}`;
        keys.push(k);
        return k;
      },
    });
    const r = await c.pumpOnce();
    expect(r.ok && r.data.pumped?.nodeKey).toBe("intake");
    expect(m.pump.mutateAsync).toHaveBeenCalledWith({
      runId: 11,
      idempotencyKey: "test:pump:0",
    });
  });

  it("pumpOnce with nothing eligible is honest, not an error", async () => {
    const m = poolSet({ pump: mutation(async () => ({ pumped: null })) });
    const c = createPoolControls(m, { projectId: 7, runId: 11, invalidate: () => undefined });
    const r = await c.pumpOnce();
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.pumped).toBeNull();
  });

  it("maps a 409 claim conflict to a recoverable classified error + refresh", async () => {
    const m = poolSet({
      pump: mutation(async () => {
        throw conflict("node is not assignable (claimed, running, or terminal)");
      }),
    });
    const invalidate = vi.fn();
    const c = createPoolControls(m, { projectId: 7, runId: 11, invalidate });
    const r = await c.pumpOnce();
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.kind).toBe("conflict");
      expect(r.error.recoverable).toBe(true);
    }
    expect(invalidate).toHaveBeenCalledTimes(1);
  });

  it("maps a paused pool rejection to the paused kind", async () => {
    const m = poolSet({
      pump: mutation(async () => {
        throw new Error("run is paused — resume it before pumping");
      }),
    });
    const c = createPoolControls(m, { projectId: 7, runId: 11, invalidate: () => undefined });
    const r = await c.pumpOnce();
    expect(!r.ok && r.error.kind).toBe("paused");
  });

  it("pump/sweep without an active run fail honestly without calling the API", async () => {
    const m = poolSet();
    const c = createPoolControls(m, { projectId: 7, runId: null, invalidate: () => undefined });
    const r = await c.pumpOnce();
    expect(!r.ok && r.error.kind).toBe("terminal");
    const s = await c.sweepExpiredLeases();
    expect(!s.ok && s.error.kind).toBe("terminal");
    expect(m.pump.mutateAsync).not.toHaveBeenCalled();
    expect(m.sweep.mutateAsync).not.toHaveBeenCalled();
  });
});

describe("createWorkerControls", () => {
  function workerSet(over: Partial<WorkerMutationSet> = {}): WorkerMutationSet {
    return {
      register: mutation(async () => ({ ok: true, workerId: 42 })),
      setStatus: mutation(async () => ({ ok: true })),
      setCapacity: mutation(async () => ({ ok: true })),
      ...over,
    };
  }

  it("register posts the full payload with an idempotency key", async () => {
    const m = workerSet();
    const c = createWorkerControls(m, {
      projectId: 7,
      invalidate: () => undefined,
      keygen: () => "k-1",
    });
    const r = await c.register({
      name: "researcher-1",
      kind: "subagent",
      role: "Research Scientist",
      capabilities: ["read"],
      maxConcurrentClaims: 2,
    });
    expect(r.ok && r.data.workerId).toBe(42);
    expect(m.register.mutateAsync).toHaveBeenCalledWith({
      projectId: 7,
      name: "researcher-1",
      kind: "subagent",
      role: "Research Scientist",
      capabilities: ["read"],
      skillRefs: [],
      maxConcurrentClaims: 2,
      leaseTtlSeconds: 120,
      idempotencyKey: "k-1",
    });
  });

  it("duplicate registration surfaces the 409 as recoverable conflict", async () => {
    const m = workerSet({
      register: mutation(async () => {
        throw conflict('worker "researcher-1" already exists in this project');
      }),
    });
    const c = createWorkerControls(m, { projectId: 7, invalidate: () => undefined });
    const r = await c.register({
      name: "researcher-1",
      kind: "subagent",
      role: "R",
      capabilities: [],
      maxConcurrentClaims: 1,
    });
    expect(!r.ok && r.error.kind).toBe("conflict");
  });

  it("setStatus/setCapacity pass worker-scoped inputs", async () => {
    const m = workerSet();
    const c = createWorkerControls(m, { projectId: 7, invalidate: () => undefined });
    await c.setStatus(9, "suspended");
    expect(m.setStatus.mutateAsync).toHaveBeenCalledWith({ workerId: 9, status: "suspended" });
    await c.setCapacity(9, 4, 300);
    expect(m.setCapacity.mutateAsync).toHaveBeenCalledWith({
      workerId: 9,
      maxConcurrentClaims: 4,
      leaseTtlSeconds: 300,
    });
  });
});

describe("createNodeControls", () => {
  function nodeSet(over: Partial<NodeMutationSet> = {}): NodeMutationSet {
    return {
      assign: mutation(async () => ({ ok: true })),
      reassign: mutation(async () => ({ ok: true })),
      cancel: mutation(async () => ({ ok: true, cancelled: ["synth", "report"] })),
      ...over,
    };
  }

  it("assign/reassign/cancel send run scope, node and idempotency keys", async () => {
    const m = nodeSet();
    const c = createNodeControls(m, {
      runId: 11,
      invalidate: () => undefined,
      keygen: (s) => `k-${s}`,
    });
    await c.assign({ nodeKey: "synth", workerId: 5, assignmentMode: "director" });
    expect(m.assign.mutateAsync).toHaveBeenCalledWith({
      runId: 11,
      nodeKey: "synth",
      workerId: 5,
      assignmentMode: "director",
      idempotencyKey: "k-assign",
    });
    await c.reassign({ nodeKey: "synth", workerId: null });
    expect(m.reassign.mutateAsync).toHaveBeenCalledWith({
      runId: 11,
      nodeKey: "synth",
      workerId: null,
      idempotencyKey: "k-reassign",
    });
    const r = await c.cancel({ nodeKey: "synth", expectedVersion: 4 });
    expect(r.ok && r.data.cancelled).toEqual(["synth", "report"]);
    expect(m.cancel.mutateAsync).toHaveBeenCalledWith({
      runId: 11,
      nodeKey: "synth",
      expectedVersion: 4,
      idempotencyKey: "k-cancel",
    });
  });

  it("cancel version_conflict is a recoverable conflict that refreshes", async () => {
    const m = nodeSet({
      cancel: mutation(async () => {
        throw conflict("version_conflict: node is at version 5, expected 4");
      }),
    });
    const invalidate = vi.fn();
    const c = createNodeControls(m, { runId: 11, invalidate });
    const r = await c.cancel({ nodeKey: "synth", expectedVersion: 4 });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.kind).toBe("conflict");
      expect(r.error.recoverable).toBe(true);
      expect(r.error.hint).toContain("refreshed");
    }
    expect(invalidate).toHaveBeenCalledTimes(1);
  });

  it("reassign on a fenced node surfaces the stale-lease kind", async () => {
    const m = nodeSet({
      reassign: mutation(async () => {
        throw conflict("node is not reassignable (pending or terminal)");
      }),
    });
    const c = createNodeControls(m, { runId: 11, invalidate: () => undefined });
    const r = await c.reassign({ nodeKey: "synth", workerId: 2 });
    expect(!r.ok && r.error.kind).toBe("conflict");
  });

  it("cancelling an already-terminal node is classified terminal/stale", async () => {
    const m = nodeSet({
      cancel: mutation(async () => {
        throw conflict("node is already terminal — nothing to cancel");
      }),
    });
    const c = createNodeControls(m, { runId: 11, invalidate: () => undefined });
    const r = await c.cancel({ nodeKey: "synth" });
    expect(!r.ok && (r.error.kind === "stale-lease" || r.error.kind === "conflict")).toBe(true);
  });
});
