# Backend architecture, prompt caching and execution accounting

Reviewed 2026-11-20. This report separates changes present in the repository from
provider documentation and proposed follow-up architecture. No live model calls,
paid cache warming, production database migrations or cost benchmarks were run.

## Current conclusion

The web Director is a bounded document-generation DAG with durable rows and events,
but its dispatch lock is still process-local. The changes below make context
assembly, cache accounting and common database reads more predictable. They do
not turn the web scheduler into a distributed worker service. The desktop Office
worker and native company control plane are separate components; their job leases
and exact-context text reuse should not be confused with web prompt compilation.

Implementation evidence: [scheduler](../site-source/api/engine/scheduler.ts),
[provider adapters](../site-source/api/ai/provider.ts),
[desktop worker](../desktop-shell/src/main/officeWorker.ts), and
[native core](../native-core/).

## Three different caches

| Layer | What it reuses | Invalidation and boundaries | What it does not prove |
| --- | --- | --- | --- |
| Web compiled-prefix LRU | The string containing reviewed skill instructions and the artifact contract | Owner, provider, model, prompt version, pinned skill and actual source hash; 128 entries, 2 MiB, five-minute TTL | A provider cache hit, lower token count, or a free generation |
| Provider prompt cache | Provider-managed processing of an eligible identical prefix | Provider/model rules; stable prefix; OpenAI owner-scoped hashed key; configured cache prices; optional exact-model explicit breakpoint | Reuse of a previous answer or guaranteed savings |
| Desktop Office output cache | A previously stored text artifact for the exact supported job context | Office worker context includes company, employee, full system/task prompt, dependencies/knowledge, provider/model, prompt version and output allowance | Fresh research, updated external facts, or permission to replay side effects |

The first layer is implemented in
[`prompt-context.ts`](../site-source/api/engine/prompt-context.ts). It avoids
rebuilding identical instructions and bounds retained memory. It intentionally
does not cache dynamic goals or generated outputs. Provider hints live in
[`prompt-cache.ts`](../site-source/api/ai/prompt-cache.ts). Desktop output reuse is
implemented separately in `OfficeWorker`; review its own tests and release evidence.

### What current provider documentation establishes

**OpenAI:** eligible prefixes and cache controls differ by model generation.
Explicit breakpoints are supported on newer models; a shared prefix alone is not
always a reusable implicit boundary. Read and write tokens can have different
prices. Cache keys do not guarantee a hit. Newer Responses models treat top-level
instructions differently from an initial developer message. These details justify
checking the installed adapter and exact selected model rather than forcing one
retention policy onto every model.
[Official prompt caching guide](https://developers.openai.com/api/docs/guides/prompt-caching).

**Anthropic:** cache boundaries cover the preceding tools/system/messages prefix.
The default ephemeral cache and longer-lived options have different write costs.
Raw Messages API usage separates ordinary input, cache creation and cache reads.
That raw representation differs from the normalized total exposed by the installed
AI SDK. The implementation therefore reads SDK cache details without adding them
again to its total input.
[Official prompt caching guide](https://platform.claude.com/docs/en/build-with-claude/prompt-caching).

Local adapter evidence is the locked `@ai-sdk/openai` and `@ai-sdk/anthropic`
source/types under `site-source/node_modules/`, plus `package-lock.json`.
The current code uses `generateObject` with `maxRetries: 0`. It supplies supported
provider options through that SDK. Mocked adapter tests prove those options reach
the SDK call; they do not prove a production provider will return a cache hit.

### Implemented policy

The engine requests provider caching only after both cache read and write prices
are configured for the selected provider/model. Anthropic receives an ephemeral
breakpoint at the end of stable system content. OpenAI receives a hashed owner,
model and prefix key; explicit mode is used only for an exact model ID in
`OPENAI_EXPLICIT_CACHE_MODELS`. Without that opt-in, OpenAI retains its ordinary
model behavior. No warming call, long-lived retention override or model upgrade
is made. Operators should configure explicit mode for supported models where
different task suffixes would otherwise prevent useful prefix reuse.

## Bounded context and handoffs

The web scheduler now selects accepted artifacts only from incoming **artifact**
edges. Control edges establish execution order without copying their content into
the next model request. SQL selects IDs, producing node, title, summary and full
content hash; it no longer loads every artifact row and filters them in JavaScript.
References are deduplicated and sorted before serialization.

The stable prefix carries the pinned skill and output contract. The changing suffix
contains the node goal, deterministic run seed, allowed capability labels, source
URLs and accepted summaries. A skill over 16,000 characters or handoff JSON over
24,000 characters produces an explicit error before a model call. This replaces
silent skill truncation. These are character limits for predictable assembly,
not model-specific token counts or a proof that every prompt fits every model.

The new `prompt_prepared` event records versions, digests, lengths, reference count
and local cache reuse. It does not record raw prompts, source bodies, private
reasoning, credentials or the dynamic goal. Useful return summaries should expose
conclusions, evidence, decisions, assumptions and open questions. Private model
reasoning is not an audit artifact.

**Research basis:** Anthropic's context-engineering guidance favors selecting
useful context and loading detail when required. Its tool-context guide separates
tool search, programmatic calls, prefix caching and context editing; they solve
different problems. The current web node cannot execute tools, so tool-search
claims would be premature. These sources inform the design; they do not measure
this repository's improvements.
[Context engineering](https://www.anthropic.com/research/effective-context-engineering-for-ai-agents),
[tool context](https://platform.claude.com/docs/en/agents-and-tools/tool-use/manage-tool-context).

## Usage, pricing and stopping behavior

The shared usage contract now distinguishes observed zero from missing usage.
It carries cache read/write input counts and whether the breakdown is complete.
Blank environment prices are unconfigured, rather than silently becoming zero.
Owner-saved prices are validated through the same shared schema as new input.

For a complete normalized input breakdown, configured-rate cost is:

```text
ordinary_input = total_input - cache_read - cache_write
USD micros = ordinary_input × input_rate
           + cache_read × cache_read_rate
           + cache_write × cache_write_rate
           + output × output_rate
```

Rates here are USD per million tokens, so the numeric sum is already USD micros.
The result is rounded once. If requested caching has an incomplete category split,
the engine applies the highest configured input-category rate to total input and
labels the estimate conservative. A reported cache category without a price, or
missing total usage, is marked unknown.

Unknown accounting does not discard a successful generation: the engine attempts
artifact storage, records the artifact, leaves it unaccepted and stops downstream
dispatch. The numeric ledger may contain a zero placeholder or partial estimate;
the `budget_recorded.pricingStatus` event is the authority for its interpretation.
It must not be presented as proof of a zero-dollar provider call. Storage failure
is separately recorded and also prevents acceptance.

Post-call budget checks preserve partial artifacts. They now enforce a node's
dollar cap as well as run cost, tokens, calls and elapsed time. A budget stop no
longer silently accepts an artifact whose node requires human acceptance.
Configured rates still are estimates, not a final provider invoice. A call already
in flight can consume its allocation before a post-call stop. Durable reservations
and reconciliation remain necessary for a strict company-wide cloud budget.

Provider guidance independently emphasizes that missing usage is unknown and can
arrive after completion; it is not zero. The local runtime does not implement the
OpenAI managed tracing API simply because it uses similar event terminology.
[Official tracing guide](https://developers.openai.com/api/docs/guides/agents-api/tracing).

## Database changes and provenance

| Read path | Change present now | Validation boundary |
| --- | --- | --- |
| Registry URL membership | Stored SHA-256 index plus full URL comparison | Avoids an oversized full UTF-8 URL index; exact URL remains available |
| Accepted upstream artifacts | `(run_id, node_key, accepted)` index and narrow SQL projection | Index matches equality/filter columns; no query-plan benchmark was run |
| Approval gates | `(run_id, node_key, kind, state)` index | Speeds the intended gate lookup; uniqueness behavior is unchanged |
| Per-node cost | `(run_id, node_key)` budget-ledger index | Supports node cost reconciliation without scanning unrelated runs |
| DAG validation references | Promise memoization within one validation context | Repeated pins/roles/URLs coalesce; a fresh request gets fresh lookups |

The original import omitted SQL while retaining snapshots. Reconstructed baseline
SQL, original metadata provenance and the separate existing-database URL upgrade
are documented in [database setup](../site-source/db/README.md).
`0002_handoff_indexes.sql` contains three `CREATE INDEX` statements only. No
database was contacted, and no destructive data migration was performed.

## Proposed next execution architecture

This section is a design recommendation for the web runtime, not implemented
distributed behavior. Keep MySQL as the system of record initially; adding a queue
service before defining durable ownership would add another recovery boundary.

1. Introduce a `work_items` row for each `(run, node, attempt)`, with a unique
   idempotency key, state, owner, lease token, expiry, next eligible time and
   artifact pointer. Add an outbox row in the same transaction as readiness.
2. Claim ready work in a short transaction, reserve its permitted cost and token
   allowance, and commit before calling a provider. Check the company, project,
   run and node budget hierarchy in that transaction. Never hold database locks
   during model inference.
3. Heartbeat a lease with compare-and-swap ownership. A stale worker cannot accept
   an artifact or settle a reservation after a newer lease supersedes it.
4. Persist generation output and observed usage before settling the job. A timeout
   after dispatch becomes an accounting-unknown attempt, not an automatically
   replayable request. Reconcile it explicitly; an HTTP timeout does not establish
   that the provider did no work.
5. Use outbox delivery for wake-ups. Delivery can repeat; the durable claim makes
   each state transition idempotent. Keep deterministic acceptance and human gates
   separate from the producing worker.

MySQL documents `SKIP LOCKED` for competing workers on queue-like tables, while
warning that skipped rows yield an inconsistent view unsuitable for general
transactional reads. If used here, restrict it to work claiming and verify the
actual hosting database's compatibility. The current TiDB/MySQL abstraction is
not evidence that every backend supports the same locking semantics.
[MySQL locking reads](https://dev.mysql.com/doc/refman/8.4/en/innodb-locking-reads.html).

For Donna's single conversation, prefer one manager retaining response ownership
and invoking narrowly scoped specialists. OpenAI distinguishes this from a handoff
that transfers conversational ownership. Add a specialist when tools, policy or
the output contract differ, rather than creating one model call per organization
chart box. Anthropic's multi-agent research report shows benefits for parallel
research but also describes coordination and evaluation costs; that is not proof
that more agents always save tokens.
[OpenAI orchestration](https://developers.openai.com/api/docs/guides/agents/orchestration),
[Anthropic multi-agent research](https://www.anthropic.com/research/multi-agent-research-system).

## Compaction and evaluation decisions

Provider compaction belongs to a future multi-turn execution adapter. OpenAI
returns opaque compaction state that must be carried forward as documented.
Anthropic offers server-written summaries with on-demand and threshold variants,
with platform/beta compatibility rules. Do not decode private reasoning or mix
provider state formats. The current one-call-per-node document producer already
hands off summaries, so adding a compaction call now would add work without a
demonstrated need.
[OpenAI compaction](https://developers.openai.com/api/docs/guides/compaction),
[Anthropic compaction](https://platform.claude.com/docs/en/build-with-claude/compaction).

Before increasing agent counts or enabling long-running loops, evaluate a fixed
task set with the same models, skill versions and source snapshots. Compare one
worker with a small specialist DAG; record accepted-result quality, evidence
coverage, invalid citations, wall time, total tokens, cache categories, configured
cost, retries and incomplete attempts. Include owner isolation, changed skill
hashes, missing usage, stale leases, storage failures and human-gate cases. Measure
cold and repeated runs separately. Any claimed savings must come from these
measurements, not provider marketing percentages or character-count reductions.

## Verification at this checkpoint

- `npm run check`: passed web/server TypeScript.
- `npm run check:migrations`: passed three migrations, 54 statements, 19 tables;
  this was an offline schema/SQL consistency check.
- `npm run build`: passed portable frontend and bundled server build.
- `npm test`: 75 passed, 22 explicitly skipped across 13 files. Added tests cover
  cache isolation/expiration/size, stable prompts, usage category accounting,
  mocked provider option wiring and real scheduler transitions against doubles.
- Database/storage/live-model suites were not enabled locally. CI has a disposable
  MySQL connector/vault job with provider requests mocked; no production DB result
  or live cache-hit result is claimed.
- Android Node tests and Capacitor sync passed earlier. Gradle download and local
  Chromium launch were blocked by this environment; native Android packaging and
  browser UI execution require their own successful release evidence.

The root release report should replace these checkpoint results if later code
changes require another run. Rebuild static `docs/` after all frontend edits.
