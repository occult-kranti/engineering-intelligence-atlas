# Daftar skills: five-round panel review

Date: November 24, 2026. This is a review and maintenance increment for the repository's 15 skills. It is not five SkillOpt training epochs, a model-weight update, or a reproduction of Microsoft's benchmark results.

**Final outcome:** the structural maintenance increment passed release review. The [frozen decision pilot](EVALUATION.md) found no observed task-score gain: both versions scored 1.00, with held-out gain 0.00 against a 0.05 threshold. Its gate rejected performance-based promotion and also recorded unverified environment parity. The published candidate is therefore a reviewable maintenance revision, not an empirically proven agent-performance improvement or an activated production skill.

## Source baseline

- Repository baseline: `3a3cc3d56d7f43195ab8b857ca9f3c2bed46390e`.
- SkillOpt source inspected: [microsoft/SkillOpt](https://github.com/microsoft/SkillOpt/tree/dc0b5e654cafa1073a2819086151c1e0d13012f0), commit `dc0b5e654cafa1073a2819086151c1e0d13012f0`.
- Paper: [arXiv:2605.23904v2](https://arxiv.org/abs/2605.23904v2), revised May 25, 2026.
- Upstream MIT license is preserved in its source. Commercial permission does not mean model/API execution is cost-free.

The inspected method keeps the task model and harness fixed, analyzes successful and unsuccessful trajectories separately, proposes bounded instruction edits, and accepts strict improvement on a selection split. Ties do not qualify. Final test data must stay separate from tuning. Model/backend compatibility, evaluator design and compute cost remain practical constraints.

Daftar adopts those principles in a small offline receipt gate and a bounded pilot. We did not run the upstream optimizer against a paid provider, train model weights, or claim the paper's benchmark gains for Daftar. The upstream source, package version and paper are distinct versions; the pinned source is the audit target.

## Panel roles and rounds

The panel combined methods/evidence review, evaluation engineering, packaging/runtime architecture, and root integration review. Fresh task contexts were used for the behavior comparison; correlated expert agreement is not treated as evidence of truth.

| Round | Work | Concrete result |
| --- | --- | --- |
| 1 — Source and baseline audit | Verify SkillOpt and trace actual Daftar skill loading | Found 15 broken shared-protocol paths, a stale eight-skill claim, incompatible nonzero-budget wording, redundant-approval wording, stale-copy risk and folded-description parsing failure |
| 2 — Bounded implementation | Revise prompt contracts, add evaluation gate, implement deterministic source synchronization and repair intake | 15 revised skill bodies, portable shared protocol, offline comparison contract, reproducible packages/runtime briefs and parsed folded descriptions |
| 3 — Independent challenge | Reproduce errors from public synthetic evidence; cross-check active references | Repaired cross-split duplicate inputs, hidden critical regression, malformed hash-map crashes and huge-number crashes; fixed a remaining active-reference contradiction |
| 4 — Fresh paired tasks | Freeze candidate and rubric; run baseline/candidate on the same task families in fresh contexts | Four fresh contexts, 32 retained decision responses, both versions 1.00, gain 0.00; performance-promotion gate rejected, environment parity unverified |
| 5 — Release review | Review source/package parity, input boundaries, test evidence, authorization scope and public claims | Structural maintenance is reviewable separately from any performance claim; no runtime activation or automatic promotion is authorized by a score |

## What changed

All 15 skill bodies now reference their own bundled `references/collaboration_protocol.md`. Their shared contract allows finite nonnegative resource ceilings, distinguishes zero external-provider cost from unknown platform usage, and carries forward existing authorization within the same action, destination, data, budget and consequences. Platform-required fresh confirmation and genuine domain gates remain in force. These prompt changes do not alter application security controls or deployed runtime budget validators.

The director now has a measured revision procedure and [evaluation contract](../../skills/agent-research-director/references/evaluation_protocol.md). The gate requires paired case/repetition outcomes, frozen hashes and environment declarations, independent judgments, raw-output references, separate development/held-out inputs and known external-provider cost. It rejects critical failures and regressions, ties and inadequate gain. Missing or unverified evidence remains inconclusive. A qualifying receipt never activates a skill.

The source loader previously read `description: >-` as the literal marker instead of the actual description. The intake repair parses the supported inert YAML subset and surfaces malformed metadata. It does not execute YAML tags, skill scripts or instructions.

The native worker reads `company/skill-briefs.json`, so source edits alone would have left employees with old instructions. `scripts/sync-skills.py` now regenerates and checks all 15 archives, the native brief bundle, shared protocol copies and the seven existing public mirrors. Archives use stable order, timestamps and modes. Check mode is read-only. Generated documentation/Android snapshots were not hand-edited.

## Structural verification

| Check | Observed result |
| --- | --- |
| Offline evaluation gate | 33 synthetic decision tests passed after Round 3 fixes |
| Independent gate reproductions | All four reported issues return the documented structured decisions |
| Skill synchronizer | Nine tests passed, including drift, deterministic packaging and unsafe-input cases |
| Frontmatter intake | Ten tests passed, including all 15 actual folded skill descriptions |
| TypeScript validation | `npm run check` / `tsc -b` passed in `site-source` |
| Generated parity | 15 skills, seven existing mirrors, zero drift |
| Native limits | 113,918-byte brief bundle below 500,000 bytes; longest body 12,413 UTF-16 units below 16,000 |

These tests establish structural properties and specific repaired cases. They are not an agent-performance benchmark. The behavior report and receipt must be read separately, including any inconclusive/rejected decision.

The independent runtime reviewer approved the maintenance/source scope in Round 5 and reconfirmed zero generated drift. Root reviewed the final comparison report, preserved its rejection, and kept all raw outcomes. The eight briefs shared four contexts; no live side effects were executed by those task agents. The single evaluator's scores are not a measured inter-rater reliability result.

## Reproduce the local checks

```sh
PYTHONDONTWRITEBYTECODE=1 python3 skills/agent-research-director/scripts/test_evaluation_gate.py
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s scripts -p test_sync_skills.py
python3 scripts/sync-skills.py --check
```

For the intake/type checks, use the existing locked `site-source` dependencies and run its targeted Vitest suite and `npm run check`. `--write` is the explicit synchronization action after reviewed source changes; do not hand-edit runtime briefs or package archives.

## Release boundary

This increment publishes source and review evidence. It does not claim that a running desktop, hosted Donna conversation, or installed personal ChatGPT skill collection has been updated. A desktop build must consume the synchronized bundle; the hosted Donna prompt is a separate integration. No provider key or private source attachment is included.

Retain the prior active revision whenever performance evidence is rejected or inconclusive. An independently demonstrated maintenance repair can be proposed for adoption with that limitation stated explicitly. The pilot cases become development material once disclosed; they cannot be reused as untouched held-out evidence for later revisions.
