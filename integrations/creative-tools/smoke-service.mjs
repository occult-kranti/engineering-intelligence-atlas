#!/usr/bin/env node
/** Real installed-Blender acceptance with a disposable native-authority fixture. */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { CreativeToolsService } from '../../headless-runtime/creative-tools.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

export async function smokeCreativeService({ blender, scene, output, renderDevice = 'CPU', renderDeviceIndex = 0, maxMemoryBytes = 4294967296 }) {
  if (!['CPU', 'CUDA', 'OPTIX'].includes(renderDevice) || !Number.isInteger(renderDeviceIndex) || renderDeviceIndex < 0 || renderDeviceIndex > 15
    || (renderDevice === 'CPU' && renderDeviceIndex !== 0) || !Number.isSafeInteger(maxMemoryBytes) || maxMemoryBytes < 268435456 || maxMemoryBytes > 17179869184) {
    throw new Error('Use CPU/CUDA/OPTIX, a device index 0–15, and a bounded memory allowance of 256 MiB–16 GiB.');
  }
  const durationMs = renderDevice === 'CPU' ? 30000 : 120000;
  for (const value of [blender, scene, output]) if (typeof value !== 'string' || !path.isAbsolute(value) || value.split(path.sep).includes('..')) throw new Error('Use explicit absolute fixture paths.');
  if (fs.existsSync(output) || fs.realpathSync(path.dirname(output)) !== path.dirname(path.resolve(output))) throw new Error('Use a new output directory with regular ancestors.');
  fs.mkdirSync(output, { mode: 0o700 });
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'daftar-real-creative-'));
  const projectRoot = path.join(temporary, 'project'); fs.mkdirSync(projectRoot, { mode: 0o700 });
  fs.copyFileSync(scene, path.join(projectRoot, 'scene.blend'));
  const configFile = path.join(temporary, 'config.json');
  fs.writeFileSync(configFile, JSON.stringify({ schemaVersion: 1, tools: { blender: { executable: blender, renderDevice, renderDeviceIndex } },
    projects: [{ id: 'fixture-project', companyId: 'fixture-company', root: projectRoot, trusted: true,
      allowedOperations: ['blender.inspect', 'blender.render', 'blender.export_glb'] }], limits: { maxDurationMs: durationMs, maxMemoryBytes } }), { mode: 0o600 });
  const native = { companies: [{ id: 'fixture-company', status: 'active' }], offices: [], departments: [],
    employees: [{ id: 'fixture-artist', name: 'Fixture artist', role: 'Artist', kind: 'specialist', status: 'active', companyId: 'fixture-company', officeId: null, departmentId: null }],
    authority: { grants: [{ id: 'fixture-authority', employeeId: 'fixture-artist', issuer: 'owner', scope: { kind: 'company', id: 'fixture-company' }, capabilities: ['creative.execute'],
      grantedAt: new Date(Date.now() - 1000).toISOString(), expiresAt: new Date(Date.now() + 3600000).toISOString(), revokedAt: null, parentGrantIds: [] }] } };
  const receipt = { schemaVersion: 1, suite: 'real-blender-creative-service', ok: false, checkedAt: new Date().toISOString(),
    checks: [], jobs: [], authorityChecks: 0, providerCalls: 0, privateWorkspaceUsed: false, nativeScopeFixture: true, vpsProvisioned: false, gpuTested: false,
    requestedRenderDevice: renderDevice, requestedDeviceIndex: renderDeviceIndex, maxMemoryBytes };
  let service; let failure;
  try {
    service = new CreativeToolsService({ stateDir: path.join(temporary, 'state'), repoRoot, configFile, snapshot: async () => ({ ok: true, snapshot: native }) });
    const tool = (await service.snapshot({ companyId: 'fixture-company' })).tools.find(row => row.id === 'blender');
    assert.equal(tool.available, true); assert.equal(tool.readiness, 'verified'); receipt.blenderVersion = tool.version;
    receipt.checks.push('The configured Blender executable passed its actual bounded version probe.');
    const assignment = { id: 'assign-fixture', companyId: 'fixture-company', employeeId: 'fixture-artist', projectId: 'fixture-project', toolIds: ['blender'] };
    await service.assign(assignment); assert.equal((await service.assign(assignment)).replayed, true);
    receipt.checks.push('Assignment persists and the same request replays without another change.');
    for (const operation of ['blender.inspect', 'blender.render', 'blender.export_glb']) {
      const id = operation.replace('.', '-'); const input = { path: 'scene.blend', ...(operation === 'blender.render' ? { frame: 1, width: 64, height: 64, samples: 2 } : {}) };
      const request = { id, companyId: 'fixture-company', employeeId: 'fixture-artist', projectId: 'fixture-project', operation, input };
      await service.run(request, { authorize: async () => { receipt.authorityChecks++; return true; } });
      let job; const deadline = Date.now() + durationMs + 5000;
      do { await wait(25); job = (await service.job({ companyId: request.companyId, jobId: id })).job; }
      while (['queued', 'running'].includes(job.status) && Date.now() < deadline);
      receipt.jobs.push(job); assert.equal(job.status, 'succeeded', `${operation} did not produce a successful receipt`);
      assert.equal(job.outputs.length, 1);
      const saved = service.registry.jobs.find(row => row.id === id); const artifact = job.outputs[0];
      const bytes = fs.readFileSync(path.join(service.directory, 'artifacts', saved.storageId, 'outputs', artifact.path));
      assert.equal(bytes.length, artifact.bytes); assert.equal(hash(bytes), artifact.sha256);
      if (operation === 'blender.inspect') assert.equal(JSON.parse(bytes).objects, 3);
      if (operation === 'blender.render') {
        assert.ok(bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])));
        assert.equal(bytes.readUInt32BE(16), 64); assert.equal(bytes.readUInt32BE(20), 64);
        assert.equal(job.result.device, renderDevice === 'CPU' ? 'CPU' : 'GPU'); assert.equal(job.result.backend, renderDevice);
        assert.equal(job.result.deviceCount, renderDevice === 'CPU' ? 0 : 1);
        if (renderDevice !== 'CPU') { assert.equal(job.result.deviceIndex, renderDeviceIndex); receipt.gpuTested = true; }
      }
      if (operation === 'blender.export_glb') { assert.equal(bytes.subarray(0, 4).toString(), 'glTF'); assert.equal(bytes.readUInt32LE(4), 2); assert.equal(bytes.readUInt32LE(8), bytes.length); }
      fs.writeFileSync(path.join(output, artifact.path), bytes, { flag: 'wx', mode: 0o600 });
      assert.equal((await service.run(request)).replayed, true);
      receipt.checks.push(`${operation} executed through the service, produced a format-checked hashed artifact, and replayed its original receipt.`);
    }
    assert.equal(service.registry.jobs.length, 3); assert.ok(receipt.authorityChecks >= 12);
    assert.equal(JSON.stringify(receipt.jobs).includes(temporary), false);
    receipt.checks.push('Native authority callbacks were rechecked and client receipts omit private runtime paths.');
  } catch (error) { failure = error; receipt.error = { code: typeof error.code === 'string' && /^[A-Z_]{1,80}$/.test(error.code) ? error.code : 'SMOKE_FAILED', message: 'The real creative service acceptance did not complete.' }; }
  finally {
    try { await service?.close(); fs.rmSync(temporary, { recursive: true, force: true });
      receipt.checks.push('The controller closed and disposable state was removed before publishing success.');
    } catch (error) { failure ??= error; }
    receipt.ok = !failure; fs.writeFileSync(path.join(output, 'receipt.json'), JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  }
  if (failure) throw new Error(`Creative service acceptance failed (${receipt.error?.code ?? 'CLEANUP_FAILED'}). Review the retained bounded receipt.`);
  return receipt;
}

export async function main(argv = process.argv.slice(2)) {
  const options = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = ({ '--blender': 'blender', '--scene': 'scene', '--output': 'output', '--render-device': 'renderDevice', '--device-index': 'renderDeviceIndex', '--max-memory-bytes': 'maxMemoryBytes' })[argv[index]];
    if (!key || Object.hasOwn(options, key) || !argv[index + 1]) throw new Error('Provide --blender, --scene and --output once, plus optional --render-device, --device-index and --max-memory-bytes.');
    const value = argv[index + 1];
    if (['renderDeviceIndex', 'maxMemoryBytes'].includes(key) && !/^\d+$/.test(value)) throw new Error('Device index and memory allowance must be unsigned integers.');
    options[key] = ['renderDeviceIndex', 'maxMemoryBytes'].includes(key) ? Number(value) : value;
  }
  const result = await smokeCreativeService(options); console.log(JSON.stringify(result)); return result;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(error => { console.error(error.message); process.exitCode = 1; });
