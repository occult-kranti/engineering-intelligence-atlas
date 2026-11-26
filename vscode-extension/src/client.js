'use strict';
const scoped = require('./development-client');
const MAX_RESPONSE = 8 * 1024 * 1024 + 65536;
const MAX_MESSAGE = 12000;
const MAX_REQUEST = 256 * 1024;
const clientError = (message, code = 'WORKSPACE_ERROR') => Object.assign(new Error(message), { code });
function cancelBody(body) { try { Promise.resolve(body?.cancel?.()).catch(() => {}); } catch {} }
function abortable(promise, signal) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (callback, value) => { if (settled) return; settled = true; signal.removeEventListener('abort', abort); callback(value); };
    const abort = () => finish(reject, clientError('Workspace request was cancelled.', 'WORKSPACE_ABORTED'));
    signal.addEventListener('abort', abort, { once: true });
    Promise.resolve(promise).then(value => finish(resolve, value), error => finish(reject, error));
    if (signal.aborted) abort();
  });
}
function requestScope(signal, timeoutMs) {
  const controller = new AbortController();
  // Node's deadline signal owns an unreferenced timer. Drop every listener and
  // reference when this request settles; owner close also aborts immediately.
  const deadline = AbortSignal.timeout(timeoutMs);
  const abort = () => controller.abort();
  deadline.addEventListener('abort', abort, { once: true }); signal?.addEventListener('abort', abort, { once: true });
  if (signal?.aborted) abort();
  return { controller, release() { deadline.removeEventListener('abort', abort); signal?.removeEventListener('abort', abort); } };
}
async function fetchBounded(fetcher, url, init, signal) {
  const pending = Promise.resolve().then(() => { if (signal.aborted) throw new Error(); return fetcher(url, { ...init, signal }); });
  // A cancelled adapter can still resolve later. Do not retain its response.
  void pending.then(response => { if (signal.aborted) cancelBody(response?.body); }, () => {});
  return abortable(pending, signal);
}
async function readBounded(response, signal, limit = MAX_RESPONSE) {
  const declared=Number(response.headers.get('content-length'));
  if(Number.isFinite(declared)&&declared>limit)throw clientError('Workspace response exceeds its limit.');
  const reader = response.body?.getReader(); if (!reader) throw clientError('Workspace response was empty.');
  try {
    const chunks = []; let size = 0;
    for (;;) {
      const { done, value } = await abortable(reader.read(), signal); if (done) break;
      if (!(value instanceof Uint8Array)) throw clientError('Workspace returned invalid data.');
      size += value.byteLength; if (size > limit) throw clientError('Workspace response exceeds its limit.');
      chunks.push(Buffer.from(value));
    }
    try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
    catch { throw clientError('Workspace returned invalid data.'); }
  } finally { cancelBody(reader); try { reader.releaseLock(); } catch {} }
}
function allowedRoute(kind, route, method) {
  if (typeof route !== 'string' || route.length > 2048 || !['GET', 'POST'].includes(method)) return false;
  if (kind === 'desktop') return method === 'POST' && route === '/api/call';
  if (method === 'GET' && ['/api/session', '/api/workspace'].includes(route)) return true;
  if (method === 'POST' && ['/api/commands', '/api/chat'].includes(route)) return true;
  if (method !== 'GET' || !route.startsWith('/api/chat?')) return false;
  const url = new URL(route, 'https://workspace.invalid');
  return url.pathname === '/api/chat' && [...url.searchParams].length === 2 && url.searchParams.get('scopeKind') === 'company'
    && url.searchParams.get('scopeId')?.length > 0 && url.searchParams.get('scopeId').length <= 200
    && !url.hash && [...url.searchParams.keys()].every(key => ['scopeKind', 'scopeId'].includes(key));
}
function origin(raw, localOnly = false) {
  if (typeof raw !== 'string' || raw.length > 2048) throw new Error('Enter a valid workspace URL.');
  const url = new URL(raw);
  const local = ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname);
  if (url.username || url.password || url.search || !localOnly && url.hash || (localOnly ? url.protocol !== 'http:' || !local : url.protocol !== 'https:' && !(local && url.protocol === 'http:'))) throw new Error('Use HTTPS for cloud or HTTP loopback for the installed desktop.');
  if (!['', '/'].includes(url.pathname)) throw new Error('Use the workspace origin without a path.');
  return url.origin;
}
function pairing(raw) {
  let result;
  try { result = JSON.parse(raw); } catch { throw new Error('Paste the device pairing JSON from your signed-in website.'); }
  if (!result || typeof result !== 'object' || Array.isArray(result)) throw new Error('Invalid device pairing JSON.');
  const valid = (s, max) => typeof s === 'string' && s.length >= 20 && s.length <= max && !/[\s\0]/.test(s);
  if (!valid(result.deviceToken, 2048) || result.siteAccessToken !== undefined && !valid(result.siteAccessToken, 12000)) throw new Error('Invalid device pairing credential.');
  return { deviceToken: result.deviceToken, ...(result.siteAccessToken ? { siteAccessToken: result.siteAccessToken } : {}), ...(result.baseUrl ? { baseUrl: origin(result.baseUrl) } : {}) };
}
class AtlasClient {
  constructor(connection, fetcher = fetch) {
    // Keep the older client API while using the released native runtime transport.
    if (connection?.kind === 'runtime') return new (require('./runtime-client').RuntimeClient)(connection, fetcher);
    if (!connection || !['desktop', 'cloud'].includes(connection.kind)) throw clientError('Connect this editor to your desktop or signed-in website first.');
    const url = origin(connection.url, connection.kind === 'desktop');
    if (connection.kind === 'desktop') {
      if (!/^atlas_session=[a-f0-9]{64}$/.test(connection.cookie ?? '')) throw clientError('Pair this editor with a valid desktop session.');
      this.connection = { kind: 'desktop', url, cookie: connection.cookie };
    } else this.connection = { kind: 'cloud', url, ...pairing(JSON.stringify(connection)) };
    delete this.connection.baseUrl;
    this.fetcher = fetcher; this.revision = null; this.closed = false; this.controllers = new Set();
  }
  assertOpen() { if (this.closed) throw clientError('This workspace connection is closed.', 'WORKSPACE_CLOSED'); }
  async request(route, method = 'GET', body, context = {}) {
    this.assertOpen();
    const c = this.connection;
    if (!allowedRoute(c.kind, route, method)) throw clientError('Unsupported workspace endpoint.');
    if (this.controllers.size >= 32) throw clientError('Workspace request capacity is busy. Wait for current work.');
    if (context.signal?.aborted) throw clientError('Workspace request was cancelled.', 'WORKSPACE_ABORTED');
    const encoded = body === undefined ? undefined : JSON.stringify(body);
    if (encoded && Buffer.byteLength(encoded) > MAX_REQUEST) throw clientError('Workspace request exceeds 256 KiB.');
    const headers = { Accept: 'application/json' };
    if (c.kind === 'desktop') { headers.Origin = c.url; headers.Cookie = c.cookie; }
    else { headers.Authorization = `Bearer ${c.deviceToken}`; if (c.siteAccessToken) headers['OAI-Sites-Authorization'] = `Bearer ${c.siteAccessToken}`; }
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    // A deliberately submitted cloud chat can outlast ordinary snapshot reads.
    // Leave room for the server's bounded 180-second provider request and its
    // durable accounting write; an ambiguous result is still never retried.
    const timeoutMs = c.kind === 'cloud' && route === '/api/chat' && method === 'POST' ? 210000 : 45000;
    const scope = requestScope(context.signal, timeoutMs); this.controllers.add(scope.controller);
    let response, received = false;
    try {
      response = await fetchBounded(this.fetcher, c.url + route, { method, headers,
        ...(encoded === undefined ? {} : { body: encoded }), redirect: 'error' }, scope.controller.signal);
      if (response.redirected || response.url && new URL(response.url).origin !== c.url) throw clientError('Workspace returned an unexpected redirect.');
      if ([401,403].includes(response.status)) { received = true; throw clientError('This editor connection expired or was revoked. Pair it again.', 'WORKSPACE_UNAUTHORIZED'); }
      if (response.status === 409) { received = true; throw clientError('The request conflicts with newer workspace state. Refresh before retrying.', 'WORKSPACE_CONFLICT'); }
      if (!response.ok) { received = true; throw clientError(`Workspace request failed (${Number.isInteger(response.status) ? response.status : 'unknown'}). Inspect its saved state before retrying.`); }
      if (!response.headers.get('content-type')?.includes('application/json')) throw clientError('The site returned its sign-in page. Use the complete device pairing JSON.');
      const data = await readBounded(response, scope.controller.signal);
      received = true;
      if (!data || typeof data !== 'object' || Array.isArray(data)) throw clientError('Workspace returned invalid data.');
      if (data.ok === false || data.error && !data.snapshot) throw clientError('Workspace operation was rejected. Inspect saved state before a new request.');
      this.assertOpen(); if (scope.controller.signal.aborted) throw clientError('Workspace request was cancelled.', 'WORKSPACE_ABORTED');
      return data;
    } catch (error) {
      if (method === 'POST' && !received) throw clientError('Workspace unavailable or its response was not confirmed. This request may already have been saved; inspect its original receipt before repeating it. No retry was sent.', 'OUTCOME_UNKNOWN');
      if (typeof error?.code === 'string' && error.code.startsWith('WORKSPACE_')) throw error;
      throw clientError('Workspace unavailable. Keep the desktop open or check the website connection. Your saved work is preserved.');
    } finally { cancelBody(response?.body); scope.release(); this.controllers.delete(scope.controller); }
  }
  async call(method, args = [], context = {}) {
    if (!/^[A-Za-z][A-Za-z0-9]{1,70}$/.test(method) || !Array.isArray(args) || args.length > 8) throw clientError('Invalid desktop workbench operation.');
    const data = await this.request('/api/call','POST',{method,args}, context); return data.result;
  }
  async snapshot(context = {}) {
    this.assertOpen();
    if (this.connection.kind === 'cloud') {
      const result=await this.request('/api/workspace', 'GET', undefined, context);
      if(!Number.isSafeInteger(result.revision)||result.revision<0)throw new Error('Cloud workspace revision is invalid.');
      this.revision=result.revision;
      return result;
    }
    const data = await this.call('officeSnapshot', [], context);
    if (!data?.ok || !data.snapshot) throw clientError('The desktop office could not be read.');
    return { snapshot: data.snapshot, revision: null, updatedAt: null };
  }
  async command(command, context = {}) {
    this.assertOpen();
    if (!command || typeof command.action !== 'string') throw new Error('Invalid office command.');
    if (this.connection.kind === 'cloud') {
      const {action,...payload}=command;
      if(this.revision===null)await this.snapshot(context);
      const result=await this.request('/api/commands','POST',{expectedRevision:this.revision,command:{action,payload}}, context);
      return {...result,queued:true};
    }
    const result=await this.call('officeCommand',[command], context);
    if(!result?.ok)throw clientError('Desktop command was rejected. Inspect saved state.');
    return result;
  }
  async chat(companyId, content, requestId, context = {}) {
    this.assertOpen();
    if(typeof content!=='string'||!content.trim()||Buffer.byteLength(content)>MAX_MESSAGE)throw new Error('Write a brief of at most 12 KB.');
    if(this.connection.kind==='cloud')return this.request('/api/chat','POST',{companyId,content,requestId}, context);
    await this.command({action:'post_chat',scope:{kind:'company',id:companyId},content}, context);
    return {saved:true,reply:null};
  }
  async chatHistory(companyId, context = {}) {
    this.assertOpen();
    if(typeof companyId !== 'string' || !companyId || companyId.length > 200) throw clientError('Choose a company first.');
    if(this.connection.kind==='cloud')return this.request(`/api/chat?scopeKind=company&scopeId=${encodeURIComponent(companyId)}`, 'GET', undefined, context);
    return {messages:[]};
  }
  creative(operation, input, context = {}) { return scoped.creative(this, operation, input, context); }
  models(operation, input, context = {}) { return scoped.models(this, operation, input, context); }
  workerStatus(context = {}) { return scoped.workerStatus(this, context); }
  development(companyId, context = {}) { return scoped.development(this, companyId, context); }
  close() {
    this.closed = true; for (const controller of this.controllers) controller.abort(); this.controllers.clear();
    this.connection = null; this.revision = null;
  }
  static async connectRuntime(base, controlToken, fetcher = fetch, context = {}) {
    const url=origin(base);
    if(base.replace(/\/$/,'')!==url)throw new Error('Use the canonical runtime origin without aliases or path components.');
    const client=new (require('./runtime-client').RuntimeClient)({kind:'runtime',url,controlToken},fetcher);
    try {
      const result=await client.request('/v1/status','GET',undefined,context);
      if(result.ok!==true||result.execution!=='headless')throw new Error('This endpoint is not a Daftar headless runtime.');
      await client.snapshot(context);
      return {kind:'runtime',url,controlToken};
    } finally { client.close(); }
  }
  static async connectDesktop(raw, fetcher = fetch, context = {}) {
    const url = new URL(raw); const base = origin(raw,true);
    const token = new URLSearchParams(url.hash.slice(1)).get('session');
    if(!token || !/^[a-f0-9]{64}$/.test(token))throw new Error('Use the fresh link copied by Pair VS Code in desktop Settings.');
    const scope = requestScope(context.signal, 15000); let response;
    try {
      response = await fetchBounded(fetcher, base+'/api/session', {method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({token}),redirect:'error'}, scope.controller.signal);
      if(response.redirected || response.url && new URL(response.url).origin !== base) throw clientError('Desktop pairing returned an unexpected redirect.');
      if(!response.ok)throw clientError('The pairing link expired or was used. Copy a new link from desktop Settings.');
      const cookie=response.headers.get('set-cookie')?.match(/(?:^|,\s*)atlas_session=([a-f0-9]{64})(?:;|$)/)?.[1];
      if(!cookie)throw clientError('The desktop did not issue a valid editor session.');
      return {kind:'desktop',url:base,cookie:`atlas_session=${cookie}`};
    } catch (error) {
      if(typeof error?.code === 'string' && error.code.startsWith('WORKSPACE_')) throw error;
      throw clientError('The desktop is unreachable. Keep it open on this computer and copy a new pairing link.');
    } finally { cancelBody(response?.body); scope.release(); }
  }
  static async connectCloud(base, raw, fetcher = fetch, context = {}) {
    const url=origin(base); const parsed=pairing(raw);
    if(parsed.baseUrl && parsed.baseUrl!==url)throw new Error('The pairing credential belongs to a different website.');
    const connection={kind:'cloud',url,...parsed}; delete connection.baseUrl;
    const client = new AtlasClient(connection, fetcher);
    try {
      const session=await client.request('/api/session', 'GET', undefined, context);
      if(session.signedIn!==true)throw new Error('Sign in on the website and create a device pairing credential.');
      return connection;
    } finally { client.close(); }
  }
}
function studioUrl(base, companyId, view) {
  if (!['blueprint','softboard','timeline','whiteboard'].includes(view)) throw new Error('Choose a supported studio view.');
  if (typeof companyId !== 'string' || !companyId || companyId.length > 200) throw new Error('Choose a company before opening the studio.');
  const url = new URL('/workspace/chrome.html', origin(base));
  url.searchParams.set('company', companyId);
  url.searchParams.set('workspace', view);
  url.hash = 'office';
  return url.href;
}
module.exports={AtlasClient,origin,pairing,studioUrl,MAX_REQUEST,MAX_RESPONSE};
