/** Real JS/Rust bridge and goal lifecycle; injected provider never calls a network. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
import {repoRoot} from './static-build-lib.mjs';
const require=createRequire(import.meta.url);
const {OfficeService}=require('../desktop-shell/dist/main/office.js');
const {OfficeWorker}=require('../desktop-shell/dist/main/officeWorker.js');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'atlas-office-integration-'));
const service=new OfficeService({userDataPath:root,seedDir:path.join(repoRoot,'company'),binaryPath:path.join(repoRoot,'desktop-shell/native/atlas-core')});
const unwrap=r=>{assert.equal(r.ok,true,r.error);assert.ok(r.snapshot);return r.snapshot;};
const action=async r=>unwrap(await service.officeCommand(r));
let calls=0;
const worker=new OfficeWorker({snapshot:()=>service.officeSnapshot(),command:r=>service.workerCommand(r),seedDir:path.join(repoRoot,'company'),artifactRoot:path.join(root,'artifacts'),generate:async request=>{calls++;assert.ok(request.maxOutputTokens>0);return{text:`Fixture deliverable ${calls}. Tested native state, not a live provider.`,inputTokens:100,outputTokens:40};}});
try{
 let state=unwrap(await service.officeSnapshot());const companyId=state.activeCompanyId;
 state=await action({action:'bootstrap_directors',companyId});
 state=await action({action:'configure_policy',approvalMode:'review',hardCapUsd:1,hardCapTokens:1000000,warningPercent:80});
 state=await action({action:'post_chat',scope:{kind:'company',id:companyId},content:'Exercise one retained plan and two bounded iterations.'});
 state=await action({action:'create_goal',scope:{kind:'company',id:companyId},title:'Verify the private workspace lifecycle',mode:'execute',maxIterations:2,runSettings:{mode:'provider',provider:'anthropic',model:'fixture-not-a-provider',authorized:false,maxTokens:100000,maxUsd:1,maxMinutes:30,priceRates:{inputUsdPerMillion:2,outputUsdPerMillion:10},allowedTools:[]}});
 const goalId=state.lastAction.goalId;
 state=await action({action:'plan_goal',goalId});const steps=state.goals.find(g=>g.id===goalId).steps.length;assert.ok(steps>0);
 assert.equal((await service.officeCommand({action:'execute_goal',goalId})).ok,false,'Review mode must reject an unapproved plan');
 state=await action({action:'execute_goal',goalId,reviewed:true});
 for(let i=0;i<steps;i++){const result=await worker.runOnce();assert.equal(result.lastError,null,result.lastError);}
 state=unwrap(await service.officeSnapshot());assert.equal(calls,steps);assert.equal(state.goals.find(g=>g.id===goalId).status,'completed');assert.equal(state.checkpoints.filter(c=>c.goalId===goalId).length,steps);
 await action({action:'configure_policy',approvalMode:'autonomous'});
 for(let i=0;i<steps+2;i++){const result=await worker.runOnce();assert.equal(result.lastError,null,result.lastError);}
 state=unwrap(await service.officeSnapshot());const goal=state.goals.find(g=>g.id===goalId);
 assert.equal(goal.iteration,2);assert.equal(calls,steps*2);assert.equal(state.checkpoints.filter(c=>c.goalId===goalId&&c.jobId).length,steps*2);
 assert.equal(state.jobs.filter(j=>j.status==='completed').length,steps*2);
 assert.ok(state.jobs.every(j=>j.artifactUri&&fs.existsSync(j.artifactUri)));
 assert.ok(state.budget.observedUsd>0&&state.budget.reservedUsd===0);
 assert.ok(state.chatThreads.some(t=>t.messages.some(m=>m.source==='provider')));
 const snapshotAgain=unwrap(await service.officeSnapshot());assert.equal(snapshotAgain.jobs.length,state.jobs.length);
 console.log(JSON.stringify({check:'native-office-lifecycle',ok:true,providerCalls:'0 real / '+calls+' injected',iterations:goal.iteration,checkpoints:state.checkpoints.length,observedFixtureUsd:state.budget.observedUsd,artifactsRetained:true}));
}finally{worker.stop();fs.rmSync(root,{recursive:true,force:true});}
