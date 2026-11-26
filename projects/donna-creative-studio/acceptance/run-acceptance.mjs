import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { CreativeToolsService } from '../../../headless-runtime/creative-tools.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const scene = path.join(repoRoot, 'desktop-shell/src/renderer/assets/donna-studio/donna-studio.blend');
const options = {};
for (let index = 2; index < process.argv.length; index++) {
  const flag = process.argv[index];
  if (flag === '--expect-optix-unavailable' && !options.gpuNegative) options.gpuNegative = true;
  else if (['--blender', '--output'].includes(flag) && process.argv[index + 1]) {
    const key = flag.slice(2);
    if (options[key]) throw new Error('Do not repeat options.');
    options[key] = process.argv[++index];
  } else throw new Error('Use --blender /absolute/blender --output /absolute/new-directory [--expect-optix-unavailable].');
}
for (const key of ['blender', 'output']) {
  if (typeof options[key] !== 'string' || !path.isAbsolute(options[key])
      || options[key].split(path.sep).includes('..')) throw new Error('Use explicit absolute local paths.');
}
const output = options.output;
const sanitizeText = text => text.replaceAll(repoRoot, '<repository>')
  .replace(/\/tmp\/daftar-donna-acceptance-[A-Za-z0-9]+/g, '<disposable-fixture>');
const sanitize = value => JSON.parse(sanitizeText(JSON.stringify(value)));
const hash = data => crypto.createHash('sha256').update(data).digest('hex');
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const files = ['headless-runtime/creative-tools.mjs', 'integrations/creative-tools/blender_worker.py',
  'integrations/creative-tools/blender_device.py', 'integrations/creative-tools/process_guard.py'];
const sourceHashes = () => Object.fromEntries(files.map(name => [name, hash(fs.readFileSync(path.join(repoRoot, name)))]));
if (fs.existsSync(output) || fs.realpathSync(path.dirname(output)) !== path.dirname(output)) throw new Error('Use a new evidence directory with regular ancestors.');
fs.mkdirSync(output, { mode: 0o700 });
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'daftar-donna-acceptance-'));
const projectRoot = path.join(temporary, 'project');
fs.mkdirSync(projectRoot, { mode: 0o700 });
fs.copyFileSync(scene, path.join(projectRoot, 'donna-studio.blend'));
const receipt = {
  schemaVersion: 1, suite: 'donna-real-blender-worker-acceptance', checkedAt: new Date().toISOString(),
  sourceScene: 'desktop-shell/src/renderer/assets/donna-studio/donna-studio.blend',
  sourceSha256: hash(fs.readFileSync(scene)), sourceBytes: fs.statSync(scene).size,
  scope: 'Disposable synthetic company, employee, assignment and authority snapshot; no owner workspace.',
  providerCalls: 0, privateWorkspaceUsed: false, gpuTested: false, cpuRenderVerified: false,
  implementationHashesBefore: sourceHashes(), jobs: [], processCalls: [], authorityChecks: 0,
  limits: { maxDurationMs: 45000, maxMemoryBytes: 4294967296, maxArtifactBytes: 33554432 },
};
const native = {
  companies: [{ id: 'fixture-company', status: 'active' }], offices: [], departments: [],
  employees: [{ id: 'fixture-artist', name: 'Acceptance fixture artist', role: 'Artist', kind: 'specialist',
    status: 'active', companyId: 'fixture-company', officeId: null, departmentId: null }],
  authority: { grants: [{ id: 'fixture-grant', employeeId: 'fixture-artist', issuer: 'owner',
    scope: { kind: 'company', id: 'fixture-company' }, capabilities: ['creative.execute'],
    grantedAt: new Date(Date.now() - 1000).toISOString(), expiresAt: new Date(Date.now() + 3600000).toISOString(),
    revokedAt: null, parentGrantIds: [] }] },
};
let service;
let failure;
const started = performance.now();

async function startService(renderDevice) {
  const configFile = path.join(temporary, `config-${renderDevice}.json`);
  fs.writeFileSync(configFile, JSON.stringify({ schemaVersion: 1,
    tools: { blender: { executable: options.blender, renderDevice, renderDeviceIndex: 0 } },
    projects: [{ id: 'fixture-project', companyId: 'fixture-company', root: projectRoot, trusted: true,
      allowedOperations: ['blender.inspect', 'blender.render'] }], limits: receipt.limits }), { mode: 0o600 });
  service = new CreativeToolsService({ stateDir: path.join(temporary, `state-${renderDevice}`), repoRoot,
    configFile, snapshot: async () => ({ ok: true, snapshot: native }) });
  const executeProcess = service.executeProcess.bind(service);
  service.executeProcess = async (executable, args, options) => {
    const entry = { executable, args, configuredRenderDevice: renderDevice,
      durationLimitMs: options.durationMs, memoryBytes: options.memoryBytes ?? 4294967296,
      gpuMemoryPrerequisite: options.gpuMemory === true };
    receipt.processCalls.push(entry);
    const began = performance.now();
    try {
      const result = await executeProcess(executable, args, options);
      entry.ok = true;
      fs.writeFileSync(path.join(output, `process-${receipt.processCalls.indexOf(entry)}.log`),
        sanitizeText(result.stdout + '\nSTDERR:\n' + result.stderr), { flag: 'wx', mode: 0o600 });
      return result;
    } catch (error) {
      entry.ok = false; entry.error = { code: error.code, message: error.message }; throw error;
    } finally { entry.wallSeconds = Number(((performance.now() - began) / 1000).toFixed(6)); }
  };
  const tool = (await service.snapshot({ companyId: 'fixture-company' })).tools.find(tool => tool.id === 'blender');
  receipt[`inventory${renderDevice}`] = tool;
  assert.equal(tool.available, true); assert.equal(tool.readiness, 'verified');
  await service.assign({ id: 'fixture-assignment', companyId: 'fixture-company', employeeId: 'fixture-artist',
    projectId: 'fixture-project', toolIds: ['blender'] });
}

async function run(operation, id, backend) {
  const request = { id, companyId: 'fixture-company', employeeId: 'fixture-artist', projectId: 'fixture-project',
    operation, input: { path: 'donna-studio.blend', ...(operation === 'blender.render'
      ? { frame: 1, width: 128, height: 128, samples: 4 } : {}) } };
  const began = performance.now();
  await service.run(request, { authorize: async () => { receipt.authorityChecks++; return true; } });
  let job;
  const deadline = Date.now() + receipt.limits.maxDurationMs + 5000;
  do { await wait(50); job = (await service.job({ companyId: request.companyId, jobId: id })).job; }
  while (['queued', 'running'].includes(job.status) && Date.now() < deadline);
  receipt.jobs.push({ ...job, observedWallSeconds: Number(((performance.now() - began) / 1000).toFixed(6)) });
  if (job.status !== 'succeeded') return job;
  const saved = service.registry.jobs.find(row => row.id === id);
  for (const artifact of job.outputs) {
    const bytes = fs.readFileSync(path.join(service.directory, 'artifacts', saved.storageId, 'outputs', artifact.path));
    assert.equal(bytes.length, artifact.bytes); assert.equal(hash(bytes), artifact.sha256);
    if (operation === 'blender.render') {
      assert.ok(bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])));
      assert.equal(bytes.readUInt32BE(16), 128); assert.equal(bytes.readUInt32BE(20), 128);
      assert.equal(job.result.device, backend === 'CPU' ? 'CPU' : 'GPU');
      assert.equal(job.result.backend, backend); assert.equal(job.result.samples, 4);
    } else assert.ok(JSON.parse(bytes).objects > 3);
    fs.writeFileSync(path.join(output, `${backend.toLowerCase()}-${artifact.path}`), bytes, { flag: 'wx', mode: 0o600 });
  }
  return job;
}

try {
  await startService('CPU');
  const inspection = await run('blender.inspect', 'donna-inspect', 'CPU');
  assert.equal(inspection.status, 'succeeded', JSON.stringify(inspection.error));
  const render = await run('blender.render', 'donna-render-cpu', 'CPU');
  assert.equal(render.status, 'succeeded', JSON.stringify(render.error));
  receipt.cpuRenderVerified = true;
  await service.close(); service = null;

  if (options.gpuNegative) {
  await startService('OPTIX');
  const negative = await run('blender.render', 'donna-render-optix-unavailable', 'OPTIX');
  assert.equal(negative.status, 'failed');
  assert.ok(['GPU_MEMORY_PREREQUISITE', 'GPU_DEVICE_UNAVAILABLE'].includes(negative.error?.code));
  receipt.gpuNegativePathVerified = true;
  receipt.gpuNegativeOutcome = negative.error;
  receipt.gpuTested = false;
  }
} catch (error) {
  failure = error; receipt.error = { code: error.code ?? 'ACCEPTANCE_FAILED', message: error.message };
} finally {
  await service?.close();
  fs.rmSync(temporary, { recursive: true, force: true });
  receipt.disposableStateRemoved = !fs.existsSync(temporary);
  receipt.implementationHashesAfter = sourceHashes();
  receipt.implementationUnchangedDuringRun = JSON.stringify(receipt.implementationHashesBefore) === JSON.stringify(receipt.implementationHashesAfter);
  receipt.totalWallSeconds = Number(((performance.now() - started) / 1000).toFixed(6));
  receipt.ok = !failure && receipt.disposableStateRemoved && receipt.implementationUnchangedDuringRun;
  fs.writeFileSync(path.join(output, 'receipt.json'), JSON.stringify(sanitize(receipt), null, 2) + '\n', { flag: 'wx', mode: 0o600 });
}
console.log(JSON.stringify({ ok: receipt.ok, cpuRenderVerified: receipt.cpuRenderVerified,
  gpuTested: receipt.gpuTested, gpuNegativeOutcome: receipt.gpuNegativeOutcome,
  totalWallSeconds: receipt.totalWallSeconds, error: receipt.error, output,
  jobs: receipt.jobs.map(job => ({ operation: job.operation, status: job.status, result: job.result,
    error: job.error, observedWallSeconds: job.observedWallSeconds, outputs: job.outputs })) }, null, 2));
if (!receipt.ok) process.exitCode = 1;
