import crypto from 'node:crypto';
import fs from 'node:fs';

export interface ImprovementRoute { provider: 'anthropic' | 'openai' | 'ollama'; model: string }
export interface ImprovementPriceQuote extends ImprovementRoute {
  priceRates: { inputUsdPerMillion: number; outputUsdPerMillion: number };
  source: string; observedAt: string; expiresAt: string;
  maxInputTokens: number;
  catalogSha256: string; costBasis: 'standard-token-rates';
}
interface PriceTier { maxInputTokens: number; inputUsdPerMillion: number; outputUsdPerMillion: number }
interface PriceRoute extends ImprovementRoute { source: string; tiers: PriceTier[] }
export interface ImprovementPriceCatalog {
  observedAt: string; expiresAt: string; routes: PriceRoute[]; sha256: string;
}
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const modelId = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._/:+-]{0,199}$/.test(value);
const validTime = (value: unknown): value is string => typeof value === 'string' && value.length <= 40 && Number.isFinite(Date.parse(value));
const key = (route: ImprovementRoute) => `${route.provider}:${route.model}`;
const QUOTE_TTL_MS = 60 * 60_000;

/** Inert, bounded price data. Reading it never discovers models or starts work. */
export function readImprovementPriceCatalog(filename: string): ImprovementPriceCatalog {
  const stat = fs.lstatSync(filename);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 65536) throw new Error('The improvement price catalog requires review.');
  const bytes = fs.readFileSync(filename); const data: unknown = JSON.parse(bytes.toString('utf8'));
  if (!object(data) || data.schemaVersion !== 1 || !validTime(data.observedAt) || !validTime(data.expiresAt)
      || Date.parse(data.expiresAt) <= Date.parse(data.observedAt) || !Array.isArray(data.routes) || data.routes.length > 64) {
    throw new Error('The improvement price catalog is invalid.');
  }
  const seen = new Set<string>();
  const routes = data.routes.map((row): PriceRoute => {
    if (!object(row) || !['anthropic','openai'].includes(String(row.provider)) || !modelId(row.model)
        || typeof row.source !== 'string' || row.source.length > 2048 || !Array.isArray(row.tiers) || !row.tiers.length || row.tiers.length > 8) {
      throw new Error('An improvement price route is invalid.');
    }
    const source = new URL(row.source);
    if (source.protocol !== 'https:' || source.username || source.password || source.search || source.hash) throw new Error('Price evidence must be an HTTPS document URL.');
    let previous = 0;
    const tiers = row.tiers.map((tier): PriceTier => {
      if (!object(tier) || !Number.isSafeInteger(tier.maxInputTokens) || Number(tier.maxInputTokens) <= previous || Number(tier.maxInputTokens) > 1000000
          || ![tier.inputUsdPerMillion,tier.outputUsdPerMillion].every(value => typeof value === 'number' && Number.isFinite(value) && value > 0 && value <= 10000)) {
        throw new Error('An improvement price tier is invalid.');
      }
      previous = Number(tier.maxInputTokens);
      return { maxInputTokens: previous, inputUsdPerMillion: Number(tier.inputUsdPerMillion), outputUsdPerMillion: Number(tier.outputUsdPerMillion) };
    });
    const route = { provider: row.provider as 'anthropic' | 'openai', model: row.model, source: row.source, tiers };
    if (seen.has(key(route))) throw new Error('Improvement price route identities must be unique.');
    seen.add(key(route)); return route;
  });
  return { observedAt: data.observedAt, expiresAt: data.expiresAt, routes, sha256: crypto.createHash('sha256').update(bytes).digest('hex') };
}

/** Eligible means both pair actors and the connected model were checked by the caller. */
export function selectImprovementRoute(catalog: ImprovementPriceCatalog, allowed: ImprovementRoute[], eligible: ImprovementRoute[], pairMaxTokens: number, now = Date.now()): ImprovementPriceQuote | null {
  if (!Number.isSafeInteger(pairMaxTokens) || pairMaxTokens < 1 || pairMaxTokens > 1000000 || allowed.length > 64 || eligible.length > 256) throw new Error('Bounded route candidates and pair tokens are required.');
  const identities = new Set(allowed.filter(route => ['anthropic','openai','ollama'].includes(route.provider) && modelId(route.model)).map(key));
  const connected = new Set(eligible.filter(route => identities.has(key(route))).map(key));
  const quotes: ImprovementPriceQuote[] = [];
  if (Date.parse(catalog.observedAt) <= now && now < Date.parse(catalog.expiresAt)) {
    for (const route of catalog.routes) {
      if (!connected.has(key(route))) continue;
      // The entire pair token ceiling bounds each phase's input, including the
      // worker's prompt overhead. No unverified tokenizer estimate selects a tier.
      const tier = route.tiers.find(item => pairMaxTokens <= item.maxInputTokens);
      if (!tier) continue;
      quotes.push({ provider: route.provider, model: route.model,
        priceRates: { inputUsdPerMillion: tier.inputUsdPerMillion, outputUsdPerMillion: tier.outputUsdPerMillion },
        // The catalog's evidence lifetime is distinct from this dispatch quote.
        // Keep its hash/source provenance while issuing a short-lived selection
        // that never outlives the reviewed catalog.
        source: route.source, observedAt: new Date(now).toISOString(),
        expiresAt: new Date(Math.min(now + QUOTE_TTL_MS, Date.parse(catalog.expiresAt))).toISOString(),
        maxInputTokens: tier.maxInputTokens,
        catalogSha256: catalog.sha256, costBasis: 'standard-token-rates' });
    }
  }
  // Local token cost excludes hardware, electricity and hosting charges. The
  // caller must verify current installed digest/assignment/grants for both actors.
  for (const route of allowed) if (route.provider === 'ollama' && connected.has(key(route))) {
    quotes.push({ ...route, priceRates: { inputUsdPerMillion: 0, outputUsdPerMillion: 0 }, source: 'local-installed-model',
      observedAt: new Date(now).toISOString(), expiresAt: new Date(now + QUOTE_TTL_MS).toISOString(), maxInputTokens: 1000000,
      catalogSha256: catalog.sha256, costBasis: 'standard-token-rates' });
  }
  return quotes.sort((a,b) => Math.max(a.priceRates.inputUsdPerMillion,a.priceRates.outputUsdPerMillion)
    - Math.max(b.priceRates.inputUsdPerMillion,b.priceRates.outputUsdPerMillion) || key(a).localeCompare(key(b)))[0] ?? null;
}

export function assertImprovementPriceQuote(quote: ImprovementPriceQuote | null | undefined, route: ImprovementRoute & {priceRates?:ImprovementPriceQuote['priceRates']}, phaseMaxTokens: number, now = Date.now()): void {
  if (!quote || quote.provider !== route.provider || quote.model !== route.model || !validTime(quote.observedAt) || !validTime(quote.expiresAt)
      || Date.parse(quote.observedAt) > now || Date.parse(quote.expiresAt) <= now
      || Date.parse(quote.expiresAt) - Date.parse(quote.observedAt) > 7 * 24 * 60 * 60_000 || !Number.isSafeInteger(phaseMaxTokens)
      || phaseMaxTokens < 1 || !Number.isSafeInteger(quote.maxInputTokens) || phaseMaxTokens > quote.maxInputTokens
      || !quote.priceRates || ![quote.priceRates.inputUsdPerMillion,quote.priceRates.outputUsdPerMillion].every(rate=>Number.isFinite(rate)&&rate>=0&&(route.provider==='ollama'?rate===0:rate>0))
      || (route.priceRates && (route.priceRates.inputUsdPerMillion!==quote.priceRates.inputUsdPerMillion || route.priceRates.outputUsdPerMillion!==quote.priceRates.outputUsdPerMillion))
      || !/^[a-f0-9]{64}$/.test(quote.catalogSha256)) throw new Error('The improvement route quote is expired, changed, or outside its token bound. No provider request was sent.');
}
