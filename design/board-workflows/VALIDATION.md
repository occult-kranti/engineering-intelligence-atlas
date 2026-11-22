# Board workflow validation

Run: `boards-flow-20261122`. Baseline: `9c4f84934762b6f9e2bccac3f9ca9e3986025e00`.

## Acceptance status

Implementation and local tests are complete for the board, pairing, worker, ETA, resource-route and editor changes. Final independent review and sandboxed browser/installed-platform acceptance are in progress. This document will be updated with the tested source commit, CI run and screenshots before final handoff. It is not a claim that all gates have passed.

## What is being verified

- Whiteboard preserves every goal/job/outcome link, retains stale drafts, rejects outdated revisions, and cancels transformed drag gestures without saving.
- Greenboard shows real hierarchical assignments and distinct primary/helper responsibilities. Roadmap links, owners, reviewers, estimates and dependencies remain native records.
- Donna creates a durable brief and paired plan atomically. Retrying an uncertain response preserves its original identity; a changed body cannot reuse it.
- Actual native jobs enforce distinct producer and reviewer phases, fixed total budgets, immutable artifact hashes, current scope and explicit acceptance. A failed review produces a nonaccepting receipt and a bounded repair route.
- Review output and model completion are not proof that code ran. Test providers are synthetic; actual external development authorship is separately accounted.
- VS Code uses the shared renderer/backend. Repeated reads remain bounded, mutation deduplication persists, stale edit contexts stay frozen and cancellation releases request resources.
- MCP exposes bounded canonical IDs and paired metadata while worker acceptance/failure actions remain unavailable through owner tools.
- Upgraded state exports/restores all review and ownership metadata without rewriting authored text or silently changing schema versions.

## Independent review corrections

The first three reproduced native/worker defects and their repaired confirmations are retained under `evidence/`: long briefs disappeared after the recent-chat window, a cancelled helper did not stop the producer, and malformed reviews left downstream goals stuck. The confirmation runs used the real rebuilt native core and worker with synthetic providers and made zero external calls.

Additional counterreview corrections include actual-byte revalidation of accepted producer handoffs, parsing verdicts as strings rather than coercing arrays, review coverage recomputed after UTF-8 context compaction, a cloud hash projection for evidence references, bounded read polling, atomic uncertain-save recovery, all-link roadmap editing and true tilted-drag browser assertions.

## Execution ledger

| Local gate | Observed result |
| --- | --- |
| Rust native core | 118 passed; no failures or skips |
| Desktop/portable backend | 739 passed in 50 test files |
| Shared renderer interactions | 419 passed; DOM fixtures, not visual acceptance |
| ETA planner | 17 passed, included in the desktop count |
| Board geometry | 7 passed, included in the desktop count |
| Headless runtime + both MCP suites | 187 passed, 2 explicitly skipped for unavailable tmux, 0 failures; 189 total |
| VS Code local suite | 132 passed; no failures or skips |
| Python private export/restore | 9 passed |
| Real native/worker repair reproductions | 4 cases in 3 finding groups passed; synthetic providers |

Initial broad-run failures were corrected, not waived: the old panel fixture did not settle the new review jobs; the export parser rejected office schema2; the model-resource adapter still used the old queue contract. A nondeterministic optimizer fixture also revealed that planned reviewers needed protection from duplicate-staff optimization. The final native fix protects planned and roadmap reviewers and still pauses an unrelated idle duplicate. Two optimizer tests passed 20 fresh-UUID repeats; those are two unique tests, not forty new tests.

Model-resource planning now freezes the distinct helper, existing model assignment and resource use grant. The adapter verifies both native phases, preserves the original total token allowance, gates dependencies on accepted reviews, and cancels both phases. A historical uncertain receipt can recover IDs for inspection/cancellation; it cannot replay execution. These are request ensembles, not newly trained MoE weights.

## Boundaries

The stopped Vast instance remains stopped. No user GPU, SSH host, downloaded model, external service installation, trained MoE, live ChatGPT MCP session or physical-GPU soak was activated. The browser gate uses sandboxed Chrome in CI; software WebGL rendering is reported as such. Bounded lifecycle and idle tests cannot prove an indefinite absence of memory leaks.

The previous release `v0.9.0-preview.1` is not replaced by this branch work. Office schema2 is intentionally rejected by old native binaries. Use the matching source-built package and keep a private workspace export before switching versions.

## Claude budget

Actual Sonnet development contribution: request `1de8d1e3-093c-4436-ad4d-d58330d5419b`, 2,168 input and 10,484 output tokens, $0.109176 calculated usage. With the preceding laptop-canvas call, the latest shared $20 allowance accounts for $0.234182, leaving $19.765818. This is usage accounting, not an invoice or account balance. Older uncertain reservations remain unchanged in `project/claude-usage.json`.
