# Office heatmap data contract

Owner: platform engineering. Consumers: the shared desktop, public-preview and hosted office renderer. Introduced for the reference-inspired blueprint redesign after Daftar 0.5.0.

## Implemented architecture

[`office-signals.ts`](../desktop-shell/src/renderer/office-signals.ts) is one dependency-free classic script. The built artifact attaches `DaftarSignals` to `globalThis`/the browser window. It accepts an existing saved office snapshot and returns derived records. It performs no network calls, provider dispatch, database write, authorization decision or mutation of the input. The desktop and website can therefore use the same calculation without creating a second source of state.

```ts
const signals = window.DaftarSignals.build(snapshot, {
  companyId,             // optional; absent means all companies
  officeId,              // optional; must belong to companyId
  departmentId,          // optional; must belong to the selected office/company
  employeeId,            // optional; never widens the selected location scope
  now: new Date().toISOString(),
  sampledAt,             // optional: actual bridge response receipt time
  staleAfterMs: 300_000, // optional default; does not start a refresh timer
});
```

The return value contains `summary`, `perEmployee`, `perDepartment`, `perRoom`, `globalBudget`, `scope`, `scopeValid`, `sample`, `legend` and `diagnostics`. Entity collections are records keyed by saved entity IDs, not arrays. Every group has `id`, `name`, unique `jobs`/`employees` counts, and three metrics: `workload`, `budget`, `attention`.

Each metric provides:

| Field | Meaning |
| --- | --- |
| `level` | `0`, `1`, `2`, `3`, `4`, or `unknown`; consumers map these semantic values to theme tokens |
| `value`, `numerator` | Recorded count or monetary numerator; a known subtotal may remain when the full metric is unknown |
| `denominator` | A real monetary allowance, or `null` for count metrics; no capacity denominator is invented |
| `ratio` | Actual monetary fraction when the positive denominator is known; otherwise `null` |
| `unknown` | Whether the full comparison is unavailable; zero remains distinct |
| `label`, `detail` | A short visible label and the calculation/limitations for an inspector, accessible description or tooltip |

Heat colors must have the visible value and metric name beside them. Unknown values use a distinct pattern/border as well as a label. A color is an intensity band for the selected metric, not a general success, health or security verdict.

## Fixed bands and accounting

| Metric | Level 0 | Level 1 | Level 2 | Level 3 | Level 4 |
| --- | --- | --- | --- | --- | --- |
| Workload: unresolved saved jobs | 0 | 1–2 | 3–5 | 6–9 | 10+ |
| Budget: recorded commitment / summed job allowances | 0% | Above 0%, below 50% | 50%, below 80% | 80%, below 100% | 100%+, or a job with spend and an explicit zero allowance |
| Attention: distinct flagged jobs | 0 | 1 | 2–3 | 4–5 | 6+ |

These thresholds are documented product choices. They are constant across views, not per-screen percentiles and not measurements of employee capacity. Workload includes `queued`, `waiting-budget`, `running` and `paused` records. A saved running record is not proof of a currently executing process. No job records produce `unknown`; completed records with no unresolved work can produce an observed zero.

Attention includes `needs-review`, `failed`, `budget-exhausted`, `waiting-budget`, an expired running lease, or an unresolved job depending on a terminal failed/cancelled/exhausted/review job. Multiple conditions on one job count once. The detail lists overlapping reason counts. Missing dependency records, unsupported statuses or an absent running-lease timestamp make the affected comparison unknown. **`dueAt` is an earliest dispatch time in the native model, not an overdue deadline**, so it does not create an alert.

The accounting follows [`OfficeJob`](../desktop-shell/src/shared/office.ts), [`reserve_job`/settlement](../native-core/src/office.rs) and the native [`summarize_budget`](../native-core/src/governance.rs) behavior:

- Use `usage.costUsd` once when `costStatus` is `observed`, `reserved` or `estimated`.
- An admitted reservation already appears in `usage`. Adding `reservation.costUsd` would double-count it.
- A `pendingReservation` is work waiting for admission, not committed spending. It is excluded from monetary totals and remains visible through job status.
- Observed, reserved and estimated amounts are listed separately in metric details. Estimated amounts do not become observed spending.
- The scoped denominator is the sum of recorded **individual job allowances**, including historical jobs in the chosen saved scope. It is not a company spending allocation, account balance or automatically enforceable shared budget.
- Missing/invalid monetary fields make the comparison unknown. A zero allowance without spending has no percentage. Spending against a known zero allowance is explicitly flagged without creating an infinite ratio. A positive allowance on another job cannot conceal that condition.
- `globalBudget` is a separate projection of the native `budget.committedUsd` and `policy.budget.hardCapUsd`. It includes the native external-allocation accounting. It is never distributed to people or rooms by guesswork.

Percentage labels round down to keep their visible band consistent; a positive fraction below 1% is shown as `<1%`. The raw fraction remains available. These display calculations do not settle costs or replace the native admission ledger.

## Scope and ownership

Jobs follow their saved execution `companyId`, `officeId`, `departmentId` and `employeeId`. A specialist contracted from another company contributes only the jobs recorded in the selected execution scope. Active inherited service contracts can add that specialist to the scope roster without creating jobs or changing authority. Saved employees and distinct job IDs count once; multiple contracts do not multiply them.

Department job totals use the job's execution department. Room totals use a saved desk placement for the job's employee in its execution office. An unplaced job remains in scope/employee/department totals, and `diagnostics.unplacedJobs` records the absence of room attribution. Multiple desk placements select the lexicographically first room ID per employee/office and report the ambiguity. If the same room ID is reused across offices, its room metric becomes unknown until one office is selected.

Company, office and department filters must agree. An invalid or missing selected scope returns empty entity collections and unknown metrics; it never falls back to a larger scope. These checks organize the display. Actual permissions remain enforced by the native and server authorization paths.

## Freshness, scale and persistence

Snapshot age uses only the caller's actual receipt time. The latest job's `updatedAt` is not a freshness measure: an old completed job can be accurately returned by a fresh request. If the receipt age exceeds the supplied window, historical numbers remain available but metric levels become `unknown`. If no receipt time exists, `sample.status` is `unknown` and the view describes saved records; it makes no live-telemetry claim. A future receipt timestamp also has unknown age.

The projection uses indexed maps and sets, then bounded passes over records and links: O(records + relationship links). At most 60,000 top-level records and 200,000 contract/blueprint/dependency links are accepted. Exceeding those bounds returns an explicit unknown result, not a silently truncated heatmap. UI code should calculate once per snapshot/scope and reuse the result for nodes. A visible refresh can recalculate time-sensitive lease status; this module adds no polling or unattended process.

No database migration is needed for these read-only projections. Saved jobs, native budget summaries, contracts and room placements remain authoritative. Theme and selected heatmap are presentation preferences; they must not be interpreted as employee rights or changed budgets. If durable cross-device presentation preferences are later required, add a separately versioned preference object with existing revision checks. Do not persist every derived heat color or duplicate provider usage into a new table.

## Verification

[`office-signals.test.ts`](../desktop-shell/tests/office-signals.test.ts) executes the actual classic script in a DOM-free VM. It covers cross-company shared staff, inherited contracts, scope rejection, reservation accounting, global/scoped separation, zero and missing denominators, all native job statuses, expired/missing leases, dependency uncertainty, stale samples, duplicate IDs/placements, missing room ownership, immutable input, fixed bands and bound refusal. A 5,000-job/100-employee fixture verifies exact aggregate and per-owner totals. That scale fixture is a functional check, not a hardware performance benchmark or a stress test of provider dispatch.

The UI still requires its own keyboard, contrast, narrow-layout and screenshot checks. A passing data projection does not establish those interaction outcomes.
