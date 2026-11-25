# Art fundamentals and Blender game-asset practice

Verified on **25 November 2026**. This is a project learning plan and reference
catalog. The exercises below are **planned**, not completed artwork, installed
software, or evidence of improved performance. The source review incurred no
external purchases or asset-download charges.

The goal is to connect observation, simple drawing, original Blender assets and
an actual game-engine import. A readable silhouette, useful scale and a convincing
pose should survive that entire path. Surface detail comes after those decisions.

The machine-readable source review is
[resources/art-and-assets.json](resources/art-and-assets.json). Use
[resources/asset-study-template.json](resources/asset-study-template.json) for an
individual practice record. Keep unknown measurements as `null` until measured.

## A daily fifteen-minute routine

This is an original Daftar schedule. Practice Drawing This promotes its own
[25-minute routine](https://practicedrawingthis.com/cgi-bin/index.cgi); the timing
below does not reproduce that course or promise a particular improvement rate.
Use a pencil and paper, an existing drawing app, or an original Blender blockout
when a task calls for a three-dimensional check.

| Time | Exercise | Visible result |
|---|---|---|
| 0–2 minutes | Draw straight lines between two points, then ellipses inside boxes. Prioritize deliberate placement over speed. | One small warm-up strip. |
| 2–5 minutes | Pick a box, cylinder or cone; rotate it once and draw both views. Add a center line and two cross-contours. | Two views of the same form. |
| 5–9 minutes | Study one hand, head, torso or bent limb. Mark its largest masses, joint direction and negative spaces before detail. | One construction sketch with a clear pose. |
| 9–12 minutes | Reduce the same reference to three value groups: light, middle and shadow. Keep the shadow shape consistent. | One small value study. |
| 12–14 minutes | Hide the reference and redraw the principal forms from memory. Reopen it and circle one difference. | A memory redraw and one correction. |
| 14–15 minutes | Write the reference URL, today's difficulty and the next specific adjustment. | A short study record. |

For a simpler start, repeat primitive forms throughout the session. For character
work, alternate head/hand construction with whole-pose silhouettes. For buildings,
replace the anatomy study with a doorway, buttress, column or roof junction. These
are practice subjects; a sketch or visual model does not establish archaeological
or dimensional accuracy.

[Practice Drawing This's model index](https://www.practicedrawingthis.com/cgi-bin/3d-models-index.cgi)
provides primitives and browser-rotatable references. Its
[anatomy section](https://practicedrawingthis.com/cgi-bin/3d-models-index.cgi?section=3d-models-anatomy)
includes adjustable body-part models, and its publisher documents
[lighting controls](https://practicedrawingthis.com/cgi-bin/carousel.cgi?episode=blog-2025-09-21-prepare-your-workspace-so-that-it-is-easy-to-start-drawing-the-next-day&section=newsletter-archive).
The [timed exercise page](https://practicedrawingthis.com/cgi-bin/morning-sketches-app-overview.cgi?illo=model-organic-008-bent-cone-002)
offers time choices and local progress backup. These pages were publicly readable
during research; no interactive browser test was run, so universal device support
and every login/download flow remain untested.

Its [reference-use terms](https://www.practicedrawingthis.com/cgi-bin/terms.cgi?terms=1)
allow publication and sale of drawings made from the references. They do not grant
permission to scrape or redistribute the site's raw photographs, models or code
as a reference collection. Store your own studies and source links in Daftar.

### What to review weekly

Compare one repeated subject under the same conditions. Record whether the
silhouette is readable, proportions remain consistent across views, forms turn
convincingly in space, and the light direction agrees with the shadow grouping.
Choose one correction for the next session. Do not assign an invented accuracy
percentage or claim a study demonstrates anatomy expertise.

## A practical progression from drawing to game assets

All stages are proposed tasks. Advance when the listed evidence exists, rather
than after a fixed number of days. The project director can shorten a stage for
an experienced artist while retaining the output and import checks.

### 1. Build one original prop from a silhouette

Choose a crate, lantern, stone marker or simple tool. Draw three silhouette
options, select one, and block it in Blender from primitive forms. Set an intended
size, useful origin and target viewing distance. Inspect front, side and
three-quarter views before adding detail. Name the object and save the source.

Use [Grant Abbitt's course index](https://www.gabbitt.co.uk/courses) to select a
beginner lesson or the verified
[Realistic Low Poly Game Assets – Rocks](https://www.youtube.com/watch?v=WQHBSgRQ50o)
lesson. The project task is to make a new prop using the technique, not to publish
a copy of the creator's course files.

**Acceptance:** an original `.blend`, consistent views, a recorded scale/origin,
and an exported asset that opens in the chosen engine. Record the actual triangle
count; choose any budget for this particular camera and device instead of calling
one number a universal game-art standard.

### 2. Make a small modular environment kit

Create a straight wall, corner, floor and doorway on one chosen grid. Put pivots
where snapping is useful. Assemble at least two different room layouts from the
same pieces. Test the kit inside the engine before detailed texturing; record any
gaps, overlaps, flipped faces or collision problems.

[CG Cookie's Building Modular Game Assets](https://www.cgcookie.com/courses/building-modular-game-assets)
is a verified course by **Kent Trammell**, covering a modular kit, shared UV space
and Unity workflow. It is an optional paid learning reference. The zero-spend
route uses original meshes, Blender documentation and the project's engine docs.

**Acceptance:** repeatable snapping, consistent dimensions, an engine scene using
the kit, and a short seam/pivot review. Historical architecture samples should
retain their own source and accuracy records when used as visual inspiration.

### 3. Separate geometric detail from texture detail

Keep a clean base mesh and create a distinct detailed version. Preserve the main
silhouette in the lower-resolution mesh. Unwrap the target, bake a normal map,
save the image, and compare the result under the same lighting. Record seams,
projection errors and details lost at the gameplay camera distance.

The [Blender baking manual](https://docs.blender.org/manual/en/latest/render/cycles/baking.html?highlight=bake)
documents the UV/image target and normal-bake workflow. The verified
[CG Cookie modeling course](https://www.cgcookie.com/courses/modeling-video-game-assets-in-blender/)
and [game-ready learning path](https://www.cgcookie.com/bundles/build-game-ready-assets-in-blender)
are optional references for retopology and bake diagnosis; they are not free
course downloads supplied by this repository.

**Acceptance:** separate source/target meshes, saved texture files, a wireframe
view and an engine comparison. A normal map is a rendering aid; it does not add
the missing physical geometry to a heritage preservation master.

### 4. Build and deform an original simple character

Start with a simple silhouette and joint placement. Model one side where useful,
check the origin and mirror plane, and keep bend regions easy to inspect.
[Blender's Mirror documentation](https://docs.blender.org/manual/en/latest/modeling/modifiers/generate/mirror.html)
explains the relevant axis, merge and clipping behavior. Grant Abbitt's verified
[PS1-style character lesson](https://www.youtube.com/watch?v=uIHuqFLa_X0) is a
specific starting reference rather than the unverified title in the supplied list.

Add a modest armature and test a neutral pose, bent elbows/knees, raised arms and
a crouch. Inspect the weight groups around joints and correct visible pinching;
the [official weight-paint guidance](https://docs.blender.org/manual/en/5.0/sculpt_paint/weight_paint/usage.html)
describes those adjustments. Keep the test character original and separate from
any named game hero or real person's likeness.

**Acceptance:** source mesh and rig, clear bone names, pose screenshots and a
deformation review. An attractive neutral pose alone does not pass this stage.

### 5. Export a small animation set

Create separately named idle and walk clips, with deliberate key poses and clear
loop boundaries. Add a short non-looping action only after the first two work.
Use [Ryan King Art's verified beginner animation page](https://ryanking.artstation.com/projects/Eab3W2)
or his [Arm and Leg IK tutorial resource](https://www.patreon.com/ryankingart/posts/arm-and-leg-ik-65379888)
as instruction. The tutorial files are described as free, but no open rig
redistribution license was verified or downloaded for this work.

Check the [Blender glTF export documentation](https://docs.blender.org/manual/en/latest/addons/scene_gltf2.html)
for the installed version. Action organization and supported animation channels
matter. Do not assume that every Blender constraint, material animation or
simulation transfers automatically.

**Acceptance:** imported clip names, correct duration/loop behavior, a usable rest
pose, and an engine capture of each clip. Record whether motion is in-place or
root-driven and apply that choice consistently.

### 6. Add one procedural or material experiment

Choose a restrained effect that serves gameplay: a readable interaction pulse,
a looping panel graphic, or a small environmental variation. Keep a static
fallback. Use [Ducky 3D's creator resources](https://www.ducky3d.com/about) for
motion/material study and [Polyfjord's actual tools index](https://tools.polyfjord.com/)
for procedural experiments. Reconstruct the effect in the engine when its Blender
implementation does not export.

Two real Polyfjord repositories are [QT-Pie](https://github.com/polyfjord/QT-Pie),
a GPL-3.0 Blender menu add-on, and the
[Animated Pattern Generator](https://github.com/polyfjord/Animated-Pattern-Generator),
whose README describes pattern and image-sequence/WebM export. Neither is the
claimed procedural-rock node pack. No add-on was installed by this learning plan.

**Acceptance:** a clear gameplay purpose, one controlled comparison, and actual
engine observations. If performance is measured, record hardware, resolution,
scene complexity, measurement method and sample duration. A Blender preview is
not a game-engine frame-rate benchmark.

## Asset libraries and optional tools

| Resource | Suitable use | Access and reuse decision |
|---|---|---|
| [Poly Haven](https://polyhaven.com/license) | A repeatable lighting reference or one texture/model input | Its assets are CC0. Website text, logos, example renders and automated access have separate terms. Record the exact asset and file hash when acquired. |
| [Kenney](https://kenney.nl/support) | A coherent placeholder/UI/scene pack | Public asset-page packs are CC0. The combined convenience bundle is paid; use individual packs for this zero-spend plan. |
| [MACHIN3tools creator listing](https://superhivemarket.com/products/machin3tools/docs) | Optional modeling workflow evaluation | Current distribution is paid and the listing identifies GPL. Stay with native Blender tools unless an actual package is acquired and reviewed. |
| [CG Cookie](https://www.cgcookie.com/bundles/build-game-ready-assets-in-blender) | A structured paid course path | Link to the course. Enrollment and download rights are separate from this project. |

Keep the source URL, creator, license and exact downloaded-file hash next to every
external asset actually used. A license permitting game use does not demonstrate
that an asset fits the target style, camera, memory budget or animation system.

## Corrections to the supplied resource leads

These are retrieval results as of the verification date. A missing result does
not establish that a resource never existed.

| Supplied lead | Verified treatment |
|---|---|
| Grant Abbitt `@GrantAbbitt`; “Blender Low Poly Character for Games” | The retrieved official channel is [`@grabbitt`](https://www.youtube.com/channel/UCZFUrFoqvqlN8seaAeEwjlw). Use the verified PS1 character lesson and official course index. |
| Free “Blender Game Dev Pack” on Grant's Gumroad | [The store](https://grantabbitt.gumroad.com/) contains individual resources; that exact pack was not established. |
| Ducky 3D “Blender to Unity Complete Pipeline 2024”; `github.com/Ducky3D` shaders | Neither that title nor a creator-owned Unity repository was established from primary links. Retain the verified creator site and use engine docs for the import path. |
| `polyfjord/blender-procedural-assets` and the attributed procedural-rock title | The exact repository metadata lookup returned 404. Use verified Polyfjord tools; use Grant's verified rock lesson for the rock exercise. |
| Ryan King “Blender Game Animation Fundamentals”; `ryankingart/blender-game-rig` | The exact repository metadata lookup returned 404. Use the verified beginner animation and IK references. |
| `machin3io/MACHIN3tools`, free current version, “90% of pros”, “10× faster” | The supplied repository metadata lookup returned 404. The creator sells current versions; the adoption and speed figures are unsupported. Do not substitute an unverified mirror. |
| Kenney “50,000+” | [The publisher's current bundle page](https://kenney.itch.io/kenney-game-assets) advertises over 60,000. This is a publisher count, not an independently enumerated inventory; the bundle is paid. |

Exact metadata lookup URLs, access observations and per-claim source links are
retained in the JSON catalog. There is no automatic external downloading, paid
checkout, personal-skill installation or claim that these tutorials have been
completed.

## What the game-art team should hand back

For each executed task, provide the original source file, exported asset, a short
record of references and versions, relevant engine evidence, and one concise
review finding. The reviewer checks the actual revision and asks whether the
asset meets the intended camera and gameplay need. A corrected artifact gets a
new review record. Leave tasks with missing exports, missing rights records or
untested engine behavior visibly incomplete.
