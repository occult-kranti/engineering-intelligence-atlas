import type { DagSpec, NodeSpec, RunBudget } from "@contracts/dag";
import type { AutonomyGrant, GoalMode } from "@contracts/office";
import type {
  ApprovalKind,
  AssignmentMode,
  ProviderId,
  RunNodeState,
  RunState,
  WaitReason,
  WorkerKind,
  WorkerStatus,
} from "@contracts/run";
import { TERMINAL_RUN_STATES } from "@contracts/run";
import { usdToMicros } from "@contracts/dag";

/**
 * Director workspace data adapter.
 *
 * The workspace UI never talks to tRPC directly: it consumes the shapes in
 * this module. Today's implementation (`useWorkspaceData.ts`) derives every
 * shape from the *existing* endpoints (projects, dag revisions, runs,
 * approvals, ledger, events, artifacts). The forthcoming workQueue backend
 * (roadmap snapshot + pool/queue/lease controls) only has to produce the
 * same interfaces — see `DirectorControlPlane` at the bottom — and the UI
 * will light up without changes. Until then, every control-plane surface
 * carries an explicit `Availability` envelope so the UI can render an honest
 * "control data unavailable" state instead of pretending.
 */

/** Availability envelope: data is either live or honestly unavailable. */
export type Availability<T> =
  | { status: "live"; data: T }
  | { status: "unavailable"; reason: string };

export const unavailable = <T,>(reason: string): Availability<T> => ({
  status: "unavailable",
  reason,
});

export const live = <T,>(data: T): Availability<T> => ({
  status: "live",
  data,
});

// ── Minimal structural inputs (decoupled from server row types) ──

export interface ProjectLike {
  id: number;
  name: string;
  goal: string;
  riskTier: "low" | "medium" | "high" | string;
  status: string;
  createdAt: Date | string;
}

export interface DagRevisionLike {
  id: number;
  revision: number;
  planHash: string;
  approvedAt: Date | string | null;
  spec: DagSpec;
}

export interface RunLike {
  id: number;
  projectId: number;
  mode: "mock" | "live" | string;
  provider: string;
  model: string | null;
  state: RunState;
  budget: RunBudget;
  endReason: string | null;
  startedAt: Date | string;
}

export interface RunNodeLike {
  nodeKey: string;
  state: RunNodeState;
  attempts: number;
  startedAt?: Date | string | null;
  endedAt?: Date | string | null;
  /** Control-plane (Revision A) metadata, present when the row comes from
   * control.roadmapStatus; absent on legacy runs.get rows. */
  assignedWorkerId?: number | null;
  assignmentMode?: AssignmentMode | string | null;
  waitReason?: WaitReason | string | null;
  leaseWorkerId?: number | null;
  /** Optimistic-concurrency guard; required for cancel(expectedVersion). */
  version?: number;
}

export interface ApprovalLike {
  id: number;
  runId: number;
  nodeKey: string | null;
  kind: ApprovalKind | string;
  payload: unknown;
  createdAt?: Date | string;
}

export interface ProviderLike {
  id: string;
  configured: boolean;
  reason?: string | null;
}

export interface ArtifactLike {
  id: number;
  nodeKey: string;
  kind: string;
  title: string;
  storageError: string | null;
  storageKey?: string | null;
  contentSha256: string | null;
  summary?: string | null;
  accepted: boolean;
  acceptance?: { ok: boolean } | null;
}

export interface EventLike {
  seq: number;
  type: string;
  nodeKey: string | null;
  actor: string;
  payload: unknown;
  /** Server-side timestamp (run_events.created_at) when available. */
  createdAt?: Date | string | null;
}

/** Run usage as returned by runs.get (ledger rollup + elapsed wall time). */
export interface UsageLike {
  promptTokens: number;
  completionTokens: number;
  calls: number;
  costUsdMicros: number;
  elapsedMinutes: number;
  simulated?: boolean;
}

// ── Lease / queue / pool (forthcoming workQueue surface) ──

/** A worker lease with heartbeat, per the stale-agent contract. */
export interface LeaseStatus {
  holder: string;
  heartbeatAgeSec: number;
  expiresInSec: number;
  stale: boolean;
}

/** Dependency rollup for one queue row (incoming plan edges). */
export interface DependencyStatus {
  total: number;
  unmet: number;
  unmetKeys: string[];
}

/** One row of the ownership/queue table. */
export interface QueueRow {
  nodeKey: string;
  /** Owning role from the approved plan; null when unplanned. */
  ownerRole: string | null;
  /** Pinned skill as `name@version`; null when unplanned. */
  skillPin: string | null;
  skillSha: string | null;
  state: RunNodeState | "unscheduled";
  /** Human-readable blocker, e.g. "awaits 2 inputs" or "awaiting you". */
  blockedReason: string | null;
  attempts: number;
  /** True when this row is a human gate owned by the project owner. */
  awaitingHuman: boolean;
  /** Lease/heartbeat — live from control.roadmapStatus when available. */
  lease: Availability<LeaseStatus>;
  /** OCC version (expectedVersion for cancellation). */
  version: number;
  /** Director/manual assignment target; null = unassigned/self-claimable. */
  assignedWorkerId: number | null;
  assignedWorkerName: string | null;
  assignmentMode: string | null;
  /** Why a `waiting` node waits (dependency / approval / event). */
  waitReason: string | null;
  dependencies: DependencyStatus;
}

export interface QueueSnapshot {
  runId: number;
  rows: QueueRow[];
  counts: { running: number; blocked: number; awaitingHuman: number; done: number };
}

// ── Worker pool (control.workers + control.pool.status) ──

/** Minimal worker shape (structural; matches the workers table row). */
export interface WorkerLike {
  id: number;
  name: string;
  kind: WorkerKind | string;
  role: string;
  capabilities: string[];
  skillRefs: { name: string; version: string }[];
  status: WorkerStatus | string;
  maxConcurrentClaims: number;
  leaseTtlSeconds: number;
  lastSeenAt: Date | string;
}

/** Why a worker cannot claim a specific ready node right now. */
export interface EligibilityFailure {
  nodeKey: string;
  /** Stable reason code (mirrors the server's checkWorkerEligibility). */
  reason: string;
  /** Human-readable label. */
  label: string;
}

/** One worker in the pool panel: capacity, heartbeat staleness, claims. */
export interface WorkerView {
  id: number;
  name: string;
  /** `#3 researcher` */
  label: string;
  kind: string;
  role: string;
  status: string;
  suspended: boolean;
  isDirector: boolean;
  maxConcurrentClaims: number;
  leaseTtlSeconds: number;
  /** Currently held claims (claimed/running nodes leased to this worker). */
  activeClaims: number;
  claimedNodeKeys: string[];
  atCapacity: boolean;
  /** Seconds since lastSeenAt; -1 before the first clock tick. */
  lastSeenAgeSec: number;
  /** Heartbeat older than the worker's lease TTL → presumed stale. */
  stale: boolean;
  /** Ready nodes this worker cannot claim, with reasons. */
  eligibilityFailures: EligibilityFailure[];
  /** Ready nodes this worker could claim right now. */
  claimableNodeKeys: string[];
}

/** Worker pool status from control.pool.status, adapted for the deck. */
export interface PoolStatus {
  paused: boolean;
  activeRuns: { id: number; state: string }[];
  workers: WorkerView[];
}

/**
 * Result of a control mutation. Errors are classified, never thrown across
 * the UI boundary and never faked: `ok:false` carries the operator hint.
 * (ControlError is declared below, in the classification section.)
 */
export type ControlActionResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: ControlError };

/** Pool controls (control.pool.* + control.pump/sweep). Optional: the UI
 * renders an honest "unavailable" state when absent. Every control is a
 * real mutation — no fake success. */
export interface PoolControls {
  /** Seed the director worker and nudge all advanceable runs. */
  startPool(): Promise<ControlActionResult<{ directorWorkerId: number; advancing: number }>>;
  pausePool(): Promise<ControlActionResult<{ paused: number }>>;
  resumePool(): Promise<ControlActionResult<{ resumed: number }>>;
  /** Emergency stop: halts every active run of the project. */
  stopPool(): Promise<ControlActionResult<{ stopped: number }>>;
  /** One-step claim + dispatch on the active run (fenced path).
   * `pumped:null` means nothing was eligible right now — not an error. */
  pumpOnce(
    workerId?: number,
  ): Promise<ControlActionResult<{ pumped: { nodeKey: string; attempt: number } | null }>>;
  /** Run-scoped sweeper: expired leases are re-queued server-side. */
  sweepExpiredLeases(): Promise<
    ControlActionResult<{ swept: number; recycled: string[]; failed: string[] }>
  >;
}

/** Worker pool membership controls (control.workers.*). */
export interface WorkerControls {
  register(input: {
    name: string;
    kind: WorkerKind;
    role: string;
    capabilities: string[];
    maxConcurrentClaims: number;
    leaseTtlSeconds?: number;
  }): Promise<ControlActionResult<{ workerId: number }>>;
  setStatus(
    workerId: number,
    status: WorkerStatus,
  ): Promise<ControlActionResult<{ ok: boolean }>>;
  setCapacity(
    workerId: number,
    maxConcurrentClaims: number,
    leaseTtlSeconds?: number,
  ): Promise<ControlActionResult<{ ok: boolean }>>;
}

/** Node-level owner controls (control.assign/reassign/cancel). */
export interface NodeControls {
  assign(input: {
    nodeKey: string;
    workerId: number | null;
    assignmentMode?: AssignmentMode;
  }): Promise<ControlActionResult<{ ok: boolean }>>;
  reassign(input: {
    nodeKey: string;
    workerId: number | null;
  }): Promise<ControlActionResult<{ ok: boolean }>>;
  /** Terminal; propagates downstream. expectedVersion is the OCC guard. */
  cancel(input: {
    nodeKey: string;
    expectedVersion?: number;
  }): Promise<ControlActionResult<{ cancelled: string[] }>>;
}

/** Roadmap snapshot — the shape the forthcoming snapshot endpoint returns.
 * Today it is derived client-side from `dag.revisions`. */
export interface RoadmapSnapshot {
  revisionId: number | null;
  revision: number | null;
  approved: boolean;
  planHash: string | null;
  nodeCount: number;
  edgeCount: number;
  spec: DagSpec | null;
}

/**
 * The seam for the forthcoming workQueue backend. `useWorkspaceData` returns
 * an object with this shape backed by the legacy endpoints; a future
 * `createWorkQueueAdapter()` can implement the same interface against the
 * new snapshot/pool endpoints without touching any component.
 */
export interface DirectorControlPlane {
  queue: Availability<QueueSnapshot> | null;
  pool: Availability<PoolStatus>;
  /** Pool mutation surface; null when the control router is unreachable. */
  controls: PoolControls | null;
  /** Worker membership mutations; null when the control router is unreachable. */
  workerControls: WorkerControls | null;
  /** Node assignment/cancellation mutations; null without an active run. */
  nodeControls: NodeControls | null;
}

// ── Pure derivations (unit-tested) ──

/** Compute a LeaseStatus from the workQueue lease feed (roadmapStatus). */
export function leaseStatusFrom(
  holder: string,
  heartbeatAt: Date | string | null,
  leaseExpiresAt: Date | string | null,
  now: number,
): LeaseStatus {
  const hb = heartbeatAt ? new Date(heartbeatAt).getTime() : null;
  const exp = leaseExpiresAt ? new Date(leaseExpiresAt).getTime() : null;
  return {
    holder,
    heartbeatAgeSec: hb != null ? Math.max(0, Math.round((now - hb) / 1000)) : -1,
    expiresInSec: exp != null ? Math.round((exp - now) / 1000) : -1,
    stale: exp != null ? exp < now : false,
  };
}

/** Lease status of the project's director worker (from pool.status). */
export function directorLeaseFrom(
  worker: { name: string; lastSeenAt: Date | string; leaseTtlSeconds: number } | null,
  now: number,
): Availability<LeaseStatus> {
  if (!worker) {
    return unavailable(
      "no director worker is registered for this project yet (the pool seeds one on start)",
    );
  }
  const seen = new Date(worker.lastSeenAt).getTime();
  const ageSec = Math.max(0, Math.round((now - seen) / 1000));
  return live({
    holder: worker.name,
    heartbeatAgeSec: ageSec,
    expiresInSec: worker.leaseTtlSeconds - ageSec,
    stale: ageSec > worker.leaseTtlSeconds,
  });
}

const noLease = () =>
  unavailable<LeaseStatus>("lease/heartbeat endpoints are not exposed yet");

/** Human gates are plan nodes with an approval gate or a pending approval. */
export function deriveQueueRows(
  nodes: RunNodeLike[],
  spec: DagSpec | null,
  pendingApprovals: ApprovalLike[],
  leaseFor: (nodeKey: string) => Availability<LeaseStatus> = noLease,
  opts: { workerName?: (id: number) => string | undefined } = {},
): QueueRow[] {
  const specNodes = new Map((spec?.nodes ?? []).map((n) => [n.key, n]));
  const approvalByNode = new Map(
    pendingApprovals.filter((a) => a.nodeKey).map((a) => [a.nodeKey as string, a]),
  );
  const satisfied = new Set(
    nodes
      .filter((n) => n.state === "accepted" || n.state === "skipped")
      .map((n) => n.nodeKey),
  );
  const incoming = (key: string) => (spec?.edges ?? []).filter((e) => e.to === key);
  const dependenciesFor = (key: string): DependencyStatus => {
    const edges = incoming(key);
    const unmetKeys = edges.filter((e) => !satisfied.has(e.from)).map((e) => e.from);
    return { total: edges.length, unmet: unmetKeys.length, unmetKeys };
  };
  const assignmentOf = (n: RunNodeLike) => {
    const id = n.assignedWorkerId ?? null;
    return {
      assignedWorkerId: id,
      assignedWorkerName:
        id != null ? (opts.workerName?.(id) ?? `worker #${id}`) : null,
      assignmentMode: n.assignmentMode ?? null,
    };
  };

  const rows: QueueRow[] = [];
  const seen = new Set<string>();

  for (const n of nodes) {
    seen.add(n.nodeKey);
    const specNode = specNodes.get(n.nodeKey);
    const approval = approvalByNode.get(n.nodeKey);
    const dependencies = dependenciesFor(n.nodeKey);
    const waitReason = n.waitReason ?? null;
    let blockedReason: string | null = null;
    if (approval) {
      blockedReason = "awaiting you";
    } else if (n.state === "waiting" && waitReason) {
      blockedReason =
        waitReason === "approval"
          ? "waiting on approval"
          : waitReason === "event"
            ? "waiting on event"
            : dependencies.unmet > 0
              ? `waiting on ${dependencies.unmet === 1 ? dependencies.unmetKeys[0] : `${dependencies.unmet} dependencies`}`
              : "waiting on dependencies";
    } else if (n.state === "pending" || n.state === "ready") {
      if (dependencies.unmet > 0) {
        blockedReason =
          dependencies.unmet === 1 ? "awaits 1 input" : `awaits ${dependencies.unmet} inputs`;
      } else if (!specNode) {
        blockedReason = "not in current plan";
      }
    }
    rows.push({
      nodeKey: n.nodeKey,
      ownerRole: approval ? "Owner (you)" : (specNode?.role ?? null),
      skillPin: specNode ? `${specNode.skill.name}@${specNode.skill.version}` : null,
      skillSha: specNode?.skill.sha256 ?? null,
      state: n.state,
      blockedReason,
      attempts: n.attempts,
      awaitingHuman: !!approval,
      lease: leaseFor(n.nodeKey),
      version: n.version ?? 1,
      ...assignmentOf(n),
      waitReason,
      dependencies,
    });
  }

  // Planned nodes that never made it into the run (unscheduled).
  for (const [key, specNode] of specNodes) {
    if (seen.has(key)) continue;
    rows.push({
      nodeKey: key,
      ownerRole: specNode.role,
      skillPin: `${specNode.skill.name}@${specNode.skill.version}`,
      skillSha: specNode.skill.sha256,
      state: "unscheduled",
      blockedReason: "not part of this run",
      attempts: 0,
      awaitingHuman: false,
      lease: leaseFor(key),
      version: 1,
      assignedWorkerId: null,
      assignedWorkerName: null,
      assignmentMode: null,
      waitReason: null,
      dependencies: dependenciesFor(key),
    });
  }
  return rows;
}

export function summarizeQueue(rows: QueueRow[]): QueueSnapshot["counts"] {
  let running = 0;
  let blocked = 0;
  let awaitingHuman = 0;
  let done = 0;
  for (const r of rows) {
    if (r.awaitingHuman) awaitingHuman += 1;
    else if (r.state === "running" || r.state === "verifying") running += 1;
    else if (r.blockedReason) blocked += 1;
    else if (r.state === "accepted" || r.state === "skipped") done += 1;
  }
  return { running, blocked, awaitingHuman, done };
}

// ── Worker eligibility + pool views (pure; mirrors the server) ──

/** Stable, human-readable labels for eligibility failure codes. */
export const ELIGIBILITY_REASON_LABELS: Record<string, string> = {
  worker_suspended: "worker suspended",
  dependencies_unmet: "dependencies unmet",
  awaiting_start_approval: "awaiting start approval",
  role_mismatch: "role mismatch",
  skill_pin_mismatch: "skill pin mismatch",
  capability_mismatch: "missing allowed-tool capability",
  assigned_to_another_worker: "assigned to another worker",
  director_mode_only: "director-assigned, not self-claimable",
};

export function eligibilityLabel(code: string): string {
  return ELIGIBILITY_REASON_LABELS[code] ?? code.replaceAll("_", " ");
}

/**
 * Client-side mirror of the server's `checkWorkerEligibility` +
 * claim-candidate gating (control-plane.ts). Returns null when the worker
 * may claim the node, else a stable reason code. Display-only: the CAS on
 * the server remains the arbiter — this explains, it never authorizes.
 */
export function explainEligibility(
  worker: Pick<WorkerLike, "kind" | "role" | "capabilities" | "skillRefs" | "status">,
  node: NodeSpec,
  opts: {
    depsAccepted: boolean;
    startApproved: boolean;
    assignedWorkerId?: number | null;
    assignmentMode?: string | null;
    workerId?: number;
  },
): string | null {
  if (worker.status !== "active") return "worker_suspended";
  if (!opts.depsAccepted) return "dependencies_unmet";
  if (node.approvalBefore === "start" && !opts.startApproved) {
    return "awaiting_start_approval";
  }
  const isDirector = worker.kind === "director";
  // A node pinned to a specific worker is only claimable by that worker
  // (the director is the fallback executor and may always take it).
  if (
    opts.assignedWorkerId != null &&
    opts.assignedWorkerId !== opts.workerId &&
    !isDirector
  ) {
    return "assigned_to_another_worker";
  }
  if (
    !isDirector &&
    opts.assignmentMode === "director" &&
    opts.assignedWorkerId !== opts.workerId
  ) {
    return "director_mode_only";
  }
  if (isDirector) return null; // worker 0 delegates to the pinned skill
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

/**
 * Adapt the raw worker pool + run nodes into per-worker views: capacity
 * (active claims vs max), heartbeat staleness, and per-ready-node
 * eligibility failures. Pure — unit-tested without any tRPC mock.
 */
export function deriveWorkerViews(
  workers: WorkerLike[],
  nodes: RunNodeLike[],
  spec: DagSpec | null,
  opts: {
    now?: number;
    /** Node keys with a *pending* start approval (kind "plan"). */
    pendingStartApprovals?: ReadonlySet<string>;
  } = {},
): WorkerView[] {
  const now = opts.now ?? 0;
  const pendingStart = opts.pendingStartApprovals ?? new Set<string>();
  const specNodes = new Map((spec?.nodes ?? []).map((n) => [n.key, n]));
  const stateByKey = new Map(nodes.map((n) => [n.nodeKey, n.state]));
  const readyNodes = nodes.filter((n) => n.state === "ready");
  const depsAccepted = (key: string) =>
    (spec?.edges ?? [])
      .filter((e) => e.to === key)
      .every((e) => stateByKey.get(e.from) === "accepted");

  return workers.map((w) => {
    const claimedNodeKeys = nodes
      .filter(
        (n) =>
          (n.state === "claimed" || n.state === "running") && n.leaseWorkerId === w.id,
      )
      .map((n) => n.nodeKey);
    const seen = new Date(w.lastSeenAt).getTime();
    const lastSeenAgeSec =
      now > 0 && Number.isFinite(seen) ? Math.max(0, Math.round((now - seen) / 1000)) : -1;
    const eligibilityFailures: EligibilityFailure[] = [];
    const claimableNodeKeys: string[] = [];
    for (const rn of readyNodes) {
      const specNode = specNodes.get(rn.nodeKey);
      if (!specNode) continue; // not in current plan — nothing to explain
      const reason = explainEligibility(w, specNode, {
        depsAccepted: depsAccepted(rn.nodeKey),
        startApproved: !pendingStart.has(rn.nodeKey),
        assignedWorkerId: rn.assignedWorkerId ?? null,
        assignmentMode: rn.assignmentMode ?? null,
        workerId: w.id,
      });
      if (reason) {
        eligibilityFailures.push({
          nodeKey: rn.nodeKey,
          reason,
          label: eligibilityLabel(reason),
        });
      } else {
        claimableNodeKeys.push(rn.nodeKey);
      }
    }
    return {
      id: w.id,
      name: w.name,
      label: `#${w.id} ${w.name}`,
      kind: w.kind,
      role: w.role,
      status: w.status,
      suspended: w.status !== "active",
      isDirector: w.kind === "director",
      maxConcurrentClaims: w.maxConcurrentClaims,
      leaseTtlSeconds: w.leaseTtlSeconds,
      activeClaims: claimedNodeKeys.length,
      claimedNodeKeys,
      atCapacity: claimedNodeKeys.length >= w.maxConcurrentClaims,
      lastSeenAgeSec,
      stale: lastSeenAgeSec >= 0 && lastSeenAgeSec > w.leaseTtlSeconds,
      eligibilityFailures,
      claimableNodeKeys,
    };
  });
}

// ── Control-error classification (recoverable, never fake) ──

export type ControlErrorKind =
  /** 409 — CAS/claim lost, fenced lease, or expectedVersion mismatch. */
  | "conflict"
  /** The lease token lost the fence (expired/reassigned/swept). */
  | "stale-lease"
  /** The run/pool is paused — resume before dispatching. */
  | "paused"
  /** Run or node is terminal — nothing to do. */
  | "terminal"
  /** Ownership/scope violation. */
  | "forbidden"
  | "unknown";

export interface ControlError {
  kind: ControlErrorKind;
  message: string;
  /** True when a refresh + deliberate retry can succeed. */
  recoverable: boolean;
  /** One-line operator guidance. */
  hint: string;
}

/**
 * Classify a tRPC/control-plane failure into an operator-actionable shape.
 * Handles TRPCClientError-like objects ({ data: { code, httpStatus } }) and
 * plain Errors; the server's FenceError maps to CONFLICT (409).
 */
export function classifyControlError(err: unknown): ControlError {
  const e = err as {
    message?: string;
    data?: { code?: string; httpStatus?: number };
    shape?: { code?: number };
  } | null;
  const message = e?.message ?? String(err);
  const code = e?.data?.code;
  const http = e?.data?.httpStatus;
  const lower = message.toLowerCase();

  if (code === "CONFLICT" || http === 409) {
    if (lower.includes("version_conflict")) {
      return {
        kind: "conflict",
        message,
        recoverable: true,
        hint: "The node changed since you loaded it — the view has been refreshed; review and retry deliberately.",
      };
    }
    if (lower.includes("fenc") || lower.includes("lease")) {
      return {
        kind: "stale-lease",
        message,
        recoverable: true,
        hint: "The lease was fenced (expired, reassigned, or swept). Refresh shows the current holder; reclaim or reassign explicitly.",
      };
    }
    return {
      kind: "conflict",
      message,
      recoverable: true,
      hint: "Another actor won the race (409). The view has been refreshed — retry only if it still makes sense.",
    };
  }
  if (lower.includes("paused")) {
    return {
      kind: "paused",
      message,
      recoverable: true,
      hint: "Dispatch is paused. Resume the pool (or the run) and retry.",
    };
  }
  if (lower.includes("terminal") || lower.includes("already terminal")) {
    return {
      kind: "terminal",
      message,
      recoverable: false,
      hint: "The run or node is terminal — this control no longer applies.",
    };
  }
  if (code === "FORBIDDEN" || http === 403) {
    return {
      kind: "forbidden",
      message,
      recoverable: false,
      hint: "You do not own this resource — check the project and worker scope.",
    };
  }
  return {
    kind: "unknown",
    message,
    recoverable: true,
    hint: "The action failed. Nothing was faked — refresh and retry deliberately.",
  };
}

// ── Idempotency keys ──

/**
 * Client-generated idempotency key for control mutations (≤128 chars).
 * crypto.randomUUID when available; a timestamp/counter fallback otherwise
 * (keys only need per-owner uniqueness — the server stores verbatim
 * replays).
 */
let idemCounter = 0;
export function newIdempotencyKey(scope: string): string {
  const rand =
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now().toString(36)}-${(idemCounter += 1).toString(36)}-${Math.random()
      .toString(36)
      .slice(2, 10)}`;
  return `dw:${scope}:${rand}`.slice(0, 128);
}

// ── Run start payloads (autonomy grant + goal mode wiring) ──

/**
 * Build a runs.start payload. Two live-wiring rules the UI must not
 * reimplement ad hoc:
 *  - goalMode is ALWAYS included (explore/build/evaluate/operate; default
 *    "build" is the explicit no-op preset);
 *  - autonomyGrantId is included iff the project's ACTIVE grant is
 *    PROJECT-scoped. A run-scoped grant is bound to one specific run and
 *    must never be passed to a different new run (the server would reject
 *    it — but the UI simply omits it).
 */
export function buildRunStartInput(args: {
  projectId: number;
  dagRevisionId: number;
  mode: "mock" | "live";
  provider: ProviderId;
  goalMode: GoalMode;
  activeGrant: Pick<AutonomyGrant, "id" | "scope"> | null;
  confirmLive?: boolean;
}): {
  projectId: number;
  dagRevisionId: number;
  mode: "mock" | "live";
  provider: ProviderId;
  goalMode: GoalMode;
  autonomyGrantId?: number;
  confirmLive?: boolean;
} {
  return {
    projectId: args.projectId,
    dagRevisionId: args.dagRevisionId,
    mode: args.mode,
    provider: args.provider,
    goalMode: args.goalMode,
    ...(args.activeGrant && args.activeGrant.scope === "project"
      ? { autonomyGrantId: args.activeGrant.id }
      : {}),
    ...(args.confirmLive !== undefined ? { confirmLive: args.confirmLive } : {}),
  };
}

// ── Flow stepper ──

export type StageId = "goal" | "roadmap" | "queue" | "control" | "evidence";

export const STAGES: { id: StageId; num: string; name: string }[] = [
  { id: "goal", num: "01", name: "Goal" },
  { id: "roadmap", num: "02", name: "Roadmap & squad" },
  { id: "queue", num: "03", name: "Task queue & ownership" },
  { id: "control", num: "04", name: "Live control & approvals" },
  { id: "evidence", num: "05", name: "Artifacts & evaluation" },
];

export interface StageStatus {
  id: StageId;
  /** one-line live status shown under the stage name */
  sub: string;
  /** stage needs the owner's attention (mustard rule) */
  attention: boolean;
}

export interface StageInput {
  project: ProjectLike | null;
  roadmap: RoadmapSnapshot;
  activeRun: RunLike | null;
  queueCounts: QueueSnapshot["counts"] | null;
  pendingApprovals: number;
  artifacts: { total: number; reviewed: number; storageErrors: number } | null;
  budgetUsedPct: number | null;
}

export function deriveStageStatuses(input: StageInput): StageStatus[] {
  const { roadmap, activeRun, queueCounts, pendingApprovals, artifacts, budgetUsedPct } =
    input;
  const runBits: string[] = [];
  if (queueCounts) {
    if (queueCounts.running) runBits.push(`${queueCounts.running} running`);
    if (queueCounts.blocked) runBits.push(`${queueCounts.blocked} blocked`);
    if (queueCounts.awaitingHuman)
      runBits.push(`${queueCounts.awaitingHuman} awaiting you`);
  }
  return [
    {
      id: "goal",
      sub: input.project
        ? `risk ${input.project.riskTier} · ${input.project.status}`
        : "no project loaded",
      attention: false,
    },
    {
      id: "roadmap",
      sub: roadmap.spec
        ? `plan rev ${roadmap.revision ?? "—"} · ${roadmap.approved ? "approved" : "not approved"} · ${roadmap.nodeCount} nodes`
        : "no plan revision yet",
      attention: !!roadmap.spec && !roadmap.approved,
    },
    {
      id: "queue",
      sub: queueCounts
        ? runBits.length
          ? runBits.join(" · ")
          : "queue idle"
        : activeRun
          ? "no node states yet"
          : "no run started",
      attention: !!queueCounts && queueCounts.blocked > 0,
    },
    {
      id: "control",
      sub: activeRun
        ? `${pendingApprovals ? `${pendingApprovals} approval${pendingApprovals === 1 ? "" : "s"} pending` : `run #${activeRun.id} ${activeRun.state}`}${budgetUsedPct != null ? ` · budget ${budgetUsedPct}% used` : ""}`
        : "no run to control",
      attention: pendingApprovals > 0,
    },
    {
      id: "evidence",
      sub: artifacts
        ? `${artifacts.total} artifact${artifacts.total === 1 ? "" : "s"} · ${artifacts.reviewed} reviewed${artifacts.storageErrors ? ` · ${artifacts.storageErrors} storage error${artifacts.storageErrors === 1 ? "" : "s"}` : ""}`
        : "nothing produced yet",
      attention: !!artifacts && artifacts.storageErrors > 0,
    },
  ];
}

// ── Budget meters ──

export interface MeterDatum {
  key: "tokens" | "calls" | "minutes" | "usd";
  label: string;
  used: number;
  max: number;
  pct: number;
  exhausted: boolean;
  display: string;
}

const fmtInt = (v: number) =>
  v >= 1000 ? `${(v / 1000).toFixed(v >= 100_000 ? 0 : 1)}k` : `${Math.round(v)}`;

export function deriveMeters(
  usage: UsageLike,
  budget: RunBudget,
  mode: string,
): MeterDatum[] {
  const usdLabel = mode === "mock" ? "USD (simulated)" : "USD (live rates)";
  const mk = (
    key: MeterDatum["key"],
    label: string,
    used: number,
    max: number,
    display: string,
  ): MeterDatum => ({
    key,
    label,
    used,
    max,
    pct: Math.min(100, Math.round((used / Math.max(max, 1e-9)) * 100)),
    exhausted: used >= max,
    display,
  });
  return [
    mk(
      "tokens",
      "tokens",
      usage.promptTokens + usage.completionTokens,
      budget.maxTokens,
      `${fmtInt(usage.promptTokens + usage.completionTokens)} / ${fmtInt(budget.maxTokens)}`,
    ),
    mk("calls", "calls", usage.calls, budget.maxCalls, `${usage.calls} / ${budget.maxCalls}`),
    mk(
      "minutes",
      "minutes",
      usage.elapsedMinutes,
      budget.maxMinutes,
      `${usage.elapsedMinutes.toFixed(1)} / ${budget.maxMinutes}`,
    ),
    mk(
      "usd",
      usdLabel,
      usage.costUsdMicros,
      usdToMicros(budget.maxCostUsd),
      `$${(usage.costUsdMicros / 1e6).toFixed(2)} / $${budget.maxCostUsd.toFixed(2)}`,
    ),
  ];
}

export function isBudgetExhausted(run: RunLike, usage: UsageLike | null): boolean {
  if (run.state === "stopped_budget") return true;
  if (!usage) return false;
  return (
    usage.calls >= run.budget.maxCalls ||
    usage.promptTokens + usage.completionTokens >= run.budget.maxTokens ||
    usage.elapsedMinutes >= run.budget.maxMinutes ||
    usage.costUsdMicros >= usdToMicros(run.budget.maxCostUsd)
  );
}

// ── Approvals ──

export interface ApprovalView {
  id: number;
  runId: number;
  nodeKey: string | null;
  kind: string;
  /** 3-line payload excerpt, never the primary reading for escalation kinds. */
  excerpt: string;
  /** Options advertised by the payload (e.g. retry/reassign/decompose). */
  options: string[];
}

export function toApprovalView(a: ApprovalLike): ApprovalView {
  const payload = (a.payload ?? {}) as Record<string, unknown>;
  const options = Array.isArray(payload.options)
    ? payload.options.filter((o): o is string => typeof o === "string")
    : [];
  let excerpt = "";
  try {
    excerpt = JSON.stringify(a.payload, null, 1).split("\n").slice(0, 3).join("\n");
  } catch {
    excerpt = String(a.payload);
  }
  return {
    id: a.id,
    runId: a.runId,
    nodeKey: a.nodeKey,
    kind: a.kind,
    excerpt,
    options,
  };
}

// ── Event stream honesty ──

export type StreamHealth =
  | { kind: "waiting" } // no events yet
  | { kind: "flowing"; lastEventAgeSec: number }
  | { kind: "stale"; lastEventAgeSec: number }; // run active but no fresh events

export function streamHealth(
  events: EventLike[],
  runState: RunState | null,
  lastEventAt: number | null,
  now: number,
  staleAfterSec = 30,
): StreamHealth {
  if (!events.length || lastEventAt == null) return { kind: "waiting" };
  const age = Math.max(0, Math.round((now - lastEventAt) / 1000));
  const active = runState != null && !TERMINAL_RUN_STATES.has(runState);
  if (active && age > staleAfterSec) return { kind: "stale", lastEventAgeSec: age };
  return { kind: "flowing", lastEventAgeSec: age };
}

// ── Provider chips ──

export interface ProviderChip {
  id: string;
  label: string;
  tone: "ok" | "muted" | "degraded";
}

export function providerChips(providers: ProviderLike[]): ProviderChip[] {
  return providers.map((p) => ({
    id: p.id,
    label:
      p.id === "mock"
        ? "mock · simulated ¢"
        : p.configured
          ? `${p.id} · live`
          : `${p.id} · unconfigured`,
    tone: p.id === "mock" ? "muted" : p.configured ? "ok" : "degraded",
  }));
}

/** Pick the run the workspace should control: explicit focus, else the
 * latest non-terminal run, else the most recent run at all. */
export function pickActiveRun(runs: RunLike[], focusRunId?: number): RunLike | null {
  if (!runs.length) return null;
  if (focusRunId != null) {
    const focused = runs.find((r) => r.id === focusRunId);
    if (focused) return focused;
  }
  return runs.find((r) => !TERMINAL_RUN_STATES.has(r.state)) ?? runs[0]!;
}
