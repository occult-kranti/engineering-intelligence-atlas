# ADR-2026-11-21: Optimize the Electron/TypeScript shell in place; no Rust/Tauri rewrite; native sidecar only behind measured gates

- **Status:** Accepted (evidence-gated decision)
- **Date:** 2026-11-21
- **Scope:** `/mnt/agents/output/desktop-shell` v0.5.0 (Electron 45.4.1, TypeScript 5.9, Vitest)
- **Method:** All v0.5 source was read directly (46 TypeScript files, ~22.8k LOC; `src/main`, `src/preload`, `src/renderer`, `src/shared`), plus `docs/CACHING.md`, `docs/TIMELINE_INDEX.md`, `docs/HANDOFFS.md`, and the prior caching research (`/mnt/agents/output/caching_dag_optimization_research.md`). Hot-path costs were measured with a synthetic, dependency-free Node benchmark (`/tmp/bench_hotpaths.mjs`, stdlib only) replicating the exact data shapes and caps in the schemas. No project source was modified; no downloaded code was executed. Vendor performance claims (Tauri, Electron) are labeled as such and never used as decision inputs.

---

## 1. Decision

**Keep the Electron/TypeScript stack. Do not rewrite in Rust/Tauri. Execute the ordered, reversible optimization program in §5. Re-evaluate a small Rust *sidecar* (never a rewrite) only if the precise thresholds in §7 trip after that program lands.**

Rationale in one paragraph: every measured hot path in this shell is a *data-flow* problem — full-file re-parses, re-validation, full-ledger IPC transfers, and O(n) dedupe scans — not a *language-runtime* problem. The fixes are incremental reads, memoized pure derivations, and paged IPC, all achievable in the current stack in days, with the existing ~400-test suite as the safety net. A Tauri rewrite would re-implement four security-critical subsystems (safeStorage vault, sandboxed IPC with sender validation, the `WebContentsView` remote-content trust boundary, the VS Code loopback companion) against platform equivalents that are either absent (Tauri has no built-in `safeStorage`; child webviews are an **unstable** API in Tauri 2) or weaker for this product (WebKitGTK on Linux, no CDP for UI automation), while invalidating the test suite and the working electron-builder pipeline — to solve problems the measurements do not show.

---

## 2. Verified current-state architecture (what would be thrown away)

| Subsystem | Implementation (file:line) | Evidence of maturity |
|---|---|---|
| Credential vault | `src/main/vault.ts` — Electron `safeStorage` (Keychain/DPAPI/libsecret), fail-closed when `isEncryptionAvailable()` is false, 0o600 blobs, metadata-only status | `tests/vault.test.ts`; OS-backed per official docs [E1] |
| Sandboxed renderers | `src/main/windows.ts:72-81,101-107` — `sandbox:true, contextIsolation:true, nodeIntegration:false, webSecurity:true` on both chrome window and content view | Matches Electron sandbox guidance [E2] |
| Remote-content trust boundary | `WebContentsView` with **no preload** for runtime/atlas (`windows.ts:98-112`); navigation policy `urlValidation.ts`; loopback-only http for dev runtime | `tests/urlValidation.test.ts` |
| IPC integrity | 74 `ipcMain.handle` channels, all behind `guard()` (`src/main/ipc.ts`); sender verified as the local file:// chrome top frame (`src/main/senderGuard.ts`) | `tests/senderGuard.test.ts` |
| VS Code companion bridge | Loopback-only HTTP on 127.0.0.1:4319, 256-bit pairing token in safeStorage, constant-time compare, Host allowlist, 64 KiB body cap, rate limit (`src/main/companion.ts:18-58,405-430`) | `tests/companion.test.ts` |
| Provider access | Pinned Vercel AI SDK, `maxRetries:0`, keys resolved per call, error sanitization strips key material (`src/main/providers.ts`) | `tests/providers.test.ts` |
| Data discipline | Append-only `events.jsonl`/`ledger.jsonl`, atomic tmp+rename writes, OCC `version` on every mutation, idempotent approvals by content hash | `tests/enterprise-store.test.ts`, `tests/projects.test.ts` |
| Determinism | All ledger/timeline/handoff/steward derivations are pure, zero-provider-call, enforced by a counting-fake-provider test | `docs/CACHING.md`, `docs/TIMELINE_INDEX.md` |
| Renderer hygiene | Windowed DOM (timeline 500 rows `office/app.ts:60`, ledger 200 `enterprise/app.ts:97`, chat 100 `office/chat.ts:64`), id-reconciled chat rows, ~200 ms event coalescing (`office/app.ts:244-257`), no `innerHTML` anywhere | `tests/renderer/*` (13 files) |
| Tests | 31 Vitest files, **405 `it(`/`test(` blocks, 0 skipped** (grep count; consistent with the "393+" figure quoted in planning docs) | `tests/` |
| Packaging | electron-builder AppImage/dir working; `release/linux-unpacked` = **305 MiB** (31 MiB of which is app resources: atlas + skills) | `package.json` scripts |

Orchestration limits already enforced in code (relevant to §6 budgets): project DAG ≤ **24 nodes**, depth ≤ 2 (`src/shared/office.ts:23-24`); enterprise program semaphore **default 2 / max 4** concurrent company runs (`src/main/enterprises.ts:82-83`); `ProjectRunner` executes nodes **sequentially** within a run (`src/main/projects.ts:1318` loop — one `await generateFn` at a time); ledger capped at **20,000 entries** (`enterprises.ts:79`); chat ≤ 50 sessions × 100 messages × 8,000 chars (`src/main/chat.ts:52-54`). Effective worst-case provider concurrency is therefore 4 (program) + 1 (chat) — already small and already governed.

---

## 3. Hot-path inventory — measured, not hypothesized

Benchmark environment: this container, Node v20.20.2, warm page cache, medians of 5–20 reps. Data shapes replicate the schema caps exactly (ledger entry: 1,000-char `intendedAsk`, 2,000-char `returnedSummary`, full `artifactRef`+`usage`). Electron 45 ships a newer V8 than Node 20, so absolute numbers will shift somewhat; the **orders of magnitude and ratios** are what the decision uses. All renderer-side gates in §6 are defined at **6× CPU throttle**, main-side gates unthrottled.

### 3.1 Measured baselines

| # | Workload (fixture) | Median | Notes |
|---|---|---|---|
| A1 | `ledger.jsonl` at realistic max: 20,000 lines = **78.1 MiB**; `readFileSync`+split+`JSON.parse` | **~280–330 ms** | per single full parse, main event loop blocked |
| A2 | A1 + hand-rolled field validation (lower bound of Zod `safeParse` cost; real Zod adds more) | ~277 ms | validation is not the dominant term — parsing is |
| A3 | Sort 20k entries by `(ts, seq)` | **1.4 ms** | derivation itself is trivially cheap |
| A4 | Retained heap for 20k parsed entries | **~227 MiB** | per live copy; GC pressure source |
| B1/B2 | Structured-clone of 20k entries (`v8.serialize`/`deserialize`, ≈ Electron IPC) | **~85 ms + ~125 ms**, 77 MiB payload | `entLedger` transfers the full filtered ledger |
| C1/C2 | Pure-TS SHA-256 vs `node:crypto`: 1 MB payload | 10.7 ms vs 0.7 ms (~15×) | but 20 KB blueprint hash = **0.2 ms** — see §3.3 |
| D | `canonicalJson`+SHA-256 of max-size blueprint (~20 KB) | 0.1–0.2 ms | negligible |
| E | `enterprise.json` with 20k `ledgerKeys` (0.66 MiB): stringify / parse | 0.9 / 0.7 ms | written on **every** mutation — acceptable but wasteful |
| E3 | 200 `ledgerKeys.includes()` dedupe checks (O(n) scan, n=20k) | **5.7 ms** | O(n·m) inside `syncLedgerFromRun` |
| F1 | `events.jsonl` 5,000 lines (1.9 MiB) full parse (`readEvents`) | ~5 ms | per poll per run — fine today |

Correctness note: the project's pure-TS SHA-256 (`src/shared/enterprise.ts:449`, `src/renderer/enterprise/hash.ts:46`) was verified byte-identical to `node:crypto` on empty/short/100 KB vectors; the FIPS 180-4 constant tables in all four copies (src+dist) are correct, and `tests/renderer/enterprise-ceo.test.ts:62-63` pins parity. **No hash bug exists.** (A transcription slip during benchmarking initially suggested otherwise; direct file comparison refuted it.)

### 3.2 The actual hot paths, ranked by cost at realistic max data

1. **Ledger/event parsing amplified by fan-out (main, sync I/O).** `EnterpriseStore.readLedger` (`enterprises.ts:1177-1207`) does a full synchronous read + per-line `JSON.parse` + Zod `safeParse` on *every call*. One coalesced enterprise refresh triggers it **three times**: `snapshot()` → `deriveStewardRecommendations` → `readLedger` (`enterprises.ts:1414`), the same call's `deriveHandoffs` → `readLedger` again (`:1358`), and the renderer's `entLedger` fetch (`ipc.ts:670`). At max ledger that is **~3 × 300 ms ≈ 0.9–1.0 s of blocked main-process time per refresh**, plus `deriveTimelineIndex` re-validating the whole array a second time via `z.array(...).parse` (`src/shared/enterprise.ts:1241`). This is the single dominant cost in the app.
2. **Full-ledger IPC transfer.** `entLedger` returns the entire filtered ledger (`enterprises.ts:1201-1206`); the renderer only displays the latest 200 (`LEDGER_CAP`). At max: ~77 MiB structured clone, ~210 ms combined serialize/deserialize, ~227 MiB transient heap on each side.
3. **O(n·m) dedupe + record bloat.** `syncLedgerFromRun` dedupes via `record.ledgerKeys.includes()` (`enterprises.ts:1240`) — O(n) per candidate against up to 20k keys — and persists those keys inside `enterprise.json`, so every mutation rewrites ~0.66 MiB (E/E3: today ~1 ms and ~6 ms per sync — moderate, but quadratic in growth).
4. **Per-call re-reads flagged by the prior research and confirmed:** `SkillRegistry.excerpt` re-reads `SKILL.md` per call (`skills.ts:142-161`; catalog is 20 skills / 1.2 MiB, constructor already hashes each body); `loadCatalog` re-validates per call (`catalog.ts:194-231`); `ProjectStore.readEvents` full-parse per poll (F1: 5 ms — acceptable now, same fix pattern as #1).
5. **Sync I/O on the main event loop** everywhere above (`readFileSync`/`appendFileSync`/`writeFileSync`). It does not block renderer compositing (separate processes) but it stalls all IPC responses, which is how it surfaces as UI jank.

### 3.3 Explicitly *not* hot paths (checked and cleared)

- **Graph layout.** Office canvas is a deterministic O(n) grid (`renderer/office/derive.ts:152-191`), n ≤ 24 desks; enterprise org graph is a 3-column position map (`enterprise/app.ts:690-706`) over a blueprint bounded by construction. Sub-millisecond; `panzoom` transform updates are compositor-friendly. No layout engine (dagre/wasm) is needed anywhere.
- **Visual layer (confirmed design decision).** The visual design stays on the **existing CSS + vendored `panzoom` + CSS motion + original SVG** stack — no new rendering dependency (no canvas/WebGL framework, no graph-layout library, no animation library). This is consistent with the measurements: SVG node counts are bounded (≤24 desks/canvas, blueprint-bounded org graph), edges are plain `<line>`/`<path>`, and pan/zoom runs through CSS transforms that the compositor handles. The §6.2 frame gates (p95 ≤ 32 ms at 6× throttle) are the guardrail that keeps this honest; if they ever trip *on rendering* (not IPC wait), the fix is DOM-count reduction within the current stack, not a new dependency.
- **Hashing.** Real payloads are 4–20 KB (skill excerpts ≤4,000 chars, blueprint ~20 KB): 0.2 ms on the pure-TS implementation. Artifact/prompt hashing runs in main on `node:crypto`. The 15× native/TS gap is irrelevant at these sizes.
- **Skill loading.** 20 catalog entries × ~60 KB, one-time constructor cost at startup; the excerpt re-read is a cache-miss-by-design issue (§5, item P2), not a scaling issue.
- **DOM timeline/chat.** Already windowed, reconciled, coalesced (§2). The renderer's residual cost is *waiting on IPC*, not DOM work.
- **Provider JSON.** Non-streaming `generateText`, one HTTP request per node, small model lists. Cost is network latency and provider time, which no local runtime change affects. (Vendor prompt caching is explicitly out of scope per `docs/CACHING.md` and remains measurement-gated per research §4.12.)

---

## 4. Why the full-rewrite hypothesis fails on evidence

### 4.1 The performance premise is wrong for this workload

- The measured bottleneck (A1) is **parsing the same bytes repeatedly**, not parsing them slowly. An incremental read (parse only appended bytes) reduces the steady-state cost of a 78 MiB ledger read to ~0 ms *in any language*. Rust would make the wasteful parse ~10–20× faster; not doing the wasteful parse makes it ∞× faster. Algorithm first, language second.
- Tauri's IPC is **not** faster for this app's largest transfer: Tauri command arguments/returns serialize to JSON by default — the official docs warn that returning large data "can slow down your application" and prescribe `tauri::ipc::Response` raw buffers as the workaround [T2]. Moving a 77 MiB ledger page through `invoke()` pays the same JSON cost the shell already pays through structured clone. The correct fix is *paging the transfer* (§5 P3), which is stack-independent.
- Vendor claims that Tauri apps use "10× less memory" or "~3–10 MB bundles vs Electron's 150+ MB" are **vendor/community marketing figures, not measurements of this app**, and are labeled as such. What is true for this product: its packaged payload is 31 MiB of first-party resources plus a fixed Chromium/Node runtime, and no product requirement constrains install size or idle RSS below what Electron already delivers. Bundle size is not a success condition; frame time and correctness are.

### 4.2 Migration risk is concentrated exactly where the product's value is

| Area | Electron (current, tested) | Tauri 2 equivalent | Risk |
|---|---|---|---|
| Secret storage | `safeStorage` built-in, OS keychain semantics, wrapped in a fail-closed `SafeStorageLike` seam with tests | **No built-in equivalent.** Requires `keyring-rs` or `tauri-plugin-stronghold` (new dependency, new threat-model review, re-implementation of vault *and* the companion token store) | High — security-critical, must re-audit |
| Remote content embedding | `WebContentsView` with no preload = clean trust boundary for the online runtime and offline atlas (`windows.ts`) | Child webviews are an **unstable cargo feature** in Tauri 2 per the official JS API reference [T3]; per-webview navigation policy must be rebuilt | High — core product feature on an unstable API |
| Renderer sandboxing | Chromium sandbox, `contextIsolation`, sender guard — all standard, all tested [E2] | Tauri's capabilities/ACL model is genuinely good, but the entire 74-channel IPC surface + preload bridge + sender checks must be re-declared and re-tested | Medium-high — large, delicate surface |
| VS Code loopback companion | 629-line hardened HTTP service with pairing, constant-time auth, rate limits — tested | Rewrite on axum/tiny-http; re-derive all protections; the desktop ↔ extension protocol must not change or the extension breaks | Medium — pure churn, zero user value |
| Linux webview | Bundled Chromium: identical engine everywhere, CDP available for automation | WebKitGTK: different engine, no CDP (no Playwright/Puppeteer-class UI verification; tauri-apps/tauri#15934), CSS/DOM behavior variance against the app's panzoom/SVG/a11y-heavy UI | Medium-high — QA regression risk on the exact surfaces the 13 renderer test files protect |
| Tests | 405 cases, incl. jsdom renderer tests and byte-parity golden fixtures | Pure derivations could port to Rust+serde, but every renderer/DOM test stays TS anyway; canonical-JSON + SHA-256 byte parity must be re-proven across *three* implementations | High — the safety net is the asset |
| Chromium security cadence | App-bundled, updated on the app's release cadence (Electron 45 is current) | OS webview: patched by the OS/vendor — Tauri frames this as a security win (faster patch rollout) [T1], but the app loses engine-version determinism | Trade-off, not a win |

### 4.3 What a rewrite would actually buy

Honest list: lower idle RSS (no bundled Chromium), smaller installer, native-speed JSON parsing, and a single language for core+sidecar. None of these addresses a measured problem in §3; all of them are purchasable later, cheaper, via the gated sidecar in §7 if the data ever justifies it.

---

## 5. Ordered optimization program (each step independently shippable and reversible)

Phase ordering follows the prior research's phase plan (§8 there), narrowed to this shell and re-prioritized by the measurements in §3. Every step keeps the IPC contracts and file formats byte-identical unless stated; every step ships with tests in the existing Vitest setup.

**P0 — Measurement harness (no behavior change).**
Add `perf_hooks.monitorEventLoopDelay()` and `process.cpuUsage()` sampling to main behind a debug flag; add a `scripts/bench/` Vitest bench that generates the §6 fixtures and times `readLedger`, `timelineIndex`, `snapshot`, `entLedger` serialization. Gate: harness produces the §6 baseline table in CI. *Depends on: nothing.*

**P1 — Incremental ledger/event reads (the big win).**
Per-enterprise read checkpoint `{ fileSize, mtimeMs, lineCount, tailOffset }` in `EnterpriseStore`; on `readLedger`, if the file only grew, read and parse **only new bytes** from `tailOffset`, else full reparse (the LangGraph checkpoint+tail pattern already cited in research §2.1/§4.4). Same for `ProjectStore.readEvents`. Also build the dedupe `Set` once per sync instead of `Array.includes` (fixes E3's O(n·m)). Tests: identical `{entries,nextIndex}`/filtered results as today across random `afterIndex` sequences; truncation/rewrite triggers full reparse; corrupt-line skipping preserved (`enterprises.ts:1194-1196` semantics). *Expected: eliminates ~90%+ of A1-class cost in steady state; refreshes go from ~1 s to parse-of-new-lines (sub-ms) at max fixture.*

**P2 — Memoize pure derivations on existing invalidation tokens.**
`deriveTimelineIndex`+stewards+handoffs memoized per enterprise on `(version, eventSeq, ledgerSeq)` — the exact tokens `CACHING.md` already defines for the disk caches; drop the double Zod pass in `deriveTimelineIndex` when input comes from the (already-validating) store. `SkillRegistry.excerpt` body cache `Map<sha256, excerpt>` populated at construction (research O1a); `loadCatalog` memoized on `(path, mtimeMs, size)` (research O1b). Tests: derivation outputs byte-identical before/after; tampered skill body still `verified:false`; counting-fake-provider test still passes (zero provider calls). *Expected: removes the 3× fan-out in §3.2.1 and the double validation; snapshot cost becomes O(new work).*

**P3 — Page `entLedger` like `entTimeline`.**
Add optional `{ afterSeq, limit }` (default page ≤ 500) to `entLedger`; renderer keeps "latest 200" + load-more, matching the existing timeline UX. Contract change is additive; the companion route and preload bridge keep validating the same schema. Tests: page stitching equals the unbounded result under concurrent appends; old call shape still works. *Expected: IPC per refresh from ~77 MiB / ~210 ms to <100 KiB / <1 ms at max fixture.*

**P4 — Move bulk work off the main event loop.**
Convert store reads to `fs.promises`; move export generation (`exportArtifacts`, which serializes the full ledger+timeline to 4 files) and any future >50 ms derivation into an Electron `utilityProcess` (official API for "CPU intensive tasks… previously hosted in the main process" [E3]) — a Node sidecar that requires **no new toolchain**. Tests: exports byte-identical; main event-loop p95 delay during export <16 ms on fixture F-ledger-max. *Depends on: P1–P2 (so the sidecar gets the incremental primitives, not the full-parse legacy).*

**P5 — Renderer memoization.**
Memoize `deriveRooms`/`roadmapRows`/`layoutRooms` on `(project.version, run.updatedAt, eventsNextIndex)` — the invalidation counter the renderer already tracks (research §4.3/§4.11). Tests: existing renderer tests unchanged; a memo-hit test asserts no recompute across identical ticks.

**Not planned (explicitly):** provider prompt caching (vendor feature, measurement-gated per research §4.12, currently *off by policy*); WASM/Rust hashing (§3.3); any graph-layout engine, canvas/WebGL renderer, or animation library — the visual layer stays on existing CSS/panzoom/motion + original SVG per the confirmed design decision (§3.3); streaming provider responses (policy decision, not performance).

---

## 6. Benchmark fixtures, budgets, and gates

### 6.1 Fixtures (generated, deterministic, committed under `scripts/bench/fixtures/`)

| Fixture | Definition | Size |
|---|---|---|
| `F-ledger-max` | 20,000 ledger lines at schema caps (1,000-char ask, 2,000-char summary, full artifactRef+usage) — the `MAX_LEDGER_ENTRIES` bound | ~78 MiB |
| `F-ledger-typical` | 2,000 lines at ~10% of caps | ~0.8 MiB |
| `F-events-max` | 5,000 run events, 280-char details | ~2 MiB |
| `F-blueprint-max` | Blueprint at max companies×departments×contracts (~20 KB canonical JSON) | ~20 KB |
| `F-chat-max` | 50 sessions × 100 messages × 8,000 chars | ~40 MiB aggregate |
| `F-project-max` | 24-node DAG, depth 2, max instructions per node | — |

### 6.2 Execution gates (CI + release checklist)

- **Renderer gates run at 6× CPU throttle** via CDP `Emulation.setCPUThrottlingRate {rate: 6}` (Electron exposes CDP through `webContents.debugger`); 6× is the standard mid-tier-mobile proxy and matches the planning requirement.
- **Main-process gates run unthrottled** (Node) with the benchmark harness pinned to **parallelism 1** (`vitest --no-threads` or sequential bench runner) for deterministic numbers; the *product's* orchestration limits stay as coded (program semaphore ≤ 4, sequential node dispatch) and are not relaxed for benchmarks.
- Cold start to interactive ≤ 3 s on `F-ledger-max` present.
- `entSnapshot`+`entLedger` refresh: p95 ≤ **100 ms** on `F-ledger-typical`, ≤ **400 ms** on `F-ledger-max` (post-P1/P2 both should be far below).
- Renderer frame health on office canvas + enterprise graph under throttle: p95 frame ≤ 32 ms and ≤ 2 long-task (>50 ms) events per minute during a scripted 5-min run-event storm.
- **Memory budgets:** main RSS ≤ 400 MiB steady state with `F-ledger-max` open; no single derivation retains >100 MiB; renderer JS heap ≤ 200 MiB; mounted DOM ≤ ~1,500 nodes in any windowed list (timeline 500, ledger 200, chat 100 are the caps — keep them).
- Zero provider calls in all derivations (existing counting-fake test), and the full 405-case suite green with 0 skips.

---

## 7. Rust sidecar: precise trigger thresholds (all measured on §6 fixtures, post-P1–P4)

A small Rust sidecar — scope: ledger/event **indexing only** (parse, validate, derive timeline/handoff projections), interfaced over NDJSON stdio or the existing loopback-companion pattern, spawned and supervised like the companion server — is justified **only when P1–P4 are shipped and at least one of the following holds for two consecutive release cycles**:

1. **Main-process CPU:** sustained >70% (1-min rolling, `process.cpuUsage`/`app.getAppMetrics`) attributable to store/derivation work during a scripted realistic session on `F-ledger-max`; *or*
2. **Parse latency:** p95 full-or-incremental read+derive for `entSnapshot` >100 ms on `F-ledger-max` (i.e., the incremental design failed to bound it); *or*
3. **Event-loop impact:** main-process event-loop p95 delay >50 ms (or renderer p95 frame misses >2/min at 6× throttle *traceable to IPC wait*, not DOM) during the §6.2 run-event storm; *or*
4. **Memory:** main RSS >500 MiB steady state, or a single retained derivation >100 MiB, on `F-ledger-max`, after streaming/batching refactors are exhausted; *or*
5. **Data growth:** a committed roadmap raises `MAX_LEDGER_ENTRIES` ≥10× (≥200k) or adds cross-enterprise aggregate views over multiple 20k ledgers — at that point a purpose-built indexer (Rust or Node `utilityProcess`) is the right shape regardless of language.

Before writing any Rust, the **Node `utilityProcess` sidecar (P4) must be tried first**: it isolates the same work from the event loop with zero new toolchain, keeps one language, and reuses the existing Zod schemas and tests. Rust enters only if a profiled CPU-bound remainder survives process isolation. Any Rust component must: reproduce canonical-JSON + SHA-256 byte parity against the golden fixtures (the parity discipline already enforced by `enterprise-ceo.test.ts`), keep schemas generated from the TS contracts (the `contract-sync.test.ts` discipline), and ship with fuzzed JSONL corpus tests. Vendor claims about Rust parse throughput (e.g., simd-json) are noted but not pre-credited; the sidecar proposal must carry its own before/after numbers on `F-ledger-max`.

---

## 8. Consequences

- **Positive:** the ~1 s/refresh worst case and the 77 MiB IPC transfer are eliminated with days of work, behind 405 existing tests; no new toolchain, no new audit surface; the caching research's phase plan is preserved and now has measured priorities.
- **Negative/accepted:** Electron's baseline footprint (305 MiB unpacked install; Chromium-class idle RSS) remains; sync-I/O refactors touch delicate OCC/atomicity code and must land behind the harness gates; the sidecar question is deferred, not closed — §7 makes the deferral falsifiable.
- **Review trigger:** this ADR is revisited automatically if any §7 threshold trips, if `MAX_LEDGER_ENTRIES` changes, or before any v0.6 scope that adds cross-enterprise views.

---

## 9. Sources

**This codebase (read directly):** `src/main/enterprises.ts` (:79, :1177-1349, :1411-1495, :1574-1618, :1804-1815), `src/main/projects.ts` (:655-825, :1290-1470), `src/main/skills.ts` (:98-162), `src/main/catalog.ts` (:194-231), `src/main/vault.ts`, `src/main/windows.ts`, `src/main/senderGuard.ts`, `src/main/companion.ts` (:18-58), `src/main/providers.ts`, `src/main/chat.ts` (:52-67), `src/main/ipc.ts`, `src/shared/enterprise.ts` (:411-527, :1238-1265), `src/shared/office.ts` (:23-24), `src/renderer/office/{app,chat,canvas,derive}.ts`, `src/renderer/enterprise/{app,hash}.ts`, `docs/{CACHING,TIMELINE_INDEX}.md`, `tests/` (31 files), `package.json`, `release/linux-unpacked`. Prior research: `/mnt/agents/output/caching_dag_optimization_research.md` (LangGraph checkpointing, Temporal replay, keyset pagination, vendor prompt-caching pricing — its citations).

**Official documentation:**
- [E1] Electron `safeStorage` API — platform key providers (Keychain/DPAPI/libsecret), `basic_text` fallback warning: <https://www.electronjs.org/docs/latest/api/safe-storage>
- [E2] Electron process sandboxing — sandboxed renderer behavior, preload constraints, `contextIsolation` requirement: <https://www.electronjs.org/docs/latest/tutorial/sandbox>
- [E3] Electron `utilityProcess` — "untrusted services, CPU intensive tasks or crash prone components which would have previously been hosted in the main process": <https://www.electronjs.org/docs/latest/api/utility-process>, process model: <https://github.com/electron/electron/blob/main/docs/tutorial/process-model.md>
- [T1] Tauri v2 Security — trust boundaries, capabilities, (non-)bundled webviews rationale: <https://v2.tauri.app/security/>
- [T2] Tauri v2 Calling Rust — command args/returns serialize to JSON; "This can slow down your application if you try to return a large data"; `tauri::ipc::Response` for raw buffers: <https://v2.tauri.app/develop/calling-rust/>
- [T3] Tauri v2 JS API reference — child webviews (`new Webview()`) require the **unstable** cargo feature: <https://v2.tauri.app/reference/javascript/api/namespacewebview/>; WebKitGTK/no-CDP limitation: <https://github.com/tauri-apps/tauri/issues/15934>

**Labeled vendor/community claims (not decision inputs):** Tauri bundle-size/memory comparisons vs Electron (tauri.app marketing and community posts); Anthropic/OpenAI prompt-caching pricing (research doc §2.7 — feature remains off by policy).
