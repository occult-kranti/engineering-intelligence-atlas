# Provenance, fork/identity analysis, and reproducible builds

## Contents

- Evidence tiers
- Repository identity and fork analysis
- Reproducible builds
- Verification ladder
- Non-claims

## Evidence tiers

Label every external claim with its tier and a `verified_at` date whose semantics are recorded (a review date is not an activity date):

| Tier | Meaning | Use |
|---|---|---|
| 1 — source-reviewed | Human-reviewed against primary sources | Citable with date |
| 2 — link-checked | Per-record HTTP status observed | Existence signal only; a 200 is not accessibility (observed catalogs contain 401/403 rows flagged link-OK upstream) |
| 3 — community-curated | Community list with enrichment | Leads with moderate confidence |
| 4 — automated index | Machine classification, unreviewed | Leads only; never per-project claims |
| 5 — sampled | Popularity-biased sample (e.g., top-by-stars) | Cannot estimate composition of a whole population |

Rules that follow from observed catalog failures:

- Stars, forks, and curator scores are point-in-time metadata — never quality, correctness, safety, adoption, or legality evidence. Two-order-of-magnitude star drift within weeks has been observed.
- Report counts from different sources side by side without reconciling them when definitions differ; preserve failures (HTTP 500s, rate limits) verbatim rather than substituting estimates.
- Corroborated listing in ≥2 catalogs is not independent verification.

## Repository identity and fork analysis

Pin identity by canonical clone URL plus first-seen commit SHA. Never identify or merge projects by title or star count. Known failure modes, all observed in real catalog data:

- **Forks are distinct listings.** Catalogs deduplicate by repository root, so a fork counts separately; occurrence counts measure listings, not independent engineering efforts. Fork networks can be enormous and dominated by same-day drive-by forks.
- **Renames and transfers.** Renamed forks keep fork-network identity but appear under two names in captures taken at different times; a quarter to a third of forks in observed networks are renamed, some in systematic themed batches. Name-based matching both misses these links and falsely merges same-name forks.
- **Root vs. subpath.** Distinct content can live under one repository root: one observed NES disassembly repository hosts 14 distinct game disassemblies as subpaths, all inheriting one star count. Conversely, 20+ catalog rows can be documentation subpaths of a single tool repository.
- **Title collision.** One game title ("Battle City" is the documented case) can map to three or more independent projects across catalogs — a subpath disassembly cluster, a mismatched-description browser port, and an unrelated remake — with a description/URL/category mismatch in at least one catalog. Any title-based identity reasoning silently conflates them.
- **Bounded enumeration.** Fork endpoints can fail intermittently (empty-body HTTP 500s) under rate budgets; when a complete census is infeasible, characterize the network from labeled samples and state the bound — do not present samples as a census.
- **License fields.** Provenance-labeled observations, not legal facts; NOASSERTION/blank does not prove absence of a license, and a no-license repository is rights-relevant for any reuse (HUMAN-4).

## Reproducible builds

- Pin the full toolchain (compiler, assembler, recompiler, runtime, asset pipeline) with recorded versions and content hashes.
- Rebuild from a clean checkout in CI or an equivalent fresh environment; a build that only works on one machine's accumulated state is not verified.
- Check deterministic output where the platform allows (byte-identical or content-hash-identical artifacts across rebuilds); record nondeterminism sources (timestamps, ordering, random seeds) where it does not.
- Keep original binaries, ROMs, and assets out of the build inputs except as user-supplied, hash-verified local material; the build must verify expected hashes and fail closed.

## Verification ladder

Report the rung actually reached, never a higher one:

1. **Compiles** — clean-checkout build succeeds.
2. **Boots** — the artifact reaches a defined observable state.
3. **Matching %** — functions/bytes matched against a user-supplied, hash-verified original (decomp.dev-style progress), or documented behavior-parity coverage for remakes.
4. **Playtested** — human playtest evidence; automated runs are labeled as automated and never counted as human playtest sessions.

## Non-claims

Do not assert, from catalog or API metadata alone: that a project works, is legal, is maintained, or is the "official" or "original" instance of anything. State the evidence tier, the observation date, and the bound of every enumeration.
