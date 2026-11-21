import {
  ALL_DISCIPLINE_SKILL_IDS,
  blueprintHash,
  deriveEnterpriseView,
  generateEnterpriseBlueprint,
  type EnterpriseBlueprint,
  type WorkLedgerEntry,
} from "@contracts/enterprise";
import type {
  CompanyRowLike,
  ContractRowLike,
  DepartmentRowLike,
  ProgramRowLike,
  RevisionLike,
  SnapshotLike,
  WorkerRowLike,
} from "./adapter";

/**
 * Deterministic fixtures built from the REAL contract generator — the same
 * five companies / seven shared departments / nine contracts the server
 * materializes, so UI tests exercise the true blueprint shape.
 */

export const FIXTURE_INPUT = {
  preset: "creative_technology_group",
  programId: "ctg-2026",
  name: "Creative Technology Group",
  mission: "Coordinate five companies toward civilization-scale creative technology.",
  budget: { maxTokens: 2_000_000, maxCalls: 400, maxMinutes: 480, maxCostUsdMicros: 25_000_000 },
  availableSkillIds: ALL_DISCIPLINE_SKILL_IDS.filter(
    (id) => id !== "music-theory-production-engineering",
  ) as string[],
  maxReplans: 2,
  maxConcurrentRuns: 4,
} as const;

export function blueprintFixture(): EnterpriseBlueprint {
  return generateEnterpriseBlueprint({ ...FIXTURE_INPUT, availableSkillIds: [...FIXTURE_INPUT.availableSkillIds] });
}

/** Contract status overrides keyed by contract key (for control-state tests). */
export function snapshotFixture(overrides?: {
  contractStatus?: Record<string, { status: ContractRowLike["status"]; secondeeWorkerId?: number | null; capacityGroupId?: string | null }>;
  programState?: ProgramRowLike["state"];
  pausedAt?: Date | null;
}): SnapshotLike {
  const bp = blueprintFixture();
  const companies: CompanyRowLike[] = bp.companies.map((c, i) => ({
    id: i + 1,
    key: c.key,
    name: c.name,
    kind: c.kind,
    mission: c.mission,
    disciplines: [...c.disciplines],
    capacityShare: c.capacityShare,
    projectId: 101 + i,
    // mirror the materializer: active iff at least one staffed contract serves it
    active: bp.contracts.some((w) => w.companyKey === c.key && w.staffed),
  }));
  const sharedId = companies.find((c) => c.kind === "shared-services")!.id;
  const departments: DepartmentRowLike[] = bp.departments.map((d, i) => ({
    id: 11 + i,
    key: d.key,
    companyId: sharedId,
    name: d.name,
    discipline: d.discipline,
  }));
  const contracts: ContractRowLike[] = bp.contracts.map((w, i) => {
    const o = overrides?.contractStatus?.[w.key];
    return {
      id: 21 + i,
      key: w.key,
      companyId: companies.find((c) => c.key === w.companyKey)!.id,
      departmentId: departments.find((d) => d.key === w.departmentKey)!.id,
      discipline: w.discipline,
      status: o?.status ?? "proposed",
      version: 1,
      capacityShare: w.capacityShare,
      skillPin: { ...w.skillPin },
      staffed: w.staffed,
      secondeeWorkerId: o?.secondeeWorkerId ?? null,
      capacityGroupId: o?.capacityGroupId ?? null,
      decidedBy: null,
    };
  });
  const program: ProgramRowLike = {
    id: 7,
    state: overrides?.programState ?? "awaiting_plan_approval",
    version: 2,
    blueprintHash: blueprintHash(bp),
    blueprint: bp,
    companyRuns: bp.companies.map((c) => ({ companyKey: c.key, runId: null, status: "pending" as const })),
    budget: bp.budget,
    maxReplans: bp.maxReplans,
    maxConcurrentRuns: bp.maxConcurrentRuns,
    pausedAt: overrides?.pausedAt ?? null,
  };
  return {
    enterprise: {
      id: 1,
      slug: bp.programId,
      name: bp.name,
      goal: bp.mission,
      status: "active",
      budget: bp.budget,
      maxConcurrentRuns: bp.maxConcurrentRuns,
      version: 3,
    },
    program,
    companies,
    departments,
    contracts,
    view: deriveEnterpriseView({
      blueprint: bp,
      program: {
        contractVersion: 1,
        programId: bp.programId,
        state: program.state,
        version: program.version,
        blueprintHash: program.blueprintHash,
        companyRuns: program.companyRuns,
        maxReplans: program.maxReplans,
        maxConcurrentRuns: program.maxConcurrentRuns,
        budget: program.budget,
      },
    }),
    usage: { promptTokens: 100_000, completionTokens: 50_000, calls: 12, costUsdMicros: 1_250_000 },
  };
}

export function workersFixture(snapshot: SnapshotLike): WorkerRowLike[] {
  const mathDept = snapshot.departments.find((d) => d.discipline === "mathematics")!;
  const designDept = snapshot.departments.find((d) => d.discipline === "design")!;
  const shared = snapshot.companies.find((c) => c.kind === "shared-services")!;
  const aiCyber = snapshot.companies.find((c) => c.key === "ai-cyber")!;
  return [
    {
      id: 501,
      projectId: shared.projectId,
      name: "pool:svc-mathematics",
      role: "Research Scientist",
      status: "active",
      maxConcurrentClaims: 2,
      capacityGroupId: `ent-1:dept-${mathDept.id}`,
      departmentId: mathDept.id,
      companyKey: shared.key,
    },
    {
      id: 502,
      projectId: aiCyber.projectId,
      name: "secondee:ai-cyber--svc-mathematics",
      role: "Research Scientist",
      status: "suspended",
      maxConcurrentClaims: 1,
      capacityGroupId: `ent-1:dept-${mathDept.id}`,
      departmentId: mathDept.id,
      companyKey: aiCyber.key,
    },
    {
      id: 503,
      projectId: shared.projectId,
      name: "pool:svc-design",
      role: "Research Scientist",
      status: "active",
      maxConcurrentClaims: 1,
      capacityGroupId: `ent-1:dept-${designDept.id}`,
      departmentId: designDept.id,
      companyKey: shared.key,
    },
  ];
}

export function revisionsFixture(state: "none" | "draft" | "approved"): RevisionLike[] {
  if (state === "none") return [];
  if (state === "draft") {
    return [
      { id: 900, revision: 1, approvedAt: null, planHash: "a".repeat(64) },
    ];
  }
  return [
    { id: 901, revision: 2, approvedAt: null, planHash: "b".repeat(64) },
    { id: 900, revision: 1, approvedAt: new Date("2026-01-01T00:00:00Z"), planHash: "a".repeat(64) },
  ];
}

let ledgerSeq = 0;
export function ledgerEntry(partial: Partial<WorkLedgerEntry>): WorkLedgerEntry {
  ledgerSeq += 1;
  return {
    seq: ledgerSeq,
    ts: 1_700_000_000_000 + ledgerSeq * 1000,
    enterpriseId: "1",
    companyKey: null,
    projectId: null,
    officeId: null,
    roomId: null,
    workerId: null,
    nodeKey: null,
    runId: null,
    attempt: null,
    kind: "assignment",
    status: "claimed",
    intendedAsk: "",
    promptSha256: null,
    returnedSummary: "",
    artifactRef: null,
    usage: null,
    skillRef: null,
    ...partial,
  };
}
