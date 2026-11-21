import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import type { OfficeJob, OfficeSnapshot } from '../src/shared/office';
import { ModelPoolService } from '../src/main/modelPool';

const digest = 'a'.repeat(64);
const otherDigest = 'b'.repeat(64);
const model = 'llama3.2:1b';
const cleanups: Array<() => Promise<void> | void> = [];
afterEach(async () => { for (const close of cleanups.splice(0).reverse()) await close(); });

function officeFixture(): OfficeSnapshot {
  return {
    companies: [1, 2, 3].map(n => ({ id: `company${n}`, status: 'active', assistantId: `employee${n}` })),
    offices: [1, 2, 3].map(n => ({ id: `office${n}`, companyId: `company${n}`, status: 'active' })),
    departments: [], employees: [1, 2, 3].map(n => ({ id: `employee${n}`, companyId: `company${n}`, officeId: `office${n}`, departmentId: null, status: 'active' })),
    portfolio: { services: [], contracts: [] }, jobs: [],
  } as unknown as OfficeSnapshot;
}
const request = (n = 1, key = `pull${n}`) => ({ companyId: `company${n}`, employeeId: `employee${n}`, model, idempotencyKey: key });
const selection = (n = 1) => ({ companyId: `company${n}`, employeeId: `employee${n}`, model });
const job = (n = 1) => ({ ...selection(n), provider: 'ollama', officeId: `office${n}`, departmentId: null }) as OfficeJob;
async function until(test: () => boolean) { for (let i = 0; i < 100; i++) { if (test()) return; await new Promise(resolve => setTimeout(resolve, 10)); } throw new Error('Fixture condition timed out'); }

async function fixture(enabled = true) {
  const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), 'daftar-model-pool-'));
  cleanups.push(() => fs.rmSync(stateDir, { recursive: true, force: true }));
  const state = officeFixture();
  const data = { installed: [] as Array<{ name: string; digest: string; size: number }>, pulls: [] as http.ServerResponse[], calls: [] as string[], closed: 0, remote: false };
  const server = http.createServer(async (req, res) => {
    data.calls.push(req.url!); const chunks: Buffer[] = []; for await (const chunk of req) chunks.push(chunk);
    res.setHeader('Content-Type', 'application/json');
    if (req.url === '/api/tags') return res.end(JSON.stringify({ models: data.installed }));
    if (req.url === '/api/ps') return res.end(JSON.stringify({ models: data.installed.slice(0, 1) }));
    if (req.url === '/api/show') return res.end(JSON.stringify({ model_info: { 'general.architecture': 'llama' }, ...(data.remote ? { remote_host: 'https://ollama.com' } : {}) }));
    if (req.url === '/api/generate') return res.end(JSON.stringify({ response: 'Local fixture result', done: true, prompt_eval_count: 6, eval_count: 3 }));
    if (req.url === '/api/pull') {
      expect(JSON.parse(Buffer.concat(chunks).toString())).toEqual({ model, stream: true, insecure: false });
      res.setHeader('Content-Type', 'application/x-ndjson'); res.flushHeaders(); data.pulls.push(res);
      res.on('close', () => { data.closed++; }); return;
    }
    res.writeHead(404).end('{}');
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  cleanups.push(async () => { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); });
  const address = server.address() as { port: number };
  const options = { stateDir, snapshot: async () => ({ ok: true, snapshot: state }), baseUrl: `http://127.0.0.1:${address.port}`, localOnlyConfirmed: enabled, pullTimeoutMs: 3000 };
  const service = new ModelPoolService(options);
  cleanups.push(() => service.close());
  const emit = (value: unknown, index = 0) => data.pulls[index]!.write(`${JSON.stringify(value)}\n`);
  const finish = (index = 0) => { data.installed = [{ name: model, digest, size: 100 }]; emit({ status: 'success' }, index); data.pulls[index]!.end(); };
  return { service, data, state, options, emit, finish, stateDir };
}

describe('shared self-hosted model pool', () => {
  it('requires a reviewed model, local-only confirmation and an active scoped employee before any download', async () => {
    const f = await fixture(false);
    await expect(f.service.request(request())).rejects.toMatchObject({ code: 'MODEL_POOL_DISABLED' });
    expect(f.data.calls).toEqual([]);
    expect((await f.service.snapshot({ companyId: 'company1' })).snapshot.enabled).toBe(false);
    await f.service.close();
    const enabled = new ModelPoolService({ ...f.options, localOnlyConfirmed: true }); cleanups.push(() => enabled.close());
    await expect(enabled.request({ ...request(), model: 'gpt-oss:120b-cloud' })).rejects.toMatchObject({ code: 'MODEL_NOT_REVIEWED' });
    await expect(enabled.request({ ...request(), employeeId: 'employee2' })).rejects.toMatchObject({ code: 'MODEL_SCOPE_DENIED' });
    f.state.companies[0]!.status = 'paused';
    await expect(enabled.request(request())).rejects.toMatchObject({ code: 'MODEL_SCOPE_DENIED' });
    expect(f.data.pulls).toHaveLength(0);
  });

  it('deduplicates shared bytes, keeps company receipts separate, and cancellation leaves another requester running', async () => {
    const f = await fixture();
    const first = await f.service.request(request(1)); const second = await f.service.request(request(2));
    await until(() => f.data.pulls.length === 1); expect(second.reused).toBe(true);
    f.emit({ status: 'pulling', digest: `sha256:${digest}`, total: 100, completed: 20 });
    f.emit({ status: 'pulling', digest: `sha256:${digest}`, total: 100, completed: 45 });
    await until(() => fs.readFileSync(path.join(f.stateDir, 'model-pool/registry.json'), 'utf8').includes('"completedBytes":45'));
    const progress = await f.service.snapshot({ companyId: 'company2' });
    expect(progress.snapshot.requests).toHaveLength(1); expect(progress.snapshot.requests[0]).toMatchObject({ totalBytes: 100, completedBytes: 45 });
    expect(JSON.stringify(progress)).not.toContain('company1');
    await f.service.cancel({ companyId: 'company1', employeeId: 'employee1', requestId: first.requestId! });
    expect(f.data.closed).toBe(0); f.finish(); await f.service.waitForIdle();
    expect((await f.service.snapshot({ companyId: 'company1' })).snapshot.requests[0]?.status).toBe('cancelled');
    expect((await f.service.snapshot({ companyId: 'company2' })).snapshot.requests[0]?.status).toBe('ready');
    expect(f.data.pulls).toHaveLength(1); expect(f.data.calls).not.toContain('/api/delete');
    const selected = await f.service.select(selection(2)); expect(selected.snapshot.models[0]?.loaded).toBe(true);
    expect(selected.snapshot.assignments).toEqual([{ ...selection(2), digest }]);
    await expect(f.service.validateJob(job(1))).rejects.toMatchObject({ code: 'MODEL_NOT_ASSIGNED' });
    const output = await f.service.generateForJob(job(2), { model, prompt: 'A mock task', maxOutputTokens: 10 });
    expect(output).toMatchObject({ text: 'Local fixture result', usageObserved: true, inputTokens: 6, outputTokens: 3 });
  });

  it('preserves request idempotency, refuses conflicting replay, and verifies changed model digests before dispatch', async () => {
    const f = await fixture(); f.data.installed = [{ name: model, digest, size: 100 }];
    const saved = await f.service.request(request()); const repeated = await f.service.request(request());
    expect(repeated).toMatchObject({ requestId: saved.requestId, replayed: true });
    await expect(f.service.request({ ...request(), maxBytes: 101 })).rejects.toMatchObject({ code: 'MODEL_REQUEST_CONFLICT' });
    await f.service.select(selection()); await f.service.validateJob(job());
    f.data.installed[0]!.digest = otherDigest;
    await expect(f.service.generateForJob(job(), { model, prompt: 'must not run', maxOutputTokens: 5 })).rejects.toMatchObject({ code: 'MODEL_DIGEST_CHANGED' });
    expect(f.data.calls).not.toContain('/api/generate');
    expect(f.data.pulls).toHaveLength(0);
    await f.service.close();
    const restarted = new ModelPoolService(f.options); cleanups.push(() => restarted.close());
    expect((await restarted.request(request())).requestId).toBe(saved.requestId);
    expect((await restarted.snapshot({ companyId: 'company1' })).snapshot.assignments[0]?.digest).toBe(digest);
  });

  it('requires an active shared-service contract and revokes a download after scope changes', async () => {
    const f = await fixture();
    f.state.departments.push({ id: 'shared-dept', companyId: 'company3', officeId: 'office3', status: 'active' } as never);
    f.state.employees[2]!.departmentId = 'shared-dept';
    f.state.portfolio!.services.push({ id: 'service', companyId: 'company3', officeId: 'office3', departmentId: 'shared-dept', employeeIds: ['employee3'], status: 'active' } as never);
    f.state.portfolio!.contracts.push({ id: 'contract', serviceId: 'service', recipientCompanyId: 'company1', recipientOfficeId: 'office1', recipientDepartmentId: null, employeeIds: ['employee3'], allowedTools: [], status: 'active' } as never);
    const result = await f.service.request({ ...request(), employeeId: 'employee3' }); await until(() => f.data.pulls.length === 1);
    f.state.portfolio!.contracts[0]!.status = 'revoked';
    f.emit({ status: 'pulling', digest, total: 100, completed: 5 }); await f.service.waitForIdle();
    const snapshot = await f.service.snapshot({ companyId: 'company1' }); expect(snapshot.snapshot.requests[0]).toMatchObject({ id: result.requestId, status: 'cancelled' });
    await expect(f.service.select({ ...selection(), employeeId: 'employee3' })).rejects.toMatchObject({ code: 'MODEL_SCOPE_DENIED' });
    expect(f.data.calls).not.toContain('/api/delete');
  });

  it('enforces per-request byte ceilings without cancelling a larger authorized subscriber', async () => {
    const f = await fixture(); await f.service.request({ ...request(1), maxBytes: 50 }); await f.service.request(request(2));
    await until(() => f.data.pulls.length === 1); f.emit({ status: 'pulling', digest, total: 100, completed: 5 });
    await until(() => fs.readFileSync(path.join(f.stateDir, 'model-pool/registry.json'), 'utf8').includes('storage ceiling'));
    expect((await f.service.snapshot({ companyId: 'company1' })).snapshot.requests[0]?.status).toBe('failed');
    f.finish(); await f.service.waitForIdle(); expect((await f.service.snapshot({ companyId: 'company2' })).snapshot.requests[0]?.status).toBe('ready');
  });

  it('does not call an interrupted stream ready, and restarts do not resume a download automatically', async () => {
    const f = await fixture(); const first = await f.service.request(request()); await until(() => f.data.pulls.length === 1);
    f.emit({ status: 'pulling', digest, total: 100, completed: 20 }); await f.service.close();
    const restarted = new ModelPoolService(f.options); cleanups.push(() => restarted.close());
    const result = await restarted.request(request()); expect(result).toMatchObject({ replayed: true, requestId: first.requestId });
    expect(result.snapshot.requests[0]?.status).toBe('interrupted'); expect(f.data.pulls).toHaveLength(1);
    await restarted.request(request(1, 'new-request')); await until(() => f.data.pulls.length === 2);
    f.data.pulls[1]!.end(`${JSON.stringify({ status: 'pulling', digest, total: 100, completed: 100 })}\n`);
    await restarted.waitForIdle(); expect((await restarted.snapshot({ companyId: 'company1' })).snapshot.requests[1]?.status).toBe('failed');
  });

  it('rejects remote metadata before model assignment or generation', async () => {
    const f = await fixture(); f.data.installed = [{ name: model, digest, size: 100 }]; f.data.remote = true;
    await expect(f.service.select(selection())).rejects.toThrow(/remote or unverified/);
    await expect(f.service.request(request())).rejects.toMatchObject({ code: 'MODEL_UNAVAILABLE' });
    expect(f.data.calls).not.toContain('/api/generate'); expect(f.data.pulls).toHaveLength(0);
  });

  it('owns its registry exclusively and leaves a last-request cancellation retryable under a new id', async () => {
    const f = await fixture(); expect(() => new ModelPoolService(f.options)).toThrow(/Another model controller/);
    const first = await f.service.request(request()); await until(() => f.data.pulls.length === 1);
    await expect(f.service.cancel({ ...selection(), requestId: first.requestId! } as never)).rejects.toMatchObject({ code: 'INVALID_REQUEST' });
    await f.service.cancel({ companyId: 'company1', employeeId: 'employee1', requestId: first.requestId! });
    await f.service.request(request(1, 'retry')); await until(() => f.data.pulls.length === 2);
    f.finish(1); await f.service.waitForIdle();
    expect((await f.service.snapshot({ companyId: 'company1' })).snapshot.requests.map(row => row.status)).toEqual(['cancelled', 'ready']);
  });

  it('recovers a stale Linux container PID lock without treating an interrupted receipt as a new download', async () => {
    if (process.platform !== 'linux') return;
    const f = await fixture(); f.data.installed = [{ name: model, digest, size: 100 }]; await f.service.request(request()); await f.service.close();
    const registryPath = path.join(f.stateDir, 'model-pool/registry.json');
    const state = JSON.parse(fs.readFileSync(registryPath, 'utf8')); state.requests[0].status = 'pulling'; fs.writeFileSync(registryPath, JSON.stringify(state));
    fs.writeFileSync(path.join(f.stateDir, 'model-pool/owner.lock'), JSON.stringify({ pid: process.pid, identity: 'old-container-boot:old-process-start' }), { mode: 0o600 });
    const restarted = new ModelPoolService(f.options); cleanups.push(() => restarted.close());
    const result = await restarted.request(request()); expect(result.replayed).toBe(true); expect(result.snapshot.requests[0]?.status).toBe('interrupted'); expect(f.data.pulls).toHaveLength(0);
  });
});
