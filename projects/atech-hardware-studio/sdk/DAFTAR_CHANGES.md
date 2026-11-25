# Daftar hardware studio: SDK validation changes

This is a development copy of the official Atech `1.0.0a12` source distribution, with a bounded Daftar patch. It is not the hosted Atech application and is not an upstream release. The source archive, its SHA-256, original-file hashes and publication metadata are recorded in [UPSTREAM_PROVENANCE.json](UPSTREAM_PROVENANCE.json).

## What changed

The first improvement is the handoff between a person's idea, an agent-written `project.yaml`, and the firmware toolchain. Invalid configuration now fails before a build rather than silently changing the requested behavior.

| Input or operation | Observed upstream behavior | Daftar behavior |
| --- | --- | --- |
| `host_actions: "false"` | Accepted and set `host_actions` to `True` | Rejected with a field-specific message; use an unquoted YAML boolean |
| `swap_lines: "false"` | Accepted and set `swap_lines` to `True` | Rejected before adding the module |
| `feedback: 1` | Accepted as if it were a boolean | Rejected; only actual booleans or `auto` are accepted |
| `modules: 12` | Raised an uncaught `TypeError` | Reports that modules must be a list of mappings |
| `code: run my lamp` | Accepted and discarded the code | Rejected; code must have string-valued `globals`, `setup` or `loop` entries |
| A double-width screen on `[1, 2, 3]` | Accepted with no placement issues | Rejected because a double-width module requires exactly two ports |
| `atech validate --json` | Option unavailable | One versioned JSON result and a meaningful exit code |

Input checks also cover missing/invalid board IDs, ambiguous `port` plus `ports`, malformed module entries, non-string libraries or module paths, empty port lists, boolean/nested port values, and YAML syntax errors. Valid boolean values, empty optional collections and the existing text validation command remain supported.

Malformed YAML in an external `modules_path` manifest is also rejected through the JSON validation response, with the manifest path and available line/column context.

## Machine-readable validation

From an installed development copy:

```sh
atech validate path/to/project --json
```

From this source tree, with the normal Python dependencies available:

```sh
PYTHONPATH=src python3 -m atech.cli validate path/to/project --json
```

The command prints one JSON object on standard output. An accepted project returns exit code `0`; a rejected or unreadable project returns `1`. Argument-parser errors, such as an unknown command-line option, retain argparse's normal behavior.

The response has `schema_version`, `valid`, `project`, `board`, `issues`, `cautions` and `tips`. If the project cannot be loaded, `project` and `board` are `null`, and an `invalid_project` issue explains the error. Existing module cautions remain visible for successfully loaded projects. A caution is not evidence that the physical hardware has been inspected.

This command reads local project and catalog data. It does not compile firmware, install the ESP32 toolchain, open a serial connection, flash a board, or confirm that the physical modules match the configuration. It is suitable for a Donna work item or a blueprint-side validation card; that integration has not been implemented in this SDK patch.

## Verification recorded on November 24, 2026

Run the targeted regression suite from this directory:

```sh
PYTHONPATH=src PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s tests -v
```

**17 tests passed**, with subcases for malformed input and JSON rejection responses, including malformed external module YAML. Tests use temporary projects and assert that validation leaves their files unchanged. Compiler execution, serial opening and URL downloads are patched to fail if reached during validation.

The verification environment was Python `3.12.14`, Pydantic `2.13.4`, PyYAML `6.0.3`, Jinja2 `3.1.6`, MarkupSafe `3.0.4` and pyserial `3.5`. Only the missing small Python dependencies were installed in a separate test directory; PlatformIO and the ESP32 compiler were not installed.

For compatibility, two valid projects were generated from both the untouched upstream source and the modified source. The button/light example produced 16 identical files; the reversed adjacent-port screen example produced 14 identical files. These were byte comparisons of generated source trees, not firmware compilation or hardware tests.

The upstream source distribution does not include its own test suite. These results cover the bounded patch and do not certify every SDK feature, the 3D viewer, simulation exporters, serial runtime or physical boards.

## Source and notices

PyPI and the package's `pyproject.toml`/`PKG-INFO` identify the SDK license as MIT. The downloaded source archive did not contain the advertised top-level `LICENSE` file. Original package metadata and the bundled Three.js license notice have been retained; no missing copyright statement has been invented.

The advertised GitHub repository returned 404 during this work, and a normal public clone required unavailable authentication. The reproducible starting point is therefore the official PyPI source archive recorded in the provenance file. Original upstream files can be checked against the recorded hashes to distinguish this patch from the published package.
