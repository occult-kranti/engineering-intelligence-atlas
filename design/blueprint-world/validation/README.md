# Blueprint World Studio — validation evidence

The current Studio expansion is published as owner-private Site version 17. This record separates independent command checks, application DOM workflows, numerical renderer checks and native browser observations. Actual WebGL rendering remains unverified in the managed browser.

## Current results

| Layer | Recorded result | Exact-source receipt |
| --- | --- | --- |
| Core model, persistence and geometry | 12 of 12 groups; core unchanged from the previous build | [Core receipt](core-receipt-a16a38263dda.json) |
| Studio authorization and commands | 17 of 17 independent groups | [Studio command receipt](studio-receipt-3a586a4d0905.json) |
| Application and Studio DOM workflows | 14 of 14 groups, final sources | [Final DOM receipt](studio-ui-final.json) |
| Three scene mathematics and relief lifecycle | 21 of 21 groups, non-GPU | [Renderer evidence](studio-renderer-evidence.json) |
| Managed Chrome controls | 14 grouped observations across published versions 16 and 17, with their source boundaries retained | [Native browser receipt](studio-browser-receipt.json) |
| WebGL appearance, shaders, scene picking and GPU performance | Not verified: WebGL2 unavailable | Native browser receipt and [run record](../STUDIO-RUN.json) |

These totals describe separate layers. The current DOM suite includes the six earlier workflow regressions, and the current renderer suite extends the earlier numerical suite; historical totals should not be added again. Native observations are not an automated test count. [validation-index.json](validation-index.json) contains the current source and evidence hashes. [publication.json](../publication.json) verifies byte parity between all nine canonical frontend files, the pushed Site source and the deployment archive.

## Running current checks

Run from the repository root:

```sh
node design/blueprint-world/validation/check-core.mjs
node design/blueprint-world/validation/check-studio.mjs
node design/blueprint-world/validation/check-studio-ui.mjs
node --experimental-vm-modules design/blueprint-world/validation/check-studio-renderer.mjs
```

The core, command and DOM scripts accept an optional source path and output JSON path. The renderer harness writes its named receipt beside the harness. Preserve committed receipts when recording a new run. The old `check-ui.mjs` and `check-renderer-nongpu.mjs` belong to the pre-Studio checkpoint and should be run against that checkpoint's sources.

The command suite uses Node built-ins. DOM and renderer harnesses resolve the existing `desktop-shell` jsdom dependency. Recorded runs used Node v24.22.3 and jsdom 31.0.1. No harness starts a provider, server, browser or external service. The renderer uses actual bundled Three 0.187.0 mathematics, geometries and OrbitControls, with explicitly mocked WebGLRenderer and text measurement. A mocked render call does not compile shaders or rasterize pixels.

## Model and authorization

The unchanged core suite covers canonical identities, same-name records in different companies, graph cycles, invalid references, rejected-mutation atomicity, query purity, corrupt storage, capacities, nested floorplans, placement clamping and circle spacing. Recorded capacities are 100 companies, 1,000 employees, 2,000 assignments, 4,096 departments, 500 tasks and 500 notes. These are local frontend limits, not measured production service capacity.

The independent Studio suite was authored from a frozen contract before acceptance of the command module. Its 17 groups cover:

- Explicit actor and capability grants. Role names, director labels, visiting/shared status and company ancestry confer no authority.
- Company isolation, department scope, opt-in descendants and shared employee assignments checked against their host company.
- Complete sibling reorder permutations, canonical identity preservation, company gutters and circle occupancy/containment.
- Atomic rejection, immediate revocation, stale revisions, exact retry receipts, cursor persistence after receipt eviction and current-state returns on retries.
- Latest eligible compensating undo, current grant checks, owner-change barriers and policy preservation.
- Combined core/Studio snapshots, legacy core-only loading, malformed metadata, journal validation, 256 actors, 1,024 grants and a 2 MiB serialized limit.

The model fingerprint is a change detector, not a cryptographic integrity guarantee. These are local command-policy checks; they do not provide server authentication, real account isolation, distributed transactions or autonomous worker execution.

## DOM integration

The final 14-group run evaluates the actual app, core, Studio commands and Studio UI in the same jsdom realm. The renderer import is replaced with an explicit unavailable-renderer boundary. No rendering success is simulated. The real application handlers receive input, change, pointer and keyboard events; private state is not used to trigger form mutations.

The suite retains the six earlier regressions: corrupt-storage recovery, department-specific hire drafts, person-specific task ownership, scoped scripted Donna drafts/literal text/history limits, panel cancellation and failed-persistence behavior. Eight Studio groups add opening without a write, literal owner edits, distinct actor drafts, denial through both profile and scene-placement callbacks, canonical Donna selection, atomic scoped sub-Donna creation/revocation, stale drafts after owner work, undo, invalid metadata preservation, cross-tab fencing and registration without implicit grants.

Cross-tab fencing is a local conflict warning and mutation stop, not compare-and-swap or multi-user synchronization. The test of a scene-placement callback does not establish real graphics picking. jsdom does not lay out or paint a browser page; CSS sizing, visual clipping, native focus scrolling and GPU performance require separate observations.

## Numerical graphics and bounded motion

The 21-group renderer harness checks independent orthographic equations, projection round trips, geometry containment, camera interruption, fast-release placement, cancellation, collisions, a 250 ms frame gap, malformed camera inputs, camera preservation, resource churn and disposal. It also checks Plan/Relief transitions, exact bottom door gaps, atomic invalid-relief rejection, shadow-target disposal and camera-facing cutaways.

The final evidence includes 3,800 center/rim rays across four tilts and five yaws, plus 300 nested-department rays. These CPU rays did not intersect a partition before the tested circle points. They do not prove rendered pixel visibility, glyph legibility or real scene hit targets.

A dense fixture contains 1,000 employees, 966 assignments in one department and a company 16,152 interface units tall. Overview fits its raised envelope at zoom 0.07186452855140499. A company moved to x=-60000, z=50000 excludes the distant conference spine. Company/department focus restores the 0.12 editing zoom floor and 2,400-unit camera distance.

A separate distributed fixture has 100 companies and 1,000 employees. It mounted three detailed companies, 30 circle instances, 90 partition instances and 501 text textures, with 8,804,566 source bitmap pixels observed. The recorded approximately 49 ms dense-fixture and 763 ms distributed-fixture durations are Node CPU construction plus synthetic frame observations, not browser timings or GPU FPS. The renderer harness recorded 649 mocked render calls.

## Native browser evidence and its limits

The local-preview reload was rejected by browser URL policy, and no local retry, alternate browser, flag change or graphics bypass followed. The independently published HTTPS page opened normally. Managed Chrome still reported WebGL2 unavailable; the application showed a recovery element and disabled graphics controls while keeping native forms usable.

Version 16 review exercised visitor read-only controls, Donna's literal rename and undo, attributed history, company-position denial, atomic local sub-Donna creation, department scope, delegated rename and immediate grant revocation. It exposed a redundant actor success message after automatic actor selection. The final UI removed that redundant text while retaining the live selector and canvas actor label. Earlier version 15 review also found a reorder label based on a no-op probe; the corrected label tests actual adjacent moves.

Version 17 review confirmed saved local actor/revocation state after reload, corrected current-actor presentation, owner undo after the policy change, Tab from Name to Save name, and a native header drag. At a 1,363 by 936 viewport, the Studio popup measured 420 by 680; it moved from x=40,y=90 to x=520,y=110. The popup body scrolled internally while document dimensions matched the viewport and page scroll remained zero.

The final native owner undo restored Design at revision 8. Policy preservation is established by the command and DOM suites; a separate native selection of the revoked actor after that final undo was not performed. The complete version 16 native scenario set was not replayed after the one-line actor-status correction. The final DOM suite does cover the final source. No live employee, account grant, provider operation or remote worker was created by these browser checks.

## Retained history and failures

[validation-index.checkpoint-287dfdf.json](validation-index.checkpoint-287dfdf.json) retains the original build index. Its source and README hashes refer to commit `287dfdf70bcece1960c7bda364e911c82dea37e2`. The original 20 native observations remain in `browser-receipt.json` and apply only to that older source. Earlier CSS prototype results remain in their separate design directory.

Initial Studio receipts are preserved: a bootstrap grant-schema integration failure, a 13/17 command attempt with two implementation defects and two demonstrated fixture-coordinate assumptions, and two transient UI-copy regressions. The explicit local-owner label and concrete owner-tools explanation were restored without weakening assertions. Historical passing UI receipts identify their own hashes. The current final command, DOM and renderer receipts all pass within their documented scope.

The remaining acceptance boundary is this exact frontend on a real WebGL2-capable laptop browser: rendered floorplans, materials, shadows, text, camera transitions, scene picking, popup attachment and frame rate must be observed together before claiming full graphics acceptance.
