import { createHash } from "node:crypto";
import type { SystemModelMessage } from "ai";
import type { ProviderId, UsageRecord } from "@contracts/run";

export interface PromptCachePolicy { enabled: boolean }

/** A provider hint, never a claim that a prefix was cached or a result can be replayed. */
export function providerPromptCache(
  provider: ProviderId,
  model: string,
  system: string,
  ownerId?: number,
  policy?: PromptCachePolicy,
  explicitModels = process.env.OPENAI_EXPLICIT_CACHE_MODELS ?? "",
): { system: string | SystemModelMessage; providerOptions?: Record<string, Record<string, string | { mode: string }>> } {
  if (!policy?.enabled || (provider !== "openai" && provider !== "anthropic")) return { system };
  if (provider === "anthropic") {
    return {
      system: {
        role: "system", content: system,
        providerOptions: { anthropic: { cacheControl: { type: "ephemeral" } } },
      },
    };
  }
  // Owner/provider/model/version/source separation without sending an owner id as a key.
  const key = createHash("sha256").update(JSON.stringify({
    version: "atlas-provider-prefix-v1", owner: ownerId ?? "server", provider, model, system,
  })).digest("hex");
  // Explicit breakpoints are model-specific. Operators opt in with exact model ids.
  const explicit = explicitModels.split(",").map((id) => id.trim()).includes(model);
  return {
    system: explicit ? {
      role: "system", content: system,
      providerOptions: { openai: { promptCacheBreakpoint: { mode: "explicit" } } },
    } : system,
    providerOptions: {
      openai: { promptCacheKey: key, ...(explicit ? { promptCacheOptions: { mode: "explicit" } } : {}) },
    },
  };
}

/** AI SDK inputTokens is already the normalized total, including Anthropic cache tokens. */
export function normalizeProviderUsage(raw: unknown): UsageRecord {
  const usage = (raw ?? {}) as Record<string, unknown>;
  const number = (value: unknown) => typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : undefined;
  const input = number(usage.inputTokens) ?? number(usage.promptTokens);
  const output = number(usage.outputTokens) ?? number(usage.completionTokens);
  const details = (usage.inputTokenDetails ?? {}) as Record<string, unknown>;
  const read = number(details.cacheReadTokens) ?? number(usage.cachedInputTokens);
  const write = number(details.cacheWriteTokens);
  return {
    promptTokens: input ?? 0,
    completionTokens: output ?? 0,
    ...(read !== undefined ? { cacheReadPromptTokens: read } : {}),
    ...(write !== undefined ? { cacheWritePromptTokens: write } : {}),
    cacheBreakdownComplete: input !== undefined && read !== undefined && write !== undefined && read + write <= input,
    usageReported: input !== undefined && output !== undefined,
    calls: 1,
    costUsdMicros: 0, // the engine supplies configured pricing or marks accounting unknown
    simulated: false,
  };
}
