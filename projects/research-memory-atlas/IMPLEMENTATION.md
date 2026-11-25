# Donna Brain: implementation and mathematical contract

## 1. One operating memory, two evidence domains

The private operating graph is a deterministic projection of the current authorized native workspace. Its nodes are companies, repository connections, offices, departments, employees, assigned skills, knowledge records, goals, jobs and roadmap items. The graph keeps the original record identity. It does not create a competing user database or copy private data into the static website.

The public research graph stores concepts, formulas, selected claims and catalogue metadata. Native and hosted Donna retrieve public evidence separately from company evidence. A public source can inform a company task, while the company's facts stay in the native state and its permitted server projection.

`desktop-shell/src/shared/donnaBrain.ts` defines the company projection, typed-note format, evidence packet and setup draft. `graphMemory.ts` is the shared retrieval engine. Native `officeWorker.ts` adds both packets to its source review and model context. Hosted `atlas-api.ts` obtains eligible company IDs from the existing `scopedContext` function before retrieval. No graph edge widens a grant.

## 2. Memory types and corrections

Semantic memory is represented by facts and sourced research. Episodic memory consists of saved decisions, job outcomes, goals and checkpoints already recorded by the application. Procedural references are assigned skill paths and written procedures. Open questions stay explicit instead of being silently converted to facts. These are software categories inspired by useful distinctions in memory research, not a claim to reproduce biological memory.

A saved brain note is a versioned JSON value inside a native knowledge record:

```json
{"kind":"daftar-brain-note","version":1,"type":"decision","body":"Use the measured boundary condition in the next experiment.","tags":["electrostatics"],"supersedes":null,"expiresAt":null}
```

A correction has a `supersedes` reference to an earlier record in the same company. The earlier node's validity ends at the later record's creation timestamp. Both remain in history; current retrieval filters the earlier node before computing term statistics. Cross-company references, unknown targets, self references and nonlater corrections cannot retire a record. Native records remain the durable source; there is no silent overwrite of old evidence.

Only note corrections and explicit expiry provide historical validity here. The current snapshot's organization and job status are not a full historical event replay. A projection fingerprint is a deterministic display identity, not a cryptographic certificate. The separate persistent snapshot adapter uses SHA-256.

## 3. Retrieval mathematics

Tokenization normalizes Unicode and removes a small fixed stop-word set. The lexical stage uses BM25 with k1=1.2 and b=0.75. Statistics are calculated over eligible nodes only. A private or expired node therefore cannot perturb a public ranking through document frequency.

For a row-stochastic graph transition matrix P, restart vector r and continuation factor alpha, personalized PageRank solves

$$p=(1-\alpha)r+\alpha P^\top p.$$

The default alpha is 0.85. Dangling nodes restart at r. Iteration is bounded by 160 updates. The fixed-point contraction explains convergence for alpha below one, but does not turn rank into truth. At most eight lexical seeds are used by default. Reverse traversal receives half the forward weight; stored relation direction and meaning remain intact. Analogy and contradiction edges are not default propagation routes.

Lexical and graph rankings are combined using reciprocal rank fusion with denominator offset 60 and weights 1 and 0.7. These are explicit baseline choices, not tuned claims of optimality. If there is no lexical seed, the engine returns no match rather than inventing a semantic answer. Embedding search, learned relation extraction, probabilistic confidence and MMR reranking are studied in the notebook but are not claimed as runtime features.

The public worker packet is capped at three results and 4,096 bytes. The company packet has at most four results and a complete 6,200-byte limit including setup gaps. Hosted portfolio chat searches at most three server-selected companies and has a 14,000-byte combined company context limit; its omitted-company count is explicit. Public and company evidence have separate provenance labels.

## 4. Cache identity and invalidation

The local store key binds algorithm revision, immutable snapshot hashes, policy version, requested scopes, query/bounds and the set of temporally eligible nodes/edges. Source-only changes invalidate reuse even if a user-provided graph revision string was not changed. The process cache separately hashes the public graph bytes on each load.

For a simple hit/miss latency model,

$$E[T]=hT_{hit}+(1-h)T_{miss}.$$

This expectation is useful only when the measured hit/miss costs and workload match the model. A local cache hit is not provider prompt-cache usage. No provider cache savings are inferred from local results. The persistent cache is bounded to 128 entries and evicts by last write; it is FIFO, not LRU. The process cache is also bounded. Hosted retrieval does not claim a persistent cache.

Cached packets have a payload digest and are checked against the current eligible graph. A corrupted disposable cache is recomputed. A corrupted immutable snapshot is rejected. Writer locks fail busy; they are not stolen. Repeated identical ingestion is idempotent. Atomic rename provides a coherent visible pointer but is not a power-loss ACID guarantee. This local adapter is not a multi-host database.

Request timestamps and cache-hit telemetry stay outside model context identities. Evidence revisions and selected records remain inside. This avoids false misses caused solely by a changing clock while preserving freshness at actual validity boundaries.

## 5. Loops, plans and setup

A graph may contain association cycles. Breadth-first exploration keeps a visited set and explicit depth/node limits. The prerequisite planner uses Kahn's algorithm; a blocked remainder includes both cycle members and their descendants. It does not claim every blocked vertex is part of a cycle.

Donna's setup draft is generated from observed company gaps. It asks for repository provenance, reuse of saved people, skill assignment, evidence capture, owners, dependencies, bounded budgets and acceptance checks. It uses the existing `create_goal` command in manual plan mode, with one iteration, zero provider dollars and no tool grants. The UI saves and plans through native commands; completing setup still requires recorded work under the normal runtime.

Repeated reasoning is warranted when a new source, accepted artifact, corrected assumption or materially changed strategy changes the state. A longer conversation is not progress by itself. The shared skill protocol retains no-progress limits, cancellation, durable handoffs and explicit budgets. The research team used finite production, corrective and independent-review rounds; there is no hidden perpetual agent loop.

## 6. Scope and admission

The company projection filters each record collection to the requested company before indexing. Parent relationships and shared-worker home companies never import their private records. Internal company-kit identity metadata is excluded. Selected, granted knowledge transfers retain the existing explicit handoff path and are revalidated by native job admission; a Brain search does not automatically select every grant.

The hosted route uses the existing authenticated snapshot and scope selection. The renderer receives its normal authorized projection. UI masking is not the authorization mechanism. Editing a note or saving a setup goal uses the same native capability checks as existing knowledge and work operations.

The projection is bounded: 200 offices, 500 departments, 1,000 employees, 5,000 knowledge records, 500 goals, 500 jobs and 500 company roadmap entries, with a total node cap. Omitted records are reported. Assigned skill references are bounded per employee. It does not scan arbitrary disks, credentials or unrelated repositories.

## 7. Verification and known limitations

Meaningful checks cover scope isolation before statistics, old-record recall, correction timestamps, expiry, source/policy invalidation, corrupted caches, duplicate IDs, cycles, UTF-8 budgets, stable context and manual setup commands. Independent review found four concrete cache/schema bugs; regressions now preserve those cases. UI smoke tests cover desktop and mobile interaction, filtering, note saving, setup drafts and reduced-motion behavior where the runtime exposes them.

The local environment cannot start Chromium because its socket operations are restricted. Local structural/DOM and code tests are separate from GitHub CI browser results. The delivery receipt records actual final-head gates. The atlas's paper examples and synthetic retrieval checks do not establish production retrieval superiority, long-term user productivity, neurobiological equivalence or a replay of current formal proof archives.

## 8. Sources and deeper derivation

The memory chapter and formula notebook explain BM25, graph Laplacians, personalized PageRank, rank fusion, entropy, cache cost, validity intervals and loop bounds with individual source records. Primary starting points include [PageRank](https://ilpubs.stanford.edu/422/), [reciprocal rank fusion](https://cormack.uwaterloo.ca/cormack/cormacksigir09-rrf.pdf), [HippoRAG 2](https://arxiv.org/html/2502.14802v2), [Zep](https://arxiv.org/html/2501.13956v1) and [LongMemEval](https://arxiv.org/abs/2410.10813). Their reported evaluations are not measurements of this implementation.
