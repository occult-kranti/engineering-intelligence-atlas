/** Test-only bridge. No network, provider calls, credentials, or persisted user state. */
export function installRendererFixture(target) {
  const copy = (value) => JSON.parse(JSON.stringify(value));
  const at = '2026-11-20T12:00:00.000Z';
  const calls = [];
  const projects = [];
  const runs = [];
  const company = {
    available: true, backend: 'rust', error: null,
    company: {id:'fixture-company',name:'Fixture Engineering',repoUrl:'https://github.com/fixture/engineering',owner:'fixture',repo:'engineering',defaultBranch:'main',description:'Test fixture, not live company data.',registeredAt:null,lastCheckedAt:null,githubStatus:'unchecked',githubError:null,stars:null,openIssues:null,pushedAt:null,headSha:null},
    employees:[{id:'github',name:'GitHub employee',role:'Repository stewardship',rolePath:'roles/platform-engineer/README.md',skillPath:'skills/agent-research-director/SKILL.md',status:'ready',lastResult:null}],
    tasks:[{id:'verify',title:'Verify repository',ownerId:'github',status:'todo',priority:'P0',milestone:'release',evidence:null,updatedAt:at}],
    milestones:[{id:'release',title:'Release baseline',description:'Test acceptance.'}], activity:[],
    usage:{inputTokens:0,outputTokens:0,costUsd:0,runCount:0,completedRuns:0,failedRuns:0,source:'local-project-runs'}, index:null,
  };
  const office = {
    schemaVersion:1,activeCompanyId:'fixture-company',
    companies:[{id:'fixture-company',name:'Fixture Engineering',repoUrl:'https://github.com/fixture/engineering',status:'active',assistantId:'assistant-company',createdAt:at,source:'fixture',importedAt:null,githubStatus:'unchecked'}],
    offices:[{id:'fixture-office',companyId:'fixture-company',name:'Product studio',status:'active',assistantId:'assistant-office',createdAt:at}],
    departments:[{id:'fixture-department',companyId:'fixture-company',officeId:'fixture-office',name:'Engineering',status:'active',assistantId:'donna',createdAt:at}],
    employees:[{id:'donna',companyId:null,officeId:null,departmentId:null,name:'Donna',role:'CEO assistant',kind:'assistant',status:'active',skillPaths:['skills/agent-research-director/SKILL.md'],createdAt:at,updatedAt:at}],
    portfolio:{ceo:{enabled:true,title:'Fixture CEO office',focusGroupId:null,sharedServicesCompanyId:null,updatedAt:at},groups:[{id:'fixture-group',name:'Fixture platforms',description:'Fixture grouping only',companyIds:['fixture-company'],status:'active',createdAt:at,updatedAt:at},{id:'fixture-second-group',name:'Fixture creative work',description:'Fixture group',companyIds:[],status:'active',createdAt:at,updatedAt:at}],services:[],contracts:[],transfers:[],roadmap:[],recommendations:[]},jobs:[],schedules:[],policy:{approvalMode:'review',dispatchPaused:false,budget:{hardCapUsd:10,hardCapTokens:null,warningPercent:80}},budget:{observedUsd:0,estimatedUsd:0,reservedUsd:0,committedUsd:0,remainingUsd:10,committedTokens:0,remainingTokens:null,warning:false,atCap:false},chatThreads:[],goals:[],checkpoints:[],blueprints:[{id:'fixture-blueprint',companyId:'fixture-company',officeId:'fixture-office',rooms:[{id:'fixture-room',name:'Product studio',departmentId:null,x:.05,y:.05,width:.42,height:.42}],desks:[],whiteboards:[]}],cache:{enabled:true,maxEntries:128,ttlMinutes:60,entries:[],hits:0,misses:0},knowledge:[],events:[],lastAction:null,
  };
  let worker = {enabled:false,running:false,activeJobId:null,lastError:null};
  const record = (name,args) => calls.push({name,args:copy(args ?? null)});
  const result = () => ({ok:true,snapshot:copy(office)});
  function prepareSharedServices() {
    const portfolio=office.portfolio;portfolio.ceo.sharedServicesCompanyId='fixture-shared-company';
    if(!office.companies.some(c=>c.id==='fixture-shared-company'))office.companies.push({id:'fixture-shared-company',name:'Fixture Shared Services',repoUrl:null,status:'active',assistantId:'donna',createdAt:at,source:'fixture',importedAt:null,githubStatus:'unchecked'});
    if(!office.offices.some(o=>o.id==='fixture-shared-office'))office.offices.push({id:'fixture-shared-office',companyId:'fixture-shared-company',name:'Shared studio',status:'active',assistantId:'donna',createdAt:at});
    for(const [key,name] of [['engineering','Engineering'],['design-architecture','Design & architecture'],['research-knowledge','Research & knowledge'],['security','Security'],['hackathon','Hackathon production'],['music-arts','Music & arts']]){
      const employeeId=`shared-${key}`;const departmentId=`department-${key}`;
      if(!office.employees.some(e=>e.id===employeeId))office.employees.push({id:employeeId,name:`Fixture ${name}`,role:name,companyId:'fixture-shared-company',officeId:'fixture-shared-office',departmentId,kind:'specialist',status:'active',skillPaths:[],createdAt:at,updatedAt:at});
      if(!office.departments.some(d=>d.id===departmentId))office.departments.push({id:departmentId,companyId:'fixture-shared-company',officeId:'fixture-shared-office',name,status:'active',assistantId:'donna',createdAt:at});
      if(!portfolio.services.some(service=>service.key===key))portfolio.services.push({id:`service-${key}`,key,name,companyId:'fixture-shared-company',officeId:'fixture-shared-office',departmentId,employeeIds:[employeeId],status:'active',createdAt:at,updatedAt:at});
    }
  }
  function officeCommand(req) {
    record('officeCommand',req);
    const eventId=`event-${office.events.length + 1}`;
    const id=`fixture-${office.events.length + 1}`;
    const base={createdAt:at,updatedAt:at};
    office.lastAction={action:req.action};
    switch(req.action) {
      case 'configure_ceo': Object.assign(office.portfolio.ceo,{enabled:req.enabled,title:req.title,focusGroupId:req.focusGroupId,updatedAt:at});break;
      case 'upsert_portfolio_group': {const group={id:req.id||`group-${id}`,name:req.name,description:req.description||'',companyIds:req.companyIds||[],status:req.status||'active',createdAt:at,updatedAt:at};const index=office.portfolio.groups.findIndex(g=>g.id===group.id);if(index<0)office.portfolio.groups.push(group);else office.portfolio.groups[index]=group;break;}
      case 'ensure_shared_services': prepareSharedServices();break;
      case 'optimize_portfolio': {
        prepareSharedServices();if(req.groups)office.portfolio.groups=req.groups.map(g=>({...g,createdAt:at,updatedAt:at}));
        for(const companyId of new Set(office.portfolio.groups.flatMap(g=>g.companyIds)))for(const service of office.portfolio.services){const contractId=`contract-${service.id}-${companyId}`;if(!office.portfolio.contracts.some(c=>c.id===contractId))office.portfolio.contracts.push({id:contractId,serviceId:service.id,recipientCompanyId:companyId,recipientOfficeId:null,recipientDepartmentId:null,employeeIds:[...service.employeeIds],allowedTools:[],status:'active',createdAt:at,updatedAt:at});}break;
      }
      case 'contract_service': {const contract={id:req.id||`contract-${id}`,serviceId:req.serviceId,recipientCompanyId:req.recipientCompanyId,recipientOfficeId:req.recipientOfficeId||null,recipientDepartmentId:req.recipientDepartmentId||null,employeeIds:req.employeeIds||[],allowedTools:req.allowedTools||[],status:req.status||'active',createdAt:at,updatedAt:at};const index=office.portfolio.contracts.findIndex(c=>c.id===contract.id);if(index<0)office.portfolio.contracts.push(contract);else office.portfolio.contracts[index]=contract;break;}
      case 'upsert_roadmap_item': {const item={id:req.id||`roadmap-${id}`,scope:req.scope,title:req.title,description:req.description||'',ownerEmployeeId:req.ownerEmployeeId,departmentId:req.departmentId||null,serviceContractId:req.serviceContractId||null,status:req.status||'planned',dependencies:req.dependencies||[],goalIds:req.goalIds||[],jobIds:req.jobIds||[],evidence:req.evidence||null,createdAt:at,updatedAt:at};const index=office.portfolio.roadmap.findIndex(r=>r.id===item.id);if(index<0)office.portfolio.roadmap.push(item);else office.portfolio.roadmap[index]=item;break;}
      case 'schedule_repository_reviews': office.lastAction={prepared:req.companyIds.length,enabled:false};break;
      case 'configure_policy': Object.assign(office.policy,{approvalMode:req.approvalMode,dispatchPaused:req.dispatchPaused,budget:{hardCapUsd:req.hardCapUsd,hardCapTokens:req.hardCapTokens,warningPercent:req.warningPercent}});office.budget.remainingUsd=req.hardCapUsd-office.budget.committedUsd;break;
      case 'post_chat': {let thread=office.chatThreads.find(t=>t.scope.kind===req.scope.kind&&t.scope.id===req.scope.id);if(!thread){thread={id:`thread-${id}`,scope:req.scope,messages:[]};office.chatThreads.push(thread);}thread.messages.push({id:`message-${id}`,role:'user',source:'user',content:req.content,createdAt:at});break;}
      case 'create_goal': {const goal={id:`goal-${id}`,companyId:office.activeCompanyId,scope:req.scope,title:req.title,description:req.description||'',mode:req.mode,status:'draft',maxIterations:req.maxIterations||1,iteration:0,jobIds:[],steps:[],runSettings:req.runSettings,createdAt:at,updatedAt:at};office.goals.push(goal);office.lastAction={goalId:goal.id};break;}
      case 'plan_goal': {const goal=office.goals.find(g=>g.id===req.goalId);goal.steps=[{id:'step-1',title:'Review the evidence',employeeId:'donna',goal:goal.description,dependsOn:[]}];goal.status='planned';let thread=office.chatThreads.find(t=>t.scope.kind===goal.scope.kind&&t.scope.id===goal.scope.id);if(!thread){thread={id:`thread-${id}`,scope:goal.scope,messages:[]};office.chatThreads.push(thread);}thread.messages.push({id:`message-${id}`,role:'system',source:'local',content:'Local planner created 1 assigned step. No model request has been made.',createdAt:at});break;}
      case 'execute_goal': {const goal=office.goals.find(g=>g.id===req.goalId);goal.iteration++;goal.status='running';goal.jobIds.push(`job-${id}`);break;}
      case 'pause_goal': case 'resume_goal': {const goal=office.goals.find(g=>g.id===req.goalId);goal.status=req.action==='pause_goal'?'paused':goal.iteration?'running':'planned';break;}
      case 'ensure_blueprint': if(!office.blueprints.some(b=>b.officeId===req.officeId))office.blueprints.push({id:`blueprint-${id}`,companyId:office.activeCompanyId,officeId:req.officeId,rooms:[],desks:[],whiteboards:[]});break;
      case 'upsert_room': {const blueprint=office.blueprints.find(b=>b.officeId===req.officeId);const room={id:req.id||`room-${id}`,name:req.name,departmentId:req.departmentId||null,x:req.x,y:req.y,width:req.width||.35,height:req.height||.35};const index=blueprint.rooms.findIndex(r=>r.id===room.id);if(index<0)blueprint.rooms.push(room);else blueprint.rooms[index]=room;office.lastAction={id:room.id};break;}
      case 'place_employee': {const blueprint=office.blueprints.find(b=>b.officeId===req.officeId);const desk={id:`desk-${id}`,roomId:req.roomId,employeeId:req.employeeId,x:req.x,y:req.y};const index=blueprint.desks.findIndex(d=>d.employeeId===req.employeeId);if(index<0)blueprint.desks.push(desk);else blueprint.desks[index]=desk;break;}
      case 'upsert_whiteboard': {const blueprint=office.blueprints.find(b=>b.officeId===req.officeId);const board={id:req.id||`board-${id}`,roomId:req.roomId,ownerEmployeeId:req.ownerEmployeeId,title:req.title,goalIds:req.goalIds||[],jobIds:req.jobIds||[],roadmapItemIds:req.roadmapItemIds||[],x:req.x,y:req.y};const index=blueprint.whiteboards.findIndex(b=>b.id===board.id);if(index<0)blueprint.whiteboards.push(board);else blueprint.whiteboards[index]=board;office.lastAction={id:board.id};break;}
      case 'github_operation': office.lastAction={github:req.operation==='branches'?{operation:'branches',branches:[{name:'main',sha:'a'.repeat(40),protected:true}],repository:'fixture/engineering'}:req.operation==='compare'?{operation:'compare',status:'ahead',aheadBy:1,behindBy:0,totalCommits:1,files:[{path:'docs/review.md',status:'modified',additions:2,deletions:1}]}:{operation:'publish_changes',commit:'b'.repeat(40),branch:req.branch}};break;
      case 'import_github_account': if(!office.companies.some(c=>c.id==='imported-fixture'))office.companies.push({id:'imported-fixture',name:'Imported fixture',repoUrl:'https://github.com/fixture/imported',status:'active',assistantId:'fixture-assistant',createdAt:at,source:'fixture',importedAt:at,githubStatus:'metadata-reviewed'}); break;
      case 'select_company': office.activeCompanyId=req.companyId; break;
      case 'create_company': office.companies.push({id,name:req.name,repoUrl:req.repoUrl || null,status:'active',assistantId:'fixture-assistant',createdAt:at,source:'fixture',importedAt:null,githubStatus:'unchecked'}); office.activeCompanyId=id; break;
      case 'create_office': office.offices.push({id,companyId:req.companyId,name:req.name,status:'active',assistantId:'fixture-assistant',createdAt:at}); break;
      case 'create_department': office.departments.push({id,companyId:office.activeCompanyId,officeId:req.officeId,name:req.name,status:'active',assistantId:'fixture-assistant',createdAt:at}); break;
      case 'hire_employee': office.employees.push({id,...base,name:req.name,role:req.role,companyId:req.companyId,officeId:req.officeId,departmentId:req.departmentId || null,kind:'specialist',status:'active',skillPaths:req.skillPaths || []}); break;
      case 'pause_employee': case 'resume_employee': case 'fire_employee': { const e=office.employees.find(e=>e.id===req.employeeId); if(e) e.status=req.action==='pause_employee'?'paused':req.action==='resume_employee'?'active':'fired'; break; }
      case 'pause_company': case 'resume_company': { const e=office.companies.find(e=>e.id===req.companyId); if(e) e.status=req.action==='pause_company'?'paused':'active'; break; }
      case 'pause_office': case 'resume_office': { const e=office.offices.find(e=>e.id===req.officeId); if(e) e.status=req.action==='pause_office'?'paused':'active'; break; }
      case 'enqueue_job': office.jobs.push({id,...base,...req,departmentId:req.departmentId || null,status:'queued',limits:{maxTokens:req.maxTokens,maxUsd:req.maxUsd,maxMinutes:req.maxMinutes},usage:{inputTokens:0,outputTokens:0,costUsd:0},dueAt:at,startedAt:null,finishedAt:null,artifactUri:null,error:null,summary:null,allowedTools:[],dependencies:[],contextHash:null,cacheKey:null,promptVersion:'fixture',workerId:null,leaseToken:null,leaseExpiresAt:null}); break;
      case 'pause_job': case 'resume_job': case 'cancel_job': { const job=office.jobs.find(j=>j.id===req.jobId); if(job) job.status=req.action==='pause_job'?'paused':req.action==='resume_job'?'queued':'cancelled'; break; }
      case 'create_schedule': office.schedules.push({id,companyId:req.companyId,name:req.name,enabled:true,everyMinutes:req.everyMinutes,nextRunAt:req.nextRunAt,lastEnqueuedAt:null,jobTemplate:req.jobTemplate}); break;
      case 'pause_schedule': case 'resume_schedule': {const s=office.schedules.find(s=>s.id===req.scheduleId); if(s) s.enabled=req.action==='resume_schedule';break;}
      case 'configure_cache': Object.assign(office.cache,{enabled:req.enabled,maxEntries:req.maxEntries,ttlMinutes:req.ttlMinutes});break;
      case 'clear_cache': office.cache.entries=office.cache.entries.filter(e=>e.companyId!==req.companyId);break;
      case 'add_knowledge': office.knowledge.push({id,companyId:req.companyId,title:req.title,summary:req.summary,artifactUri:req.artifactUri || '',createdAt:at});break;
    }
    office.events.push({id:eventId,at,actor:'owner',action:req.action,entityId:id,summary:`Fixture ${req.action}`});
    return result();
  }
  const bridge={
    version:3,
    getSettings:async()=>({runtimeUrl:null}),
    getVaultStatus:async()=>({encryptionAvailable:true,providers:{github:{configured:false,readable:false,updatedAt:null},anthropic:{configured:false,readable:false,updatedAt:null},openai:{configured:false,readable:false,updatedAt:null}}}),
    importCredentialFile:async(provider)=>{record('importCredentialFile',{provider});return{ok:true};},openPersonalDashboard:async()=>{record('openPersonalDashboard');return{ok:true,url:'http://127.0.0.1:9999'};},
    setApiKey:async(provider,key)=>{record('setApiKey',{provider,key});return{ok:true};},revokeApiKey:async()=>({ok:true}),
    getSystemInfo:async()=>({cpuModel:'Fixture CPU',logicalCores:4,totalRamBytes:8e9,freeRamBytes:4e9,os:{platform:'test',release:'fixture',arch:'x64'},disk:{totalBytes:32e9,freeBytes:16e9,path:'/fixture'},gpus:[],notes:[]}),
    getModelCatalog:async()=>({models:[],rejected:[],catalogPath:'/fixture/models.json'}),getJobStatus:async()=>[],
    listProviderModels:async()=>({ok:true,models:[{id:'fixture-model',label:'Fixture model'}]}),detectOllama:async()=>({available:false,baseUrl:'http://127.0.0.1:11434',models:[],error:'Fixture unavailable'}),
    listProjects:async()=>copy(projects),listRuns:async(projectId)=>copy(projectId?runs.filter(r=>r.projectId===projectId):runs),
    getProject:async(id)=>copy(projects.find(p=>p.id===id)||null),
    createProject:async(req)=>{record('createProject',req);const project={id:`p${projects.length + 1}`,...baseProject(req,at)};projects.push(project);return{ok:true,project:copy(project)};},
    startRun:async(req)=>{record('startRun',req);const run={id:'r1',projectId:req.projectId,status:'running',terminationReason:null,error:null,runBudget:req.runBudget,priceRates:req.priceRates,usage:{inputTokens:0,outputTokens:0,costUsd:0,elapsedSeconds:0},nodeStates:{},createdAt:at,updatedAt:at,finishedAt:null};runs.push(run);return{ok:true,runId:'r1'};},
    pauseRun:async()=>({ok:true}),resumeRun:async()=>({ok:true}),cancelRun:async()=>({ok:true}),readArtifact:async()=>({ok:false,error:'Fixture has no artifact'}),
    openOfflineAtlas:async()=>{record('openOfflineAtlas');return{ok:true};},connectRuntime:async(url)=>{record('connectRuntime',{url});return{ok:true,url};},backToLauncher:async()=>({ok:true}),openExternal:async(url)=>{record('openExternal',{url});return{ok:true};},
    createVenv:async()=>({ok:false,error:'Fixture does not create environments'}),downloadModel:async()=>({ok:false,error:'Fixture does not download'}),cancelJob:async()=>({ok:true}),
    companySnapshot:async()=>copy(company),registerCompany:async(req)=>{record('registerCompany',req);Object.assign(company.company,{repoUrl:req.repoUrl,githubStatus:'verified',lastCheckedAt:at,registeredAt:at,headSha:'1234567890abcdef'});return copy(company);},refreshCompany:async()=>copy(company),
    updateCompanyTask:async(req)=>{record('updateCompanyTask',req);Object.assign(company.tasks.find(t=>t.id===req.id),req);return copy(company);},indexCompanyRepository:async()=>copy(company),
    officeSnapshot:async()=>result(),officeCommand:async(req)=>officeCommand(req),officeWorkerStatus:async()=>copy(worker),
    setOfficeWorker:async(req)=>{record('setOfficeWorker',req);worker.enabled=req.enabled;return copy(worker);},runOfficeQueue:async()=>{record('runOfficeQueue');return copy(worker);},
    importGitHubCompanies:async(req)=>{record('importGitHubCompanies',req);office.companies.push({id:'imported-fixture',name:'Imported fixture',repoUrl:'https://github.com/fixture/imported',status:'active',assistantId:'fixture-assistant',createdAt:at,source:'fixture',importedAt:at,githubStatus:'metadata-reviewed'});return result();},
    onModeChanged:()=>()=>{},onJobEvent:()=>()=>{},onProjectEvent:()=>()=>{},
  };
  function baseProject(req,at) {return {...req,nodes:req.nodes.map((node,i)=>({...node,id:`n${i}`,dependsOn:node.dependsOn.map(j=>`n${j}`),status:'pending',budget:{maxTokens:4096,maxMinutes:5,maxUsd:.25}})),createdAt:at,updatedAt:at};}
  target.desktopBridge=bridge;target.__atlasFixture={calls,company,office,projects,runs};return target.__atlasFixture;
}
