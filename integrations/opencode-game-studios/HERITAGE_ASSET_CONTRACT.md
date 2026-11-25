# Monument capture and game asset contract

## Goal and truthfulness

The requested subjects are actual monuments: the pyramids at Giza, Kailasa Temple
at Ellora, individual churches and individual mosques. A generic pyramid, invented
temple or generated architectural image cannot substitute for those structures.
Detailed geometry must come from identifiable capture, measured drawings or
explicitly documented reconstruction. Texture sharpness, polygon count and visual
plausibility alone cannot establish dimensional or historical accuracy.

Preserve the best available source asset as an immutable master. Create separately
named derived assets for game engines, previews and experiments. Do not silently
overwrite the source with decimation, inferred detail, denoising or filled holes.

## Required task packet

The moderator supplies a packet like the following before an expert changes an
asset. This is a handoff template, not a completed evidence record:

```json
{
  "taskId": "heritage-site-explicit-identifier-round-1",
  "siteId": "exact-site-or-building-identifier",
  "round": 1,
  "artifactRevision": "commit-or-sha256-of-input",
  "ownedPaths": ["one-assigned-project-directory"],
  "goal": "Import the identified source capture and preserve its provenance",
  "sourceManifest": "path-to-reviewed-source-manifest.json",
  "sourceUnits": "unknown-until-evidenced",
  "allowedOperations": ["inspect-reviewed-local-capture", "create-derived-asset"],
  "acceptance": [
    "Report exact source hash, geometry counts and missing coverage",
    "Record every transform without claiming measured metres",
    "Open the result in the actual target tool and retain a bounded receipt"
  ],
  "limits": {
    "externalSpend": 0,
    "providerCalls": 0,
    "maxMinutes": 25,
    "maxToolCalls": 30
  }
}
```

Task packet operations describe work, not native executable permissions. Any
managed Blender operation still requires the current native scope and grant.
Runtime requests cannot supply arbitrary scripts, executable paths or arguments.
Actual engine import acceptance performed in a disposable local project must be
reported separately from a managed service operation.

## Source and rights record

Record the exact site, creator, source page, download endpoint, retrieval date,
source filename, size and SHA-256. Preserve the actual license text or source URL
and the attribution required by that license. Distinguish creator-declared license
from independently established rights for underlying photography or footage.

An embedding or public viewer is not a downloadable asset license. A successful
download is not proof of commercial permission. An official repository's software
license does not license third-party 3D content. Record noncommercial, evaluation,
permission-required and unresolved source restrictions explicitly. Do not copy a
viewer-only capture into a game distribution. Preserve attribution with derived
assets when the source license requires it.

For map, terrain and photogrammetry providers, record the terms for the actual
data product and use case. A paid add-on does not by itself establish permission
to redistribute the imported geometry. Verify current provider terms when an
asset is acquired or its intended use changes.

## Geometry, scale and uncertainty

The inspection record must include source coordinate bounds, vertex and triangle
counts, object count, normals, UV sets, materials, textures, vertex colors and
required compression/format extensions. State whether the source captures an
exterior, courtyard, roof, interior, detached sculpture or a partial region.

Preserve source coordinates and units until there is evidence for a transform.
A guessed unit, bounding-box fit or comparison to a web summary must not be
described as measured scale. If a visualization is normalized or grounded, retain
the source-to-display transform and the reason, and label display coordinates as
visualization coordinates. Georeferencing requires a stated coordinate reference
system, origin and supporting control; a location name alone is insufficient.

For a calibrated result, record control measurements, their sources, units and
uncertainty; transform method; held-out check measurements; and residual errors.
A single dimension can constrain uniform scale but cannot establish local surface
accuracy. Claims about millimetre or centimetre accuracy require appropriate
capture/control evidence and independent checks.

Identify gaps, clipped edges, softened carvings, occlusions, scan noise and texture
artifacts. If repairs are necessary for a game task, put them in a distinct named
mesh/material layer or derived asset and describe the method. Keep observed and
inferred content distinguishable. Do not use generative detail to claim that
missing carvings, inscriptions or structural features were captured.

## Required outputs and release gates

| Output | Required evidence | Reject or qualify when |
| --- | --- | --- |
| Source master | Original bytes, size, hash, creator and rights record | Source identity, license or provenance is unresolved |
| Inspected scene | Actual tool/version, counts, materials/colors, bounds and transforms | A preview is presented as a measured survey |
| Game asset | Derivation settings, output hash, import result, collision strategy and runtime budget | Fidelity loss or scale changes are unrecorded |
| Preview | Camera, view limitations and truthful caption | Missing regions or invented ornament are concealed |
| Release manifest | Attribution, permitted use, known limitations and exact files | Commercial permission is inferred from public visibility |

The geometry pipeline must preserve vertex colors when a capture has no texture
maps. Missing `.mtl` files are not permission to invent photoreal textures. Test
that the intended material/color path survives export and actual engine import.
If an importer cannot decode a required extension, create a documented compatible
derivative and keep both source and derivative hashes.

Budget CPU, memory, triangle count, texture bytes, artifact size and wall time for
the actual host. Retain a high-detail master and choose a separate measured runtime
profile. Quality zones or LODs are optimization choices, not a justification for
claiming absent detail. Report actual measured reductions and visual/geometric
differences; do not claim a performance speedup based only on lower polygon count.

The current managed Blender contract caps scenes at 10,000 objects and 2,000,000
mesh vertices, with bounded input, output and process memory. Large captures can
exceed those limits. Record that result and plan a reviewed derivative or appropriate
worker configuration; never silently bypass the existing authority or limits.

## Panel rounds and final claims

The heritage expert reviews site identification, chronology, measured claims and
uncertainty. The capture expert reviews provenance, geometry, materials and
derivation. The engine/performance expert checks actual import behavior and
bounded runtime cost. The coding/toolchain expert checks reproducibility,
integrity, path handling and permission boundaries. The moderator reconciles
conflicts and names the next exact artifact to change.

Every round references the previous artifact hash or commit, records concrete
changes and runs checks addressing the remaining risks. Round 3 can approve a
captured-reference library while still rejecting a survey-accurate or commercial
release label. The final report must distinguish:

- Source capture acquired and licensed as recorded.
- Tool invocation and import/export actually completed.
- Visible detail present, partial, damaged or absent.
- Scale/georeferencing calibrated or unknown.
- Runtime performance measured or untested.
- Use restrictions cleared, unresolved or incompatible with distribution.

The current source dossiers, not a generic framework skill, determine which of
these claims are supported for each monument.
