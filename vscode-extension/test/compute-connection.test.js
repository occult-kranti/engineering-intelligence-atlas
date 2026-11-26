'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { validateProfile, fetchVastInstances, buildSshArgs, ComputeConnection } = require('../src/compute-connection');

const base = { id: 'vps-1', label: 'My VPS', host: '203.0.113.7', port: 22 };

function fakeChild() {
  const c = new EventEmitter();
  c.stderr = new EventEmitter();
  c.kills = [];
  c.kill = (s) => { c.kills.push(s); return true; };
  return c;
}
function mkSpawn() {
  const calls = [];
  const fn = (cmd, args, opts) => { const child = fakeChild(); calls.push({ cmd, args, opts, child }); return child; };
  fn.calls = calls;
  return fn;
}
const okProbe = async () => true;
const hang = (url, signal) => new Promise((_, rej) => signal.addEventListener('abort', () => rej(new Error('aborted')), { once: true }));
const tick = () => new Promise((r) => setImmediate(r));

test('validateProfile normalizes and defaults', () => {
  const p = validateProfile({ ...base });
  assert.deepEqual(p, { id: 'vps-1', label: 'My VPS', host: '203.0.113.7', port: 22, user: 'root', localPort: 18788, remotePort: 8788 });
});

test('validateProfile rejects injection, bad ports and unknown fields', () => {
  const bad = [
    { ...base, host: '-oProxyCommand=x' }, { ...base, host: 'a b' }, { ...base, host: 'a;b' },
    { ...base, host: 'fe80::1%eth0' }, { ...base, host: 'h\nx' }, { ...base, host: 'x'.repeat(161) },
    { ...base, user: 'ro ot' }, { ...base, user: '-x' }, { ...base, port: 0 }, { ...base, port: 70000 },
    { ...base, port: '22' }, { ...base, localPort: 80 }, { ...base, id: '../x' }, { ...base, label: 'a\nb' },
    { ...base, extra: 1 }, { ...base, keyFile: 'relative/key' }, { ...base, keyFile: '/k\u0000' },
    { ...base, keyFile: '/k\nx' }, null, [],
  ];
  for (const b of bad) assert.throws(() => validateProfile(b), undefined, JSON.stringify(b));
});

test('keyFile passes literally as one argv element', () => {
  const key = '/home/u/my "key" $(x);.pem';
  const args = buildSshArgs({ ...base, keyFile: key, user: 'bob' });
  assert.equal(args[args.indexOf('-i') + 1], key);
  assert.equal(args[args.length - 1], 'bob@203.0.113.7');
  assert.ok(args.includes('StrictHostKeyChecking=yes'));
  assert.ok(args.includes('127.0.0.1:18788:127.0.0.1:8788'));
  assert.equal(args.filter((a) => a === key).length, 1);
});

test('connect succeeds, spawns ssh without shell', async () => {
  const spawnImpl = mkSpawn();
  const cc = new ComputeConnection({ spawnImpl, probe: okProbe });
  const r = await cc.connect(base);
  assert.equal(r.state, 'connected');
  assert.equal(r.verifiedRuntime, true);
  assert.equal(r.runtimeUrl, 'http://127.0.0.1:18788');
  assert.equal(spawnImpl.calls[0].cmd, 'ssh');
  assert.equal(spawnImpl.calls[0].opts.shell, false);
  assert.deepEqual(spawnImpl.calls[0].opts.stdio, ['ignore', 'ignore', 'pipe']);
  assert.equal(cc.status().state, 'connected');
  await cc.close();
});

test('duplicate same-profile connect coalesces', async () => {
  const spawnImpl = mkSpawn();
  let n = 0;
  const cc = new ComputeConnection({ spawnImpl, probe: async () => (++n >= 2) });
  const a = cc.connect(base);
  const b = cc.connect({ ...base });
  assert.equal(a, b);
  await a;
  assert.equal(spawnImpl.calls.length, 1);
  await cc.close();
});

test('different profile rejected while connecting and connected', async () => {
  const cc = new ComputeConnection({ spawnImpl: mkSpawn(), probe: hang });
  const first = cc.connect(base);
  await assert.rejects(cc.connect({ ...base, id: 'other' }), /active/);
  await cc.close();
  await assert.rejects(first);
  const cc2 = new ComputeConnection({ spawnImpl: mkSpawn(), probe: okProbe });
  await cc2.connect(base);
  await assert.rejects(cc2.connect({ ...base, id: 'other' }), /active/);
  await cc2.close();
});

test('close cancels in-flight probe', async () => {
  const spawnImpl = mkSpawn();
  let aborted = false;
  const probe = (u, s) => new Promise((_, rej) => s.addEventListener('abort', () => { aborted = true; rej(new Error('x')); }, { once: true }));
  const cc = new ComputeConnection({ spawnImpl, probe });
  const p = cc.connect(base);
  await tick();
  await cc.close();
  await assert.rejects(p);
  assert.equal(aborted, true);
  assert.equal(cc.status().state, 'disconnected');
  assert.deepEqual(spawnImpl.calls[0].child.kills, ['SIGTERM']);
});

test('early exit and spawn error fail the connection', async () => {
  const s1 = mkSpawn();
  const cc = new ComputeConnection({ spawnImpl: s1, probe: hang });
  const p = cc.connect(base);
  await tick();
  s1.calls[0].child.emit('exit', 255);
  await assert.rejects(p);
  assert.equal(cc.status().state, 'failed');
  assert.equal(cc.status().lastError, 'SSH process exited');
  const s2 = mkSpawn();
  const cc2 = new ComputeConnection({ spawnImpl: s2, probe: hang });
  const p2 = cc2.connect(base);
  await tick();
  s2.calls[0].child.emit('error', new Error('ENOENT secret/path'));
  await assert.rejects(p2);
  assert.equal(cc2.status().lastError, 'SSH process error');
});

test('exit after connect marks failed and kills only its child', async () => {
  const spawnImpl = mkSpawn();
  const cc = new ComputeConnection({ spawnImpl, probe: okProbe });
  await cc.connect(base);
  spawnImpl.calls[0].child.emit('exit', 1);
  assert.equal(cc.status().state, 'failed');
  assert.equal(cc.status().runtimeUrl, undefined);
});

test('stderr over cap kills child and fails; stderr not exposed', async () => {
  const spawnImpl = mkSpawn();
  const cc = new ComputeConnection({ spawnImpl, probe: hang });
  const p = cc.connect(base);
  await tick();
  spawnImpl.calls[0].child.stderr.emit('data', Buffer.alloc(65 * 1024, 'x'));
  await assert.rejects(p);
  assert.equal(cc.status().state, 'failed');
  assert.doesNotMatch(JSON.stringify(cc.status()), /xxxx/);
  assert.ok(spawnImpl.calls[0].child.kills.includes('SIGTERM'));
});

test('probe deadline fails with generic error', async () => {
  const spawnImpl = mkSpawn();
  const cc = new ComputeConnection({ spawnImpl, probe: async () => false, timeoutMs: 400 });
  await assert.rejects(cc.connect(base));
  assert.equal(cc.status().state, 'failed');
  assert.equal(spawnImpl.calls.length, 1); // no ssh respawn
  assert.equal(spawnImpl.calls[0].child.kills[0], 'SIGTERM');
});

test('probe throwing is retried read-only until success', async () => {
  let n = 0;
  const cc = new ComputeConnection({ spawnImpl: mkSpawn(), probe: async () => { if (++n < 3) throw new Error('refused'); return true; } });
  const r = await cc.connect(base);
  assert.equal(r.state, 'connected');
  assert.equal(n, 3);
  await cc.close();
});

test('stale callbacks after close are ignored; reconnect works', async () => {
  const spawnImpl = mkSpawn();
  const cc = new ComputeConnection({ spawnImpl, probe: okProbe });
  await cc.connect(base);
  const old = spawnImpl.calls[0].child;
  await cc.close();
  const r = await cc.connect(base);
  assert.equal(r.state, 'connected');
  old.emit('exit', 1);
  old.stderr.emit('data', Buffer.alloc(70 * 1024));
  assert.equal(cc.status().state, 'connected');
  assert.equal(old.listenerCount('exit') <= 1, true); // only teardown's once-listener at most
  await cc.close();
});

test('100 connect/close cycles keep listeners bounded', async () => {
  const spawnImpl = mkSpawn();
  const cc = new ComputeConnection({ spawnImpl, probe: okProbe });
  for (let i = 0; i < 100; i++) {
    await cc.connect(base);
    await cc.close();
  }
  assert.equal(spawnImpl.calls.length, 100);
  for (const c of spawnImpl.calls) {
    assert.equal(c.child.stderr.listenerCount('data'), 0);
    assert.equal(c.child.listenerCount('error') <= 1, true);
    assert.equal(c.child.listenerCount('exit') <= 1, true);
  }
});

// ---- Vast ----
function vastRes(body, { ok = true, bytes } = {}) {
  let cancelled = false;
  const data = bytes || Buffer.from(typeof body === 'string' ? body : JSON.stringify(body));
  let sent = false;
  const res = {
    ok,
    get cancelled() { return cancelled; },
    body: { getReader: () => ({
      read: async () => (sent ? { done: true } : ((sent = true), { done: false, value: new Uint8Array(data) })),
      cancel: async () => { cancelled = true; },
      releaseLock: () => {},
    }), cancel: async () => { cancelled = true; } },
  };
  return res;
}

test('fetchVastInstances sanitizes and bounds metadata', async () => {
  const inst = Array.from({ length: 120 }, (_, i) => ({
    id: i, actual_status: 'exited', intended_status: 'stopped', gpu_name: 'RTX', gpu_ram: 24000, cpu_ram: 64000,
    disk_space: 100, ssh_host: 'h', ssh_port: 22, jupyter_token: 'SECRET', extra_env: { A: 'SECRET' },
  }));
  let seen;
  const fetcher = async (url, init) => { seen = { url, init }; return vastRes({ success: true, instances: inst }); };
  const r = await fetchVastInstances('KEY123', { fetcher });
  assert.equal(seen.url, 'https://console.vast.ai/api/v1/instances/');
  assert.equal(seen.init.method, 'GET');
  assert.equal(seen.init.redirect, 'error');
  assert.equal(seen.init.headers.Authorization, 'Bearer KEY123');
  assert.equal(r.instances.length, 100);
  assert.equal(r.gpuVerified, false);
  assert.equal(r.totalInstances, 120);
  assert.equal(r.hasMore, true);
  assert.doesNotMatch(JSON.stringify(r), /SECRET|jupyter|env/);
  assert.deepEqual(Object.keys(r.instances[0]).sort(),
    ['actual_status', 'cpu_ram', 'disk_space', 'gpu_name', 'gpu_ram', 'id', 'intended_status', 'ssh_host', 'ssh_port']);
});

test('fetchVastInstances rejects wrong schema, http error, redirect, oversize without leaking', async () => {
  const cases = [
    async () => vastRes({ success: false, instances: [] }),
    async () => vastRes({ success: true, instances: {} }),
    async () => vastRes('not json'),
    async () => vastRes({ error: 'KEY123 leaked https://x?token=1' }, { ok: false }),
    async () => { throw new TypeError('redirect KEY123 https://evil/?k=1'); },
    async () => vastRes(null, { bytes: Buffer.alloc(2 * 1024 * 1024 + 10, 'a') }),
  ];
  for (const fetcher of cases) {
    await assert.rejects(fetchVastInstances('KEY123', { fetcher }), (e) => {
      assert.equal(e.message, 'Vast instance listing failed');
      assert.doesNotMatch(e.message, /KEY123|evil|token/);
      return true;
    });
  }
});

test('fetchVastInstances releases reader on oversize and honors parent abort', async () => {
  const res = vastRes(null, { bytes: Buffer.alloc(2 * 1024 * 1024 + 10, 'a') });
  await assert.rejects(fetchVastInstances('K', { fetcher: async () => res }));
  assert.equal(res.cancelled, true);
  const ac = new AbortController();
  const fetcher = (u, init) => new Promise((_, reject) => init.signal.addEventListener('abort', () => reject(new Error('aborted KEY123')), { once: true }));
  const pending = fetchVastInstances('KEY123', { fetcher, signal: ac.signal });
  await tick(); ac.abort(); await assert.rejects(pending, { message: 'Vast instance listing failed' });
});

test('terminal newlines and malformed IPv6 cannot cross profile validation', () => {
  for (const key of ['id', 'label', 'host', 'user']) assert.throws(() => validateProfile({ ...base, [key]: `${key === 'host' ? 'example.com' : 'root'}\n` }));
  for (const host of ['2001:db8::1', '::1', '::ffff:192.0.2.1']) assert.equal(validateProfile({ ...base, host }).host, host);
  for (const host of ['2001:db8::1::2', '1:2:3:4:5:6:7:', ':1:2:3:4:5:6:7', '01.2.3.4', '[::1]', 'fe80::1%eth0']) assert.throws(() => validateProfile({ ...base, host }));
});

test('same ID with changed connection parameters never coalesces; stopped profile is preserved', async () => {
  const spawnImpl = mkSpawn(); const cc = new ComputeConnection({ spawnImpl, probe: okProbe, killGraceMs: 10 });
  await cc.connect(base);
  for (const changed of [{ host: 'example.com' }, { port: 2222 }, { keyFile: '/different-key' }, { remotePort: 9999 }]) await assert.rejects(cc.connect({ ...base, ...changed }), /active/);
  await cc.close(); assert.equal(cc.status().profile.id, base.id); assert.equal(cc.status().profile.host, base.host); assert.equal(cc.status().runtimeUrl, undefined);
  spawnImpl.calls[0].child.emit('exit', 0); spawnImpl.calls[0].child.emit('close', 0);
});

test('uncooperative probe cannot hang either deadline or close and public health is insufficient', async () => {
  const never = () => new Promise(() => {});
  const first = new ComputeConnection({ spawnImpl: mkSpawn(), probe: never, timeoutMs: 30, killGraceMs: 5 });
  const started = Date.now(); await assert.rejects(first.connect(base)); assert.ok(Date.now() - started < 500);
  const second = new ComputeConnection({ spawnImpl: mkSpawn(), probe: never, killGraceMs: 5 }); const pending = second.connect(base); await tick();
  const closing = Date.now(); await second.close(); assert.ok(Date.now() - closing < 500); await assert.rejects(pending);
  const third = new ComputeConnection({ spawnImpl: mkSpawn(), probe: async () => ({ ok: true }), timeoutMs: 20, killGraceMs: 5 }); await assert.rejects(third.connect(base));
});

test('each retiring child escalates independently and exited children are never signalled again', async () => {
  const spawnImpl = mkSpawn(); const cc = new ComputeConnection({ spawnImpl, probe: okProbe, killGraceMs: 15 });
  await cc.connect(base); await cc.close(); const old = spawnImpl.calls[0].child;
  await cc.connect(base); await cc.close(); const newer = spawnImpl.calls[1].child;
  old.emit('exit', 0); old.emit('close', 0);
  await new Promise(resolve => setTimeout(resolve, 40));
  assert.deepEqual(old.kills, ['SIGTERM']); assert.deepEqual(newer.kills, ['SIGTERM', 'SIGKILL']);
  newer.emit('exit', 0); newer.emit('close', 0);
  for (const child of [old, newer]) for (const event of ['error', 'exit', 'close']) assert.equal(child.listenerCount(event), 0);
});

test('100 completed lifecycles release all owned listeners and keep only selected profile metadata', async () => {
  const spawnImpl = mkSpawn(); const cc = new ComputeConnection({ spawnImpl, probe: okProbe, killGraceMs: 5 });
  for (let index = 0; index < 100; index++) {
    const connected = await cc.connect(base); assert.equal(connected.gpuVerified, false);
    await cc.close(); const child = spawnImpl.calls[index].child; child.emit('exit', 0); child.emit('close', 0);
    assert.equal(child.stderr.listenerCount('data'), 0);
    for (const event of ['exit', 'close', 'error']) assert.equal(child.listenerCount(event), 0);
  }
  assert.equal(cc.status().profile.id, base.id);
});

test('Vast pagination totals and continuation are reported without exposing opaque tokens', async () => {
  const page = { success: true, instances: [{ id: 1 }], total_instances: 42, next_token: 'opaque-secret-cursor' };
  const result = await fetchVastInstances('K', { fetcher: async () => vastRes(page) });
  assert.equal(result.totalInstances, 42); assert.equal(result.hasMore, true); assert.doesNotMatch(JSON.stringify(result), /opaque-secret-cursor/);
  const unknown = await fetchVastInstances('K', { fetcher: async () => vastRes({ success: true, instances: [], next_token: 'more' }) });
  assert.equal(unknown.totalInstances, null); assert.equal(unknown.hasMore, true);
});

test('Vast fetch and body readers that ignore abort still respect caller/deadline', async () => {
  const never = () => new Promise(() => {});
  await assert.rejects(fetchVastInstances('K', { fetcher: never, timeoutMs: 20 }), { message: 'Vast instance listing failed' });
  let released = false;
  const response = { ok: true, body: { getReader: () => ({ read: never, cancel: never, releaseLock: () => { released = true; } }) } };
  await assert.rejects(fetchVastInstances('K', { fetcher: async () => response, timeoutMs: 20 }), { message: 'Vast instance listing failed' }); assert.equal(released, true);
  const abort = new AbortController(); const pending = fetchVastInstances('K', { fetcher: never, signal: abort.signal }); abort.abort();
  await assert.rejects(pending, { message: 'Vast instance listing failed' });
});

test('aborting before a deferred probe or fetch prevents the extra operation', async () => {
  let probes = 0; const cc = new ComputeConnection({ spawnImpl: mkSpawn(), probe: async () => { probes++; return true; }, killGraceMs: 5 });
  const connection = cc.connect(base); await cc.close(); await assert.rejects(connection); assert.equal(probes, 0);
  let fetches = 0; const ac = new AbortController();
  const pending = fetchVastInstances('K', { fetcher: async () => { fetches++; return vastRes({ success: true, instances: [] }); }, signal: ac.signal });
  ac.abort(); await assert.rejects(pending); assert.equal(fetches, 0);
});

test('inconsistent or malformed pagination metadata is not presented as a verified total', async () => {
  for (const extra of [{ total_instances: 0 }, { total_instances: '100' }, { next_token: {} }, { has_more: 'yes' }]) {
    await assert.rejects(fetchVastInstances('K', { fetcher: async () => vastRes({ success: true, instances: [{ id: 1 }], ...extra }) }), { message: 'Vast instance listing failed' });
  }
});
