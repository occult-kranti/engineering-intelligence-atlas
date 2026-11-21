# Donna CEO Assistant + Shared Assistants — Vertical Slice Plan

Codebase truth: local working trees `/mnt/agents/output/app` (web, branch `control-plane-depth`) and `/mnt/agents/output/desktop-shell` (Electron v0.5 CEO mode). Contracts are byte-identical twins: `app/contracts/{enterprise,assistant}.ts` == `desktop-shell/src/shared/{enterprise,assistant}.ts` (verified with `diff -q`).

---

## 1. Verified current state

### Contracts (DONE, both sides, byte-identical)
- `contracts/assistant.ts` (1529 lines, `ASSISTANT_CONTRACT_VERSION=1`):
  - `AssistantScope` + `ASSISTANT_SCOPE_RANK` (enterprise>company>department>office), 7 `ASSISTANT_GATES`, `ASSISTANT_DEFINITIONS` (donna / company-operations-assistant / department-coordinator / repository-integration-steward; permanent, `reportsTo` chain ending at donna→ceo).
  - `ASSISTANT_ACTIONS` (24) + `ASSISTANT_ACTION_POLICIES` (risk/requiresApproval/gates/drainAndPreserve/external/structural) — covers queue.add/reorder, worker.hire/pause/resume/fire, department & company pause/resume/archive, cache.invalidate, schedule.upsert/pause/resume/delete/run_now, study.enqueue, repository.import/assign/propose_structure, knowledge.transfer, program.pump.
  - `AssistantActionProposalSchema` (payloadHash = sha256(canonicalJson(payload)), `expectedVersion` OCC, risk, status machine), `FORBIDDEN_PAYLOAD_KEYS` recursive scan, `createAssistantProposal`, `validateAssistantAction` (hash/policy/scope/forbidden-keys/drain-preserve/gate checks in code).
  - Jobs: 5 kinds (ledger_refresh, cache_refresh, program_pump_mock, repository_sync, study_plan), all `providerCalls:false, paidCalls:false, executesProposals:false`; `AssistantJobScheduleSchema` (one-time | interval+anchor), `ASSISTANT_SCHEDULE_BOUNDS` (60s–30d, maxCatchUpRuns 1), `scheduleNextRun` (skip-forward, no missed-run storm, maxRuns terminator, zero budget).
  - `buildStudyQueue` (cap 32, dedupe by ref, content-derived ids, `providerCalls:false`).
  - `RepositoryMetadataSchema` (requires 40-hex `commitSha`), `RepoAssignmentPlanSchema`, `REPO_ROUTING_RULES` (7 keyword rules → creative_technology_group company/department/skill keys), `routeRepository` (non-public→quarantine; archived→quarantine read-only; no-match+new-domain-hint→`proposed_new_structure` @ confidence 0.25; else quarantine; permissive-license allowlist gates redistribution), `NEW_STRUCTURE_CONFIDENCE=0.25`.
  - `KnowledgeTransferRecordSchema` + `buildKnowledgeTransfer` (ArtifactRef[] only, contentSha256 bound).
  - `buildDonnaPrompt` (stable cacheable system prompt, fenced UNTRUSTED ledger/repo context, caps, "propose only" output contract).
- `contracts/enterprise.ts` v1: blueprint generator, `partitionBudget` (BigInt largest-remainder, envelope proof), OCC program, 4 deterministic permanent stewards (`PERMANENT_STEWARD_ROLES`, propose-only, providerCalls:false), `StewardRecommendation`, `HandoffManifest`, ledger/timeline DTOs, `ENTERPRISE_ACTIONS` registry.

### Desktop implementation (DONE)
- `src/main/enterprises.ts` (2227): `EnterpriseStore` (JSON record + atomic tmp+rename, OCC `version`, append-only `events.jsonl`/`ledger.jsonl`, `cache/` keyed by (version,eventSeq) for skill excerpts + blueprint, `exports/`), seat leases (fence+TTL+drain), `EnterpriseProgramRunner` (start/pause/resume/cancel/pump/recoverInterrupted over existing ProjectRunner — no second runtime).
- `src/main/chat.ts`: `ChatManager` — persistent sessions, `confirmed:true` required, per-session token/USD/minute ceilings, abortable, orphan reconciliation, sanitized errors, deterministic prompt w/ verified skill excerpts. `src/main/hiring.ts`: hire approval = exact hashed payload + OCC + persisted approval record.
- `src/shared/contract.ts` `BRIDGE_VERSION=5`, 30 `ent*` channels + `enterpriseEvent`; preload re-declares channels inline, kept in sync by `tests/contract-sync.test.ts` (also asserts every `ipcMain.handle` is `guard()`-wrapped).
- Renderer: `src/renderer/enterprise/app.ts` (1908 lines; partition table, contracts table, worker inspector, approvals overlay). No Donna surface.

### Web implementation (DONE)
- `api/enterprise.ts` (2100): applyBlueprint (hash-drift CONFLICT), decide/releaseContract (+`sweepDrainingContracts`), memory propose/decide/revoke, program start/pause/resume/cancel/pump (+`sweepEnterprisePrograms`), enterprise budget reservation checks, ledger/timeline pages, snapshot, worker suspend/capacity/reassign. `api/routers/enterprise.ts`: owner-scoped, `ACTION_PROCEDURES` parity map.
- DB (migration `0005_sparkling_multiple_man.sql`): `enterprises` (status enum already includes `paused`,`archived` — unused), `enterprise_companies` (`active` flag — used by partition only), `enterprise_departments` (NO status column), `worker_contracts`, `memory_entries`, `enterprise_programs` (OCC `version`, `pausedAt`), `enterprise_events` (append-only seq stream), plus `workers` (active/suspended, capacityGroupId pool), `idempotency_keys`.
- Scheduling driver: `api/boot.ts` unref'd interval (default 15s, `CONTROL_PLANE_INTERVAL_MS`, disabled in tests) → `sweepAndAdvanceOnce()` in `api/engine/scheduler.ts` (lease sweep, autonomy expiry, drain, advance runs, enterprise sweeps).
- GitHub: `api/integrations/connectors.ts` `githubInspectRepo`/`githubFetchReadme`/`githubTestConnection` — read-only, fixed `api.github.com` allowlist, 0 redirects, byte caps, error classes; import path re-fetches README and hash-pins to human-reviewed `expectedReadmeSha256`, lands as `quarantined` skill. Vault: AES-256-GCM owner-scoped `integration_records` (github provider), secrets write-only.
- UI: `src/views/director/enterprise/EnterpriseDetail.tsx` SECTIONS tabs (overview/structure/companies/pool/contracts/memory/activity) + `ConfirmDialog.tsx`; single snapshot query invalidated by version/event-seq. No Donna surface.

### Missing (the slice to build)
No assistant implementation anywhere: no `api/assistant*.ts`, no assistant DB tables, no `desktop-shell/src/main/assistant*.ts`, no assistant IPC channels, no UI. Contracts are dead code today.

---

## 2. Current code flaws / blockers (fix in-slice)

1. **No parity test for the assistant contract twin.** Enterprise has a shared fixture; nothing fails CI if `app/contracts/assistant.ts` and `desktop-shell/src/shared/assistant.ts` drift. Add `assistant-contract-sync.test.ts` (byte compare) on both repos' test suites.
2. **Web `githubInspectRepo` does not return the default-branch HEAD sha**, but `RepositoryMetadataSchema.commitSha` requires 40-hex. Add one read-only call (`GET /repos/{o}/{r}/commits/{defaultBranch}?per_page=1`, same allowlist/caps) to connectors; thread into assistant intake. Desktop has **no GitHub capability at all** — new main-process module required; it must be public-only (no token path; vault only holds openai/anthropic).
3. **Company/department lifecycle is absent on both sides.** Web: `enterprises.status` has dead `paused|archived` values, `enterprise_companies.active` exists but no mutation sets it, `enterprise_departments` has no status column. Desktop: only `programPaused` boolean, and it lives *outside* `CeoProgramStateSchema` (noted in code comment). Slice adds dept status (migration 0006) + company active/status ops + desktop record fields; prefer explicit status fields over more runtime-only booleans.
4. **No generic work queue.** `companyRuns` order is generator order; contract has study queue only. Add `AssistantWorkQueue`/`QueueItem` DTOs (additive contract section) + persistence; `queue.add`/`queue.reorder` executors (policy says no approval; OCC via `expectedVersion`).
5. **cache.invalidate has no target today.** Desktop cache is implicitly invalidated by (version,eventSeq) bump; make it explicit: namespace-level delete (`skill-*`, `blueprint-*`) + record bump. Web: verify/centralize snapshot memo keying on (version,eventSeq) in `getEnterpriseSnapshot` and expose the same explicit invalidation; do not add a second cache layer.
6. **Approval plumbing mismatch.** `approvals` table kinds (`plan|budget-increase|artifact-accept|knowledge-promote|external-action`) are run-scoped; assistant proposals are enterprise-scoped. Do NOT overload — new `assistant_proposals` table (status machine already in contract). Desktop stores proposals inside the enterprise record dir (new `proposals.json` + events), reusing the existing approval pattern from `hiring.ts`.
7. **Emergency stop must stay ungated.** No `emergency.stop` action exists in `ASSISTANT_ACTIONS` — correct by design; document that Donna drawer Stop buttons call existing `enterprise.programCancel` / `enterpriseRunner.cancel` / `chatStop` directly, never through the proposal pipeline. Guard: executor must reject any proposal claiming to be a stop.
8. **Minor:** desktop chat `BudgetLimits.maxUsd` is float dollars while enterprise uses integer USD micros — Donna chat accounting must convert at the boundary (micros internally) or drift appears in budget displays. `worker_contracts.capacity_share` is MySQL `double`; keep partition math in the integer/BigInt contract functions, never recompute from DB floats.
9. **Live pump path:** `program.pump` action gates on `live-provider-confirmation`; executor must call existing `startProgram/pumpProgram` only in mock unless the run's own live gates (plan approval + `confirmLive` + pricing configured, already enforced in `engine/scheduler.ts createRun`) are satisfied. Assistant jobs only ever run `program_pump_mock`.

---

## 3. Contract additions (Slice A — one PR, both repos, parity-tested)

Additive only; keep `ASSISTANT_CONTRACT_VERSION = 1` (new exports, no breaking change). Append to `contracts/assistant.ts` and copy byte-identically to `desktop-shell/src/shared/assistant.ts`:

1. `AssistantWorkQueueSchema` / `AssistantQueueItemSchema`: `{ id, scope, scopeKey, itemKind: "company-run"|"study"|"repository-triage"|"custom", refId, title(≤200), position (int, dense ordering), status: queued|dispatched|done|dropped, payloadHash, version }`. Reorder = dense reindex, deterministic tie-break by id.
2. `CacheNamespaceSchema = enum ["skill-excerpts","blueprint","snapshot","repository-metadata"]`; `CacheInvalidationReport { namespace, scopeKey, removedKeys: number, invalidatedAt }`.
3. `DepartmentLifecycleStatus = enum ["active","paused","archived"]`, `CompanyLifecycleStatus = enum ["active","paused","archived"]` (mirror into enterprise record/DB; contract-level so desktop/web agree).
4. `GithubIntakeMode = enum ["public-anonymous","credentialed-approved"]` — explicit field on repository proposals so the executor can enforce "no credentialed read without approval" (`credentials` gate already on `repository.import`).
5. `EmergencyStopNote` doc comment only: stop is NOT an assistant action.

---

## 4. Web backend (Slice B)

**DB — new migration `db/migrations/0006_assistant.sql` + `db/schema.ts` + `relations.ts`:**
- `assistant_jobs` (ownerId, scope, scopeKey, kind, schedule json, enabled, nextRunAt, lastRunAt, runCount, maxRuns, budget json=ZERO, `version` OCC, unique(owner,scope,scopeKey,kind,id)).
- `assistant_proposals` (ownerId, enterpriseId, scope, actor, action, payload json, payloadHash char64, expectedVersion, risk, requiresApproval, status, resultSummary, proposedAt/decidedAt/executedAt, unique(owner,id)).
- `assistant_queues` + `assistant_queue_items` (queue OCC `version`; items dense `position`, unique(queue,position)).
- `study_queue_items` (per contract DTO, `providerCalls` literal false not stored — implied).
- `repository_metadata` (per DTO incl. commitSha, visibility, intakeMode, createdBy recordId nullable), `repo_assignment_plans` (status assigned|quarantined|proposed_new_structure, confidence, readOnly, redistributionAllowed, approvedBy nullable).
- `knowledge_transfer_records` (refs json, contentSha256, handoff json).
- `enterprise_departments.status` enum col (default `active`); use existing `enterprise_companies.active` + add `archivedAt` nullable.
- No secrets anywhere; no artifact bodies (ArtifactRef only).

**`api/assistant.ts` (new, ~900 lines):** `AssistantStore` equivalents as DB functions — proposals CRUD + `decideProposal` (validateAssistantAction + gate confirmations + payloadHash + OCC in one transaction), executors per action mapping to EXISTING functions only:
- queue.add/reorder → queue tables (dense reindex, OCC on queue.version)
- worker.hire → existing contract/worker creation path (`decideContract` approved flow); worker.pause/resume → `setEnterpriseWorkerSuspended`; worker.fire → suspend + drain (reuse `releaseContract` drain semantics; artifacts/ledger untouched — they live in `artifacts`/`budget_ledger`/`enterprise_events`)
- department.pause/resume/archive → dept status + stop new claims (workers under dept suspended; archive requires drain+preserve payload)
- company.pause/resume/archive → `enterprise_companies.active`/status + partitionBudget re-derivation (inactive ⇒ zero reservation, already proven by contract) + program pump exclusion
- cache.invalidate → snapshot memo clear + event append
- schedule.upsert/pause/resume/delete/run_now → assistant_jobs (validate via `createAssistantJob`/`scheduleNextRun`)
- study.enqueue → `buildStudyQueue` from registry resources (skill resources already in `registry_resources`); status draft, no provider
- repository.import/assign/propose_structure → connectors inspect (+new HEAD-sha call) → `routeRepository` → persist plan; `assigned` plans only on human apply; unknowns stay `quarantined`; `propose_structure` only inserts a proposal row (never companies/departments)
- knowledge.transfer → `buildKnowledgeTransfer` over ArtifactRefs (+ `deriveHandoffs`-style summary, system-derived)
- program.pump → `pumpProgram` (mock only unless live gates already satisfied)
Every mutation appends to `enterprise_events` (actor `system` for jobs, `human` for approvals) and bumps enterprise `version` (cache invalidation + OCC).

**`api/routers/assistant.ts` (new):** owner-scoped like enterprise router; procedures: `definitions`, `propose`, `decideProposal`, `proposals`, `queue.get/add/reorder`, `jobs.list/upsert/pause/resume/delete/runNow`, `study.enqueue/list`, `repos.inspect/import/route/applyAssignment`, `knowledge.transfer/list`, `cache.invalidate`, `lifecycle.setDepartmentStatus/setCompanyStatus`. Mount in `api/router.ts` as `assistant: assistantRouter`. Emergency stop intentionally ABSENT.

**Scheduler:** extend `sweepAndAdvanceOnce()` in `api/engine/scheduler.ts` with `sweepAssistantJobs({limit:25})` (dynamic import, try/catch like enterprise sweep): select due enabled jobs (`nextRunAt <= now`), execute deterministic effect only, persist runCount/lastRunAt/nextRunAt via `scheduleNextRun(job, now)` — no catch-up storm; all effects free; `program_pump_mock` calls `pumpProgram` for mock programs only.

**Connectors:** add `githubHeadSha(repoUrl, token)` in `api/integrations/connectors.ts` (same guardrails); extend `githubInspectRepo` return with `commitSha`, `topics`, `visibility`, `archived` to fill `RepositoryMetadata` in one pass.

## 5. Desktop backend (Slice C)

- `src/main/assistant.ts` (new): `AssistantStore` under `userData/enterprises/<id>/assistant/` — `jobs.json`, `proposals.json` (atomic write, OCC via enterprise record `version`), queues in record; executors mirror Slice B mapping to `EnterpriseStore`/`ProjectStore`/`ChatManager` methods; `AssistantScheduler` (unref'd `setInterval` ≥60s + boot reconciliation; missed runs skipped per `scheduleNextRun`; timer never keeps app alive; jobs never run while program cancelled).
- `src/main/githubMeta.ts` (new): public-only read-only metadata fetch — GET `api.github.com/repos/{o}/{r}` + HEAD sha + topics; host allowlist enforced, `maxRedirects:0`, 256KB cap, timeout, error classes mirroring web; NO token support, NO clone, NO private repos (visibility!=public → quarantine via `routeRepository`, same contract fn).
- `src/shared/contract.ts`: `BRIDGE_VERSION = 6`; add channels: `astDefinitions, astPropose, astDecide, astProposals, astQueueGet/Add/Reorder, astJobs*, astStudyEnqueue/List, astRepoInspect/Route/Apply, astKnowledge*, astCacheInvalidate, astLifecycleSet` + `assistantEvent`. Add bridge methods to `DesktopBridge`.
- `src/preload/index.ts`: re-declare channels + wrappers (parity enforced by `tests/contract-sync.test.ts` — extend expectations).
- `src/main/ipc.ts`: register all handlers with `guard()` (contract-sync test counts guarded registrations).
- Donna chat: reuse `ChatManager` with a Donna session factory (system prompt from `buildDonnaPrompt`, `confirmed:true` send, existing budgets); proposals returned as text are parsed/validated via `createAssistantProposal`+`validateAssistantAction` before entering `proposals.json` — chat output is untrusted data, never executed.

## 6. UI (Slice D web / Slice E desktop)

**Web (`app/src/views/director/enterprise/`):**
- `DonnaDrawer.tsx`: right drawer over `EnterpriseDetail.tsx`; header = **scope selector** (enterprise / company:key / department:key, fed from snapshot lists) + assistant definition chip; tabs: **Queue** (add item form, drag/▲▼ reorder, OCC retry on conflict), **Hiring** (proposals inbox w/ risk badge, gate checkboxes per `ASSISTANT_ACTION_POLICIES`, payload diff view old-vs-new + payloadHash, approve/reject), **Schedules** (job list, create one-time/interval form w/ bounds hints, pause/resume/delete, run_now w/ confirm), **Cache** (namespace cards, last-invalidation, invalidate button), **Repositories** (inspect form → metadata card → routing plan w/ confidence/rationale/notes; quarantine bin; apply-assignment confirm; proposed-structure as low-confidence proposal only), **Knowledge** (transfer records, from/to, refs, contentSha256).
- `ActionConfirmDialog.tsx`: generic diff+confirmation built on existing `ConfirmDialog.tsx`; renders canonical payload diff + `payloadHash` prefix + required gate checkboxes (all must be ticked to enable Approve) + `expectedVersion` display; on CONFLICT shows "state changed — reloaded" and refetches snapshot.
- `useAssistantData.ts`: tRPC hooks keyed by (enterpriseId, scopeKey, version, eventSeq) — same invalidation discipline as `useEnterpriseData.ts`.
- New section entry "Donna" in `SECTIONS` + drawer launcher; reuse `enterprise.css` tokens.

**Desktop (`src/renderer/enterprise/`):** new `donna.ts` (drawer module rendered by `app.ts`, same six tabs, same scope selector; subscribe `onAssistantEvent`; all mutations via new bridge methods with `expectedVersion` from the current record; conflicts surface the same reload toast pattern already used for contracts).

## 7. Sequencing & parallelization

1. **A (contract)** — blocks everything; 1 agent, both files + parity tests.
2. **B (web backend)** and **C (desktop backend)** — independent after A; separate agents (different repos). B's connectors change is the only shared-file risk with other web work — coordinate on `api/integrations/connectors.ts`.
3. **D (web UI)** depends on B's router shape (can start on contract types + stub router after A); **E (desktop UI)** depends on C's channel names (fixed in A/C contract edit, so can start parallel).
4. Donna-chat desktop session (optional in slice): after C; web Donna chat: defer (proposals-first).

## 8. Tests

**Contract (both repos):** byte-parity test; `createAssistantProposal` policy derivation; `validateAssistantAction` — payloadHash mismatch, policy tamper, scope violation (department-coordinator at enterprise scope), nested FORBIDDEN_PAYLOAD_KEYS, fire without `{drain:true,preserveArtifacts:true}`, each gate-not-confirmed; `scheduleNextRun` — far-future now ⇒ exactly one due run, maxRuns terminator, clamp 60s/30d, one-time once; `routeRepository` — non-public quarantine, archived read-only, new-domain → 0.25 proposal, license allowlist behavior, tie-break determinism; `buildStudyQueue` cap/dedupe/stable ids.

**Web:** migration up/down; OCC conflict on concurrent reorder/decide (second writer gets CONFLICT, no lost update); sweep idempotency (crash mid-sweep → rerun no double effects; `idempotency_keys` reuse where applicable); fire-with-in-flight-claims → drain → release, artifacts + `budget_ledger` + events preserved; schedule job never creates provider calls (mock pump only); repo import with `recordId` refuses without approval + records `credentials` gate; SSRF: non-github hosts/redirects rejected; cross-owner 404.

**Desktop:** contract-sync (channels/preload/guard count); AssistantStore atomic write + corrupt-file recovery; scheduler reconciliation after process kill (no missed-run replay storm); lease fencing on fire; chat-confirmed enforcement; `githubMeta` rejects private/redirect/non-allowlisted; proposals from chat text validated (injection attempt in repo description treated as data).

**Stress:** 10k queue reorder ops under contention; 1000 jobs due in one sweep bounded by limit; far-future clock; proposal flood (dedupe by id+payloadHash); ledger growth caps.

**Recovery:** kill -9 during job run / during proposal decide / during repo import (re-fetch hash mismatch → CONFLICT, re-inspect); vault key rotation (AAD mismatch → unreadable, error class `auth`/`not_configured`, no plaintext fallback).

## 9. Non-goals (enforced by design, verify in review)
No clone/fetch of repo bodies; no code execution; no external writes; no private repo access without vault credential + approved proposal (`credentials`+`external-writes` gates); no automatic company/department/role creation (`proposed_new_structure` confidence 0.25, human apply only); no provider calls from jobs/stewards/study queues; no paid live calls from schedules (`program_pump_mock` only; live pump requires the existing run-level gates).
