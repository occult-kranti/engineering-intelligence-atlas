# Repository Casebook

Eight read-only repository case studies (inspected 2026-11-21 via GitHub API: license endpoint + raw LICENSE/COPYING reads + commit listings; **no code downloaded or executed**). Pinned commit = default-branch HEAD at inspection; cite repos as URL + SHA. Machine-readable copy: `assets/repo_cases.json`; validate with `scripts/casebook_validator.py`.

Contents: met-openaccess · smithsonian-openaccess · iiif-api · isohedral-tactile · paperjs · openscad · freecad · antiprism.

## met-openaccess — metmuseum/openaccess (museum-open-data)

- License: **CC0-1.0** (LICENSE file read, file SHA 670154e3538863b2d9891fd5483160fbdfc89164). Pin: `15d35b4b1f7f87baa8d42cc24481f68f76817d20` (2026-11-16).
- Lifecycle: active — automated "Open Access csv" data commits.
- Demonstrates: collection metadata as CC0; every object record carries accession number, credit line, rights field. Anchor fixture for labs L6 and L3 image sourcing.
- Lessons: CC0 covers metadata and designated open-access images, but the per-record "Rights and Reproduction" field still controls individual works — read the record, never assume. Snapshots move: pin the CSV commit SHA in any artifact citing object records. Citation unit = accession number + objectURL.

## smithsonian-openaccess — Smithsonian/OpenAccess (museum-open-data)

- License: **CC0-1.0** (GitHub license API). Pin: `c2ac3e2a671755e03e1ec439ad7b9b0020636281` (2021-12-21).
- Lifecycle: static README/metadata hub — data releases live on Smithsonian S3, not in this repo.
- Demonstrates: CC0 release at federal-institution scale (4.5M+ images/data) with usage guidance that requests attribution and flags embedded third-party rights.
- Lessons: repo stillness ≠ dataset stillness — check the live bulk-data date, not the README. A CC0 umbrella does not launder embedded third-party rights. Good negative-example for lifecycle checks.

## iiif-api — IIIF/api (standards-source)

- License: **no repo-level LICENSE file** (verified at root listing 2026-11-21); IIIF specs are published under open terms on iiif.io — record the per-specification notice when excerpting. Pin: `3fc309ca29ce933dff2751530d751ca1dff9ee40` (2026-11-18).
- Lifecycle: active — community spec development (Image API, Presentation API).
- Demonstrates: interoperable image delivery for cultural heritage; standard plumbing for museum-image labs (L6).
- Lessons: cite IIIF specs by API name + version (e.g., Image API 3.0); manifests are JSON-LD and validate against published schemas. Absence of a LICENSE file is itself a finding: record it, then check consortium terms before republishing spec text. Use info.json capability introspection — don't hardcode server behavior.

## isohedral-tactile — isohedral/tactile (geometry-library)

- License: **BSD-3-Clause** (LICENSE file read, file SHA 45638b0de185ce7d01fd482b50c21a376ad076ec). Pin: `52f40460e30cc3f4313d7b3fb24aa8f14b79c88e` (2022-06-17).
- Lifecycle: stable/dormant — last default-branch commit 2022; author Craig S. Kaplan's research continues via papers and ports (tactile-python/tactile-rs/tactile-cs observed in search, not inspected).
- Demonstrates: reference implementation of the 93 isohedral tiling types (Grünbaum–Shephard incidence symbols) — computation backbone for modern tiling labs.
- Lessons: dormant + permissive = safe to pin and read; test algorithmic claims against Grünbaum–Shephard, not against the repo. The IH-type system is a modern classification (1987) — never attribute it to historical pattern-makers. BSD-3-Clause requires retaining the notice — put it in the lab's NOTICE file, not just a comment.

## paperjs — paperjs/paper.js (vector-graphics-library)

- License: **MIT** (GitHub: NOASSERTION due to custom preamble; LICENSE.txt is verbatim MIT text; file SHA 84e905d812d93807dbcc0e370b5706ecca0fe4dc). Pin: `0d1446a1bb040e3c87533b28bcc384d87663587b` (2026-11-04).
- Lifecycle: active.
- Demonstrates: scriptable vector graphics with boolean path ops and SVG import/export — browser-side ornament/pattern labs without a server.
- Lessons: NOASSERTION is not a license problem by itself — read the file. Boolean path ops are floating-point: acceptance tests need tolerance declarations (coordinate with computational-geometry-engineering). SVG export preserves authored structure only if groups/ids are authored deliberately — teach semantic grouping.

## openscad — openscad/openscad (programmatic-cad)

- License: **GPL-2.0-only with explicit CGAL linking exception** (COPYING preamble; file SHA 627c964a841a48896bf9c779e7b051dd3cbfd2d7). Pin: `2e1a89ac8e5488e7f19c367af2df61faeceb5880` (2026-11-20).
- Lifecycle: active.
- Demonstrates: code-as-CAD — fully parametric, diff-able solid models; the right host for Roriczer/stepwell labs (L4/L5) where every geometric step must be inspectable text.
- Lessons: GPL-2.0 covers the application; user .scad models are user works (running output), but bundling OpenSCAD into a distributed product triggers copyleft — record this distinction in delivery reviews. CGAL dependency explains the linking exception; audits must include transitive libraries. Deterministic CSG suits "construction closes within declared tolerance" acceptance tests.

## freecad — FreeCAD/FreeCAD (parametric-cad)

- License: **LGPL-2.1** (top-level LICENSE; per-module details vary; file SHA bc0390e98c98f2ad3ab7decdb82b4d57d7f850d4). Pin: `33a22d8bb12b2cfe39a9fee4b230d51667125562` (2026-11-20).
- Lifecycle: active — large multi-workbench project; repo contains AGENTS.md and AI_POLICY.md (agent-authored contributions are policy-governed).
- Demonstrates: full parametric B-rep CAD (Open CASCADE kernel) with Python console; constraint-sketch workflows for documented-procedure labs; also a governance example (published AI-contribution policy).
- Lessons: LGPL-2.1 permits linking; modified-library distribution carries source obligations. .FCStd files are zip containers — provenance labs can inspect document.xml for parameter history. Its AGENTS.md/AI_POLICY.md is a model citation when drafting agent-contribution rules.

## antiprism — antiprism/antiprism (geometry-toolkit)

- License: **NOASSERTION** — Debian-format COPYING declares "MIT-and-similar, permissive with attribution" for the bulk of files; check per-file notes (COPYING read via license API). Pin: `7805b34d3f8860857fb9ac10a1917d1bf4c7888d` (2024-08-27).
- Lifecycle: maintenance mode (last default-branch commit 2024-08).
- Demonstrates: CLI polyhedron/OFF toolkit (uniform polyhedra, symmetry operations, geodesics) — ornament-to-solid exercises and polyhedral symmetry beyond the plane groups.
- Lessons: Debian-format copyright files encode per-file variation — audit at file granularity before excerpting. Maintenance-mode CLI tools are stable fixtures: pin the commit, record build toolchain if ever compiled. OFF conversions must declare handedness/units (coordinate with computational-geometry-engineering).
