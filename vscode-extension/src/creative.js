'use strict';
const ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/;
const HASH = /^[a-f0-9]{64}$/;
const BOUNDS = {frame:[0,100000],width:[16,2048],height:[16,2048],samples:[1,64]};
const TOOLS = Object.freeze({blender:'Blender',unreal:'Unreal Engine',inkscape:'Inkscape',ffmpeg:'FFmpeg / ffprobe','adobe-photoshop':'Adobe Photoshop'});
const OPERATIONS = Object.freeze({
  'blender.inspect':{label:'Inspect Blender scene',tool:'blender'},
  'blender.render':{label:'Render Blender frame',tool:'blender',fields:['frame','width','height','samples']},
  'blender.export_glb':{label:'Export Blender scene as GLB',tool:'blender'},
  'unreal.inspect':{label:'Inspect Unreal project',tool:'unreal'},
  'unreal.validate':{label:'Validate Unreal project',tool:'unreal'},
  'inkscape.export_png':{label:'Export SVG as PNG',tool:'inkscape',fields:['width','height']},
  'ffmpeg.probe':{label:'Inspect media metadata',tool:'ffmpeg'},
  'adobe.manifest':{label:'Read Photoshop manifest (.psd)',tool:'adobe-photoshop',external:true,extensions:['.psd']},
  'adobe.render':{label:'Render Photoshop or image asset (.psd, .png, .jpg, .jpeg)',tool:'adobe-photoshop',fields:['width','height'],external:true,extensions:['.psd','.png','.jpg','.jpeg']},
});
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const rows=value=>Array.isArray(value)?value:[];
const validId=value=>typeof value==='string'&&ID.test(value);
const text=(value,max=160)=>typeof value==='string'?value.replace(/(?:sk-ant-|sk-proj-|sk-|github_pat_|gh[pousr]_)[A-Za-z0-9_-]+|\bBearer\s+\S+/gi,'[credential omitted]').replace(/(?:file:\/\/|\/(?:home|Users|workspace|etc|opt|var|tmp)\/|[A-Z]:\\)[^\s<>"']+/gi,'[host path omitted]').replace(/[\u0000-\u001f\u007f]/g,' ').slice(0,max):'';
function identifier(value){if(typeof value!=='string'||!ID.test(value))throw new Error('Choose a valid company, employee, project or job.');return value;}
function relativePath(value){return typeof value==='string'&&value.length>0&&value.length<=512&&!/[\\:\u0000-\u001f\u007f%?#]/.test(value)&&value.split('/').every(part=>part!==''&&part!=='.'&&part!=='..');}
function validateCreativeInput(operation,input){
  const spec=Object.hasOwn(OPERATIONS,operation)?OPERATIONS[operation]:undefined;
  if(!spec||!object(input)||!relativePath(input.path))throw new Error('Choose a supported operation and a file path relative to its approved project.');
  if(spec.extensions&&!spec.extensions.some(extension=>input.path.toLowerCase().endsWith(extension)))throw new Error(`This Adobe operation accepts ${spec.extensions.join(', ')} files.`);
  const allowed=['path',...(spec.fields||[]),...(operation==='adobe.render'?['format']:[])];
  if(Object.keys(input).some(key=>!allowed.includes(key)))throw new Error('This operation does not accept arbitrary arguments.');
  for(const field of spec.fields||[])if(input[field]!==undefined&&(!Number.isSafeInteger(input[field])||input[field]<BOUNDS[field][0]||input[field]>BOUNDS[field][1]))throw new Error(`${field} must be an integer from ${BOUNDS[field][0]} to ${BOUNDS[field][1]}.`);
  if(input.format!==undefined&&!['png','jpeg'].includes(input.format))throw new Error('Choose PNG or JPEG output.');
  return input;
}
function validateCreativeRequest(operation,input){
  const keys=operation==='snapshot'?['companyId','employeeId']:operation==='assign'?['id','companyId','employeeId','projectId','toolIds']:operation==='run'?['id','companyId','employeeId','projectId','operation','input']:operation==='job'?['companyId','jobId']:operation==='cancel'?['id','companyId','jobId']:null;
  if(!keys||!object(input)||Object.keys(input).some(key=>!keys.includes(key)))throw new Error('Choose a supported creative operation.');
  for(const key of keys.filter(key=>key==='id'||/Id$/.test(key)))if(!(operation==='snapshot'&&key==='employeeId'&&input[key]===undefined))identifier(input[key]);
  if(operation==='assign'&&(!Array.isArray(input.toolIds)||input.toolIds.length>5||new Set(input.toolIds).size!==input.toolIds.length||input.toolIds.some(id=>!Object.hasOwn(TOOLS,id))))throw new Error('Choose unique reviewed creative tools.');
  if(operation==='run')validateCreativeInput(input.operation,input.input);
  return input;
}
function resultMetadata(value){
  if(!object(value))return undefined;
  const out={};
  for(const key of ['objects','meshes','materials','scenes','cameras','lights','frameStart','frameEnd','frame','width','height','samples','fileVersion','modules','plugins','durationSeconds','layers'])if(Number.isFinite(value[key])&&Math.abs(value[key])<=Number.MAX_SAFE_INTEGER)out[key]=value[key];
  for(const key of ['format','blenderVersion','engineAssociation','engine','device','provider','operation'])if(typeof value[key]==='string'&&/^[A-Za-z0-9_.:, -]{1,100}$/.test(value[key]))out[key]=text(value[key],100);
  for(const key of ['engineExecuted','validationPassed','remoteAuthVerified'])if(typeof value[key]==='boolean')out[key]=value[key];
  if(HASH.test(value.inputSha256||''))out.inputSha256=value.inputSha256;
  if(['complete','pending'].includes(value.cleanup))out.cleanup=value.cleanup;
  if(typeof value.adobeJobId==='string'&&/^[A-Za-z0-9:_-]{1,240}$/.test(value.adobeJobId))out.adobeJobId=value.adobeJobId;
  if(['submitted','running','succeeded','failed','outcome_unconfirmed','cancelled'].includes(value.state))out.state=value.state;
  if(Array.isArray(value.streams))out.streams=value.streams.slice(0,64).filter(object).map(stream=>{
    const row={};for(const key of ['codecType','codecName'])if(typeof stream[key]==='string'&&/^[A-Za-z0-9_.-]{1,80}$/.test(stream[key]))row[key]=stream[key];
    for(const key of ['width','height','sampleRate','channels'])if(Number.isFinite(stream[key])&&stream[key]>=0)row[key]=stream[key];return row;
  });
  return out;
}
function creativeJob(row,companyId,jobId){
  if(!object(row)||row.companyId!==companyId||!validId(row.id)||jobId&&row.id!==jobId||!validId(row.employeeId)||!validId(row.projectId)||!Object.hasOwn(OPERATIONS,row.operation)||!['queued','running','succeeded','failed','cancelled','interrupted'].includes(row.status))throw new Error('Creative job response belongs to a different scope or is invalid. Refresh before starting another task.');
  const out={id:row.id,companyId,employeeId:row.employeeId,projectId:row.projectId,operation:row.operation,status:row.status,outputs:[]};
  if(row.evidenceUri===`creative://jobs/${row.id}`)out.evidenceUri=row.evidenceUri;
  for(const key of ['createdAt','startedAt','finishedAt'])if(typeof row[key]==='string')out[key]=text(row[key],40);
  for(const file of rows(row.outputs).slice(0,32))if(object(file)&&relativePath(file.path)&&Number.isSafeInteger(file.bytes)&&file.bytes>=0&&HASH.test(file.sha256||''))out.outputs.push({path:text(file.path,500),bytes:file.bytes,sha256:file.sha256,mediaType:/^[A-Za-z0-9.+-]+\/[A-Za-z0-9.+-]+$/.test(file.mediaType||'')?file.mediaType:'application/octet-stream'});
  if(row.result)out.result=resultMetadata(row.result);
  if(row.error)out.error={code:ID.test(row.error.code||'')?row.error.code:'CREATIVE_FAILED',message:'Review the private runtime configuration and task status before starting another task.'};
  return out;
}
function creativeSnapshot(value,companyId){
  identifier(companyId);
  if(!object(value)||value.companyId!==companyId)throw new Error('Creative inventory belongs to a different company. Refresh the selected workspace.');
  const out={companyId,configured:value.configured===true,tools:[],projects:[],eligibleEmployees:[],assignments:[],jobs:[],limits:{}};
  out.tools=rows(value.tools).slice(0,16).filter(row=>object(row)&&Object.hasOwn(TOOLS,row.id)).map(row=>({id:row.id,configured:row.configured===true,available:row.available===true,operations:rows(row.operations).filter(op=>OPERATIONS[op]?.tool===row.id),version:text(row.version,80),readiness:['available','unavailable','not_configured','configured_unverified','verified'].includes(row.readiness)?row.readiness:undefined,remoteAuthVerified:row.remoteAuthVerified===true,reason:row.reason?'Review runtime configuration and software availability.':''}));
  out.projects=rows(value.projects).slice(0,100).filter(row=>object(row)&&row.companyId===companyId&&validId(row.id)).map(row=>({id:row.id,companyId,departmentId:validId(row.departmentId)?row.departmentId:null,allowedOperations:rows(row.allowedOperations).filter(op=>Object.hasOwn(OPERATIONS,op)),allowExternalUpload:row.allowExternalUpload===true}));
  out.eligibleEmployees=rows(value.eligibleEmployees).slice(0,200).filter(row=>object(row)&&validId(row.id)&&row.status==='active'&&(!row.companyId||row.companyId===companyId)).map(row=>({id:row.id,name:text(row.name,150)||row.id,role:text(row.role,200),departmentId:validId(row.departmentId)?row.departmentId:null,status:'active'}));
  out.assignments=rows(value.assignments).slice(-100).filter(row=>object(row)&&row.companyId===companyId&&validId(row.employeeId)&&validId(row.projectId)).map(row=>({companyId,employeeId:row.employeeId,projectId:row.projectId,toolIds:[...new Set(rows(row.toolIds).filter(id=>Object.hasOwn(TOOLS,id)))]}));
  for(const row of rows(value.jobs).slice(-100)){try{out.jobs.push(creativeJob(row,companyId));}catch{/* Never show another company's job. */}}
  if(object(value.limits))for(const [key,n]of Object.entries(value.limits))if(/^[A-Za-z][A-Za-z0-9]{0,50}$/.test(key)&&Number.isSafeInteger(n)&&n>=0)out.limits[key]=n;
  return out;
}
function readiness(tool){
  if(!tool.configured)return 'Not configured';
  if(!tool.available)return 'Unavailable';
  if(tool.id==='adobe-photoshop')return tool.remoteAuthVerified?'Adobe authentication verified':'Configured — Adobe authentication unverified';
  return `Detected${tool.version?' · '+tool.version:''}`;
}
function inventoryText(snapshot){
  const lines=['Creative tools · '+snapshot.companyId,'','Tools are controlled by the connected runtime. Assignment metadata does not grant native authority.',''];
  for(const tool of snapshot.tools)lines.push(`${TOOLS[tool.id]}: ${readiness(tool)}`,`Operations: ${tool.operations.join(', ')||'none'}`,'');
  lines.push('Adobe requires a licensed external service and an approved upload-enabled project. Inkscape, Blender and FFmpeg are separate open-source tools; they do not imply Adobe compatibility or licensing.','','Approved projects');
  for(const project of snapshot.projects)lines.push(`${project.id}${project.departmentId?' · '+project.departmentId:''}: ${project.allowedOperations.join(', ')||'no enabled operations'}`);
  lines.push('','Employee tool assignments');for(const assignment of snapshot.assignments)lines.push(`${assignment.employeeId} · ${assignment.projectId}: ${assignment.toolIds.join(', ')||'none'}`);
  lines.push('','Runtime resource limits',JSON.stringify(snapshot.limits,null,2));return lines.join('\n');
}
async function askCreativeAction(ui,snapshot,companyName,assertCurrent=()=>{}){
  const choose=async(items,title,extra={})=>{const value=await ui.showQuickPick(items,{title,ignoreFocusOut:true,...extra});assertCurrent();return value;};
  const action=await choose([{id:'inventory',label:'Review detected tools and project readiness'},{id:'assign',label:'Assign tools to an employee'},{id:'revoke',label:'Remove a tool assignment'},{id:'run',label:'Start a bounded creative task'},{id:'job',label:'Check a task result or cancel'}],`Creative tools · ${companyName}`);
  if(!action)return;
  if(action.id==='inventory')return {kind:'report',content:inventoryText(snapshot)};
  if(action.id==='revoke'){
    const assignments=snapshot.assignments.filter(row=>row.toolIds.length);
    if(!assignments.length)throw new Error('This company has no tool assignments to remove.');
    const selected=await choose(assignments.map(assignment=>({label:assignment.employeeId,description:assignment.projectId,detail:assignment.toolIds.join(', '),assignment})),'Choose an assignment to remove');
    return selected?{kind:'assign',employeeId:selected.assignment.employeeId,projectId:selected.assignment.projectId,toolIds:[]}:undefined;
  }
  if(action.id==='job'){
    if(!snapshot.jobs.length)throw new Error('This company has no creative tasks yet.');
    const selected=await choose([...snapshot.jobs].reverse().map(job=>({label:OPERATIONS[job.operation].label,description:job.status,detail:`${job.projectId} · ${job.employeeId} · ${job.id}`,job})),'Choose a creative task');
    if(!selected)return;
    const choices=[{id:'job',label:'Read current result'}];if(['queued','running'].includes(selected.job.status))choices.push({id:'cancel',label:'Request cancellation'});
    const operation=await choose(choices,`${selected.job.id} · ${selected.job.status}`);return operation?{kind:operation.id,jobId:selected.job.id}:undefined;
  }
  if(!snapshot.configured||!snapshot.projects.length)throw new Error('No approved creative project is configured for this company. Configure the runtime, then refresh.');
  if(action.id==='assign'){
    const project=(await choose(snapshot.projects.map(project=>({label:project.id,description:project.departmentId||'Company project',project})),'Choose an approved project'))?.project;if(!project)return;
    const employees=snapshot.eligibleEmployees.filter(employee=>!project.departmentId||!employee.departmentId||employee.departmentId===project.departmentId);
    if(!employees.length)throw new Error('No active eligible employee is available in this project scope.');
    const employee=(await choose(employees.map(employee=>({label:employee.name,description:employee.role,employee})),'Choose an eligible employee (authority checked at execution)'))?.employee;if(!employee)return;
    const assigned=snapshot.assignments.find(row=>row.employeeId===employee.id&&row.projectId===project.id);
    const tools=snapshot.tools.filter(tool=>tool.configured&&tool.operations.some(op=>project.allowedOperations.includes(op)));
    if(!tools.length)throw new Error('This project has no reviewed creative operations.');
    const selected=await choose(tools.map(tool=>({label:TOOLS[tool.id],description:readiness(tool),id:tool.id,picked:assigned?.toolIds.includes(tool.id)===true})),'Select tool assignments; empty selection removes access',{canPickMany:true});
    return selected===undefined?undefined:{kind:'assign',employeeId:employee.id,projectId:project.id,toolIds:selected.map(row=>row.id)};
  }
  const candidates=snapshot.assignments.flatMap(assignment=>{
    const project=snapshot.projects.find(row=>row.id===assignment.projectId),employee=snapshot.eligibleEmployees.find(row=>row.id===assignment.employeeId);
    if(!project||!employee||project.departmentId&&employee.departmentId&&employee.departmentId!==project.departmentId)return [];
    const operations=snapshot.tools.filter(tool=>tool.available&&assignment.toolIds.includes(tool.id)).flatMap(tool=>tool.operations).filter(op=>project.allowedOperations.includes(op)&&(!OPERATIONS[op].external||project.allowExternalUpload));
    return operations.length?[{label:employee.name,description:project.id,assignment,operations}]:[];
  });
  if(!candidates.length)throw new Error('Assign an available tool and approved project to an eligible employee before starting a task.');
  const selected=await choose(candidates,'Choose an employee and assigned project');if(!selected)return;
  const operation=(await choose(selected.operations.map(id=>({id,label:OPERATIONS[id].label,description:TOOLS[OPERATIONS[id].tool]})),'Choose a reviewed operation'))?.id;if(!operation)return;
  const path=await ui.showInputBox({title:'Project-relative input file',prompt:`File within approved project ${selected.assignment.projectId}${OPERATIONS[operation].extensions?' ('+OPERATIONS[operation].extensions.join(', ')+')':''}; host paths, URLs and shell arguments are not accepted.`,ignoreFocusOut:true,validateInput:value=>{try{validateCreativeInput(operation,{path:value});return undefined;}catch(error){return error.message;}}});assertCurrent();if(path===undefined)return;
  const input={path};
  for(const field of OPERATIONS[operation].fields||[]){const [minimum,maximum]=BOUNDS[field];const raw=await ui.showInputBox({title:`${field} (optional)`,prompt:`${minimum}–${maximum}; leave blank for the runtime’s bounded default.`,ignoreFocusOut:true,validateInput:value=>!value||/^\d+$/.test(value)&&Number(value)>=minimum&&Number(value)<=maximum?undefined:`Enter an integer from ${minimum} to ${maximum}, or leave blank.`});assertCurrent();if(raw===undefined)return;if(raw!=='')input[field]=Number(raw);}
  if(operation==='adobe.render'){const format=await choose([{label:'PNG',id:'png'},{label:'JPEG',id:'jpeg'}],'Output format');if(!format)return;input.format=format.id;}
  validateCreativeInput(operation,input);
  if(OPERATIONS[operation].external){const confirmed=await ui.showWarningMessage(`Upload ${path} from ${selected.assignment.projectId} to licensed Adobe services? This task may incur Adobe charges.`,{modal:true},'Start Adobe task');assertCurrent();if(confirmed!=='Start Adobe task')return;}
  return {kind:'run',employeeId:selected.assignment.employeeId,projectId:selected.assignment.projectId,operation,input};
}
module.exports={TOOLS,OPERATIONS,identifier,relativePath,validateCreativeInput,validateCreativeRequest,creativeSnapshot,creativeJob,readiness,inventoryText,askCreativeAction};
