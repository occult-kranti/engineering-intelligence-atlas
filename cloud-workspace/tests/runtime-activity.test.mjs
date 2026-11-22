import test from 'node:test';
import assert from 'node:assert/strict';
import {validateRuntimeExecution,projectRuntimeExecution} from '../lib/runtime-activity.ts';

const now=Date.parse('2026-11-22T12:00:00Z');
const iso=(delta=0)=>new Date(now+delta).toISOString();
const snapshot=()=>({companies:[{id:'company'}],jobs:[{id:'job',companyId:'company',status:'running',provider:'anthropic',startedAt:iso(-20000),leaseExpiresAt:iso(120000),leaseToken:'PRIVATE',prompt:'PRIVATE'}]});
const sample=()=>({sampledAt:iso(),activeCalls:[{jobId:'job',phase:'provider',startedAt:iso(-10000)}]});
const stored=(execution=sample())=>({clientId:'desktop',receivedAt:iso(),execution,token:'PRIVATE'});

test('runtime sample projects only live call metadata without mutating inputs',()=>{
 const s=snapshot(),v=sample(),before=JSON.stringify([s,v]);
 assert.deepEqual(validateRuntimeExecution(v,s,now),v);
 assert.deepEqual(projectRuntimeExecution(stored(v),s,now),{available:true,execution:v,receivedAt:iso(),reason:null});
 assert.equal(JSON.stringify([s,v]),before);assert.equal(JSON.stringify(projectRuntimeExecution(stored(v),s,now)).includes('PRIVATE'),false);
});
test('loaded definitions and queued or expired jobs do not count as active inference',()=>{
 for(const patch of [{status:'queued'},{status:'completed'},{leaseExpiresAt:iso()},{companyId:'foreign'},{provider:'ollama'},{startedAt:iso(10000)}]){
  const s=snapshot();Object.assign(s.jobs[0],patch);
  assert.throws(()=>validateRuntimeExecution(sample(),s,now));
  assert.deepEqual(projectRuntimeExecution(stored(),s,now).execution.activeCalls,[]);
 }
 const s=snapshot();s.jobs=[];assert.deepEqual(projectRuntimeExecution(stored(),s,now).execution.activeCalls,[]);
});
test('Ollama callback requires model phase and a native live job',()=>{
 const s=snapshot();s.jobs[0].provider='ollama';const v=sample();v.activeCalls[0].phase='model';
 assert.deepEqual(validateRuntimeExecution(v,s,now),v);
 s.jobs[0].provider='anthropic';assert.throws(()=>validateRuntimeExecution(v,s,now));
});
test('fresh empty sample is observed idle; stale or future evidence is unavailable',()=>{
 const v={sampledAt:iso(),activeCalls:[]};assert.equal(projectRuntimeExecution(stored(v),snapshot(),now).available,true);
 for(const delta of [-45001,5001]){const s=stored();s.execution.sampledAt=iso(delta);assert.equal(projectRuntimeExecution(s,snapshot(),now).available,false);assert.throws(()=>validateRuntimeExecution(s.execution,snapshot(),now));}
 const expired=stored();expired.receivedAt=iso(-45001);assert.equal(projectRuntimeExecution(expired,snapshot(),now).available,false);
 for(const clock of [NaN,Infinity,-1,1.5])assert.equal(projectRuntimeExecution(stored(),snapshot(),clock).available,false);
});
test('calendar rollover, malformed evidence, duplicate identities and excess calls fail closed',()=>{
 for(const timestamp of ['2026-02-29T12:00:00Z','2026-04-31T12:00:00Z','2026-11-22','2026-11-22T24:00:00Z','2026-11-22T12:00:60Z']){
  const v=sample();v.sampledAt=timestamp;assert.throws(()=>validateRuntimeExecution(v,snapshot(),now));
 }
 for(const mutate of [v=>v.token='PRIVATE',v=>v.activeCalls[0].token='PRIVATE',v=>v.activeCalls.push({...v.activeCalls[0]}),v=>v.activeCalls[0].jobId='../job',v=>v.activeCalls[0].phase='gpu',v=>v.activeCalls[0].startedAt=iso(6000),v=>v.activeCalls=Array(9).fill(v.activeCalls[0])]){
  const v=sample();mutate(v);assert.throws(()=>validateRuntimeExecution(v,snapshot(),now));
 }
 const s=snapshot();s.jobs.push({...s.jobs[0]});assert.throws(()=>validateRuntimeExecution(sample(),s,now));assert.equal(projectRuntimeExecution(stored(),s,now).available,false);
 const huge=snapshot();huge.jobs=Array(5001).fill(huge.jobs[0]);assert.equal(projectRuntimeExecution(stored(),huge,now).available,false);
});
test('new attempt cannot inherit previous callback activity and finished calls disappear on read',()=>{
 const s=snapshot();s.jobs[0].startedAt=iso(-1000);
 assert.deepEqual(projectRuntimeExecution(stored(),s,now).execution.activeCalls,[]);
 const v=sample();v.activeCalls[0].startedAt=iso(-500);assert.equal(projectRuntimeExecution(stored(v),s,now).execution.activeCalls.length,1);
 s.jobs[0].status='failed';assert.deepEqual(projectRuntimeExecution(stored(v),s,now).execution.activeCalls,[]);
});
