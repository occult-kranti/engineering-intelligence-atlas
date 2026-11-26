'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {AtlasClient,origin,pairing,studioUrl}=require('../src/client');
const {PRIMARY_MODEL,MODEL_STORAGE_CEILING}=require('../src/development');
const json=(body,status=200,headers={})=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json',...headers}});
const cloud={kind:'cloud',url:'https://atlas.example',deviceToken:'device-token-test-1234567890',siteAccessToken:'site-test-token-1234567890'};
const modelState=(companyId='a')=>({companyId,available:true,enabled:true,catalog:[{id:PRIMARY_MODEL,name:'Qwen MoE',storageCeilingBytes:MODEL_STORAGE_CEILING,contextLimitTokens:8192}],models:[{name:PRIMARY_MODEL,digest:'a'.repeat(64),sizeBytes:19_000_000_000,loaded:false}],assignments:[{companyId,employeeId:'developer',model:PRIMARY_MODEL,digest:'a'.repeat(64)}],requests:[]});
test('studio links preserve company scope and never turn identifiers into navigation',()=>{
  for(const view of ['blueprint','softboard','timeline','whiteboard']) {
    const result=new URL(studioUrl(cloud.url,'company/with ?/# & symbols',view));
    assert.equal(result.origin,cloud.url);assert.equal(result.pathname,'/workspace/chrome.html');
    assert.equal(result.searchParams.get('company'),'company/with ?/# & symbols');
    assert.equal(result.searchParams.get('workspace'),view);assert.equal(result.hash,'#office');
    assert.equal([...result.searchParams].length,2);
  }
});
test('studio navigation rejects credential-bearing origins and unsupported destinations',()=>{
  for(const base of ['https://user:pass@atlas.example','https://atlas.example?token=x','http://outside.example'])assert.throws(()=>studioUrl(base,'company','blueprint'));
  for(const view of ['//evil.example','../api/devices','chat?token=x',null])assert.throws(()=>studioUrl(cloud.url,'company',view));
  for(const id of ['',null,'x'.repeat(201)])assert.throws(()=>studioUrl(cloud.url,id,'blueprint'));
});
test('restricts cloud and desktop origins before sending any credentials',()=>{
  for(const bad of ['http://public.example','https://user:pass@atlas.example','https://atlas.example/path','https://atlas.example?token=secret','file:///tmp/app','https://atlas.example/#key'])assert.throws(()=>origin(bad));
  assert.equal(origin('https://atlas.example/'),'https://atlas.example');
  assert.equal(origin('http://127.0.0.1:6001/#session=x',true),'http://127.0.0.1:6001');
  assert.throws(()=>origin('http://192.168.1.2:6001',true));
});
test('pairs one-time desktop link using expected Origin without persisting launch secret',async()=>{
  const launch='a'.repeat(64),session='b'.repeat(64);let request;
  const connection=await AtlasClient.connectDesktop(`http://127.0.0.1:6001/#session=${launch}`,async(url,init)=>{request={url,init};return json({ok:true},200,{'set-cookie':`atlas_session=${session}; HttpOnly; SameSite=Strict; Path=/`});});
  assert.equal(request.url,'http://127.0.0.1:6001/api/session');
  assert.equal(request.init.headers.Origin,'http://127.0.0.1:6001');
  assert.equal(request.init.redirect,'error');
  assert.equal(JSON.parse(request.init.body).token,launch);
  assert.equal(connection.cookie,`atlas_session=${session}`);
  assert.ok(!JSON.stringify(connection).includes(launch));
});
test('rejected desktop session does not create a connection',async()=>{
  await assert.rejects(AtlasClient.connectDesktop(`http://127.0.0.1:6001/#session=${'a'.repeat(64)}`,async()=>json({ok:false},401)),/expired or was used/);
});
test('cloud pairing is origin-bound and secrets travel only in request headers',async()=>{
  let called=0;
  await assert.rejects(AtlasClient.connectCloud('https://wrong.example',JSON.stringify({...cloud,baseUrl:cloud.url}),async()=>{called++;return json({signedIn:true});}),/different website/);
  assert.equal(called,0);
  const result=await AtlasClient.connectCloud(cloud.url,JSON.stringify(cloud),async(url,init)=>{
    assert.equal(url,cloud.url+'/api/session');assert.equal(init.headers.Authorization,'Bearer '+cloud.deviceToken);assert.equal(init.headers['OAI-Sites-Authorization'],'Bearer '+cloud.siteAccessToken);assert.ok(!url.includes(cloud.deviceToken));return json({signedIn:true});
  });assert.equal(result.kind,'cloud');assert.equal(result.deviceToken,cloud.deviceToken);
});
test('queue waits for desktop and carries expected revision, never optimistic completion',async()=>{
  const calls=[];
  const client=new AtlasClient(cloud,async(url,init)=>{calls.push({url,init});return url.endsWith('/workspace')?json({revision:7,snapshot:{companies:[]}}):json({id:'cmd-1',status:'waiting-desktop'});});
  const result=await client.command({action:'pause_employee',employeeId:'employee-1'});
  assert.equal(result.queued,true);assert.equal(result.status,'waiting-desktop');assert.equal(calls.length,2);
  assert.deepEqual(JSON.parse(calls[1].init.body),{expectedRevision:7,command:{action:'pause_employee',payload:{employeeId:'employee-1'}}});
});
test('stale revision is a conflict and no command is retried automatically',async()=>{
  let posts=0;
  const client=new AtlasClient(cloud,async(url)=>url.endsWith('/workspace')?json({revision:7}):(posts++,json({error:'conflict'},409)));
  await assert.rejects(client.command({action:'pause_employee',employeeId:'x'}),/conflicts with newer/);assert.equal(posts,1);
});
test('paid chat keeps request id for accounting and never retries an ambiguous failure',async()=>{
  let calls=0;
  const client=new AtlasClient(cloud,async(url,init)=>{calls++;assert.equal(url,cloud.url+'/api/chat');assert.deepEqual(JSON.parse(init.body),{companyId:'atlas',content:'Review the roadmap',requestId:'attempt-1'});throw new Error('network');});
  await assert.rejects(client.chat('atlas','Review the roadmap','attempt-1'),/unavailable/);assert.equal(calls,1);
});
test('explicit cloud chat allows provider completion while reads and commands retain short timeouts',async(t)=>{
  const timeouts=[];
  t.mock.method(AbortSignal,'timeout',ms=>{timeouts.push(ms);return new AbortController().signal;});
  const client=new AtlasClient(cloud,async(url,init)=>{
    if(url.endsWith('/workspace'))return json({revision:7,snapshot:{companies:[]}});
    if(url.endsWith('/api/chat')&&init.method==='POST')return json({ok:true,reply:'Saved response'});
    if(url.includes('/api/chat?'))return json({messages:[]});
    return json({id:'cmd-1',status:'waiting-desktop'});
  });
  await client.snapshot();
  assert.equal((await client.chat('atlas','Review the roadmap','attempt-timeout')).reply,'Saved response');
  await client.chatHistory('atlas');
  await client.command({action:'pause_employee',employeeId:'employee-1'});
  assert.deepEqual(timeouts,[45000,210000,45000,45000]);
});
test('local chat saves a user brief and does not invent a provider answer',async()=>{
  const calls=[];const client=new AtlasClient({kind:'desktop',url:'http://127.0.0.1:6001',cookie:'atlas_session='+ 'a'.repeat(64)},async(url,init)=>{calls.push(JSON.parse(init.body));return json({result:{ok:true,snapshot:{}}});});
  const response=await client.chat('atlas','Hello','unused');assert.equal(response.saved,true);assert.equal(response.reply,null);assert.equal(calls[0].method,'officeCommand');assert.equal(calls[0].args[0].action,'post_chat');
});
test('sign-in HTML and oversized responses fail closed',async()=>{
  const client=new AtlasClient(cloud,async()=>new Response('<html>Sign in</html>',{headers:{'Content-Type':'text/html'}}));
  await assert.rejects(client.snapshot(),/sign-in page/);
  const large=new AtlasClient(cloud,async()=>json({data:'x'.repeat(9*1024*1024)}));await assert.rejects(large.snapshot(),/exceeds/);
});
test('malformed pairing text is rejected without retaining unrelated keys',()=>{
  assert.throws(()=>pairing('{oops'));
  assert.throws(()=>pairing(JSON.stringify({deviceToken:'too short'})));
  assert.deepEqual(pairing(JSON.stringify({deviceToken:cloud.deviceToken,unexpected:'do not retain'})),{deviceToken:cloud.deviceToken});
});
test('stored connections are validated before any credential can be sent',()=>{
  for(const value of [null,{}, {...cloud,kind:'other'}, {...cloud,url:'http://outside.example'}, {...cloud,url:'https://atlas.example/#token'}, {...cloud,deviceToken:'short'}, {kind:'desktop',url:'http://127.0.0.1:6001',cookie:'other=secret'}])assert.throws(()=>new AtlasClient(value,()=>assert.fail('No request should be sent')));
  const c=new AtlasClient({...cloud,privateUnrelatedKey:'discard'});
  assert.equal(c.connection.privateUnrelatedKey,undefined);
});
test('rejected ownership requests expose bounded status and interrupted reads never retry mutations',async()=>{
  const c=new AtlasClient(cloud,async()=>json({error:'Permanent assistants retain scope ownership; pause instead of firing'},400));
  await assert.rejects(c.request('/api/commands','POST',{}),/failed \(400\).*Inspect its saved state/);
  let calls=0;
  const interrupted=new AtlasClient(cloud,async()=>{calls++;return new Response(new ReadableStream({start(controller){controller.error(new Error('body aborted'));}}),{headers:{'Content-Type':'application/json'}});});
  await assert.rejects(interrupted.chat('atlas','Brief','attempt-interrupted'),/may already have been saved/);assert.equal(calls,1);
});
test('primitive JSON responses and oversized declared bodies are rejected',async()=>{
  for(const body of [null,3,[],true])await assert.rejects(new AtlasClient(cloud,async()=>json(body)).request('/api/session'),/invalid data/);
  await assert.rejects(new AtlasClient(cloud,async()=>json({},200,{'content-length':String(10*1024*1024)})).request('/api/session'),/exceeds/);
});
const runtime={kind:'runtime',url:'http://127.0.0.1:8788',controlToken:'synthetic-runtime-token-012345678901234567890'};
const hash='a'.repeat(64);
test('runtime connection verifies service and native snapshot while retaining owner token only in headers',async()=>{
  const calls=[];
  const connection=await AtlasClient.connectRuntime(runtime.url,runtime.controlToken,async(url,init)=>{
    calls.push({url,init});assert.equal(init.headers.Authorization,'Bearer '+runtime.controlToken);assert.equal(init.headers.Cookie,undefined);assert.equal(init.headers.Origin,undefined);assert.equal(init.redirect,'error');
    return url.endsWith('/status')?json({ok:true,execution:'headless'}):json({ok:true,stateHash:hash,snapshot:{companies:[]}});
  });
  assert.deepEqual(connection,runtime);assert.deepEqual(calls.map(row=>row.url),[runtime.url+'/v1/status',runtime.url+'/v1/office']);
  assert.equal(calls.some(row=>row.url.includes(runtime.controlToken)),false);
  let attempted=0;for(const url of ['http://outside.example','http://127.1:8788','http://127.0.0.1:8788/../','https://user:pass@runtime.example'])await assert.rejects(AtlasClient.connectRuntime(url,runtime.controlToken,async()=>{attempted++;return json({ok:true});}));
  assert.equal(attempted,0);
});
test('runtime commands preserve fresh state hash, stable receipt identity and applied status',async()=>{
  const calls=[];
  const c=new AtlasClient(runtime,async(url,init)=>{calls.push({url,init});return url.endsWith('/office')?json({ok:true,stateHash:hash,snapshot:{companies:[]}}):json({ok:true,id:JSON.parse(init.body).id,result:{ok:true,stateHash:'b'.repeat(64)}});});
  const result=await c.command({action:'rename_office',officeId:'office-a',name:'Creative'});
  assert.equal(result.ok,true);assert.equal(calls.length,2);
  const sent=JSON.parse(calls[1].init.body);assert.equal(sent.method,'officeCommand');assert.equal(sent.args[0].expectedStateHash,hash);assert.equal(calls[1].url,runtime.url+'/v1/workbench/call');assert.match(sent.id,/^[a-f0-9-]{36}$/);assert.equal(c.stateHash,'b'.repeat(64));
});
test('creative inventory and job result enforce company identity and omit arbitrary server content',async()=>{
  const c=new AtlasClient(runtime,async(url)=>url.includes('/jobs?')?json({ok:true,job:{id:'j',companyId:'a',employeeId:'e',projectId:'p',operation:'blender.inspect',status:'succeeded',result:{objects:3,rawConsole:'PRIVATE',token:runtime.controlToken},outputs:[{path:'inspection.json',bytes:32,sha256:hash,mediaType:'application/json',hostPath:'/PRIVATE'}]}}):json({ok:true,companyId:'a',configured:true,tools:[{id:'blender',configured:true,available:true,operations:['blender.inspect']}],projects:[{id:'p',companyId:'a',allowedOperations:['blender.inspect']},{id:'foreign',companyId:'b'}],jobs:[],secret:runtime.controlToken}));
  const inventory=await c.creative('snapshot',{companyId:'a'});assert.equal(inventory.projects.length,1);assert.equal(JSON.stringify(inventory).includes(runtime.controlToken),false);
  const result=await c.creative('job',{companyId:'a',jobId:'j'});assert.deepEqual(result.job.result,{objects:3});assert.equal(JSON.stringify(result).includes('PRIVATE'),false);
  await assert.rejects(c.creative('snapshot',{companyId:'b'}),/different company/);
  await assert.rejects(c.creative('job',{companyId:'b',jobId:'j'}),/different scope/);
});
test('creative request guards reject arbitrary parameters and preserve request id after an ambiguous start',async()=>{
  let calls=0;const c=new AtlasClient(runtime,async()=>{calls++;throw new Error(runtime.controlToken);});
  const input={id:'stable-creative',companyId:'a',employeeId:'e',projectId:'p',operation:'blender.inspect',input:{path:'scene.blend'}};
  for(const change of [{input:{path:'../scene.blend'}},{input:{path:'scene.blend',shell:'uname'}},{operation:'__proto__'},{executable:'/bin/sh'}])await assert.rejects(c.creative('run',{...input,...change}));
  assert.equal(calls,0);
  await assert.rejects(c.creative('run',input),error=>/Retain creative request id stable-creative/.test(error.message)&&/No retry was sent/.test(error.message)&&!error.message.includes(runtime.controlToken));
  assert.equal(calls,1);
  await assert.rejects(new AtlasClient(cloud,async()=>assert.fail('Must not queue creative work to cloud')).creative('run',input),/headless runtime/);
});
test('runtime authority denials stay actionable and cannot echo the control credential',async()=>{
  const c=new AtlasClient(runtime,async()=>json({ok:false,code:'CREATIVE_AUTHORITY_DENIED',error:`Current creative.execute authority is missing. ${runtime.controlToken}`},403));
  await assert.rejects(c.creative('run',{id:'run-1',companyId:'a',employeeId:'e',projectId:'p',operation:'blender.inspect',input:{path:'scene.blend'}}),error=>/creative.execute/.test(error.message)&&!error.message.includes(runtime.controlToken)&&!/expired or was revoked/.test(error.message));
});
test('a saved creative receipt with omitted job projection stays successful and is not retried',async()=>{
  let calls=0;const c=new AtlasClient(runtime,async(_url,init)=>{calls++;return json({ok:true,id:JSON.parse(init.body).id,snapshotOmitted:true,replayed:false});});
  const receipt=await c.creative('run',{id:'saved-1',companyId:'a',employeeId:'e',projectId:'p',operation:'blender.inspect',input:{path:'scene.blend'}});
  assert.deepEqual(receipt,{ok:true,id:'saved-1',receiptOnly:true,replayed:false});assert.equal(calls,1);
});
test('creative receipts bind exact request identity and tool set even within the same company',async()=>{
  const run={id:'new-request',companyId:'a',employeeId:'e',projectId:'p',operation:'blender.inspect',input:{path:'scene.blend'}};
  const c=new AtlasClient(runtime,async()=>json({ok:true,accepted:true,job:{...run,id:'older-request',status:'succeeded',outputs:[]}}));
  await assert.rejects(c.creative('run',run),/does not match the requested operation.*Retain creative request id new-request/);
  const input={id:'assign',companyId:'a',employeeId:'e',projectId:'p',toolIds:['blender']};
  for(const toolIds of [[],['blender','unreal'],['blender','blender'],['unreal']])await assert.rejects(new AtlasClient(runtime,async()=>json({ok:true,assignment:{...input,toolIds}})).creative('assign',input),/does not match/);
});
test('runtime development reads model and worker observations without mutation or secret projection',async()=>{
  const calls=[];const client=new AtlasClient(runtime,async(url,init)=>{calls.push({url,init});return url.endsWith('/v1/status')?json({ok:true,execution:'headless',worker:{enabled:false,running:false,concurrency:2,lastError:runtime.controlToken},capabilities:{providerJobs:true}}):json({ok:true,snapshot:{...modelState(),endpoint:'PRIVATE',rawLog:runtime.controlToken}});});
  const result=await client.development('a');assert.equal(result.models.models[0].loaded,false);assert.equal(result.status.worker.enabled,false);assert.equal(calls.length,2);
  assert.ok(calls.every(row=>row.init.method==='GET'&&row.init.headers.Authorization===`Bearer ${runtime.controlToken}`));assert.equal(JSON.stringify(result).includes('PRIVATE'),false);assert.equal(JSON.stringify(result).includes(runtime.controlToken),false);
});
test('desktop development uses only the existing model-pool and worker bridge methods',async()=>{
  const calls=[];const client=new AtlasClient({kind:'desktop',url:'http://127.0.0.1:6001',cookie:`atlas_session=${'b'.repeat(64)}`},async(url,init)=>{const body=JSON.parse(init.body);calls.push(body);assert.equal(url,'http://127.0.0.1:6001/api/call');return json({result:body.method==='officeWorkerStatus'?{enabled:false,running:false}:{ok:true,snapshot:modelState()}});});
  const result=await client.development('a');assert.equal(result.status.execution,'desktop');assert.equal(result.models.companyId,'a');assert.deepEqual(calls.map(row=>row.method).sort(),['modelPoolSnapshot','officeWorkerStatus']);
  await client.models('select',{companyId:'a',employeeId:'developer',model:PRIMARY_MODEL});assert.equal(calls.at(-1).method,'modelPoolSelect');
});
test('website pairing cannot submit model actions and capability discovery stays offline',async()=>{
  let calls=0;const client=new AtlasClient(cloud,async()=>{calls++;return json({});});
  const result=await client.development('a');assert.equal(result.models,null);assert.equal(result.status,null);
  await assert.rejects(client.models('select',{companyId:'a',employeeId:'developer',model:PRIMARY_MODEL}),/desktop or a headless/);assert.equal(calls,0);
});
test('model download uses a scoped exact-tag body and retains its key after one ambiguous failure',async()=>{
  const input={companyId:'a',employeeId:'developer',model:PRIMARY_MODEL,idempotencyKey:'download-one',maxBytes:MODEL_STORAGE_CEILING};let calls=0;
  const client=new AtlasClient(runtime,async(url,init)=>{calls++;assert.equal(url,runtime.url+'/v1/models/pull');assert.deepEqual(JSON.parse(init.body),input);throw new Error('uncertain');});
  await assert.rejects(client.models('pull',input),/No retry was sent.*download key download-one/);assert.equal(calls,1);
  const snapshot=modelState();snapshot.requests=[{id:'model-one',companyId:'a',employeeId:'developer',model:PRIMARY_MODEL,status:'queued',completedBytes:0,totalBytes:0}];
  const accepted=await new AtlasClient(runtime,async()=>json({ok:true,snapshot,requestId:'model-one'})).models('pull',input);assert.equal(accepted.requestId,'model-one');assert.equal(accepted.snapshot.requests[0].status,'queued');
});
test('model selection refuses a mismatched scope or assignment digest in its receipt',async()=>{
  const input={companyId:'a',employeeId:'developer',model:PRIMARY_MODEL};
  await assert.rejects(new AtlasClient(runtime,async()=>json({ok:true,snapshot:modelState('b')})).models('select',input),/different company/);
  const changed=modelState();changed.assignments[0].digest='b'.repeat(64);
  await assert.rejects(new AtlasClient(runtime,async()=>json({ok:true,snapshot:changed})).models('select',input),/installed digest/);
});
test('an unavailable model endpoint does not manufacture availability or discard real worker state',async()=>{
  const client=new AtlasClient(runtime,async(url)=>url.endsWith('/v1/status')?json({ok:true,execution:'headless',worker:{enabled:false,running:false},capabilities:{providerJobs:true}}):json({ok:false,error:'Model unavailable'},503));
  const result=await client.development('a');assert.equal(result.models,null);assert.equal(result.status.worker.running,false);assert.match(result.modelError,/unavailable/);
});
