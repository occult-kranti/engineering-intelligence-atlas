# Game art and production research plan

Daftar's art, Blender, game design, engineering and QA teams use this plan to turn
selected learning references into inspectable game assets and engine evidence.
The references were reviewed on **2026-11-25**. Tasks below are planned work;
listing a course or pipeline does not mean that its lessons or engine tests ran.

## Start here

- [Art fundamentals and a 15-minute practice routine](ART_FUNDAMENTALS.md)
- [Engine interchange, rendering and compositing](PIPELINE_AND_RENDERING.md)
- [Art, tools and asset source audit](resources/art-and-assets.json)
- [Tutorial and pipeline source audit](resources/pipeline-and-rendering.json)
- [Pinned OpenCodeGameStudios resources](../../integrations/opencode-game-studios/README.md)
- [Existing interactive Three.js studio](../threejs-game-studio/README.md)
- [Captured architecture, evidence and accuracy limits](../architecture-library/site-models/README.md)

Use each audit's canonical links, access labels, license notes and claim
corrections. Keep an unverified exact tutorial title or unavailable repository as
a research lead. Do not promote it to an installed tool, tested workflow or
endorsed asset source. Creator names alone do not establish authorship of every
course, and a public tutorial is not a reusable asset license.

## Team handoff

| Owner | Work | Required handoff |
| --- | --- | --- |
| Donna / project director | Choose the next bounded task and relevant references; record target engine, version, existing authorization and budget | Task brief, source IDs, allowed output paths, acceptance criteria and next reviewer |
| Game designer | Define player action, silhouette, readability and required animation states | Gameplay requirement and reference sheet |
| Blender / 3D designer | Form studies, modeling, topology, UVs, materials, rigging and exports | Editable source, export settings, license ledger and inspection views |
| Graphics / engine programmer | Import, material translation, LOD, collision, animation and runtime profiling | Engine project, exact import result and measured frame/memory report |
| Gameplay engineer | Connect animations, hit volumes and asset states to the actual mechanic | Playable test and recorded input sequence |
| QA | Independently reproduce import, inspect provenance and compare the asset against its intended use | Pass/fail evidence, omissions and regression case |

Select only the relevant OpenCodeGameStudios art, design, programming, Godot or QA
documents through its [role map](../../integrations/opencode-game-studios/role-mapping.json).
Those definitions guide existing employees; they do not start 23 new agents or
grant tool access. Research and testing share the project's existing budget.
No paid course, add-on, model provider or host is required by this plan.

## Production sequence

### 1. Form and visual reasoning

Practice Drawing This supplies browser references for drawing practice. Follow
the sourced access and reuse rules in [Art fundamentals](ART_FUNDAMENTALS.md).
Use primitives to study perspective, organic forms to study gesture, and anatomy
references to study the visible structure. Create original sketches and record
what each exercise teaches the game asset being designed.

**Deliverable:** ten original views of a prop or head blockout, a gesture sheet,
and a small light/value study. **Acceptance:** a second reviewer can identify the
intended volume and viewing angle; studies improve the next model decision.
Practice drawings do not establish anatomical correctness of a production rig.

### 2. One complete low-poly prop

Use a verified Grant Abbitt or CG Cookie lesson relevant to the task. Build an
original prop with a readable silhouette, purposeful topology, clean normals,
UV layout and a material that survives the selected export route. Keep the
Blender source and a versioned export preset. Use Poly Haven materials or Kenney
prototype assets only with their actual item license recorded.

**Deliverable:** original `.blend`, exported asset, UV/normal inspection views,
source ledger and engine import receipt. **Acceptance:** no missing textures,
unintended scale change, flipped surfaces or silent replacement materials. Compare
the same camera and lighting in Blender and the engine; document expected shader
differences rather than claiming pixel identity.

### 3. Procedural environment kit

Choose a verified procedural lesson and build a small, original Geometry Nodes
experiment: rocks, columns, wall modules or terrain pieces. Preserve node inputs,
random seed and generated mesh counts. Use a small parameter grid to inspect
extreme cases before generating a larger collection. A tutorial's generic rock
cannot stand in for measured archaeology or a named monument.

**Deliverable:** editable node group, parameter table and a set of visually
distinct exports. **Acceptance:** bounded geometry, stable seed reproduction,
usable pivots and no disconnected or degenerate geometry that breaks the target
engine. Record generation time and peak memory when they affect the production
budget. Evaluate optional MACHIN3tools only after the native Blender workflow is
understood and its version/license fits the project.

### 4. Character movement and state transitions

Start with an original or explicitly reusable rig. If evaluating MB-Lab, follow
the archived-project and compatibility notes in
[Pipeline and rendering](PIPELINE_AND_RENDERING.md); do not treat old Blender
support as current support. Create a minimal locomotion set and one representative
action. Decide whether motion belongs in the animation or the gameplay controller.

**Deliverable:** source rig, exported clips, animation-state map and engine test.
**Acceptance:** joint orientation, skinning, clip boundaries, root motion and
transitions behave under actual input. Check feet, hands and extreme poses. A
rendered walk cycle is not proof of working gameplay animation.

### 5. Engine import and playable integration

Choose the engine and asset class before choosing the interchange format. Use the
official-documentation matrix in [Pipeline and rendering](PIPELINE_AND_RENDERING.md)
for Unity, Unreal and Godot. Record exact versions, importer/package settings,
coordinate units, supported glTF extensions, animation conventions and material
limitations. Use a minimal prop and a minimal rig as pipeline probes before the
large environment or hero.

**Deliverable:** engine project with a small playable interaction, source/export
hashes and import log. **Acceptance:** scene hierarchy, geometry, materials,
collisions and required animation survive. Test the actual extension set: the
heritage web GLBs use meshopt compression and may need a decoded derivative for
an engine importer. Never overwrite the preserving master for convenience.

### 6. Lighting, rendering and compositing

Use the verified Robin Squares, stache and InLightVFX references for their actual
topics. Record view transform and color-management decisions, render passes,
compositing nodes and environment-light provenance. Test a modest scene first.
Offline final-frame rendering and real-time game rendering have separate budgets.
Compositing behind filmed glass is a VFX exercise, not automatic proof that the
game engine's refraction implementation is physically complete.

**Deliverable:** reproducible lighting scene, one compositing study and documented
render settings. **Acceptance:** no missing pass dependencies, clipping caused by
an unintended transform, or unexplained material changes. If the brief calls for
gameplay footage, capture the playable engine build with controls and HUD; a film
render cannot satisfy that acceptance criterion.

### 7. Measure and deliver

Set the target device, resolution, graphics settings and scene workload before
profiling. A 60 FPS target implies a 16.67 ms total frame budget; it is a project
target until measured on the named device. Report frame-time percentiles, peak
memory, draw calls, visible triangles and texture residency where the engine can
measure them. Record warm-up, sampling interval and the input/camera sequence.

**Deliverable:** reproducible benchmark, source/release manifest and open-issues
list. **Acceptance:** the agreed scene fits the agreed limits, and the report
distinguishes measured, failed, unavailable and planned checks. A dense mesh,
Blender render, GPU name or successful import alone does not prove 60 FPS.

## First bounded work packets

| Packet | Roles | Concrete output | Completion condition |
| --- | --- | --- | --- |
| Original low-poly prop | Art + Blender + engine + QA | One prop and its import receipt | Scale, normals, UV/material and collision accepted in the chosen engine |
| Modular environment bay | Design + Blender + graphics + QA | Small original architectural kit with pivots and LOD plan | Modules align; derivatives retain a provenance trail; profiled scene stays within the chosen budget |
| Hero movement slice | Character art + gameplay + QA | Idle, locomotion and one action with an input-driven state machine | Transitions, foot/hand behavior and hit volumes work in gameplay |
| Captured monument inspection | Heritage + Blender + engine + QA | One preserved source and one separately identified engine derivative | Hashes, count differences, unknown physical units and missing coverage disclosed |

The heritage packet uses the existing seven-model collection as reference data.
Kailasa and Giza still need better permitted capture data for fine carving or
stone-level fidelity. Keep observed capture, historical reconstruction, original
game art and inferred fill visibly distinct.

## Resource selection in Daftar

The canonical registry is
[`company/role-library/resource-catalog.json`](../../company/role-library/resource-catalog.json).
The desktop reference room, hosted catalog and static atlas receive generated
projections. Game and spatial skills request bounded packets:

```sh
node scripts/resource-router.mjs --skill game-reconstruction-engineering --query "low poly Blender game asset" --limit 6
node scripts/resource-router.mjs --skill spatial-3d-production-engineering --query "drawing anatomy lighting" --limit 6
```

Read the linked source section before applying it. Record what was actually read
and tested; a router result is metadata. New downloads retain their own license,
version and hash. Do not scrape the Practice Drawing This reference collection,
copy creator course content, or infer redistribution rights from free access.

## Update and reproduction

After a source changes, recheck the canonical page and update its dated audit
entry. Change the central catalog once, then regenerate its browser/hosted and
atlas projections. After editing the project skill sources, regenerate their
existing `.skill` packages and native brief bundle:

```sh
python3 scripts/sync-skills.py --write
python3 scripts/sync-resource-projections.py --write
node scripts/resource-router.mjs --export-atlas > site-source/src/data/resources.ts
node scripts/resource-router.mjs --check-atlas
```

The existing heritage release gates additionally verify the pinned instruction
pack and model integrity before Pages deployment. New resources are references,
not automatically installed add-ons or a completed training program.
