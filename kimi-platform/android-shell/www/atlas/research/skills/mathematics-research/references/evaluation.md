# Mathematics Research — Evaluation and Benchmarks

Compiled 2026-11-20. Use these to calibrate and regression-test the agent. Benchmark saturation and integrity caveats apply; see [safety.md](safety.md).

## Benchmark landscape

| Benchmark | Content | Status (2026) |
|---|---|---|
| GSM8K | Grade-school word problems | ~96% frontier; near-saturated |
| MATH | Competition-style problems | ~95% pass@1; near-saturated |
| AIME / USAMO | Olympiad | Tracked live by [MathArena](https://matharena.ai/) |
| miniF2F v1/v2 | 488 formal statements (AMC/AIME/IMO + HS/UG) in Lean/Isabelle/HOL Light/Metamath/Dafny | v2 corrected statement discrepancies; best full pipeline ≈70% |
| ProofNet | 371 undergrad textbook theorems (Rudin, Axler, Dummit & Foote, Artin, Munkres, Stein & Shakarchi, Pugh) | — |
| PutnamBench | 644 Lean 4 statements from Putnam 1962–2023 | Being saturated by 2026 systems |
| FrontierMath | ~350 unpublished research-level problems, 4 tiers, auto-verified answers | <2% at 2024 launch; ~40% on hardest tier by 2026; a 2026 review found errors in ~42% of Tier 1–4 problems (135 revised, 12 removed) — treat single-run scores with caution |
| First Proof | Research-level proof generation by leading mathematicians | 2026 |
| IMProofBench | Research-level proof generation | 2025 |
| Riemann-Bench | "Moonshot mathematics" | 2026 |
| OEIS Open / FrontierMath-Erdős | 492 open OEIS conjectures formalized in Lean; ReAct agent + sandboxed Lean verification with kernel-level auditing | 2026 |
| Formal Conjectures | Open benchmark of conjecture formalization | 2026 |

Near-saturation of GSM8K/MATH/miniF2F/AIME does not imply research competence; track FrontierMath-tier results instead.

## Practical evaluation suite for this skill

1. **Answer-check.** 50 GSM8K/MATH-style problems with exact-answer grading.
2. **Proof audit.** Given 20 mixed valid/invalid informal proofs, identify each flaw (quantifier swap, circularity, hidden division by zero, invalid converse).
3. **Formalize-and-verify.** Translate 10 miniF2F-v2 problems to Lean 4 and close them; score = kernel-accepted proofs after sandboxed replay and axiom audit.
4. **History fidelity.** Answer Fibonacci/golden-ratio questions; score against the history section of [safety.md](safety.md) — must credit Indian priority for the recurrence and must not claim Parthenon/pyramid golden-ratio usage.
5. **Research triage.** Reproduce a FrontierMath public sample problem's verification pipeline end to end.
6. **Conjecture work.** OEIS Open-style task: state, computationally test (exact arithmetic), then formally prove or refute a small integer-sequence conjecture.

Scoring guidance: a result counts only when the stated evidence standard is met — exact computation for computational claims, kernel-checked proof for load-bearing formal claims, and primary-source citation for historical claims.
