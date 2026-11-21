import { listModels, type ModelList } from "./ai-client";

/**
 * Runtime model discovery cache (spec §8.4).
 * Discovery is not an inference call and is excluded from AI-call accounting.
 * Successful results are cached briefly; failures are not cached. A refresh
 * may retry only because discovery is a cheap, read-only, idempotent call —
 * and then at most once, honoring Retry-After when present.
 */

const TTL_MS = 60_000;
let cache: { at: number; value: ModelList } | undefined;

export async function listGatewayModels(forceRefresh = false): Promise<ModelList> {
  if (!forceRefresh && cache && Date.now() - cache.at < TTL_MS) {
    return cache.value;
  }
  try {
    const value = await listModels();
    cache = { at: Date.now(), value };
    return value;
  } catch (err) {
    // Single bounded retry for the read-only, idempotent discovery call only.
    const retryAfter = Number(
      (err as { response?: { headers?: Headers } })?.response?.headers?.get?.(
        "retry-after",
      ) ?? 0,
    );
    await new Promise((r) =>
      setTimeout(r, Math.min(Math.max(retryAfter * 1000, 500), 3_000)),
    );
    const value = await listModels();
    cache = { at: Date.now(), value };
    return value;
  }
}
