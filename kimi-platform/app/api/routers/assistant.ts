import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { and, eq, sql } from "drizzle-orm";
import { createRouter, authedQuery } from "../middleware";
import { getDb } from "../queries/connection";
import { enterpriseEvents } from "@db/schema";
import {
  ASSISTANT_ACTION_POLICIES,
  ASSISTANT_ACTIONS,
  ASSISTANT_DEFINITIONS,
  ASSISTANT_GATES,
  ASSISTANT_JOB_KINDS,
  ASSISTANT_JOB_POLICIES,
  AssistantDefinitionIdSchema,
  AssistantGateSchema,
  AssistantJobScheduleSchema,
  AssistantScopeSchema,
  routeRepository,
} from "@contracts/assistant";
import {
  ASSISTANT_CACHE_NAMESPACES,
  ASSISTANT_QUEUE_ITEM_KINDS,
  AssistantError,
  assistantStatus,
  cancelProposal,
  decideProposal,
  executeProposal,
  exportKnowledgeTransfers,
  getWorkQueue,
  intakeRepository,
  listJobs,
  listKnowledgeTransfers,
  listProposals,
  listRepositories,
  listStudyItems,
  proposeAction,
  reorderWorkQueue,
  runDirectAction,
} from "../assistant";
import { EnterpriseError, mustOwnEnterprise } from "../enterprise";
import { enterpriseSnapshotCacheStatus } from "../enterprise";
import { classifyConnectorError, githubInspectRepo } from "../integrations/connectors";

/**
 * Donna / shared assistants router. Every procedure is owner-scoped through
 * mustOwnEnterprise (404 unknown / 403 foreign). Queries are pure reads and
 * NEVER advance state. All mutations flow through typed proposals persisted
 * in assistant_proposals (separate from run approvals). Emergency stop is
 * intentionally ABSENT here — stop controls live on the ungated enterprise
 * program/cancel and run stop paths.
 */

function rethrow(err: unknown): never {
  if (err instanceof AssistantError || err instanceof EnterpriseError) {
    const code =
      err.code === "NOT_FOUND"
        ? "NOT_FOUND"
        : err.code === "FORBIDDEN"
          ? "FORBIDDEN"
          : err.code === "CONFLICT" || err.code === "BLUEPRINT_DRIFT"
            ? "CONFLICT"
            : err.code === "APPROVAL_REQUIRED" ||
                err.code === "GATE_NOT_CONFIRMED" ||
                err.code === "CREDENTIAL_REQUIRED" ||
                err.code === "VAULT_UNAVAILABLE" ||
                err.code === "VAULT_INTEGRITY" ||
                err.code === "FORBIDDEN_ACTION" ||
                err.code === "NO_HASH" ||
                err.code === "UNSTAFFED" ||
                err.code === "SKILL_UNAVAILABLE" ||
                err.code === "PLAN_GATE"
              ? "PRECONDITION_FAILED"
              : "BAD_REQUEST";
    throw new TRPCError({ code, message: err.message });
  }
  throw err;
}

const enterpriseIdInput = z.object({ enterpriseId: z.number().int().positive() });
const scopeInput = z.object({
  scope: AssistantScopeSchema,
  scopeKey: z.string().max(64).default(""),
});
const confirmationInput = z
  .object({
    approved: z.literal(true),
    confirmedGates: z.array(AssistantGateSchema).max(ASSISTANT_GATES.length),
  })
  .strict();
const actorInput = z.object({ actor: AssistantDefinitionIdSchema.default("donna") });

/** Declarative assistant action → procedure mapping (future UI parity). */
export const ACTION_PROCEDURES: Record<string, string> = {
  "queue.add": "assistant.queueAdd",
  "queue.reorder": "assistant.queueReorder",
  "worker.hire": "assistant.workerHire",
  "worker.pause": "assistant.workerPause",
  "worker.resume": "assistant.workerResume",
  "worker.fire": "assistant.workerFire",
  "department.pause": "assistant.setDepartmentStatus",
  "department.resume": "assistant.setDepartmentStatus",
  "department.archive": "assistant.setDepartmentStatus",
  "company.pause": "assistant.setCompanyStatus",
  "company.resume": "assistant.setCompanyStatus",
  "company.archive": "assistant.setCompanyStatus",
  "cache.invalidate": "assistant.cacheInvalidate",
  "schedule.upsert": "assistant.jobUpsert",
  "schedule.pause": "assistant.jobPause",
  "schedule.resume": "assistant.jobResume",
  "schedule.delete": "assistant.jobDelete",
  "schedule.run_now": "assistant.jobRunNow",
  "study.enqueue": "assistant.studyEnqueue",
  "repository.import": "assistant.repoFetch",
  "repository.assign": "assistant.repoApply",
  "repository.propose_structure": "assistant.repoApply",
  "knowledge.transfer": "assistant.knowledgeTransfer",
  "program.pump": "assistant.programPump",
};

export const assistantRouter = createRouter({
  /** Seeded permanent assistant definitions + closed action policies. */
  definitions: authedQuery.query(() => ({
    definitions: ASSISTANT_DEFINITIONS,
    actions: ASSISTANT_ACTIONS.map((id) => ({
      id,
      ...ASSISTANT_ACTION_POLICIES[id],
      procedure: ACTION_PROCEDURES[id] ?? null,
    })),
    gates: ASSISTANT_GATES,
    jobPolicies: ASSISTANT_JOB_POLICIES,
    // Emergency stop is deliberately not here: it is not an assistant action.
    emergencyStop: null,
  })),

  /** Aggregate counts + cache status (pure read). */
  status: authedQuery.input(enterpriseIdInput).query(async ({ ctx, input }) => {
    try {
      return await assistantStatus(ctx.user.id, input.enterpriseId);
    } catch (err) {
      rethrow(err);
    }
  }),

  // ── Proposals ──────────────────────────────────────────────────

  proposals: authedQuery
    .input(
      enterpriseIdInput.extend({
        status: z
          .enum(["proposed", "approved", "rejected", "executed", "failed", "cancelled"])
          .optional(),
        limit: z.number().int().positive().max(200).default(50),
      }),
    )
    .query(async ({ ctx, input }) => {
      try {
        return await listProposals(ctx.user.id, input.enterpriseId, input);
      } catch (err) {
        rethrow(err);
      }
    }),

  propose: authedQuery
    .input(
      enterpriseIdInput
        .extend(scopeInput.shape)
        .extend(actorInput.shape)
        .extend({
          action: z.enum(ASSISTANT_ACTIONS),
          payload: z.record(z.string(), z.unknown()),
          id: z.string().min(1).max(80).optional(),
        }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await proposeAction(ctx.user, input.enterpriseId, {
          id: input.id,
          scope: input.scope,
          actor: input.actor,
          action: input.action,
          payload: input.payload,
        });
      } catch (err) {
        rethrow(err);
      }
    }),

  decideProposal: authedQuery
    .input(
      z.object({
        proposalId: z.number().int().positive(),
        decision: z.enum(["approved", "rejected"]),
        confirmedGates: z.array(AssistantGateSchema).max(ASSISTANT_GATES.length).default([]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await decideProposal(ctx.user, input.proposalId, input.decision, input.confirmedGates);
      } catch (err) {
        rethrow(err);
      }
    }),

  executeProposal: authedQuery
    .input(z.object({ proposalId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      try {
        return await executeProposal(ctx.user, input.proposalId);
      } catch (err) {
        rethrow(err);
      }
    }),

  cancelProposal: authedQuery
    .input(z.object({ proposalId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      try {
        return await cancelProposal(ctx.user, input.proposalId);
      } catch (err) {
        rethrow(err);
      }
    }),

  // ── Work queues ────────────────────────────────────────────────

  queueGet: authedQuery
    .input(enterpriseIdInput.extend(scopeInput.shape))
    .query(async ({ ctx, input }) => {
      try {
        return await getWorkQueue(ctx.user.id, input.enterpriseId, input.scope, input.scopeKey);
      } catch (err) {
        rethrow(err);
      }
    }),

  queueAdd: authedQuery
    .input(
      enterpriseIdInput
        .extend(scopeInput.shape)
        .extend(actorInput.shape)
        .extend({
          item: z
            .object({
              itemKey: z.string().min(1).max(120),
              itemKind: z.enum(ASSISTANT_QUEUE_ITEM_KINDS),
              refId: z.string().max(255).default(""),
              title: z.string().min(1).max(200),
            })
            .strict(),
        }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const { proposal } = await runDirectAction(ctx.user, input.enterpriseId, {
          scope: input.scope,
          actor: input.actor,
          action: "queue.add",
          payload: { scopeKey: input.scopeKey, item: input.item },
        });
        return proposal;
      } catch (err) {
        rethrow(err);
      }
    }),

  queueReorder: authedQuery
    .input(
      enterpriseIdInput.extend(scopeInput.shape).extend({
        order: z.array(z.string().min(1).max(120)).max(500),
        expectedQueueVersion: z.number().int().positive().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await reorderWorkQueue(ctx.user, input.enterpriseId, {
          scope: input.scope,
          scopeKey: input.scopeKey,
          order: input.order,
          expectedQueueVersion: input.expectedQueueVersion,
        });
      } catch (err) {
        rethrow(err);
      }
    }),

  // ── Worker / department / company controls ─────────────────────

  workerHire: authedQuery
    .input(
      enterpriseIdInput.extend({
        contractKey: z.string().min(1).max(64),
        confirmation: confirmationInput,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await runDirectAction(ctx.user, input.enterpriseId, {
          scope: "enterprise",
          actor: "donna",
          action: "worker.hire",
          payload: { contractKey: input.contractKey },
          confirmation: input.confirmation,
        });
      } catch (err) {
        rethrow(err);
      }
    }),

  workerPause: authedQuery
    .input(z.object({ workerId: z.number().int().positive(), enterpriseId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      try {
        return await runDirectAction(ctx.user, input.enterpriseId, {
          scope: "enterprise",
          actor: "donna",
          action: "worker.pause",
          payload: { workerId: input.workerId },
        });
      } catch (err) {
        rethrow(err);
      }
    }),

  workerResume: authedQuery
    .input(z.object({ workerId: z.number().int().positive(), enterpriseId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      try {
        return await runDirectAction(ctx.user, input.enterpriseId, {
          scope: "enterprise",
          actor: "donna",
          action: "worker.resume",
          payload: { workerId: input.workerId },
        });
      } catch (err) {
        rethrow(err);
      }
    }),

  workerFire: authedQuery
    .input(
      enterpriseIdInput.extend({
        contractKey: z.string().min(1).max(64),
        confirmation: confirmationInput,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await runDirectAction(ctx.user, input.enterpriseId, {
          scope: "enterprise",
          actor: "donna",
          action: "worker.fire",
          payload: { contractKey: input.contractKey, drain: true, preserveArtifacts: true },
          confirmation: input.confirmation,
        });
      } catch (err) {
        rethrow(err);
      }
    }),

  setDepartmentStatus: authedQuery
    .input(
      enterpriseIdInput.extend({
        departmentKey: z.string().min(1).max(64),
        status: z.enum(["active", "paused", "archived"]),
        confirmation: confirmationInput,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const action =
          input.status === "paused"
            ? "department.pause"
            : input.status === "active"
              ? "department.resume"
              : "department.archive";
        return await runDirectAction(ctx.user, input.enterpriseId, {
          scope: "department",
          actor: "department-coordinator",
          action,
          payload: {
            departmentKey: input.departmentKey,
            ...(input.status === "archived" ? { drain: true, preserveArtifacts: true } : {}),
          },
          confirmation: input.confirmation,
        });
      } catch (err) {
        rethrow(err);
      }
    }),

  setCompanyStatus: authedQuery
    .input(
      enterpriseIdInput.extend({
        companyKey: z.string().min(1).max(64),
        status: z.enum(["active", "paused", "archived"]),
        confirmation: confirmationInput,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const action =
          input.status === "paused"
            ? "company.pause"
            : input.status === "active"
              ? "company.resume"
              : "company.archive";
        return await runDirectAction(ctx.user, input.enterpriseId, {
          scope: "company",
          actor: "company-operations-assistant",
          action,
          payload: {
            companyKey: input.companyKey,
            ...(input.status === "archived" ? { drain: true, preserveArtifacts: true } : {}),
          },
          confirmation: input.confirmation,
        });
      } catch (err) {
        rethrow(err);
      }
    }),

  programPump: authedQuery
    .input(
      z.object({
        enterpriseId: z.number().int().positive(),
        programId: z.number().int().positive(),
        confirmation: confirmationInput,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await runDirectAction(ctx.user, input.enterpriseId, {
          scope: "enterprise",
          actor: "donna",
          action: "program.pump",
          payload: { programId: input.programId },
          confirmation: input.confirmation,
        });
      } catch (err) {
        rethrow(err);
      }
    }),

  // ── Cache ──────────────────────────────────────────────────────

  cacheStatus: authedQuery.input(enterpriseIdInput).query(async ({ ctx, input }) => {
    try {
      await mustOwnEnterprise(ctx.user.id, input.enterpriseId);
      return {
        namespaces: ASSISTANT_CACHE_NAMESPACES.map((ns) => ({
          namespace: ns,
          serverSide: ns === "snapshot",
          ...(ns === "snapshot" ? enterpriseSnapshotCacheStatus() : {}),
        })),
      };
    } catch (err) {
      rethrow(err);
    }
  }),

  cacheInvalidate: authedQuery
    .input(
      enterpriseIdInput.extend({
        namespace: z.enum(ASSISTANT_CACHE_NAMESPACES),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await runDirectAction(ctx.user, input.enterpriseId, {
          scope: "enterprise",
          actor: "donna",
          action: "cache.invalidate",
          payload: { namespace: input.namespace },
        });
      } catch (err) {
        rethrow(err);
      }
    }),

  // ── Schedules (deterministic jobs) ─────────────────────────────

  jobsList: authedQuery.input(enterpriseIdInput).query(async ({ ctx, input }) => {
    try {
      return await listJobs(ctx.user.id, input.enterpriseId);
    } catch (err) {
      rethrow(err);
    }
  }),

  jobUpsert: authedQuery
    .input(
      enterpriseIdInput
        .extend(scopeInput.shape)
        .extend({
          jobKey: z.string().min(1).max(80),
          kind: z.enum(ASSISTANT_JOB_KINDS),
          schedule: AssistantJobScheduleSchema,
          enabled: z.boolean().default(true),
          maxRuns: z.number().int().positive().nullable().default(null),
          confirmation: confirmationInput,
        }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await runDirectAction(ctx.user, input.enterpriseId, {
          scope: input.scope,
          actor: "donna",
          action: "schedule.upsert",
          payload: {
            jobKey: input.jobKey,
            scopeKey: input.scopeKey,
            kind: input.kind,
            schedule: input.schedule,
            enabled: input.enabled,
            maxRuns: input.maxRuns,
          },
          confirmation: input.confirmation,
        });
      } catch (err) {
        rethrow(err);
      }
    }),

  jobPause: authedQuery
    .input(enterpriseIdInput.extend({ jobKey: z.string().min(1).max(80) }))
    .mutation(async ({ ctx, input }) => {
      try {
        return await runDirectAction(ctx.user, input.enterpriseId, {
          scope: "enterprise",
          actor: "donna",
          action: "schedule.pause",
          payload: { jobKey: input.jobKey },
        });
      } catch (err) {
        rethrow(err);
      }
    }),

  jobResume: authedQuery
    .input(enterpriseIdInput.extend({ jobKey: z.string().min(1).max(80) }))
    .mutation(async ({ ctx, input }) => {
      try {
        return await runDirectAction(ctx.user, input.enterpriseId, {
          scope: "enterprise",
          actor: "donna",
          action: "schedule.resume",
          payload: { jobKey: input.jobKey },
        });
      } catch (err) {
        rethrow(err);
      }
    }),

  jobDelete: authedQuery
    .input(enterpriseIdInput.extend({ jobKey: z.string().min(1).max(80) }))
    .mutation(async ({ ctx, input }) => {
      try {
        return await runDirectAction(ctx.user, input.enterpriseId, {
          scope: "enterprise",
          actor: "donna",
          action: "schedule.delete",
          payload: { jobKey: input.jobKey },
        });
      } catch (err) {
        rethrow(err);
      }
    }),

  jobRunNow: authedQuery
    .input(
      enterpriseIdInput.extend({
        jobKey: z.string().min(1).max(80),
        confirmation: confirmationInput,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await runDirectAction(ctx.user, input.enterpriseId, {
          scope: "enterprise",
          actor: "donna",
          action: "schedule.run_now",
          payload: { jobKey: input.jobKey },
          confirmation: input.confirmation,
        });
      } catch (err) {
        rethrow(err);
      }
    }),

  // ── Study queue ────────────────────────────────────────────────

  studyEnqueue: authedQuery
    .input(
      enterpriseIdInput.extend({
        skillId: z.string().min(1).max(80),
        goal: z.string().min(1).max(1000),
        evaluation: z.string().max(200).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await runDirectAction(ctx.user, input.enterpriseId, {
          scope: "department",
          actor: "department-coordinator",
          action: "study.enqueue",
          payload: {
            skillId: input.skillId,
            goal: input.goal,
            ...(input.evaluation ? { evaluation: input.evaluation } : {}),
          },
        });
      } catch (err) {
        rethrow(err);
      }
    }),

  studyList: authedQuery
    .input(
      enterpriseIdInput.extend({
        status: z.enum(["draft", "queued", "in-progress", "completed", "dropped"]).optional(),
        limit: z.number().int().positive().max(500).default(100),
      }),
    )
    .query(async ({ ctx, input }) => {
      try {
        return await listStudyItems(ctx.user.id, input.enterpriseId, input);
      } catch (err) {
        rethrow(err);
      }
    }),

  // ── Repositories (confirmed metadata only) ─────────────────────

  /**
   * Read-only PREVIEW: public-anonymous inspect + deterministic routing, no
   * persistence. Credentialed previews are refused — private/credentialed
   * reads require an approved repository.import (credentials gate).
   */
  repoPreview: authedQuery
    .input(z.object({ repoUrl: z.string().min(1).max(500) }))
    .mutation(async ({ ctx, input }) => {
      void ctx;
      try {
        const inspection = await githubInspectRepo(input.repoUrl, null);
        const [owner, name] = inspection.fullName.split("/");
        const metadata = {
          url: input.repoUrl,
          owner: owner ?? "",
          name: name ?? "",
          description: inspection.description.slice(0, 2000),
          language: inspection.language,
          topics: inspection.topics,
          license: inspection.license ? inspection.license.toLowerCase() : null,
          archived: inspection.archived,
          defaultBranch: inspection.defaultBranch,
          commitSha: inspection.commitSha,
          visibility: inspection.visibility,
        };
        return { metadata, plan: routeRepository(metadata) };
      } catch (err) {
        if (err instanceof AssistantError) rethrow(err);
        const { errorClass, detail } = classifyConnectorError(err);
        throw new TRPCError({ code: "BAD_REQUEST", message: `${errorClass}: ${detail}` });
      }
    }),

  /**
   * Confirmed intake of up to 50 selected repositories. Each URL goes through
   * its own typed repository.import proposal (external-writes + credentials +
   * high-risk gates confirmed once, applied per repo). No clone, no code.
   */
  repoFetch: authedQuery
    .input(
      enterpriseIdInput.extend({
        urls: z.array(z.string().min(1).max(500)).min(1).max(50),
        intakeMode: z.enum(["public-anonymous", "credentialed-approved"]),
        recordId: z.number().int().positive().optional(),
        confirmation: confirmationInput,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const results: { url: string; ok: boolean; summary: string }[] = [];
      for (const url of input.urls) {
        try {
          const { proposal } = await runDirectAction(ctx.user, input.enterpriseId, {
            scope: "enterprise",
            actor: "repository-integration-steward",
            action: "repository.import",
            payload: {
              url,
              intakeMode: input.intakeMode,
              ...(input.recordId !== undefined ? { recordId: input.recordId } : {}),
            },
            confirmation: input.confirmation,
          });
          results.push({ url, ok: proposal.status === "executed", summary: proposal.resultSummary });
        } catch (err) {
          if (err instanceof AssistantError || err instanceof EnterpriseError) {
            results.push({ url, ok: false, summary: `${err.code}: ${err.message.slice(0, 300)}` });
          } else {
            rethrow(err);
          }
        }
      }
      return { results };
    }),

  /** Apply (or record) a routing plan — repository.assign / propose_structure. */
  repoApply: authedQuery
    .input(
      enterpriseIdInput.extend({
        url: z.string().min(1).max(500),
        kind: z.enum(["assign", "propose_structure"]),
        confirmation: confirmationInput,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await runDirectAction(ctx.user, input.enterpriseId, {
          scope: "enterprise",
          actor: "repository-integration-steward",
          action: input.kind === "assign" ? "repository.assign" : "repository.propose_structure",
          payload: { url: input.url },
          confirmation: input.confirmation,
        });
      } catch (err) {
        rethrow(err);
      }
    }),

  reposList: authedQuery.input(enterpriseIdInput).query(async ({ ctx, input }) => {
    try {
      return await listRepositories(ctx.user.id, input.enterpriseId);
    } catch (err) {
      rethrow(err);
    }
  }),

  /** Server-side intake reuse (proposal executor path; tested directly). */
  repoIntake: authedQuery
    .input(
      enterpriseIdInput.extend({
        url: z.string().min(1).max(500),
        intakeMode: z.enum(["public-anonymous", "credentialed-approved"]),
        recordId: z.number().int().positive().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await intakeRepository(ctx.user, input.enterpriseId, input);
      } catch (err) {
        rethrow(err);
      }
    }),

  // ── Knowledge transfer (refs only) ─────────────────────────────

  knowledgeTransfer: authedQuery
    .input(
      enterpriseIdInput
        .extend(scopeInput.shape)
        .extend({
          transferKey: z.string().min(1).max(80),
          artifactIds: z.array(z.number().int().positive()).min(1).max(16),
          from: z.string().min(1).max(80),
          to: z.string().min(1).max(80),
          summary: z.string().max(2000).default(""),
          confirmation: confirmationInput,
        }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await runDirectAction(ctx.user, input.enterpriseId, {
          scope: input.scope,
          // Scope coverage is contract-enforced: only Donna covers enterprise scope.
          actor: input.scope === "enterprise" ? "donna" : "department-coordinator",
          action: "knowledge.transfer",
          payload: {
            transferKey: input.transferKey,
            artifactIds: input.artifactIds,
            from: input.from,
            to: input.to,
            summary: input.summary,
          },
          confirmation: input.confirmation,
        });
      } catch (err) {
        rethrow(err);
      }
    }),

  knowledgeList: authedQuery.input(enterpriseIdInput).query(async ({ ctx, input }) => {
    try {
      return await listKnowledgeTransfers(ctx.user.id, input.enterpriseId);
    } catch (err) {
      rethrow(err);
    }
  }),

  knowledgeExport: authedQuery.input(enterpriseIdInput).query(async ({ ctx, input }) => {
    try {
      return await exportKnowledgeTransfers(ctx.user.id, input.enterpriseId);
    } catch (err) {
      rethrow(err);
    }
  }),

  /** Assistant event stream (append-only; keyset on seq; reads never advance). */
  events: authedQuery
    .input(
      enterpriseIdInput.extend({
        afterSeq: z.number().int().nonnegative().default(0),
        limit: z.number().int().positive().max(500).default(200),
      }),
    )
    .query(async ({ ctx, input }) => {
      try {
        await mustOwnEnterprise(ctx.user.id, input.enterpriseId);
        const db = getDb();
        return db
          .select()
          .from(enterpriseEvents)
          .where(
            and(
              eq(enterpriseEvents.enterpriseId, input.enterpriseId),
              sql`${enterpriseEvents.seq} > ${input.afterSeq}`,
              sql`(${enterpriseEvents.type} LIKE 'assistant\\_%' OR ${enterpriseEvents.type} IN ('company_paused','company_resumed','company_archived','department_paused','department_resumed','department_archived'))`,
            ),
          )
          .orderBy(enterpriseEvents.seq)
          .limit(input.limit);
      } catch (err) {
        rethrow(err);
      }
    }),
});
