'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {createOfficePanel,readAssets,METHODS}=require('../src/workbench-panel');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
async function fixture(t){
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'daftar-panel-'));t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));
  const source=path.join(directory,'renderer'),root=path.join(directory,'extension');fs.mkdirSync(path.join(source,'freeflow'),{recursive:true});
  fs.writeFileSync(path.join(source,'chrome.html'),'<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="old"><link rel="stylesheet" href="./freeflow.css"></head><body><main id="workspace-main"></main><script type="module" src="./browser-bridge.js"></script><script type="module" src="./chrome.js"></script></body></html>');
  fs.writeFileSync(path.join(source,'chrome.js'),"import './freeflow/scene.js';\nexport {};\n");fs.writeFileSync(path.join(source,'freeflow/scene.js'),'export const sharedCanvas=true;');fs.writeFileSync(path.join(source,'freeflow.css'),'body{margin:0}');
  const {buildStudioAssets}=await import('../scripts/build-studio-assets.mjs');buildStudioAssets({sourceDir:source,destDir:path.join(root,'media/studio')});
  const events={},sent=[];let html='',assignments=0;
  const panel={visible:true,disposed:false,webview:{cspSource:'vscode-resource:',asWebviewUri:uri=>({toString:()=>`vscode-resource:${uri.fsPath}`}),postMessage:value=>{sent.push(value);return Promise.resolve(true);},onDidReceiveMessage:fn=>{events.message=fn;return{dispose(){delete events.message;}};},get html(){return html;},set html(value){html=value;assignments++;}},onDidDispose:fn=>{events.dispose=fn;return{dispose(){delete events.dispose;}};},reveal(){this.visible=true;},dispose(){this.disposed=true;this.visible=false;events.dispose?.();}};
  const vscode={ViewColumn:{Active:1},Uri:{joinPath:(uri,...parts)=>({fsPath:path.join(uri.fsPath,...parts)})},window:{createWebviewPanel:(_kind,_title,_column,options)=>{panel.options=options;return panel;}}};
  return{root,source,panel,events,sent,vscode,context:{extensionUri:{fsPath:root}},assignments:()=>assignments};
}
const request=(id,method='officeSnapshot',args=[],epoch=1)=>({type:'daftar:request',id,epoch,method,args});

test('packages the shared transitive renderer graph and injects a network-free bridge first',async t=>{
  const f=await fixture(t);const controller=createOfficePanel(f.vscode,f.context,{call:async()=>({ok:true}),connectionInfo:()=>({connected:false,kind:'runtime',connectionEpoch:1})});t.after(()=>controller.dispose());
  assert.equal(Object.keys(readAssets(f.root).manifest.files).length,3);
  assert.ok(!f.panel.webview.html.includes('browser-bridge.js'));assert.match(f.panel.webview.html,/connect-src &#39;none&#39;/);
  assert.ok(f.panel.webview.html.indexOf('workbench-bridge.js')<f.panel.webview.html.indexOf('chrome.'));
  assert.equal(f.panel.options.retainContextWhenHidden,false);assert.equal(f.panel.options.localResourceRoots.length,1);
  assert.ok(METHODS.hostSubmit&&METHODS.environmentRun&&METHODS.resourcePlan&&METHODS.designInstall);
  assert.deepEqual(METHODS.activityStatus,[0,0]);assert.deepEqual(METHODS.activityQuery,[0,1]);assert.deepEqual(METHODS.activitySummarize,[0,1]);
  assert.equal((f.panel.webview.html.match(/id="workbench-setup-panel"/g)||[]).length,1);assert.match(f.panel.webview.html,/aria-modal="false"/);assert.match(f.panel.webview.html,/id="workbench-setup" aria-controls="workbench-setup-panel"/);assert.ok(!f.panel.webview.html.includes('<iframe'));
  const filename=Object.keys(readAssets(f.root).manifest.files).find(name=>name.startsWith('chrome.'));
  fs.appendFileSync(path.join(f.root,'media/studio',filename),'\nchanged');assert.throws(()=>readAssets(f.root),/integrity/);
});

test('duplicate and malformed requests do not dispatch; responses remain correlated out of order',async t=>{
  const f=await fixture(t),calls=[];const controller=createOfficePanel(f.vscode,f.context,{call:(method,args,context)=>new Promise(resolve=>calls.push({method,args,context,resolve})),connectionInfo:()=>({connected:true,kind:'runtime',url:'http://127.0.0.1:8788'})});t.after(()=>controller.dispose());
  f.events.message(request('first'));f.events.message(request('first'));f.events.message(request('second'));f.events.message(request('bad','constructor'));f.events.message(request('secret','setApiKey',['openai','never-forward']));f.events.message({...request('old'),epoch:0});
  await tick();assert.equal(calls.length,2);calls[1].resolve({n:2});await tick();calls[0].resolve({n:1});await tick();
  assert.deepEqual(f.sent.filter(x=>x.ok===true).map(x=>[x.id,x.value.n]),[['second',2],['first',1]]);
});

test('metadata refresh preserves requests; identity changes and disposal abort them',async t=>{
  const f=await fixture(t),calls=[];const base={connected:true,kind:'runtime',url:'http://127.0.0.1:8788',connectionEpoch:4};
  const controller=createOfficePanel(f.vscode,f.context,{call:(_m,_a,context)=>new Promise(resolve=>calls.push({...context,resolve})),connectionInfo:()=>base});t.after(()=>controller.dispose());
  f.events.message(request('first'));await tick();const count=f.assignments();controller.notifyConnection({...base,notice:'New metadata'});
  assert.equal(f.assignments(),count);assert.equal(calls[0].signal.aborted,false);
  controller.notifyConnection({...base,connectionEpoch:5});assert.equal(calls[0].signal.aborted,true);assert.equal(f.assignments(),count+1);
  calls[0].resolve({stale:true});await tick();assert.ok(!f.sent.some(x=>x.id==='first'&&x.ok===true));
  f.events.message(request('next','officeSnapshot',[],2));await tick();controller.dispose();assert.equal(calls[1].signal.aborted,true);assert.equal(controller.isDisposed(),true);assert.equal(controller.isVisible(),false);assert.equal(f.events.message,undefined);
});

test('graph builder rejects external dependencies rather than bundling a network loader',async t=>{
  const f=await fixture(t);fs.writeFileSync(path.join(f.source,'chrome.js'),"import 'https://untrusted.invalid/code.js';");
  const {buildStudioAssets}=await import('../scripts/build-studio-assets.mjs');assert.throws(()=>buildStudioAssets({sourceDir:f.source,destDir:path.join(f.root,'media/studio')}),/non-relative/);
});

test('closing before the dispatch microtask prevents the operation from starting',async t=>{
  const f=await fixture(t);let calls=0;const controller=createOfficePanel(f.vscode,f.context,{call:async()=>{calls++;return{ok:true};},connectionInfo:()=>({connected:true,kind:'runtime'})});
  f.events.message(request('cancel-before-call','officeCommand',[{action:'create_company',name:'Must not run'}]));controller.dispose();await tick();assert.equal(calls,0);
});

test('10000 completed reads stay bounded without exhausting the panel or forgetting mutation identities',async t=>{
  const f=await fixture(t),calls=[];
  const controller=createOfficePanel(f.vscode,f.context,{call:async(method,_args,context)=>{calls.push([method,context.id]);return{ok:true};},connectionInfo:()=>({connected:true,kind:'runtime'})});
  t.after(()=>controller.dispose());
  f.events.message(request('one-write','officeCommand',[{action:'create_company',name:'Only once'}]));await tick();
  const polling=[['officeSnapshot',[]],['cloudStatus',[]],['modelPoolSnapshot',[{}]],['hostInspect',[{id:'fixture'}]],['resourceResolve',[{}]]];
  for(let offset=0;offset<10000;offset+=20){
    for(let i=offset;i<offset+20;i++){const[method,args]=polling[i%polling.length];f.events.message(request(`read-${i}`,method,args));}
    await tick();
  }
  assert.equal(calls.length,10001);assert.equal(f.sent.filter(x=>x.ok===true).length,10001);
  assert.deepEqual(controller.diagnostics(),{pending:0,readIdentities:512,mutationIdentities:1});
  f.events.message(request('one-write','officeCommand',[{action:'create_company',name:'Must not repeat'}]));
  f.events.message(request('read-9999'));await tick();assert.equal(calls.length,10001);
  // An evicted, completed read may run again; the long-lived mutation cannot.
  f.events.message(request('read-0'));await tick();assert.equal(calls.length,10002);
  controller.dispose();assert.deepEqual(controller.diagnostics(),{pending:0,readIdentities:0,mutationIdentities:0});
});

test('a cancelled read cannot return a late response or keep a pending slot',async t=>{
  const f=await fixture(t);let resolve,signal;
  const controller=createOfficePanel(f.vscode,f.context,{call:(_m,_a,context)=>{signal=context.signal;return new Promise(done=>{resolve=done;});},connectionInfo:()=>({connected:true,kind:'runtime'})});
  t.after(()=>controller.dispose());f.events.message(request('cancel-read'));await tick();
  f.events.message({type:'daftar:cancel',epoch:1,id:'cancel-read'});assert.equal(signal.aborted,true);
  resolve({late:true});await tick();assert.ok(!f.sent.some(x=>x.id==='cancel-read'));
  assert.deepEqual(controller.diagnostics(),{pending:0,readIdentities:1,mutationIdentities:0});
});

test('the actual shared renderer creates website portals only outside the VS Code host',()=>{
  const ts=require('../../desktop-shell/node_modules/typescript');const vm=require('node:vm');
  const source=fs.readFileSync(path.resolve(__dirname,'../../desktop-shell/src/renderer/chrome.ts'),'utf8');
  const start=source.indexOf('  const portals=new Map<string,HTMLIFrameElement>();'),end=source.indexOf('  const panelChanged=',start);
  assert.ok(start>=0&&end>start,'Shared renderer portal block must remain identifiable.');
  const script=ts.transpileModule(source.slice(start,end)+'\nglobalThis.createdPortals = [...portals.keys()];',{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
  function render(bridge){
    const frames=[];const element=()=>({dataset:{},append(){}});
    const context={bridge,URL,URLSearchParams,location:{search:'?company=c1',origin:'https://studio.example'},textElement:element,document:{createElement(tag){const node=element();if(tag==='iframe')frames.push(node);return node;}},add(){}};
    vm.runInNewContext(script,context);return{frames,ids:context.createdPortals};
  }
  assert.equal(render({transport:'cloud-browser',rendererHost:'vscode'}).frames.length,0);
  assert.equal(render({transport:'cloud-browser'}).frames.length,5);
  assert.equal(render({transport:'vscode',rendererHost:'vscode'}).frames.length,0);
});
