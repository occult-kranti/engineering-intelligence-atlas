import { z } from "zod";

/** Run lifecycle, event vocabulary, and provider ids (spec §8). */

export const RUN_STATES = [
  "draft",
  "validating",
  "queued",
  "running",
  "awaiting_approval",
  "paused",
  "completed",
  "failed",
  "failed_validation",
  "stopped_budget",
  "stopped_human",
  "terminated_policy",
] as const;
export const RunStateSchema = z.enum(RUN_STATES);
export type RunState = z.infer<typeof RunStateSchema>;

export const TERMINAL_RUN_STATES: ReadonlySet<RunState> = new Set([
  "completed",
  "failed",
  "failed_validation",
  "stopped_budget",
  "stopped_human",
  "terminated_policy",
]);

export const RUN_NODE_STATES = [
  "pending",
  "ready",
  "claimed",
  "running",
  "verifying",
  "waiting",
  "paused",
  "accepted",
  "failed",
  "skipped",
  "cancelled",
] as const;
export const RunNodeStateSchema = z.enum(RUN_NODE_STATES);
export type RunNodeState = z.infer<typeof RunNodeStateSchema>;

/** Terminal node states — never implicitly retried or re-dispatched. */
export const TERMINAL_NODE_STATES: ReadonlySet<RunNodeState> = new Set([
  "accepted",
  "failed",
  "skipped",
  "cancelled",
]);

// ── Control plane (Revision A): worker pool + lease claiming ──────

export const WORKER_KINDS = ["director", "subagent", "human-delegate"] as const;
export const WorkerKindSchema = z.enum(WORKER_KINDS);
export type WorkerKind = z.infer<typeof WorkerKindSchema>;

export const WORKER_STATUSES = ["active", "suspended"] as const;
export const WorkerStatusSchema = z.enum(WORKER_STATUSES);
export type WorkerStatus = z.infer<typeof WorkerStatusSchema>;

export const ASSIGNMENT_MODES = ["director", "self-claim", "hybrid"] as const;
export const AssignmentModeSchema = z.enum(ASSIGNMENT_MODES);
export type AssignmentMode = z.infer<typeof AssignmentModeSchema>;

export const WAIT_REASONS = ["dependency", "approval", "event"] as const;
export const WaitReasonSchema = z.enum(WAIT_REASONS);
export type WaitReason = z.infer<typeof WaitReasonSchema>;

/**
 * Bounded recovery attempts for lease expiry: a node whose lease expired is
 * recycled to `ready` while attempts < NODE_MAX_ATTEMPTS, then `failed`.
 * Recovery is always deliberate and audited — never a silent billed retry.
 */
export const NODE_MAX_ATTEMPTS = 3;

/** Lease heartbeat TTL bounds (seconds) for worker registrations. */
export const LEASE_TTL = { minSeconds: 5, maxSeconds: 3600, defaultSeconds: 120 } as const;

/** Well-known name of the seeded per-project director worker ("worker 0"). */
export const DIRECTOR_WORKER_NAME = "director";

export const RUN_MODES = ["mock", "live"] as const;
export const RunModeSchema = z.enum(RUN_MODES);
export type RunMode = z.infer<typeof RunModeSchema>;

/** Server-side provider adapters. `mock` is deterministic and free. */
export const PROVIDER_IDS = ["mock", "gateway", "openai", "anthropic"] as const;
export const ProviderIdSchema = z.enum(PROVIDER_IDS);
export type ProviderId = z.infer<typeof ProviderIdSchema>;

export const APPROVAL_KINDS = [
  "plan",
  "budget-increase",
  "artifact-accept",
  "knowledge-promote",
  "external-action",
] as const;
export const ApprovalKindSchema = z.enum(APPROVAL_KINDS);
export type ApprovalKind = z.infer<typeof ApprovalKindSchema>;

export const APPROVAL_STATES = [
  "pending",
  "approved",
  "rejected",
  "expired",
] as const;
export const ApprovalStateSchema = z.enum(APPROVAL_STATES);
export type ApprovalState = z.infer<typeof ApprovalStateSchema>;

export const EVENT_ACTORS = ["director", "node", "human", "system", "worker"] as const;
export type EventActor = (typeof EVENT_ACTORS)[number];

/**
 * Event types written to the append-only run_events stream.
 * Payloads never contain secrets, provider keys, or gateway URLs.
 */
export const EVENT_TYPES = [
  "run_created",
  "run_started",
  "run_state",
  "node_state",
  "node_attempt",
  "artifact_created",
  "artifact_storage_error",
  "approval_requested",
  "approval_decided",
  "budget_recorded",
  "budget_exceeded",
  "budget_blocked",
  "termination_fired",
  "error",
  "run_completed",
  "lease_expired",
  "lease_fenced",
  "node_reassigned",
  "prompt_compiled",
  // Autonomy audit (design §2.5; actor "system"; per-node bypass record and
  // grant ceiling enforcement — mirrors AUTONOMY_RUN_EVENT_TYPES).
  "approval_bypassed",
  "grant_budget_exceeded",
] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export interface UsageRecord {
  promptTokens: number;
  completionTokens: number;
  calls: number;
  /**
   * Cost in integer USD micros (1e-6 USD). 0 when the provider does not
   * report usage or pricing is not configured. `simulated` marks mock-mode
   * deterministic simulated cents — never real billing.
   */
  costUsdMicros: number;
  simulated: boolean;
}

/** Owner-configured USD-per-million-token rates for a provider/model. */
export const PricingRateSchema = z.object({
  provider: ProviderIdSchema,
  model: z.string().min(1).max(200),
  inputUsdPerMillion: z.number().nonnegative().max(10_000),
  outputUsdPerMillion: z.number().nonnegative().max(10_000),
});
export type PricingRate = z.infer<typeof PricingRateSchema>;

/** Typed AI degradation surfaced to the UI (spec §8.4, website-ai contract). */
export const AI_ERROR_KINDS = [
  "AiUnavailable",
  "ContentRejected",
  "AiMisconfigured",
  "AiInvalidRequest",
  "AiTransient",
] as const;
export type AiErrorKind = (typeof AI_ERROR_KINDS)[number];

export const AI_ERROR_COPY: Record<AiErrorKind, string> = {
  AiUnavailable: "额度耗尽，此功能不可用，请管理员在 kimi 充值",
  ContentRejected: "内容被安全策略拒绝，请调整目标或输入后重试",
  AiMisconfigured: "AI 提供方未配置或配置异常，需重新部署或补充服务端环境变量",
  AiInvalidRequest: "请求参数非法（开发期错误，已记录日志）",
  AiTransient: "服务暂时不可用。计费型调用不会自动重试，请确认后手动重试",
};
