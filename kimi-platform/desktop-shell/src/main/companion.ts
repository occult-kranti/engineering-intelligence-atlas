import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import type {
  ApprovalRecord,
  CompanionEnableResult,
  CompanionStatus,
  CreateProjectRequest,
} from '../shared/contract';
import { deriveOfficeSnapshot } from '../shared/office';
import type { ChatManager } from './chat';
import { decideHireApproval } from './hiring';
import type { ProjectRunner, ProjectStore } from './projects';
import type { SkillRegistry } from './skills';
import type { SafeStorageLike } from './vault';

/**
 * v4 VS Code companion bridge: an explicitly enabled, authenticated HTTP
 * service bound ONLY to 127.0.0.1. Default state is DISABLED.
 *
 * Security posture:
 *  - Pairing: enable/regenerate returns a high-entropy (256-bit) token exactly
 *    once. Only a safeStorage-encrypted blob is persisted (fail closed when OS
 *    encryption is unavailable); status exposes a SHA-256 fingerprint and
 *    timestamps, never the token.
 *  - Every request requires `Authorization: Bearer <token>` checked with a
 *    constant-time comparison, a Host header on the loopback allowlist, a
 *    loopback peer address, JSON content type for writes, a 64 KiB body cap,
 *    a request timeout, and a per-IP rate limit.
 *  - No CORS headers, no remote binding, no token logging, no arbitrary file
 *    paths, no shell/tool execution, no workspace writes: every route reuses
 *    the validated desktop stores/runner/managers. The extension performs its
 *    own explicit-confirmed, workspace-relative artifact writes.
 *  - State-changing project creation requires `confirmed: true` in the body;
 *    the extension collects its own explicit user confirmation.
 */

export const COMPANION_DEFAULT_PORT = 4319;
export const MAX_BODY_BYTES = 64 * 1024;
export const REQUEST_TIMEOUT_MS = 10_000;
export const RATE_LIMIT_PER_MINUTE = 240;
export const TOKEN_BYTES = 32;

const LOOPBACK_PEERS = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

/** High-entropy pairing token (256 bits, URL-safe). */
export function generatePairingToken(): string {
  return crypto.randomBytes(TOKEN_BYTES).toString('base64url');
}

function sha256(text: string): string {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

/**
 * Non-secret companion settings (enabled/port) plus the safeStorage-encrypted
 * pairing token blob. The plaintext token exists only in memory between
 * generation and encryption.
 */
export class CompanionStore {
  private readonly dir: string;
  private readonly filePath: string;
  private readonly tokenPath: string;
  private settings: { enabled: boolean; port: number; tokenUpdatedAt: string | null } = {
    enabled: false,
    port: COMPANION_DEFAULT_PORT,
    tokenUpdatedAt: null,
  };

  constructor(
    userDataPath: string,
    private readonly safeStorage: SafeStorageLike,
  ) {
    this.dir = path.join(userDataPath, 'companion');
    this.filePath = path.join(this.dir, 'companion.json');
    this.tokenPath = path.join(this.dir, 'token.bin');
    this.load();
  }

  private load(): void {
    try {
      const raw = JSON.parse(fs.readFileSync(this.filePath, 'utf8')) as Record<string, unknown>;
      if (typeof raw.enabled === 'boolean') this.settings.enabled = raw.enabled;
      if (Number.isInteger(raw.port) && (raw.port as number) >= 0 && (raw.port as number) <= 65535) {
        this.settings.port = raw.port as number;
      }
      if (typeof raw.tokenUpdatedAt === 'string') this.settings.tokenUpdatedAt = raw.tokenUpdatedAt;
    } catch {
      // Missing/corrupt settings: keep safe defaults (disabled).
    }
    // Never persist 'enabled' without a readable token; fail closed.
    if (this.settings.enabled && !fs.existsSync(this.tokenPath)) this.settings.enabled = false;
  }

  private persist(): void {
    fs.mkdirSync(this.dir, { recursive: true });
    const tmp = `${this.filePath}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(this.settings, null, 2), { encoding: 'utf8', mode: 0o600 });
    fs.renameSync(tmp, this.filePath);
  }

  encryptionAvailable(): boolean {
    try {
      return this.safeStorage.isEncryptionAvailable();
    } catch {
      return false;
    }
  }

  getSettings(): { enabled: boolean; port: number } {
    return { enabled: this.settings.enabled, port: this.settings.port };
  }

  setEnabled(enabled: boolean, port?: number): void {
    this.settings.enabled = enabled;
    if (port !== undefined) this.settings.port = port;
    this.persist();
  }

  /** Persist a new pairing token. FAILS CLOSED when OS encryption is unavailable. */
  setToken(plaintext: string): { ok: boolean; error?: string } {
    if (!this.encryptionAvailable()) {
      return { ok: false, error: 'OS secure storage is unavailable; the pairing token cannot be stored, so the companion stays disabled.' };
    }
    let blob: Buffer;
    try {
      blob = this.safeStorage.encryptString(plaintext);
    } catch {
      return { ok: false, error: 'OS encryption failed; the pairing token was not stored.' };
    }
    try {
      fs.mkdirSync(this.dir, { recursive: true });
      const tmp = `${this.tokenPath}.tmp`;
      fs.writeFileSync(tmp, blob, { mode: 0o600 });
      fs.renameSync(tmp, this.tokenPath);
      this.settings.tokenUpdatedAt = new Date().toISOString();
      this.persist();
      return { ok: true };
    } catch {
      return { ok: false, error: 'Failed to write the encrypted pairing token.' };
    }
  }

  /** Decrypt the pairing token for in-process comparison ONLY. Never exposed. */
  getToken(): string | null {
    if (!this.encryptionAvailable()) return null;
    let blob: Buffer;
    try {
      blob = fs.readFileSync(this.tokenPath);
    } catch {
      return null;
    }
    try {
      return this.safeStorage.decryptString(blob);
    } catch {
      return null; // tampered blob or changed OS keychain: fail closed
    }
  }

  clearToken(): void {
    try {
      fs.rmSync(this.tokenPath, { force: true });
      this.settings.tokenUpdatedAt = null;
      this.persist();
    } catch {
      // best effort
    }
  }

  /** Metadata safe for status(): fingerprint + timestamps, never the token. */
  tokenMeta(): { paired: boolean; tokenFingerprint: string | null; tokenUpdatedAt: string | null } {
    const token = this.getToken();
    if (token === null) return { paired: fs.existsSync(this.tokenPath), tokenFingerprint: null, tokenUpdatedAt: this.settings.tokenUpdatedAt };
    return { paired: true, tokenFingerprint: sha256(token).slice(0, 12), tokenUpdatedAt: this.settings.tokenUpdatedAt };
  }
}

export interface CompanionServerDeps {
  store: CompanionStore;
  projectStore: ProjectStore;
  projectRunner: ProjectRunner;
  chat: ChatManager;
  skills: { registry: SkillRegistry; root: string };
  /** Requests allowed per minute per peer IP (injectable for tests). */
  rateLimitPerMinute?: number;
  now?: () => number;
}

interface RateBucket {
  count: number;
  resetAt: number;
}

export class CompanionServer {
  private server: http.Server | null = null;
  private readonly rateLimit: number;
  private readonly now: () => number;
  private readonly buckets = new Map<string, RateBucket>();

  constructor(private readonly deps: CompanionServerDeps) {
    this.rateLimit = deps.rateLimitPerMinute ?? RATE_LIMIT_PER_MINUTE;
    this.now = deps.now ?? Date.now;
  }

  status(): CompanionStatus {
    const settings = this.deps.store.getSettings();
    const address = this.server?.address();
    const port = address !== null && typeof address === 'object' ? address.port : null;
    return {
      enabled: settings.enabled,
      running: this.server !== null && this.server.listening,
      port,
      encryptionAvailable: this.deps.store.encryptionAvailable(),
      ...this.deps.store.tokenMeta(),
    };
  }

  /**
   * Enable the bridge: generate a fresh pairing token (returned ONCE),
   * persist only its encrypted blob, then bind the loopback listener.
   * Fails closed: any error leaves the bridge disabled.
   */
  async enable(port?: number): Promise<CompanionEnableResult> {
    try {
      if (this.server !== null) return { ok: false, error: 'companion is already enabled; disable it first' };
      const resolvedPort = port ?? this.deps.store.getSettings().port;
      if (!Number.isInteger(resolvedPort) || resolvedPort < 0 || resolvedPort > 65535) {
        return { ok: false, error: 'port must be an integer between 0 and 65535' };
      }
      const token = generatePairingToken();
      const stored = this.deps.store.setToken(token);
      if (!stored.ok) return { ok: false, error: stored.error };
      try {
        await this.listen(resolvedPort);
      } catch (err) {
        this.deps.store.clearToken();
        return { ok: false, error: err instanceof Error ? err.message : String(err) };
      }
      this.deps.store.setEnabled(true, resolvedPort);
      const bound = this.status().port ?? resolvedPort;
      return { ok: true, token, ...(bound !== null ? { port: bound } : {}) };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  /** Disable the bridge: close the listener and wipe the pairing token. */
  async disable(): Promise<{ ok: boolean; error?: string }> {
    try {
      await this.close();
      this.deps.store.clearToken();
      this.deps.store.setEnabled(false);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  /**
   * Rotate the pairing token. The new token is returned exactly once; the old
   * token stops working immediately (the listener compares against disk).
   */
  async regenerateToken(): Promise<CompanionEnableResult> {
    try {
      const token = generatePairingToken();
      const stored = this.deps.store.setToken(token);
      if (!stored.ok) return { ok: false, error: stored.error };
      const port = this.status().port;
      return { ok: true, token, ...(port !== null ? { port } : {}) };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  /** Start listening if the persisted settings say the bridge is enabled. */
  async startIfEnabled(): Promise<void> {
    const settings = this.deps.store.getSettings();
    if (!settings.enabled || this.server !== null) return;
    // Fail closed: no readable token => refuse to serve and flip to disabled.
    if (this.deps.store.getToken() === null) {
      this.deps.store.setEnabled(false);
      return;
    }
    await this.listen(settings.port);
  }

  async close(): Promise<void> {
    const server = this.server;
    this.server = null;
    if (server === null) return;
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
      server.closeAllConnections?.();
    });
  }

  private listen(port: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const server = http.createServer((req, res) => {
        void this.handle(req, res);
      });
      server.requestTimeout = REQUEST_TIMEOUT_MS;
      server.headersTimeout = 5_000;
      server.once('error', reject);
      // LOOPBACK ONLY: never pass a hostname other than 127.0.0.1 here.
      server.listen(port, '127.0.0.1', () => {
        server.removeListener('error', reject);
        this.server = server;
        resolve();
      });
    });
  }

  // ------------------------------------------------------------------ pipeline

  private sendJson(res: http.ServerResponse, status: number, body: unknown): void {
    if (res.writableEnded) return;
    const payload = JSON.stringify(body);
    res.writeHead(status, {
      'content-type': 'application/json; charset=utf-8',
      'content-length': Buffer.byteLength(payload),
      // No CORS headers: browsers/other origins get nothing useful.
      'x-content-type-options': 'nosniff',
      'cache-control': 'no-store',
    });
    res.end(payload);
  }

  private error(res: http.ServerResponse, status: number, message: string): void {
    this.sendJson(res, status, { ok: false, error: message });
  }

  /** Constant-time bearer check: both sides are hashed to fixed length first. */
  private tokenMatches(provided: string): boolean {
    const stored = this.deps.store.getToken();
    if (stored === null) return false;
    const a = Buffer.from(sha256(provided), 'utf8');
    const b = Buffer.from(sha256(stored), 'utf8');
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  }

  private hostAllowed(host: string | undefined): boolean {
    if (typeof host !== 'string') return false;
    const match = /^([^:]+):(\d+)$/.exec(host.trim());
    if (!match) return false;
    const [, name, port] = match;
    if (name !== '127.0.0.1' && name !== 'localhost' && name !== '[::1]') return false;
    const bound = this.status().port;
    return bound !== null && Number(port) === bound;
  }

  private rateLimited(peer: string): boolean {
    const nowMs = this.now();
    const bucket = this.buckets.get(peer);
    if (!bucket || nowMs >= bucket.resetAt) {
      this.buckets.set(peer, { count: 1, resetAt: nowMs + 60_000 });
      return false;
    }
    bucket.count += 1;
    return bucket.count > this.rateLimit;
  }

  private readBody(req: http.IncomingMessage): Promise<{ ok: true; body: string } | { ok: false; status: number; error: string }> {
    return new Promise((resolve) => {
      const chunks: Buffer[] = [];
      let size = 0;
      let settled = false;
      const done = (value: { ok: true; body: string } | { ok: false; status: number; error: string }) => {
        if (!settled) {
          settled = true;
          resolve(value);
        }
      };
      const timer = setTimeout(() => {
        req.removeAllListeners('data');
        req.resume();
        done({ ok: false, status: 408, error: 'request body timed out' });
      }, REQUEST_TIMEOUT_MS);
      req.on('data', (chunk: Buffer) => {
        size += chunk.length;
        if (size > MAX_BODY_BYTES) {
          clearTimeout(timer);
          // Stop buffering and drain the rest so the 413 response can still
          // be delivered on this connection (never destroy before responding).
          req.removeAllListeners('data');
          req.resume();
          done({ ok: false, status: 413, error: `request body exceeds the ${MAX_BODY_BYTES}-byte cap` });
          return;
        }
        chunks.push(chunk);
      });
      req.on('end', () => {
        clearTimeout(timer);
        done({ ok: true, body: Buffer.concat(chunks).toString('utf8') });
      });
      req.on('error', () => {
        clearTimeout(timer);
        done({ ok: false, status: 400, error: 'failed to read request body' });
      });
    });
  }

  private async handle(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    try {
      // 1. Loopback peer only (defense in depth on top of the bind address).
      const peer = req.socket.remoteAddress ?? '';
      if (!LOOPBACK_PEERS.has(peer)) return this.error(res, 403, 'loopback clients only');

      // 2. Host allowlist: only the exact bound loopback origin.
      if (!this.hostAllowed(req.headers.host)) return this.error(res, 403, 'host header is not on the loopback allowlist');

      // 3. Per-IP rate limit.
      if (this.rateLimited(peer)) return this.error(res, 429, 'rate limit exceeded');

      // 4. Bearer auth (constant-time). Every route requires it, including health.
      const auth = req.headers.authorization ?? '';
      const match = /^Bearer (.+)$/.exec(auth);
      if (!match || !this.tokenMatches(match[1] as string)) {
        return this.error(res, 401, 'missing or invalid bearer token');
      }

      const method = (req.method ?? 'GET').toUpperCase();
      const url = new URL(req.url ?? '/', 'http://127.0.0.1');

      // 5. Writes require JSON content type; bodies are capped and timed.
      let body: unknown = undefined;
      if (method === 'POST' || method === 'PUT' || method === 'PATCH' || method === 'DELETE') {
        const contentType = (req.headers['content-type'] ?? '').split(';')[0]?.trim().toLowerCase();
        if (contentType !== 'application/json') return this.error(res, 415, 'content-type must be application/json');
        const raw = await this.readBody(req);
        if (!raw.ok) return this.error(res, raw.status, raw.error);
        if (raw.body.length > 0) {
          try {
            body = JSON.parse(raw.body);
          } catch {
            return this.error(res, 400, 'request body is not valid JSON');
          }
        }
      }

      return await this.route(method, url, body, res);
    } catch (err) {
      // Never leak internals; the token is never part of any error path.
      return this.error(res, 500, err instanceof Error ? err.message.slice(0, 200) : 'internal error');
    }
  }

  // ------------------------------------------------------------------ routes

  private async route(method: string, url: URL, body: unknown, res: http.ServerResponse): Promise<void> {
    const p = url.pathname;
    const { projectStore, projectRunner, chat, skills } = this.deps;

    // GET /health — liveness + bridge version (authenticated like everything else).
    if (method === 'GET' && p === '/health') {
      return this.sendJson(res, 200, { ok: true, bridgeVersion: 4, service: 'research-director-companion' });
    }

    // -------------------------------------------------------------- projects
    if (method === 'GET' && p === '/v1/projects') {
      return this.sendJson(res, 200, { ok: true, projects: projectStore.listProjects() });
    }
    if (method === 'POST' && p === '/v1/projects') {
      if (!isRecord(body)) return this.error(res, 400, 'body must be an object');
      if (body.confirmed !== true) {
        return this.error(res, 400, 'project creation requires explicit user confirmation (confirmed: true)');
      }
      const { confirmed: _confirmed, ...req } = body;
      try {
        const project = projectStore.createProject(req as unknown as CreateProjectRequest);
        return this.sendJson(res, 200, { ok: true, project });
      } catch (err) {
        return this.error(res, 400, err instanceof Error ? err.message : String(err));
      }
    }

    // ---------------------------------------------------------------- office
    if (method === 'GET' && p === '/v1/office') {
      const projectId = url.searchParams.get('projectId') ?? '';
      const runId = url.searchParams.get('runId');
      const project = projectStore.getProject(projectId);
      if (!project) return this.error(res, 404, 'unknown project id');
      const run = runId ? projectStore.getRun(projectId, runId) : null;
      return this.sendJson(res, 200, { ok: true, snapshot: deriveOfficeSnapshot(project, run, skills.registry.skillRoles()) });
    }

    // ------------------------------------------------------------------ runs
    if (method === 'GET' && p === '/v1/runs') {
      const projectId = url.searchParams.get('projectId');
      return this.sendJson(res, 200, { ok: true, runs: projectStore.listRuns(projectId ?? undefined) });
    }
    const runAction = /^\/v1\/runs\/(start|pause|resume|cancel|recover)$/.exec(p);
    if (method === 'POST' && runAction) {
      if (!isRecord(body)) return this.error(res, 400, 'body must be an object');
      const action = runAction[1] as string;
      if (action === 'start') {
        if (typeof body.projectId !== 'string') return this.error(res, 400, 'projectId must be a string');
        const result = projectRunner.start(body.projectId, body.runBudget, body.priceRates);
        return this.sendJson(res, result.ok ? 200 : 400, result);
      }
      if (typeof body.runId !== 'string') return this.error(res, 400, 'runId must be a string');
      const result =
        action === 'pause'
          ? projectRunner.pause(body.runId)
          : action === 'resume'
            ? projectRunner.resume(body.runId)
            : action === 'cancel'
              ? projectRunner.cancel(body.runId)
              : projectRunner.recover(body.runId);
      return this.sendJson(res, result.ok ? 200 : 400, result);
    }

    // ------------------------------------------------------------- approvals
    if (method === 'GET' && p === '/v1/approvals') {
      const projectId = url.searchParams.get('projectId');
      const runId = url.searchParams.get('runId');
      let all: ApprovalRecord[];
      try {
        all = projectStore.listApprovals(projectId ?? undefined);
      } catch (err) {
        return this.error(res, 400, err instanceof Error ? err.message : String(err));
      }
      return this.sendJson(res, 200, { ok: true, approvals: runId ? all.filter((a) => a.runId === runId) : all });
    }
    if (method === 'POST' && p === '/v1/approvals/decide') {
      if (!isRecord(body)) return this.error(res, 400, 'body must be an object');
      if (typeof body.projectId !== 'string' || typeof body.approvalId !== 'string') {
        return this.error(res, 400, 'projectId and approvalId must be strings');
      }
      if (body.decision !== 'approved' && body.decision !== 'rejected') {
        return this.error(res, 400, 'decision must be approved or rejected');
      }
      if (typeof body.payloadHash !== 'string') return this.error(res, 400, 'payloadHash must be a string');
      const runId = typeof body.runId === 'string' ? body.runId : null;
      const result =
        runId === null
          ? decideHireApproval(projectStore, skills.registry, {
              projectId: body.projectId,
              approvalId: body.approvalId,
              decision: body.decision,
              payloadHash: body.payloadHash,
            })
          : projectStore.decideApproval({
              projectId: body.projectId,
              runId,
              approvalId: body.approvalId,
              decision: body.decision,
              payloadHash: body.payloadHash,
            });
      if (result.ok && runId !== null) projectRunner.wakeApprovals(runId);
      return this.sendJson(res, result.ok ? 200 : 400, result);
    }

    // ------------------------------------------------------------- artifacts
    if (method === 'GET' && p === '/v1/artifacts/read') {
      const projectId = url.searchParams.get('projectId');
      const runId = url.searchParams.get('runId');
      const nodeId = url.searchParams.get('nodeId');
      const attemptRaw = url.searchParams.get('attempt');
      if (!projectId || !runId || !nodeId) return this.error(res, 400, 'projectId, runId and nodeId are required');
      let attempt: number | undefined;
      if (attemptRaw !== null) {
        attempt = Number(attemptRaw);
        if (!Number.isInteger(attempt) || attempt < 1) return this.error(res, 400, 'attempt must be a positive integer');
      }
      try {
        const artifact = projectStore.readArtifact(projectId, runId, nodeId, attempt);
        if (!artifact) return this.error(res, 404, 'artifact not found');
        return this.sendJson(res, 200, { ok: true, text: artifact.text, meta: artifact.meta });
      } catch (err) {
        return this.error(res, 400, err instanceof Error ? err.message : String(err));
      }
    }

    // ---------------------------------------------------------------- events
    if (method === 'GET' && p === '/v1/events/read') {
      const projectId = url.searchParams.get('projectId');
      const runId = url.searchParams.get('runId');
      const afterIndexRaw = url.searchParams.get('afterIndex');
      if (!projectId || !runId) return this.error(res, 400, 'projectId and runId are required');
      const afterIndex = afterIndexRaw !== null && /^\d+$/.test(afterIndexRaw) ? Number(afterIndexRaw) : 0;
      try {
        const { events, nextIndex } = projectStore.readEvents(projectId, runId, afterIndex);
        return this.sendJson(res, 200, { ok: true, events, nextIndex });
      } catch (err) {
        return this.error(res, 400, err instanceof Error ? err.message : String(err));
      }
    }

    // ------------------------------------------------------------------ chat
    if (method === 'GET' && p === '/v1/chat/sessions') {
      return this.sendJson(res, 200, { ok: true, sessions: chat.listSessions() });
    }
    if (method === 'POST' && p === '/v1/chat/sessions') {
      const result = chat.createSession(body);
      return this.sendJson(res, result.ok ? 200 : 400, result);
    }
    const chatRoute = /^\/v1\/chat\/sessions\/([^/]+)(\/(send|stop))?$/.exec(p);
    if (chatRoute) {
      const sessionId = decodeURIComponent(chatRoute[1] as string);
      const sub = chatRoute[3];
      if (method === 'GET' && sub === undefined) {
        const session = chat.getSession(sessionId);
        if (!session) return this.error(res, 404, 'unknown chat session id');
        return this.sendJson(res, 200, { ok: true, session });
      }
      if (method === 'DELETE' && sub === undefined) {
        return this.sendJson(res, 200, chat.deleteSession(sessionId));
      }
      if (method === 'POST' && sub === 'send') {
        if (!isRecord(body)) return this.error(res, 400, 'body must be an object');
        if (typeof body.text !== 'string') return this.error(res, 400, 'text must be a string');
        const result = chat.sendMessage({ sessionId, text: body.text, confirmed: body.confirmed === true });
        return this.sendJson(res, result.ok ? 200 : 400, result);
      }
      if (method === 'POST' && sub === 'stop') {
        return this.sendJson(res, 200, chat.stop(sessionId));
      }
      return this.error(res, 405, 'method not allowed for this chat route');
    }

    return this.error(res, 404, 'not found');
  }
}
