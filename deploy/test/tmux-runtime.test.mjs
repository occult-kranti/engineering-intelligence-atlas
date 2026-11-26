import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { readEnvironment, rotatingLog, redactedStream, sessionIdentity, shellQuote, start, status, stop } from '../tmux-runtime.mjs';

const probeSocket = `daftar-runtime-test-probe-${process.pid}`;
const probe = spawnSync('tmux', ['-f', '/dev/null', '-L', probeSocket, 'new-session', '-d', '-s', 'probe', 'sleep 30'], { encoding: 'utf8', timeout: 5000 });
const available = probe.status === 0;
if (available) spawnSync('tmux', ['-L', probeSocket, 'kill-server']);
const requireTmux = process.env.DAFTAR_REQUIRE_TMUX === '1';
const unavailableReason = `Native tmux session unavailable: ${probe.error?.code || probe.stderr?.trim() || probe.status}`;
function temporary(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "daftar tmux 'quoted-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  return directory;
}
async function until(predicate, timeout = 6000) {
  const deadline = Date.now() + timeout;
  while (!predicate()) {
    if (Date.now() >= deadline) throw new Error('Timed out waiting for the local test fixture.');
    await new Promise(resolve => setTimeout(resolve, 50));
  }
}

test('private environment accepts file references but rejects inline keys and public binds', t => {
  const filename = path.join(temporary(t), 'runtime.env');
  fs.writeFileSync(filename, 'ANTHROPIC_API_KEY_FILE="/private/path with spaces/token"\nDAFTAR_PORT=8899\nDAFTAR_PYTHON_PATH="/opt/python with spaces/bin/python3"\n', { mode: 0o600 });
  assert.equal(readEnvironment(filename).ANTHROPIC_API_KEY_FILE, '/private/path with spaces/token');
  assert.equal(readEnvironment(filename).DAFTAR_PYTHON_PATH, '/opt/python with spaces/bin/python3');
  for (const body of ['ANTHROPIC_API_KEY=secret-value', 'DAFTAR_HOST=0.0.0.0', 'NODE_OPTIONS=--inspect', 'DAFTAR_CONTROL_TOKEN_FILE=relative', 'DAFTAR_PYTHON_PATH=python3', 'DAFTAR_PORT=80']) {
    fs.writeFileSync(filename, body); assert.throws(() => readEnvironment(filename));
  }
  fs.writeFileSync(filename, 'DAFTAR_PORT=8788'); fs.chmodSync(filename, 0o644);
  assert.throws(() => readEnvironment(filename), /private regular file/);
});

test('log rotation caps disk use and keeps mode private', t => {
  const directory = temporary(t); const filename = path.join(directory, 'runtime.log');
  const log = rotatingLog(filename, 128); log.write('x'.repeat(1500)); log.close();
  const segments = fs.readdirSync(directory); assert.equal(segments.length, 4);
  for (const name of segments) {
    const stat = fs.statSync(path.join(directory, name));
    assert.ok(stat.size <= 128); assert.equal(stat.mode & 0o777, 0o600);
  }
});

test('log redaction catches a token split across chunks without corrupting UTF-8', () => {
  const token = 'private_control_token_'.repeat(3); let output = '';
  const stream = redactedStream(token, value => { output += value; });
  const original = Buffer.from(`Started ✓ ${token}; finished 界\n`);
  for (let offset = 0; offset < original.length; offset += 3) stream.write(original.subarray(offset, offset + 3));
  stream.end();
  assert.equal(output, 'Started ✓ [control credential omitted]; finished 界\n');
  assert.ok(!output.includes(token));
});

test('shell quoting preserves spaces, quotes, and shell metacharacters', () => {
  const raw = "path ' with ; $(printf hacked) `uname` & spaces";
  const result = spawnSync('/bin/sh', ['-c', `printf '%s' ${shellQuote(raw)}`], { encoding: 'utf8' });
  assert.equal(result.status, 0); assert.equal(result.stdout, raw);
  assert.notEqual(sessionIdentity('/tmp/data-a').socket, sessionIdentity('/tmp/data-b').socket);
});

test('real tmux starts once, survives caller exit, and stops only its managed runtime', { skip: !available && !requireTmux ? unavailableReason : false }, async t => {
  assert.ok(available, unavailableReason);
  const directory = temporary(t); const repo = path.join(directory, 'repo $(no-command)'); const data = path.join(directory, 'data ; no-command');
  for (const name of ['deploy', 'headless-runtime', 'desktop-shell/dist/main', 'native-core/target/release']) fs.mkdirSync(path.join(repo, name), { recursive: true });
  // Use a real launcher file: Node resolves symlinked ESM entrypoints before
  // import.meta.url, so an argv-vs-module main guard will not run a symlink.
  fs.copyFileSync(fileURLToPath(new URL('../tmux-runtime.mjs', import.meta.url)), path.join(repo, 'deploy/tmux-runtime.mjs'));
  fs.mkdirSync(path.join(repo, 'tools'));
  fs.copyFileSync(fileURLToPath(new URL('../../tools/daftar-runtime-mcp.mjs', import.meta.url)), path.join(repo, 'tools/daftar-runtime-mcp.mjs'));
  fs.copyFileSync(fileURLToPath(new URL('../../tools/atlas-mcp.mjs', import.meta.url)), path.join(repo, 'tools/atlas-mcp.mjs'));
  fs.copyFileSync(fileURLToPath(new URL('../../headless-runtime/host-control-contract.mjs', import.meta.url)), path.join(repo, 'headless-runtime/host-control-contract.mjs'));
  fs.copyFileSync(fileURLToPath(new URL('../../headless-runtime/contract.mjs', import.meta.url)), path.join(repo, 'headless-runtime/contract.mjs'));
  for (const name of ['activity-journal-contract.mjs', 'workbench-contract.mjs', 'managed-environments-contract.mjs', 'model-resources-contract.mjs', 'design-toolchain-contract.mjs']) fs.copyFileSync(fileURLToPath(new URL('../../headless-runtime/' + name, import.meta.url)), path.join(repo, 'headless-runtime', name));
  fs.writeFileSync(path.join(repo, 'desktop-shell/dist/main/office.js'), '// fixture');
  fs.writeFileSync(path.join(repo, 'native-core/target/release/atlas-core'), 'fixture');
  fs.writeFileSync(path.join(repo, 'headless-runtime/server.mjs'), `import fs from 'node:fs'; import path from 'node:path';
    const file = path.join(process.env.DAFTAR_DATA_DIR, 'fixture.json');
    fs.writeFileSync(file, JSON.stringify({ pid: process.pid, host: process.env.DAFTAR_HOST, enabled: process.env.DAFTAR_HOST_CONTROL, pythonPath: process.env.DAFTAR_PYTHON_PATH, inheritedSecret: !!process.env.DAFTAR_TEST_RAW_SECRET }));
    process.stdout.write('fixture ready\\n');
    setInterval(() => {}, 1000);
    process.on('SIGTERM', () => { fs.writeFileSync(file + '.stopped', 'yes'); process.exit(0); });
  `);
  process.env.DAFTAR_TEST_RAW_SECRET = 'never-inherit';
  t.after(() => { delete process.env.DAFTAR_TEST_RAW_SECRET; });
  const identity = sessionIdentity(data);
  t.after(async () => {
    try { await stop(data); } catch {}
    // This socket is created solely by this test, including its sibling fixture.
    spawnSync('tmux', ['-L', identity.socket, 'kill-server']);
  });
  const envFile = path.join(directory, 'runtime.env'); fs.writeFileSync(envFile, 'DAFTAR_PYTHON_PATH=/opt/env-file/python3\n', { mode: 0o600 });
  const first = start({ repo, data, envFile, pythonPath: '/opt/pinned Python/bin/python3', enableHostControl: true });
  assert.equal(first.running, true); assert.equal(first.hostControlEnabled, true);
  assert.equal(first.pythonPath, '/opt/pinned Python/bin/python3');
  await until(() => fs.existsSync(path.join(data, 'fixture.json')));
  const fixture = JSON.parse(fs.readFileSync(path.join(data, 'fixture.json')));
  assert.equal(fixture.host, '127.0.0.1'); assert.equal(fixture.enabled, '1'); assert.equal(fixture.inheritedSecret, false);
  assert.equal(fixture.pythonPath, '/opt/pinned Python/bin/python3');
  const token = fs.readFileSync(first.controlTokenFile, 'utf8');
  fs.writeFileSync(envFile, 'DAFTAR_PYTHON_PATH=/opt/other/python3\n');
  const second = start({ repo, data, envFile, pythonPath: '/opt/new-selection/python3' });
  assert.equal(second.hostControlEnabled, true); assert.equal(fs.readFileSync(first.controlTokenFile, 'utf8'), token);
  assert.equal(second.pythonPath, first.pythonPath);
  assert.equal(JSON.parse(fs.readFileSync(path.join(data, 'fixture.json'))).pid, fixture.pid);
  assert.equal(JSON.parse(fs.readFileSync(path.join(data, 'fixture.json'))).pythonPath, fixture.pythonPath, 'connecting to an existing daemon does not replace its Python');
  for (const filename of [first.controlTokenFile, path.join(data, 'supervisor/config.json')]) assert.equal(fs.statSync(filename).mode & 0o777, 0o600);
  assert.equal(fs.statSync(data).mode & 0o777, 0o700);
  const sibling = spawnSync('tmux', ['-L', identity.socket, 'new-session', '-d', '-s', 'sibling', 'sleep 60']);
  assert.equal(sibling.status, 0);
  const stopped = await stop(data); assert.equal(stopped.running, false); assert.equal(stopped.ok, true);
  assert.equal(fs.readFileSync(path.join(data, 'fixture.json.stopped'), 'utf8'), 'yes');
  assert.equal(status(data).running, false);
  assert.equal(spawnSync('tmux', ['-L', identity.socket, 'has-session', '-t', '=sibling']).status, 0);
  assert.ok(!fs.readFileSync(path.join(data, 'supervisor/runtime.log'), 'utf8').includes(token.trim()));
});

test('supervisor argv and private state remain scoped when a local tmux simulator is used', async t => {
  const directory = temporary(t); const repo = path.join(directory, 'repo'); const data = path.join(directory, 'data'); const bin = path.join(directory, 'bin');
  for (const name of ['deploy', 'headless-runtime', 'desktop-shell/dist/main', 'native-core/target/release']) fs.mkdirSync(path.join(repo, name), { recursive: true });
  fs.mkdirSync(bin);
  fs.writeFileSync(path.join(repo, 'headless-runtime/server.mjs'), '// fixture only; simulator does not execute it');
  fs.writeFileSync(path.join(repo, 'desktop-shell/dist/main/office.js'), '// fixture');
  fs.writeFileSync(path.join(repo, 'native-core/target/release/atlas-core'), 'fixture');
  const records = path.join(directory, 'tmux-calls.jsonl'); const active = path.join(directory, 'active');
  fs.writeFileSync(path.join(bin, 'tmux'), `#!/usr/bin/env node
    const fs = require('node:fs'); const args = process.argv.slice(2);
    fs.appendFileSync(${JSON.stringify(records)}, JSON.stringify(args) + '\\n', {mode:0o600});
    if (args.includes('-V')) { console.log('tmux simulator'); process.exit(0); }
    if (args.includes('has-session')) process.exit(fs.existsSync(${JSON.stringify(active)}) && !fs.existsSync(${JSON.stringify(path.join(data, 'supervisor/stop-request'))}) ? 0 : 1);
    if (args.includes('new-session')) fs.writeFileSync(${JSON.stringify(active)}, 'active');
  `, { mode: 0o700 });
  const oldPath = process.env.PATH; process.env.PATH = `${bin}:${oldPath}`;
  t.after(() => { process.env.PATH = oldPath; });
  const first = start({ repo, data });
  assert.equal(first.running, true); assert.equal(first.hostControlEnabled, false);
  const originalConfig = fs.readFileSync(path.join(data, 'supervisor/config.json'), 'utf8');
  assert.equal(start({ repo, data, enableHostControl: true }).hostControlEnabled, false);
  assert.equal(fs.readFileSync(path.join(data, 'supervisor/config.json'), 'utf8'), originalConfig);
  assert.equal((await stop(data)).running, false);
  const calls = fs.readFileSync(records, 'utf8').trim().split('\n').map(JSON.parse);
  assert.equal(calls.filter(args => args.includes('new-session')).length, 1);
  for (const args of calls) {
    assert.equal(args[args.indexOf('-L') + 1], sessionIdentity(data).socket);
    assert.ok(!args.includes('kill-server')); assert.ok(!args.includes('kill-session'));
  }
  const launch = calls.find(args => args.includes('new-session'));
  assert.equal(launch.at(-1), [process.execPath, path.join(repo, 'deploy/tmux-runtime.mjs'), '_run', '--data', data].map(shellQuote).join(' '));
  assert.equal(fs.statSync(first.controlTokenFile).mode & 0o777, 0o600);
});

test('explicit Python survives supervisor CLI and daemon launch without inheriting ambient configuration', t => {
  const directory = temporary(t); const repo = path.join(directory, 'repo'); const data = path.join(directory, 'data'); const bin = path.join(directory, 'bin');
  for (const name of ['headless-runtime', 'desktop-shell/dist/main', 'native-core/target/release']) fs.mkdirSync(path.join(repo, name), { recursive: true });
  fs.mkdirSync(bin);
  for (const filename of ['desktop-shell/dist/main/office.js', 'native-core/target/release/atlas-core']) fs.writeFileSync(path.join(repo, filename), 'fixture');
  const observed = path.join(data, 'daemon-observed.json');
  fs.writeFileSync(path.join(repo, 'headless-runtime/server.mjs'), `import fs from 'node:fs';
    fs.writeFileSync(${JSON.stringify(observed)}, JSON.stringify({pythonPath:process.env.DAFTAR_PYTHON_PATH??null,secret:process.env.DAFTAR_TEST_RAW_SECRET??null}));
  `);
  const active = path.join(directory, 'active'); const stopped = path.join(data, 'supervisor/stop-request');
  fs.writeFileSync(path.join(bin, 'tmux'), `#!/usr/bin/env node
    const fs=require('node:fs');const args=process.argv.slice(2);
    if(args.includes('-V')){console.log('tmux simulator');process.exit(0);}
    if(args.includes('has-session'))process.exit(fs.existsSync(${JSON.stringify(active)})&&!fs.existsSync(${JSON.stringify(stopped)})?0:1);
    if(args.includes('new-session'))fs.writeFileSync(${JSON.stringify(active)},'active');
  `, { mode: 0o700 });
  const supervisor = fileURLToPath(new URL('../tmux-runtime.mjs', import.meta.url));
  const environment = { ...process.env, PATH: `${bin}:${process.env.PATH}`, ELECTRON_RUN_AS_NODE: '1', DAFTAR_PYTHON_PATH: '/ambient/python-must-not-leak', DAFTAR_TEST_RAW_SECRET: 'synthetic-never-inherit' };
  const invoke = args => spawnSync(process.execPath, [supervisor, ...args], { env: environment, encoding: 'utf8', timeout: 10000, maxBuffer: 8192 });
  const launch = (...args) => { const result = invoke(['start', '--repo', repo, '--data', data, ...args]); assert.equal(result.status, 0, result.stderr); return JSON.parse(result.stdout); };
  const run = expected => { const result = invoke(['_run', '--data', data]); assert.equal(result.status, 0, result.stderr); assert.deepEqual(JSON.parse(fs.readFileSync(observed, 'utf8')), { pythonPath: expected, secret: null }); };
  const stopFixture = () => { const result = invoke(['stop', '--data', data]); assert.equal(result.status, 0, result.stderr); assert.equal(JSON.parse(result.stdout).running, false); };
  const configPath = path.join(data, 'supervisor/config.json');
  const selected = path.join(directory, "selected Python ' path", 'bin/python3');
  const first = launch('--python', selected); assert.equal(first.pythonPath, selected); run(selected);
  const original = fs.readFileSync(configPath, 'utf8'); assert.equal(JSON.parse(original).envFile, null);
  assert.equal(launch('--python', '/new-selection/python3').pythonPath, selected);
  assert.equal(fs.readFileSync(configPath, 'utf8'), original, 'reattachment must preserve the running configuration'); stopFixture();
  for (const invalid of ['python3', '/absolute/with\nnewline']) { const result = invoke(['start', '--repo', repo, '--data', data, '--python', invalid]); assert.equal(result.status, 1); assert.equal(fs.readFileSync(configPath, 'utf8'), original); }
  const envFile = path.join(directory, 'runtime.env'); fs.writeFileSync(envFile, 'DAFTAR_PYTHON_PATH=/file-selected/python3\n', { mode: 0o600 });
  assert.equal(launch('--env-file', envFile, '--python', selected).pythonPath, selected);
  fs.writeFileSync(envFile, 'DAFTAR_PYTHON_PATH=/file-changed/python3\n'); run(selected); stopFixture();
  assert.equal(launch('--env-file', envFile).pythonPath, '/file-changed/python3'); run('/file-changed/python3'); stopFixture();
  const legacy = JSON.parse(fs.readFileSync(configPath, 'utf8')); delete legacy.pythonPath; fs.writeFileSync(configPath, JSON.stringify(legacy));
  run('/file-changed/python3');
  assert.equal(launch().pythonPath, null); run(null); stopFixture();
  fs.writeFileSync(envFile, 'DAFTAR_PORT=8788\n'); assert.equal(launch('--env-file', envFile).pythonPath, null);
  fs.writeFileSync(envFile, 'DAFTAR_PYTHON_PATH=/late-file/python3\n'); run(null); stopFixture();
});
