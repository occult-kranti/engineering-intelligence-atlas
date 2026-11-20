# Open-Weight / Open-Source SOTA Models — Research Survey

**Date:** 2026-11-20
**Scope:** 3D generation/reconstruction, Blender/graphics workflows, gaming/NPC/simulation, robotics/embodied AI/world models, autonomous driving research, cybersecurity, and efficient/on-device inference.
**Method:** 7 distinct web search rounds querying primary model cards, papers, official repos, and vendor announcements. Sources cited inline. Foundation models are distinguished from tool pipelines where relevant.

---

## 1. 3D Generation / Reconstruction

### 1.1 TRELLIS.2 (Microsoft) — Foundation model
- **Repo / Weights:** [github.com/microsoft/TRELLIS.2](https://github.com/microsoft/TRELLIS.2); weights `microsoft/TRELLIS.2-4B` on Hugging Face. Paper: "Native and Compact Structured Latents for 3D Generation" (arXiv:2512.14692), tech report Dec 2025.
- **Application:** Single image-to-3D generation producing PBR-textured meshes (GLB export) at up to 1536³ voxel resolution; also shape-conditioned texturing of existing meshes.
- **License / access:** MIT for model and code. Caveat: rendering dependencies `nvdiffrast` and `nvdiffrec` carry separate NVIDIA license terms. Framed as a "research project" in Responsible AI notes.
- **Openness:** Code, weights (4B), training code, and a Hugging Face Space demo all public. Training data not released.
- **Benchmark evidence:** ~3s at 512³, ~17s at 1024³, ~60s at 1536³ on an H100 (vendor-measured). Repo passed 11k GitHub stars within ~9 months. No independent apples-to-apples benchmark vs. Hunyuan3D exists.
- **Hardware/runtime:** Linux only; ≥24 GB VRAM (verified A100/H100); CUDA 12.4 recommended; native ComfyUI support since v0.34.0 (Aug 2026).
- **Limitations/safety:** Model card warns raw meshes may contain small holes / minor topological discontinuities (hole-filling step provided for 3D printing); 4B checkpoint is a base model not aligned to human preferences; single-image input only (no text-to-3D, no multi-view in this checkpoint).

### 1.2 Hunyuan3D 2.1 (Tencent) — Foundation model
- **Repo / Weights:** [github.com/Tencent-Hunyuan/Hunyuan3D-2.1](https://github.com/Tencent-Hunyuan/Hunyuan3D-2.1); weights on HF `tencent/Hunyuan3D-2.1`. Released June 2025.
- **Application:** Image-to-3D and text-to-3D shape generation plus a dedicated Hunyuan3D-Paint stage producing PBR materials (albedo/metallic/roughness) baked to 4096-px maps from up to 9 views. Multi-view input supported.
- **License / access:** Tencent Hunyuan 3D 2.1 Community License — **not** MIT/Apache. Key restrictions: territory excludes EU, UK, South Korea; products over 1M MAU must request a separate license; outputs may not be used to train non-Hunyuan models.
- **Openness:** Open weights and inference code; training data not public. The newer Hunyuan3D 2.5 (arXiv:2506.16504) is hosted/report-only, not open-weight.
- **Benchmark evidence:** Hunyuan3D 2.0 report describes meshes as holeless; 2.1 leads open-source baselines on ULIP/Uni3D similarity metrics per the Hunyuan3D 2.5 paper's comparison table. ~14.8k GitHub stars on the flagship repo (Sep 2026 snapshot).
- **Hardware/runtime:** Shape-only fits in ~10 GB VRAM; full shape+texture pipeline needs ~29 GB; README lists Windows/macOS/Linux support; distilled Turbo/Fast variants exist in the 2.0 family; community ComfyUI and Unity integrations.
- **Limitations/safety:** Heaviest local setup of the open 3D generators; no opacity channel (glass/foliage approximated); open repos quiet since late 2025 (newer open work went to sibling projects Hunyuan3D-Omni / Hunyuan3D-Part); regional license exclusions are a hard stop for EU/UK builders.

### 1.3 SAM 3D Objects / SAM 3D Body (Meta) — Foundation model
- **Repo / Weights:** [github.com/facebookresearch/sam-3d-objects](https://github.com/facebookresearch/sam-3d-objects) and [sam-3d-body](https://github.com/facebookresearch/sam-3d-body); HF `facebook/sam-3d-objects` (gated). Paper arXiv:2511.16624 ("SAM 3D: 3Dfy Anything in Images"); Body checkpoints released 2025-11-19.
- **Application:** Single-image 3D object reconstruction (mesh recovery from photos, incl. occluded scenes) and human body/shape recovery; used for extracting props/assets from environmental photos.
- **License / access:** SAM License (permissive, similar to Apache 2.0, free for commercial use); HF download is gated behind license acceptance.
- **Openness:** Inference code and checkpoints public; full training data not released.
- **Benchmark evidence:** Released Nov 2025; vendor-reported SOTA on single-image 3D reconstruction; DINOv2-based ViT encoder variants (ViT-S/B/L/G).
- **Hardware/runtime:** GPU recommended; browser demo available via Meta's playground; encoder integration into HF Transformers proposed (issue #42464).
- **Limitations/safety:** Gated access (license acceptance); encoder-only Transformers integration pending; full generative pipeline better suited to Diffusers per community discussion.

### 1.4 TripoSR (Stability AI / Tripo) — Lightweight baseline
- **Repo / Weights:** [github.com/VAST-AI-Research/TripoSR](https://github.com/VAST-AI-Research/TripoSR); paper arXiv:2403.01133 (Mar 2024).
- **Application:** Fast single-image feed-forward 3D reconstruction (<0.5s on A100).
- **License:** MIT (no MAU cap, no regional exclusion).
- **Openness:** Code + weights + HF Space fully open.
- **Hardware/runtime:** ~6 GB VRAM, CPU fallback available.
- **Limitations:** Vertex colors only (no PBR); single-view, no reasoning about occluded parts; Stability now steers users to successor SF3D. Best used as a fast iteration pass before a heavier model.

### 1.5 Hi3D V1.0 (formerly Sparc3D) — Foundation model (newly open)
- **Repo / Weights:** Public GitHub repo + 8 HF weight files (~3.7 GB ×2 transformers); released 2026-10-23.
- **Application:** Image-guided mesh refinement — takes a reference image + coarse mesh and refines to 512/1024/1536 grid geometry (geometry only, no textures).
- **License:** Commercial use allowed; license disclaims output ownership/non-infringement guarantees (user bears copyright risk).
- **Openness:** Inference code + weights open; **training code and eval setup not included**. Trained on ~2M curated 3D assets (sources unnamed; predecessor Sparc3D used 500k Objaverse/Objaverse-XL assets).
- **Hardware/runtime:** Linux + recent NVIDIA GPU; validated only on a 96 GB datacenter card at highest setting.
- **Limitations/safety:** "Plausible completion" for occluded regions; provenance/copyright risk on training data is a noted community concern.

---

## 2. Blender / Graphics Workflows

This domain is dominated by **tool pipelines and integrations** rather than standalone foundation models. The key pattern in 2026 is LLM/agent control of Blender via MCP plus open 3D generators plugged in as asset sources.

### 2.1 Blender MCP / Blender Lab (Blender Foundation) — Tool pipeline
- **Repo:** Blender Foundation's official roadmap (blender.org, "Projects to Look Forward to in 2026", Jan 2026) announces an official **MCP server for Blender** under the "Blender Lab" initiative, communicating via the existing Python API (`bpy`).
- **Application:** Natural-language control of Blender — scene graph read/write, code generation/execution, asset import — letting LLMs (Claude, GPT, etc.) drive modeling.
- **License/access:** Blender is GPL open-source; MCP integration follows suit. Community MCP add-ons (e.g., `blender-ai-mcp`) already shipped with scene inspection, object creation, viewport screenshot, and `execute_code` tools, with asset integrations (Poly Haven, Sketchfab, Poly Pizza).
- **Limitations/safety:** Arbitrary Python execution inside Blender is powerful but **not a security sandbox** — tool validation catches disallowed operations but users must treat connected LLMs as code-execution agents. Named undo steps and operation approvals are built-in mitigations.

### 2.2 BlenderRAG — Research tool pipeline
- **Paper:** arXiv:2605.00632 (May 2026), "High-Fidelity 3D Object Generation via Retrieval-Augmented Code Synthesis."
- **Application:** Native Blender add-on; retrieves similar examples from a Qdrant vector DB (Nomic-AI embeddings), then has an LLM (Claude Sonnet 4.5 / GPT-5 / Gemini 3 Flash / Mistral Large — user-selected) generate executable `bpy` code in-scene.
- **Openness:** Add-on code described in paper; relies on closed third-party LLM APIs for generation — the pipeline is open, the brains are not.
- **Limitations:** Output quality bounded by the underlying LLM's Blender API knowledge; iterative refinement loop expected.

### 2.3 TRELLIS.2 / Hunyuan3D inside Blender — Foundation models as pipeline components
- **StableGen** (community add-on) brings TRELLIS.2 text-to-3D and image-to-3D directly into Blender at up to 1536³. Community ComfyUI↔Blender workflows and Unity integrations are linked from official READMEs.
- **Auto-rigging for generated meshes:** UniRig and NVIDIA SOMA-X (both open) are the 2026-standard open tools for skeleton/skinning of AI-generated meshes, replacing Mixamo in open pipelines.
- **Assessment:** For Blender-centric asset work, the practical open stack in late 2026 is: TRELLIS.2 or Hunyuan3D 2.1 (generation) → Blender + Geometry Nodes (cleanup/procedural detail) → UniRig/SOMA-X (rigging). Each stage is a separate open model/tool; there is no single open "Blender foundation model."

---

## 3. Gaming / NPC / Simulation

### 3.1 Matrix-Game 3.0 / 4.0 (Skywork AI) — World model (foundation model)
- **Repo / Weights:** [github.com/SkyworkAI/Matrix-Game](https://github.com/SkyworkAI/Matrix-Game); HF `Skywork/Matrix-Game-3.0`. Papers: v1 arXiv:2506.18701 (Jun 2025), v3 arXiv:2604.08995 (Apr 2026).
- **Application:** Real-time interactive world model for games/simulation — keyboard/mouse action-conditioned video generation; v3.0 does 720p @ 40 FPS with minute-scale memory consistency; v4.0 pairs a causal video model with an executable game engine (engine owns physics/gameplay, model renders) with three scene checkpoints (Medieval Castle, Ancient Egypt, City Racing).
- **License:** Apache 2.0 (per HF metadata `license:apache-2.0`); weights and code open.
- **Openness:** Weights, code, and the GameWorld Score benchmark are open. Built on Wan2.2-TI2V-5B base.
- **Benchmark evidence:** v1 outperformed open Minecraft world models Oasis and MineWorld on all GameWorld Score dimensions with >88% keyboard-action accuracy and >89% camera-control accuracy (paper, Jun 2025). v3.0: 5B distilled model at 3 sampling steps for real-time; 28B MoE variant for fidelity; ~16× sampling speedup vs 50-step base.
- **Hardware/runtime:** Linux + NVIDIA GPU; single-GPU inference paths published for A100, RTX 5090/5080/5070 Ti (v4.0); INT8 quantization for real-time mode.
- **Limitations:** English-optimized prompts; 28B tier needs datacenter-class memory (64 GB+ RAM); long-horizon drift reduced but not eliminated; not a replacement for a real game engine's game logic (v4.0 acknowledges this by keeping the engine in the loop).

### 3.2 LingBot-World / LingBot-World 2.0 (Robbyant / Ant Group) — World model
- **Repo / Weights:** [github.com/Robbyant/lingbot-world](https://github.com/Robbyant/lingbot-world) (v1, Jan 2026) and [lingbot-world-v2](https://github.com/Robbyant/lingbot-world-v2) (Jul 2026); HF collections under `robbyant`.
- **Application:** Interactive world simulation for embodied AI, autonomous driving, and games; v1: ~16 FPS, <1s interaction latency, ~10 min stable generation; v2.0 ("Infinity"): 14B causal model on Wan2.2, 720p/60fps distilled variant, hour-long generation claims, dual-agent (Pilot/Director) harness, multiplayer persistence; day-0 SGLang support.
- **License:** v1 Apache-2.0; **v2.0 is CC BY-NC-SA 4.0 (non-commercial)** — a critical distinction for game studios.
- **Benchmark evidence:** Vendor claims parity with Google Genie 3 on video quality/dynamism/consistency; WBench five-dimension average 79.4/100 (Ying et al., 2026 benchmark). Hour-long "zero drift" claims are vendor-reported and under independent scrutiny.
- **Hardware/runtime:** v2.0 14B checkpoint + 1.3B consumer-GPU variant; reference setup 8×GPU at 480×832; <120 ms end-to-end delay reported on A100.
- **Limitations:** Non-commercial license on v2.0 blocks product embedding; reference inference is multi-GPU; long-horizon claims need third-party replication.

### 3.3 NPC dialogue / voice stack — Tool pipeline view
- **On-device NPC brains:** Qwen3-8B via **NVIDIA ACE** (not fully open, but supports open models for local NPC deployment); open alternatives: Gemma 4 26B-A4B (Apache 2.0, MoE, 3.8B active), Muse Glimmer 30B (Meta, Apache 2.0, Aug 2026), Qwen3.6-35B-A3B.
- **Voice:** Qwen3-TTS (Alibaba, Apache 2.0, Jan 2026, 3s voice cloning, 0.6B/1.7B); Chatterbox (Resemble AI, MIT, emotion control, sub-200 ms); CSM (Sesame, Apache 2.0, conversational prosody). Fish Speech 1.5 weights are CC-BY-NC-SA — prototyping only.
- **Modding:** Mantella (open-source Skyrim/Fallout 4 mod, STT→LLM→TTS pipeline over ~2,500 NPCs, actively maintained as of Jul 2026) is the canonical example of the open NPC **pipeline** approach on top of existing games.
- **Assessment:** There is no single "NPC foundation model"; SOTA practice is a composable pipeline: local LLM (3–35B class) + local TTS + lip sync, all runnable on consumer GPUs.

---

## 4. Robotics / Embodied AI / World Models

### 4.1 NVIDIA Isaac GR00T series — Foundation models (VLA)
- **Repo / Weights:** [github.com/NVIDIA/Isaac-GR00T](https://github.com/NVIDIA/Isaac-GR00T); HF `nvidia/GR00T-N1.7-3B` (current GA). N1 paper arXiv:2503.14734 (Mar 2025).
- **Versions:** N1 (Mar 2025, 2B) → N1.5 (May 2025) → N1.6 (Dec 2025, 3B, Cosmos-Reason backbone) → N1.7 (2026, Cosmos-Reason2-2B backbone + 32-layer DiT action head, ONNX/TensorRT export). **GR00T 2** ("world action model" on DreamZero research) announced at CoRL Nov 2026; weights + cross-adaptation recipe promised Dec 2026 — not yet downloadable as of 2026-11-20.
- **Application:** Humanoid robot control — loco-manipulation, whole-body control, language-conditioned bimanual tasks; cross-embodiment (Fourier GR-1, Unitree G1, YAM, Agibot Genie-1).
- **License:** Apache 2.0 (weights on HF); NVIDIA has adopted the Linux Foundation OpenMDW framework for GR00T/Cosmos/Nemotron families (May 2026).
- **Openness:** Code + weights + fine-tuning recipes open; supporting datasets partially open (Isaac GR00T X Embodiment Sim ~345k trajectories/1.91 TB; GRAIL ~50 h humanoid interaction; Human-1M-100K egocentric video, first 100k hours on HF).
- **Benchmark evidence:** GR-1 language-following: N1 46.6% → N1.5 93.3% (vendor). GR00T 2 white paper (Nov 2026): Dexter-50 zero-shot cross-embodiment transfer; Elo +236 over π0.5 and +95 over GR00T 1.7 on YAM V2 paired evals; LoRA task adaptation on a single RTX 5090 in ~30 min.
- **Hardware/runtime:** Inference on Jetson Thor/AGX Orin path; fine-tuning on workstation GPUs (LoRA ~25 GB); server reference on H100-class.
- **Limitations:** Humanoid-centric training data (other morphologies need fine-tuning); best results assume the NVIDIA stack; GR00T 2's "2× success of leading VLAs" claim is pre-release vendor evaluation.

### 4.2 Physical Intelligence π0 / π0-FAST / π0.5 (openpi) — Foundation models
- **Repo / Weights:** [github.com/Physical-Intelligence/openpi](https://github.com/Physical-Intelligence/openpi). π0 (Oct 2024), π0.5 open-sourced Sept 2025 with PyTorch support. **π0.6 / π0.7 are research-only, not released.**
- **Application:** General robot control (flow-matching VLA on PaliGemma backbone + action expert); dexterous manipulation (laundry folding, box assembly); π0.5 adds knowledge insulation for open-world generalization (validated in real unfamiliar homes).
- **License:** Apache 2.0.
- **Openness:** Code, base checkpoints (10k+ hours robot data), and task checkpoints (DROID, ALOHA, LIBERO) open; training data not open.
- **Benchmark evidence:** ALOHA bimanual real-robot average success 77.1% (π0) vs OpenVLA-OFT+ 87.8%, RDT-1B 78.4%, Diffusion Policy 77.5% (OFT paper). LIBERO sim benchmarks dominated by OpenVLA-OFT (97.1%) and StarVLA (98.8%).
- **Hardware/runtime:** Inference >8 GB (RTX 4090); LoRA fine-tune >22.5 GB; full fine-tune >70 GB (A100/H100); Ubuntu 22.04 tested only.
- **Limitations/safety:** Authors explicitly warn the base model was developed for their own robots and "may or may not work" on other platforms; open-source π0.5 currently supports only the flow-matching head; later capabilities (RECAP RL, MEM memory, π0.7 world-model ideas) not in the open repo.

### 4.3 OpenVLA / OpenVLA-OFT — Research baseline foundation model
- **Repo:** [github.com/openvla/openvla](https://github.com/openvla/openvla); paper arXiv:2406.09246 (2024).
- **Application:** 7B autoregressive VLA; de-facto reproducible research baseline with hundreds of community fine-tunes.
- **License:** MIT (code), open weights.
- **Benchmark:** LIBERO 76.5% (vanilla full fine-tune) → 97.1% with OFT (parallel decoding + action chunking + continuous actions, Feb 2025).
- **Hardware:** Consumer-GPU friendly; 4-bit quantized inference; LoRA on a single 3090/4090.
- **Limitations:** Autoregressive discrete actions slower than flow/diffusion heads; being superseded for production humanoid work but remains the entry point for sim research.

### 4.4 Meta V-JEPA 2 / 2.1 — World model for planning
- **Repo / Weights:** [github.com/facebookresearch/vjepa2](https://github.com/facebookresearch/vjepa2); paper arXiv:2506.09985 (Jun 2025); v2.1 released Mar 2026 (ViT-B 80M → ViT-G 2B encoder sizes).
- **Application:** Self-supervised video world model (JEPA — predicts latent representations, not pixels); zero-shot robot planning with image goals via V-JEPA 2-AC (post-trained on <62 h of unlabeled Droid robot video); video understanding/QA at 8B scale.
- **License:** Mostly MIT; pretrained weights across sizes.
- **Benchmark evidence:** SSV2 motion understanding 77.3 top-1; Epic-Kitchens-100 anticipation 39.7 recall@5; PerceptionTest 84.0 (8B class SOTA); zero-shot Franka pick-and-place in two labs; ~16s/action planning vs ~4 min/action for Cosmos latent-diffusion planning (single RTX 4090). V-JEPA 2.1 reports +20 pts robot grasping success.
- **Limitations:** Independent analysis (Sep 2026) found latent world models' planning reliability degrades beyond ~5–10 control steps — far short of the 16–53 step horizons of standard Meta-World tasks. Research-oriented, not a turnkey policy.

### 4.5 NVIDIA Cosmos (Predict / Reason / 3) — World foundation models
- **Repo / Weights:** [github.com/nvidia-cosmos](https://github.com/nvidia-cosmos) (Cosmos-Predict2 etc.); paper arXiv:2501.03575 (Jan 2025). Cosmos 3 (two-tower, Nano 8B+8B / Super 32B+32B) announced GTC 2026.
- **Application:** Synthetic data generation and world simulation for robots/AVs; fine-tunable WFMs; Cosmos-Reason VLM provides reasoning backbone for GR00T.
- **License:** NVIDIA Open Model License / Apache-2.0 code (varies by component); OpenMDW adoption announced May 2026.
- **Openness:** Weights + fine-tuning framework open; trained on ~20M hours video (data not open). Generated videos on NVIDIA API carry invisible watermarks.
- **Hardware/runtime:** Optimized for NVIDIA datacenter GPUs (H100/H200 practical for production).
- **Limitations/safety:** Guardrails ship for harmful text/images; synthetic data complements but does not replace real-world validation miles; vendor ecosystem lock-in is a strategic consideration.

---

## 5. Autonomous Driving Research

### 5.1 NVIDIA Alpamayo — Reasoning VLA for AV (foundation model + toolchain)
- **Repo / Weights:** Announced CES Jan 2026 ([NVIDIA newsroom](https://nvidianews.nvidia.com/news/alpamayo-autonomous-vehicle-development)); Alpamayo 1 (10B) on Hugging Face with open weights + open-source inference scripts; **Alpamayo-R1-10B** released at CVPR 2026 with AlpaSim.
- **Application:** Chain-of-thought reasoning VLA for AVs — video input → trajectories + reasoning traces. Positioned as a **large-scale teacher model** for fine-tuning/distillation into in-vehicle stacks, not for direct in-vehicle deployment.
- **License/access:** Open weights + open inference scripts; commercial-usage options promised for later family members.
- **Openness:** Model + inference open; companion **AlpaSim** (fully open-source end-to-end simulation framework, GitHub) and **Physical AI Open Datasets** (1,700+ hours driving data on HF) complete the stack. Underpinned by the NVIDIA Halos safety system.
- **Benchmark evidence:** Vendor claims first chain-of-thought reasoning VLA for AV research (Jan 2026); adoption signal: Mercedes-Benz CLA shipping NVIDIA stack end of 2026.
- **Hardware/runtime:** Teacher-scale (10B) model meant for offline development; distillation targets vehicle-grade compute.
- **Limitations/safety:** Explicitly **not** a deployable driving stack — requires developer fine-tuning, distillation, and safety validation; reasoning traces aid explainability but closed-loop safety remains the integrator's responsibility.

### 5.2 OpenEMMA — Open research framework (tool pipeline)
- **Repo:** [github.com/taco-group/OpenEMMA](https://github.com/taco-group/OpenEMMA); paper arXiv:2412.15208 (Dec 2024), WACV 2025, 169 citations.
- **Application:** Open-source reproduction of Waymo's EMMA approach: MLLM-based end-to-end trajectory planning with chain-of-thought (speed/curvature vectors), plus fine-tuned YOLO for 3D object detection.
- **Openness:** Code, datasets, and weights fully released; backbone-agnostic (tested with LLaVA-1.6-Mistral-7B, Llama-3.2-11B-Vision, Qwen2-VL-7B).
- **Benchmark evidence:** nuScenes validation (150 scenes): consistent improvement over zero-shot baselines in L2 error and failure rate; authors note unfine-tuned MLLMs trail fine-tuned SOTA.
- **Limitations:** Relies on external YOLO for detection (MLLM grounding insufficient); open-loop eval only — no interaction feedback; research scaffold, not a vehicle system.

### 5.3 OpenDriveVLA — Research VLA
- **Site:** drivevla.github.io; builds on open VLMs with hierarchical 2D/3D vision-language alignment and agent-env-ego interaction modeling; nuScenes open-loop SOTA claims (2025). Code release promised. Research-grade; open-loop only.

### 5.4 TIER IV Autoware E2E models — Industry open-source
- TIER IV open-sourced end-to-end driving models for the Autoware stack (Nov 2026), ranging from a camera-only "Alpamayo 2 Edge"-class model down to a 16M-parameter variant — notable as **deployment-oriented** open models rather than research teachers. Details via TIER IV/Autoware repos.

### 5.5 Baidu AIR ApolloFM
- Open-source E2E driving system for real-vehicle deployment; refines a VLA foundation model into a real-time 4D perception model + E2E driving model with three deployment modes trading capability vs latency (reviewed in MDPI Actuators, Aug 2026).

---

## 6. Cybersecurity

**Scope note:** Entries below are defensive/research models and their published evaluations. Capability claims are limited to vendor-published benchmarks; no operational offensive guidance is included.

### 6.1 Cisco Foundation-Sec-8B / Foundation-Sec-8B-Instruct — Foundation model
- **Repo / Weights:** HF `fdtn-ai/Foundation-Sec-8B` (Apr 2025); technical report on the model card; Cisco Foundation AI blog announcement 2025-04-28.
- **Application:** Security-domain LLM built on Llama-3.1-8B via continued pretraining on a cybersecurity corpus (vulnerability DBs, MITRE ATT&CK, threat intel). Used for threat-intel Q&A, CVE→CWE root-cause mapping, detection engineering assistance, SOC triage.
- **License:** Open-weight (Llama-derived licensing); datasets and eval harness (FAITH) open.
- **Openness:** Weights + technical report + evaluation tooling (FAITH 0.4.0 with CTI-Reasoning and CWE-Prediction benchmarks, datasets on HF) public; training corpus composition described but not fully released.
- **Benchmark evidence:** Vendor report: matches Llama-3.1-70B and GPT-4o-mini on several cybersecurity tasks (CTIBench MCQ/RCM, CyberMetric, SecBench) at 8B; general-knowledge retention verified on MMLU. Independent derivative: CyberSecQwen-4B (Apache 2.0, May 2026) claims +8.7 pts over Foundation-Sec-Instruct-8B on CTI-MCQ at half the parameters.
- **Hardware/runtime:** 8B class — single consumer GPU inference; LoRA fine-tuning demonstrated on a single MI300X.
- **Limitations/safety:** Domain-specialized — not a general assistant; small open models remain susceptible to jailbreak/prompt-injection (see §6.4); outputs require analyst verification before action.

### 6.2 Trend Micro Primus / Llama-Primus family + Cybertron — Foundation models + datasets
- **Repo / Weights:** HF `trend-cybertron` collection (Mar 2025); paper arXiv:2502.11191; agent code [github.com/trendmicro/cloud-risk-assessment-agent](https://github.com/trendmicro/cloud-risk-assessment-agent).
- **Application:** Llama-Primus-Base / -Merged / -Reasoning (8B) for security text understanding; Primus datasets (Seed, FineWeb 2.57B tokens, Instruct, Reasoning) for training security LLMs; Cybertron agent scans code/containers/K8s/AWS for CVEs and misconfigurations.
- **License:** Datasets ODC-BY; code MIT; NVIDIA NIM deployment path.
- **Benchmark evidence:** Continued pretraining on Primus yields +15.9% aggregate across cybersecurity benchmarks; reasoning distillation +15.8% on CISSP practice exams (+10% vs human test-takers, vendor-reported).
- **Limitations:** 8B class ceiling; agent scanning is a prioritization aid, not a substitute for runtime exploit validation.

### 6.3 SecureBERT 2.0 and adjacent tools
- **SecureBERT 2.0** (Aghaei et al., 2025): encoder for security text understanding — embeddings/classification rather than generation; Cisco's open security tooling also includes Codeguard, A2A scanner, MCP scanner (Cisco Live 2026 materials).
- **Aikido Altar 1** (Sep 2026): open-weight security model fine-tuned from GLM 5.3 for vulnerability detection and security code review — notable because local/inspectable inference avoids sending sensitive code to third-party APIs. Vendor benchmarks only; independent verification pending.

### 6.4 Safety posture of open-weight models (cross-cutting evidence)
- Cisco AI Defense "Death by a Thousand Prompts" (arXiv:2511.03247, Nov 2025): eight open-weight LLMs (Qwen3-32B, DeepSeek v3.1, Gemma 3-1B-IT, Llama 3.3-70B, Phi-4, Mistral Large-2, GPT-OSS-20B, GLM 4.5-Air) showed multi-turn attack success rates of 25.86%–92.78% (2×–10× single-turn) — systemic weakness in maintaining guardrails over extended dialogue.
- NVIDIA's garak (open-source red-teaming kit) is the standard probing tool; NVIDIA's guidance (Oct 2026) stresses garak results describe the scanned endpoint configuration, not the model in isolation.
- Australian Cyber Security Centre guidance (Nov 2026): open-weight adoption transfers full responsibility for safeguards, monitoring, and incident response to the deployer; fine-tuned/quantized/merged derivatives may not retain original alignment.
- **Defensive-use best practice (from published guidance):** use open-weight security models for triage, hypothesis generation, and detection-content drafting; keep exploit validation as a separate, controlled, human-supervised step; treat model files as supply-chain artifacts (verify provenance, sandbox loading — cf. the 2026 SGLang `torch.load` RCE CVE-2026-15976 as a supply-chain cautionary example).

---

## 7. Efficient / On-Device Inference

### 7.1 OpenAI gpt-oss-20b / gpt-oss-120b — Foundation models
- **Repo / Weights:** [github.com/gpt-oss/gpt-oss-120b](https://github.com/gpt-oss/gpt-oss-120b); HF releases Aug 2025; model card arXiv:2508.10925.
- **Application:** Open-weight reasoning MoE models for agentic/tool-use workloads; 20b targets edge/local (16 GB memory); 120b targets single-80GB-GPU production.
- **License:** Apache 2.0 (weights, inference code, tool environments, tokenizers); training data not released. Knowledge cutoff June 2024; text-only.
- **Specs:** 20b: 21B total / 3.6B active, 24 layers, 32 experts (4 active); 120b: 117B / 5.1B active, 36 layers, 128 experts; both 128k context, native MXFP4 MoE quantization.
- **Benchmark evidence (vendor, high reasoning):** 20b: AIME 2025 91.7% (98.7% w/ tools), GPQA-D 71.5%, MMLU 85.3%, SWE-Bench Verified 60.7%, Codeforces Elo 2516 (w/ tools). 120b: GPQA-D 80.1% ≈ o4-mini (81.4%). Training: 2.1M H100-hours (120b).
- **Hardware/runtime:** 20b ≈ 14 GB on disk, runs in 16 GB (RTX 4060 Ti-class, Mac 32 GB unified); supported by Transformers, vLLM, SGLang, Ollama, LM Studio, llama.cpp.
- **Limitations/safety:** Weak factual recall (SimpleQA 6.7% accuracy / 91.4% hallucination) — ground with retrieval; instruction-hierarchy defenses trail o4-mini (system-prompt protections more easily overridden); CoT not safety-filtered (don't show raw CoT to users); OpenAI preparedness review found default models below "High" bio/chem/cyber capability thresholds even after adversarial fine-tuning.

### 7.2 Google Gemma 4 family — Foundation models
- **Release:** Apr 2, 2026; Apache 2.0 (first Gemma generation with this license); HF model cards.
- **Sizes:** E2B / E4B (phones/laptops, audio+image input, 128K ctx), 12B, 26B-A4B MoE (3.8B active, 256K ctx), 31B dense; image input across all sizes; 140+ languages.
- **Benchmark evidence:** 26B-A4B: AIME 88.3%, GPQA-D 79.2 (per third-party trackers); E2B ~1.5 GB at Q4_K_M fits phones/4 GB devices; post-hoc drafter models (`gemma-4-X-it-assistant`) give built-in speculative decoding.
- **Hardware/runtime:** First-class MLX (Apple Silicon), GGUF/llama.cpp, ExecuTorch; Gemma GGUF builds pull ~20.8M downloads/month (second only to Qwen).
- **Limitations:** E2B/E4B trade complex reasoning for footprint; vendor benchmarks.

### 7.3 Liquid AI LFM2 / LFM2.5 / LFM3 — Foundation models for edge
- **Repo / Weights:** HF `LiquidAI`; LFM2 technical report arXiv:2511.23404; LFM2.5 released Jan 2026; LFM3-1.7B current on the models page (Nov 2026).
- **Application:** On-device foundation models — hybrid architecture (gated short convolutions + few GQA attention blocks) found by hardware-in-the-loop NAS; family spans 350M–8.3B (dense) and MoE 8.3B/1.5B-active; LFM2-VL (vision), LFM2-Audio (real-time speech-to-speech), LFM2-ColBERT (retrieval); LFM2.5-VL-450M for vision at the extreme edge.
- **License:** Open weights (LFM license; commercial-friendly per vendor); deployment packages for ExecuTorch, llama.cpp, vLLM.
- **Benchmark evidence:** Up to 2× faster prefill/decode than Qwen3 on CPU (Snapdragon 8 Elite / Ryzen AI 9 HX 370, Q4_0); LFM2-2.6B: IFEval 79.56%, GSM8K 82.41%; LFM2-1.2B competitive with Qwen3-1.7B (47% larger).
- **Limitations:** Best CPU numbers assume vendor kernel optimizations; NPU gains require per-platform work.

### 7.4 Inference runtimes (tool layer)
- **llama.cpp** (GGUF): the ecosystem foundation (Ollama, LM Studio, Jan build on it); broadest hardware support incl. CPU/Vulkan/ROCm/Metal; experimental speculative decoding; preview OpenVINO backend for Intel NPUs. Note 2026 supply-chain CVE-2026-15976 class risks when loading weights from untrusted sources.
- **Apple MLX / MLX-LM:** fastest Apple Silicon path — 20–87% faster than llama.cpp for <14B models; automatic quantization.
- **vLLM / SGLang:** production serving (PagedAttention, continuous batching, RadixAttention for agentic patterns); SGLang had day-0 support for LingBot-World 2.0.
- **ExecuTorch (Meta):** PyTorch-to-mobile with Qualcomm QNN / Core ML delegates; sub-20 ms mobile latency claims in 2026.
- **AMD Lemonade + FastFlowLM:** hybrid NPU-prefill/GPU-decode on Ryzen AI (2.3× faster TTFT, 2.4× decode vs single-processor paths); server/SDK open-source, FastFlowLM NPU kernels proprietary; XDNA 2 + Windows 11 gating.
- **Practical quantization guidance (2026 consensus):** Q4_K_M ≈ 0.65 GB/B params at ~97–98% of FP16 quality for ≥7B models; Q8_0 for quality-first edge; below Q3 degrades sharply.

---

## Cross-Domain Observations (2026-11-20)

1. **Foundation models vs pipelines:** In 3D, robotics, AV, and world models, genuine open foundation models now exist (TRELLIS.2, GR00T, π0.5, V-JEPA 2, Cosmos, Matrix-Game, Alpamayo). In Blender/graphics and NPC work, SOTA practice is a **composable open pipeline** (MCP-driven Blender + TRELLIS.2/Hunyuan3D + UniRig; LLM+TTS+lip-sync NPC stacks) rather than any single model.
2. **License stratification:** Truly permissive (MIT/Apache 2.0): TRELLIS.2, TripoSR, SAM 3D, openpi, OpenVLA, GR00T N-series, Matrix-Game, gpt-oss, Gemma 4, LFM2.x, CyberSecQwen. Restricted: Hunyuan3D 2.1 (territory + MAU cap), LingBot-World 2.0 (CC BY-NC-SA), Fish Speech 1.5 weights (NC), FLUX.2 [dev] (NC). Always check the current license text before commercial use.
3. **Benchmark hygiene:** Most headline numbers are vendor-reported; independent cross-model evals are rare (GR00T 2's paired Elo evals and the GameWorld Score benchmark are positive examples). Treat "SOTA" claims as scoped to the named benchmark and date.
4. **Safety:** Open weights = deployer owns safety. Multi-turn jailbreak ASR of 26–93% across major open-weight LLMs (Cisco, Nov 2025) is the standout systemic finding; model-weight supply-chain attacks (e.g., malicious pickle deserialization in serving stacks) are a documented 2026 risk class.

## Key Primary Sources

- TRELLIS.2: github.com/microsoft/TRELLIS.2 · arXiv:2512.14692
- Hunyuan3D 2.1: github.com/Tencent-Hunyuan/Hunyuan3D-2.1 · LICENSE (Community License)
- SAM 3D: github.com/facebookresearch/sam-3d-objects · arXiv:2511.16624
- GR00T: github.com/NVIDIA/Isaac-GR00T · arXiv:2503.14734 · GR00T 2 white paper (research.nvidia.com/labs/gear/gr00t-2, Nov 2026)
- openpi: github.com/Physical-Intelligence/openpi · arXiv:2504.16054 (π0.5)
- OpenVLA: github.com/openvla/openvla · arXiv:2406.09246
- V-JEPA 2: github.com/facebookresearch/vjepa2 · arXiv:2506.09985
- Cosmos: github.com/nvidia-cosmos · arXiv:2501.03575
- Matrix-Game: github.com/SkyworkAI/Matrix-Game · arXiv:2506.18701, arXiv:2604.08995
- LingBot-World: github.com/Robbyant/lingbot-world(-v2)
- Alpamayo: nvidianews.nvidia.com/news/alpamayo-autonomous-vehicle-development (Jan 2026) · HF Alpamayo 1
- OpenEMMA: github.com/taco-group/OpenEMMA · arXiv:2412.15208
- Foundation-Sec-8B: HF fdtn-ai/Foundation-Sec-8B · blogs.cisco.com (Apr 2025)
- Primus: HF trend-cybertron · arXiv:2502.11191
- Open-weight vulnerability study: arXiv:2511.03247 (Cisco AI Defense, Nov 2025)
- gpt-oss: github.com/gpt-oss · arXiv:2508.10925
- Gemma 4: HF google/gemma-4 model cards (Apr 2026)
- LFM2: arXiv:2511.23404 · liquid.ai/blog
- Blender MCP: blender.org/development/projects-to-look-forward-to-in-2026 · BlenderRAG arXiv:2605.00632
