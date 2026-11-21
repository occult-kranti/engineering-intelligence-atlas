import { describe, expect, it, vi } from 'vitest';
import { BridgeClient, type FetchLike } from '../src/bridge/client.js';
import { BridgeError } from '../src/bridge/errors.js';

const SECRET = 'test-token-0123456789abcdef';

function jsonResponse(status: number, body: unknown, statusText = ''): Promise<{
  status: number;
  statusText: string;
  text(): Promise<string>;
}> {
  return Promise.resolve({
    status,
    statusText,
    text: () => Promise.resolve(typeof body === 'string' ? body : JSON.stringify(body)),
  });
}

function makeClient(fetchImpl: FetchLike, token: string | undefined = SECRET) {
  return new BridgeClient({
    address: { host: '127.0.0.1', port: 4777 },
    getToken: async () => token,
    fetchImpl,
    timeoutMs: 50,
  });
}

describe('BridgeClient auth + URL handling', () => {
  it('sends Bearer auth on every request to the loopback base URL', async () => {
    const seen: Array<{ url: string; init: { headers: Record<string, string> } }> = [];
    const fetchImpl: FetchLike = (url, init) => {
      seen.push({ url, init });
      return jsonResponse(200, { ok: true, projects: [] });
    };
    const client = makeClient(fetchImpl);
    await client.health();
    await client.listProjects();
    expect(seen).toHaveLength(2);
    for (const call of seen) {
      expect(call.url.startsWith('http://127.0.0.1:4777/')).toBe(true);
      expect(call.init.headers.Authorization).toBe(`Bearer ${SECRET}`);
      expect(call.init.headers.Accept).toBe('application/json');
    }
  });

  it('unwraps {ok:true,<key>} envelopes and throws on {ok:false}', async () => {
    const fetchImpl: FetchLike = () => jsonResponse(200, { ok: true, projects: [{ id: 'p1' }] });
    const client = makeClient(fetchImpl);
    expect(await client.listProjects()).toEqual([{ id: 'p1' }]);

    const failing: FetchLike = () => jsonResponse(200, { ok: false, error: 'nope' });
    const failingClient = makeClient(failing);
    await expect(failingClient.listProjects()).rejects.toMatchObject({ code: 'server' });
  });

  it('POSTs always send Content-Type: application/json (server requirement)', async () => {
    const seen: Array<{ headers: Record<string, string>; body?: string }> = [];
    const fetchImpl: FetchLike = (_url, init) => {
      seen.push({ headers: init.headers, body: init.body });
      return jsonResponse(200, { ok: true });
    };
    const client = makeClient(fetchImpl);
    await client.chatStop('s1');
    await client.pauseRun('r1');
    expect(seen[0]?.headers['Content-Type']).toBe('application/json');
    expect(seen[0]?.body).toBe('{}'); // body-less POST sends an empty JSON object
    expect(seen[1]?.body).toBe(JSON.stringify({ runId: 'r1' }));
  });

  it('pulls the token from the getter per request (never cached on the client)', async () => {
    let token: string | undefined = 'rotating-token-1';
    const auths: string[] = [];
    const fetchImpl: FetchLike = (_url, init) => {
      auths.push(init.headers.Authorization ?? '');
      return jsonResponse(200, { ok: true });
    };
    const withGetter = new BridgeClient({
      address: { host: 'localhost', port: 4777 },
      getToken: async () => token,
      fetchImpl,
    });
    await withGetter.health();
    token = 'rotating-token-2';
    await withGetter.health();
    expect(auths[0]).toBe('Bearer rotating-token-1');
    expect(auths[1]).toBe('Bearer rotating-token-2');
  });

  it('throws "unpaired" without a token and never calls fetch', async () => {
    const fetchImpl = vi.fn<FetchLike>();
    const client = new BridgeClient({
      address: { host: '127.0.0.1', port: 4777 },
      getToken: async () => undefined,
      fetchImpl,
      timeoutMs: 50,
    });
    await expect(client.health()).rejects.toMatchObject({ code: 'unpaired' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe('BridgeClient error sanitization', () => {
  it('maps 401/403 to a re-pair message without echoing the token', async () => {
    const fetchImpl: FetchLike = () => jsonResponse(401, { error: `bad token ${SECRET}` }, 'Unauthorized');
    const client = makeClient(fetchImpl);
    try {
      await client.health();
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(BridgeError);
      const e = err as BridgeError;
      expect(e.code === 'unauthorized' || e.code === 'server').toBe(true);
      expect(e.message).not.toContain(SECRET);
    }
  });

  it('redacts the token even from server-provided error strings', async () => {
    const fetchImpl: FetchLike = () => jsonResponse(500, { error: `token ${SECRET} exploded` });
    const client = makeClient(fetchImpl);
    await expect(client.health()).rejects.toSatisfy(
      (e: unknown) => e instanceof Error && !e.message.includes(SECRET),
    );
  });

  it('collapses connection failures to a friendly message', async () => {
    const fetchImpl: FetchLike = () => Promise.reject(new Error(`fetch failed (${SECRET})`));
    const client = makeClient(fetchImpl);
    await expect(client.health()).rejects.toSatisfy(
      (e: unknown) =>
        e instanceof BridgeError && e.code === 'unreachable' && !e.message.includes(SECRET),
    );
  });

  it('times out via AbortController', async () => {
    const fetchImpl: FetchLike = (_url, init) =>
      new Promise((_resolve, reject) => {
        init.signal.addEventListener('abort', () => {
          const err = new Error('aborted');
          err.name = 'AbortError';
          reject(err);
        });
      });
    const client = makeClient(fetchImpl);
    await expect(client.health()).rejects.toMatchObject({ code: 'timeout' });
  });

  it('rejects non-JSON bodies', async () => {
    const fetchImpl: FetchLike = () => jsonResponse(200, '<html>nope</html>');
    const client = makeClient(fetchImpl);
    await expect(client.health()).rejects.toBeInstanceOf(BridgeError);
  });
});
