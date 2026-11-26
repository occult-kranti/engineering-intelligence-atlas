import { describe, expect, it } from 'vitest';
import {
  assertLoopbackOllamaUrl,
  detectOllama,
  generateWithOllama,
  OLLAMA_DEFAULT_BASE_URL,
  assertLocalOllamaModel,
  canonicalLocalModel,
  QWEN_CODER_MOE_MODEL,
} from '../src/main/ollama';

function fakeResponse(body: unknown, ok = true, status = 200): Response {
  return { ok, status, json: async () => body } as unknown as Response;
}

describe('Ollama loopback policy', () => {
  it('accepts only loopback hosts over http', () => {
    expect(assertLoopbackOllamaUrl('http://127.0.0.1:11434')).toBe('http://127.0.0.1:11434');
    expect(assertLoopbackOllamaUrl('http://localhost:11434')).toBe('http://localhost:11434');
    expect(() => assertLoopbackOllamaUrl('http://192.168.1.10:11434')).toThrow(/Remote Ollama/);
    expect(() => assertLoopbackOllamaUrl('https://ollama.example.com')).toThrow();
    expect(() => assertLoopbackOllamaUrl('not a url')).toThrow(/Invalid/);
  });

  it('defaults to 127.0.0.1', () => {
    expect(OLLAMA_DEFAULT_BASE_URL).toBe('http://127.0.0.1:11434');
  });

  it('rejects URL aliases, credentials, paths and cloud model aliases', () => {
    for (const value of ['http://127.1:11434', 'http://user:pass@localhost:11434', 'http://localhost:11434/proxy', 'http://localhost:11434?target=cloud', 'http://localhost:11434/#x']) expect(() => assertLoopbackOllamaUrl(value)).toThrow();
    for (const value of ['gpt-oss:120b-cloud', 'qwen3:8b-Cloud', 'cloud/model:latest', 'https://ollama.com/model', '../qwen3:8b']) expect(() => canonicalLocalModel(value)).toThrow();
    expect(canonicalLocalModel(QWEN_CODER_MOE_MODEL)).toBe(QWEN_CODER_MOE_MODEL);
  });
});

describe('Ollama detection', () => {
  it('reports unavailable when nothing is listening', async () => {
    const fetchFn = async () => {
      throw new Error('fetch failed: ECONNREFUSED');
    };
    const status = await detectOllama(fetchFn as typeof fetch);
    expect(status.available).toBe(false);
    expect(status.models).toEqual([]);
    expect(status.error).toMatch(/not reachable/);
    expect(status.baseUrl).toBe('http://127.0.0.1:11434');
  });

  it('lists downloaded models when running', async () => {
    const fetchFn = async (url: unknown) => {
      expect(String(url)).toBe('http://127.0.0.1:11434/api/tags');
      return fakeResponse({ models: [{ name: 'qwen3:8b' }, { name: 'llama3.1:8b' }] });
    };
    const status = await detectOllama(fetchFn as typeof fetch);
    expect(status.available).toBe(true);
    expect(status.error).toBeNull();
    expect(status.models.map((m) => m.id)).toEqual(['qwen3:8b', 'llama3.1:8b']);
  });

  it('reports HTTP failures', async () => {
    const fetchFn = async () => fakeResponse({}, false, 500);
    const status = await detectOllama(fetchFn as typeof fetch);
    expect(status.available).toBe(false);
    expect(status.error).toMatch(/HTTP 500/);
  });
});

describe('Ollama generation', () => {
  it('verifies local metadata, sends one non-streaming generation and maps observed counts', async () => {
    let seen: { url: string; body: Record<string, unknown> } | null = null;
    const fetchFn = async (url: unknown, init?: unknown) => {
      if (String(url).endsWith('/api/show')) return fakeResponse({ model_info: { 'general.architecture': 'qwen3' } });
      const i = init as { body: string; method: string };
      seen = { url: String(url), body: JSON.parse(i.body) as Record<string, unknown> };
      expect(i.method).toBe('POST');
      return fakeResponse({ response: 'local answer', prompt_eval_count: 42, eval_count: 9 });
    };
    const result = await generateWithOllama(
      { model: 'qwen3:8b', system: 'be terse', prompt: 'hi', maxOutputTokens: 64 },
      fetchFn as typeof fetch,
    );
    expect(result).toEqual({ text: 'local answer', inputTokens: 42, outputTokens: 9, usageObserved: true });
    expect(seen?.url).toBe('http://127.0.0.1:11434/api/generate');
    expect(seen?.body.stream).toBe(false);
    expect(seen?.body.model).toBe('qwen3:8b');
    expect((seen?.body.options as { num_predict: number }).num_predict).toBe(64);
    expect((seen?.body.options as { num_ctx: number }).num_ctx).toBe(4096);
  });

  it('refuses remote hosts even when explicitly passed', async () => {
    const fetchFn = async () => fakeResponse({});
    await expect(
      generateWithOllama({ model: 'm', prompt: 'p', maxOutputTokens: 1 }, fetchFn as typeof fetch, 'http://10.0.0.5:11434'),
    ).rejects.toThrow(/Remote Ollama/);
  });

  it('surfaces HTTP errors', async () => {
    const fetchFn = async () => fakeResponse({}, false, 404);
    await expect(generateWithOllama({ model: 'missing', prompt: 'p', maxOutputTokens: 1 }, fetchFn as typeof fetch)).rejects.toThrow(/HTTP 404/);
  });

  it('marks missing usage as unobserved instead of claiming zero measured tokens', async () => {
    const fetchFn = async (url: unknown) => fakeResponse(String(url).endsWith('/api/show') ? { model_info: { arch: 'local' } } : { response: 'No counts returned', done: true });
    expect(await generateWithOllama({ model: 'qwen3:8b', prompt: 'p', maxOutputTokens: 5 }, fetchFn as typeof fetch)).toMatchObject({ usageObserved: false });
  });

  it('bounds context explicitly before any model call instead of allowing silent truncation', async () => {
    let calls = 0;
    const fetchFn = async () => { calls++; return fakeResponse({}); };
    await expect(generateWithOllama({ model: 'qwen3:8b', prompt: 'x'.repeat(32768), maxOutputTokens: 5 }, fetchFn as typeof fetch)).rejects.toThrow(/context bound/);
    expect(calls).toBe(0);
  });

  it('refuses cloud metadata and unknown local metadata before generation', async () => {
    for (const metadata of [{ remote_host: 'https://ollama.com', model_info: { arch: 'remote' } }, { model_info: {} }, { details: { remote_model: 'paid' }, model_info: { arch: 'local' } }]) {
      await expect(assertLocalOllamaModel('qwen3:8b', (async () => fakeResponse(metadata)) as typeof fetch)).rejects.toThrow(/remote or unverified/);
    }
  });

  it('fixes the reviewed MoE request at 8192 context and admits the complete boundary', async () => {
    const requests: Record<string, unknown>[] = [];
    const fetchFn = async (url: unknown, init?: RequestInit) => {
      if (String(url).endsWith('/api/show')) return fakeResponse({ model_info: { 'general.architecture': 'qwen3moe' } });
      requests.push(JSON.parse(String(init?.body)));
      return fakeResponse({ response: 'fixture', done: true, prompt_eval_count: 1, eval_count: 1 });
    };
    for (const prompt of ['short task', 'x'.repeat(8192 - 1024 - 128)]) {
      await generateWithOllama({ model: QWEN_CODER_MOE_MODEL, prompt, maxOutputTokens: 128 }, fetchFn as typeof fetch);
    }
    expect(requests).toHaveLength(2);
    for (const request of requests) expect(request).toMatchObject({ model: QWEN_CODER_MOE_MODEL, options: { num_ctx: 8192, num_predict: 128 } });
  });

  it('rejects MoE prompt, system, UTF-8 and output overflow before metadata or inference', async () => {
    let calls = 0;
    const fetchFn = async () => { calls++; return fakeResponse({}); };
    for (const request of [
      { prompt: 'x'.repeat(8192 - 1024 - 128 + 1), maxOutputTokens: 128 },
      { prompt: 'task', maxOutputTokens: 8192 },
      { system: 'x'.repeat(7000), prompt: 'task', maxOutputTokens: 256 },
      { prompt: '界'.repeat(2400), maxOutputTokens: 1 },
    ]) await expect(generateWithOllama({ model: QWEN_CODER_MOE_MODEL, ...request }, fetchFn as typeof fetch)).rejects.toThrow(/8192-token conservative context bound/);
    expect(calls).toBe(0);
  });
});
