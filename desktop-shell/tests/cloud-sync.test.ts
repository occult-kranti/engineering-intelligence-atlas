import { afterEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { CloudSyncService, cloudMessageContent, cloudSnapshot, normalizeCloudUrl, parsePairing, syncStateHash, type CloudSyncOptions } from '../src/main/cloudSync';
import type { OfficeSnapshot } from '../src/shared/office';
const dirs: string[]=[];
const services:CloudSyncService[]=[];
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});
const token='atlas-device-test-01234567890123456789';
function fixture(options:Pick<CloudSyncOptions,'getWorkerExecution'|'allowKnownSchemaDefaultsMigration'>={}) {
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'atlas-cloud-'));dirs.push(dir);
  const key=crypto.randomBytes(32);
  const safeStorage={isEncryptionAvailable:()=>true,encryptString:(s:string)=>{const iv=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',key,iv);const bytes=Buffer.concat([cipher.update(s,'utf8'),cipher.final()]);return Buffer.concat([iv,cipher.getAuthTag(),bytes]);},decryptString:(b:Buffer)=>{const dec=crypto.createDecipheriv('aes-256-gcm',key,b.subarray(0,12));dec.setAuthTag(b.subarray(12,28));return Buffer.concat([dec.update(b.subarray(28)),dec.final()]).toString('utf8');}};
  let snapshot=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../company/preview-state.json'),'utf8')).office as OfficeSnapshot & {remoteReceipts:Array<{id:string}>};
  snapshot.decisionPanels??=[];snapshot.remoteReceipts=[];
  const remote:{revision:number;clientId:string|null;snapshot:OfficeSnapshot|null;updatedAt:string}={revision:0,clientId:null,snapshot:null,updatedAt:new Date().toISOString()};
  let commands:Array<{id:string;baseRevision:number;command:{action:string;payload:Record<string,unknown>}}>=[];
  const cloudMessages:Array<{id:string;scope:{kind:string;id:string};role:string;content:string;createdAt:string}>=[];
  let messagePageSize=100;
  let failAck=false; let failPutAck=false; let writes=0;let effects=0;
  const acknowledgements:any[]=[];
  const activities:any[]=[];
  const fetcher=vi.fn(async(url:any,init:any)=>{
    const pathname=new URL(url).pathname;
    if(pathname==='/api/runtime-activity'){activities.push(JSON.parse(init.body));return json({ok:true});}
    if(pathname==='/api/session')return json({signedIn:true,clientId:'desktop-one'});
    if(pathname==='/api/workspace' && init.method==='GET')return json(remote);
    if(pathname==='/api/workspace/claim-writer') {
      const body=JSON.parse(init.body);
      if(remote.revision===0)return json({error:'workspace row absent'},409);
      if(body.expectedRevision!==remote.revision || remote.clientId && remote.clientId!==body.clientId)return json({error:'conflict'},409);
      remote.clientId=body.clientId;return json({ok:true,revision:remote.revision,sourceClientId:remote.clientId});
    }
    if(pathname==='/api/cloud-threads') {
      const cursor=new URL(url).searchParams.get('cursor') ?? '';
      const pending=cloudMessages.filter(m=>`${m.createdAt}|${m.id}`>cursor).sort((a,b)=>`${a.createdAt}|${a.id}`.localeCompare(`${b.createdAt}|${b.id}`));
      const messages=pending.slice(0,messagePageSize);
      const last=messages.at(-1);const next=last?`${last.createdAt}|${last.id}`:cursor;
      return json({messages,cursor:next,nextCursor:pending.length>messages.length?next:null});
    }
    if(pathname==='/api/commands')return json({commands});
    if(pathname.endsWith('/ack')) {
      if(remote.clientId!=='desktop-one')return json({error:'not writer'},403);
      if(failAck){failAck=false;throw new Error('lost acknowledgement');}
      const receipt=JSON.parse(init.body);acknowledgements.push(receipt);
      commands=commands.filter(c=>!pathname.includes('/'+c.id+'/'));
      return json({ok:true});
    }
    if(pathname==='/api/workspace' && init.method==='PUT'){
      writes++;const body=JSON.parse(init.body);
      if(body.expectedRevision!==remote.revision)return json({error:'conflict'},409);
      remote.revision++;remote.clientId=body.clientId;remote.snapshot=body.snapshot;
      if(failPutAck){failPutAck=false;throw new Error('lost saved revision acknowledgement');}
      return json({revision:remote.revision,updatedAt:remote.updatedAt});
    }
    throw new Error('Unexpected route');
  }) as unknown as typeof fetch;
  const command=vi.fn(async(request:any)=>{
    if(request.action!=='apply_remote_command')throw new Error('Missing native idempotency wrapper');
    const replayed=snapshot.remoteReceipts.some(r=>r.id===request.id);
    if(!replayed){
      expect(request.expectedStateHash).toBe(syncStateHash(snapshot));effects++;
      if(request.command.action==='import_cloud_message'){
        const {scope,id,role,content,createdAt}=request.command;
        snapshot.chatThreads??=[];
        let thread=snapshot.chatThreads.find(t=>t.scope.kind===scope.kind&&t.scope.id===scope.id);
        if(!thread){thread={id:crypto.randomUUID(),scope,messages:[]};snapshot.chatThreads.push(thread);}
        thread.messages.push({id,role,content,createdAt,source:'cloud'});
      }else snapshot.employees[0]!.status='paused';
      snapshot.remoteReceipts.push({id:request.id});
    }
    snapshot.lastAction={replayed};
    return {ok:true,snapshot};
  });
  const createService=()=>{const value=new CloudSyncService({userDataPath:dir,safeStorage,fetch:fetcher,snapshot:async()=>({ok:true,snapshot}),command,...options});services.push(value);return value;};
  const service=createService();
  const configure=()=>service.configure({url:'https://atlas.example',token:JSON.stringify({deviceToken:token,clientId:'desktop-one',siteAccessToken:'site-access-test-1234567890'})});
  return {dir,safeStorage,service,configure,createService,fetcher,command,remote,acknowledgements,activities,cloudMessages,pageSize(size:number){messagePageSize=size;},get snapshot(){return snapshot;},get writes(){return writes;},get effects(){return effects;},get commands(){return commands;},enqueue(){commands.push({id:'command-1',baseRevision:remote.revision,command:{action:'pause_employee',payload:{employeeId:snapshot.employees[0]!.id}}});},failAckOnce(){failAck=true;},failPutAckOnce(){failPutAck=true;}};
}
afterEach(()=>{for(const service of services.splice(0))service.close();vi.useRealTimers();for(const dir of dirs.splice(0))fs.rmSync(dir,{recursive:true,force:true});});
describe('separate bounded runtime activity telemetry',()=>{
 it('publishes coalesced safe execution samples without altering snapshot revisions',async()=>{
  vi.useFakeTimers();vi.setSystemTime(new Date('2026-11-22T12:00:00Z'));
  const sample={sampledAt:new Date().toISOString(),activeCalls:Array.from({length:10},(_,i)=>({jobId:`job-${i}`,phase:'provider' as const,startedAt:new Date().toISOString(),prompt:'private text'}))};
  const f=fixture({getWorkerExecution:()=>sample});await f.configure();const before=syncStateHash(f.snapshot),revision=f.remote.revision;
  await Promise.all(Array.from({length:100},()=>f.service.publishExecution()));
  expect(f.activities).toHaveLength(1);expect(f.activities[0].clientId).toBe('desktop-one');expect(f.activities[0].execution.activeCalls).toHaveLength(8);
  expect(JSON.stringify(f.activities)).not.toContain('private text');expect(syncStateHash(f.snapshot)).toBe(before);expect(f.remote.revision).toBe(revision);expect(f.command).not.toHaveBeenCalled();
  await f.service.publishExecution();expect(f.activities).toHaveLength(1);
  await vi.advanceTimersByTimeAsync(15000);expect(f.activities).toHaveLength(2);f.service.close();expect(vi.getTimerCount()).toBe(0);
 });
 it('aborts in-flight telemetry on disconnect without failing native state or retaining a timer',async()=>{
  vi.useFakeTimers();vi.setSystemTime(new Date('2026-11-22T12:00:00Z'));
  const f=fixture({getWorkerExecution:()=>({sampledAt:new Date().toISOString(),activeCalls:[]})});await f.configure();
  const original=vi.mocked(f.fetcher).getMockImplementation()!;let signal:AbortSignal|undefined;
  vi.mocked(f.fetcher).mockImplementation((async(url,init)=>{
   if(String(url).endsWith('/api/runtime-activity')){signal=init?.signal as AbortSignal;return new Promise((_resolve,reject)=>signal?.addEventListener('abort',()=>reject(new Error('aborted')),{once:true}));}
   return original(url,init);
  }) as typeof fetch);
  const pending=f.service.publishExecution();expect(signal?.aborted).toBe(false);expect(f.service.disconnect().ok).toBe(true);await pending;
  expect(signal?.aborted).toBe(true);expect(f.command).not.toHaveBeenCalled();expect(vi.getTimerCount()).toBe(0);
 });
 it('treats a website snapshot lag rejection as telemetry-only, without native mutations or worker failure',async()=>{
  const f=fixture({getWorkerExecution:()=>({sampledAt:new Date().toISOString(),activeCalls:[{jobId:'newly-started',phase:'provider',startedAt:new Date().toISOString()}]})});
  await f.configure();const before=syncStateHash(f.snapshot),status=f.service.status();
  const original=vi.mocked(f.fetcher).getMockImplementation()!;
  vi.mocked(f.fetcher).mockImplementation((async(url,init)=>String(url).endsWith('/api/runtime-activity')
   ?json({error:'The running job is not present in the latest cloud snapshot.'},409):original(url,init)) as typeof fetch);
  await expect(f.service.publishExecution()).resolves.toBeUndefined();
  expect(syncStateHash(f.snapshot)).toBe(before);expect(f.service.status()).toEqual(status);expect(f.command).not.toHaveBeenCalled();
 });
 it('keeps durable schema3 sessions, allowance and held budget in snapshot hashing',()=>{
  const f=fixture();const state=f.snapshot as any;
  state.schemaVersion=3;state.stickyNotes=[{id:'note-a',revision:1,text:'A scoped task'}];state.improvementSessions=[{id:'session-a',revision:1,status:'paused'}];
  state.improvementAllowance={id:'allowance-a',capUsd:20,carriedObservedUsd:4,carriedEstimatedUsd:1,sourceReference:'owner-reviewed-checkpoint'};
  state.improvementBudget={capUsd:20,heldUsd:1,committedUsd:6,remainingUsd:14,effectiveRemainingUsd:3};
  const exported=cloudSnapshot(state) as any;expect(exported.improvementAllowance).toEqual(state.improvementAllowance);expect(exported.improvementBudget).toEqual(state.improvementBudget);
  const before=syncStateHash(state);state.improvementSessions[0].revision++;expect(syncStateHash(state)).not.toBe(before);expect(exported.stickyNotes).toEqual(state.stickyNotes);
 });
 it('preserves native owner receipt identity for exact cloud draft reconciliation',()=>{
  const state:any=structuredClone(fixture().snapshot);
  state.schemaVersion=3;state.improvementReceipts=[{id:'sticky-request-once',action:'upsert_sticky_note',requestSha256:'a'.repeat(64),
   result:{noteId:'sticky-one',revision:1},at:'2026-11-22T12:00:00Z'}];
  expect((cloudSnapshot(state) as any).improvementReceipts).toEqual(state.improvementReceipts);
  const before=syncStateHash(state);state.improvementReceipts[0].result.revision=2;expect(syncStateHash(state)).not.toBe(before);
  expect(JSON.stringify(cloudSnapshot(state))).not.toContain('workerId');
 });
});
describe('explicit desktop cloud pairing and synchronization',()=>{
  it('publishes schema3 from the original paired runtime using its saved matching cloud revision',async()=>{
    const f=fixture();f.snapshot.schemaVersion=2;await f.configure();expect((await f.service.sync()).ok).toBe(true);
    const revision=f.remote.revision,priorBudget=structuredClone(f.snapshot.budget),priorPolicy=structuredClone(f.snapshot.policy);
    f.service.close();
    Object.assign(f.snapshot,{schemaVersion:3,stickyNotes:[],improvementAllowance:null,improvementBudget:null,improvementSessions:[],improvementReceipts:[]});
    const restored=f.createService();expect((await restored.sync()).ok).toBe(true);
    expect(f.remote.revision).toBe(revision+1);expect(f.remote.snapshot?.schemaVersion).toBe(3);
    expect(f.remote.snapshot?.budget).toEqual(priorBudget);expect(f.remote.snapshot?.policy).toEqual(priorPolicy);
    expect(f.command).not.toHaveBeenCalled();
  });
  it('refuses fresh unclaimed schema2 pairing after local schema3 migration even with known-parent migration enabled',async()=>{
    const f=fixture({allowKnownSchemaDefaultsMigration:true});f.snapshot.schemaVersion=2;
    f.remote.revision=4;f.remote.snapshot=cloudSnapshot(f.snapshot);
    Object.assign(f.snapshot,{schemaVersion:3,stickyNotes:[],improvementAllowance:null,improvementBudget:null,improvementSessions:[],improvementReceipts:[]});
    const cloudBefore=JSON.stringify(f.remote.snapshot);await f.configure();
    const result=await f.service.sync();expect(result.ok).toBe(false);expect(result.error).toContain('Restore your latest private workspace bundle');
    expect(JSON.stringify(f.remote.snapshot)).toBe(cloudBefore);expect(f.remote.revision).toBe(4);expect(f.remote.clientId).toBeNull();
    expect(f.writes).toBe(0);expect(f.command).not.toHaveBeenCalled();expect(f.acknowledgements).toEqual([]);
  });
  it('refuses insecure endpoints and secret-bearing URLs',()=>{
    for(const value of ['http://example.com','https://x:y@example.com','https://example.com/path','https://example.com/?token=secret','https://example.com/#secret','file:///tmp/app'])expect(()=>normalizeCloudUrl(value)).toThrow();
    expect(normalizeCloudUrl('https://atlas.example/')).toBe('https://atlas.example');
    expect(normalizeCloudUrl('http://127.0.0.1:6000')).toBe('http://127.0.0.1:6000');
  });
  it('connects without uploading workspace and encrypts the origin-bound credential',async()=>{
    const f=fixture();expect((await f.configure()).ok).toBe(true);
    expect(f.fetcher).toHaveBeenCalledTimes(1);expect(f.writes).toBe(0);
    expect(fs.readFileSync(path.join(f.dir,'cloud/device.bin')).includes(Buffer.from(token))).toBe(false);
    expect(fs.readFileSync(path.join(f.dir,'cloud/connection.json'),'utf8')).not.toContain(token);
    expect(JSON.stringify(f.service.status())).not.toContain(token);
    expect(f.service.status().lastSyncedAt).toBeNull();
  });
  it('requires secure OS storage and refuses basic_text',async()=>{
    const f=fixture();f.safeStorage.isEncryptionAvailable=()=>false;
    expect((await f.configure()).ok).toBe(false);expect(f.fetcher).not.toHaveBeenCalled();
    expect(f.service.status().encryptionAvailable).toBe(false);
  });
  it('rejects a pairing token bound to another origin before any network request',async()=>{
    const f=fixture();const result=await f.service.configure({url:'https://other.example',token:JSON.stringify({deviceToken:token,baseUrl:'https://atlas.example'})});
    expect(result.ok).toBe(false);expect(f.fetcher).not.toHaveBeenCalled();
  });
  it('binds the writer to the authenticated session identity and rejects a forged pairing identity',async()=>{
    const f=fixture();const rejected=await f.service.configure({url:'https://atlas.example',token:JSON.stringify({deviceToken:token,clientId:'forged-device'})});
    expect(rejected.ok).toBe(false);expect(rejected.error).toMatch(/does not match/);expect(fs.existsSync(path.join(f.dir,'cloud/device.bin'))).toBe(false);
    expect((await f.service.configure({url:'https://atlas.example',token})).ok).toBe(true);
    expect((await f.service.sync()).ok).toBe(true);expect(f.remote.clientId).toBe('desktop-one');
  });
  it('does not acknowledge an ambiguous native process outcome as a confirmed failure',async()=>{
    const f=fixture();await f.configure();await f.service.sync();f.enqueue();
    f.command.mockResolvedValueOnce({ok:false,snapshot:null,error:'Process ended',code:'CORE_FAILED'} as any);
    expect((await f.service.sync()).ok).toBe(false);expect(f.acknowledgements).toEqual([]);expect(f.service.status().pendingCommands).toBe(1);
  });
  it('uploads only on sync and records the acknowledged revision',async()=>{
    const f=fixture();await f.configure();expect((await f.service.sync()).ok).toBe(true);
    expect(f.writes).toBe(1);expect(f.remote.clientId).toBe('desktop-one');expect(f.service.status().revision).toBe(1);
    expect(f.service.status().lastSyncedAt).toBe(f.remote.updatedAt);
    expect(f.remote.snapshot?.chatThreads).toEqual(f.snapshot.chatThreads);
    expect(f.remote.snapshot).not.toHaveProperty('externalAttempts');
    expect((f.fetcher as any).mock.calls.some((call:any)=>new URL(call[0]).pathname==='/api/workspace/claim-writer')).toBe(false);
  });
  it('refuses a signed-in session without an authenticated device identity',async()=>{
    const f=fixture();(f.fetcher as any).mockResolvedValueOnce(json({signedIn:true}));
    const result=await f.configure();expect(result.ok).toBe(false);expect(result.error).toMatch(/device identity/);
    expect(fs.existsSync(path.join(f.dir,'cloud/device.bin'))).toBe(false);
  });
  it('processes native-validated queued commands and acknowledges effects',async()=>{
    const f=fixture();await f.configure();await f.service.sync();f.enqueue();
    expect((await f.service.sync()).ok).toBe(true);expect(f.effects).toBe(1);
    expect(f.acknowledgements).toEqual([{ok:true}]);expect(f.service.status().pendingCommands).toBe(0);
  });
  it('does not execute commands based on state changed locally since last sync',async()=>{
    const f=fixture();await f.configure();await f.service.sync();f.enqueue();f.snapshot.companies[0]!.name='Changed locally';
    expect((await f.service.sync()).ok).toBe(true);expect(f.effects).toBe(0);expect(f.command).not.toHaveBeenCalled();
    expect(f.acknowledgements[0]).toMatchObject({ok:false,code:'CONFLICT'});
    expect(f.remote.snapshot?.companies[0]!.name).toBe('Changed locally');
  });
  it('native receipts prevent duplicate effects after lost acknowledgement and restart at the same revision',async()=>{
    const f=fixture();await f.configure();await f.service.sync();f.enqueue();f.failAckOnce();
    expect((await f.service.sync()).ok).toBe(false);expect(f.effects).toBe(1);
    expect(f.service.status().revision).toBe(f.remote.revision);
    expect((await f.createService().sync()).ok).toBe(true);expect(f.effects).toBe(1);expect(f.command).toHaveBeenCalledTimes(2);
    expect(f.acknowledgements).toEqual([{ok:true}]);expect(f.commands).toHaveLength(0);
  });
  it.each([9,2])('preserves an older restored device when the same writer has a different remote revision %s',async(revision)=>{
    const f=fixture();await f.configure();for(let i=0;i<4;i++)expect((await f.service.sync()).ok).toBe(true);
    const metadata=fs.readFileSync(path.join(f.dir,'cloud/connection.json'),'utf8');
    const localHash=syncStateHash(f.snapshot);
    f.remote.revision=revision;f.remote.snapshot!.companies[0]!.name='Different saved cloud work';f.enqueue();
    const remoteBefore=structuredClone(f.remote);const restored=f.createService();(f.fetcher as any).mockClear();
    const result=await restored.sync();
    expect(result.ok).toBe(false);expect(result.error).toMatch(/saved revision/);expect(result.status.revision).toBe(4);
    expect(f.remote).toEqual(remoteBefore);expect(syncStateHash(f.snapshot)).toBe(localHash);
    expect(f.writes).toBe(4);expect(f.command).not.toHaveBeenCalled();expect(f.acknowledgements).toEqual([]);expect(f.commands).toHaveLength(1);
    expect((f.fetcher as any).mock.calls.map((call:any)=>new URL(call[0]).pathname)).toEqual(['/api/workspace']);
    expect(fs.readFileSync(path.join(f.dir,'cloud/connection.json'),'utf8')).toBe(metadata);
  });
  it('recovers a lost PUT acknowledgement only when the same writer has the exact current local projection',async()=>{
    const f=fixture();await f.configure();expect((await f.service.sync()).ok).toBe(true);f.enqueue();f.failPutAckOnce();
    expect((await f.service.sync()).ok).toBe(false);expect(f.remote.revision).toBe(2);expect(f.service.status().revision).toBe(1);
    expect(syncStateHash(f.remote.snapshot!)).toBe(syncStateHash(f.snapshot));expect(f.effects).toBe(1);
    const restored=f.createService();expect((await restored.sync()).ok).toBe(true);
    expect(restored.status().revision).toBe(3);expect(f.remote.revision).toBe(3);
    expect(f.effects).toBe(1);expect(f.command).toHaveBeenCalledTimes(1);expect(f.acknowledgements).toEqual([{ok:true}]);
  });
  it('preserves another desktop writer instead of overwriting its snapshot',async()=>{
    const f=fixture();await f.configure();await f.service.sync();f.remote.clientId='another-desktop';f.remote.revision++;
    const result=await f.service.sync();expect(result.ok).toBe(false);expect(result.error).toMatch(/another device/);expect(f.writes).toBe(1);
  });
  it('requires restoring the personal bundle before replacing a populated unowned seed',async()=>{
    const f=fixture();f.remote.revision=1;f.remote.snapshot=cloudSnapshot(f.snapshot);f.remote.snapshot.companies[0]!.name='Private portfolio';
    await f.configure();const result=await f.service.sync();expect(result.ok).toBe(false);expect(result.error).toMatch(/Restore your latest private workspace/);expect(f.writes).toBe(0);
  });
  it('a fresh desktop pairing cannot overwrite a populated same-writer workspace or acknowledge its queue',async()=>{
    const f=fixture();f.remote.revision=9;f.remote.clientId='desktop-one';f.remote.snapshot=cloudSnapshot(f.snapshot);
    f.remote.snapshot.companies[0]!.name='Existing personal portfolio';f.enqueue();const remoteBefore=structuredClone(f.remote);
    await f.configure();const result=await f.service.sync();
    expect(result.ok).toBe(false);expect(result.error).toMatch(/before the first sync/);expect(result.status.revision).toBeNull();
    expect(f.remote).toEqual(remoteBefore);expect(f.writes).toBe(0);expect(f.command).not.toHaveBeenCalled();expect(f.acknowledgements).toEqual([]);expect(f.commands).toHaveLength(1);
  });
  it('a desktop first-command acknowledgement failure stops for review when no verified bootstrap proof exists',async()=>{
    const f=fixture();f.remote.revision=4;f.remote.snapshot=cloudSnapshot(f.snapshot);f.enqueue();await f.configure();f.failAckOnce();
    expect((await f.service.sync()).ok).toBe(false);expect(f.effects).toBe(1);expect(f.service.status().revision).toBeNull();
    const result=await f.createService().sync();expect(result.ok).toBe(false);expect(result.error).toMatch(/interrupted first sync/);
    expect(f.writes).toBe(0);expect(f.effects).toBe(1);expect(f.acknowledgements).toEqual([]);expect(f.commands).toHaveLength(1);
  });
  it('binds a seeded cloud workspace only when restored local state matches',async()=>{
    const f=fixture();f.remote.revision=1;f.remote.snapshot=cloudSnapshot(f.snapshot);await f.configure();
    expect((await f.service.sync()).ok).toBe(true);expect(f.remote.clientId).toBe('desktop-one');
  });
  it('claims an unowned seed before applying its preexisting queued commands',async()=>{
    const f=fixture();f.remote.revision=3;f.remote.snapshot=cloudSnapshot(f.snapshot);f.enqueue();await f.configure();
    expect((await f.service.sync()).ok).toBe(true);expect(f.effects).toBe(1);expect(f.acknowledgements).toEqual([{ok:true}]);
    const routes=(f.fetcher as any).mock.calls.map((call:any)=>new URL(call[0]).pathname);
    expect(routes.indexOf('/api/workspace/claim-writer')).toBeLessThan(routes.indexOf('/api/commands'));
  });
  it('collapses concurrent sync button presses into a single operation',async()=>{
    const f=fixture();await f.configure();const a=f.service.sync(),b=f.service.sync();expect(a).toBe(b);await a;expect(f.writes).toBe(1);
  });
  it('disconnect removes the device credential and returns no key material',async()=>{
    const f=fixture();await f.configure();const result=f.service.disconnect();expect(result.ok).toBe(true);expect(result.status.configured).toBe(false);expect(fs.existsSync(path.join(f.dir,'cloud/device.bin'))).toBe(false);
  });
  it('imports saved cloud messages with provenance, preserving final cursors across restart',async()=>{
    const f=fixture();f.pageSize(1);
    const messages=[
      {id:'00000000-0000-4000-8000-000000000001',scope:{kind:'company',id:f.snapshot.activeCompanyId},role:'user',content:'Saved website brief',createdAt:'2026-11-21T00:00:00.000Z'},
      {id:'00000000-0000-4000-8000-000000000002',scope:{kind:'company',id:f.snapshot.activeCompanyId},role:'assistant',content:'Saved website reply\r\n'+'漢'.repeat(45000)+'🎼'.repeat(5000),createdAt:'2026-11-21T00:00:01.000Z'},
    ];
    f.cloudMessages.push(...messages);await f.configure();
    const first=await f.service.sync();expect(first.ok).toBe(true);expect(first.status.chatImported).toBe(1);expect(first.status.chatHasMore).toBe(true);
    const restored=f.createService();const second=await restored.sync();expect(second.ok).toBe(true);expect(second.status.chatImported).toBe(1);expect(second.status.chatHasMore).toBe(false);
    const thread=f.snapshot.chatThreads.find(t=>t.scope.kind==='company'&&t.scope.id===f.snapshot.activeCompanyId)!;
    expect(thread.messages).toEqual(messages.map(m=>({id:`cloud-${m.id}`,role:m.role,content:m.content,createdAt:m.createdAt,source:'cloud'})));
    const lastCursor=`${messages[1]!.createdAt}|${messages[1]!.id}`;
    expect(JSON.parse(fs.readFileSync(path.join(f.dir,'cloud/connection.json'),'utf8')).chatCursor).toBe(lastCursor);
    expect((await f.createService().sync()).status.chatImported).toBe(0);expect(f.effects).toBe(2);
    expect(f.remote.snapshot?.chatThreads).toEqual(f.snapshot.chatThreads);
  });
  it('replays durable imports when a later message invalidates a page without advancing its cursor',async()=>{
    const f=fixture();const good={id:'00000000-0000-4000-8000-000000000003',scope:{kind:'company',id:f.snapshot.activeCompanyId},role:'assistant',content:'Keep this saved reply',createdAt:'2026-11-21T00:00:00.000Z'};
    const invalid={...good,id:'00000000-0000-4000-8000-000000000004',role:'tool'};f.cloudMessages.push(good,invalid);await f.configure();
    expect((await f.service.sync()).ok).toBe(false);expect(f.effects).toBe(1);
    expect(JSON.parse(fs.readFileSync(path.join(f.dir,'cloud/connection.json'),'utf8')).chatCursor??'').toBe('');
    invalid.role='assistant';expect((await f.createService().sync()).ok).toBe(true);expect(f.effects).toBe(2);
    expect(f.snapshot.chatThreads.flatMap(t=>t.messages).filter(m=>m.id===`cloud-${good.id}`)).toHaveLength(1);
  });
  it('reports unsupported group conversations without deleting them or blocking later supported scopes',async()=>{
    const f=fixture();f.cloudMessages.push({id:'00000000-0000-4000-8000-000000000005',scope:{kind:'group',id:'portfolio-group'},role:'user',content:'Keep this on the website',createdAt:'2026-11-21T00:00:00.000Z'});await f.configure();
    const result=await f.service.sync();expect(result.ok).toBe(true);expect(result.status.chatSkipped).toBe(1);expect(result.notice).toMatch(/unsupported-scope/);expect(f.command).not.toHaveBeenCalled();expect(f.cloudMessages).toHaveLength(1);
  });
});
describe('sync projection and canonical state hash',()=>{
  it('syncs full conversations while excluding worker leases, local paths and unknown future fields',()=>{
    const f=fixture();const snapshot=structuredClone(f.snapshot) as any;
    snapshot.jobs.push({leaseToken:'secret-lease',workerId:'local-worker',artifactUri:'/private/file',pendingReservation:{costUsd:5}});
    snapshot.chatThreads=[{messages:[{role:'assistant',content:'raw provider transcript'}]}];snapshot.futureCredentials={key:'never sync'};
    const projected=cloudSnapshot(snapshot);const serialized=JSON.stringify(projected);
    for(const value of ['secret-lease','local-worker','/private/file','futureCredentials'])expect(serialized).not.toContain(value);
    expect(projected.chatThreads).toEqual(snapshot.chatThreads);
    expect((projected.jobs.at(-1) as any).leaseToken).toBeNull();
  });
  it('rejects likely credentials in otherwise allowed user text',()=>{
    const f=fixture();f.snapshot.companies[0]!.name='ghp_'+'a'.repeat(30);expect(()=>cloudSnapshot(f.snapshot)).toThrow(/API credential/);
  });
  it('omits only structured local evidence paths and stays stable when restore changes their basenames',()=>{
    const snapshot=structuredClone(fixture().snapshot) as any;
    const local=['/old/private/office-artifacts/job-hash.md','file:///old/private/report.md','C:\\Users\\Private\\report.md','\\\\server\\private\\report.md',' \tFILE:///old/report.md'];
    const sources=['https://example.org/evidence?file=/tmp/report.md','company/references.md','Observed fixture result'];
    snapshot.decisionPanels=[{decisions:[{summary:'/old/private/summary.md',evidence:[...local,...sources]}]}];
    snapshot.jobs=[{review:{evidenceRefs:[...local,...sources],primaryArtifactComplete:true,summary:'Reference provenance'}}];
    snapshot.chatThreads=[{messages:[{content:'/old/private/office-artifacts/job-hash.md'}]}];
    const before=structuredClone(snapshot);const projected=cloudSnapshot(snapshot);
    expect((projected.decisionPanels[0] as any).decisions[0].evidence).toEqual([...local.map(()=>'[local artifact omitted from cloud]'),...sources]);
    expect((projected.jobs[0] as any).review.evidenceRefs).toEqual([...local.map(()=>'[local artifact omitted from cloud]'),...sources]);
    expect((projected.decisionPanels[0] as any).decisions[0].summary).toBe('/old/private/summary.md');
    expect(projected.chatThreads).toEqual(snapshot.chatThreads);expect(snapshot).toEqual(before);
    const relocated=structuredClone(snapshot);
    relocated.decisionPanels[0].decisions[0].evidence=[...local.map((_,i)=>`/restored/office-artifacts/content-hash-${i}.md`),...sources];
    relocated.jobs[0].review.evidenceRefs=[...local.map((_,i)=>`/relocated/reviews/receipt-${i}.md`),...sources];
    expect(syncStateHash(relocated)).toBe(syncStateHash(snapshot));
    relocated.decisionPanels[0].decisions[0].evidence[local.length]='https://example.org/different-evidence';
    expect(syncStateHash(relocated)).not.toBe(syncStateHash(snapshot));
  });
  it('uploads a local brief only on explicit sync and preserves all text',async()=>{
    const f=fixture();const text='Local desktop brief\r\n'+'漢'.repeat(6000);
    f.snapshot.chatThreads=[{id:'local-thread',scope:{kind:'company',id:f.snapshot.activeCompanyId},messages:[{id:'local-message',role:'user',source:'user',content:text,createdAt:'2026-11-21T00:00:00.000Z'}]}];
    await f.configure();expect(f.writes).toBe(0);expect((await f.service.sync()).ok).toBe(true);
    expect(f.remote.snapshot?.chatThreads?.[0]?.messages[0]?.content).toBe(text);
  });
  it('fails a full conversation snapshot at capacity rather than truncating history',()=>{
    const f=fixture();f.snapshot.chatThreads=[{id:'large',scope:{kind:'employee',id:'donna'},messages:[{id:'large-message',role:'assistant',source:'cloud',content:'x'.repeat(8*1024*1024),createdAt:'2026-11-21T00:00:00.000Z'}]}];
    expect(()=>cloudSnapshot(f.snapshot)).toThrow(/no messages were truncated/);expect(f.snapshot.chatThreads[0]!.messages[0]!.content.length).toBe(8*1024*1024);
  });
  it('hash ignores key insertion order, receipts and bridge result metadata',()=>{
    const f=fixture();const a=syncStateHash(f.snapshot);const swapped=Object.fromEntries(Object.entries(f.snapshot).reverse()) as any;
    swapped.lastAction={ignored:'result'};swapped.remoteReceipts=[{id:'ignored'}];expect(syncStateHash(swapped)).toBe(a);
    swapped.companies[0].name='Actual changed content';expect(syncStateHash(swapped)).not.toBe(a);
  });
  it('validates device tokens without storing unexpected fields',()=>{
    expect(parsePairing(JSON.stringify({deviceToken:token,extra:'ignore'}))).toEqual({deviceToken:token});
    expect(()=>parsePairing(JSON.stringify({deviceToken:'invalid'}))).toThrow();
  });
  it('preserves long non-ASCII cloud text exactly and refuses oversize input without truncation',()=>{
    const content='🎼'.repeat(30000);expect(cloudMessageContent(content)).toBe(content);
    expect(cloudMessageContent('\0'.repeat(60000))).toBe('\0'.repeat(60000));
    expect(()=>cloudMessageContent(content+'x')).toThrow(/full text remains/);
    expect(cloudMessageContent('Full short reply\r\n')).toBe('Full short reply\r\n');
  });
});
