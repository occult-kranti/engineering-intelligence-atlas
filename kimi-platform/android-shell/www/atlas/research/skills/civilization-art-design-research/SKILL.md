---
name: civilization-art-design-research
description: Source-grounded art, ornament, pattern, calligraphy, color, material, and proportion research across named regions, periods, and communities (Roman late Republic–High Empire; Gothic lodges and manuals; five anchored Indian cases; dynastic Egypt; Nasrid Granada; Timurid/Turkmen pattern scrolls; Abbasid/Ifriqiyan calligraphy; Classic Maya Palenque; Asante adinkra; Djenné adobe; Inca Cusco). Use when a task needs anchored tradition case files with evidence tiers, frieze/wallpaper symmetry-group classification under declared criteria (color handling explicit, disputed censuses reported as disputes), proportion analysis tied strictly to documents, or explicitly modern generative SVG/CAD pattern labs with fixtures and pass criteria. Rejects civilizational essentialism, pseudohistory, golden-ratio/Fibonacci folklore, and unlabeled "reconstructions."
---

# Civilization Art & Design Research

Answer art/design-history questions only from anchored evidence, and build only honestly labeled modern labs. Every deliverable passes the gates below before it ships.

## Workflow

1. **Scope.** Name region, date range, and producing/patron community (dynasty, guild, workshop, lineage, religious order). If the tradition is outside the anchored set, build an equivalent anchored case first — never extend by analogy.
2. **Anchor.** Route to the case file in [references/tradition_anchors.md](references/tradition_anchors.md) (Roman, Gothic, five Indian cases, dynastic Egypt, plus the additional anchored traditions). Assign every claim an evidence tier: (a) surviving fabric/measured survey, (b) contemporary texts/inscriptions/scrolls/drawings, (c) documented craft practice, (d) later interpretation/revival, (e) contested/popular. Tiers (d)–(e) must be labeled and never carry a verdict alone.
3. **Classify / measure.** For symmetry verdicts and proportion questions, follow [references/symmetry_and_proportion.md](references/symmetry_and_proportion.md): declare criteria (color handling, extension rule, census followed) before any group count; use proportion only from documents (treatise, drawing, canon grid, manual, metrological study).
4. **Lab (optional, modern).** For generative SVG/CAD exercises, follow [references/modern_labs.md](references/modern_labs.md): labs L1–L7 with fixtures and pass criteria. Label every output "modern exercise, method per [author, year]" unless it implements a documented manual — then name the manual. Scripts and sample assets below are modern teaching artifacts.
5. **Verify.** Check citations and repo pins against [references/sources_and_verification.md](references/sources_and_verification.md) and the eight repository case studies in [references/repo_casebook.md](references/repo_casebook.md) (machine-readable copy: [assets/repo_cases.json](assets/repo_cases.json)).
6. **Ship against the output contract** (below). Context-to-role routing uses only existing role slugs — see [assets/role_mapping.json](assets/role_mapping.json).

## Hard gates (fail-stop, never waived by approval)

- **No essentialism.** No timeless "Egyptian," "Indian," "Islamic," or "Chinese" style claims as load-bearing categories; historiographic labels only with citation. Indian cases stay region/period/dynasty-specific (Nagara vs. Karnata-Dravida vs. Mughal are different answers).
- **Evidence tiers visible.** Surviving fabric and primary texts outweigh later interpretation; popular media is orientation, never verdict. Fail-stop with "unverifiable as claimed" when no anchored source exists for a load-bearing claim.
- **No pseudohistory.** No hyper-diffusionism, lost-technology narratives, or sacred-geometry numerology. No golden-ratio/Fibonacci claims without a primary design document (Markowsky 1992 controls; coordinate with the mathematics-research safety note).
- **No retrojection.** Wallpaper-group notation, PIC constructions, IH incidence symbols, and orbifold notation are modern scholarship — never attribute them to historical makers' intentions.
- **Documents control proportion.** A canon grid, lodge manual, or pattern scroll is evidence; a ratio fitted onto a photograph is not.
- **Classification is criteria-relative.** A group verdict without stated criteria (color treatment, extension rule, census cited) is rejected; contested counts (Alhambra: Müller 11 / Grünbaum–Shephard 13 / Bodner 14 of 17) are reported as ranges with the dispute literature.
- **Modern labs stay modern.** No "reconstruction of how X was made" unless a documented manual/scroll/canon grid is implemented and named. Quasiperiodicity claims require the Makovicky 2007 and Cromwell 2015 counterweights attached.
- **Museum objects by accession number** with the holding record's rights field; umbrella CC0 releases do not launder per-item rights (route to the creative-rights-reproducibility-editor gate).
- **Provenance fail-stop.** An unclassifiable-but-honest pattern beats a classified-but-invented one; if site/object/accession/image provenance cannot be established, say so.

## Bundled scripts (Python 3 stdlib only, deterministic)

Run from the skill root; all support `--self-test`.

- `scripts/pattern_svg_generator.py` — generates labeled modern-exercise SVGs: `--mode frieze` (any of the 7 frieze groups as transformation recipes), `--mode quadrature` (Roriczer-1486-style documented ad quadratum exercise), `--mode robins-grid` (18-square and Amarna canon grids per Robins 1994), `--mode girih` (modern PIC decagonal exercise per Kaplan & Salesin 2004, with dispute note). Use `--mode all` to regenerate the sample assets in `assets/exercises/`.
- `scripts/symmetry_validator.py` — verifies, within a declared tolerance, whether a finite set of point primitives in a JSON fixture is invariant under a stated transformation (translation, rotation, reflection, glide reflection). It does **not** classify wallpaper groups from arbitrary images; classification remains a criteria-declared human/protocol task (see symmetry_and_proportion.md). Known vectors: `assets/fixtures/symmetry_known_vectors.json`.
- `scripts/casebook_validator.py` — validates `assets/repo_cases.json` (fields, SHAs, dates), checks that role-mapping slugs are existing role slugs only, scans all skill files for absolute paths, and verifies every relative Markdown link resolves. Run before shipping any edit: `python3 scripts/casebook_validator.py` from the skill root.

## Output contract

1. Every tradition statement carries geography + date range + community + evidence tier.
2. Symmetry classifications state criteria and cite the census protocol followed; contested counts are reported as ranges with the dispute.
3. Proportion claims name the document or metrological study; golden-ratio/Fibonacci assertions fail review without a primary design document.
4. Labs are labeled modern; "reconstruction" language requires a documented manual and a method citation.
5. Sources: primary texts/inscriptions/scrolls first, then peer-reviewed and museum/university records; popular media is orientation only.
6. Museum objects carry accession IDs and license/provenance statements from the holding institution's record.
7. Every lab artifact declares pinned tool versions, licenses of any code run, random seeds, and tolerance (no raw `==` on coordinates).

## Interface routes

Reuse, never duplicate: architecture-and-built-heritage-research (construction, conservation, BIM evidence), computational-geometry-engineering (robust predicates, units, tolerances), mathematics-research (golden-ratio folklore audit, group theory above teaching level), spatial-3d-production-engineering (fabrication gates), science-history-research (historiography). Rights/licensing/provenance questions route to the creative-rights-reproducibility-editor gate; composed panel runs follow the agent-research-director. Context-to-slug mapping (existing role slugs only) is in [assets/role_mapping.json](assets/role_mapping.json).
