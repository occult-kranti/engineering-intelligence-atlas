# Handoff manifests (v0.5 CEO mode)

A **HandoffManifest** is how content moves between workers *by reference*.
It is a deterministic system derivation from the append-only work ledger —
never a provider call, never a provider-written summary. (Schema of record:
`HandoffManifestSchema` in `src/shared/enterprise.ts`.)

## Schema

```jsonc
{
  "from": { "workerId": "node-5", "nodeKey": "software--svc-backend-engineering",
            "companyKey": "software", "departmentKey": null },
  "to":   { "workerId": "node-6", "nodeKey": null,
            "companyKey": "software", "departmentKey": null },
  "summary": "…bounded EXTRACTIVE span copied from the artifact (≤ 2000 chars)…",
  "contentSha256": "<64-hex sha256 of the full artifact text>",
  "truncation": { "truncated": true, "originalLength": 9312, "keptLength": 2000 },
  "provenance": {
    "sourceLedgerSeq": 42,
    "sourceArtifactRef": { "artifactId": "art-…", "runId": "run-…", "nodeKey": "…",
                           "attempt": 1, "kind": "markdown", "title": "…",
                           "summary": "…", "contentSha256": "…" },
    "derivedBy": "system"
  }
}
```

## Derivation

1. When a company run settles, the main process derives ledger rows from the
   run's persisted truth (`run.json` node states + artifact `.meta.json`)
   — see `EnterpriseStore.syncLedgerFromRun`.
2. `EnterpriseStore.deriveHandoffs` walks each company's dependency graph:
   every `returned` ledger entry whose node has dependents yields one
   manifest per dependent edge.
3. The summary is a **span copied from the artifact** (UTF-8 safe cap at
   2000 chars) with explicit truncation metadata. Nothing is paraphrased.

## The prompt no-body rule

Cross-office prompts may include **only** the manifest line produced by
`EnterpriseStore.handoffPromptSection`:

```
- <title> → <worker>: <summary ≤ 280 chars> [sha256 <16 hex>… · truncated kept/original]
```

Full artifact bodies **never** cross offices through prompts. A consumer
that needs the body reads it from the artifact store by reference
(`readArtifact`) inside its own office. The backend test
"builds handoff manifests; prompt sections carry title+summary+sha only,
never bodies" enforces this.

## Export

`EnterpriseStore.exportArtifacts` (IPC `entExport`) writes
`userData/enterprises/<enterprise-id>/exports/HANDOFFS.md` — a Markdown
rendering of the current manifests with hashes and truncation markers —
alongside `timeline-index.json`, `ledger.json`, and `ledger.md`.
