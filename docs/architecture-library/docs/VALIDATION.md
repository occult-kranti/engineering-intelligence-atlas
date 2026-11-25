# Architecture library verification record

Edition: **24 November 2026, America/New_York**. Actual engine and source retrieval records use UTC where stated. This record covers the architecture addition to the previously merged creative-tools backend.

## Verified corpus and artifacts

[The machine-readable catalog validation](../data/validation.json) records **62 building/place records, 30 elements, 14 original model studies, 22 tool/data entries, 16 audited claims and 150 primary sources**. All source IDs, sample element IDs, skill paths and artifact paths resolve. Historical intervals are ordered, signed and exclude year zero. There are nine regional groups and explicit uncertainty notes for every monument.

The validator checks exact model byte counts and SHA256 hashes, matching catalog/artifact provenance, current generator and preset hashes, PNG headers/dimensions, embedded GLB buffers, allowed relative paths and a bounded payload. It performs no live source requests and does not certify historical completeness, architectural accuracy or structural capacity.

## Real Blender execution

| Measure | Observed result |
| --- | ---: |
| Engine | Blender **4.5.17 LTS**, build `2f5ec98689b8` |
| Original studies generated | **14** |
| Indexed study artifacts | **56**: 14 Blender files, 14 GLBs, 14 PNGs, 14 metadata files |
| Indexed artifact bytes | **4,958,009** |
| Final generation/render/export time | **40.223 seconds** |
| Independent saved-file inspection | **14/14 passed**, **1.965 seconds** |
| Manifest hashes verified | **56/56** |
| Geometry per sample | **2–153 mesh objects**, **18–2,856 triangles** |
| Combined study triangle count | **16,300** |
| Preview settings | **384 × 384**, Cycles CPU, 12 samples, two threads |
| Bounds comparison tolerance | **0.0002 metres** |

The independent inspection reopened all Blender sources with automatic scripts disabled, checked for embedded scripts and linked libraries, parsed and reimported all GLBs, compared counts and bounds, checked finite nondegenerate geometry and decoded all previews. The exact receipts are [manifest.json](../samples/generated/manifest.json) and [inspection.json](../samples/generated/inspection.json). All delivered studies use original procedural meshes and materials, with no third-party textures, scans or map tiles.

The previews were inspected as a contact sheet. A timber roof cutaway was added to expose the bracket assembly; its intentional omission is documented. Root review also inspected the Gothic bay, timber frame and diagrid. These are checks of the delivered geometry and framing. They do not establish real-building stability or historical reconstruction accuracy.

## Offline footprint workflow

The separate GeoJSON exercise has an original synthetic fixture, explicit EPSG:4326/longitude-latitude input, declared local origin, metres, height fields, hash-bound rights/provenance and fixed geometry bounds. It supports Polygon/MultiPolygon parts and validated courtyard holes. It refuses overlapping/self-intersecting geometry, nonfinite values, invalid topology, missing permissions, changed source bytes, oversize files, symlink/traversal paths and existing output destinations.

The focused footprint suite passed **34 tests**, including delivered artifact, source-code and geometry identity checks. The actual Blender run produced four building meshes and an **88-triangle GLB**, with a model extent of approximately **133.434 × 88.956 × 18 metres**. The complete generated set occupies **193,616 bytes**. Its [build receipt](../geospatial/generated/build-receipt.json) records the actual Blender result, geometry counts, dimensions, local projection assumptions and output hashes. The synthetic input is independent of OSM, Google or any real parcel dataset. A caller-supplied ledger is an assertion to review, not an independent legal determination.

## Focused software checks

| Check | Executed result |
| --- | --- |
| Catalog/chronology/provenance tests | **7 passed** |
| Asset publication tests | **4 passed** |
| Static source identity tests | **3 passed** |
| Isolated DOM behavior | **18 checks passed**, zero network/provider calls |
| Sample generator/interchange safety | **9 tests passed** |
| Footprint geometry/rights/filesystem and delivered artifacts | **34 tests passed** |
| JS syntax and Git whitespace | Passed |

The pure DOM checks use fixture responses and do not establish browser rendering, CSS, native dialog focus or target-device behavior. Real Chromium acceptance is a separate GitHub CI gate. The gate checks desktop, 390 px and 320 px layouts; all five populated sections; source-linked record dialogs; search and empty results; region and overlapping-period filters; direct record and skip-anchor URLs; Escape; keyboard skip navigation; exact Blender/GLB download bytes; same-origin requests; no browser errors; and the catalog-failure recovery state. Screenshots and the observed result receipt are retained in the workflow's **architecture-library-ui** artifact.

CI runs the catalog, model-hash and importer checks before publication. The Pages workflow also runs the architecture browser gate on the built subpath. The exact commit's GitHub checks and artifacts provide remote execution evidence; this document does not claim that a browser was launched in the restricted local implementation environment.

## Independent review corrections

- The public copier now rejects retired or unexpected files before writing, and the final checker rejects extra published files. A removed source asset cannot silently remain in a later public build.
- Catalog source/element assignments must match the delivered model metadata. Generator and preset identities are checked rather than inferred from filenames.
- The keyboard skip link preserves the selected section. Direct or reloaded `#content` URLs still render the initial catalog.
- Source data is inserted as text; unsafe source URLs, sample traversal paths and external GLB resources are rejected.
- Both file identity and qualitative limitations stay attached to each sample. An original generic arch does not acquire a historical site's identity through a catalog label.

## Related backend acceptance

The creative-tools implementation was merged in [PR #7](https://github.com/occult-kranti/engineering-intelligence-atlas/pull/7), with all 12 validation jobs passing on its reviewed head. The retained [creative validation](../../../project/CREATIVE_VPS_VALIDATION_2026-11-24.md) records the actual native → stdio MCP → HTTP → Blender path, scoped permission revocation, durable restart replay, installed VS Code extension, containers and bounded backend stress.

That earlier stress run exercised **128 additional employees, 64 duplicate deliveries and 425 HTTP requests**, passing ten functional contention checks with zero provider calls. Architecture catalog checks supplement that evidence; they are not a new multi-hour production soak test.

## Remaining environment acceptance

The library and models are ready to serve from the repository or the published static atlas. No active owner-controlled VPS endpoint was supplied. The chosen VPS still needs installation and an actual small job under its intended runtime user, resource limits and native workspace. Unreal needs an authorized installation and an actual project import/validation run. Adobe needs the owner's licensed API/storage configuration and a separately reviewed live request. No paid host, paid map request, Photoshop call or game-engine account activation occurred in this architecture work.

Existing release 0.8.0 installers retain their original source identity. Use matching CI artifacts or build from the new source for these additions; the repository update does not retroactively change an old binary download.
