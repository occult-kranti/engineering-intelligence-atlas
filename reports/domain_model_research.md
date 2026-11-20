# Open-Weight Model Research for a Local Desktop "Director" Product

**As-of date:** 2026-11-20. Compiled from 7 web research rounds (Nov 2026). The open-weight landscape changes monthly; re-verify before each release.

## Confidence labels used throughout
- **VERIFIED** — exact Hugging Face repo ID and license confirmed via official model card, official repo, or multiple independent citations of the official HF URL.
- **HIGH** — strong evidence from official blog/repo or multiple reputable secondary sources; exact card details not re-read first-hand.
- **MEDIUM** — plausible and sourced from secondary material only; verify on the official card before shipping.
- **LOW / EXCLUDED** — insufficient or conflicting evidence; intentionally not a shipping candidate.

## Read this first: model-type distinctions
1. **General LLMs** (orchestration, dialogue, reasoning) — serve via llama.cpp/Ollama/LM Studio (GGUF) or vLLM/SGLang.
2. **Tool-using coding LLMs** — LLMs trained for agentic tool calls (Qwen3-Coder line); need a tool-call parser (e.g. vLLM/SGLang `--tool-call-parser qwen3_coder`).
3. **Image/3D generative models** — diffusion/reconstruction models, **not** LLMs; run via ComfyUI/Diffusers, not Ollama.
4. There is **no credible general "gaming foundation model"** and no "3D LLM": gaming = small LLMs for NPC dialogue + separate asset-generation models; Blender = LLM-generated Python via add-ons/MCP + dedicated image-to-3D models. Do not present anything as a domain-specific "game model."

---

## SECTION A — SHIPPING CANDIDATES (verified repo IDs, permissive licenses)

### A1. Coding / agentic LLMs

| Model | HF repo | Size / arch | Context | License | Local viability | Confidence |
|---|---|---|---|---|---|---|
| Qwen3-Coder-Next | https://huggingface.co/Qwen/Qwen3-Coder-Next | 80B MoE, **3B active**; hybrid Gated DeltaNet + MoE, 512 experts/10 active | 256K native (1M via YaRN) | **Apache 2.0** | Top-tier local coder. Unsloth documents ~46GB RAM/VRAM at 4-bit GGUF, ~85GB at 8-bit; official + Unsloth GGUFs (https://huggingface.co/unsloth/Qwen3-Coder-Next-GGUF). Released Feb 2026. | VERIFIED |
| Qwen3-Coder-30B-A3B-Instruct | https://huggingface.co/Qwen/Qwen3-Coder-30B-A3B-Instruct | 30.5B MoE, 3.3B active, 128 experts/8 | 262,144 native (1M via YaRN) | **Apache 2.0** (FP8 twin: https://huggingface.co/Qwen/Qwen3-Coder-30B-A3B-Instruct-FP8) | Best 24GB-GPU coding agent (~17GB at Q4_K_M + KV cache). Non-thinking only; own function-call format; works with Qwen Code / Cline. | VERIFIED |
| Qwen3-Coder-480B-A35B-Instruct | https://huggingface.co/Qwen/Qwen3-Coder-480B-A35B-Instruct | 480B MoE, 35B active, 160 experts | 262,144 native (1M via YaRN) | **Apache 2.0** | **Server/API tier, not desktop** (~960GB at FP16; multi-GPU vLLM/SGLang). For a desktop product use the hosted API instead. | VERIFIED |

Notes: Qwen's benchmark figures (e.g. ~70% SWE-bench Verified for Coder-Next; 44.3% SWE-bench Pro) are **vendor-reported**; run your own evals. All three are non-thinking checkpoints. Sources: Qwen blog (https://qwenlm.github.io/blog/qwen3-coder/), model cards above, https://unsloth.ai/docs/models/qwen3-coder-next.

### A2. General-purpose LLMs (director/orchestrator brain)

| Model | HF repo | Size | Context | License | Notes | Confidence |
|---|---|---|---|---|---|---|
| Qwen3-8B | https://huggingface.co/Qwen/Qwen3-8B | 8B dense | 32K–128K | **Apache 2.0** | Entry-tier brain; also supported by NVIDIA ACE for on-device NPCs | VERIFIED |
| Qwen3-Next-80B-A3B-Instruct | https://huggingface.co/Qwen/Qwen3-Next-80B-A3B-Instruct | 80B MoE, 3B active | 262K | **Apache 2.0** | Same hybrid arch family as Coder-Next; strong general + long context | VERIFIED |
| gpt-oss-20b | https://huggingface.co/openai/gpt-oss-20b | 20.9B MoE | 128K | **Apache 2.0** (+ OpenAI usage policy) | MXFP4 native; fits ~16GB cards; solid tool calling; Western-lab option | VERIFIED |
| Mistral Small 3.2 24B | https://huggingface.co/mistralai/Mistral-Small-3.2-24B-Instruct-2506 | 24B dense | 128K | **Apache 2.0** | Fast, vision-capable instruct; good mid-tier default | HIGH |

### A3. Image generation (design/art) — diffusion models, run in ComfyUI/Diffusers

| Model | HF repo | Size | License | Hardware (sourced) | Confidence |
|---|---|---|---|---|---|
| Qwen-Image-2512 | https://huggingface.co/Qwen/Qwen-Image-2512 | ~20B MMDiT (+Qwen2.5-VL-7B encoder) | **Apache 2.0** | ~42GB BF16 / ~22GB FP8 (vendor + community); GGUF/Nunchaku builds go lower | VERIFIED |
| Qwen-Image (original) | https://huggingface.co/Qwen/Qwen-Image | 20B MMDiT | **Apache 2.0** | ~40GB BF16; ~16GB FP8; ~8GB via GGUF/Nunchaku 4-bit (community builds) | VERIFIED |
| Qwen-Image-Edit-2509 | https://huggingface.co/Qwen/Qwen-Image-Edit-2509 | 20B-class editor | **Apache 2.0** | Multi-image editing (1–3 refs); Nunchaku INT4/FP4 builds exist | VERIFIED |
| FLUX.2 [klein] 4B | https://huggingface.co/black-forest-labs/FLUX.2-klein-4B | 4B rectified-flow | **Apache 2.0** (ungated) | BFL states ~13GB VRAM; 4-step distilled; generation + multi-reference editing | VERIFIED |
| FLUX.1 [schnell] | https://huggingface.co/black-forest-labs/FLUX.1-schnell | 12B | **Apache 2.0** | GGUF builds run on 8–12GB cards | VERIFIED |
| Z-Image-Turbo | https://huggingface.co/Tongyi-MAI/Z-Image-Turbo | 6B single-stream DiT | **Apache 2.0** | Card claims 16GB consumer GPU fit; 8-step; bilingual text rendering; no CFG/negative prompt, low seed diversity | VERIFIED |
| SDXL base 1.0 | https://huggingface.co/stabilityai/stable-diffusion-xl-base-1.0 | ~3.5B | CreativeML OpenRAIL++-M (commercial OK, use-based restrictions, no revenue cap) | 8–12GB; deepest LoRA/ControlNet ecosystem | VERIFIED |

### A4. 3D generation / rigging (Blender pipeline)

| Model | Repo | License | Hardware (sourced) | Confidence |
|---|---|---|---|---|
| TRELLIS.2-4B (Microsoft) | https://huggingface.co/microsoft/TRELLIS.2-4B (code: https://github.com/microsoft/TRELLIS.2) | **MIT** | 24GB NVIDIA GPU minimum per repo; ~3s (512³) to ~60s (1536³) on H100; single-image input; GLB + PBR output. **Dependency caveat:** nvdiffrast/nvdiffrec are non-commercial (visualization only, can be omitted); DINOv3 is a mandatory gated dependency — check its license | VERIFIED |
| TripoSR (Stability × Tripo) | https://huggingface.co/stabilityai/TripoSR | **MIT** | ~6GB VRAM; sub-second single-image draft meshes; vertex colors, low fidelity — drafts only | VERIFIED |
| UniRig (Tsinghua × VAST) | https://huggingface.co/VAST-AI/UniRig (code: https://github.com/VAST-AI-Research/UniRig) | **MIT** (code; confirm checkpoint terms on card) | ≥8GB VRAM per repo; auto skeleton + skinning for generated meshes; exports FBX/GLB | VERIFIED |

Blender integration itself uses **LLM-generated Python** via add-ons: BlenderGPT lineage (https://github.com/gd3kr/BlenderGPT), blender-llm-addin with Ollama (https://github.com/mac999/blender-llm-addin), or Blender MCP driven by any local model through Ollama's OpenAI-compatible endpoint (`http://localhost:11434/v1`).

### A5. Voice / TTS (NPC dialogue layer)

| Model | HF repo | License | Notes | Confidence |
|---|---|---|---|---|
| Chatterbox family | https://huggingface.co/ResembleAI/chatterbox (+ Turbo/Nano/Multilingual variants) | **MIT** | 0.5B Llama-backbone TTS, zero-shot voice cloning, emotion tags, built-in PerTh watermark. **Important:** Resemble AI retired/unmaintained the project as of Aug 2026 — usable but frozen (https://github.com/resemble-ai/chatterbox) | VERIFIED |

### A6. Cybersecurity

| Model | HF repo | License | Notes | Confidence |
|---|---|---|---|---|
| Foundation-Sec-8B | https://huggingface.co/fdtn-ai/Foundation-Sec-8B | Apache 2.0 (per official quant card "same as base"; confirm LICENSE in repo) | Cisco Foundation AI; Llama-3.1-8B continued-pretrained on CVEs/threat intel/compliance corpus; SOC triage, threat intel; one-GPU deployable | VERIFIED (license: HIGH) |
| Foundation-Sec-8B-Reasoning | https://huggingface.co/fdtn-ai/Foundation-Sec-8B-Reasoning | Apache 2.0 (same note) | Jan 2026 reasoning variant; 32K context; 98.25% HarmBench protection when paired with Llama Guard (vendor figure) | VERIFIED (license: HIGH) |

Reality check: on hard offensive tasks (NYU CTF Bench, Apr 2026) open weights trail frontier closed models by a wide margin (top open ~19.5% vs Claude Opus 4.5 59%). For serious CTF/offensive analysis a **cloud API is more appropriate**; Foundation-Sec is for SOC/threat-intel/triage, not elite exploitation.

---

## SECTION B — RESTRICTED: usable but gated by license terms (require explicit legal review / user acknowledgment)

| Model | Repo | Restriction | Confidence |
|---|---|---|---|
| Hunyuan3D 2.1 (Tencent) | https://huggingface.co/tencent/Hunyuan3D-2.1 | Tencent Hunyuan Community License: **excludes EU/UK/South Korea**, separate license >1M MAU, no training other models on outputs. README VRAM: 10GB shape / 21GB texture / 29GB full. Note: 2.5/3.0/3.1 are **API-only, no public weights** | VERIFIED |
| FLUX.2 [dev] / FLUX.2 [klein] 9B / FLUX.1 [dev] | https://huggingface.co/black-forest-labs/FLUX.2-dev | FLUX Non-Commercial License v2.1 — weights free for research/personal use; commercial use needs a paid BFL license | VERIFIED |
| Stable Diffusion 3.5 | https://huggingface.co/stabilityai/stable-diffusion-3.5-large | Stability AI Community License — free only <$1M annual revenue; Enterprise license above | VERIFIED |
| Llama 3.3 8B/70B | https://huggingface.co/meta-llama/Llama-3.3-8B-Instruct | Llama Community License — commercial OK with conditions (700M MAU cap, acceptable-use policy, "Built with Llama" attribution) | VERIFIED |
| HunyuanImage (Tencent) | (HF, Tencent org) | Tencent Community License — EU/UK/SK exclusion | HIGH |

## SECTION C — NEEDS RE-VERIFICATION (do NOT ship from this list yet)

| Item | Why it's here | Confidence |
|---|---|---|
| Qwen3-TTS (voice design / cloning) | Family exists (e.g. repo pattern `Qwen/Qwen3-TTS-12Hz-1.7B-VoiceDesign`, `...-0.6B-Base`) but exact current repo IDs and the "Qwen3-TTS License Agreement" terms were not confirmed on official cards. Community nodes note weights are subject to a separate Qwen3-TTS license, not plain Apache 2.0 | MEDIUM |
| Qwen-Image-2.1 / 2.1-Turbo (7B, Sep–Oct 2026) | One detailed source says **Qwen Research License, non-commercial**; others are vague. Verify the license tag on the official card before any use | MEDIUM |
| FLUX 3 Image [klein] (5.6B, Oct 2026) | Open weights under the new "FLUX Kommunity License" (revenue-capped per secondary sources); terms not read first-hand | MEDIUM |
| Qwen3.5 / Qwen3.8 generation (e.g. Qwen3.5-9B, Qwen3.5-27B, Qwen3.8-27B) | Repeatedly cited in 2026 secondary sources with 262K context and Apache 2.0, but official card details not verified here | MEDIUM |
| Gemma 4 family (Google, Apr 2026) | Reported Apache 2.0 with 26B-A4B MoE and 31B dense; verify on https://huggingface.co/google | MEDIUM |
| SAM 3D (Meta, Nov 2025) | Single-photo-to-mesh (objects + bodies); repo/license not verified here | MEDIUM |
| Devstral Small 2 (Mistral) | Cited as 24B Apache 2.0 coding model; exact current HF ID not verified | MEDIUM |
| Hunyuan3D-Omni / Hunyuan3D-Part | Open sibling releases (Sep 2025) under the same restricted Tencent community license | MEDIUM |
| Ideogram 4.0 weights | Weights non-commercial; code Apache 2.0 — excluded from shipping set | HIGH (as restricted) |
| Fish Speech 1.5 | Code open but weights CC-BY-NC-SA — non-commercial; excluded | HIGH (as restricted) |

## SECTION D — Serving routes and hardware tiers

**Downloads:** official org repos on Hugging Face (links above) or ModelScope; GGUF quants from `unsloth/` or `bartowski/`; pin exact revisions; read the LICENSE file in each repo at pin time (siblings in one family can differ — e.g. FLUX.2 klein 4B Apache vs 9B non-commercial).

**LLM serving:**
- llama.cpp: `llama-server -hf <org>/<repo>-GGUF:Q4_K_M` (Q4_K_M default; Q5_K_M/Q6_K for tool-calling reliability per Unsloth guidance).
- Ollama: default tags are Q4_K_M; **set `num_ctx` explicitly** (Ollama defaults to 4K context below ~24GB VRAM, 32K at 24–48GB).
- Production/agentic: vLLM or SGLang with `--tool-call-parser qwen3_coder` for Qwen coder models.

**Image/3D serving:** ComfyUI (native Qwen-Image, FLUX.2, TRELLIS.2, Hunyuan3D support), Diffusers, InvokeAI. TRELLIS.2 requires gated DINOv3 + RMBG-2.0 access via `hf auth login`.

**Minimum-viable tiers (weights + KV cache + overhead; measure on target hardware — no guarantees):**
- **8GB VRAM / 16GB RAM:** 3B–8B LLMs at Q4_K_M (Qwen3-8B), FLUX.1 schnell GGUF, TripoSR, Foundation-Sec-8B (Q8 ~8.5GB).
- **16–24GB VRAM** (sweet spot): Qwen3-Coder-30B-A3B at Q4 (~17GB + KV), Mistral Small 24B, gpt-oss-20b, Qwen-Image FP8, FLUX.2 klein 4B, TRELLIS.2 (24GB), Hunyuan3D 2.1 shape-only.
- **32–64GB** (RTX 5090 / 64GB Mac): Qwen3-Coder-Next at Q4 (~46GB), Hunyuan3D full pipeline (29GB).
- **>64GB / 480B-class:** use cloud APIs (Alibaba DashScope, OpenRouter, Together, etc.) — do not promise local.

## SECTION E — Recommendations
1. **Orchestrator brain:** Mistral Small 24B or gpt-oss-20b default; Qwen3-8B at the minimum tier. (Qwen3.5/3.8 pending re-verification in Section C.)
2. **Coding agent:** Qwen3-Coder-30B-A3B-Instruct standard tier; Qwen3-Coder-Next on ≥46GB machines; 480B via cloud API only.
3. **Image:** FLUX.2 [klein] 4B (Apache 2.0) + Qwen-Image-2512 for text-heavy design; keep FLUX [dev]/SD3.5 behind license acknowledgment.
4. **3D:** TRELLIS.2-4B (MIT) default; Hunyuan3D 2.1 only with EU/UK/SK geo check; TripoSR low-end; UniRig for rigging.
5. **Gaming:** ship the NPC pattern (small local LLM + guardrails + canned fallback), not a "game model"; note Steam's Jan 2026 AI-disclosure rules for pre-generated and live-generated content.
6. **Cybersecurity:** Foundation-Sec-8B(-Reasoning) for SOC/threat-intel; disclose the open-vs-frontier capability gap; route hard offensive work to cloud APIs.
7. **Always:** vendor benchmarks (Qwen's especially) are self-reported — evaluate on your own tasks; treat 256K/1M context claims as memory-costly and verify usable-context accuracy (RULER/NoLiMa show degradation well below advertised windows).
