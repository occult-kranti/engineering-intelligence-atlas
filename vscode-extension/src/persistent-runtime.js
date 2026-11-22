'use strict';
// Explicit Linux start of the packaged, dedicated tmux supervisor. Closing this
// editor adapter cancels bootstrap requests; it never stops the daemon or jobs.
const fs = require('node:fs');
const path = require('node:path');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { verifyRuntime } = require('./local-runtime');

const execute = promisify(execFile);
const TOKEN = /^[A-Za-z0-9_-]{32,256}$/;
const OUTPUT_LIMIT = 65536;
const fail = (code, message) => Object.assign(new Error(message), { code });
function abortable(promise, signal) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (handler, value) => { if (settled) return; settled = true; signal.removeEventListener('abort', abort); handler(value); };
    const abort = () => finish(reject, fail('PERSISTENT_RUNTIME_ABORTED', 'Persistent runtime bootstrap was cancelled or timed out. The daemon may still be running; no start was retried.'));
    signal.addEventListener('abort', abort, { once: true });
    Promise.resolve(promise).then(value => finish(resolve, value), error => finish(reject, error));
    if (signal.aborted) abort();
  });
}
function cancel(body) { try { Promise.resolve(body?.cancel?.()).catch(() => {}); } catch {} }
function privateDirectory(directory) {
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  const stat = fs.lstatSync(directory);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw fail('PERSISTENT_RUNTIME_STORAGE', 'Persistent runtime storage must be a real private directory.');
  fs.chmodSync(directory, 0o700); return fs.realpathSync(directory);
}
function readToken(dataDir, filename) {
  const secretDirectory = path.join(dataDir, 'secrets');
  const expected = path.join(secretDirectory, 'control-token');
  let fd;
  try {
    if (filename !== expected) throw new Error();
    const directory = fs.lstatSync(secretDirectory);
    if (!directory.isDirectory() || directory.isSymbolicLink() || directory.mode & 0o077) throw new Error();
    const before = fs.lstatSync(filename);
    if (!before.isFile() || before.isSymbolicLink()) throw new Error();
    fd = fs.openSync(filename, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW ?? 0) | (fs.constants.O_NONBLOCK ?? 0));
    const stat = fs.fstatSync(fd);
    if (!stat.isFile() || before.ino !== stat.ino || before.dev !== stat.dev || ![0o400, 0o600].includes(stat.mode & 0o777) || stat.size < 32 || stat.size > 258) throw new Error();
    const value = fs.readFileSync(fd, 'utf8');
    if (!/^[A-Za-z0-9_-]{32,256}(?:\r?\n)?$/.test(value) || !TOKEN.test(value.trim())) throw new Error();
    return value.trim();
  } catch { throw fail('PERSISTENT_RUNTIME_CREDENTIAL', 'The supervisor did not provide its expected private control-token file. Inspect this data directory; no other credential path was read.'); }
  finally { if (fd !== undefined) fs.closeSync(fd); }
}

function createPersistentRuntime({ runtimeRoot, storagePath, nodePath = process.execPath, execFileFn = execute,
  fetcher = globalThis.fetch, environment = process.env, startupTimeoutMs = 30000 } = {}) {
  if (process.platform !== 'linux') throw fail('PERSISTENT_RUNTIME_PLATFORM', 'Persistent tmux workspaces require a Linux host. Use the regular standalone workspace on this platform.');
  if (!path.isAbsolute(runtimeRoot || '') || !path.isAbsolute(storagePath || '') || !path.isAbsolute(nodePath || '')
      || !Number.isInteger(startupTimeoutMs) || startupTimeoutMs < 100 || startupTimeoutMs > 60000) throw fail('PERSISTENT_RUNTIME_CONFIG', 'Use absolute package, Node, and private storage paths with a bounded startup deadline.');
  let dataDir = path.join(storagePath, 'persistent-runtime');
  let state = 'idle', starting = null, closing = null, connection = null, token = '', runtimeUrl = null, hostControlEnabled = null;
  let startDispatched = false, bootstrapTimer = null, retryTimer = null, pendingOperations = 0;
  const lifetime = new AbortController();
  const env = { ELECTRON_RUN_AS_NODE: '1', NODE_ENV: 'production' };
  for (const name of ['PATH', 'HOME', 'USER', 'LOGNAME', 'LANG', 'LC_ALL', 'TMPDIR', 'TERM']) {
    if (typeof environment[name] === 'string' && !environment[name].includes('\0')) env[name] = environment[name];
  }
  const status = () => ({ state, connected: state === 'ready', persistent: true, dataDir,
    url: runtimeUrl, hostControlEnabled, daemonMayBeRunning: startDispatched });
  async function invoke(args) {
    pendingOperations++;
    try {
      const output = await abortable(Promise.resolve().then(() => {
        if (lifetime.signal.aborted) throw fail('PERSISTENT_RUNTIME_ABORTED', 'Persistent runtime startup was cancelled.');
        return execFileFn(nodePath, args, { cwd: runtimeRoot, env, shell: false, windowsHide: true,
          signal: lifetime.signal, timeout: Math.min(startupTimeoutMs, 15000), maxBuffer: OUTPUT_LIMIT });
      }), lifetime.signal);
      if (typeof output?.stdout !== 'string' || Buffer.byteLength(output.stdout) > OUTPUT_LIMIT
          || typeof output.stderr === 'string' && Buffer.byteLength(output.stderr) > OUTPUT_LIMIT) throw new Error();
      return output.stdout;
    } catch (error) {
      if (typeof error?.code === 'string' && error.code.startsWith('PERSISTENT_RUNTIME_')) throw error;
      throw fail('PERSISTENT_RUNTIME_BOOTSTRAP', 'The persistent supervisor did not confirm startup. Verify Node22+, tmux, package integrity and private state; inspect before repeating start.');
    } finally { pendingOperations--; }
  }
  async function probe() {
    const controller = new AbortController(); const abort = () => controller.abort();
    lifetime.signal.addEventListener('abort', abort, { once: true }); if (lifetime.signal.aborted) abort();
    const timeout = setTimeout(abort, Math.min(startupTimeoutMs, 2500)); let response, reader;
    pendingOperations++;
    try {
      const requested = Promise.resolve().then(() => {
        if (controller.signal.aborted) throw new Error();
        return fetcher(runtimeUrl + '/v1/status', { method: 'GET', redirect: 'error', signal: controller.signal,
          headers: { Accept: 'application/json', Authorization: `Bearer ${token}` } });
      });
      void requested.then(value => { if (controller.signal.aborted) cancel(value?.body); }, () => {});
      response = await abortable(requested, controller.signal);
      if (response.redirected || response.url && new URL(response.url).origin !== runtimeUrl) throw fail('PERSISTENT_RUNTIME_IDENTITY', 'The runtime redirected its readiness check. No control credential was forwarded.');
      if ([401, 403].includes(response.status)) throw fail('PERSISTENT_RUNTIME_IDENTITY', 'A different or unauthorized service answered on the supervisor port. No start or authentication request was retried.');
      if (!response.ok) {
        if (response.status >= 500) return false;
        throw fail('PERSISTENT_RUNTIME_IDENTITY', 'The configured port did not return a compatible Daftar runtime.');
      }
      if (!response.headers.get('content-type')?.includes('application/json')) throw fail('PERSISTENT_RUNTIME_IDENTITY', 'The configured port returned an unexpected service response.');
      reader = response.body?.getReader(); if (!reader) throw fail('PERSISTENT_RUNTIME_IDENTITY', 'Readiness returned an empty body.');
      const chunks = []; let size = 0;
      for (;;) {
        const item = await abortable(reader.read(), controller.signal); if (item.done) break;
        if (!(item.value instanceof Uint8Array) || (size += item.value.byteLength) > OUTPUT_LIMIT) throw fail('PERSISTENT_RUNTIME_IDENTITY', 'Readiness exceeded its bounded response contract.');
        chunks.push(Buffer.from(item.value));
      }
      let value; try { value = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw fail('PERSISTENT_RUNTIME_IDENTITY', 'Readiness returned malformed data.'); }
      if (value.ok !== true || value.execution !== 'headless' || value.capabilities?.workbench !== true
          || typeof value.worker?.enabled !== 'boolean' || typeof value.worker?.running !== 'boolean'
          || value.host?.configured !== hostControlEnabled || !['off', 'manual', 'auto'].includes(value.host?.mode)) throw fail('PERSISTENT_RUNTIME_IDENTITY', 'The service on this port does not match the supervisor workbench configuration.');
      // Reconnecting must preserve already authorized workers and host policy.
      return true;
    } catch (error) {
      if (error?.code === 'PERSISTENT_RUNTIME_IDENTITY') throw error;
      if (lifetime.signal.aborted) throw fail('PERSISTENT_RUNTIME_ABORTED', 'Persistent runtime readiness was cancelled or timed out. The daemon was left running if it started.');
      return false;
    } finally {
      cancel(reader ?? response?.body); try { reader?.releaseLock(); } catch {}
      controller.abort(); clearTimeout(timeout); lifetime.signal.removeEventListener('abort', abort); pendingOperations--;
    }
  }
  function pause() {
    return new Promise((resolve, reject) => {
      const finish = callback => { clearTimeout(retryTimer); retryTimer = null; lifetime.signal.removeEventListener('abort', abort); callback(); };
      const abort = () => finish(() => reject(fail('PERSISTENT_RUNTIME_ABORTED', 'Persistent runtime readiness was cancelled.')));
      lifetime.signal.addEventListener('abort', abort, { once: true });
      retryTimer = setTimeout(() => finish(resolve), 150); if (lifetime.signal.aborted) abort();
    });
  }
  async function boot(signal) {
    state = 'starting';
    const abort = () => lifetime.abort(); signal?.addEventListener('abort', abort, { once: true });
    bootstrapTimer = setTimeout(abort, startupTimeoutMs);
    try {
      if (signal?.aborted || lifetime.signal.aborted) throw fail('PERSISTENT_RUNTIME_ABORTED', 'Persistent runtime startup was cancelled.');
      const manifest = verifyRuntime(runtimeRoot);
      if (!Object.hasOwn(manifest.files, 'deploy/tmux-runtime.mjs')) throw fail('PERSISTENT_RUNTIME_PACKAGE', 'This runtime package has no verified tmux supervisor.');
      privateDirectory(storagePath); dataDir = privateDirectory(dataDir);
      const version = /^v(\d+)\.\d+\.\d+(?:-[A-Za-z0-9.-]+)?\s*$/.exec(await invoke(['--version']));
      if (!version || Number(version[1]) < 22) throw fail('PERSISTENT_RUNTIME_NODE', 'Persistent workspaces require Node.js22 or later.');
      if (lifetime.signal.aborted) throw fail('PERSISTENT_RUNTIME_ABORTED', 'Persistent runtime startup was cancelled.');
      startDispatched = true;
      let description;
      try { description = JSON.parse(await invoke([path.join(runtimeRoot, 'deploy/tmux-runtime.mjs'), 'start', '--repo', runtimeRoot, '--data', dataDir, '--enable-host-control'])); }
      catch (error) { if (typeof error?.code === 'string' && error.code.startsWith('PERSISTENT_RUNTIME_')) throw error; throw fail('PERSISTENT_RUNTIME_BOOTSTRAP', 'Supervisor returned no verifiable startup receipt. Inspect the persistent session; no start was retried.'); }
      if (description?.ok !== true || description.running !== true || description.dataDir !== dataDir
          || description.repoRoot !== fs.realpathSync(runtimeRoot) || typeof description.hostControlEnabled !== 'boolean'
          || typeof description.runtimeUrl !== 'string' || !/^http:\/\/127\.0\.0\.1:\d{4,5}$/.test(description.runtimeUrl)) throw fail('PERSISTENT_RUNTIME_IDENTITY', 'The existing supervisor does not match this package and private data directory. It was not stopped or replaced.');
      const parsed = new URL(description.runtimeUrl); if (Number(parsed.port) < 1024 || Number(parsed.port) > 65535) throw fail('PERSISTENT_RUNTIME_IDENTITY', 'Supervisor returned an invalid loopback port.');
      runtimeUrl = parsed.origin; hostControlEnabled = description.hostControlEnabled;
      token = readToken(dataDir, description.controlTokenFile);
      for (let attempt = 0; attempt < 100; attempt++) {
        if (await probe()) {
          if (lifetime.signal.aborted) throw fail('PERSISTENT_RUNTIME_ABORTED', 'Persistent runtime readiness was cancelled.');
          connection = { kind: 'runtime', url: runtimeUrl, controlToken: token }; state = 'ready'; return { ...connection };
        }
        await pause();
      }
      throw fail('PERSISTENT_RUNTIME_READINESS', 'The persistent session exists but its API readiness was not confirmed. Inspect its private supervisor logs. No start was retried.');
    } catch (error) {
      state = closing ? 'detached' : 'failed'; connection = null; token = '';
      if (typeof error?.code === 'string' && /^(?:PERSISTENT|LOCAL)_RUNTIME_/.test(error.code)) throw error;
      throw fail('PERSISTENT_RUNTIME_BOOTSTRAP', 'Persistent runtime startup could not be confirmed. Inspect its state before a new start; no automatic retry was sent.');
    } finally { clearTimeout(bootstrapTimer); bootstrapTimer = null; signal?.removeEventListener('abort', abort); }
  }
  function start({ signal } = {}) {
    if (state === 'ready') return Promise.resolve({ ...connection });
    if (state === 'starting' && starting) return starting;
    if (state !== 'idle' || closing) return Promise.reject(fail('PERSISTENT_RUNTIME_CLOSED', 'This persistent runtime adapter is closed or failed. Inspect the original session before opening another.'));
    starting = boot(signal); return starting;
  }
  function close() {
    if (closing) return closing;
    closing = (async () => { lifetime.abort(); await starting?.catch(() => {}); connection = null; token = ''; state = startDispatched ? 'detached' : 'closed'; })();
    return closing;
  }
  return { start, close, status, get dataDir() { return dataDir; }, diagnostics: () => ({ pendingOperations, bootstrapTimer: bootstrapTimer !== null, retryTimer: retryTimer !== null }) };
}

module.exports = { createPersistentRuntime };
