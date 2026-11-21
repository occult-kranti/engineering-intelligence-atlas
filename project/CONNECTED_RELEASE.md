# Daftar connected office · 0.5.0

Daftar is the new product name for the personal company and agent workspace in this repository. The repository URL, native data format, API paths and existing Atlas package identifiers remain stable for compatibility. The public research atlas remains available alongside the private operating product.

This document explains the integrated architecture and accepted decisions. [VALIDATION.md](VALIDATION.md) is the authority for executed build, installation, provider, browser and publication checks. A feature described here does not substitute for an acceptance receipt. Historical 0.4.3 results remain historical.

Release checkpoint: **20 November 2026 (America/New_York)**. All seven verification gates and the release job passed; the release was published at `2026-11-21T03:18:09Z` and the release job completed at `2026-11-21T03:18:11Z`. All three downloaded assets match their published digests. Final owner-archive restore and production pairing passed at `2026-11-21T03:20:41.131Z` using the published Rust binary. Exact evidence timestamps below stay in UTC.

The [v0.5.0 release](https://github.com/occult-kranti/engineering-intelligence-atlas/releases/tag/v0.5.0)
is built from exact GitHub source
[`0b87469ba14864959bd5ec70dd323ce909904faa`](https://github.com/occult-kranti/engineering-intelligence-atlas/commit/0b87469ba14864959bd5ec70dd323ce909904faa).
[Verify 44860194825](https://github.com/occult-kranti/engineering-intelligence-atlas/actions/runs/44860194825)
passed web, MySQL, desktop, Android, cloud, editor and design gates plus release.
The separate [Pages run](https://github.com/occult-kranti/engineering-intelligence-atlas/actions/runs/44860194823)
also passed. Final delivery receipts and download hashes are in
[validation](VALIDATION.md) and the [release record](release-0.5.0.json). Later documentation-only
commits do not change the release's code tag. The latest hosted source is separately
`03b9264757c38ae86689cc03f23defed39383498`, deployed as
`appgdep_6b01094b1bf48191b53b9b012252ce89` at
`2026-11-21T03:00:33.507277Z`. The earlier live protocol receipt below retains
the deployment revision actually exercised at that time.

## Entry points

| Surface | Link or entry |
| --- | --- |
| Private application directory | [Source-linked applications and dashboards](https://atlas-command-office.whatswrong-inc.chatgpt.site/applications) |
| Private command office | [Owner-signed-in website](https://atlas-command-office.whatswrong-inc.chatgpt.site) |
| Donna conversation | [Private shared workspace](https://atlas-command-office.whatswrong-inc.chatgpt.site/workspace/chrome.html?workspace=chat#office) |
| Office blueprint | [Private spatial team view](https://atlas-command-office.whatswrong-inc.chatgpt.site/workspace/chrome.html?workspace=blueprint#office) |
| Ownership whiteboard | [Private linked roadmap](https://atlas-command-office.whatswrong-inc.chatgpt.site/workspace/chrome.html?workspace=whiteboard#office) |
| Decision room | [Private expert panels](https://atlas-command-office.whatswrong-inc.chatgpt.site/workspace/chrome.html?workspace=decisions#office) |
| CEO and management | [Private portfolio](https://atlas-command-office.whatswrong-inc.chatgpt.site/workspace/chrome.html?ceo=true#office), then Management & permissions |
| Public research and example UI | [GitHub Pages](https://occult-kranti.github.io/engineering-intelligence-atlas/) |
| Published installers and VSIX | [GitHub releases](https://github.com/occult-kranti/engineering-intelligence-atlas/releases) |

The website requires the owner's account. The public preview uses synthetic examples and disables mutations. Binaries belong to the release whose tag and checks passed; a source version bump alone does not establish a new published installer.

## Donna's completed first round

The real native worker made two separate Claude requests for the initial platform and design implementation companies. Both completed with saved artifacts and observed usage. A subsequent adaptive panel reused engineering and QA specialists, ran their reviews independently, and supplied the actual bounded predecessor artifacts to Donna's synthesis. All three panel requests completed.

The two roadmap calls cost **$0.097550** in observed usage. The three-request panel cost **$0.106378**. Together, this planning round added **$0.203928**. These are provider planning artifacts, not evidence that the provider independently executed code, tests or deployment. The accepted panel decision preserves the distinction.

| Decision | Consequence in this implementation |
| --- | --- |
| Reuse one company model and a common renderer | Desktop, website and editor refer to the same company identities and ownership records |
| Keep the editor thin | VS Code connects to native or cloud endpoints; it does not create another office database |
| Preserve native execution authority | Website operations wait in a durable queue; the desktop validates and applies them explicitly |
| Use a small review DAG | Independent experts precede Donna synthesis; whole-panel limits and explicit next-round decisions prevent open-ended loops |
| Prefer existing specialists | Shared contracts and role keys reuse stable staff identities before hiring missing roles |
| Separate claims from receipts | Model recommendations, code changes, tests, provider usage and publication remain distinct evidence |
| Preserve the working Rust boundary | Rust owns control state and validation; a full UI rewrite remains a benchmark-driven option |

The follow-on management and private dashboard-directory reviews also completed through the real native worker. Their two saved artifacts added **$0.093502**, with a **$20 cap per goal inside the existing $100 ceiling**. Later owner-authorized setup granted Donna 24-hour scoped management across the imported portfolio and retained two child promotions; that setup made no provider requests. The native authority audit and the director's integration checks remain distinct from Donna's recommendations.

## Product and state architecture

| Layer | Implemented boundary |
| --- | --- |
| Rust control core | Durable company hierarchy, goals, jobs, budgets, shared contracts, panel lifecycle, native command receipts and authority validation |
| Electron desktop | Native vault, worker dispatch, local artifacts, repository operations, explicit cloud sync and the common interface |
| VS Code extension | SecretStorage-backed pairing, company context, Donna access, team/roadmap controls and bounded panel drafts |
| Sites / Vinext Worker | Owner-private identity, cloud text chat, D1-backed state projection, paired-device access and command relay |
| D1 | Workspace revision, hashed devices, command statuses, cloud messages and atomic request accounting |
| GitHub Pages | Public atlas, documentation and read-only example renderer |

The single Donna composer remains the main interaction. Blueprint, whiteboard, decisions and CEO management are views into the same saved relationships. The design uses an editorial paper-and-pine workspace with compact laptop controls, readable status and an architectural team plan. A view label never implies live workers, saved changes or completed output that the state does not contain.

Explicit sync now transfers full supported-scope conversations in both directions. Cloud-origin company, office, department and employee messages import into native threads once per durable receipt, with cloud attribution and stable IDs; native `chatThreads` are included in the sanitized snapshot used by the website/editor history. Import does not make a provider call. The final paging cursor persists even when there is no next page. Group-scoped cloud messages remain on the website and are reported as skipped by native import.

The complete snapshot and conversations share an **8 MiB** transfer ceiling. An oversized snapshot fails clearly before upload; messages are not silently truncated. Individual imports accept the hosted text contract up to 60,000 UTF-16 code units and 240,000 UTF-8 bytes. Invalid or oversized supported messages retain their cloud text and do not advance that page's cursor. The live receipt below proves the selected test scope and retry behavior; local regression tests cover the other supported scope and size boundaries.

## Scoped management and temporary promotions

The CEO management area presents timed permission grants, temporary promotions, per-employee dispatch policy, a shared index and the authority decision ledger. The underlying native contract stores the employee, company/office/department/employee/goal scope, finite capability set, issuer, reason, grant time, expiry and revocation history.

Full authority means the supported in-app capabilities within that scope and time. Partial authority specifies a subset such as team management, work coordination, knowledge, layout, roadmap, scoped cache control, provider admission or repository operations. It is not OS administrator access, arbitrary terminal execution or access to stored secrets. Global budgets, existing approval checks and operation validation still apply.

An owner-issued grant can establish Donna's authority. Donna may delegate only within her own active scope, capabilities and expiry; she cannot promote herself. Delegated grants retain parent grant references. Revoking or expiring a parent also invalidates its descendants. Temporary titles leave the employee's permanent role intact.

Granting authority opts that employee into managed enforcement. Expiry or revocation does not silently revert them to the older per-job authorization path. A distinct owner policy action can restore that path with a recorded reason. The delegated command boundary and managed worker admission enforce the native record; a visible role title is not a capability grant by itself.

The searchable index links people, scopes, jobs, goals, knowledge, artifact references, roadmap outcomes, operations and authority. It stores metadata rather than local artifact paths or credentials. The ledger preserves applied management decisions and their reasons. Rejected requests report their actual error; they do not fabricate a successful decision or provider job. Final native and renderer acceptance belongs in [validation](VALIDATION.md).

## Research roles and adaptive panels

Five reusable research lenses extend the existing role library:

| Role | Work method |
| --- | --- |
| Newton analysis and synthesis | Derive from stated assumptions, compare against evidence and reconstruct the result independently |
| Tesla mechanism and resonance | Propose testable mechanisms and check physical constraints and alternatives |
| Research skeptic | Seek counterevidence, missing controls and competing explanations |
| Resonance advisor | Coordinate source-grounded theory and reproducible experiments |
| Paired research coordinator | Route forward derivation and reverse reconstruction, then compare disagreements |

These are contemporary agent role definitions based on the documented skill references. They do not imply historical endorsement, human peer review, a completed proof or an experimental result. The [role provenance map](../company/role-library/research-skill-map.json) records the source relationship; the [panel contract](DECISION_PANELS.md) describes selection, budgets and evidence handling.

Convene creates a draft and staff definitions without a provider call. Starting a round creates independent review jobs and a dependent Donna synthesis. Another round requires a recorded revision decision and fresh bounded admission. Accepted model consensus does not mark implementation or a roadmap item complete automatically. Completion requires its own evidence.

## Safe, explicit cross-device work

The website saves a projection rather than taking over the native database. It includes the shared hierarchy, authority and full chat threads while excluding credential fields, running lease tokens, worker identities and local artifact paths. Artifact bodies and repository file contents are not transferred by this projection. A likely credential in allowed text blocks the transfer. An 8 MiB bound limits the combined projection. Pairing only verifies access; **Sync now** applies the explicit transfer and command protocol.

A command carries the revision the visitor saw. The desktop compares that revision with its local canonical state. Rust rechecks the expected hash inside the atomic transaction and stores a receipt with the applied command. Lost acknowledgments can be replayed without duplicate hiring or queueing. Conflicts preserve both sides. A queued command remains visibly pending until acknowledged.

One desktop owns writes. An empty cloud starts with an atomic first upload. A populated seed requires the first desktop to restore and match it. If the writer's laptop is lost or its credential expires, the owner revokes its access and explicitly releases that writer assignment using both current revision and identity. The snapshot survives. A replacement still has to match it; access recovery is not a silent merge.

The website uses the platform's ChatGPT sign-in and an owner allowlist. Device tokens are separately checked, hashed in D1 and revocable. The desktop stores pairing secrets in OS encryption; the extension uses SecretStorage. GitHub Pages contains no API token. Hosted chat has no tools; model-generated suggestions cannot directly modify repositories or publish code.

### Observed live protocol checkpoint

The actual deployed API, production `CloudSyncService` and real compiled Rust core completed this sequence at `2026-11-21T02:33:46.715Z`:

| Check | Observed result |
| --- | --- |
| Queued command | One queued command produced one native effect and a completed acknowledgment |
| Cloud-to-native messages | Four messages imported with durable native receipts |
| Second sync | Zero duplicate message imports; no pending commands |
| Native-to-cloud conversation | A saved native brief was visible through the hosted chat GET endpoint |
| Projection agreement | Final native and cloud projection hashes matched |
| Provider use | Zero provider calls during this synchronization test |
| Private application directory | Owner-private catalog seeded; individual records are excluded from this public document |

The test used an AES-GCM storage adapter in the protocol harness, **not an installed OS-keychain acceptance test**. The verification device was revoked and its writer assignment released afterward. The earlier production deployment exercised by this receipt used source revision `1f850c42b14739ce62d3b9b6562680bcdc5afdbd` and completed at `2026-11-21T02:33:20Z`. This is a hosted deployment revision, not a claim about a GitHub release tag. Browser sign-in interactions, packaged desktop activation and installed VSIX acceptance retain their own gates.

### Final published-binary restore and pairing

The final owner archive restored successfully with the Rust helper extracted
from the downloaded v0.5.0 AppImage. At `2026-11-21T03:20:41.131Z`, production
`CloudSyncService` paired that restored workspace to the latest deployed API,
claimed the writer and completed an explicit sync. Original, restored and cloud
projections matched; messages were not duplicated and no provider call occurred.
All included managed artifacts resolved and the credential scan found none in
the archive. The verification device was then revoked and the writer released.
This was an actual private-state/API recovery check using AES-GCM test storage;
it does not establish the owner's laptop keychain or interactive browser sign-in.

## Budget checkpoint and failure handling

The authorized development-session ceiling is **$100**. The website has a **$5 allocation reserved from that same ceiling in the native ledger**. It does not create additional budget. The cloud request ledger consumes that allocation through atomic admission, with conservative input/output reservations and no automatic paid retry.

Current accounting checkpoint, 20 November 2026 (America/New_York):

| Classification | Amount | Meaning |
| --- | ---: | --- |
| Cumulative observed native provider usage | $0.776748 | Earlier requests, two native roadmaps, three panel calls and two Daftar reviews |
| Successful hosted reply | $0.022140 | Confirmed response and usage after the adapter correction |
| Total observed usage | $0.798888 | Native plus hosted usage |
| Retained uncertain attempts | $0.285266 | Earlier $0.150000 native reservation plus $0.135266 from two hosted preflight failures |
| Conservative usage accounting | $1.084154 | Observed usage plus retained uncertainty, against the $100 ceiling |
| Native allocation held for cloud operation | $5.000000 | Capacity reservation that contains cloud usage; not observed spend and not added again to the charges above |

The initial hosted failure exposed an unsupported `redirect:"error"` option. The adapter now uses manual handling and explicitly rejects redirects. The retained attempts are not successful replies and have not been silently released. The later successful cloud reply has its own observed usage in [claude-usage.json](claude-usage.json). [CLAUDE_USAGE.md](CLAUDE_USAGE.md) explains the reconciliation; this table is a dated checkpoint, not a live account balance.

Budget exhaustion stops new requests while retaining jobs, artifacts, briefs and checkpoints. It does not discard completed work or claim that a timed-out external operation was free. Provider usage and exceptional overages remain visible rather than being hidden by the configured ceiling.

## D1 decision and Supabase option

D1 is the implemented website store. It fits the existing private Sites identity and Worker deployment and supports the small single-writer protocol without introducing a separate live backend during this release. This is an architecture and delivery decision; no comparative performance benchmark is claimed.

Supabase remains an optional adapter for future PostgreSQL collaboration, membership and richer querying. Before enabling it, preserve the existing revision/idempotency contract, define owner/organization records, apply authenticated ownership policies, test concurrency and migration/restore, and confirm measured need. Supabase's [RLS documentation](https://supabase.com/docs/guides/database/postgres/row-level-security) explains the underlying access-policy mechanism. No unrelated existing database was modified for this release.

## Acceptance and next work

The first candidate built but exposed real browser/desktop acceptance failures:
ambiguous directory select labels and default USD inputs inconsistent with their
min/step constraints. The release fixes the labels and numeric steps
and passes **192 renderer assertions**, including default validity regressions.
Branding, sidebar subtitle layout and disclosure glyphs were corrected; smoke
captures now wait for transient notices and reset scroll without hiding controls.
CI explicitly retains the OpenPencil outputs. Candidate 8415213 passed the
packaged desktop form path. Its second cloud failure was a strict URL assertion:
the Worker canonicalized `/workspace/chrome.html` to `/workspace/chrome` with
the same company/workspace queries and the Blueprint loaded. The corrected gate
accepts exactly those paths and retains its DOM checks; the remainder of the
stopped sweep is not claimed as passed. Content-addressed generated assets fix
the separately observed public HTML/CSS cache mismatch. Candidate 639c5d9 then
hit a system-Chromium timeout before any cloud UI checks; the smoke scripts now
prefer installed Playwright. Final candidate 0b87469 passed all gates, including
24 cloud UI checks and 11 fixture screenshots. See [validation](VALIDATION.md)
for the distinct final receipts and acceptance boundaries.

The release workflow has separate gates for the web renderer, database connectors, native desktop, Android, cloud API/build/UI, VS Code and design adapter. The final desktop acceptance launched the packaged Linux application and persisted a local goal through its real Rust state. The editor acceptance installed the VSIX into an isolated VS Code instance and passed six checks without network requests. Cloud browser acceptance used synthetic fixtures; it does not certify production identity or private persistence.

The hosted reply, live snapshot/command/chat protocol, installed-package checks,
published-download integrity and final restored-device pairing all have
observed receipts. The final workflows retained 66 public, 11 cloud-fixture and
four desktop screenshots. These captures and the deployed public review do not
certify production owner sign-in or the owner's laptop keychain. Follow
[VALIDATION.md](VALIDATION.md) for each result and its limits. Historical 0.4.3
receipts do not certify 0.5.0.

Remaining product work includes a tested general code-execution adapter, signed cross-platform installers, measured native-store optimization, an optional background service, richer conflict review and any future Supabase collaboration. Group-chat import and automatic background synchronization remain separate tasks; explicit bidirectional supported-scope chat is implemented and the selected live path passed. A complete Rust UI rewrite requires a measured case against the working Electron renderer.

## Primary references

- [Claude Sonnet 5.5 migration guide](https://platform.claude.com/docs/en/models/sonnet-5-5/migration-guide): supported model parameters and content-block handling.
- [Supabase row-level security](https://supabase.com/docs/guides/database/postgres/row-level-security): authenticated ownership policy mechanisms for an optional adapter.
- [VS Code extension testing](https://code.visualstudio.com/api/working-with-extensions/testing-extension): real Extension Host testing and installed-extension setup.

These sources establish platform behavior. The selected product architecture and acceptance order are implementation decisions grounded in the repository and the recorded reviews.
