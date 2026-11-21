# Model Selection

Open-weight model candidates by domain, with verified Hugging Face repos and licenses. As-of 2026-11-20; the landscape changes monthly — re-verify on the official model card at pin time.

Confidence labels: **VERIFIED** = HF repo ID and license confirmed via official card/repo; **HIGH** = strong evidence, card not re-read first-hand; **MEDIUM** = secondary only, verify before use; **EXCLUDED** = not a shipping candidate.

## Contents
- Model-type distinctions
- Shipping candidates: coding LLMs, general LLMs, image, 3D, voice, cybersecurity
- Restricted licenses (need explicit user acknowledgment)
- Needs re-verification (do NOT install from this list)
- Hardware tiers
- Vendor-benchmark caveat

## Model-type distinctions

1. **General LLMs** (orchestration, dialogue, reasoning) — llama.cpp/Ollama (GGUF) or vLLM/SGLang.
2. **Tool-using coding LLMs** — trained for agentic tool calls; need a tool-call parser (e.g. vLLM/SGLang `--tool-call-parser qwen3_coder`).
3. **Image/3D generative models** — diffusion/reconstruction models, **not** LLMs; run via ComfyUI/Diffusers, not Ollama.
4. **No credible general "gaming foundation model" and no "3D LLM" exists.** Gaming = small LLMs for NPC dialogue + separate asset-generation models; Blender = LLM-generated Python via add-ons/MCP + dedicated image-to-3D models. Never present any model as a domain-specific "game model."

## Shipping candidates (VERIFIED repos, permissive licenses)

### Coding / agentic LLMs

| Model | HF repo | Size / context | License | Notes |
|---|---|---|---|---|
| Qwen3-Coder-Next | https://huggingface.co/Qwen/Qwen3-Coder-Next | 80B MoE, 3B active; 256K native (1M via YaRN) | Apache-2.0 | Top-tier local coder. Unsloth documents ~46 GB RAM/VRAM at 4-bit GGUF, ~85 GB at 8-bit. GGUFs: https://huggingface.co/unsloth/Qwen3-Coder-Next-GGUF |
| Qwen3-Coder-30B-A3B-Instruct | https://huggingface.co/Qwen/Qwen3-Coder-30B-A3B-Instruct | 30.5B MoE, 3.3B active; 262K | Apache-2.0 | Best 24 GB-GPU coding agent (~17 GB at Q4_K_M + KV). Non-thinking; own function-call format. GGUF mirror: https://huggingface.co/ggml-org/Qwen3-Coder-30B-A3B-Instruct-GGUF (the `Qwen/`-org GGUF repo was NOT found during research — always confirm the repo exists before scripting a download) |
| Qwen3-Coder-480B-A35B-Instruct | https://huggingface.co/Qwen/Qwen3-Coder-480B-A35B-Instruct | 480B MoE; 262K | Apache-2.0 | Server/API tier, not desktop (~960 GB FP16). Use hosted API. |

### General-purpose LLMs (director/orchestrator)

| Model | HF repo | Size / context | License | Notes |
|---|---|---|---|---|
| Qwen3-8B | https://huggingface.co/Qwen/Qwen3-8B (GGUF: /Qwen/Qwen3-8B-GGUF) | 8B dense; 32K–128K | Apache-2.0 | Entry-tier brain; also used by NVIDIA ACE for on-device NPCs |
| Qwen3-Next-80B-A3B-Instruct | https://huggingface.co/Qwen/Qwen3-Next-80B-A3B-Instruct | 80B MoE, 3B active; 262K | Apache-2.0 | Strong general + long context |
| gpt-oss-20b | https://huggingface.co/openai/gpt-oss-20b | 20.9B MoE; 128K | Apache-2.0 (+ OpenAI usage policy) | MXFP4 native; fits ~16 GB cards; solid tool calling |
| Mistral Small 3.2 24B | https://huggingface.co/mistralai/Mistral-Small-3.2-24B-Instruct-2506 | 24B dense; 128K | Apache-2.0 | Vision-capable; good mid-tier default. Confidence: HIGH |

### Image generation (ComfyUI/Diffusers — not Ollama)

| Model | HF repo | License | Hardware (sourced, not guaranteed) |
|---|---|---|---|
| Qwen-Image-2512 | https://huggingface.co/Qwen/Qwen-Image-2512 | Apache-2.0 | ~42 GB BF16 / ~22 GB FP8; GGUF/Nunchaku builds lower |
| FLUX.2 [klein] 4B | https://huggingface.co/black-forest-labs/FLUX.2-klein-4B | Apache-2.0 (ungated) | BFL states ~13 GB VRAM; 4-step distilled; generation + editing |
| FLUX.1 [schnell] | https://huggingface.co/black-forest-labs/FLUX.1-schnell | Apache-2.0 (repo is gated:auto — requires accepting terms) | GGUF builds run on 8–12 GB cards |
| Z-Image-Turbo | https://huggingface.co/Tongyi-MAI/Z-Image-Turbo | Apache-2.0 | Card claims 16 GB consumer GPU fit; no CFG/negative prompt |
| SDXL base 1.0 | https://huggingface.co/stabilityai/stable-diffusion-xl-base-1.0 | CreativeML OpenRAIL++-M (commercial OK, use-based restrictions) | 8–12 GB; deepest LoRA/ControlNet ecosystem |

### 3D generation / rigging

| Model | Repo | License | Notes |
|---|---|---|---|
| TRELLIS.2-4B | https://huggingface.co/microsoft/TRELLIS.2-4B (code: https://github.com/microsoft/TRELLIS.2) | MIT | 24 GB NVIDIA GPU minimum per repo; GLB+PBR output. **Dependency caveats:** nvdiffrast/nvdiffrec are non-commercial (can be omitted); DINOv3 is a mandatory **gated** dependency — check its license; requires `hf auth login` |
| TripoSR | https://huggingface.co/stabilityai/TripoSR | MIT | ~6 GB VRAM; sub-second draft meshes; low fidelity — drafts only |
| UniRig | https://huggingface.co/VAST-AI/UniRig | MIT (code; confirm checkpoint terms on card) | ≥8 GB VRAM per repo; auto skeleton + skinning; FBX/GLB export |

Blender integration: LLM-generated Python via add-ons (BlenderGPT lineage https://github.com/gd3kr/BlenderGPT; blender-llm-addin https://github.com/mac999/blender-llm-addin) or Blender MCP through Ollama's OpenAI-compatible endpoint `http://localhost:11434/v1`.

### Voice / TTS (NPC dialogue layer)

| Model | HF repo | License | Notes |
|---|---|---|---|
| Chatterbox family | https://huggingface.co/ResembleAI/chatterbox | MIT | 0.5B zero-shot TTS with watermark. **Retired/unmaintained by Resemble AI as of Aug 2026** — usable but frozen. |

### Cybersecurity

| Model | HF repo | License | Notes |
|---|---|---|---|
| Foundation-Sec-8B | https://huggingface.co/fdtn-ai/Foundation-Sec-8B | **"other" — read NOTICE at pin time** | Cisco Foundation AI; Llama-3.1-8B base continued-pretrained on security corpus. Repo NOTICE: Llama 3.1 Community License applies to the base; Cisco's changes are Apache-2.0. HF tag is `license:other`, not plain Apache-2.0 — verify before commercial use |
| Foundation-Sec-8B-Reasoning | https://huggingface.co/fdtn-ai/Foundation-Sec-8B-Reasoning | same note | Jan 2026 reasoning variant; 32K context; vendor claims 98.25% HarmBench protection when paired with Llama Guard (vendor figure) |

**Capability reality check:** on hard offensive tasks (NYU CTF Bench, Apr 2026) open weights trail frontier closed models widely (top open ~19.5% vs Claude Opus 4.5 59%). Use Foundation-Sec for SOC triage/threat intel; route serious offensive analysis to cloud APIs within budget limits.

## Restricted: usable only with explicit user acknowledgment of terms

| Model | Repo | Restriction |
|---|---|---|
| Hunyuan3D 2.1 | https://huggingface.co/tencent/Hunyuan3D-2.1 | Tencent Community License: **excludes EU/UK/South Korea**; separate license >1M MAU. 2.5/3.0/3.1 are API-only, no public weights |
| FLUX.2 [dev], FLUX.2 [klein] 9B, FLUX.1 [dev] | https://huggingface.co/black-forest-labs/FLUX.2-dev | FLUX Non-Commercial License v2.1 — commercial use needs paid BFL license |
| Stable Diffusion 3.5 | https://huggingface.co/stabilityai/stable-diffusion-3.5-large | Stability Community License — free only <$1M annual revenue |
| Llama 3.3 8B/70B | https://huggingface.co/meta-llama/Llama-3.3-8B-Instruct | Llama Community License — 700M MAU cap, acceptable-use policy, "Built with Llama" attribution |

Sibling models in one family can differ in license (FLUX.2 klein 4B Apache-2.0 vs klein 9B non-commercial) — read the LICENSE in each repo at pin time.

## Needs re-verification — do NOT install from this list

Qwen3-TTS family (separate license agreement, unconfirmed); Qwen-Image-2.1/2.1-Turbo (one source claims non-commercial Qwen Research License); FLUX 3 Image [klein] ("FLUX Kommunity License", terms unread); Qwen3.5/Qwen3.8 generation; Gemma 4 family; SAM 3D; Devstral Small 2; Hunyuan3D-Omni/Part. **EXCLUDED as non-commercial:** Ideogram 4.0 weights; Fish Speech 1.5 (CC-BY-NC-SA).

## Hardware tiers (weights + KV + overhead — estimates, measure on target)

- **8 GB VRAM / 16 GB RAM:** 3B–8B LLMs at Q4_K_M (Qwen3-8B), FLUX.1 schnell GGUF, TripoSR, Foundation-Sec-8B (Q8 ~8.5 GB).
- **16–24 GB VRAM (sweet spot):** Qwen3-Coder-30B-A3B at Q4 (~17 GB + KV), Mistral Small 24B, gpt-oss-20b, Qwen-Image FP8, FLUX.2 klein 4B, TRELLIS.2 (24 GB), Hunyuan3D 2.1 shape-only.
- **32–64 GB:** Qwen3-Coder-Next at Q4 (~46 GB), Hunyuan3D full pipeline (29 GB).
- **>64 GB / 480B-class:** use cloud APIs — do not promise local.

## Serving routes

- llama.cpp: `llama-server -hf <org>/<repo>-GGUF:Q4_K_M` (Q4_K_M default; Q5_K_M/Q6_K for tool-calling reliability per Unsloth guidance).
- Ollama: default tags are Q4_K_M; **set `num_ctx` explicitly**.
- Agentic/production: vLLM or SGLang with `--tool-call-parser qwen3_coder` for Qwen coder models.
- Image/3D: ComfyUI (native Qwen-Image, FLUX.2, TRELLIS.2, Hunyuan3D support), Diffusers, InvokeAI.

## Vendor-benchmark caveat

Vendor benchmark figures (e.g. Qwen's ~70% SWE-bench Verified for Coder-Next) are **self-reported** — run task-representative evals on the user's hardware. Treat 256K/1M context claims as memory-costly and verify usable-context accuracy (RULER/NoLiMa show degradation well below advertised windows).

## Gaming note

Ship the NPC pattern (small local LLM + guardrails + canned fallback), not a "game model." Note Steam's Jan 2026 AI-disclosure rules for pre-generated and live-generated content if the user ships a game.
