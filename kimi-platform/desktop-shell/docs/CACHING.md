# Caching in CEO mode (v0.5)

This document says exactly what is cached, where, and how it is invalidated.
It follows the stance of `../caching_dag_optimization_research.md`: keep the
append-only logs authoritative, make derived views pure and recomputable,
and cache **deterministic derivations only** — never billed provider work.

> **Not enabled:** provider prompt caching (e.g. Anthropic/OpenAI prompt
> cache headers) is **not** used anywhere in this shell. Provider responses
> are **never** cached: every billed generate call goes to the provider and
> its usage is recorded from the response. No "cache hit" ever replaces a
> provider call silently.

## What IS cached

Both caches live under `userData/enterprises/<enterprise-id>/cache/` and are
keyed by **content hash** with **version/event-seq invalidation**:

| Cache | File | Key | Invalidated when |
| --- | --- | --- | --- |
| Skill excerpt | `skill-<sha256-of-skill-body>.json` | sha256 of the verified bundled `SKILL.md` | enterprise `version` or `eventSeq` moved (any mutation), or the on-disk skill body hash changed |
| Blueprint preview | `blueprint-<sha256-of-generator-input>.json` | sha256 of the exact generator input | enterprise `version`/`eventSeq` moved, or any generator input changed (name, mission, budget, available verified skills) |

Each cache entry stores the `version` + `eventSeq` it was written under; a
mismatch is a miss that recomputes from the authoritative source
(`SkillRegistry.excerpt`, `generateEnterpriseBlueprint`). Both derivations
are pure and deterministic, so a miss is cheap and a hit is always safe.

## What is NOT cached

- **Provider responses / prompts.** No response bodies, no prompt bodies
  (the ledger stores only the prompt's sha256), no embeddings, no summaries.
- **Derived views.** The timeline index, handoff manifests, and steward
  recommendations are recomputed from the ledger on read. They are pure
  functions of append-only data, so a cache would only add an invalidation
  bug.
- **Aggregate re-computation.** Ledger/timeline reads use keyset paging
  (`afterIndex`/`nextIndex`) instead of re-reading everything per poll.

## Permanent stewards (deterministic, metadata-only)

Four stewards run on every snapshot/refresh. They are `derivedBy: "system"`,
`providerCalls: false`, propose-only, and never execute anything:

| Steward | Kind | Derivation |
| --- | --- | --- |
| `cache-budget-steward` | `budget` | company usage (ledger) vs. budget reservation → rebalance suggestion |
| `cache-budget-steward` | `cache` | duplicate `promptSha256` in the ledger → reuse persisted artifacts instead of new calls |
| `evidence-ledger-steward` | `ledger` | returned artifacts not yet promoted → approval-gated promote candidates |
| `blueprint-ops` | `handoff` | derivable handoff manifests (title + summary + sha only) |

The UI labels these "deterministic — no provider calls". The no-extra-token
policy is enforced by tests: all derivations (ledger, timeline, handoffs,
stewards, caches, exports) execute with a counting fake provider and must
not increment the counter.
