'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {managementCommand,ownershipSummary}=require('../src/management');
const fixture=()=>({
  companies:[{id:'a',name:'A',assistantId:'assistant-a'},{id:'b',name:'B',assistantId:'assistant-b'}],
  offices:[{id:'oa',companyId:'a',name:'Office',assistantId:'assistant-oa'},{id:'oa2',companyId:'a'},{id:'ob',companyId:'b'}],
  departments:[{id:'da',companyId:'a',officeId:'oa',name:'Research',assistantId:'assistant-da',parentDepartmentId:null},{id:'child',companyId:'a',officeId:'oa',parentDepartmentId:'da'},{id:'da2',companyId:'a',officeId:'oa2'},{id:'db',companyId:'b',officeId:'ob'}],
  employees:[{id:'donna',companyId:null,officeId:null,departmentId:null,kind:'assistant',status:'active',name:'Donna'},
    {id:'assistant-a',companyId:'a',officeId:null,departmentId:null,kind:'assistant',status:'active'},
    {id:'assistant-oa',companyId:'a',officeId:'oa',departmentId:null,kind:'assistant',status:'active'},
    {id:'assistant-da',companyId:'a',officeId:'oa',departmentId:'da',kind:'assistant',status:'paused'},
    {id:'ea',companyId:'a',officeId:'oa',kind:'specialist',status:'active'},
    {id:'eb',companyId:'b',officeId:'ob',kind:'specialist',status:'active'},
    {id:'retired',companyId:'a',officeId:'oa',kind:'specialist',status:'fired'}],
  authority:{grants:[]}
});
test('employee metadata changes preserve identity and cannot smuggle authority or scope changes',()=>{
  const snapshot=fixture();
  assert.deepEqual(managementCommand(snapshot,'a',{action:'update_employee',employeeId:'ea',name:' Engineer ',role:'Backend reliability',skillPaths:['skills/agent-research-director/SKILL.md'],companyId:'b',kind:'assistant',issuer:'owner',capabilities:['provider.run']}),{action:'update_employee',employeeId:'ea',name:'Engineer',role:'Backend reliability',skillPaths:['skills/agent-research-director/SKILL.md']});
  for(const input of [{action:'update_employee',employeeId:'eb',role:'Bad'},{action:'update_employee',employeeId:'retired',role:'Bad'},{action:'update_employee',employeeId:'ea'},{action:'update_employee',employeeId:'ea',skillPaths:['../../private/SKILL.md']},{action:'update_employee',employeeId:'ea',skillPaths:['skills/../SKILL.md']}])assert.throws(()=>managementCommand(snapshot,'a',input));
});
test('permanent assistant retirement fails while specialist retirement and assistant pause preserve canonical ids',()=>{
  const snapshot=fixture();
  for(const employeeId of ['assistant-a','assistant-oa','assistant-da'])assert.throws(()=>managementCommand(snapshot,'a',{action:'fire_employee',employeeId}),/Permanent assistants/);
  assert.deepEqual(managementCommand(snapshot,'a',{action:'pause_employee',employeeId:'assistant-a'}),{action:'pause_employee',employeeId:'assistant-a'});
  assert.deepEqual(managementCommand(snapshot,'a',{action:'fire_employee',employeeId:'ea'}),{action:'fire_employee',employeeId:'ea'});
});
test('department create, rename, pause and reparent reject cross-company and cross-office references',()=>{
  const snapshot=fixture();
  assert.deepEqual(managementCommand(snapshot,'a',{action:'create_department',officeId:'oa',name:' Backend '}),{action:'create_department',officeId:'oa',name:'Backend'});
  assert.deepEqual(managementCommand(snapshot,'a',{action:'set_department_parent',departmentId:'child',parentDepartmentId:null}),{action:'set_department_parent',departmentId:'child',parentDepartmentId:null});
  for(const input of [{action:'rename_office',officeId:'ob',name:'No'},{action:'rename_department',departmentId:'db',name:'No'},{action:'pause_department',departmentId:'db'},{action:'set_department_parent',departmentId:'da',parentDepartmentId:'child'},{action:'set_department_parent',departmentId:'da',parentDepartmentId:'da2'},{action:'set_department_parent',departmentId:'child'}])assert.throws(()=>managementCommand(snapshot,'a',input));
});
test('hire checks department containment and Unicode byte limits without modifying the source snapshot',()=>{
  const snapshot=fixture(),before=JSON.stringify(snapshot);
  const command=managementCommand(snapshot,'a',{action:'hire_employee',officeId:'oa',departmentId:'da',name:'Reviewer',role:'Independent backend review'});
  assert.deepEqual(command,{action:'hire_employee',companyId:'a',officeId:'oa',departmentId:'da',name:'Reviewer',role:'Independent backend review',skillPaths:[]});
  assert.throws(()=>managementCommand(snapshot,'a',{...command,departmentId:'da2'}));
  assert.throws(()=>managementCommand(snapshot,'a',{...command,name:'界'.repeat(51)}));
  assert.equal(JSON.stringify(snapshot),before);
});
test('ownership inspection finds missing and foreign assistants without converting expired or future grants to authority',()=>{
  const snapshot=fixture(),now=Date.parse('2026-11-24T12:00:00Z');
  const grant={employeeId:'donna',scope:{kind:'company',id:'a'},grantedAt:'2026-11-24T11:00:00Z',expiresAt:'2026-11-24T13:00:00Z',revokedAt:null};
  snapshot.authority.grants=[grant,{...grant,expiresAt:'2026-11-24T11:59:59Z'},{...grant,grantedAt:'2026-11-24T12:01:00Z'},{...grant,revokedAt:'2026-11-24T11:30:00Z'},{...grant,expiresAt:'invalid'}];
  const rows=ownershipSummary(snapshot,'a',now);
  assert.equal(rows[0].validOwner,true);assert.equal(rows[0].grantCount,1);
  assert.equal(rows.find(row=>row.id==='a').validOwner,true);
  assert.equal(rows.find(row=>row.id==='da').validOwner,true);
  snapshot.companies[0].assistantId='donna';
  assert.equal(ownershipSummary(snapshot,'a',now).find(row=>row.id==='a').validOwner,false);
  assert.throws(()=>managementCommand(snapshot,'a',{action:'update_employee',employeeId:'donna',role:'Other'}));
  snapshot.companies[0].assistantId='eb';
  assert.throws(()=>managementCommand(snapshot,'a',{action:'update_employee',employeeId:'eb',role:'Other'}));
  snapshot.offices[0].assistantId='eb';
  assert.equal(ownershipSummary(snapshot,'a',now).find(row=>row.id==='oa').validOwner,false);
  assert.equal(rows.find(row=>row.id==='oa2').validOwner,false);
});
