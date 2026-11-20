# Gates, verdicts, state, and budgets

Orchestration contract for this skill, adapted from patterns studied in OpenCodeGameStudios (OCGS) and aligned with the repository's shared skill collaboration protocol.

## Contents

- Critical caveat: prompt-layer, not code-enforced
- Role contract
- Gate registry and verdicts
- State checkpoints
- Budgets and turn limits
- Pause, wait, and cancel
- Evaluation harness

## Critical caveat: prompt-layer, not code-enforced

Every mechanism in this file — role contracts, gates, verdict tokens, budgets, state checkpoints, pause/wait/cancel — is a **coordination convention executed by the host model**. Nothing here is code-enforced. The studied framework's own controls are the same kind of artifact: its 52-agent hierarchy, parallel-gate protocol, and verdict merging are prose the model must follow, and its authors document that nothing enforces them at runtime. Therefore:

- Treat these rules as contracts to follow and to audit against, not as safety mechanisms.
- Anything that *must* be enforced belongs in tested scripts, CI checks, permission deny-lists, or the hard gates of the shared collaboration protocol — not in a prompt.
- Never report a prompt-layer control as if it were a technical enforcement ("the system will block X" is a false claim; say "this skill instructs the agent to refuse X").
- Adopt the studied pattern's verification culture: record what was actually run and explicitly mark what was not verified.

## Role contract

Each role in a reconstruction effort is a bounded contract, not a persona. Required fields (mirroring the OCGS agent-file structure and the shared delegation contract):

- **Description and mandate** — one paragraph.
- **Key responsibilities** — what the role produces.
- **What this agent must NOT do** — explicit prohibitions (scope expansion, asset handling without HUMAN-2, peer contact outside the DAG, claiming delegation that did not happen).
- **Delegation map** — which roles it may hand artifacts to, and through whom.
- **Budgets** — max turns, token/tool-call/wall-clock limits, effective deadline = min(parent remaining, own limit).
- **Termination owner** — exactly one per node (the director); the run's termination owner is the human owner.

A role that cannot plausibly finish within its effective deadline fails fast with a partial-evidence report rather than overrunning.

## Gate registry and verdicts

Keep one shared registry of named gates; skills and roles reference gates **by ID only** so the gate definitions live in one place and cannot drift. Registry fields per gate: Trigger, Context to pass, Prompt, Verdicts, special handling. This skill's domain registry:

| Gate ID | Trigger | Verdicts | Decided by |
|---|---|---|---|
| HUMAN-1 | New target / scope change | AUTHORIZED / REJECTED | Named human (rights posture) |
| HUMAN-2 | Any asset/ROM handling | AUTHORIZED / REJECTED | Named human (extraction/distribution legality) |
| HUMAN-3 | Public release or binary distribution | RELEASE / HOLD | Named human (incl. naming/trademark review) |
| HUMAN-4 | Fork/republish of another reconstruction project | COMPLIANT / HOLD | Named human (license compliance) |
| GRE-MATCH | Matching/progress claim | MATCHING / PARTIAL / UNVERIFIED | Deterministic check (byte/function match vs. hash-verified original) |
| GRE-BUILD | Build-quality claim | REPRODUCIBLE / MACHINE-BOUND / FAILING | Deterministic check (clean-checkout rebuild) |
| GRE-IDENTITY | Cross-project identity claim | SAME / DISTINCT / UNKNOWN | Evidence check (canonical URL + commit SHA) |

Verdict protocol:

- Emit the verdict token on the **first line** of the gate response — e.g. `GRE-BUILD: PARTIAL` — never buried in prose; the caller parses the first line mechanically.
- Merge parallel verdicts strictest-wins: any REJECTED/FAILING/HOLD ⇒ overall fail; any PARTIAL/CONCERNS ⇒ at most concerns; all pass ⇒ eligible to pass.
- Record verdicts into artifact status headers and the state file — one writer, single source of truth.
- Before finalizing a load-bearing verdict, run a chain-of-verification pass: generate several challenge questions designed to disprove the drafted verdict, answer them independently, revise if needed, and record `Chain-of-Verification: N questions checked — verdict unchanged|revised`.
- Hard gates only block; no approval mechanism may waive HUMAN-1..4.

## State checkpoints

"The file is the memory, not the conversation." Maintain a durable state file (e.g., `session-state/active.md`) recording: current task, progress checklist, gate verdicts to date, decisions, modified files, open questions, and the current step. Rules:

- Checkpoint after every artifact write and every gate decision, not at end of session.
- Write artifacts skeleton-first, one section at a time; keep sources and generated artifacts separate; never overwrite originals.
- On any resume (after pause, compaction, or context loss), reconstruct obligations from the state file, event log, and content-hashed artifacts — never from assumed memory. Re-derive budget remaining from the record, not from recollection.

## Budgets and turn limits

- Every role carries explicit nonzero token, tool-call, wall-clock, and (where billable) dollar budgets; `maxTurns` is set per role (the studied framework uses 30 for director-class roles).
- Time-box exploratory work and give it an explicit TIMEOUT verdict ("if it is not demonstrable after the box, the verdict is TIMEOUT") — kill cheaply.
- Budgets are shared and decremented centrally when composed under the director; exhaustion is a hard stop with partial-artifact preservation, never silent continuation.
- Billable calls are never auto-retried: a timeout does not prove the call was not billed; retry is a deliberate recorded decision.
- Termination fires on deterministic counters, not self-report: no progress for N turns, an identical action repeated N times, max turns reached, or max replans exceeded. Progress means a new accepted artifact, a satisfied contract obligation, or a materially changed strategy with new evidence — not more text.

## Pause, wait, and cancel

- **Pause-for-approval is the default before state-changing actions:** show the intended action and its evidence ("May I write this to path?" / "Proceed with extraction under HUMAN-2 decision #3?"), batch multi-file changesets, and never commit without instruction. A paused node is resumable from durable state.
- **Wait bounded, never busy:** when waiting on an external tool or service (decompiler, emulator, CI), use a bounded wait primitive — a small number of cheap read-only probes (at most ~20), then stop with diagnostics and instructions. When blocked on an input or decision, transition to `waiting`/`awaiting_approval` and yield; never poll in a tight loop.
- **Cancel is terminal:** every decision point offers an escape (Cancel/Stop). On cancellation, record the reason and partial evidence, propagate cancellation to dependents, preserve accepted upstream artifacts, and never implicitly retry.
- **Error recovery:** surface BLOCKED immediately, assess downstream dependencies, offer skip/retry/stop, and always emit a partial report.

## Evaluation harness

Run the evaluation tasks listed in SKILL.md as binary PASS/FAIL checks when this skill or its agent is instantiated or modified. Track per-run results (date, harness/model, result) in a coverage record so the eval trail is auditable; an empty result field means "never run," not "passing." Complement behavioral checks with structural CI where available (frontmatter validation, reference integrity) — structural checks verify the instructions exist, not that behavior follows them.
