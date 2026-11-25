# What recent AI mathematics results actually establish

**Evidence cutoff: 25 November 2026.** This audit identifies substantial recent results and keeps each conclusion attached to its precise problem, assumptions, artifact and verification status. It does not support the proposition that Claude or OpenAI has solved all mathematics. The structured [claim register](03-ai-math-claim-register.md) contains the selected findings; [the metadata catalogue](openai-math-catalogue.json) separately enumerates the complete captured OpenAI release.

The distinctions below matter directly to a research memory system. A memory entry should not become more certain merely because it is linked to many other entries. It should become more useful because a reader can recover the exact statement, its evidence and the boundary at which the conclusion stops applying.

## 1. Read a claim as a mathematical object

A theorem has more structure than a headline. A useful representation is

\[
(\text{universe},\ \text{quantifiers},\ \text{assumptions},\ \text{conclusion},\ \text{proof},\ \text{version}).
\]

Changing any coordinate can change the problem. A theorem about a fixed dimension need not hold in arbitrary dimensions. An arithmetic circuit lower bound need not imply a Boolean computation lower bound. Existence need not imply uniqueness. A theorem about positive proportions of zeros need not locate every zero. A theorem about forced fluid flow need not settle unforced flow. These are logical distinctions, not rhetorical qualifications.

The following table is an interpretation guide. It is not a claim that every cited artifact has reached the same maturity.

| Evidence category | What it can establish | What it does not establish by itself |
|---|---|---|
| Competition score | Performance on the specified problem set and protocol | General capacity to solve research conjectures |
| New mathematical proof | A new theorem under its stated hypotheses | Correctness of every corollary someone might infer |
| Formalization of an old theorem | A checked representation of known mathematics | A first discovery of the underlying theorem |
| AI-assisted human research | A documented research contribution with human development or evaluation | Fully autonomous completion of every step |
| Kernel-checked artifact | Derivability of an exact encoded proposition under recorded axioms | Correct translation of an unchecked informal problem |
| Independently matched and rechecked artifact | Stronger evidence joining statement identity, proof validity and reproducibility | An administrative prize decision or a conventional explanatory account |
| Provider announcement | What the provider claims and releases | Independent confirmation of every claim |
| Conditional theorem | An implication from its explicit hypotheses | Availability or correctness of an omitted certificate |

Formal proof systems make this distinction operational: a proof term proves a type, under its actual declarations and axioms. The formal target still needs to match the intended mathematical target. The [Lean documentation on axioms](https://lean-lang.org/theorem_proving_in_lean4/Axioms-and-Computation/) explains the foundational layer; a source hash, statement bridge and independent checker log address different layers above it.

## 2. The November RH result deserves its actual evidence strength

The latest records are materially different from the August zeta-proportion result. Alpöge's November release credits collaboration with Claude. The joint Lean FRO/Mathlib statement certifies that the formal proposition matches Mathlib's `RiemannHypothesis`, and describes independent checking of an inert proof export. Andrew Sutherland's MIT record adds detailed rebuild, axiom and checker evidence. This supports a strong conclusion about the formal RH proof; this atlas did not run those checks itself. [Author announcement](https://alpo.ge/remark.pdf), [joint verification](https://leanprover-community.github.io/blog/posts/riemann-hypothesis/), [MIT verification record](https://math.mit.edu/~drew/grh/).

The institutional status is a different question. Clay's retrieved page displays **Active**; a prize award was not established in this audit. Broader generalized-RH assertions also need their own exact theorem translations: checking the classical RH proposition does not automatically certify every statement that a reader might call GRH. [Clay status](https://www.claymath.org/millennium/riemann-hypothesis/).

For a study graph, retain separate nodes for the zeta function, analytic continuation, the critical strip, the August proportion theorem, the November RH statement and each generalized theorem. The dependencies are mathematically useful. Merging the results because they share the word “Riemann” destroys the distinction between counting many zeros and locating all relevant zeros.

## 3. Navier–Stokes illustrates three independent questions

The September OpenAI manuscript's Theorem 1.1 is a **forced** breakdown statement: smooth compact forcing, zero initial velocity and bounded kinetic energy coexist with a velocity blowup at the terminal time. The pinned artifact supplies named comparator declarations. A separate audit repository reports statement and kernel checks for its explicitly identified upstream revision. Those are evidence about the exact forced theorem, not a proof of unforced Navier–Stokes. [Original theorem](https://cdn.openai.com/pdf/32d9f210-8b73-45e0-91bc-82a30aef8a9a/navier-stokes.pdf), [artifact](https://github.com/openai/NavierStokesAndEuler/tree/f9e8bc5b38b6e212696e8a30e3e91517af887bbd), [independent audit](https://github.com/francescoantoniodeluca/navier-stokes-formal-audit/tree/c2e4f438f7af8bbf222a59801696aca2c3c15b6f).

The October translation critique asks whether the prose argument faithfully corresponds to intermediate formal estimates. It does not itself refute the final formal theorem, and its authors explicitly avoid claiming that the prose proof must be incorrect. This belongs in a separate evidence record: statement correctness, formal proof validity and expository correspondence are different questions. [Original critical preprint](https://arxiv.org/abs/2610.08144).

The November Alpöge–Buckmaster package raises another issue. Its formal breakdown implications depend on a profile/certificate hypothesis. The inspected repository says numerical certificate data are absent, and the corrected package was not rebuilt. Its unconditional unforced conclusion therefore cannot be treated as established by the available conditional artifact alone. [Pinned repository and Lean notes](https://github.com/tristanbuckmaster/navier-stokes/tree/ad53419de079eb8f95f60313473374624a348546).

The logical gap can be shown without fluid mechanics. Suppose the verified theorem is

\[
P\Longrightarrow Q.
\]

A verifier accepting this implication has not supplied a proof of \(P\). If \(P\) means “these numerical inequalities hold for this specific profile,” then the profile data, enclosing arithmetic, rounding policy and certificate checker remain part of the chain required to infer \(Q\). This is why a research graph should represent `requires_certificate` separately from `proves`.

Similarly, in the PDE

\[
\partial_tu+(u\cdot\nabla)u+\nabla p=\nu\Delta u+f,\qquad \nabla\cdot u=0,
\]

the quantifiers \(\exists f\exists u\) and \(\exists u\,[f=0]\) describe different existence problems. Allowing a source term can change the admissible construction. The same equation template does not erase a condition on its terms.

## 4. Algebraic complexity, Boolean complexity and numerical speed

The Anthropic VP/VNP artifact claims arithmetic-circuit separations, with a characteristic-two exception for permanent bounds. Its README states that no human mathematician has checked the proof. The exact statement was inspected here; independent acceptance was not established. That is a narrower status than the independently certified RH result. [Pinned artifact](https://github.com/anthropics/formal-math/tree/11b6c7e3c927df2658f513b6b68ea7f8929c62c5/vp-vnp).

Why does the field matter? For a two-by-two matrix,

\[
\operatorname{per}\begin{pmatrix}a&b\\c&d\end{pmatrix}=ad+bc,
\qquad
\det\begin{pmatrix}a&b\\c&d\end{pmatrix}=ad-bc.
\]

In characteristic two, \(-1=1\), so the two formulas coincide. An arithmetic lower bound that ignores this distinction would be misstated. The algebraic complexity problem also counts a different kind of computation from a Boolean machine operating on encoded inputs. Translating between models requires a theorem; it is not an automatic consequence of similar class names.

ETH claims need a different distinction. Consider the reported shape

\[
T(n)=2^{O\!\left(n\frac{\log\log n}{\sqrt{\log n}}\right)}.
\]

Writing \(t=\log n\), the ratio of the exponent to \(n\) is proportional to \(\log t/\sqrt t\), which tends to zero. That explains the term **subexponential**. It does not turn the exponent into \(O(\log n)\), the scale that would yield polynomial running time. Hidden constants, enormous crossover points and memory costs also prevent an asymptotic statement from becoming a practical performance guarantee. The [Anthropic ETH project](https://github.com/anthropics/formal-math/tree/11b6c7e3c927df2658f513b6b68ea7f8929c62c5/eth) is recorded with that boundary; the separate [OpenAI academic review announcement](https://openai.com/index/building-scientific-understanding-with-academic-communities/) has its own evidence status.

The same lesson applies to a small polynomial exponent improvement. An algorithm with an asymptotic factor \(n^{0.0008}\) advantage can require implausibly large instances before overcoming even modest constants. The Alman–Vassilevska Williams paper reports such exponent improvements with bounded-integer and machine-model conditions, and documents substantial human development of the AI contribution. [Original 3SUM/APSP paper](https://arxiv.org/abs/2610.06783v1).

## 5. Formalizing FLT is a different achievement from discovering it

The September Claude-assisted FLT release formalizes an existing mathematical theorem and its deep human foundations. The repository gives a precise positive-natural-number statement, a Mathlib bridge and reported independent-checker evidence. That is an important formalization achievement, but its historical category remains distinct from a first proof. [Anthropic announcement](https://www.anthropic.com/research/formalizing-fermats-last-theorem), [pinned artifact](https://github.com/anthropics/fermats-last-theorem/tree/6e837e75355538c7f80bab5b956861e86c4eacc2).

A research memory should therefore record separate contribution fields: original theorem, proof strategy, formal translation, automation, expert statement review, kernel validation and exposition. Crediting all of those to a single model hides the work that made the result possible and obscures which part can be reproduced.

## 6. A complete captured catalogue is not complete mathematical verification

The OpenAI snapshot is pinned to commit `3344da59991ed94f9ba711217b29c1d760badfa6`. Its header and the independent metadata parser agree on **730 manuscripts and 375 result families**. Family IDs are non-contiguous and extend through 380. Older release counts describe older snapshots. The newest nine titles are included as metadata, with every entry defaulting to `catalogued_not_individually_reviewed`. [Pinned catalogue](https://github.com/openai/math/blob/3344da59991ed94f9ba711217b29c1d760badfa6/CONTENTS.md).

The publication history records withdrawals and repairs. Consequently, the graph must preserve the date and status of a claim, and avoid silently retrieving a withdrawn statement as settled knowledge. Metadata can be complete relative to a captured file while mathematical review is selective. [Pinned history](https://github.com/openai/math/blob/3344da59991ed94f9ba711217b29c1d760badfa6/history.md).

The accompanying parser verifies the Git blob identity before extraction. It copies titles, identifiers and URLs, not the catalogue's abstracts or proofs. The unchanged upstream Apache-2.0 license is included. A reproducible count means that another reader can inspect the exact collection; it does not certify the contents of every PDF.

## 7. Transfer these lessons into company and repository memory

A useful evidence record should retain the following fields:

| Field | Purpose |
|---|---|
| Stable claim ID | Keep links valid when a title changes |
| Exact statement and quantifiers | Prevent retrieval from broadening the theorem |
| Domain and model | Preserve characteristic, dimension, machine model and units |
| Assumptions and certificates | Make conditional dependencies explicit |
| Source URL, revision and content hash | Reconstruct the evidence that was actually reviewed |
| Access depth | Distinguish full proof, theorem statement, abstract and announcement |
| Publisher status | Preserve what the original publisher says |
| Audit status | Preserve the evaluator's separate conclusion |
| Human and model contributions | Attribute discovery, checking and exposition accurately |
| Negative evidence and limitations | Keep counterexamples, withdrawals and unresolved translation issues retrievable |
| Next review trigger | Refresh when a new version, withdrawal or independent audit appears |

Represent each relationship by its meaning. `prerequisite_of` organizes learning. `supports` joins evidence to a claim. `contradicts` records a substantive conflict. `supersedes` records a version change. `requires_certificate` prevents conditional results from losing their hypotheses. `similar_to` helps exploration but must not grant proof authority.

When a company note or code dependency changes, invalidate derived summaries through the dependency graph. Do not delete the older evidence: mark it superseded and preserve its source version. When a source has not been read, attach that fact to the edge. When an agent repeats a statement from another agent, preserve the original provenance instead of manufacturing a second independent source.

This gives a concrete acceptance criterion for the implemented memory layer: a query about a theorem should return its conditions and status with its summary. A query about a withdrawn result should surface the withdrawal. A query about “all solved problems” should distinguish the metadata collection from individually checked results. A query about an absent numerical certificate should not return an unconditional conclusion.

## 8. What the atlas still does not claim

This is a representative mathematical and AI research map with a complete captured catalogue for one publisher, not an exhaustive review of every subfield or every Claude/OpenAI result. Source depth varies and is recorded. No giant Lean artifact was built during this task, and no prize award was inferred. The Yang–Mills existence assessment explicitly leaves mass gap outside its conclusion; the official complete problem remains labelled Unsolved. [Working-group assessment](https://github.com/yang-mills-group/YM), [Clay problem](https://www.claymath.org/millennium/yang-mills-the-maths-gap/).

These limits are part of the deliverable. They identify the next research work precisely: translate additional theorem statements, locate independent assessment for newer claims, reproduce selected feasible artifacts, and add source-linked records without turning a growing catalogue into an unsupported universal claim.


# AI mathematics claim register

Snapshot: 25 November 2026. This is an evidence register, not an assertion that every listed result has been accepted. Exact proof scope and access depth are part of each record. No giant Lean release was compiled in this task.

| Claim | Category | Assessment |
|---|---|---|
| [All mathematical problems have been solved](#m-claim-universal) | universal claim audit | unsupported universal premise |
| [Gemini Deep Think: IMO 2025 gold-standard performance](#m-claim-imo) | competition benchmark | benchmark result with bounded scope |
| [Planar unit distances: polynomial construction improvement](#m-claim-unitdistance) | new research theorem | theorem statement and external review report read |
| [OpenAI ten-advance collection](#m-claim-ten) | research collection | introductory result map read not all proofs audited |
| [Claude-assisted simple critical-line zeta-zero proportion](#m-claim-zeta) | new research theorem | primary abstract and provenance read |
| [Fermat’s Last Theorem: large Lean formalization](#m-claim-flt) | formalization of an existing theorem | formalization artifact and reported second kernel check read |
| [Forced three-dimensional Navier–Stokes breakdown](#m-claim-nsforced) | new theorem with formal artifact | formal theorem evidence strong but prose translation disputed |
| [Separate unforced Euler singularity artifact](#m-claim-euler) | new theorem with formal artifact | theorem entry points inspected |
| [Navier–Stokes prose/formal translation criticism](#m-claim-ns-translation) | critical research audit | documented translation issue not refutation of final formal statement |
| [OpenAI mathematics catalogue: exact metadata census](#m-claim-catalogue) | research catalogue | metadata count verified proofs not individually reviewed |
| [OpenAI October Hodge-related withdrawals](#m-claim-withdrawals) | withdrawal/correction record | withdrawal record confirmed |
| [Truly subquadratic 3SUM and subcubic APSP](#m-claim-3sum) | AI-assisted human research theorem | primary paper scope and formal limitations read |
| [Claude ETH refutation artifact](#m-claim-claudeeth) | formal research artifact | artifact statement read independent acceptance not established |
| [OpenAI fixed-width counting-SAT subexponential claim](#m-claim-oaieth) | research claim under expert review | announcement and catalogue locator read |
| [OpenAI local smoothing for the Euclidean wave equation](#m-claim-smoothing) | frontier research claim | announcement scope read exact proof not replayed |
| [Four-dimensional Yang–Mills existence assessment](#m-claim-ymexistence) | independent expert assessment of research artifact | expert assessment read existence only |
| [Complete Yang–Mills existence and mass-gap problem](#m-claim-ymgap) | open-problem status | no decisive mass gap proof identified |
| [Anthropic VP≠VNP artifact](#m-claim-vpvnp) | formal research claim without human proof review | statement inspected independent acceptance not established |
| [OpenAI November 24 complexity and polytope additions](#m-claim-oai-newnine) | catalogued research claims | metadata only no theorem adjudication |
| [Riemann Hypothesis: November formal proof and independent checks](#m-claim-rh) | AI-assisted research with independently checked formal proof | strong independent formal verification evidence |
| [Dirichlet generalized RH: independently checked scope](#m-claim-grh) | generalization scope audit | strong independent formal verification for dirichlet scope |
| [Alpöge–Buckmaster unforced Navier–Stokes package](#m-claim-unforcedns) | conditional formal artifact with external numerical dependency | conditional artifact inspected unconditional validation incomplete |
| [Wang–Zahl three-dimensional Kakeya theorem](#m-claim-kakeya) | human research frontier | primary abstract read |
| [Categorical unramified geometric Langlands project](#m-claim-langlands) | human research frontier | project scope and part one abstract read |

<a id="m-claim-universal"></a>
## All mathematical problems have been solved

**Date:** 2026-11-25. **Category:** universal claim audit.

**System/author:** No identified primary source asserts a defensible universal result. **Model identification:** Not applicable.

No. A catalogue or benchmark cannot establish universal mathematical solvability.

**Scope:** A finite release contains selected statements; mathematical domains and problem formulations remain distinct.

**Contribution:** This is the atlas interpretation, not an attribution to either company.

**Evidence assessment:** unsupported universal premise. No universal certification identified.

**Limits:** Even verified headline theorems do not settle all related conjectures.

**Primary sources and exact locators:**

- [OpenAI mathematics release history, pinned snapshot](https://github.com/openai/math/blob/3344da59991ed94f9ba711217b29c1d760badfa6/history.md): Withdrawal and correction entries. Access: full history file inspected.
- [Clay Mathematics Institute: Yang–Mills and the Mass Gap](https://www.claymath.org/millennium/yang-mills-the-maths-gap/): Current problem status. Access: current label and problem summary inspected.

<a id="m-claim-imo"></a>
## Gemini Deep Think: IMO 2025 gold-standard performance

**Date:** 2025-07. **Category:** competition benchmark.

**System/author:** Google DeepMind. **Model identification:** Advanced Gemini Deep Think experimental version.

Five of six competition problems, 35 points, reported gold-medal standard.

**Scope:** 2025 IMO problem set; an evaluation of proof tasks with known assessment criteria.

**Contribution:** Human olympiad assessment is distinct from authoring a new research theorem.

**Evidence assessment:** benchmark result with bounded scope. Provider describes the olympiad assessment; not independently rerun here.

**Limits:** Not proof that arbitrary open conjectures can be solved.

**Primary sources and exact locators:**

- [Gemini Deep Think IMO 2025 gold-medal-standard result](https://deepmind.google/blog/advanced-version-of-gemini-with-deep-think-officially-achieves-gold-medal-standard-at-the-international-mathematical-olympiad/): Score and evaluation description. Access: announcement and score inspected.

<a id="m-claim-unitdistance"></a>
## Planar unit distances: polynomial construction improvement

**Date:** 2026-05-20. **Category:** new research theorem.

**System/author:** OpenAI. **Model identification:** Research model; no commercial model identifier inferred.

There is δ>0 and infinitely many n for which ν(n)≥n^(1+δ).

**Scope:** ν(n) counts the largest number of unordered Euclidean unit-distance pairs among n planar points.

**Contribution:** Human-edited exposition; external mathematicians reviewed and strengthened parts.

**Evidence assessment:** theorem statement and external review report read. Expert confirmation is described by the manuscript and announcement; no independent local derivation of the full construction.

**Limits:** Disproves the old near-linear conjectural scale; does not find the exact extremal function.

**Primary sources and exact locators:**

- [Planar Point Sets with Many Unit Distances](https://cdn.openai.com/pdf/74c24085-19b0-4534-9c90-465b8e29ad73/unit-distance-proof.pdf): Theorem 1.1. Access: 18-page PDF; Theorem 1.1 and construction outline inspected.
- [An OpenAI model has disproved a central conjecture in discrete geometry](https://openai.com/index/model-disproves-discrete-geometry-conjecture/): External-review attribution. Access: announcement and external-review attribution inspected.

Artifact identifiers are preserved in `ai-math-claims.json`; a listed hash pins evidence and does not itself prove the mathematical claim.

<a id="m-claim-ten"></a>
## OpenAI ten-advance collection

**Date:** 2026-08. **Category:** research collection.

**System/author:** OpenAI. **Model identification:** Research model(s); exact commercial version not inferred.

A collection covers discrete geometry, coding, group/operator problems and complexity.

**Scope:** Each of ten results has a separate theorem and assumptions.

**Contribution:** The release describes interactions with specialist reviewers and formalization.

**Evidence assessment:** introductory result map read not all proofs audited. No blanket independent acceptance is assigned to the collection.

**Limits:** 253 manuscript pages not checked line by line; catalogue depth differs from proof depth.

**Primary sources and exact locators:**

- [Ten advances in mathematics and theoretical computer science](https://openai.com/index/ten-advances-in-mathematics/): Result list. Access: dated announcement and result list inspected.
- [Ten Advances in Mathematics and Theoretical Computer Science](https://cdn.openai.com/pdf/ten-proofs-oai.pdf): Introduction and theorem map. Access: PDF metadata and introductory result map inspected.

Artifact identifiers are preserved in `ai-math-claims.json`; a listed hash pins evidence and does not itself prove the mathematical claim.

<a id="m-claim-zeta"></a>
## Claude-assisted simple critical-line zeta-zero proportion

**Date:** 2026-08-19. **Category:** new research theorem.

**System/author:** Levent Alpöge and Ralph Furman; Anthropic. **Model identification:** Claude; exact version not inferred.

The paper gives a simple critical-line zero proportion exceeding two thirds; a window calculation gives 0.6725.

**Scope:** Unconditional zeta-zero counting statement; paper also treats primitive Dirichlet L-functions.

**Contribution:** Authors verified and communicated the model-generated research.

**Evidence assessment:** primary abstract and provenance read. Formalization is reported; no local replay.

**Limits:** A positive proportion is not RH; do not merge the August theorem with November RH.

**Primary sources and exact locators:**

- [More than two thirds of the zeta zeros are simple and on the critical line](https://arxiv.org/abs/2608.13637v2): Abstract and provenance; arXiv v2. Access: abstract, version and provenance note inspected.

<a id="m-claim-flt"></a>
## Fermat’s Last Theorem: large Lean formalization

**Date:** 2026-09-04. **Category:** formalization of an existing theorem.

**System/author:** Anthropic and human mathematical contributors. **Model identification:** Claude; exact version not inferred.

For natural n≥3 and positive natural a,b,c, a^n+b^n≠c^n.

**Scope:** Positive integers; n≥3; formal theorem matched to Mathlib.

**Contribution:** Depends on the human Frey–Serre–Ribet–Wiles–Taylor–Wiles development; experts advised and inspected.

**Evidence assessment:** formalization artifact and reported second kernel check read. README reports comparator and nanoda checks, with disclosed checker patches.

**Limits:** A new formalization, not the first proof of FLT; atlas did not build it.

**Primary sources and exact locators:**

- [Formalizing Fermat's Last Theorem](https://www.anthropic.com/research/formalizing-fermats-last-theorem): Announcement. Access: dated announcement and human expert attribution inspected.
- [Fermat's Last Theorem in Lean 4](https://github.com/anthropics/fermats-last-theorem/tree/6e837e75355538c7f80bab5b956861e86c4eacc2): README, final check and Mathlib bridge. Access: README, theorem text and verification description inspected.

Artifact identifiers are preserved in `ai-math-claims.json`; a listed hash pins evidence and does not itself prove the mathematical claim.

<a id="m-claim-nsforced"></a>
## Forced three-dimensional Navier–Stokes breakdown

**Date:** 2026-09-08. **Category:** new theorem with formal artifact.

**System/author:** OpenAI. **Model identification:** Research model; commercial version not inferred.

For every ν>0, smooth compact forcing produces zero-initial-data smooth flow on [0,1) with bounded L² energy and unbounded L∞ near time 1.

**Scope:** R³; divergence-free velocity; prescribed smooth forcing; Clay forced C/D formulations.

**Contribution:** Human theorem-statement assessment and independent formal audits are documented.

**Evidence assessment:** formal theorem evidence strong but prose translation disputed. Independent repository reports kernels/comparator and a Mathlib-only statement bridge for the explicitly older upstream revision.

**Limits:** Forced theorem does not settle unforced Navier–Stokes. Prose correspondence requires separate evaluation. Clay Active is not a prize award.

**Primary sources and exact locators:**

- [Finite time blowup for Navier–Stokes](https://cdn.openai.com/pdf/32d9f210-8b73-45e0-91bc-82a30aef8a9a/navier-stokes.pdf): Theorem 1.1. Access: Theorem 1.1 and proof-outline introduction inspected.
- [OpenAI NavierStokesAndEuler formalization](https://github.com/openai/NavierStokesAndEuler/tree/f9e8bc5b38b6e212696e8a30e3e91517af887bbd): Comparator theorem declarations. Access: README and formalization metadata inspected.
- [Independent Navier–Stokes formal audit](https://github.com/francescoantoniodeluca/navier-stokes-formal-audit/tree/c2e4f438f7af8bbf222a59801696aca2c3c15b6f): Pinned upstream and ClaySpec bridge. Access: README, exact upstream revision and scope inspected.
- [Clay Mathematics Institute: Navier–Stokes Equation](https://www.claymath.org/millennium/navier-stokes-equation/): Active status. Access: current status label inspected.
- [Navier-Stokes lost in translation](https://arxiv.org/abs/2610.08144): Natural-language/formal correspondence critique. Access: abstract and documented comparison scope inspected.

Artifact identifiers are preserved in `ai-math-claims.json`; a listed hash pins evidence and does not itself prove the mathematical claim.

<a id="m-claim-euler"></a>
## Separate unforced Euler singularity artifact

**Date:** 2026-09. **Category:** new theorem with formal artifact.

**System/author:** OpenAI. **Model identification:** Research model; commercial version not inferred.

The repository separately formalizes finite-time breakdown for unforced three-dimensional Euler.

**Scope:** Euler has ν=0; do not transfer its conclusion to viscous unforced Navier–Stokes.

**Contribution:** Human statement and checker work is described in release metadata.

**Evidence assessment:** theorem entry points inspected. No separate local replay.

**Limits:** Viscosity and norm of breakdown are mathematically material.

**Primary sources and exact locators:**

- [OpenAI NavierStokesAndEuler formalization](https://github.com/openai/NavierStokesAndEuler/tree/f9e8bc5b38b6e212696e8a30e3e91517af887bbd): Euler theorem declaration list. Access: README and formalization metadata inspected.

Artifact identifiers are preserved in `ai-math-claims.json`; a listed hash pins evidence and does not itself prove the mathematical claim.

<a id="m-claim-ns-translation"></a>
## Navier–Stokes prose/formal translation criticism

**Date:** 2026-10-06. **Category:** critical research audit.

**System/author:** Bastounis, Circelli and Hansen. **Model identification:** Not applicable.

The critique identifies differences between prose and formalized intermediate estimates.

**Scope:** Examples include derivative order in Lemma 8.6 and a uniqueness inequality.

**Contribution:** Independent mathematical comparison by the named authors.

**Evidence assessment:** documented translation issue not refutation of final formal statement. This is itself a preprint; no independent adjudication of every objection performed.

**Limits:** Authors do not claim the natural-language proof is necessarily incorrect.

**Primary sources and exact locators:**

- [Navier-Stokes lost in translation](https://arxiv.org/abs/2610.08144): Lemma 8.6 discussion and explicit scope disclaimer. Access: abstract and documented comparison scope inspected.

<a id="m-claim-catalogue"></a>
## OpenAI mathematics catalogue: exact metadata census

**Date:** 2026-11-24. **Category:** research catalogue.

**System/author:** OpenAI. **Model identification:** Multiple research outputs; do not assign a single version.

The pinned CONTENTS file yields 730 manuscript links grouped into 375 result families.

**Scope:** Non-contiguous family IDs reach 380. Count manuscripts, families and verified theorems separately.

**Contribution:** Publisher maintains releases and corrections; atlas parsed metadata.

**Evidence assessment:** metadata count verified proofs not individually reviewed. Count checked programmatically; no universal proof validation.

**Limits:** All catalogue entries ≠ all open mathematics solved. All entries default to not individually reviewed.

**Primary sources and exact locators:**

- [OpenAI mathematics manuscript catalogue, pinned snapshot](https://github.com/openai/math/blob/3344da59991ed94f9ba711217b29c1d760badfa6/CONTENTS.md): Entire metadata catalogue. Access: entire catalogue parsed for metadata.
- [OpenAI mathematics release history, pinned snapshot](https://github.com/openai/math/blob/3344da59991ed94f9ba711217b29c1d760badfa6/history.md): Revision record. Access: full history file inspected.

Artifact identifiers are preserved in `ai-math-claims.json`; a listed hash pins evidence and does not itself prove the mathematical claim.

<a id="m-claim-withdrawals"></a>
## OpenAI October Hodge-related withdrawals

**Date:** 2026-10-07. **Category:** withdrawal/correction record.

**System/author:** OpenAI. **Model identification:** Not applicable.

The release history withdraws three Hodge-related manuscripts after a stabilization-trace sign error.

**Scope:** Split abelian eightfold Weil classes; Kuga–Satake for K3; rational Hodge products of K3 surfaces.

**Contribution:** Publisher records errors and dependent repairs.

**Evidence assessment:** withdrawal record confirmed. No substitute proof is inferred from a later catalogue title.

**Limits:** Keep withdrawn statements in provenance, excluded from accepted theorem retrieval.

**Primary sources and exact locators:**

- [OpenAI mathematics release history, pinned snapshot](https://github.com/openai/math/blob/3344da59991ed94f9ba711217b29c1d760badfa6/history.md): October 7 withdrawal entry. Access: full history file inspected.

<a id="m-claim-3sum"></a>
## Truly subquadratic 3SUM and subcubic APSP

**Date:** 2026-10-05. **Category:** AI-assisted human research theorem.

**System/author:** Josh Alman and Virginia Vassilevska Williams; Anthropic. **Model identification:** Claude; exact version not inferred.

The paper states bounded-integer 3SUM in O(n^1.9992) and APSP in O(n^2.9995), rounded exponents.

**Scope:** Retain integer-size bounds and computational model; formal scope differs for some real-input results.

**Contribution:** Authors understood, simplified, strengthened and extended Claude’s algorithm and accepted responsibility.

**Evidence assessment:** primary paper scope and formal limitations read. Original researchers are human coauthors, not an institutional endorsement by their universities.

**Limits:** An exponent improvement is asymptotic, not an established practical speedup.

**Primary sources and exact locators:**

- [Truly Subquadratic 3SUM and Truly Subcubic APSP via Triangles in Sparse Lopsided Graphs](https://arxiv.org/abs/2610.06783v1): Abstract, introduction and provenance. Access: abstract and theorem scope inspected.
- [Anthropic formal-math repository, pinned snapshot](https://github.com/anthropics/formal-math/tree/11b6c7e3c927df2658f513b6b68ea7f8929c62c5): 3sum-apsp README and EndStatement.lean description. Access: README and 3SUM/APSP, ETH, VP/VNP project notes inspected.

Artifact identifiers are preserved in `ai-math-claims.json`; a listed hash pins evidence and does not itself prove the mathematical claim.

<a id="m-claim-claudeeth"></a>
## Claude ETH refutation artifact

**Date:** 2026-11. **Category:** formal research artifact.

**System/author:** Anthropic. **Model identification:** Internal research Claude; README separately names Claude Opus 5.5 at high effort for rederivation, not executed here.

A deterministic counting 3-SAT algorithm is claimed with time 2^{O(n log log n / sqrt(log n))}.

**Scope:** Asymptotic Turing-machine model; variable-count interpretation must match the formal statement.

**Contribution:** No additional independent expert acceptance established in this audit.

**Evidence assessment:** artifact statement read independent acceptance not established. Formal checks are publisher-reported; atlas did not replay.

**Limits:** Subexponential is not polynomial time and does not establish P=NP.

**Primary sources and exact locators:**

- [A 2^o(n) Time Algorithm for 3-SAT](https://github.com/anthropics/formal-math/tree/11b6c7e3c927df2658f513b6b68ea7f8929c62c5/eth): README; MainResults.lean and ETHIsFalse/MainTheorem entry descriptions. Access: README, machine model and theorem-entry descriptions inspected.

Artifact identifiers are preserved in `ai-math-claims.json`; a listed hash pins evidence and does not itself prove the mathematical claim.

<a id="m-claim-oaieth"></a>
## OpenAI fixed-width counting-SAT subexponential claim

**Date:** 2026-10-26. **Category:** research claim under expert review.

**System/author:** OpenAI. **Model identification:** Research model; exact version not inferred.

Reports deterministic subexponential-time, polynomial-space counting of k-CNF assignments for fixed k.

**Scope:** Fixed k; asymptotic complexity and exact machine assumptions belong to the original theorem.

**Contribution:** Announcement names an external research review group.

**Evidence assessment:** announcement and catalogue locator read. Review described as ongoing; independent final certification not established here.

**Limits:** Paper proof not read line by line; no practical SAT solver result inferred.

**Primary sources and exact locators:**

- [Working with academic communities to build scientific understanding](https://openai.com/index/building-scientific-understanding-with-academic-communities/): ETH section. Access: dated page inspected.
- [OpenAI mathematics manuscript catalogue, pinned snapshot](https://github.com/openai/math/blob/3344da59991ed94f9ba711217b29c1d760badfa6/CONTENTS.md): Family 378; oai-paper-0721. Access: entire catalogue parsed for metadata.

Artifact identifiers are preserved in `ai-math-claims.json`; a listed hash pins evidence and does not itself prove the mathematical claim.

<a id="m-claim-smoothing"></a>
## OpenAI local smoothing for the Euclidean wave equation

**Date:** 2026-10-26. **Category:** frontier research claim.

**System/author:** OpenAI. **Model identification:** Research model; exact version not inferred.

Announces local smoothing in spatial dimensions at least two with harmonic-analysis consequences.

**Scope:** Exact integrability, derivative gain and endpoint restrictions require the original theorem.

**Contribution:** Academic engagement described in the announcement.

**Evidence assessment:** announcement scope read exact proof not replayed. No independent blanket certification established by this atlas.

**Limits:** Do not turn interior restriction-range consequences into all endpoint statements.

**Primary sources and exact locators:**

- [Working with academic communities to build scientific understanding](https://openai.com/index/building-scientific-understanding-with-academic-communities/): Local smoothing section. Access: dated page inspected.
- [OpenAI mathematics manuscript catalogue, pinned snapshot](https://github.com/openai/math/blob/3344da59991ed94f9ba711217b29c1d760badfa6/CONTENTS.md): Family 079; oai-paper-0159. Access: entire catalogue parsed for metadata.

Artifact identifiers are preserved in `ai-math-claims.json`; a listed hash pins evidence and does not itself prove the mathematical claim.

<a id="m-claim-ymexistence"></a>
## Four-dimensional Yang–Mills existence assessment

**Date:** 2026-11-10. **Category:** independent expert assessment of research artifact.

**System/author:** OpenAI and Yang–Mills working group. **Model identification:** Research model; exact version not inferred.

The working group reports a Wilson-lattice scaling-limit construction satisfying Wightman axioms.

**Scope:** Four dimensions; simple compact gauge groups; retain the group’s exact existence specification.

**Contribution:** Independent specialists assessed the construction.

**Evidence assessment:** expert assessment read existence only. A group assessment is stronger than an unreviewed provider headline; no local proof replay.

**Limits:** No mass gap or uniqueness of infinite-volume limit established by that assessment.

**Primary sources and exact locators:**

- [Yang–Mills working-group results and verification](https://github.com/yang-mills-group/YM): November 10 assessment. Access: assessment scope in README inspected.
- [Working with academic communities to build scientific understanding](https://openai.com/index/building-scientific-understanding-with-academic-communities/): Yang–Mills section. Access: dated page inspected.

<a id="m-claim-ymgap"></a>
## Complete Yang–Mills existence and mass-gap problem

**Date:** 2026-11-25. **Category:** open-problem status.

**System/author:** Clay Mathematics Institute. **Model identification:** Not applicable.

The complete Clay problem remains labelled Unsolved in the retrieved record.

**Scope:** Existence progress and strictly positive mass gap are distinct obligations.

**Contribution:** Status comes from the official problem owner and scoped working-group statement.

**Evidence assessment:** no decisive mass gap proof identified. No decisive primary proof of the full mass-gap conclusion found in this audit.

**Limits:** This is a dated status observation, not a forecast about future proof.

**Primary sources and exact locators:**

- [Clay Mathematics Institute: Yang–Mills and the Mass Gap](https://www.claymath.org/millennium/yang-mills-the-maths-gap/): Current status. Access: current label and problem summary inspected.
- [Yang–Mills working-group results and verification](https://github.com/yang-mills-group/YM): Mass-gap exclusion. Access: assessment scope in README inspected.

<a id="m-claim-vpvnp"></a>
## Anthropic VP≠VNP artifact

**Date:** 2026-11-23. **Category:** formal research claim without human proof review.

**System/author:** Anthropic. **Model identification:** Internal research Claude; exact discovery version undisclosed.

Claims VP≠VNP over all fields, with Hamiltonian-cycle lower bounds and permanent bounds outside characteristic two.

**Scope:** Arithmetic circuits; growth m^{c(log m)^(1/3)}; characteristic is material.

**Contribution:** README explicitly says no human mathematician has checked the proof.

**Evidence assessment:** statement inspected independent acceptance not established. No independent proof replay or semantic certification by this atlas.

**Limits:** Arithmetic VP/VNP is not Boolean P/NP.

**Primary sources and exact locators:**

- [VP ≠ VNP over every field: statement and research artifact](https://github.com/anthropics/formal-math/tree/11b6c7e3c927df2658f513b6b68ea7f8929c62c5/vp-vnp): README and Statement.lean arithmetic-circuit definitions. Access: README and Statement.lean inspected.

Artifact identifiers are preserved in `ai-math-claims.json`; a listed hash pins evidence and does not itself prove the mathematical claim.

<a id="m-claim-oai-newnine"></a>
## OpenAI November 24 complexity and polytope additions

**Date:** 2026-11-24. **Category:** catalogued research claims.

**System/author:** OpenAI. **Model identification:** Research model(s); exact version not inferred.

Nine new manuscripts in families 379–380 include tensor/circuit claims, multiplication exponents, sunflowers and linear programming.

**Scope:** Exact theorem/model assumptions not individually reviewed in this atlas.

**Contribution:** Human independent acceptance not established here.

**Evidence assessment:** metadata only no theorem adjudication. No independent validation assigned from the manuscript titles.

**Limits:** Do not present the 9/4 matrix-multiplication title as an atlas-verified theorem.

**Primary sources and exact locators:**

- [OpenAI mathematics manuscript catalogue, pinned snapshot](https://github.com/openai/math/blob/3344da59991ed94f9ba711217b29c1d760badfa6/CONTENTS.md): Families 379–380. Access: entire catalogue parsed for metadata.
- [OpenAI mathematics release history, pinned snapshot](https://github.com/openai/math/blob/3344da59991ed94f9ba711217b29c1d760badfa6/history.md): November 24 update. Access: full history file inspected.

Artifact identifiers are preserved in `ai-math-claims.json`; a listed hash pins evidence and does not itself prove the mathematical claim.

<a id="m-claim-rh"></a>
## Riemann Hypothesis: November formal proof and independent checks

**Date:** 2026-11-20. **Category:** AI-assisted research with independently checked formal proof.

**System/author:** Levent Alpöge with Claude. **Model identification:** Claude; exact version not inferred.

The released formal proof is certified to match Mathlib’s RiemannHypothesis proposition.

**Scope:** The usual nontrivial-zero critical-line assertion; standard Lean foundational axioms.

**Contribution:** Alpöge supplied mathematical direction; independent formal-methods teams and Andrew Sutherland audited statements and proof exports.

**Evidence assessment:** strong independent formal verification evidence. Joint Lean FRO/Mathlib statement plus MIT reproduction record report matched theorem, restricted axioms and independent kernel checks.

**Limits:** Atlas did not execute the large proof. Conventional exposition and Clay prize process are separate; no prize award established.

**Primary sources and exact locators:**

- [Alpöge's Riemann Hypothesis announcement](https://alpo.ge/remark.pdf): November 20 announcement. Access: four-page PDF inspected.
- [Lean verification of the Riemann Hypothesis](https://leanprover-community.github.io/blog/posts/riemann-hypothesis/): November 21 joint verification statement. Access: full statement inspected.
- [RH Lean proof: verification files, Andrew Sutherland](https://math.mit.edu/~drew/grh/): November 24 verifier status and axiom lists. Access: summary, theorem/axiom checklist and dated checker status inspected.
- [Clay Mathematics Institute: Riemann Hypothesis](https://www.claymath.org/millennium/riemann-hypothesis/): Active status. Access: current label inspected.

Artifact identifiers are preserved in `ai-math-claims.json`; a listed hash pins evidence and does not itself prove the mathematical claim.

<a id="m-claim-grh"></a>
## Dirichlet generalized RH: independently checked scope

**Date:** 2026-11-20. **Category:** generalization scope audit.

**System/author:** Levent Alpöge with Claude. **Model identification:** Claude; exact version not inferred.

MIT reports independently checked critical-strip zero statements for Dirichlet L-functions across all positive moduli and all characters, including the primitive-character formulation.

**Scope:** Zeros in 0<Re(s)<1 have real part 1/2. The additional nonvanishing theorem for Re(s)>1/2 excludes the trivial-character pole at s=1.

**Contribution:** Author supplied formal proofs; Sutherland and independent proof-checker teams checked named declarations.

**Evidence assessment:** strong independent formal verification for dirichlet scope. Independent checks reported by MIT; this atlas reopened the exact scope and theorem declarations, without executing the proof.

**Limits:** These checked declarations do not establish general Dedekind, Hecke, automorphic or Artin L-function variants.

**Primary sources and exact locators:**

- [Alpöge's Riemann Hypothesis announcement](https://alpo.ge/remark.pdf): Generalization discussion. Access: four-page PDF inspected.
- [RH Lean proof: verification files, Andrew Sutherland](https://math.mit.edu/~drew/grh/): What was verified: declarations 3–5 and Scope paragraph. Access: summary, theorem/axiom checklist and dated checker status inspected.

Artifact identifiers are preserved in `ai-math-claims.json`; a listed hash pins evidence and does not itself prove the mathematical claim.

<a id="m-claim-unforcedns"></a>
## Alpöge–Buckmaster unforced Navier–Stokes package

**Date:** 2026-11-20. **Category:** conditional formal artifact with external numerical dependency.

**System/author:** Levent Alpöge and Tristan Buckmaster. **Model identification:** No exact model version established from inspected artifact.

The available challenge declarations derive breakdown conditional on a bounded periodic similarity profile/certificate.

**Scope:** Numerical certificate/data are not included; interval arithmetic is outside the formalization.

**Contribution:** Authors provide a prose argument, conditional Lean statements and numerical-certification description.

**Evidence assessment:** conditional artifact inspected unconditional validation incomplete. README says corrected package not rebuilt; no local reconstruction or external unconditional validation established.

**Limits:** Do not represent conditional implications as an unconditional unforced-NS resolution.

**Primary sources and exact locators:**

- [Alpöge–Buckmaster unforced Navier–Stokes release](https://github.com/tristanbuckmaster/navier-stokes/tree/ad53419de079eb8f95f60313473374624a348546): Root README and lean/README; certificate and rebuild caveats. Access: root and Lean READMEs inspected.

Artifact identifiers are preserved in `ai-math-claims.json`; a listed hash pins evidence and does not itself prove the mathematical claim.

<a id="m-claim-kakeya"></a>
## Wang–Zahl three-dimensional Kakeya theorem

**Date:** 2025-02-24. **Category:** human research frontier.

**System/author:** Hong Wang and Joshua Zahl. **Model identification:** Not an AI attribution.

Every Kakeya set in R³ has full Hausdorff and Minkowski dimension.

**Scope:** Dimension three; definitions of Kakeya sets and both dimensions retained.

**Contribution:** Named human authors.

**Evidence assessment:** primary abstract read. Full proof not independently checked here.

**Limits:** Do not infer all-dimensional Kakeya from this source.

**Primary sources and exact locators:**

- [Volume estimates for unions of convex sets, and the Kakeya set conjecture in three dimensions](https://arxiv.org/abs/2502.17655v1): arXiv v1 abstract. Access: abstract and version record inspected.

<a id="m-claim-langlands"></a>
## Categorical unramified geometric Langlands project

**Date:** 2024-2025. **Category:** human research frontier.

**System/author:** Gaitsgory and coauthors. **Model identification:** Not an AI attribution.

A five-paper project proves the categorical unramified geometric Langlands conjecture in its stated setting.

**Scope:** Characteristic-zero de Rham and Betti settings in inspected Part I.

**Contribution:** Multi-author human research program.

**Evidence assessment:** project scope and part one abstract read. Atlas did not verify every component.

**Limits:** Not every ramified, arithmetic or quantum Langlands conjecture.

**Primary sources and exact locators:**

- [Proof of the geometric Langlands conjecture: five-paper project](https://people.mpim-bonn.mpg.de/gaitsgde/GLC/): Authors’ five-paper project. Access: authors' project page inspected.
- [Proof of the geometric Langlands conjecture I: construction of the functor](https://arxiv.org/abs/2405.03599v3): Part I v3 abstract. Access: abstract and version history inspected.
