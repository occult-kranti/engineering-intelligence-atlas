import { createHash } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "../queries/connection";
import {
  ownerSettings,
  registryResources,
  registryRoleProfiles,
  registryRoleResourceLinks,
  type Run,
  type Skill,
} from "@db/schema";
import { GOAL_MODE_SETTINGS_PREFIX, type GoalMode } from "@contracts/office";
import {
  applyGoalMode,
  resolveGoalModePresets,
  type GoalModePromptResult,
} from "../office/goal-modes";
import type { NodeSpec } from "@contracts/dag";
import { ACCEPTANCE_RULES, type ArtifactType } from "@contracts/artifacts";
import {
  PromptBudgetSchema,
  StrategyIdSchema,
  type CompiledPrompt,
  type CuratedResource,
  type StrategyId,
  type UpstreamArtifactRef,
} from "@contracts/prompting";
import type { LinkedResource, ResourceSelection } from "@contracts/registry";
import type { RoutingDecision, RoutingRequest } from "@contracts/evaluation";
import { compilePrompt } from "../prompting/compiler";
import { resolveDispatchStrategy } from "../prompting/evaluation";
import { selectRoleResources } from "../registry/selection";

/**
 * Scheduler ↔ prompt-compiler bridge. Every dispatched node's prompt is
 * compiled through the deterministic prompt-contract compiler with
 * role-relevant curated resources and dispatch-gated strategy routing.
 * Lease/budget/approval/security behaviour lives in the scheduler and is
 * untouched; this module only builds the prompt and its audit metadata.
 */

/** Derive the task shape the strategy router sees from the node contract. */
export function routingRequestForNode(node: NodeSpec): RoutingRequest {
  return {
    // Exact-answer / arithmetic goals qualify as symbolic.
    symbolic: /(calculat|comput|arithmetic|equation|exact answer|math|count\b|sum\b)/i.test(
      node.goal,
    ),
    // Multi-input synthesis is compositional: later parts depend on earlier ones.
    compositional: node.inputArtifactTypes.length >= 2,
    // v1 tool execution is disabled; a non-empty document-action allowlist is
    // the contract's declarative action workflow.
    requiresToolWorkflow: node.toolsAllowed.length > 0,
    // Every node has deterministic, code-side acceptance checks — that IS an
    // external verifier independent of the model.
    hasExternalVerifier: true,
    votable: false,
    slaTier: "standard",
    multiAgentRequested: false,
    singleAgentBaselineFailed: false,
    ...(node.promptStrategy
      ? { requestedStrategy: node.promptStrategy.id as StrategyId }
      : {}),
  };
}

export interface ResolvedNodeResources {
  resources: CuratedResource[];
  /** Explicit degradation/flag notes (stale pins, exclusions). */
  notes: string[];
  roleSlug: string | null;
  selection: ResourceSelection | null;
}

const sha = (s: string) => createHash("sha256").update(s).digest("hex");

/**
 * Resolve the curated resources for a node: owner-pinned resourceUrls first
 * (relevance 1.0), then role/goal-relevant registry links via deterministic
 * selection (core → trigger-matched conditional → internal; stale excluded
 * and reported). No arbitrary or broad selection.
 */
export async function resolveNodeResources(
  node: NodeSpec,
): Promise<ResolvedNodeResources> {
  const db = getDb();
  const notes: string[] = [];
  const resources: CuratedResource[] = [];
  const usedUrls = new Set<string>();

  // ── Owner-pinned URLs (explicit contract intent wins) ──
  if (node.resourceUrls.length) {
    const pinned = await db
      .select()
      .from(registryResources)
      .where(inArray(registryResources.url, node.resourceUrls));
    const byUrl = new Map(pinned.map((r) => [r.url, r]));
    for (const url of node.resourceUrls) {
      const row = byUrl.get(url);
      if (!row) continue; // validation guarantees existence; skip defensively
      usedUrls.add(url);
      if (row.stale) {
        notes.push(
          `pinned resource "${row.name}" is stale (E0-stale, link-check 404 on 2026-11-20); included but flagged`,
        );
      }
      resources.push({
        id: `pinned-${row.id}`,
        title: row.name,
        url: row.url,
        excerpt: row.purpose,
        relevance: 1.0,
        level: row.purpose ? "summary" : "metadata",
        trust: "untrusted",
      });
    }
  }

  // ── Role/goal-relevant links ──
  let roleSlug: string | null = null;
  let selection: ResourceSelection | null = null;
  const profile = await db.query.registryRoleProfiles.findFirst({
    where: eq(registryRoleProfiles.name, node.role),
  });
  if (profile) {
    roleSlug = profile.slug;
    const rows = await db
      .select()
      .from(registryRoleResourceLinks)
      .where(eq(registryRoleResourceLinks.roleSlug, profile.slug));
    const links: LinkedResource[] = rows.map((r) => ({
      linkId: r.linkId,
      roleSlug: r.roleSlug,
      url: r.resourceUrl,
      name: r.resourceName,
      domain: r.domain,
      type: r.type,
      flag: r.flag,
      tier: r.tier,
      evidence: r.evidence,
      access: r.access,
      license: r.license,
      trigger: r.trigger,
      stale: r.stale,
    }));
    selection = selectRoleResources(links, node.goal);
    if (selection.excludedStale.length > 0) {
      notes.push(
        `${selection.excludedStale.length} stale role resource(s) excluded from selection (${selection.excludedStale
          .map((s) => s.name)
          .slice(0, 3)
          .join("; ")}${selection.excludedStale.length > 3 ? "; …" : ""})`,
      );
    }
    const fresh = selection.selected.filter((s) => !usedUrls.has(s.url));
    if (fresh.length) {
      const detail = await db
        .select()
        .from(registryResources)
        .where(
          inArray(
            registryResources.url,
            fresh.map((s) => s.url),
          ),
        );
      const purposeByUrl = new Map(detail.map((r) => [r.url, r.purpose]));
      const linkByUrl = new Map(rows.map((r) => [r.resourceUrl, r]));
      for (const s of fresh) {
        const purpose = purposeByUrl.get(s.url) ?? "";
        resources.push({
          id: linkByUrl.get(s.url)?.linkId ?? `role-${sha(s.url).slice(0, 12)}`,
          title: s.name,
          url: s.url,
          excerpt: purpose,
          // Below 1.0 so explicit owner pins always win the cap.
          relevance: Math.min(0.95, s.relevance),
          level: purpose ? "summary" : "metadata",
          trust: "untrusted",
        });
      }
    }
  }

  return { resources: resources.slice(0, 16), notes, roleSlug, selection };
}

export interface CompiledNodePrompt {
  compiled: CompiledPrompt;
  decision: RoutingDecision;
  resourceNotes: string[];
  /** Goal-mode overlay actually applied (design §3); applied=false = byte-identical to pre-goal-mode behavior. */
  goalMode: { mode: GoalMode; applied: boolean; maxOutputTokens: number };
}

/**
 * Compile the dispatch prompt for a claimed node. Strategy routing: the
 * contract's optional promptStrategy is gated by the dispatch rules
 * (evaluation-only / orchestration-requiring requests are rejected and the
 * rule-based default is used); absent a request the router defaults to
 * direct_structured unless the task shape qualifies for plan_execute /
 * least_to_most.
 */
export async function compileNodePrompt(
  run: Run,
  node: NodeSpec,
  skill: Skill,
  upstreamRefs: { nodeKey: string; title: string; summary: string; sha256: string }[],
): Promise<CompiledNodePrompt> {
  const requested = node.promptStrategy
    ? StrategyIdSchema.safeParse(node.promptStrategy.id)
    : null;
  const routingReq = routingRequestForNode(node);
  if (requested && !requested.success) {
    // Should be impossible (DAG validation blocks unknown ids); treat as no request.
    delete routingReq.requestedStrategy;
  } else if (requested?.success) {
    routingReq.requestedStrategy = requested.data;
  }

  // Goal-mode preset (design §3): owner overrides live in ownerSettings
  // under `goal-mode-presets:<provider>`; strategy ids come from the preset
  // (existing strategy ids only — never model ids). The preset's strategy
  // is a REQUEST that still passes the dispatch gates below; a node's own
  // promptStrategy request always wins. The shipped default 'build' preset
  // with no owner override is a byte-identical no-op overlay.
  const db = getDb();
  const goalMode = run.goalMode ?? "build";
  const overrideRow = await db.query.ownerSettings.findFirst({
    where: and(
      eq(ownerSettings.ownerId, run.startedBy),
      eq(ownerSettings.key, `${GOAL_MODE_SETTINGS_PREFIX}${run.provider}`),
    ),
  });
  const rawOverrides = overrideRow?.value;
  const hasModeOverride =
    !!rawOverrides && typeof rawOverrides === "object" && goalMode in (rawOverrides as object);
  const presetActive = goalMode !== "build" || hasModeOverride;
  const preset = resolveGoalModePresets(rawOverrides)[goalMode];
  if (presetActive && !routingReq.requestedStrategy) {
    routingReq.requestedStrategy = preset.strategyId;
  }
  const decision = resolveDispatchStrategy(routingReq);

  const { resources, notes } = await resolveNodeResources(node);

  const upstream: UpstreamArtifactRef[] = upstreamRefs.map((r) => ({
    nodeKey: r.nodeKey,
    title: r.title,
    summary: r.summary,
    sha256: /^[0-9a-f]{64}$/.test(r.sha256) ? r.sha256 : sha(`upstream:${r.title}:${r.summary}`),
    trust: "untrusted" as const,
  }));

  const rule = ACCEPTANCE_RULES[node.outputArtifactType as ArtifactType];
  const compiled = compilePrompt({
    goal: node.goal,
    role: node.role,
    skill: { pin: node.skill, body: skill.bodyText },
    resources,
    upstream,
    output: {
      artifactType: node.outputArtifactType,
      requiredSections: rule?.requiredSections ?? ["Summary"],
      requireCitationOrLimitation: rule?.requireCitationOrLimitation ?? true,
    },
    budgets: PromptBudgetSchema.parse({}),
    strategy: {
      id: decision.strategy,
      ...(node.promptStrategy?.fanout !== undefined
        ? { fanout: node.promptStrategy.fanout }
        : {}),
      ...(node.promptStrategy?.retries !== undefined
        ? { retries: node.promptStrategy.retries }
        : {}),
    },
    context: { runId: run.id, nodeKey: node.key },
  });

  // Append the preset preamble as the LAST trusted system section and
  // derive the output-token ceiling (no-op overlay when presetActive=false).
  const gm: GoalModePromptResult = presetActive
    ? applyGoalMode({ system: compiled.system, nodeMaxTokens: node.budget.maxTokens, preset })
    : { system: compiled.system, maxOutputTokens: node.budget.maxTokens };

  return {
    compiled: { ...compiled, system: gm.system },
    decision,
    resourceNotes: notes,
    goalMode: { mode: goalMode, applied: presetActive, maxOutputTokens: gm.maxOutputTokens },
  };
}
