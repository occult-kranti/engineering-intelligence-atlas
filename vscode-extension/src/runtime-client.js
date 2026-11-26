'use strict';
const crypto = require('node:crypto');
const { origin } = require('./client');
const scoped = require('./development-client');

const MAX_RESPONSE = 9 * 1024 * 1024;
const MAX_REQUEST = 256 * 1024;
const TOKEN = /^[A-Za-z0-9_-]{32,256}$/;
const HASH = /^[a-f0-9]{64}$/;
const ID = /^[A-Za-z0-9_-]{1,100}$/;
const ROUTES = new Set(['GET /v1/office', 'GET /v1/status', 'GET /v1/workbench', 'POST /v1/workbench/call',
  'POST /v1/models/pull','POST /v1/models/select','POST /v1/models/cancel',
  'POST /v1/creative/assign','POST /v1/creative/run','POST /v1/creative/cancel']);
function allowedRoute(route, method) {
  if (typeof route !== 'string' || route.length > 2048) return false;
  if (ROUTES.has(`${method} ${route}`)) return true;
  if (method !== 'GET' || !route.startsWith('/v1/')) return false;
  const url=new URL(route,'https://runtime.invalid');
  const fields=url.pathname==='/v1/models'?['companyId','employeeId']
    :url.pathname==='/v1/creative'?['companyId']:url.pathname==='/v1/creative/jobs'?['companyId','jobId']:null;
  if(!fields || url.hash || !url.searchParams.has('companyId') || url.pathname.endsWith('/jobs')&&!url.searchParams.has('jobId'))return false;
  const seen=new Set();
  for(const [key,value] of url.searchParams){if(!fields.includes(key)||seen.has(key)||!/^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/.test(value))return false;seen.add(key);}
  return true;
}
function cancelBody(body) { try { Promise.resolve(body?.cancel?.()).catch(() => {}); } catch {} }
function abortable(promise, signal) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (callback, value) => { if (settled) return; settled = true; signal.removeEventListener('abort', onAbort); callback(value); };
    const onAbort = () => finish(reject, new Error('The runtime request was cancelled.'));
    signal.addEventListener('abort', onAbort, { once: true });
    Promise.resolve(promise).then(value => finish(resolve, value), error => finish(reject, error));
    if (signal.aborted) onAbort();
  });
}
function fetchBounded(fetcher, url, init, signal) {
  const pending = Promise.resolve().then(() => { if (signal.aborted) throw new Error('Cancelled before dispatch.'); return fetcher(url, { ...init, signal }); });
  // A transport that resolves after cancellation must not keep an unread body.
  void pending.then(response => { if (signal.aborted) cancelBody(response?.body); }, () => {});
  return abortable(pending, signal);
}
function removeControlCredential(value, token, key = '', depth = 0) {
  const collision = () => { throw Object.assign(new Error('The runtime response contains credential material in an identity field. Inspect its receipt locally; no identity was changed.'), { code: 'RESPONSE_CREDENTIAL_COLLISION' }); };
  if (depth > 64) throw new Error('Runtime response nesting exceeds its limit.');
  if (typeof value === 'string') {
    if (!value.includes(token)) return value;
    // Never silently rewrite canonical receipt, entity, digest or dependency IDs.
    if (/(?:^id$|^ids$|Id$|Ids$|_id$|_ids$|Hash$|Digest$|^digest$|^sha256$|^idempotencyKey$|^dependsOn$)/.test(key)) collision();
    return value.split(token).join('[control credential omitted]');
  }
  if (Array.isArray(value)) return value.map(item => removeControlCredential(item, token, key, depth + 1));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([name, item]) => {
    if (name.includes(token)) collision();
    return [name, removeControlCredential(item, token, name, depth + 1)];
  }));
  return value;
}

class RuntimeClient {
  constructor(connection, fetcher = fetch) {
    if (!connection || connection.kind !== 'runtime' || !TOKEN.test(connection.controlToken || '')) {
      throw new Error('Use the private Daftar runtime control credential.');
    }
    this.connection = { kind: 'runtime', url: origin(connection.url), controlToken: connection.controlToken };
    this.fetcher = fetcher;
    this.stateHash = null;
    this.controllers = new Set();
    this.closed = false;
  }

  async request(route, method = 'GET', body, { signal, id, timeoutMs = 45000 } = {}) {
    if (this.closed) throw new Error('This runtime connection is closed.');
    if (!allowedRoute(route, method)) throw new Error('Unsupported runtime endpoint.');
    if (this.controllers.size >= 32) throw new Error('The runtime request limit is busy. Wait for current work.');
    if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 180000) throw new Error('Invalid runtime request deadline.');
    const encoded = body === undefined ? undefined : JSON.stringify(body);
    if (encoded && Buffer.byteLength(encoded) > MAX_REQUEST) throw new Error('Runtime request exceeds 256 KiB.');
    const abort = new AbortController();
    const parentAbort = () => abort.abort();
    if (signal?.aborted) throw new Error('The runtime request was cancelled.');
    signal?.addEventListener('abort', parentAbort, { once: true });
    const timer = setTimeout(() => abort.abort(), timeoutMs);
    this.controllers.add(abort);
    const token = this.connection.controlToken, targetOrigin = this.connection.url;
    let reader, response;
    let received = false;
    try {
      response = await fetchBounded(this.fetcher, targetOrigin + route, {
        method, redirect: 'error',
        headers: { Accept: 'application/json', Authorization: `Bearer ${token}`,
          ...(encoded ? { 'Content-Type': 'application/json' } : {}) },
        ...(encoded ? { body: encoded } : {}),
      }, abort.signal);
      if (response.redirected || (response.url && new URL(response.url).origin !== targetOrigin)) {
        cancelBody(response.body);
        throw new Error('The runtime returned an unexpected redirect.');
      }
      if (!response.headers.get('content-type')?.includes('application/json')) {
        cancelBody(response.body);
        throw new Error('The runtime did not return JSON. Check its address and version.');
      }
      reader = response.body?.getReader();
      if (!reader) throw new Error('The runtime returned an empty response.');
      const chunks = []; let bytes = 0;
      for (;;) {
        const next = await abortable(reader.read(), abort.signal);
        if (next.done) break;
        if (!(next.value instanceof Uint8Array)) throw new Error('The runtime returned invalid response bytes.');
        bytes += next.value.byteLength;
        if (bytes > MAX_RESPONSE) { cancelBody(reader); throw new Error('Runtime response exceeds its limit.'); }
        chunks.push(next.value);
      }
      let value;
      try { value = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
      catch { throw new Error('The runtime returned malformed JSON.'); }
      received = true;
      if (!response.ok || value?.ok === false) {
        const code = typeof value?.code === 'string' && /^[A-Z_]{1,80}$/.test(value.code) && !value.code.includes(token) ? value.code : `HTTP_${response.status}`;
        const error = new Error(response.status === 401 || response.status === 403
          ? `Runtime authorization was refused (${code}). Check the credential and active grants.`
          : response.status === 409 ? `Runtime state changed (${code}). Refresh and review before another operation.`
            : `Runtime operation failed (${code}). Inspect saved state before retrying.`);
        error.code = code;
        throw error;
      }
      if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('The runtime returned an invalid response.');
      if (this.closed || abort.signal.aborted) throw new Error('The runtime connection changed before the response completed.');
      return removeControlCredential(value, token);
    } catch (error) {
      // A cancelled or lost POST may already have committed. Never replay it.
      if (method === 'POST' && !received) {
        const publicId = typeof id === 'string' && !id.includes(token) ? id : undefined;
        const failure = new Error(`Runtime response was not confirmed. Operation ${publicId || 'unknown'} may have committed; inspect its receipt before repeating it. No retry was sent.`);
        failure.code = 'OUTCOME_UNKNOWN'; failure.operationId = publicId;
        throw failure;
      }
      if (received && typeof error?.code === 'string' && /^[A-Z0-9_]{1,80}$/.test(error.code)
          && !error.code.includes(token) && !String(error.message).includes(token)) throw error;
      throw new Error('The Daftar runtime is unavailable or its response could not be verified. Check the instance and connection.');
    } finally {
      abort.abort();
      cancelBody(reader ?? response?.body);
      try { reader?.releaseLock(); } catch {}
      clearTimeout(timer);
      signal?.removeEventListener('abort', parentAbort);
      this.controllers.delete(abort);
    }
  }

  async snapshot(context = {}) {
    const data = await this.request('/v1/office', 'GET', undefined, context);
    if (!data.ok || !data.snapshot || !Array.isArray(data.snapshot.companies) || !HASH.test(data.stateHash || '')) {
      throw new Error('The runtime returned an invalid office snapshot.');
    }
    this.stateHash = data.stateHash;
    return { snapshot: data.snapshot, stateHash: data.stateHash, revision: data.stateHash, updatedAt: null };
  }

  async capabilities(context = {}) {
    const data = await this.request('/v1/workbench', 'GET', undefined, context);
    if (!data.ok || !data.workbench || typeof data.workbench.methods !== 'object') {
      throw new Error('This runtime needs the VS Code workbench backend update.');
    }
    return data.workbench;
  }

  async call(method, args = [], context = {}) {
    if (!/^[A-Za-z][A-Za-z0-9]{1,70}$/.test(method) || !Array.isArray(args) || args.length > 8) {
      throw new Error('Invalid workbench operation.');
    }
    const id = context.id || crypto.randomUUID();
    if (typeof id !== 'string' || !ID.test(id) || this.connection.controlToken && id.includes(this.connection.controlToken)) throw new Error('Invalid workbench operation identity.');
    let wireArgs = args;
    if (method === 'officeSnapshot') {
      const value = await this.snapshot(context);
      return { ok: true, snapshot: value.snapshot, stateHash: value.stateHash };
    }
    if (method === 'officeCommand') {
      if (args.length !== 1 || !args[0] || typeof args[0].action !== 'string') throw new Error('An office command is required.');
      if (!this.stateHash) await this.snapshot(context);
      wireArgs = [{ expectedStateHash: this.stateHash, command: args[0] }];
    }
    const value = await this.request('/v1/workbench/call', 'POST', { id, method, args: wireArgs },
      { ...context, id, timeoutMs: method === 'createVenv' ? 150000 : 45000 });
    if (value.id !== id || !Object.hasOwn(value, 'result')) throw new Error('The runtime returned a different operation receipt. Inspect saved state.');
    if (HASH.test(value.result?.stateHash || '')) this.stateHash = value.result.stateHash;
    return value.result;
  }

  async command(command, context = {}) {
    const result=await this.call('officeCommand', [command], context);
    if(result?.ok!==true)throw new Error('The native office command was rejected. Inspect its saved state and original request before another submission.');
    return result;
  }
  async chat(companyId, content, requestId) {
    if (typeof content !== 'string' || !content.trim() || Buffer.byteLength(content) > 12000) throw new Error('Write a brief of at most 12 KB.');
    await this.command({ action: 'post_chat', scope: { kind: 'company', id: companyId }, content }, { id: requestId });
    return { saved: true, reply: null };
  }
  async chatHistory(companyId) {
    const { snapshot } = await this.snapshot();
    return { messages: (snapshot.chatThreads || []).find(thread => thread.scope?.kind === 'company' && thread.scope?.id === companyId)?.messages || [] };
  }
  creative(operation, input, context = {}) { return scoped.creative(this, operation, input, context); }
  models(operation, input, context = {}) { return scoped.models(this, operation, input, context); }
  workerStatus(context = {}) { return scoped.workerStatus(this, context); }
  development(companyId, context = {}) { return scoped.development(this, companyId, context); }
  close() {
    this.closed = true;
    for (const abort of this.controllers) abort.abort();
    this.controllers.clear();
    this.connection.controlToken = '';
    this.stateHash = null;
  }
}

module.exports = { RuntimeClient, MAX_REQUEST, MAX_RESPONSE };
