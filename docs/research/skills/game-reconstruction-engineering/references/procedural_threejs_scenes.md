# Original procedural scenes with local models

Use this path for original scene prototyping, new game environments and browser 3D tools. Keep proprietary game reconstruction on the parent skill's existing authorization path. A model's output does not establish rights to a copied character, asset or game implementation.

## Pin the actual source

The verified CCORE model is an independent fine-tune of Qwen3.5-4B: [model repository](https://huggingface.co/ccore/Qwen3.5-4B-3D-Coder), Apache-2.0, revision `4b9f05f3a0382725b679c5e32a338b88acaf0064` reviewed on 2026-11-24. Record future checks separately; do not silently replace this pin with `main`.

- Q4_K_M: `2,708,804,096` bytes; SHA-256 `32c37c83d3ca055d30aefa679f1a1670d3e2eb889ee7cc805792d53f219cfae8`.
- Q8_0: `4,482,402,816` bytes; SHA-256 `c30b02629456aa2bc32e522de0f58eb1aafd8518a7634128fed67d1486fc2a9a`.
- Disk size is not runtime memory. Record hardware, context, quantization, runtime version and measured memory separately.
- Hugging Face documents Ollama integration. The author reports llama.cpp b11889 short tests and Transformers 5.20.2 text-generation loading; do not claim a local runtime result until actually run. Disable LM Studio MTP according to the card.
- The model repository distributes weights and metadata, not a complete product SDK. Preserve model, dependency and third-party application licenses independently. Treat empty license metadata as unresolved rather than proof of permissive reuse.

## Generate a bounded artifact

1. Record the scene purpose, required objects, initial camera, controls, viewport, animation, asset/dependency policy and one owner. Use original geometry or assets whose provenance is recorded.
2. Prepare a finite prompt/context/output/time/response-byte budget. Use only the installed, authorized local endpoint or an explicitly scoped provider. Never auto-download weights, install a runtime, or treat unknown cost as zero.
3. Preserve the exact input and original output. Put extraction and repairs in separate files. Reject truncated output; retain timeout, interruption and completion-reason evidence.
4. Use the model's documented Three.js core `0.160.0` module profile for baseline reproducibility. Upgrade dependencies as a separately tested change. Require complete HTML, resize behavior, bounded geometry, camera controls and reduced motion; do not request unbounded generation.
5. Record the installed artifact identity. A source revision in a manifest or a mutable Ollama name is not proof of the weights actually served.

The repository implementation is `projects/threejs-game-studio/scripts/studio.py`: `inspect` never executes code, `import` preserves original source, and `generate` calls only an already-running loopback Ollama endpoint with finite limits. Its successful status means **ready for browser review**, not release-ready. Read that project's README before operating the adapter; do not infer success from a `scene.html` file alone.

## Keep acceptance evidence separate

| Gate | Required evidence | Does not prove |
|---|---|---|
| Source completeness | Complete document, original hash, allowed dependency inventory | Valid JavaScript or safe behavior |
| Syntax | Parser result from inline scripts without executing them | Rendering, controls or visual quality |
| Browser | Isolated preview, console/asset errors, resize and WebGL result | Subject adherence or useful gameplay |
| Interaction | Actual pointer and keyboard orbit/zoom/reset, pause, focus, viewport changes | Geometry quality or physical accuracy |
| Visual/performance | Independent observations, initial framing, object relationships, measured performance when available | Benchmark superiority or production readiness |

Audit unknown generated code before execution. Preview unfamiliar artifacts in an isolated origin/process with restricted network capabilities. CSP and iframe flags are not CPU/memory bounds or a proof of safety. Do not expose provider credentials, parent application authority or filesystem access to scene code. Stop pathological loops and preserve the failing artifact rather than repeatedly retrying without a changed hypothesis.

Test duplicate declarations, missing modules, truncated HTML, off-camera landmarks, NaN geometry, overdraw/object growth, loss of WebGL context, resize, hidden tabs, reduced motion and stale review receipts after source edits. Keep playability as a separate product criterion.

## Evaluate instruction changes

The [author's technical report](https://huggingface.co/ccore/Qwen3.5-4B-3D-Coder/blob/main/Qwen3.5-4B-3D-Coder_Technical_Report.pdf) describes exploratory evaluation on eight development prompts, with retries, repairs and unequal base/checkpoint stopping rules. Do not convert that into a uniform first-shot benchmark. Its public [dataset](https://huggingface.co/datasets/ccore/ThreeJS-3D-Scenes) is MIT-licensed, with 3,933 training and 213 validation examples generated with MiniMax M3.1 Flash according to the publisher; metadata complexity levels are not performance scores.

Use visible cases only for development/regression. Before optimization, assign an independent reviewer to hold unseen prompts outside the optimizer context, record hashes and a sampling rule, check known training/example overlap, and predeclare metrics and equal attempt/repair budgets. Compare baseline and candidate with the same runtime and decoding settings. Preserve failures; distinguish first-attempt unedited success from accepted-after-repair success. Reject regressions in hard execution/interaction gates, and report small-sample uncertainty rather than a fabricated improvement percentage.

The project provides public regression cases and an **unpopulated** private-holdout manifest template. Neither is evidence that blind evaluation has run. Five expert-review rounds can improve instructions and find defects; they do not substitute for an executed held-out comparison. Report the actual validation depth and remaining work.
