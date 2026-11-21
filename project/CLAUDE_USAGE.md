# Claude development usage

Current checkpoint: **Blueprint World frontend implementation, outside the released 0.8.0 binary source; publication and GPU verification pending**. The [0.8.0 release receipt](release-0.8.0.json) retains its original source and accounting boundary. Historical request receipts retain their original UTC timestamps. Authorized development ceiling: **$100 USD**. This ledger contains sanitized request accounting; it does not contain private prompts, credentials or local source paths.

| Accounting category | USD | Interpretation |
| --- | ---: | --- |
| Observed development requests | **1.900214** | Recorded non-hosted requests, including external frontend authorship; not evidence of native Donna execution |
| Observed successful hosted request | **0.022140** | Confirmed cloud reply and usage |
| Total observed usage | **1.922354** | Development plus cloud; no allocation added |
| Retained uncertain attempts | **0.769716** | Earlier 0.495762 plus the renderer process reservation 0.273954 after polling was blocked |
| Conservative usage accounting | **2.692070** | Observed usage plus retained uncertainty, against the 100.000000 ceiling |
| Cloud allocation | **5.000000 reserved capacity** | Held inside the same global ceiling; contains cloud usage and is not an additional charge |

The totals reconcile to [claude-usage.json](claude-usage.json). Its historical `observedNativeUsd` field covers all non-hosted development requests, including external provider authorship. A reserved allocation, an uncertain attempt and observed usage are separate records. Do not add the $5 allocation to the observed or conservative usage totals, and do not describe an uncertain reservation as a confirmed provider charge.

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

The observed increment is **$0.463624**; the additional uncertain reservation is **$0.273954**. Conservative accounting therefore increases by **$0.737578**. Total observed usage is **$1.922354**, retained uncertainty is **$0.769716**, and conservative usage is **$2.692070**. The prior **$0.495762** uncertainty and the existing $5 cloud allocation remain intact. The allocation is capacity inside the same $100 ceiling and is not added to usage.

The core has partial Claude authorship with local completion. The UI has Claude initial/completion authorship plus independent repairs. The renderer was authored locally after the polling block; there is no observed renderer response to attribute to Claude. No uncertain request was retried. The user's later authorization supported continuation of development, and no platform automatic-approval setting was changed.

The [Blueprint World handoff](../design/blueprint-world/README.md) records an implemented local frontend with 12 independent core groups, 6 independent DOM groups and 11 separate non-GPU renderer mathematics groups passing within their stated scope. The coordinator also observed native-form company creation, local hiring and task ownership/lane/status changes. **Actual WebGL was unavailable in managed Chrome: GPU visuals, shaders and rendered-scene picking remain unverified.** Further browser review and publication are pending. Donna remains scripted; these development calls establish no real employee execution, runtime provider connection or access grant.

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
