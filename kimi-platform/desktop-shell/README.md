# Research Director Desktop Shell

Independent Electron desktop shell for the Research Director product. It packages
the app's static atlas for fully offline browsing, connects to the hosted,
authenticated Director runtime for full cloud-backed projects, and adds
local-only system/model capabilities (hardware inspection, Python venvs,
reviewed Hugging Face model downloads).

This project is intentionally separate from `/mnt/agents/output/app` (the web
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
scripts/sync-atlas.mjs   copies ../app/dist (or --src) into resources/atlas/
tests/                   vitest unit tests (fake executors/providers; no real venvs/downloads/API calls)
```

### Process and bridge model

- The **chrome window** loads `dist/renderer/chrome.html` over `file://` with a
  preload that exposes the versioned `desktopBridge` (v5; every older method
  is preserved). The preload additionally refuses to expose anything on
  non-`file:` pages.
- **Remote runtime and offline atlas** run in a `WebContentsView` with **no
  preload**, so remote pages cannot reach any desktop IPC. A local toolbar
  above the content view provides **Back to launcher** and **Open in browser**.
- `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`
  everywhere; no remote module; no TLS certificate bypass; no `shell: true`;
  the only child processes are fixed-argument `execFile` calls
  (`python3 --version`, `python -m venv`, `pip install huggingface_hub==<pin>`,
  `nvidia-smi --query-gpu=...`). Static tests enforce all of this.

### The three destinations

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
5. **CEO Portfolio (v0.5)** — a multi-company layer on top of Local Projects.
   An approved, hash-pinned blueprint materializes 5 company offices
   (real 1:1 Local Projects) sharing 7 service departments with contract
   seats. The CEO program dispatches company runs through the **same**
   ProjectRunner — there is no second agent runtime — under a global
   semaphore (default 2, max 4 concurrent company runs) and an
   envelope budget partitioned per company. See "CEO mode (v0.5)" below.

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

### CEO mode (v0.5)

- **Storage**: everything lives under `userData/enterprises/<enterprise-id>/`
  — `enterprise.json` (atomic writes, optimistic-concurrency `version`),
  `events.jsonl` (append-only enterprise events), `ledger.jsonl` (append-only
  work ledger), `cache/` (content-hash derivation caches), `exports/`
  (`HANDOFFS.md`, `timeline-index.json`, `ledger.json`, `ledger.md`).
- **Blueprint preview/apply** is deterministic and pinned: preview computes
  the blueprint + materialization payload hashes and a pending
  `blueprint-activation` approval; apply requires that approval **plus**
  `blueprintHash` + `payloadHash` + `expectedVersion` + explicit user
  confirmation. Apply is idempotent — re-applying the same blueprint reuses
  the same company projects and never duplicates departments or seats.
- **Contracts & seats**: cross-office worker contracts are seat identities
  (skill/role pinned). Runs acquire **capacity leases** (fencing tokens +
  TTL + drain) before dispatch; a live seat can never be double-booked, and
  a stale lease is released only with its exact fencing token. Seats are
  staffed only by verified bundled skills; seats whose packs have not landed
  are honestly marked `unstaffed` (no skill attached, no invented roles).
- **Program runs**: starting a program requires an approved, version-pinned
  `plan` approval. Budgets are partitioned across active companies by the
  shared `partitionBudget` function (allocations provably sum ≤ envelope).
  Each company run id is persisted **before** dispatch; pause/resume/cancel
  map to the existing run controls; after a crash the orchestrator
  **reattaches/recovers** the recorded runs without re-dispatching them and
  without rebooking seats.
- **Token-free operations**: the work ledger, timeline index, handoff
  manifests, and steward recommendations are deterministic derivations from
  actual runs, events, and artifact metadata — they make **zero provider
  calls** and cache **no provider responses**. Ledger rows carry the bounded
  intended ask, the prompt's sha256 (never the prompt), an extractive
  returned summary, and exact usage. See `docs/TIMELINE_INDEX.md`,
  `docs/HANDOFFS.md`, and `docs/CACHING.md`.
- **Shared memory** is reference-only (`ArtifactRef` + bounded extractive
  summary, integrity-checked against the artifact store). Promotion is
  approval-gated; revocation is direct. Cross-office prompts receive only
  handoff manifests (title + bounded extractive summary + sha256) — never
  full cross-office artifact bodies.
- **Compatibility**: chat (Director sessions) and the VS Code companion
  bridge are untouched; all v4 bridge methods are preserved. CEO mode adds
  no code execution, no tool use, and no writes outside
  `userData/enterprises/` and the existing project store.

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
npm run sync-atlas          # copy ../app/dist into resources/atlas
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
