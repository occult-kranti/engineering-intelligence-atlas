import {afterEach,describe,expect,it,vi} from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {OfficeWorker,OfficeWorkerPool,type OfficeWorkerOptions} from '../src/main/officeWorker';
import type {GenerateFn} from '../src/main/projects';
import type {OfficeCommand,OfficeJob,OfficeResult,OfficeSnapshot} from '../src/shared/office';
const roots:string[]=[];const workers:OfficeWorker[]=[];
const clone=<T>(v:T):T=>JSON.parse(JSON.stringify(v));
function job(overrides:Partial<OfficeJob>={}):OfficeJob{
 const at=new Date().toISOString();return {id:crypto.randomUUID(),companyId:'company-a',officeId:'office-a',departmentId:null,employeeId:'donna',goal:'Review the release evidence.',mode:'provider',provider:'anthropic',model:'fixture-model',authorized:true,allowedTools:[],dependencies:[],contextHash:null,cacheKey:null,promptVersion:'test-v1',status:'queued',limits:{maxTokens:32000,maxUsd:1,maxMinutes:5},priceRates:{inputUsdPerMillion:2,outputUsdPerMillion:10},usage:{inputTokens:0,outputTokens:0,costUsd:0},costStatus:'none',reservation:null,usageRecorded:false,createdAt:at,updatedAt:at,dueAt:at,startedAt:null,finishedAt:null,workerId:null,leaseToken:null,leaseExpiresAt:null,artifactUri:null,summary:null,error:null,idempotencyKey:crypto.randomUUID(),...overrides};
}
function fixture(options:{jobs?:OfficeJob[];generate?:OfficeWorkerOptions['generate'];cache?:boolean;refuseFinish?:boolean;refuseAuthority?:boolean;prepareContext?:OfficeWorkerOptions['prepareContext'];validateJob?:OfficeWorkerOptions['validateJob'];afterCommand?:(request:OfficeCommand)=>Promise<void>;executeTool?:OfficeWorkerOptions['executeTool']}={}){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'atlas-worker-test-'));roots.push(root);const seedDir=path.join(root,'seed');const artifactRoot=path.join(root,'artifacts');fs.mkdirSync(seedDir);
 const state:OfficeSnapshot={schemaVersion:1,activeCompanyId:'company-a',companies:[],offices:[],departments:[],employees:[{id:'donna',companyId:null,officeId:null,departmentId:null,name:'Donna',role:'CEO assistant',kind:'assistant',status:'active',skillPaths:[],createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()}],jobs:options.jobs??[job()],schedules:[],cache:{enabled:options.cache??false,maxEntries:32,ttlMinutes:60,entries:[],hits:0,misses:0},knowledge:[],events:[],lastAction:null};
 const calls:OfficeCommand[]=[];const chronology:string[]=[];const response=():OfficeResult=>({ok:true,snapshot:clone(state)});
 const command=vi.fn(async(req:OfficeCommand):Promise<OfficeResult>=>{
  calls.push(clone(req));chronology.push(req.action);
  if(req.action==='claim_job'){const current=state.jobs.find(j=>j.status==='queued'&&j.mode===req.mode);if(!current)state.lastAction={jobId:null};else{current.status='running';current.leaseToken=`lease-${current.id}`;current.startedAt=new Date().toISOString();current.workerId=String(req.workerId);state.lastAction={jobId:current.id,leaseToken:current.leaseToken};}}
  if(req.action==='reserve_job'){const current=state.jobs.find(j=>j.id===req.jobId)!;expect(current.leaseToken).toBe(req.leaseToken);expect(Number(req.inputTokens)+Number(req.maxOutputTokens)).toBeLessThanOrEqual(current.limits.maxTokens);expect(Number(req.costUsd)).toBeLessThanOrEqual(current.limits.maxUsd);current.reservation={inputTokens:Number(req.inputTokens),maxOutputTokens:Number(req.maxOutputTokens),costUsd:Number(req.costUsd)};current.costStatus='reserved';current.usage={inputTokens:Number(req.inputTokens),outputTokens:Number(req.maxOutputTokens),costUsd:Number(req.costUsd)};}
  if(req.action==='check_worker_authority'){if(options.refuseAuthority)return{ok:false,snapshot:null,error:'Timeboxed authority expired before dispatch',code:'AUTHORITY_DENIED'};state.lastAction={jobId:req.jobId,allowed:true};}
  if(req.action==='finish_job'){if(options.refuseFinish)return {ok:false,snapshot:null,error:'Fixture storage unavailable'};const current=state.jobs.find(j=>j.id===req.jobId)!;current.usage={inputTokens:Number(req.inputTokens),outputTokens:Number(req.outputTokens),costUsd:Number(req.costUsd)};current.costStatus=req.costStatus as OfficeJob['costStatus'];current.usageRecorded=true;current.artifactUri=typeof req.artifactUri==='string'?req.artifactUri:null;current.summary=typeof req.summary==='string'?req.summary:null;current.error=typeof req.error==='string'?req.error:null;if(!['cancelled','paused','needs-review'].includes(current.status))current.status=current.usage.inputTokens+current.usage.outputTokens>current.limits.maxTokens||current.usage.costUsd>current.limits.maxUsd?'budget-exhausted':req.status as OfficeJob['status'];current.finishedAt=new Date().toISOString();}
  if(req.action==='get_cache'){if(state.cache.entries.some(e=>e.companyId===req.companyId&&e.key===req.key))state.cache.hits++;else state.cache.misses++;}
  if(req.action==='put_cache')state.cache.entries.push({key:String(req.key),companyId:String(req.companyId),artifactUri:String(req.artifactUri),bytes:Number(req.bytes),createdAt:new Date().toISOString(),expiresAt:new Date(Date.now()+3600000).toISOString(),...(typeof req.contentSha256==='string'?{contentSha256:req.contentSha256}:{})});
  const result=response();
  if(options.afterCommand)await options.afterCommand(req);
  return result;
 });
 const defaultGenerate:GenerateFn=async()=>({text:'Fixture deliverable with evidence references.',inputTokens:100,outputTokens:200});
 const generate=vi.fn<OfficeWorkerOptions['generate']>(async(request,job)=>{chronology.push('generate');return(options.generate??defaultGenerate)(request,job);});
 const worker=new OfficeWorker({snapshot:async()=>response(),command,generate,artifactRoot,seedDir,intervalMs:5000,prepareContext:options.prepareContext,validateJob:options.validateJob,executeTool:options.executeTool});workers.push(worker);return{worker,state,calls,chronology,command,generate,root,seedDir,artifactRoot,snapshot:async()=>response()};
}
afterEach(()=>{for(const w of workers.splice(0))w.stop();vi.useRealTimers();for(const root of roots.splice(0))fs.rmSync(root,{recursive:true,force:true});});
describe('OfficeWorker accounting and dispatch',()=>{
 it('validates the exact model route before cache admission and reservation',async()=>{const f=fixture({cache:true,validateJob:async()=>{throw new Error('Selected local model digest changed');}});await f.worker.runOnce();expect(f.generate).not.toHaveBeenCalled();expect(f.calls.some(c=>['get_cache','reserve_job'].includes(c.action))).toBe(false);expect(f.state.jobs[0]?.usage.costUsd).toBe(0);expect(f.worker.status().lastError).toContain('digest changed');});
 it('revalidates after reservation and settles zero when the model assignment is revoked',async()=>{let calls=0;const f=fixture({validateJob:async()=>{calls++;if(calls===2)throw new Error('Model assignment revoked');}});await f.worker.runOnce();expect(calls).toBe(2);expect(f.calls.some(c=>c.action==='reserve_job')).toBe(true);expect(f.generate).not.toHaveBeenCalled();expect(f.state.jobs[0]).toMatchObject({costStatus:'observed',usage:{inputTokens:0,outputTokens:0,costUsd:0}});});
 it('passes internal job scope to the adapter without changing the reserved model',async()=>{const validateJob=vi.fn(async()=>{});const f=fixture({validateJob});await f.worker.runOnce();expect(validateJob).toHaveBeenCalledTimes(2);const [request,scope]=f.generate.mock.calls[0]!;expect(scope?.companyId).toBe('company-a');expect(scope?.employeeId).toBe('donna');expect(request.model).toBe(scope?.model);expect(f.state.jobs[0]?.status).toBe('completed');});
 it('checks live native authority after reservation and before dispatch, settling zero when it expires',async()=>{const f=fixture({refuseAuthority:true});await f.worker.runOnce();expect(f.chronology.indexOf('reserve_job')).toBeLessThan(f.chronology.indexOf('check_worker_authority'));expect(f.generate).not.toHaveBeenCalled();expect(f.state.jobs[0]?.usage.costUsd).toBe(0);expect(f.state.jobs[0]?.costStatus).toBe('observed');expect(f.state.jobs[0]?.summary).toBe('No provider call dispatched.');expect(f.worker.status().lastError).toContain('authority expired');});
 it('starts disabled and leaves an idle queue without a provider call',async()=>{const f=fixture({jobs:[]});expect(f.worker.status()).toMatchObject({enabled:false,running:false,activeJobId:null});await f.worker.runOnce();expect(f.generate).not.toHaveBeenCalled();expect(f.worker.status().running).toBe(false);});
 it('does not execute manual jobs through the provider dispatcher',async()=>{const f=fixture({jobs:[job({mode:'manual',authorized:false,model:''})]});await f.worker.runOnce();expect(f.generate).not.toHaveBeenCalled();expect(f.state.jobs[0]?.status).toBe('queued');});
 it('reserves before dispatch and settles observed usage with an artifact',async()=>{const f=fixture();await f.worker.runOnce();expect(f.chronology.indexOf('reserve_job')).toBeLessThan(f.chronology.indexOf('generate'));expect(f.generate).toHaveBeenCalledOnce();expect(f.generate.mock.calls[0]?.[0].maxOutputTokens).toBeGreaterThan(0);const completed=f.state.jobs[0]!;expect(completed.status).toBe('completed');expect(completed.costStatus).toBe('observed');expect(completed.usage.costUsd).toBeCloseTo(.0022,8);expect(fs.readFileSync(completed.artifactUri!,'utf8')).toContain('Fixture deliverable');expect(f.worker.status()).toMatchObject({running:false,activeJobId:null,lastError:null});});
 it.each([
  ['unauthorized',{authorized:false}],['unknown prices',{priceRates:{inputUsdPerMillion:null,outputUsdPerMillion:null}}],['zero prices',{priceRates:{inputUsdPerMillion:0,outputUsdPerMillion:0}}],['insufficient tokens',{limits:{maxTokens:10,maxUsd:1,maxMinutes:5}}],['insufficient spend',{limits:{maxTokens:32000,maxUsd:.0000001,maxMinutes:5}}],
 ] as Array<[string,Partial<OfficeJob>]>)('refuses %s before dispatch',async(_label,overrides)=>{const f=fixture({jobs:[job(overrides)]});await f.worker.runOnce();expect(f.generate).not.toHaveBeenCalled();expect(f.calls.some(c=>c.action==='reserve_job')).toBe(false);expect(f.state.jobs[0]?.usage.costUsd).toBe(0);expect(f.worker.status().lastError).toBeTruthy();});
 it('allows local Ollama with zero rates',async()=>{const f=fixture({jobs:[job({provider:'ollama',priceRates:{inputUsdPerMillion:0,outputUsdPerMillion:0}})]});await f.worker.runOnce();expect(f.generate).toHaveBeenCalledOnce();expect(f.state.jobs[0]?.usage.costUsd).toBe(0);});
 it('retains conservative cost after provider failure, without automatic retry',async()=>{const f=fixture({generate:async()=>{throw new Error('Provider failure sk-test-secret-never-real');}});await f.worker.runOnce();expect(f.generate).toHaveBeenCalledOnce();expect(f.state.jobs[0]?.costStatus).toBe('estimated');expect(f.state.jobs[0]?.usage.costUsd).toBe(f.state.jobs[0]?.reservation?.costUsd);expect(f.state.jobs[0]!.usage.costUsd).toBeGreaterThan(0);expect(f.state.jobs[0]?.usage.inputTokens).toBe(f.state.jobs[0]?.reservation?.inputTokens);expect(f.state.jobs[0]?.usage.outputTokens).toBe(f.state.jobs[0]?.reservation?.maxOutputTokens);expect(f.worker.status().lastError).not.toContain('sk-test');await f.worker.runOnce();expect(f.generate).toHaveBeenCalledOnce();});
 it('rejects invalid usage without erasing a dispatch reservation',async()=>{const f=fixture({generate:async()=>({text:'Result',inputTokens:NaN,outputTokens:20})});await f.worker.runOnce();expect(f.state.jobs[0]?.costStatus).toBe('estimated');expect(f.state.jobs[0]?.usage.costUsd).toBe(f.state.jobs[0]?.reservation?.costUsd);});
 it('keeps a reservation when settlement storage is unavailable',async()=>{const f=fixture({refuseFinish:true});await f.worker.runOnce();expect(f.generate).toHaveBeenCalledOnce();expect(f.state.jobs[0]?.costStatus).toBe('reserved');expect(f.state.jobs[0]?.usage.costUsd).toBeGreaterThan(0);expect(f.worker.status().lastError).toContain('storage unavailable');});
 it('accounts conservatively when the dispatcher is stopped mid-request',async()=>{let started!:()=>void;const ready=new Promise<void>(resolve=>{started=resolve;});const f=fixture({generate:async request=>new Promise((_,reject)=>{request.abortSignal?.addEventListener('abort',()=>reject(new Error('Fixture interrupted')),{once:true});started();})});const pending=f.worker.runOnce();await ready;f.worker.stop();await pending;expect(f.generate).toHaveBeenCalledOnce();expect(f.state.jobs[0]?.costStatus).toBe('estimated');expect(f.state.jobs[0]?.usage.costUsd).toBeGreaterThan(0);expect(f.worker.status()).toMatchObject({enabled:false,running:false});});
 it.each(['claim_job','check_worker_authority'] as const)('stopping during awaited %s settles the claim without a provider call',async action=>{
  let entered!:()=>void;let release!:()=>void;
  const ready=new Promise<void>(resolve=>entered=resolve);const barrier=new Promise<void>(resolve=>release=resolve);
  const f=fixture({afterCommand:async request=>{if(request.action===action){entered();await barrier;}}});
  const pending=f.worker.runOnce();await ready;
  expect(f.state.jobs[0]?.status).toBe('running');
  f.worker.setEnabled(false);release();await pending;
  expect(f.generate).not.toHaveBeenCalled();
  expect(f.state.jobs[0]).toMatchObject({status:'failed',costStatus:'observed',usage:{inputTokens:0,outputTokens:0,costUsd:0},summary:'No provider call dispatched.'});
  expect(f.state.jobs[0]?.error).toContain('Office worker stopped');
  expect(f.calls.filter(request=>request.action==='finish_job')).toHaveLength(1);
  expect(f.worker.status()).toMatchObject({enabled:false,running:false,activeJobId:null});
 });
 it('stopping during source preparation closes the claim before reserving or dispatching',async()=>{
  let entered!:()=>void;let release!:()=>void;
  const ready=new Promise<void>(resolve=>entered=resolve);const barrier=new Promise<void>(resolve=>release=resolve);
  const f=fixture({jobs:[job({allowedTools:['github.read_repository']})],prepareContext:async()=>{entered();await barrier;return 'Verified fixture context';}});
  const pending=f.worker.runOnce();await ready;f.worker.stop();release();await pending;
  expect(f.generate).not.toHaveBeenCalled();expect(f.calls.some(request=>request.action==='reserve_job')).toBe(false);
  expect(f.state.jobs[0]).toMatchObject({status:'failed',costStatus:'observed',usage:{inputTokens:0,outputTokens:0,costUsd:0},summary:'No provider call dispatched.'});
  expect(f.state.jobs[0]?.error).toContain('Office worker stopped');
  expect(f.worker.status()).toMatchObject({enabled:false,running:false,activeJobId:null});
  // A deliberate later one-shot remains possible without enabling the pool.
  f.state.jobs.push(job());await f.worker.runOnce();
  expect(f.generate).toHaveBeenCalledOnce();expect(f.state.jobs[1]?.status).toBe('completed');expect(f.worker.status().enabled).toBe(false);
 });
 it('preserves a late provider result and observed cost without publishing after stop',async()=>{
  let entered!:()=>void;let release!:()=>void;
  const ready=new Promise<void>(resolve=>entered=resolve);const barrier=new Promise<void>(resolve=>release=resolve);
  const executeTool=vi.fn(async()=>({summary:'Published',evidenceUrl:'https://example.test/commit'}));
  const f=fixture({jobs:[job({allowedTools:['github.publish_changes']})],executeTool,generate:async()=>{entered();await barrier;return{text:'Late fixture changeset',inputTokens:100,outputTokens:200};}});
  const pending=f.worker.runOnce();await ready;f.worker.stop();release();await pending;
  expect(f.generate).toHaveBeenCalledOnce();expect(executeTool).not.toHaveBeenCalled();
  expect(f.state.jobs[0]).toMatchObject({status:'failed',costStatus:'observed'});expect(f.state.jobs[0]?.usage.costUsd).toBeCloseTo(.0022,8);
  expect(fs.readFileSync(f.state.jobs[0]!.artifactUri!,'utf8')).toContain('Late fixture changeset');
  expect(f.state.jobs[0]?.summary).toContain('Returned work was preserved');
 });
 it('observes cancellation and never revives a cancelled job',async()=>{vi.useFakeTimers();let started!:()=>void;const ready=new Promise<void>(resolve=>{started=resolve;});const f=fixture({generate:async request=>new Promise((_,reject)=>{request.abortSignal?.addEventListener('abort',()=>reject(new Error('Fixture cancelled')),{once:true});started();})});const pending=f.worker.runOnce();await ready;f.state.jobs[0]!.status='cancelled';await vi.advanceTimersByTimeAsync(1001);await pending;expect(f.state.jobs[0]?.status).toBe('cancelled');expect(f.state.jobs[0]?.costStatus).toBe('estimated');expect(f.state.jobs[0]?.usage.costUsd).toBeGreaterThan(0);});
 it('prevents overlapping provider requests',async()=>{let release!:(value:{text:string;inputTokens:number;outputTokens:number})=>void;let started!:()=>void;const ready=new Promise<void>(resolve=>{started=resolve;});const f=fixture({jobs:[job(),job()],generate:async()=>new Promise(resolve=>{release=resolve;started();})});const first=f.worker.runOnce();await ready;expect((await f.worker.runOnce()).running).toBe(true);expect(f.generate).toHaveBeenCalledOnce();release({text:'Complete',inputTokens:1,outputTokens:1});await first;});
});
describe('OfficeWorker exact-context cache',()=>{
 it('reuses an intact artifact without a second provider request',async()=>{const f=fixture({cache:true});await f.worker.runOnce();expect(f.state.cache.entries).toHaveLength(1);f.state.jobs.push(job());await f.worker.runOnce();expect(f.generate).toHaveBeenCalledOnce();expect(f.state.jobs[1]?.usage.costUsd).toBe(0);expect(f.state.jobs[1]?.summary).toContain('No provider request');});
 it.each([['company',{companyId:'company-b'}],['model',{model:'other-model'}],['goal',{goal:'A different task brief.'}],['prompt version',{promptVersion:'test-v2'}]]as Array<[string,Partial<OfficeJob>]>)('invalidates a changed %s',async(_name,overrides)=>{const f=fixture({cache:true});await f.worker.runOnce();f.state.jobs.push(job(overrides));await f.worker.runOnce();expect(f.generate).toHaveBeenCalledTimes(2);});
 it('invalidates changed reviewed company knowledge',async()=>{const f=fixture({cache:true});await f.worker.runOnce();f.state.knowledge.push({id:'k1',companyId:'company-a',title:'New evidence',summary:'Changed source findings',artifactUri:'/fixture/evidence',createdAt:new Date().toISOString()});f.state.jobs.push(job());await f.worker.runOnce();expect(f.generate).toHaveBeenCalledTimes(2);});
 it('rejects a cached artifact outside the managed root',async()=>{const f=fixture({cache:true});await f.worker.runOnce();const outside=path.join(f.root,'outside.md');fs.writeFileSync(outside,'Outside evidence');f.state.cache.entries[0]!.artifactUri=outside;f.state.jobs.push(job());await f.worker.runOnce();expect(f.generate).toHaveBeenCalledTimes(2);});
 it('rejects a cached artifact whose content was changed',async()=>{const f=fixture({cache:true});await f.worker.runOnce();fs.writeFileSync(f.state.cache.entries[0]!.artifactUri,'Tampered evidence');f.state.jobs.push(job());await f.worker.runOnce();expect(f.generate).toHaveBeenCalledTimes(2);});
});

describe('managed source context and bounded parallel workers',()=>{
 it.each(['company','employee'] as const)('uses only company-bound %s conversation context',async scopeKind=>{
  const f=fixture();const current=f.state.jobs[0]!;current.goalId='goal';
  const scope={kind:scopeKind,id:scopeKind==='company'?'company-a':'donna'};
  f.state.goals=[{id:'goal',companyId:'company-a',scope,title:'Scoped task',description:'Use authorized evidence',mode:'execute',status:'running',maxIterations:1,iteration:1,jobIds:[current.id],steps:[],runSettings:{mode:'provider',provider:'anthropic',model:'fixture-model',authorized:true,maxTokens:32000,maxUsd:1,maxMinutes:5,priceRates:current.priceRates},createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()}];
  f.state.chatThreads=[{id:'thread',scope,messages:[{id:'message',role:'assistant',source:'provider',content:'Scoped history fixture must stay in its tenant.',createdAt:new Date().toISOString()}]}];
  await f.worker.runOnce();expect(f.generate).toHaveBeenCalledOnce();
  expect(f.generate.mock.calls[0]?.[0].prompt.includes('Scoped history fixture')).toBe(scopeKind==='company');
  expect(f.state.chatThreads[0]?.messages).toHaveLength(1);
 });
 it('does not spend when an allowed repository read is unavailable',async()=>{const f=fixture({jobs:[job({allowedTools:['github.read_repository']})],prepareContext:async()=>{throw new Error('Repository credential is missing');}});await f.worker.runOnce();expect(f.generate).not.toHaveBeenCalled();expect(f.calls.some(c=>c.action==='reserve_job')).toBe(false);expect(f.state.jobs[0]?.usage.costUsd).toBe(0);});
 it('includes the verified source packet as data only for a granted read',async()=>{const prepared=vi.fn(async()=>JSON.stringify({headSha:'a'.repeat(40),readme:'Fixture source claims'}));const f=fixture({jobs:[job({allowedTools:['github.read_repository']})],prepareContext:prepared});await f.worker.runOnce();expect(prepared).toHaveBeenCalledOnce();expect(f.generate.mock.calls[0]?.[0].prompt).toContain('Fixture source claims');expect(f.generate.mock.calls[0]?.[0].prompt).toContain('untrusted data');});
 it('does not fetch source for an ordinary text-only job',async()=>{const prepared=vi.fn(async()=>'unrequested');const f=fixture({prepareContext:prepared});await f.worker.runOnce();expect(prepared).not.toHaveBeenCalled();expect(f.generate.mock.calls[0]?.[0].prompt).not.toContain('unrequested');});
 it('executes at most two distinct leased jobs in parallel and retains both artifacts',async()=>{let release!:()=>void;let both!:()=>void;const ready=new Promise<void>(r=>both=r);const barrier=new Promise<void>(r=>release=r);let calls=0;const f=fixture({jobs:[job(),job(),job()],generate:async()=>{calls++;if(calls===2)both();await barrier;return{text:'Parallel fixture deliverable',inputTokens:20,outputTokens:20};}});const pool=new OfficeWorkerPool({snapshot:f.snapshot,command:f.command,generate:f.generate,artifactRoot:f.artifactRoot,seedDir:f.seedDir},2);const pending=pool.runOnce();await ready;expect(pool.status().activeJobIds).toHaveLength(2);expect(new Set(pool.status().activeJobIds).size).toBe(2);expect(calls).toBe(2);expect(f.state.jobs[2]?.status).toBe('queued');release();await pending;expect(f.state.jobs.filter(j=>j.status==='completed')).toHaveLength(2);expect(f.state.jobs.filter(j=>j.artifactUri&&fs.existsSync(j.artifactUri))).toHaveLength(2);pool.stop();});
});

describe('company-kit task context in actual worker prompts', () => {
 const binding = (entityType:string,key:string,entityId:string) => ({id:`binding-${entityType}-${key}`,companyId:'company-a',title:`Company kit identity: ${entityType} / ${key}`,summary:JSON.stringify({kind:'daftar-company-kit-binding',schemaVersion:1,companyId:'company-a',kitKey:'social-presence',entityType,key,entityId}),artifactUri:`daftar-kit://company-a/social-presence/binding/${entityType}/${key}`,createdAt:new Date().toISOString()});
 it('includes the exact installed specialty contract despite room metadata flooding, without changing allowed tools',async()=>{
  const f=fixture({jobs:[job({employeeId:'specialist'})]});
  f.state.employees.push({...f.state.employees[0]!,id:'specialist',companyId:'company-a',officeId:'office-a',name:'Editorial producer',role:'Editorial specialist',kind:'specialist',assignmentKey:null});
  f.state.knowledge.push({id:'editorial-contract',companyId:'company-a',title:'Editorial contract',summary:'EXACT_EDITORIAL_CONTRACT: return source-linked variants and verified review state.',artifactUri:'https://example.test/editorial',createdAt:new Date().toISOString()},binding('employee','producer','specialist'),binding('knowledge','prompt-producer','editorial-contract'));
  for(let i=0;i<8;i++)f.state.knowledge.push({id:`source-${i}`,companyId:'company-a',title:`Source ${i}`,summary:`Useful source ${i}`,artifactUri:'https://example.test/source',createdAt:new Date().toISOString()});
  for(let i=0;i<20;i++)f.state.knowledge.push(binding('room',`room-${i}`,`room-id-${i}`));
  await f.worker.runOnce();
  expect(f.generate).toHaveBeenCalledOnce();
  const request=f.generate.mock.calls[0]![0];
  expect(request.prompt).toContain('EXACT_EDITORIAL_CONTRACT');
  expect(request.prompt).toContain('employee-task-contract-data');
  expect(request.prompt).not.toContain('daftar-company-kit-binding');
  expect(request.prompt).not.toContain('Company kit identity:');
  expect(request.prompt).toContain('"allowedActions":[]');
  expect(request.system).toContain('This job produces text; it cannot execute code or publish externally.');
 });
 it('does not invalidate an ordinary worker cache just because internal identity records are added',async()=>{
  const f=fixture({cache:true});await f.worker.runOnce();
  for(let i=0;i<12;i++)f.state.knowledge.push(binding('room',`room-${i}`,`room-id-${i}`));
  f.state.jobs.push(job());await f.worker.runOnce();
  expect(f.generate).toHaveBeenCalledOnce();
 });
});

describe('verified dependency evidence for panel synthesis', () => {
 function handoffs(prompt: string): Array<{ id: string; contentSha256: string | null; excerpt: string | null; excerptBytes: number; artifactBytes: number | null; readingStatus: string; redacted: boolean }> {
  const section = prompt.indexOf('\nDependency handoffs (');
  const start = prompt.indexOf('\n', section + 1) + 1;
  return JSON.parse(prompt.slice(start, prompt.indexOf('\n\nCompany knowledge', start)));
 }
 it('supplies genuine predecessor text beyond its short summary and binds the exact bytes', async () => {
  const predecessor = job({ status: 'completed', summary: 'Short expert summary.' });
  const current = job({ dependencies: [predecessor.id] });
  const f = fixture({ jobs: [predecessor, current] });
  const body = '# Expert evidence\n' + 'Relevant detail. '.repeat(100) + '\nDisagreement: the ownership boundary needs a second acceptance check.';
  const artifact = path.join(f.artifactRoot, 'expert.md');
  fs.writeFileSync(artifact, body);
  f.state.jobs[0]!.artifactUri = artifact;
  await f.worker.runOnce();
  expect(f.generate).toHaveBeenCalledOnce();
  const [evidence] = handoffs(f.generate.mock.calls[0]![0].prompt);
  expect(evidence!.excerpt).toBe(body);
  expect(evidence!.contentSha256).toBe(crypto.createHash('sha256').update(body).digest('hex'));
  expect(evidence!.readingStatus).toBe('complete');
  expect(evidence!.artifactBytes).toBe(Buffer.byteLength(body));
 });
 it('caps each UTF-8 excerpt at 8KiB and all excerpts at 24KiB with truthful coverage', async () => {
  const predecessors = Array.from({ length: 4 }, () => job({ status: 'completed' }));
  const current = job({ dependencies: predecessors.map(j => j.id), limits: { maxTokens: 64000, maxUsd: 1, maxMinutes: 5 } });
  const f = fixture({ jobs: [...predecessors, current] });
  for (let i = 0; i < predecessors.length; i++) {
   const file = path.join(f.artifactRoot, `expert-${i}.md`);
   fs.writeFileSync(file, '😀'.repeat(4000));
   f.state.jobs[i]!.artifactUri = file;
  }
  await f.worker.runOnce();
  expect(f.generate).toHaveBeenCalledOnce();
  const evidence = handoffs(f.generate.mock.calls[0]![0].prompt);
  expect(evidence.reduce((sum, item) => sum + item.excerptBytes, 0)).toBe(24 * 1024);
  expect(evidence.every(item => item.excerptBytes <= 8 * 1024)).toBe(true);
  expect(evidence.slice(0, 3).every(item => item.readingStatus === 'excerpt' && !item.excerpt!.includes('\uFFFD'))).toBe(true);
  expect(evidence[3]).toMatchObject({ readingStatus: 'omitted-budget', excerpt: null, excerptBytes: 0 });
 });
 it.each(['missing', 'other-company', 'unfinished'] as const)('rejects %s predecessor before reserving or dispatching', async mode => {
  const predecessor = job({ status: mode === 'unfinished' ? 'failed' : 'completed', companyId: mode === 'other-company' ? 'company-b' : 'company-a' });
  const current = job({ dependencies: [mode === 'missing' ? 'not-present' : predecessor.id] });
  const f = fixture({ jobs: [predecessor, current] });
  await f.worker.runOnce();
  expect(f.generate).not.toHaveBeenCalled();
  expect(f.calls.some(call => call.action === 'reserve_job')).toBe(false);
  expect(f.state.jobs[1]!.error).toContain('Dependency evidence');
 });
 it.each(['outside', 'symlink', 'hardlink', 'oversize'] as const)('never reads a %s artifact into a model prompt', async mode => {
  const predecessor = job({ status: 'completed' });
  const f = fixture({ jobs: [predecessor, job({ dependencies: [predecessor.id] })] });
  const outside = path.join(f.root, 'private-outside.md');
  const inside = path.join(f.artifactRoot, 'unsafe.md');
  fs.writeFileSync(outside, 'PRIVATE_OUTSIDE_TEXT');
  if (mode === 'symlink') fs.symlinkSync(outside, inside);
  if (mode === 'hardlink') fs.linkSync(outside, inside);
  if (mode === 'oversize') fs.writeFileSync(inside, 'OVERSIZE_TEXT'.padEnd(512001, 'x'));
  f.state.jobs[0]!.artifactUri = mode === 'outside' ? outside : inside;
  await f.worker.runOnce();
  expect(f.generate).toHaveBeenCalledOnce();
  const prompt = f.generate.mock.calls[0]![0].prompt;
  expect(prompt).not.toContain('PRIVATE_OUTSIDE_TEXT');
  expect(prompt).not.toContain('OVERSIZE_TEXT');
  expect(handoffs(prompt)[0]).toMatchObject({ readingStatus: 'unavailable', contentSha256: null, excerpt: null });
 });
 it('redacts credential-shaped text in dependency evidence', async () => {
  const predecessor = job({ status: 'completed' });
  const f = fixture({ jobs: [predecessor, job({ dependencies: [predecessor.id] })] });
  const file = path.join(f.artifactRoot, 'redaction.md');
  fs.writeFileSync(file, 'Synthetic string ghp_FAKEcredentialFixture12345 should be redacted.');
  f.state.jobs[0]!.artifactUri = file;
  await f.worker.runOnce();
  const [evidence] = handoffs(f.generate.mock.calls[0]![0].prompt);
  expect(evidence!.excerpt).toContain('[redacted]');
  expect(evidence!.excerpt).not.toContain('ghp_');
  expect(evidence!.redacted).toBe(true);
 });
 it('invalidates cached synthesis when an omitted artifact tail changes', async () => {
  const predecessor = job({ status: 'completed', summary: 'Unchanged short summary' });
  const f = fixture({ jobs: [predecessor, job({ dependencies: [predecessor.id] })], cache: true });
  const file = path.join(f.artifactRoot, 'long-report.md');
  fs.writeFileSync(file, 'A'.repeat(9000) + 'first tail');
  f.state.jobs[0]!.artifactUri = file;
  await f.worker.runOnce();
  const first = handoffs(f.generate.mock.calls[0]![0].prompt)[0]!;
  fs.writeFileSync(file, 'A'.repeat(9000) + 'changed tail');
  f.state.jobs.push(job({ dependencies: [predecessor.id] }));
  await f.worker.runOnce();
  expect(f.generate).toHaveBeenCalledTimes(2);
  const second = handoffs(f.generate.mock.calls[1]![0].prompt)[0]!;
  expect(first.excerpt).toBe(second.excerpt);
  expect(first.contentSha256).not.toBe(second.contentSha256);
 });
});
