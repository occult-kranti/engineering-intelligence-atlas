# Knowledge transfer

Source of truth: `buildStudyQueue`, `STUDY_QUEUE_CAP`, `buildKnowledgeTransfer`, and the `knowledge.transfer` policy in the shared contract. Offline fixture: `fixtures/study_queue.fixture.json`.

## Study queues (from resources, never paid)

- `study.enqueue` (low risk, approval-free) enqueues **draft** study items built deterministically from available skill resources: `buildStudyQueue(skillId, resources, goal, evaluation, cap)`.
- Rules: first occurrence wins on duplicate refs; ids are content-derived (`skillId:sha256(ref)[:12]`); the queue is capped at **32** items; every item carries `providerCalls: false` — a study plan is a reading list, never an automatic paid provider call.
- Item shape: `{id, skillId, resourceRef, topic, goal, evaluation, status, providerCalls}`; statuses `draft → queued → in-progress → completed | dropped`.
- Studying a resource means reading the referenced material and producing refs-backed notes; it never means executing code from the resource.

## Handoff records (refs only)

`knowledge.transfer` (medium risk, `plan-approval`) hands off knowledge **by artifact reference**:

```
{contractVersion, id, refs: [ArtifactRef, ...1..16], handoff: {from, to, summary}, contentSha256}
```

- `refs` are artifact pointers (`artifactId, runId, nodeKey, attempt, kind, title, summary, contentSha256`) — never inline content.
- `handoff.summary` is a bounded (≤2000 chars) **extractive** summary — outcome-level, never raw content or reasoning.
- `contentSha256` binds the record: `sha256(canonicalJson({refs, handoff}))`. Any change to refs or summary is a new record, not an edit.
- Empty refs are rejected: a transfer with no artifacts is not a handoff.
- Human-readable HANDOFFS docs complement the record with context and pointers; they follow the same refs-only, no-raw-CoT rule (see [cache_memory_handoffs.md](cache_memory_handoffs.md)).

## Preservation

- Fire/archive drain-and-preserve (see [queues_hiring_schedules.md](queues_hiring_schedules.md)) extends to knowledge: artifacts, ledger entries, study queues, and handoff manifests survive worker release and department/company archive. Preservation is enforced by the validator (`drain-preserve-required`) before any fire/archive executes.
- Knowledge moves between scopes (department → company → enterprise) only as approved `knowledge.transfer` proposals from an assistant whose scope covers the source; content integrity is verifiable end-to-end via `contentSha256` on both the artifacts and the record.
