'use strict';
const {validateCreativeRequest,creativeSnapshot,creativeJob} = require('./creative');
const {validateModelRequest,modelSnapshot,executionStatus} = require('./development');
// Only these scoped operations are shared; transport, cancellation and receipts stay in each client.
async function creative(client,operation,input,context={}) {
    if(client.connection.kind!=='runtime')throw new Error('Connect to a headless runtime to control creative tools.');
    validateCreativeRequest(operation,input);
    const read=['snapshot','job'].includes(operation);
    const route=operation==='snapshot'?`/v1/creative?${new URLSearchParams(input)}`:operation==='job'?`/v1/creative/jobs?${new URLSearchParams(input)}`:`/v1/creative/${operation}`;
    try {
      const result=await client.request(route,read?'GET':'POST',read?undefined:input,{...context,id:input.id});
      if(result.ok!==true)throw new Error('Runtime creative receipt is invalid.');
      if(!read&&result.snapshotOmitted===true&&result.id===input.id)return {ok:true,id:input.id,receiptOnly:true,replayed:result.replayed===true};
      if(operation==='snapshot')return creativeSnapshot(result,input.companyId);
      if(operation==='assign') {
        const assignment=result.assignment;
        if(!assignment||assignment.companyId!==input.companyId||assignment.employeeId!==input.employeeId||assignment.projectId!==input.projectId||!Array.isArray(assignment.toolIds)||assignment.toolIds.length!==input.toolIds.length||new Set(assignment.toolIds).size!==assignment.toolIds.length||assignment.toolIds.some(id=>!input.toolIds.includes(id)))throw new Error('Creative assignment response does not match the requested company, employee, project and tools.');
        return {ok:true,replayed:result.replayed===true,assignment:{companyId:input.companyId,employeeId:input.employeeId,projectId:input.projectId,toolIds:[...assignment.toolIds]}};
      }
      const job=creativeJob(result.job,input.companyId,input.jobId);
      if(operation==='run'&&(result.accepted!==true||job.id!==input.id||job.employeeId!==input.employeeId||job.projectId!==input.projectId||job.operation!==input.operation))throw new Error('Creative task receipt does not match the requested operation.');
      return {ok:true,...(operation==='run'?{accepted:true}:{}),replayed:result.replayed===true,job};
    }catch(error){const hint=error?.code==='CREATIVE_AUTHORITY_DENIED'?' Review effective creative.execute or creative.upload authority for this employee and project.':'';throw new Error(`${String(error.message).slice(0,300)}${hint}${read?'':` No retry was sent. Retain creative request id ${input.id}; inspect creative tasks before submitting another.`}`);}
  }
async function models(client,operation,input,context={}) {
    if(client.connection.kind==='cloud')throw new Error('Model-pool control needs the connected desktop or a headless runtime.');
    validateModelRequest(operation,input);const read=operation==='snapshot';
    try {
      const methods={snapshot:'modelPoolSnapshot',pull:'modelPoolRequest',select:'modelPoolSelect',cancel:'modelPoolCancel'};
      const result=client.connection.kind==='desktop'?await client.call(methods[operation],[input],context)
        :await client.request(read?`/v1/models?${new URLSearchParams(input)}`:`/v1/models/${operation}`,read?'GET':'POST',read?undefined:input,{...context,id:input.idempotencyKey||input.requestId});
      if(result?.ok!==true)throw new Error('The model-pool receipt is invalid.');
      const snapshot=modelSnapshot(result.snapshot,input.companyId);
      if(operation==='pull'&&!snapshot.requests.some(row=>row.id===result.requestId&&row.employeeId===input.employeeId&&row.model===input.model))throw new Error('The download receipt does not match this employee and model.');
      if(operation==='select'&&!snapshot.assignments.some(row=>row.employeeId===input.employeeId&&row.model===input.model&&snapshot.models.some(model=>model.name===row.model&&model.digest===row.digest)))throw new Error('The model assignment did not confirm the installed digest.');
      if(operation==='cancel'&&!snapshot.requests.some(row=>row.id===input.requestId&&row.employeeId===input.employeeId))throw new Error('The model cancellation receipt does not match this employee.');
      return {ok:true,snapshot,...(typeof result.requestId==='string'&&/^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/.test(result.requestId)?{requestId:result.requestId}:{}),replayed:result.replayed===true,reused:result.reused===true};
    }catch(error){throw new Error(`${String(error.message).slice(0,300)}${read?'':` No retry was sent. Inspect model status before another action${input.idempotencyKey?`; retain download key ${input.idempotencyKey}`:input.requestId?`; retain request ${input.requestId}`:''}.`}`);}
  }
async function workerStatus(client,context={}) {
    if(client.connection.kind==='cloud')throw new Error('Provider-worker control is not exposed by a website pairing.');
    return executionStatus(client.connection.kind==='runtime'?await client.request('/v1/status','GET',undefined,context):await client.call('officeWorkerStatus',[],context),client.connection.kind);
  }
async function development(client,companyId,context={}) {
    validateModelRequest('snapshot',{companyId});
    if(client.connection.kind==='cloud')return {companyId,models:null,status:null,modelError:'Connect the desktop or runtime to inspect shared models.',workerError:'Website pairing does not expose provider-worker state.'};
    const [models,status]=await Promise.allSettled([client.models('snapshot',{companyId},context),client.workerStatus(context)]);
    return {companyId,models:models.status==='fulfilled'?models.value.snapshot:null,status:status.status==='fulfilled'?status.value:null,
      ...(models.status==='rejected'?{modelError:'Model inventory unavailable. Review the connected backend configuration.'}:{}),
      ...(status.status==='rejected'?{workerError:'Worker status unavailable. Update or reconnect the backend.'}:{})};
  }

module.exports={creative,models,workerStatus,development};
