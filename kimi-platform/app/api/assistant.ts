import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "./queries/connection";
import {
  artifacts,
  assistantJobs,
  assistantProposals,
  assistantQueueItems,
  assistantWorkQueues,
  enterpriseCompanies,
  enterpriseDepartments,
  enterprisePrograms,
  enterprises,
  knowledgeTransfers,
  registryRoleResourceLinks,
  registrySkillMappings,
  repoAssignmentPlans,
  repositoryRecords,
  runs,
  studyQueueItems,
  users,
  workerContracts,
  workers,
  type AssistantJobRow,
  type AssistantProposalRow,
  type AssistantQueueItemRow,
  type AssistantWorkQueueRow,
  type Enterprise,
  type GithubIntakeMode,
  type KnowledgeTransferRow,
  type RepositoryRecordRow,
  type User,
} from "@db/schema";
import {
  ASSISTANT_ACTION_POLICIES,
  ASSISTANT_ACTIONS,
  ASSISTANT_CONTRACT_VERSION,
  ASSISTANT_DEFINITIONS,
  ASSISTANT_JOB_POLICIES,
  AssistantActionProposalSchema,
  AssistantContractError,
  AssistantJobSchema,
  AssistantJobScheduleSchema,
  RepositoryMetadataSchema,
  buildKnowledgeTransfer,
  buildStudyQueue,
  createAssistantJob,
  createAssistantProposal,
  routeRepository,
  scheduleNextRun,
  validateAssistantAction,
  type AssistantAction,
  type AssistantActionProposal,
  type AssistantGate,
  type AssistantJob,
  type AssistantScope,
  type RepositoryMetadata,
} from "@contracts/assistant";
import {
  LEDGER_TEXT_CAPS,
  canonicalJson,
  sha256Hex,
  type ArtifactRef,
} from "@contracts/enterprise";
import {
  EnterpriseError,
  appendEnterpriseEvent,
  decideContract,
  deriveEnterpriseLedger,
  enterpriseSnapshotCacheStatus,
  invalidateEnterpriseSnapshotCache,
  mustOwnEnterprise,
  mustOwnProgram,
  pumpProgram,
  releaseContract,
  setEnterpriseWorkerSuspended,
} from "./enterprise";
import { classifyConnectorError, githubInspectRepo } from "./integrations/connectors";
import { decryptRecordSecret, getOwnedRecord } from "./integrations/store";
import { VaultUnavailable } from "./integrations/vault";

/**
 * Donna / shared assistants (web backend half of contracts/assistant.ts).
 *
 * Hard rules enforced here (never in prompt text):
 * - Every mutation is owner-scoped through mustOwnEnterprise; a foreign
 *   enterprise/row is indistinguishable from a missing one.
 * - Assistants act ONLY through typed AssistantActionProposal rows; the
 *   contract's validateAssistantAction (hash/policy/scope/forbidden-keys/
 *   drain-preserve/gates) runs at decide AND at execute. Donna provider text
 *   is never executed — only validated proposal data is.
 * - Proposals are enterprise-scoped and SEPARATE from run approvals.
 * - OCC: expectedVersion pins enterprises.version at execute time; every
 *   successful execution bumps it (and appends an enterprise event), which
 *   also invalidates the snapshot memo.
 * - Executors call EXISTING enterprise/hiring/control functions only.
 * - Emergency stop is NOT an assistant action: the executor rejects any
 *   proposal claiming to be a stop; stop buttons use the existing ungated
 *   programCancel/stopRun paths directly.
 * - Deterministic jobs never call providers, never make paid calls, and never
 *   execute proposals; the sweep is bounded, claim-first (crash-safe), and
 *   skip-forward (no missed-run storm).
 */

export class AssistantError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "AssistantError";
    this.code = code;
  }
}

function mapContractError(err: unknown): never {
  if (err instanceof AssistantContractError) {
    const code =
      err.code === "approval-required"
        ? "APPROVAL_REQUIRED"
        : err.code === "gate-not-confirmed"
          ? "GATE_NOT_CONFIRMED"
          : err.code === "payload-hash-mismatch" ||
              err.code === "policy-mismatch" ||
              err.code === "scope-violation" ||
              err.code === "forbidden-side-effect" ||
              err.code === "drain-preserve-required" ||
              err.code === "unknown-action" ||
              err.code === "unsupported-version"
            ? "VALIDATION"
            : "BAD_REQUEST";
    throw new AssistantError(code, err.message);
  }
  throw err;
}

// ── Web-local enums (contract is byte-pinned; see db/schema.ts) ──

export const ASSISTANT_QUEUE_ITEM_KINDS = [
  "company-run",
  "study",
  "repository-triage",
  "custom",
] as const;
export const ASSISTANT_QUEUE_ITEM_STATUSES = ["queued", "dispatched", "done", "dropped"] as const;
export const ASSISTANT_CACHE_NAMESPACES = [
  "skill-excerpts",
  "blueprint",
  "snapshot",
  "repository-metadata",
] as const;
export type AssistantCacheNamespace = (typeof ASSISTANT_CACHE_NAMESPACES)[number];
export const GITHUB_INTAKE_MODES = ["public-anonymous", "credentialed-approved"] as const;
export const ASSISTANT_LIFECYCLE_STATUSES = ["active", "paused", "archived"] as const;

const PROPOSAL_EXECUTING_STATUSES = ["approved", "proposed"] as const;

// ── Row ↔ contract DTO ───────────────────────────────────────────

export function rowToProposal(row: AssistantProposalRow): AssistantActionProposal {
  return AssistantActionProposalSchema.parse({
    contractVersion: ASSISTANT_CONTRACT_VERSION,
    id: row.proposalKey,
    scope: row.scope,
    actor: row.actor,
    action: row.action,
    payload: row.payload,
    risk: row.risk,
    payloadHash: row.payloadHash,
    expectedVersion: row.expectedVersion,
    requiresApproval: row.requiresApproval,
    status: row.status,
    proposedAt: row.proposedAt,
    decidedAt: row.decidedAt,
    executedAt: row.executedAt,
    resultSummary: row.resultSummary,
  });
}

export function rowToJob(row: AssistantJobRow): AssistantJob {
  return AssistantJobSchema.parse({
    contractVersion: ASSISTANT_CONTRACT_VERSION,
    id: row.jobKey,
    scope: row.scope,
    kind: row.kind,
    schedule: row.schedule,
    enabled: row.enabled,
    nextRunAt: row.nextRunAt,
    lastRunAt: row.lastRunAt,
    runCount: row.runCount,
    maxRuns: row.maxRuns,
    budget: row.budget,
    version: row.version,
  });
}

/** Every successful execution bumps the enterprise OCC version (cache + OCC). */
async function touchEnterprise(enterpriseId: number): Promise<void> {
  const db = getDb();
  await db
    .update(enterprises)
    .set({ version: sql`${enterprises.version} + 1` })
    .where(eq(enterprises.id, enterpriseId));
}

async function mustOwnProposal(
  userId: number,
  proposalId: number,
): Promise<{ proposal: AssistantProposalRow; enterprise: Enterprise }> {
  const db = getDb();
  const proposal = await db.query.assistantProposals.findFirst({
    where: eq(assistantProposals.id, proposalId),
  });
  if (!proposal) throw new AssistantError("NOT_FOUND", "proposal not found");
  const enterprise = await mustOwnEnterprise(userId, proposal.enterpriseId);
  if (proposal.ownerId !== userId) throw new AssistantError("FORBIDDEN", "not your proposal");
  return { proposal, enterprise };
}

// ── Proposals: propose → decide → execute (separate from approvals) ──

export interface ProposeActionInput {
  /** Optional caller id; default is derived from action+payloadHash (idempotent). */
  id?: string;
  scope: AssistantScope;
  actor: keyof typeof ASSISTANT_DEFINITIONS;
  action: AssistantAction;
  payload: Record<string, unknown>;
}

function deriveProposalKey(enterpriseId: number, action: string, payloadHash: string): string {
  return `ap-${enterpriseId}-${action.replace(/[^a-z.]/g, "")}-${payloadHash.slice(0, 16)}`.slice(0, 80);
}

/**
 * Persist a typed proposal in the `proposed` state. Risk/requiresApproval are
 * policy-derived by the contract (never caller-supplied); expectedVersion is
 * pinned to the CURRENT enterprise version. Idempotent on the proposal key:
 * a replay returns the existing row untouched.
 */
export async function proposeAction(
  user: User,
  enterpriseId: number,
  input: ProposeActionInput,
): Promise<{ proposal: AssistantProposalRow; replayed: boolean }> {
  const db = getDb();
  const enterprise = await mustOwnEnterprise(user.id, enterpriseId);
  if (!ASSISTANT_ACTIONS.includes(input.action)) {
    throw new AssistantError("VALIDATION", `unknown action "${String(input.action)}"`);
  }
  const payloadHash = sha256Hex(canonicalJson(input.payload));
  const key =
    input.id && input.id.length > 0
      ? input.id
      : deriveProposalKey(enterpriseId, input.action, payloadHash);
  let proposal: AssistantActionProposal;
  try {
    proposal = createAssistantProposal({
      id: key,
      scope: input.scope,
      actor: input.actor,
      action: input.action,
      payload: input.payload,
      expectedVersion: enterprise.version,
      proposedAt: Date.now(),
    });
  } catch (err) {
    mapContractError(err);
  }

  const existing = await db.query.assistantProposals.findFirst({
    where: and(eq(assistantProposals.ownerId, user.id), eq(assistantProposals.proposalKey, key)),
  });
  if (existing) {
    if (existing.payloadHash !== proposal.payloadHash) {
      throw new AssistantError(
        "CONFLICT",
        `proposal id "${key}" already exists with a different payload (id+payloadHash is the idempotency basis)`,
      );
    }
    return { proposal: existing, replayed: true };
  }

  try {
    const [row] = await db.insert(assistantProposals).values({
      ownerId: user.id,
      enterpriseId,
      proposalKey: key,
      scope: proposal.scope,
      actor: proposal.actor,
      action: proposal.action,
      payload: proposal.payload,
      payloadHash: proposal.payloadHash,
      expectedVersion: proposal.expectedVersion,
      risk: proposal.risk,
      requiresApproval: proposal.requiresApproval,
      confirmedGates: [],
      status: "proposed",
      proposedAt: proposal.proposedAt,
    });
    await appendEnterpriseEvent(enterpriseId, {
      type: "assistant_proposal_created",
      actor: "human",
      payload: {
        proposalId: Number(row.insertId),
        proposalKey: key,
        action: proposal.action,
        actor: proposal.actor,
        risk: proposal.risk,
        payloadHash: proposal.payloadHash,
        expectedVersion: proposal.expectedVersion,
      },
    });
    return {
      proposal: (await db.query.assistantProposals.findFirst({
        where: eq(assistantProposals.id, Number(row.insertId)),
      }))!,
      replayed: false,
    };
  } catch (err) {
    // Lost the unique race — replay.
    const raced = await db.query.assistantProposals.findFirst({
      where: and(eq(assistantProposals.ownerId, user.id), eq(assistantProposals.proposalKey, key)),
    });
    if (raced) return { proposal: raced, replayed: true };
    throw err;
  }
}

/**
 * Human decision on a proposal. Approval re-runs the full contract validation
 * (payload hash, policy, scope coverage, forbidden keys, drain+preserve,
 * gate confirmations) — authorization lives in code. The status CAS makes
 * concurrent decides safe: exactly one wins; the other gets CONFLICT.
 */
export async function decideProposal(
  user: User,
  proposalId: number,
  decision: "approved" | "rejected",
  confirmedGates: readonly AssistantGate[] = [],
): Promise<AssistantProposalRow> {
  const db = getDb();
  const { proposal, enterprise } = await mustOwnProposal(user.id, proposalId);
  if (proposal.status !== "proposed") {
    throw new AssistantError("BAD_STATE", `proposal is ${proposal.status}, not proposed`);
  }
  const dto = rowToProposal(proposal);
  if (decision === "approved") {
    try {
      validateAssistantAction(dto, { approved: true, confirmedGates });
    } catch (err) {
      mapContractError(err);
    }
  }
  const next = decision === "approved" ? "approved" : "rejected";
  const [res] = await db
    .update(assistantProposals)
    .set({
      status: next,
      confirmedGates: decision === "approved" ? [...confirmedGates] : [],
      decidedAt: Date.now(),
    })
    .where(and(eq(assistantProposals.id, proposalId), eq(assistantProposals.status, "proposed")));
  if (res.affectedRows !== 1) {
    throw new AssistantError("CONFLICT", "proposal was decided concurrently");
  }
  await appendEnterpriseEvent(enterprise.id, {
    type: "assistant_proposal_decided",
    actor: "human",
    payload: {
      proposalId,
      proposalKey: proposal.proposalKey,
      action: proposal.action,
      decision: next,
      decidedBy: user.name ?? `user-${user.id}`,
      confirmedGates: decision === "approved" ? confirmedGates : [],
    },
  });
  return (await db.query.assistantProposals.findFirst({
    where: eq(assistantProposals.id, proposalId),
  }))!;
}

export async function cancelProposal(user: User, proposalId: number): Promise<AssistantProposalRow> {
  const db = getDb();
  const { proposal, enterprise } = await mustOwnProposal(user.id, proposalId);
  const [res] = await db
    .update(assistantProposals)
    .set({ status: "cancelled", decidedAt: Date.now() })
    .where(
      and(
        eq(assistantProposals.id, proposalId),
        inArray(assistantProposals.status, ["proposed", "approved"]),
      ),
    );
  if (res.affectedRows !== 1) {
    throw new AssistantError("BAD_STATE", `proposal is ${proposal.status}; cannot cancel`);
  }
  await appendEnterpriseEvent(enterprise.id, {
    type: "assistant_proposal_cancelled",
    actor: "human",
    payload: { proposalId, proposalKey: proposal.proposalKey, action: proposal.action },
  });
  return (await db.query.assistantProposals.findFirst({
    where: eq(assistantProposals.id, proposalId),
  }))!;
}

// ── Work queues (dense positions, OCC on queue.version) ──────────

export async function ensureWorkQueue(
  user: User,
  enterpriseId: number,
  scope: AssistantScope,
  scopeKey: string,
): Promise<AssistantWorkQueueRow> {
  const db = getDb();
  await mustOwnEnterprise(user.id, enterpriseId);
  const existing = await db.query.assistantWorkQueues.findFirst({
    where: and(
      eq(assistantWorkQueues.enterpriseId, enterpriseId),
      eq(assistantWorkQueues.scope, scope),
      eq(assistantWorkQueues.scopeKey, scopeKey),
    ),
  });
  if (existing) return existing;
  try {
    const [row] = await db.insert(assistantWorkQueues).values({
      ownerId: user.id,
      enterpriseId,
      scope,
      scopeKey,
    });
    return (await db.query.assistantWorkQueues.findFirst({
      where: eq(assistantWorkQueues.id, Number(row.insertId)),
    }))!;
  } catch {
    const raced = await db.query.assistantWorkQueues.findFirst({
      where: and(
        eq(assistantWorkQueues.enterpriseId, enterpriseId),
        eq(assistantWorkQueues.scope, scope),
        eq(assistantWorkQueues.scopeKey, scopeKey),
      ),
    });
    if (raced) return raced;
    throw new AssistantError("QUEUE_FAILED", "failed to create work queue");
  }
}

export async function getWorkQueue(
  userId: number,
  enterpriseId: number,
  scope: AssistantScope,
  scopeKey: string,
): Promise<{ queue: AssistantWorkQueueRow | null; items: AssistantQueueItemRow[] }> {
  const db = getDb();
  await mustOwnEnterprise(userId, enterpriseId);
  const queue = await db.query.assistantWorkQueues.findFirst({
    where: and(
      eq(assistantWorkQueues.enterpriseId, enterpriseId),
      eq(assistantWorkQueues.scope, scope),
      eq(assistantWorkQueues.scopeKey, scopeKey),
    ),
  });
  if (!queue) return { queue: null, items: [] };
  const items = await db
    .select()
    .from(assistantQueueItems)
    .where(eq(assistantQueueItems.queueId, queue.id))
    .orderBy(asc(assistantQueueItems.position))
    .limit(500);
  return { queue, items };
}

async function queueAddItem(
  user: User,
  enterprise: Enterprise,
  scope: AssistantScope,
  scopeKey: string,
  item: { itemKey: string; itemKind: (typeof ASSISTANT_QUEUE_ITEM_KINDS)[number]; refId: string; title: string },
  payloadHash: string,
): Promise<{ queue: AssistantWorkQueueRow; added: boolean }> {
  const db = getDb();
  const queue = await ensureWorkQueue(user, enterprise.id, scope, scopeKey);
  const existing = await db.query.assistantQueueItems.findFirst({
    where: and(
      eq(assistantQueueItems.queueId, queue.id),
      eq(assistantQueueItems.itemKey, item.itemKey),
    ),
  });
  if (existing) return { queue, added: false }; // idempotent on itemKey
  const [maxRow] = await db
    .select({ maxPos: sql<number>`COALESCE(MAX(${assistantQueueItems.position}), -1)` })
    .from(assistantQueueItems)
    .where(eq(assistantQueueItems.queueId, queue.id));
  const position = Number(maxRow?.maxPos ?? -1) + 1;
  try {
    await db.insert(assistantQueueItems).values({
      queueId: queue.id,
      itemKey: item.itemKey,
      itemKind: item.itemKind,
      refId: item.refId.slice(0, 255),
      title: item.title.slice(0, 200),
      position,
      status: "queued",
      payloadHash,
    });
  } catch {
    return { queue, added: false }; // lost the unique race — idempotent
  }
  await db
    .update(assistantWorkQueues)
    .set({ version: sql`${assistantWorkQueues.version} + 1` })
    .where(eq(assistantWorkQueues.id, queue.id));
  return { queue: (await db.query.assistantWorkQueues.findFirst({ where: eq(assistantWorkQueues.id, queue.id) }))!, added: true };
}

/**
 * Dense reindex reorder. The order array must name exactly the queue's
 * current item keys (deterministic: ties resolve by itemKey). OCC:
 * expectedQueueVersion must match queue.version. A two-phase position
 * update keeps the (queue,position) unique constraint satisfied.
 */
export async function reorderWorkQueue(
  user: User,
  enterpriseId: number,
  input: {
    scope: AssistantScope;
    scopeKey: string;
    order: string[];
    expectedQueueVersion?: number;
  },
): Promise<{ queue: AssistantWorkQueueRow; items: AssistantQueueItemRow[] }> {
  const db = getDb();
  await mustOwnEnterprise(user.id, enterpriseId);
  const queue = await db.query.assistantWorkQueues.findFirst({
    where: and(
      eq(assistantWorkQueues.enterpriseId, enterpriseId),
      eq(assistantWorkQueues.scope, input.scope),
      eq(assistantWorkQueues.scopeKey, input.scopeKey),
    ),
  });
  if (!queue) throw new AssistantError("NOT_FOUND", "queue not found");
  if (input.expectedQueueVersion !== undefined && input.expectedQueueVersion !== queue.version) {
    throw new AssistantError("CONFLICT", "queue changed concurrently — reload and retry");
  }
  const items = await db
    .select()
    .from(assistantQueueItems)
    .where(eq(assistantQueueItems.queueId, queue.id));
  const currentKeys = items.map((i) => i.itemKey).sort();
  const orderKeys = [...new Set(input.order)].sort();
  if (currentKeys.length !== orderKeys.length || currentKeys.some((k, i) => k !== orderKeys[i])) {
    throw new AssistantError(
      "VALIDATION",
      "order must name exactly the queue's current item keys (reload and retry)",
    );
  }
  const rank = new Map(input.order.map((k, i) => [k, i]));
  await db.transaction(async (tx) => {
    for (const item of items) {
      await tx
        .update(assistantQueueItems)
        .set({ position: -(rank.get(item.itemKey)! + 1) })
        .where(eq(assistantQueueItems.id, item.id));
    }
    for (const item of items) {
      await tx
        .update(assistantQueueItems)
        .set({ position: rank.get(item.itemKey)! })
        .where(eq(assistantQueueItems.id, item.id));
    }
    const [res] = await tx
      .update(assistantWorkQueues)
      .set({ version: sql`${assistantWorkQueues.version} + 1` })
      .where(
        input.expectedQueueVersion !== undefined
          ? and(
              eq(assistantWorkQueues.id, queue.id),
              eq(assistantWorkQueues.version, input.expectedQueueVersion),
            )
          : eq(assistantWorkQueues.id, queue.id),
      );
    if (res.affectedRows !== 1) {
      throw new AssistantError("CONFLICT", "queue changed concurrently — reload and retry");
    }
  });
  await appendEnterpriseEvent(enterpriseId, {
    type: "assistant_queue_reordered",
    actor: "human",
    payload: { queueId: queue.id, scope: input.scope, scopeKey: input.scopeKey, items: items.length },
  });
  const fresh = await getWorkQueue(user.id, enterpriseId, input.scope, input.scopeKey);
  return { queue: fresh.queue!, items: fresh.items };
}

// ── Registry-backed study resources (seeded, never invented) ─────

async function studyResourcesForSkill(
  skillId: string,
): Promise<{ ref: string; topic: string }[]> {
  const db = getDb();
  const mapping = await db.query.registrySkillMappings.findFirst({
    where: eq(registrySkillMappings.skillPack, skillId),
  });
  const roleSlugs = (mapping?.consumerRoles ?? []).slice(0, 4);
  if (roleSlugs.length === 0) return [];
  const links = await db
    .select({
      url: registryRoleResourceLinks.resourceUrl,
      name: registryRoleResourceLinks.resourceName,
    })
    .from(registryRoleResourceLinks)
    .where(
      and(
        inArray(registryRoleResourceLinks.roleSlug, roleSlugs),
        eq(registryRoleResourceLinks.stale, false),
      ),
    )
    .limit(64);
  return links.map((l) => ({ ref: l.url, topic: l.name.slice(0, 200) }));
}

/** Insert contract-built study drafts; deduped by content-derived itemKey. */
async function enqueueStudyDrafts(
  user: User,
  enterpriseId: number,
  input: { skillId: string; goal: string; evaluation?: string; cap?: number },
): Promise<number> {
  const db = getDb();
  const resources = await studyResourcesForSkill(input.skillId);
  const items = buildStudyQueue({
    skillId: input.skillId,
    resources,
    goal: input.goal,
    evaluation: input.evaluation,
    cap: input.cap,
  });
  let inserted = 0;
  for (const item of items) {
    try {
      await db.insert(studyQueueItems).values({
        ownerId: user.id,
        enterpriseId,
        itemKey: item.id,
        skillId: item.skillId,
        resourceRef: item.resourceRef,
        topic: item.topic,
        goal: item.goal,
        evaluation: item.evaluation,
        status: "draft",
      });
      inserted += 1;
    } catch {
      // duplicate itemKey — idempotent skip
    }
  }
  return inserted;
}

// ── Repository intake (confirmed metadata only; never clone/code) ─

export interface RepositoryIntakeResult {
  repository: RepositoryRecordRow;
  plan: {
    status: string;
    companyKey: string | null;
    departmentKey: string | null;
    discipline: string | null;
    skillId: string | null;
    confidence: number;
    rationale: string;
    readOnly: boolean;
    redistributionAllowed: boolean;
    notes: string[];
  };
  metadata: RepositoryMetadata;
}

/**
 * One confirmed metadata read + deterministic routing. Public-anonymous reads
 * need no credential; credentialed reads require the owner's github vault
 * record AND are only reachable through an approved proposal (the
 * `credentials` gate on repository.import is validated before the executor
 * runs). Tokens are decrypted in-memory and never logged/stored/returned.
 */
export async function intakeRepository(
  user: User,
  enterpriseId: number,
  input: { url: string; intakeMode: GithubIntakeMode; recordId?: number },
): Promise<RepositoryIntakeResult> {
  const db = getDb();
  await mustOwnEnterprise(user.id, enterpriseId);
  let token: string | null = null;
  if (input.intakeMode === "credentialed-approved") {
    if (input.recordId === undefined) {
      throw new AssistantError(
        "CREDENTIAL_REQUIRED",
        "credentialed intake requires an explicit vault recordId",
      );
    }
    const record = await getOwnedRecord(user.id, input.recordId);
    if (record.provider !== "github") {
      throw new AssistantError("VALIDATION", "record is not a GitHub credential");
    }
    try {
      token = decryptRecordSecret(record);
    } catch (err) {
      if (err instanceof VaultUnavailable) {
        throw new AssistantError("VAULT_UNAVAILABLE", err.message);
      }
      throw new AssistantError("VAULT_INTEGRITY", "stored credential could not be decrypted");
    }
    if (!token) throw new AssistantError("CREDENTIAL_REQUIRED", "no credential stored on record");
  }

  let inspection;
  try {
    inspection = await githubInspectRepo(input.url, token);
  } catch (err) {
    const { errorClass, detail } = classifyConnectorError(err);
    throw new AssistantError("CONNECTOR", `${errorClass}: ${detail}`);
  }
  token = null; // drop the in-memory secret as early as possible

  const [ownerName, repoName] = inspection.fullName.split("/");
  let metadata: RepositoryMetadata;
  try {
    metadata = RepositoryMetadataSchema.parse({
      url: input.url.slice(0, 500),
      owner: (ownerName ?? "").slice(0, 200),
      name: (repoName ?? "").slice(0, 200),
      description: inspection.description.slice(0, 2000),
      language: inspection.language,
      topics: inspection.topics,
      license: inspection.license ? inspection.license.toLowerCase() : null,
      archived: inspection.archived,
      defaultBranch: inspection.defaultBranch,
      commitSha: inspection.commitSha,
      visibility: inspection.visibility,
    });
  } catch (err) {
    throw new AssistantError(
      "VALIDATION",
      `repository metadata failed contract validation: ${err instanceof Error ? err.message.slice(0, 300) : "unknown"}`,
    );
  }
  const plan = routeRepository(metadata);

  // Upsert the record on (enterprise,url); re-intake refreshes metadata.
  const existing = await db.query.repositoryRecords.findFirst({
    where: and(
      eq(repositoryRecords.enterpriseId, enterpriseId),
      eq(repositoryRecords.url, metadata.url),
    ),
  });
  let record: RepositoryRecordRow;
  if (existing) {
    await db
      .update(repositoryRecords)
      .set({
        ownerName: metadata.owner,
        name: metadata.name,
        description: metadata.description,
        language: metadata.language,
        topics: metadata.topics,
        license: metadata.license,
        archived: metadata.archived,
        defaultBranch: metadata.defaultBranch,
        commitSha: metadata.commitSha,
        visibility: metadata.visibility,
        intakeMode: input.intakeMode,
        createdByRecordId: input.recordId ?? null,
      })
      .where(eq(repositoryRecords.id, existing.id));
    record = (await db.query.repositoryRecords.findFirst({
      where: eq(repositoryRecords.id, existing.id),
    }))!;
  } else {
    const [row] = await db.insert(repositoryRecords).values({
      ownerId: user.id,
      enterpriseId,
      url: metadata.url,
      ownerName: metadata.owner,
      name: metadata.name,
      description: metadata.description,
      language: metadata.language,
      topics: metadata.topics,
      license: metadata.license,
      archived: metadata.archived,
      defaultBranch: metadata.defaultBranch,
      commitSha: metadata.commitSha,
      visibility: metadata.visibility,
      intakeMode: input.intakeMode,
      createdByRecordId: input.recordId ?? null,
    });
    record = (await db.query.repositoryRecords.findFirst({
      where: eq(repositoryRecords.id, Number(row.insertId)),
    }))!;
  }

  // Plan per (repository, commitSha) — idempotent; drift creates a new plan.
  const existingPlan = await db.query.repoAssignmentPlans.findFirst({
    where: and(
      eq(repoAssignmentPlans.repositoryId, record.id),
      eq(repoAssignmentPlans.commitSha, metadata.commitSha),
    ),
  });
  if (!existingPlan) {
    await db.insert(repoAssignmentPlans).values({
      repositoryId: record.id,
      url: metadata.url,
      commitSha: metadata.commitSha,
      status: plan.status,
      companyKey: plan.companyKey,
      departmentKey: plan.departmentKey,
      discipline: plan.discipline,
      skillId: plan.skillId,
      confidence: plan.confidence,
      rationale: plan.rationale,
      readOnly: plan.readOnly,
      redistributionAllowed: plan.redistributionAllowed,
      notes: plan.notes,
    });
  }

  await appendEnterpriseEvent(enterpriseId, {
    type: "assistant_repository_intake",
    actor: "system",
    payload: {
      repositoryId: record.id,
      url: metadata.url,
      commitSha: metadata.commitSha,
      visibility: metadata.visibility,
      archived: metadata.archived,
      intakeMode: input.intakeMode,
      routedStatus: plan.status,
      confidence: plan.confidence,
    },
  });
  return { repository: record, plan, metadata };
}

export async function listRepositories(
  userId: number,
  enterpriseId: number,
): Promise<(RepositoryRecordRow & { plans: unknown[] })[]> {
  const db = getDb();
  await mustOwnEnterprise(userId, enterpriseId);
  const repos = await db
    .select()
    .from(repositoryRecords)
    .where(eq(repositoryRecords.enterpriseId, enterpriseId))
    .orderBy(desc(repositoryRecords.id))
    .limit(200);
  const out = [];
  for (const repo of repos) {
    const plans = await db
      .select()
      .from(repoAssignmentPlans)
      .where(eq(repoAssignmentPlans.repositoryId, repo.id))
      .orderBy(desc(repoAssignmentPlans.id))
      .limit(10);
    out.push({ ...repo, plans });
  }
  return out;
}

// ── Executors: proposal action → EXISTING platform functions ─────

interface ExecutorContext {
  user: User;
  enterprise: Enterprise;
  proposal: AssistantProposalRow;
  dto: AssistantActionProposal;
}

function str(payload: Record<string, unknown>, key: string): string {
  const v = payload[key];
  if (typeof v !== "string" || v.length === 0) {
    throw new AssistantError("VALIDATION", `payload.${key} must be a non-empty string`);
  }
  return v;
}

function num(payload: Record<string, unknown>, key: string): number {
  const v = payload[key];
  if (typeof v !== "number" || !Number.isFinite(v)) {
    throw new AssistantError("VALIDATION", `payload.${key} must be a number`);
  }
  return v;
}

async function mustEnterpriseContractByKey(enterpriseId: number, key: string) {
  const db = getDb();
  const contract = await db.query.workerContracts.findFirst({
    where: and(eq(workerContracts.enterpriseId, enterpriseId), eq(workerContracts.key, key)),
  });
  if (!contract) throw new AssistantError("NOT_FOUND", `contract "${key}" not found`);
  return contract;
}

async function executeAction(ctx: ExecutorContext): Promise<string> {
  const db = getDb();
  const { user, enterprise, dto } = ctx;
  const payload = dto.payload;

  switch (dto.action) {
    case "queue.add": {
      const scopeKey = typeof payload.scopeKey === "string" ? payload.scopeKey : "";
      const item = payload.item as Record<string, unknown> | undefined;
      if (!item || typeof item !== "object") {
        throw new AssistantError("VALIDATION", "payload.item is required");
      }
      const { added } = await queueAddItem(
        user,
        enterprise,
        dto.scope,
        scopeKey.slice(0, 64),
        {
          itemKey: str(item, "itemKey").slice(0, 120),
          itemKind: str(item, "itemKind") as (typeof ASSISTANT_QUEUE_ITEM_KINDS)[number],
          refId: typeof item.refId === "string" ? item.refId : "",
          title: str(item, "title"),
        },
        dto.payloadHash,
      );
      await appendEnterpriseEvent(enterprise.id, {
        type: "assistant_queue_item_added",
        actor: "human",
        payload: { scope: dto.scope, scopeKey, itemKey: str(item, "itemKey"), added },
      });
      return added ? "item enqueued" : "item already present (idempotent replay)";
    }

    case "queue.reorder": {
      const scopeKey = typeof payload.scopeKey === "string" ? payload.scopeKey : "";
      const order = payload.order;
      if (!Array.isArray(order) || order.some((k) => typeof k !== "string")) {
        throw new AssistantError("VALIDATION", "payload.order must be an array of item keys");
      }
      const expectedQueueVersion =
        typeof payload.expectedQueueVersion === "number" ? payload.expectedQueueVersion : undefined;
      const result = await reorderWorkQueue(user, enterprise.id, {
        scope: dto.scope,
        scopeKey: scopeKey.slice(0, 64),
        order: order as string[],
        expectedQueueVersion,
      });
      return `queue reordered (${result.items.length} items, version ${result.queue.version})`;
    }

    case "worker.hire": {
      // Approved worker hire = the existing contract decision gate.
      const contract = await mustEnterpriseContractByKey(enterprise.id, str(payload, "contractKey"));
      const decided = await decideContract(user, contract.id, "approved");
      return `contract ${decided.key} approved; secondee worker ${decided.secondeeWorkerId ?? "none"}`;
    }

    case "worker.pause":
    case "worker.resume": {
      const workerId = num(payload, "workerId");
      const suspended = dto.action === "worker.pause";
      const worker = await setEnterpriseWorkerSuspended(user, workerId, suspended);
      return `worker ${worker.name} ${suspended ? "paused" : "resumed"}`;
    }

    case "worker.fire": {
      // Drain-preserving fire: reuse the existing release path (suspend →
      // drain in-flight claims → release). Artifacts/budget_ledger/events are
      // separate tables and are never touched.
      const contract = await mustEnterpriseContractByKey(enterprise.id, str(payload, "contractKey"));
      if (contract.status === "released" || contract.status === "revoked") {
        return `contract ${contract.key} already ${contract.status} (idempotent)`;
      }
      const after = await releaseContract(user, contract.id);
      return `contract ${after.key} ${after.status} (drain preserves in-flight artifacts)`;
    }

    case "department.pause":
    case "department.resume":
    case "department.archive": {
      const key = str(payload, "departmentKey");
      const dept = await db.query.enterpriseDepartments.findFirst({
        where: and(
          eq(enterpriseDepartments.enterpriseId, enterprise.id),
          eq(enterpriseDepartments.key, key),
        ),
      });
      if (!dept) throw new AssistantError("NOT_FOUND", `department "${key}" not found`);
      const target =
        dto.action === "department.pause"
          ? "paused"
          : dto.action === "department.resume"
            ? "active"
            : "archived";
      if (dept.status === target) return `department ${key} already ${target} (idempotent)`;
      if (dept.status === "archived") {
        throw new AssistantError("BAD_STATE", `department ${key} is archived (terminal)`);
      }
      const [res] = await db
        .update(enterpriseDepartments)
        .set({ status: target })
        .where(
          and(eq(enterpriseDepartments.id, dept.id), eq(enterpriseDepartments.status, dept.status)),
        );
      if (res.affectedRows !== 1) {
        throw new AssistantError("CONFLICT", "department changed concurrently");
      }
      let suspendedWorkers = 0;
      let drainingContracts = 0;
      if (target !== "active") {
        // Stop new claims: every worker pooled under this department suspends.
        const [w] = await db
          .update(workers)
          .set({ status: "suspended", version: sql`${workers.version} + 1` })
          .where(and(eq(workers.departmentId, dept.id), eq(workers.status, "active")));
        suspendedWorkers = w.affectedRows;
        if (target === "archived") {
          // Archive drains: active contracts lending from this department release.
          const lending = await db
            .select({ id: workerContracts.id })
            .from(workerContracts)
            .where(
              and(
                eq(workerContracts.departmentId, dept.id),
                inArray(workerContracts.status, ["active", "draining"]),
              ),
            );
          for (const c of lending) {
            await releaseContract(user, c.id);
            drainingContracts += 1;
          }
        }
      }
      await appendEnterpriseEvent(enterprise.id, {
        type: `department_${target === "active" ? "resumed" : target === "paused" ? "paused" : "archived"}`,
        actor: "human",
        payload: { departmentId: dept.id, key, suspendedWorkers, drainingContracts },
      });
      return `department ${key} → ${target} (workers suspended: ${suspendedWorkers}, contracts draining: ${drainingContracts})`;
    }

    case "company.pause":
    case "company.resume":
    case "company.archive": {
      const key = str(payload, "companyKey");
      const company = await db.query.enterpriseCompanies.findFirst({
        where: and(
          eq(enterpriseCompanies.enterpriseId, enterprise.id),
          eq(enterpriseCompanies.key, key),
        ),
      });
      if (!company) throw new AssistantError("NOT_FOUND", `company "${key}" not found`);
      if (dto.action === "company.resume") {
        if (company.archivedAt) {
          throw new AssistantError("BAD_STATE", `company ${key} is archived (terminal)`);
        }
        if (company.active) return `company ${key} already active (idempotent)`;
        await db
          .update(enterpriseCompanies)
          .set({ active: true })
          .where(and(eq(enterpriseCompanies.id, company.id), eq(enterpriseCompanies.active, false)));
      } else {
        if (!company.active && (dto.action === "company.pause" || company.archivedAt)) {
          return `company ${key} already inactive (idempotent)`;
        }
        await db
          .update(enterpriseCompanies)
          .set(
            dto.action === "company.archive"
              ? { active: false, archivedAt: new Date() }
              : { active: false },
          )
          .where(and(eq(enterpriseCompanies.id, company.id), eq(enterpriseCompanies.active, true)));
        if (dto.action === "company.archive") {
          // Drain borrowing contracts served by this company.
          const borrowing = await db
            .select({ id: workerContracts.id })
            .from(workerContracts)
            .where(
              and(
                eq(workerContracts.companyId, company.id),
                inArray(workerContracts.status, ["active", "draining"]),
              ),
            );
          for (const c of borrowing) await releaseContract(user, c.id);
        }
      }
      // Inactive companies receive a zero reservation in the contract's
      // partitionBudget and are skipped by the program pump — both existing.
      await appendEnterpriseEvent(enterprise.id, {
        type:
          dto.action === "company.resume"
            ? "company_resumed"
            : dto.action === "company.pause"
              ? "company_paused"
              : "company_archived",
        actor: "human",
        payload: { companyId: company.id, key },
      });
      return `company ${key} ${dto.action === "company.resume" ? "resumed" : dto.action === "company.pause" ? "paused (zero budget reservation; pump skips)" : "archived (contracts draining, artifacts preserved)"}`;
    }

    case "cache.invalidate": {
      const namespace = str(payload, "namespace") as AssistantCacheNamespace;
      if (!ASSISTANT_CACHE_NAMESPACES.includes(namespace)) {
        throw new AssistantError("VALIDATION", `unknown cache namespace "${namespace}"`);
      }
      // The web backend memoizes exactly one namespace: the enterprise
      // snapshot, keyed by (version, eventSeq). Other namespaces have no
      // server-side cache here — reported honestly as zero removals.
      const removed =
        namespace === "snapshot" ? invalidateEnterpriseSnapshotCache(enterprise.id) : 0;
      await appendEnterpriseEvent(enterprise.id, {
        type: "assistant_cache_invalidated",
        actor: "human",
        payload: { namespace, removedKeys: removed },
      });
      return `cache namespace ${namespace}: ${removed} key(s) invalidated`;
    }

    case "schedule.upsert": {
      const schedule = AssistantJobScheduleSchema.parse(payload.schedule);
      const kind = str(payload, "kind") as AssistantJobRow["kind"];
      if (!ASSISTANT_JOB_POLICIES[kind]) {
        throw new AssistantError("VALIDATION", `unknown job kind "${kind}"`);
      }
      const scopeKey = typeof payload.scopeKey === "string" ? payload.scopeKey.slice(0, 64) : "";
      const job = createAssistantJob({
        id: str(payload, "jobKey").slice(0, 80),
        scope: dto.scope,
        kind,
        schedule,
        enabled: payload.enabled !== false,
        maxRuns: typeof payload.maxRuns === "number" ? payload.maxRuns : null,
      });
      const nextRunAt = scheduleNextRun(job, Date.now());
      const existing = await db.query.assistantJobs.findFirst({
        where: and(
          eq(assistantJobs.ownerId, user.id),
          eq(assistantJobs.enterpriseId, enterprise.id),
          eq(assistantJobs.jobKey, job.id),
        ),
      });
      if (existing) {
        const [res] = await db
          .update(assistantJobs)
          .set({
            scopeKey,
            kind: job.kind,
            schedule: job.schedule,
            enabled: job.enabled,
            maxRuns: job.maxRuns,
            nextRunAt,
            budget: job.budget,
            version: sql`${assistantJobs.version} + 1`,
          })
          .where(
            and(eq(assistantJobs.id, existing.id), eq(assistantJobs.version, existing.version)),
          );
        if (res.affectedRows !== 1) throw new AssistantError("CONFLICT", "job changed concurrently");
      } else {
        await db.insert(assistantJobs).values({
          ownerId: user.id,
          enterpriseId: enterprise.id,
          jobKey: job.id,
          scope: job.scope,
          scopeKey,
          kind: job.kind,
          schedule: job.schedule,
          enabled: job.enabled,
          nextRunAt,
          runCount: 0,
          maxRuns: job.maxRuns,
          budget: job.budget,
        });
      }
      await appendEnterpriseEvent(enterprise.id, {
        type: "assistant_job_upserted",
        actor: "human",
        payload: { jobKey: job.id, kind: job.kind, enabled: job.enabled, nextRunAt },
      });
      return `job ${job.id} upserted (nextRunAt ${nextRunAt ?? "never"})`;
    }

    case "schedule.pause":
    case "schedule.resume":
    case "schedule.delete": {
      const jobKey = str(payload, "jobKey");
      const job = await db.query.assistantJobs.findFirst({
        where: and(
          eq(assistantJobs.enterpriseId, enterprise.id),
          eq(assistantJobs.jobKey, jobKey),
        ),
      });
      if (!job) throw new AssistantError("NOT_FOUND", `job "${jobKey}" not found`);
      if (dto.action === "schedule.delete") {
        await db.delete(assistantJobs).where(eq(assistantJobs.id, job.id));
      } else if (dto.action === "schedule.pause") {
        await db
          .update(assistantJobs)
          .set({ enabled: false, nextRunAt: null, version: sql`${assistantJobs.version} + 1` })
          .where(and(eq(assistantJobs.id, job.id), eq(assistantJobs.version, job.version)));
      } else {
        const fresh = { ...rowToJob(job), enabled: true };
        const nextRunAt = scheduleNextRun(fresh, Date.now());
        await db
          .update(assistantJobs)
          .set({ enabled: true, nextRunAt, version: sql`${assistantJobs.version} + 1` })
          .where(and(eq(assistantJobs.id, job.id), eq(assistantJobs.version, job.version)));
      }
      await appendEnterpriseEvent(enterprise.id, {
        type: `assistant_job_${dto.action === "schedule.delete" ? "deleted" : dto.action === "schedule.pause" ? "paused" : "resumed"}`,
        actor: "human",
        payload: { jobKey },
      });
      return `job ${jobKey} ${dto.action.split(".")[1]}d`;
    }

    case "schedule.run_now": {
      const jobKey = str(payload, "jobKey");
      const job = await db.query.assistantJobs.findFirst({
        where: and(
          eq(assistantJobs.enterpriseId, enterprise.id),
          eq(assistantJobs.jobKey, jobKey),
        ),
      });
      if (!job) throw new AssistantError("NOT_FOUND", `job "${jobKey}" not found`);
      const summary = await runClaimedAssistantJob(job, { requireDue: false });
      return summary;
    }

    case "study.enqueue": {
      const skillId = str(payload, "skillId");
      const goal = str(payload, "goal").slice(0, 1000);
      const inserted = await enqueueStudyDrafts(user, enterprise.id, {
        skillId,
        goal,
        evaluation: typeof payload.evaluation === "string" ? payload.evaluation : undefined,
      });
      await appendEnterpriseEvent(enterprise.id, {
        type: "assistant_study_enqueued",
        actor: "system",
        payload: { skillId, drafts: inserted },
      });
      return `${inserted} draft study item(s) enqueued for ${skillId} (provider calls: never)`;
    }

    case "repository.import": {
      const intakeMode = str(payload, "intakeMode") as GithubIntakeMode;
      if (!GITHUB_INTAKE_MODES.includes(intakeMode)) {
        throw new AssistantError("VALIDATION", `unknown intakeMode "${intakeMode}"`);
      }
      const recordId =
        typeof payload.recordId === "number" ? payload.recordId : undefined;
      const result = await intakeRepository(user, enterprise.id, {
        url: str(payload, "url"),
        intakeMode,
        recordId,
      });
      return `repository ${result.metadata.owner}/${result.metadata.name} @ ${result.metadata.commitSha.slice(0, 12)} routed ${result.plan.status} (confidence ${result.plan.confidence})`;
    }

    case "repository.assign":
    case "repository.propose_structure": {
      const url = str(payload, "url");
      const repo = await db.query.repositoryRecords.findFirst({
        where: and(
          eq(repositoryRecords.enterpriseId, enterprise.id),
          eq(repositoryRecords.url, url),
        ),
      });
      if (!repo) {
        throw new AssistantError("NOT_FOUND", "repository not imported — run repository.import first");
      }
      const expectedSha = typeof payload.commitSha === "string" ? payload.commitSha : repo.commitSha;
      const planRow = await db.query.repoAssignmentPlans.findFirst({
        where: and(
          eq(repoAssignmentPlans.repositoryId, repo.id),
          eq(repoAssignmentPlans.commitSha, expectedSha),
        ),
      });
      if (!planRow) {
        throw new AssistantError(
          "CONFLICT",
          "no routing plan for the current commit — re-inspect (hash drift)",
        );
      }
      const want = dto.action === "repository.assign" ? "assigned" : "proposed_new_structure";
      if (planRow.status !== want) {
        throw new AssistantError(
          "BAD_STATE",
          `routing plan is ${planRow.status}; ${dto.action} requires a ${want} plan`,
        );
      }
      if (planRow.appliedBy) {
        return `plan already applied by ${planRow.appliedBy} (idempotent)`;
      }
      const who = user.name ?? `user-${user.id}`;
      const [res] = await db
        .update(repoAssignmentPlans)
        .set({ appliedBy: who, appliedAt: new Date() })
        .where(and(eq(repoAssignmentPlans.id, planRow.id), sql`${repoAssignmentPlans.appliedBy} IS NULL`));
      if (res.affectedRows !== 1) throw new AssistantError("CONFLICT", "plan applied concurrently");
      // Honesty: assignment records a routing decision only. It never creates
      // companies/departments/roles, never clones code, never starts runs.
      await appendEnterpriseEvent(enterprise.id, {
        type:
          dto.action === "repository.assign"
            ? "assistant_repository_assigned"
            : "assistant_structure_proposal_recorded",
        actor: "human",
        payload: {
          repositoryId: repo.id,
          url: repo.url,
          commitSha: planRow.commitSha,
          companyKey: planRow.companyKey,
          departmentKey: planRow.departmentKey,
          confidence: planRow.confidence,
          appliedBy: who,
        },
      });
      return dto.action === "repository.assign"
        ? `repository assigned → ${planRow.companyKey}/${planRow.departmentKey} (routing decision only)`
        : `proposed_new_structure recorded at confidence ${planRow.confidence} (never auto-creates structure)`;
    }

    case "knowledge.transfer": {
      const transferKey = str(payload, "transferKey").slice(0, 80);
      const artifactIds = payload.artifactIds;
      if (!Array.isArray(artifactIds) || artifactIds.length === 0 || artifactIds.length > 16) {
        throw new AssistantError("VALIDATION", "payload.artifactIds must name 1-16 artifacts");
      }
      const refs: ArtifactRef[] = [];
      for (const rawId of artifactIds) {
        const artifactId = Number(rawId);
        const rows = await db
          .select({ artifact: artifacts, run: runs })
          .from(artifacts)
          .innerJoin(runs, eq(artifacts.runId, runs.id))
          .where(and(eq(artifacts.id, artifactId), eq(runs.enterpriseId, enterprise.id)))
          .limit(1);
        const found = rows[0];
        if (!found) {
          throw new AssistantError("NOT_FOUND", `artifact ${artifactId} not found in this enterprise`);
        }
        if (!found.artifact.contentSha256) {
          throw new AssistantError("NO_HASH", `artifact ${artifactId} has no content hash`);
        }
        refs.push({
          artifactId: found.artifact.id,
          runId: found.run.id,
          nodeKey: found.artifact.nodeKey,
          attempt: found.artifact.attempt,
          kind: found.artifact.kind,
          title: found.artifact.title,
          summary: (found.artifact.summary ?? "").slice(0, LEDGER_TEXT_CAPS.returnedSummary),
          contentSha256: found.artifact.contentSha256,
        });
      }
      const record = buildKnowledgeTransfer({
        id: transferKey,
        refs,
        handoff: {
          from: str(payload, "from"),
          to: str(payload, "to"),
          summary: typeof payload.summary === "string" ? payload.summary.slice(0, 2000) : "",
        },
      });
      const existing = await db.query.knowledgeTransfers.findFirst({
        where: and(
          eq(knowledgeTransfers.enterpriseId, enterprise.id),
          eq(knowledgeTransfers.transferKey, transferKey),
        ),
      });
      if (existing) {
        if (existing.contentSha256 !== record.contentSha256) {
          throw new AssistantError("CONFLICT", `transfer "${transferKey}" exists with different content`);
        }
        return `transfer ${transferKey} already recorded (idempotent)`;
      }
      await db.insert(knowledgeTransfers).values({
        ownerId: user.id,
        enterpriseId: enterprise.id,
        transferKey,
        refs: record.refs,
        handoff: record.handoff,
        contentSha256: record.contentSha256,
      });
      // HANDOFFS metadata: a study-kind pointer on the target scope queue.
      const scopeKey = dto.scope === "enterprise" ? "" : str(payload, "to").slice(0, 64);
      await queueAddItem(
        user,
        enterprise,
        dto.scope,
        scopeKey,
        {
          itemKey: `handoff:${transferKey}`.slice(0, 120),
          itemKind: "study",
          refId: transferKey,
          title: `HANDOFF ${record.handoff.from} → ${record.handoff.to} (${refs.length} ref${refs.length === 1 ? "" : "s"})`,
        },
        record.contentSha256,
      );
      await appendEnterpriseEvent(enterprise.id, {
        type: "assistant_knowledge_transferred",
        actor: "human",
        payload: {
          transferKey,
          from: record.handoff.from,
          to: record.handoff.to,
          refs: refs.map((r) => r.artifactId),
          contentSha256: record.contentSha256,
        },
      });
      return `knowledge transfer ${transferKey} recorded (${refs.length} refs, sha ${record.contentSha256.slice(0, 12)})`;
    }

    case "program.pump": {
      // The existing pump dispatches MOCK runs only (mode: "mock" is
      // hard-coded in pumpProgram); live/billed dispatches stay behind the
      // run-level gates (plan approval + confirmLive + pricing), which this
      // path never reaches.
      const programId = num(payload, "programId");
      await mustOwnProgram(user.id, programId);
      await pumpProgram(user, programId);
      return `program ${programId} pumped (mock dispatch only; live gates untouched)`;
    }

    default:
      throw new AssistantError("VALIDATION", `no executor for action "${dto.action}"`);
  }
}

/**
 * Execute an approved (or approval-free) proposal. Guards, in order:
 * emergency-stop rejection (stop is NOT an assistant action), full contract
 * validation (hash/policy/scope/forbidden/gates), OCC against the live
 * enterprise version, then the executor + event + version bump. Effects are
 * idempotent; a crash before the status CAS leaves the proposal approved and
 * safely retryable.
 */
export async function executeProposal(
  user: User,
  proposalId: number,
): Promise<AssistantProposalRow> {
  const db = getDb();
  const { proposal, enterprise } = await mustOwnProposal(user.id, proposalId);
  const dto = rowToProposal(proposal);

  // Emergency stop is deliberately NOT in ASSISTANT_ACTIONS. Defense-in-depth:
  // reject anything stop-flavoured even before contract validation.
  if (dto.action.toLowerCase().includes("stop")) {
    throw new AssistantError(
      "FORBIDDEN_ACTION",
      "emergency stop is not an assistant action — use the ungated program cancel / stop controls",
    );
  }
  const policy = ASSISTANT_ACTION_POLICIES[dto.action];
  if (!policy) throw new AssistantError("VALIDATION", `unknown action "${dto.action}"`);

  if (proposal.status === "executed") return proposal; // idempotent replay
  const approval = policy.requiresApproval
    ? { approved: true as const, confirmedGates: proposal.confirmedGates }
    : null;
  if (policy.requiresApproval && proposal.status !== "approved") {
    throw new AssistantError("BAD_STATE", `proposal is ${proposal.status}; approve it first`);
  }
  if (!policy.requiresApproval && !PROPOSAL_EXECUTING_STATUSES.includes(proposal.status as never)) {
    throw new AssistantError("BAD_STATE", `proposal is ${proposal.status}; cannot execute`);
  }
  try {
    validateAssistantAction(dto, approval);
  } catch (err) {
    mapContractError(err);
  }

  // OCC: the proposal was approved against an exact enterprise version.
  if (enterprise.version !== dto.expectedVersion) {
    throw new AssistantError(
      "CONFLICT",
      `enterprise state changed (version ${enterprise.version}, expected ${dto.expectedVersion}) — reload and re-propose`,
    );
  }

  let summary: string;
  try {
    summary = await executeAction({ user, enterprise, proposal, dto });
  } catch (err) {
    const message = err instanceof Error ? err.message.slice(0, 500) : "unknown";
    await db
      .update(assistantProposals)
      .set({ status: "failed", resultSummary: `failed: ${message}` })
      .where(eq(assistantProposals.id, proposalId));
    await appendEnterpriseEvent(enterprise.id, {
      type: "assistant_proposal_failed",
      actor: "system",
      payload: { proposalId, proposalKey: proposal.proposalKey, action: dto.action, error: message },
    });
    if (err instanceof AssistantError || err instanceof EnterpriseError) throw err;
    throw new AssistantError("EXECUTION_FAILED", message);
  }

  const [res] = await db
    .update(assistantProposals)
    .set({ status: "executed", executedAt: Date.now(), resultSummary: summary.slice(0, 2000) })
    .where(
      and(
        eq(assistantProposals.id, proposalId),
        inArray(assistantProposals.status, [...PROPOSAL_EXECUTING_STATUSES]),
      ),
    );
  if (res.affectedRows !== 1) {
    // A concurrent executor won — return the winner's row (idempotent).
    return (await db.query.assistantProposals.findFirst({
      where: eq(assistantProposals.id, proposalId),
    }))!;
  }
  await appendEnterpriseEvent(enterprise.id, {
    type: "assistant_proposal_executed",
    actor: "system",
    payload: {
      proposalId,
      proposalKey: proposal.proposalKey,
      action: dto.action,
      resultSummary: summary.slice(0, 500),
    },
  });
  await touchEnterprise(enterprise.id);
  return (await db.query.assistantProposals.findFirst({
    where: eq(assistantProposals.id, proposalId),
  }))!;
}

/**
 * One-call control path used by the router's direct controls: persist the
 * proposal (audit trail), decide it when the policy needs approval (the
 * caller's confirmation carries the gates), and execute. Non-approval actions
 * execute immediately. Returns the final proposal row.
 */
export async function runDirectAction(
  user: User,
  enterpriseId: number,
  input: ProposeActionInput & {
    confirmation?: { approved: boolean; confirmedGates: readonly AssistantGate[] };
  },
): Promise<{ proposal: AssistantProposalRow; replayed: boolean }> {
  const { proposal, replayed } = await proposeAction(user, enterpriseId, input);
  if (replayed && (proposal.status === "executed" || proposal.status === "failed")) {
    return { proposal, replayed: true };
  }
  const policy = ASSISTANT_ACTION_POLICIES[input.action];
  if (policy.requiresApproval) {
    if (input.confirmation?.approved !== true) {
      throw new AssistantError(
        "APPROVAL_REQUIRED",
        `"${input.action}" requires approval with confirmed gates: ${policy.gates.join(", ") || "none"}`,
      );
    }
    if (proposal.status === "proposed") {
      await decideProposal(user, proposal.id, "approved", input.confirmation.confirmedGates);
    }
  }
  const executed = await executeProposal(user, proposal.id);
  return { proposal: executed, replayed };
}

// ── Deterministic jobs: bounded sweep, claim-first, no storms ────

const REPOSITORY_TRIAGE_AGE_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * The deterministic effect of one job kind. NO provider calls, NO paid
 * calls, NO proposal execution — the contract's ASSISTANT_JOB_POLICIES are
 * re-asserted here so a kind can never smuggle in a side effect.
 */
async function runAssistantJobEffect(job: AssistantJobRow): Promise<string> {
  const policy = ASSISTANT_JOB_POLICIES[job.kind];
  if (!policy || policy.providerCalls !== false || policy.paidCalls !== false || policy.executesProposals !== false) {
    throw new AssistantError("VALIDATION", `job kind "${job.kind}" violates the deterministic job policy`);
  }
  const db = getDb();
  const owner = await db.query.users.findFirst({ where: eq(users.id, job.ownerId) });
  if (!owner) throw new AssistantError("NOT_FOUND", "job owner missing");

  switch (job.kind) {
    case "ledger_refresh": {
      // The ledger is derived on demand; refreshing proves the derivation
      // stays readable and records the entry count.
      const entries = await deriveEnterpriseLedger(job.ownerId, job.enterpriseId);
      return `ledger derived (${entries.length} entries)`;
    }
    case "cache_refresh": {
      const removed = invalidateEnterpriseSnapshotCache(job.enterpriseId);
      return `snapshot cache refreshed (${removed} memoized entries dropped)`;
    }
    case "program_pump_mock": {
      const programs = await db
        .select({ id: enterprisePrograms.id })
        .from(enterprisePrograms)
        .where(
          and(
            eq(enterprisePrograms.enterpriseId, job.enterpriseId),
            inArray(enterprisePrograms.state, ["dispatching", "running"]),
            sql`${enterprisePrograms.pausedAt} IS NULL`,
          ),
        )
        .limit(4);
      for (const p of programs) {
        // pumpProgram dispatches mode:"mock" runs only — never live billing.
        await pumpProgram(null, p.id);
      }
      return `pumped ${programs.length} active program(s) (mock only)`;
    }
    case "repository_sync": {
      // No provider calls: stale CONFIRMED metadata becomes triage queue
      // items for a human to re-inspect explicitly.
      const stale = await db
        .select({ id: repositoryRecords.id, url: repositoryRecords.url })
        .from(repositoryRecords)
        .where(
          and(
            eq(repositoryRecords.enterpriseId, job.enterpriseId),
            sql`${repositoryRecords.updatedAt} < FROM_UNIXTIME(${Date.now() - REPOSITORY_TRIAGE_AGE_MS} / 1000)`,
          ),
        )
        .limit(16);
      let queued = 0;
      for (const repo of stale) {
        const { added } = await queueAddItem(
          owner,
          { id: job.enterpriseId } as Enterprise,
          "enterprise",
          "",
          {
            itemKey: `triage:${repo.id}`,
            itemKind: "repository-triage",
            refId: String(repo.id),
            title: `re-inspect ${repo.url.slice(0, 160)} (metadata older than 30d)`,
          },
          sha256Hex(`triage:${repo.id}`),
        );
        if (added) queued += 1;
      }
      return `repository drift triage: ${queued} item(s) queued (${stale.length} stale)`;
    }
    case "study_plan": {
      const contracts = await db
        .select({ skillPin: workerContracts.skillPin })
        .from(workerContracts)
        .where(
          and(
            eq(workerContracts.enterpriseId, job.enterpriseId),
            eq(workerContracts.staffed, true),
            inArray(workerContracts.status, ["active", "proposed"]),
          ),
        )
        .limit(16);
      const skillIds = [...new Set(contracts.map((c) => c.skillPin.skillId))].slice(0, 8);
      let drafts = 0;
      for (const skillId of skillIds) {
        drafts += await enqueueStudyDrafts(owner, job.enterpriseId, {
          skillId,
          goal: `deterministic study plan for ${skillId} (draft; never a paid provider call)`,
        });
      }
      return `study plan: ${drafts} draft(s) across ${skillIds.length} skill(s)`;
    }
    default:
      throw new AssistantError("VALIDATION", `unknown job kind "${job.kind}"`);
  }
}

/**
 * Claim a due job (conditional UPDATE on version+enabled+due) then run its
 * deterministic effect. Claim-first makes the sweep crash-safe: at most one
 * sweeper runs a firing, a crash mid-effect never double-runs, and the
 * precomputed nextRunAt (scheduleNextRun skip-forward) prevents missed-run
 * storms even after long downtime.
 */
async function runClaimedAssistantJob(
  job: AssistantJobRow,
  opts: { requireDue: boolean },
): Promise<string> {
  const db = getDb();
  const now = Date.now();
  const claimed = rowToJob(job);
  const after: AssistantJob = { ...claimed, runCount: claimed.runCount + 1, lastRunAt: now };
  const nextRunAt = scheduleNextRun(after, now);
  const where = [
    eq(assistantJobs.id, job.id),
    eq(assistantJobs.version, job.version),
    eq(assistantJobs.enabled, true),
  ];
  if (opts.requireDue) {
    where.push(sql`${assistantJobs.nextRunAt} IS NOT NULL AND ${assistantJobs.nextRunAt} <= ${now}`);
  }
  const [res] = await db
    .update(assistantJobs)
    .set({
      runCount: sql`${assistantJobs.runCount} + 1`,
      lastRunAt: now,
      nextRunAt,
      version: sql`${assistantJobs.version} + 1`,
    })
    .where(and(...where));
  if (res.affectedRows !== 1) {
    throw new AssistantError("CONFLICT", "job was claimed concurrently (or is disabled/not due)");
  }
  const summary = await runAssistantJobEffect(job);
  await appendEnterpriseEvent(job.enterpriseId, {
    type: "assistant_job_run",
    actor: "system",
    payload: { jobKey: job.jobKey, kind: job.kind, runCount: job.runCount + 1, nextRunAt, summary: summary.slice(0, 500) },
  });
  return summary;
}

/**
 * Bounded sweep hook (called from sweepAndAdvanceOnce): at most `limit` due
 * jobs per pass, each claimed then executed. Per-job failures are recorded
 * as events and never abort the pass.
 */
export async function sweepAssistantJobs({ limit = 25 }: { limit?: number } = {}): Promise<{
  claimed: number;
  failed: number;
}> {
  const db = getDb();
  const now = Date.now();
  const due = await db
    .select()
    .from(assistantJobs)
    .where(
      and(
        eq(assistantJobs.enabled, true),
        sql`${assistantJobs.nextRunAt} IS NOT NULL AND ${assistantJobs.nextRunAt} <= ${now}`,
      ),
    )
    .orderBy(asc(assistantJobs.nextRunAt))
    .limit(Math.min(Math.max(1, limit), 25));
  let claimed = 0;
  let failed = 0;
  for (const job of due) {
    try {
      await runClaimedAssistantJob(job, { requireDue: true });
      claimed += 1;
    } catch (err) {
      if (err instanceof AssistantError && err.code === "CONFLICT") continue; // lost the race
      failed += 1;
      try {
        await appendEnterpriseEvent(job.enterpriseId, {
          type: "assistant_job_failed",
          actor: "system",
          payload: {
            jobKey: job.jobKey,
            kind: job.kind,
            error: err instanceof Error ? err.message.slice(0, 300) : "unknown",
          },
        });
      } catch {
        /* event append is best-effort */
      }
    }
  }
  return { claimed, failed };
}

// ── Reads (queries never advance state) ──────────────────────────

export async function listProposals(
  userId: number,
  enterpriseId: number,
  opts: { status?: string; limit?: number } = {},
) {
  const db = getDb();
  await mustOwnEnterprise(userId, enterpriseId);
  const where = [eq(assistantProposals.enterpriseId, enterpriseId)];
  if (opts.status) where.push(eq(assistantProposals.status, opts.status as never));
  return db
    .select()
    .from(assistantProposals)
    .where(and(...where))
    .orderBy(desc(assistantProposals.id))
    .limit(Math.min(opts.limit ?? 50, 200));
}

export async function listJobs(userId: number, enterpriseId: number) {
  const db = getDb();
  await mustOwnEnterprise(userId, enterpriseId);
  return db
    .select()
    .from(assistantJobs)
    .where(eq(assistantJobs.enterpriseId, enterpriseId))
    .orderBy(asc(assistantJobs.jobKey))
    .limit(200);
}

export async function listStudyItems(
  userId: number,
  enterpriseId: number,
  opts: { status?: string; limit?: number } = {},
) {
  const db = getDb();
  await mustOwnEnterprise(userId, enterpriseId);
  const where = [eq(studyQueueItems.enterpriseId, enterpriseId)];
  if (opts.status) where.push(eq(studyQueueItems.status, opts.status as never));
  return db
    .select()
    .from(studyQueueItems)
    .where(and(...where))
    .orderBy(desc(studyQueueItems.id))
    .limit(Math.min(opts.limit ?? 100, 500));
}

export async function listKnowledgeTransfers(userId: number, enterpriseId: number) {
  const db = getDb();
  await mustOwnEnterprise(userId, enterpriseId);
  return db
    .select()
    .from(knowledgeTransfers)
    .where(eq(knowledgeTransfers.enterpriseId, enterpriseId))
    .orderBy(desc(knowledgeTransfers.id))
    .limit(100);
}

/** Export = the same refs-only rows (never artifact bodies). */
export async function exportKnowledgeTransfers(userId: number, enterpriseId: number) {
  const rows = await listKnowledgeTransfers(userId, enterpriseId);
  return rows.map((r) => ({
    contractVersion: ASSISTANT_CONTRACT_VERSION,
    id: r.transferKey,
    refs: r.refs,
    handoff: r.handoff,
    contentSha256: r.contentSha256,
    createdAt: r.createdAt,
  }));
}

/** Aggregate assistant status (counts + cache view; pure read). */
export async function assistantStatus(userId: number, enterpriseId: number) {
  const db = getDb();
  await mustOwnEnterprise(userId, enterpriseId);
  const [row] = await db
    .select({
      proposals: sql<number>`(SELECT COUNT(*) FROM ${assistantProposals} WHERE ${assistantProposals.enterpriseId} = ${enterpriseId})`,
      pendingProposals: sql<number>`(SELECT COUNT(*) FROM ${assistantProposals} WHERE ${assistantProposals.enterpriseId} = ${enterpriseId} AND ${assistantProposals.status} IN ('proposed','approved'))`,
      jobs: sql<number>`(SELECT COUNT(*) FROM ${assistantJobs} WHERE ${assistantJobs.enterpriseId} = ${enterpriseId})`,
      enabledJobs: sql<number>`(SELECT COUNT(*) FROM ${assistantJobs} WHERE ${assistantJobs.enterpriseId} = ${enterpriseId} AND ${assistantJobs.enabled} = true)`,
      queues: sql<number>`(SELECT COUNT(*) FROM ${assistantWorkQueues} WHERE ${assistantWorkQueues.enterpriseId} = ${enterpriseId})`,
      studyDrafts: sql<number>`(SELECT COUNT(*) FROM ${studyQueueItems} WHERE ${studyQueueItems.enterpriseId} = ${enterpriseId})`,
      repos: sql<number>`(SELECT COUNT(*) FROM ${repositoryRecords} WHERE ${repositoryRecords.enterpriseId} = ${enterpriseId})`,
      transfers: sql<number>`(SELECT COUNT(*) FROM ${knowledgeTransfers} WHERE ${knowledgeTransfers.enterpriseId} = ${enterpriseId})`,
    })
    .from(enterprises)
    .where(eq(enterprises.id, enterpriseId));
  return {
    proposals: Number(row?.proposals ?? 0),
    pendingProposals: Number(row?.pendingProposals ?? 0),
    jobs: Number(row?.jobs ?? 0),
    enabledJobs: Number(row?.enabledJobs ?? 0),
    queues: Number(row?.queues ?? 0),
    studyDrafts: Number(row?.studyDrafts ?? 0),
    repositories: Number(row?.repos ?? 0),
    knowledgeTransfers: Number(row?.transfers ?? 0),
    cache: enterpriseSnapshotCacheStatus(),
    definitions: ASSISTANT_DEFINITIONS,
  };
}

/** Re-export for the router's knowledge list typing. */
export type { KnowledgeTransferRow };
