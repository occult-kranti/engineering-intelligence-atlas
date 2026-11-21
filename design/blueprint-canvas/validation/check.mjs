import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import os from 'node:os';
import {fileURLToPath} from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '../../..');
const require = createRequire(path.join(repoRoot, 'desktop-shell/package.json'));
const {JSDOM, VirtualConsole} = require('jsdom');
const jsdomVersion = require('jsdom/package.json').version;
const target = path.resolve(process.argv[2] || path.join(repoRoot, 'cloud-workspace/public/concepts/blueprint-office.html'));
const relativeTarget = path.relative(repoRoot, target);
const targetLabel = relativeTarget.startsWith('..') ? path.basename(target) : relativeTarget.split(path.sep).join('/');
const html = fs.readFileSync(target, 'utf8');
const KEY = 'daftar.prototype.v1';
const results = [];
const live = new Set();
const filter = process.env.PROTOTYPE_FILTER ? new RegExp(process.env.PROTOTYPE_FILTER) : null;

function boot({stored, getBlocked=false, setBlocked=false, reduce=true, width=1440, height=900, popupMetrics=null}={}) {
  const faults=[], network=[], prompts=[], timers=new Map();
  let clock=0, timerId=0;
  const vc=new VirtualConsole();
  vc.on('jsdomError', e => faults.push({message:e.message,detail:e.detail?.message}));
  const deny=(kind,url) => { network.push({kind,url:String(url)}); throw new Error('Network denied by isolated harness'); };
  const dom=new JSDOM(html, {
    url:'https://prototype.invalid/', runScripts:'dangerously', pretendToBeVisual:true,
    // Omitted resources keeps JSDOM's automatic subresource fetching disabled.
    virtualConsole:vc,
    beforeParse(w) {
      Object.defineProperties(w, {innerWidth:{value:width,writable:true},innerHeight:{value:height,writable:true}});
      if(stored!==undefined) w.localStorage.setItem(KEY, stored);
      if(getBlocked) w.Storage.prototype.getItem=function(){throw new w.DOMException('Storage unavailable','SecurityError');};
      if(setBlocked) w.Storage.prototype.setItem=function(){throw new w.DOMException('Storage full','QuotaExceededError');};
      w.matchMedia=() => ({matches:reduce,media:'(prefers-reduced-motion: reduce)',addEventListener(){},removeEventListener(){},addListener(){},removeListener(){}});
      w.fetch=(url)=>{try{deny('fetch',url);}catch(e){return Promise.reject(e);}};
      w.XMLHttpRequest.prototype.open=function(method,url){deny('xhr',url);};
      w.WebSocket=function(url){deny('websocket',url);};
      w.EventSource=function(url){deny('eventsource',url);};
      w.navigator.sendBeacon=(url)=>deny('beacon',url);
      w.Worker=function(url){deny('worker',url);};
      w.SharedWorker=function(url){deny('sharedworker',url);};
      w.open=(url)=>deny('window.open',url);
      w.prompt=()=>prompts.shift() ?? null;
      w.alert=()=>{};
      w.HTMLCanvasElement.prototype.getContext=function() {
        return {clearRect(){},fillRect(){},strokeRect(){},beginPath(){},moveTo(){},lineTo(){},stroke(){},fill(){},arc(){},save(){},restore(){},setTransform(){},scale(){},translate(){},closePath(){},fillText(){}};
      };
      if(popupMetrics){
        // JSDOM has no layout. This explicit geometry input exercises the app's
        // measured-popup depth contract; it is not browser dimension evidence.
        for(const [property,value] of [['offsetWidth',popupMetrics.width],['offsetHeight',popupMetrics.height]]){
          const original=Object.getOwnPropertyDescriptor(w.HTMLElement.prototype,property);
          Object.defineProperty(w.HTMLElement.prototype,property,{configurable:true,get(){return this.classList.contains('pop')?value:original.get.call(this);}});
        }
      }
      w.Element.prototype.setPointerCapture=function(){};
      w.Element.prototype.releasePointerCapture=function(){};
      w.Element.prototype.hasPointerCapture=function(){return false;};
      w.performance.now=()=>clock;
      w.Date.now=()=>1700000000000+clock;
      w.setTimeout=(callback,delay=0,...args)=>{const id=++timerId;timers.set(id,{at:clock+Math.max(0,Number(delay)||0),callback:()=>callback(...args)});return id;};
      w.clearTimeout=id=>timers.delete(id);
      w.setInterval=(callback,delay=1,...args)=>{const id=++timerId;const repeat=Math.max(1,Number(delay)||1);timers.set(id,{at:clock+repeat,callback:()=>callback(...args),repeat});return id;};
      w.clearInterval=id=>timers.delete(id);
      w.requestAnimationFrame=callback=>{const id=++timerId;timers.set(id,{at:clock+16,callback:()=>callback(clock)});return id;};
      w.cancelAnimationFrame=id=>timers.delete(id);
    }
  });
  const w=dom.window,d=w.document;
  const h={dom,w,d,faults,network,prompts,
    q(selector){const e=d.querySelector(selector);assert.ok(e,`Missing public element ${selector}`);return e;},
    all(selector){return [...d.querySelectorAll(selector)];},
    click(selector){const e=typeof selector==='string'?h.q(selector):selector;e.dispatchEvent(new w.MouseEvent('click',{bubbles:true,cancelable:true,clientX:300,clientY:200}));},
    key(key,target=d.body,options={}){target.dispatchEvent(new w.KeyboardEvent('keydown',{key,bubbles:true,cancelable:true,...options}));},
    field(selector,value){const e=h.q(selector);e.value=value;e.dispatchEvent(new w.Event('input',{bubbles:true}));return e;},
    tick(ms=0){const end=clock+ms;let count=0;for(;;){let next;for(const [id,t] of timers){if(t.at<=end&&(!next||t.at<next[1].at))next=[id,t];}if(!next)break;assert.ok(++count<100000,'Timer runaway');clock=next[1].at;timers.delete(next[0]);if(next[1].repeat)timers.set(next[0],{...next[1],at:clock+next[1].repeat});try{next[1].callback();}catch(e){faults.push({message:e.message});}}clock=end;},
    stored(){return JSON.parse(w.localStorage.getItem(KEY));},
    healthy(){assert.deepEqual(faults,[],'Uncaught script errors');assert.deepEqual(network,[],'Unexpected network access');assert.ok(d.querySelector('.sheet[data-co]'),'No company blueprint rendered');},
    close(){timers.clear();dom.window.close();live.delete(h);}
  };
  live.add(h);h.tick(0);return h;
}

async function check(name, body) {
  if(filter&&!filter.test(name))return;
  const started=performance.now();
  try{const detail=await body();results.push({name,status:'passed',ms:Math.round(performance.now()-started),...detail});}
  catch(e){results.push({name,status:'failed',ms:Math.round(performance.now()-started),error:e.message});}
  finally{for(const h of [...live])h.close();}
}

function buttonWith(h, text, parent=h.d){const b=[...parent.querySelectorAll('button')].find(e=>e.textContent.trim()===text);assert.ok(b,`Missing public button ${text}`);return b;}
function createCompany(h,name,type='company'){
  h.click('#createBtn');h.field('#cName',name);h.q('#cType').value=type;
  h.click(buttonWith(h,'Create',h.q('.pop[aria-label="Create"]')));
  h.tick(0);
}
function addItem(h,kind,value){
  h.click(buttonWith(h,kind==='task'?'+ Task':'+ Note'));
  const p=h.q('.pop[aria-label="'+(kind==='task'?'New task':'New sticky note')+'"]');
  const input=p.querySelector('input');assert.ok(input);input.value=value;input.dispatchEvent(new h.w.Event('input',{bubbles:true}));
  h.click(buttonWith(h,'Add',p));h.tick(0);
}
function camera(h){
  const text=h.q('#world').style.transform;
  const m=text.match(/^translate3d\(([-\d.]+)px,\s*([-\d.]+)px,\s*0(?:px)?\) scale\(([-\d.]+)\) rotateX\(([-\d.]+)deg\) rotateZ\(([-\d.]+)deg\)$/);
  assert.ok(m,`Expected a finite orthographic CSS-3D camera, got ${text}`);
  const [x,y,k,p,a]=m.slice(1).map(Number);assert.ok([x,y,k,p,a].every(Number.isFinite));assert.ok(k>=.12&&k<=3.2);
  return {x,y,k,p:p*Math.PI/180,a:a*Math.PI/180};
}
function project(c,x,y,z=0){return {x:c.x+c.k*(Math.cos(c.a)*x-Math.sin(c.a)*y),y:c.y+c.k*(Math.cos(c.p)*(Math.sin(c.a)*x+Math.cos(c.a)*y)-Math.sin(c.p)*z)};}
function unproject(c,sx,sy,z=0){
  // Independently invert the 2x2 ground-plane portion of the CSS Rx*Rz matrix.
  const a=Math.cos(c.a),b=-Math.sin(c.a),d=Math.cos(c.p)*Math.sin(c.a),e=Math.cos(c.p)*Math.cos(c.a);
  const X=(sx-c.x)/c.k,Y=(sy-c.y)/c.k+Math.sin(c.p)*z,det=a*e-b*d;
  assert.ok(Math.abs(det)>.1,'Camera plane is not invertible');return{x:(e*X-b*Y)/det,y:(a*Y-d*X)/det};
}
function approx(actual,expected,tolerance=.08,label='Value'){assert.ok(Math.abs(actual-expected)<=tolerance,`${label}: ${actual} vs ${expected} (tolerance ${tolerance})`);}
function pointer(h,type,target,x,y,id=1){const e=new h.w.Event(type,{bubbles:true,cancelable:true});Object.defineProperties(e,{clientX:{value:x},clientY:{value:y},pointerId:{value:id},button:{value:0}});target.dispatchEvent(e);}
function wheel(h,target,x,y,deltaY){const e=new h.w.Event('wheel',{bubbles:true,cancelable:true});Object.defineProperties(e,{clientX:{value:x},clientY:{value:y},deltaY:{value:deltaY},ctrlKey:{value:false},metaKey:{value:false}});target.dispatchEvent(e);}
function setAngle(h,p){for(let i=0;i<4&&Math.round(camera(h).p*180/Math.PI)!==p;i++)h.click('#d3Btn');assert.equal(Math.round(camera(h).p*180/Math.PI),p);}
function setOrbit(h,degrees){
  for(let i=0;i<32&&Math.abs(camera(h).a*180/Math.PI-degrees)>.1;i++)h.click(camera(h).a*180/Math.PI<degrees?'[aria-label="Orbit right"]':'[aria-label="Orbit left"]');
  approx(camera(h).a*180/Math.PI,degrees,.1,'Orbit angle');
}

await check('standalone script and network surface',()=>{
  const dom=new JSDOM(html);const d=dom.window.document;
  const scripts=[...d.scripts];assert.equal(scripts.length,1,'Expected one self-contained inline script');
  scripts.forEach((s,i)=>{assert.ok(!s.src,'External script');new vm.Script(s.textContent,{filename:`prototype-inline-${i}.js`});});
  const resources=[...d.querySelectorAll('[src],link[href],form[action],iframe,object,embed')].map(e=>e.outerHTML.slice(0,160));
  assert.deepEqual(resources,[],'External resource or navigation form found');
  const styles=[...d.querySelectorAll('style')].map(e=>e.textContent).join('\n');
  assert.ok(!/@import\b|url\s*\(\s*["']?(?:https?:|\/\/)/i.test(styles),'External CSS resource');
  assert.ok(!/\bfetch\s*\(|\bXMLHttpRequest\b|\bWebSocket\b|\bEventSource\b|\bsendBeacon\s*\(|\bimport\s*\(|\bWorker\s*\(/.test(scripts[0].textContent),'Network-capable script construct');
  dom.window.close();
  const h=boot();h.healthy();
  return {inlineScripts:scripts.length,networkCalls:h.network.length,companies:h.all('.d3co').length};
});

await check('corrupt and unavailable local storage',()=>{
  const cases=[
    {name:'invalid JSON',stored:'{broken'},
    {name:'null',stored:'null'},
    {name:'primitive',stored:'42'},
    {name:'array',stored:'[]'},
    {name:'oversized record',stored:' '.repeat(60001)},
    {name:'wrong field types',stored:JSON.stringify({theme:{},flat:'yes',extra:{},tasks:{},notes:{},geo:[],boardPos:7})},
    {name:'null collection entries',stored:JSON.stringify({extra:[null,{},false],tasks:[null,{},false],notes:[null,{},false]})},
    {name:'read denied',getBlocked:true},
    {name:'write quota exhausted',setBlocked:true}
  ];
  for(const c of cases){const h=boot(c);h.healthy();h.click('#themeBtn');assert.equal(h.d.documentElement.dataset.theme,'paper',`${c.name}: theme control remained usable`);h.click('#orb');h.tick(0);assert.equal(h.all('#chat').length,1,`${c.name}: Donna opens`);h.healthy();h.close();}
  return {cases:cases.length};
});

await check('company cap, uniqueness, and valid parent persistence',()=>{
  const extra=Array.from({length:120},(_,i)=>({id:'extra-'+i,name:'Extra '+i,kind:'company'}));
  extra.splice(1,0,{id:'extra-0',name:'Duplicate ID',kind:'company'},{id:'new-id',name:'EXTRA 0',kind:'company'},null);
  const h=boot({stored:JSON.stringify({extra})});h.healthy();
  assert.equal(h.all('.d3co').length,100,'Total companies must include seeded companies in the cap');
  assert.ok(h.all('.sheet[data-co]').length<=3,'Only nearest three blueprints should carry full room detail');
  h.click('#themeBtn');const s=h.stored();assert.equal(s.extra.length,97,'Only 97 extra companies may persist beside the 3 seeds');
  assert.equal(new Set(s.extra.map(c=>c.id)).size,s.extra.length,'Duplicate IDs');
  assert.equal(new Set(s.extra.map(c=>c.name.toLowerCase())).size,s.extra.length,'Duplicate names');
  createCompany(h,'Beyond Capacity');assert.match(h.q('.pop[aria-label="Create"] .err').textContent,/limit/i);
  assert.equal(h.all('.d3co').length,100,'Create must respect the load cap');h.healthy();h.close();

  const small=boot();createCompany(small,'Harbor Parent');small.click('#createBtn');small.field('#cName','Harbor Child');small.q('#cType').value='sub';
  const parent=[...small.q('#cPar').options].find(o=>o.text==='Harbor Parent');assert.ok(parent);small.q('#cPar').value=parent.value;
  small.click(buttonWith(small,'Create',small.q('.pop[aria-label="Create"]')));small.tick(0);small.healthy();
  const saved=small.stored(),child=saved.extra.find(c=>c.name==='Harbor Child');assert.equal(child.parent,parent.value,'Sub-company parent persisted');
  const again=boot({stored:JSON.stringify(saved)});again.healthy();
  const nesting=again.all('.hier .hn').find(e=>e.textContent==='Harbor Child');assert.ok(nesting,'Reloaded child appears in hierarchy');
  assert.match(nesting.closest('li').parentElement.closest('li').textContent,/Harbor Parent/);
  return {loadedCompanies:100,persistedExtras:97,rejectedExtraCreates:1,parentReloads:1};
});

await check('task/note caps, malformed entries, and unsafe geometry',()=>{
  const tasks=[null,{},...Array.from({length:90},(_,i)=>({id:'u'+(i%70),t:'Task '+i,lane:99,owner:'<bad> owner',status:i%2?'Done':'invalid'}))];
  const notes=[null,{},...Array.from({length:65},(_,i)=>({t:'Note '+i,x:i%2?'12':1e308,y:-1e308,c:99}))];
  const raw=JSON.stringify({tasks,notes,geo:{chat:{x:1e308,y:-1e308},create:{x:'12',y:'17'},unknown:{x:4,y:5},'__proto__':{polluted:'yes'}},boardPos:{'studio-north:road':{x:1e308,y:-1e308},'nonexistent:road':{x:4,y:5},'studio-north:invalid':{x:4,y:5}}});
  const h=boot({stored:raw});h.healthy();h.click('#themeBtn');const s=h.stored();
  assert.equal(s.tasks.length,60,'Total saved tasks capped at 60');assert.equal(new Set(s.tasks.map(t=>t.id)).size,60,'Tasks remain unique');
  assert.ok(s.notes.length<=40,'Notes capped at 40');assert.ok(s.tasks.every(t=>['Todo','Doing','Done'].includes(t.status)));
  assert.ok(s.tasks.every(t=>t.lane>=0&&t.lane<=2));assert.ok(s.notes.every(n=>Number.isFinite(n.x)&&Number.isFinite(n.y)));
  assert.ok(!Object.hasOwn(s.geo,'unknown'));assert.ok(!Object.hasOwn(s.geo,'create'),'Numeric strings must not pass finite-number geometry validation');
  assert.ok(!Object.hasOwn(s.boardPos,'nonexistent:road'));assert.ok(!Object.hasOwn(s.boardPos,'studio-north:invalid'));
  assert.equal(h.w.Object.prototype.polluted,undefined);
  addItem(h,'task','Overflow task');assert.match(h.q('#toast').textContent,/limit/i);assert.equal(h.stored().tasks.length,60);
  for(let i=s.notes.length;i<40;i++)addItem(h,'note','Fill remaining note '+i);
  addItem(h,'note','Overflow note');assert.match(h.q('#toast').textContent,/limit/i);assert.equal(h.stored().notes.length,40);h.healthy();
  return {loadedTasks:s.tasks.length,loadedNotes:s.notes.length,notesAtCapacity:40,rejectedOverflowActions:2,unknownGeometryKeysRejected:3};
});

await check('unsafe names and text use inert DOM',()=>{
  const h=boot();const payload='<img src=x onerror=globalThis.PWNED=1>';
  createCompany(h,payload);assert.equal(h.all('.d3co').length,4);
  addItem(h,'task','<svg/onload=globalThis.PWNED=2>'+'x'.repeat(100));
  addItem(h,'note','</div><img src=x onerror=globalThis.PWNED=3>');
  h.click('#orb');h.field('#chatform input','<img src=x onerror=globalThis.PWNED=4>');h.q('#chatform').dispatchEvent(new h.w.Event('submit',{bubbles:true,cancelable:true}));h.tick(0);
  assert.equal(h.w.PWNED,undefined);assert.equal(h.all('img,iframe,foreignObject,object,embed').length,0);
  assert.equal(h.all('script').length,1);assert.ok(!h.all('*').some(e=>[...e.attributes].some(a=>/^on/i.test(a.name))),'No inline event handlers created');
  const s=h.stored();assert.ok(s.extra.every(c=>c.name.length<=40&&!/[<>]/.test(c.name)));
  assert.ok(s.tasks.every(t=>!t.t||(t.t.length<=80&&!/[<>]/.test(t.t))));assert.ok(s.notes.every(n=>n.t.length<=80&&!/[<>]/.test(n.t)));
  assert.ok(h.q('#chatlog').textContent.includes('img src=x onerror=globalThis.PWNED=4'),'Payload remains inert text');h.healthy();
  return {unsafeInputSurfaces:4,injectedElements:0,networkCalls:h.network.length};
});

await check('rapid popup reopen keeps one live dialog per type',()=>{
  const h=boot();
  for(let i=0;i<50;i++){h.click('#orb');h.tick(0);assert.equal(h.all('#chat').length,1);assert.equal(h.q('#orb').getAttribute('aria-expanded'),'true');h.click('#orb');assert.equal(h.all('#chat').length,0);assert.equal(h.q('#orb').getAttribute('aria-expanded'),'false');}
  for(let i=0;i<25;i++){h.click('#helpBtn');h.click('#createBtn');h.click('#helpBtn');assert.equal(h.all('.pop[aria-label="Help"]').length,1);assert.equal(h.all('.pop[aria-label="Create"]').length,1);h.key('Escape');h.key('Escape');}
  h.healthy();assert.equal(h.all('.pop').length,0);return {chatCycles:50,mixedPopupCycles:25,uncaughtErrors:0};
});

await check('visible chat history stays bounded',()=>{
  const h=boot();h.click('#orb');h.tick(0);
  for(let i=0;i<80;i++){h.field('#chatform input','Message '+i);h.q('#chatform').dispatchEvent(new h.w.Event('submit',{bubbles:true,cancelable:true}));h.tick(0);}
  h.healthy();const count=h.all('#chatlog .msg').length;assert.ok(count<=60,`Visible message DOM must be bounded: observed ${count}, expected <=60`);
  return {messagesSent:80,visibleMessages:count};
});

await check('pending replies do not duplicate after chat close/reopen',()=>{
  const h=boot({reduce:false});h.click('#orb');h.tick(0);
  for(let i=0;i<10;i++){h.field('#chatform input','Message '+i);h.q('#chatform').dispatchEvent(new h.w.Event('submit',{bubbles:true,cancelable:true}));}
  h.click('#orb');h.click('#orb');h.tick(0);const before=h.all('#chatlog .msg').length;h.tick(400);const after=h.all('#chatlog .msg').length;
  h.healthy();assert.equal(after,before,`Reopened transcript already contains replies; pending callbacks must not append duplicates (${before} -> ${after})`);
  return {messagesSentBeforeReopen:10,messagesBefore:before,messagesAfter:after};
});

await check('same-clock task additions survive reload without ID collision',()=>{
  const h=boot();addItem(h,'task','Rapid task one');addItem(h,'task','Rapid task two');const s=h.stored();
  assert.equal(s.tasks.length,8);assert.equal(new Set(s.tasks.map(t=>t.id)).size,8,'Same-millisecond additions require unique task IDs');
  const again=boot({stored:JSON.stringify(s)});again.click('#themeBtn');const after=again.stored();
  assert.ok(after.tasks.some(t=>t.t==='Rapid task one'));assert.ok(after.tasks.some(t=>t.t==='Rapid task two'));again.healthy();
  return {sameClockAdds:2,tasksAfterReload:after.tasks.length};
});

await check('all content stays in one 3D world and company bounds',()=>{
  const h=boot({stored:JSON.stringify({flat:true})});h.healthy();assert.equal(h.all('.table').length,1);assert.equal(h.all('.d3co').length,3);
  assert.equal(camera(h).p,0,'Default camera must be the requested top view');
  assert.equal(h.w.getComputedStyle(h.q('#world')).transformStyle,'preserve-3d');assert.equal(h.q('#world').contains(h.q('#overlay')),true);assert.equal(h.q('#world').contains(h.q('#orb')),true);
  let boxes=0,boards=0;
  for(const root of h.all('.d3co')){
    const sheet=root.querySelector('.sheet[data-co]');assert.ok(sheet);const x=parseFloat(sheet.style.left),y=parseFloat(sheet.style.top),W=parseFloat(sheet.style.width),H=parseFloat(sheet.style.height);
    for(const face of root.querySelectorAll('.d3box > .d3face.top')){
      const box=face.parentElement,bx=parseFloat(box.style.left),by=parseFloat(box.style.top),bw=parseFloat(face.style.width),bh=parseFloat(face.style.height);
      assert.ok(bx>=x&&bx+bw<=x+W+.01&&by>=y&&by+bh<=y+H+.01,`Extruded wall/desk left company sheet: ${root.id} ${bx},${by},${bw},${bh}`);boxes++;
    }
    for(const board of root.querySelectorAll('.board')){
      const bx=parseFloat(board.style.left),by=parseFloat(board.style.top),bw=parseFloat(board.style.width),bh=parseFloat(board.style.height);
      assert.ok(bx>=x&&bx+bw<=x+W,`Board crosses company's horizontal area: ${board.dataset.key}`);
      assert.ok(by>=y+H&&by+bh<=y+H+740,`Board leaves company workbench: ${board.dataset.key}`);boards++;
    }
  }
  h.click('#helpBtn');h.click('#createBtn');h.click('#orb');h.tick(0);assert.ok(h.all('.pop').every(p=>h.q('#world').contains(p)));
  for(let i=0;i<12;i++){h.click('#d3Btn');const c=camera(h);assert.ok(c.p>=0);assert.equal(h.q('#tilt').classList.contains('flat'),false);assert.equal(h.w.getComputedStyle(h.q('#world')).transformStyle,'preserve-3d');}
  h.healthy();return {companyAreas:3,containedExtrudedBoxes:boxes,containedBoards:boards,worldPopups:3,topOrTiltAngleCycles:12};
});

await check('cursor zoom and inverse plane drag agree with CSS-3D projection',()=>{
  const h=boot();let anchors=0,drags=0,largestAnchorError=0;const base=Math.round(camera(h).a*180/Math.PI),orbits=[base-24,base,base+48];
  for(const angle of [0,20,38,52])for(const orbit of orbits){
    setAngle(h,angle);setOrbit(h,orbit);h.click('#fitBtn');
    for(const [sx,sy] of [[30,80],[720,450],[1390,810]]){
      const c0=camera(h),w=unproject(c0,sx,sy,0);wheel(h,h.q('#viewport'),sx,sy,-120);const c1=camera(h),p=project(c1,w.x,w.y,0);
      const error=Math.hypot(p.x-sx,p.y-sy);largestAnchorError=Math.max(largestAnchorError,error);assert.ok(error<.12,`Zoom moved cursor anchor by ${error}px at ${angle}/${orbit}`);anchors++;
    }
    const board=h.q('.board[data-key="studio-north:road"]'),header=board.querySelector('.bh'),c=camera(h),x=parseFloat(board.style.left),y=parseFloat(board.style.top);
    const start=project(c,x+20,y+12,45),end=project(c,x+45,y+32,45);
    pointer(h,'pointerdown',header,start.x,start.y);pointer(h,'pointermove',header,end.x,end.y);pointer(h,'pointerup',header,end.x,end.y);
    approx(parseFloat(board.style.left),x+25,.08,`Inverse drag X ${angle}/${orbit}`);approx(parseFloat(board.style.top),y+20,.08,`Inverse drag Y ${angle}/${orbit}`);drags++;
  }
  h.healthy();return {angleOrbitCombinations:12,cursorAnchors:anchors,inverseDrags:drags,largestAnchorErrorPx:largestAnchorError};
});

await check('popup world anchors retain readable inverse-billboard orientation',()=>{
  const h=boot();let anchors=0,orientations=0,maxError=0;
  const multiply=(a,b)=>a.map(row=>b[0].map((_,col)=>row.reduce((s,v,k)=>s+v*b[k][col],0)));
  const rx=p=>[[1,0,0],[0,Math.cos(p),-Math.sin(p)],[0,Math.sin(p),Math.cos(p)]];
  const rz=a=>[[Math.cos(a),-Math.sin(a),0],[Math.sin(a),Math.cos(a),0],[0,0,1]];
  const scale=k=>[[k,0,0],[0,k,0],[0,0,1]];
  const base=Math.round(camera(h).a*180/Math.PI),orbits=[base-24,base,base+48];
  for(const angle of [0,20,38,52])for(const orbit of orbits){
    setAngle(h,angle);setOrbit(h,orbit);h.click('#helpBtn');const p=h.q('.pop[aria-label="Help"]'),c=camera(h);
    const m=p.style.transform.match(/^translate3d\(([-\d.e+]+)px,\s*([-\d.e+]+)px,\s*([-\d.e+]+)px\) rotateZ\(([-\d.]+)deg\) rotateX\(([-\d.]+)deg\) scale\(([-\d.]+)\)$/i);
    assert.ok(m,`World popup transform missing: ${p.style.transform}`);const [x,y,z,a,pitch,k]=m.slice(1).map(Number);
    const point=project(c,x,y,z);const error=Math.hypot(point.x-570,point.y-100);maxError=Math.max(error,maxError);assert.ok(error<.12,`Popup placement differs from requested screen anchor by ${error}px`);anchors++;
    const matrix=multiply(multiply(multiply(multiply(multiply(scale(c.k),rx(c.p)),rz(c.a)),rz(a*Math.PI/180)),rx(pitch*Math.PI/180)),scale(k));
    matrix.forEach((row,i)=>row.forEach((v,j)=>approx(v,i===j?1:0,.0001,`Billboard matrix ${i}/${j}`)));orientations++;
    h.click(p.querySelector('.x'));
  }
  h.healthy();
  let depthPlanes=0,depthCorners=0,smallestWorldZ=Infinity,smallestBoardClearance=Infinity;
  const boxes=[
    {width:300,height:240,button:'#helpBtn',label:'short measured dialog'},
    {width:360,height:390,button:'#orb',label:'Donna measured dialog'},
    {width:360,height:720,button:'#helpBtn',label:'tall measured dialog'},
    {width:360,height:800,button:'#helpBtn',label:'unmeasured viewport-height fallback',fallback:true}
  ];
  for(const box of boxes){
    const g=boot({popupMetrics:box.fallback?null:{width:box.width,height:box.height}});
    for(const pitch of [0,20,38,52])for(const zoom of ['minimum','fit','maximum']){
      setAngle(g,pitch);
      if(zoom==='fit')g.click('#fitBtn');else for(let i=0;i<25;i++)g.click(zoom==='minimum'?'#zOut':'#zIn');
      g.click(box.button);g.tick(0);const popup=g.q('.pop'),c=camera(g);
      const m=popup.style.transform.match(/^translate3d\(([-\d.e+]+)px,\s*([-\d.e+]+)px,\s*([-\d.e+]+)px\) rotateZ\(([-\d.]+)deg\) rotateX\(([-\d.]+)deg\) scale\(([-\d.]+)\)$/i);
      assert.ok(m,`Depth-bearing popup transform missing: ${popup.style.transform}`);
      const [, ,z,a,p,k]=m.slice(1).map(Number);
      const local=multiply(multiply(rz(a*Math.PI/180),rx(p*Math.PI/180)),scale(k));
      const boardZ=Math.max(0,...g.all('.d3board').map(e=>Number(e.style.transform.match(/translateZ\(([-\d.]+)px\)/)?.[1]||0)));
      for(const [x,y] of [[0,0],[box.width,0],[0,box.height],[box.width,box.height]]){
        const worldZ=z+local[2][0]*x+local[2][1]*y,clearance=worldZ-boardZ;
        assert.ok(Number.isFinite(worldZ)&&clearance>0,`${box.label} corner ${x},${y} is behind the floor/board plane at pitch ${pitch}, zoom ${c.k}: worldZ=${worldZ}, boardZ=${boardZ}`);
        smallestWorldZ=Math.min(smallestWorldZ,worldZ);smallestBoardClearance=Math.min(smallestBoardClearance,clearance);depthCorners++;
      }
      depthPlanes++;g.click(popup.querySelector('.x'));
    }
    g.healthy();g.close();
  }
  return {worldAnchors:anchors,inverseBillboardMatrices:orientations,largestAnchorErrorPx:maxError,simulatedMeasuredPopupSizes:3,unmeasuredFallbackHeight:800,popupDepthPlanes:depthPlanes,popupDepthCorners:depthCorners,smallestWorldZ,smallestBoardClearance};
});

await check('camera bounds, nonfinite input, and zero-distance pinch stay finite',()=>{
  const h=boot();for(let i=0;i<100;i++)h.click('#zIn');assert.equal(camera(h).k,3.2);for(let i=0;i<100;i++)h.click('#zOut');assert.equal(camera(h).k,.12);
  for(let i=0;i<50;i++)h.click('[aria-label="Orbit left"]');approx(camera(h).a,-Math.PI,.00001);for(let i=0;i<50;i++)h.click('[aria-label="Orbit right"]');approx(camera(h).a,Math.PI,.00001);
  const v=h.q('#viewport');
  for(const [x,y,delta] of [[700,400,NaN],[NaN,400,-100],[700,Infinity,100],[1e308,-1e308,-Infinity],[Infinity,NaN,Infinity]]){wheel(h,v,x,y,delta);const c=camera(h);assert.ok(Math.abs(c.x)<=1e7&&Math.abs(c.y)<=1e7);}
  pointer(h,'pointerdown',v,400,400,1);pointer(h,'pointerdown',v,400,400,2);pointer(h,'pointermove',v,400,400,2);pointer(h,'pointermove',v,401,400,2);pointer(h,'pointercancel',v,400,400,2);pointer(h,'pointerup',v,400,400,1);
  camera(h);h.click('#fitBtn');h.healthy();assert.equal(v.classList.contains('panning'),false);
  return {zoomClicks:200,orbitClicks:100,nonfiniteEvents:5,zeroDistancePinches:1};
});

await check('tour and focus flights yield to keyboard, angle, orbit, and pointer input',()=>{
  const cases=[
    {name:'ArrowRight',act:h=>h.key('ArrowRight')},
    {name:'Escape',act:h=>h.key('Escape')},
    {name:'angle keyboard T',act:h=>h.key('t')},
    {name:'angle toolbar',act:h=>h.click('#d3Btn')},
    {name:'orbit toolbar',act:h=>h.click('[aria-label="Orbit right"]')},
    {name:'canvas pointer',act:h=>{pointer(h,'pointerdown',h.q('#viewport'),100,100);pointer(h,'pointermove',h.q('#viewport'),150,120);pointer(h,'pointerup',h.q('#viewport'),150,120);}}
  ];
  for(const tc of cases){const h=boot({reduce:false});h.click('#tourBtn');h.tick(128);tc.act(h);const after=h.q('#world').style.transform;h.tick(1500);assert.equal(h.q('#world').style.transform,after,`Flight continued after ${tc.name}`);h.healthy();h.close();}
  const h=boot({reduce:false});h.click('#createBtn');const input=h.q('#cName');input.focus();h.key('Escape',input);assert.equal(h.all('.pop[aria-label="Create"]').length,0,'Escape must close a popup while its input has focus');h.healthy();
  return {interruptionCases:cases.length,focusedInputEscapes:1};
});

await check('hundred-company navigation keeps selected detail live without popup loss',()=>{
  const extra=Array.from({length:97},(_,i)=>({id:'extra-'+i,name:'Extra '+String(i).padStart(2,'0'),kind:'company'}));
  const h=boot({stored:JSON.stringify({extra})});h.click('#orb');h.tick(0);h.field('#chatform input','Unsent across companies');
  h.field('#locin','Extra 96');h.key('Enter',h.q('#locin'));h.tick(0);
  assert.equal(h.all('.d3co').length,100);assert.equal(h.all('.sheet[data-co]').length,3);assert.ok(h.q('#d3co-extra-96').querySelector('.plansvg'));
  assert.equal(h.q('#chatform input').value,'Unsent across companies','Scene detail refresh discarded an open draft');assert.equal(h.all('#chat').length,1);
  const room=h.q('#d3co-extra-96 [data-room="dept-Engineering"]');h.key('Enter',room);h.tick(0);assert.ok(h.q('.pop[aria-label="Engineering"]').textContent.includes('Extra 96'));
  assert.ok(h.q('#world').contains(h.q('.pop[aria-label="Engineering"]')));h.healthy();
  return {companyCount:100,detailedBlueprints:3,farCompanyKeyboardRoom:1,draftPreserved:true};
});

// Tests inspect CSS matrices and DOM content through public inputs. JSDOM has no
// real hit testing, compositing, font metrics, or accessibility tree; root owns
// the complementary Sites browser review.

const receipt={target:targetLabel,sha256:crypto.createHash('sha256').update(html).digest('hex'),at:new Date().toISOString(),environment:{node:process.version,jsdom:jsdomVersion,execution:'JSDOM with synthetic canvas drawing and deterministic timers',limits:'No real browser layout, compositing, hit testing, font metrics, accessibility tree, or visual verification; automatic subresource loading is disabled and explicit network APIs are trapped.'},scope:filter?'targeted':'full',groupCount:results.length,results,passed:results.every(r=>r.status==='passed')};
const out=path.resolve(process.argv[3] || process.env.PROTOTYPE_REPORT || path.join(os.tmpdir(),'daftar-blueprint-prototype-checks.json'));
fs.mkdirSync(path.dirname(out),{recursive:true});
fs.writeFileSync(out,JSON.stringify(receipt,null,2)+'\n');
console.log(JSON.stringify(receipt,null,2));
process.exitCode=receipt.passed?0:1;
