# Physics, Mathematics & Graph Memory

Evidence snapshot: 25 November 2026.

# The study map and Donna's internal brain

This work has two linked purposes: understand the mathematics of memory and physical models, and turn that understanding into a working internal memory for Donna. The application is Daftar's own system. Its durable company records, typed graph, evidence retrieval, corrections and setup planning work without an external notes application.

The public study graph contains 367 concepts and 177 formulas. Concepts are organized through four nested levels within the fields, with prerequisite and cross-field edges. The formula cards state symbols, units, assumptions, a derivation summary, a worked check and limitations. The newest paper in a topic is not automatically the best starting point; a reliable path builds the prerequisites required to understand what its result actually says.

## A coherent order of study

1. **Algebra and functions.** Learn equality, inequalities, dimensions, vectors, matrices, eigenvalues and conditioning. Translate a physical or software question into state variables and relations before choosing a formula.
2. **Geometry and calculus.** Understand distances, coordinate systems, derivatives, gradients, integration, divergence, curl, manifolds and boundary conditions. Track which quantities are invariant and which depend on coordinates.
3. **Probability and computation.** Study distributions, Bayes' rule, entropy, numerical error, optimization, graphs and algorithmic bounds. Separate uncertainty about a claim from a retrieval score.
4. **Memory and graph operators.** Derive adjacency, the Laplacian, harmonic extension, random walks and restart diffusion. Compare exact caches with retrieval indexes and durable records. Test source changes, expiry, and repeated tasks.
5. **Electrostatics and magnetism.** Derive field and potential relations, constitutive assumptions, energy, interfaces, Poisson problems, microscopic models and dynamics. Learn when a continuum or mean-field approximation breaks down.
6. **Waves and gravity.** Connect modes, spectra, resonance, damping and inference to wave equations. Progress from Newtonian gravity through curvature, geodesics, gravitational radiation and carefully stated research frontiers.
7. **Current mathematics and AI results.** Read the exact proposition, hypotheses, proof artifact, checking status and independent assessment. Distinguish a formalization of a known theorem, a new restricted theorem, a numerical certificate, a translation dispute and a full problem resolution.

The branches need not be studied strictly in order. The graph gives local prerequisite paths so a question about caching can lead back to probability or linear algebra, and a question about a new physics result can lead back to the governing equation and its regime.

## What to ask of every formula

What are the state variables? What has units? Which sign and normalization convention is used? What is assumed about smoothness, boundaries, noise and approximation scale? Which quantities are observable? Can a simple limiting case falsify my interpretation? Is this an identity, a model, a bound, an estimator or a reported research theorem? What would I need to measure or prove before using it in a decision?

A worked numerical check establishes a narrow fact about that example. It is not a substitute for a theorem's hypotheses, a proof, an experiment or an uncertainty budget. The cards deliberately carry limitations alongside equations so retrieval cannot present an attractive formula without its regime.

## What the internal brain adds

Donna's operating memory links repositories, people, skills, goals, job outcomes and saved knowledge. It can retrieve an older relevant decision, inspect its provenance, preserve a later correction, identify a missing setup component and turn those observations into a saved plan. Public research can supply methods and source leads without gaining access to private company records.

Typed links describe different relations: prerequisite, membership, support, implementation, correction, contradiction or analogy. The graph is therefore more than a display of backlinks. A link still does not prove causation, scientific truth or permission. These distinctions are part of the implemented record and retrieval contract.

## Scope of the evidence snapshot

The snapshot date is 25 November 2026. Frontier reading is representative and explicitly labeled by access depth. Some sources were read in selected full-text sections, some through abstracts or repository assessments, and catalogue-only entries were not proof-reviewed. All 730 manuscript entries in the pinned OpenAI catalogue are included as metadata in 375 families; 24 selected recent AI claims receive a more detailed qualification audit. These counts must not be interpreted as 730 newly solved or independently certified problems.

The field coverage reports identify specific gaps, including deeper numerical-relativity formulations, nonlinear-wave systems, correlated matter, advanced geometry and many uninspected papers. They form an expansion queue for later bounded research. The present deliverable provides a substantive foundation-to-frontier map and working memory implementation; it does not assert that all of mathematics or physics has been exhaustively completed.


\newpage

# Graph memory: from a linked note to an auditable research system

**Evidence snapshot: 25 November 2026.** This chapter explains the mathematics and engineering behind the implemented Daftar memory layer. It connects to the four physics chapters and the mathematics notebook through explicit prerequisite and analogy edges. The numerical examples below are original teaching calculations. They are not measurements of a human brain, a commercial memory product, or a deployed Daftar installation.

## 1. What exactly is being remembered?

Before selecting a database or drawing a network, distinguish the objects that need to survive a session. A source is a document or observation that can be reopened. A claim is a statement about something. A concept is an organizing idea. A formula is a mathematical relation with a domain and assumptions. A decision records what was chosen, why, and under which constraints. A task records work still to do. An artifact is a concrete output. A receipt records an observed execution or publication event.

These objects can be connected, but they are not interchangeable. A note called “Yang–Mills solved” is too coarse to retain what matters. An adequate record distinguishes existence, uniqueness, mass gap, the exact formal statement, proof artifact, independent checks, criticisms, and the date of each assessment. A source can support one part while saying nothing about another. Similarly, a source saying a game asset was imported does not establish physical accuracy, engine performance, or publication.

The first useful graph therefore contains relationships such as *source supports claim*, *formula assumes condition*, *concept is prerequisite of concept*, *test checks implementation*, *artifact was produced by task*, and *remote tree contains artifact*. An edge labeled merely “related” is still useful for discovery, but it carries much less evidential meaning. Keep an explicit *analogy* edge when two domains share mathematical structure without an established physical identity.

This separation is an engineering decision embodied in the [Daftar implementation](https://github.com/occult-kranti/engineering-intelligence-atlas/tree/main/projects/research-memory-atlas). It lets a future worker ask a precise question: “Which assumption was used here?” or “What changed after the source was corrected?” The answer should be a traceable set of records, rather than a confident paraphrase of an old conversation.

## 2. What Obsidian's graph does, and what has to be added

Obsidian's documented graph represents notes as vertices and internal links as edges. Its local view exposes neighborhoods at a chosen depth. Backlinks are incoming links, while unlinked mentions are a separate feature that finds textual occurrences of a name. These are useful navigation primitives; they do not automatically infer a scientific mechanism or verify a claim. See the official [graph](https://obsidian.md/help/plugins/graph) and [backlink](https://obsidian.md/help/plugins/backlinks) documentation.

Consider three notes: *Matrix algebra*, *Graph Laplacian*, and *Electrostatic potential*. Linking them makes a learning path visible. Yet a bare link does not tell a reader whether algebra proves the electrostatic model, whether the Laplacian is only a numerical approximation, or whether the author merely noticed a resemblance. The atlas adds edge types and formula cards to answer those questions.

A stable identity is also essential. Renaming a note should not make its scientific result a new object. Conversely, two things called “potential” should not be merged simply because their labels match. Electric potential is measured in volts; gravitational potential has units of energy per unit mass; a Hopfield objective may be dimensionless. The words overlap while the models differ. Keep immutable IDs, human-readable aliases, and a domain field.

Portable Markdown remains useful. Each exported note contains its stable ID, domain, status, source links, formulas where applicable, and typed descriptions beside wikilinks. The export can be opened as an Obsidian vault without installing a custom plugin. Editor-centered tools such as [Foam](https://github.com/foambubble/foam) and block-centered systems such as [Logseq](https://github.com/logseq/logseq) provide adjacent authoring approaches. Their project documentation was inspected as discovery material; compatibility with every current extension and migration format was not tested.

## 3. Biological inspiration has a precise boundary

The complementary-learning-systems literature distinguishes rapid acquisition of particular experiences from slower acquisition of structured knowledge. For software, this suggests preserving an event ledger alongside a curated concept layer. The connection is a design analogy. A JSON record is not a hippocampal neuron, and a batch of regression tests is not an observed replay mechanism in a brain. The author manuscript of [Kumaran, Hassabis, and McClelland](https://web.stanford.edu/~jlmcc/papers/KumaranHassabisMcClelland16FinalMS.pdf) is the reference for that distinction.

The analogy becomes useful when it generates a falsifiable software requirement. For example: an episodic record should preserve the original observation; a semantic summary should retain pointers to those episodes; and a correction should be able to invalidate a summary that depended on the mistaken observation. These requirements can be tested without making any neurological claim.

Associative models provide a different mathematical bridge. A classical Hopfield network can retrieve stable patterns by descending a scalar function under specified update rules. The original [Hopfield paper](https://pmc.ncbi.nlm.nih.gov/articles/PMC346238/) motivates this model family. The formula notebook derives the energy change for a single asynchronous binary update, states the symmetric-weight assumption, and warns that synchronous updates can cycle. This is more informative than saying that a note graph “works like a brain.”

Modern Hopfield work establishes particular connections between continuous associative updates and attention. Those results have their own assumptions and capacity statements. They do not imply unlimited factual memory in a language-model application. See [Ramsauer and colleagues](https://arxiv.org/abs/2008.02217) and the original [Transformer paper](https://papers.neurips.cc/paper_files/paper/2017/hash/3f5ee243547dee91fbd053c1c4a845aa-Abstract.html).

## 4. The smallest mathematical graph model

Let a graph have vertices indexed by integers. Under the convention used here, the adjacency entry $A_{ij}$ is the weight of an edge from vertex $i$ to vertex $j$. For an undirected graph, $A$ is symmetric. Define the degree $d_i=\sum_j A_{ij}$ and diagonal matrix $D=\operatorname{diag}(d_i)$. The combinatorial Laplacian is

$$L=D-A.$$

Applied to a vertex signal $x$, it gives $(Lx)_i=\sum_jw_{ij}(x_i-x_j)$. A constant signal has no differences, so $L\mathbf1=0$. This immediately explains why the full connected Laplacian is singular: adding a constant to a potential leaves every difference unchanged.

For a three-vertex path with unit weights,

$$L=\begin{pmatrix}1&-1&0\\-1&2&-1\\0&-1&1\end{pmatrix}.$$

Its eigenvalues are $0,1,3$. The zero eigenvalue is the constant mode, not a numerical bug. To solve for a unique potential, fix a boundary value or impose a compatible gauge. If the endpoints are fixed at 1 and 0 with no interior source, the middle equation is $2u_2-u_1-u_3=0$, hence $u_2=1/2$.

The same algebra appears in resistor networks, finite-difference approximations, harmonic extension, graph regularization, and parts of field theory. Its interpretation changes with units and assumptions. With electrical conductances and voltages, a quadratic expression may describe power. With arbitrary link weights and note scores, the expression is an abstract smoothness penalty. Shared algebra does not supply a missing physical apparatus or measurement.

The identity

$$x^TLx=\frac12\sum_{i,j}w_{ij}(x_i-x_j)^2$$

also shows why nonnegative symmetric weights make $L$ positive semidefinite. Every term is a nonnegative weighted square. A negative “contradicts” edge cannot be inserted into a random-walk transition as though it were a negative probability. Keep contradiction as its own semantic relation; use a signed-graph model only after specifying the different mathematics it requires.

## 5. How graph traversal differs from graph reasoning

A breadth-first search explores neighbors with a queue. A visited set prevents cycling through the same vertex forever. Depth and node limits bound the work. If A links to B, B links to C, and C links to A, the traversal can still finish after visiting three vertices.

That is a computational guarantee, not a reasoning guarantee. Discovering a path from a source to a conclusion does not prove the conclusion. The path may include an analogy, a disputed assertion, or an irrelevant high-degree hub. An evidence inspector must preserve the relation types and original sources so the reader can assess the path.

Learning plans require a narrower graph. Include only prerequisite relations and attempt a topological ordering. The implementation uses Kahn's algorithm. If vertices remain after removing all zero-indegree vertices, the prerequisite graph is not acyclic. The remainder may include both cycle members and their descendants; labeling every remainder a cycle member would be incorrect.

A conceptual graph can legitimately contain cycles. An execution plan may need a DAG to avoid circular waiting. These two graphs serve different purposes and should not be forced into the same representation. A research loop can be represented as a sequence of versioned execution DAGs, each producing a new knowledge snapshot.

## 6. Lexical retrieval is a useful baseline

The implementation starts with words. It normalizes text, tokenizes labels and summaries, removes a declared stopword set, and computes BM25 over the eligible documents. The important phrase is *eligible documents*: company scope and temporal validity are applied before corpus statistics are calculated.

Why does ordering matter? Suppose a private company has ten thousand documents repeating a particular term. If those documents contribute to inverse document frequency before being filtered out of the results, they can still change the public ranking. Even without exposing their text, the private corpus has influenced a supposedly public answer. Computing statistics after scope filtering removes that pathway in this implementation.

The chosen positive-IDF variant is

$$\operatorname{idf}(t)=\log\left(1+\frac{N-n_t+0.5}{n_t+0.5}\right).$$

BM25 then combines term frequency saturation and document-length normalization. The exact variant, tokenization, repeated label weighting, and parameters are recorded; they are not presented as an optimized universal choice. The original framework is documented by [Robertson and Zaragoza](https://doi.org/10.1561/1500000019).

This baseline has a valuable failure mode: a query with no matching terms returns no evidence. It does not wander through an unrelated populated graph merely to produce an answer. The lack of embedding-based paraphrase matching is a known limitation and an explicit future experiment, rather than a capability quietly implied by the word “semantic.”

## 7. Personalized diffusion adds connected evidence

Normalize outgoing graph weights into a row-stochastic transition matrix $P$. Let $s$ be a probability distribution over query-relevant seed vertices. Personalized PageRank iterates

$$p_{t+1}=\alpha P^Tp_t+(1-\alpha)s,\qquad0\le\alpha<1.$$

The restart term repeatedly returns probability mass toward the question. Dangling vertices redistribute through the seed distribution. For two alternating vertices seeded entirely at the first and $\alpha=0.85$, the stationary mass is approximately $(0.54054,0.45946)$. A related item can therefore receive substantial mass even without directly repeating the query term.

That mass means graph affinity under the declared walk. It is not a 54% probability that the first claim is scientifically true. Nor does a retrieved path automatically establish causality. The paper family [HippoRAG](https://arxiv.org/abs/2405.14831) and [HippoRAG 2](https://arxiv.org/html/2502.14802v2) is relevant because it uses graph-assisted retrieval for associative questions. Our code is a smaller deterministic baseline; it does not implement those papers' full extraction, embedding, and recognition pipelines.

The implementation gives reverse navigation half the raw forward weight while preserving the original logical direction in the evidence packet. This helps discovery through backlinks without rewriting “A requires B” as a claim that B requires A. Analogy and contradiction links remain inspectable but are excluded from default propagation.

Convergence is also explicit. A stochastic transition with restart is a contraction in the appropriate norm. An iteration residual can bound distance to the fixed point; an iteration cap merely bounds computation. The packet reports both iteration count and residual so these are not confused.

## 8. Why combine rankings instead of adding raw scores?

BM25 scores and stationary graph masses have different scales. Adding them directly makes an arbitrary unit mismatch look like a principled decision. Reciprocal rank fusion combines ordering information instead:

$$R(d)=\sum_j\frac{w_j}{c+r_j(d)}.$$

The baseline uses one-based ranks, $c=60$, lexical weight 1, and graph weight 0.7. An item ranked first in both scores $1.7/61\approx0.027869$. That is a ranking value, not 2.79% confidence. The underlying fusion method is described in the original [Cormack–Clarke–Büttcher paper](https://cormack.uwaterloo.ca/cormack/cormacksigir09-rrf.pdf); the particular weights in Daftar are implementation choices awaiting broader evaluation.

Graph expansion can help multi-step questions and harm precise ones. A highly connected general concept may crowd out a narrow source. A related claim may be historically interesting but not answer the current question. The correct response is to measure retrieval quality on a fixed set of tasks, not to assume more edges always improve memory.

Evidence packets therefore include direct lexical rank, graph rank, matched terms, typed connections, source locators, status, and omission counts. Their serialized UTF-8 byte size is checked after metadata settles. When all useful content does not fit, the packet remains honest about what was omitted.

## 9. Five different things are often called a cache

First, a source cache retains permitted document bytes or metadata so a source can be reopened reproducibly. Second, an index cache retains derived lexical or graph structures. Third, a result cache reuses the answer to a particular retrieval query. Fourth, a provider's prompt cache may reuse matching prefixes of model input. Fifth, an attention KV cache holds intermediate tensors during inference.

Only the third is implemented as the persistent local cache in this project. The native worker additionally has a bounded in-process evidence cache. Hosted Donna uses the public retrieval code but does not claim a persistent retrieval cache. The atlas does not silently install an embedding service, alter model weights, or assert a provider cache hit.

The local OpenAI SDK exposes cached-token fields, and current [OpenAI documentation](https://developers.openai.com/api/docs/guides/prompt-caching) describes model-dependent provider caching and telemetry. Those are a separate observation surface. A local cache hit does not show that an API charged fewer tokens. Actual token, write, latency, and cost receipts would be needed before making that claim.

Python's [memoization documentation](https://docs.python.org/3/library/functools.html) is a useful conceptual starting point: a cache returns a prior function result. The central correctness question is whether the key identifies every input that can change that result. If the function reads a file but the key includes only the query string, changing the file can leave the cached answer stale.

## 10. The mathematics of a correct cache key

Treat retrieval as a function of the question, source snapshot, algorithm, allowed scope, policy, temporal eligibility, and retrieval parameters. The cache key is a cryptographic digest of a deterministic encoding of these dependencies. A source-only correction must invalidate the key even when the summary text is unchanged.

The implementation stores immutable snapshots by content hash and updates a per-scope pointer. A repeated identical import is idempotent. Each retrieval loads the selected snapshots, derives the eligible temporal graph, and uses those identities in the result-cache key. A cache envelope also records its own payload digest and checks returned records against authorized active graph nodes. Malformed or inconsistent derived caches are discarded and recomputed.

This is not authentication against a malicious owner of the filesystem. The local store assumes a trusted process with access to its directory. It is not exposed as a multi-user service, and its command-line scope flags do not authenticate a company member. Production company access stays in Daftar's existing authorization path.

Time-to-live provides an additional reuse limit. It does not replace invalidation. Under an illustrative homogeneous Poisson update model, the chance of at least one update during age $t$ is $1-e^{-\lambda t}$. Real research updates can be bursty, so this formula is a planning model rather than a source-freshness guarantee. An exact version change is stronger evidence than a low estimated update probability.

The implemented persistent eviction policy is bounded FIFO by last write. It is deliberately not labeled LRU. Under fully associative LRU with uniform-sized entries, reuse distance gives a hit condition: fewer than capacity many distinct other items have been accessed since the prior access. The stack-distance literature, including [IBM's author-hosted record](https://research.ibm.com/publications/efficient-stack-distance-computation-for-priority-replacement-policies), explains why replacement policy matters.

## 11. Time, corrections, and memory that can change its mind

A source can be published on one date, describe an earlier event, be retrieved later, and be corrected later still. These are different times. Record document time, valid time, retrieval time, and observation time where they matter.

The implementation's validity intervals are half-open: a record applies when `valid_from <= as_of < valid_until`. A fact expiring exactly at noon must be absent from a noon query. The same rule applies to edges. Otherwise an expired relationship could still let evidence propagate between active vertices.

Temporal graph systems such as [Zep](https://arxiv.org/html/2501.13956v1) motivate preserving changing relationships, while [Graphiti](https://github.com/getzep/graphiti) is a relevant implementation project. This release uses a smaller snapshot-and-interval design. Old snapshots persist locally, but the CLI currently queries selected current snapshots; it does not expose a full historical “what the system knew at every past time” service.

A useful future extension is explicit bitemporal querying: “What was true at time $t$ according to evidence recorded by time $r$?” That needs retained versions, clear correction relationships, and queries over both clocks. Merely adding a `date` field does not solve it.

## 12. Looping should improve an artifact, not just repeat work

A productive research round starts with a question and an input version. It produces a concrete artifact and exposes an unresolved weakness. A reviewer examines the evidence or implementation, identifies a defect or decisive uncertainty, and the next round changes something because of that finding. A final check tests the changed result.

In this work, independent review found concrete implementation faults: a parseable but inconsistent cached payload could be reused, final packet metadata could exceed a small byte limit, an unchecked optional field could crash retrieval, and source namespacing could exceed an identifier bound. Those observations led to code changes and regression cases. They are genuine adaptive rounds because the next action depended on an observed result.

The improvement quantity should be defined against fixed criteria: $\Delta U=U(\text{new};D)-U(\text{old};D)$. A larger file, more agents, more searches, or a larger graph is not itself a gain. Repeated tuning can also overfit an evaluation set, so later phases need held-out questions and adversarial updates.

Microsoft's November 2026 [GraphRAG research account](https://www.microsoft.com/en-us/research/story/the-evolution-of-graphrag-advancing-systems-and-evaluation-together/) discusses evolving systems alongside their evaluation. This is relevant context, but the release does not claim to reproduce that product or its benchmark. A small deterministic suite establishes specific local behavior; it is not a general SOTA result.

Stop conditions are part of the design. Preserve the result when acceptance is met, a real allowance is exhausted, a decisive input is unavailable, or repeated work adds no information. A scheduled future run would require a separately created task. Nothing in this repository implies agents continue running after this session ends.

## 13. How the company and skill integration works

The native OfficeWorker receives a bounded public research packet selected for its current goal. The hosted Donna path receives the same kind of public evidence through the shared retrieval core. Existing company-scoped conversation, knowledge, dependency artifacts, and permissions remain in their established paths.

This improves continuity in a concrete way: a physics job can find a formula and its assumptions; a memory job can find cache invalidation and temporal validity; a repository job can find publication receipts. The packet does not grant a tool, hire an employee, run a provider, or authorize spending. The source-review stage treats retrieved material as data, including instructions embedded in a source.

The reusable skill begins by recovering the actual repository and handoff. It then frames a question, retrieves relevant evidence, reopens decisive sources, maintains typed relationships, runs bounded review loops, and records real publication state. Detailed theory remains in the atlas; the skill contains only the procedures needed to use it.

Volatile diagnostics are kept out of stable model context. A cache-hit flag and the current timestamp can change between otherwise identical requests. Including them in the prompt hash would undermine reproducibility and prevent sensible context reuse. Source revisions and substantive evidence remain part of the identity; per-request telemetry is reported separately.

## 14. How to test whether the memory is useful

The first release verifies correctness properties: source joins, scope exclusion, changing versions, exact validity boundaries, no-match abstention, bounded traversal, prerequisite cycles, cache corruption, idempotent ingestion, and note export. It does not claim a measured advantage over all existing memory systems.

The next evaluation should freeze a representative set of real tasks before tuning. Include single-fact questions, multi-step questions, time-sensitive corrections, contradictory sources, absent answers, code-to-test traceability, and questions that cross mathematical prerequisites. Compare lexical-only retrieval with graph-assisted retrieval under the same context budget.

Measure evidence precision, recall, source-attribution correctness, and ranking quality separately from answer quality. Record latency percentiles, indexing cost, storage, and any provider usage with consistent boundaries. If a judge is an LLM, record its model, prompt, repetitions, and uncertainty. Preserve the labels and errors so another run can reproduce the comparison.

[LongMemEval](https://arxiv.org/abs/2410.10813) supplies useful categories, including temporal reasoning, updates, and abstention. [Mem0](https://arxiv.org/abs/2504.19413), [Hindsight](https://arxiv.org/html/2512.12818v1), and [MemGPT](https://arxiv.org/abs/2310.08560) are distinct architectural comparisons. Their published scores cannot be ranked fairly without matching datasets, model choices, retrieval budgets, judges, and revisions. They are research references here, not installed competing services.

## 15. The questions that should drive the next rounds

1. Which unanswered company tasks actually need graph traversal, and which are better served by a direct file or lexical search?
2. How often does a graph-expanded item provide missing support rather than topical distraction?
3. What information is lost when an episode is consolidated into a summary, and can the original source be reopened at the necessary granularity?
4. Which formulas share a valid operator or limiting case, and which apparent connections are only an analogy?
5. Can an expired, retracted, or corrected claim survive through a summary, edge, cached packet, or exported vault?
6. Can a private corpus alter a public ranking, even when no private text is returned?
7. Does a new study path depend on a conjecture, a theorem, a numerical experiment, or a provider announcement?
8. What is the smallest observable that would disconfirm the current explanation?
9. Are repeated agent conclusions independent checks of original material or repetitions of one source?
10. What measured benefit justifies an embedding service, graph database, or more complex agent loop beyond this baseline?

The graph makes these questions navigable. The evidence, mathematics, and tests determine their answers.


\newpage

# Mathematics for physical fields, graph memory and research reasoning

**Research snapshot: 25 November 2026.** This volume supplies a prerequisite map, a formula notebook, original worked explanations, and a dated audit of recent AI mathematics. It is a substantial curriculum and research index. It does not claim to contain every formula or every current paper in mathematics. In particular, a released manuscript, a formalized statement, an independently replayed certificate, a published explanation and an accepted prize submission are separate records.

## How to use this volume

Begin with a question and follow the smallest set of prerequisites that makes it answerable. Use the [formula notebook](FORMULA_NOTEBOOK.md) for assumptions, symbols, derivation sketches and worked checks. Use `nodes.json`, `edges.json` and `formulas.json` for the machine-readable network. Use [the AI evidence audit](AI_MATHEMATICS.md) when a headline says a problem has been solved. The [complete captured OpenAI catalogue](data/mathematics/openai-math-catalogue.json) enumerates manuscript metadata; individual entries remain explicitly unreviewed unless promoted in the separate claim ledger.

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


\newpage

# Electrostatics: sources, constraints, computation and learned long-range structure

## What this chapter establishes

Electrostatics starts with a source and ends with a boundary-value problem. Charge alone does not determine a unique numerical potential until the domain, material law, boundary conditions and reference convention are stated. That organizing idea scales from a pair of charges to dielectrics, biological continuum models and machine-learned atomistic potentials. The accompanying catalogue provides individual records with SI variables, derivation sketches, checked examples and failure conditions; this chapter connects those records into a working method. Foundational reference: [Feynman, Electrostatics](https://www.feynmanlectures.caltech.edu/II_04.html).

The concept graph uses four-part paths such as `electrostatics → Boundary-value theory → Elliptic equations → Poisson equation` and `electrostatics → Computation and frontier → Learned long-range models → Latent electrostatics`. Four levels are a navigational choice, not a claim that physics has a unique canonical hierarchy. The full list is in `nodes.json`; `prerequisite_of` points from the earlier concept toward the later one.

## 1. From force to potential

For a stationary charge in homogeneous vacuum, the Coulomb field is radial and falls as inverse distance squared. Superposition allows a finite set of charges to become a volume, surface or line integral. Always match the source measure to its units: volume density is C/m³, surface density C/m² and line density C/m. Substituting one into the wrong measure can produce a plausible diagram and an incorrect dimension. See [pf-coulomb](FORMULA_NOTEBOOK.md#pf-coulomb) and [pf-charge-integral](FORMULA_NOTEBOOK.md#pf-charge-integral).

The electrostatic force does conservative work, so introduce a scalar potential with **E** = −∇φ. A volt is a joule per coulomb. Field is a spatial derivative of potential and therefore has units V/m; multiplying a field by a distance estimates a voltage only when the field and path are sufficiently controlled. An equipotential curve is orthogonal to the field where both are smooth. A constant potential shift changes no force. These distinctions prevent a common conceptual collapse in which charge, voltage, field intensity and stored energy are treated as interchangeable. [Potential construction](https://www.feynmanlectures.caltech.edu/II_06.html), [pf-potential-gradient](FORMULA_NOTEBOOK.md#pf-potential-gradient).

**Worked spherical calculation.** A total charge Q spread uniformly through a sphere of radius R has density 3Q/(4πR³). A Gaussian sphere at r<R encloses Qr³/R³, giving E(r)=Qr/(4πεR³). Outside, E(r)=Q/(4πεr²). Integrating inward from φ(∞)=0 gives

$$
\phi(r)=\begin{cases}
\dfrac{Q}{8\pi\varepsilon R}\left(3-\dfrac{r^2}{R^2}\right),&r<R,\\
\dfrac{Q}{4\pi\varepsilon r},&r\ge R.
\end{cases}
$$

The field vanishes at the center, but the potential reaches a finite maximum there for Q>0. Differentiating the interior expression gives ∇²φ=−3Q/(4πεR³)=−ρ/ε. Potential and normal field are continuous because there is no separate surface sheet. For a conducting sphere with the same charge, by contrast, charge resides on the surface and the interior potential is constant. Identical total charge does not imply identical interior physics. This calculation synthesizes [Gauss-law foundations](https://www.feynmanlectures.caltech.edu/II_04.html) and [boundary methods](https://www.feynmanlectures.caltech.edu/II_07.html).

## 2. Why boundaries belong in the theorem

Gauss's law gives ∇·**E**=ρ/ε. Combining it with **E**=−∇φ yields Poisson's equation; setting the source to zero gives Laplace's equation. Specifying values of φ on a closed boundary is a Dirichlet problem. Specifying its normal derivative is a Neumann problem. A pure Neumann problem needs compatibility between total source and boundary flux and leaves an arbitrary additive constant. Mixed boundaries need their own existence and uniqueness conditions. [pf-gauss](FORMULA_NOTEBOOK.md#pf-gauss), [pf-poisson](FORMULA_NOTEBOOK.md#pf-poisson), [Feynman boundary analysis](https://www.feynmanlectures.caltech.edu/II_07.html).

The uniqueness proof is an especially useful reusable pattern. Suppose two solutions have identical charge and Dirichlet boundary data. Their difference u is harmonic and vanishes at the boundary. Multiply ∇²u=0 by u and integrate by parts:

$$
0=\int_\Omega u\nabla^2u\,dV
=\int_{\partial\Omega}u\partial_nu\,dA-\int_\Omega|\nabla u|^2dV.
$$

The boundary term is zero; the integral of a nonnegative quantity must vanish, so u is constant, then zero. This is more powerful than a picture of field lines: any candidate solution satisfying the equation and prescribed boundary is the solution in that domain. [pf-dirichlet-uniqueness](FORMULA_NOTEBOOK.md#pf-dirichlet-uniqueness).

**Image-charge example.** A charge q at height a above a grounded plane has the same upper-half-space potential as q together with a fictitious −q reflected beneath the plane. The construction is valid because the potential vanishes on the plane and the real-domain source is correct; uniqueness supplies the proof. The attraction is q²/(16πεa²). The physical induced surface charge is not a literal point charge beneath the conductor. The assembly energy is −q²/(16πεa), carrying a half-factor relative to q times the induced potential because the induced distribution changes during assembly. [pf-image-plane](FORMULA_NOTEBOOK.md#pf-image-plane), [energy discussion](https://www.feynmanlectures.caltech.edu/II_08.html).

A Green function is an impulse response for the spatial operator **and its boundary conditions**. It is not just the free-space inverse distance kernel reused everywhere. A multipole expansion is instead a controlled far-field representation: the monopole summarizes total charge, the dipole summarizes its first moment, and higher moments resolve finer angular structure. A zero monopole does not mean zero field. The truncation is useful only when the observation distance exceeds the source extent sufficiently for the needed accuracy. [pf-green](FORMULA_NOTEBOOK.md#pf-green), [pf-multipoles](FORMULA_NOTEBOOK.md#pf-multipoles), [potential methods](https://www.feynmanlectures.caltech.edu/II_06.html).

## 3. Matter changes the closure

Polarization **P** records a coarse-grained dipole density. Its divergence gives bound volume charge and its normal component gives bound surface charge. Defining **D**=ε₀**E**+**P** lets Gauss's law count free charge, but **D** is not an independent substitute for a material law. A linear isotropic dielectric uses **P**=ε₀χₑ**E**; an anisotropic medium needs a tensor. Hysteresis, nonlinear response, dispersion and microscopic interfaces can invalidate that simple closure. [Feynman, Dielectrics](https://www.feynmanlectures.caltech.edu/II_10.html), [pf-polarization](FORMULA_NOTEBOOK.md#pf-polarization).

At an ordinary electrostatic interface, tangential **E** is continuous, while the jump in normal **D** equals free surface charge. A jump in permittivity therefore changes the normal field even without free interface charge. In numerical work, flux continuity should be built into the discretization. Treating every interface point as if ε were a globally constant scalar can violate the governing conservation law. [pf-interface](FORMULA_NOTEBOOK.md#pf-interface).

The energy formula U=½∫**E**·**D** dV belongs to a linear, nondispersive, quasistatically assembled material model. For a nonlinear reversible material, the charging integral ∫**E**·d**D** is the relevant starting point. For irreversible media, a state function may not account for all losses. Capacitance is a geometry-and-material relation between conductor charges and potentials; multi-conductor systems naturally have a capacitance matrix rather than a single scalar. [pf-field-energy](FORMULA_NOTEBOOK.md#pf-field-energy), [pf-capacitance](FORMULA_NOTEBOOK.md#pf-capacitance), [electrostatic energy](https://www.feynmanlectures.caltech.edu/II_08.html).

## 4. Screening is a model of responsive particles

Debye screening comes from mobile charges responding thermally to potential. Write species densities as nₛ=nₛ₀ exp(−qₛφ/kBT), insert them into Poisson's equation, then linearize only when |qₛφ|≪kBT. The neutral reference cancels the constant source term; the first-order term produces a positive inverse screening length squared. The resulting screened potential is proportional to exp(−r/λD)/r. Without the small-potential condition, the nonlinear Poisson–Boltzmann problem must be treated directly. [pf-debye](FORMULA_NOTEBOOK.md#pf-debye), [pf-pb](FORMULA_NOTEBOOK.md#pf-pb).

This continuum picture neglects some correlations, ion-size effects, chemical specificity and atomic solvent structure. It can still be useful when those omissions are controlled against the observable of interest. The question is not whether the numerical residual is small alone; it is whether the continuum approximation, interface geometry, boundary placement and charge parameterization are adequate. The [pyDelPhi paper](https://pubs.acs.org/doi/10.1021/acs.jcim.5c02818) and [neural Poisson–Boltzmann paper](https://www.sciencedirect.com/science/article/pii/S0021999125007284), both published online in 2025 with 2026 journal issues, are selected implementation frontiers. An author-hosted pyDelPhi PDF was sampled; the neural paper was inspected through indexed publisher and author-affiliated abstracts. Performance rankings and independent benchmark replication are not claimed. The classical screening derivation is cross-checked against [Goldstein and Keyser, section 2.3](https://www.damtp.cam.ac.uk/user/gold/pdfs/teaching/Handout_SMB_131125.pdf).

## 5. Numerical operators, compression and invalidation

The five-point finite-difference stencil is a local comparison operator. Taylor expansion gives a leading second-order spatial truncation error for a smooth solution on a uniform grid. A small linear-system residual proves that the discretized equations were solved accurately; it does not prove the continuum solution is accurate. Refine the mesh, move the outer boundary and test interfaces separately. The exact polynomial φ=x²+y² is a useful implementation check because the stencil returns its Laplacian exactly, yet that one check is not a convergence theorem. [pf-fd-poisson](FORMULA_NOTEBOOK.md#pf-fd-poisson).

The finite-element weak form moves derivatives from the solution onto a test function through integration by parts. This permits a broader function space, accommodates geometry and gives an energy interpretation. Boundary-element methods instead exploit a suitable Green kernel to move unknowns to boundaries; they may reduce dimensionality but produce dense interactions unless compressed. Multipole methods compress well-separated interactions hierarchically. The original [Greengard–Rokhlin paper](https://www.sciencedirect.com/science/article/pii/0021999187901409) supplies primary provenance for fast many-particle evaluation; this atlas does not reproduce its timings. [pf-weak-form](FORMULA_NOTEBOOK.md#pf-weak-form).

Ewald methods split a periodic long-range sum into rapidly convergent real- and reciprocal-space contributions plus self/boundary corrections. Charge neutrality and the chosen periodic boundary convention are part of the problem. A local update can have a global electrostatic effect. Consequently, a computational cache must track the dependencies of compressed summaries, reciprocal grids or charge-equilibration states; “only one atom changed” does not guarantee only its nearest-neighbor result changed. Historical provenance: [Ewald, 1921](https://onlinelibrary.wiley.com/doi/10.1002/andp.19213690304); modern author discussion: [Kim and Cheng, 2025/2026](https://arxiv.org/html/2512.18029v1).

## 6. Selected frontier: learned charges and physical inductive structure

The [Latent Ewald Summation research paper](https://www.nature.com/articles/s41467-025-63852-x) and [author perspective](https://arxiv.org/html/2512.18029v1) combine learned local features with long-range electrostatic structure. The central modeling distinction is between a latent quantity useful for energy/force prediction and a unique physically measurable atomic charge. The latter is not guaranteed. Global charge redistribution, dielectric heterogeneity and distributed computation remain explicit limitations. Abstract or author-selected results support a method description, not a universal superiority claim.

Charge equilibration makes that global dependence concrete. Minimize a quadratic energy subject to total charge; the Lagrange multiplier produces a coupled saddle-point linear system. A change in one environment can alter charges throughout the model. For software memory, the useful transfer is a dependency rule: derived cached quantities must be keyed by all effective inputs, including global constraints and parameter versions. That is a design lesson from a mathematical structure, not a claim that a repository stores Coulomb fields. [pf-qeq](FORMULA_NOTEBOOK.md#pf-qeq), [Rappé and Goddard, 1991](https://pubs.acs.org/doi/10.1021/j100161a070).

## Questions that test understanding

1. Why does the same total charge produce different fields inside a uniformly charged sphere and a conducting shell?
2. Which exact boundary condition makes a proposed image solution valid, and in what domain?
3. How can a nearly zero solver residual coexist with a materially wrong electrostatic energy?
4. Which cache dependencies become global when a total-charge constraint is introduced?
5. What observation would distinguish an adequate continuum dielectric model from a merely well-converged numerical solution?

Complete answers should name the assumptions before manipulating formulas. The linked formula cards provide the necessary steps; the coverage ledger identifies deeper topics still awaiting dedicated source review.


\newpage

# Magnetism: currents, quantum order, topology and controlled memory states

## The organizing distinction

Magnetism spans several levels that should remain distinct: fields created by prescribed currents; energy and momentum exchanged by time-dependent electromagnetic fields; microscopic magnetic moments; collective ordered phases; and devices that write, retain and read a state. A result at one level does not automatically establish a result at the next. In particular, imaging a stable texture or measuring a band splitting is different from demonstrating an integrated memory with measured retention, endurance, error rate and energy cost. Foundational entry: [Feynman, Magnetostatics](https://www.feynmanlectures.caltech.edu/II_13.html).

## 1. Currents, continuity and force

Charge conservation relates current divergence to changing charge density: ∂ρ/∂t+∇·**J**=0. A truly steady current has zero divergence, including all return paths. The familiar drawing of an isolated current segment is a field-calculation idealization, not a complete stationary circuit. A wire that delivers charge somewhere must have a consistent source, sink or return path in the physical description. [pf-continuity](FORMULA_NOTEBOOK.md#pf-continuity).

The magnetic part of the Lorentz force is q**v**×**B**. Its scalar product with velocity vanishes, so it bends an ideal particle trajectory without doing instantaneous mechanical work. Electric fields can change the particle's kinetic energy. This does not mean magnets can never exchange energy with mechanical systems: moving conductors, changing currents, source circuits and induced electric fields provide the relevant work channels. See [pf-lorentz](FORMULA_NOTEBOOK.md#pf-lorentz) and [Feynman's induction treatment](https://www.feynmanlectures.caltech.edu/II_17.html).

**Worked circular motion.** In a uniform magnetic field, a nonrelativistic particle with perpendicular speed v has centripetal force mv²/r=|q|vB. Therefore r=mv/(|q|B) and the orbital angular frequency is |q|B/m. Radius grows with speed while the nonrelativistic cyclotron frequency does not. A parallel velocity adds translation along the field, giving a helix. Once relativistic momentum matters, the mass-times-speed expression must be replaced and the frequency changes. This calculation is an application of the Lorentz-force card, not an all-plasma model.

## 2. Magnetostatic solutions and gauge freedom

Biot–Savart integrates the contribution of a localized steady current distribution. Ampère's law converts circulation of **B** around a loop into enclosed current, but it gives the field algebraically only when symmetry controls the integrand. For a long straight wire, cylindrical symmetry gives B=μ₀I/(2πr). For a finite arbitrary conductor, choosing a convenient loop does not manufacture symmetry. [pf-biot-savart](FORMULA_NOTEBOOK.md#pf-biot-savart), [pf-ampere](FORMULA_NOTEBOOK.md#pf-ampere), [magnetostatic source](https://www.feynmanlectures.caltech.edu/II_13.html).

Because ∇·**B**=0, a vector potential can locally represent **B**=∇×**A**. Adding ∇χ to **A** leaves **B** unchanged. A gauge condition removes redundant representation degrees of freedom when solving equations, but gauge choice does not change the observable field. Multiply connected domains and quantum phase experiments require care beyond an elementary local argument. [pf-vector-potential](FORMULA_NOTEBOOK.md#pf-vector-potential), [Feynman, The Vector Potential](https://www.feynmanlectures.caltech.edu/II_15.html).

For a small current loop, the magnetic moment is current times oriented area. In a prescribed external field its torque is **m**×**B** and an appropriate orientation energy is −**m**·**B**. If currents and positions are allowed to change together, the power supplies must be included in energy bookkeeping. Differentiating a field-energy expression while silently holding the wrong control variable fixed can predict the wrong mechanical force. [pf-dipole-torque](FORMULA_NOTEBOOK.md#pf-dipole-torque).

## 3. Time dependence closes the conservation laws

Faraday's law connects changing magnetic flux with electric circulation. For a moving loop, the motional term **v**×**B** participates in electromotive force. Inductance summarizes a quasistatic flux-current relation; an ideal linear inductor stores ½LI² and opposes changes through a voltage L dI/dt. These relations are not license to ignore radiation, resistance, saturation or changing geometry. [pf-faraday](FORMULA_NOTEBOOK.md#pf-faraday), [pf-inductor](FORMULA_NOTEBOOK.md#pf-inductor).

Ampère's original steady-current form cannot be the full time-dependent law because its divergence would force ∇·**J**=0 at all times. Adding ε₀∂**E**/∂t in vacuum and using Gauss's law restores charge continuity. This is an example of a constraint selecting the required structure of an equation. The complete vacuum Maxwell system then yields waves with c=1/√(μ₀ε₀). The constants must be interpreted under modern SI: c is exact, while μ₀ and ε₀ are connected to measured electromagnetic constants rather than both separately exact. [pf-maxwell](FORMULA_NOTEBOOK.md#pf-maxwell), [NIST constants](https://physics.nist.gov/cuu/Constants/).

**Deriving the energy budget.** Dot the Ampère–Maxwell equation with **E**, dot Faraday's law with **B**/μ₀, and subtract using

$$\nabla\cdot(\mathbf E\times\mathbf B)=\mathbf B\cdot(\nabla\times\mathbf E)-\mathbf E\cdot(\nabla\times\mathbf B).$$

The result is ∂u/∂t+∇·**S**=−**J**·**E**, with vacuum u=(ε₀E²+B²/μ₀)/2 and **S**=**E**×**B**/μ₀. The equation specifies storage, transport and transfer to matter. A resonator can concentrate energy spatially while obeying this budget. An apparent gain must be assessed across a closed boundary and a full time interval, including sources and stored-energy changes. [pf-poynting](FORMULA_NOTEBOOK.md#pf-poynting), [Feynman, Field Energy and Field Momentum](https://www.feynmanlectures.caltech.edu/II_27.html).

## 4. From moments to statistical order

Magnetization **M** is magnetic moment per volume. Its curl and boundary cross-product act as equivalent bound currents in a macroscopic description. Defining **H**=**B**/μ₀−**M** separates free-current bookkeeping from magnetization, but a constitutive law is still required. Linear isotropic susceptibility is useful only within its domain; hysteresis and domain rearrangement cannot be reconstructed from one constant χ. [pf-magnetization](FORMULA_NOTEBOOK.md#pf-magnetization), [Feynman, Ferromagnetism](https://www.feynmanlectures.caltech.edu/II_36.html).

For independent two-state magnetic moments, the partition function is Z=2cosh(μB/kBT). Differentiating its logarithm gives M=nμtanh(μB/kBT). At weak field this is nμ²B/(kBT), while at high field it saturates. The factor for a classical continuously oriented moment differs; importing the classical 1/3 into a two-state model mixes models. [pf-paramagnet](FORMULA_NOTEBOOK.md#pf-paramagnet), [Feynman, Paramagnetism and Magnetic Resonance](https://www.feynmanlectures.caltech.edu/II_35.html).

Collective magnetism requires interactions. Ising variables retain a discrete component, whereas a Heisenberg model uses vector or spin-operator couplings. Exchange sign, lattice geometry, dimensionality, anisotropy, disorder and competing couplings determine possible phases. Frustration means local interaction preferences cannot all be simultaneously satisfied; it does not simply mean “complex network.” A finite graph with an energy function also differs from an infinite system with a thermodynamic phase transition. [pf-spin-model](FORMULA_NOTEBOOK.md#pf-spin-model), [Feynman, Magnetic Materials](https://www.feynmanlectures.caltech.edu/II_37.html).

The computational connection to associative memory is specific: pairwise interaction energies can produce many attracting configurations under a chosen dynamics. Whether those configurations encode intended memories, retain capacity under noise, or correspond to a biological circuit must be established separately. The physics graph therefore marks the Ising-to-graph comparison as an **analogy**, preventing it from acting as evidence for a brain-level identity.

## 5. Dynamics, defects and protected quantities

Landau–Lifshitz–Gilbert dynamics combines precession with dissipative relaxation of magnetization. Its effective field derives from an energy functional containing exchange, anisotropy, applied-field and demagnetizing terms as needed. Unit-length dynamics should preserve |**m**|; damping should decrease the stated energy when no drive supplies work. Those provide useful numerical checks. The γ convention must specify whether the effective field is **H** in A/m or **B** in tesla. [pf-llg](FORMULA_NOTEBOOK.md#pf-llg), [NIST OOMMF evolvers](https://math.nist.gov/oommf/doc/userguide21a0/userguidexml/sec_oxsEvolvers.html).

A skyrmion charge integrates how a two-dimensional magnetization texture wraps the sphere of directions. Integer quantization needs smoothness and boundary conditions that compactify or appropriately fix the domain. A topology label therefore does not imply immunity to boundary escape, singular configurations, heating or destructive drive. The [2024 skyrmion-bag experiment](https://advanced.onlinelibrary.wiley.com/doi/full/10.1002/adma.202403274) supplies a material-specific example; geometry, field and temperature limit its stability. [pf-skyrmion](FORMULA_NOTEBOOK.md#pf-skyrmion).

Two other topological ideas deserve separate nodes. A Berry phase is acquired by a quantum state transported adiabatically around a parameter loop; it requires eigenstates and a transport law, not merely a drawn cycle. A two-dimensional vortex has winding of an angular order parameter around a defect. Its energy grows logarithmically with size, as does its placement entropy, motivating a vortex-unbinding mechanism. Neither winding construction is identical to skyrmion charge. [pf-berry-phase](FORMULA_NOTEBOOK.md#pf-berry-phase), [Berry, 1984](https://doi.org/10.1098/rspa.1984.0023); [pf-vortex-energy](FORMULA_NOTEBOOK.md#pf-vortex-energy), [Kosterlitz and Thouless, 1973](https://doi.org/10.1088/0022-3719/6/7/010).

## 6. Plasma and superconducting bridges

MHD couples fluid inertia to electromagnetic stress under a continuum closure. Combining resistive Ohm's law with induction produces advection/stretching of **B** plus magnetic diffusion. Setting fluid velocity to zero leaves exponential decay of each spatial Fourier component; it does not create an oscillation. Adding fluid inertia and magnetic tension produces Alfvén waves. The fluid approximation must be reconsidered near kinetic scales or when predicted speeds approach c. [pf-mhd-induction](FORMULA_NOTEBOOK.md#pf-mhd-induction), [pf-alfven](FORMULA_NOTEBOOK.md#pf-alfven), [Fitzpatrick's MHD-wave notes](https://farside.ph.utexas.edu/teaching/plasma/Plasmahtml/node107.html).

Superconductivity introduces a coherent quantum phase. The Josephson phase rate relates voltage to an energy difference for charge 2e, providing a precise frequency-voltage conversion. An ideal zero-voltage supercurrent has zero electrical power IV; it is not an energy source. Circuit resistance, capacitance, magnetic flux and quasiparticle channels determine actual device dynamics. [pf-josephson](FORMULA_NOTEBOOK.md#pf-josephson), [Feynman, A Seminar on Superconductivity](https://www.feynmanlectures.caltech.edu/III_21.html).

## 7. Selected 2024–2026 frontier and proof-status boundaries

[MnTe evidence in 2024](https://www.nature.com/articles/s41586-023-06907-7) and [Co₁/₄TaSe₂ in 2026](https://www.nature.com/articles/s41467-026-76784-x) study altermagnetic spin splitting. [Electrical reading and switching in PtTe₂/CrSb](https://www.nature.com/articles/s41563-026-02721-4) advances the device-control question. Those source records are indexed publisher coverage in this pass; they establish specific reported demonstrations, not audited production-memory metrics. Compensated magnetization alone does not identify an altermagnet because the symmetry and momentum dependence matter.

Non-Abelian gauge theory generalizes an electromagnetic connection to matrix-valued fields. The commutator term makes curvature nonlinear. A Wilson loop traces group-valued transport around a closed path, cancelling endpoint gauge transformations. A software graph cycle is not a Wilson loop without this additional structure. [pf-nonabelian](FORMULA_NOTEBOOK.md#pf-nonabelian), [gauge-theory lecture](https://www.tpi.uni-jena.de/~floerchinger/qft2/lecture15/).

The current 2026 status must be stated narrowly. The [Yang–Mills assessment repository](https://github.com/yang-mills-group/YM) and [November 9 committee statement](https://www.kitp.ucsb.edu/sites/default/files/3rd-Statement-About-Quantum-YangMills-Theory_Nov-9.pdf) endorse the described four-dimensional scaling-limit existence construction. The repository explicitly excludes a mass-gap proof and uniqueness of the infinite-volume limit. This atlas inspected the assessment and reproduction instructions but did not rebuild the proof package. “Existence,” “mass gap,” “formalized component,” “independent assessment” and “locally replayed verification” remain separate graph attributes.

## Questions that test understanding

1. Where does energy enter when a moving magnetic system performs mechanical work?
2. Which γ and field-unit convention does a micromagnetic simulation use?
3. What boundary or smoothness assumption protects a stated topological charge?
4. Which extra measurements turn a switching demonstration into a useful memory specification?
5. What exact statement remains unproved when an existence construction excludes the mass gap?


\newpage

# Gravity: inverse-square dynamics, spacetime geometry and bounded frontier claims

## Conventions and scope

This chapter uses metric signature (−,+,+,+), takes x⁰=ct when all coordinates are given in length units, and declares a Riemann convention in the formula catalogue. Newtonian density is mass per volume; cosmological density is energy density divided by c² unless explicitly stated. These choices eliminate many apparent disagreements caused by a missing c², a different scale-factor normalization or a curvature-sign reversal. The foundational route follows [Tong's general-relativity course](https://www.damtp.cam.ac.uk/user/tong/gr/grhtml/) with SI restored explicitly.

The chapter develops a path to current research, not a complete classification of every gravity theory. Strong-field numerics, cosmological inference and quantum gravity each require their own statistical or mathematical machinery. A compact formula can define an entire research program without solving it.

## 1. The Newtonian model is already a boundary problem

Newtonian gravity shares an inverse-distance Green kernel with electrostatics, but the force is attractive for positive masses and the potential obeys ∇²Φ=+4πGρₘ. The acceleration is −∇Φ. This is an exact correspondence between mathematical operator forms under different source conventions; it does not identify mass with electric charge. [pf-newton](FORMULA_NOTEBOOK.md#pf-newton), [pf-grav-poisson](FORMULA_NOTEBOOK.md#pf-grav-poisson), [Tong, weak gravity](https://www.damtp.cam.ac.uk/user/tong/gr/grhtml/S5.html).

**Worked tidal calculation.** For Φ=−GM/r, the Hessian is

$$
\partial_i\partial_j\Phi=\frac{GM}{r^3}(\delta_{ij}-3\hat r_i\hat r_j).
$$

Two nearby falling particles have relative acceleration −(Hessian Φ)**ξ**. Radial separation therefore stretches with coefficient 2GM/r³, while either transverse separation compresses with coefficient −GM/r³. The trace vanishes outside the source, agreeing with the vacuum Poisson equation. Transforming into a frame falling with one particle removes its local acceleration but cannot remove this relative effect across the pair. That is the Newtonian precursor of curvature. [pf-curvature](FORMULA_NOTEBOOK.md#pf-curvature), [Tong, Riemannian geometry](https://www.damtp.cam.ac.uk/user/tong/gr/grhtml/S3.html).

For two bodies, relative and center-of-mass coordinates separate the dynamics. The reduced mass handles relative kinetic energy; the total mass enters the relative orbital frequency. Energy and angular momentum reduce the central-force problem to one radial degree of freedom. Confusing one body's barycentric radius with the relative semimajor axis creates a mass-ratio error even when Kepler's formula looks familiar. [pf-kepler](FORMULA_NOTEBOOK.md#pf-kepler), [Tong, geodesics and orbital limits](https://www.damtp.cam.ac.uk/user/tong/gr/grhtml/S1.html).

## 2. Variational mechanics is the bridge to geometry

Stationary action provides a reusable derivation method. Perturb a path, integrate its velocity-variation term by parts, impose endpoint conditions and use the arbitrariness of the remaining variation. This gives Euler–Lagrange equations. The word stationary matters: some physical paths are saddle points, so “nature always minimizes action” is too strong. [pf-variational](FORMULA_NOTEBOOK.md#pf-variational).

In relativity, the metric converts coordinate displacements into invariant intervals. For a timelike worldline, dτ²=−ds²/c² gives the proper time a comoving ideal clock measures. Coordinate time is a label attached to a chart; it need not coincide with every clock. In flat inertial coordinates the metric produces familiar special-relativistic time dilation. In curved geometry, the full metric and observer path must be used. [pf-metric-time](FORMULA_NOTEBOOK.md#pf-metric-time), [Tong, differential geometry](https://www.damtp.cam.ac.uk/user/tong/gr/grhtml/S2.html).

To differentiate a vector field while retaining its geometric meaning, introduce a connection. Metric compatibility and zero torsion determine the Levi-Civita connection. A geodesic has tangent vector transported parallel to itself, giving an acceleration term plus a connection term. Connection components can be nonzero in flat polar coordinates; curvature is the tensorial obstruction that remains after coordinate effects are separated. [pf-connection](FORMULA_NOTEBOOK.md#pf-connection), [pf-geodesic](FORMULA_NOTEBOOK.md#pf-geodesic).

**A useful invariance check.** In a flat plane, a straight path written in Cartesian coordinates has zero coordinate acceleration. In polar coordinates the radial coordinate generally accelerates and the angular coordinate generally changes nonuniformly. The polar connection terms cancel those coordinate accelerations. Therefore “nonzero coordinate acceleration” is not a sufficient detector of a physical force. Likewise, a complicated graph layout does not establish curved physical space; a metric and operational interpretation would first be required.

## 3. Einstein's equations are a constrained dynamical system

The stress-energy tensor contains energy density, momentum density and stresses. Einstein's equations relate those quantities to curvature, with a possible cosmological constant. In length coordinates, curvature has units m⁻² and the factor G/c⁴ turns energy density into the same units. The contracted Bianchi identity makes the geometric side covariantly divergence free, demanding compatible matter conservation. [pf-einstein](FORMULA_NOTEBOOK.md#pf-einstein), [Tong, Einstein equations](https://www.damtp.cam.ac.uk/user/tong/gr/grhtml/S4.html).

The Einstein–Hilbert action packages this structure. Varying the metric produces both bulk terms and boundary terms; a well-posed variation requires the correct boundary data and corresponding boundary action. It is not legitimate to drop a boundary divergence merely because the final equation is familiar. The chosen matter action determines its own equations and stress tensor. [pf-einstein-action](FORMULA_NOTEBOOK.md#pf-einstein-action).

The Newtonian limit is a nontrivial consistency check. A weak, static metric has g₀₀≈−(1+2Φ/c²). For slowly moving particles, the geodesic equation recovers acceleration −∇Φ, while the field equations recover Poisson's equation. Thus Newtonian theory appears as a controlled regime rather than an unrelated rule. Conversely, a solution outside that regime cannot be justified by extrapolating one weak-field formula indefinitely. [Tong's weak-field derivation](https://www.damtp.cam.ac.uk/user/tong/gr/grhtml/S5.html).

Numerical relativity adds initial constraints, gauge conditions, stable evolution formulations, mesh control and waveform extraction. The existence of a numerical plot is insufficient: constraint violations and resolution convergence must be assessed. This atlas maps that branch and explains why it is needed, while leaving a full formulation-by-formulation derivation to the expansion queue.

## 4. Exact solutions and observable effects

The Schwarzschild metric describes the spherically symmetric vacuum exterior with zero cosmological constant. It also describes the exterior of a suitable spherical star, so it is not synonymous with a black hole at every radius. Its mass parameter sets rₛ=2GM/c². The coefficient singularity at rₛ is removable by a suitable chart, whereas the central curvature singularity is a different issue. Rotating objects require additional structure such as the Kerr solution. [pf-schwarzschild](FORMULA_NOTEBOOK.md#pf-schwarzschild), [Tong, black holes](https://www.damtp.cam.ac.uk/user/tong/gr/grhtml/S6.html).

The redshift calculation illustrates the role of observers. A stationary spacetime conserves an energy associated with its time symmetry. A static observer's locally measured frequency divides that conserved quantity by a position-dependent normalization. Emitter and receiver therefore obtain a frequency ratio depending on their locations and motions. In the weak stationary limit, light climbing through a potential difference ΔΦ loses a fraction ΔΦ/c² of its frequency. A one-metre height difference near Earth's surface is an illustrative fractional scale near 10⁻¹⁶; interpreting clock data at that scale requires systematic control as well as stability. [pf-redshift](FORMULA_NOTEBOOK.md#pf-redshift), [Tong, geodesics](https://www.damtp.cam.ac.uk/user/tong/gr/grhtml/S1.html).

Light deflection and perihelion advance follow from null and timelike geodesics. The leading formulas have explicit weak-field conditions and depend on impact parameter or orbital eccentricity. Strong lensing, spin and finite-source effects require extensions. A formula with a small expansion parameter should carry the parameter's estimated size whenever used for a numerical claim. [pf-weak-orbit-tests](FORMULA_NOTEBOOK.md#pf-weak-orbit-tests).

## 5. Gravitational waves connect derivatives to data

Linearizing the metric around a background produces a wave equation after gauge control. Conservation laws remove monopole radiation and constrain dipole behavior, leaving a changing mass quadrupole as the leading slow-motion source. The radiative strain is proportional to its second time derivative; emitted power depends on the squared third derivative. The exact definition of the trace-free quadrupole fixes the prefactor. [pf-gw-strain](FORMULA_NOTEBOOK.md#pf-gw-strain), [pf-gw-power](FORMULA_NOTEBOOK.md#pf-gw-power), [Tong, weak gravity](https://www.damtp.cam.ac.uk/user/tong/gr/grhtml/S5.html).

For a circular binary, the leading luminosity grows as separation to the power −5. Combining negative orbital-energy loss with the Kepler relation produces increasing orbital frequency: a chirp. The approximation explains the mechanism, but late inspiral, merger and ringdown need more accurate relativistic waveforms and calibrated detector response. A catalogue's conclusion depends on its likelihood, event selection, waveform assumptions and noise treatment.

The selected current paper [GWTC-5.0: Tests of General Relativity, July 2026](https://arxiv.org/abs/2607.19293) reports seven test families across 168 cumulative events and overall agreement with GR within stated limits. The source was inspected at abstract and collaboration-summary depth, not independently reanalysed. This constrains tested deviations; it is not a theorem excluding every alternative theory or a proof that the low-energy theory remains exact at arbitrary scales.

## 6. Cosmology: expansion, inference and model dependence

Homogeneity and isotropy reduce the background geometry to a scale factor and curvature sign. The Friedmann equation describes its rate; stress-energy conservation describes dilution and pressure work. A length-valued scale factor with k=−1,0,+1 is used in the catalogue. A dimensionless scale factor is equally legitimate if the curvature parameter's units change consistently. [pf-friedmann](FORMULA_NOTEBOOK.md#pf-friedmann), [Tong, The Expanding Universe](https://davidtong.org/teaching/cosmology/cosmohtml/S1.html).

For a separately conserved component with constant p=wρc², integration gives ρ∝a⁻³⁽¹⁺ʷ⁾. Matter dilution comes from growing volume; radiation has an additional redshift factor; a vacuum-like component has constant density. Acceleration depends on ρ+3p/c², so negative enough pressure can accelerate expansion without a local repulsive force law between ordinary masses. [pf-equation-state](FORMULA_NOTEBOOK.md#pf-equation-state).

Distances, redshifts, clustering and growth constrain these models statistically. The [DESI DR2 Lyα full-shape analysis, July/August 2026](https://arxiv.org/html/2607.27410v3) adds Alcock–Paczyński information near effective redshift 2.33. Its individual Lyα constraint moves toward ΛCDM, while combined-model preferences depend on dataset combinations. This is why a current atlas must retain dates and inference context rather than preserve only an earlier “dark energy evolves” headline. Neither microscopic dark-matter identity nor a fundamental dark-energy mechanism follows from the background formula alone.

## 7. Quantum and AI-assisted frontier: what is and is not established

Hawking's semiclassical calculation assigns temperature to an approximately stationary black hole. Together with the first-law relation it yields area entropy. A solar-mass Schwarzschild example has a very low predicted temperature; inverse mass scaling and negative heat capacity follow algebraically. These relations do not determine the final evaporation state or resolve the information problem. [pf-hawking](FORMULA_NOTEBOOK.md#pf-hawking), [Hawking, 1975](https://authors.library.caltech.edu/records/2wsvj-qrt68).

Entanglement experiments are often proposed to probe gravitational mediation. The inference depends on assumptions about the mediator, locality and how matter is represented. [Aziz and Howl's paper, including its 2026 revision](https://arxiv.org/html/2510.19714v3), argues that specified classical-gravity/QFT constructions can generate entanglement. This is a theoretical challenge to a class of interpretations, not an observed discovery that gravity is classical or a settled universal impossibility result for quantum-gravity tests.

Two November 2026 preprints require equally precise scope. [The Hawking–Page transition at weak coupling](https://hexagonmath.org/2611.00175v1) reports a negative weak-coupling quartic coefficient in a specified large-N supersymmetric thermal gauge theory, supporting a first-order transition there. It does not establish the same behavior at every coupling. [The spinless modular bootstrap at large central charge](https://hexagonmath.org/2611.00174v1) reports a computer-assisted optimal leading slope in its admissible class Ā for the lightest non-vacuum Virasoro-primary dimension. “Spinless” sums primaries of all spins by dimension. Equality with the infinite-order finite-derivative optimum remains conjectural; [pf-bootstrap](FORMULA_NOTEBOOK.md#pf-bootstrap) records this distinction and computes the constant. Both are preprints with disclosed AI provenance and partial human-understanding status; their proofs were not independently replayed here. The [provider announcement](https://www.anthropic.com/research/claude-black-hole-physics) is provenance, not a substitute for the mathematical statements.

The open research branches remain substantial: ultraviolet completion, black-hole information, singularity resolution, observational discriminants, quantum measurement interpretation, dark-matter microphysics and dark-energy mechanism. A network should keep these as explicit open questions with prerequisite paths and conflicting evidence where appropriate. It should not turn a highly connected node into a solved problem.


\newpage

# Frequency and waves: oscillation, spectra, geometry and quantum control

## Frequency is a property of a defined observable

Frequency describes how a phase or repetitive observable changes with time. It is not an independent universal substance. A physical statement needs the observable, its units, an amplitude, a coupling mechanism, a measurement procedure and a dynamical model. Cycles per second and radians per second differ by 2π. An energy, a graph eigenvalue or a visual pattern cannot acquire units of hertz merely by being labelled a frequency. [pf-frequency](FORMULA_NOTEBOOK.md#pf-frequency), [Feynman, The Harmonic Oscillator](https://www.feynmanlectures.caltech.edu/I_21.html).

This chapter follows a progression from one degree of freedom to many, from time records to spectral estimates, from spatial PDEs to boundary modes, and finally to quantum devices and open-system frontiers. The formula catalogue gives the assumptions and units for every step.

## 1. Why harmonic motion appears so widely

Near a stable smooth equilibrium, the first nonzero potential term is often quadratic. Its derivative is a linear restoring force. Mass provides inertia, so the equation becomes mẍ+kx=0 and the natural angular frequency is √(k/m). This is a local approximation, not an assertion that every system is globally sinusoidal. Higher-order terms can shift frequency with amplitude, couple harmonics or create bifurcations. [pf-oscillator](FORMULA_NOTEBOOK.md#pf-oscillator).

**Worked energy cycle.** For m=1 kg, k=100 N/m and amplitude 0.02 m, the total oscillator energy is 0.02 J. At an extreme, velocity is zero and the energy is elastic. At equilibrium, displacement is zero and the speed is 0.2 m/s, giving the same kinetic energy. The oscillation frequency is approximately 1.59 Hz. Increasing amplitude by two increases energy by four while leaving this linear-model frequency unchanged. The frequency-energy relation therefore cannot be interpreted without saying whether the system is a classical mode or a single quantum transition.

Damping introduces a decay timescale. In the viscous model, amplitude decays as exp(−γt), while cycle-averaged energy decays approximately twice as fast in the weakly damped regime. Critical and overdamped motion have different solution forms. A quality factor Q quantifies storage relative to loss under a stated convention; it does not specify stored energy without amplitude or input. [pf-damped](FORMULA_NOTEBOOK.md#pf-damped), [Feynman, Resonance](https://www.feynmanlectures.caltech.edu/I_23.html).

## 2. Resonance is a driven response with an energy budget

A sinusoidal ansatz transforms the driven oscillator equation into an algebraic complex response. The real and imaginary terms encode stiffness/inertia mismatch and dissipative lag. The measured variable matters: displacement, velocity and dissipated-power peaks can occur at different frequencies. At zero damping and exact resonance, the finite steady-response formula breaks down; the transient amplitude grows instead. [pf-forced](FORMULA_NOTEBOOK.md#pf-forced).

Multiply the motion equation by velocity to obtain dE/dt=Fv−bv². The average energy change over a steady cycle is zero, so input power balances dissipation plus any extracted load power. A high amplitude in a low-loss resonator is compatible with small power input because energy circulates between storage forms. Connecting a load changes both the budget and the response. [pf-resonant-power](FORMULA_NOTEBOOK.md#pf-resonant-power), [electromagnetic conservation counterpart](https://www.feynmanlectures.caltech.edu/II_27.html).

**A useful experimental question set.** What is driving the system? What is stored? What is dissipated? What crosses the measurement boundary? How long was the transient? Was voltage, pressure or displacement mistaken for power? These questions should precede a claim of unusual amplification. A local amplitude enhancement can reflect focusing, impedance transformation or standing-wave interference, while total energy remains conserved. No healing, consciousness or free-energy conclusion follows from the resonance equations alone.

## 3. Many oscillators introduce linear algebra

For coupled conservative coordinates, write **M**ẍ+**K**x=0. A normal-mode ansatz gives **K**φ=ω²**M**φ. Positive mass and nonnegative stiffness ensure real nonnegative squared frequencies. Different mode shapes are orthogonal in the mass-weighted inner product, not necessarily under an arbitrary Euclidean normalization. A zero mode can express a symmetry, such as translation of an unconstrained system. [pf-normal-modes](FORMULA_NOTEBOOK.md#pf-normal-modes), [Feynman, Modes](https://www.feynmanlectures.caltech.edu/I_49.html).

Two equal masses joined by one spring already illustrate the essential distinction. Their common displacement mode has no restoring force; their difference mode stretches the spring and oscillates at √(2k/m). Add boundary springs and the spectrum changes. Geometry, coupling and constraints all enter the eigenproblem. A frequency list without the matrices and boundary conditions is therefore not a full mode specification.

This also explains degeneracy. A square membrane can have distinct mode shapes sharing one frequency because of symmetry. Arbitrary linear combinations within that eigenspace are also modes in the ideal model. Small asymmetry can split the degeneracy. A photograph of one driven pattern does not uniquely reconstruct the underlying mode basis.

## 4. Fourier and Laplace transforms solve different questions

Fourier series expand periodic signals in orthogonal harmonics. Fourier transforms extend the idea to a continuum of frequencies with a declared normalization. Parseval's identity preserves the squared norm between time and spectral representations. An infinite sinusoid is represented by delta distributions, not a finite-energy spectral bump. Finite measurement duration supplies a different object: a windowed record. [pf-fourier-series](FORMULA_NOTEBOOK.md#pf-fourier-series), [pf-fourier](FORMULA_NOTEBOOK.md#pf-fourier), [Feynman, Harmonics](https://www.feynmanlectures.caltech.edu/I_50.html).

The Laplace transform adds a complex growth/decay parameter and retains initial-condition terms. Its poles organize transients and stability of a linear time-invariant system. A transfer function alone describes the zero-initial-state response; a system with stored initial energy has an additional response. The frequency response on an imaginary-axis slice must respect the region of convergence. [pf-laplace](FORMULA_NOTEBOOK.md#pf-laplace), [Feynman, Linear Systems](https://www.feynmanlectures.caltech.edu/I_25.html).

Convolution represents a linear time-invariant system as a sum of shifted impulse responses. It is a mathematical memory kernel: output depends on past input through a prescribed weighting. A document cache is a different kind of memory unless a specific kernel model is being implemented. For an exponential kernel, the same equation describes an ordinary low-pass filter or a designed smoothing rule. Similar algebra does not establish common empirical mechanism. [pf-convolution](FORMULA_NOTEBOOK.md#pf-convolution).

## 5. Digital spectra require an observation model

Uniform sampling identifies frequencies that differ by an integer multiple of the sample rate. A 700 Hz cosine sampled at 1000 samples per second is indistinguishable from a suitable 300 Hz cosine. No digital filter can recover which one existed before sampling without additional information. Analog anti-alias filtering and a bandwidth assumption are therefore part of the measurement. [pf-sampling](FORMULA_NOTEBOOK.md#pf-sampling), [Shannon's original communication paper](https://ieeexplore.ieee.org/abstract/document/1697831/authors).

The discrete Fourier transform maps N samples to N coefficients. Its spacing fₛ/N follows from record duration. Zero-padding provides denser interpolation of the same finite-record spectrum; it does not create new observation time. Windowing trades sidelobe leakage against effective main-lobe width. A single periodogram is noisy, and averaging changes variance and resolution. [pf-dft](FORMULA_NOTEBOOK.md#pf-dft), [pf-periodogram](FORMULA_NOTEBOOK.md#pf-periodogram).

**Worked normalization check.** With an unscaled DFT, a perfectly bin-centered real cosine of amplitude A has two coefficients of magnitude NA/2. Dividing each magnitude by N yields A/2 in the two-sided amplitude spectrum. A one-sided convention combines the symmetric pair to report A, except at DC and a possible Nyquist bin. Squared amplitudes must be converted using the appropriate power-density normalization; they cannot simply inherit every amplitude convention. The formula catalogue states one coherent two-sided PSD definition.

Spectral uncertainty is not one number. Finite record length, window shape, sample-clock error, noise statistics, missing samples and model mismatch all contribute. A narrow-looking plot is not sufficient evidence of a stable oscillator or two resolvable tones. For clock work, Allan deviation compares adjacent averaged fractional frequencies across an averaging timescale. It cancels constant bias, so a biased clock can have excellent stability. [pf-allan](FORMULA_NOTEBOOK.md#pf-allan), [NIST Handbook of Frequency Stability Analysis](https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication1065.pdf).

## 6. Waves couple space to time

The simplest wave equation balances inertia against a spatial restoring operator. A plane-wave substitution defines a dispersion relation ω(k). Phase velocity ω/k describes moving phase fronts; group velocity dω/dk describes a narrow envelope under suitable conditions. In strongly dispersive or absorptive systems, that envelope can reshape, so a group-velocity number is not automatically signal or energy speed. [pf-wave](FORMULA_NOTEBOOK.md#pf-wave), [pf-dispersion](FORMULA_NOTEBOOK.md#pf-dispersion), [Feynman, Beats](https://www.feynmanlectures.caltech.edu/I_48.html).

Two nearby sinusoidal frequencies factor into a carrier and a signed envelope. Two tones at 440 and 442 Hz produce two amplitude maxima per second. The signed envelope cosine has half the difference frequency but flips carrier phase, making its absolute amplitude repeat at the full difference. This resolves a common factor-of-two ambiguity. In a strictly linear spectral decomposition, the low beat rate is a property of the envelope, not a newly generated low-frequency carrier with independent energy.

At one fixed temporal frequency the wave equation becomes a Helmholtz boundary problem. Fixed strings, membranes and cavities select spatial eigenfunctions. A rectangular membrane adds squared wavenumbers in two directions, producing frequencies that generally are not integer multiples of one fundamental. A bending plate involves a fourth-order spatial operator, so its spectrum cannot be obtained by reusing a membrane formula without justification. [pf-membrane](FORMULA_NOTEBOOK.md#pf-membrane), [Feynman, Modes](https://www.feynmanlectures.caltech.edu/I_49.html).

In acoustics, plane-wave pressure and particle velocity are related by specific impedance ρc. Interface continuity yields reflection and transmission. A transmitted pressure amplitude can exceed the incident amplitude while transmitted power remains below incident power because the impedances differ. This is a practical example of why amplitude and energy must not be conflated. [pf-acoustic](FORMULA_NOTEBOOK.md#pf-acoustic), [Feynman, Sound and the Wave Equation](https://www.feynmanlectures.caltech.edu/I_47.html).

## 7. Quantum frequency and current devices

Quantizing a harmonic mode yields discrete energies ℏω(n+½). The energy spacing is hf, but the total energy depends on occupation. For thermal equilibrium the mean occupation is Bose distributed; a low-frequency mode can have many thermal quanta even at temperatures that sound cold in everyday language. Coherent control requires adequate preparation, coupling, isolation and measurement. [pf-quantum-oscillator](FORMULA_NOTEBOOK.md#pf-quantum-oscillator).

The [2025 acoustic-phonon phase-gate preprint](https://arxiv.org/html/2503.03898v1) demonstrates phase control and number-resolving detection in a circuit-coupled acoustic setting. Its reported 98.1% noise-floor-limited interference visibility is not automatically a logical gate fidelity; measurement correction and conditioning matter. The result connects mode dynamics to quantum information while leaving scalability and complete error budgets as distinct questions.

The [2026 thorium-229 nuclear clock paper](https://www.nature.com/articles/s41586-026-11084-4) reports feedback-loop operation on a nuclear optical transition. The source was inspected through indexed publisher abstract/method excerpts. The achievement concerns a controlled frequency reference; it does not, by its title alone, establish the best accuracy, stability or reproducibility across all clock technologies. Those metrics need separate numerical evidence and uncertainty budgets.

## 8. Metamaterials, topology and exceptional points

Engineered periodic or subwavelength structures modify effective wave response. Band gaps, interface states, loss and symmetry can be designed, but effective models have bandwidth and homogenization limits. The [September 2026 acoustic Jackiw–Rebbi-interface paper](https://www.nature.com/articles/s41467-026-77579-w) supplies a specific experimental/model example. The [October 2026 absorbing-exceptional-point paper](https://www.nature.com/articles/s41467-026-78506-9) studies coherent absorption under controlled illumination. Directional intensity or absorption is not energy creation.

An elementary non-Hermitian 2×2 model makes an exceptional point concrete. At a nonzero parameter combination, two eigenvalues and their eigenvectors coalesce. A zero matrix with two equal eigenvalues does not qualify because it still has a complete eigenbasis. Spectral sensitivity near a degeneracy does not automatically improve measurement signal-to-noise after noise, loss and coupling are accounted for. [pf-exceptional](FORMULA_NOTEBOOK.md#pf-exceptional).

## 9. The exact graph bridge

For a symmetric nonnegative weighted graph, **L**=**D**−**W** satisfies

$$\mathbf x^T\mathbf L\mathbf x=\frac12\sum_{ij}w_{ij}(x_i-x_j)^2\ge0.$$

This is an exact algebraic identity. Its eigenvectors describe smooth and rapidly varying node signals relative to the chosen edges. If the time law is diffusion, each nonconstant component decays. If the time law is an inertial spring model, it oscillates. The operator alone does not choose between those dynamics and has no intrinsic SI frequency. [pf-graph-energy](FORMULA_NOTEBOOK.md#pf-graph-energy).

Graph wavelets apply spectral kernels to localized node indicators. Their scale parameter is a graph spectral scale, not a biological rhythm. Polynomial approximations make sparse filtering possible without full diagonalization. [pf-graph-wavelet](FORMULA_NOTEBOOK.md#pf-graph-wavelet), [Hammond, Vandergheynst and Gribonval](https://arxiv.org/abs/0912.3848).

For a knowledge system, this can help find neighborhoods, multiscale context or smooth signals over a deliberately constructed affinity graph. Semantic edges such as “contradicts,” “supersedes” and “is an analogy for” cannot all be treated as attractive physical couplings. The memory implementation must preserve those meanings, even if a force-directed visualization places their nodes close together.


\newpage

# Which physics structures transfer to graph memory—and what does not follow

## Three distinct kinds of connection

The atlas separates an exact mathematical identity, a shared computational method and a speculative physical analogy. The first can be proved from stated definitions. The second can be engineered and evaluated for a new application. The third remains a hypothesis until an empirical mechanism and measurements support it. Graph proximity, repeated terminology or a visually similar diagram cannot replace those distinctions.

| Structure | Exact content | Useful memory-system consequence | What it does not establish |
|---|---|---|---|
| Poisson operator and graph Laplacian | Both can arise from quadratic penalties on differences under suitable discretization | Use sparse operators, boundary constraints and residual checks | A knowledge graph has electric charge |
| Normal modes and graph spectra | A symmetric operator has an orthogonal eigenbasis | Explore smooth versus localized graph signals | An eigenvalue is a biological oscillation frequency |
| Green function and impulse response | Linear response is an inverse-operator or convolution problem with specified conditions | Cache reusable responses when inputs and operator versions match | Arbitrary retrieval is linear and time invariant |
| Multipole compression | Well-separated interactions permit controlled summaries | Build hierarchical summaries with explicit error and invalidation rules | Every semantic summary has a multipole error bound |
| Spin interactions and attracting states | A designed energy and update law can select stable configurations | Test associative retrieval under noise and distractors | A notes graph reproduces a human brain |
| Gauge transport and loops | A closed transport trace can be invariant under local representation changes | Distinguish representation from invariant content | Any dependency cycle is a Wilson or Berry loop |
| Thermodynamic or resonant energy budget | Storage, input, output and dissipation must balance in the model | Measure retrieval cost, latency and refresh work explicitly | Computational efficiency creates physical energy |

The mathematical foundations are documented in [graph wavelets](https://arxiv.org/abs/0912.3848), [fast multipole methods](https://www.sciencedirect.com/science/article/pii/0021999187901409), [linear systems](https://www.feynmanlectures.caltech.edu/I_25.html), [normal modes](https://www.feynmanlectures.caltech.edu/I_49.html) and [gauge transport](https://www.tpi.uni-jena.de/~floerchinger/qft2/lecture15/). The software consequences in this table are design recommendations derived from those structures, not claims that those sources studied this repository.

## A worked example: one operator, three meanings

Take a path of three nodes with equal nonnegative edge weights:

$$
L=\begin{pmatrix}1&-1&0\\-1&2&-1\\0&-1&1\end{pmatrix}.
$$

Its eigenvalues are 0, 1 and 3. The zero mode is constant. The other two represent increasing variation across adjacent nodes. For a node vector x=(1,0,−1), Lx=x and xᵀLx=2. Directly summing the squared edge differences gives (1−0)²+(0+1)²=2, confirming the Dirichlet-energy identity. [pf-graph-energy](FORMULA_NOTEBOOK.md#pf-graph-energy).

Now choose a time law. In diffusion, dx/dt=−αLx, that vector decays as exp(−αt). In a spring system with equal masses m, d²x/dt²=−(k/m)Lx, it oscillates at √(k/m). In a graph regularizer, minimize ‖x−y‖²+λxᵀLx; then x=(I+λL)⁻¹y and there is no physical time at all. The same eigenvalue enters three different equations, with three different interpretations and units. Calling all three “frequency memory” would hide the crucial model choice.

For knowledge retrieval, edge meaning must be chosen before filtering. A nonnegative similarity edge is compatible with a smoothing penalty. A contradiction edge is not: averaging opposing propositions can erase the disagreement. A prerequisite edge has direction and should not be silently symmetrized into similarity. An analogy edge can guide exploration but must not supply evidence that a physical claim is true. The implementation should let the reader inspect the relation type and originating sources.

## Caching: operator reuse is conditional

A linear solve b↦A⁻¹b admits reusable factorizations when A is unchanged. Change geometry, boundary conditions, material coefficients or discretization and the operator can change. Charge equilibration shows a second dependency: even if one local descriptor changes, a global conservation constraint can alter the entire solved state. [pf-qeq](FORMULA_NOTEBOOK.md#pf-qeq), [Rappé and Goddard](https://pubs.acs.org/doi/10.1021/j100161a070).

The analogous software rule is precise: a cached answer should depend on the content/version of its evidence, query normalization, scope, retrieval parameters and model or schema version. A time-to-live alone is not enough when a dependency is edited before expiry. An answer citing a withdrawn paper or an obsolete repository state should be invalidated by that change. A cached summary should not survive merely because its title remained unchanged.

Hierarchical compression adds another issue. A multipole summary is designed to preserve a controlled set of moments, with a truncation error in a geometric regime. A language summary does not automatically enjoy that theorem. It can still be useful if it retains claim IDs, assumptions, source links, uncertainty and a route back to the underlying material. The design should treat summary expansion as retrieval of evidence, not amplification of unsupported confidence. [Multipole-method provenance](https://www.sciencedirect.com/science/article/pii/0021999187901409).

## Looping: distinguish termination, recurrence and independent evidence

A graph traversal needs a visited set or another termination rule. A dependency cycle can require a fixed-point method, a strongly connected component treatment, or a schema correction. A recurrent dynamical system can instead intentionally revisit states; convergence then needs a separate stability argument. These are different uses of a loop.

In research, a more subtle loop occurs when article A cites B, B summarizes C and C ultimately cites A. Three URLs do not equal three independent measurements. Evidence provenance should preserve this dependency. Likewise, several agent passes do not become independent experimental replications simply because their wording differs. A round can add a source, identify an error, challenge a derivation or reproduce a calculation; its value should be recorded as that concrete action.

## A productive implementation contract

The physics module supplies concepts, formulas, typed edges, sources, source-access depth and epistemic status. The wider memory engine can index those records, expose provenance, avoid propagating support along analogy links, and retain an expansion queue for incompletely researched branches. Repository and company memories should add their own scope and ownership metadata rather than reinterpret all entities as interchangeable physics nodes.

An effective review question is: **What changes in the output when an assumption is removed?** Remove positive graph weights and the quadratic energy need not be nonnegative. Remove an affine parameter and the geodesic equation gains a term. Remove a band limit and sampling no longer guarantees reconstruction. Remove source freshness and a recent-paper claim can become stale. Making these dependencies explicit is the strongest transferable lesson from the physics atlas.
