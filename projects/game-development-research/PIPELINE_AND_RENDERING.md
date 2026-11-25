# Game art pipeline, rendering and interchange

Checked: **2026-11-25**. This guide turns the submitted tutorial and repository leads into an actionable Daftar production workflow. External facts are linked to creator or maintainer sources. The production exercises and acceptance criteria below are Daftar recommendations, not claims that a creator tested our projects.

The machine-readable companion is [resources/pipeline-and-rendering.json](resources/pipeline-and-rendering.json). It records verification, access and corrections separately. This increment adds research and workflow guidance; it does not install these packages, acquire paid courses, import their project assets or certify an engine round trip.

## 1. Corrected resource map

| Submitted lead | What primary sources establish | How the team should use it |
|---|---|---|
| Robin Squares — “HOW BIG BOYS RENDER” | The exact submitted title was not verified. Robin's [own compositing sheet page](https://robinsquares.gumroad.com/l/backtobeauty) links [this rendering workflow video](https://www.youtube.com/watch?v=Tjy-iavq3ps). The sheet is listed at $0+, and covers reconstructing a finished image from passes. | Keep the lead as an alias, with the title uncertainty visible. Use the verified sheet and creator-linked video for pass planning. Do not invent a GitHub repository for the tutorial. |
| stache — Celsius on a low-end laptop | The creator's [How I Made My First Short Film In Blender (w/ A Potato Laptop)](https://www.youtube.com/watch?v=tvA_sXkdvEY) lists memory-limit and optimization chapters. The [creator's Celsius film post](https://www.patreon.com/Stache770/posts/celsius-4k-free-88252444) is marked free; a [Celsius source-files breakdown](https://www.patreon.com/Stache770/posts/patreon-12-next-89106387) is visibly locked. | Study shot scope and measured resource use. The film's free viewing/download label does not make every source file free or reusable in our repository. This is an individual production case, not a hardware benchmark. |
| InLightVFX — “REAL → CGI”, behind glass | The creator's [Composite CGI Element Behind Real Glass - Blender VFX Tutorial (Full)](https://www.youtube.com/watch?v=qdqV4oortP0) is verified. Its description mentions an infographic and project file. The [creator's course site](https://www.inlightvfx.com/) separately advertises paid training and downloadable project files. | Use the public tutorial to design a camera/occlusion/reflection exercise. The exact “REAL → CGI” title and unrestricted project-download access were not established. Follow the creator's current links and terms. |
| Manuel Bastioni Lab | [MB-Lab](https://github.com/animate1978/MB-Lab) is a community successor to ManuelBastioniLAB, not proof that the original project is maintained. The repository is archived; its README identifies 1.8.1 as final and directs development toward CharMorph. | Treat MB-Lab as a pinned legacy compatibility experiment. Evaluate [CharMorph](https://github.com/Upliner/CharMorph) separately before selecting a character pipeline. |
| `blender/blender-addons` | The [official GitHub mirror](https://github.com/blender/blender-addons) is archived and contains historical `io_scene_fbx` and `io_scene_gltf2` directories. | Useful for historical implementation study. Use the installed Blender release, its matching manual and maintained upstream exporter sources for production. |

Robin also publishes a [render-log-to-CSV script](https://robinsquares.gumroad.com/l/csvlog). Its page describes a Python/Tkinter GUI script; it is a reference for logging, not an installed Daftar dependency or a demonstrated headless exporter. No creator download was mirrored here.

## 2. Interchange decisions: choose for the asset and destination

**The blanket rule “use glTF instead of FBX for Unity, FBX for Unreal, both built in” needs correction.** Unity's current [6.6 model-format reference](https://docs.unity.com/en-us/engine/6000.6/manual/assets-and-media/asset-types/models/creating-dccassets/3d-formats) recommends FBX for its regular model pipeline. Unity [glTFast](https://docs.unity3d.com/Packages/com.unity.cloud.gltfast@6.14/manual/index.html) supports glTF import/export in the editor and at runtime, but is a separately installed package. Blender export support and destination-engine import support are different questions.

| Destination / task | Recommended starting route | Dependency and acceptance implications |
|---|---|---|
| Unity: conventional authored character, skeletal animation and editor asset workflow | Export FBX and use Unity's model importer. | Inspect rig mapping, root motion, clips, normals and scale. Avoid making `.blend` import a hidden build-machine dependency. [Unity model documentation](https://docs.unity.com/en-us/engine/6000.6/manual/assets-and-media/asset-types/models/creating-dccassets/3d-formats). |
| Unity: shared GLB library, web-compatible PBR assets, runtime loading | Export GLB; install and pin `com.unity.cloud.gltfast`. | Commit the package lock; check the package's actual support for required extensions, materials, animation and the chosen render pipeline. Package presence is not automatic. [Official installation](https://docs.unity3d.com/Packages/com.unity.cloud.gltfast@6.14/manual/installation.html). |
| Unreal: skeletal meshes, animation, morph targets and established FBX production | FBX is the documented starting route. | Epic documents an FBX 2020.2 pipeline; exporter differences still need a real import test. [FBX content pipeline](https://dev.epicgames.com/documentation/unreal-engine/fbx-content-pipeline?lang=en-US). |
| Unreal: GLB/glTF scene assets | Use the engine's glTF Interchange route. | Check the enabled plugins and engine-version behavior. Epic's Interchange guide describes glTF support and labels its Interchange FBX support experimental on the page reviewed; this does not mean Unreal's established FBX pipeline is experimental. [Interchange guide](https://dev.epicgames.com/documentation/en-us/unreal-engine/importing-assets-using-interchange-in-unreal-engine). |
| Godot: general scene and character exchange | Prefer GLB/glTF 2.0. | Godot's stable documentation recommends glTF and supports FBX through `ufbx`. Direct `.blend` import calls an installed Blender; exported GLB avoids that external dependency on consuming machines. [Available formats](https://docs.godotengine.org/en/stable/tutorials/assets_pipeline/importing_3d_scenes/available_formats.html). |
| Browser / Daftar heritage viewer | GLB for the reviewed delivery derivative; retain the authoring source separately. | Confirm the viewer supports every required extension. Review loading, GPU memory, materials and camera framing using the existing [heritage integration](../../integrations/heritage-assets/README.md) and [Godot review harness](../../integrations/godot-heritage-review/README.md). |

The [Blender 5.2 LTS glTF manual](https://docs.blender.org/manual/en/5.2/addons/scene_gltf2.html) documents the importer/exporter as enabled by default. The [format overview](https://docs.blender.org/manual/en/5.2/files/import_export/index.html) explains that some formats are enabled by default and others are bundled add-ons. The maintained [Khronos glTF-Blender-IO source](https://github.com/KhronosGroup/glTF-Blender-IO) is the relevant exporter project. **Cloning the archived all-add-ons mirror is not a required export installation step.**

Version scope matters: this review consulted Unity 6.6 model docs, glTFast 6.14.1 docs, Blender 5.2 LTS docs, Epic's rolling Unreal documentation and Godot's stable docs. Those are documentation versions, not statements that all those applications or versions were installed or tested in this workspace. Keep Daftar's working runtime pinned until a compatibility fixture passes.

## 3. A practical Blender-to-engine asset contract

Before a whole character or heritage scene is converted, export a deliberately small fixture containing a labeled reference length, asymmetric geometry, a parent-child transform, two materials, a UV checker, one deformation clip and one shape key. This detects orientation and scale problems while the cost of re-exporting is small.

Record the following in the asset receipt:

| Field | Evidence to keep |
|---|---|
| Identity | Source URL or original-author identity, permitted use, source hash and derivative hash |
| Versions | Blender, exporter, engine, importer/plugin and operating-system versions |
| Geometry | Triangles and vertices before/after export, mesh bounds, named units, transforms, normals and UV channels |
| Appearance | Material count, texture paths/hashes, color-space intent, alpha modes and normal-map convention |
| Animation | Deformation bones, rest pose, clip names, frame rate, duration, first/last pose, root-motion policy and shape-key range |
| Reproduction | Export options, import options, conversion command or recorded UI settings, warnings and a representative screenshot |
| Acceptance | Actual target-engine import, playable animation or camera inspection, measured memory/load behavior and reviewer result |

These are proposed review requirements. A valid file or a successful Blender re-import alone does not establish target-engine compatibility. A triangulation change can be legitimate; a material disappearing or a rest pose moving is a defect until explained.

For procedural assets, preserve the editable source. Produce a delivery mesh with the evaluated geometry needed by the target. The glTF exporter documents triangular output and restricted material/animation representations; it is not a lossless container for an arbitrary Blender project. Expect to bake or recreate unsupported shader and simulation behavior. See the [versioned exporter manual](https://docs.blender.org/manual/en/5.2/addons/scene_gltf2.html).

For Daftar's detailed historical buildings, keep an untouched source and a clearly labeled viewing derivative. Use measured dimensions only when a reliable source establishes units. A dense mesh or attractive render does not establish archaeological accuracy. Reuse the existing provenance fields rather than overwriting uncertain scale with invented measurements.

## 4. Rendering workflow for limited hardware

The following is a proposed Daftar exercise inspired by the verified Celsius production breakdown; it is not a claimed reproduction of stache's scene files.

1. **Choose one shot.** State duration, resolution, framing, movement and the visual point the shot must communicate. Make an inexpensive composition preview before detailing unseen geometry.
2. **Measure a baseline frame.** Record software/device, scene and texture sizes, peak memory if available, elapsed time, samples, denoising, output resolution and all failed attempts. Fix the camera and lighting while comparing settings.
3. **Change one bottleneck at a time.** Compare texture resolution, subdivision, instancing and visibility choices on the same frame. Inspect silhouettes, shadow edges and close-up texture detail. Keep the source scene and save each candidate's settings.
4. **Test the difficult interval.** Use a short consecutive frame range with motion, fine detail, disocclusion and reflections. Single-frame appearance cannot detect denoising shimmer or temporal instability.
5. **Keep a recoverable master.** Render an image sequence, verify frame count and decoding, then encode a review movie. Retain enough settings and logs to repeat missing frames.
6. **Accept only a measured tradeoff.** Record what improved, what was lost and the final chosen setting. Do not extrapolate a tutorial's success into a promise about another machine or scene.

Blender documents [render passes](https://docs.blender.org/manual/en/5.2/render/layers/passes.html), including auxiliary denoising data. Passes consume resources; request only those required by the shot. Its [sampling guide](https://docs.blender.org/manual/en/5.3/render/cycles/render_settings/sampling.html) describes adaptive sampling and denoising options. Treat sample limits and denoising as parameters to measure, not universal quality presets.

## 5. Render layers, compositing and color

Start with a beauty render and a shot-specific pass list. For a compositing exercise, use an object mask, an appropriate depth/mist representation and any lighting components needed for the intended adjustment. Reconstruct the unmodified beauty as a control before changing individual contributions. This exercise connects Robin's [verified pass-reconstruction sheet](https://robinsquares.gumroad.com/l/backtobeauty) to a repeatable acceptance condition.

Record the working color space, input transforms, view transform, exposure, file color space and delivery transform. Keep scene-linear intermediates distinct from display-ready previews. Blender's [color-space documentation](https://docs.blender.org/manual/en/5.1/render/color_management/color_spaces.html) describes its color-management configuration; the [display/view documentation](https://docs.blender.org/manual/id/5.2/render/color_management/displays_views.html) explains the separate treatment of render viewing and intermediate images. Use a neutral patch and highlight comparison across applications to detect a double-applied display transform. Selecting an ACES or AgX label alone is not a color round-trip test.

For the InLightVFX-inspired **object behind real glass** exercise, capture or use footage for which the team has permission. Define a camera match and separate what belongs in front of, inside and behind the glass. Review occlusion at edges, reflections, refraction, contact/shadows, depth of field, grain and movement over a short sequence. Keep original footage and the unmodified CG pass as controls. These are Daftar review questions; no claim is made that the creator's downloadable assets have been obtained.

## 6. Character generation: legacy versus candidate tooling

[ManuelBastioniLAB](https://github.com/animate1978/MB-Lab#manuelbastionilab-161a) is the historical origin, and [MB-Lab](https://github.com/animate1978/MB-Lab) is its community continuation. The latter was archived on July 21, 2024; its final-version notes target Blender 4.0 and identify known issues. “4.0+” in that archived README is not an executed compatibility claim for later releases.

The documented next project is [CharMorph](https://github.com/Upliner/CharMorph). Its [license file](https://github.com/Upliner/CharMorph/blob/master/license.txt) distinguishes code and data terms. Evaluate the selected revision with one character through deformation, material export, engine import and animation before assigning it to a production role. Verify the license of the actual base model, hair, clothing and textures as well as the add-on code; a public repository does not settle every bundled asset's reuse terms.

Existing Daftar execution entry points remain [creative tools](../../integrations/creative-tools/README.md) and the [OpenCodeGameStudios integration](../../integrations/opencode-game-studios/README.md). Resource discovery does not activate an engine, buy an asset or create a model job.

## 7. Team handoff and done criteria

| Owner | Next concrete output | Evidence required |
|---|---|---|
| Technical artist / build engineer | One fixture exported through the selected destination route | Versions, settings, source/derivative hashes and target import result |
| Character artist / animator | One original or properly licensed character with a short deformation test | Rest-pose comparison, clip playback and material/shape-key review |
| Lighting / compositing artist | One still and short sequence with controlled pass/color comparison | Beauty control, intermediate files and frame-range review |
| Graphics programmer | A representative asset running in the actual target | Frame/load/memory observations on the named device and renderer |
| QA reviewer | Acceptance receipt listing defects and preserved limitations | Reproducible commands/settings and an explicit pass/fail per criterion |

Mark **reference verified**, **download acquired**, **installed**, **fixture tested**, **project integrated** and **published** independently. This prevents a useful link list from being mistaken for completed software integration or completed gameplay.
