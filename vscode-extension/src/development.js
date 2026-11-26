'use strict';
const {identifier,readiness,inventoryText} = require('./creative');

const PRIMARY_MODEL = 'qwen3-coder:30b-a3b-q4_K_M';
const MODEL_STORAGE_CEILING = 24 * 1024 ** 3;
const CONTEXT_LIMIT = 8192;
const TASK_TOKEN_BUDGET = 8000;
const MODEL = /^[a-z0-9][a-z0-9_.-]*(?:\/[a-z0-9][a-z0-9_.-]*)?(?::[A-Za-z0-9][A-Za-z0-9_.-]*)?$/;
const HASH = /^[a-f0-9]{64}$/;
const list = value => Array.isArray(value) ? value : [];
const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const validId = value => {try {identifier(value);return true;} catch {return false;}};
const validModel = value => typeof value === 'string' && value.length <= 160 && MODEL.test(value) && !/(?:^|[/:_.-])cloud(?:$|[/:_.-])/i.test(value);
const safeText = (value, maximum = 240) => typeof value === 'string' ? value.replace(/(?:sk-ant-|sk-proj-|sk-|github_pat_|gh[pousr]_)[A-Za-z0-9_-]+|\bBearer\s+\S+/gi,'[credential omitted]').replace(/(?:file:\/\/|\/(?:home|Users|workspace|etc|opt|var|tmp)\/|[A-Z]:\\)[^\s<>"']+/gi,'[host path omitted]').replace(/[\u0000-\u001f\u007f]/g,' ').slice(0,maximum) : '';

function validateModelRequest(operation, input) {
  const fields = operation === 'snapshot' ? ['companyId','employeeId'] : operation === 'pull' ? ['companyId','employeeId','model','idempotencyKey','maxBytes']
    : operation === 'select' ? ['companyId','employeeId','model'] : operation === 'cancel' ? ['companyId','employeeId','requestId'] : null;
  if (!fields || !plain(input) || Object.keys(input).some(key => !fields.includes(key))) throw new Error('Choose a supported model-pool action.');
  identifier(input.companyId);
  if (operation !== 'snapshot' || input.employeeId !== undefined) identifier(input.employeeId);
  if (['pull','select'].includes(operation) && input.model !== PRIMARY_MODEL) throw new Error('This development workflow uses the reviewed exact Qwen MoE tag.');
  if (operation === 'pull') {
    identifier(input.idempotencyKey);
    if (!Number.isSafeInteger(input.maxBytes) || input.maxBytes < 1 || input.maxBytes > MODEL_STORAGE_CEILING) throw new Error('The download requires a byte ceiling no larger than 24 GiB.');
  }
  if (operation === 'cancel') identifier(input.requestId);
  return input;
}

function modelSnapshot(value, companyId) {
  identifier(companyId);
  if (!plain(value) || value.companyId !== companyId) throw new Error('Model inventory belongs to a different company. Refresh this workspace.');
  const result = {companyId, available:value.available === true, enabled:value.enabled === true, infrastructureCost:'separate', catalog:[],models:[],assignments:[],requests:[]};
  for (const row of list(value.catalog).slice(0,64)) {
    if (!plain(row) || !validModel(row.id) || !Number.isSafeInteger(row.storageCeilingBytes) || row.storageCeilingBytes < 1) continue;
    const item = {id:row.id,name:safeText(row.name,160)||row.id,description:safeText(row.description,700),storageCeilingBytes:row.storageCeilingBytes};
    for (const key of ['artifactApproxBytes','contextLimitTokens','totalParametersBillions','activeParametersBillions']) if (Number.isFinite(row[key]) && row[key] > 0 && row[key] < Number.MAX_SAFE_INTEGER) item[key] = row[key];
    if (['dense','moe'].includes(row.architecture)) item.architecture=row.architecture;
    for (const key of ['quantization','license']) if (typeof row[key] === 'string') item[key]=safeText(row[key],50);
    result.catalog.push(item);
  }
  for (const row of list(value.models).slice(0,128)) if (plain(row) && validModel(row.name) && HASH.test(row.digest || '') && Number.isSafeInteger(row.sizeBytes) && row.sizeBytes > 0) result.models.push({name:row.name,digest:row.digest,sizeBytes:row.sizeBytes,loaded:row.loaded === true});
  for (const row of list(value.assignments).slice(0,512)) if (plain(row) && row.companyId === companyId && validId(row.employeeId) && validModel(row.model) && HASH.test(row.digest || '')) result.assignments.push({companyId,employeeId:row.employeeId,model:row.model,digest:row.digest});
  for (const row of list(value.requests).slice(-100)) if (plain(row) && row.companyId === companyId && validId(row.id) && validId(row.employeeId) && validModel(row.model) && ['queued','pulling','ready','failed','cancelled','interrupted'].includes(row.status)) {
    result.requests.push({id:row.id,companyId,employeeId:row.employeeId,model:row.model,status:row.status,
      completedBytes:Number.isSafeInteger(row.completedBytes)&&row.completedBytes>=0?row.completedBytes:0,
      totalBytes:Number.isSafeInteger(row.totalBytes)&&row.totalBytes>=0?row.totalBytes:0});
  }
  if (value.error) result.error='The model controller is unavailable or needs local configuration review.';
  return result;
}

function executionStatus(value, kind) {
  const worker = kind === 'runtime' ? value?.worker : value;
  if (kind === 'runtime' && (value?.ok !== true || value.execution !== 'headless') || !plain(worker) || typeof worker.enabled !== 'boolean' || typeof worker.running !== 'boolean') throw new Error('Worker status is unavailable in this connection.');
  return {execution:kind === 'runtime' ? 'headless' : 'desktop', providerJobs:kind === 'desktop' || value.capabilities?.providerJobs === true,
    worker:{enabled:worker.enabled,running:worker.running,...(Number.isSafeInteger(worker.concurrency) && worker.concurrency >= 1 && worker.concurrency <= 4 ? {concurrency:worker.concurrency} : {})}};
}

function modelReadiness(models) {
  if (!models) return 'Model inventory unavailable';
  if (!models.catalog.some(row => row.id === PRIMARY_MODEL && row.contextLimitTokens === CONTEXT_LIMIT)) return 'Reviewed MoE profile unavailable; update this backend';
  if (!models.enabled || !models.available) return 'Local model controller unavailable';
  const installed=models.models.find(row=>row.name===PRIMARY_MODEL);
  if (!installed) return 'MoE catalogued; not installed';
  return installed.loaded ? 'MoE installed and loaded' : 'MoE installed; not loaded';
}

function developmentReport({company, models, status, inventory, connectionKind}) {
  const lines=[`Creative development · ${safeText(company.name,160)}`,`Company: ${company.id}`,`Connection: ${connectionKind}`,'',
    'Model and worker observations',modelReadiness(models),
    status ? `Provider workers: ${status.worker.enabled?'enabled':'paused'} · ${status.worker.running?'work recorded in progress':'idle'}${status.worker.concurrency?` · concurrency ${status.worker.concurrency}`:''}` : 'Provider worker status unavailable.',
    'Worker status is global to the connected backend. Installed and loaded states do not establish measured GPU memory or performance.','',
    `Primary model: ${PRIMARY_MODEL}`,'8,192 context profile · 8,000 total-token task budget · 2-minute task limit · zero Ollama token charge.',
    'GPU/VPS rental, storage and transfer are separate bills; the application token budget does not cap those charges.',''];
  if (company.repoUrl) lines.push(`Repository record: ${safeText(company.repoUrl,300)}`,'Repository ownership and a company name do not establish a runtime project binding.','');
  if (models) {
    lines.push('Reviewed catalog');for(const row of models.catalog)lines.push(`${row.name} · ${row.id} · storage ceiling ${row.storageCeilingBytes} bytes${row.artifactApproxBytes?` · approximate published artifact ${row.artifactApproxBytes} bytes`:''}`);
    lines.push('','Installed model digests');for(const row of models.models)lines.push(`${row.name} · ${row.digest} · ${row.loaded?'loaded':'not loaded'}`);
    lines.push('','This company’s model assignments');for(const row of models.assignments)lines.push(`${row.employeeId}: ${row.model} · ${row.digest}`);
    lines.push('','Recent model requests');for(const row of models.requests)lines.push(`${row.id}: ${row.status} · ${row.model} · ${row.completedBytes}/${row.totalBytes} bytes`);
  }
  lines.push('','Creative execution',inventory ? inventoryText(inventory) : 'Connect a configured headless runtime for reviewed Blender/Unreal project execution. Desktop and cloud pairing alone do not expose those operations.');
  if (inventory) for(const tool of inventory.tools.filter(row=>row.id==='blender'))lines.push(`Blender backend: ${tool.renderDevice||'unknown'} · device readiness ${tool.renderDeviceVerified===true?'reported verified':'unverified by version discovery'}`);
  lines.push('','Unreal currently exposes descriptor inspection and DataValidation with NullRHI. Gameplay, Unreal rendering and Pixel Streaming are not implemented by this adapter.',
    'MoE tasks in this editor produce text from supplied context. They cannot execute shell commands, publish code, read a repository, grant authority or change device settings.',
    'Queueing a task does not enable workers. Native grants, lifecycle, token budget, model digest and any global dispatch pause are checked by the connected backend.');
  return lines.join('\n');
}

function employeesForDevelopment(snapshot, companyId) {
  const company=list(snapshot?.companies).find(row=>row.id===companyId);
  if (!company || company.status !== 'active') throw new Error('Choose an active company before preparing work.');
  const offices=list(snapshot.offices).filter(row=>row.companyId===companyId&&row.status==='active');
  const departments=list(snapshot.departments).filter(row=>row.companyId===companyId);
  const departmentActive = employee => {
    const seen=new Set();let id=employee.departmentId;
    while(id){if(seen.has(id))return false;seen.add(id);const row=departments.find(value=>value.id===id&&value.officeId===employee.officeId);if(!row||row.status!=='active')return false;id=row.parentDepartmentId;}
    return true;
  };
  return list(snapshot.employees).filter(row=>validId(row.id)&&row.status==='active'&&(row.companyId===companyId||row.id==='donna'&&row.companyId===null&&row.kind==='assistant')
    &&(!row.officeId||offices.some(office=>office.id===row.officeId))&&departmentActive(row));
}

function boundedMoECommand(snapshot, models, companyId, input) {
  if (!plain(input) || Object.keys(input).some(key=>!['employeeId','officeId','brief','idempotencyKey','digest'].includes(key))) throw new Error('Use only the reviewed development-task fields.');
  identifier(input.employeeId);identifier(input.officeId);identifier(input.idempotencyKey);
  const person=employeesForDevelopment(snapshot,companyId).find(row=>row.id===input.employeeId);
  const office=list(snapshot.offices).find(row=>row.id===input.officeId&&row.companyId===companyId&&row.status==='active');
  if (!person || !office || person.officeId && person.officeId !== office.id) throw new Error('Choose a current employee and office in this company.');
  if (!models || models.companyId!==companyId || !models.available || !models.enabled || !models.catalog.some(row=>row.id===PRIMARY_MODEL&&row.contextLimitTokens===CONTEXT_LIMIT)) throw new Error('Install the reviewed MoE profile and connect its local-only controller first.');
  const installed=models.models.find(row=>row.name===PRIMARY_MODEL);
  const assignment=models.assignments.find(row=>row.employeeId===person.id&&row.companyId===companyId&&row.model===PRIMARY_MODEL);
  if (!installed || !assignment || installed.digest!==assignment.digest || input.digest!==assignment.digest) throw new Error('The employee’s selected model is missing or its digest changed. Review and select it again.');
  if (typeof input.brief!=='string'||!input.brief.trim()||Buffer.byteLength(input.brief.trim(),'utf8')>2048||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(input.brief)) throw new Error('Write a task brief of at most 2,048 UTF-8 bytes.');
  return {action:'enqueue_job',companyId,officeId:office.id,departmentId:person.departmentId||null,employeeId:person.id,
    goal:input.brief.trim(),mode:'provider',provider:'ollama',model:PRIMARY_MODEL,authorized:true,
    allowedTools:[],dependencies:[],maxTokens:TASK_TOKEN_BUDGET,maxUsd:0,maxMinutes:2,
    priceRates:{inputUsdPerMillion:0,outputUsdPerMillion:0},promptVersion:'creative-development-v1',idempotencyKey:input.idempotencyKey};
}

async function askDevelopmentAction(ui, context, assertCurrent=()=>{}) {
  const {company,snapshot,models,status,connectionKind}=context;
  const choose=async(items,title)=>{const selected=await ui.showQuickPick(items,{title,ignoreFocusOut:true});assertCurrent();return selected;};
  const items=[{id:'report',label:'Review model, worker and creative readiness',description:modelReadiness(models)}];
  if (connectionKind!=='cloud' && models) items.push({id:'select',label:'Assign installed Qwen MoE to an employee'},
    {id:'pull',label:'Download reviewed Qwen MoE',description:'About 19 GB published artifact; review before download'},
    {id:'cancel',label:'Cancel a pending model download'},
    {id:'task',label:'Prepare a bounded MoE development task',description:'Text task · 8,000 total tokens · 2 minutes'});
  if (connectionKind==='runtime') items.push({id:'blender',label:'Blender · inspect, render or export an approved scene'},
    {id:'unreal',label:'Unreal · inspect or validate an approved project',description:'NullRHI validation; no rendering or gameplay'});
  else items.push({id:'connect',label:'Connect a headless creative runtime',description:'Replaces this editor’s current connection'});
  const action=await choose(items,`Creative development · ${safeText(company.name,120)}`);if(!action)return;
  if (['report','blender','unreal','connect'].includes(action.id)) return {kind:action.id};
  if (action.id==='cancel') {
    const requests=models.requests.filter(row=>['queued','pulling'].includes(row.status)&&row.model===PRIMARY_MODEL);
    if (!requests.length) throw new Error('This company has no pending Qwen MoE download.');
    const selected=await choose(requests.map(request=>({label:request.id,description:request.status,request})),'Choose the pending download');
    return selected?{kind:'cancel',employeeId:selected.request.employeeId,requestId:selected.request.id}:undefined;
  }
  const candidates=employeesForDevelopment(snapshot,company.id);
  if (!candidates.length) throw new Error('This company has no active eligible employee. Configure the team first.');
  if (action.id==='task' && !status?.providerJobs) throw new Error('This connection has no verified provider-job capability.');
  const person=(await choose(candidates.map(employee=>({label:safeText(employee.name,150)||employee.id,description:safeText(employee.role,200),employee})),'Choose the company employee'))?.employee;if(!person)return;
  const catalog=models.catalog.find(row=>row.id===PRIMARY_MODEL&&row.contextLimitTokens===CONTEXT_LIMIT);
  if (!catalog) throw new Error('This backend does not expose the reviewed 8k MoE profile. Update it before using this workflow.');
  if (action.id==='pull') return {kind:'pull',employeeId:person.id,model:PRIMARY_MODEL,maxBytes:Math.min(catalog.storageCeilingBytes,MODEL_STORAGE_CEILING)};
  const installed=models.models.find(row=>row.name===PRIMARY_MODEL);
  if (!models.enabled || !models.available || !installed) throw new Error('The reviewed model is not installed on an available local-only controller. Download it and refresh first.');
  if (action.id==='select') return {kind:'select',employeeId:person.id,model:PRIMARY_MODEL,digest:installed.digest};
  const assignment=models.assignments.find(row=>row.employeeId===person.id&&row.model===PRIMARY_MODEL&&row.digest===installed.digest);
  if (!assignment) throw new Error('Assign the installed model digest to this employee before preparing a task.');
  const offices=list(snapshot.offices).filter(row=>row.companyId===company.id&&row.status==='active'&&(!person.officeId||person.officeId===row.id));
  if (!offices.length) throw new Error('This employee needs an active office in the selected company.');
  const office=offices.length===1?offices[0]:(await choose(offices.map(row=>({label:safeText(row.name,150)||row.id,office:row})),'Choose the task office'))?.office;if(!office)return;
  const brief=await ui.showInputBox({title:'Bounded MoE development brief',prompt:'Supply the evidence needed for one text task. Up to 2,048 UTF-8 bytes; no repository read, shell, file edit or publishing tool is granted.',ignoreFocusOut:true,
    validateInput:value=>!value.trim()||Buffer.byteLength(value.trim(),'utf8')>2048?'Enter a nonempty brief within 2,048 UTF-8 bytes.':undefined});assertCurrent();if(brief===undefined)return;
  return {kind:'task',employeeId:person.id,officeId:office.id,brief,digest:assignment.digest};
}

module.exports={PRIMARY_MODEL,MODEL_STORAGE_CEILING,CONTEXT_LIMIT,TASK_TOKEN_BUDGET,validateModelRequest,modelSnapshot,executionStatus,modelReadiness,developmentReport,employeesForDevelopment,boundedMoECommand,askDevelopmentAction};
