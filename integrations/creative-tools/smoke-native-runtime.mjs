#!/usr/bin/env node
/** Real native employee/grant -> stdio MCP -> HTTP -> installed Blender. No model calls. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { execFileSync, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createNativeCall } from '../../tools/atlas-mcp.mjs';
import { startServer } from '../../headless-runtime/server.mjs';
import { setupCreativeCompany } from './setup-company.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

function connect(origin, tokenFile) {
  const child = spawn(process.execPath, [path.join(repoRoot, 'tools/daftar-runtime-mcp.mjs')], {
    cwd: repoRoot, env: { PATH: process.env.PATH, DAFTAR_RUNTIME_URL: origin, DAFTAR_CONTROL_TOKEN_FILE: tokenFile }, stdio: ['pipe', 'pipe', 'pipe'] });
  let sequence = 0, buffer = ''; const pending = new Map(); child.stderr.resume();
  child.stdout.setEncoding('utf8'); child.stdout.on('data', chunk => {
    buffer += chunk; if (Buffer.byteLength(buffer) > 2 * 1024 * 1024) { child.kill('SIGKILL'); return; }
    let newline; while ((newline = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, newline); buffer = buffer.slice(newline + 1);
      let message; try { message = JSON.parse(line); } catch { child.kill('SIGKILL'); continue; }
      const request = pending.get(message.id); if (request) { clearTimeout(request.timer); pending.delete(message.id); request.resolve(message); }
    }
  });
  const exited = new Promise(resolve => child.once('exit', code => {
    for (const request of pending.values()) { clearTimeout(request.timer); request.reject(new Error('MCP exited before its reply')); }
    pending.clear(); resolve(code);
  }));
  child.once('error', () => { for (const request of pending.values()) { clearTimeout(request.timer); request.reject(new Error('MCP could not start')); } pending.clear(); });
  return {
    call(method, params) { return new Promise((resolve, reject) => {
      const id = ++sequence; const timer = setTimeout(() => { pending.delete(id); reject(new Error('MCP request exceeded 15 seconds')); }, 15000);
      pending.set(id, { resolve, reject, timer }); child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
    }); },
    async close() { child.stdin.end(); const timer = setTimeout(() => child.kill('SIGKILL'), 3000); try { await exited; } finally { clearTimeout(timer); } },
  };
}
async function tool(client, name, args) {
  const message = await client.call('tools/call', { name, arguments: args });
  assert.equal(message.error, undefined); assert.equal(message.result?.isError, false, JSON.stringify(message.result?.structuredContent));
  return message.result.structuredContent;
}

export async function smokeNativeRuntime({ blender, scene, output }) {
  for (const value of [blender, scene, output]) if (typeof value !== 'string' || !path.isAbsolute(value) || value.split(path.sep).includes('..')) throw new Error('Use absolute fixture paths.');
  if (fs.existsSync(output) || fs.realpathSync(path.dirname(output)) !== path.dirname(path.resolve(output))) throw new Error('Use a new output directory with regular ancestors.');
  fs.mkdirSync(output, { mode: 0o700 });
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'daftar-native-creative-'));
  const dataDir = path.join(temporary, 'runtime'), projectRoot = path.join(temporary, 'project'), configFile = path.join(temporary, 'creative.json');
  fs.mkdirSync(dataDir, { mode: 0o700 }); fs.mkdirSync(projectRoot, { mode: 0o700 });
  const tokenFile = path.join(temporary, 'control-token'); fs.writeFileSync(tokenFile, crypto.randomBytes(32).toString('base64url') + '\n', { mode: 0o600 });
  const core = path.join(repoRoot, 'native-core/target/release/atlas-core');
  const receipt = { schemaVersion: 1, suite: 'real-native-stdio-http-blender', ok: false, checkedAt: new Date().toISOString(), checks: [],
    providerCalls: 0, privateWorkspaceUsed: false, nativeScopeFixture: false, disposableNativeWorkspace: true, vpsProvisioned: false, gpuTested: false };
  let runtime; let client; let failure;
  try {
    const git = args => execFileSync('git', ['-c', 'core.fsmonitor=false', '-c', 'core.hooksPath=/dev/null', '-C', projectRoot, ...args], {
      encoding: 'utf8', timeout: 10000, stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_'))), GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null' },
    });
    git(['init', '--initial-branch=main']); git(['config', 'user.name', 'Synthetic fixture']); git(['config', 'user.email', 'fixture@example.test']);
    git(['remote', 'add', 'origin', 'https://github.com/example/creative-fixture.git']);
    fs.writeFileSync(path.join(projectRoot, 'README.md'), 'Disposable native creative acceptance.\n');
    fs.copyFileSync(scene, path.join(projectRoot, 'scene.blend')); git(['add', 'README.md', 'scene.blend']); git(['commit', '-m', 'Disposable creative fixture']);
    fs.writeFileSync(configFile, JSON.stringify({ schemaVersion: 1, tools: { blender: { executable: blender } }, projects: [], limits: { maxDurationMs: 30000 } }), { mode: 0o600 });
    const native = createNativeCall({ repoRoot, binary: core, seedDir: path.join(repoRoot, 'company'), stateDir: path.join(dataDir, 'company') });
    const invoke = async (operation, payload = {}) => { const result = await native(operation, payload); assert.equal(result.ok, true, result.code); return result.snapshot; };
    await invoke('office_snapshot'); const companyId = 'native-creative-fixture';
    await invoke('office_command', { action: 'create_company', id: companyId, name: 'Disposable creative studio', repoUrl: 'https://github.com/example/creative-fixture' });
    const setup = await setupCreativeCompany({ userDataPath: dataDir, companyId, projectRoot, repository: 'example/creative-fixture', configFile, core, apply: true });
    const employeeId = setup.kit.companies[0].employeeIds[1];
    const assignment = setup.assignments.find(row => row.employeeId === employeeId);
    const nativeBefore = await invoke('office_snapshot'); const employee = nativeBefore.employees.find(row => row.id === employeeId);
    const grant = nativeBefore.authority.grants.find(row => row.employeeId === employeeId && row.capabilities.includes('creative.execute'));
    assert.equal(employee.status, 'active'); assert.equal(grant.issuer, 'owner'); assert.equal(grant.scope.kind, 'department'); assert.equal(grant.scope.id, employee.departmentId);
    assert.ok(assignment.toolIds.includes('blender'));
    receipt.checks.push('The setup helper created real native specialists, departments, scoped owner authority and persistent tool assignments without starting a job.');
    const start = async () => {
      runtime = await startServer({ repoRoot, dataDir, binaryPath: core, creativeConfigFile: configFile, tokenFile, host: '127.0.0.1', port: 0,
        generate: async () => { receipt.providerCalls++; throw new Error('Provider calls are forbidden in this acceptance'); } });
      client = connect(`http://127.0.0.1:${runtime.server.address().port}`, tokenFile);
      const initialized = await client.call('initialize', { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'creative-native-smoke', version: '1' } });
      assert.equal(initialized.result.serverInfo.name, 'daftar-runtime');
    };
    await start(); assert.equal((await tool(client, 'runtime_status', {})).worker.enabled, false);
    const inventory = await tool(client, 'creative_inventory', { companyId, employeeId });
    assert.equal(inventory.tools.find(row => row.id === 'blender').available, true);
    assert.ok(inventory.assignments.some(row => row.employeeId === employeeId && row.projectId === assignment.projectId));
    receipt.blenderVersion = inventory.tools.find(row => row.id === 'blender').version;
    receipt.checks.push('A real stdio MCP client discovered the native employee assignment and verified Blender through the authenticated HTTP runtime.');
    const request = { id: 'native-backed-render', companyId, employeeId, projectId: assignment.projectId, operation: 'blender.render', input: { path: 'scene.blend', width: 64, height: 64, samples: 2, frame: 1 } };
    const accepted = await tool(client, 'creative_run', request); assert.equal(accepted.accepted, true);
    let result; const deadline = Date.now() + 35000;
    do { await wait(40); result = await tool(client, 'creative_job', { companyId, jobId: request.id }); }
    while (['queued', 'running'].includes(result.job.status) && Date.now() < deadline);
    assert.equal(result.job.status, 'succeeded'); assert.equal(result.job.employeeId, employeeId);
    const stored = runtime.runtime.creativeTools.registry.jobs.find(row => row.id === request.id), artifact = result.job.outputs[0];
    const png = fs.readFileSync(path.join(runtime.runtime.creativeTools.directory, 'artifacts', stored.storageId, 'outputs', artifact.path));
    assert.equal(sha256(png), artifact.sha256); assert.equal(png.length, artifact.bytes); assert.equal(png.readUInt32BE(16), 64); assert.equal(png.readUInt32BE(20), 64);
    fs.writeFileSync(path.join(output, 'render.png'), png, { mode: 0o600 }); receipt.job = result.job;
    receipt.checks.push('The real native grant admitted a bounded Blender CPU render through stdio MCP and HTTP, producing a hash-verified 64 by 64 PNG and durable receipt.');
    assert.equal((await tool(client, 'creative_run', request)).replayed, true);
    await client.close(); client = null; await runtime.close(); runtime = null;
    await start(); assert.equal((await tool(client, 'creative_run', request)).replayed, true);
    assert.equal(runtime.runtime.creativeTools.registry.jobs.length, 1);
    receipt.checks.push('The same MCP command replayed before and after complete daemon/client restart without a second creative job.');
    await invoke('office_command', { action: 'revoke_authority', grantId: grant.id, reason: 'Disposable acceptance revocation' });
    const denied = await client.call('tools/call', { name: 'creative_run', arguments: { ...request, id: 'must-not-render-after-revoke' } });
    assert.equal(denied.result.isError, true); assert.equal(denied.result.structuredContent.code, 'CREATIVE_AUTHORITY_DENIED');
    assert.equal(runtime.runtime.creativeTools.registry.jobs.length, 1);
    const final = await invoke('office_snapshot'); assert.equal(final.jobs.length, nativeBefore.jobs.length); assert.equal(receipt.providerCalls, 0);
    receipt.checks.push('Revoking the actual native grant rejected a fresh MCP render while preserving the original receipt; no provider job or call was created.');
  } catch (error) { failure = error; receipt.error = { code: typeof error.code === 'string' && /^[A-Z_]{1,80}$/.test(error.code) ? error.code : 'SMOKE_FAILED', message: 'Native creative acceptance did not complete.' }; }
  finally {
    try { await client?.close(); await runtime?.close(); fs.rmSync(temporary, { recursive: true, force: true }); receipt.checks.push('All MCP clients, runtime controllers and disposable native/project state were closed and removed before publishing success.'); }
    catch (error) { failure ??= error; }
    receipt.ok = !failure; fs.writeFileSync(path.join(output, 'receipt.json'), JSON.stringify(receipt, null, 2) + '\n', { mode: 0o600 });
  }
  if (failure) throw new Error(`Native creative acceptance failed (${receipt.error?.code ?? 'CLEANUP_FAILED'}): ${failure.message}`);
  return receipt;
}

export async function main(argv = process.argv.slice(2)) {
  const options = {};
  for (let index = 0; index < argv.length; index += 2) { const key = ({ '--blender': 'blender', '--scene': 'scene', '--output': 'output' })[argv[index]];
    if (!key || Object.hasOwn(options, key) || !argv[index + 1]) throw new Error('Provide --blender, --scene and --output exactly once.'); options[key] = argv[index + 1]; }
  const receipt = await smokeNativeRuntime(options); console.log(JSON.stringify(receipt)); return receipt;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(error => { console.error(error.message); process.exitCode = 1; });
