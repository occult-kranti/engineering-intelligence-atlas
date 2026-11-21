# Freeflow 0.7.0 — verification receipt

Updated 2026-11-21. This receipt separates implemented and tested behavior from account/host acceptance. Daftar 0.7.0 is published from `9ac008011d5bde2d1d09f55ae5caa176d7d5973d`; the [machine-readable publication receipt](release-0.7.0.json) records the exact release, Site, CI and asset results.

## Implemented scope

- Conference-table company seats, explicit parent companies, subdepartments, accessible camera/list navigation, optional automatic and edge panning, movable Donna controls and both studio themes.
- Owner People & access, visiting-employee canvas and invitation review; restricted projections, role/expiry changes and attributed audit entries.
- Shared Ollama request/assignment registry, deduplicated downloads, digest verification and local-only enforcement; desktop, personal-browser, HTTP and MCP controls.
- Deterministic permanent observer, automatically refreshed native index, shared-service reuse and existing Donna scoped handoffs.
- Native-backed headless daemon, encrypted optional Site device synchronization, Compose/systemd deployment and nine MCP tools.
- Additive repository-company hierarchy reconciler that preserves existing custom parents and private records.

## Executed locally

| Gate | Observed result |
| --- | --- |
| Rust core | 95/95 tests; optimized release binary built |
| Desktop unit suite | 504/504 tests |
| Renderer pure-DOM interaction | 294/294 assertions; zero network/provider calls |
| Final toolbar lifecycle/controls/member slice | 24/24 tests |
| Cloud API suite | 98/98 tests; TypeScript and production build passed |
| Public web app | TypeScript/migration checks passed; 75 tests passed, 22 integration tests skipped without live services |
| Python portfolio/backup tools | 27/27 tests |
| Native/MCP/company-kit/asset checks | 46 Node test entries passed (includes 6 checksum cases) |
| Company hierarchy reconciliation | 12/12 tests, including real native calls, CAS conflict and interrupted response |
| Headless HTTP/MCP + cloud sync | 55/55 tests, including legacy-default migration, restored-backup protection and native receipt recovery |
| Real stdio → HTTP → Rust smoke | 9/9 checks; no provider calls or rented infrastructure |
| Native office lifecycle smoke | Passed, 8 injected provider responses, retained artifacts and checkpoints |
| Public static integrity | 182 portable client files verified |

Browser observations used the managed preview: company titles, both themes, auto-pan starting and stopping on interaction, Donna panel and its options. One final review identified camera controls covering a company title; the controls now occupy a separate row outside the measured scene. The synthetic browser gate asserts their bounding boxes do not overlap.

The expanded cloud browser gate includes owner stale-response races, exact invitation payloads, restricted visitor canvas, membership-expiry clearing, token fragment/storage handling and signed-out routes. Local Chromium could not launch (`socket() failed: Operation not permitted`), so **zero automated browser assertions ran locally**. The actual CI browser gate subsequently passed: 71 primary checks, all eight Freeflow matrix cases, and capacity cases with 200 companies, 1,000 desks, 200 boards and 20 transitions, with zero unexpected Freeflow writes or provider calls. Docker was unavailable locally; CI verified the real image build, rebuild with unreadable mode-0700 secrets, healthy boot, authenticated HTTP and in-container MCP. Linux and Windows packaged applications both loaded the native core and persisted a local goal. These package checks used unpacked release applications, not owner-machine installer/upgrade or keychain acceptance.

## Private portfolio

The private repository inventory was reconciled against saved companies and existing portfolio groups. Parent relationships were applied through native commands with zero provider calls or inherited grants; a repeat apply performed zero changes. Company, office, department, employee, contract, knowledge and artifact records were preserved. Exact private counts and identities are retained in the owner handoff and remain outside public source and previews.

The transformed private backup is a durable handoff, not evidence that the current Site projection was overwritten or a new VPS was paired. The live Site still owns its existing projection until an authorized writer syncs it. A fresh runtime must restore the matching baseline before first pairing; actual hierarchy edits are then applied and synchronized under that writer.

## Model and infrastructure boundaries

The Sonnet observer request was completed through the signed-in private Donna conversation. Its returned code was reviewed and hardened for date bounds, ID comparison and heartbeat leases before integration. Test providers and Ollama HTTP daemons are injected fakes; no model weights were downloaded and no paid host was rented.

A model pool assignment is explicit. Existing managed Ollama jobs using arbitrary tags need a reviewed local assignment and operator local-only configuration. GPU/VPS charges are separate from token accounting. The release does not claim a deployed Vast host, a live ChatGPT tunnel, public OAuth, arbitrary-code sandboxing, signed installers or an owner-device keychain check.

## Publication

The owner-private Site was published from source `88c0c330027d97a6d95f6d17bc7a3fbc9c23bdba` on 2026-11-21. Live acceptance verified the loaded company conference table, automatic browsing stopping on interaction, Donna options, owner access dashboard, restricted visiting-office canvas and invitation review. No membership or Site audience was changed. [PR #1](https://github.com/occult-kranti/engineering-intelligence-atlas/pull/1) was merged after its corrected candidate passed all verification jobs. The merged source passed [all twelve jobs including release](https://github.com/occult-kranti/engineering-intelligence-atlas/actions/runs/44945563924), and [Pages deployment](https://github.com/occult-kranti/engineering-intelligence-atlas/actions/runs/44945563914) succeeded. [0.7.0](https://github.com/occult-kranti/engineering-intelligence-atlas/releases/tag/v0.7.0) contains the Linux AppImage, Windows x64 NSIS/ZIP, Android APK, VS Code extension and checksum manifest. The downloaded manifest and all five package digests match GitHub metadata. Application packages were verified by CI; the package bytes were not redownloaded during final publication verification.

The final independent review reproduced and fixed same-device restored-backup overwrites and the fresh-desktop first-sync identity shortcut. Mismatched revisions now stop before any native command, acknowledgment or upload unless the fetched projection exactly matches local state; first-sync recovery requires the headless encrypted base proof. An interrupted first desktop sync without that proof requires explicit review. The reusable headless workflow is a required dependency of the release job, including its actual container boot check.

## CI corrections before release

The first GitHub run (`44944163515`) passed eight jobs and exposed three concrete gates. The Windows package built but its boot recorder identified an eager, unnecessary `appData` lookup; explicit/current profiles now avoid that lookup. The cloud browser matrix selected an employee and then queried a hidden studio; it now selects explicit company/room targets and asserts their destinations. Docker context traversal attempted to open protected secrets; literal include exceptions preserve directory pruning, and CI now builds both before and after private credential initialization. The corrected candidate and the merged source both passed all three gates before the release was published.
