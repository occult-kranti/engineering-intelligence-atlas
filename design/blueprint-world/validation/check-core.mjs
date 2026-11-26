// Director run blueprint-world-20261121 / verification / attempt 1.
// Execute only after the director accepts the concrete core artifact.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {copy,basicFixture,companiesFixture,hierarchicalFixture,addFixtureEmployee,fillEmployees,assignmentCapacityFixture,departmentCapacityFixture,fillTasks,fillNotes,DEPARTMENT_NAMES} from './fixtures.mjs';

const directory=path.dirname(fileURLToPath(import.meta.url));
const repository=path.resolve(directory,'../../..');
const sourcePath=path.resolve(process.argv[2]||path.join(repository,'cloud-workspace/public/concepts/blueprint-world-core.js'));
const contractBytes=fs.readFileSync(path.join(directory,'core-contract.json'));
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const contractHash=hash(contractBytes);
assert.equal(contractHash,'63fdb32f46975a5b4ba0599f99c4f69cb8601d8ac23c56e594e67aa984bc1cce','Frozen director contract changed');
const contract=JSON.parse(contractBytes);
const sourceBytes=fs.readFileSync(sourcePath),sourceHash=hash(sourceBytes);
const core=await import(pathToFileURL(sourcePath).href);
const results=[];
const A='co-fixture-0',B='co-fixture-1',DA='dp-0-engineering',DB='dp-1-engineering';
const EPS=1e-7;
const near=(actual,expected,tolerance=EPS)=>assert.ok(Number.isFinite(actual)&&Math.abs(actual-expected)<=tolerance,`${actual} differs from ${expected} by more than ${tolerance}`);
const unchanged=(state,before)=>assert.deepEqual(state,before,'Operation changed state outside its allowed successful commit');
const worker=(state,companyId)=>state.employees.find(e=>e.homeCompanyId===companyId&&e.name==='Sam Same');
const freeze=object=>{if(object&&typeof object==='object'&&!Object.isFrozen(object)){Object.freeze(object);Object.values(object).forEach(freeze);}return object;};
function reject(state,operation){const before=copy(state);assert.throws(operation,e=>e instanceof Error&&e.message.trim().length>0,'Expected a human-readable Error');unchanged(state,before);}
function invalid(raw){const before=copy(raw);assert.throws(()=>core.validateState(raw),e=>e instanceof Error&&e.message.trim().length>0);unchanged(raw,before);}
function independentRect(outer,inner,tolerance=EPS){return inner.x>=outer.x-tolerance&&inner.y>=outer.y-tolerance&&inner.x+inner.w<=outer.x+outer.w+tolerance&&inner.y+inner.h<=outer.y+outer.h+tolerance;}
function independentCircle(rect,circle,tolerance=EPS){return circle.x-circle.r>=rect.x-tolerance&&circle.y-circle.r>=rect.y-tolerance&&circle.x+circle.r<=rect.x+rect.w+tolerance&&circle.y+circle.r<=rect.y+rect.h+tolerance;}
function interiorsOverlap(a,b){return Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x)>EPS&&Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y)>EPS;}
function test(name,body){const start=performance.now();try{const detail=body();results.push({name,status:'passed',durationMs:Math.round(performance.now()-start),...detail});}catch(error){results.push({name,status:'failed',error:String(error?.message||error)});}}

test('frozen exports, limits, deterministic seed, and canonical seed identities',()=>{
  for(const name of contract.exports)assert.ok(name in core,`Missing export ${name}`);
  for(const [key,value] of Object.entries(contract.limits))assert.equal(core.LIMITS[key],value,`LIMITS.${key}`);
  for(const [key,value] of Object.entries(contract.colors))assert.equal(core.COLORS[key],value,`COLORS.${key}`);
  const first=core.seedState(),second=core.seedState();assert.deepEqual(first,second);assert.notEqual(first,second);
  core.validateState(first);assert.equal(first.companies.length,3);assert.equal(first.employees.length,36);assert.equal(first.assignments.length,38);assert.equal(first.tasks.length,18);assert.equal(first.notes.length,6);
  for(const expected of contract.seed.companies){const company=first.companies.find(c=>c.id===expected.id);assert.ok(company);for(const [key,value] of Object.entries(expected))assert.equal(company[key],value);assert.equal(company.width,1100);}
  for(const company of first.companies){assert.deepEqual(first.departments.filter(d=>d.companyId===company.id&&d.parentId===null).map(d=>d.name).sort(),[...DEPARTMENT_NAMES].sort());}
  assert.equal(first.assignments.filter(a=>a.kind==='shared').length,1);assert.equal(first.assignments.filter(a=>a.kind==='visiting').length,1);
  first.companies[0].name='Changed only in one seed';assert.notEqual(first.companies[0].name,second.companies[0].name);
  return {companies:3,employees:36,assignments:38,tasks:18,notes:6};
});

test('independent fixture normalization and invalid graph/schema rejection',()=>{
  const raw=basicFixture(),before=copy(raw),normalized=core.validateState(raw);unchanged(raw,before);assert.notEqual(normalized,raw);assert.notEqual(normalized.companies,raw.companies);
  normalized.companies[0].name='Independent result';unchanged(raw,before);
  const cases=[
    s=>{s.version=2;},s=>{s.tasks=null;},s=>{s.companies.push(copy(s.companies[0]));},s=>{s.employees.push(copy(s.employees[0]));},
    s=>{s.companies[0].parentId=B;s.companies[1].parentId=A;},s=>{s.companies[0].parentId='co-missing';},
    s=>{s.departments[0].parentId=s.departments[1].id;s.departments[1].parentId=s.departments[0].id;},
    s=>{s.departments[0].officeId='of-fixture-1';},s=>{s.offices.push({id:'of-extra',companyId:A,name:'Unexpected second office'});},
    s=>{s.employees.find(e=>e.id==='em-director-0').reportsToId='em-donna-0';},
    s=>{s.employees[0].reportsToId='em-director-1';},s=>{s.assignments.push({...s.assignments[0],id:'as-duplicate-pair'});},
    s=>{s.assignments[0].companyId=B;s.assignments[0].departmentId=DB;},
    s=>{s.tasks[0].ownerId=worker(s,B).id;},s=>{s.tasks[0].ownerId=s.assignments[0].id;},
    s=>{s.notes[0].x=12;s.notes[0].y=null;},s=>{s.companies[0].x=Infinity;},s=>{s.companies[0].x=1000001;},
    s=>{s.departments[0].color='not-a-color';},s=>{s.assignments[0].departmentId='restricted';}
  ];
  for(const mutate of cases){const state=basicFixture();mutate(state);invalid(state);}
  for(const value of [null,[],false,42,'invalid'])invalid(value);
  return {independentFixture:true,malformedCases:cases.length+5};
});

test('same-name company records stay isolated through successful workflow and reload',()=>{
  const state=basicFixture(),beforeB={tasks:copy(core.companyTasks(state,B)),notes:copy(core.companyNotes(state,B)),employees:copy(core.companyEmployees(state,B))};
  const alpha=worker(state,A),beta=worker(state,B);assert.notEqual(alpha.id,beta.id);assert.equal(alpha.name,beta.name);
  const task=core.addTask(state,{companyId:A,departmentId:DA,title:'Plan release',ownerId:alpha.id});assert.equal(task.companyId,A);assert.equal(task.ownerId,alpha.id);assert.equal(task.status,'todo');assert.equal(task.lane,'now');
  core.updateTask(state,task.id,{status:'done',lane:'later',title:'Changed in A only'});
  const note=core.addNote(state,{companyId:A,text:'Same note text'});assert.equal(note.color,'#e6cb7f');core.updateNote(state,note.id,{text:'A note only'});
  assert.deepEqual(core.companyTasks(state,B),beforeB.tasks);assert.deepEqual(core.companyNotes(state,B),beforeB.notes);assert.deepEqual(core.companyEmployees(state,B),beforeB.employees);
  let text='';const storage={setItem(key,value){assert.equal(key,contract.storage.key);text=value;},getItem(key){assert.equal(key,contract.storage.key);return text;}};
  assert.equal(core.saveState(storage,state).ok,true);const loaded=core.loadState(storage);assert.deepEqual(core.companyTasks(loaded,B),beforeB.tasks);assert.equal(core.companyTasks(loaded,A).find(t=>t.id===task.id).status,'done');
  assert.equal(core.companyNotes(loaded,A).find(n=>n.id===note.id).text,'A note only');
  return {identicalEmployeeLabels:2,companiesKeptIsolated:2,persistedScopedEdits:2};
});

test('creation remains local, IDs survive same-clock additions, and parentage grants no ownership',()=>{
  const state=basicFixture(),oldCount=state.employees.length,oldCompanyCount=state.companies.length;
  const company=core.createCompany(state,{name:'New local company',parentId:A});assert.equal(company.parentId,A);assert.equal(state.companies.length,oldCompanyCount+1);assert.equal(state.employees.length,oldCount+2);
  assert.equal(state.offices.filter(o=>o.companyId===company.id).length,1);assert.equal(state.departments.filter(d=>d.companyId===company.id).length,6);
  const leadership=state.departments.find(d=>d.companyId===company.id&&d.name==='Leadership');assert.ok(leadership);
  const employee=core.hireEmployee(state,{companyId:company.id,departmentId:leadership.id,name:'Sam Same',role:'Local worker'});
  assert.equal(employee.homeCompanyId,company.id);assert.equal(employee.reportsToId,company.directorId);assert.equal(state.assignments.filter(a=>a.employeeId===employee.id).length,1);
  reject(state,()=>core.addTask(state,{companyId:company.id,title:'Parent is not membership',ownerId:worker(state,A).id}));
  const now=Date.now;let one,two;try{Date.now=()=>1700000000000;one=core.addTask(state,{companyId:A,title:'Same-clock task'});two=core.addTask(state,{companyId:A,title:'Same-clock task'});}finally{Date.now=now;}
  assert.notEqual(one.id,two.id);core.validateState(state);
  return {newEmployeesPerCompany:2,explicitHireAssignments:1,sameClockUniqueTasks:2};
});

test('shared identity and nested scope eligibility use explicit assignments',()=>{
  const state=hierarchicalFixture(),alpha=worker(state,A),canonicalCount=state.employees.length;
  state.assignments.push({id:'as-shared-host',employeeId:alpha.id,companyId:B,departmentId:DB,kind:'shared',x:null,y:null});core.validateState(state);
  const hosted=core.companyEmployees(state,B).filter(e=>e.id===alpha.id);assert.equal(hosted.length,1);assert.equal(hosted[0].assignmentId,'as-shared-host');assert.equal(hosted[0].homeCompanyId,A);assert.equal(state.employees.length,canonicalCount);
  const nested=state.employees.find(e=>e.name==='Nested worker');const scoped=core.describeScope(state,A,DA);assert.equal(scoped.employeeCount,2);assert.equal(scoped.taskCount,3);assert.equal(scoped.doneTaskCount,1);assert.equal(scoped.openTaskCount,2);assert.equal(scoped.unassignedTaskCount,1);assert.equal(scoped.noteCount,1);
  const child=core.describeScope(state,A,'dp-child');assert.equal(child.employeeCount,1);assert.equal(child.taskCount,2);assert.match(scoped.summary,/definition/i);
  core.addTask(state,{companyId:A,departmentId:DA,title:'Owner in descendant',ownerId:nested.id});
  core.addTask(state,{companyId:B,departmentId:DB,title:'Owner through explicit host',ownerId:alpha.id});
  reject(state,()=>core.addTask(state,{companyId:A,departmentId:'dp-grandchild',title:'Ancestor assignment is not descendant eligibility',ownerId:alpha.id}));
  assert.throws(()=>core.describeScope(state,A,DB));assert.throws(()=>core.describeScope(state,'co-missing'));
  return {sharedCanonicalEmployeeCount:1,explicitHostAssignments:1,nestedScopeTasks:3,localScopeOnly:true};
});

test('failed mutations reject before any partial commit',()=>{
  const operations=[
    s=>core.createCompany(s,{name:'  '}),s=>core.createCompany(s,{name:'Child',parentId:'co-missing'}),
    s=>core.createDepartment(s,{companyId:A,officeId:'of-fixture-1',name:'Cross-office'}),s=>core.createDepartment(s,{companyId:A,parentId:DB,name:'Cross-company'}),
    s=>core.hireEmployee(s,{companyId:A,departmentId:DB,name:'Mis-scoped',role:'Engineer'}),s=>core.hireEmployee(s,{companyId:A,departmentId:DA,name:'Bad kind',role:'Engineer',kind:'owner'}),
    s=>core.addTask(s,{companyId:A,departmentId:DB,title:'Wrong company'}),s=>core.addTask(s,{companyId:A,title:'Wrong owner',ownerId:worker(s,B).id}),
    s=>core.updateTask(s,'tk-fixture-0',{companyId:B}),s=>core.updateTask(s,'tk-fixture-0',{id:'tk-reassigned'}),s=>core.updateTask(s,'tk-fixture-0',{status:'unknown'}),
    s=>core.addNote(s,{companyId:'co-missing',text:'Missing scope'}),s=>core.updateNote(s,'nt-fixture-0',{companyId:B}),s=>core.updateNote(s,'nt-fixture-0',{x:10,y:null}),s=>core.updateNote(s,'nt-fixture-0',{color:'red'}),
    s=>core.moveAssignment(s,s.assignments[0].id,{x:NaN,y:0}),s=>core.moveAssignment(s,'as-missing',{x:10,y:10}),
    s=>core.hireEmployee(s,{companyId:A,departmentId:DA,name:'n'.repeat(61),role:'Engineer'}),s=>core.addTask(s,{companyId:A,title:'t'.repeat(301)}),s=>core.addNote(s,{companyId:A,text:'n'.repeat(301)})
  ];
  for(const operation of operations){const state=basicFixture();reject(state,()=>operation(state));}
  return {atomicRejections:operations.length};
});

test('global capacities and hierarchy boundaries are inclusive and atomic',()=>{
  const cases=[
    {name:'companies',state:companiesFixture(100),count:100,operation:s=>core.createCompany(s,{name:'Beyond capacity'})},
    {name:'employees',state:fillEmployees(basicFixture(),1000),count:1000,operation:s=>core.hireEmployee(s,{companyId:A,departmentId:DA,name:'Beyond capacity',role:'Engineer'})},
    {name:'assignments',state:assignmentCapacityFixture(),count:2000,operation:s=>core.hireEmployee(s,{companyId:A,departmentId:DA,name:'Beyond assignment capacity',role:'Engineer'})},
    {name:'departments',state:departmentCapacityFixture(),count:4096,operation:s=>core.createDepartment(s,{companyId:A,name:'Beyond department capacity'})},
    {name:'tasks',state:fillTasks(basicFixture(),500),count:500,operation:s=>core.addTask(s,{companyId:A,title:'Beyond capacity'})},
    {name:'notes',state:fillNotes(basicFixture(),500),count:500,operation:s=>core.addNote(s,{companyId:A,text:'Beyond capacity'})}
  ];
  for(const item of cases){assert.equal(item.state[item.name].length,item.count);core.validateState(item.state);reject(item.state,()=>item.operation(item.state));}
  const roots=basicFixture();for(let i=6;i<32;i++)core.createDepartment(roots,{companyId:A,name:`Root ${i}`});reject(roots,()=>core.createDepartment(roots,{companyId:A,name:'Root 33'}));
  const nested=basicFixture();let first;for(let i=0;i<4;i++){const child=core.createDepartment(nested,{companyId:A,parentId:DA,name:`Child ${i}`});first??=child.id;}reject(nested,()=>core.createDepartment(nested,{companyId:A,parentId:DA,name:'Child 5'}));
  const grand=core.createDepartment(nested,{companyId:A,parentId:first,name:'Grandchild'});reject(nested,()=>core.createDepartment(nested,{companyId:A,parentId:grand.id,name:'Depth 3'}));
  return {capacities:cases.map(({name,count})=>({name,count})),rootCap:32,childCap:4,maxDepth:2};
});

test('queries are copied, pure, bounded, and exclude the restricted placeholder',()=>{
  const state=basicFixture(),alpha=worker(state,A);state.assignments.push({id:'as-search-host',employeeId:alpha.id,companyId:B,departmentId:DB,kind:'shared',x:null,y:null});
  for(let i=0;i<70;i++)state.tasks.push({id:`tk-search-${i}`,companyId:A,departmentId:null,title:`Searchable ${i}`,ownerId:null,status:'todo',lane:'now'});
  core.validateState(state);const before=copy(state);freeze(state);
  const employees=core.companyEmployees(state,A),tasks=core.companyTasks(state,A),notes=core.companyNotes(state,A);employees[0].name='Changed query result';tasks[0].title='Changed query result';notes[0].text='Changed query result';unchanged(state,before);
  for(const query of [core.companyEmployees,core.companyTasks,core.companyNotes])assert.deepEqual(query(state,'co-missing'),[]);
  assert.deepEqual(core.searchRecords(state,''),[]);assert.deepEqual(core.searchRecords(state,'  '),[]);
  const found=core.searchRecords(state,'  sAm SaMe  ').filter(r=>r.type==='employee');assert.equal(found.length,3);assert.equal(new Set(found.map(r=>r.assignmentId)).size,3);
  assert.equal(core.searchRecords(state,'Searchable').length,60);
  const restricted=core.companyLayout(state,A).rooms.find(r=>r.restricted);assert.ok(restricted);assert.equal(restricted.departmentId,null);assert.ok(!core.searchRecords(state,restricted.name).some(r=>r.id===restricted.id));
  unchanged(state,before);return {copiedQueryTypes:3,sameLabelAssignmentResults:3,searchResultCap:60,restrictedRecordExcluded:true};
});

test('storage adapters round-trip scoped data and fail without mutation',()=>{
  const state=hierarchicalFixture(),before=copy(state);let encoded=null,reads=0,writes=0;
  const storage={getItem(key){assert.equal(this,storage);assert.equal(key,contract.storage.key);reads++;return encoded;},setItem(key,value){assert.equal(this,storage);assert.equal(key,contract.storage.key);writes++;encoded=value;}};
  assert.equal(core.saveState(storage,state).ok,true);assert.equal(reads,0);assert.equal(writes,1);assert.ok(typeof encoded==='string');assert.ok(Buffer.byteLength(encoded,'utf8')<=2097152);
  assert.deepEqual(core.loadState(storage),core.validateState(state));assert.equal(reads,1);unchanged(state,before);
  const badRecords=[null,'{broken','null','[]',JSON.stringify({...state,version:2}),' '.repeat(2097153),JSON.stringify({...state,companies:[]})];
  for(const raw of badRecords){const restored=core.loadState({getItem(){return raw;}});assert.deepEqual(restored,core.seedState());}
  for(const adapter of [undefined,{}, {getItem(){throw new Error('unavailable');}}])assert.deepEqual(core.loadState(adapter),core.seedState());
  for(const adapter of [undefined,{}, {setItem(){throw new Error('quota');}}]){const result=core.saveState(adapter,state);assert.equal(result.ok,false);assert.ok(typeof result.error==='string'&&result.error.length>0);unchanged(state,before);}
  const invalidState=copy(state);invalidState.tasks[0].ownerId='em-missing';let invalidWrites=0;const result=core.saveState({setItem(){invalidWrites++;}},invalidState);assert.equal(result.ok,false);assert.equal(invalidWrites,0);
  return {roundTrips:1,loadFailureCases:10,saveFailureCases:4,noImplicitStorage:true};
});

test('geometry predicates honor whole footprints and finite-input boundaries',()=>{
  const outer={x:10,y:20,w:100,h:80};
  const rectCases=[{r:{x:10,y:20,w:100,h:80},ok:true},{r:{x:10,y:20,w:0,h:0},ok:true},{r:{x:9,y:20,w:1,h:1},ok:false},{r:{x:109,y:20,w:2,h:1},ok:false},{r:{x:10,y:99,w:1,h:2},ok:false},{r:{x:10,y:20,w:-1,h:2},ok:false},{r:{x:NaN,y:20,w:1,h:1},ok:false}];
  for(const {r,ok} of rectCases)assert.equal(core.containsRect(outer,r),ok);
  const circleCases=[{c:{x:28,y:38,r:18},ok:true},{c:{x:27,y:38,r:18},ok:false},{c:{x:92,y:82,r:18},ok:true},{c:{x:93,y:82,r:18},ok:false},{c:{x:30,y:30,r:-1},ok:false},{c:{x:Infinity,y:30,r:1},ok:false}];
  for(const {c,ok} of circleCases)assert.equal(core.containsCircle(outer,c),ok);
  const translated={x:900010,y:900020,w:100,h:80};assert.equal(core.containsRect(translated,{x:900020,y:900030,w:10,h:10}),true);assert.equal(core.containsCircle(translated,{x:900028,y:900038,r:18}),true);
  assert.equal(core.containsRect(outer,{x:10-EPS/2,y:20,w:1,h:1},EPS),true);assert.equal(core.containsRect(outer,{x:10-2*EPS,y:20,w:1,h:1},EPS),false);
  assert.deepEqual(core.clampPoint({x:-100,y:1000},outer,18),{x:28,y:82});assert.deepEqual(core.clampPoint({x:50,y:60},outer,18),{x:50,y:60});
  for(const operation of [()=>core.clampPoint({x:NaN,y:0},outer),()=>core.clampPoint({x:10,y:20},{x:0,y:0,w:10,h:10},6),()=>core.clampPoint({x:10,y:20},outer,-1)])assert.throws(operation);
  return {rectangleCases:rectCases.length,circleCases:circleCases.length,largeTranslationCases:2,explicitEpsilon:EPS,clampCases:5};
});

test('nested layout bounds, sibling separation, radius and automatic spacing are independent',()=>{
  const state=hierarchicalFixture();for(let i=0;i<18;i++)addFixtureEmployee(state,0,DA,`Auto ${i}`);core.validateState(state);
  const before=copy(state);freeze(state);const layout=core.companyLayout(state,A),again=core.companyLayout(state,A);assert.deepEqual(layout,again);unchanged(state,before);
  assert.equal(layout.width,1100);assert.ok(Number.isFinite(layout.height)&&layout.height>0);const company={x:0,y:0,w:1100,h:layout.height};
  const roomMap=new Map(layout.rooms.filter(r=>r.departmentId).map(r=>[r.departmentId,r]));
  for(const room of layout.rooms){assert.ok([room.x,room.y,room.w,room.h].every(Number.isFinite));assert.ok(room.w>0&&room.h>0);assert.ok(independentRect(company,room),`Room outside company: ${room.id}`);}
  for(const department of state.departments.filter(d=>d.companyId===A)){const room=roomMap.get(department.id);assert.ok(room);if(department.parentId)assert.ok(independentRect(roomMap.get(department.parentId),room),`Child outside parent: ${department.id}`);}
  const departments=state.departments.filter(d=>d.companyId===A);
  for(let i=0;i<departments.length;i++)for(let j=i+1;j<departments.length;j++){const a=departments[i],b=departments[j];if(a.parentId===b.parentId)assert.equal(interiorsOverlap(roomMap.get(a.id),roomMap.get(b.id)),false,`Sibling rooms overlap: ${a.id}/${b.id}`);}
  assert.deepEqual(layout.boards.map(b=>b.type).sort(),['hierarchy','ownership','roadmap','whiteboard']);
  const bottom=Math.max(...layout.rooms.map(r=>r.y+r.h));for(const board of layout.boards){assert.ok(independentRect(company,board));assert.ok(board.y>=bottom+48-EPS,'Board overlaps room region');}
  const assignments=new Map(state.assignments.filter(a=>a.companyId===A).map(a=>[a.id,a]));assert.equal(layout.seats.length,assignments.size);
  for(const seat of layout.seats){assert.equal(seat.r,18);const assignment=assignments.get(seat.assignmentId);assert.ok(assignment);assert.ok(independentCircle(roomMap.get(assignment.departmentId),seat),`Circle escaped room: ${seat.assignmentId}`);}
  let pairs=0;for(let i=0;i<layout.seats.length;i++)for(let j=i+1;j<layout.seats.length;j++){const a=layout.seats[i],b=layout.seats[j],aa=assignments.get(a.assignmentId),bb=assignments.get(b.assignmentId);if(aa.departmentId===bb.departmentId&&aa.x===null&&bb.x===null){assert.ok(Math.hypot(a.x-b.x,a.y-b.y)>=64-EPS,`Automatic circle spacing below 64: ${a.assignmentId}/${b.assignmentId}`);pairs++;}}
  assert.throws(()=>core.companyLayout(state,'co-missing'));unchanged(state,before);return {rooms:layout.rooms.length,boards:layout.boards.length,seats:layout.seats.length,automaticSpacingPairs:pairs,radius:18,minimumSpacing:64};
});

test('movement changes presentation only and clamps full circle/note footprints',()=>{
  const state=hierarchicalFixture(),assignment=state.assignments.find(a=>a.employeeId===worker(state,A).id),scope={employeeId:assignment.employeeId,companyId:assignment.companyId,departmentId:assignment.departmentId,kind:assignment.kind};
  for(const point of [{x:-100000,y:-100000},{x:100000,y:100000},{x:0,y:0},{x:550,y:500}]){
    const result=core.moveAssignment(state,assignment.id,point);assert.equal(result.id,assignment.id);for(const [key,value] of Object.entries(scope))assert.equal(result[key],value);
    const layout=core.companyLayout(state,A),room=layout.rooms.find(r=>r.departmentId===scope.departmentId),seat=layout.seats.find(s=>s.assignmentId===assignment.id);assert.ok(independentCircle(room,seat));near(seat.x,room.x+result.x);near(seat.y,room.y+result.y);
    const children=state.departments.filter(d=>d.parentId===scope.departmentId).map(d=>layout.rooms.find(r=>r.departmentId===d.id));for(const child of children)assert.ok(seat.y+seat.r<=child.y+EPS,'Parent assignment entered nested child region');
  }
  const beforeB=copy(core.companyNotes(state,B));for(const point of [{x:-10000,y:-10000},{x:10000,y:10000}]){const note=core.updateNote(state,'nt-fixture-0',point),board=core.companyLayout(state,A).boards.find(b=>b.type==='whiteboard');assert.ok(independentRect({x:0,y:0,w:board.w,h:board.h},{x:note.x,y:note.y,w:80,h:48}));}
  assert.deepEqual(core.companyNotes(state,B),beforeB);core.validateState(state);return {circleClampCases:4,noteClampCases:2,ownershipUnchanged:true};
});

const sourceRelative=path.relative(repository,sourcePath);
const receipt={
  artifactType:'blueprint-world-verification-receipt/v1',runId:'blueprint-world-20261121',nodeId:'verification',attempt:1,idempotencyKey:'blueprint-world-20261121:verification:1',terminationOwner:'root',
  contract:{path:'design/blueprint-world/validation/core-contract.json',sha256:contractHash},
  skill:{name:'computational-geometry-engineering',sha256:'b8c010435bc591fc4d97ddbf90d560d034ff876264254af7889bfba2cdffbce4',registryHashesMatched:true},
  source:{path:sourceRelative.startsWith('..')?path.basename(sourcePath):sourceRelative.split(path.sep).join('/'),sha256:sourceHash,bytes:sourceBytes.length},
  fixtures:{path:'design/blueprint-world/validation/fixtures.mjs',sha256:hash(fs.readFileSync(path.join(directory,'fixtures.mjs')))},
  harness:{path:'design/blueprint-world/validation/check-core.mjs',sha256:hash(fs.readFileSync(fileURLToPath(import.meta.url)))},
  environment:{node:process.version,execution:'CPU-only ES-module contract and geometry checks; no browser, server, provider or GPU context'},
  geometryContract:{representation:'Axis-aligned company-local rectangles and flat circles; department graph',units:'Abstract interface world units; no physical length inferred',axes:'Core x/y map to renderer world X/Z; world Y is a renderer depth layer',precision:'JavaScript binary64',containmentTolerance:EPS,automaticSeatRadius:18,automaticSeatSpacing:64,topology:'Planar open shapes; no manifold, watertightness or physical-engineering claim'},
  at:new Date().toISOString(),groupCount:results.length,results,passed:results.every(r=>r.status==='passed'),
  limitations:['No actual WebGL initialization, GPU compositing, browser hit testing, visual or accessibility-tree evidence.','Scope checks validate local record relationships and owner eligibility, not real grants or authentication.','Renderer camera and spring modules require separate source handoff; they are not imported or simulated by this harness.','The prior standalone prototype 15-group receipt remains historical and is not evidence for this core.']
};
const outputPath=path.resolve(process.argv[3]||path.join(directory,`core-receipt-${sourceHash.slice(0,12)}.json`));
fs.mkdirSync(path.dirname(outputPath),{recursive:true});fs.writeFileSync(outputPath,JSON.stringify(receipt,null,2)+'\n');
console.log(JSON.stringify(receipt,null,2));process.exitCode=receipt.passed?0:1;
