#!/usr/bin/env node
/** Real Rust + owner HTTP: synthetic state only, no external calls or credentials. */
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { performance } from 'node:perf_hooks';
import { startServer } from '../headless-runtime/server.mjs';
import { RuntimeController } from '../headless-runtime/runtime.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const flags = new Map();
for (const arg of process.argv.slice(2)) {
  const match = /^--(employees|requests|output)=(.+)$/.exec(arg);
  if (!match || flags.has(match[1])) throw new Error('Use --employees=1..1024, --requests=16..256 and optional --output=path.');
  flags.set(match[1], match[2]);
}
const employeeCount = Number(flags.get('employees') ?? 128);
const requestCount = Number(flags.get('requests') ?? 64);
assert.ok(Number.isInteger(employeeCount) && employeeCount >= 1 && employeeCount <= 1024, 'Employee bound is 1..1024');
assert.ok(Number.isInteger(requestCount) && requestCount >= 16 && requestCount <= 256, 'Request bound is 16..256');
const binaryPath = path.join(repoRoot, 'native-core/target/release', process.platform === 'win32' ? 'atlas-core.exe' : 'atlas-core');
for (const file of [binaryPath, path.join(repoRoot, 'desktop-shell/dist/main/officeWorker.js')]) {
  assert.ok(fs.existsSync(file), 'Native core and portable runtime modules must be built; stress tests cannot be skipped.');
}
const hashFile = filename => crypto.createHash('sha256').update(fs.readFileSync(filename)).digest('hex');
const nativeBinarySha256 = hashFile(binaryPath);
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'daftar-backend-stress-'));
const token = crypto.randomBytes(32).toString('base64url');
const services = [];
const checks = [];
const timings = [];
const responseCounts = {};
let externalCalls = 0;
let commandSequence = 0;
let retryCount = 0;
const start = performance.now();

function record(name, details = {}) { checks.push({ name, passed: true, ...details }); }
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function cleanup() {
  const results = await Promise.allSettled(services.splice(0).reverse().map(service => service.close()));
  fs.rmSync(dataDir, { recursive: true, force: true });
  const failed = results.find(result => result.status === 'rejected');
  if (failed) throw failed.reason;
}
async function boot({ secondary = false } = {}) {
  let runtime;
  if (secondary) {
    // The model controller is intentionally single-owner. A second independent
    // native client exercises OS locking without bypassing that registry lease.
    const { OfficeService } = require(path.join(repoRoot, 'desktop-shell/dist/main/office.js'));
    const { cloudSnapshot, syncStateHash } = require(path.join(repoRoot, 'desktop-shell/dist/main/cloudSync.js'));
    const office = new OfficeService({ userDataPath: dataDir, seedDir: path.join(repoRoot, 'company'), binaryPath });
    runtime = new RuntimeController({ office, projectSnapshot: cloudSnapshot, stateHash: syncStateHash,
      worker: { status: () => ({ enabled: false, running: false }), stop() {},
        setEnabled() { throw new Error('Secondary fixture has no worker pool'); }, runOnce() { throw new Error('Secondary fixture has no worker pool'); } },
      capabilities: { providerJobs: false } });
  }
  const service = await startServer({ repoRoot, binaryPath, dataDir, token, port: 0, maxConcurrent: 8,
    ...(runtime ? { runtime } : {}),
    generate: async () => { externalCalls++; throw new Error('External generation must remain disabled during this suite'); } });
  services.push(service);
  return { ...service, origin: `http://127.0.0.1:${service.server.address().port}` };
}

async function request(service, route, body, overrideHeaders = {}) {
  const then = performance.now();
  const response = await fetch(service.origin + route, {
    method: body === undefined ? 'GET' : 'POST', signal: AbortSignal.timeout(30000),
    headers: { Authorization: `Bearer ${token}`, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...overrideHeaders },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const result = await response.json();
  const elapsedMs = performance.now() - then;
  timings.push(elapsedMs);
  responseCounts[response.status] = (responseCounts[response.status] ?? 0) + 1;
  return { status: response.status, result, elapsedMs, retryAfter: response.headers.get('retry-after') };
}

// Contention can reject a request before execution; retry the identical envelope.
// Never replace its id/body or refresh its expected hash automatically.
async function stableRequest(service, route, body) {
  for (let attempt = 0; attempt < 32; attempt++) {
    const response = await request(service, route, body);
    if (response.result.code !== 'STATE_BUSY' && response.status !== 429) return response;
    assert.equal(response.retryAfter, '1');
    retryCount++;
    await pause(Number(response.retryAfter) * 1000);
  }
  throw new Error('Native contention did not settle within the bounded retry budget');
}

async function read(service) {
  const response = await stableRequest(service, '/v1/office');
  assert.equal(response.status, 200, `Workspace read failed: ${response.result.code}`);
  assert.equal(response.result.ok, true);
  return response.result;
}

async function apply(service, command, prior) {
  const state = prior ?? await read(service);
  const envelope = { id: `stress-command-${++commandSequence}`, expectedStateHash: state.stateHash, command };
  const response = await stableRequest(service, '/v1/commands', envelope);
  assert.equal(response.status, 200, `Command ${command.action} failed: ${response.result.code}`);
  assert.equal(response.result.replayed, false);
  assert.ok(response.result.snapshot);
  return { ...response.result, envelope };
}

function assistants(snapshot) {
  const byId = new Map(snapshot.employees.map(employee => [employee.id, employee]));
  const donna = byId.get('donna');
  assert.ok(donna);
  assert.equal(donna.kind, 'assistant');
  assert.equal(donna.companyId, null);
  assert.equal(donna.officeId, null);
  assert.equal(donna.departmentId, null);
  assert.ok(['active', 'paused'].includes(donna.status));
  for (const [collection, kind] of [['companies', 'company'], ['offices', 'office'], ['departments', 'department']]) {
    for (const scope of snapshot[collection]) {
      const assistant = byId.get(scope.assistantId);
      assert.ok(assistant, `${kind} assistant must exist`);
      assert.notEqual(assistant.id, 'donna');
      assert.equal(assistant.kind, 'assistant');
      assert.equal(assistant.companyId, kind === 'company' ? scope.id : scope.companyId);
      assert.equal(assistant.officeId, kind === 'company' ? null : kind === 'office' ? scope.id : scope.officeId);
      assert.equal(assistant.departmentId, kind === 'department' ? scope.id : null);
      assert.ok(['active', 'paused'].includes(assistant.status));
    }
  }
}

try {
  const first = await boot();
  await assert.rejects(boot(), error => ['CREATIVE_STATE_BUSY', 'MODEL_REGISTRY_BUSY'].includes(error.code));
  record('A second full daemon cannot acquire the exclusive creative/model controllers');
  const second = await boot({ secondary: true });
  const initial = await read(first);
  assert.equal(first.runtime.status().worker.enabled, false);
  assert.equal(second.runtime.status().worker.enabled, false);
  const denied = await request(first, '/v1/commands', {}, { Authorization: '' });
  assert.equal(denied.status, 401);
  record('The daemon and independent native client start paused and reject unauthenticated mutations');

  const companyId = 'backend-stress-company';
  const duplicated = { id: 'stress-shared-create', expectedStateHash: initial.stateHash,
    command: { action: 'create_company', id: companyId, name: 'Synthetic backend stress company' } };
  const burst = await Promise.all(Array.from({ length: requestCount }, (_, index) =>
    stableRequest(index % 2 ? first : second, '/v1/commands', duplicated)));
  assert.ok(burst.every(response => response.status === 200));
  assert.equal(burst.filter(response => response.result.replayed === false).length, 1);
  assert.equal(burst.filter(response => response.result.replayed === true).length, requestCount - 1);
  let current = await read(first);
  assert.equal(current.snapshot.companies.length, initial.snapshot.companies.length + 1);
  assert.equal(current.snapshot.companies.filter(company => company.id === companyId).length, 1);
  record('Concurrent duplicate delivery commits one company across two independent native clients', { deliveries: requestCount });

  const office = current.snapshot.offices.find(item => item.companyId === companyId);
  const department = current.snapshot.departments.find(item => item.companyId === companyId);
  assert.ok(office && department);
  const competing = await Promise.all(Array.from({ length: 16 }, (_, index) =>
    stableRequest(index % 2 ? first : second, '/v1/commands', {
      id: `stress-competing-${index}`, expectedStateHash: current.stateHash,
      command: { action: 'rename_department', departmentId: department.id, name: `Competing definition ${index}` },
    })));
  assert.equal(competing.filter(response => response.status === 200).length, 1);
  assert.equal(competing.filter(response => response.status === 409 && response.result.code === 'CONFLICT').length, 15);
  current = await read(first);
  record('Competing department edits admit one current revision and reject fifteen stale revisions');

  current = await apply(first, { action: 'rename_office', officeId: office.id, name: 'Stress verification office' }, current);
  const existingEmployees = new Set(current.snapshot.employees.map(employee => employee.id));
  const hireStart = performance.now();
  for (let index = 0; index < employeeCount; index++) {
    current = await apply(first, { action: 'hire_employee', companyId, officeId: office.id,
      departmentId: department.id, name: `Synthetic engineer ${index}`, role: 'Backend reliability engineer',
      skillPaths: ['skills/engineering-organization-architect/SKILL.md'] }, current);
  }
  const hiringMs = performance.now() - hireStart;
  const hired = current.snapshot.employees.filter(employee => employee.companyId === companyId && !existingEmployees.has(employee.id));
  assert.equal(hired.length, employeeCount);
  const employee = hired[0];
  const edit = { id: 'stress-update-employee', expectedStateHash: current.stateHash,
    command: { action: 'update_employee', employeeId: employee.id, role: 'Permanent backend workflow reviewer',
      skillPaths: ['skills/agent-research-director/SKILL.md'] } };
  const edited = await Promise.all(Array.from({ length: 16 }, (_, index) =>
    stableRequest(index % 2 ? first : second, '/v1/commands', edit)));
  assert.equal(edited.filter(response => response.status === 200 && response.result.replayed === false).length, 1);
  assert.equal(edited.filter(response => response.status === 200 && response.result.replayed === true).length, 15);
  current = await read(first);
  assert.equal(current.snapshot.employees.find(item => item.id === employee.id).role, edit.command.role);
  assert.equal(current.snapshot.employees.find(item => item.id === employee.id).departmentId, department.id);
  record('Persistent hires and role-definition edits preserve employee identity and placement', {
    addedEmployees: employeeCount, hiringMs: Math.round(hiringMs), hiresPerSecond: +(employeeCount * 1000 / hiringMs).toFixed(2) });

  const mismatch = await stableRequest(first, '/v1/commands', { ...edit, command: { ...edit.command, role: 'Changed replay body' } });
  assert.equal(mismatch.status, 409);
  assert.equal(mismatch.result.code, 'REMOTE_RECEIPT_MISMATCH');
  assert.equal((await read(first)).stateHash, current.stateHash);
  const protectedDonna = await stableRequest(first, '/v1/commands', {
    id: 'stress-protected-donna', expectedStateHash: current.stateHash, command: { action: 'fire_employee', employeeId: 'donna' },
  });
  assert.equal(protectedDonna.status, 400);
  assert.equal(protectedDonna.result.code, 'PERMANENT_ASSISTANT');
  assert.equal((await read(first)).stateHash, current.stateHash);
  record('Mismatched receipt replay and Donna removal preserve committed state');

  current = await apply(first, { action: 'pause_employee', employeeId: employee.id }, current);
  current = await apply(first, { action: 'update_employee', employeeId: employee.id, name: 'Paused workflow reviewer' }, current);
  current = await apply(first, { action: 'resume_employee', employeeId: employee.id }, current);
  current = await apply(first, { action: 'fire_employee', employeeId: employee.id }, current);
  const fired = current.snapshot.employees.find(item => item.id === employee.id);
  assert.equal(fired.status, 'fired');
  const rejected = await stableRequest(first, '/v1/commands', {
    id: 'stress-fired-edit', expectedStateHash: current.stateHash,
    command: { action: 'update_employee', employeeId: employee.id, role: 'Must not resurrect' },
  });
  assert.equal(rejected.status, 400);
  assert.equal(rejected.result.code, 'TERMINAL_STATE');
  assert.equal((await read(first)).stateHash, current.stateHash);
  assistants(current.snapshot);
  record('Pause, edit, resume and retire preserve history and permanent coordinator ownership');

  const readStart = performance.now();
  const loadedReads = await Promise.all(Array.from({ length: requestCount }, (_, index) =>
    read(index % 2 ? first : second)));
  const readMs = performance.now() - readStart;
  assert.ok(loadedReads.every(response => response.stateHash === current.stateHash));
  record('Concurrent reads of populated state return one consistent projection', {
    reads: requestCount, elapsedMs: Math.round(readMs), readsPerSecond: +(requestCount * 1000 / readMs).toFixed(2) });

  await first.close();
  await second.close();
  services.length = 0;
  const restored = await boot();
  const replayed = await stableRequest(restored, '/v1/commands', duplicated);
  assert.equal(replayed.status, 200);
  assert.equal(replayed.result.replayed, true);
  assert.equal(replayed.result.stateHash, current.stateHash);
  assistants(replayed.result.snapshot);
  assert.equal(restored.runtime.status().worker.enabled, false);
  assert.equal(externalCalls, 0);
  record('Restart retains native receipts, employee history, ownership and paused workers');
  await cleanup();
  record('All runtime controllers close and disposable state is removed before publishing success');

  const sorted = [...timings].sort((a, b) => a - b);
  const percentile = value => +sorted[Math.min(sorted.length - 1, Math.ceil(value * sorted.length) - 1)].toFixed(2);
  assert.equal(hashFile(binaryPath), nativeBinarySha256, 'Native executable changed during the stress run; rerun against one build.');
  const receipt = { ok: true, suite: 'backend-native-http-contention', schemaVersion: 1,
    checkedAt: new Date().toISOString(), durationMs: Math.round(performance.now() - start),
    nativeBinarySha256,
    runtime: { node: process.version, platform: process.platform, architecture: process.arch },
    load: { fullDaemonInstances: 1, independentNativeControllers: 2, maxConcurrentHttpPerController: 8, duplicateDeliveries: requestCount,
      employeesAdded: employeeCount, totalEmployees: current.snapshot.employees.length,
      httpRequests: timings.length, responseCounts, sameEnvelopeRetries: retryCount,
      httpAttemptLatencyMs: { p50: percentile(0.5), p95: percentile(0.95), max: +sorted.at(-1).toFixed(2) } },
    checks, providerCalls: externalCalls, privateWorkspaceUsed: false, infrastructureProvisioned: false,
    scope: 'Synthetic bounded functional load on this host; not a production capacity or multi-hour soak certification.' };
  const output = JSON.stringify(receipt, null, 2) + '\n';
  if (flags.has('output')) {
    const outputPath = path.resolve(flags.get('output'));
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, output);
  }
  process.stdout.write(output);
} finally {
  await cleanup();
}
