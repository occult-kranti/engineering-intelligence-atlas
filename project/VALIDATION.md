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

## Local packaged artifact

`research-director-desktop-0.4.0-x86_64.AppImage`

- Size: **135,816,071 bytes**.
- SHA-256: `aa459147440d870ab4084967fdcd5d493afee536eb70271116b41830fa5ec5aa`.
- Unsigned Linux x86_64 development build; no credentials or private portfolio state embedded.
- Personal state and included managed artifacts are exported separately for the owner, with checksums and a portable restore tool.

## Remaining verification boundaries

Local Chromium could not start because its required Unix socket was denied. The published Pages workflow completed browser smoke and offline checks and captured 46 screenshots of the web routes and desktop workspace views. The director subsequently inspected the live public preview and opened the CEO view, a blueprint room and a whiteboard card, confirming the expected interface bindings with screenshots. Pure-DOM assertions remain distinct from this observed browser evidence.

The local Android Gradle distribution download was unavailable. The first published CI Android job failed during SDK setup because it requested an obsolete tools package. Correction `1e16778` resolved that failure: the subsequent Android job passed 53 JavaScript tests, executed `:app:testDebugUnitTest` and completed `assembleDebug` with `BUILD SUCCESS`. The CI MySQL job also successfully applied migrations and ran database-backed connector checks against a disposable database. Remote evidence is linked below.

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
