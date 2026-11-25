# GitHub recovery audit — 2026-11-25

## Finding

GitHub `occult-kranti/engineering-intelligence-atlas` `main` was read directly with
`git ls-remote --heads origin` and resolved to
`c1c5ac91fbfd929e91b3762ada7aa5864dc84a48`. The current heritage worktree had that
same HEAD and **464 uncommitted paths** when recursively enumerated: 45 modified,
18 deleted generated assets and 401 untracked files. A short `git status` groups
untracked directories, so its visible line count is not the recursive file count.
The branch `feature/heritage-site-models-panel` was not present remotely at audit
start. The missing work needed a commit and push; no ahead-of-remote commit was
waiting on that branch.

## Missing batch identified

| Area | Missing repository work |
| --- | --- |
| Captured heritage | Seven-model viewer, catalog, acquisition/source dossiers, previews, licenses, accuracy contract and preserved model parts |
| Model conversion | Preserving OBJ/GLB pipeline, Blender helper, materializer and actual engine receipt audits |
| Godot | Inspectable project/audit harness and retained three-model evidence |
| Game-team resources | Pinned OpenCodeGameStudios modules, integrity checker and existing-role mappings |
| Art and production study | Drawing fundamentals, Blender/art sources, rendering/interchange study and staged game-development plan |
| Skills and companies | Three existing project skill updates, role guidance, canonical resource additions and generated projections |
| Publication | Static/source asset allowlists, regenerated web output, CI and Pages integrity/browser gates |
| Review and handoff | Original Round 1/four Round 2 reports; a missing linked summary now supplied with a separately labeled recovery review |

Before recovery additions, the 401 new files occupied 187,875,163 bytes. Packed
large model chunks are at most 10 MiB each. Original large archives and private
runtime state are not added to this batch.

## Other worktrees and repositories

| Checkout | Observed state | Action |
| --- | --- | --- |
| Current Daftar heritage worktree | `feature/heritage-site-models-panel`, HEAD `c1c5ac9`, missing batch above | Validate, preserve, commit and push the feature branch |
| Earlier Daftar delivery worktree | `work/daftar-delivery-2026-11-24`, HEAD `0b93e1f`, dirty older resource-office work | Preserve in place; do not overwrite newer files with this stale working tree |
| Earlier resource Sites checkout | Older `e0a17a6` source with dirty resource projections | Treat as an older build/source copy, not an independently missing GitHub application |
| Current Sites checkout | Clean at `98871ba` | Separate Sites source/publication identity; no GitHub push inferred |
| Canvas Sites checkout | Clean at `a590007` | Preserve separately |
| User remote-skills repository | Clean `master`, local and live remote both `a707b3c802885f2aa699488953471b07dc00e73a` | No missing skill-store commit at audit start |
| OpenCodeGameStudios upstream | Clean pinned `85aa449` | Reference checkout; do not push upstream |
| SkillOpt upstream | Clean pinned `dc0b5e6` | Reference checkout; do not push upstream |
| Shopping recovery repository | `58b5fab`, four staged deletions: Dockerfile, LICENSE, README, bot.js | Unrelated earlier task; preserve without publishing unexplained deletions |

For the older Daftar dirty tree, 179 recursively enumerated paths were compared
against the latest source. 147 were byte-identical to the current working tree;
13 matched current HEAD; seven represented old generated-file deletions. Eleven
different files contain later documentation, runtime hardening or regenerated
outputs in the current checkout. The only file absent from the current checkout
is an obsolete content-addressed generated CSS filename. Existing earlier work
therefore must not be counted a second time merely because the older worktree is
still dirty.

The older branch's two SDK/skill commits have patch-equivalent commits in main.
Its earlier prototype commits have separately imported source history. Their
different commit identities are preserved rather than collapsed or rewritten.
The already-pushed `design/infinite-blueprint-canvas` branch remains separate
from main by history; this audit does not call it unpushed or silently merge it.

## Validation and publication states

The detailed [recovery review](../reports/heritage-panel-2026-11-24/README.md)
records fresh passing source, model, packaging, catalog and build checks, plus the
local browser-execution blocker. The original field-accuracy and engine limits
are retained. A locally passing gate, a pushed feature commit, a merged main
commit, a successful Pages job and a live deployment are separate outcomes.

This document records the audit and recovery scope, not a fabricated deployment
receipt. The enclosing feature commit and the independently read remote ref
identify publication after pushing. Later atlas work may extend these source
files; the frozen recovery artifact manifest retains this review's exact scope.
