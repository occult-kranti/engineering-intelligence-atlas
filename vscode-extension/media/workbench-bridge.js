(function () {
  'use strict';
  const config=window.__DAFTAR_WORKBENCH__;delete window.__DAFTAR_WORKBENCH__;
  if(!config||config.version!==1||typeof acquireVsCodeApi!=='function')return;
  const vscode=acquireVsCodeApi(),methods=config.methods||{},pending=new Map();
  const listeners={job:new Set(),project:new Set(),mode:new Set()};
  let epoch=config.epoch,connection=config.connection||{},disposed=false,sequence=0;
  let updateSetup=()=>{},disposeSetup=()=>{};
  const prefix=typeof crypto.randomUUID==='function'?crypto.randomUUID().replace(/-/g,''):String(Date.now());
  const byteLength=value=>new TextEncoder().encode(JSON.stringify(value)).length;
  const error=(code,message)=>Object.assign(new Error(message),{code});
  const stateIdentity=info=>JSON.stringify([info.kind||'',info.url||'',info.location||'',info.connectionEpoch||0]);
  const allowedState=new Set(['daftar.endless-workspace.layout.v1','daftar-studio-theme','daftar-studio-donna-pos']);
  const cameraKey=key=>/^daftar\.freeflow\.camera\.v1:[A-Za-z0-9_.:-]{1,160}$/.test(key);
  const allowedKey=key=>allowedState.has(key)||cameraKey(key);
  const memory=new Map();
  let previous;try{previous=vscode.getState();}catch{}
  if(previous?.version===1&&previous.identity===stateIdentity(connection)&&previous.view&&typeof previous.view==='object'){
    for(const[key,value]of Object.entries(previous.view).slice(0,64))if(allowedKey(key)&&typeof value==='string'&&value.length<=65536){const clean=viewValue(key,value);if(clean!==null)memory.set(key,clean);}
  }
  function persist(){
    const view={};for(const[key,value]of memory)if(allowedKey(key))view[key]=value;
    const state={version:1,identity:stateIdentity(connection),view};
    if(byteLength(state)<=98304)try{vscode.setState(state);}catch{}
  }
  function viewValue(key,value){
    if(key==='daftar-studio-theme')return ['blueprint','drafting'].includes(value)?value:null;
    let parsed;try{parsed=JSON.parse(value);}catch{return null;}
    if(cameraKey(key)){const camera={};for(const name of ['x','y','zoom','yaw','pitch','distance']){if(!Number.isFinite(parsed?.[name])||Math.abs(parsed[name])>1e7)return null;camera[name]=parsed[name];}return JSON.stringify(camera);}
    if(key==='daftar-studio-donna-pos')return Number.isFinite(parsed?.x)&&Number.isFinite(parsed?.y)&&Math.abs(parsed.x)<=1000000&&Math.abs(parsed.y)<=1000000?JSON.stringify({x:parsed.x,y:parsed.y,locked:parsed.locked===true}):null;
    if(key==='daftar.endless-workspace.layout.v1'){
      if(!parsed||!Array.isArray(parsed.panels)||parsed.panels.length>128)return null;
      const panels=[];
      for(const panel of parsed.panels){
        if(!panel||typeof panel.id!=='string'||!/^[A-Za-z0-9_.:-]{1,160}$/.test(panel.id)||!panel.rect)continue;
        const rect={};for(const name of ['x','y','width','height'])if(Number.isFinite(panel.rect[name])&&Math.abs(panel.rect[name])<=1e7)rect[name]=panel.rect[name];
        if(Object.keys(rect).length!==4)continue;
        const clean={id:panel.id,rect};for(const name of ['open','pinned','collapsed'])clean[name]=panel[name]===true;
        if(Number.isFinite(panel.z))clean.z=Math.max(0,Math.min(100000,panel.z));panels.push(clean);
      }
      return JSON.stringify({version:1,panels,activeId:typeof parsed.activeId==='string'&&panels.some(panel=>panel.id===parsed.activeId)?parsed.activeId:null});
    }
    return null;
  }
  const storage={get length(){return memory.size;},key:index=>[...memory.keys()][index]??null,getItem:key=>memory.get(String(key))??null,
    setItem(key,value){key=String(key);value=String(value);if(key.length>200||value.length>65536||(!memory.has(key)&&memory.size>=64))return;
      if(allowedKey(key)){value=viewValue(key,value);if(value===null)return;}memory.set(key,value);if(allowedKey(key))persist();},
    removeItem(key){memory.delete(String(key));if(allowedKey(String(key)))persist();},clear(){memory.clear();persist();}};
  // Desktop drafts remain session-only. Only validated geometry/theme preferences
  // enter VS Code's view-state store; credentials and form values never do.
  try{Object.defineProperty(window,'localStorage',{value:storage,configurable:true});}catch{}
  const sessionMemory=new Map();
  try{Object.defineProperty(window,'sessionStorage',{value:{getItem:key=>sessionMemory.get(String(key))??null,setItem(key,value){if(String(value).length<=65536&&sessionMemory.size<64)sessionMemory.set(String(key),String(value));},removeItem:key=>sessionMemory.delete(String(key)),clear:()=>sessionMemory.clear()},configurable:true});}catch{}
  function rejectAll(code,message,sendCancel){for(const[id,item]of pending){clearTimeout(item.timer);if(sendCancel)try{vscode.postMessage({type:'daftar:cancel',id,epoch});}catch{}item.reject(error(code,message));}pending.clear();}
  function request(method,args){
    if(disposed)return Promise.reject(error('disposed','The office panel has closed.'));
    if(!Object.hasOwn(methods,method)||!Array.isArray(args))return Promise.reject(error('invalid_method','Unsupported office operation.'));
    while(args.length&&args.at(-1)===undefined)args.pop();
    if(args.length<methods[method][0]||args.length>methods[method][1])return Promise.reject(error('invalid_arguments','Unsupported office arguments.'));
    if(pending.size>=Math.min(32,config.maxPending||32))return Promise.reject(error('capacity','Wait for pending office work to finish.'));
    const id=`w_${prefix}_${++sequence}`;const message={type:'daftar:request',id,epoch,method,args};
    try{if(byteLength(message)>272*1024)return Promise.reject(error('request_limit','The office request is too large.'));}catch{return Promise.reject(error('invalid_arguments','Office requests must contain JSON data.'));}
    let cancel;
    const promise=new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>{if(!pending.has(id))return;pending.delete(id);try{vscode.postMessage({type:'daftar:cancel',id,epoch});}catch{}reject(error('deadline','The editor deadline elapsed. No retry was sent; inspect the original job ID.'));},Math.min(45000,config.deadlineMs||45000));
      pending.set(id,{resolve,reject,timer,epoch});
      cancel=()=>{const item=pending.get(id);if(!item)return;clearTimeout(item.timer);pending.delete(id);try{vscode.postMessage({type:'daftar:cancel',id,epoch});}catch{}reject(error('cancelled','The editor request was cancelled. Inspect any submitted job before retrying.'));};
      try{vscode.postMessage(message);}catch{clearTimeout(timer);pending.delete(id);reject(error('transport','The editor connection is unavailable.'));}
    });
    Object.defineProperties(promise,{requestId:{value:id},cancel:{value:()=>cancel?.()}});return promise;
  }
  const bridge={version:3,transport:connection.kind==='cloud'?'cloud-browser':'vscode',rendererHost:'vscode'};
  for(const method of Object.keys(methods)){if(method==='sendCloudChat'&&connection.kind!=='cloud')continue;bridge[method]=(...args)=>request(method,args);}
  // Discard legacy renderer credential arguments; the extension host prompts
  // securely. Existing keys are never returned to or cached by this facade.
  bridge.setApiKey=provider=>request('setApiKey',[provider]);
  bridge.configureCloud=()=>request('configureCloud',[]);
  for(const[method,event]of [['onJobEvent','job'],['onProjectEvent','project'],['onModeChanged','mode']])bridge[method]=listener=>{
    if(typeof listener!=='function'||disposed)return()=>{};listeners[event].add(listener);return()=>listeners[event].delete(listener);
  };
  Object.defineProperty(window,'desktopBridge',{value:Object.freeze(bridge),writable:false,configurable:false});
  function connectionLabel(){
    const bar=document.getElementById('workbench-controls'),label=document.getElementById('workbench-connection');
    if(bar)bar.dataset.connected=String(connection.connected===true);
    if(label){label.textContent=connection.connected?(connection.label||connection.location||connection.kind||'Connected office'):(connection.notice||'Connect your office');label.title=label.textContent;}
    updateSetup();
  }
  function receive(event){
    const value=event.data;if(!value||typeof value!=='object'||Array.isArray(value))return;
    try{if(byteLength(value)>9*1024*1024)return;}catch{return;}
    if(value.type==='daftar:connection'&&Number.isSafeInteger(value.epoch)&&value.epoch>=epoch){
      if(value.epoch!==epoch){rejectAll('connection_changed','The office connection changed.',false);epoch=value.epoch;memory.clear();sessionMemory.clear();}
      connection=value.connection||{};connectionLabel();return;
    }
    if(value.epoch!==epoch)return;
    if(value.type==='daftar:response'){
      const item=pending.get(value.id);if(!item||item.epoch!==epoch||typeof value.ok!=='boolean')return;
      clearTimeout(item.timer);pending.delete(value.id);
      if(value.ok)item.resolve(value.value);else item.reject(error(typeof value.error?.code==='string'?value.error.code:'operation_failed',typeof value.error?.message==='string'?value.error.message:'The office operation failed.'));return;
    }
    if(value.type==='daftar:event'&&Object.hasOwn(listeners,value.event))for(const listener of [...listeners[value.event]])try{
      if(value.event==='mode'){const mode=value.value;Array.isArray(mode)?listener(...mode):mode&&typeof mode==='object'?listener(mode.mode,mode.url??null):listener(mode,null);}else listener(value.value);
    }catch{}
  }
  function creativeDevelopment(){void request('openCreativeDevelopment',[]).catch(failure=>{const label=document.getElementById('workbench-connection');if(label)label.textContent=failure.message;});}
  function compute(){void request('openComputeCenter',[]).catch(failure=>{const label=document.getElementById('workbench-connection');if(label)label.textContent=failure.message;});}
  function setupFlow(){
    const trigger=document.getElementById('workbench-setup'),panel=document.getElementById('workbench-setup-panel');
    if(!trigger||!panel)return;
    const move=document.getElementById('workbench-setup-move'),closeButton=document.getElementById('workbench-setup-close'),status=document.getElementById('workbench-setup-status');
    const actions=[...panel.querySelectorAll('[data-setup-action]')],subscriptions=[],requests=new Set(),busyButtons=new Set();
    const allowedActions=new Set(['connectRuntimePrompt','startLocalRuntime','openComputeCenter','copyEditorPairing']);
    let position=null,drag=null,returnFocus=null,closed=false;
    const listen=(target,type,handler,options)=>{target.addEventListener(type,handler,options);subscriptions.push(()=>target.removeEventListener(type,handler,options));};
    function place(x,y){
      const rect=panel.getBoundingClientRect(),width=rect.width||420,height=rect.height||620;
      const padding=10;position={x:Math.max(padding,Math.min(x,Math.max(padding,window.innerWidth-width-padding))),y:Math.max(padding,Math.min(y,Math.max(padding,window.innerHeight-height-padding)))};
      panel.style.left=`${position.x}px`;panel.style.top=`${position.y}px`;panel.style.right='auto';
    }
    function update(){
      if(closed)return;const connected=connection.connected===true,standalone=connected&&connection.kind==='runtime';
      document.getElementById('workbench-setup-runtime').textContent=connected?'The editor reports a connected office. GPU and workload readiness still need verification.':connection.configured?'A connection is saved, but the office is not verified as connected.':'Start on this extension host, or connect an existing private runtime.';
      document.getElementById('workbench-setup-mcp').textContent=standalone?'Copy a VS Code MCP config through the extension host. ChatGPT requires separate MCP registration or a tunnel.':'Connect a standalone runtime before copying its MCP config. This does not connect ChatGPT automatically.';
      status.textContent=connected?'Connection reported. Review each remaining step in its native controls; setup is not marked complete.':'Not connected. The office canvas remains available; connect before managing runtime work.';
      for(const button of actions)button.disabled=unavailable(button);
    }
    function unavailable(button){return busyButtons.has(button)||!Object.hasOwn(methods,button.dataset.setupAction)||(button.hasAttribute('data-setup-connected')&&connection.connected!==true)||(button.hasAttribute('data-setup-runtime')&&!(connection.connected===true&&connection.kind==='runtime'));}
    function hide(){if(panel.hidden)return;drag=null;panel.hidden=true;trigger.setAttribute('aria-expanded','false');const target=returnFocus?.isConnected?returnFocus:trigger;target.focus();}
    function show(){
      if(!panel.hidden){hide();return;}returnFocus=document.activeElement;panel.hidden=false;trigger.setAttribute('aria-expanded','true');update();
      place(position?.x??window.innerWidth-438,position?.y??112);panel.focus();
    }
    function stop(event){event.stopPropagation();}
    function keydown(event){
      if(event.key==='Escape'){event.preventDefault();event.stopPropagation();hide();return;}
      if(event.target!==move)return;
      const step=event.shiftKey?48:16,offset={ArrowLeft:[-step,0],ArrowRight:[step,0],ArrowUp:[0,-step],ArrowDown:[0,step]}[event.key];
      if(offset){event.preventDefault();event.stopPropagation();place((position?.x||10)+offset[0],(position?.y||10)+offset[1]);}
      else if(event.key==='Home'){event.preventDefault();event.stopPropagation();place(window.innerWidth-438,112);}
    }
    function pointerDown(event){if(event.button!==0)return;event.preventDefault();event.stopPropagation();move.focus();drag={id:event.pointerId,x:event.clientX,y:event.clientY,origin:position||{x:10,y:10}};}
    function pointerMove(event){if(!drag||event.pointerId!==drag.id)return;event.preventDefault();place(drag.origin.x+event.clientX-drag.x,drag.origin.y+event.clientY-drag.y);}
    function pointerEnd(event){if(drag&&event.pointerId===drag.id)drag=null;}
    function resize(){if(!panel.hidden&&position)place(position.x,position.y);}
    async function action(event){
      const button=event.currentTarget,method=button.dataset.setupAction;
      if(button.disabled||!allowedActions.has(method))return;
      const requestEpoch=epoch;busyButtons.add(button);button.disabled=true;status.textContent='Opening native controls…';
      const pendingRequest=request(method,[]);requests.add(pendingRequest);
      try{await pendingRequest;if(!closed&&epoch===requestEpoch){update();status.textContent=method==='copyEditorPairing'?'MCP configuration copied by the extension host. ChatGPT is not connected by this action.':'Native controls returned. Inspect their recorded result; this popup does not assume setup succeeded.';}}
      catch{if(!closed&&epoch===requestEpoch){update();status.textContent='The native action did not complete. Review the connection or original receipt before retrying.';}}
      finally{requests.delete(pendingRequest);busyButtons.delete(button);if(!closed)button.disabled=unavailable(button);}
    }
    listen(trigger,'click',show);listen(closeButton,'click',hide);listen(panel,'keydown',keydown);listen(panel,'pointerdown',stop);listen(panel,'wheel',stop,{passive:true});
    listen(move,'pointerdown',pointerDown);listen(window,'pointermove',pointerMove);listen(window,'pointerup',pointerEnd);listen(window,'pointercancel',pointerEnd);listen(window,'resize',resize);
    for(const button of actions)listen(button,'click',action);
    updateSetup=update;disposeSetup=()=>{closed=true;drag=null;for(const request of requests)request.cancel?.();requests.clear();for(const dispose of subscriptions.splice(0))dispose();updateSetup=()=>{};};update();
  }
  function secureInputs(){for(const input of document.querySelectorAll('input[type="password"]')){input.value='';input.disabled=true;input.placeholder='Use VS Code secure credential prompts';}}
  function credentialAction(event){
    let operation;
    if(event.type==='submit'&&event.target?.id==='cloud-connect-form')operation=()=>request('configureCloud',[]);
    if(event.type==='click'){
      const button=event.target?.closest?.('.key-row button');
      if(button&&button.textContent==='Save key'){
        const label=button.closest('.key-row')?.querySelector('strong')?.textContent?.toLowerCase()||'';
        const provider=label.includes('openai')?'openai':label.includes('anthropic')||label.includes('claude')?'anthropic':label.includes('github')?'github':null;
        if(provider)operation=()=>request('setApiKey',[provider]);
      }
    }
    if(operation){event.preventDefault();event.stopImmediatePropagation();secureInputs();void operation().then(()=>document.getElementById('workspace-refresh')?.click()).catch(failure=>{const label=document.getElementById('workbench-connection');if(label)label.textContent=failure.message;});}
  }
  let observer;
  function ready(){setupFlow();connectionLabel();document.getElementById('workbench-development')?.addEventListener('click',creativeDevelopment);document.getElementById('workbench-compute')?.addEventListener('click',compute);document.getElementById('workbench-connect')?.addEventListener('click',compute);
    secureInputs();document.addEventListener('submit',credentialAction,true);document.addEventListener('click',credentialAction,true);
    if(typeof MutationObserver==='function'){observer=new MutationObserver(secureInputs);observer.observe(document.body,{subtree:true,childList:true});}
    vscode.postMessage({type:'daftar:ready'});
  }
  function dispose(){if(disposed)return;disposed=true;disposeSetup();rejectAll('disposed','The office panel has closed.',true);for(const set of Object.values(listeners))set.clear();observer?.disconnect();window.removeEventListener('message',receive);window.removeEventListener('pagehide',dispose);document.removeEventListener('DOMContentLoaded',ready);document.removeEventListener('submit',credentialAction,true);document.removeEventListener('click',credentialAction,true);document.getElementById('workbench-development')?.removeEventListener('click',creativeDevelopment);document.getElementById('workbench-compute')?.removeEventListener('click',compute);document.getElementById('workbench-connect')?.removeEventListener('click',compute);sessionMemory.clear();}
  window.addEventListener('message',receive);window.addEventListener('pagehide',dispose,{once:true});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ready,{once:true});else ready();
})();
