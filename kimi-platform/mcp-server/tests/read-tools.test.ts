import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { callTool, makeHarness, startMockCompanion, type Harness, type MockCompanion } from './helpers.js';

const PROJECT = { id: 'p1', name: 'Alpha', goal: 'Research alpha' };
const RUN = { id: 'r1', projectId: 'p1', status: 'running' };

let companion: MockCompanion;
let harness: Harness;

beforeAll(async () => {
  companion = await startMockCompanion({
    'GET /health': () => ({ status: 200, json: { ok: true, bridgeVersion: 4, service: 'research-director-companion' } }),
    'GET /v1/projects': () => ({ status: 200, json: { ok: true, projects: [PROJECT] } }),
    'GET /v1/office': (_b, q) => ({ status: 200, json: { ok: true, snapshot: { projectId: q.get('projectId'), agents: [] } } }),
    'GET /v1/runs': () => ({ status: 200, json: { ok: true, runs: [RUN] } }),
    'GET /v1/artifacts/read': (_b, q) => ({
      status: 200,
      json: { ok: true, text: `artifact text for ${q.get('nodeId')}`, meta: { nodeId: q.get('nodeId'), attempt: 1 } },
    }),
    'GET /v1/events/read': (_b, q) => {
      const after = Number(q.get('afterIndex') ?? '0');
      const events = Array.from({ length: 500 }, (_, i) => ({ index: after + i, type: 'tick' }));
      return { status: 200, json: { ok: true, events, nextIndex: after + events.length } };
    },
    'GET /v1/chat/sessions': () => ({ status: 200, json: { ok: true, sessions: [{ id: 's1', title: 'chat' }] } }),
    'GET /v1/chat/sessions/s1': () => ({
      status: 200,
      json: {
        ok: true,
        session: {
          id: 's1',
          messages: Array.from({ length: 80 }, (_, i) => ({ id: `m${i}`, role: 'user', content: `message ${i}` })),
        },
      },
    }),
    'GET /v1/chat/sessions/nope': () => ({ status: 404, json: { ok: false, error: 'unknown chat session id' } }),
    'GET /v1/approvals': () => ({ status: 200, json: { ok: true, approvals: [{ id: 'a1', status: 'pending' }] } }),
  });
  harness = await makeHarness({ baseUrl: companion.url, token: 'test-pairing-token-0123456789abcdef' });
});

afterAll(async () => {
  await harness.close();
  await companion.close();
});

describe('read-only tools', () => {
  it('health returns bridge version', async () => {
    const r = await callTool(harness.client, 'health');
    expect(r.isError).toBe(false);
    expect(r.structured['bridgeVersion']).toBe(4);
  });

  it('list_projects returns projects', async () => {
    const r = await callTool(harness.client, 'list_projects');
    expect(r.structured['ok']).toBe(true);
    expect((r.structured['projects'] as unknown[])[0]).toMatchObject({ id: 'p1' });
  });

  it('get_office passes projectId through', async () => {
    const r = await callTool(harness.client, 'get_office', { projectId: 'p1' });
    expect((r.structured['snapshot'] as Record<string, unknown>)['projectId']).toBe('p1');
  });

  it('list_runs returns runs', async () => {
    const r = await callTool(harness.client, 'list_runs', { projectId: 'p1' });
    expect((r.structured['runs'] as unknown[]).length).toBe(1);
  });

  it('read_artifact returns bounded text + meta', async () => {
    const r = await callTool(harness.client, 'read_artifact', { projectId: 'p1', runId: 'r1', nodeId: 'n1' });
    expect(r.structured['text']).toContain('artifact text for n1');
    expect(r.structured['meta']).toMatchObject({ nodeId: 'n1' });
    expect(r.structured['textTruncated']).toBe(false);
  });

  it('read_events returns a keyset-capped page with cursor', async () => {
    const r = await callTool(harness.client, 'read_events', { projectId: 'p1', runId: 'r1', limit: 50 });
    const events = r.structured['events'] as unknown[];
    expect(events.length).toBe(50); // desktop sent 500; tool capped the page
    expect(r.structured['capped']).toBe(true);
    expect(typeof r.structured['nextIndex']).toBe('number');
  });

  it('list_chat_sessions returns sessions', async () => {
    const r = await callTool(harness.client, 'list_chat_sessions');
    expect((r.structured['sessions'] as unknown[])[0]).toMatchObject({ id: 's1' });
  });

  it('get_chat bounds messages to the most recent maxMessages', async () => {
    const r = await callTool(harness.client, 'get_chat', { sessionId: 's1', maxMessages: 10 });
    const session = r.structured['session'] as { messages: Array<{ text: string }> };
    expect(session.messages.length).toBe(10);
    expect(session.messages[9]!.text).toBe('message 79');
    expect(r.structured['messageCount']).toBe(80);
  });

  it('list_approvals returns approvals', async () => {
    const r = await callTool(harness.client, 'list_approvals', {});
    expect((r.structured['approvals'] as unknown[])[0]).toMatchObject({ id: 'a1' });
  });

  it('maps resource 404 (non-sentinel) to not_found', async () => {
    const r = await callTool(harness.client, 'get_chat', { sessionId: 'nope' });
    expect(r.isError).toBe(true);
    expect((r.structured['error'] as { code: string }).code).toBe('not_found');
  });

  it('every request carries the bearer token', () => {
    expect(companion.requests.length).toBeGreaterThan(0);
    for (const req of companion.requests) {
      expect(req.authorization).toBe('Bearer test-pairing-token-0123456789abcdef');
    }
  });
});
