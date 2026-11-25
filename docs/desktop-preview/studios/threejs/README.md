# Daftar 3D Game Studio

An original company workspace for procedural Three.js scenes. The brief, preview, team, source editor, review checklist, local-model instructions and Donna helper share one movable blueprint canvas over a conference table.

**The included Tidal observatory is original Daftar reference code. It is not model output.** The browser does not connect to an AI provider, download model weights, provision employees, or dispatch jobs. Donna's standalone helper edits the brief and opens canvas elements; it is deliberately labeled as a local helper.

## Open the studio

From this directory:

```sh
python3 -m http.server 8090 --bind 127.0.0.1
```

Open `http://127.0.0.1:8090/`. Use a local HTTP server rather than a `file:` URL so the browser can load the source and bundled dependency. The reference scene works without a CDN: the studio supplies its bundled Three.js r160 module to the isolated preview.

- Drag the empty blueprint to pan; use the dock or plus/minus to zoom. **Table** returns to the conference-table view.
- Open **Source**, **Review** or **Donna** from the dock. These remain elements on the same canvas.
- Drag a panel's grip or focus the grip and use arrow keys. Shift + arrow moves farther. Escape cancels an active pointer move.
- The 3D reference supports drag-to-orbit, wheel zoom, keyboard orbit, camera reset, pause, wireframe, resize and reduced motion.
- **Import scene** opens HTML or a Daftar workspace JSON in the source editor. Imported code is not executed automatically.
- **Save workspace** exports the brief, owner, source, provenance and user review observations. Source and conversation drafts are session-only; local storage holds bounded camera/panel presentation preferences.
- **Export HTML** preserves the current source. That standalone HTML uses the pinned Three.js CDN URL. Keep the full studio folder for an offline preview.

## Embed in the Daftar canvas

The host opens `studios/threejs/index.html` in a persistent floating iframe. Keeping that iframe mounted preserves the studio's source, brief, chat draft and manual pause setting when the outer panel closes or collapses.

The trusted parent can suspend **the bundled reference renderer** using this exact message:

```js
studioFrame.contentWindow.postMessage({
  type: 'daftar:studio:visibility',
  channel: 'daftar.studio.visibility.v1',
  visible: panelOpen && !panelCollapsed && panelIntersectsViewport && !document.hidden
}, location.protocol === 'file:' ? '*' : location.origin);
```

Send it after the iframe's `load` event and when panel open/collapse/intersection or document visibility changes. The studio validates the actual parent window, the exact three-field schema, a boolean `visible`, and matching HTTP(S) origin. For desktop `file:` documents, only the actual parent with origin `null` and the explicit channel is accepted. Messages from the inner scene frame, other windows, another web origin, malformed payloads and arbitrary text are ignored. This channel changes rendering presentation only; it cannot invoke a provider, edit source, dispatch a job or grant authority.

The suspension flag is retained while the inner reference loads and combined with document visibility. A tab becoming visible cannot override an outer hidden panel. Showing the outer panel resumes rendering without clearing a user's explicit motion pause. Imported scenes do not necessarily implement this reference-only protocol; the host must not claim universal suspension of arbitrary imported code.

### Reproduce the static projection

From the repository root:

```sh
# Copy both tracked static UI projections: hosted and public starter preview.
python3 scripts/sync-company-studios.py --write

# Read-only drift check; this is also the default mode.
python3 scripts/sync-company-studios.py --check

# Explicit desktop build-output projection, after the renderer build.
python3 scripts/sync-company-studios.py --write --target desktop
python3 scripts/sync-company-studios.py --check --target hosted --target preview --target desktop
```

The shared `static-assets.json` allowlist contains ten files: `index.html`, `studio.css`, `studio.mjs`, `core.mjs`, `assets/reference-observatory.html`, `vendor/three.module.min.js`, `vendor/THREE-LICENSE`, `README.md`, `LICENSE` and `VALIDATION.md`. Node-based desktop and starter-preview builds can consume its `files` array directly, so an npm build need not require Python. The manifest itself is a build input, not a projected public file.

The default destinations are `cloud-workspace/public/studios/threejs/` and `site-source/public/desktop-preview/studios/threejs/`. The explicit `--target desktop` destination is `desktop-shell/dist/renderer/studios/threejs/`. Supplying one or more `--target` flags selects only those targets.

The script compares exact bytes, reports a deterministic aggregate SHA-256, and atomically replaces changed allowlisted files. It refuses symlink paths or unexpected files/directories and never deletes them. Tests, Python tooling, private runtime results, model metadata snapshots and model weights are excluded. The hosted UI includes its help and license documents; obtain the repository source to use the CLI and provenance manifests. Desktop file loading and real browser acceptance remain separate from successful asset projection.

## Local inference is optional

The upstream model is [`ccore/Qwen3.5-4B-3D-Coder`](https://huggingface.co/ccore/Qwen3.5-4B-3D-Coder), pinned in `upstream/model-manifest.json` to revision `4b9f05f3a0382725b679c5e32a338b88acaf0064`. Only a small, attributed metadata snapshot is imported here. **No GGUF, Safetensors, projector or training dataset is included.**

Hugging Face documents an Ollama integration for the Q4_K_M model. This project does not install or start Ollama. Once you have deliberately installed and verified your chosen local model, save the scene prompt from the studio and run:

```sh
python3 scripts/studio.py generate \
  --prompt-file scene-prompt.txt \
  --out runs/scene-001 \
  --endpoint http://127.0.0.1:11434 \
  --max-tokens 4096 \
  --context 16384 \
  --timeout 120
```

The adapter accepts only literal loopback HTTP endpoints. It disables proxies and redirects and enforces positive finite token, context, wall-clock and response-byte limits. It writes the exact original prompt, a bounded raw response, unchanged final response text, a separate extracted HTML derivative, and a manifest. It rejects truncated or incomplete model completions. Existing output directories are never overwritten.

**A mutable Ollama model name does not prove which weights are installed.** Receipts preserve the expected source pin and artifact hash but mark installed-weight identity unverified. Check your downloaded artifact against the upstream manifest before claiming a pinned inference result. The raw response may contain private provider reasoning; it is not displayed by the CLI and should remain private.

The only successful adapter status is `ready_for_browser_review`. A source file may still exist after a failed syntax/dependency check as an inspection artifact: consumers must read `manifest.status`. Rendering, interaction, visual fidelity, safety and model quality are not inferred from file existence.

## Inspect or import an existing response

No model is needed for these commands:

```sh
python3 scripts/studio.py inspect assets/reference-observatory.html
python3 scripts/studio.py import original-output.txt --out runs/import-001
```

Inspection uses Python's HTML parser and `node --check` on extracted inline JavaScript. Node is needed only for this syntax gate; imports are not resolved and scripts are not executed. The allowed dependency profile is Three.js core at:

`https://cdnjs.cloudflare.com/ajax/libs/three.js/0.160.0/three.module.min.js`

Source inspection is deliberately narrower than a browser engine. It cannot prove safe execution, useful geometry, correct controls or acceptable performance. The browser preview has a unique sandbox origin, no parent-origin privileges, restricted CSP, and no same-origin sandbox permission. These constraints reduce access; they are not a security certification or a CPU/memory sandbox. Review unfamiliar code before previewing it. Use a separate disposable browser profile/process for genuinely untrusted or resource-heavy output.

## Evaluate improvements honestly

`evaluation/public-cases.json` provides visible regression prompts and a common finite budget. They are **not blind holdout cases**. `evaluation/blind-holdout-manifest.template.json` defines a separate, currently unpopulated private evaluation split for an independent reviewer. Keep private prompts outside the optimizer's context, record hashes before running, and reject claims based on an unpopulated or leaked split.

Score complete HTML, syntax, rendering, controls, visual adherence and performance separately. Retain every failure, retry and repair. The primary suggested metric is first-attempt acceptance without repair; use equal budgets when comparing instructions or models. No local model-quality evaluation or training was performed in this increment.

The [upstream technical report](https://huggingface.co/ccore/Qwen3.5-4B-3D-Coder/blob/main/Qwen3.5-4B-3D-Coder_Technical_Report.pdf) is now public. It describes an exploratory comparison on eight development prompts, with retries, repairs and differing reference/checkpoint stopping rules. It should not be presented as an independent first-shot benchmark. The model card and report therefore justify separating our syntax and rendered-scene gates and recording retries explicitly.

## Verification

Run the deterministic local checks from the repository root:

```sh
node --test projects/threejs-game-studio/tests/core.test.mjs
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover \
  -s projects/threejs-game-studio/tests -p 'test_studio.py' -v
python3 projects/threejs-game-studio/scripts/studio.py inspect \
  projects/threejs-game-studio/assets/reference-observatory.html
```

The optional `tests/browser-check.mjs` uses an existing Playwright installation to exercise the original reference scene and studio controls in a real browser. Set `PLAYWRIGHT_MODULE` to an installed module's entry path if Playwright is not on the normal Node resolution path. No test downloads a model or performs inference. See `VALIDATION.md` for measured outcomes and limits.

## Source and license boundaries

| Material | Source / license | Scope |
|---|---|---|
| Studio, reference scene and adapter | Original Daftar / MIT | The original implementation in this directory |
| Model metadata snapshot | CCORE / Apache-2.0 | Exact files under `upstream/model/`; accompanying license retained |
| Three.js r160 | Three.js authors / MIT | `vendor/three.module.min.js` and `vendor/THREE-LICENSE` |
| Model weights | CCORE / Apache-2.0 | Referenced and hashed; not downloaded |
| Training dataset | CCORE / MIT | Referenced; not downloaded or revalidated |

`upstream/files.json` records imported file URLs, byte counts and SHA-256 hashes. This project recreates a studio workflow with original code; it does not claim to clone an entire CCORE application, reproduce model training, or reuse a third-party Hugging Face Space's unverified application license. No proprietary game assets, trademarks, binaries, ROMs or reconstruction targets are used.

`company-plan.json` is a declarative company/department plan. The Daftar native runtime remains the authority for actual saved companies, employee identities, provider budgets and job dispatch.
