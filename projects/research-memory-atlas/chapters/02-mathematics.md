# Mathematics for physical fields, graph memory and research reasoning

**Research snapshot: 25 November 2026.** This volume supplies a prerequisite map, a formula notebook, original worked explanations, and a dated audit of recent AI mathematics. It is a substantial curriculum and research index. It does not claim to contain every formula or every current paper in mathematics. In particular, a released manuscript, a formalized statement, an independently replayed certificate, a published explanation and an accepted prize submission are separate records.

## How to use this volume

Begin with a question and follow the smallest set of prerequisites that makes it answerable. Use the [formula notebook](02-formula-notebook.md) for assumptions, symbols, derivation sketches and worked checks. Use `nodes.json`, `edges.json` and `formulas.json` for the machine-readable network. Use [the AI evidence audit](04-ai-mathematics-audit.md) when a headline says a problem has been solved. The [complete captured OpenAI catalogue](openai-math-catalogue.json) enumerates manuscript metadata; individual entries remain explicitly unreviewed unless promoted in the separate claim ledger.

The main discipline is to distinguish five operations: representing an object, measuring it, approximating it, proving a property about it, and interpreting the property in an application. A force-directed picture represents a graph. A shortest-path algorithm measures one kind of route cost. A vector embedding approximates semantic relationships. A convergence argument proves something about an iteration. None of these alone demonstrates that a software memory system operates like a biological brain.

### A useful order of study

| Stage | Mathematical question | Essential objects | Completion test |
|---|---|---|---|
| 1. Statements and algebra | What is the claim, and which transformations preserve it? | Sets, functions, quantifiers, equations, units | Find every excluded denominator, branch and boundary case in a short derivation. |
| 2. Linear structure | Which observations determine which unknowns? | Vectors, rank, nullspaces, SVD, conditioning | Exhibit a kernel vector for an underdetermined observation map. |
| 3. Change and accumulation | How does a local rule create global behavior? | Derivatives, integrals, differential equations | Derive a conservation identity and check its units. |
| 4. Uncertainty | What information does new evidence actually add? | Conditional probability, covariance, entropy | Show why duplicate reports cannot be multiplied as independent likelihoods. |
| 5. Networks and iteration | How do paths, cycles and updates behave? | Graphs, Laplacians, Markov chains, fixed points | Compute a small recurrence exactly and bound its stopping error. |
| 6. Geometry and analysis | How do coordinates, domains and regularity affect a field? | Manifolds, forms, weak derivatives, operators | Derive the polar Laplacian and identify its coordinate singularity. |
| 7. Research proofs | Which precise theorem was established, using which foundations? | Proof dependencies, formal statements, counterexamples | Audit a claimed theorem without replacing it by a stronger headline. |

These routes draw on university and author materials: [MIT calculus](https://ocw.mit.edu/courses/res-18-001-calculus-fall-2023/pages/open-textbook/), [MIT linear algebra](https://ocw.mit.edu/courses/18-06sc-linear-algebra-fall-2011/), [Boyd and Vandenberghe](https://web.stanford.edu/~boyd/cvxbook/), [Spielman's spectral graph lectures](https://www.cs.yale.edu/homes/spielman/561/561schedule.html), and [Tong's differential geometry chapters](https://davidtong.org/teaching/general-relativity/). They are reference routes, not claims that every page was reviewed during this task.

## 1. Algebra: preserve the question while transforming it

An equation is not just a string of symbols. It is a statement about a chosen domain. The equation `x/x=1` is true for nonzero real x and undefined at zero. Multiplying by x preserves an equation if the operation remains valid, but dividing by x can silently remove a solution. Squaring an equation can introduce extra solutions because opposite signs become indistinguishable.

This is the first connection to memory systems. An identifier-normalization rule can merge two distinct records just as squaring merges x and −x. Case folding may be appropriate for a search field and inappropriate for a case-sensitive path. A hash can identify bytes, but it cannot decide whether two papers make the same claim. Exact equality, normalized equality, semantic similarity and mathematical equivalence require different relations in the graph.

Completing the square demonstrates a reliable derivation. For `ax²+bx+c=0`, state `a≠0`, divide by a, and obtain `(x+b/(2a))²=(b²−4ac)/(4a²)`. The real-versus-complex decision occurs at the square root. The formula notebook's `mf-quadratic` retains this decision rather than displaying an answer without its domain.

Abstract algebra generalizes which operations are legal. A group models reversible composition; a ring supports addition and multiplication; a field also permits division by nonzero elements. Matrix multiplication is generally noncommutative, so scalar identities cannot automatically be used with operators. This becomes essential in magnetic spin systems, quantum observables and gauge connections. The commutator records order dependence rather than numerical error. [Milne's field-theory notes](https://www.jmilne.org/math/CourseNotes/ft.html) supply a precise route from fields to Galois symmetry.

### Questions to ask

What is the domain? Is the operation invertible? Does it preserve all solutions? Are coefficients dimensional? Does multiplication commute? Can the result be checked by substituting it into the original statement? A research agent should preserve these answers alongside the equation, not reconstruct them from memory later.

## 2. Linear algebra: identify what can and cannot be recovered

Write an observation problem as `y=Ax`. The columns of A describe how individual input coordinates affect observations. If a nonzero vector z satisfies `Az=0`, then x and x+z are observationally indistinguishable. No optimizer can recover that missing component from y alone. A regularizer can choose one representative, but choosing is not measuring.

The smallest counterexample is `A=[1 0]`. Its only singular value returned by a compact SVD is 1. Nevertheless, every vector `(0,t)` is in its kernel. Thus the statement “all returned singular values are positive, so the inverse is unique” fails for a wide rectangular matrix. Always record the domain dimension, codomain dimension, rank and nullity; when questioning identifiability, give an explicit kernel witness.

For full-rank data, conditioning asks a different question: how sensitive is recovery? `A=diag(1,10⁻⁶)` is invertible but multiplies uncertainty in its second observation by one million. A good numerical algorithm can avoid unnecessary error; it cannot remove information loss inherent in the problem. Ridge regularization changes the gain from `1/σ` to `σ/(σ²+λ)`, trading variance for bias. Formula records `mf-cond` and `mf-tikhonov` make this trade measurable.

These distinctions apply directly to summaries and caches. If a summary omits an assumption, retrieving the summary perfectly does not restore the missing assumption. If an embedding places two conflicting claims near each other, nearest-neighbor search cannot identify which is correct without source and statement metadata. Preserve the original proposition, units, scope and source version as an auditable record; treat the embedding as an access path.

### Compression requires an objective

The truncated SVD minimizes Frobenius reconstruction error under a rank constraint. That is a mathematical theorem about one objective. It does not prove that the compressed representation retains the fact a future user will need. A tiny-variance event may be the only record of a permission change, a withdrawn paper or a failed experiment. Such items require protected exact fields, regardless of the statistical compression objective. [MIT's SVD lesson](https://ocw.mit.edu/courses/18-06sc-linear-algebra-fall-2011/pages/positive-definite-matrices-and-applications/singular-value-decomposition/) is the corresponding learning route.

## 3. Calculus: local changes, global constraints and error

The derivative is a limit of a difference quotient. An implementation usually observes finite differences, so three questions immediately arise: what is the approximation error, what is the numerical rounding error, and is the underlying function even differentiable? For `f(x)=x²`, the difference quotient is `2x+h`, and the approximation error is exactly h. For `f(x)=|x|` at zero, the two one-sided limits disagree. No amount of central averaging creates the missing classical derivative.

Taylor's theorem is useful because it carries an error term. Writing `f(x+h)≈f(x)+hf′(x)` without controlling the next derivative gives no promised accuracy. The centered second-difference stencil cancels odd terms, leaving an `O(h²)` truncation error after division by `h²`. Meanwhile data noise is amplified by `h⁻²`. Refining a grid can therefore make a calculation worse when noise dominates.

Integration accumulates local contributions, but the measure matters. A uniform density in radius is not a uniform density over a disk. The polar Jacobian supplies the factor r. A uniform point sample in disk area consequently needs a square-root radius transform, not a uniform radius; this is a useful practical check for simulation sampling.

The divergence theorem and Stokes theorem connect local equations to boundary data. When deriving electrostatic Poisson equations, fluid conservation or a network flow balance, ask which internal boundaries cancel and which external boundaries remain. A singular source cannot be discarded merely because the field is smooth away from the source. The source can reappear as a boundary flux in a shrinking exclusion region.

The calculus-of-variations derivation adds another boundary lesson. Integrating `L_qdot ηdot` by parts creates an endpoint term. It disappears for fixed-endpoint variations, not by algebraic magic. Free endpoints, constraints and interfaces alter the conditions. The formula notebook develops the calculation in `mf-eulerlagrange`; the relevant foundational route is [MIT's calculus textbook](https://ocw.mit.edu/courses/res-18-001-calculus-fall-2023/pages/open-textbook/).

## 4. Probability: evidence is conditional, and duplicates are dependent

Bayes' rule follows by expressing the same joint probability in two orders. Its strongest practical lesson is that every update is conditional on a model. A prior and a likelihood are different objects. A model-generated confidence number is not automatically a calibrated likelihood.

Suppose H is a hypothesis, A is a press release, and B is an article that copies A. Updating first on A and then on B requires `P(B|H,A)` and `P(B|not H,A)`. If B contains no new information once A is known, the second update should contribute little or nothing. Multiplying two apparent likelihood ratios as though the sources were independent artificially increases confidence. Graph-memory systems should therefore store source-family relationships and derivation lineage.

The covariance formula provides an elementary demonstration. If two variables are the same measurement repeated, each has variance1 but their sum has variance4, not2. Dependence changes uncertainty. The same issue arises in agent panels: four agents reading one paper are four readers, not four independent experiments.

Entropy measures uncertainty under a distribution. It does not measure truth, wisdom or subjective meaning. A deterministic string can be scientifically profound while carrying no uncertainty under a distribution concentrated on that string. Mutual information measures statistical dependence and does not establish causation. These distinctions are consistent with the engineering scope of [Shannon's original paper](https://people.math.harvard.edu/~ctm/home/text/others/shannon/entropy/entropy.pdf).

Concentration bounds quantify sampling error only under their assumptions. The Hoeffding formula in the notebook requires independent bounded observations. Repeated cached outputs, correlated experiments or an adaptively selected “best” benchmark do not automatically satisfy those conditions. An experiment ledger should record random seed, sampling unit, independence assumptions, selection process and held-out evaluation criteria. [CMU's concentration lecture](https://www.stat.cmu.edu/~cshalizi/sml/21/lectures/06/lecture-06.html) makes those conditions explicit.

## 5. Graphs: distinguish topology, geometry, semantics and evidence

A graph consists of entities and relations. Its drawing adds coordinates, often chosen for legibility. Two nodes can be close in a drawing without an edge; two strongly related nodes can appear distant because of layout constraints. Never infer physical distance, causal influence or evidential support from a force-directed location.

Different edge types answer different questions. `requires` is a dependency. `supports` is an evidential assertion that needs a source and scope. `contradicts` records incompatible propositions under aligned assumptions. `derived_from` preserves lineage. `similar_to` is often a retrieval heuristic. `analogy` is an invitation to compare structures. A single untyped adjacency matrix erases these distinctions.

Matrix powers count walks, including repeats. A cycle A→B→A generates arbitrarily many walks, but it does not generate arbitrarily much new evidence. To retain feedback without counting it repeatedly, keep strongly connected components and apply an explicit traversal policy. Deduplicate source evidence by provenance, not merely by the path taken to find it.

For an undirected positive-weight graph, the Laplacian measures smoothness: `xᵀLx=Σw_ij(x_i−x_j)²`. This energy is the discrete cousin of `∫|∇u|²`. It creates a rigorous bridge to electrostatics and diffusion. The bridge is mathematical: when a semantic edge has weight2, that does not mean it is a physical conductor with two siemens. The physical units and interpretation must be separately supplied. [Spielman's lectures](https://www.cs.yale.edu/homes/spielman/561/561schedule.html) connect these constructions with electrical networks and spectral algorithms.

### A complete two-node recurrence

Let a random walk alternate between two nodes and restart at the first with probability0.2. The stationary recurrence is

$$r_1=0.8r_2+0.2,\qquad r_2=0.8r_1.$$

Substitution gives `r₁=0.64r₁+0.2`, hence `r₁=5/9` and `r₂=4/9`. Both are nonnegative and sum to1. The restart makes the iteration contractive even though the underlying walk is periodic. A small example like this should be checked before deploying a graph-ranking loop across thousands of records.

The rank is a visitation distribution, not a truth probability. An extensively cited mistaken claim can receive high rank. Evidence status, date, permissions and contradiction handling remain external constraints on which nodes are eligible for use.

## 6. Caching and loops: define the quantity being optimized

Cache performance is naturally an expected-cost problem. If requests for object i arrive with probability p_i, a hit costs h_i and a miss costs m_i, an idealized expected cost is

$$C=\sum_i p_i\,[z_i h_i+(1-z_i)m_i],\qquad z_i\in\{0,1\}.$$

With item sizes s_i and capacity B, the constraint is `Σs_i z_i≤B`. For a static known request distribution, maximizing saved cost `Σp_i(m_i−h_i)z_i` is a knapsack-style selection problem. This elementary derivation explains why “keep the most connected nodes” is not automatically a cache policy. Centrality, retrieval probability, recomputation cost, object size and expiry are different quantities.

Real systems introduce time variation, writes, dependencies and privacy constraints. A cache key must include all inputs that materially determine an output: source version, transformation version, relevant configuration, permission scope and model version when applicable. A cached answer for one repository revision is not automatically valid for a new revision. If a source changes, invalidate dependent summaries or mark them stale; do not silently upgrade them to the new source.

Looping should have a declared objective, an update rule and a stop condition. A contraction theorem proves convergence only when a complete state space, a self-map and a contraction constant have been established. A process that runs out of budget has stopped, but has not thereby converged. A process that repeats an identical answer may be stuck rather than correct. Useful operational stops include a validated target, a diminishing-change threshold with an error bound, a detected state cycle, a blocking missing source, or a budget limit recorded as such.

Do not confuse three caches. A local document cache stores source material. A retrieval index stores search representations. A provider prompt cache may reuse computation under provider-specific rules. A hit in one layer is not evidence of a hit or monetary saving in another. The optimization interpretation above is original modeling; measured telemetry is still needed to select a policy for the actual workload.

## 7. Geometry and topology: what the connections preserve

Differential geometry adds charts, tangent spaces, a metric and a connection. Each structure answers a different question. A chart labels points. A tangent vector represents an infinitesimal direction. A metric measures intervals. A connection compares vectors at neighboring points. Curvature records noncommutativity of transport. These distinctions prevent the frequent mistake of interpreting nonzero coordinate coefficients as a physical gravitational field or singularity without further analysis.

The Laplace–Beltrami formula provides a concrete check. In polar coordinates on the flat plane, `g=diag(1,r²)` and the volume density is r. Substitution yields

$$\Delta u=u_{rr}+\frac1r u_r+\frac1{r^2}u_{\theta\theta}.$$

The coefficients appear singular at r=0 because the angular coordinate fails there. The plane itself remains flat. A real curvature singularity requires coordinate-independent evidence and an appropriate definition. [Tong's Riemannian-geometry notes](https://davidtong.org/pdfs/teaching/general-relativity/gr3.pdf) provide the geometry behind this distinction.

Topology asks what survives continuous deformation. A triangle made of three edges has a loop; filling its interior changes that loop into a boundary. The adjacency graph alone cannot tell whether a two-dimensional face was intended. A knowledge graph's cycles therefore should not be called “holes” without defining a simplicial or cell complex and a filtration. Persistent homology is a mathematical analysis of those choices, not independent evidence that the stored knowledge reproduces a brain's organization. See [Hatcher's author-hosted text](https://pi.math.cornell.edu/~hatcher/AT/ATpage.html).

Category theory goes one level more structural. A functor preserves composition and identities. A natural transformation is coherent across every morphism, not just across a few selected examples. This makes category language useful for checking whether data-conversion pipelines preserve relationships, but the vocabulary should earn its place: an ordinary typed schema and invariant may solve the engineering problem more simply. [Leinster's textbook](https://arxiv.org/abs/1612.09375v2) is the intended entry point.

## 8. Question-led research routes

| Driving question | Prerequisite route | First reproducible exercise | Research extension |
|---|---|---|---|
| Why does potential solve a Poisson equation? | Algebra → gradient → divergence → boundary flux → weak form | Solve −u″=2 on(0,1), with zero endpoint values | Variable coefficients, singular sources, finite elements and inverse boundaries |
| What does a graph remember? | Typed entities → provenance → adjacency → path/cycle policies → probability | Build two source copies and show they add no independent evidence | Temporal graphs, contradiction retention and retrieval evaluation |
| Why can an inverse fail even with positive singular values? | Rank → rectangular SVD → kernel → regularization | Use A=[1 0] and exhibit its kernel | Identifiability in measurements, embeddings and compressed sensing |
| When does an iterative process converge? | Norm → continuity → contraction → fixed point → stopping certificate | Compare x↦x/2+1 with x↦1−x | Nonlinear dynamics, stability and robust control |
| Which mathematical structures connect magnetism with geometry? | Linear maps → groups → representations → Lie algebra → connection | Compute a planar rotation generator and its commutator | Gauge fields, holonomy, spin systems and topological phases |
| How can frequency analysis mislead? | Complex exponentials → Fourier convention → sampling → windowing → inverse problems | Distinguish cycles/s from radians/s in a known sinusoid | Nonstationary spectra, nonlinear modes and inverse source separation |
| What would establish a mass gap? | Hilbert space → self-adjoint operator → spectrum → continuum limit | Distinguish finite-matrix spectral gap from uniform continuum bound | Constructive QFT, renormalization and the remaining mass-gap question |
| What does a machine-checked proof establish? | Quantifiers → definitions → theorem dependency → axioms → kernel → interpretation | Compare an intended proposition with its exact formal statement | Semantics-preserving autoformalization and independent proof replay |

## 9. Representative current frontier map

The purpose of this table is to locate a learner near active work, not rank every subject on one leaderboard. The detailed AI statuses and adverse evidence are in the claim audit.

| Field | Foundational bridge | Dated research destination | Current evidence boundary |
|---|---|---|---|
| Discrete geometry | Counting, field extensions, lattices | [Planar unit-distance construction, 2026](https://cdn.openai.com/pdf/74c24085-19b0-4534-9c90-465b8e29ad73/unit-distance-proof.pdf) | New lower-bound family; exact optimal growth is a separate question. |
| Harmonic analysis | Fourier transforms, tubes, scale decomposition | [Wang–Zahl Kakeya in R³, 2025](https://arxiv.org/abs/2502.17655v1); [OpenAI local-smoothing release, 2026](https://openai.com/index/building-scientific-understanding-with-academic-communities/) | Different dimensions and theorem scopes; newer provider artifacts need their own review. |
| Arithmetic geometry | Fields, schemes, sheaves, representations | [Geometric Langlands five-paper project](https://people.mpim-bonn.mpg.de/gaitsgde/GLC/) | Categorical unramified statement; other Langlands variants remain separate. |
| Analytic number theory | Analytic continuation, spectra, automorphic forms | [Alpöge's RH announcement](https://alpo.ge/remark.pdf), [independent checks](https://math.mit.edu/~drew/grh/) | Formal RH validation is substantial; broader generalizations and human exposition require exact scope tracking. |
| Fluid PDE | Energy estimates, Sobolev spaces, vorticity | [OpenAI forced theorem](https://github.com/openai/NavierStokesAndEuler), [Alpöge–Buckmaster unforced package](https://github.com/tristanbuckmaster/navier-stokes) | Forced and unforced are distinct; later package is conditional and lacks numerical certificate data. |
| Arithmetic complexity | Tensors, polynomials, circuit models | [Anthropic VP/VNP artifact](https://github.com/anthropics/formal-math/tree/11b6c7e3c927df2658f513b6b68ea7f8929c62c5/vp-vnp), [OpenAI Nov24 additions](https://github.com/openai/math/blob/3344da59991ed94f9ba711217b29c1d760badfa6/history.md) | New formal research claims, with different human-review status; not Boolean P versus NP. |
| Fine-grained algorithms | Sparse graphs, reductions, matrix products | [Alman–Vassilevska Williams, 2026](https://arxiv.org/abs/2610.06783v1) | Mathematical exponent improvements; practical benefit must be benchmarked. |
| Mathematical physics | Gauge symmetry, probability, operator algebras | [Yang–Mills working group](https://github.com/yang-mills-group/YM) | Reported existence assessment explicitly excludes mass gap and uniqueness. |
| Optimization | Convexity, duality, polyhedra | [Strongly polynomial LP manuscript family, 2026](https://github.com/openai/math/blob/3344da59991ed94f9ba711217b29c1d760badfa6/history.md) | Newly released claim, not independently audited here or implemented as a replacement solver. |
| Formal mathematics | Types, proof terms, trusted kernels | [FLT formalization](https://github.com/anthropics/fermats-last-theorem), [Lean foundations](https://lean-lang.org/theorem_proving_in_lean4/Axioms-and-Computation/) | Standard axioms and exact theorem alignment must both be checked. |

## 10. A research record that can survive review

For each formula or theorem preserve the exact statement, mathematical domain, units or nondimensional convention, assumptions, source version, derivation, example, failure case and dependencies. A frontier theorem additionally needs its original artifact, proof-language entry point where relevant, human contribution, independent review status and date of the last status check.

For every new loop ask a disconfirming question. If the hypothesis is “graph expansion improves recall,” compare against lexical retrieval and keep latency and false-positive rate in the measurement. If the hypothesis is “a compressed summary retains all necessary assumptions,” remove one assumption and see whether a later solver notices. If a claim has a formal proof, compare the exact formal proposition against the intended theorem before investing in a large replay.

The graph should remember negative results as first-class records. A counterexample can be more useful than another positive analogy. A failed build with a precise toolchain is more informative than an unqualified statement that a proof is “verified.” A boundary condition, an excluded characteristic or a missing certificate is part of the mathematics and belongs in retrieval results.
