#!/usr/bin/env node
/** Minimal local MCP client for reproducible employee operations. */
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';
const server=spawn(process.execPath,[fileURLToPath(new URL('./atlas-mcp.mjs',import.meta.url))],{stdio:['pipe','pipe','inherit'],env:process.env});
const pending=new Map();let nextId=1;
createInterface({input:server.stdout}).on('line',line=>{const msg=JSON.parse(line);const waiter=pending.get(msg.id);if(waiter){pending.delete(msg.id);clearTimeout(waiter.timer);msg.error?waiter.reject(new Error(JSON.stringify(msg.error))):waiter.resolve(msg.result);}});
const request=(method,params)=>new Promise((resolve,reject)=>{const id=nextId++;const timer=setTimeout(()=>{pending.delete(id);reject(new Error('MCP request timed out'));},120000);pending.set(id,{resolve,reject,timer});server.stdin.write(JSON.stringify({jsonrpc:'2.0',id,method,params})+'\n');});
try {
  await request('initialize',{protocolVersion:'2025-11-25',capabilities:{},clientInfo:{name:'atlas-director-client',version:'0.4.0'}});
  server.stdin.write(JSON.stringify({jsonrpc:'2.0',method:'notifications/initialized'})+'\n');
  const tool=process.argv[2]||'company_snapshot';
  const args=process.argv[3]?JSON.parse(process.argv[3]):{};
  const result=await request('tools/call',{name:tool,arguments:args});
  if(result.isError)throw new Error(result.content?.[0]?.text||'MCP tool failed');
  const data=result.structuredContent||JSON.parse(result.content[0].text);
  if(process.argv[4]) {const out=path.resolve(process.argv[4]);fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(data,null,2)+'\n');}
  const snap=data.snapshot;
  console.log(JSON.stringify({tool,ok:true,registered:data.registered,imported:data.imported,company:data.company||snap?.company,companies:snap?.companies?.length,employees:snap?.employees?.length,tasks:snap?.tasks?.length,lastAction:snap?.lastAction,output:process.argv[4]||null}));
} catch(error) {console.error(String(error));process.exitCode=1;}
finally {server.stdin.end();server.kill();for(const item of pending.values())clearTimeout(item.timer);}
