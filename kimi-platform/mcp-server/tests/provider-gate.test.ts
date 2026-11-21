import { describe, expect, it } from 'vitest';
import { callTool, makeHarness, startMockCompanion, TEST_TOKEN } from './helpers.js';

const routes = {
  'POST /v1/chat/sessions/s1/send': () => ({ status: 200, json: { ok: true, userMessageId: 'u1', assistantMessageId: 'a1' } }),
};

async function setup(flags: { enableWrites?: boolean; enableProviderWrites?: boolean }) {
  const companion = await startMockCompanion(routes);
  const harness = await makeHarness({ baseUrl: companion.url, token: TEST_TOKEN, ...flags });
  return { companion, harness };
}

describe('provider-paid chat send double gate', () => {
  it('rejected without any flags', async () => {
    const { companion, harness } = await setup({});
    const r = await callTool(harness.client, 'send_chat_message', { sessionId: 's1', text: 'hi', confirmed: true });
    expect((r.structured['error'] as { code: string }).code).toBe('writes_disabled');
    expect(companion.requests.length).toBe(0);
    await harness.close();
    await companion.close();
  });

  it('rejected with only --enable-writes (provider gate still closed)', async () => {
    const { companion, harness } = await setup({ enableWrites: true });
    const r = await callTool(harness.client, 'send_chat_message', { sessionId: 's1', text: 'hi', confirmed: true });
    expect((r.structured['error'] as { code: string }).code).toBe('provider_writes_disabled');
    expect(companion.requests.length).toBe(0);
    await harness.close();
    await companion.close();
  });

  it('rejected with both flags but no confirmed:true', async () => {
    const { companion, harness } = await setup({ enableWrites: true, enableProviderWrites: true });
    const r = await callTool(harness.client, 'send_chat_message', { sessionId: 's1', text: 'hi' });
    expect((r.structured['error'] as { code: string }).code).toBe('confirmation_required');
    expect(companion.requests.length).toBe(0);
    await harness.close();
    await companion.close();
  });

  it('succeeds only with both flags + confirmed:true', async () => {
    const { companion, harness } = await setup({ enableWrites: true, enableProviderWrites: true });
    const r = await callTool(harness.client, 'send_chat_message', { sessionId: 's1', text: 'ship it', confirmed: true });
    expect(r.isError).toBe(false);
    expect(r.structured['ok']).toBe(true);
    const post = companion.requests[0];
    expect(post?.path).toBe('/v1/chat/sessions/s1/send');
    expect((post?.body as Record<string, unknown>)['confirmed']).toBe(true);
    await harness.close();
    await companion.close();
  });
});
