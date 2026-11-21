import { usdToMicros } from "@contracts/dag";

/**
 * Pure metrics helpers for prompt-strategy evaluation. These compute ONLY
 * from caller-supplied measurements — no benchmark values, baselines, or
 * pricing figures are baked in anywhere. If a baseline or sample set is
 * missing, helpers return null rather than fabricating a number.
 */

export interface CallUsage {
  promptTokens: number;
  completionTokens: number;
  calls: number;
  latencyMs: number;
}

export function totalTokens(u: { promptTokens: number; completionTokens: number }): number {
  return u.promptTokens + u.completionTokens;
}

export function sumUsage(usages: CallUsage[]): {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  calls: number;
  totalLatencyMs: number;
  meanLatencyMs: number;
} {
  const promptTokens = usages.reduce((s, u) => s + u.promptTokens, 0);
  const completionTokens = usages.reduce((s, u) => s + u.completionTokens, 0);
  const calls = usages.reduce((s, u) => s + u.calls, 0);
  const totalLatencyMs = usages.reduce((s, u) => s + u.latencyMs, 0);
  return {
    promptTokens,
    completionTokens,
    totalTokens: promptTokens + completionTokens,
    calls,
    totalLatencyMs,
    meanLatencyMs: usages.length ? totalLatencyMs / usages.length : 0,
  };
}

// ── Quality ──────────────────────────────────────────────────────

/**
 * Weighted mean of rubric scores, each in [0, 1]. Throws on an empty rubric
 * or out-of-range values — a quality score with no evidence is an error, not
 * a zero.
 */
export function qualityScore(
  scores: Record<string, number>,
  weights?: Record<string, number>,
): number {
  const keys = Object.keys(scores);
  if (keys.length === 0) {
    throw new Error("qualityScore requires at least one rubric score");
  }
  let sum = 0;
  let weightSum = 0;
  for (const key of keys) {
    const value = scores[key];
    if (!Number.isFinite(value) || value < 0 || value > 1) {
      throw new Error(`rubric score "${key}" must be in [0, 1], got ${value}`);
    }
    const w = weights?.[key] ?? 1;
    if (!Number.isFinite(w) || w < 0) {
      throw new Error(`rubric weight "${key}" must be a non-negative number, got ${w}`);
    }
    sum += value * w;
    weightSum += w;
  }
  if (weightSum === 0) {
    throw new Error("qualityScore weights sum to zero");
  }
  return sum / weightSum;
}

// ── Latency ──────────────────────────────────────────────────────

/** Nearest-rank percentile on an ascending-sorted array. */
function percentileNearestRank(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const rank = Math.max(1, Math.ceil((p / 100) * sorted.length));
  return sorted[rank - 1];
}

export function latencyStats(latenciesMs: number[]): {
  count: number;
  meanMs: number;
  p50Ms: number;
  p95Ms: number;
  minMs: number;
  maxMs: number;
} {
  if (latenciesMs.length === 0) {
    return { count: 0, meanMs: 0, p50Ms: 0, p95Ms: 0, minMs: 0, maxMs: 0 };
  }
  for (const v of latenciesMs) {
    if (!Number.isFinite(v) || v < 0) {
      throw new Error(`latency must be a non-negative finite number, got ${v}`);
    }
  }
  const sorted = [...latenciesMs].sort((a, b) => a - b);
  const total = sorted.reduce((s, v) => s + v, 0);
  return {
    count: sorted.length,
    meanMs: total / sorted.length,
    p50Ms: percentileNearestRank(sorted, 50),
    p95Ms: percentileNearestRank(sorted, 95),
    minMs: sorted[0],
    maxMs: sorted[sorted.length - 1],
  };
}

// ── Cost ─────────────────────────────────────────────────────────

/**
 * Price a usage record from an explicitly supplied rate table (USD per
 * million tokens), returning integer USD micros. Rates must come from the
 * configured pricing source — never from this module.
 */
export function costMicros(
  usage: { promptTokens: number; completionTokens: number },
  rate: { inputUsdPerMillion: number; outputUsdPerMillion: number },
): number {
  const usd =
    (usage.promptTokens * rate.inputUsdPerMillion +
      usage.completionTokens * rate.outputUsdPerMillion) /
    1_000_000;
  return usdToMicros(usd);
}

/**
 * USD micros per accepted artifact. Returns null when nothing was accepted —
 * cost-per-accepted is undefined (not zero, not infinity) with no accepted
 * output, and callers must surface that explicitly.
 */
export function costPerAcceptedArtifactMicros(
  totalCostMicros: number,
  acceptedArtifacts: number,
): number | null {
  if (!Number.isInteger(acceptedArtifacts) || acceptedArtifacts < 0) {
    throw new Error(`acceptedArtifacts must be a non-negative integer, got ${acceptedArtifacts}`);
  }
  if (acceptedArtifacts === 0) return null;
  return totalCostMicros / acceptedArtifacts;
}

// ── Reliability ──────────────────────────────────────────────────

/**
 * pass^k: probability that k independent repeated runs ALL succeed, estimated
 * from n trials with s successes as (s/n)^k. Used for repeated-run
 * reliability of a strategy (e.g., k consecutive dispatches must all pass).
 */
export function passPowK(successes: number, trials: number, k: number): number {
  if (!Number.isInteger(trials) || trials <= 0) {
    throw new Error(`trials must be a positive integer, got ${trials}`);
  }
  if (!Number.isInteger(successes) || successes < 0 || successes > trials) {
    throw new Error(`successes must be an integer in [0, trials], got ${successes}`);
  }
  if (!Number.isInteger(k) || k <= 0) {
    throw new Error(`k must be a positive integer, got ${k}`);
  }
  return Math.pow(successes / trials, k);
}

/**
 * pass@k: probability that AT LEAST ONE of k samples succeeds, estimated with
 * the unbiased combinatorial estimator 1 - C(n-s, k) / C(n, k). Returns null
 * when k > n (not estimable from the sample).
 */
export function passAtK(successes: number, trials: number, k: number): number | null {
  if (!Number.isInteger(trials) || trials <= 0) {
    throw new Error(`trials must be a positive integer, got ${trials}`);
  }
  if (!Number.isInteger(successes) || successes < 0 || successes > trials) {
    throw new Error(`successes must be an integer in [0, trials], got ${successes}`);
  }
  if (!Number.isInteger(k) || k <= 0) {
    throw new Error(`k must be a positive integer, got ${k}`);
  }
  if (k > trials) return null;
  if (successes === 0) return 0;
  // With k draws larger than the failure population, success is certain.
  // Guard before taking logs so perfect success and k > n-s never reach log(0).
  if (successes === trials || k > trials - successes) return 1;
  // log-space product for numeric stability: C(n-s, k) / C(n, k)
  let logRatio = 0;
  for (let i = 0; i < k; i++) {
    logRatio += Math.log(trials - successes - i) - Math.log(trials - i);
  }
  return 1 - Math.exp(logRatio);
}

export function reliabilitySummary(
  successes: number,
  trials: number,
  k: number,
): { successRate: number; passPowK: number; passAtK: number | null } {
  return {
    successRate: successes / trials,
    passPowK: passPowK(successes, trials, k),
    passAtK: passAtK(successes, trials, k),
  };
}

// ── Baseline comparison ──────────────────────────────────────────

/**
 * Delta of a measured value against a measured baseline. `relative` is null
 * when the baseline is zero — a relative delta would be fabricated. Both
 * values must be real measurements (e.g., direct_structured as baseline).
 */
export function baselineDelta(
  current: number,
  baseline: number,
): { absolute: number; relative: number | null } {
  if (!Number.isFinite(current) || !Number.isFinite(baseline)) {
    throw new Error("baselineDelta requires finite measured values");
  }
  return {
    absolute: current - baseline,
    relative: baseline === 0 ? null : (current - baseline) / baseline,
  };
}
