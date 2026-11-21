import type { Availability, LeaseStatus, RunNodeLike } from "../workspace/adapter";
import type { RunNodeState, WorkerKind, WorkerStatus } from "@contracts/run";

/**
 * Office Blueprint & Ownership Whiteboard — view-model contracts.
 *
 * Every shape here is live-data-ready: components receive `Availability<T>`
 * envelopes (the workspace/adapter.ts pattern) and never invent offices,
 * workers, run nodes, or whiteboard documents. Anything the backend cannot
 * yet produce is rendered as an explicit `unavailable` state. Mock fixtures
 * exist only in `*.test.ts(x)` files.
 */

export type { Availability, LeaseStatus, RunNodeLike };

// ── Agents & rooms ──

export interface SkillPinRef {
  name: string;
  version: string;
  sha256: string;
  /** Only vetted, content-hash-pinned skills satisfy eligibility. */
  vetted: boolean;
}

export interface AgentTaskRef {
  nodeKey: string;
  state: RunNodeState;
  attempt: number;
}

/** View model of one `workers` row with live status, lease, and workload. */
export interface AgentCard {
  workerId: number;
  name: string;
  kind: WorkerKind; // director | subagent | human-delegate
  role: string;
  /** null = hired but unassigned ("on the bench"). */
  roomKey: string | null;
  status: WorkerStatus; // active | suspended
  capabilities: string[];
  skillPins: SkillPinRef[];
  maxConcurrentClaims: number;
  /** OCC token for the workers row — reassignments are state-guarded CAS. */
  version: number;
  workload: { activeClaims: number; queued: number };
  lease: Availability<LeaseStatus>;
  currentTasks: AgentTaskRef[];
}

export interface RoomTaskCounts {
  running: number;
  ready: number;
  blocked: number;
  failed: number;
}

export interface RoomCompute {
  allocTokens: number;
  usedTokens: number;
  allocUsdMicros: number;
  usedUsdMicros: number;
  /** True when consumption comes from a mock-mode run (labeled, never silent). */
  simulated: boolean;
}

export interface RoomStorage {
  allocMb: number;
  /** null = storage layer is unmetered; the UI says so instead of faking 0. */
  usedMb: number | null;
  artifactCount: number;
  storageErrors: number;
}

export type RoomHealthLevel = "healthy" | "strained" | "degraded";

export interface RoomHealth {
  level: RoomHealthLevel;
  /** Human-readable reason strings; the chip always names its reason. */
  reasons: string[];
}

/** One room of the office. Health is derived (see derive.ts), never stored. */
export interface RoomState {
  roomKey: string;
  name: string;
  /** Single text glyph — no icon font dependency. */
  glyph: string;
  /** One-line purpose shown in the empty-room teaching state. */
  purpose: string;
  /** 1..8 */
  capacity: number;
  /** Matched case-insensitively against workers.role / NodeSpec.role. */
  eligibleRolePatterns: string[];
  /** Extra capabilities a worker must hold to sit here. */
  capabilitiesRequired: string[];
  agents: AgentCard[];
  tasks: RoomTaskCounts;
  compute: RoomCompute;
  storage: RoomStorage;
  /** OCC token for room-config edits. */
  version: number;
}

export interface OfficeTotals {
  seatsUsed: number;
  seatsTotal: number;
  tokensUsed: number;
  tokensAlloc: number;
  usdUsedMicros: number;
  usdAllocMicros: number;
  storageUsedMb: number | null; // null when any room is unmetered
  storageAllocMb: number;
  healthy: number;
  strained: number;
  degraded: number;
}

export interface OfficeBlueprintData {
  projectId: number;
  rooms: RoomState[];
  /** Hired but unassigned workers. */
  bench: AgentCard[];
  /** Run-level budget ceiling; Σ room allocations must stay under it. */
  runBudgetUsdMicros: number;
  /** Whether any run currently has ≥1 running node (observed, for setup). */
  runningTasks: number;
  updatedAt: string;
}

// ── Reassignment ──

export type ReassignClaimsPolicy = "drain" | "release-requeue";

export interface ReassignInput {
  workerId: number;
  /** null moves the agent to the bench (release seat). */
  toRoomKey: string | null;
  expectedVersion: number;
  /** Required iff the worker holds active claims — never silently moved. */
  claimsPolicy?: ReassignClaimsPolicy;
}

export type ReassignErrorCause =
  | "version_conflict"
  | "room_at_capacity"
  | "ineligible"
  | "claims_policy_required"
  | "unavailable";

export interface ReassignError {
  cause: ReassignErrorCause;
  /** Server cause rendered verbatim — no paraphrasing, no fake success. */
  message: string;
}

export type ReassignResult = { ok: true } | { ok: false; error: ReassignError };

/** Live drop-target verdict, announced before any mutation is attempted. */
export interface EligibilityVerdict {
  ok: boolean;
  reasons: string[];
  /** e.g. "eligible — seat 3/4 · role + 2 capabilities match" */
  message: string;
}

// ── Setup checklist (first run) ──

export type SetupStepId = "hire" | "populate" | "allocate" | "start-work";

export interface SetupStep {
  id: SetupStepId;
  num: string;
  title: string;
  /** Observed progress line, e.g. "12 seated · 1 on the bench". */
  detail: string;
  /** Completion is observed from state, never declared. */
  done: boolean;
  skipped: boolean;
}

// ── Whiteboard document ──

export const WB_NODE_KINDS = ["milestone", "task", "note"] as const;
export type WbNodeKind = (typeof WB_NODE_KINDS)[number];

export interface WbNode {
  /** wb-scoped id, stable across revisions. */
  id: string;
  kind: WbNodeKind;
  title: string;
  /** Notes: free text (owner-authored; never secrets). */
  body?: string;
  position: { x: number; y: number };
  /** Task nodes only — the live binding that makes selection synchronize. */
  binding?: { dagNodeKey: string; runId: number | null };
  milestoneKey?: string;
  orderIndex?: number;
}

export type WbEdgeKind = "dependency" | "ownership" | "note-link";

export interface WbEdge {
  id: string;
  from: string; // WbNode.id
  to: string;
  kind: WbEdgeKind;
  /** ownership edges resolve to a live target: */
  ownership?: { roomKey: string } | { workerId: number };
}

export interface WhiteboardDoc {
  projectId: number;
  /** Mirrors dag_revisions discipline — every save appends a revision. */
  revision: number;
  /** OCC on save. */
  version: number;
  nodes: WbNode[];
  edges: WbEdge[];
  /** Plan hash of the DAG revision task bindings reference; null if unbound. */
  planHash: string | null;
  updatedAt: string;
  updatedBy: string;
}

export interface WbRevisionMeta {
  revision: number;
  createdAt: string;
  /** "you" | blueprint-ops | roadmap-cartographer */
  author: string;
  note: string;
  /** Absent when the revisions endpoint does not return doc snapshots. */
  nodeCount?: number;
  edgeCount?: number;
}

export interface EditLeaseInfo {
  holder: string;
  expiresInSec: number;
  heldByYou: boolean;
}

export type WbSaveErrorCause = "version_conflict" | "fenced" | "unavailable";

export type WbSaveResult =
  | { ok: true; version: number; revision: number }
  | { ok: false; cause: WbSaveErrorCause; message: string };

/** Client-side download formats (server exports are json/markdown via the router). */
export type WbExportFormat = "svg" | "json";

// ── Drift (Roadmap Cartographer) ──

export type DriftKind =
  | "unbound-task" // whiteboard task without a live binding
  | "unmapped-dag-node" // DAG node with no whiteboard task
  | "owner-ineligible" // ownership edge to an ineligible/absent target
  | "claim-not-in-room"; // claiming worker sits in a different room than intent

export interface DriftItem {
  kind: DriftKind;
  wbNodeId?: string;
  dagNodeKey?: string;
  message: string;
}

// ── Inspector (shared by both surfaces) ──

export type InspectorTarget =
  | { kind: "agent"; agent: AgentCard }
  | { kind: "room"; room: RoomState }
  | {
      kind: "node";
      nodeKey: string;
      /** Present when the whiteboard node is bound to the approved plan. */
      bound: boolean;
      ownerRoom?: { roomKey: string; roomName: string; glyph: string };
      ownerAgent?: string;
    };

// ── Permanent digital roles ──

export type DigitalRoleId = "blueprint-ops" | "roadmap-cartographer";

export interface DigitalRoleStatus {
  id: DigitalRoleId;
  /** Live activity line, or unavailable with an honest reason. */
  activity: Availability<string>;
  /** "ai" when the backing provider is configured, else deterministic core. */
  mode: "ai" | "rules-only";
}

/**
 * The two permanent digital roles and their hard limits — part of the
 * contract, not decoration: propose-only, zero budget authority, append-only
 * history, capped claims, restricted tool verbs.
 */
export const DIGITAL_ROLE_DEFS: Record<
  DigitalRoleId,
  { name: string; purpose: string; limitChips: string[]; toolVerbs: string }
> = {
  "blueprint-ops": {
    name: "Blueprint Ops Manager",
    purpose: "Keeps the office true — capacity, leases, budgets, storage, health.",
    limitChips: ["propose-only", "no approvals", "cap 1 claim", "zero budget authority"],
    toolVerbs: "read, summarize, classify",
  },
  "roadmap-cartographer": {
    name: "Roadmap Cartographer",
    purpose: "Keeps the whiteboard true — drift, alignment, revisions, exports.",
    limitChips: ["append-only", "respects edit lease", "cap 1 claim", "never approves a plan"],
    toolVerbs: "read, summarize, compare, cite",
  },
};
