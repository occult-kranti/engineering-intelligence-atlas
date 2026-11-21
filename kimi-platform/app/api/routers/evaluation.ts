import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { and, desc, eq } from "drizzle-orm";
import { createHash } from "node:crypto";
import { createRouter, authedQuery } from "../middleware";
import { getDb } from "../queries/connection";
import { evaluationReports } from "@db/schema";
import {
  EvaluationReportSchema,
  RoutingRequestSchema,
} from "@contracts/evaluation";
import { PromptCompilerInputSchema } from "@contracts/prompting";
import { STRATEGY_CATALOG } from "../prompting/strategies";
import { compilePrompt } from "../prompting/compiler";
import {
  DISPATCHABLE_STRATEGIES,
  ROUTING_RULES,
  resolveDispatchStrategy,
  routeStrategy,
  runSuite,
} from "../prompting/evaluation";
import { STRESS_SUITE } from "../prompting/stress-cases";
import { resolvePricing } from "../engine/pricing";
import type { ProviderId } from "@contracts/run";

/**
 * Owner-scoped prompt evaluation API. Everything here is deterministic and
 * offline: the strategy catalog + router rules, compiled-prompt previews
 * (with redactions), and the deterministic mock stress suite. Live provider
 * evaluation is deliberately deferred — no live calls are made from this
 * router. Cost figures are priced strictly from the existing owner/env
 * pricing configuration; when no rate is configured the run is refused
 * rather than priced with fabricated values.
 */

const RunSuiteInputSchema = z.object({
  /** Provider whose configured pricing rates price the mock usage. */
  provider: z.enum(["gateway", "openai", "anthropic"]),
  model: z.string().min(1).max(200),
  repeats: z.number().int().min(1).max(60).optional(),
  k: z.number().int().min(1).max(10).optional(),
  qualityThreshold: z.number().min(0).max(1).optional(),
  /** When false, the report is returned but not persisted. Default true. */
  save: z.boolean().default(true),
});

export const evaluationRouter = createRouter({
  /** Versioned strategy catalog + the dispatch gate + router rules. */
  strategies: authedQuery.query(() => ({
    strategies: Object.values(STRATEGY_CATALOG).map((s) => ({
      id: s.id,
      version: s.version,
      summary: s.summary,
      whenToUse: s.whenToUse,
      whenNotToUse: s.whenNotToUse,
      maxFanout: s.maxFanout,
      maxRetries: s.maxRetries,
      costMultiplier: s.costMultiplier,
      evaluationOnly: s.evaluationOnly,
      requiresOrchestration: s.requiresOrchestration,
      dispatchable: DISPATCHABLE_STRATEGIES.includes(
        s.id as (typeof DISPATCHABLE_STRATEGIES)[number],
      ),
    })),
    dispatchableStrategies: DISPATCHABLE_STRATEGIES,
    routingRules: ROUTING_RULES,
  })),

  /** Dry-run the strategy router for a declared task shape. */
  route: authedQuery
    .input(RoutingRequestSchema)
    .query(({ input }) => ({
      routing: routeStrategy(input),
      dispatch: resolveDispatchStrategy(input),
    })),

  /**
   * Preview a compiled prompt contract: system+user messages, the concise
   * execution plan, and all truncation/redaction/degradation metadata. No
   * provider call; untrusted content is fenced and redacted by the compiler.
   */
  preview: authedQuery
    .input(z.object({ input: PromptCompilerInputSchema }))
    .mutation(({ input }) => compilePrompt(input.input)),

  /**
   * Run the deterministic mock stress suite and (by default) save the report.
   * Usage is mock-metered and priced at the owner's configured rates for the
   * chosen provider/model — never at fabricated rates.
   */
  runMockSuite: authedQuery
    .input(RunSuiteInputSchema)
    .mutation(async ({ ctx, input }) => {
      const pricing = await resolvePricing(
        ctx.user.id,
        input.provider as ProviderId,
        input.model,
      );
      if (!pricing) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message:
            `no USD pricing configured for ${input.provider}/${input.model}; ` +
            "evaluation costs are priced strictly from configured rates (Director → Settings or server env), never fabricated",
        });
      }
      const report = runSuite(STRESS_SUITE, {
        rates: {
          inputUsdPerMillion: pricing.inputUsdPerMillion,
          outputUsdPerMillion: pricing.outputUsdPerMillion,
        },
        ...(input.repeats !== undefined ? { repeats: input.repeats } : {}),
        ...(input.k !== undefined ? { k: input.k } : {}),
        ...(input.qualityThreshold !== undefined
          ? { qualityThreshold: input.qualityThreshold }
          : {}),
      });
      // Schema-validated before persistence; the stored hash covers the
      // canonical report, so identical suite+rates+config reproduce it.
      const validated = EvaluationReportSchema.parse(report);
      const reportHash = createHash("sha256")
        .update(JSON.stringify(validated))
        .digest("hex");
      let id: number | null = null;
      if (input.save) {
        const db = getDb();
        const [row] = await db.insert(evaluationReports).values({
          ownerId: ctx.user.id,
          suiteName: validated.suite.name,
          suiteVersion: validated.suite.version,
          suiteHash: validated.suite.hash,
          rates: {
            inputUsdPerMillion: pricing.inputUsdPerMillion,
            outputUsdPerMillion: pricing.outputUsdPerMillion,
            source: pricing.source,
          },
          config: {
            provider: input.provider,
            model: input.model,
            repeats: validated.config.repeats,
            k: validated.config.k,
            minTrialsForConclusion: validated.config.minTrialsForConclusion,
            qualityThreshold: validated.config.qualityThreshold,
          },
          reportHash,
          report: validated,
        });
        id = Number(row.insertId);
      }
      return { id, reportHash, suite: validated.suite, verdict: validated.verdict, report: validated };
    }),

  /** List the caller's saved reports (metadata only, newest first). */
  reports: authedQuery.query(async ({ ctx }) => {
    const rows = await getDb()
      .select({
        id: evaluationReports.id,
        suiteName: evaluationReports.suiteName,
        suiteVersion: evaluationReports.suiteVersion,
        suiteHash: evaluationReports.suiteHash,
        reportHash: evaluationReports.reportHash,
        rates: evaluationReports.rates,
        config: evaluationReports.config,
        createdAt: evaluationReports.createdAt,
      })
      .from(evaluationReports)
      .where(eq(evaluationReports.ownerId, ctx.user.id))
      .orderBy(desc(evaluationReports.id));
    return rows;
  }),

  /** Fetch one saved report. Owner-scoped: other owners get NOT_FOUND. */
  report: authedQuery
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const row = await getDb().query.evaluationReports.findFirst({
        where: and(
          eq(evaluationReports.id, input.id),
          eq(evaluationReports.ownerId, ctx.user.id),
        ),
      });
      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "report not found" });
      return row;
    }),
});
