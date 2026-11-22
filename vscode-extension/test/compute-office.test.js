'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {createComputeOffice,configurationFromStatus,OPERATOR_ROLE,OPERATOR_SKILLS,OPERATIONS_ROLES}=require('../src/compute-office');
const office={companies:[{id:'c1',name:'Company',status:'active',assistantId:'e1'}],offices:[{id:'o1',companyId:'c1',name:'Office',status:'active'}],departments:[{id:'d1',companyId:'c1',officeId:'o1',name:'Engineering',status:'active'}],employees:[{id:'e1',companyId:'c1',officeId:'o1',departmentId:'d1',name:'Donna',role:'Company assistant',status:'active'}]};
const resource={id:'r1',companyId:'c1',ownerScope:{kind:'company',id:'c1'},model:'model:1',digest:'a'.repeat(64)};
const registry={ok:true,resources:{revision:7,resources:[resource],grants:[{id:'g1',resourceId:'r1',targetScope:{kind:'employee',id:'e1'},permissions:['use'],includeDescendants:false,membershipRevision:2,coveredScopeCount:1,membershipHash:'b'.repeat(64),coveredScopes:[{kind:'employee',id:'e1'}]}],routes:[],officeParents:[]}};
function harness({choices=[],inputs=[],state=office,responses={}}={}){
  const calls=[],messages=[],warnings=[],pickers=[],inputPrompts=[];
  const vscode={window:{
    async showQuickPick(items,options){pickers.push({items:structuredClone(items),options:structuredClone(options)});const selected=choices.shift();if(selected===undefined)return undefined;if(Array.isArray(selected))return selected.map(id=>items.find(item=>item.id===id));const item=items.find(item=>item.id===selected);assert.ok(item,`Missing choice ${selected}`);return item;},
    async showInputBox(options){inputPrompts.push(options);return inputs.shift();},async showOpenDialog(){return undefined;},async showInformationMessage(message){messages.push(message);},async showWarningMessage(message){warnings.push(message);}
  },workspace:{fs:{readFile:async()=>Buffer.from('print(1)')}}};
  const compute=createComputeOffice({vscode,snapshot:async()=>structuredClone(state),notify:async message=>messages.push(message),call:async(method,args)=>{calls.push({method,args:structuredClone(args)});const value=responses[method];if(value instanceof Error)throw value;return typeof value==='function'?value(args):structuredClone(value??{ok:true});}});
  return{compute,calls,messages,warnings,pickers,inputPrompts,vscode};
}
test('cancelling the compute menu performs no operation',async()=>{const h=harness();assert.equal((await h.compute.menu()).cancelled,true);assert.equal(h.calls.length,0);});
test('host grants preserve the read revision and never submit work implicitly',async()=>{
  const h=harness({choices:['host-policy','auto','c1','employee','e1'],responses:{hostStatus:{ok:true,host:{revision:8,mode:'off',grants:[{id:'prior',companyId:'other',employeeId:null,publicNote:'strip'}]}}}});
  await h.compute.menu();assert.deepEqual(h.calls.map(row=>row.method),['hostStatus','hostConfigure']);const body=h.calls[1].args[0];assert.equal(body.expectedRevision,8);assert.equal(body.mode,'auto');assert.deepEqual(body.grants[0],{id:'prior',companyId:'other',employeeId:null});assert.equal(body.grants[1].employeeId,'e1');
});
test('public resource grant projections are stripped before complete CAS updates',async()=>{
  const config=configurationFromStatus(registry);assert.equal(config.expectedRevision,7);assert.ok(!('coveredScopeCount'in config.grants[0]));assert.ok(!('membershipHash'in config.grants[0]));assert.ok(!('coveredScopes'in config.grants[0]));assert.equal(config.grants[0].membershipRevision,2);
  const h=harness({choices:['model-share','r1','c1','department','d1',['use','inspect'],'exact'],responses:{resourceStatus:registry}});
  await h.compute.menu();const body=h.calls.find(row=>row.method==='resourceConfigure').args[0];assert.equal(body.expectedRevision,7);assert.equal(body.resources[0].digest,'a'.repeat(64));assert.deepEqual(body.grants[1].targetScope,{kind:'department',id:'d1'});assert.deepEqual(body.grants[1].permissions,['use','inspect']);assert.equal(body.grants[1].includeDescendants,false);
});
test('planning expert work does not start inference or claim model training',async()=>{
  const status=structuredClone(registry);status.resources.routes=[{id:'route1',companyId:'c1',strategy:'ensemble',experts:[{employeeId:'e1',resourceId:'r1',officeId:'o1',departmentId:'d1'}]}];
  const h=harness({choices:['route-plan','c1','e1','route1'],inputs:['Review the implementation'],responses:{resourceStatus:status,resourcePlan:{ok:true,id:'plan1',plan:{planHash:'c'.repeat(64)}}}});
  await h.compute.menu();assert.deepEqual(h.calls.map(row=>row.method),['resourceStatus','resourcePlan']);assert.match(h.messages[0],/Start is a separate action/);assert.ok(!h.messages.some(message=>/trained.*success|weights.*created/i.test(message)));
});
test('operator reuses an existing exact role and new hires reference two existing skills',async()=>{
  const state=structuredClone(office);state.employees[0].role=OPERATOR_ROLE;
  const reuse=harness({choices:['c1'],state});assert.equal((await reuse.compute.hireOperator()).reused,true);assert.equal(reuse.calls.length,0);
  const fresh=harness({choices:['c1']});await fresh.compute.hireOperator();const body=fresh.calls[0].args[0];assert.equal(body.action,'hire_employee');assert.equal(body.role,OPERATOR_ROLE);assert.deepEqual(body.skillPaths,[...OPERATOR_SKILLS]);
  assert.equal(fresh.messages.length,1);assert.equal(typeof fresh.messages[0],'string');assert.ok(!fresh.messages[0].includes('undefined'));
});
test('workload intake records only observed GPUs and explicit bounded requirements in company chat',async()=>{
  const h=harness({choices:['requirements','c1','render'],inputs:['8','16','100'],responses:{getSystemInfo:{platform:'linux',arch:'x64',gpus:[{name:'Observed GPU',memoryMB:8192}]}}});
  const result=await h.compute.menu();assert.equal(result.requirements.minimum.gpuMemoryGiB,8);assert.equal(result.requirements.observed.gpus[0].name,'Observed GPU');assert.deepEqual(h.calls.map(row=>row.method),['getSystemInfo','officeCommand']);assert.equal(h.calls[1].args[0].action,'post_chat');assert.deepEqual(h.calls[1].args[0].scope,{kind:'company',id:'c1'});
});
test('cancelled intake and file picker never submit environment or office mutations',async()=>{
  const intake=harness({choices:['requirements','c1','coding'],inputs:['0',undefined],responses:{getSystemInfo:{platform:'linux'}}});assert.equal((await intake.compute.menu()).cancelled,true);assert.deepEqual(intake.calls.map(row=>row.method),['getSystemInfo']);
  const python=harness({choices:['env-run','env1'],responses:{environmentStatus:{ok:true,environments:{items:[{id:'env1',state:'ready',companyId:'c1',stewardEmployeeId:'e1'}]}}}});assert.equal((await python.compute.menu()).cancelled,true);assert.deepEqual(python.calls.map(row=>row.method),['environmentStatus']);
});
test('unsupported capability reports its real failure without retrying or fabricating readiness',async()=>{
  const h=harness({choices:['host-policy'],responses:{hostStatus:new Error('Host control is unavailable on this connection.')}});const result=await h.compute.menu();assert.equal(result.ok,false);assert.equal(h.calls.length,1);assert.match(h.warnings[0],/unavailable/);
});

test('God mode uses the exact sorted current active membership and performs no hidden work',async()=>{
  const state=structuredClone(office);state.companies=[{id:'z-company',name:'Zed',status:'active'},{id:'archived',name:'Archived',status:'archived'},{id:'a-company',name:'Alpha',status:'active'}];
  const h=harness({choices:['god-mode','enable'],state,responses:{hostStatus:{ok:true,host:{revision:12,mode:'manual'}}}});
  await h.compute.menu();
  assert.deepEqual(h.calls,[{method:'hostStatus',args:[]},{method:'hostGodMode',args:[{expectedRevision:12,enabled:true,companyIds:['a-company','z-company']}]}]);
  const membership=h.pickers[1].items.find(row=>row.id==='enable');assert.match(membership.detail,/Alpha \(a-company\).*Zed \(z-company\)/);assert.ok(!membership.detail.includes('Archived'));
  assert.match(h.messages[0],/No jobs were started/);
});
test('God mode disable uses an empty membership and cancellation sends no policy mutation',async()=>{
  const responses={hostStatus:{ok:true,host:{revision:0,mode:'auto'}}};
  const disabled=harness({choices:['god-mode','disable'],responses});await disabled.compute.menu();assert.deepEqual(disabled.calls[1],{method:'hostGodMode',args:[{expectedRevision:0,enabled:false,companyIds:[]}]});
  const aborted=harness({choices:['god-mode'],responses});assert.equal((await aborted.compute.menu()).cancelled,true);assert.deepEqual(aborted.calls.map(row=>row.method),['hostStatus']);
});
test('stale or rejected God mode policy is never refreshed or retried automatically',async()=>{
  for(const failure of [{ok:false,code:'HOST_POLICY_CONFLICT',error:'Stale policy revision'},new Error('Owner host control is unavailable')]){
    const h=harness({choices:['god-mode','enable'],responses:{hostStatus:{ok:true,host:{revision:6}},hostGodMode:failure}});
    assert.equal((await h.compute.menu()).ok,false);assert.deepEqual(h.calls.map(row=>row.method),['hostStatus','hostGodMode']);assert.equal(h.calls[1].args[0].expectedRevision,6);assert.equal(h.messages.length,0);assert.equal(h.warnings.length,1);
  }
});
test('invalid God mode membership fails before configuration and an empty company set offers disable only',async()=>{
  const state=structuredClone(office);state.companies.push(structuredClone(state.companies[0]));
  const duplicated=harness({choices:['god-mode'],state,responses:{hostStatus:{ok:true,host:{revision:1}}}});assert.equal((await duplicated.compute.menu()).ok,false);assert.deepEqual(duplicated.calls.map(row=>row.method),['hostStatus']);
  state.companies=[];const empty=harness({choices:['god-mode','disable'],state,responses:{hostStatus:{ok:true,host:{revision:1}}}});await empty.compute.menu();assert.deepEqual(empty.pickers[1].items.map(row=>row.id),['disable']);
});
test('prominent stop action sends one stop-all request without starting or changing paid work',async()=>{
  const h=harness({choices:['stop-host']});await h.compute.menu();assert.deepEqual(h.calls,[{method:'hostStopAll',args:[]}]);assert.match(h.messages[0],/Inspect receipts for final state/);assert.ok(h.pickers[0].items.findIndex(row=>row.id==='stop-host')<3);
});
test('all permanent operations roles use actual bundled skills and reuse non-fired staff',async()=>{
  const repo=path.resolve(__dirname,'../..');const briefs=JSON.parse(fs.readFileSync(path.join(repo,'company/skill-briefs.json'),'utf8'));
  for(const role of OPERATIONS_ROLES){
    for(const skill of role.skills){assert.equal(fs.existsSync(path.join(repo,skill)),true,skill);assert.ok(briefs.some(row=>row.path===skill),skill);}
    const fresh=harness({choices:['hire-operations',role.id,'c1']});await fresh.compute.menu();assert.deepEqual(fresh.calls.map(row=>row.method),['officeCommand']);assert.deepEqual(fresh.calls[0].args[0],{action:'hire_employee',companyId:'c1',officeId:'o1',name:role.name,role:role.name,skillPaths:[...role.skills]});assert.match(fresh.messages[0],/do not enable the paid worker/);
    const state=structuredClone(office);state.employees.push({...state.employees[0],id:'prior',role:role.name,status:'paused'});
    const reused=harness({choices:['hire-operations',role.id,'c1'],state});assert.equal((await reused.compute.menu()).reused,true);assert.equal(reused.calls.length,0);
  }
});
test('operations hiring does not silently replace fired staff or mutate after cancellation',async()=>{
  const state=structuredClone(office);state.employees[0].role='Runtime Observer';state.employees[0].status='fired';
  const fired=harness({choices:['hire-operations','observer','c1'],state});assert.equal((await fired.compute.menu()).ok,false);assert.equal(fired.calls.length,0);assert.match(fired.warnings[0],/Restore that employee explicitly/);
  const cancelled=harness({choices:['hire-operations','connector']});assert.equal((await cancelled.compute.menu()).cancelled,true);assert.equal(cancelled.calls.length,0);
});
test('readiness projects safe metadata and unavailable components without connection probes or secret text',async()=>{
  const secret='PRIVATE_CREDENTIAL_SENTINEL';
  const h=harness({choices:['readiness','cloud'],responses:{
    getSystemInfo:{os:{platform:'linux',arch:'x64'},totalRamBytes:16*1024**3,freeRamBytes:8*1024**3,disk:{freeBytes:32*1024**3,path:secret},gpus:[{name:secret}],notes:[secret],token:secret},
    getSettings:{runtimeUrl:`https://name:${secret}@example.test/?token=${secret}`,apiKey:secret},
    officeWorkerStatus:new Error(secret),hostStatus:{ok:true,host:{available:true,revision:4,mode:'manual',jobCount:0,grants:[],token:secret}},
    cloudStatus:{configured:true,connected:false,pendingCommands:3,url:secret,error:secret,deviceToken:secret},
  }});
  const result=await h.compute.menu();assert.deepEqual(h.calls.map(row=>row.method),['getSystemInfo','getSettings','officeWorkerStatus','hostStatus','cloudStatus']);assert.equal(result.readiness.find(row=>row.id==='worker').description,'Unavailable');assert.match(result.readiness[0].description,/16.0 GiB/);assert.match(result.readiness.find(row=>row.id==='cloud').description,/connected: no/);assert.equal(h.warnings.length,0);
  assert.ok(!JSON.stringify({result,pickers:h.pickers,messages:h.messages,warnings:h.warnings}).includes(secret));
});
test('readiness starts its five bounded independent reads together',async()=>{
  let release;const barrier=new Promise(resolve=>release=resolve);const methods=['getSystemInfo','getSettings','officeWorkerStatus','hostStatus','cloudStatus'];
  const h=harness({choices:['readiness'],responses:Object.fromEntries(methods.map(method=>[method,async()=>{await barrier;return{};}]))});
  const pending=h.compute.menu();await new Promise(resolve=>setImmediate(resolve));assert.equal(h.calls.length,5);release();assert.equal((await pending).readiness.length,5);
});
test('activity views display bounded projected metadata and deterministic counts only',async()=>{
  const secret='PRIVATE_ACTIVITY_SENTINEL';
  const status=harness({choices:['activity-status'],responses:{activityStatus:{ok:true,activity:{available:true,eventCount:2,latestSequence:2,droppedEvents:0,degraded:false,fenced:false,summaryCacheEntries:1,token:secret}}}});
  await status.compute.menu();assert.deepEqual(status.calls,[{method:'activityStatus',args:[]}]);assert.match(status.messages[0],/no model call/);assert.ok(!status.messages[0].includes(secret));
  const log=harness({choices:['activity-log','company:c1','event-0'],responses:{activityQuery:{ok:true,events:[{sequence:2,family:'host',operation:'godMode',outcome:'accepted',recordedAt:'2026-11-22T00:00:00.000Z',durationMs:3,command:secret,prompt:secret,output:secret,token:secret},{sequence:3,operation:secret,outcome:secret,message:secret}],hasMore:false,retentionGap:true}}});
  const logs=await log.compute.menu();assert.deepEqual(log.calls,[{method:'activityQuery',args:[{limit:50,companyId:'c1'}]}]);assert.equal(logs.events[0].label,'#2 · host.godMode');assert.match(logs.events[0].description,/2026-11-22T00:00:00.000Z/);assert.equal(logs.events[1].label,'#3 · Other operation');assert.equal(logs.retentionGap,true);assert.ok(!JSON.stringify({logs,pickers:log.pickers,messages:log.messages}).includes(secret));
  const summary=harness({choices:['activity-summary','all','total'],responses:{activitySummarize:{ok:true,summary:{eventCount:2,latestSequence:2,byFamily:{host:2,[secret]:10},byOperation:{'host.godMode':2,[secret]:20},byOutcome:{accepted:2,[secret]:8},raw:secret},cacheHit:true}}});
  const summed=await summary.compute.menu();assert.deepEqual(summary.calls,[{method:'activitySummarize',args:[{}]}]);assert.match(summed.summary[0].description,/cache hit yes/);assert.ok(!JSON.stringify({summed,pickers:summary.pickers,messages:summary.messages}).includes(secret));
});
test('activity cancellation has no query and activity failures omit raw error text without retry',async()=>{
  const cancelled=harness({choices:['activity-log']});assert.equal((await cancelled.compute.menu()).cancelled,true);assert.equal(cancelled.calls.length,0);
  const failed=harness({choices:['activity-summary','all'],responses:{activitySummarize:new Error('SECRET_FROM_REMOTE_ERROR')}});assert.equal((await failed.compute.menu()).ok,false);assert.deepEqual(failed.calls.map(row=>row.method),['activitySummarize']);assert.ok(!failed.warnings[0].includes('SECRET_FROM_REMOTE_ERROR'));
});

test('host grant revocation removes only the selected grant and preserves policy, scope and revision',async()=>{
  const grants=[{id:'keep-company',companyId:'c1',employeeId:null,publicNote:'strip'},{id:'revoke',companyId:'c1',employeeId:'e1'},{id:'keep-other',companyId:'c2',employeeId:'e2'}];
  const h=harness({choices:['host-revoke','revoke'],responses:{hostStatus:{ok:true,host:{revision:23,mode:'manual',grants}}}});
  await h.compute.menu();assert.deepEqual(h.calls,[{method:'hostStatus',args:[]},{method:'hostConfigure',args:[{expectedRevision:23,mode:'manual',grants:[{id:'keep-company',companyId:'c1',employeeId:null},{id:'keep-other',companyId:'c2',employeeId:'e2'}]}]}]);
});
test('model revocation preserves resource ownership, other scope grants, routes and office parents',async()=>{
  const status=structuredClone(registry);status.resources.grants.push({id:'keep',resourceId:'r1',targetScope:{kind:'company',id:'c1'},permissions:['use','assign'],includeDescendants:true,membershipRevision:5});status.resources.routes.push({id:'route',companyId:'c1',strategy:'single',experts:[{employeeId:'e1',resourceId:'r1',officeId:'o1',departmentId:'d1',serviceContractId:null}],aggregator:null,limits:{maxTokens:4000,maxMinutes:5,maxParallel:1}});status.resources.officeParents=[{officeId:'o2',parentOfficeId:'o1'}];
  const expected=configurationFromStatus(status);expected.grants=expected.grants.filter(row=>row.id!=='g1');
  const h=harness({choices:['model-revoke','g1'],responses:{resourceStatus:status}});await h.compute.menu();assert.deepEqual(h.calls,[{method:'resourceStatus',args:[]},{method:'resourceConfigure',args:[expected]}]);
});
test('grant revocation cancellation and stale configuration never retry or change unrelated controls',async()=>{
  for(const [action,read,write,response,id]of [
    ['host-revoke','hostStatus','hostConfigure',{ok:true,host:{revision:9,mode:'auto',grants:[{id:'g1',companyId:'c1',employeeId:'e1'}]}},'g1'],
    ['model-revoke','resourceStatus','resourceConfigure',registry,'g1'],
  ]){
    const cancelled=harness({choices:[action],responses:{[read]:response}});assert.equal((await cancelled.compute.menu()).cancelled,true);assert.deepEqual(cancelled.calls.map(row=>row.method),[read]);
    const stale=harness({choices:[action,id],responses:{[read]:response,[write]:{ok:false,code:'REVISION_CONFLICT',error:'Configuration revision changed'}}});assert.equal((await stale.compute.menu()).ok,false);assert.deepEqual(stale.calls.map(row=>row.method),[read,write]);assert.equal(stale.messages.length,0);assert.equal(stale.calls[1].args[0].expectedRevision,action==='host-revoke'?9:7);
  }
});
function hostSource(h,source=Buffer.from('#!/bin/bash\nprintf "%s\\n" "$HOME"\n'),{filename='/chosen/file $(literal).bash',size=source.byteLength}={}){
  const reads=[];h.vscode.window.showOpenDialog=async options=>{assert.deepEqual(options.filters,{'Shell source':['sh','bash']});return[{path:filename}];};h.vscode.workspace.fs.stat=async()=>({size});h.vscode.workspace.fs.readFile=async uri=>{reads.push(uri.path);return source;};return reads;
}
test('host script submission is attributed once with literal selected source and bounded settings',async()=>{
  const source=Buffer.from('#!/bin/bash\nprintf "%s\\n" "$HOME"\n');
  const h=harness({choices:['host-run','c1','e1','submit'],inputs:['/workspace/a b','1800'],responses:{hostSubmit:args=>({ok:true,id:args[0].id,job:{status:'awaiting-approval'}})}});const reads=hostSource(h,source);
  const pick=h.vscode.window.showQuickPick;h.vscode.window.showQuickPick=async(items,options)=>{if(options.title.startsWith('Submit this attributed'))assert.equal(h.calls.length,0);return pick(items,options);};
  await h.compute.menu();assert.equal(h.calls.length,1);assert.equal(h.calls[0].method,'hostSubmit');const body=h.calls[0].args[0];assert.match(body.id,/^host-script-[0-9a-f-]{36}$/);assert.deepEqual({...body,id:'stable-id'},{id:'stable-id',companyId:'c1',employeeId:'e1',command:source.toString('utf8'),cwd:'/workspace/a b',timeoutSeconds:1800,maxOutputBytes:1048576});assert.equal(reads[0],'/chosen/file $(literal).bash');assert.ok(!body.command.includes('file $(literal)'));assert.equal(h.inputPrompts.find(row=>row.title==='Host script timeout in seconds').value,'1800');assert.match(h.messages[0],/awaiting-approval/);
});
test('cancelling any host script submission stage sends no backend operation',async()=>{
  const plans=[{choices:['host-run']},{choices:['host-run','c1']},{choices:['host-run','c1','e1'],file:false},{choices:['host-run','c1','e1'],inputs:[]},{choices:['host-run','c1','e1'],inputs:['/workspace']},{choices:['host-run','c1','e1','leave'],inputs:['/workspace','1800']}];
  for(const plan of plans){const h=harness(plan);if(plan.file!==false)hostSource(h);assert.equal((await h.compute.menu()).cancelled,true);assert.equal(h.calls.length,0);}
});
test('host source rejects oversize, changing size, NUL, invalid UTF-8 and wrong extensions before submission',async()=>{
  for(const [source,options,expected]of [
    [Buffer.from('echo ok'),{size:65537},/64 KiB/],
    [Buffer.alloc(65537,97),{size:1},/64 KiB/],
    [Buffer.from('echo a\0'),{},/NUL/],
    [Buffer.from([0xc3,0x28]),{},/UTF-8/],
    [Buffer.from('echo ok'),{filename:'/workspace/script.py'},/\.sh or \.bash/],
  ]){const h=harness({choices:['host-run','c1','e1']});const reads=hostSource(h,source,options);assert.equal((await h.compute.menu()).ok,false);assert.match(h.warnings[0],expected);assert.equal(h.calls.length,0);if(options.size===65537)assert.equal(reads.length,0);}
});
test('host script validates working directory and timeout independently of native input validation',async()=>{
  for(const inputs of [['relative/path'],['/workspace\n'],['/workspace','0'],['/workspace','86401']]){const h=harness({choices:['host-run','c1','e1'],inputs});hostSource(h);assert.equal((await h.compute.menu()).ok,false);assert.equal(h.calls.length,0);}
});
test('host submission failure preserves its receipt ID and is never retried or policy-enabled',async()=>{
  const h=harness({choices:['host-run','c1','e1','submit'],inputs:['/workspace','60'],responses:{hostSubmit:new Error('Submission outcome is unknown')}});hostSource(h);assert.equal((await h.compute.menu()).ok,false);assert.deepEqual(h.calls.map(row=>row.method),['hostSubmit']);const id=h.calls[0].args[0].id;assert.ok(h.warnings[0].includes(id));assert.match(h.warnings[0],/No automatic retry/);assert.equal(h.messages.length,0);
});
