import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc-client";
import {
  ASSISTANT_ACTION_POLICIES,
  ASSISTANT_ACTIONS,
  ASSISTANT_JOB_POLICIES,
  CACHE_NAMESPACES,
  buildStudyQueue,
  type AssistantAction,
  type AssistantGate,
  type AssistantJobSchedule,
  type AssistantRisk,
  type AssistantScope,
  type GithubIntakeMode,
  type RepoAssignmentStatus,
  type StudyQueueItem,
} from "@contracts/assistant";
import { canonicalJson, sha256Hex } from "@contracts/enterprise";
import type { SnapshotLike } from "./adapter";

/**
 * Donna / shared-assistant data hooks + pure view-model derivations. Every
 * read is a pure tRPC query; every write is an explicit human mutation routed
 * through the assistant proposal pipeline (or, for emergency stop ONLY, the
 * existing direct enterprise.programCancel path — never an assistant
 * proposal). All derivation helpers are pure and provider-free so the drawer
 * is testable without a server.
 */

// ── Structural mirrors of the tRPC assistant payloads ────────────

export interface ProposalRowLike {
  id: number;
  proposalKey: string;
  scope: AssistantScope;
  actor: string;
  action: string;
  payload: Record<string, unknown>;
  payloadHash: string;
  expectedVersion: number;
  risk: AssistantRisk;
  requiresApproval: boolean;
  confirmedGates: AssistantGate[];
  status: "proposed" | "approved" | "rejected" | "executed" | "failed" | "cancelled";
  resultSummary: string;
  proposedAt: number;
  decidedAt: number | null;
  executedAt: number | null;
}

export interface QueueRowLike {
  id: number;
  scope: AssistantScope;
  scopeKey: string;
  version: number;
}

export interface QueueItemRowLike {
  id: number;
  queueId: number;
  itemKey: string;
  itemKind: "company-run" | "study" | "repository-triage" | "custom";
  refId: string;
  title: string;
  position: number;
  status: "queued" | "dispatched" | "done" | "dropped";
  payloadHash: string;
}

export interface JobRowLike {
  id: number;
  jobKey: string;
  scope: AssistantScope;
  scopeKey: string;
  kind: keyof typeof ASSISTANT_JOB_POLICIES;
  schedule: AssistantJobSchedule;
  enabled: boolean;
  nextRunAt: number | null;
  lastRunAt: number | null;
  runCount: number;
  maxRuns: number | null;
  version: number;
}

export interface RepoPlanRowLike {
  id: number;
  url: string;
  commitSha: string;
  status: RepoAssignmentStatus;
  companyKey: string | null;
  departmentKey: string | null;
  discipline: string | null;
  skillId: string | null;
  confidence: number;
  rationale: string;
  readOnly: boolean;
  redistributionAllowed: boolean;
  notes: string[];
  appliedBy: string | null;
}

export interface RepoRowLike {
  id: number;
  url: string;
  ownerName: string;
  name: string;
  description: string;
  language: string | null;
  topics: string[];
  license: string | null;
  archived: boolean;
  defaultBranch: string;
  commitSha: string;
  visibility: "public" | "private" | "internal";
  intakeMode: GithubIntakeMode;
  plans: RepoPlanRowLike[];
}

export interface StudyItemRowLike {
  id: number;
  itemKey: string;
  skillId: string;
  resourceRef: string;
  topic: string;
  goal: string;
  evaluation: string;
  status: "draft" | "queued" | "in-progress" | "completed" | "dropped";
}

export interface TransferRowLike {
  id: number;
  transferKey: string;
  refs: { artifactId: string | number; title: string; contentSha256: string }[];
  handoff: { from: string; to: string; summary: string };
  contentSha256: string;
  createdAt: Date | string;
}

export interface CacheNamespaceLike {
  namespace: (typeof CACHE_NAMESPACES)[number];
  serverSide: boolean;
  memoizedEntries?: number;
  keyedBy?: string;
}

// ── Scope selector (fed by the enterprise snapshot) ──────────────

export interface ScopeOption {
  value: string;
  scope: AssistantScope;
  scopeKey: string;
  label: string;
  disabled: boolean;
  reason: string | null;
}

export function scopeValue(scope: AssistantScope, scopeKey: string): string {
  return scope === "enterprise" ? "enterprise" : `${scope}:${scopeKey}`;
}

export function parseScopeValue(value: string): { scope: AssistantScope; scopeKey: string } {
  if (value === "enterprise") return { scope: "enterprise", scopeKey: "" };
  const idx = value.indexOf(":");
  const scope = value.slice(0, idx) as AssistantScope;
  return { scope, scopeKey: value.slice(idx + 1) };
}

interface SnapshotCompanyScope {
  key: string;
  name: string;
  active: boolean;
  archivedAt?: Date | string | null;
}

interface SnapshotDepartmentScope {
  key: string;
  name: string;
  status?: "active" | "paused" | "archived";
}

/**
 * Scope options come from the SAME snapshot rows the dashboard renders —
 * never invented keys. Offices are not materialized in the enterprise
 * snapshot (they are workspace-level), so the office scope is listed but
 * honestly disabled with its reason.
 */
export function deriveScopeOptions(snapshot: SnapshotLike): ScopeOption[] {
  const options: ScopeOption[] = [
    {
      value: "enterprise",
      scope: "enterprise",
      scopeKey: "",
      label: `Enterprise — ${snapshot.enterprise.name}`,
      disabled: false,
      reason: null,
    },
  ];
  for (const c of snapshot.companies as SnapshotCompanyScope[]) {
    const archived = c.archivedAt !== null && c.archivedAt !== undefined;
    options.push({
      value: scopeValue("company", c.key),
      scope: "company",
      scopeKey: c.key,
      label: `Company — ${c.name} (${c.key})`,
      disabled: archived,
      reason: archived ? "company is archived (terminal)" : null,
    });
  }
  for (const d of snapshot.departments as SnapshotDepartmentScope[]) {
    const archived = d.status === "archived";
    options.push({
      value: scopeValue("department", d.key),
      scope: "department",
      scopeKey: d.key,
      label: `Department — ${d.name} (${d.key})`,
      disabled: archived,
      reason: archived ? "department is archived (terminal)" : null,
    });
  }
  options.push({
    value: "office",
    scope: "office",
    scopeKey: "",
    label: "Office — (none in this enterprise snapshot)",
    disabled: true,
    reason: "offices are workspace-level and are not materialized in the enterprise snapshot",
  });
  return options;
}

// ── Action policy derivations (contract is the source of truth) ──

export function requiredGates(action: string): readonly AssistantGate[] {
  return ASSISTANT_ACTION_POLICIES[action as AssistantAction]?.gates ?? [];
}

export function riskOfAction(action: string): AssistantRisk {
  return ASSISTANT_ACTION_POLICIES[action as AssistantAction]?.risk ?? "high";
}

export function requiresApproval(action: string): boolean {
  return ASSISTANT_ACTION_POLICIES[action as AssistantAction]?.requiresApproval ?? true;
}

export function drainsAndPreserves(action: string): boolean {
  return ASSISTANT_ACTION_POLICIES[action as AssistantAction]?.drainAndPreserve ?? false;
}

/** Stable DOM id for a gate confirmation checkbox. */
export function gateChecklistId(actionId: string, gate: AssistantGate): string {
  return `gate-${actionId.replace(/[^a-z0-9]+/gi, "-")}-${gate}`;
}

/** Human gate explanations (the seven non-bypassable gates). */
export const GATE_EXPLANATIONS: Record<AssistantGate, string> = {
  "plan-approval": "I approve this plan and the exact payload shown.",
  credentials: "I confirm the credential/vault use this action relies on.",
  "external-writes": "I confirm this action touches an external system.",
  "code-execution": "I confirm code execution is intended.",
  "physical-action": "I confirm a physical-world action is intended.",
  "high-risk": "I confirm this high-risk, hard-to-reverse action.",
  "live-provider-confirmation": "I confirm live/billed provider calls may occur.",
};

// ── Payload hash + typed diff ────────────────────────────────────

/**
 * Recompute the contract payload hash (sha256 of canonical JSON) so the UI
 * can prove the payload it shows is exactly the payload the server approved.
 */
export function verifyPayloadHash(payload: Record<string, unknown>, payloadHash: string): boolean {
  return sha256Hex(canonicalJson(payload)) === payloadHash;
}

/**
 * Typed payload diff against the empty baseline: every top-level key is an
 * addition. The rendering is canonical (sorted keys, stable encoding) so the
 * human reviews exactly what payloadHash binds.
 */
export function payloadDiffLines(payload: Record<string, unknown>): string[] {
  return Object.keys(payload)
    .sort()
    .map((key) => `+ ${key}: ${JSON.stringify(payload[key])}`);
}

export interface ProposalView {
  id: number;
  action: string;
  actor: string;
  scope: AssistantScope;
  risk: AssistantRisk;
  status: ProposalRowLike["status"];
  payloadHash: string;
  hashVerified: boolean;
  expectedVersion: number;
  requiredGates: readonly AssistantGate[];
  confirmedGates: readonly AssistantGate[];
  missingGates: readonly AssistantGate[];
  diffLines: string[];
  resultSummary: string;
}

export function deriveProposalView(row: ProposalRowLike): ProposalView {
  const gates = requiredGates(row.action);
  return {
    id: row.id,
    action: row.action,
    actor: row.actor,
    scope: row.scope,
    risk: row.risk,
    status: row.status,
    payloadHash: row.payloadHash,
    hashVerified: verifyPayloadHash(row.payload, row.payloadHash),
    expectedVersion: row.expectedVersion,
    requiredGates: gates,
    confirmedGates: row.confirmedGates,
    missingGates: gates.filter((g) => !row.confirmedGates.includes(g)),
    diffLines: payloadDiffLines(row.payload),
    resultSummary: row.resultSummary,
  };
}

// ── Queue (dense reorder + OCC) ──────────────────────────────────

/**
 * Compute the full order array for a one-step move (up = -1, down = +1).
 * The server requires the order to name EXACTLY the queue's current item
 * keys, so a move always submits the complete permutation. Returns null when
 * the move is a no-op (edge of the list).
 */
export function buildReorderOrder(
  items: readonly { itemKey: string }[],
  itemKey: string,
  direction: -1 | 1,
): string[] | null {
  const order = items.map((i) => i.itemKey);
  const idx = order.indexOf(itemKey);
  if (idx === -1) return null;
  const target = idx + direction;
  if (target < 0 || target >= order.length) return null;
  const next = [...order];
  [next[idx], next[target]] = [next[target]!, next[idx]!];
  return next;
}

/** OCC input: the reorder is pinned to the exact queue version the human saw. */
export function buildQueueReorderInput(
  scope: AssistantScope,
  scopeKey: string,
  order: string[],
  queueVersion: number,
): { scope: AssistantScope; scopeKey: string; order: string[]; expectedQueueVersion: number } {
  return { scope, scopeKey, order, expectedQueueVersion: queueVersion };
}

// ── Schedules (real nextRun + countdown; never paid-auto) ────────

export const NO_PAID_AUTO_NOTE =
  "Assistant jobs are deterministic: they never make provider calls, never make paid calls, and never execute proposals. Schedules run at a zero budget reservation.";

/** Humanize a millisecond duration (largest two units). */
export function humanizeMs(ms: number): string {
  const abs = Math.max(0, Math.round(ms));
  const units: [number, string][] = [
    [86_400_000, "d"],
    [3_600_000, "h"],
    [60_000, "m"],
    [1_000, "s"],
  ];
  const parts: string[] = [];
  let rest = abs;
  for (const [size, label] of units) {
    if (parts.length === 2) break;
    const n = Math.floor(rest / size);
    if (n > 0) {
      parts.push(`${n}${label}`);
      rest -= n * size;
    }
  }
  return parts.length > 0 ? parts.join(" ") : "0s";
}

/** Countdown to the real server nextRunAt; null = the job never runs again. */
export function formatCountdown(nextRunAt: number | null, now: number): string {
  if (nextRunAt === null) return "no further run";
  if (nextRunAt <= now) return "due now";
  return `in ${humanizeMs(nextRunAt - now)}`;
}

export function describeSchedule(schedule: AssistantJobSchedule): string {
  if (schedule.type === "one-time") {
    return `one-time at ${new Date(schedule.runAt).toISOString()}`;
  }
  return `every ${humanizeMs(schedule.intervalMs)} (anchored ${new Date(schedule.anchorAt).toISOString()})`;
}

export interface JobRowView {
  jobKey: string;
  kind: string;
  effect: string;
  scope: AssistantScope;
  scopeKey: string;
  scheduleText: string;
  enabled: boolean;
  nextRunAt: number | null;
  countdown: string;
  runCount: number;
  maxRuns: number | null;
  runsLabel: string;
  budgetLabel: string;
  version: number;
}

export function deriveJobRow(job: JobRowLike, now: number): JobRowView {
  const policy = ASSISTANT_JOB_POLICIES[job.kind];
  return {
    jobKey: job.jobKey,
    kind: job.kind,
    effect: policy?.effect ?? "unknown",
    scope: job.scope,
    scopeKey: job.scopeKey,
    scheduleText: describeSchedule(job.schedule),
    enabled: job.enabled,
    nextRunAt: job.nextRunAt,
    countdown: formatCountdown(job.nextRunAt, now),
    runCount: job.runCount,
    maxRuns: job.maxRuns,
    runsLabel: job.maxRuns === null ? `${job.runCount} runs (unbounded interval)` : `${job.runCount}/${job.maxRuns} runs`,
    // AssistantJob.budget is always ZERO_RESERVATION by contract.
    budgetLabel: "zero reservation (deterministic jobs are free)",
    version: job.version,
  };
}

// ── Cache namespaces ─────────────────────────────────────────────

export const PROVIDER_CACHE_POLICY =
  "Provider responses are never cached. Assistant cache namespaces hold deterministic derivations only (skill excerpts, blueprint, snapshot, repository metadata).";

export function describeCacheNamespace(ns: CacheNamespaceLike): string {
  if (!ns.serverSide) {
    return "no server-side cache on web (client/server derivations only) — invalidation is recorded and reports 0 removals";
  }
  return `server-side memoized namespace: ${ns.memoizedEntries ?? 0} entries, keyed by ${ns.keyedBy ?? "content"}`;
}

// ── Repository intake ────────────────────────────────────────────

export const REPO_INTAKE_MAX_URLS = 50;

export interface ParsedRepoUrls {
  urls: string[];
  duplicates: number;
  truncated: number;
}

/** Parse a paste of repo URLs: trim, drop blanks, dedupe first-wins, cap 50. */
export function parseRepoUrls(text: string, max = REPO_INTAKE_MAX_URLS): ParsedRepoUrls {
  const seen = new Set<string>();
  let duplicates = 0;
  let truncated = 0;
  const urls: string[] = [];
  for (const raw of text.split(/\s+/)) {
    const url = raw.trim();
    if (!url) continue;
    if (seen.has(url)) {
      duplicates += 1;
      continue;
    }
    seen.add(url);
    if (urls.length >= max) {
      truncated += 1;
      continue;
    }
    urls.push(url);
  }
  return { urls, duplicates, truncated };
}

export interface IntakeControls {
  previewEnabled: boolean;
  previewReason: string | null;
  requiresRecordId: boolean;
  recordIdForbidden: boolean;
  gates: readonly AssistantGate[];
  note: string;
}

/**
 * Intake-mode rules, mirroring the contract + router: public-anonymous reads
 * confirmed public metadata with no credential (recordId forbidden);
 * credentialed-approved requires a vault record id AND the approved
 * repository.import gates. Credentialed PREVIEWS are refused server-side.
 */
export function deriveIntakeControls(mode: GithubIntakeMode): IntakeControls {
  if (mode === "public-anonymous") {
    return {
      previewEnabled: true,
      previewReason: null,
      requiresRecordId: false,
      recordIdForbidden: true,
      gates: requiredGates("repository.import"),
      note: "public-anonymous: confirmed public metadata read, no credentials — never a clone, never code.",
    };
  }
  return {
    previewEnabled: false,
    previewReason: "credentialed previews are refused — private/credentialed reads require an approved repository.import (credentials gate)",
    requiresRecordId: true,
    recordIdForbidden: false,
    gates: requiredGates("repository.import"),
    note: "credentialed-approved: reads through the owner's vault record under the credentials + external-writes + high-risk gates.",
  };
}

export interface RepoApplyControl {
  enabled: boolean;
  kind: "assign" | "propose_structure" | null;
  label: string;
  reason: string | null;
  gates: readonly AssistantGate[];
}

/**
 * What the human may do with a routing plan. Only an approved apply binds an
 * assignment; a proposed_new_structure stays an explicit low-confidence
 * proposal (never auto-creates companies/departments/roles); quarantined
 * plans have no apply control at all.
 */
export function deriveRepoApplyControl(plan: {
  status: RepoAssignmentStatus;
  appliedBy: string | null;
}): RepoApplyControl {
  if (plan.appliedBy !== null) {
    return {
      enabled: false,
      kind: null,
      label: "Applied",
      reason: `already applied by ${plan.appliedBy}`,
      gates: [],
    };
  }
  if (plan.status === "assigned") {
    return {
      enabled: true,
      kind: "assign",
      label: "Apply assignment",
      reason: null,
      gates: requiredGates("repository.assign"),
    };
  }
  if (plan.status === "proposed_new_structure") {
    return {
      enabled: true,
      kind: "propose_structure",
      label: "Approve new structure (explicit proposal)",
      reason: null,
      gates: requiredGates("repository.propose_structure"),
    };
  }
  return {
    enabled: false,
    kind: null,
    label: "Quarantined",
    reason: "quarantined plans have no apply path — human triage only (no invented companies, departments, or roles)",
    gates: [],
  };
}

// ── Study queue (dedupe / cap / drafts) ──────────────────────────

/**
 * Contract-backed dedupe/cap preview (the SAME buildStudyQueue the server
 * executor uses): first occurrence wins on duplicate refs, result capped at
 * STUDY_QUEUE_CAP, every item a provider-free draft.
 */
export function previewStudyItems(
  skillId: string,
  refs: readonly string[],
  goal: string,
): StudyQueueItem[] {
  return buildStudyQueue({
    skillId,
    resources: refs.map((ref) => ({ ref })),
    goal,
  });
}

export function studySkillOptions(snapshot: SnapshotLike): string[] {
  const ids = new Set<string>();
  for (const w of snapshot.contracts) ids.add(w.skillPin.skillId);
  return [...ids].sort();
}

export function summarizeStudyItems(items: readonly StudyItemRowLike[]): {
  total: number;
  byStatus: Record<StudyItemRowLike["status"], number>;
} {
  const byStatus: Record<StudyItemRowLike["status"], number> = {
    draft: 0,
    queued: 0,
    "in-progress": 0,
    completed: 0,
    dropped: 0,
  };
  for (const item of items) byStatus[item.status] += 1;
  return { total: items.length, byStatus };
}

// ── Knowledge transfer draft ─────────────────────────────────────

export interface TransferDraft {
  transferKey: string;
  from: string;
  to: string;
  summary: string;
  artifactIds: number[];
}

/** Validation mirror of the knowledgeTransfer input (refs only, ≤16). */
export function validateTransferDraft(draft: TransferDraft): string | null {
  if (!/^[a-z0-9][a-z0-9-]{0,79}$/.test(draft.transferKey)) {
    return "transfer key must be kebab-case (1–80 chars)";
  }
  if (draft.artifactIds.length === 0) {
    return "select at least one artifact reference — transfers are refs-only, never inline content";
  }
  if (draft.artifactIds.length > 16) {
    return "at most 16 artifact references per transfer";
  }
  if (!draft.from.trim()) return "handoff source (from) is required";
  if (!draft.to.trim()) return "handoff target (to) is required";
  if (draft.summary.length > 2000) return "summary is bounded to 2000 chars (extractive, never raw content)";
  return null;
}

// ── Error mapping (API honesty) ──────────────────────────────────

/**
 * Map an assistant tRPC failure to the honest operator note. The router
 * rethrows domain errors as: CONFLICT (OCC/blueprint drift),
 * PRECONDITION_FAILED (approval/gates/credentials/vault/hash), NOT_FOUND,
 * FORBIDDEN, BAD_REQUEST (validation).
 */
export function describeAssistantError(
  err: { data?: { code?: string } | null; message: string } | null | undefined,
): string | null {
  if (!err) return null;
  const code = err.data?.code;
  if (code === "CONFLICT") {
    return `State changed concurrently — reload and retry (${err.message}).`;
  }
  if (code === "PRECONDITION_FAILED") {
    return `A required approval gate or precondition is not met (${err.message}).`;
  }
  if (code === "NOT_FOUND") {
    return `Not found (or wrong owner): ${err.message}.`;
  }
  if (code === "FORBIDDEN") {
    return `This enterprise belongs to a different owner (${err.message}).`;
  }
  return `The assistant request failed (${err.message}).`;
}

// ── Emergency stop (direct path, never an assistant proposal) ────

export const EMERGENCY_STOP_COPY =
  "Emergency stop is ungated and immediate: it calls the existing enterprise.programCancel path directly and never travels through an assistant proposal.";

// ── Action → surface coverage (every closed action mapped) ───────

/**
 * Where each closed assistant action is dispatched in this drawer. Every
 * ASSISTANT_ACTIONS id must appear here (tested); an action with no surface
 * would be an explicit omission, never a dead control.
 */
export const ASSISTANT_ACTION_SURFACES: Record<AssistantAction, string> = {
  "queue.add": "queue tab (add item form)",
  "queue.reorder": "queue tab (up/down controls with expectedQueueVersion OCC)",
  "worker.hire": "hiring tab (approve contract; plan-approval gate)",
  "worker.pause": "hiring tab (suspend worker)",
  "worker.resume": "hiring tab (resume worker)",
  "worker.fire": "hiring tab (drain + preserve artifacts; high-risk gate)",
  "department.pause": "hiring tab (department lifecycle)",
  "department.resume": "hiring tab (department lifecycle)",
  "department.archive": "hiring tab (department lifecycle; high-risk gate)",
  "company.pause": "hiring tab (company lifecycle)",
  "company.resume": "hiring tab (company lifecycle)",
  "company.archive": "hiring tab (company lifecycle; high-risk gate)",
  "cache.invalidate": "cache tab (per-namespace invalidation)",
  "schedule.upsert": "schedules tab (create/update form; plan-approval gate)",
  "schedule.pause": "schedules tab (pause control)",
  "schedule.resume": "schedules tab (resume control)",
  "schedule.delete": "schedules tab (delete control)",
  "schedule.run_now": "schedules tab (run-now; plan-approval gate)",
  "study.enqueue": "knowledge tab (study queue form; drafts only)",
  "repository.import": "repositories tab (intake; credentials/external-writes/high-risk gates)",
  "repository.assign": "repositories tab (apply assignment; plan-approval gate)",
  "repository.propose_structure": "repositories tab (explicit new-structure proposal; high-risk gate)",
  "knowledge.transfer": "knowledge tab (refs-only handoff; plan-approval gate)",
  "program.pump": "queue tab (approved mock pump; live-provider-confirmation gate)",
};

export function deriveAssistantActionCoverage(): { id: AssistantAction; surface: string }[] {
  return ASSISTANT_ACTIONS.map((id) => ({ id, surface: ASSISTANT_ACTION_SURFACES[id] }));
}

// ── Query hooks (pure reads; never advance state) ────────────────

export function useAssistantDefinitions() {
  return trpc.assistant.definitions.useQuery(undefined, { retry: false });
}

export function useAssistantStatus(enterpriseId: number, enabled: boolean) {
  return trpc.assistant.status.useQuery({ enterpriseId }, { retry: false, enabled });
}

export function useAssistantProposals(enterpriseId: number, enabled: boolean) {
  return trpc.assistant.proposals.useQuery({ enterpriseId, limit: 50 }, { retry: false, enabled });
}

export function useAssistantEvents(enterpriseId: number, enabled: boolean) {
  return trpc.assistant.events.useQuery({ enterpriseId, limit: 50 }, { retry: false, enabled });
}

export function useWorkQueue(
  enterpriseId: number,
  scope: AssistantScope,
  scopeKey: string,
  enabled: boolean,
) {
  return trpc.assistant.queueGet.useQuery({ enterpriseId, scope, scopeKey }, { retry: false, enabled });
}

export function useAssistantJobs(enterpriseId: number, enabled: boolean) {
  return trpc.assistant.jobsList.useQuery({ enterpriseId }, { retry: false, enabled });
}

export function useAssistantCache(enterpriseId: number, enabled: boolean) {
  return trpc.assistant.cacheStatus.useQuery({ enterpriseId }, { retry: false, enabled });
}

export function useStudyItems(enterpriseId: number, enabled: boolean) {
  return trpc.assistant.studyList.useQuery({ enterpriseId, limit: 200 }, { retry: false, enabled });
}

export function useRepositories(enterpriseId: number, enabled: boolean) {
  return trpc.assistant.reposList.useQuery({ enterpriseId }, { retry: false, enabled });
}

export function useKnowledgeTransfers(enterpriseId: number, enabled: boolean) {
  return trpc.assistant.knowledgeList.useQuery({ enterpriseId }, { retry: false, enabled });
}

export function useArtifactPicker(enterpriseId: number, query: string, enabled: boolean) {
  return trpc.enterprise.searchArtifacts.useQuery(
    { enterpriseId, query, limit: 25 },
    { retry: false, enabled },
  );
}

/** A slow tick (30s) so countdowns stay honest without animating. */
export function useNow(intervalMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}
