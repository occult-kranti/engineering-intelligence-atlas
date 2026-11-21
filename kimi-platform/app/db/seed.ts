/**
 * db/seed.ts — seeds the owner-readable registry (spec §7.1):
 *   - 109 roles and 436 curated resources from the role/resource matrix
 *     (db/data/role_capability_matrix.json, post-2026-11-20 gap fill +
 *     2026-11-21 specialist fill + 2026-11-21 creative fill + 2026-11-21
 *     assistant skill mapping) joined
 *     with the atlas resource snapshots in src/data (license/purpose/caveat);
 *   - the normalized matrix: 109 role profiles (depth score + explicit
 *     heuristic label, gaps, decomposition triggers, evidence), 1,756
 *     role→resource links (scope flag/tier/evidence/access/license/stale),
 *     336 evaluation tasks (plus 5 ET-CAND tasks on the candidate draft),
 *     84 audit gaps, 21 skill-pack mappings, and the
 *     proposed Product Designer / UX Researcher as a CANDIDATE (never a
 *     standing role);
 *   - the 21 curated skill packages from the workspace (the original 8
 *     engineering packages, the 8 science/model-library packages:
 *     game-reconstruction, mathematics, physics, chemistry, biology,
 *     science-history, ai-open-model-research, ai-research-frontier, the
 *     2 specialist packages: architecture-database-backend-engineering,
 *     ui-ux-research-design-engineering, the 2 creative packages:
 *     civilization-art-design-research,
 *     music-theory-production-engineering, and the executive package:
 *     executive-operations-assistant), parsed through the
 *     same intake pipeline as uploads (manifest + L2 body + file inventory +
 *     risk signals). Seeded packages are platform-curated and marked vetted
 *     with an explicit provenance note; user-uploaded skills always start
 *     quarantined and can never self-promote. Content is hashed and
 *     inventoried only — seeding NEVER executes any bundled script.
 *
 * Idempotent: re-running skips rows that already exist (keyed on the matrix's
 * stable ids: slug / link_id / task_id / gap_id / skill pack), backfills
 * evidence/stale columns on pre-existing resource rows, and upserts the
 * matrix-owned columns that legitimately change when the matrix is revised:
 * skill-pack mapping consumer lists and role-profile skillPacks.
 *
 * Usage: npx tsx db/seed.ts
 * Skill source root: $SKILL_SEED_ROOT, default <repo>/.. (the workspace).
 */
import "dotenv/config";
import * as fs from "node:fs";
import * as path from "node:path";
import { pathToFileURL } from "node:url";
import { eq, and, sql } from "drizzle-orm";
import { drizzle, type MySql2Database } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as schema from "./schema";
import {
  registryGaps,
  registryResources,
  registryRoleCandidates,
  registryRoleEvaluationTasks,
  registryRoleProfiles,
  registryRoleResourceLinks,
  registryRoles,
  registrySkillMappings,
  skillFiles,
  skills,
} from "./schema";
import { ROLES } from "../src/data/roles";
import { RESOURCES } from "../src/data/resources";
import { DEPTH_HEURISTIC_LABEL, type EvidenceLevel } from "../contracts/registry";
import {
  classifySkillFile,
  intakeSkillMarkdown,
  sha256Hex,
} from "../api/registry/intake";
import type { SkillManifest } from "../contracts/skill";

const SKILL_SEED_ROOT =
  process.env.SKILL_SEED_ROOT ??
  path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");

const DATA_DIR = path.resolve(path.dirname(new URL(import.meta.url).pathname), "data");

// ── Matrix dataset types (db/data/role_capability_matrix.json) ────

interface MatrixRole {
  role_index: number;
  slug: string;
  name: string;
  function: string;
  mission: string;
  senior_scope: string;
  required_capabilities: string[];
  interfaces: string[];
  cross_cutting_ownership: string[];
  charter_source: string;
  capability_gaps: string[];
  decomposition: { verdict: string; triggers: string[]; notes: string };
  depth: Record<string, unknown> & { depth_score: number; depth_band: string };
  evidence_level: { charter: string; resources_verified: string };
  scientific_and_model_resources: string[];
  skill_packs: string[];
}

interface MatrixLink {
  link_id: string;
  role_slug: string;
  resource_name: string;
  resource_url: string;
  domain: string;
  type: string;
  catalog_level: string;
  prerequisite: string;
  flag: "core" | "internal" | "conditional";
  tier: "foundational" | "core" | "advanced";
  evidence: EvidenceLevel;
  access: string;
  trigger: string;
  evaluation_task_refs: string;
}

interface MatrixResource {
  name: string;
  url: string;
  domain: string;
  type: string;
  catalog_level: string;
  prerequisite: string;
  access: string;
  evidence: EvidenceLevel;
  link_check_bucket: string;
}

interface MatrixTask {
  task_id: string;
  role_slug: string;
  task_type: string;
  task: string;
  evidence_required: string;
}

interface MatrixGap {
  gap_id: string;
  category: string;
  role_slug: string;
  role_name: string;
  summary: string;
  detail: string;
  priority: string;
  recommended_action: string;
  source: string;
}

interface MatrixCandidate {
  id: string;
  name: string;
  status: string;
  justification: string;
  recommended_form: string;
  split_triggers: string[];
  owned_conditional_capabilities: string[];
  draft_charter: Record<string, unknown>;
  /** Specialist fill 2026-11-21: fuller inventory + ET-CAND tasks, draft only. */
  specialist?: Record<string, unknown>;
}

interface Matrix {
  roles: MatrixRole[];
  resource_links: MatrixLink[];
  resources: MatrixResource[];
  evaluation_tasks: MatrixTask[];
  skill_mappings: Record<
    string,
    { consumer_role_count: number; consumer_roles: string[]; primary_consumers_note: string }
  >;
  gaps: MatrixGap[];
  new_role_candidates: MatrixCandidate[];
}

interface GapFillResource {
  url: string;
  license?: string;
  caveat?: string;
  addresses_gap?: string;
  verified?: string;
}

interface SpecialistFillResource {
  url: string;
  license?: string;
  caveat?: string;
  purpose?: string;
  verified?: string;
}

function loadMatrix(): {
  matrix: Matrix;
  gapFill: Map<string, GapFillResource>;
  spxFill: Map<string, SpecialistFillResource>;
  crxFill: Map<string, SpecialistFillResource>;
} {
  const matrix = JSON.parse(
    fs.readFileSync(path.join(DATA_DIR, "role_capability_matrix.json"), "utf8"),
  ) as Matrix;
  const gapFillRaw = JSON.parse(
    fs.readFileSync(path.join(DATA_DIR, "resource_gap_fill.json"), "utf8"),
  ) as { resources: GapFillResource[] };
  const gapFill = new Map(gapFillRaw.resources.map((r) => [r.url, r]));
  const spxFillRaw = JSON.parse(
    fs.readFileSync(path.join(DATA_DIR, "specialist_resource_fill.json"), "utf8"),
  ) as { resources: SpecialistFillResource[] };
  const spxFill = new Map(spxFillRaw.resources.map((r) => [r.url, r]));
  const crxFillRaw = JSON.parse(
    fs.readFileSync(path.join(DATA_DIR, "creative_resource_fill.json"), "utf8"),
  ) as { resources: SpecialistFillResource[] };
  const crxFill = new Map(crxFillRaw.resources.map((r) => [r.url, r]));
  return { matrix, gapFill, spxFill, crxFill };
}

/** Minimal structural db surface (works for both pool- and url-based connections). */
type Db = Pick<
  MySql2Database<typeof schema>,
  "query" | "insert" | "update" | "select" | "transaction"
>;

/** Rows per batched INSERT (keeps TiDB transactions small). */
const SEED_BATCH = 200;

/** Curated extended metadata (R2 fields) for the 21 platform skill packages. */
const SKILL_META: Record<
  string,
  Pick<
    SkillManifest,
    "role" | "inputArtifactTypes" | "outputArtifactTypes" | "toolsAllowed" | "costClass"
  >
> = {
  "agent-research-director": {
    role: "Agent Research Director / Orchestration Lead",
    inputArtifactTypes: ["research-brief", "evidence-matrix", "comparison-table"],
    outputArtifactTypes: ["plan", "synthesis-draft"],
    toolsAllowed: ["read", "summarize", "compare", "cite", "classify", "synthesize"],
    costClass: "high",
  },
  "architecture-and-built-heritage-research": {
    role: "Architectural Historian / Researcher",
    inputArtifactTypes: ["evidence-matrix"],
    outputArtifactTypes: ["research-brief"],
    toolsAllowed: ["read", "summarize", "cite", "classify"],
    costClass: "medium",
  },
  "computational-geometry-engineering": {
    role: "Research Scientist",
    inputArtifactTypes: ["research-brief", "evidence-matrix"],
    outputArtifactTypes: ["evidence-matrix"],
    toolsAllowed: ["read", "summarize", "classify"],
    costClass: "medium",
  },
  "defensive-reverse-engineering": {
    role: "Malware Analyst / Reverse Engineer",
    inputArtifactTypes: [],
    outputArtifactTypes: ["evidence-matrix", "research-brief"],
    toolsAllowed: ["read", "summarize", "classify", "cite"],
    costClass: "medium",
  },
  "engineering-job-market-intelligence": {
    role: "Market Research / Competitive Intelligence Analyst",
    inputArtifactTypes: [],
    outputArtifactTypes: ["evidence-matrix", "comparison-table"],
    toolsAllowed: ["read", "summarize", "compare", "cite", "classify"],
    costClass: "medium",
  },
  "engineering-organization-architect": {
    role: "Chief Technology Officer / VP Engineering",
    inputArtifactTypes: ["research-brief", "evidence-matrix"],
    outputArtifactTypes: ["research-brief", "decision-log"],
    toolsAllowed: ["read", "summarize", "compare", "synthesize"],
    costClass: "medium",
  },
  "spatial-3d-production-engineering": {
    role: "Software / Solutions Architect",
    inputArtifactTypes: ["research-brief"],
    outputArtifactTypes: ["comparison-table", "decision-log"],
    toolsAllowed: ["read", "summarize", "compare"],
    costClass: "medium",
  },
  "local-model-runtime-engineering": {
    role: "Research Engineer",
    inputArtifactTypes: ["evidence-matrix", "comparison-table"],
    outputArtifactTypes: ["decision-log", "research-brief"],
    toolsAllowed: ["read", "summarize", "compare", "cite"],
    costClass: "medium",
  },
  // ── Science & model-library packages (7 dedicated research agents) ──
  "mathematics-research": {
    role: "Mathematics Researcher",
    inputArtifactTypes: ["research-brief", "evidence-matrix"],
    outputArtifactTypes: ["research-brief", "evidence-matrix"],
    toolsAllowed: ["read", "summarize", "compute", "cite", "classify"],
    costClass: "medium",
  },
  "physics-research": {
    role: "Physics Researcher",
    inputArtifactTypes: ["research-brief", "evidence-matrix"],
    outputArtifactTypes: ["research-brief", "evidence-matrix"],
    toolsAllowed: ["read", "summarize", "compute", "cite", "classify"],
    costClass: "medium",
  },
  "chemistry-research": {
    role: "Chemistry Researcher",
    inputArtifactTypes: ["research-brief", "evidence-matrix"],
    outputArtifactTypes: ["research-brief", "evidence-matrix"],
    toolsAllowed: ["read", "summarize", "cite", "classify"],
    costClass: "medium",
  },
  "biology-research": {
    role: "Biology Researcher",
    inputArtifactTypes: ["research-brief", "evidence-matrix"],
    outputArtifactTypes: ["research-brief", "evidence-matrix"],
    toolsAllowed: ["read", "summarize", "cite", "classify"],
    costClass: "medium",
  },
  "science-history-research": {
    role: "Science History Researcher",
    inputArtifactTypes: ["research-brief", "evidence-matrix"],
    outputArtifactTypes: ["research-brief", "evidence-matrix"],
    toolsAllowed: ["read", "summarize", "cite", "classify"],
    costClass: "medium",
  },
  "game-reconstruction-engineering": {
    role: "Game Reconstruction Engineer",
    inputArtifactTypes: ["research-brief", "evidence-matrix"],
    outputArtifactTypes: ["evidence-matrix", "comparison-table"],
    toolsAllowed: ["read", "summarize", "compare", "cite", "classify"],
    costClass: "high",
  },
  "ai-open-model-research": {
    role: "AI Open-Model Researcher",
    inputArtifactTypes: ["research-brief", "evidence-matrix"],
    outputArtifactTypes: ["comparison-table", "evidence-matrix"],
    toolsAllowed: ["read", "summarize", "compare", "cite", "classify"],
    costClass: "high",
  },
  "ai-research-frontier": {
    role: "AI Research Director / Senior AI Research Scientist / Research Writer-Reproducibility Editor",
    inputArtifactTypes: ["research-brief", "evidence-matrix", "comparison-table"],
    outputArtifactTypes: ["research-brief", "evidence-matrix", "decision-log"],
    toolsAllowed: ["read", "summarize", "compare", "cite", "classify", "synthesize"],
    costClass: "high",
  },
  "architecture-database-backend-engineering": {
    role: "Software Solutions Architect / Database Engineer (DBA) / Backend Engineer",
    inputArtifactTypes: ["research-brief", "evidence-matrix", "comparison-table", "repo-casebook"],
    outputArtifactTypes: ["decision-log", "evidence-matrix", "lab-artifact", "evaluation-report"],
    toolsAllowed: ["read", "summarize", "compare", "cite", "classify", "synthesize", "verify"],
    costClass: "high",
  },
  "ui-ux-research-design-engineering": {
    role: "Product Psychology & Behavioral Design Lead / Frontend Engineer",
    inputArtifactTypes: ["research-brief", "evidence-matrix", "repo-casebook", "study-plan"],
    outputArtifactTypes: ["evidence-matrix", "lab-artifact", "evaluation-report", "synthesis-draft"],
    toolsAllowed: ["read", "summarize", "compare", "cite", "classify", "synthesize", "verify"],
    costClass: "high",
  },
  "civilization-art-design-research": {
    role: "Architectural Historian & Researcher / Computational Geometer & Applied Mathematician",
    inputArtifactTypes: ["research-brief", "evidence-matrix", "repo-casebook", "museum-record"],
    outputArtifactTypes: ["anchored-case-file", "symmetry-verdict", "lab-artifact", "evaluation-report"],
    toolsAllowed: ["read", "summarize", "compare", "cite", "classify", "verify", "generate"],
    costClass: "high",
  },
  "music-theory-production-engineering": {
    role: "Game Audio Designer-Programmer / Legal, Policy & Compliance Specialist",
    inputArtifactTypes: ["research-brief", "evidence-matrix", "repo-casebook", "audio-fixture"],
    outputArtifactTypes: ["tuning-analysis", "audio-artifact", "rights-register", "evaluation-report"],
    toolsAllowed: ["read", "summarize", "compare", "cite", "classify", "verify", "generate"],
    costClass: "high",
  },
  // 21st package (2026-11-21): Donna / shared assistants / repository steward.
  // Mapping-only integration (assistant_skill_mapping.json): the three
  // consumer roles below are the EXISTING slugs; the package adds no
  // resources, links, or evaluation tasks to the matrix.
  "executive-operations-assistant": {
    role: "Agent Research Director & Orchestration Lead / Knowledge Transfer & Learning Systems Manager / API Integration Engineer",
    inputArtifactTypes: ["research-brief", "evidence-matrix", "action-proposal", "schedule-record"],
    outputArtifactTypes: ["plan", "action-proposal", "routing-decision", "evaluation-report"],
    toolsAllowed: ["read", "summarize", "compare", "classify", "synthesize", "verify"],
    costClass: "high",
  },
};

export interface MatrixSeedCounts {
  roles: number;
  resources: number;
  profiles: number;
  links: number;
  evaluationTasks: number;
  gaps: number;
  skillMappings: number;
  candidates: number;
}

/**
 * Seed the normalized role/resource matrix. Idempotent: every insert is
 * keyed on a stable matrix id and skipped when present; pre-existing
 * resource rows only get their evidence/stale columns backfilled.
 */
/**
 * Insert `rows` in batches, ignoring natural-key collisions (idempotent and
 * race-safe: a concurrent or previously-killed seed run can never cause an
 * ER_DUP_ENTRY abort). Returns the number of rows that were missing at load
 * time (i.e. the attempted inserts).
 */
async function batchUpsert<T>(
  db: Db,
  insert: (batch: T[]) => Promise<unknown>,
  rows: T[],
): Promise<number> {
  for (let i = 0; i < rows.length; i += SEED_BATCH) {
    const batch = rows.slice(i, i + SEED_BATCH);
    if (batch.length) await insert(batch);
  }
  return rows.length;
}

export async function seedRegistryMatrix(db: Db): Promise<MatrixSeedCounts> {
  const { matrix, gapFill, spxFill, crxFill } = loadMatrix();
  const atlasByUrl = new Map(RESOURCES.map((r) => [r.url, r]));

  // ── One batched lookup per table: existing natural keys ──
  const [
    existingRoleNames,
    existingResources,
    existingProfileSlugs,
    existingLinkIds,
    existingTaskIds,
    existingGapIds,
    existingPacks,
    existingCandidateSlugs,
  ] = await Promise.all([
    db.select({ name: registryRoles.name }).from(registryRoles),
    db
      .select({
        id: registryResources.id,
        url: registryResources.url,
        evidenceLevel: registryResources.evidenceLevel,
        stale: registryResources.stale,
      })
      .from(registryResources),
    db
      .select({ slug: registryRoleProfiles.slug, skillPacks: registryRoleProfiles.skillPacks })
      .from(registryRoleProfiles),
    db.select({ linkId: registryRoleResourceLinks.linkId }).from(registryRoleResourceLinks),
    db.select({ taskId: registryRoleEvaluationTasks.taskId }).from(registryRoleEvaluationTasks),
    db.select({ gapId: registryGaps.gapId }).from(registryGaps),
    db.select({ skillPack: registrySkillMappings.skillPack }).from(registrySkillMappings),
    db.select({ slug: registryRoleCandidates.slug }).from(registryRoleCandidates),
  ]);
  const roleNames = new Set(existingRoleNames.map((r) => r.name));
  const resourceByUrl = new Map(existingResources.map((r) => [r.url, r]));
  const profileBySlug = new Map(existingProfileSlugs.map((r) => [r.slug, r]));
  const profileSlugs = new Set(profileBySlug.keys());
  const linkIds = new Set(existingLinkIds.map((r) => r.linkId));
  const taskIds = new Set(existingTaskIds.map((r) => r.taskId));
  const gapIds = new Set(existingGapIds.map((r) => r.gapId));
  const packs = new Set(existingPacks.map((r) => r.skillPack));
  const candidateSlugs = new Set(existingCandidateSlugs.map((r) => r.slug));

  const counts: MatrixSeedCounts = {
    roles: 0,
    resources: 0,
    profiles: 0,
    links: 0,
    evaluationTasks: 0,
    gaps: 0,
    skillMappings: 0,
    candidates: 0,
  };

  await db.transaction(async (tx) => {
    // ── Base roles (display rows; keyed on unique name) ──
    const newRoles = ROLES.filter((r) => !roleNames.has(r.name)).map((r) => ({
      name: r.name,
      family: r.function,
      mission: r.mission,
      outputs: r.outputs,
      skills: r.skills,
      senior: r.senior,
      interfaces: r.interfaces,
      source: r.source,
    }));
    counts.roles = await batchUpsert(
      tx,
      (batch) =>
        tx
          .insert(registryRoles)
          .values(batch)
          .onDuplicateKeyUpdate({ set: { name: sql`${registryRoles.name}` } }),
      newRoles,
    );

    // ── Resources (all 436 post-gap-fill + specialist-fill + creative-fill; keyed on unique url) ──
    const newResources = [];
    for (const r of matrix.resources) {
      const atlas = atlasByUrl.get(r.url);
      const fill = gapFill.get(r.url);
      const spx = spxFill.get(r.url);
      const crx = crxFill.get(r.url);
      const stale = r.evidence === "E0-stale" || r.link_check_bucket.includes("404");
      const existing = resourceByUrl.get(r.url);
      if (existing) {
        // Backfill only the matrix columns on pre-existing rows.
        if (existing.evidenceLevel !== r.evidence || existing.stale !== stale) {
          await tx
            .update(registryResources)
            .set({ evidenceLevel: r.evidence, linkCheck: r.link_check_bucket, stale })
            .where(eq(registryResources.id, existing.id));
        }
        continue;
      }
      newResources.push({
        domain: r.domain,
        name: r.name.slice(0, 500),
        type: r.type,
        level: r.catalog_level,
        url: r.url,
        purpose: atlas?.purpose ?? spx?.purpose ?? crx?.purpose ?? fill?.addresses_gap ?? `${r.type} for ${r.domain}`,
        prereqs: r.prerequisite,
        access: r.access,
        license: atlas?.license ?? spx?.license ?? crx?.license ?? fill?.license ?? "See source terms",
        caveat: atlas?.caveat ?? spx?.caveat ?? crx?.caveat ?? fill?.caveat ?? "",
        verified: atlas?.verified ?? spx?.verified ?? crx?.verified ?? fill?.verified ?? "2026-11-20",
        evidenceLevel: r.evidence,
        linkCheck: r.link_check_bucket,
        stale,
      });
    }
    counts.resources = await batchUpsert(
      tx,
      (batch) =>
        tx
          .insert(registryResources)
          .values(batch)
          .onDuplicateKeyUpdate({ set: { url: sql`${registryResources.url}` } }),
      newResources,
    );

    // ── Role profiles (keyed on slug) ──
    const newProfiles = matrix.roles
      .filter((r) => !profileSlugs.has(r.slug))
      .map((r) => ({
        slug: r.slug,
        roleIndex: r.role_index,
        name: r.name,
        family: r.function,
        mission: r.mission,
        seniorScope: r.senior_scope,
        requiredCapabilities: r.required_capabilities,
        interfaces: r.interfaces,
        crossCuttingOwnership: r.cross_cutting_ownership,
        charterSource: r.charter_source,
        charterEvidenceLevel: r.evidence_level.charter,
        resourcesVerifiedNote: r.evidence_level.resources_verified.slice(0, 255),
        depthScore: r.depth.depth_score,
        depthBand: r.depth.depth_band,
        depthHeuristic: DEPTH_HEURISTIC_LABEL,
        depthFactors: r.depth,
        capabilityGaps: r.capability_gaps,
        decompositionVerdict: r.decomposition.verdict as "split_at_scale",
        decompositionTriggers: r.decomposition.triggers,
        decompositionNotes: r.decomposition.notes,
        scientificResources: r.scientific_and_model_resources,
        skillPacks: r.skill_packs,
      }));
    counts.profiles = await batchUpsert(
      tx,
      (batch) =>
        tx
          .insert(registryRoleProfiles)
          .values(batch)
          .onDuplicateKeyUpdate({ set: { slug: sql`${registryRoleProfiles.slug}` } }),
      newProfiles,
    );
    // Pre-existing profiles: the matrix owns skill-pack assignments, so
    // reseeds upsert skillPacks when the matrix changed them. All other
    // profile columns are left untouched.
    for (const r of matrix.roles) {
      const existing = profileBySlug.get(r.slug);
      if (!existing) continue;
      if (JSON.stringify(existing.skillPacks) !== JSON.stringify(r.skill_packs)) {
        await tx
          .update(registryRoleProfiles)
          .set({ skillPacks: r.skill_packs })
          .where(eq(registryRoleProfiles.slug, r.slug));
      }
    }

    // ── Role → resource links (keyed on RL-xxxx) ──
    const licenseByUrl = new Map<string, string>();
    for (const r of matrix.resources) {
      licenseByUrl.set(
        r.url,
        atlasByUrl.get(r.url)?.license ??
          spxFill.get(r.url)?.license ??
          crxFill.get(r.url)?.license ??
          gapFill.get(r.url)?.license ??
          "",
      );
    }
    const staleUrl = new Map(matrix.resources.map((r) => [r.url, r.evidence === "E0-stale"]));
    const newLinks = matrix.resource_links
      .filter((l) => !linkIds.has(l.link_id))
      .map((l) => ({
        linkId: l.link_id,
        roleSlug: l.role_slug,
        resourceUrl: l.resource_url,
        resourceName: l.resource_name.slice(0, 500),
        domain: l.domain.slice(0, 255),
        type: l.type.slice(0, 120),
        catalogLevel: l.catalog_level.slice(0, 255),
        prerequisite: l.prerequisite.slice(0, 500),
        flag: l.flag,
        tier: l.tier,
        evidence: l.evidence,
        access: l.access.slice(0, 255),
        license: (licenseByUrl.get(l.resource_url) ?? "").slice(0, 255),
        trigger: l.trigger.slice(0, 500),
        evaluationTaskRefs: l.evaluation_task_refs
          .split(";")
          .map((s) => s.trim())
          .filter(Boolean),
        stale: staleUrl.get(l.resource_url) ?? l.evidence === "E0-stale",
      }));
    counts.links = await batchUpsert(
      tx,
      (batch) =>
        tx
          .insert(registryRoleResourceLinks)
          .values(batch)
          .onDuplicateKeyUpdate({ set: { linkId: sql`${registryRoleResourceLinks.linkId}` } }),
      newLinks,
    );

    // ── Evaluation tasks (keyed on ET-xxx-y) ──
    const newTasks = matrix.evaluation_tasks
      .filter((t) => !taskIds.has(t.task_id))
      .map((t) => ({
        taskId: t.task_id,
        roleSlug: t.role_slug,
        taskType: t.task_type,
        task: t.task,
        evidenceRequired: t.evidence_required,
      }));
    counts.evaluationTasks = await batchUpsert(
      tx,
      (batch) =>
        tx
          .insert(registryRoleEvaluationTasks)
          .values(batch)
          .onDuplicateKeyUpdate({
            set: { taskId: sql`${registryRoleEvaluationTasks.taskId}` },
          }),
      newTasks,
    );

    // ── Audit gaps (keyed on GAP-xxx) ──
    const newGaps = matrix.gaps
      .filter((g) => !gapIds.has(g.gap_id))
      .map((g) => ({
        gapId: g.gap_id,
        category: g.category,
        roleSlug: g.role_slug ?? "",
        roleName: (g.role_name ?? "").slice(0, 500),
        summary: g.summary,
        detail: g.detail,
        priority: g.priority,
        recommendedAction: g.recommended_action,
        source: g.source.slice(0, 500),
      }));
    counts.gaps = await batchUpsert(
      tx,
      (batch) =>
        tx
          .insert(registryGaps)
          .values(batch)
          .onDuplicateKeyUpdate({ set: { gapId: sql`${registryGaps.gapId}` } }),
      newGaps,
    );

    // ── Skill-pack mappings (keyed on pack name) ──
    // Pre-existing packs get their matrix-owned consumer columns upserted so
    // a reseed picks up changed consumer role lists, not just missing packs.
    const newMappings: Array<{
      skillPack: string;
      consumerRoleCount: number;
      consumerRoles: string[];
      note: string;
    }> = [];
    for (const [pack, m] of Object.entries(matrix.skill_mappings)) {
      const row = {
        skillPack: pack,
        consumerRoleCount: m.consumer_role_count,
        consumerRoles: m.consumer_roles,
        note: m.primary_consumers_note.slice(0, 1000),
      };
      if (packs.has(pack)) {
        await tx
          .update(registrySkillMappings)
          .set({
            consumerRoleCount: row.consumerRoleCount,
            consumerRoles: row.consumerRoles,
            note: row.note,
          })
          .where(eq(registrySkillMappings.skillPack, pack));
        continue;
      }
      newMappings.push(row);
    }
    counts.skillMappings = await batchUpsert(
      tx,
      (batch) =>
        tx
          .insert(registrySkillMappings)
          .values(batch)
          .onDuplicateKeyUpdate({ set: { skillPack: sql`${registrySkillMappings.skillPack}` } }),
      newMappings,
    );

    // ── Proposed role candidates — NEVER standing roles ──
    const candidateRow = (c: (typeof matrix.new_role_candidates)[number]) => ({
      slug: c.id,
      name: c.name.slice(0, 500),
      status: "candidate",
      justification: c.justification,
      recommendedForm: c.recommended_form,
      splitTriggers: c.split_triggers,
      ownedConditionalCapabilities: c.owned_conditional_capabilities,
      // draft charter plus the 2026-11-21 specialist extension (fuller
      // inventory + ET-CAND evaluations) — draft data only, never a
      // standing role and never a depth score.
      draftCharter: { ...c.draft_charter, ...(c.specialist ? { specialist: c.specialist } : {}) },
    });
    for (const c of matrix.new_role_candidates.filter((c) => candidateSlugs.has(c.id))) {
      const row = candidateRow(c);
      await tx
        .update(registryRoleCandidates)
        .set({
          name: row.name,
          status: row.status,
          justification: row.justification,
          recommendedForm: row.recommendedForm,
          splitTriggers: row.splitTriggers,
          ownedConditionalCapabilities: row.ownedConditionalCapabilities,
          draftCharter: row.draftCharter,
        })
        .where(eq(registryRoleCandidates.slug, row.slug));
    }
    const newCandidates = matrix.new_role_candidates
      .filter((c) => !candidateSlugs.has(c.id))
      .map(candidateRow);
    counts.candidates = await batchUpsert(
      tx,
      (batch) =>
        tx
          .insert(registryRoleCandidates)
          .values(batch)
          .onDuplicateKeyUpdate({ set: { slug: sql`${registryRoleCandidates.slug}` } }),
      newCandidates,
    );
  });

  return counts;
}

/** Seed the 21 curated workspace skill packages (idempotent per name@version). */
export async function seedSkillPackages(db: Db): Promise<number> {
  let skillsAdded = 0;
  for (const [dirName, meta] of Object.entries(SKILL_META)) {
    const dir = path.join(SKILL_SEED_ROOT, dirName);
    const skillPath = path.join(dir, "SKILL.md");
    if (!fs.existsSync(skillPath)) {
      console.warn(`skill source missing, skipped: ${skillPath}`);
      continue;
    }
    const text = fs.readFileSync(skillPath, "utf8");
    const intake = intakeSkillMarkdown(text);
    const manifest: SkillManifest = { ...intake.manifest, ...meta };
    const existing = await db.query.skills.findFirst({
      where: and(
        eq(skills.name, manifest.name),
        eq(skills.version, manifest.version),
      ),
    });
    if (existing) continue;
    const [row] = await db.insert(skills).values({
      ownerId: null, // platform-curated seed
      name: manifest.name,
      version: manifest.version,
      description: manifest.description,
      manifest,
      bodyText: intake.body,
      riskSignals: intake.riskSignals,
      contentSha256: intake.contentSha256,
      status: "vetted",
      provenanceUrl: "workspace-curated:skill-package",
      licenseDeclared: manifest.licenseDeclared || "workspace-curated",
      reviewedBy: "platform-seed",
      reviewedAt: new Date(),
      reviewNote:
        "Platform-curated skill package shipped with the atlas workspace; hashed and inventoried at seed time.",
    });
    const skillId = Number(row.insertId);
    const files: Array<{
      skillId: number;
      path: string;
      size: number;
      sha256: string;
      kind: "body" | "script" | "reference" | "asset";
    }> = [];
    const walk = (d: string, prefix: string) => {
      for (const ent of fs.readdirSync(d, { withFileTypes: true })) {
        const rel = prefix ? `${prefix}/${ent.name}` : ent.name;
        const full = path.join(d, ent.name);
        if (ent.isDirectory()) {
          walk(full, rel);
        } else {
          const buf = fs.readFileSync(full);
          files.push({
            skillId,
            path: rel,
            size: buf.length,
            sha256: sha256Hex(buf),
            kind: classifySkillFile(rel) as "body" | "script" | "reference" | "asset",
          });
        }
      }
    };
    walk(dir, "");
    for (const f of files) await db.insert(skillFiles).values(f);
    skillsAdded++;
    console.log(
      `seeded skill ${manifest.name}@${manifest.version} (${files.length} files, ${intake.riskSignals.length} risk signals)`,
    );
  }
  return skillsAdded;
}

async function main() {
  const pool = mysql.createPool(process.env.DATABASE_URL!);
  const db = drizzle(pool, { schema, mode: "planetscale" });
  const counts = await seedRegistryMatrix(db);
  const skillsAdded = await seedSkillPackages(db);
  console.log(
    `seed complete: +${counts.roles} roles, +${counts.resources} resources, ` +
      `+${counts.profiles} profiles, +${counts.links} links, +${counts.evaluationTasks} tasks, ` +
      `+${counts.gaps} gaps, +${counts.skillMappings} mappings, +${counts.candidates} candidates, ` +
      `+${skillsAdded} skills`,
  );
  await pool.end();
}

const isMain =
  !!process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
