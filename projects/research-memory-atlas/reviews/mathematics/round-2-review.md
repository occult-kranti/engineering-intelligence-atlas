# Round 2: critique, repairs and verification

Date: 25 November 2026. Reviewer: coordinating parent agent `/root`. This is an actual recorded review round, not an invented expert panel. The parent sampled pseudoinverse nonuniqueness, condition number, Stokes, Bayes, contraction and Fourier formulas and found the sampled mathematics sound, while identifying weak source assignments and one missing relative-error domain restriction.

## Requested corrections and disposition

| Parent finding | Repair performed |
|---|---|
| Bayes linked to convex optimization | Added and directly read MIT's 23-page Class 03 slides, including conditional probability and Bayes' theorem; `mf-bayes` now points there |
| Generalized Stokes linked broadly to calculus | Directly read Tong sections 2.4.4–2.4.5, equation 2.92; `mf-stokes` now cites it and explicitly includes compactness/compact support or vanishing contributions at infinity |
| Banach contraction linked broadly to calculus | Directly inspected rendered Hunter–Nachtergaele Theorem 3.2 because extraction was garbled; changed `mf-contraction` reference |
| Fourier/Plancherel linked broadly to calculus | Directly inspected Hunter section 5.B.4 and Theorem 5.71; noted the different normalization and retained the notebook's explicit unnormalized forward convention |
| Relative condition-number bound lacks denominator restrictions | Added `b≠0` and `x≠0` explicitly to `mf-cond` assumptions |
| Scan other formula source assignments | Replaced broad references for entropy/KL/MI, concentration, differential geometry, weak PDEs, Cauchy formula, PageRank, Cheeger/normalized Laplacian, Bellman/DAG calculations, heat stability, Euler–Lagrange, elliptic curves and CG |
| Exact theorem and access-depth evidence | Claim records retain locators, pinned artifact revisions, actual read depth, separate publisher/audit statuses and `local_proof_replay_performed: false` |

## Additional issues caught during repair

The Fourier normalization annotation initially used the word “unitary” incorrectly; the displayed formula already used an unnormalized forward transform. The annotation was corrected to state precisely where the factor `1/(2π)` belongs. A Gaussian calculation checks the convention.

The strengthened noncompact Stokes condition is deliberate: convergence of two integrals alone should not silently discard a contribution from infinity. Compactness or compact support is a clean sufficient assumption for the displayed theorem.

The catalogue extraction check caught an internal parenthesis in a `CAT(0)` path. The initial simple Markdown regex truncated that one URL. The revised expression captures the entire PDF path, preserving the parenthesis. Counts stayed at 730 manuscripts and 375 families. Every extracted family/title/path was compared with the pinned connector response after the correction.

The selected zeta paper's author name was rechecked against the primary arXiv record and stored as **Ralph Furman**. Model-version fields preserve what is actually disclosed: the ETH README separately names Claude Opus 5.5 for a proposed rederivation, not as an established identity of the discovery model or as a run performed in this task.

## Targeted checks actually executed

`validate_math_atlas.py` executes 21 checks covering unique IDs, complete formula records, source/end-point integrity, typed edge direction, acyclic learning prerequisites, catalogue count/path status, local document links and selected numerical examples. The examples exercise base-rate Bayes, rectangular pseudoinverse nonuniqueness, PageRank normalization, Laplacian energy/effective resistance, weighted Cheeger bounds, Gaussian Fourier normalization, the explicit-heat stability boundary, Simpson integration, low-rank error, contraction stopping and triangle homology.

These are meaningful guards against convention and domain mistakes. They are not a symbolic proof of all 64 formulas and do not establish correctness of any newly released research proof. `validation.json` records the actual outcomes.

## Remaining limits after Round 2

Some established formula references remain author textbook or course reading links, correctly labelled at their actual access depth. This is an original mathematical exposition supported by reading routes, not a claim that the entire reference collection has been independently reverified. Current-research evidence is treated separately and carries its own access-depth limitations. No third-round independent approval or Lean replay is claimed in this report.
