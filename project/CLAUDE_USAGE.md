# Claude development usage

Current checkpoint: **Endless blueprint three-round laptop pass in progress**, separately from the already published0.9.0-preview.1. Historical receipts keep their original source and UTC timestamps. The historical **$100** ceiling and previous additional$20 workstream remain recorded. The latest user-authorized **another$20** is a new bounded ceiling for this pass, not a spend target. Its observed use is **$0.125006**. This ledger contains sanitized request accounting, not credentials or private prompts.

| Accounting category | USD | Interpretation |
| --- | ---: | --- |
| Observed development requests | **2.648938** | Recorded non-hosted requests, including external frontend authorship; not evidence of native Donna execution |
| Observed successful hosted request | **0.022140** | Confirmed cloud reply and usage |
| Total observed usage | **2.671078** | Development plus cloud; no allocation added |
| Retained uncertain attempts | **0.769716** | Earlier 0.495762 plus the renderer process reservation 0.273954 after polling was blocked |
| Conservative usage accounting | **3.440794** | Observed usage plus retained uncertainty; historical 100.000000 ledger ceiling retained |
| Cloud allocation | **5.000000 reserved capacity** | Held inside the same global ceiling; contains cloud usage and is not an additional charge |
| Latest Studio expansion | **0.446882 observed / 20.000000 cap** | Four completed provider requests, including two incomplete source responses; no new uncertain reservation |
| Subsequent host-control development | **0.068450 observed** | One completed Sonnet request; shared incremental ceiling now accounts for 0.515332 of 20.000000 |
| VS Code compute source | **0.108386 observed** | One output-limited Sonnet request, completed and repaired locally; shared incremental usage is 0.623718 of 20.000000 |

The totals reconcile to [claude-usage.json](claude-usage.json). Its historical `observedNativeUsd` field covers all non-hosted development requests, including external provider authorship. A reserved allocation, an uncertain attempt and observed usage are separate records. Do not add the $5 allocation to the observed or conservative usage totals, and do not describe an uncertain reservation as a confirmed provider charge.

## Host-control development checkpoint

Sonnet supplied the read-only Vast status CLI and tests in request `b9a3ed18-3dbe-4bff-8de0-f921d6cdcb70`: 1,080 input tokens, 6,629 output tokens, `end_turn`, **$0.068450** observed. Local independent review tightened file, endpoint, hostname and response validation. At that host-control checkpoint, the shared additional $20 ceiling had **$19.484668** remaining. This is source authorship, not live VPS deployment or Donna execution. [Validation](HOST_CONTROL_VALIDATION.md) records the test and connectivity boundaries.

## Request history

| Task | Input tokens | Output tokens | Accounted USD | Result |
| --- | ---: | ---: | ---: | --- |
| Initial MCP coding | 1,912 | 14,000 | 0.143824 | Default thinking consumed the output allowance; no visible code returned |
| Bounded MCP coding | 1,911 | 16,000 | 0.163822 | Complete server recovered; later test-file output was truncated |
| Independent implementation review | 36,998 | 2,739 | 0.101386 | Findings triaged, concrete defects corrected and retested |
| Role-reference loader and tests | 913 | 6,816 | 0.069986 | Complete files returned, integrated, 14 loader checks pass |
| Synthetic public SDK adapter | 65 | 17 | 0.000300 | Production SDK returned the exact public test string; usage observed |
| Blocked private live validation | Unobserved | Unobserved | 0.150000 reserved | Automatic approval review denied the private-data request; no success or actual charge is claimed |
| Native Donna roadmap · platform | 8,519 | 3,062 | 0.047658 | Saved planning artifact; observed usage |
| Native Donna roadmap · design | 7,896 | 3,410 | 0.049892 | Saved planning artifact; observed usage |
| Expert panel · first specialist | 7,786 | 1,690 | 0.032472 | Independent review artifact retained |
| Expert panel · second specialist | 5,553 | 1,841 | 0.029516 | Independent review artifact retained |
| Expert panel · Donna synthesis | 11,915 | 2,056 | 0.044390 | Dependent synthesis used the bounded predecessor artifacts |
| Daftar management review | 10,454 | 3,014 | 0.051048 | Saved governance review; observed usage |
| Daftar directory review | 8,047 | 2,636 | 0.042454 | Saved directory review; observed usage |
| First two hosted preflight failures | Unobserved | Unobserved | 0.135266 reserved | Edge runtime rejected a request option before a confirmed provider response; uncertainty retained |
| Successful hosted Donna reply | 7,800 | 654 | 0.022140 | Confirmed reply after the request-option correction; no tools executed |
| Blocked canvas source review | Unobserved | Unobserved | 0.210496 reserved | Automatic approval review classified public source as private; no provider response or actual charge observed |
| Endless-canvas universe compositor and tests | 20,716 | 6,551 | 0.106942 | Sonnet returned implementation and tests; independently reviewed, corrected and integrated |
| Later frontend design · initial response | 2,986 | 18,000 | 0.185972 | `max_tokens`; incomplete response with confirmed usage |
| Later frontend design · bounded continuation | 18,617 | 13,477 | 0.172004 | `end_turn`; further prototype authorship returned |
| Later frontend design · user-corrected continuous 3D core | 35,302 | 12,432 | 0.194924 | `end_turn`; prototype authorship returned; test and publication acceptance remain separate |
| Blueprint World UI · initial source | 10,854 | 20,000 | 0.221708 | `max_tokens`; partial source with observed usage |
| Blueprint World renderer · polling blocked | Unobserved | Unobserved | 0.273954 reserved | Process outcome unknown; no output observed, reservation retained and no retry |
| Blueprint World scoped core | 8,149 | 9,000 | 0.106298 | `max_tokens`; partial Claude source completed locally |
| Blueprint World UI · bounded completion | 21,954 | 9,171 | 0.135618 | `end_turn`; response returned and received independent local repairs |
| Studio expansion · architectural relief | 4,103 | 5,549 | 0.063696 | `end_turn`; source integrated with local geometry and framing repairs |
| Studio expansion · edit layer initial source | 23,670 | 12,000 | 0.167340 | `max_tokens`; partial source, later completed through a distinct suffix and local repairs |
| Studio expansion · attached UI | 8,153 | 11,000 | 0.126306 | `max_tokens`; partial source completed and repaired locally |
| Studio expansion · edit layer bounded suffix | 18,210 | 5,312 | 0.089540 | `end_turn`; separate bounded completion, independently reviewed and repaired |
| Host-control Vast status source | 1,080 | 6,629 | 0.068450 | `end_turn`; read-only CLI source reviewed and hardened locally |
| VS Code compute connection source | 1,693 | 10,500 | 0.108386 | `max_tokens`; complete manager and partial tests, completed and repaired locally without a billed retry |

The initial MCP call is recorded as incomplete delivery even though the HTTP call completed. Follow-on MCP requests used supported `between_tools` thinking with medium effort. The integrated server was reviewed and hardened by the director; generated code was not accepted merely because the provider returned it.

Accounting uses the [official Claude price card](https://platform.claude.com/docs/en/about-claude/pricing) recorded for these standard/global Sonnet 5.5 requests: $2 per million input tokens and $10 per million output tokens. The original development calls and successful cloud receipt report no cache read/write tokens. The complete sanitized request accounting is in [claude-usage.json](claude-usage.json).

## Endless-canvas coding request

The first canvas request was blocked by automatic approval review because the supplied public source was classified as private. Its **$0.210496** conservative reservation remains recorded; no completed provider response or actual charge is claimed for that attempt.

A new bounded request established all three source files as public using unauthenticated reads and matching hashes. That request completed with **20,716 input tokens, 6,551 output tokens and $0.106942 observed usage**, request ID `d38ebb65-3dd2-461f-baaf-a791eb25a74f`. Sonnet supplied the universe compositor and focused tests. Independent review corrected scope continuity, malformed geometry and member-isolation issues before integration. There was no blanket retry of an uncertain billed request, and the earlier reservation was not cleared.

This is a completed coding response and reviewed implementation input. Full integrated testing, packaged application acceptance and publication have separate receipts in [the 0.8.0 validation record](ENDLESS_CANVAS_VALIDATION.md).

## Later frontend design calls

These three requests belong to a separate frontend concept after the 0.8.0 source cut. They are not part of the released 0.8.0 binaries, and they do not alter that release's verification receipt.

| Request | Started at (UTC) | Provider stop | Delivery state |
| --- | --- | --- | --- |
| `9e5e6d72-3568-4b96-a41d-b6d9df74f34d` | 2026-11-21 22:07:05 | `max_tokens` | Incomplete initial concept response |
| `6ac0bd4a-6960-47f5-906b-b8989df286c2` | 2026-11-21 22:10:48 | `end_turn` | Bounded continuation returned |
| `b77160ed-bca8-47ee-8356-296035bb5aa3` | 2026-11-21 22:16:42 | `end_turn` | User-corrected continuous 3D core returned |

The increment is **$0.552900** from observed token usage. It raises total observed accounting from **$0.905830 to $1.458730**. The **$0.495762** retained uncertainty is unchanged, so conservative accounting becomes **$1.954492**. The initial response's output limit does not erase its confirmed usage; the following two responses are separate bounded requests. No earlier uncertain reservation was cleared.

External Claude supplied the prototype's authorship. **Donna inside this standalone concept remains scripted**; these calls do not establish a connected runtime, autonomous employees, provider execution through Donna or a live backend. Subsequent independent review passed all 15 synthetic stress groups for the final prototype, and a separate managed Chromium preview confirmed Donna Send at 20°, 38°, 52° and Top 0°. The [prototype handoff](../design/blueprint-canvas/README.md) pins the exact source hash and distinguishes simulated geometry from browser hit testing. Owner-only Site version 14 was then published and reviewed at Top view with a scripted Donna reply; [its publication receipt](../design/blueprint-canvas/publication.json) records the exact source and deployment. These are prototype acceptance facts, separate from the 0.8.0 release and from provider completion. Only allowlisted request metadata is exported to this ledger; prompts, provider results, credentials and private local paths remain excluded.

## Blueprint World implementation calls

These four records concern the new flat-circle Blueprint World frontend, after the earlier CSS 3D prototype and outside the 0.8.0 binary source. All use `claude-sonnet-5-5` and the existing worker's recorded standard/global token rates. Only the coordinator's allowlisted accounting metadata is included; this update did not read the private ledger.

| Request | Provider outcome | Accounting |
| --- | --- | ---: |
| `7e03532f-c759-4845-b316-27612527f929` | Initial UI source reached `max_tokens`; incomplete delivery with confirmed usage | $0.221708 observed |
| `56a84d27-219a-4746-a14d-55e6a74e019f` | Automatic approval review blocked polling; process outcome unknown and no output observed | $0.273954 uncertain reservation retained |
| `227945a3-4af8-4287-a63b-8b81340656f3` | Core source reached `max_tokens`; incomplete delivery with confirmed usage | $0.106298 observed |
| `297f67fe-791e-42d7-8a83-a055e28d551d` | Separate bounded UI completion ended with `end_turn` | $0.135618 observed |

At that checkpoint, the observed increment was **$0.463624** and the additional uncertain reservation was **$0.273954**, increasing conservative accounting by **$0.737578**. Total observed usage then stood at **$1.922354**, retained uncertainty at **$0.769716**, and conservative usage at **$2.692070**. The prior **$0.495762** uncertainty and the existing $5 cloud allocation were retained. The allocation is capacity inside the same $100 ceiling and is not added to usage.

The core has partial Claude authorship with local completion. The UI has Claude initial/completion authorship plus independent repairs. The renderer was authored locally after the polling block; there is no observed renderer response to attribute to Claude. No uncertain request was retried. The user's later authorization supported continuation of development, and no platform automatic-approval setting was changed.

The original Blueprint World checkpoint recorded 12 independent core groups, 6 independent DOM groups and 11 separate non-GPU renderer mathematics groups passing within their stated scope. The coordinator also recorded 20 grouped native-control observations. Those historical receipts remain intact, including the publication-pending state at commit `287dfdf70bcece1960c7bda364e911c82dea37e2`. The [current handoff](../design/blueprint-world/README.md) distinguishes the subsequently published Studio expansion. **Actual WebGL was unavailable in managed Chrome: GPU visuals, shaders and rendered-scene picking remain unverified.** Donna remains scripted; these development calls establish no real employee execution, runtime provider connection or production access grant.

## Blueprint World Studio expansion

The owner authorized an additional **$20 workstream ceiling** for stronger architectural floorplan depth, explicit Donna/sub-Donna editing and independent testing. Four provider requests used **$0.446882** in observed token-derived accounting, leaving **$19.553118** of that ceiling unused. No new uncertain reservation was introduced, and no uncertain earlier attempt was retried or cleared. The separate incremental cap is recorded in `blueprintStudioDevelopment`; the historical top-level $100 ceiling is preserved.

| Request | Provider outcome | Observed USD |
| --- | --- | ---: |
| `c4b6f586-bbbd-4354-915e-a32c1d212158` | Architectural relief source ended with `end_turn` | 0.063696 |
| `2e4f95d6-8579-424a-95c1-c69c480076f7` | Initial edit-layer source reached `max_tokens` | 0.167340 |
| `f6190f8a-dbe8-422e-886c-61efdba26a8e` | World-attached Studio UI source reached `max_tokens` | 0.126306 |
| `1c332aa7-d34d-4d9c-b9ee-346f9b04bbc9` | Distinct bounded edit-layer suffix ended with `end_turn` | 0.089540 |

All four used `claude-sonnet-5-5`. The two output-limited responses are retained as incomplete provider deliveries even though their source was subsequently completed locally or through the separate bounded suffix. Local review repaired containment, door placement, cutaway behavior, command validation, grants, drafts and UI integration. Authorship does not by itself establish a tested or published result.

The increment raises cumulative observed accounting from **$1.922354 to $2.369236**. Retained uncertainty remains **$0.769716**, so conservative accounting is **$3.138952**. The cloud allocation remains separate capacity, not another charge. No platform automatic-approval setting was changed.

The exact Studio edit module passed [17 independent command-layer groups](../design/blueprint-world/validation/studio-receipt-3a586a4d0905.json), covering explicit grants, company and department scope, current authorization, stale revisions, idempotency, revocation, undo barriers and bounded storage. The final integrated UI passed [14 DOM workflow groups](../design/blueprint-world/validation/studio-ui-final.json), including six earlier regressions and eight Studio workflows. The renderer was deliberately unavailable in that DOM harness. The renderer's separate [21 non-GPU groups](../design/blueprint-world/validation/studio-renderer-evidence.json) cover capacity/dense layouts, framing and 4,100 occlusion rays. They do not establish GPU frame rate or visible graphics quality.

Native review on the published site is recorded separately for [versions 16 and 17](../design/blueprint-world/validation/studio-browser-receipt.json). Version 16 established visitor read-only behavior, Donna edits/history/undo and denied company movement, local sub-Donna scope and immediate grant revocation. Local corrections replaced a no-op reorder permission probe with an actual adjacent-move probe and removed a redundant CEO actor toast; the attached popup was compacted. Final version 17 observations verified persisted delegate/revocation state, the correct actor label, owner undo after revocation, Name-to-Save keyboard focus and popup dragging at 1363 × 936 without HTML-page scroll. The pure/DOM suites establish policy preservation across undo; the revoked actor was not reselected after the final native undo. The older 20 native observations remain tied to their original checkpoint.

Owner-private **Site version 17** was published from source `e0a17a669dd359a4346d9ca7c61e11394fa3760b`; deployment `appgdep_6b0233ef6a648191b6527e6cb6ff0811` succeeded at `2026-11-22T00:14:45.290141+00:00`. The [verified live page](https://atlas-command-office.whatswrong-inc.chatgpt.site/concepts/blueprint-world), [publication receipt](../design/blueprint-world/publication.json) and [Studio run record](../design/blueprint-world/STUDIO-RUN.json) preserve delivery identity. The audience remains one owner with zero editors, groups or external visitors, and no MCP connection was enabled. This Site source commit is separate from the GitHub design-branch history. Publication and the final local repairs added no provider usage.

Studio actors and grants are local synthetic policy, not authenticated account roles or secure multi-user authority. A local sub-Donna employee definition and grant do not start a worker. Donna chat remains scripted, and the prototype has no live provider/runtime adapter. The local-preview reload was rejected by browser URL policy and was not retried or bypassed; the browser subsequently accepted the authorized published HTTPS destination for live review. The graphics gap remains explicit: managed Chrome cannot create WebGL2 here, so native observations use the graphics-unavailable path and this record claims no GPU appearance, shader, rendered-scene picking or frame-rate acceptance.

## Completed Donna rounds

The initial two-roadmap round added **$0.097550**, finishing at `2026-11-21T01:28:42.866Z` (20 November, New York). The three-request expert panel added **$0.106378**, with its persisted-state receipt completed at `2026-11-21T01:40:26.032617+00:00`. Together they added **$0.203928**.

The follow-on Daftar management and directory reviews added **$0.093502**, finishing at `2026-11-21T02:07:06.861Z`. Each of those two goals had a **$20 workstream cap inside the existing $100 ceiling**. A cap is not spend. Both jobs completed with retained artifacts and observed usage. The owner had authorized the private context used by these later requests; this does not change the blocked outcome or retained uncertainty of the earlier attempt.

These are completed planning/review requests. They do not establish autonomous code execution, successful tests or deployment. The director and implementation workers integrated the accepted recommendations separately; [VALIDATION.md](VALIDATION.md) records their actual checks.

## Cloud accounting and limits

The first two hosted attempts failed on the edge runtime's unsupported `redirect:"error"` option. The corrected adapter handles redirects manually and rejects redirects before forwarding credentials. The two retained reservations still total **$0.135266**; no successful reply or actual charge is inferred for those attempts. The later successful request is recorded separately with **$0.022140** observed usage.

The $5 cloud allocation contains **$0.157406** in observed-plus-uncertain cloud accounting at this checkpoint. Its remaining capacity is not a second global budget. Native admission continues holding the allocation until explicitly reconciled; this conservative hold can exceed observed cloud consumption without representing additional spend.

This is token-derived development accounting, not a provider invoice, account balance, or prediction of future charges. ChatGPT orchestration, local test fixtures, GitHub CI, and machine costs are not represented as Claude API charges. The tool reserves a conservative maximum before a request and never retries an uncertain billed attempt automatically. Credentials and private provider responses are excluded from the repository.

The application has an owner-editable policy. A fresh installation's $10 default, 80% warning and disabled dispatcher are distinct from this authorized $100 development session. Permanent employee records, company imports, authority grants, source indexing and the recorded live sync do not themselves make model calls. The completed management setup and synchronization receipts report zero provider calls.

The historical production-adapter validation sent only a fixed synthetic string, with no repository, portfolio or connected account data; see [its receipt](PUBLIC_ADAPTER_VALIDATION.json). The blocked private attempt remains recorded separately. Later owner-authorized native rounds and the hosted reply now have their own observed usage. No uncertain billed attempt was automatically retried or silently cleared.

## VS Code compute connection source

Request 28 (`11444cac-b59f-4523-9eea-f560e87b6b7f`, Claude Sonnet 5.5) returned the connection manager and partial tests: 1,693 input tokens, 10,500 output tokens, observed cost **$0.108386**. The response stopped at `max_tokens`; the truncated tests and concrete lifecycle/validation defects were repaired locally. No billed retry was sent.

The shared additional $20 ceiling now has **$0.623718** of observed source-generation usage and **$19.376282** remaining. This is development authorship accounting, not a claim that native Donna employees ran those calls or that VPS infrastructure is free. Earlier unresolved reservations remain preserved in the ledger.

The subsequent God mode, activity journal, adaptive worker, setup flow and installed-package verification work introduced no additional Claude API request. Current totals retain all earlier uncertain reservations.

## Endless blueprint: three-round laptop pass

The new user-authorized **additional $20** ceiling is recorded separately for `laptop-blueprint-20261122`, retaining all historical accounting and uncertain reservations. Request29 (`d477db0c-77e3-46ae-b9d0-3bb690926d43`) used actual Claude Sonnet5.5: **3,138 input /11,873 output tokens**, `end_turn`, **$0.125006 observed**. This pass has **$19.874994** remaining; there was no automatic retry. Updated observed total is **$2.671078**, retained uncertainty **$0.769716**, conservative total **$3.440794**.

Claude supplied the rendering/projection modules. Independent integration removed the superseded table geometry, repaired a recursive error helper, aligned normalization and floating origins, and added failure/resource controls. Authorship does not certify GPU rendering or complete product acceptance; the [three-round plan](../design/endless-blueprint/PLAN.md) records those gates separately. Image-generation tool output has no billing receipt here and is excluded from Claude API token-derived totals.
