# Daftar Hardware Studio

A company project for turning hardware ideas into reviewable Atech SDK projects, with design, engineering and independent verification working around the same blueprint.

The working source is in [sdk/](sdk/). This increment improves the boundary between an agent-written `project.yaml` and the firmware toolchain: invalid configuration gets actionable feedback before a build, and `atech validate --json` provides a structured result for a future Donna canvas element.

## Source identity

| Item | Verified source |
| --- | --- |
| Product | [Atech](https://atech.dev/) |
| Open SDK package | [Atech 1.0.0a12 on PyPI](https://pypi.org/project/atech/1.0.0a12/) |
| Advertised upstream repository | `https://github.com/atechdotdev/python-sdk` — returned 404 during this work |
| Reproducible starting point | Official PyPI source distribution; SHA-256 `9c94191ca033af89a5773688c6b157691d14be5c1b134542c16a2cfacaf86fa9` |
| Local source record | [UPSTREAM_PROVENANCE.json](sdk/UPSTREAM_PROVENANCE.json), including hashes of all 157 original files |
| License evidence | Upstream package metadata says MIT; original metadata and bundled vendor notices are preserved. The published archive lacks its advertised top-level LICENSE file. |

This is a source-distribution import with a Daftar patch. It is not an upstream Git fork, an upstream release, or a copy of Atech's hosted AI application. The advertised upstream URL is kept as provenance, not presented as a working public checkout.

## Company and teams

The proposed company is **Daftar Hardware Studio**. [company-plan.json](company-plan.json) records the office, departments, roles and ownership plan. It is a declarative setup plan, not an executable migration or evidence that employees have been activated.

| Team | Ownership | Acceptance evidence |
| --- | --- | --- |
| Director and Donna | Scope, project brief, user intent, task ownership and handoffs | Named owner and next action for each roadmap item |
| Product design | Beginner workflow, readable errors, blueprint-side validation and assembly explanations | A user can identify the failing field and correct it without reading a traceback |
| SDK engineering | Configuration parsing, placement, CLI contracts and deterministic generation | Reproducible failure cases, regression tests and valid-project compatibility checks |
| Independent review | Negative cases, authority boundaries, source provenance and release claims | Separate review of raw failures and test outputs; no hardware-success claim from a local validation pass |

The company creation request is saved in Daftar's hosted command queue and awaits an explicit connected-desktop sync. Department and role provisioning remains planned until the native company exists. The software work in this repository is complete independently of that provisioning state.

## Blueprint interaction contract

Keep this company inside Daftar's endless conference-table canvas. Its components should be movable elements attached to the company blueprint:

1. **Idea brief:** goal, expected behavior, owned board, owned modules and actual connected ports. Unknown inventory stays unknown.
2. **Assembly blueprint:** board and module placement derived from the SDK catalog. Distinguish a planned assembly from inspected hardware.
3. **Validation card:** consume the versioned JSON result; show issues next to the relevant placement or field, retain cautions, and give the correction in plain language.
4. **Firmware artifact:** generated sources, source version, build status and evidence. A generated file is not a compiled or flashed device.
5. **Roadmap and ownership board:** each task has an owner, dependency, artifact and acceptance check. Donna can summarize and prepare work under the current scope.

The current patch implements the SDK validation contract. The canvas adapter, live hardware connection and production assistant integration remain roadmap items; no unimplemented interface is shown as functioning.

## Run the improved validation

With this development copy's normal Python dependencies available:

```sh
cd projects/atech-hardware-studio/sdk
PYTHONPATH=src python3 -m atech.cli validate /path/to/project --json
```

The command returns one versioned JSON object and exit code 0 or 1 for supported project validation. It reads project/catalog files and does not compile or flash. Argument-parser errors retain the normal CLI behavior.

For a new physical project, first confirm the actual board, modules and ports. Atech's first firmware build downloads its ESP32 toolchain (the official package describes approximately 2.4 GB on disk); offline builds require those dependencies to be cached. Additional module libraries can also require a first download. Physical-board behavior requires separate hardware validation.

## Roadmap

| Work item | Owner | State | Acceptance |
| --- | --- | --- | --- |
| Verify and preserve the published SDK source | SDK engineering | Complete | Official archive checksum and original-file hashes recorded |
| Reject malformed configuration before generation | SDK engineering | Complete | Focused regression suite and upstream reproductions recorded |
| Expose structured validation feedback | SDK engineering + product design | Complete | Versioned JSON, meaningful exit status, preserved cautions and controlled errors |
| Independently review negative paths | Independent review | Complete after the recorded patch review | Review finding and repair documented in the SDK change record |
| Materialize company and provision departments | Director | Awaiting desktop sync / subsequent setup | Company and role records observed in native state |
| Connect validation cards to the company blueprint | Product design + SDK engineering | Planned | UI displays real validator output and keeps errors attached to their objects |
| Compile and test a confirmed physical build | SDK engineering + independent review | Planned | Reproducible build log and actual board/module observations |

See [the SDK change record](sdk/DAFTAR_CHANGES.md) for precise behavior changes, test commands, environment and limits.
