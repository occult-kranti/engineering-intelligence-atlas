import { and, eq, inArray, sql } from "drizzle-orm";
import { createHash } from "node:crypto";
import { getDb } from "../queries/connection";
import {
  agents,
  approvals,
  artifacts,
  budgetLedger,
  dagRevisions,
  projects,
  runNodes,
  runs,
  skills,
  type Run,
  type RunNode,
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
  TERMINAL_RUN_STATES,
  type ProviderId,
  type RunMode,
  type UsageRecord,
} from "@contracts/run";
import { getProvider } from "../ai/provider";
import { appendEvent } from "./events";
import { validateDag } from "./dag-validate";
import { makeValidationContext } from "./context";
import { assessUsagePrice, cachePricingConfigured, resolvePricing } from "./pricing";
import { buildPromptContext } from "./prompt-context";
import { storage } from "../lib/storage";
import { log } from "../lib/logger";

/**
 * Run engine (spec §8). Step-through dispatch: `advanceRun` processes one
 * ready node per iteration and persists every transition as an append-only
 * event before moving on. `events.tail`/`runs.get` re-enters the loop for active
 * runs, but inFlight is process-local: durable leases and interrupted-call
 * reconciliation are still required before deploying multiple worker replicas.
 *
 * Enforcement, all server-side and re-checked per dispatch:
 *   - token / call / minute / USD-dollar budgets at node AND run scope
 *     (hard stop → stopped_budget with a partial-evidence event);
 *   - elapsed-time deadlines via AbortSignal on the provider call
 *     (abort → termination events; never a silent swallow);
 *   - no automatic retry of billable calls — any provider failure surfaces
 *     as a typed event and the run stops for deliberate human action;
 *   - plan approval + explicit live-start confirmation before live dispatch;
 *   - per-node start/accept approval gates.
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

async function setRunState(
  runId: number,
  state: Run["state"],
  opts: { endReason?: string; actor?: "director" | "system" | "human" } = {},
) {
  const db = getDb();
  await db
    .update(runs)
    .set({
      state,
      ...(TERMINAL_RUN_STATES.has(state) ? { endedAt: new Date() } : {}),
      ...(opts.endReason !== undefined ? { endReason: opts.endReason } : {}),
    })
    .where(eq(runs.id, runId));
  await appendEvent(runId, {
    type: state === "completed" ? "run_completed" : "run_state",
    actor: opts.actor ?? "director",
    payload: { state, endReason: opts.endReason ?? null },
  });
}

async function setNodeState(
  runId: number,
  nodeKey: string,
  state: RunNode["state"],
  payload: Record<string, unknown> = {},
) {
  const db = getDb();
  await db
    .update(runNodes)
    .set({
      state,
      ...(state === "running" ? { startedAt: new Date() } : {}),
      ...(["accepted", "failed", "skipped"].includes(state)
        ? { endedAt: new Date() }
        : {}),
    })
    .where(and(eq(runNodes.runId, runId), eq(runNodes.nodeKey, nodeKey)));
  await appendEvent(runId, {
    type: "node_state",
    actor: "node",
    nodeKey,
    payload: { state, ...payload },
  });
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

export function nodeBudgetOverrun(node: RunNode, spec: NodeSpec, costUsdMicros = 0): string | null {
  if (node.tokensUsed >= spec.budget.maxTokens) return "tokens";
  if (node.callsUsed >= spec.budget.maxCalls) return "calls";
  if (costUsdMicros >= usdToMicros(spec.budget.maxCostUsd)) return "costUsd";
  if (node.startedAt) {
    const elapsed = (Date.now() - node.startedAt.getTime()) / 60_000;
    if (elapsed >= spec.budget.maxMinutes) return "minutes";
  }
  return null;
}

async function nodeCost(runId: number, nodeKey: string): Promise<number> {
  const [row] = await getDb().select({ cost: sql<number>`COALESCE(SUM(${budgetLedger.costUsdMicros}), 0)` })
    .from(budgetLedger).where(and(eq(budgetLedger.runId, runId), eq(budgetLedger.nodeKey, nodeKey)));
  return Number(row?.cost ?? 0);
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

  const [inserted] = await db.insert(runs).values({
    projectId: input.projectId,
    dagRevisionId: revision.id,
    mode: input.mode,
    provider: provider.id,
    model,
    state: "queued",
    budget: spec.budget,
    startedBy: input.user.id,
  });
  const runId = Number(inserted.insertId);

  // Hire specialists at plan/run time only — no runtime self-expansion.
  for (const node of spec.nodes) {
    const skill = await db.query.skills.findFirst({
      where: and(
        eq(skills.name, node.skill.name),
        eq(skills.version, node.skill.version),
      ),
    });
    const [agentRow] = await db.insert(agents).values({
      projectId: input.projectId,
      skillId: skill!.id,
      role: node.role,
      modelPreference: [],
      costClass: skill!.manifest.costClass,
      createdByRunId: runId,
    });
    await db.insert(runNodes).values({
      runId,
      nodeKey: node.key,
      agentId: Number(agentRow.insertId),
      contract: node,
      state: "pending",
    });
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

// ── Dispatch loop ────────────────────────────────────────────────

async function dispatchNode(run: Run, runNode: RunNode, spec: DagSpec) {
  const db = getDb();
  const node = runNode.contract as NodeSpec;
  const attempt = runNode.attempts + 1;

  await setNodeState(run.id, node.key, "running", { attempt });

  const skill = await db.query.skills.findFirst({
    where: and(
      eq(skills.name, node.skill.name),
      eq(skills.version, node.skill.version),
    ),
  });
  if (!skill || skill.status !== "vetted" || skill.contentSha256 !== node.skill.sha256) {
    await setNodeState(run.id, node.key, "failed", {
      reason: "skill pin no longer resolves to the pinned vetted content",
    });
    await failRun(run, `node ${node.key}: skill pin drift`);
    return;
  }

  // Reference-only handoffs (spec §9.2): titles + summaries + hashes.
  const upstreamKeys = [...new Set(spec.edges.filter((e) => e.to === node.key && e.kind === "artifact").map((e) => e.from))];
  const upstreamArtifacts = upstreamKeys.length
    ? await db
        .select({ id: artifacts.id, nodeKey: artifacts.nodeKey, title: artifacts.title, summary: artifacts.summary, contentSha256: artifacts.contentSha256 })
        .from(artifacts)
        .where(and(eq(artifacts.runId, run.id), inArray(artifacts.nodeKey, upstreamKeys), eq(artifacts.accepted, true)))
    : [];
  const upstreamRefs = upstreamArtifacts
    .map((a) => ({
      id: a.id,
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
      await setNodeState(run.id, node.key, "failed", { reason: "pricing_not_configured" });
      await failRun(run, "pricing_not_configured");
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
    await setNodeState(run.id, node.key, "failed", { reason: "deadline elapsed before dispatch" });
    await appendEvent(run.id, {
      type: "budget_exceeded",
      actor: "system",
      nodeKey: node.key,
      payload: { dimension: "minutes", scope: dimension.split(":")[0], message: "elapsed-time deadline reached before dispatch" },
    });
    await setRunState(run.id, "stopped_budget", { endReason: dimension });
    return;
  }

  const provider = await getProvider(run.mode === "mock" ? "mock" : (run.provider as ProviderId));
  const providerCacheRequested = (provider.id === "openai" || provider.id === "anthropic") && cachePricingConfigured(pricing);
  const signal = AbortSignal.timeout(Math.max(1_000, Math.floor(remainingMs)));

  let object: ArtifactObjectT;
  let usage: UsageRecord;
  let usedModel: string;
  try {
    const { system, prompt, diagnostics } = buildPromptContext(run, node, skill.bodyText, upstreamRefs);
    await appendEvent(run.id, {
      type: "prompt_prepared", actor: "system", nodeKey: node.key,
      payload: { ...diagnostics, providerCacheRequested },
    });
    const res = await provider.generateStructured({
      system,
      prompt,
      schema: ArtifactObjectSchema,
      maxOutputTokens: Math.min(8_000, node.budget.maxTokens),
      model: run.mode === "live" ? run.model! : undefined,
      artifactType: node.outputArtifactType,
      signal,
      ownerId: run.startedBy,
      cachePolicy: { enabled: providerCacheRequested },
    });
    object = res.object as ArtifactObjectT;
    usage = res.usage;
    usedModel = res.model;
  } catch (err) {
    if (signal.aborted) {
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
      await setNodeState(run.id, node.key, "failed", { reason: "deadline_abort" });
      await setRunState(run.id, "stopped_budget", { endReason: "node:minutes" });
      return;
    }
    const typed = err as Error;
    await appendEvent(run.id, {
      type: "error",
      actor: "node",
      nodeKey: node.key,
      payload: {
        errorKind: typed.name, // typed AI error class name or MockScriptedFailure
        message: String(typed.message ?? "").slice(0, 500), // provider messages only, never secrets
      },
    });
    await setNodeState(run.id, node.key, "failed", { reason: typed.name });
    await skipDownstream(run.id, spec, node.key);
    await failRun(run, `node ${node.key} failed: ${typed.name}`);
    return;
  }

  // Price the call: mock carries its own labeled simulated cents; live is
  // priced strictly from configured rates.
  const accounted = run.mode === "mock"
    ? { costUsdMicros: usage.costUsdMicros, status: "simulated" as const }
    : assessUsagePrice(usage, pricing!, providerCacheRequested);
  const costUsdMicros = accounted.costUsdMicros;
  const simulated = run.mode === "mock";

  await db.insert(budgetLedger).values({
    runId: run.id,
    nodeKey: node.key,
    tokensPrompt: usage.promptTokens,
    tokensCompletion: usage.completionTokens,
    calls: usage.calls,
    costUsdMicros,
  });
  await db
    .update(runNodes)
    .set({
      attempts: attempt,
      tokensUsed: runNode.tokensUsed + usage.promptTokens + usage.completionTokens,
      callsUsed: runNode.callsUsed + usage.calls,
    })
    .where(and(eq(runNodes.runId, run.id), eq(runNodes.nodeKey, node.key)));
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
      pricingStatus: accounted.status,
      usageReported: usage.usageReported ?? run.mode === "mock",
      cacheReadPromptTokens: usage.cacheReadPromptTokens ?? null,
      cacheWritePromptTokens: usage.cacheWritePromptTokens ?? null,
      cacheBreakdownComplete: usage.cacheBreakdownComplete ?? false,
      simulated, // mock cents are simulated, never real billing
      provider: run.provider,
      model: usedModel,
    },
  });

  // Post-step budget reconciliation (spec §8.2): artifacts are preserved even
  // when a budget trips on the step that produced them.
  const freshNode = (await db.query.runNodes.findFirst({
    where: and(eq(runNodes.runId, run.id), eq(runNodes.nodeKey, node.key)),
  }))!;
  const freshRun = (await db.query.runs.findFirst({ where: eq(runs.id, run.id) }))!;
  const nodeOver = nodeBudgetOverrun(freshNode, node, await nodeCost(run.id, node.key));
  const over = nodeOver ?? runBudgetOverrun(freshRun, await runUsage(freshRun));

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
    accepted: false,
  });
  const artifactId = Number(artifactRow.insertId);

  if (storageError) {
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
    await setNodeState(run.id, node.key, "failed", { reason: storageError });
    await skipDownstream(run.id, spec, node.key);
    await failRun(run, `storage error ${storageError}`);
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

  if (accounted.status === "unknown") {
    // Preserve a completed result before stopping for missing billing telemetry.
    await appendEvent(run.id, {
      type: "budget_blocked", actor: "system", nodeKey: node.key,
      payload: { reason: "usage_or_cache_pricing_unknown", artifactId, message: "Generated output was preserved for review; usage or cache pricing is incomplete, so further dispatch is blocked." },
    });
    await setNodeState(run.id, node.key, "failed", { reason: "usage_or_cache_pricing_unknown", artifactId });
    await skipDownstream(run.id, spec, node.key);
    await failRun(run, "usage_or_cache_pricing_unknown");
    return;
  }

  if (!acceptance.ok) {
    // Independent acceptance (spec §8.5): deterministic checks are primary.
    await setNodeState(run.id, node.key, "failed", {
      reason: "acceptance checks failed",
      failures: acceptance.failures,
    });
    await skipDownstream(run.id, spec, node.key);
    await failRun(run, `node ${node.key} artifact failed acceptance checks`);
    return;
  }

  if (over) {
    if (node.approvalBefore === "accept") {
      await setNodeState(run.id, node.key, "verifying", { artifactId, preserved: "partial-evidence", approvalRequired: true });
    } else {
      await db.update(artifacts).set({ accepted: true }).where(eq(artifacts.id, artifactId));
      await setNodeState(run.id, node.key, "accepted", { artifactId, preserved: "partial-evidence" });
    }
    await stopForBudget(freshRun, over, nodeOver ? "node" : "run");
    return;
  }

  if (node.approvalBefore === "accept") {
    await setNodeState(run.id, node.key, "verifying", { artifactId });
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
    await setRunState(run.id, "awaiting_approval");
    return;
  }

  await db
    .update(artifacts)
    .set({ accepted: true })
    .where(eq(artifacts.id, artifactId));
  await setNodeState(run.id, node.key, "accepted", { artifactId });
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
    await setNodeState(runId, key, "skipped", { reason: `upstream ${failedKey} failed` });
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

/** Main loop: processes one ready node per iteration. */
export async function advanceRun(runId: number): Promise<void> {
  if (inFlight.has(runId)) return;
  inFlight.add(runId);
  try {
    const db = getDb();
    for (;;) {
      const run = await db.query.runs.findFirst({ where: eq(runs.id, runId) });
      if (!run || TERMINAL_RUN_STATES.has(run.state)) return;
      if (run.state === "awaiting_approval" || run.state === "stopped_human") return;
      if (run.state === "failed_validation") return;
      if (run.state === "queued" || run.state === "draft") {
        await setRunState(runId, "running");
        run.state = "running";
      }

      // Run-scope budget pre-check (tokens/calls/minutes/dollars).
      const over = runBudgetOverrun(run, await runUsage(run));
      if (over) {
        await stopForBudget(run, over, "run");
        return;
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

      // Terminal completion: every node accepted.
      if (nodeRows.every((n) => n.state === "accepted")) {
        await setRunState(runId, "completed");
        return;
      }

      // Next dispatchable node: pending, all upstreams accepted.
      const isReady = (key: string) =>
        spec.edges
          .filter((e) => e.to === key)
          .every((e) => stateByKey.get(e.from)?.state === "accepted");
      const nextRow = nodeRows.find(
        (n) =>
          (n.state === "pending" || n.state === "ready") && isReady(n.nodeKey),
      );

      if (!nextRow) {
        const waiting = nodeRows.some((n) => n.state === "verifying");
        if (waiting) {
          await setRunState(runId, "awaiting_approval");
          return;
        }
        const anyFailed = nodeRows.some((n) => n.state === "failed");
        if (anyFailed) {
          await failRun(run, "node failure left the DAG unfinishable");
          return;
        }
        return; // defensive: no work and no clear terminal condition
      }

      const nodeSpec = nextRow.contract as NodeSpec;

      // Node-scope budget pre-check.
      const nodeOver = nodeBudgetOverrun(nextRow, nodeSpec, await nodeCost(runId, nextRow.nodeKey));
      if (nodeOver) {
        await stopForBudget(run, nodeOver, "node");
        return;
      }

      // Per-node start gate.
      if (nodeSpec.approvalBefore === "start") {
        if (!(await hasApproval(runId, nodeSpec.key, "plan"))) {
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
          await setRunState(runId, "awaiting_approval");
          return;
        }
      }

      if (nextRow.state === "pending") {
        await setNodeState(runId, nextRow.nodeKey, "ready");
      }
      const fresh = (await db.query.runNodes.findFirst({
        where: and(eq(runNodes.runId, runId), eq(runNodes.nodeKey, nextRow.nodeKey)),
      }))!;
      await dispatchNode(run, fresh, spec);
      // Loop re-reads state; pauses/terminal states exit on the next iteration.
    }
  } finally {
    inFlight.delete(runId);
  }
}

/** Human stop (spec §8.1: stopped_human). */
export async function stopRun(runId: number, by: string) {
  await appendEvent(runId, {
    type: "run_state",
    actor: "human",
    payload: { state: "stopped_human", by },
  });
  await setRunState(runId, "stopped_human", {
    endReason: `stopped by ${by}`,
    actor: "human",
  });
}

/** Project ownership helper used by every router. */
export async function getOwnedProject(userId: number, projectId: number) {
  const project = await getDb().query.projects.findFirst({
    where: and(eq(projects.id, projectId), eq(projects.ownerId, userId)),
  });
  return project ?? null;
}
