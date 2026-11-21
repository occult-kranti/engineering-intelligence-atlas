import { and, eq, inArray, sql } from "drizzle-orm";
import { createHash } from "node:crypto";
import { getDb } from "../queries/connection";
import {
  agents,
  approvals,
  artifacts,
  autonomyGrants,
  budgetLedger,
  dagRevisions,
  officeAssignments,
  officeBlueprints,
  officeRooms,
  projects,
  runNodes,
  runs,
  skills,
  workers,
  type Run,
  type RunNode,
  type Skill,
  type User,
} from "@db/schema";
import type { DagSpec, NodeSpec } from "@contracts/dag";
import { usdToMicros } from "@contracts/dag";
import {
  ArtifactObjectSchema,
  checkArtifactAcceptance,
} from "@contracts/artifacts";
import type { ArtifactObjectT } from "@contracts/artifacts";
import {
  RUN_STATES,
  TERMINAL_NODE_STATES,
  TERMINAL_RUN_STATES,
  type ProviderId,
  type RunMode,
} from "@contracts/run";
import {
  claimNextNode,
  ensureDirectorWorker,
  listAdvanceableRuns,
  sweepExpiredLeases,
} from "./control-plane";
import { compileNodePrompt } from "./prompt";
import type { ArtifactPromptMeta } from "@db/schema";
import { getProvider } from "../ai/provider";
import { appendEvent } from "./events";
import { validateDag } from "./dag-validate";
import { makeValidationContext } from "./context";
import { priceUsage, resolvePricing } from "./pricing";
import { storage } from "../lib/storage";
import { log } from "../lib/logger";
import type { ApprovalKind } from "@contracts/run";
import type { GoalMode } from "@contracts/office";
import { GOAL_MODES } from "@contracts/office";
import {
  approvalBypassedEvent,
  budgetFitsGrant,
  grantBudgetExceededEvent,
  grantUsageExceeded,
  isGrantActive,
  resolveApprovalGate,
} from "../office/autonomy";
import {
  appendOfficeEventTx,
  ensureOfficeWorkers,
  ensureRoleWorker,
  expireAutonomyGrants,
  grantUsage,
  loadGrantById,
  loadRunGrant,
  sweepDrainingAssignments,
} from "../office/store";
import type { AutonomyGrant } from "@contracts/office";

/**
 * Run engine (spec §8) with the Revision A control plane: the run's
 * run_nodes ARE the durable shared roadmap, and every dispatch goes through
 * the atomic claim/lease protocol in ./control-plane (the director is a
 * seeded "worker 0"). Step-through dispatch: `advanceRun` claims ready nodes
 * via a state+version-guarded CAS and persists every transition as an
 * append-only event before moving on, so a process restart loses nothing —
 * recovery re-enters via `ensureAdvancing` (mutations, startup sweep, and
 * the unref'd boot interval — never from query handlers).
 *
 * Enforcement, all server-side and re-checked per dispatch:
 *   - token / call / minute / USD-dollar budgets at node AND run scope
 *     (hard stop → stopped_budget with a partial-evidence event);
 *   - elapsed-time deadlines via AbortSignal on the provider call
 *     (abort → termination events; never a silent swallow);
 *   - no automatic retry of billable calls — any provider failure surfaces
 *     as a typed event and the run stops for deliberate human action;
 *   - plan approval + explicit live-start confirmation before live dispatch;
 *   - per-node start/accept approval gates;
 *   - lease fencing: every write in the dispatch path is guarded by the
 *     lease token (+ state), so stop/pause/expiry mid-call fences the late
 *     completion instead of writing onto a stopped run.
 */

/**
 * Process-local dedupe ONLY (doc §9.4.1): correctness comes from the DB
 * claim CAS, so replicas may both scan — only one wins each node.
 */
const inFlight = new Set<number>();

export function ensureAdvancing(runId: number): void {
  if (inFlight.has(runId)) return;
  void advanceRun(runId).catch((err) => {
    log.error("advanceRun crashed", {
      runId,
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    });
  });
}

// ── Helpers ──────────────────────────────────────────────────────

/**
 * Guarded run-state transition (doc §9.4.3): never leaves terminal states,
 * optionally restricted to explicit source states, bumps the OCC version.
 * 0 rows = another loop/human handled it — callers re-read and continue.
 * Returns true when the transition (and its event) was written.
 */
export async function setRunState(
  runId: number,
  state: Run["state"],
  opts: {
    endReason?: string;
    actor?: "director" | "system" | "human";
    fromStates?: Run["state"][];
  } = {},
): Promise<boolean> {
  const db = getDb();
  const fromStates = opts.fromStates ?? RUN_STATES.filter((s) => !TERMINAL_RUN_STATES.has(s));
  const [res] = await db
    .update(runs)
    .set({
      state,
      version: sql`${runs.version} + 1`,
      ...(TERMINAL_RUN_STATES.has(state) ? { endedAt: new Date() } : {}),
      ...(opts.endReason !== undefined ? { endReason: opts.endReason } : {}),
    })
    .where(and(eq(runs.id, runId), inArray(runs.state, fromStates)));
  if (res.affectedRows !== 1) return false;
  await appendEvent(runId, {
    type: state === "completed" ? "run_completed" : "run_state",
    actor: opts.actor ?? "director",
    payload: { state, endReason: opts.endReason ?? null },
  });
  return true;
}

/**
 * Guarded node-state transition: bumps the OCC version; terminal states and
 * `ready` clear the lease (fencing stale writers). When `guard` is given the
 * update only matches the current lease holder / source states — 0 rows
 * means the write is fenced and NO event is appended.
 */
export async function setNodeState(
  runId: number,
  nodeKey: string,
  state: RunNode["state"],
  payload: Record<string, unknown> = {},
  guard: { leaseToken?: string; fromStates?: RunNode["state"][] } = {},
): Promise<boolean> {
  const db = getDb();
  const terminal = TERMINAL_NODE_STATES.has(state);
  const clearsLease = terminal || state === "ready" || state === "waiting" || state === "cancelled";
  const [res] = await db
    .update(runNodes)
    .set({
      state,
      version: sql`${runNodes.version} + 1`,
      ...(state === "running" ? { startedAt: new Date(), heartbeatAt: new Date() } : {}),
      ...(terminal ? { endedAt: new Date() } : {}),
      ...(clearsLease
        ? { leaseToken: null, leaseWorkerId: null, leaseExpiresAt: null, heartbeatAt: null }
        : {}),
      ...(state === "waiting" && payload.waitReason
        ? { waitReason: payload.waitReason as RunNode["waitReason"] }
        : state !== "waiting"
          ? { waitReason: null }
          : {}),
    })
    .where(
      and(
        eq(runNodes.runId, runId),
        eq(runNodes.nodeKey, nodeKey),
        guard.leaseToken ? eq(runNodes.leaseToken, guard.leaseToken) : sql`1=1`,
        guard.fromStates ? inArray(runNodes.state, guard.fromStates) : sql`1=1`,
      ),
    );
  if (res.affectedRows !== 1) return false;
  await appendEvent(runId, {
    type: "node_state",
    actor: "node",
    nodeKey,
    payload: { state, ...payload },
  });
  return true;
}

/**
 * Atomic usage accounting (fixes the §3.4 lost-update race): increments in
 * the statement itself, fenced by the lease token so a fenced dispatch
 * cannot write its counters onto a recycled node.
 */
export async function addNodeUsage(
  nodeId: number,
  leaseToken: string,
  usage: { tokens: number; calls: number },
): Promise<boolean> {
  const db = getDb();
  const [res] = await db
    .update(runNodes)
    .set({
      tokensUsed: sql`${runNodes.tokensUsed} + ${usage.tokens}`,
      callsUsed: sql`${runNodes.callsUsed} + ${usage.calls}`,
      version: sql`${runNodes.version} + 1`,
    })
    .where(
      and(
        eq(runNodes.id, nodeId),
        eq(runNodes.leaseToken, leaseToken),
        eq(runNodes.state, "running"),
      ),
    );
  return res.affectedRows === 1;
}

/** MySQL/TiDB duplicate-key detection (drizzle wraps the driver error). */
export function isDuplicateKeyError(err: unknown): boolean {
  const e = err as { code?: string; errno?: number; cause?: { code?: string; errno?: number } };
  return (
    e?.code === "ER_DUP_ENTRY" ||
    e?.errno === 1062 ||
    e?.cause?.code === "ER_DUP_ENTRY" ||
    e?.cause?.errno === 1062
  );
}

interface RunUsage {
  promptTokens: number;
  completionTokens: number;
  calls: number;
  costUsdMicros: number;
  elapsedMinutes: number;
}

export async function runUsage(run: Run): Promise<RunUsage> {
  const db = getDb();
  const [row] = await db
    .select({
      prompt: sql<number>`COALESCE(SUM(${budgetLedger.tokensPrompt}), 0)`,
      completion: sql<number>`COALESCE(SUM(${budgetLedger.tokensCompletion}), 0)`,
      calls: sql<number>`COALESCE(SUM(${budgetLedger.calls}), 0)`,
      cost: sql<number>`COALESCE(SUM(${budgetLedger.costUsdMicros}), 0)`,
    })
    .from(budgetLedger)
    .where(eq(budgetLedger.runId, run.id));
  return {
    promptTokens: Number(row?.prompt ?? 0),
    completionTokens: Number(row?.completion ?? 0),
    calls: Number(row?.calls ?? 0),
    costUsdMicros: Number(row?.cost ?? 0),
    elapsedMinutes: (Date.now() - run.startedAt.getTime()) / 60_000,
  };
}

/** Returns the dimension that is exhausted, or null. */
export function runBudgetOverrun(run: Run, u: RunUsage): string | null {
  const b = run.budget;
  if (u.promptTokens + u.completionTokens >= b.maxTokens) return "tokens";
  if (u.calls >= b.maxCalls) return "calls";
  if (u.elapsedMinutes >= b.maxMinutes) return "minutes";
  if (u.costUsdMicros >= usdToMicros(b.maxCostUsd)) return "costUsd";
  return null;
}

export function nodeBudgetOverrun(node: RunNode, spec: NodeSpec): string | null {
  if (node.tokensUsed >= spec.budget.maxTokens) return "tokens";
  if (node.callsUsed >= spec.budget.maxCalls) return "calls";
  if (node.startedAt) {
    const elapsed = (Date.now() - node.startedAt.getTime()) / 60_000;
    if (elapsed >= spec.budget.maxMinutes) return "minutes";
  }
  return null;
}

// ── Autonomy gates (design §2.4) ─────────────────────────────────
//
// resolveApprovalGate is called from exactly TWO places in this loop: the
// start-gate block in advanceRun and the approvalBefore==='accept' block in
// dispatchNode. No third call site. "forbidden" is a run-start answer (see
// createRun); inside the loop it degrades to "require" (fail closed).

interface GateResolution {
  decision: "require" | "bypass";
  grant: AutonomyGrant | null;
}

/**
 * Resolve the autonomy gate for one node. The grant is re-loaded on every
 * call (never cached across dispatches): a mid-run revoke/expiry degrades
 * the NEXT gated node to the normal approval flow, per design §2.3.
 */
async function resolveNodeGate(
  run: Run,
  node: NodeSpec,
  kind: ApprovalKind,
): Promise<GateResolution> {
  const grant = await loadRunGrant(run);
  if (!grant) return { decision: "require", grant: null };
  const db = getDb();
  const project = await db.query.projects.findFirst({
    where: eq(projects.id, run.projectId),
  });
  const decision = resolveApprovalGate({
    grant,
    run: { mode: run.mode },
    project: { riskTier: project?.riskTier ?? "high" }, // unknown ⇒ fail closed
    node,
    approvalKind: kind,
  });
  return { decision: decision === "bypass" ? "bypass" : "require", grant };
}

/**
 * Grant-ceiling pre-check, run next to runBudgetOverrun (design §2.4): the
 * summed usage of every run sharing the grant is compared against the
 * grant's hard ceilings; crossing one emits `grant_budget_exceeded` and
 * stops the run `stopped_human` (deliberate human action — the owner must
 * raise a new grant; there is no auto-top-up).
 */
async function checkGrantBudget(run: Run): Promise<boolean> {
  if (!run.autonomyGrantId) return false;
  const grant = await loadGrantById(run.autonomyGrantId);
  if (!grant) return false;
  const breach = grantUsageExceeded(grant, await grantUsage(grant.id));
  if (!breach) return false;
  const draft = grantBudgetExceededEvent({ grantId: grant.id, breach });
  await appendEvent(run.id, {
    type: draft.type,
    actor: draft.actor,
    payload: draft.payload,
  });
  const stopped = await setRunState(run.id, "stopped_human", {
    endReason: `autonomy grant ${grant.id} ceiling exceeded: ${breach.ceiling} (${breach.used} > ${breach.limit})`,
    actor: "system",
  });
  if (stopped) {
    await revokeRunLeases(run.id, `autonomy grant ${grant.id} budget exceeded`);
  }
  return true;
}

async function stopForBudget(run: Run, dimension: string, scope: string) {
  await appendEvent(run.id, {
    type: "budget_exceeded",
    actor: "system",
    payload: {
      dimension,
      scope,
      message: `${scope} ${dimension} budget exhausted — hard stop; partial artifacts and ledger preserved`,
    },
  });
  await setRunState(run.id, "stopped_budget", {
    endReason: `${scope}:${dimension}`,
  });
}

// ── Run creation ─────────────────────────────────────────────────

export interface CreateRunInput {
  user: User;
  projectId: number;
  dagRevisionId: number;
  mode: RunMode;
  provider: ProviderId;
  model?: string;
  confirmLive?: boolean;
  /** Explicit parallelism opt-in; default 1 = serial (budget-safe). */
  maxParallelNodes?: number;
  /** Active autonomy grant to stamp on the run (design §2.4); absence = mode 'all'. */
  autonomyGrantId?: number;
  /** Provider goal mode preset applied at prompt compile (design §3). */
  goalMode?: GoalMode;
  /**
   * Enterprise (CEO mode) dispatch context. When present, the owner chain
   * (enterprise → company → this project) and the enterprise envelope /
   * company budget partitions are verified BEFORE the run graph exists, and
   * the run + its ledger rows are stamped for rollup. Plan approval and
   * confirmLive gates above are unchanged and apply regardless.
   */
  enterpriseContext?: { enterpriseId: number; companyId: number; contractId?: number };
}

export class RunStartError extends Error {
  violations?: { rule: string; path: string; message: string }[];
  constructor(
    message: string,
    violations?: { rule: string; path: string; message: string }[],
  ) {
    super(message);
    this.name = "RunStartError";
    this.violations = violations;
  }
}

export async function createRun(input: CreateRunInput): Promise<Run> {
  const db = getDb();
  const revision = await db.query.dagRevisions.findFirst({
    where: and(
      eq(dagRevisions.id, input.dagRevisionId),
      eq(dagRevisions.projectId, input.projectId),
    ),
  });
  if (!revision) throw new RunStartError("dag revision not found");

  const spec = revision.spec;

  // Plan approval gate: the revision must be frozen/approved before any run.
  if (!revision.approvedAt) {
    throw new RunStartError(
      "plan is not approved — approve the current DAG revision before starting a run (edits invalidate approval)",
    );
  }
  // Explicit run-start approval for live mode (billing disclosure gate).
  if (input.mode === "live" && input.confirmLive !== true) {
    throw new RunStartError(
      "live runs require explicit run-start confirmation (confirmLive) after the billing disclosure",
    );
  }
  if (spec.nodes.length === 0) {
    throw new RunStartError("plan has no nodes — add at least one node");
  }

  // Identical server-side validation at run start (never trust the editor).
  const result = await validateDag(spec, makeValidationContext());
  if (!result.ok) {
    throw new RunStartError("plan failed server-side validation", result.violations);
  }

  // Autonomy grant compatibility (design §2.4): ownership/scope/expiry/mode
  // are verified BEFORE the run exists; a `forbidden` combination fails
  // closed, matching the plan-approval gate's style. Mode 'none' never
  // waives plan approval, confirmLive, or any never-bypassable class — it
  // only preauthorizes per-node gates inside hard budget ceilings.
  let grant: AutonomyGrant | null = null;
  if (input.autonomyGrantId !== undefined) {
    const loaded = await loadGrantById(input.autonomyGrantId);
    if (!loaded || loaded.projectId !== input.projectId) {
      throw new RunStartError("autonomy grant not found for this project");
    }
    if (!isGrantActive(loaded, Date.now())) {
      throw new RunStartError("autonomy grant is expired or revoked — raise a new grant");
    }
    if (loaded.scope === "run" && loaded.runId !== null) {
      throw new RunStartError(`autonomy grant ${loaded.id} is bound to run ${loaded.runId}`);
    }
    const grantProject = await db.query.projects.findFirst({
      where: eq(projects.id, input.projectId),
    });
    // Fail closed for EVERY mode: a grant with allowLive=false preauthorizes
    // mock runs only — no live run may start under it, whatever the mode.
    if (input.mode === "live" && !loaded.allowLive) {
      throw new RunStartError(
        `autonomy grant ${loaded.id} does not preauthorize live runs (allowLive=false); raise a live-enabled grant or start a mock run`,
      );
    }
    if (loaded.mode === "none") {
      if (grantProject?.riskTier === "high") {
        throw new RunStartError(
          "autonomy mode 'none' may not be preauthorized on a high-risk project (forbidden)",
        );
      }
      if (input.mode === "live") {
        if (grantProject?.riskTier !== "low") {
          throw new RunStartError(
            "autonomy mode 'none' for a live run requires allowLive and a low-risk project",
          );
        }
        if (!budgetFitsGrant(spec.budget, loaded)) {
          throw new RunStartError(
            "run budget exceeds the autonomy grant's hard ceilings — raise a larger grant or shrink the plan budget",
          );
        }
      }
    }
    grant = loaded;
  }
  const goalMode: GoalMode =
    input.goalMode && (GOAL_MODES as readonly string[]).includes(input.goalMode)
      ? input.goalMode
      : "build";

  // Enterprise owner-chain + budget-partition gate (CEO mode): verified
  // before any row exists, fail-closed like the plan gate above.
  if (input.enterpriseContext) {
    const { checkEnterpriseReservation, EnterpriseError } = await import("../enterprise");
    try {
      await checkEnterpriseReservation(input.user.id, {
        enterpriseId: input.enterpriseContext.enterpriseId,
        companyId: input.enterpriseContext.companyId,
        projectId: input.projectId,
        runBudget: spec.budget,
      });
    } catch (err) {
      if (err instanceof EnterpriseError) throw new RunStartError(err.message);
      throw err;
    }
  }

  const provider = await getProvider(input.mode === "mock" ? "mock" : input.provider);

  let model = "mock-deterministic";
  if (input.mode === "live") {
    const avail = provider.availabilityFor
      ? await provider.availabilityFor(input.user.id)
      : provider.availability();
    if (!avail.configured) {
      throw new RunStartError(
        `live provider "${provider.id}" is not configured: ${avail.reason ?? "missing server configuration"}`,
      );
    }
    if (provider.id === "gateway") {
      const list = await provider.listModels();
      const ids = new Set(list.models.map((m) => m.id));
      model = input.model ?? list.defaultModelId;
      if (!ids.has(model)) {
        throw new RunStartError(
          `model "${model}" is not in the gateway's live model list (models are discovered at runtime, never assumed)`,
        );
      }
    } else {
      const list = await provider.listModels(input.user.id);
      model = input.model ?? list.defaultModelId;
    }
    // Dollar enforcement must be real: without configured pricing for this
    // provider/model, cost-capped live dispatch is blocked — never guessed.
    const pricing = await resolvePricing(input.user.id, provider.id, model);
    if (!pricing) {
      throw new RunStartError(
        `no USD pricing configured for ${provider.id}/${model}. Set owner pricing (Director → Settings) or server env ${provider.id.toUpperCase()}_INPUT_USD_PER_MILLION / ${provider.id.toUpperCase()}_OUTPUT_USD_PER_MILLION before starting a cost-capped live run.`,
      );
    }
  }

  // Seed the project worker pool's "worker 0" before the run graph exists.
  await ensureDirectorWorker(input.projectId);

  const runId = await createRunGraph({
    projectId: input.projectId,
    dagRevisionId: revision.id,
    mode: input.mode,
    providerId: provider.id,
    model,
    budget: spec.budget,
    startedBy: input.user.id,
    maxParallelNodes: input.maxParallelNodes,
    autonomyGrantId: grant?.id,
    goalMode,
    enterpriseContext: input.enterpriseContext,
    nodes: spec.nodes,
  });

  // A run-scoped grant not yet bound dies with this run (design §2.2). The
  // binding update is guarded (runId IS NULL) and MUST win: a concurrent
  // run holding the same grant loses cleanly — its run is stopped and the
  // caller rejected rather than silently sharing a single-run grant.
  if (grant && grant.scope === "run" && grant.runId === null) {
    const [bound] = await db
      .update(autonomyGrants)
      .set({ runId })
      .where(and(eq(autonomyGrants.id, grant.id), sql`${autonomyGrants.runId} IS NULL`));
    if (bound.affectedRows !== 1) {
      await setRunState(runId, "stopped_human", {
        endReason: `autonomy grant ${grant.id} was bound to a concurrent run; this run cannot use it`,
        actor: "system",
      });
      throw new RunStartError(
        `autonomy grant ${grant.id} is already bound to another run (concurrent bind lost)`,
      );
    }
  }

  await appendEvent(runId, {
    type: "run_created",
    actor: "human",
    payload: {
      mode: input.mode,
      provider: provider.id,
      model,
      planHash: revision.planHash,
      budget: spec.budget,
      billing:
        input.mode === "live"
          ? "Live run: model calls are billed to the site owner. 网站将根据使用的云服务和 API 调用产生计费。"
          : "Mock run: deterministic, no model quota consumed (ordinary site runtime only).",
    },
  });
  await appendEvent(runId, {
    type: "run_started",
    actor: "director",
    payload: { state: "queued" },
  });

  ensureAdvancing(runId);
  const run = await db.query.runs.findFirst({ where: eq(runs.id, runId) });
  return run!;
}

/**
 * Run + hired agents + run_nodes in ONE transaction (fixes §3.6: a mid-loop
 * crash previously left a half-created run). Skill rows are resolved BEFORE
 * the transaction (read-only); any insert failure rolls back the whole
 * graph — no partial runs, no orphan agents/nodes.
 */
export async function createRunGraph(input: {
  projectId: number;
  dagRevisionId: number;
  mode: RunMode;
  providerId: string;
  model: string;
  budget: Run["budget"];
  startedBy: number;
  maxParallelNodes?: number;
  autonomyGrantId?: number;
  goalMode?: GoalMode;
  enterpriseContext?: { enterpriseId: number; companyId: number; contractId?: number };
  nodes: NodeSpec[];
}): Promise<number> {
  const db = getDb();
  // Resolve skills up-front: no non-null assertions inside the tx, and a
  // missing/drifted pin fails BEFORE any row exists (fixes §3.7 `skill!`).
  const resolved: { node: NodeSpec; skill: Skill }[] = [];
  for (const node of input.nodes) {
    const skill = await db.query.skills.findFirst({
      where: and(
        eq(skills.name, node.skill.name),
        eq(skills.version, node.skill.version),
      ),
    });
    if (!skill) {
      throw new RunStartError(
        `skill pin ${node.skill.name}@${node.skill.version} no longer resolves`,
      );
    }
    resolved.push({ node, skill });
  }

  // ── First-run hire-and-populate (design §4.5) ──
  // When the project has an ACTIVE office blueprint, every hired specialist
  // is seated in its mapped room inside the SAME transaction as the run
  // graph — a mapping/capacity failure rolls back run + agents + nodes +
  // assignments together (no half-hired offices).
  const blueprint = await db.query.officeBlueprints.findFirst({
    where: and(eq(officeBlueprints.projectId, input.projectId), eq(officeBlueprints.status, "active")),
  });
  let populate: {
    roomById: Map<number, { roomKey: string; capacity: number }>;
    roomKeyByNodeKey: Map<string, string>;
    seats: { roomId: number; roomKey: string; workerId: number; nodeKeys: string[] }[];
  } | null = null;
  if (blueprint) {
    // Worker seeding happens BEFORE the tx (idempotent, race-safe) — same
    // discipline as ensureDirectorWorker / ensureOfficeWorkers (§4.5 step 3).
    await ensureOfficeWorkers(input.projectId);
    const spec = blueprint.spec;
    const roomRows = await db
      .select()
      .from(officeRooms)
      .where(eq(officeRooms.blueprintId, blueprint.id));
    const roomByKey = new Map(roomRows.map((r) => [r.roomKey, r]));
    const opsFallback =
      roomRows.find((r) => r.roomKey === "operations") ??
      roomRows.find((r) => r.kind === "ops") ??
      null;
    const roomKeyByNodeKey = new Map<string, string>();
    const seatByWorker = new Map<number, { roomId: number; roomKey: string; workerId: number; nodeKeys: string[] }>();
    for (const { node } of resolved) {
      const mappedKey = spec.roleRooms[node.role];
      const room = (mappedKey ? roomByKey.get(mappedKey) : undefined) ?? opsFallback;
      if (!room) {
        throw new RunStartError(
          `office blueprint ${blueprint.id} has no room for role "${node.role}" and no ops fallback room — failing closed, nothing was created`,
        );
      }
      roomKeyByNodeKey.set(node.key, room.roomKey);
      const worker = await ensureRoleWorker(input.projectId, node.role, node.skill);
      const seat = seatByWorker.get(worker.id);
      if (seat) {
        // Same role across several nodes = ONE seat (capacity counts agents).
        seat.nodeKeys.push(node.key);
      } else {
        seatByWorker.set(worker.id, {
          roomId: room.id,
          roomKey: room.roomKey,
          workerId: worker.id,
          nodeKeys: [node.key],
        });
      }
    }
    populate = {
      roomById: new Map(roomRows.map((r) => [r.id, { roomKey: r.roomKey, capacity: r.capacity }])),
      roomKeyByNodeKey,
      seats: [...seatByWorker.values()],
    };
  }

  return db.transaction(async (tx) => {
    const [inserted] = await tx.insert(runs).values({
      projectId: input.projectId,
      dagRevisionId: input.dagRevisionId,
      mode: input.mode,
      provider: input.providerId,
      model: input.model,
      state: "queued",
      budget: input.budget,
      startedBy: input.startedBy,
      maxParallelNodes: Math.min(Math.max(input.maxParallelNodes ?? 1, 1), 8),
      autonomyGrantId: input.autonomyGrantId ?? null,
      goalMode: input.goalMode ?? "build",
      enterpriseId: input.enterpriseContext?.enterpriseId ?? null,
      enterpriseCompanyId: input.enterpriseContext?.companyId ?? null,
      enterpriseContractId: input.enterpriseContext?.contractId ?? null,
    });
    const runId = Number(inserted.insertId);

    // Capacity re-check INSIDE the tx under room row locks, in ascending
    // room-id order (design §4.4/§4.5): an over-capacity plan fails the run
    // start honestly instead of silently overflowing a room. A worker
    // already seated in the SAME room is re-linked, not double-counted.
    const seatActions: {
      seat: NonNullable<typeof populate>["seats"][number];
      existingId: number | null;
      existingVersion: number | null;
      isNew: boolean;
    }[] = [];
    if (populate) {
      // Lock order is worker row(s) THEN room row(s) — the same order as
      // office.assign/reassign — so populate can never deadlock with a
      // concurrent seating mutation (both ascend within each class).
      const workerIds = [...new Set(populate.seats.map((s) => s.workerId))].sort((a, b) => a - b);
      for (const workerId of workerIds) {
        await tx
          .select({ id: workers.id })
          .from(workers)
          .where(eq(workers.id, workerId))
          .for("update");
      }
      const roomIds = [...new Set(populate.seats.map((s) => s.roomId))].sort((a, b) => a - b);
      for (const roomId of roomIds) {
        await tx
          .select({ id: officeRooms.id })
          .from(officeRooms)
          .where(eq(officeRooms.id, roomId))
          .for("update");
      }
      const newSeatsByRoom = new Map<number, number>();
      for (const seat of populate.seats) {
        const existing = await tx.query.officeAssignments.findFirst({
          where: and(
            eq(officeAssignments.workerId, seat.workerId),
            eq(officeAssignments.state, "active"),
          ),
        });
        const isNew = !existing || existing.roomId !== seat.roomId;
        seatActions.push({
          seat,
          existingId: existing?.id ?? null,
          existingVersion: existing?.version ?? null,
          isNew,
        });
        if (isNew) {
          newSeatsByRoom.set(seat.roomId, (newSeatsByRoom.get(seat.roomId) ?? 0) + 1);
        }
      }
      for (const [roomId, wanted] of newSeatsByRoom) {
        const [row] = await tx
          .select({ n: sql<number>`COUNT(*)` })
          .from(officeAssignments)
          .where(and(eq(officeAssignments.roomId, roomId), eq(officeAssignments.state, "active")));
        const room = populate.roomById.get(roomId)!;
        if (Number(row?.n ?? 0) + wanted > room.capacity) {
          throw new RunStartError(
            `office room "${room.roomKey}" is at capacity (${row?.n}/${room.capacity}); the plan needs ${wanted} more seat(s) — failing closed, nothing was created`,
          );
        }
      }
    }

    // Hire specialists at plan/run time only — no runtime self-expansion.
    for (const { node, skill } of resolved) {
      const [agentRow] = await tx.insert(agents).values({
        projectId: input.projectId,
        skillId: skill.id,
        role: node.role,
        modelPreference: [],
        costClass: skill.manifest.costClass,
        createdByRunId: runId,
      });
      await tx.insert(runNodes).values({
        runId,
        nodeKey: node.key,
        agentId: Number(agentRow.insertId),
        contract: node,
        state: "pending",
        roomKey: populate?.roomKeyByNodeKey.get(node.key) ?? null,
      });
    }

    // Seat assignments (same tx): relink same-room seats, release+insert for
    // cross-room moves, insert fresh seats; workers.room_key follows in tx.
    for (const action of seatActions) {
      const { seat } = action;
      if (!action.isNew && action.existingId !== null) {
        await tx
          .update(officeAssignments)
          .set({
            runId,
            nodeKey: seat.nodeKeys[0] ?? null,
            version: sql`${officeAssignments.version} + 1`,
          })
          .where(
            and(
              eq(officeAssignments.id, action.existingId),
              eq(officeAssignments.version, action.existingVersion!),
            ),
          );
        continue;
      }
      if (action.existingId !== null) {
        await tx
          .update(officeAssignments)
          .set({
            state: "released",
            releasedAt: new Date(),
            version: sql`${officeAssignments.version} + 1`,
          })
          .where(
            and(
              eq(officeAssignments.id, action.existingId),
              eq(officeAssignments.version, action.existingVersion!),
            ),
          );
      }
      await tx.insert(officeAssignments).values({
        projectId: input.projectId,
        roomId: seat.roomId,
        workerId: seat.workerId,
        runId,
        nodeKey: seat.nodeKeys[0] ?? null,
      });
      await tx
        .update(workers)
        .set({ roomKey: seat.roomKey, version: sql`${workers.version} + 1` })
        .where(eq(workers.id, seat.workerId));
    }

    if (populate) {
      await appendOfficeEventTx(tx, input.projectId, {
        type: "office_run_populated",
        actor: "system",
        payload: {
          runId,
          blueprintId: blueprint!.id,
          seats: Object.fromEntries(
            seatActions.map((a) => [
              a.seat.nodeKeys[0] ?? `worker-${a.seat.workerId}`,
              a.seat.roomKey,
            ]),
          ),
        },
      });
    }
    return runId;
  });
}

// ── Dispatch loop ────────────────────────────────────────────────
// Prompts are compiled by api/engine/prompt.ts via the deterministic
// prompt-contract compiler (api/prompting/compiler.ts). All previous hard
// gates (document-producer-only, untrusted upstream data, required sections,
// hash-pinned skill body) are preserved by the compiler's system contract.

/**
 * Dispatch a CLAIMED node. Every mutating statement after the claim is
 * fenced by the lease token (+ expected state): a stop/pause/lease-expiry
 * mid-call makes the guarded writes match 0 rows, so late completions can
 * never land on a stopped run or a recycled node (doc §9.4.2).
 */
async function dispatchNode(run: Run, runNode: RunNode, spec: DagSpec, leaseToken: string) {
  const db = getDb();
  const node = runNode.contract as NodeSpec;
  const attempt = runNode.attempts; // bumped by the claim CAS
  const lease = { leaseToken };

  /** Append an honest fencing record when a guarded write loses its lease. */
  const fenced = async (where: string) => {
    await appendEvent(run.id, {
      type: "lease_fenced",
      actor: "system",
      nodeKey: node.key,
      payload: {
        attempt,
        where,
        message: `dispatch lost its lease at ${where}; late writes were fenced, nothing was silently applied`,
      },
    });
  };

  // claimed → running, guarded: abort BEFORE any billable provider call.
  const started = await setNodeState(
    run.id,
    node.key,
    "running",
    { attempt, workerId: runNode.leaseWorkerId },
    { ...lease, fromStates: ["claimed"] },
  );
  if (!started) {
    await fenced("dispatch-start");
    return;
  }

  const skill = await db.query.skills.findFirst({
    where: and(
      eq(skills.name, node.skill.name),
      eq(skills.version, node.skill.version),
    ),
  });
  if (!skill || skill.status !== "vetted" || skill.contentSha256 !== node.skill.sha256) {
    if (
      await setNodeState(
        run.id,
        node.key,
        "failed",
        { reason: "skill pin no longer resolves to the pinned vetted content" },
        { ...lease, fromStates: ["running"] },
      )
    ) {
      await failRun(run, `node ${node.key}: skill pin drift`);
    } else {
      await fenced("skill-pin-check");
    }
    return;
  }

  // Reference-only handoffs (spec §9.2): titles + summaries + hashes.
  const upstreamKeys = spec.edges.filter((e) => e.to === node.key).map((e) => e.from);
  const upstreamArtifacts = upstreamKeys.length
    ? await db
        .select()
        .from(artifacts)
        .where(and(eq(artifacts.runId, run.id)))
    : [];
  const upstreamRefs = upstreamArtifacts
    .filter((a) => upstreamKeys.includes(a.nodeKey) && a.accepted)
    .map((a) => ({
      nodeKey: a.nodeKey,
      title: a.title,
      summary: a.summary ?? "",
      sha256: a.contentSha256 ?? "",
    }));

  // Dollar enforcement must be real for live runs: pricing resolved per
  // dispatch (owner settings can change between dispatches).
  let pricing = null;
  if (run.mode === "live") {
    pricing = await resolvePricing(run.startedBy, run.provider as ProviderId, run.model!);
    if (!pricing) {
      await appendEvent(run.id, {
        type: "budget_blocked",
        actor: "system",
        nodeKey: node.key,
        payload: {
          reason: "pricing_not_configured",
          message: `USD pricing for ${run.provider}/${run.model} is not configured; blocking cost-capped live dispatch rather than guessing. Configure rates under Director → Settings or via server env.`,
        },
      });
      if (
        await setNodeState(run.id, node.key, "failed", { reason: "pricing_not_configured" }, { ...lease, fromStates: ["running"] })
      ) {
        await failRun(run, "pricing_not_configured");
      } else {
        await fenced("pricing-check");
      }
      return;
    }
  }

  // Elapsed-time deadlines: abort the provider call at the earlier of the
  // node deadline and the run deadline. No automatic billed retry after abort.
  const runDeadlineMs =
    run.startedAt.getTime() + run.budget.maxMinutes * 60_000 - Date.now();
  const nodeDeadlineMs = runNode.startedAt
    ? runNode.startedAt.getTime() + node.budget.maxMinutes * 60_000 - Date.now()
    : node.budget.maxMinutes * 60_000;
  const remainingMs = Math.min(runDeadlineMs, nodeDeadlineMs);
  if (remainingMs <= 0) {
    const dimension = runDeadlineMs <= 0 ? "run:minutes" : "node:minutes";
    if (
      await setNodeState(run.id, node.key, "failed", { reason: "deadline elapsed before dispatch" }, { ...lease, fromStates: ["running"] })
    ) {
      await appendEvent(run.id, {
        type: "budget_exceeded",
        actor: "system",
        nodeKey: node.key,
        payload: { dimension: "minutes", scope: dimension.split(":")[0], message: "elapsed-time deadline reached before dispatch" },
      });
      await setRunState(run.id, "stopped_budget", { endReason: dimension });
    } else {
      await fenced("deadline-precheck");
    }
    return;
  }

  const provider = await getProvider(run.mode === "mock" ? "mock" : (run.provider as ProviderId));

  // Prompt-contract compilation (deterministic): role/goal-relevant curated
  // resources, dispatch-gated strategy routing, trust fences, byte caps. The
  // concise execution plan and all truncation/redaction/degradation metadata
  // are persisted as an event and on the artifact — never raw chain-of-thought.
  const { compiled, decision, resourceNotes, goalMode } = await compileNodePrompt(
    run,
    node,
    skill,
    upstreamRefs,
  );
  const promptMeta: ArtifactPromptMeta = {
    compilerVersion: compiled.version,
    strategy: compiled.meta.strategy,
    strategyVersion: compiled.plan.strategyVersion,
    plan: compiled.plan,
    routing: {
      requested: node.promptStrategy?.id ?? null,
      rejected: decision.rejected,
    },
    bytes: compiled.meta.bytes,
    estimatedTokens: compiled.meta.estimatedTokens,
    seed: compiled.meta.seed,
    resourcesIncluded: compiled.meta.resourcesIncluded,
    resourcesDropped: compiled.meta.resourcesDropped,
    truncations: compiled.meta.truncations,
    redactions: compiled.meta.redactions,
    degraded: compiled.meta.degraded,
    degradationNotes: compiled.meta.degradationNotes,
  };
  await appendEvent(run.id, {
    type: "prompt_compiled",
    actor: "director",
    nodeKey: node.key,
    payload: {
      attempt,
      compilerVersion: compiled.version,
      strategy: compiled.meta.strategy,
      strategyVersion: compiled.plan.strategyVersion,
      routing: {
        requested: node.promptStrategy?.id ?? null,
        chosen: decision.strategy,
        reason: decision.reason,
        rejected: decision.rejected,
        notes: decision.notes,
      },
      plan: compiled.plan,
      bytes: compiled.meta.bytes,
      estimatedTokens: compiled.meta.estimatedTokens,
      seed: compiled.meta.seed,
      resourcesIncluded: compiled.meta.resourcesIncluded,
      resourcesDropped: compiled.meta.resourcesDropped,
      truncations: compiled.meta.truncations,
      redactions: compiled.meta.redactions,
      degraded: compiled.meta.degraded,
      degradationNotes: compiled.meta.degradationNotes,
      resourceNotes,
      goalMode: { mode: goalMode.mode, applied: goalMode.applied },
    },
  });
  const system = compiled.system;
  const prompt = compiled.user;
  const signal = AbortSignal.timeout(Math.max(1_000, Math.floor(remainingMs)));

  let object: ArtifactObjectT;
  let usage;
  let usedModel: string;
  try {
    const res = await provider.generateStructured({
      system,
      prompt,
      schema: ArtifactObjectSchema,
      maxOutputTokens: Math.min(8_000, goalMode.maxOutputTokens),
      model: run.mode === "live" ? run.model! : undefined,
      artifactType: node.outputArtifactType,
      signal,
      ownerId: run.startedBy,
    });
    object = res.object as ArtifactObjectT;
    usage = res.usage;
    usedModel = res.model;
  } catch (err) {
    if (signal.aborted) {
      if (
        await setNodeState(run.id, node.key, "failed", { reason: "deadline_abort" }, { ...lease, fromStates: ["running"] })
      ) {
        await appendEvent(run.id, {
          type: "budget_exceeded",
          actor: "system",
          nodeKey: node.key,
          payload: {
            dimension: "minutes",
            scope: "node",
            message: "elapsed-time deadline aborted the in-flight call; no automatic billed retry",
          },
        });
        await setRunState(run.id, "stopped_budget", { endReason: "node:minutes" });
      } else {
        await fenced("deadline-abort");
      }
      return;
    }
    const typed = err as Error;
    if (
      await setNodeState(run.id, node.key, "failed", { reason: typed.name }, { ...lease, fromStates: ["running"] })
    ) {
      await appendEvent(run.id, {
        type: "error",
        actor: "node",
        nodeKey: node.key,
        payload: {
          errorKind: typed.name, // typed AI error class name or MockScriptedFailure
          message: String(typed.message ?? "").slice(0, 500), // provider messages only, never secrets
        },
      });
      await skipDownstream(run.id, spec, node.key);
      await failRun(run, `node ${node.key} failed: ${typed.name}`);
    } else {
      await fenced("provider-error");
    }
    return;
  }

  // Price the call: mock carries its own labeled simulated cents; live is
  // priced strictly from configured rates.
  const costUsdMicros =
    run.mode === "mock"
      ? usage.costUsdMicros
      : priceUsage(usage, pricing!);
  const simulated = run.mode === "mock";

  // Ledger first (append-only, attempt-tagged): usage is consumed and must
  // be recorded honestly even if the lease is fenced before the artifact lands.
  await db.insert(budgetLedger).values({
    runId: run.id,
    nodeKey: node.key,
    tokensPrompt: usage.promptTokens,
    tokensCompletion: usage.completionTokens,
    calls: usage.calls,
    costUsdMicros,
    milestoneKey: runNode.milestoneKey ?? null,
    roomKey: runNode.roomKey ?? null, // office room rollup tag (design §4.2)
    // Enterprise rollup tags copied from the run (CEO mode partitions).
    enterpriseId: run.enterpriseId ?? null,
    enterpriseCompanyId: run.enterpriseCompanyId ?? null,
    enterpriseContractId: run.enterpriseContractId ?? null,
    attempt,
  });
  // Atomic lease-fenced increment — never a read-modify-write (fixes §3.4).
  const leaseHeld = await addNodeUsage(runNode.id, leaseToken, {
    tokens: usage.promptTokens + usage.completionTokens,
    calls: usage.calls,
  });
  await appendEvent(run.id, {
    type: "budget_recorded",
    actor: "system",
    nodeKey: node.key,
    payload: {
      attempt,
      promptTokens: usage.promptTokens,
      completionTokens: usage.completionTokens,
      calls: usage.calls,
      costUsdMicros,
      simulated, // mock cents are simulated, never real billing
      provider: run.provider,
      model: usedModel,
    },
  });

  // Post-step budget reconciliation (spec §8.2): artifacts are preserved even
  // when a budget trips on the step that produced them. Skipped when fenced —
  // the node no longer belongs to this dispatch.
  let over: string | null = null;
  if (leaseHeld) {
    const freshNode = (await db.query.runNodes.findFirst({
      where: and(eq(runNodes.runId, run.id), eq(runNodes.nodeKey, node.key)),
    }))!;
    const freshRun = (await db.query.runs.findFirst({ where: eq(runs.id, run.id) }))!;
    over =
      nodeBudgetOverrun(freshNode, node) ??
      runBudgetOverrun(freshRun, await runUsage(freshRun));
  }

  // Persist the artifact via platform storage; never fake success when
  // storage is unavailable — record the stable error code instead.
  const contentSha256 = createHash("sha256").update(object.markdown).digest("hex");
  const acceptance = checkArtifactAcceptance(node.outputArtifactType, object.markdown);
  let storageKey: string | null = null;
  let storageError: string | null = null;
  try {
    const saved = await storage.uploadFile({
      fileContent: Buffer.from(object.markdown, "utf8"),
      fileName: `artifacts/${run.projectId}/${run.id}/${node.key}-${attempt}.md`,
      contentType: "text/markdown",
    });
    storageKey = saved.key;
  } catch (err) {
    storageError =
      (err as { code?: string })?.code && String((err as { code?: string }).code).startsWith("STORAGE_")
        ? String((err as { code?: string }).code)
        : "STORAGE_UPSTREAM_ERROR";
  }

  // Idempotent per (run, node, attempt): a retried write of the same attempt
  // cannot double-insert — the unique key makes it a replay, not a duplicate.
  let artifactId: number;
  try {
    const [artifactRow] = await db.insert(artifacts).values({
      runId: run.id,
      nodeKey: node.key,
      kind: node.outputArtifactType,
      title: object.title.slice(0, 500),
      schemaUri: `atlas://artifacts/${node.outputArtifactType}`,
      storageKey,
      storageError,
      contentSha256,
      summary: object.summary,
      acceptance,
      promptMeta,
      accepted: false,
      attempt,
    });
    artifactId = Number(artifactRow.insertId);
  } catch (err) {
    if (!isDuplicateKeyError(err)) throw err;
    const existing = await db.query.artifacts.findFirst({
      where: and(
        eq(artifacts.runId, run.id),
        eq(artifacts.nodeKey, node.key),
        eq(artifacts.attempt, attempt),
      ),
    });
    if (!existing) throw err;
    artifactId = existing.id; // replay: same identity, no new row
  }

  if (!leaseHeld) {
    // Fenced mid-call (stop/pause/expiry): the artifact is preserved as
    // ORPHANED evidence — never accepted, never counted as node output.
    await appendEvent(run.id, {
      type: "lease_fenced",
      actor: "system",
      nodeKey: node.key,
      payload: {
        attempt,
        artifactId,
        orphaned: true,
        where: "post-call",
        message:
          "dispatch lost its lease after the provider call; usage was recorded, the artifact is preserved as orphaned (unaccepted) evidence",
      },
    });
    return;
  }

  if (storageError) {
    if (
      await setNodeState(run.id, node.key, "failed", { reason: storageError }, { ...lease, fromStates: ["running"] })
    ) {
      await appendEvent(run.id, {
        type: "artifact_storage_error",
        actor: "system",
        nodeKey: node.key,
        payload: {
          artifactId,
          code: storageError,
          message: `artifact content could not be stored (${storageError}); the failure is recorded, not hidden`,
        },
      });
      await skipDownstream(run.id, spec, node.key);
      await failRun(run, `storage error ${storageError}`);
    } else {
      await fenced("storage-error");
    }
    return;
  }

  await appendEvent(run.id, {
    type: "artifact_created",
    actor: "node",
    nodeKey: node.key,
    payload: {
      artifactId,
      kind: node.outputArtifactType,
      title: object.title.slice(0, 500),
      contentSha256,
      storageKey,
      acceptanceOk: acceptance.ok,
    },
  });

  if (!acceptance.ok) {
    // Independent acceptance (spec §8.5): deterministic checks are primary.
    if (
      await setNodeState(
        run.id,
        node.key,
        "failed",
        { reason: "acceptance checks failed", failures: acceptance.failures },
        { ...lease, fromStates: ["running"] },
      )
    ) {
      await skipDownstream(run.id, spec, node.key);
      await failRun(run, `node ${node.key} artifact failed acceptance checks`);
    } else {
      await fenced("acceptance-checks");
    }
    return;
  }

  if (over) {
    if (
      await setNodeState(
        run.id,
        node.key,
        "accepted",
        { artifactId, preserved: "partial-evidence" },
        { ...lease, fromStates: ["running"] },
      )
    ) {
      await db
        .update(artifacts)
        .set({ accepted: true })
        .where(eq(artifacts.id, artifactId));
      const freshRun = (await db.query.runs.findFirst({ where: eq(runs.id, run.id) }))!;
      await stopForBudget(freshRun, over, over.startsWith("node") ? "node" : "run");
    } else {
      await fenced("budget-reconciliation");
    }
    return;
  }

  if (node.approvalBefore === "accept") {
    // Autonomy gate (design §2.4, call site 2 of 2): an active grant can
    // preauthorize this node's accept gate. "bypass" falls through to the
    // normal accept path; "require"/"forbidden" keep the human gate. Every
    // bypass leaves a per-node `approval_bypassed` audit record.
    const gate = await resolveNodeGate(run, node, "artifact-accept");
    if (gate.decision === "bypass" && gate.grant) {
      const draft = approvalBypassedEvent({
        grantId: gate.grant.id,
        mode: gate.grant.mode,
        nodeKey: node.key,
        kind: "artifact-accept",
      });
      await appendEvent(run.id, {
        type: draft.type,
        actor: draft.actor,
        nodeKey: node.key,
        payload: draft.payload,
      });
      // fall through to the accept path below
    } else {
      const gated = await setNodeState(run.id, node.key, "verifying", { artifactId }, { ...lease, fromStates: ["running"] });
      if (!gated) {
        await fenced("accept-gate");
        return;
      }
      await requestApprovalOnce(run, {
        nodeKey: node.key,
        kind: "artifact-accept",
        payload: {
          artifactId,
          title: object.title.slice(0, 500),
          summary: object.summary,
          contentSha256,
          acceptance,
        },
      });
      await setRunState(run.id, "awaiting_approval", { fromStates: ["running"] });
      return;
    }
  }

  const acceptedOk = await setNodeState(run.id, node.key, "accepted", { artifactId }, { ...lease, fromStates: ["running"] });
  if (!acceptedOk) {
    await fenced("accept");
    return;
  }
  await db
    .update(artifacts)
    .set({ accepted: true })
    .where(eq(artifacts.id, artifactId));
}

async function skipDownstream(runId: number, spec: DagSpec, failedKey: string) {
  const downstream = new Set<string>();
  let frontier = [failedKey];
  while (frontier.length) {
    const next: string[] = [];
    for (const e of spec.edges) {
      if (frontier.includes(e.from) && !downstream.has(e.to)) {
        downstream.add(e.to);
        next.push(e.to);
      }
    }
    frontier = next;
  }
  for (const key of downstream) {
    await setNodeState(
      runId,
      key,
      "skipped",
      { reason: `upstream ${failedKey} failed` },
      { fromStates: ["pending", "ready", "waiting", "claimed"] },
    );
  }
}

async function failRun(run: Run, reason: string) {
  await setRunState(run.id, "failed", { endReason: reason.slice(0, 500) });
}

async function requestApprovalOnce(
  run: Run,
  a: { nodeKey: string; kind: "plan" | "artifact-accept"; payload: Record<string, unknown> },
) {
  const db = getDb();
  const existing = await db.query.approvals.findFirst({
    where: and(
      eq(approvals.runId, run.id),
      eq(approvals.nodeKey, a.nodeKey),
      eq(approvals.kind, a.kind),
      eq(approvals.state, "pending"),
    ),
  });
  if (existing) return existing;
  const [row] = await db.insert(approvals).values({
    runId: run.id,
    nodeKey: a.nodeKey,
    kind: a.kind,
    payload: a.payload,
    state: "pending",
  });
  await appendEvent(run.id, {
    type: "approval_requested",
    actor: "director",
    nodeKey: a.nodeKey,
    payload: { approvalId: Number(row.insertId), kind: a.kind },
  });
  return { id: Number(row.insertId) };
}

async function hasApproval(runId: number, nodeKey: string, kind: string) {
  const row = await getDb().query.approvals.findFirst({
    where: and(
      eq(approvals.runId, runId),
      eq(approvals.nodeKey, nodeKey),
      eq(approvals.kind, kind as "plan"),
      eq(approvals.state, "approved"),
    ),
  });
  return !!row;
}

/**
 * Main loop (doc §9.4): promote → gate → claim → dispatch. The director
 * claims nodes through the same atomic CAS as any worker, so multiple
 * replicas can run this loop safely; `inFlight` is only process-local
 * dedupe. Serial by default (maxParallelNodes=1 keeps the budget pre-check
 * math exact); >1 dispatches independent claimed nodes concurrently.
 */
export async function advanceRun(runId: number): Promise<void> {
  if (inFlight.has(runId)) return;
  inFlight.add(runId);
  try {
    const db = getDb();
    for (;;) {
      const run = await db.query.runs.findFirst({ where: eq(runs.id, runId) });
      if (!run || TERMINAL_RUN_STATES.has(run.state)) return;
      if (run.state === "awaiting_approval" || run.state === "stopped_human") return;
      if (run.state === "failed_validation" || run.state === "paused") return;
      if (run.state === "queued" || run.state === "draft") {
        // Guarded: a concurrent loop/human transition wins; we re-read.
        if (!(await setRunState(runId, "running", { fromStates: ["queued", "draft"] }))) {
          continue;
        }
        run.state = "running";
      }

      // Run-scope budget pre-check (tokens/calls/minutes/dollars).
      const over = runBudgetOverrun(run, await runUsage(run));
      if (over) {
        await stopForBudget(run, over, "run");
        return;
      }

      // Grant-ceiling pre-check (design §2.4): usage across ALL runs sharing
      // this run's autonomy grant; crossing a hard ceiling stops the run
      // stopped_human — deliberate human action, no auto-top-up.
      if (await checkGrantBudget(run)) return;

      // Enterprise envelope / company partition overrun (CEO mode): actual
      // ledger usage across the enterprise; crossing stops stopped_budget
      // honestly and flags the program stopped_budget.
      if (run.enterpriseId) {
        const { checkEnterpriseOverrun } = await import("../enterprise");
        if (await checkEnterpriseOverrun(run)) return;
      }

      const revision = await db.query.dagRevisions.findFirst({
        where: eq(dagRevisions.id, run.dagRevisionId),
      });
      const spec = revision!.spec;
      const nodeRows = await db
        .select()
        .from(runNodes)
        .where(eq(runNodes.runId, runId));
      const stateByKey = new Map(nodeRows.map((n) => [n.nodeKey, n]));

      // Terminal completion: every node accepted (or deliberately cancelled).
      if (nodeRows.every((n) => n.state === "accepted")) {
        await setRunState(runId, "completed");
        return;
      }
      if (nodeRows.every((n) => TERMINAL_NODE_STATES.has(n.state))) {
        if (nodeRows.some((n) => n.state === "failed")) {
          await failRun(run, "node failure left the DAG unfinishable");
        } else {
          await setRunState(runId, "completed", {
            endReason: "completed with cancelled/skipped nodes",
          });
        }
        return;
      }

      // Dependencies must be accepted before ready (guarded promotion).
      const isReady = (key: string) =>
        spec.edges
          .filter((e) => e.to === key)
          .every((e) => stateByKey.get(e.from)?.state === "accepted");
      for (const n of nodeRows) {
        if (n.state === "pending" && isReady(n.nodeKey)) {
          await setNodeState(runId, n.nodeKey, "ready", {}, { fromStates: ["pending"] });
          n.state = "ready";
        }
      }

      // Per-node start gates: ready gated nodes wait on an approval.
      // Autonomy gate (design §2.4, call site 1 of 2): the start gate uses
      // approval kind "plan", which is never-bypassable by contract — so
      // this resolution is "require" today and stays honest if the contract
      // ever grows a bypassable start-gate kind.
      let gated = false;
      for (const n of nodeRows) {
        if (n.state !== "ready") continue;
        const nodeSpec = n.contract as NodeSpec;
        if (nodeSpec.approvalBefore !== "start") continue;
        if (await hasApproval(runId, nodeSpec.key, "plan")) continue;
        const gate = await resolveNodeGate(run, nodeSpec, "plan");
        if (gate.decision === "bypass" && gate.grant) {
          const draft = approvalBypassedEvent({
            grantId: gate.grant.id,
            mode: gate.grant.mode,
            nodeKey: nodeSpec.key,
            kind: "plan",
          });
          await appendEvent(runId, {
            type: draft.type,
            actor: draft.actor,
            nodeKey: nodeSpec.key,
            payload: draft.payload,
          });
          continue; // bypassed: node stays ready and is claimed below
        }
        await requestApprovalOnce(run, {
          nodeKey: nodeSpec.key,
          kind: "plan",
          payload: {
            goal: nodeSpec.goal,
            role: nodeSpec.role,
            budget: nodeSpec.budget,
            note: "owner approval required before dispatching this node",
          },
        });
        await setNodeState(
          runId,
          n.nodeKey,
          "waiting",
          { waitReason: "approval" },
          { fromStates: ["ready"] },
        );
        gated = true;
      }
      if (gated) {
        await setRunState(runId, "awaiting_approval", { fromStates: ["running"] });
        return;
      }

      // Claim + dispatch through the atomic CAS (director = worker 0).
      const director = await ensureDirectorWorker(run.projectId);
      const slots = Math.min(Math.max(run.maxParallelNodes, 1), 8);
      let budgetBlock: string | null = null;
      const claimed: { node: RunNode; leaseToken: string }[] = [];
      for (let i = 0; i < slots; i++) {
        const c = await claimNextNode(run, director, {
          exclude: (row) => {
            const ns = row.contract as NodeSpec;
            const nodeOver = nodeBudgetOverrun(row, ns);
            if (nodeOver) {
              budgetBlock = nodeOver;
              return `node budget exhausted: ${nodeOver}`;
            }
            return null;
          },
        });
        if (!c) break;
        claimed.push({ node: c.node, leaseToken: c.leaseToken });
      }

      if (!claimed.length) {
        if (budgetBlock) {
          await stopForBudget(run, budgetBlock, "node");
          return;
        }
        const waiting = nodeRows.some(
          (n) => n.state === "verifying" || n.state === "waiting",
        );
        if (waiting) {
          await setRunState(runId, "awaiting_approval", { fromStates: ["running"] });
          return;
        }
        const anyFailed = nodeRows.some((n) => n.state === "failed");
        if (anyFailed) {
          await failRun(run, "node failure left the DAG unfinishable");
          return;
        }
        return; // claimed by another loop / nothing dispatchable right now
      }

      // Serial default: exactly one claim. Parallel (explicit opt-in):
      // bounded concurrent dispatch of independent claimed nodes.
      await Promise.all(
        claimed.map((c) => dispatchNode(run, c.node, spec, c.leaseToken)),
      );
      // Loop re-reads state; pauses/terminal states exit on the next iteration.
    }
  } finally {
    inFlight.delete(runId);
  }
}

/**
 * Fence every active lease of a run: claimed/running nodes go back to
 * ready with cleared tokens, so in-flight dispatches lose their next
 * guarded write. Used by human stop/pause (and available to the pool API).
 */
export async function revokeRunLeases(runId: number, reason: string) {
  const db = getDb();
  const active = await db
    .select()
    .from(runNodes)
    .where(and(eq(runNodes.runId, runId), inArray(runNodes.state, ["claimed", "running"])));
  for (const n of active) {
    const revoked = await setNodeState(
      runId,
      n.nodeKey,
      "ready",
      { reason, attempt: n.attempts, previousWorkerId: n.leaseWorkerId },
      { leaseToken: n.leaseToken ?? undefined, fromStates: ["claimed", "running"] },
    );
    if (!revoked) continue; // completed or swept meanwhile
  }
}

/** Human stop (spec §8.1: stopped_human). Fences in-flight dispatches. */
export async function stopRun(runId: number, by: string) {
  const stopped = await setRunState(runId, "stopped_human", {
    endReason: `stopped by ${by}`,
    actor: "human",
  });
  if (!stopped) return;
  await revokeRunLeases(runId, `run stopped by ${by}`);
}

/** Human pause: resumable, fences in-flight dispatches back to ready. */
export async function pauseRun(runId: number, by: string) {
  const paused = await setRunState(runId, "paused", {
    endReason: `paused by ${by}`,
    actor: "human",
    fromStates: ["queued", "running"],
  });
  if (!paused) {
    throw new Error("run cannot be paused from its current state");
  }
  await revokeRunLeases(runId, `run paused by ${by}`);
}

/** Human resume from paused. */
export async function resumeRun(runId: number, by: string) {
  const resumed = await setRunState(runId, "running", {
    actor: "human",
    fromStates: ["paused"],
  });
  if (!resumed) {
    throw new Error("run is not paused");
  }
  await appendEvent(runId, {
    type: "run_state",
    actor: "human",
    payload: { state: "running", note: `resumed by ${by}` },
  });
  ensureAdvancing(runId);
}

/**
 * Manual pump: claim one eligible node for a worker and dispatch it
 * synchronously through the same fenced path the director uses.
 * Returns null when nothing is claimable right now.
 */
export async function pumpOneNode(
  runId: number,
  workerId?: number,
): Promise<{ nodeKey: string; attempt: number } | null> {
  const db = getDb();
  const run = await db.query.runs.findFirst({ where: eq(runs.id, runId) });
  if (!run || TERMINAL_RUN_STATES.has(run.state)) {
    throw new Error("run is terminal — nothing to pump");
  }
  if (run.state === "paused" || run.state === "awaiting_approval") {
    throw new Error(`run is ${run.state} — resume it before pumping`);
  }
  if (run.state === "queued" || run.state === "draft") {
    await setRunState(runId, "running", { fromStates: ["queued", "draft"] });
    run.state = "running";
  }
  const worker = workerId
    ? await db.query.workers.findFirst({
        where: and(eq(workers.id, workerId), eq(workers.projectId, run.projectId)),
      })
    : await ensureDirectorWorker(run.projectId);
  if (!worker) throw new Error("worker not found in this project");
  const revision = await db.query.dagRevisions.findFirst({
    where: eq(dagRevisions.id, run.dagRevisionId),
  });
  const spec = revision!.spec;
  // Same promotion rule as advanceRun: dependencies accepted → ready.
  const nodeRows = await db.select().from(runNodes).where(eq(runNodes.runId, runId));
  const stateByKey = new Map(nodeRows.map((n) => [n.nodeKey, n]));
  for (const n of nodeRows) {
    if (n.state !== "pending") continue;
    const ready = spec.edges
      .filter((e) => e.to === n.nodeKey)
      .every((e) => stateByKey.get(e.from)?.state === "accepted");
    if (ready) {
      await setNodeState(runId, n.nodeKey, "ready", {}, { fromStates: ["pending"] });
    }
  }
  const claim = await claimNextNode(run, worker);
  if (!claim) return null;
  const fresh = (await db.query.runNodes.findFirst({
    where: eq(runNodes.id, claim.nodeId),
  }))!;
  await dispatchNode(run, fresh, spec, claim.leaseToken);
  return { nodeKey: claim.nodeKey, attempt: claim.attempt };
}

/**
 * Interval/startup driver (called from api/boot.ts, unref'd; disabled in
 * tests): one lease sweep + one bounded advance pass over active runs.
 * No busy waiting — this runs on a timer, not in a loop.
 */
export async function sweepAndAdvanceOnce(opts: { runLimit?: number } = {}) {
  const swept = await sweepExpiredLeases({ limit: 50 });
  // Autonomy grant expiry (design §2.3): DB-side NOW(3), one audited
  // `autonomy_expired` office event per newly expired grant, idempotent.
  const expiredGrants = await expireAutonomyGrants({ limit: 50 });
  // Office drain completion: workers whose claims finished transfer rooms.
  const drainCompleted = await sweepDrainingAssignments({ limit: 25 });
  const runIds = await listAdvanceableRuns(opts.runLimit ?? 25);
  for (const runId of runIds) ensureAdvancing(runId);
  // Enterprise (CEO mode): finish contract drains and pump active programs
  // (bounded; recovery reattaches to recorded run ids, never redispatches).
  let enterpriseContractsDrained = 0;
  let enterpriseProgramsPumped = 0;
  try {
    const { sweepDrainingContracts, sweepEnterprisePrograms } = await import("../enterprise");
    enterpriseContractsDrained = await sweepDrainingContracts(25);
    enterpriseProgramsPumped = await sweepEnterprisePrograms(10);
  } catch (err) {
    log.error("enterprise sweep failed", {
      error: err instanceof Error ? err.message : String(err),
    });
  }
  // Assistant (Donna/shared) jobs: bounded, claim-first, deterministic
  // effects only — no provider calls, no paid calls, no proposal execution.
  let assistantJobsRun = 0;
  let assistantJobsFailed = 0;
  try {
    const { sweepAssistantJobs } = await import("../assistant");
    const result = await sweepAssistantJobs({ limit: 25 });
    assistantJobsRun = result.claimed;
    assistantJobsFailed = result.failed;
  } catch (err) {
    log.error("assistant sweep failed", {
      error: err instanceof Error ? err.message : String(err),
    });
  }
  return {
    swept: swept.swept,
    expiredGrants,
    drainCompleted,
    advancing: runIds.length,
    enterpriseContractsDrained,
    enterpriseProgramsPumped,
    assistantJobsRun,
    assistantJobsFailed,
  };
}

/** Project ownership helper used by every router. */
export async function getOwnedProject(userId: number, projectId: number) {
  const project = await getDb().query.projects.findFirst({
    where: and(eq(projects.id, projectId), eq(projects.ownerId, userId)),
  });
  return project ?? null;
}
