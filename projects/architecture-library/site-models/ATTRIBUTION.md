# Captured-place credits and reuse record

The repository's software license does not replace the licenses of these geometry assets. Preserve creator, source, license link and modification disclosure with every derivative. Model availability, capture rights and technical game suitability are recorded separately.

## Heritage3DMtl church and mosque

**Creators:** Rucha Shende, Sudhir Mudur, Tiberiu Popa and Kaustubha Mendhurwar, Concordia University. **Dataset:** Heritage3DMtl: An Open Multi-Modal UAV Dataset of Montreal's Diverse Heritage Buildings, pinned record [10.5281/zenodo.17063337](https://zenodo.org/records/17063337). **License:** [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), confirmed in the record API.

Subjects: St. George Antiochian Orthodox Church, Montreal; Islamic Center of Quebec — El Markaz Islami, Montreal. The masters are the named archive members `mesh_metashape.obj`. All supplied triangles and RGB position entries are retained by the direct conversion. Decimal coordinates and colours are represented as Float32; glTF material binding and losslessly checked meshopt encoding are derivatives. No metric rescale, decimation, UV texture synthesis or gap filling was applied. See [the source and acquisition record](research/sacred-sites/source.json).

The 512px inspection previews come from separate Blender-imported derivatives. Their 11/12-face import differences are recorded. Those images are not evidence that every source face survived that Blender route.

## Giza plateau and Khafre

**Creator:** pierre391. **Original listing:** [Plateau de Gizeh](https://sketchfab.com/3d-models/plateau-de-gizeh-b30a5047bd1e4b28a10e438df2bc1428). **Declared license:** [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Full inspected GLB distribution: [Zenodo record 10313356](https://zenodo.org/records/10313356).

The plateau GLB was recompressed with decoded accessor, texture and transform equality checks; its original geometry was not decimated. The Khafre individual model is an earlier simplified, levelled and rescaled derivative distributed by George Philippou. Both trace to the credited creator's video-based photogrammetry. Underlying video rights and capture calibration have not been independently established. Retain that source-rights uncertainty in any commercial clearance decision; the declared model license alone does not resolve it.

## Khufu

**Creator:** ianicolo. **Original listing:** [The Great Pyramid of Cheops](https://sketchfab.com/3d-models/the-great-pyramid-of-cheops-4a251113722f4d969b6cf2ca5f35c502). **Declared license:** [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). The acquired file is an already simplified, levelled and rescaled derivative distributed by George Philippou. The original creator describes video-based photogrammetry; underlying footage rights and independent metric accuracy remain unverified.

## Menkaure

**Creator:** PolarNick239. **Original listing:** [Pyramid of Menkaure](https://sketchfab.com/3d-models/pyramid-of-menkaure-b03835b1723c4395a50d0a8c54861c6b). **Declared license:** [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). The creator reports perimeter photography using a Realme XT. The acquired model is an earlier simplified/rescaled derivative distributed by George Philippou, not the original photographic master or a calibrated survey.

The three individual pyramid derivatives retain their acquired file bytes. Distribution is pinned to [GeorgePhilippou/inside-the-pyramids at e89853b4351de608e908e30004d8c5860a0d83b5](https://github.com/GeorgePhilippou/inside-the-pyramids/tree/e89853b4351de608e908e30004d8c5860a0d83b5). See [the Giza evidence](research/giza/assets.json) for exact hashes, provenance and limitations.

## Kailasa exterior context

**Creator credit:** GSXNet / gsxn in the embedded model metadata; the current listing uses Graphic solutions. **Original listing:** [Ellora Caves](https://sketchfab.com/3d-models/ellora-caves-1a5ec1e212f9451e80dc051e97164d17). **Distribution:** [Zenodo 10269303](https://zenodo.org/records/10269303), through Objaverse. **License:** [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), recorded in the API and embedded attribution.

Changes: verified recompression only; source geometry, textures and node transforms are retained. This model is a coarse exterior context source. It is not the detailed model by Sikandar Sidhu, Arno Klein or iTek. Capture calibration, metric scale, interior coverage and exact capture epoch are unknown. [Kailasa evidence](research/kailasa/round-1-evidence.json).

## References excluded from the local game-asset payload

- **Arno Klein:** [Ellora photogrammetry](https://zenodo.org/records/22163078), copyright 2023, **CC BY-NC 4.0** according to the record API. Four explicit `c16_` GLBs were acquired for research inspection. Their bytes and derived preview are not in this public payload. Their coordinates are not registered to the context mesh.
- **Sikandar Sidhu:** [Kailasa at Ellora](https://sketchfab.com/3d-models/kailasa-temple-at-ellora-c2d066f668034e1c893480e7f9190824). Public viewer, download disabled and no reuse license in the inspected API. Link only.
- **iTek Media / OpusLab:** [Kailasa viewer](https://itek-media.com/gs/the_kailasa_temple/) and [sample policy](https://itek-media.com/samples/). Viewing/evaluation and download requests are not redistribution permission. Link only; no payload extraction or rehosting.

## Viewer software

- Three.js **0.187.0**, MIT: [local notice](vendor/THREE-LICENSE.md).
- meshoptimizer **1.2.0**, MIT: [local notice](vendor/MESHOPT-LICENSE.md).
- [Vendor manifest](vendor/manifest.json) records original and locally rewritten import-path hashes. No CDN or automatic update is used.
- OpenCodeGameStudios is separately pinned, with its root MIT notice and the conflicting ISC package metadata recorded in the project integration. It grants no rights to third-party meshes.
