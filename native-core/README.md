# Atlas native core

Rust owns the local company state, office hierarchy, work queue, schedules, shared budget admission, scoped conversations, goal graphs, office blueprints, cache metadata, knowledge handoffs and bounded repository inventory. Electron remains the desktop UI. This release does not claim a Tauri migration or background model execution when the application is closed.

## Build and verify

```bash
cargo test --locked --manifest-path native-core/Cargo.toml
cargo build --release --locked --manifest-path native-core/Cargo.toml
cd desktop-shell
npm run build:native
npm run build
npm test
```

Use Rust 1.89 or newer with the versions in `Cargo.lock`. The verified development build uses stable Rust 1.100.0. `npm run build:native` copies the host executable to `desktop-shell/native/` for packaging; binaries and build output are not committed. Windows and macOS require native builds on the corresponding host. A missing executable is shown as unavailable and never replaced with fabricated results.

## Process protocol

The executable accepts one JSON object on standard input and writes one JSON response. It never reads commands from a repository, invokes a shell, makes network requests or calls an AI provider.

```json
{
  "command": "office_snapshot",
  "stateDir": "/absolute/user-data/company",
  "seedDir": "/absolute/engineering-intelligence-atlas/company"
}
```

Success is `{ "ok": true, "snapshot": ... }`. Failure is `{ "ok": false, "code": "...", "error": "..." }`. Request size is capped at 1 MiB. The application-owned state file is capped at 64 MiB. State paths must be absolute and contain no symlinks or parent traversal.

| Command | Purpose |
| --- | --- |
| `snapshot` | Current first-company record, specialist assignments and release roadmap |
| `register_company` | Persist metadata checked by the GitHub adapter and complete the registration task |
| `record_github_check` | Record a failed check without claiming registration or connection |
| `update_task` | Owner roadmap update; completion requires evidence |
| `index_repository` | Metadata inventory under the configured `repositoryRoot` |
| `office_snapshot` | Read the durable hierarchy and queue; reconcile expired leases |
| `office_command` | Apply one validated office action in `payload` |

`control_snapshot` and `control_command` are aliases for headless clients. Office responses contain the office view; company responses contain the original company view. Both views share one `company-state.json` and one cross-process OS lock. Configure Electron and the MCP server with the same state directory when sharing a workspace.

## Office actions

- Companies: `create_company`, `select_company`, `import_repositories`, `pause_company`, `resume_company`.
- Hierarchy: `create_office`, `create_department`, `pause_office`, `resume_office`, `pause_department`, `resume_department`.
- Employees: `hire_employee`, `pause_employee`, `resume_employee`, `fire_employee`.
- Work: `enqueue_job`, `claim_job`, `reserve_job`, `heartbeat_job`, `finish_job` / `complete_job`, `pause_job`, `resume_job`, `cancel_job`.
- Schedules: `create_schedule`, `pause_schedule`, `resume_schedule`, `tick_schedules`.
- Cache: `configure_cache`, `get_cache`, `put_cache`, `clear_cache`.
- Knowledge: `add_knowledge`.
- Policy/accounting: `configure_policy`, `approve_job`, `reserve_external`, `settle_external`.
- Conversations: `post_chat`, `post_assistant_message`.
- Goals: `create_goal`, `plan_goal`, `set_goal_plan`, `execute_goal`, `advance_goal`, `pause_goal`, `resume_goal`, `checkpoint_goal`, `tick_goals`.
- Office ownership: `bootstrap_directors`, `ensure_blueprint`, `save_blueprint`, `upsert_room`, `place_employee`, `upsert_whiteboard`.
- Verified GitHub activity: `record_github_activity`.

The authoritative UI/worker types are in `desktop-shell/src/shared/office.ts`. Donna is the permanent CEO assistant. Every new company receives a shared company assistant, a main office with its assistant, Engineering/Research departments with their assistants, and six specialist assignments: subdirector, blueprint steward, knowledge curator, QA lead, GitHub steward and code engineer. Bootstrap is idempotent and respects an existing paused or fired assignment. Skills refer to actual repository skill files. These are persistent assignments, not continuously running model processes. Company, office and department references remain immutable for each employee/job. Employee removal preserves prior job evidence.

GitHub account discovery runs in the application or MCP adapter. Public metadata is labeled `github-public-api`; authenticated owner imports are labeled `github-authenticated-api` and preserve `visibility` and `defaultBranch`. Private visibility cannot be attached to a public source. Repository code is neither downloaded nor executed by import. Import is idempotent by canonical repository URL, capped at 200 records per command and 2,000 companies per workspace. Import metadata does not claim that a branch commit or application build was verified. Private company names and state belong in application data, never public release seeds.

## Work lifecycle and billing

1. Enqueue an immutable goal, scope, dependencies, explicit mode, model, provider and token/time/USD limits. `manual` is the default. In review mode, provider jobs require explicit owner authorization; autonomous application policy permits dispatch within the same enforced limits. It does not override platform permissions or supply missing tool capabilities. Cloud jobs without a positive spend cap and positive input/output prices cannot be claimed.
2. `claim_job` atomically selects one due, authorized job whose company, office, department and employee are active and whose prerequisites completed. It returns `lastAction.jobId` and `lastAction.leaseToken`. Jobs are not claimed twice.
3. Before a model call, the worker uses `reserve_job` with worst-case input tokens, maximum output tokens and USD cost. The core rejects reservations above the job limits and atomically checks the shared application budget. `lastAction.reserved: false` means **do not call the provider**. The job becomes `waiting-budget`, keeps all goal/checkpoint references and becomes eligible when enough reserved funds are released or the policy is changed. No failed billed attempt is retried automatically.
4. The worker settles with the same lease token, observed or estimated usage, an artifact reference and a concise result summary. Exceeding a budget becomes `budget-exhausted`, preserving evidence. Completion never revives a cancelled, paused or expired attempt.
5. A lost worker lease becomes `needs-review`. Its outstanding reservation becomes an estimate requiring billing reconciliation. Terminal prerequisites move their dependents to review. A previously dispatched paused job cannot be resumed as an automatic new billed call.

The initial worker is bounded to one concurrent provider job. It runs while the desktop is open and the owner enables it, or when the owner explicitly runs the queue. Scheduled records survive restart; they are not an operating-system background service. A schedule tick enqueues at most 100 due schedules, enqueues one missed occurrence per schedule, and advances recurring schedules from the current time. Invalid schedules are disabled with an event while other due schedules continue.

## Staff definitions and scope ownership

Saved employees are persistent definitions. They do not start a provider process when created, edited, paused or resumed. Donna remains the single global assistant; each company, office and department retains its own same-scope permanent assistant. Snapshot validation rejects a fired/scoped Donna, a specialist substituted as an assistant, and assistants assigned to another scope. A paused assistant remains the owner of its saved scope.

| Action | Input and resulting behavior |
| --- | --- |
| `update_employee` | `employeeId` and at least one of `name` (150 UTF-8 bytes), `role` (200 bytes), `skillPaths` (up to 20 distinct `skills/.../SKILL.md` references). Active and paused definitions can be edited. |
| `rename_office` | `officeId`, `name` (150 bytes). Keeps the office ID, staff, assistant, parent company, layouts, jobs and grants. |
| `rename_department` | `departmentId`, `name` (150 bytes). Keeps the department ID, parent, staff, assistant, layouts, jobs and grants. |
| `pause_employee` / `resume_employee` | Retains the definition, grants, history and artifacts; resuming the employee does not implicitly resume its paused jobs. |
| `fire_employee` | Specialists only. Preserves the definition as terminal history and cancels queued, budget-waiting, running and paused jobs while retaining reserved/observed cost for settlement. Permanent assistants must be paused instead. |

Definition edits reject identity, scope, lifecycle, assignment-key and other unknown fields. A role title or skill reference never grants tool access. Fired definitions remain immutable; rehire creates a new definition. The native authority boundary requires current scoped `team.manage` for delegated edits and renames, and records them in the existing control ledger. Remote versions use the existing receipt and expected-state-hash protocol, so identical retries are no-ops and reused IDs with different payloads fail.

Department removal is a retained lifecycle pause rather than destructive deletion: use `pause_department` and `resume_department`. Reparenting remains an explicit `set_department_parent` command and does not move employees or extend permissions. Renaming does not silently change user-authored room or assistant labels.

## Shared application budget

The default application policy is review mode, a $10 cumulative hard cap, an 80% warning threshold and no global token cap. This is application usage accounting, separate from any development-session spending allowance. The owner may configure a USD cap up to $1,000,000, an optional global token cap, warning percentage and dispatch pause. Historical observed/estimated usage is never erased when a policy changes. Existing local-project runs from before shared admission was installed are not retroactively inserted into this ledger.

`snapshot.budget` derives observed, estimated and currently reserved USD and committed tokens from the same durable job and external-attempt ledger. Warnings do not stop work. A hard cap blocks new requests before dispatch. A lower cap or dispatch pause does not cancel an already reserved call; that call can finish, save its artifact and settle its usage. Unknown usage retains a conservative estimate. Per-attempt transport deadlines and explicit owner cancellation are separate controls.

Live `check_worker_authority` checks distinguish admission from continuing a valid running reservation. An already reserved, unsettled call does not reapply its own committed spend to global admission, including when that reservation exactly fills the cap. Current grants, employee/scope lifecycle, service contracts, selected knowledge grants and the worker lease remain enforced. An unreserved claim cannot use this exception.

Managed calls outside the office queue use the worker-only actions below. This includes legacy project runs and provider-backed chat if the adapter supports it. An office request already covered by `reserve_job` must not also receive an external reservation.

```json
{"action":"reserve_external","attemptId":"unique-attempt-id","source":"projects","reservedUsd":0.2,"maxTokens":8000}
```

The adapter checks `lastAction.reserved` before dispatch. Repeating the same reservation is idempotent; reusing an identifier for different limits is rejected. A settled identifier cannot authorize another call.

```json
{"action":"settle_external","attemptId":"unique-attempt-id","inputTokens":1200,"outputTokens":600,"costUsd":0.03,"costStatus":"observed"}
```

Settlements are immutable and idempotent when identical. An interrupted call with unavailable usage settles as `estimated` using the conservative reservation. The ledger is bounded at 10,000 external attempts; reaching capacity blocks further requests without deleting history.

## Scoped chat, goals and office blueprint

Conversation and goal scopes use `{ "kind": "company|office|department|employee", "id": "existing-id" }`. There is one persisted conversation per scope. A Donna-scoped goal binds to the selected company at creation and keeps that company reference after navigation. `post_chat` creates a user message only. `plan_goal` uses a clearly identified local assignment template and says that no model request has occurred. Actual settled goal results append the provider summary and artifact reference; cache/error notices are attributed locally. Conversation capacity never causes a successful accounting settlement to be rolled back.

Goals have separate `plan` / `execute` modes. `create_goal` records the brief, scope, run settings and 1–10 iteration limit. `plan_goal` assigns a small dependency chain to available scoped employees; `set_goal_plan` accepts up to 12 custom steps and validates missing dependencies, cycles and ownership. Plan-only goals cannot dispatch. An unstarted plan can change its mode/run settings through `set_goal_plan`; started plans and their prior jobs remain immutable.

`execute_goal` explicitly starts the first iteration. Each iteration creates a fixed DAG with per-request token/USD limits, allowed-tool declarations and a five-minute worker lease. The provider adapter uses a separate 4.5-minute transport timeout. `runSettings.maxMinutes` is a **soft goal target checked between iterations**, not a timer that kills a reserved goal request.

Every terminal goal job retains its artifact, summary and usage and creates an idempotent checkpoint. In autonomous mode, `tick_goals` can advance a completed provider iteration, linking the prior terminal handoffs into the next graph. It stops at the iteration limit, the soft time target, paused dispatch or a full global budget. Failed/expired/cancelled work requires review and is never replayed automatically. In review mode, another iteration requires `advance_goal` with an explicit reason. `pause_goal` holds future steps while allowing already reserved work to finish. All evidence remains available after pause or budget exhaustion.

Each office has one persisted blueprint containing normalized room bounds, employee desk positions and whiteboards. Whiteboards link real goals/jobs and name an employee owner; their visible progress comes from those records. Coordinates, IDs, department references and same-company ownership are validated. Layout mutations do not claim that an employee process is active. Additive serde defaults migrate existing schema-version-1 state without resetting prior work.

## CEO portfolio and shared services

The additive `snapshot.portfolio` contains CEO view configuration, explicit company groups, shared services and their contracts, named knowledge permissions, owned roadmap items and optimization recommendations. `configure_ceo` changes the portfolio view and focus; it does not change provider authorization, worker capabilities or budgets. A group is a collection of original companies. Grouping never renames, deletes or merges repository identities and never copies their private knowledge.

| Action | Required input and behavior |
| --- | --- |
| `upsert_portfolio_group` | `name`, `companyIds`; optional `id`, `description`, `status`. Paused groups block future member-company dispatch. |
| `ensure_shared_services` | `preset: "standard"`; optional `assignments` mapping service keys to existing specialist IDs. Creates or reuses one Shared Services company and office. No model request occurs. |
| `optimize_portfolio` | The same preset/assignments; optional explicit `groups` and `pauseRedundant`. Uses saved groups when none are supplied and creates scoped contracts for their members. |
| `contract_service` | `serviceId`, `recipientCompanyId`; optional recipient office/department, employee IDs, allowed tools, ID and `active` / `paused` / `revoked` status. |
| `share_knowledge` | `knowledgeId`, `recipientCompanyId`, `purpose`, and `requested` / `granted` / `revoked` status. A grant additionally requires `reviewed: true`. |
| `upsert_roadmap_item` | Scope, title and employee owner, plus optional department, service contract, dependencies and linked goal/job IDs. `done` requires evidence and completed prerequisites. |

The six standard service keys are `engineering`, `design-architecture`, `research-knowledge`, `security`, `hackathon` and `music-arts`. Explicit assignments reuse existing specialist records. Otherwise a matching assignment key is reused before a new specialist is created. Shared service membership references the **same employee ID**, preserving the employee's original company/office/department. A shared service blueprint can display these IDs without moving their original records.

Recipient jobs declare `serviceContractId`. The contract must be active, include that employee, match the recipient company and any restricted office/department, and permit every requested tool. Claim and pre-dispatch reservation recheck the contract, service hierarchy, employee's home hierarchy and portfolio group pauses. A contract does not grant source-company knowledge. Pausing/revoking a contract blocks new requests while an existing attempt remains able to settle its recorded cost and artifact. Re-running optimization never reactivates a paused or revoked contract. Changing a service's employee assignments pauses its active contracts until they are explicitly reviewed; prior assignment references remain available for historical layout ownership.

Schedules and goal steps retain `serviceContractId` and explicitly selected `knowledgeTransferIds`. Local goal planning prefers an active scoped service contract for implementation, security review and knowledge work before creating assignments for duplicate local specialties. A named knowledge transfer stores a reference to one existing knowledge record. Its content is neither copied nor automatically added to all jobs. The main worker may use only currently granted transfer IDs explicitly selected on the recipient job. A revoked transfer blocks new dispatch that still requests it.

Optimization reports actual counts for reused/created employees, services, contracts, grouped companies and recommendations. It does not infer company relationships. By default it pauses no one. With `pauseRedundant: true`, it may pause a duplicate specialty only when an active replacement contract exists and the employee owns no job history, goal steps, roadmap items or whiteboards. Employees with recorded work remain intact and receive a recommendation. No employees, companies, jobs, artifacts or usage records are deleted.

Portfolio roadmap scopes are `{kind:"company",id:companyId}`, `{kind:"group",id:groupId}` or `{kind:"global",id:"portfolio"}`. Dependencies must form a DAG. Donna may own global coordination records; assigning an owner does not authorize that employee to execute across company boundaries. Cross-company ownership of a company roadmap requires a service contract. Whiteboards can link these records through `roadmapItemIds`. New borrowed-worker layout assignments require a current scoped contract; existing historical references survive a later pause or revocation.

The main adapter's `schedule_repository_reviews` action prepares repository-review schedules. The Rust scheduler honors `enabled: false` on creation, so prepared schedules remain paused until explicitly enabled. Public release progress and installation-specific registration are separate: an unchecked fresh installation resets only its automated `github-register` task to `todo`; an existing verified installation keeps its persisted evidence.

## Persistence, cache and inventory boundaries

- Cross-process OS locking fails immediately with `STATE_BUSY` when another writer owns state. Locks release on process exit. Writes use a private temporary file, sync and atomic rename. Corrupt state is preserved and reported, never silently reset. Unchanged snapshots do not rewrite state.
- Cache entries store bounded references and an optional artifact SHA-256. The worker verifies exact context and artifact integrity before reuse. Clearing the cache removes references, not original evidence files. Hit/miss counters describe actual cache lookups.
- Knowledge records store concise deliverables, evidence summaries and artifact references. Hidden chain-of-thought is neither requested nor stored.
- The native inventory reads file metadata only, uses at most eight workers, excludes symlinks, generated dependency/build directories and local environment files, and stops at 10,000 files, 50,000 directory entries, depth 32 or five seconds. A partial inventory is explicitly marked `truncated`. It is not a malware scan or proof that a repository is safe to run.
- The Electron renderer cannot submit worker claims, reservations, settlements or fabricated import batches. The main-process adapter allows only fixed native commands and does not pass provider credentials into the Rust process.

Native-core tests cover persistence, locking, invalid state, traversal/symlinks, bounded indexing, registration evidence, hierarchy isolation, idempotent enqueue/claim, shared reservations, cancellation accounting, expired leases, dependency failure, schedules, cache metadata, goal DAGs/iterations/checkpoints, conversation provenance, blueprint ownership, private import provenance and additive migration. Desktop tests exercise the compiled process contract as well as provider-adapter and renderer boundaries. Native credential-file import uses a main-process file picker, a bounded regular-file read and OS-backed vault storage; no key content or selected path is returned to the renderer.
