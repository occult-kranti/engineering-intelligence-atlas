# Source-preserving heritage asset pipeline

This offline pipeline converts reviewed colored triangle OBJ files and repackages embedded-resource GLBs. It retains every source vertex and face index, including faces an editor might remove. It does **not** establish survey accuracy, acquisition rights, completeness, engineering suitability or stone-by-stone fidelity.

The manifest contains seven licensed visual references. Noncommercial Arno Klein detail captures and view-only Sidhu/iTek scans are excluded. Source licenses and capture-provenance gaps remain attached to each asset; a CC label is not proof of all possible third-party permissions.

## Reassemble repository model sources

The three largest preserving GLBs (church, mosque and Giza plateau) are stored as
10 MiB-or-smaller source parts in `packed-models/`. The manifest records every part
and the original assembled byte count and SHA256. This is transport packaging,
not mesh simplification or a different geometry representation.

```sh
node scripts/materialize-heritage-models.mjs
```

Run that command from the repository root before standalone model tests. The
static build also runs it automatically and publishes ordinary complete GLBs.
The command checks existing outputs, rejects corrupted parts and reconstructs a
missing model through a temporary file; mismatched existing models require review.
Keep the manifest and all parts together in source control. The repeated generated
copies under `docs/` and `site-source/public/` are rebuilt for deployment.

## Reproduce the conversion

Node 20 or later is required. Dependencies are pinned: glTF Transform core/extensions 4.5.1, meshoptimizer 1.2.0 and Three.js 0.187.0.

```sh
npm ci --prefix integrations/heritage-assets
npm test --prefix integrations/heritage-assets
```

Original inputs are intentionally not stored in git. `acquisition-manifest.json` records their exact SHA256, byte size, creator, license, source record and download provenance. Its initial absolute paths describe the acquisition workspace, not a requirement to recreate that path.

1. Obtain the permitted source files from each `downloadUrl` or source record. The three small pyramid derivatives are pinned to a public repository commit. Giza plateau and Kailasa context have direct Zenodo mirrors. Keep originals and attribution unchanged.
2. The bounded sacred-site ZIP-range acquirer obtains two OBJ, two PLY and two SfM JSON members without requiring full archives:

   ```sh
   python3 projects/architecture-library/site-models/research/sacred-sites/acquire_meshes.py --output /absolute/new/sacred-site-sources
   ```

   It verifies selected-member sizes and CRC32. Its receipt provides member SHA256 values; it does **not** claim the full ZIP MD5 was checked. This pipeline uses `mesh_metashape.obj`, not the PLY reconstructions.
3. Copy the manifest and change each `path` to the corresponding original file's absolute path. Retain expected hashes, sizes, licenses and caveats. For example:

   ```python
   import json
   from pathlib import Path

   manifest = json.loads(Path("integrations/heritage-assets/acquisition-manifest.json").read_text())
   locations = json.loads(Path("/absolute/local-paths.json").read_text())
   # local-paths.json maps all seven stable asset IDs to actual absolute files.
   for asset in manifest["assets"]:
       asset["path"] = str(Path(locations[asset["id"]]).resolve(strict=True))
   Path("/absolute/local-manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
   ```

4. Build into a **new** directory:

   ```sh
   node --max-old-space-size=4096 integrations/heritage-assets/preserve.mjs build --manifest /absolute/local-manifest.json --output /absolute/new/heritage-built
   ```

The build rejects changed hashes, path symlinks, unsupported data, nonfinite coordinates, invalid indices and output overwrite. Each asset produces `<id>.glb`, `<id>.decompressed.glb` and `receipt.json`; the collection gets `build-receipt.json`. Failure leaves partial local work for review and does not publish it. Millions of triangles can require substantial memory even when transfer files are compressed.

## Decode a downloaded web GLB for Blender or Godot

You do **not** need original OBJ files. Obtain the published GLB's SHA256 from its catalog/receipt and run:

```sh
node integrations/heritage-assets/preserve.mjs decompress --input /absolute/downloaded-site.glb --output /absolute/new/site.decompressed.glb --sha256 EXPECTED_SHA256_FROM_RECEIPT
```

This verifies the downloaded bytes, decodes meshopt, verifies decoded accessors/indices/textures/transforms, and writes a new uncompressed GLB. It prints the output SHA256. Existing WebP textures and upstream quantization in the three processed pyramid models are preserved; decoding cannot restore information lost upstream.

For background Blender acceptance and a saved `.blend`:

```sh
/absolute/blender --background --factory-startup --disable-autoexec --python integrations/heritage-assets/blender-review.py -- --input /absolute/new/site.decompressed.glb --sha256 DECOMPRESSED_SHA256_PRINTED_ABOVE --output /absolute/new/blender-review
```

The helper requires a fresh background process, rejects meshopt/external-resource input and refuses an existing output directory. It saves `scene.blend` and reports actual triangle/vertex counts, color attributes and bounds. Bounds remain in unverified source units, with Blender's glTF axis convention applied.

Earlier Blender OBJ imports removed 11 church faces and 12 mosque faces; the cause was not established. Source files contain zero repeated-index triangles. Direct conversion retains **every** index and separately counts zero-area triangles at Float32 precision. These observations do not explain Blender's removals. The source-equivalent decompressed GLB remains the preservation artifact when an editor changes topology.

The sibling [Godot review harness](../godot-heritage-review/README.md) consumes decompressed GLBs and records actual engine acceptance separately. File generation alone does not establish engine compatibility.

## Exact preservation contract

The OBJ subset supports `v x y z r g b`, optional one-to-one `vn` normals, and positive vertex-only or `v//vn` triangle indices. UV records, quads, arbitrary separate normal indices and unsupported directives fail instead of being dropped or triangulated. Positions, colors, normals and indices retain source order. No centering, rotation, rescaling, decimation, welding, duplicate-face removal, normal regeneration or invented ornament occurs.

**Decimal-to-Float32 conversion is not lossless relative to original OBJ decimal strings.** Receipts report maximum/RMS error per axis, worst original token and a separate conservative Float64 parsing bound. Both dense datasets had maximum coordinate conversion error at most `5e-7` unverified source units; color error was at most `2.965e-8`, and normal component error at most `2.981e-8`. These are representation errors, not measured survey errors.

RGB numbers are retained without an inferred sRGB/linear conversion. An unlit, double-sided vertex-color material is supplied because referenced MTL files are absent. No UVs or texture maps are invented. Source color space and original material appearance remain unknown.

NodeIO uses `EXTMeshoptCompression.EncoderMethod.QUANTIZE` **without** the lossy `quantize()` transform or lossy filters. Every output is decoded and compared; option names alone are not evidence. The ordinary `TRIANGLES` codec may rotate index triples, so an adapter encodes each Uint32 triple as a lossless `ATTRIBUTES` element with 12-byte stride. Uint16 uses the exact `INDICES` sequence codec. Primitive drawing mode remains `TRIANGLES`. An independent Three.js fixture verifies decoding and exact index retention.

NodeIO can renumber accessor declarations; comparison follows mesh/primitive/semantic bindings, checking exact decoded bytes, component types and counts. It can also decompose matrices; the pipeline restores original JSON matrix/TRS fields exactly and checks node association/hierarchy. Embedded image bytes and checked material properties must match. Repacked GLB container bytes are expected to differ from originals.

Primary references: [Khronos EXT_meshopt_compression specification](https://github.com/KhronosGroup/glTF/blob/main/extensions/2.0/Vendor/EXT_meshopt_compression/README.md), [glTF Transform extension documentation](https://gltf-transform.dev/modules/extensions/classes/EXTMeshoptCompression), and pinned installed extension source.

## Actual outputs and reviewed size exception

| Asset | Source triangles retained | Web GLB bytes |
|---|---:|---:|
| Khufu processed context | 180,160 | 1,786,680 |
| Khafre processed context | 96,181 | 1,187,380 |
| Menkaure processed context | 146,089 | 3,075,716 |
| Kailasa context | 136,499 | 6,594,948 |
| Giza plateau | 1,163,285 | 20,918,772 |
| St George Antiochian Orthodox Church | 3,757,768 | 61,470,040 |
| El Markaz Islami Mosque | 3,104,134 | 49,140,024 |

Total: **144,173,560 bytes and 8,584,116 triangles**. Load one asset on demand; this is not one combined scene.

The two dense assets **miss the original 25 MiB goal**. Full preservation was prioritized under the moderator's explicit 64 MiB per-model / 160 MiB collection review limit. Receipts preserve both the missed target and accepted limit. These are delivery decisions, not device-performance certifications.

An exact `INDICES` experiment saved only 427,112 church bytes and 86,251 mosque bytes against the frozen codec. Outer gzip also missed the earlier 32 MiB limit. Neither experiment changed published model bytes. No geometry or normals were dropped to meet a budget.

## Receipt schema and applied guidance

All JSON uses `schemaVersion: 1`. Manifest `assets[]` include stable ID, format, local path, expected size/hash, creator, source/download URL, license, rights note, acquisition-record reference and reviewed size limit. Paths locate data; hashes establish content identity.

Receipts include `source`, conversion precision, compression settings, `sourceSnapshot` with per-binding hashes/counts, `preservation` equality flags, `output.web` and `output.blenderReady` filenames/sizes/hashes, original `sizeTarget`, reviewed `releaseBudget`, and bounded asset-audit checks. Equality concerns supplied data, not monument completeness or metric accuracy.

`applied-guidance.json` records the actual OpenCodeGameStudios revision and hashes for **asset-audit** and **asset-spec**. Applied checks cover per-asset specifications, naming, size, missing references, format, manifest references and evidence. The upstream art bible is absent and technical preferences remain an unconfigured template; the approved preservation brief governs. No other upstream skills, setup procedures or permission rules are claimed as executed.

For unchanged processed inputs, a receipt flag such as `noLossyFilters` describes this preserving pipeline adding no lossy filter. It does not assert that earlier upstream geometry was unquantized: the three pyramid derivatives retain their supplied quantized attributes and original compression choices, as recorded in `compression.processing`.
