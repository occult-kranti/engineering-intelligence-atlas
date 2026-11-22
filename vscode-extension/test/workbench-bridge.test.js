'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {METHODS,SETUP_FLOW_MARKUP}=require('../src/workbench-panel');
const source=fs.readFileSync(path.join(__dirname,'../media/workbench-bridge.js'),'utf8');
class Target{constructor(){this.listeners=new Map();this.dataset={};this.textContent='';}addEventListener(name,fn){if(!this.listeners.has(name))this.listeners.set(name,new Set());this.listeners.get(name).add(fn);}removeEventListener(name,fn){this.listeners.get(name)?.delete(fn);}emit(name,value={}){for(const fn of [...this.listeners.get(name)||[]])fn(value);}}
function harness(previous,connection={connected:true,kind:'runtime',connectionEpoch:1}){
  const window=new Target(),document=new Target(),sent=[],saved=[],timers=new Map();let counter=0;
  const elements=new Map(['workbench-controls','workbench-connection','workbench-compute','workbench-connect'].map(id=>[id,new Target()]));
  document.readyState='complete';document.getElementById=id=>elements.get(id)||null;document.querySelectorAll=()=>[];
  window.__DAFTAR_WORKBENCH__={version:1,epoch:1,connection,methods:METHODS,deadlineMs:1000,maxPending:32};
  const api={postMessage:value=>sent.push(JSON.parse(JSON.stringify(value))),getState:()=>previous,setState:value=>saved.push(value)};
  const context={window,document,crypto:{randomUUID:()=> 'test-uuid'},acquireVsCodeApi:()=>api,TextEncoder,Date,Map,Set,Promise,setTimeout:fn=>{timers.set(++counter,fn);return counter;},clearTimeout:id=>timers.delete(id)};
  vm.runInNewContext(source,context);return{window,document,sent,saved,timers,bridge:window.desktopBridge,reply:value=>window.emit('message',{data:value}),dispose:()=>window.emit('pagehide')};
}
test('bridge correlates out-of-order replies and ignores stale and duplicate ones',async()=>{
  const h=harness(),a=h.bridge.officeSnapshot(),b=h.bridge.officeWorkerStatus();const requests=h.sent.filter(x=>x.type==='daftar:request');
  h.reply({type:'daftar:response',epoch:0,id:requests[0].id,ok:true,value:'stale'});
  h.reply({type:'daftar:response',epoch:1,id:requests[1].id,ok:true,value:'second'});h.reply({type:'daftar:response',epoch:1,id:requests[0].id,ok:true,value:'first'});
  assert.equal(await a,'first');assert.equal(await b,'second');assert.equal(h.timers.size,0);h.reply({type:'daftar:response',epoch:1,id:requests[0].id,ok:true,value:'duplicate'});h.dispose();
});
test('cancellation, deadline, connection changes and dispose reject promises and release resources',async()=>{
  const h=harness();const cancelled=h.bridge.officeSnapshot();const ca=assert.rejects(cancelled,/cancelled/);cancelled.cancel();await ca;
  const timeout=h.bridge.officeSnapshot();const ta=assert.rejects(timeout,/deadline/);for(const fn of [...h.timers.values()])fn();await ta;h.timers.clear();
  const changed=h.bridge.officeSnapshot();const ch=assert.rejects(changed,/connection changed/);h.reply({type:'daftar:connection',epoch:2,connection:{connected:true,kind:'runtime',connectionEpoch:2}});await ch;
  const closing=h.bridge.officeSnapshot();const cl=assert.rejects(closing,/closed/);h.dispose();await cl;assert.equal(h.timers.size,0);
  assert.equal([...h.window.listeners.values()].reduce((n,set)=>n+set.size,0),0);
  assert.equal([...h.document.listeners.values()].reduce((n,set)=>n+set.size,0),0);
});
test('32 pending bound, JSON limits, and native credential arguments',async()=>{
  const h=harness();const promises=Array.from({length:32},()=>h.bridge.officeSnapshot());for(const promise of promises)promise.catch(()=>{});
  await assert.rejects(h.bridge.officeSnapshot(),/pending/);h.dispose();await Promise.allSettled(promises);
  const h2=harness();await assert.rejects(h2.bridge.officeCommand({payload:'x'.repeat(280000)}),/too large/);
  const key=h2.bridge.setApiKey('openai','must-not-cross');const request=h2.sent.find(x=>x.method==='setApiKey');assert.deepEqual(request.args,['openai']);assert.ok(!JSON.stringify(h2.sent).includes('must-not-cross'));
  h2.reply({type:'daftar:response',epoch:1,id:request.id,ok:true,value:{ok:true}});await key;h2.dispose();
});
test('only bounded view state persists and events unsubscribe cleanly',()=>{
  const h=harness();h.window.localStorage.setItem('form-api-key','secret');assert.equal(h.saved.length,0);
  h.window.localStorage.setItem('daftar-studio-theme','drafting');assert.equal(h.saved.length,1);assert.ok(!JSON.stringify(h.saved).includes('secret'));
  h.window.localStorage.setItem('daftar-studio-donna-pos',JSON.stringify({x:12,y:34,locked:true,apiKey:'never-save'}));assert.ok(!JSON.stringify(h.saved).includes('never-save'));
  h.window.localStorage.setItem('daftar.freeflow.camera.v1:company:c1',JSON.stringify({x:10,y:20,zoom:1,yaw:0,pitch:0,distance:1800,form:'never-save'}));assert.ok(!JSON.stringify(h.saved).includes('never-save'));
  h.window.localStorage.setItem('daftar.endless-workspace.layout.v1',JSON.stringify({version:1,activeId:'donna',panels:[{id:'donna',rect:{x:1,y:2,width:600,height:400},open:true,pinned:false,collapsed:false,z:1}],form:'private'}));assert.equal(JSON.parse(h.saved.at(-1).view['daftar.endless-workspace.layout.v1']).activeId,'donna');
  let seen=0;const unsubscribe=h.bridge.onJobEvent(()=>seen++);h.reply({type:'daftar:event',epoch:1,event:'job',value:{id:'j'}});unsubscribe();h.reply({type:'daftar:event',epoch:1,event:'job',value:{id:'j'}});assert.equal(seen,1);h.dispose();
});

test('shared cloud chat is exposed only for the authenticated cloud transport',async()=>{
  const local=harness();assert.equal(local.bridge.transport,'vscode');assert.equal(local.bridge.sendCloudChat,undefined);local.dispose();
  const cloud=harness(undefined,{connected:true,kind:'cloud',connectionEpoch:2});assert.equal(cloud.bridge.transport,'cloud-browser');assert.equal(cloud.bridge.rendererHost,'vscode');
  const reply=cloud.bridge.sendCloudChat({scope:{kind:'company',id:'c1'},message:'Hello',idempotencyKey:'chat1'});const request=cloud.sent.find(row=>row.method==='sendCloudChat');
  cloud.reply({type:'daftar:response',epoch:1,id:request.id,ok:true,value:{ok:true,reply:'Saved reply'}});assert.equal((await reply).reply,'Saved reply');cloud.dispose();
});

async function domHarness(t,connection={connected:false,configured:false,kind:'runtime',connectionEpoch:1}){
  const {JSDOM}=require('../../desktop-shell/node_modules/jsdom');
  const dom=new JSDOM(`<!doctype html><html><body><main id="canvas"><button id="canvas-focus">Canvas focus</button></main><aside id="workbench-controls"><span id="workbench-connection"></span><button id="workbench-connect">Connections</button><button id="workbench-compute">Compute</button><button id="workbench-setup" aria-expanded="false">Setup flow</button></aside>${SETUP_FLOW_MARKUP}</body></html>`,{runScripts:'outside-only',url:'https://webview.invalid/'});
  const {window}=dom;await new Promise(resolve=>window.document.addEventListener('DOMContentLoaded',resolve,{once:true}));
  const sent=[],saved=[];window.TextEncoder=TextEncoder;window.acquireVsCodeApi=()=>({postMessage:value=>sent.push(JSON.parse(JSON.stringify(value))),getState:()=>undefined,setState:value=>saved.push(value)});
  Object.defineProperties(window,{innerWidth:{value:1440,writable:true},innerHeight:{value:900,writable:true}});
  window.__DAFTAR_WORKBENCH__={version:1,epoch:1,connection,methods:METHODS,deadlineMs:1000,maxPending:32};
  window.eval(source);t.after(()=>{window.dispatchEvent(new window.Event('pagehide'));window.close();});
  const document=window.document,panel=document.getElementById('workbench-setup-panel');panel.getBoundingClientRect=()=>({width:420,height:760});
  return{window,document,panel,sent,saved,trigger:document.getElementById('workbench-setup'),reply:value=>window.dispatchEvent(new window.MessageEvent('message',{data:value})),flush:()=>new Promise(resolve=>setImmediate(resolve))};
}
test('setup is one nonmodal canvas popup, truthful offline, and returns keyboard focus',async t=>{
  const h=await domHarness(t);h.trigger.focus();h.trigger.click();
  assert.equal(h.panel.hidden,false);assert.equal(h.panel.getAttribute('aria-modal'),'false');assert.equal(h.document.activeElement,h.panel);assert.equal(h.trigger.getAttribute('aria-expanded'),'true');
  assert.equal(h.panel.querySelectorAll('ol>li').length,6);assert.equal(h.document.querySelectorAll('[role=dialog]').length,1);assert.equal(h.panel.querySelectorAll('iframe,input,form').length,0);assert.match(h.document.getElementById('workbench-setup-status').textContent,/Not connected/);
  assert.equal(h.panel.querySelector('[data-setup-connected]').disabled,true);assert.equal(h.panel.querySelector('[data-setup-runtime]').disabled,true);assert.equal(h.panel.querySelector('[data-setup-action=connectRuntimePrompt]').disabled,false);
  assert.equal(h.sent.filter(row=>row.type==='daftar:request').length,0);
  h.panel.dispatchEvent(new h.window.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));assert.equal(h.panel.hidden,true);assert.equal(h.document.activeElement,h.trigger);
  h.trigger.click();assert.equal(h.document.querySelectorAll('[role=dialog]').length,1);h.document.getElementById('workbench-setup-close').click();assert.equal(h.panel.hidden,true);assert.equal(h.saved.length,0);
});
test('setup movement is bounded, keyboard accessible and leaves the canvas usable',async t=>{
  const h=await domHarness(t);h.trigger.click();const move=h.document.getElementById('workbench-setup-move');move.focus();
  const before=Number.parseFloat(h.panel.style.left);move.dispatchEvent(new h.window.KeyboardEvent('keydown',{key:'ArrowLeft',bubbles:true}));assert.equal(Number.parseFloat(h.panel.style.left),before-16);
  move.dispatchEvent(new h.window.KeyboardEvent('keydown',{key:'ArrowRight',shiftKey:true,bubbles:true}));assert.ok(Number.parseFloat(h.panel.style.left)<=1010);
  const pointer=(target,type,values)=>{const event=new h.window.Event(type,{bubbles:true,cancelable:true});Object.assign(event,values);target.dispatchEvent(event);};
  pointer(move,'pointerdown',{button:0,pointerId:2,clientX:500,clientY:150});pointer(h.window,'pointermove',{pointerId:2,clientX:-10000,clientY:-10000});assert.equal(h.panel.style.left,'10px');assert.equal(h.panel.style.top,'10px');pointer(h.window,'pointerup',{pointerId:2});
  pointer(h.window,'pointermove',{pointerId:2,clientX:1200,clientY:600});assert.equal(h.panel.style.left,'10px');
  h.document.getElementById('canvas-focus').focus();assert.equal(h.document.activeElement.id,'canvas-focus');
  const css=fs.readFileSync(path.join(__dirname,'../media/workbench.css'),'utf8');assert.match(css,/@media\(prefers-reduced-motion:reduce\).*#workbench-setup-panel\{animation:none;transition:none\}/);assert.match(css,/max-height:min\(760px,calc\(100vh - 24px\)\)/);
});
test('setup actions use existing native methods and metadata refresh cannot duplicate a pending action',async t=>{
  const h=await domHarness(t,{connected:true,kind:'runtime',connectionEpoch:1});h.trigger.click();
  const buttons=[...h.panel.querySelectorAll('[data-setup-action]')];assert.equal(buttons.every(button=>!button.disabled),true);
  for(const method of ['connectRuntimePrompt','startLocalRuntime','openComputeCenter','copyEditorPairing']){
    const button=buttons.find(row=>row.dataset.setupAction===method);button.click();const call=h.sent.filter(row=>row.type==='daftar:request').at(-1);assert.equal(call.method,method);assert.deepEqual(call.args,[]);
    const before=h.sent.length;h.reply({type:'daftar:connection',epoch:1,connection:{connected:true,kind:'runtime',connectionEpoch:1}});assert.equal(button.disabled,true);button.click();assert.equal(h.sent.length,before);
    h.reply({type:'daftar:response',epoch:1,id:call.id,ok:true,value:{ok:true}});await h.flush();assert.equal(button.disabled,false);
  }
  assert.match(h.document.getElementById('workbench-setup-status').textContent,/ChatGPT is not connected/);
  h.reply({type:'daftar:connection',epoch:1,connection:{connected:true,kind:'cloud',connectionEpoch:1,notice:'<img src=x onerror=alert(1)>'}});assert.equal(h.panel.querySelector('[data-setup-runtime]').disabled,true);assert.equal(h.panel.querySelector('[data-setup-connected]').disabled,false);assert.equal(h.document.querySelectorAll('img').length,0);assert.match(h.panel.textContent,/readiness has not been checked/);
});
test('setup disposal cancels native request and removes its event handlers',async t=>{
  const h=await domHarness(t,{connected:true,kind:'runtime',connectionEpoch:1});h.trigger.click();h.panel.querySelector('[data-setup-action=openComputeCenter]').click();const call=h.sent.find(row=>row.method==='openComputeCenter');
  h.window.dispatchEvent(new h.window.Event('pagehide'));await h.flush();assert.ok(h.sent.some(row=>row.type==='daftar:cancel'&&row.id===call.id));
  const before=h.sent.length;h.panel.querySelector('[data-setup-action=connectRuntimePrompt]').click();h.trigger.click();assert.equal(h.sent.length,before);
});
