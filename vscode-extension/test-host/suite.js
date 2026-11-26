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

/** A Windows loader cache key can retain a different drive/path case than
 * realpath. Locate an already-loaded instance by canonical path AND file ID;
 * never require it again merely to make an installed-package assertion pass. */
async function findCachedModule(filename, { cache = require.cache, fileSystem = fs, platform = process.platform } = {}) {
  const paths = platform === 'win32' ? path.win32 : path;
  const comparePath = value => {
    const resolved = paths.resolve(value);
    return platform === 'win32' ? paths.toNamespacedPath(resolved).toLowerCase() : resolved;
  };
  const target = await fileSystem.realpath(filename);
  const targetStat = await fileSystem.stat(target, { bigint: true });
  assert.ok(targetStat.isFile(), 'The expected extension entry must be a regular file');
  const matches = new Set();
  for (const cached of Object.values(cache)) {
    if (!cached?.loaded || typeof cached.filename !== 'string') continue;
    let candidate, candidateStat;
    try {
      candidate = await fileSystem.realpath(cached.filename);
      if (comparePath(candidate) !== comparePath(target)) continue;
      candidateStat = await fileSystem.stat(candidate, { bigint: true });
    } catch { continue; }
    if (candidateStat.isFile() && candidateStat.dev === targetStat.dev && candidateStat.ino === targetStat.ino) matches.add(cached);
  }
  assert.ok(matches.size <= 1, 'The extension entry must not have multiple separately loaded module instances');
  return [...matches][0] ?? null;
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
    verifiedPersistentHost: false,
    hostFixtureRequests: 0,
  };
  const originalFetch = globalThis.fetch;
  let phase = 'offline', runtimeOrigin = null, installedEntry = null, deactivated = false;
  let persistentFixture = null;
  let fixtureRequestPermit = null;
  async function stopPersistentFixture() {
    const fixture = persistentFixture;
    if (!fixture || fixture.stopped) return;
    // A detached host job has its own tmux session. Confirm its bounded cleanup
    // before stopping the daemon or removing any private receipt directory.
    if (fixture.cleanupHost) await fixture.cleanupHost();
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
  // can read only the one owned loopback runtime. A dedicated Linux fixture
  // additionally permits one exact request at a time for its synthetic host job.
  // Never permit provider, Vast, SSH, or cloud traffic; workers stay paused.
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
    if (phase !== 'offline' && url.origin === runtimeOrigin && method === 'GET' && ['/v1/models','/v1/creative'].includes(url.pathname) && !url.hash) {
      const fields=[...url.searchParams];allowed=fields.length===1&&fields[0][0]==='companyId'&&/^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/.test(fields[0][1]);
    }
    if (phase !== 'offline' && url.origin === runtimeOrigin && method === 'POST' && url.pathname === '/v1/workbench/call' && !url.search && !url.hash) {
      try { const body = JSON.parse(init.body); allowed = Buffer.byteLength(init.body) <= 256 * 1024 && workbenchReads.has(body.method) && Array.isArray(body.args); }
      catch { allowed = false; }
    }
    if (['persistent-host', 'persistent-host-cleanup'].includes(phase) && url.origin === runtimeOrigin && !url.search && !url.hash) {
      if (method === 'GET' && url.pathname === '/v1/host') allowed = true;
      if (method === 'POST' && fixtureRequestPermit?.phase === phase && fixtureRequestPermit.route === url.pathname
          && fixtureRequestPermit.unused && typeof init.body === 'string' && Buffer.byteLength(init.body) <= 16384
          && init.body === fixtureRequestPermit.body) {
        fixtureRequestPermit.unused = false;
        receipt.hostFixtureRequests++;
        allowed = true;
      }
    }
    if (!allowed) { receipt.blockedRequests++; throw new Error('Only bounded owned-runtime reads and exact synthetic fixture requests are permitted in the installed smoke test.'); }
    receipt.loopbackRequests++;
    const result = await originalFetch(input, { ...init, redirect: 'error' });
    assert.ok(!result.redirected, 'Owned runtime requests must not redirect');
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
    const relativeMain = path.relative(installedRoot, installedMain);
    assert.ok(relativeMain && !relativeMain.startsWith('..') && !path.isAbsolute(relativeMain), 'The active entry must remain inside the verified installed package');
    const cachedInstalled = await findCachedModule(installedMain);
    assert.ok(cachedInstalled, 'The active extension entry point must be the installed package');
    assert.equal(await findCachedModule(path.join(sourceRoot, 'src', 'extension.js')), null, 'The source development entry must not be loaded under any path spelling');
    installedEntry = cachedInstalled.exports;
    assert.equal(typeof installedEntry.activate, 'function');
    assert.equal(typeof activation.connectionInfo, 'function');
    receipt.checks.push('Installed extension activated in real VS Code extension host');

    const commands = await vscode.commands.getCommands(true);
    const expectedCommands = extension.packageJSON.contributes.commands.map(command => command.command);
    assert.equal(expectedCommands.length, 19, 'The installed candidate must retain all released commands and scoped company tools');
    assert.equal(new Set(expectedCommands).size,18,'Commands must not duplicate a released identity');
    assert.ok(expectedCommands.includes('atlas.connectRuntime'));
    assert.ok(expectedCommands.includes('atlas.creativeTools'));
    assert.ok(expectedCommands.includes('atlas.creativeDevelopment'));
    for (const command of expectedCommands) assert.ok(commands.includes(command), `Registered command missing: ${command}`);
    receipt.commands = expectedCommands;
    receipt.checks.push('All contributed Atlas commands registered');

    const creative = require(path.join(installedRoot, 'src', 'creative.js'));
    assert.ok(hashes['src/creative.js'], 'The installed package must contain the creative client contract');
    assert.equal(creative.readiness({id:'adobe-photoshop',configured:true,available:true,remoteAuthVerified:false}), 'Configured — Adobe authentication unverified');
    assert.throws(() => creative.validateCreativeInput('blender.render', {path:'../outside.blend'}));
    assert.throws(() => creative.validateCreativeInput('blender.render', {path:'scene.blend',samples:65}));
    assert.equal(creative.validateCreativeInput('blender.render', {path:'scene.blend',frame:0,width:16,height:2048,samples:64}).frame, 0);
    assert.throws(() => creative.creativeSnapshot({companyId:'other'}, 'selected'));
    const development=require(path.join(installedRoot,'src','development.js'));
    assert.ok(hashes['src/development.js'],'The installed package must contain the development workflow');
    assert.equal(development.PRIMARY_MODEL,'qwen3-coder:30b-a3b-q4_K_M');
    assert.throws(()=>development.modelSnapshot({companyId:'other'},'selected'));
    receipt.checks.push('Installed creative contract enforces scope, bounded inputs and honest Adobe readiness');

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
    for (const module of ['scene', 'universe', 'workspace']) {
      const matches = Object.keys(studio.manifest.files).filter(filename => new RegExp(`^freeflow/${module}\\.[a-f0-9]{16}\\.js$`).test(filename));
      assert.equal(matches.length, 1, `Missing or ambiguous content-hashed shared canvas module ${module}`);
    }
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
    assert.equal(info.capabilities.officeCommand, true);
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

      // Exercise the actual installed Electron -> tmux -> Node runner -> bash
      // chain. Ordinary provider workers remain paused throughout this fixture.
      phase = 'persistent-host';
      const fixtureRoutes = new Set(['/v1/commands', '/v1/host/god-mode', '/v1/host/submit', '/v1/host/inspect', '/v1/host/stop-all']);
      const fixtureRequest = async (route, body) => {
        const encoded = body === undefined ? undefined : JSON.stringify(body);
        if (encoded !== undefined) {
          assert.ok(fixtureRoutes.has(route) && Buffer.byteLength(encoded) <= 16384, 'Only fixed bounded fixture routes may mutate state');
          assert.equal(fixtureRequestPermit, null, 'Synthetic fixture requests must be sequential');
          fixtureRequestPermit = { phase, route, body: encoded, unused: true };
        } else assert.ok(['/v1/office', '/v1/host'].includes(route), 'Unexpected fixture read route');
        let reader, response;
        try {
          response = await globalThis.fetch(secondConnection.url + route, {
            method: encoded === undefined ? 'GET' : 'POST', redirect: 'error', signal: AbortSignal.timeout(5000),
            headers: { Authorization: `Bearer ${secondConnection.controlToken}`, Accept: 'application/json',
              ...(encoded === undefined ? {} : { 'Content-Type': 'application/json' }) },
            ...(encoded === undefined ? {} : { body: encoded }),
          });
          assert.equal(response.status, 200, 'The exact installed fixture request must be confirmed; no mutation is automatically retried');
          assert.ok(response.headers.get('content-type')?.includes('application/json'), 'Fixture responses must be JSON');
          reader = response.body.getReader();
          const chunks = []; let bytes = 0;
          for (;;) {
            const part = await reader.read();
            if (part.done) break;
            bytes += part.value.byteLength;
            assert.ok(bytes <= 9 * 1024 * 1024, 'Fixture response exceeds the runtime transport bound');
            chunks.push(part.value);
          }
          const value = JSON.parse(Buffer.concat(chunks).toString('utf8'));
          assert.equal(value.ok, true, 'The installed native operation must succeed');
          return value;
        } finally {
          if (reader) { try { await reader.cancel(); } catch {} try { reader.releaseLock(); } catch {} }
          else if (response?.body) { try { await response.body.cancel(); } catch {} }
          fixtureRequestPermit = null;
        }
      };
      let hostStopAttempted = false, hostStopped = false;
      persistentFixture.cleanupHost = async () => {
        if (hostStopAttempted) {
          assert.ok(hostStopped, 'Host cleanup was not confirmed; preserve its private receipts without another mutation');
          return;
        }
        hostStopAttempted = true;
        phase = 'persistent-host-cleanup';
        const stopped = await fixtureRequest('/v1/host/stop-all', {});
        assert.equal(stopped.host.mode, 'off');
        assert.equal(stopped.host.godMode.enabled, false);
        assert.ok(stopped.host.jobs.every(job => ['completed', 'failed', 'cancelled', 'timed_out', 'output_limit'].includes(job.status)),
          'Synthetic host cleanup must leave no live or uncertain command');
        hostStopped = true;
      };
      const initialOffice = await fixtureRequest('/v1/office');
      assert.match(initialOffice.stateHash, /^[a-f0-9]{64}$/);
      const companyId = 'installed-host-fixture-company';
      const created = await fixtureRequest('/v1/commands', {
        id: 'installed-host-create-company', expectedStateHash: initialOffice.stateHash,
        command: { action: 'create_company', id: companyId, name: 'Installed host acceptance' },
      });
      assert.equal(created.id, 'installed-host-create-company');
      const office = await fixtureRequest('/v1/office');
      const company = office.snapshot.companies.find(candidate => candidate.id === companyId && candidate.status === 'active');
      assert.ok(company && typeof company.assistantId === 'string', 'Native company creation must provide its canonical assistant');
      const assistant = office.snapshot.employees.find(employee => employee.id === company.assistantId && employee.status === 'active');
      assert.ok(assistant, 'The exact native company assistant must be active');
      const companyIds = office.snapshot.companies.filter(candidate => candidate.status === 'active').map(candidate => candidate.id).sort();
      const hostBefore = await fixtureRequest('/v1/host');
      assert.equal(hostBefore.host.mode, 'off'); assert.equal(hostBefore.host.jobCount, 0);
      const enabled = await fixtureRequest('/v1/host/god-mode', { expectedRevision: hostBefore.host.revision, enabled: true, companyIds });
      assert.equal(enabled.host.mode, 'auto'); assert.equal(enabled.host.godMode.enabled, true);
      assert.deepEqual(enabled.host.godMode.companyIds, companyIds);
      assert.equal(enabled.host.jobCount, 0, 'Enabling owner control must not start a job');

      const sentinel = 'daftar-installed-host-output\n';
      const executionMarker = 'daftar-installed-host-once\n';
      const jobRequest = {
        id: 'installed-electron-host-job', companyId, employeeId: company.assistantId,
        command: 'test -z "${ELECTRON_RUN_AS_NODE+x}" && printf \'daftar-installed-host-once\\n\' >> installed-host-execution-count.txt && printf \'daftar-installed-host-output\\n\'',
        cwd: persistentFixture.dataDir, timeoutSeconds: 10, maxOutputBytes: 4096,
      };
      const submitted = await fixtureRequest('/v1/host/submit', jobRequest);
      assert.equal(submitted.id, jobRequest.id); assert.equal(submitted.replayed, false);
      assert.equal(submitted.job.companyId, companyId); assert.equal(submitted.job.employeeId, company.assistantId);
      let inspected; const hostDeadline = Date.now() + 15000;
      for (let attempt = 0; attempt < 60; attempt++) {
        inspected = await fixtureRequest('/v1/host/inspect', { id: jobRequest.id, offset: 0 });
        assert.equal(inspected.id, jobRequest.id); assert.equal(inspected.offset, 0);
        if (inspected.eof || Date.now() >= hostDeadline) break;
        await new Promise(resolve => setTimeout(resolve, 250));
      }
      assert.equal(inspected.job.status, 'completed', 'The real installed Electron host runner must finish its fixed printf job');
      assert.equal(inspected.job.exitCode, 0); assert.equal(inspected.eof, true); assert.equal(inspected.truncated, false);
      assert.equal(inspected.output, sentinel); assert.equal(inspected.nextOffset, Buffer.byteLength(sentinel));
      const replay = await fixtureRequest('/v1/host/submit', jobRequest);
      assert.equal(replay.id, jobRequest.id); assert.equal(replay.replayed, true); assert.equal(replay.job.status, 'completed');
      assert.equal(replay.job.startedAt, inspected.job.startedAt); assert.equal(replay.job.finishedAt, inspected.job.finishedAt);
      const replayInspect = await fixtureRequest('/v1/host/inspect', { id: jobRequest.id, offset: 0 });
      assert.equal(replayInspect.output, sentinel); assert.equal(replayInspect.job.outputBytes, Buffer.byteLength(sentinel));
      const markerFile = path.join(persistentFixture.dataDir, 'installed-host-execution-count.txt');
      const markerStat = await fs.lstat(markerFile);
      assert.ok(markerStat.isFile() && !markerStat.isSymbolicLink() && markerStat.size <= 128, 'Synthetic execution marker must remain a bounded fixture file');
      assert.equal(await fs.readFile(markerFile, 'utf8'), executionMarker, 'Replaying the completed ID must not execute the shell twice');
      assert.equal((await fixtureRequest('/v1/host')).host.jobCount, 1);
      await persistentFixture.cleanupHost();
      const afterHost = await authenticatedStatus(secondConnection);
      assert.equal(afterHost.host.mode, 'off'); assert.equal(afterHost.worker.enabled, false); assert.equal(afterHost.worker.running, false);
      receipt.verifiedPersistentHost = true;
      receipt.persistentHost = { canonicalAssistant: true, exactCompanyMembership: true, ownerModeStartedNoJobs: true,
        completed: true, exitCode: 0, outputBytes: Buffer.byteLength(sentinel), stableReplay: true,
        singleExecution: true, shellElectronFlagScrubbed: true, workersPaused: true, policyRestored: 'off' };
      receipt.checks.push('Installed Electron → tmux host runner completed one bounded printf job under its native company assistant; replay executed once and policy returned off');

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
    assert.equal(installedEntry.safeMessage(new Error(syntheticCredential)), '[credential removed]');
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
