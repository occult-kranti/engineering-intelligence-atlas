'use strict';
const crypto = require('node:crypto');
const {validateCreativeRequest,creativeSnapshot,creativeJob} = require('./creative');
const MAX_RESPONSE = 8 * 1024 * 1024 + 65536;
const MAX_MESSAGE = 12000;
function origin(raw, localOnly = false) {
  if (typeof raw !== 'string' || raw.length > 2048) throw new Error('Enter a valid workspace URL.');
  const url = new URL(raw);
  const local = ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname);
  if (url.username || url.password || url.search || !localOnly && url.hash || (localOnly ? url.protocol !== 'http:' || !local : url.protocol !== 'https:' && !(local && url.protocol === 'http:'))) throw new Error('Use HTTPS or HTTP loopback for the connected workspace.');
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
  if (!value || typeof value !== 'object' || Array.isArray(value) || !['desktop','cloud','runtime'].includes(value.kind)) throw new Error('Connect this editor to a desktop, website or headless runtime.');
  const url=origin(value.url,value.kind==='desktop');
  if(value.url!==url)throw new Error('Stored workspace connection is invalid. Pair it again.');
  if(value.kind==='desktop') {
    if(typeof value.cookie!=='string'||!/^atlas_session=[a-f0-9]{64}$/.test(value.cookie))throw new Error('Stored desktop session is invalid. Pair it again.');
    return {kind:'desktop',url,cookie:value.cookie};
  }
  if(value.kind==='runtime') {
    if(typeof value.controlToken!=='string'||! /^[A-Za-z0-9_-]{32,256}$/.test(value.controlToken))throw new Error('Stored runtime credential is invalid. Connect it again.');
    return {kind:'runtime',url,controlToken:value.controlToken};
  }
  const parsed=pairing(JSON.stringify({deviceToken:value.deviceToken,siteAccessToken:value.siteAccessToken}));
  return {kind:'cloud',url,...parsed};
}
class AtlasClient {
  constructor(connection, fetcher = fetch) { this.connection = validateConnection(connection); this.fetcher = fetcher; this.revision=null;this.stateHash=null; }
  async request(route, method = 'GET', body) {
    const c = this.connection;
    if (!c) throw new Error('Connect this editor to your desktop or signed-in website first.');
    const headers = { Accept: 'application/json' };
    if (c.kind === 'desktop') { headers.Origin = c.url; headers.Cookie = c.cookie; }
    else { headers.Authorization = `Bearer ${c.kind==='runtime'?c.controlToken:c.deviceToken}`; if (c.siteAccessToken) headers['OAI-Sites-Authorization'] = `Bearer ${c.siteAccessToken}`; }
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    // A deliberately submitted cloud chat can outlast ordinary snapshot reads.
    // Leave room for the server's bounded 180-second provider request and its
    // durable accounting write; an ambiguous result is still never retried.
    const timeoutMs = c.kind === 'cloud' && route === '/api/chat' && method === 'POST' ? 210000 : 45000;
    let response;
    try { response = await this.fetcher(c.url + route, { method, headers, ...(body !== undefined ? { body: JSON.stringify(body) } : {}), redirect: 'error', signal: AbortSignal.timeout(timeoutMs) }); }
    catch { throw new Error('Workspace unavailable. Check the connected desktop, website or runtime. The action may already be saved; refresh before retrying.'); }
    if (response.status === 401 || response.status===403&&c.kind!=='runtime') throw new Error('This editor connection expired or was revoked. Pair it again.');
    if (response.status === 409) throw new Error('The request conflicts with newer workspace state. Refresh before retrying.');
    if (!response.headers.get('content-type')?.includes('application/json')) throw new Error(c.kind==='runtime'?'Runtime did not return JSON. Verify its configured origin.':'The site returned its sign-in page. Use the complete device pairing JSON.');
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
    let data;try{let raw=Buffer.concat(chunks).toString('utf8');for(const secret of [c.controlToken,c.deviceToken,c.siteAccessToken,c.cookie])if(secret)raw=raw.split(secret).join('[credential omitted]');data=JSON.parse(raw);}catch{throw new Error('Workspace returned invalid data.');}
    if(!data||typeof data!=='object'||Array.isArray(data))throw new Error('Workspace returned invalid data.');
    if(!response.ok)throw new Error(typeof data.error==='string'?data.error.slice(0,500):`Workspace request failed (${response.status}). Refresh before retrying a paid request.`);
    if(data.ok===false || data.error && !data.snapshot)throw new Error(String(data.error || 'Workspace operation rejected.').slice(0,500));
    return data;
  }
  async call(method, args = []) { const data = await this.request('/api/call','POST',{method,args}); return data.result; }
  async snapshot() {
    if(this.connection.kind==='runtime') {
      const result=await this.request('/v1/office');
      if(result.ok!==true||!result.snapshot||typeof result.snapshot!=='object'||Array.isArray(result.snapshot)||!/^[a-f0-9]{64}$/.test(result.stateHash||''))throw new Error('Runtime office snapshot is invalid.');
      this.stateHash=result.stateHash;
      return {...result,revision:null,updatedAt:null};
    }
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
    if(this.connection.kind==='runtime') {
      if(this.stateHash===null)await this.snapshot();
      const id=crypto.randomUUID();
      try {
        const result=await this.request('/v1/commands','POST',{id,expectedStateHash:this.stateHash,command});
        if(result.ok!==true||result.id!==id)throw new Error('Runtime command receipt is invalid.');
        if(/^[a-f0-9]{64}$/.test(result.stateHash||''))this.stateHash=result.stateHash;
        return {...result,queued:false};
      }catch(error){throw new Error(`${String(error.message).slice(0,300)} No retry was sent. Retain command id ${id} and inspect current state.`);}
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
  async creative(operation,input) {
    if(this.connection.kind!=='runtime')throw new Error('Connect to a headless runtime to control creative tools.');
    validateCreativeRequest(operation,input);
    const read=['snapshot','job'].includes(operation);
    const route=operation==='snapshot'?`/v1/creative?${new URLSearchParams(input)}`:operation==='job'?`/v1/creative/jobs?${new URLSearchParams(input)}`:`/v1/creative/${operation}`;
    try {
      const result=await this.request(route,read?'GET':'POST',read?undefined:input);
      if(result.ok!==true)throw new Error('Runtime creative receipt is invalid.');
      if(!read&&result.snapshotOmitted===true&&result.id===input.id)return {ok:true,id:input.id,receiptOnly:true,replayed:result.replayed===true};
      if(operation==='snapshot')return creativeSnapshot(result,input.companyId);
      if(operation==='assign') {
        const assignment=result.assignment;
        if(!assignment||assignment.companyId!==input.companyId||assignment.employeeId!==input.employeeId||assignment.projectId!==input.projectId||!Array.isArray(assignment.toolIds)||assignment.toolIds.length!==input.toolIds.length||new Set(assignment.toolIds).size!==assignment.toolIds.length||assignment.toolIds.some(id=>!input.toolIds.includes(id)))throw new Error('Creative assignment response does not match the requested company, employee, project and tools.');
        return {ok:true,replayed:result.replayed===true,assignment:{companyId:input.companyId,employeeId:input.employeeId,projectId:input.projectId,toolIds:[...assignment.toolIds]}};
      }
      const job=creativeJob(result.job,input.companyId,input.jobId);
      if(operation==='run'&&(result.accepted!==true||job.id!==input.id||job.employeeId!==input.employeeId||job.projectId!==input.projectId||job.operation!==input.operation))throw new Error('Creative task receipt does not match the requested operation.');
      return {ok:true,...(operation==='run'?{accepted:true}:{}),replayed:result.replayed===true,job};
    }catch(error){throw new Error(`${String(error.message).slice(0,300)}${read?'':` No retry was sent. Retain creative request id ${input.id}; inspect creative tasks before submitting another.`}`);}
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
  static async connectRuntime(base,controlToken,fetcher=fetch) {
    const url=origin(base);
    if(base.replace(/\/$/,'')!==url)throw new Error('Use the canonical runtime origin without aliases or path components.');
    const connection=validateConnection({kind:'runtime',url,controlToken});
    const client=new AtlasClient(connection,fetcher);
    const result=await client.request('/v1/status');
    if(result.ok!==true||result.execution!=='headless')throw new Error('This endpoint is not a Daftar headless runtime.');
    await client.snapshot();
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
