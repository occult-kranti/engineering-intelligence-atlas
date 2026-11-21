# Cache, memory, and handoffs

Basis: `caching_dag_optimization_research.md` §§3, 4.1–4.6, 4.8–4.10, 5. The event logs are the only source of truth; every cache is a derived, invalidatable projection.

## Cache rules

1. **Only deterministic, side-effect-free computations may be result-cached** — prompt compilation, resource selection, hire previews, status derivations with pinned inputs. Grant/pricing resolution and provider calls never are.
2. **Cache keys are content hashes over canonical JSON** (`canonicalJson` + SHA-256), exactly as the enterprise contract defines; identical input → byte-identical key.
3. **Invalidation rides sequence numbers and optimistic-concurrency versions** — `run_events.seq`, `office_events.seq`, `blueprint.version`, `room.version`, `workers.version` — not timers. TTLs are only a memory bound and only for data defined as stale-safe (e.g., model lists).
4. **Owner scoping is part of every key**: `ownerId` (web) or project id (desktop), unless the hashed input provably captures everything owner-specific. When in doubt, partition — a cross-owner leak of goal text is worse than an extra entry.
5. **Single-flight recomputation**: on fingerprint change, one request recomputes while others serve the old snapshot (no stampede when a run ends and many office views poll).
6. **Caches never invent tokens**: ledger entries, summaries, and manifests are derived from persisted events/artifacts; no provider call is added to build a view, and no cache replay fabricates a fresh idempotency decision.

## Never cache provider responses

Idempotency and response caching are different mechanisms and must not be conflated:

| | Idempotency (mutations) | Result caching (reads/pure functions) |
|---|---|---|
| Key | client-minted key per user action, stored `(ownerId, scope, key)` | server-computed content hash over inputs |
| Replay | stored response replayed verbatim; no re-execution | value returned; computation may re-run on miss |
| Freshness | forever (a decision is historical fact) | invalidated by version/seq fingerprints |

Rule: **mutations are idempotency-keyed; reads are cache-keyed; never cache a mutation response or a provider response under a content hash, and never treat an idempotency replay as evidence of current state.** Vendor prompt caching (provider-side prefix caching) is a separate, opt-in optimization: byte-stable prefixes, volatile data after the last breakpoint, per-run logging of cache creation vs. read tokens, and it is disabled for agents called less than ~2× per TTL window (the write surcharge otherwise costs more than it saves).

## Memory surfaces (all derived, no provider calls)

- **Work ledger entries** — one bounded bullet of accountable work per node: status, outcome-level summary, artifact refs, tokens/cost. Derived from the event log by deterministic code (the permanent-employee/steward pattern), never summarized by a provider.
- **Timeline index entries** — cheap list-view rows over any event stream, with incremental refresh after a cursor (`afterIndex`) instead of full re-reads.
- **Artifact refs** — pointers (`artifactId, runId, nodeKey, attempt, kind, title, summary, contentSha256`); content is never inlined.
- **Handoff manifests** — the span-link edge set between nodes: the precise upstream accepted artifacts a consumer needs, persisted as a first-class content-hashed record, derivable from existing rows with no model call and no raw content.
- **HANDOFFS / handoff docs** — human-readable companions that reference the manifest; they carry refs and bounded extractive summaries, never raw CoT or inline payloads.

`cache.invalidate` is the low-risk, approval-free action for invalidating a deterministic cache namespace; invalidation hooks live in the same transaction/guarded code path as the mutation, not on a timer. The explicit namespace targets are `skill-excerpts`, `blueprint`, `snapshot`, and `repository-metadata`; the execution receipt is a `CacheInvalidationReport` — `{namespace, scopeKey, removedKeys, invalidatedAt}`, counts only, never content, always owner/scope-keyed.
