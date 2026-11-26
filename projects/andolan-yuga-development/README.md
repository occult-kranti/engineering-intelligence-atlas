# ANDOLAN / YUGA development company

This package prepares a repository-bound Daftar company for coding, map design,
Blender production, independent review and a separate Unreal import experiment.
It includes a real additive native setup command and an original portable
[Daftar Route Lab](map-blockout/README.md).

**Status:** the setup has been applied and checked in disposable native test
workspaces. It has not been applied to the owner's live workspace. No model was
downloaded, assigned or run by this setup. No GPU or Unreal execution is claimed.
The JSON kit is a template; an actual apply returns a receipt with the committed
company and employee IDs.

## Verified source and engine boundaries

The inspected repository is [`occult-kranti/ANDOLAN`](https://github.com/occult-kranti/ANDOLAN),
development branch `game/yuga-hanuman-trial`, commit
`9e59880f31452ce0df8d326cd4f1291b700dc228`, read on 26 November 2026.
The default `main` branch and download/distribution branches do not identify the
latest Yuga development source. [source-evidence.json](source-evidence.json)
contains eleven exact source paths, their SHA-256 digests and pinned GitHub URLs.

| Surface | Source and current boundary |
| --- | --- |
| Current Confluence simulation | `games/yuga-rust`, Rust and WebAssembly authority |
| Current graphical match | PlayCanvas browser client; private hero-only Confluence matches |
| Ember Rite | Four authored JSON maps, Blender massing and a solo rehearsal; isolated ritual rules still need gameplay/network integration |
| Native comparison | `games/yuga-native/project.godot`, Godot 4.6 Forward+; the handbook records Godot 4.6.3 |
| Blender | Editable sources, portable GLB exports and offline render/reimport checks |
| Unreal | Separate proposed import/render experiment; no existing `.uproject` was found in the inspected source tree |

Read the current repository's `AGENTS.md` and `docs/START_HERE.md` before work.
The older build handbook contains historical 6v6 and native-package descriptions;
the latest source entry point takes precedence for the current 5v5 direction.
Preserve the existing Rust, Godot and browser work when adding an Unreal experiment.

## Company setup

Run the setup against the **current initialized native company state**, using one
workspace writer. Do not copy an old reconstructed workspace over a newer desktop,
VPS or cloud writer. The default command reads `company-state.json` directly and
does not initialize or migrate it.

From the Daftar repository root:

```sh
node projects/andolan-yuga-development/setup-company.mjs \
  --state-dir /absolute/current-user-data/company
```

The preview resolves the unique company whose repository URL is exactly
`occult-kranti/ANDOLAN`, preserving its ID and name. If none exists, it proposes
`andolan-yuga-development` with name `ANDOLAN / YUGA`. A conflicting ID or ambiguous
repository binding fails before mutation. When several existing companies have
the same repository, add `--company-id` with the intended current native ID.

With a current native binary and exclusive writer ownership, apply that plan:

```sh
node projects/andolan-yuga-development/setup-company.mjs \
  --state-dir /absolute/current-user-data/company \
  --apply \
  --report /absolute/private/new-andolan-setup-receipt.json
```

The default binary is `desktop-shell/native/atlas-core`; `--core` accepts another
explicit absolute path. Build the matching binary with
`node desktop-shell/scripts/build-native-core.mjs` when needed. The repository's
Rust lockfile and minimum supported toolchain remain authoritative.

Apply reuses the native company-kit importer. It adds missing definitions,
source-linked role instructions, dependency gates, office rooms and a whiteboard.
It preserves existing names, skills, progress, pauses, authority, budgets, jobs and
owner board edits. A rerun after successful setup is idempotent. Bootstrap roles
keep their existing names and identities; the role keys below describe their
company-specific responsibilities.

The receipt includes six **pending** `/v1/models/select` request bodies using the
actual resulting employee IDs. These are proposed next requests, not saved model
assignments. The model pool must first verify the installed model and digest.
An already-paused scope remains paused. No provider, download, model assignment,
creative dispatch, authority grant, budget change, schedule or worker start is
performed by this command.

## Team responsibilities

Ten reviewed role bindings reuse the six native office specialists and add four
specialists. Native company and department assistants are additional definitions;
the preview and receipt report their actual count. This is an ownership plan, not
ten simultaneous inference processes.

| Role key | Responsibility | First acceptance evidence |
| --- | --- | --- |
| `coordinator` | Source pin, dependency graph and exclusive file ownership | Current branch/HEAD and a bounded task contract |
| `layout-steward` | Existing company office, board and responsibility map | Owner edits retained; departments and desks bound |
| `evidence-curator` | Provenance, source links and accepted/failed evidence | Exact source and artifact digests with limits |
| `independent-qa` | Reopen candidate and challenge the main claim | Reproduction or an explicit failing gate |
| `release-steward` | Scoped commit, branch publication and handoff | Exact commit/branch URL and checks actually run |
| `moe-coder` | Bounded code patch using a verified coding model | One scoped job, test result and native receipt |
| `rust-authority` | Rust/WASM gameplay and network integration | Interaction, interrupt/reset and event-order checks |
| `blender-artist` | Original editable geometry, materials and exports | `.blend`, GLB, preview and reimport evidence |
| `map-engineer` | Topology, dry alternatives, scale and clearance | Analytic route checks followed by engine traversal |
| `unreal-engineer` | Separate Unreal scene import/render experiment | Actual selected engine/project, import and scale check |

Each role has a `prompt-<role-key>` knowledge record connected by the existing
company-kit binding mechanism. Daftar's worker selects that employee's scoped
contract; this setup does not replace global Donna instructions or grant access.

## Coding MoE profile

The reviewed first model is
[`qwen3-coder:30b-a3b-q4_K_M`](https://ollama.com/library/qwen3-coder:30b-a3b-q4_K_M),
with [upstream Qwen metadata](https://huggingface.co/Qwen/Qwen3-Coder-30B-A3B-Instruct).
It is a text coding MoE with 30.5 billion total and 3.3 billion active parameters,
Q4_K_M quantization and Apache-2.0 licensing. Active parameters describe work per
token; they do not mean only that fraction of the model must be stored.

The published download is about 19 GB. Daftar's catalog admission ceiling is
24 GiB, and the first context profile is 8,192 tokens including prompt and output.
Use one inference request at a time, initially at most 1,024 output tokens, and
measure the actual fit and result. The short alias `qwen3-coder:30b` is intentionally
not admitted. [profile.json](profile.json) records this profile and its pending
runtime state.

A 48 GB GPU worker provides useful memory headroom for this model and creative
tests. A 32 GB worker is a sequential-use trial to measure. The artifact size is
not a VRAM measurement: context caches, runtime workspace, render textures and
engine allocations need their own allowance. When sharing one GPU, unload the
model before a large Blender or Unreal job. Company staff count does not establish
inference concurrency, and department routing does not train MoE weights.

## Map and creative workflow

The Route Lab is original procedural geometry: a 48 × 56 m ground, three suggested
routes, ten spawn markers and one central objective. It follows the inspected
Yuga convention: plan +X east/+Z north, Blender +X east/+Y north/+Z up, GLB +X
east/+Y up/−Z north. The objective radius is 3 m; the 1.5 m apron gives a 4.5 m
clearance radius from the centre.

Reopen the exact package before adapting it:

```sh
blender -b --factory-startup -t 2 --python-exit-code 1 \
  --python projects/andolan-yuga-development/map-blockout/verify_route_lab.py
```

The package includes actual CPU Blender render and GLB reimport evidence. It has
not been promoted into the game. Materials, collision, navigation, hero/controller
clearance, camera views, human balance and network authority need host-engine
checks. The authored Mandala/Lanka/Ayodhya/Kurukshetra maps retain their own source
and acceptance gates.

The companion ANDOLAN development branch adds a portable copy under
`games/yuga-native/art/daftar-route-lab/` and a focused task workspace under
`tools/daftar-development/`. Use the exact branch/commit from the final handoff.
For Unreal, use Daftar's existing creative import/validation boundary with an
owner-selected `.uproject` and installed engine; a static manifest check is not
an editor import, render or gameplay test.

## Verification and next live gate

```sh
node --test projects/andolan-yuga-development/setup-company.test.mjs
```

The six tests use the actual native binary in disposable synthetic workspaces.
They check real creation and repository binding, role prompt bindings, exact
pending model requests, no execution or authority changes, idempotence, retained
owner names and pauses, scope rejection, and read-only CLI preview followed by
an explicit native apply. They do not use or reconstruct the owner's state.

The next live gate is to connect the current owner runtime, inspect its current
company/model/creative inventory, apply this kit to that exact workspace, and run
one bounded code task plus a creative operation. Record the actual model digest,
memory, elapsed time, artifact hash and outcome. Keep the existing bounded
development allowance distinct from recurring instance or hosting authorization.

See [Yuga GPU Workbench and resource index](WORKBENCH.md) for the editor preflight, model boundaries, and five additive specialist roles.
