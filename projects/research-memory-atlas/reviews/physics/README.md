# Physics research atlas

**Release scope:** foundations through selected current research as of 2026-11-25, with 141 concepts, 82 rigorous formula cards, 147 typed links and 62 source records. The complete original study content is in the five chapters and formula catalogue; the JSON records make it usable in the shared graph-memory engine.

## Reading route

1. [Electrostatics](01-electrostatics.md): sources, constraints, boundary problems, numerical methods and long-range learning.
2. [Magnetism](02-magnetism.md): currents, fields, energy, quantum order, topological textures and controlled device states.
3. [Gravity](03-gravity.md): Newtonian limits, variational geometry, general relativity, cosmology and bounded quantum/frontier claims.
4. [Frequency and waves](04-frequency-waves.md): oscillators, transforms, sampling, PDE modes, quantum devices and graph spectra.
5. [Memory bridges](05-cross-field-memory-bridges.md): exact mathematics, engineering transfer, cache dependencies and limits of physical analogy.
6. [Formula catalogue](formula-catalogue.md): each equation group has variables/units, assumptions, derivation, example, misuse warnings, primary/authoritative links and prerequisite concept IDs in the machine record.
7. [Coverage and expansion queue](coverage.md): access limits, omitted depth and concrete next research tasks.
8. [Selected frontier index](frontier-index.md): dated source links and inspected access depth, also available in `frontiers.json`.

## Machine-readable contract

| File | Records and interpretation |
|---|---|
| `sources.json` | Source IDs `ps-*`, title/URL, publication year/date, access depth, contribution and limits |
| `nodes.json` | Concept IDs `p-*`, four-part taxonomy paths, source IDs and epistemic status |
| `formulas.json` | Formula IDs `pf-*`, LaTeX, variable units, assumptions, derivation, examples, limitations and concept prerequisites |
| `edges.json` | Concept-to-concept typed links with explanatory labels |
| `validation.json` | Structural checks and illustrative numerical cross-checks with explicit scope |

**Edge orientation:** `prerequisite_of` means learn the **source before the target**. `related` describes an established association or shared method without asserting implication. `analogy` preserves a comparison but should be excluded from automatic evidence propagation. An edge does not by itself assert that every statement about one node transfers to the other. The prerequisite subgraph is acyclic; general associations may form loops.

**Status interpretation:** `established` is a model/mathematics status within stated assumptions; `active-research` indicates an ongoing domain; `mapped-for-expansion` is a taxonomy entry with limited local depth; `preprint-result-not-replayed` records a source claim without local proof replay; explicit open or assessment-qualified statuses preserve remaining gaps. Graph centrality is not an evidence-strength measure.

## Rebuilding and checking

Run `python build_physics.py` to regenerate the JSON and formula catalogue from the authored source files. Run `python validate_physics.py` to write and display the structural/numerical report. These scripts use the Python standard library and do not require network access. They do not download source text or run external proof packages.

The original source fragments `formulas_electro.py`, `formulas_magnet.py`, `formulas_gravity.py` and `formulas_frequency.py` are data-authoring inputs executed by the builder, not independent application entry points. `build_physics.py` includes the source and taxonomy registry. Editing generated JSON alone is temporary because a rebuild replaces it.

## Review status

Round 1 research, original derivation writing and self-consistency checks are complete. Independent critical feedback and subsequent correction rounds are recorded in `rounds.md` as they actually occur. No later review pass is claimed in advance.
