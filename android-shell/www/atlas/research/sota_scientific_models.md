# Open-Weight / Open-Source SOTA AI Models for Science — as of 2026-11-20

**Scope.** Current state-of-the-art (SOTA) open-weight and open-source AI models/resources across mathematics, physics, chemistry, biology, protein structure/design, genomics, materials, climate/weather, medical research (imaging + text), and scientific-discovery agents. For each: exact model/resource, task, license/access, openness of code/weights/data, benchmark evidence with date, limitations, and high-stakes restrictions.

**Safety note.** This document is a research-tooling survey only. It separates *research/in-silico* tools from *clinical* or *wet-lab/hazardous* deployment, and intentionally contains no operational bio/chem protocols. Benchmark numbers below are vendor- or paper-reported unless marked as independent evaluation; evaluation harness, date, and conditions differ between rows, so treat small gaps as ties.

**Method.** Compiled from ≥9 distinct search rounds over primary papers (Nature, Science, Nature Medicine, Nature Methods, npj Climate, bioRxiv/arXiv), official model repositories (GitHub/Hugging Face), benchmark leaderboards (AIME registry, Matbench Discovery ecosystem), and independent benchmark audits. Key primary sources are cited inline.

---

## 1. Mathematics & Formal Reasoning

### General reasoning LLMs (informal math)

| Model | Task | License / access | Openness | Benchmark evidence (date) | Limitations |
|---|---|---|---|---|---|
| **Kimi K2 Thinking** (Moonshot AI, Nov 2025; 1T MoE, INT4-native) | Competition math, agentic reasoning | Modified MIT license (attribution clause at very large scale); weights on Hugging Face | Weights open; training data/code not open | AIME 2025 **99.1% w/ Python tools** (94.5 no-tools); HMMT 2025 95.1; GPQA-Diamond 84.5–85.7; HLE w/ tools 44.9% (vendor, Nov 2025). Highest open-weight AIME 2025 in registry as of 2026-11 (ai-tldr.dev) | Very verbose/long chains; 1T-param MoE is expensive to self-host; scores with tools are not pure reasoning; Moonshot has since deprecated the official API (status checked Aug 2026) |
| **GPT-OSS-120B / 20B** (OpenAI, Aug 2025; MoE) | Math + general reasoning | Apache 2.0 | Weights open | AIME ~96.6% (120B) / ~96% (20B) per OpenAI; registry: 20B **98.7%**, 120B 97.9% AIME 2025 (harness-dependent; Nov 2026 registry) | Tool-augmented scores inflate vs. no-tool eval; smaller context (128K) than K2 |
| **DeepSeek-V3.2 / -V3.2-Speciale (Thinking)** (DeepSeek, Sep–Dec 2025) | Math, general reasoning | MIT | Weights open; data closed | AIME 2025 ~93.1% (Thinking, vendor); Speciale variant ~96% (registry, 2026); earlier V3.2 89.3 no-tools in Kimi's table | Vendor-reported; strong variance across harnesses |
| **Qwen3-235B-A22B (2507, Reasoning)** (Alibaba, 2025) | Math, general | Apache 2.0 | Weights open; Qwen3 tech report (arXiv:2505.09388) documents training | AIME'24 85.7 / AIME'25 81.5 (thinking mode, Qwen3 TR, May 2025); AIME 2025 ~92.3 for the 2507 reasoning refresh (vendor) | Saturated on MATH-500; dense older Qwen3-32B drops to ~72.9 AIME 2025 |
| **GLM-4.7 / GLM-4.7-Flash** (Zhipu/Z.AI, 2026) | Math, agentic | MIT | Weights open | AIME 2025 ~95.7 (GLM-4.7), 91.6 (Flash, 30B-A3B); GPQA 75.2 (Flash) — vendor/registry 2026 | Vendor-reported; Flash trades depth for speed |

### Formal theorem proving (Lean 4)

| Model | Task | License / access | Openness | Benchmark evidence (date) | Limitations |
|---|---|---|---|---|---|
| **DeepSeek-Prover-V2** (671B + 7B; DeepSeek, Apr 2025) | Lean 4 theorem proving | MIT (weights + code on HF/GitHub) | Weights open; ProverBench released | miniF2F-test ~88.9% (671B, high-compute setting, paper Apr 2025); state of the art among open provers at release | Needs large compute for 671B; pass-rate drops sharply at low sampling budgets |
| **Goedel-Prover-V2** (8B/32B; Princeton et al., 2025) | Lean 4 theorem proving | Apache 2.0 | Weights + code open | 8B matches DeepSeek-Prover-V2-671B at 84.6% miniF2F; 32B reaches 90.4% with self-correction (paper, 2025) — strong evidence small open provers suffice | Specialized; weak on non-formal reasoning; benchmark contamination on miniF2F is a known concern |
| **Kimina-Prover-72B** (Moonshot/Numina, 2025) | Formal proving | Open weights (HF) | Weights open | Competitive miniF2F results; noted in open-model surveys as a top dense specialist | Narrow domain; needs Lean toolchain |
| **AlphaProof / AlphaGeometry 2** (Google DeepMind) | IMO-level math | **Closed** — no weights | Closed | AG2 solves 84% of IMO geometry problems (Nature 2024); context, not open | Not open; listed only as capability reference |

**High-stakes restrictions (math):** None domain-specific. Standard acceptable-use policies apply. Formal-prover outputs are machine-checkable, which makes this the lowest-risk domain here.

---

## 2. Physics

| Model / resource | Task | License / access | Openness | Benchmark evidence (date) | Limitations |
|---|---|---|---|---|---|
| **Walrus** (Polymathic AI, arXiv:2511.15684, Nov 2025; 1.3B params) | Cross-domain foundation model for continuum dynamics (fluids & fluid-like systems) | MIT (code + weights; trained on **The Well**, ~15TB, 19 scenarios/63 variables, open) | Code, weights, data open | Adaptive compute + long-run stable rollouts across 19 physical systems; presented NeurIPS 2025 (preprint) | Authors themselves restrict claims to continuum dynamics; preprint-stage; cross-domain transfer to e.g. quantum many-body unverified |
| **GPhyT — "Towards a Physics Foundation Model"** (RWTH Aachen/UVA, arXiv:2509.13805, 2025) | Zero-shot generalization to unseen physical systems; in-context inference of governing dynamics | Code/weights released with paper | Open | Trained on 1.8TB; up to **29× better than specialized architectures**, stable 50-step rollouts (preprint, Sep 2025) | 2D simulation data only; preprint; zero-shot claims need independent replication |
| **AION-1** (Polymathic AI / UC Berkeley / Flatiron; NeurIPS Dec 2025) | Astronomy foundation model (200M+ celestial objects; spectra/imaging) | Open release | Open weights | First large astronomy FM; strong low-data-regime transfer (Simons Foundation report, Dec 2025) | Early; domain-specific tokenization; limited independent benchmarking |
| **TORAX** (Google DeepMind) | Differentiable tokamak core-transport simulator for fusion | Apache 2.0 | Code open | Widely used in fusion research; coupled with NN surrogates for pulse design | Research tool, not a control system |
| **Physics Supernova** (Princeton/Tsinghua/SJTU agent, arXiv:2509.01659) | Olympiad physics problem solving (agent) | Code released | Open agent, built on LLMs | IPhO 2025: **23.5/30, gold-medalist level (14th of 406)** (2025) | An agent, not a physics simulator; depends on underlying frontier LLMs |
| **PHYBench / ReplicationBench** (benchmarks) | Eval, not models | Open | Data open | PHYBench (500 problems): Gemini 2.5 Pro 36.9% vs human experts 61.9%; ReplicationBench: frontier agents <20% on full paper replication (Stanford AI Index 2026) | Show LLM physics reasoning still well below experts |

**High-stakes restrictions (physics):** Fusion/plasma and CFD agents (e.g., TORAX, Foam-Agent) are research surrogates; not validated for reactor control or safety-critical engineering sign-off.

---

## 3. Climate & Weather

| Model / resource | Task | License / access | Openness | Benchmark evidence (date) | Limitations |
|---|---|---|---|---|---|
| **AIFS Single / AIFS ENS / AIFS v2** (ECMWF; operational Feb 25, 2025, ensemble Jul 1, 2025; v2 live May 12, 2026) | Operational global medium-range forecasts | **CC-BY-4.0 weights; Apache-2.0 Anemoi code**; forecasts via ECMWF open data | Weights + code open (fully runnable via `anemoi-inference`) | ECMWF's own scorecards: competitive with IFS at ~1/1000 energy per forecast; operational since Feb 2025 — the most operationally validated AI weather model | Underperforms physics ENS on 10m wind, under-predicts extreme precipitation, over-dispersive aloft (ECMWF Newsletter 185); needs ECMWF analyses as input |
| **Aurora** (Microsoft Research; Nature, May 2025; v2.0.1 on PyPI `microsoft-aurora`, MIT) | Atmospheric foundation model: weather, air quality, ocean waves, tropical cyclones | MIT (code + weights) | Fully open | 1.3B params; at 0.1° beats IFS HRES on 92% of variable/level/lead-time combos (Nature 2025); Microsoft claims Aurora 1.5 beats GenCast on 88.9% of targets (vendor claim) | Deterministic; foundation-model fine-tunes need care per domain |
| **GenCast / WeatherNext** (Google DeepMind; Nature 2024; WeatherNext 2, Nov 2025) | Probabilistic ensemble weather | GenCast code + weights open (GitHub, non-commercial-ish terms historically — check repo); WeatherNext 2 is a product layer with data via Earth Engine/BigQuery | GenCast open; WeatherNext partially product-gated | GenCast beat ECMWF ENS on **97.2% of 1,320 targets**, 15-day ensemble in ~8 min (Nature 2024); Google's cyclone model used by NHC in 2025 season and open-sourced Aug 2026 | Benchmarks vs reanalysis, not real-time obs; rare-extreme behavior still being established |
| **GraphCast** (Google DeepMind; Science 2023) | 10-day deterministic global forecast | Apache 2.0 (code + weights) | Open | Beat HRES on >90% of 1,380 targets; 10-day forecast <1 min on one TPUv4 | 0.25° only; superseded for probabilistic work by GenCast/AIFS ENS |
| **ACE2 / ACE2-ERA5** (Allen Institute for AI / Ai2; npj Climate 2025, doi:10.1038/s41612-025-01090-0) | Climate emulation: stable 1000-yr atmosphere rollouts; subseasonal-to-decadal variability | **Apache-2.0** (code ai2cm/ace; weights HF `allenai/ACE2-ERA5`) | Fully open (code + weights + training stack) | Comparable or better than physics AMIP ensemble on tropical waves, extratropical vertical temperature trends; ~1,200 simulated years/day on one H100 (~1000× speedup) | Struggles with QBO / propagating SAM and slow modes (GRL benchmarking, Baxter et al. 2025/26); atmosphere-only; response to unseen forcing uncertain |
| **NeuralGCM** (Google Research; Nature 2024) | Hybrid physics+ML GCM: weather to climate | **Apache-2.0** code; stochastic precip checkpoints CC-BY-4.0 (Zenodo) | Open | 30-yr stable climate simulations; year of global atmosphere in ~8 min on one TPU; NeuralGCM+ (Ai2 + Google.org, announced Nov 4, 2026) extends to coupled ocean | Atmosphere-only so far; extrapolation to unseen climates is explicitly an open research problem |
| **Pangu-Weather** (Huawei; Nature 2023) | Deterministic global forecast | Open code/weights (check repo terms) | Open | First AI model with IFS-comparable skill; 10,000× faster inference claim | Largely superseded by AIFS/GenCast/Aurora |
| **NOAA AIGFS / AIGEFS / HGEFS** (operational Dec 17, 2025 / Jan 5, 2026) | Operational US AI weather suite | US government open | Open | Operational deployment is itself the evidence; AIGFS is a GraphCast derivative at a fraction of GFS compute | NOAA itself notes AIGFS v1.0 degrades tropical-cyclone *intensity* forecasts |

**High-stakes restrictions (climate/weather):** Operational warnings remain the legal responsibility of national meteorological services; open AI models are decision-support, not certified warning systems. Known systematic biases (extremes, precipitation, TC intensity) must be characterized before any operational reliance.

---

## 4. Materials Science

| Model / resource | Task | License / access | Openness | Benchmark evidence (date) | Limitations |
|---|---|---|---|---|---|
| **MatterGen** (Microsoft Research + SIAT; Nature, Jan 2025, doi:10.1038/s41586-025-08628-5) | Conditional diffusion generation of inorganic crystals (chemistry, symmetry, band gap, bulk modulus, magnetic targets) | **MIT** (github.com/microsoft/mattergen, weights + training code) | Fully open | SUN rate (stable/unique/novel) 38.57%, RMSD 0.021 Å; 2× more likely than prior methods to yield stable novel structures; experimentally validated (TaCr₂O₆ synthesized) | Generated candidates skew out-of-distribution for some property targets (independent LeMat-GenBench / Bayesian-probe studies, 2026); synthesizability still not a first-class objective |
| **MACE-MP-0 / MACE family** (Cambridge ACEsuit; JCP 2025, doi:10.1063/5.0297006) | Universal machine-learning interatomic potential (uMLIP) | MIT (code + foundation checkpoints) | Fully open | ~89 elements; energy MAE ~20 meV/atom class; a standard foundation on Matbench Discovery | uMLIPs systematically underestimate soft modes; poor for OOD surfaces/defects without fine-tuning |
| **Meta UMA / eSEN + OMol25** (Meta FAIR; arXiv:2506.23971, 2505.08762; 2025) | Universal interatomic potentials spanning molecules, materials, catalysts, MOFs, molecular crystals; OMol25 = 100M+ DFT calcs, 83 elements | **FAIR Chemistry License (gated Hugging Face application)** for UMA weights; OMol25 dataset CC-BY-4.0; fairchem code Apache-2.0 | Data open; weights open-but-gated | UMA-S/M with MoLE multi-task heads; eSEN strong on thermal conductivity, phonons, stability; OMat24-trained models exceed F1 0.9 on stability classification (Matbench Discovery) | Gated license review; inherits DFT functional errors; UMA-L not publicly released |
| **ORB (Orb-v3)** (Orbital Materials, 2025) | Fast universal MLIP | Open weights (HF), permissive | Open | 3–6× faster than PyTorch MACE; best descriptor among MACE/ORB/UMA in independent surrogate-feature benchmark (arXiv:2606.28578, 2026); strong on battery-migration-barrier benchmark (arXiv:2512.03642) | Commercial-backed; less community tooling than MACE |
| **MatterSim** (Microsoft) | Atomistic simulation across elements/T/P | Open (MIT repo) | Open | SOTA on Matbench Discovery at release (2024) | Same uMLIP caveats |
| **DPA-2/3** (Deep Potential / DP Technology) | Large-atom-model potential | Open components + platform (Bohrium) | Partially open | Zero-shot RMSE reductions ~52% (energy)/59% (force) vs predecessors (npj Comput. Mater. 2024) | Chinese platform ecosystem; some parts proprietary |

**High-stakes restrictions (materials):** Generative candidates (MatterGen etc.) are hypotheses for DFT + lab validation, not certified materials; experimental synthesis validation rates in the literature remain low (A-Lab synthesized 41/58 targets in 17 days, Nature 2023 — and even that "discovery" claim is contested).

---

## 5. Chemistry

| Model / resource | Task | License / access | Openness | Benchmark evidence (date) | Limitations |
|---|---|---|---|---|---|
| **Uni-Mol / Uni-Mol2** (DP Technology; ICLR 2023 / NeurIPS 2024) | 3D molecular representation learning; property prediction; 1.1B-param dual-track transformer pretrained on 884M molecules | Open (check repo; Uni-Mol historically non-commercial-leaning terms — verify before commercial use) | Code + weights open | SOTA on MoleculeNet-class 3D property tasks at release; Uni-Mol2 largest 3D molecular FM | Docking/property claims often overfit MoleculeNet splits; independent audits needed |
| **ChemDFM / ChemDFM-R** (arXiv:2507.21990, Dec 2025 revision) | Chemistry reasoning LLM (reaction, molecule, text-centric tasks) | Open weights (HF) | Open | ChemEval benchmark: ChemDFM-R-13B competitive with or beating Qwen3-14B and o4-mini on several molecule/reaction tasks (paper, 2025) | Still weak on reaction-centric tasks (all models <45% on many); benchmark is partially self-built |
| **ChemFM** (Communications Chemistry) | 3B causal-LM chemical foundation model (178M UniChem molecules) | Open | Open | Scaling-law-guided pretraining; competitive generation/property results | SMILES-based; no 3D |
| **IBM FM4M / SMI-TED family** | Multi-representation chemistry/materials FMs (SMILES, SELFIES, graphs, 3D, electron density) | **Apache 2.0** | Fully open | Broad toolkit benchmarking (2024–25) | Component models vary in maturity |
| **TinyChemVL** (arXiv:2511.06283) | 4B chemical vision-language model; reaction recognition/prediction from images (VisRxnBench) | Open | Open | SOTA on most vision-based chemistry tasks at 4B (paper) | Niche modality; benchmark self-introduced |
| **OMol25 / OMC25 / OC25 datasets + eSEN models** (Meta FAIR) | Quantum-chemistry training resources (100M+ DFT calcs) | CC-BY-4.0 data; FAIR Chemistry License for models | Data open, models gated | Enable UMA-class models (see §4) | DFT-level accuracy ceiling |

**High-stakes restrictions (chemistry):** No operational synthesis routes or reaction optimizations should be executed from model output alone. LLM-based chem agents (ChemCrow lineage) have documented potential for dual-use; most frontier general LLMs refuse detailed hazardous-synthesis assistance, but open-weight models have no such guarantee — institutional biosafety/chemsafety review applies before any wet-lab use.

---

## 6. Protein Structure Prediction

| Model | Task | License / access | Openness | Benchmark evidence (date) | Limitations |
|---|---|---|---|---|---|
| **AlphaFold 3** (DeepMind/Isomorphic; Nature, May 2024) | Structure of proteins + DNA/RNA/ligands/ions complexes | Code open (GitHub, Apache-2.0); **weights gated: custom DeepMind license, academic/non-commercial use, request-based, non-redistributable**; AF Server for non-commercial use | Code open, weights restricted | Reference accuracy across protein–ligand, –nucleic acid, antibody–antigen tasks (Nature 2024) | Restricted commercial use; poor on missense-mutation effects; server vs local terms differ |
| **Boltz-2** (MIT Jameel Clinic + Recursion; June 2025) | Joint complex structure + binding-affinity prediction | **MIT — fully open (weights, training + inference code, data)** | Fully open | ~AF3-level structure (slightly below AF3); affinity ~FEP-level (Pearson ~0.62 on FEP+ benchmark) at ~1000× speed; best method at CASP16 affinity challenge; 2× average precision in MF-PCBA hit discovery (preprint 2025) | Affinity limited to small-molecule–protein; confidence ≠ affinity; OOD chemotypes degrade |
| **Boltz-1 / Boltz-1x** (Nov 2024) | AF3-class biomolecular complex prediction | MIT | Fully open | First fully open AF3-class model; ~AF3-level accuracy (bioRxiv 2024) | Superseded by Boltz-2 |
| **Chai-1** (Chai Discovery, Sep 2024) | AF3-class complex prediction; MSA-free mode via ESM embeddings | Apache 2.0 code; weights originally non-commercial — verify current card | Mostly open | Comparable to Boltz-1; strong antibody modeling (2024) | Successor Chai-2 is API-only (not open) |
| **Protenix** (ByteDance, 2024) | AF3 reproduction | Apache 2.0 (weights + training code) | Fully open | ~Boltz-1 accuracy | Less ecosystem adoption |
| **OpenFold3 / OpenFold consortium** | Open AF2/AF3-class reproductions | Apache 2.0 | Fully open | New OpenFold3 checkpoints May 2026 | Slightly below frontier accuracy |
| **RFdiffusion / RFdiffusion3, ProteinMPNN, LigandMPNN, RFantibody** (Baker Lab / IPD) | Protein **design**: backbone generation, sequence design, all-atom design, antibody design | BSD (RFdiffusion/RFdiffusion3) / MIT (ProteinMPNN, LigandMPNN, RFantibody) — code + weights | Fully open | RFdiffusion3 open Dec 2025; in Science Oct 2026; RFdiffusion wet-lab-validated across many papers since 2023 | Design success requires downstream experimental screening; "binds" ≠ "functional" |
| **BoltzGen** (MIT; bioRxiv 2025.11.20.689494, Nov 2025) | Universal all-atom binder design (proteins, peptides, nanobodies vs proteins/small molecules/nucleic acids) | **MIT — weights + training/inference code + pipeline** | Fully open | Nanomolar binders for ~2/3 of tested novel targets with ≤15 designs (preprint, Nov 2025) | Preprint; controlled 2025 Adaptyv challenge showed zero neutralizing hits among >1,000 Nipah designs across methods — function remains hard |
| **ESM family** (Meta→EvolutionaryScale→CZ Biohub): ESM-2, ESMFold, ESM-C, ESM3-open | Protein language modeling, folding, generation | MIT (ESM-2, ESMFold; ESM-C/ESMFold2/ESM3-open MIT since May 2026) | Open (large ESM3 closed/API) | ESM3's esmGFP (58% identity to nearest natural FP — "~500M years of evolution") demonstrates generative reach (2024) | Full 98B ESM3 not open; generation ≠ function |
| **SimpleFold** (Apple, arXiv 2025) | Flow-matching folding with general-purpose transformer | MIT | Open | Competitive folding without domain-specific architecture | New; single-chain focus |
| **ESMFold** (Meta) | Fast single-sequence folding | MIT | Open | Seconds per structure; good for pre-screening | Misses MSA-dependent detail |

**High-stakes restrictions (proteins):** Design tools (BoltzGen, RFdiffusion, ESM3) are dual-use capable. This survey deliberately omits any operational design protocols; outputs require institutional biosafety review (IBC) and standard sequence-screening (e.g., IBBIS/SecureDNA-type screening at synthesis vendors) before any physical realization.

---

## 7. Genomics & Sequence Modeling

| Model / resource | Task | License / access | Openness | Benchmark evidence (date) | Limitations |
|---|---|---|---|---|---|
| **Evo 2** (Arc Institute + NVIDIA/Stanford/Berkeley/UCSF; Nature, Mar 4, 2026; preprint Feb 2025) | DNA foundation model: variant-effect prediction (incl. BRCA1, noncoding), genome-scale generation/design; 7B/40B (+20B, 1B) params, up to 1M-bp context | **Apache 2.0 — weights (HF `arcinstitute`), training + inference code, and OpenGenome2 dataset (8.8T bp) all open**; also via NVIDIA BioNeMo/NIM | Fully open (one of the largest fully open models in any domain) | Zero-shot pathogenicity prediction incl. clinically significant BRCA1 variants without fine-tuning; SOTA genome-scale generation; first inference-time scaling in biology (Nature 2026) | 1B/20B/40B need FP8 Hopper GPUs; statistical, not mechanistic; weaker on under-represented organisms; **eukaryotic viruses deliberately excluded from training for biosafety** |
| **Nucleotide Transformer v1/v2; NTv3** (InstaDeep et al.; Nature Methods 2025) | Human-genomics FM (variant/regulatory tasks) | v1/v2 **CC BY-NC-SA 4.0**; NTv3 gated "license: other" | Open but non-commercial/gated | Strong Genomic Benchmarks results (2025) | Non-commercial license; 6-kb context limit |
| **HyenaDNA / Caduceus / DNABERT-2 / GENA-LM** | Efficient long-range DNA modeling | Mixed: Apache-2.0 code, some checkpoints BSD/other (verify per artifact) | Mostly open | HyenaDNA: SOTA on 12/18 NT-benchmark tasks at tiny scale (NeurIPS 2023); GENA-LM open long-sequence family (NAR 2025) | Code/weight licenses differ per checkpoint |
| **AlphaGenome** (DeepMind, 2025/26) | Sequence-to-function (expression, splicing, chromatin) variant-effect prediction | Apache-2.0 research code; **weights gated, non-commercial terms**; hosted API | Partially open | Peer-reviewed 2026; broad modality coverage for regulatory variant interpretation | Non-commercial weights gate |
| **Enformer / AlphaMissense / DeepVariant / Borzoi** (DeepMind/Google, Calico, Calico-Calico, Broad) | Expression prediction; missense pathogenicity; variant calling | Mostly open code; Borzoi weights downloadable (no explicit weight license) | Mixed | AlphaMissense: public predictions for 71M human missense variants (2023) | Established but aging; check per-artifact terms |

**High-stakes restrictions (genomics):** Evo-class generative genomics is dual-use; the Evo 2 team's own mitigations (pathogen exclusion, red-teaming) and the accompanying Inglesby & Hanke policy Perspective argue oversight must be designed now. Clinical variant interpretation (BRCA1 etc.) is research-grade only — not a diagnostic; ACMG/AMP clinical pipelines and CLIA/CAP validation are required for any patient use.

---

## 8. Single-Cell / Transcriptomics (biology) — with a caution flag

| Model | Task | License | Openness | Evidence (date) | Limitations |
|---|---|---|---|---|---|
| **scGPT** (Nat Methods 2024), **Geneformer** (Nature 2023), **scFoundation**, **UCE** (Stanford), **SCimilarity** (Nature 2025), **TranscriptFormer** (CZI, 2025), **Nicheformer** (Nat Methods 2025, spatial) | Cell embedding, annotation, integration, perturbation response | Mostly open weights (MIT/Apache per repo) | Open | — | **Seven-plus independent benchmarks (2025–2026) find these FMs do NOT consistently beat simple baselines**: Kedzierska et al. (Genome Biol 2025): zero-shot scGPT/Geneformer lose to HVG+scVI/Harmony; Ahlmann-Eltze et al. (Nat Methods 2025): no FM beats additive/mean baselines on perturbation; Bendidi et al. 2024 "one PCA still rules them all"; VCBench 2026: baselines match/exceed all five models on 4/5 capability dimensions. Bright spots: protein-expression prediction from CITE-seq (SCimilarity lowest error; Gaballa et al. 2026) and low-label regimes (scGPT) |

**Recommendation:** treat single-cell FMs as research tools with mandatory baseline controls; do not report FM-only results.

---

## 9. Medical Research — Text & Imaging

### Medical text LLMs (open-weight)

| Model | Task | License | Openness | Evidence (date) | Limitations |
|---|---|---|---|---|---|
| **Med42-v2 70B / 8B** (M42 + Cerebras) | Clinical QA, USMLE-style reasoning | Llama 3 Community License | Weights open | ~87% USMLE / ~86% MedQA — top of open-weight medical leaderboard (May 2026 survey) | Benchmark ≠ clinical safety; Llama community license restricts some uses |
| **MedGemma 4B / 27B (text + multimodal)** (Google; Nature Medicine 2026, doi:10.1038/s41591-026-04626-w) | Medical text + images (CXR, dermatology, ophthalmology, pathology); fine-tuning base | **Gemma Terms of Use (open weights, not OSI-open; health-specific use policies)** | Weights open; data/training closed | ~83% USMLE (27B); fine-tuned MedGemma 4B beats Gemma 3 4B on unseen SIIM-ACR pneumothorax, CRC100k histopathology, ISIC skin-lesion tasks; ReXVQA 83.84 vs 77.27 best radiology resident (independent); 81% of its CXR reports rated equal/superior by one unblinded radiologist — but only 49% for abnormal studies | 2D images only, downsampled to 896×896; authors: benchmark evidence is "only the first step towards validating real-world utility"; not evaluated as a clinical product |
| **BioMistral 7B** (Apache 2.0), **OpenBioLLM 70B**, **HuatuoGPT-o1**, **Meditron (EPFL; Meditron-FO fully open pipeline 2026)** | Biomedical literature/clinical QA | Apache 2.0 (BioMistral, Meditron-FO); Llama-based others | Open | Meditron Fully-Open (arXiv 2026) is the first fully open (data+code+weights) medical specialist pipeline; BioMistral most-downloaded medical LLM on HF | All well below frontier closed models (GPT-5.5 ~95% USMLE reference) |

### Medical imaging foundation models

- **MedGemma multimodal** (above) is the leading open-weight generalist for research imaging VQA.
- Task-specific open tools (segmentation, pathology) — e.g., **LLaVA-Med**, **BiomedGPT-B**, pathology FMs (UNI, CONCH — research-use licenses) — remain stronger in narrow tasks but are not clinically validated.

**High-stakes restrictions (medical):** **None of these models is a medical device.** FDA-cleared LLM-based devices remain rare (<20 as of May 2026 per FDA AI/ML device list). Research use only; any clinical deployment requires regulatory clearance (FDA/CE-MDR), local validation on representative patient/scanner populations, and HIPAA/GDPR-compliant infrastructure (self-hosting open weights helps privacy but transfers all compliance responsibility to the deployer). MedGemma/Gemma health terms and Llama community licenses carry their own use restrictions.

---

## 10. Scientific Discovery Agents & General Science Models

| System | Task | License / access | Openness | Evidence (date) | Limitations |
|---|---|---|---|---|---|
| **Biomni** (Stanford SNAP; bioRxiv May 2025, Science 2026; 15,000+ users) | General-purpose biomedical agent: literature, databases (59), 150+ tools, code execution; rare-disease dx, GWAS, CRISPR screen design | **Apache 2.0** (github.com/snap-stanford/biomni); commercial successor "Biomni Lab" (Phylo, 2026) | Open | LAB-Bench: DbQA 74.4% ≈ expert humans (74.7%); SeqQA 81.9% > humans (78.8%); matched senior experts on cloning-design benchmark (single demonstration) | Executes LLM-generated code with full privileges — **must sandbox**; on independent BioML-bench, agents on average underperform human baselines |
| **Kosmos** (Edison Scientific, ex-FutureHouse; Nov 2025) | Long-horizon autonomous discovery (12-hr runs, ~1,500 papers, ~42K lines of code/run) | **Closed/commercial** ($200/run; academic free tier); Robin predecessor open on GitHub | Closed | 7 claimed discoveries (3 reproductions, 4 novel: diabetes, Alzheimer's, neurodegeneration, cardiovascular); 79.4% statement accuracy overall but **57.9% on novel synthesis/interpretation** (technical report, 2025) | Closed; "goes down rabbit holes" (developers' own words); human vetting mandatory |
| **Google AI Co-Scientist** (Google DeepMind; Nat. Med. 2026) | Hypothesis generation/ranking via multi-agent tournament | **Closed** (pseudocode + prompts published) | Closed | 3 experimentally validated outputs (AML drug repurpose KIRA6; liver fibrosis vorinostat; cf-PICI gene transfer — the latter a recapitulation of a decade-old unpublished human result) | Requires scientist-in-the-loop framing; closed |
| **Sakana AI Scientist v1/v2; DeepScientist; OpenEvolve; RD-Agent (Microsoft, MIT); AIDE; AgentRxiv/Agent Laboratory** | End-to-end ML research automation | Open (Apache/MIT) | Open | AI Scientist v2: first workshop-accepted fully AI paper (2025); OpenEvolve reproduces AlphaEvolve-style evolutionary coding; RD-Agent top open MLE-Bench performer | ScienceAgentBench/AIRS-Bench/PaperBench all show agents remain unreliable end-to-end (<20% on full replication) |
| **Intern-S1** (Shanghai AI Lab, 2025) | General scientific multimodal FM (235B MoE + 6B vision; 5T tokens incl. 2.5T scientific) | Open weights | Open | Strong cross-domain science benchmark results (2025) | Vendor-reported |
| **TabPFN v2** (Prior Labs; Nature 2025), **TimesFM** (Google; Apache 2.0), **MOMENT** (CMU; MIT) | Tabular & time-series foundation models for scientific data | Open (TabPFN non-commercial-ish for largest; TimesFM/MOMENT permissive) | Open | TabPFN SOTA small-data tabular in one forward pass (Nature 2025) | Small-data domains; TimesFM-type FMs beaten by a zero-parameter baseline on some forecasting suites — verify on your data |
| **AlphaEvolve** (Google DeepMind) | Evolutionary algorithm/code discovery | **Closed** (open reimplementation: OpenEvolve) | Closed | Matrix-multiplication and kernel-optimization discoveries (2025) | Closed; OpenEvolve is the open path |

---

## Cross-cutting observations (evidence-based)

1. **Open-weight general reasoning has closed the gap**: open models now lead several headline benchmarks (Kimi K2 Thinking AIME 2025 99.1% > GPT-5's 95–98% in some harnesses; GLM-5 MIT-licensed). Independent registries (ai-tldr.dev, benchlm.ai, Artificial Analysis) as of Nov 2026.
2. **Weather/climate is the most operationally validated domain**: ECMWF (Feb/Jul 2025, v2 May 2026) and NOAA (Dec 2025/Jan 2026) run open AI models in production, with self-published failure modes (extremes, TC intensity, QBO/SAM).
3. **Protein structure is fully democratized** (Boltz-2/BoltzGen/Protenix/OpenFold3 under MIT/Apache); **design is validated for binding, not function** (Adaptyv 2025 challenge: 0/>1,000 neutralizing).
4. **Single-cell and some "foundation model" claims fail independent baselines** — always run HVG/PCA/linear controls.
5. **Openness spectrum matters**: AF3 (gated weights), UMA (FAIR Chemistry License gate), MedGemma (Gemma terms), NT (CC BY-NC-SA) are "open-weight but restricted"; Boltz, Evo 2, MACE, MatterGen, AIFS, ACE2, NeuralGCM, GPT-OSS, Qwen, GLM are permissively licensed.
6. **Research ≠ deployment**: nothing here is certified for clinical, safety-critical engineering, or wet-lab autonomous use; generative bio/chem capabilities require institutional dual-use review, and this document intentionally provides no operational bio/chem protocols.

## Primary sources (selection)

- Brixi et al., *Genome modelling and design across all domains of life with Evo 2*, Nature 652, 1349–1361 (2026); ArcInstitute/evo2 (Apache-2.0)
- Abramson et al., *AlphaFold 3*, Nature (2024); Wohlwend et al., Boltz-1 (bioRxiv 2024); Passaro et al., Boltz-2 (2025); Stärk et al., BoltzGen (bioRxiv 2025.11.20.689494)
- Yang et al. (MedGemma), *An open vision-language model for diverse medical applications*, Nature Medicine (2026), doi:10.1038/s41591-026-04626-w
- Zeni et al., *MatterGen*, Nature (2025), doi:10.1038/s41586-025-08628-5; Batatia et al., MACE-MP-0, JCP (2025); Wood/Shuaibi et al., *UMA*, arXiv:2506.23971; Levine et al., *OMol25*, arXiv:2505.08762
- Lang et al., AIFS (ECMWF, 2024; operational 2025); Bodnar et al., *Aurora*, Nature (2025); Price et al., *GenCast*, Nature (2024); Watt-Meyer et al., *ACE2*, npj Clim. Atmos. Sci. (2025); Kochkov et al., *NeuralGCM*, Nature (2024); Baxter et al., GRL (2025/26) AI-emulator benchmarking
- Qwen3 Technical Report, arXiv:2505.09388; Kimi K2 Thinking announcement (Moonshot, Nov 2025); DeepSeek-Prover-V2 and Goedel-Prover-V2 papers (2025)
- McCabe et al., *Walrus*, arXiv:2511.15684; Wiesner et al., *GPhyT*, arXiv:2509.13805
- Huang et al., *Biomni*, bioRxiv 2025.05.30.656746 (Science 2026); Mitchener et al., Kosmos technical report (Edison, 2025); Gottweis et al., AI Co-Scientist (Nat. Med. 2026)
- Kedzierska et al. (Genome Biol 2025); Ahlmann-Eltze et al. (Nat Methods 2025); Bendidi et al. (2024) — single-cell FM baseline audits
- Stanford AI Index Report 2026, ch. 5.2 (AI across scientific domains)

*Compiled 2026-11-20. Licenses and access terms change; verify per-artifact license (code vs weights vs data are often different) before use.*
