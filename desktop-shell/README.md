# Research Director Desktop Shell

## Current company workspace (v0.3)

The desktop now includes a company and office workspace backed by the Rust `native-core/` executable. It provides a verified public GitHub registration flow, repository inventory, specialist assignments, roadmap state, persistent companies/offices/departments, Donna and shared assistants, an employee lifecycle, a bounded job queue, schedules, cache metadata, knowledge handoffs and an event ledger. The Electron renderer remains in place; a full Tauri migration is a later evaluation.

Build the native executable before launching or running the complete test suite:

```bash
npm ci
npm run build:native
npm run build
npm test
npm start
```

`build:native` requires Rust 1.89+ and uses the committed Cargo lockfile. Packaging includes the matching host binary and company seed files. Company and office state is written under Electron `userData/company/`; no repository files are changed by workspace controls. The GitHub employee checks public repository metadata and its compact branch reference before marking registration complete. Account import creates dedicated companies from actual public GitHub metadata.

The local worker runs one provider job at a time only while the owner enables it or explicitly runs the queue. Cloud jobs require a saved key, an explicit model, positive user-supplied pricing and authorized budget limits. Provider-call reservations survive cancellation and expired leases; estimates remain labeled until reconciled. A persisted employee or schedule is not a claim that a model runs while the desktop is closed. See [the native core protocol](../native-core/README.md) and [the Office contract](src/shared/office.ts).

Independent Electron desktop shell for the Research Director product. It packages
the app's static atlas for fully offline browsing, connects to the hosted,
authenticated Director runtime for full cloud-backed projects, and adds
local-only system/model capabilities (hardware inspection, Python venvs,
reviewed Hugging Face model downloads).

This project is intentionally separate from `../site-source` (the web
app + backend). It only **reads** the app's build output via the sync script.

## Architecture

```
src/
  shared/contract.ts     IPC contract: channel names + DTO types (authoritative)
  main/                  Electron main process (Node, CJS)
    index.ts             bootstrap + session hardening
    windows.ts           shell window + WebContentsView content isolation
    ipc.ts               desktopBridge IPC handlers (main-side validation)
    urlValidation.ts     runtime/external URL policy
    paths.ts             containment + repo-path safety
    systemInfo.ts        CPU/RAM/OS/disk/GPU (nvidia-smi, honest unknowns)
    catalog.ts           reviewed catalog validation + requirement gates
    downloads.ts         pinned HF downloads, resume, size/SHA-256 verify
    venv.ts              python3 -m venv under userData only
    jobs.ts              job manager + append-only JSONL log (no secrets)
    settings.ts          persists ONLY the non-secret runtime URL
    vault.ts             safeStorage credential vault (encrypted blobs only, fail-closed)
    providers.ts         OpenAI/Anthropic adapters via pinned AI SDK (ai@6), maxRetries: 0
    ollama.ts            optional Ollama loopback detection + generation (127.0.0.1 only)
    projects.ts          local squad projects: store, run engine, budgets, artifacts
    senderGuard.ts       strict IPC sender validation (shell window + file:// only)
  preload/index.ts       contextBridge bridge (v2); file:// pages only
  renderer/              local chrome/launcher page (no Node, sandboxed)
models.catalog.json      reviewed models (from research/reviewed_models.json)
models.catalog.schema.json
SECURITY.md              credential threat model + user responsibilities
scripts/sync-atlas.mjs   copies ../site-source/dist/public (or --src) into resources/atlas/
tests/                   vitest unit tests (fake executors/providers; no real venvs/downloads/API calls)
```

### Process and bridge model

- The **chrome window** loads `dist/renderer/chrome.html` over `file://` with a
  preload that exposes the versioned `desktopBridge` (v3). The preload
  additionally refuses to expose anything on non-`file:` pages.
- **Remote runtime and offline atlas** run in a `WebContentsView` with **no
  preload**, so remote pages cannot reach any desktop IPC. A local toolbar
  above the content view provides **Back to launcher** and **Open in browser**.
- `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`
  everywhere; no remote module; no TLS certificate bypass; no `shell: true`;
  the only child processes are fixed-argument `execFile` calls
  (`python3 --version`, `python -m venv`, `pip install huggingface_hub==<pin>`,
  `nvidia-smi --query-gpu=...`). Static tests enforce all of this.

### Destinations

1. **Offline atlas** — packaged static SPA from `resources/atlas/`
   (populate with `npm run sync-atlas`). No network use by this shell.
2. **Online runtime** — validated URL (HTTPS, or HTTP for loopback dev hosts
   only), normalized, opened in the isolated content view. Only the non-secret
   URL is persisted (`userData/settings.json`); credentials never touch the
   shell. TLS failures fail closed.
3. **System & Models** — local panel: hardware report, venv creation
   (explicit confirmation, containment-checked under `userData/venvs`, never
   activated, never used to run repo/model code), and reviewed model downloads.
4. **Local Projects** — text-only specialist squads (Director / Research /
   Build / Review, or your own nodes) executed from a goal, using your own
   OpenAI/Anthropic key or a local Ollama. Hard per-run and per-node budgets
   (max tokens / max minutes / max USD with your price rates), pause/resume/
   cancel, and artifacts with provenance persisted under `userData/projects/`.

### API keys (credential vault)

- Keys are entered into password fields, sent once over local IPC, encrypted
  with the OS keychain via Electron `safeStorage`, and stored only as
  encrypted blobs under `userData/vault/`. If OS encryption is unavailable the
  shell fails closed and refuses to store keys.
- No API ever returns key material (not even a last4); status is booleans +
  timestamps only. Revoke deletes the blob. Provider errors are sanitized so
  keys cannot leak through messages, logs, job events, or artifacts.
- Read **SECURITY.md** for the rooted-device / unlocked-keychain threat model
  and your responsibilities.

### Providers and models

- OpenAI and Anthropic generation goes through the pinned Vercel AI SDK
  (`ai@6.0.333`, `@ai-sdk/openai@3.0.144`, `@ai-sdk/anthropic@3.0.143`) with
  `maxRetries: 0` — no hand-written chat client, no automatic billed retries.
- Model selection is from a **live** list call (`GET /v1/models`) or an
  explicit model id you type; there is no bundled/fake model list.
- **Ollama** is optional and loopback-only (`http://127.0.0.1:11434`):
  detection + listing of models you already downloaded via `GET /api/tags`,
  and text generation via `POST /api/generate`. The shell never installs or
  starts Ollama, never pulls models, and refuses remote Ollama hosts.
- Local Projects never executes code and never writes outside
  `userData/projects/` and the selected provider API.


### Model catalog and downloads

- `models.catalog.json` entries carry an explicit `availability`:
  - `available` — reviewed and downloadable after human confirmation.
  - `unavailable` — verified metadata but gated (e.g. FLUX.1-schnell,
    `gated: auto`): needs your own Hugging Face account approval; HF publishes
    no anonymous per-file SHA-256 for it. One-click install is disabled.
  - `quarantined` — requires remote/external code (TripoSR, TRELLIS.2):
    research-only reference entries; download and run are disabled, and
    `remoteCodeRequired` is `true`. This shell never runs `trust_remote_code`.
- Downloads use fixed official `https://huggingface.co/resolve` URLs pinned to
  the catalog's 40-hex commit SHA and the exact reviewed `files[]` set (no live
  tree listing is trusted). Redirects are followed manually against a host
  allow-list. Resume uses `.part` files + HTTP Range; completed files are
  size-verified always and SHA-256-verified whenever HF publishes the hash.
  Artifacts are never executed.
- Requirement gates compare declared `minRamBytes`/`minVramBytes`/`sizeBytes`
  against measured free RAM/VRAM/disk. `null` means "not declared/derivable"
  and is reported as **unknown**, never as zero or pass. GPU VRAM is measured
  via `nvidia-smi` only; when unavailable, VRAM is reported unknown — never
  inferred from a GPU name.
- If a local runtime such as Ollama is selected later, integrate only via its
  documented local HTTP API with the same explicit-approval rules.
  (Done in v0.2.0: loopback-only, no pulls; see "Providers and models".)

### Privacy & billing

- Offline atlas and System & Models are fully local; no data leaves the
  device; no charges.
- Local Projects send your goal, prompts, and node outputs directly to the
  provider you select (OpenAI/Anthropic) under your own key and their billing
  terms, or to your local Ollama (no network beyond loopback). Budgets are
  hard stops but provider-side limits are your responsibility too.
- The online runtime processes projects/prompts/files in the hosted Director
  service under its own terms; usage may be billed by that service.
- The job log (`userData/logs/jobs.jsonl`) and project event logs are
  append-only and written from field whitelists — no tokens or secrets.

## Development

```bash
npm install                 # deps (Electron binary: see "Electron download" below)
npm run build               # tsc main/preload + renderer + copy assets
npm run sync-atlas          # copy ../site-source/dist/public into resources/atlas
npm test                    # vitest unit tests
npm start                   # build + launch Electron
npm run package:linux       # electron-builder: AppImage + unpacked dir
npm run package:dir         # unpacked dir only (fast debug package)
```

### Electron download behind restricted networks

The default Electron binary download comes from GitHub releases. If that is
unreachable, set a mirror before install, e.g.
`ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm install` then
`ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/ node node_modules/electron/install.js`.

## Packaging

- **Linux** (this repo builds it): `npm run package:linux` → `release/`
  (AppImage + `linux-unpacked/`). AppImage tooling downloads `appimagetool`
  on first use; on hosts without FUSE, use the unpacked dir.
- **Windows / macOS**: must be packaged on their respective host OSes
  (`npx electron-builder --win nsis` / `--mac dmg`) — cross-building is not
  supported here.
- Packages are **unsigned debug builds**: no code signing, no notarization,
  no store submission, no auto-update. Not store-ready by design.

## Dependency notes

- electron `^45.4.1`, electron-builder `^26.18.0`, `@types/node` `^24`.
- `ai@6.0.333` + `@ai-sdk/openai@3.0.144` + `@ai-sdk/anthropic@3.0.143` +
  `zod@4.6.7` (exact pins): provider generation/model discovery. Provider v3
  packages are the line compatible with `ai@6` (shared `@ai-sdk/provider@3`).
- TypeScript pinned to `~5.9.3`: the 7.x line is the rewritten toolchain
  preview; 5.9.x is the stable line compatible with the current ecosystem.
- vitest `^4.1.12`: supports Node 20 (this workspace's runtime) and fixes the
  tinypool advisories present in the 2.x line. vitest 5.x requires Node ≥ 22.
- `npm audit` currently reports 6 moderate issues, all inside electron-builder
  packaging-time dependencies (minimatch glob DoS chain). They affect only the
  local build tool, never the shipped app; no non-downgrading fix exists yet.

## Version pins to review

- `PINNED_HUGGINGFACE_HUB` in `src/main/venv.ts` — verify/bump the pinned
  huggingface_hub version when installing that optional tool.
