import {
  ENTERPRISE_ACTIONS,
  StewardRecommendationSchema,
  blueprintHash,
  partitionBudget,
  type CompanyRun,
  type CeoProgramState,
  type Discipline,
  type EnterpriseBlueprint,
  type EnterpriseBudget,
  type EnterpriseReservation,
  type EnterpriseView,
  type StewardRecommendation,
  type WorkLedgerEntry,
  type WorkerContractStatus,
} from "@contracts/enterprise";

/**
 * Pure view-model derivations for the CEO enterprise dashboard. Everything
 * here is deterministic and provider-free: the graph/list parity comes from
 * the contract deriveEnterpriseView (already computed server-side into the
 * snapshot), budget meters come from the contract partitionBudget, and the
 * steward recommendations are system derivations over snapshot facts only.
 *
 * The row types are structural mirrors of the tRPC snapshot payload so the
 * adapter is testable without a server.
 */

export interface EnterpriseRowLike {
  id: number;
  slug: string;
  name: string;
  goal: string;
  status: string;
  budget: EnterpriseBudget;
  maxConcurrentRuns: number;
  version: number;
}

export interface CompanyRowLike {
  id: number;
  key: string;
  name: string;
  kind: "line" | "shared-services";
  mission: string;
  disciplines: Discipline[];
  capacityShare: number;
  projectId: number;
  active: boolean;
}

export interface DepartmentRowLike {
  id: number;
  key: string;
  companyId: number;
  name: string;
  discipline: Discipline;
}

export interface ContractRowLike {
  id: number;
  key: string;
  companyId: number;
  departmentId: number;
  discipline: Discipline;
  status: WorkerContractStatus;
  version: number;
  capacityShare: number;
  skillPin: { skillId: string; version: string; sha256: string | null };
  staffed: boolean;
  secondeeWorkerId: number | null;
  capacityGroupId: string | null;
  decidedBy: string | null;
}

export interface ProgramRowLike {
  id: number;
  state: CeoProgramState;
  version: number;
  blueprintHash: string;
  blueprint: EnterpriseBlueprint;
  companyRuns: CompanyRun[];
  budget: EnterpriseBudget;
  maxReplans: number;
  maxConcurrentRuns: number;
  pausedAt: Date | string | null;
}

export interface WorkerRowLike {
  id: number;
  projectId: number;
  name: string;
  role: string;
  status: "active" | "suspended";
  maxConcurrentClaims: number;
  capacityGroupId: string | null;
  departmentId: number | null;
  companyKey: string | null;
}

export interface UsageTotalsLike {
  promptTokens: number;
  completionTokens: number;
  calls: number;
  costUsdMicros: number;
}

export interface SnapshotLike {
  enterprise: EnterpriseRowLike;
  program: ProgramRowLike | null;
  companies: CompanyRowLike[];
  departments: DepartmentRowLike[];
  contracts: ContractRowLike[];
  view: EnterpriseView | null;
  usage: UsageTotalsLike;
}

// ── Plan gate (per-company DAG approval truth) ───────────────────

export interface RevisionLike {
  id: number;
  revision: number;
  approvedAt: Date | string | null;
  planHash: string;
}

export type PlanStatus =
  | { state: "loading"; detail: string }
  | { state: "no-plan"; detail: string }
  | { state: "unapproved"; detail: string; revision: number; planHash: string }
  | { state: "approved"; detail: string; revision: number; planHash: string };

/**
 * Per-company plan truth from the existing dag.revisions feed. Drafts are
 * materialized UNAPPROVED by blueprint apply; the only path to "approved" is
 * the human dag.approve decision in the company project workspace. The CEO
 * dashboard never bypasses that gate — it reports and links.
 */
export function derivePlanStatus(revisions: RevisionLike[] | undefined): PlanStatus {
  if (revisions === undefined) {
    return { state: "loading", detail: "plan revisions loading…" };
  }
  if (revisions.length === 0) {
    return { state: "no-plan", detail: "no plan revision exists for this company project" };
  }
  const latest = revisions[0]!; // dag.revisions is revision-DESC
  const approved = revisions.find((r) => r.approvedAt !== null) ?? null;
  if (approved) {
    return {
      state: "approved",
      detail: `revision ${approved.revision} approved by a human`,
      revision: approved.revision,
      planHash: approved.planHash,
    };
  }
  return {
    state: "unapproved",
    detail: `revision ${latest.revision} is a draft — human plan approval required before dispatch`,
    revision: latest.revision,
    planHash: latest.planHash,
  };
}

// ── Budget partition meters ──────────────────────────────────────

export interface BudgetMeterRow {
  companyKey: string;
  active: boolean;
  capacityShare: number;
  reservation: EnterpriseReservation;
}

export interface BudgetMeters {
  withinEnvelope: boolean;
  envelope: EnterpriseBudget;
  rows: BudgetMeterRow[];
  totals: EnterpriseReservation;
  /** Enterprise-wide actual usage vs the envelope (fractions 0..∞). */
  usage: {
    tokens: { used: number; max: number; fraction: number };
    calls: { used: number; max: number; fraction: number };
    costUsdMicros: { used: number; max: number; fraction: number };
  };
}

/**
 * Partition meters from the SHARED contract partitioner (byte-identical to
 * the server's pre-dispatch check). Usage is the real budget-ledger rollup
 * from the snapshot — never estimated.
 */
export function deriveBudgetMeters(
  enterprise: EnterpriseRowLike,
  companies: CompanyRowLike[],
  usage: UsageTotalsLike,
): BudgetMeters {
  const result = partitionBudget(
    enterprise.budget,
    companies.map((c) => ({ companyKey: c.key, capacityShare: c.capacityShare, active: c.active })),
  );
  const envelope = enterprise.budget;
  const tokensUsed = usage.promptTokens + usage.completionTokens;
  return {
    withinEnvelope: result.withinEnvelope,
    envelope,
    totals: result.totals,
    rows: result.partitions.map((p) => ({
      companyKey: p.companyKey,
      active: p.active,
      capacityShare: p.capacityShare,
      reservation: p.reservation,
    })),
    usage: {
      tokens: { used: tokensUsed, max: envelope.maxTokens, fraction: tokensUsed / envelope.maxTokens },
      calls: { used: usage.calls, max: envelope.maxCalls, fraction: usage.calls / envelope.maxCalls },
      costUsdMicros: {
        used: usage.costUsdMicros,
        max: envelope.maxCostUsdMicros,
        fraction: usage.costUsdMicros / envelope.maxCostUsdMicros,
      },
    },
  };
}

// ── Contracts: available controls per row (no bypass, no invention)

export interface ContractControls {
  approve: { enabled: boolean; reason: string | null };
  reject: { enabled: boolean; reason: string | null };
  release: { enabled: boolean; reason: string | null; label: string };
}

/**
 * Maps a contract row to the ENTERPRISE_ACTIONS contract.decide /
 * contract.release controls. Disabled controls always carry the honest
 * reason (mirrors the server guards: BAD_STATE / UNSTAFFED).
 */
export function deriveContractControls(contract: ContractRowLike): ContractControls {
  const proposed = contract.status === "proposed";
  return {
    approve: proposed
      ? contract.staffed
        ? { enabled: true, reason: null }
        : {
            enabled: false,
            reason: `pinned skill "${contract.skillPin.skillId}" is not vetted — the contract stays honestly unstaffed and cannot mint a worker`,
          }
      : { enabled: false, reason: `contract is ${contract.status}, not proposed` },
    reject: proposed
      ? { enabled: true, reason: null }
      : { enabled: false, reason: `contract is ${contract.status}, not proposed` },
    release:
      contract.status === "active"
        ? { enabled: true, reason: null, label: "Release (drain)" }
        : contract.status === "draining"
          ? { enabled: true, reason: null, label: "Complete release" }
          : {
              enabled: false,
              reason: `contract is ${contract.status}; only active/draining contracts can be released`,
              label: "Release",
            },
  };
}

// ── Memory entry controls (hash-verified, state-gated) ───────────

export interface MemoryEntryLike {
  id: number;
  state: "pending" | "promoted" | "rejected" | "revoked";
  contentSha256: string;
  /** Live re-verification against the artifact row (server-computed). */
  verified: boolean;
}

export interface MemoryControls {
  promote: { enabled: boolean; reason: string | null };
  reject: { enabled: boolean; reason: string | null };
  revoke: { enabled: boolean; reason: string | null };
}

/**
 * Memory decisions: promote requires a pending entry whose referenced content
 * still hash-matches (NO_HASH / drift is a hard refuse, not a silent skip);
 * revoke requires promoted. Mirrors decideMemory / revokeMemory guards.
 */
export function deriveMemoryControls(entry: MemoryEntryLike): MemoryControls {
  const pending = entry.state === "pending";
  return {
    promote: !pending
      ? { enabled: false, reason: `entry is ${entry.state}, not pending` }
      : entry.verified
        ? { enabled: true, reason: null }
        : {
            enabled: false,
            reason:
              "the referenced artifact content no longer matches the recorded sha256 (or has no hash) — refusing to promote",
          },
    reject: pending
      ? { enabled: true, reason: null }
      : { enabled: false, reason: `entry is ${entry.state}, not pending` },
    revoke:
      entry.state === "promoted"
        ? { enabled: true, reason: null }
        : { enabled: false, reason: "only a promoted entry can be revoked" },
  };
}

// ── Snapshot error mapping (owner / API honesty) ─────────────────

/** Map a tRPC failure on enterprise.snapshot to the honest headline. */
export function describeSnapshotError(
  code: string | undefined,
  message: string,
  enterpriseId: number,
): string {
  if (code === "NOT_FOUND") {
    return `enterprise #${enterpriseId} does not exist (or was never materialized).`;
  }
  if (code === "FORBIDDEN") {
    return "this enterprise belongs to a different owner.";
  }
  return `the enterprise snapshot could not be loaded (${message}). The Director API may be unavailable.`;
}

// ── Program controls (start/pause/resume/cancel/pump) ────────────

export type ProgramControlId = "start" | "pause" | "resume" | "cancel" | "pump";

export interface ProgramControl {
  id: ProgramControlId;
  /** ENTERPRISE_ACTIONS id this control dispatches, when one exists. */
  actionId: string | null;
  label: string;
  enabled: boolean;
  reason: string | null;
  destructive?: boolean;
}

export const PROGRAM_TERMINAL_STATES: readonly CeoProgramState[] = [
  "completed",
  "failed",
  "stopped_budget",
  "stopped_human",
];

export function deriveProgramControls(program: ProgramRowLike): ProgramControl[] {
  const paused = program.pausedAt !== null;
  const live = program.state === "dispatching" || program.state === "running";
  const terminal = PROGRAM_TERMINAL_STATES.includes(program.state);
  return [
    {
      id: "start",
      actionId: "program.start",
      label: "Start dispatch",
      enabled: program.state === "awaiting_plan_approval",
      reason:
        program.state === "awaiting_plan_approval"
          ? null
          : `program is ${program.state}; start requires awaiting_plan_approval`,
    },
    {
      id: "pause",
      actionId: "program.pause",
      label: "Pause",
      enabled: live && !paused,
      reason: live && !paused ? null : paused ? "program is already paused" : `program is ${program.state}; only dispatching/running programs pause`,
    },
    {
      id: "resume",
      actionId: "program.resume",
      label: "Resume",
      enabled: live && paused,
      reason: live && paused ? null : "program is not paused",
    },
    {
      id: "cancel",
      actionId: "program.cancel",
      label: "Cancel program",
      enabled: !terminal,
      reason: terminal ? `program already reached terminal state ${program.state}` : null,
      destructive: true,
    },
    {
      id: "pump",
      actionId: null, // enterprise.programPump — manual reconcile; not in ENTERPRISE_ACTIONS
      label: "Pump / reconcile",
      enabled: live && !paused,
      reason: live && !paused ? null : paused ? "program is paused — the pump refuses to dispatch" : `program is ${program.state}; nothing to pump`,
    },
  ];
}

// ── Departments / shared worker pool ─────────────────────────────

export interface DepartmentPoolRow {
  id: number;
  key: string;
  name: string;
  discipline: Discipline;
  ownerCompanyKey: string;
  contracts: ContractRowLike[];
  staffedContracts: number;
  unstaffedContracts: number;
  workers: WorkerRowLike[];
  /** Group-wide capacity across origin + secondee workers. */
  capacityGroupId: string | null;
  totalCapacity: number;
  suspendedWorkers: number;
}

/** Department pool truth: contracts + real pooled workers per department. */
export function deriveDepartmentPool(
  snapshot: SnapshotLike,
  workers: WorkerRowLike[],
): DepartmentPoolRow[] {
  const companyById = new Map(snapshot.companies.map((c) => [c.id, c]));
  return snapshot.departments.map((d) => {
    const contracts = snapshot.contracts.filter((w) => w.departmentId === d.id);
    const pool = workers.filter((w) => w.departmentId === d.id);
    return {
      id: d.id,
      key: d.key,
      name: d.name,
      discipline: d.discipline,
      ownerCompanyKey: companyById.get(d.companyId)?.key ?? "unknown",
      contracts,
      staffedContracts: contracts.filter((w) => w.staffed).length,
      unstaffedContracts: contracts.filter((w) => !w.staffed).length,
      workers: pool,
      capacityGroupId: contracts.find((w) => w.capacityGroupId)?.capacityGroupId ?? null,
      totalCapacity: pool.reduce((acc, w) => acc + w.maxConcurrentClaims, 0),
      suspendedWorkers: pool.filter((w) => w.status === "suspended").length,
    };
  });
}

// ── Ledger filters (company / department / employee) ─────────────

export interface LedgerFilter {
  companyKey: string | null;
  departmentId: number | null;
  workerId: number | null;
  kind: WorkLedgerEntry["kind"] | null;
}

export const EMPTY_LEDGER_FILTER: LedgerFilter = {
  companyKey: null,
  departmentId: null,
  workerId: null,
  kind: null,
};

export interface LedgerMaps {
  companyKeyByRunId: Map<string, string>;
  companyKeyByProjectId: Map<string, string>;
  companyKeyByWorkerId: Map<string, string>;
  departmentIdByWorkerId: Map<string, number>;
}

/** Cross-reference maps between ledger entries and the org graph. */
export function buildLedgerMaps(
  snapshot: SnapshotLike,
  workers: WorkerRowLike[],
): LedgerMaps {
  const companyKeyByRunId = new Map<string, string>();
  for (const cr of snapshot.program?.companyRuns ?? []) {
    if (cr.runId !== null) companyKeyByRunId.set(String(cr.runId), cr.companyKey);
  }
  const companyKeyByProjectId = new Map<string, string>();
  for (const c of snapshot.companies) companyKeyByProjectId.set(String(c.projectId), c.key);
  const companyKeyByWorkerId = new Map<string, string>();
  const departmentIdByWorkerId = new Map<string, number>();
  for (const w of workers) {
    if (w.companyKey) companyKeyByWorkerId.set(String(w.id), w.companyKey);
    if (w.departmentId !== null) departmentIdByWorkerId.set(String(w.id), w.departmentId);
  }
  return { companyKeyByRunId, companyKeyByProjectId, companyKeyByWorkerId, departmentIdByWorkerId };
}

/** Resolve the company a ledger entry belongs to (run → companyRun, else project → company). */
export function ledgerEntryCompanyKey(entry: WorkLedgerEntry, maps: LedgerMaps): string | null {
  if (entry.companyKey) return entry.companyKey;
  if (entry.runId !== null) {
    const hit = maps.companyKeyByRunId.get(String(entry.runId));
    if (hit) return hit;
  }
  if (entry.projectId !== null) {
    return maps.companyKeyByProjectId.get(String(entry.projectId)) ?? null;
  }
  return null;
}

/**
 * Filter ledger bullets by company / department / employee. Department
 * matching is honest about both paths: the entry's worker pooled under that
 * department, or the node key equal to the department's discipline (the
 * blueprint names each company DAG node after its contract discipline).
 */
export function filterLedger(
  entries: WorkLedgerEntry[],
  maps: LedgerMaps,
  filter: LedgerFilter,
  departments: DepartmentRowLike[] = [],
): WorkLedgerEntry[] {
  return entries.filter((e) => {
    if (filter.kind !== null && e.kind !== filter.kind) return false;
    if (filter.workerId !== null && String(e.workerId) !== String(filter.workerId)) return false;
    if (filter.companyKey !== null && ledgerEntryCompanyKey(e, maps) !== filter.companyKey) return false;
    if (filter.departmentId !== null) {
      const dept = departments.find((d) => d.id === filter.departmentId);
      const byWorker =
        e.workerId !== null && maps.departmentIdByWorkerId.get(String(e.workerId)) === filter.departmentId;
      const byDiscipline = dept !== undefined && e.nodeKey !== null && e.nodeKey === dept.discipline;
      if (!byWorker && !byDiscipline) return false;
    }
    return true;
  });
}

// ── Deterministic steward recommendations (system, no providers) ──

/**
 * Cache/steward recommendations derived deterministically from snapshot facts.
 * Every recommendation passes the contract StewardRecommendationSchema and is
 * labeled derivedBy "system" / providerCalls false — the UI must never
 * present these as model output.
 */
export function deriveStewardRecommendations(
  snapshot: SnapshotLike,
  workers: WorkerRowLike[],
  ledgerTotal: number | null,
): StewardRecommendation[] {
  const out: StewardRecommendation[] = [];
  const push = (rec: StewardRecommendation) => {
    const parsed = StewardRecommendationSchema.safeParse(rec);
    if (parsed.success) out.push(parsed.data);
  };

  const unstaffed = snapshot.contracts.filter((w) => !w.staffed && w.status === "proposed");
  if (unstaffed.length > 0) {
    push({
      steward: "cache-budget-steward",
      kind: "budget",
      derivedBy: "system",
      providerCalls: false,
      summary:
        `${unstaffed.length} proposed contract(s) pin skills that are not vetted (${unstaffed
          .map((w) => w.skillPin.skillId)
          .slice(0, 3)
          .join(", ")}${unstaffed.length > 3 ? "…" : ""}). They hold no budget and cannot mint workers; reject them or leave them proposed.`,
      refs: [],
      ledgerSeq: null,
      actionId: "contract.decide",
    });
  }

  const inactive = snapshot.companies.filter((c) => !c.active);
  if (inactive.length > 0) {
    push({
      steward: "cache-budget-steward",
      kind: "cache",
      derivedBy: "system",
      providerCalls: false,
      summary: `${inactive.length} compan${inactive.length === 1 ? "y is" : "ies are"} inactive (${inactive
        .map((c) => c.key)
        .join(", ")}) — zero budget reservation. Capacity is fully reserved by the active set.`,
      refs: [],
      ledgerSeq: null,
      actionId: null,
    });
  }

  if (ledgerTotal !== null) {
    push({
      steward: "evidence-ledger-steward",
      kind: "ledger",
      derivedBy: "system",
      providerCalls: false,
      summary:
        ledgerTotal === 0
          ? "The work ledger is empty: no company run has produced evidence yet. Dispatch requires approved company plans (the plan gate) and an started program."
          : `The work ledger holds ${ledgerTotal} derived bullet(s) across this enterprise's runs. All entries are reference-only; artifacts carry content hashes.`,
      refs: [],
      ledgerSeq: null,
      actionId: ledgerTotal === 0 ? "program.start" : null,
    });
  }

  const suspended = workers.filter((w) => w.status === "suspended");
  if (suspended.length > 0) {
    push({
      steward: "blueprint-ops",
      kind: "handoff",
      derivedBy: "system",
      providerCalls: false,
      summary: `${suspended.length} pooled worker(s) suspended (${suspended
        .map((w) => w.name)
        .slice(0, 3)
        .join(", ")}${suspended.length > 3 ? "…" : ""}). Suspended workers fail claim eligibility; resume them to restore capacity or reassign them to another department pool.`,
      refs: [],
      ledgerSeq: null,
      actionId: "worker.suspend",
    });
  }

  if (snapshot.program && PROGRAM_TERMINAL_STATES.includes(snapshot.program.state)) {
    push({
      steward: "roadmap-cartographer",
      kind: "ledger",
      derivedBy: "system",
      providerCalls: false,
      summary: `Program reached terminal state "${snapshot.program.state}". The projection is frozen at blueprint ${snapshot.program.blueprintHash.slice(0, 12)}…; apply a new blueprint revision to reopen the roadmap.`,
      refs: [],
      ledgerSeq: null,
      actionId: null,
    });
  }

  return out;
}

// ── ENTERPRISE_ACTIONS coverage (action → real control parity) ────

/**
 * Where each declarative action is dispatched in this UI. Every registry id
 * must appear here (tested); an action with no surface would be omitted with
 * an explicit reason instead of a dead control.
 */
export const ENTERPRISE_ACTION_SURFACES: Record<string, string> = {
  "blueprint.apply": "enterprise create flow (preview → confirm apply)",
  "contract.decide": "contracts panel (approve / reject with confirmation)",
  "contract.release": "contracts panel (drain → release)",
  "program.start": "program panel",
  "program.pause": "program panel",
  "program.resume": "program panel",
  "program.cancel": "program panel (destructive confirmation)",
  "worker.reassign": "worker pool (department reassignment)",
  "worker.capacity": "worker pool (concurrency capacity)",
  "worker.suspend": "worker pool (suspend / resume)",
  "memory.promote": "memory panel (promote / reject decision)",
  "memory.revoke": "memory panel (revoke promoted entry)",
};

export interface ActionCoverageRow {
  id: string;
  operation: string;
  approval: string | null;
  procedure: string | null;
  surface: string | null;
  covered: boolean;
}

/**
 * Parity report between the shared ENTERPRISE_ACTIONS registry, the
 * procedures the server advertises (enterprise.actions), and the controls
 * this dashboard actually renders.
 */
export function deriveActionCoverage(
  serverActions: readonly { id: string; operation: string; approval: string | null; procedure: string | null }[] | undefined,
): ActionCoverageRow[] {
  const byId = new Map((serverActions ?? []).map((a) => [a.id, a]));
  return ENTERPRISE_ACTIONS.map((a) => {
    const server = byId.get(a.id);
    const surface = ENTERPRISE_ACTION_SURFACES[a.id] ?? null;
    return {
      id: a.id,
      operation: a.operation,
      approval: a.approval,
      procedure: server?.procedure ?? null,
      surface,
      covered: surface !== null && (server?.procedure ?? null) !== null,
    };
  });
}

// ── Blueprint preview → apply (hash-pinned idempotency) ──────────

export interface BlueprintFormInput {
  preset: "creative_technology_group";
  programId: string;
  name: string;
  mission: string;
  budget: EnterpriseBudget;
  maxReplans: number;
  maxConcurrentRuns: number;
}

export interface BlueprintPreviewLike {
  blueprint: EnterpriseBlueprint;
  blueprintHash: string;
  payloadHash: string;
}

export interface ApplyBlueprintInput extends BlueprintFormInput {
  expectedBlueprintHash: string;
  expectedPayloadHash: string;
  approved: true;
}

/**
 * Build the exact apply-mutation input from a preview. The hashes come from
 * the server preview and are re-verified against the contract hash of the
 * previewed blueprint — drift between what the human saw and what is applied
 * is rejected by construction (the server re-checks and returns CONFLICT).
 */
export function buildApplyInput(preview: BlueprintPreviewLike): ApplyBlueprintInput {
  const bp = preview.blueprint;
  const recomputed = blueprintHash(bp);
  if (recomputed !== preview.blueprintHash) {
    throw new Error(
      `preview hash mismatch: server returned ${preview.blueprintHash} but the contract hash of the previewed blueprint is ${recomputed} — refusing to apply`,
    );
  }
  return {
    preset: bp.preset,
    programId: bp.programId,
    name: bp.name,
    mission: bp.mission,
    budget: bp.budget,
    maxReplans: bp.maxReplans,
    maxConcurrentRuns: bp.maxConcurrentRuns,
    expectedBlueprintHash: preview.blueprintHash,
    expectedPayloadHash: preview.payloadHash,
    approved: true,
  };
}

/** Default CEO budget envelope for the create form (honest, editable). */
export function defaultEnterpriseBudget(): EnterpriseBudget {
  return {
    maxTokens: 2_000_000,
    maxCalls: 400,
    maxMinutes: 480,
    maxCostUsdMicros: 25_000_000, // $25.00
  };
}

/** Default program id suggestion (kebab-case; editable). */
export function defaultProgramId(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 48);
  return slug || "ctg-program";
}

// ── Graph layout (deterministic; consumed by the lazy SVG graph) ──

export interface GraphLayoutNode {
  key: string;
  kind: "company" | "department" | "contract";
  label: string;
  status: WorkerContractStatus | null;
  x: number;
  y: number;
}

export interface GraphLayout {
  width: number;
  height: number;
  nodes: GraphLayoutNode[];
  edges: { key: string; from: string; to: string; kind: "contains" | "serves" }[];
}

const COL_X = { company: 30, department: 400, contract: 770 } as const;
const ROW_H = 64;
const COL_W = 340;

/**
 * Deterministic three-column layout (enterprise → company → department →
 * contract reading order). Node keys/kind come from the contract view, so the
 * rendered graph and the canonical lists share one source (parity by
 * construction — selection ids are list row keys).
 */
export function layoutEnterpriseView(view: EnterpriseView): GraphLayout {
  const columns: Record<string, GraphLayoutNode[]> = { company: [], department: [], contract: [] };
  for (const n of view.graph.nodes) {
    columns[n.kind].push({
      key: n.key,
      kind: n.kind,
      label: n.label,
      status: n.status,
      x: COL_X[n.kind],
      y: 0,
    });
  }
  let maxRows = 0;
  for (const kind of ["company", "department", "contract"] as const) {
    columns[kind].forEach((n, i) => {
      n.y = 30 + i * ROW_H;
    });
    maxRows = Math.max(maxRows, columns[kind].length);
  }
  return {
    width: COL_X.contract + COL_W,
    height: Math.max(120, 30 + maxRows * ROW_H),
    nodes: [...columns.company, ...columns.department, ...columns.contract],
    edges: view.graph.edges,
  };
}

export const GRAPH_NODE_W = COL_W - 20;
export const GRAPH_NODE_H = ROW_H - 14;
