import { afterEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import { ImprovementWorker, createImprovementRouteDiscovery, combineWorkerExecution, type ImprovementSessionRecord } from '../src/main/improvementWorker';
import type { OfficeWorkerOptions, OfficeWorker } from '../src/main/officeWorker';
import type { OfficeResult } from '../src/shared/office';
const roots:string[]=[];const controllers:ImprovementWorker[]=[];
const route={provider:'anthropic' as const,model:'fixture-model'};
function fixture({status='active',run=async()=>{},snapshotGate=async()=>{}}:{status?:string;run?:()=>Promise<void>;snapshotGate?:()=>Promise<void>}={}) {
 vi.useFakeTimers();vi.setSystemTime(new Date('2026-11-22T12:00:00Z'));
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'daftar-improve-'));roots.push(root);const catalog=path.join(root,'prices.json');
 fs.writeFileSync(catalog,JSON.stringify({schemaVersion:1,observedAt:'2026-11-22T00:00:00Z',expiresAt:'2026-12-22T00:00:00Z',routes:[{...route,source:'https://example.test/prices',tiers:[{maxInputTokens:100000,inputUsdPerMillion:0.1,outputUsdPerMillion:0.5}]}]}));
 const session={id:'session-a',revision:0,status,companyId:'company',officeId:'office',departmentId:null,primaryEmployeeId:'producer',reviewerEmployeeId:'helper',serviceContractId:null,reviewerServiceContractId:null,allowedRoutes:[route],runSettings:{maxTokens:8000},activeGoalId:null,cycle:0} as ImprovementSessionRecord;
 const state:any={schemaVersion:3,jobs:[],improvementSessions:[session],policy:{dispatchPaused:false}};
 const snapshot=vi.fn(async()=>{await snapshotGate();return{ok:true,snapshot:structuredClone(state)} as OfficeResult;});
 const command=vi.fn(async()=>({ok:true,snapshot:structuredClone(state)}) as OfficeResult);
 const stop=vi.fn();const generate=vi.fn();const eligible=vi.fn(async()=>[route]);
 const runOnce=vi.fn(async()=>{await run();return{} as ReturnType<OfficeWorker['status']>;});
 const workerStatus=()=>({enabled:false,running:false,activeJobId:null,lastError:null,scheduling:[{lastOutcome:'idle'}],execution:{sampledAt:new Date().toISOString(),activeCalls:[]}}) as ReturnType<OfficeWorker['status']>;
 const createWorker=vi.fn(()=>({runOnce,stop,status:workerStatus}));
 const controller=new ImprovementWorker({snapshot,command,priceCatalogPath:catalog,eligibleRoutes:eligible,intervalMs:5000,
  workerOptions:{snapshot,command,generate,artifactRoot:root,seedDir:root} as OfficeWorkerOptions,createWorker});controllers.push(controller);
 return{controller,state,session,snapshot,command,stop,generate,eligible,createWorker,runOnce};
}
afterEach(()=>{for(const c of controllers.splice(0))c.close();vi.useRealTimers();for(const root of roots.splice(0))fs.rmSync(root,{recursive:true,force:true});});
describe('durable improvement scheduling adapter',()=>{
 it('leaves paused sessions and ordinary jobs untouched; explicit resume wakes scoped work',async()=>{
  const f=fixture({status:'paused'});f.state.jobs.push({id:'ordinary',status:'queued'});f.controller.start();await vi.advanceTimersByTimeAsync(0);
  expect(f.command).not.toHaveBeenCalled();expect(f.eligible).not.toHaveBeenCalled();expect(f.createWorker).not.toHaveBeenCalled();
  f.session.status='active';f.controller.wake();await vi.advanceTimersByTimeAsync(0);
  expect(f.command).toHaveBeenCalledWith(expect.objectContaining({action:'tick_improvements',sessionId:'session-a',selectedRoute:expect.objectContaining(route)}));
  expect(f.createWorker.mock.calls[0]?.[0]).toMatchObject({improvementSessionId:'session-a'});
  expect(f.state.jobs).toEqual([{id:'ordinary',status:'queued'}]);expect(f.generate).not.toHaveBeenCalled();
 });
 it('coalesces wake requests during an in-flight read and does not overlap worker attempts',async()=>{
  let release!:()=>void;const gate=new Promise<void>(resolve=>release=resolve);
  const f=fixture({run:()=>gate});f.controller.start();await vi.advanceTimersByTimeAsync(0);
  for(let n=0;n<100;n++){f.controller.start();f.controller.wake();}
  await vi.advanceTimersByTimeAsync(600000);expect(f.runOnce).toHaveBeenCalledOnce();expect(vi.getTimerCount()).toBe(0);
  f.session.status='paused';release();await vi.advanceTimersByTimeAsync(0);await vi.advanceTimersByTimeAsync(0);
  expect(f.runOnce).toHaveBeenCalledOnce();expect(vi.getTimerCount()).toBe(1);
 });
 it('aborts the matching session on pause and does not restart a late completion',async()=>{
  let release!:()=>void;const gate=new Promise<void>(resolve=>release=resolve);const f=fixture({run:()=>gate});
  f.controller.start();await vi.advanceTimersByTimeAsync(0);f.session.status='paused';
  f.controller.wake({action:'control_improvement_session',sessionId:'session-a',operation:'pause'} as never);
  expect(f.stop).toHaveBeenCalled();release();await vi.advanceTimersByTimeAsync(0);await vi.advanceTimersByTimeAsync(300000);
  expect(f.runOnce).toHaveBeenCalledOnce();expect(f.state.jobs).toEqual([]);
 });
 it('backs off idle native reads with one unref timer and never spins no-op model calls',async()=>{
  const f=fixture({status:'waiting-work'});f.eligible.mockResolvedValue([]);f.controller.start();await vi.advanceTimersByTimeAsync(0);
  for(const delay of [5000,10000,20000,40000,80000,120000]) {
   expect(f.controller.status().nextPollAt).toBe(Date.now()+delay);expect(vi.getTimerCount()).toBe(1);await vi.advanceTimersByTimeAsync(delay);
  }
  expect(f.command).not.toHaveBeenCalled();expect(f.generate).not.toHaveBeenCalled();expect(f.controller.status().blockedReason).toBe('no-current-eligible-priced-route');
 });
 it('backs off pre-dispatch native contention with visible state and no billable or mutating request',async()=>{
  const f=fixture();f.snapshot.mockResolvedValue({ok:false,snapshot:null,code:'STATE_BUSY',error:'Synthetic native lock contention'} as OfficeResult);
  f.controller.start();await vi.advanceTimersByTimeAsync(0);
  expect(f.controller.status()).toMatchObject({lastOutcome:'error',blockedReason:'improvement-state-needs-review',errorPolls:1,nextPollAt:Date.now()+5000});
  expect(f.command).not.toHaveBeenCalled();expect(f.generate).not.toHaveBeenCalled();expect(f.createWorker).not.toHaveBeenCalled();expect(vi.getTimerCount()).toBe(1);
  await vi.advanceTimersByTimeAsync(5000);
  expect(f.controller.status()).toMatchObject({lastOutcome:'error',errorPolls:2,nextPollAt:Date.now()+10000});
  expect(f.snapshot).toHaveBeenCalledTimes(2);expect(f.command).not.toHaveBeenCalled();expect(f.generate).not.toHaveBeenCalled();expect(vi.getTimerCount()).toBe(1);
 });
 it('disposes pending reads and never re-arms after close',async()=>{
  let release!:()=>void;const gate=new Promise<void>(resolve=>release=resolve);const f=fixture({snapshotGate:()=>gate});
  f.controller.start();f.controller.close();release();await vi.advanceTimersByTimeAsync(0);
  expect(f.command).not.toHaveBeenCalled();expect(f.createWorker).not.toHaveBeenCalled();expect(vi.getTimerCount()).toBe(0);
 });
 it('aggregates only actual calls without enabling the ordinary pool',()=>{
  const sampledAt=new Date().toISOString(),call={jobId:'primary',phase:'provider' as const,startedAt:sampledAt};
  const result=combineWorkerExecution({enabled:false,running:false,execution:{sampledAt,activeCalls:[]}}, {enabled:false,running:true,activeJobId:'primary',execution:{sampledAt,activeCalls:[call]}} as ReturnType<OfficeWorker['status']>);
  expect(result.enabled).toBe(false);expect(result.execution.activeCalls).toEqual([call]);expect(result.running).toBe(true);
 });
});
describe('bounded model discovery',()=>{
 it('coalesces discovery, invalidates changed credentials and never enlarges frozen candidates',async()=>{
  vi.useFakeTimers();let identity='first';const discover=vi.fn(async()=>[{id:route.model},{id:'not-allowed'}]);
  const discovery=createImprovementRouteDiscovery({credentialFingerprint:()=>identity,discover,localEligible:async()=>false});
  const session={allowedRoutes:[route]} as ImprovementSessionRecord;const signal=new AbortController().signal;
  const answers=await Promise.all(Array.from({length:100},()=>discovery.eligibleRoutes(session,signal)));
  expect(discover).toHaveBeenCalledOnce();expect(answers.every(rows=>rows.length===1&&rows[0]!.model===route.model)).toBe(true);
  identity='changed';await discovery.eligibleRoutes(session,signal);expect(discover).toHaveBeenCalledTimes(2);
  identity='';expect(await discovery.eligibleRoutes(session,signal)).toEqual([]);discovery.close();expect(vi.getTimerCount()).toBe(0);
 });
 it('backs off failed discovery without inferring an available or free model',async()=>{
  vi.useFakeTimers();const discover=vi.fn(async()=>{throw new Error('unavailable');});
  const discovery=createImprovementRouteDiscovery({credentialFingerprint:()=> 'configured',discover,localEligible:async()=>false});
  const session={allowedRoutes:[route]} as ImprovementSessionRecord,signal=new AbortController().signal;
  expect(await discovery.eligibleRoutes(session,signal)).toEqual([]);expect(await discovery.eligibleRoutes(session,signal)).toEqual([]);
  expect(discover).toHaveBeenCalledOnce();await vi.advanceTimersByTimeAsync(30001);await discovery.eligibleRoutes(session,signal);expect(discover).toHaveBeenCalledTimes(2);discovery.close();
 });
});
