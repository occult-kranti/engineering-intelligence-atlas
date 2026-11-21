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
 *  - Shared model management lives in modelPool.ts. Generation additionally
 *    verifies local model metadata so a signed-in daemon cannot silently route
 *    a supposedly zero-token-price job to an Ollama cloud model.
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
  if (url.username || url.password || url.pathname !== '/' || url.search || url.hash || rawUrl.replace(/\/$/, '') !== url.origin) {
    throw new Error('Ollama URL must be a canonical loopback origin without credentials, paths, queries or fragments');
  }
  return url.origin;
}

/** Registry names, not URLs. Cloud-backed aliases cannot enter the local route. */
export function canonicalLocalModel(raw: string): string {
  if (typeof raw !== 'string' || raw.length > 160 || !/^[a-z0-9][a-z0-9_.-]*(?:\/[a-z0-9][a-z0-9_.-]*)?(?::[a-z0-9][a-z0-9_.-]*)?$/.test(raw)
      || /(?:^|[/:_.-])cloud(?:$|[/:_.-])/.test(raw)) throw new Error('Choose a local model reference; cloud aliases and registry URLs are not allowed');
  return raw.includes(':') ? raw : `${raw}:latest`;
}

export async function readOllamaJson(response: Response, limit = 2 * 1024 * 1024): Promise<Record<string, unknown>> {
  if (!response.ok) { await response.body?.cancel(); throw new Error(`Ollama returned HTTP ${response.status}`); }
  let value: unknown;
  if (response.body?.getReader) {
    const reader = response.body.getReader(); const parts: Uint8Array[] = []; let size = 0;
    try {
      for (;;) {
        const item = await reader.read(); if (item.done) break;
        size += item.value.byteLength;
        if (size > limit) { await reader.cancel(); throw new Error('Ollama response exceeds its limit'); }
        parts.push(item.value);
      }
      value = JSON.parse(Buffer.concat(parts).toString('utf8'));
    } finally { reader.releaseLock(); }
  } else {
    value = await response.json(); // injectable response fixtures
    if (Buffer.byteLength(JSON.stringify(value)) > limit) throw new Error('Ollama response exceeds its limit');
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Ollama returned invalid metadata');
  return value as Record<string, unknown>;
}

/** Metadata is inspected but never returned: show can include local paths. */
export async function assertLocalOllamaModel(model: string, fetchFn: FetchLike = fetch, baseUrl = OLLAMA_DEFAULT_BASE_URL, signal?: AbortSignal): Promise<string> {
  const canonical = canonicalLocalModel(model);
  const base = assertLoopbackOllamaUrl(baseUrl);
  const timeout = AbortSignal.timeout(8000);
  const response = await fetchFn(`${base}/api/show`, { method: 'POST', redirect: 'error',
    headers: { 'content-type': 'application/json' }, body: JSON.stringify({ model: canonical }),
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout });
  const metadata = await readOllamaJson(response);
  const remote = (value: unknown, depth = 0): boolean => {
    if (!value || typeof value !== 'object' || depth > 8) return false;
    return Object.entries(value).some(([key, item]) =>
      ((['remote_host', 'remote_model', 'remoteHost', 'remoteModel', 'cloud', 'remote'].includes(key)) && !!item)
      || remote(item, depth + 1));
  };
  if (remote(metadata) || !metadata.model_info || typeof metadata.model_info !== 'object'
      || Array.isArray(metadata.model_info) || Object.keys(metadata.model_info).length === 0) {
    throw new Error('Model has remote or unverified metadata; the self-hosted route cannot use it');
  }
  return canonical;
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
    const res = await fetchFn(`${base}/api/tags`, { redirect: 'error', signal: AbortSignal.timeout(8000) });
    if (!res.ok) {
      return { available: false, baseUrl: base, models: [], error: `Ollama returned HTTP ${res.status}` };
    }
    const body: unknown = await readOllamaJson(res);
    const raw = isRecord(body) && Array.isArray(body.models) ? body.models : [];
    const models: ModelInfo[] = [];
    for (const entry of raw) {
      if (isRecord(entry) && typeof entry.name === 'string') {
        try { const id = canonicalLocalModel(entry.name); models.push({ id, label: id }); } catch { /* Cloud aliases are not local models. */ }
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
  const prompt = req.system ? `${req.system}\n\n${req.prompt}` : req.prompt;
  const contextBound = Buffer.byteLength(prompt, 'utf8') + 1024 + req.maxOutputTokens;
  if (!Number.isSafeInteger(req.maxOutputTokens) || req.maxOutputTokens < 1 || contextBound > 32768) {
    throw new Error('The self-hosted request exceeds the supported 32768-token conservative context bound. Shorten the brief or reduce its output allocation.');
  }
  const contextSize = Math.max(4096, 2 ** Math.ceil(Math.log2(contextBound)));
  const model = await assertLocalOllamaModel(req.model, fetchFn, base, req.abortSignal);
  const res = await fetchFn(`${base}/api/generate`, {
    method: 'POST',
    redirect: 'error',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      model,
      prompt,
      stream: false,
      options: { num_predict: req.maxOutputTokens, num_ctx: contextSize },
    }),
    ...(req.abortSignal !== undefined ? { signal: req.abortSignal } : {}),
  });
  if (!res.ok) {
    throw new Error(`Ollama generation failed with HTTP ${res.status}`);
  }
  const body: unknown = await readOllamaJson(res, 4 * 1024 * 1024);
  if (!isRecord(body) || typeof body.response !== 'string' || body.done === false) {
    throw new Error('Ollama returned an unexpected response shape');
  }
  return {
    text: body.response,
    inputTokens: typeof body.prompt_eval_count === 'number' ? body.prompt_eval_count : 0,
    outputTokens: typeof body.eval_count === 'number' ? body.eval_count : 0,
    usageObserved: [body.prompt_eval_count, body.eval_count].every(n => Number.isSafeInteger(n) && Number(n) >= 0),
  };
}
