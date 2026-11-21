# Caching & DAG-Event Optimization Research — desktop-shell + web app

Date: 2026-11-21 · Scope: `/mnt/agents/output/desktop-shell` (Electron shell) and
`/mnt/agents/output/app` (web app: tRPC API + React/TanStack Query frontend +
MySQL/TiDB via Drizzle).

Method: the relevant source was read first (file:line evidence below); external
references were then taken from current official docs/vendor sources only, and
every vendor caching feature is treated as an *option to be measured*, not a
given. No source was modified and no downloaded code was executed.

---

## 1. What the system actually is (code-grounded)

Both apps are already **event-sourced DAG runners** with strong determinism
discipline. The optimization surface is therefore not "add caching" but "make
the event/artifact streams and the deterministic pure functions do the work
that is currently re-done per poll, per dispatch, and per line of JSONL."

### 1.1 Web app (`app/`)

| Concern | Where | Observed behavior |
|---|---|---|
| Append-only run event log | `app/api/engine/events.ts:26-66` | `appendEventTx` locks the run row `FOR UPDATE`, computes `seq = max+1`, inserts under unique `(run_id, seq)` (`db/schema.ts:494-511`). No update/delete path anywhere. |
| Keyset event tail | `app/api/engine/events.ts:68-80`, `app/api/routers/runtime.ts:162-176` | `events.tail { runId, afterSeq, limit≤500 }` — already a correct keyset ("seek") read over `run_events`. |
| Office event log | `app/api/office/store.ts:215-252` | Same seq discipline as run events, keyed `(project_id, seq)` (`db/schema.ts:1017-1033`). |
| Office status snapshot | `app/api/routers/office.ts:141-234` (`buildStatus`) | Per call: loads active blueprint + all assignments + whole worker pool, then **loops rooms calling `roomUsage`**, which is **3 SQL aggregates per room** (`app/api/office/store.ts:343-387`: SUM over `budget_ledger`, distinct runs for minutes, `OCTET_LENGTH` SUM over `artifacts` JOIN `run_nodes`). |
| Frontend office polling | `app/src/views/director/office/useOfficeData.ts:44-55` | Three queries on fixed `refetchInterval` 5s/5s/4s, `retry: false`; `QueryClient` is constructed with **no defaults** (`app/src/providers/trpc.tsx:7`), so `staleTime=0` and every focus/remount of a stale query refetches. |
| Deterministic prompt compiler | `app/api/prompting/compiler.ts:562` (`compilePrompt`) | "No clocks, no randomness, no fetches. Identical input produces byte-identical output." Input is a validated `PromptCompilerInputSchema`. |
| Compiler bridge | `app/api/engine/prompt.ts` (`compileNodePrompt`) | Per dispatch: DB reads for registry resources/profiles/links, deterministic selection (`app/api/registry/selection.ts`), then `compilePrompt`. |
| DAG validation | `app/api/engine/dag-validate.ts:250-258` | Has a **per-call** `skillCache` Map keyed `name@version`; not shared across requests. |
| Skill pin check at dispatch | `app/api/engine/scheduler.ts:899-918` | Every node dispatch re-queries `skills` by `(name, version)` and re-compares `contentSha256`; drift fails the run. |
| Ledger | `app/db/schema.ts:597-624` (`budget_ledger`) | Append-only usage rows (tokens/calls/micros, attempt-tagged). `ledger.byRun` returns the **entire** ledger with no pagination (`app/api/routers/runtime.ts:569-580`). |
| Idempotency | `app/db/schema.ts:674-687` (`idempotency_keys`), `app/src/views/director/workspace/adapter.ts:760` (`newIdempotencyKey`) | Client-minted key per mutation; server stores the response and **replays it verbatim** on key replay. |
| Artifacts | `app/db/schema.ts:542-575` | One row per `(run_id, node_key, attempt)`; body in object storage (`storageKey`), DB holds `contentSha256`, `summary`, `promptMeta` (compiler plan/truncations/redactions — explicitly **never raw CoT**, `schema.ts:560-564, 721-741`). |
| Handoffs | `app/api/engine/scheduler.ts:920-935` | "Reference-only handoffs (spec §9.2): titles + summaries + hashes" — upstream **accepted** artifacts are projected to `{nodeKey, title, summary, sha256}` and fed to the compiler. |
| Steward roles | `app/contracts/office.ts:281-306`, `app/api/office/store.ts:261-294` | Two **permanent, propose-only** workers (`blueprint-ops`, `roadmap-cartographer`), seeded idempotently via unique `(project_id, name)`; capabilities are read/summarize/classify/cite only — they can never start runs or mutate state. |
| Model list cache | `app/api/ai/list-models.ts:4-33` | Existing TTL cache: successes cached briefly, failures never cached. The one in-process cache in the codebase today. |
| Pricing | `app/api/engine/scheduler.ts:305, 937-961` | Grant and pricing are **deliberately never cached across dispatches** (mid-run revoke must degrade the next gate). This is a correctness boundary any cache must respect. |

### 1.2 Desktop shell (`desktop-shell/`)

| Concern | Where | Observed behavior |
|---|---|---|
| Local run event log | `desktop-shell/src/main/projects.ts:655-698` | `appendEvent` appends whitelisted JSON lines to `events.jsonl`. **`readEvents` reads the entire file and re-parses every line on every poll**, then slices `afterIndex..afterIndex+limit`. |
| Incremental renderer | `desktop-shell/src/renderer/office/app.ts:8-16, 239-247, 495, 525` | Renderer already coalesces ~200ms and pages via `readRunEvents afterIndex/nextIndex`; DOM timeline windowed at 500. The transport is incremental; the **read side in the main process is not**. |
| Events endpoints | `desktop-shell/src/main/companion.ts:579-595` (`GET /v1/events/read`), `desktop-shell/src/main/ipc.ts:420-425` | Both call `projectStore.readEvents(projectId, runId, afterIndex)`. |
| Skill registry | `desktop-shell/src/main/skills.ts:98-162` | `SkillRegistry` validates catalog entries and **re-hashes each SKILL.md body at load**; `excerpt()` **re-reads the file from disk on every call** and re-hashes nothing (hash check happens only in constructor). Bodies are data-only; scripts never read/executed. |
| Model catalog | `desktop-shell/src/main/catalog.ts:194-231` | `loadCatalog` reads + re-validates the whole catalog JSON on each call; no memoization. |
| Pure derivations | `desktop-shell/src/renderer/office/derive.ts` | `deriveRooms`, `roadmapRows` etc. are pure over `Project`/`ProjectRun`; recomputed whenever state changes, no memoization keyed by `project.version`. |
| Approval dedup | `desktop-shell/src/main/projects.ts:708-739` | `getOrCreateApproval` keys approvals by `sha256(canonicalJson({kind, projectId, runId, nodeId, payloadHash}))` — a good content-hash idempotency precedent already in the codebase. |
| Canonical hashing | `desktop-shell/src/main/skills.ts:55-65` | `canonicalJson` (sorted keys) + `hashPayload` = sha256 — the exact primitive to reuse for cache keys. A pure-TS byte-identical copy exists in `app/contracts/enterprise.ts:1-16`, so web and desktop can produce identical hashes. |

### 1.3 The DB index reality (`app/db/schema.ts`)

Already good: unique `(run_id, seq)` / `(project_id, seq)` event keys; unique
`(run_id, node_key, attempt)` artifact identity; `(run_id, state, priority)`
claimable index; unique `lease_token`; `(project_id, name)` worker identity;
`(ownerId, scope, key)` idempotency; `(projectId, expiresAt)` grant index.

Gaps that matter for the query paths above:

- `approvals` has only `(run_id)` (`schema.ts:513-540`), but `listPending`
  (`app/api/routers/runtime.ts:178-196`) filters on `state='pending'` joined
  through `runs → projects` on `owner_id` — hot query for the 5s-polled
  `DirectorHome` (`app/src/views/director/DirectorHome.tsx:23-25`).
- `budget_ledger` has `(run_id)` and `(room_key)` but **no `(run_id, id)`** —
  `ledger.byRun` orders by `id` with no keyset cursor, and `roomUsage` joins
  `budget_ledger × runs` on `(projectId, roomKey)` where the room index does
  not cover the join to `runs.project_id`.
- `artifacts` rollup in `roomUsage` joins `(run_id, node_key)` against
  `run_nodes` and filters `runs.project_id` + `run_nodes.room_key` — the
  existing `(run_id, room_key)` index on `run_nodes` helps, but the artifacts
  side is driven off `artifacts_run_idx (run_id)` only.
- `office_assignments` is queried by `(projectId, state='active')` in
  `buildStatus` but indexed on `(roomId, state)`, `(workerId, state)`,
  `(runId)` — a `(project_id, state)` index is missing.
- `exports.list` orders by `createdAt DESC LIMIT 50` on `(project_id)`
  (`runtime.ts:538-548`); fine at 50, but `created_at` is not unique — any
  future deep pagination here must add the `id` tiebreaker.

---

## 2. What the reference systems teach (with citations)

### 2.1 LangGraph checkpoints — snapshot *plus* event log, keyed by thread

LangGraph's persistence model saves a state checkpoint **per super-step** under
`(thread_id, checkpoint_id)`, with node writes stored as separate rows linked by
`(thread_id, checkpoint_ns, checkpoint_id)`; `get_state_history()` replays
history, and resuming with no new input loads the latest checkpoint instead of
re-running [docs.langchain.com/oss/python/langgraph/checkpointers]. Two lessons
map directly:

- **The log is the truth; snapshots are a rebuild accelerator.** Our
  `run_events`/`office_events` are the equivalent of LangGraph's writes tables;
  what we lack is the cheap "latest snapshot" layer that avoids re-deriving
  office state from scratch per poll (§4.3).
- **Thread scoping = owner scoping.** LangGraph isolates all state by
  `thread_id`; our equivalent is `projects.owner_id` — every cache key and
  invalidation path must carry it (§4.6, §7).

Cite: <https://docs.langchain.com/oss/python/langgraph/checkpointers>,
<https://docs.langchain.com/oss/python/langgraph/persistence>,
<https://reference.langchain.com/python/langgraph.checkpoint>.

### 2.2 Temporal event histories — replay determinism is a *design constraint*

Temporal rebuilds workflow state by **re-executing the workflow code against
the recorded Event History**; recorded activity completions supply results
instead of re-invoking the activity, so replay must make the same decisions
given the same history (no wall-clock, no randomness, no unrecorded I/O), and
activities are the nondeterministic boundary that should be idempotent
[docs.temporal.io/workflows]. Our equivalents:

- `compilePrompt` (`app/api/prompting/compiler.ts`) and
  `selectRoleResources` (`app/api/registry/selection.ts`) are already
  Temporal-style deterministic "workflow code" — identical input ⇒ identical
  output. That is exactly what makes a **result cache keyed by input hash**
  safe (§4.1, §4.2).
- The provider call in the scheduler (`generateStructured`,
  `scheduler.ts:1058-1067`) is the "activity": nondeterministic, billed,
  `maxRetries: 0` (`app/api/ai/provider.ts` header). Everything *around* it is
  cacheable; the call itself is only ever de-duplicated, never replayed from a
  cache (§4.10).

Cite: <https://docs.temporal.io/workflows>.

### 2.3 Airflow / Prefect — event feeds as first-class, addressable records

Airflow's data-aware scheduling materializes **dataset events** as stored,
queryable records (`consumed_dataset_events` on a DAG run; a Datasets UI with
the full producer→dataset→consumer dependency graph)
[airflow.apache.org datasets docs]. Prefect Cloud's event feed defines a
structured event spec — `occurred`, `event`, `resource`, `related[]`,
`payload`, client-provided `id`, and a `follows` pointer to a known-prior
event [docs-2.prefect.io events]. The transferable ideas:

- Events carry **resource identity and causal links**, not just messages. Our
  `run_events.payload` is free-form JSON; the `TimelineIndexEntry` (§5.3)
  proposes lifting `resource`/`follows`-style fields (runId, nodeKey, seq,
  artifact refs) into a derived, indexable shape — the same role Airflow's
  dataset-event tables play.
- A **dependency graph view is derivable from events**, like Airflow's
  Datasets graph — basis for the feature-connection graph in §6.2.

Cite: <https://airflow.apache.org/docs/apache-airflow/2.11.0/authoring-and-scheduling/datasets.html>,
<https://docs-2.prefect.io/latest/cloud/events/>.

### 2.4 TanStack Query / browser visibility — poll less, invalidate precisely

Current docs confirm: `refetchOnWindowFocus` refetches **only stale** queries
when the tab regains focus (default `true`); `staleTime` controls how long
cached data is fresh; `refetchIntervalInBackground` defaults to `false`
(intervals pause in background tabs); and `focusManager` can be
paused/overridden [tanstack.com useQuery + window-focus-refetching docs].
Consequences for `useOfficeData.ts` and `trpc.tsx` are in §4.11: the system
already pushes invalidations (`utils.*.invalidate()`) after mutations, so the
fixed 4–5s `refetchInterval` on every viewer is doing work that event
sequence numbers could make mostly unnecessary.

Cite: <https://tanstack.com/query/latest/docs/framework/react/reference/functions/useQuery>,
<https://tanstack.com/query/latest/docs/framework/react/guides/window-focus-refetching>.

### 2.5 MySQL/TiDB — keyset pagination and covering indexes

TiDB's own docs paginate with `LIMIT/OFFSET` for small sets but recommend
keyset/cursor pagination for large or deep pages — offset must scan and skip
rows, while keyset seeks a fixed-size window per page provided the key is
indexed and unique [docs.pingcap.com paginate-results; pingcap.com
limit-offset vs cursor]. CockroachDB's docs (same lesson, clearer benchmarks)
show keyset queries doing an index lookup to the page start vs. a limited scan
of the whole table for offset. Our `events.tail` already does this correctly
against `(run_id, seq)`; `ledger.byRun`, `exports.list`, and the desktop
`readEvents` do not (§4.7, §4.4).

Cite: <https://docs.pingcap.com/developer/dev-guide-paginate-results/>,
<https://www.pingcap.com/article/limit-offset-pagination-vs-cursor-pagination-in-mysql/>,
<https://docs.cockroachlabs.com/docs/stable/pagination>,
<https://docs.gitlab.com/development/database/offset_pagination_optimization/>.

### 2.6 OpenTelemetry span links — causal edges without parent/child

OTel span **links** model causality between spans that are *not* in the same
trace or not parent/child — e.g., a batch consumer linking to many producer
spans; links can cross traces and one span can link to many
[opentelemetry.io traces concepts; spec overview "Links between spans"]. This
is the right mental model for our handoff graph: a downstream node's span
*links* to the spans of each upstream artifact it consumed (they are not its
children), and a `HandoffManifest` (§5.2) is the persistent, queryable form of
those link edges. The run/node seq pairs give us the equivalent of
trace/span IDs for free.

Cite: <https://opentelemetry.io/docs/concepts/signals/traces/#span-links>,
<https://opentelemetry.io/docs/specs/otel/overview/#links-between-spans>,
<https://opentelemetry.io/docs/specs/otel/trace/api/#link>.

### 2.7 Vendor prompt caching — documented, priced, and strictly "measure first"

- **OpenAI**: automatic prefix caching for prompts ≥ the model minimum (1,024
  tokens on current models), exact-prefix match, hits reported via
  `usage.prompt_tokens_details.cached_tokens`; current docs add
  `prompt_cache_key` (routing affinity), `prompt_cache_options` (implicit/
  explicit breakpoints, TTL — default 30-minute write lifetime at 1.25×,
  12-hour at 2.5×, reads at 0.1× on most models). Older behavior (5–10 min
  idle eviction, 128-token increments) still describes earlier models.
  <https://developers.openai.com/api/docs/guides/prompt-caching>,
  <https://developers.openai.com/cookbook/examples/prompt_caching_201>
- **Anthropic**: explicit `cache_control: {"type":"ephemeral"}` breakpoints
  (up to 4), order tools → system → messages; 5-minute TTL default at **1.25×
  base input write**, 1-hour TTL at **2×**, reads at **0.1×**; per-model
  minimum cacheable lengths (512–4,096 tokens); usage fields
  `cache_creation_input_tokens` / `cache_read_input_tokens` expose hits.
  <https://platform.claude.com/docs/en/build-with-claude/prompt-caching>

Both are **prefix** caches: any byte change before the breakpoint silently
invalidates the suffix. That interacts directly with our compiler: because
`compilePrompt` is deterministic and its output is byte-stable for identical
input, our system prompt prefixes are *already* cache-friendly — but the
moment resources/goal-mode degrade differently per node, prefixes diverge and
naive `cache_control` placement would pay the 1.25× write premium on every
missed call. Break-even math from Anthropic's docs: 5-minute caching pays off
from the **second** call on the same prefix; a breakpoint that never gets read
makes the workload strictly more expensive (§7, anti-pattern A4). Therefore:
enable only behind measurement of `cache_read` vs `cache_creation` fields per
strategy/role, and record those fields in `budget_ledger` honestly (they
change what tokens actually cost — the ledger currently prices from configured
rates only, `scheduler.ts:1113-1118`).

---

## 3. Design principles for this codebase

1. **The event logs are the only source of truth; every cache is a derived,
   invalidatable projection.** Matches LangGraph (writes/checkpoints) and
   Temporal (history/replay) practice, and matches the existing invariant
   "no update/delete path for run_events" (`events.ts:7-11`).
2. **Only deterministic, side-effect-free computations may be result-cached.**
   `compilePrompt`, `selectRoleResources`, `computeHirePreview`,
   `deriveRooms`, `roadmapRows`, `buildStatus` (given pinned inputs) qualify.
   Grant/pricing resolution and provider calls never do (`scheduler.ts:305`).
3. **Cache keys are content hashes over canonical JSON**, reusing the
   existing `canonicalJson`/`hashPayload` pair (desktop `skills.ts:55-65`)
   and its byte-identical contract copy (`app/contracts/enterprise.ts`).
4. **Invalidation rides the existing sequence numbers and OCC versions** —
   `run_events.seq`, `office_events.seq`, `blueprint.version`,
   `room.version`, `workers.version` — not timers, wherever correctness
   matters; TTLs only for data that is safe when slightly stale (model lists,
   already the pattern in `list-models.ts`).
5. **Owner scoping is part of every key.** Any cross-request cache entry must
   include `ownerId` (web) or project id (desktop) or be provably
   owner-invariant (skill bodies keyed by `contentSha256`).
6. **Caches never invent tokens.** Ledger entries, summaries, and manifests
   are derived from persisted events/artifacts; no provider call is added to
   build a view (§4.8), and no cache replay ever fabricates a fresh
   idempotency decision (§4.10).

---

## 4. Concrete optimizations mapped to files

### 4.1 Skill/registry/blueprint caches keyed by content hash

**O1a — Desktop `SkillRegistry.excerpt` body cache.**
`desktop-shell/src/main/skills.ts:142-161` re-reads `SKILL.md` from disk on
every excerpt call (every hire preview and every prompt assembly). Add an
in-memory `Map<sha256, { body, excerpt4000 }>` populated at construction time
(the constructor already reads and hashes every body, `skills.ts:113-120`).
Key = the catalog-pinned `sha256`, so a tampered body (already flagged
`verified: false`) can never alias a verified entry. `list()`/`get()` already
return defensive copies; keep that.

**O1b — Desktop model catalog memo.**
`desktop-shell/src/main/catalog.ts:194-231` re-reads and re-validates the
whole catalog per call. Memoize on `(path, mtimeMs, size)`; validation is
pure, so a stat-gated cache is exact. Keep re-validation on any stat change —
the download gate (`assertModelDownloadable`, `catalog.ts:242-251`) must
never see stale validation of a changed file.

**O1c — Server skill-row cache for validation/dispatch.**
`dag-validate.ts:250-258` builds a per-call `skillCache`; `scheduler.ts:899-918`
re-queries `skills` per dispatch. Promote to a shared cache keyed by
`(name, version)` whose payload includes `status` and `contentSha256`,
because the dispatch check compares **both**. Invalidation: `skills` rows are
effectively immutable per `(name, version)` (unique index, `schema.ts:329`)
except `status` transitions (`quarantined → vetted → suspended/deprecated`),
so the cache must be invalidated (or version-stamped) by the review/promote
paths (`runtime.ts:442-447` knowledge promote, skill review endpoints).
Cheapest correct form: short TTL (≤30s) **plus** explicit
`cache.delete(\`${name}@${version}\`)` on every status mutation — never a
status-blind content-only cache.

**O1d — Registry link/profile read-through cache for prompt compilation.**
`engine/prompt.ts` reads `registryRoleProfiles` / `registryRoleResourceLinks`
per dispatch, then runs the deterministic `selectRoleResources`
(`registry/selection.ts`). Registry tables are seeded reference data with
explicit `stale`/link-check columns — cache the *selection input* (links for
a role slug) keyed by `(roleSlug, linksHash)` where `linksHash` is
`hashPayload` over the row ids + `stale` flags + `evidence` levels actually
loaded. Bust on any seed/migration bump; expose the hash in
`promptMeta.resourcesIncluded` provenance so audits can tell which registry
snapshot produced a prompt.

**O1e — Blueprint snapshot caching is covered by O3 (§4.3)** — blueprints are
already versioned (`office_blueprints.version`, `schema.ts:930-931`), which
is the invalidation token.

### 4.2 Prompt-compiler output cache (server)

`compilePrompt` (`app/api/prompting/compiler.ts:562`) is documented as
byte-deterministic. `compileNodePrompt` (`app/api/engine/prompt.ts`) therefore
has a pure core whose result can be cached as:

```
compilerKey = sha256(canonicalJson({
  compilerVersion: PROMPT_COMPILER_VERSION,
  input: PromptCompilerInput,          // already a zod-validated record
  registryHash,                        // O1d — resource snapshot identity
  pricingRatesVersion?                 // only if rates text enters the prompt
}))
```

Cache `CompiledPrompt` (system+user+plan+meta) in-process with a small LRU,
and log hit/miss in the existing `prompt_compiled` event payload
(`scheduler.ts:1020-1049`). **Never cache across `ownerId`** unless the input
record provably contains no owner-specific data — today `goalMode` presets
are owner-settings-derived (`engine/prompt.ts` imports
`GOAL_MODE_SETTINGS_PREFIX`), so include the resolved goal-mode block in the
hashed input rather than scoping the cache by owner. This kills duplicate
compile work on node retries (same attempt inputs) and across identical nodes
in `maxParallelNodes > 1` runs, without ever skipping the `prompt_compiled`
audit event (emit it with `cacheHit: true`).

### 4.3 Office status snapshot invalidated by versions + event seq

`buildStatus` (`app/api/routers/office.ts:141-234`) is the hot path: every
open office view polls it every 5s, and it runs **1 + 1 + 1 + 3×rooms**
queries (pool, assignments, blueprint, then `roomUsage`'s three aggregates per
room, `store.ts:343-387`). Replace the per-poll recompute with a
**version-gated snapshot cache**:

```
snapshotKey = projectId
fingerprint = {
  blueprint.id, blueprint.version, blueprint.revision,
  maxOfficeEventSeq,          // SELECT MAX(seq) FROM office_events WHERE project_id=?  (indexed, (project_id,seq))
  maxBudgetLedgerId,          // SELECT MAX(id) FROM budget_ledger WHERE run_id IN (project runs) — see index note below
  maxWorkerVersionSum,        // COUNT + SUM(version) over workers (cheap, covering)
  roomsVersionSum             // SUM(version) over office_rooms of active blueprint
}
```

Serve the cached `buildStatus` result when the fingerprint matches; recompute
otherwise. Rationale: every mutation that can change the status output already
writes an `office_events` row transactionally (reassign/drain/expire —
`store.ts:192-196, 501-511`), bumps an OCC `version`, or appends
`budget_ledger` rows (`scheduler.ts:1123-1133`). Usage rollups only move when
the ledger moves. The fingerprint queries are single-index seeks against
`office_events_project_seq_idx`, `workers_project_name_idx`-adjacent scans,
and the room indexes — orders of magnitude cheaper than the full rollup.
Supporting index: add `(project_id, state)` on `office_assignments` (§1.3)
and confirm `EXPLAIN` on TiDB shows the `MAX(seq)` as an index-only read.

Desktop equivalent: the office canvas state is derived in
`renderer/office/derive.ts` from `Project`/`ProjectRun`; memoize
`deriveRooms`/`roadmapRows` on `(project.version, run.updatedAt,
eventsNextIndex)` — the renderer already tracks `eventsNextIndex`
(`app.ts:495,525`), so a change in that counter is the precise invalidation
signal.

### 4.4 Incremental run/enterprise timeline after `afterIndex`

The desktop main process currently does O(file) work per poll:
`readEvents` (`projects.ts:677-698`) reads all of `events.jsonl` and re-parses
every line, then slices. The renderer is already incremental; the store is
not. Add a per-run **read checkpoint** in `ProjectStore`:

```
{ fileSize, mtimeMs, lineCount, tailBufferOffset }   // kept in memory per open run
```

On `readEvents(afterIndex)`: if `mtimeMs`/`fileSize` grew only by appends
(`fileSize ≥ lastSize`), read **only the new bytes** from
`tailBufferOffset`, parse those lines, append to the retained parsed array,
and answer from `parsed[afterIndex..]`. If the file shrank or mtime regressed
(rewrite/corruption), fall back to a full reparse — exactly the
"checkpoint + replay the tail" pattern LangGraph uses (`get_state_history` +
resume from latest checkpoint) and the append-only discipline already enforced
by `appendEvent`. Return `{ events, nextIndex }` unchanged; the IPC contract
(`ipc.ts:420-425`, `preload/index.ts:129-130`) and companion route
(`companion.ts:579-595`) stay byte-identical, so this is a drop-in.

For long runs, persist a `TimelineIndexEntry[]` sidecar (§5.3) —
`events.index.json` next to `events.jsonl` — so a cold renderer can rebuild
the timeline list view without parsing payload bodies at all.

The web side already has the correct primitive: `events.tail` keyset-reads
`run_events (run_id, seq)` (`events.ts:68-80`); the gap is `ledger.byRun`
returning unbounded rows (§4.7).

### 4.5 Artifact-ref handoff manifests

Today the handoff is assembled inline per dispatch: `scheduler.ts:920-935`
selects **all** artifacts for the run and filters in JS to upstream accepted
ones, projecting `{nodeKey, title, summary, sha256}`. Two improvements:

- Query precisely: `WHERE run_id=? AND node_key IN (upstreamKeys) AND
  accepted=true` using the existing `(run_id, node_key, attempt)` unique
  index — no full-run scan per dispatch.
- Persist the projection as a first-class, content-hashed record — a
  `HandoffManifest` (§5.2) — either as a `run_events` payload
  (`type: "handoff_manifest"`, zero schema change) or as a column on the
  artifact row of the consuming attempt. Because each entry is just pointers
  (sha256 + title + summary already stored), the manifest is **derivable from
  existing rows with no model call and no raw content**, matching the "never
  raw CoT" rule (`schema.ts:560-564`) and the OTel span-link semantics
  (consumer links to producer spans; §2.6). Downstream cache keys (O2) can
  then hash the manifest instead of re-reading artifact rows, and the
  whiteboard `artifact-ref` node kind (`schema.ts:1083`) can render
  provenance from the same manifest.

### 4.6 Safe owner-scoped cache invalidation

Rules for every server cache introduced above:

- Key material always includes the **identity that scopes correctness**:
  `projectId` for office snapshots (O3), `(ownerId, scope)` — mirroring
  `idempotency_keys` (`schema.ts:686`) — for anything touching owner settings
  (goal-mode presets, pricing rates in `ownerSettings`, `schema.ts:745-760`).
- Owner-invariant payloads (skill bodies by `contentSha256`, compiled prompts
  whose hashed input fully captures their content) may be shared across
  owners **only if the hashed input includes everything owner-specific** —
  otherwise partition by owner. When in doubt, partition: an extra cache
  entry is cheap; a cross-owner leak of goal text is not (§7, A1).
- Invalidation hooks belong **in the same transaction or the same guarded
  code path as the mutation** (skill status change, owner settings write,
  blueprint activate), not on a timer. TTLs are a memory bound, never the
  correctness mechanism — the exception being data already defined as
  stalesafe (`list-models.ts` TTL is the existing template).
- Single-flight recomputation: when an O3 fingerprint changes, one request
  recomputes while others serve the old snapshot (stale-while-revalidate
  within a few-hundred-ms window) to avoid a stampede when a run ends and 20
  open office views poll at once (§7, A3).

### 4.7 DB indexes and query paths

Concrete changes, each verified with `EXPLAIN` on MySQL/TiDB before/after:

1. `approvals`: add `(state, run_id)` (or `(state)` + keep `(run_id)`) —
   serves `listPending` (`runtime.ts:178-196`) which filters `state='pending'`
   and joins to projects for owner scoping. Alternative without schema
   change: drive the query from `projects.owner_id → runs → approvals`
   (already-indexed FKs) and filter state per run; benchmark both.
2. `budget_ledger`: add composite `(run_id, id)`; change `ledger.byRun`
   (`runtime.ts:569-580`) to keyset pagination `{ runId, afterId, limit≤200 }`
   — same discipline as `events.tail` (`events.ts:68-80`), eliminating the
   unbounded full-ledger read in `EvidenceStage`
   (`src/views/director/workspace/EvidenceStage.tsx:26-29`).
3. `office_assignments`: add `(project_id, state)` for `buildStatus`
   (`office.ts:147-155`).
4. `roomUsage` (`store.ts:343-387`): collapse the three per-room aggregates
   into one grouped query per project (`GROUP BY room_key` over
   `budget_ledger JOIN runs`) and one for storage bytes, both covered by
   `(project_id)`-driving indexes through `runs`; or bypass entirely via the
   O3 fingerprint cache, which makes the N+1 moot on steady-state polls.
5. `exports.list` (`runtime.ts:538-548`): keep `LIMIT 50`, but if it ever
   pages deeper, order by `(created_at, id)` with an id tiebreaker —
   `created_at` is not unique (GitLab's offset-optimization guidance
   documents the same requirement).
6. Confirm with `EXPLAIN` that `MAX(seq)` fingerprint reads (O3) are
   index-only on `office_events_project_seq_idx` / `run_events_run_seq_idx`;
   on TiDB these become single-region seeks, which is exactly the keyset
   win TiDB/Cockroach docs describe.

### 4.8 Avoiding provider calls for ledger summaries

The current design is already honest — ledger numbers come from
`budget_ledger`, artifact summaries from the persisted `artifacts.summary`
written by the producing node (`EvidenceStage.tsx:63-67`), exports render
deterministically (`buildMarkdownReport`, `runtime.ts:450-475`). **Keep it
that way**: any "run recap", "room digest", or "what did worker X do" view
must be derived from `run_events` + `artifacts` + `budget_ledger` via the
`WorkLedgerEntry` projection (§5.1) — never by feeding the timeline back into
a model per view. If a natural-language digest is ever wanted, generate it
once per run at completion, persist it as an artifact with `promptMeta`
provenance, and serve the persisted row — the anti-pattern is per-view
re-summarization (§7, A5). The deterministic steward role in §4.9 exists
precisely to make this derivation a first-class, testable function.

### 4.9 Deterministic permanent steward roles

Extend the `PERMANENT_OFFICE_WORKERS` pattern (`contracts/office.ts:281-306`,
seeded in `store.ts:261-294`) with a third propose-only worker, e.g.
`ledger-steward` (capabilities `["read", "classify", "cite"]` — note: **no**
`summarize` in the provider sense; its summaries are template-generated
strings, consistent with the deterministic doc producer rule):

- Seeds idempotently via the same `(project_id, name)` unique-key pattern
  (`store.ts:272-291`).
- Owns the pure derivations: `WorkLedgerEntry[]` per run, room rollups for
  O3, `HandoffManifest` assembly, and the `TimelineIndexEntry` sidecar
  format. Being a *worker row* gives it a seat, a room, an audit trail, and
  zero execution privileges — it cannot dispatch, approve, or call a provider
  (permanent workers are propose-only by contract).
- Deterministic = testable: the same events in always produce the same ledger
  out; that is the Temporal-replay property (§2.2) applied to reporting.

### 4.10 Idempotency vs response caching — the exact distinction

These are different mechanisms and must not be conflated:

| | Idempotency (existing) | Response/result caching (proposed) |
|---|---|---|
| Purpose | Exactly-once **mutation** semantics | Avoid recompute of **reads/pure functions** |
| Key | Client-minted `newIdempotencyKey(scope)` per user action (`adapter.ts:760-767`), stored `(ownerId, scope, key)` (`schema.ts:674-687`) | Server-computed content hash over inputs (§3.3) |
| Replay | Stored response replayed **verbatim** — the mutation does not re-execute, no new side effects, no new events | Cached value returned; the underlying computation is *allowed* to re-run on miss and is free of side effects |
| Freshness | Forever (a decision, once made, is historical fact) | Invalidated by version/seq fingerprints |
| Failure mode if misused | Replaying a *stale decision* as if it were a fresh one (e.g., reusing a key for a mutated payload — prevented because `office.assign` etc. include `expectedVersion` in the input, `useOfficeData.ts:161-184`) | Serving stale data as fresh — prevented by fingerprints (O3) |

Rule: **mutations are idempotency-keyed; reads are cache-keyed; never cache
a mutation response under a content hash, and never treat an idempotency
replay as evidence of current state.** Desktop precedent:
`getOrCreateApproval` (`projects.ts:708-739`) is the content-hash variant of
idempotency — re-requesting the identical payload returns the same pending
record, which is correct because an approval *is* a decision, not a view.

### 4.11 Frontend query tuning (web)

In `app/src/providers/trpc.tsx:7` set explicit defaults instead of the bare
`new QueryClient()`:

- `staleTime: 15_000` globally; per-query overrides where volatility differs.
- Keep `refetchOnWindowFocus` default (`true`, stale-only) — correct with a
  nonzero staleTime.
- In `useOfficeData.ts:44-55`: replace fixed `refetchInterval: 4000/5000`
  with (a) longer intervals (15–30s) as a backstop, and (b) precise
  invalidation driven by data the client already sees: `office.status` and
  `control.pool.status` payloads can carry `maxEventSeq`; when the polled
  cheap fingerprint (one tiny query) is unchanged, TanStack keeps the cached
  snapshot — i.e., poll the **fingerprint**, not the rollup. Background tabs
  already pause intervals by default (`refetchIntervalInBackground: false`).
- Keep the existing post-mutation `invalidate()` calls
  (`useOfficeData.ts:59-65`, `WorkspaceShell.tsx:84,592-593`) — with real
  staleTimes they become the primary freshness path.

Desktop renderer: already coalesces events at ~200ms and windows the DOM
(`app.ts:239-247`); after O4 lands, also skip re-deriving rooms/roadmap when
`eventsNextIndex` and `project.version` are unchanged between ticks.

### 4.12 Vendor prompt caching — gated, measured, ledger-honest

If and only if measurement justifies it (§2.7, §7-A4):

- The deterministic compiler already yields **stable prefixes**: system
  contract first, then curated resources, then upstream refs, then the task
  (verify actual block order in `compiler.ts` before enabling). Put the
  Anthropic `cache_control` breakpoint at the end of the skill+resources
  block, never after upstream refs (those change per attempt).
- Route through `prompt_cache_key = runId` (OpenAI) so same-run dispatches
  land on the same cache; per docs this only affects routing affinity.
- Gate per provider+model in `api/ai/provider.ts` (the single seam) behind an
  owner setting recorded in `ownerSettings`, default **off**.
- Persist `cache_creation_input_tokens` / `cache_read_input_tokens` (and
  OpenAI `cached_tokens`) into `budget_ledger` (new nullable columns or the
  event payload of `budget_recorded`, `scheduler.ts:1139-1153`) and extend
  `priceUsage` so cached-read tokens price at the documented read rate —
  otherwise the ledger overstates cost and the budget gate
  (`runBudgetOverrun`, `scheduler.ts:272`) trips incorrectly. This is a
  measurement requirement, not an optimization: without those fields you
  cannot tell whether caching pays.
- Minimum sizes matter: node prompts below the model minimum (1024 tokens for
  most current models) can never hit; the compiler's byte caps mean many
  nodes will fall under threshold — another reason this is opt-in per
  strategy.

---

## 5. Shared derived schemas (no raw CoT, no extra tokens)

All three are **pure projections of persisted rows** — `run_events`,
`office_events`, `artifacts`, `budget_ledger`, `run_nodes` — derivable by the
deterministic steward (§4.9) with zero provider calls. Field names follow the
existing contracts (`EventActor`, `RunNodeState`, artifact columns). Content
is referenced by hash, never embedded beyond the already-persisted
`summary`/`title`.

### 5.1 `WorkLedgerEntry` — one bullet of accountable work

```ts
// apps: derived from run_events + run_nodes + artifacts + budget_ledger
// (per (runId, nodeKey, attempt)); desktop: from events.jsonl + artifacts dir.
interface WorkLedgerEntry {
  // Identity
  runId: number | string;          // number (web) / string (desktop)
  nodeKey: string;                 // run_nodes.node_key
  attempt: number;                 // artifacts.attempt / budget_ledger.attempt
  worker: string;                  // worker name or leaseWorkerId-resolved name ("director" for engine dispatch)
  roomKey: string | null;          // run_nodes.room_key (office rollup tag)

  // The work and the ask
  workKind: "node-dispatch" | "approval" | "sweep" | "export" | "seed";
  role: string;                    // node contract role / worker.role
  intendedAsk: string;             // ≤300 chars: node goal/title (never full prompt)
  promptHash: string;              // sha256 of compiled system+user (from promptMeta bytes + compile) — 64 hex
  compilerVersion: string;         // promptMeta.compilerVersion
  strategy: string;                // promptMeta.strategy@strategyVersion

  // The returned result — pointer, not payload
  returnedSummary: string;         // artifacts.summary (already persisted; may be "")
  artifactRef: {
    artifactId?: number;           // web artifacts.id
    kind: string;                  // artifacts.kind
    title: string;
    contentSha256: string | null;  // artifacts.content_sha256
    accepted: boolean;
    storageKey: string | null;     // pointer only — never a presigned URL (schema.ts:553)
  } | null;

  // Accounting — from budget_ledger (and cache fields once 4.12 lands)
  usage: {
    tokensPrompt: number;
    tokensCompletion: number;
    cachedReadTokens?: number;     // additive; defaults 0
    calls: number;
    costUsdMicros: number;
    simulated: boolean;            // mock runs flagged, as in budget_recorded
  };

  // Status & provenance
  status: "accepted" | "failed" | "skipped" | "cancelled" | "in-progress";
  startedAtMs: number | null;      // run_nodes.started_at
  endedAtMs: number | null;        // run_nodes.ended_at
  eventSeqRange: [number, number]; // first/last run_events.seq covering this attempt
  degradationNotes: string[];      // promptMeta.degradationNotes (truncations/redactions)
}
```

Derivation is total and deterministic: join `artifacts (run,node,attempt)`
with `budget_ledger (run,node,attempt)` and the node's `promptMeta`; events
supply `status` transitions. `intendedAsk` and `returnedSummary` are already
persisted fields — **no text is generated**, so building a ledger page costs
no tokens.

### 5.2 `HandoffManifest` — the span-link edge set between nodes

```ts
// Assembled at dispatch from upstream accepted artifacts (scheduler.ts:920-935),
// persisted as a run_events payload or artifacts.promptMeta extension.
interface HandoffManifest {
  runId: number | string;
  consumerNodeKey: string;
  consumerAttempt: number;
  manifestHash: string;            // sha256(canonicalJson(entries + consumer identity))
  entries: {
    producerNodeKey: string;
    producerAttempt: number;
    artifactId?: number;
    title: string;
    summary: string;               // already-persisted artifact summary
    contentSha256: string | null;
    accepted: true;                // manifests only reference accepted artifacts
  }[];
}
```

`manifestHash` is what O2 hashes into the compiler cache key (instead of
re-reading artifact rows), what the whiteboard `artifact-ref` nodes render
provenance from, and what an OTel exporter would translate into span links
(consumer span → N producer spans, §2.6).

### 5.3 `TimelineIndexEntry` — cheap list-view row for any event stream

```ts
// One per event; derivable for run_events, office_events, and desktop events.jsonl.
// Persisted as a sidecar (desktop events.index.json) or a DB projection table.
interface TimelineIndexEntry {
  stream: "run" | "office" | "enterprise";
  streamId: number | string;       // runId / projectId / enterprise id
  seq: number;                     // run_events.seq / office_events.seq / line index
  type: string;                    // event type enum value
  actor: "director" | "node" | "human" | "system" | "worker";
  nodeKey: string | null;
  atMs: number;                    // created_at / ts
  headline: string;                // ≤120 chars, template-built per type (no LLM)
  refs: {                          // typed pointers for jump-to-detail
    artifactSha256?: string;
    approvalId?: number | string;
    grantId?: number;
    ledgerEntryId?: number;
  };
  payloadBytes: number;            // size hint; the payload itself stays in the event row
}
```

This is the Prefect event-feed shape (§2.3) specialized to our streams:
`headline` templates (`"node X accepted · 12.4k tokens · $0.031"`) make the
timeline, the ledger view, and the desktop 500-row DOM window
(`office/app.ts:TIMELINE_WINDOW`) all renderable from index rows alone.

---

## 6. Controls and connection graph

### 6.1 Per-employee controls / action registry

Workers (`db/schema.ts:634-668`) already carry `capabilities: string[]`,
`maxConcurrentClaims`, `status`, and seat state; permanent workers are
propose-only by contract. Formalize a small **action registry** so every
mutation names its actor, required capability, and cache consequence:

```ts
// concept — lives next to contracts/office.ts
interface ActionSpec {
  id: string;                       // "office.reassign" | "control.claim" | "runs.start" | ...
  actorKinds: WorkerKind[];         // who may invoke
  requiresCapability?: string;      // matched against workers.capabilities
  requiresGrant?: "project" | "run";// autonomy grant needed (loadRunGrant stays fresh — never cached, scheduler.ts:305)
  invalidates: ("officeStatus" | "poolStatus" | "roadmap" | "ledger" | "registry")[];
  idempotentBy: "clientKey" | "contentHash" | "none";
}
```

Every tRPC mutation (`routers/office.ts`, `routers/control.ts`,
`routers/runtime.ts`) and every desktop IPC handler (`main/ipc.ts`) registers
its `ActionSpec`. Payoffs: (a) invalidation is declarative — the O3
fingerprint and TanStack invalidations can be *checked* against the registry
in tests (a mutation that forgets to declare an invalidation fails CI);
(b) per-employee UI affordances (enable/disable/reassign/drain buttons,
already in `office/companion.ts` and `useOfficeData.ts`) read capabilities
from one place; (c) audit: `run_events`/`office_events` payloads can record
`actionId`, making `TimelineIndexEntry.headline` generation fully mechanical.

### 6.2 Feature-connection graph

Today there are two partial graphs: the editable plan DAG
(`src/views/director/GraphEditor.tsx`, React Flow over `DagSpec`) and
Airflow-style dependency data trapped inside events/artifacts. Recommend a
**derived feature-connection graph** — a read-only projection, not a new
source of truth:

- **Nodes**: projects, dag revisions, runs, run nodes, workers, office rooms,
  skills (`skills` rows), registry roles/resources, artifacts, whiteboards,
  integrations (`integration_records` provider + label only — never
  ciphertext fields, `schema.ts:767-821`), exports.
- **Edges**: `run → dag_revision` (frozen plan hash), `node → skill`
  (content-hash pin), `node → node` (DAG edges), `consumer → producer`
  (HandoffManifest entries), `worker → room` (active assignment),
  `whiteboard → artifact/run-node` (`whiteboard_nodes.ref*` columns,
  `schema.ts:1088-1090`), `run → autonomy_grant` (`runs.autonomy_grant_id`).
- **Derivation**: entirely from existing FKs, the two event streams, and
  manifests — recomputable, cacheable per project with the O3 fingerprint,
  and renderable in the existing React Flow surface as a second, read-only
  mode of `GraphEditor` (or the desktop `connections` tab,
  `renderer/office/app.ts:44-47` which already names a connections tab).

---

## 7. Anti-patterns (with the concrete trap in this codebase)

- **A1 — Privacy leaks via shared caches.** A prompt-compiler or snapshot
  cache keyed without owner/project scoping can serve owner A a view derived
  from owner B's goal text, vault-backed provider config, or grant state.
  The vault (`integrations/store.ts`, AAD-bound per owner/provider/recordKey)
  and `mustOwnProject`/`mustOwnRun` guards set the bar: caches must be at
  least as strict. Never cache decrypted credentials at all (provider.ts
  resolves them per call, in-frame only).
- **A2 — Stale owner data presented as fresh.** Caching
  `loadActiveGrantForProject`/`loadRunGrant` or pricing across dispatches
  would silently override a mid-run revoke — the code comments at
  `scheduler.ts:305` call this out explicitly. Same class: serving
  `buildStatus` after a reassign because the fingerprint forgot
  `office_events.seq`. Every fingerprint field must be justified by "which
  write paths move it."
- **A3 — Cache stampedes.** When a run completes, `office_events` grows,
  the O3 fingerprint flips, and N open office views could recompute
  `buildStatus` (with its 3×rooms aggregates) simultaneously. Single-flight
  + stale-while-revalidate on the fingerprint; ditto the desktop
  `readEvents` cold-parse after a long run.
- **A4 — Unbounded prompt-caching costs.** A `cache_control` breakpoint
  whose prefix is unstable (e.g., placed after per-attempt upstream refs, or
  after a resources block that degrades differently per node) pays the 1.25×
  (5-min) or 2× (1-hour) write premium on **every call and never reads** —
  strictly worse than no caching, per Anthropic's pricing docs. Also:
  prompts under the model minimum silently never cache. Gate behind
  per-strategy measurement of `cache_read_input_tokens` (§4.12).
- **A5 — Repeated model summarization.** Generating recaps/ledger lines with
  an LLM per view, per poll, or per export re-bills for information already
  persisted. The codebase's own rule — "concise summaries, never raw CoT"
  (`schema.ts:560-564`) — extends to: summaries are written **once** by the
  producing node into `artifacts.summary`; every later surface derives
  (`WorkLedgerEntry`) or renders deterministically (`buildMarkdownReport`).
  Any new "AI summary" feature must persist its output as an artifact and
  reference it by hash thereafter.
- **A6 — Idempotency/caching conflation.** Replaying an idempotency-stored
  response as if it reflected *current* state (or reusing a key across a
  changed payload) turns an exactly-once mechanism into a stale-data bug.
  Keys are minted per user action (`newIdempotencyKey`), include
  `expectedVersion` where OCC applies, and stored replays are terminal (§4.10).
- **A7 — Cache as truth.** All caches here are projections of
  `run_events`/`office_events`/`budget_ledger`; if a cache disagrees with a
  fresh read, the cache is wrong by definition and must be drop-able without
  data loss (LangGraph: checkpoints accelerate, history decides; Temporal:
  replay from history is the recovery path).

---

## 8. Incremental implementation & test plan

Each step is independently shippable, reversible, and covered by tests in the
existing frameworks (Vitest on both apps; test files live beside the code,
e.g. `app/api/office/office.test.ts`, `app/api/engine/engine.test.ts`).

**Phase 0 — measurement harness (no behavior change).**
- Add `EXPLAIN ANALYZE` snapshots for `buildStatus`, `roomUsage`,
  `listPending`, `ledger.byRun` at synthetic volumes (1k/10k/100k ledger rows);
  record timings in a markdown fixture. Add counters (hit/miss, recompute ms)
  logging through the existing `api/lib/logger.ts`.
- Desktop: time `readEvents` full-parse cost vs. file size (1k/50k lines) in a
  Vitest bench to size the O4 win.

**Phase 1 — pure read-side wins (lowest risk).**
1. O1a skill body cache + O1b catalog memo (desktop). Tests: excerpt returns
   identical text across repeated calls; tampered body still `verified:false`;
   catalog change (mtime bump) invalidates.
2. O4 incremental `readEvents`. Tests: append-only growth yields identical
   `{events,nextIndex}` as today across random `afterIndex` sequences;
   truncation/rewrite triggers full reparse; corrupt lines still skipped
   (`projects.ts:691-693` behavior preserved).
3. O7 indexes + `ledger.byRun` keyset `{afterId, limit}` (additive input
   field — old clients unaffected). Tests: page stitching equals the
   unbounded result set under concurrent inserts (the keyset stability
   property).

**Phase 2 — snapshot & compile caches.**
4. O3 fingerprint-cached `buildStatus` with single-flight recompute + O7.3/4.
   Tests: every office mutation in `office.test.ts` flips the fingerprint;
   100 sequential polls with no writes hit cache ≥99 times; stampede test
   (50 concurrent polls after an event) recomputes once.
5. O2 compiler cache + `cacheHit` flag in `prompt_compiled` payload.
   Tests: byte-identical compiled output on hit (compiler determinism test
   already implied by `prompting/compiler.test.ts`); owner-distinct inputs
   never share entries; goal-mode preset change invalidates.
6. O11 QueryClient defaults + fingerprint-driven invalidation in
   `useOfficeData.ts`. Tests (component level, existing `smoke.test.tsx`
   pattern): no refetch within staleTime; invalidation after mocked reassign.

**Phase 3 — derived schemas & steward.**
7. §5.1 `WorkLedgerEntry` derivation + tests (golden fixtures: run events +
   artifacts → ledger entries; no provider mock called — assert zero calls).
8. §5.2 `HandoffManifest` persistence (event payload first) + scheduler query
   tightening. Tests: manifest hash stable across re-derivation; only
   accepted upstream artifacts included (`scheduler.ts:929` semantics).
9. §5.3 `TimelineIndexEntry` sidecar (desktop) + web projection; wire
   timeline UIs to index rows. Tests: index rebuild from scratch equals
   incremental build.
10. O9 `ledger-steward` permanent worker seeding + action registry (§6.1)
    with a CI test that every mutation declares its invalidations.

**Phase 4 — vendor options (measurement-gated).**
11. §4.12 prompt caching behind owner setting, with ledger cache-token
    fields and pricing update first. Success criteria, measured on staging
    with real traffic shape: cache-read fraction ≥60% of eligible prefix
    tokens and net input-cost reduction ≥20% per strategy, else leave off.
12. Feature-connection graph (§6.2) as read-only React Flow mode. Tests:
    edge set equals FK/event-derived expectation set on fixtures.

---

## 9. Primary citations

1. LangGraph — Checkpointers & persistence (threads, checkpoint_id, writes
   tables, `get_state_history`):
   <https://docs.langchain.com/oss/python/langgraph/checkpointers>;
   <https://docs.langchain.com/oss/python/langgraph/persistence>;
   <https://reference.langchain.com/python/langgraph.checkpoint>
2. Temporal — Workflows, Event History, replay determinism, idempotent
   activities: <https://docs.temporal.io/workflows>
3. Apache Airflow 2.11 — Data-aware scheduling / dataset events & dependency
   graph:
   <https://airflow.apache.org/docs/apache-airflow/2.11.0/authoring-and-scheduling/datasets.html>
4. Prefect — Events spec (resource/related/payload/follows):
   <https://docs-2.prefect.io/latest/cloud/events/>
5. TanStack Query — `useQuery` options (`staleTime`, `refetchOnWindowFocus`,
   `refetchIntervalInBackground`) and Window Focus Refetching / focusManager:
   <https://tanstack.com/query/latest/docs/framework/react/reference/functions/useQuery>;
   <https://tanstack.com/query/latest/docs/framework/react/guides/window-focus-refetching>
6. TiDB/MySQL pagination — <https://docs.pingcap.com/developer/dev-guide-paginate-results/>;
   <https://www.pingcap.com/article/limit-offset-pagination-vs-cursor-pagination-in-mysql/>;
   corroborating: <https://docs.cockroachlabs.com/docs/stable/pagination>;
   <https://docs.gitlab.com/development/database/offset_pagination_optimization/>
7. OpenTelemetry — Span links:
   <https://opentelemetry.io/docs/concepts/signals/traces/#span-links>;
   <https://opentelemetry.io/docs/specs/otel/overview/#links-between-spans>;
   <https://opentelemetry.io/docs/specs/otel/trace/api/#link>
8. OpenAI — Prompt caching (automatic prefix cache, minimum lengths,
   `prompt_cache_key`, breakpoints/TTL, `cached_tokens`):
   <https://developers.openai.com/api/docs/guides/prompt-caching>;
   <https://developers.openai.com/cookbook/examples/prompt_caching_201>
9. Anthropic — Prompt caching (`cache_control` ephemeral, 5m/1h TTL, 1.25×/2×
   write, 0.1× read, minimum cacheable lengths, usage fields):
   <https://platform.claude.com/docs/en/build-with-claude/prompt-caching>
