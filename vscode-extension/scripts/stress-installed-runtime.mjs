/** A real CLI installation plus installed-package native/venv acceptance.
 * This does not replace Extension Development Host or tmux acceptance. */
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { downloadAndUnzipVSCode, resolveCliArgsFromVSCodeExecutablePath } from '@vscode/test-electron';
import { resolveWindowsCliEntry, installDiagnostics } from './installed-cli.mjs';
import { runVenvAcceptance } from '../../scripts/venv-acceptance.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const manifest = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8'));
const vsix = path.join(root, `atlas-office-${manifest.version}.vsix`);
const output = path.join(root, '.work', 'installed-runtime');
const version = process.env.ATLAS_VSCODE_TEST_VERSION || '1.147.0';
assert.match(version, /^\d+\.\d+\.\d+$/);
await fs.mkdir(output, { recursive: true });
const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'daftar-installed-runtime-'));
const extensions = path.join(temporary, 'extensions'), userData = path.join(temporary, 'editor-profile');
const storagePath = path.join(temporary, 'native-storage');
const receipt = { schemaVersion: 1, status: 'failed', startedAt: new Date().toISOString(),
  requestedVscodeVersion: version, extensionVersion: manifest.version, platform: process.platform, arch: process.arch,
  vsixSha256: crypto.createHash('sha256').update(await fs.readFile(vsix)).digest('hex'),
  guiActivationVerified: false, managedTmuxVerified: false, cycles: [], checks: [], runtimeRequests: 0,
  providerCalls: 0, packageIndexRequests: 0 };
const env = {};
for (const key of ['PATH', 'Path', 'HOME', 'USERPROFILE', 'SystemRoot', 'SYSTEMROOT', 'WINDIR', 'TMPDIR', 'TMP', 'TEMP', 'LANG', 'LC_ALL']) {
  if (typeof process.env[key] === 'string' && !process.env[key].includes('\0')) env[key] = process.env[key];
}
let runtime, client;
const execute = (file, args, options = {}) => {
  const result = spawnSync(file, args, { env, encoding: 'utf8', timeout: 120000, maxBuffer: 1024 * 1024, shell: false, windowsHide: true, ...options });
  assert.ok(!result.error && result.status === 0, `Bounded executable failed: ${path.basename(file)} (${result.error?.code || result.status})`);
  return result.stdout;
};
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const inside = (parent, child) => { const relative = path.relative(parent, child); return relative && relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative); };
try {
  await Promise.all([fs.mkdir(extensions), fs.mkdir(path.join(userData, 'User'), { recursive: true })]);
  await fs.writeFile(path.join(userData, 'User', 'settings.json'), JSON.stringify({ 'telemetry.telemetryLevel': 'off', 'update.mode': 'none', 'extensions.autoUpdate': false }));
  const executable = await downloadAndUnzipVSCode({ version, cachePath: path.join(root, '.vscode-test') });
  const [cli, ...cliArgs] = resolveCliArgsFromVSCodeExecutablePath(executable, { reuseMachineInstall: true });
  const windows = process.platform === 'win32' ? await resolveWindowsCliEntry(executable, cli) : null;
  const install = spawnSync(windows ? executable : cli,
    [...(windows ? [windows.entry] : cliArgs), `--user-data-dir=${userData}`, `--extensions-dir=${extensions}`, '--install-extension', vsix, '--force'],
    { env: windows ? { ...env, VSCODE_DEV: '', ELECTRON_RUN_AS_NODE: '1' } : env, encoding: 'utf8', timeout: 90000, maxBuffer: 4 * 1024 * 1024, shell: false, windowsHide: true });
  await fs.writeFile(path.join(output, 'install.log'), installDiagnostics(install, windows ?? { executable, launcher: cli }));
  assert.ok(!install.error && install.status === 0, 'The real VS Code CLI must install this exact VSIX; inspect install.log');
  receipt.cliInstallation = true;
  receipt.runtimeNodeVersion = execute(executable, ['--version'], { env: { ...env, ELECTRON_RUN_AS_NODE: '1' } }).trim();
  assert.match(receipt.runtimeNodeVersion, /^v\d+\.\d+\.\d+$/);
  receipt.runtimeUsesDownloadedEditorNode = true;
  const matches = [];
  for (const entry of await fs.readdir(extensions, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.isSymbolicLink()) continue;
    const candidate = path.join(extensions, entry.name);
    let value; try { value = JSON.parse(await fs.readFile(path.join(candidate, 'package.json'), 'utf8')); } catch { continue; }
    if (value.name === manifest.name && value.publisher === manifest.publisher) matches.push({ root: candidate, manifest: value });
  }
  assert.equal(matches.length, 1, 'One exact separately installed package is required');
  const installed = matches[0]; assert.equal(installed.manifest.version, manifest.version);
  const installedRoot = await fs.realpath(installed.root);
  assert.ok(inside(await fs.realpath(extensions), installedRoot));
  assert.notEqual(installedRoot, await fs.realpath(root));
  const { createLocalRuntime, verifyRuntime } = require(path.join(installedRoot, 'src/local-runtime.js'));
  const { RuntimeClient } = require(path.join(installedRoot, 'src/runtime-client.js'));
  const runtimeRoot = path.join(installedRoot, 'resources/runtime');
  const verified = verifyRuntime(runtimeRoot);
  receipt.runtimeManifestSha256 = crypto.createHash('sha256').update(await fs.readFile(path.join(runtimeRoot, 'manifest.json'))).digest('hex');
  receipt.runtimeFileCount = Object.keys(verified.files).length;
  receipt.checks.push('Official CLI installed the matching platform/version; only installed native/runtime modules are executed');

  let basePython = process.env.DAFTAR_PYTHON_PATH;
  if (!basePython) {
    for (const candidate of ['python3', 'python']) {
      try { basePython = execute(candidate, ['-I', '-c', 'import os,sys;print(os.path.abspath(sys.executable))']).trim(); break; } catch {}
    }
  }
  assert.ok(basePython && path.isAbsolute(basePython), 'Set DAFTAR_PYTHON_PATH to the host Python 3 interpreter for this acceptance gate');
  const outerVenv = path.join(temporary, 'launch-venv');
  execute(basePython, ['-I', '-m', 'venv', '--copies', outerVenv]);
  const pythonPath = path.join(outerVenv, process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
  const launcherEnvironment = { ...env, PATH: `${path.dirname(pythonPath)}${path.delimiter}${env.PATH ?? env.Path ?? ''}`,
    VIRTUAL_ENV: outerVenv, DAFTAR_PYTHON_PATH: '/unselected-ambient-interpreter', OPENAI_API_KEY: 'synthetic-not-for-runtime' };
  const trackedFetch = async (input, init) => {
    const url = new URL(input);
    assert.equal(url.protocol, 'http:'); assert.equal(url.hostname, '127.0.0.1');
    receipt.runtimeRequests++;
    return fetch(input, init);
  };
  let priorCredential;
  for (let iteration = 0; iteration < 6; iteration++) {
    const started = performance.now();
    runtime = createLocalRuntime({ runtimeRoot, storagePath, nodePath: executable, pythonPath, environment: launcherEnvironment, fetcher: trackedFetch });
    const connections = await Promise.all(Array.from({ length: 12 }, () => runtime.start()));
    const connection = connections[0];
    assert.ok(connections.every(item => item.url === connection.url && item.controlToken === connection.controlToken));
    if (priorCredential) assert.ok(connection.controlToken !== priorCredential, 'Each owned runtime lifetime must rotate its credential');
    priorCredential = connection.controlToken;
    client = new RuntimeClient(connection, trackedFetch);
    const status = await client.request('/v1/status');
    assert.equal(status.worker.enabled, false); assert.equal(status.worker.running, false); assert.equal(status.host.mode, 'off');
    assert.deepEqual(status.capabilities.configuredProviders, []);
    const duplicate = createLocalRuntime({ runtimeRoot, storagePath, nodePath: executable, pythonPath, environment: launcherEnvironment });
    await assert.rejects(duplicate.start(), error => error.code === 'LOCAL_RUNTIME_BUSY'); await duplicate.close();
    const unauthorized = await trackedFetch(connection.url + '/v1/status', { signal: AbortSignal.timeout(3000), headers: { Authorization: 'Bearer synthetic-invalid-owner-credential' } });
    assert.equal(unauthorized.status, 401); await unauthorized.arrayBuffer();
    if (iteration === 0) {
      const snapshot = await client.snapshot();
      const request = { id: 'installed-runtime-stress-company', method: 'officeCommand', args: [{ expectedStateHash: snapshot.stateHash,
        command: { action: 'create_company', id: 'installed-runtime-stress-company', name: 'Isolated installed runtime acceptance' } }] };
      const replies = await Promise.all(Array.from({ length: 16 }, () => client.request('/v1/workbench/call', 'POST', request)));
      assert.ok(replies.every(reply => reply.result?.ok === true && reply.result.stateHash === replies[0].result.stateHash));
      receipt.duplicateDeliveries = replies.length;
      const created = await client.call('createVenv', [{ name: 'installed-python', confirmed: true, installHuggingFaceHub: false }], { id: 'installed-runtime-create-venv' });
      assert.equal(created.ok, true); assert.ok(path.isAbsolute(created.pythonPath));
      assert.ok(inside(path.join(storagePath, 'runtime', 'data'), created.pythonPath), 'The workbench environment must remain in its owned runtime data');
      const replay = await client.call('createVenv', [{ name: 'installed-python', confirmed: true, installHuggingFaceHub: false }], { id: 'installed-runtime-create-venv' });
      assert.equal(replay.jobId, created.jobId);
      const deadline = Date.now() + 120000; let job;
      do {
        const jobs = await client.call('getJobStatus', [created.jobId]); job = jobs.find(item => item.id === created.jobId);
        if (job && ['succeeded', 'failed', 'cancelled'].includes(job.status)) break;
        await pause(150);
      } while (Date.now() < deadline);
      assert.equal(job?.status, 'succeeded', 'The installed workbench must actually finish Python environment creation');
      const configuration = await fs.readFile(path.join(path.dirname(path.dirname(created.pythonPath)), 'pyvenv.cfg'), 'utf8');
      const bootstrap = /^command = (.+) -m venv /m.exec(configuration)?.[1];
      const normalizePython = value => process.platform === 'win32' ? path.normalize(value).toLowerCase() : path.normalize(value);
      assert.ok(bootstrap && normalizePython(bootstrap) === normalizePython(pythonPath), 'The created venv must record the explicitly selected bootstrap interpreter');
      receipt.venv = await runVenvAcceptance({ pythonPath: created.pythonPath, workingDirectory: temporary });
      receipt.venv.createdThroughInstalledWorkbench = true;
      receipt.venv.replayedCreationOnce = true;
      receipt.venv.launcherStartedWithVenvPython = true;
      receipt.venv.configuredBootstrapInterpreterVerified = true;
    }
    const snapshots = await Promise.all(Array.from({ length: 16 }, () => client.snapshot()));
    assert.ok(snapshots.every(item => item.snapshot.companies.filter(company => company.id === 'installed-runtime-stress-company').length === 1));
    assert.equal(client.controllers.size, 0);
    client.close(); client = null;
    await runtime.close();
    assert.deepEqual(runtime.diagnostics(), { children: 0, startupTimer: false, childListeners: 0 });
    await assert.rejects(fetch(connection.url + '/healthz', { signal: AbortSignal.timeout(1000) }));
    await assert.rejects(fs.access(path.join(storagePath, 'runtime', 'launcher.lock')));
    await assert.rejects(fs.access(path.join(storagePath, 'runtime', 'control-token')));
    receipt.cycles.push({ iteration: iteration + 1, concurrentStarts: 12, concurrentReads: 16, duplicateOwnerRejected: true,
      unauthorizedRejected: true, oneCompanyPersisted: true, listenerClosed: true, noChildTimerOrListener: true,
      elapsedMs: Math.round((performance.now() - started) * 100) / 100 });
    runtime = null;
  }
  receipt.checks.push('Six real installed native start/read/stop cycles coalesced starts, refused duplicate owners, rejected wrong credentials and preserved one native company');
  receipt.checks.push('A real workbench venv installed and executed an offline wheel that the base Python could not import; creation replay used one job');
  receipt.checks.push('Launching from a Python-venv environment preserved the separate Node/native runtime and explicit selected Python path');
  receipt.status = 'passed';
} catch (error) {
  receipt.error = error instanceof Error ? error.message : 'Installed runtime acceptance failed';
  process.exitCode = 1;
} finally {
  client?.close();
  let clean = true;
  if (runtime) try { await runtime.close(); } catch { clean = false; receipt.status = 'failed'; receipt.cleanupError = 'Owned runtime did not confirm stop; temporary directory retained'; process.exitCode = 1; }
  if (clean) try { await fs.rm(temporary, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 }); }
  catch { receipt.status = 'failed'; receipt.cleanupError = 'Owned runtime stopped, but temporary file removal was not confirmed'; process.exitCode = 1; }
  receipt.finishedAt = new Date().toISOString();
  await fs.writeFile(path.join(output, 'receipt.json'), JSON.stringify(receipt, null, 2) + '\n');
  console.log(JSON.stringify({ status: receipt.status, extensionVersion: receipt.extensionVersion, platform: receipt.platform,
    cycles: receipt.cycles.length, requests: receipt.runtimeRequests, venv: receipt.venv?.moduleExecuted ?? false,
    receipt: path.join(output, 'receipt.json'), ...(receipt.error ? { error: receipt.error } : {}) }));
}
