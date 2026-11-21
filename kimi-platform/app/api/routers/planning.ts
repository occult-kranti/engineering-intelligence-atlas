import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, like } from "drizzle-orm";
import { createHash } from "node:crypto";
import { createRouter, authedQuery } from "../middleware";
import { getDb } from "../queries/connection";
import {
  dagRevisions,
  ownerSettings,
  projects,
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
} from "@db/schema";
import {
  GOAL_MODES,
  GOAL_MODE_PROVIDERS,
  GOAL_MODE_SETTINGS_PREFIX,
  GoalModePresetSchema,
  GoalModeProviderSchema,
  type GoalModePresets,
} from "@contracts/office";
import {
  DEFAULT_GOAL_MODE_PRESETS,
  DISPATCHABLE_STRATEGY_IDS,
  isDispatchableGoalModePreset,
  resolveGoalModePresets,
} from "../office/goal-modes";
import { DagSpecSchema, defaultRunBudget } from "@contracts/dag";
import {
  AI_ERROR_COPY,
  AI_ERROR_KINDS,
  ProviderIdSchema,
  PricingRateSchema,
  type AiErrorKind,
} from "@contracts/run";
import { SKILL_TRANSITIONS, type SkillStatus } from "@contracts/skill";
import { validateDag } from "../engine/dag-validate";
import { makeValidationContext } from "../engine/context";
import { liveProposal, mockProposal, type RegistrySlice } from "../engine/propose";
import type { LinkedResource, RoleCoverage } from "@contracts/registry";
import { DEPTH_HEURISTIC_LABEL } from "@contracts/registry";
import { getOwnedProject } from "../engine/scheduler";
import { getProvider, providerAvailability } from "../ai/provider";
import { listGatewayModels } from "../ai/list-models";
import { intakeSkillMarkdown } from "../registry/intake";
import { listOwnerPricing, setOwnerPricing } from "../engine/pricing";

/** Map a typed AI error to a TRPCError carrying the stable degradation copy. */
export function mapAiErr(err: unknown): TRPCError {
  const name = (err as Error)?.name ?? "";
  if ((AI_ERROR_KINDS as readonly string[]).includes(name)) {
    return new TRPCError({
      code: name === "AiMisconfigured" ? "PRECONDITION_FAILED" : "BAD_REQUEST",
      message: AI_ERROR_COPY[name as AiErrorKind],
      cause: err,
    });
  }
  return new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: "AI call failed",
    cause: err,
  });
}

export async function mustOwnProject(userId: number, projectId: number) {
  const p = await getOwnedProject(userId, projectId);
  if (!p) throw new TRPCError({ code: "NOT_FOUND", message: "project not found" });
  return p;
}

const planHash = (spec: unknown) =>
  createHash("sha256").update(JSON.stringify(spec)).digest("hex");

// ── Projects ─────────────────────────────────────────────────────

const projectsRouter = createRouter({
  list: authedQuery.query(async ({ ctx }) => {
    return getDb()
      .select()
      .from(projects)
      .where(eq(projects.ownerId, ctx.user.id))
      .orderBy(desc(projects.createdAt));
  }),
  get: authedQuery
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ ctx, input }) => mustOwnProject(ctx.user.id, input.id)),
  create: authedQuery
    .input(
      z.object({
        name: z.string().min(1).max(255),
        goal: z.string().min(1).max(8000),
        riskTier: z.enum(["low", "medium", "high"]).default("medium"),
        budget: DagSpecSchema.shape.budget.optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const [row] = await db.insert(projects).values({
        ownerId: ctx.user.id,
        name: input.name,
        goal: input.goal,
        riskTier: input.riskTier,
        status: "active",
      });
      const projectId = Number(row.insertId);
      const spec = {
        revision: 1,
        nodes: [],
        edges: [],
        budget: input.budget ?? defaultRunBudget(),
      };
      await db.insert(dagRevisions).values({
        projectId,
        revision: 1,
        spec,
        planHash: planHash(spec),
        createdBy: ctx.user.id,
      });
      return mustOwnProject(ctx.user.id, projectId);
    }),
  rename: authedQuery
    .input(z.object({ id: z.number().int().positive(), name: z.string().min(1).max(255) }))
    .mutation(async ({ ctx, input }) => {
      await mustOwnProject(ctx.user.id, input.id);
      await getDb().update(projects).set({ name: input.name }).where(eq(projects.id, input.id));
      return { ok: true };
    }),
  archive: authedQuery
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      await mustOwnProject(ctx.user.id, input.id);
      await getDb().update(projects).set({ status: "archived" }).where(eq(projects.id, input.id));
      return { ok: true };
    }),
});

// ── DAG revisions ────────────────────────────────────────────────

const dagRouter = createRouter({
  revisions: authedQuery
    .input(z.object({ projectId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      await mustOwnProject(ctx.user.id, input.projectId);
      return getDb()
        .select()
        .from(dagRevisions)
        .where(eq(dagRevisions.projectId, input.projectId))
        .orderBy(desc(dagRevisions.revision));
    }),
  validate: authedQuery
    .input(z.object({ projectId: z.number().int().positive(), spec: z.unknown() }))
    .mutation(async ({ ctx, input }) => {
      await mustOwnProject(ctx.user.id, input.projectId);
      return validateDag(input.spec, makeValidationContext());
    }),
  save: authedQuery
    .input(z.object({ projectId: z.number().int().positive(), spec: z.unknown() }))
    .mutation(async ({ ctx, input }) => {
      await mustOwnProject(ctx.user.id, input.projectId);
      const db = getDb();
      const result = await validateDag(input.spec, makeValidationContext());
      if (!result.ok) {
        return { saved: false as const, violations: result.violations };
      }
      const spec = DagSpecSchema.parse(input.spec);
      const [latest] = await db
        .select({ revision: dagRevisions.revision })
        .from(dagRevisions)
        .where(eq(dagRevisions.projectId, input.projectId))
        .orderBy(desc(dagRevisions.revision))
        .limit(1);
      const revision = (latest?.revision ?? 0) + 1;
      const stored = { ...spec, revision };
      const [row] = await db.insert(dagRevisions).values({
        projectId: input.projectId,
        revision,
        spec: stored,
        planHash: planHash(stored),
        createdBy: ctx.user.id,
      });
      return {
        saved: true as const,
        revisionId: Number(row.insertId),
        revision,
        planHash: planHash(stored),
        violations: [],
      };
    }),
  /** Plan approval freezes the stored revision + hash. Any edit creates a new
   * revision with approvedAt=null — approval is invalidated automatically. */
  approve: authedQuery
    .input(
      z.object({
        projectId: z.number().int().positive(),
        revisionId: z.number().int().positive(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await mustOwnProject(ctx.user.id, input.projectId);
      const db = getDb();
      const rev = await db.query.dagRevisions.findFirst({
        where: and(
          eq(dagRevisions.id, input.revisionId),
          eq(dagRevisions.projectId, input.projectId),
        ),
      });
      if (!rev) throw new TRPCError({ code: "NOT_FOUND", message: "revision not found" });
      const result = await validateDag(rev.spec, makeValidationContext());
      if (!result.ok) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `cannot approve an invalid plan: ${result.violations[0]?.message ?? "validation failed"}`,
        });
      }
      await db
        .update(dagRevisions)
        .set({ approvedBy: ctx.user.id, approvedAt: new Date() })
        .where(eq(dagRevisions.id, rev.id));
      return { ok: true, planHash: rev.planHash, revision: rev.revision };
    }),
  /** Director squad proposal — returns an unsaved draft for human edit+approval. */
  proposeSquad: authedQuery
    .input(
      z.object({
        projectId: z.number().int().positive(),
        provider: ProviderIdSchema,
        model: z.string().max(200).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const project = await mustOwnProject(ctx.user.id, input.projectId);
      const db = getDb();
      const registry = await loadRegistrySlice(db);
      const [latest] = await db
        .select({ revision: dagRevisions.revision })
        .from(dagRevisions)
        .where(eq(dagRevisions.projectId, input.projectId))
        .orderBy(desc(dagRevisions.revision))
        .limit(1);
      const nextRevision = (latest?.revision ?? 0) + 1;

      if (input.provider === "mock") {
        const { spec, coverage } = mockProposal(project.goal, nextRevision, registry);
        return {
          provider: "mock" as const,
          usedModel: "mock-deterministic",
          spec,
          coverage,
        };
      }
      const provider = await getProvider(input.provider);
      const avail = provider.availabilityFor
        ? await provider.availabilityFor(ctx.user.id)
        : provider.availability();
      if (!avail.configured) {
        // Deterministic mock proposal when the selected live provider is
        // unconfigured — clearly labeled, never silently billed.
        const { spec, coverage } = mockProposal(project.goal, nextRevision, registry);
        return {
          provider: "mock" as const,
          usedModel: "mock-deterministic",
          degradedFrom: input.provider,
          degradedReason: avail.reason ?? "provider not configured",
          spec,
          coverage,
        };
      }
      try {
        const { spec, usedModel, coverage } = await liveProposal(
          input.provider,
          input.model,
          project.goal,
          nextRevision,
          registry,
          ctx.user.id,
        );
        return { provider: input.provider, usedModel, spec, coverage };
      } catch (err) {
        throw mapAiErr(err);
      }
    }),
});

/** Registry slice for squad proposals: roles + matrix profiles + role links. */
async function loadRegistrySlice(db: ReturnType<typeof getDb>): Promise<RegistrySlice> {
  const [roleRows, profileRows, linkRows, skillRows] = await Promise.all([
    db.select({ name: registryRoles.name }).from(registryRoles),
    db
      .select({
        name: registryRoleProfiles.name,
        slug: registryRoleProfiles.slug,
        depthScore: registryRoleProfiles.depthScore,
        depthBand: registryRoleProfiles.depthBand,
        capabilityGaps: registryRoleProfiles.capabilityGaps,
      })
      .from(registryRoleProfiles),
    db.select().from(registryRoleResourceLinks),
    db.select().from(skills).where(eq(skills.status, "vetted")),
  ]);
  const profilesByRole: RegistrySlice["profilesByRole"] = new Map(
    profileRows.map((p) => [
      p.name,
      {
        slug: p.slug,
        depthScore: p.depthScore,
        depthBand: p.depthBand,
        capabilityGaps: p.capabilityGaps,
      },
    ]),
  );
  const nameBySlug = new Map(profileRows.map((p) => [p.slug, p.name]));
  const linksByRole: RegistrySlice["linksByRole"] = new Map();
  for (const l of linkRows) {
    // Group links under the role NAME (node contracts reference names).
    const roleName = nameBySlug.get(l.roleSlug);
    if (!roleName) continue;
    const linked: LinkedResource = {
      linkId: l.linkId,
      roleSlug: l.roleSlug,
      url: l.resourceUrl,
      name: l.resourceName,
      domain: l.domain,
      type: l.type,
      flag: l.flag,
      tier: l.tier,
      evidence: l.evidence,
      access: l.access,
      license: l.license,
      trigger: l.trigger,
      stale: l.stale,
    };
    const arr = linksByRole.get(roleName) ?? [];
    arr.push(linked);
    linksByRole.set(roleName, arr);
  }
  return {
    roles: roleRows.map((r) => r.name),
    profilesByRole,
    linksByRole,
    vettedSkills: skillRows,
  };
}

// ── Registry (roles / resources / skills) ────────────────────────

const registryRouter = createRouter({
  roles: authedQuery
    .input(z.object({ search: z.string().max(200).optional() }))
    .query(async ({ input }) => {
      const db = getDb();
      if (input.search) {
        return db
          .select()
          .from(registryRoles)
          .where(like(registryRoles.name, `%${input.search}%`))
          .limit(100);
      }
      return db.select().from(registryRoles).limit(300);
    }),
  resources: authedQuery
    .input(z.object({ search: z.string().max(200).optional() }))
    .query(async ({ input }) => {
      const db = getDb();
      if (input.search) {
        return db
          .select()
          .from(registryResources)
          .where(like(registryResources.name, `%${input.search}%`))
          .limit(100);
      }
      return db.select().from(registryResources).limit(400);
    }),
  /**
   * Role-coverage summary for the UI: every standing role with its depth
   * score (explicit heuristic label), explicit gap labels, link counts by
   * scope flag, stale-link count, and evaluation-task count.
   */
  roleCoverage: authedQuery.query(async (): Promise<RoleCoverage[]> => {
    const db = getDb();
    const [profiles, links, tasks] = await Promise.all([
      db.select().from(registryRoleProfiles),
      db
        .select({
          roleSlug: registryRoleResourceLinks.roleSlug,
          flag: registryRoleResourceLinks.flag,
          stale: registryRoleResourceLinks.stale,
        })
        .from(registryRoleResourceLinks),
      db
        .select({
          roleSlug: registryRoleEvaluationTasks.roleSlug,
          taskId: registryRoleEvaluationTasks.taskId,
        })
        .from(registryRoleEvaluationTasks),
    ]);
    const linksBy = new Map<string, { core: number; internal: number; conditional: number; stale: number }>();
    for (const l of links) {
      const c = linksBy.get(l.roleSlug) ?? { core: 0, internal: 0, conditional: 0, stale: 0 };
      c[l.flag] += 1;
      if (l.stale) c.stale += 1;
      linksBy.set(l.roleSlug, c);
    }
    const taskCountBy = new Map<string, number>();
    for (const t of tasks) taskCountBy.set(t.roleSlug, (taskCountBy.get(t.roleSlug) ?? 0) + 1);
    return profiles
      .map((p) => ({
        slug: p.slug,
        name: p.name,
        family: p.family,
        depthScore: p.depthScore,
        depthBand: p.depthBand,
        depthHeuristic: p.depthHeuristic || DEPTH_HEURISTIC_LABEL,
        decompositionVerdict: p.decompositionVerdict,
        gapLabels: p.capabilityGaps,
        linkCounts: linksBy.get(p.slug) ?? { core: 0, internal: 0, conditional: 0, stale: 0 },
        evaluationTaskCount: taskCountBy.get(p.slug) ?? 0,
        skillPacks: p.skillPacks,
      }))
      .sort((a, b) => a.slug.localeCompare(b.slug));
  }),
  /** Full role detail: profile, linked resources, evaluation tasks, gaps. */
  roleDetail: authedQuery
    .input(z.object({ slug: z.string().min(1).max(255) }))
    .query(async ({ input }) => {
      const db = getDb();
      const profile = await db.query.registryRoleProfiles.findFirst({
        where: eq(registryRoleProfiles.slug, input.slug),
      });
      if (!profile) throw new TRPCError({ code: "NOT_FOUND", message: "role not found" });
      const [links, tasks, gaps] = await Promise.all([
        db
          .select()
          .from(registryRoleResourceLinks)
          .where(eq(registryRoleResourceLinks.roleSlug, input.slug)),
        db
          .select()
          .from(registryRoleEvaluationTasks)
          .where(eq(registryRoleEvaluationTasks.roleSlug, input.slug)),
        db.select().from(registryGaps).where(eq(registryGaps.roleSlug, input.slug)),
      ]);
      return {
        profile: {
          slug: profile.slug,
          name: profile.name,
          family: profile.family,
          mission: profile.mission,
          seniorScope: profile.seniorScope,
          requiredCapabilities: profile.requiredCapabilities,
          interfaces: profile.interfaces,
          crossCuttingOwnership: profile.crossCuttingOwnership,
          charterSource: profile.charterSource,
          charterEvidenceLevel: profile.charterEvidenceLevel,
          resourcesVerifiedNote: profile.resourcesVerifiedNote,
          depthScore: profile.depthScore,
          depthBand: profile.depthBand,
          depthHeuristic: profile.depthHeuristic || DEPTH_HEURISTIC_LABEL,
          depthFactors: profile.depthFactors,
          decomposition: {
            verdict: profile.decompositionVerdict,
            triggers: profile.decompositionTriggers,
            notes: profile.decompositionNotes,
          },
          scientificResources: profile.scientificResources,
          skillPacks: profile.skillPacks,
        },
        gapLabels: profile.capabilityGaps,
        resources: links.map((l) => ({
          linkId: l.linkId,
          url: l.resourceUrl,
          name: l.resourceName,
          domain: l.domain,
          type: l.type,
          catalogLevel: l.catalogLevel,
          prerequisite: l.prerequisite,
          flag: l.flag,
          tier: l.tier,
          evidence: l.evidence,
          access: l.access,
          license: l.license,
          trigger: l.trigger,
          stale: l.stale,
          evaluationTaskRefs: l.evaluationTaskRefs,
        })),
        evaluationTasks: tasks.map((t) => ({
          taskId: t.taskId,
          taskType: t.taskType,
          task: t.task,
          evidenceRequired: t.evidenceRequired,
        })),
        gaps: gaps.map((g) => ({
          gapId: g.gapId,
          category: g.category,
          summary: g.summary,
          priority: g.priority,
          recommendedAction: g.recommendedAction,
        })),
      };
    }),
  /**
   * Proposed role candidates (e.g. Product Designer / UX Researcher). These
   * are candidates only — never standing roles, never dispatchable.
   */
  roleCandidates: authedQuery.query(async () => {
    return getDb().select().from(registryRoleCandidates);
  }),
  /** Skill-pack → consuming-role mappings (15 curated packs). */
  skillMappings: authedQuery.query(async () => {
    return getDb().select().from(registrySkillMappings);
  }),
  skills: authedQuery.query(async () => {
    const rows = await getDb().select().from(skills).orderBy(skills.name);
    const counts = await getDb().select().from(skillFiles);
    const countBy = new Map<number, number>();
    for (const f of counts) countBy.set(f.skillId, (countBy.get(f.skillId) ?? 0) + 1);
    return rows.map((s) => ({ ...s, fileCount: countBy.get(s.id) ?? 0 }));
  }),
  skillDetail: authedQuery
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ input }) => {
      const db = getDb();
      const skill = await db.query.skills.findFirst({ where: eq(skills.id, input.id) });
      if (!skill) throw new TRPCError({ code: "NOT_FOUND" });
      const files = await db
        .select()
        .from(skillFiles)
        .where(eq(skillFiles.skillId, input.id));
      return { ...skill, files };
    }),
  /** Pasted/uploaded SKILL.md → quarantined draft. Never executes content. */
  registerSkill: authedQuery
    .input(
      z.object({
        content: z.string().min(20).max(500_000),
        provenanceUrl: z.string().max(1000).default(""),
        licenseDeclared: z.string().max(255).default(""),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      let intake;
      try {
        intake = intakeSkillMarkdown(input.content);
      } catch (err) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `intake failed: ${(err as Error).message}`,
        });
      }
      const dup = await db.query.skills.findFirst({
        where: and(
          eq(skills.name, intake.manifest.name),
          eq(skills.version, intake.manifest.version),
        ),
      });
      if (dup) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `skill ${intake.manifest.name}@${intake.manifest.version} already exists in the registry`,
        });
      }
      const [row] = await db.insert(skills).values({
        ownerId: ctx.user.id,
        name: intake.manifest.name,
        version: intake.manifest.version,
        description: intake.manifest.description,
        manifest: intake.manifest,
        bodyText: intake.body,
        riskSignals: intake.riskSignals,
        contentSha256: intake.contentSha256,
        status: "quarantined",
        provenanceUrl: input.provenanceUrl,
        licenseDeclared: input.licenseDeclared,
      });
      const skillId = Number(row.insertId);
      await db.insert(skillFiles).values({
        skillId,
        path: "SKILL.md",
        size: Buffer.byteLength(input.content),
        sha256: intake.contentSha256,
        kind: "body",
      });
      return {
        id: skillId,
        status: "quarantined" as const,
        contentSha256: intake.contentSha256,
        riskSignals: intake.riskSignals,
        parseIssues: intake.parseIssues,
      };
    }),
  setSkillStatus: authedQuery
    .input(
      z.object({
        id: z.number().int().positive(),
        status: z.enum(["quarantined", "vetted", "deprecated", "suspended"]),
        note: z.string().min(3).max(2000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const skill = await db.query.skills.findFirst({ where: eq(skills.id, input.id) });
      if (!skill) throw new TRPCError({ code: "NOT_FOUND" });
      const allowed = SKILL_TRANSITIONS[skill.status as SkillStatus];
      if (!allowed.includes(input.status)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `transition ${skill.status} → ${input.status} is not allowed`,
        });
      }
      await db
        .update(skills)
        .set({
          status: input.status,
          reviewedBy: ctx.user.name ?? `user-${ctx.user.id}`,
          reviewedAt: new Date(),
          reviewNote: input.note,
        })
        .where(eq(skills.id, input.id));
      return { ok: true };
    }),
});

// ── AI provider status + owner pricing settings ──────────────────

const aiRouter = createRouter({
  /** Env-based availability, vault-aware for direct providers. Never leaks keys. */
  providers: authedQuery.query(async ({ ctx }) => {
    const base = providerAvailability();
    const out = [];
    for (const p of base) {
      if (p.id === "openai" || p.id === "anthropic") {
        const prov = await getProvider(p.id);
        out.push(prov.availabilityFor ? await prov.availabilityFor(ctx.user.id) : p);
      } else {
        out.push(p);
      }
    }
    return out;
  }),
  /** Runtime gateway model discovery — never a hardcoded id. */
  gatewayModels: authedQuery.query(async () => {
    try {
      return await listGatewayModels();
    } catch (err) {
      throw mapAiErr(err);
    }
  }),
  pricing: authedQuery.query(({ ctx }) => listOwnerPricing(ctx.user.id)),
  setPricing: authedQuery
    .input(PricingRateSchema)
    .mutation(async ({ ctx, input }) => {
      await setOwnerPricing(ctx.user.id, input);
      return { ok: true };
    }),
  /**
   * Effective goal-mode presets per provider (design §3): owner overrides
   * from ownerSettings (`goal-mode-presets:<provider>`) merged over the
   * shipped defaults. Strategy ids come from the preset (or existing
   * strategy registry ids) — never hardcoded model ids.
   */
  goalModes: authedQuery.query(async ({ ctx }) => {
    const db = getDb();
    const rows = await db
      .select()
      .from(ownerSettings)
      .where(
        and(
          eq(ownerSettings.ownerId, ctx.user.id),
          like(ownerSettings.key, `${GOAL_MODE_SETTINGS_PREFIX}%`),
        ),
      );
    const byKey = new Map(rows.map((r) => [r.key, r.value]));
    const providers: Record<string, GoalModePresets> = {};
    for (const provider of GOAL_MODE_PROVIDERS) {
      providers[provider] = resolveGoalModePresets(
        byKey.get(`${GOAL_MODE_SETTINGS_PREFIX}${provider}`),
      );
    }
    return {
      modes: GOAL_MODES,
      defaults: DEFAULT_GOAL_MODE_PRESETS,
      providers,
      /** Only these ids can pass the normal dispatch gate (catalog flags). */
      dispatchableStrategyIds: DISPATCHABLE_STRATEGY_IDS,
    };
  }),
  /**
   * Set (or replace) one owner preset for a provider+mode. The strategyId
   * must be an existing strategy id (StrategyIdSchema) AND dispatchable
   * (not evaluationOnly/requiresOrchestration) — a non-dispatchable write
   * is rejected here, not at first failed dispatch.
   */
  setGoalModePreset: authedQuery
    .input(
      z.object({
        provider: GoalModeProviderSchema,
        preset: GoalModePresetSchema,
        idempotencyKey: z.string().min(1).max(128).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!isDispatchableGoalModePreset(input.preset)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `strategy "${input.preset.strategyId}" is not dispatchable (evaluationOnly or requiresOrchestration); choose one of: ${DISPATCHABLE_STRATEGY_IDS.join(", ")}`,
        });
      }
      const db = getDb();
      const key = `${GOAL_MODE_SETTINGS_PREFIX}${input.provider}`;
      const existing = await db.query.ownerSettings.findFirst({
        where: and(eq(ownerSettings.ownerId, ctx.user.id), eq(ownerSettings.key, key)),
      });
      const current = resolveGoalModePresets(existing?.value);
      const next: GoalModePresets = { ...current, [input.preset.mode]: input.preset };
      if (existing) {
        await db
          .update(ownerSettings)
          .set({ value: next })
          .where(and(eq(ownerSettings.ownerId, ctx.user.id), eq(ownerSettings.key, key)));
      } else {
        await db.insert(ownerSettings).values({ ownerId: ctx.user.id, key, value: next });
      }
      return { ok: true, presets: next };
    }),
});

export const planningRouter = createRouter({
  projects: projectsRouter,
  dag: dagRouter,
  registry: registryRouter,
  ai: aiRouter,
});
