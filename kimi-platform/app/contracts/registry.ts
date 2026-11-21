import { z } from "zod";

/**
 * Role/resource matrix contracts (role_capability_matrix.json, schema after
 * the 2026-11-20 gap fill, the 2026-11-21 specialist fill, the
 * 2026-11-21 creative fill, and the 2026-11-21 assistant skill mapping: 109
 * roles,
 * 436 resources, 1,756 role-resource links, 336 evaluation tasks (+ 5 ET-CAND
 * tasks on the candidate draft), 21 skill-pack mappings, 1 proposed role
 * candidate). Single source of truth for scope flags, tiers, evidence levels,
 * the depth-score heuristic label, role-relevant resource selection, and the
 * role-coverage DTOs served to the UI.
 *
 * Depth scores are a curated coverage heuristic computed from the matrix's
 * stated scoring rules — they are NOT job-performance evidence. The label is
 * carried explicitly everywhere a score is surfaced.
 */

export const MATRIX_SCHEMA_VERSION = "1.0.0" as const;

/** Explicit, non-optional label for what the depth score means. */
export const DEPTH_HEURISTIC_LABEL =
  "curated coverage heuristic (role_depth_score scoring rule); coverage metric, not job-performance evidence";

// ── Enumerations ─────────────────────────────────────────────────

/** Scope of a role→resource link (seed flag_definitions). */
export const SCOPE_FLAGS = ["core", "internal", "conditional"] as const;
export const ScopeFlagSchema = z.enum(SCOPE_FLAGS);
export type ScopeFlag = z.infer<typeof ScopeFlagSchema>;

/** Depth tier of a linked resource (seed tier_definitions). */
export const RESOURCE_TIERS = ["foundational", "core", "advanced"] as const;
export const ResourceTierSchema = z.enum(RESOURCE_TIERS);
export type ResourceTier = z.infer<typeof ResourceTierSchema>;

/**
 * Link-check evidence levels (seed evidence_levels). E0-stale = HTTP 404 in
 * the 2026-11-20 pass — stale resources are excluded from (or explicitly
 * flagged in) every selection path.
 */
export const EVIDENCE_LEVELS = ["E3", "E2", "E1", "E0-vendor", "E0-stale"] as const;
export const EvidenceLevelSchema = z.enum(EVIDENCE_LEVELS);
export type EvidenceLevel = z.infer<typeof EvidenceLevelSchema>;

export const DECOMPOSITION_VERDICTS = [
  "split_at_scale",
  "merge_candidate",
  "keep_combined",
] as const;
export const DecompositionVerdictSchema = z.enum(DECOMPOSITION_VERDICTS);
export type DecompositionVerdict = z.infer<typeof DecompositionVerdictSchema>;

/** A proposed role is a candidate, never a standing role. */
export const CANDIDATE_ROLE_STATUS = "candidate" as const;

// ── Role-relevant resource selection ─────────────────────────────

/**
 * One registry role→resource link joined with its resource row. This is the
 * selection unit for squad proposals and prompt curation.
 */
export const LinkedResourceSchema = z.object({
  linkId: z.string().max(32),
  roleSlug: z.string().max(255),
  url: z.string().max(1000),
  name: z.string().max(500),
  domain: z.string().max(255),
  type: z.string().max(120),
  flag: ScopeFlagSchema,
  tier: ResourceTierSchema,
  evidence: EvidenceLevelSchema,
  access: z.string().max(255),
  license: z.string().max(255),
  /** Non-empty only for conditional links; gates admission. */
  trigger: z.string().max(500),
  /** True when the resource is stale (E0-stale / link-check 404). */
  stale: z.boolean(),
});
export type LinkedResource = z.infer<typeof LinkedResourceSchema>;

export const SelectedResourceSchema = z.object({
  url: z.string().max(1000),
  name: z.string().max(500),
  flag: ScopeFlagSchema,
  tier: ResourceTierSchema,
  evidence: EvidenceLevelSchema,
  access: z.string().max(255),
  license: z.string().max(255),
  /** Curator-style relevance in [0, 1] used for deterministic ordering. */
  relevance: z.number().min(0).max(1),
  /** True when a conditional link's trigger matched the goal keywords. */
  triggerMatched: z.boolean(),
  /** Short audit notes (why this resource ranked where it did). */
  reasons: z.array(z.string().max(200)).max(6),
});
export type SelectedResource = z.infer<typeof SelectedResourceSchema>;

/** Deterministic selection result with explicit exclusion accounting. */
export const ResourceSelectionSchema = z.object({
  selected: z.array(SelectedResourceSchema),
  /** Stale links are never selected silently; they are listed here. */
  excludedStale: z.array(
    z.object({ url: z.string().max(1000), name: z.string().max(500) }),
  ),
  /** Conditional links whose trigger did not match the goal. */
  excludedConditionalCount: z.number().int().nonnegative(),
  counts: z.object({
    core: z.number().int().nonnegative(),
    internal: z.number().int().nonnegative(),
    conditional: z.number().int().nonnegative(),
  }),
});
export type ResourceSelection = z.infer<typeof ResourceSelectionSchema>;

// ── Role coverage DTOs (registry role-coverage API) ──────────────

export const RoleCoverageSchema = z.object({
  slug: z.string(),
  name: z.string(),
  family: z.string(),
  depthScore: z.number(),
  depthBand: z.string(),
  /** Always DEPTH_HEURISTIC_LABEL — never presented bare. */
  depthHeuristic: z.string(),
  decompositionVerdict: DecompositionVerdictSchema,
  /** Explicit gap labels (capability gaps from the matrix audit). */
  gapLabels: z.array(z.string()),
  linkCounts: z.object({
    core: z.number().int().nonnegative(),
    internal: z.number().int().nonnegative(),
    conditional: z.number().int().nonnegative(),
    stale: z.number().int().nonnegative(),
  }),
  evaluationTaskCount: z.number().int().nonnegative(),
  skillPacks: z.array(z.string()),
});
export type RoleCoverage = z.infer<typeof RoleCoverageSchema>;

/** Per-node coverage returned alongside every squad proposal. */
export const ProposalNodeCoverageSchema = z.object({
  nodeKey: z.string(),
  role: z.string(),
  /** False when the role has no profile/links in the matrix. */
  roleKnown: z.boolean(),
  depthScore: z.number().nullable(),
  depthBand: z.string().nullable(),
  depthHeuristic: z.string(),
  gapLabels: z.array(z.string()),
  resources: ResourceSelectionSchema,
});
export type ProposalNodeCoverage = z.infer<typeof ProposalNodeCoverageSchema>;
