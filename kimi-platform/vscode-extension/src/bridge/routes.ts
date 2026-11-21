/**
 * Companion HTTP route map — the ONLY place endpoint paths/methods/payload
 * shapes are defined. Reconciled against the ACTUAL v4 desktop server
 * (desktop-shell src/main/companion.ts, bridgeVersion 4, default port 4319).
 *
 * Actual surface:
 *   GET    /health                                   -> { ok:true, bridgeVersion, service }
 *   GET    /v1/projects                              -> { ok, projects }
 *   POST   /v1/projects      {…CreateProjectRequest, confirmed:true} -> { ok, project }
 *   GET    /v1/office?projectId=&runId=              -> { ok, snapshot }
 *   GET    /v1/runs?projectId=                       -> { ok, runs }
 *   POST   /v1/runs/start    {projectId, runBudget, priceRates} -> { ok, runId? }
 *   POST   /v1/runs/pause|resume|cancel|recover  {runId} -> { ok }
 *   GET    /v1/approvals?projectId=&runId=           -> { ok, approvals }
 *   POST   /v1/approvals/decide  DecideApprovalPayload -> { ok, approval? }
 *   GET    /v1/artifacts/read?projectId=&runId=&nodeId=&attempt= -> { ok, text, meta }
 *   GET    /v1/events/read?projectId=&runId=&afterIndex= -> { ok, events, nextIndex }
 *   GET    /v1/chat/sessions                         -> { ok, sessions }
 *   POST   /v1/chat/sessions   CreateChatSessionPayload -> { ok, session }
 *   GET    /v1/chat/sessions/:sessionId              -> { ok, session }
 *   POST   /v1/chat/sessions/:sessionId/send   {text, confirmed:true} -> { ok, userMessageId, assistantMessageId }
 *   POST   /v1/chat/sessions/:sessionId/stop         -> { ok }
 *
 * Server notes: every route requires Bearer auth; POST requires
 * `Content-Type: application/json` even with an empty body (client.ts sends
 * `{}`); there is intentionally no GET /v1/projects/:id and no run lookup by
 * id — list routes + query params only.
 *
 * Pure module — no 'vscode' / 'node:*' imports.
 */

import { seg } from './url.js';
import type {
  ChatSendPayload,
  CreateChatSessionPayload,
  CreateProjectPayload,
  DecideApprovalPayload,
  StartRunPayload,
} from './types.js';

export type HttpMethod = 'GET' | 'POST';

export interface RouteDef<B = unknown> {
  method: HttpMethod;
  path: string;
  /** Build the JSON body for POST routes. `{}` for POSTs without a payload. */
  body?: B;
}

export const ROUTES = {
  health: (): RouteDef => ({ method: 'GET', path: '/health' }),

  listProjects: (): RouteDef => ({ method: 'GET', path: '/v1/projects' }),

  createProject: (payload: CreateProjectPayload): RouteDef<CreateProjectPayload> => ({
    method: 'POST',
    path: '/v1/projects',
    body: payload,
  }),

  officeSnapshot: (projectId: string, runId?: string): RouteDef => ({
    method: 'GET',
    path: `/v1/office?projectId=${seg(projectId)}${runId ? `&runId=${seg(runId)}` : ''}`,
  }),

  listRuns: (projectId?: string): RouteDef => ({
    method: 'GET',
    path: `/v1/runs${projectId ? `?projectId=${seg(projectId)}` : ''}`,
  }),

  runEvents: (projectId: string, runId: string, afterIndex?: number): RouteDef => ({
    method: 'GET',
    path:
      `/v1/events/read?projectId=${seg(projectId)}&runId=${seg(runId)}` +
      (afterIndex !== undefined ? `&afterIndex=${afterIndex}` : ''),
  }),

  startRun: (payload: StartRunPayload): RouteDef<StartRunPayload> => ({
    method: 'POST',
    path: '/v1/runs/start',
    body: payload,
  }),

  pauseRun: (runId: string): RouteDef<{ runId: string }> => ({
    method: 'POST',
    path: '/v1/runs/pause',
    body: { runId },
  }),
  resumeRun: (runId: string): RouteDef<{ runId: string }> => ({
    method: 'POST',
    path: '/v1/runs/resume',
    body: { runId },
  }),
  cancelRun: (runId: string): RouteDef<{ runId: string }> => ({
    method: 'POST',
    path: '/v1/runs/cancel',
    body: { runId },
  }),
  recoverRun: (runId: string): RouteDef<{ runId: string }> => ({
    method: 'POST',
    path: '/v1/runs/recover',
    body: { runId },
  }),

  listApprovals: (projectId?: string, runId?: string): RouteDef => {
    const q: string[] = [];
    if (projectId) q.push(`projectId=${seg(projectId)}`);
    if (runId) q.push(`runId=${seg(runId)}`);
    return { method: 'GET', path: `/v1/approvals${q.length ? `?${q.join('&')}` : ''}` };
  },

  decideApproval: (payload: DecideApprovalPayload): RouteDef<DecideApprovalPayload> => ({
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

  chatListSessions: (): RouteDef => ({ method: 'GET', path: '/v1/chat/sessions' }),

  chatCreateSession: (payload: CreateChatSessionPayload): RouteDef<CreateChatSessionPayload> => ({
    method: 'POST',
    path: '/v1/chat/sessions',
    body: payload,
  }),

  chatGetSession: (sessionId: string): RouteDef => ({
    method: 'GET',
    path: `/v1/chat/sessions/${seg(sessionId)}`,
  }),

  chatSend: (sessionId: string, payload: ChatSendPayload): RouteDef<ChatSendPayload> => ({
    method: 'POST',
    path: `/v1/chat/sessions/${seg(sessionId)}/send`,
    body: payload,
  }),

  chatStop: (sessionId: string): RouteDef => ({
    method: 'POST',
    path: `/v1/chat/sessions/${seg(sessionId)}/stop`,
    body: {},
  }),
} as const;

export type RouteName = keyof typeof ROUTES;
