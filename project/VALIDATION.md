# Integrated validation record

## Command studio candidate · v0.6.0

The current candidate adds the violet/green/gold studio, a shared light theme, ownership and roadmap views, and derived heat maps. Local desktop build and **392 service tests / 27 files**, **218 DOM assertions**, cloud TypeScript/build and **28 API/directory tests**, and VS Code syntax/package plus **13 protocol tests** pass. The portable build verifies **171 files and 115 precache entries**. The design role loads with its existing 23-role registry; 15 loader tests pass inside the desktop suite. No new Claude API requests were made.

The managed browser preview confirmed both homepage palettes and persistence into the shared renderer. It exposed actual navigation/background specificity and dim helper-text defects; these were corrected and eight rendered contrast regressions added to the public browser gate. A missing hosted snapshot also exposed misleading cloud-session/upgrade labels; visible recovery and six DOM regressions now cover this state. Final combined CI, screenshots, packages, owner-private deployment and exact release/download receipts are still pending. The verified 0.5.0 records below remain historical.

The first combined candidate, `81afaf3`, passed MySQL, desktop, Android, cloud, editor and design checks in [Verify 44865684035](https://github.com/occult-kranti/engineering-intelligence-atlas/actions/runs/44865684035). The public web gate and [Pages 44865684142](https://github.com/occult-kranti/engineering-intelligence-atlas/actions/runs/44865684142) stopped at a real 390px layout regression: a heavily staffed room measured 507.19px against the retained 400px maximum. The release job was skipped. Mobile employee cards now use two columns, retain 44px hit areas and keep the View all action. Independent review of the packaged screenshots also found legacy dark text in saved messages, goals, decision guidance and sync status; those selectors now use the shared ink/muted tokens. All 218 DOM assertions still pass. The failed sweeps are preserved as failed evidence; final room geometry and corrected captures require the new browser run.

The corrected candidate `2377821` passed those mobile room and narrow studio checks, all eight rendered contrast checks, and the 1280×720 composer check. Its six other component jobs passed again; cloud fixtures completed 42 checks with 18 screenshots, and fresh packaged-desktop images confirmed the corrected saved text. However, [Verify 44866373418](https://github.com/occult-kranti/engineering-intelligence-atlas/actions/runs/44866373418) and [Pages 44866373460](https://github.com/occult-kranti/engineering-intelligence-atlas/actions/runs/44866373460) reached a later preserved 1024×768 check and found the first Donna action ending at 817.75px. Both public sweeps stopped there, retaining 73 screenshots each; no release was published. The next candidate must satisfy this existing laptop gate without hiding controls or loosening its assertion.

## Released connected office · v0.5.0

Checkpoint: **20 November 2026 (America/New_York)**. Evidence timestamps retain
UTC. **All seven verification gates, release publication and the separate Pages
workflow passed.** The three downloaded release assets match published digests;
the final personal archive restored and paired to the deployed API using the
published Rust binary. Owner-laptop/keychain acceptance and production browser
sign-in remain separate. Historical v0.4.x receipts below do not certify 0.5.0.

The [v0.5.0 release](https://github.com/occult-kranti/engineering-intelligence-atlas/releases/tag/v0.5.0)
is built from exact source
[`0b87469ba14864959bd5ec70dd323ce909904faa`](https://github.com/occult-kranti/engineering-intelligence-atlas/commit/0b87469ba14864959bd5ec70dd323ce909904faa).
[Verify 44860194825](https://github.com/occult-kranti/engineering-intelligence-atlas/actions/runs/44860194825)
passed `web`, `mysql-connectors`, `desktop`, `android`, `cloud`, `editor`,
`design-tools` and `release`. The release was published at
`2026-11-21T03:18:09Z`; the release job completed at `2026-11-21T03:18:11Z`.
[Pages 44860194823](https://github.com/occult-kranti/engineering-intelligence-atlas/actions/runs/44860194823)
also passed. Later documentation-only commits preserve this code tag. The
[release receipt](release-0.5.0.json) records the exact publication and downloads.

The latest private website deployment succeeded
at `2026-11-21T03:00:33.507277Z`, from hosted source
`03b9264757c38ae86689cc03f23defed39383498`, deployment
`appgdep_6b01094b1bf48191b53b9b012252ce89`. These hosted identifiers are distinct
from the GitHub release source and are not a release tag.

| Current gate | Observed result | Evidence / practical limit |
| --- | --- | --- |
| Rust control core | **70 passed** | Native grants, parent expiry/revocation, scope checks, migrations, remote receipts and full cloud-message import; [native source](../native-core/src/) |
| Desktop TypeScript/build and renderer compilation | **Passed; final packaged desktop smoke passed** | Verify 44860194825 launched the packaged application, loaded real native state and persisted a local goal without changing provider spend; four screenshots retained |
| Desktop service tests | **375 passed / 26 files** | Includes sync, real native contract, worker admission, accounting and profile migration; [tests](../desktop-shell/tests/) |
| Real JS ↔ Rust cloud contract | **3 passed** | Canonical hash agreement and durable cloud message import without provider dispatch; included in the desktop total, not added again |
| Renderer behavior | **192 assertions passed** | Synthetic pure-DOM behavior including timed authority, delegation controls and existing office/decision flows; not visual browser evidence |
| Static site typecheck and tests | **Passed; 75 tests passed, 22 skipped** | Nine passing and four skipped test files; skips retain their integration-environment limits |
| Static build integrity and public browser sweep | **169 files checked; 68 browser checks passed; 66 screenshots** | Four generated assets use content-addressed names, with 113 precache entries; final Verify and Pages workflows passed on the exact release source |
| Cloud API and directory tests | **28 passed: 21 API + 7 directory** | [Cloud tests](../cloud-workspace/tests/); admission, scoped data and directory projection checks |
| Cloud TypeScript and build | **Passed** | Strict checking and Vinext build, including `/` and `/applications`; source/build success is distinct from browser sign-in acceptance |
| Cloud browser acceptance | **24 checks passed; 11 screenshots** | Final synthetic-fixture receipt completed at `2026-11-21T03:16:34.550Z`; zero provider calls, with production authentication and persistence explicitly outside that fixture |
| VS Code client and package | **11 client tests and 6 installed-host checks passed** | Syntax, VSIX packaging and activation in isolated VS Code passed; seven commands and five runtime files verified with zero network requests; owner-session setup remains separate |
| Python preparation, restore and directory | **25 passed, including 10 indexer tests** | [Indexer tests](../scripts/test_index_github_applications.py): bounded reads, global deduplication/cap, timeout, cache freshness and atomic private checkpoints |
| MCP protocol and scale/query boundaries | **26 passed** | Fifteen existing plus eleven new checks: successful large-response compaction, 16 MiB native ceiling, complete bounded metadata pagination, stale-cursor detection and no mutation/replay during reads |
| Live large-state MCP protocol | **Passed** | Actual approximately 1.9 MiB native state returned a successful compact JSON-RPC response; read-only metadata pagination covered the selected collection exactly once, with no mutation or provider call; private record counts omitted |
| OpenPencil adapter | **6 boundary tests and 4 real local operations passed** | Pinned `@open-pencil/cli` 0.16.0; [receipt](../design-tools/examples/receipt.json), one page/12 nodes, `.fig` roundtrip and SVG export; zero network attempts/provider calls |
| OpenPencil artifact integrity | **3 example sizes and SHA-256 hashes matched** | Published `.fig`, inspection JSON and SVG match the receipt; final design gate passed; import into the Figma application remains unverified |
| Android and MySQL integration | **Final CI gates passed** | Android verification/debug APK packaging and disposable-database connector checks passed; physical mobile-device use and production signing remain separate |
| Security curriculum routing | **15 role-loader tests passed; 46 local links checked** | Updated Security role loads through the actual compiled loader; three synthetic scope/expiry cases and missing-telemetry expectation checked; no upstream lab run |
| Native Donna planning | **Seven provider jobs completed with retained artifacts** | Two roadmaps, two independent experts plus Donna synthesis, and two Daftar reviews; [sanitized usage](claude-usage.json), [worker ledger](WORKER_LEDGER.md) |
| Hosted Donna reply | **One successful request with observed usage** | 7,800 input/654 output tokens, $0.022140; two earlier preflight reservations remain uncertain, not successful replies |
| Timed portfolio management setup | **Applied with retained authority history** | Owner-authorized 24-hour Donna grants and two child promotions; receipt `2026-11-21T02:32:31.533Z`; zero provider calls, no private catalog enumeration here |

These totals record their named suites, not a sum of independent guarantees.
The role-loader and native-contract checks overlap the desktop suite. Source
changes after a component checkpoint require the affected gate to run again.

### Live deployed API ↔ desktop/native protocol

**Passed at `2026-11-21T02:33:46.715Z`** (20 November, New York), using the
deployed API, production `CloudSyncService` and the real compiled Rust binary.
The owner-retained protocol receipt records:

- One queued command, **one native effect**, and a completed server acknowledgment.
- **Four cloud messages imported** on the first sync; **zero duplicate imports**
  on the second sync, with no pending commands afterward.
- A saved native brief visible through the hosted chat GET endpoint, confirming
  the native-to-cloud direction for the tested scope.
- Matching final native/cloud projection hashes and successful private
  application-directory seeding, with catalog records omitted from this report.
- **Zero provider calls** during the synchronization test.

The earlier deployment exercised by this protocol receipt used hosted source revision
`1f850c42b14739ce62d3b9b6562680bcdc5afdbd`, completed at
`2026-11-21T02:33:20Z`. The protocol harness used AES-GCM test storage, not the
installed desktop's OS keychain. Its verification device was revoked and the
writer assignment released after the check. This does not establish a complete
replacement-device recovery exercise or a production browser sign-in review.

Supported exact-scope company/office/department/employee chat is implemented in
both directions through explicit sync. Full native threads are projected; cloud
messages have stable IDs, provenance and durable import receipts. The final
page cursor is persisted. Oversized snapshots fail before upload rather than
truncating content. Group-scoped cloud messages remain hosted and are reported
as skipped. Scope, Unicode/size and replay regressions are local tests; the live
receipt establishes the particular path exercised above.

### Portable evidence after restore

The director’s real private export/restore rehearsal exposed three panel evidence paths that changed with the destination directory and content-hash filenames. The TypeScript and Rust cloud projections now replace only structured absolute local evidence references with an explicit omission marker. Authored chat, decision summaries, HTTPS sources and relative references remain exact. A real export→restore integration test retains the artifact bytes and proves that a Rust transaction accepts the pre-restore TypeScript hash. The actual owner workspace and restored candidate also matched after this correction, with no provider calls.

### Final published-binary restore and restored-device sync

**Passed at `2026-11-21T03:20:41.131Z`.** The final personal archive was restored
into an isolated directory. The actual Rust helper extracted from the downloaded
v0.5.0 AppImage loaded the restored state; its SHA-256 matched the final CI binary:
`7e51cee7a09427aced1df2ca15ba42389eaeecd96169740655a79869a0cea491`.
Every included managed artifact resolved; no missing artifact references or
embedded credentials were found. The archive's private catalog and identities
are excluded from this document.

The production `CloudSyncService` then paired the restored workspace to the
latest deployed owner-private API, claimed the writer and performed an explicit
sync. Original, restored and cloud projections were identical, messages were
not duplicated, and no provider calls occurred. The verification device was
revoked and its writer assignment released afterward. This verifies a real
private-state recovery and server pairing using AES-GCM test storage; it does
not establish the owner's actual OS keychain or interactive browser sign-in.

Exports must pass the directory containing managed artifacts directly, such as
`/path/to/user-data/office-artifacts`, as `--artifact-root`. Passing its parent
directory does not identify those artifact files. [Handoff](../HANDOFF.md)
documents restoration and credential reconnection.

### Verified v0.5.0 downloads

All three release assets were downloaded and their byte sizes and SHA-256 hashes
matched the published GitHub digest metadata. The [release receipt](release-0.5.0.json)
retains the exact source, publication time and integrity result.

| Artifact | Downloaded size | SHA-256 |
| --- | ---: | --- |
| [daftar-desktop-0.5.0-x86_64.AppImage](https://github.com/occult-kranti/engineering-intelligence-atlas/releases/download/v0.5.0/daftar-desktop-0.5.0-x86_64.AppImage) | 136,094,973 bytes | `5dcb7ebbbab552cd6306800ed5baa16c54955cfbfd0d247ade7a67fe8f75cd36` |
| [atlas-office-0.5.0.vsix](https://github.com/occult-kranti/engineering-intelligence-atlas/releases/download/v0.5.0/atlas-office-0.5.0.vsix) | 17,504 bytes | `0b093a79e3421be2486c3e7c53266554ad2d22f600c8181842697849bd9824ea` |
| [app-debug.apk](https://github.com/occult-kranti/engineering-intelligence-atlas/releases/download/v0.5.0/app-debug.apk) | 8,579,001 bytes | `50190dcf51a55a68d7b0dea79dffcef83c27e51d776157207c4d40af7403b19c` |

The desktop is an unsigned Linux x86_64 build; Android remains a debug APK.
Installed VSIX acceptance used an isolated VS Code host. These results do not
claim signed Windows/macOS packages or acceptance on the owner's physical devices.

### Earlier candidate failures and corrections

The first candidate's real cloud and desktop checks found defects that the
earlier pure-DOM suite had not established: ambiguous directory select labels
prevented the cloud test from resolving controls, and the desktop's default USD
values failed native HTML min/step validation. The release adds
explicit visible-label references, aligned steps, a native form-validity
diagnostic and default-value regressions; **192 renderer assertions pass**.
Brand/disclosure glyphs and sidebar clipping were also corrected. Capture waits,
scroll reset and explicit retention of OpenPencil outputs improved the final
evidence package without bypassing its assertions. Entry 033 in the
[worker ledger](WORKER_LEDGER.md) preserves the failed first-run findings.

Candidate `8415213`, [Verify 44858908405](https://github.com/occult-kranti/engineering-intelligence-atlas/actions/runs/44858908405),
passed its installed desktop and other component gates but stopped the second
cloud UI sweep at a harness URL assumption: the Worker returned
HTTP 307 from `/workspace/chrome.html` to `/workspace/chrome`, preserving the
exact company and workspace query values, and the actual Blueprint loaded.
The corrected gate accepts only those two paths, retains the scoped DOM checks
and records the final page URL. This explains the failed assertion without
claiming that the remainder of that stopped browser sweep passed.

Live public-preview inspection also exposed new HTML arriving with cached older
CSS. The generated preview now uses four content-addressed assets and a rebuilt
113-entry precache. The director inspected the deployed DAFTAR hero and sidebar
after the correction. Candidate `639c5d9`,
[Verify 44859884805](https://github.com/occult-kranti/engineering-intelligence-atlas/actions/runs/44859884805),
then hit a system-Chromium timeout before any cloud UI checks or screenshots.
The smoke scripts were corrected to prefer the installed Playwright browser.
None of the failed candidates published a release. Final `0b87469` passed all gates,
including the full cloud-fixture sweep; the prior stopped sweeps remain failed
historical evidence.

### Final acceptance and remaining boundaries

| Gate | Observed result and boundary |
| --- | --- |
| Combined CI and release | All seven verification jobs and release passed for `0b87469`; v0.5.0 was published and all three downloaded asset digests matched |
| Packaged desktop activation | Passed at `2026-11-21T03:17:45.700Z`: native state loaded, local goal persisted, provider spend unchanged, four screenshots; actual owner-laptop/keychain acceptance remains separate |
| Installed VSIX activation | Six checks passed at `2026-11-21T03:16:06.700Z` with zero network requests; the owner's editor session and SecretStorage remain a separate setup context |
| Public and cloud browser sweeps | Public: 68 checks/66 screenshots, successful Pages deployment. Cloud: 24 checks/11 screenshots using synthetic fixtures, with production authentication/persistence explicitly unverified by that fixture |
| Final private restore and device pairing | Passed against the production API with the published Rust binary, equal original/restored/cloud projections and no duplicate messages; test device revoked and writer released |
| Production owner sign-in | Interactive browser sign-in is not verified by either the fixture browser or device-token protocol test |
| Figma and device distribution | Actual Figma application import, signed cross-platform installers and physical mobile-device acceptance remain future work |

Screenshots are retained evidence for the named workflows; their counts are not
a claim that every screen was manually inspected or that a synthetic fixture
contains the owner's live data. Closing the desktop still stops its local
scheduler. General isolated code execution, an OS background service, group-chat
import and optional Supabase collaboration remain roadmap work.

The observed usage checkpoint is **$0.776748 native + $0.022140 cloud =
$0.798888**, with **$0.285266 retained uncertainty**, for **$1.084154 conservative
usage accounting against $100**. The $5 external cloud allocation is reserved
capacity inside that ceiling, not additional spend. The two new Donna goals each
had a $20 cap and together used $0.093502. See [Claude usage](CLAUDE_USAGE.md).

## Historical local checkpoint · v0.4.x

Local validation checkpoint: 20 November 2026 (America/New_York). Remote publication update: 21 November 2026 (UTC). This records executed checks and separates local results from remote publication evidence.

| Gate | Result | Scope |
| --- | --- | --- |
| Rust control core | **44 passed** | Atomic state, scoped contracts, knowledge grants, ownership DAGs, reservations, migrations and retained history |
| Desktop TypeScript and build | **Passed** | Main process, preload and shared renderer |
| Desktop service tests | **328 passed / 23 files** | Worker/accounting, GitHub, vault, IPC boundary, role references, portfolio maintenance and real loopback HTTP |
| Renderer behavior | **125 assertions passed** | Synthetic pure-DOM checks; this is not visual browser evidence |
| JS ↔ Rust worker lifecycle | **Passed** | Eight injected jobs across two iterations; all checkpoints/artifacts retained; no real provider calls |
| MCP protocol and behavior | **15 passed** | Verified registration, public catalog boundaries, JSON-RPC, action forwarding |
| Portfolio preparation and portable export/restore | **15 passed** | Input coverage, private-output controls, artifact roundtrip, checksums, backup, traversal and symlink checks |
| Owner workspace restore | **Passed** | Actual export restored to an isolated directory and read through MCP/Rust; managed artifact references resolved and credential-byte scan passed |
| Role samples | **3 source-clipper tests; 4 geometry examples passed** | Extension source was not installed; audio was not played |
| Synthetic live Claude SDK adapter | **Passed** | Only a fixed public test string was sent;65 input/17 output tokens; $0.000300 observed cost |
| Private live Claude validation | **Blocked** | Automatic approval review denied private-data egress; no provider response observed; uncertain reservation retained |
| Private portfolio application | **Completed; replay verified** | Owner-only plan applied via MCP/native tools; second application created zero duplicate company, employee, department, contract or roadmap records |
| Web TypeScript | **Passed** | Static and hosted source/contract compilation |
| Web unit tests | **75 passed;22 explicitly skipped** | Database/storage/live-provider checks require their separate environments |
| SQL migration integrity | **Passed** | Three migrations,54 statements,19 tables; this local check contacted no database |
| Static build integrity | **Passed** |169 hashed client files plus build manifest; portable assets and service worker |
| Android JavaScript | **53 passed** | Launcher/project/native-bridge contracts |
| Offline shell sync | **Passed** | Current static build copied into desktop and Android shells |
| Linux packaging | **Passed** | AppImage and unpacked application, including Rust helper, role references and prompts |

## Final release verification · v0.4.3

Released **[v0.4.3](https://github.com/occult-kranti/engineering-intelligence-atlas/releases/tag/v0.4.3)** is verified at exact commit [eb5f25073a2c1c3377068b6d30c5743a729305b1](https://github.com/occult-kranti/engineering-intelligence-atlas/commit/eb5f25073a2c1c3377068b6d30c5743a729305b1). It corrects the mobile blueprint list layout found during visual review: inline room widths and minimum heights had produced narrow, excessively tall cards even though document-overflow assertions passed. All 125 local renderer assertions remain successful.

The browser regression opens a populated blueprint in list mode at a 390-pixel viewport and requires every room to fill its available inner track within two pixels and remain under 400 pixels tall. It passed in the final Pages run. Both the director and designer inspected the resulting narrow blueprint: room cards use the full list width and sensible content heights, and names, employee controls and `+8 more` remain readable.

| v0.4.3 gate | Observed result | Evidence |
| --- | --- | --- |
| Final CI and release | **All five jobs passed: web, MySQL connectors, desktop, Android and release** | [Verify run 44848307218](https://github.com/occult-kranti/engineering-intelligence-atlas/actions/runs/44848307218); release tag checked against the exact source commit |
| Pages deployment, browser smoke and offline checks | **Passed and deployed** | [Pages run 44848307180](https://github.com/occult-kranti/engineering-intelligence-atlas/actions/runs/44848307180) |
| Browser captures and regressions | **60 screenshots; 62 route/reload checks; blueprint list geometry passed** | Downloaded final browser evidence |
| Final live interface review | **Passed for the observed public flows** | Director reviewed Settings, focused roster, CEO, linked whiteboard editor and site navigation on the deployed v0.4.3; designer independently confirmed the final narrow blueprint |
| Downloaded release artifact integrity | **Passed** | Final APK and AppImage downloaded; local sizes and SHA-256 hashes match published release metadata |

The downloaded [v0.4.3 Pages evidence archive](https://github.com/occult-kranti/engineering-intelligence-atlas/actions/runs/44848307180/artifacts/14684441585) is **8,590,678 bytes**, SHA-256 `bcf5287ce5657edad6148cc62b26474e0a764a9ac348c3ba17024ca1e2c73356`. The live `+N more` action opened and focused a bounded roster of 14 example employees. Settings displayed the correct preview-specific credential guidance; CEO labels and arrows rendered correctly. Selecting **Connect a repository → Map ownership** populated the existing whiteboard editor with the expected title, Donna owner, Engineering room and linked outcome, while the read-only Save control remained disabled. The public root, workspace navigation and download entry were also inspected. These are public starter-example checks, not private workspace or paid-provider execution.

Final CI logs confirm 75 web tests passed with 22 explicit skips, 328 desktop tests, 44 Rust tests, 15 MCP tests and eight injected lifecycle jobs with no live provider calls. Android passed 53 JavaScript tests, executed `:app:testDebugUnitTest` and completed `assembleDebug` with `BUILD SUCCESSFUL`. These checks ran in the successful final Verify run linked above.

### Verified release downloads

| Artifact | Downloaded size | SHA-256 |
| --- | ---: | --- |
| [research-director-desktop-0.4.3-x86_64.AppImage](https://github.com/occult-kranti/engineering-intelligence-atlas/releases/download/v0.4.3/research-director-desktop-0.4.3-x86_64.AppImage) | 135,816,021 bytes | `d4290469037e8af78ba9eb2f7c92d515615505b913249e2340f269cb38862d87` |
| [app-debug.apk](https://github.com/occult-kranti/engineering-intelligence-atlas/releases/download/v0.4.3/app-debug.apk) | 8,550,145 bytes | `a6fba20d1b76dba961275ab5d231d4a4a8d0f047ddbf80d238effd2f6f15d926` |

The release is an unsigned Linux x86_64 AppImage and an Android debug APK. The owner workspace archive was independently restored into a new isolated directory, then read successfully through the MCP/Rust path. Referenced managed artifacts remained available and the credential-byte scan passed. Private workspace identities, counts and archive hashes are excluded from this public record.

## Responsive layout checkpoint · v0.4.2

Candidate [5627c846c09b0e717f0763d202ae2054772af0c5](https://github.com/occult-kranti/engineering-intelligence-atlas/commit/5627c846c09b0e717f0763d202ae2054772af0c5) includes the narrow-screen queue correction and makes the browser sweep a prerequisite for release. The preceding v0.4.1 release gates passed, but its expanded Pages sweep found a queue document width of 448 pixels at a 390-pixel viewport. The correction allows form tracks and controls to shrink and the filter to wrap; it does not conceal overflowing content. The same `scripts/smoke-static.mjs` sweep now runs in the CI `web` job, which the `release` job requires.

| v0.4.2 gate | Status at this checkpoint |
| --- | --- |
| CI, including browser gate and release | **All five jobs passed** in [Verify run 44847753410](https://github.com/occult-kranti/engineering-intelligence-atlas/actions/runs/44847753410) |
| Pages deployment, browser smoke and offline checks | **Passed** in [Pages run 44847753403](https://github.com/occult-kranti/engineering-intelligence-atlas/actions/runs/44847753403) at the exact candidate commit |
| Expanded browser screenshots | **60 captured; 62 route/reload checks passed**, with no overflow or page errors; the queue view passed at 390 pixels |
| Visual review | Queue controls at 390 pixels fit; CEO and whiteboard remained readable. Mobile blueprint list-card proportions require correction |
| Downloaded release artifact integrity | v0.4.2 assets downloaded and checked; delivery held for the visual correction above |

The local regression totals remain 44 Rust tests, 328 desktop tests and 125 renderer assertions. These v0.4.2 results and the successful v0.4.0 results below are historical evidence; they do not validate the subsequent blueprint correction.

The downloaded [Pages evidence archive](https://github.com/occult-kranti/engineering-intelligence-atlas/actions/runs/44847753403/artifacts/14684216139) is **8,595,301 bytes**, SHA-256 `a01e2fd56164f70684fdb8e59bea421e56ffff9e052a76bf70caae536d5b3120`. Its capture count and browser results were inspected after download.

## Historical local packaged artifact · v0.4.0

`research-director-desktop-0.4.0-x86_64.AppImage`

- Size: **135,816,071 bytes**.
- SHA-256: `aa459147440d870ab4084967fdcd5d493afee536eb70271116b41830fa5ec5aa`.
- Unsigned Linux x86_64 development build; no credentials or private portfolio state embedded.
- Personal state and included managed artifacts are exported separately for the owner, with checksums and a portable restore tool.

## Historical verification boundaries · v0.4.x

The following paragraphs preserve the limits at the historical v0.4.x
checkpoint. The current hosted deployment, approved provider rounds and tested
sync path are recorded above; the older absence of hosted execution is not the
current 0.5.0 implementation status.

Local Chromium could not start because its required Unix socket was denied. The final remote Pages workflow completed browser smoke, offline and blueprint geometry checks, captured 60 screenshots and passed 62 route/reload checks. The director and designer then inspected the actual final screenshots and the deployed public flows described above. Pure-DOM assertions remain distinct from this observed browser evidence.

The local Android Gradle distribution download was unavailable. The first published CI Android job failed during SDK setup because it requested an obsolete tools package. Correction `1e16778` resolved that failure, and the final v0.4.3 CI job repeated successful JavaScript, JVM and debug-APK build checks. The final CI MySQL job also successfully applied migrations and ran database-backed connector checks against a disposable database. Successful build and download checks do not establish physical Android device or installed desktop runtime testing.

The authenticated hosted cloud runtime is not deployed. The working personal browser view uses the desktop's authenticated loopback endpoint and the same native state. Scheduling runs while the application is open; no OS background daemon, signed installer, Windows/macOS package or complete Rust UI rewrite is claimed.

## Publication and visual evidence · v0.4.0 checkpoint

The integrated rebuild was published to `main` at [6447754](https://github.com/occult-kranti/engineering-intelligence-atlas/commit/6447754). After the Android setup correction [1e16778](https://github.com/occult-kranti/engineering-intelligence-atlas/commit/1e16778), all five jobs in [Verify run 44846695687](https://github.com/occult-kranti/engineering-intelligence-atlas/actions/runs/44846695687) succeeded, including the release job. The [public preview](https://occult-kranti.github.io/engineering-intelligence-atlas/) is deployed.

| Remote gate | Observed result | Evidence |
| --- | --- | --- |
| Web verification | **Passed** | `web` job in [Verify run 44846695687](https://github.com/occult-kranti/engineering-intelligence-atlas/actions/runs/44846695687) |
| Real MySQL integration | **Passed** | `mysql-connectors` job in [Verify run 44846695687](https://github.com/occult-kranti/engineering-intelligence-atlas/actions/runs/44846695687) |
| Desktop verification | **Passed** | `desktop` job in [Verify run 44846695687](https://github.com/occult-kranti/engineering-intelligence-atlas/actions/runs/44846695687) |
| Android verification | **Passed** | [Android job 136668043587](https://github.com/occult-kranti/engineering-intelligence-atlas/actions/runs/44846695687/job/136668043587): 53 JavaScript tests, `:app:testDebugUnitTest` executed, `assembleDebug` completed successfully |
| v0.4.0 release workflow | **Passed** | `release` job in [Verify run 44846695687](https://github.com/occult-kranti/engineering-intelligence-atlas/actions/runs/44846695687) |
| Pages deployment, browser smoke and offline checks | **Passed** | [Pages run 44846291115](https://github.com/occult-kranti/engineering-intelligence-atlas/actions/runs/44846291115) |
| Browser screenshots | **46 captured** | Screenshot artifacts from [Pages run 44846291115](https://github.com/occult-kranti/engineering-intelligence-atlas/actions/runs/44846291115) |
| Live interface review | **Passed for observed interactions** | Director opened the CEO view, blueprint room and whiteboard card in the [public preview](https://occult-kranti.github.io/engineering-intelligence-atlas/); screenshots confirmed the expected bindings |

The first [Verify run 44846291141](https://github.com/occult-kranti/engineering-intelligence-atlas/actions/runs/44846291141) remains the historical record of the Android setup failure; the successful corrected run above supersedes its pending Android status. These results record the v0.4.0 checkpoint only. Subsequent visual polish, expanded screenshot coverage and later releases require their own observed results. The local Linux artifact remains unsigned.

## Historical review outcomes · v0.4.x

Independent reviews fixed artifact-cache tampering, unknown USD/token accounting, terminal dependencies, paused schedules, exact catalog pagination, stale-head publication, embedded credential rejection, concurrent HTTP startup, review-mode goal approval, fresh-install registration state, custom-model pricing, shared-service revocation and global conversation isolation. All accepted corrections were tested before this checkpoint.

See [worker ledger](WORKER_LEDGER.md), [panel decisions](PANEL_DECISIONS.md), [Claude usage](CLAUDE_USAGE.md), [public provider receipt](PUBLIC_ADAPTER_VALIDATION.json) and [portfolio architecture](PORTFOLIO_ARCHITECTURE.md).
