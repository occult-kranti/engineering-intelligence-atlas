# Claude development usage

Authorized development ceiling: **$100 USD**. Confirmed usage-derived cost: **$0.479318 USD**. A separate **$0.15 uncertain reservation** is retained after automatic approval review blocked a private-data validation attempt without an observed provider response. Conservative total accounting is **$0.629318 USD**. Other agents made no paid calls.

| Task | Input tokens | Output tokens | Accounted USD | Result |
| --- | ---: | ---: | ---: | --- |
| Initial MCP coding | 1,912 | 14,000 | 0.143824 | Default thinking consumed the output allowance; no visible code returned |
| Bounded MCP coding | 1,911 | 16,000 | 0.163822 | Complete server recovered; later test-file output was truncated |
| Independent implementation review | 36,998 | 2,739 | 0.101386 | Findings triaged, concrete defects corrected and retested |
| Role-reference loader and tests | 913 | 6,816 | 0.069986 | Complete files returned, integrated, 14 loader checks pass |
| Synthetic public SDK adapter | 65 | 17 | 0.000300 | Production SDK returned the exact public test string; usage observed |
| Blocked private live validation | Unobserved | Unobserved | 0.150000 reserved | Automatic approval review denied the private-data request; no success or actual charge is claimed |

The first call is recorded as incomplete delivery even though the HTTP call completed. Subsequent requests used supported `between_tools` thinking with medium effort. The integrated server was reviewed and hardened by the director; generated code was not accepted merely because the provider returned it.

Accounting uses the [official Claude price card](https://platform.claude.com/docs/en/about-claude/pricing): standard/global Sonnet5.5 at $2 per million input tokens and $10 per million output tokens. These calls reported no cache read/write tokens. The complete sanitized totals are in [claude-usage.json](claude-usage.json).

This is token-derived development accounting, not a provider invoice, account balance, or prediction of future charges. ChatGPT orchestration, local test fixtures, GitHub CI, and machine costs are not represented as Claude API charges. The tool reserves a conservative maximum before a request and never retries an uncertain billed attempt automatically. Credentials and private provider responses are excluded from the repository.

The application has its own owner-editable global policy and initially starts with a $10 cap,80% warning and disabled dispatcher. Permanent employee records and company imports make no model calls.

The successful production-adapter validation sent only a fixed synthetic string, with no repository, portfolio or connected account data. See [its receipt](PUBLIC_ADAPTER_VALIDATION.json). The blocked private attempt was not retried; private Claude automation remains pending explicit data-sharing authorization.
