import { describe, expect, it } from 'vitest';
import {
  assertLoopbackOllamaUrl,
  detectOllama,
  generateWithOllama,
  OLLAMA_DEFAULT_BASE_URL,
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
  it('sends one non-streaming request and maps eval counts', async () => {
    let seen: { url: string; body: Record<string, unknown> } | null = null;
    const fetchFn = async (url: unknown, init?: unknown) => {
      const i = init as { body: string; method: string };
      seen = { url: String(url), body: JSON.parse(i.body) as Record<string, unknown> };
      expect(i.method).toBe('POST');
      return fakeResponse({ response: 'local answer', prompt_eval_count: 42, eval_count: 9 });
    };
    const result = await generateWithOllama(
      { model: 'qwen3:8b', system: 'be terse', prompt: 'hi', maxOutputTokens: 64 },
      fetchFn as typeof fetch,
    );
    expect(result).toEqual({ text: 'local answer', inputTokens: 42, outputTokens: 9 });
    expect(seen?.url).toBe('http://127.0.0.1:11434/api/generate');
    expect(seen?.body.stream).toBe(false);
    expect(seen?.body.model).toBe('qwen3:8b');
    expect((seen?.body.options as { num_predict: number }).num_predict).toBe(64);
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
});
