/** Managed Python entry points always use a verified private virtual environment.
 * Python source remains owner-trusted code; this is dependency isolation, not a
 * hostile-code sandbox. System shell commands belong to explicit host-control. */
import fs from 'node:fs';
import path from 'node:path';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { atomicJson, hash, object, privateDirectory, readJson, safeEnvironment } from './host-control-contract.mjs';
import { assertActor, createPrivateRegistry, nativeSnapshot } from './model-resources-contract.mjs';
import { ENVIRONMENT_LIMITS, ManagedEnvironmentError, environmentFail as fail, validateEnvironmentOperation } from './managed-environments-contract.mjs';
export { ManagedEnvironmentError } from './managed-environments-contract.mjs';

const exec = promisify(execFile); const self = fileURLToPath(import.meta.url); const now = () => new Date().toISOString();
const quote = value => `'${value.replaceAll("'", "'\\''")}'`;
const terminal = new Set(['completed', 'failed', 'cancelled', 'timed_out', 'output_limit']);
const managedEnv = directory => ({ ...safeEnvironment(), VIRTUAL_ENV: directory, PATH: `${path.join(directory, 'bin')}:${safeEnvironment().PATH}`, PIP_REQUIRE_VIRTUALENV: 'true', PYTHONNOUSERSITE: '1' });
const proofSource = 'import json,os,site,sys; print(json.dumps({"prefix":os.path.realpath(sys.prefix),"basePrefix":os.path.realpath(sys.base_prefix),"executable":os.path.abspath(sys.executable),"version":list(sys.version_info[:3]),"isolated":sys.flags.isolated==1,"userSiteEnabled":site.ENABLE_USER_SITE,"systemSitePackages":any(os.path.realpath(p) in [os.path.realpath(s) for s in sys.path] for p in site.getsitepackages([sys.base_prefix]))}))';
async function verifyEnvironment(directory, expected) {
  privateDirectory(directory); privateDirectory(path.join(directory, 'bin'));
  const config = path.join(directory, 'pyvenv.cfg'); const configStat = fs.lstatSync(config);
  if (!configStat.isFile() || configStat.isSymbolicLink() || configStat.size > 16384) fail('ENVIRONMENT_INVALID', 'The virtual environment configuration is invalid.', 409);
  // -I disables user sites and PYTHON* variables, but it does not override a
  // pyvenv.cfg that opts into the base interpreter's site-packages.
  const configBytes = fs.readFileSync(config);
  const siteOptions = configBytes.toString('utf8').split(/\r?\n/).filter(line => /^\s*include-system-site-packages\s*=/i.test(line));
  if (siteOptions.length !== 1 || !/^\s*include-system-site-packages\s*=\s*false\s*$/i.test(siteOptions[0])) fail('ENVIRONMENT_INVALID', 'The virtual environment must exclude system site-packages.', 409);
  const configurationSha256 = hash(configBytes);
  // Older receipts did not pin pyvenv.cfg. Recheck their isolation each time;
  // newly prepared environments also bind the exact configuration bytes.
  if (expected?.configurationSha256 !== undefined && expected.configurationSha256 !== configurationSha256) fail('ENVIRONMENT_CHANGED', 'The virtual environment configuration changed; prepare a new environment.', 409);
  const python = path.join(directory, 'bin', 'python'); const pythonStat = fs.lstatSync(python);
  if (!pythonStat.isFile() || pythonStat.isSymbolicLink() || pythonStat.size > 64 * 1024 * 1024) fail('ENVIRONMENT_INVALID', 'A copied private virtual environment interpreter is required.', 409);
  const interpreterSha256 = hash(fs.readFileSync(python));
  if (expected && expected.interpreterSha256 !== interpreterSha256) fail('ENVIRONMENT_CHANGED', 'The virtual environment interpreter changed; prepare a new environment.', 409);
  let result; try { result = await exec(python, ['-I', '-c', proofSource], { env: managedEnv(directory), shell: false, timeout: 10000, maxBuffer: 8192 }); }
  catch { fail('ENVIRONMENT_INVALID', 'The virtual environment interpreter could not be verified.', 409); }
  let proof; try { proof = JSON.parse(result.stdout); } catch { fail('ENVIRONMENT_INVALID', 'The virtual environment proof is invalid.', 409); }
  const real = fs.realpathSync(directory);
  if (!object(proof) || proof.prefix !== real || proof.basePrefix === real || proof.executable !== python || !Array.isArray(proof.version)
    || proof.isolated !== true || proof.userSiteEnabled !== false || proof.systemSitePackages !== false) fail('ENVIRONMENT_INVALID', 'Python is not executing inside the expected isolated virtual environment.', 409);
  if (expected && (expected.prefix !== proof.prefix || expected.basePrefix !== proof.basePrefix || JSON.stringify(expected.version) !== JSON.stringify(proof.version))) fail('ENVIRONMENT_CHANGED', 'The virtual environment identity changed.', 409);
  return { ...proof, interpreterSha256, configurationSha256 };
}
function validateState(value) {
  if (!object(value) || value.version !== 1 || !Array.isArray(value.environments) || value.environments.length > ENVIRONMENT_LIMITS.environments || !Array.isArray(value.jobs) || value.jobs.length > ENVIRONMENT_LIMITS.receipts) fail('ENVIRONMENT_STATE_INVALID', 'The environment registry is malformed.', 503);
  for (const list of [value.environments, value.jobs]) if (list.some(item => !object(item) || typeof item.id !== 'string') || new Set(list.map(item => item.id)).size !== list.length) fail('ENVIRONMENT_STATE_INVALID', 'Environment receipt identities are malformed.', 503);
  for (const job of value.jobs) if (!/^[a-f0-9]{64}$/.test(job.requestHash) || !['prepare', 'run'].includes(job.kind)) fail('ENVIRONMENT_STATE_INVALID', 'An environment job receipt is malformed.', 503);
}
const environmentView = environment => ({ id: environment.id, companyId: environment.companyId, stewardEmployeeId: environment.employeeId,
  state: environment.state, createdAt: environment.createdAt, verifiedAt: environment.verifiedAt ?? null,
  pythonVersion: environment.proof?.version ?? null, interpreterSha256: environment.proof?.interpreterSha256 ?? null,
  configurationSha256: environment.proof?.configurationSha256 ?? null, reason: environment.reason ?? null });
const jobView = job => ({ id: job.id, kind: job.kind, companyId: job.companyId, employeeId: job.employeeId, environmentId: job.environmentId,
  hostJobId: job.hostJobId, state: job.state, createdAt: job.createdAt, reason: job.reason ?? null });

export function createManagedEnvironments({ stateDir, hostControl, snapshot, pythonPath = '/usr/bin/python3' } = {}) {
  if (typeof stateDir !== 'string' || typeof snapshot !== 'function' || typeof hostControl?.submit !== 'function' || typeof hostControl?.inspect !== 'function') fail('ENVIRONMENT_INPUT_INVALID', 'State, native snapshot and host-control adapters are required.');
  if (typeof pythonPath !== 'string' || !path.isAbsolute(pythonPath) || /[\x00-\x1f\x7f]/.test(pythonPath)) fail('ENVIRONMENT_INPUT_INVALID', 'The bootstrap Python executable must be an absolute host configuration path.');
  const store = createPrivateRegistry({ stateDir, name: 'managed-environments', initial: { version: 1, environments: [], jobs: [] }, validate: validateState, fail, ErrorType: ManagedEnvironmentError });
  const environmentsDir = path.join(store.directory, 'environments'); const jobsDir = path.join(store.directory, 'jobs');
  try { privateDirectory(environmentsDir, true); privateDirectory(jobsDir, true); } catch { store.close().catch(() => {}); fail('ENVIRONMENT_STATE_INVALID', 'Private environment storage is unavailable.', 503); }
  const environmentPath = id => path.join(environmentsDir, hash(id));
  const native = () => nativeSnapshot(snapshot, fail);
  const actor = async input => assertActor(await native(), input.companyId, input.employeeId, undefined, fail);
  const findEnvironment = id => { const environment = store.value.environments.find(item => item.id === id); if (!environment) fail('ENVIRONMENT_NOT_FOUND', 'The managed environment was not found.', 404); return environment; };
  const refresh = async id => {
    const job = store.value.jobs.find(item => item.id === id); if (!job) fail('ENVIRONMENT_JOB_NOT_FOUND', 'The managed job was not found.', 404);
    let response;
    try { response = await hostControl.inspect({ id: job.hostJobId }); }
    catch (error) { if (error?.code !== 'HOST_JOB_NOT_FOUND') throw error; return null; }
    const hostJob = response?.job;
    if (!hostJob || hostJob.id !== job.hostJobId || hostJob.companyId !== job.companyId || hostJob.employeeId !== job.employeeId || hostJob.commandHash !== job.hostCommandHash) fail('ENVIRONMENT_HOST_CONFLICT', 'The host receipt does not match this managed job.', 409);
    let proof; let proofError;
    if (job.kind === 'prepare' && hostJob.status === 'completed' && findEnvironment(job.environmentId).state !== 'ready') {
      const environment = findEnvironment(job.environmentId);
      try {
        const recorded = readJson(path.join(environmentPath(environment.id), 'environment-proof.json'), 8192);
        if (recorded?.environmentId !== environment.id) fail('ENVIRONMENT_INVALID', 'The environment creation proof is missing.', 409);
        proof = await verifyEnvironment(environmentPath(environment.id), recorded.proof);
      } catch { proofError = 'virtual_environment_verification_failed'; }
    }
    if (job.state !== hostJob.status || proof || proofError) store.update(value => {
      const target = value.jobs.find(item => item.id === id); target.state = hostJob.status;
      if (job.kind === 'prepare') {
        const environment = value.environments.find(item => item.id === job.environmentId);
        if (proof) { environment.state = 'ready'; environment.proof = proof; environment.verifiedAt = now(); environment.reason = null; }
        else if (proofError) { environment.state = 'failed'; environment.reason = proofError; target.state = 'failed'; target.reason = proofError; }
        else if (terminal.has(hostJob.status)) { environment.state = 'failed'; environment.reason = hostJob.reason ?? hostJob.status; }
        else if (['uncertain', 'interrupted'].includes(hostJob.status)) environment.state = 'uncertain';
      }
    });
    return response;
  };
  const result = async (id, replayed = false) => {
    const host = await refresh(id); const job = store.value.jobs.find(item => item.id === id); const environment = findEnvironment(job.environmentId);
    return { ok: true, id, replayed, job: jobView(job), environment: environmentView(environment),
      ...(host ? { output: host.output, offset: host.offset, nextOffset: host.nextOffset, eof: host.eof, truncated: host.truncated } : {}) };
  };
  const submit = async (kind, input) => {
    const requestHash = hash(JSON.stringify({ kind, ...input })); const old = store.value.jobs.find(item => item.id === input.id);
    if (old) { if (old.requestHash !== requestHash) fail('ENVIRONMENT_IDEMPOTENCY_CONFLICT', 'This job ID belongs to a different managed request.', 409); return result(old.id, true); }
    await actor(input); if (store.value.jobs.length >= ENVIRONMENT_LIMITS.receipts) fail('ENVIRONMENT_CAPACITY', 'The managed job receipt limit is full.', 409);
    let environment = store.value.environments.find(item => item.id === input.environmentId);
    if (environment && environment.companyId !== input.companyId) fail('ENVIRONMENT_SCOPE_DENIED', 'This environment belongs to another company.', 403);
    if (kind === 'prepare') {
      if (environment) fail('ENVIRONMENT_ALREADY_EXISTS', 'This immutable environment ID already has a creation receipt. Inspect it or use a new ID.', 409);
      if (store.value.environments.length >= ENVIRONMENT_LIMITS.environments) fail('ENVIRONMENT_CAPACITY', 'The managed environment limit is full.', 409);
      environment = { id: input.environmentId, companyId: input.companyId, employeeId: input.employeeId, state: 'preparing', createdAt: now() };
    } else {
      environment = findEnvironment(input.environmentId);
      const preparation = store.value.jobs.find(item => item.kind === 'prepare' && item.environmentId === input.environmentId); if (preparation) await refresh(preparation.id);
      environment = findEnvironment(input.environmentId);
      if (environment.state !== 'ready') fail('ENVIRONMENT_NOT_READY', 'The managed environment has not completed verification.', 409);
      await verifyEnvironment(environmentPath(environment.id), environment.proof);
      try { if (!fs.statSync(input.cwd).isDirectory()) throw new Error(); } catch { fail('ENVIRONMENT_CWD_INVALID', 'The requested working directory is unavailable.'); }
    }
    const directory = path.join(jobsDir, hash(input.id));
    try { fs.mkdirSync(directory, { mode: 0o700 }); } catch (error) { if (error.code !== 'EEXIST') store.fence(); fail('ENVIRONMENT_STATE_INVALID', 'An existing managed job directory requires local review.', 503); }
    const manifestPath = path.join(directory, 'manifest.json');
    const manifest = { version: 1, kind, environmentId: environment.id, environmentPath: environmentPath(environment.id), pythonPath,
      ...(kind === 'run' ? { command: input.command, cwd: input.cwd, proof: environment.proof } : {}) };
    store.write(manifestPath, { ...manifest, manifestHash: hash(JSON.stringify(manifest)) });
    // The host runner deliberately scrubs this variable before executing bash.
    // Reintroduce a fixed Node mode only for our wrapper: process.execPath may be
    // VS Code's Electron binary. Its Python child still uses safeEnvironment().
    const command = `ELECTRON_RUN_AS_NODE=1 ${quote(process.execPath)} ${quote(self)} --managed-job ${quote(manifestPath)}`;
    const hostJobId = `env-${hash(input.id).slice(0, 48)}`;
    store.update(value => {
      if (kind === 'prepare') value.environments.push(environment);
      value.jobs.push({ id: input.id, kind, requestHash, companyId: input.companyId, employeeId: input.employeeId, environmentId: environment.id,
        hostJobId, hostCommandHash: hash(command), state: 'dispatching', createdAt: now() });
    });
    let response;
    try { response = await hostControl.submit({ id: hostJobId, companyId: input.companyId, employeeId: input.employeeId, command,
      cwd: kind === 'run' ? input.cwd : store.directory, timeoutSeconds: kind === 'run' ? input.timeoutSeconds : 300, maxOutputBytes: kind === 'run' ? input.maxOutputBytes : 65536 }); }
    catch (error) {
      const rejected = ['HOST_DISABLED', 'HOST_POLICY_OFF', 'HOST_GRANT_REQUIRED', 'HOST_SCOPE_DENIED', 'HOST_CAPACITY', 'HOST_TMUX_UNAVAILABLE'].includes(error?.code);
      store.update(value => { const job = value.jobs.find(item => item.id === input.id); job.state = rejected ? 'failed' : 'uncertain'; job.reason = rejected ? 'host_rejected' : 'host_submission_unknown';
        if (kind === 'prepare') { const target = value.environments.find(item => item.id === environment.id); target.state = rejected ? 'failed' : 'uncertain'; target.reason = job.reason; } });
    }
    if (response?.job) store.update(value => { value.jobs.find(item => item.id === input.id).state = response.job.status; });
    return result(input.id);
  };
  return {
    status: () => store.serial(async () => {
      for (const job of store.value.jobs) await refresh(job.id);
      return { ok: true, environments: { items: store.value.environments.map(environmentView), jobs: store.value.jobs.map(jobView), limits: ENVIRONMENT_LIMITS,
        capabilities: { pythonVirtualEnvironments: true, commandLanguage: 'python', automaticRequirementsInstall: false, arbitraryShell: false, verifiedBeforeRun: true, secureSandbox: false, hostApprovalPolicy: 'inherited' } } };
    }),
    prepare: input => store.serial(() => submit('prepare', validateEnvironmentOperation('prepare', input))),
    run: input => store.serial(() => submit('run', validateEnvironmentOperation('run', input))),
    inspect: input => store.serial(async () => { validateEnvironmentOperation('inspect', input); return result(input.id); }),
    close: () => store.close()
  };
}

async function child(executable, args, options) {
  return new Promise((resolve, reject) => { const process = spawn(executable, args, { ...options, shell: false, stdio: 'inherit' }); process.once('error', reject); process.once('exit', (code, signal) => code === 0 ? resolve() : reject(new Error(signal ? 'Managed subprocess interrupted' : 'Managed subprocess failed'))); });
}
async function runManifest(filename) {
  if (!path.isAbsolute(filename)) throw new Error('Invalid manifest'); privateDirectory(path.dirname(filename));
  const record = readJson(filename, 1024 * 1024); const { manifestHash, ...manifest } = record;
  if (!object(record) || record.version !== 1 || manifestHash !== hash(JSON.stringify(manifest)) || !['prepare', 'run'].includes(manifest.kind) || !path.isAbsolute(manifest.environmentPath)) throw new Error('Invalid manifest');
  const directory = manifest.environmentPath; privateDirectory(path.dirname(directory));
  if (manifest.kind === 'prepare') {
    // Never clear, upgrade or overwrite an existing environment during a retry.
    fs.mkdirSync(directory, { mode: 0o700 });
    await child(manifest.pythonPath, ['-I', '-m', 'venv', '--copies', directory], { env: { ...safeEnvironment(), PIP_REQUIRE_VIRTUALENV: 'true', PYTHONNOUSERSITE: '1' } });
    const proof = await verifyEnvironment(directory);
    atomicJson(path.join(directory, 'environment-proof.json'), { environmentId: manifest.environmentId, proof });
    process.stdout.write('Managed Python environment ready.\n');
  } else {
    await verifyEnvironment(directory, manifest.proof);
    const source = path.join(path.dirname(filename), 'source.py'); fs.writeFileSync(source, manifest.command, { flag: 'wx', mode: 0o600 });
    await child(path.join(directory, 'bin', 'python'), ['-I', source], { cwd: manifest.cwd, env: managedEnv(directory) });
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === self && process.argv[2] === '--managed-job') {
  try { await runManifest(process.argv[3]); } catch { process.stderr.write('Managed environment job failed; inspect its host receipt.\n'); process.exitCode = 1; }
}
