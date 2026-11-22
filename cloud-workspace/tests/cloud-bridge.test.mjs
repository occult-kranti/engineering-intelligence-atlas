import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../scripts/cloud-bridge.js',import.meta.url),'utf8');
function setup(activity={available:false,execution:null,reason:'missing'}){
 const requests=[];let failActivity=false,relayStatus='pending';
 const snapshot={schemaVersion:3,companies:[{id:'c'}],activeCompanyId:'c',chatThreads:[]};
 const context={window:{},location:{search:'',origin:'https://office.example'},URL,URLSearchParams,structuredClone,crypto:{randomUUID:()=> 'fresh-random'},sessionStorage:{getItem:()=>null,setItem(){}},
  fetch:async(path,options)=>{requests.push({path,...options});if(path==='/api/runtime-activity'&&failActivity)throw Error('Offline');const values={'/api/workspace':{revision:9,snapshot},'/api/cloud-threads':{threads:[]},'/api/commands':{commandId:'command',status:relayStatus,error:'Native validation rejected the command.',baseRevision:8},'/api/runtime-activity':activity};return{ok:true,json:async()=>structuredClone(values[path])};}};
 vm.runInNewContext(source,context);return {bridge:context.window.desktopBridge,requests,snapshot,status(value){relayStatus=value;},offline(){failActivity=true;}};
}
test('sticky and session retries retain exact native request identity without pretending they executed',async()=>{
 const t=setup();const command={action:'upsert_sticky_note',requestId:'immutable-note-identity',expectedRevision:0,id:'note'};
 for(let i=0;i<2;i++){const result=await t.bridge.officeCommand(command);assert.equal(result.queued,true);assert.equal(result.relayStatus,'pending');}
 const bodies=t.requests.filter(r=>r.path==='/api/commands').map(r=>JSON.parse(r.body));
 assert.equal(bodies.length,2);assert.deepEqual(bodies[0],bodies[1]);assert.equal(bodies[0].idempotencyKey,command.requestId);assert.equal(bodies[0].command.payload.requestId,command.requestId);assert.equal(bodies[0].expectedRevision,9);
});
test('terminal command success waits for its exact native receipt rather than stale ACK-time snapshot',async()=>{
 const t=setup(),command={action:'upsert_sticky_note',requestId:'note-request',expectedRevision:0,id:'note'};
 for(const status of ['completed','completed-after-cancel']){
  t.status(status);t.snapshot.improvementReceipts=[];
  const early=await t.bridge.officeCommand(command);assert.equal(early.queued,true);assert.equal(early.relayStatus,'awaiting-snapshot');
  t.snapshot.improvementReceipts=[{id:'different-request',action:command.action},{id:command.requestId,action:'archive_sticky_note'}];
  assert.equal((await t.bridge.officeCommand(command)).queued,true);
  t.snapshot.improvementReceipts.push({id:command.requestId,action:command.action});
  const final=await t.bridge.officeCommand(command);assert.equal(final.queued,false);assert.equal(final.ok,true);assert.equal(final.relayStatus,status);
 }
 for(const req of t.requests.filter(r=>r.path==='/api/commands'))assert.equal(JSON.parse(req.body).idempotencyKey,command.requestId);
});
test('terminal native rejection releases pending UI state with a specific reason and no new request',async()=>{
 const t=setup(),command={action:'control_improvement_session',requestId:'session-request',sessionId:'s',expectedRevision:0,operation:'start'};
 for(const [status,code] of [['failed','CLOUD_COMMAND_REJECTED'],['conflict','REVISION_CONFLICT'],['cancelled','CLOUD_COMMAND_CANCELLED']]){
  t.status(status);const result=await t.bridge.officeCommand(command);assert.equal(result.ok,false);assert.equal(result.queued,false);assert.equal(result.code,code);assert.match(result.error,/Native validation/);
 }
});
test('website activity uses actual sampled callback and never infers execution from loaded definitions',async()=>{
 const execution={sampledAt:'2026-11-22T12:00:00Z',activeCalls:[{jobId:'j',phase:'provider',startedAt:'2026-11-22T11:59:59Z'}]};
 const t=setup({available:true,execution});const s=await t.bridge.officeWorkerStatus();assert.equal(s.running,true);assert.deepEqual(s.execution,execution);assert.equal(s.activeJobId,'j');assert.equal(s.enabled,false);
 t.offline();const missing=await t.bridge.officeWorkerStatus();assert.equal(missing.running,false);assert.equal(missing.execution,undefined);assert.equal(missing.activitySource,'unavailable');
 const stale=await setup({available:false,execution,reason:'stale'}).bridge.officeWorkerStatus();assert.equal(stale.running,false);assert.equal(stale.execution,undefined);
});
