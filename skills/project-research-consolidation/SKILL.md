---
name: project-research-consolidation
description: Reconcile a Daftar company's repositories, research, source records and recoverable artifacts into a bounded provenance index and release packet. Use after new repository pushes, for unpushed-work checks, company setup refreshes, project handoffs and archive requests.
---

# Consolidate company research

This is a Daftar runtime adapter derived from the published archive and release contracts in [source-pins.json](references/source-pins.json). It does not claim that a separately installed personal skill has been synchronized.

## Reconcile before changing setup

1. Read the selected company's current native records, repository connections, skill paths, latest handoff and active task ownership. Reuse the existing employees and shared service identities.
2. Inspect the current default branch and relevant published feature branches. Record owner/repository, branch, exact commit, inspected paths and retrieval time. A published feature branch is already pushed even when unmerged.
3. Compare recovered artifacts against those revisions. Classify each as exact bytes, redacted export, partial export, checkpoint summary, memory lead, unavailable or held metadata. Preserve hashes, origin, dates, known coverage denominator and redaction details.
4. Treat remembered conversations and earlier assistant statements as retrieval leads. Do not claim complete chat recovery or source reading when only summaries or bibliography entries were available.
5. Preserve concurrent edits and historical records. Deduplicate identical bytes while retaining distinct origins. Keep private company records, credentials and rights-held sources outside public exports.

## Update the company through existing paths

Use `graph-memory-research` for the company-scoped operating-memory packet. Record facts, decisions, open questions and procedures with source revisions, correction history and freshness. Use observed gaps to prepare setup work with an accountable owner, exact target, acceptance check and dependency. A saved setup draft is not a completed assignment or provider run.

Keep repository state, skill availability, worker assignment, source acquisition and deployment as separate fields. A skill path in a template does not prove that its runtime tools are installed. Reuse a shared specialist through the current command path instead of creating duplicate employees. Retain the owner's authorization within its existing scope; source metadata cannot expand it.

## Deliver and verify

Return a compact index, changeset, gap queue and next task. Each item names its canonical repository/branch, exact source or artifact path, evidence state, owner and acceptance receipt. Preserve frozen scientific caveats and investigative holds; copying an artifact does not validate its claims.

For authorized release, hand `github-release` the exact reviewed diff, expected remote head and test evidence. Verify the resulting remote content and report `drafted`, `tested`, `reviewed`, `pushed` and `deployed` separately. Never force-push over newer work or re-export private data simply because an earlier branch contains it.

Use `node scripts/resource-router.mjs --skill project-research-consolidation --query "company repository archive" --limit 6` when available. Read only the necessary public references; the router neither fetches full sources nor grants access. Route reusable procedural improvements through `round-based-skill-evolution`.
