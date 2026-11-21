# Open-Weight / Open-Source State of the Art in Multimodal & Media Models

**As of 2026-11-20.** Compiled from 6 distinct web-search rounds plus direct reads of primary sources (official GitHub repos, arXiv technical reports, vendor docs, and dated leaderboard snapshots). No model weights were downloaded.

**Scope and honesty note:** There is no universal "SOTA" across these domains. Leadership is per-task, per-benchmark, per-license, and per-hardware-budget, and many headline numbers are vendor self-reports. Where scores conflict between a model card and an independent leaderboard, the discrepancy is flagged. "Open" is graded (Apache-2.0/MIT → revenue-capped community licenses → non-commercial/research-only → gated/closed); terms below are informational, not legal advice — read the license text on each model card before commercial use.

---

## 1. Vision-language understanding (VLM)

| Model (repo/weights) | Vendor | Params | License / gating | Evidence (benchmark, date, who ran it) | Hardware / runtime | Limitations / safety |
|---|---|---|---|---|---|---|
| **Qwen3-VL-235B-A22B** (Instruct & Thinking) — `Qwen/Qwen3-VL-235B-A22B-*` | Alibaba | 235B MoE, 22B active | Apache 2.0, ungated | Qwen3-VL Technical Report (arXiv:2511.21631, Nov 2025): best-reported open results on MathVista-mini (85.8 Thinking), MathVision (74.6), MMMU ~80.1, OCRBench ~875 (39 languages), DocVQA 96.5; independent OmniDocBench listing: 89.78 (v1.6) — below sub-1.5B OCR specialists. FlagOS independent rerun (ModelScope): MMMU 70.4 / OCRBench 91.8 on H100 (different eval harness) | vLLM/SGLang/Transformers; ~4×80GB class for BF16; quantized builds smaller | ScreenSpot-Pro 61.8–62.0 trails GUI specialists; huge serving footprint; vendor-run headline evals |
| **Qwen3-VL dense/MoE line** (2B, 4B, 8B, 32B, 30B-A3B) | Alibaba | 2B–32B | Apache 2.0 | Tech report + third-party guides (2026): 8B Instruct ≈ OCRBench ~905-class OCR strength, 256K context (1M expandable); 30B-A3B: MMMU 74.2 Instruct at 3B active | 8B runs ~6GB VRAM (Q4) per community tests; 32B ≈ single 24GB card quantized | Smaller sizes trail flagship on hard reasoning (MMMU-Pro 56.6 @8B) |
| **InternVL3.5** — `OpenGVLab/InternVL3_5-*` | OpenGVLab / Shanghai AI Lab | 1B → 241B-A28B MoE | Apache 2.0 per HF cards (some secondary lists label the family "MIT" — verify per checkpoint) | Independent roundups (Oct 2026): strong on academic/technical figure parsing; competitive with Qwen3-VL on reasoning in some evals | vLLM; llama.cpp support lags (docs list InternVL 2.5/3) | No native video; smaller ecosystem than Qwen |
| **Molmo2** — Ai2 | Ai2 | 4B, 8B, O-7B | Apache 2.0 **+ open training data** (fully reproducible) | Vendor/independent: video pointing 38.4 F1 vs Gemini 3 Pro 20.0; video counting 35.5 vs Qwen3-VL 29.6 | 8B on a single GPU | Weak long-document OCR; general reasoning below frontier APIs |
| **GLM-4.6V / GLM-4.6V-Flash** — `zai-org` | Z.ai | 106B / 9B | MIT | Card-level claims; independent confirmation thin | vLLM, llama.cpp (Flash GGUF) | Newer, less externally validated |
| **Gemma 4** (E2B, E4B, 12B, 26B-A4B, 31B) | Google | 2B–31B | Apache 2.0 (per 2026 reporting; earlier Gemma used custom terms — verify) | Community: 31B ≈ 76.9% MMMU-Pro Vision; E4B adds audio input | Single H100 for 31B; edge variants for mobile | Audio only on E2B/E4B/12B |
| **Step3-VL-10B** | StepFun | 10B | Apache 2.0 | Card numbers (Jan 2026): MMMU 78.1–80.1, OCRBench 86.75–89.0 with test-time scaling — flagship-class scores at 10B (vendor-reported) | vLLM, OpenAI-compatible | Vendor-reported; limited independent replication |
| **Llama 4 Scout** | Meta | 109B MoE, 17B active | Llama 4 Community License (restrictions, EU clause) | Meta claims single-H100 int4 serving; strong English VQA | 1×H100 (int4, Meta claim) | Not OSI-open; no newer Llama since Apr 2025 |
| MiniCPM-V 4.6 / MiniCPM-o 4.5 | OpenBMB | 1.3B / 8B | Apache 2.0 | On-device niche; 96× video token compression | Phones/edge | Low absolute ceiling |
| Mistral Small 3.2/4, Ministral 3 | Mistral | 3B–119B | Apache 2.0 | Cards; NVFP4 build of Small 4 | 8–24GB FP8 (Ministral) | No video input |

**Reading:** For general open-weight VLU, the Qwen3-VL family is the most consistently verified leader (tech report + independent reruns + leaderboard presence), with InternVL3.5 and Step3-VL-10B as credible challengers and Molmo2 the pick for reproducibility/pointing. Closed models (Gemini 3.x, GPT-5.x, Claude) still top general reasoning leaderboards.

---

## 2. Image generation & editing

Primary independent yardstick: **Artificial Analysis AA-Image-T2I v2.1** open-weights leaderboard (read 7–19 Nov 2026; FLUX.2 [dev] fixed at Elo 1000) and AA Image-Editing board.

| Model | Vendor | Params | License / gating | Evidence | Hardware | Limitations / safety |
|---|---|---|---|---|---|---|
| **FLUX.2 [dev]** — `black-forest-labs/FLUX.2-dev` | Black Forest Labs | 32B | **FLUX Non-Commercial License** (outputs usable commercially; running the model commercially needs a BFL license) | AA T2I anchor (Elo 1000, 18.7k votes, Nov 2025 checkpoint); editing board anchor 1000; released 25 Nov 2025; multi-reference (up to 10 images), up to 4MP | ~24GB (GGUF Q4 w/ text-encoder offload) to H100-class for full precision; official NVFP4 build | Non-commercial gating of weights; Mistral Small text encoder; FLUX 3 (Jul 2026) is API-only — FLUX 3 Dev weights not yet released |
| **FLUX.2 [klein] 4B / 9B** | BFL | 4B / 9B (+8B Qwen3 text encoder on 9B) | 4B: **Apache 2.0**; 9B: FLUX Non-Commercial | BFL release notes (docs.bfl.ml): sub-second generation, ~13GB VRAM; AA open-weights Elo: 4B 840, 9B 931 (T2I) | Consumer GPUs (RTX 3090/4070 class) | 4B well below dev on arena; unified gen+edit |
| **FLUX 3 Image Klein** — `black-forest-labs/flux-3-image-klein` | BFL | 5.6B | **FLUX Kommunity v1.0** — outputs free commercially only < $5M revenue | AA open-weights T2I #3 (Elo 1041, Oct 2026); released 15 Oct 2026; only open FLUX 3 weights | 8GB-class GPUs reported; 31GB peak BF16 | Revenue-capped license; brand-new |
| **Z-Image Turbo / Z-Image (base)** — `Tongyi-MAI/Z-Image-Turbo` | Alibaba Tongyi-MAI | 6B (single-stream S3-DiT) | **Apache 2.0** | AA open-weights Elo 937 (Turbo); Turbo released 26 Nov 2025, base 27 Jan 2026; ~694k HF pulls/30d (most-downloaded open image model, Sep 2026); 8-step distilled, native EN+ZH text | 16GB bf16; 4–8GB quantized; ~1s on H100 | Turbo not fine-tunable; skin/hair weakness; Z-Image-Edit still unreleased |
| **Qwen-Image / Qwen-Image-2512** — `Qwen/Qwen-Image*` | Alibaba Qwen | 20B MMDiT | **Apache 2.0** | Best-in-class open text rendering (EN+ZH typography); AA open-weights Elo 908 (v1, Aug 2025) | fp8 ≈ 20GB (24GB card); bf16 ≈ 58GB | Line superseded by 2.x; LoRA ecosystem stalled per community |
| **Qwen-Image-Edit-2511 / Edit-Plus** | Alibaba Qwen | 20B | **Apache 2.0** | AA open-weights **editing** Elo 996 (#10); released 23 Dec 2025 (2509: 22 Sep 2025); improved identity consistency | 24GB-class at fp8 | Target of published jailbreak attacks (arXiv:2610.23909 cross-modal editing-intent attack, Nov 2026) — deploy with input/output moderation |
| **Qwen-Image-2.1 (+Turbo)** | Alibaba Qwen | 7B generator (unified gen+edit) | **Qwen Research License — non-commercial/research only** | AA open-weights T2I **#1–2** (Elo 1047, Sep 2026); editing #3 (1082) | — | Not usable commercially without separate license; Qwen-Image-3.0 (Jul 2026) is API-only with no weights/report |
| **MiniMax H3-Image** | MiniMax | 33.1B DiT, 6 NFE, no CFG; native ~16MP (4096×4096) | **MiniMax-H3-Image Community License** — excludes US/EU/UK/Korea; >$1M revenue or hosted service needs written authorization; AUP attached | AA open-weights T2I **#1** (Elo 1066) and editing **#1** (1135), Nov 2026; released 10–11 Nov 2026 | BF16 checkpoint 68.65GB + 66.7GB text encoder; multi-GPU or heavy quant | Territorial exclusions make it unusable as open weights for US/EU/UK/KR; no mask inpainting or transparency yet |
| **Fibo 2.0** — `briaai/Fibo-2.0-dev` | Bria | — | Open weights (check card; Bria historically permissive w/ attribution) | AA open-weights T2I #4 (1037), editing #2 (1086), Oct 2026 | — | New; limited community tooling |
| Stable Diffusion 3.5 Large/Medium | Stability AI | 8.1B | Stability Community License (free < $1M revenue) | AA T2I ~83rd/84 (Nov 2026) — far behind 2026 leaders; still the deepest LoRA/ControlNet ecosystem | 8GB | Quality now clearly dated; ecosystem is its moat |
| ERNIE-Image (+Turbo) | Baidu | 8B DiT | Apache 2.0 | AA open-weights Elo 909–915 (Apr 2026) | — | — |
| GLM-Image (9B+7B decoder, MIT), LongCat-Image (6B, Apache 2.0), HiDream-O1-Image (8B, MIT), HunyuanImage 3.0, Ideogram 4.0 (9.3B, non-commercial), Krea 2 (12B, <$1M community license) | various | various | mixed | AA open-weights rankings in table above | — | License terms vary sharply per checkpoint |

**Verified takeaways:** (1) The **open-weights arena lead** as of Nov 2026 is MiniMax H3-Image (license-restricted) > Qwen-Image-2.1 (research-only) ≈ FLUX 3 Image Klein (revenue-capped) > Fibo 2.0 > FLUX.2 [dev] — i.e., the strongest new open weights mostly carry **non-permissive** terms. (2) The strongest **Apache-2.0-unrestricted** options remain Z-Image Turbo (speed) and Qwen-Image-2512/Edit-2511 (text rendering & editing), with FLUX.2 [klein] 4B as the permissive BFL option. (3) Closed leaders (GPT Image 2.x "Sunburst", Nano Banana Pro, Seedream 4.5/5.0) sit ~200+ Elo above the best open weights.

---

## 3. Video generation & editing

| Model | Vendor | Params | License / gating | Evidence | Hardware | Limitations / safety |
|---|---|---|---|---|---|---|
| **Wan2.2 family** — `Wan-Video/Wan2.2`, `Wan-AI/Wan2.2-*` | Alibaba | T2V/I2V-A14B: 27B MoE (14B active/step, 2 experts); TI2V-5B dense; S2V-14B (audio-driven); Animate-14B / Animate-2-14B (7 Aug 2026) | **Apache 2.0**, ungated | Official GitHub README (primary): MoE split by noise level; TI2V-5B does 720p24 in <9 min on one consumer GPU; efficiency table: T2V-A14B 720p = 1041.5s / 59.8GB peak on 1×H100, 534.7s / 22.9GB for TI2V-5B on RTX 4090. Arena I2V open Elo 1171 (Nov 2026); community head-to-heads rate it best open silent-video quality | A14B: ~24GB at FP8 (community), 80GB comfortable BF16; TI2V-5B: 8–24GB | No native audio; ~5s clips; community GGUF extends to 6–16GB with quality loss; **Wan 2.5/2.6/2.7 are API-only** (verified 5 Oct 2026: no weights on Wan-AI HF/ModelScope/GitHub) |
| **MiniMax H3 (H3-Base FL2VA / Ref2VA)** — `MiniMaxAI/MiniMax-H3` | MiniMax | 33B dense omni-transformer (video + 32kHz stereo audio in one pass) | **MiniMax H3 Community License** — open-weight grant **excludes US, EU, UK, South Korea**; >$20M revenue needs authorization; attribution required; AUP forbids guardrail bypass | Announced 31 Jul 2026, weights 2–3 Aug 2026; T2V Arena ~1238–1240 Elo (#1 open-weight, per secondary); 4–15s @24fps, 768p open / 2K via closed H3-Regenerate-2K; prompt-rewriter (Context-IR) also closed | Full BF16 ~66GB/GPU ×4 H100; pruned INT8+NVFP4 ~42.5GB on 1×80GB; INT8 on RTX 5090 reported | Territorial exclusion; partial openness (2K + prompt modules hosted); strongest open-weights video+ audio quality claim is vendor/arena based |
| **LTX-2.5 (LTX-2 family)** — `Lightricks/LTX-2.5` | Lightricks | 22B DiT (dev + 8-step distilled variants) | **LTX-2.x Community License** (11 Aug 2026): royalty-free worldwide, **paid license ≥ $10M annual revenue**; commercial output-training ban | Released Aug 2026; first open-weights line with **synchronized video+audio** in one diffusion pass; up to 4K; 52 quantization builds on HF card; day-one ComfyUI | ~12–16GB (GGUF Q3/Q4, community-reported); 16GB official minimum | Revenue cap; resolution/length specs shift between point releases |
| **HunyuanVideo 1.5** | Tencent | 8.3B | Tencent Hunyuan Community License (restricted; check card) | Released 20 Nov 2025; official repo: 14GB minimum with offloading; built-in super-resolution to 1080p; native ComfyUI | 14GB (offload) – 24GB | License restrictions; no audio |
| **SeedVR2** | ByteDance Seed | — | Apache 2.0 | One-step video upscaling/restoration; ranked among top open video tools Nov 2026 | — | Restoration only, not generation |
| Older but running: Mochi 1 (Genmo, Apache 2.0, 24GB), CogVideoX-5B (Apache 2.0, 12GB), Kandinsky 5.0 Lite, SkyReels, MAGI-1 | various | various | mostly Apache 2.0 | Quality now behind Wan2.2/LTX-2.5 per 2026 head-to-heads | 12–40GB | — |

**Editing-specific:** Video *instruction editing* open weights are still thin — Wan2.2-Animate (character animation/replacement), community LoRAs around LTX-2.5/H3, and SeedVR2 (restoration) are the main verified pieces; closed models (Seedance 2.x, Kling 3.0, Veo 3.1, Sora 2, Runway Gen 4.5) dominate editing features. No mandatory watermarking in open models — C2PA/SynthID integration is the deployer's job; deepfake-consent and likeness rules apply regardless of license.

---

## 4. Speech recognition (ASR)

Independent yardstick: Hugging Face **Open ASR Leaderboard** (8 English datasets, average WER; figures as reported Jul–Oct 2026).

| Model | Vendor | Params | License / gating | Evidence | Hardware | Limitations / safety |
|---|---|---|---|---|---|---|
| **NVIDIA Parakeet TDT 0.6B v3** — `nvidia/parakeet-tdt-0.6b-v3` | NVIDIA | 600M FastConformer TDT | CC-BY-4.0 weights; NeMo toolkit Apache 2.0 | Open ASR Leaderboard avg WER **6.34%**, RTFx ~3,332 (leaderboard, 2026); English-only Parakeet Unified: 5.91% | INT8 ONNX ~680MB; runs CPU/Apple Silicon/NVIDIA GPU; 2GB+ to load | 25 European languages only (no CJK); batch-oriented (streaming via chunking) |
| **NVIDIA Nemotron Speech Streaming / 3.5 ASR** | NVIDIA | 600M | OpenMDW-1.1 | Streaming WER 6.93% avg (1.12s chunks); LibriSpeech test-clean 2.32%; 3.5 covers 40 locales w/ auto language ID (4 Jun 2026) | Cache-aware streaming, CPU-capable | Vendor card numbers; English-first |
| **OpenAI Whisper large-v3 / large-v3-turbo** — `openai/whisper-large-v3` | OpenAI | 1.55B | **MIT** | ~7.4% avg WER on same leaderboard; **99 languages**; ecosystem default (faster-whisper CTranslate2 ~4× faster) | GPU for large; CPU feasible for small | Autoregressive → hallucinates text in silence (documented); no native streaming |
| **Qwen3-ASR (1.7B / 0.6B)** | Alibaba | 1.7B/0.6B | **Apache 2.0** | 52 languages/dialects; streaming via vLLM backend; strong Mandarin/multilingual per vendor and third parties | GPU, vLLM | Vendor-reported WER; smaller eval footprint than leaderboard models |
| **NVIDIA Canary-Qwen 2.5B** | NVIDIA | 2.5B | CC-BY-4.0 | Reported best open **English accuracy** (AssemblyAI 2026 roundup) | A100/A6000-class tested | English-only, file-based batch |
| Voxtral (Mistral, Apache 2.0), SenseVoice (Alibaba FunASR, 234M, custom license w/ attribution), Moonshine (MIT, 61.5M edge/streaming, 566× RT), IBM Granite Speech 3.3 (Apache 2.0), AI4Bharat IndicConformer (MIT, 22 Indian languages) | various | — | mixed | Secondary 2026 roundups | edge→GPU | Check per-checkpoint licenses |

**Takeaway:** Per Open ASR Leaderboard + multiple independent 2026 comparisons: **English throughput/accuracy** → Parakeet TDT v3; **streaming** → Nemotron streaming; **99-language breadth & ecosystem** → Whisper large-v3(-turbo); **multilingual incl. Mandarin, permissive** → Qwen3-ASR. All clean-audio WERs understate real-world error on accents/noise/domain jargon.

---

## 5. Speech synthesis (TTS) & speech-to-speech

Independent yardstick: **Artificial Analysis Voice/TTS Elo** (blind listening; read 27 Oct–Nov 2026; Zonos anchored at 1000) and vendor latency figures.

| Model | Vendor | Params | License / gating | Evidence | Hardware | Limitations / safety |
|---|---|---|---|---|---|---|
| **Ming-3.0-tts** | Ant Group | 0.5B | **MIT** | AA Elo **1188 — best open model a company can ship freely** (27 Oct 2026); 7 languages + Cantonese/Sichuanese; cloning | GPU; vLLM-Omni, mlx-audio | No published latency |
| **Fish Audio Drama 3 (Preview)** | Fish Audio | — | Community license; commercial < $500k revenue | AA Elo **1245 — highest open-weights TTS** (Oct 2026) | GPU | Revenue cap |
| **Breeze TTS 2** | BreezeBlue | 3B-class | **Research / non-commercial** | Elo 1215–1228; first open model to outrank ElevenLabs v3 on blind board (Oct 2026) | — | Cannot ship commercially; cloning ordinary vs its preset voices |
| **Qwen3-TTS** — `Qwen/Qwen3-TTS-*` | Alibaba | 0.6B / 1.7B (Base / CustomVoice / VoiceDesign) | **Apache 2.0** | Released 22 Jan 2026; 10 languages; 3-second voice cloning; vendor: 97–101 ms first audio; 3.2M HF downloads/30d (1.7B Base) | GPU (6–8GB for 1.7B); vLLM-Omni, mlx-audio | Vendor latency on unnamed GPU; CUDA-first examples |
| **Chatterbox (500M / Turbo 350M / Multilingual V3)** | Resemble AI | 110M–0.5B | MIT | AA Elo 1023; vendor blind study: 65.3% preferred vs ElevenLabs (vendor-run); **Perth watermark embedded in all output** | GPU/ONNX | **Project retired Aug 2026** (maintainer pivoted; repo archived, no fixes) |
| **Kokoro-82M** — `hexgrad/Kokoro-82M` | hexgrad | 82M | **Apache 2.0** | AA Elo 1061–1064; ~10.6M HF downloads/30d; laptop-CPU narration | CPU/ONNX/Transformers.js | No cloning; synthesizes whole sentence before playback (0.9–1.3s first audio); unmaintained since Jan 2025 |
| **Pocket TTS** | Kyutai | 100M (+1.9–18.2M minis) | Code MIT, weights CC-BY-4.0; **cloning repo gated w/ consent terms** | Local CPU voice cloning; 250–430ms first audio (independent M2 measurement) | CPU | English ONNX only; consent-gated cloning |
| **Phonon 31M** | Gradium | 31M | Apache 2.0 (40M multilingual models CC BY-NC 4.0) | Vendor blind test 2098 Elo vs Kokoro 2043; 30–100ms first audio on 1 CPU core (independent M2 check) | CPU/WASM/Rust | English (Apache build); vendor-run evals |
| CosyVoice 3 (Alibaba Tongyi, 0.5B, Apache 2.0, 150ms), MOSS-TTS-Realtime (OpenMOSS, 1.7B, Apache 2.0), Magpie TTS Multilingual (NVIDIA, 357M, NVIDIA Open Model License), Maya1 (Apache 2.0), Zonos v0.1 (Apache 2.0), XTTS v2 (**CPML non-commercial** — vendor defunct), VibeVoice (research-only) | various | — | mixed | 2026 roundups | CPU→GPU | License traps are the main risk; XTTS/F5-TTS weights non-commercial |

**Speech-to-speech / full-duplex (voice agents):** **Moshi** (Kyutai, 7B; code MIT/Apache, weights CC-BY-4.0) is the open reference; **NVIDIA PersonaPlex-7B** (code MIT, weights NVIDIA Open Model License, **gated** HF download; Jan 2026) adds persona+voice control, ~170–205ms turn-taking, 100% interruption handling on Full-Duplex-Bench (vendor-reported); **NemotronLabs VoiceChat 11B** (OpenMDW-1.1, Sep 2026, arXiv:2609.21967) adds tool calling (right tool 82.5%, right values only 42.2%). Honest ceiling: open full-duplex models score 4–27% on Big Bench Audio vs ~90% for closed GPT-Live/Gemini Live — production phone agents still typically run ASR→LLM→TTS cascades.

---

## 6. Audio understanding & music generation

| Model | Vendor | Params | License / gating | Evidence | Hardware | Limitations |
|---|---|---|---|---|---|---|
| **Qwen3-Omni-30B-A3B (Instruct/Thinking/Captioner)** | Alibaba | 30B MoE, 3B active | **Apache 2.0** | Qwen3-Omni Technical Report (arXiv:2509.17765, primary): open-source SOTA on **32 of 36** audio/audio-visual benchmarks, overall SOTA on 22; 119 text / 19 speech-in / 10 speech-out languages; 40-min audio input; 234ms theoretical first-packet latency | ~79GB BF16; quantized smaller | Turn-taking (not full duplex); independent arXiv:2604.24954 shows **Nemotron 3 Nano Omni (30B-A3B, open)** edging it on DailyOmni (74.5 vs 71.9) / WorldSense (55.2 vs 54) |
| **Nemotron 3 Nano Omni** | NVIDIA | 30B-A3B | Open (see card) | arXiv:2604.24954 (Apr 2026): beats Qwen3-Omni on audio-visual reasoning evals | — | Newer, less deployment evidence |
| **ACE-Step 1.5 (XL)** — `ace-step/ACE-Step-1.5` | ACE Studio + StepFun | — | **MIT** (v1 Apache 2.0) | Vocals + instrumentals up to 10 min; fastest permissive full-song option per Oct–Nov 2026 comparisons | <4GB VRAM (base), 12GB+ XL | Research-grade variability |
| **YuE / YuE2** | HKUST/Multimodal Art Projection | — | v1 Apache 2.0 (credit); **YuE2 weights CC BY-NC 4.0** + creator permission (companies need license) | First open model reported to outscore Suno on a public benchmark (Sep 2026 roundup) | 24GB NVIDIA | Non-commercial default |
| **MiniMax Music 3.0** | MiniMax | — | Community license: attribution + written authorization > $20M revenue | Full songs w/ vocals up to ~5 min | <24GB (8GB w/ layer streaming) | Revenue cap |
| **Stable Audio Open / Stable Audio 3.0 open Small/Medium** | Stability AI | — | Stability Community License (free < $1M revenue) | SFX/loops (~47s) trained on Creative Commons audio | — | No vocals (Open); revenue cap |
| Meta MusicGen (code MIT, **weights CC-BY-NC**), Magenta RealTime 2 (Apache 2.0 code / CC-BY weights; real-time jamming on Apple Silicon), Fish Audio Drama 3 (dialogue, see §5) | various | — | mixed | — | — | MusicGen weights non-commercial |

---

## 7. OCR & document intelligence

Independent yardstick: **OmniDocBench v1.6 end-to-end leaderboard** (official repo `opendatalab/OmniDocBench`, evaluation updated 31 Mar 2026 and checked Oct–Nov 2026) and Ai2's **olmOCR-Bench** (scores mostly self-reported).

| Model | Vendor | Params | License / gating | Evidence (leaderboard, date) | Hardware / throughput | Limitations |
|---|---|---|---|---|---|---|
| **OXR-1.0** | — | 1.3B | Apache 2.0 + extra terms ($2M threshold) | **97.03 overall — #1** (OmniDocBench v1.6) | — | Extra license terms; very new |
| **TeleOCR** | — | 1.2B | Apache 2.0 | **96.91 — #2** (v1.6); Aug 2026 | — | New; card self-reports 96.87 |
| **OvisOCR2** (successor OvisOCR3 reports 96.74 in paper, not yet on board) | AIDC-AI | 0.8B (on Qwen3.5-0.8B) | Apache 2.0 | **96.47 — #3** (v1.6) | tiny GPU | No built-in field extraction |
| **PaddleOCR-VL-1.6** — `PaddlePaddle/PaddleOCR-VL` | Baidu PaddlePaddle | 0.9B (NaViT + ERNIE-4.5-0.3B) | **Apache 2.0** | **96.34 — #4** (v1.6); released with PaddleOCR 3.6.0, May 2026; 109–111 languages incl. seals/charts; official GGUF | 1.9GB BF16; vLLM/llama.cpp/Paddle; CPU & NPU targets | Best via Paddle stack; very close scores at top — test on own documents |
| **MinerU2.5-Pro-2605** | OpenDataLab | 1.2B | MinerU Open Source License (Apache 2.0 + conditions: commercial license >100M MAU or >$20M/mo; attribution for hosted services) | **95.75** (v1.6); cross-page table/paragraph merging; 2.12 pages/s on one A100 (vendor) | 2.3GB; vLLM | License conditions |
| **GLM-OCR** — `zai-org/GLM-OCR` | Z.ai | 0.9B | **MIT** (layout component Apache 2.0) | **95.22** (v1.6); 94.62 on v1.5; schema-driven JSON field extraction; 1.86 pages/s (vendor) | 2.7GB; vLLM/SGLang/Ollama/llama.cpp | 8 languages; trails on handwritten KIE (86.1 vs Gemini 3 Pro 94.5) |
| **DeepSeek-OCR-2** | DeepSeek | ~3B (500M active) | **Apache 2.0** | 90.25 (v1.6); Jan 2026; optical context compression (256–1,120 visual tokens/page); ~200k pages/day/A100 (vendor) | 6.8GB; 12–16GB community minimum | Mid-table accuracy; value is token efficiency for LLM ingestion |
| **olmOCR-2-7B-1025** | Ai2 | 7B (8.3B w/ encoder) | **Apache 2.0** | 82.4 on olmOCR-Bench (Ai2's own) | 16.6GB; FP8 build ~half | English-focused |
| Chandra OCR 2 (datalab.to) | Datalab | ~5.3B | Modified OpenRAIL-M ($2M threshold) | 85.8 olmOCR-Bench (self-reported); 90+ languages, handwriting/forms | 10.6GB | Self-reported; license threshold |
| dots.mocr (rednote, MIT, 3B, multilingual layout→SVG), LightOnOCR-3 (Apache 2.0, 0.8–4B, grounding boxes, 86.3 self-reported), HunyuanOCR-1.5 (Tencent community license), Granite-Docling-258M (Apache 2.0), FireRed-OCR (2B, self-reported 92.94 v1.5, repo inactive since Mar 2026) | various | — | mixed | — | — | — |

**Key verified point:** Sub-1.5B specialists beat giant general VLMs on document parsing — OmniDocBench v1.6: PaddleOCR-VL-1.6 96.34 vs Qwen3-VL-235B 89.78 vs Gemini 3 Pro 92.91 (leaderboard figures). Top-of-board scores are within noise of each other and mostly vendor-executed; benchmark saturation (v1.5: 1,355 pages) means real-document testing is decisive.

---

## 8. Multimodal agents (GUI / computer use / web)

Benchmark caveat: **OSWorld (2024) ≠ OSWorld-Verified (Jul 2025) ≠ OSWorld 2.0 (Jun 2026, 108 long-horizon tasks)** — scores are not comparable across versions.

| Model / framework | Vendor | Params | License | Evidence (benchmark, date, status) | Hardware | Limitations / safety |
|---|---|---|---|---|---|---|
| **OpenCUA-72B (also 7B/32B)** — `xlangai/OpenCUA` | XLANG Lab | 7B–72B | **MIT — weights + AgentNet data + recorder tools** (most fully open) | OSWorld-Verified **45.0%** (100 steps, mean of 3 runs; open-model leader Oct 2025) | 72B needs multi-GPU; vLLM 0.12+ | Model only, not an app; trails closed (~16 pts at release) |
| **GUI-Owl-1.5 / Mobile-Agent-v3.5** — `X-PLUG/MobileAgent`, HF `mPLUG` | Alibaba Tongyi | 2B–235B (Qwen3-VL based) | **MIT, weights open** | Paper arXiv:2602.16855 (Feb 2026): **self-reported** OSWorld-Verified **56.5%** (vs UI-TARS-2 53.1, OpenCUA-72B 45.0), ScreenSpot-Pro 72.9% single-shot; AndroidWorld-line: 73.3% (Mobile-Agent-v3) | A100-96GB validated | Self-reported; independent reruns only confirmed older GUI-Owl (~54.9–58.0) — **verify before adopting** |
| **UI-TARS-1.5-7B + UI-TARS Desktop / Agent TARS** | ByteDance | 7B open | **Apache 2.0** (app, CLI, 7B weights) | 7B: 27.5% OSWorld; full UI-TARS-1.5 42.5% and UI-TARS-2 47.5% — **weights not released** | Desktop app; any endpoint | Best checkpoints closed; repo quiet since Nov 2025 |
| **Agent S3 / S4 (`simular-ai/Agent-S`)** | Simular | framework | **Apache 2.0** code + S4 synthetic task set | S3: 72.6% OSWorld w/ best-of-N (above 72.36% human baseline; 66% single-pass); S4 (arXiv, 20 Oct 2026): lifts open **Qwen3.8-27B from 5.6%→21.3% binary on OSWorld 2.0** at $1.10/task (vs Claude Opus 4.8 20.6% @ $72.40; Opus still ahead on partial 54.8 vs 46.9) | Runs w/ self-hosted vLLM models | Framework not a model; `--enable_local_env` executes arbitrary code — **run in VM/sandbox (e.g., Cua)**; 300-step budget vs official 500 |
| **Mano-P 1.0 (72B) / DeepMiner-Mano** | Mininglamp | 72B (+4B quantized) | Apache 2.0 (per vendor) | OSWorld specialist-model leaderboard **58.2%** (vendor-published, Aug 2026) | 4B build runs on consumer Mac | Vendor-published figures; limited independent verification |
| **Holo4 (27B / 35B-A3B)** | H Company | 27B / 35B-A3B | 27B: **CC BY-NC 4.0**; 35B-A3B: **Apache 2.0** | Vendor-stated OSWorld 2.0 61.7% (metric unspecified); OSWorld 85.2% own harness | own harness | Harness not public; metric ambiguity |
| **Microsoft Fara 1.5 (4B/9B/27B)** | Microsoft | 4B–27B | MIT | WebVoyager 89.3%, Online-Mind2Web 72.3% (27B, vendor) | Playwright; Foundry | Browser-only; "Critical Points" consent stops built in |
| EvoCUA-32B (78.26% OSWorld per OS-Helix paper table), OS-Helix-27B-RL (82.61% OSWorld hybrid, arXiv:2610.22234), Browser Use (MIT), Microsoft UFO3 (MIT), Cua infra (MIT/FSL) | various | — | mixed | arXiv 2026 | — | New research releases; verify licenses per repo |

**Safety note (agents):** GUI agents act on real desktops — sandboxed VMs, action allowlists, and human-in-the-loop for consequential actions are the documented baseline; prompt-injection via screen content is a known open risk. Voice-cloning models (Qwen3-TTS, Chatterbox, Pocket TTS) raise consent/deepfake duties — Pocket TTS gates its cloning weights behind consent terms, and Chatterbox embeds an audible-imperceptible Perth watermark.

---

## Cross-cutting conclusions

1. **No universal SOTA exists** — and the gap between open and closed also varies by modality: nearly closed in OCR (open sub-1.5B models beat frontier VLMs on OmniDocBench) and English ASR (Parakeet tops the public board); moderate in VLMs and TTS; still large in image arena Elo (~200 pts), video (Veo/Sora/Seedance/Kling closed tier), and speech-to-speech reasoning.
2. **Licensing is the sharpest 2026 fault line:** several *best-scoring* open weights are unusable commercially — MiniMax H3/H3-Image (US/EU/UK/KR excluded), Qwen-Image-2.1 (research-only), FLUX.2 [dev] & [klein] 9B (non-commercial), YuE2 & Fish Audio S2/Drama & Breeze TTS 2 (NC/revenue-capped), LTX-2.5 ($10M cap). The strongest *unconditionally permissive* (Apache 2.0/MIT) stack per domain: **Qwen3-VL** (VLU), **Z-Image Turbo + Qwen-Image-2512/Edit-2511 + FLUX.2 [klein] 4B** (image), **Wan2.2** (video), **Parakeet CC-BY / Qwen3-ASR Apache** (ASR), **Ming-3.0-tts MIT / Qwen3-TTS Apache** (TTS), **ACE-Step 1.5 MIT** (music), **PaddleOCR-VL-1.6 Apache / GLM-OCR MIT** (OCR), **OpenCUA MIT / GUI-Owl MIT / UI-TARS-7B Apache** (agents).
3. **Vendor self-reports dominate** image editing (KontextBench), GUI-agent, TTS-latency and music claims; prefer independent boards (OmniDocBench, HF Open ASR, Artificial Analysis, Arena) and re-run on your own data.
4. **Hardware reality:** sub-10B models now cover most production workloads (OCR, ASR, TTS, 4B image, 5B video) on 8–24GB GPUs; 30B-class MoE and 235B VLMs remain datacenter items.

## Source notes (selection)

Primary/official: Wan2.2 GitHub README (read in full); Qwen3-VL Technical Report (arXiv:2511.21631); Qwen3-Omni Technical Report (arXiv:2509.17765); Nemotron 3 Nano Omni (arXiv:2604.24954); NemotronLabs VoiceChat (arXiv:2609.21967); OS-Helix (arXiv:2610.22234); BFL release notes (docs.bfl.ml); OmniDocBench repo/leaderboard (github.com/opendatalab/OmniDocBench); NVIDIA PersonaPlex research page. Dated secondary aggregations cross-checked: Artificial Analysis image/editing open-weights leaderboards (Nov 2026), vdf.ai VLM & OCR comparisons (Oct 2026), AssemblyAI STT guide (Oct 2026), local-ai-zone voice models (Oct 2026), Cartesia TTS license comparison (Nov 2026), windpaint/thestudiodesk image-model rundowns (Sep–Nov 2026), localaimaster/fuser/soloa video comparisons (Aug–Nov 2026), Simular open computer-use comparison (Oct 2026), mininglamp GUI-agent roundup (Aug 2026), gpuwerk local image models (7 Nov 2026). Hugging Face model-card pages could not be opened directly from this environment (fetch rejected); card-level facts were taken from official repos, arXiv papers, vendor docs, and multiple independent sources quoting the cards, and are flagged as vendor-reported where applicable.
