// NON-GPU verification: real Three math/geometries/OrbitControls, simulated DOM and renderer.
// This cannot establish shader compilation, rasterization, browser hit testing or text legibility.
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {THREE as RealThree, OrbitControls} from '../../../cloud-workspace/public/concepts/blueprint-world-vendor.js';
import * as Core from '../../../cloud-workspace/public/concepts/blueprint-world-core.js';
const require=createRequire(new URL('../../../desktop-shell/package.json',import.meta.url));
const {JSDOM}=require('jsdom');
const sourcePath=new URL('../../../cloud-workspace/public/concepts/blueprint-world-renderer.js',import.meta.url);
const source=fs.readFileSync(sourcePath,'utf8');
const dom=new JSDOM('<!doctype html><canvas tabindex="0"></canvas>',{pretendToBeVisual:true,url:'https://local.invalid/'});
const {window}=dom,document=window.document,canvas=document.querySelector('canvas');
let hidden=false,time=0,nextFrame=1,renderCount=0,readyCount=0,cameraSeen,sceneSeen,api;
const frames=new Map(),errors=[],placements=[],selected=[],groups=[];
const report={artifactType:'blueprint-renderer-non-gpu-evidence/v1',runId:'blueprint-world-20261121',nodeId:'renderer',attempt:'local-fallback-1-review',scope:'NON-GPU: actual Three 0.187.0 math, geometries and OrbitControls; mocked WebGLRenderer and 2D text measurement; synthetic DOM/events',sourceSHA256:crypto.createHash('sha256').update(source).digest('hex'),groups,limitations:['No WebGL context, shader compilation or GPU rasterization was tested.','Synthetic text measurements do not validate glyph sizing or legibility.','Synthetic pointer events do not establish real-browser hit targets.']};
const rect={left:23,top:31,width:1280,height:720};
canvas.getBoundingClientRect=()=>({...rect,right:rect.left+rect.width,bottom:rect.top+rect.height});
Object.defineProperties(canvas,{clientWidth:{get:()=>rect.width},clientHeight:{get:()=>rect.height}});
Object.defineProperty(document,'hidden',{get:()=>hidden});
const captures=new Set();canvas.setPointerCapture=id=>captures.add(id);canvas.hasPointerCapture=id=>captures.has(id);canvas.releasePointerCapture=id=>captures.delete(id);
window.HTMLCanvasElement.prototype.getContext=function(type){if(type==='webgl2')return {};if(type!=='2d')return null;return {font:'20px sans-serif',measureText(text){const n=Number(this.font.match(/([\d.]+)px/)?.[1]||20);return {width:[...String(text)].length*n*.57};},fillText(){},fillStyle:'',textBaseline:''};};
const media=new window.EventTarget();media.matches=true;
const listeners=new Map(),eventAdd=window.EventTarget.prototype.addEventListener,eventRemove=window.EventTarget.prototype.removeEventListener;
const trackedTypes=new Set(['pointerdown','pointerup','pointermove','pointercancel','lostpointercapture','wheel','keydown','keyup','blur','resize','visibilitychange','webglcontextlost','webglcontextrestored','change','contextmenu']);
window.EventTarget.prototype.addEventListener=function(type,fn,options){if(trackedTypes.has(type)){const list=listeners.get(this)||[];if(!list.some(x=>x.type===type&&x.fn===fn&&x.capture===!!(typeof options==='boolean'?options:options?.capture)))list.push({type,fn,capture:!!(typeof options==='boolean'?options:options?.capture)});listeners.set(this,list);}return eventAdd.call(this,type,fn,options);};
window.EventTarget.prototype.removeEventListener=function(type,fn,options){const capture=!!(typeof options==='boolean'?options:options?.capture);listeners.set(this,(listeners.get(this)||[]).filter(x=>!(x.type===type&&x.fn===fn&&x.capture===capture)));return eventRemove.call(this,type,fn,options);};
const allocated={geometry:new Map(),material:new Map(),texture:new Map()},released={geometry:new Set(),material:new Set(),texture:new Set()};
for(const [kind,klass] of [['geometry',RealThree.BufferGeometry],['material',RealThree.Material],['texture',RealThree.Texture]]){
 const original=klass.prototype.dispose;klass.prototype.dispose=function(){released[kind].add(this.uuid);return original.call(this);};
}
class Renderer {
 constructor(){this.info={render:{calls:0,triangles:0},memory:{geometries:0,textures:0}};}
 setClearColor(){}setPixelRatio(){}setSize(){}dispose(){this.disposed=true;}
 render(scene,camera){sceneSeen=scene;cameraSeen=camera;renderCount++;scene.traverse(o=>{if(o.geometry){allocated.geometry.set(o.geometry.uuid,o.geometry);const p=o.geometry.attributes.position?.array;if(p)assert.ok([...p].every(Number.isFinite),'finite mesh positions');}if(o.isInstancedMesh)assert.ok([...o.instanceMatrix.array].every(Number.isFinite),'finite instance transforms');for(const m of [o.material].flat().filter(Boolean)){allocated.material.set(m.uuid,m);if(m.map)allocated.texture.set(m.map.uuid,m.map);}});}
}
let disconnected=false;
const context=vm.createContext({console,window,document,matchMedia:()=>media,performance:{now:()=>time},requestAnimationFrame:fn=>{const id=nextFrame++;frames.set(id,fn);return id;},cancelAnimationFrame:id=>frames.delete(id),ResizeObserver:class{observe(){}disconnect(){disconnected=true;}},setTimeout,clearTimeout});
const vendor=new vm.SyntheticModule(['THREE','OrbitControls'],function(){this.setExport('THREE',{...RealThree,WebGLRenderer:Renderer});this.setExport('OrbitControls',OrbitControls);},{context});
const core=new vm.SyntheticModule(['companyLayout','COLORS'],function(){this.setExport('companyLayout',Core.companyLayout);this.setExport('COLORS',Core.COLORS);},{context});
const module=new vm.SourceTextModule(source,{context,identifier:String(sourcePath)});
await module.link(id=>id.includes('vendor')?vendor:core);await module.evaluate();
let state=Core.seedState();
api=module.namespace.mountWorld({canvas,state,onReady:()=>readyCount++,onError:e=>errors.push(String(e.message||e)),onSelect:s=>selected.push(s),onPlace:(id,p)=>{placements.push({id,p:{...p}});Core.moveAssignment(state,id,{x:p.x,y:p.y});api.setState(state);}});
function flush(limit=150,step=16.6667){let count=0;while(frames.size&&count<limit){time+=step;const batch=[...frames.values()];frames.clear();for(const fn of batch)fn(time);count++;}assert.ok(count<limit,'renderer settles before frame cap');return count;}
function check(name,fn){try{const details=fn();groups.push({name,ok:true,...(details||{})});}catch(error){groups.push({name,ok:false,error:error.stack});}}
function pointer(type,p,id=1){const e=new window.MouseEvent(type,{bubbles:true,cancelable:true,button:0,clientX:p.x,clientY:p.y});Object.defineProperties(e,{pointerId:{value:id},isPrimary:{value:true}});canvas.dispatchEvent(e);}
function currentSelection(){const a=state.assignments.find(a=>a.companyId==='co-studio-north'&&state.departments.find(d=>d.id===a.departmentId)?.name==='Engineering');return {kind:'employee',id:a.id,assignmentId:a.id,companyId:a.companyId,departmentId:a.departmentId};}
function begin(){const s=currentSelection();api.focusEmployee(s.assignmentId);flush();api.setMode('arrange');flush();const original=api.getAnchor(s),p=api.project(original);pointer('pointerdown',p);return {s,original,p};}
check('Initial scene, stable idle and ready notification',()=>{const n=flush();assert.equal(readyCount,1);assert.equal(frames.size,0);const m=api.getMetrics();assert.equal(m.renderer,'WebGL2');assert.equal(m.mountedDetailedCompanies,3);assert.equal(m.mountedAssignments,38);return {settleFrames:n,mountedAssignments:m.mountedAssignments};});
check('Independent orthographic equations and ray round trips',()=>{
 let count=0,maxScreenError=0,maxWorldError=0;const s=currentSelection();api.focusCompany(s.companyId);flush();
 for(const tilt of [0,25,45,55])for(const yaw of [-36,0,72])for(const zoom of [.12,.6,3.2]){
  api.top();flush();api.tilt(tilt);flush();api.rotate(yaw);flush();api.zoom(zoom/api.getMetrics().camera.zoom);flush();
  const p=api.getAnchor(s),actual=api.project(p),c=api.getMetrics().camera,t=c.tilt*Math.PI/180,a=c.yaw*Math.PI/180,dx=p.x-c.x,dz=p.z-c.z;
  const expectedX=rect.left+rect.width/2+c.zoom*(Math.cos(a)*dx-Math.sin(a)*dz);
  const expectedY=rect.top+rect.height/2-c.zoom*(-Math.cos(t)*Math.sin(a)*dx+Math.sin(t)*p.y-Math.cos(t)*Math.cos(a)*dz);
  const screenError=Math.hypot(actual.x-expectedX,actual.y-expectedY);maxScreenError=Math.max(maxScreenError,screenError);assert.ok(screenError<1e-5,`independent screen projection ${screenError}`);
  const u=api.unproject(actual.x,actual.y,p.y);assert.ok(u);const worldError=Math.hypot(u.x-p.x,u.y-p.y,u.z-p.z);maxWorldError=Math.max(maxWorldError,worldError);assert.ok(worldError<1e-6,`round trip ${worldError}`);count++;
 }
 return {cases:count,maxScreenError,maxWorldError};
});
check('Actual generated room/sheet geometry is finite and contained',()=>{
 let inkMeshes=0,triangles=0;const sheets=sceneSeen.children.flatMap(g=>g.children||[]).filter(g=>g.isGroup&&g.children.some(c=>c.isInstancedMesh));assert.equal(sheets.length,3);
 for(const g of sheets)for(const mesh of g.children.filter(m=>m.userData.ownedGeometry)){const p=mesh.geometry.attributes.position;for(let i=0;i<p.count;i++){assert.ok(p.getX(i)>=-1e-5&&p.getX(i)<=1100+1e-5);assert.ok(p.getZ(i)>=-1e-5&&p.getZ(i)<=816+1e-5);}inkMeshes++;triangles+=p.count/3;}
 return {inkMeshes,triangles};
});
check('Normal-motion camera flight is interrupted by manual canvas input',()=>{
 media.matches=false;media.dispatchEvent(new window.Event('change'));api.home();assert.ok(frames.size);
 time+=16.6667;const batch=[...frames.values()];frames.clear();for(const fn of batch)fn(time);
 const stopped={...api.getMetrics().camera};canvas.dispatchEvent(new window.WheelEvent('wheel',{deltaY:0,clientX:640,clientY:360}));flush();
 const after=api.getMetrics().camera;assert.ok(Math.hypot(after.x-stopped.x,after.z-stopped.z)<1e-7);assert.ok(Math.abs(after.zoom-stopped.zoom)<1e-7);assert.equal(frames.size,0);
 return {reducedMotion:false};
});
check('Fast release commits a core-stable, contained point',()=>{api.top();flush();const b=begin(),target={x:b.p.x+45,y:b.p.y+32};pointer('pointermove',target);pointer('pointerup',target);flush();assert.equal(placements.length,1);const after=api.getAnchor(b.s),l=Core.companyLayout(state,b.s.companyId),seat=l.seats.find(s=>s.assignmentId===b.s.assignmentId),room=l.rooms.find(r=>r.departmentId===b.s.departmentId);assert.ok(Core.containsCircle(room,seat));assert.ok(Math.hypot(after.x-b.original.x,after.z-b.original.z)>1);assert.equal(after.x,seat.x);assert.equal(after.z,seat.y);return {commits:placements.length};});
check('Escape, pointer cancel, capture loss, blur and hidden restore exactly',()=>{
 let cases=0;for(const cancel of [()=>canvas.dispatchEvent(new window.KeyboardEvent('keydown',{key:'Escape',bubbles:true})),()=>pointer('pointercancel',{x:0,y:0}),()=>pointer('lostpointercapture',{x:0,y:0}),()=>window.dispatchEvent(new window.Event('blur')),()=>{hidden=true;document.dispatchEvent(new window.Event('visibilitychange'));hidden=false;document.dispatchEvent(new window.Event('visibilitychange'));}]){
  const beforeCommits=placements.length,b=begin();pointer('pointermove',{x:b.p.x+40,y:b.p.y+35});flush();cancel();flush();const a=api.getAnchor(b.s);assert.ok(Math.hypot(a.x-b.original.x,a.z-b.original.z)<1e-8);assert.equal(placements.length,beforeCommits);assert.equal(api.getMetrics().activeSpringCount,0);cases++;
 }return {cases};
});
check('Collisions, extreme corner targets and long frame gap remain contained',()=>{
 let cases=0;for(const delta of [[-10000,-10000],[10000,10000],[-10000,10000],[10000,-10000]]){const b=begin();pointer('pointermove',{x:b.p.x+delta[0],y:b.p.y+delta[1]});flush(150,250);pointer('pointerup',{x:b.p.x+delta[0],y:b.p.y+delta[1]});flush();const l=Core.companyLayout(state,b.s.companyId),seat=l.seats.find(s=>s.assignmentId===b.s.assignmentId),r=l.rooms.find(r=>r.departmentId===b.s.departmentId);assert.ok(Core.containsCircle(r,seat));assert.ok([seat.x,seat.y].every(Number.isFinite));for(const other of l.seats)if(other.assignmentId!==seat.assignmentId)assert.ok(Math.hypot(seat.x-other.x,seat.y-other.y)>=seat.r+other.r+4-1e-6);cases++;}return {cases,frameGapMs:250};
});
check('Malformed public camera/projection input remains finite',()=>{api.tilt(NaN);api.rotate(Infinity);api.zoom(-1);assert.equal(api.unproject(NaN,4),null);assert.equal(api.project({x:Infinity,y:0,z:0}).visible,false);assert.equal(api.getAnchor({kind:'board',companyId:'co-studio-north'}),null);const event=new window.WheelEvent('wheel',{deltaY:0,clientX:100,clientY:100});Object.defineProperty(event,'deltaY',{value:Infinity});canvas.dispatchEvent(event);flush();assert.ok(Object.values(api.getMetrics().camera).every(Number.isFinite));});
check('Camera survives state refresh and resource churn is bounded',()=>{const before={...api.getMetrics().camera};for(let i=0;i<8;i++){api.setState(Core.seedState());flush();}assert.deepEqual({...api.getMetrics().camera},before);const live={};for(const k of Object.keys(allocated))live[k]=[...allocated[k].keys()].filter(id=>!released[k].has(id)).length;assert.ok(live.texture<240);assert.ok(live.geometry<100);return {liveResources:live};});
check('Context restore notifies the host ready again',()=>{const before=readyCount;const event=new window.Event('webglcontextlost',{cancelable:true});canvas.dispatchEvent(event);assert.ok(event.defaultPrevented);assert.equal(api.getMetrics().contextLost,true);assert.equal(frames.size,0);canvas.dispatchEvent(new window.Event('webglcontextrestored'));flush();assert.equal(api.getMetrics().contextLost,false);assert.equal(readyCount,before+1);});
check('Dispose releases observed resources, listeners, observer and frames',()=>{api.dispose();api.dispose();assert.equal(frames.size,0);assert.ok(disconnected);const outstanding={};for(const k of Object.keys(allocated)){outstanding[k]=[...allocated[k].keys()].filter(id=>!released[k].has(id));assert.equal(outstanding[k].length,0,`${k} resources released`);}const left=[...listeners.values()].flat();assert.equal(left.length,0,`remaining events: ${left.map(x=>x.type).join(',')}`);const n=renderCount;window.dispatchEvent(new window.Event('resize'));assert.equal(frames.size,0);assert.equal(renderCount,n);return {observed:{geometry:allocated.geometry.size,material:allocated.material.size,texture:allocated.texture.size}};});
report.passed=groups.filter(g=>g.ok).length;report.failed=groups.filter(g=>!g.ok).length;report.renderCallsMocked=renderCount;report.expectedErrorCallbacks=errors;
fs.writeFileSync(new URL('./renderer-nongpu-evidence.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
process.exitCode=report.failed?1:0;
