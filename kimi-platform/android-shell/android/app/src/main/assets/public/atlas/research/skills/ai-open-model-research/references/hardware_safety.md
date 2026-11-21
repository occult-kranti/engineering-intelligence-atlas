# AI Open-Model Research — Hardware Fit and Safety Gates

Compiled 2026-11-20 from `sota_open_model_landscape.md` §7–§8 and the orchestration research. Hardware figures are verified floors or labeled estimates — never guarantees. The safety gates here are non-negotiable and override schedule, budget, and user pressure.

## Contents

1. Hardware rules — 2. Verified byte floors — 3. Planning tiers — 4. Supply-chain discipline — 5. Hard safety gates — 6. Threat ledger highlights

## 1. Hardware rules

- **MoE memory = total parameters, not active parameters.** A 2.8T/104B model is a ~1.5 TB download even though only 104B fires per token. Sparse MoE is the default frontier architecture (active/total ratios 3–9%: DeepSeek V4-Pro 49B/1.6T, Kimi K3 104B/2.8T, gpt-oss-120b 5.1B/117B), so serving cost is set by total weights.
- **Verified byte floors beat estimates.** Where a registry-verified record exists, use it; anything beyond the derivable floor (KV cache, framework overhead) is a planning estimate and must say so.
- **Plan by tier, measure on target.** Probe the host before promising fit; never promise >64 GB locally — route to cloud APIs.
- **Quantization consensus:** Q4_K_M ≈ 0.65 GB/billion params at ~97–98% of FP16 quality for ≥7B models; below Q3 degrades sharply.
- **Runtime routing:** llama.cpp/GGUF for breadth, MLX for Apple Silicon (20–87% faster than llama.cpp below 14B [V]), vLLM/SGLang for production serving and agentic patterns, ExecuTorch for mobile. Check runtime support for novel architectures (e.g., `qwen3-next` hybrid needs very recent llama.cpp; MXFP4 needs recent vLLM/SGLang).

## 2. Verified byte floors (registry-verified [R], 2026-11-20)

Exact required-set sizes from pinned-revision tree APIs. Floors exclude context/KV/framework overhead by design.

| Artifact | Pinned repo @ revision | Exact bytes (floor) | License [R] | Install friction |
|---|---|---|---|---|
| Qwen3-8B Q4_K_M (entry director brain) | `Qwen/Qwen3-8B-GGUF` @ `7c41481` | 5,027,783,488 (4.68 GiB) | Apache-2.0 | None: non-gated, no remote code, sha256 published |
| Qwen3-Coder-30B-A3B-Instruct Q4_K_M (coding agent) | `ggml-org/Qwen3-Coder-30B-A3B-Instruct-GGUF` @ `ef85c7f` | 17,988,419,552 (16.75 GiB) | Apache-2.0 | None; `.src_sha` pins base-model provenance (Qwen publishes no official GGUF — 404 verified) |
| Qwen3-Coder-Next Q4_K_M (high-tier coder) | `Qwen/Qwen3-Coder-Next-GGUF` @ `b82fb73` | 48,410,992,032 (45.09 GiB, 4 shards) | Apache-2.0 **declared only** — no LICENSE file ships; card license_link dead | Needs very recent llama.cpp |
| Foundation-Sec-8B-Reasoning (security triage) | `fdtn-ai/Foundation-Sec-8B-Reasoning` @ `63c930c` | 16,078,180,729 (14.96 GiB, bf16 safetensors) | Dual: Llama 3.1 Community (base) + Apache-2.0 (Cisco mods) | Format + license conditions; review NOTICE.md |
| FLUX.1-schnell (image) | gated repo | 33.7 GB | Apache-2.0 | Gated: sha256 masked for anonymous clients — hash-verify only after the user's own authenticated download |
| TripoSR (3D drafts) | `stabilityai/TripoSR` | 1.7 GB | MIT | Remote-code required → reference-only under current policy |
| TRELLIS.2-4B (3D generation) | `microsoft/TRELLIS.2-4B` | 16.2 GB | MIT (deps: gated DINOv3; nvdiffrast terms) | Remote-code required → reference-only under current policy |

A verified download record captures: exact repo ID, pinned default-revision commit SHA, per-file byte sizes from the pinned-revision tree API, LFS sha256 where exposed, license corroborated against LICENSE/NOTICE files, remote-code requirement, and the hard memory floor.

## 3. Planning tiers (estimates — label as such)

| Host budget | Fits |
|---|---|
| 8 GB VRAM | 3B–8B Q4 LLMs, FLUX.1-schnell GGUF, TripoSR |
| 16–24 GB | 30B-A3B coders (Q4_K_M), Mistral Small 24B, gpt-oss-20b, Qwen-Image FP8, FLUX.2 [klein] 4B, TRELLIS.2 |
| 32–64 GB | Qwen3-Coder-Next Q4, Hunyuan3D full pipeline (geo-check license first) |
| >64 GB / frontier MoE | Route to cloud APIs; Kimi K3 ≈ 1.5 TB (8×B200 minimum), GLM-5.3 ≈ 515 GB at Q4_K_M, DeepSeek V4.1-Flash ≈ 511 GB [V] |

Desktop-viable capability concentrates in the 3B–35B band. Frontier open LLMs are 8×H200/B200-class items — do not promise them locally.

## 4. Supply-chain discipline

- Recommend only **pinned-revision, hash-verified, GGUF/safetensors-first** artifacts. Reject pickle-based formats (`.bin/.pt/.pth/.ckpt`) — pickle deserialization executes arbitrary code.
- Registry scanning marks rather than blocks and has been bypassed (four PickleScan CVEs in 2025, three CVSS 9.8; up to 63% scanner evasion in a 2026 preprint). Integrity ≠ trustworthiness.
- Deleted namespaces are re-registerable — confirm the publisher identity, not just the name.
- `trust_remote_code` paths are flagged, never silently accepted; repos requiring remote code are reference-only under no-remote-code policy.
- Delivery workflow: explicit-consent download at the pinned revision → sha256 verification (post-download for gated repos) → quarantine staging → activation. This skill researches; it never downloads or executes.

## 5. Hard safety gates (non-negotiable)

- **No autonomous downloads or execution** — downloads are explicit-consent actions owned by the user through the quarantine-staged workflow.
- **No operational dual-use uplift** — bio/chem/genomics model coverage stays at survey level (capabilities, licenses, evidence): no wet-lab protocols, no synthesis routes, no pathogen-relevant design guidance. Flag protein/genomics design tools for institutional biosafety review (IBC, IBBIS/SecureDNA-type sequence screening) before any physical realization. Note that Evo 2's own training excluded eukaryotic viruses.
- **No offensive security operations** — cybersecurity model coverage is defensive (triage, detection drafting, evaluation); no exploit instructions, no attack tooling guidance. Open models trail frontier closed widely on offensive tasks (top open ~19.5% vs 59% NYU CTF Bench [SECONDARY, Apr 2026]).
- **No clinical claims** — medical models are research-grade; none is a medical device (<20 FDA-cleared LLM-based devices as of May 2026); clinical use requires regulatory clearance (FDA/CE-MDR) and local validation. Weather models are decision-support; warnings remain the legal responsibility of national meteorological services.
- **License non-advice** — classifications are informational, not legal advice; commercial adoption recommendations always end with "read the license text at the pinned revision."
- **No fabricated evidence** — unknown benchmarks, sizes, or licenses are reported as unknown; exclusion is preferred over estimation.
- **Consent and likeness** — voice cloning (e.g., 3-second cloning) creates deepfake duties regardless of license; emulate consent-gated cloning and embedded watermarks (Perth) as mitigations.
- **Deployment labeling** — robotics/AV artifacts are research stacks, not deployable systems; closed-loop safety is the integrator's responsibility. Physics surrogates are not validated for reactor control or engineering sign-off.

## 6. Threat ledger highlights (for risk notes)

- **Alignment does not survive packaging** — multi-turn jailbreak attack success rates of 25.9%–92.8% across eight major open-weight LLMs (2×–10× single-turn rates) (arXiv:2511.03247, Nov 2025); fine-tuned/quantized/merged derivatives may not retain original alignment (ACSC guidance, Nov 2026). The deployer owns all safeguards.
- **Runtime CVEs** — e.g., SGLang `torch.load` RCE (CVE-2026-15976); Ollama path-traversal RCE (fixed in 0.35.0). Track version floors for recommended runtimes.
- **Agent runtimes expand the blast radius** — MCPTox measured 36.5% average (up to 72.8%) tool-poisoning success across 45 live MCP servers; one 2025 evaluation found 82.4% of 17 models executed malicious commands when requested by *peer agents*. CaMeL-style control/data-flow separation (77% AgentDojo with provable security vs 84% undefended) is the documented defense pattern.
- **GUI/code-executing agents** — `--enable_local_env`-style flags and research agents that execute LLM-generated code with full privileges require sandboxing (VM-class isolation); screen-content prompt injection is an open risk.
- **Image editing** — at least one popular open editor is a published jailbreak target (arXiv:2610.23909); deploy with moderation. No open video generator ships mandatory watermarking — C2PA/SynthID is the deployer's job.
