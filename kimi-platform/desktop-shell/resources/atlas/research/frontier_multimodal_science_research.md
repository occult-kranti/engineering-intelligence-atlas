# Frontier Multimodal & Scientific AI Literature Review (2025–2026, with Seminal Foundations)

**Compiled:** 2026-11-20 · **Records:** 38 · **Companion dataset:** `frontier_multimodal_science_papers.json`

## Scope & Method

This review surveys Tier-A literature across eight areas: computer vision, multimodal (vision-language) models, video generation, speech/audio, robotics/embodied AI, generative 3D, AI-for-science (biology/chemistry/physics/climate), and scientific foundation models. Sources are restricted to arXiv and official venues: CVPR/ICCV/ECCV, NeurIPS/ICML/ICLR/CoRL, SIGGRAPH, Nature/Science/Nature Methods, and bioRxiv for first-release biology preprints.

**Verification protocol (applied to every record):**
- arXiv IDs resolved to the exact title via the official arXiv API.
- Journal/preprint DOIs resolved via Crossref (title, volume, issue, pages confirmed).
- Publisher, code, and model-hub links checked against official organization pages/repositories.
- Verification date for all records: **2026-11-20**.

**Safety note:** Biology/chemistry records are bibliographic metadata only — methods are described at the level of the published abstracts, with no operational protocols, wet-lab instructions, or optimization guidance for biological agents. All AI-generated biological/chemical hypotheses require experimental validation.

## 1. Computer Vision (foundations & encoders)

| Model | Venue/Status | Why it matters |
|---|---|---|
| CLIP (Radford et al.) | ICML 2021 | Seminal contrastive image-text pretraining; backbone of open-vocabulary perception and diffusion conditioning |
| Latent Diffusion Models (Rombach et al.) | CVPR 2022 | Latent-space diffusion; basis of Stable Diffusion and modern generative media |
| DINOv2 (Oquab et al.) | TMLR 2024 | Universal frozen self-supervised features; data-curation-centric SSL |
| DINOv3 (Simeoni et al.) | arXiv/ICCV 2025 | Gram anchoring fixes dense-feature degradation; SSL scaled to 7B params |
| SAM 2 (Ravi et al.) | Meta 2024 | Promptable segmentation unified across images and video + SA-V dataset |
| Depth Anything V2 (Yang et al.) | NeurIPS 2024 | Synthetic-label + pseudo-label recipe for robust zero-shot depth |

**Trend:** the field consolidated around *frozen foundation backbones* (DINOv2/v3, CLIP) that downstream VLMs, video models, and robot policies consume, while SAM 2 and Depth Anything supply geometry/mask priors for 3D, video, and robotics pipelines.

## 2. Multimodal (Vision-Language) Models

| Model | Size/Access | Key contribution |
|---|---|---|
| Qwen2.5-VL (Alibaba) | 3B–72B, open (Apache 2.0 for 7B) | Native dynamic resolution, absolute-time MRoPE, hour-long video, GUI agent SOTA |
| Gemma 3 (Google) | 1B–27B, open weights (Gemma ToU) | Frontier-class multimodal quality at single-GPU scale, 128K context |
| InternVL3 (OpenGVLab) | 1B–78B, MIT | Native joint multimodal pretraining + MPO + test-time scaling recipes |
| Molmo/PixMo (AI2) | 7B/72B, Apache 2.0 | Fully open data recipe; quality-over-scale (pointing/counting supervision) |
| Janus-Pro (DeepSeek) | 1B/7B, MIT code | Unified understanding + generation in one AR transformer |

**Trend:** 2025 open VLMs reached parity with 2024 proprietary systems on most benchmarks. Differentiation moved to *grounding, document parsing, long video, GUI agency*, and unifying generation with understanding. Remaining gaps: hallucination, counting, fine OCR, true multi-hour temporal reasoning.

## 3. Video Generation

- **Sora / "Video generation models as world simulators"** (OpenAI, 2024, tech report): spacetime-patch diffusion transformer; established video scaling laws narrative and the world-simulator framing. Closed; Sora 2 followed in Sep 2025.
- **Movie Gen** (Meta, 2024): 30B flow-matching video + 13B audio model family; the most detailed closed-model engineering account; no weights.
- **HunyuanVideo** (Tencent, 2024): first 13B open-weights video foundation model; community fine-tuning base.
- **Wan 2.1** (Alibaba, 2025): Apache-2.0 T2V/I2V suite incl. a 1.3B consumer-GPU model; current open baseline.

**Trend:** open/closed capability gap narrowed to months; research focus shifted to controllability, audio-video joint generation, longer horizons, and using video models as world models for robotics and simulation.

## 4. Speech & Audio

- **Whisper** (OpenAI, ICML 2023): seminal 680k-hour weakly supervised ASR; universal audio front-end.
- **SeamlessM4T v2** (Meta, 2023): ~100-language expressive + streaming speech-to-speech translation (non-commercial weights).
- **Moshi** (Kyutai, 2024): first open full-duplex speech-text dialogue model (Mimi codec, ~200 ms latency).
- **Qwen2-Audio** (Alibaba, 2024): natural-language-prompted universal audio understanding on an LLM backbone.

**Trend:** from cascaded ASR→LLM→TTS to end-to-end full-duplex spoken dialogue and omni-modal audio understanding.

## 5. Robotics / Embodied AI

| Model | Venue | Contribution |
|---|---|---|
| RT-2 (Google DeepMind) | CoRL 2023 | Seminal VLA: web-scale VLM knowledge → robot actions as tokens |
| OpenVLA (Stanford et al.) | CoRL 2024 | First strong open VLA (7B, MIT); community fine-tuning substrate |
| π₀ (Physical Intelligence) | CoRL 2024 | Flow-matching VLA; 50 Hz continuous actions; dexterous long-horizon tasks |
| GR00T N1 (NVIDIA) | 2025 tech report | Open humanoid foundation model; fast/slow dual-system (VLM + DiT action head) |

**Trend:** the VLA paradigm matured from proof-of-concept (RT-2) to open generalist policies (OpenVLA, π₀ via openpi) and humanoid foundation models. Open problems: cross-embodiment transfer, proprioception/history, robust long-horizon success rates, real-time inference.

## 6. Generative 3D

- **3D Gaussian Splatting** (Inria, SIGGRAPH 2023): seminal explicit radiance-field representation enabling real-time novel-view synthesis; now the backbone of 4D/dynamic reconstruction and feed-forward 3D generation.
- **TRELLIS** (Microsoft, CVPR 2025): structured 3D latents (SLAT) + rectified-flow transformers; open MIT-licensed text/image-to-3D foundation model decodable to Gaussians/meshes/NeRFs.

**Trend:** convergence of reconstruction (3DGS) and generation (latent diffusion over structured 3D), moving from object-centric assets toward scene- and world-level generation.

## 7–8. AI for Science & Scientific Foundation Models

### Structural biology
- **AlphaFold 2** (Nature 2021; Nobel 2024) — seminal single-chain structure solution.
- **AlphaFold 3** (Nature 2024) — diffusion-based prediction of proteins + nucleic acids + ligands; restricted non-commercial weights.
- **Boltz-1** (MIT, bioRxiv 2024) — fully open (MIT) AF3-class reproduction; **Chai-1** (bioRxiv 2024) — open-weights AF3-class model with MSA-free mode and restraint conditioning.

### Generative biology & genomics
- **ESM3** (Science 2025) — promptable multimodal protein generation; wet-lab-validated fluorescent protein 58% from natural space.
- **Evo 2** (Arc/NVIDIA, bioRxiv 2025; Nature 2026) — 40B open genome foundation model (StripedHyena 2, 9.3T bp, 1 Mb context) for interpretation and design across all life.
- **AlphaGenome** (DeepMind, bioRxiv 2025; Nature 2026) — unified 1 Mb sequence-to-function variant-effect prediction, SOTA on 25/26 benchmarks.
- **scGPT** (Nature Methods 2024) — first widely adopted single-cell multi-omics foundation model (33M cells).

### Weather & climate
- **GraphCast** (Science 2023) — first learned model beating ECMWF HRES at global medium-range forecasting.
- **NeuralGCM** (Nature 2024) — hybrid differentiable physics + learned parameterizations for weather *and* climate.
- **Aurora** (Microsoft, Nature 2025) — first atmospheric foundation model; fine-tunes to air quality, cyclones, waves.

### Materials
- **GNoME** (DeepMind, Nature 2023) — active-learning GNN discovery of 2.2M candidate stable crystals.
- **MatterGen** (Microsoft, Nature 2025) — property-conditioned diffusion inverse design of inorganic materials, with experimental synthesis validation.

**Trend:** the AlphaFold recipe generalized into *domain foundation models* — proteins (ESM3), genomes (Evo 2, AlphaGenome), cells (scGPT), atmosphere (Aurora, NeuralGCM, GraphCast), and materials (MatterGen). Common pattern: large self-supervised pretraining on domain corpora + cheap task adaptation + (increasingly) closed-loop experimental validation.

## Cross-cutting Observations

1. **Convergence of recipes:** contrastive/masked self-supervision + transformer backbones + diffusion/flow decoding now spans images, video, audio, actions, molecules, and crystals.
2. **Open vs closed:** permissive open releases (Wan, OpenVLA, openpi, Boltz-1, TRELLIS, Aurora, MatterGen, Evo 2) now drive community progress; frontier closed systems (Sora 2, Gemini/Veo, AlphaFold server) set the ceiling.
3. **Benchmark saturation & shift:** static VQA/ASR/ImageNet-style benchmarks are saturating; evaluation is moving to agents (OSWorld), long video, human-preference arenas, and *experimental validation* in science.
4. **Persistent limitations:** hallucination (VLMs, ASR), physical/causal consistency (video), cross-embodiment generalization (robotics), distributional shift and wet-lab success rates (science models).
5. **Safety/licensing:** science models increasingly ship with responsible-release frameworks and non-commercial terms; several bio models are API-gated. Records here are intentionally non-operational.

## Verification Log

- arXiv API title checks: 2502.13923, 2503.19786, 2504.10479, 2501.17811, 2409.17146, 2408.00714, 2406.09414, 2412.03603, 2503.20314, 2410.13720, 2212.04356, 2312.05187, 2410.00037, 2407.10759, 2307.15818, 2410.24164, 2406.09246, 2503.14734, 2308.04079, 2412.01506, 2212.12794, 2311.07222, 2405.13063, 2312.03687, 2103.00020, 2304.07193, 2112.10752, 2508.10104 — all matched.
- Crossref DOI checks: 10.1038/s41586-021-03819-2, 10.1038/s41586-024-07487-w, 10.1126/science.ads0018, 10.1101/2025.06.25.661532, 10.1101/2025.02.18.638918, 10.1038/s41592-024-02201-0, 10.1101/2024.11.19.624167, 10.1101/2024.10.10.615955, 10.1126/science.adi2336, 10.1038/s41586-024-07744-y, 10.1038/s41586-025-09005-y, 10.1038/s41586-025-08628-5, 10.1038/s41586-023-06735-9 — all matched (titles/volumes/pages).
- Official report pages: OpenAI Sora tech report page; code/model hubs (GitHub/HuggingFace orgs) as listed per record.
