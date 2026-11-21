# Validation and safety contract

## Contents

- Consequence tiers
- Evidence matrix
- Physical release gate
- Accessibility and security

## Consequence tiers

| Tier | Examples | Agent behavior |
|---|---|---|
| 0 — Read/analyze | Read files, metadata, documentation, hashes, previews | Allowed within scope; log actions |
| 1 — Reversible local draft | Generate source, mesh, scene, report, local preview | Preserve originals; validate and show diff/preview |
| 2 — External digital effect | Public deploy, upload, API write, message, repository change | Explicit approval, least privilege, target/data confirmation, rollback |
| 3 — Physical or high-consequence action | Printer/CNC motion, temperature, firmware, structural/safety release | Never auto-execute; qualified human approval and approved operating procedure required |

## Evidence matrix

| Artifact | Required checks | What remains unproven |
|---|---|---|
| Blender/scene/render | Visual review; asset provenance; geometry/material/light checks; export preview; target performance | Manufacturing correctness, physical strength, safety, or dimensional accuracy |
| Interactive 3D/XR | User tasks; device/browser matrix; frame/performance budget; input/ergonomics; reduced motion; 2D fallback; accessibility review | Universal usability or support on untested devices |
| Mesh/CAD | Units; bounds; coordinate frame; topology/manifold/winding; degeneracy/self-intersection strategy; tolerance; conversion report | Printability, fit, structural integrity, solver validity, manufacturing qualification |
| Slicer/toolpath | Target machine/profile/material; dry-run; layer/time/thermal/motion review; parameter provenance; rollback | Safe execution on every machine or material batch |
| Firmware | Hardware-specific review; thermal runaway/failsafes; signed/versioned config; test plan; recovery/rollback | Safe operation until approved bench/hardware validation completes |
| BIM/4D/5D | Units/CRS; IFC/schema; IDS requirements; element mappings; schedule/cost provenance; clash/issue review | Contractual, construction, cost, scheduling, or regulatory correctness without professional sign-off |

## Physical release gate

The agent may prepare a review package but must not operate equipment. A qualified human must confirm: target hardware identity; approved material/profile; mechanical/thermal/electrical safety; units/tolerances; machine configuration; dry-run/slice results; hazard controls; emergency stop/recovery; responsible operator; and authorization to execute. Any unexpected temperature, motion, network, or hardware behavior stops the task.

## Accessibility and security

Provide meaningful non-visual/2D alternatives for spatial content where the task requires broad access. Support keyboard/switch/controller alternatives as relevant; do not rely on color-only status; honor reduced motion and assess photosensitivity/ergonomics. Treat downloaded models/scripts/plugins as untrusted supply-chain content; scan and review without execution first. Do not expose printer, device, or XR telemetry controls to untrusted networks. Protect captures and user research data.
