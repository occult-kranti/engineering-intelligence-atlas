# Endless canvas 0.8.0 — verification and deployment record

**Status: 0.8.0 published; all eleven required verification jobs, release and Pages passed; matching owner-private website deployed and reviewed.** [The exact publication receipt](release-0.8.0.json) retains package metadata and checksums. This record distinguishes source checks, synthetic browser fixtures, actual native package operation and the live owner session. The published [0.7.0 receipt](release-0.7.0.json) remains a separate historical record.

## Exact source and workflow state

| Receipt | Verified value |
| --- | --- |
| Pull request | [PR #2](https://github.com/occult-kranti/engineering-intelligence-atlas/pull/2), merged by squash |
| Tested pull-request head | `d4f46c169ddd346e6538c02c282f853debf360f1` |
| Merged application source | [`ad9620425ce7b665735bffb2af5e374746516433`](https://github.com/occult-kranti/engineering-intelligence-atlas/commit/ad9620425ce7b665735bffb2af5e374746516433) |
| Source tree | `36a590ebbab1039bd5b13c17edcbe0074c523cde`; identical at tested head and squash merge |
| Required pull-request verification | [Run 44954070788](https://github.com/occult-kranti/engineering-intelligence-atlas/actions/runs/44954070788): all eleven required jobs passed |
| Main verification and release | [Run 44954668181](https://github.com/occult-kranti/engineering-intelligence-atlas/actions/runs/44954668181): all twelve jobs passed, including release |
| Public Pages | [Run 44954668193](https://github.com/occult-kranti/engineering-intelligence-atlas/actions/runs/44954668193): passed |
| Public release | [v0.8.0](https://github.com/occult-kranti/engineering-intelligence-atlas/releases/tag/v0.8.0), release ID `454018201`, published `2026-11-21T22:08:21Z` |

## Implemented scope

| Area | Source and behavior |
| --- | --- |
| Continuous company world | `desktop-shell/src/renderer/freeflow/universe.ts` composes conference-table companies, bounded tabletop previews drawn from actual saved office blueprints and the selected company's full blueprint with stable room coordinates and a scoped camera target. Member projections keep their restricted scene. |
| Live canvas elements | `freeflow/workspace.ts`, `freeflow/canvas-workspace.ts` and `chrome.ts` place existing forms inside movable/resizable panels; preserve drafts and handlers; support keyboard actions, pin/collapse, focus, close/reopen and bounded device-local geometry. |
| Donna hierarchy | `freeflow/donna-team.ts` derives actual employee/contract identities, distinguishes runtime checks from hires and returns typed scoped native proposals. Missing or malformed grants do not imply authority. |
| Owner website entry | `cloud-workspace/app/canvas-route*` resolves authenticated owner entries into the canvas and keeps compact embedded forms. Signed-out entry, visitor restrictions, invitation fragments and existing deep links retain their own behavior. |
| Source review | Shared descriptor plus native reviewer, managed GitHub snapshot integration and OfficeWorker prompt integration. Hashes, coverage and findings produce bounded private reports and Donna handoffs without a model call. |
| Selective Kimi adoption | Original current-model coordination informed by the audited branch. No bulk alternate runtime, generated archive or binary import. |

The source reviewer has no general website fetcher. Its exact-source advisory robots policy is a pure decision function. No VPS rental, real model-weight download, live ChatGPT tunnel, public OAuth rollout, general code sandbox or owner-device keychain acceptance is claimed by this increment.

## Integrated tests and focused regressions

The final logs confirm **643 desktop tests across 42 files**, **361 renderer assertions**, **108 cloud tests** and **55 headless protocol tests**, plus **9/9 real native HTTP/stdio smoke checks**. Native Rust results are 95 tests on Linux and 94 on Windows because of a platform-conditional test. Linux and Windows package jobs both passed. Do not add duplicate platform runs or overlapping focused suites, including the 72-test boundary subset, to those totals.

| Check | Observed result |
| --- | --- |
| Donna crew projection and proposals | 25 tests passed. Includes 16,000 departments, 30,000 employees, exact identities, shared contract boundaries, malformed/expired/revoked/delegated grants, member confidentiality and no execution side effects. |
| Donna standalone TypeScript | Strict compile with `noUncheckedIndexedAccess` passed. |
| Website route policy | 10 targeted Node tests passed for owner routes, company/deep-link propagation, embed mode, sign-in navigation and visitor/invitation boundaries. |
| Website TypeScript | Full `tsc --noEmit --incremental false` passed after the canvas route integration. |
| Form containment audit | Compiled the renderer into an isolated temporary directory and inspected the mounted synthetic DOM: all 36 forms belong to the canvas world. This checks ownership/containment, not visual browser layout. |
| Initial camera ownership | 13 mounted Studio tests passed, including four added regressions. The failure was reproduced before the fix: first real data replaced a requested panel camera with the table's tilted fit. Explicit framing now survives initial loading, visibility, resize and refresh for its initial scope; later company navigation still fits/restores normally. Default table fitting remains covered. |
| Draft, scope and read-only regressions | Renderer coverage retains policy drafts across panel focus, disables preview mutation controls after reparenting, derives a fresh portal's company from confirmed current scope and prevents stale office reads/errors from replacing newer state. |
| Kimi archive and prerelease | Counts and provenance verified; VSIX/MCP Git blobs and downloaded checksum manifest hashed. AppImage metadata digest matches the manifest; its binary was not downloaded or executed in the audit. |

## Executed browser and packaged-application checks

These results are from the final pull-request verification, not from screenshots of an earlier release. The cloud fixture uses synthetic API/session data; it does not establish production authentication. The live production review is recorded separately below.

| Surface | Observed result |
| --- | --- |
| Public atlas and starter preview | 92 route/reload checks, 12 interaction groups and eight contrast checks passed. The lowest measured contrast was 6.18988:1 across the four tested targets in each of two themes. This is the measured set, not a claim about every possible color pairing. |
| Cloud browser fixture | 81 primary checks passed, with 29 primary PNGs, eight matrix PNGs and two capacity PNGs; eight Freeflow matrix cases. The synthetic capacity scene contains 200 companies, 100 rooms, 1,000 desks and 200 boards. These fixtures made zero provider calls and use synthetic authentication/persistence; they do not certify a live owner's credentials. |
| Linux and Windows packaged applications | Both exercised the real native core and persisted a local goal in isolated profiles. Each retained six PNGs, passed all seven canvas interaction flags and confirmed full native-state equality after presentation-only interactions. |
| Shared canvas interaction flags | Concurrent panels, retained drafts, keyboard move, pinning, keyboard resize, Escape cancellation of a pointer gesture and reduced motion all passed. The same conversation DOM survives closing and reopening. |
| Fresh conversation deep links | Four first-brief cases passed the 24 CSS-pixel minimum visible send-button height. Measured button bounds were 113.43 × 31.22 at 1280 × 720 and 129.26 × 35.57 at 1024 × 768. |

Packaged application checks use the CI unpacked applications. They do not establish owner-laptop installation, NSIS installation/upgrade, signing, SmartScreen or OS-keychain acceptance.

## Live private website

The official Site deployment succeeded, and the owner session was reviewed at [the live continuous canvas](https://atlas-command-office.whatswrong-inc.chatgpt.site/workspace/chrome#office). The review returned to the conference table and retained that page as the deliverable.

| Deployment field | Verified value |
| --- | --- |
| Site audience | Owner-private; existing owner access retained |
| Saved Site source | `0449717b8efdee18c3a206fac441e64efc6745bb` |
| Saved version | 13; `appgprj_6b00f398b7f48191a9fd66db3c4554b8~appgver_57b9df32db3481919776758089ec8d99` |
| Successful deployment | `appgdep_6b02142ce61c81918bbdf675b28973fa` |
| Deployed at | `2026-11-21T21:59:14.323269+00:00` |
| Uploaded source archive | 2,877,440 bytes; 124 files |
| Archive SHA-256 | `fb17c941d5364bbd48277cc03341408af847e1daea911ea0f77e68e5f24c1579` |

The live owner review confirmed real saved company/blueprint elements, the movable 400-world-unit Donna panel and its options, readable composer and scrollable history, actual Donna/sub-Donna/department crew, and private signed-in People & access embedded in the same canvas. It changed no memberships, invitations, grants or workers. Personal source registers and identities are not reproduced in this public record.

Source Review and Ledger observer correctly display **Not configured** against the existing saved native-runtime projection. Their implementation in the current source does not establish that the owner's connected runtime has been upgraded or configured. Saved employee definitions likewise do not imply active model processes.

## Candidate corrections retained in the record

| Candidate | Observed issue and subsequent evidence |
| --- | --- |
| `d5e1020` | Browser verification found legacy descendant CSS hiding the CEO element after it moved into the canvas. Linux verification also exposed a blocked test click. The corrected selectors limit legacy hiding to direct children, and the harness navigates the actual directory controls. |
| `bd3ae0d` / [run 44952880237](https://github.com/occult-kranti/engineering-intelligence-atlas/actions/runs/44952880237) | A fresh `?workspace=chat#office` link placed Donna below the viewport: the initial table fit replaced explicit panel framing. The fix retains that choice for its initial scope and reframes after asynchronous requested-company resolution. |
| Startup fix `33d8` | The web gate passed its 92 route/reload, 12 interaction and eight contrast checks. Subsequent geometry review measured a send button only 17–20 pixels high. The final candidate uses Donna's 400-world-unit default and a 24-pixel visible-button assertion. |
| Final `d4f46c` | All eleven required PR jobs passed; the first-brief geometry cases and live owner review passed. The identical source tree was merged as `ad96204`. |

## Publication and remaining acceptance

| Gate | Verified status |
| --- | --- |
| Full native/desktop unit and renderer suites | Required PR gates passed; 643 desktop tests and 361 renderer assertions confirmed |
| Public atlas build, renderer graph and browser matrix | Required PR gate passed; final counts above |
| Cloud API/build, owner entry, embedded forms and narrow visitor/browser matrix | Required PR gate passed; live owner session separately reviewed |
| Linux/Windows packaged applications and installed VSIX | Required PR gates passed; owner-device acceptance remains separate |
| Android build and launcher/JVM tests | Required PR gate passed; Android remains the atlas companion |
| Headless HTTP/MCP and actual container boot | Required PR gates passed; no paid host provisioned |
| Connector, design-tool, backup/hierarchy and checksum gates | Required PR gates passed |
| Main-branch verification and release job | All twelve jobs passed in run 44954668181 |
| Published 0.8.0 tag, exact source and all package digests | Published from `ad96204`; all five package digests match the downloaded manifest |
| Public Pages | Run 44954668193 passed |
| Owner-private website deployment | Successful deployment and live owner review recorded above |

The release workflow reads `desktop-shell/package.json` and publishes only when its required jobs pass. It preserves an existing versioned release instead of replacing assets. Desktop/Android/VS Code and the hosted app have 0.8.0 package metadata; Android uses versionCode 800. Native core, headless/MCP and design-tool component versions are independent and retain their current protocol versions.

The public `SHA256SUMS` was independently downloaded without authentication: 479 bytes, SHA-256 `cd69cf530d0d4c9140f7d1141f2bb0d8a1e41187ed09d1b28ee52cd9a2938c98`. Its digest matches the published manifest asset, it covers exactly the five application packages, and all five entries match GitHub's package digests. Package binaries were not redownloaded, unpacked or executed as part of this checksum comparison. [The machine-readable receipt](release-0.8.0.json) records exact asset names, sizes and hashes. Real VPS/Vast deployment, GPU inference, model downloads, a live ChatGPT connection, installed-owner-device/keychain acceptance and a general code execution sandbox remain separate work.

The provider receipt is separately recorded in [Claude usage](CLAUDE_USAGE.md). A Sonnet coding response is implementation input; passing tests and publication require their own evidence.
