# Desktop interface validation

## Scope

The v0.4 renderer opens in Donna's unified workspace. The CEO overview sits above the company scope and opens a portfolio directory, shared-service departments, group membership controls, and the global roadmap. Company and group entry points return to the existing conversation, office, or whiteboard; there is still exactly one chat surface. Chat, Office Blueprint, and Whiteboard share a company/office/department/employee scope. Existing Office controls remain in an expandable tools area: overview and dispatch, employees, queue and schedules, memory and cache, ledger, and GitHub branch operations. The original Overview, Projects, Team, Roadmap, Usage, Library, Models, and Settings destinations remain available.

The bridge fixture lives only under `desktop-shell/tests/fixtures/`. It does not call a provider, query GitHub, read credentials, or save user state. The public starter-office example is a separately labeled read-only transport; it is not the test fixture and does not imply a live private company.

## Executed checks

| Check | Result | Boundary |
| --- | --- | --- |
| Renderer TypeScript | Passed | Strict compilation, including `noUncheckedIndexedAccess` |
| Pure-DOM interaction suite | **125 checks passed** | Fixture bridge, no network or model requests |
| HTML consistency | **405 unique IDs**; no duplicates or missing literal DOM targets | Structural consistency, not layout |
| Worker and GitHub importer unit suites | **49 tests passed** | Injected provider/network/native callbacks, isolated temporary files |
| Renderer test/smoke script syntax | Passed | Node syntax checks |
| Local Chromium layout sweep | Blocked before page load | Required Unix socket creation returned `Operation not permitted` |
| Published v0.4.0 browser sweep | Passed; 46 screenshots captured | Pages smoke/offline checks and public starter navigation; separate from the local launch restriction |
| Expanded v0.4.1 Pages sweep | Found a queue-view overflow at 390 pixels | Valid regression finding after the preceding release gates passed |
| v0.4.2 Pages browser sweep | **Passed; 60 screenshots and 62 route/reload checks** | Exact candidate `5627c846c09b0e717f0763d202ae2054772af0c5`; no overflow or page errors, including queue at 390 pixels |
| v0.4.2 visual review | Queue controls fit; blueprint list-card proportions require correction | Inline room dimensions overrode list mode despite passing document-overflow checks |
| v0.4.3 blueprint browser regression | **Passed; 60 screenshots and 62 route/reload checks** | Exact commit `eb5f25073a2c1c3377068b6d30c5743a729305b1`; populated list geometry assertion passed |
| v0.4.3 visual review | **Passed for observed public flows** | Corrected narrow blueprint, Settings, focused roster, CEO, ownership editor and site navigation inspected on the final deployment |
| v0.4.3 release gate | **Passed** | All five final CI jobs succeeded; the same browser smoke is required by the web job before release |

The interaction suite covers:

- All nine navigation routes, active navigation semantics, new-project focus, project submission, and positive cloud-rate enforcement.
- Company registration and evidence required before roadmap completion.
- Permanent Donna, specialist hiring/pause, safe rendering of hostile-looking names, queue authorization, schedules, cache policy, knowledge, ledger filtering, GitHub import, and dispatcher controls.
- The default unified chat, scoped user messages, local-plan provenance, plan ownership, and absence of provider execution for a plan-only brief.
- Review-mode authorization and execution, autonomous authorization within fixed caps, saved global policy, and recorded remaining budget.
- Saved room selection, normalized keyboard movement, employee placement, ownership cards linked to actual goals, owner-desk lines, and room-relative card movement.
- GitHub branch-head selection, comparison results, exact-head publication requests, review-policy checks, private-import intent, GitHub credential metadata, native credential-file import, and the private dashboard action.
- An unconnected preview and a clearly labeled public starter preview whose mutation controls are disabled.
- CEO navigation, explicit group membership, stable ungrouped-import fallback, repeated optimization without employee duplication, and atomic company reassignment.
- Company/group/department roadmap filters, evidence required for Done, persisted roadmap-to-whiteboard links, and status derived from the saved outcome.
- Shared-service contract creation and pause/resume, reused source-company employee identities, contracted queue selection with the recipient scope, and correct inspection of reused staff in the shared-services office.
- CEO policy, paused daily repository-review templates with 48,000-token caps, positive provider-rate checks, and wording that separates proposal artifacts from publishing.
- The public CEO example remains navigable while staffing, roadmap, and execution mutations stay disabled.

These tests establish renderer event and state behavior against a fixture. They do not establish native Rust persistence, OS keychain operation, real GitHub publication, live model output, actual browser layout, or screen-reader compatibility. Native services and external operations have separate validation responsibilities.

## Browser verification and release history

A real Chromium launch was attempted before page load. The process aborted at `process_singleton_posix.cc` because its Unix socket could not be created. No screenshot or visual correctness claim is based on that attempt. The same failing configuration was not retried, and no sandbox or access policy was changed.

`desktop-shell/scripts/smoke-renderer.mjs` is a portable real-browser suite. It visits nine routes, the CEO portfolio, the three Donna workspace views, and five Office tool tabs at 1440, 800, and 390 pixel widths. It checks document overflow, uncaught errors, project creation, and unpriced cloud-run rejection; captures screenshots; and checks both unconnected and read-only starter modes. It uses fixtures and makes no provider requests.

The [v0.4.0 Pages run 44846291115](https://github.com/occult-kranti/engineering-intelligence-atlas/actions/runs/44846291115) completed browser smoke/offline checks and captured 46 screenshots. The director subsequently opened the CEO view, a blueprint room and a whiteboard card in the public preview and confirmed their interface bindings. Those observations verify the starter example's presentation and navigation; they do not count as a private desktop end-to-end test.

The expanded v0.4.1 Pages sweep subsequently found a queue-view document width of 448 pixels at a 390-pixel viewport. Candidate [5627c846c09b0e717f0763d202ae2054772af0c5](https://github.com/occult-kranti/engineering-intelligence-atlas/commit/5627c846c09b0e717f0763d202ae2054772af0c5), version 0.4.2, corrects intrinsic form-track/control widths and lets the filter wrap, preserving visible controls. The same public browser sweep is now mandatory in the CI `web` job before release.

At that exact commit, [Pages run 44847753403](https://github.com/occult-kranti/engineering-intelligence-atlas/actions/runs/44847753403) passed and deployed, and all five jobs in [Verify run 44847753410](https://github.com/occult-kranti/engineering-intelligence-atlas/actions/runs/44847753410) passed. The downloaded evidence contains **60 screenshots and 62 successful route/reload checks**, with **no overflow or page errors**, including the corrected queue view at **390 pixels**. [Artifact 14684216139](https://github.com/occult-kranti/engineering-intelligence-atlas/actions/runs/44847753403/artifacts/14684216139) is 8,595,301 bytes with SHA-256 `a01e2fd56164f70684fdb8e59bea421e56ffff9e052a76bf70caae536d5b3120`.

Subsequent visual inspection confirmed that the queue budget, native date and status filter fit at 390 pixels, and that the narrow CEO and whiteboard views were readable. It also found a distinct blueprint list-layout defect: inline room width of 32% and minimum height of 581 pixels overrode list-mode sizing, leaving narrow, overly tall cards. That issue is not detected by document-overflow assertions. The CSS correction restores full list-track width and content-based height and hides only the decorative floor-plan layer in list mode.

The corrected **v0.4.3** candidate, [eb5f25073a2c1c3377068b6d30c5743a729305b1](https://github.com/occult-kranti/engineering-intelligence-atlas/commit/eb5f25073a2c1c3377068b6d30c5743a729305b1), includes a specific regression: a populated blueprint enters list mode at 390 pixels; every room must span its inner track within two pixels and have height below 400 pixels. [Pages run 44848307180](https://github.com/occult-kranti/engineering-intelligence-atlas/actions/runs/44848307180) passed this assertion, completed 62 route/reload checks, captured 60 screenshots and deployed the result. Its [downloaded evidence archive](https://github.com/occult-kranti/engineering-intelligence-atlas/actions/runs/44848307180/artifacts/14684441585) is 8,590,678 bytes, SHA-256 `bcf5287ce5657edad6148cc62b26474e0a764a9ac348c3ba17024ca1e2c73356`.

The director and designer inspected the actual final `workspace-blueprint-390.png`: all three room cards fill their list width, use sensible content heights, show readable names and employee controls, and retain the `+8 more` action without overlapping decoration. On the deployed v0.4.3 preview, the director confirmed the preview-specific Settings credential guidance and that `+N more` opens and focuses the full 14-employee example roster inside a 260-pixel bounded area. CEO group wording and SVG arrows rendered correctly in the captured viewport.

The director then selected **Connect a repository → Map ownership**. The existing whiteboard editor received the expected title, Donna owner, Engineering room and linked outcome; its read-only Save control remained disabled. The public site root, workspace navigation and download entry were checked, and actual final CEO and whiteboard screenshots were captured. No remaining material layout defect was observed in these reviewed flows.

All five jobs in final [Verify run 44848307218](https://github.com/occult-kranti/engineering-intelligence-atlas/actions/runs/44848307218) passed, including the required browser smoke in the web job and the release job. The [v0.4.3 release tag](https://github.com/occult-kranti/engineering-intelligence-atlas/releases/tag/v0.4.3) resolves to the exact reviewed source commit. Its downloaded APK and AppImage sizes and checksums were independently verified; [the integrated validation record](VALIDATION.md) contains the values and verification boundaries.

## Reproduction

The desktop dev dependencies pin the same `jsdom@31.0.1` used for the executed checks. The standard command builds the renderer and runs the DOM suite; CI runs it after the desktop tests.

```sh
cd desktop-shell
npm ci
npm run test:renderer
```

An optional `ATLAS_JSDOM_MODULE` override is available for an alternate development installation, but is not required. Use a supported current Node 22 release (22.22.2 or newer), Node 24.15 or newer, or Node 26.

Run the independent worker/import tests from the desktop package:

```sh
cd desktop-shell
npx vitest run tests/office-worker.test.ts tests/github-import.test.ts
```

For the real-browser suite, provide Playwright and Chromium, then serve the renderer:

```sh
python -m http.server 8752 --bind 127.0.0.1 --directory desktop-shell/dist/renderer
```

In a second terminal:

```sh
node desktop-shell/scripts/smoke-renderer.mjs
```

Optional settings are `ATLAS_UI_BASE_URL`, `ATLAS_UI_OUTPUT`, and `ATLAS_CHROMIUM_EXECUTABLE`. The script uses normal browser sandboxing unless an operator explicitly chooses `ATLAS_BROWSER_NO_SANDBOX=1` in a supported isolated test environment. That setting does not resolve the Unix-socket restriction observed here.

## Interaction and data principles

Conversations label local planning, provider output, and saved evidence separately. Usage charts consume recorded runs. Budget policy displays native observed, conservative estimated, and reserved costs. Waiting-budget work remains queued instead of disappearing. Goal time is a target checked between iterations; the worker separately limits each provider request.

Room and whiteboard controls support selection, keyboard movement, coordinate forms, pointer movement, and list views. Existing vault, provider discovery, project squads, artifacts, models, environments, and hosted-runtime controls remain connected. Lists and histories are bounded to avoid rendering the entire repository or organization at once.

The public preview has an explicit example-data banner and cannot save goals, alter the office, publish changes, or execute providers. The private browser transport uses the same renderer connected to the local desktop service.

## Portfolio checkpoint

The CEO extension passes **125 assertions**, including all 93 checks from the previous checkpoint. The structural pass finds **405 unique IDs**, no duplicate IDs, and no missing literal targets. The v0.4.3 Pages run supplies fresh proof of the corrected blueprint list layout, including a specific geometry assertion and independent inspection of its actual screenshot.

The optimization UI uses saved group memberships. Newly imported companies without a group enter a stable, reviewable **Ungrouped projects** collection. It does not claim code-similarity analysis. Shared departments include Engineering, Design & Architecture, Research & Knowledge, Security, Hackathon, and Music & Arts. Role counts describe persisted assignments; the separate running-request count comes from actual job states.

The public CEO sample must come from the isolated starter seed. The renderer never reads the private portfolio to construct public examples. The public bridge also adapts the starter company snapshot to the same shape expected by the renderer, allowing the public release roadmap and skill-linked team to render without claiming that a native workspace is connected.
