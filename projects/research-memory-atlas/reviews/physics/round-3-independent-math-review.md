# Independent Round 3 review of mathematics and the graph-memory skill

Reviewer: physics worker `/root/physics_atlas`, independent of the mathematics author. Date: 2026-11-25 UTC. Reviewed directory: `/workspace/scratch/14a2b16c9c77/research-work/math`. No mathematics artifact was edited by this reviewer.

## Outcome and limits

No blocking mathematical error was found in the eight selected formula cards. All 24 claim records were inspected for consistency between statement, assumptions, verdict, external-verification wording and limitations. Decisive external evidence was independently reopened for RH, Clay status, Yang–Mills, conditional unforced Navier–Stokes, the forced-NS independent audit and VP/VNP. This was a source/statement review, not a new proof replay or a fresh verification of every other claim's full paper.

Three small clarity improvements are recommended; none changes the displayed numerical examples:

1. **`mf-cfl`:** display `0 ≤ r ≤ 1/2` in the equation itself, or state κ≥0 and positive step sizes in the assumptions. The derivation already supplies the lower bound, so the record is internally recoverable; displaying it prevents a copied formula from silently allowing backward diffusion.
2. **`mf-kkt`:** make differentiability of f and gᵢ explicit for the gradient-based version. The convexity/Slater qualifications and nonconvex warning are sound. Nondifferentiable convex problems require subgradient language.
3. **`m-claim-grh`:** the independently reopened MIT record positively certifies the stated Dirichlet-L-function scope for all moduli and characters. The current record correctly avoids arbitrary GRH overreach, but could state this verified subfamily explicitly before excluding Dedekind, Hecke and general automorphic families. This would improve informativeness without inflating scope.

## Eight formula cards sampled

| Formula | Independent check | Result |
|---|---|---|
| `mf-normalized` | Degree normalization, no-isolate requirement, spectrum interval and two-node example | Sound under the stated undirected nonnegative-weight conditions |
| `mf-resistance` | Unit current injection, singular constant mode, pseudoinverse voltage difference, series/parallel examples | Sound; semantic-edge versus physical-conductance distinction retained |
| `mf-cheeger` | Normalized rather than combinatorial eigenvalue; weighted conductance; factor 1/2 and square-root bound | Sound; an explicit cut-volume formula would be useful but the stated convention is recognizable |
| `mf-kkt` | Lagrangian sign for g≤0, nonnegative multiplier, complementarity, x² with x≥1 | Correct multiplier λ=2; add differentiability to the assumptions for this version |
| `mf-cg` | SPD requirement, exact arithmetic, A-norm and κ=9 example | Correct bound factor 2·2⁻ᵏ; finite-precision limits clearly stated |
| `mf-cfl` | Amplification factor 1−4r sin²(θ/2), highest grid mode and Δx=0.1 example | Correct bound in derivation and Δt≤0.005; make the nonnegative lower bound visible in the formula |
| `mf-laplacebeltrami` | Metric determinant, inverse metric, polar-coordinate expression and Lorentzian distinction | Sound; origin regularity correctly separated from physical curvature |
| `mf-galois` | Finite normal separable extension, reversed inclusion and group-order/degree identity | Sound in the stated finite-Galois setting |

This sample intentionally differs from the parent's Round 2 sample. No assertion is made that all 64 cards have now received an independent line-by-line proof audit.

## Claim-register consistency across all 24 records

The universal-premise record rejects an inference from a finite catalogue to all mathematics. The IMO entry remains a competition benchmark. The unit-distance, ten-advance, August zeta and FLT records separate a new theorem, collection-level access, a proportion result and formalization of an existing theorem. Forced NS, Euler and the prose-translation criticism have separate entries. The 730-manuscript catalogue remains metadata, and withdrawal history remains a correction rather than a new proof. The 3SUM/APSP, two ETH, local-smoothing, VP/VNP and new-nine entries retain computational-model or unreviewed-proof restrictions. YM existence/gap, RH/GRH and unforced NS are split by exact obligation. Kakeya and geometric Langlands remain explicitly human-attributed with dimensional/setting scope. Every record says no local giant-proof replay was performed.

### RH: strong independent formal evidence, separate prize status

The [November 21 Lean FRO/Mathlib statement](https://leanprover-community.github.io/blog/posts/riemann-hypothesis/) explicitly reports statement correspondence and multiple proof checkers. The [MIT verification page, updated November 24](https://math.mit.edu/~drew/grh/) independently records compiled modules, allowed axioms, proof-export checks and theorem comparisons. It also identifies a still-running comparator stage; the register does not falsely say every listed job finished. The [Clay RH page](https://www.claymath.org/millennium/riemann-hypothesis/) reads **Active**. The register correctly treats formal verification evidence and prize/process status as different facts. This reviewer did not execute any of those large proof objects.

The MIT page also explicitly gives the scope of its additional checked L-function statements: Dirichlet characters across all moduli, excluding other general L-function families from that verification claim. That supports the suggested sharper positive scope for `m-claim-grh`.

### Forced and unforced Navier–Stokes remain distinct

The [independent forced-NS audit at its pinned revision](https://github.com/francescoantoniodeluca/navier-stokes-formal-audit/tree/c2e4f438f7af8bbf222a59801696aca2c3c15b6f) names the older OpenAI revision it actually audited and distinguishes its formal semantic bridge from final human prose-to-specification judgment. The register preserves that revision limitation and does not transfer the result to unforced viscous flow or to Euler.

The [Alpöge–Buckmaster package at `ad53419…`](https://github.com/tristanbuckmaster/navier-stokes/tree/ad53419de079eb8f95f60313473374624a348546) was independently read through its root and Lean READMEs using the GitHub connector after direct web retrieval failed. Its described theorem hypotheses require a periodic similarity profile or a corresponding certificate. The root README says the certificate data and interval computation are absent and the patched package was not rebuilt. The register's conditional-artifact wording is supported; an unconditional unforced resolution is not established by this evidence.

### VP/VNP and Yang–Mills preserve the correct problem boundaries

The [pinned VP/VNP README](https://github.com/anthropics/formal-math/tree/11b6c7e3c927df2658f513b6b68ea7f8929c62c5/vp-vnp) was independently fetched. It distinguishes arithmetic VP/VNP from Boolean P/NP, restricts the permanent statement outside characteristic two, and says no human mathematician has checked the proof. The register preserves all three qualifications.

The [Yang–Mills group's current assessment](https://github.com/yang-mills-group/YM) endorses the stated four-dimensional Wilson-lattice scaling-limit existence result but explicitly excludes mass gap and uniqueness. The [Clay YM page](https://www.claymath.org/millennium/yang-mills-the-maths-gap/) reads **Unsolved**. The two registry entries are consistent: progress in one obligation does not establish the entire combined problem.

## Forward test of `graph-memory-research`

The skill and both referenced files were read in full. The forward test used a concrete synthetic public/private retention-policy scenario and the current pure retrieval module at `implementation/graph-memory/graphMemory.ts`. All data were fabricated; no private account, vault or company evidence was read. The cited Daftar CLI was absent from the current working directory, so the skill's instruction not to assume its existence was followed. No service was installed.

`skill-forward-test.mjs` and `skill-forward-test.json` record the executable scenario and the exact skill/module hashes. The cache adapter in that file is an explicitly labelled test harness implementing the skill's decision contract, not the production store. Five checks passed:

1. An authorized two-scope query can warm a cache.
2. Revoking the private scope rejects a previously cached mixed-scope request **before cache reuse**.
3. A narrowed public query returns no synthetic private canary and ranks only eligible public nodes.
4. A source-only correction changes the snapshot identity and refreshes provenance even when the graph's human revision string is deliberately unchanged.
5. At the exact `valid_until` boundary, the old public claim disappears and the new claim enters under the half-open interval convention.

No skill defect was found in this bounded forward test. It does not establish authenticated-service enforcement, production persistence, crash durability, provider cache savings or deployed behavior. Those require their own implementation-level checks. The skill explicitly warns about those boundaries, and the test preserved them.
