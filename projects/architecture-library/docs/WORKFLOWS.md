# From architectural evidence to an executable project

## 1. Choose the intended deliverable

Start by naming the output: a teaching model, original game environment, measured survey, licensed city visualization, historical reconstruction, BIM coordination model or render. The same source is not necessarily suitable for all of them. Define the target engine, units, expected precision, area, geometry budget, texture budget and rights to the delivered files.

For this repository's shipped studies, the answer is **original teaching geometry with simple materials**. The source models and GLBs can be reviewed before any tool job runs. No Google city dataset or paid add-on is required to open them.

## 2. Route the work through the existing team

| Responsibility | Existing role / skill | Concrete output |
| --- | --- | --- |
| Scope and ownership | Donna and the existing company hierarchy | Selected company, project, accountable employee and bounded task. |
| Historical research | `design-architecture`; `architecture-and-built-heritage-research` | Site/phase record, primary-source IDs, uncertainty and rights notes. |
| Geometry and interchange | Graphics lead / Blender artist; `spatial-3d-production-engineering` | Original geometry, units, local origin, counts, Blender and GLB files. |
| Game integration | Unreal engineer; `game-reconstruction-engineering` for its provenance and validation procedures | Reviewed engine import, scale, collision, materials and performance receipt. |
| Verification | Creative QA and the existing QA role | Source/asset identity, rendered evidence, actual checks and remaining limits. |

These role labels describe responsibility. Actual execution still uses the native company/department assignment, a current scoped `creative.execute` grant, the approved project and the tool assignment. A bibliography entry, a skill path or a saved task packet does not create an executable grant.

The task example at `company/role-library/examples/architecture-library-task.json` is synthetic and has a zero external-provider budget. It is useful for drafting a local review. Bind real IDs and current native state before a live operation. Reuse existing specialists; do not create duplicate permanent assistants merely to add a library reference.

## 3. Prepare the project on a VPS

Use the existing [creative deployment pack](../../../deploy/creative/README.md) for the verified official Blender installer, systemd/Compose configuration, private state directory and engine paths. Keep the reviewed Git checkout accessible to the unprivileged runtime account. Put private control credentials and creative configuration outside the repository.

For a new approved project, the [company setup helper](../../../integrations/creative-tools/README.md) binds an existing repository to graphics, game engineering and QA staff. Its preview is read-only. Applying it requires stopped writer ownership; it preserves existing paused staff, removed assignments and revoked/expired grants. Review the actual IDs returned rather than assuming that the synthetic example IDs exist.

Set the project root to the reviewed repository checkout, or copy only the selected reviewed sample into a smaller managed project root. If the repository root is the approved project, the first sample path can be:

```text
projects/architecture-library/samples/generated/arch-barrel-vault/sample.blend
```

Keep output jobs in the private managed state directory; the source library remains an immutable input. A GPU is optional for these tiny CPU samples. An Unreal Editor, large city, high-resolution textures or shader compilation needs separate host capacity and acceptance. Small successful renders do not establish an arbitrary city-block performance promise.

No active VPS target was supplied during this work session. The repository contains the setup and verified local runs; deploying it requires the actual current host, port and user through an existing authorized connection. No stale previously used host is probed, and no paid server is provisioned by these examples.

## 4. Run a supplied Blender file through MCP

Use the existing [runtime MCP adapter](../../../tools/DAFTAR_RUNTIME_MCP.md) over the private runtime connection. Its inventory tells you which executable and project operations are currently available.

1. Read `creative_inventory` for the real company and employee.
2. Use `creative_assign` to assign tool ID `blender` to that employee/project if required. Assignment metadata does not grant execution authority.
3. Submit a bounded operation with a unique stable receipt ID.
4. Inspect `creative_job` until its terminal status is `succeeded`, `failed`, `cancelled` or `interrupted`. Preserve the receipt and output hashes.

Example `creative_run` payload, after replacing identifiers with existing authorized records:

```json
{
  "id": "architecture-vault-render-001",
  "companyId": "YOUR_COMPANY_ID",
  "employeeId": "YOUR_BLENDER_ARTIST_ID",
  "projectId": "YOUR_APPROVED_PROJECT_ID",
  "operation": "blender.render",
  "input": {
    "path": "projects/architecture-library/samples/generated/arch-barrel-vault/sample.blend",
    "frame": 1,
    "width": 512,
    "height": 512,
    "samples": 16
  }
}
```

Use `blender.inspect` or `blender.export_glb` with only `input.path` for the other fixed Blender operations. The owner configuration controls allowed project roots, executable paths and limits. MCP callers do not supply arbitrary shell commands, engine flags, Python scripts or host directories.

If a response is lost, retain the same ID and body and inspect the saved receipt; do not generate a new ID to repeat an uncertain operation. Revoked authority, removed assignments and changed input/configuration identities are rechecked by the service. A queued or running job is not evidence of completed output.

The VS Code extension's Creative Tools command exposes the same inventory, assignments, operations and receipts through its private headless connection. Use its SecretStorage-backed credential flow. The library UI itself is a static reader, so opening it cannot start a tool job or spend a model budget.

## 5. Generate a new original study

The checked-in generator is a reviewed local tool, separate from the fixed MCP API. Start with the sample presets, keep parameters bounded and choose a new output directory. Use the exact Blender version in the validation receipt for a like-for-like comparison. The generator uses CPU rendering, a fixed seed, metre units and simple locally created materials.

Treat any customized script as code that must be reviewed before running it. Do not paste a source page's instructions into an execution adapter. After generation, inspect the `.blend`, verify the GLB, measure object/triangle counts and dimensions, and attach the per-artifact provenance and omissions. The sample generator and independent reopen procedure are described in [the sample guide](../samples/README.md).

For an original urban massing exercise, use the [synthetic GeoJSON example](../geospatial/README.md). It validates a hash-bound rights ledger, small geographic extent, finite coordinates, polygon topology, explicit height units and bounded geometry. It does not download maps or infer that a data license is valid merely because a caller wrote a permission flag. An owner-reviewed real dataset needs a truthful ledger and its own source terms.

## 6. Bring an asset into Unreal

Install or discover an authorized Unreal Linux build using the existing deployment pack. Epic account access, engine distribution and project plugins remain subject to their applicable agreements. This library does not provide an engine archive or bypass that access.

Import the sample `.glb` through the engine's supported glTF/Interchange path for the selected Unreal version. Check the exporter/importer version, metre-to-engine-unit conversion, orientation, normals, material appearance and bounds in the actual project. Rebuild collision intentionally; an architectural visualization mesh is not automatically good gameplay collision. Establish LOD and texture limits from the target hardware. Use a known-size object to verify scale instead of trusting a viewport impression.

The current runtime exposes `unreal.inspect` and `unreal.validate` against reviewed `.uproject` paths. It does **not** implement automatic arbitrary asset import, cooking, packaging, scene editing, remote-control exposure or plugin execution through MCP. Those need a separate reviewed engine-side adapter and actual-engine acceptance. The delivered GLBs make the handoff concrete without claiming a live Unreal run occurred in this session.

## 7. Select a real-world map or terrain workflow

| Deliverable | Suitable starting route | Required evidence before export |
| --- | --- | --- |
| Redistributable low-detail game context | Original geometry; OSM footprints; expressly reusable municipal models such as appropriately licensed 3DBAG assets | Dataset/version, license, attribution and applicable database obligations; measured completeness and height assumptions. |
| Detailed licensed visualization | Cesium or another supported renderer with the permitted tile provider | Current service terms, visible attribution, allowed display/capture use and account restrictions. |
| Terrain with a defined vertical reference | Reviewed DEM through QGIS/GDAL; LiDAR through PDAL when appropriate | Resolution, CRS, axis order, vertical datum, acquisition date, no-data handling and license. |
| Heritage object or monument model | Item-specific Smithsonian/Open Heritage or custodian-authorized source | Exact object's rights and fidelity; scan/reconstruction distinction; custodian context where relevant. |
| Editable BIM | Bonsai/IfcOpenShell with a project-specific IFC model | Model authorship, IFC schema, units, georeferencing, classification and coordination checks. |

See [GEOSPATIAL_TOOLS.md](GEOSPATIAL_TOOLS.md) and the tool registry for the actual primary references and qualified permissions. Do not extract, trace, store or redistribute Google content for an outside-service asset workflow merely because an importer exposes a save/export button. Its promotional-video exception is narrowly conditioned and does not settle a general archviz use case.

## 8. Adobe and open-format graphics

Use the existing licensed Photoshop API v2 adapter only for a configured project that permits the selected external upload and paid request. Inventory state `configured_unverified` does not prove remote authentication. Keep API credentials and presigned storage URLs private, and inspect receipts after an uncertain dispatch.

Inkscape, Krita and GIMP support separate open-source graphics workflows. They are not reverse-engineered Adobe product replacements with guaranteed PSD feature parity. Preserve editable source where possible, then review exported layers, fonts, color profiles, alpha and blend modes in the target application. The architecture studies use original simple materials and therefore need none of these external services to run.

## Acceptance packet

A complete handoff includes the selected record IDs and source IDs; model kind and omissions; units, axes and origin; the actual tool version; input/output hashes; object/triangle/texture budgets; rendered or engine inspection evidence; the exact executed checks; and the next owner for remaining work. Historical review, geometry review, rights review and target-engine performance are distinct forms of evidence. Keep the packet with the artifact so a later employee does not have to infer what was actually tested.
