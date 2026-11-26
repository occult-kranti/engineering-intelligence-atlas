'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {PRIMARY_MODEL,MODEL_STORAGE_CEILING,modelSnapshot,validateModelRequest,executionStatus,modelReadiness,developmentReport,employeesForDevelopment,boundedMoECommand,askDevelopmentAction}=require('../src/development');
const digest='a'.repeat(64);
function office(){return {companies:[{id:'a',name:'Game company',repoUrl:'https://github.com/example/game',status:'active'},{id:'b',name:'Other',status:'active'}],offices:[{id:'studio',companyId:'a',status:'active',name:'Studio'}],departments:[{id:'art',officeId:'studio',companyId:'a',status:'active',parentDepartmentId:null}],employees:[{id:'developer',companyId:'a',officeId:'studio',departmentId:'art',name:'Developer',status:'active',kind:'specialist'},{id:'donna',companyId:null,officeId:null,departmentId:null,name:'Donna',status:'active',kind:'assistant'},{id:'foreign',companyId:'b',officeId:null,status:'active'}]};}
function models(){return {companyId:'a',available:true,enabled:true,catalog:[{id:PRIMARY_MODEL,name:'Reviewed MoE',description:'Published artifact, not live hardware.',architecture:'moe',contextLimitTokens:8192,storageCeilingBytes:MODEL_STORAGE_CEILING,artifactApproxBytes:19_000_000_000}],models:[{name:PRIMARY_MODEL,digest,sizeBytes:19_000_000_000,loaded:false}],assignments:[{companyId:'a',employeeId:'developer',model:PRIMARY_MODEL,digest}],requests:[]};}
const task=()=>({employeeId:'developer',officeId:'studio',brief:'Review the supplied map collision invariants.',idempotencyKey:'task-1',digest});

test('model projection is company-bound and omits private endpoints, logs and unrelated assignments',()=>{
  const value=models();Object.assign(value,{endpoint:'http://PRIVATE:11434',rawLog:'PRIVATE'});
  value.assignments.push({companyId:'b',employeeId:'foreign',model:PRIMARY_MODEL,digest});
  value.requests.push({id:'download',companyId:'b',employeeId:'foreign',model:PRIMARY_MODEL,status:'pulling',completedBytes:1,totalBytes:2,error:'PRIVATE'});
  const projected=modelSnapshot(value,'a');assert.equal(projected.assignments.length,1);assert.equal(projected.requests.length,0);assert.equal(projected.catalog[0].artifactApproxBytes,19_000_000_000);assert.equal(projected.models[0].loaded,false);assert.equal(JSON.stringify(projected).includes('PRIVATE'),false);
  assert.throws(()=>modelSnapshot(value,'b'),/different company/);
});
test('model actions reject aliases, clouds, unbounded downloads and caller endpoint overrides',()=>{
  assert.equal(validateModelRequest('pull',{companyId:'a',employeeId:'developer',model:PRIMARY_MODEL,idempotencyKey:'download-1',maxBytes:MODEL_STORAGE_CEILING}).model,PRIMARY_MODEL);
  for(const input of [{model:'qwen3-coder:30b'},{model:'qwen3-coder:Cloud'},{maxBytes:MODEL_STORAGE_CEILING+1},{maxBytes:0},{endpoint:'http://outside'}])assert.throws(()=>validateModelRequest('pull',{companyId:'a',employeeId:'developer',model:PRIMARY_MODEL,idempotencyKey:'download-1',maxBytes:MODEL_STORAGE_CEILING,...input}));
});
test('readiness separates reviewed catalog, installation, load state and worker state',()=>{
  const value=models();assert.equal(modelReadiness(value),'MoE installed; not loaded');value.models[0].loaded=true;assert.equal(modelReadiness(value),'MoE installed and loaded');
  value.models=[];assert.equal(modelReadiness(value),'MoE catalogued; not installed');value.enabled=false;assert.equal(modelReadiness(value),'Local model controller unavailable');
  value.catalog=[];assert.match(modelReadiness(value),/profile unavailable/);
  const status=executionStatus({ok:true,execution:'headless',worker:{enabled:false,running:false,concurrency:2,activeJobIds:['PRIVATE'],lastError:'PRIVATE'},capabilities:{providerJobs:true,secret:'PRIVATE'}},'runtime');
  assert.equal(status.worker.enabled,false);assert.equal(status.providerJobs,true);assert.equal(JSON.stringify(status).includes('PRIVATE'),false);
  assert.throws(()=>executionStatus({ok:true,execution:'headless',worker:{enabled:'yes',running:false}},'runtime'));
});
test('prepared MoE task fixes total budget, model, tools, identity and zero token charge',()=>{
  const command=boundedMoECommand(office(),models(),'a',task());
  assert.deepEqual({provider:command.provider,model:command.model,maxTokens:command.maxTokens,maxUsd:command.maxUsd,maxMinutes:command.maxMinutes,authorized:command.authorized,allowedTools:command.allowedTools},
    {provider:'ollama',model:PRIMARY_MODEL,maxTokens:8000,maxUsd:0,maxMinutes:2,authorized:true,allowedTools:[]});
  assert.equal(command.idempotencyKey,'task-1');assert.equal(command.companyId,'a');assert.equal(command.officeId,'studio');assert.equal(command.departmentId,'art');
  assert.deepEqual(command.priceRates,{inputUsdPerMillion:0,outputUsdPerMillion:0});
  for(const change of [{officeId:'other'},{employeeId:'foreign'},{allowedTools:['github.publish_changes']},{maxTokens:32000},{digest:'b'.repeat(64)}])assert.throws(()=>boundedMoECommand(office(),models(),'a',{...task(),...change}));
});
test('task preparation requires current matching digest and an enabled reviewed backend',()=>{
  for(const mutate of [value=>value.models=[],value=>value.models[0].digest='b'.repeat(64),value=>value.assignments=[],value=>value.assignments[0].companyId='b',value=>value.enabled=false,value=>value.catalog[0].contextLimitTokens=32768]){
    const value=models();mutate(value);assert.throws(()=>boundedMoECommand(office(),value,'a',task()));
  }
});
test('paused ancestor, wrong office and foreign Donna cannot become a development employee',()=>{
  let snapshot=office();assert.deepEqual(employeesForDevelopment(snapshot,'a').map(row=>row.id),['developer','donna']);
  snapshot.departments.push({id:'parent',officeId:'studio',companyId:'a',status:'paused'});snapshot.departments[0].parentDepartmentId='parent';assert.deepEqual(employeesForDevelopment(snapshot,'a').map(row=>row.id),['donna']);
  snapshot=office();snapshot.offices[0].status='paused';assert.throws(()=>boundedMoECommand(snapshot,models(),'a',task()));
  snapshot=office();snapshot.employees[1].companyId='b';assert.equal(employeesForDevelopment(snapshot,'a').some(row=>row.id==='donna'),false);
  snapshot.companies[0].status='paused';assert.throws(()=>employeesForDevelopment(snapshot,'a'));
});
test('task brief is byte-bounded and never silently truncated',()=>{
  assert.equal(boundedMoECommand(office(),models(),'a',{...task(),brief:'x'.repeat(2048)}).goal.length,2048);
  for(const brief of ['', 'x'.repeat(2049),'界'.repeat(683),'bad\u0000brief'])assert.throws(()=>boundedMoECommand(office(),models(),'a',{...task(),brief}));
});
test('readiness report labels unverified GPU and absent Unreal rendering without manufacturing a project',()=>{
  const report=developmentReport({company:office().companies[0],models:models(),status:{worker:{enabled:false,running:false}},inventory:null,connectionKind:'desktop'});
  assert.match(report,/not loaded/);assert.match(report,/workers: paused/);assert.match(report,/not establish measured GPU/);assert.match(report,/NullRHI/);assert.match(report,/separate bills/);assert.match(report,/Connect a configured headless runtime/);
});
test('website picker gates provider work and returns a read-only report',async()=>{
  let choices;
  const result=await askDevelopmentAction({showQuickPick:async items=>{choices=items;return items[0];}},{company:office().companies[0],snapshot:office(),models:null,status:null,connectionKind:'cloud'});
  assert.deepEqual(result,{kind:'report'});assert.equal(choices.some(row=>['task','pull','select','blender','unreal'].includes(row.id)),false);
});
test('task wizard returns a prepared scoped action and aborts on a changed company',async()=>{
  const context={company:office().companies[0],snapshot:office(),models:models(),status:{providerJobs:true,worker:{enabled:false,running:false}},connectionKind:'runtime'};
  const ui={showQuickPick:async items=>items.find(row=>row.id==='task'||row.employee?.id==='developer')||items[0],showInputBox:async()=> 'One bounded task'};
  const action=await askDevelopmentAction(ui,context);assert.equal(action.kind,'task');assert.equal(action.employeeId,'developer');assert.equal(action.digest,digest);assert.equal(action.officeId,'studio');
  await assert.rejects(askDevelopmentAction(ui,context,()=>{throw new Error('workspace changed');}),/workspace changed/);
});
