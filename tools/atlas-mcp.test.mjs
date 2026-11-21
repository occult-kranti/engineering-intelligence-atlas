import test from 'node:test';
import assert from 'node:assert/strict';
import { createToolHandler, createMessageProcessor, parseRepository, TOOL_DEFINITIONS, InvalidParams } from './atlas-mcp.mjs';

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
