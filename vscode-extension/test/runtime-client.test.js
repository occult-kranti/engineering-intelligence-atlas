'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { RuntimeClient, MAX_RESPONSE } = require('../src/runtime-client');
const connection = { kind: 'runtime', url: 'http://127.0.0.1:8788', controlToken: 'runtime_test_owner_credential_1234567890' };
const firstHash = 'a'.repeat(64), secondHash = 'b'.repeat(64);
const reply = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } });

test('snapshot hash and stable command identity reach the native workbench envelope', async () => {
  const calls = [];
  const client = new RuntimeClient(connection, async (url, init) => {
    calls.push({ url, init });
    if (url.endsWith('/v1/office')) return reply({ ok: true, stateHash: firstHash, snapshot: { companies: [] } });
    const body = JSON.parse(init.body);
    return reply({ ok: true, id: body.id, result: { ok: true, stateHash: secondHash, snapshot: { companies: [{ id: 'new' }] } } });
  });
  const result = await client.command({ action: 'create_company', name: 'New' }, { id: 'stable-1' });
  assert.equal(result.stateHash, secondHash);
  assert.equal(client.stateHash, secondHash);
  assert.deepEqual(JSON.parse(calls[1].init.body), { id: 'stable-1', method: 'officeCommand',
    args: [{ expectedStateHash: firstHash, command: { action: 'create_company', name: 'New' } }] });
  assert.equal(calls[1].init.headers.Authorization, `Bearer ${connection.controlToken}`);
  assert.equal(calls[1].init.redirect, 'error');
  assert.equal(client.controllers.size, 0);
  client.close();
});

test('conflict is not silently rebased, and lost mutations are never retried', async () => {
  let calls = 0;
  const client = new RuntimeClient(connection, async () => { calls++; return reply({ ok: false, code: 'CONFLICT', error: connection.controlToken }, 409); });
  client.stateHash = firstHash;
  await assert.rejects(client.command({ action: 'pause_company' }, { id: 'conflict-1' }), error => error.code === 'CONFLICT' && !error.message.includes(connection.controlToken));
  assert.equal(calls, 1);
  client.fetcher = async () => { calls++; throw new Error('lost ' + connection.controlToken); };
  await assert.rejects(client.call('createProject', [{ name: 'A' }], { id: 'stable-lost' }), error => error.code === 'OUTCOME_UNKNOWN' && error.operationId === 'stable-lost' && !error.message.includes(connection.controlToken));
  assert.equal(calls, 2);
  assert.equal(client.controllers.size, 0);
  client.close();
});

test('disconnect aborts all in-flight requests and clears credentials and timers', async () => {
  let started = 0;
  const client = new RuntimeClient(connection, async (_url, { signal }) => new Promise((_resolve, reject) => {
    started++;
    signal.addEventListener('abort', () => reject(new Error('cancelled')), { once: true });
  }));
  const pending = Array.from({ length: 32 }, () => client.snapshot().catch(error => error));
  await assert.rejects(client.snapshot(), /limit is busy/);
  assert.equal(started, 32);
  client.close();
  await Promise.all(pending);
  assert.equal(client.controllers.size, 0);
  assert.equal(client.connection.controlToken, '');
  await assert.rejects(client.snapshot(), /closed/);
});

test('redirects, oversized bodies and malformed receipts cannot be mistaken for completion', async () => {
  let client = new RuntimeClient(connection, async () => ({ redirected: true, body: { async cancel() {} } }));
  await assert.rejects(client.snapshot()); client.close();
  client = new RuntimeClient(connection, async () => new Response('x'.repeat(MAX_RESPONSE + 1), { headers: { 'content-type': 'application/json' } }));
  await assert.rejects(client.snapshot()); assert.equal(client.controllers.size, 0); client.close();
  client = new RuntimeClient(connection, async () => reply({ ok: true, id: 'wrong', result: {} }));
  await assert.rejects(client.call('hostStatus', [], { id: 'right' }), /different operation receipt/); client.close();
  assert.throws(() => new RuntimeClient({ ...connection, url: 'https://name:secret@example.org' }));
  assert.throws(() => new RuntimeClient({ ...connection, controlToken: 'short' }));
});

test('200 request/close cycles leave no pending controllers and reject pre-cancelled work', async () => {
  for (let i = 0; i < 200; i++) {
    const client = new RuntimeClient(connection, async () => reply({ ok: true, stateHash: firstHash, snapshot: { companies: [] } }));
    await client.snapshot();
    assert.equal(client.controllers.size, 0);
    const abort = new AbortController(); abort.abort();
    await assert.rejects(client.snapshot({ signal: abort.signal }), /cancelled/);
    assert.equal(client.controllers.size, 0);
    client.close();
  }
});

async function settles(promise) {
  let timer;
  try { return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Request did not settle within its test bound.')), 1000); })]); }
  finally { clearTimeout(timer); }
}
test('deadlines and owner close settle stalled fetches even when the transport ignores AbortSignal', async () => {
  let calls = 0;
  const client = new RuntimeClient(connection, () => { calls++; return new Promise(() => {}); });
  await settles(assert.rejects(client.request('/v1/status', 'GET', undefined, { timeoutMs: 10 })));
  assert.equal(client.controllers.size, 0); assert.equal(calls, 1);
  const pending = Array.from({ length: 32 }, () => client.request('/v1/status').catch(error => error));
  await assert.rejects(client.request('/v1/status'), /limit is busy/);
  client.close(); const results = await settles(Promise.all(pending));
  assert.ok(results.every(value => value instanceof Error)); assert.equal(client.controllers.size, 0); assert.equal(client.connection.controlToken, '');
  const late = new RuntimeClient(connection, () => new Promise(() => {}));
  await settles(assert.rejects(late.request('/v1/workbench/call', 'POST', { id: 'same-stalled-id' }, { id: 'same-stalled-id', timeoutMs: 10 }),
    error => error.code === 'OUTCOME_UNKNOWN' && error.operationId === 'same-stalled-id' && /No retry/.test(error.message)));
  late.close(); assert.equal(late.controllers.size, 0);
});
test('stalled reader and never-resolving cancellation cannot hold the request open', async () => {
  let reading, cancelled = 0, released = 0; const started = new Promise(resolve => { reading = resolve; });
  const client = new RuntimeClient(connection, async () => ({ ok: true, status: 200,
    headers: { get: () => 'application/json' }, body: { getReader: () => ({
      read: () => { reading(); return new Promise(() => {}); }, cancel: () => { cancelled++; return new Promise(() => {}); }, releaseLock: () => { released++; },
    }) } }));
  const pending = client.request('/v1/status'); await started; client.close();
  await settles(assert.rejects(pending)); assert.equal(cancelled, 1); assert.equal(released, 1); assert.equal(client.controllers.size, 0);
  const deadline = new RuntimeClient(connection, client.fetcher);
  await settles(assert.rejects(deadline.request('/v1/status', 'GET', undefined, { timeoutMs: 10 })));
  assert.equal(cancelled, 2); assert.equal(released, 2); assert.equal(deadline.controllers.size, 0); deadline.close();
});
test('a response arriving after close is cancelled without parsing or exposing its body', async () => {
  let respond, began, cancelled = 0, read = 0; const started = new Promise(resolve => { began = resolve; });
  const client = new RuntimeClient(connection, () => { began(); return new Promise(resolve => { respond = resolve; }); });
  const pending = client.request('/v1/status'); await started; client.close(); await settles(assert.rejects(pending));
  respond({ body: { cancel: () => { cancelled++; return new Promise(() => {}); }, getReader: () => { read++; throw new Error('Late response must not be read.'); } } });
  await new Promise(resolve => setImmediate(resolve)); assert.equal(cancelled, 1); assert.equal(read, 0); assert.equal(client.controllers.size, 0);
});
test('control credentials are removed from public text and collisions never rewrite canonical identities', async () => {
  const client = new RuntimeClient(connection, async () => reply({ ok: true, id: 'stable-public-id', result: { ok: true, message: `prefix ${connection.controlToken} suffix`, nested: [connection.controlToken], companyId: 'company-original' } }));
  const result = await client.call('hostStatus', [], { id: 'stable-public-id' });
  assert.equal(result.companyId, 'company-original'); assert.ok(!JSON.stringify(result).includes(connection.controlToken)); assert.match(result.message, /control credential omitted/);
  client.fetcher = async () => reply({ ok: true, id: 'stable-public-id', result: { id: connection.controlToken } });
  await assert.rejects(client.call('hostStatus', [], { id: 'stable-public-id' }), error => error.code === 'RESPONSE_CREDENTIAL_COLLISION' && !error.message.includes(connection.controlToken));
  await assert.rejects(client.call('hostStatus', [], { id: connection.controlToken }), /Invalid workbench operation identity/);
  client.fetcher = async () => { throw Object.assign(new Error(`Transport echoed ${connection.controlToken}`), { code: 'TRANSPORT_ERROR' }); };
  await assert.rejects(client.request('/v1/status'), error => !error.message.includes(connection.controlToken));
  client.close();
  const allCaps = 'A'.repeat(40); const codeEcho = new RuntimeClient({ ...connection, controlToken: allCaps }, async () => reply({ ok: false, code: allCaps }, 409));
  await assert.rejects(codeEcho.request('/v1/status'), error => error.code === 'HTTP_409' && !error.message.includes(allCaps)); codeEcho.close();
});
