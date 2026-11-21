import type { ClaimsPolicy, GoalModePreset } from "@contracts/office";
import {
  AUTONOMY_GRANT_TTL,
  GoalModePresetSchema,
  WB_MAX_OPS_PER_BATCH,
  type AutonomyGrant,
  type AutonomyMode,
  type GrantUsage,
  type WhiteboardOp,
} from "@contracts/office";
import { NodeKeySchema } from "@contracts/dag";
import type { RunNodeState } from "@contracts/run";
import type {
  AgentCard,
  DriftItem,
  OfficeBlueprintData,
  ReassignError,
  ReassignErrorCause,
  RoomState,
  WbEdge,
  WbNode,
  WhiteboardDoc,
} from "./model";
import type { LeaseStatus } from "../workspace/adapter";
import { live } from "../workspace/adapter";

/**
 * Live-data adapter (pure half): maps the real office/autonomy/whiteboard
 * router payloads onto the office view-model contracts in model.ts, builds
 * mutation plans (assign/reassign/release, whiteboard op diffs), and
 * classifies server errors verbatim. Every function here is deterministic
 * and unit-tested; the tRPC hooks (useOfficeData/useWhiteboardData) are the
 * only impure seam.
 */

// ── Structural mirrors of the router payloads (no tRPC import) ──

export interface OfficeRoomStatus {
  id: number;
  key: string;
  name: string;
  kind: string;
  capacity: number;
  eligibleRolePatterns: string[];
  budgets: {
    maxTokens: number;
    maxCalls: number;
    maxMinutes: number;
    maxCostUsd: number;
    maxStorageBytes: number;
  };
  version: number;
  occupancy: number;
  usage: {
    tokens: number;
    calls: number;
    minutes: number;
    costUsdMicros: number;
    storageBytes: number;
  };
  health: { level: string; reasons: string[] };
  seats: {
    assignmentId: number;
    workerId: number;
    runId: number | null;
    nodeKey: string | null;
    version: number;
  }[];
}

export interface OfficeStatusLike {
  blueprint: { id: number; revision: number; version: number } | null;
  rooms: OfficeRoomStatus[];
  permanentWorkers: { id: number; name: string; role: string; roomKey: string | null }[];
}

/** The workers row fields the office mapping needs (control pool rows). */
export interface OfficeWorkerLike {
  id: number;
  name: string;
  kind: string;
  role: string;
  capabilities: string[];
  skillRefs?: { name: string; version: string; sha256?: string | null }[];
  status: string;
  maxConcurrentClaims: number;
  leaseTtlSeconds: number;
  lastSeenAt: Date | string;
  roomKey?: string | null;
  version: number;
}

/** The run_nodes fields the office mapping needs (roadmapStatus rows). */
export interface OfficeNodeLike {
  nodeKey: string;
  state: string;
  attempts: number;
  leaseWorkerId?: number | null;
  assignedWorkerId?: number | null;
  roomKey?: string | null;
}

// ── Room presentation (presentational constants, by contract room kind) ──

export const ROOM_PRESENTATION: Record<string, { glyph: string; purpose: string }> = {
  "director-suite": { glyph: "▽", purpose: "Owner intent, approvals, and run control." },
  cartography: { glyph: "⌖", purpose: "Roadmap drafting, whiteboard alignment, drift." },
  "research-lab": { glyph: "⚗", purpose: "Research and analysis tasks." },
  studio: { glyph: "✎", purpose: "Writing and artifact production." },
  review: { glyph: "✓", purpose: "Verification, evaluation, and acceptance." },
  vault: { glyph: "▣", purpose: "Artifact and export storage." },
  ops: { glyph: "⚙", purpose: "Machine room — pool, sweeps, permanent system seats." },
};
const FALLBACK_PRESENTATION = { glyph: "◦", purpose: "Project room." };

const RUNNING_STATES = new Set(["claimed", "running", "verifying"]);
const BLOCKED_STATES = new Set(["waiting", "pending"]);

function workerLease(
  w: OfficeWorkerLike,
  now: number,
): { status: "live"; data: LeaseStatus } | { status: "unavailable"; reason: string } {
  const seen = new Date(w.lastSeenAt).getTime();
  const ageSec = Number.isFinite(seen) ? Math.max(0, Math.round((now - seen) / 1000)) : -1;
  return live({
    holder: w.name,
    heartbeatAgeSec: ageSec,
    expiresInSec: ageSec < 0 ? -1 : w.leaseTtlSeconds - ageSec,
    stale: ageSec >= 0 && ageSec > w.leaseTtlSeconds,
  });
}

function toAgentCard(
  w: OfficeWorkerLike,
  roomKey: string | null,
  nodes: OfficeNodeLike[],
  now: number,
): AgentCard {
  const mine = nodes.filter(
    (n) => n.leaseWorkerId === w.id && (n.state === "claimed" || n.state === "running"),
  );
  const queued = nodes.filter(
    (n) => n.assignedWorkerId === w.id && (n.state === "ready" || n.state === "pending"),
  );
  return {
    workerId: w.id,
    name: w.name,
    kind: w.kind as AgentCard["kind"],
    role: w.role,
    roomKey,
    status: w.status as AgentCard["status"],
    capabilities: w.capabilities ?? [],
    // Only content-hash-pinned skills are claimed as vetted; a pin without a
    // sha is shown as unvetted (the server re-checks on every claim anyway).
    skillPins: (w.skillRefs ?? []).map((p) => ({
      name: p.name,
      version: p.version,
      sha256: p.sha256 ?? "",
      vetted: typeof p.sha256 === "string" && p.sha256.length === 64,
    })),
    maxConcurrentClaims: w.maxConcurrentClaims,
    version: w.version,
    workload: { activeClaims: mine.length, queued: queued.length },
    lease: workerLease(w, now),
    currentTasks: mine.map((n) => ({
      nodeKey: n.nodeKey,
      state: n.state as RunNodeState,
      attempt: n.attempts,
    })),
  };
}

/**
 * Map office.status + control pool workers + active-run nodes onto the
 * blueprint view model. The director worker is the orchestrator, not office
 * staff, and never appears as an agent. Workers with a seat but no pool row
 * (e.g. removed mid-view) are skipped — never fabricated.
 */
export function mapOfficeStatus(
  status: OfficeStatusLike,
  workers: OfficeWorkerLike[],
  nodes: OfficeNodeLike[],
  opts: { now: number; runMode?: string | null; runBudgetUsdMicros?: number | null },
): OfficeBlueprintData {
  const workerById = new Map(workers.map((w) => [w.id, w]));
  const seatedWorkerIds = new Set<number>();
  const rooms: RoomState[] = status.rooms.map((room) => {
    const presentation = ROOM_PRESENTATION[room.kind] ?? FALLBACK_PRESENTATION;
    const agents: AgentCard[] = [];
    for (const seat of room.seats) {
      const w = workerById.get(seat.workerId);
      if (!w) continue;
      seatedWorkerIds.add(seat.workerId);
      agents.push(toAgentCard(w, room.key, nodes, opts.now));
    }
    const roomNodes = nodes.filter((n) => n.roomKey === room.key);
    return {
      roomKey: room.key,
      name: room.name,
      glyph: presentation.glyph,
      purpose: presentation.purpose,
      capacity: room.capacity,
      eligibleRolePatterns: room.eligibleRolePatterns,
      capabilitiesRequired: [], // the backend has no per-room capability gate
      agents,
      tasks: {
        running: roomNodes.filter((n) => RUNNING_STATES.has(n.state)).length,
        ready: roomNodes.filter((n) => n.state === "ready").length,
        blocked: roomNodes.filter((n) => BLOCKED_STATES.has(n.state)).length,
        failed: roomNodes.filter((n) => n.state === "failed").length,
      },
      compute: {
        allocTokens: room.budgets.maxTokens,
        usedTokens: room.usage.tokens,
        allocUsdMicros: Math.round(room.budgets.maxCostUsd * 1_000_000),
        usedUsdMicros: room.usage.costUsdMicros,
        simulated: opts.runMode === "mock",
      },
      storage: {
        allocMb: room.budgets.maxStorageBytes / 1_000_000,
        usedMb: room.usage.storageBytes / 1_000_000,
        artifactCount: 0, // per-room artifact counts are not metered server-side
        storageErrors: 0,
      },
      version: room.version,
    };
  });
  const bench = workers
    .filter((w) => w.kind !== "director" && !seatedWorkerIds.has(w.id) && !w.roomKey)
    .map((w) => toAgentCard(w, null, nodes, opts.now));
  const allocTotal = rooms.reduce((s, r) => s + r.compute.allocUsdMicros, 0);
  return {
    projectId: 0, // stamped by the caller (hook) — the status payload is scoped
    rooms,
    bench,
    runBudgetUsdMicros: opts.runBudgetUsdMicros ?? allocTotal,
    runningTasks: nodes.filter((n) => RUNNING_STATES.has(n.state)).length,
    updatedAt: new Date(opts.now).toISOString(),
  };
}

// ── Move planning (assign / reassign / release) ──

export type OfficeMovePlan =
  | { kind: "assign"; roomId: number; workerId: number; expectedVersion: number }
  | {
      kind: "reassign";
      toRoomId: number;
      workerId: number;
      expectedVersion: number;
      claimsPolicy?: ClaimsPolicy;
    }
  | { kind: "release"; assignmentId: number }
  | { kind: "error"; error: ReassignError };

const err = (cause: ReassignErrorCause, message: string): { kind: "error"; error: ReassignError } => ({
  kind: "error",
  error: { cause, message },
});

/**
 * Decide which real API call a ReassignInput maps to. Bench → room is
 * office.assign; room → room is office.reassign; room → bench is
 * office.release (which takes no claims policy — a claimed worker can only
 * move between rooms, so the bench option is refused honestly).
 */
export function planOfficeMove(
  agent: Pick<AgentCard, "workerId" | "roomKey" | "version" | "workload">,
  toRoomKey: string | null,
  claimsPolicy: ClaimsPolicy | undefined,
  rooms: Pick<OfficeRoomStatus, "id" | "key">[],
  seatAssignmentId: number | null,
): OfficeMovePlan {
  if (agent.workload.activeClaims > 0) {
    if (toRoomKey === null) {
      return err(
        "unavailable",
        `worker holds ${agent.workload.activeClaims} active claim(s) — releasing a seat mid-claim is not supported; reassign to another room with an explicit claims policy instead`,
      );
    }
    if (!claimsPolicy) {
      return err(
        "claims_policy_required",
        `worker holds ${agent.workload.activeClaims} active claim(s); choose drain or release-requeue`,
      );
    }
  }
  if (toRoomKey === null) {
    if (agent.roomKey == null) return err("ineligible", "worker is already on the bench");
    if (seatAssignmentId == null) {
      return err(
        "unavailable",
        "no active seat assignment found for this worker — refresh the office and retry",
      );
    }
    return { kind: "release", assignmentId: seatAssignmentId };
  }
  const room = rooms.find((r) => r.key === toRoomKey);
  if (!room) return err("unavailable", `room "${toRoomKey}" is not in the active blueprint`);
  if (agent.roomKey === toRoomKey) {
    return err("ineligible", "worker is already seated in that room");
  }
  if (agent.roomKey == null) {
    return {
      kind: "assign",
      roomId: room.id,
      workerId: agent.workerId,
      expectedVersion: agent.version,
    };
  }
  return {
    kind: "reassign",
    toRoomId: room.id,
    workerId: agent.workerId,
    expectedVersion: agent.version,
    claimsPolicy,
  };
}

/** Classify a failed assign/reassign/release call — server text verbatim. */
export function classifyReassignError(e: unknown): ReassignError {
  const message = (e as { message?: string })?.message ?? String(e);
  const lower = message.toLowerCase();
  let cause: ReassignErrorCause = "unavailable";
  if (lower.includes("version conflict")) cause = "version_conflict";
  else if (lower.includes("claimspolicy is required") || lower.includes("active claim")) {
    cause = "claims_policy_required";
  } else if (lower.includes("capacity")) cause = "room_at_capacity";
  else if (lower.includes("ineligible") || lower.includes("already seated")) cause = "ineligible";
  return { cause, message };
}

// ── Whiteboard mapping (backend vocab ⇄ view-model vocab) ──

export interface BackendWbNode {
  nodeKey: string;
  kind: string;
  content: string;
  position: { x: number; y: number };
  refRunId: number | null;
  refNodeKey: string | null;
  refArtifactId: number | null;
}

export interface BackendWbEdge {
  edgeKey: string;
  fromKey: string;
  toKey: string;
  kind: string;
}

export interface BackendWbDoc {
  nodes: BackendWbNode[];
  edges: BackendWbEdge[];
}

/** Content round-trip: title is the first line, body the remainder. */
export function splitContent(content: string): { title: string; body: string | undefined } {
  const idx = content.indexOf("\n");
  if (idx < 0) return { title: content, body: undefined };
  return { title: content.slice(0, idx), body: content.slice(idx + 1) || undefined };
}

export function composeContent(title: string, body: string | undefined): string {
  return body ? `${title}\n${body}` : title;
}

const NODE_KIND_TO_UI: Record<string, WbNode["kind"]> = {
  "run-node-ref": "task",
  section: "milestone",
  sticky: "note",
  text: "note",
  "artifact-ref": "note",
};
const NODE_KIND_TO_BACKEND: Record<WbNode["kind"], string> = {
  task: "run-node-ref",
  milestone: "section",
  note: "sticky",
};

/**
 * Ownership edges (an intent the backend schema has no payload for) are
 * encoded losslessly in the edge key: `own--<node>--r--<roomKey>` or
 * `own--<node>--w--<workerId>`, as a self-loop "link" edge. Double-dash
 * separators keep the parts unambiguous for kebab-case keys.
 */
export function encodeOwnershipEdgeKey(
  nodeId: string,
  ownership: NonNullable<WbEdge["ownership"]>,
): string | null {
  const raw =
    "roomKey" in ownership
      ? `own--${nodeId}--r--${ownership.roomKey}`
      : `own--${nodeId}--w--${ownership.workerId}`;
  const key = raw.slice(0, 64);
  return NodeKeySchema.safeParse(key).success ? key : null;
}

export function decodeOwnershipEdgeKey(edgeKey: string): WbEdge["ownership"] | undefined {
  const parts = edgeKey.split("--");
  if (parts.length !== 4 || parts[0] !== "own") return undefined;
  if (parts[2] === "r") return { roomKey: parts[3]! };
  if (parts[2] === "w") {
    const id = Number(parts[3]);
    return Number.isInteger(id) && id > 0 ? { workerId: id } : undefined;
  }
  return undefined;
}

/** Backend get payload → the whiteboard view model (lossless for unedited nodes). */
export function wbDocFromBackend(
  get: {
    projectId: number;
    revision: number;
    version: number;
    nodes: BackendWbNode[];
    edges: BackendWbEdge[];
    updatedAt?: Date | string | null;
  },
  ctx: { planHash: string | null; updatedBy: string },
): WhiteboardDoc {
  const nodes: WbNode[] = get.nodes.map((n) => {
    const { title, body } = splitContent(n.content);
    const kind = NODE_KIND_TO_UI[n.kind] ?? "note";
    return {
      id: n.nodeKey,
      kind,
      title: title || n.nodeKey,
      body,
      position: n.position,
      binding:
        kind === "task" && n.refNodeKey
          ? { dagNodeKey: n.refNodeKey, runId: n.refRunId }
          : undefined,
    };
  });
  const edges: WbEdge[] = get.edges.map((e) => {
    if (e.kind === "link") {
      const ownership = decodeOwnershipEdgeKey(e.edgeKey);
      if (ownership) {
        return { id: e.edgeKey, from: e.fromKey, to: e.toKey, kind: "ownership", ownership };
      }
    }
    return {
      id: e.edgeKey,
      from: e.fromKey,
      to: e.toKey,
      kind: e.kind === "flow" ? "dependency" : "note-link",
    };
  });
  return {
    projectId: get.projectId,
    revision: get.revision,
    version: get.version,
    nodes,
    edges,
    planHash: ctx.planHash,
    updatedAt: get.updatedAt ? new Date(get.updatedAt).toISOString() : "",
    updatedBy: ctx.updatedBy,
  };
}

export type WbOpsResult =
  | { ok: true; ops: WhiteboardOp[] }
  | { ok: false; message: string };

/**
 * Build the minimal applyOps batch that turns the baseline backend document
 * into the edited view-model doc. Unedited nodes reuse the baseline content
 * verbatim (the title/body split never rewrites content it didn't touch).
 */
export function wbOpsFromDiff(base: BackendWbDoc, doc: WhiteboardDoc): WbOpsResult {
  const ops: WhiteboardOp[] = [];
  const baseNodes = new Map(base.nodes.map((n) => [n.nodeKey, n]));
  const seen = new Set<string>();

  for (const n of doc.nodes) {
    if (!NodeKeySchema.safeParse(n.id).success) {
      return { ok: false, message: `whiteboard node id "${n.id}" is not a valid node key` };
    }
    seen.add(n.id);
    const baseNode = baseNodes.get(n.id);
    const kind = NODE_KIND_TO_BACKEND[n.kind];
    const refRunId = n.kind === "task" ? (n.binding?.runId ?? null) : null;
    const refNodeKey = n.kind === "task" ? (n.binding?.dagNodeKey ?? null) : null;
    if (!baseNode) {
      ops.push({
        op: "addNode",
        node: {
          nodeKey: n.id,
          kind: kind as never,
          content: composeContent(n.title, n.body),
          position: n.position,
          refRunId,
          refNodeKey,
          refArtifactId: null,
        },
      });
      continue;
    }
    // Preserve baseline content when the title/body split round-trips.
    const split = splitContent(baseNode.content);
    const edited = split.title !== n.title || (split.body ?? undefined) !== n.body;
    const patch: Record<string, unknown> = {};
    if (baseNode.kind !== kind) patch.kind = kind;
    if (edited) patch.content = composeContent(n.title, n.body);
    if (baseNode.position.x !== n.position.x || baseNode.position.y !== n.position.y) {
      patch.position = n.position;
    }
    if ((baseNode.refRunId ?? null) !== refRunId) patch.refRunId = refRunId;
    if ((baseNode.refNodeKey ?? null) !== refNodeKey) patch.refNodeKey = refNodeKey;
    if (Object.keys(patch).length) {
      ops.push({ op: "updateNode", nodeKey: n.id, patch: patch as never });
    }
  }
  for (const baseNode of base.nodes) {
    if (!seen.has(baseNode.nodeKey)) ops.push({ op: "removeNode", nodeKey: baseNode.nodeKey });
  }

  // Edges: re-encode and diff by edge key.
  const baseEdges = new Map(base.edges.map((e) => [e.edgeKey, e]));
  const nextEdges = new Map<string, BackendWbEdge>();
  for (const e of doc.edges) {
    let edge: BackendWbEdge | null = null;
    if (e.kind === "ownership") {
      if (!e.ownership) continue;
      const key = encodeOwnershipEdgeKey(e.from, e.ownership);
      if (!key) {
        return {
          ok: false,
          message: `ownership intent for "${e.from}" could not be encoded as an edge key (too long)`,
        };
      }
      edge = { edgeKey: key, fromKey: e.from, toKey: e.from, kind: "link" };
    } else {
      if (!NodeKeySchema.safeParse(e.id).success) {
        return { ok: false, message: `whiteboard edge id "${e.id}" is not a valid node key` };
      }
      edge = {
        edgeKey: e.id,
        fromKey: e.from,
        toKey: e.to,
        kind: e.kind === "dependency" ? "flow" : "annotation",
      };
    }
    nextEdges.set(edge.edgeKey, edge);
    const existing = baseEdges.get(edge.edgeKey);
    if (
      !existing ||
      existing.kind !== edge.kind ||
      existing.fromKey !== edge.fromKey ||
      existing.toKey !== edge.toKey
    ) {
      if (existing) ops.push({ op: "removeEdge", edgeKey: edge.edgeKey });
      ops.push({ op: "addEdge", edge: edge as never });
    }
  }
  for (const baseEdge of base.edges) {
    if (!nextEdges.has(baseEdge.edgeKey)) ops.push({ op: "removeEdge", edgeKey: baseEdge.edgeKey });
  }

  if (ops.length > WB_MAX_OPS_PER_BATCH) {
    return {
      ok: false,
      message: `edit produces ${ops.length} ops — over the ${WB_MAX_OPS_PER_BATCH}-op batch limit; split the change`,
    };
  }
  return { ok: true, ops };
}

export type WbSaveCause = "version_conflict" | "fenced" | "unavailable";

/** Classify an applyOps failure — server cause verbatim, never paraphrased. */
export function classifyWbSaveError(e: unknown): { cause: WbSaveCause; message: string } {
  const message = (e as { message?: string })?.message ?? String(e);
  const lower = message.toLowerCase();
  if (lower.includes("version conflict")) return { cause: "version_conflict", message };
  if (lower.includes("fenced") || lower.includes("locked by")) return { cause: "fenced", message };
  return { cause: "unavailable", message };
}

/** Server drift kinds → the view-model drift vocabulary (message verbatim). */
export function mapServerDrift(
  drift: { kind: string; nodeKey: string | null; message: string }[],
): DriftItem[] {
  return drift.map((d) => {
    if (d.kind === "unreferenced-run-node") {
      const m = /run node (\S+) /.exec(d.message);
      const ref = m?.[1] ?? "";
      return {
        kind: "unmapped-dag-node",
        dagNodeKey: ref.includes(":") ? ref.split(":")[1] : undefined,
        message: d.message,
      };
    }
    return { kind: "unbound-task", wbNodeId: d.nodeKey ?? undefined, message: d.message };
  });
}

// ── Goal-mode presets (client mirror of the server schema) ──

export type PresetParseResult =
  | { ok: true; preset: GoalModePreset }
  | { ok: false; error: string };

/**
 * Validate a preset edit before it is sent. GoalModePresetSchema is
 * .strict() — a "model" key (or any unknown key) is rejected, here with an
 * explicit message. Model identity is never part of a preset.
 */
export function parseGoalModePreset(raw: unknown): PresetParseResult {
  if (raw && typeof raw === "object" && "model" in (raw as Record<string, unknown>)) {
    return {
      ok: false,
      error:
        "goal-mode presets cannot carry a model id — model identity comes only from provider env / gateway discovery at runtime",
    };
  }
  const parsed = GoalModePresetSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.map((i) => i.message).join("; ") };
  }
  return { ok: true, preset: parsed.data };
}

// ── Autonomy grant UI derivations (mirror api/office/autonomy.ts) ──

export interface GrantRequestInput {
  mode: AutonomyMode;
  allowLive: boolean;
  riskTier: string;
  expiresInMinutes: number;
  scope: "project" | "run";
  /** False when the chosen run scope has no eligible (non-terminal) run. */
  runEligible: boolean;
}

/**
 * Disabled-state reasons for the grant form — the client mirror of
 * validateGrantRequest plus run-scope eligibility. Any non-empty result
 * disables the submit and is rendered verbatim; the server re-validates.
 */
export function grantRequestBlockers(input: GrantRequestInput): string[] {
  const blockers: string[] = [];
  if (input.mode === "none" && input.allowLive && input.riskTier !== "low") {
    blockers.push(
      `mode 'none' with live runs requires a low-risk project (this project is ${input.riskTier}) — the server rejects it`,
    );
  }
  if (
    !Number.isInteger(input.expiresInMinutes) ||
    input.expiresInMinutes < AUTONOMY_GRANT_TTL.minMinutes ||
    input.expiresInMinutes > AUTONOMY_GRANT_TTL.maxMinutes
  ) {
    blockers.push(
      `expiration must be ${AUTONOMY_GRANT_TTL.minMinutes}..${AUTONOMY_GRANT_TTL.maxMinutes} minutes`,
    );
  }
  if (input.scope === "run" && !input.runEligible) {
    blockers.push("run-scoped grants need an eligible (non-terminal) run — none is available");
  }
  return blockers;
}

export type GrantLifecycleState = "none" | "active" | "expired" | "revoked" | "over-budget";

export interface GrantCeilingUse {
  key: "maxTokens" | "maxCalls" | "maxMinutes" | "maxCostUsdMicros";
  used: number;
  limit: number;
  pct: number;
  breached: boolean;
}

export interface GrantLifecycle {
  state: GrantLifecycleState;
  ceilings: GrantCeilingUse[];
  remainingMs: number | null;
}

/**
 * Grant status for the panel: expired/revoked/over-budget are observed
 * states (mirrors isGrantExpired / grantUsageExceeded), never hidden.
 */
export function grantLifecycle(
  grant: Pick<
    AutonomyGrant,
    "expiresAtMs" | "revokedAtMs" | "maxTokens" | "maxCalls" | "maxMinutes" | "maxCostUsdMicros"
  > | null,
  usage: GrantUsage | null,
  nowMs: number,
): GrantLifecycle {
  if (!grant) return { state: "none", ceilings: [], remainingMs: null };
  const bases: Omit<GrantCeilingUse, "pct" | "breached">[] = [
    { key: "maxTokens", used: usage?.tokens ?? 0, limit: grant.maxTokens },
    { key: "maxCalls", used: usage?.calls ?? 0, limit: grant.maxCalls },
    { key: "maxMinutes", used: usage?.minutes ?? 0, limit: grant.maxMinutes },
    { key: "maxCostUsdMicros", used: usage?.costUsdMicros ?? 0, limit: grant.maxCostUsdMicros },
  ];
  const ceilings: GrantCeilingUse[] = bases.map((c) => ({
    ...c,
    pct: Math.min(100, Math.round((c.used / Math.max(c.limit, 1e-9)) * 100)),
    breached: c.used > c.limit,
  }));
  if (grant.revokedAtMs != null) return { state: "revoked", ceilings, remainingMs: 0 };
  const remainingMs = grant.expiresAtMs - nowMs;
  if (remainingMs <= 0) return { state: "expired", ceilings, remainingMs: 0 };
  if (ceilings.some((c) => c.breached)) {
    return { state: "over-budget", ceilings, remainingMs };
  }
  return { state: "active", ceilings, remainingMs };
}

/** The emergency stop is always available — it needs only a typed reason. */
export function emergencyStopConfirmable(reason: string): boolean {
  return reason.trim().length > 0;
}
