import type { ModelInfo, OllamaStatus } from '../shared/contract';
import type { FetchLike, GenerateRequest, GenerateResult } from './providers';

/**
 * Optional Ollama integration.
 *
 * Scope, deliberately narrow:
 *  - Loopback ONLY. The base URL defaults to http://127.0.0.1:11434 and any
 *    non-loopback host is rejected; this shell never talks to remote Ollama
 *    hosts.
 *  - Detection + model listing via GET /api/tags, and text generation via
 *    POST /api/generate for models the user has ALREADY pulled.
 *  - No automatic pulls, no model execution/management: the shell only sends
 *    generation requests to a server the user started themselves.
 */

export const OLLAMA_DEFAULT_BASE_URL = 'http://127.0.0.1:11434';

/** Accept only loopback Ollama base URLs; throw on anything remote. */
export function assertLoopbackOllamaUrl(rawUrl: string): string {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error('Invalid Ollama URL');
  }
  if (url.protocol !== 'http:') {
    throw new Error('Ollama URL must use http:// (loopback only)');
  }
  const host = url.hostname;
  if (host !== '127.0.0.1' && host !== 'localhost' && host !== '::1' && host !== '[::1]') {
    throw new Error('Remote Ollama hosts are not allowed; only 127.0.0.1/localhost are supported');
  }
  return url.origin;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

/** Detect a locally running Ollama and list its downloaded models. */
export async function detectOllama(
  fetchFn: FetchLike = fetch,
  baseUrl: string = OLLAMA_DEFAULT_BASE_URL,
): Promise<OllamaStatus> {
  let base: string;
  try {
    base = assertLoopbackOllamaUrl(baseUrl);
  } catch (err) {
    return {
      available: false,
      baseUrl,
      models: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }
  try {
    const res = await fetchFn(`${base}/api/tags`);
    if (!res.ok) {
      return { available: false, baseUrl: base, models: [], error: `Ollama returned HTTP ${res.status}` };
    }
    const body: unknown = await res.json();
    const raw = isRecord(body) && Array.isArray(body.models) ? body.models : [];
    const models: ModelInfo[] = [];
    for (const entry of raw) {
      if (isRecord(entry) && typeof entry.name === 'string') {
        models.push({ id: entry.name, label: entry.name });
      }
    }
    return { available: true, baseUrl: base, models, error: null };
  } catch {
    return {
      available: false,
      baseUrl: base,
      models: [],
      error: 'Ollama is not reachable at 127.0.0.1:11434. Start it yourself (e.g. `ollama serve`) and pull a model; this shell never installs or starts Ollama.',
    };
  }
}

/**
 * Text generation against an already-running local Ollama. One request, no
 * streaming, no retries. Aborts propagate from the caller's AbortSignal.
 */
export async function generateWithOllama(
  req: GenerateRequest,
  fetchFn: FetchLike = fetch,
  baseUrl: string = OLLAMA_DEFAULT_BASE_URL,
): Promise<GenerateResult> {
  const base = assertLoopbackOllamaUrl(baseUrl);
  const res = await fetchFn(`${base}/api/generate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      model: req.model,
      prompt: req.system ? `${req.system}\n\n${req.prompt}` : req.prompt,
      stream: false,
      options: { num_predict: req.maxOutputTokens },
    }),
    ...(req.abortSignal !== undefined ? { signal: req.abortSignal } : {}),
  });
  if (!res.ok) {
    throw new Error(`Ollama generation failed with HTTP ${res.status}`);
  }
  const body: unknown = await res.json();
  if (!isRecord(body) || typeof body.response !== 'string') {
    throw new Error('Ollama returned an unexpected response shape');
  }
  return {
    text: body.response,
    inputTokens: typeof body.prompt_eval_count === 'number' ? body.prompt_eval_count : 0,
    outputTokens: typeof body.eval_count === 'number' ? body.eval_count : 0,
  };
}
