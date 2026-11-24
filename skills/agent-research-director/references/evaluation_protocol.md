# Bounded skill-revision evaluation

## Purpose and limits

Use this contract when revising a skill, comparing two instruction versions, or deciding whether a candidate merits independent release review. Optimize observable task outcomes under a fixed authority boundary. Do not score a skill by keyword count, length, reviewer enthusiasm or its own claims of success.

The offline [receipt gate](../scripts/evaluation_gate.py) compares independently supplied results. It does not call a provider, execute a skill, authenticate a judge, inspect evidence files, apply changes, activate an employee, or prove general performance. A structurally valid receipt can still contain false evidence; the acceptance reviewer must check the referenced raw outputs and run records.

This is a panel-led evaluation protocol for Daftar. Passing its unit tests proves gate behavior on synthetic receipts. It does not reproduce an upstream paper benchmark or establish that agent competence improved.

## Freeze before evaluation

1. Record the target skill and exact baseline content hash. Preserve its task inputs and outputs before making revisions.
2. Define task-success criteria and critical failure conditions from the user's outcome. Include authorized-task completion as well as authority, evidence and budget boundaries.
3. Separate development tasks from held-out tasks by stable ID and input hash. Keep held-out prompts, answers and rubric details away from candidate authors and the optimizer until the candidate is frozen.
4. Declare the score range, positive improvement threshold, tolerated noncritical regression, number of repetitions and external-provider ceiling. Do not choose them after seeing results.
5. Freeze the candidate hash and complete protocol before running the held-out tasks. Keep model identity, settings, tool environment, input versions and scoring rubric fixed across each pair.
6. Run baseline and candidate in fresh contexts. Supply only the skill, task and permitted artifacts. Do not pass the expected answer, diagnosis, earlier panel conclusions, another run's output or candidate authorship. Ask an independent reviewer to judge raw outcomes against the frozen rubric.
7. Preserve every frozen case and repetition, including failures, unavailable runs and unknown cost. Never compare only successful paths or silently remove a difficult case.
8. If a held-out answer influenced another revision, mark it contaminated. Use it only for development thereafter and freeze a new disjoint set before another confirmatory comparison.

The dated [case manifest](evaluation-case-manifest.json) records the frozen pilot IDs, task hashes and rubric hashes. The [development cases](evaluation-development-cases.json) are available for revision work. Sealed held-out material must be disclosed only after candidate freeze; publishing it makes it unsuitable for future untouched evaluation.

## Outcome rubric

Use task-specific criteria with observable evidence. Suitable criteria include producing the required artifact, choosing the authorized next action, calculating the effective budget correctly, preserving source uncertainty, and accurately reporting whether a tool ran. Score completed judgments on a fixed 0–1 scale. A failed agent task can still be an evaluated outcome with score 0; an unavailable run or absent judgment is missing evidence, not a zero score.

Define critical failures separately from the scalar score. Examples include executing beyond current authorization, leaking unrelated private material, discarding an unresolved cost reservation, accepting a cancelled/stale attempt as authority, or claiming unexecuted work as verified. A higher average cannot offset these failures.

Use multiple independent task families and at least two predeclared repetitions for this gate. Small pilots establish only bounded acceptance. Repeated runs of one task are not independent task diversity; a qualified pilot is not a statistical guarantee or a universal performance claim.

## Frozen protocol JSON

The gate accepts two local JSON files: a frozen protocol and its result receipt. It uses only Python's standard library. Hashes use lowercase hexadecimal SHA-256. The protocol digest is SHA-256 of UTF-8 JSON serialized with sorted keys, compact separators and no non-finite numbers; `digest()` in the gate provides that operation.

| Protocol field | Contract |
| --- | --- |
| `schema_version` | Integer `1` |
| `experiment_id` | Nonempty stable experiment identifier |
| `frozen_at` | ISO 8601 timestamp with timezone, preceding every evaluation |
| `repetitions` | Integer from 2 through 20; the exact expected repetitions per case and variant |
| `min_mean_gain` | Predeclared positive threshold in `(0, 1]` |
| `max_case_regression` | Allowed mean-score loss for noncritical cases in `[0, 1]`; prefer 0 |
| `max_external_provider_usd` | Known nonnegative total external-provider ceiling for both variants and all runs; 0 is valid |
| `skill_sha256` | Object with different `baseline` and `candidate` hashes |
| `environment` | Exact object: `model_id`, `settings_sha256`, `tools_sha256` |
| `cases` | Array of 2–200 cases covering both development and held-out splits |

Each case has exactly `id`, `split` (`development` or `held_out`), `critical` (boolean), `input_sha256` and `rubric_sha256`. IDs must be unique across both splits, and task-input hashes must not overlap development and held-out sets even under different IDs. Record the same environment in every result row. If model/settings/tool equivalence cannot be established, mark the receipt's `environment_verified` false rather than inventing a version.

Experiment and case IDs are limited to 200 characters. Each input file is limited to 4 MiB and each receipt to 8,000 outcome rows. Larger studies need a separately reviewed protocol and implementation; increasing a prompt's budget does not silently raise these bounds.

## Result receipt JSON

| Receipt field | Contract |
| --- | --- |
| `schema_version` | Integer `1` |
| `experiment_id`, `protocol_sha256` | Identify the exact frozen protocol |
| `evidence_kind` | `observed_agent_runs` only for real task executions; use another explicit label for synthetic fixtures or static checks |
| `independent_review` | True only when a reviewer separate from the output producer judged the raw outcomes |
| `environment_verified` | True only when comparable model/settings/tool evidence is available |
| `held_out_contaminated` | False only when the held-out set remained outside tuning; true or unknown prevents qualification |
| `tuning_case_ids` | Explicit array containing development IDs only; an empty array is valid |
| `results` | All baseline/candidate outcomes for every frozen case and repetition |

Every outcome row includes:

```json
{
  "variant": "baseline",
  "case_id": "development-example",
  "repetition": 1,
  "skill_sha256": "<64 hexadecimal characters>",
  "environment": {
    "model_id": "<recorded model revision>",
    "settings_sha256": "<64 hexadecimal characters>",
    "tools_sha256": "<64 hexadecimal characters>"
  },
  "input_sha256": "<64 hexadecimal characters>",
  "rubric_sha256": "<64 hexadecimal characters>",
  "evaluated_at": "2026-11-24T12:01:00Z",
  "status": "evaluated",
  "score": 0.75,
  "critical_failures": [],
  "evidence_ref": "relative/path/to/raw-task-output.json",
  "judge_id": "independent-reviewer-identity",
  "external_provider_usd": 0,
  "platform_usd": null,
  "platform_tokens": null
}
```

This is a shape illustration, not an observed run. Use actual hashes, identifiers and evidence. `status` other than `evaluated`, missing references or unknown required values make the comparison inconclusive. The gate never opens `evidence_ref` or executes anything named by it.

## Costs and uncertainty

Separate external provider charges from platform/session usage. A deterministic local task can have a known external cost of zero while platform tokens or charges remain unavailable. Represent unavailable platform telemetry as `null`; the gate preserves that distinction. Unknown external cost is also `null` and prevents qualification. A timeout does not settle a charge or free a reservation.

The ceiling covers baseline and candidate evaluation together. Record actual known charges rather than estimated savings. Reject an over-budget receipt. Apply task-local and run-level authority before execution; this after-the-fact gate cannot prevent a call that a runner already made.

## Decisions and release

Run from the repository root:

```sh
python3 skills/agent-research-director/scripts/evaluation_gate.py frozen-protocol.json result-receipt.json
```

| Decision | Meaning | Exit code |
| --- | --- | --- |
| `candidate-qualified` | Complete supplied outcomes meet the frozen bounded comparison; independent release review is still required | 0 |
| `reject` | A critical failure/regression, unacceptable case loss, budget overrun or inadequate held-out gain was observed | 1 |
| `inconclusive` | Missing, malformed, inconsistent, contaminated, nonindependent or unknown evidence prevents qualification | 2 |

Every output says `automatic_promotion: false` and identifies protocol/receipt hashes. Critical failures and known unacceptable regressions reject even when unrelated evidence is missing. A critical loss in any available baseline/candidate repetition pair is sufficient to reject; missing rows cannot erase that observed regression. Noncritical per-case mean regression uses the declared allowance once that case's repetitions are complete. Critical cases allow neither mean regression nor a loss hidden by another repetition. Development scores are diagnostic; the positive qualification threshold uses the held-out mean, with each case weighted equally. The gate reports an aggregate held-out mean only when all frozen pairs are complete.

Keep the current active revision on rejection or uncertainty. Inspect raw evidence, preservation of authority, package parity and deployment scope before adopting a qualified candidate. A reviewer may accept a demonstrated structural repair while accurately stating that general agent-performance improvement remains unmeasured. Never relabel static checks or fixture passes as task-performance gains.

Run the synthetic decision tests with:

```sh
PYTHONDONTWRITEBYTECODE=1 python3 skills/agent-research-director/scripts/test_evaluation_gate.py
```

The tests cover completeness, duplicate IDs, non-finite scores, fixed provenance, contamination, missing evidence, repeated critical regression, cost uncertainty, zero-budget work and false promotion from fixture-only evidence.
