# Donna Brain · Research and operating memory

Donna Brain is Daftar's internal memory system. It connects the selected company's repositories, people, skills, knowledge, goals, job results and roadmap to a separate, source-linked public research atlas. It has no dependency on an external notes application.

## What is implemented

- A built-in Brain surface for the selected company, with a bounded graph and a searchable list, provenance inspection, typed notes, correction history and a saved setup draft.
- Automatic company-memory retrieval in native worker prompts and hosted Donna chat. Relevant older knowledge can be recalled beyond the former recent-record window. The existing native authority and server scope selection remain the admission boundaries.
- Facts, decisions, questions and procedures are saved through native `add_knowledge`. A correction links to the earlier record and retires it from current retrieval at the correction timestamp. The earlier evidence remains inspectable.
- A concrete setup goal that names observed gaps, existing identities, owners/dependencies to resolve, evidence and acceptance conditions. Saving this manual, zero-provider-dollar goal does not report that the setup work has executed.
- Typed graph retrieval with authorization and temporal filtering before statistics, BM25 lexical seeds, personalized PageRank, rank fusion, bounded context packets and explanations.
- Content-addressed public research snapshots and a persistent local result cache; source, policy, scope, time-eligibility and query changes invalidate reuse. Native worker public retrieval also has a bounded process cache.
- An offline public research explorer, native MathML equations, field-specific GraphML, JSON snapshots, source CSVs and portable linked Markdown notes.

## Research deliverables

| Deliverable | Contents |
|---|---|
| `STUDY_GUIDE.md` | Connected chapters on memory, mathematics, electrostatics, magnetism, gravity, frequency and cross-field reasoning |
| `FORMULA_NOTEBOOK.md` | 177 cards with equations, symbols, units, assumptions, derivation summaries, worked checks and limits |
| `AI_MATHEMATICS.md` | 24 selected recent AI-result assessments with exact theorem and verification qualifications |
| `atlas.json` | 367 concept nodes plus formula and catalogue nodes, typed relations and provenance |
| `data/mathematics/openai-math-catalogue.json` | All 730 manuscript metadata entries in 375 publisher families at the pinned source commit; not 730 independently verified proofs |
| `reviews/` | Coverage boundaries, executed checks and independent review findings |
| `IMPLEMENTATION.md` | The operating-memory contract, caching mathematics, runtime boundaries and commands |
| `exports/` | Portable graphs, source registers and linked-note backup |

The evidence snapshot is **25 November 2026**. Frontier coverage is selected and dated. This is a deep, extensible study map, not a claim to enumerate every mathematical or physical subfield or independently reproduce every current paper. The per-field coverage reports identify omitted branches and specific next work.

## Use the brain

Open **Brain** in Daftar's workspace surfaces, choose a company, search its memory and inspect a record. Save a fact, decision, question or procedure; use a correction to supersede earlier evidence. **Prepare setup plan** saves an actionable goal through the existing command path. Donna's native worker automatically receives bounded company-memory and public-research packets when processing an admitted job.

The public research explorer is at [`../../site-source/public/research-memory/index.html`](../../site-source/public/research-memory/index.html); published navigation includes it. Private company records never enter that static research bundle.

```sh
node scripts/graph-memory.mjs validate
node scripts/graph-memory.mjs index --store .work/brain-cache
node scripts/graph-memory.mjs query --store .work/brain-cache --query "graph Laplacian cache invalidation"
node scripts/graph-memory.mjs plan
node scripts/validate-research-memory.mjs
node --test projects/research-memory-atlas/tests/*.test.mjs
```

Run these from the repository root. The public CLI does not fetch papers or call a model. Company authorization belongs to the native/server caller; CLI scope flags do not authenticate a person.

## Measured baseline and limitations

The fixed authored evaluation in `evaluation/` found no retrieval improvement from graph propagation: lexical-only and default settings both succeeded on 11 of 12 answerable questions, while reciprocal-rank performance declined slightly with the default. A relational prerequisite question and an ordinary-word absent-answer control remain limitations. The latter retrieved related public material, not private data. Retrieval candidates must not be treated as an answer when evidence is missing.

For one local query, five uncached measurements had a 138.014 ms median and five warm result-cache measurements had a 61.132 ms median. These are local samples, not general performance or provider-cost claims. Full questions, labels, raw timings, hashes and failures are retained.

## Rebuild and publication

`node scripts/build-research-memory.mjs` regenerates the atlas, public documents, equation MathML, runtime projections and exports. Regeneration needs Node, the locked site-source esbuild dependency, Python and Pandoc. CI validates committed generation inputs and outputs without requiring a document compiler. The normal static build copies the reviewed research and design surfaces into `docs/`.

Actual publication, CI and deployment evidence is recorded in `project/RESEARCH_MEMORY_DELIVERY.md`. A generated study graph is not a live model, scientific proof, autonomous worker or authority grant.
