# Queues, hiring, and schedules

Policy source: `ASSISTANT_ACTION_POLICIES`, `ASSISTANT_JOB_POLICIES`, `ASSISTANT_SCHEDULE_BOUNDS` in the shared contract. Offline checks: `scripts/validate_action_plan.py`, `scripts/schedule_check.py`, fixtures `fixtures/action_plans.fixture.json` and `fixtures/schedules.fixture.json`.

## Queues

- `queue.add` / `queue.reorder` are low-risk and approval-free: enqueue or reorder a work item on an **existing** queue. Assistants never create queues implicitly.
- A work queue is scoped (`id, scope, scopeKey, version`); its `version` is the optimistic-concurrency token carried as `expectedVersion` on queue proposals. Items are `{id, queueId, itemKind (company-run | study | repository-triage | custom), refId, title, position, status (queued → dispatched → done | dropped), payloadHash, version}` — references and hashes, never inline payloads.
- `queue.reorder` is deterministic (`reorderQueueItems`): the named ids come first in the given order, remaining items keep their current relative order (position asc, tie-break by id), and positions are re-assigned densely 1..n. Unknown ids, duplicate ids, and mixed-queue inputs are contract errors; item versions are untouched.
- Queue discipline: at-least-once delivery + idempotent executors = exactly-once effects; failed jobs retry with backoff to a dead-letter queue with a termination notice; every run writes an event-log entry with tokens and cost.

## Company and department lifecycles

Companies and departments share the lifecycle `active → paused → archived`. Pause/resume/archive proposals transition these states; archive always goes through drain-and-preserve first, and `archived` preserves all artifacts, ledgers, and handoffs.

## Hiring and workforce lifecycle

- `worker.hire` (medium risk, `plan-approval` gate): hire only under an approved plan — it is new spend.
- `worker.pause` / `worker.resume` (low risk, no approval): pause stops new claims; it does not cancel in-flight work.
- `worker.fire` (high risk, `high-risk` + `plan-approval` gates, **drain-and-preserve**): the proposal payload must carry `{drain: true, preserveArtifacts: true}`. In-flight work drains to completion or handoff **before** release; artifacts, ledger entries, and handoff manifests are preserved — firing never deletes history.

## Company and department controls

- `department.pause` / `department.resume`, `company.pause` / `company.resume` (medium risk, `plan-approval`): pause blocks new claims/runs; resume restores them.
- `department.archive` / `company.archive` (high risk, `high-risk` + `plan-approval`, structural, **drain-and-preserve**): archiving is an explicit structural proposal; it drains in-flight work and preserves all artifacts. Structural actions are never automatic and never bundled with other changes.

## Schedules (bounded one-time and interval jobs)

Job kinds: `ledger_refresh`, `cache_refresh`, `program_pump_mock`, `repository_sync`, `study_plan` — all deterministic, provider-free, paid-free, non-executing, and run at a zero budget reservation.

Bounds (enforced by `scheduleNextRun`, mirrored in `scripts/schedule_check.py`):

- Interval clamped to **[60 000 ms, 30 days]**.
- **No missed-run storms:** when `now` is past the anchor, every missed interval is skipped forward in one deterministic step; at most one run is ever due (`maxCatchUpRuns = 1`).
- `maxRuns` is a hard terminator; one-time jobs fire at most once (a pending one-time job still fires even when late); disabled jobs never run.
- `schedule.upsert` and `schedule.run_now` require `plan-approval`; `schedule.pause` / `schedule.resume` / `schedule.delete` are owner controls (delete is medium risk, approval-free per the declared policy).
- Scheduled/headless runs use a narrower pre-authorized policy — never silently disable approvals.

## No automatic paid calls — ever

- Deterministic jobs make **no provider calls, no paid calls, and never execute proposals**.
- Live/billed provider work exists only as a human-approved `program.pump` proposal carrying the `live-provider-confirmation` gate (plus `plan-approval`). `program_pump_mock` jobs pump already-approved programs in mock mode only.
- Autonomous payments do not exist in the action set at all; a payment request can only be queued for humans.
