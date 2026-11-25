# Evidence, chronology and interpretation

## Purpose and boundary

This library connects historical research to small, inspectable geometry studies and a modern production workflow. Its unit of evidence is a specific building or place, a specific phase, and an identified source. Its unit of modeling is an explicitly original teaching study. Those two units are linked by architectural ideas; a generic dome or tower does not become a reconstruction of a named monument.

The edition covers a representative range of regions, traditions, uses and engineering systems. It includes temples, churches, pyramids, mosques, funerary and civic spaces, infrastructure, towers, museums and large-span structures. Selection is intended to make comparisons possible. It is not a census of surviving architecture, a ranking of cultures, or a claim that a shared shape proves historical transmission.

## Why the timeline does not name a single first monument

“Monument” can mean a large communal structure, ritual enclosure, commemorative object, tomb, settlement defense, or later classified heritage site. Archaeological survival, excavation, dating and interpretation are uneven. An occupation layer can predate the visible structure by centuries or millennia. The earliest record in this collection marks the beginning of the selected evidence, not the beginning of human building.

The catalog therefore records the dated phase relevant to the structure being described. The history guide identifies the authority and uncertainty for early Göbekli Tepe and Jericho entries. It avoids using a settlement's earliest occupation as the date of every later monument there.

## Date representation

| Field | Meaning |
| --- | --- |
| `startYear`, `endYear` | Signed historical construction or observed-phase interval. Negative is BCE, positive is CE; zero is invalid. |
| `dateLabel` | Human-readable label retaining “circa,” centuries, phases or other qualifications. |
| `datePrecision` | `approximate`, `range` or `year`; a machine sorting hint, not a statistical confidence estimate. |
| `status` | Observed state: `extant`, `ruin`, `reconstructed`, `destroyed` or `under_construction`. |
| `uncertainties` | Phase boundaries, restoration, disputed dates, missing evidence and scope limits. |

An end date can describe a documented completion, opening or latest observed construction phase; the prose must say which. An active project uses an observed year at or before 2026. An announced future completion is not stored as an accomplished event. A broad ancient date interval is not a duration measured to the year.

The interface uses a linear time axis. Dense modern dates naturally cluster in a full 12,000-year view, so period filters provide a more useful scale. Construction intervals can overlap adjacent filters. The chronological list is grouped by the first phase's year; the exact record label remains visible. Minimum-width marks keep short intervals visible and are identified as such. The axis conversion joins 1 BCE to 1 CE without creating a year zero.

## Sources and reading depth

The source registries record title, publisher, public HTTPS URL, UTC access date, `kind: primary`, and the claims each source supports. The relevant monument authority, museum, UNESCO property record, project owner, architect, engineer, standards body or tool maintainer is preferred. A source may be primary for a project's advertised capability while providing no independent proof of performance.

Sources retrieved on **25 November 2026 UTC** fall within the owner's **24 November 2026 America/New_York** work session. The edition cutoff remains 24 November. Future or proposed milestones must remain described as proposals, even if an official page lists them.

The source-backed historical statements and qualitative engineering interpretations are written in original language. A source's photograph, drawing, digital scan, texture or proprietary model is not copied merely because its page can be read. Links preserve provenance; they do not establish rights to redistribute an asset. Sources can change after retrieval, so future editions must review both facts and provider terms again.

The existing resource router was used to locate a bounded reference packet for the architecture skill. The routing receipt selected six metadata entries from catalog `2026-11-24.1` (SHA256 `1564141dda2f13b4df474676123b96997b5c62b8b22a460316cf7f6a23b0016a`). Those router entries are discovery metadata, not evidence that entire books, standards or websites were read. The retained source registries identify the specific reviewed pages used for this edition.

## Engineering explanation

Element and building records explain force transfer and structural organization qualitatively: compression in masonry arches, bending in lintels, thrust and restraint, triangulation, shell behavior, timber joints and structural depth. These explanations connect visible form to an engineering idea. They do not certify actual load capacity, foundations, material condition, seismic performance or code compliance.

Similar silhouettes can conceal different materials, connections, construction sequences and uses. Egyptian pyramid massing, Maya stepped platforms and South Indian temple towers therefore have distinct records and sample limitations. Chinese timber/bracket studies are identified by the principle illustrated; they do not stand in for all East Asian architecture. A Gothic rib skeleton explicitly omits the web and parts of the wall system. A gridshell lattice without a resolved bracing system is a geometry study, not a stable manufactured structure.

Contemporary “complexity” is described through named challenges and documented methods. It is not scored by appearance or height alone. Where project-team sources describe a method, that attribution is retained; a promotional superlative is not upgraded to an independently established world record.

## Model provenance and fidelity

The samples have five explicit properties:

1. **Original procedural schematic.** Parameters and proportions are invented for instruction; no site scan, proprietary asset or Google tile is included.
2. **Known units and axes.** Blender scenes use metres and Z-up. glTF export converts to its Y-up coordinate convention. The metadata states whether the display plinth is included in dimensions.
3. **Known geometry.** Object, vertex and triangle counts, world-space bounds, geometry signatures, generator/preset hashes and delivered file digests accompany each sample.
4. **Known omissions.** Joints, foundations, reinforcement, material weathering, sacred imagery, exact proportions, conservation condition and other site-specific information are omitted unless explicitly modeled.
5. **Measured execution.** Actual engine generation and saved-file inspection are recorded separately from static JSON and hash validation. Reopening a model is not a structural analysis.

Fixed parameters and seeds make a study reproducible at the geometry level. File encoders, timestamps, engine versions and floating-point behavior can change bytes; recorded SHA256 hashes establish the identity of this delivery. They do not promise identical pixels from every GPU or platform.

## Real map and heritage data

Three distinct questions must be answered before using external spatial data:

- **What is it?** A building footprint, generalized massing model, photo-textured surface, point cloud, measured mesh, digital elevation model or interpreted reconstruction has different precision and semantics.
- **What may be done with it?** Record source, license version, access conditions, permitted extraction, adaptation, export and redistribution, attribution, and any share-alike or database obligations. Account access is not export permission.
- **What does it represent?** Record CRS, axis order, local origin, units, vertical reference, timestamp, resolution, missing fields and measured uncertainty. Georeferencing precision does not establish the accuracy of the original observation.

The synthetic footprint example demonstrates these records without importing third-party data. Its small local projection and fixed height limits are deliberately unsuitable for replacing a surveyed GIS/BIM pipeline. A real large-area or precision workflow should use the documented QGIS/GDAL/PDAL and geodetic procedures reviewed in the tool guide, with project-specific checks.

## Extension and review

Additions need an explicit selection reason, a reviewed source, an honest date interval and a rights distinction. Keep sources and limitations attached when handing work to another employee or exporting a model. Run the catalog/artifact validator and inspect new model geometry. Recheck the current source when resolving a disputed fact; do not silently overwrite uncertainty with a cleaner date.

Corrections should identify the record ID, prior statement, updated evidence, reason for change and affected outputs in the commit. If a reconstruction is later added, give it a separate artifact identity and evidence register with observed, inferred and conjectural parts. An agent's generated confidence value is not a substitute for that evidence.
