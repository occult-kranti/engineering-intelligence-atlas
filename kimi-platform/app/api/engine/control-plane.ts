import { and, desc, eq, inArray, notInArray, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { getDb } from "../queries/connection";
import {
  dagRevisions,
  projects,
  runNodes,
  runs,
  workers,
  approvals,
  type Run,
  type RunNode,
  type Worker,
} from "@db/schema";
import type { DagSpec, NodeSpec } from "@contracts/dag";
import {
  DIRECTOR_WORKER_NAME,
  NODE_MAX_ATTEMPTS,
  TERMINAL_NODE_STATES,
} from "@contracts/run";
import { appendEvent } from "./events";

/**
 * Control plane (refactor doc §9, Revision A): the approved DAG revision +
 * run_nodes ARE the durable shared roadmap. This module adds the worker pool
 * and the atomic claim/lease protocol on top of them:
 *
 *   - CLAIM: unlocked candidate read (bounded), then a single state+version
 *     guarded UPDATE. No SELECT ... FOR UPDATE SKIP LOCKED (TiDB-unsafe);
 *     the guarded UPDATE is the only arbiter, affectedRows is the outcome.
 *   - HEARTBEAT / COMPLETE / FAIL / RELEASE: single statements fenced by
 *     lease_token (+ state), so stale writers lose after expiry/revocation.
 *   - SWEEP: expired leases recycle to `ready` while attempts remain, else
 *     `failed` — always audited, never a silent billed retry.
 *
 * Eligibility (role + capability + skill-pin + dependencies + capacity) is
 * evaluated app-side before the CAS, mirroring the dag-validate/dispatchNode
 * re-check discipline: the SELECT is advisory, the CAS decides.
 */

/** Stale writer: the lease token is wrong, expired, or already revoked. */
export class FenceError extends Error {
  constructor(message = "lease token is invalid, expired, or revoked (fenced)") {
    super(message);
    this.name = "FenceError";
  }
}

/** Another claimant won the CAS race for this node. */
export class ClaimLostError extends Error {
  constructor(message = "node was claimed by another worker") {
    super(message);
    this.name = "ClaimLostError";
  }
}

// ── Director worker ("worker 0") ─────────────────────────────────

const DIRECTOR_CAPABILITIES = ["read", "summarize", "compare", "cite", "classify", "synthesize"];

/** Seeded lazily on first run start / first advance; idempotent. */
export async function ensureDirectorWorker(projectId: number): Promise<Worker> {
  const db = getDb();
  const existing = await db.query.workers.findFirst({
    where: and(eq(workers.projectId, projectId), eq(workers.name, DIRECTOR_WORKER_NAME)),
  });
  if (existing) return existing;
  try {
    const [row] = await db.insert(workers).values({
      projectId,
      name: DIRECTOR_WORKER_NAME,
      kind: "director",
      role: "director",
      capabilities: DIRECTOR_CAPABILITIES,
      skillRefs: [],
      maxConcurrentClaims: 1,
      leaseTtlSeconds: 120,
    });
    return (await db.query.workers.findFirst({ where: eq(workers.id, Number(row.insertId)) }))!;
  } catch {
    // Unique (project_id, name) race with a concurrent seed — re-read.
    const raced = await db.query.workers.findFirst({
      where: and(eq(workers.projectId, projectId), eq(workers.name, DIRECTOR_WORKER_NAME)),
    });
    if (raced) return raced;
    throw new Error("failed to seed director worker");
  }
}

// ── Eligibility (pure; unit-tested) ──────────────────────────────

/**
 * Returns null when the worker may claim the node, else a stable reason code.
 * Dependency satisfaction and approval gates are passed in by the caller
 * (they require run-wide state); everything else is checked here.
 */
export function checkWorkerEligibility(
  worker: Pick<Worker, "kind" | "role" | "capabilities" | "skillRefs" | "status">,
  node: NodeSpec,
  opts: {
    depsAccepted: boolean;
    startApproved: boolean;
    mode: "director" | "self-claim";
  },
): string | null {
  if (worker.status !== "active") return "worker_suspended";
  if (!opts.depsAccepted) return "dependencies_unmet";
  if (node.approvalBefore === "start" && !opts.startApproved) {
    return "awaiting_start_approval";
  }
  // The director is worker 0: it delegates to the pinned skill rather than
  // matching a role, so role/capability/pin checks apply to subagents only.
  if (worker.kind === "director") return null;
  if (worker.role !== node.role) return "role_mismatch";
  const pin = worker.skillRefs.some(
    (p) => p.name === node.skill.name && p.version === node.skill.version,
  );
  if (!pin) return "skill_pin_mismatch";
  const caps = new Set(worker.capabilities);
  for (const tool of node.toolsAllowed) {
    if (!caps.has(tool)) return "capability_mismatch";
  }
  return null;
}

// ── Atomic claim ─────────────────────────────────────────────────

export interface ClaimResult {
  nodeId: number;
  nodeKey: string;
  leaseToken: string;
  attempt: number;
  node: RunNode;
}

const CLAIM_CANDIDATE_LIMIT = 8;

/**
 * Claim one ready node for a worker. Returns null when nothing is eligible.
 * `opts.nodeKey` pins the claim to a specific node (manual/directed claim);
 * `opts.exclude` lets the caller veto candidates (e.g. node budget pre-check).
 */
export async function claimNextNode(
  run: Run,
  worker: Worker,
  opts: {
    nodeKey?: string;
    exclude?: (row: RunNode) => string | null;
  } = {},
): Promise<ClaimResult | null> {
  const db = getDb();
  const revision = await db.query.dagRevisions.findFirst({
    where: eq(dagRevisions.id, run.dagRevisionId),
  });
  const spec = revision!.spec as DagSpec;

  // Bounded, unlocked candidate read (correctness comes from the CAS below).
  const candidates = await db
    .select()
    .from(runNodes)
    .where(and(eq(runNodes.runId, run.id), eq(runNodes.state, "ready")))
    .orderBy(desc(runNodes.priority), runNodes.id)
    .limit(CLAIM_CANDIDATE_LIMIT);

  const allNodes = await db.select().from(runNodes).where(eq(runNodes.runId, run.id));
  const stateByKey = new Map(allNodes.map((n) => [n.nodeKey, n.state]));
  const depsAccepted = (key: string) =>
    spec.edges.filter((e) => e.to === key).every((e) => stateByKey.get(e.from) === "accepted");

  const startApprovals = await db
    .select({ nodeKey: approvals.nodeKey })
    .from(approvals)
    .where(
      and(eq(approvals.runId, run.id), eq(approvals.kind, "plan"), eq(approvals.state, "approved")),
    );
  const startApproved = new Set(startApprovals.map((a) => a.nodeKey));

  // A worker draining into another room stops picking up new work; its
  // in-flight claims finish, then the sweeper completes the transfer.
  if (worker.pendingRoomKey) return null;

  // Capacity: active claims held by this worker.
  const activeClaims = allNodes.filter(
    (n) =>
      (n.state === "claimed" || n.state === "running") && n.leaseWorkerId === worker.id,
  ).length;
  if (activeClaims >= worker.maxConcurrentClaims) return null;

  // Enterprise shared capacity group (CEO mode): a department's origin pool
  // worker and its borrowing-project secondees share ONE group-wide
  // concurrency budget (the minimum member limit). Claims are counted across
  // ALL runs, not just this one. App-side pre-check only — the claim CAS
  // below remains the arbiter, so this can never over-admit under races.
  if (worker.capacityGroupId) {
    const groupWorkers = await db
      .select({ id: workers.id, maxConcurrentClaims: workers.maxConcurrentClaims })
      .from(workers)
      .where(eq(workers.capacityGroupId, worker.capacityGroupId));
    if (groupWorkers.length > 0) {
      const groupLimit = Math.min(...groupWorkers.map((w) => w.maxConcurrentClaims));
      const [groupRow] = await db
        .select({ n: sql<number>`COUNT(*)` })
        .from(runNodes)
        .where(
          and(
            inArray(
              runNodes.leaseWorkerId,
              groupWorkers.map((w) => w.id),
            ),
            inArray(runNodes.state, ["claimed", "running"]),
          ),
        );
      if (Number(groupRow?.n ?? 0) >= groupLimit) return null;
    }
  }

  const mode = worker.kind === "director" ? "director" : "self-claim";
  for (const cand of candidates) {
    if (opts.nodeKey && cand.nodeKey !== opts.nodeKey) continue;
    // A node assigned to a specific worker is only claimable by that worker
    // (the director may always take it — it is the fallback executor).
    if (
      cand.assignedWorkerId &&
      cand.assignedWorkerId !== worker.id &&
      worker.kind !== "director"
    ) {
      continue;
    }
    if (
      worker.kind !== "director" &&
      cand.assignmentMode !== "self-claim" &&
      cand.assignmentMode !== "hybrid" &&
      cand.assignedWorkerId !== worker.id
    ) {
      continue; // director-mode work is not self-claimable
    }
    const node = cand.contract as NodeSpec;
    const reason =
      checkWorkerEligibility(worker, node, {
        depsAccepted: depsAccepted(cand.nodeKey),
        startApproved: startApproved.has(cand.nodeKey),
        mode,
      }) ?? opts.exclude?.(cand) ?? null;
    if (reason) continue;

    const token = randomUUID();
    const [res] = await db
      .update(runNodes)
      .set({
        state: "claimed",
        assignedWorkerId: cand.assignedWorkerId ?? worker.id,
        leaseWorkerId: worker.id,
        leaseToken: token,
        // DB-side clock (NOW(3)): app↔TiDB clock skew cannot extend a lease.
        leaseExpiresAt: sql`DATE_ADD(NOW(3), INTERVAL ${worker.leaseTtlSeconds} SECOND)`,
        heartbeatAt: sql`NOW(3)`,
        attempts: cand.attempts + 1,
        version: cand.version + 1,
      })
      .where(
        and(
          eq(runNodes.id, cand.id),
          eq(runNodes.state, "ready"), // state guard
          eq(runNodes.version, cand.version), // OCC guard
        ),
      );
    if (res.affectedRows !== 1) continue; // lost the race — try next candidate

    await db
      .update(workers)
      .set({ lastSeenAt: new Date() })
      .where(eq(workers.id, worker.id));
    await appendEvent(run.id, {
      type: "node_state",
      actor: "worker",
      nodeKey: cand.nodeKey,
      payload: {
        state: "claimed",
        workerId: worker.id,
        workerKind: worker.kind,
        attempt: cand.attempts + 1,
      },
    });
    const fresh = (await db.query.runNodes.findFirst({ where: eq(runNodes.id, cand.id) }))!;
    return {
      nodeId: cand.id,
      nodeKey: cand.nodeKey,
      leaseToken: token,
      attempt: cand.attempts + 1,
      node: fresh,
    };
  }
  return null;
}

// ── Lease heartbeat (fencing built into the statement) ───────────

export async function heartbeatLease(
  runId: number,
  nodeKey: string,
  leaseToken: string,
  ttlSeconds: number,
): Promise<{ leaseExpiresAt: Date; heartbeatAt: Date }> {
  const db = getDb();
  const [res] = await db
    .update(runNodes)
    .set({
      heartbeatAt: sql`NOW(3)`,
      leaseExpiresAt: sql`DATE_ADD(NOW(3), INTERVAL ${ttlSeconds} SECOND)`,
    })
    .where(
      and(
        eq(runNodes.runId, runId),
        eq(runNodes.nodeKey, nodeKey),
        eq(runNodes.leaseToken, leaseToken),
        inArray(runNodes.state, ["claimed", "running"]),
        sql`${runNodes.leaseExpiresAt} > NOW(3)`,
      ),
    );
  if (res.affectedRows !== 1) throw new FenceError();
  const fresh = (await db.query.runNodes.findFirst({
    where: and(eq(runNodes.runId, runId), eq(runNodes.nodeKey, nodeKey)),
  }))!;
  return { leaseExpiresAt: fresh.leaseExpiresAt!, heartbeatAt: fresh.heartbeatAt! };
}

// ── Lease-guarded transitions ────────────────────────────────────

async function guardedNodeUpdate(
  runId: number,
  nodeKey: string,
  leaseToken: string,
  fromStates: RunNode["state"][],
  set: Record<string, unknown>,
): Promise<boolean> {
  const db = getDb();
  const [res] = await db
    .update(runNodes)
    .set({ ...set, version: sql`${runNodes.version} + 1` })
    .where(
      and(
        eq(runNodes.runId, runId),
        eq(runNodes.nodeKey, nodeKey),
        eq(runNodes.leaseToken, leaseToken),
        inArray(runNodes.state, fromStates),
      ),
    );
  return res.affectedRows === 1;
}

/** Release a claim pre-dispatch: claimed → ready, attempt is consumed. */
export async function releaseClaim(
  runId: number,
  nodeKey: string,
  leaseToken: string,
): Promise<void> {
  const ok = await guardedNodeUpdate(runId, nodeKey, leaseToken, ["claimed"], {
    state: "ready",
    leaseToken: null,
    leaseWorkerId: null,
    leaseExpiresAt: null,
    heartbeatAt: null,
  });
  if (!ok) throw new FenceError("only a claimed node can be released by its lease holder");
  await appendEvent(runId, {
    type: "node_state",
    actor: "worker",
    nodeKey,
    payload: { state: "ready", released: true },
  });
}

/**
 * Worker completion signal: running → verifying (lease-fenced). Acceptance
 * stays on the existing deterministic + approval path; artifact production
 * stays on the director dispatch path (no external code execution).
 */
export async function completeClaimedNode(
  runId: number,
  nodeKey: string,
  leaseToken: string,
): Promise<void> {
  const db = getDb();
  const ok = await db.transaction(async (tx) => {
    const [res] = await tx
      .update(runNodes)
      .set({
        state: "verifying",
        leaseToken: null,
        leaseWorkerId: null,
        leaseExpiresAt: null,
        heartbeatAt: null,
        version: sql`${runNodes.version} + 1`,
      })
      .where(
        and(
          eq(runNodes.runId, runId),
          eq(runNodes.nodeKey, nodeKey),
          eq(runNodes.leaseToken, leaseToken),
          eq(runNodes.state, "running"),
        ),
      );
    return res.affectedRows === 1;
  });
  if (!ok) throw new FenceError("completion rejected: lease fenced or node not running");
  await appendEvent(runId, {
    type: "node_state",
    actor: "worker",
    nodeKey,
    payload: { state: "verifying", via: "worker-complete" },
  });
}

/** Worker failure signal: running → failed (lease-fenced). */
export async function failClaimedNode(
  runId: number,
  nodeKey: string,
  leaseToken: string,
  reason: string,
): Promise<void> {
  const ok = await guardedNodeUpdate(runId, nodeKey, leaseToken, ["claimed", "running"], {
    state: "failed",
    endedAt: new Date(),
    leaseToken: null,
    leaseWorkerId: null,
    leaseExpiresAt: null,
    heartbeatAt: null,
  });
  if (!ok) throw new FenceError("failure rejected: lease fenced or node not active");
  await appendEvent(runId, {
    type: "node_state",
    actor: "worker",
    nodeKey,
    payload: { state: "failed", reason: reason.slice(0, 500) },
  });
}

// ── Owner / director overrides ───────────────────────────────────

/** Director/manual assignment of a not-yet-claimed node. */
export async function assignNode(
  runId: number,
  nodeKey: string,
  workerId: number | null,
  by: string,
): Promise<void> {
  const db = getDb();
  const [res] = await db
    .update(runNodes)
    .set({ assignedWorkerId: workerId, version: sql`${runNodes.version} + 1` })
    .where(
      and(
        eq(runNodes.runId, runId),
        eq(runNodes.nodeKey, nodeKey),
        inArray(runNodes.state, ["pending", "ready", "waiting"]),
      ),
    );
  if (res.affectedRows !== 1) {
    throw new FenceError("node is not assignable (claimed, running, or terminal)");
  }
  await appendEvent(runId, {
    type: "node_reassigned",
    actor: "human",
    nodeKey,
    payload: { assignedWorkerId: workerId, by },
  });
}

/**
 * Owner reassign: fences any current lease (clears the token), returns the
 * node to ready, and retargets the assignment. Late completions from the
 * previous holder are fenced by the cleared token.
 */
export async function reassignNode(
  runId: number,
  nodeKey: string,
  workerId: number | null,
  by: string,
): Promise<void> {
  const db = getDb();
  const [res] = await db
    .update(runNodes)
    .set({
      state: "ready",
      assignedWorkerId: workerId,
      leaseToken: null,
      leaseWorkerId: null,
      leaseExpiresAt: null,
      heartbeatAt: null,
      waitReason: null,
      version: sql`${runNodes.version} + 1`,
    })
    .where(
      and(
        eq(runNodes.runId, runId),
        eq(runNodes.nodeKey, nodeKey),
        inArray(runNodes.state, ["ready", "claimed", "running", "waiting", "paused"]),
      ),
    );
  if (res.affectedRows !== 1) {
    throw new FenceError("node is not reassignable (pending or terminal)");
  }
  await appendEvent(runId, {
    type: "node_reassigned",
    actor: "human",
    nodeKey,
    payload: { assignedWorkerId: workerId, by, fencedPreviousLease: true },
  });
}

/**
 * Cancel a node (terminal) and propagate cancellation to every non-terminal
 * downstream node (BFS over spec.edges), fencing any leases on the way.
 */
export async function cancelNodeCascade(
  runId: number,
  nodeKey: string,
  by: string,
): Promise<string[]> {
  const db = getDb();
  const run = await db.query.runs.findFirst({ where: eq(runs.id, runId) });
  const revision = run
    ? await db.query.dagRevisions.findFirst({
        where: eq(dagRevisions.id, run.dagRevisionId),
      })
    : null;
  const spec = revision?.spec as DagSpec | undefined;
  const targets = new Set<string>([nodeKey]);
  if (spec) {
    let frontier = [nodeKey];
    while (frontier.length) {
      const next: string[] = [];
      for (const e of spec.edges) {
        if (frontier.includes(e.from) && !targets.has(e.to)) {
          targets.add(e.to);
          next.push(e.to);
        }
      }
      frontier = next;
    }
  }
  const cancelled: string[] = [];
  for (const key of targets) {
    const [res] = await db
      .update(runNodes)
      .set({
        state: "cancelled",
        endedAt: new Date(),
        leaseToken: null,
        leaseWorkerId: null,
        leaseExpiresAt: null,
        heartbeatAt: null,
        waitReason: null,
        version: sql`${runNodes.version} + 1`,
      })
      .where(
        and(
          eq(runNodes.runId, runId),
          eq(runNodes.nodeKey, key),
          notInArray(runNodes.state, [...TERMINAL_NODE_STATES]),
        ),
      );
    if (res.affectedRows === 1) {
      cancelled.push(key);
      await appendEvent(runId, {
        type: "node_state",
        actor: "human",
        nodeKey: key,
        payload: {
          state: "cancelled",
          by,
          reason: key === nodeKey ? "cancelled by owner" : `upstream ${nodeKey} cancelled`,
        },
      });
    }
  }
  if (!cancelled.includes(nodeKey)) {
    throw new FenceError("node is already terminal — nothing to cancel");
  }
  return cancelled;
}

// ── Lease sweeper (no busy waiting; interval-driven) ─────────────

export interface SweepResult {
  swept: number;
  recycled: string[];
  failed: string[];
}

/**
 * Recover expired leases: claimed/running nodes whose lease_expires_at has
 * passed recycle to `ready` while attempts remain (bounded recovery), else
 * `failed`. One audited event per row. Guarded by the token read, so a node
 * re-claimed between read and write is untouched.
 */
export async function sweepExpiredLeases(opts: {
  runId?: number;
  limit?: number;
} = {}): Promise<SweepResult> {
  const db = getDb();
  const limit = Math.min(opts.limit ?? 50, 200);
  const expired = await db
    .select()
    .from(runNodes)
    .where(
      and(
        inArray(runNodes.state, ["claimed", "running"]),
        sql`${runNodes.leaseExpiresAt} IS NOT NULL AND ${runNodes.leaseExpiresAt} < NOW(3)`,
        opts.runId ? eq(runNodes.runId, opts.runId) : sql`1=1`,
      ),
    )
    .limit(limit);

  const result: SweepResult = { swept: 0, recycled: [], failed: [] };
  for (const node of expired) {
    const recycle = node.attempts < NODE_MAX_ATTEMPTS;
    const [res] = await db
      .update(runNodes)
      .set({
        state: recycle ? "ready" : "failed",
        leaseToken: null,
        leaseWorkerId: null,
        leaseExpiresAt: null,
        heartbeatAt: null,
        ...(recycle ? {} : { endedAt: new Date() }),
        version: sql`${runNodes.version} + 1`,
      })
      .where(
        and(
          eq(runNodes.id, node.id),
          eq(runNodes.leaseToken, node.leaseToken ?? ""),
          inArray(runNodes.state, ["claimed", "running"]),
        ),
      );
    if (res.affectedRows !== 1) continue; // re-claimed or completed meanwhile
    result.swept += 1;
    (recycle ? result.recycled : result.failed).push(node.nodeKey);
    await appendEvent(node.runId, {
      type: "lease_expired",
      actor: "system",
      nodeKey: node.nodeKey,
      payload: {
        attempt: node.attempts,
        maxAttempts: NODE_MAX_ATTEMPTS,
        recycledTo: recycle ? "ready" : "failed",
        previousWorkerId: node.leaseWorkerId,
      },
    });
  }
  return result;
}

/** Runs that can make progress without any human action. */
export async function listAdvanceableRuns(limit = 25): Promise<number[]> {
  const db = getDb();
  const rows = await db
    .select({ id: runs.id })
    .from(runs)
    .where(inArray(runs.state, ["queued", "running"]))
    .limit(Math.min(limit, 100));
  return rows.map((r) => r.id);
}

/** Project of a run (ownership scoping for control endpoints). */
export async function getRunProject(runId: number) {
  const db = getDb();
  const run = await db.query.runs.findFirst({ where: eq(runs.id, runId) });
  if (!run) return null;
  const project = await db.query.projects.findFirst({
    where: eq(projects.id, run.projectId),
  });
  return project ? { run, project } : null;
}
