/**
 * BridgeClient — the only module that talks to the desktop over HTTP.
 * Reconciled against desktop-shell src/main/companion.ts (bridgeVersion 4).
 *
 *  - Extension-host Node fetch (globalThis.fetch, Node 18+ in the VS Code
 *    extension host) or an injected implementation for tests.
 *  - Loopback only: every URL passes assertLoopbackUrl immediately before fetch.
 *  - Bearer auth: the token is NEVER stored on the client; it is pulled from a
 *    caller-provided async getter (backed by context.secrets) per request.
 *  - Sanitized errors: see errors.ts; the token is redacted from any message.
 *  - Timeouts on every request; polling lives in polling.ts with capped backoff.
 *  - POST always sends `Content-Type: application/json` (the server requires
 *    it even for empty bodies; body-less POSTs send `{}`).
 *
 * No 'vscode' import so the client is unit-testable under plain Node/Vitest.
 */

import { BridgeError, httpError, networkError, serverErrorMessage } from './errors.js';
import { ROUTES, type RouteDef } from './routes.js';
import type {
  ApprovalRecord,
  ArtifactMeta,
  ChatSendPayload,
  ChatSendResult,
  ChatSession,
  ChatSessionSummary,
  CreateChatSessionPayload,
  CreateProjectPayload,
  DecideApprovalPayload,
  HealthStatus,
  OfficeSnapshot,
  OkResult,
  Project,
  ProjectRun,
  RunEventRecord,
  StartRunPayload,
} from './types.js';
import { assertLoopbackUrl, baseUrlFor, type BridgeAddress } from './url.js';

export type FetchLike = (
  url: string,
  init: {
    method: string;
    headers: Record<string, string>;
    body?: string;
    signal: AbortSignal;
  },
) => Promise<{ status: number; statusText: string; text(): Promise<string> }>;

export type TokenGetter = () => Promise<string | undefined>;

export interface BridgeClientOptions {
  address: BridgeAddress;
  getToken: TokenGetter;
  fetchImpl?: FetchLike;
  /** Per-request timeout in ms (default 10_000). */
  timeoutMs?: number;
}

function fail(message: string): never {
  throw new BridgeError('server', message);
}

/** Unwrap `{ ok:true, <key>: value }` envelopes; throw sanitized otherwise. */
function unwrap<T>(raw: unknown, key: string): T {
  if (!raw || typeof raw !== 'object') fail('Malformed desktop response.');
  const r = raw as { ok?: unknown; error?: unknown } & Record<string, unknown>;
  if (r.ok !== true) {
    fail(typeof r.error === 'string' && r.error.length <= 200 ? r.error : 'Desktop request failed.');
  }
  if (!(key in r)) fail('Malformed desktop response.');
  return r[key] as T;
}

export class BridgeClient {
  readonly #address: BridgeAddress;
  readonly #baseUrl: string;
  readonly #getToken: TokenGetter;
  readonly #fetch: FetchLike;
  readonly #timeoutMs: number;

  constructor(opts: BridgeClientOptions) {
    this.#address = opts.address;
    this.#baseUrl = baseUrlFor(opts.address);
    this.#getToken = opts.getToken;
    const f = opts.fetchImpl ?? (globalThis.fetch as unknown as FetchLike | undefined);
    if (!f) throw new Error('No fetch implementation available in this extension host');
    this.#fetch = f;
    this.#timeoutMs = opts.timeoutMs ?? 10_000;
  }

  get address(): BridgeAddress {
    return this.#address;
  }

  async #request(route: RouteDef<unknown>): Promise<unknown> {
    const token = await this.#getToken();
    if (!token) {
      throw new BridgeError('unpaired', 'Not paired with Research Director Desktop.');
    }
    const url = assertLoopbackUrl(`${this.#baseUrl}${route.path}`).toString();
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    };
    let body: string | undefined;
    if (route.method === 'POST') {
      // The server requires JSON content type on every write, even empty ones.
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(route.body ?? {});
    }
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), this.#timeoutMs);
    let res: { status: number; statusText: string; text(): Promise<string> };
    try {
      res = await this.#fetch(url, { method: route.method, headers, body, signal: ctrl.signal });
    } catch (err) {
      throw networkError(err, token);
    } finally {
      clearTimeout(timer);
    }
    const raw = await res.text().catch(() => '');
    let json: unknown = undefined;
    if (raw) {
      try {
        json = JSON.parse(raw);
      } catch {
        throw httpError(res.status, 'non-JSON response', token);
      }
    }
    if (res.status < 200 || res.status >= 300) {
      const serverMsg = serverErrorMessage(json, token);
      throw serverMsg
        ? new BridgeError('server', `Desktop error (HTTP ${res.status}): ${serverMsg}`, res.status)
        : httpError(res.status, res.statusText, token);
    }
    return json;
  }

  // -- health ---------------------------------------------------------------
  async health(): Promise<HealthStatus> {
    const raw = (await this.#request(ROUTES.health())) as HealthStatus;
    if (raw.ok !== true) fail('Desktop health check failed.');
    return raw;
  }

  // -- projects -------------------------------------------------------------
  async listProjects(): Promise<Project[]> {
    return unwrap<Project[]>(await this.#request(ROUTES.listProjects()), 'projects');
  }

  async createProject(payload: CreateProjectPayload): Promise<{ ok: boolean; project?: Project; error?: string }> {
    return (await this.#request(ROUTES.createProject(payload))) as { ok: boolean; project?: Project; error?: string };
  }

  async officeSnapshot(projectId: string, runId?: string): Promise<OfficeSnapshot | null> {
    return unwrap<OfficeSnapshot>(await this.#request(ROUTES.officeSnapshot(projectId, runId)), 'snapshot');
  }

  // -- runs -----------------------------------------------------------------
  async listRuns(projectId?: string): Promise<ProjectRun[]> {
    return unwrap<ProjectRun[]>(await this.#request(ROUTES.listRuns(projectId)), 'runs');
  }

  async runEvents(
    projectId: string,
    runId: string,
    afterIndex?: number,
  ): Promise<{ events: RunEventRecord[]; nextIndex: number }> {
    const raw = await this.#request(ROUTES.runEvents(projectId, runId, afterIndex));
    const events = unwrap<RunEventRecord[]>(raw, 'events');
    const nextIndex = (raw as { nextIndex?: unknown }).nextIndex;
    return { events, nextIndex: typeof nextIndex === 'number' ? nextIndex : events.length };
  }

  async startRun(payload: StartRunPayload): Promise<{ ok: boolean; runId?: string; error?: string }> {
    return (await this.#request(ROUTES.startRun(payload))) as { ok: boolean; runId?: string; error?: string };
  }

  async #runAction(route: RouteDef<unknown>): Promise<OkResult> {
    return (await this.#request(route)) as OkResult;
  }

  pauseRun(runId: string): Promise<OkResult> {
    return this.#runAction(ROUTES.pauseRun(runId));
  }

  resumeRun(runId: string): Promise<OkResult> {
    return this.#runAction(ROUTES.resumeRun(runId));
  }

  cancelRun(runId: string): Promise<OkResult> {
    return this.#runAction(ROUTES.cancelRun(runId));
  }

  recoverRun(runId: string): Promise<OkResult> {
    return this.#runAction(ROUTES.recoverRun(runId));
  }

  // -- approvals --------------------------------------------------------------
  async listApprovals(projectId?: string, runId?: string): Promise<ApprovalRecord[]> {
    return unwrap<ApprovalRecord[]>(await this.#request(ROUTES.listApprovals(projectId, runId)), 'approvals');
  }

  async decideApproval(
    payload: DecideApprovalPayload,
  ): Promise<{ ok: boolean; approval?: ApprovalRecord; error?: string }> {
    return (await this.#request(ROUTES.decideApproval(payload))) as {
      ok: boolean;
      approval?: ApprovalRecord;
      error?: string;
    };
  }

  // -- artifacts --------------------------------------------------------------
  async readArtifact(
    projectId: string,
    runId: string,
    nodeId: string,
    attempt?: number,
  ): Promise<{ ok: boolean; text?: string; meta?: ArtifactMeta; error?: string }> {
    return (await this.#request(ROUTES.readArtifact(projectId, runId, nodeId, attempt))) as {
      ok: boolean;
      text?: string;
      meta?: ArtifactMeta;
      error?: string;
    };
  }

  // -- chat ---------------------------------------------------------------------
  async chatListSessions(): Promise<ChatSessionSummary[]> {
    return unwrap<ChatSessionSummary[]>(await this.#request(ROUTES.chatListSessions()), 'sessions');
  }

  async chatCreateSession(payload: CreateChatSessionPayload): Promise<{ ok: boolean; session?: ChatSession; error?: string }> {
    return (await this.#request(ROUTES.chatCreateSession(payload))) as {
      ok: boolean;
      session?: ChatSession;
      error?: string;
    };
  }

  async chatGetSession(sessionId: string): Promise<ChatSession | null> {
    return unwrap<ChatSession>(await this.#request(ROUTES.chatGetSession(sessionId)), 'session');
  }

  async chatSend(sessionId: string, payload: ChatSendPayload): Promise<ChatSendResult> {
    return (await this.#request(ROUTES.chatSend(sessionId, payload))) as ChatSendResult;
  }

  async chatStop(sessionId: string): Promise<OkResult> {
    return (await this.#request(ROUTES.chatStop(sessionId))) as OkResult;
  }
}
