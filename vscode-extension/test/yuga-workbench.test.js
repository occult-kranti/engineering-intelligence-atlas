'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {execFile}=require('node:child_process');
const {createHash}=require('node:crypto');
const {PRESETS,repoIdentity,parseGpuCsv,observeLocalGpu,planYuga,chooseWorkbench,report}=require('../src/yuga-workbench');
const {PRIMARY_MODEL}=require('../src/development');
const resources=require('../src/yuga-resources.json');
const company={id:'yuga',repoUrl:'https://github.com/occult-kranti/ANDOLAN',status:'active'};
const a='GPU-00000000-0000-aaaa-0000-000000000001',b='GPU-00000000-0000-aaaa-0000-000000000002';
const table=`${a}, RTX 6000 Ada, 49140, 49000, 570.24
${b}, GeForce RTX 4090, 24564, 24200, 570.24`;
const base={company,preset:'two-same-host',observation:{status:'observed',devices:parseGpuCsv(table)},hostKind:'remote-extension-host'};
test('catalog has unique read-only HTTPS refs and exactly one guarded model',()=>{
  assert.equal(new Set(resources.map(x=>x.id)).size,resources.length);
  assert.equal(resources.filter(x=>x.state==='guarded-existing-model').length,1);
  assert.ok(resources.every(x=>new URL(x.url).protocol==='https:'));
});
test('GPU preflight parser rejects injection, duplicate and malformed NVML rows',()=>{
  assert.equal(parseGpuCsv(table).length,2);
  for(const input of [table+'\n'+table,table.replace('570.24','<img src=x>'),table.replace('49140','-1'),table.replace('49000','4900000'),table.replace(a,'MIG-'+a),table.replace('RTX 6000 Ada','../../ /tmp/me.js'),table.replace('49140','4e4'),'a'.repeat(16001)]) {
    assert.throws(()=>parseGpuCsv(input));
  }
  assert.equal(parseGpuCsv('').length,0);
});
test('fixed executable probe bounds stdout and never receives user args',async()=>{
  const calls=[];
  const out=await observeLocalGpu({platform:'linux',run:(path,args,opts,reply)=>{calls.push({path,args,opts});reply(null,table);}});
  assert.equal(out.status,'observed');assert.equal(out.devices.length,2);
  assert.deepEqual(calls[0].args,['--query-gpu=uuid,name,memory.total,memory.free,driver_version','--format=csv,noheader,nounits']);
  assert.ok(calls[0].path.startsWith('/usr/'));assert.equal(calls[0].opts.timeout,4000);
  assert.equal((await observeLocalGpu({platform:'linux',run:(p,a,o,reply)=>reply(null,'garbage')})).status,'invalid');
  assert.equal((await observeLocalGpu({platform:'none',run:execFile})).status,'unavailable');
});
test('single GPU is sequential, same host needs distinct devices, split host never assumes this host',()=>{
  const plan=planYuga(base);
  assert.equal(plan.work.coding.target,b);assert.equal(plan.work.unreal.target,a);assert.equal(plan.work.blender.target,a);
  assert.equal(plan.work.blender.gpuRenderVerified,false);assert.equal(plan.hostKind,'remote-extension-host');
  assert.equal(planYuga({...base,preset:'one-48-sequential'}).work.coding.target,a);
  assert.equal(planYuga({...base,preset:'two-split-hosts'}).work.coding.target,'coding host; verify separately');
  const split=planYuga({...base,preset:'two-split-hosts',splitLane:'graphics'});
  assert.equal(split.work.coding.target,'coding host; verify separately');assert.equal(split.work.blender.target,a);
  const only48={status:'observed',devices:[base.observation.devices[0]]};
  assert.equal(planYuga({...base,observation:only48}).work.coding.target,'no eligible observation');
  assert.equal(planYuga({...base,preset:'cpu-ci'}).work.coding.target,'not planned');
  assert.deepEqual(Object.values(plan.effects),[0,0,0,0,0]);
  const {planDigest,...body}=plan;assert.equal(planDigest,createHash('sha256').update(JSON.stringify(body)).digest('hex'));
  assert.match(report(plan),/not an execution authorization/);
});
test('fresh memory threshold, case-insensitive duplicates and no cross-company inventory over 100 iterations',()=>{
  for(let i=0;i<100;i++){
    const lower=table.replace('49000',String(10000+i));
    const observations={status:'observed',devices:parseGpuCsv(lower)};
    const plan=planYuga({...base,preset:'one-48-sequential',observation:observations,models:{companyId:'elsewhere'},inventory:{companyId:'elsewhere',tools:[{id:'blender'}]}});
    assert.equal(plan.work.coding.target,'no eligible observation');
    assert.equal(plan.work.blender.inventoryListed,false);
    assert.equal(plan.work.coding.installedDigest,null);
  }
  assert.throws(()=>parseGpuCsv(table+'\n'+table.split('\n')[0].replace('aaaa','AAAA')));
});
test('inventory status does not equal runtime device proof or authority; malformed/paused identity blocked',()=>{
  const digest='d'.repeat(64);
  const models={available:true,enabled:true,companyId:'yuga',catalog:[{id:PRIMARY_MODEL,contextLimitTokens:8192}],models:[{name:PRIMARY_MODEL,digest}]};
  const inventory={companyId:'yuga',tools:[{id:'blender',renderDeviceVerified:true},{id:'unreal'}]};
  const plan=planYuga({...base,models,inventory});assert.equal(plan.work.coding.installedDigest,digest);
  assert.equal(plan.work.blender.inventoryListed,true);assert.equal(plan.work.blender.gpuRenderVerified,false);
  assert.match(plan.work.unreal.capability,/NullRHI/);
  for(const url of ['https://github.com.invalid/occult-kranti/ANDOLAN','https://github.com/occult-kranti/ANDOLAN?x=1','http://github.com/occult-kranti/ANDOLAN','https://user:token@github.com/occult-kranti/ANDOLAN','https://github.com/occult-kranti/ANDOLAN/tree','git@github.com:other/ANDOLAN'])assert.throws(()=>planYuga({...base,company:{...company,repoUrl:url}}));
  assert.equal(repoIdentity('git@github.com:Occult-Kranti/ANDOLAN.git'),'occult-kranti/andolan');
  assert.throws(()=>planYuga({...base,company:{...company,status:'paused'}}));
});
test('workbench probes only explicitly, honors cancellation/stale view before showing report',async()=>{
  let probe=0,shown=0;
  const context={company,hostKind:'remote-extension-host'};
  const make=ids=>({async showQuickPick(items){const id=ids.shift();return items.find(x=>x.id===id);}});
  const observe=async()=>{probe++;return base.observation;};
  const showReport=()=>{shown++;};
  assert.equal(await chooseWorkbench({ui:make([]),context,observe,showReport}),undefined);
  assert.equal((await chooseWorkbench({ui:make(['two-same-host','skip']),context,observe,showReport})).observationStatus,'unavailable');
  assert.equal(probe,0);assert.equal(shown,1);
  let version=0;
  await assert.rejects(chooseWorkbench({ui:make(['two-same-host','probe']),context,observe:async()=>{version++;return await observe();},assertCurrent:()=>{if(version)throw Error('stale');},showReport}),/stale/);
  assert.equal(probe,1);assert.equal(shown,1);
  assert.deepEqual(Object.keys(PRESETS).sort(),['cpu-ci','one-48-sequential','two-same-host','two-split-hosts']);
});
