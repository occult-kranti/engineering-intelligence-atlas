# Captured places: actual-site geometry

Open [the capture viewer](index.html) to inspect seven source-derived models of Giza, Kailasa at Ellora, St. George Antiochian Orthodox Church and El Markaz Islami Mosque. This collection extends the [historical library](../index.html); the fourteen earlier Blender studies remain explicitly schematic teaching models.

The new collection contains acquired geometry of the named places. **It is not a complete, survey-certified digital twin collection.** Physical units, independent error bounds and full coverage have not been established for these assets. The church and mosque have dense exterior geometry with captured vertex colour. The available Giza and Kailasa context sources have much weaker detail and coverage. No extra carvings, masonry or hidden interiors were generated to conceal that gap.

## Inspect a model

1. Choose a place. The preview is an actual Blender render, and the record lists source, license, density, modifications and limitations.
2. Select **Load 3D model**. The viewer downloads only that model, verifies its SHA256, checks that resources are embedded, and checks the decoded triangle count.
3. Orbit, zoom and pan. Switch between captured appearance, neutral geometry and wireframe to see what is actually in the surface. Buttons and keyboard controls provide an alternative to pointer gestures.
4. Open the original source and inspection evidence before drawing conclusions. Measurement tools are deliberately unavailable because physical scale is unverified.
5. Unload the model to release its graphics resources. Only one model is retained at a time. Dense assets can still exceed a particular device's memory or graphics capacity; the preview and downloads remain usable if WebGL is unavailable.

The renderer uses pinned, locally served Three.js and meshoptimizer modules. It does not contact a model provider, map service or remote CDN. Rendering occurs on interaction, with no automatic orbit animation. A successful browser render is not evidence of a target game's frame rate.

## Sources and fidelity

| Collection item | What is actually supplied | Principal limit |
|---|---|---|
| Giza plateau | Full geometry from the inspected public Objaverse GLB, attributed to pierre391 | Video-derived source; partial, holed terrain, coarse image, unverified scale and underlying footage rights |
| Khufu, Khafre, Menkaure | Three already processed visual derivatives from a pinned public repository, with original creator credits | Earlier simplification, levelling and rescaling; not original survey masters |
| Kailasa exterior context | Full geometry from the GSXNet/Graphic solutions source mirrored in Objaverse | Coarse texture and relief; interior coverage, scale, capture provenance and registration unverified |
| St. George Antiochian Orthodox Church | All source OBJ triangles and RGB position entries represented in a preserving GLB conversion | Exterior coverage; source units, colour calibration, interiors and independent metric error unknown |
| El Markaz Islami Mosque | All source OBJ triangles and RGB position entries represented in a preserving GLB conversion | The same unknowns, evaluated separately for this building |

The [catalog](catalog.json), [credits](ATTRIBUTION.md), [accuracy contract](ACCURACY.md), and individual research dossiers retain the detailed evidence. Polygon counts and byte hashes are technical observations. Neither proves field accuracy.

## Kailasa: actual detail sources

Arno Klein's four explicitly named Cave 16 GLBs were acquired and structurally inspected during research. They represent separate relief fragments with 4096-pixel images and a **CC BY-NC 4.0** license. The source filenames identify Cave 16; two ambiguously named files were not reassigned. One relief was imported and rendered, confirming a cropped panel rather than a whole temple. These fragments remain separate source references and are excluded from this public game-asset payload. Their positions relative to the exterior mesh have not been validated. [Original dataset](https://zenodo.org/records/22163078).

Sidhu's denser photogrammetry is publicly viewable but not downloadable under the inspected source state. iTek's Kailasa splat sample is view/evaluation material; its reuse policy and request process are separate from public viewing. The viewer links directly to those owners and does not rehost their assets. [Kailasa dossier](research/kailasa/README.md).

## Original masters and derivatives

The acquired church and mosque OBJ masters are approximately 363 MB and 297 MB. The public source archives remain the durable source location; the repository records exact member names, HTTP range acquisition, CRC32, byte counts and SHA256. The raw masters are not embedded three times in the static site. Reacquire them with the bounded recipe in [research/sacred-sites/acquire_meshes.py](research/sacred-sites/acquire_meshes.py) and [its acquisition receipt](research/sacred-sites/acquisition.json).

The source OBJ coordinates are decimal numbers. GLB stores position and colour accessors as Float32; the conversion records that precision change. It does not silently infer metres, fit a published building height, remove faces, decimate the mesh or synthesize textures. The source archive's referenced MTL files are absent; captured per-vertex RGB remains available. Colour-space calibration is not established.

Compression is checked by decoding and comparing every accessor byte, triangle/index count, texture byte and node transform against the precompression GLB document. This is **losslessness relative to the recorded GLB representation**, not a claim that decimal source numbers became exact Float32 values or that field observations are error-free.

The earlier Blender import route removed 11 church and 12 mosque faces. Repeated vertex indices were ruled out; the cause remains unverified. Those inspection derivatives and renders have separate receipts. The public preserving conversion avoids that import repair route. A future Blender/Godot import must be checked again; its importer can still change topology even when the public GLB is intact.

## Blender and Godot

The web files use `EXT_meshopt_compression`. Decode them before an importer that lacks this extension; do not rename a compressed file and assume compatibility. From the repository root:

```bash
npm --prefix integrations/heritage-assets ci --ignore-scripts
```

Use the exact build/decode commands in [the preserving pipeline](https://github.com/occult-kranti/engineering-intelligence-atlas/tree/main/integrations/heritage-assets) and the [Godot inspection project](https://github.com/occult-kranti/engineering-intelligence-atlas/tree/main/integrations/godot-heritage-review). Their receipts record the actual versions and import results. Keep the original source, decompressed derivative and engine-imported result distinct.

For Blender, import the decompressed GLB and retain the source frame and metadata. Save an editable `.blend` working copy only after examining importer differences. For Godot, use the supplied headless import/instantiation audit before making a game-ready derivative. Collision, navigation, lightmaps, gameplay scale and target-device budgets require separate work. **Unreal was not available for an actual import in this cloud environment.** The existing licensed Unreal adapter remains available for a configured installation; no Unreal result is fabricated here.

The Godot audit currently requires non-normalized Float32 `POSITION` accessors (`VEC3`, component type `5126`) after meshopt decoding. Its recorded actual engine checks cover **Kailasa context, St. George Antiochian Orthodox Church and El Markaz Islami Mosque**, with 14 gates passed for each. **Giza plateau** also has Float32 positions, but has no included Godot execution receipt; format eligibility does not establish an import pass.

**Khufu, Khafre and Menkaure** retain upstream normalized signed 16-bit positions (`5122`, `KHR_mesh_quantization`). The preserving decoder retains that quantization, so these three decoded derivatives remain outside the audit preflight and have **not been audited in Godot**. This is a limitation of the supplied audit, not proof of incompatibility with Godot. Keep their supplied geometry unchanged; a separately validated conversion or audit extension and fresh engine receipts would be needed to broaden that claim. For an eligible model, use the decompressed output's new SHA256 with `run-audit.mjs --expected-sha256`, as described in the [Godot input scope](https://github.com/occult-kranti/engineering-intelligence-atlas/tree/main/integrations/godot-heritage-review#input-eligibility-and-recorded-coverage).

## Coding and graphics team

The [OpenCodeGameStudios integration](https://github.com/occult-kranti/engineering-intelligence-atlas/tree/main/integrations/opencode-game-studios) supplies pinned project resources for art, design, programming, architecture, Godot and QA. It includes its own integrity gate and role map. The expert review covers source acquisition, asset specification, import auditing and performance distinctions. The [review ledger](https://github.com/occult-kranti/engineering-intelligence-atlas/tree/main/reports/heritage-panel-2026-11-24) records each completed round, reviewed artifact and finding; only recorded completed rounds count as delivered review.

Imported role definitions are guidance. They do not change Donna's ownership, create privileged employees or activate external MCP servers. Existing project and employee grants govern managed execution. An available local command is not proof of deployment to a separate VPS.

## What is needed for the requested extreme fidelity

For Giza and Kailasa, the next input is a rights-compatible high-resolution capture with documented scale, calibration, coverage and independent checks. Detailed carving scans need verified registration to the whole building. A complete model needs observed roofs, recesses and authorized interiors, with gaps retained where acquisition is unavailable. The [accuracy contract](ACCURACY.md) defines proposed site, architecture and ornament targets without claiming they have been achieved.

No generic map mesh, texture sharpening, subdivision or AI-generated ornament can substitute for those missing observations. The delivered pipeline is prepared to accept better source data while preserving its provenance and testing what survives each conversion.
