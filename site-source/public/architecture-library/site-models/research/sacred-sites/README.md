# Captured church and mosque source dossier

Reviewed 24 November 2026 (America/New_York); acquisition receipts record UTC 25 November.

## Acquired source masters

Both are actual exterior UAV photogrammetric reconstructions from the author-deposited [Heritage3DMtl academic dataset](https://zenodo.org/records/17063337). They are separate from the library’s original procedural teaching samples. The selected publication names Rucha Shende, Sudhir Mudur, Tiberiu Popa and Kaustubha Mendhurwar of Concordia University and declares CC BY 4.0 in its public record API. Its related [Concordia thesis](https://spectrum.library.concordia.ca/id/eprint/993780/) describes camera-pose estimation and reconstruction.

| Captured site | Coloured vertices | Triangles | Source OBJ bytes |
|---|---:|---:|---:|
| St. George Antiochian Orthodox Church, Montreal | 1,881,698 | 3,757,768 | 362,642,838 |
| Islamic Center of Quebec — El Markaz Islami, Montreal | 1,554,546 | 3,104,134 | 296,868,910 |

Original OBJ, alternative PLY, and camera JSON files are stored outside Git. `acquisition.json` contains exact public archive URLs, names, byte offsets, compressed lengths, ZIP CRC32 and the SHA256 of each acquired member. The recipe downloads six selected members, roughly200 MB including archive indexes; it does not fetch the raw photo collections. The full archive MD5 values identify the upstream releases; they were **not** verified against whole archives. Per-member CRC32, expanded size, source metadata pins and computed SHA256 were checked.

## Licence and attribution

[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) permits sharing and adaptation, including commercial use, subject to its terms. Preserve creator credit, source and licence links, and identify format conversion, colour binding, orientation or simplification. The record’s licence is asset-specific and does not replace this repository’s terms. Proposed attribution:

> Rucha Shende, Sudhir Mudur, Tiberiu Popa and Kaustubha Mendhurwar. Heritage3DMtl: An Open Multi-Modal UAV Dataset of Montreal’s Diverse Heritage Buildings. DOI 10.5281/zenodo.17063337. CC BY 4.0. Selected exterior meshes; conversion and display changes identified in derivative metadata.

## Coverage and accuracy limits

These masters record captured exteriors; they do not establish full interior coverage, hidden construction or a complete survey. The source OBJ positions and origins remain untouched. Physical units, gravity orientation, north, georeferencing and metric error are unverified. Source-coordinate extents must not be labelled metres. Polygon density is independent of geometric accuracy.

The Metashape OBJ files contain RGB for every vertex. They reference `st-george-church-model.mtl` / `16.mtl`, but those files and image textures do not occur in the source ZIP indexes. Existing vertex colour is usable; no texture map, calibrated albedo or PBR material is invented. The separate Meshroom-derived PLY files contain positions and normals but no colour attributes. They are different reconstruction variants, not LODs of the coloured OBJ.

## Reproduce the acquisition and checks

Requires Python3 standard library. Choose a new absolute output directory outside the repository:

```sh
python3 acquire_meshes.py --output /absolute/new/sacred-site-sources
python3 inspect_source_obj.py --input /absolute/new/sacred-site-sources/el-markaz-islami-mosque/mesh_metashape.obj --output /absolute/new/mosque-inspection.json
blender --background --factory-startup --disable-autoexec --threads 4 --python-exit-code 1 --python inspect_blender.py -- --input /absolute/new/sacred-site-sources/el-markaz-islami-mosque/mesh_metashape.obj --output /absolute/new/mosque-blender-check
```

`acquire_meshes.py` accepts only the two pinned academic archives, refuses an existing destination, requires exact HTTP206 ranges, validates local member names, bounds decompression and verifies member sizes/CRCs. It uses no login, contact submission, disabled-download extraction or paid API. Compare the resulting SHA256 values with `acquisition.json`. No executable file from either archive is run.

## Round 1 — real-time asset review

**Finding.** The library’s schematic studies cannot establish actual monument accuracy. Two reproducible captured-site masters are now available with an author-led provenance and commercial-reuse-compatible licence. Geometry and colour remain full detail; dimensions are not calibrated.

**Evidence.** Direct OBJ inspection validates finite positions/colours, positive face indices in bounds, all-triangle faces, source counts, CRC32 and SHA256. Blender 4.5.17 imports the source OBJ with identity object transforms and unchanged native coordinates. The strict source triangle-count equality gate FAILED: Blender removes 11 church faces and 12 mosque faces. Both raw OBJs contain zero faces with repeated vertex indices; the exact Blender repair/removal cause remains unverified. The converted inspection derivatives retain 3,757,757 / 3,104,122 triangles and require `COLOR_0` on every primitive. Raw OBJ masters remain unchanged; these GLBs are not described as identical masters. Preview material binds existing vertex colour; source masters remain untouched.

**Impact.** Preserve the acquisition originals as masters. Publish format-converted masters with provenance and, if needed, separately named display LODs. Never describe a decimated mesh as the full source master, or claim that visual detail proves metric accuracy. No runtime performance budget has yet been measured.

**Implementation change.** Integrate captured-site entries with explicit original/derived paths, source units and transform metadata, source/dependency hashes, author credit and coverage limits. Normalize only a display node with an invertible recorded transform. LOD generation must carry source hash, triangle count, tool/version/settings and a separate quality review.

**Round 2 acceptance.** Import each full-detail GLB into actual Godot, instantiate the packed scene, traverse every MeshInstance3D surface, verify triangle/colour counts and finite transformed bounds, and compare full-detail image/detail crops. Measure import time and target-device frame time separately. Godot’s [documented import LOD](https://docs.godotengine.org/en/stable/tutorials/3d/mesh_lod.html) can create a runtime derivative, but automatic simplification is not detail-preservation evidence. Confirm [glTF/Godot Y-up conventions](https://docs.godotengine.org/en/stable/tutorials/assets_pipeline/importing_3d_scenes/model_export_considerations.html) against recorded exporter transforms. Local Godot is installed; Unreal executable is absent, so Unreal acceptance remains untested.

**Licence-conflict rejection.** [Bibi-Khanym Mosque’s Zenodo mirror](https://zenodo.org/records/10267532) declares CC BY 4.0, but the [original Global Digital Heritage model](https://sketchfab.com/3d-models/bibi-khanym-mosque-samarkand-uzbekistan-dc8ec865fd0d480c8ae06196fd18d296) says CC Attribution-NonCommercial. No commercial-game claim or acquisition was made from that inconsistent chain. [YTU-CH3D](https://zenodo.org/records/13856669) is CC BY-NC4.0 and offers a 3.94 GB point-cloud archive; it was not acquired within this mesh-focused 500 MB budget.
