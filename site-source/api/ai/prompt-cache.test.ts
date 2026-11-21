import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { normalizeProviderUsage, providerPromptCache } from "./prompt-cache";
import { assessUsagePrice, envRate } from "../engine/pricing";

const sdk = vi.hoisted(() => ({ generate: vi.fn(async (_input: unknown) => ({ object: { ok: true }, usage: { inputTokens: 1_000, outputTokens: 50, inputTokenDetails: { cacheReadTokens: 700, cacheWriteTokens: 100 } } })) }));
vi.mock("ai", () => ({ generateObject: sdk.generate }));
vi.mock("@ai-sdk/openai", () => ({ createOpenAI: () => (model: string) => ({ model }) }));
vi.mock("@ai-sdk/anthropic", () => ({ createAnthropic: () => (model: string) => ({ model }) }));
vi.mock("../integrations/store", () => ({ resolveVaultApiKey: async () => undefined }));
afterEach(() => { vi.unstubAllEnvs(); sdk.generate.mockClear(); });

describe("provider prefix cache policy", () => {
  it("leaves ordinary calls unchanged unless cache pricing enables the policy", () => {
    expect(providerPromptCache("openai", "model", "instructions", 1)).toEqual({ system: "instructions" });
    expect(providerPromptCache("gateway", "model", "instructions", 1, { enabled: true })).toEqual({ system: "instructions" });
  });

  it("scopes OpenAI keys by owner, model, and full prefix without exposing identifiers", () => {
    const hint = (owner: number, model = "m", text = "prefix") => providerPromptCache("openai", model, text, owner, { enabled: true }, "");
    const key = hint(1).providerOptions!.openai!.promptCacheKey;
    expect(key).toMatch(/^[a-f0-9]{64}$/);
    expect(hint(1).providerOptions!.openai!.promptCacheKey).toBe(key);
    expect(hint(2).providerOptions!.openai!.promptCacheKey).not.toBe(key);
    expect(hint(1, "other").providerOptions!.openai!.promptCacheKey).not.toBe(key);
    expect(hint(1, "m", "changed").providerOptions!.openai!.promptCacheKey).not.toBe(key);
    expect(hint(1).providerOptions!.openai).not.toHaveProperty("promptCacheOptions");
  });

  it("uses explicit breakpoints only for exact operator-approved model ids", () => {
    const actual = providerPromptCache("openai", "approved", "prefix", 1, { enabled: true }, " approved,another ");
    expect(actual.system).toMatchObject({ role: "system", providerOptions: { openai: { promptCacheBreakpoint: { mode: "explicit" } } } });
    expect(actual.providerOptions!.openai).toMatchObject({ promptCacheOptions: { mode: "explicit" } });
    expect(providerPromptCache("openai", "approved-later", "prefix", 1, { enabled: true }, "approved").system).toBe("prefix");
  });

  it("wires provider hints, zero SDK retries, and normalized usage through both adapters", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-local-only");
    vi.stubEnv("ANTHROPIC_API_KEY", "test-local-only");
    vi.stubEnv("OPENAI_EXPLICIT_CACHE_MODELS", "approved");
    const { getProvider } = await import("./provider");
    for (const id of ["openai", "anthropic"] as const) {
      const provider = await getProvider(id);
      const result = await provider.generateStructured({ system: "stable", prompt: "dynamic", schema: z.object({ ok: z.boolean() }), maxOutputTokens: 50, model: "approved", ownerId: 1, cachePolicy: { enabled: true } });
      expect(result.usage.promptTokens).toBe(1_000); // not 1,800: SDK total already includes cache
      expect(result.usage.cacheReadPromptTokens).toBe(700);
      expect(result.usage.cacheWritePromptTokens).toBe(100);
      const call = sdk.generate.mock.calls.at(-1)![0];
      expect(call).toMatchObject({ maxRetries: 0, prompt: "dynamic" });
      expect(call).toMatchObject(id === "anthropic"
        ? { system: { content: "stable", providerOptions: { anthropic: { cacheControl: { type: "ephemeral" } } } } }
        : { providerOptions: { openai: { promptCacheOptions: { mode: "explicit" } } } });
    }
  });
});

describe("usage and price reconciliation", () => {
  const rate = { inputUsdPerMillion: 3, outputUsdPerMillion: 15, cacheReadUsdPerMillion: 0.3, cacheWriteUsdPerMillion: 3.75, source: "env" as const };
  it("separates unknown telemetry from a genuine zero and rejects invalid breakdowns", () => {
    expect(normalizeProviderUsage({}).usageReported).toBe(false);
    expect(normalizeProviderUsage({ inputTokens: 0, promptTokens: 99, outputTokens: 0 })).toMatchObject({ usageReported: true, promptTokens: 0 });
    expect(normalizeProviderUsage({ inputTokens: -1, outputTokens: Number.NaN }).usageReported).toBe(false);
    expect(normalizeProviderUsage({ inputTokens: 10, outputTokens: 1, inputTokenDetails: { cacheReadTokens: 9, cacheWriteTokens: 9 } }).cacheBreakdownComplete).toBe(false);
  });
  it("prices each normalized input category exactly once", () => {
    const usage = normalizeProviderUsage({ inputTokens: 1_000, outputTokens: 50, inputTokenDetails: { cacheReadTokens: 700, cacheWriteTokens: 100 } });
    expect(assessUsagePrice(usage, rate, true)).toEqual({ costUsdMicros: 1935, status: "configured" });
  });
  it("uses the configured ceiling for an incomplete cached input breakdown", () => {
    const usage = normalizeProviderUsage({ inputTokens: 1_000, outputTokens: 50 });
    expect(assessUsagePrice(usage, rate, true)).toEqual({ costUsdMicros: 4500, status: "conservative" });
  });
  it("does not call missing usage or unpriced cache writes free", () => {
    expect(assessUsagePrice(normalizeProviderUsage({}), rate).status).toBe("unknown");
    const usage = normalizeProviderUsage({ inputTokens: 100, outputTokens: 5, inputTokenDetails: { cacheReadTokens: 0, cacheWriteTokens: 20 } });
    expect(assessUsagePrice(usage, { inputUsdPerMillion: 3, outputUsdPerMillion: 15, source: "env" }).status).toBe("unknown");
  });
  it("treats blank/invalid env rates as unconfigured while preserving explicit zero rates", () => {
    vi.stubEnv("OPENAI_INPUT_USD_PER_MILLION", "");
    vi.stubEnv("OPENAI_OUTPUT_USD_PER_MILLION", "");
    expect(envRate("openai")).toBeNull();
    vi.stubEnv("OPENAI_INPUT_USD_PER_MILLION", "0");
    vi.stubEnv("OPENAI_OUTPUT_USD_PER_MILLION", "2");
    expect(envRate("openai")).toMatchObject({ inputUsdPerMillion: 0, outputUsdPerMillion: 2 });
    vi.stubEnv("OPENAI_INPUT_USD_PER_MILLION", "Infinity");
    expect(envRate("openai")).toBeNull();
  });
});
