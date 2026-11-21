import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "./queries/connection";
import {
  artifacts,
  budgetLedger,
  dagRevisions,
  enterpriseCompanies,
  enterpriseDepartments,
  enterpriseEvents,
  enterprisePrograms,
  enterprises,
  memoryEntries,
  projects,
  registryRoleProfiles,
  registrySkillMappings,
  runEvents,
  runNodes,
  runs,
  skills,
  users,
  workerContracts,
  workers,
  type Enterprise,
  type EnterpriseCompany,
  type EnterpriseDepartment,
  type EnterpriseProgramRow,
  type Run,
  type User,
  type Worker,
  type WorkerContractRow,
} from "@db/schema";
import {
  ENTERPRISE_ACTIONS,
  LEDGER_TEXT_CAPS,
  PERMANENT_STEWARD_ROLES,
  ZERO_RESERVATION,
  blueprintHash,
  canonicalJson,
  deriveEnterpriseView,
  deriveTimelineIndex,
  enterpriseApprovalPayloadHash,
  generateEnterpriseBlueprint,
  partitionBudget,
  sha256Hex,
  type EnterpriseBlueprint,
  type EnterpriseView,
  type GenerateBlueprintInput,
  type WorkLedgerEntry,
} from "@contracts/enterprise";
import {
  defaultNodeBudget,
  defaultRunBudget,
  defaultTermination,
  usdToMicros,
  type DagSpec,
  type NodeSpec,
  type RunBudget,
} from "@contracts/dag";
import { TERMINAL_RUN_STATES, type EventActor } from "@contracts/run";

/**
 * Enterprise / CEO mode (web half of contracts/enterprise.ts).
 *
 * Ownership: every entry point goes through mustOwnEnterprise — an owner only
 * ever sees/mutates their own enterprise graph. The blueprint generator and
 * budget partitioner are the SHARED pure contract functions, so web output is
 * byte-identical to the desktop shell for the same inputs.
 *
 * Gates (non-bypassable):
 *   - blueprint apply requires the exact blueprintHash + payloadHash the human
 *     previewed/approved (hash-pinned; drift ⇒ CONFLICT, re-preview required);
 *   - company DAG drafts are materialized UNAPPROVED — the existing plan
 *     approval gate in createRun is the only path to a run;
 *   - live billing gates (confirmLive, pricing) are untouched: program pump
 *     dispatches mock runs only.
 *
 * Capacity: approving a worker contract creates a secondee worker in the
 * borrowing company's project pinned to the same role/skill and sharing the
 * department's capacityGroupId; the control plane counts claims group-wide.
 */

export class EnterpriseError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "EnterpriseError";
    this.code = code;
  }
}

// ── Ownership ────────────────────────────────────────────────────

export async function mustOwnEnterprise(
  userId: number,
  enterpriseId: number,
): Promise<Enterprise> {
  const db = getDb();
  const row = await db.query.enterprises.findFirst({
    where: eq(enterprises.id, enterpriseId),
  });
  if (!row) throw new EnterpriseError("NOT_FOUND", "enterprise not found");
  if (row.ownerId !== userId) {
    throw new EnterpriseError("FORBIDDEN", "not your enterprise");
  }
  return row;
}

// ── Append-only enterprise events (run_events discipline) ────────

export interface EnterpriseEventFields {
  type: string;
  actor: EventActor;
  payload: Record<string, unknown>;
}

/**
 * Transactional seq allocation identical to run_events: the enterprise row is
 * locked FOR UPDATE, the next seq read, the event inserted under the
 * (enterprise_id, seq) unique constraint. No update/delete path exists.
 */
export async function appendEnterpriseEvent(
  enterpriseId: number,
  fields: EnterpriseEventFields,
): Promise<{ seq: number }> {
  const db = getDb();
  return db.transaction(async (tx) => {
    await tx
      .select({ id: enterprises.id })
      .from(enterprises)
      .where(eq(enterprises.id, enterpriseId))
      .for("update");
    const [row] = await tx
      .select({ maxSeq: enterpriseEvents.seq })
      .from(enterpriseEvents)
      .where(eq(enterpriseEvents.enterpriseId, enterpriseId))
      .orderBy(desc(enterpriseEvents.seq))
      .limit(1)
      .for("update");
    const seq = Number(row?.maxSeq ?? 0) + 1;
    await tx.insert(enterpriseEvents).values({
      enterpriseId,
      seq,
      type: fields.type,
      actor: fields.actor,
      payload: fields.payload,
    });
    return { seq };
  });
}

// ── Registry resolution (roles/skills only — never invented) ─────

/** Vetted skill names: the only skills a blueprint may pin as staffed. */
export async function listAvailableSkillIds(): Promise<string[]> {
  const db = getDb();
  const rows = await db
    .select({ name: skills.name })
    .from(skills)
    .where(eq(skills.status, "vetted"));
  return rows.map((r) => r.name).sort();
}

interface ResolvedSkill {
  name: string;
  version: string;
  sha256: string;
  toolsAllowed: string[];
  outputArtifactType: string;
}

async function resolveSkill(name: string): Promise<ResolvedSkill | null> {
  const db = getDb();
  const row = await db.query.skills.findFirst({
    where: and(eq(skills.name, name), eq(skills.status, "vetted")),
  });
  if (!row) return null;
  return {
    name: row.name,
    version: row.version,
    sha256: row.contentSha256,
    toolsAllowed: row.manifest.toolsAllowed ?? [],
    outputArtifactType: row.manifest.outputArtifactTypes[0] ?? "research-brief",
  };
}

/** Deterministic discipline→role resolution through the seeded registry. */
async function resolveRoleForSkill(skillId: string, discipline: string): Promise<string> {
  const db = getDb();
  const mapping = await db.query.registrySkillMappings.findFirst({
    where: eq(registrySkillMappings.skillPack, skillId),
  });
  const slug = mapping?.consumerRoles[0];
  if (slug) {
    const profile = await db.query.registryRoleProfiles.findFirst({
      where: eq(registryRoleProfiles.slug, slug),
    });
    if (profile) return profile.name;
  }
  // Honest fallback: a real registry role (never an invented title).
  void discipline;
  return "Research Scientist";
}

// ── Materialization plan (deterministic; hash-bound to approval) ─

export interface DagDraftPlan {
  companyKey: string;
  /** Node specs; empty for fully unstaffed companies (recorded honestly). */
  nodes: NodeSpec[];
  runBudget: RunBudget;
  /** Contract keys skipped because their skill is unavailable. */
  unstaffedContracts: string[];
}

export interface MaterializationPlan {
  blueprintHash: string;
  companies: {
    key: string;
    name: string;
    kind: string;
    projectName: string;
    mission: string;
  }[];
  departments: { key: string; companyKey: string; name: string; discipline: string }[];
  contracts: {
    key: string;
    companyKey: string;
    departmentKey: string;
    discipline: string;
    staffed: boolean;
    skillId: string;
  }[];
  dagDrafts: DagDraftPlan[];
}

function reservationToRunBudget(reservation: {
  maxTokens: number;
  maxCalls: number;
  maxMinutes: number;
  maxCostUsdMicros: number;
}): RunBudget {
  const base = defaultRunBudget();
  if (reservation.maxTokens <= 0) return base;
  return {
    maxTokens: Math.max(1, Math.min(base.maxTokens, reservation.maxTokens)),
    maxCalls: Math.max(1, Math.min(base.maxCalls, reservation.maxCalls)),
    maxMinutes: Math.max(1, Math.min(base.maxMinutes, Math.floor(reservation.maxMinutes))),
    maxCostUsd: Math.min(
      base.maxCostUsd,
      Math.max(0.01, Math.round(reservation.maxCostUsdMicros / 10_000) / 100),
    ),
  };
}

/**
 * Build the exact materialization plan for a blueprint. Deterministic given
 * (blueprint, resolved skills, role registry): the payloadHash the human
 * approves binds to THIS plan, and apply re-derives and compares it.
 */
export async function buildMaterializationPlan(
  blueprint: EnterpriseBlueprint,
): Promise<MaterializationPlan> {
  const hash = blueprintHash(blueprint);
  const partition = partitionBudget(
    blueprint.budget,
    blueprint.companies.map((c) => ({
      companyKey: c.key,
      capacityShare: c.capacityShare,
      active: true,
    })),
  );
  const reservationByCompany = new Map(
    partition.partitions.map((p) => [p.companyKey, p.reservation]),
  );

  const contractsByCompany = new Map<string, EnterpriseBlueprint["contracts"]>();
  for (const w of blueprint.contracts) {
    const list = contractsByCompany.get(w.companyKey) ?? [];
    list.push(w);
    contractsByCompany.set(w.companyKey, list);
  }

  const dagDrafts: DagDraftPlan[] = [];
  for (const company of blueprint.companies) {
    const nodes: NodeSpec[] = [];
    const unstaffed: string[] = [];
    const companyContracts = contractsByCompany.get(company.key) ?? [];
    for (const w of companyContracts) {
      const resolved = w.staffed ? await resolveSkill(w.skillPin.skillId) : null;
      if (!resolved) {
        unstaffed.push(w.key);
        continue;
      }
      const role = await resolveRoleForSkill(w.skillPin.skillId, w.discipline);
      // A DAG can narrow but never widen the skill manifest's declared tools
      // and output types (server-side validateDag re-checks this at start).
      const wantedTools = ["read", "summarize", "compare", "cite"];
      const toolsAllowed = wantedTools.filter((t) => resolved.toolsAllowed.includes(t));
      nodes.push({
        key: w.discipline, // one contract per discipline per company ⇒ unique
        role,
        skill: { name: resolved.name, version: resolved.version, sha256: resolved.sha256 },
        goal:
          `${company.mission}\n\nDepartment contract ${w.key} (${w.discipline}): ` +
          `deliver a verified ${w.discipline} artifact for ${company.name}.`.slice(0, 4000),
        inputArtifactTypes: [],
        outputArtifactType: resolved.outputArtifactType,
        toolsAllowed: toolsAllowed as NodeSpec["toolsAllowed"],
        resourceUrls: [],
        budget: defaultNodeBudget(),
        termination: defaultTermination(),
      });
    }
    dagDrafts.push({
      companyKey: company.key,
      nodes,
      runBudget: reservationToRunBudget(
        reservationByCompany.get(company.key) ?? ZERO_RESERVATION,
      ),
      unstaffedContracts: unstaffed,
    });
  }

  return {
    blueprintHash: hash,
    companies: blueprint.companies.map((c) => ({
      key: c.key,
      name: c.name,
      kind: c.kind,
      projectName: `${blueprint.name} / ${c.name}`.slice(0, 255),
      mission: c.mission,
    })),
    departments: blueprint.departments.map((d) => ({
      key: d.key,
      companyKey: d.companyKey,
      name: d.name,
      discipline: d.discipline,
    })),
    contracts: blueprint.contracts.map((w) => ({
      key: w.key,
      companyKey: w.companyKey,
      departmentKey: w.departmentKey,
      discipline: w.discipline,
      staffed: w.staffed,
      skillId: w.skillPin.skillId,
    })),
    dagDrafts,
  };
}

// ── Blueprint preview / apply ────────────────────────────────────

export interface BlueprintPreview {
  blueprint: EnterpriseBlueprint;
  blueprintHash: string;
  payloadHash: string;
  plan: MaterializationPlan;
  view: EnterpriseView;
}

export type BlueprintPreviewInput = Omit<GenerateBlueprintInput, "availableSkillIds">;

/** Pure generation + plan derivation; no writes, no provider calls. */
export async function previewBlueprint(
  input: BlueprintPreviewInput,
): Promise<BlueprintPreview> {
  const availableSkillIds = await listAvailableSkillIds();
  const blueprint = generateEnterpriseBlueprint({ ...input, availableSkillIds });
  const plan = await buildMaterializationPlan(blueprint);
  return {
    blueprint,
    blueprintHash: plan.blueprintHash,
    payloadHash: enterpriseApprovalPayloadHash(plan),
    plan,
    view: deriveEnterpriseView({ blueprint, program: null }),
  };
}

/**
 * Materialize a human-approved blueprint. Idempotent on blueprintHash: a
 * replay (same hash) returns the existing program instead of duplicating
 * companies/projects/contracts. Company DAG revisions are created as
 * UNAPPROVED drafts — plan approval stays on the existing dag approve path.
 */
export async function applyBlueprint(
  user: User,
  input: BlueprintPreviewInput & {
    expectedBlueprintHash: string;
    expectedPayloadHash: string;
    /** The human blueprint-activation decision; never defaults true. */
    approved: boolean;
  },
): Promise<{ enterpriseId: number; programId: number; replayed: boolean }> {
  if (input.approved !== true) {
    throw new EnterpriseError(
      "APPROVAL_REQUIRED",
      "blueprint activation requires an explicit human approval of the previewed hash",
    );
  }
  // Strip the approval envelope before generation (strict input schema).
  const preview = await previewBlueprint({
    preset: input.preset,
    programId: input.programId,
    name: input.name,
    mission: input.mission,
    budget: input.budget,
    maxReplans: input.maxReplans,
    maxConcurrentRuns: input.maxConcurrentRuns,
  });
  if (
    preview.blueprintHash !== input.expectedBlueprintHash ||
    preview.payloadHash !== input.expectedPayloadHash
  ) {
    throw new EnterpriseError(
      "BLUEPRINT_DRIFT",
      "the blueprint or materialization plan changed since preview (registry drift) — re-preview and re-approve",
    );
  }
  const db = getDb();

  // Idempotency: the blueprint hash IS the program identity.
  const existingProgram = await db.query.enterprisePrograms.findFirst({
    where: eq(enterprisePrograms.blueprintHash, preview.blueprintHash),
  });
  if (existingProgram) {
    await mustOwnEnterprise(user.id, existingProgram.enterpriseId);
    return {
      enterpriseId: existingProgram.enterpriseId,
      programId: existingProgram.id,
      replayed: true,
    };
  }

  const slug = input.programId;
  let enterprise = await db.query.enterprises.findFirst({
    where: and(eq(enterprises.ownerId, user.id), eq(enterprises.slug, slug)),
  });
  if (!enterprise) {
    try {
      const [row] = await db.insert(enterprises).values({
        ownerId: user.id,
        slug,
        name: input.name,
        goal: input.mission,
        status: "active",
        budget: preview.blueprint.budget,
        maxConcurrentRuns: Math.min(preview.blueprint.maxConcurrentRuns, 4),
      });
      enterprise = (await db.query.enterprises.findFirst({
        where: eq(enterprises.id, Number(row.insertId)),
      }))!;
    } catch {
      enterprise = (await db.query.enterprises.findFirst({
        where: and(eq(enterprises.ownerId, user.id), eq(enterprises.slug, slug)),
      }))!;
    }
  } else if (enterprise.status === "draft") {
    await db
      .update(enterprises)
      .set({ status: "active", version: sql`${enterprises.version} + 1` })
      .where(eq(enterprises.id, enterprise.id));
  }
  const enterpriseId = enterprise.id;

  // Companies + their 1:1 projects (idempotent by unique enterprise/key).
  const companyIdByKey = new Map<string, number>();
  for (const c of preview.plan.companies) {
    const existing = await db.query.enterpriseCompanies.findFirst({
      where: and(
        eq(enterpriseCompanies.enterpriseId, enterpriseId),
        eq(enterpriseCompanies.key, c.key),
      ),
    });
    if (existing) {
      companyIdByKey.set(c.key, existing.id);
      continue;
    }
    const [projectRow] = await db.insert(projects).values({
      ownerId: user.id,
      name: c.projectName,
      goal: c.mission,
      riskTier: "medium",
      status: "draft",
    });
    const projectId = Number(projectRow.insertId);
    const [companyRow] = await db.insert(enterpriseCompanies).values({
      enterpriseId,
      key: c.key,
      name: c.name,
      kind: c.kind as EnterpriseCompany["kind"],
      mission: c.mission,
      disciplines: (preview.blueprint.companies.find((b) => b.key === c.key)?.disciplines ??
        []) as EnterpriseCompany["disciplines"],
      capacityShare:
        preview.blueprint.companies.find((b) => b.key === c.key)?.capacityShare ?? 1,
      projectId,
      // Honest activation: a company whose draft has no staffed nodes (or no
      // contracts at all, e.g. shared-services) is inactive — zero partition.
      active:
        (preview.plan.dagDrafts.find((d) => d.companyKey === c.key)?.nodes.length ?? 0) > 0,
    });
    companyIdByKey.set(c.key, Number(companyRow.insertId));
  }

  // Departments.
  const departmentIdByKey = new Map<string, number>();
  for (const d of preview.plan.departments) {
    const existing = await db.query.enterpriseDepartments.findFirst({
      where: and(
        eq(enterpriseDepartments.enterpriseId, enterpriseId),
        eq(enterpriseDepartments.key, d.key),
      ),
    });
    if (existing) {
      departmentIdByKey.set(d.key, existing.id);
      continue;
    }
    const [row] = await db.insert(enterpriseDepartments).values({
      enterpriseId,
      key: d.key,
      companyId: companyIdByKey.get(d.companyKey)!,
      name: d.name,
      discipline: d.discipline as EnterpriseDepartment["discipline"],
    });
    departmentIdByKey.set(d.key, Number(row.insertId));
  }

  // Contracts (proposed; the human decision comes later via decideContract).
  for (const w of preview.blueprint.contracts) {
    const existing = await db.query.workerContracts.findFirst({
      where: and(
        eq(workerContracts.enterpriseId, enterpriseId),
        eq(workerContracts.key, w.key),
      ),
    });
    if (existing) continue;
    await db.insert(workerContracts).values({
      enterpriseId,
      key: w.key,
      companyId: companyIdByKey.get(w.companyKey)!,
      departmentId: departmentIdByKey.get(w.departmentKey)!,
      discipline: w.discipline,
      status: "proposed",
      version: w.version,
      capacityShare: w.capacityShare,
      skillPin: w.skillPin,
      staffed: w.staffed,
    });
  }

  // DAG drafts (revision 1, UNAPPROVED — plan gate preserved).
  for (const draft of preview.plan.dagDrafts) {
    const companyId = companyIdByKey.get(draft.companyKey)!;
    const company = await db.query.enterpriseCompanies.findFirst({
      where: eq(enterpriseCompanies.id, companyId),
    });
    if (!company) continue;
    const existingRevision = await db.query.dagRevisions.findFirst({
      where: and(eq(dagRevisions.projectId, company.projectId), eq(dagRevisions.revision, 1)),
    });
    if (existingRevision) continue;
    const spec: DagSpec = {
      revision: 1,
      nodes: draft.nodes,
      edges: [],
      budget: draft.runBudget,
    };
    await db.insert(dagRevisions).values({
      projectId: company.projectId,
      revision: 1,
      spec,
      planHash: sha256Hex(canonicalJson(spec)),
      createdBy: user.id,
      approvedBy: null,
      approvedAt: null,
    });
  }

  // The program row (blueprintHash unique = idempotency identity).
  let program: EnterpriseProgramRow;
  try {
    const [row] = await db.insert(enterprisePrograms).values({
      enterpriseId,
      blueprintHash: preview.blueprintHash,
      blueprint: preview.blueprint,
      state: "awaiting_plan_approval",
      companyRuns: preview.blueprint.companies.map((c) => ({
        companyKey: c.key,
        runId: null,
        status: "pending" as const,
      })),
      budget: preview.blueprint.budget,
      maxReplans: preview.blueprint.maxReplans,
      maxConcurrentRuns: Math.min(preview.blueprint.maxConcurrentRuns, 4),
    });
    program = (await db.query.enterprisePrograms.findFirst({
      where: eq(enterprisePrograms.id, Number(row.insertId)),
    }))!;
  } catch {
    // Concurrent apply of the same blueprint lost the unique race — replay.
    const raced = await db.query.enterprisePrograms.findFirst({
      where: eq(enterprisePrograms.blueprintHash, preview.blueprintHash),
    });
    if (raced) return { enterpriseId: raced.enterpriseId, programId: raced.id, replayed: true };
    throw new EnterpriseError("APPLY_FAILED", "program insert failed without a replay target");
  }

  await appendEnterpriseEvent(enterpriseId, {
    type: "blueprint_applied",
    actor: "human",
    payload: {
      blueprintHash: preview.blueprintHash,
      payloadHash: preview.payloadHash,
      companies: preview.plan.companies.length,
      departments: preview.plan.departments.length,
      contracts: preview.plan.contracts.length,
      unstaffedContracts: preview.plan.dagDrafts.flatMap((d) => d.unstaffedContracts),
      programId: program.id,
    },
  });
  return { enterpriseId, programId: program.id, replayed: false };
}

// ── Worker contracts: propose → decide → release ─────────────────

const SECONDEE_CAPABILITIES = ["read", "summarize", "compare", "cite", "classify", "synthesize"];

export function contractCapacityGroupId(enterpriseId: number, departmentId: number): string {
  return `ent-${enterpriseId}:dept-${departmentId}`;
}

async function mustOwnContract(
  userId: number,
  contractId: number,
): Promise<{ contract: WorkerContractRow; enterprise: Enterprise }> {
  const db = getDb();
  const contract = await db.query.workerContracts.findFirst({
    where: eq(workerContracts.id, contractId),
  });
  if (!contract) throw new EnterpriseError("NOT_FOUND", "contract not found");
  const enterprise = await mustOwnEnterprise(userId, contract.enterpriseId);
  return { contract, enterprise };
}

/** Idempotent pool-worker ensure (unique project+name is the identity). */
async function ensurePoolWorker(input: {
  projectId: number;
  name: string;
  role: string;
  skill: ResolvedSkill;
  capacityGroupId: string;
  departmentId: number;
}): Promise<Worker> {
  const db = getDb();
  const existing = await db.query.workers.findFirst({
    where: and(eq(workers.projectId, input.projectId), eq(workers.name, input.name)),
  });
  if (existing) return existing;
  try {
    const [row] = await db.insert(workers).values({
      projectId: input.projectId,
      name: input.name,
      kind: "subagent",
      role: input.role,
      capabilities: SECONDEE_CAPABILITIES,
      skillRefs: [
        { name: input.skill.name, version: input.skill.version, sha256: input.skill.sha256 },
      ],
      status: "active",
      maxConcurrentClaims: 1,
      capacityGroupId: input.capacityGroupId,
      departmentId: input.departmentId,
    });
    return (await db.query.workers.findFirst({ where: eq(workers.id, Number(row.insertId)) }))!;
  } catch {
    const raced = await db.query.workers.findFirst({
      where: and(eq(workers.projectId, input.projectId), eq(workers.name, input.name)),
    });
    if (raced) return raced;
    throw new EnterpriseError("WORKER_SEED_FAILED", `failed to seed pool worker ${input.name}`);
  }
}

/**
 * Human decision on a proposed contract (the decision IS the approval gate —
 * ENTERPRISE_ACTIONS contract.decide has approval null). Approval creates the
 * borrowing-project secondee worker with the same role/skill pin and the
 * department's shared capacityGroupId; rejection revokes. Guarded: only a
 * `proposed` contract can be decided (concurrent decides race on the status).
 */
export async function decideContract(
  user: User,
  contractId: number,
  decision: "approved" | "rejected",
): Promise<WorkerContractRow> {
  const db = getDb();
  const { contract, enterprise } = await mustOwnContract(user.id, contractId);
  if (contract.status !== "proposed") {
    throw new EnterpriseError("BAD_STATE", `contract is ${contract.status}, not proposed`);
  }
  const who = user.name ?? `user-${user.id}`;

  if (decision === "rejected") {
    const [res] = await db
      .update(workerContracts)
      .set({
        status: "revoked",
        decidedBy: who,
        decidedAt: new Date(),
        version: sql`${workerContracts.version} + 1`,
      })
      .where(and(eq(workerContracts.id, contractId), eq(workerContracts.status, "proposed")));
    if (res.affectedRows !== 1) {
      throw new EnterpriseError("CONFLICT", "contract was decided concurrently");
    }
    await appendEnterpriseEvent(enterprise.id, {
      type: "contract_decided",
      actor: "human",
      payload: { contractId, key: contract.key, decision: "rejected", decidedBy: who },
    });
    return (await db.query.workerContracts.findFirst({
      where: eq(workerContracts.id, contractId),
    }))!;
  }

  // Approval: the pinned skill must still resolve in the vetted registry —
  // an unstaffed contract can never mint a worker.
  if (!contract.staffed) {
    throw new EnterpriseError(
      "UNSTAFFED",
      `contract ${contract.key} pins unavailable skill "${contract.skillPin.skillId}" — it stays honestly unstaffed`,
    );
  }
  const skill = await resolveSkill(contract.skillPin.skillId);
  if (!skill) {
    throw new EnterpriseError(
      "SKILL_UNAVAILABLE",
      `skill "${contract.skillPin.skillId}" is no longer vetted; cannot staff the secondee`,
    );
  }
  const department = await db.query.enterpriseDepartments.findFirst({
    where: eq(enterpriseDepartments.id, contract.departmentId),
  });
  const borrowingCompany = await db.query.enterpriseCompanies.findFirst({
    where: eq(enterpriseCompanies.id, contract.companyId),
  });
  const lendingCompany = department
    ? await db.query.enterpriseCompanies.findFirst({
        where: eq(enterpriseCompanies.id, department.companyId),
      })
    : null;
  if (!department || !borrowingCompany || !lendingCompany) {
    throw new EnterpriseError("NOT_FOUND", "contract graph rows missing");
  }
  const role = await resolveRoleForSkill(skill.name, contract.discipline);
  const groupId = contractCapacityGroupId(enterprise.id, department.id);

  // Origin pool worker (lending project) + secondee (borrowing project) share
  // ONE group-wide concurrency slot via capacityGroupId.
  await ensurePoolWorker({
    projectId: lendingCompany.projectId,
    name: `pool:${department.key}`,
    role,
    skill,
    capacityGroupId: groupId,
    departmentId: department.id,
  });
  const secondee = await ensurePoolWorker({
    projectId: borrowingCompany.projectId,
    name: `secondee:${contract.key}`,
    role,
    skill,
    capacityGroupId: groupId,
    departmentId: department.id,
  });

  const [res] = await db
    .update(workerContracts)
    .set({
      status: "active",
      secondeeWorkerId: secondee.id,
      capacityGroupId: groupId,
      decidedBy: who,
      decidedAt: new Date(),
      version: sql`${workerContracts.version} + 1`,
    })
    .where(and(eq(workerContracts.id, contractId), eq(workerContracts.status, "proposed")));
  if (res.affectedRows !== 1) {
    throw new EnterpriseError("CONFLICT", "contract was decided concurrently");
  }
  await appendEnterpriseEvent(enterprise.id, {
    type: "contract_decided",
    actor: "human",
    payload: {
      contractId,
      key: contract.key,
      decision: "approved",
      decidedBy: who,
      secondeeWorkerId: secondee.id,
      capacityGroupId: groupId,
    },
  });
  return (await db.query.workerContracts.findFirst({
    where: eq(workerContracts.id, contractId),
  }))!;
}

/** Count claims currently held by a worker (group-wide drain check helper). */
async function activeClaimsOf(workerId: number | null): Promise<number> {
  if (workerId === null) return 0;
  const db = getDb();
  const [row] = await db
    .select({ n: sql<number>`COUNT(*)` })
    .from(runNodes)
    .where(
      and(
        eq(runNodes.leaseWorkerId, workerId),
        inArray(runNodes.state, ["claimed", "running"]),
      ),
    );
  return Number(row?.n ?? 0);
}

/**
 * Release an active/draining contract: the secondee is suspended (no new
 * claims — the eligibility check fences it before the CAS), in-flight claims
 * drain, and the contract flips to `released` only when the pool is empty.
 * Re-calling release (or the boot sweep) completes a finished drain.
 */
export async function releaseContract(
  user: User | null,
  contractId: number,
): Promise<WorkerContractRow> {
  const db = getDb();
  const contract = await db.query.workerContracts.findFirst({
    where: eq(workerContracts.id, contractId),
  });
  if (!contract) throw new EnterpriseError("NOT_FOUND", "contract not found");
  const enterprise = user
    ? await mustOwnEnterprise(user.id, contract.enterpriseId)
    : (await db.query.enterprises.findFirst({
        where: eq(enterprises.id, contract.enterpriseId),
      }))!;
  if (!enterprise) throw new EnterpriseError("NOT_FOUND", "enterprise not found");
  if (contract.status !== "active" && contract.status !== "draining") {
    throw new EnterpriseError("BAD_STATE", `contract is ${contract.status}; nothing to release`);
  }
  const who = user ? (user.name ?? `user-${user.id}`) : "system";

  if (contract.status === "active") {
    const [res] = await db
      .update(workerContracts)
      .set({ status: "draining", version: sql`${workerContracts.version} + 1` })
      .where(and(eq(workerContracts.id, contractId), eq(workerContracts.status, "active")));
    if (res.affectedRows !== 1) {
      throw new EnterpriseError("CONFLICT", "contract changed concurrently");
    }
    if (contract.secondeeWorkerId) {
      // Suspended workers fail eligibility BEFORE the claim CAS: no new claims.
      await db
        .update(workers)
        .set({ status: "suspended", version: sql`${workers.version} + 1` })
        .where(eq(workers.id, contract.secondeeWorkerId));
    }
    await appendEnterpriseEvent(enterprise.id, {
      type: "contract_draining",
      actor: user ? "human" : "system",
      payload: { contractId, key: contract.key, by: who },
    });
  }

  const inFlight = await activeClaimsOf(contract.secondeeWorkerId);
  if (inFlight > 0) {
    return (await db.query.workerContracts.findFirst({
      where: eq(workerContracts.id, contractId),
    }))!; // honest "draining" state; claims still in flight
  }
  const [res] = await db
    .update(workerContracts)
    .set({ status: "released", version: sql`${workerContracts.version} + 1` })
    .where(and(eq(workerContracts.id, contractId), eq(workerContracts.status, "draining")));
  if (res.affectedRows === 1) {
    await appendEnterpriseEvent(enterprise.id, {
      type: "contract_released",
      actor: user ? "human" : "system",
      payload: { contractId, key: contract.key, by: who },
    });
  }
  return (await db.query.workerContracts.findFirst({
    where: eq(workerContracts.id, contractId),
  }))!;
}

/** Boot-sweep hook: finish contract drains whose claims have completed. */
export async function sweepDrainingContracts(limit = 25): Promise<number> {
  const db = getDb();
  const rows = await db
    .select({ id: workerContracts.id })
    .from(workerContracts)
    .where(eq(workerContracts.status, "draining"))
    .limit(Math.min(limit, 100));
  let completed = 0;
  for (const row of rows) {
    const after = await releaseContract(null, row.id);
    if (after.status === "released") completed += 1;
  }
  return completed;
}

// ── Memory (reference-only, hash-verified) ───────────────────────

async function loadEnterpriseArtifact(enterpriseId: number, artifactId: number) {
  const db = getDb();
  const rows = await db
    .select({ artifact: artifacts, run: runs })
    .from(artifacts)
    .innerJoin(runs, eq(artifacts.runId, runs.id))
    .where(and(eq(artifacts.id, artifactId), eq(runs.enterpriseId, enterpriseId)))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Propose an artifact for a wider memory scope. Ref-only: stores the
 * ArtifactRef (ids + content sha256) plus a bounded EXTRACTIVE summary copied
 * from the artifact row — never a body, never a secret, never LLM text.
 */
export async function proposeMemory(
  user: User,
  enterpriseId: number,
  input: { scope: "enterprise" | "company" | "department" | "office"; scopeKey: string; artifactId: number },
): Promise<{ id: number }> {
  const db = getDb();
  await mustOwnEnterprise(user.id, enterpriseId);
  const found = await loadEnterpriseArtifact(enterpriseId, input.artifactId);
  if (!found) {
    throw new EnterpriseError("NOT_FOUND", "artifact not found in this enterprise");
  }
  const { artifact, run } = found;
  if (!artifact.contentSha256) {
    throw new EnterpriseError(
      "NO_HASH",
      "artifact has no content hash (storage failed at dispatch) — it cannot be promoted by reference",
    );
  }
  const [row] = await db.insert(memoryEntries).values({
    enterpriseId,
    scope: input.scope,
    scopeKey: input.scopeKey,
    artifactRef: {
      artifactId: artifact.id,
      runId: run.id,
      nodeKey: artifact.nodeKey,
      attempt: artifact.attempt,
      kind: artifact.kind,
      title: artifact.title,
      summary: (artifact.summary ?? "").slice(0, LEDGER_TEXT_CAPS.returnedSummary),
      contentSha256: artifact.contentSha256,
    },
    summary: (artifact.summary ?? "").slice(0, LEDGER_TEXT_CAPS.returnedSummary),
    contentSha256: artifact.contentSha256,
    state: "pending",
  });
  await appendEnterpriseEvent(enterpriseId, {
    type: "memory_proposed",
    actor: "human",
    payload: {
      memoryId: Number(row.insertId),
      artifactId: artifact.id,
      scope: input.scope,
      scopeKey: input.scopeKey,
    },
  });
  return { id: Number(row.insertId) };
}

/**
 * The memory-promote approval gate (ENTERPRISE_ACTIONS memory.promote ⇒
 * approval "memory-promote"): an explicit human decision on a pending entry.
 * Guarded exactly like the run approvals decide path.
 */
export async function decideMemory(
  user: User,
  memoryId: number,
  decision: "promote" | "reject",
): Promise<void> {
  const db = getDb();
  const entry = await db.query.memoryEntries.findFirst({
    where: eq(memoryEntries.id, memoryId),
  });
  if (!entry) throw new EnterpriseError("NOT_FOUND", "memory entry not found");
  const enterprise = await mustOwnEnterprise(user.id, entry.enterpriseId);
  if (entry.state !== "pending") {
    throw new EnterpriseError("BAD_STATE", "memory entry already decided");
  }
  const who = user.name ?? `user-${user.id}`;
  const [res] = await db
    .update(memoryEntries)
    .set({
      state: decision === "promote" ? "promoted" : "rejected",
      decidedBy: who,
      decidedAt: new Date(),
    })
    .where(and(eq(memoryEntries.id, memoryId), eq(memoryEntries.state, "pending")));
  if (res.affectedRows !== 1) {
    throw new EnterpriseError("CONFLICT", "memory entry was decided concurrently");
  }
  await appendEnterpriseEvent(enterprise.id, {
    type: "memory_decided",
    actor: "human",
    payload: { memoryId, decision, decidedBy: who },
  });
}

export async function revokeMemory(user: User, memoryId: number): Promise<void> {
  const db = getDb();
  const entry = await db.query.memoryEntries.findFirst({
    where: eq(memoryEntries.id, memoryId),
  });
  if (!entry) throw new EnterpriseError("NOT_FOUND", "memory entry not found");
  const enterprise = await mustOwnEnterprise(user.id, entry.enterpriseId);
  const [res] = await db
    .update(memoryEntries)
    .set({ state: "revoked", decidedBy: user.name ?? `user-${user.id}`, decidedAt: new Date() })
    .where(and(eq(memoryEntries.id, memoryId), eq(memoryEntries.state, "promoted")));
  if (res.affectedRows !== 1) {
    throw new EnterpriseError("BAD_STATE", "only a promoted entry can be revoked");
  }
  await appendEnterpriseEvent(enterprise.id, {
    type: "memory_revoked",
    actor: "human",
    payload: { memoryId },
  });
}

/**
 * Search artifacts across the enterprise's runs (same owner, enterprise-tagged
 * only). Returns refs with hashes; NO artifact bodies are ever selected here.
 */
export async function searchEnterpriseArtifacts(
  userId: number,
  enterpriseId: number,
  query: string,
  limit = 25,
) {
  const db = getDb();
  await mustOwnEnterprise(userId, enterpriseId);
  const q = `%${query.replaceAll("%", "\\%").replaceAll("_", "\\_")}%`;
  const rows = await db
    .select({
      id: artifacts.id,
      runId: artifacts.runId,
      nodeKey: artifacts.nodeKey,
      attempt: artifacts.attempt,
      kind: artifacts.kind,
      title: artifacts.title,
      summary: artifacts.summary,
      contentSha256: artifacts.contentSha256,
    })
    .from(artifacts)
    .innerJoin(runs, eq(artifacts.runId, runs.id))
    .where(
      and(
        eq(runs.enterpriseId, enterpriseId),
        query
          ? sql`(${artifacts.title} LIKE ${q} OR ${artifacts.summary} LIKE ${q})`
          : sql`1=1`,
      ),
    )
    .orderBy(desc(artifacts.id))
    .limit(Math.min(limit, 50));
  return rows.map((r) => ({
    ...r,
    summary: (r.summary ?? "").slice(0, LEDGER_TEXT_CAPS.returnedSummary),
  }));
}

/** List memory entries with live hash verification against the artifact row. */
export async function listMemory(
  userId: number,
  enterpriseId: number,
  scope?: string,
) {
  const db = getDb();
  await mustOwnEnterprise(userId, enterpriseId);
  const rows = await db
    .select()
    .from(memoryEntries)
    .where(
      and(
        eq(memoryEntries.enterpriseId, enterpriseId),
        scope ? eq(memoryEntries.scope, scope as never) : sql`1=1`,
      ),
    )
    .orderBy(desc(memoryEntries.id))
    .limit(200);
  const out = [];
  for (const entry of rows) {
    const artifactId = Number(entry.artifactRef.artifactId);
    const artifact = await db.query.artifacts.findFirst({
      where: eq(artifacts.id, artifactId),
    });
    out.push({
      ...entry,
      /** Live integrity check: the referenced content must still match. */
      verified:
        !!artifact &&
        artifact.contentSha256 !== null &&
        artifact.contentSha256 === entry.contentSha256,
    });
  }
  return out;
}

// ── Enterprise budget partitions (envelope + company) ────────────

export interface EnterpriseUsageTotals {
  promptTokens: number;
  completionTokens: number;
  calls: number;
  costUsdMicros: number;
}

/** Summed ledger usage across ALL runs tagged with an enterprise/company. */
export async function enterpriseUsage(
  enterpriseId: number,
  companyId?: number,
): Promise<EnterpriseUsageTotals> {
  const db = getDb();
  const [row] = await db
    .select({
      prompt: sql<number>`COALESCE(SUM(${budgetLedger.tokensPrompt}), 0)`,
      completion: sql<number>`COALESCE(SUM(${budgetLedger.tokensCompletion}), 0)`,
      calls: sql<number>`COALESCE(SUM(${budgetLedger.calls}), 0)`,
      cost: sql<number>`COALESCE(SUM(${budgetLedger.costUsdMicros}), 0)`,
    })
    .from(budgetLedger)
    .where(
      and(
        eq(budgetLedger.enterpriseId, enterpriseId),
        companyId ? eq(budgetLedger.enterpriseCompanyId, companyId) : sql`1=1`,
      ),
    );
  return {
    promptTokens: Number(row?.prompt ?? 0),
    completionTokens: Number(row?.completion ?? 0),
    calls: Number(row?.calls ?? 0),
    costUsdMicros: Number(row?.cost ?? 0),
  };
}

/** Active (non-terminal) run-budget reservations under an enterprise/company. */
async function activeRunReservations(
  enterpriseId: number,
  companyId?: number,
): Promise<{ maxTokens: number; maxCalls: number; maxCostUsdMicros: number; count: number }> {
  const db = getDb();
  const rows = await db
    .select({ budget: runs.budget })
    .from(runs)
    .where(
      and(
        eq(runs.enterpriseId, enterpriseId),
        companyId ? eq(runs.enterpriseCompanyId, companyId) : sql`1=1`,
        sql`${runs.state} NOT IN (${sql.join(
          [...TERMINAL_RUN_STATES].map((s) => sql`${s}`),
          sql`, `,
        )})`,
      ),
    );
  let maxTokens = 0;
  let maxCalls = 0;
  let maxCostUsdMicros = 0;
  for (const r of rows) {
    maxTokens += r.budget.maxTokens;
    maxCalls += r.budget.maxCalls;
    maxCostUsdMicros += usdToMicros(r.budget.maxCostUsd);
  }
  return { maxTokens, maxCalls, maxCostUsdMicros, count: rows.length };
}

async function companyPartition(
  enterpriseId: number,
  companyId: number,
): Promise<{ active: boolean; reservation: import("@contracts/enterprise").EnterpriseReservation }> {
  const db = getDb();
  const enterprise = await db.query.enterprises.findFirst({
    where: eq(enterprises.id, enterpriseId),
  });
  const companies = await db
    .select()
    .from(enterpriseCompanies)
    .where(eq(enterpriseCompanies.enterpriseId, enterpriseId));
  if (!enterprise) throw new EnterpriseError("NOT_FOUND", "enterprise not found");
  const target = companies.find((c) => c.id === companyId);
  if (!target) throw new EnterpriseError("NOT_FOUND", "company not found in enterprise");
  const result = partitionBudget(
    enterprise.budget,
    companies.map((c) => ({ companyKey: c.key, capacityShare: c.capacityShare, active: c.active })),
  );
  const p = result.partitions.find((x) => x.companyKey === target.key)!;
  return { active: p.active, reservation: p.reservation };
}

/**
 * Pre-dispatch reservation check for createRun's enterpriseContext: the sum
 * of ACTIVE run-budget reservations (plus the candidate run's budget) must
 * fit the enterprise envelope AND the company's partition. Fail-closed.
 */
export async function checkEnterpriseReservation(
  userId: number,
  input: { enterpriseId: number; companyId: number; projectId: number; runBudget: RunBudget },
): Promise<void> {
  const db = getDb();
  await mustOwnEnterprise(userId, input.enterpriseId);
  const company = await db.query.enterpriseCompanies.findFirst({
    where: eq(enterpriseCompanies.id, input.companyId),
  });
  if (!company || company.enterpriseId !== input.enterpriseId) {
    throw new EnterpriseError("NOT_FOUND", "company not found in enterprise");
  }
  if (company.projectId !== input.projectId) {
    throw new EnterpriseError(
      "FORBIDDEN",
      "enterpriseContext project mismatch: the run must target the company's own project",
    );
  }
  if (!company.active) {
    throw new EnterpriseError(
      "BUDGET_EXHAUSTED",
      `company "${company.key}" is inactive — its partition is zero`,
    );
  }
  const candidate = {
    maxTokens: input.runBudget.maxTokens,
    maxCalls: input.runBudget.maxCalls,
    maxCostUsdMicros: usdToMicros(input.runBudget.maxCostUsd),
  };
  const enterprise = await mustOwnEnterprise(userId, input.enterpriseId);
  const envelope = enterprise.budget;
  const entRes = await activeRunReservations(input.enterpriseId);
  if (
    entRes.maxTokens + candidate.maxTokens > envelope.maxTokens ||
    entRes.maxCalls + candidate.maxCalls > envelope.maxCalls ||
    entRes.maxCostUsdMicros + candidate.maxCostUsdMicros > envelope.maxCostUsdMicros
  ) {
    throw new EnterpriseError(
      "BUDGET_EXHAUSTED",
      "enterprise envelope exhausted: active run reservations plus this run exceed the hard budget",
    );
  }
  const { active, reservation } = await companyPartition(input.enterpriseId, input.companyId);
  const compRes = await activeRunReservations(input.enterpriseId, input.companyId);
  if (
    !active ||
    compRes.maxTokens + candidate.maxTokens > reservation.maxTokens ||
    compRes.maxCalls + candidate.maxCalls > reservation.maxCalls ||
    compRes.maxCostUsdMicros + candidate.maxCostUsdMicros > reservation.maxCostUsdMicros
  ) {
    throw new EnterpriseError(
      "BUDGET_EXHAUSTED",
      `company "${company.key}" partition exhausted: active reservations plus this run exceed its reservation`,
    );
  }
}

/**
 * Post-usage overrun check (advanceRun loop, next to checkGrantBudget):
 * actual ledger usage across the enterprise / company partition. Crossing
 * the envelope stops the run stopped_budget honestly and flags the program.
 * Returns true when the run was stopped.
 */
export async function checkEnterpriseOverrun(run: Run): Promise<boolean> {
  if (!run.enterpriseId) return false;
  const db = getDb();
  const enterprise = await db.query.enterprises.findFirst({
    where: eq(enterprises.id, run.enterpriseId),
  });
  if (!enterprise) return false;
  const usage = await enterpriseUsage(run.enterpriseId);
  const envelope = enterprise.budget;
  let breach: { scope: string; dimension: string } | null = null;
  if (usage.promptTokens + usage.completionTokens >= envelope.maxTokens) {
    breach = { scope: "enterprise", dimension: "tokens" };
  } else if (usage.calls >= envelope.maxCalls) {
    breach = { scope: "enterprise", dimension: "calls" };
  } else if (usage.costUsdMicros >= envelope.maxCostUsdMicros) {
    breach = { scope: "enterprise", dimension: "costUsd" };
  } else if (run.enterpriseCompanyId) {
    const { active, reservation } = await companyPartition(
      run.enterpriseId,
      run.enterpriseCompanyId,
    );
    const cu = await enterpriseUsage(run.enterpriseId, run.enterpriseCompanyId);
    if (
      !active ||
      cu.promptTokens + cu.completionTokens >= reservation.maxTokens ||
      cu.calls >= reservation.maxCalls ||
      cu.costUsdMicros >= reservation.maxCostUsdMicros
    ) {
      breach = { scope: "company", dimension: "partition" };
    }
  }
  if (!breach) return false;
  const { setRunState, revokeRunLeases } = await import("./engine/scheduler");
  await appendEnterpriseEvent(run.enterpriseId, {
    type: "enterprise_budget_exceeded",
    actor: "system",
    payload: { ...breach, runId: run.id, usage, envelope },
  });
  const stopped = await setRunState(run.id, "stopped_budget", {
    endReason: `${breach.scope}:${breach.dimension}`,
    actor: "system",
  });
  if (stopped) await revokeRunLeases(run.id, `enterprise ${breach.scope} budget exceeded`);
  // Flag the program honestly; no auto-top-up, no silent continue.
  await db
    .update(enterprisePrograms)
    .set({ state: "stopped_budget", version: sql`${enterprisePrograms.version} + 1` })
    .where(
      and(
        eq(enterprisePrograms.enterpriseId, run.enterpriseId),
        inArray(enterprisePrograms.state, ["dispatching", "running", "reconciling"]),
      ),
    );
  return true;
}

// ── CEO program lifecycle ────────────────────────────────────────

export async function mustOwnProgram(
  userId: number,
  programId: number,
): Promise<{ program: EnterpriseProgramRow; enterprise: Enterprise }> {
  const db = getDb();
  const program = await db.query.enterprisePrograms.findFirst({
    where: eq(enterprisePrograms.id, programId),
  });
  if (!program) throw new EnterpriseError("NOT_FOUND", "program not found");
  const enterprise = await mustOwnEnterprise(userId, program.enterpriseId);
  return { program, enterprise };
}

async function latestApprovedRevision(projectId: number) {
  const db = getDb();
  const rows = await db
    .select()
    .from(dagRevisions)
    .where(eq(dagRevisions.projectId, projectId))
    .orderBy(desc(dagRevisions.revision))
    .limit(10);
  return rows.find((r) => r.approvedAt !== null) ?? null;
}

/**
 * Start dispatching: requires EVERY active company to hold a human-approved
 * DAG revision (the non-bypassable plan gate — createRun re-checks it per
 * dispatch). Guarded state transition awaiting_plan_approval → dispatching.
 */
export async function startProgram(user: User, programId: number): Promise<void> {
  const db = getDb();
  const { program, enterprise } = await mustOwnProgram(user.id, programId);
  if (program.state !== "awaiting_plan_approval") {
    throw new EnterpriseError("BAD_STATE", `program is ${program.state}, not awaiting plan approval`);
  }
  const companies = await db
    .select()
    .from(enterpriseCompanies)
    .where(eq(enterpriseCompanies.enterpriseId, enterprise.id));
  const unapproved: string[] = [];
  for (const c of companies.filter((c) => c.active)) {
    if (!(await latestApprovedRevision(c.projectId))) unapproved.push(c.key);
  }
  if (unapproved.length > 0) {
    throw new EnterpriseError(
      "PLAN_GATE",
      `plan approval required: companies without an approved DAG revision: ${unapproved.join(", ")}`,
    );
  }
  const [res] = await db
    .update(enterprisePrograms)
    .set({ state: "dispatching", version: sql`${enterprisePrograms.version} + 1` })
    .where(
      and(
        eq(enterprisePrograms.id, programId),
        eq(enterprisePrograms.state, "awaiting_plan_approval"),
      ),
    );
  if (res.affectedRows !== 1) {
    throw new EnterpriseError("CONFLICT", "program changed concurrently");
  }
  await appendEnterpriseEvent(enterprise.id, {
    type: "program_started",
    actor: "human",
    payload: { programId, by: user.name ?? `user-${user.id}` },
  });
  await pumpProgram(user, programId);
}

export async function pauseProgram(user: User, programId: number): Promise<void> {
  const db = getDb();
  const { program, enterprise } = await mustOwnProgram(user.id, programId);
  const [res] = await db
    .update(enterprisePrograms)
    .set({ pausedAt: new Date(), version: sql`${enterprisePrograms.version} + 1` })
    .where(
      and(
        eq(enterprisePrograms.id, programId),
        inArray(enterprisePrograms.state, ["dispatching", "running"]),
        sql`${enterprisePrograms.pausedAt} IS NULL`,
      ),
    );
  if (res.affectedRows !== 1) {
    throw new EnterpriseError("BAD_STATE", `program ${program.state} cannot be paused (or already is)`);
  }
  await appendEnterpriseEvent(enterprise.id, {
    type: "program_paused",
    actor: "human",
    payload: { programId },
  });
}

export async function resumeProgram(user: User, programId: number): Promise<void> {
  const db = getDb();
  const { enterprise } = await mustOwnProgram(user.id, programId);
  const [res] = await db
    .update(enterprisePrograms)
    .set({ pausedAt: null, version: sql`${enterprisePrograms.version} + 1` })
    .where(
      and(
        eq(enterprisePrograms.id, programId),
        inArray(enterprisePrograms.state, ["dispatching", "running"]),
        sql`${enterprisePrograms.pausedAt} IS NOT NULL`,
      ),
    );
  if (res.affectedRows !== 1) {
    throw new EnterpriseError("BAD_STATE", "program is not paused");
  }
  await appendEnterpriseEvent(enterprise.id, {
    type: "program_resumed",
    actor: "human",
    payload: { programId },
  });
  await pumpProgram(user, programId);
}

export async function cancelProgram(user: User, programId: number): Promise<void> {
  const db = getDb();
  const { program, enterprise } = await mustOwnProgram(user.id, programId);
  const { stopRun } = await import("./engine/scheduler");
  const who = user.name ?? `user-${user.id}`;
  for (const cr of program.companyRuns) {
    if (cr.runId === null) continue;
    const run = await db.query.runs.findFirst({ where: eq(runs.id, Number(cr.runId)) });
    if (run && !TERMINAL_RUN_STATES.has(run.state)) {
      await stopRun(run.id, who);
    }
  }
  await db
    .update(enterprisePrograms)
    .set({ state: "stopped_human", version: sql`${enterprisePrograms.version} + 1` })
    .where(
      and(
        eq(enterprisePrograms.id, programId),
        sql`${enterprisePrograms.state} NOT IN ('completed','failed','stopped_budget','stopped_human')`,
      ),
    );
  await appendEnterpriseEvent(enterprise.id, {
    type: "program_cancelled",
    actor: "human",
    payload: { programId, by: who },
  });
}

/**
 * Pump: dispatch company runs up to maxConcurrentRuns (hard cap 4) through
 * the existing createRun path (plan approval + budget gates re-checked per
 * run). Idempotent: companyRuns.runId is written once and NEVER redispatched;
 * recovery re-reads recorded run ids and only reconciles their states.
 */
export async function pumpProgram(user: User | null, programId: number): Promise<void> {
  const db = getDb();
  const program = await db.query.enterprisePrograms.findFirst({
    where: eq(enterprisePrograms.id, programId),
  });
  if (!program) return;
  if (program.state !== "dispatching" && program.state !== "running") return;
  if (program.pausedAt) return;
  const enterprise = (await db.query.enterprises.findFirst({
    where: eq(enterprises.id, program.enterpriseId),
  }))!;
  if (!enterprise) return;
  const owner = user ?? (await db.query.users.findFirst({ where: eq(users.id, enterprise.ownerId) }))!;
  if (!owner) return;

  const companies = await db
    .select()
    .from(enterpriseCompanies)
    .where(eq(enterpriseCompanies.enterpriseId, enterprise.id));
  const companyByKey = new Map(companies.map((c) => [c.key, c]));

  // Reconcile recorded runs (never redispatch).
  let companyRuns = [...program.companyRuns];
  let changed = false;
  for (const cr of companyRuns) {
    if (cr.runId === null) continue;
    const run = await db.query.runs.findFirst({ where: eq(runs.id, Number(cr.runId)) });
    if (!run) continue;
    const mapped =
      run.state === "completed"
        ? "completed"
        : run.state === "failed"
          ? "failed"
          : TERMINAL_RUN_STATES.has(run.state)
            ? "stopped"
            : run.state === "queued" || run.state === "running" || run.state === "awaiting_approval"
              ? "running"
              : cr.status;
    if (mapped !== cr.status) {
      cr.status = mapped as typeof cr.status;
      changed = true;
    }
  }

  const cap = Math.min(program.maxConcurrentRuns, 4);
  const activeCount = companyRuns.filter(
    (cr) => cr.status === "running" || (cr.status === "pending" && cr.runId !== null),
  ).length;
  let slots = Math.max(0, cap - activeCount);

  if (slots > 0) {
    const { createRun } = await import("./engine/scheduler");
    for (const cr of companyRuns) {
      if (slots <= 0) break;
      if (cr.runId !== null || cr.status !== "pending") continue;
      const company = companyByKey.get(cr.companyKey);
      if (!company || !company.active) {
        cr.status = "stopped";
        changed = true;
        continue;
      }
      const revision = await latestApprovedRevision(company.projectId);
      if (!revision) continue; // plan gate: wait for human approval
      try {
        const run = await createRun({
          user: owner,
          projectId: company.projectId,
          dagRevisionId: revision.id,
          mode: "mock", // programs never auto-start live billing
          provider: "gateway",
          enterpriseContext: { enterpriseId: enterprise.id, companyId: company.id },
        });
        cr.runId = run.id;
        cr.status = "running";
        changed = true;
        slots -= 1;
        await appendEnterpriseEvent(enterprise.id, {
          type: "company_run_dispatched",
          actor: "system",
          payload: { programId, companyKey: cr.companyKey, runId: run.id },
        });
      } catch (err) {
        // Honest skip: budget/plan failures are recorded, never hidden.
        await appendEnterpriseEvent(enterprise.id, {
          type: "company_run_blocked",
          actor: "system",
          payload: {
            programId,
            companyKey: cr.companyKey,
            reason: err instanceof Error ? err.message.slice(0, 500) : "unknown",
          },
        });
      }
    }
  }

  const allTerminal =
    companyRuns.every((cr) => cr.status === "completed" || cr.status === "failed" || cr.status === "stopped") &&
    companyRuns.some((cr) => cr.runId !== null);
  const nextState = allTerminal
    ? companyRuns.some((cr) => cr.status === "completed")
      ? "completed"
      : "failed"
    : companyRuns.some((cr) => cr.status === "running")
      ? "running"
      : program.state;
  if (changed || nextState !== program.state) {
    await db
      .update(enterprisePrograms)
      .set({
        companyRuns,
        state: nextState as EnterpriseProgramRow["state"],
        version: sql`${enterprisePrograms.version} + 1`,
      })
      .where(
        and(eq(enterprisePrograms.id, programId), eq(enterprisePrograms.version, program.version)),
      );
  }
}

/** Bounded boot-sweep hook: pump active programs (recovery reattaches). */
export async function sweepEnterprisePrograms(limit = 10): Promise<number> {
  const db = getDb();
  const rows = await db
    .select({ id: enterprisePrograms.id })
    .from(enterprisePrograms)
    .where(
      and(
        inArray(enterprisePrograms.state, ["dispatching", "running"]),
        sql`${enterprisePrograms.pausedAt} IS NULL`,
      ),
    )
    .limit(Math.min(limit, 25));
  for (const row of rows) {
    await pumpProgram(null, row.id);
  }
  return rows.length;
}

// ── Work ledger + timeline (derived; no provider calls) ──────────

const LEDGER_EVENT_WINDOW = 500;

/**
 * Derive the enterprise work ledger from EXISTING run/node/artifact/ledger
 * records (runs tagged with this enterprise). Pure derivation: intendedAsk is
 * the node goal (bounded), promptSha256 is an integrity hash over the
 * compiled-prompt metadata recorded at dispatch (the raw prompt text is never
 * stored), returnedSummary is the artifact row's extractive summary, usage is
 * the budget_ledger row for the same (run, node, attempt). Sequence is a
 * deterministic per-enterprise 1-based index over (createdAt, runId, seq).
 */
export async function deriveEnterpriseLedger(
  userId: number,
  enterpriseId: number,
): Promise<WorkLedgerEntry[]> {
  const db = getDb();
  const enterprise = await mustOwnEnterprise(userId, enterpriseId);
  const enterpriseRuns = await db
    .select({ id: runs.id, projectId: runs.projectId })
    .from(runs)
    .where(eq(runs.enterpriseId, enterpriseId))
    .orderBy(runs.id)
    .limit(100);
  if (enterpriseRuns.length === 0) return [];
  const runIds = enterpriseRuns.map((r) => r.id);
  const projectByRun = new Map(enterpriseRuns.map((r) => [r.id, r.projectId]));

  const events = await db
    .select()
    .from(runEvents)
    .where(inArray(runEvents.runId, runIds))
    .orderBy(runEvents.createdAt, runEvents.runId, runEvents.seq)
    .limit(LEDGER_EVENT_WINDOW);

  const artifactRows = await db
    .select()
    .from(artifacts)
    .where(inArray(artifacts.runId, runIds))
    .orderBy(artifacts.id)
    .limit(LEDGER_EVENT_WINDOW);
  const artifactByKey = new Map(
    artifactRows.map((a) => [`${a.runId}:${a.nodeKey}:${a.attempt}`, a]),
  );
  const ledgerRows = await db
    .select()
    .from(budgetLedger)
    .where(inArray(budgetLedger.runId, runIds))
    .orderBy(budgetLedger.id)
    .limit(LEDGER_EVENT_WINDOW);
  const usageByKey = new Map(
    ledgerRows.map((l) => [`${l.runId}:${l.nodeKey}:${l.attempt ?? 1}`, l]),
  );
  const nodeRows = await db
    .select()
    .from(runNodes)
    .where(inArray(runNodes.runId, runIds))
    .limit(LEDGER_EVENT_WINDOW);
  const goalByKey = new Map(
    nodeRows.map((n) => [
      `${n.runId}:${n.nodeKey}`,
      ((n.contract as { goal?: string }).goal ?? "").slice(0, LEDGER_TEXT_CAPS.intendedAsk),
    ]),
  );
  const workerByKey = new Map(
    nodeRows.map((n) => [`${n.runId}:${n.nodeKey}`, n.assignedWorkerId ?? n.leaseWorkerId ?? null]),
  );

  const entries: WorkLedgerEntry[] = [];
  let seq = 0;
  for (const ev of events) {
    const base = {
      ts: ev.createdAt.getTime(),
      enterpriseId: enterprise.slug, // contract: kebab enterprise key
      companyKey: null,
      projectId: projectByRun.get(ev.runId) ?? null,
      officeId: null,
      roomId: null,
      workerId: ev.nodeKey ? (workerByKey.get(`${ev.runId}:${ev.nodeKey}`) ?? null) : null,
      nodeKey: ev.nodeKey ?? null,
      runId: ev.runId,
    };
    const payload = ev.payload as Record<string, unknown>;
    const push = (entry: Omit<WorkLedgerEntry, "seq">) => {
      seq += 1;
      entries.push({ seq, ...entry });
    };
    if (ev.type === "run_created") {
      push({
        ...base,
        attempt: null,
        kind: "assignment",
        status: "created",
        intendedAsk: "",
        promptSha256: null,
        returnedSummary: "",
        artifactRef: null,
        usage: null,
        skillRef: null,
      });
    } else if (ev.type === "node_state" && payload.state === "claimed") {
      push({
        ...base,
        attempt: typeof payload.attempt === "number" ? payload.attempt : null,
        kind: "assignment",
        status: "claimed",
        intendedAsk: ev.nodeKey ? (goalByKey.get(`${ev.runId}:${ev.nodeKey}`) ?? "") : "",
        promptSha256: null,
        returnedSummary: "",
        artifactRef: null,
        usage: null,
        skillRef: null,
      });
    } else if (ev.type === "prompt_compiled") {
      // Integrity hash over the recorded compile metadata (never prompt text).
      const promptSha256 = sha256Hex(
        canonicalJson({
          strategy: payload.strategy,
          bytes: payload.bytes,
          seed: payload.seed,
          plan: payload.plan,
        }),
      );
      push({
        ...base,
        attempt: typeof payload.attempt === "number" ? payload.attempt : null,
        kind: "prompt_started",
        status: "compiled",
        intendedAsk: ev.nodeKey ? (goalByKey.get(`${ev.runId}:${ev.nodeKey}`) ?? "") : "",
        promptSha256,
        returnedSummary: "",
        artifactRef: null,
        usage: null,
        skillRef: typeof payload.strategy === "string" ? payload.strategy.slice(0, 80) : null,
      });
    } else if (ev.type === "artifact_created") {
      const artifactId = typeof payload.artifactId === "number" ? payload.artifactId : null;
      const artifact =
        artifactRows.find((a) => a.id === artifactId) ??
        (ev.nodeKey ? artifactByKey.get(`${ev.runId}:${ev.nodeKey}:1`) : undefined);
      const usageRow = artifact
        ? usageByKey.get(`${artifact.runId}:${artifact.nodeKey}:${artifact.attempt}`)
        : undefined;
      push({
        ...base,
        attempt: artifact?.attempt ?? null,
        kind: "artifact",
        status: artifact?.accepted ? "accepted" : "returned",
        intendedAsk: artifact
          ? (goalByKey.get(`${artifact.runId}:${artifact.nodeKey}`) ?? "")
          : "",
        promptSha256: null,
        returnedSummary: (artifact?.summary ?? "").slice(0, LEDGER_TEXT_CAPS.returnedSummary),
        artifactRef:
          artifact && artifact.contentSha256
            ? {
                artifactId: artifact.id,
                runId: artifact.runId,
                nodeKey: artifact.nodeKey,
                attempt: artifact.attempt,
                kind: artifact.kind,
                title: artifact.title,
                summary: (artifact.summary ?? "").slice(0, LEDGER_TEXT_CAPS.returnedSummary),
                contentSha256: artifact.contentSha256,
              }
            : null,
        usage: usageRow
          ? {
              inputTokens: usageRow.tokensPrompt,
              outputTokens: usageRow.tokensCompletion,
              costUsdMicros: usageRow.costUsdMicros,
            }
          : null,
        skillRef: null,
      });
    } else if (ev.type === "approval_requested" || ev.type === "approval_decided") {
      push({
        ...base,
        attempt: null,
        kind: "approval",
        status: String(payload.decision ?? payload.kind ?? "requested").slice(0, 64),
        intendedAsk: typeof payload.goal === "string" ? payload.goal.slice(0, LEDGER_TEXT_CAPS.intendedAsk) : "",
        promptSha256: null,
        returnedSummary: "",
        artifactRef: null,
        usage: null,
        skillRef: null,
      });
    } else if (ev.type === "node_state" && payload.state === "waiting") {
      push({
        ...base,
        attempt: null,
        kind: "waiting",
        status: String(payload.waitReason ?? "waiting").slice(0, 64),
        intendedAsk: "",
        promptSha256: null,
        returnedSummary: "",
        artifactRef: null,
        usage: null,
        skillRef: null,
      });
    } else if (ev.type === "error" || ev.type === "lease_fenced" || ev.type === "artifact_storage_error") {
      push({
        ...base,
        attempt: typeof payload.attempt === "number" ? payload.attempt : null,
        kind: "error",
        status: ev.type.slice(0, 64),
        intendedAsk: "",
        promptSha256: null,
        returnedSummary: typeof payload.message === "string" ? payload.message.slice(0, 500) : "",
        artifactRef: null,
        usage: null,
        skillRef: null,
      });
    } else if (ev.type === "budget_recorded") {
      push({
        ...base,
        attempt: typeof payload.attempt === "number" ? payload.attempt : null,
        kind: "returned",
        status: payload.simulated ? "usage-simulated" : "usage",
        intendedAsk: "",
        promptSha256: null,
        returnedSummary: "",
        artifactRef: null,
        usage: {
          inputTokens: Number(payload.promptTokens ?? 0),
          outputTokens: Number(payload.completionTokens ?? 0),
          costUsdMicros: Number(payload.costUsdMicros ?? 0),
        },
        skillRef: null,
      });
    }
  }
  return entries;
}

/** Keyset page over the derived ledger (afterSeq / limit, index-ordered). */
export async function enterpriseLedgerPage(
  userId: number,
  enterpriseId: number,
  opts: { afterSeq?: number; limit?: number } = {},
) {
  const all = await deriveEnterpriseLedger(userId, enterpriseId);
  const after = opts.afterSeq ?? 0;
  const limit = Math.min(opts.limit ?? 100, 200);
  const page = all.filter((e) => e.seq > after).slice(0, limit);
  return {
    entries: page,
    nextAfterSeq: page.length ? page[page.length - 1]!.seq : null,
    total: all.length,
  };
}

/** Timeline index: the pure contract derivation over the same ledger. */
export async function enterpriseTimelinePage(
  userId: number,
  enterpriseId: number,
  opts: { afterSeq?: number; limit?: number } = {},
) {
  const ledger = await deriveEnterpriseLedger(userId, enterpriseId);
  const timeline = deriveTimelineIndex(ledger);
  const after = opts.afterSeq ?? 0;
  const limit = Math.min(opts.limit ?? 100, 200);
  const page = timeline.filter((e) => e.seq > after).slice(0, limit);
  return {
    entries: page,
    nextAfterSeq: page.length ? page[page.length - 1]!.seq : null,
    total: timeline.length,
  };
}

// ── Snapshot (content/version/event-seq invalidating cache) ──────

interface SnapshotCacheEntry {
  enterpriseVersion: number;
  maxEventSeq: number;
  snapshot: EnterpriseSnapshotPayload;
}

export interface EnterpriseSnapshotPayload {
  enterprise: Enterprise;
  program: EnterpriseProgramRow | null;
  companies: EnterpriseCompany[];
  departments: EnterpriseDepartment[];
  contracts: WorkerContractRow[];
  view: EnterpriseView | null;
  usage: EnterpriseUsageTotals;
  /** Deterministic system stewards — metadata only, never claimable workers. */
  stewards: typeof PERMANENT_STEWARD_ROLES;
  actions: typeof ENTERPRISE_ACTIONS;
}

const snapshotCache = new Map<number, SnapshotCacheEntry>();

/**
 * Explicit snapshot-namespace invalidation (assistant cache.invalidate). The
 * memo is already content-keyed on (enterprise.version, maxEventSeq), so a
 * stale snapshot is never served; this hook makes invalidation explicit and
 * reports how many memoized entries were dropped.
 */
export function invalidateEnterpriseSnapshotCache(enterpriseId?: number): number {
  if (enterpriseId !== undefined) {
    return snapshotCache.delete(enterpriseId) ? 1 : 0;
  }
  const n = snapshotCache.size;
  snapshotCache.clear();
  return n;
}

/** Read-only cache status for the assistant cache namespace view. */
export function enterpriseSnapshotCacheStatus(): {
  namespace: "snapshot";
  memoizedEntries: number;
  keyedBy: string;
} {
  return {
    namespace: "snapshot",
    memoizedEntries: snapshotCache.size,
    keyedBy: "(enterprise.version, maxEventSeq)",
  };
}

/**
 * Owner-scoped enterprise snapshot. Cache invalidation is content-based: the
 * enterprise OCC version plus the max event seq — any mutation bumps one of
 * them, so a stale snapshot is never served.
 */
export async function getEnterpriseSnapshot(
  userId: number,
  enterpriseId: number,
): Promise<EnterpriseSnapshotPayload> {
  const db = getDb();
  const enterprise = await mustOwnEnterprise(userId, enterpriseId);
  const [seqRow] = await db
    .select({ maxSeq: sql<number>`COALESCE(MAX(${enterpriseEvents.seq}), 0)` })
    .from(enterpriseEvents)
    .where(eq(enterpriseEvents.enterpriseId, enterpriseId));
  const maxEventSeq = Number(seqRow?.maxSeq ?? 0);

  const cached = snapshotCache.get(enterpriseId);
  if (cached && cached.enterpriseVersion === enterprise.version && cached.maxEventSeq === maxEventSeq) {
    return cached.snapshot;
  }

  const [programRows, companyRows, departmentRows, contractRows] = await Promise.all([
    db
      .select()
      .from(enterprisePrograms)
      .where(eq(enterprisePrograms.enterpriseId, enterpriseId))
      .orderBy(desc(enterprisePrograms.id))
      .limit(5),
    db.select().from(enterpriseCompanies).where(eq(enterpriseCompanies.enterpriseId, enterpriseId)),
    db
      .select()
      .from(enterpriseDepartments)
      .where(eq(enterpriseDepartments.enterpriseId, enterpriseId)),
    db.select().from(workerContracts).where(eq(workerContracts.enterpriseId, enterpriseId)),
  ]);
  const program = programRows[0] ?? null;
  const view = program
    ? deriveEnterpriseView({
        blueprint: program.blueprint,
        program: {
          contractVersion: 1,
          programId: enterprise.slug,
          state: program.state,
          version: program.version,
          blueprintHash: program.blueprintHash,
          companyRuns: program.companyRuns,
          maxReplans: program.maxReplans,
          maxConcurrentRuns: program.maxConcurrentRuns,
          budget: program.budget,
        },
      })
    : null;
  const usage = await enterpriseUsage(enterpriseId);
  const snapshot: EnterpriseSnapshotPayload = {
    enterprise,
    program,
    companies: companyRows,
    departments: departmentRows,
    contracts: contractRows,
    view,
    usage,
    stewards: PERMANENT_STEWARD_ROLES,
    actions: ENTERPRISE_ACTIONS,
  };
  snapshotCache.set(enterpriseId, { enterpriseVersion: enterprise.version, maxEventSeq, snapshot });
  return snapshot;
}

/** Shared worker pool across the enterprise's company projects. */
export async function listEnterpriseWorkers(userId: number, enterpriseId: number) {
  const db = getDb();
  await mustOwnEnterprise(userId, enterpriseId);
  const companyRows = await db
    .select()
    .from(enterpriseCompanies)
    .where(eq(enterpriseCompanies.enterpriseId, enterpriseId));
  if (companyRows.length === 0) return [];
  const rows = await db
    .select()
    .from(workers)
    .where(
      inArray(
        workers.projectId,
        companyRows.map((c) => c.projectId),
      ),
    )
    .orderBy(workers.projectId, workers.id)
    .limit(500);
  return rows.map((w) => ({
    ...w,
    companyKey: companyRows.find((c) => c.projectId === w.projectId)?.key ?? null,
    // Steward roles are deterministic system metadata — never claimable.
    steward: false,
  }));
}

async function mustOwnEnterpriseWorker(
  userId: number,
  workerId: number,
): Promise<{ worker: Worker; enterprise: Enterprise }> {
  const db = getDb();
  const worker = await db.query.workers.findFirst({ where: eq(workers.id, workerId) });
  if (!worker) throw new EnterpriseError("NOT_FOUND", "worker not found");
  const company = await db.query.enterpriseCompanies.findFirst({
    where: eq(enterpriseCompanies.projectId, worker.projectId),
  });
  if (!company) throw new EnterpriseError("FORBIDDEN", "worker is not part of an enterprise");
  const enterprise = await mustOwnEnterprise(userId, company.enterpriseId);
  return { worker, enterprise };
}

/** Per-employee controls: suspend/resume, capacity, pool reassignment. */
export async function setEnterpriseWorkerSuspended(
  user: User,
  workerId: number,
  suspended: boolean,
): Promise<Worker> {
  const db = getDb();
  const { worker, enterprise } = await mustOwnEnterpriseWorker(user.id, workerId);
  const next = suspended ? "suspended" : "active";
  if (worker.status === next) return worker;
  const [res] = await db
    .update(workers)
    .set({ status: next, version: sql`${workers.version} + 1` })
    .where(and(eq(workers.id, workerId), eq(workers.version, worker.version)));
  if (res.affectedRows !== 1) throw new EnterpriseError("CONFLICT", "worker changed concurrently");
  await appendEnterpriseEvent(enterprise.id, {
    type: suspended ? "worker_suspended" : "worker_resumed",
    actor: "human",
    payload: { workerId, name: worker.name, by: user.name ?? `user-${user.id}` },
  });
  return (await db.query.workers.findFirst({ where: eq(workers.id, workerId) }))!;
}

export async function setEnterpriseWorkerCapacity(
  user: User,
  workerId: number,
  maxConcurrentClaims: number,
): Promise<Worker> {
  const db = getDb();
  const { worker, enterprise } = await mustOwnEnterpriseWorker(user.id, workerId);
  const bounded = Math.min(Math.max(Math.floor(maxConcurrentClaims), 1), 8);
  const [res] = await db
    .update(workers)
    .set({ maxConcurrentClaims: bounded, version: sql`${workers.version} + 1` })
    .where(and(eq(workers.id, workerId), eq(workers.version, worker.version)));
  if (res.affectedRows !== 1) throw new EnterpriseError("CONFLICT", "worker changed concurrently");
  await appendEnterpriseEvent(enterprise.id, {
    type: "worker_capacity_adjusted",
    actor: "human",
    payload: { workerId, name: worker.name, maxConcurrentClaims: bounded },
  });
  return (await db.query.workers.findFirst({ where: eq(workers.id, workerId) }))!;
}

/** Reassign a pooled worker to a different department's capacity group. */
export async function reassignEnterpriseWorker(
  user: User,
  workerId: number,
  departmentId: number | null,
): Promise<Worker> {
  const db = getDb();
  const { worker, enterprise } = await mustOwnEnterpriseWorker(user.id, workerId);
  let groupId: string | null = null;
  if (departmentId !== null) {
    const department = await db.query.enterpriseDepartments.findFirst({
      where: eq(enterpriseDepartments.id, departmentId),
    });
    if (!department || department.enterpriseId !== enterprise.id) {
      throw new EnterpriseError("NOT_FOUND", "department not found in enterprise");
    }
    groupId = contractCapacityGroupId(enterprise.id, department.id);
  }
  const [res] = await db
    .update(workers)
    .set({ departmentId, capacityGroupId: groupId, version: sql`${workers.version} + 1` })
    .where(and(eq(workers.id, workerId), eq(workers.version, worker.version)));
  if (res.affectedRows !== 1) throw new EnterpriseError("CONFLICT", "worker changed concurrently");
  await appendEnterpriseEvent(enterprise.id, {
    type: "worker_reassigned",
    actor: "human",
    payload: { workerId, name: worker.name, departmentId, capacityGroupId: groupId },
  });
  return (await db.query.workers.findFirst({ where: eq(workers.id, workerId) }))!;
}
