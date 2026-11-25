# 3D Game Studio validation receipt

Recorded 2026-11-24 and refreshed 2026-11-25 for the original Daftar studio implementation and embedding bridge in this directory.

## Executed checks

| Check | Result | Scope |
|---|---|---|
| `node --test projects/threejs-game-studio/tests/core.test.mjs` | **18 / 18 passed** | Source completeness and dependency profile, oversized UTF-8 input, workspace roundtrip/provenance reset, malformed layout recovery bounds, finite camera geometry, imported-file hashes, no bundled model weights, honest evaluation manifests, actual-parent/origin/schema checks for the visibility bridge |
| `python3 -m unittest discover -s projects/threejs-game-studio/tests -p test_studio.py -v` | **19 / 19 passed** | Local adapter with mocked responses: positive limits, loopback endpoint rules, redirect refusal, wall-clock deadline, response cap, early EOF, malformed/incomplete generation, exact original preservation, no overwrite, dependency/syntax gates and missing-Node behavior |
| `node --check` on `core.mjs` and `studio.mjs` | **Passed** | JavaScript syntax only |
| CLI `inspect assets/reference-observatory.html` | **Ready for browser review** | Complete HTML, core-only dependency profile, one inline module parsed by `node --check`; no script execution |
| Scoped `git diff --check` | **Passed** | Whitespace/error scan of the project and gaming-skill edits |
| Imported metadata and dependency hashes | **Matched** | Exact bytes and SHA-256 values in `upstream/files.json` |
| Static projection checks in an isolated fixture | **Passed** | Read-only missing-destination check; exact hosted/preview allowlists; stale-file repair; unexpected-file preservation; source/destination symlink rejection; explicit desktop target; manifest traversal rejection |

The reference scene's source SHA-256 at the refreshed inspection was `d199396f5a4e5dbcab2118fd6d4e02ca73d09cd6c7d9ca651238135a7acaa895`. The HTML extractor's derivative hash differs because extraction omits the trailing newline; the original input remains unchanged.

The embedding bridge has only a typed visibility input. It combines outer-panel and document visibility, retains early hidden state through inner-frame loading, and never changes source, brief, review observations or manual motion pause. Unit tests cover rejected sibling/inner-window messages, wrong web origins, desktop `null` origin handling, wrong channels, non-boolean visibility and extra authority fields. These are contract tests; actual hide/show rendering acceptance still belongs to the parent's CUA pass.

## Browser acceptance remains separate

**No real-browser assertions, rendered screenshots, visual review, measured frame rate, or live interaction acceptance are certified by this receipt.** A proposed isolated browser test could not launch in the executor: the expected Playwright browser binary was absent, and the available Chromium process exited with `socket() failed: Operation not permitted` while initializing its singleton. This is an environment limitation, not evidence of a studio rendering defect.

The parent task is performing browser interaction through the supported CUA surface on its managed Sites preview. Record those observed results separately; do not infer them from the 37 deterministic tests above. Any optional browser harness in `tests/` remains unexecuted here.

## Explicitly not performed

- Model weight/projector/dataset download, model inference, training or instruction-quality benchmark.
- Independent blinded holdout evaluation; its manifest is an unpopulated template.
- Third-party demo application cloning or proprietary game reconstruction.
- Compiler/runtime installation, paid provider requests, or native job dispatch by this studio.
- Verified company activation. The parent observed company creation command `5f7892e8-9844-4459-a566-e85404ab1ac4` as **queued**, pending native sync.

The browser and CLI distinguish source-pattern checks, syntax results, document-open messages, runtime messages, manual review observations and actual model execution. A successful source check is never labeled a successful game or model-quality improvement.
