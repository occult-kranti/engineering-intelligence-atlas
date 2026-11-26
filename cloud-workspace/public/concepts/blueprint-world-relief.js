// Initial Claude Sonnet source: request c4b6f586-bbbd-4354-915e-a32c1d212158. Local review and integration recorded separately.
// Local repair: blueprint-studio-20261121 / renderer-integration / attempt1.
import { THREE } from './blueprint-world-vendor.js';

const MAX_COMPANIES = 100;
const MAX_DETAILED = 3;
const MAX_ROOMS = 4096;
const MAX_COORD = 1e6;
const THICK = 3;
const HEIGHTS = [32, 24, 16];
const CUT_HEIGHT = 6;
const SHADOW_Y = -23.9;
const SHADOW_RADIUS = 1800;
const DEG = Math.PI / 180;

const fin = (v, lo, hi) => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;

function validate(specs) {
  if (!Array.isArray(specs) || specs.length > MAX_COMPANIES) throw new Error('relief: invalid specs');
  let detailed = 0;
  let rooms = 0;
  const ids = new Set();
  for (const s of specs) {
    if (!s || typeof s !== 'object') throw new Error('relief: invalid spec');
    if (typeof s.id !== 'string' || !s.id || ids.has(s.id)) throw new Error('relief: duplicate or missing company');
    ids.add(s.id);
    if (!fin(s.x, -MAX_COORD, MAX_COORD) || !fin(s.z, -MAX_COORD, MAX_COORD)) throw new Error('relief: bad origin');
    if (!fin(s.width, 1, MAX_COORD) || !fin(s.height, 1, MAX_COORD)) throw new Error('relief: bad size');
    if (!Array.isArray(s.rooms)) throw new Error('relief: bad rooms');
    if (s.detailed === true) {
      if (++detailed > MAX_DETAILED) throw new Error('relief: too many detailed');
    } else if (s.rooms.length) throw new Error('relief: distant company rooms must be omitted');
    rooms += s.rooms.length;
    if (rooms > MAX_ROOMS) throw new Error('relief: too many rooms');
    const roomIds = new Set();
    for (const r of s.rooms) {
      if (!r || !fin(r.x, -MAX_COORD, MAX_COORD) || !fin(r.y, -MAX_COORD, MAX_COORD) ||
        !fin(r.w, 1, MAX_COORD) || !fin(r.h, 1, MAX_COORD) ||
        !(r.depth === undefined || (Number.isInteger(r.depth) && fin(r.depth, 0, 2)))) throw new Error('relief: bad room');
      if(typeof r.id!=='string'||!r.id||roomIds.has(r.id)) throw new Error('relief: duplicate or missing room');
      roomIds.add(r.id);
      if(r.x<0||r.y<0||r.x+r.w>s.width+1e-7||r.y+r.h>s.height+1e-7) throw new Error('relief: room outside company');
    }
  }
}

function unitBox() {
  const g = new THREE.BoxGeometry(1, 1, 1);
  const pos = g.attributes.position;
  const nor = g.attributes.normal;
  const col = new Float32Array(pos.count * 3);
  const top = new THREE.Color(0x1b2a44);
  const side = new THREE.Color(0xe6d6b8);
  const sideDark = new THREE.Color(0xc9b794);
  for (let i = 0; i < pos.count; i++) {
    const ny = nor.getY(i);
    const c = ny > 0.5 ? top : (ny < -0.5 ? sideDark : (Math.abs(nor.getX(i)) > 0.5 ? sideDark : side));
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

// Partition segments for a room, inside the room; outward normal (nx,nz).
// Match the plan's bottom door: [x+w-44, x+w-14], wholly inside the room.
function segmentsFor(room, ox, oz) {
  const { x, y, w, h } = room;
  const t = Math.min(THICK, w / 2, h / 2);
  const depth = Math.min(2, Math.max(0, Math.floor(room.depth || 0)));
  const H = HEIGHTS[depth];
  const out = [];
  const add = (cx, cz, sx, sz, nx, nz) => {
    if (sx > 0 && sz > 0) out.push({ roomId:room.id, cx: ox + cx, cz: oz + cz, sx, sz, nx, nz, H });
  };
  add(x + w / 2, y + t / 2, w, t, 0, -1); // top edge
  add(x + t / 2, y + h / 2, t, h, -1, 0); // left edge
  add(x + w - t / 2, y + h / 2, t, h, 1, 0); // right edge
  const bz = y + h - t / 2;
  if (w > 90 && h > 90) {
    const left = w - 44, right = 14;
    add(x + left / 2, bz, left, t, 0, 1);
    add(x + w - right / 2, bz, right, t, 0, 1);
  } else {
    add(x + w / 2, bz, w, t, 0, 1);
  }
  return out;
}

export function createReliefLayer({ scene, invalidate }) {
  let disposed = false;
  let style = 'plan';
  let companies = [];
  let partitionMeshes = []; // {mesh, segs}
  let slabMeshes = [];
  let lastCam = null;
  let lastTarget = null, lastOrientation = '', lastWindow = '', specKey = '';
  let matrixUpdates = 0, frustumUpdates = 0;
  let metrics = { partitionInstances: 0, cutawayInstances: 0, slabInstances: 0, shadowEnabled: false };

  const group = new THREE.Group();
  group.name = 'relief-layer';
  group.visible = false;
  scene.add(group);

  const boxGeo = unitBox();
  const slabGeo = new THREE.BoxGeometry(1, 1, 1);
  const wallMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0.05 });
  const slabMats = [
    new THREE.MeshStandardMaterial({ color: 0x7f8ba3, roughness: 0.9, metalness: 0.05 }),
    new THREE.MeshStandardMaterial({ color: 0xe8dcc0, roughness: 0.88, metalness: 0.03 }),
    new THREE.MeshStandardMaterial({ color: 0xf5eedb, roughness: 0.85, metalness: 0.03 }),
  ];
  const SLABS = [
    { bottom: -20, top: -9, inset: 7, mat: 0 },
    { bottom: -8, top: -2, inset: 3, mat: 1 },
    { bottom: -1.8, top: -0.08, inset: 0, mat: 2 },
  ];

  let key = null;
  let fill = null;
  let receiver = null;
  let receiverMat = null;
  let receiverGeo = null;
  let paperReceiver = null;

  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const p = new THREE.Vector3();
  const s = new THREE.Vector3();

  function ensureRig() {
    if (key) return;
    key = new THREE.DirectionalLight(0xfff1dc, 1.6);
    key.position.set(-300, 600, 300);
    key.target.position.set(0, 0, 0);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.bias = -0.0005;
    key.shadow.normalBias = 0.12;
    key.shadow.autoUpdate = false;
    fill = new THREE.HemisphereLight(0xdfe8ff, 0x8a7f6a, 0.55);
    receiverGeo = new THREE.PlaneGeometry(1, 1);
    receiverGeo.rotateX(-Math.PI / 2);
    receiverMat = new THREE.ShadowMaterial({ opacity: 0.18, transparent: true, depthWrite:false });
    receiver = new THREE.Mesh(receiverGeo, receiverMat);
    receiver.position.y = SHADOW_Y;
    receiver.receiveShadow = true;
    receiver.userData.reliefRole = 'table-shadow-receiver';
    receiver.visible = false;
    group.add(key, key.target, fill, receiver);
  }

  function releaseRig() {
    if (!key) return;
    group.remove(key, key.target, fill, receiver);
    // DirectionalLight.dispose owns both shadow.map and shadow.mapPass.
    key.dispose?.();
    fill.dispose?.();
    receiverGeo.dispose();
    receiverMat.dispose();
    key = fill = receiver = receiverMat = receiverGeo = null;
    lastWindow = '';
  }

  function clearMeshes() {
    for (const { mesh } of partitionMeshes) { group.remove(mesh); mesh.dispose?.(); }
    for (const mesh of slabMeshes) { group.remove(mesh); mesh.dispose?.(); }
    if(paperReceiver){group.remove(paperReceiver);paperReceiver.dispose();paperReceiver=null;}
    partitionMeshes = [];
    slabMeshes = [];
    metrics.partitionInstances = metrics.cutawayInstances = metrics.slabInstances = 0;
    lastOrientation = '';
  }

  function build() {
    clearMeshes();
    if (style !== 'relief') return;
    ensureRig();
    let slabCount = 0;
    const slabBuild = [[], [], []];
    for (const c of companies) {
      SLABS.forEach((L, i) => {
        const w = c.width - 2 * L.inset;
        const d = c.height - 2 * L.inset;
        if (w > 0 && d > 0) {
          slabBuild[i].push({ companyId:c.id,cx: c.x + c.width / 2, cz: c.z + c.height / 2, w, d, y: (L.top + L.bottom) / 2, hh: L.top - L.bottom });
        }
      });
    }
    slabBuild.forEach((list, i) => {
      if (!list.length) return;
      const mesh = new THREE.InstancedMesh(slabGeo, slabMats[SLABS[i].mat], list.length);
      list.forEach((b, j) => {
        m4.compose(p.set(b.cx, b.y, b.cz), q.identity(), s.set(b.w, b.hh, b.d));
        mesh.setMatrixAt(j, m4);
      });
      mesh.instanceMatrix.needsUpdate = true;
      mesh.receiveShadow = true;
      mesh.castShadow = true;
      mesh.userData = {reliefRole:'slab',companyIds:list.map(b=>b.companyId),layer:i};
      mesh.computeBoundingBox();mesh.computeBoundingSphere();
      group.add(mesh);
      slabMeshes.push(mesh);
      slabCount += list.length;
    });
    metrics.slabInstances = slabCount;

    let total = 0;
    for (const c of companies) {
      if (!c.detailed) continue;
      const segs = [];
      for (const r of c.rooms) segs.push(...segmentsFor(r, c.x, c.z));
      if (!segs.length) continue;
      const mesh = new THREE.InstancedMesh(boxGeo, wallMat, segs.length);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.userData = {reliefRole:'partition',companyId:c.id,roomIds:segs.map(s=>s.roomId)};
      group.add(mesh);
      partitionMeshes.push({ mesh, segs });
      total += segs.length;
    }
    metrics.partitionInstances = total;
    const detail=companies.filter(c=>c.detailed);
    if(detail.length){
      paperReceiver=new THREE.InstancedMesh(receiverGeo,receiverMat,detail.length);
      detail.forEach((c,i)=>{m4.compose(p.set(c.x+c.width/2,2.2,c.z+c.height/2),q.identity(),s.set(c.width,1,c.height));paperReceiver.setMatrixAt(i,m4);});
      paperReceiver.instanceMatrix.needsUpdate=true;paperReceiver.receiveShadow=true;
      paperReceiver.userData={reliefRole:'paper-shadow-receiver',companyIds:detail.map(c=>c.id)};
      paperReceiver.computeBoundingBox();paperReceiver.computeBoundingSphere();group.add(paperReceiver);
    }
    applyCutaway(lastCam);
    updateFrustum(lastTarget,true);
    group.visible = true;
    if (receiver) receiver.visible = true;
    metrics.shadowEnabled = true;
  }

  function applyCutaway(cam) {
    let cut = 0;
    let amount = 0;
    let dx = 0;
    let dz = 0;
    let fromTop = 0;
    if (cam) {
      const dir = new THREE.Vector3();
      cam.getWorldDirection(dir);
      const horiz = Math.hypot(dir.x, dir.z);
      const tilt = Math.atan2(-dir.y, horiz) ; // 90deg = straight down
      const tiltFromTop = 90 * DEG - tilt;
      fromTop = tiltFromTop;
      const signature=[dir.x,dir.y,dir.z].map(v=>v.toFixed(7)).join(':');
      if(signature===lastOrientation)return;
      lastOrientation=signature;
      const t = Math.min(1, Math.max(0, (tiltFromTop - 12 * DEG) / (13 * DEG)));
      amount = t * t * (3 - 2 * t);
      if (horiz > 1e-6) { dx = dir.x / horiz; dz = dir.z / horiz; }
      else amount = 0;
    }
    for (const { mesh, segs } of partitionMeshes) {
      for (let i = 0; i < segs.length; i++) {
        const g = segs[i];
        let h = g.H;
        if (amount > 0) {
          // Edge faces camera when outward normal opposes view direction.
          const facing = Math.min(1, Math.max(0, -(g.nx * dx + g.nz * dz)));
          const k = amount * facing;
          if (k > 0) {
            h = g.H + (CUT_HEIGHT - g.H) * k;
            if (k > 0.001) cut++;
          }
        }
        // The core keeps disc rims >=16 units from room boundaries. A conservative
        // 12.5-unit clear ray run (after the 3-unit wall thickness) protects rims,
        // including the far wall of the next room, at the highest supported tilt.
        h=Math.min(h,3+12.5/Math.max(1e-6,Math.tan(fromTop)));
        m4.compose(p.set(g.cx, h / 2, g.cz), q.identity(), s.set(g.sx, h, g.sz));
        mesh.setMatrixAt(i, m4);
      }
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingBox();mesh.computeBoundingSphere();
    }
    matrixUpdates++;
    if(key)key.shadow.needsUpdate=true;
    metrics.cutawayInstances = cut;
  }

  function updateFrustum(target,force=false) {
    if (!key || !receiver) return;
    const nearest=companies.find(c=>c.detailed)||companies[0];if(!nearest)return;
    const tx=Number.isFinite(target?.x)?target.x:nearest.x+nearest.width/2;
    const tz=Number.isFinite(target?.z)?target.z:nearest.z+nearest.height/2;
    const cx=Math.round(tx/64)*64,cz=Math.round(tz/64)*64,radius=SHADOW_RADIUS;
    const signature=`${cx}:${cz}`;if(!force&&signature===lastWindow)return;lastWindow=signature;
    key.target.position.set(cx, 0, cz);
    key.position.set(cx - 1200, 2400, cz + 1800);
    const cam = key.shadow.camera;
    cam.left = -radius; cam.right = radius; cam.top = radius; cam.bottom = -radius;
    cam.near = 1; cam.far = 7000;
    cam.updateProjectionMatrix();
    key.target.updateMatrixWorld();
    receiver.position.set(cx, SHADOW_Y, cz);
    receiver.scale.set(radius*2, 1, radius*2);
    key.shadow.needsUpdate = true;
    frustumUpdates++;
  }

  function setCompanies(specs) {
    if (disposed) return;
    validate(specs); // throws before any state is replaced
    const nextKey=JSON.stringify(specs);if(nextKey===specKey)return;specKey=nextKey;
    companies = specs.map((c) => ({
      id:c.id,x: c.x, z: c.z, width: c.width, height: c.height, detailed: c.detailed === true,
      rooms: c.rooms.map((r) => ({ id:r.id,x: r.x, y: r.y, w: r.w, h: r.h, depth: r.depth || 0 })),
    }));
    build();
    invalidate?.();
  }

  function setStyle(next) {
    if (disposed || (next !== 'plan' && next !== 'relief') || next === style) return;
    style = next;
    if (style === 'plan') {
      clearMeshes();
      group.visible = false;
      releaseRig();
      metrics.shadowEnabled = false;
    } else {
      build();
    }
    invalidate?.();
  }

  function updateView(camera, target) {
    if(disposed)return;
    if(target&&Number.isFinite(target.x)&&Number.isFinite(target.z))lastTarget={x:target.x,z:target.z};
    if (style !== 'relief' || !camera) {
      if (camera) lastCam = camera;
      return;
    }
    lastCam = camera;
    applyCutaway(camera);
    updateFrustum(target);
    // Called inside the host frame. Never schedule another frame from this method.
  }

  function getMetrics() {
    return { ...metrics,matrixUpdates,frustumUpdates,shadowRadius:SHADOW_RADIUS,shadowWindow:receiver?{x:receiver.position.x,z:receiver.position.z,width:receiver.scale.x,height:receiver.scale.z}:null };
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    clearMeshes();
    releaseRig();
    scene.remove(group);
    boxGeo.dispose();
    slabGeo.dispose();
    wallMat.dispose();
    slabMats.forEach((m) => m.dispose());
    companies = [];
    lastCam = null;
    metrics = { partitionInstances: 0, cutawayInstances: 0, slabInstances: 0, shadowEnabled: false };
  }

  return { setCompanies, setStyle, updateView, getMetrics, dispose };
}
