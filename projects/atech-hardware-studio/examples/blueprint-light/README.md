# Blueprint light: a reproducible first hardware project

**Idea:** “Make a warm desk light that toggles when I press a button.”

This is a complete `project.yaml` recreation using the SDK's published board and module APIs. It starts with a declared sample inventory, validates locally, and generates firmware sources deterministically. It does not infer which hardware the user owns.

## Assembly plan

| Item | Sample placement | Source of compatibility |
| --- | --- | --- |
| Atech 14-Port board | Board ID `14port` | Bundled board catalog |
| Button | Port 1, instance `trigger` | One-port GPIO module; `wasPressed()` consumes one press edge |
| NeoPixel 3×3 light grid | Port 2, instance `light` | One-port GPIO module; `setAll()`, `clear()` and `show()` are its public API |

The SDK assigns pins from the board catalog. The recipe contains no hand-written GPIO numbers. Startup stages and displays an off state; each button press toggles the warm color. The recipe keeps the driver's default brightness cap. `feedback: false` preserves the explicit button logic, and `host_actions: false` leaves this example controlled by that button rather than serial actions.

Before adapting this to a device, confirm its board, module revisions and actual ports. A successful placement check does not inspect connected hardware or prove the intended physical behavior.

## Validate and reproduce

From `projects/atech-hardware-studio/`, with the SDK's normal Python dependencies available:

```sh
PYTHONPATH=sdk/src python3 -m atech.cli validate examples/blueprint-light --json
PYTHONDONTWRITEBYTECODE=1 python3 examples/blueprint-light/verify.py
```

The first command validates the recipe and emits one JSON result. The second checks that result, generates sources twice in temporary directories, compares every generated file, verifies the input was unchanged, and compares against [verification.json](verification.json). It blocks compiler subprocesses, serial opening and supported network-call paths during the check. No ESP32 toolchain is needed for these operations.

The receipt records hashes of the recipe, the relevant SDK/catalog sources, and the generated source files. Changing a reviewed source or output makes the check fail until the change is reviewed and the receipt is deliberately replaced with `--record`.

To write a source tree for inspection, use the local SDK API:

```sh
PYTHONPATH=sdk/src python3 -c 'from atech import Project; Project.load("examples/blueprint-light").generate("/tmp/daftar-blueprint-light")'
```

The output is a generated PlatformIO source project. Compilation and flashing are separate steps; neither has been performed for this example. The first compilation can require the external toolchain and pinned module-library downloads described in the SDK documentation.

## Company ownership

| Owner | Deliverable | Acceptance state |
| --- | --- | --- |
| Product design | Idea brief, expected startup/toggle behavior, assembly labels | Written and linked to actual module APIs |
| SDK engineering | Recipe and deterministic source-generation path | Local validation and two generated trees verified |
| Independent verification | Input preservation, repeatability and honest evidence labels | Recorded receipt and action guards pass |
| Director / Donna | Confirm actual inventory and authorize the next physical-work scope | Pending real device inventory; this example grants no authority |

The example is ready to become an idea brief, assembly plan and validation card on the company's blueprint. That canvas adapter and physical-device validation remain separate work items.
