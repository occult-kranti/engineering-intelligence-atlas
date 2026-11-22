/** Trusted-owner SSH/tmux control. Public routes MUST authenticate the owner.
 * Company and employee selectors are attribution, not user authentication.
 * Root in a rented container controls that container, not the provider host.
 * Grants and log redaction cannot isolate hostile root commands. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { atomicJson, exact, fail, hash, HostControlError, integer, LIMITS, LIVE, object, privateDirectory,
  processIdentity, publicJob, readJson, readPrivate, request, safeEnvironment, STATES, TERMINAL, validId, validResult } from './host-control-contract.mjs';
export { HostControlError } from './host-control-contract.mjs';

const exec = promisify(execFile);
const runnerFile = fileURLToPath(new URL('./host-job-runner.mjs', import.meta.url));
const now = () => new Date().toISOString();
const unresolved = job => LIVE.has(job.status) || ['uncertain', 'interrupted'].includes(job.status);
const provenTerminal = job => TERMINAL.has(job.status) && !['uncertain', 'interrupted'].includes(job.status);
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

// A tmux session/runner disappearing says nothing about its detached command.
// Only /proc evidence or a runner result can establish process termination.
function matchingProcessState(pid, identity) {
  if (!Number.isInteger(pid) || pid < 2 || typeof identity !== 'string') return 'unknown';
  const current = processIdentity(pid);
  if (current && current !== identity) return 'gone';
  try {
    const stat = fs.readFileSync(`/proc/${pid}/stat`, 'utf8');
    return ['Z', 'X'].includes(stat.slice(stat.lastIndexOf(')') + 2).split(' ')[0]) ? 'gone' : current === identity ? 'alive' : 'unknown';
  } catch (error) { return error.code === 'ENOENT' ? 'gone' : 'unknown'; }
}
function commandGroupState(metadata, nonce) {
  if (metadata?.nonce !== nonce || !Number.isInteger(metadata.childPid) || metadata.childPid < 2 || !metadata.childIdentity) return 'unknown';
  const pid = metadata.childPid;
  try { process.kill(-pid, 0); } catch (error) { return error.code === 'ESRCH' ? 'gone' : 'unknown'; }
  const current = processIdentity(pid);
  // Do not attribute a reused leader PID to an old command.
  if (current && current !== metadata.childIdentity) return 'unknown';
  let entries; try { entries = fs.readdirSync('/proc').filter(entry => /^\d+$/.test(entry)); } catch { return 'unknown'; }
  if (entries.length > 65536) return 'unknown';
  let found = false; let incomplete = false;
  for (const entry of entries) {
    try {
      const stat = fs.readFileSync(`/proc/${entry}/stat`, 'utf8');
      const fields = stat.slice(stat.lastIndexOf(')') + 2).split(' ');
      if (Number(fields[2]) === pid) { found = true; if (!['Z', 'X'].includes(fields[0])) return 'alive'; }
    } catch (error) { if (error.code !== 'ENOENT' && error.code !== 'ESRCH') incomplete = true; }
  }
  // Unreaped zombies cannot execute. Unknown or unreadable membership reserves
  // capacity rather than assuming that detached descendants are gone.
  if (found && !incomplete) return 'gone';
  try { process.kill(-pid, 0); } catch (error) { if (error.code === 'ESRCH') return 'gone'; }
  return 'unknown';
}
function tmuxRunner(directory, tmuxPath) {
  const socket = `daftar-${hash(directory).slice(0, 24)}`;
  const run = args => exec(tmuxPath, ['-L', socket, ...args], { env: safeEnvironment(), shell: false, timeout: args[0] === 'new-session' ? 10000 : 1500, maxBuffer: 16384 });
  return {
    async available() { try { await run(['-V']); return true; } catch { return false; } },
    async launch({ session, jobDir, cwd }) { await run(['new-session', '-d', '-s', session, '-c', cwd, '--', process.execPath, runnerFile, jobDir]); },
    async isAlive(session) { try { await run(['has-session', '-t', `=${session}`]); return true; } catch (error) { if (error.code === 1) return false; throw error; } },
    async terminate(session) { try { await run(['kill-session', '-t', `=${session}`]); } catch (error) { if (error.code !== 1) throw error; } }
  };
}

function validateRegistry(value) {
  if (!object(value) || value.version !== 1 || !Number.isSafeInteger(value.revision) || value.revision < 0
    || !['off', 'manual', 'auto'].includes(value.mode) || !Array.isArray(value.grants) || value.grants.length > LIMITS.grants
    || !Array.isArray(value.jobs) || value.jobs.length > LIMITS.jobs) fail('HOST_STATE_INVALID', 'Command-control registry is malformed.', 503);
  const ids = new Set();
  for (const grant of value.grants) {
    if (!object(grant) || !validId(grant.id) || !validId(grant.companyId) || !(grant.employeeId === null || validId(grant.employeeId)) || ids.has(grant.id)) {
      fail('HOST_STATE_INVALID', 'Command-control grant registry is malformed.', 503);
    }
    ids.add(grant.id);
  }
  ids.clear();
  for (const job of value.jobs) {
    if (!object(job) || ![job.id, job.companyId, job.employeeId].every(validId) || ids.has(job.id) || !STATES.has(job.status)
      || ![job.requestHash, job.commandHash, job.nonce].every(h => typeof h === 'string' && /^[a-f0-9]{64}$/.test(h))
      || job.tmuxSession !== `job-${hash(job.id).slice(0, 32)}` || !Number.isInteger(job.timeoutSeconds) || job.timeoutSeconds < 1 || job.timeoutSeconds > LIMITS.timeoutSeconds
      || !Number.isInteger(job.maxOutputBytes) || job.maxOutputBytes < 1 || job.maxOutputBytes > LIMITS.outputBytes) fail('HOST_STATE_INVALID', 'Command-control job registry is malformed.', 503);
    ids.add(job.id);
  }
  return value;
}

function checkScope(snapshot, companyId, employeeId = null) {
  const company = snapshot.companies.find(item => item.id === companyId && item.status === 'active');
  if (!company) fail('HOST_SCOPE_DENIED', 'The selected company is unavailable or inactive.', 403);
  if (employeeId === null) return;
  const employee = snapshot.employees.find(item => item.id === employeeId && item.status === 'active');
  if (!employee) fail('HOST_SCOPE_DENIED', 'The selected employee is unavailable or inactive.', 403);
  const liveOffice = (id, scope) => !id || (snapshot.offices ?? []).some(item => item.id === id && item.companyId === scope && item.status === 'active');
  const liveDepartment = (id, scope) => !id || (snapshot.departments ?? []).some(item => item.id === id && item.companyId === scope && item.status === 'active');
  if (!liveOffice(employee.officeId, employee.companyId ?? companyId) || !liveDepartment(employee.departmentId, employee.companyId ?? companyId)) {
    fail('HOST_SCOPE_DENIED', 'The selected employee location is unavailable or inactive.', 403);
  }
  if (employee.companyId === companyId || (employee.companyId === null && company.assistantId === employeeId)) return;
  const portfolio = snapshot.portfolio;
  if (portfolio?.contracts?.some(contract => contract.recipientCompanyId === companyId && contract.status === 'active'
    && contract.employeeIds?.includes(employeeId) && liveOffice(contract.recipientOfficeId, companyId) && liveDepartment(contract.recipientDepartmentId, companyId)
    && portfolio.services?.some(service => service.id === contract.serviceId && service.status === 'active' && service.companyId === employee.companyId
      && service.employeeIds?.includes(employeeId) && snapshot.companies.some(provider => provider.id === service.companyId && provider.status === 'active')
      && liveOffice(service.officeId, service.companyId) && liveDepartment(service.departmentId, service.companyId)))) return;
  fail('HOST_SCOPE_DENIED', 'An active shared-service contract is required for this employee.', 403);
}

export function createHostControl({ stateDir, enabled = false, snapshot, runner: injectedRunner, maxConcurrent = 2, tmuxPath = 'tmux' } = {}) {
  integer(maxConcurrent, 1, 8, 'Concurrency');
  if (typeof stateDir !== 'string' || !stateDir || typeof snapshot !== 'function') fail('HOST_INPUT_INVALID', 'A state directory and native snapshot callback are required.');
  const directory = path.join(path.resolve(stateDir), 'host-control');
  const jobsDirectory = path.join(directory, 'jobs');
  const registryPath = path.join(directory, 'registry.json');
  const lockPath = path.join(directory, 'owner.lock');
  const runner = injectedRunner ?? tmuxRunner(directory, tmuxPath);
  let registry = { version: 1, revision: 0, mode: 'off', grants: [], jobs: [] };
  let closed = false; let fenced = false; let chain = Promise.resolve(); let lockNonce;
  const fence = () => { fenced = true; fail('HOST_STATE_UNCERTAIN', 'A persistent write has an uncertain outcome. Close and reopen the command controller to reconcile before further operations.', 503); };
  const writeState = (filename, value) => {
    if (fenced) fence();
    try { atomicJson(filename, value); } catch { fence(); }
  };
  const persist = () => writeState(registryPath, registry);
  const jobDirectory = job => path.join(jobsDirectory, hash(job.id));
  if (enabled) {
    try {
      fs.mkdirSync(path.resolve(stateDir), { recursive: true, mode: 0o700 });
      privateDirectory(path.resolve(stateDir)); privateDirectory(directory, true); privateDirectory(jobsDirectory, true);
      lockNonce = crypto.randomUUID();
      const owner = { pid: process.pid, identity: processIdentity(process.pid), nonce: lockNonce };
      const acquire = () => fs.writeFileSync(lockPath, JSON.stringify(owner), { flag: 'wx', mode: 0o600 });
      try { acquire(); }
      catch (error) {
        if (error.code !== 'EEXIST') throw error;
        const old = readJson(lockPath, 1024);
        if (!object(old) || !Number.isInteger(old.pid) || old.pid < 1) fail('HOST_BUSY', 'Inspect the command-control owner lock locally.', 503);
        const identity = processIdentity(old.pid);
        let alive = true;
        try { process.kill(old.pid, 0); } catch (error) { if (error.code === 'ESRCH') alive = false; }
        if (alive && (!identity || !old.identity || identity === old.identity)) fail('HOST_BUSY', 'Another command controller owns this state directory.', 503);
        fs.unlinkSync(lockPath); acquire();
      }
      registry = validateRegistry(readJson(registryPath, LIMITS.registryBytes, true) ?? registry);
      persist();
    } catch (error) {
      try { if (readJson(lockPath, 1024, true)?.nonce === lockNonce) fs.unlinkSync(lockPath); } catch {}
      if (error instanceof HostControlError) throw error;
      fail('HOST_STATE_INVALID', 'Command-control storage could not be initialized.', 503);
    }
  }
  const serial = operation => {
    const pending = chain.then(async () => {
      if (closed) fail('HOST_CLOSED', 'The command controller is closed.', 503);
      if (fenced) fence();
      try { return await operation(); }
      catch (error) { if (error instanceof HostControlError) throw error; fail('HOST_CONTROL_FAILED', 'Command-control operation failed; inspect the host locally.', 503); }
    });
    chain = pending.catch(() => undefined); return pending;
  };
  const requireEnabled = () => { if (!enabled) fail('HOST_DISABLED', 'Enable DAFTAR_HOST_CONTROL on the runtime host first.', 403); };
  const native = async () => {
    let result; try { result = await snapshot(); } catch { fail('HOST_SCOPE_UNAVAILABLE', 'Fresh native company state is unavailable.', 503); }
    const value = result?.ok === true ? result.snapshot : result;
    if (!object(value) || !Array.isArray(value.companies) || !Array.isArray(value.employees)) fail('HOST_SCOPE_UNAVAILABLE', 'Fresh native company state is unavailable.', 503);
    return value;
  };
  const authorized = async job => {
    if (registry.mode === 'off') fail('HOST_POLICY_OFF', 'Host command control is switched off.', 403);
    checkScope(await native(), job.companyId, job.employeeId);
    if (!registry.grants.some(grant => grant.companyId === job.companyId && (grant.employeeId === null || grant.employeeId === job.employeeId))) {
      fail('HOST_GRANT_REQUIRED', 'An explicit company or employee command-control grant is required.', 403);
    }
  };
  const lookup = input => {
    exact(input, ['id']); if (!validId(input.id)) fail('HOST_INPUT_INVALID', 'A valid job ID is required.');
    const job = registry.jobs.find(item => item.id === input.id);
    if (!job) fail('HOST_JOB_NOT_FOUND', 'The requested command job was not found.', 404);
    return job;
  };
  const refresh = async () => {
    if (!enabled) return;
    let changed = false;
    for (const job of registry.jobs) {
      if (!unresolved(job)) continue;
      const dir = jobDirectory(job); privateDirectory(dir);
      const result = readJson(path.join(dir, 'result.json'), 4096, true);
      if (result) {
        if (!validResult(result, job.nonce) || result.outputBytes > job.maxOutputBytes) fail('HOST_STATE_INVALID', 'A command job result is malformed.', 503);
        Object.assign(job, { status: result.status, exitCode: result.exitCode, reason: result.reason,
          startedAt: result.startedAt, finishedAt: result.finishedAt, outputBytes: result.outputBytes }); changed = true; continue;
      }
      const metadata = readJson(path.join(dir, 'runner.json'), 2048, true);
      if (metadata?.nonce === job.nonce && typeof metadata.startedAt === 'string' && job.startedAt !== metadata.startedAt) { job.startedAt = metadata.startedAt; changed = true; }
      let alive; try { alive = await runner.isAlive(job.tmuxSession); } catch { continue; }
      const runnerGone = metadata?.nonce === job.nonce && matchingProcessState(metadata.pid, metadata.identity) === 'gone';
      if (!alive || runnerGone) {
        const group = commandGroupState(metadata, job.nonce);
        const status = group === 'alive' ? 'uncertain' : 'interrupted';
        const reason = group === 'alive' ? 'runner_missing_child_active' : 'runner_missing_outcome_unknown';
        if (job.status !== status || job.reason !== reason || job.finishedAt !== null) {
          job.status = status; job.reason = reason; job.finishedAt = null; changed = true;
        }
      }
    }
    if (changed) persist();
  };
  const statusView = async (reconcile = true) => {
    if (reconcile) await refresh(); let available = false;
    if (enabled) { try { available = Boolean(await runner.available()); } catch {} }
    return { ok: true, host: { configured: Boolean(enabled), available, mode: registry.mode, revision: registry.revision,
      grants: structuredClone(registry.grants), jobCount: registry.jobs.length, jobs: registry.jobs.map(publicJob), limits: { ...LIMITS, maxConcurrent },
      capabilities: { detached: true, tmux: true, manualApproval: true, inspectOutput: true, cancellation: true,
        availabilityCheck: 'tmux-version-only', launchVerified: registry.jobs.some(job => job.startedAt !== null),
        secureTenancy: false, operatingSystemUser: typeof process.getuid === 'function' ? process.getuid() : null,
        trustBoundary: 'Authenticated owner commands run as the runtime OS user; attribution is not an OS sandbox.' } } };
  };
  const dispatch = async job => {
    await authorized(job);
    if (!(await runner.available())) fail('HOST_TMUX_UNAVAILABLE', 'tmux is unavailable on the runtime host.', 503);
    if (registry.jobs.filter(item => unresolved(item) && item.id !== job.id).length >= maxConcurrent) fail('HOST_CAPACITY', 'The concurrent host-command limit has been reached.', 409);
    const dir = jobDirectory(job); privateDirectory(dir);
    const spec = readJson(path.join(dir, 'spec.json'), LIMITS.commandBytes + 16384);
    if (spec?.nonce !== job.nonce || spec.requestHash !== job.requestHash || hash(JSON.stringify(request(spec.request))) !== job.requestHash) fail('HOST_STATE_INVALID', 'The stored command job does not match its receipt.', 503);
    let cwd; try { cwd = fs.realpathSync(spec.request.cwd); if (!fs.statSync(cwd).isDirectory()) throw new Error(); } catch { fail('HOST_CWD_UNAVAILABLE', 'The command working directory is unavailable.', 400); }
    job.status = 'launching'; persist();
    try {
      await runner.launch({ session: job.tmuxSession, jobDir: dir, cwd });
    } catch {
      // A lost tmux response is not proof of failure. Preserve receipt; never retry.
      job.status = 'uncertain'; job.reason = 'launch_outcome_unknown'; persist(); return;
    }
    job.status = 'running'; persist();
  };
  const finishCancellation = async job => {
    await refresh();
    if (TERMINAL.has(job.status) && !['uncertain', 'interrupted'].includes(job.status)) return;
    const dir = jobDirectory(job); privateDirectory(dir);
    const metadata = readJson(path.join(dir, 'runner.json'), 2048, true);
    if (metadata?.nonce === job.nonce && Number.isInteger(metadata.childPid) && metadata.childPid > 1
      && metadata.childIdentity && processIdentity(metadata.childPid) === metadata.childIdentity) {
      try { process.kill(-metadata.childPid, 'SIGKILL'); } catch (error) { if (error.code !== 'ESRCH') throw error; }
    }
    await runner.terminate?.(job.tmuxSession); await refresh();
    if (provenTerminal(job)) return;
    // Once this controller performed managed cancellation, prove the original
    // group and its runner are no longer executing before releasing capacity.
    for (let attempt = 0; attempt < 10; attempt++) {
      let alive; try { alive = await runner.isAlive(job.tmuxSession); } catch { break; }
      if (!alive && metadata?.nonce === job.nonce && matchingProcessState(metadata.pid, metadata.identity) === 'gone'
        && commandGroupState(metadata, job.nonce) === 'gone') {
        const output = readPrivate(path.join(dir, 'output.log'), job.maxOutputBytes, true) ?? Buffer.alloc(0);
        writeState(path.join(dir, 'result.json'), { version: 1, nonce: job.nonce, status: 'cancelled', exitCode: null,
          reason: 'cancelled', startedAt: job.startedAt ?? now(), finishedAt: now(), outputBytes: output.length });
        await refresh(); return;
      }
      await delay(50);
    }
    job.status = 'uncertain'; job.reason = 'cancellation_unconfirmed'; job.finishedAt = null; persist();
  };
  const cancelJob = async job => {
    if (job.status === 'pending_approval') { job.status = 'cancelled'; job.reason = 'cancelled'; job.finishedAt = now(); persist(); return; }
    if (TERMINAL.has(job.status) && !['uncertain', 'interrupted'].includes(job.status)) return;
    const dir = jobDirectory(job); privateDirectory(dir);
    writeState(path.join(dir, 'cancel.json'), { nonce: job.nonce });
    job.status = 'cancelling'; persist();
    // Durable receipt returns immediately. The independent runner notices this
    // marker even if HTTP/SSH/controller disconnects before cleanup finishes.
    if (runner.cancel) await runner.cancel({ session: job.tmuxSession, jobDir: dir });
    // Fallback only targets our exact tmux session and a matching child identity.
    // Never globally kill tmux or process names. Hostile daemon escapes are outside
    // the owner-trust boundary; an unverifiable cancellation stays uncertain.
    const timer = setTimeout(() => {
      if (!closed) serial(() => finishCancellation(job)).catch(() => {});
    }, 1800);
    timer.unref();
  };
  return {
    status: () => serial(statusView),
    configure: input => serial(async () => {
      requireEnabled(); exact(input, ['expectedRevision', 'mode', 'grants']);
      integer(input.expectedRevision, 0, Number.MAX_SAFE_INTEGER - 1, 'Revision');
      if (input.expectedRevision !== registry.revision) fail('HOST_REVISION_CONFLICT', 'Command-control policy changed; read its current revision first.', 409);
      if (!['off', 'manual', 'auto'].includes(input.mode) || !Array.isArray(input.grants) || input.grants.length > LIMITS.grants) fail('HOST_INPUT_INVALID', 'A mode and complete explicit grant list are required.');
      const ids = new Set(); const grants = [];
      for (const grant of input.grants) {
        exact(grant, ['id', 'companyId', 'employeeId']);
        if (!validId(grant.id) || !validId(grant.companyId) || !(grant.employeeId === null || validId(grant.employeeId)) || ids.has(grant.id)) fail('HOST_INPUT_INVALID', 'Grant IDs must be unique and explicitly identify their scope.');
        ids.add(grant.id); grants.push({ id: grant.id, companyId: grant.companyId, employeeId: grant.employeeId });
      }
      // Turning off and revoking stale scopes must always remain possible. Verify
      // only new/changed grants; retained revoked scopes cannot dispatch anyway.
      const additions = grants.filter(grant => !registry.grants.some(old => JSON.stringify(old) === JSON.stringify(grant)));
      if (additions.length) { const current = await native(); for (const grant of additions) checkScope(current, grant.companyId, grant.employeeId); }
      registry.mode = input.mode; registry.grants = grants; registry.revision++; persist(); return statusView();
    }),
    submit: input => serial(async () => {
      requireEnabled(); const normalized = request(input); const requestHash = hash(JSON.stringify(normalized));
      await refresh(); const previous = registry.jobs.find(item => item.id === normalized.id);
      if (previous) {
        if (previous.requestHash !== requestHash) fail('HOST_IDEMPOTENCY_CONFLICT', 'This job ID already belongs to a different command request.', 409);
        return { ok: true, id: previous.id, replayed: true, job: publicJob(previous) };
      }
      await authorized(normalized);
      if (registry.jobs.length >= LIMITS.jobs) fail('HOST_JOB_LIMIT', 'The durable command receipt limit is full; archive it locally before adding jobs.', 409);
      if (!(await runner.available())) fail('HOST_TMUX_UNAVAILABLE', 'tmux is unavailable on the runtime host.', 503);
      if (registry.mode === 'auto' && registry.jobs.filter(unresolved).length >= maxConcurrent) fail('HOST_CAPACITY', 'The concurrent host-command limit has been reached.', 409);
      try { if (!fs.statSync(normalized.cwd).isDirectory()) throw new Error(); } catch { fail('HOST_CWD_UNAVAILABLE', 'The command working directory is unavailable.'); }
      const job = { id: normalized.id, companyId: normalized.companyId, employeeId: normalized.employeeId, requestHash, commandHash: hash(normalized.command),
        nonce: crypto.randomBytes(32).toString('hex'), status: 'pending_approval', createdAt: now(), startedAt: null, finishedAt: null,
        exitCode: null, reason: null, timeoutSeconds: normalized.timeoutSeconds, maxOutputBytes: normalized.maxOutputBytes, outputBytes: 0,
        tmuxSession: `job-${hash(normalized.id).slice(0, 32)}` };
      const dir = jobDirectory(job);
      // An orphan directory may contain an unrecorded launch. Do not overwrite it.
      try { fs.mkdirSync(dir, { mode: 0o700 }); } catch (error) {
        if (error.code !== 'EEXIST') fence();
        fail('HOST_STATE_INVALID', 'An existing job directory needs local review; the job was not launched.', 503);
      }
      writeState(path.join(dir, 'spec.json'), { version: 1, nonce: job.nonce, requestHash, request: normalized });
      registry.jobs.push(job); persist();
      if (registry.mode === 'auto') await dispatch(job);
      return { ok: true, id: job.id, replayed: false, job: publicJob(job) };
    }),
    approve: input => serial(async () => {
      requireEnabled(); await refresh(); const job = lookup(input);
      if (job.status !== 'pending_approval') return { ok: true, id: job.id, replayed: true, job: publicJob(job) };
      await dispatch(job); return { ok: true, id: job.id, replayed: false, job: publicJob(job) };
    }),
    cancel: input => serial(async () => {
      requireEnabled(); await refresh(); const job = lookup(input); await cancelJob(job); return { ok: true, id: job.id, job: publicJob(job) };
    }),
    inspect: input => serial(async () => {
      requireEnabled(); exact(input, ['id', 'offset']); const offset = integer(input.offset ?? 0, 0, LIMITS.outputBytes, 'Output offset');
      await refresh(); const job = lookup({ id: input.id }); const dir = jobDirectory(job); privateDirectory(dir);
      const buffer = readPrivate(path.join(dir, 'output.log'), job.maxOutputBytes, true) ?? Buffer.alloc(0);
      const nextOffset = Math.max(offset, Math.min(offset + LIMITS.inspectBytes, buffer.length));
      // Best-effort common token redaction is not a substitute for owner access.
      const output = buffer.subarray(Math.min(offset, buffer.length), nextOffset).toString('utf8')
        .replace(/\b(?:sk-[A-Za-z0-9_-]{12,}|gh[pousr]_[A-Za-z0-9_]{12,}|github_pat_[A-Za-z0-9_]{12,})\b/g, '[REDACTED]')
        .replace(/(authorization\s*:\s*bearer\s+)[^\s]+/gi, '$1[REDACTED]');
      return { ok: true, id: job.id, job: { ...publicJob(job), outputBytes: buffer.length }, output, offset, nextOffset, eof: provenTerminal(job) && nextOffset >= buffer.length,
        truncated: job.status === 'output_limit' || nextOffset < buffer.length };
    }),
    stopAll: () => serial(async () => {
      requireEnabled(); registry.mode = 'off'; registry.revision++; persist();
      for (const job of registry.jobs) if (job.status === 'pending_approval' || LIVE.has(job.status) || ['uncertain', 'interrupted'].includes(job.status)) await cancelJob(job);
      return statusView(false);
    }),
    close: () => {
      const pending = chain.then(() => {
        if (closed) return; closed = true;
        if (enabled && readJson(lockPath, 1024, true)?.nonce === lockNonce) fs.unlinkSync(lockPath);
      });
      chain = pending.catch(() => undefined); return pending;
    }
  };
}
