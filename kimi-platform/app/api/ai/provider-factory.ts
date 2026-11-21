import { createKimiGateway } from "./ai-client";

/**
 * Shared attributed gateway factory (website-ai skill pattern).
 * Initialized lazily so an unprovisioned site's non-AI routes still load;
 * the first AI call raises AiMisconfigured from ai-client's config check.
 */
let cached: ReturnType<typeof createKimiGateway> | undefined;

export function kimiGw(modelId: string) {
  cached ??= createKimiGateway();
  return cached(modelId);
}
