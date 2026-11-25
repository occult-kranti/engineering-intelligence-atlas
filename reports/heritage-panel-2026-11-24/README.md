# Heritage and game-art review record

## Recovery status — 2026-11-25

The prior session left this work uncommitted on
`feature/heritage-site-models-panel`. GitHub `main` was independently read at
`c1c5ac91fbfd929e91b3762ada7aa5864dc84a48` before recovery. That commit already
contains the earlier backend, creative-tools and architecture-library work.
The new captured-place viewer, preserving model pipeline, game-art resources,
project skill changes and their generated projections were the missing batch.

This directory preserves the original Round 1 artifact and four Round 2 expert
reports. The recovery review below is a **separate integration review by the
`/root/github_audit` agent**. It is not a previously completed third four-expert
round, human peer review, or evidence that the original experts ran again.

## Retained review sequence

| Record | What the record establishes | Limit |
| --- | --- | --- |
| `round-1.json` and `round-1-artifact.json` | Original decisions and the files included in the original frozen artifact | The original scope omitted some changed workflow, catalog, role and test files, as identified in Round 2 |
| `expert-1-round-2.json` | Heritage provenance and accuracy review | Requested changes to derivative lineage and review-round wording |
| `expert-2-round-2.json` | Preservation and documented engine-scope review | Required explicit Godot Float32-position eligibility; no field-accuracy claim |
| `expert-3-round-2.json` | Engine and Blender-helper review | Requested source/import counts on the same active-scene instance basis |
| `expert-4-round-2.json` | Toolchain, authority, cancellation and publication review | Requested a download deadline, fuller artifact coverage and independent Pages gates |
| `recovery-2026-11-25.json` and `recovery-artifact.json` | Current integration review, fresh command outcomes and a broader frozen file inventory | Browser execution is blocked locally; remote CI is a separate acceptance state |

## Disposition of the retained findings

| Finding | Current evidence inspected during recovery | Disposition |
| --- | --- | --- |
| H2-01: stale church/mosque GLB lineage | `capture-requirements.json`, `ACCURACY.md`, catalog and preservation receipts separate original masters, preserving downloads and Blender previews | Corrected locally; integrity tests pass |
| H2-02: undisclosed Kailasa preview difference | Accuracy guide and viewer metadata disclose 136,499 published versus 136,498 preview triangles | Corrected locally; no missing triangle is represented as present |
| H2-03: three-round claim before completion | Collection guide now counts only recorded completed rounds; this README names the present recovery review separately | Corrected; no third expert round invented |
| E2-R2-01 / E3-R2-02: Godot input eligibility | Guides restrict this audit to non-normalized Float32 `POSITION` accessors after decompression | Corrected; the three quantized pyramid derivatives remain outside recorded Godot coverage |
| E3-R2-01: mismatched Blender counting bases | `blender-review.py` counts active-scene node instances, including shared meshes, and excludes unused declarations | Corrected; 10 fresh helper tests pass, including cycles and invalid references |
| E4-R2-01: stalled download and cancellation | Stream and viewer tests cover header/body deadline, cancellation, cleanup, retry and stale completion | Corrected; the corresponding pure/DOM tests pass; real browser checks remain a CI gate |
| E4-R2-02: incomplete artifact scope | New `recovery-artifact.json` covers all reviewed changed source, primary workflows, roles, catalog, tests and generated files, with explicit self-exclusions | Replaced by a broader recovery snapshot; original manifest is preserved unchanged |
| E4-R2-03: Pages could bypass new integrity gates | Both CI and Pages run `scripts/check-game-heritage.mjs`; Pages also runs the architecture and heritage browser tests | Corrected in workflow source; a successful remote run must be recorded separately |

## Fresh recovery validation

Executed against the recovered working tree on **2026-11-25**:

| Command | Observed result |
| --- | --- |
| `node scripts/check-game-heritage.mjs` | Passed: 17 pinned-resource integrity tests, 60 Node model/viewer/geometry/materialization tests, 10 Blender-helper tests |
| `node --test scripts/architecture-library-assets.test.mjs scripts/resource-router.test.mjs` | Passed: 18 tests |
| `python3 scripts/sync-skills.py --check` | Passed: 15 packages, 7 public mirrors, no drift |
| `python3 scripts/sync-resource-projections.py` | Passed in its default read-only mode |
| `node scripts/resource-router.mjs --check-atlas` | Passed: 333 catalog and projection records; 296 original records preserved |
| `npm --prefix site-source run check` | Passed TypeScript build check |
| `node scripts/build-static.mjs` | Passed: 379 verified client files; heavyweight models remain outside automatic precache |
| `git diff --check` before staging | Passed for existing tracked edits |
| Staged authored-file whitespace check | Passed; exact upstream-byte exceptions described below |
| `node scripts/smoke-heritage-viewer.mjs` | Blocked before page launch: Playwright's expected bundled browser is absent |
| `HERITAGE_CHROMIUM_EXECUTABLE=/usr/bin/chromium node scripts/smoke-heritage-viewer.mjs` | Blocked before page launch: system Chromium aborts with `socket() failed: Operation not permitted` |

No browser pass or screenshot acceptance is inferred from the successful build,
unit tests, or the existence of a browser binary. The workflows retain the real
browser gate and upload its evidence. This recovery does not weaken that gate.

The publication scan reviewed the changed text and file inventory for credentials,
unrelated runtime records and accidental temporary outputs. Its two text-pattern
hits are deliberate fake credential-URL rejection fixtures. Large intended model
parts remain under the documented per-part limit and retain catalog hashes.
This bounded scan is not a claim of an exhaustive security audit.

The complete staged whitespace check reports four retained upstream whitespace
lines: one in each of the three byte-identical Three.js copies, and one in the
pinned OpenCodeGameStudios `gate-check/SKILL.md`. Editing those lines would break
the verified upstream-byte contract. They remain unchanged and disclosed. The
staged check excluding those vendor/resource directories passes; no authored
whitespace error is waived.

## Content delivered and its boundaries

The captured-place collection has seven source-derived models, 8,584,116 triangles
and 144,173,560 web-model bytes. It preserves original source identity, attributed
reuse terms, transformation receipts and explicit scale/coverage uncertainty.
These are inspectable visual references; **none is an independently metric-verified
digital twin**. More permitted capture data is still needed for Giza and Kailasa
fine detail. The noncommercial Cave 16 fragments remain external references.

Retained actual Godot receipts cover Kailasa context, St. George Church and El
Markaz Islami Mosque, 14 checks each. This recovery reran the receipt/integrity
tests, not those full engine imports. Giza plateau has no included Godot execution
receipt, and the quantized Khufu, Khafre and Menkaure files remain outside this
audit's current Float32 input contract. Earlier Blender derivatives and their
documented face differences stay distinct from preserving web GLBs.

The game-art work adds 29 audited reference records and a staged production plan.
The central catalog contains 333 records at this recovery snapshot. Pinned
OpenCodeGameStudios resources comprise 23 agent definitions, 46 skills and 31
commands, within 119 hashed upstream files. These are reference resources for
existing teams, not 23 running agents, installed external services or completed
lessons. Physical fidelity, engine gameplay, target-device frame rates, Unreal
execution, paid services and a live VPS require their own concrete evidence.

## Continue from this snapshot

Use the [maintainer handoff](../../HANDOFF.md),
[game-art plan](../../projects/game-development-research/README.md),
[collection accuracy guide](../../projects/architecture-library/site-models/ACCURACY.md)
and [repository recovery audit](../../project/GITHUB_RECOVERY_2026-11-25.md).
Run the retained workflow gates for the exact next commit before claiming remote
acceptance. Keep original review records immutable and add new dated records for
subsequent changes.
