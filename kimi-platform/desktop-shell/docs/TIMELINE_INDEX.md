# Timeline index (v0.5 CEO mode)

The timeline index is a **derived, recomputable index** over the append-only
work ledger — the same "derive, don't recompute per poll" pattern the
caching/DAG research note recommends for event-sourced runners
(`../caching_dag_optimization_research.md`: keep the event log authoritative
and derive pure-function views with keyset pagination). The ledger stays the
only write path; the index is rebuilt deterministically on read and paged by
position, so it can never drift.

## Schemas (record: `src/shared/enterprise.ts`)

`WorkLedgerEntry` (stored, `ledger.jsonl`, one JSON object per line):

```jsonc
{
  "seq": 7,                       // gap-free per enterprise
  "ts": 1763731200000,            // epoch ms
  "enterpriseId": "ctg-001",
  "companyKey": "software",
  "projectId": "proj-…",
  "officeId": null,
  "roomId": "research",
  "workerId": "node-5",
  "nodeKey": "software--svc-backend-engineering",  // contract/dept seat, if any
  "runId": "run-…",
  "attempt": 1,
  "kind": "returned",             // assignment|prompt_started|returned|artifact|approval|waiting|error
  "status": "succeeded",
  "intendedAsk": "…bounded, ≤1000 chars (never the raw prompt)…",
  "promptSha256": "<64-hex of the exact prompt; the text is never stored>",
  "returnedSummary": "…bounded EXTRACTIVE span ≤2000 chars…",
  "artifactRef": { "artifactId": "art-…", "contentSha256": "…", … },
  "usage": { "inputTokens": 10, "outputTokens": 20, "costUsdMicros": 50 },
  "skillRef": "architecture-database-backend-engineering"
}
```

`TimelineIndexEntry` (derived, never stored as truth):

```jsonc
{ "seq": 3, "ts": 1763731200000, "kind": "returned",
  "enterpriseId": "ctg-001", "companyKey": "software", "workerId": "node-5",
  "nodeKey": "…", "runId": "run-…",
  "ledgerSeq": 7,                  // back-pointer into the ledger
  "artifactRef": { … } }
```

## Derivation & paging

`deriveTimelineIndex(ledger)` sorts by `(ts, seq)`, re-indexes `1..n`, and
rejects duplicate ledger seqs (an index must never silently collapse two
events). Reads use keyset pagination:

- IPC `entLedger { enterpriseId, companyKey?, workerId?, departmentKey? }`
  returns the filtered ledger (worker/company/department filters applied
  after schema validation).
- IPC `entTimeline { enterpriseId, afterIndex, limit }` returns
  `{ entries, nextIndex }`; pass `nextIndex` back for an incremental
  "load more" (the renderer's timeline panel uses exactly this).

## Sample paths

```
userData/enterprises/<enterprise-id>/ledger.jsonl            # append-only truth
userData/enterprises/<enterprise-id>/exports/timeline-index.json
userData/enterprises/<enterprise-id>/exports/ledger.json
userData/enterprises/<enterprise-id>/exports/ledger.md
userData/enterprises/<enterprise-id>/events.jsonl            # enterprise events (seq-paged via entEvents)
```

Every row is derivable with **zero provider calls** (enforced by the test
"runs every derivation with ZERO provider calls").
