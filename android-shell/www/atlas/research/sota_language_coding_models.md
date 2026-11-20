# Open-Weight / Open-Source SOTA Language & Coding Models — as of 2026-11-20

**Scope.** Current state of open-weight (downloadable weights) and fully open-source (weights + data + code) LLMs across: general language, reasoning, coding, agentic tool use, long context, multilingual, small/edge, and mixture-of-experts (MoE) architectures.

**Method & evidence rules.** ≥6 search rounds plus direct reads of primary/near-primary sources (vendor model cards, arXiv papers, official announcements, HF architecture graphs derived from configs). Benchmark numbers are tagged **[V]** = vendor-reported (model card / lab blog, not independently reproduced) or **[I]** = independently measured (Artificial Analysis, LMArena/Arena AI, Vals, LiveBench, academic papers), with the measurement/reporting date where known. All "leader" claims are scoped to a benchmark and date; **there is no universal "best" model** — ranking flips with task, license constraint, hardware, and token budget.

**Open weights ≠ open source.** Almost everything below is *open-weight*: you can download, run, and fine-tune, but training data and full training recipes are not published, and several licenses (Llama Community, Kimi K3, GLM-5.3, MiniMax Community, Mistral Ecosystem OWL, OpenMDW) carry conditions that OSI-approved licenses (Apache 2.0, MIT) do not. The only families below with meaningful data/recipe disclosure are SmolLM3, OLMo 3, MiniCPM5 (UltraData), and NVIDIA Nemotron 3 (datasets + NeMo recipes, though under NVIDIA/ OpenMDW licenses).

---

## 1. Frontier landscape snapshot (Nov 2026)

| Model / repo | Lab | Total / active params | Context | Modality | License | Headline evidence (dated) |
|---|---|---|---|---|---|---|
| `moonshotai/Kimi-K3.1-Pro` | Moonshot AI | 2.8T / 104B MoE (16 of 896 experts + 2 shared) | 1M | text+image in | Kimi K3.1 Pro License (MIT-style; extra terms >$20M rev or >100M MAU) | 65.7 Terminal-Bench 4.0 **[V, Nov 2026]**; AA Intelligence Index v5 = 46, top open-weight **[I, Oct 27 2026]** |
| `moonshotai/Kimi-K3` | Moonshot AI | 2.8T / 104B MoE, 93 layers, 69 KDA + 24 Gated-MLA hybrid attn | 1M | text+image in | Kimi K3 License (custom) | 88.3 Terminal-Bench 2.1, 81.2 FrontierSWE, 93.5 GPQA Diamond **[V, Jul 2026]**; AA idx 57–59 **[I, Jul–Aug 2026]** |
| `deepseek-ai/DeepSeek-V4.1-Flash` (incl. -1017 update) | DeepSeek | 552B backbone + 196B "Engram" memory; 8B active prefill / 16B decode; causal encoder–decoder MoE (384 experts, 6+1 active) | 1M (384K max output) | text+image in | **MIT** | 90.6 Terminal-Bench 2.1, 74.2 DeepSWE v1.1, 3471 Codeforces, 90.9 GPQA **[V, Sep 10 2026]**; 1017: 77.0 DeepSWE, 42.3 TB 4.0 **[V, Oct 17 2026]**; AA idx 39, #8 of 173 open **[I]** |
| `deepseek-ai/DeepSeek-V4-Pro-0813` | DeepSeek | 1.6T / 49B MoE | 1M | text | **MIT** | 87.9 TB 2.1, 62.7 DeepSWE **[V, Aug 2026]**; (April-preview 80.6 SWE-bench Verified often misquoted for this build) |
| `zai-org/GLM-5.3` | Z.ai | 753B / ~40B MoE (256 routed, 8+1/token, 78 layers, MLA) | 1M (128K out) | text only | GLM-5.3 License (MIT-like + $10B-revenue MaaS security-review clause) | TB 3.0 4.6→28.3, DeepSWE 46.2→66.9, CyberGym 84.5 **[V, Aug 2026]**; AA idx v4.3 = 45, #1 of 112 open **[I, Sep 7 2026]** |
| `zai-org/GLM-5.3-Flash` | Z.ai | 320B / 18B MoE | 1M | text+image+video | **MIT** | Beats GLM-5.2 at ~1/10 price **[V]** |
| `mistralai/Mistral-Large-4-1T-A52B` | Mistral AI | 1.05T / 52B granular MoE (128 experts, 4+1 active) + 1.6B ViT | 1M | text+image in | Mistral Ecosystem Open-Weight License (modified MIT; MaaS needs separate license) | DeepSWE 61.7, Cybench 93%, CyberGym-E2E 82% **[V, Oct 2026]**; AA idx v5 = 26 **[I, Oct 30 2026]** |
| `mistralai/Mistral-Small-4-119B-2603` (+NVFP4) | Mistral AI | 119B / ~6.5B MoE (128 experts, 4 active) | 256K | text+image in | **Apache 2.0** | GPQA 71.2 w/ reasoning **[V]**; AA idx 11 (reasoning on) vs Large 3 = 9 **[I, Oct 14 2026]** |
| `Qwen/Qwen3.5-397B-A17B` | Alibaba | 397B / 17B MoE (512 experts, 10+1 active), Gated DeltaNet hybrid | 262K | text+image+video | **Apache 2.0** | 76.2% SWE-bench Verified **[V, Feb 2026]**; Arena Elo 1444 **[I]** |
| `Qwen/Qwen3.8-27B` | Alibaba | 27.78B dense; 64 layers, 48 linear-attn (Gated DeltaNet) + 16 full-attn, MTP layer | 262K (1M on hosted Qwen Cloud) | text+image in | **Apache 2.0** | SWE-bench Pro 61.7%, TB 2.1 73.0, OSWorld-Verified 84.3 **[V, Aug 14 2026]**; SWE-bench Verified ~81% per Vals **[I, Sep 2026]** |
| `openai/gpt-oss-120b` | OpenAI | 116.83B / 5.13B MoE (128 experts, top-4, 36 layers) | 131K | text only | **Apache 2.0** | MMLU 90.0, GPQA 80.9, SWE-bench Verified 62.4, AIME'25 97.9 (tools), Codeforces 2622 Elo **[V, Aug 5 2025]** |
| `openai/gpt-oss-20b` | OpenAI | 20.91B / 3.61B MoE (32 experts, top-4) | 131K | text only | **Apache 2.0** | ≈ o3-mini on common benchmarks; SWE-bench Verified 60.7 **[V]**; runs in 16 GB |
| `MiniMax-M3` | MiniMax | 428B / ~23B MoE + MiniMax Sparse Attention | 1M | text+image+video in | MiniMax Community License (**non-commercial by default**) | 80.5% SWE-bench Verified, 59.0 SWE-bench Pro **[V, Jun 2026]**; Vals Index #6, top open-weight on LegalBench/MedCode/Finance Agent **[I, Jun 2 2026]** |
| `nvidia/NVIDIA-Nemotron-3-Ultra-550B-A55B-BF16` | NVIDIA | 550B / 55B hybrid Mamba-2 + attention + LatentMoE (512 experts, top-22), MTP | 1M | text | OpenMDW-1.1 | ~48 AA idx — leading US open-weight **[V/I, Jun 2026]**; 70.7% SWE-bench Verified **[V]** |
| `nvidia/Nemotron-3-Super` | NVIDIA | 120B / 12B hybrid Mamba-MoE | 1M (262K on some hosts) | text | NVIDIA Open Model License | >50% higher token throughput than leading open models **[V]**; weights + datasets + NeMo Gym recipes published |
| `Beam-501B-A23B` | Reflection AI | 501B / 23B MoE, 52 layers | 1M pretrained (262K API) | text | **Apache 2.0** (promised at launch) | SWE-bench Verified 80.9, TB 2.1 80.1, HLE 36.2 **[V, Oct 5 2026, unreproduced]** |
| `Muse Spark Open` | Meta | 816B / 42B MoE (8 of 256 experts) | 1M | text+image+audio+video in | Muse Model License (notice requirement; >$20M/yr API providers need agreement) | Weights Oct 15 2026 (BF16 ~1.5 TB, NVFP4); NVFP4 runs on one B200 node **[V]** |
| `MiMo-V2.5-Pro` | Xiaomi | 1.02T / ~42B MoE | 1M | text | **MIT** | Arena Elo 1466 **[I]** (via Gemma 4 tech report table) |
| `LongCat-2.5` | Meituan | 1.6T / ~48B MoE | 1M | native multimodal | **MIT** (weights Nov 10 2026) | 59.5 SWE-bench Pro, 70.8 TB 2.1, 77.3 SWE-bench Multilingual **[V]** (LongCat-2.0, Jun 2026) |

---

## 2. Category-by-category

### 2.1 General language / overall capability
- **Kimi K3.1 Pro** is the strongest independently-measured open weight as of Nov 2026 (AA Intelligence Index v5 = 46, top open-weight **[I, Oct 27 2026]**); Kimi K3 before it held AA #1-of-98 at 57 on the older index scale **[I, Jul 2026]**.
- Independent leaderboards (benchlm, Nov 19 2026) rank Kimi K3.1 Pro > Kimi K3 > Ling 3.1 Flash > DeepSeek V4.1 Flash 1017 > Qwen3.8 Max among open weights — but the same source notes the top open model (71.2/100) sits only #17 overall vs closed frontier (92.8), and evidence labels are partly "Estimated."
- Caveat: index-methodology changed in late Oct 2026 (AA v4.3.2 → v5), so cross-date score comparisons are invalid.

### 2.2 Reasoning (math / science)
- **GLM-5.2 (MIT)**: AIME 2026 99.2, GPQA Diamond 91.2 **[V]**; still the strongest plain-MIT reasoning model.
- **Kimi K3**: GPQA Diamond 93.5, BrowseComp 91.2 **[V]**; ties GPT-5.5 on GPQA but trails Fable 5 / GPT-5.6 Sol on Humanity's Last Exam w/o tools (per Moonshot's own card).
- **gpt-oss-120b**: AIME 2025 97.9% (high effort, tools), GPQA 80.9 **[V, Aug 2025]**; near-parity with o4-mini on core reasoning per OpenAI.
- **Nemotron 3 Nano** (30B total / ~3.5B active): AIME 2025 99.2% with tools **[V]** — exceptional for its active-parameter budget.
- **DeepSeek-V3.2** (685B/37B, MIT, Dec 2025; arXiv:2512.02556 — primary paper): AIME 2025 93.1, HMMT Feb 2025 92.5, GPQA 82.4, Codeforces 2386 **[V]**. IMO/IOI/ICPC-level results reported for V3.2 Speciale.
- Known failure mode: reasoning models are verbose — GLM-5.3 burned 210M output tokens on the AA index vs 120M open-weight median **[I]**; Kimi K3.1 Pro ~55K output tokens/task **[I]**. Token cost, not accuracy, is often the deciding factor.

### 2.3 Coding
- SWE-bench **Verified is near-saturated** at the frontier (DeepSeek-V4-Pro 80.6% **[V]**, Qwen3.6-27B 77.2% **[V]**); discriminating benchmarks are now SWE-bench Pro, FrontierSWE, DeepSWE v1.1, Terminal-Bench 2.1/3.0/4.0.
- **Terminal-Bench 2.1**: DeepSeek-V4.1-Flash 90.6 **[V]** (88.0 in Claude Code harness); Kimi K3 88.3 **[V]**, GLM-5.3 88.2 (DeepSeek cross-vendor table) — the 90.6 leads only if reproduced; independent LiveBench ranks V4.1-Flash #1 in agentic coding **[I, Nov 2026]**.
- **FrontierSWE**: Kimi K3 81.2 vs Claude Fable 5 86.6 **[V]** — open still trails the closed frontier here.
- **Single-GPU coding**: Qwen3.8-27B (Apache 2.0, dense 27B): SWE-bench Pro 61.7, TB 2.1 73.0 **[V, Aug 2026]**; Qwen3.6-35B-A3B (35B/3B MoE): SWE-bench Verified 73.4 **[V, Apr 2026]**; Devstral 2 (~12B active): SWE-bench Verified 72.2 **[V]**.
- **Competition programming**: gpt-oss-120b Codeforces 2622 Elo **[V]**; DeepSeek-V4.1-Flash 3471 **[V]**.
- **Failure evidence**: DeepSeek-V3.1 scored lowest among evaluated models on formal spec generation (Syntax 7.93%) despite 66.0 SWE-bench Verified — benchmark strength ≠ spec/formal reasoning (arXiv:2602.21193 context; arXiv:2608.13077, Aug 2026).

### 2.4 Agentic tool use
- **Kimi K3**: MCPMark-Verified 94.5, BrowseComp 91.2, SWE-Marathon 42.0 (hour-scale sessions) **[V]**; K3.1 Pro adds always-on thinking with low/high/max effort; API supports `tool_choice: "required"` and dynamic tools.
- **DeepSeek V3.2** was the first open model to integrate thinking directly into tool-use; V4.1-Flash extends this (AutomationBench 54.8, Agent's Last Exam 31.8 **[V]**).
- **Small-model tool calling** (vendor BFCL-V4 / TAU2): Qwen3.5-9B 66.1 BFCL / 79.1 TAU2; IBM Granite 4.2 8B ~52 BFCL / 66.3 τ³; Gemma 4 12B ~69 Tau2-avg **[V, Oct 2026]**.
- **MiniMax M3**: MCP Atlas 74.2, SWE-fficiency 34.8 **[V]**; Vals independently ranks it top open-weight on Finance Agent v2 (48.27) **[I]**.
- Caveat: agentic scores are harness-sensitive — Moonshot ran most coding evals in the Claude Code harness; DeepSeek used its own harness; cross-vendor tables are one party's run.

### 2.5 Long context
- 1M-token windows are now standard at the frontier: Kimi K3/K3.1 Pro, DeepSeek V4 family, GLM-5.2/5.3 (+Flash), MiniMax M3, Mistral Large 4, Beam, Muse Spark Open, MiMo-V2.5-Pro, LongCat-2.5.
- **Efficiency, not just length, is the 2026 differentiator**: DeepSeek V4.1-Flash's Compressed Sparse Attention 2 + FP4 KV cache ≈ 890 bytes/token (~¼ of V4-Flash); MiniMax Sparse Attention cuts 1M-context per-token compute ~20×; Kimi K3 uses hybrid linear (KDA) + MLA attention.
- **Llama 4 Scout's 10M tokens** (iRoPE) remains the largest *advertised* open-weight window, but KV-cache cost at full fill is enormous and long-context recall is weakly evidenced; no open Llama successor exists as of Nov 2026 (Meta's frontier effort moved to Muse, closed, with Muse Spark Open the open sibling).
- Independent long-context reliability (e.g., AA-LCR: Kimi K3 74.7, Mistral Small 4 0.72) lags the context-size marketing; **treat max-context as capacity, not guaranteed recall**.

### 2.6 Multilingual
- **Qwen** family: 119–201 languages (training mix), strongest CJK + South-Asian + low-resource coverage among open flagships; Qwen3.5 line ships 0.8B–397B all Apache 2.0.
- **Mistral Large 4**: 160+ languages incl. all official EU languages **[V]**; Mistral remains the EU-sovereignty default.
- **DeepSeek**: strong EN+ZH, narrower beyond.
- **Indic**: NVIDIA Nemotron 3.5 Super-VL reports leading MILU 1.5 / Indic GPQA / Indic AIME / Indic MBPP vs Sarvam-105B and Gemma-4-31B **[V, Oct 15 2026]**; Sarvam-105B-1711 (105B/10.3B MoE, Apache 2.0, Nov 17 2026) is the open Indic specialist.
- **Regional/specialist**: Aya (Cohere, 23–101 langs, CC-BY-NC for Expanse), SEA-LION 3 (MIT), Jais/Falcon-Arabic (Apache 2.0), Bielik-11B-v3.1 (56 langs, Apache 2.0, Nov 2026), Lara Mini (45-lang MoE base, CC BY-NC-SA — research only), Kolibri-1 (DE/EN, 78B/3.46B MoE, Apache 2.0, Aleph Alpha).
- Gemma 4 is comparatively English-centric.

### 2.7 Small / edge (≤ ~30B)
| Model | Params (active) | Context | License | Evidence |
|---|---|---|---|---|
| Qwen3.8-27B | 27B dense | 262K | Apache 2.0 | SWE-bench Pro 61.7, TB2.1 73.0 **[V, Aug 2026]** — best single-GPU coder |
| Gemma 4 31B | 31B dense | 256K | Apache 2.0 | MMLU-Pro 85.2, AIME'26 89.2, LCB v6 80.0, Codeforces 2150 **[V; arXiv:2607.02770]**; Arena #3 open (Elo 1451) **[I]** |
| Gemma 4 26B-A4B | 25.2B / 3.8B MoE | 256K | Apache 2.0 | AIME'26 88.3, GPQA 82.3 — ≈31B quality at ⅛ compute **[V]**; fits RTX 3090/4090 |
| Gemma 4 E2B / E4B / 12B | 2.3B / 4.5B eff., 12B | 128K / 256K | Apache 2.0 | E4B: MMLU-Pro 69.4 vs Gemma 3 27B's 67.6 **[V]**; native audio on E/12B |
| Qwen3.5-0.8B/2B/4B/9B | 0.9–9.7B | 262K all sizes | Apache 2.0 | 9B: MMLU-Pro 82.5, BFCL 66.1 **[V]**; vision at every size |
| Qwen3.6-35B-A3B | 35B / 3B MoE (Gated DeltaNet) | 262K (YaRN→1M) | Apache 2.0 | SWE-bench Verified 73.4 **[V, Apr 2026]** — cheapest per token in class |
| gpt-oss-20b | 20.9B / 3.6B MoE | 131K | Apache 2.0 | ≈o3-mini class; 16 GB RAM edge deployment **[V]** |
| Ministral 3 3B/8B/14B | dense | 256K | Apache 2.0 | 14B ≈ Mistral Small 3.2 24B; AIME 85 (14B) **[V]**; 0.4B ViT per size |
| Mistral Small 4 | 119B / 6.5B MoE | 256K | Apache 2.0 | See §1 — "small" by active params, server-class by weights (~72 GB @Q4) |
| Nemotron 3 Nano 30B / 4B | 30B / ~3.5B; 4B | 1M | NVIDIA Open Model License | AIME'25 99.2 w/ tools (30B) **[V]**; 4B targets Jetson/RTX/DGX Spark |
| Phi-4-mini | 3.8B | 128K | MIT | MATH-500 92.5 **[V]**; math-strong, thin world knowledge |
| SmolLM3-3B / OLMo 3 7B | 3B / 7B | 64K | Apache 2.0 | **Fully open: weights + data + recipes** — the true "open source" baseline |
| MiniCPM5-2B / MiniCPM-V 4.6 | 2.5B / 1.2B | 128K | Apache 2.0 | AIME'26 86.5, SWE-bench V 46.4 **[V]**; UltraData training set released; V 4.6 runs on phones |
| LFM3-1.7B | 1.7B hybrid | 256K | LFM Open v1.0 | BFCL v4 71.4, LCB v6 73.5 **[V]**; edge/agentic niche |
| IBM Granite 4.2 3B/8B | 3.7B / 8.8B | 128K (→512K) | Apache 2.0 | Tool-calling focus; τ³ 66.3 (8B) **[V]** |

### 2.8 MoE architecture state of the art
- **Sparse MoE is now the default frontier architecture.** Active/total ratios: Qwen3.6-35B-A3B 3/35B (8.6%), Gemma 4 26B-A4B 3.8/25.2B, gpt-oss-120b 5.1/117B (4.4%), Mistral Small 4 6.5/119B (5.5%), DeepSeek V4-Pro 49B/1.6T (3%), GLM-5.3 40/753B (5.3%), Kimi K3 104B/2.8T (3.7%).
- Architectural novelties 2026: **DeepSeek V4.1-Flash** = causal encoder–decoder MoE + 196B "Engram" conditional memory offloadable to CPU RAM, asymmetric 8B-prefill/16B-decode activation; **Kimi K3** = hybrid Kimi Delta Attention (linear) + Gated MLA, native MXFP4 weights/MXFP8 activations (first 4-bit-native open model at 3T scale); **Nemotron 3** = Mamba-2/attention/LatentMoE hybrid (call 4 experts for the cost of 1); **Qwen3.5/3.8** = Gated DeltaNet linear-attention hybrids; **MiniMax M3** = sparse attention for 1M context.
- Serving reality: MoE memory footprint = **total** params, not active. GLM-5.3 ≈ 515 GB @Q4_K_M; Kimi K3 ~1.5–1.6 TB (8×B200 minimum, 16 realistic); DeepSeek V4-Pro ~893 GB FP4/FP8 (8×H200 floor); V4.1-Flash ~511 GB (8×H200, or 4×H200 with Engram on CPU); Mistral Large 4 = 1.06 TB FP8 / 610 GB NVFP4, no BF16 checkpoint.

---

## 3. Family positions (evidence-bounded)

- **Qwen (Alibaba)** — broadest and most permissive lineup (Apache 2.0 across open sizes; larger Qwen3.8/Max releases use custom licenses). Strengths: multilingual breadth, hybrid thinking, agentic post-training, single-GPU SOTA (Qwen3.8-27B). Qwen3.8-Max / Qwen4-Max (2.4T) are API-only/proprietary as of Nov 2026. Not independently #1 on any major frontier index.
- **DeepSeek** — MIT across V3.2/V4 family; strongest price/performance at frontier (V4.1-Flash $0.15–0.30/M in). Vendor numbers lead agentic coding but await broad independent reproduction; AA general index (39) is well below its coding profile — it is a specialist. Geopolitical/procurement review applies for some buyers; llama.cpp support for V4.1-Flash still in review, no Unsloth GGUF yet.
- **Llama / Meta** — Llama 4 (Scout 109B/17B, 10M ctx; Maverick 400B/17B, 1M) is now a generation behind with **no open successor**; Llama Community License (700M MAU cap, AUP, naming rules) is not OSI-open. Meta's 2026 frontier line is Muse (closed) + Muse Spark Open / Muse Glimmer 30B (open siblings; Glimmer: GPQA 83.5 **[V/AA]**). Llama 4's 10M context is unmatched on paper but KV-costly; Scout is the easiest frontier-ish model to self-host (1×H100 INT4).
- **Mistral** — Apache 2.0 up through Large 3 (675B/41B); **Large 4 (1.05T/52B) moved to the custom Mistral Ecosystem OWL** (MaaS needs separate license) — a permissiveness regression. Small 4 (119B/6.5B, Apache 2.0) is the efficiency pick; AA index ties/beats Large 3 at ⅓ the price. Medium 3.5 and Large 3 deprecate Apr 30, 2027. EU-sovereignty + GDPR story is the differentiator, not benchmark leadership.
- **Gemma (Google)** — Gemma 4 (Mar 31/Apr 2 2026, technical report arXiv:2607.02770) moved to **Apache 2.0** (Gemma 1–3's restrictive custom terms are gone). Five sizes E2B→31B; 26B-A4B MoE is the efficiency standout; edge models add native audio. Limits: largest is 31B (no frontier-size entry), English-centric, Jan 2025 knowledge cutoff; mid-July 2026 checkpoint refresh fixed tool-calling (~+10.1% telecom) — re-pull older weights.
- **OpenAI open-weight** — gpt-oss-120b/20b (Aug 5 2025, Apache 2.0): the best competition-coding-per-active-param (2622 Codeforces at 5.1B active) and the easiest frontier-adjacent self-host (single 80 GB GPU / 16 GB). Now ~15 months old: text-only, 131K context, knowledge cutoff Jun 2024, and out-scored on SWE-bench Verified by newer open MoEs (Kimi K2 Thinking 71.3, MiniMax M3 80.5). Training data/pipeline not published.
- **Other current leaders**: Moonshot Kimi K3/K3.1 Pro (frontier coding/agentic; custom license with revenue/MAU clauses; 1.56 TB download; thinking can't be disabled); Z.ai GLM-5.2 (best plain-MIT on SWE-bench Pro 62.1) / GLM-5.3 (custom license, all gains vendor-reported, one independent datapoint); MiniMax M3 (cheap agentic multimodal, but **non-commercial by default**); NVIDIA Nemotron 3 (most open *pipeline*: weights + datasets + NeMo Gym RL + safety dataset; US-sovereign option); Reflection Beam, Xiaomi MiMo, Meituan LongCat (MIT), Tencent Hunyuan Hy3 (295B/21B, Apache 2.0, SWE-bench V 78.0 **[V]**), Ant Ling-3.x, Poolside Laguna (OpenMDW-1.1), JetBrains Mellum2.1 (12B-A2.5B code MoE, Apache 2.0), Aleph Alpha Kolibri-1.

## 4. Known failures, caveats, and negative results
1. **No open model tops the overall frontier**: best open ≈ #17 overall (benchlm, Nov 19 2026); closed leads hardest reasoning (CritPt: K3 23.4 vs GPT-5.6 Sol 32.3) and long-horizon Terminal-Bench 4.0 (Claude Opus 5 51.8 vs K3.1 Pro 65.7 **[V]** vs DeepSeek V4.1-Flash 31.2 **[V]** — numbers conflict across harnesses).
2. **Vendor-vs-independent gaps**: DeepSeek V4.1-Flash's 90.6 TB 2.1 is self-harnessed; GLM-5.3 has a single independent datapoint; Beam's 80.9 SWE-bench Verified is unreproduced. Vals (independent) shows MiniMax M3 lower on SWE-bench Verified (75.0) than vendor claims (80.5).
3. **Benchmark saturation/decoupling**: SWE-bench Verified no longer discriminates at the top; strong SWE scores coexist with worst-in-class formal-spec generation (DeepSeek-V3.1).
4. **Verbosity tax**: reasoning-default models (K3.1 Pro, GLM-5.3) burn 2–5× output tokens; price/quality rankings invert when token spend is counted.
5. **Context ≠ recall**: 1M claims lack independent long-context reliability evidence for nearly every model; Llama 4 Scout's 10M especially so.
6. **Ecosystem lags for new architectures**: V4.1-Flash lacks llama.cpp/GGUF; K3's MXFP4 needs recent vLLM/SGLang; Gemma 4 MTP drafters conflict with KV q8_0 quantization.
7. **License traps**: "open" spans Apache 2.0/MIT → revenue-triggered clauses (Kimi K3 $20M, GLM-5.3 $10B security review, Muse $20M) → non-commercial defaults (MiniMax M3, Aya Expanse, Lara Mini) → research-gated (some base checkpoints). Llama 4's 700M-MAU clause and AUP persist.
8. **grok-4-1-fast (closed) underperformed open models** on ADRD caregiving QA while closed peers exceeded 0.9 — openness per se wasn't the differentiator (arXiv:2602.11460).

## 5. Primary / near-primary sources
- DeepSeek-V3.2 paper: arXiv:2512.02556 (Dec 2, 2025) — full benchmark table vs GPT-5/Gemini-3.0 Pro/Kimi-K2/MiniMax-M2.
- Gemma 4 Technical Report: arXiv:2607.02770 — architecture, LMArena-style Elo table incl. open models.
- OpenAI: openai.com/index/introducing-gpt-oss (Aug 5, 2025) + HF cards openai/gpt-oss-120b, openai/gpt-oss-20b; harmony repo.
- HF cards (referenced): moonshotai/Kimi-K3, moonshotai/Kimi-K3.1-Pro (+License), zai-org/GLM-5.3, deepseek-ai/DeepSeek-V4.1-Flash, mistralai/Mistral-Large-4-1T-A52B, mistralai/Mistral-Small-4-119B-2603(-NVFP4), Qwen/Qwen3.8-27B (config-derived arch via hfviewer), nvidia/NVIDIA-Nemotron-3-Ultra-550B-A55B-BF16.
- Independent: Artificial Analysis Intelligence Index v4.3/v5 (Sep 7 / Oct 27–30, 2026), Vals.ai SWE-bench & Index (Sep/Nov 2026), benchlm.ai open leaderboard (Nov 19 2026), LMArena/Arena AI, llm-releases.com changelog (through Nov 19 2026).
- NVIDIA Nemotron 3.5 Super VL blog (Oct 15, 2026); NVIDIA HF post on IOI/IMO results (Oct 7, 2026 — IOI result unofficial).

*Compiled 2026-11-20. Vendor-reported numbers are single-source claims until independently reproduced; re-check live leaderboards and LICENSE files before deployment decisions.*
