import { usdToMicros } from "@contracts/dag";
import type { WorkerKind, WorkerStatus } from "@contracts/run";
import {
  PERMANENT_OFFICE_WORKERS,
  SETUP_STEP_KEYS,
  type ClaimsPolicy,
  type OfficeEventType,
  type PermanentOfficeWorkerName,
  type RoomHealthLevel,
  type RoomSpec,
  type RoomUsage,
  type SetupStepKey,
} from "@contracts/office";

/**
 * Pure room allocation / reassignment / health / setup domain logic
 * (autonomy design §4, whiteboard design §2/§7). No DB, no scheduler —
 * every function is deterministic and unit-tested; the router/transaction
 * shells (office.assign / office.reassign / office.release) execute these
 * decisions inside one transaction with the lock order agent-row → room-row
 * (ascending room ids), exactly as design §4.4.
 *
 * Rooms never claim and never execute: dispatch still goes through
 * claimNextNode. Rooms only group agents and stamp budget-rollup tags.
 */

// ── Canonical rooms (whiteboard design §2.1) ─────────────────────

const DEFAULT_ROOM_BUDGETS = {
  maxTokens: 1_000_000,
  maxCalls: 100,
  maxMinutes: 240,
  maxCostUsd: 100,
  maxStorageBytes: 512 * 1024 * 1024,
} as const;

function room(
  key: string,
  name: string,
  kind: RoomSpec["kind"],
  capacity: number,
  eligibleRolePatterns: string[],
): RoomSpec {
  return {
    key,
    name,
    kind,
    capacity,
    eligibleRolePatterns,
    budgets: { ...DEFAULT_ROOM_BUDGETS },
  };
}

/** The eight canonical rooms; the set of health inputs is fixed. */
export const DEFAULT_ROOMS: readonly RoomSpec[] = [
  room("executive", "Executive Direction", "director-suite", 1, [
    "^director$",
  ]),
  room("product-design", "Product & Design Studio", "studio", 3, [
    "product",
    "design",
    "editor",
    "writer",
  ]),
  room("engineering", "Engineering Bay", "ops", 4, [
    "engineer",
    "builder",
    "integrator",
  ]),
  room("ai-research", "AI & Research Lab", "research-lab", 4, [
    "research",
    "analyst",
    "scientist",
  ]),
  room("data-knowledge", "Data & Knowledge Library", "vault", 3, [
    "data",
    "knowledge",
    "librarian",
    "catalog",
  ]),
  room("security-trust", "Security & Trust Vault", "vault", 2, [
    "security",
    "trust",
    "compliance",
  ]),
  room("qa-evidence", "QA & Evidence Gallery", "review", 2, [
    "qa",
    "evaluat",
    "review",
  ]),
  room("operations", "Operations Deck", "ops", 2, [
    "ops",
    "operations",
    "blueprint-ops",
    "roadmap-cartographer",
    "cartographer",
  ]),
];

// ── Agent view model ─────────────────────────────────────────────

export interface OfficeAgent {
  workerId: number;
  name: string;
  kind: WorkerKind;
  role: string;
  capabilities: string[];
  status: WorkerStatus;
  maxConcurrentClaims: number;
  activeClaims: number;
  /** null = on the bench (unassigned). */
  roomKey: string | null;
  /** OCC guard on the worker row. */
  version: number;
}

// ── Eligibility (same predicate as the claim path) ───────────────

/** Case-insensitive regex match of any room role pattern against a role. */
export function roleMatchesPatterns(
  role: string,
  patterns: readonly string[],
): boolean {
  return patterns.some((p) => {
    try {
      return new RegExp(p, "i").test(role);
    } catch {
      return false; // a malformed pattern never matches, never throws
    }
  });
}

export type IneligibilityReason =
  | "agent_not_active"
  | "already_seated"
  | "room_at_capacity"
  | "role_mismatch"
  | "missing_capability"
  | "room_budget_exceeded";

export interface EligibilityVerdict {
  ok: boolean;
  reasons: IneligibilityReason[];
}

function emptyUsage(): RoomUsage {
  return { tokens: 0, calls: 0, minutes: 0, costUsdMicros: 0, storageBytes: 0 };
}

/**
 * Eligibility verdict for seating `agent` in `room` (design §2.3):
 * worker.status='active' ∧ role matches room.eligibleRolePatterns ∧
 * capabilitiesRequired ⊆ worker.capabilities ∧ occupancy < capacity ∧
 * room budget rollup within the room envelopes. All reasons are collected
 * (the UI announces them verbatim); any one blocks.
 */
export function evaluateEligibility(input: {
  agent: OfficeAgent;
  room: RoomSpec;
  /** Current active-seat count for the room. */
  occupancy: number;
  /** Capabilities the seat requires (default: none). */
  capabilitiesRequired?: readonly string[];
  /** Room budget rollup; defaults to zero (nothing spent yet). */
  usage?: RoomUsage;
}): EligibilityVerdict {
  const { agent, room } = input;
  const reasons: IneligibilityReason[] = [];
  if (agent.status !== "active") reasons.push("agent_not_active");
  if (agent.roomKey !== null) reasons.push("already_seated");
  if (input.occupancy >= room.capacity) reasons.push("room_at_capacity");
  if (!roleMatchesPatterns(agent.role, room.eligibleRolePatterns)) {
    reasons.push("role_mismatch");
  }
  const caps = new Set(agent.capabilities);
  for (const required of input.capabilitiesRequired ?? []) {
    if (!caps.has(required)) reasons.push("missing_capability");
  }
  const usage = input.usage ?? emptyUsage();
  const overBudget =
    usage.tokens > room.budgets.maxTokens ||
    usage.calls > room.budgets.maxCalls ||
    usage.minutes > room.budgets.maxMinutes ||
    usage.costUsdMicros > usdToMicros(room.budgets.maxCostUsd) ||
    usage.storageBytes > room.budgets.maxStorageBytes;
  if (overBudget) reasons.push("room_budget_exceeded");
  return { ok: reasons.length === 0, reasons };
}

// ── Assignment / reassignment plans (design §4.4) ────────────────

export interface AssignmentPlan {
  action: "assign";
  agentId: number;
  toRoomKey: string;
  event: { type: OfficeEventType; payload: Record<string, unknown> };
}

export type AssignmentError =
  | { error: "conflict"; reasons: IneligibilityReason[] }
  | { error: "version_conflict"; currentVersion: number };

/**
 * `office.assign` decision. Re-checks eligibility inside the (future)
 * transaction — a race between two owners loses cleanly with
 * room_at_capacity, never a silent overflow.
 */
export function planAssignment(input: {
  agent: OfficeAgent;
  room: RoomSpec;
  occupancy: number;
  expectedVersion: number;
  runId?: number;
  nodeKey?: string;
  usage?: RoomUsage;
}): { ok: true; plan: AssignmentPlan } | { ok: false; error: AssignmentError } {
  if (input.expectedVersion !== input.agent.version) {
    return {
      ok: false,
      error: { error: "version_conflict", currentVersion: input.agent.version },
    };
  }
  const verdict = evaluateEligibility({
    agent: input.agent,
    room: input.room,
    occupancy: input.occupancy,
    usage: input.usage,
  });
  if (!verdict.ok) {
    return { ok: false, error: { error: "conflict", reasons: verdict.reasons } };
  }
  return {
    ok: true,
    plan: {
      action: "assign",
      agentId: input.agent.workerId,
      toRoomKey: input.room.key,
      event: {
        type: "office_agent_assigned",
        payload: {
          agentId: input.agent.workerId,
          agentName: input.agent.name,
          roomKey: input.room.key,
          runId: input.runId ?? null,
          nodeKey: input.nodeKey ?? null,
        },
      },
    },
  };
}

export type ReassignmentEffect =
  | {
      kind: "move";
      /** No active claims: the room transfers atomically. */
    }
  | {
      kind: "drain";
      /** Claims finish; worker stops picking up new work; room transfers
          on last completion. */
      pendingTransfer: true;
    }
  | {
      kind: "release-requeue";
      /** Claims released to `ready` (existing lease-release path; billable
          calls are never auto-retried). */
      releasedClaims: number;
    };

export interface ReassignmentPlan {
  action: "reassign";
  agentId: number;
  fromRoomKey: string;
  toRoomKey: string;
  effect: ReassignmentEffect;
  event: { type: OfficeEventType; payload: Record<string, unknown> };
}

export type ReassignmentError =
  | { error: "version_conflict"; currentVersion: number }
  | { error: "claims_policy_required"; activeClaims: number }
  | { error: "conflict"; reasons: IneligibilityReason[] };

/**
 * `office.reassign` decision (release + assign in one transaction).
 * An agent holding claims cannot be silently moved: `claimsPolicy` is
 * required iff activeClaims > 0 — `drain` (finish, then transfer) or
 * `release-requeue` (release to ready immediately). Capacity/eligibility
 * are re-checked against the target room.
 */
export function planReassignment(input: {
  agent: OfficeAgent;
  fromRoomKey: string;
  toRoom: RoomSpec;
  occupancy: number;
  expectedVersion: number;
  claimsPolicy?: ClaimsPolicy;
  usage?: RoomUsage;
}): { ok: true; plan: ReassignmentPlan } | { ok: false; error: ReassignmentError } {
  const { agent } = input;
  if (input.expectedVersion !== agent.version) {
    return {
      ok: false,
      error: { error: "version_conflict", currentVersion: agent.version },
    };
  }
  if (agent.activeClaims > 0 && !input.claimsPolicy) {
    return {
      ok: false,
      error: { error: "claims_policy_required", activeClaims: agent.activeClaims },
    };
  }
  const movingAgent: OfficeAgent = { ...agent, roomKey: null };
  const verdict = evaluateEligibility({
    agent: movingAgent,
    room: input.toRoom,
    occupancy: input.occupancy,
    usage: input.usage,
  });
  if (!verdict.ok) {
    return { ok: false, error: { error: "conflict", reasons: verdict.reasons } };
  }
  const effect: ReassignmentEffect =
    agent.activeClaims === 0
      ? { kind: "move" }
      : input.claimsPolicy === "drain"
        ? { kind: "drain", pendingTransfer: true }
        : { kind: "release-requeue", releasedClaims: agent.activeClaims };
  return {
    ok: true,
    plan: {
      action: "reassign",
      agentId: agent.workerId,
      fromRoomKey: input.fromRoomKey,
      toRoomKey: input.toRoom.key,
      effect,
      event: {
        type: "office_agent_reassigned",
        payload: {
          agentId: agent.workerId,
          agentName: agent.name,
          fromRoomKey: input.fromRoomKey,
          toRoomKey: input.toRoom.key,
          effect: effect.kind,
        },
      },
    },
  };
}

/** Deterministic auto-assign order: lowest workload, then lowest workerId. */
export function compareAutoAssignCandidates(
  a: OfficeAgent,
  b: OfficeAgent,
): number {
  if (a.activeClaims !== b.activeClaims) return a.activeClaims - b.activeClaims;
  return a.workerId - b.workerId;
}

// ── Deterministic room health (whiteboard design §2.2) ───────────

export interface RoomHealthInput {
  occupancy: number;
  capacity: number;
  /** 0..1+ budget utilization (used / alloc). */
  budgetUtilization: number;
  /** 0..1+ storage utilization (used / alloc). */
  storageUtilization: number;
  /** Any task waiting longer than 10 minutes. */
  anyWaitingOver10Min: boolean;
  /** Stale leases (name-attributed). */
  staleLeaseNames: string[];
  /** Any node failed at max attempts. */
  anyFailedAtMaxAttempts: boolean;
  /** Provider misconfigured/degraded for nodes mapped to this room. */
  providerMisconfigured: boolean;
  /** Storage write errors attributed to the room. */
  storageErrors: number;
}

export interface RoomHealth {
  level: RoomHealthLevel;
  reasons: string[];
}

/**
 * Three-level deterministic health — never color alone, the chip always
 * names its reason. Degraded wins over strained; healthy requires both
 * lists empty.
 */
export function deriveRoomHealth(input: RoomHealthInput): RoomHealth {
  const degraded: string[] = [];
  const strained: string[] = [];

  for (const name of [...input.staleLeaseNames].sort()) {
    degraded.push(`lease stale (${name})`);
  }
  if (input.anyFailedAtMaxAttempts) degraded.push("task failed at max attempts");
  if (input.providerMisconfigured) degraded.push("provider misconfigured");
  if (input.storageErrors > 0) {
    degraded.push(`storage errors (${input.storageErrors})`);
  }

  if (input.budgetUtilization >= 0.75) {
    strained.push(`budget ${Math.round(input.budgetUtilization * 100)}%`);
  }
  if (input.storageUtilization >= 0.8) {
    strained.push(`storage ${Math.round(input.storageUtilization * 100)}%`);
  }
  if (input.anyWaitingOver10Min) strained.push("task waiting >10 min");
  if (input.occupancy > input.capacity) {
    strained.push(`over capacity ${input.occupancy}/${input.capacity}`);
  }

  if (degraded.length > 0) return { level: "degraded", reasons: degraded };
  if (strained.length > 0) return { level: "strained", reasons: strained };
  return { level: "healthy", reasons: [] };
}

// ── Permanent digital roles (propose-only; design §7) ────────────

/**
 * Actions the permanent office workers may attempt. Everything not in a
 * worker's allowed set is denied — the allow-list is closed, not open.
 */
export const PERMANENT_WORKER_ACTIONS = [
  // Observation / reporting (both roles).
  "read-state",
  "report-health",
  "detect-drift",
  // Proposals (rendered in the owner's queue; never executed by the role).
  "propose-reassign",
  "propose-budget-allocation",
  "propose-plan-edit",
  "annotate-whiteboard",
  "save-whiteboard-checkpoint",
  // Narrow automation (blueprint-ops only, and only when the owner
  // explicitly enabled the auto-sweep scope).
  "sweep-leases",
  // Dangerous — never allowed for either permanent role.
  "start-run",
  "stop-run",
  "pause-run",
  "resume-run",
  "decide-approval",
  "create-worker",
  "suspend-worker",
  "delete-worker",
  "mutate-run-node",
  "mutate-artifact",
  "alter-budget",
  "alter-room-config",
  "delete-history",
  "force-edit-lease",
] as const;
export type PermanentWorkerAction = (typeof PERMANENT_WORKER_ACTIONS)[number];

const BLUEPRINT_OPS_BASE: ReadonlySet<PermanentWorkerAction> = new Set([
  "read-state",
  "report-health",
  "detect-drift",
  "propose-reassign",
  "propose-budget-allocation",
]);
const CARTOGRAPHER_BASE: ReadonlySet<PermanentWorkerAction> = new Set([
  "read-state",
  "detect-drift",
  "annotate-whiteboard",
  "save-whiteboard-checkpoint",
  "propose-plan-edit",
]);

export interface PermanentActionVerdict {
  allowed: boolean;
  reason: string;
}

/**
 * Propose-only enforcement for the two permanent roles (three layers in the
 * full system: capability set, ALLOWED_TOOL_VERBS subset, router allow-
 * lists — this predicate backs the third).
 *
 * Hard limits encoded:
 *  - never starts/stops/pauses/resumes a run, never decides an approval;
 *  - cannot create/suspend/delete workers — proposals only;
 *  - budget authority is zero (proposals re-enforced server-side);
 *  - blueprint-ops may sweep leases ONLY under the explicit auto-sweep
 *    scope; the cartographer never sweeps;
 *  - the cartographer respects the whiteboard edit lease absolutely
 *    (force-edit-lease denied) and cannot delete history.
 */
export function permanentWorkerActionAllowed(
  workerName: PermanentOfficeWorkerName,
  action: PermanentWorkerAction,
  opts: { autoSweepEnabled?: boolean } = {},
): PermanentActionVerdict {
  const base =
    workerName === PERMANENT_OFFICE_WORKERS.blueprintOps.name
      ? BLUEPRINT_OPS_BASE
      : CARTOGRAPHER_BASE;
  if (base.has(action)) {
    return { allowed: true, reason: "within propose-only scope" };
  }
  if (
    action === "sweep-leases" &&
    workerName === PERMANENT_OFFICE_WORKERS.blueprintOps.name
  ) {
    return opts.autoSweepEnabled === true
      ? { allowed: true, reason: "auto-sweep scope enabled by owner" }
      : { allowed: false, reason: "auto-sweep scope not enabled" };
  }
  return { allowed: false, reason: `propose-only role cannot ${action}` };
}

/**
 * Permanent roles can never target the director worker or any
 * human-delegate with a proposal/action (design §7.1 limit 3).
 */
export function permanentWorkerTargetAllowed(
  targetKind: WorkerKind,
): boolean {
  return targetKind === "subagent";
}

// ── First-run "Set up your office" checklist (observed state) ────

export interface SetupObservedState {
  /** Hired specialists (workers rows, excluding permanent roles/director). */
  agentsHired: number;
  seatsFilled: number;
  seatsTotal: number;
  /** Rooms with a nonzero compute/storage allocation. */
  roomsWithAllocation: number;
  roomsTotal: number;
  /** Completion of "allocate work" is observed: ≥1 task running. */
  anyTaskRunning: boolean;
}

export interface SetupStep {
  key: SetupStepKey;
  title: string;
  /** Observed from live state — never declared. */
  complete: boolean;
  /** Owner explicitly skipped; a persistent dismissible chip remains. */
  skipped: boolean;
  /** e.g. "6/8 seats filled" — progress is always legible. */
  progress: string;
}

export interface SetupChecklist {
  steps: SetupStep[];
  /** True when every step is either observed-complete or skipped. */
  complete: boolean;
}

const SETUP_TITLES: Record<SetupStepKey, string> = {
  "hire-team": "Hire the team",
  "populate-rooms": "Populate rooms",
  "allocate-compute": "Allocate compute & storage",
  "allocate-work": "Allocate work",
};

/**
 * Derives the checklist purely from observed state (design §2.4): hiring
 * lands agents on the bench; populate counts seats; allocation counts
 * rooms with envelopes; work is complete only when ≥1 task is running.
 * Skips are explicit ("skip for now") and never mark a step complete.
 */
export function deriveSetupChecklist(
  observed: SetupObservedState,
  skipped: ReadonlySet<SetupStepKey> = new Set(),
): SetupChecklist {
  const facts: Record<SetupStepKey, { complete: boolean; progress: string }> = {
    "hire-team": {
      complete: observed.agentsHired > 0,
      progress: `${observed.agentsHired} hired`,
    },
    "populate-rooms": {
      complete:
        observed.seatsTotal > 0 && observed.seatsFilled >= observed.seatsTotal,
      progress: `${observed.seatsFilled}/${observed.seatsTotal} seats filled`,
    },
    "allocate-compute": {
      complete:
        observed.roomsTotal > 0 &&
        observed.roomsWithAllocation >= observed.roomsTotal,
      progress: `${observed.roomsWithAllocation}/${observed.roomsTotal} rooms allocated`,
    },
    "allocate-work": {
      complete: observed.anyTaskRunning,
      progress: observed.anyTaskRunning ? "work running" : "no task running",
    },
  };
  const steps: SetupStep[] = SETUP_STEP_KEYS.map((key) => ({
    key,
    title: SETUP_TITLES[key],
    complete: facts[key].complete,
    skipped: skipped.has(key),
    progress: facts[key].progress,
  }));
  return {
    steps,
    complete: steps.every((s) => s.complete || s.skipped),
  };
}
