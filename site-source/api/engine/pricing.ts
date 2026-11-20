import { and, eq } from "drizzle-orm";
import { getDb } from "../queries/connection";
import { ownerSettings } from "@db/schema";
import type { PricingRate, ProviderId, UsageRecord } from "@contracts/run";

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
  source: "owner" | "env";
}

const RATE_KEY = (provider: ProviderId, model: string) =>
  `pricing:${provider}:${model}`;

function envRate(provider: ProviderId): ResolvedPricing | null {
  const prefix = provider.toUpperCase();
  const i = Number(process.env[`${prefix}_INPUT_USD_PER_MILLION`]);
  const o = Number(process.env[`${prefix}_OUTPUT_USD_PER_MILLION`]);
  if (Number.isFinite(i) && Number.isFinite(o) && i >= 0 && o >= 0) {
    return { inputUsdPerMillion: i, outputUsdPerMillion: o, source: "env" };
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
    const val = row.value as {
      inputUsdPerMillion?: unknown;
      outputUsdPerMillion?: unknown;
    };
    if (
      typeof val.inputUsdPerMillion === "number" &&
      typeof val.outputUsdPerMillion === "number"
    ) {
      return {
        inputUsdPerMillion: val.inputUsdPerMillion,
        outputUsdPerMillion: val.outputUsdPerMillion,
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
    const val = r.value as {
      inputUsdPerMillion?: unknown;
      outputUsdPerMillion?: unknown;
    };
    if (
      m &&
      typeof val.inputUsdPerMillion === "number" &&
      typeof val.outputUsdPerMillion === "number"
    ) {
      out.push({
        provider: m[1]!,
        model: m[2]!,
        inputUsdPerMillion: val.inputUsdPerMillion,
        outputUsdPerMillion: val.outputUsdPerMillion,
        source: "owner",
      });
    }
  }
  return out;
}

/** tokens × USD-per-million rates → integer USD micros. */
export function priceUsage(
  usage: Pick<UsageRecord, "promptTokens" | "completionTokens">,
  rate: ResolvedPricing,
): number {
  return Math.round(
    usage.promptTokens * rate.inputUsdPerMillion +
      usage.completionTokens * rate.outputUsdPerMillion,
  );
}
