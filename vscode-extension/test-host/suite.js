'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const vscode = require('vscode');
const execute = promisify(execFile);

async function filesBelow(root) {
  const files = [];
  for (const entry of await fs.readdir(root, { withFileTypes: true })) {
    const file = path.join(root, entry.name);
    assert.ok(!entry.isSymbolicLink(), 'Installed extension must not contain symlinks');
    if (entry.isDirectory()) files.push(...await filesBelow(file));
    else if (entry.isFile()) files.push(file);
  }
  return files;
}

exports.run = async function run() {
  const receiptPath = process.env.ATLAS_INSTALLED_SMOKE_RECEIPT;
  assert.ok(receiptPath, 'The isolated runner must supply the receipt path');
  const receipt = {
    status: 'failed',
    startedAt: new Date().toISOString(),
    vscodeVersion: vscode.version,
    vsixSha256: process.env.ATLAS_INSTALLED_SMOKE_VSIX_SHA256,
    checks: [],
    networkRequests: 0,
    loopbackRequests: 0,
    externalRequests: 0,
    blockedRequests: 0,
    verifiedPersistent: false,
  };
  const originalFetch = globalThis.fetch;
  let phase = 'offline', runtimeOrigin = null, installedEntry = null, deactivated = false;
  let persistentFixture = null;
  async function stopPersistentFixture() {
    const fixture = persistentFixture;
    if (!fixture || fixture.stopped) return;
    await Promise.allSettled(fixture.adapters.map(adapter => adapter.close()));
    const env = { ELECTRON_RUN_AS_NODE: '1', NODE_ENV: 'production' };
    for (const name of ['PATH', 'HOME', 'USER', 'LOGNAME', 'LANG', 'LC_ALL', 'TMPDIR', 'TERM']) {
      if (typeof process.env[name] === 'string') env[name] = process.env[name];
    }
    let result;
    try {
      const output = await execute(process.execPath, [path.join(fixture.runtimeRoot, 'deploy/tmux-runtime.mjs'), 'stop', '--data', fixture.dataDir],
        { cwd: fixture.runtimeRoot, env, shell: false, timeout: 20000, maxBuffer: 65536 });
      result = JSON.parse(output.stdout);
    } catch { throw new Error('The dedicated persistent test supervisor did not confirm cleanup. No other tmux session was touched.'); }
    assert.ok(result.ok === true && result.running === false && result.dataDir === fixture.dataDir,
      'Cleanup must stop only the exact test supervisor data directory');
    fixture.stopped = true;
    await fs.rm(fixture.storagePath, { recursive: true, force: true });
  }
  const readRoutes = new Set(['/v1/status', '/v1/office', '/v1/workbench']);
  const workbenchReads = new Set(['officeSnapshot', 'officeWorkerStatus', 'getSettings', 'getVaultStatus', 'getSystemInfo',
    'getModelCatalog', 'companySnapshot', 'listProjects', 'getProject', 'listRuns', 'getJobStatus', 'cloudStatus',
    'modelPoolSnapshot', 'environmentStatus', 'resourceStatus', 'checkModelRequirements']);
  // The extension host is offline until an explicit local start. Thereafter it
  // can read only the one owned loopback runtime. Never permit provider, Vast,
  // SSH, or cloud traffic; the child starts with no provider keys and paused jobs.
  globalThis.fetch = async (input, init = {}) => {
    receipt.networkRequests += 1;
    let url;
    try { url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url); }
    catch { receipt.blockedRequests++; throw new Error('Invalid installed-test request.'); }
    const loopback = url.protocol === 'http:' && url.hostname === '127.0.0.1' && !url.username && !url.password;
    if (!loopback) { receipt.externalRequests++; receipt.blockedRequests++; throw new Error('External network dispatch is disabled in the installed smoke test.'); }
    const method = init.method || 'GET';
    if (phase !== 'offline' && runtimeOrigin === null && method === 'GET' && url.pathname === '/v1/status' && !url.search && !url.hash) runtimeOrigin = url.origin;
    let allowed = phase !== 'offline' && runtimeOrigin !== null && url.origin === runtimeOrigin && !url.search && !url.hash
      && ((method === 'GET' && readRoutes.has(url.pathname)) || (['shutdown', 'persistent-shutdown'].includes(phase) && method === 'GET' && url.pathname === '/healthz'));
    if (phase !== 'offline' && url.origin === runtimeOrigin && method === 'POST' && url.pathname === '/v1/workbench/call' && !url.search && !url.hash) {
      try { const body = JSON.parse(init.body); allowed = Buffer.byteLength(init.body) <= 256 * 1024 && workbenchReads.has(body.method) && Array.isArray(body.args); }
      catch { allowed = false; }
    }
    if (!allowed) { receipt.blockedRequests++; throw new Error('Only bounded reads of the owned Daftar runtime are permitted in the installed smoke test.'); }
    receipt.loopbackRequests++;
    const result = await originalFetch(input, { ...init, redirect: 'error' });
    assert.ok(!result.redirected, 'Owned runtime reads must not redirect');
    if (url.pathname === '/v1/status' && result.ok) {
      const state = await result.clone().json();
      assert.equal(state.execution, 'headless'); assert.equal(state.worker.enabled, false);
      assert.equal(state.worker.running, false); assert.equal(state.host.mode, 'off');
      assert.deepEqual(state.capabilities.configuredProviders, []);
      receipt.runtime = { execution: state.execution, workersPaused: true, hostPolicy: state.host.mode,
        workbench: state.capabilities.workbench === true, configuredProviderCount: state.capabilities.configuredProviders.length };
    }
    return result;
  };
  try {
    const id = 'occult-kranti.atlas-office';
    const extension = vscode.extensions.getExtension(id);
    assert.ok(extension, 'The separately installed VSIX must be discoverable');
    const installedRoot = await fs.realpath(extension.extensionPath);
    const extensionsRoot = await fs.realpath(process.env.ATLAS_INSTALLED_SMOKE_EXTENSIONS);
    const sourceRoot = await fs.realpath(process.env.ATLAS_INSTALLED_SMOKE_SOURCE);
    const relativeInstalled = path.relative(extensionsRoot, installedRoot);
    assert.ok(relativeInstalled && !relativeInstalled.startsWith('..') && !path.isAbsolute(relativeInstalled), 'Atlas must be loaded from the isolated installed extensions directory');
    assert.notEqual(installedRoot, sourceRoot, 'Source development activation does not verify the installed VSIX');
    assert.equal(extension.packageJSON.version, process.env.ATLAS_INSTALLED_SMOKE_VERSION);
    receipt.extensionId = id;
    receipt.extensionVersion = extension.packageJSON.version;
    receipt.installedDirectory = relativeInstalled;
    receipt.checks.push('VSIX installed separately from test host and source');

    const installedFiles = await filesBelow(installedRoot);
    const credentialPattern = /(?:sk-ant-|sk-proj-|github_pat_|ghp_)[A-Za-z0-9_-]{24,}/;
    const hashes = {};
    for (const file of installedFiles) {
      const relative = path.relative(installedRoot, file).replaceAll(path.sep, '/');
      assert.ok(!/^(?:test|test-host|scripts|node_modules|\.work|\.vscode-test)\//.test(relative), 'The installed VSIX must omit development artifacts');
      const data = await fs.readFile(file);
      assert.ok(!credentialPattern.test(data.toString('utf8')), `Unexpected credential-shaped material in installed ${relative}`);
      if (relative.startsWith('src/') || relative.startsWith('media/')) hashes[relative] = crypto.createHash('sha256').update(data).digest('hex');
    }
    receipt.installedRuntimeSha256 = hashes;
    receipt.checks.push('Installed archive contains runtime files and no credential-shaped material');

    const activation = await extension.activate();
    assert.equal(extension.isActive, true);
    const installedMain = await fs.realpath(path.join(installedRoot, extension.packageJSON.main));
    assert.ok(require.cache[installedMain], 'The active extension entry point must be the installed package');
    assert.equal(require.cache[path.join(sourceRoot, 'src', 'extension.js')], undefined);
    installedEntry = require(installedMain);
    assert.equal(typeof activation.connectionInfo, 'function');
    receipt.checks.push('Installed extension activated in real VS Code extension host');

    const commands = await vscode.commands.getCommands(true);
    const expectedCommands = extension.packageJSON.contributes.commands.map(command => command.command);
    for (const command of expectedCommands) assert.ok(commands.includes(command), `Registered command missing: ${command}`);
    receipt.commands = expectedCommands;
    receipt.checks.push('All contributed Atlas commands registered');

    // Exercise the installed extension's actual commands. The separate browser
    // and desktop UI gates cover rendered layout; this gate proves installed
    // activation and command wiring without an account or provider key.
    await vscode.commands.executeCommand('atlas.openOffice');
    await vscode.commands.executeCommand('atlas.refresh');
    await vscode.commands.executeCommand('atlas.refresh');
    await vscode.commands.executeCommand('atlas.disconnect');
    assert.equal(receipt.networkRequests, 0, 'An unpaired fresh profile must not dispatch requests');
    receipt.checks.push('Open Office command completed; disconnected refresh and disconnect stayed offline');

    const runtimeManifest = require(path.join(installedRoot, 'src/local-runtime.js')).verifyRuntime(path.join(installedRoot, 'resources/runtime'));
    assert.equal(runtimeManifest.platform, process.platform); assert.equal(runtimeManifest.arch, process.arch);
    const studio = require(path.join(installedRoot, 'src/workbench-panel.js')).readAssets(installedRoot);
    assert.equal(studio.manifest.renderer, 'desktop-shared-freeflow');
    for (const filename of ['freeflow/scene.js', 'freeflow/universe.js', 'freeflow/workspace.js']) assert.ok(studio.manifest.files[filename], `Missing shared canvas module ${filename}`);
    assert.match(studio.html, /id="freeflow-host"/);
    receipt.package = { platform: runtimeManifest.platform, arch: runtimeManifest.arch,
      runtimeFiles: Object.keys(runtimeManifest.files).length, canvasFiles: Object.keys(studio.manifest.files).length,
      runtimeManifestSha256: crypto.createHash('sha256').update(await fs.readFile(path.join(installedRoot, 'resources/runtime/manifest.json'))).digest('hex'),
      canvasManifestSha256: crypto.createHash('sha256').update(await fs.readFile(path.join(installedRoot, 'media/studio/manifest.json'))).digest('hex') };
    receipt.checks.push('Installed native runtime and shared infinite-canvas asset manifests verified');

    phase = 'starting';
    await vscode.commands.executeCommand('atlas.startLocalRuntime');
    const info = activation.connectionInfo();
    assert.equal(info.connected, true, 'The installed standalone runtime must become authenticated and ready');
    assert.equal(info.kind, 'runtime'); assert.equal(info.url, runtimeOrigin);
    assert.equal(Object.hasOwn(info, 'controlToken'), false); assert.equal(Object.hasOwn(info, 'deviceToken'), false);
    assert.equal(info.capabilities.methods.officeCommand.available, true);
    assert.equal(receipt.runtime?.workbench, true);
    phase = 'connected';
    await vscode.commands.executeCommand('atlas.openOffice');
    await Promise.all(Array.from({ length: 10 }, () => vscode.commands.executeCommand('atlas.refresh')));
    assert.equal(activation.connectionInfo().connected, true);
    assert.ok(receipt.loopbackRequests > 0, 'Installed runtime readiness must use authenticated loopback HTTP');
    assert.equal(receipt.externalRequests, 0); assert.equal(receipt.blockedRequests, 0);
    receipt.checks.push('Installed Electron Node child started native workbench; reads stayed on owned loopback with workers paused');

    await vscode.commands.executeCommand('atlas.disconnect');
    assert.equal(activation.connectionInfo().connected, false);
    assert.equal(typeof installedEntry.deactivate, 'function', 'Installed extension must await owned runtime disposal');
    await installedEntry.deactivate(); deactivated = true; phase = 'shutdown';
    await assert.rejects(globalThis.fetch(runtimeOrigin + '/healthz', { signal: AbortSignal.timeout(2500) }),
      'The owned local runtime listener must close before deactivation resolves');
    receipt.checks.push('Disconnect cleared editor state; awaited deactivation stopped its owned runtime');

    if (process.platform === 'linux') {
      const runtimeRoot = path.join(installedRoot, 'resources/runtime');
      const { createPersistentRuntime } = require(path.join(installedRoot, 'src/persistent-runtime.js'));
      const storagePath = await fs.mkdtemp(path.join(os.tmpdir(), 'daftar-installed-persistent-'));
      persistentFixture = { runtimeRoot, storagePath, dataDir: path.join(storagePath, 'persistent-runtime'), adapters: [], stopped: false };
      const makePersistent = () => {
        const adapter = createPersistentRuntime({ runtimeRoot, storagePath, nodePath: process.execPath });
        persistentFixture.adapters.push(adapter); return adapter;
      };
      const readOwner = async () => {
        const filename = path.join(persistentFixture.dataDir, 'workbench/owner.lock');
        const stat = await fs.lstat(filename);
        assert.ok(stat.isFile() && !stat.isSymbolicLink() && stat.size <= 2048 && (stat.mode & 0o077) === 0, 'Persistent native ownership must remain private and bounded');
        const owner = JSON.parse(await fs.readFile(filename, 'utf8'));
        assert.ok(Number.isInteger(owner.pid) && owner.pid > 0 && typeof owner.nonce === 'string', 'Persistent native owner identity is required');
        return owner;
      };
      const authenticatedStatus = async connection => {
        const result = await globalThis.fetch(connection.url + '/v1/status', { method: 'GET', redirect: 'error', signal: AbortSignal.timeout(2500),
          headers: { Authorization: `Bearer ${connection.controlToken}`, Accept: 'application/json' } });
        assert.equal(result.status, 200, 'Persistent readiness requires the unchanged private owner credential');
        return result.json();
      };
      phase = 'persistent-starting'; runtimeOrigin = null;
      const first = makePersistent(); const firstConnection = await first.start();
      assert.equal(first.status().state, 'ready'); assert.equal(firstConnection.url, runtimeOrigin);
      assert.ok(!JSON.stringify(first.status()).includes(firstConnection.controlToken), 'Persistent public status must omit its credential');
      persistentFixture.dataDir = first.dataDir;
      const ownerBefore = await readOwner(); const before = await authenticatedStatus(firstConnection);
      assert.equal(before.host.configured, true); assert.equal(before.host.mode, 'off');
      await first.close();
      assert.equal(first.status().state, 'detached');
      const detached = await authenticatedStatus(firstConnection);
      assert.equal(detached.host.mode, before.host.mode); assert.equal(detached.worker.enabled, before.worker.enabled);
      phase = 'persistent-reconnecting';
      const second = makePersistent(); const secondConnection = await second.start();
      assert.equal(second.dataDir, first.dataDir); assert.equal(secondConnection.url, firstConnection.url);
      // Never let an assertion failure serialize a live credential into logs.
      assert.ok(secondConnection.controlToken === firstConnection.controlToken, 'Reconnecting must retain the existing persistent credential');
      const ownerAfter = await readOwner(); const reconnected = await authenticatedStatus(secondConnection);
      assert.ok(ownerAfter.pid === ownerBefore.pid && ownerAfter.nonce === ownerBefore.nonce, 'Reconnecting must retain the same live native daemon');
      assert.equal(reconnected.host.mode, before.host.mode); assert.equal(reconnected.worker.enabled, before.worker.enabled);
      await second.close();
      assert.equal((await authenticatedStatus(secondConnection)).host.mode, before.host.mode);
      phase = 'persistent-shutdown';
      await stopPersistentFixture();
      await assert.rejects(globalThis.fetch(runtimeOrigin + '/healthz', { signal: AbortSignal.timeout(2500) }),
        'Only explicit cleanup should stop the persistent test listener');
      receipt.verifiedPersistent = true;
      receipt.persistent = { platform: 'linux', electronNodeChain: true, detachedAlive: true,
        sameDaemonOnReconnect: true, credentialStable: true, policyPreserved: true, cleanupStopped: true };
      receipt.checks.push('Installed Electron → dedicated tmux → native daemon survives detach and reconnect; exact supervisor cleanup verified');
    } else {
      receipt.persistent = { supported: false, reason: 'Persistent tmux mode is Linux-only; ordinary installed runtime acceptance completed on this platform.' };
    }
    assert.equal(receipt.externalRequests, 0); assert.equal(receipt.blockedRequests, 0);

    const syntheticCredential = 'sk-ant-' + 'test-only-not-a-real-credential-1234567890';
    assert.equal(require(installedMain).safeMessage(new Error(syntheticCredential)), '[credential removed]');
    receipt.checks.push('Error display removes credential-shaped text');
    receipt.status = 'passed';
  } catch (error) {
    receipt.error = error instanceof Error ? error.message : 'Unknown installed smoke failure';
    throw error;
  } finally {
    if (persistentFixture && !persistentFixture.stopped) {
      try { await stopPersistentFixture(); }
      catch { receipt.persistentCleanupError = 'The dedicated test supervisor did not confirm cleanup. Its private data directory was preserved.'; }
    }
    if (!deactivated && typeof installedEntry?.deactivate === 'function') {
      try { await installedEntry.deactivate(); } catch { receipt.cleanupError = 'Owned extension cleanup did not confirm completion.'; }
    }
    globalThis.fetch = originalFetch;
    receipt.finishedAt = new Date().toISOString();
    await fs.writeFile(receiptPath, JSON.stringify(receipt, null, 2) + '\n');
  }
};
