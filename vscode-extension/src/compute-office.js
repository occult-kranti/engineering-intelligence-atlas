'use strict';
const crypto=require('node:crypto');
const OPERATOR_ROLE='Cloud Compute Operator';
const OPERATOR_SKILLS=Object.freeze(['skills/local-model-runtime-engineering/SKILL.md','skills/agent-research-director/SKILL.md']);
const OPERATIONS_ROLES=Object.freeze([
  Object.freeze({id:'operator',name:OPERATOR_ROLE,skills:OPERATOR_SKILLS}),
  Object.freeze({id:'observer',name:'Runtime Observer',skills:Object.freeze(['skills/agent-research-director/SKILL.md','skills/local-model-runtime-engineering/SKILL.md'])}),
  Object.freeze({id:'knowledge',name:'Knowledge Steward',skills:Object.freeze(['skills/agent-research-director/SKILL.md'])}),
  Object.freeze({id:'connector',name:'Connector Steward',skills:Object.freeze(['skills/agent-research-director/SKILL.md','skills/engineering-organization-architect/SKILL.md'])}),
]);
const ID=/^[A-Za-z0-9_.:-]{1,160}$/;
const ACTIVITY_OUTCOMES=Object.freeze(['accepted','success','error','rejected','cancelled','unknown']);
const ACTIVITY_FAMILIES=new Set(['host','environment','resource','design','worker','office','workbench','model','compute','runtime']);
const ACTIVITY_METHODS=new Set(['godMode','configure','submit','approve','cancel','inspect','stopAll','prepare','run','resolve','plan','start','stop','close','status','connection','idle','wake','delay','diagnostic','discover','connect','disconnect','profile','intake','install','generate','setEnabled','runOnce','command','request','select','sync','create_company','create_office','hire_employee','post_chat','rebuild_office_index','hostGodMode','hostConfigure','hostSubmit','hostApprove','hostCancel','hostStopAll','environmentPrepare','environmentRun','resourceConfigure','resourcePlan','resourceStart','resourceCancel','designPlan','designInstall','officeCommand','setOfficeWorker','runOfficeQueue','modelPoolRequest','modelPoolSelect','createVenv','setApiKey','revokeApiKey','configureCloud','syncCloud','disconnectCloud','startRun','pauseRun','resumeRun','cancelRun']);
const count=value=>Number.isSafeInteger(value)&&value>=0?String(value):'unknown';
const yesNo=value=>value===true?'yes':value===false?'no':'unknown';
const publicName=value=>typeof value==='string'?value.replace(/[\x00-\x1f\x7f]/g,' ').slice(0,160):'Unnamed company';
function activityOperation(value,family){const combined=typeof value==='string'?(typeof family==='string'?`${family}.${value}`:value):'';const parts=combined.split('.');return parts.length===2&&ACTIVITY_FAMILIES.has(parts[0])&&ACTIVITY_METHODS.has(parts[1])?combined:'Other operation';}
function observedTime(value){return typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/.test(value)&&Number.isFinite(Date.parse(value))?new Date(value).toISOString():'Time unavailable';}
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
  async function hireRole(role){
    const state=await office(),owner=await company(state,`Choose a company for its ${role.name}`);if(!owner)return cancelled();
    const matches=state.employees.filter(row=>row.companyId===owner.id&&row.role===role.name);
    const existing=matches.find(row=>row.status!=='fired');
    if(existing)return announce({ok:true,reused:true,employee:existing},`Reusing ${publicName(existing.name)} (${publicName(existing.status)}). Hiring records do not enable the paid worker.`);
    if(matches.length)throw new Error(`This company already has a fired ${role.name}. Restore that employee explicitly before creating a replacement.`);
    const offices=state.offices.filter(row=>active(row)&&row.companyId===owner.id);const location=offices.length===1?{id:offices[0].id}:await choose('Choose the operations employee office',offices.map(row=>item(row.id,row.name,row.id)));
    if(!location)return cancelled();
    const result=await invoke('officeCommand',[{action:'hire_employee',companyId:owner.id,officeId:location.id,name:role.name,role:role.name,skillPaths:[...role.skills]}]);
    return announce(result,`${role.name} hired. Hiring records do not enable the paid worker or grant host execution.`);
  }
  async function hireOperator(){return guarded(()=>hireRole(OPERATIONS_ROLES[0]));}
  async function hireOperations(){const selected=await choose('Hire or reuse a permanent operations role',OPERATIONS_ROLES.map(role=>item(role.id,role.name,'Employee record only; paid workers remain unchanged',role)));return selected?hireRole(selected.data):cancelled();}
  async function godMode(){
    const [result,state]=await Promise.all([invoke('hostStatus'),office()]);
    const host=result?.host;
    if(!host||!Number.isSafeInteger(host.revision)||host.revision<0)throw new Error('A current host policy revision is required for owner host control.');
    const owners=state.companies.filter(active).sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0);
    if(owners.length>256||owners.some(row=>typeof row.id!=='string'||!ID.test(row.id))||new Set(owners.map(row=>row.id)).size!==owners.length)throw new Error('The active-company membership is invalid or exceeds the bounded host grant limit.');
    const membership=owners.map(row=>`${publicName(row.name)} (${row.id})`).join(' · ')||'No active companies';
    const choices=[{...item('disable','Disable owner host control','Stop admitting commands through God mode. Use Stop managed host work for existing jobs.'),detail:`Current active companies: ${membership}`}];
    if(owners.length)choices.unshift({...item('enable',`Enable for all ${owners.length} current active companies`,'Auto host commands use the runtime OS account; enabling starts no jobs and bypasses no budgets.'),detail:`Current active companies: ${membership}`});
    const decision=await choose(`God mode — owner host control · policy revision ${host.revision}`,choices);if(!decision)return cancelled();
    const enabled=decision.id==='enable';
    return announce(await invoke('hostGodMode',[{expectedRevision:host.revision,enabled,companyIds:enabled?owners.map(row=>row.id):[]}]),enabled?'Owner host control enabled for the listed current companies. No jobs were started.':'Owner host control disabled. Existing job receipts remain available.');
  }
  async function stopHostWork(){return announce(await invoke('hostStopAll'),'Stop requested for managed host work. Inspect receipts for final state.');}
  async function readiness(){
    const methods=['getSystemInfo','getSettings','officeWorkerStatus','hostStatus','cloudStatus'];
    const outcomes=await Promise.allSettled(methods.map(method=>invoke(method)));
    const available=(index,predicate)=>outcomes[index].status==='fulfilled'&&predicate(outcomes[index].value);
    const value=index=>outcomes[index].status==='fulfilled'?outcomes[index].value:null;
    const gib=bytes=>Number.isFinite(bytes)&&bytes>=0?`${(bytes/1024**3).toFixed(1)} GiB`:'unknown';
    const system=value(0),settings=value(1),worker=value(2),host=value(3)?.host,cloud=value(4);
    const rows=[
      item('system','Host observations',available(0,row=>row&&typeof row.os==='object'&&Array.isArray(row.gpus))?`RAM ${gib(system.totalRamBytes)} · free RAM ${gib(system.freeRamBytes)} · free disk ${gib(system.disk?.freeBytes)} · ${Math.min(system.gpus.length,16)} reported GPUs`:'Unavailable; no host capability is assumed'),
      item('settings','Runtime endpoint',available(1,row=>row&&Object.hasOwn(row,'runtimeUrl'))?`Configured: ${yesNo(typeof settings.runtimeUrl==='string'&&settings.runtimeUrl.length>0)}`:'Unavailable'),
      item('worker','Paid worker',available(2,row=>row&&typeof row.enabled==='boolean')?`Enabled: ${yesNo(worker.enabled)} · running: ${yesNo(worker.running)} · active jobs: ${count(Array.isArray(worker.activeJobIds)?worker.activeJobIds.length:worker.activeJobId?1:0)}`:'Unavailable'),
      item('host','Owner host control',available(3,row=>row?.host&&Number.isSafeInteger(row.host.revision))?`Available: ${yesNo(host.available)} · mode: ${['off','manual','auto'].includes(host.mode)?host.mode:'unknown'} · revision ${count(host.revision)} · grants ${count(Array.isArray(host.grants)?host.grants.length:undefined)} · jobs ${count(host.jobCount)}`:'Unavailable'),
      item('cloud','Cloud connector',available(4,row=>row&&typeof row.configured==='boolean')?`Configured: ${yesNo(cloud.configured)} · connected: ${yesNo(cloud.connected)} · queued commands: ${count(cloud.pendingCommands)}`:'Unavailable'),
    ];
    const selected=await choose('Connector readiness — observed status; no connection probes or paid calls',rows);
    if(selected)await vscode.window.showInformationMessage(`${selected.label}: ${selected.description}. Values are status reports; no connectivity test was run.`);
    return{ok:true,readiness:rows.map(row=>selectFields(row,['id','label','description']))};
  }
  async function activityRead(method,args=[]){try{return await invoke(method,args);}catch{throw new Error('Activity metadata is unavailable on this runtime. No model call or retry was sent.');}}
  async function activityScope(){
    const state=await office();const selected=await choose('Activity scope',[item('all','All companies','Metadata only'),...state.companies.filter(active).map(row=>item(`company:${row.id}`,publicName(row.name),'Current company metadata',{companyId:row.id}))]);
    return selected?selected.data||{}:null;
  }
  async function activityStatus(){
    const result=await activityRead('activityStatus'),value=result?.activity;
    if(!value||typeof value.available!=='boolean')throw new Error('Activity status is unavailable on this runtime.');
    const description=`Available: ${yesNo(value.available)} · retained events ${count(value.eventCount)} · latest sequence ${count(value.latestSequence)} · dropped ${count(value.droppedEvents)} · degraded ${yesNo(value.degraded)} · fenced ${yesNo(value.fenced)} · cached summaries ${count(value.summaryCacheEntries)}`;
    await vscode.window.showInformationMessage(`Activity metadata: ${description}. Summaries are deterministic; no model call is needed.`);
    return{ok:true,status:description};
  }
  async function activityLog(){
    const scope=await activityScope();if(scope===null)return cancelled();
    const result=await activityRead('activityQuery',[{limit:50,...scope}]);
    if(!Array.isArray(result?.events))throw new Error('Activity event metadata is unavailable on this runtime.');
    const events=result.events.slice(0,50).map((row,index)=>({id:`event-${index}`,label:`#${count(row.sequence)} · ${activityOperation(row.operation,row.family)}`,description:`${ACTIVITY_OUTCOMES.includes(row.outcome)?row.outcome:'unknown'} · ${observedTime(row.recordedAt)}`,detail:`Duration: ${count(row.durationMs)} ms. Metadata only; command, prompt and output text are excluded.`}));
    const selected=events.length?await choose(`Activity metadata · ${events.length} events${result.retentionGap===true?' · older history unavailable':''}${result.hasMore===true?' · more retained':''}`,events):null;
    if(selected)await vscode.window.showInformationMessage(`${selected.label} · ${selected.description}. ${selected.detail}`);
    if(!events.length)await vscode.window.showInformationMessage('No retained activity events in this scope.');
    return{ok:true,events,hasMore:result.hasMore===true,retentionGap:result.retentionGap===true};
  }
  async function activitySummary(){
    const scope=await activityScope();if(scope===null)return cancelled();
    const result=await activityRead('activitySummarize',[scope]),summary=result?.summary;
    if(!summary||!Number.isSafeInteger(summary.eventCount))throw new Error('The activity summary is unavailable on this runtime.');
    const rows=[item('total','Retained activity summary',`${count(summary.eventCount)} events · latest sequence ${count(summary.latestSequence)} · cache hit ${yesNo(result.cacheHit)}`)];
    for(const outcome of ACTIVITY_OUTCOMES)if(Number.isSafeInteger(summary.byOutcome?.[outcome]))rows.push(item(`outcome:${outcome}`,outcome,`${count(summary.byOutcome[outcome])} events`));
    for(const [family,total]of Object.entries(summary.byFamily||{}).slice(0,50))if(ACTIVITY_FAMILIES.has(family)&&Number.isSafeInteger(total))rows.push(item(`family:${family}`,family,`${count(total)} events`));
    for(const [operation,total]of Object.entries(summary.byOperation||{}).slice(0,50))if(activityOperation(operation)!=='Other operation'&&Number.isSafeInteger(total))rows.push(item(`operation:${operation}`,operation,`${count(total)} events`));
    const selected=await choose('Deterministic activity summary — no model call',rows);
    if(selected)await vscode.window.showInformationMessage(`${selected.label}: ${selected.description}`);
    return{ok:true,summary:rows.map(row=>selectFields(row,['id','label','description']))};
  }
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
  async function revokeHostGrant(){
    const host=(await invoke('hostStatus'))?.host;
    if(!host||!Number.isSafeInteger(host.revision)||host.revision<0||!['off','manual','auto'].includes(host.mode)||!Array.isArray(host.grants))throw new Error('A complete current host policy is required before revoking a grant.');
    const grants=host.grants.map(row=>selectFields(row,['id','companyId','employeeId']));
    const selected=await choose('Revoke one existing host grant',grants.map(row=>item(row.id,row.id,`${row.companyId} · ${row.employeeId===null?'all eligible company employees':row.employeeId}`)));if(!selected)return cancelled();
    if(grants.filter(row=>row.id===selected.id).length!==1)throw new Error('The selected host grant is not uniquely identified. Refresh its policy before revoking.');
    return announce(await invoke('hostConfigure',[{expectedRevision:host.revision,mode:host.mode,grants:grants.filter(row=>row.id!==selected.id)}]),'Selected host grant revoked. Other grants and the host mode were preserved.');
  }
  async function runHostScript(){
    const who=await actor();if(!who)return cancelled();
    const files=await vscode.window.showOpenDialog({title:'Choose a shell script for attributed owner host execution',canSelectFiles:true,canSelectFolders:false,canSelectMany:false,filters:{'Shell source':['sh','bash']}});if(!files?.length)return cancelled();
    if(!/\.(?:sh|bash)$/i.test(files[0].path||files[0].fsPath||''))throw new Error('Choose a .sh or .bash source file.');
    const stat=await vscode.workspace.fs.stat(files[0]);
    if(!Number.isSafeInteger(stat?.size)||stat.size<1||stat.size>65536)throw new Error('Host script source must be nonempty and no larger than 64 KiB.');
    const bytes=await vscode.workspace.fs.readFile(files[0]);if(bytes.byteLength>65536)throw new Error('Host script source must be no larger than 64 KiB.');
    let command;try{command=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes);}catch{throw new Error('Host script source must be valid UTF-8.');}
    if(!command.trim()||command.includes('\0'))throw new Error('Choose a nonempty shell source file without NUL bytes.');
    const validCwd=value=>typeof value==='string'&&value.startsWith('/')&&Buffer.byteLength(value)<=4096&&!/[\x00-\x1f\x7f]/.test(value);
    const cwd=await input('Absolute working directory on the connected host','',value=>validCwd(value)?undefined:'Provide an absolute runtime directory no larger than 4096 bytes.');if(cwd===undefined)return cancelled();if(!validCwd(cwd))throw new Error('Provide a valid absolute host working directory.');
    const validTimeout=value=>typeof value==='string'&&/^\d{1,5}$/.test(value)&&Number(value)>=1&&Number(value)<=86400;
    const timeout=await input('Host script timeout in seconds','1800',value=>validTimeout(value)?undefined:'Choose a whole number between 1 and 86400.');if(timeout===undefined)return cancelled();if(!validTimeout(timeout))throw new Error('Host script timeout must be between 1 and 86400 seconds.');
    const decision=await choose('Submit this attributed host script under the current policy',[
      {...item('submit','Submit host script',`${publicName(who.owner.name)} · ${publicName(who.staff.name)} · ${bytes.byteLength} bytes · ${Number(timeout)} seconds`),detail:`Directory: ${cwd}. Output cap: 1 MiB. Manual policy queues for approval; auto policy executes; off rejects. This does not change policy or grants.`},
      item('leave','Leave without submitting','No host work is started'),
    ]);if(decision?.id!=='submit')return cancelled();
    return announce(await invoke('hostSubmit',[{id:uid('host-script'),companyId:who.companyId,employeeId:who.employeeId,command,cwd,timeoutSeconds:Number(timeout),maxOutputBytes:1048576}]),'Attributed host script submitted under the existing policy. Inspect its receipt for actual state.');
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
  async function revokeModelGrant(){
    const configuration=configurationFromStatus(await invoke('resourceStatus'));
    const selected=await choose('Revoke one existing model sharing grant',configuration.grants.map(row=>item(row.id,row.id,`${row.resourceId} · ${row.targetScope.kind}:${row.targetScope.id} · ${row.permissions.join(', ')}`)));if(!selected)return cancelled();
    if(configuration.grants.filter(row=>row.id===selected.id).length!==1)throw new Error('The selected model sharing grant is not uniquely identified. Refresh its configuration before revoking.');
    configuration.grants=configuration.grants.filter(row=>row.id!==selected.id);
    return announce(await invoke('resourceConfigure',[configuration]),'Selected model sharing grant revoked. Resource ownership, other grants and expert routes were preserved.');
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
      ['god-mode','God mode — owner host control','Explicit auto control for all current active companies; starts no jobs',godMode],
      ['stop-host','Stop managed host work','Request cancellation of admitted managed host jobs',stopHostWork],
      ['readiness','Connector & runtime readiness','Read observed host, endpoint, worker, host-control and cloud status',readiness],
      ['activity-status','Activity logging & cache status','Bounded metadata journal and deterministic summary cache',activityStatus],
      ['activity-log','Browse activity metadata','Up to 50 retained records in an explicit scope; no raw commands or outputs',activityLog],
      ['activity-summary','Summarize activity metadata','Deterministic counts, outcomes and operations; no model spend',activitySummary],
      ['requirements','Inspect host & workload requirements','Observed hardware plus bounded coding/model/render/game requirements',requirements],
      ['hire','Hire or reuse Cloud Compute Operator','Canonical employee and two existing skill references',hireOperator],
      ['hire-operations','Hire or reuse permanent operations roles','Operator, Runtime Observer, Knowledge Steward or Connector Steward',hireOperations],
      ['host-policy','Host policy and grants','Off, manual or auto with explicit scope and revision',hostPolicy],['host-revoke','Revoke an existing host grant','Remove one exact grant using the current policy revision',revokeHostGrant],['host-run','Run an attributed host script','Choose .sh/.bash source, employee, directory and timeout; current policy applies',runHostScript],['host-jobs','Inspect, approve or cancel a host job','Durable job IDs and actual state',hostJobs],
      ['env-prepare','Prepare a managed Python environment','Dedicated maintained virtual environment',prepareEnvironment],['env-run','Run a Python source file','Choose a verified environment and source file',runPython],['env-inspect','Inspect environment jobs','Read readiness and execution receipts',inspectEnvironment],
      ['model-register','Register installed model ownership','Pin an installed model and SHA-256 digest',registerModel],['model-share','Share a model with a scope','Company, office, department or employee permissions',shareModel],['model-revoke','Revoke a model sharing grant','Remove one exact grant; preserve resources, scopes and routes',revokeModelGrant],['model-assign','Assign an installed model','Explicit employee selection',()=>modelAction(false)],['model-download','Download a catalog model','Bounded shared model-pool request',()=>modelAction(true)],
      ['route-configure','Configure expert request routing','1–4 experts and an optional aggregator',configureRoute],['route-plan','Plan expert work','Create a plan without starting inference',planRoute],['route-start','Start a saved expert plan','Exact plan hash and distinct execution receipt',()=>startPlan('resource')],['route-inspect','Inspect expert work','Read the saved plan or run',()=>receiptOperation('resourceInspect','Expert plan or run ID')],['route-cancel','Cancel expert work','Request cancellation by execution ID',()=>receiptOperation('resourceCancel','Expert execution ID to cancel')],
      ['design','Design applications','Catalog, reviewed installation plans and receipts',designApplications]
    ];
    const chosen=await choose('Company compute office',actions.map(([id,label,description])=>item(id,label,description)));if(!chosen)return cancelled();return actions.find(row=>row[0]===chosen.id)[3]();
  });}
  return{menu,hireOperator};
}
module.exports={createComputeOffice,configurationFromStatus,OPERATOR_ROLE,OPERATOR_SKILLS,OPERATIONS_ROLES};
