# First demo: invoice and payment reconciliation

**Status: proposed work item; implementation and acceptance tests not executed.**
Prepared 21 November 2026. Company catalog key: `fintech-hackathon`; brief key:
`synthetic-reconciliation-demo`. The [fixture](first-demo-fixture.json) contains
invented records only. This brief creates no financial connection, posting,
scheduled job, external submission or money movement.

## Outcome and catalog mapping

Help a financial-operations reviewer see which synthetic invoices are settled,
partly paid, refunded or missing a matching payment, and resolve one unmatched
receipt with an auditable local correction. The hypothesis is that a small
exception queue is easier to review than a raw event list; user validation is
still unknown.

| Canonical [catalog](../index.json) milestone | Contribution of this brief |
| --- | --- |
| `charter` | Candidate problem, accountable owner and success checks for director acceptance |
| `discovery` | One reviewer journey and deterministic data; interviews and comparison evidence remain outstanding |
| `architecture` | Proposed event/allocation contract, invariants and failure cases for engineering review |
| `prototype` | Future runnable work and test requirements; no implementation completion claimed |
| `growth` | A later audience/demo brief may use observed results only after verification |

This is an internal demonstration. Event qualification stays under `radar`, and
event-specific packaging stays under `submission`. The prototype is not eligible
for a competition merely because it exists.

## Small fixture contract

Use integer USD cents throughout; formatting into dollars is a display concern.
Do not accept floats, negative amounts, unknown kinds or missing identifiers.
All first-demo invoices use USD; a mismatched currency goes to an error record
without changing totals. Tax, fees, FX, credit notes, chargebacks, split payments
across invoices and real banking integrations are excluded from this first slice.

| Record | Fields and meaning |
| --- | --- |
| Invoice | `invoiceId`, `customerRef`, `currency`, `billedMinor` — immutable original amount due |
| Posted payment | `eventId`, `transactionId`, `kind: payment_posted`, `invoiceRef`, positive `amountMinor`, `currency`, `occurredAt` |
| Posted refund | Same envelope with `kind: refund_posted`, its own `transactionId`, `parentPaymentId`, and no independent invoice assignment |
| Allocation correction | New local record with payment ID, old/new invoice IDs, reason, actor, timestamp and expected state revision; original events remain unchanged |

The JSON fixture defines events once and supplies `deliveryOrder`, including
repeat delivery and a refund arriving before its parent. A duplicate `eventId`
with an identical normalized payload is ignored financially but recorded as a
duplicate delivery. A new event ID for the same transaction and identical
business payload is also counted once. Conflicting reuse of either identifier
is quarantined and cannot change the earlier accepted record.

An unknown `invoiceRef` produces an accepted **unallocated receipt**, not a
fabricated invoice. A refund awaiting its parent remains unresolved until that
payment is known. Refunds cannot exceed the parent's accepted payment minus its
prior accepted refunds. A refund first reduces that parent's unallocated
remainder, then its allocation to the single invoice; it cannot debit another
payment or invoice. Refund allocation follows any recorded parent correction.

**Demo accounting choice:** the billed invoice amount stays fixed. A refund
reduces net settled payment and therefore reopens the outstanding balance. This
is an explicit simplification; a production system may instead require credit
notes or a different accounting policy.

## Required scenarios and expected results

| Scenario | Expected behavior |
| --- | --- |
| Exact match | `INV-100`: 10,000 billed, 10,000 settled, zero outstanding |
| Partial payment | `INV-200`: 10,000 billed, 4,000 settled, 6,000 outstanding |
| Partial refund | `INV-300`: 8,000 payment and 2,000 refund; 6,000 net settled and 2,000 outstanding |
| Missing payment | `INV-400`: 5,000 billed, no matched payment, 5,000 outstanding |
| Missing invoice | `PAY-404`: 3,000 receipt references absent `INV-404`; keep 3,000 unallocated |
| Duplicate delivery / transaction | Repeated `EV-P100` and separate `EV-P100-RETRY` never add a second 10,000 |
| Out-of-order refund | `EV-R300` arrives before `EV-P300`; it is pending until its parent exists, then yields the same final valid balances |
| Conflicting ID | Same `EV-P100` with 11,000 amount is quarantined; original 10,000 stays intact |
| Excess refund | A further 9,000 refund on `PAY-300` is rejected/quarantined; previous accepted 2,000 refund stays intact |
| Currency mismatch | EUR candidate against this USD-only fixture is rejected without conversion or ledger impact |
| Manual correction | Assign all 3,000 net `PAY-404` to `INV-400` with a reason; outstanding becomes 2,000 and unallocated becomes zero |

Baseline totals after all valid seed deliveries: **33,000 billed; 25,000 gross
receipts; 2,000 refunds; 23,000 net receipts; 20,000 allocated; 3,000 unallocated;
13,000 outstanding**. The manual correction leaves receipts/refunds unchanged,
moves allocated to 23,000 and outstanding to 10,000. These are fixture targets,
not observed application results or business performance.

## Invariants and acceptance

1. Every accepted logical payment/refund is counted once. Replaying the valid
   fixture or restarting from its saved state leaves all totals unchanged.
2. `grossReceipts − refunds = allocatedNet + unallocatedNet`. Per invoice,
   `billedMinor = settledNet + outstandingMinor`, with no negative balance.
3. Refund totals for a payment never exceed that payment. In this first slice,
   allocation to an invoice cannot exceed its outstanding amount; excess stays
   unallocated and visible for review.
4. Valid seed-event permutations converge once missing parents arrive. Invalid
   or conflicting deliveries retain their evidence and do not overwrite valid
   state. This does not promise arbitrary malformed-event order independence.
5. A manual correction is previewed, revision checked and recorded append-only.
   A stale revision returns a conflict; it cannot overwrite a newer correction.
6. Import schema failures identify the bad record. An invalid new import leaves
   the previously accepted dataset intact. Reset is explicitly scoped to demo
   state and cannot delete saved source or evidence artifacts.
7. QA runs the seed, replay, partial/refund, missing-reference, conflict,
   over-refund, currency and stale-correction cases on the exact built revision.
   Record commands, actual results and screenshots; failing checks remain open.

## Minimal UI controls

- Persistent **Synthetic demo · USD · no connected accounts** label and a source
  fixture/version indicator.
- **Load sample**, **Next event**, **Replay all**, **Inject duplicate** and
  **Reset demo** controls; separate the event log from financial totals.
- Invoice table with billed, settled, outstanding and text status; filters for
  unpaid, partial, refunded and exceptions. Do not imply overdue status without
  a modeled due date and evaluation time.
- Exception queue with **Inspect evidence** and **Assign receipt**. The latter
  selects an eligible invoice, previews balance changes, requires a reason and
  applies a local revision-checked correction. It does not trigger a payment.
- **Export demo evidence** returns the synthetic data, event decisions,
  corrections and result snapshot. Label unknown or pending states in text;
  keyboard access and visible focus are acceptance requirements.

These are proposed controls for a future prototype, not controls claimed to be
available in the current Daftar company dashboard.

## Ownership and handoff

| Catalog role / service | Owns |
| --- | --- |
| `director` | Accepts the problem and bounded scope; decides whether to implement |
| `analyst` | Reviews workflow, fixture expectations and user-value assumptions |
| `integrator` + shared `engineering` | Implements ledger/import/correction behavior inside the accepted repository scope |
| Shared `design-architecture` | Designs the minimal reviewer journey and accessible controls |
| `qa` + shared `security` | Independently checks accounting, replay, scope and failure cases |
| `producer` | Coordinates the small graph and preserves checkpoints |
| `knowledge` | Records exact source, artifacts, observed verification and next owner |

No implementation or provider budget is consumed by accepting this document.
Any later job must carry its actual authorized allocation and supported tools.
The handoff should include a reproducible build, fixture hash, observed results,
limitations and a clear next decision; until then, the milestone remains
proposed/unexecuted.
