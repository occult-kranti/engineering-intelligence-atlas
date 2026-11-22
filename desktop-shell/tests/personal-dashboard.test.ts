import { afterEach, describe, expect, it, vi } from 'vitest';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PersonalDashboardServer } from '../src/main/personalDashboard';

interface Reply { status: number; body: string; headers: http.IncomingHttpHeaders }
const servers: PersonalDashboardServer[] = [];
const roots: string[] = [];
function send(origin: string, pathname: string, options: { method?: string; headers?: Record<string, string>; body?: string } = {}): Promise<Reply> {
  const address = new URL(origin);
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: address.hostname, port: address.port, path: pathname, method: options.method ?? 'GET', agent: false,
      headers: { host: address.host, ...(options.body !== undefined ? { 'content-length': String(Buffer.byteLength(options.body)) } : {}), ...options.headers },
    }, res => {
      const chunks: Buffer[] = [];
      res.on('data', chunk => chunks.push(Buffer.from(chunk)));
      res.on('end', () => resolve({ status: res.statusCode ?? 0, headers: res.headers, body: Buffer.concat(chunks).toString('utf8') }));
    });
    req.on('error', reject);
    req.end(options.body);
  });
}
async function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-dashboard-test-'));
  roots.push(root);
  const rendererRoot = path.join(root, 'renderer');
  fs.mkdirSync(rendererRoot);
  for (const file of ['chrome.html', 'chrome.css', 'chrome.js', 'browser-bridge.js']) fs.writeFileSync(path.join(rendererRoot, file), `fixture ${file}`);
  fs.writeFileSync(path.join(root, 'outside-secret.txt'), 'Private fixture outside renderer');
  const dispatch = vi.fn(async (method: string, args: unknown[]) => ({ method, args, value: 'owner-only data' }));
  const server = new PersonalDashboardServer({ rendererRoot, dispatch });
  servers.push(server);
  const launch = new URL(await server.launchUrl());
  const token = new URLSearchParams(launch.hash.slice(1)).get('session')!;
  const origin = launch.origin;
  const post = (pathname: string, data: unknown, headers: Record<string, string> = {}) => send(origin, pathname, { method: 'POST', headers: { origin, 'content-type': 'application/json', ...headers }, body: JSON.stringify(data) });
  const authenticate = async () => {
    const exchanged = await post('/api/session', { token });
    expect(exchanged.status).toBe(200);
    const cookie = exchanged.headers['set-cookie']?.[0]?.split(';')[0];
    expect(cookie).toBeTruthy();
    return { exchanged, cookie: cookie! };
  };
  return { server, launch, token, origin, post, authenticate, dispatch };
}
afterEach(async () => {
  for (const server of servers.splice(0)) await server.close();
  vi.restoreAllMocks();
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

describe('personal browser dashboard authentication', () => {
  it('uses a loopback origin and keeps the launch credential in the fragment', async () => {
    const f = await fixture();
    expect(f.launch.hostname).toBe('127.0.0.1');
    expect(f.launch.protocol).toBe('http:');
    expect(f.launch.search).toBe('');
    expect(f.token).toMatch(/^[a-f0-9]{64}$/);
    const page = await send(f.origin, '/');
    expect(page.status).toBe(200);
    expect(page.body).not.toContain(f.token);
    expect(page.headers['cache-control']).toBe('no-store');
    expect(page.headers['referrer-policy']).toBe('no-referrer');
    expect(page.headers['content-security-policy']).toContain("frame-ancestors 'none'");
    expect(f.dispatch).not.toHaveBeenCalled();
  });

  it('requires an authenticated session before dispatching application methods', async () => {
    const f = await fixture();
    const result = await f.post('/api/call', { method: 'office.snapshot', args: [] });
    expect(result.status).toBe(401);
    expect(f.dispatch).not.toHaveBeenCalled();
  });

  it('exchanges a launch token once for a restricted cookie', async () => {
    const f = await fixture();
    const { exchanged, cookie } = await f.authenticate();
    const header = exchanged.headers['set-cookie']![0]!;
    expect(header).toContain('HttpOnly');
    expect(header).toContain('SameSite=Strict');
    expect(header).toContain('Max-Age=43200');
    expect(exchanged.body).not.toContain(f.token);
    expect((await f.post('/api/session', { token: f.token })).status).toBe(401);
    const called = await f.post('/api/call', { method: 'office.snapshot', args: ['fixture'] }, { cookie });
    expect(called.status).toBe(200);
    expect(JSON.parse(called.body)).toEqual({ result: { method: 'office.snapshot', args: ['fixture'], value: 'owner-only data' } });
    expect(f.dispatch).toHaveBeenCalledExactlyOnceWith('office.snapshot', ['fixture']);
  });

  it('rejects forged cookies even if they use a valid launch token', async () => {
    const f = await fixture();
    for (const cookie of ['atlas_session=forged', `atlas_session=${f.token}`]) {
      expect((await f.post('/api/call', { method: 'office.snapshot', args: [] }, { cookie })).status).toBe(401);
    }
    expect(f.dispatch).not.toHaveBeenCalled();
  });

  it('expires unused launch links after five minutes', async () => {
    const clock = vi.spyOn(Date, 'now').mockReturnValue(1_000_000);
    const f = await fixture();
    clock.mockReturnValue(1_000_000 + 5 * 60_000 + 1);
    expect((await f.post('/api/session', { token: f.token })).status).toBe(401);
    expect(f.dispatch).not.toHaveBeenCalled();
  });

  it('expires authenticated sessions even if the client retains the cookie', async () => {
    const clock = vi.spyOn(Date, 'now').mockReturnValue(1_000_000);
    const f = await fixture();
    const { cookie } = await f.authenticate();
    clock.mockReturnValue(1_000_000 + 12 * 60 * 60_000 + 1);
    expect((await f.post('/api/call', { method: 'office.snapshot', args: [] }, { cookie })).status).toBe(401);
    expect(f.dispatch).not.toHaveBeenCalled();
  });

  it('bounds outstanding launch tokens and reuses the same listening server', async () => {
    const f = await fixture();
    for (let i = 0; i < 8; i++) expect(new URL(await f.server.launchUrl()).origin).toBe(f.origin);
    expect((await f.post('/api/session', { token: f.token })).status).toBe(401);
  });

  it('coalesces simultaneous launch requests into one loopback listener', async () => {
    const created: http.Server[] = [];
    const original = http.createServer;
    vi.spyOn(http, 'createServer').mockImplementation((...args: Parameters<typeof http.createServer>) => {
      const server = Reflect.apply(original, http, args) as http.Server;
      created.push(server);
      return server;
    });
    const server = new PersonalDashboardServer({ rendererRoot: '/unused-in-this-test', dispatch: () => null });
    servers.push(server);
    try {
      const links = await Promise.all([server.launchUrl(), server.launchUrl(), server.launchUrl()]);
      expect(new Set(links.map(link => new URL(link).origin)).size).toBe(1);
      expect(created).toHaveLength(1);
    } finally {
      // Close every captured listener, including one that a broken implementation
      // may have lost, so this regression cannot leave a local server behind.
      for (const listener of created) {
        listener.closeAllConnections();
        await new Promise<void>(resolve => listener.close(() => resolve()));
      }
    }
  });
});

describe('personal dashboard request boundaries', () => {
  it('rejects untrusted Host and Origin before reading a token or invoking a method', async () => {
    const f = await fixture();
    expect((await send(f.origin, '/', { headers: { host: 'attacker.example' } })).status).toBe(403);
    expect((await f.post('/api/session', { token: f.token }, { origin: 'https://attacker.example' })).status).toBe(403);
    expect((await send(f.origin, '/api/session', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token: f.token }) })).status).toBe(403);
    const { cookie } = await f.authenticate(); // rejected exchanges did not consume it
    expect((await f.post('/api/call', { method: 'office.snapshot', args: [] }, { cookie, origin: 'null' })).status).toBe(403);
    expect(f.dispatch).not.toHaveBeenCalled();
  });

  it('requires JSON and rejects malformed or oversized bodies', async () => {
    const f = await fixture();
    expect((await f.post('/api/session', { token: f.token }, { 'content-type': 'text/plain' })).status).toBe(403);
    const headers = { origin: f.origin, 'content-type': 'application/json' };
    expect((await send(f.origin, '/api/session', { method: 'POST', headers, body: '{' })).status).toBe(400);
    expect((await send(f.origin, '/api/session', { method: 'POST', headers, body: JSON.stringify({ token: 'x'.repeat(750_001) }) })).status).toBe(400);
    expect(f.dispatch).not.toHaveBeenCalled();
  });

  it('validates method shape, argument count and endpoint before dispatch', async () => {
    const f = await fixture();
    const { cookie } = await f.authenticate();
    for (const data of [null, { method: 3, args: [] }, { method: 'office.snapshot', args: 'not-array' }, { method: 'office.snapshot', args: new Array(9).fill(null) }]) {
      expect((await f.post('/api/call', data, { cookie })).status).toBe(400);
    }
    expect((await f.post('/api/other', { method: 'office.snapshot', args: [] }, { cookie })).status).toBe(400);
    expect(f.dispatch).not.toHaveBeenCalled();
  });

  it('serves only explicit renderer files and never follows URL traversal', async () => {
    const f = await fixture();
    for (const pathname of ['/outside-secret.txt', '/../outside-secret.txt', '/%2e%2e/outside-secret.txt', '/%2e%2e%2foutside-secret.txt', '/.env', '/src/main/index.ts']) {
      const reply = await send(f.origin, pathname);
      expect(reply.status).toBeGreaterThanOrEqual(400);
      expect(reply.body).not.toContain('Private fixture outside renderer');
    }
    expect((await send(f.origin, '/browser-bridge.js')).headers['content-type']).toMatch(/javascript/);
  });

  it('serves nested Freeflow JS/CSS and old assets with correct MIME; missing allowed files are 404', async () => {
    const f = await fixture();
    const root = roots[roots.length - 1]!;
    const renderer = path.join(root, 'renderer');
    fs.mkdirSync(path.join(renderer, 'freeflow'));
    fs.writeFileSync(path.join(renderer, 'freeflow', 'studio.js'), 'export const studio = 1;');
    fs.writeFileSync(path.join(renderer, 'freeflow.css'), '.ff{color:red}');
    fs.writeFileSync(path.join(renderer, 'studio-tokens.css'), ':root{--t:1}');
    fs.writeFileSync(path.join(renderer, 'office-signals.js'), 'void 0;');
    const js = await send(f.origin, '/freeflow/studio.js');
    expect(js.status).toBe(200);
    expect(js.headers['content-type']).toMatch(/text\/javascript/);
    expect(js.body).toContain('studio');
    const css = await send(f.origin, '/freeflow.css');
    expect(css.status).toBe(200);
    expect(css.headers['content-type']).toMatch(/text\/css/);
    expect((await send(f.origin, '/studio-tokens.css')).status).toBe(200);
    expect((await send(f.origin, '/office-signals.js')).headers['content-type']).toMatch(/javascript/);
    expect((await send(f.origin, '/chrome.js')).status).toBe(200);
    // These are transitive imports of the shared office renderer. A missing
    // allowlist entry previously left the real page unable to load its canvas.
    for (const module of ['canvas-workspace', 'donna-team', 'universe', 'workspace']) {
      fs.writeFileSync(path.join(renderer, 'freeflow', `${module}.js`), 'export const loaded = true;');
      const response = await send(f.origin, `/freeflow/${module}.js`);
      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toMatch(/javascript/);
    }
    for (const missing of ['/freeflow/manage.js', '/freeflow/intake.js', '/freeflow/camera.js']) {
      const reply = await send(f.origin, missing);
      expect(reply.status).toBe(404);
    }
  });

  it('rejects arbitrary nested paths, traversal and symlink breakout', async () => {
    const f = await fixture();
    const root = roots[roots.length - 1]!;
    const renderer = path.join(root, 'renderer');
    fs.mkdirSync(path.join(renderer, 'freeflow'));
    fs.writeFileSync(path.join(renderer, 'freeflow', 'secret.js'), 'unlisted');
    for (const pathname of ['/freeflow/secret.js', '/freeflow/../chrome.js', '/freeflow/%2e%2e/outside-secret.txt', '/freeflow/', '/freeflow', '/__proto__', '/constructor', '/freeflow/studio.js.map']) {
      const reply = await send(f.origin, pathname);
      expect(reply.status).toBeGreaterThanOrEqual(400);
      expect(reply.body).not.toContain('unlisted');
      expect(reply.body).not.toContain('Private fixture outside renderer');
    }
    // A whitelisted name that is a symlink to a file outside the renderer root must not be served.
    fs.symlinkSync(path.join(root, 'outside-secret.txt'), path.join(renderer, 'freeflow', 'model.js'));
    const escaped = await send(f.origin, '/freeflow/model.js');
    expect(escaped.status).toBe(404);
    expect(escaped.body).not.toContain('Private fixture outside renderer');
  });

  it('does not return backend errors or credentials to browser callers', async () => {
    const f = await fixture();
    const { cookie } = await f.authenticate();
    f.dispatch.mockRejectedValueOnce(new Error('fixture-secret-never-return-this'));
    const reply = await f.post('/api/call', { method: 'office.snapshot', args: [] }, { cookie });
    expect(reply.status).toBe(400);
    expect(reply.body).not.toContain('fixture-secret');
  });
});
