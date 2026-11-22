# Blueprint World — open-source decisions

**Decision dates:** 21–22 November 2026. This record covers the standalone local frontend and its Studio expansion. Library capability is separate from acceptance of this application: actual WebGL was unavailable in managed Chrome, so GPU appearance, shaders and rendered-scene picking remain unverified.

## Adopted: Three.js 0.187.0 and OrbitControls

The [build manifest](build-tools/package.json) and [lockfile](build-tools/package-lock.json) pin `three` to **0.187.0**. The build packages Three.js and its OrbitControls addon into [blueprint-world-vendor.js](../../cloud-workspace/public/concepts/blueprint-world-vendor.js); application modules import that local bundle. The matching [MIT license notice](../../cloud-workspace/public/concepts/blueprint-world-LICENSES.txt) is retained alongside it. The [build script](build-tools/build.mjs) uses pinned esbuild 0.27.4; it is a development build tool.

Three.js supplies the scene, flat geometry, materials and camera mathematics. OrbitControls supplies the pan/orbit/zoom control foundation. An orthographic camera fits the default overhead working view: apparent size does not depend on distance from the camera. These choices support the blueprint interaction requirements; they make no comparative quality or performance claim.

Primary documentation:

- [WebGLRenderer](https://threejs.org/docs/pages/WebGLRenderer.html) — WebGL rendering API and its WebGL2 requirement.
- [OrbitControls](https://threejs.org/docs/pages/OrbitControls.html) — camera orbit, zoom, pan and damping; an explicit addon import.
- [OrthographicCamera](https://threejs.org/docs/pages/OrthographicCamera.html) — orthographic projection and camera parameters.

### Architectural relief without another engine

The Studio expansion keeps the same pinned bundle and adds no runtime dependency. [blueprint-world-relief.js](../../cloud-workspace/public/concepts/blueprint-world-relief.js) builds the contained company slabs and slim room partitions with Three.js geometry and `MeshStandardMaterial`. Its controlled material response, directional lighting and bounded shadow-map configuration provide the source-level architectural depth. Camera-facing cutaway lowers near-side partitions; it does not alter company ownership or turn flat employee circles into figures. These implementation choices still need actual WebGL visual acceptance.

The renderer retains one camera/update lifecycle and a bounded number of detailed companies. The relief layer does not own another animation loop. The final [studio-renderer-evidence.json](validation/studio-renderer-evidence.json) records 21 passing non-GPU groups, including capacity/dense-layout fixtures and 4,100 marker-occlusion rays. This CPU mathematics and resource-count evidence must not be presented as GPU frame-rate or shader evidence. The [version 17 publication receipt](publication.json) records delivery of the exact source; publication does not establish the still-unverified WebGL visual result.

Primary documentation used for this addition:

- [MeshStandardMaterial](https://threejs.org/docs/pages/MeshStandardMaterial.html) — metallic/roughness material properties and lighting behavior.
- [Three.js lighting manual](https://threejs.org/manual/pages/lights.html) — light types and directional-light targeting.

## Evaluated, not added: Troika text

[Troika's text documentation](https://protectwise.github.io/troika/troika-three-text/) describes signed-distance-field glyph rendering, font parsing and worker-based layout/generation. Its font and fallback loading paths would require deliberate local asset packaging and worker/CSP verification for this application. That integration was not added. Revisit it only with a defined text-quality problem, pinned assets and actual browser evidence; numerical checks cannot establish glyph legibility or shader behavior.

## Evaluated, not added: Rapier

[Rapier](https://rapier.rs/) provides physics simulation with JavaScript/WebAssembly support. The current interface needs bounded presentation springs, overlap checks and containment. Those requirements are handled by the local UI motion/constraint layer, so this build does not add Rapier or its WASM lifecycle. A larger collision or joint requirement would need a separate measured decision. No rigid-body engine is required merely to display flat blueprints in a 3D camera world.

The [architecture plan](PLAN.md) retains broader alternatives and future acceptance targets. No Troika/Rapier dependency, remote model execution, native integration or graphics benchmark is implied by this decision record.
