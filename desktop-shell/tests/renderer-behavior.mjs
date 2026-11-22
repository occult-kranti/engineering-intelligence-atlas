/** Pure-DOM interaction checks. Fixtures do not establish native or browser correctness. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {installRendererFixture} from './fixtures/renderer-bridge.mjs';
import {createModuleLoader} from './renderer-module-loader.mjs';
const require=createRequire(import.meta.url);
const {JSDOM}=require(process.env.ATLAS_JSDOM_MODULE || 'jsdom');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const html=readFileSync(path.join(root,'dist/renderer/chrome.html'),'utf8');
const signalScript=readFileSync(path.join(root,'dist/renderer/office-signals.js'),'utf8');
const rendererRoot=path.join(root,'dist/renderer');
let checks=0;
function check(condition,message){assert.ok(condition,message);checks++;}
async function makeDom(fixture=true,transport,query='',beforeBoot){const dom=new JSDOM(html,{url:'https://fixture.invalid/chrome.html'+query,runScripts:'outside-only',pretendToBeVisual:true});const w=dom.window;w.scrollTo=()=>{};w.TextEncoder=TextEncoder;w.HTMLElement.prototype.scrollIntoView=()=>{};if(fixture){installRendererFixture(w);if(transport)w.desktopBridge.transport=transport;}beforeBoot?.(w);
// JSDOM has no layout: stub geometry/ResizeObserver only so Freeflow can mount; this does not prove visual layout.
if(!w.ResizeObserver)w.ResizeObserver=class{observe(){}unobserve(){}disconnect(){}};
if(!w.Element.prototype.getBoundingClientRect.__stub){const orig=w.Element.prototype.getBoundingClientRect;const stub=function(){const r=orig.call(this);return r.width||r.height?r:{x:0,y:0,left:0,top:0,right:1200,bottom:800,width:1200,height:800,toJSON(){return this;}};};stub.__stub=true;w.Element.prototype.getBoundingClientRect=stub;}
w.eval(signalScript);createModuleLoader(w,rendererRoot).run('chrome.js');await flush();return dom;}
const flush=()=>new Promise(resolve=>setTimeout(resolve,12));
const dom=await makeDom();const w=dom.window;const d=w.document;const fixture=w.__atlasFixture;
const el=(id)=>d.getElementById(id);
const set=(id,value)=>{el(id).value=value;};
const click=async(id)=>{el(id).click();await flush();};
const submit=async(id)=>{el(id).dispatchEvent(new w.SubmitEvent('submit',{bubbles:true,cancelable:true,submitter:el(id).querySelector('button[type="submit"]')}));await flush();};
const change=async(id,value)=>{set(id,value);el(id).dispatchEvent(new w.Event('change',{bubbles:true}));await flush();};
const commands=()=>fixture.calls.filter(c=>c.name==='officeCommand');
const lastCommand=()=>commands().at(-1)?.args;
check(el('overview-heading').textContent==='Fixture Engineering','company state renders');
check(el('metric-spend').textContent==='$0.00','zero usage is honest');
check(Array.from(d.querySelectorAll('input[type="number"]')).filter(input=>input.value!=='').every(input=>input.validity.valid),'default numeric budgets satisfy native browser min and step validation');
const ids=Array.from(d.querySelectorAll('[id]')).map(n=>n.id);check(new Set(ids).size===ids.length,'no duplicate DOM IDs');
const persistentWorld=d.querySelector('.ff-world');check(Boolean(persistentWorld)&&d.body.classList.contains('endless-canvas'),'one endless world is mounted at startup');
for(const view of ['overview','office','projects','team','roadmap','usage','library','models','settings']){d.querySelector(`.nav-item[data-view="${view}"]`).click();await flush();check(d.querySelector('.ff-world')===persistentWorld&&!el('office-view').classList.contains('hidden')&&!el('freeflow-surface').classList.contains('hidden'),`navigation retains the same visible world: ${view}`);if(view!=='office'){const panel=d.querySelector(`.canvas-panel[data-panel-id="${view}"]`);check(Boolean(panel)&&!panel.hidden&&persistentWorld.contains(panel),`${view} opens as a live world element`);}check(d.querySelector(`.nav-item[data-view="${view}"]`).getAttribute('aria-current')==='page',`selected nav: ${view}`);}
await click('header-new-project');check(el('new-project-details').open,'new project composer opens');check(d.activeElement===el('proj-name'),'new project focuses name');
set('proj-name','UI fixture project');set('proj-goal','A test-only deliverable');set('proj-model','fixture-model');await submit('project-form');check(fixture.calls.some(c=>c.name==='createProject'&&c.args.nodes.length===4),'project submits its four specialist nodes');
await click('run-start');check(!fixture.calls.some(c=>c.name==='startRun')&&el('run-start').disabled,'schema-v2 standalone provider runs require native pairing');check(el('run-pairing-note').textContent.includes('paired office goal'),'paired execution route is explained');const beforeRunDraft=commands().length;await click('run-plan-with-donna');check(el('chat-message').value.includes('UI fixture project')&&commands().length===beforeRunDraft,'project handoff prepares a Donna draft without dispatch');
d.querySelector('[data-view="settings"]').click();await flush();set('company-repo-url','https://github.com/fixture/engineering');await submit('company-form');check(fixture.calls.some(c=>c.name==='registerCompany'),'company registration calls bridge');check(el('settings-repo-status').textContent==='GitHub verified','verified result appears');
d.querySelector('.nav-item[data-view="roadmap"]').click();await flush();let select=d.querySelector('.task-card select');select.value='done';select.dispatchEvent(new w.Event('change'));await flush();check(!fixture.calls.some(c=>c.name==='updateCompanyTask'),'completion needs evidence');d.querySelector('.task-proof textarea').value='Fixture test evidence';select.value='done';select.dispatchEvent(new w.Event('change'));await flush();check(fixture.calls.some(c=>c.name==='updateCompanyTask'&&c.args.evidence==='Fixture test evidence'),'task update carries evidence');
d.querySelector('.nav-item[data-view="office"]').click();await flush();check(el('office-native-status').textContent==='Local state loaded','office snapshot loads');check(el('office-company-select').value==='fixture-company','active company selected');check(!Array.from(d.querySelectorAll('#office-employees .employee-card')).find(card=>card.textContent.includes('Donna stays available'))?.querySelector('.danger'),'Donna has no firing control');
check(el('locator-company').textContent==='Fixture Engineering'&&el('locator-office').textContent==='Product studio','visible hierarchy reflects the loaded company and office');check(/^\d+ assigned (person|people) · \d+ running requests?$/.test(el('locator-people').textContent),'loaded hierarchy replaces its empty-state employee text');
const visibleDepartment=fixture.office.departments[0];await change('office-department-select',visibleDepartment.id);check(el('locator-department').textContent===visibleDepartment.name,'visible hierarchy follows department selection');await change('office-department-select','');
await click('office-tab-people');set('hire-name','Reviewer <img src=x onerror=alert(1)>');set('hire-role','Review evidence');set('hire-skills','skills/agent-research-director/SKILL.md');await submit('office-hire-form');check(lastCommand()?.action==='hire_employee','hire submits command');check(!d.querySelector('#office-employees img'),'untrusted employee name stays text');check(lastCommand()?.skillPaths.length===1,'skill paths preserved');const pause=Array.from(d.querySelectorAll('#office-employees button')).find(b=>b.textContent==='Pause');pause.click();await flush();check(lastCommand()?.action==='pause_employee','employee pause wired');
await click('brief-donna');check(el('workspace-tab-chat').getAttribute('aria-selected')==='true','Donna returns to the unified chat');await click('office-tab-queue');set('queue-goal','Fixture manual task');await submit('office-queue-form');check(lastCommand()?.action==='enqueue_job'&&lastCommand()?.mode==='manual'&&lastCommand()?.authorized===false,'manual task queued without provider authorization');
await change('queue-mode','provider');set('queue-model','fixture-model');const before=commands().length;await submit('office-queue-form');check(commands().length===before,'provider task requires explicit authorization');el('queue-authorized').checked=true;await submit('office-queue-form');check(commands().length===before,'provider task requires positive rates');set('queue-rate-input','2');set('queue-rate-output','10');await submit('office-queue-form');check(lastCommand()?.authorized===true&&lastCommand()?.priceRates.outputUsdPerMillion===10,'provider task carries explicit prices and authorization');
set('schedule-at',new Date(Date.now()+3600000).toISOString().slice(0,16));await submit('office-schedule-form');check(lastCommand()?.action==='create_schedule'&&lastCommand()?.everyMinutes===0,'one-shot schedule retains job template');
await click('office-tab-memory');set('cache-max-entries','64');set('cache-ttl','30');await submit('office-cache-form');check(lastCommand()?.action==='configure_cache'&&lastCommand()?.maxEntries===64,'cache policy mutation wired');await click('office-clear-cache');check(lastCommand()?.action==='clear_cache'&&lastCommand()?.companyId==='fixture-company','cache clear scoped');set('knowledge-title','Fixture finding');set('knowledge-summary','Verified only in a test fixture.');await submit('office-knowledge-form');check(lastCommand()?.action==='add_knowledge','knowledge saved');check(el('office-knowledge').textContent.includes('Fixture finding'),'knowledge renders from returned state');
await click('office-tab-ledger');check(el('office-ledger').textContent.includes('hire_employee'),'ledger reflects returned events');set('office-ledger-search','no-such-action');el('office-ledger-search').dispatchEvent(new w.Event('input'));check(el('office-ledger').textContent.includes('No events'),'ledger filter empty state');
await click('office-tab-overview');await submit('office-import-form');check(fixture.calls.some(c=>c.name==='officeCommand'&&c.args.action==='import_github_account'&&c.args.owner==='occult-kranti'),'public GitHub import request wired');await click('worker-enable');check(fixture.calls.some(c=>c.name==='setOfficeWorker'&&c.args.enabled===true),'dispatcher enable is explicit');await click('worker-disable');check(fixture.calls.some(c=>c.name==='setOfficeWorker'&&c.args.enabled===false),'dispatcher stop wired');

// Unified conversation, budget policy, and saved spatial ownership.
await click('header-new-goal');check(d.activeElement===el('chat-message'),'new goal focuses the shared conversation');
check(el('chat-scope').value==='office','New goal inherits office focus');
await change('chat-scope','company');const preChat=commands().length;
set('chat-message','Review release evidence <img src=x onerror=alert(1)>');await submit('workspace-chat-form');
check(commands().slice(preChat).some(c=>c.args.action==='create_paired_workflow'&&c.args.scope.kind==='company'&&c.args.scope.id==='fixture-company'),'chat retains explicit company scope');
check(lastCommand()?.action==='create_paired_workflow'&&lastCommand()?.execute===false,'plan-only creates one atomic persisted paired workflow');
check(el('conversation-messages').textContent.includes('Local planning'),'local planner provenance visible');
check(!el('conversation-messages').querySelector('img'),'untrusted chat content stays text');
check(el('workspace-goals').textContent.includes('Review the evidence'),'assigned plan steps render');
check(!commands().some(c=>c.args.action==='execute_goal'),'plan-only never queues provider execution');
await change('chat-goal-mode','provider');set('chat-message','Run a bounded test-only goal');set('chat-model','fixture-model');
const beforeGoal=commands().length;await submit('workspace-chat-form');check(commands().length===beforeGoal,'review mode requires goal provider authorization');
el('chat-authorized').checked=true;await submit('workspace-chat-form');check(commands().length===beforeGoal,'goal cloud rates must be positive');
set('chat-rate-input','2');set('chat-rate-output','10');await submit('workspace-chat-form');
check(lastCommand()?.action==='create_paired_workflow'&&lastCommand()?.execute===false,'review mode atomically saves the plan without dispatch');
const approve=Array.from(el('workspace-goals').querySelectorAll('button')).find(b=>b.textContent==='Approve & queue');check(Boolean(approve),'review mode offers an explicit goal execution action');approve.click();await flush();check(lastCommand()?.action==='execute_goal','approved goal requests bounded execution');
set('workspace-approval-mode','autonomous');set('workspace-global-usd','25');set('workspace-global-tokens','100000');set('workspace-warning-percent','80');await submit('workspace-policy-form');
check(lastCommand()?.action==='configure_policy'&&lastCommand()?.hardCapUsd===25,'global budget and autonomy persist together');check(el('workspace-budget-label').textContent.includes('$25.00'),'global remaining budget comes from saved state');
el('chat-authorized').checked=false;set('chat-message','Autonomous goal inside the fixture cap');await submit('workspace-chat-form');
check(lastCommand()?.action==='create_paired_workflow'&&lastCommand()?.execute===true,'autonomous paired workflow requests bounded dispatch atomically');
check(fixture.office.goals.at(-1).runSettings.authorized===true,'autonomy carries authorization without changing caps');
await change('chat-scope','office');check(el('conversation-scope').textContent.includes('Product studio'),'chat scope visibly follows the office');await change('chat-scope','company');
await click('workspace-tab-blueprint');check(el('office-blueprint').querySelectorAll('.blueprint-room').length===1,'stored room renders in blueprint');
const roomButton=el('office-blueprint').querySelector('.blueprint-room-title');roomButton.click();check(el('room-name').value==='Product studio','room selection opens persisted details');
roomButton.dispatchEvent(new w.KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true,cancelable:true}));await flush();check(lastCommand()?.action==='upsert_room'&&Math.abs(lastCommand().x-.07)<.0001,'keyboard room movement saves normalized coordinates');
set('room-employee','donna');await submit('workspace-room-assign');check(lastCommand()?.action==='place_employee','employee placement saves explicit room ownership');
await click('workspace-tab-whiteboard');await click('whiteboard-add-node');set('node-title','Release evidence owner');set('node-owner','donna');set('node-room','fixture-room');set('node-goal',fixture.office.goals[0].id);await submit('workspace-node-form');
check(lastCommand()?.action==='upsert_whiteboard'&&lastCommand()?.goalIds[0]===fixture.office.goals[0].id,'whiteboard links the actual goal, owner, and room');
check(el('workspace-whiteboard').querySelector('.ownership-card').textContent.includes('Donna'),'ownership card renders its employee');
check(el('workspace-whiteboard').querySelector('.ownership-lines path'),'ownership line connects a saved owner desk');
const cardButton=el('workspace-whiteboard').querySelector('.card-title');cardButton.click();cardButton.dispatchEvent(new w.KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true,cancelable:true}));await flush();check(lastCommand()?.action==='upsert_whiteboard'&&Math.abs(lastCommand().y-.17)<.0001,'keyboard card movement saves room-relative coordinates');
await click('office-tab-overview');await click('github-refresh-branches');check(el('github-branches').textContent.includes('main'),'verified branch result renders');el('github-branches').querySelector('button').click();check(el('github-expected-head').value==='a'.repeat(40),'branch selection carries the exact commit head');
set('github-base','main');set('github-head','feature');await submit('github-compare-form');check(el('github-compare-result').textContent.includes('docs/review.md'),'comparison renders returned file evidence');
set('github-commit-message','Fixture reviewed change');set('github-files','[{"path":"docs/review.md","content":"fixture"}]');set('github-publish-branch','main');await submit('github-publish-form');check(lastCommand()?.operation==='publish_changes'&&lastCommand()?.expectedHead==='a'.repeat(40),'autonomous publish retains an exact branch-head guard');
set('workspace-approval-mode','review');await submit('workspace-policy-form');const publishBefore=commands().length;await submit('github-publish-form');check(commands().length===publishBefore,'review policy requires a reviewed changeset');
el('github-reviewed').checked=true;await submit('github-publish-form');check(lastCommand()?.operation==='publish_changes'&&lastCommand()?.reviewed===true,'reviewed publication carries its review evidence');
el('office-import-private').checked=true;await submit('office-import-form');check(lastCommand()?.includePrivate===true,'private import is explicit');
d.querySelector('.nav-item[data-view="settings"]').click();await flush();check(el('key-rows').textContent.includes('GitHub'),'GitHub vault metadata has its own credential row');const importButton=Array.from(el('key-rows').querySelectorAll('button')).find(b=>b.textContent==='Import file');importButton.click();await flush();check(fixture.calls.some(c=>c.name==='importCredentialFile'),'credential file import uses the native picker bridge');await click('open-personal-dashboard');check(fixture.calls.some(c=>c.name==='openPersonalDashboard'),'personal dashboard has a real bridge action');

// CEO portfolio is an organizational view of the same Donna workspace.
d.querySelector('.nav-item[data-view="office"]').click();await flush();await click('ceo-toggle');
check(!el('ceo-panel').classList.contains('hidden')&&persistentWorld.contains(el('ceo-panel'))&&!el('freeflow-surface').classList.contains('hidden'),'CEO overview opens inside the same world without creating another chat');
check(d.querySelectorAll('#conversation-messages').length===1,'there is exactly one conversation surface');
check(el('ceo-running-count').textContent==='0','staffing records do not imply running model requests');
await change('ceo-edit-group','fixture-group');set('ceo-group-name','Fixture platforms <img src=x onerror=alert(1)>');await submit('ceo-group-form');
check(lastCommand()?.action==='upsert_portfolio_group'&&lastCommand()?.companyIds.includes('fixture-company'),'group membership saves explicit company identities');check(!el('ceo-directory').querySelector('img'),'untrusted portfolio names remain text');
fixture.office.companies.push({id:'new-import-fixture',name:'A new fixture import',repoUrl:'https://github.com/fixture/new-import',status:'active',assistantId:'donna',createdAt:'2026-11-20T12:00:00Z',source:'fixture',importedAt:null,githubStatus:'unchecked'});await click('office-refresh');await click('ceo-optimize');
check(lastCommand()?.action==='optimize_portfolio'&&lastCommand()?.pauseRedundant===false,'portfolio optimization preserves current employees by default');
check(lastCommand()?.groups.some(g=>g.id==='portfolio-ungrouped'&&g.companyIds.includes('new-import-fixture')),'unassigned imports receive a transparent stable fallback collection');
check(el('ceo-services').textContent.includes('Hackathon production')&&el('ceo-services').textContent.includes('Music & arts'),'shared preset includes hackathon and creative specialties');
const sharedCount=fixture.office.employees.filter(e=>e.companyId==='fixture-shared-company').length;await click('ceo-optimize');check(fixture.office.employees.filter(e=>e.companyId==='fixture-shared-company').length===sharedCount,'repeated optimization does not duplicate shared employees');
set('ceo-move-company','fixture-company');set('ceo-move-group','fixture-second-group');await submit('ceo-move-company-form');
check(lastCommand()?.action==='optimize_portfolio'&&lastCommand()?.groups.find(g=>g.id==='fixture-second-group').companyIds.includes('fixture-company')&&!lastCommand()?.groups.find(g=>g.id==='fixture-group').companyIds.includes('fixture-company'),'company reassignment updates one atomic membership plan');
await click('ceo-add-roadmap');set('ceo-roadmap-title','Deliver reviewed portfolio evidence');set('ceo-roadmap-description','A fixture outcome with an accountable owner.');await change('ceo-roadmap-scope','company');await change('ceo-roadmap-target','fixture-company');set('ceo-roadmap-owner','donna');set('ceo-roadmap-owner-department','fixture-department');set('ceo-roadmap-edit-status','done');
const beforeRoadmap=commands().length;await submit('ceo-roadmap-form');check(commands().length===beforeRoadmap,'portfolio completion requires evidence before mutation');
set('ceo-roadmap-edit-status','in-progress');await submit('ceo-roadmap-form');check(lastCommand()?.action==='upsert_roadmap_item'&&lastCommand()?.scope.id==='fixture-company','portfolio roadmap saves real company scope and ownership');
await change('ceo-roadmap-group','fixture-second-group');check(el('ceo-roadmap').textContent.includes('Deliver reviewed portfolio evidence'),'group filter includes member-company outcomes');
await change('ceo-roadmap-department','fixture-department');check(el('ceo-roadmap').querySelectorAll('.portfolio-outcome').length===1,'department filter applies to saved roadmap ownership');
const mapPortfolio=Array.from(el('ceo-roadmap').querySelectorAll('button')).find(b=>b.textContent==='Map ownership');mapPortfolio.click();await flush();
check(el('ceo-panel').classList.contains('hidden')&&el('workspace-tab-whiteboard').getAttribute('aria-selected')==='true','portfolio ownership returns to the same company whiteboard');
check(el('node-roadmap').value===fixture.office.portfolio.roadmap[0].id,'whiteboard editor retains the portfolio outcome ID');set('node-room','fixture-room');await submit('workspace-node-form');check(lastCommand()?.roadmapItemIds?.[0]===fixture.office.portfolio.roadmap[0].id,'whiteboard persists a validated roadmap link');
check(el('workspace-whiteboard').textContent.includes('Roadmap: Deliver reviewed portfolio evidence'),'whiteboard shows linked roadmap ownership');
await click('ceo-toggle');await change('ceo-contract-service','service-engineering');await change('ceo-contract-company','fixture-company');await submit('ceo-contract-form');
check(lastCommand()?.action==='contract_service'&&lastCommand()?.employeeIds.includes('shared-engineering'),'shared contract reuses the original employee identity');
const contractId=fixture.office.portfolio.contracts.find(c=>c.serviceId==='service-engineering'&&c.recipientCompanyId==='fixture-company').id;
const pauseContract=Array.from(el('ceo-contracts').querySelectorAll('button')).find(b=>b.textContent==='Pause contract');pauseContract.click();await flush();check(lastCommand()?.action==='contract_service'&&lastCommand()?.status==='paused','shared staffing can be paused without firing its employee');
const resumeContract=Array.from(el('ceo-contracts').querySelectorAll('button')).find(b=>b.textContent==='Resume contract');resumeContract.click();await flush();
const companyLink=el('ceo-directory').querySelector('[data-company-id="fixture-company"] .portfolio-company-name');companyLink.click();await flush();check(el('ceo-panel').classList.contains('hidden')&&el('workspace-tab-chat').getAttribute('aria-selected')==='true','company directory opens the existing scoped chat');
await click('office-tab-queue');await change('queue-service-contract',contractId);check(el('queue-employee').value==='shared-engineering','contract queue exposes the real shared employee');await change('queue-mode','manual');set('queue-goal','Fixture shared-service task');await submit('office-queue-form');check(lastCommand()?.serviceContractId===contractId&&lastCommand()?.employeeId==='shared-engineering'&&lastCommand()?.companyId==='fixture-company','shared task keeps recipient company and explicit service contract');
await click('ceo-toggle');set('ceo-policy-title','Fixture CEO office policy');el('ceo-enabled').checked=false;set('ceo-focus-group','fixture-second-group');await submit('ceo-policy-form');check(lastCommand()?.action==='configure_ceo'&&lastCommand()?.enabled===false&&lastCommand()?.focusGroupId==='fixture-second-group','CEO coordination policy persists without claiming worker activity');
set('ceo-review-rate-input','0');const beforeReview=commands().length;await submit('ceo-review-form');check(commands().length===beforeReview,'scheduled cloud review pricing must be explicit and positive');set('ceo-review-rate-input','2');await submit('ceo-review-form');
check(lastCommand()?.action==='schedule_repository_reviews'&&lastCommand()?.enabled===false&&lastCommand()?.maxTokens===48000&&lastCommand()?.everyMinutes===1440,'maintenance prepares bounded paused daily reviews');
check(el('ceo-review-status').textContent.includes('publishing is a separate action'),'review scheduling does not claim automatic code publication');

// Shared Services can reuse a source-company employee without moving its hierarchy.
const reusedEmployee=fixture.office.employees.find(e=>e.id==='shared-engineering');reusedEmployee.companyId='fixture-company';reusedEmployee.officeId='fixture-office';reusedEmployee.departmentId='fixture-department';
fixture.office.blueprints.push({id:'shared-blueprint-fixture',companyId:'fixture-shared-company',officeId:'fixture-shared-office',rooms:[{id:'shared-room-fixture',name:'Shared engineering room',departmentId:'department-engineering',x:.05,y:.05,width:.42,height:.42}],desks:[{id:'shared-desk-fixture',roomId:'shared-room-fixture',employeeId:'shared-engineering',x:.2,y:.6}],whiteboards:[]});
await click('office-refresh');el('ceo-services').querySelector('[data-service-key="engineering"] button').click();await flush();el('office-blueprint').querySelector('.blueprint-room-title').click();check(Array.from(el('room-employee').options).some(option=>option.value==='shared-engineering'),'shared office placement recognizes a reused source-company employee');el('office-blueprint').querySelector('.room-occupant').click();check(el('room-status').textContent.includes('original company assignment is preserved'),'reused employee inspection does not falsely report a missing contract');
dom.window.close();
const preview=await makeDom(false);check(!preview.window.document.getElementById('bridge-notice').classList.contains('hidden'),'browser preview declares native unavailable');check(preview.window.document.querySelectorAll('.view').length===9,'all nine views exist without native bridge');preview.window.close();
const publicPreview=await makeDom(true,'public-preview');const pd=publicPreview.window.document;check(pd.getElementById('locator-company').textContent==='Fixture Engineering'&&pd.getElementById('locator-office').textContent==='Product studio'&&/^\d+ assigned (person|people) · \d+ running requests?$/.test(pd.getElementById('locator-people').textContent),'public preview renders the loaded hierarchy as well as its saved office');check(pd.getElementById('bridge-notice').textContent.includes('data is an example workspace'),'starter preview is clearly marked as example data');check(pd.getElementById('chat-send').disabled,'public preview cannot create provider or local goals');check(pd.getElementById('core-label').textContent==='Starter office preview','refresh keeps public preview identity honest');pd.getElementById('ceo-toggle').click();check(!pd.getElementById('ceo-panel').classList.contains('hidden'),'public example portfolio remains navigable');check(pd.getElementById('ceo-optimize').disabled,'public CEO view cannot mutate portfolio staffing');const publicCalls=publicPreview.window.__atlasFixture.calls.length;pd.querySelector('[data-company-id="fixture-company"] .portfolio-company-name').click();await flush();check(publicPreview.window.__atlasFixture.calls.length===publicCalls,'public company selection stays local and read only');publicPreview.window.close();
// Decision lifecycle and explicit cloud transports use fixture data only.
const studio=await makeDom();const sw=studio.window;const sd=sw.document;const sf=sw.__atlasFixture;const se=id=>sd.getElementById(id);const ss=(id,v)=>se(id).value=v;const sc=async id=>{se(id).click();await flush();};const sch=async(id,v)=>{ss(id,v);se(id).dispatchEvent(new sw.Event('change',{bubbles:true}));await flush();};const ssubmit=async id=>{se(id).dispatchEvent(new sw.SubmitEvent('submit',{bubbles:true,cancelable:true,submitter:se(id).querySelector('button[type="submit"]')}));await flush();};const scommands=()=>sf.calls.filter(c=>c.name==='officeCommand');
check(sd.querySelectorAll('#workspace-chat-form').length===1,'studio preserves one Donna composer');
await sc('ceo-open-decisions');check(se('workspace-tab-decisions').getAttribute('aria-selected')==='true'&&se('ceo-panel').classList.contains('hidden'),'CEO decision shortcut opens the same workspace');
await sch('decision-focus','research');check(Array.from(se('decision-role-options').querySelectorAll('input:checked')).map(i=>i.value).join(',')==='newton,tesla,research-skeptic','research preset maps authoritative role keys');
await sch('decision-focus','software');ss('decision-title','Fixture architecture choice');ss('decision-task','Compare mechanisms and cite acceptance evidence. <img src=x>');await ssubmit('decision-create-form');
const sp=sf.office.decisionPanels[0];check(sp&&sp.status==='draft'&&sp.members.length===4,'panel creation persists a draft with selected roles');check(sp.limits.maxTokens===60000&&sp.limits.maxUsd===2,'panel receives explicit context and whole-panel limits');check(!sf.office.jobs.length,'creating a panel makes no provider request');check(se('decision-detail-task').textContent.includes('<img src=x>')&&!se('decision-detail').querySelector('img'),'panel brief is rendered as safe text');
await sc('decision-pause');check(scommands().at(-1).args.action==='pause_panel','pause uses the native panel command');await sc('decision-pause');check(scommands().at(-1).args.action==='resume_panel','resume preserves the panel identity');
await sc('decision-start');ss('decision-model','fixture-model');const beforePanelRun=scommands().length;await ssubmit('decision-run-form');check(scommands().length===beforePanelRun,'review policy requires round authorization');se('decision-authorized').checked=true;await ssubmit('decision-run-form');check(scommands().length===beforePanelRun,'unpriced cloud panel work is refused');ss('decision-rate-input','2');ss('decision-rate-output','10');await ssubmit('decision-run-form');check(scommands().at(-1).args.action==='start_panel_round'&&scommands().at(-1).args.runSettings.authorized===true,'priced authorized round reaches the panel service');check(se('decision-detail-state').textContent==='Review work queued','queued panel does not claim model execution');check(!se('decision-reports').textContent.includes('Fixture returned evidence'),'draft reports do not invent provider output');
sf.office.jobs[0].usage.costUsd=.12;sf.office.jobs[0].reservation={costUsd:.12,maxTokens:60000};sf.office.jobs[0].costStatus='reserved';await sc('office-refresh');check(se('decision-limits').textContent.includes('$0.12 committed'),'panel cost does not double-count a reservation mirrored in usage');
for(const job of sf.office.jobs){job.status='completed';job.summary=job.employeeId==='donna'?'Fixture synthesis with a cited tradeoff.':'Fixture returned evidence.';job.artifactUri=`/fixture/${job.id}.md`;job.usage={inputTokens:80,outputTokens:20,costUsd:.001};job.costStatus='observed';}sp.status='review';await sc('office-refresh');check(se('decision-reports').textContent.includes('Fixture synthesis with a cited tradeoff.'),'panel displays returned Donna synthesis');check(se('decision-reports').querySelectorAll('.decision-report').length===5,'panel reports resolve real goal job IDs');
ss('decision-summary','Adopt the reviewed fixture approach.');const beforeVerdict=scommands().length;await ssubmit('decision-verdict-form');check(scommands().length===beforeVerdict,'accepting a panel requires evidence');ss('decision-evidence','/fixture/review-evidence.md');await ssubmit('decision-verdict-form');check(scommands().at(-1).args.action==='record_panel_decision'&&sp.status==='decided','recording a decision persists its verdict');check(se('decision-history').textContent.includes('/fixture/review-evidence.md'),'decision history retains evidence');check(sf.office.portfolio.roadmap.length===0,'decision acceptance does not fabricate roadmap completion');
await sc('decision-map-goal');check(se('workspace-tab-whiteboard').getAttribute('aria-selected')==='true'&&se('node-goal').value===sp.goalIds.at(-1),'panel work maps its existing goal into the shared whiteboard editor');await sc('workspace-tab-decisions');
await sc('decision-to-chat');check(se('workspace-tab-chat').getAttribute('aria-selected')==='true'&&sd.querySelectorAll('#workspace-chat-form').length===1,'panel returns to the existing Donna conversation');
await sc('workspace-save-status');ss('cloud-url','https://fixture.example');ss('cloud-device-token','fixture-device-token');await ssubmit('cloud-connect-form');check(sf.calls.some(c=>c.name==='configureCloud')&&se('cloud-device-token').value==='','pairing uses the bridge and immediately clears the masked token');check(!sf.calls.some(c=>c.name==='syncCloud'),'connection does not silently upload');check(se('cloud-last-sync').textContent==='Never','authentication alone does not claim sync');await sc('cloud-sync');check(sf.calls.some(c=>c.name==='syncCloud')&&se('cloud-revision').textContent==='1','explicit sync renders acknowledged remote revision');
sw.desktopBridge.syncCloud=async()=>({ok:false,status:{...sf.cloud,error:'Conflict: remote revision changed; local snapshot retained.'},error:'Conflict: remote revision changed; local snapshot retained.'});await sc('cloud-sync');check(se('cloud-status').textContent.includes('Conflict:')&&sf.office.companies.length===1,'failed sync exposes the error and retains local state');await sc('editor-pair');check(sf.calls.some(c=>c.name==='copyEditorPairing')&&!se('editor-pair-status').textContent.includes('http'),'editor pairing returns metadata without a credential URL');await sc('cloud-disconnect');check(sf.office.decisionPanels.length===1&&sf.calls.some(c=>c.name==='disconnectCloud'),'disconnect leaves saved local panels intact');studio.window.close();
const readonly=await makeDom(true,'public-preview');check(readonly.window.document.getElementById('decision-create').disabled&&readonly.window.document.getElementById('cloud-connect').disabled&&readonly.window.document.getElementById('editor-pair').disabled,'starter preview cannot convene, pair, or sync');readonly.window.close();
const hosted=await makeDom(true,'cloud-browser');const hw=hosted.window;const hd=hw.document;hd.getElementById('chat-message').value='Fixture cloud brief';hd.getElementById('workspace-chat-form').dispatchEvent(new hw.SubmitEvent('submit',{bubbles:true,cancelable:true}));await flush();check(hw.__atlasFixture.calls.some(c=>c.name==='sendCloudChat'),'hosted Donna uses the actual cloud chat transport');check(!hw.__atlasFixture.calls.some(c=>c.name==='officeCommand'),'cloud reply does not pretend to execute native goal commands');check(hd.getElementById('conversation-messages').textContent.includes('Fixture Donna cloud reply.'),'hosted chat renders the returned provider message');check(hd.getElementById('conversation-title').textContent==='Donna · cloud','hosted conversation identifies its execution surface');hosted.window.close();
let welcomeCalls=0,loadHostedSnapshot;const unloadedHosted=await makeDom(true,'cloud-browser','?workspace=blueprint',w=>{loadHostedSnapshot=w.desktopBridge.officeSnapshot;w.desktopBridge.officeSnapshot=async()=>{throw new Error('Fixture unauthenticated workspace response');};w.desktopBridge.companySnapshot=async()=>null;w.desktopBridge.cloudStatus=async()=>{throw new Error('Fixture unavailable cloud status');};w.desktopBridge.backToLauncher=async()=>{welcomeCalls++;return{ok:true};};});const uhw=unloadedHosted.window,uhd=uhw.document;const uhe=id=>uhd.getElementById(id);
check(uhe('workspace-save-label').textContent==='Cloud not loaded'&&!uhe('workspace-save-status').title.includes('Signed-in')&&uhe('workspace-budget-label').textContent==='Budget not loaded','a missing hosted snapshot claims neither an authenticated session nor a workspace upgrade');
check(!uhe('cloud-workspace-notice').classList.contains('hidden')&&uhe('cloud-workspace-notice-message').getAttribute('role')==='status'&&uhe('cloud-workspace-notice-message').textContent.includes('Open welcome to check sign-in')&&!uhe('cloud-welcome').disabled,'unavailable hosted state exposes a visible status and welcome entry');
check(uhe('chat-send').disabled&&uhe('office-blueprint').querySelectorAll('[data-room-id]').length===0&&!uhe('workspace-softboard').textContent.includes('Fixture Engineering'),'unavailable hosted state has no fabricated office metadata or enabled chat');
uhe('cloud-welcome').click();await flush();check(welcomeCalls===1&&!uhw.__atlasFixture.calls.some(c=>c.name==='officeCommand'||c.name==='sendCloudChat'),'welcome entry uses the existing bridge navigation without dispatching work');
uhw.desktopBridge.officeSnapshot=loadHostedSnapshot;uhe('office-refresh').click();await flush();check(uhe('cloud-workspace-notice').classList.contains('hidden')&&uhe('workspace-save-label').textContent==='Cloud session'&&uhe('core-label').textContent==='Private cloud workspace'&&!uhe('chat-send').disabled,'successful snapshot recovery removes the unavailable notice and restores loaded controls');unloadedHosted.window.close();
const legacyHosted=await makeDom(true,'cloud-browser','',w=>{const load=w.desktopBridge.officeSnapshot;w.desktopBridge.officeSnapshot=async()=>{const result=await load();delete result.snapshot.policy;return result;};});check(legacyHosted.window.document.getElementById('workspace-budget-label').textContent==='Workspace upgrade required'&&legacyHosted.window.document.getElementById('cloud-workspace-notice').classList.contains('hidden'),'a loaded snapshot missing the required schema remains distinct from a missing hosted snapshot');legacyHosted.window.close();
const queued=await makeDom(true,'cloud-browser');const qw=queued.window;const qd=qw.document;let queuedCalls=0;qw.desktopBridge.officeCommand=async()=>{queuedCalls++;return{ok:true,snapshot:JSON.parse(JSON.stringify(qw.__atlasFixture.office)),queued:true,commandId:'fixture-pending-command'};};qd.getElementById('ceo-open-decisions').click();qd.getElementById('decision-title').value='Pending native decision';qd.getElementById('decision-task').value='Saved only after native acknowledgement.';qd.getElementById('decision-create-form').dispatchEvent(new qw.SubmitEvent('submit',{bubbles:true,cancelable:true}));await flush();check(queuedCalls===1&&qw.__atlasFixture.office.decisionPanels.length===0,'queued remote delivery does not fabricate applied records or follow-up requests');check(qd.getElementById('decision-status').textContent.includes('has not been applied yet')&&!qd.getElementById('decision-status').classList.contains('error'),'queued command is shown as pending rather than completed or failed');queued.window.close();
const deepLink=await makeDom(true,undefined,'?workspace=decisions');check(deepLink.window.document.getElementById('workspace-tab-decisions').getAttribute('aria-selected')==='true','allowlisted workspace URL opens the same decision room');deepLink.window.close();const ceoLink=await makeDom(true,undefined,'?ceo=true');check(!ceoLink.window.document.getElementById('ceo-panel').classList.contains('hidden'),'CEO URL opens the existing portfolio view');ceoLink.window.close();const badLink=await makeDom(true,undefined,'?workspace=unknown&ceo=yes');check(badLink.window.document.getElementById('workspace-tab-chat').getAttribute('aria-selected')==='true'&&badLink.window.document.getElementById('ceo-panel').classList.contains('hidden'),'unknown route values are ignored without creating another screen');badLink.window.close();
// Authority controls exercise the shared command boundary, not simulated provider execution.
const management=await makeDom();const mw=management.window,md=mw.document,mf=mw.__atlasFixture;
const me=id=>md.getElementById(id),ms=(id,v)=>me(id).value=v;
const mc=async(id,v)=>{ms(id,v);me(id).dispatchEvent(new mw.Event('change',{bubbles:true}));await flush();};
const msubmit=async id=>{me(id).dispatchEvent(new mw.SubmitEvent('submit',{bubbles:true,cancelable:true,submitter:me(id).querySelector('button[type="submit"]')}));await flush();};
const mcommands=()=>mf.calls.filter(c=>c.name==='officeCommand');
me('ceo-toggle').click();me('ceo-authority-editor').open=true;await flush();
check(md.title.includes('Daftar')&&md.querySelectorAll('#workspace-chat-form').length===1,'Daftar rebrand preserves one shared conversation');
check(!me('authority-grant-submit').disabled&&me('authority-index').textContent.includes('Fixture Engineering'),'management loads native support and searchable index');
ms('authority-reason','Release review responsibility <img src=x>');let beforeAuthority=mcommands().length;await msubmit('authority-grant-form');
check(mcommands().length===beforeAuthority&&me('authority-status').textContent.includes('at least one capability'),'partial permission cannot silently become full authority');
me('authority-capabilities').querySelector('input[value="work.manage"]').checked=true;
ms('authority-expiry','2020-01-01T12:00');await msubmit('authority-grant-form');
check(mcommands().length===beforeAuthority&&me('authority-status').textContent.includes('future expiry'),'expired grant is rejected before mutation');
md.querySelector('[data-authority-hours="24"]').click();await msubmit('authority-grant-form');
let mg=mf.office.authority.grants[0];check(mg&&mg.scope.id==='fixture-company'&&mg.capabilities.join(',')==='work.manage'&&mg.preset==='partial','grant submits exact employee scope and selected capability');
check(mf.office.jobs.length===0&&mf.office.budget.committedUsd===0,'permission assignment does not dispatch or bill model work');
check(me('authority-grants').textContent.includes('<img src=x>')&&!me('authority-grants').querySelector('img'),'grant reasons remain safe text');
await mc('authority-type','promotion');await mc('authority-preset','full');beforeAuthority=mcommands().length;await msubmit('authority-grant-form');check(mcommands().length===beforeAuthority,'temporary promotion requires a title');
ms('authority-title','Acting review director');ms('authority-reason','Coordinate the bounded release review.');await msubmit('authority-grant-form');
const promotion=mf.office.authority.grants.at(-1);check(promotion.type==='promotion'&&promotion.title==='Acting review director'&&promotion.capabilities.includes('authority.manage'),'full in-app promotion is explicit and bounded');
check(mf.office.employees.find(e=>e.id==='donna').role==='CEO assistant','temporary promotion preserves the permanent employee role');
mg.expiresAt='2020-01-01T12:00:00.000Z';me('office-refresh').click();await flush();
check(me('authority-grants').querySelector(`[data-grant-id="${mg.id}"]`).textContent.includes('expired'),'expiry is shown from stored timestamps');
promotion.parentGrantIds=[mg.id];me('office-refresh').click();await flush();check(me('authority-grants').querySelector(`[data-grant-id="${promotion.id}"]`).textContent.includes('Inherited authority ended'),'expired parent immediately marks delegated rights ineffective');
promotion.parentGrantIds=[promotion.id];me('office-refresh').click();await flush();check(me('authority-grants').querySelector(`[data-grant-id="${promotion.id}"]`).textContent.includes('Inherited authority ended'),'cyclic legacy parent data fails closed without recursive rendering');promotion.parentGrantIds=[mg.id];
const revokeForm=me('authority-grants').querySelector(`[data-grant-id="${promotion.id}"] form`);revokeForm.querySelector('input').value='Review completed; remove temporary rights.';revokeForm.dispatchEvent(new mw.SubmitEvent('submit',{bubbles:true,cancelable:true}));await flush();
check(promotion.revokedAt&&mf.office.authority.managedEmployeeIds.includes('donna'),'revocation retains managed enforcement and history');
check(me('authority-grants').textContent.includes('Review completed; remove temporary rights.'),'revoke reason remains visible');
ms('authority-search','Acting review director');me('authority-search').dispatchEvent(new mw.Event('input'));check(me('authority-index').querySelectorAll('.authority-index-row').length===1,'index search resolves a promotion by title');
ms('authority-search','remove temporary rights');me('authority-search').dispatchEvent(new mw.Event('input'));check(me('authority-ledger').querySelectorAll('.authority-ledger-row').length===1,'decision search finds recorded reasons');
await mc('authority-record-filter','ledger');check(me('authority-index-section').classList.contains('hidden')&&!me('authority-ledger-section').classList.contains('hidden'),'register filter narrows records without losing state');
ms('authority-enforcement-reason','Explicit owner restoration of per-job authorization.');await mc('authority-enforcement','false');await msubmit('authority-enforcement-form');check(mcommands().at(-1).args.action==='set_authority_enforcement'&&mcommands().at(-1).args.requireGrants===false,'owner policy restoration is an explicit recorded command');
const originalCommand=mw.desktopBridge.officeCommand;mw.desktopBridge.officeCommand=async()=>({ok:false,snapshot:null,error:'Donna cannot delegate beyond her active authority.'});await mc('authority-issuer','donna');await msubmit('authority-grant-form');check(me('authority-status').textContent.includes('cannot delegate')&&mf.office.authority.grants.length===2,'native delegation rejection is visible without optimistic grants');mw.desktopBridge.officeCommand=originalCommand;management.window.close();
const managementPreview=await makeDom(true,'public-preview');check(managementPreview.window.document.getElementById('authority-grant-submit').disabled&&managementPreview.window.document.getElementById('authority-enforcement-submit').disabled,'public preview cannot change authority');managementPreview.window.close();
const managementQueued=await makeDom(true,'cloud-browser');const aqw=managementQueued.window,aqd=aqw.document,aqf=aqw.__atlasFixture;aqw.desktopBridge.officeCommand=async()=>({ok:true,snapshot:JSON.parse(JSON.stringify(aqf.office)),queued:true,commandId:'authority-pending'});aqd.getElementById('authority-preset').value='full';aqd.getElementById('authority-reason').value='Queued owner request';aqd.getElementById('authority-grant-form').dispatchEvent(new aqw.SubmitEvent('submit',{bubbles:true,cancelable:true}));await flush();check(aqf.office.authority.grants.length===0&&aqd.getElementById('authority-status').textContent.includes('has not been applied yet'),'cloud grant waits for native acknowledgement');managementQueued.window.close();
// Studio views use one shared conversation and deterministic signals from real fixture records.
const atlasStudio=await makeDom();const aw=atlasStudio.window,ad=aw.document,af=aw.__atlasFixture;
const ae=id=>ad.getElementById(id),av=(id,v)=>ae(id).value=v;
const ac=async id=>{ae(id).click();await flush();};
const ach=async(id,v)=>{av(id,v);ae(id).dispatchEvent(new aw.Event('change',{bubbles:true}));await flush();};
check(ad.documentElement.dataset.theme==='blueprint','studio starts in the default dark theme');
await ach('workspace-theme','drafting');check(ad.documentElement.dataset.theme==='drafting'&&aw.localStorage.getItem('daftar-studio-theme')==='drafting','theme selection persists without a native mutation');
check(ae('office-blueprint').querySelector('[data-room-id]').dataset.heatLevel==='unknown','no room jobs is unknown rather than a healthy zero');
check(ae('workspace-heat-legend').textContent.includes('Unknown / stale'),'heat legend includes a text equivalent for unknown');
ae('office-blueprint').querySelector('.blueprint-room-title').click();av('room-name','Unsent room name');ae('room-name').dispatchEvent(new aw.Event('input',{bubbles:true}));await ach('workspace-heat-mode','attention');check(ae('room-name').value==='Unsent room name','changing heat mode preserves an unsaved room inspector edit');await ac('office-refresh');check(ae('room-name').value==='Unsent room name','refreshing saved signals preserves the unsaved room inspector edit');await ach('workspace-heat-mode','workload');
av('chat-message','Preserve this unsent brief.');await ac('workspace-tab-blueprint');await ac('donna-dock-toggle');
check(ae('donna-conversation').closest('.canvas-panel')?.dataset.panelId==='donna'&&ad.querySelectorAll('#workspace-chat-form').length===1,'Donna opens the existing composer as one world element');
check(ae('chat-message').value==='Preserve this unsent brief.','opening dock preserves the unsent brief');
await ac('donna-dock-close');await ac('workspace-tab-chat');check(ae('donna-conversation').closest('.canvas-panel')?.dataset.panelId==='donna'&&ae('chat-message').value==='Preserve this unsent brief.','closing and reopening Donna preserves its live world form');
await ac('workspace-tab-softboard');check(ae('workspace-panel-softboard').classList.contains('hidden')===false&&ae('workspace-softboard').textContent.includes('Donna'),'soft board uses saved employee names');
ae('workspace-softboard').querySelector('[data-employee-id="donna"]').click();await flush();check(ae('softboard-person-title').textContent==='Donna'&&!ae('softboard-person-authority').disabled,'selecting a person opens actual ownership inspection');
af.office.employees.push({...af.office.employees[0],id:'paused-designer',name:'Paused designer',role:'Designer',status:'paused'});await ac('office-refresh');ae('workspace-softboard').querySelector('[data-employee-id="paused-designer"]').click();await flush();check(ae('softboard-person-chat').disabled&&!ae('softboard-person-authority').disabled&&ae('softboard-person-detail').textContent.includes('resume their assignment'),'paused employees keep ownership inspection without an invalid chat target');
av('softboard-search','no matching role');ae('softboard-search').dispatchEvent(new aw.Event('input'));check(ae('softboard-result-note').textContent.startsWith('0 of 0'),'soft board search has an honest empty result');av('softboard-search','');ae('softboard-search').dispatchEvent(new aw.Event('input'));
af.office.blueprints[0].desks.push({id:'studio-desk',roomId:'fixture-room',employeeId:'donna',x:.2,y:.2});av('queue-goal','Recorded signal fixture');ae('office-queue-form').dispatchEvent(new aw.SubmitEvent('submit',{bubbles:true,cancelable:true}));await flush();
check(ae('office-blueprint').querySelector('[data-room-id]').dataset.heatLevel==='1','one queued recorded job maps to the first nonzero room intensity');
await ach('workspace-heat-mode','budget');check(ae('workspace-signal-summary').textContent.includes('job allowances'),'budget heat exposes its job-allowance denominator');
await ach('workspace-heat-mode','off');check(ae('office-blueprint').querySelector('[data-room-id]').dataset.heatLevel==='off','heat overlay can be disabled without changing jobs');
await ac('workspace-tab-timeline');check(ae('workspace-timeline').querySelectorAll('.roadmap-lane').length===4&&ae('workspace-timeline').textContent.includes('No saved outcomes'),'roadmap lanes do not fabricate outcome progress');
await ach('studio-roadmap-status','blocked');check(ae('workspace-timeline').querySelectorAll('.roadmap-lane').length===1,'roadmap filter narrows to one actual delivery state');
check(af.office.jobs.length===1,'view, theme and overlay controls never enqueue extra jobs');atlasStudio.window.close();
const mapRoute=await makeDom(true,undefined,'?workspace=softboard');check(mapRoute.window.document.getElementById('workspace-tab-softboard').getAttribute('aria-selected')==='true','soft board has a working allowlisted deep link');mapRoute.window.close();
// Company-kit identities stay in native history without hiding useful source
// notes behind the last-100 display limit or taking over the human index.
const knowledgeView=await makeDom(true,'cloud-browser','',window=>{
  const office=window.__atlasFixture.office,at='2026-11-21T10:00:00Z';
  const source=(id,title,summary,artifactUri=null,companyId='fixture-company')=>({id,title,summary,artifactUri,companyId,createdAt:at});
  office.knowledge.push(
    source('source-atlas','Verified source atlas','Review the reference (https://finopsly-growth-atlas.whatswrong-inc.chatgpt.site).'),
    source('source-api','API reference','Reference https://docs.stripe.com/testing and https://docs.stripe.com/testing.','https://docs.stripe.com/testing'),
    source('source-contract','Domain task contract','Produce the accepted deliverable and retain its evidence.'),
    source('source-unsafe','Literal source text','<img src=x onerror=alert(1)> https://user:secret@unsafe.invalid/read http://unsafe.invalid/read https://unsafe.invalid/read?token=private https://unsafe.invalid/read#api_key=private','javascript:alert(1)'),
    source('source-foreign','Other company source','Do not render in this company memory.',null,'fixture-other-company')
  );
  for(let i=0;i<130;i++)office.knowledge.push(source(`binding-${i}`,'Company kit identity: room / test',JSON.stringify({kind:'daftar-company-kit-binding',schemaVersion:1,companyId:'fixture-company',kitKey:'fixture',entityType:'room',key:`room-${i}`,entityId:`room-${i}`})));
  office.knowledge.push(source('binding-uri','Imported identity','Malformed internal record','daftar-kit://fixture/binding/room'));
  office.knowledge.push(source('binding-malformed','Recovered identity','{"kind":"daftar-company-kit-binding",BROKEN'));
  office.authority.index.push(...office.knowledge.map(note=>({id:`knowledge:${note.id}`,entityId:note.id,kind:'knowledge',title:note.title,companyId:note.companyId,parentId:note.companyId,ownerEmployeeId:'donna',status:'saved',updatedAt:at,relatedIds:[]})));
  office.events.push({id:'binding-event',at,actor:'owner',action:'add_knowledge',entityId:'binding-0',summary:'Retained importer identity event'});
  office.authority.ledger.push({id:'binding-decision',at,actor:'owner',action:'knowledge_import',targetId:'binding-0',scope:{kind:'company',id:'fixture-company'},summary:'Retained importer history decision',grantId:null,outcome:'applied'});
});
const kw=knowledgeView.window,kd=kw.document,kf=kw.__atlasFixture,ke=id=>kd.getElementById(id);
ke('office-tab-memory').click();await flush();
check(ke('office-knowledge').querySelectorAll('.knowledge-note').length===4&&ke('office-knowledge').textContent.includes('Domain task contract'),'filtering before the display cap keeps real source and task-contract notes visible');
check(!ke('office-knowledge').textContent.includes('Company kit identity:')&&!ke('office-knowledge').textContent.includes('Recovered identity')&&!ke('office-knowledge').textContent.includes('Other company source'),'memory hides valid and malformed internal bindings while retaining company scope');
check(!ke('office-knowledge').querySelector('img')&&ke('office-knowledge').textContent.includes('<img src=x onerror=alert(1)>'),'source prose remains text rather than executable markup');
const sourceButtons=Array.from(ke('office-knowledge').querySelectorAll('button'));
check(sourceButtons.length===2&&sourceButtons.every(button=>button.type==='button'&&button.tabIndex===0&&button.getAttribute('aria-label').startsWith('Open source for ')),'deduplicated source controls are keyboard-focusable native buttons with descriptive labels');
check(sourceButtons.every(button=>!button.title.includes('unsafe.invalid')),'HTTP, credential-bearing and script references never become source actions');
const atlasSource=sourceButtons.find(button=>button.title.includes('finopsly-growth-atlas'));atlasSource.focus();check(kd.activeElement===atlasSource,'source action participates in normal keyboard focus');atlasSource.click();await flush();
check(kf.calls.some(call=>call.name==='openExternal'&&call.args.url==='https://finopsly-growth-atlas.whatswrong-inc.chatgpt.site/'),'cloud-projected source URL opens through the existing bridge after removing prose punctuation');
ke('ceo-toggle').click();ke('ceo-authority-editor').open=true;await flush();
check(!ke('authority-index').querySelector('[data-entity-id="binding-0"]')&&Boolean(ke('authority-index').querySelector('[data-entity-id="source-atlas"]')),'human authority index filters metadata identities before its row limit');
check(ke('authority-summary').textContent.includes('7 indexed records')&&ke('authority-register-count').textContent.startsWith('7 indexed'),'management counts agree with the human-visible records');
check(ke('authority-ledger').textContent.includes('Retained importer history decision'),'authority decision history remains intact');
ke('office-tab-ledger').click();await flush();check(ke('office-ledger').textContent.includes('Retained importer identity event')&&kf.office.knowledge.length===137,'full event history and persisted knowledge records remain available');
check(!kf.calls.some(call=>call.name==='officeCommand'),'viewing source notes and opening references never mutates company state');knowledgeView.window.close();
// Heat controls, freshness generation and URL mode consistency.
{
const hd2=await makeDom(true,undefined,'?company=fixture-company&workspace=whiteboard');const hw2=hd2.window,hdoc=hw2.document;
check(hdoc.querySelectorAll('#workspace-heat-mode').length===1,'exactly one heat select exists');
check(hdoc.getElementById('ff-heat-controls').contains(hdoc.getElementById('workspace-heat-mode')),'heat select is reparented into persistent canvas controls');
check(new hw2.URL(hw2.location.href).searchParams.get('workspace')==='whiteboard','intentional supported legacy mode is reflected in URL');
hdoc.getElementById('workspace-heat-mode').value='attention';hdoc.getElementById('workspace-heat-mode').dispatchEvent(new hw2.Event('change',{bubbles:true}));await flush();
check(hw2.localStorage.getItem('daftar-studio-heat')==='attention','heat preference persists');
hdoc.getElementById('ff-nav-table').click();await flush();
const q1=new hw2.URL(hw2.location.href).searchParams;check(!q1.has('workspace')&&!q1.has('ceo')&&!q1.has('company'),'Conference table clears mode and company parameters');
hdoc.getElementById('ff-nav-roadmap').click();await flush();
hdoc.querySelector('[data-workspace-tab="whiteboard"]').click();await flush();
check(new hw2.URL(hw2.location.href).searchParams.get('workspace')==='whiteboard','legacy whiteboard tab serializes workspace=whiteboard');
hdoc.getElementById('ceo-toggle').click();await flush();
const qc=new hw2.URL(hw2.location.href).searchParams;check(qc.get('ceo')==='true'&&!qc.has('workspace'),'CEO open serializes ceo=true only');
hdoc.getElementById('ceo-toggle').click();await flush();
check(new hw2.URL(hw2.location.href).searchParams.get('workspace')==='whiteboard','CEO close records resulting workspace');
const rl=await makeDom(true,undefined,'?company=fixture-company&workspace=whiteboard');check(rl.window.document.querySelector('[data-workspace-tab="whiteboard"]').getAttribute('aria-selected')==='true','reload from serialized URL opens whiteboard');rl.window.close();
hd2.window.close();
const ceoq=await makeDom(true,undefined,'?ceo=true');const cw=ceoq.window;cw.document.getElementById('ff-nav-table').click();await flush();
check(!new cw.URL(cw.location.href).searchParams.has('ceo'),'Conference table clears CEO mode');ceoq.window.close();
}
// Company hierarchy form.
{
const pd=await makeDom(true);const pw=pd.window,pdoc=pw.document,pf=pw.__atlasFixture;const pel=(i)=>pdoc.getElementById(i);
pdoc.querySelector('.nav-item[data-view="office"]').click();await flush();
check(!!pel('company-parent-form')&&!!pel('company-parent-select')&&!!pel('company-parent-submit'),'parent form elements exist');
check(pdoc.querySelector('label[for="company-parent-select"]')!==null,'parent select has a visible label');
check(!Array.from(pel('company-parent-select').options).some(o=>o.value==='fixture-company'),'self absent from parent options');
const pcalls=()=>pf.calls.filter(c=>c.name==='officeCommand'&&c.args.action==='set_company_parent');
const before=pcalls().length;
const other=Array.from(pel('company-parent-select').options).find(o=>o.value);
if(other){pel('company-parent-select').value=other.value;pel('company-parent-select').dispatchEvent(new pw.Event('change',{bubbles:true}));await flush();check(pcalls().length===before,'choosing a parent alone sends no command');}
pel('company-parent-form').dispatchEvent(new pw.SubmitEvent('submit',{bubbles:true,cancelable:true}));await flush();
check(pcalls().length===before+1&&pcalls()[before].args.companyId==='fixture-company','explicit submit sends one set_company_parent for the selected child');
const deptChild=pel('department-parent-child'),deptParent=pel('department-parent-select');
check(!!deptChild&&!!deptParent,'department hierarchy editor is mounted in the active workspace');
check(!Array.from(deptParent.options).some(o=>o.value&&o.value===deptChild.value),'department parent options exclude the department itself');
const deptCalls=()=>pf.calls.filter(c=>c.name==='officeCommand'&&c.args.action==='set_department_parent');
const departmentId=deptChild.value;
deptParent.dispatchEvent(new pw.Event('change',{bubbles:true}));await flush();
check(deptCalls().length===0,'changing department parent sends no command before explicit submit');
pel('department-parent-form').dispatchEvent(new pw.SubmitEvent('submit',{bubbles:true,cancelable:true}));await flush();
check(deptCalls().length===1&&deptCalls()[0].args.departmentId===departmentId&&deptCalls()[0].args.parentDepartmentId===null,'department parent submit uses the selected stable identity and explicit null root');
pd.window.close();
const pub=await makeDom(true,'public-preview');pub.window.document.querySelector('.nav-item[data-view="office"]').click();await flush();
pub.window.document.getElementById('company-parent-form').dispatchEvent(new pub.window.SubmitEvent('submit',{bubbles:true,cancelable:true}));await flush();
check(pub.window.__atlasFixture.calls.filter(c=>c.name==='officeCommand'&&c.args.action==='set_company_parent').length===0,'public preview submit makes zero commands');
pub.window.document.getElementById('department-parent-form').dispatchEvent(new pub.window.SubmitEvent('submit',{bubbles:true,cancelable:true}));await flush();
check(pub.window.__atlasFixture.calls.filter(c=>c.name==='officeCommand'&&c.args.action==='set_department_parent').length===0,'public department hierarchy submit makes zero commands');pub.window.close();
}
// Parent portal label via describeNode.
{
const lw=(await makeDom(true)).window;const loader=createModuleLoader(lw,rendererRoot);const sc=loader.run('freeflow/scene.js');
const base={id:'x',kind:'reference',entityId:'e',companyId:'c',parentId:null,label:'Synthetic',subtitle:'Parent company (organizational link)',status:'portal',rect:{x:0,y:0,width:1,height:1},counts:{}};
const portal=sc.describeNode({...base,metadata:{portal:true,role:'parent',organizational:true}});
check(portal.startsWith('Parent company link')&&!portal.includes('Contracted staff'),'org parent portal announces company relationship');
const staff=sc.describeNode({...base,subtitle:'Reviewer',status:'contracted',employeeId:'emp',contractId:'k',metadata:{reference:true}});
check(staff.startsWith('Contracted staff reference'),'real contract reference keeps staff label');
lw.close();
}
// Endless-canvas integration: existing forms, Donna options and authority are live world elements.
{
const dd=await makeDom(true,undefined,'?company=fixture-company');const dw=dd.window,ddoc=dw.document,df=dw.__atlasFixture;const de=(id)=>ddoc.getElementById(id);
const panel=(id)=>ddoc.querySelector(`.canvas-panel[data-panel-id="${id}"]`);
const surface=async(id)=>{ddoc.querySelector(`.canvas-shortcut[data-canvas-open="${id}"]`).click();await flush();};
const world=ddoc.querySelector('.ff-world');const cmdBefore=df.calls.filter(c=>c.name==='officeCommand').length;
await surface('donna');de('chat-message').value='Keep this unsent brief';
await surface('workspace-blueprint');de('office-blueprint').querySelector('.blueprint-room-title').click();de('room-name').value='Unsent room plan';de('room-name').dispatchEvent(new dw.Event('input',{bubbles:true}));
check(!panel('donna').hidden&&!panel('workspace-blueprint').hidden&&world.contains(panel('donna'))&&world.contains(panel('workspace-blueprint')),'conversation and blueprint forms coexist inside one world');
await surface('settings');await surface('donna');
check(de('chat-message').value==='Keep this unsent brief'&&de('room-name').value==='Unsent room plan','navigating between world surfaces preserves both unsaved forms');
const currentIds=Array.from(ddoc.querySelectorAll('[id]')).map(node=>node.id);check(new Set(currentIds).size===currentIds.length,'reparented surfaces retain unique DOM identities');
const grip=panel('donna').querySelector('.canvas-panel-grip'),beforeMove=panel('donna').style.transform;
grip.dispatchEvent(new dw.KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true,cancelable:true}));await flush();
check(panel('donna').style.transform!==beforeMove&&ddoc.querySelector('.ff-world')===world,'Donna moves in world coordinates without replacing the canvas');
const arrow=new dw.KeyboardEvent('keydown',{key:'ArrowLeft',bubbles:true,cancelable:true});de('chat-message').dispatchEvent(arrow);check(!arrow.defaultPrevented,'text input arrow keys retain native editing behavior');
panel('donna').querySelector('.canvas-panel-pin').click();const pinned=panel('donna').style.transform;
grip.dispatchEvent(new dw.KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true,cancelable:true}));check(panel('donna').style.transform===pinned,'Donna panel position lock prevents keyboard movement');panel('donna').querySelector('.canvas-panel-pin').click();
de('donna-options-toggle').click();check(!de('donna-options-menu').classList.contains('hidden')&&de('donna-options-toggle').getAttribute('aria-expanded')==='true','Donna options remain attached to the world conversation');
de('donna-options-menu').dispatchEvent(new dw.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));check(de('donna-options-menu').classList.contains('hidden')&&ddoc.activeElement===de('donna-options-toggle'),'Escape closes Donna options and restores focus');
de('donna-options-toggle').click();ddoc.querySelector('[data-donna-option="collapse"]').click();await flush();
check(panel('donna').hidden&&de('donna-dock-toggle').getAttribute('aria-expanded')==='false','Donna collapse closes its world element and updates the persistent launcher');
de('donna-dock-toggle').click();await flush();check(!panel('donna').hidden&&de('chat-message').value==='Keep this unsent brief'&&ddoc.querySelectorAll('#workspace-chat-form').length===1,'Donna reopening retains the exact unsent conversation');
de('donna-options-toggle').click();ddoc.querySelector('[data-donna-option="scope"]').click();await flush();check(ddoc.activeElement===de('chat-scope')&&de('chat-message').value==='Keep this unsent brief','Donna scope entry focuses the existing live scope selector');
de('donna-options-toggle').click();ddoc.querySelector('[data-donna-option="keys"]').click();await flush();check(!panel('settings').hidden&&world.contains(de('key-rows')),'API keys open within the world settings surface');
de('donna-options-toggle').click();ddoc.querySelector('[data-donna-option="connections"]').click();await flush();check(!panel('settings').hidden&&world.contains(de('cloud-connection-panel')),'runtime connections remain a world element');
de('donna-options-toggle').click();ddoc.querySelector('[data-donna-option="agents"]').click();await flush();check(!panel('crew').hidden&&world.contains(de('canvas-crew-list')),'Donna agents opens the scoped crew in the world');
const donnaRow=de('canvas-crew-list').querySelector('[data-role="donna"]');const authority=Array.from(donnaRow.querySelectorAll('button')).find(button=>button.textContent==='Authority');check(Boolean(authority),'configured Donna exposes the existing authority editor');authority.click();await flush();
check(!panel('portfolio').hidden&&de('ceo-authority-editor').open&&ddoc.activeElement===de('authority-employee'),'crew authority focuses the real authority form inside its world surface');
let hiddenAncestor=false;for(let node=de('authority-employee');node&&node!==ddoc.body;node=node.parentElement)if(node.hidden||node.classList.contains('hidden'))hiddenAncestor=true;
check(!hiddenAncestor&&ddoc.body.classList.contains('endless-canvas')&&!de('freeflow-surface').classList.contains('hidden'),'authority controls have no hidden ancestors and retain the canvas');
check(df.calls.filter(c=>c.name==='officeCommand').length===cmdBefore,'world movement and entry actions do not issue native mutations');
// Confirmed private website links retain their existing validation.
de('donna-options-toggle').click();ddoc.querySelector('[data-donna-option="team"]').click();await flush();
check(df.calls.filter(c=>c.name==='openExternal').length===0&&de('donna-options-status').textContent.includes('Setup required'),'unconfigured website access has an honest setup state');
de('cloud-url').value='https://site.example.test/path?x=1#h';de('cloud-device-token').value='fixture-token';de('cloud-connect-form').dispatchEvent(new dw.SubmitEvent('submit',{bubbles:true,cancelable:true}));await flush();await flush();
de('donna-options-toggle').click();ddoc.querySelector('[data-donna-option="team"]').click();await flush();
const opens=df.calls.filter(c=>c.name==='openExternal');check(opens.length===1&&opens[0].args.url==='https://site.example.test/access','desktop website access uses the confirmed HTTPS origin without paths, query, fragments or credentials');
de('cloud-url').value='https://user:pw@site.example.test';de('donna-options-toggle').click();ddoc.querySelector('[data-donna-option="team"]').click();await flush();check(df.calls.filter(c=>c.name==='openExternal').every(c=>c.args.url==='https://site.example.test/access'),'an unsaved credential-bearing draft cannot redirect the confirmed website');
check(df.calls.filter(c=>c.name==='officeCommand').every(c=>c.args.action!=='post_chat'),'presentation controls never post the retained draft');
await surface('source-review');check(!panel('source-review').hidden&&de('canvas-source-reports').textContent.includes('Connect the desktop or VPS runtime'),'unreported source review is shown as unavailable, not clean');
check(panel('source-review').textContent.includes('General website crawling is not connected'),'source review does not claim an implemented website crawler');
const layout=dw.localStorage.getItem('daftar.endless-workspace.layout.v1');check(layout&&!layout.includes('Keep this unsent brief')&&!layout.includes('Unsent room plan')&&!layout.includes('fixture-token'),'layout persistence contains no conversation, editor draft or credential');
// Closing a world element cancels a captured drag without allowing a late pointer move.
await surface('donna');let captures=0,releases=0;grip.setPointerCapture=()=>captures++;grip.releasePointerCapture=()=>releases++;
const pointer=(type,x,y)=>{const event=new dw.Event(type,{bubbles:true,cancelable:true});Object.assign(event,{pointerId:9,clientX:x,clientY:y,button:0});return event;};
grip.dispatchEvent(pointer('pointerdown',100,100));grip.dispatchEvent(pointer('pointermove',160,150));panel('donna').querySelector('.canvas-panel-close').click();await flush();const positionAfterClose=panel('donna').style.transform;dw.dispatchEvent(pointer('pointermove',800,700));
check(captures===1&&releases===1&&panel('donna').style.transform===positionAfterClose,'closing Donna releases capture and rejects late gesture writes');
await surface('donna');check(de('chat-message').value==='Keep this unsent brief','cancelled drag and close retain the draft');
dd.window.close();
}
// Scoped crew actions use the native employee-command envelope, never an implicit owner action.
{
const cd=await makeDom(true,undefined,'?company=fixture-company',w=>{
 const fx=w.__atlasFixture;fx.office.authority.grants.push({id:'crew-grant',employeeId:'donna',scope:{kind:'company',id:'fixture-company'},capabilities:['work.manage','team.manage'],issuer:'owner',grantedAt:new Date(Date.now()-60000).toISOString(),expiresAt:new Date(Date.now()+3600000).toISOString(),revokedAt:null,parentGrantIds:[]});
 const worker=w.desktopBridge.officeWorkerStatus;w.desktopBridge.officeWorkerStatus=async()=>({...await worker(),sourceReviews:[{companyId:'fixture-company',jobId:'source-job',coverage:'partial',handoff:{state:'needs-review',reason:'Embedded command <img src=x onerror=alert(1)>'},artifactUri:'/fixture/source-review.json'},{companyId:'another-company',jobId:'secret-job',coverage:'full',handoff:{state:'needs-review',reason:'Other company private finding'}}]});
});
const cw=cd.window,doc=cw.document,fx=cw.__atlasFixture,ce=id=>doc.getElementById(id);doc.querySelector('.canvas-shortcut[data-canvas-open="crew"]').click();await flush();
check(ce('canvas-crew-actor').querySelector('option[value="crew:donna:donna"]')&&!ce('canvas-crew-submit').disabled,'current company Donna is selectable for recorded scoped actions');
ce('canvas-crew-actor').value='crew:donna:donna';ce('canvas-crew-intent').value='plan-work';ce('canvas-crew-title').value='A bounded crew plan';ce('canvas-crew-form').dispatchEvent(new cw.SubmitEvent('submit',{bubbles:true,cancelable:true}));await flush();
const delegated=fx.calls.filter(c=>c.name==='officeCommand'&&c.args.action==='apply_employee_command').at(-1)?.args;
check(delegated?.employeeId==='donna'&&delegated?.command.action==='create_goal'&&delegated?.command.scope.kind==='company'&&delegated?.command.scope.id==='fixture-company'&&delegated?.command.mode==='plan','crew planning reaches the supported native employee command with its exact company scope');
check(fx.office.jobs.length===0,'crew planning does not manufacture provider execution');
let rejected=0;const original=cw.desktopBridge.officeCommand;cw.desktopBridge.officeCommand=async command=>command.action==='apply_employee_command'?(rejected++,{ok:false,snapshot:null,error:'Fixture native authority rejected the expired grant.'}):original(command);
ce('canvas-crew-form').dispatchEvent(new cw.SubmitEvent('submit',{bubbles:true,cancelable:true}));await flush();check(rejected===1&&ce('canvas-crew-result').textContent.includes('native authority rejected'),'native scope/expiry rejection is displayed without claiming success');
fx.office.authority.grants[0].expiresAt='2020-01-01T00:00:00.000Z';ce('office-refresh').click();await flush();ce('canvas-crew-form').dispatchEvent(new cw.SubmitEvent('submit',{bubbles:true,cancelable:true}));await flush();check(rejected===1&&ce('canvas-crew-result').textContent.includes('active authority grant'),'a visibly expired grant is held before dispatch');
check(ce('canvas-source-reports').textContent.includes('Donna review requested')&&ce('canvas-source-reports').textContent.includes('Embedded command <img src=x onerror=alert(1)>')&&!ce('canvas-source-reports').querySelector('img'),'flagged source review remains inert text with its recorded status');
check(!ce('canvas-source-reports').textContent.includes('Other company private finding')&&!ce('canvas-source-reports').textContent.includes('secret-job'),'source reports remain scoped to the selected company');
check(ce('canvas-crew-list').querySelector('[data-role="source-reviewer"]').dataset.state==='runtime-service','reported deterministic source review is distinguished from a hired or running model employee');
cd.window.close();
}
// Model polling follows the open canvas element, not the former page selection.
{
let reads=0;const timers=new Map();let nextTimer=-1;const md=await makeDom(true,undefined,'',w=>{
 const set=w.setTimeout.bind(w),clear=w.clearTimeout.bind(w);w.setTimeout=(fn,ms,...args)=>{if(ms!==3000)return set(fn,ms,...args);const id=nextTimer--;timers.set(id,()=>fn(...args));return id;};w.clearTimeout=id=>{if(timers.has(id))timers.delete(id);else clear(id);};
 w.desktopBridge.modelPoolSnapshot=async({companyId})=>{reads++;return{ok:true,snapshot:{companyId,available:true,enabled:true,endpoint:'http://127.0.0.1:11434',infrastructureCost:'separate',catalog:[],models:[],requests:[{id:'pull',companyId,employeeId:'donna',model:'fixture-model',status:'pulling',completedBytes:1,totalBytes:10,error:null}],assignments:[],error:null}};};
});const doc=md.window.document;doc.querySelector('.canvas-shortcut[data-canvas-open="models"]').click();await flush();check(reads>0&&timers.size===1,'opening model management starts one pending-download refresh timer');
doc.querySelector('.canvas-shortcut[data-canvas-open="settings"]').click();await flush();check(timers.size===1&&!doc.querySelector('.canvas-panel[data-panel-id="models"]').hidden,'opening another surface preserves visible model monitoring');
const stale=[...timers.values()][0];doc.querySelector('.canvas-panel[data-panel-id="models"] .canvas-panel-close').click();await flush();const before=reads;stale();await flush();check(timers.size===0&&reads===before,'closing model management stops polling and rejects a late timer callback');md.window.close();
}
// Launchers refresh their own data and live events update every open surface.
{
let projectEvent,jobEvent,vaultReads=0;let background=[];
const live=await makeDom(true,undefined,'',w=>{
 const fx=w.__atlasFixture,at=new Date().toISOString();
 fx.projects.push({id:'live-project',name:'Live canvas project',goal:'Fixture only',provider:'anthropic',model:'fixture-model',nodes:[],createdAt:at,updatedAt:at});
 fx.company.index={fileCount:1,totalBytes:123,workers:1,elapsedMs:2,truncated:false,files:[{path:'docs/canvas-fixture.md',kind:'markdown',bytes:123}]};
 const vault=w.desktopBridge.getVaultStatus;w.desktopBridge.getVaultStatus=async()=>{vaultReads++;return vault();};
 w.desktopBridge.onProjectEvent=callback=>{projectEvent=callback;return()=>{};};w.desktopBridge.onJobEvent=callback=>{jobEvent=callback;return()=>{};};
 w.desktopBridge.getJobStatus=async()=>background;
});const lw=live.window,doc=lw.document,le=id=>doc.getElementById(id);
const open=async id=>{doc.querySelector(`.canvas-shortcut[data-canvas-open="${id}"]`).click();await flush();await flush();};
await open('projects');check(le('project-list').textContent.includes('Live canvas project'),'fresh launcher entry loads its saved projects without legacy page navigation');le('project-list').querySelector('button').click();await flush();
const beforeVault=vaultReads;await open('settings');check(vaultReads>beforeVault&&le('key-rows').textContent.includes('GitHub'),'settings launcher refreshes vault metadata on its live surface');
await open('library');check(le('index-files').textContent.includes('docs/canvas-fixture.md'),'library launcher renders the current repository index');
await open('overview');await open('usage');await open('models');await open('settings');
const at=new Date().toISOString();projectEvent({id:'canvas-live-run',projectId:'live-project',status:'running',terminationReason:null,error:null,usage:{inputTokens:20,outputTokens:10,costUsd:.5,elapsedSeconds:1},nodeStates:{},createdAt:at,updatedAt:at,finishedAt:null});await flush();
check(le('run-state-pill').textContent==='running'&&!le('run-pause').disabled,'a visible project surface consumes native run events while another surface has focus');
check(le('usage-runs').textContent==='1'&&le('usage-cost').textContent==='$0.50','the simultaneously open usage surface reflects the same run event');
background=[{id:'background-canvas',kind:'download',status:'completed',progress:1,detail:'Fixture download completed',error:null,createdAt:at,updatedAt:at}];jobEvent();await flush();
check(le('jobs-table').textContent.includes('Fixture download completed'),'an open model surface consumes background events while settings is focused');
const canvas=doc.querySelector('.ff-world');for(const id of ['projects','settings','library','overview','usage','models'])check(canvas.contains(doc.querySelector(`.canvas-panel[data-panel-id="${id}"]`))&&!doc.querySelector(`.canvas-panel[data-panel-id="${id}"]`).hidden,`live event surfaces remain together in the world: ${id}`);
live.window.close();
}
// Restoring open geometry also activates each surface's data lifecycle after mount.
{
let modelReads=0;
const savedPanels=['projects','settings','models','library'];
const restored=await makeDom(true,undefined,'',w=>{
 const fx=w.__atlasFixture,at=new Date().toISOString();
 fx.projects.push({id:'restored-project',name:'Restored canvas project',goal:'Fixture only',provider:'anthropic',model:'fixture-model',nodes:[],createdAt:at,updatedAt:at});
 fx.company.index={fileCount:1,totalBytes:10,workers:1,elapsedMs:1,truncated:false,files:[{path:'docs/restored-canvas.md',kind:'markdown',bytes:10}]};
 w.localStorage.setItem('daftar.endless-workspace.layout.v1',JSON.stringify({version:1,activeId:'projects',panels:savedPanels.map((id,z)=>({id,open:true,collapsed:false,pinned:id==='projects',z,rect:{x:1600+z*1000,y:2000,width:800,height:600}}))}));
 w.desktopBridge.modelPoolSnapshot=async({companyId})=>{modelReads++;return{ok:true,snapshot:{companyId,available:true,enabled:true,endpoint:'http://127.0.0.1:11434',infrastructureCost:'separate',catalog:[],models:[],requests:[{id:'restored-pull',companyId,employeeId:'donna',model:'fixture-model',status:'pulling',completedBytes:1,totalBytes:10,error:null}],assignments:[],error:null}};};
});await flush();const doc=restored.window.document;
for(const id of savedPanels)check(!doc.querySelector(`.canvas-panel[data-panel-id="${id}"]`).hidden,`saved open surface is restored without navigation: ${id}`);
check(doc.getElementById('project-list').textContent.includes('Restored canvas project'),'restored project surface loads its saved records without reopening');
check(doc.getElementById('key-rows').textContent.includes('GitHub'),'restored settings surface loads vault metadata without reopening');
check(doc.getElementById('index-files').textContent.includes('docs/restored-canvas.md'),'restored library surface receives the loaded repository index');
check(modelReads>0&&doc.getElementById('shared-model-pool').textContent.includes('fixture-model'),'restored model surface starts monitoring after company scope loads');
check(doc.querySelector('.canvas-panel[data-panel-id="projects"]').classList.contains('is-pinned'),'saved position lock survives data activation');
restored.window.close();
const portal=await makeDom(true,'cloud-browser','?company=fixture-company',w=>{
 w.localStorage.setItem('daftar.endless-workspace.layout.v1',JSON.stringify({version:1,activeId:'access',panels:[{id:'access',open:true,rect:{x:1600,y:2000,width:900,height:700}}]}));
});const pd=portal.window.document,frame=pd.querySelector('.canvas-panel[data-panel-id="access"] iframe');
check(!pd.querySelector('.canvas-panel[data-panel-id="access"]').hidden&&frame.getAttribute('src')==='/access?canvas=1&company=fixture-company','a restored website surface starts its allowlisted local portal with company scope');
check(!pd.querySelector('.canvas-panel[data-panel-id="applications"] iframe').hasAttribute('src'),'closed website surfaces remain unloaded after restoration');
portal.window.close();
}
// The same controls remain read-only after forms move into the world.
{
const pv=await makeDom(true,'public-preview');const pw=pv.window,doc=pw.document,fx=pw.__atlasFixture;
for(const id of ['donna','crew','office-people','office-memory','workspace-decisions','portfolio','settings']){doc.querySelector(`.canvas-shortcut[data-canvas-open="${id}"]`).click();await flush();}
for(const id of ['chat-send','canvas-crew-submit','canvas-dispatch-toggle','decision-create','cloud-connect','editor-pair','ceo-optimize','authority-grant-submit'])check(doc.getElementById(id).disabled,`read-only world control stays disabled: ${id}`);
for(const id of ['office-create-company','office-create-office','office-create-department','office-hire-form','office-queue-form','office-knowledge-form'])check(doc.getElementById(id).querySelector('button[type="submit"]').disabled,`read-only reparented form stays disabled: ${id}`);
const before=fx.calls.filter(c=>c.name==='officeCommand').length;doc.getElementById('canvas-crew-form').dispatchEvent(new pw.SubmitEvent('submit',{bubbles:true,cancelable:true}));await flush();check(fx.calls.filter(c=>c.name==='officeCommand').length===before,'synthetic submit cannot bypass read-only crew restrictions');
doc.getElementById('donna-options-toggle').click();doc.querySelector('[data-donna-option="team"]').click();await flush();check(fx.calls.filter(c=>c.name==='openExternal').length===0,'public preview acquires no website access through Donna options');pv.window.close();
const denied=await makeDom(true,undefined,'',w=>{Object.defineProperty(w,'localStorage',{value:{getItem(){throw Error('denied');},setItem(){throw Error('denied');}},configurable:true});});denied.window.document.querySelector('.canvas-shortcut[data-canvas-open="donna"]').click();await flush();check(denied.window.document.querySelectorAll('#workspace-chat-form').length===1&&!denied.window.document.querySelector('.canvas-panel[data-panel-id="donna"]').hidden,'blocked layout storage leaves the world and Donna usable');denied.window.close();
const invalid=await makeDom(true,undefined,'',w=>Object.assign(w.__atlasFixture.cloud,{configured:true,connected:true,url:'https://user:pw@site.example.test'}));const iw=invalid.window,idoc=iw.document;idoc.querySelector('.canvas-shortcut[data-canvas-open="settings"]').click();await flush();idoc.querySelector('.canvas-shortcut[data-canvas-open="donna"]').click();idoc.getElementById('donna-options-toggle').click();idoc.querySelector('[data-donna-option="team"]').click();await flush();check(iw.__atlasFixture.calls.filter(c=>c.name==='openExternal').length===0,'credential-bearing confirmed website opens no external page');invalid.window.close();
}
// Final concurrency review: visible surface drafts and scope ownership survive unrelated work.
{
const owner=await makeDom(),ow=owner.window,doc=ow.document,fx=ow.__atlasFixture;
for(const id of ['policy','office-memory','portfolio','donna']){doc.querySelector(`.canvas-shortcut[data-canvas-open="${id}"]`).click();await flush();}
doc.getElementById('workspace-policy').open=true;doc.getElementById('ceo-policy-editor').open=true;
for(const [id,text] of [['workspace-global-usd','73'],['cache-max-entries','96'],['ceo-policy-title','Unsent CEO policy title']]){
 const field=doc.getElementById(id);field.focus();field.value=text;field.dispatchEvent(new ow.Event('input',{bubbles:true}));
}
doc.getElementById('chat-message').focus();doc.getElementById('office-refresh').click();await flush();
check(doc.getElementById('workspace-global-usd').value==='73','an unfinished budget survives refresh after focus moves to another canvas element');
check(doc.getElementById('cache-max-entries').value==='96','an unfinished cache policy survives refresh while another canvas element has focus');
check(doc.getElementById('ceo-policy-title').value==='Unsent CEO policy title','an unfinished CEO policy survives refresh while another canvas element has focus');
const policy=doc.getElementById('workspace-policy-form');policy.dispatchEvent(new ow.SubmitEvent('submit',{bubbles:true,cancelable:true,submitter:policy.querySelector('button[type="submit"]')}));await flush();
check(fx.office.policy.budget.hardCapUsd===73,'the retained budget is the value submitted to the native command');
fx.office.policy.budget.hardCapUsd=84;doc.getElementById('chat-message').focus();doc.getElementById('office-refresh').click();await flush();
check(doc.getElementById('workspace-global-usd').value==='84','a confirmed policy save releases draft protection for subsequent native updates');owner.window.close();

const readonly=await makeDom(true,'public-preview'),rw=readonly.window,rd=rw.document,rf=rw.__atlasFixture;
for(const id of ['office-overview','scope'])rd.querySelector(`.canvas-shortcut[data-canvas-open="${id}"]`).click();
const before=rf.calls.filter(call=>call.name==='officeCommand').length;
rd.getElementById('office-company-search').value='Fixture';rd.getElementById('office-company-search').dispatchEvent(new rw.Event('input',{bubbles:true}));
for(const id of ['office-pause-company','office-pause-office']){check(rd.getElementById(id).disabled,`read-only scope search preserves mutation disabling: ${id}`);rd.getElementById(id).click();}
check(rf.calls.filter(call=>call.name==='officeCommand').length===before,'read-only pause controls dispatch no command after a scope-only rerender');readonly.window.close();

const scope=await makeDom(true,'cloud-browser','?company=fixture-company',w=>{
 const office=w.__atlasFixture.office;
 office.companies.push({...office.companies[0],id:'canvas-company-b',name:'Canvas company B'});
 office.offices.push({...office.offices[0],id:'canvas-office-b',companyId:'canvas-company-b',name:'Canvas office B'});
});const sw=scope.window,sd=sw.document,sf=sw.__atlasFixture;
const select=async id=>{sd.getElementById('office-company-select').value=id;sd.getElementById('office-company-select').dispatchEvent(new sw.Event('change',{bubbles:true}));await flush();await flush();};
await select('canvas-company-b');
check(sd.getElementById('locator-company').textContent==='Canvas company B','a company switch is canonically confirmed before opening website surfaces');
sd.querySelector('.canvas-shortcut[data-canvas-open="access"]').click();await flush();
check(sd.querySelector('.canvas-panel[data-panel-id="access"] iframe').getAttribute('src')==='/access?canvas=1&company=canvas-company-b','first website access opening uses the current confirmed company rather than the boot URL company');
const stale=structuredClone(sf.office);let release;sw.desktopBridge.officeSnapshot=()=>new Promise(resolve=>{release=()=>resolve({ok:true,snapshot:stale});});
sd.getElementById('office-refresh').click();await flush();check(typeof release==='function','the scope race fixture has a pending old snapshot read');
await select('fixture-company');
check(sd.getElementById('office-company-select').value==='fixture-company'&&new URL(sw.location.href).searchParams.get('company')==='fixture-company','the newer company selection is confirmed while the old read remains pending');
release();await flush();
check(sd.getElementById('office-company-select').value==='fixture-company'&&sd.getElementById('locator-company').textContent==='Fixture Engineering'&&new URL(sw.location.href).searchParams.get('company')==='fixture-company','a stale pre-switch snapshot cannot split panel scope from the focused world and URL');
scope.window.close();
}
// Initial routes wait for the coalesced native read and frame the actual requested
// surface after scope resolution. Geometry here checks camera coordination only;
// the browser release gate measures the real first-viewport composer rectangle.
for(const interacted of [false,true]){
 let releaseInitial,reads=0;
 const initial=await makeDom(true,undefined,'?company=initial-company-b&workspace=chat#office',w=>{
  const office=w.__atlasFixture.office;
  office.companies.push({...office.companies[0],id:'initial-company-b',name:'Initial company B'});
  office.offices.push({...office.offices[0],id:'initial-office-b',companyId:'initial-company-b',name:'Initial office B'});
  const snapshot=w.desktopBridge.officeSnapshot;
  w.desktopBridge.officeSnapshot=()=>{reads++;return new Promise(resolve=>{releaseInitial=async()=>resolve(await snapshot());});};
  Object.defineProperty(w.HTMLElement.prototype,'clientWidth',{configurable:true,get:()=>1280});
  Object.defineProperty(w.HTMLElement.prototype,'clientHeight',{configurable:true,get:()=>720});
  w.Element.prototype.getClientRects=function(){return[this.getBoundingClientRect()];};
  w.matchMedia=query=>({matches:query.includes('prefers-reduced-motion'),media:query,addEventListener(){},removeEventListener(){}});
 });
 const iw=initial.window,idoc=iw.document,world=idoc.querySelector('.ff-world');
 check(reads===1&&typeof releaseInitial==='function','startup waits on one shared native snapshot request');
 if(interacted){
  idoc.querySelector('.canvas-shortcut[data-canvas-open="scope"]').dispatchEvent(new iw.Event('pointerdown',{bubbles:true}));
  idoc.querySelector('.canvas-shortcut[data-canvas-open="scope"]').click();
 }
 await releaseInitial();await flush();await flush();
 check(idoc.getElementById('office-company-select').value==='initial-company-b'&&new URL(iw.location.href).searchParams.get('company')==='initial-company-b','a delayed startup snapshot resolves the requested company before the deep link settles');
 if(interacted){
  check(idoc.querySelector('.canvas-panel[data-panel-id="scope"]').classList.contains('is-active'),'startup completion does not reactivate Donna after a user chooses another surface');
 }else{
  const framed=world.style.transform;
  idoc.querySelector('.canvas-shortcut[data-canvas-open="donna"]').click();await flush();
  check(framed===world.style.transform&&!framed.includes('rotateX'),'resolved chat deep link uses the same readable camera as opening Donna explicitly');
  const before=world.style.transform;idoc.getElementById('office-refresh').click();await flush();await releaseInitial();await flush();
  check(world.style.transform===before,'later native refresh retains the settled Donna camera');
 }
 initial.window.close();
}

// Board-flow regression: edit bases are immutable, links are plural, and cancellation never saves.
{
 const attempts=[];
 const boardDom=await makeDom(true,undefined,'',bw=>{
  const f=bw.__atlasFixture;
  f.office.blueprints[0].whiteboards=[{id:'linked-board',revision:7,roomId:'fixture-room',ownerEmployeeId:'donna',title:'All linked work',goalIds:['goal-a','goal-b'],jobIds:['job-a','job-b'],roadmapItemIds:['outcome-a','outcome-b'],x:.3,y:.4}];
  const base=bw.desktopBridge.officeCommand;
  bw.desktopBridge.officeCommand=async request=>{
   if(request.action==='upsert_whiteboard'){
    attempts.push(JSON.parse(JSON.stringify(request)));
    const saved=f.office.blueprints[0].whiteboards.find(item=>item.id===request.id);
    if(saved&&request.expectedRevision!==(saved.revision||0))return{ok:false,error:'STALE_REVISION: the saved whiteboard changed.'};
    const revision=(saved?.revision||0)+1,result=await base(request);
    f.office.blueprints[0].whiteboards.find(item=>item.id===request.id).revision=revision;
    result.snapshot.blueprints[0].whiteboards.find(item=>item.id===request.id).revision=revision;
    return result;
   }
   return base(request);
  };
 });
 const bw=boardDom.window,bd=bw.document,bf=bw.__atlasFixture,bid=id=>bd.getElementById(id);
 const press=async id=>{bid(id).click();await flush();};
 const save=async()=>{bid('workspace-node-form').dispatchEvent(new bw.SubmitEvent('submit',{bubbles:true,cancelable:true,submitter:bid('node-save')}));await flush();};
 const type=(id,text)=>{bid(id).value=text;bid(id).dispatchEvent(new bw.Event('input',{bubbles:true}));};
 await press('workspace-tab-whiteboard');bd.querySelector('[data-board-id="linked-board"] .card-title').click();
 check(bid('node-goal-links').children.length===2&&bid('node-job-links').children.length===2&&bid('node-roadmap-links').children.length===2,'multi-link editor shows every saved link, including unresolved references');
 type('node-title','Title-only edit');await save();
 check(attempts.length===1&&attempts[0].expectedRevision===7&&attempts[0].officeId==='fixture-office','whiteboard edit uses its frozen revision and office');
 check(attempts[0].goalIds.join(',')==='goal-a,goal-b'&&attempts[0].jobIds.join(',')==='job-a,job-b'&&attempts[0].roadmapItemIds.join(',')==='outcome-a,outcome-b','title-only save preserves all link arrays');
 type('node-title','Local unfinished draft');bf.office.blueprints[0].whiteboards[0].revision=10;bf.office.blueprints[0].whiteboards[0].title='External edit';await press('workspace-refresh');
 check(bid('node-title').value==='Local unfinished draft'&&bid('node-save-status').textContent.includes('draft'),'global refresh preserves the visible local draft');
 check(bd.querySelector('[data-board-id="linked-board"] .card-title').textContent==='External edit'&&bid('node-save-status').textContent.includes('changed after'),'global refresh reads the native board and exposes its external revision without replacing the draft');
 const staleBefore=attempts.length;await save();await flush();
 check(attempts.length===staleBefore+1&&attempts.at(-1).expectedRevision===8,'stale edit sends the original base once without rebasing or retry');
 check(bid('node-title').value==='Local unfinished draft'&&bid('node-save-status').textContent.includes('STALE_REVISION'),'stale rejection stays visible and retains the typed draft');
 await press('workspace-tab-softboard');await press('workspace-tab-whiteboard');check(bid('node-title').value==='Local unfinished draft','board navigation preserves the same live draft');
 await press('node-reload');check(bid('node-title').value==='External edit','explicit discard loads the new saved record');
 bid('node-goal-links').querySelector('button').click();await save();
 check(attempts.at(-1).expectedRevision===10&&attempts.at(-1).goalIds.join(',')==='goal-b'&&attempts.at(-1).jobIds.length===2,'explicit link removal affects exactly one selected relationship');
 const card=bd.querySelector('[data-board-id="linked-board"]'),handle=card.querySelector('.card-title'),left=card.style.left,top=card.style.top,count=attempts.length;
 const pointer=(type,x,y)=>{const event=new bw.MouseEvent(type,{button:0,clientX:x,clientY:y,bubbles:true,cancelable:true});Object.defineProperty(event,'pointerId',{value:17});return event;};
 handle.dispatchEvent(pointer('pointerdown',100,100));bw.dispatchEvent(pointer('pointermove',145,135));bw.dispatchEvent(pointer('pointercancel',145,135));bw.dispatchEvent(pointer('pointerup',145,135));await flush();
 check(attempts.length===count&&card.style.left===left&&card.style.top===top,'cancelled board drag restores paint and never submits a mutation');
 handle.dispatchEvent(pointer('pointerdown',100,100));bw.dispatchEvent(pointer('pointermove',145,135));
 check(card.classList.contains('is-moving')&&(card.style.left!==left||card.style.top!==top),'Escape regression begins with a nonzero inner-card preview');
 handle.dispatchEvent(new bw.KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));bw.dispatchEvent(pointer('pointerup',145,135));await flush();
 check(attempts.length===count&&!card.classList.contains('is-moving')&&card.style.left===left&&card.style.top===top,'card-targeted Escape wins over the surrounding scene and a later pointerup cannot save');
 handle.dispatchEvent(pointer('pointerdown',100,100));bw.dispatchEvent(pointer('pointermove',150,140));await press('office-refresh');bw.dispatchEvent(pointer('pointerup',150,140));await flush();
 check(attempts.length===count,'snapshot replacement disposes an active board gesture before a late pointerup');
 const movedHandle=bd.querySelector('[data-board-id="linked-board"] .card-title');movedHandle.click();movedHandle.dispatchEvent(new bw.KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true,cancelable:true}));await flush();const movedRevision=bf.office.blueprints[0].whiteboards[0].revision;type('node-title','Edit after acknowledged movement');await save();check(attempts.at(-1).expectedRevision===movedRevision,'an acknowledged own movement updates a clean editor base without creating a false stale edit');
 for(let index=0;index<100;index++)bf.office.blueprints[0].whiteboards.push({...bf.office.blueprints[0].whiteboards[0],id:`paged-${index}`,title:`Searchable card ${index}`,goalIds:[],jobIds:[],roadmapItemIds:[]});await press('office-refresh');
 check(bid('workspace-whiteboard').querySelectorAll('.ownership-card').length===24&&bid('whiteboard-page').textContent.includes('of 101'),'whiteboard DOM stays bounded with an honest complete count');
 type('whiteboard-search','Searchable card 99');check(bid('workspace-whiteboard').querySelector('[data-board-id="paged-99"]'),'search reaches a saved card beyond the old first-100 limit');
 check(bd.querySelector('.ff-world')?.contains(bid('workspace-panel-whiteboard')),'whiteboard remains a live element of the same endless world');
 boardDom.window.close();
}
// Greenboard is a view of canonical people/departments and pairs, without inferred access or dispatch.
{
 const peopleDom=await makeDom(true,undefined,'',pw=>{
  const f=pw.__atlasFixture,base=f.office.employees[0];
  f.office.departments.push({...f.office.departments[0],id:'nested-quality',name:'Release quality',parentDepartmentId:'fixture-department'});
  f.office.employees.push({...base,id:'paired-primary',name:'Primary engineer',role:'Engineer',companyId:'fixture-company',officeId:'fixture-office',departmentId:'nested-quality'},{...base,id:'paired-reviewer',name:'Independent reviewer',role:'Reviewer',companyId:'fixture-company',officeId:'fixture-office',departmentId:'nested-quality'});
  const goal={id:'paired-goal',companyId:'fixture-company',scope:{kind:'department',id:'nested-quality'},title:'Native paired outcome',description:'Fixture',mode:'plan',status:'planned',maxIterations:1,iteration:0,jobIds:[],steps:[{id:'paired-step',title:'Implement and verify',employeeId:'paired-primary',reviewerEmployeeId:'paired-reviewer',goal:'Fixture',dependsOn:[],estimate:{optimisticMinutes:5,likelyMinutes:10,pessimisticMinutes:20},reviewEstimate:{optimisticMinutes:2,likelyMinutes:3,pessimisticMinutes:5}}],runSettings:{mode:'manual'},createdAt:'2026-11-22T00:00:00Z',updatedAt:'2026-11-22T00:00:00Z'};
  f.office.goals.push(goal,{...goal,id:'foreign-goal',companyId:'not-this-company',title:'Foreign company secret'});
 });
 const pw=peopleDom.window,pd=pw.document,pf=pw.__atlasFixture,pid=id=>pd.getElementById(id);
 pid('office-department-select').value='fixture-department';pid('office-department-select').dispatchEvent(new pw.Event('change',{bubbles:true}));await flush();pid('workspace-tab-softboard').click();await flush();
 check(pd.querySelector('[data-employee-id="paired-primary"]')&&pid('workspace-softboard').textContent.includes('Engineering'),'parent department view includes a named nested department path');
 pd.querySelector('#workspace-softboard [data-employee-id="paired-primary"]').click();
 check(pid('softboard-person-detail').textContent.includes('Independent reviewer')&&pid('softboard-person-detail').textContent.includes('Native paired outcome'),'ownership inspector shows canonical primary/helper-reviewer assignments');
 check(!pid('softboard-person-detail').textContent.includes('Foreign company secret'),'paired responsibility detail stays in the selected company');
 const before=pf.calls.filter(call=>call.name==='officeCommand').length;pid('softboard-person-chat').click();await flush();
 check(pid('chat-scope').value==='employee'&&pid('chat-employee').value==='paired-primary','nested employee discussion opens the existing employee-scoped conversation');
 check(pf.calls.filter(call=>call.name==='officeCommand').length===before,'Greenboard navigation does not hire, grant, send or queue work');
 pid('workspace-tab-softboard').click();await flush();pid('softboard-descendants').checked=false;pid('softboard-descendants').dispatchEvent(new pw.Event('change'));await flush();
 check(pid('softboard-result-note').textContent.includes('Selected department only'),'exact department scope is explicitly identified');
 peopleDom.window.close();
}

// One atomic Donna command, including the lost-acknowledgement case.
{
 const attempts=[];let loseAcknowledgement=true;
 const atomic=await makeDom(true,undefined,'',aw=>{const base=aw.desktopBridge.officeCommand;aw.desktopBridge.officeCommand=async request=>{if(request.action==='create_paired_workflow'){attempts.push(JSON.parse(JSON.stringify(request)));const result=await base(request);if(loseAcknowledgement){loseAcknowledgement=false;return{ok:false,snapshot:null,code:'IO_ERROR',error:'Fixture response failed after the durable workflow was saved.'};}return result;}return base(request);};});
 const aw=atomic.window,ad=aw.document,af=aw.__atlasFixture,ae=id=>ad.getElementById(id);
 const send=async()=>{ae('workspace-chat-form').dispatchEvent(new aw.SubmitEvent('submit',{bubbles:true,cancelable:true,submitter:ae('chat-send')}));await flush();};
 ae('chat-message').value='A single paired workflow';await send();
 check(attempts.length===1&&af.office.goals.length===1&&!ae('chat-pending-workflow').hidden,'IO_ERROR after a durable save retains one uncertain request identity');
 const nonce=attempts[0].requestId;ae('chat-message').value='An edited next workflow';await send();
 check(attempts.length===1&&ae('chat-message').value==='An edited next workflow'&&ae('chat-status').textContent.includes('uncertain'),'editing an uncertain brief cannot create a fresh workflow identity');
 ae('chat-retry-workflow').click();await flush();
 check(attempts.length===2&&attempts[1].requestId===nonce&&attempts[1].content==='A single paired workflow','explicit retry resends the frozen original body and request identity');
 check(af.office.goals.length===1&&af.office.events.filter(event=>event.action==='create_paired_workflow').length===1,'native fixture replay returns the original receipt without duplicate work');
 check(ae('chat-pending-workflow').hidden&&ae('chat-message').value==='An edited next workflow','acknowledgement clears pending state while preserving a newer typed brief');
 check(!af.calls.some(call=>call.name==='officeCommand'&&['post_chat','create_goal','plan_goal','execute_goal'].includes(call.args.action)),'Donna atomic submission does not fall back to the previous multi-write chain');
 atomic.window.close();
}
// Roadmap edits use their own frozen base and preserve unrelated relationships.
{
 const roadmapDom=await makeDom(true,undefined,'',rw=>{rw.__atlasFixture.office.portfolio.roadmap.push({id:'revision-outcome',revision:3,scope:{kind:'company',id:'fixture-company'},title:'Original outcome',description:'Saved acceptance',ownerEmployeeId:'donna',reviewerEmployeeId:'fixture-reviewer',reviewerServiceContractId:null,departmentId:null,serviceContractId:null,status:'planned',dependencies:['saved-dependency'],goalIds:['saved-goal'],jobIds:[],estimate:null,reviewEstimate:null,evidence:null,createdAt:'2026-11-22T00:00:00Z',updatedAt:'2026-11-22T00:00:00Z'});});
 const rw=roadmapDom.window,rd=rw.document,rf=rw.__atlasFixture,re=id=>rd.getElementById(id),rc=()=>rf.calls.filter(call=>call.name==='officeCommand');
 const input=(id,value)=>{re(id).value=value;re(id).dispatchEvent(new rw.Event('input',{bubbles:true}));};
 const submit=async()=>{re('ceo-roadmap-form').dispatchEvent(new rw.SubmitEvent('submit',{bubbles:true,cancelable:true,submitter:re('ceo-roadmap-form').querySelector('button[type="submit"]')}));await flush();};
 re('workspace-tab-timeline').click();await flush();rd.querySelector('[data-roadmap-id="revision-outcome"] button').click();await flush();
 input('ceo-roadmap-title','Unsaved outcome draft');rf.office.portfolio.roadmap[0].revision=4;rf.office.portfolio.roadmap[0].title='Another editor saved';re('office-refresh').click();await flush();
 check(re('ceo-roadmap-title').value==='Unsaved outcome draft','roadmap background refresh preserves an unfinished title');const before=rc().length;await submit();
 check(rc().length===before+1&&rc().at(-1).args.expectedRevision===3&&rf.office.portfolio.roadmap[0].title==='Another editor saved','stale roadmap sends its frozen revision once and cannot overwrite the newer record');
 check(re('ceo-roadmap-title').value==='Unsaved outcome draft'&&re('ceo-roadmap-save-status').textContent.includes('draft'),'roadmap stale failure visibly keeps the original draft');
 re('ceo-roadmap-reload').click();await flush();input('ceo-roadmap-title','Reconciled outcome');
 for(const [suffix,value] of [['optimistic','10'],['likely','20'],['pessimistic','30']])input(`ceo-roadmap-estimate-${suffix}`,value);
 for(const [suffix,value] of [['optimistic','2'],['likely','4'],['pessimistic','8']])input(`ceo-roadmap-review-estimate-${suffix}`,value);
 await submit();const saved=rc().at(-1).args;
 check(saved.expectedRevision===4&&saved.reviewerEmployeeId==='fixture-reviewer'&&saved.estimate.likelyMinutes===20&&saved.reviewEstimate.likelyMinutes===4,'roadmap controls submit exact native reviewer and minute-range fields');
 check(saved.dependencies.join(',')==='saved-dependency'&&saved.goalIds.join(',')==='saved-goal','roadmap ownership edits preserve saved dependencies and links');
 for(let i=0;i<125;i++)rf.office.portfolio.roadmap.push({...rf.office.portfolio.roadmap[0],id:`later-outcome-${i}`,title:`Later outcome ${i}`,dependencies:[],goalIds:[]});re('office-refresh').click();await flush();input('studio-roadmap-search','Later outcome 124');
 check(rd.querySelector('[data-roadmap-id="later-outcome-124"]'),'roadmap search reaches saved outcomes beyond the old first-120 cap');

 // Attach reviewed native work through the actual editor; a failed gate leaves the draft intact.
 const primaryId='reviewed-primary',reviewId='reviewed-review',goalId='reviewed-linked-goal',stepId='reviewed-step';
 const baseJob={companyId:'fixture-company',officeId:'fixture-office',departmentId:null,goalId,goalIteration:1,mode:'manual',provider:'ollama',model:'fixture',goal:'Fixture reviewed evidence',authorized:false,allowedTools:[],dependencies:[],status:'completed',limits:{maxTokens:100,maxUsd:1,maxMinutes:10},usage:{inputTokens:0,outputTokens:0,costUsd:0},costStatus:'none',reservation:null,createdAt:'2026-11-22T00:00:00Z',updatedAt:'2026-11-22T00:00:00Z',artifactUri:'fixture://artifact',summary:'Fixture only',error:null};
 rf.office.jobs.push({...baseJob,id:primaryId,employeeId:'donna',artifactSha256:'a'.repeat(64),pair:{stepId,phase:'primary',peerEmployeeId:'fixture-reviewer',primaryJobId:primaryId,reviewJobId:reviewId}}, {...baseJob,id:reviewId,employeeId:'fixture-reviewer',artifactSha256:'b'.repeat(64),pair:{stepId,phase:'review',peerEmployeeId:'donna',primaryJobId:primaryId,reviewJobId:reviewId},review:{verdict:'revise',primaryArtifactSha256:'a'.repeat(64),reviewArtifactSha256:'b'.repeat(64),summary:'Fixture review',evidenceRefs:['fixture://artifact'],recordedAt:'2026-11-22T00:00:00Z'}});
 rf.office.goals.push({id:goalId,companyId:'fixture-company',scope:{kind:'company',id:'fixture-company'},title:'Reviewed linked goal',description:'Fixture',mode:'plan',status:'completed',iteration:1,maxIterations:1,jobIds:[primaryId,reviewId],steps:[{id:stepId,title:'Produce evidence',employeeId:'donna',reviewerEmployeeId:'fixture-reviewer',dependsOn:[],goal:'Fixture'}],runSettings:{mode:'manual'},createdAt:'2026-11-22T00:00:00Z',updatedAt:'2026-11-22T00:00:00Z'});
 re('office-refresh').click();await flush();re('ceo-add-roadmap').click();await flush();input('ceo-roadmap-title','Outcome from reviewed work');
 re('ceo-roadmap-scope').value='company';re('ceo-roadmap-scope').dispatchEvent(new rw.Event('change',{bubbles:true}));re('ceo-roadmap-target').value='fixture-company';re('ceo-roadmap-target').dispatchEvent(new rw.Event('change',{bubbles:true}));
 re('ceo-roadmap-owner').value='donna';re('ceo-roadmap-reviewer').value='fixture-reviewer';re('ceo-roadmap-goal').value=goalId;re('ceo-roadmap-add-goal').click();re('ceo-roadmap-edit-status').value='done';input('ceo-roadmap-evidence','fixture://reviewed-evidence');
 const count=rf.office.portfolio.roadmap.length;await submit();
 check(rf.office.portfolio.roadmap.length===count&&re('ceo-roadmap-title').value==='Outcome from reviewed work'&&re('ceo-roadmap-save-status').textContent.includes('independent review'),'unaccepted linked work cannot create Done and its failure preserves the full draft');
 rf.office.jobs.find(job=>job.id===reviewId).review.verdict='accepted';re('office-refresh').click();await flush();await submit();
 const accepted=rf.office.portfolio.roadmap.find(item=>item.title==='Outcome from reviewed work');
 check(accepted?.status==='done'&&accepted.goalIds.join(',')===goalId&&accepted.reviewerEmployeeId==='fixture-reviewer','new outcome can link an accepted paired goal and save Done through the actual editor');
 check(rf.office.jobs.length===2,'linking accepted evidence does not create or execute new jobs');
 re('ceo-roadmap-edit-status').value='in-progress';re('ceo-roadmap-dependency').value='revision-outcome';re('ceo-roadmap-add-dependency').click();await submit();check(rc().at(-1).args.dependencies.includes('revision-outcome')&&rc().at(-1).args.scope.id==='fixture-company','dependency editor saves the chosen canonical outcome without changing scope');re('ceo-roadmap-dependency-links').querySelector('button').click();await submit();check(rc().at(-1).args.dependencies.length===0&&rc().at(-1).args.goalIds.join(',')===goalId,'explicit dependency removal preserves reviewed work links');
 roadmapDom.window.close();
}

// Failed review output is a concrete repair state, even when execution itself completed.
{
 const repairDom=await makeDom(true,undefined,'',pw=>{
  const f=pw.__atlasFixture,goalId='repair-goal',stepId='repair-step',primaryId='repair-primary',reviewId='repair-review';
  const base={companyId:'fixture-company',officeId:'fixture-office',departmentId:null,goalId,goalIteration:1,mode:'manual',provider:'ollama',model:'fixture',goal:'Repair the recorded review',authorized:false,allowedTools:[],dependencies:[],status:'completed',limits:{maxTokens:100,maxUsd:1,maxMinutes:10},usage:{inputTokens:0,outputTokens:0,costUsd:0},usageRecorded:true,costStatus:'none',reservation:null,createdAt:'2026-11-22T00:00:00Z',updatedAt:'2026-11-22T00:00:00Z',artifactUri:'fixture://evidence',summary:'Recorded execution',error:null};
  f.office.jobs.push({...base,id:primaryId,employeeId:'donna',artifactSha256:'a'.repeat(64),pair:{stepId,phase:'primary',peerEmployeeId:'fixture-reviewer',primaryJobId:primaryId,reviewJobId:reviewId}}, {...base,id:reviewId,employeeId:'fixture-reviewer',artifactSha256:'b'.repeat(64),pair:{stepId,phase:'review',peerEmployeeId:'donna',primaryJobId:primaryId,reviewJobId:reviewId},review:null,reviewFailure:{reason:'malformed-output',summary:'Malformed recorded review',recordedAt:'2026-11-22T00:00:00Z'}});
  f.office.goals.push({id:goalId,companyId:'fixture-company',scope:{kind:'company',id:'fixture-company'},title:'Repairable paired goal',description:'Fixture repair',mode:'execute',status:'needs-review',stopReason:'review-required',iteration:1,maxIterations:3,jobIds:[primaryId,reviewId],steps:[{id:stepId,title:'Review the output',employeeId:'donna',reviewerEmployeeId:'fixture-reviewer',dependsOn:[],goal:'Fixture'}],runSettings:{mode:'manual'},createdAt:'2026-11-22T00:00:00Z',updatedAt:'2026-11-22T00:00:00Z'});
  f.office.portfolio.roadmap.push({id:'repair-outcome',revision:0,scope:{kind:'company',id:'fixture-company'},title:'Repairable outcome',description:'Fixture',ownerEmployeeId:'donna',reviewerEmployeeId:'fixture-reviewer',reviewerServiceContractId:null,departmentId:null,serviceContractId:null,status:'blocked',dependencies:[],goalIds:[goalId],jobIds:[primaryId],estimate:null,reviewEstimate:null,evidence:null,createdAt:'2026-11-22T00:00:00Z',updatedAt:'2026-11-22T00:00:00Z'});
  f.office.blueprints[0].whiteboards.push({id:'repair-card',revision:0,roomId:'fixture-room',ownerEmployeeId:'donna',title:'Repairable linked card',goalIds:[goalId],jobIds:[primaryId],roadmapItemIds:['repair-outcome'],x:.2,y:.2});
 });
 const pw=repairDom.window,pd=pw.document,pf=pw.__atlasFixture,pe=id=>pd.getElementById(id);
 pe('chat-scope').value='company';pe('chat-scope').dispatchEvent(new pw.Event('change',{bubbles:true}));await flush();
 for(const reason of ['malformed-output','input-budget','artifact-mismatch','recording-unconfirmed']){
  pf.office.jobs.find(job=>job.id==='repair-review').reviewFailure={reason,summary:`Repair receipt ${reason} <img src=x onerror=alert(1)>`,recordedAt:'2026-11-22T00:00:00Z'};pe('office-refresh').click();await flush();
  const goal=pd.querySelector('[data-goal-id="repair-goal"]'),card=pd.querySelector('[data-board-id="repair-card"]'),outcome=pd.querySelector('[data-roadmap-id="repair-outcome"]');
  check([goal,card,outcome].every(element=>element?.textContent.includes('Review needs repair')&&element.textContent.includes(`Repair receipt ${reason}`)),`${reason} is exposed on the real goal, whiteboard and roadmap`);
  check(!goal.textContent.includes('awaiting accepted review')&&!goal.textContent.includes('Independent review accepted'),`${reason} is not mislabeled as pending or accepted`);
  check(!goal.querySelector('img')&&!card.querySelector('img')&&!outcome.querySelector('img'),'review failure summaries remain plain text');
 }
 pe('workspace-tab-softboard').click();await flush();pd.querySelector('#workspace-softboard [data-employee-id="fixture-reviewer"]').click();
 check(pe('softboard-person-detail').textContent.includes('Review needs repair')&&pe('softboard-person-detail').textContent.includes('recording-unconfirmed'),'Greenboard exposes the canonical helper repair summary');
 pe('chat-message').value='Keep my unfinished Donna draft';pe('workspace-tab-whiteboard').click();await flush();const before=pf.calls.filter(call=>call.name==='officeCommand').length;
 pd.querySelector('[data-board-id="repair-card"] [data-review-failure] button').click();await flush();await flush();
 const advance=pd.querySelector('[data-goal-id="repair-goal"] .goal-advance');
 check(Boolean(advance)&&advance.closest('details').open,'Inspect repair plan opens the existing explicit bounded-iteration controls');
 check(pe('chat-message').value==='Keep my unfinished Donna draft','repair navigation preserves an unfinished Donna brief');
 check(!pf.calls.slice(before).some(call=>call.name==='officeCommand'&&['advance_goal','resume_job','execute_goal','create_paired_workflow','enqueue_job'].includes(call.args.action))&&pf.office.jobs.length===2,'opening repair options never starts or recreates work');
 check(pf.office.jobs.every(job=>job.status==='completed'),'repair presentation preserves recorded execution statuses');

 const reason=advance.querySelector('textarea'),submit=advance.querySelector('button[type="submit"]');
 check(submit.textContent==='Approve & queue next iteration','review policy names the explicit owner approval before repair dispatch');reason.value='Inspect the malformed review and preserve the prior evidence';advance.dispatchEvent(new pw.SubmitEvent('submit',{bubbles:true,cancelable:true,submitter:submit}));await flush();
 const queued=pf.calls.filter(call=>call.name==='officeCommand'&&call.args.action==='advance_goal');check(queued.length===1&&queued[0].args.reviewed===true&&queued[0].args.reason===reason.value,'only the explicit owner iteration submission sends reviewed:true');
 pf.office.policy.approvalMode='autonomous';pe('office-refresh').click();await flush();const automatic=pd.querySelector('[data-goal-id="repair-goal"] .goal-advance');automatic.querySelector('textarea').value='A separately requested iteration within the same limits';const autoSubmit=automatic.querySelector('button[type="submit"]');automatic.dispatchEvent(new pw.SubmitEvent('submit',{bubbles:true,cancelable:true,submitter:autoSubmit}));await flush();const last=pf.calls.filter(call=>call.name==='officeCommand'&&call.args.action==='advance_goal').at(-1);check(autoSubmit.textContent==='Queue next iteration'&&!Object.prototype.hasOwnProperty.call(last.args,'reviewed'),'autonomous policy does not add an unsolicited review flag');
 repairDom.window.close();
}
console.log(JSON.stringify({suite:'renderer pure-DOM interaction',checks,passed:true,fixtureOnly:true,networkCalls:0,providerCalls:0,visualVerification:false},null,2));
