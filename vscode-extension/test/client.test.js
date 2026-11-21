'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {AtlasClient,origin,pairing}=require('../src/client');
const json=(body,status=200,headers={})=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json',...headers}});
const cloud={kind:'cloud',url:'https://atlas.example',deviceToken:'device-token-test-1234567890',siteAccessToken:'site-test-token-1234567890'};
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
