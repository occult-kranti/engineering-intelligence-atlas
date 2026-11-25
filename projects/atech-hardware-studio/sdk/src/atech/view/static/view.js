// atech view: the project's board in 3D, redrawn whenever project.yaml changes.
//
// This page places nothing itself. /scene.json carries every pose, computed in
// Python by atech.sim.model.module_pose_on_board (sim-assets uses the
// same function); this file only applies them. Frames: the scene is the board's
// asset frame (metres, +z out of the top face), turned to three's +y up by `world`.
// A GLB is glTF +y up, so each one gets a quarter turn about x into the asset
// frame, (x, y, z) -> (x, -z, y), as atech.sim.meshes does.
//
// The stage is studio's project viewport (studio frontend/src/lib/viewer/viewer.js
// and meshload.js, three r184): its lights, shadows, shadow-catching ground and
// grid, the RoomEnvironment the near-black CAD materials need, the lid and display
// handling, the "at rest" state, the seat (the whole load centred on the grid and
// stood on it), the iso framing and the hover card. Studio draws no port numbers
// (the board's own silkscreen carries them); here they are an opt-in toggle.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const $ = (sel) => document.querySelector(sel);
const host = $('#canvas-host');
const labelsEl = $('#labels');
const card = $('#hover');

// ── renderer, lights, ground, camera: studio Viewport ──────────────────────
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
host.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = null; // the page's backdrop shows through
scene.add(new THREE.HemisphereLight(0xdfe9f5, 0x2a2f38, 1.05));
const key = new THREE.DirectionalLight(0xffffff, 1.55);
key.position.set(90, 150, 90);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.camera.near = 10; key.shadow.camera.far = 700;
key.shadow.camera.left = -200; key.shadow.camera.right = 200;
key.shadow.camera.top = 200; key.shadow.camera.bottom = -200;
key.shadow.bias = -0.0012;
scene.add(key);
{
  // studio meshload.js lightForCad: a black dielectric shows its shape only
  // through what it reflects, so the CAD shells need an environment.
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.55;
  pmrem.dispose();
}
const fill = new THREE.DirectionalLight(0xbcd0e8, 0.5);
fill.position.set(-110, 60, -80);
scene.add(fill);

// The ground catches the shadow only, so the board reads as sitting on a bed.
// depthWrite off: it is coplanar with the grid, and its depth would hide grid lines.
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(2400, 2400),
  new THREE.ShadowMaterial({ opacity: 0.28, depthWrite: false }),
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

const grid = new THREE.GridHelper(400, 40, 0x6b7280, 0x3a3f47); // 10 mm cells
grid.material.transparent = true;
grid.material.opacity = 0.34;
scene.add(grid);

const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 8000);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.07;
controls.rotateSpeed = 0.4;
controls.panSpeed = 0.4;

// Draw only when something changed: the page may sit open beside an agent for an
// hour, and a still board redrawn 60 times a second is a laptop fan for nothing.
let dirty = true;
const invalidate = () => { dirty = true; };
controls.addEventListener('change', invalidate);

// `stage` carries the seat shift; `world` turns the board asset frame (z up,
// metres) into three's (y up, millimetres).
const stage = new THREE.Group();
scene.add(stage);
const world = new THREE.Group();
world.rotation.x = -Math.PI / 2;
world.scale.setScalar(1000);
stage.add(world);

// ── GLB loading ────────────────────────────────────────────────────────────
const loader = new GLTFLoader();
loader.setMeshoptDecoder(MeshoptDecoder);
const glbCache = new Map(); // url -> Promise<THREE.Object3D> (prepared, never added itself)

// studio meshload.js prepareCadMaterials: the lids are KHR_materials_transmission,
// and a lid a few mm thick refracts the parts under it out of place.
function prepareCadMaterials(o) {
  const mats = Array.isArray(o.material) ? o.material : (o.material ? [o.material] : []);
  for (const m of mats) {
    if (m.envMapIntensity !== undefined) m.envMapIntensity = 1.0;
    if (m.transmission > 0) {
      m.thickness = 0;
      m.roughness = Math.min(m.roughness ?? 0.1, 0.1);
      m.envMapIntensity = 1.4;
      m.transparent = true;
      m.opacity = 1;
      m.depthWrite = false;
      o.renderOrder = 2;
    }
    m.needsUpdate = true;
  }
}

// studio meshload.js atRest: the release ships parts lit and moving (screen
// flipbook, the knob's lit sector, lit grid LEDs). Nothing runs here, so show
// them off: a blank display, white unlit LEDs.
function atRest(inner) {
  inner.traverse((o) => {
    if (/^screen_f\d+$/.test(o.name) && o.name !== 'screen_f0') o.visible = false;
    if (o.name === 'ring_lit') o.visible = false;
    if (!o.isMesh) return;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
      if (!m || !m.emissive) continue;
      if (m.name === 'screen_f0') {
        m.map = null;
        m.emissiveMap = null;
        m.color.setRGB(0, 0, 0);
      } else if (/^led_[0-8]$/.test(m.name || '')) {
        m.color.setRGB(1, 1, 1);
      } else continue;
      m.emissive.setRGB(0, 0, 0);
      m.emissiveIntensity = 0;
      m.needsUpdate = true;
    }
  });
}

function loadGlb(url) {
  if (!glbCache.has(url)) {
    glbCache.set(url, loader.loadAsync('/' + url).then((gltf) => {
      const inner = gltf.scene;
      inner.traverse((o) => {
        if (!o.isMesh) return;
        if (o.geometry && !o.geometry.attributes.normal) o.geometry.computeVertexNormals();
        prepareCadMaterials(o);
        o.castShadow = true;
        o.receiveShadow = true;
      });
      atRest(inner);
      inner.rotation.x = Math.PI / 2; // glTF +y up -> asset +z up
      return inner;
    }).catch((err) => {
      glbCache.delete(url); // try again on the next redraw
      throw new Error(`${url}: ${(err && err.message) || err}`);
    }));
  }
  return glbCache.get(url);
}

function boxesModel(boxes) {
  const g = new THREE.Group();
  for (const b of boxes) {
    const geo = new THREE.BoxGeometry(...b.size);
    const color = new THREE.Color().setRGB(b.rgba[0], b.rgba[1], b.rgba[2], THREE.SRGBColorSpace);
    const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
      color, roughness: 0.6, metalness: 0.05, transparent: b.rgba[3] < 1, opacity: b.rgba[3],
    }));
    mesh.position.set(...b.pos);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.own = true;
    g.add(mesh);
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo),
      new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25 }));
    edges.position.copy(mesh.position);
    edges.userData.own = true;
    g.add(edges);
  }
  return g;
}

async function modelFor(entry) {
  if (entry.glb) return (await loadGlb(entry.glb)).clone(true);
  return boxesModel(entry.boxes || []);
}

// A box of what draws: a flipbook frame parked at scale 0 has a box at its
// translation that would otherwise count (studio meshload.js drawnBox).
function drawnBox(root) {
  const box = new THREE.Box3(), part = new THREE.Box3();
  root.updateMatrixWorld(true);
  root.traverse((o) => {
    if (!(o.isMesh || o.isLineSegments) || !o.visible || o.matrixWorld.determinant() === 0) return;
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    box.union(part.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld));
  });
  return box;
}

// ── the scene ──────────────────────────────────────────────────────────────
let content = new THREE.Group();
world.add(content);
let items = [];          // {entry, node, kind, row}
let portBadges = [];     // {el, pos: Vector3 (world), normal: Vector3}
let seatedBoard = null;  // board id the seat and the camera were set for
let framing = { d: 150, height: 20 };
let buildSeq = 0;
let lastScene = null;
let hot = null;

const shortPorts = (ports) => ports.map((p) => p.replace(/^port_/, '')).join('+');

function poseNode(entry, model) {
  const node = new THREE.Group();
  node.position.set(...entry.pos);
  const [w, x, y, z] = entry.quat;
  node.quaternion.set(x, y, z, w);
  node.add(model);
  return node;
}

function clearContent() {
  world.remove(content);
  content.traverse((o) => {
    // geometry and materials of cloned GLBs are shared with the cache: keep them
    if (o.userData.own) { o.geometry.dispose(); o.material.dispose(); }
  });
  content = new THREE.Group();
  world.add(content);
  labelsEl.replaceChildren();
  items = [];
  portBadges = [];
  setHot(null);
}

// studio Viewport._seatAndFrame: centre the whole load on the grid and stand it
// on the ground. A redraw of the same board keeps the shift and the camera, as
// studio's does: re-centring under a still camera slides the whole board when a
// motor is added past the rim.
function seat() {
  stage.position.set(0, 0, 0);
  const box = drawnBox(content);
  if (box.isEmpty()) return;
  const centre = box.getCenter(new THREE.Vector3());
  stage.position.set(-centre.x, -box.min.y, -centre.z);
  const size = box.getSize(new THREE.Vector3());
  const big = Math.max(size.x, size.y, size.z) || 50;
  grid.scale.setScalar(Math.max(1, (big * 3) / 400));
  framing = { d: big * 1.85, height: size.y };
}

async function build(data) {
  const seq = ++buildSeq;
  const failures = [];

  const want = async (entry) => {
    try { return await modelFor(entry); } catch (e) { failures.push(e.message); return null; }
  };
  const boardModel = await want(data.board);
  const fixed = await Promise.all(data.fixed.map(want));
  const mods = await Promise.all(data.modules.map(want));
  if (seq !== buildSeq) return; // a newer scene arrived while this one loaded

  clearContent();
  if (boardModel) content.add(boardModel);

  const occupied = new Set();
  const addItem = (entry, model, kind) => {
    if (!model) return;
    const node = poseNode(entry, model);
    content.add(node);
    entry.ports.forEach((p) => occupied.add(p));
    const item = { entry, node, kind, row: null };
    node.traverse((o) => { o.userData.item = item; });
    items.push(item);
  };
  data.fixed.forEach((e, i) => addItem(e, fixed[i], 'fixed'));
  data.modules.forEach((e, i) => addItem(e, mods[i], 'module'));

  const first = seatedBoard !== data.board.id;
  if (first) seat();
  stage.updateMatrixWorld(true);

  // Free sockets, numbered when the user asks for it ("Port numbers").
  for (const p of data.board.ports) {
    if (p.reserved || occupied.has(p.id)) continue;
    const el = document.createElement('div');
    el.className = 'port' + (p.face === 'bottom' ? ' under' : '');
    el.textContent = p.id.replace(/^port_/, '');
    el.title = `${p.id} (free)`;
    labelsEl.appendChild(el);
    const pos = world.localToWorld(new THREE.Vector3(...p.pos));
    const normal = new THREE.Vector3(0, p.face === 'bottom' ? -1 : 1, 0);
    portBadges.push({ el, pos, normal });
  }

  renderPanel(data);
  showBanner(data, failures);
  if (first) { frame('iso'); seatedBoard = data.board.id; }
  invalidate();
  $('#loading').hidden = true;
}

// ── camera: studio Viewport.frame / setView ────────────────────────────────
function frame(view) {
  const { d, height } = framing;
  const y = height / 2;
  const P = {
    iso: [-d * 0.62, d * 0.62 + y, d * 0.78],
    top: [0, d * 1.35 + y, 0.001],
    bottom: [0, y - d * 1.35, 0.001], // not studio's: the 10-port board has ports underneath
  }[view];
  if (!P) return;
  const target = new THREE.Vector3(0, y, 0);
  const dir = new THREE.Vector3(...P).sub(target);
  // Studio's distance ignores the canvas shape, and on a phone the board spilled
  // off the sides. Same direction; back off only until every corner is on screen.
  const box = drawnBox(content);
  const corners = [];
  if (!box.isEmpty()) {
    for (const cx of [box.min.x, box.max.x]) for (const cy of [box.min.y, box.max.y])
      for (const cz of [box.min.z, box.max.z]) corners.push(new THREE.Vector3(cx, cy, cz));
  }
  const v = new THREE.Vector3();
  const place = (k) => {
    camera.position.copy(target).addScaledVector(dir, k);
    camera.lookAt(target);
    camera.near = Math.max(0.1, (d * k) / 500);
    camera.far = d * k * 60;
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld(true);
    return corners.every((c) => {
      v.copy(c).project(camera);
      return v.z < 1 && Math.abs(v.x) <= 0.94 && Math.abs(v.y) <= 0.94;
    });
  };
  let k = 1;
  while (!place(k) && k < 8) k *= 1.06;
  controls.target.copy(target);
  controls.update();
  invalidate();
}

// ── panel and banner ───────────────────────────────────────────────────────
function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

// One table row per module: the port number in large type, then the module's plain name.
const portOrder = (ports) => (ports.length ? parseInt(ports[0].replace(/^port_/, ''), 10) || 999 : 999);

function moduleRow(m, cls) {
  const row = el('tr', cls);
  const num = el('th', 'pnum' + (m.ports.length > 1 ? ' pair' : ''), m.ports.length ? shortPorts(m.ports) : '?');
  num.scope = 'row';
  const what = el('td', 'what');
  what.append(el('div', 'name', m.name));
  row.append(num, what);
  return row;
}

function renderPanel(data) {
  $('#project-name').textContent = data.project;
  document.title = `${data.project} · Atech board view`;
  $('#board-note').textContent = data.board.note || '';
  $('#board-note').hidden = !data.board.note;

  const list = $('#modules');
  list.replaceChildren();
  const byPort = (a, b) => portOrder(a.ports) - portOrder(b.ports);
  for (const item of items.filter((i) => i.kind === 'module').sort((a, b) => byPort(a.entry, b.entry))) {
    const m = item.entry;
    const row = moduleRow(m, 'row');
    if (m.boxes) row.querySelector('.what').append(el('div', 'approx', 'No 3D model yet: drawn as a grey box.'));
    row.addEventListener('pointerenter', () => setHot(item));
    row.addEventListener('pointerleave', () => setHot(null));
    item.row = row;
    list.appendChild(row);
  }
  $('#no-modules').hidden = data.modules.length + data.unplaced.length > 0;
  $('#modules-table').hidden = data.modules.length === 0;

  const un = $('#unplaced');
  un.replaceChildren();
  for (const m of [...data.unplaced].sort(byPort)) {
    const row = moduleRow(m, 'row bad');
    row.querySelector('.what').append(el('div', 'why', m.why));
    un.appendChild(row);
  }
  $('#unplaced-section').hidden = data.unplaced.length === 0;

  const c = $('#cautions');
  c.replaceChildren();
  for (const x of data.cautions) {
    const m = [...data.modules, ...data.unplaced].find((e) => e.instance === x.instance);
    const where = m && m.ports.length ? `, port ${shortPorts(m.ports)}` : '';
    c.append(el('strong', '', `Caution: ${m ? m.name : x.module}${where}`), el('p', '', x.text));
  }
  c.hidden = data.cautions.length === 0;
}

function showBanner(data, failures = []) {
  const b = $('#banner');
  const parts = [];
  if (data.error) {
    parts.push(['project.yaml does not load' + (lastScene ? ' (still showing the last version that did)' : ''), data.error]);
  }
  if (data.issues && data.issues.length) {
    parts.push([`${data.issues.length} placement issue(s), as atech validate reports them`,
      data.issues.map((i) => `[${i.instance}]${i.ports.length ? ' (' + i.ports.join(', ') + ')' : ''} ${i.message}`).join('\n')]);
  }
  if (failures.length) parts.push(['A model did not load', failures.join('\n')]);
  b.replaceChildren();
  for (const [title, body] of parts) b.append(el('strong', '', title), el('div', '', body));
  b.hidden = parts.length === 0;
}

// ── hover: studio's card over the part, from the 3D view or the panel ──────
function fillCard(item) {
  const e = item.entry;
  const lines = [el('b', '', e.name), el('span', 'hv-port', `Port ${shortPorts(e.ports)}`)];
  if (item.kind === 'fixed') {
    lines.push(el('span', 'hv-use', 'Power and USB, fixed to the board. Not in project.yaml.'));
  } else {
    if (e.boxes) lines.push(el('span', 'hv-hint', 'No 3D model yet: drawn as a grey box.'));
  }
  card.replaceChildren(...lines);
}

function setHot(item) {
  if (hot === item) return;
  if (hot && hot.row) hot.row.classList.remove('hot');
  hot = item;
  if (hot) {
    if (hot.row) hot.row.classList.add('hot');
    fillCard(hot);
  }
  card.hidden = !hot;
  renderer.domElement.style.cursor = hot ? 'pointer' : '';
  invalidate();
}

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
renderer.domElement.addEventListener('pointermove', (ev) => {
  if (ev.buttons) return;
  const r = renderer.domElement.getBoundingClientRect();
  pointer.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
  raycaster.setFromCamera(pointer, camera);
  const hit = raycaster.intersectObjects(items.map((i) => i.node), true).find((h) => h.object.visible);
  const item = (hit && hit.object.userData.item) || null;
  setHot(item);
  if (item && item.row) item.row.scrollIntoView({ block: 'nearest' });
});
renderer.domElement.addEventListener('pointerleave', () => setHot(null));

// ── projected overlays ─────────────────────────────────────────────────────
const tmp = new THREE.Vector3();
const toCam = new THREE.Vector3();
const hoverBox = new THREE.Box3();

function placeBadge(elm, pos, normal, w, h) {
  tmp.copy(pos).project(camera);
  if (tmp.z >= 1) { elm.style.opacity = '0'; return; }
  // a badge on the face turned away from the camera fades out
  toCam.copy(camera.position).sub(pos);
  const x = (tmp.x + 1) / 2 * w, y = (1 - tmp.y) / 2 * h;
  elm.style.transform = `translate(-50%,-50%) translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
  elm.style.opacity = normal.dot(toCam) > 0 ? '1' : '0';
}

// studio Viewport._updateHoverLabel: the top centre of the part's box, 2 mm up,
// the card hanging just above it.
function placeCard(w, h) {
  if (!hot) return;
  hoverBox.copy(drawnBox(hot.node));
  if (hoverBox.isEmpty()) { card.hidden = true; return; }
  tmp.set((hoverBox.min.x + hoverBox.max.x) / 2, hoverBox.max.y + 2, (hoverBox.min.z + hoverBox.max.z) / 2);
  tmp.project(camera);
  if (tmp.z >= 1) { card.style.display = 'none'; return; }
  card.style.display = '';
  const x = (tmp.x + 1) / 2 * w, y = (1 - tmp.y) / 2 * h;
  card.style.transform = `translate(-50%, calc(-100% - 8px)) translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
}

function resize() {
  const w = host.clientWidth, h = host.clientHeight;
  if (!w || !h) return;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h, false);
  invalidate();
}
new ResizeObserver(resize).observe(host);
resize();

function tick() {
  requestAnimationFrame(tick);
  const moving = controls.update(); // true while the damping still turns the camera
  if (!moving && !dirty) return;
  dirty = false;
  renderer.render(scene, camera);
  const w = host.clientWidth, h = host.clientHeight;
  for (const p of portBadges) placeBadge(p.el, p.pos, p.normal, w, h);
  placeCard(w, h);
}
tick();

// ── toolbar ────────────────────────────────────────────────────────────────
document.querySelectorAll('#toolbar [data-view]').forEach((b) => b.addEventListener('click', () => frame(b.dataset.view)));
const portsToggle = $('#show-ports');
// Off unless asked for: studio numbers no port, the board's silkscreen does.
let portsOn = false;
try { portsOn = localStorage.getItem('atech-view-port-numbers') === 'on'; } catch (_) { /* no storage */ }
const applyPorts = () => {
  portsToggle.setAttribute('aria-pressed', String(portsOn));
  labelsEl.classList.toggle('no-ports', !portsOn);
  invalidate();
  try { localStorage.setItem('atech-view-port-numbers', portsOn ? 'on' : 'off'); } catch (_) { /* no storage */ }
};
portsToggle.addEventListener('click', () => { portsOn = !portsOn; applyPorts(); });
applyPorts();

// ── light / dark: studio's moon/sun button. index.html set the first one. ──
const themeBtn = $('#theme');
const systemDark = matchMedia('(prefers-color-scheme: dark)');
const showTheme = () => {
  const dark = document.documentElement.dataset.theme === 'dark';
  themeBtn.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
  themeBtn.title = themeBtn.getAttribute('aria-label');
  invalidate();
};
themeBtn.addEventListener('click', () => {
  const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  try { localStorage.setItem('atech-view-theme', next); } catch (_) { /* no storage */ }
  showTheme();
});
systemDark.addEventListener('change', (e) => {  // follow the system until a choice is saved
  let saved = null;
  try { saved = localStorage.getItem('atech-view-theme'); } catch (_) { /* no storage */ }
  if (saved !== 'light' && saved !== 'dark') {
    document.documentElement.dataset.theme = e.matches ? 'dark' : 'light';
    showTheme();
  }
});
showTheme();

// ── live: redraw when the server says project.yaml changed ─────────────────
let shown = -1;
async function refresh() {
  let data;
  try {
    const res = await fetch('/scene.json', { cache: 'no-store' });
    data = await res.json();
  } catch (e) {
    return; // the server is gone; the live indicator says so
  }
  shown = data.version;
  if (data.error) {
    showBanner(data);
    if (!lastScene) $('#loading').textContent = 'project.yaml does not load yet: see the message above.';
    return;
  }
  lastScene = data;
  await build(data);
}

const live = $('#live');
function setLive(state, text) { live.dataset.state = state; live.querySelector('.text').textContent = text; }
const events = new EventSource('/events');
let connected = false;
events.onopen = () => {
  setLive('live', 'Live · follows project.yaml');
  // Back after the viewer restarted: its versions start again from 0, so redraw.
  if (connected) refresh();
  connected = true;
};
events.onerror = () => setLive('down', 'Stopped · run atech view again');
events.onmessage = (ev) => { if (Number(ev.data) !== shown) refresh(); };
refresh();
