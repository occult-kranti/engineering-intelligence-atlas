import { authRouter } from "./auth-router";
import { planningRouter } from "./routers/planning";
import { runtimeRouter } from "./routers/runtime";
import { integrationsRouter } from "./integrations/router";
import { createRouter, publicQuery } from "./middleware";

export const appRouter = createRouter({
  ping: publicQuery.query(() => ({ ok: true, ts: Date.now() })),
  auth: authRouter,
  projects: planningRouter.projects,
  dag: planningRouter.dag,
  registry: planningRouter.registry,
  ai: planningRouter.ai,
  integrations: integrationsRouter,
  runs: runtimeRouter.runs,
  events: runtimeRouter.events,
  approvals: runtimeRouter.approvals,
  artifacts: runtimeRouter.artifacts,
  knowledge: runtimeRouter.knowledge,
  exports: runtimeRouter.exports,
  ledger: runtimeRouter.ledger,
});

export type AppRouter = typeof appRouter;
