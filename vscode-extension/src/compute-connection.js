'use strict';

/**
 * Connection manager for an EXISTING, user-owned SSH target (VPS).
 * It never provisions, rents, starts, stops or destroys anything.
 *
 * "connected" means an authenticated Daftar readiness probe succeeded through the
 * local SSH tunnel. It does NOT imply GPU availability. SSH authentication follows
 * the user's own key / agent / known_hosts. Host key verification stays enabled.
 * This module exposes no arbitrary remote-command API and makes no billing or
 * model calls.
 */

const { spawn } = require('node:child_process');
const path = require('node:path');
const { isIP } = require('node:net');

const VAST_URL = 'https://console.vast.ai/api/v1/instances/';
const MAX_BODY = 2 * 1024 * 1024;
const MAX_STDERR = 64 * 1024;
const MAX_INSTANCES = 100;
const KILL_GRACE_MS = 2000;
const PROBE_INTERVAL_MS = 200;

const ID_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
const USER_RE = /^[A-Za-z_][A-Za-z0-9_-]{0,31}$/;
const LABEL_RE = /^[^\u0000-\u001f\u007f-\u009f]{1,100}$/;
const DNS_LABEL_RE = /^(?!-)[A-Za-z0-9-]{1,63}(?<!-)$/;
const ALLOWED_FIELDS = new Set(['id', 'label', 'host', 'port', 'user', 'localPort', 'remotePort', 'keyFile']);

const exactMatch = (pattern, value) => { const match = pattern.exec(value); return match !== null && match[0].length === value.length; };
function isDns(h) {
  if (h.length > 253) return false;
  const labels = h.split('.');
  if (/^\d+$/.test(labels[labels.length - 1])) return false;
  return labels.every((l) => exactMatch(DNS_LABEL_RE, l));
}
function validHost(h) {
  return typeof h === 'string' && h.length > 0 && h.length <= 160 && !/[^A-Za-z0-9.:-]/.test(h) && (isIP(h) !== 0 || isDns(h));
}
function validPort(n, min) {
  return Number.isInteger(n) && n >= min && n <= 65535;
}

function validateProfile(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) || ![Object.prototype, null].includes(Object.getPrototypeOf(raw))) throw new Error('Invalid profile');
  for (const k of Object.keys(raw)) {
    if (!ALLOWED_FIELDS.has(k)) throw new Error('Invalid profile: unknown field');
  }
  if (typeof raw.id !== 'string' || !exactMatch(ID_RE, raw.id)) throw new Error('Invalid profile id');
  if (typeof raw.label !== 'string' || !exactMatch(LABEL_RE, raw.label)) throw new Error('Invalid profile label');
  if (!validHost(raw.host)) throw new Error('Invalid profile host');
  const user = raw.user === undefined ? 'root' : raw.user;
  if (typeof user !== 'string' || !exactMatch(USER_RE, user)) throw new Error('Invalid profile user');
  if (!validPort(raw.port, 1)) throw new Error('Invalid profile port');
  const localPort = raw.localPort === undefined ? 18788 : raw.localPort;
  const remotePort = raw.remotePort === undefined ? 8788 : raw.remotePort;
  if (!validPort(localPort, 1024)) throw new Error('Invalid profile localPort');
  if (!validPort(remotePort, 1)) throw new Error('Invalid profile remotePort');
  const out = { id: raw.id, label: raw.label, host: raw.host, port: raw.port, user, localPort, remotePort };
  if (raw.keyFile !== undefined) {
    const k = raw.keyFile;
    if (typeof k !== 'string' || !k || k.length > 4096 || /[\u0000-\u001f\u007f-\u009f]/.test(k) ||
        !(path.posix.isAbsolute(k) || path.win32.isAbsolute(k))) {
      throw new Error('Invalid profile keyFile');
    }
    out.keyFile = k; // path only; key bytes are never read here
  }
  return out;
}

const num = (v) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null);
const str = (v) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f-\u009f]/g, '').slice(0, 200) : null);

// Cancellation must settle our API even when a supplied fetch/probe/reader
// ignores AbortSignal. The underlying promise is handled, never awaited forever.
function abortable(promise, signal) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (handler, value) => { if (settled) return; settled = true; signal.removeEventListener('abort', aborted); handler(value); };
    const aborted = () => finish(reject, new Error('Operation aborted'));
    signal.addEventListener('abort', aborted, { once: true });
    Promise.resolve(promise).then(value => finish(resolve, value), error => finish(reject, error));
    if (signal.aborted) aborted();
  });
}
function cancelBody(body) {
  try { Promise.resolve(body?.cancel?.()).catch(() => {}); } catch { /* cleanup cannot block the deadline */ }
}

async function readLimited(res, limit, signal) {
  const reader = res.body && typeof res.body.getReader === 'function' ? res.body.getReader() : null;
  if (!reader) throw new Error('bad body');
  const chunks = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await abortable(reader.read(), signal);
      if (done) break;
      if (!(value instanceof Uint8Array)) throw new Error('bad body chunk');
      total += value.byteLength;
      if (total > limit) throw new Error('too large');
      chunks.push(Buffer.from(value));
    }
    return Buffer.concat(chunks).toString('utf8');
  } finally {
    cancelBody(reader);
    try { reader.releaseLock(); } catch { /* ignore */ }
  }
}

async function fetchVastInstances(apiKey, { fetcher = fetch, signal, timeoutMs = 20000 } = {}) {
  const fail = () => new Error('Vast instance listing failed');
  if (typeof apiKey !== 'string' || !apiKey || apiKey.length > 8192 || /[\r\n\0]/.test(apiKey) || !Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 60000) throw fail();
  const ac = new AbortController();
  const onAbort = () => ac.abort();
  if (signal) {
    if (signal.aborted) throw fail();
    signal.addEventListener('abort', onAbort, { once: true });
  }
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await abortable(Promise.resolve().then(() => {
      if (ac.signal.aborted) throw fail();
      return fetcher(VAST_URL, {
      method: 'GET',
      headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
      redirect: 'error',
      signal: ac.signal,
      });
    }), ac.signal);
    if (!res || !res.ok) {
      cancelBody(res?.body);
      throw fail();
    }
    const text = await readLimited(res, MAX_BODY, ac.signal);
    const data = JSON.parse(text);
    if (!data || data.success !== true || !Array.isArray(data.instances)) throw fail();
    const all = data.instances;
    if (data.total_instances != null && (!Number.isSafeInteger(data.total_instances) || data.total_instances < all.length)) throw fail();
    if (data.next_token != null && (typeof data.next_token !== 'string' || data.next_token.length > 4096)) throw fail();
    if (data.has_more != null && typeof data.has_more !== 'boolean') throw fail();
    const instances = all.slice(0, MAX_INSTANCES).map((i) => {
      const r = i && typeof i === 'object' ? i : {};
      return {
        id: num(r.id), actual_status: str(r.actual_status), intended_status: str(r.intended_status),
        gpu_name: str(r.gpu_name), gpu_ram: num(r.gpu_ram), cpu_ram: num(r.cpu_ram),
        disk_space: num(r.disk_space), ssh_host: str(r.ssh_host), ssh_port: num(r.ssh_port),
      };
    });
    const nextPage = typeof data.next_token === 'string' && data.next_token.length > 0;
    const reportedTotal = Number.isSafeInteger(data.total_instances) && data.total_instances >= all.length ? data.total_instances : null;
    return {
      instances,
      gpuVerified: false,
      totalInstances: reportedTotal ?? (nextPage || data.has_more === true ? null : all.length),
      hasMore: all.length > MAX_INSTANCES || nextPage || data.has_more === true || (reportedTotal !== null && reportedTotal > instances.length),
    };
  } catch {
    throw fail();
  } finally {
    clearTimeout(timer);
    if (signal) signal.removeEventListener('abort', onAbort);
  }
}

function buildSshArgs(profile) {
  const p = validateProfile(profile);
  const args = [
    '-N', '-T',
    '-o', 'BatchMode=yes',
    '-o', 'StrictHostKeyChecking=yes',
    '-o', 'ExitOnForwardFailure=yes',
    '-o', 'ServerAliveInterval=15',
    '-o', 'ServerAliveCountMax=3',
    '-p', String(p.port),
    '-L', `127.0.0.1:${p.localPort}:127.0.0.1:${p.remotePort}`,
  ];
  if (p.keyFile) args.push('-i', p.keyFile);
  args.push(`${p.user}@${p.host}`);
  return args;
}

const sleep = (ms, signal) => new Promise((resolve) => {
  const t = setTimeout(done, ms);
  function done() { signal.removeEventListener('abort', done); clearTimeout(t); resolve(); }
  signal.addEventListener('abort', done, { once: true });
  if (signal.aborted) done();
});

class ComputeConnection {
  constructor({ spawnImpl = spawn, probe, timeoutMs = 15000, killGraceMs = KILL_GRACE_MS } = {}) {
    if (typeof probe !== 'function' || typeof spawnImpl !== 'function' || !Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 60000 || !Number.isInteger(killGraceMs) || killGraceMs < 1 || killGraceMs > 10000) throw new Error('Invalid connection options');
    this._spawn = spawnImpl;
    this._probe = probe;
    this._timeoutMs = timeoutMs;
    this._killGraceMs = killGraceMs;
    this._gen = 0;
    this._state = 'stopped';
    this._lastError = null;
    this._profile = null;
    this._runtimeUrl = null;
    this._record = null;
    this._pending = null;
  }

  status() {
    const s = { state: this._state, lastError: this._lastError };
    if (this._profile) {
      s.profile = this._publicProfile(this._profile);
    }
    if (this._state === 'connected') s.runtimeUrl = this._runtimeUrl;
    return s;
  }

  _publicProfile(p) {
    return { id: p.id, label: p.label, host: p.host, port: p.port, user: p.user };
  }

  connect(rawProfile) {
    const profile = validateProfile(rawProfile);
    if (this._state === 'connecting' || this._state === 'connected') {
      const identical = JSON.stringify(this._profile) === JSON.stringify(profile);
      if (identical && this._pending && this._state === 'connecting') return this._pending;
      if (identical && this._state === 'connected') {
        return Promise.resolve(this._result());
      }
      return Promise.reject(new Error('Another connection is active'));
    }
    const gen = ++this._gen;
    this._profile = profile;
    this._state = 'connecting';
    this._lastError = null;
    const p = this._run(profile, gen);
    this._pending = p;
    const clear = () => { if (this._pending === p) this._pending = null; };
    p.then(clear, clear);
    return p;
  }

  _result() {
    return { state: 'connected', runtimeUrl: this._runtimeUrl, profile: this._publicProfile(this._profile), verifiedRuntime: true, gpuVerified: false };
  }

  _fail(gen, msg) {
    if (gen !== this._gen) return;
    this._lastError = msg;
    this._state = 'failed';
    this._teardown();
  }

  async _run(profile, gen) {
    const ac = new AbortController();
    const record = { ac, child: null, exited: false, cleanup: null };
    this._record = record;
    const timer = setTimeout(() => ac.abort(), this._timeoutMs);
    const stale = () => gen !== this._gen;
    const runtimeUrl = `http://127.0.0.1:${profile.localPort}`;
    try {
      const child = this._spawn('ssh', buildSshArgs(profile), { shell: false, stdio: ['ignore', 'ignore', 'pipe'] });
      record.child = child;
      let drained = 0;
      const onData = (chunk) => {
        drained += chunk ? chunk.length : 0; // discarded, never logged
        if (drained > MAX_STDERR) {
          this._fail(gen, 'SSH produced excessive output');
          ac.abort();
        }
      };
      const onExit = () => {
        record.exited = true;
        if (stale()) return;
        this._fail(gen, 'SSH process exited');
        ac.abort();
      };
      const onError = () => {
        if (stale()) return;
        this._fail(gen, 'SSH process error');
        ac.abort();
      };
      child.on('exit', onExit);
      child.on('error', onError);
      if (child.stderr) child.stderr.on('data', onData);
      record.cleanup = () => {
        child.removeListener('exit', onExit);
        child.removeListener('error', onError);
        if (child.stderr) child.stderr.removeListener('data', onData);
      };

      let ready = false;
      while (!ac.signal.aborted) {
        try {
          // The callback must authenticate the private Daftar readiness endpoint.
          // A truthy public-health object is not accepted as an assertion of that.
          ready = await abortable(Promise.resolve().then(() => ac.signal.aborted ? false : this._probe(runtimeUrl, ac.signal)), ac.signal) === true;
          if (ready) break;
        } catch { if (ac.signal.aborted) break; }
        await sleep(PROBE_INTERVAL_MS, ac.signal);
      }
      if (stale()) throw new Error('Connection cancelled');
      if (!ready || ac.signal.aborted || this._state === 'failed') {
        if (this._state !== 'failed') this._fail(gen, 'Runtime probe failed or timed out');
        throw new Error('Connection failed');
      }
      this._runtimeUrl = runtimeUrl;
      this._state = 'connected';
      return this._result();
    } catch (e) {
      if (!stale() && this._state !== 'failed') this._fail(gen, 'Connection failed');
      throw new Error(stale() ? 'Connection cancelled' : 'Connection failed');
    } finally {
      clearTimeout(timer);
    }
  }

  _teardown() {
    const record = this._record;
    this._record = null;
    if (!record) return;
    const { child, ac } = record;
    ac.abort();
    record.cleanup?.();
    if (child) {
      const hasExited = () => record.exited || (child.exitCode !== null && child.exitCode !== undefined) || (child.signalCode !== null && child.signalCode !== undefined);
      if (hasExited()) return;
      let timer;
      const ignoreLateError = () => {};
      const cleanup = () => {
        clearTimeout(timer);
        child.removeListener('exit', onGone);
        child.removeListener('close', cleanup);
        child.removeListener('error', ignoreLateError);
      };
      const onGone = () => { record.exited = true; clearTimeout(timer); child.removeListener('exit', onGone); };
      child.once('exit', onGone); child.once('close', cleanup); child.on('error', ignoreLateError);
      try { if (!hasExited()) child.kill('SIGTERM'); } catch { /* child API only; no raw PID signalling */ }
      if (hasExited()) { cleanup(); return; }
      // This timer belongs only to this child. Reconnecting cannot cancel it.
      timer = setTimeout(() => {
        if (!hasExited()) { try { child.kill('SIGKILL'); } catch { /* no unrelated-process fallback */ } }
        child.removeListener('exit', onGone);
        // Actual ChildProcess emits close after exit; its one remaining error
        // guard is removed there. A test double may retain it until it closes.
      }, this._killGraceMs);
    }
  }

  async close() {
    this._gen += 1; // invalidate callbacks of any in-flight connect
    const pending = this._pending;
    this._teardown();
    this._pending = null;
    this._runtimeUrl = null;
    this._state = 'disconnected';
    this._lastError = null;
    if (pending) { try { await pending; } catch { /* rejected safely */ } }
  }
}

module.exports = { validateProfile, fetchVastInstances, buildSshArgs, ComputeConnection };
