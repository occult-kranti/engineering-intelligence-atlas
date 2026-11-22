# Endless Blueprint — evidence and UX review

**Run:** `laptop-blueprint-20261122` · **Node:** `ux` · **Attempt:** `1`  
**Reviewer role:** UX author/reviewer; not independent acceptance authority for its own CSS  
**Termination owner:** root director · **Record date:** 2026-11-22  
**State:** `waiting` after document handoff; new build and visual gates remain pending.

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

## Round 2 — implementation evidence register

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

## Round 3 — independent acceptance record

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
