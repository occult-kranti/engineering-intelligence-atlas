# AI / Data-Science Research Frontier: Integrated Dataset and Synthesis Report

**Snapshot:** 2026-11-21 · **Source verification dates:** 2026-11-20 / 2026-11-21 (per-record, in the workbooks)
**Companion artifacts:** [ai_research_frontier_dataset.xlsx](ai_research_frontier_dataset.xlsx) · [ai_research_knowledge_graph.json](ai_research_knowledge_graph.json) · [ai_research_network.png](ai_research_network.png)

---

## 0. How to read this report (evidence and snapshot limits)

- This is a **point-in-time curated corpus**, not a census of the field. It joins three verified collections — [frontier_nlp_agents_papers.json](frontier_nlp_agents_papers.json) (33 records), [frontier_data_science_papers.json](frontier_data_science_papers.json) (30 records), [frontier_multimodal_science_papers.json](frontier_multimodal_science_papers.json) (38 records) — with the practice document [senior_ai_research_practice.md](senior_ai_research_practice.md) and its four role charters. Inclusion reflects each collection's own selection rules (2025–2026 frontier plus influential foundations); **absence of a paper is not a judgment**.
- **All quantitative results quoted anywhere are paper-reported**, and vendor-authored records (e.g. OpenAI/Qwen/Meta technical reports) are **vendor-reported** unless an independent replication is named. No citation counts exist in any source, and none were added.
- Venue policies (ARR cycles, checklists, licenses) change every cycle; the practice doc itself instructs re-opening each cited policy page before acting on it.
- The deduplication key was the normalized title (plus an arXiv/DOI cross-check); **101 source records produced 101 unique papers — zero duplicates** across the three collections. Every source record is preserved verbatim in the `Paper_Occurrences` sheet.

---

## 1. Executive synthesis

**101 papers, 22 canonical venues, 168 topics, 121 verified code/data artifacts, 263 paper–benchmark pairs, 4 research roles.**

Three fields converge on one operating picture of the 2025–2026 frontier:

1. **Reasoning and test-time compute are the NLP center of gravity.** [DeepSeek-R1](https://doi.org/10.1038/s41586-025-09422-z) (Nature 2025) established RL-with-verifiable-rewards as the reference recipe; [s1](https://aclanthology.org/2025.emnlp-main.1025/) and the inference-scaling work bound its cost; [The Illusion of Thinking](https://arxiv.org/abs/2506.06941) (Apple ML research; NeurIPS per the corpus record) supplies the counter-evidence that reasoning gains are complexity- and evaluation-sensitive. Treat all three as one tension, not as a ranking.
2. **Evaluation is the shared bottleneck across all three fields.** Agents ([OSWorld](https://arxiv.org/abs/2404.07972), [SWE-bench](https://arxiv.org/abs/2310.06770), [τ-bench](https://arxiv.org/abs/2406.12045), [TheAgentCompany](https://arxiv.org/abs/2412.14161)), data science (tabular, time-series, graph benchmarks), and multimodal/science (saturating VQA/ImageNet-style suites → arenas and experimental validation) all report the same shift: from static accuracy to cost-aware, faithfulness-aware, and reality-anchored evaluation. [AI Agents That Matter](https://openreview.net/forum?id=Zy4uFzMviZ) is the cross-field methodological anchor for cost-vs-accuracy reporting.
3. **Openness is now a first-class research variable.** [OLMo 2](https://openreview.net/forum?id=2ezugTT9kU) / [Tulu 3](https://openreview.net/forum?id=i1uGbfHHpH) / [Qwen3](https://arxiv.org/abs/2505.09388) (NLP), permissive multimodal and science releases ([Wan](https://arxiv.org/abs/2503.20314), [OpenVLA](https://arxiv.org/abs/2406.09246), [Boltz](https://doi.org/10.1101/2024.11.19.624167)-1/2, [Aurora](https://doi.org/10.1038/s41586-025-09005-y), [MatterGen](https://doi.org/10.1038/s41586-025-08628-5), [Evo 2](https://doi.org/10.1101/2025.02.18.638918)), and TabPFN-class foundation models split the corpus into *fully open*, *open-weights*, *gated*, and *closed* tiers — with license and safety notes attached per record in `Code_Data_Resources` (121 unique artifact URLs, each with license/access text as verified at snapshot).

The four role charters operationalize this: a Director owning venue/cycle strategy and gates, a Scientist owning evidence production, a Writer/Reproducibility Editor owning compliance and artifacts, and the pre-existing Open-Model Researcher owning the license-literate open-model landscape. The knowledge graph encodes these as explicit `owned-by-role` edges — organizational assignments derived from the charters, clearly separated from bibliographic edges.

## 2. Corpus distributions (formula-verified in the workbook Summary sheet)

**By field:** NLP / LLM agents 33 · Data science / ML 30 · Multimodal / scientific AI 38 (integrity check OK).

**By evidence status:** peer-reviewed 80 · preprint 2 · preprint/technical report 13 · mixed preprint+peer-reviewed version 5 · mixed (partly peer-reviewed components) 1. **No record is ARR-under-review**; the ARR distinction lives at the venue level (see §3).

**By venue class:** peer-reviewed conference 65 · peer-reviewed journal 11 · peer-reviewed rolling/open review (TMLR) 2 · findings 1 · preprint 21 · technical report 1.

**By year:** 2015: 1 · 2016: 2 · 2017: 6 · 2018: 2 · 2020: 2 · 2021: 4 · 2022: 3 · 2023: 9 · 2024: 26 · 2025: 38 · 2026: 8 — i.e. 72 of 101 papers are 2024–2026, sitting on a deliberate foundation spine (RAG 2020, CLIP 2021, federated averaging 2017, DPO 2023-era, double descent 2020).

**Top venues (corpus coverage counts, not prestige rankings):** ICLR 22 · NeurIPS 18 · arXiv preprint 16 · ICML 10 · Nature 8 · bioRxiv 5 · CoRL 3 · COLM 2 · EMNLP 2 · TMLR 2 · CVPR 2; singletons: ACL, Findings of EACL, AAAI, AISTATS, WWW, ACM CCS, ACM SIGGRAPH/TOG, CACM, Science, Nature Methods, OpenAI technical report.

**Top topics (corpus counts):** LLMs 18 · agents 13 · evaluation 11 · AI for science 11 · reasoning 9 · efficient language models 6 · computer vision 6 · interpretability 5 · data-centric AI 5 · multimodal 5.

**Artifacts:** 78 of 101 papers have at least one verified code/model/data link; 121 unique artifact URLs, each carrying the license/access text the source verified (e.g. MIT for DeepSeek-R1 code/weights, CC BY-SA OpenReview records, Apache-2.0 Informer). Empty artifact fields mean *none verified*, not *none exists*.

## 3. Venue landscape and the peer-review / preprint / ARR distinction

- **Peer-reviewed conference (65):** NeurIPS, ICML, ICLR, AAAI, AISTATS, ACL, EMNLP, CVPR, CoRL, ACM CCS, SIGGRAPH/TOG, WWW, COLM. Acceptance status in the corpus is taken from venue/proceedings records, not arXiv versions (per the [data-science collection's verification protocol](frontier_data_science_research.md)).
- **Peer-reviewed journal (11):** Nature, Science, Nature Methods, Communications of the ACM.
- **Rolling/open review (2, TMLR):** ARR-like continuous review on OpenReview — the closest corpus analogue to ARR operationally.
- **ARR-based selection:** the *ACL venues (ACL, EMNLP, Findings of EACL) select through **ACL Rolling Review** two-monthly cycles plus commitment deadlines — see [senior_ai_research_practice.md §1.1](senior_ai_research_practice.md). The NLP collection's status vocabulary includes `arr-under-review`, but **no snapshot record holds that status**; authors should treat ARR-under-review as a live possibility for their own submissions, not a corpus category.
- **Preprints (21: arXiv 16 + bioRxiv 5) and technical reports (1):** not peer-reviewed. Several multimodal records are *mixed* — preprint plus a later peer-reviewed version (e.g. bioRxiv → Nature 2026); the workbook records both.

## 4. Cross-field themes

1. **Recipe convergence** ([multimodal report, Cross-cutting](frontier_multimodal_science_research.md)): contrastive/masked self-supervision + transformer backbones + diffusion/flow decoding now spans images, video, audio, robot actions, molecules, and crystals — the same unification pattern NLP lived through with LLMs.
2. **Cost-aware evaluation as methodology, not bookkeeping:** inference-scaling laws and s1 (NLP), AI Agents That Matter (agents/evaluation), and arena/human-preference shifts (multimodal) all demand reporting quality-cost-latency frontiers instead of single scores.
3. **Grounding and faithfulness:** [RAG](https://proceedings.neurips.cc/paper/2020/hash/6b493230205f780e1bc26945df7481e5-Abstract.html)/[Self-RAG](https://openreview.net/forum?id=hSyW5go0v8) baselines in NLP parallel retrieval-grounded VLMs and citation-checking in scientific models; hallucination is listed as a persistent limitation in the multimodal corpus as well.
4. **Agents everywhere:** NLP agent benchmarks (SWE-bench, OSWorld, τ-bench), AutoML-Agent in data science, and OSWorld's multimodal desktop setting converge on tool-use + environment-feedback loops as the shared testbed.
5. **Interpretability and safety move from alignment topics to infrastructure:** SAEs/Patchscopes/Transcoders, shallow-safety analyses, and backdoor/privacy work in federated graph learning (DS corpus) all treat internal mechanisms and attack surfaces as first-class empirical objects.
6. **Openness tiers structure the ecosystem:** from fully-open OLMo 2 to API-gated bio models; the [AI Open-Model Researcher charter](scientific-research-library/agents/ai-open-model-researcher.md) supplies the nine-way openness classification the workbook's `vendor_or_provenance_flag` and resource license columns feed into.

## 5. Research gaps (corpus-supported, not exhaustive)

- **Evaluation validity outpaces evaluation volume.** Agent and reasoning benchmarks multiply faster than their construct validity is established (cf. Illusion-of-Thinking critiques; cost-blind evaluation flagged by AI Agents That Matter). Gap: pre-registered, cost-normalized evaluation protocols reused across papers.
- **Reproducibility debt in reasoning RL:** the NLP report notes open post-training (Tulu 3) and open recipes (OLMo 2) exist, but the highest-profile reasoning results remain partially reproducible (data mixes undisclosed). Gap: end-to-end open reasoning-RL replications with pinned data.
- **Cross-lingual and low-resource reasoning:** MMLU-ProX and long-CoT-across-languages work is early; multilingual agent evaluation is nearly absent from the corpus.
- **Science-model validation:** bioRxiv → Nature pipelines show promise, but wet-lab/experimental success rates and distribution-shift behavior are the persistent limitations flagged in the multimodal corpus. Gap: prospective, lab-verified benchmarks with pre-registered success criteria.
- **Tabular/time-series foundation models vs. trees:** tree-based models still win on typical tabular data (DS corpus); foundation-tabular claims need harness-disclosed, contamination-checked comparisons.
- **Safety/robustness under adaptive attack:** shallow-safety and any-depth-alignment results imply current alignment is brittle; the corpus contains no standardized red-team harness shared across fields.

## 6. Practice guidance (from [senior_ai_research_practice.md](senior_ai_research_practice.md); re-verify each policy page per cycle)

**Reproducibility (§4, §6):** pin versions across paper/code/data; archive artifacts in DOI'd repositories; disclose seeds, configs, harness, and compute; write model/data documentation (model cards / datasheets discipline); empty-artifact honesty ("none verified", never inferred).

**Statistical evaluation (§5):** report effect sizes with confidence intervals, not bare leaderboard deltas; multiple-seed runs for RL/agent results; significance testing appropriate to paired benchmark items; contamination and train/test overlap checks before any capability claim; cost-aware Pareto reporting per AI Agents That Matter.

**ARR writing and process (§1.1, §8, §9):** target the two-monthly ARR cycle backwards from the commitment deadline; pass the desk-rejection checklist (formatting, anonymity, ≤10% text reuse, checklist accuracy, resubmission compliance, **no fabricated references, no prompt injection in PDFs**); treat meta-reviews as the decision record for revise/commit/withdraw; camera-ready requires rights-form and license determination. NeurIPS/ICML/ICLR (§1.3) and ACM artifact evaluation (§1.4) have parallel but distinct checklists.

**Writing (§12):** every abstract/introduction claim maps to evidence in a claim table before drafting; limitations sections are load-bearing; vendor-reported numbers are labeled as such inline.

## 7. Staged reading and research roadmaps

**Stage 1 — Methods spine (1–2 weeks).** DeepSeek-R1 ([paper](https://doi.org/10.1038/s41586-025-09422-z)) → [RAG](https://proceedings.neurips.cc/paper/2020/hash/6b493230205f780e1bc26945df7481e5-Abstract.html) → [ReAct](https://openreview.net/forum?id=WE_vluYUL-X) → [DPO](https://arxiv.org/abs/2305.18290) → [CLIP](https://arxiv.org/abs/2103.00020) ([arXiv](https://arxiv.org/abs/2103.00020)) → Deep Double Descent ([OpenReview](https://openreview.net/forum?id=B1g5sA4twr)). Goal: shared vocabulary across the three fields.

**Stage 2 — Frontier evaluation (2–3 weeks).** AI Agents That Matter → SWE-bench / SWE-agent → OSWorld → τ-bench / TheAgentCompany → [MMLU-ProX](https://arxiv.org/abs/2503.10497) → tabular/tree-baseline study ([Why do tree-based models still outperform deep learning](https://arxiv.org/abs/2207.08815)). Deliverable: a cost-aware evaluation plan with contamination checks (Writer-Editor gate).

**Stage 3 — Specialization tracks (parallel).**
- *NLP/agents:* prompt-program optimization ([DSPy](https://arxiv.org/abs/2310.03714) → [OPRO](https://openreview.net/forum?id=92gvk82DE-) → TextGrad *(discussed in the NLP map; not a corpus record)* → [GEPA](https://arxiv.org/abs/2507.19457)), interpretability ([SAEs](https://openreview.net/forum?id=76eOTne6DI) → [Patchscopes](https://proceedings.mlr.press/v235/ghandeharioun24a.html) → [Transcoders](https://arxiv.org/abs/2406.11944)), multilingual instruction following ([Aya](https://aclanthology.org/2024.acl-long.845/)), alignment-depth papers; research output: one ARR-targeted experiment plan per [Director charter](scientific-research-library/agents/ai-research-director.md).
- *Data science/ML:* uncertainty/conformal stack ([Deep Ensembles](https://proceedings.neurips.cc/paper_files/paper/2017/hash/9ef2ed4b7fd2c810847ffa5fa85bce38-Abstract.html) onward), federated privacy stack, [AutoML-Agent](https://proceedings.mlr.press/v267/trirat25a.html); time-series foundation models after [Informer](https://ojs.aaai.org/index.php/AAAI/article/view/17325); output: a benchmark protocol with harness disclosure.
- *Multimodal/science:* VLM/speech encoder lineage ([CLIP](https://arxiv.org/abs/2103.00020) → [Qwen2.5-VL](https://arxiv.org/abs/2502.13923); [Whisper](https://arxiv.org/abs/2212.04356) for speech), generative video/3D ([Sora](https://openai.com/index/video-generation-models-as-world-simulators/) technical report vs open [Wan](https://arxiv.org/abs/2503.20314), [TRELLIS](https://arxiv.org/abs/2412.01506)), then one science track (protein: [AlphaFold](https://doi.org/10.1038/s41586-021-03819-2)/[Boltz](https://doi.org/10.1101/2024.11.19.624167); weather: [Aurora](https://doi.org/10.1038/s41586-025-09005-y)/[GraphCast](https://doi.org/10.1126/science.adi2336); materials: [MatterGen](https://doi.org/10.1038/s41586-025-08628-5)); output: openness-classified model dossier per [Open-Model Researcher charter](scientific-research-library/agents/ai-open-model-researcher.md).

**Stage 4 — Production (cycle-bound).** Pick an ARR or Tier-A ML deadline; run the gate sequence (pre-submission → pre-rebuttal → pre-commitment → pre-camera-ready → pre-release) exactly as chartered; file the claim/evidence table and reproducibility checklist with the manuscript.

## 8. Companion artifact guide

- **Workbook:** `Summary` counts are live formulas with OK/MISMATCH integrity checks; `Paper_Occurrences` proves 101 = 33 + 30 + 38; `Venues` carries the per-venue review distinction; `Code_Data_Resources` carries license/access text; `Evaluation` lists all 263 paper–benchmark pairs *without* metric values (deliberate: numbers here are paper-reported and belong with their papers).
- **Knowledge graph:** 1,027 nodes (101 papers, 168 topics, 355 methods, 256 benchmarks, 22 venues, 121 resources, 4 roles) and 1,437 edges of six explicit types; no citation or coauthor edges exist because the sources contain none. Every edge carries `evidence_status` and provenance.
- **Network PNG:** deterministic small-multiple hub-and-spoke (no force layout): three field panels with venue columns (venues with >=2 corpus papers) and every paper drawn as a dot on its venue spoke, colored by evidence class; 11 singleton venues are aggregated in a labeled side panel whose rows key each singleton paper by its paper_id (e.g. ACL [P030]) into the Papers sheet and JSON graph; per-field topic lanes list topic counts (paper-topic edges live in the JSON graph); the fixed greedy-modularity audit (14 communities, top-6 listed) is retained on-canvas. Hub sizes are corpus coverage counts — **no universal ranking is implied**.

## 9. Limitations of this snapshot

- Three curated collections with their own selection biases; the multimodal collection assigns one category-level topic per record, so topic counts understate multimodal topical richness.
- Verification dates are 2026-11-20/21; URLs, licenses, gating, and leaderboard positions age in weeks. ACM/OpenReview PDF links may 403 to non-browser clients (noted in the DS URL audit).
- `paper_url` coverage is complete, but DOI fields are present only where the source recorded them (multimodal arXiv IDs live inside `paper_url`).
- Vendor-affiliated authorship is flagged where the sources flag it; unflagged does not mean independent.
- The knowledge graph's `owned-by-role` edges are charter-derived organizational assignments, not bibliographic facts.
