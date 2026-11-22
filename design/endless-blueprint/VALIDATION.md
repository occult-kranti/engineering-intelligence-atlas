# Endless Blueprint — verification record

**Run:** `laptop-blueprint-20261122`
**Current implementation candidate:** `887938cf588f4eaab28408fa32285d049eb68b78`
**Branch:** `design/infinite-blueprint-canvas`
**Status:** accepted by the root director for this three-round shared-canvas pass. Exact-source Linux/Windows installed-product checks and all 13 browser checks passed. Remaining coverage limits are explicit below.

[Current product CI](https://github.com/occult-kranti/engineering-intelligence-atlas/actions/runs/44981843233) · [Three-round plan](PLAN.md) · [UX observations and correction history](UX_REVIEW.md)

## Final acceptance

| Gate | Actual result | Evidence |
| --- | --- | --- |
| Linux extension unit suite | 129 passed; zero failed/skipped | [Consolidated CI summary](evidence/ci-887938c-summary.json) |
| Windows extension unit suite | 122 passed; zero failed; seven Linux-only cases skipped | Same summary; duplicate test/prepublish invocations are not added |
| Installed Linux VSIX | 11 checks passed in real VS Code | [Linux receipt](evidence/ci-887938c-installed-linux.json) |
| Installed Windows VSIX | Nine checks passed in real VS Code | [Windows receipt](evidence/ci-887938c-installed-windows.json) |
| Shared canvas and native backend | 13 browser checks passed; 11 screenshots | [Canvas receipt](evidence/ci-887938c-canvas.json) · [Screenshot hashes](evidence/ci-887938c-screenshots/SHA256.json) |
| Actual 3D | Sandboxed Chrome 157.0.8103.78, WebGL2, ANGLE/SwiftShader software renderer | Same canvas receipt; hardware acceleration is not asserted |
| Context recovery | One real loss/restoration; frame count 60 → 62; restored 43 instances / three draw calls | `graphicsRecovery` and graphics captures in canvas receipt |

Installed Linux acceptance additionally exercised real Electron → tmux → native runtime startup, a bounded host command, stable single execution on replay, detach/reconnect and cleanup. Windows verified the ordinary installed runtime; persistent tmux mode is Linux-only. Installed network requests were confined to owned loopback (28 Linux, five Windows). The browser made zero provider calls, external requests or backend network attempts and reported zero page, console, CSP or RPC errors.

The Ownership check navigated to another company through actual arrow keys, verified navigation did not change the active native company, then clicked its real footer. The resulting People & ownership popup showed 11 canonical people in confirmed scope, retained the same world and preserved Donna's exact live draft. Company creation from the canvas committed through the native core.

All eight Arrange actions passed at 20 world-unit steps; inverse operations restored geometry, retained live inputs/drafts, left the camera unchanged, and respected pinning and focus restoration. Ownership's titlebar was at y=158.80–192.87 CSS px at 1440×900; Donna's titlebar after the 1366×768 resize was at y=190.14–224.21. Document scrolling and every recorded static ancestor offset were zero. These titlebars are below the measured top HUD.

Main camera targets measured 36×36 CSS px, top command buttons 30 px high, and launcher buttons 40 px high. At the tested canvas zoom, Arrange move buttons measured about 49.2×28.8 CSS px and resize buttons 101.6×28.8. These are measurements, not full accessibility conformance. The actual idle sample submitted zero additional frames over 300 ms; this is a short demand-rendering observation, not a long-duration performance or memory profile.

### Reviewed application captures

- [Default top view, 1440×900](evidence/ci-887938c-screenshots/01-native-office.png)
- [Company relief, 1440×900](evidence/ci-887938c-screenshots/10-company-relief-1440x900.png)
- [Company relief, 1366×768](evidence/ci-887938c-screenshots/11-company-relief-1366x768.png)
- [People & ownership popup](evidence/ci-887938c-screenshots/09-company-ownership-1440x900.png)
- [Arrange popup, 1366×768](evidence/ci-887938c-screenshots/08-arrange-1366x768.png)
- [Restored real WebGL scene](evidence/ci-887938c-screenshots/07-webgl-restored-1366x768.png)

Root inspected the actual default, tilted and Ownership captures; the core reviewer separately inspected the requested laptop and popup captures. These are application screenshots from the temporary native fixture. The generated image in `assets/` remains concept art with separate provenance.

### Package integrity

Both raw artifact ZIP digests match GitHub, and both extracted VSIX digests match the packages verified in the installed tests. The exact hashes and build manifests are in the consolidated summary. Source `887938cf588f4eaab28408fa32285d049eb68b78` is the tested candidate; its production renderer is identical to `961a4b8`. Later closeout commits change documentation and evidence only. Existing published release assets are not replaced by these CI artifacts.

## What this source implements

The entire world is a blueprint plane. Companies contain canonical saved offices, department/room boundaries, flat employee circles and work markers. The initial camera is top-down; optional 3D uses real local Three.js geometry with the same projection as the semantic DOM. Company and room floors use exact-color unlit materials; shallow partitions receive lighting. There is no physical table, decorative chair, humanoid, folded paper or separate geometric state store.

The same native forms are reparented into movable canvas elements. New unlocked surfaces open near the current camera. Saved positions remain stable. Keyboard, drag and click-based Arrange controls share bounded geometry, and resize recovery changes the camera without rewriting panel state. Company Ownership opens the existing People & ownership surface after native scope confirmation. Static viewports clip without creating hidden browser scrolling; form bodies keep their normal scroll behavior.

## Local verification

| Gate | Result | Evidence |
| --- | --- | --- |
| Full Freeflow suite after the grouped correction | 167 passed across 13 files; zero failures/skips | [Raw log](evidence/correction-freeflow-tests.txt) |
| Renderer compilation and packaged asset build | Passed | [Build/test log](evidence/correction-extension-build-tests.txt) |
| VS Code package build, check and unit suite | 129 passed; zero failures/skips | Same build/test log |
| CSS parsing and component checks | All three stylesheets parsed; static clipping, scrolling and pointer behavior checked | UX node handoff in [review](UX_REVIEW.md) |
| Source/diff checks | TypeScript, whitespace and changed-file credential-pattern checks passed | [Correction receipt](evidence/correction-local-validation.json) |

The earlier 162-test checkpoint remains in [its original receipt](evidence/local-validation.json) and [raw log](evidence/freeflow-tests.txt). Counts from overlapping targeted suites are not added together.

## Stress coverage and corrections

Deterministic/unit coverage includes 1,000-company navigation, 2,000 synthetic rooms, malformed saved geometry, zoom 0.02–8, pitch 0–55°, large world coordinates, rebased matrix precision, preserved drafts, pinned and collapsed panels, stale events and 50 graphics mount/dispose cycles. Rendering uses fixed pools with one geometry, three materials and at most 2,048 instances; the DOM and detailed-company budgets remain separate.

Independent code review found three concrete faults: capped grids could miss the camera at extreme zoom; a world-wide horizon extent could allocate geometry to distant early companies; and terminal graphics failures retained resources until destruction. The fixes center bounded grids with stable phase, prioritize camera-local geometry, transfer fallback ownership per successfully rendered surface, and release each graphics owner immediately on terminal failure. Subsequent context events cannot resurrect a terminally failed renderer. Ordinary context loss retains one distinct restoration path.

The 50-cycle lifecycle suite uses a mocked WebGLRenderer boundary with real geometry/matrix code; the separate browser receipt establishes actual WebGL execution and one real recovery. These checks establish the tested invariants. They do not measure GPU VRAM, certify all possible memory behavior or establish a hardware frame-rate claim.

## Preserved first browser result

[Run 44979493493](https://github.com/occult-kranti/engineering-intelligence-atlas/actions/runs/44979493493) tested source `26ab5e6ef91e73b031890415d9d45a2b094b53c9`.

- Linux: 129 unit tests and 11 installed-extension checks passed, including actual Electron → tmux → native host execution, replay, detach/reconnect and cleanup.
- Windows: 122 unit tests and nine installed-extension checks passed; seven Linux-only cases were explicitly skipped.
- Sandboxed Chrome rendered actual WebGL2 using ANGLE/SwiftShader software rendering. The first top and tilted captures submitted real geometry.
- Company Ownership confirmed the other native company, showed 11 canonical people, preserved the world and retained Donna's exact draft.
- The browser gate then failed because it required office geometry while the camera was centered on a popup in an empty canvas region. The recorded frame had zero instances, draws and triangles with a live successful context.
- Screenshot review additionally found duplicated plan labels, muddy lit floor colors, popup placement far from the office, and titlebars displaced beneath the HUD. These drove the grouped correction in the current candidate.

The [failed canvas receipt](evidence/ci-26ab5e6-canvas-failed.json), [Linux installed receipt](evidence/ci-26ab5e6-installed-linux.json), [Windows installed receipt](evidence/ci-26ab5e6-installed-windows.json) and [artifact summary](evidence/ci-26ab5e6-summary.json) remain unchanged. This earlier run is not labelled as overall acceptance.

## Preserved finder regression and repair

[Run 44980854371](https://github.com/occult-kranti/engineering-intelligence-atlas/actions/runs/44980854371) tested source `007084fbb570d7c94f0e0375ef8f06ff960097a9`. Linux again passed 129 unit tests and 11 installed checks; Windows passed 122 unit tests and nine installed checks with seven Linux-only skips. The explicit company top and tilted views submitted 37 and 69 instances through real sandboxed WebGL2, respectively.

The browser then failed before Ownership: the Find-a-surface result had a layout box, but the world received its pointer click. Independent diagnosis and the failure image identified the cause in the last HUD adjustment: `overflow-x: auto` on the launcher clipped its absolute popup above the launcher. Both overflow axes become scrolling axes in that combination. The shortcut strip already owns its horizontal scrolling. Source `961a4b8` restores `overflow: visible` on the launcher, preserving shortcut scrolling, viewport clipping, normal pointer testing and the existing layer order. Renderer compilation and asset copying passed; all three stylesheets parsed. No security flag, force-click or acceptance relaxation was introduced for this repair.

The [failed canvas receipt](evidence/ci-007084f-canvas-failed.json), [Linux receipt](evidence/ci-007084f-installed-linux.json), [Windows receipt](evidence/ci-007084f-installed-windows.json) and [artifact summary](evidence/ci-007084f-summary.json) preserve this failed candidate. Later checks, including Ownership, Arrange and context recovery, were not reached in this run.

## Preserved cross-company navigation finding

[Run 44981425773](https://github.com/occult-kranti/engineering-intelligence-atlas/actions/runs/44981425773) tested source `961a4b866f08822b22290289eca01c6c2ae8a283`. The finder repair passed ordinary browser clicking, and Donna preserved its live draft through movement and perspective. Both installed products again passed their 11 Linux / nine Windows checks; extension unit results remained 129 Linux / 122 Windows with seven Linux-only Windows skips.

The browser then stopped at Ownership because the harness used generic Fit and attempted another company's offscreen footer. Fit intentionally frames the current readable company, and the clipped viewport correctly cannot scroll the transformed world to an unrelated target. Independent inspection confirmed this navigation assumption. Source `887938c` changes the harness to navigate with bounded real arrow-key input, assert camera progress, and confirm that the native active company has not changed before the ordinary Ownership click. It also turns recorded document/ancestor scroll offsets into explicit zero-offset assertions at the existing titlebar gates. Production renderer code is unchanged from `961a4b8`.

The [failed canvas receipt](evidence/ci-961a4b8-canvas-failed.json), [Linux receipt](evidence/ci-961a4b8-installed-linux.json), [Windows receipt](evidence/ci-961a4b8-installed-windows.json) and [artifact summary](evidence/ci-961a4b8-summary.json) remain intact. Four canvas checks completed; Ownership, 1366×768, Arrange and context restoration were not reached in that run. No force-click, JavaScript camera write or scope preselection was introduced.

## Acceptance method and remaining coverage

The current harness distinguishes valid empty canvas from a missing company surface. Explicit company views require geometry and visible room partitions at 1440×900 and 1366×768. It uses public Top, Fit and 3D controls, then checks live popups, all eight Arrange actions, exact draft retention, native ownership, titlebar bounds and one actual context loss/restoration when available. Main-control and Arrange dimensions are recorded as rendered CSS pixels; no blanket WCAG conformance is asserted.

The final exact-source receipt, screenshots and platform package digests are recorded above. At the tight 1366×768 company framing, fixed HUD elements overlap some company header/footer edges; ordinary pan/zoom remains necessary to inspect every world action. The broader design matrix remains a roadmap for additional acceptance: dedicated forced-color and WebGL-unavailable screenshots, a dense browser fixture, a complete screen-reader/contrast audit, production visitor/owner workloads, and long-duration hardware GPU/heap/VRAM profiling were not completed in this pass. Existing deterministic fallback, malformed-state and scope checks are not relabelled as those broader observations.

## Product boundary

The browser harness runs the actual packaged renderer and bridge against a temporary real native runtime through an emulated VS Code parent. Installed Linux/Windows extension activation is a separate gate. Neither is a production owner-data or live Vast workload test. These UI checks invoke no paid provider, external model server, model download or cloud rental.

Roadmaps and recorded activity provide time-aware work surfaces. Historical spatial replay, trained mixture-of-experts weights, a general physics simulation and a live ChatGPT MCP connection are not introduced by this canvas pass. The published `v0.9.0-preview.1` assets remain their earlier source; this document covers later branch work.
