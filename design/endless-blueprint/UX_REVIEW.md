# Endless Blueprint — evidence and UX review

**Run:** `laptop-blueprint-20261122` · **Node:** `ux` · **Attempt:** `1`  
**Reviewer role:** UX author/reviewer; not independent acceptance authority for its own CSS  
**Termination owner:** root director · **Record date:** 2026-11-22  
**Current status:** See [VALIDATION.md](VALIDATION.md) for the latest exact-source result. The original planning checkpoints below are preserved as history; later sections record the implementation and browser corrections.

## Scope and evidence boundary

This review uses actual repository screenshots, the current native canvas/handler sources and the primary references in [PLAN.md](PLAN.md). It distinguishes a reviewed baseline from the unaccepted new blueprint build. No new browser launch, provider request, cloud instance action or external publication was performed by this node for this document task.

The current owner direction is one endless blueprint plane with contained company areas, shallow optional 3D partitions, flat employee circles and movable work surfaces. The physical table, chairs, folded sheets and decorative slabs in earlier concepts are superseded. Their screenshots remain provenance, not the new desired result.

### Baseline artifacts inspected

| Artifact | What was actually reviewed | SHA-256 |
| --- | --- | --- |
| [01-native-office.png](../../project/validation/vscode-0.9/01-native-office.png) | Real shared renderer at 1440×900, native acceptance workspace, old conference-table presentation | `6be4c1f7a8e7403c4208a76d2e81ba217cc171eaa5e161557a176b7e1317a271` |
| [02-live-surfaces.png](../../project/validation/vscode-0.9/02-live-surfaces.png) | Existing movable Donna form and its preserved unsent draft | `1b6749c7017d235399540811193a7ac28f867477a7a679c113bd58e6459caba5` |
| [03-flat-circle-blueprint.png](../blueprint-world/assets/03-flat-circle-blueprint.png) | Concept/reference image: contained departments, flat circles, attached work/hierarchy areas | `6543e526a9fc5b6c99bd253d075e3abef8ba2b72e7660e56b8ac9ee148e2b5d5` |

The first two images originate from the earlier accepted product run at source `7766c91c6d6c3481b419623f1149a291d2da439d`. The [retained validation report](../../project/VSCODE_PRODUCT_VALIDATION.md) describes the separate installed VS Code and browser-harness evidence. The reference image is not an executed application or proof of collaborative editing. Repository HEAD during this documentation audit was `d62fc4028e5cf5add0b6bbe60764925babc62fc0`, with new integration changes in the working tree; that HEAD alone does not identify the uncommitted redesign.

## Round 1 — findings and decisions

| ID | Observed finding | Decision / proposed correction | Acceptance owner and status |
| --- | --- | --- | --- |
| UX-01 | Baseline overview gives large company seat cards and tiny, mostly outline-only plan previews much of the useful space. | Make the actual company-contained floorplan the primary content. Latest direction removes the table and relocates company identity inside the plan header. | Root/native layout; integration pending. |
| UX-02 | The displayed Donna surface is about 850×500 screen pixels at the captured zoom, obscuring most of the underlying workspace. | Smaller default geometry, compact scope/composer controls, expandable via existing controller. Keep drafts and explicit execution mode. | Root geometry + CSS; screenshot acceptance pending. |
| UX-03 | Multiple floating navigation/control strips compete around the perimeter. | Keep stable Find/Home, compact camera controls and one operations entry; preserve recovery routes at both laptop sizes. | UX visual review after exact-source build. |
| UX-04 | The reference image makes company boundaries, room membership and flat people easier to read than the baseline miniature plans. | Use the reference's containment and information hierarchy. Do not copy its generated text, fictional counts or inferred permissions into state. | Native projection + scene reviewer; pending. |
| UX-05 | Native scene rectangles are scaled to fit a footprint, but DOM fonts/avatars do not automatically inherit that layout scale. | Cap circle size to its actual rectangle, keep labels within bounds, use useful detail levels and inspect focused rooms at a readable scale. | Geometry + DOM integration; partial CSS correction, live density review pending. |
| UX-06 | Existing `ffActionConfirmed('ownership', context)` routes an employee to authority, but a company-only context falls through to a whiteboard editor. | New company Ownership action must open People & ownership or a correctly scoped company authority surface. Preserve board-specific behavior. | Reported to root; fix/acceptance pending. |
| UX-07 | Existing reduced-motion CSS included a broad `transform:none` rule. | Suppress animation without discarding the transforms that position the world. | Corrected in CSS component pass; integrated reduced-motion review pending. |
| UX-08 | Existing panel keyboard movement does not by itself establish the W3C single-pointer alternative to dragging. | Verify a non-drag pointer route for movement/resizing/camera; add a bounded position/nudge control if necessary. | Accessibility acceptance pending; no WCAG conformance claim. |
| UX-09 | Small circles and transformed buttons can be visually smaller than their untransformed CSS values. | Measure actual pointer targets and spacing or provide an equivalent list/control. A 24px-diameter circle alone does not contain a 24×24 square. | Actual-browser target review pending. |
| UX-10 | Standalone Blueprint World includes its own local model and editing demonstration, while the product canvas uses the native core. | Integrate geometry through the canonical scene; preserve native command validation. Do not swap in a separate mock app. | Root integration gate; pending. |
| UX-11 | Company hierarchy, shared contracts, grants and visiting employees have different semantics. | Distinguish organizational, service and authority edges; show unavailable/visiting/shared labels without exposing restricted records. | Native permission tests + selected UI cases; pending. |
| UX-12 | Roadmap and activity exist; historical reconstruction of the whole scene has not been demonstrated. | Describe time-based work overlays precisely. Mark any future temporal replay as future work. | Documentation boundary established; no new time-replay feature claimed. |

The default camera source already defines zero pitch and yaw; the old tilted screenshot is not proof of a default-camera defect. Acceptance must inspect startup with clean saved preferences as well as restored camera state. [Camera implementation](../../desktop-shell/src/renderer/freeflow/camera.ts)

## Historical checkpoint — Round 2 implementation evidence register

Round 2 is **in progress**, not accepted. Root owns the real Claude Sonnet authoring receipt, provider costs, native projection, GPU integration, build and packaged source. This UX node did not call Claude or bill a provider. Exact source-bound evidence is required before this section changes to accepted.

### Earlier CSS component pass

The preceding authorized styling task changed `freeflow.css`, `studio-tokens.css` and `chrome.css`. It introduced midnight/ivory/navy tokens, flat people/company markers, compact live panels, no physical table in endless mode, header/footer styling, GPU-only transparent solids and visible CSS/forced-color fallback. Those files are now owned by root for integration.

Observed component checks from that phase:

- `vitest run tests/freeflow-studio.test.ts tests/freeflow-canvas-workspace.test.ts`: **35 tests passed across 2 files**.
- All three stylesheets parsed through PostCSS, and `git diff --check` passed for those files.
- Six proposed circle colors with white initials had calculated contrast ratios of **4.97:1–5.72:1**. Blueprint primary/secondary text pairs were **11.83:1 / 5.36:1**. These are flat token-pair calculations, not measured rendered contrast across GPU, selected, disabled, hover or image-backed states.

These checks are useful partial evidence, not a new installed-product, GPU or accessibility pass. Root may change the files after this handoff, and the working tree was not frozen as a complete candidate during the component tests.

| Required integration evidence | Current status | Expected record |
| --- | --- | --- |
| Canonical company/department/employee projection and containment | Pending director artifact | Source hash, geometry tests and stable ID assertions |
| Actual Claude Sonnet contribution | Pending director artifact | Model/API receipt, attempt, file provenance and observed cost; no inferred spending |
| GPU camera alignment / picking / context-loss fallback | Pending | Browser/device and actual rendered interaction evidence |
| Company footer actions / ownership scope | Pending | DOM/native handler regression showing the intended company |
| Source-to-renderer-to-VSIX integrity | Pending | Build manifest hashes, platform receipts and artifact digests |
| Preserved forms, drafts, shutdown and reconnect behavior | Partial baseline only | Relevant current-source regressions, not just earlier release receipts |

## Historical checkpoint — Round 3 acceptance requirements

**Status: waiting for root to deliver exact-source screenshots and results.** No new screenshot has been accepted by this document. The existing release images must not be relabelled as the redesign.

For each artifact the director supplies, record candidate commit/tree hash, asset/manifest hashes, run/job identity, tool/browser version, viewport, camera, fixture identity, actual GPU or fallback mode, evidence category and reviewer. A screenshot alone cannot establish native persistence, access control or runtime activity. A unit test alone cannot establish rendered legibility or GPU correctness.

The reviewer should complete the acceptance matrix in [PLAN.md](PLAN.md), with special attention to:

1. No physical table, external company seats, figures or floating paper slabs; one continuous grid and company-contained floors.
2. No labels hidden by shallow partitions, no employee bodies escaping boundaries and no wrong-hit target after tilt/rotation.
3. At 1366×768, Donna, camera controls, setup/connection controls and work actions remain usable without HTML-page scrolling.
4. Actual company-only Ownership action opens the correct scope; no stale company selection or draft loss after moving/reopening a popup.
5. Empty, crowded, long-name and deep-hierarchy fixtures preserve truthful counts, bounded rendering and search recovery.
6. Reduced motion, forced colors, missing WebGL, context loss, unavailable storage and restored malformed layout remain recoverable.
7. Revocation, expired visitor access, reconnect epochs and cancelled work do not gain authority from UI appearance.
8. No new provider requests, rentals, downloads or software installations result from visual inspection or opening controls.

The closed loop is: observe an exact-source failure → record evidence and scope → director assigns a bounded repair → rerun the affected gate → independently review the corrected artifact → director accepts or records the remaining limitation. A correction inside Round 3 is not a claim that a fourth round or indefinite autonomous loop has been authorized. Component authors cannot certify their own change as independent review.

## Skill, contract and cost provenance

| Input | SHA-256 / identity |
| --- | --- |
| [Spatial 3D Production Engineering skill](../../skills/spatial-3d-production-engineering/SKILL.md) | `e5c98705a8c04c23e02b9d1006b34c5a1e9e6b549f731c3dcdb1909f2368dc8b` |
| [Terminology and tools](../../skills/spatial-3d-production-engineering/references/terminology_and_tools.md) | `2c46a8cdfb056e0fd4d5695a4fd89d11e7fd26f1cf5176659c6061aa69daad58` |
| [Skill collaboration protocol](../../organization/skill_collaboration_protocol.md) | `3df1b739f428bdd9796700e4d7f470271094cc9ec75a8ba471e0b7b82039dade` |
| Normalized director delegation transcription | `4be66d7e788307c813bb442e967cf16ed4d5b28bbe37f96e51ba4c8c96faa94e` |
| Artifact idempotency identity | `laptop-blueprint-20261122:ux:1` |
| Director event reference | Parent task messages assigning this run, node, owned documents and bounds; no runtime ledger receipt fabricated |

This node's limit is 20,000 tokens, 30 tool calls and 35 minutes, bounded by remaining parent budget. No paid calls or external writes were made in this planning task. Session-level model billing and root's separate Claude/image costs are not independently observed by this node and must come from the director's actual receipts. Physical production, device motion, firmware, cloud rentals and live Vast execution are outside this task.

Source/license provenance is a reference list, not a redistribution license. The authored docs paraphrase the reviewed primary pages; complete books, fonts, assets or third-party libraries were not copied into these artifacts. New renderer/vendor licensing and generated-image provenance remain separate Round 2 records owned by root.

## Handoff and next event

Deliver `PLAN.md` and this review with content hashes using the typed report fields `{run,node,attempt,files,hashes,findings,checks,limits}`. The director decides acceptance. The UX node then waits for exact-source screenshots or an explicit correction assignment; it does not poll or promote a release. Updates to Round 2/3 status require new director-supplied evidence and must retain the earlier pending record and its provenance.

---

## 2026-11-22 checkpoint — Round 1 accepted; Round 2 source integrated

**Checkpoint identity:** `laptop-blueprint-20261122:ux:round3-evidence-1`, following planning attempt 1 and correction attempt 2. This is an append-only update; the pending records above describe their earlier evidence state and remain intact.

The root director accepted Round 1 and integrated the Round 2 source at **`3fe5dd99df7f65a40162905b66e466f0186b62a8`**. The current candidate at this checkpoint is **`26ab5e6ef91e73b031890415d9d45a2b094b53c9`**. A local revision comparison verified that the only change between them is in `vscode-extension/scripts/smoke-canvas.mjs`: the camera assertion now interprets omitted identity rotation transforms as zero. This is a harness correction, not a product camera or scene change.

| Round / gate | Established status at this checkpoint | Remaining condition |
| --- | --- | --- |
| Round 1 — evidence and workflow design | **Accepted by the root director.** | Preserve the accepted no-table direction and explicit workflow/authority boundaries. |
| Round 2 — source integration and local checks | **Integrated; recorded local checks passed.** Independent source-review defects were repaired and confirmed according to the director handoff. | Current-candidate browser/GPU, visual and installed-product gates are not established by local checks. |
| Round 3 — independent visual and stress acceptance | **In progress; visual acceptance pending.** | Review exact-source screenshots and CI receipts, record one grouped findings/correction pass, and obtain independent final director acceptance. |

### Local validation evidence inspected

This node opened the director's retained logs and verified their result summaries. It did not rerun the suites or reinterpret synthetic renderer tests as GPU execution.

| Evidence | Observed result | SHA-256 |
| --- | --- | --- |
| `/workspace/scratch/3cd2e045f9b8/round3-freeflow-tests.log` | **162/162 tests passed across 13 files**; recorded start 22:08:42. | `760bca87be855ae61e7915d5603e25b20e4ec0e32ab01b3fe4d33622979b305a` |
| `/workspace/scratch/3cd2e045f9b8/round3-build-tests.log` | Renderer assets copied; extension build produced a 22-file shared-renderer graph and a Linux/x64 runtime with 133 verified files; extension check completed; **129/129 extension tests passed**, with zero failures/skips. | `cb1b6f8853f60d6e620c0e860638d776e013ce2253aba9a0905130220437073d` |

The director reports the renderer build succeeded before asset copy. TypeScript's successful invocation is silent in this retained build log; the visible record begins with completed asset copying. These local logs are workspace evidence, not a claim that the new VSIX has passed installed-platform or GPU acceptance. The tests include pure computation and simulated renderer/lifecycle checks; their category remains distinct from actual-browser evidence.

### Source review repairs and exact file identity

The independent core review, as reported and accepted by the root director, identified and resolved three concrete defects:

1. **Unbounded grid generation:** grid work needed a finite budget at extreme camera conditions.
2. **Far-company rendering budget and fallback:** the current distant company needed consistent GPU/DOM selection, with per-surface ownership so undrawn geometry did not lose its CSS fallback.
3. **Terminal GPU cleanup:** terminal failure needed to release owned geometry, materials, renderer state and callbacks instead of retaining failed resources.

This node located the budget, per-surface fallback and terminal-cleanup tests in the source and read the aggregate passing local result. The grid-specific review and independent confirmation of all three repairs are supplied by the director's received review artifact; this documentation append is not a second independent code audit.

The following current files were hashed and compared byte-for-byte with their contents at integrated source `3fe5dd99df7f65a40162905b66e466f0186b62a8`; all matched:

| Source file | SHA-256 |
| --- | --- |
| `desktop-shell/src/renderer/freeflow/relief-math.ts` | `1937125518d1c35d0f2d78f9749402026e8a2e1e5e073c4dc7b5e238b411c050` |
| `desktop-shell/src/renderer/freeflow/relief3d.ts` | `e654e21b163a3b257aff09188a9326118385bde4f3af6163e425300dd7707fd8` |
| `desktop-shell/src/renderer/freeflow/scene.ts` | `efe2589225741fa39f85f5b41ceadbc34038bd97a3987950a116fb7e68a83d5e` |
| `desktop-shell/src/renderer/freeflow/universe.ts` | `f557e8f2c1a5e18e218d629b171491f514f958778c7c2d5c743b54aa92cb2db6` |
| `desktop-shell/src/renderer/freeflow/canvas-workspace.ts` | `5185bdd1d1f2443e4d56f99bffca04ce5ababe88e5da48788a2327ae41551b59` |

### UX-08 correction evidence

The attempt-2 component correction now supplies an **Arrange** popup on each live panel with four movement and four size controls. Actions use bounded 20-world-unit steps through `updatePanelRect`. Pinned, collapsed, closed and destroyed panels reject those actions. Escape closes the local arrangement controls and restores focus without closing the work panel. Exact forms and drafts are preserved.

The focused correction suite passed **28/28** tests, including actual button clicks, size bounds, lifecycle guards, focus return, draft retention and no authority calls. Renderer typecheck, CSS parsing and whitespace checks also passed during that correction. This closes the **implementation gap for panel movement/resizing**. Rendered pointer-target measurement and any remaining camera gesture alternatives still require Round 3 review. It does not establish full WCAG conformance.

### Claude authorship and recorded cost

The [usage ledger](../../project/claude-usage.json) records request **29**, model **`claude-sonnet-5-5`**, request ID **`d477db0c-77e3-46ae-b9d0-3bb690926d43`**, completed with `end_turn`, **3,138 input tokens** and **11,873 output tokens**. Its recorded `costUsd` is **0.125006**, with no retained reservation for that request.

The ledger describes complete relief/projection modules returned by Claude, followed by independent local repairs and integration, including removal of the superseded table, camera bounds, recursive error handling, shader failure behavior, cleanup and floating origin. The accepted source is therefore a combined contribution; a completed API response alone did not certify it. The workstream ledger records a USD 20 incremental authorized cap and USD 19.874994 remaining, while explicitly excluding native image generation from Claude API totals because no image billing receipt is available here. These are ledger records, not an independently reconciled provider invoice. This UX checkpoint made no paid call or external write.

### CI and visual gate remain open

The director supplied [product CI run 44979493493](https://github.com/occult-kranti/engineering-intelligence-atlas/actions/runs/44979493493) for candidate `26ab5e6ef91e73b031890415d9d45a2b094b53c9`; it was **still running when this checkpoint was assigned**. This node did not poll the run. Later CI conclusions require another evidence entry.

No current-candidate screenshot or actual GPU receipt has been accepted in this checkpoint. The next event is delivery of exact-source laptop screenshots and browser/installed receipts for one grouped visual review, followed by independent root acceptance. Current roadmap/activity functionality remains separate from future temporal scene reconstruction; this record makes no full “4D” implementation claim.

---

## 2026-11-22 checkpoint — grouped visual correction from source 26ab5e6

**Checkpoint identity:** `laptop-blueprint-20261122:ux:round3-visual-correction-1`. This records the one grouped correction assigned by the root director. It does not replace the earlier pending evidence or certify the corrected build. The reviewed candidate is `26ab5e6ef91e73b031890415d9d45a2b094b53c9`, from product CI run 44979493493. The four images were inspected as one review set, with individual image reads to stay within the tool output limit.

### Exact visual inputs

The retained inputs are under `/workspace/scratch/3cd2e045f9b8/release-candidates/laptop-blueprint-20261122/ci-26ab5e6/linux/artifact/.work/canvas-smoke/`.

| Input | SHA-256 | Direct observation |
| --- | --- | --- |
| `01-native-office.png` | `d38100cc8b07018a3d07494137fab65ff415d3e4102034b9599dd1d7328570bc` | At 1440×900, the company contains its actual floorplan and flat employee circles on one continuous grid, with no physical table. Intended ivory floors render grey. Repeated department/room titles, saved/active labels, counts, whiteboard text and tiny employee name strips compete. |
| `04-perspective-1440x900.png` | `178dc973b16eb1db41648995ac19caf9770c171970ccd992295264e450c55dec` | Donna is a tilted live popup, with its draft and ordinary controls visible, but the company world is outside the view. This does not establish usable company context. |
| `09-company-ownership-1440x900.png` | `2f52df8b2eb7828ee61c41b77ea1023027d4a4e677c73cf7344c35f5d342215e` | Ownership content is largely above the viewport despite an 81% camera scale. Its internal grid is visually strong and unknown-state bands use dark fills inside an otherwise light panel. |
| `failure.png` | `3f71d745c7f89c162fd6da89c1ca134a88dd0f95026fd2bb2420fd0aa22d12b7` | At 1366×768, Donna's header lies beneath the top navigation while the draft remains visible. This is an unresolved frame/recovery problem in the reviewed source. |

The associated `receipt.json` reports **`status: failed`**, with error **“1366×768 top view: real geometry was submitted to a successful frame”**. Screenshots prove the observed intermediate states; they are not a passing browser or release receipt. The root director assigned popup placement, resize recovery and framing to the core node. This UX node did not compensate for those issues by changing world positions or camera geometry.

### Corrections made in the assigned presentation files

| Finding / relation to earlier review | Implemented correction | Boundary preserved |
| --- | --- | --- |
| Grey floors weaken the blueprint hierarchy (UX-01/UX-05). | Kept the intended warm ivory company floor and navy linework; introduced the light `--plan-floor` value `#EEF3F4` for CSS fallback and annotations. Requested matching unlit GPU floor colors from root. | This node did not edit GPU geometry or materials. Root separately reports exact base-color floors with shaded shallow walls. Actual corrected rendering awaits confirmation. |
| Room information repeats at the same visual level (UX-05). | A room keeps its saved title. Matching department assignment text is visually suppressed; a distinct assignment remains one secondary line. Generic Room/Office sheet, saved/active and count badges are hidden in compact floorplans; the Open cue appears on focus, hover or selection. | Original accessible names, real labels, IDs, status/count data, inspection and actions remain. Assignment text is still present in the DOM and the accessible description. |
| Dense desk names and board labels collide (UX-05/UX-09). | Name type is at least 11 world units. Small saved desk bounds show a flat circle/monogram; exact names reveal on focus, hover or selection instead of overlapping microtext. Circles now remain present at simple detail level. Whiteboards use a compact board marker within the unchanged native rectangle, revealing their saved title on focus/hover. | Native rectangles, identities, employee ownership, board handlers and full accessible names are unchanged. This is progressive disclosure, not a claim that all small markers meet rendered target-size criteria. |
| Leadership looks like a dark status card. | Company-level leadership/unplaced staff use a pale, dashed blueprint annotation with one heading. | Actual employee assignments remain unchanged; no imaginary department was added. |
| Ownership panel grid/status paint competes with content. | Light work panels receive their own subtle grid and light heat/unknown fill tokens, including navy-compatible text. | Heat semantics and actual values remain; theme preference keys and the drafting theme are retained. |
| Hidden viewport scrolling can displace DOM from GPU projection (related to UX-02/UX-07). | Endless static viewport ancestors now use `overflow: clip`, including the document viewport, shell, main, scene and canvas host. | Actual `.canvas-panel-body` and form scrolling remain `overflow: auto`; no world position or camera change is introduced by this correction. This targets hidden browser scroll offsets; corrected browser evidence is still required. |

The root's coordinated GPU correction reports company `#F8F3E7`, neutral floor `#EEF3F4`, navy wall `#526B86`, and six light room tints; drafting uses company `#FFFDFA` and wall `#56728A`. Floors use unlit base-color material, while shallow walls remain shaded. This palette coordination is director-provided implementation evidence, not an independent visual pass of the resulting GPU frame.

Two additional observations from this same review set were included before handoff. The lower-left Find company/Inspector header covered the first company's Donna/Roadmap buttons in image 01. On laptop widths, the existing scope header now occupies the gap between the existing bottom launcher and camera controls, with a compact title and retained breadcrumbs; the launcher can scroll horizontally when space is limited. No additional dock was introduced. The compact whiteboard marker uses a 36×36-world-unit painted/pointer area, while the unchanged larger native parent is pointer-transparent so it cannot intercept unrelated room/employee clicks. Its parent keyboard role and original delegated action remain.

### Focused checks and handoff status

The current presentation source passed **32/32 existing tests** across `freeflow-studio`, `freeflow-tabletop`, `freeflow-blueprint-world` and `freeflow-member`, including native label updates, inert snapshot text, keyed identities and native actions. The renderer TypeScript check passed. All three stylesheets parsed in JSDOM; computed-style checks confirmed static viewport clipping while the live panel body retained scrolling and an exact textarea draft. `git diff --check` passed. These checks are source/DOM evidence, not a browser screenshot or GPU execution substitute.

The correction is handed to root for the single confirmation CI and independent visual acceptance. **Round 3 remains open.** The root/core framing work and the final rendered label density, focus behavior, theme appearance, target sizes and 1366×768 recovery require the corrected exact-source receipt. No new browser session, model request, cloud rental, API connection or paid call was performed by this UX node. No WCAG conformance, live Vast execution or complete temporal scene replay is claimed.


## Functional follow-up — finder clipping (007084f → 961a4b8)

Root and the UX node independently inspected the exact-source failure image from run `44980854371`. The finder palette was missing from the painted area above its visible launcher, although its result existed in layout. The ordinary browser click hit `.ff-node-paper` underneath. The late launcher `overflow-x: auto` adjustment clipped the absolute palette; `.canvas-shortcuts` already provided the intended horizontal scrolling. This was a regression in the HUD adjustment, not evidence that static viewport `overflow: clip` should be removed.

Root changed the outer launcher to `overflow: visible`, preserving the existing world/HUD z-order, static viewport clipping and actual form scrolling. All three CSS files parsed; renderer compilation and asset copying passed. The original actual-pointer browser gate is unchanged. Source `961a4b866f08822b22290289eca01c6c2ae8a283` is under confirmation in [run 44981425773](https://github.com/occult-kranti/engineering-intelligence-atlas/actions/runs/44981425773). No new aesthetic pass, browser exception or force-click was introduced. The failed receipt and unexecuted later stages are retained in the verification record.


## Cross-company browser navigation follow-up (961a4b8 → 887938c)

Run `44981425773` confirmed that the finder opens Donna through an ordinary pointer click. It also captured the actual shared blueprint and live draft in perspective. The next failure was an offscreen Ownership footer for another company: the harness incorrectly assumed generic Fit would reveal that company. Root and the UX/verification nodes independently read the navigation handlers and reviewed the failure screenshot. Fit uses current scope bounds, while ordinary camera arrows can inspect another company without changing native selection.

The bounded correction uses actual arrow keys to bring the target footer into the unobstructed viewport, verifies native selection is still unchanged, and then uses the normal pointer click. This retains the intended cross-company authority regression. The titlebar checks now assert that the document and static viewport ancestors have no hidden scroll offset. No production change accompanies this harness correction. Source `887938cf588f4eaab28408fa32285d049eb68b78` is under confirmation in [run 44981843233](https://github.com/occult-kranti/engineering-intelligence-atlas/actions/runs/44981843233); the earlier failed receipt remains available in VALIDATION.md.


## Final director acceptance — source 887938c

**State: accepted for this shared-canvas pass.** [Run 44981843233](https://github.com/occult-kranti/engineering-intelligence-atlas/actions/runs/44981843233) completed successfully on Linux and Windows. It records 129 Linux unit tests, 122 Windows unit tests with seven Linux-only skips, 11 installed Linux checks, nine installed Windows checks, and 13 actual canvas/browser checks. Duplicate prepublish suite invocations are not double-counted. Production renderer code is unchanged from `961a4b8`; the intervening change fixes the test's public navigation and strengthens scroll assertions.

The root director independently viewed the final default top view, 1366×768 relief, and Ownership popup. The core reviewer separately inspected the 1366×768 top view and Arrange popup, plus the Ownership image and detailed receipt. The final [canvas receipt](evidence/ci-887938c-canvas.json) has SHA-256 `04c41b88857ef202c0f44aae3f1cc4596f8bdfbdc8c40659d192f0d9a1c8c052`; all 11 [screenshot hashes](evidence/ci-887938c-screenshots/SHA256.json) are retained.

Observed results:

- One continuous blueprint plane; native rooms and flat employee circles remain contained within company floorplans. No physical table or 3D figures appear.
- Ownership's titlebar occupies y158.80–192.87 at 1440×900, clear of the top controls ending at y112. Its panel is framed within the viewport. It shows the clicked company's 11 canonical people while retaining Donna's exact draft and the same world.
- After viewport resize, Donna's titlebar occupies y190.14–224.21 at 1366×768. Document and all recorded ancestor scroll offsets remain zero.
- All eight Arrange controls are visible and passed real clicks at 20 world-unit steps. Drafts, input identity, camera position, pin restrictions and focus are preserved.
- Actual software WebGL2 rendered both laptop sizes and recovered from one deliberately lost context. Restored geometry submitted 43 instances in three draw calls, with native state and draft unchanged.

The tight 1366×768 company capture still has fixed HUD overlap at some company header/footer edges; pan/zoom remains necessary to inspect every world action at that framing. The receipt establishes ANGLE/SwiftShader software WebGL, not hardware performance. Installed VS Code results come from the separate platform receipts, while the canvas harness uses an emulated VS Code parent and real temporary native backend. Dedicated forced-colors and unavailable-WebGL screenshot audits, full accessibility certification, production/Vast workloads and long-duration memory/hardware profiling remain outside this acceptance. See [VALIDATION.md](VALIDATION.md) for the consolidated results and exact boundaries.
