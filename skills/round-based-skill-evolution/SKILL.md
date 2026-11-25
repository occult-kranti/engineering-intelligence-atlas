---
name: round-based-skill-evolution
description: Improve Daftar runtime skills and role briefs through bounded evidence diagnosis, prospective edits and independent task evaluation. Use for dedicated skill-update rounds, repeated company setup reviews and measured corrections after failed or incomplete workflows.
---

# Evolve company skills in bounded rounds

Use the published Daftar evaluation protocol and Olympus round contract pinned in [source-pins.json](references/source-pins.json). This repository runtime adapter does not install or automatically promote personal skills.

## Freeze the task

Identify the existing skill, role owner, source revision, observed failure and finite deliverable. Record the current task scope, acceptance checks, allowed edit paths and real resource ceilings. Reuse existing skills before adding overlapping instructions. Keep research rounds, code tests, archive work and skill evaluations distinct.

## Run three adaptive stages

1. **Diagnose:** collect raw task evidence and identify a specific failure with user impact. Check a plausible alternative explanation. Freeze the baseline, inputs and criterion before revising instructions.
2. **Improve:** make the smallest reusable amendment. Keep the runtime body short and load domain references only when relevant. Preserve source provenance, ownership, authorization, accounting and known limitations. A rule change cannot grant new runtime capabilities.
3. **Evaluate:** give a distinct reviewer the revised skill and raw task-local artifacts. Withhold the intended answer, diagnosis and previous conclusions from the acting worker. Record what ran, failed, remained unavailable and changed after review. Rerun only the concrete failed or materially affected checks.

Choose the next objective from the preceding evidence. Do not count three reports about an unchanged artifact as three implementation rounds. Do not invent worker provenance, model participation, cost telemetry or completed trials.

## Separate structural repair from performance claims

A package check can accept a structural repair without establishing better agent performance. For a performance comparison, use the existing `skills/agent-research-director/references/evaluation_protocol.md`: freeze task families, held-out separation, paired runs, repetitions, model/settings, budget and scoring before measurement. Preserve all outcomes, contamination and unknown charges. Keep the current active revision when the comparison is inconclusive or rejected.

The existing `evaluation_gate.py` evaluates supplied receipts; it does not launch trials or automatically promote a skill. Do not claim a passing synthetic fixture is an observed agent improvement.

## Return a revision receipt

Record round ID, owner, input/version hashes, observed problem, exact amendment, actual checks, raw evidence paths, independent review, decision, limitations and next action. Use `accepted`, `accepted_with_limits`, `needs_revision` or `blocked` for the proposed revision. Route accepted repository changes to `github-release`; route scoped operating knowledge to Donna's native brain. A repository update, personal-skill installation and live deployment need separate receipts.

Stop on completion, cancellation, exhausted actual allowance, repeated no-progress or a decisive inaccessible input. Preserve partial evidence. Use `node scripts/resource-router.mjs --skill round-based-skill-evolution --limit 6` only when available, and follow the current company task contract and packaged collaboration protocol.
