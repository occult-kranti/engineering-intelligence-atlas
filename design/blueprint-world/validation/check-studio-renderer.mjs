// NON-GPU verification: real Three math/geometries/OrbitControls, simulated DOM and renderer.
// This cannot establish shader compilation, rasterization, browser hit testing or text legibility.
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {THREE as RealThree, OrbitControls} from '../../../cloud-workspace/public/concepts/blueprint-world-vendor.js';
import * as Core from '../../../cloud-workspace/public/concepts/blueprint-world-core.js';
const require=createRequire(import.meta.url);
const {JSDOM}=require('../../../desktop-shell/node_modules/jsdom/lib/api.js');
const sourcePath=new URL('../../../cloud-workspace/public/concepts/blueprint-world-renderer.js',import.meta.url);
const source=fs.readFileSync(sourcePath,'utf8');
const reliefSource=fs.readFileSync(new URL('../../../cloud-workspace/public/concepts/blueprint-world-relief.js',import.meta.url),'utf8');
const dom=new JSDOM('<!doctype html><canvas tabindex="0"></canvas>',{pretendToBeVisual:true,url:'https://local.invalid/'});
const {window}=dom,document=window.document,canvas=document.querySelector('canvas');
let hidden=false,time=0,nextFrame=1,renderCount=0,readyCount=0,cameraSeen,sceneSeen,api;
const frames=new Map(),errors=[],placements=[],selected=[],groups=[];
const report={artifactType:'studio-renderer-non-gpu-evidence/v1',runId:'blueprint-studio-20261121',nodeId:'renderer-integration',attempt:1,scope:'NON-GPU: actual Three 0.187.0 math, geometries and OrbitControls; mocked WebGLRenderer and 2D text measurement; synthetic DOM/events',sourceSHA256:crypto.createHash('sha256').update(source).digest('hex'),reliefSHA256:crypto.createHash('sha256').update(reliefSource).digest('hex'),groups,limitations:['No WebGL context, shader compilation or GPU rasterization was tested.','Synthetic text measurements do not validate glyph sizing or legibility.','Synthetic pointer events do not establish real-browser hit targets.']};
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
 constructor(){this.shadowMap={enabled:false,type:null};this.info={render:{calls:0,triangles:0},memory:{geometries:0,textures:0}};}
 setClearColor(){}setPixelRatio(){}setSize(){}dispose(){this.disposed=true;}
 render(scene,camera){sceneSeen=scene;cameraSeen=camera;renderCount++;scene.traverse(o=>{if(o.geometry){allocated.geometry.set(o.geometry.uuid,o.geometry);const p=o.geometry.attributes.position?.array;if(p)assert.ok([...p].every(Number.isFinite),'finite mesh positions');}if(o.isInstancedMesh)assert.ok([...o.instanceMatrix.array].every(Number.isFinite),'finite instance transforms');for(const m of [o.material].flat().filter(Boolean)){allocated.material.set(m.uuid,m);if(m.map)allocated.texture.set(m.map.uuid,m.map);}});}
}
let disconnected=false;
const context=vm.createContext({console,window,document,matchMedia:()=>media,performance:{now:()=>time},requestAnimationFrame:fn=>{const id=nextFrame++;frames.set(id,fn);return id;},cancelAnimationFrame:id=>frames.delete(id),ResizeObserver:class{observe(){}disconnect(){disconnected=true;}},setTimeout,clearTimeout});
const vendor=new vm.SyntheticModule(['THREE','OrbitControls'],function(){this.setExport('THREE',{...RealThree,WebGLRenderer:Renderer});this.setExport('OrbitControls',OrbitControls);},{context});
const core=new vm.SyntheticModule(['companyLayout','COLORS'],function(){this.setExport('companyLayout',Core.companyLayout);this.setExport('COLORS',Core.COLORS);},{context});
const module=new vm.SourceTextModule(source,{context,identifier:String(sourcePath)});
const reliefModule=new vm.SourceTextModule(reliefSource,{context,identifier:'blueprint-world-relief.js'});
await reliefModule.link(()=>vendor);
await module.link(id=>id.includes('vendor')?vendor:id.includes('relief')?reliefModule:core);await module.evaluate();
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
check('Camera survives state refresh and resource churn is bounded',()=>{const before={...api.getMetrics().camera};for(let i=0;i<8;i++){api.setState(Core.seedState());flush();}assert.deepEqual({...api.getMetrics().camera},before);const live={};for(const k of Object.keys(allocated))live[k]=[...allocated[k].keys()].filter(id=>!released[k].has(id)).length;assert.ok(live.texture<240);assert.ok(live.geometry<110);return {liveResources:live};});
check('Context restore notifies the host ready again',()=>{const before=readyCount;const event=new window.Event('webglcontextlost',{cancelable:true});canvas.dispatchEvent(event);assert.ok(event.defaultPrevented);assert.equal(api.getMetrics().contextLost,true);assert.equal(frames.size,0);canvas.dispatchEvent(new window.Event('webglcontextrestored'));flush();assert.equal(api.getMetrics().contextLost,false);assert.equal(readyCount,before+1);});

function boxes(role){const out=[];sceneSeen.updateMatrixWorld(true);sceneSeen.traverse(o=>{if(o.userData.reliefRole!==role||!o.isInstancedMesh)return;const m=new RealThree.Matrix4();for(let i=0;i<o.count;i++){o.getMatrixAt(i,m);m.premultiply(o.matrixWorld);out.push({mesh:o,index:i,box:new RealThree.Box3(new RealThree.Vector3(-.5,-.5,-.5),new RealThree.Vector3(.5,.5,.5)).applyMatrix4(m)});}});return out;}
check('Plan/Relief round trips retain exact anchors, state and camera',()=>{
 state=Core.seedState();api.setState(state);api.home();flush();const a=currentSelection();api.select(a);flush();
 const selections=[a,{kind:'company',id:a.companyId,companyId:a.companyId},{kind:'department',id:a.departmentId,companyId:a.companyId},{kind:'board',id:a.companyId+':roadmap',companyId:a.companyId,boardType:'roadmap'}];
 const anchors=selections.map(x=>JSON.stringify(api.getAnchor(x))),saved=JSON.stringify(state),camera=JSON.stringify(api.getMetrics().camera);
 for(let i=0;i<20;i++){api.setStyle(i%2?'relief':'plan');flush();assert.equal(JSON.stringify(state),saved);assert.equal(JSON.stringify(api.getMetrics().camera),camera);assert.deepEqual(selections.map(x=>JSON.stringify(api.getAnchor(x))),anchors);}
 assert.equal(api.getMetrics().style,'relief');assert.ok(api.getMetrics().relief.partitionInstances>0);
 const before=api.getMetrics().relief;api.zoom(1);flush();const after=api.getMetrics().relief;assert.equal(after.matrixUpdates,before.matrixUpdates);assert.equal(after.frustumUpdates,before.frustumUpdates);assert.equal(frames.size,0);
 return {styleTransitions:20,stableAnchors:selections.length};
});
check('Generated relief bounds and exact bottom door gaps',()=>{
 api.top();flush();let count=0,doors=0;
 for(const {mesh,index,box} of boxes('partition')){const co=state.companies.find(c=>c.id===mesh.userData.companyId),l=Core.companyLayout(state,co.id),r=l.rooms.find(r=>r.id===mesh.userData.roomIds[index]);assert.ok(r);const eps=1e-4;assert.ok(box.min.x>=co.x+r.x-eps&&box.max.x<=co.x+r.x+r.w+eps&&box.min.z>=co.z+r.y-eps&&box.max.z<=co.z+r.y+r.h+eps);assert.ok(box.min.y>=-eps&&box.max.y<=32+eps);const opening=new RealThree.Box3(new RealThree.Vector3(co.x+r.x+r.w-44+.01,.01,co.z+r.y+r.h-2.99),new RealThree.Vector3(co.x+r.x+r.w-14-.01,40,co.z+r.y+r.h-.01));assert.equal(box.intersectsBox(opening),false,'door gap remains unobstructed');count++;}
 for(const {mesh,index,box} of boxes('slab')){const co=state.companies.find(c=>c.id===mesh.userData.companyIds[index]),l=Core.companyLayout(state,co.id);assert.ok(box.min.x>=co.x-1e-3&&box.max.x<=co.x+l.width+1e-3&&box.min.z>=co.z-1e-3&&box.max.z<=co.z+l.height+1e-3);assert.ok(box.max.y<0&&box.min.y>=-20.001);}
 doors=state.companies.reduce((n,c)=>n+Core.companyLayout(state,c.id).rooms.filter(r=>!r.restricted).length,0);return {partitionBoxes:count,doorOpenings:doors,slabBoxes:boxes('slab').length};
});
check('Independent camera rays keep disc centers and rims clear of walls',()=>{
 let rays=0;media.matches=true;media.dispatchEvent(new window.Event('change'));
 for(const tilt of [0,25,45,55])for(const yaw of [-135,-45,0,45,135]){api.top();flush();api.tilt(tilt);flush();api.rotate(yaw);flush();const obstacles=boxes('partition').map(x=>x.box),direction=cameraSeen.getWorldDirection(new RealThree.Vector3());
  for(const co of state.companies)for(const seat of Core.companyLayout(state,co.id).seats)for(const [dx,dz] of [[0,0],[-seat.r,0],[seat.r,0],[0,-seat.r],[0,seat.r]]){const point=new RealThree.Vector3(co.x+seat.x+dx,3,co.z+seat.y+dz),origin=point.clone().addScaledVector(direction,-5000),ray=new RealThree.Ray(origin,direction);for(const obstacle of obstacles){const hit=ray.intersectBox(obstacle,new RealThree.Vector3());assert.ok(!hit||hit.distanceTo(origin)>=5000-1e-4,`wall occludes ${seat.assignmentId} at ${tilt}/${yaw}, rim ${dx}/${dz}`);}rays++;}
 }
 return {rays,tilts:4,yaws:5};
});
check('Overview fits projected raised envelopes in laptop viewport insets',()=>{
 let corners=0;for(const size of [[1280,720],[1440,900]]){rect.width=size[0];rect.height=size[1];window.dispatchEvent(new window.Event('resize'));flush();api.overview('co-studio-north');flush();const co=state.companies.find(c=>c.id==='co-studio-north'),l=Core.companyLayout(state,co.id),m=api.getMetrics().camera;assert.ok(Math.abs(m.tilt-50)<1e-5&&Math.abs(m.yaw+24)<1e-5);for(const x of [co.x-170,co.x+l.width+170])for(const z of [co.z-145,co.z+l.height+40])for(const y of [-24,32]){const p=api.project({x,y,z});assert.ok(p.x>=rect.left+64-1e-5&&p.x<=rect.left+rect.width-64+1e-5&&p.y>=rect.top+90-1e-5&&p.y<=rect.top+rect.height-90+1e-5);corners++;}}
 return {viewports:2,corners};
});
check('Company-first Overview excludes a distant spine and restores editing bounds',()=>{
 const moved=Core.seedState(),co=moved.companies[0];co.x=-60000;co.z=50000;state=Core.validateState(moved);api.setState(state);api.overview(co.id);flush();const l=Core.companyLayout(state,co.id),m=api.getMetrics();assert.equal(m.overviewIncludesSpine,false);assert.equal(m.overviewActive,true);let corners=0;
 for(const x of [co.x-170,co.x+l.width+170])for(const z of [co.z-40,co.z+l.height+40])for(const y of [-24,32]){const p=api.project({x,y,z});assert.ok(p.visible&&p.x>=rect.left+64-1e-5&&p.x<=rect.left+rect.width-64+1e-5&&p.y>=rect.top+90-1e-5&&p.y<=rect.top+rect.height-90+1e-5);corners++;}
 const department=state.departments.find(d=>d.companyId===co.id);api.focusDepartment(department.id);flush();let edit=api.getMetrics();assert.equal(edit.overviewActive,false);assert.equal(edit.minimumZoom,.12);assert.equal(edit.cameraDistance,2400);assert.ok(edit.camera.zoom>=.12);api.overview(co.id);flush();api.focusCompany(co.id);flush();edit=api.getMetrics();assert.equal(edit.overviewActive,false);assert.equal(edit.minimumZoom,.12);assert.equal(edit.cameraDistance,2400);state=Core.seedState();api.setState(state);api.home();flush();return {companyPosition:{x:co.x,z:co.z},corners,overviewIncludesSpine:m.overviewIncludesSpine,editingMinimumZoom:edit.minimumZoom};
});
check('Relief validation is atomic; invalid and distant room data rejected',()=>{
 const scene=new RealThree.Scene(),layer=reliefModule.namespace.createReliefLayer({scene,invalidate(){}}),co=state.companies[0],l=Core.companyLayout(state,co.id),good={id:co.id,x:co.x,z:co.z,width:l.width,height:l.height,detailed:true,rooms:l.rooms.filter(r=>!r.restricted).map(r=>({...r,depth:0}))};
 layer.setCompanies([good]);layer.setStyle('relief');const before=JSON.stringify(layer.getMetrics());let rejected=0;for(const bad of [[{...good,rooms:[{...good.rooms[0],x:-1}]}],[{...good,rooms:[{...good.rooms[0],w:2000}]}],[{...good,detailed:false}],Array.from({length:4},(_,i)=>({...good,id:'co-extra-'+i,x:i*1260}))]){assert.throws(()=>layer.setCompanies(bad));assert.equal(JSON.stringify(layer.getMetrics()),before);rejected++;}layer.dispose();return {rejected};
});

check('Nested department cutaway protects parent and child seat rims',()=>{
 state=Core.seedState();const parent=state.departments.find(d=>d.companyId==='co-studio-north'&&d.name==='Engineering');const child=Core.createDepartment(state,{companyId:parent.companyId,parentId:parent.id,name:'Quality'}),grandchild=Core.createDepartment(state,{companyId:parent.companyId,parentId:child.id,name:'Automation'});Core.hireEmployee(state,{companyId:parent.companyId,departmentId:child.id,name:'Nested One',role:'Engineer'});Core.hireEmployee(state,{companyId:parent.companyId,departmentId:grandchild.id,name:'Nested Two',role:'Engineer'});api.setState(state);api.focusCompany(parent.companyId);flush();let rays=0;
 for(const tilt of [25,55])for(const yaw of [-45,45]){api.top();flush();api.tilt(tilt);flush();api.rotate(yaw);flush();const obstacles=boxes('partition').map(x=>x.box),dir=cameraSeen.getWorldDirection(new RealThree.Vector3());for(const seat of Core.companyLayout(state,parent.companyId).seats)for(const[dx,dz]of[[0,0],[-seat.r,0],[seat.r,0],[0,-seat.r],[0,seat.r]]){const p=new RealThree.Vector3(seat.x+dx,3,seat.y+dz),origin=p.clone().addScaledVector(dir,-5000),ray=new RealThree.Ray(origin,dir);for(const b of obstacles){const hit=ray.intersectBox(b,new RealThree.Vector3());assert.ok(!hit||hit.distanceTo(origin)>=5000-1e-4);}rays++;}}
 state=Core.seedState();api.setState(state);flush();return {nestedDepth:2,rays};
});
check('Shadow render targets are released exactly once on style removal',()=>{
 const scene=new RealThree.Scene(),layer=reliefModule.namespace.createReliefLayer({scene,invalidate(){}}),co=state.companies[0],l=Core.companyLayout(state,co.id);layer.setCompanies([{id:co.id,x:co.x,z:co.z,width:l.width,height:l.height,detailed:true,rooms:l.rooms.filter(r=>!r.restricted).map(r=>({...r,depth:0}))}]);layer.setStyle('relief');let key;scene.traverse(o=>{if(o.isDirectionalLight)key=o;});const a=new RealThree.WebGLRenderTarget(8,8),b=new RealThree.WebGLRenderTarget(8,8);let map=0,pass=0;a.addEventListener('dispose',()=>map++);b.addEventListener('dispose',()=>pass++);key.shadow.map=a;key.shadow.mapPass=b;layer.setStyle('plan');layer.dispose();assert.equal(map,1);assert.equal(pass,1);return {simulatedRenderTargets:2,actualGpuAllocation:false};
});
check('Dense 1000-employee company fits Overview with bounded labels',()=>{
 const dense=Core.seedState(),co=dense.companies[0],dept=dense.departments.find(d=>d.companyId===co.id&&d.name==='Engineering');for(let i=dense.employees.length;i<1000;i++){const id='em-dense-'+i;dense.employees.push({id,homeCompanyId:co.id,name:'Dense Employee '+i,role:'Engineer',reportsToId:co.directorId});dense.assignments.push({id:'as-dense-'+i,employeeId:id,companyId:co.id,departmentId:dept.id,kind:'resident',x:null,y:null});}state=Core.validateState(dense);const start=performance.now();api.setState(state);api.overview(co.id);flush();const elapsed=performance.now()-start,l=Core.companyLayout(state,co.id),m=api.getMetrics(),live={};for(const kind of ['geometry','material','texture'])live[kind]=[...allocated[kind].keys()].filter(id=>!released[kind].has(id)).length;
 report.denseObservation={employees:state.employees.length,departmentAssignments:state.assignments.filter(a=>a.departmentId===dept.id).length,companyHeight:l.height,zoom:m.camera.zoom,liveObjects:live,cpuBuildAndSyntheticFramesMs:elapsed};
 assert.ok(m.camera.zoom<.12&&m.camera.zoom>=.001);assert.ok(live.texture<750);for(const x of [co.x,co.x+l.width])for(const z of [co.z,co.z+l.height])for(const y of [-24,32]){const p=api.project({x,y,z});assert.ok(p.visible&&p.x>=rect.left+64-1e-4&&p.x<=rect.left+rect.width-64+1e-4&&p.y>=rect.top+90-1e-4&&p.y<=rect.top+rect.height-90+1e-4);}
 api.top();flush();assert.ok(api.getMetrics().camera.zoom>=.12);state=Core.seedState();api.setState(state);api.home();flush();return report.denseObservation;
});

function capacityState(){const template=Core.seedState(),s={version:1,companies:[],offices:[],departments:[],employees:[],assignments:[],tasks:[],notes:[]};const sourceDepartments=template.departments.filter(d=>d.companyId==='co-studio-north');for(let i=0;i<100;i++){const cid='co-cap-'+i,oid='of-cap-'+i,dir='em-cap-'+i+'-0',assistant='em-cap-'+i+'-1';s.companies.push({id:cid,name:'Capacity '+String(i).padStart(2,'0'),parentId:null,x:i*1260,z:0,width:1100,officeId:oid,directorId:dir,assistantId:assistant});s.offices.push({id:oid,companyId:cid,name:'Main office'});sourceDepartments.forEach((d,j)=>s.departments.push({id:'dp-cap-'+i+'-'+j,companyId:cid,officeId:oid,parentId:null,name:d.name,color:d.color,order:j}));for(let j=0;j<10;j++){const eid='em-cap-'+i+'-'+j,did='dp-cap-'+i+'-'+(j<2?0:1+(j-2)%5);s.employees.push({id:eid,homeCompanyId:cid,name:'Employee '+i+' '+j,role:j===0?'Director':j===1?'Donna':'Engineer',reportsToId:j===0?null:dir});s.assignments.push({id:'as-cap-'+i+'-'+j,employeeId:eid,companyId:cid,departmentId:did,kind:'resident',x:null,y:null});}}return Core.validateState(s);}
check('100-company / 1000-employee CPU and object capacity observation',()=>{
 const cap=capacityState(),start=performance.now();state=cap;api.setState(state);api.select({kind:'company',id:'co-cap-0',companyId:'co-cap-0'});api.focusCompany('co-cap-99');flush();const elapsed=performance.now()-start,m=api.getMetrics();assert.equal(state.companies.length,100);assert.equal(state.employees.length,1000);assert.equal(m.mountedDetailedCompanies,3);assert.equal(m.mountedAssignments,30);assert.ok(m.relief.partitionInstances<=90);assert.ok(m.relief.shadowRadius<=1800);assert.ok(m.relief.shadowWindow.width<=3600&&m.relief.shadowWindow.height<=3600);assert.ok(m.detailCompanyIds.includes('co-cap-0')&&m.detailCompanyIds.includes('co-cap-99'));
 const current={geometry:0,material:0,texture:0,texturePixels:0};for(const kind of ['geometry','material','texture'])for(const [id,value]of allocated[kind])if(!released[kind].has(id)){current[kind]++;if(kind==='texture')current.texturePixels+=(value.image?.width||0)*(value.image?.height||0);}
 assert.ok(current.texture<750,'bounded per-label texture count');assert.ok(current.texturePixels<16e6,'bounded aggregate source bitmap area');return {companies:100,employees:1000,mountedAssignments:m.mountedAssignments,detailedCompanies:m.detailCompanyIds,partitionInstances:m.relief.partitionInstances,slabInstances:m.relief.slabInstances,shadowWindow:m.relief.shadowWindow,cpuBuildAndSyntheticFramesMs:elapsed,liveObjects:current,measurement:'Node CPU + synthetic text canvas object counts only; no GPU timing or FPS'};
});

check('Dispose releases observed resources, listeners, observer and frames',()=>{api.dispose();api.dispose();assert.equal(frames.size,0);assert.ok(disconnected);const outstanding={};for(const k of Object.keys(allocated)){outstanding[k]=[...allocated[k].keys()].filter(id=>!released[k].has(id));assert.equal(outstanding[k].length,0,`${k} resources released`);}const left=[...listeners.values()].flat();assert.equal(left.length,0,`remaining events: ${left.map(x=>x.type).join(',')}`);const n=renderCount;window.dispatchEvent(new window.Event('resize'));assert.equal(frames.size,0);assert.equal(renderCount,n);return {observed:{geometry:allocated.geometry.size,material:allocated.material.size,texture:allocated.texture.size}};});
report.passed=groups.filter(g=>g.ok).length;report.failed=groups.filter(g=>!g.ok).length;report.renderCallsMocked=renderCount;report.expectedErrorCallbacks=errors;
fs.writeFileSync(new URL('./studio-renderer-evidence.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
process.exitCode=report.failed?1:0;
