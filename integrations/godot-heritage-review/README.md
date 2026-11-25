# Godot heritage import review

A reusable, isolated Godot 4 audit for an **uncompressed, embedded GLB** selected by the user. The project imports the file through `GLTFDocument`, generates a scene, packs it into `PackedScene`, instantiates it in the scene tree and examines every mesh surface. It does not normalize, repair, simplify, regenerate textures or replace the input.

Verified engine: **Godot 4.7.2 stable official**, build `ed1daf0bf`. The script targets Godot 4; other versions have not been certified by this evidence. Node.js 22 or newer is recommended. No npm dependency or editor plugin is required.

## Run

Choose an existing absolute input file and a **new absolute output directory**. Large files and Godot caches stay in that output directory; they are not committed with the harness.

```sh
node integrations/godot-heritage-review/run-audit.mjs \
  --input /absolute/asset.decompressed.glb \
  --output /absolute/new-godot-review \
  --godot /absolute/path/to/godot \
  --expected-sha256 SOURCE_GLB_SHA256
```

`--godot` defaults to `godot` on PATH. `--expected-sha256` is optional but recommended when reviewing a pinned conversion receipt. Without it, the audit still computes and records the input SHA256 and verifies that both the original file and copied input are unchanged afterward. The input and output-parent paths must be canonical; an existing output directory is refused. `--timeout-ms` accepts 1000–600000 milliseconds and defaults to 180000.

The result directory contains:

- `report.json`: input hash, direct-buffer expectations, observed engine scene, measurements, explicit pass/fail checks and limitations.
- `godot.log`: engine output for diagnosis, capped at 4 MiB.
- `project/`: runnable project copy, read-only copied input, manifest and engine receipt. The source file remains outside this project and is not rewritten.

The generated project can be rerun directly with `godot --headless --path /absolute/result/project --script res://audit.gd`; the wrapper is the supported path for a fresh audit and full original-file immutability checks. No downloaded executable or embedded user script is run.

## Checks and evidence boundaries

The Node preflight reads actual accessor data, rather than trusting declared bounds. It checks container lengths, bounded views/accessors, finite positions and colours, index bounds, primitive type, scene hierarchy and transforms. It computes active-scene instance counts and world bounds from all referenced positions. Each `POSITION` accessor must be a non-normalized Float32 `VEC3` (`componentType: 5126`). External buffers/images, compressed meshopt/Draco payloads, sparse accessors, animations, skins and non-triangle primitives are rejected. Decode a compressed web model using the preservation converter before this audit, then check its accessor format against this scope.

### Input eligibility and recorded coverage

Meshopt decoding removes the compression extension; it retains the supplied accessor component types and values. It does **not** dequantize the three processed pyramid derivatives into Float32 positions. The current collection has the following separate data and execution states:

| Models | Position format after meshopt decoding | Godot audit coverage |
|---|---|---|
| Kailasa context, St. George Antiochian Orthodox Church, El Markaz Islami Mosque | Non-normalized Float32 (`5126`) | Actual runtime import, packing and instantiation recorded in `evidence/`; 14 gates passed for each input |
| Giza plateau | Non-normalized Float32 (`5126`) | Position format is eligible; no Godot engine execution receipt is included for this model |
| Khufu, Khafre and Menkaure processed context derivatives | Normalized signed 16-bit positions (`5122`, `KHR_mesh_quantization`) | Outside the current preflight format; rejected before engine launch and not audited in Godot |

For an eligible asset, first run the [preservation converter's `decompress` command](../heritage-assets/README.md#decode-a-downloaded-web-glb-for-blender-or-godot) with the catalog's web-file SHA256, then pass the returned decompressed-file SHA256 to `run-audit.mjs --expected-sha256`. Every new model still needs its own successful audit receipt; eligibility does not imply execution or a pass.

The current harness cannot audit the three quantized pyramid derivatives merely by decoding or renaming their files. A separately reviewed conversion or preflight extension would require new preservation checks and actual engine evidence, while retaining the supplied masters. This input restriction belongs to this audit implementation; it is not a finding that Godot itself cannot import those models.

The engine receipt records each instantiated surface's vertex/index/triangle/colour counts, index hash and maximum index; finite coordinates and colours; local and global node matrices; and observed world-space bounds. The final gate compares aggregate counts, colour presence, indices, finite values and bounds against preflight expectations. Bounds allow a relative tolerance of 1e-5 for float arithmetic; the recorded tolerance is in input coordinate units. This does not establish surveyed metres or metric accuracy.

**Index hashes are observations, not an assertion that Godot retains source winding or index order. Colour counts and finite values do not establish colour-byte equivalence or visual fidelity.** Source-to-GLB byte/value preservation belongs to the preserving converter's receipt. This harness detects changed triangle counts and does not relabel a changed import as an identical source master.

The route is runtime `GLTFDocument` import, followed by `PackedScene.pack` and `instantiate`. It does not invoke the editor auto-LOD/cache pipeline. No camera frame is rendered. It does not measure FPS, frame time, GPU memory, collision, lightmap quality or a shipping-device performance budget.

## Measurements

Each engine run records GLB append time, scene generation/packing/instantiation time, inspection time and whole-process wall time. Godot tracked allocation usage and peak are reported separately from Linux VmRSS sampled every 50 ms. A sampled RSS maximum is a lower bound on process peak; it excludes the parent Node process and GPU memory. On systems without `/proc`, sampled RSS is `null`.

The committed `evidence/summary.json` binds its results to the audit source hashes and the reviewed GLB hashes. Full report copies are beside it. The three models were tested concurrently, so timing is descriptive of that run, not a standalone benchmark. Current validated counts are:

| Input | Vertices | Triangles | Result |
|---|---:|---:|---|
| Kailasa context preserving GLB | 273,390 | 136,499 | All 14 gates pass |
| St. George church preserving GLB | 1,881,698 | 3,757,768 | All 14 gates pass |
| El Markaz Islami mosque preserving GLB | 1,554,546 | 3,104,134 | All 14 gates pass |

The complete church and mosque source face counts survive this route. Earlier Blender imports dropped 11 church faces and 12 mosque faces; the reported reason is unresolved. Kailasa's preserving GLB retains 136,499 triangles while the earlier Blender-derived variant retained 136,498. These differences are not hidden by adjusted expectations.

## Reproducible tests

```sh
node --test integrations/godot-heritage-review/test/audit.test.mjs
GODOT_BIN=/absolute/path/to/godot node integrations/godot-heritage-review/test/smoke.mjs
```

The first command runs 11 dependency-free tests for instancing/transformed bounds, malformed inputs, non-finite data, invalid indices, external resources, compressed input, triangle-loss detection, hash pinning, overwrite refusal and a missing-engine failure receipt. The second launches actual Godot on a generated two-instance RGB triangle fixture and verifies all 14 gates, then removes its temporary files. An unavailable engine is a failure, never a passing skip.

## Selected source guidance

`source-use.json` records the actual OpenCode Game Studios upstream commit, selected-file SHA256 values and applied guidance. The Godot-specialist and perf-profile material informed version checks, typed scene handling, cleanup and the distinction between measured import costs and unmeasured runtime performance. No upstream instructions were installed as runtime authority.

Official API references:

- https://docs.godotengine.org/en/stable/classes/class_gltfdocument.html
- https://docs.godotengine.org/en/stable/classes/class_mesh.html
- https://docs.godotengine.org/en/stable/classes/class_os.html

Asset provenance and licence terms are separate from the harness. Church/mosque acquisition evidence resides in `projects/architecture-library/site-models/research/sacred-sites/`; the original meshes remain outside Git. Preserve their author credit and CC BY 4.0 terms when redistributing derivatives.
