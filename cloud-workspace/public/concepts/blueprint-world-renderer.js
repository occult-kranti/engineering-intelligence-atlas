// Local swarm authorship. Run blueprint-world-20261121 / renderer / local-fallback-1.
// Plan units are UI design units; X/Z is the plan and Y is elevation.
import { THREE, OrbitControls } from './blueprint-world-vendor.js';
import { companyLayout, COLORS } from './blueprint-world-core.js';
import { createReliefLayer } from './blueprint-world-relief.js';

const INK = '#142c49', PAPER = '#f6f1e5', EPS = 1e-6, DEG = Math.PI / 180;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const finite = (...v) => v.every(Number.isFinite);
const initials = name => String(name || '?').trim().split(/\s+/u).slice(0, 2).map(s => Array.from(s)[0] || '').join('').toUpperCase();
const safe = (fn, ...args) => { try { return fn?.(...args); } catch { return undefined; } };

export function mountWorld({ canvas, state: initial, style: initialStyle = 'relief', onSelect, onPlace, onCameraChange, onReady, onError } = {}) {
  let renderer;
  try {
    if (!canvas?.getContext) throw new Error('The blueprint canvas is unavailable.');
    const context = canvas.getContext('webgl2', { antialias: true, alpha: false });
    if (!context) throw new Error('WebGL 2 is unavailable. Enable hardware acceleration or use a supported browser.');
    renderer = new THREE.WebGLRenderer({ canvas, context, antialias: true });
  } catch (error) {
    safe(onError, error);
    const no = () => {};
    return { setState:no, select:no, focusCompany:no, focusDepartment:no, focusEmployee:no, focusBoard:no, setMode:no, setStyle:no, overview:no, top:no, tilt:no, rotate:no, zoom:no, fit:no, home:no, getAnchor:()=>null, project:()=>({x:0,y:0,visible:false}), unproject:()=>null, subscribeFrame:()=>no, getMetrics:()=>({renderer:'unavailable',error:String(error.message || error)}), dispose:no };
  }
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor('#071c33');
  let style = initialStyle === 'plan' ? 'plan' : 'relief';
  renderer.shadowMap.enabled = style === 'relief';
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-640, 640, 400, -400, .1, 30000);
  camera.up.set(0, 1, 0);
  camera.position.set(550, 2400, 500.0024);
  const controls = new OrbitControls(camera, canvas);
  controls.target.set(550, 0, 500);
  controls.enableDamping = true;
  controls.dampingFactor = .16;
  controls.minPolarAngle = 1e-6;
  controls.maxPolarAngle = 55 * DEG;
  controls.minZoom = .12;
  controls.maxZoom = 3.2;
  controls.zoomToCursor = true;
  controls.screenSpacePanning = false;
  canvas.style.touchAction = 'none';
  const previousTabIndex = canvas.getAttribute('tabindex');
  if (previousTabIndex === null) canvas.tabIndex = 0;
  const media = matchMedia('(prefers-reduced-motion: reduce)');
  const subscribers = new Set(), listeners = [], materials = new Map(), records = new Map();
  const owned = new Set(), companyGroups = new Map(), seats = new Map(), labelMeshes = new Set();
  let state = initial, companies = new Map(), employees = new Map(), assignments = new Map(), departments = new Map(), layouts = new Map();
  let selection = null, focusId = null, mode = 'pan', raf = 0, disposed = false, lost = false, ready = false;
  let frames = 0, lastFrame = 0, flight = null, drag = null, press = null, detailsKey = '', labelDetail = false;
  let width = 1, height = 1, ratio = 1, currentRich = [], mainGroup = new THREE.Group();
  let cameraDistance=2400,overviewActive=false,overviewIncludesSpine=true;
  const metrics = { mountedDetailedCompanies:0, lightweightCompanyCount:0, visibleAssignments:0, cancelledDrags:0, committedDrags:0 };
  scene.add(mainGroup);
  const raycaster = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const scratch = new THREE.Vector3(), matrix = new THREE.Matrix4();
  const geometry = g => { owned.add(g); return g; };
  const unitPlane = geometry(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2));
  const circleGeo = geometry(new THREE.CircleGeometry(1, 40).rotateX(-Math.PI / 2));
  const mat = color => {
    if (!materials.has(color)) materials.set(color, new THREE.MeshBasicMaterial({color, side:THREE.DoubleSide}));
    return materials.get(color);
  };
  function listen(target, event, fn, options) { target.addEventListener(event, fn, options); listeners.push(() => target.removeEventListener(event, fn, options)); }
  function invalidate() { if (!raf && !disposed && !lost && !document.hidden) raf = requestAnimationFrame(frame); }
  function rectMesh(group, x, z, w, h, y, color) {
    const m = new THREE.Mesh(unitPlane, mat(color)); m.position.set(x + w / 2, y, z + h / 2); m.scale.set(w, 1, h); group.add(m); return m;
  }
  function disc(group, x, z, r, y, color) { const m = new THREE.Mesh(circleGeo, mat(color)); m.position.set(x,y,z); m.scale.set(r,1,r); group.add(m); return m; }
  function segment(out, x1, z1, x2, z2, thickness = 1.4, y = 1.3) {
    const dx=x2-x1, dz=z2-z1, len=Math.hypot(dx,dz); if (len<EPS) return;
    const px=-dz/len*thickness/2, pz=dx/len*thickness/2;
    out.push(x1+px,y,z1+pz,x1-px,y,z1-pz,x2+px,y,z2+pz,x2+px,y,z2+pz,x1-px,y,z1-pz,x2-px,y,z2-pz);
  }
  function outline(out, x,z,w,h,t=1.3,y=1.3,door=false) {
    segment(out,x,z,x+w,z,t,y); segment(out,x,z,x,z+h,t,y); segment(out,x+w,z,x+w,z+h,t,y);
    if (door && w>90 && h>90) {
      const hinge=x+w-44, r=30; segment(out,x,z+h,hinge,z+h,t,y); segment(out,hinge+r,z+h,x+w,z+h,t,y);
      segment(out,hinge,z+h,hinge,z+h-r,.85,y);
      for(let i=0;i<18;i++) { const a=-Math.PI/2*i/18,b=-Math.PI/2*(i+1)/18; segment(out,hinge+r*Math.cos(a),z+h+r*Math.sin(a),hinge+r*Math.cos(b),z+h+r*Math.sin(b),.8,y); }
    } else segment(out,x,z+h,x+w,z+h,t,y);
  }
  function inkMesh(group, positions, color=INK) {
    if (!positions.length) return null;
    const g = new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
    const mesh = new THREE.Mesh(g, mat(color)); mesh.userData.ownedGeometry = true; group.add(mesh); return mesh;
  }
  function ring(group,r,color,dashed=false,y=4) {
    const a=[]; for(let i=0;i<64;i++) { if(dashed && i%8>4) continue; const t=i/64*Math.PI*2,u=(i+1)/64*Math.PI*2; segment(a,r*Math.cos(t),r*Math.sin(t),r*Math.cos(u),r*Math.sin(u),1.4,y); } return inkMesh(group,a,color);
  }
  function label(group,text,x,z,size=20,color=INK,maxWidth=300,align='left',level=0,serif=false) {
    const c=document.createElement('canvas'), ctx=c.getContext('2d'); if(!ctx) return null;
    const family=serif?'Georgia,serif':'system-ui,-apple-system,Segoe UI,sans-serif';
    const font=`${serif?'600':'600'} ${size*2}px ${family}`; ctx.font=font;
    let value=String(text || ''); const max=maxWidth*2;
    if(ctx.measureText(value).width>max) { const chars=Array.from(value); while(chars.length && ctx.measureText(chars.join('')+'…').width>max) chars.pop(); value=chars.join('')+'…'; }
    const tw=Math.max(2,Math.ceil(ctx.measureText(value).width)+8), th=Math.ceil(size*2.7);
    c.width=Math.min(2048,tw); c.height=Math.max(16,th); ctx.font=font; ctx.fillStyle=color; ctx.textBaseline='middle'; ctx.fillText(value,4,c.height/2);
    const tex=new THREE.CanvasTexture(c); tex.colorSpace=THREE.SRGBColorSpace; tex.generateMipmaps=true;
    const m=new THREE.MeshBasicMaterial({map:tex,transparent:true,depthWrite:false,alphaTest:.025,side:THREE.DoubleSide});
    const mesh=new THREE.Mesh(unitPlane,m); mesh.scale.set(c.width/2,1,c.height/2);
    mesh.position.set(x+(align==='center'?0:c.width/4),4.8,z); mesh.userData.label=true; mesh.userData.detail=level;
    group.add(mesh); labelMeshes.add(mesh); return mesh;
  }
  function disposeGroup(group) {
    group.traverse(o=>{
      if(o.userData.label) { o.material.map?.dispose(); o.material.dispose();labelMeshes.delete(o); }
      if(o.userData.ownedGeometry) o.geometry.dispose();
      if(o.isInstancedMesh) o.dispose();
    });
    group.removeFromParent();
  }
  const gridMaterial=new THREE.ShaderMaterial({
    vertexShader:'varying vec2 world; void main(){ vec4 p=modelMatrix*vec4(position,1.0); world=p.xz; gl_Position=projectionMatrix*viewMatrix*p; }',
    fragmentShader:'varying vec2 world; void main(){ vec2 p=world/24.; vec2 g=abs(fract(p-.5)-.5)/max(fwidth(p),vec2(.001)); float line=1.-min(min(g.x,g.y),1.); vec2 q=world/120.; vec2 h=abs(fract(q-.5)-.5)/max(fwidth(q),vec2(.001)); float major=1.-min(min(h.x,h.y),1.); vec3 bg=vec3(.025,.075,.125); gl_FragColor=vec4(bg+vec3(.025,.045,.065)*line+vec3(.015,.023,.032)*major,1.); }',
    side:THREE.DoubleSide
  });
  const grid=new THREE.Mesh(unitPlane,gridMaterial); grid.scale.set(50000,1,50000); grid.position.y=-4; scene.add(grid);
  const highlight=new THREE.Group(); ring(highlight,25,'#d6ae57',false,6); scene.add(highlight); highlight.visible=false;
  const relief=createReliefLayer({scene,invalidate});
  relief.setStyle(style);grid.position.y=style==='relief'?-24:-4;

  function indexState(next) {
    state=next; companies=new Map((state?.companies||[]).map(c=>[c.id,c])); employees=new Map((state?.employees||[]).map(e=>[e.id,e]));
    assignments=new Map((state?.assignments||[]).map(a=>[a.id,a])); departments=new Map((state?.departments||[]).map(d=>[d.id,d])); layouts=new Map();
    for(const co of companies.values()) { try { const l=companyLayout(state,co.id); if(finite(co.x,co.z,l.width,l.height)) layouts.set(co.id,l); } catch(error) { safe(onError,error); } }
  }
  function colorFor(employee,department) { const r=employee?.role?.toLowerCase()||''; return r.includes('donna')?COLORS.donna:r.includes('director')||r.includes('ceo')?COLORS.director:department?.color||COLORS.employee; }
  function buildCompany(co,rich) {
    const l=layouts.get(co.id); if(!l) return;
    const group=new THREE.Group(); group.position.set(co.x,0,co.z); mainGroup.add(group); companyGroups.set(co.id,group);
    group.userData={companyId:co.id,worldRole:'company-plan'};
    if(style==='plan')rectMesh(group,6,8,l.width,l.height,-.9,'#040f1e'); rectMesh(group,0,0,l.width,l.height,0,PAPER);
    const strokes=[]; outline(strokes,7,7,l.width-14,l.height-14,1.8); outline(strokes,12,12,l.width-24,l.height-24,.65);
    const count=new Set((state.assignments||[]).filter(a=>a.companyId===co.id).map(a=>a.employeeId)).size;
    label(group,co.name.toUpperCase(),40,46,36,INK,770,'left',0,true);
    label(group,`${count} employee definitions · ${co.parentId?'Sub-company':'Company'}`,42,77,15,'#5e6f7d',720);
    if(rich) {
      const ownAssignments=(state.assignments||[]).filter(a=>a.companyId===co.id);
      const byRoom=new Map(); for(const a of ownAssignments) byRoom.set(a.departmentId,(byRoom.get(a.departmentId)||0)+1);
      for(const r of l.rooms) {
        if(!finite(r.x,r.y,r.w,r.h) || r.w<=0 || r.h<=0) continue;
        const tint=r.restricted?COLORS.restricted:'#'+new THREE.Color(r.color||COLORS.employee).lerp(new THREE.Color(PAPER),.88).getHexString();
        let depth=0,parent=departments.get(r.departmentId)?.parentId;
        while(parent&&depth<3){depth++;parent=departments.get(parent)?.parentId;}
        rectMesh(group,r.x,r.y,r.w,r.h,.55+depth*.08,tint);
        outline(strokes,r.x,r.y,r.w,r.h,1.7,1.3,!r.restricted); if(r.w>30&&r.h>30) outline(strokes,r.x+4,r.y+4,r.w-8,r.h-8,.65,1.3,!r.restricted);
        if(r.restricted) {
          const hatch=[]; for(let x=r.x-r.h;x<r.x+r.w;x+=12) { const start=Math.max(r.x,x),end=Math.min(r.x+r.w,x+r.h); if(end>start) segment(hatch,start,r.y+r.h-(start-x),end,r.y+r.h-(end-x),.65,1.4); } inkMesh(group,hatch,'#677381');
          label(group,'ACCESS REQUIRED',r.x+r.w/2,r.y+r.h/2,12,'#f8f5ec',r.w-18,'center');
        } else {
          label(group,`${r.name.toUpperCase()}  ${byRoom.get(r.departmentId)||0}`,r.x+15,r.y+24,20,INK,r.w-30);
        }
      }
      for(const b of l.boards) {
        rectMesh(group,b.x,b.y,b.w,b.h,.5,'#eee7d8'); outline(strokes,b.x,b.y,b.w,b.h,1.15);
        label(group,b.type.toUpperCase(),b.x+14,b.y+24,17,INK,b.w-28);
        const tasks=(state.tasks||[]).filter(t=>t.companyId===co.id), notes=(state.notes||[]).filter(n=>n.companyId===co.id);
        if(b.type==='roadmap') {
          const lanes=['now','next','later']; segment(strokes,b.x+32,b.y+82,b.x+b.w-32,b.y+82,1.3,2);
          lanes.forEach((lane,i)=>{const x=b.x+32+i*(b.w-64)/2; disc(group,x,b.y+82,5,3,i===0?'#6e9b85':i===1?'#7b9bc9':PAPER); label(group,lane.toUpperCase(),x,b.y+108,12,INK,65,'center'); label(group,String(tasks.filter(t=>t.lane===lane).length),x,b.y+132,17,'#657180',55,'center');});
        } else if(b.type==='ownership') {
          tasks.slice(0,3).forEach((t,i)=>{const y=b.y+62+i*34; outline(strokes,b.x+14,y-5,10,10,.9,2); if(t.status==='done') segment(strokes,b.x+15,y,b.x+23,y,2,2); label(group,t.title,b.x+34,y,12.5,INK,b.w-48);});
          if(!tasks.length) label(group,'Add the first task',b.x+14,b.y+72,13,'#6a7887',b.w-28);
        } else if(b.type==='whiteboard') {
          notes.slice(0,3).forEach((n,i)=>label(group,'• '+n.text,b.x+14,b.y+63+i*34,13,INK,b.w-28));
          if(!notes.length) label(group,'A place to think together',b.x+14,b.y+72,13,'#6a7887',b.w-28);
        } else {
          const roots=(state.departments||[]).filter(d=>d.companyId===co.id&&!d.parentId).slice(0,5), cx=b.x+b.w/2;
          disc(group,cx,b.y+68,14,3,COLORS.director); label(group,'D',cx,b.y+68,13,INK,24,'center');
          segment(strokes,cx,b.y+83,cx,b.y+108,.9,2);
          roots.forEach((d,i)=>{const x=b.x+25+i*(b.w-50)/Math.max(1,roots.length-1); segment(strokes,cx,b.y+108,x,b.y+108,.8,2); segment(strokes,x,b.y+108,x,b.y+125,.8,2); disc(group,x,b.y+137,11,3,d.color); label(group,initials(d.name),x,b.y+137,10,INK,20,'center');});
        }
      }
      const valid=l.seats.filter(s=>{const a=assignments.get(s.assignmentId); return a && a.companyId===co.id && employees.has(a.employeeId) && l.rooms.some(r=>r.departmentId===a.departmentId&&!r.restricted);});
      const instances=new THREE.InstancedMesh(circleGeo,mat('#ffffff'),valid.length),borders=new THREE.InstancedMesh(circleGeo,mat('#ffffff'),valid.length);
      instances.instanceMatrix.setUsage(THREE.DynamicDrawUsage);borders.instanceMatrix.setUsage(THREE.DynamicDrawUsage);group.add(borders,instances);
      valid.forEach((s,i)=>{
        const a=assignments.get(s.assignmentId), e=employees.get(a.employeeId), d=departments.get(a.departmentId);
        matrix.makeScale(s.r,1,s.r); matrix.setPosition(s.x,3,s.y); instances.setMatrixAt(i,matrix); instances.setColorAt(i,new THREE.Color(colorFor(e,d)));
        matrix.makeScale(s.r+1.5,1,s.r+1.5);matrix.setPosition(s.x,2.85,s.y);borders.setMatrixAt(i,matrix);
        const textGroup=new THREE.Group(); textGroup.position.set(s.x,0,s.y); group.add(textGroup);
        if(a.kind!=='resident') ring(textGroup,s.r+5,a.kind==='visiting'?COLORS.visiting:COLORS.shared,a.kind==='visiting');
        const room=l.rooms.find(r=>r.departmentId===a.departmentId&&!r.restricted);
        seats.set(a.id,{co,a,e,s:{...s},instances,borders,index:i,textGroup,nameLabel:null,initialLabel:null,room});
      });
      instances.instanceMatrix.needsUpdate=true; if(instances.instanceColor) instances.instanceColor.needsUpdate=true;
      instances.computeBoundingSphere(); instances.computeBoundingBox();
      borders.instanceMatrix.needsUpdate=true;borders.computeBoundingSphere();borders.computeBoundingBox();
    }
    inkMesh(group,strokes);
    // A flat company seat belongs to the shared table spine, not a furniture model.
    const table=new THREE.Group(); table.position.set(l.width/2,0,-80-co.z); group.add(table);
    disc(table,0,0,34,1,'#d1af65'); disc(table,0,0,30,2,PAPER); ring(table,28,'#d1af65',false,3);
    label(table,initials(co.name),0,0,21,INK,55,'center',0,true);
    label(table,co.name,0,-49,17,'#efe6cc',210,'center');
    const connector=[]; segment(connector,0,34,0,80+co.z,2,1); inkMesh(table,connector,'#c8a661');
  }
  function detailIds() {
    const target=controls.target;
    const sorted=[...companies.values()].filter(c=>layouts.has(c.id)).sort((a,b)=>Math.hypot(a.x+550-target.x,a.z+layouts.get(a.id).height/2-target.z)-Math.hypot(b.x+550-target.x,b.z+layouts.get(b.id).height/2-target.z));
    const ids=sorted.slice(0,3).map(c=>c.id), pinned=selection?.companyId||focusId;
    if(pinned&&layouts.has(pinned)&&!ids.includes(pinned)) { if(ids.length>=3) ids.pop(); ids.unshift(pinned); }
    return ids;
  }
  function rebuild(force=false) {
    const ids=detailIds(), key=ids.join('|'); if(!force&&key===detailsKey) return;
    detailsKey=key; currentRich=ids; disposeGroup(mainGroup); mainGroup=new THREE.Group(); scene.add(mainGroup); companyGroups.clear(); seats.clear(); labelMeshes.clear();
    for(const co of companies.values()) buildCompany(co,ids.includes(co.id));
    const xs=[...companies.values()].map(c=>c.x+550);
    if(xs.length) { const spine=[]; segment(spine,Math.min(...xs)-60,-80,Math.max(...xs)+60,-80,2.5,.7); inkMesh(mainGroup,spine,'#bb9655'); }
    relief.setCompanies([...companies.values()].filter(c=>layouts.has(c.id)).map(c=>{
      const l=layouts.get(c.id),detailed=ids.includes(c.id);
      return {id:c.id,x:c.x,z:c.z,width:l.width,height:l.height,detailed,rooms:detailed?l.rooms.filter(r=>!r.restricted).map(r=>{
        let depth=0,parent=departments.get(r.departmentId)?.parentId;while(parent&&depth<2){depth++;parent=departments.get(parent)?.parentId;}
        return {id:r.id,x:r.x,y:r.y,w:r.w,h:r.h,depth,color:r.color};
      }):[]};
    }));
    metrics.mountedDetailedCompanies=ids.length; metrics.lightweightCompanyCount=Math.max(0,companies.size-ids.length); metrics.visibleAssignments=seats.size;
    updateLabels(); updateHighlight();
  }
  function updateLabels() {
    if(camera.zoom>.82) labelDetail=true; else if(camera.zoom<.72) labelDetail=false;
    for(const mesh of labelMeshes) mesh.visible=mesh.userData.detail!==1||labelDetail;
    // Dense company observation found 2,100 text textures for 1,000 employees.
    // Keep all canonical circle instances, but allocate readable labels only for
    // nearby visible assignments; the selected identity is prioritised.
    const candidates=[];camera.updateMatrixWorld();
    if(camera.zoom>=.48)for(const v of seats.values()){
      scratch.set(v.co.x+v.s.x,3,v.co.z+v.s.y).project(camera);
      if(Math.abs(scratch.x)<1.12&&Math.abs(scratch.y)<1.12&&Math.abs(scratch.z)<=1)candidates.push({v,rank:selection?.assignmentId===v.a.id?-1:Math.hypot(scratch.x,scratch.y)});
    }
    const labelled=new Set(candidates.sort((a,b)=>a.rank-b.rank).slice(0,180).map(x=>x.v.a.id));
    const removeLabel=mesh=>{if(mesh){mesh.removeFromParent();mesh.material.map.dispose();mesh.material.dispose();labelMeshes.delete(mesh);}};
    for(const v of seats.values()){
      if(!labelled.has(v.a.id)){removeLabel(v.initialLabel);removeLabel(v.nameLabel);v.initialLabel=v.nameLabel=null;continue;}
      if(!v.initialLabel){
        v.initialLabel=label(v.textGroup,initials(v.e.name),0,0,21,INK,30,'center');
        const short=v.e.name.split(/\s+/u)[0]+(v.a.kind==='shared'?' · S':v.a.kind==='visiting'?' · V':'');
        v.nameLabel=label(v.textGroup,short,0,v.s.r+13,16,INK,61,'center',1);
      }
      if(!v.nameLabel||!v.room)continue;
      const end=v.s.y+v.s.r+13+v.nameLabel.scale.z/2;
      const childTop=Math.min(v.room.y+v.room.h,...layouts.get(v.co.id).rooms.filter(r=>departments.get(r.departmentId)?.parentId===v.room.departmentId).map(r=>r.y));
      v.nameLabel.visible=labelDetail&&end<=childTop-5;
    }
  }
  function getAnchor(sel) {
    if(!sel) return null; const co=companies.get(sel.companyId||(sel.kind==='company'?sel.id:null)), l=co&&layouts.get(co.id); if(!co||!l) return null;
    if(sel.kind==='employee') { const id=sel.assignmentId||sel.id, a=assignments.get(id); if(!a||a.companyId!==co.id) return null; const s=seats.get(id)?.s||l.seats.find(p=>p.assignmentId===id); return s?{x:co.x+s.x,y:5,z:co.z+s.y}:null; }
    if(sel.kind==='department'||sel.kind==='restricted') { const r=l.rooms.find(r=>sel.kind==='restricted'?r.id===sel.id&&r.restricted:r.departmentId===(sel.departmentId||sel.id)&&!r.restricted); return r?{x:co.x+r.x+r.w/2,y:5,z:co.z+r.y+r.h/2}:null; }
    if(sel.kind==='board') { const b=l.boards.find(b=>b.type===(sel.boardType||String(sel.id||'').split(':').pop())); return b?{x:co.x+b.x+b.w/2,y:5,z:co.z+b.y+b.h/2}:null; }
    return sel.kind==='company'?{x:co.x+l.width/2,y:5,z:co.z+56}:null;
  }
  function updateHighlight() { const p=getAnchor(selection); highlight.visible=!!p&&selection?.kind==='employee'; if(p) highlight.position.set(p.x,0,p.z); }
  function project(anchor) {
    if(!anchor||!finite(anchor.x,anchor.y,anchor.z)) return {x:0,y:0,visible:false};
    camera.updateMatrixWorld(); scratch.set(anchor.x,anchor.y,anchor.z).project(camera); const r=canvas.getBoundingClientRect();
    return {x:r.left+(scratch.x+1)*r.width/2,y:r.top+(1-scratch.y)*r.height/2,visible:finite(scratch.x,scratch.y,scratch.z)&&Math.abs(scratch.x)<=1&&Math.abs(scratch.y)<=1&&scratch.z>=-1&&scratch.z<=1};
  }
  function unproject(clientX,clientY,planeY=3) {
    const r=canvas.getBoundingClientRect(); if(!finite(clientX,clientY,planeY)||r.width<=0||r.height<=0) return null;
    camera.updateMatrixWorld(); raycaster.setFromCamera(new THREE.Vector2((clientX-r.left)/r.width*2-1,1-(clientY-r.top)/r.height*2),camera);
    if(Math.abs(raycaster.ray.direction.y)<EPS) return null; plane.constant=-planeY;
    const p=raycaster.ray.intersectPlane(plane,new THREE.Vector3()); return p&&finite(p.x,p.y,p.z)?{x:p.x,y:p.y,z:p.z}:null;
  }
  function cameraState() { const d=camera.position.clone().sub(controls.target), s=new THREE.Spherical().setFromVector3(d); return {x:controls.target.x,z:controls.target.z,zoom:camera.zoom,tilt:s.phi/DEG,yaw:s.theta/DEG}; }
  function pose(p) {
    const phi=Math.max(1e-6,clamp(p.tilt,0,55)*DEG), yaw=p.yaw*DEG, distance=cameraDistance;
    controls.target.set(p.x,0,p.z); camera.position.set(p.x+distance*Math.sin(phi)*Math.sin(yaw),distance*Math.cos(phi),p.z+distance*Math.sin(phi)*Math.cos(yaw));
    camera.zoom=clamp(p.zoom,controls.minZoom,3.2);camera.far=Math.max(30000,distance*4); camera.updateProjectionMatrix(); camera.lookAt(controls.target); camera.updateMatrixWorld();
  }
  function travel(to) {
    if(disposed||lost) return; cancelDrag(); const from=cameraState();
    to={...from,...to}; if(!finite(to.x,to.z,to.zoom,to.tilt,to.yaw)) return;
    to.yaw=from.yaw+((to.yaw-from.yaw+540)%360-180); controls.enableDamping=false; controls.update();
    if(media.matches) { flight=null; pose(to); controls.update(); controls.enableDamping=true; }
    else flight={from,to,start:performance.now(),duration:320};
    invalidate();
  }
  function frameRect(companyId,rect,minZoom=.12,maxZoom=2.2) {
    const co=companies.get(companyId); if(!co||!rect) return;
    restoreEditingBounds();
    focusId=companyId; rebuild(); const z=clamp(Math.min((width-150)/Math.max(80,rect.w),(height-170)/Math.max(80,rect.h)),minZoom,maxZoom);
    travel({x:co.x+rect.x+rect.w/2,z:co.z+rect.y+rect.h/2,zoom:z});
  }
  function focusCompany(id) { const l=layouts.get(id); if(l) frameRect(id,{x:-25,y:-145,w:l.width+50,h:l.height+170},.12,1.35); }
  function focusDepartment(id) { const d=departments.get(id); if(!d) return; const r=layouts.get(d.companyId)?.rooms.find(r=>r.departmentId===id&&!r.restricted); if(r) frameRect(d.companyId,{x:r.x-18,y:r.y-18,w:r.w+36,h:r.h+36}); }
  function restoreEditingBounds(){overviewActive=false;controls.minZoom=.12;cameraDistance=2400;}
  function focusEmployee(id) { const a=assignments.get(id); if(!a) return; const p=getAnchor({kind:'employee',id,assignmentId:id,companyId:a.companyId}); if(p) {restoreEditingBounds(); focusId=a.companyId; rebuild(); travel({x:p.x,z:p.z,zoom:1.8}); } }
  function focusBoard(id,type) { const b=layouts.get(id)?.boards.find(b=>b.type===type); if(b) frameRect(id,{x:b.x-30,y:b.y-30,w:b.w+60,h:b.h+60},.12,2.2); }
  function setStyle(next) {
    if(disposed||!['plan','relief'].includes(next)||next===style)return;
    cancelDrag();style=next;renderer.shadowMap.enabled=style==='relief';
    relief.setStyle(style);grid.position.y=style==='relief'?-24:-4;rebuild(true);invalidate();
  }
  function overview(id=selection?.companyId||focusId) {
    const co=companies.get(id),l=layouts.get(id);if(!co||!l||disposed)return;
    focusId=id;rebuild();
    const tilt=50,yaw=-24,phi=tilt*DEG,theta=yaw*DEG;
    const separation=Math.max(0,co.z+80,-80-(co.z+l.height));
    overviewIncludesSpine=separation<=l.height+160;
    const minZ=overviewIncludesSpine?Math.min(co.z-40,-145):co.z-40;
    const maxZ=overviewIncludesSpine?Math.max(co.z+l.height+40,-40):co.z+l.height+40;
    const center={x:co.x+l.width/2,z:(minZ+maxZ)/2};
    overviewActive=true;controls.minZoom=.001;cameraDistance=Math.max(2400,2*Math.hypot(l.width+340,maxZ-minZ,56));
    // Fit actual projected envelope, including the paper stack, partitions,
    // conference label and neighbouring context. Semantic coordinates do not move.
    let extentX=0,extentY=0;
    for(const x of [co.x-170,co.x+l.width+170])for(const z of [minZ,maxZ])for(const y of [-24,32]){
      const dx=x-center.x,dz=z-center.z;
      extentX=Math.max(extentX,Math.abs(Math.cos(theta)*dx-Math.sin(theta)*dz));
      extentY=Math.max(extentY,Math.abs(-Math.cos(phi)*Math.sin(theta)*dx+Math.sin(phi)*y-Math.cos(phi)*Math.cos(theta)*dz));
    }
    const fitZoom=Math.min(Math.max(1,width-128)/(2*extentX),Math.max(1,height-180)/(2*extentY));
    travel({...center,tilt,yaw,zoom:clamp(fitZoom,.001,1.6)});
  }
  function select(sel) { selection=getAnchor(sel)?{...sel}:null; if(selection) focusId=selection.companyId; rebuild(); updateHighlight(); invalidate(); }
  function setMode(next) { if(!['pan','orbit','arrange'].includes(next)) return; cancelDrag(); mode=next; controls.enableRotate=next==='orbit'; controls.enablePan=true; controls.mouseButtons.LEFT=next==='orbit'?THREE.MOUSE.ROTATE:THREE.MOUSE.PAN; controls.mouseButtons.RIGHT=THREE.MOUSE.PAN; controls.touches.ONE=next==='orbit'?THREE.TOUCH.ROTATE:THREE.TOUCH.PAN; canvas.style.cursor=next==='arrange'?'default':'grab'; invalidate(); }
  function pick(clientX,clientY) {
    const p=unproject(clientX,clientY,3); if(!p) return null;
    for(const v of seats.values()) if(Math.hypot(p.x-v.co.x-v.s.x,p.z-v.co.z-v.s.y)<=Math.max(v.s.r,11/camera.zoom)) return {kind:'employee',id:v.a.id,assignmentId:v.a.id,companyId:v.co.id,departmentId:v.a.departmentId};
    for(const co of companies.values()) {
      const l=layouts.get(co.id); if(!l) continue; const x=p.x-co.x,y=p.z-co.z;
      if(Math.hypot(x-l.width/2,p.z+80)<38) return {kind:'company',id:co.id,companyId:co.id};
      if(x<0||y<0||x>l.width||y>l.height) continue;
      if(currentRich.includes(co.id)) {
        const inside=o=>x>=o.x&&y>=o.y&&x<=o.x+o.w&&y<=o.y+o.h;
        const b=l.boards.find(inside); if(b) return {kind:'board',id:`${co.id}:${b.type}`,companyId:co.id,boardType:b.type};
        const r=[...l.rooms].filter(inside).sort((a,b)=>a.w*a.h-b.w*b.h)[0]; if(r) return {kind:r.restricted?'restricted':'department',id:r.restricted?r.id:r.departmentId,companyId:co.id,departmentId:r.departmentId};
      }
      return {kind:'company',id:co.id,companyId:co.id};
    }
    return null;
  }
  function moveSeat(v,x,y) { v.s.x=x; v.s.y=y; v.textGroup.position.set(x,0,y); matrix.makeScale(v.s.r,1,v.s.r); matrix.setPosition(x,3,y); v.instances.setMatrixAt(v.index,matrix); v.instances.instanceMatrix.needsUpdate=true; v.instances.computeBoundingSphere();matrix.makeScale(v.s.r+1.5,1,v.s.r+1.5);matrix.setPosition(x,2.85,y);v.borders.setMatrixAt(v.index,matrix);v.borders.instanceMatrix.needsUpdate=true;v.borders.computeBoundingSphere(); updateHighlight(); }
  // Match the core's own-seat strip, so a committed placement does not jump on reload.
  function seatBounds(v,room) {
    const children=layouts.get(v.co.id).rooms.filter(r=>departments.get(r.departmentId)?.parentId===room.departmentId);
    const bottom=children.length?Math.min(...children.map(r=>r.y))-16:room.y+room.h-16;
    return {minX:room.x+16+v.s.r,maxX:room.x+room.w-16-v.s.r,minY:room.y+44+v.s.r,maxY:bottom-v.s.r};
  }
  function validSeat(v,x,y,room) {
    const bounds=seatBounds(v,room),r=v.s.r;
    if(!finite(x,y)||x<bounds.minX-EPS||x>bounds.maxX+EPS||y<bounds.minY-EPS||y>bounds.maxY+EPS) return false;
    const l=layouts.get(v.co.id); if(x<v.s.r||y<v.s.r||x>l.width-v.s.r||y>l.height-v.s.r) return false;
    for(const q of l.rooms) if(q.departmentId!==room.departmentId&&q.x>=room.x&&q.y>=room.y&&q.x+q.w<=room.x+room.w+EPS&&q.y+q.h<=room.y+room.h+EPS) {
      const nx=clamp(x,q.x,q.x+q.w),ny=clamp(y,q.y,q.y+q.h); if(Math.hypot(x-nx,y-ny)<r) return false;
    }
    for(const other of l.seats) { if(other.assignmentId===v.a.id) continue; const pos=seats.get(other.assignmentId)?.s||other; if(Math.hypot(x-pos.x,y-pos.y)<v.s.r+other.r+4-EPS) return false; }
    return true;
  }
  function dragStep(dt) {
    if(!drag||!drag.moved) return false; const d=drag, v=d.v; let remaining=Math.min(dt,.066), moving=false;
    for(let i=0;i<4&&remaining>EPS;i++) { const step=Math.min(1/60,remaining); remaining-=step;
      const stiffness=media.matches?1000:170, damping=2*Math.sqrt(stiffness);
      d.vx+=(stiffness*(d.tx-v.s.x)-damping*d.vx)*step; d.vy+=(stiffness*(d.ty-v.s.y)-damping*d.vy)*step;
      const x=clamp(v.s.x+d.vx*step,d.bounds.minX,d.bounds.maxX),y=clamp(v.s.y+d.vy*step,d.bounds.minY,d.bounds.maxY);
      if(validSeat(v,x,y,d.room)) moveSeat(v,x,y); else {d.vx=0;d.vy=0;d.tx=v.s.x;d.ty=v.s.y;}
      moving=Math.hypot(d.vx,d.vy)> .03||Math.hypot(d.tx-v.s.x,d.ty-v.s.y)>.03;
    }
    if(!moving) {d.vx=0;d.vy=0;} return moving;
  }
  function cancelDrag() {
    if(!drag) return; const d=drag; drag=null; moveSeat(d.v,d.original.x,d.original.y); metrics.cancelledDrags++; controls.enabled=true;
    try { if(canvas.hasPointerCapture(d.pointer)) canvas.releasePointerCapture(d.pointer); } catch {} invalidate();
  }
  function pointerDown(e) {
    if(!finite(e.clientX,e.clientY)){e.stopImmediatePropagation();e.preventDefault();return;}
    if(e.button!==0||e.isPrimary===false) return;
    flight=null; controls.enableDamping=true; const hit=pick(e.clientX,e.clientY); press={x:e.clientX,y:e.clientY,id:e.pointerId,hit};
    if(mode==='arrange'&&hit?.kind==='employee') {
      const v=seats.get(hit.assignmentId), room=layouts.get(v.co.id)?.rooms.find(r=>r.departmentId===v.a.departmentId&&!r.restricted), p=unproject(e.clientX,e.clientY,3);
      if(!room||!p) return; const bounds=seatBounds(v,room);
      if(bounds.minX>bounds.maxX||bounds.minY>bounds.maxY) return;
      controls.enabled=false; drag={v,room,bounds,pointer:e.pointerId,original:{x:v.s.x,y:v.s.y},offset:{x:p.x-v.co.x-v.s.x,y:p.z-v.co.z-v.s.y},tx:v.s.x,ty:v.s.y,vx:0,vy:0,moved:false};
      canvas.focus({preventScroll:true});
      canvas.setPointerCapture(e.pointerId); e.stopImmediatePropagation(); e.preventDefault();
    }
  }
  function pointerMove(e) {
    if(!finite(e.clientX,e.clientY)){e.stopImmediatePropagation();return;}
    if(!drag||drag.pointer!==e.pointerId) return;
    if(press&&Math.hypot(e.clientX-press.x,e.clientY-press.y)>4) drag.moved=true;
    if(!drag.moved) return; const p=unproject(e.clientX,e.clientY,3); if(!p) return;
    const d=drag;
    d.tx=clamp(p.x-d.v.co.x-d.offset.x,d.bounds.minX,d.bounds.maxX); d.ty=clamp(p.z-d.v.co.z-d.offset.y,d.bounds.minY,d.bounds.maxY); invalidate(); e.preventDefault();
  }
  function pointerUp(e) {
    if(drag&&drag.pointer===e.pointerId) {
      const d=drag; drag=null; controls.enabled=true;
      try {if(canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);}catch{}
      if(d.moved&&validSeat(d.v,d.tx,d.ty,d.room)) moveSeat(d.v,d.tx,d.ty);
      if(d.moved&&validSeat(d.v,d.v.s.x,d.v.s.y,d.room)) {metrics.committedDrags++; safe(onPlace,d.v.a.id,{x:d.v.s.x,y:d.v.s.y});}
      else {moveSeat(d.v,d.original.x,d.original.y); if(!d.moved&&press?.hit) {select(press.hit);safe(onSelect,press.hit);}}
      press=null; invalidate(); return;
    }
    if(press?.id===e.pointerId&&Math.hypot(e.clientX-press.x,e.clientY-press.y)<5&&press.hit) {select(press.hit);safe(onSelect,press.hit);} press=null;
  }
  function resize() {
    const r=canvas.getBoundingClientRect(); const w=Math.max(1,r.width),h=Math.max(1,r.height),dpr=Math.min(1.5,window.devicePixelRatio||1);
    if(w===width&&h===height&&ratio===dpr) return;
    width=w;height=h;ratio=dpr; renderer.setPixelRatio(ratio); renderer.setSize(width,height,false); camera.left=-width/2;camera.right=width/2;camera.top=height/2;camera.bottom=-height/2;camera.updateProjectionMatrix();invalidate();
  }
  function frame(now) {
    raf=0; if(disposed||lost||document.hidden) return; const dt=lastFrame?Math.min(.066,Math.max(0,(now-lastFrame)/1000)):1/60; lastFrame=now; resize();
    if(flight) { const t=clamp((now-flight.start)/flight.duration,0,1), eased=1-(1-t)**3, p={}; for(const k of ['x','z','zoom','tilt','yaw']) p[k]=flight.from[k]+(flight.to[k]-flight.from[k])*eased; pose(p); if(t===1){flight=null;controls.enableDamping=true;} }
    const moving=dragStep(dt); controls.update(); grid.position.x=Math.round(controls.target.x/1000)*1000;grid.position.z=Math.round(controls.target.z/1000)*1000;
    const gridSpan=Math.max(50000,4*Math.max(width,height)/camera.zoom);grid.scale.set(gridSpan,1,gridSpan);
    rebuild(); updateLabels(); camera.updateMatrixWorld();relief.updateView(camera,controls.target);scene.updateMatrixWorld(true);
    try {renderer.render(scene,camera);frames++;} catch(error) {lost=true; ready=false; safe(onError,error);return;}
    safe(onCameraChange,cameraState()); for(const fn of subscribers) safe(fn);
    if(!ready){ready=true;safe(onReady);}
    if(flight||moving) invalidate();
  }
  function setState(next) { cancelDrag(); indexState(next); if(selection&&!getAnchor(selection)) selection=null; rebuild(true); invalidate(); }
  function getMetrics() { const r=renderer.info; return {renderer:'WebGL2',style,relief:relief.getMetrics(),overviewActive,overviewIncludesSpine,cameraDistance,minimumZoom:controls.minZoom,labelTextures:labelMeshes.size,labelledAssignments:[...seats.values()].filter(v=>v.initialLabel).length,...metrics,mountedAssignments:seats.size,visibleAssignments:[...seats.values()].filter(v=>project({x:v.co.x+v.s.x,y:3,z:v.co.z+v.s.y}).visible).length,renderedFrames:frames,drawCalls:r.render.calls,triangles:r.render.triangles,textures:r.memory.textures,geometries:r.memory.geometries,activeSpringCount:drag?.moved?1:0,rafScheduled:!!raf,mode,camera:cameraState(),selection:selection?{...selection}:null,contextLost:lost,detailCompanyIds:[...currentRich]}; }
  function dispose() {
    if(disposed) return; cancelDrag(); disposed=true; if(raf) cancelAnimationFrame(raf); raf=0; flight=null; listeners.splice(0).forEach(fn=>fn()); observer.disconnect(); controls.dispose();relief.dispose(); disposeGroup(mainGroup); disposeGroup(highlight); gridMaterial.dispose(); for(const g of owned) g.dispose(); for(const m of materials.values()) m.dispose(); renderer.dispose(); subscribers.clear();
    if(previousTabIndex===null) canvas.removeAttribute('tabindex'); else canvas.setAttribute('tabindex',previousTabIndex);
  }
  listen(canvas,'pointerdown',pointerDown,true); listen(canvas,'pointermove',pointerMove,true); listen(canvas,'pointerup',pointerUp,true);
  listen(canvas,'pointercancel',()=>{cancelDrag();press=null;},true); listen(canvas,'lostpointercapture',()=>cancelDrag(),true);
  listen(canvas,'wheel',e=>{if(!finite(e.clientX,e.clientY,e.deltaY)){e.stopImmediatePropagation();return;}flight=null;controls.enableDamping=true;}, {capture:true,passive:true});
  listen(canvas,'keydown',e=>{if(e.key==='Escape'){cancelDrag();flight=null;press=null;invalidate();}});
  listen(window,'blur',()=>{cancelDrag();flight=null;press=null;});
  listen(document,'visibilitychange',()=>{if(document.hidden){cancelDrag();flight=null;if(raf)cancelAnimationFrame(raf);raf=0;}else{lastFrame=0;invalidate();}});
  listen(canvas,'webglcontextlost',e=>{e.preventDefault();cancelDrag();lost=true;ready=false;if(raf)cancelAnimationFrame(raf);raf=0;safe(onError,new Error('The graphics context was interrupted. Your records remain saved. Waiting for graphics recovery.'));});
  // onReady marks the first successful frame initially and after each graphics recovery.
  listen(canvas,'webglcontextrestored',()=>{lost=false;ready=false;rebuild(true);invalidate();});
  listen(window,'resize',resize); listen(media,'change',()=>{if(media.matches&&flight){pose(flight.to);flight=null;}invalidate();});
  controls.addEventListener('change',invalidate); controls.addEventListener('start',()=>{flight=null;controls.enableDamping=true;invalidate();});
  const observer=new ResizeObserver(resize); observer.observe(canvas); resize(); indexState(initial); setMode('pan');
  focusId=companies.has('co-studio-north')?'co-studio-north':companies.keys().next().value;
  const l=layouts.get(focusId), co=companies.get(focusId);
  if(l&&co) pose({x:co.x+l.width/2,z:co.z+(l.height-110)/2,zoom:clamp(Math.min((width-130)/(l.width+90),(height-130)/(l.height+190)),.12,1.35),tilt:0,yaw:0});
  controls.update(); rebuild(true); invalidate();
  return {
    setState,select,focusCompany,focusDepartment,focusEmployee,focusBoard,setMode,setStyle,overview,
    top:()=>{restoreEditingBounds();travel({tilt:0,yaw:0,zoom:Math.max(.12,camera.zoom)});}, tilt:degrees=>{if(finite(degrees))travel({tilt:clamp(degrees,0,55)});}, rotate:degrees=>{if(finite(degrees))travel({yaw:cameraState().yaw+degrees});},
    zoom:factor=>{if(finite(factor)&&factor>0)travel({zoom:clamp(camera.zoom*factor,controls.minZoom,3.2)});},
    fit:()=>focusCompany(selection?.companyId||focusId), home:()=>{const id=companies.has('co-studio-north')?'co-studio-north':companies.keys().next().value;focusCompany(id);if(flight){flight.to.tilt=0;flight.to.yaw=0;}},
    getAnchor,project,unproject,subscribeFrame:fn=>{if(typeof fn!=='function')return()=>{};subscribers.add(fn);invalidate();return()=>subscribers.delete(fn);},getMetrics,dispose
  };
}
