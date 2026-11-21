'use strict';
const vscode=acquireVsCodeApi();
const $=id=>document.getElementById(id);
let current=null,companyId='',kind=null,busy=false;
const node=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=String(text);if(cls)n.className=cls;return n;};
const money=value=>typeof value==='number'?new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:3}).format(value):'—';
function send(message){vscode.postMessage(message);}
function notice(text,error=false){$('notice').textContent=text;$('notice').classList.toggle('error',error);}
function setBusy(value){busy=value;for(const b of document.querySelectorAll('form button,#panel'))b.disabled=value;$('send').textContent=value?'Working…':kind==='cloud'?'Ask Donna via API':'Save desktop brief';}
function actionButton(label,type,id,operation){const b=node('button',label,'minor');b.onclick=()=>{send({type,id,operation});};return b;}
function row(title,meta){const card=node('article',undefined,'card');card.append(node('h3',title),node('p',meta,'muted'));return card;}
function fill(id,items,empty){$(id).replaceChildren(...(items.length?items:[node('p',empty,'muted')]));}
function render(){
  if(!current)return;
  const company=current.companies.find(c=>c.id===companyId);
  $('studio-links').hidden=kind!=='cloud';
  $('company').replaceChildren(...current.companies.map(c=>{const o=node('option',c.name);o.value=c.id;o.selected=c.id===companyId;return o;}));
  const budget=current.budget;
  $('budget').textContent=budget?`${money(budget.committedUsd)} committed · ${money(budget.remainingUsd)} remaining${budget.warning?' · Budget warning':''}`:'Budget appears after desktop sync.';
  $('chat-mode').textContent=kind==='cloud'?'Server-backed Claude chat uses the shared cloud allocation. Office controls wait for desktop sync.':'Briefs save to your desktop. Create and authorize provider goals in the desktop Donna view.';
  const threads=(current.chatThreads||[]).filter(t=>t.scope.kind==='company'&&t.scope.id===companyId);
  if(kind==='desktop')renderMessages(threads.flatMap(t=>t.messages).slice(-30));
  const staff=current.employees.filter(e=>e.companyId===companyId);
  const offices=current.offices.filter(o=>o.companyId===companyId);
  const teams=[];
  for(const office of offices){const room=node('section',undefined,'room');room.append(node('h3',office.name));
    const departments=current.departments.filter(d=>d.officeId===office.id);
    for(const dept of [...departments,{id:null,name:'Office staff'}]){
      const people=staff.filter(e=>e.officeId===office.id&&(e.departmentId||null)===dept.id);if(!people.length)continue;
      const section=node('section',undefined,'department');section.append(node('h4',dept.name));
      for(const e of people){const r=row(e.name,`${e.role} · ${e.status}`);if(e.status==='active'||e.status==='paused')r.append(actionButton(e.status==='active'?'Pause':'Resume','employee',e.id,e.status==='active'?'pause':'resume'));section.append(r);}room.append(section);
    }teams.push(room);
  }fill('team',teams,'No office is registered for this company.');
  const jobs=current.jobs.filter(j=>j.companyId===companyId).slice(-20).reverse();
  fill('jobs',jobs.map(j=>{const r=row(j.goal,`${j.status} · ${money(j.usage?.costUsd)} ${j.costStatus||''}`);if(['queued','running','waiting-budget'].includes(j.status))r.append(actionButton('Pause','job',j.id,'pause'));else if(j.status==='paused')r.append(actionButton('Resume','job',j.id,'resume'));return r;}),'No queued work.');
  const roadmap=(current.portfolio?.roadmap||[]).filter(r=>r.scope.kind==='global'||r.scope.kind==='company'&&r.scope.id===companyId||r.scope.kind==='group'&&current.portfolio.groups.some(g=>g.id===r.scope.id&&g.companyIds.includes(companyId)));
  fill('roadmap',roadmap.map(r=>{const owner=current.employees.find(e=>e.id===r.ownerEmployeeId);const c=row(r.title,`${r.status} · ${owner?.name||'Owner unassigned'}`);if(r.description)c.append(node('p',r.description));if(r.evidence)c.append(node('p',r.evidence,'evidence'));return c;}),'No roadmap items for this scope.');
  fill('goals',(current.goals||[]).filter(g=>g.companyId===companyId).map(g=>row(g.title,`${g.status} · ${g.steps?.length||0} steps · round ${g.iteration||0}`)),'No goals yet.');
  fill('panels',(current.decisionPanels||[]).filter(p=>p.companyId===companyId).slice(-8).reverse().map(p=>row(p.title,`${p.status} · ${p.members.length} experts · round ${p.round}/${p.maxRounds}`)),'No decision panels yet.');
  if(!company)notice('Selected company is unavailable.',true);
}
function renderMessages(messages){fill('messages',messages.slice(-30).map(m=>{const el=node('article',undefined,`message ${m.role==='user'?'user':'assistant'}`);el.append(node('strong',m.role==='user'?'You':'Donna'),node('p',m.content||m.message||''));return el;}),'Your company conversation starts here.');}
for(const [id,type] of [['refresh','refresh'],['connect-desktop','connectDesktop'],['connect-cloud','connectCloud'],['disconnect','disconnect'],['open-website','openWebsite']])$(id).onclick=()=>send({type});
for(const button of document.querySelectorAll('[data-studio]'))button.onclick=()=>send({type:'openStudio',view:button.dataset.studio});
$('company').onchange=()=>{companyId=$('company').value;$('messages').replaceChildren();send({type:'company',id:companyId});};
for(const button of document.querySelectorAll('[data-tab]'))button.onclick=()=>{for(const b of document.querySelectorAll('[data-tab]'))b.setAttribute('aria-pressed',String(b===button));for(const id of ['chat','team','roadmap'])$(`tab-${id}`).hidden=id!==button.dataset.tab;};
$('chat-form').onsubmit=event=>{event.preventDefault();const content=$('brief').value.trim();if(!content||busy)return;setBusy(true);notice('Sending to the selected company…');send({type:'chat',content});};
$('brief').onkeydown=event=>{if(event.key==='Enter'&&(event.ctrlKey||event.metaKey)){event.preventDefault();$('chat-form').requestSubmit();}};
$('panel').onclick=()=>{const task=$('brief').value.trim();if(!task){notice('Write the panel question in the brief first.',true);$('brief').focus();return;}setBusy(true);send({type:'panel',task,focus:$('panel-focus').value});};
window.addEventListener('message',event=>{const m=event.data;
  if(m.type==='state'){$('connect').hidden=m.connected;$('workspace').hidden=!m.connected;kind=m.connection?.kind||null;$('connection').textContent=m.connected?`${kind==='cloud'?'Cloud · explicit desktop sync':'Local desktop · live state'}${m.updatedAt?' · '+new Date(m.updatedAt).toLocaleString():''}`:'Not connected';if(m.connected){current=m.snapshot;companyId=m.selectedCompany;if($('notice').classList.contains('error'))notice('');render();}setBusy(false);}
  if(m.type==='chatHistory')renderMessages(m.messages);
  if(m.type==='notice')notice(m.message);
  if(m.type==='error'){notice(m.message,true);if(current)$('connection').textContent='Connection or request failed · showing last loaded state';setBusy(false);}
  if(m.type==='idle')setBusy(false);
  if(m.type==='chatSent'){$('brief').value='';notice(m.saved?'Brief saved in desktop.':'Donna replied. Usage is recorded in the cloud ledger.');if(m.reply)renderMessages([{role:'user',content:m.content},{role:'assistant',content:m.reply}]);setBusy(false);}
});
send({type:'ready'});
