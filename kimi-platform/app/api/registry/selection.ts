import type {
  EvidenceLevel,
  LinkedResource,
  ResourceSelection,
  ScopeFlag,
  SelectedResource,
} from "@contracts/registry";

/**
 * Role/goal-relevant resource selection (replaces the previous arbitrary
 * hash-pick of any two registry URLs). Deterministic: identical links + goal
 * always produce an identical selection.
 *
 * Rules (matrix flag/tier/evidence definitions):
 *   - stale links (E0-stale / link-check 404) are never selected; they are
 *     reported in excludedStale so the degradation is explicit;
 *   - conditional links are admitted only when their trigger matches the goal
 *     keywords; unmatched conditionals are counted, never silently used;
 *   - ordering is core → conditional (trigger matched) → internal, then by
 *     computed relevance (flag + evidence + tier + goal-keyword overlap),
 *     then by URL for a total, stable order;
 *   - a deterministic item cap applies (default 8, ceiling 16).
 */

export const SELECTION_MAX_RESOURCES = 16;
export const SELECTION_DEFAULT_RESOURCES = 8;

const STOPWORDS = new Set([
  "the", "and", "for", "with", "that", "this", "from", "into", "are", "was",
  "were", "will", "would", "should", "could", "have", "has", "had", "not",
  "but", "all", "any", "can", "our", "your", "their", "its", "over", "under",
  "about", "how", "what", "when", "where", "which", "who", "why", "than",
  "then", "them", "they", "you", "she", "him", "his", "her", "out", "use",
  "using", "used", "via", "per", "each", "such", "more", "most", "less",
  "least", "new", "one", "two", "also", "just", "like", "make", "made",
]);

/** Lowercase alphanumeric tokens, stopwords and ≤2-char tokens dropped. */
export function goalKeywords(text: string): Set<string> {
  const tokens = text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 2 && !STOPWORDS.has(t));
  return new Set(tokens);
}

/** A conditional trigger matches when any significant trigger token appears in the goal. */
export function triggerMatches(trigger: string, goal: Set<string>): boolean {
  if (!trigger.trim()) return false;
  const tokens = trigger
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 2 && !STOPWORDS.has(t));
  return tokens.some((t) => goal.has(t));
}

const FLAG_WEIGHT: Record<ScopeFlag, number> = {
  core: 1.0,
  conditional: 0.85,
  internal: 0.6,
};
const EVIDENCE_WEIGHT: Record<EvidenceLevel, number> = {
  E3: 1.0,
  E1: 0.9,
  E2: 0.7,
  "E0-vendor": 0.3,
  "E0-stale": 0.0,
};
/** Working-depth material ranks highest for a generic role task. */
const TIER_WEIGHT = { core: 1.0, foundational: 0.8, advanced: 0.7 } as const;
/** core first; a matched conditional outranks internal literacy. */
const FLAG_RANK: Record<ScopeFlag, number> = { core: 0, conditional: 1, internal: 2 };

function relevanceOf(link: LinkedResource, goal: Set<string>): { relevance: number; hits: number } {
  const haystack = `${link.name} ${link.domain} ${link.type}`.toLowerCase();
  let hits = 0;
  for (const token of goal) {
    if (haystack.includes(token)) hits += 1;
  }
  const keywordW = Math.min(1, hits / 3);
  const relevance =
    0.4 * FLAG_WEIGHT[link.flag] +
    0.25 * (EVIDENCE_WEIGHT[link.evidence] ?? 0) +
    0.15 * (TIER_WEIGHT[link.tier] ?? 0.5) +
    0.2 * keywordW;
  return { relevance: Math.round(Math.min(1, relevance) * 1000) / 1000, hits };
}

/**
 * Select the role/goal-relevant resources from a role's links. `goal` is the
 * node or proposal goal text. Deterministic caps and exclusions as documented
 * above.
 */
export function selectRoleResources(
  links: LinkedResource[],
  goalText: string,
  opts: { maxResources?: number } = {},
): ResourceSelection {
  const cap = Math.max(
    1,
    Math.min(opts.maxResources ?? SELECTION_DEFAULT_RESOURCES, SELECTION_MAX_RESOURCES),
  );
  const goal = goalKeywords(goalText);

  const excludedStale: ResourceSelection["excludedStale"] = [];
  let excludedConditionalCount = 0;
  const candidates: (SelectedResource & { rank: number })[] = [];

  for (const link of links) {
    if (link.stale || link.evidence === "E0-stale") {
      excludedStale.push({ url: link.url, name: link.name });
      continue;
    }
    const matched = link.flag !== "conditional" ? false : triggerMatches(link.trigger, goal);
    if (link.flag === "conditional" && !matched) {
      excludedConditionalCount += 1;
      continue;
    }
    const { relevance, hits } = relevanceOf(link, goal);
    const reasons = [`flag:${link.flag}`, `evidence:${link.evidence}`, `tier:${link.tier}`];
    if (matched) reasons.push("trigger-matched");
    if (hits > 0) reasons.push(`goal-keywords:${hits}`);
    candidates.push({
      url: link.url,
      name: link.name,
      flag: link.flag,
      tier: link.tier,
      evidence: link.evidence,
      access: link.access,
      license: link.license,
      relevance,
      triggerMatched: matched,
      reasons,
      rank: FLAG_RANK[link.flag],
    });
  }

  candidates.sort((a, b) =>
    a.rank !== b.rank
      ? a.rank - b.rank
      : b.relevance !== a.relevance
        ? b.relevance - a.relevance
        : a.url < b.url
          ? -1
          : a.url > b.url
            ? 1
            : 0,
  );

  // Deterministic de-dupe by URL (a resource can be linked twice via
  // different evidence paths), then the item cap.
  const seen = new Set<string>();
  const selected: SelectedResource[] = [];
  for (const c of candidates) {
    if (seen.has(c.url)) continue;
    seen.add(c.url);
    if (selected.length >= cap) continue;
    selected.push({
      url: c.url,
      name: c.name,
      flag: c.flag,
      tier: c.tier,
      evidence: c.evidence,
      access: c.access,
      license: c.license,
      relevance: c.relevance,
      triggerMatched: c.triggerMatched,
      reasons: c.reasons,
    });
  }

  return {
    selected,
    excludedStale: excludedStale.sort((a, b) => (a.url < b.url ? -1 : 1)),
    excludedConditionalCount,
    counts: {
      core: selected.filter((s) => s.flag === "core").length,
      internal: selected.filter((s) => s.flag === "internal").length,
      conditional: selected.filter((s) => s.flag === "conditional").length,
    },
  };
}
