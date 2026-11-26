#!/usr/bin/env node
// Real application DOM workflows with an explicitly unavailable renderer.
// This harness does not import Three, create a GL context, or claim browser layout.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {basicFixture,addFixtureEmployee} from './fixtures.mjs';

const here=path.dirname(fileURLToPath(import.meta.url));
const repo=path.resolve(here,'../../..');
const appPath=path.resolve(process.argv[2]||path.join(repo,'cloud-workspace/public/concepts/blueprint-world-app.js'));
const htmlPath=path.join(path.dirname(appPath),'blueprint-world.html');
const corePath=path.join(path.dirname(appPath),'blueprint-world-core.js');
const require=createRequire(path.join(repo,'desktop-shell/package.json'));
const {JSDOM,VirtualConsole}=await import(pathToFileURL(require.resolve('jsdom')).href);
const jsdomVersion=JSON.parse(fs.readFileSync(require.resolve('jsdom/package.json'),'utf8')).version;
const coreSource=fs.readFileSync(corePath,'utf8');
const coreExports=[...coreSource.matchAll(/^export\s+(?:function|const|let|class)\s+(\w+)/gm)].map(m=>m[1]);
assert.equal(coreExports.length,23,'frozen core export contract');
assert.equal(/^import\s/m.test(coreSource),false,'core remains self-contained');
const coreExecutable='(()=>{'+coreSource.replace(/^export\s+/gm,'')+';return {'+coreExports.join(',')+'};})()';
const bytes=fs.readFileSync(appPath),source=bytes.toString('utf8'),html=fs.readFileSync(htmlPath,'utf8');
const sha=v=>crypto.createHash('sha256').update(v).digest('hex');
const appHash=sha(bytes),storageKey='daftar-blueprint-world-v1';
const fixtureHash=sha(fs.readFileSync(path.join(here,'fixtures.mjs')));
const coreHash=sha(fs.readFileSync(corePath));
const importCore="import * as core from './blueprint-world-core.js';";
const importRenderer="import { mountWorld } from './blueprint-world-renderer.js';";
assert.equal(source.split(importCore).length,2,'exactly one actual core import');
assert.equal(source.split(importRenderer).length,2,'exactly one renderer import replaced by the unavailable port');
const executable=source.replace(importCore,'const core=window.__validationCore;').replace(importRenderer,'const mountWorld=window.__validationUnavailableRenderer;');
const results=[];

function createHarness(initial=basicFixture(),rawOverride) {
  const errors=[];
  const vc=new VirtualConsole();
  vc.on('jsdomError',e=>{if(e.type!=='css-parsing')errors.push(e.message);});
  const dom=new JSDOM(html,{url:'https://blueprint-validation.invalid/',runScripts:'outside-only',pretendToBeVisual:true,virtualConsole:vc});
  const w=dom.window,d=w.document;
  Object.defineProperties(w,{innerWidth:{value:1280,configurable:true},innerHeight:{value:900,configurable:true}});
  let networkCalls=0;
  w.fetch=()=>{networkCalls++;throw new Error('Network disabled in DOM validation');};
  w.XMLHttpRequest=class {constructor(){networkCalls++;throw new Error('Network disabled in DOM validation');}};
  w.HTMLElement.prototype.setPointerCapture=function(id){this.__capture=id;};
  w.HTMLElement.prototype.releasePointerCapture=function(id){if(this.__capture===id)delete this.__capture;};
  w.HTMLElement.prototype.hasPointerCapture=function(id){return this.__capture===id;};
  const originalRect=w.HTMLElement.prototype.getBoundingClientRect;
  w.HTMLElement.prototype.getBoundingClientRect=function(){
    if(!this.classList.contains('panel'))return originalRect.call(this);
    const match=/translate\(([-\d.]+)px,\s*([-\d.]+)px\)/.exec(this.style.transform);
    const x=Number(match?.[1]||0),y=Number(match?.[2]||0);
    return {x,y,left:x,top:y,right:x+380,bottom:y+240,width:380,height:240,toJSON(){return this;}};
  };
  for(const [name,value] of [['offsetWidth',380],['offsetHeight',240]]){
    const descriptor=Object.getOwnPropertyDescriptor(w.HTMLElement.prototype,name);
    Object.defineProperty(w.HTMLElement.prototype,name,{configurable:true,get(){return this.classList.contains('panel')?value:descriptor?.get?.call(this)||0;}});
  }
  const initialRaw=rawOverride===undefined?JSON.stringify(initial):rawOverride;
  w.localStorage.setItem(storageKey,initialRaw);
  // Evaluate both modules in the same realm, as the browser does. Passing a Node
  // core namespace would incorrectly reject form arguments as non-plain objects.
  w.__validationCore=w.eval(coreExecutable);
  w.__validationUnavailableRenderer=()=>{throw new Error('WebGL2 deliberately unavailable in DOM-only validation');};
  w.eval(executable);
  return {w,d,initialRaw,errors,networkCalls:()=>networkCalls,close:()=>w.close()};
}
const panel=(h,id)=>h.d.querySelector(`[data-panel="${id}"]`);
function button(root,label){const b=[...root.querySelectorAll('button')].find(n=>n.textContent.trim()===label||n.getAttribute('aria-label')===label);assert.ok(b,`button ${label}`);return b;}
function field(p,label){const l=[...p.querySelectorAll('label')].find(n=>n.textContent.trim()===label);assert.ok(l,`field ${label}`);const n=p.ownerDocument.getElementById(l.htmlFor);assert.ok(n&&p.contains(n),`label ${label} resolves within its own panel`);return n;}
function change(h,n,value){n.value=value;n.dispatchEvent(new h.w.Event(n.tagName==='SELECT'?'change':'input',{bubbles:true}));}
function closePanel(h,id){const p=panel(h,id);if(p)button(p,'Close').click();}
function openCompany(h,cid='co-fixture-0'){
  h.d.getElementById('btn-directory').click();
  const directory=panel(h,'directory');
  change(h,field(directory,'Company'),cid);
  button(directory,'Open company').click();
  return panel(h,'company-'+cid);
}
function openDepartment(h,name,cid='co-fixture-0'){
  const company=panel(h,'company-'+cid)||openCompany(h,cid);
  button(company,'Open department '+name).click();
  return panel(h,`dept-dp-${cid.endsWith('-1')?1:0}-${name.toLowerCase()}`);
}
function tidy(h){closePanel(h,'recovery');closePanel(h,'directory');}
function pointer(h,node,type,x,y){const e=new h.w.MouseEvent(type,{bubbles:true,cancelable:true,clientX:x,clientY:y,button:0});Object.defineProperty(e,'pointerId',{value:1});node.dispatchEvent(e);}
async function test(name,run){let h;try{const details=await run((...args)=>(h=createHarness(...args)));if(h){assert.equal(h.networkCalls(),0,'no attempted application network calls');assert.deepEqual(h.errors,[],'no DOM workflow errors');}results.push({name,status:'passed',details});console.log('PASS '+name);}catch(e){results.push({name,status:'failed',error:e.message});console.log('FAIL '+name+': '+e.message);}finally{h?.close();}}

await test('Renderer-unavailable forms and corrupt-storage bootstrap',make=>{
  let h=make();
  assert.match(panel(h,'recovery').textContent,/deliberately unavailable/);
  assert.notEqual(h.d.body.dataset.ready,'true');
  assert.equal(openCompany(h).querySelector('h2').textContent,'Company 0');
  assert.equal(h.w.localStorage.getItem(storageKey),h.initialRaw,'read-only opening preserves saved data');
  h.close();h=make(basicFixture(),'{broken');
  assert.match(h.d.getElementById('save-status').textContent,/unreadable/i);
  assert.equal(h.w.localStorage.getItem(storageKey),'{broken','corrupt raw data is not overwritten on bootstrap');
  h.d.getElementById('btn-directory').click();
  assert.ok(panel(h,'directory').querySelector('select').options.length>0,'sample records remain navigable');
  return {renderer:'explicitly unavailable',storageBoots:2};
});

await test('Department-specific hire drafts survive close and reopen independently',make=>{
  const h=make();openCompany(h);tidy(h);
  button(openDepartment(h,'Engineering'),'Hire here').click();
  let engineering=panel(h,'create-hire-co-fixture-0-dp-0-engineering');assert.ok(engineering);
  change(h,field(engineering,'Name'),'Engineering draft');change(h,field(engineering,'Role'),'Builder');
  button(openDepartment(h,'Design'),'Hire here').click();
  let design=panel(h,'create-hire-co-fixture-0-dp-0-design');assert.ok(design);
  change(h,field(design,'Name'),'Design draft');change(h,field(design,'Role'),'Designer');
  assert.equal(field(engineering,'Department').value,'dp-0-engineering');
  assert.equal(field(design,'Department').value,'dp-0-design');
  const ids=[...h.d.querySelectorAll('[id]')].map(n=>n.id);assert.equal(ids.length,new Set(ids).size,'coexisting panels have unique field IDs');
  closePanel(h,engineering.dataset.panel);closePanel(h,design.dataset.panel);
  button(openDepartment(h,'Engineering'),'Hire here').click();engineering=panel(h,'create-hire-co-fixture-0-dp-0-engineering');
  assert.equal(field(engineering,'Name').value,'Engineering draft');
  button(openDepartment(h,'Design'),'Hire here').click();design=panel(h,'create-hire-co-fixture-0-dp-0-design');
  assert.equal(field(design,'Name').value,'Design draft');button(design,'Create').click();
  const saved=JSON.parse(h.w.localStorage.getItem(storageKey));const created=saved.employees.find(e=>e.name==='Design draft');assert.ok(created);
  assert.equal(saved.assignments.find(a=>a.employeeId===created.id).departmentId,'dp-0-design');
  assert.equal(saved.employees.some(e=>e.name==='Engineering draft'),false,'unsubmitted draft did not hire');
  return {coexistingContexts:2,submittedDefinitions:1,unsentDraftsPreserved:1};
});

await test('Person-specific task drafts retain the intended owner and company',make=>{
  const state=basicFixture(),second=addFixtureEmployee(state,0,'dp-0-engineering','Second engineer');
  const first=state.employees.find(e=>e.name==='Sam Same'&&e.homeCompanyId==='co-fixture-0');
  const h=make(state);openCompany(h);tidy(h);let department=openDepartment(h,'Engineering');
  button(department,'Open profile of Sam Same').click();let profile=panel(h,'prof-'+state.assignments.find(a=>a.employeeId===first.id).id);
  button(profile,'Assign task').click();closePanel(h,profile.dataset.panel);
  const firstPanel=panel(h,`create-task-co-fixture-0-dp-0-engineering-${first.id}`);assert.ok(firstPanel);
  change(h,field(firstPanel,'Task title'),'First owner draft');
  department=panel(h,'dept-dp-0-engineering');button(department,'Open profile of Second engineer').click();profile=panel(h,'prof-'+state.assignments.find(a=>a.employeeId===second.id).id);
  button(profile,'Assign task').click();closePanel(h,profile.dataset.panel);
  const secondPanel=panel(h,`create-task-co-fixture-0-dp-0-engineering-${second.id}`);assert.ok(secondPanel);
  assert.equal(field(firstPanel,'Owner (eligible people only)').value,first.id);
  assert.equal(field(secondPanel,'Owner (eligible people only)').value,second.id);
  const foreign=state.employees.find(e=>e.name==='Sam Same'&&e.homeCompanyId==='co-fixture-1');
  assert.equal([...field(secondPanel,'Owner (eligible people only)').options].some(o=>o.value===foreign.id),false);
  change(h,field(secondPanel,'Task title'),'Second owner task');button(secondPanel,'Create').click();
  const saved=JSON.parse(h.w.localStorage.getItem(storageKey)),task=saved.tasks.find(t=>t.title==='Second owner task');
  assert.equal(task.ownerId,second.id);assert.equal(task.companyId,'co-fixture-0');
  assert.deepEqual(saved.tasks.filter(t=>t.companyId==='co-fixture-1'),state.tasks.filter(t=>t.companyId==='co-fixture-1'));
  return {sameDepartmentOwners:2,foreignOwnersExcluded:true};
});

await test('Donna draft lifecycle, literal text, context separation and bounded history',make=>{
  const h=make();let company=openCompany(h);tidy(h);button(company,'Open Donna').click();
  let p=panel(h,'donna-co-fixture-0|'),ta=field(p,'Message');
  const hostile='<img src=x onerror=alert(1)> literal';change(h,ta,hostile);button(p,'Send').click();
  assert.equal(ta.value,'');assert.equal(p.querySelectorAll('.msgs img,.msgs script').length,0);assert.ok(p.querySelector('.msgs').textContent.includes(hostile));
  change(h,ta,'Private unsent company zero');
  change(h,field(p,'Company'),'co-fixture-1');button(p,'Open scope').click();p=panel(h,'donna-co-fixture-1|');
  assert.equal(field(p,'Message').value,'');change(h,field(p,'Message'),'Private unsent company one');
  change(h,field(p,'Company'),'co-fixture-0');button(p,'Open scope').click();p=panel(h,'donna-co-fixture-0|');
  assert.equal(field(p,'Message').value,'Private unsent company zero');button(p,'Send').click();
  closePanel(h,p.dataset.panel);company=panel(h,'company-co-fixture-0');button(company,'Open Donna').click();p=panel(h,'donna-co-fixture-0|');
  assert.equal(field(p,'Message').value,'','sent draft stays cleared after remount');
  for(let i=0;i<24;i++){change(h,field(p,'Message'),'Summarize work '+i);button(p,'Send').click();}
  assert.equal(p.querySelector('.msgs').children.length,40);assert.match(p.textContent,/Scripted demo/);
  const saved=JSON.parse(h.w.localStorage.getItem(storageKey));assert.equal(saved.tasks.length,2,'scripted messages do not create hidden work');
  return {scopeDrafts:2,rapidSends:24,visibleMessageCap:40,htmlExecution:false};
});

await test('Panel pointer cancellation restores the synthetic presentation position',make=>{
  const h=make();tidy(h);h.d.getElementById('btn-help').click();const p=panel(h,'help'),head=p.querySelector('.p-head');
  const initial=p.style.transform;
  const drag=()=>{const r=p.getBoundingClientRect();pointer(h,head,'pointerdown',r.left+60,r.top+15);pointer(h,head,'pointermove',r.left+190,r.top+95);assert.notEqual(p.style.transform,initial,'drag really changes the presentation');};
  drag();pointer(h,head,'pointercancel',240,220);assert.equal(p.style.transform,initial,'pointercancel restores start');
  drag();h.w.dispatchEvent(new h.w.Event('blur'));assert.equal(p.style.transform,initial,'window blur restores start');
  drag();head.dispatchEvent(new h.w.KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));
  if(!panel(h,'help'))h.d.getElementById('btn-help').click();
  assert.equal(panel(h,'help').style.transform,initial,'Escape restores position even if it closes the panel');
  return {cancelCases:3,layout:'fixed synthetic 380x240 panel; no browser hit-testing claim'};
});

await test('Failed persistence keeps new local records usable and reports session-only state',make=>{
  const h=make();openCompany(h);tidy(h);button(panel(h,'company-co-fixture-0'),'Hire').click();
  const p=panel(h,'create-hire-co-fixture-0');change(h,field(p,'Name'),'Session-only employee');change(h,field(p,'Role'),'Engineer');
  h.w.Storage.prototype.setItem=function(){throw new Error('Synthetic quota failure');};
  button(p,'Create').click();assert.match(h.d.getElementById('save-status').textContent,/not saved.*session only/i);
  assert.equal(h.w.localStorage.getItem(storageKey),h.initialRaw);
  assert.ok([...h.d.querySelectorAll('.panel h2')].some(n=>n.textContent==='Session-only employee'),'session record remains usable');
  return {writeFailures:1,storedStateUnchanged:true,localMutationVisible:true};
});

const receipt={artifactType:'blueprint-world-dom-workflow-validation',run:'blueprint-world-20261121',node:'verification',attempt:1,idempotencyKey:'blueprint-world-20261121:verification:1',terminationOwner:'root',createdAt:new Date().toISOString(),status:results.every(r=>r.status==='passed')?'passed':'failed',groups:results.length,passed:results.filter(r=>r.status==='passed').length,environment:{node:process.version,dom:'jsdom '+jsdomVersion,renderer:'deliberately unavailable; actual renderer module not imported',network:'disabled; zero attempts required'},source:{app:{path:path.relative(repo,appPath),bytes:bytes.length,sha256:appHash},html:{sha256:sha(html)},core:{sha256:coreHash},fixtures:{sha256:fixtureHash},harness:{sha256:sha(fs.readFileSync(fileURLToPath(import.meta.url)))}},limitations:['Synthetic DOM events and fixed panel dimensions do not verify browser input delivery, CSS layout, pixels, clipping, hit-testing, accessibility announcements, or focus scrolling.','No WebGL context, rendering, raycast, GPU performance, or renderer recovery was executed.','Renderer unavailability is an explicit injected module boundary; all application form handlers and core mutations are the captured production source.','Only local fixture records are exercised; this is not production permission or provider integration verification.'],results};
const receiptPath=path.resolve(process.argv[3]||path.join(here,`ui-receipt-${appHash.slice(0,12)}.json`));
fs.writeFileSync(receiptPath,JSON.stringify(receipt,null,2)+'\n');
console.log(JSON.stringify({status:receipt.status,passed:receipt.passed,groups:receipt.groups,appSha256:appHash,receipt:path.relative(repo,receiptPath)}));
if(receipt.status!=='passed')process.exitCode=1;
