# Integrated validation record

Checkpoint: 20 November 2026 (America/New_York). This records executed checks and separates local results from remote publication evidence.

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

Local Chromium could not start because its required Unix socket was denied. Real browser screenshots are captured by the Pages workflow for all main web routes and desktop workspace views at laptop and narrow widths. Pure-DOM assertions are not represented as visual validation.

The local Android Gradle distribution download was unavailable. The CI Android job runs JVM tests and builds the debug APK. The CI MySQL job uses a disposable database to apply migrations and run database-backed connector checks. These remote outcomes are recorded after publication below.

The authenticated hosted cloud runtime is not deployed. The working personal browser view uses the desktop's authenticated loopback endpoint and the same native state. Scheduling runs while the application is open; no OS background daemon, signed installer, Windows/macOS package or complete Rust UI rewrite is claimed.

## Publication and visual evidence

Pending first integrated source publication. Local success does not imply that remote CI, Pages deployment, release creation or the browser sweep passed.

## Review outcomes

Independent reviews fixed artifact-cache tampering, unknown USD/token accounting, terminal dependencies, paused schedules, exact catalog pagination, stale-head publication, embedded credential rejection, concurrent HTTP startup, review-mode goal approval, fresh-install registration state, custom-model pricing, shared-service revocation and global conversation isolation. All accepted corrections were tested before this checkpoint.

See [worker ledger](WORKER_LEDGER.md), [panel decisions](PANEL_DECISIONS.md), [Claude usage](CLAUDE_USAGE.md), [public provider receipt](PUBLIC_ADAPTER_VALIDATION.json) and [portfolio architecture](PORTFOLIO_ARCHITECTURE.md).
