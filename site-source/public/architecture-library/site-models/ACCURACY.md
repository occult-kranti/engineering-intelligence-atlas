# Site-model accuracy and capture contract

**Current status: seven local source-derived models; zero independently verified metric models.** The goal is faithful, feature-level representation of the actual Giza pyramids, Kailasa at Ellora, and named church and mosque buildings. A recognizable silhouette or a dense mesh does not complete that goal. This contract states the evidence needed to qualify a model; it does not claim that the current assets already meet it.

Reviewed **2026-11-25**. [Machine-readable requirements](capture-requirements.json). Targets below are **proposed project acceptance targets**, not a published standard, source achievement, survey certificate, or guarantee. Implementation enforcement requires separate tests.

## 1. What “accurate” means here

**Metric accuracy** is agreement with independent reference measurements in a declared coordinate system, date and spatial scope. **Resolution** is the smallest real feature the observations can represent. **Density** counts points, vertices or triangles. **Texture resolution** concerns how much real surface each usable pixel samples; a large image can still contain blur, baked shadows or stretched detail. **Coverage** describes which surfaces and features were actually observed. These are different properties.

A mesh can contain millions of triangles, appear convincing, and still have unknown scale, distorted proportions or missing surfaces. Photogrammetry creates geometry from images; the method’s name alone does not establish control, calibration or error. Vertex RGB records source appearance, not necessarily calibrated albedo. Camera-relative coordinates, a glTF unit convention, or fitting the model to one published height do not independently verify real-world dimensions.

“Exact” must therefore become a finite requirement: named monument, identified features, capture epoch, permitted use, spatial extent, intended viewing distance, resolution, coverage and an agreed error tolerance. No finite capture proves mathematical exactness or reveals concealed construction.

## 2. Proposed project targets

These targets apply **only when acquisition and independent validation qualify the specified region**. A whole-site pass does not imply an ornament pass.

| Profile | Proposed 3D checkpoint P95 limit | Proposed maximum residual | Intended assessment scope |
|---|---:|---:|---|
| Whole-site layout | 50 mm (5 cm) | 100 mm | Declared site positions, major masses, levels and separated structures |
| Architectural features | 10 mm (1 cm) | 20 mm | Declared walls, openings, columns, steps, vaults and masonry interfaces |
| Individual ornament | 1 mm | 2 mm | A bounded directly captured relief or carving patch with suitable independent reference |

The 1 mm target is deliberately conditional. It requires appropriate calibrated close-range acquisition and reference uncertainty; a context mesh, ordinary video, or a source’s “high quality” label cannot meet it by assertion. Recommended planning allocation: reference/control uncertainty no larger than one third of the selected P95 target. This is a proposed budget allowance, not proof that the total error will pass. Record a revised agreed target if the permitted acquisition cannot support one of these levels; never silently label the original target achieved.

Resolution and coverage require separate feature tests. Define the smallest joint, moulding or relief to preserve; inspect cross-sections, edges and texture sampling at that scale. Do not manufacture additional subdivisions, displacement, sharp textures or ornament to appear more detailed than the observations.

## 3. Preserve archaeological state and identity

Use separate layers for:

- **Present capture:** directly observed fabric at a known or explicitly unknown capture date, including wear, breaches, unfinished stonework and restoration.
- **Historical reconstruction:** a source-supported original envelope or interpretation. Its cited dimensions and uncertainties belong to this layer.
- **Inferred fill:** hole repairs, interpolated surfaces or generated features, visibly distinct and excluded from observed-coverage claims.
- **Source reference:** unregistered fragments, incompatible-rights content and external view-only records.

For Giza, original casing baselines and surviving eroded masonry are different surfaces. The Dash/AERA footprint estimates extrapolate missing original corners; their confidence bounds cannot be transferred to an unrelated photogrammetry mesh. Keep Khufu, Khafre and Menkaure individually identified, with casing remnants, lower courses, openings and damage tied to actual observations. Unknown interiors or hypothetical hidden structures remain absent or explicitly hypothetical. [Giza measurements and source records](research/giza/measurements.json).

For Kailasa, retain the precise **Ellora Cave 16** identity. A carved panel from another Ellora cave is not a valid substitute. A candidate capture checklist should identify courtyard levels, entrances, pavilions, galleries, pillars, roof surfaces and individual reliefs, with the custodian/source confirming which features belong to each location. Feature names are not proof of scale or registration. [Kailasa evidence](research/kailasa/round-1-evidence.json).

The current church and mosque are **St. George Antiochian Orthodox Church, Montreal**, and **Islamic Center of Quebec — El Markaz Islami, Montreal**. Their geometry cannot stand in for a different named church or mosque. Preserve site identity when selecting additional examples. [Captured-site records](research/sacred-sites/sites.json).

## 4. Current evidence and missing inputs

The seven-model baseline comprises four Giza visual assets, one Kailasa context mesh, and two captured building exteriors. Detail fragments with a noncommercial license remain source-only and unregistered; they are not part of a complete assembled temple.

| Requested result | Available evidence | Missing before a full, high-detail, faithful result |
|---|---|---|
| Khufu, Khafre and Menkaure | Individual visual derivatives and a partial plateau model; separate archaeological measurement references | Controlled metric registration, independent checkpoints, source camera/capture provenance, full exterior/summit/base coverage, authorized interiors, and close-up masonry resolution |
| Kailasa, Cave 16 | Coarse context model and separately identified carving references | Whole-temple high-detail rights-compatible capture, levels/interiors/occlusions, verified fragment placement, compatible detail rights, scale and error evidence |
| St. George church | High-density exterior with captured RGB vertices | Survey datum/scale, checkpoint residuals, interior and roof/occlusion coverage, calibrated appearance where needed, and conversion-difference resolution |
| El Markaz Islami mosque | High-density exterior with captured RGB vertices | The same survey, completeness, appearance and conversion evidence, independently evaluated for this building |

The church source has **1,881,698 coloured vertices / 3,757,768 triangles**; the mosque has **1,554,546 / 3,104,134**. These are complexity counts, not accuracy ratings. The downloadable preserving GLBs retain every source triangle and exact source index sequence; their decoded Float32 accessors and compression checks are recorded in the [church receipt](evidence/st-george-antiochian-orthodox-church.json) and [mosque receipt](evidence/el-markaz-islami-mosque.json). Decimal OBJ coordinates are represented as Float32, so topology preservation is not exact decimal-number preservation or field accuracy.

The separate Blender inspection derivatives used for previews contain 11 and 12 fewer triangles respectively. Their distinct hashes and route are retained in the receipts and [baseline](capture-requirements.json); those derivatives are not the downloadable preserving GLBs. The removal cause remains unverified; repeated vertex indices within faces were ruled out. Kailasa likewise has 136,499 triangles in its published GLB and 136,498 in the preview import, a one-face difference explicitly disclosed in the viewer. Retain the original masters and distinguish each conversion route. [Source and import inspection records](research/sacred-sites/sites.json).

The Giza plateau inspection found a single 1024×1024 texture and clipped/holed peripheral coverage. Kailasa’s context inspection likewise records a 1024×1024 image; the separately captured carvings have more image detail but unknown registration. Neither constitutes complete stone-by-stone or carving-by-carving fidelity. The source dossiers contain the observations and limits: [Giza](research/giza/blender-inspection.json), [Kailasa](research/kailasa/round-1-evidence.json), [church and mosque](research/sacred-sites/README.md).

## 5. Required acquisition and processing record

Keep immutable original archives/meshes, photographs or point clouds where lawfully supplied, camera metadata, license notices and hashes. Preserve the raw coordinate frame. Working copies, color binding, coordinate conversion, cleanup, level-of-detail reduction and exported GLBs are derivatives with their own hashes. A checksum verifies byte identity, not field authenticity or accuracy.

The record must name physical units, axes, handedness, origin, horizontal and vertical datum or fully described local frame, capture date and condition. Capture permissions and component-specific reuse terms must cover the intended output. Public viewing and downloading do not automatically establish redistribution rights. Current noncommercial Cave-16 detail remains reference-only for the general reusable bundle until intended-use rights are resolved.

For every registration, record the input and output hash, frozen control set, software/version, fitted parameters and a forward/inverse transform with matrix convention. A similarity transform must state its scale provenance; a non-rigid deformation must be disclosed and may not conceal source distortion. Keep the original frame reproducible. Record topology changes, float precision, smoothing, deletion, hole filling, texture operations and any inferred geometry.

Maintain a feature inventory with region status: observed, partially observed, occluded, not captured, historically reconstructed, inferred fill, rights unavailable or identity unresolved. Record roof undersides, deep recesses, reflective/glazed surfaces, thin edges, interiors and inaccessible areas separately. State the denominator whenever presenting coverage percentages. Unknown coverage cannot be reported as 100%.

## 6. Independent checkpoints and error budget

Freeze the registration before evaluation. Held-out checkpoints must come from independent reference observations and must **not** have been used for fitting, ICP, scale estimation, calibration, correction or threshold tuning. Reusing the same published height both to scale and to “validate” a mesh is circular.

Proposed planning minimum: at least **20% of independently surveyed usable landmarks and at least 30 checkpoint observations** per claimed profile/assessment unit. Distribute them across footprint quadrants, height bands, separated parts and relevant feature classes; include weak regions. Counts alone are insufficient. A small ornament may instead require an independent higher-accuracy patch reference or calibrated artefact with equivalent spatial coverage and an explicitly justified protocol. Do not claim validation for unsampled regions.

For corresponding independent point i, use the 3D Euclidean residual `e_i = ||p_model,i - p_reference,i||` after the frozen transform. Report sample count, axis residuals, 3D RMSE, **P95**, and **maximum**, globally and by required spatial stratum. P95 uses the nearest-rank value at `ceil(0.95 × N)` in ascending order. Report surface-distance methodology separately for reliefs; nearest-surface distances alone can conceal tangential displacement.

Retain full-set statistics. Exclude an observation only for a documented independent cause, with the excluded point/region and before/after statistics preserved. Large errors cannot be removed simply to pass. A good global percentile does not qualify a failed or untested feature class. A P95 value from a small set is descriptive and must not be presented as a population-wide 95% confidence guarantee.

The error ledger includes reference uncertainty, calibration, image/laser observations, scale/datum registration, feature identification, time-state mismatch, meshing, numeric conversion and LOD reduction. State biases and dependence. Root-sum-square combination is appropriate only when its independence and distribution assumptions are justified; otherwise report a conservative bound or an unquantified contribution. Unknown is not zero. Independent end-to-end residuals remain necessary even when a budget predicts success.

## 7. Publication and acceptance

A **visual reference** may be presented with compatible rights, attribution, immutable provenance, explicit unknown scale and visible gaps. It must not expose unsupported metre measurements or surveyed-quality labels. The captured color and geometry may remain useful without passing metric acceptance.

A **metric-qualified region** additionally requires the agreed profile, complete required evidence, independent checkpoints, within-limit P95 and maximum results for required regions, a defensible uncertainty budget, resolution/coverage checks and an independent reviewer’s scoped decision. State what was accepted, its epoch and what remains unverified. No acceptance of one patch, site or derivative transfers automatically to another. Recheck simplified/exported geometry against its master before assigning it the master’s qualification.

Do not certify the current seven models, silently fill missing architecture, relabel unknown coordinate units as metres, register unplaced fragments by appearance, or equate a successful render with faithful historical reconstruction. The next implementation review must test the viewer’s labels, measurement gate, provenance display, external-reference behavior and derivative ledger against this contract.

## Applied guidance

This contract follows the repository’s [architecture and built-heritage research](../../../skills/architecture-and-built-heritage-research/SKILL.md) and [spatial 3D production engineering](../../../skills/spatial-3d-production-engineering/SKILL.md) skills. Primary-source URLs and actual inspection limits are retained in the three research dossiers above. No source licenses, historical measurements or proposed project targets were converted into professional certification.
