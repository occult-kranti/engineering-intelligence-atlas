# Claude development usage

Current 0.5.0 draft checkpoint: **20 November 2026 (America/New_York)**. Source receipts retain their original UTC timestamps. Authorized development ceiling: **$100 USD**.

| Accounting category | USD | Interpretation |
| --- | ---: | --- |
| Observed native/development requests | **0.776748** | Usage returned by the recorded provider requests |
| Observed successful hosted request | **0.022140** | Confirmed cloud reply and usage |
| Total observed usage | **0.798888** | Native plus cloud; no allocation added |
| Retained uncertain attempts | **0.285266** | Earlier native reservation 0.150000 plus cloud reservations 0.135266 |
| Conservative usage accounting | **1.084154** | Observed usage plus retained uncertainty, against the 100.000000 ceiling |
| Cloud allocation | **5.000000 reserved capacity** | Held inside the same global ceiling; contains cloud usage and is not an additional charge |

The totals reconcile to [claude-usage.json](claude-usage.json). A reserved allocation, an uncertain attempt and observed usage are separate records. Do not add the $5 allocation to the observed or conservative usage totals, and do not describe an uncertain reservation as a confirmed provider charge.

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

The first call is recorded as incomplete delivery even though the HTTP call completed. Subsequent requests used supported `between_tools` thinking with medium effort. The integrated server was reviewed and hardened by the director; generated code was not accepted merely because the provider returned it.

Accounting uses the [official Claude price card](https://platform.claude.com/docs/en/about-claude/pricing) recorded for these standard/global Sonnet 5.5 requests: $2 per million input tokens and $10 per million output tokens. The original development calls and successful cloud receipt report no cache read/write tokens. The complete sanitized request accounting is in [claude-usage.json](claude-usage.json).

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
