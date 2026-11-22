import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRuntime } from '../runtime.mjs';
import { startServer } from '../server.mjs';
import { createRuntimeClient, createToolHandler } from '../../tools/daftar-runtime-mcp.mjs';
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const digest = 'a'.repeat(64), token = 'synthetic_managed_wiring_012345678901234567890';
async function fixture(t) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'daftar-managed-wiring-')); let generated = 0, fetched = 0;
  const runtime = createRuntime({ repoRoot, dataDir, ollamaLocalOnly: true,
    modelFetch: async url => { fetched++; if(String(url).endsWith('/api/show')) return new Response(JSON.stringify({model_info:{architecture:'qwen3'}}),{headers:{'content-type':'application/json'}}); if(String(url).endsWith('/api/ps')) return new Response(JSON.stringify({models:[]}),{headers:{'content-type':'application/json'}}); assert.ok(String(url).endsWith('/api/tags')); return new Response(JSON.stringify({models:[{name:'qwen3:4b',model:'qwen3:4b',size:2500000000,digest,details:{parameter_size:'4B',quantization_level:'Q4_K_M'}}]}),{headers:{'content-type':'application/json'}}); },
    generate: async request => { generated++; return { text: request.system.includes('distinct helper and reviewer')
      ? JSON.stringify({ verdict: 'accepted', summary: 'The complete synthetic result satisfies the integration task.', evidenceRefs: ['synthetic-artifact-check'] })
      : 'Synthetic expert result', model: request.model, inputTokens: 10, outputTokens: 10, totalTokens: 20, estimated: false, finishReason: 'stop', latencyMs: 1 }; },
    workbenchPlatform: { fetch: async () => { throw new Error('External transport forbidden'); } },
  });
  const service = await startServer({runtime,token,port:0}); const origin=`http://127.0.0.1:${service.server.address().port}`;
  t.after(async()=>{await service.close();fs.rmSync(dataDir,{recursive:true,force:true});});
  const native = async command => { const r=await runtime.office.officeCommand(command); assert.equal(r.ok,true,r.error); return r.snapshot; };
  const created=await native({action:'create_company',id:'managed-fixture',name:'Managed fixture'}); const company=created.companies.find(x=>x.id==='managed-fixture');
  const office=created.offices.find(x=>x.companyId===company.id && x.status==='active');
  const hired=await native({action:'hire_employee',companyId:company.id,officeId:office.id,name:'Expert',role:'Cloud Compute Operator',skillPaths:[]});
  const employeeId=hired.lastAction.employeeId;
  const request=async(route,body,authenticated=true)=>{const r=await fetch(origin+route,{method:body===undefined?'GET':'POST',headers:{...(authenticated?{Authorization:`Bearer ${token}`} : {}),...(body===undefined?{}:{'content-type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)})});return {status:r.status,value:await r.json()};};
  const mcp=createToolHandler({request:createRuntimeClient({origin,token})});
  return {runtime,native,company,office,employeeId,request,mcp,generated:()=>generated,fetched:()=>fetched};
}
test('new workbench, HTTP and MCP routes share owner authentication and one resource policy',async t=>{
  const f=await fixture(t);
  for(const route of ['/v1/resources','/v1/environments']) assert.equal((await f.request(route,undefined,false)).status,401);
  const capabilities=f.runtime.workbench.capabilities().methods;
  for(const name of ['resourceConfigure','resourcePlan','resourceStart','environmentPrepare','environmentRun']) assert.equal(capabilities[name].available,true,name);
  assert.equal((await f.mcp('environment_status',{})).environments.items.length,0);
  assert.equal((await f.mcp('resource_status',{})).resources.capabilities.enforcementEnabled,false);
  await f.mcp('resource_configure',{expectedRevision:0,resources:[],grants:[],routes:[]});
  const input={companyId:f.company.id,employeeId:f.employeeId,model:'qwen3:4b'};
  assert.equal((await f.request('/v1/models/select',input)).status,403);
  const wb=await f.request('/v1/workbench/call',{id:'blocked-old-path',method:'modelPoolSelect',args:[input]});assert.equal(wb.status,403);
  await assert.rejects(f.mcp('model_pool_select',input));assert.equal(f.fetched(),0);
  await assert.rejects(f.runtime.resources.validateJob({id:'old-job',provider:'ollama',...input}),error=>error.code==='RESOURCE_GRANT_REQUIRED');
  assert.equal(f.generated(),0);
  await assert.rejects(f.mcp('environment_run',{id:'no-env',...input,environmentId:'missing',command:'print(1)',cwd:'/tmp'}));
});
test('a real native expert DAG runs once with provenance and retains grants across all adapters',async t=>{
  const f=await fixture(t);const employees=[f.company.assistantId,f.employeeId];
  for(const employeeId of employees) await f.runtime.modelOperation('select',{companyId:f.company.id,employeeId,model:'qwen3:4b'});
  const resource={id:'fixture-model',companyId:f.company.id,ownerScope:{kind:'company',id:f.company.id},model:'qwen3:4b',digest};
  const grants=employees.map((id,index)=>({id:`grant-${index}`,resourceId:resource.id,targetScope:{kind:'employee',id},permissions:['use','assign','inspect']}));
  const route={id:'fixture-route',companyId:f.company.id,strategy:'ensemble',experts:employees.map(employeeId=>({employeeId,resourceId:resource.id,officeId:f.office.id,departmentId:null})),limits:{maxTokens:64000,maxMinutes:2,maxParallel:1}};
  await f.runtime.resourceOperation('configure',{expectedRevision:0,resources:[resource],grants,routes:[route]});
  const plan=(await f.mcp('resource_plan',{id:'plan-once',companyId:f.company.id,employeeId:f.company.assistantId,routeId:route.id,task:'Produce a synthetic integration report.'})).plan;
  const input={id:'run-once',planId:plan.id,expectedPlanHash:plan.planHash};
  const run=await f.mcp('resource_start',input);assert.equal(run.run.status,'queued');assert.equal(run.run.steps.length,2);
  assert.ok(plan.steps.every(step => step.reviewerEmployeeId && step.reviewerEmployeeId !== step.employeeId));
  const queued=(await f.runtime.snapshot()).snapshot.jobs;
  assert.equal(queued.length,4);assert.equal(new Set(queued.map(job=>job.id)).size,4);
  assert.deepEqual(queued.find(job=>job.id===run.run.steps[1].jobId).dependencies,[run.run.steps[0].reviewJobId]);
  assert.ok(queued.reduce((sum,job)=>sum+job.limits.maxTokens,0)<=route.limits.maxTokens);
  assert.ok(queued.reduce((sum,job)=>sum+job.limits.maxMinutes,0)<=route.limits.maxMinutes);
  await f.runtime.worker.runOnce();
  const pending=await f.mcp('resource_inspect',{id:input.id});assert.notEqual(pending.run.status,'completed');assert.equal(pending.run.steps[0].status,'awaiting-review');
  for(let index=0;index<3;index++)await f.runtime.worker.runOnce();
  const inspected=await f.mcp('resource_inspect',{id:input.id});assert.equal(inspected.run.status,'completed');assert.equal(f.generated(),4);
  assert.equal((await f.mcp('resource_start',input)).replayed,true);assert.equal(f.generated(),4);
  assert.equal((await f.runtime.snapshot()).snapshot.jobs.length,4);
  assert.ok(inspected.run.steps.every(step=>step.artifactUri&&step.reviewArtifactUri&&step.reviewVerdict==='accepted'));
  assert.equal(f.runtime.worker.status().enabled,false);
  await f.runtime.resourceOperation('configure',{expectedRevision:1,resources:[resource],grants:[],routes:[route]});
  await assert.rejects(f.runtime.modelOperation('select',{companyId:f.company.id,employeeId:f.employeeId,model:'qwen3:4b'}),error=>error.code==='RESOURCE_GRANT_REQUIRED');
});
test('an uncertain first resource configuration fences legacy routes before any model dispatch',async t=>{
  for(const committed of [false,true]){
    const f=await fixture(t);const original=fs.renameSync;
    fs.renameSync=(source,destination)=>{
      if(path.basename(path.dirname(destination))!=='model-resources' || path.basename(destination)!=='registry.json')return original(source,destination);
      if(committed)original(source,destination);throw Object.assign(new Error('Synthetic uncertain write'),{code:'EIO'});
    };
    try{await assert.rejects(f.runtime.resourceOperation('configure',{expectedRevision:0,resources:[],grants:[],routes:[]}),error=>error.code==='RESOURCE_STATE_UNCERTAIN');}finally{fs.renameSync=original;}
    assert.throws(()=>f.runtime.resources.isEnforced(),error=>error.code==='RESOURCE_STATE_UNCERTAIN');
    const input={companyId:f.company.id,employeeId:f.employeeId,model:'qwen3:4b'};
    const direct=await f.request('/v1/models/select',input);assert.equal(direct.status,503);assert.equal(direct.value.code,'RESOURCE_STATE_UNCERTAIN');
    const mediated=await f.request('/v1/workbench/call',{id:'fenced-model',method:'modelPoolSelect',args:[input]});assert.equal(mediated.status,503);
    await assert.rejects(f.runtime.resources.validateJob({id:'blocked-worker',provider:'ollama',...input}));assert.equal(f.fetched(),0);assert.equal(f.generated(),0);
  }
});
