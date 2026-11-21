import { describe, expect, it } from 'vitest';
import { callTool, makeHarness, startMockCompanion, TEST_TOKEN, type Harness, type MockCompanion } from './helpers.js';

function writeRoutes() {
  return {
    'POST /v1/projects': (body: unknown) => ({ status: 200, json: { ok: true, project: { id: 'p-new', echo: body } } }),
    'POST /v1/runs/start': () => ({ status: 200, json: { ok: true, runId: 'r1' } }),
    'POST /v1/runs/pause': () => ({ status: 200, json: { ok: true } }),
    'POST /v1/runs/resume': () => ({ status: 200, json: { ok: true } }),
    'POST /v1/runs/cancel': () => ({ status: 200, json: { ok: true } }),
    'POST /v1/runs/recover': () => ({ status: 200, json: { ok: true } }),
    'POST /v1/approvals/decide': (body: unknown) => ({ status: 200, json: { ok: true, decided: body } }),
  };
}

async function withHarness(
  flags: { enableWrites?: boolean; enableProviderWrites?: boolean },
  fn: (harness: Harness, companion: MockCompanion) => Promise<void>,
) {
  const companion = await startMockCompanion(writeRoutes());
  const harness = await makeHarness({ baseUrl: companion.url, token: TEST_TOKEN, ...flags });
  try {
    await fn(harness, companion);
  } finally {
    await harness.close();
    await companion.close();
  }
}

describe('write gating', () => {
  it('writes are rejected without --enable-writes even when confirmed:true', async () => {
    await withHarness({}, async (harness, companion) => {
      const r = await callTool(harness.client, 'create_project', {
        name: 'X',
        goal: 'g',
        provider: 'mock',
        model: 'm',
        confirmed: true,
      });
      expect(r.isError).toBe(true);
      expect((r.structured['error'] as { code: string }).code).toBe('writes_disabled');
      expect(companion.requests.length).toBe(0); // never forwarded
    });
  });

  it('writes with the flag still require confirmed:true', async () => {
    await withHarness({ enableWrites: true }, async (harness, companion) => {
      const r = await callTool(harness.client, 'pause_run', { runId: 'r1' });
      expect(r.isError).toBe(true);
      expect((r.structured['error'] as { code: string }).code).toBe('confirmation_required');
      expect(companion.requests.length).toBe(0);
    });
  });

  it('flag + confirmed:true forwards the write', async () => {
    await withHarness({ enableWrites: true }, async (harness, companion) => {
      const r = await callTool(harness.client, 'create_project', {
        name: 'X',
        goal: 'g',
        provider: 'mock',
        model: 'm',
        confirmed: true,
      });
      expect(r.isError).toBe(false);
      expect(r.structured['ok']).toBe(true);
      const post = companion.requests.find((q) => q.path === '/v1/projects');
      expect((post?.body as Record<string, unknown>)['confirmed']).toBe(true);
      expect((post?.body as Record<string, unknown>)['name']).toBe('X');
    });
  });

  it.each(['pause_run', 'resume_run', 'cancel_run', 'recover_run'])('%s works with flag+confirmed', async (tool) => {
    await withHarness({ enableWrites: true }, async (harness) => {
      const r = await callTool(harness.client, tool, { runId: 'r1', confirmed: true });
      expect(r.isError).toBe(false);
      expect(r.structured['ok']).toBe(true);
    });
  });

  it('start_mock_run forwards budget and requires confirmation', async () => {
    await withHarness({ enableWrites: true }, async (harness, companion) => {
      const denied = await callTool(harness.client, 'start_mock_run', { projectId: 'p1' });
      expect((denied.structured['error'] as { code: string }).code).toBe('confirmation_required');
      const ok = await callTool(harness.client, 'start_mock_run', {
        projectId: 'p1',
        runBudget: { maxTokens: 1000 },
        confirmed: true,
      });
      expect(ok.structured['ok']).toBe(true);
      const post = companion.requests.find((q) => q.path === '/v1/runs/start');
      expect((post?.body as Record<string, unknown>)['runBudget']).toEqual({ maxTokens: 1000 });
    });
  });

  it('decide_approval requires a payloadHash (schema) and forwards it', async () => {
    await withHarness({ enableWrites: true }, async (harness, companion) => {
      const missing = await callTool(harness.client, 'decide_approval', {
        projectId: 'p1',
        approvalId: 'a1',
        decision: 'approved',
        confirmed: true,
      });
      expect(missing.isError).toBe(true); // schema: payloadHash required
      expect(companion.requests.length).toBe(0);

      const ok = await callTool(harness.client, 'decide_approval', {
        projectId: 'p1',
        approvalId: 'a1',
        decision: 'approved',
        payloadHash: 'sha256:deadbeef0123456789',
        confirmed: true,
      });
      expect(ok.isError).toBe(false);
      const post = companion.requests.find((q) => q.path === '/v1/approvals/decide');
      expect((post?.body as Record<string, unknown>)['payloadHash']).toBe('sha256:deadbeef0123456789');
    });
  });
});
