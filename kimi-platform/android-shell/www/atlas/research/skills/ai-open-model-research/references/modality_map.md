# AI Open-Model Research — Modality Map

Point-in-time snapshot compiled 2026-11-20 from `sota_open_model_landscape.md` and its four domain surveys; positions decay within weeks — re-verify before adoption. Evidence labels: **[V]** vendor-reported, **[I]** independently measured, **[R]** registry-verified. Openness tiers O0–O7 are defined in [licensing_openness.md](licensing_openness.md).

## Contents

1. Language, reasoning, coding — 2. Multimodal, media, documents — 3. Scientific models — 4. 3D, embodied, gaming, security, edge — 5. Cross-domain structural facts

## 1. Language, reasoning, and coding

Four usable tiers; select within a tier, never across tiers.

| Tier | Representative leaders (2026-11-20) | Openness | Headline evidence | Hardware reality |
|---|---|---|---|---|
| Frontier MoE, general/agentic | Kimi K3.1 Pro (2.8T/104B), Kimi K3 | O2 | AA Intelligence Index v5 = 46, top open weight [I, 2026-10-27]; K3: GPQA-D 93.5, FrontierSWE 81.2 [V] | ~1.5 TB weights; 8×B200 minimum [V] |
| Frontier MoE, coding | DeepSeek-V4.1-Flash; GLM-5.3 (753B/40B) | O1 MIT / O2 | TB 2.1 90.6 [V, self-harnessed, unreproduced]; LiveBench agentic-coding #1 [I]; GLM-5.3 AA idx 45 [I, 2026-09-07] | ~511–515 GB at Q4 [V] |
| Server "small" | Mistral Small 4 (119B/6.5B), Qwen3.5-397B-A17B | O1 Apache | AA idx 11 with reasoning [I, 2026-10-14]; Qwen3.5: 76.2% SWE-bench Verified [V] | ~72 GB Q4 (Small 4) |
| Single-GPU coding | Qwen3.8-27B (dense), Qwen3.6-35B-A3B, Devstral 2 | O1 Apache | SWE-bench Pro 61.7, TB 2.1 73.0 [V]; ~81% SWE-bench Verified per Vals [I, Sep 2026] | 24–48 GB cards |
| Edge/on-device | Gemma 4 E2B/E4B, 26B-A4B; gpt-oss-20b; Qwen3.5-0.8–9B; Phi-4-mini; LFM3-1.7B; MiniCPM5-2B | O1 | Gemma 4 31B: MMLU-Pro 85.2, AIME'26 89.2 [V]; gpt-oss-20b ≈ o3-mini class [V] | 1.5–16 GB |
| Reasoning specialists | GLM-5.2 (MIT): AIME'26 99.2 [V]; DeepSeek-V3.2; Nemotron 3 Nano 30B | O1 | Verbosity tax: GLM-5.3 burned 210M output tokens on AA index vs 120M median [I] — price/quality rankings invert when token spend is counted | Nano 30B targets Jetson/DGX Spark |
| Long context (1M advertised standard) | Kimi K3 line, DeepSeek V4, GLM-5.2/5.3, MiniMax M3, Mistral Large 4, Llama 4 Scout (10M advertised) | mixed | Independent long-context reliability lags marketing (AA-LCR: Kimi K3 74.7) [I]; treat max context as capacity, not recall | KV-cache cost dominates |

Domain caveats: SWE-bench Verified is saturated at the frontier — discriminating signal moved to SWE-bench Pro, FrontierSWE, DeepSWE v1.1, Terminal-Bench 2.1–4.0. Open still trails closed on the hardest agentic tasks (Kimi K3 FrontierSWE 81.2 vs Claude Fable 5's 86.6 [V]). Benchmark strength decouples from formal reasoning (DeepSeek-V3.1: 66.0 SWE-bench Verified but 7.93% on formal spec generation). Ecosystem lag is real for new architectures (V4.1-Flash lacks llama.cpp/GGUF support; Kimi K3's MXFP4 needs recent vLLM/SGLang).

## 2. Multimodal, media, and document intelligence

Central finding: **specialists beat generalists wherever a focused benchmark exists** — sub-1.5B OCR models out-parse 235B VLMs; 0.6B ASR models top English transcription.

| Sub-domain | Permissive leader(s) (O0/O1) | Restricted-but-stronger | Evidence anchor | Key caveat |
|---|---|---|---|---|
| Vision-language | Qwen3-VL-235B-A22B & 2B–32B (Apache); InternVL3.5; Molmo2 (O0, open data) | closed Gemini/GPT still top general reasoning | arXiv:2511.21631 [V] + FlagOS rerun (MMMU 70.4/OCRBench 91.8) [I] | Vendor headline evals; ScreenSpot-Pro trails GUI specialists |
| Image generation | Z-Image Turbo (Elo 937), Qwen-Image-2512 (best text rendering), FLUX.2 [klein] 4B | H3-Image #1 (1066, US/EU/UK/KR-excluded); Qwen-Image-2.1 (1047, research-only); FLUX 3 Klein (1041, <$5M cap) | AA open-weights T2I/editing boards [I, Nov 2026] | Closed leaders sit ~200+ Elo above best open; Qwen-Image-Edit is a published jailbreak target — deploy with moderation |
| Video generation | Wan2.2 family (Apache; TI2V-5B: 720p24 in <9 min on one consumer GPU [V]) | MiniMax H3 (T2V Arena ~1238–1240, territory-excluded); LTX-2.5 ($10M cap) | Wan2.2 README efficiency table [V]; Arena I2V open Elo 1171 [I, Nov 2026] | ~5s clips; Wan 2.5+ hosted-only; watermarking (C2PA/SynthID) is the deployer's job |
| ASR | Parakeet TDT 0.6B v3 (CC-BY; 6.34% avg WER [I]); Whisper large-v3 (MIT, 99 langs); Qwen3-ASR (Apache, 52 langs, streaming) | Nemotron streaming (OpenMDW) | HF Open ASR Leaderboard [I] | Clean-audio WER understates accents/noise; Whisper hallucinates in silence (documented) |
| TTS/voice | Ming-3.0-tts (MIT, Elo 1188 — best freely-shippable [I]); Qwen3-TTS (Apache, 3s cloning) | Fish Drama 3 (1245, <$500k cap); Breeze TTS 2 (1215+, research-only) | AA Voice/TTS Elo [I, Oct–Nov 2026] | Chatterbox retired Aug 2026; Kokoro unmaintained; cloning raises consent duties |
| Speech-to-speech | Moshi (7B, code MIT + CC-BY weights) | PersonaPlex-7B (gated), VoiceChat 11B (OpenMDW) | Big Bench Audio: open 4–27% vs ~90% closed [I/V] | Production voice agents still run ASR→LLM→TTS cascades |
| Audio/music | ACE-Step 1.5 (MIT, <4 GB VRAM); Qwen3-Omni-30B-A3B (Apache; open SOTA on 32/36 audio benchmarks per tech report [V]) | YuE2 (CC BY-NC); MiniMax Music 3.0 (>$20M) | Independent arXiv:2604.24954 shows Nemotron 3 Nano Omni edging Qwen3-Omni [I] | Music licensing is the main trap; MusicGen weights are CC-BY-NC |
| OCR/documents | PaddleOCR-VL-1.6 (Apache, 96.34), GLM-OCR (MIT, 95.22), OvisOCR2 (Apache, 96.47), DeepSeek-OCR-2 (Apache) | OXR-1.0 (#1, 97.03, Apache + $2M terms); MinerU2.5-Pro (>$100M MAU/$20M clauses) | OmniDocBench v1.6 [I, Oct–Nov 2026] | Top scores within noise; test on your own documents |
| GUI/computer-use | OpenCUA-72B (MIT incl. data; OSWorld-V 45.0% [I, Oct 2025]); UI-TARS-1.5-7B (Apache); Agent S3/S4 framework (Apache; lifts Qwen3.8-27B 5.6%→21.3% on OSWorld 2.0 at $1.10/task [V/arXiv]) | GUI-Owl-1.5 (MIT but 56.5% self-reported — verify); Holo4 (metric ambiguity) | OSWorld version caveat: 2024 ≠ Verified ≠ 2.0 — not comparable | `--enable_local_env` executes arbitrary code — sandbox; screen-content prompt injection is an open risk |

Domain caveats: sub-10B models cover most production media workloads on 8–24 GB GPUs. Territorial exclusions are the newest license weapon (MiniMax H3/H3-Image, Hunyuan3D 2.1 exclude major Western markets). Maintenance status is part of fitness — a stale repo is a supply-chain and support risk.

## 3. Scientific models

The domain where openness is deepest (several O0 full-open pipelines) and the vendor-vs-independent gap most instructive.

| Field | Reference open artifacts | Openness | Evidence anchor | High-stakes restriction |
|---|---|---|---|---|
| Math — informal | Kimi K2 Thinking (AIME'25 99.1% w/ tools [V]); gpt-oss-120b/20b; DeepSeek-V3.2; GLM-4.7 (MIT) | O1/O2 | AIME registry (ai-tldr.dev) [I] | Tool-augmented scores ≠ pure reasoning |
| Math — formal (Lean 4) | DeepSeek-Prover-V2 (MIT); Goedel-Prover-V2 (Apache; 8B matches 671B at 84.6% miniF2F [V]) | O1 | Papers, 2025 | Lowest-risk domain: outputs machine-checkable |
| Physics | Walrus (MIT, code+weights+The Well data — O0); GPhyT; AION-1; TORAX (Apache) | O0–O1 | arXiv:2511.15684; NeurIPS 2025 | Research surrogates — not validated for reactor control or engineering sign-off |
| Climate/weather | AIFS (ECMWF, operational since Feb 2025); Aurora (MIT; beats IFS HRES on 92% of combos [V/journal]); GenCast; ACE2 (Apache, O0); NeuralGCM; NOAA AIGFS/AIGEFS (operational Dec 2025/Jan 2026) | O0–O1 | ECMWF/NOAA operational scorecards [I-operational] | Most operationally validated domain, but decision-support only — warnings remain with national meteorological services |
| Materials | MatterGen (MIT, Nature 2025; TaCr₂O₆ synthesized); MACE-MP-0 (MIT); ORB; MatterSim | O1 | Matbench Discovery [I]; OOD skew found in generated candidates (2026) | Generated candidates are hypotheses for DFT + lab validation, not certified materials |
| Chemistry | Uni-Mol2 (1.1B; verify non-commercial-leaning terms); IBM FM4M/SMI-TED (Apache, O0-class); ChemDFM-R | O1–O4 | ChemEval (partially self-built) [V] | Dual-use: institutional biosafety/chemsafety review before any wet-lab use; no operational protocols |
| Protein structure/design | Boltz-2 (MIT, fully open; ~AF3-level, CASP16 affinity winner), BoltzGen, Protenix, OpenFold3, RFdiffusion3, ProteinMPNN; AlphaFold 3 = gated | O0/O1 vs O5 | Nature 2024 (AF3); CASP16 [I] | Design validated for binding, not function (Adaptyv 2025: 0/>1,000 neutralizing [I]); IBC review + sequence screening before physical realization |
| Genomics | Evo 2 (Apache — weights + code + 8.8T-bp OpenGenome2; Nature 2026), among the largest fully open models in any domain; HyenaDNA; GENA-LM; Nucleotide Transformer (CC BY-NC-SA); AlphaGenome (gated) | O0 vs O4/O5 | Nature 2026; Nature Methods 2025 | Eukaryotic viruses deliberately excluded from Evo 2 training; variant interpretation is research-grade, not diagnostic |
| Single-cell | scGPT, Geneformer, scFoundation, UCE, SCimilarity, TranscriptFormer | O1 | Seven-plus independent audits: FMs do NOT consistently beat HVG/PCA/linear baselines [I] | Mandatory baseline controls; never report FM-only results |
| Medical | MedGemma 4B/27B (Gemma terms; ReXVQA 83.84 vs 77.27 best radiology resident [I]); Med42-v2 (Llama license); Meditron-FO (first fully open pipeline) | O2/O5 | Peer-reviewed + independent evals | None is a medical device (<20 FDA-cleared LLM devices as of May 2026); research use only; MedGemma CXR: 81% reports equal/superior overall but only 49% for abnormal studies |
| Discovery agents | Biomni (Apache; LAB-Bench DbQA 74.4% ≈ expert humans [V/journal]); Sakana AI Scientist, OpenEvolve, RD-Agent | O1 | BioML-bench: agents underperform human baselines on average [I]; ScienceAgentBench/PaperBench <20% full replication [I] | Biomni executes LLM-generated code with full privileges — sandbox; Kosmos/AI Co-Scientist/AlphaEvolve hosted-only |

Domain caveats: weather/climate and protein structure are the two fields where open models are operationally ahead or at parity. Gating concentrates exactly where commercial value concentrates (AF3 weights, UMA potentials, AlphaGenome, MedGemma terms). The single-cell caution generalizes: absent an independent baseline audit, assume the baseline wins.

## 4. 3D, embodied, gaming, security, and edge

| Sub-domain | Reference open artifacts | Openness | Evidence anchor | Key caveat |
|---|---|---|---|---|
| Image-to-3D | TRELLIS.2-4B (MIT; 1536³ voxel, ~3s@512³ on H100 [V]); SAM 3D Objects/Body (SAM License, gated); TripoSR (MIT, ~6 GB); Hi3D (geometry-only) | O1/O5 | arXiv:2512.14692; no independent apples-to-apples vs Hunyuan3D exists | Hunyuan3D 2.1 stronger in pipeline but EU/UK/KR-excluded; TRELLIS.2 needs ≥24 GB, Linux, deps carry separate NVIDIA terms |
| Blender/graphics | No "Blender foundation model" exists — SOTA is a pipeline: official Blender MCP + TRELLIS.2/Hunyuan3D generation + UniRig/SOMA-X rigging | O1 tools | blender.org Jan 2026; BlenderRAG arXiv:2605.00632 | MCP means arbitrary `bpy` execution — treat connected LLMs as code-execution agents |
| Game world models | Matrix-Game 3.0/4.0 (Apache; 720p@40fps real-time; GameWorld Score open benchmark); LingBot-World v1 (Apache) | O1 | v1 beat Oasis/MineWorld on all GameWorld Score dims [V/paper, Jun 2025] | LingBot-World 2.0 flipped to CC BY-NC-SA — a mid-family license regression blocking game-studio embedding |
| NPC stack | Pipeline, not a model: Qwen3-8B/Gemma 4 26B-A4B + Qwen3-TTS + lip sync; Mantella mod (2,500 NPCs) as canonical example | O1 | Community/secondary | Fish Speech 1.5 weights CC-BY-NC-SA — prototyping only |
| Robotics VLA | GR00T N1.7-3B (Apache; GR-1 language-following 46.6%→93.3% N1→N1.5 [V]); openpi π0/π0.5 (Apache; ALOHA 77.1% real-robot [paper]); OpenVLA-OFT (MIT; LIBERO 97.1% [paper]) | O1 | GR00T 2 white paper reports +236 Elo over π0.5 in paired evals [V, pre-release] | π0.5's open repo lacks RECAP/memory capabilities; OpenVLA authors warn base models "may or may not work" on other robots |
| World models (planning) | V-JEPA 2/2.1 (MIT; ~16s/action planning vs ~4 min latent-diffusion [V]); NVIDIA Cosmos (Open Model License; training data not open) | O1/O2 | arXiv:2506.09985 | Latent world-model planning reliability degrades beyond ~5–10 control steps [I, Sep 2026] |
| Autonomous driving research | Alpamayo 1 / R1-10B + AlpaSim + 1,700 h open driving data; OpenEMMA; TIER IV Autoware E2E | O1 | nuScenes open-loop evals [V/paper] | Not a deployable driving stack; closed-loop safety is the integrator's responsibility |
| Cybersecurity (defensive) | Foundation-Sec-8B(-Instruct/-Reasoning; Llama+Apache dual license; matches Llama-3.1-70B/GPT-4o-mini on several security tasks at 8B [V]); Llama-Primus family; SecureBERT 2.0; Aikido Altar 1 (vendor benchmarks only) | O1/O2 | CTIBench/CyberMetric [V] | Open models trail frontier closed widely on offensive tasks (top open ~19.5% vs 59% NYU CTF Bench [SECONDARY, Apr 2026]); outputs need analyst verification; defensive-only framing |
| Edge inference | gpt-oss-20b (16 GB); Gemma 4 E2B (1.5 GB Q4); LFM2/2.5/3 (2× CPU speed vs Qwen3 [V]); runtimes: llama.cpp, MLX (20–87% faster than llama.cpp <14B [V]), vLLM/SGLang, ExecuTorch, Lemonade | O1 | Vendor + community measurements | Q4_K_M ≈ 0.65 GB/B params at ~97–98% FP16 quality for ≥7B; below Q3 degrades sharply |

Domain caveats: genuine open foundation models now exist in 3D (TRELLIS.2), robotics (GR00T, π0.5), and driving research (Alpamayo) — but Blender and NPC work remain composable pipelines. Robotics/AV evidence is the least independent in the landscape (GR00T 2's claims are pre-release vendor evaluations).

## 5. Cross-domain structural facts

1. **Full open source (O0) is rare and concentrated** — language (two small models), scientific computing (weather, proteins, genomics), one VLM family; no frontier-scale LLM discloses training data.
2. **The license–quality relationship inverts by domain** — the strongest open image/video weights carry non-permissive terms, while permissive sub-1.5B specialists top OCR and English ASR outright. The permissive tier, not the arena leaderboard, is the operative frontier for most builders.
3. **Quarantine is a first-class tier** — exclusion-by-policy of exactly-verified artifacts (wrong provenance, dead license links, remote-code requirements) is the standard to adopt.
4. **Evidence asymmetry is the central reading skill** — vendor self-reports dominate coding-agent, GUI-agent, image-editing, TTS-latency, and music claims; known negative results are equally load-bearing.
