# Fixed public-atlas retrieval and local-cache evaluation

**Result:** graph propagation did not improve Success@6 on this small authored sanity set. Both configurations retrieved an acceptable record for **11 of 12 answerable questions**. The default configuration's mean reciprocal rank was lower. Both configurations failed the same relational-prerequisite question and the same absent-answer control. The local result cache had a lower measured median on one repeated query, under the limited conditions below.

This evaluation was executed on 25 November 2026 against the actual canonical `runtime/graph-core.mjs` and `runtime/store.mjs`. It is a bounded implementation sanity check, not a held-out benchmark, SOTA comparison, or general claim about graph retrieval.

## Reproduce

From the repository root:

```sh
node projects/research-memory-atlas/evaluation/runner.mjs
```

The runner reads the current `atlas.json` and the fixed [questions.json](questions.json), validates all acceptable IDs, invokes the existing runtime, writes [results.json](results.json), and removes its temporary local store. It never modifies the atlas, acceptable IDs, graph edges, retrieval core or cache adapter. Rerunning changes timing samples and the run timestamp; compare the recorded hashes before comparing outputs.

The question file was created after inspecting the atlas's node labels, summaries and prerequisite edges, and **before either retrieval configuration was run**. No questions, labels or parameters were tuned after seeing the results. This is still author-selected evaluation data drawn from the corpus, with no blinded judge or independent test population.

## Fixed data and procedure

| Item | Recorded value |
|---|---|
| Atlas revision | `3b8237b5e3a033dc9bfa148507ec2d6203c7806228b524afada3a2c47299df1b` |
| Atlas file SHA-256 | `265029374ee837a7766e61a58b4bc98967f41f48c3f44b8f74d7ca3cdd8effb5` |
| Question-file SHA-256 | `0941667ee4f6c80165fb8adbc54e3df661c14329f93e34053885a2067b42711c` |
| Corpus | 1,649 nodes and 1,518 edges, including published catalogue metadata |
| Allowed scope | `public`, under `fixed-public-evaluation-v1` |
| Evidence time | `2026-11-25T00:00:00.000Z` |
| Bounds, both configurations | 6 results, 12,288 bytes, 8 lexical seeds |
| Compared settings | `alpha=0` and the default `alpha=0.85` |
| Software | Node `v24.22.3`; V8 `13.6.233.17-node.63`; Linux x64 |
| Reported CPU | AMD EPYC 9V74 80-Core Processor |
| Retrieval algorithm | `daftar-graph-memory-2` |

The runner calls the core directly on the full atlas. It does not apply browser UI domain filters or the UI's catalogue visibility filter. Consequently, catalogue titles can compete with concept and formula nodes. Results describe this exact full-corpus invocation, not every UI view.

Operationally, “lexical-only” means `alpha=0` in the unchanged production implementation. Graph mass then remains at the lexical seeds, while the existing reciprocal-rank-fusion calculation still executes. It is not a separately implemented pure BM25 scorer. The default uses `alpha=0.85` with the same limits and the core's existing relation allowlist. No retrieval changes were made to favor either configuration.

An answerable question succeeds when at least one predeclared acceptable ID appears among its returned records. MRR is the mean reciprocal rank of the first acceptable ID over the 12 answerable questions. The acceptable lists are deliberately bounded, not exhaustive relevance judgments, so this report does not label every unlisted record irrelevant or report an unsupported precision/recall estimate.

## Retrieval results

| Measure | Alpha 0 | Default alpha 0.85 |
|---|---:|---:|
| Answerable Success@6 | 11/12 (91.67%) | 11/12 (91.67%) |
| Answerable mean reciprocal rank | 0.854167 | 0.819444 |
| Absent-answer controls returning no records | 1/2 | 1/2 |
| Additional empty-query check | `no-match`, 0 records | `no-match`, 0 records |

| Question | Coverage | First acceptable rank, alpha 0 | First acceptable rank, default |
|---|---|---:|---:|
| q01 | Result-cache dependency key | 1 | 1 |
| q02 | TTL versus source changes/revocation | 1 | 1 |
| q03 | Attention KV cache versus evidence graph | 1 | 1 |
| q04 | Research-loop stopping and improvement | 1 | 1 |
| q05 | The concept preceding Fourier transforms | Absent | Absent |
| q06 | PageRank's walk/fixed-point prerequisites | 4 | 3 |
| q07 | PageRank recurrence/convergence formula | 1 | 2 |
| q08 | Bayes with dependent evidence | 1 | 1 |
| q09 | Allan variance and constant frequency bias | 1 | 1 |
| q10 | Laplacian pseudoinverse/electrical resistance | 1 | 1 |
| q11 | Graph modes versus physical frequencies | 1 | 1 |
| q12 | Spin models and associative memory | 1 | 1 |
| q13 | Invented company's private payroll approval | Failed abstention | Failed abstention |
| q14 | Out-of-vocabulary control | Correct empty result | Correct empty result |

### Failures and interpretation

**q05:** the predeclared answer is `m-complex`, selected from the actual edge `m-complex prerequisite_of m-fourier`. Neither configuration returned it within six results. Both retrieved Fourier-related or generic graph material; the default also elevated catalogue-family records. Graph proximity alone did not answer this directional prerequisite question. The result supports a concrete limitation: unrestricted ranking is not equivalent to evaluating a typed prerequisite relation. No core repair or favorable rerun was performed in this task.

**q13:** the invented company Aster Quay has no approval record in the public corpus. Both settings returned six topically overlapping public records rather than an empty result. This fails the conservative abstention rule. Those records did not reveal private payroll data, and the retriever did not generate a fabricated payroll answer; it produced non-answering search results. A downstream assistant must distinguish retrieved overlap from evidence that answers the question.

**Rank movement:** default propagation moved a valid PageRank prerequisite from rank four to three, but moved the requested PageRank formula behind a broader concept, from rank one to two. Success@6 stayed equal and aggregate MRR declined. The fixed sample supplies no evidence of a general retrieval-quality improvement.

The gibberish control and whitespace-only query correctly yielded zero records for both settings. That demonstrates lexical no-match behavior, not general semantic abstention.

## Five uncached versus five warm local-result queries

The timing query is fixed q01, using `alpha=0.85` and the same scope, evidence time and limits as the ranking comparison. The runner ingested one immutable snapshot into a temporary `MemoryStore`, performed five queries with `ttlMs=0`, populated the result cache once outside the timed samples, then performed five queries with `ttlMs=3600000`. All uncached samples reported `cache.hit=false`; all warm samples reported `cache.hit=true`. All ten returned the same ordered node IDs.

| Run | No result cache, milliseconds | Warm local-result cache, milliseconds |
|---|---:|---:|
| 1 | 138.013568 | 51.442452 |
| 2 | 89.876902 | 86.575662 |
| 3 | 150.119169 | 61.132060 |
| 4 | 173.792301 | 34.490520 |
| 5 | 89.646846 | 61.725916 |
| **Median** | **138.013568** | **61.132060** |

The measured median ratio is **2.25763** for uncached/warm elapsed time in this run. This is an observed result for one query and ten local measurements, not a service performance guarantee.

“Cold” here means **no result-cache reuse**, not a cleared filesystem cache, fresh Node process, or reset JIT. Every store query still reloads the snapshot, checks its integrity, filters eligibility and validates the cached packet where applicable. The five uncached measurements precede the five warm ones, so order, JIT state, garbage collection, scheduling and filesystem caching can affect the comparison. Five samples are insufficient for a robust performance distribution.

The snapshot has canonical SHA-256 `24f15d4a9152021459a1609de9b8ad0a06fea1cd7a8b39b73dfb4d834bbf4e48`. The store's combined-scope revision is `630c8d297f95a7fd5b0e489bb0250e64c4f3cf7e02887b4f7ec6d852e9654c15`; this is intentionally distinct from the atlas's own revision and raw-file hash. The complete raw timings, result IDs, cache-hit flags, byte counts, algorithm/core/store hashes and runtime details are retained in `results.json`.

**No provider request occurred.** These numbers establish no provider-token savings, billable-money savings, model-prefix-cache savings, inference-KV-cache savings, or native Donna end-to-end latency. This task measures the canonical local result-cache adapter and its public graph only.

## Remaining limits

The set is small, authored with knowledge of the corpus, and covers only selected retrieval tasks. It does not test unseen user distributions, broad relevance judgments, generated-answer factuality, multi-company authorization, update races, expiry handling or long-term storage durability. Those need separate evidence. The exact successes and failures are retained so the evaluation can inform later work without being promoted into a benchmark claim.
