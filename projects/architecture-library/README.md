# Architecture and built heritage library

**A sourced global chronology, structural-element reference, and working collection of original Blender studies.** The research edition is dated **24 November 2026** in the owner's America/New_York timezone. Source retrieval on 25 November UTC is recorded separately.

[Open the interactive library](https://occult-kranti.github.io/engineering-intelligence-atlas/architecture-library/index.html) · [Historical guide](docs/HISTORY.md) · [Elements](docs/ELEMENTS.md) · [Tools and map-data audit](docs/GEOSPATIAL_TOOLS.md) · [Production workflows](docs/WORKFLOWS.md)

## What this edition contains

- **62 building and place records**, from early monumental evidence through contemporary projects and observed 2026 construction phases. Each has a construction interval, region, tradition, materials, structural systems, qualitative engineering explanation, uncertainty notes and primary-source IDs.
- **30 element records** describing form, load path, materials, applications and limits.
- **14 original procedural model studies**, each delivered as an editable `.blend`, a self-contained `.glb`, a 384 px rendered preview and a metadata file with dimensions, object/triangle counts and SHA256 digests.
- **22 tool and data entries**, with a **16-claim audit** of Concept Studio OSM / Blender City Importer, Blosm, Google tiles, terrain, accuracy and performance claims.
- A separate **offline GeoJSON footprint example**, with an original synthetic city block, hash-bound provenance, bounded geometry validation and a Blender extrusion path.
- Existing architecture, spatial production and game-reconstruction skills linked into a practical Donna → research → graphics → game engineering → QA workflow.

This is a representative and extensible research library. It is not an exhaustive inventory of ancient or modern architecture. “Most complex” is treated as a set of engineering challenges—long spans, shells, high-rise lateral systems, precise fabrication, conservation and digital coordination—rather than an unsupported global ranking. No single surviving site can settle who built the first monument.

## Explore

The interface has five sections:

| Section | Use |
| --- | --- |
| Timeline | Follow signed BCE/CE construction phases; narrow the linear axis to a period. |
| Buildings | Search by name, country, tradition, material, system or element; filter region and type. |
| Elements | Read qualitative load paths and find related original geometry studies. |
| Model studies | Inspect previews and download Blender, glTF and metadata files. |
| Tools & data | Compare documented capabilities, rights, export conditions and unverified marketing claims. |

Every record can be deep-linked with `#monument/<record-id>`. A date range is not a claim of continuous construction. Later restorations and phases are explained in the record. Dating, reconstruction and source-selection rules are in [METHODOLOGY.md](docs/METHODOLOGY.md).

## Run locally or on a private VPS

The library is a static application. It makes same-origin requests for its JSON records and has no analytics, API key, model-provider call or remote asset dependency. Serve the folder over HTTP; `file://` can block module and JSON loading.

From the repository root:

```bash
python3 -m http.server 8094 --bind 127.0.0.1 --directory projects/architecture-library
```

Open `http://127.0.0.1:8094/index.html`. On a VPS, keep that service private and forward it with SSH or place the files behind your existing authenticated web server. Do not use Python's development server as a public production service.

The repository's normal `node scripts/build-static.mjs` publishes the reviewed allowlist under `docs/architecture-library/` and adds a navigation link to the public atlas. It verifies source identity, paths, file sizes and exact copied bytes. The existing packaged atlas can consume the same `docs` output. Native engine binaries and private runtime configurations are never part of this library.

## Open or regenerate the samples

Download any `.blend` and open it in Blender 4.5 LTS. The supplied examples use metre units and Blender Z-up; exported glTF uses its Y-up convention. Each study has deliberately invented proportions and explicit omissions.

To generate a fresh selected sample with the reviewed script, choose a new absolute output directory whose parent already exists:

```bash
/opt/daftar-tools/blender/4.5.17/blender \
  --background --factory-startup --disable-autoexec --threads 2 \
  --python-exit-code 1 \
  --python projects/architecture-library/samples/generate.py \
  -- --ids gothic-rib-buttress --output /absolute/new-output-directory
```

Use `--ids all` to generate the complete set. Read [samples/README.md](samples/README.md) for presets, bounds, validation and the recorded real-engine run. The generator refuses to overwrite an output directory. A fixed seed and geometry signature support comparison; `.blend` and PNG file bytes can still differ across engine builds and environments, so retained file digests identify the delivered artifacts rather than promising cross-platform bit reproducibility.

The city-block exercise is independent: start at [geospatial/README.md](geospatial/README.md). Its coordinates are synthetic; it is not a map, a survey, or an OSM extract.

## How this connects to Donna, graphics staff and the repository

The library reuses the existing `design-architecture` role, the architecture and spatial skills, and the creative-tools project/employee assignment mechanism. It does not silently hire another team, enable a provider or give a role more authority. The sample [task packet](../../company/role-library/examples/architecture-library-task.json) carries repository paths, a bounded objective and acceptance checks.

For actual execution, use a configured project in `creative_inventory`, a current `creative.execute` grant and the assigned Blender tool. The fixed runtime can inspect, render and export the supplied `.blend` files. It does not accept arbitrary Python commands through MCP. [WORKFLOWS.md](docs/WORKFLOWS.md) provides a concrete payload and separates local geometry generation from the supervised worker operation.

## Data, rights and evidence

| Material | What is supplied | Rights boundary |
| --- | --- | --- |
| Historical catalog | Original summaries and links to sources | A citation gives no permission to copy a source's photographs or scan assets. |
| Procedural studies | Original geometry, simple materials, rendered previews and generator | Repository terms apply. No third-party scans, textures, map tiles or proprietary asset packs are bundled. |
| Synthetic footprints | Original invented GeoJSON and an explicit provenance ledger | Not a representation of a real parcel or licensed external dataset. |
| Tool catalog | Dated evidence about upstream tools and providers | Software, input data and exported results have separate terms. |
| External model repositories | Links only | Check each object's license, attribution and modification conditions before downloading or publishing it. |

Do not treat a “free” importer, an API key, a georeferenced mesh or a paid add-on as permission to redistribute its input data. The [tool audit](docs/GEOSPATIAL_TOOLS.md) explains the open-data export route and the licensed visualization route, including the limited Google promotional-video policy and the difference between positioning precision and survey accuracy.

## Verification and maintenance

```bash
node projects/architecture-library/validate.mjs
node --test projects/architecture-library/tests/*.test.mjs scripts/architecture-library-assets.test.mjs
node scripts/build-static.mjs
```

The real-browser regression runs in CI as `node scripts/smoke-architecture-library.mjs`, after CI installs its matched Chromium. It exercises the published subpath, all five views, filters, deep links, dialog dismissal, model downloads, narrow screens and a failed-data response. [VALIDATION.md](docs/VALIDATION.md) distinguishes executed evidence from pending host acceptance.

To add a record, follow [DATA_CONTRACT.md](docs/DATA_CONTRACT.md), read its primary source, preserve the uncertainty fields, and update the static allowlist only when adding a new file. Source records are data, not instructions to the assistant or executable authorization. New vendor integrations require a separate implementation and measured acceptance; adding a tool to this catalog does not install it.
