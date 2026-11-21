/**
 * ══════════════════════════════════════════════════════════════════════════
 *  ISOLATED DESKTOP ROUTE MAP — the ONLY module that knows companion HTTP
 *  paths/methods. Everything else in this server addresses capabilities by
 *  name. Desktop/web/VS Code are NOT modified by this package; when the
 *  desktop adds enterprise/assistant routes, reconcile them HERE (additive
 *  changes only, bump CANDIDATE route entries into STABLE once shipped).
 * ══════════════════════════════════════════════════════════════════════════
 *
 * STABLE routes are reconciled against the actual v4 desktop companion
 * (desktop-shell src/main/companion.ts, bridgeVersion 4, default port 4319):
 *
 *   GET    /health                                       -> { ok, bridgeVersion, service }
 *   GET    /v1/projects                                  -> { ok, projects }
 *   POST   /v1/projects         {…, confirmed:true}      -> { ok, project }
 *   GET    /v1/office?projectId=&runId=                  -> { ok, snapshot }
 *   GET    /v1/runs?projectId=                           -> { ok, runs }
 *   POST   /v1/runs/start       {projectId, runBudget?, priceRates?}
 *   POST   /v1/runs/pause|resume|cancel|recover  {runId}
 *   GET    /v1/approvals?projectId=&runId=               -> { ok, approvals }
 *   POST   /v1/approvals/decide {projectId, approvalId, decision, payloadHash, runId?}
 *   GET    /v1/artifacts/read?projectId=&runId=&nodeId=&attempt= -> { ok, text, meta }
 *   GET    /v1/events/read?projectId=&runId=&afterIndex= -> { ok, events, nextIndex }
 *   GET    /v1/chat/sessions                             -> { ok, sessions }
 *   GET    /v1/chat/sessions/:id                         -> { ok, session }
 *   POST   /v1/chat/sessions/:id/send  {text, confirmed:true}
 *
 * CANDIDATE routes are additive capabilities the desktop has NOT shipped yet
 * (enterprise CEO office, Donna assistant, repository/EIA). Calling one today
 * returns the desktop's catch-all 404 { error: 'not found' }, which the HTTP
 * client maps to an explicit `capability_unavailable` tool error — this
 * server NEVER fabricates enterprise/assistant data.
 */

export type HttpMethod = 'GET' | 'POST';

export interface RouteDef<B = unknown> {
  method: HttpMethod;
  path: string;
  /** JSON body for POST routes. Undefined for GET. */
  body?: B;
}

/** URL-encode a single path segment / query value. */
function seg(value: string): string {
  return encodeURIComponent(value);
}

// ---------------------------------------------------------------------------
// STABLE — present in desktop companion bridgeVersion 4
// ---------------------------------------------------------------------------

export const STABLE_ROUTES = {
  health: (): RouteDef => ({ method: 'GET', path: '/health' }),

  listProjects: (): RouteDef => ({ method: 'GET', path: '/v1/projects' }),

  createProject: (payload: Record<string, unknown>): RouteDef<Record<string, unknown>> => ({
    method: 'POST',
    path: '/v1/projects',
    body: payload,
  }),

  office: (projectId: string, runId?: string): RouteDef => ({
    method: 'GET',
    path: `/v1/office?projectId=${seg(projectId)}${runId !== undefined ? `&runId=${seg(runId)}` : ''}`,
  }),

  listRuns: (projectId?: string): RouteDef => ({
    method: 'GET',
    path: `/v1/runs${projectId !== undefined ? `?projectId=${seg(projectId)}` : ''}`,
  }),

  startRun: (payload: Record<string, unknown>): RouteDef<Record<string, unknown>> => ({
    method: 'POST',
    path: '/v1/runs/start',
    body: payload,
  }),

  runAction: (action: 'pause' | 'resume' | 'cancel' | 'recover', runId: string): RouteDef<{ runId: string }> => ({
    method: 'POST',
    path: `/v1/runs/${action}`,
    body: { runId },
  }),

  listApprovals: (projectId?: string, runId?: string): RouteDef => {
    const params: string[] = [];
    if (projectId !== undefined) params.push(`projectId=${seg(projectId)}`);
    if (runId !== undefined) params.push(`runId=${seg(runId)}`);
    return { method: 'GET', path: `/v1/approvals${params.length > 0 ? `?${params.join('&')}` : ''}` };
  },

  decideApproval: (payload: Record<string, unknown>): RouteDef<Record<string, unknown>> => ({
    method: 'POST',
    path: '/v1/approvals/decide',
    body: payload,
  }),

  readArtifact: (projectId: string, runId: string, nodeId: string, attempt?: number): RouteDef => ({
    method: 'GET',
    path:
      `/v1/artifacts/read?projectId=${seg(projectId)}&runId=${seg(runId)}&nodeId=${seg(nodeId)}` +
      (attempt !== undefined ? `&attempt=${attempt}` : ''),
  }),

  readEvents: (projectId: string, runId: string, afterIndex: number): RouteDef => ({
    method: 'GET',
    path: `/v1/events/read?projectId=${seg(projectId)}&runId=${seg(runId)}&afterIndex=${afterIndex}`,
  }),

  listChatSessions: (): RouteDef => ({ method: 'GET', path: '/v1/chat/sessions' }),

  getChatSession: (sessionId: string): RouteDef => ({
    method: 'GET',
    path: `/v1/chat/sessions/${seg(sessionId)}`,
  }),

  sendChatMessage: (sessionId: string, payload: { text: string; confirmed: true }): RouteDef<{ text: string; confirmed: true }> => ({
    method: 'POST',
    path: `/v1/chat/sessions/${seg(sessionId)}/send`,
    body: payload,
  }),
} as const;

// ---------------------------------------------------------------------------
// CANDIDATE — NOT in bridgeVersion 4. Additive desktop routes proposed for
// enterprise (CEO office), Donna (assistant), and repository (Engineering
// Intelligence Atlas). Until the desktop ships them, every call resolves to
// capability_unavailable via the 404 sentinel. Keep this section append-only;
// move entries into STABLE_ROUTES once the desktop ships them.
// ---------------------------------------------------------------------------

export const CANDIDATE_ROUTES = {
  enterpriseSnapshot: (enterpriseId?: string): RouteDef => ({
    method: 'GET',
    path: `/v1/enterprise/snapshot${enterpriseId !== undefined ? `?enterpriseId=${seg(enterpriseId)}` : ''}`,
  }),

  enterpriseLedger: (enterpriseId?: string, limit?: number): RouteDef => {
    const params: string[] = [];
    if (enterpriseId !== undefined) params.push(`enterpriseId=${seg(enterpriseId)}`);
    if (limit !== undefined) params.push(`limit=${limit}`);
    return { method: 'GET', path: `/v1/enterprise/ledger${params.length > 0 ? `?${params.join('&')}` : ''}` };
  },

  donnaListProposals: (status?: string): RouteDef => ({
    method: 'GET',
    path: `/v1/donna/proposals${status !== undefined ? `?status=${seg(status)}` : ''}`,
  }),

  donnaListSchedules: (): RouteDef => ({ method: 'GET', path: '/v1/donna/schedules' }),

  donnaProposeAction: (payload: Record<string, unknown>): RouteDef<Record<string, unknown>> => ({
    method: 'POST',
    path: '/v1/donna/proposals',
    body: payload,
  }),

  donnaQueueProposal: (payload: Record<string, unknown>): RouteDef<Record<string, unknown>> => ({
    method: 'POST',
    path: '/v1/donna/queue',
    body: payload,
  }),

  donnaCreateSchedule: (payload: Record<string, unknown>): RouteDef<Record<string, unknown>> => ({
    method: 'POST',
    path: '/v1/donna/schedules',
    body: payload,
  }),

  repositoryPreviewAssignment: (companyId?: string): RouteDef => ({
    method: 'GET',
    path: `/v1/repository/assignments/preview${companyId !== undefined ? `?companyId=${seg(companyId)}` : ''}`,
  }),

  repositoryProposeAssignment: (payload: Record<string, unknown>): RouteDef<Record<string, unknown>> => ({
    method: 'POST',
    path: '/v1/repository/assignments',
    body: payload,
  }),

  repositoryProposeCompany: (payload: Record<string, unknown>): RouteDef<Record<string, unknown>> => ({
    method: 'POST',
    path: '/v1/repository/companies',
    body: payload,
  }),
} as const;
