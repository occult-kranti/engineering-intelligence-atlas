import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import { ChatManager, ChatStore } from '../src/main/chat';
import { CompanionServer, CompanionStore, MAX_BODY_BYTES } from '../src/main/companion';
import { ProjectRunner, ProjectStore, type GenerateFn } from '../src/main/projects';
import { SkillRegistry } from '../src/main/skills';
import type { SafeStorageLike } from '../src/main/vault';

const SKILLS_ROOT = path.join(__dirname, '..', 'resources', 'skills');
const RATES = { inputUsdPerMillion: 1, outputUsdPerMillion: 2 };

function tmpdir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'companion-test-'));
}

async function waitFor(cond: () => boolean, timeoutMs = 8000): Promise<void> {
  const start = Date.now();
  while (!cond()) {
    if (Date.now() - start > timeoutMs) throw new Error('waitFor timed out');
    await new Promise((r) => setTimeout(r, 10));
  }
}

/** AES-256-GCM mock of Electron safeStorage (unavailable under vitest). */
function makeMockSafeStorage(): SafeStorageLike & { available: boolean } {
  const key = crypto.randomBytes(32);
  return {
    available: true,
    isEncryptionAvailable() {
      return this.available;
    },
    encryptString(plain: string): Buffer {
      const iv = crypto.randomBytes(12);
      const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
      return Buffer.concat([iv, cipher.update(plain, 'utf8'), cipher.final(), cipher.getAuthTag()]);
    },
    decryptString(blob: Buffer): string {
      const iv = blob.subarray(0, 12);
      const tag = blob.subarray(blob.length - 16);
      const data = blob.subarray(12, blob.length - 16);
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAuthTag(tag);
      return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
    },
  };
}

const simpleGenerate: GenerateFn = async () => ({ text: 'ok\nVERDICT: ACCEPT', inputTokens: 10, outputTokens: 10 });

interface Harness {
  dir: string;
  storage: ReturnType<typeof makeMockSafeStorage>;
  companionStore: CompanionStore;
  projectStore: ProjectStore;
  runner: ProjectRunner;
  chat: ChatManager;
  server: CompanionServer;
}

function makeHarness(dir: string, opts: { rateLimitPerMinute?: number; storage?: ReturnType<typeof makeMockSafeStorage> } = {}): Harness {
  const storage = opts.storage ?? makeMockSafeStorage();
  const companionStore = new CompanionStore(dir, storage);
  const projectStore = new ProjectStore(dir);
  const runner = new ProjectRunner(projectStore, simpleGenerate);
  const skills = { registry: new SkillRegistry(SKILLS_ROOT), root: SKILLS_ROOT };
  const chat = new ChatManager(new ChatStore(dir), projectStore, simpleGenerate, { skills });
  const server = new CompanionServer({
    store: companionStore,
    projectStore,
    projectRunner: runner,
    chat,
    skills,
    ...(opts.rateLimitPerMinute !== undefined ? { rateLimitPerMinute: opts.rateLimitPerMinute } : {}),
  });
  return { dir, storage, companionStore, projectStore, runner, chat, server };
}

interface RawResponse {
  status: number;
  headers: http.IncomingHttpHeaders;
  body: string;
  json: () => unknown;
}

function rawRequest(opts: {
  port: number;
  method?: string;
  path: string;
  token?: string;
  host?: string;
  contentType?: string;
  body?: string;
}): Promise<RawResponse> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: '127.0.0.1',
        port: opts.port,
        method: opts.method ?? 'GET',
        path: opts.path,
        headers: {
          ...(opts.token !== undefined ? { authorization: `Bearer ${opts.token}` } : {}),
          ...(opts.host !== undefined ? { host: opts.host } : {}),
          ...(opts.contentType !== undefined ? { 'content-type': opts.contentType } : {}),
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => {
          const body = Buffer.concat(chunks).toString('utf8');
          resolve({ status: res.statusCode ?? 0, headers: res.headers, body, json: () => JSON.parse(body) });
        });
      },
    );
    req.on('error', reject);
    if (opts.body !== undefined) req.write(opts.body);
    req.end();
  });
}

describe('companion bridge', () => {
  let dir: string;
  let h: Harness;

  beforeEach(() => {
    dir = tmpdir();
    h = makeHarness(dir);
  });
  afterEach(async () => {
    await h.server.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  async function enable(): Promise<{ token: string; port: number }> {
    const res = await h.server.enable(0); // ephemeral loopback port for tests
    expect(res.ok).toBe(true);
    return { token: res.token as string, port: res.port as number };
  }

  it('is disabled by default and serves nothing', async () => {
    const status = h.server.status();
    expect(status.enabled).toBe(false);
    expect(status.running).toBe(false);
    expect(status.port).toBeNull();
    expect(status.paired).toBe(false);
    await expect(rawRequest({ port: 4319, path: '/health' })).rejects.toThrow();
  });

  it('enable returns a high-entropy token ONCE and binds 127.0.0.1 only', async () => {
    const { token, port } = await enable();
    expect(token.length).toBeGreaterThanOrEqual(43); // 256 bits, base64url
    const status = h.server.status();
    expect(status.enabled).toBe(true);
    expect(status.running).toBe(true);
    expect(status.port).toBe(port);
    // The listener is bound to loopback only.
    const address = (h.server as unknown as { server: http.Server }).server.address() as AddressInfo;
    expect(address.address).toBe('127.0.0.1');
    // Status exposes fingerprint/metadata only — never the token.
    const statusJson = JSON.stringify(status);
    expect(statusJson).not.toContain(token);
    expect(status.tokenFingerprint).toMatch(/^[0-9a-f]{12}$/);
    expect(status.tokenFingerprint).toBe(crypto.createHash('sha256').update(token, 'utf8').digest('hex').slice(0, 12));
    expect(status.tokenUpdatedAt).not.toBeNull();
    // The plaintext token is nowhere on disk.
    const companionDir = path.join(dir, 'companion');
    const onDisk = fs.readdirSync(companionDir).map((f) => fs.readFileSync(path.join(companionDir, f))).join('');
    expect(onDisk).not.toContain(token);
    // A second enable refuses rather than re-showing a token.
    const again = await h.server.enable(0);
    expect(again.ok).toBe(false);
  });

  it('fails closed when OS encryption is unavailable', async () => {
    h.storage.available = false;
    const res = await h.server.enable(0);
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/secure storage/i);
    expect(res.token).toBeUndefined();
    expect(h.server.status().running).toBe(false);
  });

  it('requires a valid bearer token on every route (constant-time check)', async () => {
    const { token, port } = await enable();
    const noAuth = await rawRequest({ port, path: '/health' });
    expect(noAuth.status).toBe(401);
    const badAuth = await rawRequest({ port, path: '/health', token: 'wrong-token' });
    expect(badAuth.status).toBe(401);
    const nearMiss = await rawRequest({ port, path: '/health', token: `${token.slice(0, -1)}x` });
    expect(nearMiss.status).toBe(401);
    const ok = await rawRequest({ port, path: '/health', token });
    expect(ok.status).toBe(200);
    expect(ok.json()).toMatchObject({ ok: true, bridgeVersion: 4 });
  });

  it('rejects host headers outside the loopback allowlist', async () => {
    const { token, port } = await enable();
    const evil = await rawRequest({ port, path: '/health', token, host: 'evil.example.com' });
    expect(evil.status).toBe(403);
    const wrongPort = await rawRequest({ port, path: '/health', token, host: '127.0.0.1:1' });
    expect(wrongPort.status).toBe(403);
    const ok = await rawRequest({ port, path: '/health', token, host: `127.0.0.1:${port}` });
    expect(ok.status).toBe(200);
  });

  it('enforces JSON content type, body cap, and sends no CORS headers', async () => {
    const { token, port } = await enable();
    const noType = await rawRequest({ port, method: 'POST', path: '/v1/projects', token, body: '{}' });
    expect(noType.status).toBe(415);
    const tooBig = await rawRequest({
      port,
      method: 'POST',
      path: '/v1/projects',
      token,
      contentType: 'application/json',
      body: JSON.stringify({ pad: 'x'.repeat(MAX_BODY_BYTES) }),
    });
    expect(tooBig.status).toBe(413);
    const badJson = await rawRequest({ port, method: 'POST', path: '/v1/projects', token, contentType: 'application/json', body: '{nope' });
    expect(badJson.status).toBe(400);
    const ok = await rawRequest({ port, path: '/health', token });
    expect(ok.headers['access-control-allow-origin']).toBeUndefined();
    expect(ok.headers['x-content-type-options']).toBe('nosniff');
  });

  it('rate-limits per peer', async () => {
    await h.server.close();
    h = makeHarness(dir, { rateLimitPerMinute: 5 });
    const { token, port } = await enable();
    for (let i = 0; i < 5; i += 1) {
      expect((await rawRequest({ port, path: '/health', token })).status).toBe(200);
    }
    expect((await rawRequest({ port, path: '/health', token })).status).toBe(429);
  });

  it('creates projects only with explicit confirmation and lists them', async () => {
    const { token, port } = await enable();
    const unconfirmed = await rawRequest({
      port,
      method: 'POST',
      path: '/v1/projects',
      token,
      contentType: 'application/json',
      body: JSON.stringify({ name: 'P', goal: 'g', provider: 'openai', model: 'm' }),
    });
    expect(unconfirmed.status).toBe(400);
    expect((unconfirmed.json() as { error: string }).error).toMatch(/confirmation/);

    const created = await rawRequest({
      port,
      method: 'POST',
      path: '/v1/projects',
      token,
      contentType: 'application/json',
      body: JSON.stringify({ name: 'P', goal: 'g', provider: 'openai', model: 'm', confirmed: true }),
    });
    expect(created.status).toBe(200);
    const project = (created.json() as { project: { id: string } }).project;
    const listed = await rawRequest({ port, path: '/v1/projects', token });
    expect((listed.json() as { projects: Array<{ id: string }> }).projects.map((p) => p.id)).toContain(project.id);
  });

  it('runs the projects/runs/events/artifacts/approvals slice end-to-end', async () => {
    const { token, port } = await enable();
    const created = await rawRequest({
      port,
      method: 'POST',
      path: '/v1/projects',
      token,
      contentType: 'application/json',
      body: JSON.stringify({
        name: 'Gated',
        goal: 'g',
        provider: 'openai',
        model: 'm',
        confirmed: true,
        nodes: [
          { role: 'build', title: 'B', instructions: 'i', dependsOn: [], approvalBefore: true },
          { role: 'review', title: 'V', instructions: 'i', dependsOn: [0] },
        ],
      }),
    });
    const project = (created.json() as { project: { id: string } }).project;

    const started = await rawRequest({
      port,
      method: 'POST',
      path: '/v1/runs/start',
      token,
      contentType: 'application/json',
      body: JSON.stringify({ projectId: project.id, runBudget: { maxTokens: 100000, maxMinutes: 30, maxUsd: 10 }, priceRates: RATES }),
    });
    expect(started.status).toBe(200);
    const runId = (started.json() as { runId: string }).runId;

    // The run parks at the approval gate.
    await waitFor(async () => {
      const runs = await rawRequest({ port, path: `/v1/runs?projectId=${project.id}`, token });
      return (runs.json() as { runs: Array<{ status: string }> }).runs[0]?.status === 'waiting-approval';
    });

    // Approvals: decide requires the exact payloadHash.
    const approvalsRes = await rawRequest({ port, path: `/v1/approvals?projectId=${project.id}&runId=${runId}`, token });
    const approval = (approvalsRes.json() as { approvals: Array<{ id: string; payloadHash: string; payload: unknown }> }).approvals[0];
    expect(approval).toBeDefined();
    // The approval payload pins the exact prompt (hash + bounded excerpt).
    const payload = approval?.payload as { promptSha256?: string; promptExcerpt?: string };
    expect(payload.promptSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(typeof payload.promptExcerpt).toBe('string');

    const wrongHash = await rawRequest({
      port,
      method: 'POST',
      path: '/v1/approvals/decide',
      token,
      contentType: 'application/json',
      body: JSON.stringify({ projectId: project.id, runId, approvalId: approval?.id, decision: 'approved', payloadHash: 'f'.repeat(64) }),
    });
    expect(wrongHash.status).toBe(400);

    const decided = await rawRequest({
      port,
      method: 'POST',
      path: '/v1/approvals/decide',
      token,
      contentType: 'application/json',
      body: JSON.stringify({ projectId: project.id, runId, approvalId: approval?.id, decision: 'approved', payloadHash: approval?.payloadHash }),
    });
    expect(decided.status).toBe(200);

    await waitFor(async () => {
      const runs = await rawRequest({ port, path: `/v1/runs?projectId=${project.id}`, token });
      return (runs.json() as { runs: Array<{ status: string }> }).runs[0]?.status === 'completed';
    });

    const events = await rawRequest({ port, path: `/v1/events/read?projectId=${project.id}&runId=${runId}`, token });
    expect((events.json() as { events: unknown[] }).events.length).toBeGreaterThan(3);

    const artifact = await rawRequest({ port, path: `/v1/artifacts/read?projectId=${project.id}&runId=${runId}&nodeId=node-1`, token });
    expect(artifact.status).toBe(200);
    expect((artifact.json() as { text: string }).text).toContain('ok');

    const office = await rawRequest({ port, path: `/v1/office?projectId=${project.id}`, token });
    expect((office.json() as { snapshot: { nodeCount: number } }).snapshot.nodeCount).toBe(2);

    // pause/resume/cancel/recover validate and fail cleanly on finished runs.
    const cancel = await rawRequest({ port, method: 'POST', path: '/v1/runs/cancel', token, contentType: 'application/json', body: JSON.stringify({ runId }) });
    expect(cancel.status).toBe(400);
    const badRecover = await rawRequest({ port, method: 'POST', path: '/v1/runs/recover', token, contentType: 'application/json', body: JSON.stringify({ runId }) });
    expect(badRecover.status).toBe(400);
  });

  it('serves the chat slice (create/send/poll/stop/list) over HTTP', async () => {
    const { token, port } = await enable();
    const created = await rawRequest({
      port,
      method: 'POST',
      path: '/v1/chat/sessions',
      token,
      contentType: 'application/json',
      body: JSON.stringify({ provider: 'openai', model: 'gpt-5-mini', priceRates: RATES }),
    });
    expect(created.status).toBe(200);
    const session = (created.json() as { session: { id: string } }).session;

    const unconfirmed = await rawRequest({
      port,
      method: 'POST',
      path: `/v1/chat/sessions/${session.id}/send`,
      token,
      contentType: 'application/json',
      body: JSON.stringify({ text: 'hi' }),
    });
    expect(unconfirmed.status).toBe(400);

    const sent = await rawRequest({
      port,
      method: 'POST',
      path: `/v1/chat/sessions/${session.id}/send`,
      token,
      contentType: 'application/json',
      body: JSON.stringify({ text: 'hi', confirmed: true }),
    });
    expect(sent.status).toBe(200);

    // Poll until the assistant message completes.
    await waitFor(async () => {
      const got = await rawRequest({ port, path: `/v1/chat/sessions/${session.id}`, token });
      const s = (got.json() as { session: { messages: Array<{ status: string }> } }).session;
      return s.messages[1]?.status === 'completed';
    });
    const got = await rawRequest({ port, path: `/v1/chat/sessions/${session.id}`, token });
    const full = (got.json() as { session: { messages: Array<{ text: string; provenance: unknown }> } }).session;
    expect(full.messages[1]?.text).toContain('ok');
    expect(full.messages[1]?.provenance).toBeTruthy();

    const listed = await rawRequest({ port, path: '/v1/chat/sessions', token });
    expect((listed.json() as { sessions: Array<{ id: string }> }).sessions.map((s) => s.id)).toContain(session.id);

    const stopped = await rawRequest({ port, method: 'POST', path: `/v1/chat/sessions/${session.id}/stop`, token, contentType: 'application/json', body: '{}' });
    expect(stopped.status).toBe(200); // no in-flight generation -> ok:false payload
    expect((stopped.json() as { ok: boolean }).ok).toBe(false);

    const missing = await rawRequest({ port, path: '/v1/chat/sessions/chat-nope', token });
    expect(missing.status).toBe(404);
  });

  it('regenerate rotates the token (old token dies immediately) and disable wipes it', async () => {
    const { token, port } = await enable();
    expect((await rawRequest({ port, path: '/health', token })).status).toBe(200);

    const rotated = await h.server.regenerateToken();
    expect(rotated.ok).toBe(true);
    const newToken = rotated.token as string;
    expect(newToken).not.toBe(token);
    expect((await rawRequest({ port, path: '/health', token })).status).toBe(401);
    expect((await rawRequest({ port, path: '/health', token: newToken })).status).toBe(200);

    const disabled = await h.server.disable();
    expect(disabled.ok).toBe(true);
    expect(h.server.status().running).toBe(false);
    expect(h.server.status().paired).toBe(false);
    await expect(rawRequest({ port, path: '/health', token: newToken })).rejects.toThrow();
  });

  it('startIfEnabled restores a previously enabled bridge and fails closed without a token', async () => {
    const { token, port } = await enable();
    // Persist the concrete bound port (enable(0) stores the ephemeral port).
    h.companionStore.setEnabled(true, port);
    await h.server.close();

    // New server on the same store (app restart): comes back up on the saved port.
    const h2 = makeHarness(dir, { storage: h.storage });
    await h2.server.startIfEnabled();
    expect(h2.server.status().running).toBe(true);
    expect(h2.server.status().port).toBe(port);
    expect((await rawRequest({ port, path: '/health', token })).status).toBe(200);
    await h2.server.close();

    // Token blob wiped: fail closed (disabled), never serve unauthenticated.
    h.companionStore.clearToken();
    const h3 = makeHarness(dir, { storage: h.storage });
    await h3.server.startIfEnabled();
    expect(h3.server.status().running).toBe(false);
    expect(h3.server.status().enabled).toBe(false);
    await h3.server.close();
  });

  it('returns 404 for unknown routes and validates ids', async () => {
    const { token, port } = await enable();
    expect((await rawRequest({ port, path: '/nope', token })).status).toBe(404);
    expect((await rawRequest({ port, path: '/v1/office?projectId=proj-nope', token })).status).toBe(404);
    expect((await rawRequest({ port, path: '/v1/artifacts/read?projectId=p&runId=r&nodeId=..%2F..', token })).status).toBe(400);
    // Traversal attempt can never reach files: the store rejects the id.
    expect((await rawRequest({ port, path: '/v1/artifacts/read?projectId=..%2Fsecret&runId=r&nodeId=n', token })).status).toBe(400);
  });
});
