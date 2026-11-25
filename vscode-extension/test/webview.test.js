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
  const document={getElementById:get,createElement:tag=>new Element(tag),querySelectorAll:selector=>selector.includes('form button')?[get('send'),get('panel'),get('manage-team'),get('creative-tools')]:[]};
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
