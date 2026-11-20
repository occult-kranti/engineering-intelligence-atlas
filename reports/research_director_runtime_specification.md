# Research Director Runtime — Implementation Specification

**Document status:** specification, not a claim of working code. Nothing in this document asserts that any module exists, runs, or has been tested; sections labeled **MVP** describe what the first implementation must build, and sections labeled **Deferred (post-MVP)** or **Proposed** describe design intent only.
**Date:** 2026-11-20.
**Source basis:** the product requirements R1–R12 and hazard evidence in `company_swarm_product_research.md` (verified 2026-11-20) ([research doc](company_swarm_product_research.md)); the director loop, delegation contract, and registry rules in `agent-research-director` (SKILL.md and `references/registry_and_contracts.md`, `references/evaluation_and_research.md`); and the platform stack contracts in the `webapp-building`, `backend-building`, `website-ai`, and `website-storage` skill docs, which this specification treats as binding constraints.

---

## Implementation status addendum (verified 2026-11-20)

The specification has now been implemented in checkpoints. This addendum supersedes the earlier provider-deferral language where explicitly stated, but does not turn any other deferred item into a shipped feature.

- **Director MVP, checkpoint `e2541f5`:** Hono/tRPC/Drizzle/MySQL/Kimi OAuth, owner-scoped projects, editable DAG, mock/live provider seams, token/call/minute/USD budgets, approval gates, append-only events, artifact storage/export, and knowledge drafts. Verification: 36 tests, 125 browser checks, real gateway discovery plus one minimal billed smoke call, storage lifecycle, secret canaries, and self-contained `dist/boot.js` without `node_modules`.
- **Secure integrations, checkpoint `95b927d`:** AES-256-GCM owner-scoped credential vault, direct OpenAI/Anthropic discovery, read-only GitHub/Figma/Drive connectors, and remote MCP initialize/tools-list discovery with no tool execution. Verification: 76 tests plus production build and sign-in-gated browser checks. GitHub imports remain quarantined until a human-reviewed hash match.
- **Science & Models:** all 15 skill packages are seeded and pinnable, with seven dedicated science/model agent charters and a public Science & Models chapter. Verification: 76 tests and 168 browser checks across nine routes.
- **Desktop 0.2.0:** OS `safeStorage` credential vault, direct providers, localhost Ollama detection/generation, local squads, token/minute/USD limits, pause/resume/cancel, and artifact provenance. Verification: 143 tests plus unpacked and AppImage smoke tests.
- **Android debug:** Keystore-encrypted secrets, native OpenAI/Anthropic calls, local squad mode, and offline atlas. Verification: 53 Node tests, 18 JVM tests, Gradle build, and APK signature/package checks; no emulator or physical-device test.
- **Still deferred or limited:** generated-code execution, external writes, autonomous runtime hiring/replanning, distributed leases/event-driven wakeups, MCP tool execution, Drive OAuth refresh flows, full Figma document export, provider-key rotation tooling, production signing/store release, and live end-to-end calls with user-supplied OpenAI/Anthropic keys. Direct provider adapters are implemented and mocked; real usage requires the user's own model and credential configuration and may incur charges.

## 1. Purpose and product definition

The product is an **interactive director-graph application**: an owner creates research/engineering projects; a persistent director agent decomposes each project into a DAG of bounded specialist tasks; agents are instantiated from vetted skill files; execution produces typed document artifacts under explicit budgets and approval gates; and every action lands in an append-only event log. The MVP deliberately **executes no generated code and performs no external writes** — it is an orchestration, evidence, and artifact system, not an agentic coding platform. This scoping is a direct response to the hazard evidence: multi-agent task failure rates of 41–86.7% across studied systems ([MAST, NeurIPS 2025](https://arxiv.org/abs/2503.13657)), unbounded-loop token burn of 5–10× in conversation-driven frameworks ([AutoGen, arXiv:2308.08155](https://arxiv.org/abs/2308.08155)), and supply-chain findings that over 25% of public skill files carry at least one vulnerability ([arXiv:2601.10338](https://arxiv.org/abs/2601.10338)) — all of which argue for budgets, termination, vetting, and human gates as load-bearing features rather than add-ons.

**Non-negotiable platform constraints (from the stack skill docs):**

- **Frontend:** React 19 + TypeScript + Vite with Tailwind/shadcn, initialized by `webapp-building`; backend files never replace frontend files.
- **Backend:** Hono + **tRPC 11.x** + **Drizzle ORM + MySQL** + **Kimi OAuth (JWT sessions)**, grafted by `backend-building`. This specification defines **no** SQLite, Fastify, or Postgres anywhere; alternatives are not deferred options, they are out of contract.
- **AI calls:** the image-pinned AI SDK (`ai@6.0.290` + `@ai-sdk/openai-compatible@2.0.78`) against the platform gateway, per `website-ai`; the gateway credential is server-side only.
- **Files:** platform object storage via the `website-storage` SDK in `api/lib/storage.ts`; the site never holds cloud credentials; keys are persisted, never presigned URLs.
- **Deploy shape:** the platform runs `node dist/boot.js` from a zip containing only `bootstrap` + `dist/` + `.env` + `package.json` — **no `node_modules`** — so the server bundle must be self-contained (§11.3).

## 2. Requirements traceability overview (R1–R12)

| Req. | Summary (from research doc §7) | MVP disposition |
|---|---|---|
| R1 | Director node: intake, instantiation, hiring/routing, budget, termination; deterministic fast path + LLM routing for ambiguity | **MVP** — director logic runs server-side; mock-run path is deterministic; live LLM routing behind the provider interface (§8.4) |
| R2 | Skill-file-native roles; extended frontmatter; Git-backed, versioned, signed, vetted registry | **MVP** — registry with vetted/quarantined lifecycle and content hashes; **signing and Git backing deferred** (§7.4) |
| R3 | Explicit communication topology compiled to scoped send-message tools | **MVP (static subset)** — topology declared per project and enforced at the event/router layer; **dynamic pub/sub topics deferred** |
| R4 | Structured artifacts as the contract; machine-checkable acceptance criteria | **MVP** — typed document artifacts with JSON-Schema validation; no raw-transcript handoffs |
| R5 | Task graph + durable execution: DAG, checkpointing, replay/fork, budgets, timeouts, approval nodes, termination conditions | **MVP** — DAG with server-side validation, run state machine, budgets, approval nodes; **replay/fork deferred** (§13) |
| R6 | Dynamic hiring with recovery taxonomy (RETRY/REASSIGN/DECOMPOSE/REPLAN/CREATE_WORKER/ESCALATE) | **Partial MVP** — CREATE_WORKER/ESCALATE via director actions; automatic RETRY/REPLAN policies proposed, not shipped |
| R7 | Sandboxed execution of generated code | **Out of MVP by design** — no code execution at all; sandboxing becomes relevant only if post-MVP execution is approved |
| R8 | Independent verification layer; verifier ≠ producer | **MVP (deterministic subset)** — schema/contract/cycle checks and rule-based acceptance gates; **LLM-as-judge verifier deferred** |
| R9 | Observability & evaluation: tracing, per-run cost, mocked regression tests, benchmarks | **MVP** — append-only event log + per-run budget ledger + mock-run regression tests; **OTel export and benchmark harness deferred** |
| R10 | Interactive UI: live graph, node inspector, mid-run editing, HITL gates, replay | **MVP** — editable DAG canvas, run console with approval gates, artifact viewer, export; **time-travel debugging deferred** |
| R11 | Knowledge transfer: versioned memory; distilled skill drafts with human review | **MVP** — knowledge-draft review queue with promote/reject; **automatic skill distillation proposed, not shipped** |
| R12 | Governance: self-owned core, framework adapters behind internal API, RBAC, immutable audit, provenance | **MVP** — single-owner RBAC (owner/member), append-only events, skill provenance records; the provider/adapter seam (§8.6) is the framework-isolation layer |

*Table 1 — Requirement dispositions. "Deferred" items appear in §13 with their activation conditions; nothing deferred is implied to exist in MVP.*

## 3. System architecture

### 3.1 Process and module layout

One Hono process serves the Vite frontend build, the tRPC API under `/api/trpc/*`, and a small set of plain REST routes registered in `api/boot.ts` **above** the `/api/*` 404 catch-all (per the backend-building rule; the tRPC router stays in `api/router.ts`, and `bodyLimit` remains scoped to `/api/trpc/*`).

```
contracts/            # shared types & constants (frontend + backend boundary)
  dag.ts              # DagSpec, NodeSpec, EdgeSpec, validation result types
  run.ts              # RunState, EventType, Budget, ApprovalKind
  skill.ts            # SkillManifest, extended frontmatter schema, registry status
  artifacts.ts        # ArtifactKind, acceptance-criteria schema
api/
  boot.ts             # Hono app; REST registrations; 404 catch-all last
  router.ts           # tRPC appRouter composition
  middleware.ts       # publicQuery / authedQuery / adminQuery (grafted; not modified)
  routes/exports.ts   # plain REST: export download endpoints (§9.3)
  ai/ai-client.ts     # copied from website-ai template (pinned gateway factory)
  ai/provider.ts      # kimiGw() lazy factory; provider seam (§8.6)
  ai/list-models.ts   # listModels() runtime discovery cache
  engine/             # director + run engine (server-side only)
    director.ts       # triage, plan-DAG, hire/route, terminate
    scheduler.ts      # topo-order dispatch under budgets
    dag-validate.ts   # cycle + contract validation (§6)
    events.ts         # append-only event writer + sequence enforcement
    budget.ts         # token/call/wallclock ledger and hard stops
    approvals.ts      # approval gate state machine
    runner-mock.ts    # deterministic mock executor (§8.3)
    runner-live.ts    # gateway-backed executor (§8.4)
  registry/           # skill intake, hashing, vetting, quarantine (§7)
  knowledge/          # knowledge drafts, review queue (§9.4)
  queries/            # Drizzle query functions per table
db/
  schema.ts           # all tables (§4); FK columns use bigint unsigned to match serial PKs
src/                  # React frontend (§10); imports shared types only from @contracts/
```

The engine is **server-side only**. The browser never receives the gateway key, storage key, or any skill's raw bundled scripts; it receives manifests, DAG specs, events, and rendered artifacts.

### 3.2 Design invariants

1. **Event-sourced truth (MVP).** All run state derives from the append-only `run_events` stream plus current-state projections (`runs`, `run_nodes`). No handler mutates history; corrections are new events. This implements the OpenHands action/observation-log pattern ([OpenHands, arXiv:2407.16741](https://arxiv.org/abs/2407.16741)) and the audit requirement of R9/R12.
2. **Contracts enforced in code, not prompts.** Delegation contracts (from `agent-research-director/references/registry_and_contracts.md`) are Zod schemas + database constraints + scheduler checks; no contract term is left to prompt discipline, mirroring Agency Swarm's capability-level scoping where disallowed paths do not exist in the tool schema ([VRSEN/agency-swarm](https://github.com/VRSEN/agency-swarm)).
3. **Verification independence.** Acceptance checks for a node's artifact are executed by deterministic validators or a disjoint reviewer path, never by the producing runner (R8; `agent-research-director` evidence-gate rule).
4. **Bounded everything.** Every run and node carries explicit nonzero token, call, wall-clock, and cost budgets with hard stops, addressing MAST's dominant failure classes (step repetition 15.7%, termination-blindness 12.4%) ([MAST](https://arxiv.org/abs/2503.13657)).

## 4. Data schema (Drizzle ORM, MySQL)

All tables live in `db/schema.ts`; entity types are `typeof table.$inferSelect` (never hand-written interfaces, to stay aligned with superjson Date serialization); FK columns use `bigint("…", { mode: "number", unsigned: true })` to match `serial()` primary keys. All queries use Drizzle's type-safe API; no raw SQL. Owner scoping is a database-level discipline: every project-owned row carries `owner_id`, and every authed procedure filters on `eq(table.ownerId, ctx.user.id)`.

| Table (MVP) | Key columns | Purpose / notes |
|---|---|---|
| `projects` | `id serial PK, owner_id FK, name, goal text, risk_tier, status enum(draft,active,archived), created_at` | Owner-scoped project container (R1) |
| `dag_revisions` | `id, project_id FK, revision int, spec jsonb-equivalent (JSON column), plan_hash char(64), created_by, created_at` | Immutable DAG versions; edits create new revisions (R5) |
| `skills` | `id, owner_id, name, version, description, manifest json, content_sha256 char(64), status enum(quarantined,vetted,deprecated,suspended), provenance_url, license_declared, reviewed_by nullable, reviewed_at nullable, review_note` | Registry rows; only `vetted` skills are assignable (R2, §7) |
| `skill_files` | `id, skill_id FK, path, size, sha256, kind enum(body,script,reference,asset)` | Per-file inventory from the non-executing audit (no script ever runs server-side in MVP) |
| `agents` | `id, project_id FK, skill_id FK, role, model_preference json, cost_class, created_by_run_id nullable` | Instantiated specialists; `created_by_run_id` records dynamic hiring (R6) |
| `runs` | `id, project_id FK, dag_revision_id FK, mode enum(mock,live), state enum(§8.1), budget json, started_by, started_at, ended_at nullable, end_reason nullable` | Run header with budget snapshot (R1/R5) |
| `run_nodes` | `id, run_id FK, node_key, agent_id, contract json, state enum, attempts int, tokens_used int, calls_used int, started_at, ended_at` | Per-node execution projection |
| `run_events` | `id bigint PK, run_id FK, seq bigint, node_key nullable, type, payload json, actor enum(director,node,human,system), created_at` | **Append-only**; unique `(run_id, seq)`; no UPDATE/DELETE paths exist in code (R9/R12) |
| `approvals` | `id, run_id FK, node_key, kind enum(plan,budget-increase,artifact-accept,knowledge-promote,external-action), payload json, state enum(pending,approved,rejected,expired), decided_by nullable, decided_at nullable` | HITL gates (R5/R10); `external-action` kind exists for post-MVP only — MVP engine never emits it |
| `artifacts` | `id, run_id FK, node_key, kind, title, schema_uri, storage_key, content_sha256, acceptance json, accepted bool, reviewed_by nullable, created_at` | Typed document artifacts; content in object storage, key persisted not URL (R4, §9) |
| `knowledge_drafts` | `id, project_id FK, source_run_id FK, title, body text, state enum(draft,in-review,promoted,rejected), reviewer nullable, decided_at nullable` | Knowledge-draft review (R11, §9.4) |
| `budget_ledger` | `id, run_id FK, node_key, tokens_prompt int, tokens_completion int, calls int, cost_milli int, recorded_at` | Per-step accounting (MetaGPT CostManager / OpenHands per-run cost pattern) |
| `exports` | `id, project_id FK, run_id nullable, format enum(json,markdown), storage_key, created_by, created_at` | Export files in object storage |

*Table 2 — MVP schema. Deferred tables (§13): `run_checkpoints` (replay/fork), `skill_signatures`, `org_members` (multi-user RBAC), `provider_accounts` (post-MVP external adapters).*

## 5. API surface

### 5.1 tRPC routers (all registered in `api/router.ts`)

Every procedure takes a Zod `.input(...)` schema; mutations and parameterized queries are never input-less. Unless marked `publicQuery`, procedures are `authedQuery` and additionally enforce project ownership. There is no anonymous surface beyond the grafted auth endpoints.

| Router | Procedures (MVP) | Notes |
|---|---|---|
| `projects` | `list`, `get`, `create`, `rename`, `archive` | Owner-scoped CRUD; `create` seeds DAG revision 1 from a template |
| `dag` | `getRevision`, `saveRevision`, `validate`, `listRevisions` | `saveRevision` runs server-side validation (§6) and rejects invalid specs with a typed error listing every violation; `validate` is the same check as a dry run for the editor |
| `skills` | `list(status?)`, `get`, `register`, `setStatus`, `auditReport` | `register` parses the uploaded manifest, hashes content, writes `status=quarantined`; only an owner-side review action (`setStatus`) can move to `vetted` (§7) |
| `agents` | `list(projectId)`, `hire`, `retire` | `hire` requires a `vetted` skill and writes the `agents` row; routing eligibility is computed from skill metadata + contract, never from an LLM's free text |
| `runs` | `start`, `get`, `listByProject`, `stop`, `resumeAfterApproval` | `start` requires a validated `dag_revision_id` and a budget object with all limits nonzero; `mode` is `mock` or `live` (§8) |
| `events` | `tail(runId, afterSeq)` | Read-only stream for the UI console; server enforces ownership |
| `approvals` | `listPending`, `decide(approvalId, decision, note?)` | `decide` writes an `approvals` transition **and** a `run_events` entry atomically in one transaction |
| `artifacts` | `listByRun`, `get`, `accept`, `reject`, `downloadUrl` | `accept/reject` restricted to the disjoint-reviewer rule (§8.5); `download` URL minted via `storage.getPresignedUrl` at request time, never persisted |
| `knowledge` | `listDrafts`, `submitDraft`, `review(draftId, promote|reject, note)` | Promotion converts a draft into a **new quarantined** registry skill candidate — never directly into `vetted` |
| `exports` | `create(projectId, runId?, format)`, `list`, `downloadUrl` | Writes JSON/Markdown to object storage (§9.3) |
| `ai` | `listModels` | Thin owner-scoped wrapper over runtime model discovery (§8.4); result cached briefly server-side; **excluded from AI-call budget accounting** because model discovery is not an inference call |

*Table 3 — tRPC surface. Plain REST exists only for export file downloads/redirects and the grafted `/api/log` sink, registered in `api/boot.ts` above the 404 catch-all.*

### 5.2 Frontend↔backend typing

The frontend imports only from `@contracts/` (plus the one allowed `AppRouter` type import in `src/providers/trpc.tsx`). DAG specs, run states, event payloads, and skill manifests are defined once in `contracts/` as Zod schemas with inferred TypeScript types, so the editor, the tRPC validators, and the engine share a single source of truth.

## 6. DAG model and server-side validation

### 6.1 Node and edge contracts (MVP)

```ts
// contracts/dag.ts (shape — specification, not shipped code)
NodeSpec = {
  key: string;                    // unique per DAG; duplicate keys are a validation error
  role: string;                   // resolved against vetted registry skills
  skill: { name: string; version: string; sha256: string };   // pinned
  goal: string;                   // immutable once a run starts
  inputArtifactTypes: string[];   // must be satisfiable from upstream outputs
  outputArtifactType: string;     // drives acceptance schema lookup
  toolsAllowed: string[];         // MVP: read-only research/tool verbs; no exec, no external write
  budget: { maxTokens: number; maxCalls: number; maxWallclockSec: number };
  termination: { maxTurns: number; noProgressTurns: number; identicalActionRepeat: number; maxReplans: number };
  approvalBefore?: "start" | "accept";   // HITL gate placement
}
EdgeSpec = { from: string; to: string; kind: "artifact" | "control" }
DagSpec  = { revision: number; nodes: NodeSpec[]; edges: EdgeSpec[]; budget: RunBudget }
```

### 6.2 Validation rules (server-side, mandatory on every `saveRevision` and `run start`)

1. **Acyclicity** — Kahn's algorithm over `edges`; any residual node set after peeling is reported as a cycle with the offending keys. Cycles are rejected, never "resolved."
2. **Referential integrity** — every edge endpoint exists; every `skill` reference resolves to a registry row whose `status='vetted'` **and** whose `content_sha256` matches the pin (quarantined, deprecated, suspended, or hash-drifted skills fail validation).
3. **Contract typing** — each node's `inputArtifactTypes` must be produced by its transitive `artifact` upstreams; each `outputArtifactType` must map to a registered acceptance schema. This is the structured-artifact-handoff rule (R4), which exists because free-form chat handoffs correlate with specification failures ([MetaGPT artifact pattern, ICLR 2024](https://arxiv.org/abs/2308.00352); MAST FC1 at 44.2% ([MAST](https://arxiv.org/abs/2503.13657))).
4. **Budget sanity** — every numeric limit is a positive integer within global ceilings; run budget ≥ each node budget; missing limits are an error, echoing the delegation-contract rule that limits are explicit and nonzero.
5. **Termination presence** — every node carries all four termination fields; approval-gated nodes may additionally require human acceptance before downstream dispatch (FM-1.5 mitigation).
6. **Role uniqueness and scope** — node keys are unique (LangGraph guidance: duplicate agent names silently break routing); `toolsAllowed` is intersected against the skill manifest's own declarations, so a DAG can narrow but never widen a skill's declared capabilities (capability-level scoping, R3).

Validation returns `{ ok: boolean; violations: { rule: string; path: string; message: string }[] }`; the editor renders violations inline, and the engine re-runs the identical function at run start (no client-trusted validation).

## 7. Skill registry: vetting and quarantine

### 7.1 Manifest and intake

Skills are agentskills.io-compatible packages (YAML frontmatter + Markdown body + optional `scripts/`, `references/`, `assets/`) with the R2 extension fields: `role`, `capabilities`, `tools-allowed`, `model-preferences`, `cost-class`, `input-artifact-types`, `output-artifact-types`, `verification-hook` ([Agent Skills specification](https://agentskills.io/specification)). Intake performs the **non-executing inventory only**: parse frontmatter, list and hash every file (SHA-256), record provenance URL and declared license, and scan for risk signals (network/secret access patterns, hooks, MCP manifests) following the `agent-research-director` registry-audit contract. **Bundled scripts are never executed by this product in MVP** — not at intake, not in runs; they are inventoried and hashed.

### 7.2 Lifecycle state machine

`quarantined → vetted → (deprecated | suspended)`; `vetted → quarantined` on hash drift; `deprecated` is terminal-visible (existing DAG revisions keep their pinned hash for reproducibility but fail new validation). Transitions require an explicit owner review action with a note; there is no automatic promotion, and registry inclusion, popularity, or a passing parse is never treated as vetting evidence — the registry rule mirrors the documented skill supply-chain risk ([arXiv:2601.10338](https://arxiv.org/abs/2601.10338), [arXiv:2602.20156](https://arxiv.org/abs/2602.20156)).

### 7.3 Progressive disclosure at runtime

Runs load skill content in three levels: L1 (name + description) for routing; L2 (full body) into the executing node's context only; L3 (references) on demand. Scripts remain hashed inventory, never context or execution. This follows the standard's progressive-disclosure model and bounds context cost — a direct response to the measured ~78% token waste from agents reading each other's documents in MetaGPT telemetry ([MetaGPT paper, Table 9](https://arxiv.org/abs/2308.00352)).

### 7.4 Deferred registry items

Git backing, cryptographic signing, and multi-organization namespaces are **Deferred (post-MVP)**. The MVP provenance record (URL, hashes, review log) is designed so signatures can be added without schema upheaval.

## 8. Run engine

### 8.1 Run state machine (MVP)

```
            start()
 draft ──────────────► validating ──ok──► queued ──► running ──► awaiting_approval ──► running
                          │                                │            │    ▲
                          └─reject─► failed_validation     │   decide() ┘    │ (loop)
                                                           ▼
                                          ┌── completed (all nodes accepted)
                                          ├── failed (node failure, retries exhausted)
                                          ├── stopped_budget (hard stop, ledger recorded)
                                          ├── stopped_human (owner stop)
                                          └── terminated_policy (termination rule fired)
```

Every transition is an event in `run_events` with actor attribution (`director`, `node`, `human`, `system`); `runs.state` is a projection, never edited independently. Terminal states record `end_reason`. Per-node states mirror this at finer grain: `pending → ready → running → verifying → accepted | failed | skipped`, with `skipped` used when an upstream failure makes a node unreachable.

### 8.2 Budgets and termination enforcement

The scheduler checks budgets **before** dispatching any node call and reconciles the `budget_ledger` after every step: token, call, wall-clock, and cost limits at both node and run scope. Exhaustion produces `stopped_budget` with a partial-artifact preservation event (the delegation contract requires failure to leave visible, reusable evidence). Termination rules — max turns, no-progress turns, identical-action repeat, max replans — are evaluated by deterministic counters over the event stream, not by the model's self-report, directly targeting MAST's step-repetition and termination-blindness modes.

### 8.3 Deterministic mock runs (MVP default)

`mode='mock'` runs execute with a **deterministic mock provider**: node outputs are generated from a seeded generator (`seed = hash(run_id, node_key, attempt)`), producing schema-valid artifacts, fixed pseudo-usage numbers, and scripted failure/approval scenarios. Purposes: UI development, DAG-validation testing, budget/termination regression tests, and demos with zero billing. Mock events are indistinguishable in *shape* from live events but carry `mode=mock` in the run header and are excluded from any quality claims — a specification-level adoption of OpenHands' LLM-mocked integration-test discipline ([OpenHands](https://arxiv.org/abs/2407.16741)).

### 8.4 Live gateway path (MVP, constrained)

Live runs call the platform gateway through the image-pinned AI SDK per `website-ai`:

- **Runtime model discovery.** The engine resolves models via `listModels()` at run start (using `defaultModelId` unless the owner picked a listed model). Model IDs are **never hardcoded** — the gateway silently accepts and echoes unknown IDs, so a stale ID is a silent downgrade. Discovery responses are cached briefly server-side and are excluded from AI-call accounting because discovery is not inference.
- **Attribution.** The shared `kimiGw()` factory sets `X-Kimi-App-Id` from the platform-injected `APP_ID` on every model request (streaming, structured output, tool turns); the header is observational metadata, never overridden from browser input.
- **Server-side only.** `KIMI_AGENTGW_API_KEY` / `KIMI_AGENTGW_BASE_URL` never reach the browser; all model calls flow through the backend. An unprovisioned site raises `AiMisconfigured` lazily on first AI use while non-AI routes keep working.
- **Typed degradation.** All failures pass through `classifyAiError()` into the five typed errors — terminal: `AiUnavailable`, `ContentRejected`, `AiMisconfigured`, `AiInvalidRequest`; retryable: `AiTransient`. Terminal errors surface the mapped UI copy (quota exhaustion → "额度耗尽，此功能不可用，请管理员在 kimi 充值"); the run records the typed error and transitions the node to `failed` or `awaiting_approval` rather than crashing.
- **No automatic retry of billable calls.** A 5xx or client timeout does not prove the gateway skipped the work — the completion may already have run and been billed — so the engine **never auto-retries** a generation; it surfaces the failure and lets the owner retry deliberately (with a new attempt event). The narrow exception allowed by the platform contract — cheap, read-only, idempotent calls with exponential backoff honoring `Retry-After` — applies in this product only to `listModels()` refresh.
- **Structured artifacts.** Node outputs use `generateObject` with the node's acceptance schema, so artifact validation is structural, not editorial. Streams are treated as failed if they break without `data: [DONE]`.

### 8.5 Independent acceptance (R8 subset)

Artifact acceptance in MVP is: (1) deterministic schema/contract validation always; (2) rule-based acceptance checks per artifact type (required sections, citation presence, hash integrity); (3) human acceptance via the approvals gate for nodes marked `approvalBefore: "accept"`. The accepting actor is never the producing node. LLM-as-judge verification and MAST-annotator integration are **Deferred (post-MVP)** — the research basis flags LLM judges as correlated-model evidence that must not stand alone ([agent-research-director evaluation reference; MAST](https://arxiv.org/abs/2503.13657)).

### 8.6 Provider seam and deferred external adapters (Proposed, post-MVP)

All model access goes through an internal `ModelProvider` interface (`listModels`, `generate`, `stream`, `generateObject`, usage reporting, typed errors). MVP ships exactly one implementation: the Kimi gateway provider of §8.4. **Direct OpenAI/Anthropic adapters are a clearly deferred post-MVP extension behind this interface — not a shipped integration, not configured, and not implied to work.** Activation conditions (proposed): per-owner credential storage design, billing/attribution model, provider-specific error taxonomy mapped to the five typed errors, and a compliance review of model-provider terms. The seam exists because the framework lifecycle evidence is unforgiving — AutoGen frozen 2025-10, Flowise archived 2026-08, gpt-engineer archived, SuperAGI abandoned — so no external orchestration or model API is ever hard-bound into product logic ([company_swarm_product_research.md §1](company_swarm_product_research.md)).

## 9. Artifacts, storage, export, and knowledge review

### 9.1 Document artifacts (R4)

Node outputs are typed **document artifacts** — research briefs, evidence matrices, comparison tables, decision logs, synthesis drafts — each with a `schema_uri` (acceptance schema), Markdown/JSON content in object storage, `content_sha256`, and provenance (run, node, attempt). Artifact storage follows `website-storage` exactly: `storage.uploadFile` server-side with the key persisted in `artifacts.storage_key`; rendering uses `getPresignedUrl` minted at request time (URLs expire ~10 minutes and are never persisted); upload size is capped well under the server-enforced 100 MB; document uploads can take ~10 s due to synchronous content review, so client timeouts are generous; and storage errors surface by stable code (`STORAGE_QUOTA_EXCEEDED`, `STORAGE_REVIEW_REJECTED`, etc.) with plain-language copy. Delete paths are owner-checked only.

### 9.2 Handoffs without transcripts

The scheduler passes downstream nodes **artifact references + validated state + objective + constraints + audit ID**, never raw upstream transcripts — the LangGraph handoff guidance adopted verbatim as a system rule, because it is both a context-economy measure and a context-pollution defense.

### 9.3 Export (MVP)

`exports.create` renders a project or run into (a) a JSON bundle — project, DAG revisions, run events, artifacts metadata, budget ledger, approvals — and (b) a human-readable Markdown report mirroring the `agent-research-director` required director report (goal/scope, plan and assignments, skills/versions, evidence matrix, verification results, conflicts, cost/budget use, failures/terminations, limitations). Export files are stored under `exports/{projectId}/…` keys and served through a plain REST download route (registered in `api/boot.ts` above the 404 catch-all) that owner-checks and redirects to a freshly minted presigned URL.

### 9.4 Knowledge-draft review (R11 subset)

Runs can propose **knowledge drafts** (lessons, checklists, candidate skill bodies) which enter `knowledge_drafts` as `in-review`. An owner reviewer promotes or rejects with a note; promotion creates a **quarantined** registry candidate that must pass normal vetting before assignment — there is no run-to-registry shortcut. Automatic skill distillation from successful runs (the Voyager pattern, [arXiv:2305.16291](https://arxiv.org/abs/2305.16291)) is **Proposed, not shipped**: the security evidence on skill supply chains makes unreviewed auto-promotion unacceptable.

## 10. Frontend modules (React 19 + Vite)

| Module | Route | Contents (MVP) |
|---|---|---|
| Auth shell | `/login`, guarded layout | Grafted Kimi OAuth flow, `useAuth`, `AuthLayout` (from `backend-building` auth feature) |
| Projects | `/` | Owner's project list, create dialog, archive |
| DAG editor | `/projects/:id/graph` | Canvas editor (nodes/edges), per-node contract inspector, inline validation errors from `dag.validate`, revision history |
| Registry | `/skills` | Quarantined/vetted lists, intake upload (manifest + files), per-file hash inventory, review action with note, status badges |
| Run console | `/projects/:id/runs/:runId` | Live event stream (`events.tail` polling on `afterSeq`), node states, budget gauges (tokens/calls/wall-clock vs limits), typed-error banners with degradation copy, stop control |
| Approvals | within run console + global inbox | Pending gates with payload diff, approve/reject + note |
| Artifacts | `/projects/:id/artifacts` | Artifact list, rendered Markdown/JSON viewer, acceptance status, download via minted URL |
| Knowledge | `/knowledge` | Draft review queue, promote/reject |
| Exports | `/projects/:id/exports` | Create/list/download exports |
| Billing notice | settings + run-start dialog | Plain-language quota disclosure (§12) shown before the first live run |

*Table 4 — UI modules. Deferred UI: time-travel/replay debugger, multi-user admin, benchmark dashboards (§13).*

The editor never trusts itself: it calls `dag.validate` on every save intent, but the server re-validates identically on `saveRevision` and at run start.

## 11. Security model and test plan

### 11.1 Security model (MVP)

- **Authentication/authorization:** Kimi OAuth sessions via the grafted `api/kimi/`; all product procedures are `authedQuery` with owner scoping enforced in queries; admin procedures exist only where the graft provides them. Multi-user organizations are **Deferred**.
- **Credential boundaries:** gateway and storage credentials are server-side only; the frontend bundle contains no keys, no gateway URL, no model IDs. `.env` is the graft-generated file, never modified or committed.
- **Untrusted content:** skill bodies, web-derived artifact text, and user uploads are treated as untrusted data — rendered sanitized, never executed, never allowed to modify plans, permissions, or control flow (the `agent-research-director` taint rule).
- **No code execution, no external writes:** MVP executes no skill scripts and issues no external side-effecting calls beyond the platform gateway (inference) and platform object storage. The `external-action` approval kind exists in the enum only so post-MVP activation is additive; the MVP engine never emits it.
- **Event integrity:** `run_events` has no update/delete code paths; `(run_id, seq)` is unique; sequence allocation is transactional with the event insert.

### 11.2 Functional and security tests (MVP)

| Area | Tests |
|---|---|
| DAG validation | Cycle rejection (self-loop, multi-node cycle), dangling edges, duplicate keys, unsatisfiable input-artifact types, quarantined/hash-drifted skill rejection, budget/termination presence |
| AuthZ | Cross-owner access to projects/runs/artifacts/exports returns `FORBIDDEN`/`NOT_FOUND`; all product procedures reject anonymous callers |
| Engine | State-machine transitions legal-only; budget exhaustion → `stopped_budget`; termination counters fire; approval gates block dispatch until decision; events strictly sequential per run |
| Mock determinism | Same (run seed, node, attempt) → byte-identical artifact; scripted failure scenarios reproduce |
| Registry | Intake hashes match recomputation; status transitions require review note; promotion path always lands in `quarantined` |
| AI integration | `listModels()` returns `defaultModelId`; captured outbound request carries `X-Kimi-App-Id` equal to `APP_ID`; `classifyAiError` maps a mocked 403 quota error to `AiUnavailable` degradation copy; no auto-retry occurs on a mocked 5xx for a billable generation |
| Storage | Upload → two independent reads (`fileExists`/`headFile` + `listFiles`) → presigned render matches → owner-checked delete → `fileExists` false |
| Untrusted content | Skill body containing injected instructions is rendered inert; artifact Markdown sanitized |

### 11.3 Deployment tests (MVP, binding)

Per the backend-building deploy contract: (1) **bundle test** — `npm run build` must produce `dist/boot.js` via the esbuild bundle script (single ESM bundle with the `createRequire` banner); the self-check copies `dist/` + `package.json` to a directory **without `node_modules`** and asserts `node dist/boot.js` starts and serves `/`; a bare `tsc` build is a deploy failure (`ERR_MODULE_NOT_FOUND`). (2) **Entry test** — the entry compiles to exactly `dist/boot.js`. (3) **Root entry test** — a minimal `index.html` exists at project root (version-system requirement). (4) **Port test** — server binds port 3000. (5) **Wiring test** — `npm run check` passes with zero type errors; REST routes answer 200 and unregistered `/api/*` paths return the JSON 404 (proving registration order above the catch-all). (6) **Env test** — `.env` keys present before claiming provisioning (`grep -c '^KIMI_' .env`), with the documented caution that standalone scripts must load env explicitly.

## 12. Billing disclosure (binding copy rule)

Live model calls, object storage, and published-site runtime all consume the **owner's** quota. The product must never claim to be free, per-call free, or visitor-free; when storage is enabled, a site is published, or the first live run starts, the UI states plainly (per the `website-storage` billing rule): *“网站将根据使用的云服务和 API 调用产生计费。”* No amounts are invented; users are directed to 设置 → 额度和发票 → 使用明细 for actuals, and quota exhaustion is disclosed as a hard stop **before** it happens. Mock runs are labeled as not consuming model quota (they consume only ordinary site runtime), so demos never masquerade as free live runs.

## 13. Deferred and proposed items (activation conditions)

| Item | Disposition | Activation condition |
|---|---|---|
| Replay/fork checkpoints, time-travel debugging (R5/R10) | Deferred | Event-sourced design already supports it; needs checkpoint table + UI |
| Automatic recovery policies RETRY/REASSIGN/DECOMPOSE/REPLAN (R6) | Proposed | Needs failure-classification evidence from mock-run telemetry; any auto-retry must respect the billable-call rule |
| LLM-as-judge verifier, MAST annotator (R8/R9) | Deferred | Must run as a disjoint reviewer with deterministic checks remaining primary |
| OTel export, benchmark harness, cost-per-success reporting (R9) | Deferred | After MVP observability stabilizes; methodology per Aider-style honest-metrics model (pass rate + compliance + cost) |
| Git-backed registry, signing, org namespaces (R2/R12) | Deferred | Multi-tenant trust requirement; MVP provenance schema is signature-ready |
| Automatic skill distillation (R11) | Proposed | Gated on registry vetting throughput; never auto-promotes |
| Sandboxed code execution (R7) | Explicitly out of MVP; Proposed post-MVP | Requires isolated containers, network allow-lists, per-skill execution grants — the CrewAI CVE record is the counterexample ([research doc §2.4](company_swarm_product_research.md)) |
| External writes (publish, email, API posts) | Explicitly out of MVP | Requires the `external-action` approval path plus per-action grants |
| Direct OpenAI/Anthropic provider adapters | Deferred post-MVP behind `ModelProvider` (§8.6) | Credential storage, billing attribution, error-taxonomy mapping, terms review |
| Multi-user RBAC / orgs | Deferred | `org_members` schema + session model extension |

*Table 5 — Everything in this table is not part of MVP and is not claimed to exist.*

## 14. Traceability matrix

| Req. | Specified in | MVP mechanism |
|---|---|---|
| R1 Director node | §5.1 (`runs`, `agents`), §8.1–8.2 | Server-side director; budget/termination enforcement; deterministic mock default |
| R2 Skill-file roles | §7 | agentskills.io manifest + extended frontmatter; hash-pinned; vetted/quarantined lifecycle |
| R3 Communication topology | §6.2 rule 6, §9.2 | Contract-typed edges; capability narrowing; reference-only handoffs |
| R4 Structured artifacts | §6.1, §9.1 | Typed artifacts + acceptance schemas; `generateObject` structured output |
| R5 Task graph + durable execution | §6, §8.1 | Immutable DAG revisions; event-sourced runs; approval nodes; explicit termination |
| R6 Dynamic hiring + recovery | §5.1 (`agents.hire/retire`), §13 | Director hire/retire with audit; automatic recovery proposed |
| R7 Sandboxed execution | §11.1, §13 | Out of MVP — no code execution ships |
| R8 Independent verification | §8.5 | Deterministic validators + disjoint human acceptance |
| R9 Observability/evaluation | §4 (`run_events`, `budget_ledger`), §8.3, §11.2 | Append-only events; per-step ledger; mock regression tests |
| R10 Interactive UI | §10 | DAG editor, run console, approvals inbox, artifact viewer |
| R11 Knowledge transfer | §9.4 | Knowledge-draft review → quarantined candidates only |
| R12 Governance | §8.6, §11, §12 | Provider seam; owner-scoped RBAC; append-only audit; provenance records; billing disclosure |

*Table 6 — R1–R12 traceability to specification sections and MVP mechanisms.*

---

**Disclaimer.** This is a design specification for general informational purposes; it describes intended behavior, not implemented, tested, or deployed software. It is not legal, security-certification, or compliance advice. Platform APIs, environment variables, model availability, and billing terms are point-in-time observations from the referenced skill documentation (2026-11-20) and must be re-verified against the platform before implementation.
