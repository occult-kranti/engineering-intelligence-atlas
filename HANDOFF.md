# Daftar maintainer handoff

## Active delivery: 0.9 primary VS Code workspace

The VS Code extension package metadata is now **0.9.0**. This section describes
the current source and packaging work; it is not a release-publication receipt.
The earlier release sections below retain their historical evidence. Do not apply
their test counts, package hashes or deployed-site claims to the 0.9 source tree.

**Final installed Linux and Windows package CI is pending. The owner's Vast
instance remains stopped.** No real GPU diagnostic, model-weight loading,
design-software installation or ChatGPT MCP registration is established by this
source delivery. Resume compute only on the owner's request, then verify current
connection details and the actual GPU/runtime before choosing workloads.

The [primary VS Code product guide](project/VSCODE_PRIMARY_PRODUCT.md) describes
build commands, runtime placement and acceptance. The
[host-control checkpoint](project/HOST_CONTROL_VALIDATION.md) and
[SSH/tmux runbook](deploy/SSH_TMUX_AUTOCONTROL.md) document the underlying durable
jobs and owner policy. These additions are outside the published 0.8.0 binaries.

### Current source behavior

The extension opens the shared compiled desktop office renderer in a full editor
tab. Companies, departments, employees, Donna, blueprints, the conference table,
projects and management forms remain elements of the same continuous canvas. The
activity-bar view is the entry point. The VSIX packages the renderer asset graph,
portable Node backend and matching native binary for its target platform; it does
not require the Electron desktop application to provide the backend.

| Runtime entry | Ownership and lifecycle |
| --- | --- |
| Start Workspace on This Host | Starts an editor-owned backend on the current extension host; shutdown follows editor disposal |
| Start Persistent Workspace in tmux | Linux path; starts a separately supervised daemon that remains after editor detachment |
| Connect Private Runtime | Connects an existing owner-authenticated service; editor closure does not own its lifecycle |
| Connect Vast.ai / SSH Compute | Lists existing instances and uses strict-host-key SSH forwarding to an already-running private runtime; a stopped instance remains stopped |
| Connect Desktop / Website | Retains existing pairing workflows; website commands remain queued until their native outcome is confirmed |

In a VS Code Remote-SSH window, workspace extension execution places the backend
on that remote host. A separate terminal login does not attach this chat or move
ChatGPT onto a GPU. The extension's `atlas.hostControlEnabled` setting exposes
Linux host capabilities; initial host policy remains **off**. It does not enable
automatic approval in ChatGPT, VS Code, the OS or the hosting provider.

The Cloud Compute Operator role can be hired or reused as a native employee.
Donna's compute controls capture requirements and assign actual company/employee
IDs, budgets and ownership. Role descriptions and source-index/observer services
do not confer permissions or constitute extra model hires. Native eligibility and
any applicable shared-service contract remain mandatory.

### Owner controls and operations

God mode now makes one revision-checked host policy change for the exact current
active company set. It gives eligible employees and company assistants automatic
host-command admission within that recorded scope; new companies require a
refresh. It does not start jobs, enable provider workers, change budgets or start
the stopped instance. Separate controls stop managed work and inspect its receipts.
The [operations guide](project/OPERATIONS_CONTROL.md) describes the full setup flow.

The canvas includes a movable Setup flow popup and native controls for connector
readiness, permanent operations roles, model ownership, managed environments and
design installation plans. Runtime Observer, Knowledge Steward and Connector
Steward join the Cloud Compute Operator as hireable permanent role definitions.

The private activity journal retains up to 1,000 metadata observations within
1 MiB, supports scoped cursor queries with retention-gap reporting, and provides
deterministic summaries with a 64-entry cache. It stores no prompts, command text,
outputs or credential fields. It complements the native action/budget ledger.
Uncertain journal writes preserve completed operation receipts and expose degraded
status rather than inviting duplicate execution. Worker idle/error polling backs
off to 120 seconds; explicit one-shot execution remains immediate, and disposal
clears timers and owned requests. This is bounded cleanup evidence, not a proof
that every possible memory leak is absent.

### Managed compute, environments and model sharing

Host control uses explicit revision-checked off/manual/auto policy and grants.
The owner credential authorizes a trusted OS account; company/employee selectors
record attribution and managed policy. They are **not independent tenant
authentication or hostile-user isolation**. An auto host grant permits arbitrary
commands with that OS account's privileges. Root inside a rented container is not
control of the provider's physical host. Jobs retain stable IDs, timeout/output
bounds and durable receipts. Unknown outcomes are inspected rather than rerun;
`stopAll` blocks dispatch and requests cancellation of managed jobs without
killing unrelated processes.

Managed Python jobs prepare private copied virtualenvs and verify interpreter
identity and prefix before execution. `environment_run.command` is Python source,
not shell text. Runs use the verified interpreter and scrubbed environment with
`PIP_REQUIRE_VIRTUALENV`/`PYTHONNOUSERSITE`; there is no automatic global package
installation or requirements installer. System administration is an explicit
host operation. A submitted preparation job must not be presented as a ready
environment until its proof is verified.

Model resources register verified installed Ollama digests and explicit `use`,
`assign` and `inspect` grants across canonical company/office/department/employee
scopes. The first explicit configuration enables enforcement for old HTTP/model
selection, workbench, MCP and managed worker paths. Unscoped Ollama projects are
blocked at start/resume and before another generation once enforcement is active.
Budgeted OpenAI/Anthropic project runs remain available. Owner-directed catalog
downloads may stage weights before registration; staged bytes grant no execution
authority. Digest drift, revoked eligibility and uncertain policy persistence fail
closed. Descendant grants capture reviewed membership and do not silently expand
after new children or reparenting. Native companies/departments have hierarchy;
office parent grouping remains a validated resource-view sidecar.

Single-expert and bounded ensemble plans enqueue native dependent jobs with
employee/resource provenance and artifact receipts. They support up to four
experts and optional synthesis. They are **request routing and ensembles, not
newly trained MoE models**. Shared bytes reside in the current host's model cache;
automatic replication between VPSs and new MoE training are not implemented.

The design-toolchain catalog covers Blender, Godot 4, Penpot, Krita, GIMP and
Inkscape. Plans are dry metadata operations. Blender/GIMP/Krita/Inkscape require
exact signed Debian/Ubuntu package versions and an already-root container
runtime; Godot uses an exact official release artifact and reviewed SHA-256.
Installation is a separately requested host job with verified proof. Penpot
remains blocked pending a reviewed Compose deployment with pinned image digests.
These application runtimes are separate from maintained project Python
virtualenvs. They do not install Figma/Photoshop, create a graphical desktop or
demonstrate GPU rendering. See [the design runbook](deploy/DESIGN_TOOLCHAIN.md).

### Interfaces, credentials and final acceptance

The packaged stdio runtime adapter exports **35 MCP tools**: office/runtime/worker,
model pool, host control, managed environments, model resources and design
toolchain. The [MCP guide](tools/DAFTAR_RUNTIME_MCP.md) lists every tool, exact
managed API shape and receipt flow. Port 8788 serves authenticated REST, not HTTP
MCP. The editor's MCP command copies configuration containing a protected token
file path. A supported transport and account-authorized registration are still
needed to connect that bridge to ChatGPT.

The webview has a bounded method allowlist and no direct network capability.
Provider/cloud credentials use native prompts, remain outside canvas storage,
and are bound to the selected connection. Connection epochs reject stale results.
Runtime-client deadlines settle stalled fetch/read adapters, late bodies are
cancelled, and uncertain POSTs retain their original identity without an automatic
retry. Exact control credentials are removed from returned text; identity
collisions are rejected rather than silently rewriting IDs. Persist only bounded
view geometry/theme state, never form credentials, grants or command drafts.

| Remaining acceptance | Status for this source delivery |
| --- | --- |
| Installed Linux VSIX, packaged backend and persistent tmux workflow | Final CI pending |
| Installed Windows VSIX and packaged native/backend lifecycle | Final CI pending |
| Actual Vast GPU/driver/model workload and long-run memory behavior | Not performed; keep the instance stopped |
| Actual application installation, desktop/display and GPU rendering | Not performed |
| ChatGPT account MCP registration and end-to-end tool call | Not established |

The new local tests cover native/HTTP/stdio managed paths, resource revocation and
digest checks, duplicate/uncertain receipts, policy-write faults, legacy route
gates, stalled client I/O and repeated lifecycle cleanup. They do not prove
universal absence of memory leaks or replace the installed Linux/Windows gates.
Record the exact tested commit, final CI jobs and resulting package digests before
claiming release acceptance; retain historical receipts unchanged.

## Product contract

Daftar is an owner-operated personal agent office. Donna is the single user-facing
coordinator. The conference table, office blueprint, conversation, whiteboard and
management forms are elements of one continuous canvas, exposing the same company,
employee, goal, job and artifact records. Ordinary hiring, layout, queue, cache,
policy and schedule changes are deterministic local operations and do not consume
provider tokens.

The original research atlas, 109 role charters, 15 skill packages, local model
manager, project runner and Android source remain available. The architecture is
Electron/TypeScript with a Rust state and control core, plus the deployed owner-private Sites/Vinext/D1 companion. The earlier
React/TypeScript/MySQL runtime remains available as a separate deployment option.

## Endless canvas 0.8.0 — released handoff

PR #2 merged as `ad9620425ce7b665735bffb2af5e374746516433`, with the same source tree as tested head `d4f46c169ddd346e6538c02c282f853debf360f1`. All eleven required verification jobs, release publication and Pages passed. Checks include 643 desktop tests, 361 renderer assertions and real native Linux/Windows package operation. Version 0.8.0 is published; its five package digests match the independently downloaded manifest. The matching private website is deployed and its owner session was reviewed. [The publication receipt](project/release-0.8.0.json) and [validation record](project/ENDLESS_CANVAS_VALIDATION.md) identify exact source, browser, deployment and remaining owner-device acceptance.

The renderer uses `freeflow/universe.ts` to compose the conference table, bounded previews of actual saved blueprints on the tabletop and the selected company's full blueprint in the same coordinates. `freeflow/workspace.ts` and `freeflow/canvas-workspace.ts` manage panel geometry, focus, keyboard movement, resizing, pinning, collapse and device-local persistence. All 36 existing forms belong to the canvas; their live elements preserve handlers and drafts. Geometry storage must never become a store for credentials, field values or access grants. Keep the surface finder and Home route usable after malformed or unavailable storage.

The Studio retains an explicit panel camera chosen before the first snapshot only for its initial scope. Later company navigation retains normal camera restore/fit behavior; startup deep links frame their requested surface after asynchronous scope resolution. Preserve the first-brief browser check, the 24 CSS-pixel visible send-button floor, scrollable conversation history and the 400-world-unit default Donna height. Navigation among panels must also preserve unsaved policy forms and reject stale scope reads.

`freeflow/donna-team.ts` is a pure crew projection and typed action planner. It resolves current employee IDs, company/office/department assignments and scoped service contracts. Malformed grants fail closed; saved employees and running job evidence remain separate. Scoped commands still pass through native authority. Draft goals do not launch provider requests; resuming a scope can admit already authorized queued work. Runtime source/ledger services are deterministic and do not represent additional model hires.

The [Source Review service](project/SOURCE_REVIEW.md) operates in managed GitHub reads and OfficeWorker prompt preparation. Review artifacts contain hashes, coverage and findings without raw source excerpts. Provider results and failures retain review references through the existing job/ledger path. The standalone public-read policy supports an exact-URL advisory robots decision, but no general website fetcher or crawler is wired to it.

In the website, top-level owner `/`, `/access` and `/applications` entries resolve into the canvas only after a successful owner session probe. `?canvas=1` retains the original compact form within a same-origin canvas element. Signed-out, failed-session, visitor and invitation flows remain usable without owner redirect loops. Preserve company queries, permitted deep links and invitation fragment consumption when editing either side. There is no cross-origin messaging bridge.

The Kimi handoff is an additive archive at a separately verified commit. Its coordination ideas inform current original code; its old file store, runtime and binaries are not installed over the Rust-backed product. [The public audit](project/KIMI_BRANCH_REVIEW.md) records exact file/line counts, package evidence and unverified historical test claims. Sonnet authored the universe compositor and tests through a bounded public-source request; independent integration review remains distinct from that provider receipt.

For a renderer change, build `desktop-shell`, regenerate the public static preview, sync the shared renderer into `cloud-workspace`, then run the relevant DOM/browser and package gates. The release workflow takes the version from `desktop-shell/package.json`. Desktop, VS Code, Android and cloud app metadata is 0.8.0; native/MCP/headless protocol versions remain independent. Do not replace a published tag or reuse historical CI counts for a new source tree. On the currently saved owner runtime projection, Source Review and Ledger observer correctly display **Not configured**; deploying the renderer does not configure a native service or launch a worker.

## Freeflow 0.7.0 — released

Published source `9ac0080` passed all eleven verification jobs, release and Pages. The [publication receipt](project/release-0.7.0.json) records package hashes, actual browser/container/desktop checks and owner-private website acceptance.

The unified source includes the Freeflow renderer, nested company/department organization, visiting-member API and pages, shared local model control, permanent deterministic observer, headless runtime and optional encrypted cloud-device synchronization. See [the current validation receipt](project/FREEFLOW_VALIDATION.md) for exact checks and deployment status.

A configured VPS can consume the existing website queue through an owner-issued desktop-kind device pairing. Preserve a single writer, restore matching state before the first connection, and review any conflict. [Cloud migration instructions](deploy/CLOUD_DEVICE_SYNC.md) explain device revocation/release and cold-start checks. The shared model registry is host-local and separate from the Site projection; download/assignment controls are exposed in the native/personal-browser UI and private MCP/HTTP bridge.

`node scripts/reconcile-company-hierarchy.mjs --help` describes additive hierarchy setup from saved portfolio groups. It defaults to a private plan, preserves custom parents and applies through native command receipts. No repository source or private company record belongs in the public preview.

The daemon starts paused. No host rental, GPU benchmark, model-weight download or real ChatGPT tunnel is implied by source delivery. Public OAuth, isolated arbitrary-code runners and an installed owner-device check remain separate work.

## Company kits 0.6.1 — released

The reusable catalog is [company/company-kits/index.json](company/company-kits/index.json); [the installer guide](company/company-kits/README.md) specifies preview, apply, limits and restart behavior. Run it against the same private company-state directory used by the desktop. It adds records through the native command boundary and never runs the global optimizer or replaces existing groups. Client/source data belongs in a private plan; public templates and installers contain generic guidance only.

Recovery bindings are persisted knowledge metadata. Native/cloud prompt selection and the human knowledge/index views must filter those records before applying their display/context limits. Native workers additionally resolve the selected employee's `prompt-<key>` task contract through validated same-company bindings. Full documents are references, not automatically fetched content; role metadata does not grant capabilities. Keep these contracts aligned if the binding schema changes.

The existing explicit desktop sync protocol carries the companies into the private website and editor. Desktop installation still requires restoring the latest private archive and reconnecting credentials on the actual device. Social APIs, campaign scheduling and hackathon enrollment remain distinct operations; their operating guides must not imply connected accounts or externally completed work.

## Command studio 0.6.0 integration

Daftar 0.6.0 adds Violet studio / Golden drafting themes, a scoped ownership hierarchy, roadmap status lanes, derived heat maps and the same Donna conversation docked beside visual work. All seven CI gates, release publication, Pages and the owner-private website deployment passed. The [release receipt](project/release-0.6.0.json) records exact source, downloadable hashes, browser measurements and remaining acceptance boundaries.

Theme and heat-mode settings stay in local presentation storage. They do not write the native state, spend tokens or enqueue cloud commands. Both website routes and the shared renderer use `daftar-studio-theme`. The desktop/browser view uses `daftar-studio-heat `. Existing archives, native identity and D1 schema remain unchanged. Heat maps use actual snapshot receipts, explicit unknown states and labeled job allowances, not unmeasured utilization or company budgets.

After a renderer edit, build `desktop-shell`, regenerate the static preview, and run `cloud-workspace/scripts/sync-desktop.mjs` from the cloud directory with the absolute repository path. This updates content-addressed assets and the cloud app's shared token stylesheet. The authored cloud bridge is `cloud-workspace/scripts/cloud-bridge.js`. See [studio decisions](project/STUDIO_REDESIGN.md), [signal contract](project/OFFICE_SIGNALS.md) and [color contract](project/STUDIO_COLOR_SYSTEM.md).

## Install a published build and restore personal work

The current verified application release is [v0.8.0](https://github.com/occult-kranti/engineering-intelligence-atlas/releases/tag/v0.8.0): Linux x86_64 AppImage, Windows x64 NSIS/ZIP, VS Code VSIX and Android debug APK. Exact release source is [`ad96204`](https://github.com/occult-kranti/engineering-intelligence-atlas/commit/ad9620425ce7b665735bffb2af5e374746516433). All required verification jobs, release and Pages passed. The independently downloaded 479-byte checksum manifest matched all five package digests in GitHub metadata; package binaries were not redownloaded in that comparison. Linux and Windows packaged applications exercised the real native core in CI. [The receipt](project/release-0.8.0.json) separates those checks from signed-installer, owner-device and keychain acceptance.

The latest private recovery export passed checksums and isolated restore with only documented artifact-path relocations. Existing destination worker settings require review because restore preserves policy fields. Public packages exclude personal records and keys. Android carries the research atlas; the native Office runtime runs in the desktop or configured Linux headless service. The Android version bump does not add that runtime to the APK.

For a private workspace archive, first launch the desktop app and find its user
data directory in Models & system. Close the app, then run the release's restore
script from a matching source checkout:

```bash
python3 scripts/restore-personal-workspace.py \
  --archive /path/to/Atlas-personal-workspace.zip \
  --user-data-path /path/to/application-user-data
```

The destination is the application directory, not its `company` subdirectory.
Existing state is preserved unless `--replace` is specified; replacement creates
a timestamped backup. The tool verifies checksums and references before writing.
Reopen Daftar, reconnect credentials in Settings and review the paused schedules.
The archive's `PORTFOLIO.md`, `companies/` records and `RESTORE.md` provide readable
roadmaps and detailed restoration instructions.

For a new export, `--artifact-root` must point directly at the managed artifact
directory, such as `/path/to/user-data/office-artifacts`, rather than its parent
runtime directory. The final release rehearsal restored every included managed
artifact with no missing references or embedded credentials. Its pairing test
used AES-GCM test storage; the destination laptop still needs its own OS-keychain
and provider-credential setup.

## Start from a clean checkout

Use Node 22.13+ and a current Rust stable toolchain. From the repository root:

```bash
npm --prefix site-source ci
npm --prefix desktop-shell ci
npm --prefix android-shell ci
npm --prefix site-source run check
npm --prefix site-source run check:migrations
npm --prefix desktop-shell run build:native
npm --prefix desktop-shell run build
node scripts/build-static.mjs
npm --prefix desktop-shell run sync-atlas -- --src ../docs
npm --prefix android-shell run sync:atlas -- --src ../docs
npm --prefix desktop-shell start
```

For Linux packaging, run `npm --prefix desktop-shell run package:linux` after
syncing the atlas. Native builds use the host target. A Linux binary does not
establish Windows/macOS compatibility or signature status.

The public website is built in static mode. `site-source/dist/boot.js` and secrets
are never copied into `docs/`. The public desktop starter preview is compiled
from the actual renderer and contains only the isolated starter workspace.
Private company catalogs and credentials must never be copied into that preview.

## Private website and VS Code

Open [Daftar](https://atlas-command-office.whatswrong-inc.chatgpt.site) and sign in with ChatGPT. The public GitHub Pages view links to this private runtime; provider keys never enter the static website.

The website saves its office snapshot and cloud conversation in D1. Native repository work, job execution and files remain on the connected desktop or configured VPS runtime. Restore the supplied personal workspace before first pairing so a fresh empty runtime cannot overwrite an existing cloud portfolio. Create a desktop pairing on the website, paste it into Settings → Account & cloud connection, and choose **Sync now**. Connection itself does not upload or start an unattended loop. A conflict preserves both sides until reviewed.

Install the published `atlas-office-0.8.0.vsix` through VS Code → Extensions → Install from VSIX. Run **Daftar: Connect to Desktop** for the local application, or **Daftar: Connect to Signed-in Website** for cloud chat and queued controls. Local pairing links expire after five minutes and may be consumed once. Website devices can be revoked from the signed-in page. The installed VSIX passed its isolated CI activation checks; the owner's editor session and credential store remain a separate setup context.

Cloud model calls use a separate atomic admission ledger funded by an allocation held in the native global budget. Do not release that allocation while the cloud runtime can still spend it. Unknown provider outcomes keep their reservations. [Full protocol and verification](project/EDITOR_AND_CLOUD.md).

## Credentials and private GitHub

Use Settings → provider credentials → Import file, or the password input. The
native file chooser reads the selected file in the main process and writes only
to the OS-backed encrypted vault. Renderer responses expose configured/readable
status, never a key or suffix. Linux's `basic_text` fallback is rejected.

Accepted files contain one key, a matching environment assignment, or a JSON
object with a single matching credential. GitHub supports `GITHUB_TOKEN` or
`GH_TOKEN`, Anthropic supports `ANTHROPIC_API_KEY`, and OpenAI supports
`OPENAI_API_KEY`. Do not commit those files or distribute a package with them.
The destination laptop must import its own keychain copy; encrypted blobs from a
different operating system are not portable credentials.

Private repository import verifies the credential's authenticated user against
the requested owner, completes bounded pagination before local writes, and keeps
private metadata in personal state. GitHub steward publication validates text
paths, rejects credential material, checks the expected branch head, and uses a
non-force update. A failed/ambiguous write is not automatically retried.

## Runtime and state boundaries

- `desktop-shell/src/main/office.ts` is the main-process Office service; renderer callers cannot claim jobs, reserve money, forge provider replies or write settlement records.
- `native-core/` owns hierarchy, goals, layouts, scopes, policy, reservations, checkpoints and event records. OS locking and atomic replacement protect the shared state file across processes.
- `desktop-shell/src/main/officeWorker.ts` runs one admitted request per worker; the application pool has two slots sharing the same reservation ledger. It starts disabled; Start dispatcher or Run one enables actual work. Schedules and goal loops advance while the dispatcher is running.
- `desktop-shell/src/main/globalBudget.ts` shares the same admission ledger with the older local Project runner.
- `desktop-shell/src/main/personalDashboard.ts` serves the same renderer on `127.0.0.1` with expiring one-use launch links, authenticated cookies and strict host/origin checks. Closing the desktop app closes this endpoint.
- `tools/atlas-mcp.mjs` exposes stdio MCP operations over the same Rust core. Set `ATLAS_STATE_DIR` to the desktop's actual `userData/company` directory to share one workspace. Its default headless directory is separate.
- `cloud-workspace/` is the deployed private website with ChatGPT sign-in, D1 persistence, bounded cloud chat and the desktop command relay.
- `site-source/api/` is a separate authenticated web runtime, requiring the database/environment described in [site-source/README.md](site-source/README.md). GitHub Pages cannot run this server.

## MCP setup

Build the Rust core first. A client can launch:

```json
{
  "mcpServers": {
    "atlas-office": {
      "command": "node",
      "args": ["/absolute/path/to/engineering-intelligence-atlas/tools/atlas-mcp.mjs"],
      "env": {
        "ATLAS_STATE_DIR": "/absolute/path/to/desktop-user-data/company"
      }
    }
  }
}
```

For a reproducible CLI request:

```bash
node tools/atlas-mcp-client.mjs company_snapshot
node tools/atlas-mcp-client.mjs company_register '{"repository":"occult-kranti/engineering-intelligence-atlas"}'
node tools/atlas-mcp-client.mjs office_snapshot
```

The MCP public GitHub importer does not contain credentials or perform model
inference. Authenticated private discovery and managed changeset publication use
the desktop main-process integration. Tool results and repository documents are
data, not authority to expand permissions.

## Goals, approvals and budgets

Review mode requires per-job approval; Autonomous mode admits scoped work without
repeated app approval. Neither mode bypasses the configured global limits,
repository protections, OS permissions or host-provider access controls.

A goal starts as a plan. Execute materializes its DAG with concrete employees and
limits. Successful attempts create immutable checkpoints and concise scoped chat
returns. Autonomous loops stop at their iteration/time target, a failure, an
accounting hold, a paused hierarchy or the global ceiling. Past evidence is
retained. A failed billed request is never automatically replayed.

The application default global cap is $10 with an 80% warning threshold. It is an
owner-editable app policy, separate from the $100 authorized development budget
recorded in [Claude usage](project/CLAUDE_USAGE.md). Prices must be positive for
cloud calls. Global admission reserves a conservative input/output upper bound
before dispatch; uncertain charges retain a hold. Warnings are advisory, caps
stop new admissions, and already admitted requests may finish.

Goal time targets are checked between iterations. Individual requests also have
a bounded transport timeout. An aborted network wait does not prove provider
processing or billing stopped. Returned artifacts are saved even if usage is
missing or a later publishing action fails.

## Cache and prompts

Compiled server prefixes use bounded scoped caching and include role/skill hashes.
Dynamic task context remains in a compact suffix. Office output reuse requires
matching company, employee, provider, model, prompt version, allowance, task,
knowledge and dependency artifact hashes, plus an intact managed artifact file.
Jobs with external publishing capabilities never reuse an output to repeat a
side effect. No secret is part of a prompt-cache key or published build.

Prompts request deliverables, concise decisions, evidence and handoffs, not raw
private reasoning. Provider-specific task budgets and effort modes are distinct
from application spending limits; see [the research](project/PROMPT_BUDGET_RESEARCH.md).

## Historical 0.5.0 acceptance record

The 0.5.0 released source is
[`0b87469ba14864959bd5ec70dd323ce909904faa`](https://github.com/occult-kranti/engineering-intelligence-atlas/commit/0b87469ba14864959bd5ec70dd323ce909904faa).
[Verify 44860194825](https://github.com/occult-kranti/engineering-intelligence-atlas/actions/runs/44860194825)
passed all seven gates and the release job, which completed at
`2026-11-21T03:18:11Z` (20 November, America/New_York). The separate
[Pages run](https://github.com/occult-kranti/engineering-intelligence-atlas/actions/runs/44860194823)
also passed. The release was published at `2026-11-21T03:18:09Z`; all three
downloaded artifacts match their published digests. Final restore and production
pairing passed at `2026-11-21T03:20:41.131Z` using the published Rust helper, with
no duplicate messages or provider calls. The verification device was revoked
and its writer assignment released afterward. See
[the release record](project/release-0.5.0.json) and validation for the receipts
and owner-device acceptance limits.
The separate hosted website deployment of
source `03b9264757c38ae86689cc03f23defed39383498` succeeded at
`2026-11-21T03:00:33.507277Z` (20 November, America/New_York).

The first candidate exposed two real acceptance failures: ambiguous directory
select labels and a desktop form whose default USD values violated its min/step
rules. Explicit filter labels and aligned numeric steps are now implemented;
the 192-assertion renderer suite includes default-value regressions. The later
strict workspace-redirect assertion now accepts exactly the supported paths and
preserves scope/DOM checks. Generated public preview assets are content-addressed
to prevent stale HTML/CSS combinations, and the smoke scripts prefer the
installed Playwright browser after a system-browser timeout. The final release
passed the packaged form, cloud UI and browser gates; prior failures remain in
[validation](project/VALIDATION.md) rather than being described as passing runs.

See [validation](project/VALIDATION.md), [panel decisions](project/PANEL_DECISIONS.md),
[worker ledger](project/WORKER_LEDGER.md), [timeline](TIMELINE.md) and
[roadmap](ROADMAP.md). Repeat only the gates relevant to a subsequent change;
never report skipped live-service checks as passing.

## CEO portfolio application and reusable services

The current [management guide](project/DAFTAR_MANAGEMENT.md) documents timed scope grants, temporary promotions, Donna's bounded delegation, the private application directory and Figma client connections. Expired or revoked grants do not restore a managed employee's legacy permissions. Renew the intended scoped grant from CEO controls when a time-limited assignment needs to continue.

The additive native `portfolio` record holds CEO settings, application groups, services, contracts, granted knowledge references and owned roadmap items. Repository companies remain immutable source identities. `optimize_portfolio` creates the common service office, reuses existing matching employee IDs and contracts them to explicitly grouped recipients. `pauseRedundant:true` pauses only idle duplicate specialties without owned work; the operation never deletes employee or evidence records. A repeated operation preserves revoked/paused contracts and existing identities.

The owner plan was prepared from imported repository README snapshots and applied privately with `scripts/apply-portfolio.mjs`. It creates company-specific inferred next steps and group coordination outcomes. Real names and URLs of private repositories are absent from public presets, tests, documentation and preview data. Each role guide links input/output schemas, examples, acceptance checks, tool boundaries and the next handoff; its selected brief and digest enter the prompt cache identity.

Two Office worker slots share the atomic native claim/reservation ledger. Dependencies, hierarchy pauses, group state, service contracts and knowledge grants gate admission. Managed GitHub publication rechecks current authorization after model work, including home/service groups and selected knowledge revocations. An ambiguous provider failure retains estimated tokens and USD; a global budget wait preserves prior artifacts and checkpoints.

The review scheduler is a managed, bounded proposal workflow. `schedule_repository_reviews` creates idempotent daily templates with a named model, current rates, 48,000 total tokens and $0.25 maximum per job. UI setup creates them paused; the owner can resume schedules and the dispatcher under the saved policy. GitHub reads stay on the fixed API host and pin README content to a verified head. A completed review is saved as a labeled model proposal in company knowledge. It does not claim builds ran or automatically publish changes. A separate publishing-capable job must prepare a validated changeset against the current branch head.

A desktop closure stops the scheduler; persistent definitions are not OS daemons. Browser-extension samples are source and tests, not an installed extension or permission to inspect an unrelated signed-in session. Art, geometry and music materials are role references and small examples, not assertions of cultural or medical effects.
