'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {METHODS}=require('../src/workbench-panel');
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
