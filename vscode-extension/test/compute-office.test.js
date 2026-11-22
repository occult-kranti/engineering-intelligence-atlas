'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createComputeOffice,configurationFromStatus,OPERATOR_ROLE,OPERATOR_SKILLS}=require('../src/compute-office');
const office={companies:[{id:'c1',name:'Company',status:'active',assistantId:'e1'}],offices:[{id:'o1',companyId:'c1',name:'Office',status:'active'}],departments:[{id:'d1',companyId:'c1',officeId:'o1',name:'Engineering',status:'active'}],employees:[{id:'e1',companyId:'c1',officeId:'o1',departmentId:'d1',name:'Donna',role:'Company assistant',status:'active'}]};
const resource={id:'r1',companyId:'c1',ownerScope:{kind:'company',id:'c1'},model:'model:1',digest:'a'.repeat(64)};
const registry={ok:true,resources:{revision:7,resources:[resource],grants:[{id:'g1',resourceId:'r1',targetScope:{kind:'employee',id:'e1'},permissions:['use'],includeDescendants:false,membershipRevision:2,coveredScopeCount:1,membershipHash:'b'.repeat(64),coveredScopes:[{kind:'employee',id:'e1'}]}],routes:[],officeParents:[]}};
function harness({choices=[],inputs=[],state=office,responses={}}={}){
  const calls=[],messages=[],warnings=[];
  const vscode={window:{
    async showQuickPick(items){const selected=choices.shift();if(selected===undefined)return undefined;if(Array.isArray(selected))return selected.map(id=>items.find(item=>item.id===id));const item=items.find(item=>item.id===selected);assert.ok(item,`Missing choice ${selected}`);return item;},
    async showInputBox(){return inputs.shift();},async showOpenDialog(){return undefined;},async showInformationMessage(message){messages.push(message);},async showWarningMessage(message){warnings.push(message);}
  },workspace:{fs:{readFile:async()=>Buffer.from('print(1)')}}};
  const compute=createComputeOffice({vscode,snapshot:async()=>structuredClone(state),notify:async message=>messages.push(message),call:async(method,args)=>{calls.push({method,args:structuredClone(args)});const value=responses[method];if(value instanceof Error)throw value;return typeof value==='function'?value(args):structuredClone(value??{ok:true});}});
  return{compute,calls,messages,warnings,vscode};
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
