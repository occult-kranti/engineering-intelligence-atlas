'use strict';
const vscode = require('vscode');
const crypto = require('node:crypto');
const { AtlasClient, origin, studioUrl } = require('./client');
const { OPERATIONS, scopeRecords, managementCommand, ownershipSummary } = require('./management');
const SECRET_KEY = 'atlas.office.connection.v1';
const GUIDE = 'https://github.com/occult-kranti/engineering-intelligence-atlas/blob/main/project/EDITOR_AND_CLOUD.md';

function activate(context) {
  let view;
  let connection = null;
  let selectedCompany = context.globalState.get('atlas.company', '');
  let current = null;
  let refreshing = null;
  let refreshAgain = false;
  let epoch = 0;
  let activeAction = false;
  let restoreStoredConnection = true;
  const status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 20);
  status.command = 'atlas.openOffice'; status.text = '$(organization) Daftar'; status.tooltip = 'Open Daftar Office'; status.show();
  context.subscriptions.push(status);
  const post = message => { if (view) void view.webview.postMessage(message); };
  const client = () => { if (!connection) throw new Error('Connect to the installed desktop or signed-in website first.'); return new AtlasClient(connection); };
  const requireTrust = () => { if (!vscode.workspace.isTrusted) throw new Error('Trust this VS Code workspace before controlling Daftar.'); };

  async function refresh() {
    if (refreshing) { refreshAgain = true; return refreshing; }
    const version = epoch;
    const requestedCompany = selectedCompany;
    refreshing = (async () => {
      try {
        if (!connection && restoreStoredConnection) {
          restoreStoredConnection = false;
          const stored = await context.secrets.get(SECRET_KEY);
          if (version !== epoch) return;
          if (stored && stored.length <= 18000) connection = JSON.parse(stored);
        }
        if (!connection) { post({type:'state',connected:false,connection:null}); return; }
        requireTrust();
        const result = await client().snapshot();
        if (version !== epoch || requestedCompany !== selectedCompany) { refreshAgain = true; return; }
        current = result.snapshot;
        if (!current?.companies || !Array.isArray(current.companies)) throw new Error('This workspace has not received a desktop snapshot yet. Sync the desktop first.');
        if (!current.companies.some(c=>c.id===selectedCompany)) selectedCompany=current.activeCompanyId || current.companies[0]?.id || '';
        post({type:'state',connected:true,connection:{kind:connection.kind,url:connection.url},snapshot:current,selectedCompany,revision:result.revision,updatedAt:result.updatedAt,ownership:ownershipSummary(current,selectedCompany)});
        if(connection.kind==='cloud') {
          const historyCompany=selectedCompany;
          try { const history=await client().chatHistory(historyCompany); if(version===epoch && historyCompany===selectedCompany)post({type:'chatHistory',companyId:historyCompany,messages:history.messages || []}); }
          catch { if(version===epoch)post({type:'notice',message:'Workspace loaded. Chat history is temporarily unavailable.'}); }
        }
        status.text='$(organization) Daftar'; status.tooltip=`Daftar ${connection.kind}: ${connection.url}`;
      } catch (error) { if(version===epoch){post({type:'error',message:safeMessage(error)}); status.text='$(warning) Daftar offline';} }
    })().finally(()=>{refreshing=null;if(refreshAgain){refreshAgain=false;void refresh();}});
    return refreshing;
  }
  async function saveConnection(next) {
    await context.secrets.store(SECRET_KEY, JSON.stringify(next));
    epoch++; restoreStoredConnection=false;connection=next; current=null; await refresh();
  }
  async function connectDesktop() {
    requireTrust();
    const link=await vscode.window.showInputBox({title:'Connect Daftar desktop',prompt:'In Daftar desktop Settings, click Pair VS Code. Paste the fresh five-minute link here.',password:true,ignoreFocusOut:true});
    if(!link)return;
    await saveConnection(await AtlasClient.connectDesktop(link));
    void vscode.window.showInformationMessage('Daftar desktop paired. Session expires in 12 hours or when the desktop closes.');
  }
  async function connectCloud() {
    requireTrust();
    const configured=vscode.workspace.getConfiguration('atlas').get('websiteUrl','');
    const raw=await vscode.window.showInputBox({title:'Daftar private website',prompt:'HTTPS origin of your signed-in Daftar website',value:configured,ignoreFocusOut:true});
    if(!raw)return;
    const url=origin(raw);
    const token=await vscode.window.showInputBox({title:'Pair Daftar website',prompt:'Sign in on the website, create an editor device and paste its pairing JSON. Provider API keys stay on the server.',password:true,ignoreFocusOut:true});
    if(!token)return;
    await saveConnection(await AtlasClient.connectCloud(url,token));
    await vscode.workspace.getConfiguration('atlas').update('websiteUrl',url,vscode.ConfigurationTarget.Global);
    void vscode.window.showInformationMessage('Daftar website paired. Office commands wait for explicit desktop sync.');
  }
  async function disconnect() {
    epoch++; restoreStoredConnection=false;connection=null;current=null;await context.secrets.delete(SECRET_KEY);
    status.text='$(organization) Daftar'; post({type:'state',connected:false,connection:null});
  }
  async function command(data) {
    requireTrust();
    const c=client(), companyId=selectedCompany, version=epoch;
    const snapshot=(await c.snapshot()).snapshot;
    if(version!==epoch || companyId!==selectedCompany)throw new Error('The selected workspace changed. Review the action in its company again.');
    if(!snapshot?.companies?.some(company=>company.id===companyId))throw new Error('Choose an existing company.');
    let action;
    if(data.type==='employee') {
      if(!['pause','resume'].includes(data.operation))throw new Error('Choose a supported employee action.');
      action=managementCommand(snapshot,companyId,{action:data.operation==='pause'?'pause_employee':'resume_employee',employeeId:data.id});
    } else if(data.type==='job') {
      const job=snapshot.jobs.find(j=>j.id===data.id && j.companyId===companyId);
      if(!job || !['pause','resume'].includes(data.operation))throw new Error('Job action is outside this company.');
      action={action:data.operation==='pause'?'pause_job':'resume_job',jobId:job.id};
    } else if(data.type==='panel') {
      if(typeof data.task!=='string'||!data.task.trim()||Buffer.byteLength(data.task)>12000)throw new Error('Write a panel question under 12 KB.');
      if(!['software','design','research','data'].includes(data.focus))throw new Error('Choose a supported panel focus.');
      action={action:'convene_panel',companyId,scope:{kind:'company',id:companyId},title:data.task.slice(0,160),task:data.task,focus:data.focus,maxRounds:1,maxUsd:2,maxTokens:60000,maxMinutes:10};
    } else if(data.type==='manageTeam') {
      const input=await askManagement(snapshot,companyId);
      if(!input)return;
      action=managementCommand(snapshot,companyId,input);
    } else throw new Error('Unsupported editor action.');
    if(version!==epoch || companyId!==selectedCompany)throw new Error('The selected workspace changed. Review the action in its company again.');
    const result=await c.command(action);
    if(version!==epoch || companyId!==selectedCompany)return;
    post({type:'notice',message:result.queued?'Waiting for desktop: command saved. Use Sync now in the installed app.':'Saved in the desktop workspace.'});
    await refresh();
  }
  async function onMessage(message) {
    try {
      if(!message||typeof message!=='object')return;
      if(message.type==='ready'||message.type==='refresh')return refresh();
      if(message.type==='connectDesktop')return await connectDesktop();
      if(message.type==='connectCloud')return await connectCloud();
      if(message.type==='disconnect')return await disconnect();
      if(message.type==='openWebsite')return await openWebsite();
      if(message.type==='openStudio') {
        requireTrust();
        if(connection?.kind!=='cloud')throw new Error('Connect this editor to your private website to open its studio views.');
        if(!current?.companies.some(c=>c.id===selectedCompany))throw new Error('Choose an existing company.');
        return await vscode.env.openExternal(vscode.Uri.parse(studioUrl(connection.url,selectedCompany,message.view)));
      }
      if(message.type==='company') {
        if(typeof message.id!=='string'||!current?.companies.some(c=>c.id===message.id))throw new Error('Unknown company.');
        epoch++;selectedCompany=message.id;await context.globalState.update('atlas.company',selectedCompany);return refresh();
      }
      if(message.type==='reviewOwnership')return await reviewOwnership();
      if(['chat','employee','job','panel','manageTeam'].includes(message.type)) {
        if(activeAction)throw new Error('Wait for the current action to finish before sending another.');
        if(message.companyId!==undefined && message.companyId!==selectedCompany)throw new Error('The selected company changed. Review the action in its company again.');
        activeAction=true;post({type:'busy',value:true});
        try {
          if(message.type!=='chat')return await command(message);
          requireTrust();
          const companyId=selectedCompany,version=epoch;
          if(!current?.companies.some(c=>c.id===companyId))throw new Error('Choose a company first.');
          const result=await client().chat(companyId,message.content,crypto.randomUUID());
          if(version!==epoch || companyId!==selectedCompany)return;
          post({type:'chatSent',companyId,content:message.content,reply:result.reply ?? result.message?.content ?? null,usage:result.usage,budget:result.budget,saved:result.saved});
          if(result.saved)post({type:'notice',message:'Brief saved locally. Open Donna in the desktop to create and authorize a bounded provider goal.'});
          return await refresh();
        } finally { activeAction=false;post({type:'busy',value:false}); }
      }
    } catch(error) { post({type:'error',message:safeMessage(error)});post({type:'busy',value:activeAction}); }
  }
  async function reviewOwnership() {
    requireTrust();
    const companyId=selectedCompany,version=epoch;
    const snapshot=(await client().snapshot()).snapshot;
    if(version!==epoch || companyId!==selectedCompany)return;
    const rows=ownershipSummary(snapshot,companyId);
    const lines=['Donna and assistant ownership', '', 'Owner commands are validated by the native backend. Displayed grant counts are current direct grant records, not a determination of effective delegated authority.', ''];
    for(const row of rows)lines.push(`${row.kind}: ${row.name}`, `Assistant: ${row.assistantName} (${row.assistantId || 'unassigned'}) · ${row.status}`, `Ownership record: ${row.validOwner?'consistent':'needs repair'} · ${row.grantCount} current direct grant(s) at ${row.grantScope.kind} ${row.grantScope.id}`, '');
    const document=await vscode.workspace.openTextDocument({content:lines.join('\n'),language:'plaintext'});
    await vscode.window.showTextDocument(document,{preview:true});
  }
  async function openWebsite() {
    if(connection?.kind==='cloud')await vscode.env.openExternal(vscode.Uri.parse(origin(connection.url)));
    else await vscode.env.openExternal(vscode.Uri.parse('https://occult-kranti.github.io/engineering-intelligence-atlas/'));
  }
  const provider = { resolveWebviewView(resolved) {
    view=resolved; view.webview.options={enableScripts:true,localResourceRoots:[vscode.Uri.joinPath(context.extensionUri,'media')]};
    view.webview.html=html(view.webview,context.extensionUri);
    context.subscriptions.push(view.webview.onDidReceiveMessage(onMessage),view.onDidChangeVisibility(()=>{if(view.visible)void refresh();}));
    void refresh();
  }};
  context.subscriptions.push(vscode.window.registerWebviewViewProvider('atlas.office',provider));
  for(const [id,fn] of Object.entries({
    'atlas.openOffice':()=>vscode.commands.executeCommand('atlas.office.focus'),
    'atlas.connectDesktop':connectDesktop,'atlas.connectCloud':connectCloud,'atlas.disconnect':disconnect,
    'atlas.refresh':refresh,'atlas.manageTeam':()=>onMessage({type:'manageTeam'}),'atlas.reviewOwnership':reviewOwnership,'atlas.openWebsite':openWebsite,'atlas.openMcpGuide':()=>vscode.env.openExternal(vscode.Uri.parse(GUID))
  }))context.subscriptions.push(vscode.commands.registerCommand(id,async()=>{try{await fn();}catch(error){void vscode.window.showErrorMessage(safeMessage(error));}}));
  const timer=setInterval(()=>{if(view?.visible&&connection)void refresh();},30000);
  context.subscriptions.push({dispose(){clearInterval(timer);connection=null;}});
}
async function askManagement(snapshot, companyId) {
  const records=scopeRecords(snapshot,companyId);
  const choose=async(rows,title)=>vscode.window.showQuickPick(rows.map(row=>({label:row.name,description:row.role||row.status,record:row})),{title,ignoreFocusOut:true});
  const prompt=async(title,value='',maximum=150)=>vscode.window.showInputBox({title,value,ignoreFocusOut:true,validateInput:value=>!value.trim()||Buffer.byteLength(value.trim())>maximum?'Enter nonempty text within '+maximum+' bytes.':undefined});
  const operation=await vscode.window.showQuickPick(OPERATIONS.map(([action,label])=>({action,label})),{title:`Manage ${records.company.name}`,ignoreFocusOut:true});
  if(!operation)return;
  const action=operation.action;
  if(action==='create_office'){const name=await prompt('Office name');return name===undefined?undefined:{action,name};}
  if(['rename_office','create_department','hire_employee'].includes(action)) {
    const office=(await choose(records.offices,'Choose an office'))?.record;if(!office)return;
    if(action!=='hire_employee'){const name=await prompt(action==='rename_office'?'Office name':'Department name',action==='rename_office'?office.name:'');return name===undefined?undefined:{action,officeId:office.id,name};}
    const target=await choose([{id:null,name:'Office staff'},...records.departments.filter(row=>row.officeId===office.id)],'Choose an employee department');if(!target)return;
    const name=await prompt('Permanent employee name');if(name===undefined)return;
    const role=await prompt('Role definition (responsibility, not access permissions)','',200);if(role===undefined)return;
    return {action,companyId,officeId:office.id,departmentId:target.record.id,name,role,skillPaths:[]};
  }
  if(['update_employee','fire_employee'].includes(action)) {
    const people=records.employees.filter(row=>row.status!=='fired'&&(action!=='fire_employee'||row.kind==='specialist'&&row.id!=='donna'));
    const person=(await choose(people,'Choose an employee'))?.record;if(!person)return;
    if(action==='fire_employee') {
      const confirmed=await vscode.window.showWarningMessage(`Retire ${person.name}? Work is cancelled and history is retained. A retired definition cannot be resumed.`,{modal:true},'Retire specialist');
      return confirmed==='Retire specialist'?{action,employeeId:person.id}:undefined;
    }
    const field=await vscode.window.showQuickPick([{label:'Name',key:'name'},{label:'Role definition',key:'role'},{label:'Repository skill paths',key:'skillPaths'}],{title:`Edit ${person.name}`,ignoreFocusOut:true});if(!field)return;
    if(field.key==='skillPaths') {
      const raw=await vscode.window.showInputBox({title:'Skill paths, separated by commas; blank removes skill bindings',value:(person.skillPaths||[]).join(', '),ignoreFocusOut:true});
      return raw===undefined?undefined:{action,employeeId:person.id,skillPaths:raw.trim()?raw.split(',').map(value=>value.trim()):[]};
    }
    const value=await prompt(field.label,person[field.key],field.key==='role'?200:150);return value===undefined?undefined:{action,employeeId:person.id,[field.key]:value};
  }
  const department=(await choose(records.departments,'Choose a department'))?.record;if(!department)return;
  if(action==='rename_department'){const name=await prompt('Department name',department.name);return name===undefined?undefined:{action,departmentId:department.id,name};}
  if(action==='set_department_parent') {
    const parent=await choose([{id:null,name:'Top level in this office'},...records.departments.filter(row=>row.officeId===department.officeId&&row.id!==department.id)],'Choose parent department');
    return parent?{action,departmentId:department.id,parentDepartmentId:parent.record.id}:undefined;
  }
  return {action,departmentId:department.id};
}
function safeMessage(error) {
  const raw=error instanceof Error?error.message:'Daftar operation failed. Local saved work is preserved.';
  return raw.replace(/(?:sk-ant-|sk-proj-|sk-|github_pat_|gh[pousr]_)[A-Za-z0-9_-]+/g,'[credential removed]').replace(/Bearer\s+[A-Za-z0-9._~-]+/gi,'Bearer [credential removed]').replace(/atlas_session=[a-f0-9]+/gi,'atlas_session=[credential removed]').slice(0,500);
}
function html(webview,root) {
  const nonce=crypto.randomBytes(20).toString('hex');
  const css=webview.asWebviewUri(vscode.Uri.joinPath(root,'media','office.css'));
  const js=webview.asWebviewUri(vscode.Uri.joinPath(root,'media','office.js'));
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}'; img-src ${webview.cspSource}; connect-src 'none'; form-action 'none'; base-uri 'none';"><link rel="stylesheet" href="${css}"><title>Daftar Office</title></head><body>
  <header><div class="brand">DAFTAR <span>Command Studio</span></div><button id="refresh" title="Refresh workspace">Refresh</button></header>
  <p id="connection" class="muted">Pair your workspace to begin.</p>
  <section id="connect"><h1>Your office, beside your code.</h1><p>One Donna conversation, permanent teams, and a roadmap tied to their work.</p><button id="connect-desktop" class="primary">Connect desktop</button><button id="connect-cloud">Connect signed-in website</button><p class="muted">Desktop execution stays in Daftar. API keys stay in its vault or on the website server.</p></section>
  <div id="notice" role="status" aria-live="polite"></div>
  <main id="workspace" hidden><label for="company">Company</label><select id="company"></select>
  <div id="budget" class="budget"></div>
  <div id="studio-links" class="studio-links" hidden><p class="muted">Open this company in the connected studio</p><div><button data-studio="blueprint">Blueprint</button><button data-studio="softboard">Ownership</button><button data-studio="timeline">Roadmap</button><button data-studio="whiteboard">Whiteboard</button></div></div>
  <nav aria-label="Workspace views"><button data-tab="chat" aria-pressed="true">Donna</button><button data-tab="team" aria-pressed="false">Team</button><button data-tab="roadmap" aria-pressed="false">Roadmap</button></nav>
  <section id="tab-chat"><h2>Donna's desk</h2><p id="chat-mode" class="muted"></p><div id="messages" aria-live="polite"></div><form id="chat-form"><label for="brief">What should we work on?</label><textarea id="brief" rows="4" maxlength="12000" placeholder="Describe a decision, goal, or improvement…" required></textarea><button type="submit" class="primary" id="send">Send brief</button></form><details><summary>Convene a decision panel</summary><p>Donna reuses experts or fills missing roles. This creates a draft; execution is reviewed in Daftar.</p><label for="panel-focus">Expertise</label><select id="panel-focus"><option value="software">Software and architecture</option><option value="design">Design and experience</option><option value="research">Research · Newton · Tesla · skeptic</option><option value="data">Data and caching</option></select><button id="panel">Use current brief for a panel</button><p class="muted">One round · $2 panel ceiling · 60,000 token allowance per request. The allowance includes context and is not a consumption target.</p></details><div id="panels"></div></section>
  <section id="tab-team" hidden><h2>People and ownership</h2><p class="muted">Employee definitions persist between tasks. Job states below show actual execution. Role text and skill bindings do not grant access.</p><div class="team-actions"><button id="manage-team" class="primary">Manage team</button><button id="review-ownership">Review Donna ownership</button></div><div id="ownership"></div><div id="team"></div><h2>Work queue</h2><div id="jobs"></div></section>
  <section id="tab-roadmap" hidden><h2>Roadmap and ownership</h2><div id="roadmap"></div><h2>Goals</h2><div id="goals"></div></section>
  <footer><button id="open-website">Open website</button><button id="disconnect">Disconnect editor</button></footer></main>
  <script nonce="${nonce}" src="${js}"></script></body></html>`;
}
module.exports={activate,safeMessage};
