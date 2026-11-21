# Daftar product roadmap

This file distinguishes implemented behavior from deployment and validation work.
The detailed worker asks and returns are in [the shared ledger](project/WORKER_LEDGER.md),
with the sequence indexed in [TIMELINE.md](TIMELINE.md).

## Connected office 0.5.0

[v0.5.0](https://github.com/occult-kranti/engineering-intelligence-atlas/releases/tag/v0.5.0)
was released from
[`0b87469`](https://github.com/occult-kranti/engineering-intelligence-atlas/commit/0b87469ba14864959bd5ec70dd323ce909904faa)
after all seven gates and release passed in
[Verify 44860194825](https://github.com/occult-kranti/engineering-intelligence-atlas/actions/runs/44860194825).
This includes packaged desktop operation, installed editor activation and the
cloud UI fixture. Pages passed, all three downloaded assets matched published
digests, and the final personal archive restored and paired to the deployed API
using the published Rust binary. Original, restored and cloud projections matched.
Exact evidence and the remaining owner-device limits are recorded in
[validation](project/VALIDATION.md).

Donna completed two real Claude roadmap requests, a three-request expert panel, and two further reviews for Daftar management and its application directory. Their recommendations are accepted as planning evidence; release checks have separate receipts. The current delivery adds adaptive panels, five reusable research lenses, a VS Code client, a private signed-in website, explicit conflict-aware desktop sync, and the shared working-studio redesign.

| Outcome | Owner | Current acceptance |
| --- | --- | --- |
| Decision panel DAG and research staff reuse | Donna / Research & Knowledge | Real provider artifacts, native lifecycle tests, whole-panel budget and explicit evidence decision |
| Thin VS Code client | Platform engineering | Published VSIX, 11 protocol tests and six isolated installed-host checks passed; owner-session acceptance remains separate |
| Private website and saved cloud chat | Cloud platform | Deployed owner-private Sites app, D1 migrations, server API and live Claude handoff |
| Explicit desktop communication | Platform engineering / QA | Live queued-command/native-effect and bidirectional supported-scope chat checks passed; final release-binary restore and restored-device sync passed with matching projections and no duplicate messages; group-chat import remains separate |
| Compact shared studio | Design Studio / QA | Shared composer, hierarchy, blueprint, whiteboard and decision room; 192 renderer assertions, real packaged-form acceptance and cloud UI fixture passed; final captures retain their review evidence |
| Timed permissions and promotions | Donna / Security | Scope, expiry, live parent revocation, default-deny managed policy, native side-effect checks and cross-office regression |
| Private application catalog | Directory steward | Recorded repository/Site sources, separate dates, unconfirmed associations, revision checks, bounded URL validation |
| Figma and OpenPencil handoff | Design interoperability lead | Official per-client authentication path; real bounded HTML → `.fig` → SVG smoke with no network or provider calls |
| Security learning reference | Shared Security specialist | Source-reviewed Clouds Against Humanity guide, three beginner primers, explicit lab status and synthetic access-control exercise |

See [connected release evidence](project/CONNECTED_RELEASE.md), [editor/cloud setup](project/EDITOR_AND_CLOUD.md), [panel design](project/DECISION_PANELS.md) and [management controls](project/DAFTAR_MANAGEMENT.md).

## Earlier accepted baseline

| Area | Implemented behavior | Acceptance evidence |
| --- | --- | --- |
| First company | GitHub employee verified and registered Engineering Intelligence Atlas through the local MCP server | [Registration receipt](project/MCP_REGISTRATION.json) |
| Company portfolio | Public account discovery; authenticated owner-only public/private import; per-company office, departments and permanent role records | Importer tests, native provenance/hierarchy tests; private account state is excluded from this repository |
| CEO and shared services | Explicit company groups, reusable employee IDs, scoped contracts, granted knowledge references, company/group/global roadmaps and department ownership | 44 native tests; private owner plan applied; 125 renderer checks |
| Role and reference routing | 21 compact role briefs, dedicated guides, task packets and bounded samples; only selected role context enters a job | Claude-created loader reviewed and tested; role path/privacy checks |
| Parallel maintenance | Two worker slots with atomic reservations; commit-pinned GitHub review schedules and preserved proposal handoffs | Worker, maintenance and post-generation capability-revocation regressions |
| Donna workspace | One chat surface with company/office/department/employee scope; local plans are labeled separately from provider replies | Renderer behavior checks and native chat provenance tests |
| Office blueprint | Persistent rooms, employee desks, keyboard/pointer placement, employee selection and accessible list alternatives | Blueprint reference validation and renderer tests |
| Whiteboard | Owned boards map goals/jobs and portfolio roadmap items back to employees and office rooms | Native ownership checks and renderer tests |
| Goals | Plan/execute modes, dependency-ordered work, checkpoints, bounded iterations, explicit review or autonomous policy | Native DAG/cycle/loop tests and worker integration |
| Budgets | Global USD/token reservations across Office and local Projects; early warning; waiting state before new calls; retained estimates after uncertain charges | Native atomic admission and independent GlobalBudget tests |
| Cache/context | Pinned skill briefs, compact handoffs, artifact hashes, exact-context local output cache and bounded server prefix cache | Worker tamper/scope invalidation and backend cache tests |
| GitHub versions | Branch inventory, compare, reviewed/autonomous text changesets, expected-head publication without force | Fixed-host mocked API tests and branch audit |
| Personal browser | Same private desktop controls through an authenticated loopback server, expiring launch links and HttpOnly session cookies | Real HTTP/auth/host/origin/concurrent-start tests |
| Secure credentials | OS-backed vault, metadata-only status and native credential-file import for Anthropic, OpenAI and GitHub | Vault, parser, sender and browser transport tests |
| Web foundation | Portable static assets, lazy research routes, recovered SQL migrations, indexed handoff lookups, explicit integration-test gates | Web check/build/test, SQL consistency checker and CI |
| Releases | Native Rust helper, desktop build/package scripts, public starter preview, Android source sync and CI | [Validation](project/VALIDATION.md) records actual completed checks |

## Next milestones

### 1. Validate the installed personal workspace

- Run the verified published application on the owner's actual laptop, restore the verified personal archive, and import credentials into that machine's keychain. Installed desktop/editor CI and final restored-device API sync passed; actual owner-device acceptance remains separate.
- Complete the owner's production browser sign-in and editor connection, preserving the explicit-sync and single-writer rules.
- Reconnect GitHub with the owner's token, refresh all repositories, and verify private-company visibility from that machine.
- Exercise a small provider-backed goal with observed accounting, a deliberately exhausted global budget, and a deliberate resume.
- Exercise a changeset against a disposable branch, verify resulting CI, then use the selected approval policy for routine work.
- Keep the current known limitation explicit: closing the desktop app stops the local scheduler and private browser endpoint.

### 2. Broaden execution adapters without creating a second work ledger

- Add isolated code-execution environments with explicit repository mounts, network capabilities, output limits and reusable checkpoints.
- Integrate a hosted OpenAI/Claude agent harness only behind a tested adapter mapping sessions, child jobs, tools and usage into the existing goal ledger.
- Add provider-specific effort/task-budget controls after model-level compatibility and cost tests. Prompt guidance does not replace admission checks.
- Add incremental streamed artifacts for interrupted long outputs, with explicit completion and accounting status.

### 3. Improve persistence and background operation

- Profile the personal workspace before replacing its bounded, locked atomic state file. Introduce SQLite migration if larger portfolios or job history make whole-state persistence a measured bottleneck.
- For the separately deployed MySQL web runtime, add distributed leases, an outbox and crash-recovery tests before running multiple schedulers.
- Add an opt-in operating-system background worker, wake/sleep recovery and explicit app/daemon lifecycle controls.
- Add reconciliation against provider billing exports and retention/compaction policies for artifacts, chat and activity.

### 4. Package across platforms

- Validate Windows and macOS builds and their native credential stores.
- Add signed releases and an authenticated update channel; unsigned local builds are not a signed production installer.
- Android verification and debug APK packaging passed in the final [v0.5.0 run](https://github.com/occult-kranti/engineering-intelligence-atlas/actions/runs/44860194825). Complete emulator/device interaction flows and signing before a production mobile release.
- Benchmark an optional Tauri shell against Electron before choosing a full migration. Rust currently owns the native control core; this release is not a complete Rust UI rewrite.

## Completion rules

A role definition is not an active model process. A plan is not an executed job.
A saved artifact is not a passing build. A local build is not a published release.
Every completed milestone links to its actual evidence, and blocked verification remains visible.
