import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { RuntimeError } from './contract.mjs';
import { readSecretFile } from './secrets.mjs';

const MAGIC = Buffer.from('DAFTAR-CLOUD-GCM1\0');
const MAX_CREDENTIAL_BYTES = 32768;
const PRIVATE_MODES = [0o400, 0o600];
const genericError = 'Cloud synchronization needs review. Local work and remote writer protection remain in place.';

function configError() { return new RuntimeError('INVALID_CLOUD_CONFIG', 'Cloud sync requires an HTTPS origin, an existing private device-pairing file, a separate private 32-byte encryption key, and a 60–3600 second interval.', 503); }
function cloudOrigin(raw) {
  if (typeof raw !== 'string' || raw.length > 2048) throw configError();
  let url; try { url = new URL(raw); } catch { throw configError(); }
  if ((url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)))
      || url.username || url.password || url.pathname !== '/' || url.search || url.hash || raw.replace(/\/$/, '') !== url.origin) throw configError();
  return url.origin;
}
function outsideState(filename, stateDir) {
  if (typeof filename !== 'string' || !path.isAbsolute(filename)) throw configError();
  // realpath also prevents a parent-directory symlink from putting the key in a state backup.
  let realFile, realState;
  try { realFile = fs.realpathSync(filename); realState = fs.realpathSync(stateDir); } catch { throw configError(); }
  const relative = path.relative(realState, realFile);
  if (relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative))) throw configError();
}
function privateExistingCloudFiles(stateDir) {
  const directory = path.join(stateDir, 'cloud');
  if (!fs.existsSync(directory)) return;
  const stat = fs.lstatSync(directory);
  if (!stat.isDirectory() || stat.isSymbolicLink() || (process.platform !== 'win32' && (stat.mode & 0o077))) throw configError();
  for (const name of ['device.bin', 'connection.json', 'bootstrap.bin']) {
    const file = path.join(directory, name);
    if (!fs.existsSync(file)) continue;
    const entry = fs.lstatSync(file);
    if (!entry.isFile() || entry.isSymbolicLink() || entry.size > MAX_CREDENTIAL_BYTES
        || (process.platform !== 'win32' && !PRIVATE_MODES.includes(entry.mode & 0o777))) throw configError();
  }
  // An old pairing alongside a lost native state file must not bootstrap and upload a seed.
  if (fs.existsSync(path.join(directory, 'device.bin')) && !fs.existsSync(path.join(stateDir, 'company/company-state.json'))) throw configError();
}

async function boundedWorkspaceResponse(response) {
  if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('Cloud workspace response is not JSON.');
  const reader = response.body?.getReader(); if (!reader) throw new Error('Cloud workspace response is empty.');
  const parts = []; let size = 0;
  try {
    for (;;) {
      const item = await reader.read(); if (item.done) break;
      size += item.value.byteLength;
      if (size > 8 * 1024 * 1024 + 65536) { await reader.cancel(); throw new Error('Cloud workspace response exceeds its bound.'); }
      parts.push(item.value);
    }
  } finally { reader.releaseLock(); }
  const bytes = Buffer.concat(parts);
  return { workspace: JSON.parse(bytes.toString('utf8')), bytes };
}

/** File-key encryption, explicitly not an OS keychain or plaintext safeStorage shim. */
export function createEncryptedCloudStorage(keyFile, origin) {
  const encoded = readSecretFile(keyFile);
  if (!/^[a-fA-F0-9]{64}$/.test(encoded)) throw configError();
  const key = Buffer.from(encoded, 'hex');
  const aad = Buffer.from(`daftar/headless/cloud/device/v1:${cloudOrigin(origin)}`);
  let destroyed = false;
  const active = () => { if (destroyed) throw new Error('Cloud credential encryption is closed.'); };
  return {
    isEncryptionAvailable: () => !destroyed,
    getSelectedStorageBackend: () => 'aes-256-gcm-file-key',
    encryptString(plainText) {
      active();
      if (typeof plainText !== 'string' || Buffer.byteLength(plainText) > MAX_CREDENTIAL_BYTES) throw new Error('Cloud credential exceeds its bound.');
      const nonce = crypto.randomBytes(12);
      const cipher = crypto.createCipheriv('aes-256-gcm', key, nonce); cipher.setAAD(aad);
      const ciphertext = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
      return Buffer.concat([MAGIC, nonce, cipher.getAuthTag(), ciphertext]);
    },
    decryptString(bytes) {
      active();
      if (!Buffer.isBuffer(bytes) || bytes.length <= MAGIC.length + 28 || bytes.length > MAX_CREDENTIAL_BYTES + MAGIC.length + 28
          || !bytes.subarray(0, MAGIC.length).equals(MAGIC)) throw new Error('Cloud credential encryption format is invalid.');
      const nonceStart = MAGIC.length; const tagStart = nonceStart + 12; const bodyStart = tagStart + 16;
      try {
        const decipher = crypto.createDecipheriv('aes-256-gcm', key, bytes.subarray(nonceStart, tagStart));
        decipher.setAAD(aad); decipher.setAuthTag(bytes.subarray(tagStart, bodyStart));
        return Buffer.concat([decipher.update(bytes.subarray(bodyStart)), decipher.final()]).toString('utf8');
      } catch { throw new Error('Cloud credential could not be authenticated with this key and origin.'); }
    },
    destroy() { destroyed = true; key.fill(0); },
  };
}

/** Optional supervisor around the existing writer/CAS/native-receipt protocol. */
export class HeadlessCloudSync {
  constructor(options) {
    this.enabled = options.enabled === true;
    this.started = false; this.stopped = false; this.pending = null; this.timer = null;
    this.error = null; this.authenticated = false; this.service = null; this.storage = null; this.requireFirstSnapshotMatch = true;
    this.bootstrapProof = null; this.deviceDigest = null;
    this.abort = new AbortController();
    if (!this.enabled) return;
    if (typeof options.CloudSyncService !== 'function' || typeof options.snapshot !== 'function' || typeof options.command !== 'function' || typeof options.stateHash !== 'function') throw configError();
    this.origin = cloudOrigin(options.url);
    this.intervalSeconds = options.intervalSeconds ?? 60;
    if (!Number.isSafeInteger(this.intervalSeconds) || this.intervalSeconds < 60 || this.intervalSeconds > 3600) throw configError();
    outsideState(options.pairingFile, options.stateDir); outsideState(options.keyFile, options.stateDir);
    if (fs.realpathSync(options.pairingFile) === fs.realpathSync(options.keyFile)) throw configError();
    privateExistingCloudFiles(options.stateDir);
    this.proofFile = path.join(options.stateDir, 'cloud/bootstrap.bin');
    // Validate permissions/readability now; read the credential again only when configuring.
    readSecretFile(options.pairingFile); this.pairingFile = options.pairingFile;
    this.storage = createEncryptedCloudStorage(options.keyFile, this.origin);
    const fetchImpl = options.fetchImpl ?? globalThis.fetch;
    try {
      this.service = new options.CloudSyncService({ userDataPath: options.stateDir, safeStorage: this.storage,
        snapshot: options.snapshot, command: options.command,
        allowKnownSchemaDefaultsMigration: options.allowKnownSchemaDefaults === true,
        getWorkerExecution: options.getWorkerExecution,
        isVerifiedBootstrapBase: ({ revision, snapshotSha256 }) => this.bootstrapProof?.deviceDigest === this.deviceDigest
          && this.bootstrapProof?.revision === revision && this.bootstrapProof?.snapshotHash === snapshotSha256,
        fetch: async (target, init = {}) => {
          if (this.stopped || new URL(target).origin !== this.origin) throw new Error('Cloud transport is closed or origin changed.');
          const signal = init.signal ? AbortSignal.any([init.signal, this.abort.signal]) : this.abort.signal;
          const response = await fetchImpl(target, { ...init, signal, redirect: 'error' });
          if (response.redirected || (response.url && new URL(response.url).origin !== this.origin)) {
            await response.body?.cancel(); throw new Error('Cloud redirects are not allowed.');
          }
          if (response.ok && this.requireFirstSnapshotMatch && init.method === 'GET' && new URL(target).pathname === '/api/workspace') {
            const { workspace, bytes } = await boundedWorkspaceResponse(response);
            if (Number.isSafeInteger(workspace?.revision) && workspace.revision > 0) {
              const local = await options.snapshot();
              const remoteHash = workspace.snapshot ? options.stateHash(workspace.snapshot) : null;
              const priorVerifiedBase = this.bootstrapProof?.deviceDigest === this.deviceDigest
                && this.bootstrapProof?.revision === workspace.revision && this.bootstrapProof?.snapshotHash === remoteHash;
              const knownDefaults = options.allowKnownSchemaDefaults === true && (workspace.clientId ?? workspace.sourceClientId) == null
                && typeof options.knownParentDefaultsMatch === 'function' && local?.ok && local.snapshot && workspace.snapshot
                && options.knownParentDefaultsMatch(workspace.snapshot, local.snapshot);
              if (!local?.ok || !local.snapshot || !remoteHash || (options.stateHash(local.snapshot) !== remoteHash && !priorVerifiedBase && !knownDefaults)) {
                throw new Error('Restore and review a matching workspace before the first runtime sync.');
              }
              // Persist the proven base before a first queued command can commit. A
              // lost ACK/restart must still replay its native receipt against that base.
              if (!priorVerifiedBase && !knownDefaults) this.saveBootstrapProof({ version: 1, deviceDigest: this.deviceDigest, revision: workspace.revision, snapshotHash: remoteHash });
            }
            this.abort.signal.throwIfAborted();
            return new Response(bytes, { status: response.status, headers: { 'content-type': 'application/json' } });
          }
          return response;
        } });
    } catch (error) { this.storage.destroy(); throw error; }
  }

  status() {
    const state = this.service?.status();
    return { configured: this.enabled, connected: !this.stopped && this.authenticated && state?.connected === true,
      revision: Number.isSafeInteger(state?.revision) && state.revision >= 0 ? state.revision : null,
      error: this.error || state?.error ? genericError : null };
  }

  saveBootstrapProof(proof) {
    fs.mkdirSync(path.dirname(this.proofFile), { recursive: true, mode: 0o700 });
    const temporary = `${this.proofFile}.${crypto.randomUUID()}.tmp`;
    let fd;
    try {
      fd = fs.openSync(temporary, 'wx', 0o600); fs.writeFileSync(fd, this.storage.encryptString(JSON.stringify(proof))); fs.fsyncSync(fd); fs.closeSync(fd); fd = undefined;
      fs.renameSync(temporary, this.proofFile); this.bootstrapProof = proof;
    } finally { if (fd !== undefined) fs.closeSync(fd); fs.rmSync(temporary, { force: true }); }
  }

  start() {
    if (!this.enabled || this.started || this.stopped) return;
    this.started = true;
    const tick = async () => {
      await this.syncOnce();
      if (!this.stopped) { this.timer = setTimeout(tick, this.intervalSeconds * 1000); this.timer.unref?.(); }
    };
    void tick();
  }

  syncOnce() {
    if (!this.enabled || this.stopped) return Promise.resolve({ ok: !this.stopped, status: this.status() });
    if (this.pending) return this.pending;
    this.pending = (async () => {
      try {
        if (!this.authenticated) {
          let token = readSecretFile(this.pairingFile);
          // The website can supply an empty optional Sites token outside Sites hosting.
          if (token.startsWith('{')) {
            const pairing = JSON.parse(token);
            if (pairing.siteAccessToken === '') delete pairing.siteAccessToken;
            this.deviceDigest = crypto.createHash('sha256').update(String(pairing.deviceToken)).digest('hex');
            token = JSON.stringify(pairing);
          } else this.deviceDigest = crypto.createHash('sha256').update(token).digest('hex');
          const configured = await this.service.configure({ url: this.origin, token });
          if (!configured.ok || this.stopped) { this.error = genericError; return { ok: false, status: this.status() }; }
          this.authenticated = true;
          this.requireFirstSnapshotMatch = this.service.status().revision === null;
          if (this.requireFirstSnapshotMatch && fs.existsSync(this.proofFile)) {
            try {
              const proof = JSON.parse(this.storage.decryptString(fs.readFileSync(this.proofFile)));
              if (proof?.version === 1 && proof.deviceDigest === this.deviceDigest && Number.isSafeInteger(proof.revision) && proof.revision > 0 && /^[a-f0-9]{64}$/.test(proof.snapshotHash)) this.bootstrapProof = proof;
            } catch { /* No valid proof: matching restored state is required again. */ }
          }
        }
        const result = await this.service.sync();
        this.error = result.ok ? null : genericError;
        if (result.ok) { this.requireFirstSnapshotMatch = false; this.bootstrapProof = null; fs.rmSync(this.proofFile, { force: true }); }
        return { ok: result.ok, status: this.status() };
      } catch {
        this.error = genericError;
        return { ok: false, status: this.status() };
      }
    })().finally(() => { this.pending = null; });
    return this.pending;
  }

  async close() {
    if (this.stopped) { if (this.pending) await this.pending; return; }
    this.stopped = true; if (this.timer) clearTimeout(this.timer);
    this.abort.abort();
    this.service?.close?.();
    if (this.pending) await this.pending;
    this.storage?.destroy();
  }
}
