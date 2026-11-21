import { and, eq } from "drizzle-orm";
import { getDb } from "../queries/connection";
import { ownerSettings } from "@db/schema";
import { PricingRateSchema, type PricingRate, type ProviderId, type UsageRecord } from "@contracts/run";

/**
 * USD pricing resolution for live providers.
 *
 * Rates come from (in priority order):
 *   1. the owner's own settings (`owner_settings` row `pricing:<provider>:<model>`),
 *   2. non-secret server env rates (`<PROVIDER>_INPUT_USD_PER_MILLION` /
 *      `<PROVIDER>_OUTPUT_USD_PER_MILLION`),
 *   3. nothing → null, which BLOCKS cost-capped live dispatch. The engine
 *      never guesses a price.
 */

export interface ResolvedPricing {
  inputUsdPerMillion: number;
  outputUsdPerMillion: number;
  cacheReadUsdPerMillion?: number;
  cacheWriteUsdPerMillion?: number;
  source: "owner" | "env";
}

const RATE_KEY = (provider: ProviderId, model: string) =>
  `pricing:${provider}:${model}`;

/** Blank environment values are missing prices, never a zero-dollar offer. */
function parseRate(value: string | undefined): number | undefined {
  if (value === undefined || value.trim() === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 10_000 ? parsed : undefined;
}

export function envRate(provider: ProviderId): ResolvedPricing | null {
  const prefix = provider.toUpperCase();
  const i = parseRate(process.env[`${prefix}_INPUT_USD_PER_MILLION`]);
  const o = parseRate(process.env[`${prefix}_OUTPUT_USD_PER_MILLION`]);
  if (i !== undefined && o !== undefined) {
    return {
      inputUsdPerMillion: i, outputUsdPerMillion: o, source: "env",
      cacheReadUsdPerMillion: parseRate(process.env[`${prefix}_CACHE_READ_USD_PER_MILLION`]),
      cacheWriteUsdPerMillion: parseRate(process.env[`${prefix}_CACHE_WRITE_USD_PER_MILLION`]),
    };
  }
  return null;
}

export async function resolvePricing(
  ownerId: number,
  provider: ProviderId,
  model: string,
): Promise<ResolvedPricing | null> {
  if (provider === "mock") return null; // mock uses its labeled simulated rates
  const db = getDb();
  const row = await db.query.ownerSettings.findFirst({
    where: and(
      eq(ownerSettings.ownerId, ownerId),
      eq(ownerSettings.key, RATE_KEY(provider, model)),
    ),
  });
  if (row) {
    const parsed = PricingRateSchema.safeParse({ ...(row.value as object), provider, model });
    if (parsed.success) {
      return {
        inputUsdPerMillion: parsed.data.inputUsdPerMillion,
        outputUsdPerMillion: parsed.data.outputUsdPerMillion,
        cacheReadUsdPerMillion: parsed.data.cacheReadUsdPerMillion,
        cacheWriteUsdPerMillion: parsed.data.cacheWriteUsdPerMillion,
        source: "owner",
      };
    }
  }
  return envRate(provider);
}

export async function setOwnerPricing(
  ownerId: number,
  rate: PricingRate,
): Promise<void> {
  const db = getDb();
  const key = RATE_KEY(rate.provider, rate.model);
  const value = {
    inputUsdPerMillion: rate.inputUsdPerMillion,
    outputUsdPerMillion: rate.outputUsdPerMillion,
    ...(rate.cacheReadUsdPerMillion !== undefined ? { cacheReadUsdPerMillion: rate.cacheReadUsdPerMillion } : {}),
    ...(rate.cacheWriteUsdPerMillion !== undefined ? { cacheWriteUsdPerMillion: rate.cacheWriteUsdPerMillion } : {}),
  };
  const existing = await db.query.ownerSettings.findFirst({
    where: and(eq(ownerSettings.ownerId, ownerId), eq(ownerSettings.key, key)),
  });
  if (existing) {
    await db
      .update(ownerSettings)
      .set({ value })
      .where(eq(ownerSettings.id, existing.id));
  } else {
    await db.insert(ownerSettings).values({ ownerId, key, value });
  }
}

export async function listOwnerPricing(
  ownerId: number,
): Promise<Array<{ provider: string; model: string } & ResolvedPricing>> {
  const db = getDb();
  const rows = await db.query.ownerSettings.findMany({
    where: eq(ownerSettings.ownerId, ownerId),
  });
  const out: Array<{ provider: string; model: string } & ResolvedPricing> = [];
  for (const r of rows) {
    const m = /^pricing:([a-z]+):(.+)$/.exec(r.key);
    const parsed = m && PricingRateSchema.safeParse({ ...(r.value as object), provider: m[1], model: m[2] });
    if (m && parsed?.success) {
      out.push({
        provider: m[1]!,
        model: m[2]!,
        inputUsdPerMillion: parsed.data.inputUsdPerMillion,
        outputUsdPerMillion: parsed.data.outputUsdPerMillion,
        cacheReadUsdPerMillion: parsed.data.cacheReadUsdPerMillion,
        cacheWriteUsdPerMillion: parsed.data.cacheWriteUsdPerMillion,
        source: "owner",
      });
    }
  }
  return out;
}

export function cachePricingConfigured(rate: ResolvedPricing | null): boolean {
  return rate?.cacheReadUsdPerMillion !== undefined && rate?.cacheWriteUsdPerMillion !== undefined;
}

type PriceableUsage = Pick<UsageRecord, "promptTokens" | "completionTokens" | "cacheReadPromptTokens" | "cacheWritePromptTokens" | "cacheBreakdownComplete" | "usageReported">;

/** Configured-rate accounting is an estimate, not the provider's invoice. */
export function assessUsagePrice(usage: PriceableUsage, rate: ResolvedPricing, cacheRequested = false): {
  costUsdMicros: number;
  status: "configured" | "conservative" | "unknown";
} {
  if (usage.usageReported === false) return { costUsdMicros: 0, status: "unknown" };
  const read = usage.cacheReadPromptTokens ?? 0;
  const write = usage.cacheWritePromptTokens ?? 0;
  const baseCost = usage.promptTokens * rate.inputUsdPerMillion + usage.completionTokens * rate.outputUsdPerMillion;
  if ((read > 0 && rate.cacheReadUsdPerMillion === undefined) || (write > 0 && rate.cacheWriteUsdPerMillion === undefined)) {
    // Keep a subtotal for audit, but stop further dispatch after preserving the output.
    return { costUsdMicros: Math.round(baseCost), status: "unknown" };
  }
  if (usage.cacheBreakdownComplete && read + write <= usage.promptTokens) {
    return {
      costUsdMicros: Math.round(
        (usage.promptTokens - read - write) * rate.inputUsdPerMillion +
        read * (rate.cacheReadUsdPerMillion ?? rate.inputUsdPerMillion) +
        write * (rate.cacheWriteUsdPerMillion ?? rate.inputUsdPerMillion) +
        usage.completionTokens * rate.outputUsdPerMillion,
      ),
      status: "configured",
    };
  }
  if (cacheRequested || read > 0 || write > 0) {
    if (!cachePricingConfigured(rate)) return { costUsdMicros: Math.round(baseCost), status: "unknown" };
    return {
      costUsdMicros: Math.round(usage.promptTokens * Math.max(rate.inputUsdPerMillion, rate.cacheReadUsdPerMillion!, rate.cacheWriteUsdPerMillion!) + usage.completionTokens * rate.outputUsdPerMillion),
      status: "conservative",
    };
  }
  return { costUsdMicros: Math.round(baseCost), status: "configured" };
}

/** tokens × USD-per-million rates → integer USD micros; inspect status for live dispatch. */
export function priceUsage(
  usage: PriceableUsage,
  rate: ResolvedPricing,
): number {
  return assessUsagePrice(usage, rate).costUsdMicros;
}
