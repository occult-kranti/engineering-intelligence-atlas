'use strict';
const MAX_RESPONSE = 8 * 1024 * 1024 + 65536;
const MAX_MESSAGE = 12000;
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
function validateConnection(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || !['desktop','cloud'].includes(value.kind)) throw new Error('Pair this editor to a desktop or website connection.');
  const url=origin(value.url,value.kind==='desktop');
  if(value.url!==url)throw new Error('Stored workspace connection is invalid. Pair it again.');
  if(value.kind==='desktop') {
    if(typeof value.cookie!=='string'||!/^atlas_session=[a-f0-9]{64}$/.test(value.cookie))throw new Error('Stored desktop session is invalid. Pair it again.');
    return {kind:'desktop',url,cookie:value.cookie};
  }
  const parsed=pairing(JSON.stringify({deviceToken:value.deviceToken,siteAccessToken:value.siteAccessToken}));
  return {kind:'cloud',url,...parsed};
}
class AtlasClient {
  constructor(connection, fetcher = fetch) { this.connection = validateConnection(connection); this.fetcher = fetcher; this.revision=null; }
  async request(route, method = 'GET', body) {
    const c = this.connection;
    if (!c) throw new Error('Connect this editor to your desktop or signed-in website first.');
    const headers = { Accept: 'application/json' };
    if (c.kind === 'desktop') { headers.Origin = c.url; headers.Cookie = c.cookie; }
    else { headers.Authorization = `Bearer ${c.deviceToken}`; if (c.siteAccessToken) headers['OAI-Sites-Authorization'] = `Bearer ${c.siteAccessToken}`; }
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    // A deliberately submitted cloud chat can outlast ordinary snapshot reads.
    // Leave room for the server's bounded 180-second provider request and its
    // durable accounting write; an ambiguous result is still never retried.
    const timeoutMs = c.kind === 'cloud' && route === '/api/chat' && method === 'POST' ? 210000 : 45000;
    let response;
    try { response = await this.fetcher(c.url + route, { method, headers, ...(body !== undefined ? { body: JSON.stringify(body) } : {}), redirect: 'error', signal: AbortSignal.timeout(timeoutMs) }); }
    catch { throw new Error('Workspace unavailable. Keep the desktop open or check the website connection. Your saved work is preserved.'); }
    if ([401,403].includes(response.status)) throw new Error('This editor connection expired or was revoked. Pair it again.');
    if (response.status === 409) throw new Error('The request conflicts with newer workspace state. Refresh before retrying.');
    if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('The site returned its sign-in page. Use the complete device pairing JSON.');
    const declared=Number(response.headers.get('content-length'));
    if(Number.isFinite(declared)&&declared>MAX_RESPONSE){try{await response.body?.cancel();}catch{}throw new Error('Workspace response exceeds its limit.');}
    const reader = response.body?.getReader();
    if (!reader) throw new Error('Workspace response was empty.');
    const chunks = []; let size = 0;
    try {
      for (;;) { const {done,value}=await reader.read(); if(done)break; size+=value.length; if(size>MAX_RESPONSE){try{await reader.cancel();}catch{}throw new Error('Workspace response exceeds its limit.');} chunks.push(value); }
    } catch(error) {
      if(error?.message==='Workspace response exceeds its limit.')throw error;
      throw new Error('Workspace response was interrupted. The action may already be saved; refresh before retrying.');
    } finally { reader.releaseLock(); }
    let data;try{data=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw new Error('Workspace returned invalid data.');}
    if(!data||typeof data!=='object'||Array.isArray(data))throw new Error('Workspace returned invalid data.');
    if(!response.ok)throw new Error(typeof data.error==='string'?data.error.slice(0,500):`Workspace request failed (${response.status}). Refresh before retrying a paid request.`);
    if(data.ok===false || data.error && !data.snapshot)throw new Error(String(data.error || 'Workspace operation rejected.').slice(0,500));
    return data;
  }
  async call(method, args = []) { const data = await this.request('/api/call','POST',{method,args}); return data.result; }
  async snapshot() {
    if (this.connection.kind === 'cloud') {
      const result=await this.request('/api/workspace');
      if(!Number.isSafeInteger(result.revision)||result.revision<0)throw new Error('Cloud workspace revision is invalid.');
      this.revision=result.revision;
      return result;
    }
    const data = await this.call('officeSnapshot');
    if (!data?.ok || !data.snapshot) throw new Error(data?.error || 'The desktop office could not be read.');
    return { snapshot: data.snapshot, revision: null, updatedAt: null };
  }
  async command(command) {
    if (!command || typeof command.action !== 'string') throw new Error('Invalid office command.');
    if (this.connection.kind === 'cloud') {
      const {action,...payload}=command;
      if(this.revision===null)await this.snapshot();
      const result=await this.request('/api/commands','POST',{expectedRevision:this.revision,command:{action,payload}});
      return {...result,queued:true};
    }
    const result=await this.call('officeCommand',[command]);
    if(!result?.ok)throw new Error(result?.error || 'Desktop command was rejected.');
    return result;
  }
  async chat(companyId, content, requestId) {
    if(typeof content!=='string'||!content.trim()||Buffer.byteLength(content)>MAX_MESSAGE)throw new Error('Write a brief of at most 12 KB.');
    if(this.connection.kind==='cloud')return this.request('/api/chat','POST',{companyId,content,requestId});
    await this.command({action:'post_chat',scope:{kind:'company',id:companyId},content});
    return {saved:true,reply:null};
  }
  async chatHistory(companyId) {
    if(this.connection.kind==='cloud')return this.request(`/api/chat?scopeKind=company&scopeId=${encodeURIComponent(companyId)}`);
    return {messages:[]};
  }
  static async connectDesktop(raw, fetcher = fetch) {
    const url = new URL(raw); const base = origin(raw,true);
    const token = new URLSearchParams(url.hash.slice(1)).get('session');
    if(!token || !/^[a-f0-9]{64}$/.test(token))throw new Error('Use the fresh link copied by Pair VS Code in desktop Settings.');
    let response;
    try { response=await fetcher(base+'/api/session',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({token}),redirect:'error',signal:AbortSignal.timeout(15000)}); }
    catch { throw new Error('The desktop is unreachable. Keep it open on this computer and copy a new pairing link.'); }
    if(!response.ok)throw new Error('The pairing link expired or was used. Copy a new link from desktop Settings.');
    const cookie=response.headers.get('set-cookie')?.match(/(?:^|,\s*)atlas_session=([a-f0-9]{64})/)?.[1];
    if(!cookie)throw new Error('The desktop did not issue a valid editor session.');
    return {kind:'desktop',url:base,cookie:`atlas_session=${cookie}`};
  }
  static async connectCloud(base, raw, fetcher = fetch) {
    const url=origin(base); const parsed=pairing(raw);
    if(parsed.baseUrl && parsed.baseUrl!==url)throw new Error('The pairing credential belongs to a different website.');
    const connection={kind:'cloud',url,...parsed}; delete connection.baseUrl;
    const session=await new AtlasClient(connection,fetcher).request('/api/session');
    if(session.signedIn!==true)throw new Error('Sign in on the website and create a device pairing credential.');
    return connection;
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
module.exports={AtlasClient,origin,pairing,studioUrl,validateConnection};
