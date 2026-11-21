import { describe, expect, it } from 'vitest';
import {
  generateWithProvider,
  listProviderModels,
  sanitizeError,
  type AiSdkLike,
} from '../src/main/providers';

const KEY = 'sk-live-secret-abcdef1234567890';

function fakeResponse(body: unknown, ok = true, status = 200): Response {
  return { ok, status, json: async () => body } as unknown as Response;
}

describe('provider model discovery (live list calls, fake fetch)', () => {
  it('lists OpenAI models and filters non-chat models', async () => {
    const fetchFn = async (url: unknown, init?: unknown) => {
      expect(String(url)).toBe('https://api.openai.com/v1/models');
      const headers = (init as { headers: Record<string, string> }).headers;
      expect(headers.authorization).toBe(`Bearer ${KEY}`);
      return fakeResponseWith({ data: [{ id: 'gpt-5-mini' }, { id: 'text-embedding-3-large' }, { id: 'gpt-5' }, { id: 'whisper-1' }] });
    };
    const models = await listProviderModels('openai', KEY, fetchFn as typeof fetch);
    expect(models.map((m) => m.id)).toEqual(['gpt-5', 'gpt-5-mini']);
  });

  it('lists Anthropic models with display names', async () => {
    const fetchFn = async (url: unknown, init?: unknown) => {
      expect(String(url)).toBe('https://api.anthropic.com/v1/models');
      const headers = (init as { headers: Record<string, string> }).headers;
      expect(headers['x-api-key']).toBe(KEY);
      expect(headers['anthropic-version']).toBe('2023-06-01');
      return fakeResponseWith({ data: [{ id: 'claude-opus-4', display_name: 'Claude Opus 4' }] });
    };
    const models = await listProviderModels('anthropic', KEY, fetchFn as typeof fetch);
    expect(models).toEqual([{ id: 'claude-opus-4', label: 'Claude Opus 4' }]);
  });

  it('surfaces HTTP errors without key material', async () => {
    const fetchFn = async () => fakeResponse({}, false, 401);
    await expect(listProviderModels('openai', KEY, fetchFn as typeof fetch)).rejects.toThrow('HTTP 401');
  });

  it('redacts the key from network error messages', async () => {
    const fetchFn = async () => {
      throw new Error(`connect failed; request had Authorization: Bearer ${KEY}`);
    };
    await expect(listProviderModels('openai', KEY, fetchFn as typeof fetch)).rejects.toThrow(/\[redacted\]/);
    await expect(listProviderModels('openai', KEY, fetchFn as typeof fetch)).rejects.not.toThrow(new RegExp(KEY));
  });
});

function fakeResponseWith(body: unknown): Response {
  return fakeResponse(body);
}

describe('generateWithProvider (AI SDK, injected fake)', () => {
  function makeSdk(behavior: (args: Record<string, unknown>) => Promise<{ text: string; usage: { inputTokens?: number; outputTokens?: number } }>) {
    const calls: Record<string, unknown>[] = [];
    const sdk: AiSdkLike = {
      createOpenAI: (opts) => {
        expect(opts.apiKey).toBe(KEY);
        return (modelId: string) => ({ provider: 'openai', modelId });
      },
      createAnthropic: (opts) => {
        expect(opts.apiKey).toBe(KEY);
        return (modelId: string) => ({ provider: 'anthropic', modelId });
      },
      generateText: async (args) => {
        calls.push(args as unknown as Record<string, unknown>);
        return behavior(args as unknown as Record<string, unknown>);
      },
    };
    return { sdk, calls };
  }

  it('calls generateText with maxRetries 0 and maps usage', async () => {
    const { sdk, calls } = makeSdk(async () => ({ text: 'hello', usage: { inputTokens: 11, outputTokens: 7 } }));
    const signal = new AbortController().signal;
    const result = await generateWithProvider(
      'openai',
      KEY,
      { model: 'gpt-5-mini', system: 'sys', prompt: 'do it', maxOutputTokens: 123, abortSignal: signal },
      sdk,
    );
    expect(result).toEqual({ text: 'hello', inputTokens: 11, outputTokens: 7 });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.maxRetries).toBe(0); // no automatic billed retries
    expect(calls[0]?.maxOutputTokens).toBe(123);
    expect(calls[0]?.abortSignal).toBe(signal);
    expect(calls[0]?.system).toBe('sys');
  });

  it('flags missing usage as unobserved so callers retain their reservation', async () => {
    const { sdk } = makeSdk(async () => ({ text: 'x', usage: {} }));
    const result = await generateWithProvider('anthropic', KEY, { model: 'claude', prompt: 'p', maxOutputTokens: 10 }, sdk);
    expect(result.inputTokens).toBe(0);
    expect(result.outputTokens).toBe(0);
    expect(result.usageObserved).toBe(false);
  });

  it('sanitizes provider errors so keys never leak', async () => {
    const { sdk } = makeSdk(async () => {
      throw new Error(`401 Unauthorized: invalid api key ${KEY} provided`);
    });
    await expect(
      generateWithProvider('openai', KEY, { model: 'm', prompt: 'p', maxOutputTokens: 1 }, sdk),
    ).rejects.toThrow(/\[redacted\]/);
    try {
      await generateWithProvider('openai', KEY, { model: 'm', prompt: 'p', maxOutputTokens: 1 }, sdk);
      expect.unreachable();
    } catch (err) {
      expect(String(err)).not.toContain(KEY);
    }
  });

  it('rejects unknown providers', async () => {
    const { sdk } = makeSdk(async () => ({ text: '', usage: {} }));
    await expect(
      generateWithProvider('ollama' as never, KEY, { model: 'm', prompt: 'p', maxOutputTokens: 1 }, sdk),
    ).rejects.toThrow(/unknown provider/);
  });
});

describe('sanitizeError', () => {
  it('redacts exact key and sk-* shaped strings', () => {
    const err = sanitizeError(new Error(`bad key ${KEY} and sk-ant-other-secret-123`), KEY);
    expect(err.message).not.toContain(KEY);
    expect(err.message).not.toContain('sk-ant-other-secret-123');
    expect(err.message).toContain('[redacted]');
  });
});
