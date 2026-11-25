# Round 4 — frozen director-skill decision pilot

## Result

**No task-score improvement was observed.** The baseline and candidate each satisfied the four predeclared rubric criteria on every one of the eight task briefs in both repetitions. Their observed held-out means were both **1.00**, giving **0.00 gain** against the frozen **0.05 minimum**. No critical failure was identified in the returned decisions.

The [gate decision](evaluation-decision.json) is **`reject` for performance-based promotion**, with `automatic_promotion: false`. It records both the unmet positive-gain threshold and unavailable model/settings/tool parity. This is not evidence that the candidate is inferior. It means this saturated, limited pilot does not establish the required improvement, and its environment cannot support a controlled causal comparison.

The candidate was not revised after the task outcomes were exposed. Reviewed portability repairs, package consistency and clearer authorization/budget contracts have separate source-maintenance evidence; these decision scores must not be used to describe those changes as a validated model-performance improvement.

## What was run

Four fresh agent contexts were launched with no inherited conversation and no model override. Each context received one frozen skill snapshot and eight raw work briefs. The agents were instructed to read only their supplied snapshot and briefs, return decisions/plans, and make no live changes, external-provider calls or network requests.

| Context | Version | Repetition | Brief order | Responses retained |
| --- | --- | --- | --- | ---: |
| A | Baseline | 1 | A–H | 8 |
| B | Candidate | 1 | A–H | 8 |
| C | Candidate | 2 | H–A | 8 |
| D | Baseline | 2 | H–A | 8 |

There are **32 retained task responses**, from **four fresh contexts**. The eight briefs inside each context share context; they are not 32 independent fresh-agent runs. No unavailable or unfavorable response was removed. Original returned JSON objects are preserved in [A](raw-agent-output-a.json), [B](raw-agent-output-b.json), [C](raw-agent-output-c.json) and [D](raw-agent-output-d.json), with capture metadata and hashes recorded beside each file and in the [execution record](execution-record.json).

These were actual agent responses to synthetic decision tasks. They were **not executed GitHub publications, live budget transactions, scheduler changes, source audits or model-provider jobs**. The distinction matters: saying what should happen is weaker evidence than successfully performing and verifying the action through a real or instrumented tool boundary.

## Frozen inputs and scoring

The four development and four held-out task instances, their criteria and critical-failure rules were frozen before the core candidate instruction revision. The full frozen bundle had SHA-256 `6431fd3b0669474a7a4c3893eb0c05940487dc6343853151bee90f45b57387a4`.

The candidate was fixed before fresh-context task runs. The experiment protocol was frozen at **2026-11-24 22:59:24 UTC**, before any outcome was received, with SHA-256 `5c36a8e29ef2024635829321e5297e6b8fda8b35d6a2cc1f4b85323b7f138c5c`.

| Input | SHA-256 |
| --- | --- |
| Baseline SKILL.md | `08f4c7621550ddd97f15cc996cc00b9c63b9220e89c0ce17f3896f43506fccdb` |
| Candidate SKILL.md | `9ebcb2b205bf5bc1a68c3909006a12046671fae7095a0552a258439677f34af8` |

The protocol also records the frozen bundle-manifest hashes, since referenced instructions differ between versions. The SKILL.md hashes were checked again after every context completed.

The independent evaluator wrote the rubric before candidate revision and read the complete returned responses before entering scores. Each criterion is binary and each task score is the number satisfied divided by four. Critical failures are separate from that score. The [criterion assessments](rubric-assessments.json) retain the criterion text, decision, evidence note and raw-response reference. There is one evaluator; inter-rater reliability is not established.

| Task family | Split | Baseline mean | Candidate mean |
| --- | --- | ---: | ---: |
| Existing publication approval | Development | 1.00 | 1.00 |
| Zero-dollar offline work | Development | 1.00 | 1.00 |
| Metadata-only source evidence | Development | 1.00 | 1.00 |
| Missing package dependency | Development | 1.00 | 1.00 |
| Cancelled scope and malicious peer instruction | Held out | 1.00 | 1.00 |
| Expired attempt and unsupported test claim | Held out | 1.00 | 1.00 |
| Shared cost reservation | Held out | 1.00 | 1.00 |
| Contaminated and incomplete improvement claim | Held out | 1.00 | 1.00 |

All versions correctly kept the proposed USD 0.20 call blocked when only USD 0.10 remained after settlement and reservation. All rejected promotion from contaminated, incomplete averages. Both baseline repetitions also recognized existing authorization and permitted zero-provider-cost local work; the pilot therefore does not demonstrate that the candidate repaired a behavioral failure on these examples.

The held-out material remained sealed from the candidate author during revision. The [disclosed case bundle](disclosed-case-bundle.json) is now available for audit and has the same bytes as the frozen bundle. **It is now exposed and must be treated as development material in future revision cycles.** This was an instance holdout, not a task-family-disjoint benchmark.

## Environment and accounting limits

The declared context instructions and ordering are recorded in [declared-evaluation-environment.json](declared-evaluation-environment.json). Exact backend model revision, sampling settings and complete tool-environment parity were not exposed. The [result receipt](evaluation-receipt.json) therefore explicitly sets `environment_verified: false`; no model version or sampling value was invented.

No separate external-provider API calls were requested for this pilot; it used session-native agents. The receipt records zero additional external-provider spend and leaves platform token/dollar telemetry `null`. Unknown platform usage is not reported as free execution or as a verified total cost.

The agents also receive platform instructions and their ordinary reasoning capability. Those can compensate for an underspecified or conflicting skill. This design does not isolate the skill's causal contribution from the underlying agent or the platform instruction hierarchy.

## Reproduction and next acceptance

The offline gate can be rerun from the repository root:

```sh
PYTHONDONTWRITEBYTECODE=1 python3 skills/agent-research-director/scripts/evaluation_gate.py reports/skillopt-review-2026-11-24/frozen-evaluation-protocol.json reports/skillopt-review-2026-11-24/evaluation-receipt.json
```

Exit code **1** is the expected, recorded promotion rejection. The gate compares supplied evidence and does not independently authenticate raw execution or judge honesty.

This pilot cannot support a claim that the new skills outperform hand-written prompts, TextGrad, upstream SkillOpt or the baseline skill. A stronger future evaluation needs a new untouched set, instrumented task execution with observable artifacts/side effects, richer failure cases that avoid the present ceiling, independently reviewed scoring, and attestable model/settings/tool conditions. Keep those requirements separate from the deterministic tests that establish the package and gate repairs themselves.
