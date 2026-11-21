# Integrated validation record

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

## Remaining verification boundaries

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

## Review outcomes

Independent reviews fixed artifact-cache tampering, unknown USD/token accounting, terminal dependencies, paused schedules, exact catalog pagination, stale-head publication, embedded credential rejection, concurrent HTTP startup, review-mode goal approval, fresh-install registration state, custom-model pricing, shared-service revocation and global conversation isolation. All accepted corrections were tested before this checkpoint.

See [worker ledger](WORKER_LEDGER.md), [panel decisions](PANEL_DECISIONS.md), [Claude usage](CLAUDE_USAGE.md), [public provider receipt](PUBLIC_ADAPTER_VALIDATION.json) and [portfolio architecture](PORTFOLIO_ARCHITECTURE.md).
