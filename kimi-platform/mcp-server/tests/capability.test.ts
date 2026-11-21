import { describe, expect, it } from 'vitest';
import { callTool, makeHarness, startMockCompanion, TEST_TOKEN, type Harness, type MockCompanion } from './helpers.js';

/**
 * The mock companion here implements ONLY v4 routes; all enterprise/Donna/
 * repository candidate routes hit the catch-all 404 sentinel, exactly like
 * today's desktop build.
 */
async function setup(enableWrites = false): Promise<{ companion: MockCompanion; harness: Harness }> {
  const companion = await startMockCompanion({});
  const harness = await makeHarness({ baseUrl: companion.url, token: TEST_TOKEN, enableWrites });
  return { companion, harness };
}

describe('capability_unavailable for unshipped desktop routes', () => {
  it.each(['enterprise.get_snapshot', 'enterprise.list_ledger', 'donna.list_proposals', 'donna.list_schedules', 'repository.preview_assignment'])(
    '%s returns capability_unavailable, never fabricated data',
    async (tool) => {
      const { companion, harness } = await setup();
      const r = await callTool(harness.client, tool, tool === 'enterprise.list_ledger' ? { limit: 10 } : {});
      expect(r.isError).toBe(true);
      const err = r.structured['error'] as { code: string; capability: string; message: string };
      expect(err.code).toBe('capability_unavailable');
      expect(err.capability).toBe(tool);
      expect(err.message).toContain('No data was fabricated');
      expect(r.structured['snapshot']).toBeUndefined();
      expect(r.structured['ledger']).toBeUndefined();
      expect(r.structured['proposals']).toBeUndefined();
      await harness.close();
      await companion.close();
    },
  );

  it('donna.propose_action is write-gated before hitting the desktop', async () => {
    const { companion, harness } = await setup(false);
    const r = await callTool(harness.client, 'donna.propose_action', {
      kind: 'note',
      title: 't',
      rationale: 'r',
      confirmed: true,
    });
    expect((r.structured['error'] as { code: string }).code).toBe('writes_disabled');
    expect(companion.requests.length).toBe(0);
    await harness.close();
    await companion.close();
  });

  it('propose_repository_company falls back to a validated proposal (applied:false) when the route is unshipped', async () => {
    const { companion, harness } = await setup(true);
    const r = await callTool(harness.client, 'propose_repository_company', {
      name: 'Example Labs',
      domain: 'example.com',
      kind: 'lab',
      focusAreas: ['agents'],
      notableWork: [],
      confirmed: true,
    });
    expect(r.isError).toBe(false);
    expect(r.structured['status']).toBe('proposal_validated');
    expect(r.structured['applied']).toBe(false);
    expect(typeof r.structured['payloadHash']).toBe('string');
    expect((r.structured['proposal'] as Record<string, unknown>)['name']).toBe('Example Labs');
    // The request WAS attempted against the desktop and 404'd (no fake apply).
    expect(companion.requests.some((q) => q.path === '/v1/repository/companies')).toBe(true);
    await harness.close();
    await companion.close();
  });

  it('propose_repository_company requires confirmation even when the route is unshipped', async () => {
    const { companion, harness } = await setup(true);
    const r = await callTool(harness.client, 'propose_repository_company', { name: 'X' });
    expect((r.structured['error'] as { code: string }).code).toBe('confirmation_required');
    expect(companion.requests.length).toBe(0);
    await harness.close();
    await companion.close();
  });

  it('unreachable companion yields a clean companion_unreachable error', async () => {
    const harness = await makeHarness({ baseUrl: 'http://127.0.0.1:1', token: TEST_TOKEN });
    const r = await callTool(harness.client, 'health');
    expect(r.isError).toBe(true);
    expect((r.structured['error'] as { code: string }).code).toBe('companion_unreachable');
    expect(r.text).not.toContain(TEST_TOKEN);
    await harness.close();
  });
});
