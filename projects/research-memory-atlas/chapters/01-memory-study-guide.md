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
