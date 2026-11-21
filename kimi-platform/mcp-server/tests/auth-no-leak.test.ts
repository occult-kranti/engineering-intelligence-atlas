import { afterAll, describe, expect, it } from 'vitest';
import { callTool, makeHarness, startMockCompanion, TEST_TOKEN } from './helpers.js';

describe('auth + token hygiene', () => {
  it('tools fail with auth_not_configured when the env token is missing', async () => {
    const companion = await startMockCompanion({ 'GET /health': () => ({ status: 200, json: { ok: true } }) });
    const harness = await makeHarness({ baseUrl: companion.url, token: undefined });
    const r = await callTool(harness.client, 'health');
    expect(r.isError).toBe(true);
    expect((r.structured['error'] as { code: string }).code).toBe('auth_not_configured');
    // No request should have hit the companion at all.
    expect(companion.requests.length).toBe(0);
    await harness.close();
    await companion.close();
  });

  it('wrong token maps to auth_failed without echoing any secret', async () => {
    const companion = await startMockCompanion({ 'GET /health': () => ({ status: 200, json: { ok: true } }) });
    const harness = await makeHarness({ baseUrl: companion.url, token: 'wrong-token-value-xyz' });
    const r = await callTool(harness.client, 'health');
    expect(r.isError).toBe(true);
    expect((r.structured['error'] as { code: string }).code).toBe('auth_failed');
    expect(r.text).not.toContain('wrong-token-value-xyz');
    expect(r.text).not.toContain(TEST_TOKEN);
    await harness.close();
    await companion.close();
  });

  it('token embedded in companion data is scrubbed from tool output', async () => {
    const companion = await startMockCompanion({
      'GET /v1/projects': () => ({
        status: 200,
        json: {
          ok: true,
          // Adversarial: desktop data contains the token + other secret shapes.
          projects: [{ id: 'p1', name: `leak ${TEST_TOKEN}`, token: TEST_TOKEN, apiKey: 'sk-ant-abc123456789', note: 'Bearer hunter2secret' }],
        },
      }),
    });
    const harness = await makeHarness({ baseUrl: companion.url, token: TEST_TOKEN });
    const r = await callTool(harness.client, 'list_projects');
    expect(r.text).not.toContain(TEST_TOKEN);
    expect(r.text).not.toContain('sk-ant-abc123456789');
    expect(r.text).not.toContain('hunter2secret');
    expect(r.text).not.toContain('"token"');
    expect(r.text).not.toContain('"apiKey"');
    await harness.close();
    await companion.close();
  });

  it('reasoning/chain-of-thought fields are stripped from tool output', async () => {
    const companion = await startMockCompanion({
      'GET /v1/projects': () => ({
        status: 200,
        json: { ok: true, projects: [{ id: 'p1', reasoning: 'secret internal monologue', chain_of_thought: '...' }] },
      }),
    });
    const harness = await makeHarness({ baseUrl: companion.url, token: TEST_TOKEN });
    const r = await callTool(harness.client, 'list_projects');
    expect(r.text).not.toContain('internal monologue');
    expect(r.text).not.toContain('chain_of_thought');
    await harness.close();
    await companion.close();
  });

  afterAll(() => {
    // nothing global
  });
});
