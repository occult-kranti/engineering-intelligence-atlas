import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { Readable } from 'node:stream';
import { main, prepareRequest, readInput, INPUT_LIMIT } from '../host-control.mjs';

function temporary(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'daftar-cli-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  return directory;
}
function capture() {
  const result = { stdout: '', stderr: '' };
  return { result, stdout: { write: value => { result.stdout += value; } }, stderr: { write: value => { result.stderr += value; } } };
}
function runArguments(filename) {
  return ['run', '--id', 'inspect-machine-001', '--company', 'company-main', '--employee', 'employee-donna', '--cwd', '/workspace/project with spaces', '--command-file', filename];
}

test('file and stdin preserve exact command bytes and all attribution', async t => {
  const directory = temporary(t);
  const command = 'printf "%s\\n" "quoted $HOME `literal`"\n# second line\n';
  const filename = path.join(directory, 'command.txt');
  fs.writeFileSync(filename, command);
  for (const request of [await prepareRequest(runArguments(filename)), await prepareRequest(runArguments('-'), { stdin: Readable.from([command.slice(0, 8), command.slice(8)]) })]) {
    assert.equal(request.route, '/v1/host/submit');
    assert.equal(request.body.command, command);
    assert.equal(request.body.companyId, 'company-main');
    assert.equal(request.body.employeeId, 'employee-donna');
    assert.equal(request.body.cwd, '/workspace/project with spaces');
    assert.equal(request.body.id, 'inspect-machine-001');
  }
});

test('configure preserves the submitted CAS revision and never reads newer state', async t => {
  const filename = path.join(temporary(t), 'policy.json');
  const policy = { expectedRevision: 77, mode: 'auto', grants: [{ id: 'owner', companyId: 'main', employeeId: null }] };
  fs.writeFileSync(filename, JSON.stringify(policy));
  const calls = []; const output = capture();
  const code = await main(['configure', '--file', filename], { ...output, request: async (...args) => { calls.push(args); return { ok: true }; } });
  assert.equal(code, 0); assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], ['POST', '/v1/host/configure', policy]);
  delete policy.expectedRevision; fs.writeFileSync(filename, JSON.stringify(policy));
  assert.equal(await main(['configure', '--file', filename], { ...capture(), request: async () => { throw new Error('must not send'); } }), 1);
});

test('bounded input rejects oversized files, streams, and symlinks', async t => {
  const directory = temporary(t); const filename = path.join(directory, 'large');
  fs.writeFileSync(filename, Buffer.alloc(INPUT_LIMIT + 1));
  await assert.rejects(readInput(filename), /256 KiB/);
  await assert.rejects(readInput('-', Readable.from([Buffer.alloc(INPUT_LIMIT), 'x'])), /256 KiB/);
  fs.writeFileSync(filename, 'true\n'); fs.symlinkSync(filename, path.join(directory, 'link'));
  await assert.rejects(readInput(path.join(directory, 'link')), /without a symlink/);
});

test('unknown/repeated options, inline secrets/commands, and invalid offsets never send', async () => {
  const cases = [['status', '--token', 'not-a-token'], ['run', '--command', 'touch something'], ['inspect', '--id', 'a', '--id', 'b'], ['inspect', '--id', '../escape'], ['inspect', '--id', 'a', '--offset', '-1'], ['inspect', '--id', 'a', '--offset', '1e3'], ['inspect', '--id', 'a', '--offset', '8388609'], ['stop-all', '--file', 'any'], ['unknown']];
  for (const args of cases) {
    let calls = 0;
    assert.equal(await main(args, { ...capture(), request: async () => { calls++; return { ok: true }; } }), 1);
    assert.equal(calls, 0);
  }
});

test('shared contract rejects oversized command bytes, invalid fields, and out-of-range bounds before HTTP', async () => {
  const base = { id: 'job-1', companyId: 'company-1', employeeId: 'employee-1', cwd: '/workspace', command: 'true' };
  for (const changes of [{ command: '界'.repeat(22000) }, { unexpected: true }, { employeeId: null }, { timeoutSeconds: 86401 }, { maxOutputBytes: 8388609 }, { cwd: '/workspace\ninjected' }]) {
    let calls = 0;
    const result = await main(['run', '--file', '-'], { ...capture(), stdin: Readable.from([JSON.stringify({ ...base, ...changes })]), request: async () => { calls++; return { ok: true }; } });
    assert.equal(result, 1); assert.equal(calls, 0);
  }
});

test('a failed mutation is never automatically retried', async () => {
  let calls = 0; const output = capture();
  const code = await main(['approve', '--id', 'stable-job'], { ...output, request: async () => { calls++; throw Object.assign(new Error('Uncertain response; inspect the original job.'), { code: 'runtime_unreachable' }); } });
  assert.equal(code, 1); assert.equal(calls, 1); assert.match(output.result.stderr, /Uncertain response/);
});

test('real HTTP client uses the private token, fixed host routes, and redacts token echoes', async t => {
  const directory = temporary(t); const token = 'a'.repeat(64); const tokenFile = path.join(directory, 'token');
  fs.writeFileSync(tokenFile, `${token}\n`, { mode: 0o600 });
  const requests = [];
  const server = http.createServer(async (req, res) => {
    const chunks = []; for await (const chunk of req) chunks.push(chunk);
    requests.push({ method: req.method, url: req.url, auth: req.headers.authorization, body: Buffer.concat(chunks).toString() });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, host: { mode: 'off' }, echo: token }));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const output = capture();
  const code = await main(['status'], { ...output, env: { DAFTAR_RUNTIME_URL: `http://127.0.0.1:${server.address().port}`, DAFTAR_CONTROL_TOKEN_FILE: tokenFile } });
  assert.equal(code, 0, output.result.stderr); assert.equal(requests.length, 1);
  assert.equal(requests[0].url, '/v1/host'); assert.equal(requests[0].auth, `Bearer ${token}`);
  assert.ok(!output.result.stdout.includes(token));
  fs.chmodSync(tokenFile, 0o644);
  assert.equal(await main(['status'], { ...capture(), env: { DAFTAR_RUNTIME_URL: `http://127.0.0.1:${server.address().port}`, DAFTAR_CONTROL_TOKEN_FILE: tokenFile } }), 1);
  assert.equal(requests.length, 1);
});
