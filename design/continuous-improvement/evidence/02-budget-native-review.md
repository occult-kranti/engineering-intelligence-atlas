I could not complete this audit. Producing it would require a full cross-file pass over the contract and about 4,000 lines of Rust and TypeScript, and a rushed version would give you unreliable line anchors and untested snippets. I won't invent them. Below is what I can state from the sources you gave me. I have not run any code. These are my own anchors and the diagnosis may be incomplete.

# 1. Prioritized findings (incumbent vs. frozen contract)

**P0: `improvements.rs` is not in the sources, but `office.rs` depends on it.**
`office.rs` does `#[path = "improvements.rs"] mod improvements; pub use improvements::*;` and calls these methods:
- `validate_improvements`
- `apply_improvements`
- `guard_improvement_owned_work`
- `improvement_allows_dispatch`
- `validate_improvement_claim`
- `can_reserve_improvement_job`
- `improvement_held_tokens`

It also references `ImprovementRoute`, `ImprovementAllowance`, `ImprovementSession`, `ImprovementReceipt` and `StickyNote`. I cannot audit the central reservation logic, the allowance singleton, receipts or the route checks without that file.

Some of the contract already exists as scaffolding: `Job.improvement_session_id`, `improvement_route` and `budget_hold_usd`; `Goal.improvement_session_id`; `OfficeSnapshot.sticky_notes`, `improvement_allowance`, `improvement_sessions` and `improvement_receipts`; `BudgetSummary.held_usd`; and `claim_job` filtering by `improvementSessionId`. The contract says not to assume the incumbent satisfies the new fields, so each of these needs a check against it.

**P0: The version fence is not in place.**
- `validate()` accepts schema `[1,2,3]`. `seeded()` writes `3`. `apply()` forces `self.schema_version = 3`.
- The contract says office-2 binaries must reject office-3 state. That depends on the old binary's accepted set, which is outside these sources.
- The TypeScript `assertPairedAttempt` in `pairedReview.ts` requires `snapshot.schemaVersion !== 2` to throw. It will reject every schema-3 snapshot, so every provider job fails with `PAIR_REQUIRED`. This is a concrete contradiction. The fix is to accept `schemaVersion >= 2` there, or to compare against a shared constant.
- Migration should add no sessions, grants or spending. The serde `#[serde(default)]` fields already behave that way. Validation must still prove that a legacy load yields empty sessions and a null allowance.

**P0: Reservation race and double counting between the global and session budgets.**
- `summarize_budget` adds `held_usd` (the sum of `budget_hold_usd`) to `committed_usd`. It does not subtract anything when a hold converts to a reservation.
- In the `reserve_job` handler, `budget_hold_usd` is zeroed only after `admit_job_reservation` succeeds and the reservation is stored. The reservation sets `usage.cost_usd = cost` with status `reserved`.
- `can_reserve_improvement_job` runs while the job's own hold is still counted. If it compares the new cost against remaining headroom without excluding that job's hold, it double counts and wrongly denies the last dollars. If it excludes the hold incorrectly, concurrent sessions can overcommit.
- Rust handlers run under a single `&mut self`, so the in-process race is not real. The persistence-layer race is: `apply` must run as an atomic load/modify/save under a lock or CAS. That layer is not in these sources.

**P1: Hold and reservation cost basis versus the contract.**
- The contract says a reservation replaces only that job's hold, and the reviewer hold remains. The incumbent only zeroes the job's own hold, which is right. The tick must create both holds in one transaction.
- The worker computes `reservedUsd` from `inputBound` (UTF-8 bytes plus 1024) and `outputBound`. The contract requires pair `maxUsd` to be bounded by the quote's conservative full-token upper bound (`maxInputTokens`, including the 100000-token price-tier threshold). Nothing in `officeWorker.ts` reads `improvementRoute` or `maxInputTokens`.
- `inputBound` is a byte count used as a token count. That is conservative for English text but is not tied to the quote's `maxInputTokens`.

**P1: Pair split rounding.**
`enqueue_pair` splits `maxTokens` as `(total*3)/5` with a floor of 1 and a clamp. USD splits as `0.6 * total` for the primary and the remainder for the review. For the hold-sum invariant (primary hold plus review hold ≤ pair `maxUsd`), the split must be computed once and stored, not recomputed from floats at reserve time.

**P1: Claim scoping.**
- `claim_job` filters on `improvement_session_id == requested`. A default claim has `None`, so session jobs are excluded. That matches the contract.
- `validate_improvement_claim` is not visible. It must enforce worker ID `improvement:<sessionId>`, since the worker uses that exact format. It must also deny a session ID passed with a default worker ID, and deny a default worker claiming with a session ID.
- `eligible()` calls `improvement_allows_dispatch`, which is good. It is also called in `reserve_job` only when `existing.reservation.is_none()`. A replay of a stale lease with a reservation skips the check, which is probably intended, but the authority check for dispatch is separate (`check_worker_authority`).

**P1: Session-owned goal protection.**
`guard_improvement_owned_work` runs at the top of `apply_inner`. I cannot confirm it blocks `advance_goal`, `execute_goal`, `set_goal_plan` and `tick_goals`. In the visible code, `tick_goals` explicitly skips goals with `improvement_session_id`. The others rely on the guard.

**P1: Worker identity and activity.**
- `OfficeWorker` takes `improvementSessionId` and uses `improvement:${id}`, and `OfficeWorkerPool` does not. The pool constructs workers from shared options, so a session pool would share one session ID across concurrent workers. That is fine for one session, but the contract says one active paired cycle per session.
- The worker's `execution.activeCalls` is set only around `generate`, which matches the contract. `phase === 'generating'` is separate.
- `poll()` skips `tick_schedules` and `tick_goals` for session workers, and the improvement tick is not invoked by the worker. Something must call `tick_improvements`; it is not in these sources.

**P1: Receipt storage.**
Owner mutations need `requestId`. The existing `remote_receipts` bound is 10,000 and refuses admission when full, without eviction. That matches "no silent receipt eviction." The improvement receipts are a separate vector, `improvement_receipts`, and their bound is not visible.

**P2: Cost-status taxonomy.**
- `summarize_budget` treats `reserved`, `observed` and `estimated` as committed. The contract adds "uncertain cost blocks automatic new cycles pending reconciliation."
- In the incumbent, `expire_leases` converts a stale reserved cost to `estimated` and sets `needs-review`. For the scheduler, a job with `cost_status == "estimated"` and `started_at.is_some()` is the uncertain-billing marker. The tick must refuse to start a new cycle while any such job exists for the parent allowance.

**P2: Replay vulnerabilities.**
- `enqueue_pair` is idempotent on `(company_id, idempotency_key)` with a request digest. Session jobs are created only by the tick. The tick's idempotency key must be derived from `(sessionId, cycle)` so that a replayed tick after a crash returns the existing goal.
- `record_step_review` is idempotent on identical records and conflicts on different ones. Good.
- In `claim_job`, a second worker cannot claim a running job because only `queued` jobs are eligible. Lease tokens are random UUIDs.

**P2: Misc.**
- `record_review_failure` and `record_step_review` are excluded from the audit-ledger action list. `tick_improvements` is already in that exclusion list, so internal ticks do not write owner audit entries. Good.
- `permitted()` in `remote_commands.rs` already allows `upsert_sticky_note`, `archive_sticky_note`, `register_improvement_allowance`, `create_improvement_session` and `control_improvement_session`. It correctly omits `tick_improvements`.
- `command_authority_requirement` in `authority.rs` handles the sticky-note actions only. The three improvement actions fall through to the default and return `AUTHORITY_DENIED` for employees. That is acceptable, because they are owner-only, but it should be asserted by a test.

# 2. Candidate fixes (bounded, unverified)

These are suggestions, not tested code.

**2a. `assertPairedAttempt`:**
```ts
// pairedReview.ts
if (snapshot.schemaVersion < 2 || !p || ...)
```

**2b. Hold-to-reservation conversion** (in `reserve_job`, inside the existing handler): compute admission against totals that exclude this job's hold. Sketch:
```rust
// before can_reserve_improvement_job / can_reserve:
let own_hold = existing.budget_hold_usd;
// admit if committed_usd - own_hold + cost <= cap
```
This needs the same treatment inside `improvements.rs`, which I cannot see.

**2c. Parent-ceiling accounting:** the parent total should be the sum over all sessions of `observed + estimated + reserved + held`, plus the carried amounts. It should be computed from jobs filtered by `improvement_session_id`, not stored as a counter, to avoid drift.

**2d. Tick idempotency key:** `format!("improvement:{}:{}", session.id, session.cycle + 1)`.

**2e. Frozen quote use:** reject at create, reserve and dispatch if `now > route.expires_at`; also bound `limits.max_tokens <= route.max_input_tokens` on the pair as a whole.

# 3. Failure-injection matrix (to be turned into tests)

| Case | Injection | Expected |
|---|---|---|
| Legacy load | Schema 1 or 2 JSON without new fields | Empty sessions and null allowance, no spend |
| Last-dollar race | Two sessions, one parent, remaining under 2× hold | Exactly one cycle created, the other waits on budget |
| Tight global cap | Global cap below the parent cap | Global denial reported as the stop reason |
| Uncertain cost | Job started, lease expired, estimated | No new cycle, reason names uncertainty |
| Wrong claim | Default worker claims session job; session worker with the wrong ID | Not claimable, denied |
| Pause with in-flight call | Pause during a running job | Call settles, holds retained, no dispatch |
| Cancel before dispatch | Cancel with holds | Unspent holds released |
| Quote expiry | Expire between create and reserve | Reserve blocked, job unchanged, no model substitution |
| Capacity rollback | Job capacity 4999 | Whole cycle absent, no partial goal, pointers, holds or notes |
| Repeated output | Same artifact digest twice | `needs-review`, reason repeated output |
| Replay | Same `requestId` and body, then changed body | Same receipt, then conflict |
| Restart | Serialize, reload mid-cycle | No repeated call after an uncertain dispatch |

# 4. Integration checklist
- Provide `improvements.rs` for a real review.
- Fix `assertPairedAttempt` for schema 3.
- Define one source of truth for the quote's token and USD bound, in Rust, and mirror it in the worker.
- Add a scheduler component that calls `tick_improvements` per active session, spaced by native state rather than a fixed timer.
- Confirm the persistence layer serializes `apply`.

# 5. Until-budget scheduler (minimal architecture)

A scheduler tick should do the following:
1. Load the snapshot and select sessions with status `active`.
2. For each, reconcile the current pair. Only an accepted exact-artifact review advances the session. Anything else moves it to `needs-review`.
3. Check, in order: parent allowance headroom, global policy headroom, uncertain cost, `maxCycles`, and job/goal capacity. Each failing check maps to its own stop reason and none is reported as "budget spent."
4. Choose a todo note from `taskNoteIds` if one is open. Otherwise, in until-budget mode with an objective, build a rotating study (research, company, UX, graphics, setup) that depends on the previous accepted review.
5. Create the cycle in one cloned transaction (goal, step, both jobs, both holds, session pointers, note link), or discard it on any failure.

The scheduler never creates dummy requests and never retries. When it has no objective and no work, it waits, so cost and activity come only from real accepted artifacts.

I can redo this as a full audit if you send `improvements.rs` and the persistence layer that wraps `apply`.