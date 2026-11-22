import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createDesignToolchain, DesignToolchainError, assertSignedAptSources, downloadVerifiedArtifact, parseTargetOs, reviewAptResolution } from '../design-toolchain.mjs';
import { DESIGN_CATALOG, DESIGN_TOOLCHAIN_SCHEMAS, validateDesignToolchainOperation, validateGodotArtifact } from '../design-toolchain-contract.mjs';
import { hash } from '../host-control-contract.mjs';
const target = { distribution: 'debian', versionId: '12', arch: 'x86_64' };
const version = '4.4.1-stable'; // A syntax fixture; not a deployment recommendation or fabricated digest.
const artifact = data => ({ version, url: `https://github.com/godotengine/godot-builds/releases/download/${version}/Godot_v${version}_linux.x86_64.zip`, sha256: hash(data), maxBytes: 1024 });
function setup(t, host, getUid = () => 0) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'daftar-design-test-')); const calls = []; const receipts = new Map();
  const state = { companies: [{ id: 'acme', status: 'active', assistantId: 'donna' }], offices: [], departments: [], employees: [{ id: 'donna', companyId: null, officeId: null, departmentId: null, status: 'active' }] };
  const hostControl = host ?? { submit: async input => { calls.push(input); const job = { id: input.id, companyId: input.companyId, employeeId: input.employeeId, commandHash: hash(input.command), status: 'pending_approval' }; receipts.set(input.id, job); return { ok: true, job }; }, inspect: async ({ id }) => { if (!receipts.has(id)) throw Object.assign(new Error('missing'), { code: 'HOST_JOB_NOT_FOUND' }); return { ok: true, job: receipts.get(id), output: '', offset: 0, nextOffset: 0, eof: false, truncated: false }; } };
  const options = { stateDir: directory, hostControl, snapshot: async () => ({ ok: true, snapshot: state }), getUid }; const service = createDesignToolchain(options); const services = [service];
  t.after(async () => { for (const item of services) await item.close().catch(() => {}); fs.rmSync(directory, { recursive: true, force: true }); });
  const plan = (extra = {}) => ({ id: 'plan', companyId: 'acme', employeeId: 'donna', toolId: 'blender', target, packageVersion: '3.4.1+dfsg-2+b1', ...extra });
  return { directory, calls, receipts, state, service, plan, restart() { const next = createDesignToolchain(options); services.push(next); return next; } };
}
const reject = (promise, code) => assert.rejects(promise, error => error instanceof DesignToolchainError && error.code === code);
test('catalog and plans are dry; missing exact sources and Penpot are explicitly blocked', async t => {
  const f = setup(t); const catalog = await f.service.catalog(); assert.equal(catalog.catalog.length, 6); assert.equal(catalog.capabilities.startsInstances, false);
  for (const tool of DESIGN_CATALOG) { assert.ok(tool.license); assert.ok(tool.docs.startsWith('https://')); assert.ok(tool.runtime); }
  const missing = await f.service.plan({ id: 'missing', companyId: 'acme', employeeId: 'donna', toolId: 'blender' }); assert.equal(missing.plan.status, 'blocked'); assert.equal(missing.plan.requirements.gpuVerified, false); assert.equal(missing.plan.requirements.minimumRamBytes, null);
  const penpot = await f.service.plan(f.plan({ id: 'penpot', toolId: 'penpot', packageVersion: undefined })); assert.equal(penpot.plan.status, 'blocked'); assert.match(penpot.plan.blockers.join(' '), /pinned by digest/);
  await reject(f.service.install({ id: 'blocked', planId: 'penpot', expectedPlanHash: penpot.plan.planHash }), 'DESIGN_PLAN_BLOCKED'); assert.equal(f.calls.length, 0);
});
test('exact pinned plans and explicit install reuse durable manual host receipts', async t => {
  const f = setup(t); const plans = await Promise.all(Array.from({ length: 16 }, () => f.service.plan(f.plan()))); assert.equal(plans.filter(item => !item.replayed).length, 1);
  assert.equal(plans[0].plan.status, 'ready'); assert.equal(f.calls.length, 0);
  const input = { id: 'install', planId: 'plan', expectedPlanHash: plans[0].plan.planHash };
  const installs = await Promise.all(Array.from({ length: 16 }, () => f.service.install(input)));
  assert.equal(f.calls.length, 1); assert.equal(installs[0].job.state, 'pending_approval'); assert.equal(installs[0].job.installed, null);
  assert.ok(!f.calls[0].command.includes('curl')); assert.ok(!f.calls[0].command.includes('pip'));
  await reject(f.service.plan(f.plan({ packageVersion: 'different' })), 'DESIGN_IDEMPOTENCY_CONFLICT');
  await f.service.close(); assert.equal((await f.restart().install(input)).replayed, true); assert.equal(f.calls.length, 1);
});
test('non-root runtime returns a blocked package plan without trying sudo or submitting a job', async t => {
  const f = setup(t, undefined, () => 1000); const planned = (await f.service.plan(f.plan())).plan;
  assert.equal(planned.status, 'blocked'); assert.match(planned.blockers.join(' '), /already run as root/); assert.match(planned.requirements.privileges, /no sudo/);
  await reject(f.service.install({ id: 'install', planId: planned.id, expectedPlanHash: planned.planHash }), 'DESIGN_PLAN_BLOCKED'); assert.equal(f.calls.length, 0);
});
test('fresh native eligibility, immutable plan hash, and installation proof are enforced', async t => {
  const f = setup(t); const planned = (await f.service.plan(f.plan())).plan;
  await reject(f.service.install({ id: 'bad', planId: 'plan', expectedPlanHash: '0'.repeat(64) }), 'DESIGN_PLAN_STALE');
  f.state.employees[0].status = 'fired'; await reject(f.service.install({ id: 'install', planId: 'plan', expectedPlanHash: planned.planHash }), 'DESIGN_SCOPE_DENIED');
  f.state.employees[0].status = 'active'; const result = await f.service.install({ id: 'install', planId: 'plan', expectedPlanHash: planned.planHash });
  f.receipts.get(result.job.hostJobId).status = 'completed'; const inspected = await f.service.inspect({ id: 'install' }); assert.equal(inspected.job.state, 'failed'); assert.equal(inspected.job.reason, 'installation_proof_missing');
});
test('unknown host submission is not retried and write faults fence before dispatch', async t => {
  let count = 0; const host = { submit: async () => { count++; throw new Error('unknown'); }, inspect: async () => { throw Object.assign(new Error('missing'), { code: 'HOST_JOB_NOT_FOUND' }); } };
  const f = setup(t, host); const plan = (await f.service.plan(f.plan())).plan; const input = { id: 'install', planId: 'plan', expectedPlanHash: plan.planHash };
  assert.equal((await f.service.install(input)).job.state, 'uncertain'); await f.service.install(input); assert.equal(count, 1);
  const second = setup(t); const rename = fs.renameSync; const registry = path.join(second.directory, 'design-toolchain', 'registry.json');
  fs.renameSync = (source, destination) => { if (destination === registry) throw Object.assign(new Error('EIO'), { code: 'EIO' }); return rename(source, destination); };
  try { await reject(second.service.plan(second.plan()), 'DESIGN_STATE_UNCERTAIN'); } finally { fs.renameSync = rename; }
  await reject(second.service.catalog(), 'DESIGN_STATE_UNCERTAIN'); assert.equal(second.calls.length, 0);
});
test('portable URL, version, architecture and digest inputs cannot escape the official vendor boundary', () => {
  const approved = artifact(Buffer.from('local fixture')); assert.equal(validateGodotArtifact(approved, target).url, approved.url);
  for (const update of [{ url: approved.url.replace('github.com', 'github.com.evil.example') }, { url: `${approved.url}?token=secret` }, { url: approved.url.replace(version, 'latest') }, { sha256: 'guessed' }, { url: approved.url.replace('x86_64', 'arm64') }, { maxBytes: 0 }]) assert.throws(() => validateGodotArtifact({ ...approved, ...update }, target), DesignToolchainError);
  assert.throws(() => validateDesignToolchainOperation('plan', { id: 'p', companyId: 'c', employeeId: 'e', toolId: 'blender', packageVersion: '1; shell' }), DesignToolchainError);
  assert.deepEqual(Object.keys(DESIGN_TOOLCHAIN_SCHEMAS), ['catalog', 'plan', 'install', 'inspect']);
});
function packageRunner({ origin = 'http://deb.debian.org/debian', simulation = 'Inst blender (3.4.1+dfsg-2+b1 Debian:12 [amd64])\nInst libexample (1.0 Debian:12 [amd64])\n', size = 100 } = {}) {
  return async (binary, args) => {
    if (binary.endsWith('apt-get')) return simulation;
    if (args[0] === 'madison') return `${args[1]} | ${args[1] === 'blender' ? '3.4.1+dfsg-2+b1' : '1.0'} | ${origin} bookworm/main amd64 Packages\n`;
    const [name, version] = args[1].split('='); return `Package: ${name}\nVersion: ${version}\nSHA256: ${'a'.repeat(64)}\nSize: ${size}\nInstalled-Size: 100\n`;
  };
}
test('APT preflight pins every resolved dependency, keeps signature checks, and rejects destructive/foreign resolutions', async () => {
  const plan = { toolId: 'blender', packageVersion: '3.4.1+dfsg-2+b1', target };
  const result = await reviewAptResolution(plan, packageRunner()); assert.equal(result.packages.length, 2); assert.ok(result.installArgs.includes('libexample=1.0')); assert.ok(result.installArgs.includes('APT::Get::AllowUnauthenticated=false')); assert.ok(result.installArgs.includes('--no-remove'));
  await reject(reviewAptResolution(plan, packageRunner({ origin: 'https://unreviewed.example/debian' })), 'DESIGN_APT_SOURCE_DENIED');
  await reject(reviewAptResolution(plan, packageRunner({ simulation: 'Remv existing-app [1.0]\n' })), 'DESIGN_APT_DESTRUCTIVE');
  await reject(reviewAptResolution(plan, packageRunner({ size: 3 * 1024 ** 3 })), 'DESIGN_APT_CAPACITY');
  for (const value of ['deb [trusted=yes] http://deb.debian.org/debian bookworm main', 'Trusted: true', 'Allow-Insecure: 1']) assert.throws(() => assertSignedAptSources(value), DesignToolchainError);
  assert.deepEqual(parseTargetOs('ID="ubuntu"\nVERSION_ID="24.04"\n'), { distribution: 'ubuntu', versionId: '24.04' });
});
function response(data, { status = 200, location } = {}) {
  let sent = false;
  return { status, ok: status === 200, headers: { get: key => key === 'location' ? location : key === 'content-length' ? String(data.length) : null }, body: { cancel: async () => {}, getReader: () => ({ read: async () => sent ? { done: true } : (sent = true, { done: false, value: data }), cancel: async () => {}, releaseLock() {} }) } };
}
test('portable transfer verifies synthetic fixture bytes before promotion and cleans failed partials', async t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'daftar-download-fixture-')); t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const data = Buffer.from('local in-memory fixture, not a downloaded application'); const source = artifact(data); let requests = 0;
  const destination = path.join(directory, 'verified.zip'); const result = await downloadVerifiedArtifact(source, destination, { fetchImpl: async url => { requests++; assert.equal(url, source.url); return response(data); } });
  assert.equal(result.sha256, hash(data)); assert.equal(requests, 1); assert.deepEqual(fs.readFileSync(destination), data);
  const mismatch = path.join(directory, 'mismatch.zip'); await reject(downloadVerifiedArtifact({ ...source, sha256: 'b'.repeat(64) }, mismatch, { fetchImpl: async () => response(data) }), 'DESIGN_ARTIFACT_DIGEST_MISMATCH');
  assert.equal(fs.existsSync(mismatch), false); assert.equal(fs.existsSync(`${mismatch}.partial`), false);
  await reject(downloadVerifiedArtifact({ ...source, maxBytes: 2 }, path.join(directory, 'oversize.zip'), { fetchImpl: async () => response(data) }), 'DESIGN_ARTIFACT_TOO_LARGE');
  await reject(downloadVerifiedArtifact(source, path.join(directory, 'redirect.zip'), { fetchImpl: async () => response(Buffer.alloc(0), { status: 302, location: 'https://evil.example/install.sh' }) }), 'DESIGN_ARTIFACT_REDIRECT');
  const officialAsset = 'https://release-assets.githubusercontent.com/github-production-release-asset/fixture?signature=fixture'; let hops = 0;
  const redirected = path.join(directory, 'official-redirect.zip');
  await downloadVerifiedArtifact(source, redirected, { fetchImpl: async (url, options) => { assert.equal(options.headers?.Authorization, undefined); hops++; return url === source.url ? response(Buffer.alloc(0), { status: 302, location: officialAsset }) : (assert.equal(url, officialAsset), response(data)); } });
  assert.equal(hops, 2); assert.deepEqual(fs.readFileSync(redirected), data);
});
test('an uncooperative artifact response still meets its deadline without producing a promoted file', async t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'daftar-download-timeout-')); t.after(() => fs.rmSync(directory, { recursive: true, force: true })); const destination = path.join(directory, 'artifact.zip');
  const start = Date.now(); await assert.rejects(downloadVerifiedArtifact(artifact(Buffer.from('x')), destination, { timeoutMs: 20, fetchImpl: () => new Promise(() => {}) }));
  assert.ok(Date.now() - start < 1000); assert.equal(fs.existsSync(destination), false);
});
