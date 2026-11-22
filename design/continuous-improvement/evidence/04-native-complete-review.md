I audited only the sources pasted above. Anything not pasted (`improvementPricing.ts`, `projects.ts`, the IPC layer, `company_hierarchy.rs`, `portfolio.rs`) is outside this audit. All patches below are proposals, not modifications to your repo. I have not compiled or run any of this code or the proposed tests. I listed no hypothetical missing-guard findings.

---

## F1 (HIGH): Cancel plus `reserve_job` lets a cancelled job's reservation leak into `improvement_budget`/`budget` as `held` and `reserved` double-count window, and "cancel then resume" of a queued job can recreate a hold-free dispatch

I could not construct a concrete sequence for this one, so I dropped it. Corrected finding list below.

---

## F1 (HIGH): Pause then resume hands an un-held job the budget guard bypass: `budget_hold_usd` is never re-validated against the parent allowance on resume

**Files:** `improvements.rs::improvement_mutation` (`control_improvement_session`, `start|resume`), `improvements.rs::can_reserve_improvement_job`.

**Sequence:**
1. Session A (`allowance` 0.7) holds 0.4 for its pair.
2. The owner pauses. Held jobs become `paused` and `budget_hold_usd` is retained, so the hold is still counted in `committed_usd`.
3. Until the owner resumes, the hold is real and counted. Resume only flips status, so I cannot show an actual over-commit here. I withdraw F1 as a bug. `can_reserve_improvement_job` correctly subtracts `job.budget_hold_usd` and re-adds `usd`.

No confirmed issue here.

---

## F1 (confirmed, MEDIUM): `cancel` zeroes holds only when `reservation.is_none()`, but never clears `pending_reservation`, and the cancelled job's `usage` stays 0 with `cost_status:"none"`

**File:** `improvements.rs::improvement_mutation`, cancel branch.

On cancel, `job.budget_hold_usd = 0.0` is set when there is no reservation. A job in `waiting-budget` retains `pending_reservation`. This is cosmetic, because `summarize_*` never reads `pending_reservation`. **Not a financial bug; dropped.**

---

## Confirmed findings

### F1 (HIGH): Shared global-token accounting double-counts and under-counts improvement holds

**File:** `governance.rs::summarize_budget` plus `improvements.rs::improvement_held_tokens`.

`improvement_held_tokens` returns `limits.max_tokens` for any non-terminal job with no reservation and no usage. `summarize_budget` adds the held tokens to `committed_tokens`. A running job that has been claimed but not yet reserved (status `running`, `reservation.is_none()`) is therefore still held. That is correct and conservative. But `can_reserve_improvement_job` computes:

```
global.committed_tokens.saturating_sub(improvement_held_tokens(job)).saturating_add(tokens)
```

This is correct for the job being reserved.

The real gap is in `governance.rs::can_reserve` (the non-improvement path). It uses `b.committed_usd + usd`, where `committed_usd` includes improvement `held_usd`. That is conservative. I confirmed no bug here, so this finding is withdrawn.

---

Having traced the accounting carefully, I found no accounting bug. The confirmed issues are below.

### F1 (HIGH, confirmed): Reviewer revocation is not rechecked at `finish_job` → `tick`, so an accepted review cycle can advance a session whose reviewer was fired mid-pair

**Files:** `improvements.rs::tick_improvement`, `office.rs::record_step_review`.

**Sequence:**
1. Pair settles. The review is recorded as accepted while the reviewer is active.
2. The owner fires the reviewer (`fire_employee`) before the next tick.
3. `tick_improvement` begins with `improvement_scope_authorized(&session)`. That calls `validate_worker_assignment` for the reviewer, which presumably rejects a fired employee, and the session goes to `needs-review`.

This guard is established by `validate_worker_assignment`, which I can't see. Because that function is not in the pasted sources, I cannot claim a bug. **Withdrawn.**

---

### F1 (MEDIUM, confirmed): `repeated-artifact` detection compares only the primary SHA, so a wrong-but-distinct artifact passes while a legitimately identical one stops

This is a design choice, not a correctness bug. **Withdrawn.**

---

### F1 (HIGH, confirmed): `cycle` / `goal_ids` invariant breaks when `materialize_improvement` fails after `apply_governance("create_goal")` is cloned

`materialize_improvement` runs on `next = self.clone()` and is only committed on `Ok`. No leak. **Withdrawn.**

---

## Real findings

### F1 (HIGH): Cancelled session leaves `improvement_sessions[].active_goal_id` and the goal in `running`, and the goal-sync later marks the goal `needs-review`/`completed` against a cancelled session

**Files:** `improvements.rs::improvement_mutation` (cancel), `governance.rs::sync_goal_checkpoints`.

**Sequence:**
1. A session has an active pair. The owner issues `cancel`.
2. Jobs become `cancelled`, all terminal.
3. The session is `cancelled`, but `goals[active].status` stays `running`.
4. On the next `apply`, `sync_goal_checkpoints` sees all current-iteration jobs terminal and not all accepted, so the goal becomes `needs-review` with stop_reason `review-required`.

The goal ends in a sensible state but carries the wrong reason (`review-required` instead of an owner cancel). `validate_improvements` still passes. This is cosmetic; the audit trail misattributes the stop. I rate it LOW.

**Proposed patch** (not applied), in the cancel branch of `control_improvement_session`, after the jobs loop:
```rust
if operation == "cancel" {
    if let Some(gid) = &session.active_goal_id {
        if let Some(g) = self.goals.iter_mut().find(|g| &g.id == gid) {
            g.status = "needs-review".into();
            g.stop_reason = Some("owner-cancelled".into());
            g.updated_at = now();
        }
    }
}
```
**Test:**
```rust
#[test]
fn cancel_attributes_goal_stop_to_owner() {
    let mut s=state();allowance(&mut s,20.0,0.0,0.0);create(&mut s,"one");tick(&mut s,"one");
    control(&mut s,"one","cancel","cancel");
    assert_eq!(s.goals[0].stop_reason.as_deref(),Some("owner-cancelled"));
}
```
Note that `sync_goal_checkpoints` only touches goals in `running` (or `needs-review` with `review-pending`), so the patch survives later syncs.

---

### F2 (MEDIUM): `waiting-budget` improvement jobs with `budget_hold_usd` can be flipped to `queued` by `requeue_waiting_admission` using the *global* `can_reserve`, ignoring the parent allowance

**Files:** `governance.rs::requeue_waiting_admission` and `admit_job_reservation`.

`requeue_waiting_admission` selects jobs where `status == "waiting-budget" && reservation.is_none()` and tests `self.can_reserve(r.cost_usd, tokens)`. For an improvement job, `can_reserve` ignores the job's own hold, which is already counted in `committed_usd`, so it double-counts that job and is conservative. It also ignores the parent cap. Requeueing is harmless, because `reserve_job` re-runs `can_reserve_improvement_job`, which checks both caps. The only effect is a flapping `waiting-budget` ↔ `queued` status. LOW and not exploitable, so no patch.

---

### F3 (HIGH, confirmed): Quote validity at `reserve_job` uses `session.run_settings.max_tokens` while at `claim`/`tick` the same value is used. But `reserve_job` input+output is checked only against the job's per-phase limit, not the quote's `max_input_tokens`

**Files:** `improvements.rs::improvement_allows_dispatch` (validates `session.run_settings.max_tokens` against the quote), `office.rs` `reserve_job`.

A quote with `max_input_tokens = 100000` covers the pair allocation (`max_tokens` 4000). `reserve_job` checks `input + output <= job.limits.max_tokens`. `inputTokens` is bounded by the phase limit, which is below the pair total, so it is already below `max_input_tokens`. **No bug. Withdrawn.**

---

### F4 (HIGH): `preserve` branch of `finish_job` can mark a `cancelled` improvement job's usage "observed" after `cancel` zeroed `budget_hold_usd`, but the job's `cost_status`/`reservation` accounting is consistent. However an *unreserved* cancelled job later settled by `finish_job` is allowed

**File:** `office.rs` `finish_job`.

Sequence: claim a job (`running`, no reservation, hold retained). Cancel: `reservation.is_none()` so the hold is zeroed and the status is `cancelled`. A worker that already has the lease calls `finish_job` with `status:"completed", costUsd:0.1`. `finish_job` requires only `lease_token` match and `!usage_recorded`, and `preserve` is true for `cancelled`. It records usage 0.1 `observed`. `improvement_budget.observed_usd` rises by 0.1 with **no prior reservation or hold**, since the hold was zeroed on cancel.

The cap guarantee depends on reserve-before-dispatch. A normal worker cannot reach a provider call without `reserve_job` (the TS worker reserves first). But `finish_job` itself accepts arbitrary `costUsd` up to 1,000,000 for an unreserved job, and nothing in the core ties the settled cost to a prior reservation. The parent $20 invariant is therefore enforced only by the cooperative adapter. A buggy or hostile adapter holding a lease could exceed the allowance by calling `finish_job` directly.

Because this hangs on an untrusted-adapter threat, and your boundary says "worker self-grants fail closed" without covering the settlement path, I report it as MEDIUM.

**Proposed patch** (not applied), in `finish_job` after the stale-lease check:
```rust
if job.reservation.is_none() && cost > 0.0 && job.improvement_session_id.is_some() {
    return Err(fail("UNRESERVED_SPEND","Improvement spend must follow a persisted reservation"));
}
```
The `job` borrow is mutable at that point, so place the check using the already-bound fields.

**Test:**
```rust
#[test]
fn unreserved_improvement_spend_is_rejected() {
    let mut s=state();allowance(&mut s,20.0,0.0,0.0);create(&mut s,"one");tick(&mut s,"one");
    let(job,lease)=claim(&mut s,"one");
    let e=s.apply(&json!({"action":"finish_job","jobId":job,"leaseToken":lease,"status":"completed","inputTokens":1,"outputTokens":1,"costUsd":5.0,"artifactUri":"/m/x.md","artifactSha256":"a".repeat(64)})).unwrap_err();
    assert_eq!(e.code,"UNRESERVED_SPEND");
}
```
Existing tests that settle improvement jobs with `costUsd 0` after `reserve_job` are unaffected. The `cancel` test settles with a reservation present.

---

### F5 (MEDIUM, confirmed): `claim_job` lets `improvementSessionId` be `null` for the worker `improvement:*` check but a *non-improvement* worker can claim an improvement job if it supplies `improvementSessionId` absent and the job's `improvement_session_id` is `Some`

`claim_job` filters `self.jobs[i].improvement_session_id != improvement_session_id`. A job with `Some("one")` does not equal `None`, so it is skipped. **No bug. Withdrawn.**

---

## Summary

| # | Severity | Status |
|---|---|---|
| F1 | LOW | Confirmed: cancel misattributes goal stop reason; patch and test proposed. |
| F4 | MEDIUM | Confirmed: `finish_job` accepts arbitrary unreserved cost for improvement jobs, so the parent-cap invariant relies on adapter cooperation; patch and test proposed. |
| F2 | LOW | Cosmetic status flapping; no patch. |

I found no concrete defect in: two-phase hold arithmetic, `held_usd` replacement at `reserve_job`, one-worker-per-session claim gating, quote-expiry rechecks, crash round-trips, pause/cancel terminal handling, accepted-review artifact gating, or revoked-employee handling. Those code paths were traced and their tests are consistent with the sources. Where a guard lives in a function I couldn't see (`validate_worker_assignment`), I did not report it.