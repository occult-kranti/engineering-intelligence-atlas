# Integrated validation record

## Current connected release draft · v0.5.0

Checkpoint: **20 November 2026 (America/New_York)**. Evidence timestamps retain
UTC. The checks below are observed component and protocol results; **final
combined CI, installed-package acceptance, final browser inspection and 0.5.0
release publication are still pending**. Historical v0.4.x receipts below do not
certify this candidate.

| Current gate | Observed result | Evidence / practical limit |
| --- | --- | --- |
| Rust control core | **70 passed** | Native grants, parent expiry/revocation, scope checks, migrations, remote receipts and full cloud-message import; [native source](../native-core/src/) |
| Desktop TypeScript/build and renderer compilation | **Passed** | Main, preload, shared types and renderer compile; installed application behavior is a separate gate |
| Desktop service tests | **375 passed / 26 files** | Includes sync, real native contract, worker admission, accounting and profile migration; [tests](../desktop-shell/tests/) |
| Real JS ↔ Rust cloud contract | **3 passed** | Canonical hash agreement and durable cloud message import without provider dispatch; included in the desktop total, not added again |
| Renderer behavior | **192 assertions passed** | Synthetic pure-DOM behavior including timed authority, delegation controls and existing office/decision flows; not visual browser evidence |
| Static site typecheck and tests | **Passed; 75 tests passed, 22 skipped** | Nine passing and four skipped test files; skips retain their integration-environment limits |
| Static build integrity | **169 files checked** | Current public build integrity; remote Pages/browser acceptance remains pending |
| Cloud API and directory tests | **28 passed: 21 API + 7 directory** | [Cloud tests](../cloud-workspace/tests/); admission, scoped data and directory projection checks |
| Cloud TypeScript and build | **Passed** | Strict checking and Vinext build, including `/` and `/applications`; source/build success is distinct from browser sign-in acceptance |
| VS Code client and package | **11 client tests passed; syntax and VSIX packaging passed** | [Extension](../vscode-extension/); installed Extension Host activation awaits CI |
| Python preparation, restore and directory | **25 passed, including 10 indexer tests** | [Indexer tests](../scripts/test_index_github_applications.py): bounded reads, global deduplication/cap, timeout, cache freshness and atomic private checkpoints |
| MCP protocol and scale/query boundaries | **26 passed** | Fifteen existing plus eleven new checks: successful large-response compaction, 16 MiB native ceiling, complete bounded metadata pagination, stale-cursor detection and no mutation/replay during reads |
| Live large-state MCP protocol | **Passed** | Actual approximately 1.9 MiB native state returned a successful compact JSON-RPC response; read-only metadata pagination covered the selected collection exactly once, with no mutation or provider call; private record counts omitted |
| OpenPencil adapter | **6 boundary tests and 4 real local operations passed** | Pinned `@open-pencil/cli` 0.16.0; [receipt](../design-tools/examples/receipt.json), one page/12 nodes, `.fig` roundtrip and SVG export; zero network attempts/provider calls |
| OpenPencil artifact integrity | **3 example sizes and SHA-256 hashes matched** | Published `.fig`, inspection JSON and SVG match the receipt; import into the Figma application remains unverified |
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

The production deployment used hosted source revision
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

### Pending final acceptance

| Gate | Current boundary |
| --- | --- |
| Combined candidate CI and release | Pending exact-candidate remote run, release job and published tag |
| Packaged desktop activation | Smoke harness exists; real installed launch, native operation and OS-keychain behavior still need their own receipt |
| Installed VSIX activation | Isolated installed-extension harness exists; actual Extension Host acceptance awaits CI |
| Current browser/visual sweep | Pending completed cloud/public/desktop browser checks and review of the resulting current screenshots |
| Owner sign-in UI and writer recovery | API protocol passed; browser interaction and replacement-writer recovery remain separate checks |
| Downloaded 0.5.0 assets and restore | Pending published binaries, downloaded hashes and current portable restore evidence |

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
