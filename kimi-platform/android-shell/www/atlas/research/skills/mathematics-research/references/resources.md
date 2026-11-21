# Mathematics Research Resources — Sources, Computation, and Formal Verification

Compiled 2026-11-20. Prefer primary and authoritative hosts; record versions and access dates.

## Primary sources and literature

- Sequences: [OEIS](https://oeis.org) — a "new" sequence is usually already catalogued; check before claiming novelty.
- Definitions/formulas: [NIST Digital Library of Mathematical Functions](https://dlmf.nist.gov/), [Wolfram MathWorld](https://mathworld.wolfram.com/).
- Literature: [arXiv math](https://arxiv.org/list/math/recent), [zbMATH Open](https://zbmath.org/), [MathSciNet](https://mathscinet.ams.org/), [Project Euclid](https://projecteuclid.org/), [Numdam](https://www.numdam.org/), [Internet Archive](https://archive.org/) (public-domain classics).
- Q&A: [MathOverflow](https://mathoverflow.net/) (research), [Mathematics Stack Exchange](https://math.stackexchange.com/).
- History: [MacTutor](https://mathshistory.st-andrews.ac.uk/), [AMS Notices](https://www.ams.org/notices), [MAA Convergence](https://www.maa.org/press/periodicals/convergence).
- Open problems: [Clay Millennium Problems](https://www.claymath.org/millennium-problems/), [Erdős Problems](https://www.erdosproblems.com/).
- Encyclopedias: [nLab](https://ncatlab.org/), [Encyclopedia of Mathematics](https://encyclopediaofmath.org/), Wikipedia only with verification.
- Open courses: [MIT OCW Mathematics](https://ocw.mit.edu/search/?d=Mathematics), [Khan Academy](https://www.khanacademy.org/math), [OpenStax](https://openstax.org/subjects/math), [OSSU Math](https://github.com/ossu/math).

## Computation stack

- Quick check: [Wolfram Alpha](https://www.wolframalpha.com/) — stop immediately if a concrete input disagrees; never ship a result checked only here.
- General: [SageMath](https://www.sagemath.org/) (wraps GAP/PARI/Singular; browser access via [CoCalc](https://cocalc.com/)); [SymPy](https://www.sympy.org/) + [mpmath](https://mpmath.org/) + [NumPy](https://numpy.org/) in Python.
- Specialized: [PARI/GP](https://pari.math.u-bordeaux.fr/) (number theory), [GAP](https://www.gap-system.org/) (groups), [Macaulay2](https://macaulay2.com/) (commutative algebra), [Singular](https://www.singular.uni-kl.de/) (polynomials), [NetworkX](https://networkx.org/) (graphs).
- Pedagogy with Sage: Bard, *Sage for Undergraduates* (AMS 2015, free); Zimmermann et al., *Computational Mathematics with SageMath* (SIAM 2018, free).
- Arithmetic discipline: exact integers/rationals or interval arithmetic for exactness claims; write counterexample searchers, not confirmation demos.

## Proof assistants and formal verification (2026 state of the art)

| System | Character | Notes |
|---|---|---|
| [Lean 4](https://leanprover.github.io/) + [Mathlib](https://github.com/leanprover-community/mathlib4) | Dependently typed; largest unified formal math library (>210k theorems, ~1.9M lines as of April 2026) | De facto standard; target of AlphaProof, DeepSeek-Prover-V2, Leanstral |
| [Rocq (ex-Coq)](https://rocq-prover.org/) | Calculus of Inductive Constructions; CompCert lineage | Renamed at Rocq 9.0 (2025-03-12) |
| [Isabelle/HOL](https://isabelle.in.tum.de/) | Classical HOL, strong automation | [Archive of Formal Proofs](https://www.isa-afp.org/); seL4 verification |
| [HOL Light](https://www.cl.cam.ac.uk/~jrh13/hol-light/) | Minimal kernel | Flyspeck (Kepler conjecture) |
| [Agda](https://agda.readthedocs.io/) | Dependently typed, constructive | Cubical/HoTT work |
| [Metamath](https://us.metamath.org/) | Minimal axioms, multiple independent verifiers | Maximum-trust re-checks |
| [Dafny](https://dafny.org/) | Auto-active verifier (SMT/Z3) | Verifies ~40–45% of miniF2F-style problems with empty proofs |

Learning: [Theorem Proving in Lean 4](https://leanprover.github.io/theorem_proving_in_lean4/), [Mathematics in Lean](https://leanprover-community.github.io/mathematics_in_lean/), [Natural Number Game](https://adam.math.hhu.de/), [LeanDojo](https://leandojo.org/) for ML-integrated tooling.

Verification discipline:
- Replay every formal proof through the kernel from scratch in a sandbox; audit with `#print axioms`.
- Reject `sorry`/`admit`, extra axioms, `native_decide` abuse, and metaprogramming that inserts declarations (the SafeVerify/kernel-audit pattern).
- Diff the formal statement against the informal claim: over half of miniF2F v1 formal statements diverged from their informal originals before miniF2F-v2 corrections.

## AI-for-mathematics calibration (expectation setting)

- AlphaProof + AlphaGeometry 2 scored 28/42 at IMO 2024 (silver level) with Lean-checked proofs; peer-reviewed: Hubert et al., *Nature* 651:607–613 (2025). IMO 2025: Gemini Deep Think reached gold standard (35/42) in natural language; DeepSeek-Math-V2 reported gold-level IMO 2025 and 118/120 on Putnam 2024.
- Formal provers: DeepSeek-Prover-V2 (88.9% miniF2F), Goedel-Prover, Seed-Prover, Kimina-Prover; AxiomProver solved all 12 Putnam 2025 problems with Lean-verified proofs; Math Inc.'s Gauss agent formalized the strong Prime Number Theorem.
- Implication: formal systems produce kernel-checked results; natural-language AI proofs still require human review and can harbor subtle errors. Never report an AI-generated informal proof as verified.
