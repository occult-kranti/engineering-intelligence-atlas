'use strict';
const crypto=require('node:crypto');
const OPERATOR_ROLE='Cloud Compute Operator';
const OPERATOR_SKILLS=Object.freeze(['skills/local-model-runtime-engineering/SKILL.md','skills/agent-research-director/SKILL.md']);
const ID=/^[A-Za-z0-9_.:-]{1,160}$/;
const cancelled=()=>({ok:true,cancelled:true});
const selectFields=(value,keys)=>Object.fromEntries(keys.filter(key=>value?.[key]!==undefined).map(key=>[key,value[key]]));
function configurationFromStatus(response){
  const value=response?.resources;
  if(!value||!Number.isSafeInteger(value.revision)||!['resources','grants','routes'].every(key=>Array.isArray(value[key])))throw new Error('A complete current model-resource configuration is required.');
  return {expectedRevision:value.revision,
    resources:value.resources.map(row=>selectFields(row,['id','companyId','ownerScope','model','digest'])),
    grants:value.grants.map(row=>selectFields(row,['id','resourceId','targetScope','permissions','includeDescendants','membershipRevision'])),
    routes:value.routes.map(row=>({...selectFields(row,['id','companyId','strategy']),experts:row.experts.map(item=>selectFields(item,['employeeId','resourceId','officeId','departmentId','serviceContractId'])),aggregator:row.aggregator?selectFields(row.aggregator,['employeeId','resourceId','officeId','departmentId','serviceContractId']):null,limits:selectFields(row.limits,['maxTokens','maxMinutes','maxParallel'])})),
    officeParents:(value.officeParents||[]).map(row=>selectFields(row,['officeId','parentOfficeId']))};
}
function createComputeOffice({vscode,call,snapshot,notify}){
  if(!vscode?.window||typeof call!=='function'||typeof snapshot!=='function')throw new TypeError('Compute office needs VS Code, call and snapshot adapters.');
  let lastReceipt=null;
  const uid=prefix=>`${prefix}-${crypto.randomUUID()}`;
  const input=(title,value='',validateInput)=>vscode.window.showInputBox({title,value,ignoreFocusOut:true,validateInput});
  const choose=(title,items,options={})=>vscode.window.showQuickPick(items,{title,ignoreFocusOut:true,...options});
  const item=(id,label,description,data)=>({id,label,description,data});
  const idInput=(title,value='')=>input(title,value,text=>ID.test(text)?undefined:'Use 1–160 letters, digits, periods, underscores, colons or hyphens.');
  async function invoke(method,args=[]){
    const id=args[0]?.id||args[0]?.idempotencyKey;
    if(id)lastReceipt={id,method};
    try{const result=await call(method,args);if(result?.ok===false)throw Object.assign(new Error(result.error||'The runtime did not accept this operation.'),{code:result.code});return result;}
    catch(error){if(id)error.message=`${error.message} No automatic retry was sent. Inspect receipt ${id} before repeating the action.`;throw error;}
  }
  async function announce(result,label){
    const id=result?.id||result?.requestId||result?.job?.id;
    const state=result?.job?.state||result?.job?.status||result?.run?.status||result?.environment?.state;
    const summary=`${label}${id?` · ${id}`:''}${state?` · ${state}`:''}`;
    if(typeof notify==='function')await notify(summary);else await vscode.window.showInformationMessage(summary);return result;
  }
  async function office(){const result=await snapshot();const state=result?.ok===true?result.snapshot:result;if(!state||!['companies','offices','departments','employees'].every(key=>Array.isArray(state[key])))throw new Error('Connect a runtime with a current canonical office snapshot first.');return state;}
  const active=row=>row.status==='active';
  async function company(state,title='Choose the company that owns this operation'){
    const selected=await choose(title,state.companies.filter(active).map(row=>item(row.id,row.name,row.id,row)));return selected?.data;
  }
  function employees(state,companyId){
    const owner=state.companies.find(row=>row.id===companyId);
    return state.employees.filter(row=>active(row)&&(row.companyId===companyId||row.companyId===null&&owner?.assistantId===row.id||(state.portfolio?.contracts||[]).some(contract=>contract.status==='active'&&contract.recipientCompanyId===companyId&&contract.employeeIds?.includes(row.id))));
  }
  async function employee(state,owner,excluded=[]){const selected=await choose('Choose the recorded employee responsible for this operation',employees(state,owner.id).filter(row=>!excluded.includes(row.id)).map(row=>item(row.id,row.name,`${row.role} · ${row.companyId===owner.id?'company':'shared'} · ${row.id}`,row)));return selected?.data;}
  async function actor(){const state=await office(),owner=await company(state);if(!owner)return null;const staff=await employee(state,owner);return staff?{state,owner,staff,companyId:owner.id,employeeId:staff.id}:null;}
  async function scope(state,companyId){
    const kind=await choose('Choose the exact ownership or access scope',['company','office','department','employee'].map(value=>item(value,value[0].toUpperCase()+value.slice(1),'Explicit canonical scope')));if(!kind)return null;
    if(kind.id==='company')return{kind:'company',id:companyId};
    const collection={office:'offices',department:'departments',employee:'employees'}[kind.id];
    const rows=state[collection].filter(row=>active(row)&&row.companyId===companyId);
    const target=await choose(`Choose the ${kind.id}`,rows.map(row=>item(row.id,row.name,row.id)));return target?{kind:kind.id,id:target.id}:null;
  }
  async function guarded(action){try{return await action();}catch(error){await vscode.window.showWarningMessage(String(error?.message||'This capability is unavailable on the connected runtime.').slice(0,1800));return{ok:false,error:error?.message||'Compute operation failed.'};}}
  async function hireOperator(){return guarded(async()=>{
    const state=await office(),owner=await company(state,'Choose a company for its Cloud Compute Operator');if(!owner)return cancelled();
    const existing=state.employees.find(row=>row.companyId===owner.id&&row.role===OPERATOR_ROLE&&row.status!=='fired');
    if(existing)return announce({ok:true,reused:true,employee:existing},`Reusing ${existing.name} (${existing.status})`);
    const offices=state.offices.filter(row=>active(row)&&row.companyId===owner.id);const location=offices.length===1?{id:offices[0].id}:await choose('Choose the operator office',offices.map(row=>item(row.id,row.name,row.id)));
    if(!location)return cancelled();
    const result=await invoke('officeCommand',[{action:'hire_employee',companyId:owner.id,officeId:location.id,name:'Cloud Compute Operator',role:OPERATOR_ROLE,skillPaths:[...OPERATOR_SKILLS]}]);
    return announce(result,'Cloud Compute Operator hired. Configure its host grant explicitly before executing commands.');
  });}
  async function requirements(){
    const system=await invoke('getSystemInfo'),state=await office(),owner=await company(state,'Choose the company for this workload brief');if(!owner)return cancelled();
    const workload=await choose('Workload to prepare',['coding','model','render','game'].map(value=>item(value,value[0].toUpperCase()+value.slice(1),'Record requirements against the observed host')));if(!workload)return cancelled();
    const minimum={};
    for(const[key,title,max]of [['gpuMemoryGiB','Minimum GPU memory (GiB); 0 for no GPU requirement',1024],['ramGiB','Minimum system RAM (GiB)',1048576],['freeDiskGiB','Minimum free disk (GiB)',1048576]]){
      const raw=await input(title,'0',value=>/^\d+(\.\d+)?$/.test(value)&&Number(value)<=max?undefined:`Choose a number between 0 and ${max}.`);if(raw===undefined)return cancelled();
      if(!/^\d+(\.\d+)?$/.test(raw)||!Number.isFinite(Number(raw))||Number(raw)<0||Number(raw)>max)throw new Error('Workload minimum is outside its allowed range.');minimum[key]=Number(raw);
    }
    const observedGpus=Array.isArray(system?.gpus)?system.gpus.slice(0,16).map(row=>typeof row==='string'?{name:row.slice(0,160)}:selectFields(row,['name','vendor','driver','memoryMB','memoryMiB','memoryTotalMB','totalMemoryMiB','memoryBytes','vramGiB'])):null;
    const brief={version:1,companyId:owner.id,workload:workload.id,minimum,observed:{at:new Date().toISOString(),platform:system?.platform||null,arch:system?.arch||null,gpus:observedGpus,gpuReportAvailable:observedGpus!==null},status:'requirements-recorded'};
    const content=`Cloud Compute Operator workload requirements\n${JSON.stringify(brief,null,2)}\nUse the recorded host observations to check readiness. Verify environment, model/application requirements and storage before preparing a plan.`;
    const result=await invoke('officeCommand',[{action:'post_chat',scope:{kind:'company',id:owner.id},content}]);
    await announce(result,`Workload requirements saved to ${owner.name}. GPU report: ${observedGpus===null?'unavailable':observedGpus.length?observedGpus.map(row=>row.name||'reported device').join(', '):'no devices reported'}.`);
    return{ok:true,requirements:brief,result};
  }
  async function hostPolicy(){
    const result=await invoke('hostStatus'),host=result?.host;if(!host||!Number.isSafeInteger(host.revision)||!Array.isArray(host.grants))throw new Error('Host policy is unavailable on this runtime.');
    const mode=await choose('Host execution policy',[
      item('off','Off','Stop admitting host commands'),item('manual','Manual','Each eligible job needs explicit approval'),item('auto','Auto','Eligible jobs execute within the explicit grants using the runtime OS account')]);if(!mode)return cancelled();
    const grants=host.grants.map(row=>selectFields(row,['id','companyId','employeeId']));
    if(mode.id!=='off'){
      const state=await office(),owner=await company(state);if(!owner)return cancelled();
      const target=await choose('Grant this company or one employee',[item('employee','One employee','Only the selected canonical employee'),item('company','Company','All eligible employees in the selected company')]);if(!target)return cancelled();
      const staff=target.id==='employee'?await employee(state,owner):null;if(target.id==='employee'&&!staff)return cancelled();
      if(!grants.some(row=>row.companyId===owner.id&&row.employeeId===(staff?.id||null)))grants.push({id:uid('host-grant'),companyId:owner.id,employeeId:staff?.id||null});
    }
    return announce(await invoke('hostConfigure',[{expectedRevision:host.revision,mode:mode.id,grants}]),`Host policy saved as ${mode.id}`);
  }
  async function hostJobs(){
    const result=await invoke('hostStatus');const jobs=result?.host?.jobs||[];
    const selected=await choose('Host jobs',jobs.map(row=>item(row.id,row.id,`${row.status} · ${row.companyId} · ${row.employeeId}`,row)));if(!selected)return cancelled();
    const action=await choose('Host job action',[item('hostInspect','Inspect','Read the current bounded receipt/output'),item('hostApprove','Approve','Allow a job waiting for manual approval'),item('hostCancel','Cancel','Request cancellation of this job')]);if(!action)return cancelled();
    const value=await invoke(action.id,[{id:selected.id}]);return announce(value,`Host job ${value?.job?.status||'inspected'}${typeof value.output==='string'?` · ${value.output.slice(-700)}`:''}`);
  }
  async function prepareEnvironment(){
    const who=await actor();if(!who)return cancelled();const environmentId=await idInput('Environment ID','python-main');if(environmentId===undefined)return cancelled();
    return announce(await invoke('environmentPrepare',[{id:uid('env-prepare'),companyId:who.companyId,employeeId:who.employeeId,environmentId}]),'Environment preparation submitted. Inspect its receipt before running Python.');
  }
  async function runPython(){
    const result=await invoke('environmentStatus');const rows=result?.environments?.items||[];
    const selected=await choose('Choose a verified ready environment',rows.filter(row=>row.state==='ready').map(row=>item(row.id,row.id,`${row.pythonVersion||'Python'} · ${row.companyId}`,row)));if(!selected)return cancelled();
    const files=await vscode.window.showOpenDialog({title:'Choose Python source to run in the managed remote environment',canSelectFiles:true,canSelectFolders:false,canSelectMany:false,filters:{Python:['py']}});if(!files?.length)return cancelled();
    const bytes=await vscode.workspace.fs.readFile(files[0]);if(bytes.byteLength>65536)throw new Error('Python source must be no larger than 64 KiB.');
    const command=Buffer.from(bytes).toString('utf8');if(!command.trim()||command.includes('\0'))throw new Error('Choose a nonempty Python source file without NUL bytes.');
    const cwd=await input('Absolute working directory on the connected runtime','/workspace',value=>value.startsWith('/')&&!/[\x00-\x1f\x7f]/.test(value)?undefined:'Provide an absolute runtime directory.');if(cwd===undefined)return cancelled();
    return announce(await invoke('environmentRun',[{id:uid('python'),companyId:selected.data.companyId,employeeId:selected.data.stewardEmployeeId,environmentId:selected.id,command,cwd,timeoutSeconds:1800,maxOutputBytes:1048576}]),'Python job submitted');
  }
  async function inspectEnvironment(){const result=await invoke('environmentStatus');const chosen=await choose('Choose an environment receipt',(result?.environments?.jobs||[]).map(row=>item(row.id,row.id,`${row.kind} · ${row.state} · ${row.environmentId}`)));if(!chosen)return cancelled();return announce(await invoke('environmentInspect',[{id:chosen.id}]),'Environment receipt inspected');}
  async function registerModel(){
    const who=await actor();if(!who)return cancelled();const configuration=configurationFromStatus(await invoke('resourceStatus'));
    const pool=(await invoke('modelPoolSnapshot',[{companyId:who.companyId,employeeId:who.employeeId}]))?.snapshot;
    const model=await choose('Choose an installed model and pin its verified digest',(pool?.models||[]).filter(row=>/^[a-f0-9]{64}$/.test(row.digest)).map(row=>item(row.name,row.name,`${row.sizeBytes} bytes · ${row.digest.slice(0,16)}…`,row)));if(!model)return cancelled();
    const ownerScope=await scope(who.state,who.companyId);if(!ownerScope)return cancelled();
    configuration.resources.push({id:uid('model'),companyId:who.companyId,ownerScope,model:model.data.name,digest:model.data.digest});
    return announce(await invoke('resourceConfigure',[configuration]),'Installed model registered with explicit ownership and pinned digest');
  }
  async function shareModel(){
    const configuration=configurationFromStatus(await invoke('resourceStatus'));const model=await choose('Choose the model resource to share',configuration.resources.map(row=>item(row.id,row.model,`${row.ownerScope.kind} · ${row.ownerScope.id}`,row)));if(!model)return cancelled();
    const state=await office(),owner=await company(state,'Choose the recipient company');if(!owner)return cancelled();const targetScope=await scope(state,owner.id);if(!targetScope)return cancelled();
    const permissions=await choose('Choose explicit model permissions',[item('use','Use','Run inference'),item('assign','Assign','Assign this model to an employee'),item('inspect','Inspect','Inspect resource details')],{canPickMany:true});if(!permissions?.length)return cancelled();
    const descendants=await choose('Scope membership',[item('exact','Exact scope','No descendant expansion'),item('descendants','Current descendants','Record the current descendant membership')]);if(!descendants)return cancelled();
    configuration.grants.push({id:uid('model-grant'),resourceId:model.id,targetScope,permissions:permissions.map(row=>row.id),includeDescendants:descendants.id==='descendants',membershipRevision:0});
    return announce(await invoke('resourceConfigure',[configuration]),'Model sharing grant saved against the inspected configuration revision');
  }
  async function modelAction(download){
    const who=await actor();if(!who)return cancelled();const pool=(await invoke('modelPoolSnapshot',[{companyId:who.companyId,employeeId:who.employeeId}]))?.snapshot;
    const rows=download?(pool?.catalog||[]):(pool?.models||[]).filter(model=>(pool?.catalog||[]).some(entry=>entry.id===model.name));
    const model=await choose(download?'Choose a catalog model to download':'Choose an installed model to assign',rows.map(row=>item(row.id||row.name,row.name||row.id,download?`Storage ceiling ${row.storageCeilingBytes} bytes`:row.digest,row)));if(!model)return cancelled();
    const payload={companyId:who.companyId,employeeId:who.employeeId,model:model.id,...(download?{idempotencyKey:uid('model-pull')}:{} )};
    return announce(await invoke(download?'modelPoolRequest':'modelPoolSelect',[payload]),download?'Model download requested; inspect its actual state before use':'Installed model assigned to the selected employee');
  }
  async function selectExpert(state,owner,resources,used){
    const staff=await employee(state,owner,used);if(!staff)return null;
    const resource=await choose('Choose this expert’s registered model',resources.map(row=>item(row.id,row.model,`${row.ownerScope.kind} · ${row.ownerScope.id}`)));if(!resource)return null;
    let contract=null;
    if(staff.companyId!==owner.id&&!(staff.companyId===null&&owner.assistantId===staff.id)){
      const contracts=(state.portfolio?.contracts||[]).filter(row=>row.status==='active'&&row.recipientCompanyId===owner.id&&row.employeeIds?.includes(staff.id));
      const selected=await choose('Choose the active shared-service contract',contracts.map(row=>item(row.id,row.id,'Explicit shared employee contract',row)));if(!selected)return null;contract=selected.data;
    }
    let officeId=contract?.recipientOfficeId||(staff.companyId===owner.id?staff.officeId:null);
    if(!officeId){const selected=await choose('Choose the expert’s execution office',state.offices.filter(row=>active(row)&&row.companyId===owner.id).map(row=>item(row.id,row.name,row.id)));if(!selected)return null;officeId=selected.id;}
    return{employeeId:staff.id,resourceId:resource.id,officeId,departmentId:contract?.recipientDepartmentId||(staff.companyId===owner.id?staff.departmentId:null)||null,serviceContractId:contract?.id||null};
  }
  async function configureRoute(){
    const configuration=configurationFromStatus(await invoke('resourceStatus')),state=await office(),owner=await company(state);if(!owner)return cancelled();
    const count=await choose('Number of expert model calls',[1,2,3,4].map(number=>item(String(number),String(number),'Independent bounded requests; no model-weight training')));if(!count)return cancelled();
    const experts=[];for(let index=0;index<Number(count.id);index++){const selected=await selectExpert(state,owner,configuration.resources,experts.map(row=>row.employeeId));if(!selected)return cancelled();experts.push(selected);}
    const aggregation=await choose('Optional synthesis',[item('none','No aggregator','Keep expert outputs separate'),item('aggregator','Choose an aggregator','One additional distinct employee synthesizes outputs')]);if(!aggregation)return cancelled();
    const aggregator=aggregation.id==='aggregator'?await selectExpert(state,owner,configuration.resources,experts.map(row=>row.employeeId)):null;if(aggregation.id==='aggregator'&&!aggregator)return cancelled();
    const maxTokens=await input('Total token ceiling for this route','4096',value=>/^\d+$/.test(value)&&Number(value)>=experts.length+(aggregator?1:0)&&Number(value)<=1000000?undefined:'Choose a bounded whole-number token ceiling.');if(maxTokens===undefined)return cancelled();
    const route={id:uid('route'),companyId:owner.id,strategy:experts.length===1&&!aggregator?'single':'ensemble',experts,aggregator,limits:{maxTokens:Number(maxTokens),maxMinutes:10,maxParallel:1}};
    configuration.routes.push(route);return announce(await invoke('resourceConfigure',[configuration]),`Expert request route saved (${route.id}). It does not train mixture-of-experts weights.`);
  }
  async function planRoute(){
    const who=await actor();if(!who)return cancelled();const registry=(await invoke('resourceStatus'))?.resources;
    const route=await choose('Choose the saved expert route',(registry?.routes||[]).filter(row=>row.companyId===who.companyId).map(row=>item(row.id,row.id,`${row.strategy} · ${row.experts.length} experts`)));if(!route)return cancelled();
    const task=await input('Task to plan; planning does not start model calls','',value=>value.trim()&&Buffer.byteLength(value)<=16000?undefined:'Write a task no larger than 16,000 UTF-8 bytes.');if(task===undefined)return cancelled();
    const result=await invoke('resourcePlan',[{id:uid('plan'),companyId:who.companyId,employeeId:who.employeeId,routeId:route.id,task}]);return announce(result,`Expert execution plan saved${result?.plan?.planHash?` · hash ${result.plan.planHash}`:''}. Start is a separate action.`);
  }
  async function receiptOperation(method,title){const id=await idInput(title,lastReceipt?.id||'');if(id===undefined)return cancelled();return announce(await invoke(method,[{id}]),'Receipt updated');}
  async function startPlan(kind){
    const design=kind==='design';const id=await idInput(design?'Saved design-install plan ID':'Saved expert execution plan ID',lastReceipt?.id||'');if(id===undefined)return cancelled();
    const result=await invoke(design?'designInspect':'resourceInspect',[{id}]),plan=result?.plan;
    if(!plan||!/^[a-f0-9]{64}$/.test(plan.planHash))throw new Error('This receipt does not contain a valid immutable plan hash.');
    const decision=await choose('Review the exact saved plan before starting',[item('start',design?`Install ${plan.toolId||'planned application'}`:`Start ${plan.steps?.length||0} planned model calls`,`${plan.id} · ${plan.planHash}`),item('leave','Leave planned','Do not start work')]);if(decision?.id!=='start')return cancelled();
    return announce(await invoke(design?'designInstall':'resourceStart',[{id:uid(design?'design-install':'run'),planId:plan.id,expectedPlanHash:plan.planHash}]),design?'Design application installation submitted':'Expert execution submitted');
  }
  async function designApplications(){
    const result=await invoke('designCatalog');const catalog=Array.isArray(result?.catalog)?result.catalog:result?.catalog?.tools||result?.tools||[];
    const selected=await choose('Design applications',catalog.map(row=>item(row.id,row.name,`${row.category} · ${row.method}`,row)));if(!selected)return cancelled();
    const action=await choose(selected.label,[item('details','Application details',selected.data.license),item('plan','Prepare an installation plan','Does not install or start the application'),item('start','Install a saved plan','Uses its exact plan hash'),item('inspect','Inspect an installation receipt','Read the actual job state')]);if(!action)return cancelled();
    if(action.id==='details'){await vscode.window.showInformationMessage(`${selected.data.name}: ${selected.data.runtime}. ${selected.data.headless}. ${selected.data.note||''}`);return result;}
    if(action.id==='start')return startPlan('design');if(action.id==='inspect')return receiptOperation('designInspect','Design installation receipt ID');
    const who=await actor();if(!who)return cancelled();const payload={id:uid('design-plan'),companyId:who.companyId,employeeId:who.employeeId,toolId:selected.id};
    if(selected.data.method==='reviewed-compose-required')throw new Error('This application requires a separately reviewed Docker Compose deployment. The managed installer does not install it automatically.');
    const distribution=await choose('Target runtime Linux distribution',[item('ubuntu','Ubuntu','Use the actual runtime distribution'),item('debian','Debian','Use the actual runtime distribution')]);if(!distribution)return cancelled();
    const versionId=await input('Exact runtime distribution version','',value=>/^\d{1,4}(\.\d{1,3})?$/.test(value)?undefined:'Copy VERSION_ID from the runtime OS release.');if(versionId===undefined)return cancelled();
    const arch=await choose('Target runtime architecture',[item('x86_64','x86_64','AMD64 / Intel or AMD 64-bit'),item('aarch64','aarch64','ARM 64-bit')]);if(!arch)return cancelled();payload.target={distribution:distribution.id,versionId,arch:arch.id};
    if(selected.data.method==='signed-apt'){const version=await input('Exact distribution package version to pin','',value=>/^[A-Za-z0-9][A-Za-z0-9.+:~_-]{0,99}$/.test(value)?undefined:'Use the reviewed package version available for this distribution.');if(version===undefined)return cancelled();payload.packageVersion=version;}
    else{const version=await input('Exact stable Godot version, such as 4.x-stable');if(version===undefined)return cancelled();const url=await input('Official Godot Linux release artifact URL');if(url===undefined)return cancelled();const sha256=await input('Reviewed artifact SHA-256','',value=>/^[a-f0-9]{64}$/.test(value)?undefined:'Provide the exact reviewed SHA-256.');if(sha256===undefined)return cancelled();payload.artifact={version,url,sha256,maxBytes:1024**3};}
    return announce(await invoke('designPlan',[payload]),'Design application plan saved. Installation is a separate action; GPU and display support still require verification.');
  }
  async function menu(){return guarded(async()=>{
    const actions=[
      ['requirements','Inspect host & workload requirements','Observed hardware plus bounded coding/model/render/game requirements',requirements],
      ['hire','Hire or reuse Cloud Compute Operator','Canonical employee and two existing skill references',hireOperator],
      ['host-policy','Host policy and grants','Off, manual or auto with explicit scope and revision',hostPolicy],['host-jobs','Inspect, approve or cancel a host job','Durable job IDs and actual state',hostJobs],
      ['env-prepare','Prepare a managed Python environment','Dedicated maintained virtual environment',prepareEnvironment],['env-run','Run a Python source file','Choose a verified environment and source file',runPython],['env-inspect','Inspect environment jobs','Read readiness and execution receipts',inspectEnvironment],
      ['model-register','Register installed model ownership','Pin an installed model and SHA-256 digest',registerModel],['model-share','Share a model with a scope','Company, office, department or employee permissions',shareModel],['model-assign','Assign an installed model','Explicit employee selection',()=>modelAction(false)],['model-download','Download a catalog model','Bounded shared model-pool request',()=>modelAction(true)],
      ['route-configure','Configure expert request routing','1–4 experts and an optional aggregator',configureRoute],['route-plan','Plan expert work','Create a plan without starting inference',planRoute],['route-start','Start a saved expert plan','Exact plan hash and distinct execution receipt',()=>startPlan('resource')],['route-inspect','Inspect expert work','Read the saved plan or run',()=>receiptOperation('resourceInspect','Expert plan or run ID')],['route-cancel','Cancel expert work','Request cancellation by execution ID',()=>receiptOperation('resourceCancel','Expert execution ID to cancel')],
      ['design','Design applications','Catalog, reviewed installation plans and receipts',designApplications]
    ];
    const chosen=await choose('Company compute office',actions.map(([id,label,description])=>item(id,label,description)));if(!chosen)return cancelled();return actions.find(row=>row[0]===chosen.id)[3]();
  });}
  return{menu,hireOperator};
}
module.exports={createComputeOffice,configurationFromStatus,OPERATOR_ROLE,OPERATOR_SKILLS};
