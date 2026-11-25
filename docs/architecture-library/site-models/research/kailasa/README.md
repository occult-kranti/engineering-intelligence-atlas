# Kailasa Temple, Ellora — capture evidence and acquisition

**Expert 2 · Reality capture and 3D geometry · round 1 · checked 2026-11-25 UTC.**

## Decision

Actual source-published temple geometry and source-owner carving captures were acquired and inspected. **A complete, extreme-detail Kailasa reconstruction with verified commercial redistribution rights has not been obtained.** These assets must not be presented as a surveyed or complete digital twin. This dossier does not turn the earlier synthetic city-block example into a monument model.

[ASI identifies Kailasa as Cave 16](https://asi.nic.in/pages/WorldHeritageElloraCaves). Keep that identity distinct from the many other Hindu, Buddhist and Jain caves at Ellora. The author filenames, source records and local observations below establish different levels of evidence.

## Available assets and rights

| Candidate | Evidence and coverage | Rights and acquisition decision |
|---|---|---|
| [GSXNet / current Graphic solutions listing](https://sketchfab.com/3d-models/ellora-caves-india-1a5ec1e212f9451e80dc051e97164d17), mirrored in [Zenodo 10269303](https://zenodo.org/records/10269303) | Creator describes a scan; supplied thumbnail and actual local render show the temple/courtyard within surrounding cut rock. The record does not document capture date, camera, control points or an error report. | CC BY 4.0 appears in the record API, original listing and embedded file credit. Acquired unmodified 11.67 MB GLB. Preserve GSXNet credit and current source links. Underlying capture provenance and possible third-party rights remain unverified. |
| [Arno Klein photogrammetry archive](https://zenodo.org/records/22163078) | Source-owner archive has 21 GLBs, four filenames unambiguously beginning c 16_. These are individual relief/creature features, not the entire temple. | CC BY-NC 4.0 via [record API](https://zenodo.org/api/records/22163078). Acquired 165.81 MB ZIP for research. **Keep out of a commercial asset bundle and automatic public build.** No additional permission obtained. |
| [Sidhu photogrammetry viewer](https://sketchfab.com/3d-models/kailasa-temple-at-ellora-c2d066f668034e1c893480e7f9190824) | Creator-reported photogrammetry,, 2,, 940,, 225 triangles, published 2017-05-06. No survey/error evidence located. | [Public API](https://api.sketchfab.com/v3/models/c2d066f668034e1c893480e7f9190824) confirms download disabled and empty license. Source-viewer link only; no asset extraction. |
| [iTek public viewer](https://itek-media.com/gs/the_kailasa_temple/) and [OpusLab challenge viewer](https://arrival.space/opuslab_kailasatemple_3dgschallenge) | [June 2026 creator article](https://itek-media.com/xgrids-portalcam-india-kailasa-temple-3dgs/) reports 49 million splats,, 1.5 GBoptimized/33 GBraw. Density and performance are author claims, not independent metric validation. | [Owner samples policy](https://itek-media.com/samples/) permits viewing/evaluation and expressly withholds reuse rights. Download is request-gated. No contact, request, extraction or rehosting. |

A license on software, a viewer or a repository does not transfer rights in these scans. [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) requires credit, license link and change notices and does not warrant all necessary permissions. The noncommercial restriction on the Klein data must remain visible. Larger [Klein raw photography](https://zenodo.org/records/22136858) includes a 16.12 GB Hindu archive; it was not downloaded. The 1.02 GB OBJ archive also exceeds this task's 500 MB limit.

## What the acquired files actually contain

### Exterior context mesh

Original GLB SHA256: `bde3cb75d9fd68a355d5452d55b92b54b52d5aa7c15ba9c61a034392e59db807`.

The 11,, 670,, 764-byte GLB matched the published MD5, contains no external image/buffer URLs, and imported/rendered in Blender 4.5.17 LTS with automatic script execution disabled. Actual inspection found 5 mesh objects,, 136,, 498 triangles,, 273,, 390 vertex entries after glTF seam/material duplication, and one 1024×1024 image. The source listing's smaller vertex number is not used as the imported buffer count. An unlit texture conveys much of the surface appearance; it does not establish carved geometric detail.

The local preview visibly shows the temple's exterior arrangement and landscape crop, with soft detail. It does not establish the coverage of interior rooms or unseen facades. World bounds were 2586.2166×2583.7188×862.0963 **raw scene units**, with large embedded transforms. No claim of metre scale or correct north/georeference is justified. Do not rescale it to a remembered building dimension and call that a survey.

### Cave 16 detail captures

The ZIPSHA256 is `b196ed85582a99e954de71f45ea28ddf9d2d0aceea33f0ef4ce501ce21e50d35`; published MD5 matched. All 21 GLB members were inspected without executing asset code. Archive paths/symlinks, sizes, compression ratios, GLB headers/chunks and external references were checked before extracting only these four files:

| Original filename | Bytes | Triangles | Embedded images |
|---|---:|---:|---|
| `c16_floor2_saptamatrika.glb` | 7,, 646,, 656 | 52,, 735 | Three 4096×4096 JPEGs |
| `c16_floor2_figures-right-of-saptamatrika.glb` | 8,, 627,, 996 | 92,, 218 | Three 4096×4096 JPEGs |
| `c16_creature.glb` | 8,, 770,, 464 | 63,, 446 | Three 4096×4096 JPEGs |
| `c16_floor2_figures-left-of-saptamatrika.glb` | 8,, 602,, 080 | 74,, 372 | Three 4096×4096 JPEGs |

The Saptamatrika file also imported/rendered in Blender successfully: one mesh,, 32,, 041 vertex entries and 52,, 735 triangles. Visual inspection shows a bounded captured relief segment with real surface texture and cropped surroundings; it is not all seven figures or a completed wall. No missing ornament was fabricated, filled or procedurally replicated. The other three models received structural inspection only; they were not individually rendered.

The archive also contains `c1016_floor2_dancing-shiva.glb` and `c2016_floor2_little-dwarapala.glb`. Those names are ambiguous; they have **not** been silently corrected to Cave 16. Other files clearly reference Caves 21,, 29,, 32 and 33. None may be relabeled as Kailasa ornament simply because it looks compatible.

The title identifies the capture as 2023, while the record publication date is 2025-04-15 and deposit creation is 2026-08-29. These are distinct events. No camera calibration, survey control, metric accuracy, registered coordinate frame, capture-permit evidence or complete coverage report was supplied in the inspected record. File formats nominally using metre conventions do not verify the author's scale.

## Round 1 review and proposed acceptance

1. **Finding:** the small context model replaces generic massing with source-published site geometry, but fails the extreme-detail target. **Change:** optional context tier with attribution, source link and unknown-scale label. **Accept when:** the expected hash loads, a user can distinguish context from capture details, and measurements/survey claims remain disabled.
2. **Finding:** source-owner sculpture fragments provide captured ornament with restricted reuse. **Change:** separate research-reference records, preserving exact identity and licensing. **Accept when:** only the four explicit c 16_ members are linked, noncommercial status is prominent, and no automated commercial/public inclusion occurs.
3. **Finding:** the densest sources are not reusable downloads under this task. **Change:** retain source-owned viewer links and rights-unavailable states. **Accept when:** no iTek/Sidhu asset payload appears in the public build; triangle/splat counts never act as a rights or accuracy gate.
4. **Finding:** no acquired assets have verified registration or survey scale. **Change:** preserve unknown fields and require documented control before alignment. **Accept when:** sculpture fragments remain separate until registration is justified; LOD/texture compression is documented; gaps remain visible rather than invented as authentic geometry.

For round 2, inspect the revised app's model labels, source-specific download controls, license gates and exact payload hashes. For round 3, review the final rendered detail views and publication manifest against those gates. Root owns implementation, publication and termination; this baseline yields for those revised artifacts.

## Local handoff and limits

Raw assets and previews remain outside git under:

`/workspace/scratch/4a07ba7b19a1/architecture-acquisition/kailasa-2026-11-25/`

- `ellora-caves-1a5ec1e.glb` — original context mesh.
- `ellora-local-preview.png` and `ellora-model-inspection.json` — actual local verification.
- `klein-glb-cc-by-nc-4.zip` — untouched source archive, research only.
- `klein-cave16-research-only/` — four extracted explicitCave 16 GLBs, research only.
- `klein-saptamatrika-preview.png` and `klein-saptamatrika-blender-inspection.json` — actual local verification.

Repository deliverables are this dossier, `sources.json`, `round-1-evidence.json` and `archive-inventory.json`. The JSON contains full SHA256 values, exact counts, local paths, rights status, evidence scope and acceptance proposals. Only metadata is committed by the parent; no model redistributions are authorized by this report itself.

Known model/thumbnail network acquisition:178,, 052,, 986 bytes, plus small metadata pages; below 500 MB. External spend:$0. No paid purchases, accounts, requests to owners, disabled-download scraping, Google extraction or onsite survey. External public viewers were located but not browser-tested. Bounded OpenHeritage3Dsearch returned no identified Kailasa dataset; this is an evidence gap rather than proof that none exists. ASI'spage anchors monument identity, not the licensing or precision of the third-party files.
