'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const METHODS = Object.freeze({
  copyEditorPairing:[0,0],cloudStatus:[0,0],configureCloud:[0,1],syncCloud:[0,0],disconnectCloud:[0,0],
  openPersonalDashboard:[0,0],getSystemInfo:[0,0],getModelCatalog:[0,0],checkModelRequirements:[1,1],createVenv:[1,1],downloadModel:[1,1],getJobStatus:[0,1],cancelJob:[1,1],
  openOfflineAtlas:[0,0],connectRuntime:[1,1],backToLauncher:[0,0],getSettings:[0,0],openExternal:[1,1],getVaultStatus:[0,0],setApiKey:[1,1],revokeApiKey:[1,1],importCredentialFile:[1,1],listProviderModels:[1,1],detectOllama:[0,0],
  companySnapshot:[0,0],registerCompany:[1,1],refreshCompany:[0,0],updateCompanyTask:[1,1],indexCompanyRepository:[0,0],officeSnapshot:[0,0],officeCommand:[1,1],officeWorkerStatus:[0,0],setOfficeWorker:[1,1],runOfficeQueue:[0,0],
  modelPoolSnapshot:[1,1],modelPoolRequest:[1,1],modelPoolCancel:[1,1],modelPoolSelect:[1,1],listProjects:[0,0],createProject:[1,1],getProject:[1,1],startRun:[1,1],pauseRun:[1,1],resumeRun:[1,1],cancelRun:[1,1],listRuns:[0,1],readArtifact:[3,3],sendCloudChat:[1,1],
  hostStatus:[0,0],hostConfigure:[1,1],hostSubmit:[1,1],hostApprove:[1,1],hostCancel:[1,1],hostInspect:[1,1],hostStopAll:[0,0],
  environmentStatus:[0,1],environmentPrepare:[1,1],environmentInspect:[1,1],environmentRun:[1,1],
  resourceStatus:[0,1],resourceConfigure:[1,1],resourceResolve:[1,1],resourcePlan:[1,1],resourceStart:[1,1],resourceInspect:[1,1],resourceCancel:[1,1],
  designCatalog:[0,0],designPlan:[1,1],designInstall:[1,1],designInspect:[1,1],
  openComputeCenter:[0,0],startLocalRuntime:[0,0],connectRuntimePrompt:[0,0],connectCompute:[0,0],connectDesktopPrompt:[0,0],connectCloudPrompt:[0,0],
});
const MAX_REQUEST_BYTES=272*1024, MAX_RESPONSE_BYTES=9*1024*1024, MAX_PENDING=32, DEADLINE_MS=45000;
const EVENTS=new Set(['job','project','mode','connection']);
const ID=/^[A-Za-z0-9_-]{1,96}$/;
function plain(value){return value!==null&&typeof value==='object'&&!Array.isArray(value)&&[Object.prototype,null].includes(Object.getPrototypeOf(value));}
function serializable(value,limit){try{const text=JSON.stringify(value);return typeof text==='string'&&Buffer.byteLength(text)<=limit;}catch{return false;}}
function publicInfo(value){
  const source=plain(value)?value:{};const out={connected:source.connected===true,configured:source.configured===true};
  for(const key of ['kind','label','url','location','notice'])if(typeof source[key]==='string')out[key]=source[key].slice(0,key==='notice'?500:2048);
  out.connectionEpoch=Number.isSafeInteger(source.connectionEpoch)&&source.connectionEpoch>=0?source.connectionEpoch:0;
  if(Array.isArray(source.capabilities))out.capabilities=source.capabilities.filter(x=>typeof x==='string'&&x.length<=100).slice(0,128);
  else if(plain(source.capabilities)){out.capabilities={};for(const[key,value]of Object.entries(source.capabilities).slice(0,128))if(/^[A-Za-z0-9_.-]{1,100}$/.test(key)&&typeof value==='boolean')out.capabilities[key]=value;}
  return out;
}
function identity(info){return JSON.stringify([info.kind||'',info.url||'',info.location||'',info.connected,info.connectionEpoch]);}
function safeError(error){
  const message=error instanceof Error?error.message:'The operation failed.';
  return {code:typeof error?.code==='string'&&/^[A-Za-z0-9_-]{1,80}$/.test(error.code)?error.code:'operation_failed',message:message.replace(/(?:sk-ant-|sk-proj-|sk-|github_pat_|ghp_)[A-Za-z0-9_-]+/g,'[credential omitted]').slice(0,600)};
}
function readAssets(extensionPath){
  const base=path.join(extensionPath,'media/studio');const raw=fs.readFileSync(path.join(base,'manifest.json'));
  if(raw.length>256*1024)throw new Error('Studio asset manifest is too large.');
  const manifest=JSON.parse(raw);
  if(manifest.version!==1||manifest.renderer!=='desktop-shared-freeflow'||manifest.html!=='studio.html'||!plain(manifest.files)||Object.keys(manifest.files).length>512)throw new Error('Build the shared office studio assets before opening the panel.');
  let total=0;
  for(const[name,record]of Object.entries(manifest.files)){
    if(!/^[A-Za-z0-9_./-]+$/.test(name)||name.startsWith('/')||name.split('/').some(p=>!p||p==='.'||p==='..')||!plain(record)||!/^[a-f0-9]{64}$/.test(record.sha256))throw new Error('Invalid studio asset manifest.');
    const filename=path.join(base,name),stat=fs.lstatSync(filename);
    if(!stat.isFile()||stat.isSymbolicLink()||stat.size>8*1024*1024||(total+=stat.size)>40*1024*1024)throw new Error('Invalid studio asset file.');
    const bytes=fs.readFileSync(filename);
    if(crypto.createHash('sha256').update(bytes).digest('hex')!==record.sha256||bytes.length!==record.bytes)throw new Error('Studio asset integrity check failed. Rebuild the VSIX.');
  }
  const html=fs.readFileSync(path.join(base,manifest.html),'utf8');
  if(Buffer.byteLength(html)>2*1024*1024||crypto.createHash('sha256').update(html).digest('hex')!==manifest.htmlSha256)throw new Error('Studio HTML integrity check failed.');
  return {html,manifest};
}
function escape(value){return String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function htmlFor(vscode,context,webview,info,epoch){
  const {html:source,manifest}=readAssets(context.extensionUri.fsPath||context.extensionPath);
  const nonce=crypto.randomBytes(24).toString('base64url');
  const resource=(...parts)=>webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri,'media',...parts)).toString();
  let html=source.replace(/<meta\b[^>]*http-equiv=["']Content-Security-Policy["'][^>]*>/gi,'');
  html=html.replace(/\b(src|href)=(["'])\.\/([^"']+)\2/g,(_all,attr,q,name)=>{
    if(!Object.hasOwn(manifest.files,name))throw new Error('Unlisted studio asset reference.');
    return `${attr}=${q}${escape(resource('studio',...name.split('/')))}${q}`;
  });
  html=html.replace(/<script\b/g,`<script nonce="${nonce}"`);
  const bootstrap=JSON.stringify({version:1,epoch,connection:info,methods:METHODS,deadlineMs:DEADLINE_MS,maxPending:MAX_PENDING}).replace(/</g,'\\u003c').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');
  const csp=`default-src 'none'; script-src 'nonce-${nonce}' ${webview.cspSource}; style-src ${webview.cspSource} 'unsafe-inline'; img-src ${webview.cspSource} data:; font-src ${webview.cspSource}; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'`;
  html=html.replace('</head>',`<meta http-equiv="Content-Security-Policy" content="${escape(csp)}"><link rel="stylesheet" href="${escape(resource('workbench.css'))}"><script nonce="${nonce}">window.__DAFTAR_WORKBENCH__=${bootstrap};</script><script nonce="${nonce}" src="${escape(resource('workbench-bridge.js'))}"></script></head>`);
  html=html.replace(/<body([^>]*)>/i,'<body$1><aside id="workbench-controls" aria-label="Editor connection"><span id="workbench-connection" role="status"></span><button type="button" id="workbench-connect">Connections</button><button type="button" id="workbench-compute">Compute</button></aside>');
  return html;
}
function createOfficePanel(vscode,context,{call,connectionInfo}){
  if(typeof call!=='function'||typeof connectionInfo!=='function')throw new TypeError('Workbench call and connectionInfo are required.');
  let disposed=false,epoch=1,info=publicInfo(connectionInfo()),signature=identity(info);
  const pending=new Map(),seen=new Set(),subscriptions=[];
  const panel=vscode.window.createWebviewPanel('atlas.workbench','Daftar — Office',vscode.ViewColumn.Active,{enableScripts:true,retainContextWhenHidden:false,localResourceRoots:[vscode.Uri.joinPath(context.extensionUri,'media')]});
  const post=message=>{if(!disposed)void Promise.resolve(panel.webview.postMessage(message)).catch(()=>{});};
  const cancelAll=()=>{for(const item of pending.values()){clearTimeout(item.timer);item.controller.abort();}pending.clear();seen.clear();};
  const settle=(id,item,message)=>{if(disposed||pending.get(id)!==item||item.epoch!==epoch)return;clearTimeout(item.timer);pending.delete(id);post({type:'daftar:response',id,epoch,...message});};
  const onMessage=message=>{
    if(disposed||!plain(message)||!serializable(message,MAX_REQUEST_BYTES))return;
    if(message.type==='daftar:ready'){post({type:'daftar:connection',epoch,connection:info});return;}
    if(message.type==='daftar:cancel'&&message.epoch===epoch&&ID.test(message.id||'')){
      const item=pending.get(message.id);if(item){clearTimeout(item.timer);item.controller.abort();pending.delete(message.id);}return;
    }
    if(message.type!=='daftar:request'||message.epoch!==epoch||!ID.test(message.id||''))return;
    const method=message.method,args=message.args;
    if(!Object.hasOwn(METHODS,method)||!Array.isArray(args)||args.length<METHODS[method][0]||args.length>METHODS[method][1]){post({type:'daftar:response',id:message.id,epoch,ok:false,error:{code:'invalid_method',message:'Unsupported bridge operation or arguments.'}});return;}
    if(seen.has(message.id))return;
    if(pending.size>=MAX_PENDING||seen.size>=8192){post({type:'daftar:response',id:message.id,epoch,ok:false,error:{code:'capacity',message:'The editor has reached its request limit. Wait for work to finish or reopen the office.'}});return;}
    if(method==='configureCloud'&&args.length){post({type:'daftar:response',id:message.id,epoch,ok:false,error:{code:'native_credentials_required',message:'Use the VS Code connection prompts for credentials.'}});return;}
    seen.add(message.id);
    const controller=new AbortController();const item={controller,epoch,timer:null};pending.set(message.id,item);
    item.timer=setTimeout(()=>{controller.abort();settle(message.id,item,{ok:false,error:{code:'deadline',message:'The operation exceeded the editor deadline. No retry was sent; inspect its original job ID.'}});},DEADLINE_MS);
    Promise.resolve().then(()=>{if(disposed||controller.signal.aborted||pending.get(message.id)!==item)throw Object.assign(new Error('The office request was cancelled before dispatch.'),{code:'cancelled'});return call(method,args,{id:message.id,signal:controller.signal});}).then(value=>{
      if(!serializable(value,MAX_RESPONSE_BYTES))throw Object.assign(new Error('The operation returned an invalid or oversized response.'),{code:'response_limit'});
      settle(message.id,item,{ok:true,value});
    }).catch(error=>settle(message.id,item,{ok:false,error:safeError(error)}));
  };
  const dispose=()=>{if(disposed)return;disposed=true;cancelAll();for(const subscription of subscriptions.splice(0))subscription.dispose();panel.dispose();};
  subscriptions.push(panel.webview.onDidReceiveMessage(onMessage),panel.onDidDispose(()=>{if(!disposed){disposed=true;cancelAll();for(const subscription of subscriptions.splice(0))subscription.dispose();}}));
  try{panel.webview.html=htmlFor(vscode,context,panel.webview,info,epoch);}catch(error){dispose();throw error;}
  return {reveal(){if(!disposed)panel.reveal(vscode.ViewColumn.Active);},dispose,isVisible(){return !disposed&&panel.visible===true;},isDisposed(){return disposed;},
    postEvent(type,value){const name=({onJobEvent:'job',jobEvent:'job',onProjectEvent:'project',projectEvent:'project',onModeChanged:'mode',modeChanged:'mode'})[type]||type;if(!EVENTS.has(name)||name==='connection'||!serializable(value,MAX_RESPONSE_BYTES))return;post({type:'daftar:event',epoch,event:name,value});},
    notifyConnection(next){if(disposed)return;const updated=publicInfo(next),nextSignature=identity(updated);info=updated;if(nextSignature!==signature){signature=nextSignature;epoch++;cancelAll();panel.webview.html=htmlFor(vscode,context,panel.webview,info,epoch);}else post({type:'daftar:connection',epoch,connection:info});}
  };
}
module.exports={createOfficePanel,METHODS,publicInfo,readAssets,htmlFor,MAX_REQUEST_BYTES,MAX_RESPONSE_BYTES,MAX_PENDING,DEADLINE_MS};
