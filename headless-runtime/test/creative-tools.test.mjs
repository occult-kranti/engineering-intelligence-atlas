import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { fileURLToPath } from 'node:url';
import { CreativeToolsService, CreativeToolsError, readCreativeConfig } from '../creative-tools.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const fixtureProgram = `#!/usr/bin/python3
import json, os, pathlib, sys, time
args = sys.argv[1:]
if '--version' in args or '-version' in args:
    print('Blender 4.5.17; Inkscape 1.4.2; ffprobe version 7.1; Unreal Engine 5.6.0')
    sys.exit(0)
if '--' in args:
    operation, source, output, raw = args[args.index('--')+1:args.index('--')+5]
    inputs = json.loads(raw)
    render_policy = json.loads(args[args.index('--')+5]) if len(args) > args.index('--')+5 else {'backend':'CPU','deviceIndex':0}
elif '-of' in args:
    operation, source, output, inputs = 'ffmpeg.probe', args[-1], '.', {}
elif '-run=DataValidation' in args:
    operation, source, output, inputs = 'unreal.validate', args[0], '.', {}
else:
    operation, source, inputs = 'inkscape.export_png', args[0], {}
    output = os.path.dirname(next(item.split('=',1)[1] for item in args if item.startswith('--export-filename=')))
marker = pathlib.Path(source).read_text()
pathlib.Path('started').write_text(str(os.getpid()))
if 'WAIT' in marker: time.sleep(1.2)
if 'FLOOD' in marker:
    print('x'*30000)
    sys.exit(0)
if 'FAIL' in marker:
    print('/private/owner/credential.txt should never be projected', file=sys.stderr)
    sys.exit(3)
if operation == 'ffmpeg.probe':
    print(json.dumps({'format': {'format_name':'wav','duration':'1.25','filename':'/secret/source.wav'}, 'streams':[{'codec_type':'audio','codec_name':'pcm_s16le','sample_rate':'48000','channels':2,'secret':'private'}]}))
    sys.exit(0)
if operation == 'unreal.validate': sys.exit(0)
filename = 'inspection.json' if operation == 'blender.inspect' else 'scene.glb' if operation == 'blender.export_glb' else 'render.png'
destination = pathlib.Path(output)/filename
if 'SYMLINK' in marker:
    destination.symlink_to('/etc/passwd')
elif 'BIG' in marker:
    destination.write_bytes(b'x'*10000)
else:
    destination.write_text(json.dumps({'objects':3}) if filename.endswith('.json') else 'fixture-artifact')
result = {'format':'blend','objects':3,'meshes':1,'blenderVersion':'4.5.17','privatePath':'/private/owner/model.blend'}
if operation == 'blender.render': result.update({'engine':'CYCLES','device':'CPU','backend':'CPU','deviceCount':0,'renderDurationSeconds':0.01})
print('DAFTAR_RESULT='+json.dumps(result))
`;

function nativeState() {
  return { companies: [{ id: 'acme', status: 'active', assistantId: 'co-assistant' }, { id: 'other', status: 'active' }],
    offices: [{ id: 'studio', companyId: 'acme', status: 'active' }],
    departments: [{ id: 'design', companyId: 'acme', officeId: 'studio', status: 'active', parentDepartmentId: null }],
    employees: [
      { id: 'artist', name: 'Artist', role: 'Designer', kind: 'specialist', companyId: 'acme', officeId: 'studio', departmentId: 'design', status: 'active' },
      { id: 'donna', name: 'Donna', role: 'Coordinator', kind: 'assistant', companyId: null, officeId: null, departmentId: null, status: 'active' },
      { id: 'outsider', name: 'Other', kind: 'specialist', companyId: 'other', officeId: null, departmentId: null, status: 'active' },
    ], authority: { grants: [{ id: 'permission', employeeId: 'artist', issuer: 'owner', scope: { kind: 'company', id: 'acme' }, capabilities: ['creative.execute'],
      grantedAt: new Date(Date.now() - 10000).toISOString(), expiresAt: new Date(Date.now() + 3600000).toISOString(), revokedAt: null, parentGrantIds: [] }] } };
}
function setup(t, { limits = {}, configMissing = false } = {}) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'daftar-creative-test-'));
  const projectRoot = path.join(directory, 'reviewed'); fs.mkdirSync(projectRoot, { mode: 0o700 });
  const executable = path.join(directory, 'fixture-tool'); fs.writeFileSync(executable, fixtureProgram, { mode: 0o700 });
  const configFile = path.join(directory, 'creative.json');
  const operations = ['blender.inspect', 'blender.render', 'blender.export_glb', 'unreal.inspect', 'unreal.validate', 'inkscape.export_png', 'ffmpeg.probe'];
  const config = { schemaVersion: 1, tools: Object.fromEntries(['blender', 'unreal', 'inkscape', 'ffmpeg'].map(id => [id, { executable }])),
    projects: [{ id: 'reviewed', companyId: 'acme', departmentId: 'design', root: projectRoot, trusted: true, allowedOperations: operations }], limits: { maxDurationMs: 5000, ...limits } };
  const saveConfig = () => fs.writeFileSync(configFile, JSON.stringify(config), { mode: 0o600 }); saveConfig();
  fs.writeFileSync(path.join(projectRoot, 'scene.blend'), 'fixture'); fs.writeFileSync(path.join(projectRoot, 'media.wav'), 'fixture');
  const native = nativeState(); const spawns = [];
  const options = { stateDir: path.join(directory, 'state'), repoRoot, configFile: configMissing ? undefined : configFile,
    snapshot: async () => ({ ok: true, snapshot: structuredClone(native) }),
    spawnImpl: (...args) => { spawns.push(args); return spawn(...args); } };
  let service = new CreativeToolsService(options);
  t.after(async () => { await service.close(); fs.rmSync(directory, { recursive: true, force: true }); });
  const assignment = { id: 'assignment-one', companyId: 'acme', employeeId: 'artist', projectId: 'reviewed', toolIds: ['blender'] };
  const request = { id: 'job-one', companyId: 'acme', employeeId: 'artist', projectId: 'reviewed', operation: 'blender.inspect', input: { path: 'scene.blend' } };
  return { directory, projectRoot, config, configFile, saveConfig, native, spawns, options, assignment, request,
    get service() { return service; }, restart() { service = new CreativeToolsService(options); return service; } };
}
async function waitFor(service, id, expected = job => ['succeeded', 'failed', 'cancelled', 'interrupted'].includes(job.status), timeout = 7000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const { job } = await service.job({ companyId: 'acme', jobId: id }); if (expected(job)) return job;
    await delay(15);
  }
  assert.fail('Creative job did not reach its expected state');
}
async function waitStarted(fixture, id = 'job-one') {
  const deadline = Date.now() + 3000;
  while (Date.now() < deadline) {
    const row = fixture.service.registry.jobs.find(job => job.id === id);
    if (row && fs.existsSync(path.join(fixture.service.directory, 'artifacts', row.storageId, 'temporary', 'started'))) return;
    await delay(10);
  }
  assert.fail('Real fixture process did not start');
}
function code(expected) { return error => error instanceof CreativeToolsError && error.code === expected; }

test('unconfigured inventory is honest, scoped and contains no owner paths', async t => {
  const f = setup(t, { configMissing: true });
  const result = await f.service.snapshot({ companyId: 'acme' });
  assert.equal(result.configured, false); assert.ok(result.tools.every(tool => !tool.available && !tool.configured));
  assert.equal(f.spawns.length, 0); assert.equal(JSON.stringify(result).includes(f.directory), false);
  await assert.rejects(f.service.snapshot({ companyId: 'missing' }), code('CREATIVE_SCOPE_DENIED'));
  await assert.rejects(f.service.snapshot({ companyId: 'acme', employeeId: 'outsider' }), code('CREATIVE_SCOPE_DENIED'));
});

test('read-only configuration validation does not acquire a registry or probe executables', async t => {
  const f = setup(t); const before = fs.readFileSync(f.service.file);
  assert.equal(readCreativeConfig(f.configFile).projects[0].id, 'reviewed');
  assert.deepEqual(fs.readFileSync(f.service.file), before); assert.equal(f.spawns.length, 0);
  assert.deepEqual(readCreativeConfig(undefined).projects, []);
  f.config.limits.maxConcurrentJobs = 100; f.saveConfig();
  assert.throws(() => readCreativeConfig(f.configFile), code('CREATIVE_CONFIG_INVALID'));
});

test('Blender render backend is private validated configuration, not a caller argument', async t => {
  const f = setup(t); f.config.tools.blender.renderDevice = 'OPTIX'; f.config.tools.blender.renderDeviceIndex = 1; f.saveConfig();
  assert.equal(readCreativeConfig(f.configFile).tools.blender.renderDevice, 'OPTIX');
  const inventory = await f.service.snapshot({ companyId: 'acme' });
  assert.equal(inventory.tools[0].available, true); assert.equal(inventory.tools[0].renderDevice, 'OPTIX');
  assert.equal(inventory.tools[0].renderDeviceVerified, false);
  for (const [backend, index] of [['AUTO', 0], ['CPU', 1], ['CUDA', 16], ['CUDA', true]]) {
    Object.assign(f.config.tools.blender, { renderDevice: backend, renderDeviceIndex: index }); f.saveConfig();
    assert.throws(() => readCreativeConfig(f.configFile), code('CREATIVE_CONFIG_INVALID'));
  }
  Object.assign(f.config.tools.blender, { renderDevice: 'CPU', renderDeviceIndex: 0 }); f.saveConfig();
  await f.service.assign(f.assignment);
  await assert.rejects(f.service.run({ ...f.request, operation: 'blender.render', input: { path: 'scene.blend', renderDevice: 'CUDA' } }), code('INVALID_REQUEST'));
});

test('CPU render keeps guarded memory and records the confirmed CPU receipt', async t => {
  const f = setup(t); await f.service.assign(f.assignment);
  await f.service.run({ ...f.request, operation: 'blender.render' });
  const job = await waitFor(f.service, f.request.id);
  assert.equal(job.status, 'succeeded');
  assert.equal(job.result.device, 'CPU'); assert.equal(job.result.backend, 'CPU'); assert.equal(job.result.deviceCount, 0);
  assert.equal(job.result.renderDurationSeconds, 0.01);
  assert.equal(f.spawns[0][1].includes('--gpu-cgroup'), false);
  assert.deepEqual(JSON.parse(f.spawns[0][1].at(-1)), { backend: 'CPU', deviceIndex: 0 });
});

function simulatedChild(stderr, exitCode, stdout = '') {
  const child = new EventEmitter(); child.stdout = new PassThrough(); child.stderr = new PassThrough();
  queueMicrotask(() => { child.stdout.end(stdout); child.stderr.end(stderr); child.emit('close', exitCode); });
  return child;
}

test('GPU launch requires the cgroup guard and retains a clear missing-prerequisite receipt', async t => {
  const f = setup(t); await f.service.close();
  let argumentsSeen;
  f.options.spawnImpl = (_executable, args) => { argumentsSeen = args; return simulatedChild('DAFTAR_GUARD_ERROR=GPU_CGROUP_REQUIRED\n', 78); };
  f.restart(); f.config.tools.blender.renderDevice = 'OPTIX'; f.saveConfig();
  await f.service.assign(f.assignment); await f.service.run({ ...f.request, operation: 'blender.render' });
  const job = await waitFor(f.service, f.request.id);
  assert.equal(job.status, 'failed'); assert.equal(job.error.code, 'GPU_MEMORY_PREREQUISITE');
  assert.ok(argumentsSeen.includes('--gpu-cgroup'));
  assert.deepEqual(JSON.parse(argumentsSeen.at(-1)), { backend: 'OPTIX', deviceIndex: 0 });
  assert.equal(job.outputs.length, 0);
});

test('a GPU request cannot publish a successful CPU-fallback receipt', async t => {
  const f = setup(t); await f.service.close();
  f.options.spawnImpl = () => simulatedChild('', 0, 'DAFTAR_RESULT={"engine":"CYCLES","device":"CPU","backend":"CPU","deviceCount":0}\n');
  f.restart(); f.config.tools.blender.renderDevice = 'CUDA'; f.saveConfig();
  await f.service.assign(f.assignment); await f.service.run({ ...f.request, operation: 'blender.render' });
  const job = await waitFor(f.service, f.request.id);
  assert.equal(job.status, 'failed'); assert.equal(job.error.code, 'CREATIVE_DEVICE_MISMATCH');
});

test('a simulated GPU render preserves confirmed device metadata and hashed output', async t => {
  const f = setup(t); await f.service.close();
  f.options.spawnImpl = (_executable, args) => {
    assert.ok(args.includes('--gpu-cgroup'));
    const output = args[args.indexOf('--') + 3]; fs.writeFileSync(path.join(output, 'render.png'), 'synthetic render output');
    return simulatedChild('', 0, 'DAFTAR_RESULT={"engine":"CYCLES","device":"GPU","backend":"OPTIX","deviceCount":1,"deviceIndex":0,"deviceName":"Fixture GPU","renderDurationSeconds":0.05}\n');
  };
  f.restart(); f.config.tools.blender.renderDevice = 'OPTIX'; f.saveConfig();
  await f.service.assign(f.assignment); await f.service.run({ ...f.request, operation: 'blender.render' });
  const job = await waitFor(f.service, f.request.id);
  assert.equal(job.status, 'succeeded'); assert.equal(job.result.backend, 'OPTIX'); assert.equal(job.result.deviceCount, 1);
  assert.equal(job.result.deviceName, 'Fixture GPU'); assert.equal(job.result.renderDurationSeconds, 0.05);
  assert.match(job.outputs[0].sha256, /^[a-f0-9]{64}$/); assert.equal(JSON.stringify(job).includes(f.directory), false);
});

test('real child probes and fixed Blender operation produce bounded hashed evidence', async t => {
  const f = setup(t); const inventory = await f.service.snapshot({ companyId: 'acme' });
  assert.equal(inventory.tools.filter(tool => tool.available).length, 4); assert.equal(inventory.tools[0].version, '4.5.17');
  await f.service.assign(f.assignment); const accepted = await f.service.run(f.request);
  assert.equal(accepted.accepted, true); assert.equal(accepted.job.status, 'queued');
  const job = await waitFor(f.service, f.request.id); assert.equal(job.status, 'succeeded');
  assert.equal(job.result.objects, 3); assert.equal(job.outputs[0].path, 'inspection.json');
  assert.match(job.outputs[0].sha256, /^[a-f0-9]{64}$/); assert.equal(job.evidenceUri, 'creative://jobs/job-one');
  const launch = f.spawns.find(([, args]) => args.includes('--disable-autoexec'));
  assert.ok(launch); assert.equal(launch[2].shell, false); assert.ok(launch[1].includes('--factory-startup'));
  assert.ok(launch[1].some(argument => argument.endsWith('process_guard.py')));
  assert.equal(launch[2].env.GITHUB_TOKEN, undefined); assert.equal(JSON.stringify(job).includes('/private/'), false);
  assert.equal(JSON.stringify(job).includes(f.directory), false);
  const prepared = await f.service.prepareWorker({ companyId: 'acme', employeeId: 'artist' }); assert.equal(prepared.projects.length, 1);
});

test('32 duplicate deliveries share one durable process and changed bodies conflict', async t => {
  const f = setup(t); await f.service.assign(f.assignment);
  const results = await Promise.all(Array.from({ length: 32 }, () => f.service.run(structuredClone(f.request))));
  assert.equal(results.filter(result => !result.replayed).length, 1);
  const job = await waitFor(f.service, f.request.id); assert.equal(job.status, 'succeeded');
  assert.equal(f.spawns.length, 1); assert.equal(f.service.registry.jobs.length, 1);
  await assert.rejects(f.service.run({ ...f.request, input: { path: 'other.blend' } }), code('CREATIVE_RECEIPT_MISMATCH'));
  await assert.rejects(f.service.assign({ ...f.assignment, id: f.request.id }), code('CREATIVE_RECEIPT_MISMATCH'));
  f.native.authority.grants[0].revokedAt = new Date().toISOString();
  assert.equal((await f.service.run(f.request)).replayed, true);
  assert.equal((await f.service.assign(f.assignment)).replayed, true);
});

test('bounded queue rejects excess jobs while accepted jobs execute once', async t => {
  const f = setup(t, { limits: { maxConcurrentJobs: 1, maxQueuedJobs: 1 } });
  fs.writeFileSync(path.join(f.projectRoot, 'scene.blend'), 'WAIT'); await f.service.assign(f.assignment);
  await f.service.run(f.request); await f.service.run({ ...f.request, id: 'job-two' });
  await assert.rejects(f.service.run({ ...f.request, id: 'job-three' }), code('CREATIVE_BUSY'));
  assert.equal((await waitFor(f.service, 'job-one')).status, 'succeeded');
  assert.equal((await waitFor(f.service, 'job-two')).status, 'succeeded'); assert.equal(f.spawns.length, 2);
});

test('assignment cannot grant capability and exact current authority is required', async t => {
  const f = setup(t); await f.service.assign(f.assignment); const grant = structuredClone(f.native.authority.grants[0]);
  for (const changed of [[], [{ ...grant, scope: { kind: 'company', id: 'other' } }], [{ ...grant, revokedAt: new Date().toISOString() }],
    [{ ...grant, expiresAt: new Date(Date.now() - 1).toISOString() }], [{ ...grant, capabilities: ['team.manage'] }]]) {
    f.native.authority.grants = changed; await assert.rejects(f.service.run(f.request), code('CREATIVE_AUTHORITY_DENIED'));
  }
  f.native.authority.grants = [grant]; f.native.departments[0].status = 'paused';
  await assert.rejects(f.service.run(f.request), code('CREATIVE_SCOPE_DENIED'));
  f.native.departments[0].status = 'active'; f.native.employees[0].status = 'fired';
  await assert.rejects(f.service.run(f.request), code('CREATIVE_SCOPE_DENIED'));
  assert.equal(f.spawns.length, 0);
});

test('delegated creative grants require live owner parents with matching capabilities and lifetime', async t => {
  const f = setup(t); await f.service.assign(f.assignment);
  const original = structuredClone(f.native.authority.grants[0]);
  const parent = { ...original, id: 'donna-parent', employeeId: 'donna', capabilities: ['authority.manage', 'creative.execute'], expiresAt: new Date(Date.now() + 7200000).toISOString() };
  const child = { ...original, issuer: 'donna', parentGrantIds: ['donna-parent'] };
  f.native.authority.grants = [parent, child];
  await f.service.run(f.request); assert.equal((await waitFor(f.service, f.request.id)).status, 'succeeded');
  for (const [index, change] of [
    { revokedAt: new Date().toISOString() }, { capabilities: ['authority.manage'] }, { capabilities: ['creative.execute'] },
    { scope: { kind: 'company', id: 'other' } }, { expiresAt: new Date(Date.now() + 1000).toISOString() },
  ].entries()) {
    f.native.authority.grants = [{ ...parent, ...change }, child];
    await assert.rejects(f.service.run({ ...f.request, id: `denied-child-${index}` }), code('CREATIVE_AUTHORITY_DENIED'));
  }
  assert.equal(f.spawns.length, 1);
});

test('Donna remains global and cross-company employees cannot borrow her assignment', async t => {
  const f = setup(t);
  await assert.rejects(f.service.assign({ ...f.assignment, employeeId: 'outsider' }), code('CREATIVE_SCOPE_DENIED'));
  await f.service.assign({ ...f.assignment, employeeId: 'donna' });
  f.native.authority.grants[0].employeeId = 'donna';
  const request = { ...f.request, employeeId: 'donna' }; await f.service.run(request);
  assert.equal((await waitFor(f.service, request.id)).status, 'succeeded');
  f.native.employees[1].companyId = 'other';
  await assert.rejects(f.service.run({ ...request, id: 'donna-wrong-scope' }), code('CREATIVE_SCOPE_DENIED'));
});

test('worker preflight keeps Donna project choices inside the native job department and office', async t => {
  const f = setup(t);
  f.native.offices.push({ id: 'second-office', companyId: 'acme', status: 'active' });
  f.native.departments.push({ id: 'second-department', companyId: 'acme', officeId: 'second-office', status: 'active', parentDepartmentId: null });
  f.config.projects.push({ ...f.config.projects[0], id: 'second-project', departmentId: 'second-department' }); f.saveConfig();
  f.native.authority.grants[0].employeeId = 'donna';
  await f.service.assign({ ...f.assignment, employeeId: 'donna' });
  await f.service.assign({ ...f.assignment, id: 'second-assignment', employeeId: 'donna', projectId: 'second-project' });
  const prepared = await f.service.prepareWorker({ companyId: 'acme', employeeId: 'donna', officeId: 'studio', departmentId: 'design' });
  assert.deepEqual(prepared.projects.map(project => project.id), ['reviewed']);
  assert.deepEqual(prepared.assignments.map(assignment => assignment.projectId), ['reviewed']);
  await assert.rejects(f.service.prepareWorker({ companyId: 'acme', employeeId: 'donna', officeId: 'missing-office' }), code('CREATIVE_NOT_READY'));
});

test('revocation during a real process stops completion and keeps its receipt', async t => {
  const f = setup(t); fs.writeFileSync(path.join(f.projectRoot, 'scene.blend'), 'WAIT'); await f.service.assign(f.assignment);
  await f.service.run(f.request); await waitStarted(f);
  f.native.authority.grants[0].revokedAt = new Date().toISOString();
  const job = await waitFor(f.service, f.request.id); assert.equal(job.status, 'failed'); assert.equal(job.error.code, 'CREATIVE_AUTHORITY_DENIED');
  assert.equal(job.outputs.length, 0); assert.equal((await f.service.run(f.request)).replayed, true);
});

test('assignment removal and department ancestor pause remain live during execution', async t => {
  for (const change of ['assignment', 'ancestor']) {
    await t.test(change, async t => {
      const f = setup(t); fs.writeFileSync(path.join(f.projectRoot, 'scene.blend'), 'WAIT'); await f.service.assign(f.assignment);
      f.native.departments.push({ id: 'parent', companyId: 'acme', officeId: 'studio', status: 'active', parentDepartmentId: null });
      f.native.departments[0].parentDepartmentId = 'parent';
      await f.service.run(f.request); await waitStarted(f);
      if (change === 'assignment') await f.service.assign({ ...f.assignment, id: 'remove-tools', toolIds: [] });
      else f.native.departments[1].status = 'paused';
      assert.equal((await waitFor(f.service, f.request.id)).status, 'failed');
    });
  }
});

test('owner project changes stop current work and removed directories cannot block revocation', async t => {
  const f = setup(t); fs.writeFileSync(path.join(f.projectRoot, 'scene.blend'), 'WAIT'); await f.service.assign(f.assignment);
  await f.service.run(f.request); await waitStarted(f);
  f.config.projects[0].allowedOperations = ['blender.inspect']; f.saveConfig();
  const job = await waitFor(f.service, f.request.id); assert.equal(job.status, 'failed'); assert.equal(job.error.code, 'CREATIVE_CONFIGURATION_CHANGED');
  fs.rmSync(f.projectRoot, { recursive: true });
  const removal = await f.service.assign({ ...f.assignment, id: 'remove-missing-project', toolIds: [] }); assert.deepEqual(removal.assignment.toolIds, []);
  f.config.projects = []; f.saveConfig();
  assert.equal((await f.service.assign(f.assignment)).replayed, true);
});

test('queued input replacement cannot silently change the admitted file', async t => {
  const f = setup(t); fs.writeFileSync(path.join(f.projectRoot, 'scene.blend'), 'WAIT');
  fs.writeFileSync(path.join(f.projectRoot, 'second.blend'), 'original'); await f.service.assign(f.assignment);
  await f.service.run(f.request); await waitStarted(f);
  await f.service.run({ ...f.request, id: 'queued-input', input: { path: 'second.blend' } });
  fs.writeFileSync(path.join(f.projectRoot, 'second.blend'), 'modified input after admission');
  assert.equal((await waitFor(f.service, f.request.id)).status, 'succeeded');
  const changed = await waitFor(f.service, 'queued-input'); assert.equal(changed.status, 'failed'); assert.equal(changed.error.code, 'CREATIVE_INPUT_CHANGED');
  assert.equal(f.spawns.length, 1);
});

test('invalid owner configuration fails queued jobs without launching or leaving them stuck', async t => {
  const f = setup(t); fs.writeFileSync(path.join(f.projectRoot, 'scene.blend'), 'WAIT'); await f.service.assign(f.assignment);
  await f.service.run(f.request); await waitStarted(f); await f.service.run({ ...f.request, id: 'queued-invalid-config' });
  fs.writeFileSync(f.configFile, '{invalid owner configuration');
  assert.equal((await waitFor(f.service, f.request.id)).status, 'failed');
  const queued = await waitFor(f.service, 'queued-invalid-config'); assert.equal(queued.status, 'failed'); assert.equal(queued.error.code, 'CREATIVE_CONFIG_INVALID');
  assert.equal(f.spawns.length, 1);
});

test('native callback is checked before process launch and before successful completion', async t => {
  const f = setup(t); await f.service.assign(f.assignment);
  await assert.rejects(f.service.run(f.request, { authorize: async () => false }), code('CREATIVE_AUTHORITY_DENIED'));
  assert.equal(f.spawns.length, 0);
  let calls = 0;
  await f.service.run(f.request, { authorize: async () => ++calls < 4 });
  const job = await waitFor(f.service, f.request.id); assert.equal(job.status, 'failed'); assert.equal(job.error.code, 'CREATIVE_AUTHORITY_DENIED');
  assert.equal(f.spawns.length, 1); assert.ok(calls >= 4);
});

test('hostile paths, injected commands, symlinks and unsafe config fail before launch', async t => {
  const f = setup(t); await f.service.assign(f.assignment);
  for (const filename of ['../outside.blend', '/tmp/input.blend', 'folder/../scene.blend', 'C:\\scene.blend', 'a//b.blend', '%2e%2e/scene.blend']) {
    await assert.rejects(f.service.run({ ...f.request, input: { path: filename } }), code('PATH_DENIED'));
  }
  await assert.rejects(f.service.run({ ...f.request, input: { path: 'scene.blend', python: 'print(1)' } }), code('INVALID_REQUEST'));
  await assert.rejects(f.service.run({ ...f.request, operation: 'blender.python' }), code('OPERATION_DENIED'));
  fs.symlinkSync(path.join(f.projectRoot, 'scene.blend'), path.join(f.projectRoot, 'linked.blend'));
  await assert.rejects(f.service.run({ ...f.request, input: { path: 'linked.blend' } }), code('PATH_DENIED'));
  fs.chmodSync(f.configFile, 0o644);
  await assert.rejects(f.service.snapshot({ companyId: 'acme' }), code('CREATIVE_CONFIG_INVALID'));
  assert.equal(f.spawns.length, 0);
});

test('duration, console, artifact limits and malicious output links are bounded', async t => {
  for (const [marker, limits, codes] of [
    ['WAIT', { maxDurationMs: 150 }, ['CREATIVE_TIMEOUT']], ['FLOOD', { maxOutputBytes: 1024 }, ['CREATIVE_OUTPUT_LIMIT']],
    ['BIG', { maxArtifactBytes: 1024 }, ['TOOL_EXIT_FAILED', 'CREATIVE_ARTIFACT_LIMIT']], ['SYMLINK', {}, ['PATH_DENIED']],
    ['FAIL', {}, ['TOOL_EXIT_FAILED']],
  ]) await t.test(marker, async t => {
    const f = setup(t, { limits }); fs.writeFileSync(path.join(f.projectRoot, 'scene.blend'), marker); await f.service.assign(f.assignment);
    await f.service.run(f.request); const job = await waitFor(f.service, f.request.id);
    assert.equal(job.status, 'failed'); assert.ok(codes.includes(job.error.code), job.error.code);
    assert.equal(JSON.stringify(job).includes('/private/owner/'), false);
  });
});

test('cancellation and shutdown preserve identity; interrupted jobs never auto replay', async t => {
  const f = setup(t); fs.writeFileSync(path.join(f.projectRoot, 'scene.blend'), 'WAIT'); await f.service.assign(f.assignment);
  await f.service.run(f.request); await waitStarted(f);
  const cancel = { id: 'cancel-one', companyId: 'acme', jobId: f.request.id };
  assert.equal((await f.service.cancel(cancel)).job.status, 'cancelled'); assert.equal((await f.service.cancel(cancel)).replayed, true);
  await f.service.close();
  const registryFile = path.join(f.directory, 'state', 'creative-tools', 'registry.json');
  const saved = JSON.parse(fs.readFileSync(registryFile)); saved.jobs[0].status = 'running'; delete saved.jobs[0].finishedAt;
  fs.writeFileSync(registryFile, JSON.stringify(saved)); f.restart();
  const replay = await f.service.run(f.request); assert.equal(replay.replayed, true); assert.equal(replay.job.status, 'interrupted');
  assert.equal(f.spawns.length, 1);
  await assert.rejects(f.service.job({ companyId: 'other', jobId: f.request.id }), code('CREATIVE_JOB_NOT_FOUND'));
});

test('one controller owns durable state and invalid restoration is rejected', async t => {
  const f = setup(t); assert.throws(() => new CreativeToolsService(f.options), code('CREATIVE_STATE_BUSY'));
  await f.service.close(); const registryFile = path.join(f.directory, 'state', 'creative-tools', 'registry.json');
  fs.writeFileSync(registryFile, '{broken'); assert.throws(() => new CreativeToolsService(f.options), code('CREATIVE_STATE_INVALID'));
});

test('Linux guard terminates the real tool when its controller crashes; restart retains an interrupted receipt', async t => {
  const f = setup(t); fs.writeFileSync(path.join(f.projectRoot, 'scene.blend'), 'WAIT'); await f.service.close();
  const source = `import fs from 'node:fs'; import path from 'node:path'; import { CreativeToolsService } from ${JSON.stringify(new URL('../creative-tools.mjs', import.meta.url).href)};
    const service = new CreativeToolsService({stateDir:${JSON.stringify(f.options.stateDir)},repoRoot:${JSON.stringify(repoRoot)},configFile:${JSON.stringify(f.configFile)},snapshot:async()=>({ok:true,snapshot:${JSON.stringify(f.native)}})});
    await service.assign(${JSON.stringify(f.assignment)}); await service.run(${JSON.stringify(f.request)});
    for(;;){const row=service.registry.jobs[0];const marker=path.join(service.directory,'artifacts',row.storageId,'temporary','started');if(fs.existsSync(marker)){console.log(fs.readFileSync(marker,'utf8'));break;}await new Promise(resolve=>setTimeout(resolve,5));}
    setInterval(()=>{},1000);`;
  const child = spawn(process.execPath, ['--input-type=module', '-e', source], { stdio: ['ignore', 'pipe', 'pipe'] });
  t.after(() => { child.kill('SIGKILL'); });
  const toolPid = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Fixture controller did not start its tool')), 5000); let output = '';
    child.stdout.on('data', data => { output += data; if (/^\d+\n/.test(output)) { clearTimeout(timer); resolve(Number(output.trim())); } });
    child.once('error', error => { clearTimeout(timer); reject(error); });
  });
  child.kill('SIGKILL'); await new Promise(resolve => child.once('exit', resolve));
  const running = () => {
    try { const stat = fs.readFileSync(`/proc/${toolPid}/stat`, 'utf8'); return !['Z', 'X'].includes(stat.slice(stat.lastIndexOf(')') + 2).split(' ')[0]); }
    catch { return false; }
  };
  const deadline = Date.now() + 1000; while (running() && Date.now() < deadline) await delay(10);
  assert.equal(running(), false, 'The immediate creative tool must not survive controller death');
  f.restart(); const replay = await f.service.run(f.request);
  assert.equal(replay.replayed, true); assert.equal(replay.job.status, 'interrupted'); assert.deepEqual(replay.job.outputs, []);
});

test('SVG export and media probe keep only fixed safe metadata; Unreal inspect does not pretend to execute the engine', async t => {
  const f = setup(t); await f.service.assign({ ...f.assignment, toolIds: ['inkscape', 'ffmpeg', 'unreal'] });
  fs.writeFileSync(path.join(f.projectRoot, 'vector.svg'), '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect width="32" height="32"/></svg>');
  fs.writeFileSync(path.join(f.projectRoot, 'game.uproject'), JSON.stringify({ FileVersion: 3, EngineAssociation: '5.6', Modules: [{ Name: 'private-name' }], Plugins: [] }));
  for (const [operation, filename] of [['inkscape.export_png', 'vector.svg'], ['ffmpeg.probe', 'media.wav'], ['unreal.inspect', 'game.uproject']]) {
    const id = operation.replace('.', '-'); await f.service.run({ ...f.request, id, operation, input: { path: filename } });
    const job = await waitFor(f.service, id); assert.equal(job.status, 'succeeded');
    assert.equal(JSON.stringify(job).includes('private-name'), false); assert.equal(JSON.stringify(job).includes('/secret/'), false);
    if (operation === 'unreal.inspect') assert.equal(job.result.engineExecuted, false);
    if (operation === 'ffmpeg.probe') assert.equal(job.result.streams[0].sampleRate, 48000);
  }
  fs.writeFileSync(path.join(f.projectRoot, 'vector.svg'), '<svg><image href="file:///etc/passwd"/></svg>');
  await f.service.run({ ...f.request, id: 'unsafe-svg', operation: 'inkscape.export_png', input: { path: 'vector.svg' } });
  const denied = await waitFor(f.service, 'unsafe-svg'); assert.equal(denied.error.code, 'CREATIVE_INPUT_UNSAFE');
});

test('Adobe fixture readiness sends no request; explicit opt-in and safe partial receipts survive failure', async t => {
  const f = setup(t); const adapterDirectory = path.join(f.directory, 'fixture-repo', 'integrations', 'adobe'); fs.mkdirSync(adapterDirectory, { recursive: true });
  const counter = path.join(f.directory, 'adobe-invocations');
  fs.writeFileSync(path.join(adapterDirectory, 'photoshop-api.mjs'), `import fs from 'node:fs'; import path from 'node:path';
    export async function executePhotoshopOperation({operation,inputPath,outputDir,authorize}) {
      await authorize(); fs.appendFileSync(${JSON.stringify(counter)},'request\\n');
      const receipt={provider:'adobe-photoshop-v2',operation,state:'outcome_unconfirmed',cleanup:'pending',inputSha256:'a'.repeat(64),adobeJobId:'adobe-fixture-1'};
      fs.writeFileSync(path.join(outputDir,'adobe-receipt.json'),JSON.stringify(receipt),{mode:0o600});
      if(fs.readFileSync(inputPath,'utf8').includes('FAIL'))throw Object.assign(new Error('/private/credential must not escape'),{code:'ADOBE_OUTCOME_UNCONFIRMED'});
      fs.writeFileSync(path.join(outputDir,'manifest.json'),JSON.stringify({layers:2}));
      return {result:{provider:'adobe',operation,remoteAuthVerified:true,inputSha256:'a'.repeat(64),adobeJobId:'adobe-fixture-1',cleanup:'complete',privatePath:'/private/asset'}};
    }`);
  f.service.repoRoot = path.join(f.directory, 'fixture-repo');
  const secret = name => { const file = path.join(f.directory, name); fs.writeFileSync(file, '{}', { mode: 0o600 }); return file; };
  f.config.tools = { 'adobe-photoshop': { enabled: true, allowPaidRequests: true, clientIdFile: secret('client-id'), clientSecretFile: secret('client-secret'), assetStorageFile: secret('asset-storage') } };
  f.config.projects[0].allowedOperations = ['adobe.manifest', 'adobe.render']; f.saveConfig();
  fs.writeFileSync(path.join(f.projectRoot, 'document.psd'), 'fixture');
  const inventory = await f.service.snapshot({ companyId: 'acme' }); const adobe = inventory.tools.find(row => row.id === 'adobe-photoshop');
  assert.equal(adobe.available, true); assert.equal(adobe.remoteAuthVerified, false); assert.equal(adobe.readiness, 'configured_unverified'); assert.equal(fs.existsSync(counter), false);
  await f.service.assign({ ...f.assignment, toolIds: ['adobe-photoshop'] });
  const request = { ...f.request, operation: 'adobe.manifest', input: { path: 'document.psd' } };
  await assert.rejects(f.service.run(request), code('EXTERNAL_UPLOAD_DENIED'));
  await assert.rejects(f.service.run({ ...request, input: { path: 'document.psb' } }), code('INPUT_TYPE_DENIED'));
  f.config.projects[0].allowExternalUpload = true; f.saveConfig();
  await f.service.run(request); const success = await waitFor(f.service, request.id);
  assert.equal(success.status, 'succeeded'); assert.equal(success.outputs.length, 2); assert.equal(success.result.remoteAuthVerified, true);
  assert.equal(success.result.adobeJobId, 'adobe-fixture-1'); assert.equal(JSON.stringify(success).includes('/private/'), false);
  fs.writeFileSync(path.join(f.projectRoot, 'document.psd'), 'FAIL');
  const failedRequest = { ...request, id: 'uncertain-remote' }; await f.service.run(failedRequest);
  const failed = await waitFor(f.service, failedRequest.id); assert.equal(failed.status, 'failed');
  assert.equal(failed.error.code, 'ADOBE_OUTCOME_UNCONFIRMED'); assert.equal(failed.outputs[0].path, 'adobe-receipt.json');
  assert.equal(JSON.stringify(failed).includes('/private/credential'), false);
  await f.service.close(); f.restart();
  const replay = await f.service.run(failedRequest); assert.equal(replay.replayed, true); assert.equal(replay.job.outputs[0].path, 'adobe-receipt.json');
  assert.equal(fs.readFileSync(counter, 'utf8').trim().split('\n').length, 2);
});
