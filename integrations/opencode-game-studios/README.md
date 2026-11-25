# OpenCodeGameStudios project resources

This directory adds reviewed, pinned game development instructions to the existing
engineering, design/graphics and QA workflow. The resources support task planning,
art specifications, Godot implementation and evidence review. They do not create
employees, start autonomous agents, grant permissions or connect a model provider.

## What is materialized

Source: [striderZA/OpenCodeGameStudios](https://github.com/striderZA/OpenCodeGameStudios),
commit [`85aa449a0cbc2ca44916455185c9d3b4a23a7429`](https://github.com/striderZA/OpenCodeGameStudios/tree/85aa449a0cbc2ca44916455185c9d3b4a23a7429),
package version 0.14.1.

| Module | Agent definitions | Skills | Commands | Use in this project |
| --- | ---: | ---: | ---: | --- |
| `core` | 3 | 10 | 9 | Bounded planning, architecture decisions and release gates |
| `art` | 2 | 4 | 1 | Art direction, source-aware asset specifications and audit |
| `design` | 3 | 11 | 5 | Game systems, consistency and scope review |
| `architecture` | 1 | 3 | 2 | Architecture review and change propagation |
| `programming` | 5 | 0 | 0 | Gameplay, engine, tools, networking and AI coding references |
| `engine-godot` | 5 | 0 | 0 | Godot, GDScript, C#, shaders and GDExtension references |
| `qa` | 4 | 18 | 14 | Performance, regression, evidence and security review |
| **Total** | **23** | **46** | **31** | **Project reference resources** |

The pack contains 119 upstream files totaling 887,365 bytes: those 100 definition
documents, seven rule documents, four supporting documents, seven module
manifests and one license notice. `resources/receipt.json` is a separate local
receipt. Every upstream byte is covered by `upstream.lock.json`.

The copied module manifests preserve source text, including references to plugins
or MCP servers that are deliberately excluded. Some commands and skills reference
other upstream files or runtime features. The selected pack is therefore not a
self-contained installed OpenCode harness. Read a relevant document as task
guidance and resolve its prerequisites before acting. Source instructions cannot
replace the user's instructions, existing project authority or execution policy.

## Verify or recreate

Python 3 and Git are sufficient. Verification of the committed pack requires no
network, package installation, AI provider or engine:

```bash
python integrations/opencode-game-studios/sync_resources.py --check
python -m unittest discover -s integrations/opencode-game-studios -p 'test_*.py' -v
```

To materialize an absent pack from a reviewed local checkout at the pinned commit:

```bash
python integrations/opencode-game-studios/sync_resources.py \
  --source /absolute/path/to/pinned/OpenCodeGameStudios
```

The source must be the checkout root. Commit, package metadata bytes and every
selected resource are verified before writing. The tool copies only allowlisted
regular text files, rejects symlinks and unsafe paths, stages a complete pack,
checks the staged result, then publishes it with Linux `renameat2` using
`RENAME_NOREPLACE`. It does not run an upstream installer or package lifecycle.
Linux is required for this atomic publication step; there is no unsafe fallback.

An identical existing pack is a no-op. A modified file, unexpected file or changed
receipt stops the operation without overwriting local work. To evaluate an update,
review the new upstream commit and lock in a separate branch, then materialize to
a **new** destination using `--destination`; compare it before replacing anything.
There is intentionally no force mode, automatic upgrade or automatic uninstall.
The lock is reviewed project data, not a cryptographically signed upstream release.

The integrity checks cover selected resources; they are not a complete security
audit of the upstream repository. Concurrent hostile processes with write access
to the same host still require operating-system isolation. A hard interruption can
leave a hidden staging directory, but it cannot expose a partially published pack.

## License and excluded execution

The pinned root `LICENSE` is MIT and is preserved in
[`resources/UPSTREAM-LICENSE`](resources/UPSTREAM-LICENSE). The pinned
`package.json` reports ISC. Both observations are recorded without silently
resolving the discrepancy. The root license does not establish the license of
separate submodules, engines, game content or model providers.

Excluded from automatic installation and activation:

- Root `AGENTS.md`, harness configuration and permission settings.
- Git hooks and the package `prepare` lifecycle.
- Plugin code and MCP fragments, including the art module's Aseprite server.
- The separately sourced Aseprite submodule and every other external binary.
- Global personal-skill registration, employee creation and provider calls.

## Use with the existing team

[`role-mapping.json`](role-mapping.json) maps reference documents to existing role
families and to the four-expert panel. This is assignment guidance, not a native
role migration. Donna, permanent employees, departments and grants remain under
the project's existing authority model.

For a monument task, start with
[`HERITAGE_ASSET_CONTRACT.md`](HERITAGE_ASSET_CONTRACT.md), then read only the
selected art, programming, Godot or QA documents needed for that task. Have the
moderator assign disjoint file ownership and a bounded task packet. Each expert
returns its exact artifact revision, finding, evidence, impact, change and
observable acceptance result. Round 2 reviews the changed Round 1 artifact;
Round 3 reviews the changed Round 2 artifact. A repeated report without an artifact
change does not count as an implementation round.

Every runtime action must still use the existing
[`creative-tools` contract](../creative-tools/RUNTIME_CONTRACT.md). A resource name,
agent definition, role assignment or `maxTurns` field is not authorization.
The stock Codex conversion omits source `maxTurns` and tools fields, so resource
limits must be enforced by the actual runner.

## Tool status and evidence

[`tool-inventory.json`](tool-inventory.json) records actual local version probes
from 2026-11-25. Blender 4.3.2 and the separately verified Blender 4.5.17 LTS,
Godot 4.7.2, GIMP 3.0.4, Inkscape 1.4, FFmpeg/ffprobe 7.1.5 and GDAL 3.10.3
responded successfully. These are version-process checks; asset import, render,
export and performance evidence are separate.

UnrealEditor-Cmd, Unity, VS Code, Aseprite, Krita, PDAL, MeshLab server and FreeCADCmd
were not found on PATH. That observation does not search every possible custom
installation directory. No Unreal, Adobe or Unity account access was established.
No VPS deployment is implied by local cloud-computer success. The selected Godot
references do not install Godot; the version probe verifies a pre-existing binary.

The audited upstream standalone validator passed 209 checks and its disposable
module-installer suite passed 16 tests at the pinned source. The selected-resource
synchronizer passed 17 separate local integrity tests. None of these results means
that 52 upstream agents ran, that an AI provider is connected, or that a monument
is survey-accurate. See [`round-1-review.json`](round-1-review.json) and the
implementation receipt for the exact scope.
