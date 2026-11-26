'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

function webview(saved={}) {
  const elements=new Map(),messages=[],stored=[];let listener;
  class Element {
    constructor(tag='div'){this.tag=tag;this.children=[];this.value='';this.disabled=false;this.dataset={};const classes=new Set();this.classList={contains:value=>classes.has(value),toggle:(value,enabled)=>enabled?classes.add(value):classes.delete(value)};}
    append(...children){this.children.push(...children);}
    replaceChildren(...children){this.children=children;}
    setAttribute(name,value){this[name]=value;}
    focus(){}
    requestSubmit(){this.onsubmit?.({preventDefault(){}});}
  }
  const get=id=>{if(!elements.has(id))elements.set(id,new Element());return elements.get(id);};
  const document={getElementById:get,createElement:tag=>new Element(tag),querySelectorAll:selector=>selector.includes('form button')?[get('send'),get('panel'),get('manage-team'),get('creative-tools'),get('creative-development')]:[]};
  const filename=path.resolve(__dirname,'../media/office.js');
  vm.runInNewContext(fs.readFileSync(filename,'utf8'),{document,window:{addEventListener:(_event,fn)=>{listener=fn;}},acquireVsCodeApi:()=>({postMessage:message=>messages.push(message),getState:()=>saved,setState:value=>stored.push(JSON.parse(JSON.stringify(value)))})},{filename});
  const state=(company='a',url='https://atlas.example',kind='cloud')=>listener({data:{type:'state',connected:true,connection:{kind,url},snapshot:{companies:[{id:'a',name:'A'},{id:'b',name:'B'}],employees:[],offices:[],departments:[],jobs:[]},selectedCompany:company,ownership:[]}});
  return {get,messages,stored,state,receive:data=>listener({data})};
}
test('unsent drafts survive refresh and switch independently by company and connected origin',()=>{
  const w=webview({drafts:{'cloud|https://atlas.example|a':'Recovered brief'}});w.state();assert.equal(w.get('brief').value,'Recovered brief');
  w.get('brief').value='A unsent brief';w.get('brief').oninput();w.state();assert.equal(w.get('brief').value,'A unsent brief');
  w.get('company').value='b';w.get('company').onchange();assert.equal(w.get('brief').value,'');
  w.state('b');w.get('brief').value='B unsent brief';w.get('brief').oninput();w.state('a');assert.equal(w.get('brief').value,'A unsent brief');
  w.state('a','https://other.example');assert.equal(w.get('brief').value,'');
  assert.equal(w.stored.at(-1).drafts['cloud|https://atlas.example|b'],'B unsent brief');
});
test('a completed chat clears only its submitted draft and preserves a newer unsent brief',()=>{
  const w=webview();w.state();w.get('brief').value='Submitted brief';w.get('chat-form').requestSubmit();
  w.receive({type:'busy',value:true});w.state();assert.equal(w.get('send').disabled,true);
  w.get('brief').value='New unsent brief';w.get('brief').oninput();
  w.receive({type:'chatSent',companyId:'a',content:'Submitted brief',reply:'Reply'});assert.equal(w.get('brief').value,'New unsent brief');
  w.receive({type:'busy',value:false});assert.equal(w.get('send').disabled,false);
  w.receive({type:'chatSent',companyId:'a',content:'New unsent brief',saved:true});assert.equal(w.get('brief').value,'');
});
test('old-company responses and failures cannot replace another company draft or conversation',()=>{
  const w=webview();w.state('b');w.get('brief').value='B work';w.get('brief').oninput();
  const before=w.get('messages').children;
  w.receive({type:'chatHistory',companyId:'a',messages:[{role:'assistant',content:'A private reply'}]});
  w.receive({type:'chatSent',companyId:'a',content:'B work',reply:'A private reply'});
  assert.equal(w.get('messages').children,before);assert.equal(w.get('brief').value,'B work');
  w.receive({type:'error',message:'Disconnected'});assert.equal(w.get('brief').value,'B work');
  w.receive({type:'state',connected:false,connection:null});assert.equal(w.get('brief').value,'');
  w.state('b');assert.equal(w.get('brief').value,'B work');
});
test('runtime creative summary reports real readiness, ignores other company results and respects busy state',()=>{
  const w=webview();w.state('a','http://127.0.0.1:8788','runtime');
  assert.match(w.get('connection').textContent,/Headless runtime/);assert.equal(w.get('send').textContent,'Save runtime brief');
  w.receive({type:'creativeState',companyId:'a',inventory:{tools:[{id:'blender',configured:true,available:false},{id:'adobe-photoshop',configured:true,available:true,remoteAuthVerified:false}],projects:[{id:'p'}],jobs:[{status:'queued'}]}});
  assert.match(w.get('creative-state').textContent,/Blender: unavailable/);assert.match(w.get('creative-state').textContent,/Adobe Photoshop: configured — authentication unverified/);assert.match(w.get('creative-state').textContent,/1 queued or running/);
  const current=w.get('creative-state').textContent;w.receive({type:'creativeState',companyId:'b',inventory:{tools:[],projects:[]}});assert.equal(w.get('creative-state').textContent,current);
  w.get('creative-tools').onclick();assert.equal(w.messages.at(-1).type,'creativeTools');assert.equal(w.messages.at(-1).companyId,'a');assert.equal(w.get('creative-tools').disabled,true);
  const count=w.messages.length;w.get('creative-tools').onclick();assert.equal(w.messages.length,count);
  w.receive({type:'busy',value:false});assert.equal(w.get('creative-tools').disabled,false);
});
test('development status distinguishes install, load and selected digest without claiming a live GPU',()=>{
  const w=webview();w.state('a','http://127.0.0.1:8788','runtime');
  const model='qwen3-coder:30b-a3b-q4_K_M',digest='a'.repeat(64);
  const models={available:true,enabled:true,catalog:[{id:model,contextLimitTokens:8192}],models:[{name:model,digest,loaded:false}],assignments:[{companyId:'a',model,digest,employeeId:'one'},{companyId:'b',model,digest,employeeId:'foreign'},{companyId:'a',model,digest:'b'.repeat(64),employeeId:'stale'}]};
  w.receive({type:'developmentState',companyId:'a',models,status:{worker:{enabled:false,running:false}}});
  assert.match(w.get('development-state').textContent,/installed; not loaded/);assert.match(w.get('development-state').textContent,/1 current company assignment/);assert.match(w.get('development-state').textContent,/workers paused/);assert.match(w.get('development-state').textContent,/GPU memory and performance are unverified/);
  const prior=w.get('development-state').textContent;w.receive({type:'developmentState',companyId:'b',models:null});assert.equal(w.get('development-state').textContent,prior);
  w.get('creative-development').onclick();assert.equal(w.messages.at(-1).type,'creativeDevelopment');assert.equal(w.messages.at(-1).companyId,'a');assert.equal(w.get('creative-development').disabled,true);
  const count=w.messages.length;w.get('creative-development').onclick();assert.equal(w.messages.length,count);w.receive({type:'busy',value:false});assert.equal(w.get('creative-development').disabled,false);
});
test('configured OPTIX visibility is labelled as requested and unverified',()=>{
  const w=webview();w.state('a','http://127.0.0.1:8788','runtime');w.receive({type:'creativeState',companyId:'a',inventory:{tools:[{id:'blender',configured:true,available:true,renderDevice:'OPTIX'}],projects:[],jobs:[]}});
  assert.match(w.get('creative-state').textContent,/OPTIX requested, device unverified/);
});
