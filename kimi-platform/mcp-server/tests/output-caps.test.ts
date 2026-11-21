import { describe, expect, it } from 'vitest';
import { callTool, makeHarness, startMockCompanion, TEST_TOKEN } from './helpers.js';

describe('output caps', () => {
  it('oversized companion responses are discarded, not streamed to the client', async () => {
    const big = 'x'.repeat(300 * 1024);
    const companion = await startMockCompanion({
      'GET /v1/projects': () => ({ status: 200, json: { ok: true, projects: [{ id: 'p1', blob: big }] } }),
    });
    // Tight client-side cap: 64 KiB max response.
    const harness = await makeHarness({ baseUrl: companion.url, token: TEST_TOKEN, maxResponseBytes: 64 * 1024 });
    const r = await callTool(harness.client, 'list_projects');
    expect(r.isError).toBe(true);
    expect((r.structured['error'] as { code: string }).code).toBe('companion_error');
    expect(r.text).toContain('safety cap');
    expect(r.text.length).toBeLessThan(8_000);
    await harness.close();
    await companion.close();
  });

  it('tool result JSON is hard-capped to toolOutputMaxChars', async () => {
    const companion = await startMockCompanion({
      'GET /v1/projects': () => ({
        status: 200,
        json: { ok: true, projects: Array.from({ length: 200 }, (_, i) => ({ id: `p${i}`, name: 'n'.repeat(500) })) },
      }),
    });
    const harness = await makeHarness({ baseUrl: companion.url, token: TEST_TOKEN, toolOutputMaxChars: 4_000 });
    const r = await callTool(harness.client, 'list_projects');
    expect(r.text.length).toBeLessThanOrEqual(4_100); // cap + truncation marker
    expect(r.text).toContain('truncated');
    await harness.close();
    await companion.close();
  });

  it('read_artifact truncates text to maxChars', async () => {
    const companion = await startMockCompanion({
      'GET /v1/artifacts/read': () => ({ status: 200, json: { ok: true, text: 'a'.repeat(10_000), meta: {} } }),
    });
    const harness = await makeHarness({ baseUrl: companion.url, token: TEST_TOKEN });
    const r = await callTool(harness.client, 'read_artifact', { projectId: 'p', runId: 'r', nodeId: 'n', maxChars: 1_000 });
    expect((r.structured['text'] as string).length).toBeLessThan(1_100);
    expect(r.structured['textTruncated']).toBe(true);
    expect(r.structured['textChars']).toBe(10_000);
    await harness.close();
    await companion.close();
  });

  it('read_artifact rejects maxChars above the hard cap (schema validation)', async () => {
    const companion = await startMockCompanion({});
    const harness = await makeHarness({ baseUrl: companion.url, token: TEST_TOKEN });
    const r = await callTool(harness.client, 'read_artifact', { projectId: 'p', runId: 'r', nodeId: 'n', maxChars: 999_999 });
    expect(r.isError).toBe(true);
    await harness.close();
    await companion.close();
  });
});
