# Memory and evidence contract

## Canonical records

Use stable IDs and explicit scope. Nodes contain `id`, `type`, `domain`, `label`, `summary`, `source_ids`, `status`, and optional validity intervals. Sources retain title, URL, actual version/hash, retrieval time, reading depth, and limits. Edges contain source/target IDs, relation, evidence, scope, and optional validity. Formula cards add LaTeX, variables with units, assumptions, derivation, worked example, limitations, and prerequisite IDs.

Keep source identity, confidence, retrieval score, publication, and permissions separate. Never combine them into a single confidence flag.

## Time and corrections

Use `valid_from <= as_of < valid_until`. Record observation time separately from valid time. Preserve superseded observations and history. A current-snapshot export is not complete historical time travel.

## Cache validity

Include query, bounds, snapshot, algorithm, parameters, effective scopes, policy, and active temporal graph in the key. Invalidate source-only corrections. TTL alone does not detect revised evidence. Apply scope revocation before retrieval and cache reuse.

Measure hits and latency at consistent boundaries. Do not equate local cache reuse with provider savings. Persistence across restarts is different from crash durability under power failure; atomic rename alone does not establish the latter without a durability protocol.

## Mathematical distinctions

For nonnegative symmetric adjacency, `L = D - A` and `xᵀLx = 1/2 Σij wij(xi-xj)²`. A connected graph Laplacian is singular before grounding. For row-stochastic `P`, personalized diffusion is `p_next = αPᵀp + (1-α)s`, `0 <= α < 1`. The mass is retrieval affinity, not truth probability.

An portable linked-note graph is not a biological neural network. Physical frequency requires time, dynamics, units, and an observable. Graph layout attraction/repulsion only places vertices visually. A Hopfield-like objective is not automatically physical magnetic energy.

## Rounds and receipts

Record owner, input identity, question, output identity, evidence changes, tests, objections, next action, and actual status. Deduplicate live ownership. Have critics inspect original evidence or raw code rather than producer summaries. Preserve discovered failures and repairs. Do not relabel older reports as a completed new panel.

## Public company integration

The initial Daftar integration supplies bounded public packets to native OfficeWorker and hosted Donna. Existing company knowledge keeps its own authorization path. Local CLI stores accept caller grants; do not expose them as a multi-user service. Public metadata does not assign employees, invoke providers, spend money, or grant tools.
