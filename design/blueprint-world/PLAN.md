# Daftar: infinite blueprint world — graphics, interaction and implementation plan

**Planning date:** 21 November 2026; Studio expansion updated 22 November 2026. **Status:** scoped Studio published as owner-private Site version 17, with a graphics verification gap. **Surface mode:** Operate.

The scoped core, Three.js renderer source, architectural relief and native work-element UI now exist. Studio adds explicit local owner/Donna/sub-Donna editing, grants, history and revision checks. The command layer passed 17 independent groups, the final integrated UI passed 14 DOM groups, and the renderer passed 21 non-GPU groups. Native workflows and popup behavior were reviewed on the published HTTPS site, with version 16 and final version 17 observations recorded separately. Actual WebGL remains unavailable in managed Chrome, so GPU acceptance is still open. The architecture and acceptance targets below retain their design intent; section 13 distinguishes the implemented scope from remaining gates.

## 1. The decision

Build one continuous, GPU-rendered conference-table workspace. Company blueprints, room boundaries, people markers, workboards and popup anchors occupy that world. Represent people and roles as **flat, color-coded circles**. Keep office contents as architectural linework with contained floorplan relief. Use the third dimension for the camera, layered company sheets, slim partitions, lighting and clear popup layering.

The user corrections remain authoritative: no human figures, miniature office furniture, plants, glass buildings or decorative props. The later request for a stronger 3D overview adds depth to the floorplans while preserving flat people markers and one continuous canvas. Slim contained partitions use camera-facing cutaway to preserve the plan view. The two physical-office studies remain superseded. The current visual reference is [the flat-circle blueprint concept](assets/03-flat-circle-blueprint.png). Its names and counts are illustrative generated content; implementation must derive every count from actual permitted records.

The experience should feel spatial through continuous movement, precise selection, smooth zoom and a stable mental map. Beauty comes from proportion, typography, restrained color, clean drafting lines and well-behaved motion.

### Fixed product rules

1. One canvas and one scene; selecting an object focuses the camera or opens an attached element.
2. Each company owns a bounded blueprint territory. Its offices, department lines, subdepartments, people and workboards remain inside it.
3. Each sub-company has its own company territory. Parentage is shown by a relationship connector; it does not imply access or physical nesting inside a parent office.
4. Every person is a flat circle. Company representatives at the conference table are also circles, functioning as abstract seats.
5. Top view is the default working view. Tilt and rotation are optional views of the same objects.
6. Layout movement never silently changes ownership, membership, reporting structure, task assignment or worker execution.
7. Forms remain readable, keyboard accessible and usable while the scene moves.

## 2. Conference-table composition

### A continuous table with a shared centerline

Use an endless drafting-table surface with a quiet midnight-blue grid. A thin shared conference spine runs through it. Named company circles occupy positions along the spine; each connects to its company's blueprint territory. Plans can grow along either side of the spine, with reserved neutral gutters for relationships and movement.

The first laptop view frames one company at a useful scale and includes partial neighboring territories. It must not shrink an entire portfolio into the first viewport. A small minimap and search make distant companies reachable without long panning.

The table is the common substrate, not another record container. Company sheets have stable positions. Zooming or changing focus never reorders them. Repositioning a company is an explicit layout action that moves its sheet and contents together, then reroutes its relationship endpoints.

### A company's blueprint territory

| Region | Content and behavior |
| --- | --- |
| Header strip | Company name, parent relationship, relevant record counts and a compact local action menu. |
| Leadership area | Director circle, company Donna circle and reporting links. The user's CEO role is visible in the global control cluster and relevant company context. |
| Office areas | One default office, with additional office sections inside the company territory when needed. |
| Departments | Thin double-line room boundaries, simple door openings and pale functional color washes. |
| Subdepartments | Nested outlines inside their parent department; labels appear at the appropriate zoom. |
| People | Flat circles positioned in the department they are assigned to; no furniture or figures. |
| Workbench strip | Roadmap, ownership, whiteboard and hierarchy surfaces inside the company boundary. |
| Boundary ports | Named points for parent, shared-person and handoff connections crossing the neutral table space. |
| Restricted regions | Opaque charcoal hatching and an access explanation, with hidden records removed before rendering. |

The initial layout should be mostly rectangular because its boundaries are legible and easy to validate. Company expansion must reserve extra world space or propose a layout adjustment. It must not allow departments to spill into neighboring companies.

## 3. Graphics architecture

### One scene with flat markers and architectural relief

Use Three.js with a locally bundled renderer. Three's WebGLRenderer uses WebGL 2 [1]. The implemented renderer source defines a table surface, company groups, company-contained relief, flat blueprint strokes and marker instances, connection paths and world anchors for work elements. A Plan/Relief control changes the architectural presentation; it does not create a second workspace or model.

Store plan geometry in company-local two-dimensional coordinates. Convert those coordinates onto the world's X/Z plane; Y is reserved for a small, controlled depth separation. Illustrative layer order:

| Layer | Representation |
| --- | --- |
| Table | Repeated/procedural grid surface around the camera. |
| Company sheet | A pale drafting plane with layered slab edges below it and bounded lighting/shadow configuration. |
| Blueprint | Vector-like strokes, room fills, door arcs and labels, plus slim partitions contained in each room's footprint. |
| People and work markers | Flat circles, rings, task chips and connection ports. |
| Selected object | Outline and a small visual lift where useful; no ballooning or figure conversion. |
| Active work element | A world anchor with a readable panel facing the viewer. |

Depth values are implementation details and must scale consistently with the chosen world units. Avoid coplanar surfaces that cause flickering. Establish explicit drawing, depth and hit-test policies for selected and active elements.

The relief source uses `MeshStandardMaterial` and directional lighting [10, 11]. Near-side partitions lower with the camera to reduce marker occlusion; flat markers, labels and popup anchors keep their distinct planes. Geometry, containment and occlusion rays can be checked without a graphics context, but the resulting visible appearance and shadows require WebGL acceptance. Relief shares the renderer lifecycle rather than owning another animation loop.

### Crisp blueprints at different zoom levels

Do not bake the entire office into one screenshot texture. Keep room edges, circles and important labels independently renderable. Use reusable flat geometry or shader-based strokes for lines; use smooth circle geometry or antialiased disc shaders for markers. Maintain readable line weights in projected screen space.

Batch repeated circles with instanced rendering. Three's InstancedMesh is intended to reduce draw calls for objects sharing geometry and materials [4]. A marker's instance index maps to a stable domain identity; array order must never become its identity.

Use crisp labels with a controlled size range. Show labels only when they can be read. At distant zoom, display the company name and a few meaningful aggregates; at close zoom, show department and person details. Native text or a tested distance-field text solution can be used without turning the entire scene into HTML cards.

### Native inputs attached to the world

Render the scene in WebGL and keep text fields, menus and buttons as native HTML controls projected from world anchors. Each editor has one stateful form and one anchor. Camera movement updates its projected placement; it does not recreate the form or reset a draft.

This is still one workspace: the form has no separate route, screen or independent company state. Its visible source connector and scope label explain what it belongs to. The active editor receives a deliberate frontmost interaction policy; other surfaces collapse or fade according to focus rather than becoming invisible clickable layers.

## 4. Camera and zoom behavior

### Top is the normal editing mode

Start with a straight overhead, north-up orthographic camera. Orthographic projection avoids distance-based size changes, which is useful for 2D scene and interface work [2]. It keeps company geometry easy to compare and makes alignment predictable.

Support optional orbit/tilt of the same scene. An initial limit of approximately 55 degrees from overhead is a starting design constraint, not a measured optimum. Top returns to overhead around the current focus and preserves the user's work context. A later perspective presentation mode is optional; it should not be required for daily editing.

Three's OrbitControls supports pan, orbit, damping, angle limits and zoom toward the pointer [3]. Use one camera controller as the owner of those behaviors so keyboard, wheel, toolbar and animated focus do not compete.

### Interaction contract

| Input | Planned result |
| --- | --- |
| Drag empty space / trackpad pan | Move through the table on its plane. |
| Wheel or pinch | Zoom toward the pointer or pinch center. |
| Click company circle or name | Select and frame that company. |
| Click department | Focus its existing footprint without rebuilding the office. |
| Click person circle | Select the stable employee/assignment and open its profile. |
| Top | Return to the overhead orientation around the current focus. |
| 3D overview | Frame the selected company's structural envelope from the architectural view; retain the same company and work records. |
| Plan / Relief | Switch the contained architectural depth treatment without changing ownership, permissions or active drafts. |
| Fit / Home | Frame the selected company or return to the conference neighborhood. |
| Orbit mode / modified drag | Rotate and tilt around the current focus. |
| Escape | Close the active transient element or cancel an in-progress drag. |
| Search | Find a permitted company, office, department, person or work surface and focus it. |

Gesture ownership must be explicit. A pointer beginning on a form edits the form; a pointer beginning on a drag handle moves the object; a pointer beginning on empty canvas moves the camera. Text editing and scrolling inside a panel never pan the table.

Manual navigation cancels a camera flight immediately. Reduced motion uses immediate focus changes or a short fade. Automatic conference browsing is an optional control that pauses on input, text focus, lost focus or tab hiding; it is off by default.

### Semantic zoom

| Level | What the user sees | What the user does |
| --- | --- | --- |
| Portfolio | Company outlines, company circles, names and selected relationships. | Choose a company, follow a relationship or search. |
| Company | Offices, department labels, leadership/Donna circles and board summaries. | Focus a department, inspect company work or create structure. |
| Department | Individual circles, short names, subdepartment boundaries and assignments. | Inspect, hire, assign work or arrange local positions. |
| Work detail | A readable employee, task, board or Donna element with nearby spatial context. | Complete an operation without leaving the canvas. |

Use projected object size and threshold hysteresis rather than raw zoom percentages as the source of truth. Around a threshold, small scroll movements must not repeatedly create/destroy labels. Selection, drafts and open panel identities survive every transition. At tiny scales, let users select a group and zoom in instead of exposing unusably small person targets.

## 5. What physics should do

Physics is a presentation service. It supplies weight, continuity and clear constraints while leaving organizational meaning to validated commands.

| Interaction | Motion rule |
| --- | --- |
| Camera movement | Damped deceleration, bounded speed and immediate interruption. |
| Dragged circle or note | A damped spring follows a pointer target on its allowed plane. |
| Placement | Magnetic alignment to a local grid or valid vacant slot, with a visible destination preview. |
| Local overlap | Prevent circles or movable work objects from settling on top of one another. |
| Company/department edge | Constrain the whole footprint, including radius or half-width, inside the allowed boundary. |
| Release | Brief settling; no gravity, repeated bouncing or random drift. |
| Cancel / hidden tab | Restore the pre-drag state or settle safely, clear velocities and end pointer capture. |

Ordinary click selects. Rearrangement uses an explicit handle or Arrange mode, so a small mouse movement cannot accidentally move a person. Dragging within a department changes presentation coordinates. A department/company reassignment is a separate scoped action, with a destination preview and a validated domain command.

### Simulation policy

Use a fixed simulation timestep where integration is required, with an elapsed-time clamp and bounded catch-up steps. Rapier's integration guidance explains the stability tradeoff of timestep size and recommends constant timesteps when following variable frame rates [6]. An analytic critically damped spring is also suitable for individual interface motions.

Only active or settling objects need simulation. Stop their updates after settling. Do not write storage on every frame. Commit valid positions at gesture completion, and preserve an undo record. At reduced motion, snap directly to the valid destination while retaining selection and validation feedback.

### PhysX, Rapier or a small motion layer?

**Adopted implementation direction:** pinned Three.js 0.187.0 plus a small isolated motion/constraint layer; see [OPEN_SOURCE.md](OPEN_SOURCE.md). The flat interface requires springs, circle/rectangle overlap tests and containment, rather than a fully simulated office.

**Escalation path:** use Rapier 2D if measured requirements expand to many interacting markers, complex collision shapes or joints. Its official JavaScript packages include 2D and 3D WebAssembly engines, with asynchronous initialization [5]. Keep the motion interface independent so this can change without replacing the domain model or renderer.

**PhysX is technically possible, but should be a deliberate option.** NVIDIA documents PhysX as a simulation library; production rendering is a separate responsibility [7]. The third-party physx-js-webidl project provides browser JavaScript/WASM bindings, and its documented coverage excludes CUDA [8]. Native PhysX would add another integration path. It should be chosen only if a demonstrated simulation requirement justifies that cost. Adding it alone does not improve blueprint appearance.

Do not claim cross-platform determinism without verifying the exact selected engine build and the input/event pipeline. For collaboration, synchronize validated placements and domain operations rather than every animation frame.

## 6. Circle language, selection and status

Use one consistent circle vocabulary. The department or role family supplies the fill color; a short code/initials and accessible name carry meaning independently of color.

| Role/family | Proposed fill | Additional meaning |
| --- | --- | --- |
| CEO / director | Muted gold | Short CEO/DIR label or initials; profile specifies the exact role. |
| Donna / sub-Donna | Teal | D label and visible company/department scope. |
| Engineering / product | Blue | Initials and room affiliation. |
| Design | Coral | Initials and room affiliation. |
| Research | Violet | Initials and room affiliation. |
| Operations | Sage | Initials and room affiliation. |

Resident, shared and visiting are assignment types, not competing fill colors. Shared placement uses a second ring and a label; visiting placement uses a dashed ring and a Visiting label. Selected state uses a strong outer outline. Keyboard focus gets its own distinguishable treatment. Activity status requires a visible text label or a small state indicator derived from an actual record.

One employee has one identity. A shared or visiting appearance references that identity and an explicit scoped assignment. The interface must not clone the employee into unrelated records merely because the circle appears in two companies.

## 7. Donna and all work elements remain inside the canvas

Donna is a flat circle with an attached conversation. A company sub-Donna sits in its coordination region; a department coordinator appears only where such a record exists. No unconfigured assistant should be presented as running.

The conversation header identifies its scope. Changing company while a draft exists must keep the draft's original scope visible or ask the user to explicitly retarget it; navigation cannot silently change the meaning of a queued instruction.

The first useful Donna actions are scoped summaries, unassigned work, selected-person explanations and prepared task/hiring drafts. In the synthetic frontend these are labelled scripted behaviors. In the connected runtime, a provider adapter supplies actual responses and native authority validates requested actions. Keys belong in the existing server/desktop credential path, never in the HTML or local layout storage.

### Common popup contract

Profile, hiring, company creation, department creation, roadmap, ownership, whiteboard, hierarchy, connections, access and Donna all use the same world-element lifecycle:

- Stable ID, world anchor, owner scope and persistent draft.
- Title, close, focus and optional pin/collapse controls.
- A readable orientation and bounded size; long content scrolls internally.
- A source connector or local highlight identifying the relevant blueprint object.
- Full-surface depth/visibility checks, not only a valid anchor rectangle.
- Controls that remain real hit targets under every exposed camera mode.
- Focus with no document or ancestor scrolling.

Active popups do not multiply into permanent sidebars. Distant elements may collapse to their anchors while preserving state. Search/Find surfaces can bring them back into view. Multiple relevant elements may coexist, such as a person's profile, an ownership board and Donna.

## 8. Workflow and record architecture

### Shared records

| Record | Required relationships |
| --- | --- |
| Company | Stable ID, optional parent company, territory, director/assistant references. |
| Office | Stable ID, owning company and contained office bounds. |
| Department | Stable ID, company/office, optional parent department and local bounds. |
| Employee | Stable identity, home company, role, reporting relationship and configured skills/model policy where available. |
| Assignment | Employee, host company/department, resident/shared/visiting kind, scope and expiry where applicable. |
| Task | Company, optional department, canonical employee owner validated through an eligible company/department assignment, title, roadmap lane and status; runtime evidence references remain a future adapter concern. |
| Board / note | Company, board type, stable IDs and local placement. |
| Connection | Typed endpoints, relationship scope and state. |
| Presentation | Camera, selected IDs, panel anchors, local layout preferences and drafts kept separate from credentials/grants. |

Boards, profiles, circles and Donna read these same records. The implemented core replaces the earlier prototype's global task/note collections and repeated people fixtures with company-scoped records and canonical employee identities. A task created in Company A must not appear in B just because both have a board with the same title.

### First complete working flow

1. Create a company from an available conference position or the Create control.
2. Its territory, director placeholder, Donna placeholder and default office appear in the same world.
3. Add a department inside that office; optionally add a contained subdepartment.
4. Hire a local demo employee into the department; a new circle and identity appear.
5. Open Roadmap, create a company-owned task and assign an eligible employee.
6. See the same task reflected on Ownership and the employee profile.
7. Ask Donna for the company's unassigned work; retain scope and drafts while navigating.
8. Reload and recover the same organization, assignments and valid layout.

Empty, unconfigured, loading, failed and connected states need different copy. Creating a saved employee definition does not imply a process is running. A model configuration does not imply a provider request or model download has occurred.

### Connection layout

Parent relationships use a restrained solid line; shared assignments use a dashed line; handoffs use a directional line. Each connection has a labelled type and explicit endpoints. Route inter-company lines through neutral gutters and boundary ports. Room partitions never become cross-company edges.

Show only the selected company's relevant links at normal scale. Bundle distant connections into a count or summary. Opening a link shows its source, destination, scope and state. Parentage alone grants no access.

## 9. Restricted and collaborative views

The visual greyed-out area follows a restricted data projection. Unavailable names, tasks, counts and accessible labels must not be rendered beneath a translucent mask. Search, keyboard navigation, minimap summaries and cached popups must use the same permitted projection.

The standalone concept may offer a clearly labelled simulated visitor mode using synthetic fixtures. Real access depends on the existing native/server authority. Dragging or adding a connection cannot grant membership.

Keep appearance changes separate from domain changes. View/pan/zoom are personal presentation state. Shared task edits and assignments are versioned domain commands. Concurrent edits need explicit conflict behavior; a late response must not overwrite a newer scope or draft.

### Implemented local Studio policy

Studio exposes a local actor selector and explicit grants for seven capabilities: department rename, color and reorder; company movement; employee placement; policy management; and eligible cross-author undo. Roles and visual positions do not confer rights. The initial CEO actor has an explicit workspace grant. Each canonical director has five floorplan capabilities on its own company, and each canonical Donna has four department/placement capabilities on its own company. A visiting actor starts without a grant. Parent-company and shared-employee relationships never substitute for authorization.

Owner-only Access controls register an existing employee as an actor, add or revoke a scope grant, or atomically create a local sub-Donna. Sub-Donna creation stages the employee record, reporting relationship, actor and explicit department-subtree grant before committing them together. Ordinary company creation, hiring, tasks and notes remain labelled CEO owner tools; choosing another Studio actor does not reassign those workflows.

The command layer checks current authorization and base revisions, retains bounded idempotency receipts and records compensating undo events. Owner CRUD creates a history barrier. Dirty forms retain their drafts on a stale-revision rejection and offer an explicit draft-base refresh; they do not silently retry. A cross-tab storage event fences edits and saves until reload. Canonical core arrays and Studio metadata share one JSON snapshot capped at 2 MiB, with invalid stored metadata preserved rather than silently overwritten.

These are local synthetic editing rules, not server authentication or tamper-resistant account permissions. The fingerprint is a change detector, not a security guarantee. The app does not implement collaborative synchronization or start any employee process by registering a local actor or creating a sub-Donna.

## 10. Infinite-canvas and laptop performance strategy

The user experiences continuous space while rendering remains bounded. Keep logical world coordinates and stable IDs in the data layer. Use a spatial index to select nearby visible territories. Render a small set of detailed company plans and simplified distant representations. Keep active editor state outside the render cache.

Start with three detailed nearby companies as a render budget. A selected distant company enters that set before the camera arrives. Do not allocate physics bodies for every employee in the portfolio. A floating render origin can be introduced for long-distance travel so GPU precision does not degrade; rebasing must preserve logical coordinates and picking.

Batch lines/circles, reuse materials, dispose replaced GPU resources, and render on demand when the scene is settled. Cap device pixel ratio through quality tiers, and prefer a faint grid/contact shadow over expensive continuous post-processing.

### Proposed acceptance targets, not current measurements

| Target | Planned gate |
| --- | --- |
| Laptop layouts | Verify 1366 × 768, 1440 × 900 and 1920 × 1080; no primary control clipped. |
| Smoothness | Aim for 60 fps on a named representative laptop; measure frame timing, interaction latency and memory before claiming it. |
| Portfolio stress | Current model caps are 100 companies, 1,000 employee definitions and 2,000 explicit assignments. Actual GPU portfolio stress remains unverified; larger capacities require a separate model and performance decision. |
| Active motion | Begin with at most 64 active/settling layout objects; other markers remain static. |
| Detail stability | Cross each zoom threshold 20 times in both directions with no draft loss, duplicates or resource growth. |
| Idle behavior | No continuous scene rendering after camera/motion settles, apart from an explicitly enabled live effect. |
| WebGL recovery | Clear unavailable/lost-context handling; preserve data and offer recovery. A simpler view must be labelled as such. |

A local browser/desktop GPU renders the interface. A VPS or GPU host is not a prerequisite for this canvas. Remote runtime and model work can remain behind the existing API adapter. The website and desktop shell should reuse the same renderer, scene model and motion behavior.

## 11. Implementation packages and remaining gates

The implementation used bounded model, renderer and UI responsibilities with the image and this plan as the fixed brief. The package table retains its target gates; it is not a claim that every planned subfeature has passed. The scoped frontend covers portions of A–D, while actual graphics acceptance in E remains open and the runtime adapter in F remains unconnected.

| Package | Deliverable | Completion gate |
| --- | --- | --- |
| A — Scoped model | Company/office/department/employee/assignment/task/board records, validators, local fixtures and persistence migration. | Isolation, hierarchy, unique IDs, bad storage and capacity checks. |
| B — World renderer | Table, company planes, blueprint lines, circle instances, labels, boundary ports and culling. | Correct top view, company containment, stable scene identities and local asset loading. |
| C — Camera and motion | Pan/zoom/orbit, focus transitions, picking, spring placement, collision and undo. | Projection/ray agreement, whole-object bounds, cancellation and frame-step stability. |
| D — World work elements | Profiles, creation, local hiring, roadmap, ownership, notes, hierarchy, scripted Donna and Studio editing/access/history. | End-to-end scoped workflow, current grants, revision barriers, persistent drafts and native keyboard controls. |
| E — Review and publication | Independent numeric checks, actual laptop browser review, one grouped correction pass and exact artifact receipts. | Publish only the tested source and retained evidence. |
| F — Runtime adapter | Connect the validated presentation to existing native/cloud projections and commands. | Real authority, provider results and permission behavior verified separately from the demo. |

Suggested code boundaries: domain/model, graphics/scene, graphics/blueprints, graphics/markers, camera/controller, interaction/picking, interaction/motion, ui/world-elements and adapters/runtime. Keep the earlier standalone prototype and 0.8.0 release intact as historical checkpoints.

## 12. Stress and edge-case acceptance

| Risk | Required evidence |
| --- | --- |
| Wrong picking or occluded editor | Actual browser clicks on the intended stable ID at top, maximum tilt, zoom extremes and pixel ratios 1/2. Donna Send works; whole popup remains visible; ancestor scroll stays zero. |
| Cross-company record leakage | Two companies with identical display names for tasks/people remain isolated through edit, assign, completion and reload. Shared identity is explicit. |
| Escaped geometry | Test full circle/rectangle footprints and line endpoints at every edge/corner, including fast drags, collisions and cancellation. |
| Unstable motion | Compare 30/60/120 Hz presentation and a 250 ms interruption; no nonfinite state, explosive velocity or changed ownership. |
| Lost work on zoom | Preserve selection, scope, unsent text and open surfaces across repeated detail changes and long-distance navigation. |
| Ambiguous circles | Role/status remains understandable without color alone; nearby actions have usable hit areas and keyboard equivalents. |
| Invalid state | Duplicate/cyclic parents, stale references, same-clock IDs, capacity overflow, malformed storage and quota failures retain a usable canvas. |
| Restricted projection | Pointer, keyboard, search, minimap and popup reopening reveal only permitted fixture/runtime records. |
| Resource leaks | Object, listener and GPU-resource counts return to baseline after repeated company and popup cycles. |

Numerical tests can establish matrices, rays, containment and motion properties. They cannot certify GPU compositing, text readability, browser hit testing or visual quality. The earlier tilted-chat defect demonstrated this distinction. Keep independent actual-browser evidence as a separate gate.

## 13. Current checkpoint and next implementation boundary

The initial planning checkpoint has progressed to an implemented standalone local frontend and a further Studio expansion. The entry point is [blueprint-world.html](../../cloud-workspace/public/concepts/blueprint-world.html), with separate core, renderer, relief, Studio command/UI and application modules plus a locally bundled graphics dependency. The corrected image remains a concept, not a captured application result.

| Area | Implemented or recorded now | Remaining boundary |
| --- | --- | --- |
| Scoped records | Company/sub-company creation, one default office per company, root and nested departments, local employees and explicit assignments, tasks, notes and validated persistence. | Additional-office creation, authenticated membership, runtime model policy and collaborative synchronization remain unconnected. |
| World work elements | Scoped create, hire, task ownership/lane/status, notes, profiles, boards, search and scripted Donna, with an attached Studio popup. Published-site observations verify scoped local editing, revocation, persistence, focus and popup movement. | Local definitions do not start employees or execute model calls. Browser coverage is limited to the recorded workflows and viewport, through the graphics-unavailable path. |
| Local editing policy | Explicit actors and scoped grants, local sub-Donna creation, department/company/placement commands, grant revocation, stale checks, idempotency, undo and owner barriers. | This synthetic policy is not server authentication, production account authority or tamper-resistant ownership. |
| Graphics and motion source | Three.js 0.187.0 with OrbitControls, contained slabs/partitions and cutaway, flat circles, optional 3D overview, world anchors and bounded motion. | Actual GPU appearance, shaders, rendered-scene picking, laptop frame timing and GPU resource behavior remain unverified. No PhysX, Rapier or Troika dependency was added. |
| Independent validation | Unchanged core: 12 passing groups. Studio command layer: 17 passing groups. Current integrated Studio DOM: 14 passing groups; renderer explicitly unavailable. | Source hashes and limits are in the [validation record](validation/README.md), [final Studio DOM receipt](validation/studio-ui-final.json) and [index](validation/validation-index.json). They establish neither native browser layout nor WebGL rendering. |
| Renderer review | [21 non-GPU groups passed](validation/studio-renderer-evidence.json), including 100-company/1,000-employee capacity fixtures, dense-department framing and 4,100 occlusion rays. The original checkpoint retains its 11 historical groups. | CPU geometry/resource checks are not GPU frame-rate, shader, rendered-scene picking or visual acceptance. |
| Browser review | The [Studio browser receipt](validation/studio-browser-receipt.json) separates version 16 workflow observations from final version 17 persistence, undo/revocation, actor-label, keyboard and popup-drag observations. Final viewport: 1363 × 936; no HTML-page scroll. | The local-preview reload was denied by browser URL policy and not retried or bypassed. The published HTTPS destination was accepted for live review. All recorded native observations use the graphics-unavailable path. |
| Publication | Owner-private Site version **17**, source `e0a17a669dd359a4346d9ca7c61e11394fa3760b`, succeeded at `2026-11-22T00:14:45.290141+00:00`. [Open the published canvas](https://atlas-command-office.whatswrong-inc.chatgpt.site/concepts/blueprint-world); [publication receipt](publication.json). | Audience remains one owner, with no editors, groups, external visitors or MCP connection. Site publication is separate from the GitHub design-branch commit and does not establish runtime integration. |

External Claude Sonnet 5.5 partially authored the core and supplied the initial UI plus its bounded completion; local review completed the core and repaired the UI. The original renderer was authored locally after automatic approval review blocked polling its request. That process's outcome is unknown, no response was observed, and its reservation remains in [the usage ledger](../../project/CLAUDE_USAGE.md). The later Studio expansion used four distinct Claude requests for relief, the edit-layer prefix and bounded suffix, and the attached UI. Two responses reached their output limits. Local completion, independent repairs and application integration produced the tested source. The additional work used $0.446882 against its separately recorded $20 ceiling. There was no automatic retry of uncertainty or change to platform automatic-approval settings.

Native review found and resolved two presentation defects before version 17: reorder permission probing now tests a real adjacent move instead of a no-op, and sub-Donna creation no longer displays a redundant CEO actor toast. The attached popup was compacted to a 420 px width and 680 px height limit. The final DOM receipt was rerun against the post-review source, and final browser observations confirmed persisted delegate/revocation state followed by an owner undo. Grant preservation across undo is established by pure/DOM tests; the revoked actor was not reselected after the final native undo. The initial [BUILD-RUN.json](BUILD-RUN.json) remains the historical publication-pending record at `287dfdf70bcece1960c7bda364e911c82dea37e2`; [STUDIO-RUN.json](STUDIO-RUN.json) and the publication receipt record the later completed expansion.

The next acceptance boundary is a real WebGL2-capable browser running this exact frontend, with visible geometry, text, shaders, object picking, camera modes and popup hit targets checked together. Numerical geometry and native-form checks remain useful evidence within their stated scope. The earlier CSS 3D prototype, its historical owner-private Site publication and the 0.8.0 release retain their own source and receipts; this new frontend is outside that released binary source.

## Primary technical sources

Reviewed 21 November 2026. These sources support the library capabilities; the layout, budgets, workflow and build sequence above are proposed Daftar design decisions.

1. [Three.js WebGLRenderer](https://threejs.org/docs/pages/WebGLRenderer.html) — WebGL 2 renderer and rendering facilities.
2. [Three.js OrthographicCamera](https://threejs.org/docs/pages/OrthographicCamera.html) — projection behavior.
3. [Three.js OrbitControls](https://threejs.org/docs/pages/OrbitControls.html) — pan, orbit, zoom and damping controls.
4. [Three.js InstancedMesh](https://threejs.org/docs/pages/InstancedMesh.html) — repeated geometry batching and resource lifecycle.
5. [Rapier JavaScript getting started](https://rapier.rs/docs/user_guides/javascript/getting_started_js/) — official 2D/3D WASM packages and loading.
6. [Rapier integration parameters](https://rapier.rs/docs/user_guides/javascript/integration_parameters/) — timestep and simulation parameters.
7. [NVIDIA PhysX introduction](https://nvidia-omniverse.github.io/PhysX/physx/latest/index.html) — simulation responsibilities and separation from rendering.
8. [physx-js-webidl maintainer README](https://github.com/fabmax/physx-js-webidl/blob/main/README.md) — third-party PhysX browser bindings and excluded CUDA coverage.
9. [Cannon ES documentation](https://pmndrs.github.io/cannon-es/docs/) — an alternative JavaScript physics implementation considered during research.
10. [Three.js MeshStandardMaterial](https://threejs.org/docs/pages/MeshStandardMaterial.html) — metallic/roughness material properties and lighting behavior used by the relief source.
11. [Three.js lighting manual](https://threejs.org/manual/pages/lights.html) — directional-light targeting and light types.
