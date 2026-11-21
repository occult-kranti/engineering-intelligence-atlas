# Runtime Selection

Runtime comparison, hardware detection, and VRAM sizing for local model serving.
Confidence labels: **[PRIMARY]** = read from the project's own repo/docs/advisories (2026-11-20); **[SECONDARY]** = third-party, cross-checked where possible. This ecosystem moves weekly — re-verify versions, licenses, and CVE baselines at implementation time.

## Contents
- Runtime comparison table
- Runtime notes and licensing constraints
- Hardware detection
- VRAM / RAM sizing math
- Sandboxing tiers for agent execution
- Desktop shell integration (Tauri/Electron)

## Runtime comparison table

| Runtime | License (verified) | Interface | Default endpoint | Best for | Do NOT |
|---|---|---|---|---|---|
| llama.cpp `llama-server` | MIT [PRIMARY] | CLI + OpenAI/Anthropic-compatible HTTP | `127.0.0.1:9931` (8080 pre-2026-10; [SECONDARY]) | Embeddable default engine; continuous batching; CUDA/ROCm/Metal/Vulkan/SYCL/CPU | — |
| Ollama | MIT [PRIMARY] | REST `:11434/api` + OpenAI-compatible `:11434/v1` | `127.0.0.1:11434` | User-friendly model library; `name:tag` pulls | Never expose without auth — no built-in API auth; see CVE ledger in safety_and_validation.md |
| LM Studio | Proprietary closed-source [PRIMARY ToS] | Desktop app + `lms` CLI + `:1234` API | `localhost:1234` | Polished UX; free for work since 2025-07 | Cannot embed or redistribute; closed source = privacy claims not auditable |
| Jan | Apache-2.0 + attribution request [PRIMARY LICENSE] | Tauri desktop + `:1337` API | `localhost:1337` | Proof that Tauri + llama.cpp sidecar works at desktop scale | Single-user desktop; macOS local models need Apple Silicon since v0.8.5 [SECONDARY] |
| GPT4All | MIT + addendum that model weights are NOT covered [PRIMARY LICENSE] | Desktop app + local API | — | CPU-first; LocalDocs local RAG; opt-in telemetry UX precedent | Optimized for ~3–13B models |
| LocalAI | MIT [PRIMARY] | OpenAI-spec shim + 80+ gRPC backends | `:8080` (Docker) | Multi-modal (text/image/audio/video/embeddings); built-in API-key auth, quotas, RBAC | Larger config surface; server not desktop shell |
| KoboldCpp | AGPL-3.0 [PRIMARY LICENSE] | Single-file exe + `:5001` API | `:5001` | Zero-install single binary; story/roleplay UI | AGPL §13: do not embed in hosted/commercial distributed products |

Sources: https://github.com/ggml-org/llama.cpp, https://github.com/ollama/ollama, https://lmstudio.ai/app-terms, https://lmstudio.ai/blog/free-for-work, https://github.com/janhq/jan, https://github.com/nomic-ai/gpt4all, https://github.com/mudler/localai, https://github.com/LostRuins/koboldcpp

## Runtime notes and licensing constraints

- **License layering:** the runtime license covers the tool only; model weights have their own licenses (GPT4All's LICENSE addendum states this explicitly — a good precedent). Display each model's license in any UI.
- **llama.cpp lifecycle [PRIMARY]:** releases are `bNNNNN` numbered builds (b12556 on 2026-11-19). A third-party claim of "v1.0.0 on 2026-11-13" contradicts the official release feed — treat as false.
- **Ollama [PRIMARY]:** v0.40.16 / v0.40.17-rc2 (Nov 2026). Enforce a version floor ≥ 0.35.0 (path-traversal RCE fix). March 2026 added MLX on Apple Silicon; June 2026 enabled Vulkan by default for AMD/Intel [SECONDARY].
- **Odysseus** (self-hosted AI workspace, AGPL-3.0 [PRIMARY LICENSE read from repo]; launched MIT, relicensed early June 2026 [SECONDARY]): useful pattern reference — hardware-scanning "Cookbook" model recommender, `AUTH_ENABLED=true`, default bind `127.0.0.1`, DNS-rebinding protection — but treat as inspiration, not a dependency (AI-generated code, no tagged releases). https://github.com/odysseus-dev/odysseus
- **Embedding rule:** MIT/Apache-2.0 runtimes (llama.cpp, Ollama, LocalAI, GPT4All, Jan) are embeddable with notice preservation. AGPL (KoboldCpp, Odysseus) and proprietary (LM Studio) are user-installed-only options.

## Hardware detection

- Desktop-standard: npm `systeminformation` — `si.cpu()`, `si.mem()`, `si.graphics()` (GPU vendor/model/VRAM/driver for NVIDIA/AMD/Intel), `si.fsSize()`; adopted by Comfy-Desktop after hand-rolled WMI/lspci/sysctl proved fragile (https://github.com/Comfy-Org/Comfy-Desktop/issues/380 [PRIMARY issue]). In Tauri, use the Rust `sysinfo` crate behind commands; keep detection in the privileged core.
- Cross-check with `nvidia-smi --query-gpu=name,memory.total,memory.used --format=csv`.
- **Runtime truth beats static math:** after loading, verify actual placement via `ollama ps` / `/api/ps` (`size` vs `size_vram`) — Ollama splits layers to CPU RAM when VRAM is insufficient (reported as e.g. `48%/52% CPU/GPU`) [SECONDARY]. Multi-GPU: single-GPU placement is preferred when the model fits one card.
- Apple Silicon = unified memory; budget VRAM and RAM as one pool.

## VRAM / RAM sizing math [SECONDARY, formula-based — measure on target hardware]

- Weights: `GB ≈ params(B) × bits-per-weight ÷ 8`. Effective bit-widths: Q4_K_M ≈ 4.5 bpw, Q4_K_S ≈ 4.2, Q5_0 ≈ 5.2, Q6_K ≈ 6.5, Q8_0 ≈ 8.5, F16 = 16. Rule of thumb ≈ 0.6 GB per billion params at Q4.
- KV cache: `≈ 2 × layers × KV_heads × head_dim × context_tokens × bytes_per_element` (2 bytes at f16; ~1 at q8_0; ~0.5 at q4_0) — grows linearly with context. Worked example (Qwen3-8B: 36 layers, 8 KV heads, head_dim 128): ≈0.6 GB @ 4k context → ≈4.8 GB @ 32k.
- Add ~10–15% runtime/compute-buffer overhead; leave OS/desktop headroom.
- Ollama sizes default context from detected GPU memory: <23 GiB → 4,096 tokens; 23–47 GiB → 32,768; ≥47 GiB → 262,144. Set `num_ctx` explicitly instead of accepting this.
- KV-cache quantization (`OLLAMA_KV_CACHE_TYPE=q8_0` ≈ ½, `q4_0` ≈ ¼ of f16) requires flash attention; K-cache quantization is more quality-sensitive than weight quantization [SECONDARY].
- Quantization quality evidence [PRIMARY, arXiv:2601.14277]: Q4_K_S/Q4_K_M essentially match F16 baseline on GSM8K/HellaSwag/IFEval/MMLU for Llama-3.1-8B; Q3_K_S degraded clearly (GSM8K −9.3 pts). Default Q4_K_M; step up to Q5_K_M/Q6_K when memory allows; avoid ≤3-bit unless memory-constrained. https://arxiv.org/html/2601.14277v1
- **Multi-agent capacity:** each concurrently loaded model needs its own weights+KV budget. Prefer one server with continuous batching / parallel slots (`llama-server`, or `OLLAMA_NUM_PARALLEL`/`OLLAMA_MAX_LOADED_MODELS`) over N engine processes.

## Sandboxing tiers for agent execution

Layered isolation for anything an agent executes or loads (decision matrix [SECONDARY]: https://github.com/danielsmithdevelopment/ClawQL/blob/main/docs/security/security-best-practices-series/11-sandboxing-kata-gvisor-seatbelt.md):
1. Python `venv`/uv per tool environment — minimum hygiene.
2. seccomp profiles on containers (block ptrace, dangerous mounts/sockets).
3. gVisor (runsc) — ~5–10% overhead; good for short-lived tool execution.
4. Kata Containers — VM-grade, 50–100 ms startup; for long-running agent sessions and untrusted document processing.
5. macOS Seatbelt — dev convenience only, not a production boundary.

Layer policy enforcement (tool-call schema validation, approval rules) *plus* syscall sandboxing: if policy allows a call but the sandbox blocks the syscall, the sandbox wins.

## Desktop shell integration

- **Prefer Tauri v2** for a desktop shell: smallest trusted base, fine-grained capabilities ACLs, official sidecar pattern (`bundle.externalBin` + `shell:allow-execute` with per-arg validators) for shipping a pinned, hash-verified inference binary. Jan proves the pattern at desktop scale. https://v2.tauri.app/develop/sidecar/ [PRIMARY]
- If Electron: `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true` on every window; strict CSP without `unsafe-eval`; sender-validated IPC; default-deny permission handlers; ASAR integrity; signed updates. https://electronjs.org/docs/latest/tutorial/security [PRIMARY]
- Store secrets (cloud API keys) in the OS keychain (Electron `safeStorage` / Tauri keyring), never in plaintext config files.
- Privacy boundary design: global local-only/offline mode blocking all egress except an explicit allowlist; per-agent network permission flags enforced by the director; remember that cloud API keys are a separate trust tier — connecting a cloud provider voids local privacy for that conversation.
- Telemetry precedent: GPT4All's explicit first-launch opt-in dialog (collects lengths/hardware, never content) is the UX model [SECONDARY audit: https://www.local-llm.net/blog/local-ai-privacy-audit/]. vLLM collects anonymous usage stats by default — disable via `DO_NOT_TRACK=1`/`VLLM_NO_USAGE_STATS=1`.
