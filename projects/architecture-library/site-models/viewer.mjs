import * as THREE from './vendor/three.module.mjs';
import { GLTFLoader } from './vendor/GLTFLoader.mjs';
import { OrbitControls } from './vendor/OrbitControls.mjs';
import { MeshoptDecoder } from './vendor/meshopt_decoder.mjs';

export async function createViewer(host, buffer, asset, onStatus, signal) {
  signal?.throwIfAborted();
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, .01, 1000);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = false; controls.enablePan = true;
  let model, disposed = false, ready = false;
  const textures = new Set(), geometries = new Set(), materials = new Set(), meshes = [];
  const render = () => { if (!disposed && ready && !document.hidden) renderer.render(scene, camera); };
  const resize = () => {
    if (disposed) return;
    const width = Math.max(1, host.clientWidth), height = Math.max(1, host.clientHeight);
    renderer.setSize(width, height, false); camera.aspect = width / height; camera.updateProjectionMatrix(); render();
  };
  const observer = new ResizeObserver(resize);
  const contextLost = event => { event.preventDefault(); onStatus('Graphics context was lost. Unload and retry, or use the source download.'); };
  renderer.domElement.addEventListener('webglcontextlost', contextLost);
  const dispose = () => {
    if (disposed) return; disposed = true;
    observer.disconnect(); controls.removeEventListener('change', render); controls.dispose();
    document.removeEventListener('visibilitychange', render);
    renderer.domElement.removeEventListener('webglcontextlost', contextLost);
    geometries.forEach(item => item.dispose());
    materials.forEach(item => item.dispose());
    textures.forEach(item => { item.dispose(); item.source?.data?.close?.(); });
    scene.clear(); renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove();
  };
  try {
    await MeshoptDecoder.ready;
    signal?.throwIfAborted();
    const manager = new THREE.LoadingManager();
    manager.setURLModifier(url => { if (!url.startsWith('blob:') && !url.startsWith('data:')) throw new Error('External model resource blocked'); return url; });
    const loader = new GLTFLoader(manager).setMeshoptDecoder(MeshoptDecoder);
    const gltf = await loader.parseAsync(buffer, ''); model = gltf.scene;
    let triangles = 0;
    model.traverse(object => {
      if (!object.isMesh) return;
      meshes.push(object); geometries.add(object.geometry);
      if (!object.geometry.attributes.normal) object.geometry.computeVertexNormals();
      triangles += object.geometry.index ? object.geometry.index.count / 3 : object.geometry.attributes.position.count / 3;
      const originals = Array.isArray(object.material) ? object.material : [object.material];
      originals.forEach(material => { materials.add(material); for (const value of Object.values(material)) if (value?.isTexture) textures.add(value); });
      object.userData.sourceMaterial = object.material;
      object.userData.neutral = new THREE.MeshStandardMaterial({ color: 0xc8c9bc, roughness: .9, metalness: 0, side: THREE.DoubleSide });
      object.userData.wire = new THREE.MeshBasicMaterial({ color: 0x294b3b, wireframe: true, side: THREE.DoubleSide });
      materials.add(object.userData.neutral); materials.add(object.userData.wire);
    });
    signal?.throwIfAborted();
    if (triangles !== asset.triangles) throw new Error('Decoded triangle count differs from the reviewed catalog');
    scene.add(model);
    scene.add(new THREE.HemisphereLight(0xf6f8ef, 0x7d8a72, 2.1));
    const light = new THREE.DirectionalLight(0xfff5df, 2); scene.add(light);
    model.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(model), sphere = bounds.getBoundingSphere(new THREE.Sphere());
    if (!Number.isFinite(sphere.radius) || sphere.radius <= 0) throw new Error('Invalid model bounds');
    const centre = sphere.center, radius = sphere.radius;
    // Camera framing only. Source positions, node transforms and model scale are unchanged.
    const direction = new THREE.Vector3(...(asset.viewDirection || [1, .75, 1])).normalize();
    const reset = () => {
      const angle = THREE.MathUtils.degToRad(camera.fov / 2);
      const distance = radius / Math.sin(Math.atan(Math.tan(angle) * Math.min(camera.aspect, 1))) * 1.12;
      camera.position.copy(centre).addScaledVector(direction, distance);
      camera.near = Math.max(radius / 10000, .00001); camera.far = radius * 100;
      camera.updateProjectionMatrix(); controls.target.copy(centre);
      controls.minDistance = radius * .015; controls.maxDistance = radius * 20;
      light.position.copy(centre).add(new THREE.Vector3(radius * 2, radius * 3, radius));
      light.target.position.copy(centre); scene.add(light.target); controls.update(); render();
    };
    host.append(renderer.domElement); resize(); reset(); ready = true;
    controls.addEventListener('change', render); observer.observe(host); document.addEventListener('visibilitychange', render); render();
    return {
      triangles, dispose,
      surface(mode) { meshes.forEach(mesh => { mesh.material = mode === 'neutral' ? mesh.userData.neutral : mode === 'wire' ? mesh.userData.wire : mesh.userData.sourceMaterial; }); render(); },
      action(action) {
        if (action === 'reset') reset();
        else {
          const offset = camera.position.clone().sub(controls.target);
          if (action === 'left' || action === 'right') offset.applyAxisAngle(camera.up, action === 'left' ? -.17 : .17);
          if (action === 'in' || action === 'out') offset.multiplyScalar(action === 'in' ? .82 : 1.22);
          camera.position.copy(controls.target).add(offset); controls.update(); render();
        }
      },
    };
  } catch (error) { dispose(); throw error; }
}
