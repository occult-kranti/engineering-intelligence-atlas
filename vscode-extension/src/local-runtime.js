'use strict';
// An owned, loopback-only backend child. This module never imports VS Code or
// Electron and never puts runtime credentials in webview-facing status values.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const { StringDecoder } = require('node:string_decoder');

const fail = (code, message) => Object.assign(new Error(message), { code });
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const safeRelative = value => typeof value === 'string' && value.length < 512 && !value.includes('\\')
  && value.split('/').every(part => /^[A-Za-z0-9_.-]+$/.test(part) && part !== '.' && part !== '..');
function verifyRuntime(runtimeRoot) {
  try {
    if (!path.isAbsolute(runtimeRoot) || !fs.lstatSync(runtimeRoot).isDirectory() || fs.lstatSync(runtimeRoot).isSymbolicLink()) throw new Error();
    const manifestPath = path.join(runtimeRoot, 'manifest.json');
    if (fs.lstatSync(manifestPath).isSymbolicLink()) throw new Error();
    const source = fs.readFileSync(manifestPath);
    if (source.length > 1024 * 1024) throw new Error();
    const manifest = JSON.parse(source);
    if (manifest.schemaVersion !== 1 || manifest.nodeMajorMinimum !== 22 || manifest.platform !== process.platform || manifest.arch !== process.arch) throw fail('LOCAL_RUNTIME_PLATFORM', 'Install the Daftar extension package built for this operating system and architecture.');
    if (manifest.entrypoint !== 'headless-runtime/server.mjs' || manifest.corePath !== `native-core/target/release/${process.platform === 'win32' ? 'atlas-core.exe' : 'atlas-core'}`) throw new Error();
    if (!manifest.files || typeof manifest.files !== 'object' || Array.isArray(manifest.files) || Object.keys(manifest.files).length > 2048
      || !Object.hasOwn(manifest.files, manifest.entrypoint) || !Object.hasOwn(manifest.files, manifest.corePath)) throw new Error();
    for (const [relative, info] of Object.entries(manifest.files)) {
      if (!safeRelative(relative) || !Number.isSafeInteger(info?.bytes) || info.bytes < 0 || info.bytes > 64 * 1024 * 1024 || !/^[a-f0-9]{64}$/.test(info.sha256)) throw new Error();
      let current = runtimeRoot;
      for (const part of relative.split('/')) { current = path.join(current, part); if (fs.lstatSync(current).isSymbolicLink()) throw new Error(); }
      const stat = fs.statSync(current); if (!stat.isFile() || stat.size !== info.bytes || sha(fs.readFileSync(current)) !== info.sha256) throw new Error();
    }
    return manifest;
  } catch (error) {
    if (error.code === 'LOCAL_RUNTIME_PLATFORM') throw error;
    throw fail('LOCAL_RUNTIME_PACKAGE', 'The packaged Daftar runtime is missing or failed its integrity check. Reinstall a matching extension package.');
  }
}
function privateDirectory(directory) {
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  const stat = fs.lstatSync(directory); if (!stat.isDirectory() || stat.isSymbolicLink()) throw fail('LOCAL_RUNTIME_STORAGE', 'Choose a real private extension storage directory.');
  if (process.platform !== 'win32') fs.chmodSync(directory, 0o700);
}
function childEnvironment(source, { runtimeRoot, dataDir, tokenFile, corePath, hostControlEnabled }) {
  const env = {};
  for (const key of ['PATH', 'Path', 'HOME', 'USERPROFILE', 'SystemRoot', 'SYSTEMROOT', 'WINDIR', 'TEMP', 'TMP', 'TMPDIR', 'LANG', 'LC_ALL']) {
    if (typeof source[key] === 'string' && !source[key].includes('\0')) env[key] = source[key];
  }
  return { ...env, NODE_ENV: 'production', ELECTRON_RUN_AS_NODE: '1', DAFTAR_REPO_ROOT: runtimeRoot,
    DAFTAR_DATA_DIR: dataDir, DAFTAR_CORE_BINARY: path.join(runtimeRoot, corePath), DAFTAR_HOST: '127.0.0.1',
    DAFTAR_PORT: '0', DAFTAR_CONTROL_TOKEN_FILE: tokenFile, DAFTAR_HOST_CONTROL: hostControlEnabled ? '1' : '0' };
}

function createLocalRuntime({ runtimeRoot, storagePath, hostControlEnabled = false, nodePath = process.execPath,
  spawnProcess = spawn, fetcher = globalThis.fetch, environment = process.env, startupTimeoutMs = 20000, stopTimeoutMs = 12000 } = {}) {
  if (!path.isAbsolute(runtimeRoot || '') || !path.isAbsolute(storagePath || '') || !path.isAbsolute(nodePath || '')
    || typeof hostControlEnabled !== 'boolean' || !Number.isInteger(startupTimeoutMs) || startupTimeoutMs < 100 || startupTimeoutMs > 60000
    || !Number.isInteger(stopTimeoutMs) || stopTimeoutMs < 10 || stopTimeoutMs > 15000) throw fail('LOCAL_RUNTIME_CONFIG', 'Use absolute runtime, Node, and private storage paths.');
  if (hostControlEnabled && process.platform !== 'linux') throw fail('LOCAL_RUNTIME_PLATFORM', 'SSH/tmux host control requires the Linux runtime. Other workbench operations remain available.');
  const directory = path.join(storagePath, 'runtime'); const dataDir = path.join(directory, 'data');
  const tokenFile = path.join(directory, 'control-token'); const lockFile = path.join(directory, 'launcher.lock');
  const nonce = crypto.randomUUID(); const lifetime = new AbortController(); const children = new Set();
  let state = 'idle', connection = null, starting = null, closing = null, mainChild = null, acquired = false;
  let token = '', startupTimer = null;
  const untilAbort = promise => new Promise((resolve, reject) => {
    const abort = () => reject(fail('LOCAL_RUNTIME_ABORTED', 'Local runtime startup was cancelled or timed out.'));
    if (lifetime.signal.aborted) return abort();
    lifetime.signal.addEventListener('abort', abort, { once: true });
    Promise.resolve(promise).then(resolve, reject).finally(() => lifetime.signal.removeEventListener('abort', abort));
  });
  const status = () => ({ state, url: connection?.url ?? null, pid: mainChild && !mainChild.exited ? mainChild.child.pid : null, hostControlEnabled });
  const alive = pid => { if (!Number.isInteger(pid) || pid < 1) return false; try { process.kill(pid, 0); return true; } catch (error) { return error.code !== 'ESRCH'; } };
  function acquire() {
    privateDirectory(storagePath); privateDirectory(directory); privateDirectory(dataDir);
    const owner = { ownerPid: process.pid, childPid: null, nonce };
    try { fs.writeFileSync(lockFile, JSON.stringify(owner), { flag: 'wx', mode: 0o600 }); }
    catch (error) {
      if (error.code !== 'EEXIST') throw error;
      const stat = fs.lstatSync(lockFile); if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 4096) throw new Error();
      const old = JSON.parse(fs.readFileSync(lockFile, 'utf8'));
      if (!Number.isInteger(old.ownerPid) || alive(old.ownerPid) || alive(old.childPid)) throw fail('LOCAL_RUNTIME_BUSY', 'Another owned Daftar runtime uses this extension storage. Stop that instance before starting another.');
      fs.unlinkSync(lockFile); fs.writeFileSync(lockFile, JSON.stringify(owner), { flag: 'wx', mode: 0o600 });
    }
    acquired = true;
    if (fs.existsSync(tokenFile)) { const stat = fs.lstatSync(tokenFile); if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(); fs.unlinkSync(tokenFile); }
    token = crypto.randomBytes(32).toString('base64url'); fs.writeFileSync(tokenFile, token + '\n', { flag: 'wx', mode: 0o600 });
  }
  function release() {
    if (!acquired) return;
    try {
      if (JSON.parse(fs.readFileSync(lockFile, 'utf8')).nonce === nonce) {
        if (fs.existsSync(tokenFile) && fs.readFileSync(tokenFile, 'utf8').trim() === token) fs.unlinkSync(tokenFile);
        fs.unlinkSync(lockFile);
      }
    } catch { /* Keep unconfirmed ownership on disk for local review. */ }
    acquired = false; token = ''; connection = null;
  }
  function own(args, env) {
    const child = spawnProcess(nodePath, args, { cwd: runtimeRoot, env, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true, shell: false });
    const record = { child, exited: false, closed: false, stopping: null, cleanups: [] };
    record.done = new Promise(resolve => { record.resolve = resolve; });
    const onExit = () => { record.exited = true; if (mainChild === record && state === 'running') { state = 'failed'; connection = null; } };
    const onError = () => { if (!child.pid) record.exited = true; };
    const onClose = () => { record.closed = true; record.exited = true; children.delete(record); record.resolve(); cleanup(record); };
    child.once('exit', onExit); child.on('error', onError); child.once('close', onClose);
    record.cleanups.push(() => { child.removeListener('exit', onExit); child.removeListener('error', onError); child.removeListener('close', onClose); });
    children.add(record); return record;
  }
  function cleanup(record) { for (const fn of record.cleanups.splice(0)) fn(); }
  function stop(record) {
    if (record.stopping) return record.stopping;
    record.stopping = (async () => {
      if (record.closed) { cleanup(record); return; }
      let timer;
      const bounded = delay => Promise.race([record.done, new Promise(resolve => { timer = setTimeout(resolve, delay); })]).finally(() => clearTimeout(timer));
      if (!record.exited) { try { record.child.kill('SIGTERM'); } catch {} }
      await bounded(stopTimeoutMs);
      if (!record.closed) { try { record.child.kill('SIGKILL'); } catch {} await bounded(Math.min(stopTimeoutMs, 1000)); }
      cleanup(record);
      if (!record.closed) throw fail('LOCAL_RUNTIME_STOP_UNCONFIRMED', 'The owned runtime did not confirm exit. Its storage lock is retained for review.');
    })();
    return record.stopping;
  }
  async function captureVersion(env) {
    const record = own(['--version'], env); let output = '', bytes = 0;
    const onData = chunk => { bytes += chunk.length; if (bytes <= 128) output += chunk.toString('utf8'); else record.child.kill('SIGTERM'); };
    const drain = () => {};
    record.child.stdout.on('data', onData); record.child.stderr.on('data', drain);
    record.cleanups.push(() => { record.child.stdout.removeListener('data', onData); record.child.stderr.removeListener('data', drain); });
    const abort = () => { void stop(record).catch(() => {}); };
    lifetime.signal.addEventListener('abort', abort, { once: true });
    try {
      await untilAbort(record.done);
      if (lifetime.signal.aborted) throw fail('LOCAL_RUNTIME_ABORTED', 'Local runtime startup was cancelled.');
      const version = /^v(\d+)\.\d+\.\d+(?:-[A-Za-z0-9.-]+)?\s*$/.exec(output);
      if (!version || bytes > 128 || Number(version[1]) < 22 || record.child.exitCode !== 0) throw fail('LOCAL_RUNTIME_NODE', 'Daftar requires Node.js 22 or later. Select a compatible Node executable in the machine settings.');
    } finally { lifetime.signal.removeEventListener('abort', abort); cleanup(record); }
  }
  async function authenticate(url) {
    let reader, response;
    try {
      response = await fetcher(url + '/v1/status', { redirect: 'error', signal: lifetime.signal, headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } });
      if (!response.ok || response.redirected || response.url && new URL(response.url).origin !== url || !response.headers.get('content-type')?.includes('application/json')) throw new Error();
      reader = response.body?.getReader(); if (!reader) throw new Error();
      let bytes = 0; const chunks = [];
      for (;;) { const item = await reader.read(); if (item.done) break; bytes += item.value.length; if (bytes > 65536) throw new Error(); chunks.push(item.value); }
      const value = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      if (value.ok !== true || value.execution !== 'headless' || value.worker?.enabled !== false || value.capabilities?.workbench !== true) throw new Error();
    } catch { throw fail('LOCAL_RUNTIME_HEALTH', 'The owned runtime could not confirm authenticated, paused-workbench readiness.'); }
    finally { try { if (reader) { await reader.cancel(); reader.releaseLock(); } else await response?.body?.cancel(); } catch {} }
  }
  async function boot(signal) {
    const cancel = () => lifetime.abort();
    if (signal?.aborted) throw fail('LOCAL_RUNTIME_ABORTED', 'Local runtime startup was cancelled.');
    signal?.addEventListener('abort', cancel, { once: true });
    startupTimer = setTimeout(cancel, startupTimeoutMs); state = 'starting';
    try {
      const manifest = verifyRuntime(runtimeRoot); acquire();
      const env = childEnvironment(environment, { runtimeRoot, dataDir, tokenFile, corePath: manifest.corePath, hostControlEnabled });
      await captureVersion(env);
      if (lifetime.signal.aborted) throw new Error();
      const record = own([path.join(runtimeRoot, manifest.entrypoint)], env); mainChild = record;
      fs.writeFileSync(lockFile, JSON.stringify({ ownerPid: process.pid, childPid: record.child.pid ?? null, nonce }), { mode: 0o600 });
      const url = await new Promise((resolve, reject) => {
        const decoder = new StringDecoder('utf8'); let text = '', bytes = 0;
        const onData = chunk => {
          bytes += chunk.length; if (bytes > 16384) return reject(fail('LOCAL_RUNTIME_STARTUP', 'Runtime readiness exceeded its bounded startup output.'));
          text += decoder.write(chunk); let newline;
          while ((newline = text.indexOf('\n')) >= 0) {
            const line = text.slice(0, newline).replace(/\r$/, ''); text = text.slice(newline + 1);
            const match = /^Daftar headless runtime listening on 127\.0\.0\.1:(\d{1,5}); workers paused\.$/.exec(line);
            if (match && Number(match[1]) > 0 && Number(match[1]) <= 65535) resolve(`http://127.0.0.1:${Number(match[1])}`);
          }
        };
        const onExit = () => reject(fail('LOCAL_RUNTIME_STARTUP', 'The owned runtime exited before confirming readiness.'));
        const onAbort = () => reject(fail('LOCAL_RUNTIME_ABORTED', 'Local runtime startup was cancelled or timed out.'));
        const drain = () => {};
        record.child.stdout.on('data', onData); record.child.stderr.on('data', drain);
        record.child.once('close', onExit); record.child.once('error', onExit); lifetime.signal.addEventListener('abort', onAbort, { once: true });
        record.cleanups.push(() => { record.child.stdout.removeListener('data', onData); record.child.stderr.removeListener('data', drain);
          record.child.removeListener('close', onExit); record.child.removeListener('error', onExit); lifetime.signal.removeEventListener('abort', onAbort); });
      });
      await untilAbort(authenticate(url));
      if (lifetime.signal.aborted || record.exited) throw new Error();
      connection = { kind: 'runtime', url, controlToken: token }; state = 'running';
      return { ...connection };
    } catch (error) {
      state = closing ? 'stopped' : 'failed'; lifetime.abort();
      const outcomes = await Promise.allSettled([...children].map(stop));
      if (outcomes.every(item => item.status === 'fulfilled')) release();
      if (error?.code?.startsWith('LOCAL_RUNTIME_')) throw error;
      throw fail('LOCAL_RUNTIME_STARTUP', 'The local runtime could not start. Check its matching package, Node executable, and private extension storage.');
    } finally { clearTimeout(startupTimer); startupTimer = null; signal?.removeEventListener('abort', cancel); }
  }
  function start({ signal } = {}) {
    if (state === 'running') return Promise.resolve({ ...connection });
    if (starting && state === 'starting') return starting;
    if (state !== 'idle' || closing) return Promise.reject(fail('LOCAL_RUNTIME_CLOSED', 'Create a new owned runtime to start after stopping or a failed startup.'));
    starting = boot(signal); return starting;
  }
  function close() {
    if (closing) return closing;
    closing = (async () => {
      lifetime.abort(); clearTimeout(startupTimer); startupTimer = null;
      const outcomes = await Promise.allSettled([...children].map(stop));
      await starting?.catch(() => {});
      state = 'stopped'; connection = null;
      if (outcomes.some(item => item.status === 'rejected')) throw outcomes.find(item => item.status === 'rejected').reason;
      release();
    })();
    return closing;
  }
  return { start, close, status, diagnostics: () => ({ children: children.size, startupTimer: startupTimer !== null,
    childListeners: [...children].reduce((sum, record) => sum + record.child.eventNames().reduce((count, name) => count + record.child.listenerCount(name), 0), 0) }) };
}

module.exports = { createLocalRuntime, verifyRuntime, childEnvironment };
