# Geospatial tools for the architecture library

Research snapshot: **2026-11-24 in the user's local date**. Sources were checked on **2026-11-25 UTC**. Prices, availability, compatibility and service terms should be checked again when selecting a real project.

**Recommended direction:** use explicitly reusable geographic data for assets that will be stored, edited, exported or shipped with a game. Use an approved streaming integration when a project needs licensed online city context. Build detailed architectural elements from measured, authored or appropriately licensed evidence.

This is a researched workflow catalog. It does not represent a purchased add-on, installed GIS stack, connected account, completed city import or licensed collection of external meshes. The machine-readable record is [tools.json](../data/tools.json); its citations resolve through [sources-tools.json](../data/sources-tools.json).

## 1. What the pasted claims establish

The exact seller was found: [Concept Studio's matching product page](https://conceptstudio3d.gumroad.com/l/concept-studio-osm) now uses the name **Blender City Importer**. The page displays **$49** and advertises **CONCEPT50** for 50% off. Redemption, tax and delivered software were not checked. Its [storefront](https://conceptstudio3d.gumroad.com/) advertises the other requested host applications as separate offerings. A listing verifies an offer; it does not establish tested feature parity.

| Pasted claim | Assessment | Practical implication |
| --- | --- | --- |
| Address/area selection, lighting and detail rings | Advertised by the [creator's demonstration](https://www.youtube.com/watch?v=dJkt79153fg); not independently exercised | Evaluate a small, permitted dataset before adopting the importer |
| Accurate georeferencing and scale | Coordinate handling is claimed; no survey-control test was performed | Record placement error separately from source-model accuracy |
| A city block in less than 60 seconds | Unverified benchmark | Require area, quality, machine, network, cache state and completion definition |
| Google supplies textured city geometry | Supported by [Google's description](https://developers.google.com/maps/documentation/tile/3d-tiles) | Visible roads in a mesh are not automatically a semantic road network |
| All terrain comes from Google 3D Tiles | Only describes one route; the [seller also lists SRTM](https://conceptstudio3d.gumroad.com/l/concept-studio-osm) | Keep mesh-source and elevation-source provenance distinct |
| Major cities covered; rural areas only 2D | Too absolute; [Google describes differentiated coverage](https://mapsplatform.google.com/maps-products/map-tiles/) | Verify the actual area instead of using an urban/rural assumption |
| Free Blosm is OSM-only | Incorrect: the [base listing includes Google and other 3D Tiles](https://prochitecture.gumroad.com/l/blender-osm) | Compare equivalent source modes |
| Personal/archviz use is generally exempt | Unsupported by the [applicable Google restrictions](https://cloud.google.com/maps-platform/terms) | Evaluate the real storage, display and distribution workflow |

The current Concept listing also advertises an additional photo-mesh source without an API key. Its provider and reuse rights were not established from the reviewed public copy. Treat that path as **unverified**. Lack of a key does not establish an open-data license.

The claim audit contains 16 individual records, including discount, platform-family, texture and heritage-license qualifications. “Verified” means the narrow statement in the assessment is supported; it is not an independent execution certificate.

## 2. Google content: the operational boundary

The [Google Maps Platform terms, §3.2.3](https://cloud.google.com/maps-platform/terms), restrict outside-service extraction, unauthorized caching and creating content from Google Maps content. The [service-specific agreement](https://cloud.google.com/maps-platform/terms/maps-service-terms) and the customer's actual agreement determine applicable permissions. Importer ownership, a working API key, glTF output or a GPL add-on does not replace those permissions.

The [Map Tiles policies](https://developers.google.com/maps/documentation/tile/policies) provide important implementation details:

- The service is for map visualization; offline and geodata-extraction uses are restricted.
- Respect applicable cache permissions and response headers. A renderer cache is not an unrestricted asset archive.
- Display Google Maps attribution and the relevant tile-provider credits; aggregate the credits for the tiles actually shown.
- Own 3D overlays must not be extracted, traced or otherwise derived from Google's tiles.
- The documented promotional-video allowance is narrow: at most 30 seconds, about application capabilities, marked promotional, attributed, without Street View or resale. It is not general approval for architectural film exports.

For this library, keep Google-backed work in a separately reviewed streaming project. Do not place its fetched meshes, textures or baked derivatives in the reusable asset collection without an express applicable permission. Attribution alone does not authorize extraction. Do not turn Google content into AI training or validation inputs; the [terms expressly address model use](https://cloud.google.com/maps-platform/terms).

A documented candidate for online visualization is [Cesium for Unreal's Google integration](https://cesium.com/learn/unreal/unreal-photorealistic-3d-tiles/). The [plugin is Apache-2.0](https://github.com/CesiumGS/cesium-unreal); that license covers the software, while service and content agreements remain separate. [OGC 3D Tiles](https://www.ogc.org/standards/3dtiles/) is an interoperable format, not a data-rights grant.

Regional availability matters. [Google's EEA guidance](https://developers.google.com/maps/comms/eea/map-tiles) says affected projects created after 8 July 2025, or no longer in the specified unmodified state, cannot obtain Photorealistic 3D or satellite 2D tiles. This is a billing-account/project rule, not simply where the artist is sitting. Google usage charges are also separate from an add-on's price; use the [current pricing table](https://developers.google.com/maps/billing-and-pricing/pricing) for an actual budget.

## 3. Choose tools by the deliverable

The most useful improvement is to make the intended output determine the data source.

| Intended result | Recommended starting route | Why it fits | Acceptance condition |
| --- | --- | --- | --- |
| Reusable city-block context | QGIS + OSM or a licensed municipal model, then BlenderGIS/Blosm | Editable source data and reproducible geographic preparation | Source/license record, valid footprint geometry, checked heights |
| Dutch city context with roof forms | 3DBAG, then format conversion | Published reusable building models at multiple city levels of detail | Attribution, change record and local quality checks |
| Detailed architectural library | Bonsai/IFC plus authored Blender components or permitted survey data | Semantic elements and explicit dimensions | Measurements, source references, assumptions and element IDs |
| Ornament or artifact reconstruction | Authorized photos/scans + Meshroom/PDAL + Blender cleanup | Close-range evidence supports local surface detail | Capture rights, scale/control checks and reviewed mesh |
| Licensed online real-world context | Cesium for Unreal with approved streaming datasets | Georeferencing and streamed detail | Actual provider agreement, credentials and visible credits |
| Offline game environment | Reusable GIS/terrain plus authored modular assets | Can be packaged under the selected source rights | Rights review plus engine performance and collision checks |

These are workflow recommendations, not claims that one source can satisfy every region or historical period.

### Blosm and BlenderGIS: use the correct mode

[Blosm's official repository](https://github.com/vvoovv/blosm) separates its base and Pro features. The base edition can be obtained without payment. Its OSM route builds geometry from mapped footprints and attributes. Its Google/3D Tiles route is a different source mode with different rights and availability.

[Pro documentation](https://github.com/vvoovv/blosm/wiki/Premium-Version) describes generic building materials, UVs and vegetation, and explicitly warns that these are not each building's real facade photographs. Baking capability is a technical operation, not a license extension.

[BlenderGIS](https://raw.githubusercontent.com/domlysz/BlenderGIS/master/README.md) is a useful bridge for reviewed local Shapefile, GeoTIFF DEM, raster and OSM XML inputs. Its online services have separate dependencies; the README notes OpenTopography's API-key requirement. Pin and test the actual Blender/add-on combination before introducing it into a worker image.

### QGIS, GDAL and PDAL: preprocessing before Blender

[QGIS Processing Executor](https://docs.qgis.org/3.44/en/docs/user_manual/processing/standalone.html) supports command-line algorithms and JSON input/output. [GDAL](https://gdal.org/en/stable/programs/index.html) handles raster/vector operations, while [PDAL](https://pdal.io/en/stable/about.html) provides point-cloud pipelines. These are suitable building blocks for repeatable preparation of approved local data.

Use a small, fixed sequence: inspect metadata, check geometry, crop the area, transform coordinates, verify extents and produce a compact interchange file. Keep the original source untouched. A metadata change that labels coordinates with another CRS is not the same operation as a coordinate transformation.

Their software licenses differ: [QGIS GPL](https://qgis.org/license/), [GDAL primarily MIT with dependency qualifications](https://gdal.org/en/stable/license.html), and [PDAL BSD](https://github.com/PDAL/PDAL/blob/master/LICENSE.txt). None assigns rights to the input survey, imagery or city model.

### Bonsai and IfcOpenShell: retain architectural meaning

[Bonsai](https://extensions.blender.org/add-ons/bonsai/) is the current name of the former BlenderBIM add-on. It authors native IFC. [IfcOpenShell](https://pypi.org/project/ifcopenshell/) supplies programmatic IFC tools; [IfcConvert](https://docs.ifcopenshell.org/ifcconvert/usage.html) exports GLB/OBJ and provides explicit unit and model-offset options.

Keep IFC as the semantic source when a project requires building-element identity or quantities. Use a derived GLB for rendering and interaction. Keep a mapping from IFC element IDs to game objects; a visually similar mesh does not preserve all IFC relationships by itself.

A proposed architectural component record should distinguish measured dimensions, published dimensions, inferred proportions and purely illustrative choices. A map-imported envelope should never silently become evidence for interior layout or construction detail.

## 4. Geographic and heritage sources worth using

| Source | Useful contribution | Rights and detail limits |
| --- | --- | --- |
| [OpenStreetMap](https://www.openstreetmap.org/copyright) | Footprints, mapped roads and selected building attributes | ODbL; completeness varies |
| [3DBAG](https://docs.3dbag.nl/en/) | Dutch building models at LoD1.2, LoD1.3 and LoD2.2 | [CC BY 4.0 with specified credit and change notice](https://docs.3dbag.nl/en/copyright/); not a global or interior dataset |
| [USGS 3DEP](https://data.usgs.gov/datacatalog/data/USGS%3A3a81321b-c153-416f-98b7-cc8e5f0e17c3) | U.S. elevation and LiDAR-backed terrain | Public-domain products; coverage, epoch and resolution vary |
| [Copernicus DEM](https://dataspace.copernicus.eu/explore-data/data-collections/copernicus-contributing-missions/collections-description/COP-DEM) | GLO-30/90 surface context | DSM includes surface objects; preserve the exact instance's [license notices](https://documentation.dataspace.copernicus.eu/APIs/SentinelHub/Data/DEM/resources/license/License-COPDEM-30.pdf) |
| [SRTM](https://www.usgs.gov/centers/eros/science/usgs-eros-archive-digital-elevation-shuttle-radar-topography-mission-srtm-1) | Broad terrain context at roughly 30m sampling | Near-global, not polar; 2000 acquisition and possible voids |
| [Google Research Open Buildings](https://sites.research.google/gr/open-buildings/) | Predicted regional footprints and confidence metadata | Separately offered under CC BY 4.0 or ODbL; not Google Maps tile extraction |
| [Smithsonian Open Access](https://www.si.edu/openaccess/faq) | Item-specific 3D artifacts, including GLB/OBJ | Use the exact CC0-marked asset; third-party rights may remain |
| [Open Heritage 3D](https://openheritage3d.org/faq) | Detailed site scans and photogrammetry with DOI metadata | Per-dataset Creative Commons terms; many disallow commercial use |
| [EOxCloudless](https://cloudless.eox.at/license-non-commercial) | Regional imagery backdrop | 2016 and later vintages have different licenses; [delivery terms also matter](https://cloudless.eox.at/documentation/faq) |

Do not infer architectural accuracy from image sharpness or numeric coordinate precision. A 30m elevation sample cannot establish a stair tread, column profile or window opening. A detailed scan may still have occluded areas or an uncertain scale.

For OSM, distinguish the database from a rendered Produced Work. [ODbL §§4.3–4.6](https://opendatacommons.org/licenses/odbl/1-0/) govern attribution, derivative databases and access obligations. The [OSMF guideline](https://osmfoundation.org/wiki/Licence/Community_Guidelines/Produced_Work_-_Guideline) explains why extractability and the published result matter. Do not simplify this into either “no obligations after mesh export” or “the entire game must become ODbL.” Keep the OSM-derived geographic layer identifiable so its obligations can be satisfied.

Open data also does not make every public endpoint a bulk-download service. The [OSMF tile policy](https://operations.osmfoundation.org/policies/tiles/) prohibits bulk downloading and prefetching its standard raster tiles. Use authorized data extracts or a suitable service instead of scraping a map display.

## 5. Repeatable workflows

### A. Exportable urban context

1. **Define the area and output.** Record the location, bounding geometry, target engine, viewing distance and whether distribution is commercial/offline.
2. **Select the source.** Prefer an explicitly reusable municipal model, OSM extract or project-owned survey. Add a licensed DEM/DTM for terrain. Record provider, dataset version, acquisition date and license before conversion.
3. **Prepare geography.** In QGIS/GDAL, inspect source CRS and vertical datum, crop, repair necessary geometry and choose a local metric coordinate frame. Store the transform back to geographic coordinates.
4. **Build context.** Use a reviewed local BlenderGIS or Blosm path. Carry measured heights separately from fallback heights. Flag guessed roofs and generic materials.
5. **Prepare the engine derivative.** Partition into manageable areas, create level-of-detail meshes, assign collision appropriate to gameplay and use licensed textures. Keep source IDs through export.
6. **Validate the result.** Check extents, units, offsets, missing data, triangle/material/texture budgets, seams and attribution. Publish only the approved derivative, with its provenance manifest.

The procedural choices in steps 4–6 are project work, not additional measured facts. Label them accordingly.

### B. Detailed architecture and heritage asset

1. **Choose the evidence.** Use your own measurements, a permitted drawing/model, a clearly licensed scan or authorized photographs. Record the exact object/site and relevant historical phase.
2. **Establish scale.** Use known lengths or control points. Record residual errors and unavailable evidence; do not call a visually plausible reconstruction a survey.
3. **Separate the model layers.** Maintain structural form, architectural components, ornament, material interpretation and modern reconstruction as distinct layers.
4. **Author or reconstruct.** Bonsai/IFC is appropriate for semantic building components. [Meshroom/AliceVision](https://github.com/alicevision/Meshroom) is a candidate for permitted photogrammetry; review the selected release and hardware/plugins before execution. PDAL supports scan preparation.
5. **Produce derivatives.** Preserve the high-detail source; derive manageable display meshes, UVs, texture maps and collision. Store artistic repairs separately from source evidence.
6. **Review and package.** Verify component dimensions and identifiers, compare reference views, include license/attribution and mark uncertainty. Keep an IFC or other source master alongside the engine-focused representation.

For a detailed library, build reusable families such as columns, capitals, arches, vaults, domes, stairs, roofs, windows and masonry modules. Each family should identify which parameters come from evidence and which are editable design choices. This is a recommended library structure, not a claim that these assets have already been modeled.

### C. Licensed streaming context

1. Choose a compatible renderer and the actual provider agreement.
2. Configure access and spending limits for the reviewed project.
3. Use the renderer's georeference and credit facilities; Cesium's [quickstart](https://cesium.com/learn/unreal/unreal-quickstart/) documents scene placement and sun/sky integration.
4. Keep authored foreground assets independently sourced and clearly attributed.
5. Test coverage, network failure, credentials, detail transitions and displayed credits. Preserve configuration and user-owned assets; do not turn the stream into a redistribution archive.

## 6. Acceptance record for a library asset

The following is a proposed review contract for future imported assets, not an implemented downloader:

| Field group | What to retain |
| --- | --- |
| Identity | Stable asset ID, source object/site ID, collection and historical phase |
| Provenance | Source URLs, publisher, retrieval date, dataset/version, acquisition date |
| Rights | Exact license, permitted use, attribution text, change notice, review status |
| Geography | Horizontal CRS, vertical datum, units, local origin and reversible transform |
| Evidence | Measured/published/inferred dimensions, accuracy statement and missing areas |
| Build | Tool/version, fixed operation/settings, input/output hashes, reproducible recipe |
| Asset quality | Geometry validity, scale checks, normals, UVs, material/texture counts |
| Engine use | Mesh detail budgets, collision choice, supported view distance and performance receipt |

A credible acceptance check is bounded and reproducible. For an importer-speed claim, report both first visible geometry and fully completed import, the selected extent, source, detail, downloaded bytes, machine, network and cache condition. For coordinate claims, compare independent control points and report placement and dimensional errors separately. No such Concept Studio benchmark was run for this research.

## 7. Automation status and integration boundary

In the JSON catalog:

- **supported** means the upstream project documents a suitable programmatic interface, such as QGIS Processing, GDAL, PDAL or IfcOpenShell.
- **manual_review** means acquisition, licensing, UI/configuration or project-specific validation still needs review.
- **unverified** means the relevant software/source or execution claim was not established.

These values do not mean “installed,” “connected,” “approved for every dataset,” or “available through Daftar MCP.”

The existing [creative service operation map](../../../headless-runtime/creative-tools.mjs) exposes bounded Blender inspection, rendering and GLB export, plus Unreal inspection/validation and other reviewed creative operations. It does not currently expose arbitrary GIS commands, tile downloading, provider credentials or a general Blender Python console. A future GIS adapter should accept approved project-relative files and fixed operations with limits and receipts. It should not accept arbitrary remote tile URLs, executable paths or shell arguments.

The useful immediate handoff is therefore: **select a permitted local source, prepare and validate it, then use the existing bounded creative operations for the authorized project**. Keep GIS adapter implementation and external dataset approval explicit rather than treating this research catalog as an installed capability.
