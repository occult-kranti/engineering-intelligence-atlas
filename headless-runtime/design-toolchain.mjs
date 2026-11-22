/** Planning is local metadata only. Installation is an explicit owner request
 * executed through host-control; this module never starts a cloud instance. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { atomicJson, hash, object, privateDirectory, readJson, safeEnvironment } from './host-control-contract.mjs';
import { assertActor, createPrivateRegistry, nativeSnapshot } from './model-resources-contract.mjs';
import { DESIGN_CATALOG, DESIGN_LIMITS, DesignToolchainError, designFail as fail, validateDesignToolchainOperation, validateGodotArtifact } from './design-toolchain-contract.mjs';
export { DesignToolchainError } from './design-toolchain-contract.mjs';

const exec = promisify(execFile); const self = fileURLToPath(import.meta.url);
const quote = value => `'${value.replaceAll("'", "'\\''")}'`;
const now = () => new Date().toISOString();
const aptOptions = ['-o', 'APT::Get::AllowUnauthenticated=false', '-o', 'Acquire::AllowInsecureRepositories=false', '-o', 'Acquire::AllowDowngradeToInsecureRepositories=false', '-o', 'APT::Get::allow-Downgrades=false', '--no-install-recommends', '--no-remove'];
const officialOrigins = { debian: ['deb.debian.org', 'security.debian.org'], ubuntu: ['archive.ubuntu.com', 'security.ubuntu.com', 'ports.ubuntu.com'] };
function validateState(value) {
  if (!object(value) || value.version !== 1 || !Array.isArray(value.plans) || value.plans.length > DESIGN_LIMITS.plans || !Array.isArray(value.jobs) || value.jobs.length > DESIGN_LIMITS.installs) fail('DESIGN_STATE_INVALID', 'The design toolchain registry is malformed.', 503);
  for (const rows of [value.plans, value.jobs]) if (rows.some(row => !object(row) || typeof row.id !== 'string' || !/^[a-f0-9]{64}$/.test(row.inputHash)) || new Set(rows.map(row => row.id)).size !== rows.length) fail('DESIGN_STATE_INVALID', 'A design receipt identity is malformed.', 503);
}
const jobView = job => ({ id: job.id, planId: job.planId, planHash: job.planHash, hostJobId: job.hostJobId, state: job.state, createdAt: job.createdAt, reason: job.reason ?? null, installed: job.installed ?? null });

export function createDesignToolchain({ stateDir, hostControl, snapshot, getUid = () => process.getuid?.() } = {}) {
  if (typeof stateDir !== 'string' || typeof snapshot !== 'function' || typeof getUid !== 'function' || typeof hostControl?.submit !== 'function' || typeof hostControl?.inspect !== 'function') fail('DESIGN_INPUT_INVALID', 'State, native snapshot and host-control adapters are required.');
  const store = createPrivateRegistry({ stateDir, name: 'design-toolchain', initial: { version: 1, plans: [], jobs: [] }, validate: validateState, fail, ErrorType: DesignToolchainError });
  const jobs = path.join(store.directory, 'jobs'); const applications = path.join(store.directory, 'applications');
  try { privateDirectory(jobs, true); privateDirectory(applications, true); } catch { store.close().catch(() => {}); fail('DESIGN_STATE_INVALID', 'Private design toolchain storage is unavailable.', 503); }
  const actor = async input => assertActor(await nativeSnapshot(snapshot, fail), input.companyId, input.employeeId, undefined, fail);
  const findPlan = id => { const plan = store.value.plans.find(item => item.id === id); if (!plan) fail('DESIGN_PLAN_NOT_FOUND', 'The design installation plan was not found.', 404); return plan; };
  const planView = ({ inputHash, ...plan }) => structuredClone(plan);
  const inspect = async id => {
    const job = store.value.jobs.find(item => item.id === id); const plan = job ? findPlan(job.planId) : store.value.plans.find(item => item.id === id);
    if (!plan) fail('DESIGN_RECEIPT_NOT_FOUND', 'The design receipt was not found.', 404);
    if (!job) return { ok: true, id, plan: planView(plan) };
    let host;
    try { host = await hostControl.inspect({ id: job.hostJobId }); } catch (error) { if (error?.code !== 'HOST_JOB_NOT_FOUND') throw error; }
    if (host) {
      if (host.job?.id !== job.hostJobId || host.job.companyId !== plan.companyId || host.job.employeeId !== plan.employeeId || host.job.commandHash !== job.commandHash) fail('DESIGN_HOST_CONFLICT', 'The host job differs from this design installation receipt.', 409);
      let installed = job.installed; let reason = job.reason; let state = host.job.status;
      if (state === 'completed' && !installed) {
        const result = readJson(path.join(jobs, hash(job.id), 'installed.json'), 65536, true);
        if (result?.planHash !== plan.planHash || result?.toolId !== plan.toolId || result?.gpuVerified !== false) { state = 'failed'; reason = 'installation_proof_missing'; }
        else installed = result;
      }
      if (state !== job.state || installed !== job.installed || reason !== job.reason) store.update(value => { const target = value.jobs.find(item => item.id === id); target.state = state; target.reason = reason; target.installed = installed; });
    }
    return { ok: true, id, plan: planView(plan), job: jobView(store.value.jobs.find(item => item.id === id)), ...(host ? { output: host.output, offset: host.offset, nextOffset: host.nextOffset, eof: host.eof, truncated: host.truncated } : {}) };
  };
  return {
    catalog: () => store.serial(async () => ({ ok: true, catalog: structuredClone(DESIGN_CATALOG), capabilities: { startsInstances: false, rentsCompute: false, automaticInstallation: false, gpuVerified: false, penpotDeployment: false, globalPip: false, pythonRuntime: 'Use managed-environments for project Python; design apps use application runtimes.' } })),
    plan: input => store.serial(async () => {
      const value = validateDesignToolchainOperation('plan', input); const inputHash = hash(JSON.stringify(value)); const old = store.value.plans.find(item => item.id === value.id);
      if (old) { if (old.inputHash !== inputHash) fail('DESIGN_IDEMPOTENCY_CONFLICT', 'This plan ID belongs to different input.', 409); return { ok: true, id: old.id, plan: planView(old), replayed: true }; }
      await actor(value); if (store.value.plans.length >= DESIGN_LIMITS.plans) fail('DESIGN_CAPACITY', 'The durable design plan limit is full.', 409);
      const tool = DESIGN_CATALOG.find(item => item.id === value.toolId); const blockers = [];
      if (!value.target) blockers.push('Provide the exact target distribution version and CPU architecture; the stopped instance has not been probed.');
      if (tool.method === 'signed-apt' && !value.packageVersion) blockers.push('Review and provide the exact version from the target distribution signed package index.');
      if (tool.method === 'signed-apt' && getUid() !== 0) blockers.push('The runtime must already run as root inside the intended container for this system-package recipe. Interactive sudo and privilege escalation are not provided.');
      if (tool.method === 'verified-portable' && !value.artifact) blockers.push('Provide the exact official Godot release URL, version, reviewed SHA-256 and download byte ceiling.');
      if (tool.method === 'reviewed-compose-required') blockers.push('Penpot requires available Docker/Compose and a manually reviewed official compose file with every image pinned by digest. Compose import/deployment is not implemented.');
      const body = { ...value, kind: tool.method, status: blockers.length ? 'blocked' : 'ready', blockers,
        license: tool.license, sources: [tool.docs, tool.installDocs, tool.licenseUrl], runtime: tool.runtime,
        requirements: { gpuVerified: false, minimumRamBytes: null, availableDiskBytes: null, hardwareChecked: false,
          privileges: tool.method === 'signed-apt' ? 'Existing root identity in the intended container is required; no sudo.' : 'The current runtime identity must be able to write its private application directory.',
          diskPolicy: tool.method === 'signed-apt' ? 'Review signed metadata for each resolved dependency; cap 2 GiB download and 8 GiB installed size; check free disk before install.' : 'Bound downloaded archive, verify SHA-256, bound extracted executable to 512 MiB.',
          display: tool.gui === true ? 'Interactive use needs an explicitly configured desktop/display; installation does not create one.' : 'Browser UI requires a separately reviewed reachable server deployment.',
          network: 'Only an explicit install request can download artifacts; planning performs no network or SSH operation.',
          persistence: 'Use persistent instance storage for applications and projects; a stopped instance is never started here.',
          prerequisites: tool.method === 'signed-apt' ? ['Debian/Ubuntu target matches plan', 'Root inside the intended container', 'Reviewed official signed APT sources without trust overrides', 'Current signed package indexes already present'] : tool.method === 'verified-portable' ? ['Target matches plan', 'unzip installed', 'Reviewed artifact SHA-256'] : ['Docker available', 'Docker Compose available', 'Reviewed compose with pinned image digests', 'Persistent volumes and private ingress'] } };
      const plan = { ...body, inputHash, planHash: hash(JSON.stringify(body)), createdAt: now() }; store.update(state => { state.plans.push(plan); });
      return { ok: true, id: plan.id, plan: planView(plan), replayed: false };
    }),
    install: input => store.serial(async () => {
      validateDesignToolchainOperation('install', input); const inputHash = hash(JSON.stringify(input)); const old = store.value.jobs.find(item => item.id === input.id);
      if (old) { if (old.inputHash !== inputHash) fail('DESIGN_IDEMPOTENCY_CONFLICT', 'This installation ID belongs to different input.', 409); return { ...await inspect(old.id), replayed: true }; }
      const plan = findPlan(input.planId); if (plan.planHash !== input.expectedPlanHash) fail('DESIGN_PLAN_STALE', 'The supplied plan hash does not match.', 409);
      if (plan.status !== 'ready') fail('DESIGN_PLAN_BLOCKED', 'Resolve the explicit plan blockers before requesting installation.', 409);
      await actor(plan);
      if (store.value.jobs.some(item => item.planId === plan.id)) fail('DESIGN_PLAN_ALREADY_STARTED', 'This plan already has an immutable installation receipt.', 409);
      if (store.value.jobs.length >= DESIGN_LIMITS.installs) fail('DESIGN_CAPACITY', 'The durable installation receipt limit is full.', 409);
      const directory = path.join(jobs, hash(input.id)); try { fs.mkdirSync(directory, { mode: 0o700 }); } catch (error) { if (error.code !== 'EEXIST') store.fence(); fail('DESIGN_STATE_INVALID', 'An existing installation directory needs local review.', 503); }
      const manifestPath = path.join(directory, 'manifest.json');
      const manifest = { version: 1, plan: planView(plan), applicationPath: path.join(applications, hash(plan.id)), resultPath: path.join(directory, 'installed.json') };
      store.write(manifestPath, { ...manifest, manifestHash: hash(JSON.stringify(manifest)) });
      const command = `${quote(process.execPath)} ${quote(self)} --install-manifest ${quote(manifestPath)}`; const hostJobId = `design-${hash(input.id).slice(0, 48)}`;
      store.update(state => { state.jobs.push({ id: input.id, inputHash, planId: plan.id, planHash: plan.planHash, commandHash: hash(command), hostJobId, state: 'dispatching', createdAt: now() }); });
      let response;
      try { response = await hostControl.submit({ id: hostJobId, companyId: plan.companyId, employeeId: plan.employeeId, command, cwd: store.directory, timeoutSeconds: plan.timeoutSeconds, maxOutputBytes: plan.maxOutputBytes }); }
      catch (error) { const rejected = ['HOST_DISABLED', 'HOST_POLICY_OFF', 'HOST_GRANT_REQUIRED', 'HOST_SCOPE_DENIED', 'HOST_CAPACITY', 'HOST_TMUX_UNAVAILABLE'].includes(error?.code); store.update(state => { const job = state.jobs.find(item => item.id === input.id); job.state = rejected ? 'failed' : 'uncertain'; job.reason = rejected ? 'host_rejected' : 'host_submission_unknown'; }); }
      if (response?.job) store.update(state => { state.jobs.find(item => item.id === input.id).state = response.job.status; });
      return { ...await inspect(input.id), replayed: false };
    }),
    inspect: input => store.serial(async () => { validateDesignToolchainOperation('inspect', input); return inspect(input.id); }),
    close: () => store.close()
  };
}

export function parseTargetOs(text) {
  const values = {};
  for (const line of text.split('\n')) { const match = line.match(/^([A-Z_]+)=(?:"([^"\r\n]*)"|'([^'\r\n]*)'|([^\r\n]*))$/); if (match) values[match[1]] = match[2] ?? match[3] ?? match[4]; }
  return { distribution: values.ID, versionId: values.VERSION_ID };
}
export function assertSignedAptSources(text) {
  if (/\b(?:trusted|allow-insecure|allow-weak|allow-downgrade-to-insecure)\s*(?:=|:)\s*(?:yes|true|1)\b/i.test(text)) fail('DESIGN_APT_UNTRUSTED', 'APT trust/authentication overrides must be removed before this recipe can run.', 409);
}
function readAptSources() {
  const files = ['/etc/apt/sources.list'];
  if (fs.existsSync('/etc/apt/sources.list.d')) for (const name of fs.readdirSync('/etc/apt/sources.list.d')) if (/\.(list|sources)$/.test(name)) files.push(path.join('/etc/apt/sources.list.d', name));
  if (files.length > 128) fail('DESIGN_APT_UNTRUSTED', 'APT source inventory exceeds its review bound.', 409);
  let text = ''; for (const file of files) { if (!fs.existsSync(file)) continue; const stat = fs.statSync(file); if (stat.size > 65536) fail('DESIGN_APT_UNTRUSTED', 'An APT source file exceeds its review bound.', 409); text += fs.readFileSync(file, 'utf8'); }
  assertSignedAptSources(text);
}
function officialRepository(value, distribution) {
  try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password && !url.port && officialOrigins[distribution].includes(url.hostname)
    && url.pathname.startsWith(distribution === 'debian' ? '/debian' : '/ubuntu'); } catch { return false; }
}
const packageIdentity = value => typeof value === 'string' && /^[a-z0-9][a-z0-9+.-]*(?::(?:amd64|arm64|all))?$/.test(value) && value.length <= 150;
const packageVersion = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9.+:~_-]{0,99}$/.test(value) && !/[\r\n]/.test(value);
/** Pure bounded preflight adapter; tests supply command results and never install. */
export async function reviewAptResolution(plan, run) {
  const tool = DESIGN_CATALOG.find(item => item.id === plan.toolId && item.method === 'signed-apt'); if (!tool) fail('DESIGN_INPUT_INVALID', 'Unknown APT application.');
  const simulation = await run('/usr/bin/apt-get', [...aptOptions, '--simulate', 'install', `${tool.package}=${plan.packageVersion}`]);
  if (/^(?:Remv|Purg)\s/m.test(simulation)) fail('DESIGN_APT_DESTRUCTIVE', 'This package resolution would remove software; review it locally.', 409);
  const requested = new Map([[tool.package, plan.packageVersion]]);
  for (const line of simulation.split('\n')) {
    if (!line.startsWith('Inst ')) continue; const match = line.match(/^Inst (\S+)(?: \[[^\]]*\])? \((\S+) /);
    if (!match || !packageIdentity(match[1]) || !packageVersion(match[2])) fail('DESIGN_APT_METADATA_INVALID', 'The signed dependency plan could not be parsed.', 409);
    if (requested.has(match[1]) && requested.get(match[1]) !== match[2]) fail('DESIGN_APT_METADATA_INVALID', 'Dependency versions conflict.', 409); requested.set(match[1], match[2]);
    if (requested.size > DESIGN_LIMITS.dependencies) fail('DESIGN_APT_CAPACITY', 'The dependency plan exceeds its bound.', 409);
  }
  let downloadBytes = 0; let installedBytes = 0; const packages = [];
  for (const [name, version] of requested) {
    const rows = (await run('/usr/bin/apt-cache', ['madison', name])).split('\n').map(line => line.split('|').map(value => value.trim())).filter(row => row.length === 3 && row[1] === version);
    if (!rows.length || rows.some(row => !officialRepository(row[2].split(/\s+/)[0], plan.target.distribution))) fail('DESIGN_APT_SOURCE_DENIED', 'An exact package version is missing from the reviewed official distribution origins.', 409);
    const metadata = await run('/usr/bin/apt-cache', ['show', `${name}=${version}`]);
    const records = metadata.split(/\n\s*\n/).map(block => Object.fromEntries(block.split('\n').flatMap(line => { const match = line.match(/^([A-Za-z0-9-]+): (.*)$/); return match ? [[match[1], match[2]]] : []; }))).filter(record => record.Version === version);
    if (!records.length || records.some(record => !/^[a-f0-9]{64}$/.test(record.SHA256 ?? '') || !/^\d+$/.test(record.Size ?? '') || !/^\d+$/.test(record['Installed-Size'] ?? ''))) fail('DESIGN_APT_METADATA_INVALID', 'Signed package size/digest metadata is incomplete.', 409);
    if (new Set(records.map(record => record.SHA256)).size !== 1) fail('DESIGN_APT_METADATA_INVALID', 'Package indexes disagree on the exact artifact digest.', 409);
    const record = records[0]; downloadBytes += Number(record.Size); installedBytes += Number(record['Installed-Size']) * 1024;
    if (!Number.isSafeInteger(downloadBytes) || !Number.isSafeInteger(installedBytes) || downloadBytes > DESIGN_LIMITS.downloadBytes || installedBytes > DESIGN_LIMITS.installedBytes) fail('DESIGN_APT_CAPACITY', 'The resolved signed package set exceeds its resource ceiling.', 409);
    packages.push({ name, version, sha256: record.SHA256 });
  }
  return { packages, downloadBytes, installedBytes, installArgs: [...aptOptions, '--yes', 'install', ...packages.map(item => `${item.name}=${item.version}`)] };
}
function abortable(promise, signal) {
  return new Promise((resolve, reject) => { let done = false; const finish = (fn, value) => { if (done) return; done = true; signal.removeEventListener('abort', aborted); fn(value); }; const aborted = () => finish(reject, new Error('Aborted')); signal.addEventListener('abort', aborted, { once: true }); Promise.resolve(promise).then(value => finish(resolve, value), error => finish(reject, error)); if (signal.aborted) aborted(); });
}
/** No HTTP calls occur unless explicit installation reaches this function. */
export async function downloadVerifiedArtifact(artifact, destination, { fetchImpl = fetch, timeoutMs = 300000 } = {}) {
  validateGodotArtifact(artifact); const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), timeoutMs);
  const partial = `${destination}.partial`; let fd; let created = false; let reader;
  try {
    if (fs.existsSync(destination)) fail('DESIGN_ARTIFACT_EXISTS', 'A previous artifact requires local inspection.', 409);
    let url = artifact.url; let response;
    for (let redirects = 0; redirects < 5; redirects++) {
      if (controller.signal.aborted) throw new Error('Aborted');
      response = await abortable(fetchImpl(url, { redirect: 'manual', signal: controller.signal, headers: { Accept: 'application/octet-stream' } }), controller.signal);
      if (![301, 302, 303, 307, 308].includes(response.status)) break;
      try { Promise.resolve(response.body?.cancel?.()).catch(() => {}); } catch {}
      const next = new URL(response.headers.get('location'), url);
      if (next.protocol !== 'https:' || next.username || next.password || next.port || !['github.com', 'release-assets.githubusercontent.com', 'objects.githubusercontent.com'].includes(next.hostname)) fail('DESIGN_ARTIFACT_REDIRECT', 'The release redirected outside the allowed vendor hosts.', 409);
      url = next.href;
    }
    if (!response?.ok || !response.body?.getReader) fail('DESIGN_ARTIFACT_DOWNLOAD_FAILED', 'The reviewed artifact could not be downloaded.', 503);
    const length = response.headers?.get?.('content-length'); if (length && (!/^\d+$/.test(length) || Number(length) > artifact.maxBytes)) fail('DESIGN_ARTIFACT_TOO_LARGE', 'The artifact exceeds its pinned download ceiling.', 409);
    fd = fs.openSync(partial, 'wx', 0o600); created = true; reader = response.body.getReader(); const digest = crypto.createHash('sha256'); let bytes = 0;
    for (;;) {
      const { done, value } = await abortable(reader.read(), controller.signal); if (done) break;
      if (!(value instanceof Uint8Array)) throw new Error('Invalid body'); bytes += value.length;
      if (bytes > artifact.maxBytes) fail('DESIGN_ARTIFACT_TOO_LARGE', 'The artifact exceeds its pinned download ceiling.', 409);
      let written = 0; while (written < value.length) { const count = fs.writeSync(fd, value, written, value.length - written); if (count < 1) throw new Error('Incomplete artifact write'); written += count; } digest.update(value);
    }
    if (!bytes || digest.digest('hex') !== artifact.sha256) fail('DESIGN_ARTIFACT_DIGEST_MISMATCH', 'The downloaded artifact does not match the reviewed SHA-256.', 409);
    fs.fsyncSync(fd); fs.closeSync(fd); fd = undefined; fs.linkSync(partial, destination); fs.unlinkSync(partial); created = false; return { bytes, sha256: artifact.sha256 };
  } finally {
    clearTimeout(timer); controller.abort(); try { Promise.resolve(reader?.cancel?.()).catch(() => {}); } catch {} try { reader?.releaseLock?.(); } catch {}
    if (fd !== undefined) fs.closeSync(fd); if (created) try { fs.unlinkSync(partial); } catch {}
  }
}
async function extractGodot(archive, executable, expectedName) {
  const listing = await exec('/usr/bin/unzip', ['-Z1', archive], { env: safeEnvironment(), shell: false, timeout: 10000, maxBuffer: 65536 });
  if (listing.stdout.trim() !== expectedName) fail('DESIGN_ARTIFACT_LAYOUT', 'The reviewed archive must contain exactly its expected executable.', 409);
  const fd = fs.openSync(executable, 'wx', 0o700); let bytes = 0;
  try {
    await new Promise((resolve, reject) => {
      const child = spawn('/usr/bin/unzip', ['-p', archive, expectedName], { env: safeEnvironment(), shell: false, stdio: ['ignore', 'pipe', 'pipe'] }); let overflow = false; let errors = 0;
      child.stdout.on('data', data => { if (overflow) return; bytes += data.length; if (bytes > DESIGN_LIMITS.extractedBytes) { overflow = true; child.kill('SIGKILL'); return; } fs.writeSync(fd, data); });
      child.stderr.on('data', data => { errors += data.length; if (errors > 65536) { overflow = true; child.kill('SIGKILL'); } });
      child.once('error', reject); child.once('close', code => code === 0 && !overflow ? resolve() : reject(new Error('Archive extraction failed')));
    });
    fs.fsyncSync(fd);
  } catch (error) { fs.closeSync(fd); fs.unlinkSync(executable); throw error; }
  fs.closeSync(fd); return bytes;
}
async function executeManifest(filename) {
  privateDirectory(path.dirname(filename)); const record = readJson(filename, 65536); const { manifestHash, ...manifest } = record;
  if (manifestHash !== hash(JSON.stringify(manifest)) || manifest.version !== 1) fail('DESIGN_STATE_INVALID', 'The install manifest is invalid.', 503);
  const plan = manifest.plan; validateDesignToolchainOperation('plan', Object.fromEntries(['id', 'companyId', 'employeeId', 'toolId', 'target', 'packageVersion', 'artifact', 'timeoutSeconds', 'maxOutputBytes'].filter(key => plan[key] !== undefined).map(key => [key, plan[key]])));
  if (plan.status !== 'ready' || !plan.target) fail('DESIGN_PLAN_BLOCKED', 'The install plan is blocked.', 409);
  const os = parseTargetOs(fs.readFileSync('/etc/os-release', 'utf8')); const arch = { x64: 'x86_64', arm64: 'aarch64' }[process.arch];
  if (process.platform !== 'linux' || os.distribution !== plan.target.distribution || os.versionId !== plan.target.versionId || arch !== plan.target.arch) fail('DESIGN_TARGET_MISMATCH', 'The running target differs from the reviewed installation plan.', 409);
  const tool = DESIGN_CATALOG.find(item => item.id === plan.toolId);
  const run = async (executable, args, timeout = 15000) => (await exec(executable, args, { env: { ...safeEnvironment(), LANG: 'C', LC_ALL: 'C', DEBIAN_FRONTEND: 'noninteractive' }, shell: false, timeout, maxBuffer: 4 * 1024 * 1024 })).stdout;
  let proof;
  if (tool.method === 'signed-apt') {
    if (process.getuid?.() !== 0) fail('DESIGN_ROOT_REQUIRED', 'This distribution package recipe requires root in the intended container.', 403);
    readAptSources(); process.stdout.write('Reviewing the exact signed distribution package set.\n'); const resolved = await reviewAptResolution(plan, run);
    const disk = fs.statfsSync('/'); if (disk.bavail * disk.bsize < resolved.installedBytes + resolved.downloadBytes) fail('DESIGN_DISK_LIMIT', 'Available disk cannot cover the bounded package set.', 409);
    process.stdout.write('Installing pinned package versions through authenticated APT.\n'); await run('/usr/bin/apt-get', resolved.installArgs, plan.timeoutSeconds * 1000);
    const actual = (await run('/usr/bin/dpkg-query', ['-W', '-f=${Version}\t${db:Status-Status}', tool.package])).trim();
    if (actual !== `${plan.packageVersion}\tinstalled`) fail('DESIGN_INSTALL_VERIFICATION_FAILED', 'The installed package version could not be verified.', 503);
    proof = { toolId: tool.id, version: plan.packageVersion, method: 'signed-apt', packages: resolved.packages, downloadCeilingBytes: resolved.downloadBytes, installedSizeEstimateBytes: resolved.installedBytes, applicationPath: `/usr/bin/${tool.package}` };
  } else if (tool.method === 'verified-portable') {
    validateGodotArtifact(plan.artifact, plan.target); privateDirectory(path.dirname(manifest.applicationPath)); fs.mkdirSync(manifest.applicationPath, { mode: 0o700 });
    const disk = fs.statfsSync(manifest.applicationPath); if (disk.bavail * disk.bsize < plan.artifact.maxBytes + DESIGN_LIMITS.extractedBytes) fail('DESIGN_DISK_LIMIT', 'Available disk cannot cover the portable artifact ceiling.', 409);
    const archive = path.join(manifest.applicationPath, 'reviewed.zip'); process.stdout.write('Downloading and hashing the pinned official Godot artifact.\n'); await downloadVerifiedArtifact(plan.artifact, archive);
    const binaryName = path.basename(new URL(plan.artifact.url).pathname, '.zip'); const executable = path.join(manifest.applicationPath, 'godot'); const bytes = await extractGodot(archive, executable, binaryName);
    const fd = fs.openSync(executable, 'r'); const header = Buffer.alloc(20); try { fs.readSync(fd, header, 0, 20, 0); } finally { fs.closeSync(fd); }
    if (header.toString('hex', 0, 4) !== '7f454c46' || header[4] !== 2 || header[5] !== 1 || header.readUInt16LE(18) !== (arch === 'x86_64' ? 62 : 183)) fail('DESIGN_ARTIFACT_ARCHITECTURE', 'The extracted executable does not match the reviewed architecture.', 409);
    proof = { toolId: tool.id, version: plan.artifact.version, method: 'verified-portable', archiveSha256: plan.artifact.sha256, extractedBytes: bytes, applicationPath: executable };
  } else fail('DESIGN_PLAN_BLOCKED', 'Reviewed Penpot compose deployment is not implemented.', 409);
  atomicJson(manifest.resultPath, { ...proof, planHash: plan.planHash, installedAt: now(), gpuVerified: false, displayVerified: false, applicationStarted: false });
  process.stdout.write('Installation verified. No GUI session or GPU workload was started.\n');
}
if (process.argv[1] && path.resolve(process.argv[1]) === self && process.argv[2] === '--install-manifest') {
  try { await executeManifest(process.argv[3]); } catch { process.stderr.write('Design installation failed; inspect the durable host receipt and target locally.\n'); process.exitCode = 1; }
}
