# Blueprint World validation evidence

This directory contains independent core and DOM checks for the new flat-circle Blueprint World, plus the renderer owner's separate numerical review. The coordinator reran the current DOM and renderer harnesses. Those origins are kept distinct below. The earlier CSS 3D prototype's validation is not evidence for this WebGL implementation.

## Recorded result

| Check | Result | Exact source | Receipt |
| --- | --- | --- | --- |
| Independent core records, persistence and geometry | 12 of 12 groups passed | Core SHA256 `a16a38263dda7c067c5d16ad80b6288f3ebc70fd8c6238b4d092f332a78114ea`, 35,637 bytes | `core-receipt-a16a38263dda.json` |
| Independent application DOM harness, rerun by the coordinator with graphics explicitly unavailable | 6 of 6 groups passed | App SHA256 `3dd32e492c47215835842394a8f78ef42a3c84066b2d7755b121cdc5f20d9546`, 63,778 bytes | `ui-receipt-3dd32e492c47.json` |
| Renderer-owner numerical review, rerun by the coordinator | 11 of 11 groups passed; non-GPU only | Renderer SHA256 `c595ab9e7fbe3dc7cbbb969fba7f7eac7094f8ca27cb6f6a6b553f258f839f53`, 33,195 bytes | `renderer-nongpu-evidence.json` |
| Actual WebGL rendering, graphics picking and GPU performance | Not verified by these checks | No real GPU context is created by these harnesses | The coordinator reported that managed Chrome could not provide WebGL2; actual-browser observations belong to the coordinator's separate receipt. |

The receipts identify the exact inputs, harnesses and environments. A later source change is not covered merely because its filename remains the same. `validation-index.json` links these results and their hashes.

The earlier independent DOM pass, `ui-receipt-724868f8697d.json`, remains historical evidence for app SHA256 `724868f8697dce20047ff516cc9874e730bb0f20b40c35ce722abb6a8cfe67f0` (63,579 bytes). The current pass uses the same independent DOM harness, SHA256 `a26abeba77fcc676bdb9e3998fd88b58053effab15e34622a84507ae56efd4ba`, on the coordinator's updated app. The renderer-owner harness has SHA256 `29c833c54174d536002833bd9aae95baeac122fc2910e82b5e73bda103db782a`.

## Running the checks

From the repository root:

```sh
node design/blueprint-world/validation/check-core.mjs
node design/blueprint-world/validation/check-ui.mjs
node --experimental-vm-modules design/blueprint-world/validation/check-renderer-nongpu.mjs
```

The core and UI scripts accept an optional source path followed by an optional output JSON path. Relative arguments resolve from the invoking working directory. The UI script expects the HTML and core module alongside the app module. The renderer harness resolves the shipped core, renderer and vendor relative to its own file and writes `renderer-nongpu-evidence.json` alongside the harness.

```sh
node design/blueprint-world/validation/check-core.mjs cloud-workspace/public/concepts/blueprint-world-core.js /tmp/blueprint-core-receipt.json
node design/blueprint-world/validation/check-ui.mjs cloud-workspace/public/concepts/blueprint-world-app.js /tmp/blueprint-ui-receipt.json
```

The core harness uses Node built-ins only. The UI and renderer harnesses resolve the repository's existing `desktop-shell` dependency on jsdom; the recorded core and DOM runs used Node v24.22.3, and the DOM receipt records jsdom 31.0.1. None of these harnesses starts a browser, server, provider call or external service. A failed assertion produces a nonzero exit code and a receipt identifying the failed group.

## Core coverage

Fixtures are constructed independently of the implementation and do not import its layout or validation helpers. The suite checks:

- The frozen 23-export contract, deterministic independent seed states and declared constants.
- Twenty-five malformed graph/schema cases, including company, department and reporting cycles, invalid references, duplicate identifiers and out-of-company ownership.
- Two companies with the same employee names, task titles and note text: changing one company's records leaves the other company's records intact, including after save/reload.
- Local company creation, explicit shared assignments, same-clock task IDs, nested department scopes and task-owner eligibility.
- Twenty rejected mutations that must leave the original state deeply unchanged.
- Inclusive capacities: 100 companies, 1,000 employee definitions, 2,000 assignments, 4,096 departments, 500 tasks and 500 notes; 32 root departments per company, four children per parent and nesting depth two.
- Copied query results and pure queries, bounded search, ten load-failure cases and four save-failure cases using only the supplied storage adapter.
- Rectangle/circle predicates, boundary tolerance, large-coordinate translation, clamps and full layout containment.
- A nested layout with nine rooms, four boards and 22 circles, including 172 automatic spacing pairs; circles have radius 18 and automatic centers are separated by at least 64 world units.
- Assignment/note movement clamps that preserve canonical identity and scope, including the usable parent-room strip above nested children.

These are abstract interface world units, not metres. The core uses local x/y coordinates; the renderer maps them onto world X/Z with world Y as depth. The CPU geometry checks use binary64 arithmetic and the frozen API's absolute epsilon of `1e-7`. They do not establish GPU precision or visual hit-test tolerances.

## DOM workflow coverage

The UI harness evaluates captured app and core source in the same jsdom realm. Only their module wiring is adapted: core exports are exposed to that realm, and the renderer import is replaced by a function that explicitly throws an unavailable-renderer error. There is no mock rendering success or fake WebGL context. Interactions use visible application controls, labels, input/change events and pointer/keyboard events; tests do not call private application state or functions.

The six groups cover:

1. Truthful graphics failure recovery, usable native forms, read-only opening without storage writes, and preservation of corrupt raw storage until a mutation is requested.
2. Independent hire drafts for two departments, stable drafts across close/reopen, unique field IDs when forms coexist, and creation only in the selected department.
3. Independent task drafts for two people in the same department, correct owner retention and exclusion of employees from a different company.
4. Donna draft clearing after send, unsent drafts across scope changes, literal rendering of hostile HTML-looking text, 24 rapid sends, a 40-message cap, and no hidden task creation.
5. Restoration of a dragged panel's starting presentation after pointer cancellation, window blur and Escape. This uses a fixed synthetic 380 by 240 panel rectangle; it does not verify real pointer capture, CSS positioning, scrolling or browser hit-testing.
6. A failed storage write that keeps the new session record usable, leaves persisted data unchanged and displays a session-only warning.

The initial UI attempt passed Node-realm core functions into jsdom. Because the core deliberately accepts only plain objects from its own realm, this was an invalid test setup for browser form arguments. That attempt is retained as `ui-receipt-724868f8697d-initial-harness.json` with status `invalid-harness` and is not counted as an application failure or as verification. The corrected harness evaluates both modules in one realm, as native browser modules do.

## Renderer-owner numerical coverage

This is a separate review authored by the renderer owner, not an independent GPU pass. The coordinator made its paths portable and reran it against the exact shipped vendor: `cloud-workspace/public/concepts/blueprint-world-vendor.js`, SHA256 `fc7cbff1e3c2d33d2ac1fe1ad49d8a31db926cd5c966482ce2d2762bc82147c4` (769,573 bytes). It imports the bundled Three 0.187.0 math, geometries and OrbitControls, while replacing `WebGLRenderer` and text measurement with explicit test doubles and using synthetic DOM events.

The 11 passing groups cover initial scene settling, independent orthographic equations and projection/inverse-projection round trips, finite contained room geometry, manual interruption of camera travel, fast-release position commits, five cancellation paths, collision/containment with extreme targets and a 250 ms frame gap, malformed camera input, camera preservation across state refresh, bounded observed resource churn, simulated context-restoration readiness, and disposal of observed resources/listeners/frames. The receipt reports 36 projection cases with a maximum screen error of about `7.35e-12` and maximum world round-trip error of about `1.37e-12` under its synthetic dimensions.

The harness records 481 mocked render calls. Those calls exercise scene construction and lifecycle logic; they do not compile shaders or rasterize pixels. The synthetic context-restoration assertion establishes a host readiness callback after a simulated event, not recovery of a real graphics device. These numerical results cannot establish glyph legibility, visual occlusion, real browser hit targets or GPU performance.

## Scope and remaining limits

These checks verify local demo behavior. They do not verify production account authorization, delegated grants, live Donna workers, model execution, repository access, or remote deployment.

jsdom does not perform browser layout or graphics rendering. The DOM workflow pass does not establish CSS clipping, element hit-testing, focus scrolling, accessible announcement delivery, graphics context restoration, camera projection, raycasts, spring animation, frame rate, or GPU resource cleanup. The separately identified renderer-owner review checks CPU scene mathematics and lifecycle behavior using test doubles. Actual-browser observations must retain their own source hashes and distinguish native form behavior from graphics behavior. The coordinator's WebGL2 limitation remains a real verification gap.

## Provenance and bounds

Run: `blueprint-world-20261121`; node: `verification`; attempt: `1`; termination owner: `root`. The review was bounded by the Director protocol, with one grouped repair review for concrete application/renderer issues. This validator modified only this validation directory and did not commit or publish changes.

The final bookkeeping pass inspected the coordinator's current receipts and source/harness hashes without rerunning tests or changing implementation code. It updated only this README and `validation-index.json`. The coordinator owns the separate browser receipt and its subsequent addition to the index.

The frozen input contract is `core-contract.json`, SHA256 `63fdb32f46975a5b4ba0599f99c4f69cb8601d8ac23c56e594e67aa984bc1cce`. The computational-geometry engineering skill and its validation/method references were read and matched against the project's skill registry; their exact hashes are included in the core receipt. The old `design/blueprint-canvas/validation/` results apply only to that earlier prototype.
