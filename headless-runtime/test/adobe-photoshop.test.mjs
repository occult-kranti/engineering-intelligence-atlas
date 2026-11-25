import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createPhotoshopExecutor, presignS3 } from '../../integrations/adobe/photoshop-api.mjs';

const PNG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 1, 2, 3]);
const TOKEN = 'https://ims-na1.adobelogin.com/ims/token/v3';
const API = 'https://photoshop-api.adobe.io';
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

function fixture(t, { operation = 'adobe.manifest', input = {}, storage = {}, authorize, hook, wait, output } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'daftar-adobe-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const outputDir = path.join(root, 'output'); fs.mkdirSync(outputDir, { mode: 0o700 });
  const inputPath = path.join(root, 'source.psd'); fs.writeFileSync(inputPath, '8BPS-test-document');
  const clientIdFile = path.join(root, 'client-id'), clientSecretFile = path.join(root, 'client-secret'), assetStorageFile = path.join(root, 'assets.json');
  fs.writeFileSync(clientIdFile, 'test-client-id', { mode: 0o600 });
  fs.writeFileSync(clientSecretFile, 'private-test-client-secret', { mode: 0o600 });
  fs.writeFileSync(assetStorageFile, JSON.stringify({ endpoint: 'https://s3.example.test', region: 'us-east-1', bucket: 'daftar-assets',
    accessKeyId: 'EXAMPLE_ACCESS_KEY', secretAccessKey: 'private-test-storage-secret', ...storage }), { mode: 0o600 });
  const config = { enabled: true, allowPaidRequests: true, clientIdFile, clientSecretFile, assetStorageFile };
  const calls = [];
  const fetchImpl = async (url, init) => {
    const call = { url: String(url), ...init }; calls.push(call);
    const override = await hook?.(call, calls); if (override !== undefined) return override;
    if (url === TOKEN) return json({ access_token: 'test-access-token-123' });
    if (String(url).startsWith(API) && init.method === 'POST') return json({ jobId: 'job-123' }, 202);
    if (String(url).startsWith(API)) return json({ jobId: 'job-123', status: 'succeeded', outputs: [{ url: 'https://do-not-follow.example.test/private' }] });
    if (init.method === 'DELETE') return new Response(null, { status: 204 });
    if (init.method === 'PUT') return new Response('');
    return new Response(output ?? (operation === 'adobe.manifest' ? JSON.stringify({ document: { width: 512 }, layers: [{ name: 'Artwork', url: 'https://private.example.test/?X-Amz-Signature=private', custom: 'https://private.example.test/' }] }) : PNG));
  };
  const execute = createPhotoshopExecutor({ fetchImpl, wait: wait ?? (async () => {}), now: () => new Date('2026-11-24T22:00:00Z'), uuid: () => '12345678-1234-1234-1234-123456789abc' });
  const args = { config, operation, inputPath, outputDir, input: { path: 'source.psd', ...input }, authorize: authorize ?? (async () => true) };
  return { root, outputDir, inputPath, config, calls, args, run: extra => execute({ ...args, ...extra }),
    receipt: () => JSON.parse(fs.readFileSync(path.join(outputDir, 'adobe-receipt.json'), 'utf8')) };
}

test('S3 query signer matches the published AWS SigV4 example byte for byte', () => {
  const url = new URL(presignS3({ endpoint: 'https://s3.amazonaws.com', virtualHosted: true, bucket: 'examplebucket', region: 'us-east-1',
    accessKeyId: 'AKIAIOSFODNN7EXAMPLE', secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY' }, 'GET', 'test.txt', { now: new Date('2013-05-24T00:00:00Z'), expires: 86400 }));
  assert.equal(url.hostname, 'examplebucket.s3.amazonaws.com');
  assert.equal(url.searchParams.get('X-Amz-Signature'), 'aeeed9bbccd4d02ee5c0109b86d86835f995330da4c265957d157751f604d404');
});

test('S3 signer encodes paths and temporary credentials without URL normalization', () => {
  const url = new URL(presignS3({ endpoint: 'https://s3.example.test', bucket: 'assets', region: 'us-east-1', accessKeyId: 'EXAMPLE', secretAccessKey: 'example', sessionToken: 'a+/= b' }, 'PUT', "folder/art !'().png"));
  assert.equal(url.pathname, '/assets/folder/art%20%21%27%28%29.png');
  assert.equal(url.searchParams.get('X-Amz-Security-Token'), 'a+/= b');
  for (const key of ['../x', 'x/../y', '/x', 'x//y']) assert.throws(() => presignS3({ endpoint: 'https://s3.example.test' }, 'GET', key), { code: 'ADOBE_STORAGE_CONFIG' });
});

test('manifest uploads through private storage, uses v2, sanitizes metadata and cleans both keys', async t => {
  let checks = 0; const f = fixture(t, { authorize: async () => { checks++; return true; } });
  const { result } = await f.run();
  assert.equal(result.remoteAuthVerified, true); assert.equal(result.cleanup, 'complete'); assert.ok(checks >= 7);
  const submit = f.calls.find(c => c.url === `${API}/v2/generate-manifest`);
  const body = JSON.parse(submit.body);
  assert.equal(body.outputs[0].mediaType, 'application/json'); assert.equal(body.includeXmp, false);
  assert.equal(new URL(body.image.source.url).origin, 'https://s3.example.test');
  assert.equal(f.calls.filter(c => c.method === 'DELETE').length, 2);
  assert.ok(f.calls.every(c => c.redirect === 'error' && c.signal instanceof AbortSignal));
  for (const call of f.calls.filter(c => c.url.startsWith('https://s3.example.test'))) assert.equal(call.headers, undefined);
  assert.ok(!f.calls.some(c => c.url.includes('do-not-follow')));
  const manifest = JSON.parse(fs.readFileSync(path.join(f.outputDir, 'manifest.json'), 'utf8'));
  assert.deepEqual(manifest, { document: { width: 512 }, layers: [{ name: 'Artwork', custom: '[external reference omitted]' }] });
  assert.equal(f.receipt().state, 'succeeded');
  assert.ok(!JSON.stringify({ result, receipt: f.receipt(), manifest }).includes('private-test'));
  assert.ok(!JSON.stringify(f.receipt()).includes('https://'));
});

test('render constructs bounded create-composite edits and writes only the fixed output name', async t => {
  const f = fixture(t, { operation: 'adobe.render', input: { width: 128, height: 64 } });
  const { result } = await f.run();
  const body = JSON.parse(f.calls.find(c => c.url === `${API}/v2/create-composite`).body);
  assert.deepEqual(body.edits.document.imageSize, { width: { unit: 'pixels_unit', value: 128 }, height: { unit: 'pixels_unit', value: 64 }, constrainProportions: false, resample: 'bicubic' });
  assert.equal(body.outputs[0].mediaType, 'image/png'); assert.equal(result.width, 128);
  assert.deepEqual(fs.readFileSync(path.join(f.outputDir, 'render.png')), PNG);
});

test('JPEG output uses the reviewed operation and fixed .jpg artifact', async t => {
  const f = fixture(t, { operation: 'adobe.render', input: { format: 'jpeg' }, output: Buffer.from([255, 216, 1, 2]) });
  const { result } = await f.run(); assert.equal(result.format, 'jpeg');
  assert.ok(fs.existsSync(path.join(f.outputDir, 'render.jpg')));
});

for (const [label, mutate, code] of [
  ['paid requests disabled', f => { f.config.allowPaidRequests = false; }, 'ADOBE_NOT_CONFIGURED'],
  ['arbitrary operation', f => { f.args.operation = 'adobe.arbitrary-actions'; }, 'ADOBE_INPUT'],
  ['caller URL', f => { f.args.input.url = 'https://attacker.example.test'; }, 'ADOBE_INPUT'],
  ['oversized dimensions', f => { f.args.operation = 'adobe.render'; f.args.input.width = 4096; }, 'ADOBE_INPUT'],
  ['wrong document signature', f => { fs.writeFileSync(f.inputPath, 'not-a-document'); }, 'ADOBE_INPUT'],
  ['world-readable credential', f => { fs.chmodSync(f.config.clientSecretFile, 0o644); }, 'ADOBE_FILE_UNAVAILABLE'],
  ['symlink credential', f => { const target = f.config.clientSecretFile + '-target'; fs.renameSync(f.config.clientSecretFile, target); fs.symlinkSync(target, f.config.clientSecretFile); }, 'ADOBE_FILE_UNAVAILABLE'],
  ['unsafe storage endpoint', f => { const p = f.config.assetStorageFile; const s = JSON.parse(fs.readFileSync(p)); s.endpoint = 'http://127.0.0.1'; fs.writeFileSync(p, JSON.stringify(s)); }, 'ADOBE_STORAGE_CONFIG'],
  ['unknown storage credential field', f => { const p = f.config.assetStorageFile; const s = JSON.parse(fs.readFileSync(p)); s.shell = 'bad'; fs.writeFileSync(p, JSON.stringify(s)); }, 'ADOBE_STORAGE_CONFIG'],
]) test(`${label} is rejected before any external request`, async t => {
  const f = fixture(t); mutate(f); await assert.rejects(f.run(), { code }); assert.equal(f.calls.length, 0);
});

test('missing execution authority is rejected before OAuth and preserves a safe failed receipt', async t => {
  const f = fixture(t, { authorize: async () => false });
  await assert.rejects(f.run(), { code: 'ADOBE_AUTHORITY' }); assert.equal(f.calls.length, 0);
  assert.equal(f.receipt().state, 'failed');
});

test('ambiguous asset upload is cleaned even if PUT acknowledgement was lost', async t => {
  const f = fixture(t, { hook: call => { if (call.method === 'PUT') throw Error('PRIVATE_SECRET_AND_URL'); } });
  await assert.rejects(f.run(), error => error.code === 'ADOBE_TRANSPORT' && !error.message.includes('PRIVATE_SECRET'));
  assert.equal(f.calls.filter(c => c.method === 'DELETE').length, 2); assert.equal(f.receipt().state, 'failed');
  assert.equal(f.receipt().uploadState, 'outcome_unconfirmed'); assert.equal(f.receipt().cleanup, 'pending');
  assert.equal(f.calls.filter(c => c.url.startsWith(API)).length, 0);
});

test('ambiguous paid submission is never retried and remains outcome_unconfirmed', async t => {
  const f = fixture(t, { hook: call => { if (call.url.startsWith(API) && call.method === 'POST') throw Error('SECRET'); } });
  await assert.rejects(f.run(), { code: 'ADOBE_TRANSPORT' });
  assert.equal(f.calls.filter(c => c.url.startsWith(API) && c.method === 'POST').length, 1);
  assert.equal(f.receipt().state, 'outcome_unconfirmed'); assert.equal(f.receipt().cleanup, 'pending');
});

test('remote rejection cannot expose response body or signed URLs', async t => {
  const f = fixture(t, { hook: call => call.url === TOKEN ? new Response('secret credentials and signed URLs', { status: 401 }) : undefined });
  await assert.rejects(f.run(), error => error.code === 'ADOBE_REMOTE_REJECTED' && !error.message.includes('signed URLs'));
  assert.equal(f.calls.length, 1); assert.equal(f.receipt().state, 'failed');
});

test('status polling does not resubmit the job and ignores service-returned URLs', async t => {
  let polls = 0, waits = 0;
  const f = fixture(t, { hook: call => call.url.includes('/v2/status/') && ++polls === 1 ? json({ status: 'running' }) : undefined,
    wait: async () => { waits++; } });
  await f.run(); assert.equal(polls, 2); assert.equal(waits, 1);
  assert.equal(f.calls.filter(c => c.url.startsWith(API) && c.method === 'POST').length, 1);
});

test('mismatched status identity retains uncertainty and does not download a result', async t => {
  const f = fixture(t, { hook: call => call.url.includes('/v2/status/') ? json({ jobId: 'another-job', status: 'succeeded' }) : undefined });
  await assert.rejects(f.run(), { code: 'ADOBE_RESPONSE_INVALID' });
  assert.equal(f.receipt().state, 'outcome_unconfirmed'); assert.equal(f.receipt().adobeJobId, 'job-123');
  assert.ok(!fs.existsSync(path.join(f.outputDir, 'manifest.json')));
});

test('remote failure is terminal while local abort never claims remote cancellation', async t => {
  const failed = fixture(t, { hook: call => call.url.includes('/v2/status/') ? json({ status: 'failed' }) : undefined });
  await assert.rejects(failed.run(), { code: 'ADOBE_JOB_FAILED' }); assert.equal(failed.receipt().state, 'failed'); assert.equal(failed.receipt().cleanup, 'complete');
  const abort = new AbortController();
  const cancelled = fixture(t, { hook: call => { if (call.url.includes('/v2/status/')) { abort.abort(); return json({ status: 'running' }); } } });
  await assert.rejects(cancelled.run({ signal: abort.signal }));
  assert.equal(cancelled.receipt().state, 'outcome_unconfirmed'); assert.equal(cancelled.receipt().cleanup, 'pending');
});

test('authority revoked during remote work prevents local success publication', async t => {
  let allowed = true;
  const f = fixture(t, { authorize: async () => allowed, hook: call => { if (call.url.includes('/v2/status/')) { allowed = false; return json({ status: 'succeeded' }); } } });
  await assert.rejects(f.run(), { code: 'ADOBE_AUTHORITY' });
  assert.equal(f.receipt().state, 'failed'); assert.ok(!fs.existsSync(path.join(f.outputDir, 'manifest.json')));
});

test('bounded polling stops after 600 polls without repeating paid submission', async t => {
  const f = fixture(t, { hook: call => call.url.includes('/v2/status/') ? json({ status: 'running' }) : undefined });
  await assert.rejects(f.run(), { code: 'ADOBE_OUTCOME_UNCONFIRMED' });
  assert.equal(f.calls.filter(c => c.url.includes('/v2/status/')).length, 600);
  assert.equal(f.receipt().state, 'outcome_unconfirmed');
});

test('oversized response Content-Length and streaming body are rejected', async t => {
  for (const response of [new Response('{}', { headers: { 'content-length': String(5 * 1024 * 1024) } }), new Response('x'.repeat(4 * 1024 * 1024 + 1))]) {
    const f = fixture(t, { hook: call => call.url === TOKEN ? response : undefined });
    await assert.rejects(f.run(), { code: 'ADOBE_RESPONSE_LIMIT' }); assert.equal(f.calls.length, 1);
  }
});

test('invalid render format and deeply nested manifest cannot be published as success', async t => {
  const render = fixture(t, { operation: 'adobe.render', output: Buffer.from('not-png') });
  await assert.rejects(render.run(), { code: 'ADOBE_RESPONSE_INVALID' }); assert.equal(render.receipt().state, 'failed');
  const manifest = fixture(t, { output: '['.repeat(40) + 'null' + ']'.repeat(40) });
  await assert.rejects(manifest.run(), { code: 'ADOBE_RESPONSE_LIMIT' });
});

test('cleanup rejection preserves the successful output and reports pending cleanup', async t => {
  const f = fixture(t, { hook: call => call.method === 'DELETE' ? new Response('denied', { status: 403 }) : undefined });
  const { result } = await f.run(); assert.equal(result.cleanup, 'pending'); assert.equal(f.receipt().cleanup, 'pending');
  assert.equal(f.receipt().state, 'succeeded'); assert.ok(fs.existsSync(path.join(f.outputDir, 'manifest.json')));
});
