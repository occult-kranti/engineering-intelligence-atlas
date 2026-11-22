# Board workflow validation

Run: `boards-flow-20261122`. Baseline: `9c4f84934762b6f9e2bccac3f9ca9e3986025e00`.

## Acceptance status

**Accepted on exact source `2b8086fab5d564868f9d3b7d5650e56fe731960f`.** [CI run 44991164221](https://github.com/occult-kranti/engineering-intelligence-atlas/actions/runs/44991164221) passed on Linux and Windows. Native/backend/editor tests, actual installed-extension acceptance and all 17 sandboxed browser checks passed. The browser reached `boardStage: complete` and retained 19 screenshots. An independent helper reviewed the captured board layouts; its final two-viewport check confirmed that the stale-warning decoration is cleared after accepting a new edit base. Later commits that only attach this documentation and evidence do not change the tested product source.

The [complete CI summary](evidence/ci-2b8086f-summary.json), [browser receipt](evidence/ci-2b8086f-browser.json), [Linux installed receipt](evidence/ci-2b8086f-linux-installed.json), [Windows installed receipt](evidence/ci-2b8086f-windows-installed.json) and [compact acceptance record](evidence/acceptance.json) retain the measurements and their limits. The failed attempts below remain part of the record.

## Final exact-source gates

| Gate | Observed result |
| --- | --- |
| Rust native core | 118 passed |
| Desktop/portable backend | 740 passed across 50 files |
| Shared renderer | 422 checks passed |
| MCP | 67 passed |
| Headless runtime | 123 passed, no skips |
| VS Code extension, Linux | 132 passed |
| VS Code extension, Windows | 125 passed; 7 explicitly Linux-only tests skipped |
| Python private export/restore | 9 passed |
| Actual installed VSIX | Linux 11 checks; Windows 9 checks passed |
| Sandboxed browser | 17 checks passed; 19 screenshots at 1440×900 and 1366×768 |

Planner and geometry tests are included in the desktop total; focused regressions are not additional unique tests. The Linux installed acceptance exercised the actual Electron → tmux → native daemon chain, detached and reconnected to the same daemon, executed one bounded host fixture and checked stable replay. Workers were paused and host policy restored to `off`.

The browser exercised the shared renderer with an emulated VS Code parent connected to a temporary real native backend. It recorded zero provider calls, external requests, backend network attempts, page errors, console errors, CSP errors or unexpected RPC failures. Separate installed checks verify the actual extension host. WebGL2 rendered through sandboxed ANGLE/SwiftShader software. One forced context loss recovered while preserving native state and the draft; the recorded frame count advanced from 44 to 46. The 300 ms idle sample rendered no additional frames. These observations do not establish hardware GPU performance or indefinite leak freedom.

## Source-matched packages

Download platform artifacts from the [successful workflow run](https://github.com/occult-kranti/engineering-intelligence-atlas/actions/runs/44991164221). The package filename in each platform archive is `atlas-office-0.9.0.vsix`. The VSIX hashes match the actual installed-acceptance receipts, and the downloaded archive hashes match GitHub's artifact digests.

| Extension host | Artifact | VSIX SHA-256 |
| --- | --- | --- |
| Linux x64, including a Linux Remote-SSH host | `daftar-vscode-Linux-X64` | `b624ffbefc778426cf3e945b0bb27344df356865f892eeff72dea913b727be1d` |
| Windows x64 local host | `daftar-vscode-Windows-X64` | `9652a7a48d5a57328c52d1ea20ac2ef0714ffddbc707534a65c3453d4032d09f` |

Use **Extensions: Install from VSIX**, then **Daftar: Start Workspace on This Host** and **Daftar: Open Office**. On Linux, **Daftar: Start Persistent Workspace in tmux** selects the persistent host mode. Match the package to the extension host, including the remote operating system when using Remote-SSH. This does not resume the stopped Vast instance.

## Captured board views

These are real browser captures using acceptance-fixture companies and records, not generated concept art. The screenshot directory retains all 19 captures; the main board views are linked here.

| View | 1440×900 | 1366×768 |
| --- | --- | --- |
| Whiteboard after saving | [Large laptop](evidence/screenshots/16-whiteboard-1440x900.png) | [Compact laptop](evidence/screenshots/16-whiteboard-1366x768.png) |
| Greenboard hierarchy and ownership | [Large laptop](evidence/screenshots/14-greenboard-1440x900.png) | [Compact laptop](evidence/screenshots/14-greenboard-1366x768.png) |
| Roadmap | [Large laptop](evidence/screenshots/15-roadmap-1440x900.png) | [Compact laptop](evidence/screenshots/15-roadmap-1366x768.png) |

[Tilted Whiteboard](evidence/screenshots/13-whiteboard-tilted-1440x900.png) records the transformed interaction view. Actual checks additionally verified the card-title hit, nonzero drag, Escape restoration without a native write, stale-draft preservation, explicit reload, six retained work links, saved keyboard placement and independently scrolling card details. Save/Discard/Donna controls remain reachable at both tested sizes.

## What is being verified

- Whiteboard preserves every goal/job/outcome link, retains stale drafts, rejects outdated revisions, and cancels transformed drag gestures without saving.
- Greenboard shows real hierarchical assignments and distinct primary/helper responsibilities. Roadmap links, owners, reviewers, estimates and dependencies remain native records.
- Donna creates a durable brief and paired plan atomically. Retrying an uncertain response preserves its original identity; a changed body cannot reuse it.
- Actual native jobs enforce distinct producer and reviewer phases, fixed total budgets, immutable artifact hashes, current scope and explicit acceptance. A failed review produces a nonaccepting receipt and a bounded repair route.
- Review output and model completion are not proof that code ran. Test providers are synthetic; actual external development authorship is separately accounted.
- VS Code uses the shared renderer/backend. Repeated reads remain bounded, mutation deduplication persists, stale edit contexts stay frozen and cancellation releases request resources.
- MCP exposes bounded canonical IDs and paired metadata while worker acceptance/failure actions remain unavailable through owner tools.
- Upgraded state exports/restores all review and ownership metadata without rewriting authored text or silently changing schema versions.

## Independent review corrections

The first three reproduced native/worker defects and their repaired confirmations are retained under `evidence/`: long briefs disappeared after the recent-chat window, a cancelled helper did not stop the producer, and malformed reviews left downstream goals stuck. The confirmation runs used the real rebuilt native core and worker with synthetic providers and made zero external calls.

Additional counterreview corrections include actual-byte revalidation of accepted producer handoffs, parsing verdicts as strings rather than coercing arrays, review coverage recomputed after UTF-8 context compaction, a cloud hash projection for evidence references, bounded read polling, atomic uncertain-save recovery, all-link roadmap editing and true tilted-drag browser assertions.

## Execution ledger

| Local gate | Observed result |
| --- | --- |
| Rust native core | 118 passed; no failures or skips |
| Desktop/portable backend | 740 passed in 50 test files |
| Shared renderer interactions | 422 passed; DOM fixtures, not visual acceptance |
| ETA planner | 17 passed, included in the desktop count |
| Board geometry | 7 passed, included in the desktop count |
| Headless runtime + both MCP suites | 188 passed, 2 explicitly skipped for unavailable tmux, 0 failures; 190 total |
| VS Code local suite | 132 passed; no failures or skips |
| Python private export/restore | 9 passed |
| Real native/worker repair reproductions | 4 cases in 3 finding groups passed; synthetic providers |

Initial broad-run failures were corrected, not waived: the old panel fixture did not settle the new review jobs; the export parser rejected office schema2; the model-resource adapter still used the old queue contract. A nondeterministic optimizer fixture also revealed that planned reviewers needed protection from duplicate-staff optimization. The final native fix protects planned and roadmap reviewers and still pauses an unrelated idle duplicate. Two optimizer tests passed 20 fresh-UUID repeats; those are two unique tests, not forty new tests.

Model-resource planning now freezes the distinct helper, existing model assignment and resource use grant. The adapter verifies both native phases, preserves the original total token allowance, gates dependencies on accepted reviews, and cancels both phases. A historical uncertain receipt can recover IDs for inspection/cancellation; it cannot replay execution. These are request ensembles, not newly trained MoE weights.

## First exact-source CI and correction

Run [44987692247](https://github.com/occult-kranti/engineering-intelligence-atlas/actions/runs/44987692247) tested `583a70e36f66ffabb2ea6c9e0976b38f83ba394f`. Windows installed VSIX acceptance passed nine checks; Linux passed eleven, including actual dedicated tmux detach/reconnect and a single bounded host fixture with policy restored off. Linux ran all 122 headless tests with zero skips. The Windows extension suite passed 125 tests and explicitly skipped seven Linux-only wrappers; Linux passed all 132.

The final browser stage failed during fixture setup after twelve successful canvas checks: it read the deliberately omitted transient `snapshot.lastAction`. The correction resolves the saved primary job by its immutable request key, company and phase. This changes the fixture to follow the public contract; no application assertion is removed. The failed receipt is retained as `evidence/ci-583a70e-browser.json`.

The last independent resource counterreview also reproduced an ordinary native Ollama producer starting before its helper's model grant was checked. The fallback now validates the unique reciprocal canonical pair and both current grants/model assignments before either phase. A real-runtime regression verifies zero reservation/generation for missing or revoked helper access, no automatic retry after permission repair, an explicit new successful pair and malformed/tampered pair rejection.

The follow-up also makes the managed reviewer use the full canonical producer requirement, even when the review job's display label is abbreviated. Both full and compact prompt paths retain the complete criteria and bind them into the context hash. A requirement that cannot fit the original allowance fails explicitly without reservation. Greenboard's actual screenshot exposed excessive spacing above employees; the scoped CSS now compacts hierarchy spacing while preserving type and control sizes. The final browser gate verified initial employee-name visibility after an explicit fixture scroll reset.

## Global refresh wiring correction

Run [44988659972](https://github.com/occult-kranti/engineering-intelligence-atlas/actions/runs/44988659972) tested `884fe704be033dbe1882dc0c0a1ba33651fec615`. Both installed VSIX checks passed again, as did every native/backend/editor suite. Linux ran all 123 headless tests with no skips. The browser passed twelve canvas checks and then timed out waiting for the selected company after an external native write and global Refresh. Its failed receipt is retained as `evidence/ci-884fe70-browser.json`.

This exposed a production wiring defect: the global Refresh button read repository/project data but omitted the native office snapshot used by boards. It now awaits both existing, independently deduplicated read paths. The stale-board regression uses that visible global control and requires the externally changed card title and stale-revision status to render while preserving the unsent draft and original write revision. A separate helper reviewed this correction. The final browser run passed the retained assertions against the corrected product behavior.

## Tilted interaction and inspector follow-up

Run [44989411163](https://github.com/occult-kranti/engineering-intelligence-atlas/actions/runs/44989411163) tested `d4f8face58780f84a5f3f0172011a53c4b55fe2a`. All native, backend and installed-platform checks passed, including 420 renderer interactions. The browser advanced to fourteen checks: it confirmed native multi-link saves and stale-draft rejection through the corrected global Refresh. The tilted pointer did not reach the intended card; the resulting screenshot showed the overlapping Blueprint panel active. This was a pointer-target failure, not proof of incorrect inverse geometry. Its receipt remains in `evidence/ci-d4f8fac-browser.json`.

The live form layer now composes its coplanar panels with normal stacking before the shared world camera transform. Architectural relief retains its 3D rendering context, and no artificial depth offset changes pointer projection. The browser now records the real element hit at the pointer location, checks that Whiteboard remains active after tilt, and keeps all overlapping panels present. Its existing nonzero drag-preview and Escape/no-native-write assertions remain.

The screenshots also showed that the long inspector scrolled the board itself out of view. Whiteboard now constrains the work area and scrolls its inspector independently. The final browser run passed the requirement that Save leave the board body at its original scroll position, and the captured layout passed independent visual review.

## Inner-card Escape event correction

Run [44990066263](https://github.com/occult-kranti/engineering-intelligence-atlas/actions/runs/44990066263) tested `65809cd5a5ef7c0d9a5c45249efb1dab6ad32f31`. All installed-platform and native/backend suites passed. The browser confirmed the long-inspector scroll correction, active Whiteboard ordering, an actual hit on the tilted card title and a nonzero drag. Escape still left the preview displaced. The failed receipt is retained as `evidence/ci-65809cd-browser.json`; no native rollback assertion is claimed for that failed attempt.

The cause was event ownership: the outer scene consumed a bubbling Escape before the temporary window bubble listener for the inner-card gesture. That active gesture now listens in window capture and removes its listener with the matching flag. It cancels before outer selection/navigation, restores its original paint and removes the pointer-release handler. The regression sends Escape from the real card element through the mounted scene and checks that a later pointerup cannot save. An independent helper reviewed the correction and both actual screenshots. Both subsequent successful browser runs verified the correction.

## Successful browser gate and visual status correction

Run [44990637095](https://github.com/occult-kranti/engineering-intelligence-atlas/actions/runs/44990637095) tested `0f6b8962abe6685b3cb70252d84a85735873c02c` and passed both platform jobs, all native/backend suites and all seventeen browser checks. Nineteen actual screenshots were captured. The browser proved a real tilted-card hit, nonzero drag, Escape restoration with no native write, separate inspector scrolling and all three board views at both laptop sizes. The passing receipt is retained as `evidence/ci-0f6b896-browser.json`.

The independent visual review then found one status-decoration inconsistency: the stale-edit border remained after an explicit reload or acknowledged movement accepted a new base revision. The final correction clears that decoration only after the dirty-draft guard permits the new base or reset. Real stale refreshes and rejected writes retain the warning. The existing renderer tests and browser workflow now explicitly distinguish those states. Run 44991164221 passed all exact-source gates for this final correction. Independent inspection of the final Whiteboard captures at both laptop sizes confirmed that the obsolete warning is absent and the accepted layout remains intact.

## Boundaries

The stopped Vast instance remains stopped. No user GPU, SSH host, downloaded model, external service installation, trained MoE, live ChatGPT MCP session or physical-GPU soak was activated. The browser gate uses sandboxed Chrome in CI; software WebGL rendering is reported as such. Bounded lifecycle and idle tests cannot prove an indefinite absence of memory leaks.

The previous release `v0.9.0-preview.1` is not replaced by this branch work. The outer workspace schema remains version 1. The native office schema migrates from 1 to 2 while retaining historical records and without fabricating reviewers. Older native binaries reject office version 2. Export/restore supports office versions 1 and 2 and rejects unsupported future versions. Use the matching source-built package and keep a private workspace export before switching versions.

## Claude budget

Actual Sonnet development contribution: request `1de8d1e3-093c-4436-ad4d-d58330d5419b`, 2,168 input and 10,484 output tokens, $0.109176 calculated usage. With the preceding laptop-canvas call, the latest shared $20 allowance accounts for $0.234182, leaving $19.765818. This is usage accounting, not an invoice or account balance. Older uncertain reservations remain unchanged in `project/claude-usage.json`.
