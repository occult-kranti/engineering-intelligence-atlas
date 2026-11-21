/* Same desktop renderer; owner-private cloud transport. No provider keys in this file. */
(()=>{
 if(window.desktopBridge)return;
 let selected=new URLSearchParams(location.search).get('company')||sessionStorage.getItem('atlas-cloud-company')||null;
 let last=null,workspace=null;
 async function api(path,options={}){const response=await fetch(path,{credentials:'same-origin',...options,headers:{'content-type':'application/json',...options.headers}});const value=await response.json();if(!response.ok)throw new Error(value.error||'Cloud workspace request failed.');return value;}
 async function office(){const [w,chat]=await Promise.all([api('/api/workspace'),api('/api/cloud-threads')]);workspace=w;if(!w.snapshot)throw new Error('No saved workspace yet. Connect your desktop from the welcome page.');const snapshot=structuredClone(w.snapshot);if(selected&&snapshot.companies.some(c=>c.id===selected))snapshot.activeCompanyId=selected;snapshot.chatThreads=snapshot.chatThreads||[];for(const thread of chat.threads){const existing=snapshot.chatThreads.find(t=>t.scope.kind===thread.scope.kind&&t.scope.id===thread.scope.id);if(existing){const ids=new Set(existing.messages.map(m=>m.id));existing.messages.push(...thread.messages.filter(m=>!ids.has(m.id)));existing.messages.sort((a,b)=>a.createdAt.localeCompare(b.createdAt));}else snapshot.chatThreads.push(thread);}last=snapshot;return{ok:true,snapshot};}
 const unavailable=async()=>({ok:false,error:'This operation runs in the connected desktop application. Open the desktop app to continue.'});
 const bridge={version:3,transport:'cloud-browser'};
 bridge.officeSnapshot=office;
 bridge.officeCommand=async(command)=>{if(command.action==='select_company'){selected=command.companyId;sessionStorage.setItem('atlas-cloud-company',selected);return office();}if(!workspace)await office();const{action,...payload}=command;const result=await api('/api/commands',{method:'POST',body:JSON.stringify({command:{action,payload},expectedRevision:workspace.revision,idempotencyKey:crypto.randomUUID()})});return{ok:true,snapshot:last,queued:true,commandId:result.commandId};};
 bridge.sendCloudChat=async(request)=>{try{const result=await api('/api/chat',{method:'POST',body:JSON.stringify(request)});return{...result,...await office()};}catch(error){return{ok:false,error:error.message,snapshot:last};}};
 bridge.companySnapshot=async()=>{const{snapshot}=await office();const c=snapshot.companies.find(c=>c.id===snapshot.activeCompanyId);return{available:false,backend:'unavailable',error:'Repository execution and local project files are available in the desktop app.',company:c?{...c,githubStatus:'unchecked',githubError:null,headSha:null,lastCheckedAt:null}:null,employees:[],tasks:[],milestones:[],activity:[],index:null,usage:{inputTokens:0,outputTokens:0,costUsd:0,runCount:0,completedRuns:0,failedRuns:0,source:'local-project-runs'}};};
 bridge.officeWorkerStatus=async()=>({enabled:false,running:false,activeJobId:null,lastError:null});
 bridge.getVaultStatus=async()=>{const s=await api('/api/session');return{encryptionAvailable:true,providers:{anthropic:{configured:s.capabilities.chat,readable:false,updatedAt:null},openai:{configured:false,readable:false,updatedAt:null},github:{configured:false,readable:false,updatedAt:null}}};};
 bridge.cloudStatus=async()=>{const w=await api('/api/workspace'),q=await api('/api/commands');return{configured:true,connected:true,url:location.origin,revision:w.revision,lastSyncedAt:w.updatedAt,pendingCommands:q.commands.length,error:null,capability:'snapshot-and-commands',encryptionAvailable:true};};
 bridge.syncCloud=async()=>({ok:true,status:await bridge.cloudStatus()});
 bridge.configureCloud=bridge.disconnectCloud=async()=>({ok:false,status:await bridge.cloudStatus(),error:'Manage device pairings and sign-in on the cloud welcome page.'});
 bridge.copyEditorPairing=async()=>{location.href='/#devices';return{ok:false,error:'Create a VS Code device pairing on the welcome page.'};};
 bridge.openPersonalDashboard=async()=>{location.href='/';return{ok:true,url:location.origin};};
 bridge.getSettings=async()=>({runtimeUrl:null,lastRuntimeUrl:null});
 bridge.getSystemInfo=async()=>{throw new Error('Hardware information is available in the desktop application.');};
 bridge.getModelCatalog=async()=>({models:[],rejected:[],catalogPath:'Cloud chat uses the configured server provider.'});
 bridge.listProviderModels=async()=>({ok:true,models:[{id:'claude-sonnet-5-5',name:'Claude Sonnet 5.5'}]});
 bridge.detectOllama=async()=>({available:false,models:[],error:'Local models run in the desktop application.'});
 for(const method of ['listProjects','listRuns','getJobStatus'])bridge[method]=async()=>[];
 for(const method of ['setOfficeWorker','runOfficeQueue','registerCompany','refreshCompany','updateCompanyTask','indexCompanyRepository','setApiKey','revokeApiKey','importCredentialFile','createProject','getProject','startRun','pauseRun','resumeRun','cancelRun','readArtifact','createVenv','downloadModel','cancelJob','connectRuntime','checkModelRequirements'])bridge[method]=unavailable;
 bridge.openExternal=async(url)=>{const parsed=new URL(url);if(!['https:','http:'].includes(parsed.protocol))return{ok:false};window.open(parsed.href,'_blank','noopener,noreferrer');return{ok:true};};
 bridge.openOfflineAtlas=async()=>bridge.openExternal('https://occult-kranti.github.io/engineering-intelligence-atlas/');
 bridge.backToLauncher=async()=>{location.href='/';return{ok:true};};
 for(const method of ['onModeChanged','onJobEvent','onProjectEvent'])bridge[method]=()=>()=>undefined;
 window.desktopBridge=bridge;
})();
