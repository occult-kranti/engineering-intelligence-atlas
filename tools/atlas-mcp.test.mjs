import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { createToolHandler, createMessageProcessor, createNativeCall, parseRepository, TOOL_DEFINITIONS, InvalidParams, SERVER_INFO, NATIVE_OUTPUT_LIMIT, TOOL_OUTPUT_LIMIT, OFFICE_QUERY_PAGE_BYTES } from './atlas-mcp.mjs';

const seed = { company:{owner:'occult-kranti',repo:'engineering-intelligence-atlas'},employees:[{id:'github'}],tasks:[{id:'repair'}],milestones:[] };
function fixture(fetchImpl=async()=>{throw new Error('unexpected network');}) {
  const calls=[];
  const nativeCall=async(command,payload)=>{calls.push({command,payload});return {ok:true,snapshot:seed};};
  return {calls,handler:createToolHandler({nativeCall,fetchImpl})};
}
const meta={full_name:'occult-kranti/engineering-intelligence-atlas',default_branch:'main',description:'Atlas',stargazers_count:1,open_issues_count:0,pushed_at:'2026-11-20T16:00:00Z'};
const json=value=>new Response(JSON.stringify(value),{status:200,headers:{'Content-Type':'application/json'}});

test('normalizes known GitHub repository URL variants',()=>{
  for(const input of ['occult-kranti/engineering-intelligence-atlas','https://github.com/occult-kranti/engineering-intelligence-atlas','https://github.com/occult-kranti/engineering-intelligence-atlas.git/']) assert.equal(parseRepository(input).repo,'engineering-intelligence-atlas');
});
test('rejects credential-bearing, ambiguous and non-GitHub references',()=>{
  for(const input of ['https://user:pass@github.com/o/r','https://github.com/o/r?token=x','https://github.com/o/r#x','https://evil.example/o/r','http://github.com/o/r','https://github.com/o/../r','https://github.com/o/%2e%2e','https://github.com:443/o/r','../r','o/r/branch']) assert.throws(()=>parseRepository(input),InvalidParams,input);
});
test('read-only roster and roadmap never mutate or call GitHub',async()=>{
  const f=fixture();assert.deepEqual((await f.handler('team_list',{})).employees,[{id:'github'}]);await f.handler('roadmap_list',{});assert.deepEqual(f.calls.map(c=>c.command),['snapshot','snapshot']);
});
test('registration reads live metadata and commit then persists a verified payload',async()=>{
  const urls=[];const f=fixture(async(url,options)=>{urls.push(url);assert.equal(options.redirect,'error');return json(url.includes('/git/ref/')?{object:{sha:'a'.repeat(40)}}:meta);});
  const result=await f.handler('company_register',{repository:'occult-kranti/engineering-intelligence-atlas'});
  assert.equal(result.registered,true);assert.equal(urls.length,2);assert.match(urls[1],/\/git\/ref\/heads\/main$/);assert.equal(f.calls[0].command,'register_company');assert.equal(f.calls[0].payload.headSha,'a'.repeat(40));
});
test('invalid commit never registers a company',async()=>{
  const f=fixture(async url=>json(url.includes('/git/ref/')?{object:{sha:'oops'}}:meta));await assert.rejects(f.handler('company_register',{repository:'occult-kranti/engineering-intelligence-atlas'}));assert.equal(f.calls.some(c=>c.command==='register_company'),false);
});
test('metadata from a different repository is rejected',async()=>{
  const f=fixture(async()=>json({...meta,full_name:'someone/else'}));await assert.rejects(f.handler('company_register',{repository:'occult-kranti/engineering-intelligence-atlas'}));assert.equal(f.calls.some(c=>c.command==='register_company'),false);
});
test('GitHub failure records only a failed check for matching local company',async()=>{
  const f=fixture(async()=>new Response('',{status:429}));await assert.rejects(f.handler('company_register',{repository:'occult-kranti/engineering-intelligence-atlas'}));assert.equal(f.calls.at(-1).command,'record_github_check');assert.equal(f.calls.at(-1).payload.ok,false);
});
test('completion requires evidence and rejects unrecognized fields',async()=>{
  const f=fixture();await assert.rejects(f.handler('roadmap_update',{id:'repair',status:'done',evidence:' '}));await assert.rejects(f.handler('roadmap_update',{id:'repair',status:'done',evidence:'tests passed',shell:'rm'}));assert.equal(f.calls.length,0);
});
test('roadmap changes use only the native state command',async()=>{
  const f=fixture();await f.handler('roadmap_update',{id:'repair',status:'done',evidence:'test report'});assert.deepEqual(f.calls[0],{command:'update_task',payload:{id:'repair',status:'done',evidence:'test report'}});
});
test('office command cannot override the action or choose paths/commands',async()=>{
  const f=fixture();await assert.rejects(f.handler('office_command',{action:'hire_employee',payload:{action:'evil'}}));await assert.rejects(f.handler('office_command',{action:'shell',payload:{}}));await f.handler('office_command',{action:'pause_employee',payload:{employeeId:'e'}});assert.equal(f.calls[0].payload.action,'pause_employee');
});
test('set_company_parent is advertised and forwarded unchanged; null and missing stay distinct',async()=>{
  const def=TOOL_DEFINITIONS.find(t=>t.name==='office_command');
  assert.ok(def.inputSchema.properties.action.enum.includes('set_company_parent'));
  const f=fixture();
  await f.handler('office_command',{action:'set_company_parent',payload:{companyId:'child',parentCompanyId:'parent'}});
  await f.handler('office_command',{action:'set_company_parent',payload:{companyId:'child',parentCompanyId:null}});
  await f.handler('office_command',{action:'set_company_parent',payload:{companyId:'child'}});
  assert.deepEqual(f.calls[0].payload,{action:'set_company_parent',companyId:'child',parentCompanyId:'parent'});
  assert.ok(Object.prototype.hasOwnProperty.call(f.calls[1].payload,'parentCompanyId'));
  assert.equal(f.calls[1].payload.parentCompanyId,null);
  assert.equal('parentCompanyId' in f.calls[2].payload,false);
});
test('native invalid-cycle errors from set_company_parent propagate as tool errors',async()=>{
  const handler=createToolHandler({nativeCall:async()=>({ok:false,error:'Company hierarchy contains a cycle',code:'OFFICE_STATE_INVALID'}),fetchImpl:async()=>{throw new Error('no network');}});
  const p=createMessageProcessor({handleTool:handler});
  const r=await p(JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'office_command',arguments:{action:'set_company_parent',payload:{companyId:'a',parentCompanyId:'a'}}}}));
  assert.equal(r.result.isError,true);
  assert.match(r.result.structuredContent.error,/cycle/);
});
test('department parent command preserves explicit null and query metadata retains only parent identifiers',async()=>{
  const def=TOOL_DEFINITIONS.find(t=>t.name==='office_command');
  assert.ok(def.inputSchema.properties.action.enum.includes('set_department_parent'));
  const f=fixture();
  await f.handler('office_command',{action:'set_department_parent',payload:{departmentId:'child',parentDepartmentId:null}});
  assert.deepEqual(f.calls[0].payload,{action:'set_department_parent',departmentId:'child',parentDepartmentId:null});
  const snapshot=officeFixture();
  snapshot.departments=[{id:'root',companyId:'company-a',officeId:'office-a',parentDepartmentId:null},{id:'child',companyId:'company-a',officeId:'office-a',parentDepartmentId:'root',privateBody:'NEVER EXPOSE'}];
  snapshot.companies[0].parentCompanyId='company-b';
  const h=officeHarness(snapshot);
  const rows=(await h.handler('office_query',{collection:'departments'})).items;
  assert.equal(rows.find(r=>r.id==='root').parentDepartmentId,null);
  assert.equal(rows.find(r=>r.id==='child').parentDepartmentId,'root');
  assert.equal(JSON.stringify(rows).includes('NEVER EXPOSE'),false);
  const company=(await h.handler('office_query',{collection:'companies'})).items.find(r=>r.id===snapshot.companies[0].id);
  assert.equal(company.parentCompanyId,'company-b');
});
test('GitHub account import requires matching public metadata before state writes',async()=>{
  const f=fixture(async()=>json([{name:'atlas',owner:{login:'occult-kranti'},private:false,html_url:'https://github.com/occult-kranti/atlas'}]));const r=await f.handler('github_import_account',{owner:'occult-kranti'});assert.equal(r.imported,1);assert.equal(f.calls.at(-1).payload.action,'import_repositories');
});
test('account discovery failure cannot partially import',async()=>{
  const f=fixture(async()=>json([{name:'atlas',owner:{login:'other'},private:false,html_url:'https://github.com/other/atlas'}]));await assert.rejects(f.handler('github_import_account',{owner:'occult-kranti'}));assert.equal(f.calls.length,0);
});
test('JSON-RPC handshake advertises tools without invoking them',async()=>{
  const f=fixture();const process=createMessageProcessor({handleTool:f.handler});const r=await process(JSON.stringify({jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2025-11-25'}}));assert.equal(r.result.protocolVersion,'2025-11-25');assert.deepEqual(r.result.capabilities,{tools:{}});assert.equal(f.calls.length,0);assert.equal(TOOL_DEFINITIONS.some(t=>t.name==='office_command'),true);
});
test('malformed requests, unknown methods and notifications obey JSON-RPC',async()=>{
  const p=createMessageProcessor({handleTool:fixture().handler});assert.equal((await p('{')).error.code,-32700);assert.equal((await p(JSON.stringify({jsonrpc:'2.0',id:1,method:'unknown'}))).error.code,-32601);assert.equal(await p(JSON.stringify({jsonrpc:'2.0',method:'notifications/initialized'})),null);
});
test('tool input errors are protocol errors; application failure is a tool error',async()=>{
  const p=createMessageProcessor({handleTool:fixture().handler});const invalid=await p(JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'roadmap_update',arguments:{}}}));assert.equal(invalid.error.code,-32602);const failed=await p(JSON.stringify({jsonrpc:'2.0',id:2,method:'tools/call',params:{name:'company_register',arguments:{repository:'o/r'}}}));assert.equal(failed.result.isError,true);
});

function officeFixture(count=235) {
  return {schemaVersion:1,activeCompanyId:'company-a',companies:[{id:'company-a',name:'Synthetic A'},{id:'company-b',name:'Synthetic B'}],
    offices:[{id:'office-a',companyId:'company-a'},{id:'office-b',companyId:'company-b'}],departments:[{id:'department-a',companyId:'company-a',officeId:'office-a'}],
    employees:Array.from({length:count},(_,i)=>({id:`employee-${String(i).padStart(4,'0')}`,companyId:i%2?'company-b':'company-a',officeId:i%2?'office-b':'office-a',departmentId:i%2?null:'department-a',name:`Synthetic ${i}`,role:i%3?'Engineer':'Analyst',status:'active'})).reverse(),
    jobs:[{id:'job-a',companyId:'company-a',officeId:'office-a',employeeId:'employee-0001',goal:'PRIVATE PROMPT BODY',status:'running',leaseToken:'sensitive-worker-lease',artifactUri:'/private/example-deliverable.md',apiKey:'never-return-this-key'}],
    chatThreads:[{id:'thread-a',scope:{kind:'company',id:'company-a'},messages:[{id:'message-a',content:'PRIVATE CHAT BODY'}]}],
    authority:{grants:[],ledger:[],index:[{id:'employee:employee-0000',kind:'employee',entityId:'employee-0000',title:'Synthetic zero',companyId:'company-a'}]},
    lastAction:{grantId:'grant-new',employeeId:'employee-0000',requiresGrants:true,leaseToken:'sensitive-worker-lease',artifactUri:'/private/example-deliverable.md',secret:'never-return-this-key'}};
}
function officeHarness(snapshot) {
  const calls=[];
  const handler=createToolHandler({nativeCall:async(command,payload)=>{calls.push({command,payload});return {ok:true,snapshot};},fetchImpl:async()=>{throw new Error('No network expected');}});
  const processor=createMessageProcessor({handleTool:handler});
  const wire=(name,args={})=>processor(JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name,arguments:args}}));
  return {calls,handler,wire};
}

test('improvement metadata preserves identities, bounded notes, scope links and immutable allowance values',async()=>{
 const state=boardFixture();state.schemaVersion=3;
 state.stickyNotes=[{id:'sk-12345678',revision:4,companyId:'company-a',officeId:'office-a',departmentId:null,kind:'todo',color:'yellow',status:'open',text:'Review the actual board evidence.',goalIds:['goal-a','goal-b'],x:.2,y:.4},
  {id:'foreign-note',revision:0,companyId:'company-b',officeId:'office-b',departmentId:null,kind:'comment',text:'Other company',goalIds:[]}];
 state.improvementSessions=[{id:'session-a',revision:2,companyId:'company-a',officeId:'office-a',departmentId:null,allowanceId:'shared-allowance',primaryEmployeeId:'sk-12345678',reviewerEmployeeId:'employee-0000',status:'paused',objective:'Useful scoped work',continuation:'until-budget',maxCycles:null,cycle:0,goalIds:['goal-a','goal-b'],taskNoteIds:['sk-12345678','foreign-note','absent'],allowedRoutes:[{provider:'anthropic',model:'claude-haiku-5-5'}]}];
 state.improvementAllowance={id:'shared-allowance',capUsd:20,carriedObservedUsd:4,carriedEstimatedUsd:1,sourceReference:'owner-reviewed-checkpoint'};
 const f=officeHarness(state),query=collection=>f.handler('office_query',{collection,scope:{kind:'company',id:'company-a'}});
 const note=(await query('stickyNotes')).items[0];assert.equal(note.id,'sk-12345678');assert.equal(note.text,state.stickyNotes[0].text);assert.equal(note.revision,4);assert.deepEqual(note.goalIds,['goal-a']);assert.equal(note.referencesComplete,false);
 const session=(await query('improvementSessions')).items[0];assert.equal(session.primaryEmployeeId,'sk-12345678');assert.equal(session.maxCycles,null);assert.deepEqual(session.taskNoteIds,['sk-12345678']);assert.equal(session.omittedReferences.taskNoteIds,2);assert.deepEqual(session.goalIds,['goal-a']);
 const allowance=(await f.handler('office_query',{collection:'improvementAllowances'})).items[0];assert.equal(allowance.capUsd,20);assert.equal(allowance.carriedObservedUsd,4);assert.equal(allowance.carriedEstimatedUsd,1);
 state.stickyNotes[0].text='Do not disclose '+['s','k','-','12345678901234567890'].join('');const redacted=(await query('stickyNotes')).items[0];assert.equal(redacted.textIncomplete,true);assert.equal(redacted.text.includes('12345678901234567890'),false);
});

test('owner improvement actions preserve native receipt identities while internal ticks stay hidden',async()=>{
 const f=fixture();const actions=['upsert_sticky_note','archive_sticky_note','register_improvement_allowance','create_improvement_session','control_improvement_session'];
 for(const action of actions){assert.ok(TOOL_DEFINITIONS.find(tool=>tool.name==='office_command').inputSchema.properties.action.enum.includes(action));await f.handler('office_command',{action,payload:{requestId:'stable-request',expectedRevision:4}});}
 assert.ok(f.calls.every(call=>call.payload.requestId==='stable-request'&&call.payload.expectedRevision===4));
 await assert.rejects(f.handler('office_command',{action:'tick_improvements',payload:{sessionId:'session-a'}}));assert.equal(f.calls.length,actions.length);
});

test('Daftar server keeps its protocol name and advertises bounded read-only queries',()=>{
  assert.deepEqual(SERVER_INFO,{name:'atlas-company',version:'0.5.0'});
  const query=TOOL_DEFINITIONS.find(t=>t.name==='office_query');
  assert.equal(query.annotations.readOnlyHint,true);assert.equal(query.inputSchema.properties.pageSize.maximum,100);
  assert.equal(NATIVE_OUTPUT_LIMIT,16*1024*1024);
});
test('2 MiB successful command stays successful on the wire and is never replayed to read it',async()=>{
  const snapshot=officeFixture();snapshot.chatThreads[0].messages[0].content='z'.repeat(2*1024*1024);
  const f=officeHarness(snapshot);
  assert.equal((await f.handler('office_snapshot',{})).snapshot,snapshot,'direct handler retains the complete snapshot');
  const response=await f.wire('office_command',{action:'grant_authority',payload:{employeeId:'employee-0000'}});
  const receipt=response.result.structuredContent;
  assert.equal(response.result.isError,false);assert.equal(receipt.ok,true);assert.equal(receipt.mutationApplied,true);
  assert.equal(receipt.snapshotOmitted,true);assert.equal('snapshot' in receipt,false);assert.equal(receipt.action,'grant_authority');
  assert.equal(receipt.summary.lastAction.grantId,'grant-new');assert.equal(receipt.summary.lastAction.requiresGrants,true);
  assert.match(receipt.guidance,/Do not replay/);assert.equal(receipt.next.tool,'office_query');
  const text=JSON.stringify(response);
  assert.ok(Buffer.byteLength(text)<TOOL_OUTPUT_LIMIT);
  for(const secret of ['sensitive-worker-lease','example-deliverable','never-return-this-key','PRIVATE PROMPT BODY']) assert.equal(text.includes(secret),false);
  await f.wire('office_query',{collection:'authorityGrants'});
  assert.equal(f.calls.filter(c=>c.command==='office_command').length,1,'querying the receipt must not replay the mutation');
  const read=await f.wire('office_snapshot');assert.equal(read.result.isError,false);assert.equal(read.result.structuredContent.mutationApplied,false);
});
test('small snapshot responses retain their existing full response contract',async()=>{
  const snapshot=officeFixture(2),f=officeHarness(snapshot);
  const response=await f.wire('office_snapshot');assert.equal(response.result.isError,false);
  assert.deepEqual(response.result.structuredContent,{snapshot});
});
test('pagination returns every metadata record exactly once and calls only native reads',async()=>{
  const f=officeHarness(officeFixture());let cursor;const ids=[];let pages=0;
  do {
    const page=await f.handler('office_query',{collection:'employees',pageSize:37,...(cursor?{cursor}:{})});
    assert.equal(page.total,235);assert.equal(page.metadataOnly,true);assert.ok(page.returned<=37);
    ids.push(...page.items.map(row=>row.id));cursor=page.nextCursor;pages++;
  } while(cursor);
  assert.equal(ids.length,235);assert.equal(new Set(ids).size,235);assert.deepEqual(ids,[...ids].sort());assert.equal(pages,7);
  assert.ok(f.calls.every(call=>call.command==='office_snapshot'));
});
test('scope and metadata search follow the company hierarchy and actual job location',async()=>{
  const snapshot=officeFixture(),f=officeHarness(snapshot);
  const page=await f.handler('office_query',{collection:'employees',scope:{kind:'department',id:'department-a'},search:'Analyst',pageSize:100});
  assert.equal(page.total,snapshot.employees.filter(e=>e.departmentId==='department-a'&&e.role==='Analyst').length);
  assert.ok(page.items.every(row=>row.companyId==='company-a'&&row.role==='Analyst'));
  assert.equal((await f.handler('office_query',{collection:'jobs',scope:{kind:'company',id:'company-b'}})).total,0,'shared employee home does not replace the actual job company');
  assert.equal((await f.handler('office_query',{collection:'jobs',scope:{kind:'employee',id:'employee-0001'}})).total,1);
  assert.equal((await f.handler('office_query',{collection:'index',scope:{kind:'office',id:'office-a'}})).total,1);
});
test('query metadata omits bodies, credentials, local artifacts and worker leases',async()=>{
  const snapshot=officeFixture(2);snapshot.employees[0].name='Example sk-ant-12345678901234567890 /workspace/private/file.md';
  const f=officeHarness(snapshot);
  for(const collection of ['employees','jobs','chatThreads']) {
    const response=await f.wire('office_query',{collection});const text=JSON.stringify(response);
    assert.equal(response.result.isError,false);
    for(const secret of ['PRIVATE CHAT BODY','PRIVATE PROMPT BODY','sensitive-worker-lease','example-deliverable','never-return-this-key','sk-ant-12345678901234567890','/workspace/private']) assert.equal(text.includes(secret),false,secret);
  }
  const chat=await f.handler('office_query',{collection:'chatThreads'});assert.equal(chat.items[0].messagesCount,1);assert.equal('messages' in chat.items[0],false);
});
test('stale or differently filtered cursors fail explicitly without mutating state',async()=>{
  const snapshot=officeFixture(3),f=officeHarness(snapshot);
  const page=await f.handler('office_query',{collection:'employees',pageSize:1});
  await assert.rejects(f.handler('office_query',{collection:'employees',cursor:page.nextCursor,search:'Engineer'}),error=>error.code==='query_changed');
  snapshot.employees[0].status='paused';
  await assert.rejects(f.handler('office_query',{collection:'employees',cursor:page.nextCursor}),error=>error.code==='query_changed');
  assert.ok(f.calls.every(call=>call.command==='office_snapshot'));
});
test('query validation rejects oversized or malformed requests before native reads',async()=>{
  const f=officeHarness(officeFixture(2));
  for(const args of [{collection:'secrets'},{collection:'jobs',pageSize:0},{collection:'jobs',pageSize:101},{collection:'jobs',search:'a'.repeat(201)},{collection:'jobs',cursor:'not a cursor'},{collection:'jobs',scope:{kind:'global',id:'all'}},{collection:'jobs',scope:{kind:'company',id:'company-a',extra:true}},{collection:'jobs',shell:'anything'}]) await assert.rejects(f.handler('office_query',args),InvalidParams);
  assert.equal(f.calls.length,0);
});
test('byte-bounded pages shorten the page without losing the remaining records',async()=>{
  const snapshot=officeFixture(100);
  for(const row of snapshot.employees) {row.name='n'.repeat(9000);row.title='t'.repeat(9000);row.role='r'.repeat(9000);row.capabilities=Array.from({length:20},()=> 'c'.repeat(80));}
  const f=officeHarness(snapshot);let cursor;const ids=[];let first=true;
  do {
    const response=await f.wire('office_query',{collection:'employees',pageSize:100,...(cursor?{cursor}:{})});
    assert.equal(response.result.isError,false);assert.ok(Buffer.byteLength(JSON.stringify(response))<TOOL_OUTPUT_LIMIT);
    const page=response.result.structuredContent;
    if(first){assert.ok(page.returned<100);first=false;}
    assert.ok(Buffer.byteLength(JSON.stringify(page.items))<OFFICE_QUERY_PAGE_BYTES+1000);
    ids.push(...page.items.map(row=>row.id));cursor=page.nextCursor;
  }while(cursor);
  assert.equal(ids.length,100);assert.equal(new Set(ids).size,100);
});

function boardFixture() {
  const snapshot = officeFixture(2);
  snapshot.employees.push({ id:'sk-12345678', companyId:'company-a', officeId:'office-a', departmentId:'department-a', name:'Owner sk-12345678', status:'active' });
  snapshot.goals = [
    { id:'goal-a', companyId:'company-a', scope:{kind:'company',id:'company-a'}, title:'A goal', steps:[
      { id:'write', title:'Write', employeeId:'sk-12345678', goal:'PRIVATE STEP PROMPT', dependsOn:[], knowledgeTransferIds:['transfer-a'],
        reviewerEmployeeId:'employee-0000',reviewerServiceContractId:null,estimate:{optimisticMinutes:2,likelyMinutes:4,pessimisticMinutes:8},reviewEstimate:{optimisticMinutes:1,likelyMinutes:2,pessimisticMinutes:3} },
      { id:'verify', title:'Verify', employeeId:'employee-0000', goal:'PRIVATE REVIEW PROMPT', dependsOn:['write'], knowledgeTransferIds:[] },
    ]},
    { id:'goal-a2', companyId:'company-a', scope:{kind:'office',id:'office-a'}, title:'A second goal', steps:[{id:'write',title:'Write again',employeeId:'employee-0000',goal:'PRIVATE SECOND PROMPT',dependsOn:[]}] },
    { id:'goal-b', companyId:'company-b', scope:{kind:'company',id:'company-b'}, title:'B goal', steps:[{id:'write',title:'Other company',employeeId:'employee-0001',goal:'PRIVATE B PROMPT',dependsOn:[]}] },
  ];
  snapshot.jobs.push({ id:'job-a2',companyId:'company-a',employeeId:'employee-0000',status:'completed' },{id:'job-b',companyId:'company-b',employeeId:'employee-0001',status:'queued'});
  snapshot.portfolio={groups:[],contracts:[],transfers:[{id:'transfer-a',recipientCompanyId:'company-a',status:'granted'}],roadmap:[
    {id:'roadmap-global',scope:{kind:'global',id:'portfolio'},title:'Global',ownerEmployeeId:'sk-12345678',status:'planned',dependencies:[],goalIds:[],jobIds:[]},
    {id:'roadmap-a',scope:{kind:'company',id:'company-a'},title:'A outcome',ownerEmployeeId:'sk-12345678',status:'planned',dependencies:['roadmap-global'],goalIds:['goal-a','goal-a2'],jobIds:['job-a','job-a2'],evidence:'PRIVATE EVIDENCE'},
    {id:'roadmap-b',scope:{kind:'company',id:'company-b'},title:'B outcome',ownerEmployeeId:'employee-0001',status:'planned',dependencies:[],goalIds:['goal-b'],jobIds:['job-b']},
  ]};
  snapshot.blueprints=['a','b'].map(suffix=>({id:`blueprint-${suffix}`,companyId:`company-${suffix}`,officeId:`office-${suffix}`,
    rooms:[{id:`room-${suffix}`,name:`Room ${suffix}`,departmentId:suffix==='a'?'department-a':null,x:.1,y:.1,width:.6,height:.6}],
    desks:[{id:`desk-${suffix}`,roomId:`room-${suffix}`,employeeId:suffix==='a'?'sk-12345678':'employee-0001',x:.2,y:.3}],
    whiteboards:[{id:`board-${suffix}`,roomId:`room-${suffix}`,ownerEmployeeId:suffix==='a'?'sk-12345678':'employee-0001',title:`Board ${suffix}`,x:.3,y:.4,revision:3,
      goalIds:suffix==='a'?['goal-a','goal-a2']:['goal-b'],jobIds:suffix==='a'?['job-a','job-a2']:['job-b'],roadmapItemIds:[`roadmap-${suffix}`,'roadmap-global']}] }));
  return snapshot;
}

test('nested metadata requires explicit scope and preserves canonical parent identities and full links',async()=>{
  const snapshot=boardFixture(),f=officeHarness(snapshot);
  for(const collection of ['rooms','desks','whiteboards','goalSteps']){
    await assert.rejects(f.handler('office_query',{collection}),InvalidParams);
    assert.ok(TOOL_DEFINITIONS.find(tool=>tool.name==='office_query').inputSchema.properties.collection.enum.includes(collection));
  }
  await assert.rejects(f.handler('office_query',{collection:'whiteboards',scope:{kind:'employee',id:'sk-12345678'}}),InvalidParams);
  assert.equal(f.calls.length,0);
  Object.assign(snapshot.blueprints[0].whiteboards[0],{companyId:'company-b',officeId:'office-b',blueprintId:'blueprint-b',scope:{kind:'company',id:'company-b'},goalId:'goal-b',privateBody:'PRIVATE BOARD BODY'});
  for(const collection of ['rooms','desks','whiteboards']){
    const page=await f.handler('office_query',{collection,scope:{kind:'company',id:'company-a'}});
    assert.equal(page.total,1);assert.equal(page.omittedRows,0);assert.equal(page.sourceTruncated,false);
    assert.equal(page.items[0].companyId,'company-a');assert.equal(page.items[0].officeId,'office-a');assert.equal(page.items[0].blueprintId,'blueprint-a');
    assert.equal(JSON.stringify(page).includes('PRIVATE BOARD BODY'),false);
  }
  const board=(await f.handler('office_query',{collection:'whiteboards',scope:{kind:'office',id:'office-a'}})).items[0];
  assert.equal('scope' in board,false);assert.equal('goalId' in board,false,'child-supplied aliases do not survive projection');
  assert.deepEqual(board.goalIds,['goal-a','goal-a2']);assert.deepEqual(board.jobIds,['job-a','job-a2']);assert.deepEqual(board.roadmapItemIds,['roadmap-a','roadmap-global']);
  assert.equal(board.ownerEmployeeId,'sk-12345678');assert.equal(board.revision,3);assert.equal(board.referencesComplete,true);assert.deepEqual(board.omittedReferences,{});
  const employees=(await f.handler('office_query',{collection:'employees'})).items;
  assert.equal(employees.find(row=>row.id==='sk-12345678').name,'Owner [credential omitted]');
  assert.ok(f.calls.every(call=>call.command==='office_snapshot'));
});

test('nested metadata omits malformed or orphan records and explicitly reports invalid links',async()=>{
  const snapshot=boardFixture(),f=officeHarness(snapshot),blueprint=snapshot.blueprints[0],board=blueprint.whiteboards[0];
  board.goalIds.push('goal-b','missing-goal','bad/id');board.jobIds.push('job-b');board.roadmapItemIds.push('roadmap-b');
  blueprint.whiteboards.push({...board,id:'orphan-room',roomId:'missing-room'},{...board,id:'bad/id'},{...board,id:'unknown-owner',ownerEmployeeId:'missing-employee'});
  snapshot.blueprints.push({...blueprint,id:'cross-company-parent',officeId:'office-b',whiteboards:[{...board,id:'wrong-parent'}]});
  const result=await f.handler('office_query',{collection:'whiteboards',scope:{kind:'company',id:'company-a'}});
  assert.deepEqual(result.items.map(row=>row.id),['board-a']);assert.equal(result.omittedRows,4);
  assert.equal(result.items[0].referencesComplete,false);assert.deepEqual(result.items[0].omittedReferences,{goalIds:3,jobIds:1,roadmapItemIds:1});
  assert.deepEqual(result.items[0].goalIds,['goal-a','goal-a2']);
  snapshot.blueprints[0].whiteboards.push({...board});
  assert.equal((await f.handler('office_query',{collection:'whiteboards',scope:{kind:'office',id:'office-a'}})).items.length,0,'duplicate child IDs cannot select an arbitrary record');
  snapshot.goals.push({...snapshot.goals[0],id:'orphan-scope',scope:{kind:'office',id:'office-b'}});
  const steps=await f.handler('office_query',{collection:'goalSteps',scope:{kind:'company',id:'company-a'}});
  assert.equal(steps.items.some(row=>row.goalId==='orphan-scope'),false);assert.equal(steps.omittedRows,2);
});

test('goal-step pagination distinguishes repeated step IDs and rejects changed dependency cursors',async()=>{
  const snapshot=boardFixture(),f=officeHarness(snapshot),scope={kind:'company',id:'company-a'};
  let cursor;const rows=[];
  do{const page=await f.handler('office_query',{collection:'goalSteps',scope,pageSize:1,...(cursor?{cursor}:{})});rows.push(...page.items);cursor=page.nextCursor;}while(cursor);
  assert.equal(rows.length,3);assert.equal(new Set(rows.map(row=>`${row.goalId}/${row.id}`)).size,3);
  const primary=rows.find(row=>row.goalId==='goal-a'&&row.id==='write');
  assert.equal(primary.employeeId,'sk-12345678');assert.equal(primary.reviewerEmployeeId,'employee-0000');assert.equal(primary.reviewerServiceContractId,null);
  assert.deepEqual(primary.estimate,{optimisticMinutes:2,likelyMinutes:4,pessimisticMinutes:8});assert.deepEqual(primary.knowledgeTransferIds,['transfer-a']);
  assert.equal(JSON.stringify(rows).includes('PRIVATE'),false);assert.equal(rows.some(row=>row.companyId==='company-b'),false);
  const first=await f.handler('office_query',{collection:'goalSteps',scope,pageSize:1});
  snapshot.goals[0].steps[1].dependsOn=[];
  await assert.rejects(f.handler('office_query',{collection:'goalSteps',scope,pageSize:1,cursor:first.nextCursor}),error=>error.code==='query_changed');
  const exact=await f.handler('office_query',{collection:'goalSteps',scope:{kind:'goal',id:'goal-b'}});assert.equal(exact.total,1);assert.equal(exact.items[0].companyId,'company-b');
  assert.ok(f.calls.every(call=>call.command==='office_snapshot'));
});

test('native nested caps and reference caps are explicit and cannot create a non-advancing page',async()=>{
  const snapshot=boardFixture(),f=officeHarness(snapshot),scope={kind:'company',id:'company-a'};
  snapshot.goals[0].steps=Array.from({length:13},(_,i)=>({id:`s${i}`,title:'Step',employeeId:'employee-0000',dependsOn:[]}));
  const steps=await f.handler('office_query',{collection:'goalSteps',scope:{kind:'goal',id:'goal-a'},pageSize:100});
  assert.equal(steps.returned,12);assert.equal(steps.omittedRows,1);assert.equal(steps.sourceTruncated,true);
  const longId=(prefix,i)=>`${prefix}-${String(i).padStart(3,'0')}-${'x'.repeat(148)}`;
  snapshot.goals=Array.from({length:100},(_,i)=>({id:longId('g',i),companyId:'company-a'}));
  snapshot.jobs=Array.from({length:100},(_,i)=>({id:longId('j',i),companyId:'company-a'}));
  snapshot.portfolio.roadmap=Array.from({length:100},(_,i)=>({id:longId('r',i),scope:{kind:'company',id:'company-a'}}));
  const prototype=snapshot.blueprints[0].whiteboards[0];
  snapshot.blueprints[0].whiteboards=Array.from({length:12},(_,i)=>({...prototype,id:`board-${i}`,goalIds:snapshot.goals.map(x=>x.id),jobIds:snapshot.jobs.map(x=>x.id),roadmapItemIds:snapshot.portfolio.roadmap.map(x=>x.id)}));
  let cursor;const ids=[];let pages=0;
  do{
    const page=await f.handler('office_query',{collection:'whiteboards',scope,pageSize:100,...(cursor?{cursor}:{})});
    assert.ok(page.returned>0);assert.ok(Buffer.byteLength(JSON.stringify(page.items))<=OFFICE_QUERY_PAGE_BYTES+100);
    ids.push(...page.items.map(row=>row.id));assert.notEqual(page.nextCursor,cursor??undefined);cursor=page.nextCursor;pages++;
  }while(cursor);
  assert.equal(ids.length,12);assert.equal(new Set(ids).size,12);assert.ok(pages>1);
  snapshot.blueprints[0].whiteboards[0].goalIds.push('extra');
  const bounded=await f.handler('office_query',{collection:'whiteboards',scope,pageSize:1});
  assert.equal(bounded.items[0].goalIds.length,100);assert.equal(bounded.items[0].referencesComplete,false);assert.equal(bounded.items[0].omittedReferences.goalIds,1);
});

test('roadmap and paired-job metadata preserve references and hashes without prompts or private evidence',async()=>{
  const snapshot=boardFixture(),f=officeHarness(snapshot),primaryHash='a'.repeat(64),reviewHash='b'.repeat(64);
  const road=(await f.handler('office_query',{collection:'roadmap',scope:{kind:'company',id:'company-a'}})).items.find(row=>row.id==='roadmap-a');
  assert.deepEqual(road.dependencies,['roadmap-global']);assert.deepEqual(road.goalIds,['goal-a','goal-a2']);assert.equal(road.evidencePresent,true);assert.equal('evidence' in road,false);
  Object.assign(snapshot.jobs[0],{requestSha256:primaryHash,artifactSha256:reviewHash,deliverableSha256:'c'.repeat(64),pair:{stepId:'write',phase:'review',peerEmployeeId:'sk-12345678',primaryJobId:'job-a2',reviewJobId:'job-a'},
    review:{verdict:'accepted',primaryArtifactSha256:primaryHash,reviewArtifactSha256:reviewHash,primaryArtifactComplete:true,summary:'Verified sk-proj-1234567890 /workspace/private/report',evidenceRefs:['job-a2','bad/path'],recordedAt:'2026-11-22T00:00:00Z'}});
  const job=(await f.handler('office_query',{collection:'jobs'})).items.find(row=>row.id==='job-a');
  assert.equal(job.pair.peerEmployeeId,'sk-12345678');assert.equal(job.artifactSha256,reviewHash);assert.equal(job.review.primaryArtifactSha256,primaryHash);
  assert.equal(job.deliverableSha256,'c'.repeat(64));
  assert.deepEqual(job.review.evidenceRefs,['job-a2']);assert.equal(job.review.omittedEvidenceRefs,1);assert.match(job.review.summary,/credential omitted/);
  assert.equal(job.review.primaryArtifactComplete,true);
  for(const forbidden of ['PRIVATE PROMPT','PRIVATE LEASE','PRIVATE EVIDENCE','/workspace/private','sk-proj-1234567890'])assert.equal(JSON.stringify(job).includes(forbidden),false);
  snapshot.jobs[0].review.evidenceRefs=Array.from({length:23},(_,i)=>`ref-${i}`);
  delete snapshot.jobs[0].review.primaryArtifactComplete;
  const legacy=(await f.handler('office_query',{collection:'jobs'})).items.find(row=>row.id==='job-a');
  assert.equal(legacy.review.evidenceRefs.length,20);assert.equal(legacy.review.omittedEvidenceRefs,3);
  assert.equal(legacy.review.primaryArtifactComplete,null);assert.equal(legacy.metadataIncomplete,true);
  snapshot.jobs[0].review.primaryArtifactComplete=false;
  assert.equal((await f.handler('office_query',{collection:'jobs'})).items.find(row=>row.id==='job-a').review.primaryArtifactComplete,false);
});

test('metadata estimates use the native duration bounds and label malformed triples incomplete',async()=>{
  const snapshot=boardFixture(),f=officeHarness(snapshot),step=snapshot.goals[0].steps[0],road=snapshot.portfolio.roadmap[1];
  for(const value of [0,0.009,1440.001,Number.MAX_SAFE_INTEGER]){
    step.estimate={optimisticMinutes:value,likelyMinutes:value,pessimisticMinutes:value};road.estimate=step.estimate;
    const a=(await f.handler('office_query',{collection:'goalSteps',scope:{kind:'goal',id:'goal-a'}})).items.find(row=>row.id==='write');
    const b=(await f.handler('office_query',{collection:'roadmap'})).items.find(row=>row.id==='roadmap-a');
    for(const item of [a,b]){assert.equal('estimate' in item,false);assert.equal(item.metadataIncomplete,true);}
  }
  step.estimate={optimisticMinutes:0.01,likelyMinutes:10,pessimisticMinutes:1440};
  assert.deepEqual((await f.handler('office_query',{collection:'goalSteps',scope:{kind:'goal',id:'goal-a'}})).items.find(row=>row.id==='write').estimate,step.estimate);
});

test('trusted review failure metadata preserves settlement without inventing an accepted verdict',async()=>{
  const snapshot=boardFixture(),f=officeHarness(snapshot),job=snapshot.jobs[0];
  Object.assign(job,{status:'completed',review:null,reviewFailure:{reason:'malformed-output',summary:'Saved sk-proj-1234567890 /workspace/private/review.json for inspection.',recordedAt:'2026-11-22T00:00:00Z'}});
  const item=(await f.handler('office_query',{collection:'jobs'})).items.find(row=>row.id===job.id);
  assert.equal(item.status,'completed');assert.equal(item.review,null);assert.equal(item.reviewFailure.reason,'malformed-output');
  assert.match(item.reviewFailure.summary,/credential omitted/);assert.equal(JSON.stringify(item).includes('/workspace/private'),false);
  assert.equal('verdict' in item.reviewFailure,false);assert.equal('leaseToken' in item,false);
  for(const reason of ['input-budget','artifact-mismatch','recording-unconfirmed']){
    job.reviewFailure.reason=reason;
    assert.equal((await f.handler('office_query',{collection:'jobs'})).items.find(row=>row.id===job.id).reviewFailure.reason,reason);
  }
  job.reviewFailure.reason='accepted';
  const invalid=(await f.handler('office_query',{collection:'jobs'})).items.find(row=>row.id===job.id);
  assert.equal('reviewFailure' in invalid,false);assert.equal(invalid.metadataIncomplete,true);
  assert.equal(TOOL_DEFINITIONS.find(tool=>tool.name==='office_command').inputSchema.properties.action.enum.includes('record_review_failure'),false);
  await assert.rejects(f.handler('office_command',{action:'record_review_failure',payload:{jobId:job.id}}),InvalidParams);
});

test('atomic workflow recovery exposes only exact source identities and validated request hashes',async()=>{
  const snapshot=boardFixture(),f=officeHarness(snapshot),goal=snapshot.goals[0];
  Object.assign(goal,{sourceRequestId:'sk-12345678',sourceMessageId:'message:atomic-1',requestSha256:'a'.repeat(64),content:'PRIVATE WORKFLOW BRIEF'});
  const item=(await f.handler('office_query',{collection:'goals',scope:{kind:'company',id:'company-a'}})).items.find(row=>row.id===goal.id);
  assert.equal(item.sourceRequestId,'sk-12345678');assert.equal(item.sourceMessageId,'message:atomic-1');assert.equal(item.requestSha256,'a'.repeat(64));
  assert.equal(JSON.stringify(item).includes('PRIVATE WORKFLOW BRIEF'),false);
  Object.assign(goal,{sourceRequestId:'bad/id',sourceMessageId:null,requestSha256:'not-a-hash'});
  const invalid=(await f.handler('office_query',{collection:'goals'})).items.find(row=>row.id===goal.id);
  assert.equal('sourceRequestId' in invalid,false);assert.equal('requestSha256' in invalid,false);assert.equal(invalid.sourceMessageId,null);assert.equal(invalid.metadataIncomplete,true);
});

function nativeProcessFixture(buffer) {
  const child=new EventEmitter();child.stdin=new PassThrough();child.stdout=new PassThrough();child.stderr=new PassThrough();let killed=false;
  child.kill=()=>{killed=true;};child.stdin.on('finish',()=>queueMicrotask(()=>{child.stdout.emit('data',buffer);child.emit('close',0);}));
  const call=createNativeCall({binary:'/synthetic/core',stateDir:'/synthetic/state',seedDir:'/synthetic/seed',repoRoot:'/synthetic/repo'},{spawnImpl:()=>child});
  return {call,wasKilled:()=>killed};
}
test('native reader accepts a synthetic 2 MiB snapshot within its new bounded ceiling',async()=>{
  const f=nativeProcessFixture(Buffer.from(JSON.stringify({ok:true,snapshot:{content:'x'.repeat(2*1024*1024)}})));
  const result=await f.call('office_snapshot');assert.equal(result.snapshot.content.length,2*1024*1024);assert.equal(f.wasKilled(),false);
});
test('native reader still rejects responses above 16 MiB with uncertain outcome guidance',async()=>{
  const f=nativeProcessFixture(Buffer.alloc(NATIVE_OUTPUT_LIMIT+1,120));
  await assert.rejects(f.call('office_command',{action:'create_company'}),error=>error.code==='native_output_too_large'&&/State may already be saved/.test(error.message));
  assert.equal(f.wasKilled(),true);
});
