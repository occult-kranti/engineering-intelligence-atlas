import type {
  AgentCard,
  DriftItem,
  EligibilityVerdict,
  OfficeBlueprintData,
  OfficeTotals,
  ReassignClaimsPolicy,
  ReassignErrorCause,
  ReassignInput,
  RoomHealth,
  RoomState,
  SetupStep,
  WbEdge,
  WbNode,
  WhiteboardDoc,
} from "./model";

/**
 * Pure mapping helpers for the Office Blueprint & Ownership Whiteboard.
 * Everything here is deterministic and unit-tested; components only render
 * what these derive. These functions are the seam a future `office.get` /
 * `whiteboard.get` adapter feeds — no component talks to tRPC directly.
 */

// ── Formatting (mono, tabular, readable) ──

/** Lease/expiry countdown as mm:ss; negative values say "expired". */
export function fmtCountdown(sec: number): string {
  if (sec < 0) return "expired";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function fmtTokens(v: number): string {
  return v >= 1000
    ? `${(v / 1000).toFixed(v >= 100_000 ? 0 : 1)}k`
    : `${Math.round(v)}`;
}

export function fmtUsdMicros(micros: number): string {
  return `$${(micros / 1e6).toFixed(2)}`;
}

export function fmtMb(mb: number): string {
  return mb >= 1000 ? `${(mb / 1000).toFixed(1)} GB` : `${Math.round(mb)} MB`;
}

export function fmtHeartbeatAge(sec: number): string {
  if (sec < 0) return "no heartbeat";
  if (sec < 60) return `${sec} s ago`;
  return `${Math.round(sec / 60)} m ago`;
}

// ── Capacity ──

/** Seats used — suspended workers still hold a seat (management problem,
 * not free capacity). */
export function seatsUsed(room: RoomState): number {
  return room.agents.length;
}

export function isOverCapacity(room: RoomState): boolean {
  return seatsUsed(room) > room.capacity;
}

/** Case-insensitive substring match of a role against room patterns. */
export function roleMatches(patterns: string[], role: string): boolean {
  const r = role.toLowerCase();
  return patterns.some((p) => r.includes(p.toLowerCase()));
}

// ── Eligibility (mirrors the claim-path predicate; server re-checks on drop) ──

export function evaluateEligibility(agent: AgentCard, room: RoomState): EligibilityVerdict {
  const blocked: string[] = [];
  const matchedCaps = room.capabilitiesRequired.filter((c) =>
    agent.capabilities.includes(c),
  );
  const missingCaps = room.capabilitiesRequired.filter(
    (c) => !agent.capabilities.includes(c),
  );
  const unvetted = agent.skillPins.filter((p) => !p.vetted);

  if (agent.status !== "active") blocked.push(`worker ${agent.status}`);
  if (!roleMatches(room.eligibleRolePatterns, agent.role)) {
    blocked.push(`role "${agent.role}" not eligible here`);
  }
  for (const c of missingCaps) blocked.push(`missing capability "${c}"`);
  for (const p of unvetted) blocked.push(`skill pin ${p.name}@${p.version} not vetted`);
  const used = seatsUsed(room);
  const alreadyHere = agent.roomKey === room.roomKey;
  if (!alreadyHere && used >= room.capacity) {
    blocked.push(`room at capacity (${used}/${room.capacity})`);
  }

  if (blocked.length) {
    return { ok: false, reasons: blocked, message: `blocked — ${blocked.join(" · ")}` };
  }
  const parts = [
    `seat ${alreadyHere ? used : used + 1}/${room.capacity}`,
    "role match",
    room.capabilitiesRequired.length
      ? `${matchedCaps.length} capabilit${matchedCaps.length === 1 ? "y" : "ies"} match`
      : null,
    agent.workload.activeClaims === 0 ? "no active claims" : null,
  ].filter((p): p is string => p != null);
  return { ok: true, reasons: [], message: `eligible — ${parts.join(" · ")}` };
}

// ── Room health (three levels, always with named reasons) ──

const BUDGET_STRAIN_PCT = 75;
const STORAGE_STRAIN_PCT = 80;

export function deriveRoomHealth(room: RoomState): RoomHealth {
  const degraded: string[] = [];
  const strained: string[] = [];

  for (const a of room.agents) {
    if (a.lease.status === "live" && a.lease.data.stale) {
      degraded.push(`lease stale (${a.name})`);
    }
  }
  if (room.tasks.failed > 0) {
    degraded.push(`${room.tasks.failed} failed at max attempts`);
  }
  if (room.storage.storageErrors > 0) {
    degraded.push(`${room.storage.storageErrors} storage error${room.storage.storageErrors === 1 ? "" : "s"}`);
  }
  if (isOverCapacity(room)) {
    degraded.push(`over capacity ${seatsUsed(room)}/${room.capacity} — resolve`);
  }

  const budgetPct =
    room.compute.allocUsdMicros > 0
      ? (room.compute.usedUsdMicros / room.compute.allocUsdMicros) * 100
      : 0;
  if (budgetPct >= BUDGET_STRAIN_PCT) {
    strained.push(`budget ${Math.round(budgetPct)}%`);
  }
  if (
    room.storage.usedMb != null &&
    room.storage.allocMb > 0 &&
    (room.storage.usedMb / room.storage.allocMb) * 100 >= STORAGE_STRAIN_PCT
  ) {
    strained.push(
      `storage ${Math.round((room.storage.usedMb / room.storage.allocMb) * 100)}%`,
    );
  }
  if (room.tasks.blocked > 0) {
    strained.push(`${room.tasks.blocked} waiting`);
  }

  if (degraded.length) return { level: "degraded", reasons: degraded };
  if (strained.length) return { level: "strained", reasons: strained };
  return { level: "healthy", reasons: [] };
}

// ── Office totals ──

export function deriveOfficeTotals(bp: OfficeBlueprintData): OfficeTotals {
  let seats = 0;
  let seatsTotal = 0;
  let tokensUsed = 0;
  let tokensAlloc = 0;
  let usdUsed = 0;
  let usdAlloc = 0;
  let storageUsed: number | null = 0;
  let storageAlloc = 0;
  let healthy = 0;
  let strained = 0;
  let degraded = 0;
  for (const room of bp.rooms) {
    seats += seatsUsed(room);
    seatsTotal += room.capacity;
    tokensUsed += room.compute.usedTokens;
    tokensAlloc += room.compute.allocTokens;
    usdUsed += room.compute.usedUsdMicros;
    usdAlloc += room.compute.allocUsdMicros;
    if (room.storage.usedMb == null) storageUsed = null;
    else if (storageUsed != null) storageUsed += room.storage.usedMb;
    storageAlloc += room.storage.allocMb;
    const h = deriveRoomHealth(room).level;
    if (h === "healthy") healthy += 1;
    else if (h === "strained") strained += 1;
    else degraded += 1;
  }
  return {
    seatsUsed: seats,
    seatsTotal,
    tokensUsed,
    tokensAlloc,
    usdUsedMicros: usdUsed,
    usdAllocMicros: usdAlloc,
    storageUsedMb: storageUsed,
    storageAllocMb: storageAlloc,
    healthy,
    strained,
    degraded,
  };
}

// ── Allocation invariant: Σ room allocations ≤ run budget ──

export interface AllocationCheck {
  ok: boolean;
  allocUsdMicros: number;
  unallocatedUsdMicros: number;
  overByUsdMicros: number;
  message: string;
}

export function checkAllocation(
  rooms: RoomState[],
  runBudgetUsdMicros: number,
): AllocationCheck {
  const alloc = rooms.reduce((s, r) => s + r.compute.allocUsdMicros, 0);
  const over = Math.max(0, alloc - runBudgetUsdMicros);
  const unallocated = Math.max(0, runBudgetUsdMicros - alloc);
  return {
    ok: over === 0,
    allocUsdMicros: alloc,
    unallocatedUsdMicros: unallocated,
    overByUsdMicros: over,
    message:
      over > 0
        ? `over the run ceiling by ${fmtUsdMicros(over)} — reduce a room allocation`
        : `${fmtUsdMicros(runBudgetUsdMicros)} run ceiling — ${fmtUsdMicros(unallocated)} unallocated`,
  };
}

// ── First-run setup checklist (completion is observed, never declared) ──

export function deriveSetupChecklist(
  bp: OfficeBlueprintData,
  skipped: ReadonlySet<string> = new Set(),
): SetupStep[] {
  const hired = bp.rooms.reduce((n, r) => n + r.agents.length, 0) + bp.bench.length;
  const seated = bp.rooms.reduce((n, r) => n + r.agents.length, 0);
  const funded = bp.rooms.filter(
    (r) => r.compute.allocUsdMicros > 0 || r.compute.allocTokens > 0,
  ).length;
  const alloc = checkAllocation(bp.rooms, bp.runBudgetUsdMicros);
  return [
    {
      id: "hire",
      num: "01",
      title: "Hire the team",
      detail:
        hired > 0
          ? `${hired} agent${hired === 1 ? "" : "s"} hired from the approved plan`
          : "no agents yet — hire from the approved plan",
      done: hired > 0,
      skipped: skipped.has("hire"),
    },
    {
      id: "populate",
      num: "02",
      title: "Populate rooms",
      detail:
        hired === 0
          ? "nothing to seat yet"
          : `${seated} seated · ${bp.bench.length} on the bench`,
      done: hired > 0 && bp.bench.length === 0,
      skipped: skipped.has("populate"),
    },
    {
      id: "allocate",
      num: "03",
      title: "Allocate compute & storage",
      detail: `${funded} of ${bp.rooms.length} rooms funded · ${fmtUsdMicros(alloc.unallocatedUsdMicros)} unallocated`,
      done: funded === bp.rooms.length && alloc.ok,
      skipped: skipped.has("allocate"),
    },
    {
      id: "start-work",
      num: "04",
      title: "Allocate work",
      detail:
        bp.runningTasks > 0
          ? `${bp.runningTasks} task${bp.runningTasks === 1 ? "" : "s"} running — observed`
          : "no tasks running yet",
      done: bp.runningTasks > 0,
      skipped: skipped.has("start-work"),
    },
  ];
}

// ── Whiteboard: drift detection (Roadmap Cartographer, deterministic core) ──

export interface DriftInput {
  doc: WhiteboardDoc;
  /** Node keys of the current approved DAG revision. */
  dagNodeKeys: string[];
  /** Eligibility lookup for ownership targets: roomKey → capacity left; workerId → eligible. */
  roomHasSeat: (roomKey: string) => boolean;
  workerEligible: (workerId: number) => boolean;
  /** roomKey of the worker currently claiming a DAG node, when claimed. */
  claimingRoomOf: (dagNodeKey: string) => string | null | undefined;
}

export function deriveDrift(input: DriftInput): DriftItem[] {
  const { doc } = input;
  const dagKeys = new Set(input.dagNodeKeys);
  const items: DriftItem[] = [];
  const boundKeys = new Set<string>();
  const nodeById = new Map(doc.nodes.map((n) => [n.id, n]));

  for (const n of doc.nodes) {
    if (n.kind !== "task") continue;
    if (!n.binding) {
      items.push({
        kind: "unbound-task",
        wbNodeId: n.id,
        message: `whiteboard task "${n.title}" is not in the approved plan`,
      });
      continue;
    }
    boundKeys.add(n.binding.dagNodeKey);
    if (!dagKeys.has(n.binding.dagNodeKey)) {
      items.push({
        kind: "unbound-task",
        wbNodeId: n.id,
        dagNodeKey: n.binding.dagNodeKey,
        message: `bound node "${n.binding.dagNodeKey}" is gone from the approved plan`,
      });
    }
  }
  for (const key of input.dagNodeKeys) {
    if (!boundKeys.has(key)) {
      items.push({
        kind: "unmapped-dag-node",
        dagNodeKey: key,
        message: `plan node "${key}" has no whiteboard task`,
      });
    }
  }
  for (const e of doc.edges) {
    if (e.kind !== "ownership" || !e.ownership) continue;
    const from = nodeById.get(e.from);
    if ("roomKey" in e.ownership) {
      if (!input.roomHasSeat(e.ownership.roomKey)) {
        items.push({
          kind: "owner-ineligible",
          wbNodeId: e.from,
          message: `ownership edge "${from?.title ?? e.from}" → room ${e.ownership.roomKey}: no eligible seat`,
        });
      }
      const boundKey = from?.binding?.dagNodeKey;
      const claimRoom = boundKey ? input.claimingRoomOf(boundKey) : undefined;
      if (claimRoom != null && claimRoom !== e.ownership.roomKey) {
        items.push({
          kind: "claim-not-in-room",
          wbNodeId: e.from,
          dagNodeKey: boundKey,
          message: `claim held in ${claimRoom} but ownership intent is ${e.ownership.roomKey}`,
        });
      }
    } else if (!input.workerEligible(e.ownership.workerId)) {
      items.push({
        kind: "owner-ineligible",
        wbNodeId: e.from,
        message: `ownership edge "${from?.title ?? e.from}" → worker #${e.ownership.workerId}: owner ineligible`,
      });
    }
  }
  return items;
}

// ── Whiteboard: OCC rebase (deterministic merge onto latest) ──

/**
 * Rebase `mine` onto `latest`: latest is the positional/structural base;
 * my edits win per node id for title/body/position; task bindings are keyed
 * by dagNodeKey so rebasing is deterministic. Edges are unioned by id
 * (mine wins on id collision). Revision/version come from `latest`.
 */
export function rebaseWhiteboard(
  mine: WhiteboardDoc,
  latest: WhiteboardDoc,
): WhiteboardDoc {
  const mineById = new Map(mine.nodes.map((n) => [n.id, n]));
  const latestIds = new Set(latest.nodes.map((n) => n.id));
  const mergedNodes: WbNode[] = latest.nodes.map((n) => {
    const m = mineById.get(n.id);
    if (!m) return n;
    // Bindings are keyed by dagNodeKey: keep the live binding unless mine
    // points at the same dag node key (idempotent re-save of my own edit).
    const binding =
      m.binding && n.binding && m.binding.dagNodeKey !== n.binding.dagNodeKey
        ? n.binding
        : (m.binding ?? n.binding);
    return {
      ...n,
      title: m.title,
      body: m.body ?? n.body,
      position: m.position,
      binding,
      milestoneKey: m.milestoneKey ?? n.milestoneKey,
      orderIndex: m.orderIndex ?? n.orderIndex,
    };
  });
  for (const m of mine.nodes) {
    if (!latestIds.has(m.id)) mergedNodes.push(m);
  }
  const latestEdgeIds = new Set(latest.edges.map((e) => e.id));
  const mineEdgeById = new Map(mine.edges.map((e) => [e.id, e]));
  const mergedEdges: WbEdge[] = latest.edges.map(
    (e) => mineEdgeById.get(e.id) ?? e,
  );
  for (const e of mine.edges) {
    if (!latestEdgeIds.has(e.id)) mergedEdges.push(e);
  }
  return {
    ...latest,
    nodes: mergedNodes,
    edges: mergedEdges,
    updatedBy: mine.updatedBy,
  };
}

// ── Reassignment request construction (capacity/eligibility gate) ──

/**
 * Build a reassignment mutation input — or refuse with the exact reason.
 * Mirrors the drop/picker flow: eligibility first, then the claims policy
 * rule (a worker holding claims is never silently moved). The server
 * re-checks everything inside the mutation; this is the honest pre-flight.
 */
export function reassignRequestFor(
  agent: AgentCard,
  target: RoomState | null,
  claimsPolicy?: ReassignClaimsPolicy,
):
  | { ok: true; input: ReassignInput }
  | { ok: false; verdict: EligibilityVerdict; cause?: ReassignErrorCause } {
  if (target === null) {
    if (agent.roomKey == null) {
      return {
        ok: false,
        verdict: { ok: false, reasons: ["already on the bench"], message: "blocked — already on the bench" },
      };
    }
  } else {
    const verdict = evaluateEligibility(agent, target);
    if (!verdict.ok) {
      const cause: ReassignErrorCause = verdict.reasons.some((r) =>
        r.startsWith("room at capacity"),
      )
        ? "room_at_capacity"
        : "ineligible";
      return { ok: false, verdict, cause };
    }
  }
  if (agent.workload.activeClaims > 0 && !claimsPolicy) {
    return {
      ok: false,
      cause: "claims_policy_required",
      verdict: {
        ok: false,
        reasons: ["claims policy required"],
        message: `blocked — ${agent.name} holds ${agent.workload.activeClaims} active claim${agent.workload.activeClaims === 1 ? "" : "s"}: choose drain or release-requeue`,
      },
    };
  }
  return {
    ok: true,
    input: {
      workerId: agent.workerId,
      toRoomKey: target ? target.roomKey : null,
      expectedVersion: agent.version,
      claimsPolicy,
    },
  };
}

// ── Whiteboard selection sync & ownership cycling ──

/** Selecting a whiteboard node selects the live DAG node (or nothing). */
export function wbSelectionForNode(node: WbNode): string | null {
  return node.kind === "task" ? (node.binding?.dagNodeKey ?? null) : null;
}

/**
 * Cycle a task's ownership edge through eligible targets (the O key).
 * Returns the new edge list and the applied target key (null when there
 * are no eligible targets — edges then change nothing).
 */
export function cycleOwnershipEdge(
  edges: WbEdge[],
  nodeId: string,
  targets: { key: string; ownership: WbEdge["ownership"] }[],
): { edges: WbEdge[]; appliedKey: string | null } {
  if (!targets.length) return { edges, appliedKey: null };
  const existing = edges.find((e) => e.kind === "ownership" && e.from === nodeId);
  const sameTarget = (a: WbEdge["ownership"], b: WbEdge["ownership"]): boolean => {
    if (!a || !b) return false;
    if ("roomKey" in a && "roomKey" in b) return a.roomKey === b.roomKey;
    if ("workerId" in a && "workerId" in b) return a.workerId === b.workerId;
    return false;
  };
  const curIdx = existing
    ? targets.findIndex((t) => sameTarget(existing.ownership, t.ownership))
    : -1;
  const next = targets[(curIdx + 1) % targets.length]!;
  const edge: WbEdge = {
    id: existing?.id ?? `own-${nodeId}`,
    from: nodeId,
    to: nodeId,
    kind: "ownership",
    ownership: next.ownership,
  };
  return {
    edges: existing ? edges.map((e) => (e.id === existing.id ? edge : e)) : [...edges, edge],
    appliedKey: next.key,
  };
}

// ── Keyboard / roving focus helpers ──

/** Wrap-around index movement (rooms: [ / ], agents: J / K, tree: arrows). */
export function moveIndex(current: number, delta: number, length: number): number {
  if (length <= 0) return 0;
  return (((current + delta) % length) + length) % length;
}

export interface TeamBoardRow {
  id: string;
  kind: "room" | "agent" | "bench-agent";
  roomKey: string | null;
  workerId?: number;
  depth: 1 | 2;
}

/** Flatten rooms + agents into the visible tree rows (expanded rooms only). */
export function flattenTeamBoard(
  rooms: RoomState[],
  bench: AgentCard[],
  expanded: ReadonlySet<string>,
): TeamBoardRow[] {
  const rows: TeamBoardRow[] = [];
  for (const room of rooms) {
    rows.push({ id: `room:${room.roomKey}`, kind: "room", roomKey: room.roomKey, depth: 1 });
    if (expanded.has(room.roomKey)) {
      for (const a of room.agents) {
        rows.push({
          id: `agent:${a.workerId}`,
          kind: "agent",
          roomKey: room.roomKey,
          workerId: a.workerId,
          depth: 2,
        });
      }
    }
  }
  if (bench.length) {
    rows.push({ id: "room:__bench__", kind: "room", roomKey: "__bench__", depth: 1 });
  }
  if (expanded.has("__bench__")) {
    for (const a of bench) {
      rows.push({
        id: `agent:${a.workerId}`,
        kind: "bench-agent",
        roomKey: null,
        workerId: a.workerId,
        depth: 2,
      });
    }
  }
  return rows;
}

export interface TeamBoardKeyState {
  focusIndex: number;
  expanded: ReadonlySet<string>;
}

/**
 * Keyboard reducer for the Team Board tree (and the contract the spatial
 * blueprint mirrors): ↑/↓ move, → expands or steps in, ← collapses or steps
 * out. Pure so the list/tree parity is testable without a DOM.
 */
export function teamBoardKey(
  key: string,
  state: TeamBoardKeyState,
  rows: TeamBoardRow[],
): TeamBoardKeyState {
  if (!rows.length) return state;
  const cur = rows[Math.min(state.focusIndex, rows.length - 1)]!;
  const toggle = (id: string): ReadonlySet<string> => {
    const next = new Set(state.expanded);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  };
  switch (key) {
    case "ArrowDown":
      return { ...state, focusIndex: moveIndex(state.focusIndex, 1, rows.length) };
    case "ArrowUp":
      return { ...state, focusIndex: moveIndex(state.focusIndex, -1, rows.length) };
    case "ArrowRight":
      if (cur.kind === "room" && !state.expanded.has(cur.roomKey!)) {
        return { ...state, expanded: toggle(cur.roomKey!) };
      }
      return state;
    case "ArrowLeft":
      if (cur.kind === "room" && state.expanded.has(cur.roomKey!)) {
        return { ...state, expanded: toggle(cur.roomKey!) };
      }
      if (cur.depth === 2 && cur.roomKey) {
        const parentIdx = rows.findIndex(
          (r) => r.kind === "room" && r.roomKey === cur.roomKey,
        );
        if (parentIdx >= 0) return { ...state, focusIndex: parentIdx };
      }
      return state;
    default:
      return state;
  }
}

// ── Whiteboard export payloads (pure; host performs the actual download) ──

/** JSON export: the doc + bound plan hash + timestamp. Never secrets. */
export function whiteboardExportJson(doc: WhiteboardDoc, exportedAt: string): string {
  return JSON.stringify(
    {
      format: "atlas.whiteboard.v1",
      exportedAt,
      planHash: doc.planHash,
      revision: doc.revision,
      version: doc.version,
      doc,
    },
    null,
    2,
  );
}

const escXml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Self-contained SVG export with a data-revision provenance attribute. */
export function whiteboardToSvg(doc: WhiteboardDoc): string {
  const W = 1200;
  const H = 800;
  const byId = new Map(doc.nodes.map((n) => [n.id, n]));
  const parts: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="Manrope, sans-serif" data-revision="${doc.revision}">`,
    `<rect width="${W}" height="${H}" fill="#f6f4ee"/>`,
  ];
  for (const e of doc.edges) {
    const a = byId.get(e.from);
    const b = byId.get(e.to);
    if (!a || !b) continue;
    const dashed = e.kind === "note-link" ? ` stroke-dasharray="4 3"` : "";
    parts.push(
      `<line x1="${a.position.x}" y1="${a.position.y}" x2="${b.position.x}" y2="${b.position.y}" stroke="#4a63b8" stroke-opacity="0.55" stroke-width="1.5"${dashed}/>`,
    );
  }
  for (const n of doc.nodes) {
    const w = n.kind === "milestone" ? 300 : n.kind === "note" ? 220 : 200;
    const h = n.kind === "milestone" ? 44 : n.kind === "note" ? 72 : 56;
    const fill =
      n.kind === "milestone" ? "#ffffff" : n.kind === "note" ? "#f3e9c8" : "#ffffff";
    const dash = n.kind === "note" ? ` stroke-dasharray="5 3"` : "";
    parts.push(
      `<g><rect x="${n.position.x - w / 2}" y="${n.position.y - h / 2}" width="${w}" height="${h}" fill="${fill}" stroke="#26221a" stroke-width="1"${dash}/>` +
        `<text x="${n.position.x - w / 2 + 10}" y="${n.position.y - h / 2 + 20}" font-size="13" font-weight="700" fill="#26221a">${escXml(n.title)}</text>` +
        (n.binding
          ? `<text x="${n.position.x - w / 2 + 10}" y="${n.position.y - h / 2 + 38}" font-size="11" font-family="ui-monospace, monospace" fill="#4a63b8">${escXml(n.binding.dagNodeKey)}</text>`
          : "") +
        `</g>`,
    );
  }
  parts.push(`</svg>`);
  return parts.join("");
}
