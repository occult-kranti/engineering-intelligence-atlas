import type { ApiProvider, ModelInfo } from '../shared/contract';
import { isApiProvider } from './vault';

/**
 * Direct OpenAI / Anthropic provider adapters, built on the pinned Vercel AI
 * SDK packages (`ai@6`, `@ai-sdk/openai@3`, `@ai-sdk/anthropic@3`). There is
 * no hand-written chat client here: text generation always goes through the
 * SDK's `generateText` with `maxRetries: 0` — this shell never retries a
 * billed request automatically.
 *
 * Model lists come from live discovery calls against the official provider
 * APIs (`GET /v1/models`); the shell ships no fake/static model list.
 *
 * Keys are passed in by the caller (main process vault) and are never logged
 * or included in errors: every thrown error is sanitized to strip key
 * material before propagation.
 */

export interface GenerateRequest {
  model: string;
  system?: string;
  prompt: string;
  maxOutputTokens: number;
  abortSignal?: AbortSignal;
}

export interface GenerateResult {
  text: string;
  inputTokens: number;
  outputTokens: number;
  /** Missing or invalid provider usage is not evidence of a free call. */
  usageObserved?: boolean;
}

/** Narrow structural view of the AI SDK surface we use (injectable in tests). */
export interface AiSdkLike {
  createOpenAI(options: { apiKey: string }): (modelId: string) => unknown;
  createAnthropic(options: { apiKey: string }): (modelId: string) => unknown;
  generateText(options: {
    model: unknown;
    system?: string;
    prompt: string;
    maxOutputTokens?: number;
    maxRetries: number;
    abortSignal?: AbortSignal;
    providerOptions?: Record<string, Record<string, unknown>>;
  }): Promise<{ text: string; usage: { inputTokens?: number; outputTokens?: number } }>;
}

export type FetchLike = typeof fetch;

let cachedSdk: AiSdkLike | null = null;

/** Lazily load the real, pinned AI SDK packages. */
export function loadAiSdk(): AiSdkLike {
  if (!cachedSdk) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { createOpenAI } = require('@ai-sdk/openai') as typeof import('@ai-sdk/openai');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { createAnthropic } = require('@ai-sdk/anthropic') as typeof import('@ai-sdk/anthropic');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { generateText } = require('ai') as typeof import('ai');
    cachedSdk = {
      createOpenAI: (opts) => {
        const provider = createOpenAI(opts);
        return (modelId) => provider(modelId);
      },
      createAnthropic: (opts) => {
        const provider = createAnthropic(opts);
        return (modelId) => provider(modelId);
      },
      generateText: (options) =>
        generateText(options as Parameters<typeof generateText>[0]) as Promise<{
          text: string;
          usage: { inputTokens?: number; outputTokens?: number };
        }>,
    };
  }
  return cachedSdk;
}

/** Remove any occurrence of the key (and common wrapper forms) from a message. */
export function sanitizeError(err: unknown, apiKey: string): Error {
  const raw = err instanceof Error ? err.message : String(err);
  let message = raw;
  if (apiKey.length > 0) {
    message = message.split(apiKey).join('[redacted]');
  }
  // Also redact anything that looks like an OpenAI/Anthropic key, in case a
  // library echoes a different credential.
  message = message.replace(/sk-[A-Za-z0-9_-]{8,}/g, '[redacted]');
  if (message.length > 300) message = `${message.slice(0, 300)}…`;
  const safe = new Error(message);
  safe.name = 'ProviderError';
  return safe;
}

/** Model ids that cannot serve chat/text generation; filtered from OpenAI's list. */
const OPENAI_NON_CHAT = /(embedding|whisper|tts|dall-e|moderation|audio|image|babbage|davinci|omni-moderation)/i;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

/** Live model discovery against the official provider APIs. No static list. */
export async function listProviderModels(
  provider: ApiProvider,
  apiKey: string,
  fetchFn: FetchLike = fetch,
): Promise<ModelInfo[]> {
  if (!isApiProvider(provider)) throw new Error(`unknown provider: ${String(provider)}`);
  if (provider === 'openai') {
    let res: Awaited<ReturnType<FetchLike>>;
    try {
      res = await fetchFn('https://api.openai.com/v1/models', {
        headers: { authorization: `Bearer ${apiKey}` },
      });
    } catch (err) {
      throw sanitizeError(err, apiKey);
    }
    if (!res.ok) throw new Error(`OpenAI model list failed with HTTP ${res.status}`);
    const body: unknown = await res.json();
    const data = isRecord(body) && Array.isArray(body.data) ? body.data : [];
    const models: ModelInfo[] = [];
    for (const entry of data) {
      if (isRecord(entry) && typeof entry.id === 'string' && !OPENAI_NON_CHAT.test(entry.id)) {
        models.push({ id: entry.id, label: entry.id });
      }
    }
    return models.sort((a, b) => a.id.localeCompare(b.id));
  }

  // anthropic
  let res: Awaited<ReturnType<FetchLike>>;
  try {
    res = await fetchFn('https://api.anthropic.com/v1/models', {
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    });
  } catch (err) {
    throw sanitizeError(err, apiKey);
  }
  if (!res.ok) throw new Error(`Anthropic model list failed with HTTP ${res.status}`);
  const body: unknown = await res.json();
  const data = isRecord(body) && Array.isArray(body.data) ? body.data : [];
  const models: ModelInfo[] = [];
  for (const entry of data) {
    if (isRecord(entry) && typeof entry.id === 'string') {
      const label = typeof entry.display_name === 'string' ? entry.display_name : entry.id;
      models.push({ id: entry.id, label });
    }
  }
  return models.sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * One-shot text generation via the AI SDK. Exactly one provider HTTP request
 * is made per call (`maxRetries: 0`); no streaming, no tool use.
 */
export async function generateWithProvider(
  provider: ApiProvider,
  apiKey: string,
  req: GenerateRequest,
  sdk: AiSdkLike = loadAiSdk(),
): Promise<GenerateResult> {
  if (!isApiProvider(provider)) throw new Error(`unknown provider: ${String(provider)}`);
  try {
    const factory = provider === 'openai' ? sdk.createOpenAI : sdk.createAnthropic;
    const model = factory({ apiKey })(req.model);
    const result = await sdk.generateText({
      model,
      ...(req.system !== undefined ? { system: req.system } : {}),
      prompt: req.prompt,
      maxOutputTokens: req.maxOutputTokens,
      maxRetries: 0, // never auto-retry a billed request
      ...(provider === 'anthropic' && /^claude-(?:sonnet|opus)-5-5(?:-|$)/.test(req.model)
        ? { providerOptions: { anthropic: { thinking: { type: 'between_tools' }, effort: 'medium' } } }
        : {}),
      ...(req.abortSignal !== undefined ? { abortSignal: req.abortSignal } : {}),
    });
    return {
      text: result.text,
      inputTokens: result.usage.inputTokens ?? 0,
      outputTokens: result.usage.outputTokens ?? 0,
      ...([result.usage.inputTokens, result.usage.outputTokens].every(n => typeof n === 'number' && Number.isSafeInteger(n) && n >= 0) ? {} : { usageObserved: false }),
    };
  } catch (err) {
    throw sanitizeError(err, apiKey);
  }
}
