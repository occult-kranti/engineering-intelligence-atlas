# Coverage, retrieval depth and remaining work

Snapshot: **25 November 2026**. The scope is a connected study atlas from foundations to selected frontier results. It is not an exhaustive survey of every mathematical paper, all subfields or every result from either AI provider.

## Delivered coverage

| Area | Included depth | Frontier or audit connection |
|---|---|---|
| Logic and proof | Quantifiers, counterexamples, induction, dependent types, axioms | Formal theorem identity and certificate dependencies |
| Elementary algebra | Equations, polynomial roots, complex phase, logarithms, dimensions | Why domains and excluded cases survive every summary |
| Abstract algebra | Groups, rings, fields, Galois theory, representations | Number-field constructions, arithmetic circuits, modularity |
| Linear algebra | Subspaces, rank, SVD, pseudoinverse, projections, PCA, conditioning | Retrieval embeddings, compression and inverse problems |
| Calculus and analysis | Derivatives, Taylor error, integrals, Jacobians, generalized Stokes, variation | PDE models, conservation and coordinate changes |
| Probability and information | Bayes, covariance, Gaussian laws, concentration, entropy, KL, mutual information | Evidence dependence, cache confidence and uncertainty |
| Graph mathematics | Walks, Laplacians, conductance, PageRank, resistance, shortest paths, DAGs, SCCs | Typed memory links, diffusion, invalidation and recursion |
| Numerical mathematics | Root finding, gradient descent, duality, CG, finite differences, weak forms, quadrature, contractions | Stability, error bounds and termination |
| Geometry and topology | Manifolds, metrics, curvature, differential forms, homology, persistent topology | Gravity prerequisites and structure-preserving representations |
| Number theory and algebraic geometry | Primes, zeta, elliptic curves, modular forms, schemes, Langlands | RH, FLT, geometric Langlands and catalogue claims |
| Category/operator bridges | Functors, naturality, universal properties, Yoneda, function spaces and operators | What a structural analogy must preserve |
| AI mathematics | 24 selected detailed records, bounded by actual evidence read | Competition, original theorem, formalization, review and conditional artifact |

Final structured counts after the source repair pass: **58 sources, 140 concepts, 64 formulas, 176 typed edges, 24 claim records**. The OpenAI metadata catalogue additionally contains **730 manuscript records in 375 families**. The formula notebook is approximately 9,500 words; the connected guide adds approximately 3,500 words, before the claim register and evidence audit.

## Primary-source discovery strategy

Searches targeted official OpenAI and Anthropic announcements, their public research repositories, original arXiv papers, named researchers' own pages, Lean/Mathlib verification records, Clay problem pages and author/university teaching materials. Search result snippets were discovery aids. Access depth is recorded per source: index, abstract, theorem statement, README, selected formal declaration, full short statement, or rendered PDF section.

The audit did not use news coverage as decisive proof evidence. It did not pretend that a repository's presence implied successful compilation. It distinguished a provider-maintained README from an independently maintained verifier record, and checked the revision an independent audit actually covered.

## Exact catalogue provenance

| Record | Captured identifier |
|---|---|
| Repository | `openai/math` |
| Commit | `3344da59991ed94f9ba711217b29c1d760badfa6` |
| CONTENTS blob | `7d4a8770643439016a70f23a4524d0ebacc78900` |
| History blob | `bba84df19e8f3e5656875efd4e2a964d7d2e7767` |
| README blob | `9dc39b832c0b6d9416c18a9c8d396bcda80ce351` |
| LICENSE blob | `261eeb9e9f8b2b4b0d119366dda99c6fd7d35c64` |

The complete metadata file was parsed through the GitHub connector. Its 730/375 header agrees with the corrected parser. An initial parser anchored at the start of a line missed families 379 and 380 because of preceding HTML anchors; that was fixed before release. A later validation also caught one truncated path containing `CAT(0)`; the parser now reads through the `.pdf` suffix and preserves those parentheses. All extracted titles, families and complete PDF paths were compared against the captured catalogue. The equivalent JavaScript extraction was executed directly against the cached connector response; the supplied Python extractor is the reproducible file-based implementation and additionally checks the raw Git blob hash.

There is no unresolved current README/catalogue count disagreement. Older 719/372 figures refer to historical releases. Family labels are non-contiguous, so the maximum ID, 380, is not the number of families. None of those metadata counts is a count of independently verified theorems.

## Important reading limits

- Large source texts were not read or verified line by line. For example, the 253-page ten-advance manuscript was inspected at the introduction/result-map level; Hunter's 242-page PDE notes were used through their relevant sections; the giant Lean artifacts were not rebuilt.
- RH has strong independently reported statement and proof verification. This atlas inspected those records; it did not execute the reported checks or infer a Clay award.
- Forced Navier–Stokes and unforced Euler have separate formal declarations. One independent audit targets an older explicitly pinned upstream commit; it is not silently promoted to a later commit.
- The November unforced Navier–Stokes package was inspected as a conditional artifact with absent numerical certificate data and a stated rebuild caveat.
- VP/VNP and the newest nine OpenAI catalogue additions were not given independent theorem acceptance merely because they have a formalization or a dramatic title.
- Generalized-RH formulations, all hypotheses of the local-smoothing theorem, and all mathematical consequences of the new ETH artifacts were not individually translated here.
- Classical exposition and worked examples are original derivations. Teaching references are reading support; an index-only read is not represented as full-text verification.

## Failed or partial retrievals

| Attempt | Observed limitation | Handling |
|---|---|---|
| Boyd full textbook PDF | Request timed out | Kept author page as a correctly labelled background reference; no full-PDF review claim |
| OpenAI unit-distance companion remarks | PDF request timed out | Used original proof and official attribution; did not claim to read the companion |
| MacKay author book site | HTTP 403 | Replaced needed information-theory support with directly inspected Stanford notes and Shannon paper |
| Probability book redirect | Redirected to a sign-in page | Did not treat as read; used MIT probability material |
| Dartmouth probability URL | HTTP 404 | Excluded from supporting sources |
| Original Hoeffding DOI | HTTP 403 | Used Shalizi's directly inspected primary teaching exposition, labelled as such |
| An older guessed MIT readings path | Unavailable | Replaced with actual current course resource and downloaded Bayes slides |
| Hunter contraction PDF text | Garbled extraction | Read rendered Theorem 3.2 screenshot; recorded the access method |
| Shewchuk CG PDF equation text | Garbled extraction | Read rendered equation 52 and recorded that method |
| Older Milne elliptic PDF filename | HTTP 404 | Followed the author index to the actual first-edition PDF |
| Older Tong dynamics URL | Unavailable | Followed current author course page to the Lagrangian chapter |
| OpenAI 2025 IMO primary official page | No decisive official source located in this pass | Excluded a precise OpenAI score; included the directly sourced DeepMind comparator only |
| Some GitHub web/raw requests | Retrieval failures | Used the available GitHub connector and exact revisions |

Failed URLs are not included as if they were successfully read sources. The access ledger distinguishes a missing paper from an absent theorem, and a source discovery from verification.

## Review rounds actually completed

1. **Round 1: source-led production.** Built the study guide, original formula records and derivations, concept graph, selected-claim evidence records and pinned catalogue metadata.
2. **Round 2: parent mathematical/source critique and repair.** The parent sampled formulas and requested tighter primary reading links, explicit nonzero relative-error denominators, exact theorem locators and a documented boundary on verification. Repairs and targeted checks are recorded in `round-2-review.md` and `validation.json`.
3. **Round 3: independent review pending at this file's creation.** No independent third-round approval is claimed here. The coordinating agent will record the actual result once it occurs.

## Sensible next deep-research increments

Select one theorem family at a time. Translate the exact proposition, inspect its direct dependencies, compare it with the original open problem, and reproduce a feasible artifact in an isolated pinned environment. Expand the mathematical study notes where that translation exposes missing prerequisites. Keep title-only catalogue items at metadata status until this work is done. This preserves useful breadth while directing expensive proof review to concrete, falsifiable questions.
