#!/usr/bin/env node
// Independent frozen-contract tests, authored before accepting the Studio module.
// Run only on the director's accepted artifact. No DOM, browser, GPU or provider.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {basicFixture,hierarchicalFixture,copy} from './fixtures.mjs';

const here=path.dirname(fileURLToPath(import.meta.url)),repo=path.resolve(here,'../../..');
const sourcePath=path.resolve(process.argv[2]||path.join(repo,'cloud-workspace/public/concepts/blueprint-world-studio-edits.js'));
const corePath=path.join(repo,'cloud-workspace/public/concepts/blueprint-world-core.js');
const contractPath=path.join(repo,'design/blueprint-world/studio-contract.json');
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
const contractBytes=fs.readFileSync(contractPath),contractHash=hash(contractBytes);
assert.equal(contractHash,'1f38c953a415004d66cb4a18f56ad6ff557f3b1ca24e83405cbaa9a7464edbe2','Frozen Studio contract changed; obtain director acceptance before adapting these tests');
const contract=JSON.parse(contractBytes),sourceBytes=fs.readFileSync(sourcePath),sourceHash=hash(sourceBytes);
const Core=await import(pathToFileURL(corePath).href),Studio=await import(pathToFileURL(sourcePath).href);
const results=[],A='co-fixture-0',B='co-fixture-1',DA='dp-0-engineering',DB='dp-1-engineering';
const OWNER='act_owner',DONNA='act_donna_a',SUB='act_sub_a',DIRECTOR='act_director_a',SHARED='act_shared',VISITOR='act_visitor';
const CAPS=['department.rename','department.color','department.reorder','company.move','assignment.place','policy.manage','history.undoAny'];
const EDITS=CAPS.slice(0,5),EPS=1e-7;
const command=(type,fields={})=>({type,...fields});
const workspace=()=>({kind:'workspace',companyId:null,departmentId:null,includeDescendants:false});
const company=companyId=>({kind:'company',companyId,departmentId:null,includeDescendants:false});
const department=(companyId,departmentId,includeDescendants=false)=>({kind:'department',companyId,departmentId,includeDescendants});
const worker=(model,cid)=>model.employees.find(e=>e.homeCompanyId===cid&&e.name==='Sam Same');
const stateEq=(pair,before)=>{assert.deepEqual(pair.model,before.model,'Input core changed');assert.deepEqual(pair.studio,before.studio,'Input Studio metadata changed');};
function fixture(){
  const model=hierarchicalFixture();
  model.companies.find(c=>c.id===B).parentId=A;
  model.departments.push({id:'dp-child-two',companyId:A,officeId:'of-fixture-0',parentId:DA,name:'Child two',color:'#7b9bc9',order:1});
  model.assignments.push({id:'as-shared-b',employeeId:worker(model,A).id,companyId:B,departmentId:DB,kind:'shared',x:null,y:null});
  return Core.validateState(model);
}
function policy(model,{descendants=false}={}){
  const actors=[
    {id:OWNER,label:'Local owner',role:'owner',employeeId:null,active:true},
    {id:DONNA,label:'Donna A',role:'donna',employeeId:'em-donna-0',active:true},
    {id:SUB,label:'Sub Donna',role:'sub_donna',employeeId:worker(model,A).id,active:true},
    {id:DIRECTOR,label:'CEO OWNER administrator',role:'director',employeeId:'em-director-0',active:true},
    {id:SHARED,label:'Shared Donna',role:'donna',employeeId:worker(model,A).id,active:true},
    {id:VISITOR,label:'Owner director Donna',role:'visitor',employeeId:null,active:true},
    {id:'act_inactive',label:'Inactive director',role:'director',employeeId:'em-director-1',active:false}
  ];
  const grant=(id,actorId,capabilities,scope)=>({id,actorId,capabilities,scope,issuedBy:OWNER,issuedAtRevision:0,revokedAtRevision:null});
  return {ownerActorId:OWNER,actors,grants:[grant('gr_owner',OWNER,CAPS,workspace()),grant('gr_donna_a',DONNA,EDITS,company(A)),grant('gr_sub_a',SUB,['department.rename','department.color','department.reorder','assignment.place'],department(A,DA,descendants))]};
}
function pair(options){const model=fixture(),bootstrap=policy(model,options);return {model,studio:Studio.createStudio(model,bootstrap)};}
const envelope=(p,actorId,cmd,extra={})=>({actorId,sequence:(p.studio.cursors[actorId]||0)+1,expectedRevision:p.studio.revision,command:cmd,...extra});
function rejected(p,operation){
  const before=copy(p);let error;
  try{operation();}catch(e){error=e;}
  assert.ok(error instanceof Error,'Expected a rejected operation with an Error');
  assert.ok(error.name==='StudioError'||error.constructor.name==='StudioError','Contract rejection must use StudioError');
  assert.ok(typeof error.message==='string'&&error.message.length>0&&error.message.length<=8192,'Bounded useful rejection message');
  stateEq(p,before);return error;
}
function rejectCommand(p,actorId,cmd,extra){return rejected(p,()=>Studio.applyEdit(p.model,p.studio,envelope(p,actorId,cmd,extra)));}
function decision(p,actorId,cmd,expected){
  const before=copy(p),d=Studio.authorize(p.model,p.studio,actorId,cmd);stateEq(p,before);
  assert.equal(d.allowed,expected);assert.ok(typeof d.code==='string'&&d.code.length>0);assert.ok(typeof d.message==='string'&&d.message.length<=8192);
  assert.ok(Array.isArray(d.requiredCapabilities)&&Array.isArray(d.affectedScopes));return d;
}
function apply(p,actorId,cmd,extra){
  const before=copy(p),request=envelope(p,actorId,cmd,extra),result=Studio.applyEdit(p.model,p.studio,request);stateEq(p,before);
  assert.equal(result.replayed,false);assert.equal(result.receipt.opId,`${actorId}:${request.sequence}`);
  assert.equal(result.receipt.actorId,actorId);assert.equal(result.receipt.sequence,request.sequence);assert.equal(result.receipt.changed,true);
  assert.equal(result.studio.revision,p.studio.revision+1);assert.equal(result.receipt.revision,result.studio.revision);
  assert.equal(result.receipt.modelRevision,result.studio.modelRevision);assert.equal(result.receipt.eventId,`evt_${result.studio.revision}`);
  assert.equal(result.studio.cursors[actorId],request.sequence);assert.ok(Buffer.byteLength(result.receipt.requestCanonical,'utf8')<=8192);
  assert.ok(result.receipt.resultIds.every(id=>typeof id==='string'&&id.length<=100));
  const modelChanged=JSON.stringify(result.model)!==JSON.stringify(p.model);
  assert.equal(result.studio.modelRevision,p.studio.modelRevision+(modelChanged?1:0));
  assert.ok(result.studio.journal.length<=128&&result.studio.receipts.length<=64);
  return {p:{model:result.model,studio:result.studio},result,request};
}
function replace(p,actorId,cmd){return apply(p,actorId,cmd).p;}
function lastEvent(p){return p.studio.journal.at(-1);}
function freeTarget(model,assignmentId){
  const assignment=model.assignments.find(a=>a.id===assignmentId),layout=Core.companyLayout(model,assignment.companyId),seat=layout.seats.find(s=>s.assignmentId===assignmentId);
  for(const [dx,dy] of [[20,0],[-20,0],[0,40],[0,-40],[80,40]]){
    const staged=copy(model);Core.moveAssignment(staged,assignmentId,{x:seat.x+dx,y:seat.y+dy});
    const nextLayout=Core.companyLayout(staged,assignment.companyId),next=nextLayout.seats.find(s=>s.assignmentId===assignmentId);
    if(Math.hypot(next.x-seat.x,next.y-seat.y)<1)continue;
    if(nextLayout.seats.every(other=>other.assignmentId===assignmentId||Math.hypot(next.x-other.x,next.y-other.y)>=next.r+other.r+2-EPS))return {x:seat.x+dx,y:seat.y+dy,expected:next};
  }
  throw new Error('Independent placement fixture has no free target');
}
function test(name,body){const started=performance.now();try{const details=body();results.push({name,status:'passed',durationMs:Math.round(performance.now()-started),details});console.log('PASS '+name);}catch(error){results.push({name,status:'failed',error:String(error?.message||error)});console.log('FAIL '+name+': '+String(error?.message||error));}}

test('Frozen exports, explicit bootstrap and detached canonical metadata',()=>{
  const names=contract.exports.map(x=>x.signature.slice(0,x.signature.indexOf('(')));for(const name of names)assert.equal(typeof Studio[name],'function',name);
  const model=fixture(),config=policy(model),before={model:copy(model),config:copy(config)};
  const first=Studio.createStudio(model,config),second=Studio.createStudio(model,config);assert.deepEqual(first,second);assert.notEqual(first,second);
  assert.deepEqual(model,before.model);assert.deepEqual(config,before.config);assert.equal(first.format,'daftar-blueprint-studio');assert.equal(first.version,1);assert.equal(first.revision,0);assert.equal(first.modelRevision,0);assert.match(first.modelFingerprint,/^[a-f0-9]{16}$/i);assert.deepEqual(first.journal,[]);assert.deepEqual(first.receipts,[]);
  const p={model,studio:first},validated=Studio.validateStudio(model,first);assert.deepEqual(validated,first);assert.notEqual(validated,first);validated.policy.actors[0].label='Detached result';assert.notEqual(validated.policy.actors[0].label,first.policy.actors[0].label);
  rejected(p,()=>Studio.createStudio(model,{...config,grants:config.grants.filter(g=>g.id!=='gr_owner')}));
  rejected(p,()=>Studio.createStudio(model,{...config,ownerActorId:DIRECTOR}));
  return {requiredExports:names.length,explicitOwnerGrantRequired:true};
});

test('Roles, parent companies and department ancestry do not infer grants',()=>{
  const p=pair(),renameA=command('department.rename',{departmentId:DA,name:'Scoped engineering'}),renameB=command('department.rename',{departmentId:DB,name:'Child-company engineering'});
  for(const actor of [DIRECTOR,VISITOR,SHARED,'act_inactive','act_missing']){decision(p,actor,renameA,false);rejectCommand(p,actor,renameA);}
  decision(p,DONNA,renameA,true);decision(p,DONNA,renameB,false);rejectCommand(p,DONNA,renameB);
  decision(p,SUB,renameA,true);decision(p,SUB,command('department.rename',{departmentId:'dp-child',name:'Child edit'}),false);
  const descendants=pair({descendants:true});for(const id of [DA,'dp-child','dp-grandchild','dp-child-two'])decision(descendants,SUB,command('department.rename',{departmentId:id,name:'Scoped '+id}),true);
  decision(descendants,SUB,command('department.rename',{departmentId:'dp-0-design',name:'Outside subtree'}),false);
  return {unprivilegedActorCases:5,explicitDescendantTargets:4,parentCompanyIsNotInherited:true};
});

test('Shared placement uses host assignment scope and preserves canonical identity',()=>{
  let p=pair();const target=freeTarget(p.model,'as-shared-b'),move=command('assignment.place',{assignmentId:'as-shared-b',x:target.x,y:target.y});
  decision(p,DONNA,move,false);decision(p,SHARED,move,false);rejectCommand(p,DONNA,move);
  p=replace(p,OWNER,command('policy.grant',{grantId:'gr_shared_host',actorId:SHARED,capabilities:['assignment.place'],scope:department(B,DB)}));
  decision(p,SHARED,move,true);const before=copy(p.model),next=apply(p,SHARED,move).p;
  const placed=next.model.assignments.find(a=>a.id==='as-shared-b'),old=before.assignments.find(a=>a.id==='as-shared-b');
  for(const key of ['id','employeeId','companyId','departmentId','kind'])assert.equal(placed[key],old[key]);
  assert.deepEqual(next.model.employees,before.employees);assert.deepEqual(next.model.tasks,before.tasks);assert.deepEqual(next.model.assignments.filter(a=>a.id!==old.id),before.assignments.filter(a=>a.id!==old.id));
  // Assignment storage uses department-local offsets; the public Seat projection
  // and moveAssignment input use company-local coordinates (frozen core contract).
  const projected=Core.companyLayout(next.model,B).seats.find(s=>s.assignmentId===placed.id);
  assert.ok(Math.abs(projected.x-target.expected.x)<EPS&&Math.abs(projected.y-target.expected.y)<EPS);
  rejectCommand(p,SHARED,command('assignment.place',{assignmentId:old.employeeId,x:target.x,y:target.y}));
  rejectCommand(p,SHARED,{...move,companyId:A});
  return {explicitHostGrant:true,identityFieldsPreserved:5,employeeIdIsNotAssignmentId:true};
});

test('Preview and floorplan edits are pure, targeted and generated-patch only',()=>{
  const p=pair(),rename=command('department.rename',{departmentId:DA,name:'<img src=x> Engineering'}),request=envelope(p,DONNA,rename),before=copy(p);
  const preview=Studio.previewEdit(p.model,p.studio,request);stateEq(p,before);assert.equal(preview.baseRevision,0);assert.equal(preview.decision.allowed,true);assert.equal(preview.resolvedCommand.type,rename.type);assert.ok(preview.changes!==undefined&&preview.geometry!==undefined);
  const first=apply(p,DONNA,rename).p;assert.equal(first.model.departments.find(d=>d.id===DA).name,rename.name);
  const expected=copy(p.model);expected.departments.find(d=>d.id===DA).name=rename.name;assert.deepEqual(first.model,expected);
  assert.equal(lastEvent(first).undoable,true);assert.equal(lastEvent(first).undoOf,null);assert.ok(lastEvent(first).patches.length>0);
  for(const patch of lastEvent(first).patches){assert.equal(patch.collection,'departments');assert.equal(patch.recordId,DA);assert.equal(patch.field,'name');assert.ok(patch.before===null||['string','number','boolean'].includes(typeof patch.before));}
  const second=apply(first,DONNA,command('department.color',{departmentId:DA,color:'#123456'})).p;
  expected.departments.find(d=>d.id===DA).color='#123456';assert.deepEqual(second.model,expected);
  for(const key of ['companies','offices','employees','assignments','tasks','notes'])assert.deepEqual(second.model[key],before.model[key]);
  return {targetedFloorplanEdits:2,previewLeavesRevisionAndSequenceUntouched:true,hostileNameIsInertData:true};
});

test('Reorder requires a complete sibling permutation and every changed scope',()=>{
  const p=pair({descendants:true}),roots=p.model.departments.filter(d=>d.companyId===A&&d.parentId===null).sort((a,b)=>a.order-b.order).map(d=>d.id);
  const reorder=ids=>command('department.reorder',{companyId:A,officeId:'of-fixture-0',parentId:null,orderedIds:ids});
  for(const ids of [roots.slice(1),[roots[0],...roots.slice(0,-1)],[...roots.slice(0,-1),DB]])rejectCommand(p,OWNER,reorder(ids));
  rejectCommand(p,OWNER,{...reorder([...roots].reverse()),officeId:'of-fixture-1'});rejectCommand(p,OWNER,reorder(roots));
  decision(p,SUB,reorder([...roots].reverse()),false);rejectCommand(p,SUB,reorder([...roots].reverse()));
  const children=command('department.reorder',{companyId:A,officeId:'of-fixture-0',parentId:DA,orderedIds:['dp-child-two','dp-child']});
  const childNext=apply(p,SUB,children).p;assert.equal(childNext.model.departments.find(d=>d.id==='dp-child-two').order,0);assert.equal(childNext.model.departments.find(d=>d.id==='dp-child').order,1);
  assert.deepEqual(childNext.model.departments.filter(d=>!children.orderedIds.includes(d.id)),p.model.departments.filter(d=>!children.orderedIds.includes(d.id)));
  const rootNext=apply(p,DONNA,reorder([...roots].reverse())).p;for(const [i,id] of [...roots].reverse().entries())assert.equal(rootNext.model.departments.find(d=>d.id===id).order,i);
  assert.deepEqual(rootNext.model.assignments,p.model.assignments);assert.deepEqual(rootNext.model.tasks,p.model.tasks);
  return {invalidPermutations:3,invalidOffice:1,noOpRejected:true,unauthorizedSiblingReorderRejected:true,authorizedChildReorder:true};
});

test('Full company footprints keep the exact 160-unit gutter',()=>{
  const p=pair(),move=(x,z)=>command('company.move',{companyId:B,x,z});
  rejectCommand(p,OWNER,move(1259.99,0));
  const exact=apply(p,OWNER,move(1260,1)).p;assert.equal(exact.model.companies.find(c=>c.id===B).x,1260);
  const height=Core.companyLayout(p.model,A).height;
  rejectCommand(p,OWNER,move(0,height+159.99));
  const vertical=apply(p,OWNER,move(0,height+160)).p;
  for(const key of ['offices','departments','employees','assignments','tasks','notes'])assert.deepEqual(vertical.model[key],p.model[key]);
  assert.deepEqual(vertical.model.companies.find(c=>c.id===A),p.model.companies.find(c=>c.id===A));
  const moved=copy(vertical.model.companies.find(c=>c.id===B)),original=copy(p.model.companies.find(c=>c.id===B));delete moved.x;delete moved.z;delete original.x;delete original.z;assert.deepEqual(moved,original);
  for(const x of [NaN,Infinity,-Infinity])rejectCommand(p,OWNER,move(x,0));
  return {horizontalBoundary:160,verticalBoundary:160,fullCompanyHeight:height,nonfiniteCases:3};
});

test('Manual circles reject occupancy and expose the core clamp',()=>{
  const p=pair(),layout=Core.companyLayout(p.model,B),shared=layout.seats.find(s=>s.assignmentId==='as-shared-b'),other=layout.seats.find(s=>p.model.assignments.find(a=>a.id===s.assignmentId)?.departmentId===DB&&s.assignmentId!==shared.assignmentId);
  assert.ok(other);rejectCommand(p,OWNER,command('assignment.place',{assignmentId:shared.assignmentId,x:other.x,y:other.y}));
  const staged=copy(p.model),raw={x:-100000,y:-100000};Core.moveAssignment(staged,shared.assignmentId,raw);const expected=Core.companyLayout(staged,B).seats.find(s=>s.assignmentId===shared.assignmentId);
  const cmd=command('assignment.place',{assignmentId:shared.assignmentId,...raw}),request=envelope(p,OWNER,cmd),preview=Studio.previewEdit(p.model,p.studio,request);
  assert.equal(preview.decision.allowed,true);assert.ok(Math.abs(preview.resolvedCommand.x-expected.x)<EPS&&Math.abs(preview.resolvedCommand.y-expected.y)<EPS,'Preview exposes clamped company-local target');
  const next=apply(p,OWNER,cmd).p,seat=Core.companyLayout(next.model,B).seats.find(s=>s.assignmentId===shared.assignmentId);
  assert.ok(Math.abs(seat.x-expected.x)<EPS&&Math.abs(seat.y-expected.y)<EPS);
  for(const peer of Core.companyLayout(next.model,B).seats)if(peer.assignmentId!==seat.assignmentId)assert.ok(Math.hypot(seat.x-peer.x,seat.y-peer.y)>=seat.r+peer.r+2-EPS);
  return {exactOccupiedTargetRejected:true,clampedTargetExposed:true,manualRadius:18,extraSeparation:2};
});

test('Malformed, prototype, accessor and unknown-field inputs reject atomically',()=>{
  const p=pair(),valid=command('department.rename',{departmentId:DA,name:'Valid renamed room'});
  const commands=[
    command('department.rename',{departmentId:DA,name:''}),command('department.rename',{departmentId:DA,name:'x'.repeat(61)}),command('department.rename',{departmentId:DA,name:'Product'}),command('department.rename',{departmentId:DA,name:'Engineering'}),command('department.rename',{departmentId:DA,name:'bad\u0000name'}),
    command('department.color',{departmentId:DA,color:'red'}),command('department.rename',{departmentId:'Engineering',name:'Wrong key'}),
    {type:'department.rename',payload:{departmentId:DA,name:'Nested wire payload'}},{...valid,patches:[]},{...valid,companyId:B},{type:'arbitrary.execute',code:'doNothing'},
    {...valid,unknown:'x'.repeat(8193)},Object.assign(Object.create({inherited:true}),valid),JSON.parse('{"type":"department.rename","departmentId":"dp-0-engineering","name":"Changed","__proto__":{"polluted":true}}')
  ];
  for(const cmd of commands)rejectCommand(p,OWNER,cmd);
  for(const extra of [{sequence:0},{sequence:2},{sequence:Infinity},{expectedRevision:-1},{expectedRevision:NaN},{expectedRevision:1},{extra:true}])rejectCommand(p,OWNER,valid,extra);
  let reads=0;const accessor={type:'department.rename',departmentId:DA};Object.defineProperty(accessor,'name',{enumerable:true,get(){reads++;return 'Getter executed';}});rejectCommand(p,OWNER,accessor);assert.equal(reads,0,'Reject accessors without invoking them');
  const cyclic={...valid};cyclic.payload=cyclic;rejectCommand(p,OWNER,cyclic);assert.equal({}.polluted,undefined);
  return {malformedCommands:commands.length,envelopeCases:7,accessorReads:reads,cyclicRejected:true};
});

test('Only the explicit owner administers policy and cannot lock it out',()=>{
  let p=pair();const newActor={id:'act_new',label:'Another local editor',role:'visitor',employeeId:null,active:true};
  rejectCommand(p,DONNA,command('policy.actor.put',{actor:newActor}));
  for(const capability of ['policy.manage','history.undoAny'])rejectCommand(p,OWNER,command('policy.grant',{grantId:'gr_bad_'+capability.split('.').at(-1).toLowerCase(),actorId:DONNA,capabilities:[capability],scope:workspace()}));
  rejectCommand(p,OWNER,command('policy.actor.put',{actor:{...p.studio.policy.actors.find(a=>a.id===OWNER),active:false}}));
  rejectCommand(p,OWNER,command('policy.revoke',{grantId:'gr_owner'}));
  p=replace(p,OWNER,command('policy.actor.put',{actor:newActor}));decision(p,newActor.id,command('department.color',{departmentId:DA,color:'#010203'}),false);
  p=replace(p,OWNER,command('policy.grant',{grantId:'gr_new',actorId:newActor.id,capabilities:['department.color'],scope:department(A,DA)}));
  decision(p,newActor.id,command('department.color',{departmentId:DA,color:'#010203'}),true);
  rejectCommand(p,OWNER,command('policy.grant',{grantId:'gr_new',actorId:newActor.id,capabilities:['department.rename'],scope:department(A,DA)}));
  p=replace(p,OWNER,command('policy.revoke',{grantId:'gr_new'}));assert.equal(p.studio.policy.grants.find(g=>g.id==='gr_new').revokedAtRevision,p.studio.revision);
  decision(p,newActor.id,command('department.color',{departmentId:DA,color:'#010203'}),false);rejectCommand(p,OWNER,command('policy.revoke',{grantId:'gr_new'}));
  return {newActorGetsNoImplicitGrant:true,grantThenRevoke:true,lastOwnerProtected:true,ownerOnlyCapabilities:2};
});

test('A preview is not authority after revision change and revocation',()=>{
  const p=pair(),cmd=command('department.rename',{departmentId:DA,name:'Previewed rename'}),request=envelope(p,DONNA,cmd),before=copy(p);
  const preview=Studio.previewEdit(p.model,p.studio,request);assert.equal(preview.decision.allowed,true);stateEq(p,before);
  const revoked=replace(p,OWNER,command('policy.revoke',{grantId:'gr_donna_a'}));
  rejected(revoked,()=>Studio.applyEdit(revoked.model,revoked.studio,request));rejectCommand(revoked,DONNA,cmd);
  assert.equal(revoked.studio.cursors[DONNA]||0,0);assert.equal(revoked.model.departments.find(d=>d.id===DA).name,'Engineering');
  const staleModel=copy(p.model);staleModel.departments.find(d=>d.id===DA).name='External owner change';
  rejected(p,()=>Studio.validateStudio(staleModel,p.studio));rejected(p,()=>Studio.applyEdit(staleModel,p.studio,request));
  return {stalePreviewRejected:true,currentRevisionStillRequiresGrant:true,fingerprintMismatchRejected:true};
});

test('History projection uses current explicit scopes and detached records',()=>{
  let p=pair();p=replace(p,OWNER,command('department.rename',{departmentId:DB,name:'Foreign-company edit'}));p=replace(p,DONNA,command('department.rename',{departmentId:DA,name:'Our-company edit'}));
  const before=copy(p),visible=Studio.readHistory(p.model,p.studio,{actorId:DONNA,limit:10});stateEq(p,before);
  assert.equal(visible.length,1);assert.equal(visible[0].actorId,DONNA);assert.ok(visible[0].scopes.every(s=>s.companyId===A));
  const all=Studio.readHistory(p.model,p.studio,{actorId:OWNER,limit:10});assert.equal(all.length,2);
  const onlyB=Studio.readHistory(p.model,p.studio,{actorId:OWNER,companyId:B,limit:1});assert.equal(onlyB.length,1);assert.ok(onlyB[0].scopes.every(s=>s.companyId===B));
  visible[0].patches[0].after='Detached history value';stateEq(p,before);
  return {ownerEvents:2,companyScopedEvents:1,historyDetached:true};
});

test('Retained idempotency survives later edits and same-key persistence',()=>{
  const start=pair(),first=apply(start,DONNA,command('department.rename',{departmentId:DA,name:'First persisted edit'}));
  const later=apply(first.p,OWNER,command('department.color',{departmentId:DA,color:'#abcdef'})).p;
  const encoded=Studio.encodeSnapshot(later.model,later.studio),root=JSON.parse(encoded);assert.equal(root.version,1);assert.ok(root.studio);assert.equal(root.model,undefined,'Persisted core stays at the existing root');
  const decoded=Studio.decodeSnapshot(encoded);assert.equal(decoded.needsBootstrap,false);assert.deepEqual(decoded.model,later.model);assert.deepEqual(decoded.studio,later.studio);
  const replay=Studio.applyEdit(decoded.model,decoded.studio,first.request);assert.equal(replay.replayed,true);assert.strictEqual(replay.model,decoded.model);assert.strictEqual(replay.studio,decoded.studio);assert.deepEqual(replay.receipt,first.result.receipt);assert.equal(replay.model.departments.find(d=>d.id===DA).color,'#abcdef');
  const reordered={command:{name:first.request.command.name,departmentId:DA,type:'department.rename'},expectedRevision:first.request.expectedRevision,sequence:first.request.sequence,actorId:DONNA};
  assert.equal(Studio.applyEdit(decoded.model,decoded.studio,reordered).replayed,true,'Canonical key order does not change request identity');
  rejected(decoded,()=>Studio.applyEdit(decoded.model,decoded.studio,{...first.request,command:{...first.request.command,name:'Conflicting retry'}}));
  const storage={getItem(key){assert.equal(key,'daftar-blueprint-world-v1');return encoded;}};assert.deepEqual(Core.loadState(storage),later.model,'Old core reads the enhanced root without altering it');
  assert.equal(Studio.encodeSnapshot(decoded.model,decoded.studio),encoded);
  return {retainedRetryReturnsCurrentState:true,sameStorageKey:'daftar-blueprint-world-v1',canonicalKeyOrder:true};
});

test('Receipts and journal are bounded while actor cursors survive eviction',()=>{
  const first=apply(pair(),DONNA,command('department.rename',{departmentId:DA,name:'Long-lived first edit'}));let p=first.p,last;
  for(let i=0;i<130;i++){last=apply(p,OWNER,command('policy.actor.put',{actor:{...p.studio.policy.actors.find(a=>a.id===VISITOR),label:'Visitor label '+i}}));p=last.p;}
  assert.equal(p.studio.receipts.length,64);assert.equal(p.studio.journal.length,128);assert.equal(p.studio.cursors[DONNA],1);assert.equal(p.studio.cursors[OWNER],130);
  const encoded=Studio.encodeSnapshot(p.model,p.studio),decoded=Studio.decodeSnapshot(encoded);p={model:decoded.model,studio:decoded.studio};
  rejected(p,()=>Studio.applyEdit(p.model,p.studio,first.request));assert.equal(Studio.applyEdit(p.model,p.studio,last.request).replayed,true);
  rejectCommand(p,DONNA,command('department.color',{departmentId:DA,color:'#010203'}),{sequence:3});
  const next=apply(p,DONNA,command('department.color',{departmentId:DA,color:'#010203'}));assert.equal(next.request.sequence,2);assert.equal(next.p.studio.cursors[OWNER],130);
  rejectCommand(p,OWNER,command('history.undo',{eventId:first.result.receipt.eventId}));
  return {acceptedCommands:131,retainedReceipts:64,retainedJournalEvents:128,persistedActorCursors:2,evictedRetryRejected:true};
});

test('Undo compensates the latest edit under current grants without rewinding policy',()=>{
  const original=pair(),edited=apply(original,DONNA,command('department.rename',{departmentId:DA,name:'Undo me'}));
  const policyChanged=replace(edited.p,OWNER,command('policy.actor.put',{actor:{...edited.p.studio.policy.actors.find(a=>a.id===VISITOR),label:'Policy survives undo'}}));
  const undone=apply(policyChanged,DONNA,command('history.undo',{eventId:edited.result.receipt.eventId})).p;
  assert.equal(undone.model.departments.find(d=>d.id===DA).name,'Engineering');assert.deepEqual(undone.studio.policy,policyChanged.studio.policy);assert.equal(undone.studio.cursors[DONNA],2);assert.equal(undone.studio.cursors[OWNER],1);assert.equal(lastEvent(undone).undoable,false);assert.equal(lastEvent(undone).undoOf,edited.result.receipt.eventId);
  rejectCommand(undone,DONNA,command('history.undo',{eventId:edited.result.receipt.eventId}));rejectCommand(undone,OWNER,command('history.undo',{eventId:lastEvent(undone).id}));
  const revoked=replace(edited.p,OWNER,command('policy.revoke',{grantId:'gr_donna_a'}));rejectCommand(revoked,DONNA,command('history.undo',{eventId:edited.result.receipt.eventId}));
  const later=replace(edited.p,OWNER,command('department.color',{departmentId:DA,color:'#010203'}));rejectCommand(later,OWNER,command('history.undo',{eventId:edited.result.receipt.eventId}));
  const grant=replace(edited.p,OWNER,command('policy.grant',{grantId:'gr_director_edit',actorId:DIRECTOR,capabilities:['department.rename'],scope:department(A,DA)}));rejectCommand(grant,DIRECTOR,command('history.undo',{eventId:edited.result.receipt.eventId}));
  const ownerUndone=apply(grant,OWNER,command('history.undo',{eventId:edited.result.receipt.eventId})).p;assert.equal(ownerUndone.model.departments.find(d=>d.id===DA).name,'Engineering');
  return {policyOnlyEventsDoNotBlockUndo:true,noRedo:true,revocationRechecked:true,otherActorRequiresUndoAny:true};
});

test('Owner CRUD creates an atomic non-undoable model barrier',()=>{
  const edited=apply(pair(),DONNA,command('department.rename',{departmentId:DA,name:'Before owner work'}));const p=edited.p,nextModel=copy(p.model);Core.addTask(nextModel,{companyId:A,departmentId:DA,title:'Owner task barrier'});
  const before=copy(p),nextBefore=copy(nextModel),studio=Studio.observeOwnerChange(p.model,nextModel,p.studio,{source:'create-task'});stateEq(p,before);assert.deepEqual(nextModel,nextBefore);
  assert.equal(studio.revision,p.studio.revision+1);assert.equal(studio.modelRevision,p.studio.modelRevision+1);assert.deepEqual(studio.policy,p.studio.policy);assert.deepEqual(studio.cursors,p.studio.cursors);assert.deepEqual(studio.receipts,p.studio.receipts);assert.equal(studio.journal.at(-1).undoable,false);
  const barrier={model:nextModel,studio};rejectCommand(barrier,OWNER,command('history.undo',{eventId:edited.result.receipt.eventId}));
  assert.deepEqual(Studio.observeOwnerChange(p.model,copy(p.model),p.studio,{source:'no-change'}),p.studio);
  const overlaps=copy(p.model);overlaps.companies.find(c=>c.id===B).x=1259;
  rejected(p,()=>Studio.observeOwnerChange(p.model,overlaps,p.studio,{source:'invalid-company-move'}));
  const stale=copy(p.model);stale.notes[0].text='Unknown owner change';rejected(p,()=>Studio.observeOwnerChange(stale,nextModel,p.studio,{source:'stale-base'}));
  return {barrierBlocksUndo:true,policyAndCursorsPreserved:true,invalidGeometryRejectedBeforeCommit:true};
});

test('Metadata validation rejects malformed policy, history, fingerprint and caps',()=>{
  const p=pair(),config=policy(p.model),mutations=[
    o=>o.actors.push(copy(o.actors[0])),o=>{o.actors[1].employeeId='em-missing';},o=>{o.actors[1].active='true';},o=>{o.grants.push(copy(o.grants[0]));},o=>{o.grants[1].actorId='act_missing';},o=>{o.grants[1].capabilities=['*'];},o=>{o.grants[1].scope=department(A,DB);},o=>{o.grants[1].issuedAtRevision=1;},o=>{o.grants[1].revokedAtRevision=-1;},o=>{o.grants[1].capabilities=['policy.manage'];}
  ];
  for(const mutate of mutations){const input=copy(config);mutate(input);rejected(p,()=>Studio.createStudio(p.model,input));}
  const accepted=apply(p,DONNA,command('department.rename',{departmentId:DA,name:'History shape'})).p;
  const badStudio=[s=>{s.extra=true;},s=>{s.modelFingerprint='0000000000000000';},s=>{s.cursors[DONNA]=-1;},s=>{s.revision=Number.MAX_SAFE_INTEGER;},s=>{s.journal[0].patches[0].field='companyId';},s=>{s.journal[0].patches[0].collection='tasks';},s=>{s.receipts[0].sequence=0;},s=>{s.journal[0].patches[0].recordId='dp-missing';}];
  for(const mutate of badStudio){const input=copy(accepted.studio);mutate(input);rejected(accepted,()=>Studio.validateStudio(accepted.model,input));}
  const actors=copy(config);while(actors.actors.length<256)actors.actors.push({id:'act_cap_'+actors.actors.length,label:'Capacity actor '+actors.actors.length,role:'visitor',employeeId:null,active:true});assert.equal(Studio.createStudio(p.model,actors).policy.actors.length,256);actors.actors.push({id:'act_overflow',label:'One too many',role:'visitor',employeeId:null,active:true});rejected(p,()=>Studio.createStudio(p.model,actors));
  const grants=copy(config);while(grants.grants.length<1024)grants.grants.push({id:'gr_cap_'+grants.grants.length,actorId:VISITOR,capabilities:['department.color'],scope:department(A,DA),issuedBy:OWNER,issuedAtRevision:0,revokedAtRevision:null});assert.equal(Studio.createStudio(p.model,grants).policy.grants.length,1024);grants.grants.push({...copy(grants.grants.at(-1)),id:'gr_overflow'});rejected(p,()=>Studio.createStudio(p.model,grants));
  return {badBootstrapCases:mutations.length,badMetadataCases:badStudio.length,actorBoundary:256,grantBoundary:1024};
});

test('Legacy decoding, present corruption and the 2-MiB combined byte cap',()=>{
  const model=Core.validateState(basicFixture()),legacy=JSON.stringify(model),decoded=Studio.decodeSnapshot(legacy);assert.deepEqual(decoded.model,model);assert.equal(decoded.studio,null);assert.equal(decoded.needsBootstrap,true);
  const p=pair(),encoded=Studio.encodeSnapshot(p.model,p.studio),before=copy(p);assert.ok(Buffer.byteLength(encoded,'utf8')<=2097152);assert.equal(Studio.decodeSnapshot(encoded).needsBootstrap,false);stateEq(p,before);
  for(const text of ['{broken','null','[]',JSON.stringify({...model,studio:null}),JSON.stringify({...model,studio:{format:'daftar-blueprint-studio',version:1}})])rejected(p,()=>Studio.decodeSnapshot(text));
  const atLimit=legacy+' '.repeat(2097152-Buffer.byteLength(legacy,'utf8'));assert.equal(Buffer.byteLength(atLimit,'utf8'),2097152);assert.equal(Studio.decodeSnapshot(atLimit).needsBootstrap,true);rejected(p,()=>Studio.decodeSnapshot(atLimit+' '));
  const corrupt=JSON.parse(encoded);corrupt.studio.policy.grants[0].capabilities=['*'];rejected(p,()=>Studio.decodeSnapshot(JSON.stringify(corrupt)));
  const olderCore=Core.validateState(JSON.parse(encoded));assert.equal(olderCore.studio,undefined);assert.equal(Studio.decodeSnapshot(JSON.stringify(olderCore)).needsBootstrap,true,'Metadata loss is reported; no grants are invented');
  return {legacyNeedsExplicitBootstrap:true,presentCorruptionFails:true,combinedByteLimit:2097152,exactLimitAccepted:true};
});

const receipt={artifactType:'blueprint-studio-independent-validation/v1',run:'blueprint-studio-20261121',node:'verification',attempt:1,idempotencyKey:'blueprint-studio-20261121:verification:1',terminationOwner:'root',createdAt:new Date().toISOString(),status:results.every(x=>x.status==='passed')?'passed':'failed',groups:results.length,passed:results.filter(x=>x.status==='passed').length,failed:results.filter(x=>x.status==='failed').length,environment:{node:process.version,execution:'Pure Node module calls; no DOM, browser, GPU, network, provider or storage side effects introduced by harness'},provenance:{contract:{path:path.relative(repo,contractPath),bytes:contractBytes.length,sha256:contractHash},module:{path:path.relative(repo,sourcePath),bytes:sourceBytes.length,sha256:sourceHash},core:{path:path.relative(repo,corePath),sha256:hash(fs.readFileSync(corePath))},fixtures:{path:'design/blueprint-world/validation/fixtures.mjs',sha256:hash(fs.readFileSync(path.join(here,'fixtures.mjs')))},harness:{path:'design/blueprint-world/validation/check-studio.mjs',sha256:hash(fs.readFileSync(fileURLToPath(import.meta.url)))}},limitations:['Local Studio capability checks are not server authentication, account grants or secure data ownership.','Fingerprint is change detection only, not proof against metadata tampering.','No app form integration, pointer delivery, browser focus, graphics, cross-tab CAS or GPU behavior is exercised.','The accepted core module is a dependency for canonical state, layout and move clamping; independent fixtures and state-transition expectations do not import Studio implementation helpers.'],results};
const output=path.resolve(process.argv[3]||path.join(here,`studio-receipt-${sourceHash.slice(0,12)}.json`));fs.writeFileSync(output,JSON.stringify(receipt,null,2)+'\n');
console.log(JSON.stringify({status:receipt.status,passed:receipt.passed,groups:receipt.groups,moduleSha256:sourceHash,receipt:path.relative(repo,output)}));
if(receipt.failed)process.exitCode=1;
