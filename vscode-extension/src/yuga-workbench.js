'use strict';
const {execFile}=require('node:child_process');
const {createHash}=require('node:crypto');
const {PRIMARY_MODEL,CONTEXT_LIMIT,TASK_TOKEN_BUDGET}=require('./development');
const resources=require('./yuga-resources.json');
const REPO='occult-kranti/andolan';
const GPU=/^GPU-[a-fA-F0-9]{8}(?:-[a-fA-F0-9]{4}){3}-[a-fA-F0-9]{12}$/;
const HASH=/^[a-f0-9]{64}$/;
// Reviewed static evidence only: opening the report never contacts GitHub or a renderer.
const SOURCE_BASELINE=Object.freeze({
  branch:'game/yuga-hanuman-trial',
  commit:'a35493d67cf5111d7da2ff9eea6c58ed3499aeca',
  monsoonArtifactCommit:'146474831e2354122dd121f43ffda53e19efa9b1',
  districtStatus:'authored_map_study_not_server_playable',
  audioStatus:'solo_rehearsal_not_ten_seat_acceptance'
});
const PRESETS=Object.freeze({
  'cpu-ci':{label:'CPU / CI only',notes:'Use local authority and geometry checks. Do not provision a GPU.'},
  'one-48-sequential':{label:'Single graphics GPU · 48 GiB target',notes:'Run MoE, Blender, then Unreal separately. Wait for actual model unload and measured free VRAM before switching.'},
  'two-split-hosts':{label:'Two GPU hosts · 24 + 48 GiB targets',notes:'Isolate coding and graphics. 24 GiB coding is a conditional low-concurrency trial, not a fit guarantee. Reconnect and probe each host separately.'},
  'two-same-host':{label:'Two GPUs on one host · 24 + 48 GiB targets',notes:'Reserve separate GPUs; do not pool their VRAM. Verify tool-specific device selection by UUID before allowing concurrent work.'}
});
function repoIdentity(value){
  if(typeof value!=='string'||value.length>500)return null;
  const m=/^git@github\.com:([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)\/?$/i.exec(value);
  if(m)return m[1].replace(/\.git$/i,'').toLowerCase();
  try {const u=new URL(value);if(u.protocol!=='https:'||u.hostname!=='github.com'||u.username||u.password||u.port||u.search||u.hash||!/^\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/?$/.test(u.pathname))return null;
    return u.pathname.slice(1).replace(/\/$/,'').replace(/\.git$/i,'').toLowerCase();}catch{return null;}
}
function parseGpuCsv(raw){
  if(typeof raw!=='string'||Buffer.byteLength(raw)>16000)throw new Error('GPU observation exceeds the allowed report size.');
  const rows=raw.trim()?raw.trim().split(/\r?\n/):[];
  if(rows.length>32)throw new Error('GPU observation has too many devices.');
  const seen=new Set();
  return rows.map(line=>{
    const [uuid,name,totalRaw,freeRaw,driver,extra]=line.split(',').map(v=>v.trim());
    const totalMiB=Number(totalRaw),freeMiB=Number(freeRaw);
    if(extra!==undefined||!GPU.test(uuid||'')||seen.has(uuid?.toLowerCase())||!name||!/[A-Za-z]/.test(name)||!/^[A-Za-z0-9 .()+_-]{1,100}$/.test(name)||!/^\d{1,7}$/.test(totalRaw||'')||!/^\d{1,7}$/.test(freeRaw||'')||totalMiB<1||freeMiB>totalMiB||!/^\d+(?:\.\d+){1,3}$/.test(driver||''))throw new Error('GPU observation is malformed; no device assignment was inferred.');
    seen.add(uuid.toLowerCase());
    return {uuid,name,totalMiB,freeMiB,driver};
  }).sort((a,b)=>b.totalMiB-a.totalMiB||b.freeMiB-a.freeMiB||a.uuid.localeCompare(b.uuid));
}
function observeLocalGpu({run=execFile,platform=process.platform}={}){
  const paths=platform==='linux'?['/usr/bin/nvidia-smi','/usr/local/bin/nvidia-smi']:platform==='win32'?['C:\\Windows\\System32\\nvidia-smi.exe','C:\\Program Files\\NVIDIA Corporation\\NVSMI\\nvidia-smi.exe']:[];
  return new Promise(resolve=>{
    let next=0;
    const attempt=()=>{
      if(next>=paths.length)return resolve({status:'unavailable',devices:[]});
      run(paths[next++],['--query-gpu=uuid,name,memory.total,memory.free,driver_version','--format=csv,noheader,nounits'],{timeout:4000,maxBuffer:16000,windowsHide:true,encoding:'utf8'},(error,out)=>{
        if(error?.code==='ENOENT')return attempt();
        if(error)return resolve({status:'unavailable',devices:[]});
        try {const devices=parseGpuCsv(out);resolve({status:devices.length?'observed':'unavailable',devices});}
        catch {resolve({status:'invalid',devices:[]});}
      });
    };attempt();
  });
}
function planYuga({company,preset,observation,models,inventory,hostKind,splitLane}){
  if(company?.status!=='active'||repoIdentity(company?.repoUrl)!==REPO||typeof company.id!=='string'||!/^[A-Za-z0-9_.-]{1,100}$/.test(company.id))throw new Error('Select the active ANDOLAN / YUGA company bound to the exact repository.');
  if(!Object.hasOwn(PRESETS,preset))throw new Error('Select a reviewed GPU preset.');
  const devices=Array.isArray(observation?.devices)?observation.devices:[];
  const freshRows=observation?.status==='observed'&&devices.length
    ?parseGpuCsv(devices.map(d=>[d.uuid,d.name,d.totalMiB,d.freeMiB,d.driver].join(',')).join('\n')):[];
  const profile=PRESETS[preset];
  const resolve=(need,except=null)=>freshRows.find(d=>d.uuid!==except&&d.totalMiB>=need*1024-256&&d.freeMiB>=need*1024-512);
  const graphics=preset==='one-48-sequential'||preset==='two-same-host'||preset==='two-split-hosts'&&splitLane==='graphics'?resolve(48):null;
  const coder=preset==='two-same-host'?resolve(24,graphics?.uuid):preset==='one-48-sequential'?graphics:preset==='two-split-hosts'&&splitLane==='coding'?resolve(24):null;
  const selectedModel=models?.available===true&&models?.enabled===true&&models?.companyId===company.id&&models?.catalog?.some?.(row=>row.id===PRIMARY_MODEL&&row.contextLimitTokens===CONTEXT_LIMIT)
    ?models.models?.find?.(row=>row.name===PRIMARY_MODEL&&HASH.test(row.digest||'')):null;
  const tool=(id)=>Array.isArray(inventory?.tools)&&inventory.companyId===company.id&&inventory.tools.some(row=>row.id===id);
  const work={
    authority:{target:'CPU / current repository CI',handoff:'Use Yuga’s checked-in Rust/WASM and Godot tests at the exact checkout.'},
    coding:{target:preset==='cpu-ci'?'not planned':preset==='two-split-hosts'&&splitLane!=='coding'?'coding host; verify separately':coder?.uuid??'no eligible observation',
      handoff:'atlas.creativeDevelopment',model:PRIMARY_MODEL,installedDigest:selectedModel?.digest??null,contextTokens:CONTEXT_LIMIT,totalTaskTokens:TASK_TOKEN_BUDGET,concurrencyTarget:1},
    blender:{target:preset==='cpu-ci'?'CPU geometry check only':preset==='two-split-hosts'&&splitLane!=='graphics'?'graphics host; verify separately':graphics?.uuid??'no eligible observation',
      handoff:'atlas.creativeTools',inventoryListed:!!tool('blender'),gpuRenderVerified:false},
    unreal:{target:preset==='cpu-ci'?'not planned':preset==='two-split-hosts'&&splitLane!=='graphics'?'graphics host; verify separately':graphics?.uuid??'no eligible observation',
      handoff:'atlas.creativeTools',inventoryListed:!!tool('unreal'),capability:'descriptor / DataValidation with NullRHI only',gpuRenderVerified:false}
  };
  const body={schemaVersion:1,sourceBaseline:SOURCE_BASELINE,companyId:company.id,repository:REPO,preset,status:'plan_only_not_authorization',hostKind:hostKind==='remote-extension-host'?'remote-extension-host':'local-extension-host',
    splitLane:preset==='two-split-hosts'&&['coding','graphics'].includes(splitLane)?splitLane:null,observationStatus:freshRows.length?'observed':observation?.status==='invalid'?'invalid':'unavailable',observedDevices:freshRows,
    observationBoundary:'The observed extension host is not cryptographically linked to a connected Daftar runtime/Vast instance. NVML observation alone does not prove device selection, graphics support, throughput or model fit.',
    recommendedScheduling:profile.notes,work,
    nextGates:['Confirm owner-approved host identity, SSH host fingerprint and storage/transfer cap.','Confirm runtime and reported GPU belong to the intended host; run a measured bounded single task.','Review native grants, runtime model digest and target-device receipt. Non-recommended models remain evaluation only.','Never launch multiple jobs until tool-specific binding and overlapping memory were tested. No fallback/sharding implied.'],
    resources:resources.map(row=>row.id),
    effects:{rents:0,providerRequests:0,downloads:0,jobsStarted:0,grantsChanged:0}};
  return {...body,planDigest:createHash('sha256').update(JSON.stringify(body)).digest('hex')};
}
function report(plan){
  return '# Yuga compute handoff\n\nPrepared only. The SHA-256 digest binds this plan; it is not an execution authorization or a signature.\n\n'+'\x60\x60\x60json\n'+JSON.stringify(plan,null,2)+'\n\x60\x60\x60\n\n## Yuga production handoff\n\n- Monsoon Exchange: verify the authored Blender/GLB on CPU first. Stage spawn, collision and objective authority in a separate task.\n- Ember Rite: solo audio is not ten-client acceptance. Use the Mandala integration control, then check Monsoon side-swapped starts, interrupt, reconnect, and recipient-scoped cues.\n- Route Lab remains a separate fixture. This plan does not start a playtest, import, or render.\n\n## Reviewed resources\n\n'+resources.map(row=>'- ['+row.id+']('+row.url+') · '+row.state+': '+row.use).join('\n')+'\n';
}
async function chooseWorkbench({ui,context,assertCurrent=()=>{},observe=observeLocalGpu,showReport}){
  const options=Object.entries(PRESETS).map(([id,x])=>({id,label:x.label}));
  const selection=await ui.showQuickPick(options,{title:'Yuga compute plan · no jobs or rentals',ignoreFocusOut:true});assertCurrent();if(!selection)return;
  let splitLane;
  if(selection.id==='two-split-hosts'){
    const lane=await ui.showQuickPick([{id:'coding',label:'This is the coding host'},{id:'graphics',label:'This is the graphics host'},{id:'unknown',label:'Do not identify this host'}],{title:'Classify this split-host observation',ignoreFocusOut:true});assertCurrent();if(!lane)return;
    splitLane=lane.id;
  }
  const probe=await ui.showQuickPick([{id:'skip',label:'Create plan without GPU observations'},{id:'probe',label:'Read GPU inventory on this VS Code extension host',description:'Fixed nvidia-smi query; no SSH command or process launch on another host'}],{title:'Collect read-only GPU evidence',ignoreFocusOut:true});assertCurrent();if(!probe)return;
  const observation=probe.id==='probe'?await observe():{status:'unavailable',devices:[]};assertCurrent();
  const plan=planYuga({...context,preset:selection.id,observation,splitLane});await showReport(report(plan));assertCurrent();return plan;
}
module.exports={PRESETS,REPO,repoIdentity,parseGpuCsv,observeLocalGpu,planYuga,report,chooseWorkbench};
