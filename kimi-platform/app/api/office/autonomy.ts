import type { NodeBudget } from "@contracts/dag";
import { ALLOWED_TOOL_VERBS, usdToMicros } from "@contracts/dag";
import type { ApprovalKind, EventActor, RunMode } from "@contracts/run";
import {
  AUTONOMY_GRANT_TTL,
  NEVER_BYPASSABLE_APPROVAL_KINDS,
  TEXT_ARTIFACT_TYPES,
  type AutonomyBudget,
  type AutonomyGrant,
  type AutonomyRunEventType,
  type GateDecision,
  type GrantUsage,
  type OfficeEventType,
  type RiskTier,
} from "@contracts/office";

/**
 * Autonomy gate resolver + grant lifecycle helpers (design §2). Pure and
 * isolated: no DB, no scheduler imports. The engine wiring is intentionally
 * NOT done here — integration notes:
 *
 *   - `resolveApprovalGate` is called from exactly two places in the
 *     existing loop: the start-gate block in `advanceRun` and the
 *     `approvalBefore === "accept"` block in `dispatchNode` (design §2.4).
 *   - `validateGrantRequest` backs `autonomy.grant`; `planGrantRevocation`
 *     backs `autonomy.revoke`; `planEmergencyStop` backs
 *     `autonomy.emergencyStop` (which composes the existing stopRun pool
 *     semantics — it never kills accepted work, only fences in-flight
 *     leases and revokes grants).
 *   - `grantUsageExceeded` is the additional pre-check next to
 *     `runBudgetOverrun`: crossing a ceiling emits `grant_budget_exceeded`
 *     and stops the run `stopped_human` (no auto-top-up).
 *
 * Every bypass leaves a per-node `approval_bypassed` audit record from the
 * same guarded transition that would otherwise have created the approval
 * row — "the grant allowed it" is never implicit.
 */

// ── Grant state ──────────────────────────────────────────────────

/** A grant is active iff not revoked and not expired (DB-side NOW(3)). */
export function isGrantActive(
  grant: AutonomyGrant,
  nowMs: number,
): boolean {
  return grant.revokedAtMs === null && grant.expiresAtMs > nowMs;
}

export function isGrantExpired(grant: AutonomyGrant, nowMs: number): boolean {
  return grant.revokedAtMs === null && grant.expiresAtMs <= nowMs;
}

/** True when the node's whole budget fits inside the grant's hard ceilings. */
export function budgetFitsGrant(
  budget: NodeBudget,
  grant: AutonomyGrant,
): boolean {
  return (
    budget.maxTokens <= grant.maxTokens &&
    budget.maxCalls <= grant.maxCalls &&
    budget.maxMinutes <= grant.maxMinutes &&
    usdToMicros(budget.maxCostUsd) <= grant.maxCostUsdMicros
  );
}

// ── Never-bypassable tripwire (design §2.4 rule 1) ───────────────

/**
 * Future contract fields that would touch source policy, credentials,
 * external writes, code execution, or physical actions. Today's NodeSpec
 * cannot express any of them (read-only ALLOWED_TOOL_VERBS, no tool calls
 * in buildPrompts), so this is a tripwire: if a future contract field ever
 * appears on a node, the resolver returns "require" and the run degrades to
 * mode 'all'.
 */
export const NEVER_BYPASSABLE_NODE_FIELDS = [
  "sourcePolicy",
  "skillRegister",
  "skillVet",
  "skillPromote",
  "credentials",
  "credentialAccess",
  "integrationVault",
  "externalWrite",
  "externalAction",
  "codeExecution",
  "executeCode",
  "physicalAction",
  "networkEgress",
  "shell",
] as const;

const ALLOWED_VERB_SET: ReadonlySet<string> = new Set(ALLOWED_TOOL_VERBS);

/**
 * Detects any node-level risk signal: a tool verb outside the read-only
 * ALLOWED_TOOL_VERBS set, or any never-bypassable contract field present
 * with a truthy value. Fail-closed on unknown shapes.
 */
export function nodeHasRiskSignals(node: unknown): boolean {
  if (typeof node !== "object" || node === null) return true;
  const rec = node as Record<string, unknown>;
  const tools = rec.toolsAllowed;
  if (Array.isArray(tools)) {
    for (const verb of tools) {
      if (typeof verb !== "string" || !ALLOWED_VERB_SET.has(verb)) return true;
    }
  } else if (tools !== undefined) {
    return true;
  }
  for (const field of NEVER_BYPASSABLE_NODE_FIELDS) {
    if (field in rec && Boolean(rec[field])) return true;
  }
  return false;
}

// ── Text artifact gate (design §2.1 mode 'none') ─────────────────

const TEXT_TYPE_SET: ReadonlySet<string> = new Set(TEXT_ARTIFACT_TYPES);

/** True iff the output artifact type is a closed-list read-only text type. */
export function isTextArtifactType(artifactType: string): boolean {
  return TEXT_TYPE_SET.has(artifactType);
}

// ── The gate decision function (design §2.4) ─────────────────────

export interface GateContext {
  /** Already filtered: revoked_at IS NULL AND expires_at > NOW(3). */
  grant: AutonomyGrant | null;
  run: { mode: RunMode };
  project: { riskTier: RiskTier };
  node: unknown; // NodeSpec today; unknown-tolerant for the tripwire
  /** "plan" (start) | "artifact-accept" (accept) | others. */
  approvalKind: ApprovalKind;
}

/**
 * Rules, in order (design §2.4):
 *  1. Never-bypassable approval kinds (plan/budget-increase/knowledge-
 *     promote/external-action) and any node with risk signals → "require",
 *     regardless of grant or mode.
 *  2. No active grant → "require" (mode 'all' is the default).
 *  3. Grant mode 'all' → "require".
 *  4. Grant mode 'risk_based' → "bypass" iff the node carries no risk
 *     signals: project riskTier low|medium, node budget ≤ grant ceilings,
 *     and (for live runs) grant.allowLive. Else "require".
 *  5. Grant mode 'none' → "forbidden" when the project is high-risk (mode
 *     'none' may not be preauthorized at all; run start rejects it, matching
 *     createRun's fail-closed style). Otherwise "bypass" iff the run is
 *     mock, or (allowLive AND riskTier low AND text-artifact output AND
 *     node budget ≤ grant ceilings). Else "require".
 *
 * Mode 'none' changes WHO must click approve, never WHAT may execute.
 */
export function resolveApprovalGate(ctx: GateContext): GateDecision {
  // Rule 1 — never-bypassable classes, no exceptions.
  if (
    (NEVER_BYPASSABLE_APPROVAL_KINDS as readonly string[]).includes(
      ctx.approvalKind,
    )
  ) {
    return "require";
  }
  if (nodeHasRiskSignals(ctx.node)) return "require";

  const grant =
    ctx.grant && ctx.grant.revokedAtMs === null ? ctx.grant : null;

  // Rule 2 / 3.
  if (!grant) return "require";
  if (grant.mode === "all") return "require";

  const node = ctx.node as { budget?: NodeBudget; outputArtifactType?: string };
  const budget = node.budget;
  if (!budget) return "require"; // fail closed on malformed node

  if (grant.mode === "risk_based") {
    if (ctx.project.riskTier === "high") return "require";
    if (ctx.run.mode === "live" && !grant.allowLive) return "require";
    return budgetFitsGrant(budget, grant) ? "bypass" : "require";
  }

  // grant.mode === "none"
  // Rule 6 — high-risk tier may not be preauthorized at all.
  if (ctx.project.riskTier === "high") return "forbidden";
  // Rule 5 — mock runs bypass outright; low-risk live needs text output
  // inside the grant ceilings.
  if (ctx.run.mode === "mock") return "bypass";
  if (!grant.allowLive) return "require";
  if (ctx.project.riskTier !== "low") return "require";
  if (!isTextArtifactType(node.outputArtifactType ?? "")) return "require";
  return budgetFitsGrant(budget, grant) ? "bypass" : "require";
}

// ── Grant request validation (backs autonomy.grant, design §2.3) ─

export type GrantValidationError =
  | "live_requires_low_risk"
  | "ttl_out_of_range"
  | "expires_in_past";

/**
 * Validation for a new grant: mode 'none' + allowLive requires
 * projects.riskTier='low'; expiry within (now, now+7d] and at least the
 * minimum TTL. Budgets are pre-validated by AutonomyBudgetSchema
 * (BUDGET_CEILINGS).
 */
export function validateGrantRequest(input: {
  mode: AutonomyGrant["mode"];
  allowLive: boolean;
  riskTier: RiskTier;
  expiresInMinutes: number;
  nowMs: number;
}): { ok: true; expiresAtMs: number } | { ok: false; error: GrantValidationError } {
  if (input.mode === "none" && input.allowLive && input.riskTier !== "low") {
    return { ok: false, error: "live_requires_low_risk" };
  }
  if (
    input.expiresInMinutes < AUTONOMY_GRANT_TTL.minMinutes ||
    input.expiresInMinutes > AUTONOMY_GRANT_TTL.maxMinutes
  ) {
    return { ok: false, error: "ttl_out_of_range" };
  }
  const expiresAtMs = input.nowMs + input.expiresInMinutes * 60_000;
  if (expiresAtMs <= input.nowMs) return { ok: false, error: "expires_in_past" };
  return { ok: true, expiresAtMs };
}

// ── Grant budget enforcement (design §2.4 createRun pre-check) ───

export interface GrantBudgetBreach {
  ceiling: "maxTokens" | "maxCalls" | "maxMinutes" | "maxCostUsdMicros";
  used: number;
  limit: number;
}

/**
 * Returns the first hard ceiling crossed by the summed usage of all runs
 * sharing the grant, or null. Caller emits `grant_budget_exceeded` and stops
 * the run `stopped_human` — deliberate human action, no auto-top-up.
 */
export function grantUsageExceeded(
  grant: AutonomyGrant,
  usage: GrantUsage,
): GrantBudgetBreach | null {
  if (usage.tokens > grant.maxTokens) {
    return { ceiling: "maxTokens", used: usage.tokens, limit: grant.maxTokens };
  }
  if (usage.calls > grant.maxCalls) {
    return { ceiling: "maxCalls", used: usage.calls, limit: grant.maxCalls };
  }
  if (usage.minutes > grant.maxMinutes) {
    return { ceiling: "maxMinutes", used: usage.minutes, limit: grant.maxMinutes };
  }
  if (usage.costUsdMicros > grant.maxCostUsdMicros) {
    return {
      ceiling: "maxCostUsdMicros",
      used: usage.costUsdMicros,
      limit: grant.maxCostUsdMicros,
    };
  }
  return null;
}

// ── Lifecycle plans + audit events (design §2.3 / §2.5) ──────────

export interface OfficeEventDraft {
  type: OfficeEventType;
  actor: EventActor;
  payload: Record<string, unknown>;
}

export interface RunEventDraft {
  type: AutonomyRunEventType;
  actor: "system";
  payload: Record<string, unknown>;
}

/**
 * Plan for `autonomy.grant`: supersede-revoke every active grant for the
 * project (guarded UPDATE ... revoked_at IS NULL), insert the new grant,
 * append one `autonomy_granted` office event — one transaction.
 */
export function planGrantSupersede(input: {
  activeGrants: AutonomyGrant[];
  newGrantId: number;
  mode: AutonomyGrant["mode"];
  actorName: string;
  nowMs: number;
}): { supersededGrantIds: number[]; event: OfficeEventDraft } {
  const supersededGrantIds = input.activeGrants
    .filter((g) => isGrantActive(g, input.nowMs))
    .map((g) => g.id);
  return {
    supersededGrantIds,
    event: {
      type: "autonomy_granted",
      actor: "human",
      payload: {
        grantId: input.newGrantId,
        mode: input.mode,
        grantedBy: input.actorName,
        superseded: supersededGrantIds,
      },
    },
  };
}

/**
 * Plan for `autonomy.revoke`: guarded single update
 * (WHERE id=? AND revoked_at IS NULL; affectedRows=0 ⇒ CONFLICT — double
 * revoke is a race, not a silent success) + one `autonomy_revoked` event.
 */
export function planGrantRevocation(input: {
  grant: AutonomyGrant;
  actorName: string;
  reason: string;
  emergency?: boolean;
  nowMs: number;
}):
  | { ok: true; event: OfficeEventDraft }
  | { ok: false; error: "already_revoked" } {
  if (input.grant.revokedAtMs !== null) {
    return { ok: false, error: "already_revoked" };
  }
  return {
    ok: true,
    event: {
      type: "autonomy_revoked",
      actor: "human",
      payload: {
        grantId: input.grant.id,
        mode: input.grant.mode,
        revokedBy: input.actorName,
        reason: input.reason,
        emergency: input.emergency === true,
      },
    },
  };
}

/**
 * Plan for the sweeper's grant-expiry pass (design §2.3): one
 * `autonomy_expired` office event per newly expired grant. Mid-run expiry
 * degrades autonomy — the next gated node falls back to the normal approval
 * flow; accepted work is never killed.
 */
export function planGrantExpirations(
  grants: AutonomyGrant[],
  nowMs: number,
): { expiredGrantIds: number[]; events: OfficeEventDraft[] } {
  const expiring = grants.filter((g) => isGrantExpired(g, nowMs));
  return {
    expiredGrantIds: expiring.map((g) => g.id),
    events: expiring.map((g) => ({
      type: "autonomy_expired",
      actor: "system",
      payload: { grantId: g.id, mode: g.mode, expiredAtMs: g.expiresAtMs },
    })),
  };
}

/**
 * Plan for `autonomy.emergencyStop` (design §2.3): composes existing
 * primitives in order — (1) supersede-revoke ALL active grants (reason
 * 'emergency'), (2) stopRun every active run of the project (existing
 * pool.stop semantics fence in-flight leases via revokeRunLeases), (3) one
 * `autonomy_revoked` office event with { emergency: true, stoppedRuns }.
 * Idempotent via idempotencyKey; re-running stops nothing twice because
 * stopRun is a guarded transition and revocation is revoked_at-guarded.
 */
export function planEmergencyStop(input: {
  projectId: number;
  activeGrants: AutonomyGrant[];
  activeRunIds: number[];
  actorName: string;
  reason: string;
  nowMs: number;
}): {
  revokeGrantIds: number[];
  stopRunIds: number[];
  event: OfficeEventDraft;
} {
  const revokeGrantIds = input.activeGrants
    .filter((g) => isGrantActive(g, input.nowMs))
    .map((g) => g.id);
  return {
    revokeGrantIds,
    stopRunIds: [...input.activeRunIds],
    event: {
      type: "autonomy_revoked",
      actor: "human",
      payload: {
        projectId: input.projectId,
        emergency: true,
        reason: input.reason,
        revokedBy: input.actorName,
        revokedGrants: revokeGrantIds,
        stoppedRuns: [...input.activeRunIds],
      },
    },
  };
}

/**
 * The per-node audit record for a bypassed gate (design §2.5). Emitted
 * exactly once per node per gate from the same guarded transition that
 * would otherwise have created the approval row — a bypass and an approval
 * request can never both exist for one gate.
 */
export function approvalBypassedEvent(input: {
  grantId: number;
  mode: AutonomyGrant["mode"];
  nodeKey: string;
  kind: ApprovalKind;
}): RunEventDraft {
  return {
    type: "approval_bypassed",
    actor: "system",
    payload: {
      grantId: input.grantId,
      mode: input.mode,
      nodeKey: input.nodeKey,
      kind: input.kind,
    },
  };
}

/** Run-stream audit when a grant ceiling is crossed (stopped_human). */
export function grantBudgetExceededEvent(input: {
  grantId: number;
  breach: GrantBudgetBreach;
}): RunEventDraft {
  return {
    type: "grant_budget_exceeded",
    actor: "system",
    payload: {
      grantId: input.grantId,
      ceiling: input.breach.ceiling,
      used: input.breach.used,
      limit: input.breach.limit,
    },
  };
}

/** Convert an AutonomyBudget (USD) input into grant-row ceilings (micros). */
export function budgetToGrantCeilings(budget: AutonomyBudget): {
  maxTokens: number;
  maxCalls: number;
  maxMinutes: number;
  maxCostUsdMicros: number;
} {
  return {
    maxTokens: budget.maxTokens,
    maxCalls: budget.maxCalls,
    maxMinutes: budget.maxMinutes,
    maxCostUsdMicros: usdToMicros(budget.maxCostUsd),
  };
}
