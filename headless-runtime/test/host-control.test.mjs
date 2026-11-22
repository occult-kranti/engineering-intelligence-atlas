import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createHostControl, HostControlError } from '../host-control.mjs';
import { atomicJson, hash, HOST_TOOL_SCHEMAS, LIMITS, readJson, validateHostOperation } from '../host-control-contract.mjs';

const runnerFile = fileURLToPath(new URL('../host-job-runner.mjs', import.meta.url));
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const fixture = () => ({ companies: [{ id: 'acme', status: 'active', assistantId: 'donna' }, { id: 'other', status: 'active', assistantId: 'other-donna' }],
  employees: [{ id: 'donna', companyId: null, officeId: null, departmentId: null, status: 'active', role: 'assistant' },
    { id: 'dev', companyId: 'acme', officeId: 'office', departmentId: 'engineering', status: 'active', role: 'engineer' },
    { id: 'foreign', companyId: 'other', officeId: null, departmentId: null, status: 'active', role: 'ceo' }],
  offices: [{ id: 'office', companyId: 'acme', status: 'active' }], departments: [{ id: 'engineering', companyId: 'acme', status: 'active' }],
  portfolio: { contracts: [], services: [] } });
function fakeRunner() {
  const live = new Map(); let launches = 0;
  return { live, get launches() { return launches; }, available: async () => true,
    launch: async ({ session, jobDir }) => { launches++; live.set(session, jobDir); }, isAlive: async session => live.has(session),
    cancel: async ({ session, jobDir }) => {
      const spec = readJson(path.join(jobDir, 'spec.json'), 100000);
      atomicJson(path.join(jobDir, 'result.json'), { version: 1, nonce: spec.nonce, status: 'cancelled', exitCode: null,
        reason: 'cancelled', outputBytes: 0, startedAt: new Date().toISOString(), finishedAt: new Date().toISOString() }); live.delete(session);
    }, terminate: async session => { live.delete(session); }
  };
}
function setup(t, options = {}) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'daftar-host-test-'));
  const state = fixture(); const runner = options.runner ?? fakeRunner();
  const create = overrides => createHostControl({ stateDir: directory, enabled: true, snapshot: async () => ({ ok: true, snapshot: state }), runner, ...options, ...overrides });
  const control = create(); const controls = [control];
  t.after(async () => { for (const item of controls) await item.close().catch(() => {}); fs.rmSync(directory, { recursive: true, force: true }); });
  const command = (id = 'job', extra = {}) => ({ id, companyId: 'acme', employeeId: 'dev', command: 'printf hello', cwd: directory, ...extra });
  const configure = (mode = 'auto', grants = [{ id: 'acme-owner', companyId: 'acme', employeeId: null }], expectedRevision = 0) => control.configure({ mode, grants, expectedRevision });
  return { directory, state, runner, control, command, configure, restart() { const next = create(); controls.push(next); return next; } };
}
const rejectCode = (promise, code) => assert.rejects(promise, error => error instanceof HostControlError && error.code === code && !error.message.includes('/tmp/'));
async function until(fn, predicate, timeout = 6000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) { const value = await fn(); if (predicate(value)) return value; await pause(50); }
  throw new Error('Timed out awaiting host-job state');
}

test('disabled capability is truthful, initial enabled policy is off, and stale revisions fail', async t => {
  const f = setup(t); const disabled = createHostControl({ stateDir: f.directory, enabled: false, snapshot: async () => f.state });
  assert.equal((await disabled.status()).host.configured, false);
  await rejectCode(disabled.submit(f.command()), 'HOST_DISABLED'); await disabled.close();
  assert.equal((await f.control.status()).host.mode, 'off');
  await rejectCode(f.control.submit(f.command()), 'HOST_POLICY_OFF');
  const configured = await f.configure(); assert.equal(configured.host.revision, 1);
  await rejectCode(f.configure(), 'HOST_REVISION_CONFLICT');
});

test('only explicit grants and canonical active native scope authorize a command', async t => {
  const f = setup(t); await f.configure('auto', []);
  await rejectCode(f.control.submit(f.command()), 'HOST_GRANT_REQUIRED');
  await f.configure('auto', [{ id: 'specific', companyId: 'acme', employeeId: 'dev' }], 1);
  await rejectCode(f.control.submit(f.command('boss', { employeeId: 'foreign' })), 'HOST_SCOPE_DENIED');
  await rejectCode(f.control.submit(f.command('assistant', { employeeId: 'donna' })), 'HOST_GRANT_REQUIRED');
  f.state.departments[0].status = 'paused';
  await rejectCode(f.control.submit(f.command()), 'HOST_SCOPE_DENIED');
  f.state.departments[0].status = 'active'; f.state.employees[1].status = 'fired';
  await rejectCode(f.control.submit(f.command()), 'HOST_SCOPE_DENIED');
  assert.equal(f.runner.launches, 0);
});

test('company grant admits its Donna, shared employee needs a live service contract', async t => {
  const f = setup(t, { maxConcurrent: 3 }); await f.configure();
  assert.equal((await f.control.submit(f.command('donna', { employeeId: 'donna' }))).job.status, 'running');
  await rejectCode(f.control.submit(f.command('shared', { employeeId: 'foreign' })), 'HOST_SCOPE_DENIED');
  f.state.portfolio.services.push({ id: 'service', companyId: 'other', status: 'active', employeeIds: ['foreign'] });
  f.state.portfolio.contracts.push({ id: 'contract', serviceId: 'service', recipientCompanyId: 'acme', status: 'active', employeeIds: ['foreign'] });
  assert.equal((await f.control.submit(f.command('shared', { employeeId: 'foreign' }))).job.status, 'running');
  f.state.portfolio.contracts[0].status = 'revoked';
  await rejectCode(f.control.submit(f.command('shared-two', { employeeId: 'foreign' })), 'HOST_SCOPE_DENIED');
});

test('manual approval rechecks grants and active employment; mode changes do not auto-approve', async t => {
  const f = setup(t); await f.configure('manual');
  assert.equal((await f.control.submit(f.command())).job.status, 'pending_approval'); assert.equal(f.runner.launches, 0);
  await f.configure('auto', [], 1);
  await rejectCode(f.control.approve({ id: 'job' }), 'HOST_GRANT_REQUIRED');
  await f.configure('auto', [{ id: 'all', companyId: 'acme', employeeId: null }], 2);
  f.state.employees[1].status = 'paused';
  await rejectCode(f.control.approve({ id: 'job' }), 'HOST_SCOPE_DENIED');
  f.state.employees[1].status = 'active'; assert.equal(f.runner.launches, 0);
  assert.equal((await f.control.approve({ id: 'job' })).job.status, 'running'); assert.equal(f.runner.launches, 1);
  await f.control.approve({ id: 'job' }); assert.equal(f.runner.launches, 1);
});

test('concurrent duplicate submissions launch once; changed body fails; receipts survive restart', async t => {
  const f = setup(t); await f.configure();
  const replies = await Promise.all(Array.from({ length: 32 }, () => f.control.submit(f.command())));
  assert.equal(f.runner.launches, 1); assert.equal(replies.filter(item => !item.replayed).length, 1);
  await rejectCode(f.control.submit(f.command('job', { command: 'printf changed' })), 'HOST_IDEMPOTENCY_CONFLICT');
  assert.ok(!JSON.stringify(await f.control.status()).includes('printf hello'));
  await f.control.close(); const restarted = f.restart();
  assert.equal((await restarted.submit(f.command())).replayed, true); assert.equal(f.runner.launches, 1);
});

test('unknown launch outcome preserves idempotency and capacity; restart never reruns it', async t => {
  const runner = fakeRunner(); runner.launch = async () => { throw new Error('transport disconnected'); };
  const f = setup(t, { runner, maxConcurrent: 1 }); await f.configure();
  assert.equal((await f.control.submit(f.command())).job.status, 'uncertain');
  assert.equal((await f.control.submit(f.command())).replayed, true);
  await rejectCode(f.control.submit(f.command('second')), 'HOST_CAPACITY');
  await f.control.close(); assert.equal((await f.restart().submit(f.command())).job.status, 'interrupted');
});

test('a vanished runner becomes interrupted and approving or replaying does not execute it again', async t => {
  const f = setup(t, { maxConcurrent: 1 }); await f.configure(); const first = await f.control.submit(f.command());
  f.runner.live.delete(first.job.tmuxSession);
  assert.equal((await f.control.status()).host.jobs[0].status, 'interrupted');
  await f.control.approve({ id: 'job' }); await f.control.submit(f.command());
  assert.equal(f.runner.launches, 1);
  assert.equal((await f.control.inspect({ id: 'job' })).eof, false);
  await rejectCode(f.control.submit(f.command('second')), 'HOST_CAPACITY');
});

test('uncertain registry writes fence all authority until restart, before and after rename commit', async t => {
  for (const phase of ['before', 'after']) {
    const f = setup(t); const destination = path.join(f.directory, 'host-control', 'registry.json');
    const rename = fs.renameSync;
    fs.renameSync = (source, target) => {
      if (target !== destination) return rename(source, target);
      if (phase === 'after') rename(source, target);
      throw Object.assign(new Error('Injected EIO'), { code: 'EIO' });
    };
    try { await rejectCode(f.configure(), 'HOST_STATE_UNCERTAIN'); }
    finally { fs.renameSync = rename; }
    const disk = readJson(destination, LIMITS.registryBytes);
    assert.equal(disk.mode, phase === 'before' ? 'off' : 'auto');
    assert.equal(disk.revision, phase === 'before' ? 0 : 1);
    for (const attempt of [() => f.control.status(), () => f.control.submit(f.command()),
      () => f.control.configure({ expectedRevision: disk.revision, mode: 'off', grants: [] }), () => f.control.stopAll()]) {
      await rejectCode(attempt(), 'HOST_STATE_UNCERTAIN');
    }
    assert.equal(f.runner.launches, 0);
    await f.control.close(); const restarted = f.restart(); const reconciled = await restarted.status();
    assert.equal(reconciled.host.mode, disk.mode); assert.equal(reconciled.host.revision, disk.revision);
    if (phase === 'before') await rejectCode(restarted.submit(f.command()), 'HOST_POLICY_OFF');
  }
});

test('a persistence failure after launch fences the controller and replay never reexecutes', async t => {
  const f = setup(t); await f.configure(); const destination = path.join(f.directory, 'host-control', 'registry.json');
  const rename = fs.renameSync;
  fs.renameSync = (source, target) => {
    if (target === destination && JSON.parse(fs.readFileSync(source, 'utf8')).jobs.some(job => job.status === 'running')) {
      throw Object.assign(new Error('Injected post-launch EIO'), { code: 'EIO' });
    }
    return rename(source, target);
  };
  try { await rejectCode(f.control.submit(f.command()), 'HOST_STATE_UNCERTAIN'); }
  finally { fs.renameSync = rename; }
  assert.equal(f.runner.launches, 1);
  await rejectCode(f.control.submit(f.command()), 'HOST_STATE_UNCERTAIN');
  await f.control.close(); const restarted = f.restart();
  assert.equal((await restarted.submit(f.command())).replayed, true); assert.equal(f.runner.launches, 1);
});

test('uncertain job specification and cancellation marker writes also fence dispatch', async t => {
  for (const file of ['spec.json', 'cancel.json']) {
    const f = setup(t); await f.configure();
    if (file === 'cancel.json') await f.control.submit(f.command());
    const rename = fs.renameSync;
    fs.renameSync = (source, destination) => {
      if (path.basename(destination) === file) throw Object.assign(new Error('Injected job write EIO'), { code: 'EIO' });
      return rename(source, destination);
    };
    try { await rejectCode(file === 'spec.json' ? f.control.submit(f.command()) : f.control.cancel({ id: 'job' }), 'HOST_STATE_UNCERTAIN'); }
    finally { fs.renameSync = rename; }
    await rejectCode(f.control.submit(f.command('next')), 'HOST_STATE_UNCERTAIN');
    assert.equal(f.runner.launches, file === 'spec.json' ? 0 : 1);
  }
});

test('stopAll returns promptly for 256 pending receipts and prevents further admission', async t => {
  const f = setup(t); await f.configure('manual');
  for (let i = 0; i < LIMITS.jobs; i++) await f.control.submit(f.command(`pending-${i}`));
  await rejectCode(f.control.submit(f.command('over-limit')), 'HOST_JOB_LIMIT');
  const started = Date.now(); const result = await f.control.stopAll();
  assert.ok(Date.now() - started < 5000, 'stopAll must not synchronously wait for each job');
  assert.equal(result.host.mode, 'off'); assert.equal(result.host.revision, 2);
  assert.equal(result.host.jobs.filter(job => job.status === 'cancelled').length, 256);
  assert.equal(f.runner.launches, 0);
});

test('off stops new launches; explicit cancel works after employee is fired; stopAll retains grants', async t => {
  const f = setup(t); await f.configure(); await f.control.submit(f.command());
  await f.configure('off', [{ id: 'acme-owner', companyId: 'acme', employeeId: null }], 1);
  assert.equal((await f.control.status()).host.jobs[0].status, 'running');
  await rejectCode(f.control.submit(f.command('second')), 'HOST_POLICY_OFF');
  f.state.employees[1].status = 'fired'; await f.control.cancel({ id: 'job' });
  assert.equal((await f.control.inspect({ id: 'job' })).job.status, 'cancelled');
  const stopped = await f.control.stopAll(); assert.equal(stopped.host.mode, 'off'); assert.equal(stopped.host.grants.length, 1);
});

test('full grant replacement keeps explicitly retained authority for unrelated companies', async t => {
  const f = setup(t); const other = { id: 'other', companyId: 'other', employeeId: 'foreign' };
  await f.configure('auto', [{ id: 'acme', companyId: 'acme', employeeId: null }, other]);
  const result = await f.configure('manual', [other], 1);
  assert.deepEqual(result.host.grants, [other]);
  assert.equal((await f.control.submit(f.command('foreign-job', { companyId: 'other', employeeId: 'foreign' }))).job.status, 'pending_approval');
});

test('malformed commands, unsafe paths, caps, and unknown keys fail without launch', async t => {
  const f = setup(t); await f.configure();
  for (const input of [f.command('../escape'), f.command('ok', { command: '\0' }), f.command('ok', { command: 'x'.repeat(65537) }),
    f.command('ok', { cwd: 'relative' }), f.command('ok', { timeoutSeconds: 0 }), f.command('ok', { maxOutputBytes: LIMITS.outputBytes + 1 }),
    f.command('ok', { employeeId: null }), f.command('ok', { shell: '/bin/sh' })]) await rejectCode(f.control.submit(input), 'HOST_INPUT_INVALID');
  await rejectCode(f.control.submit(f.command('missing', { cwd: path.join(f.directory, 'missing') })), 'HOST_CWD_UNAVAILABLE');
  assert.equal(f.runner.launches, 0);
  await f.control.submit(f.command('one')); await f.control.submit(f.command('two'));
  await rejectCode(f.control.submit(f.command('three')), 'HOST_CAPACITY');
});

test('schema validators match public command contracts without filesystem side effects', () => {
  assert.deepEqual(Object.keys(HOST_TOOL_SCHEMAS), ['status', 'configure', 'submit', 'approve', 'cancel', 'inspect', 'stopAll']);
  assert.equal(validateHostOperation('submit', { id: 'x', companyId: 'acme', employeeId: 'dev', command: 'true', cwd: '/no-such-directory' }).timeoutSeconds, 1800);
  for (const [operation, input] of [['status', { extra: true }], ['configure', { expectedRevision: 0.5, mode: 'auto', grants: [] }],
    ['inspect', { id: 'x', offset: 9000000 }], ['submit', { id: 'x' }], ['__proto__', {}]]) assert.throws(() => validateHostOperation(operation, input), HostControlError);
});

test('owner locks, corrupted registries and symlink state fail closed', async t => {
  const f = setup(t);
  assert.throws(() => f.restart(), error => error.code === 'HOST_BUSY');
  await f.control.close();
  const registry = path.join(f.directory, 'host-control', 'registry.json'); fs.writeFileSync(registry, '{broken', { mode: 0o600 });
  assert.throws(() => f.restart(), error => error.code === 'HOST_STATE_INVALID');
  fs.unlinkSync(registry); const target = path.join(f.directory, 'other-file'); fs.writeFileSync(target, '{}', { mode: 0o600 }); fs.symlinkSync(target, registry);
  assert.throws(() => f.restart(), error => error.code === 'HOST_STATE_INVALID');
});

test('inspect returns bounded, offset-addressable output and common token redaction', async t => {
  const f = setup(t); await f.configure(); await f.control.submit(f.command());
  const dir = path.join(f.directory, 'host-control', 'jobs', hash('job'));
  fs.writeFileSync(path.join(dir, 'output.log'), `sk-${'secret'.repeat(8)}\n${'x'.repeat(70000)}`, { mode: 0o600 });
  const first = await f.control.inspect({ id: 'job' }); assert.ok(first.output.startsWith('[REDACTED]')); assert.equal(first.nextOffset, 65536); assert.equal(first.truncated, true);
  const next = await f.control.inspect({ id: 'job', offset: first.nextOffset }); assert.ok(next.output.length < 65536);
  const beyond = await f.control.inspect({ id: 'job', offset: 90000 }); assert.equal(beyond.output, ''); assert.equal(beyond.nextOffset, 90000); assert.equal(beyond.eof, false);
  fs.writeFileSync(path.join(dir, 'output.log'), Buffer.concat([Buffer.alloc(65535, 0xff), Buffer.from('😀')]), { mode: 0o600 });
  const binary = await f.control.inspect({ id: 'job' }); assert.equal(binary.nextOffset, 65536);
  assert.ok(Buffer.byteLength(binary.output) <= 3 * 65536); assert.ok(binary.output.includes('\ufffd'));
  const split = await f.control.inspect({ id: 'job', offset: 65536 }); assert.equal(split.nextOffset, 65539); assert.ok(split.output.includes('\ufffd'));
  await rejectCode(f.control.inspect({ id: 'job', offset: -1 }), 'HOST_INPUT_INVALID');
});

function detachedRunner() {
  const active = new Map();
  return { available: async () => true,
    launch: async ({ session, jobDir }) => {
      const child = spawn(process.execPath, [runnerFile, jobDir], { detached: true, stdio: 'ignore', env: { ...process.env, OPENAI_API_KEY: 'synthetic-secret-for-test', DAFTAR_API_TOKEN: 'synthetic-owner-secret' } });
      active.set(session, child); child.once('exit', () => active.delete(session)); child.unref();
    }, isAlive: async session => active.has(session), terminate: async session => { active.get(session)?.kill('SIGTERM'); }
  };
}

test('actual detached runner survives controller close, strips inherited credentials, and preserves shell syntax', async t => {
  const f = setup(t, { runner: detachedRunner() }); await f.configure();
  await f.control.submit(f.command('survive', { command: 'sleep .2; printf "hello\\n"; printf "%s|%s" "${OPENAI_API_KEY-unset}" "${DAFTAR_API_TOKEN-unset}"' }));
  await f.control.close(); const restarted = f.restart();
  const done = await until(() => restarted.inspect({ id: 'survive' }), item => item.eof);
  assert.equal(done.job.status, 'completed'); assert.equal(done.output, 'hello\nunset|unset');
  assert.equal(fs.statSync(path.join(f.directory, 'host-control', 'jobs', hash('survive'), 'spec.json')).mode & 0o777, 0o600);
});

test('actual runner enforces output and wall-time limits', async t => {
  const f = setup(t, { runner: detachedRunner() }); await f.configure();
  await f.control.submit(f.command('flood', { command: 'yes X', maxOutputBytes: 1024 }));
  const flooded = await until(() => f.control.inspect({ id: 'flood' }), item => item.eof);
  assert.equal(flooded.job.status, 'output_limit'); assert.equal(Buffer.byteLength(flooded.output), 1024);
  await f.control.submit(f.command('timeout', { command: 'sleep 30', timeoutSeconds: 1 }));
  const timeout = await until(() => f.control.inspect({ id: 'timeout' }), item => item.eof);
  assert.equal(timeout.job.status, 'timed_out');
  await f.control.submit(f.command('nonzero', { command: 'printf "failed detail" >&2; exit 7' }));
  const failed = await until(() => f.control.inspect({ id: 'nonzero' }), item => item.eof);
  assert.equal(failed.job.status, 'failed'); assert.equal(failed.job.exitCode, 7); assert.equal(failed.output, 'failed detail');
});

test('actual runner cancellation disposes ordinary descendants and second invocation cannot repeat a command', async t => {
  const f = setup(t, { runner: detachedRunner() }); await f.configure();
  await f.control.submit(f.command('cancel', { command: 'sleep 30 & printf "%s" "$!"; wait' }));
  const running = await until(() => f.control.inspect({ id: 'cancel' }), item => /^\d+$/.test(item.output));
  const descendantPid = Number(running.output);
  const cancelStart = Date.now(); const receipt = await f.control.cancel({ id: 'cancel' });
  assert.ok(Date.now() - cancelStart < 1000); assert.equal(receipt.job.status, 'cancelling');
  const cancelled = await until(() => f.control.inspect({ id: 'cancel' }), item => item.eof); assert.equal(cancelled.job.status, 'cancelled');
  const statPath = `/proc/${descendantPid}/stat`;
  assert.ok(!fs.existsSync(statPath) || fs.readFileSync(statPath, 'utf8').split(') ')[1].startsWith('Z '), 'descendant must have exited');
  const repeated = spawnSync(process.execPath, [runnerFile, path.join(f.directory, 'host-control', 'jobs', hash('cancel'))], { encoding: 'utf8' });
  assert.equal(repeated.status, 1); assert.ok(repeated.stderr.includes('could not start safely'));
});

test('killing the runner preserves detached-child capacity and no EOF until verified managed cancellation', async t => {
  const f = setup(t, { runner: detachedRunner(), maxConcurrent: 1 }); await f.configure();
  await f.control.submit(f.command('orphan', { command: 'sleep 30 & echo "$!"; wait' }));
  const jobDir = path.join(f.directory, 'host-control', 'jobs', hash('orphan'));
  await until(() => f.control.inspect({ id: 'orphan' }), item => item.output.trim().length > 0);
  const metadata = readJson(path.join(jobDir, 'runner.json'), 2048);
  t.after(() => { try { process.kill(-metadata.childPid, 'SIGKILL'); } catch {} });
  process.kill(metadata.pid, 'SIGKILL');
  const orphan = await until(() => f.control.inspect({ id: 'orphan' }), item => item.job.reason === 'runner_missing_child_active');
  assert.equal(orphan.job.status, 'uncertain'); assert.equal(orphan.eof, false); assert.equal(orphan.job.finishedAt, null);
  assert.doesNotThrow(() => process.kill(metadata.childPid, 0), 'detached bash is still present after runner death');
  await rejectCode(f.control.submit(f.command('second')), 'HOST_CAPACITY');
  await f.control.close(); const restarted = f.restart();
  assert.equal((await restarted.inspect({ id: 'orphan' })).eof, false);
  await rejectCode(restarted.submit(f.command('second')), 'HOST_CAPACITY');
  await restarted.cancel({ id: 'orphan' });
  const cancelled = await until(() => restarted.inspect({ id: 'orphan' }), item => item.eof, 7000);
  assert.equal(cancelled.job.status, 'cancelled');
  assert.ok(!fs.existsSync(`/proc/${metadata.childPid}/stat`) || fs.readFileSync(`/proc/${metadata.childPid}/stat`, 'utf8').split(') ')[1].startsWith('Z '));
  await restarted.submit(f.command('second'));
  assert.equal((await until(() => restarted.inspect({ id: 'second' }), item => item.eof)).job.status, 'completed');
});

const tmuxPath = process.env.DAFTAR_TEST_TMUX ?? '/usr/bin/tmux';
const realTmux = fs.existsSync(tmuxPath);
test('real tmux: close/reopen survival, literal shell syntax, cancellation, and unrelated session preservation', async t => {
  if (!realTmux) { if (process.env.DAFTAR_REQUIRE_TMUX === '1') assert.fail('Real tmux is required but unavailable'); t.skip('tmux executable is unavailable'); return; }
  const f = setup(t, { runner: undefined, tmuxPath });
  // setup's mock runner is intentionally overridden for this acceptance test.
  await f.configure();
  const socket = `daftar-${hash(path.join(f.directory, 'host-control')).slice(0, 24)}`;
  const unrelated = spawnSync(tmuxPath, ['-L', socket, 'new-session', '-d', '-s', 'unrelated', 'sleep', '30'], { encoding: 'utf8' });
  if (unrelated.status !== 0 && process.env.DAFTAR_REQUIRE_TMUX !== '1' && /Operation not permitted/.test(unrelated.stderr)) {
    t.skip('Environment prohibits Unix sockets (tmux launch EPERM); DAFTAR_REQUIRE_TMUX=1 makes this a failure'); return;
  }
  assert.equal(unrelated.status, 0, unrelated.stderr);
  t.after(() => spawnSync(tmuxPath, ['-L', socket, 'kill-session', '-t', '=unrelated']));
  await f.control.submit(f.command('tmux-survive', { command: 'sleep .3; printf "%s" "literal ; $(printf substituted)"' }));
  await f.control.close(); const restarted = f.restart();
  const done = await until(() => restarted.inspect({ id: 'tmux-survive' }), item => item.eof);
  assert.equal(done.job.status, 'completed'); assert.equal(done.output, 'literal ; substituted');
  await restarted.submit(f.command('tmux-cancel', { command: 'sleep 30 & echo "$!"; wait' }));
  await until(() => restarted.inspect({ id: 'tmux-cancel' }), item => item.output.trim().length > 0);
  await restarted.cancel({ id: 'tmux-cancel' });
  assert.equal((await until(() => restarted.inspect({ id: 'tmux-cancel' }), item => item.eof)).job.status, 'cancelled');
  assert.equal((await restarted.stopAll()).host.mode, 'off');
  assert.equal(spawnSync(tmuxPath, ['-L', socket, 'has-session', '-t', '=unrelated']).status, 0);
});
