# Catalog data contract, version 1

`core.mjs` implements browser-safe chronology and reference checks. `validate.mjs` adds the repository/file checks. Both reject invalid versions instead of silently treating malformed data as an empty library.

| File | Top-level collection | Required record fields |
| --- | --- | --- |
| `data/monuments.json` | `schemaVersion`, `asOf`, `coverageNote`, `records` | `id`, `name`, `region`, `country`, `period`, `categories`, `startYear`, `endYear`, `dateLabel`, `datePrecision`, `status`, `structuralSystems`, `materials`, `elements`, `description`, `engineering`, `significance`, `uncertainties`, `sourceIds` |
| `data/elements.json` | `schemaVersion`, `elements` | `id`, `name`, `family`, `definition`, `loadPath`, `materials`, `uses`, `limitations`, `sourceIds` |
| `data/samples.json` | `schemaVersion`, `samples` | `id`, `name`, `summary`, `studyType`, `elementIds`, `skillPaths`, `files`, `limitations`, `sourceIds` |
| `data/tools.json` | `schemaVersion`, `asOf`, `tools`, `claims` | Tools: `id`, `name`, `kind`, `platforms`, `useCases`, `inputData`, `licenseSummary`, `exportGuidance`, `automationStatus`, `limitations`, `sourceIds`. Claims: `id`, `claim`, `verdict`, `assessment`, `sourceIds`. |
| `data/sources-*.json` | `schemaVersion`, `sources` | `id`, `title`, `url`, `publisher`, `kind`, `accessed`, `supports` |

IDs are unique lowercase slugs within each record collection; source IDs are unique across all three registries. Source IDs are namespaced `history-`, `elements-` and `tools-`. Every `sourceIds` reference must resolve. URLs must be credential-free HTTPS. All required prose fields are nonempty and bounded; array entries are plain text. The UI creates text nodes and does not render source data as HTML.

## Dates and state

Years are signed integers from -10000 through the observed 2026 cutoff, excluding zero. Start must be at or before end. The display label preserves the uncertainty the numeric interval cannot express. `datePrecision` is `approximate`, `range` or `year`. `status` is `extant`, `ruin`, `reconstructed`, `destroyed` or `under_construction`. Never encode a proposed completion as observed history.

`asOf` dates the research edition. `accessed` dates the actual UTC source retrieval and may be the following UTC day because the owner is in America/New_York. No later event is inferred from this timezone distinction.

## Cross-links

`samples[].elementIds` must resolve to element records. `skillPaths` must point to an existing repository `skills/<slug>/SKILL.md`. Monument `elements` are broader descriptive search slugs, not mandatory foreign keys; the catalog can describe architectural features before an individual element study exists.

Sample `files` has four paths: `blend`, `glb`, `preview` and `metadata`, relative to this library's root. Paths must stay inside that root, have no traversal, hidden components or symlink components, and name bounded regular files. No URL-based external binary buffers or image dependencies are permitted in the supplied GLBs.

Each metadata file identifies the original procedural source kind, units, coordinate conversion, seed, Blender version, generator and preset hashes, counts, dimensions, limitations and external assets (empty for this edition). Its file map binds exact output paths to byte sizes and SHA256 hashes. The generator manifest and independent inspection receipt provide additional execution evidence.

## Tool evidence

`automationStatus` is `supported` (an upstream documented interface), `manual_review` or `unverified`. It does not report a local installation. Claim verdicts are `verified`, `partly_supported`, `unverified` or `misleading`, always with a written assessment and source references. A seller is a primary source for what the seller advertises, not an independent benchmark or legal grant from the data provider.

## Publication

`static-assets.json` is an explicit public allowlist. The copier permits at most 220 files, at most 4 MiB per file and at most 14 MiB total. It rejects traversal, unsupported extensions, duplicates and symlink components before copying. No runtime state, private configuration, model weights, engine executables or hidden files belong in it.

The complete allowed source payload participates in the atlas source digest. The copy under `site-source/public/architecture-library` is derived and does not feed back into that digest. `check-static.mjs` compares the published bytes to their canonical source. Changes to a history note, model or source register therefore invalidate a previous static build.

Both the copier and final checker reject unexpected files in the projection. If an asset is retired from the allowlist, review and remove its stale derived copy before rebuilding. The copier reports the exact path and stops before writing; it does not silently delete an unreviewed file or let a retired asset leak into the next publication.
