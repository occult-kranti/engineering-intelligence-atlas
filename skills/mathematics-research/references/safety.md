# Mathematics Research — Accuracy Gates, Failure Checks, and History/Myth Control

These checks are hard gates: they override schedule and budget pressure. Apply them before emitting any result.

## Operational failure checks

1. **Plausible-but-wrong proofs.** LLM-generated informal proofs can sound convincing while wrong. Require a human-checkable gapless write-up or a kernel-checked formal proof. FrontierMath documented models reaching right answers via shallow simulation guesses without correct reasoning.
2. **Formalization mismatch.** The Lean statement proved may not match the informal claim — over half of miniF2F v1 formal statements diverged from the informal originals. Always diff the formal statement against the original claim.
3. **Verifier smuggling.** Guard against `sorry`/`admit`, extra axioms, `native_decide` abuse, and metaprogramming that inserts declarations. Replay through the kernel from scratch in a sandbox and run a `#print axioms` audit.
4. **Floating-point "proofs."** Near-equality is not equality (Lehmer-style near misses). Use exact or interval arithmetic for exactness claims.
5. **Confirmation-biased computation.** Write searchers for counterexamples, not demos for the favored case.
6. **Myth propagation.** Check every historical claim against the case study below before repeating it.
7. **Saturated-benchmark overconfidence.** GSM8K/MATH/miniF2F/AIME near-saturation does not imply research competence.
8. **Benchmark integrity caveats.** FrontierMath's 2026 review found errors in ~42% of Tier 1–4 problems; treat single-run scores with caution.
9. **Missing edge cases.** Test n=0, empty sets, degenerate triangles, non-measurable sets, noncompact domains. Consult Steen & Seebach, *Counterexamples in Topology*, and Gelbaum & Olmsted, *Counterexamples in Analysis*, habitually.
10. **Attribution drift.** Secondary summaries misattribute. Cite primaries: Shannon 1948 (*BSTJ*); Euclid via Heath/Joyce; *Liber Abaci* via Sigler (2002).

## History gate: Fibonacci, Liber Abaci, and the golden ratio

### What Liber Abaci actually is

- Written by Leonardo Pisano ("Fibonacci") in **1202**, revised **1228**; the 1202 manuscript does not survive. The name "Fibonacci" (filius Bonacci) was popularized by Guillaume Libri in 1838.
- Its central project was introducing the **Hindu–Arabic numeral system** — the *modus Indorum* ("method of the Indians") — to European commerce and scholarship: place value, the nine figures plus 0, arithmetic algorithms, fractions, and commercial applications. "Algorist" derives from al-Khwārizmī and became "algorithm."
- The rabbit problem generating the famous sequence occupies only a few pages of a 600+-page book. Leonardo computed to the 13th place (233) and did **not** connect the sequence to the golden ratio.
- First printed Latin edition: Boncompagni, Rome 1857. First English translation: Laurence Sigler, Springer 2002 (DOI 10.1007/978-1-4613-0079-3). Sigler also translated *Liber Quadratorum* (1987); *Practica Geometriae* was translated by Barnabas Hughes (Springer 2008).

### Prior Indian mathematics (well-supported priority — always credit)

- The same recurrence arises in Sanskrit prosody (counting meters of short/long syllables): **Piṅgala**'s *Chandaḥśāstra* (~450–200 BCE) contains the idea (*mātrāmeru*); **Virahāṅka** (~600–700 CE) stated the rule explicitly; **Gopāla** (~1135) quoted Virahāṅka; **Hemachandra** (~1150) presented it decades before Fibonacci. Key scholarship: Parmanand Singh, "The so-called Fibonacci Numbers in Ancient and Medieval India," *Historia Mathematica* 12 (1985) 229–244; Kim Plofker, *Mathematics in India* (Princeton UP 2009).
- The sequence was *named* "Fibonacci sequence" by Édouard Lucas in the 1870s; the Indian priority was recovered by 20th-century scholarship.

### Golden-ratio anti-mythology (do not repeat as fact)

- George Markowsky, "Misconceptions about the Golden Ratio," *College Mathematics Journal* 23(1):2–19 (1992) debunks claims about the Great Pyramid, the Parthenon (whose obvious length/width ratio is 2.25 = 9/4, not φ≈1.618), Leonardo da Vinci's usage, and the aesthetic superiority of golden rectangles; the very name "golden ratio" is a 19th-century creation.
- Keith Devlin: the aesthetics claim comes primarily from Pacioli (misquoted) and Zeising (invention) — see his MAA columns "Good stories, pity they're not true" (2004) and "The Myth That Will Not Go Away" (2007).
- Clement Falbo measured nautilus shells and found mean ratios ≈1.33, not φ ("The Golden Ratio — A Contrary Viewpoint," *CMJ* 36(2):123–134, 2005).
- Mario Livio, *The Golden Ratio: The Story of Phi* (2002) separates the genuine mathematics of φ from the folklore.
- What *is* true: Kepler observed (1611) that ratios of consecutive Fibonacci numbers converge to φ; φ appears legitimately in Euclid's *Elements* Book XIII ("extreme and mean ratio") in the construction of regular solids; Binet's closed form F_n = ((1+√5)^n − (1−√5)^n)/(2^n√5).

### Epistemic labeling

Label every statement as one of: theorem with proof (cite or formalize), conjecture, heuristic, folklore, or error-prone popular claim. Never upgrade folklore to fact because it is widely repeated.
