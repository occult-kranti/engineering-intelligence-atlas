import { authRouter } from "./auth-router";
import { planningRouter } from "./routers/planning";
import { runtimeRouter } from "./routers/runtime";
import { controlRouter } from "./routers/control";
import { evaluationRouter } from "./routers/evaluation";
import { autonomyRouter } from "./routers/autonomy";
import { officeRouter } from "./routers/office";
import { whiteboardRouter } from "./routers/whiteboard";
import { enterpriseRouter } from "./routers/enterprise";
import { assistantRouter } from "./routers/assistant";
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
  control: controlRouter,
  evaluation: evaluationRouter,
  autonomy: autonomyRouter,
  office: officeRouter,
  whiteboard: whiteboardRouter,
  enterprise: enterpriseRouter,
  assistant: assistantRouter,
});

export type AppRouter = typeof appRouter;
