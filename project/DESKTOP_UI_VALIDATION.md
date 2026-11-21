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
| Real Chromium layout sweep | Blocked before page load | Required Unix socket creation returned `Operation not permitted` |

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

## Browser verification limitation

A real Chromium launch was attempted before page load. The process aborted at `process_singleton_posix.cc` because its Unix socket could not be created. No screenshot or visual correctness claim is based on that attempt. The same failing configuration was not retried, and no sandbox or access policy was changed.

`desktop-shell/scripts/smoke-renderer.mjs` is a portable real-browser suite. It visits nine routes, the CEO portfolio, the three Donna workspace views, and five Office tool tabs at 1440, 800, and 390 pixel widths. It checks document overflow, uncaught errors, project creation, and unpriced cloud-run rejection; captures screenshots; and checks both unconnected and read-only starter modes. It uses fixtures and makes no provider requests.

The release owner may inspect the published public preview from an available browser. That verifies presentation and navigation of the starter example; it does not count as a private desktop end-to-end test.

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

The CEO extension passes **125 assertions**, including all 93 checks from the previous checkpoint. The structural pass finds **405 unique IDs**, no duplicate IDs, and no missing literal targets. The source is frozen for the release owner's visual sweep.

The optimization UI uses saved group memberships. Newly imported companies without a group enter a stable, reviewable **Ungrouped projects** collection. It does not claim code-similarity analysis. Shared departments include Engineering, Design & Architecture, Research & Knowledge, Security, Hackathon, and Music & Arts. Role counts describe persisted assignments; the separate running-request count comes from actual job states.

The public CEO sample must come from the isolated starter seed. The renderer never reads the private portfolio to construct public examples. The public bridge also adapts the starter company snapshot to the same shape expected by the renderer, allowing the public release roadmap and skill-linked team to render without claiming that a native workspace is connected.
