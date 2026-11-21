import { generateObject } from "ai";
import type { z } from "zod";
import {
  classifyAiError,
  AiMisconfigured,
  type ModelList,
} from "./ai-client";
import { listGatewayModels } from "./list-models";
import type { ProviderId, UsageRecord } from "@contracts/run";

/**
 * ModelProvider seam (spec §8.6, extended per product decision): every model
 * call in the product flows through this interface. Implementations:
 *   - mock      deterministic, offline, free — default for unconfigured sites
 *   - gateway   platform Kimi gateway (pinned ai-client.ts factory)
 *   - openai    direct OpenAI via @ai-sdk/openai (server env keys only)
 *   - anthropic direct Anthropic via @ai-sdk/anthropic (server env keys only)
 *
 * Hard rules enforced here:
 *   - provider credentials are read from process.env only, never accepted from
 *     client input, never logged, never returned to the browser;
 *   - no automatic retry of billable calls: every SDK call sets maxRetries: 0
 *     (a 5xx/timeout does not prove the provider skipped the billed work);
 *   - gateway model ids come from listModels() at runtime, never hardcoded.
 */

export interface StructuredRequest {
  system: string;
  prompt: string;
  schema: z.ZodType;
  maxOutputTokens: number;
  /** Live gateway: must be an id returned by listModels(). Direct providers: env model. */
  model?: string;
  /** Mock provider rendering hint: the artifact type being produced. */
  artifactType?: string;
  /** Elapsed-time deadline enforcement: aborts the in-flight call, never retried. */
  signal?: AbortSignal;
  /**
   * Run/proposal owner. For openai/anthropic the adapter first tries the
   * owner's vault credential (decrypted server-side, in-memory only) and
   * falls back to the server env key. Gateway/mock ignore this.
   */
  ownerId?: number;
}

export interface StructuredResponse<T = unknown> {
  object: T;
  usage: UsageRecord;
  provider: ProviderId;
  model: string;
}

export interface ProviderAvailability {
  id: ProviderId;
  configured: boolean;
  /** Plain-language reason when unconfigured. Never contains secrets. */
  reason?: string;
}

export interface ModelProvider {
  id: ProviderId;
  availability(): ProviderAvailability;
  /**
   * Owner-aware availability (direct providers only): additionally true when
   * the owner has a usable vault credential, even without an env key. Other
   * providers inherit the env-based answer.
   */
  availabilityFor?(ownerId: number): Promise<ProviderAvailability>;
  listModels(ownerId?: number): Promise<ModelList>;
  generateStructured(req: StructuredRequest): Promise<StructuredResponse>;
}

function envOf(key: string): string | undefined {
  const v = process.env[key];
  return v && v.trim() !== "" ? v : undefined;
}

/**
 * Direct-provider credential resolution: owner's vault record first,
 * server env second. The decrypted key never leaves the call frame.
 */
async function resolveDirectKey(
  provider: "openai" | "anthropic",
  envKey: string,
  ownerId?: number,
): Promise<string | undefined> {
  if (ownerId !== undefined) {
    try {
      const { resolveVaultApiKey } = await import("../integrations/store");
      const vaultKey = await resolveVaultApiKey(provider, ownerId);
      if (vaultKey) return vaultKey;
    } catch {
      // Vault unavailable/undecryptable → fall through to env (fail safe,
      // never fail open to a different owner's credential).
    }
  }
  return envOf(envKey);
}

async function directAvailability(
  provider: "openai" | "anthropic",
  keyEnv: string,
  modelEnv: string,
  ownerId?: number,
): Promise<ProviderAvailability> {
  const key = await resolveDirectKey(provider, keyEnv, ownerId);
  const model = envOf(modelEnv);
  const ok = !!(key && model);
  return {
    id: provider,
    configured: ok,
    reason: ok
      ? undefined
      : !key
        ? `No ${provider} credential: store one in Integration Settings or set ${keyEnv} in the server environment.`
        : `${modelEnv} is not set in the server environment.`,
  };
}

function toUsage(raw: unknown): UsageRecord {
  const u = (raw ?? {}) as Record<string, unknown>;
  const num = (x: unknown) => (typeof x === "number" && Number.isFinite(x) ? x : 0);
  // AI SDK 5/6 names (inputTokens/outputTokens) with legacy fallbacks.
  const prompt = num(u.inputTokens) || num(u.promptTokens);
  const completion = num(u.outputTokens) || num(u.completionTokens);
  return {
    promptTokens: prompt,
    completionTokens: completion,
    calls: 1,
    costUsdMicros: 0, // priced by the engine via owner/env rates, never guessed here
    simulated: false,
  };
}

// ── Gateway (platform Kimi gateway) ──────────────────────────────

function gatewayProvider(): ModelProvider {
  return {
    id: "gateway",
    availability() {
      const ok = !!(envOf("KIMI_AGENTGW_API_KEY") && envOf("KIMI_AGENTGW_BASE_URL"));
      return {
        id: "gateway",
        configured: ok,
        reason: ok
          ? undefined
          : "Platform gateway is not provisioned for this site (publish or reopen the site once, then retry).",
      };
    },
    async listModels() {
      return listGatewayModels();
    },
    async generateStructured(req) {
      // Model ids are never hardcoded: resolve through runtime discovery.
      let modelId = req.model;
      if (!modelId) {
        const list = await listGatewayModels();
        modelId = list.defaultModelId;
      }
      if (!modelId) {
        throw new AiMisconfigured("gateway returned no usable model id");
      }
      const { kimiGw } = await import("./provider-factory");
      try {
        const result = await generateObject({
          model: kimiGw(modelId),
          schema: req.schema,
          system: req.system,
          prompt: req.prompt,
          maxOutputTokens: req.maxOutputTokens,
          maxRetries: 0, // billable call: never auto-retry
          abortSignal: req.signal,
        });
        return {
          object: result.object,
          usage: toUsage(result.usage),
          provider: "gateway",
          model: modelId,
        };
      } catch (err) {
        throw classifyAiError(err);
      }
    },
  };
}

// ── Direct OpenAI ────────────────────────────────────────────────

function openaiProvider(): ModelProvider {
  return {
    id: "openai",
    availability() {
      const key = envOf("OPENAI_API_KEY");
      const model = envOf("OPENAI_MODEL");
      const ok = !!(key && model);
      return {
        id: "openai",
        configured: ok,
        reason: ok
          ? undefined
          : !key
            ? "OPENAI_API_KEY is not set in the server environment."
            : "OPENAI_MODEL is not set in the server environment.",
      };
    },
    availabilityFor(ownerId) {
      return directAvailability("openai", "OPENAI_API_KEY", "OPENAI_MODEL", ownerId);
    },
    async listModels(ownerId?: number): Promise<ModelList> {
      const model = envOf("OPENAI_MODEL");
      const key = await resolveDirectKey("openai", "OPENAI_API_KEY", ownerId);
      if (!key || !model) {
        throw new AiMisconfigured(
          "no OpenAI credential (vault or OPENAI_API_KEY) / OPENAI_MODEL not set",
        );
      }
      // Direct-provider model identity comes from the operator's env, never
      // from a hardcoded default.
      return { models: [{ id: model }], defaultModelId: model };
    },
    async generateStructured(req) {
      const key = await resolveDirectKey("openai", "OPENAI_API_KEY", req.ownerId);
      const modelId = req.model ?? envOf("OPENAI_MODEL");
      if (!key || !modelId) {
        throw new AiMisconfigured(
          "no OpenAI credential (vault or OPENAI_API_KEY) / OPENAI_MODEL not set",
        );
      }
      const { createOpenAI } = await import("@ai-sdk/openai");
      const openai = createOpenAI({ apiKey: key });
      try {
        const result = await generateObject({
          model: openai(modelId),
          schema: req.schema,
          system: req.system,
          prompt: req.prompt,
          maxOutputTokens: req.maxOutputTokens,
          maxRetries: 0, // billable call: never auto-retry
          abortSignal: req.signal,
        });
        return {
          object: result.object,
          usage: toUsage(result.usage),
          provider: "openai",
          model: modelId,
        };
      } catch (err) {
        throw classifyAiError(err);
      }
    },
  };
}

// ── Direct Anthropic ─────────────────────────────────────────────

function anthropicProvider(): ModelProvider {
  return {
    id: "anthropic",
    availability() {
      const key = envOf("ANTHROPIC_API_KEY");
      const model = envOf("ANTHROPIC_MODEL");
      const ok = !!(key && model);
      return {
        id: "anthropic",
        configured: ok,
        reason: ok
          ? undefined
          : !key
            ? "ANTHROPIC_API_KEY is not set in the server environment."
            : "ANTHROPIC_MODEL is not set in the server environment.",
      };
    },
    availabilityFor(ownerId) {
      return directAvailability("anthropic", "ANTHROPIC_API_KEY", "ANTHROPIC_MODEL", ownerId);
    },
    async listModels(ownerId?: number): Promise<ModelList> {
      const model = envOf("ANTHROPIC_MODEL");
      const key = await resolveDirectKey("anthropic", "ANTHROPIC_API_KEY", ownerId);
      if (!key || !model) {
        throw new AiMisconfigured(
          "no Anthropic credential (vault or ANTHROPIC_API_KEY) / ANTHROPIC_MODEL not set",
        );
      }
      return { models: [{ id: model }], defaultModelId: model };
    },
    async generateStructured(req) {
      const key = await resolveDirectKey("anthropic", "ANTHROPIC_API_KEY", req.ownerId);
      const modelId = req.model ?? envOf("ANTHROPIC_MODEL");
      if (!key || !modelId) {
        throw new AiMisconfigured(
          "no Anthropic credential (vault or ANTHROPIC_API_KEY) / ANTHROPIC_MODEL not set",
        );
      }
      const { createAnthropic } = await import("@ai-sdk/anthropic");
      const anthropic = createAnthropic({ apiKey: key });
      try {
        const result = await generateObject({
          model: anthropic(modelId),
          schema: req.schema,
          system: req.system,
          prompt: req.prompt,
          maxOutputTokens: req.maxOutputTokens,
          maxRetries: 0, // billable call: never auto-retry
          abortSignal: req.signal,
        });
        return {
          object: result.object,
          usage: toUsage(result.usage),
          provider: "anthropic",
          model: modelId,
        };
      } catch (err) {
        throw classifyAiError(err);
      }
    },
  };
}

// ── Mock (deterministic, offline) ────────────────────────────────

async function mockProvider(): Promise<ModelProvider> {
  const { mockGenerateStructured } = await import("../engine/mock");
  return {
    id: "mock",
    availability: () => ({ id: "mock", configured: true }),
    listModels: async (): Promise<ModelList> => ({
      models: [{ id: "mock-deterministic", displayName: "Deterministic mock (no billing)" }],
      defaultModelId: "mock-deterministic",
    }),
    generateStructured: (req) => mockGenerateStructured(req),
  };
}

const providers: Partial<Record<ProviderId, ModelProvider>> = {};

export async function getProvider(id: ProviderId): Promise<ModelProvider> {
  if (!providers[id]) {
    providers[id] =
      id === "mock"
        ? await mockProvider()
        : id === "gateway"
          ? gatewayProvider()
          : id === "openai"
            ? openaiProvider()
            : anthropicProvider();
  }
  return providers[id]!;
}

/** Availability booleans for the UI — never leaks keys or urls. */
export function providerAvailability(): ProviderAvailability[] {
  return [
    { id: "mock", configured: true },
    gatewayProvider().availability(),
    openaiProvider().availability(),
    anthropicProvider().availability(),
  ];
}

/** Default live provider: platform gateway when provisioned. */
export function defaultLiveProvider(): ProviderId {
  if (envOf("KIMI_AGENTGW_API_KEY") && envOf("KIMI_AGENTGW_BASE_URL")) return "gateway";
  if (envOf("OPENAI_API_KEY") && envOf("OPENAI_MODEL")) return "openai";
  if (envOf("ANTHROPIC_API_KEY") && envOf("ANTHROPIC_MODEL")) return "anthropic";
  return "gateway"; // surfaces its availability reason when used
}
