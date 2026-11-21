# Chemistry Resources — Identifiers, Units, Databases, Software, Reproducibility

Derived from the chemistry research library (2026-11-20). URLs, license terms, database versions, and constants adjustments change — record version and access date for every record used, and re-verify against the live source.

## Contents

1. Nomenclature and identifiers — 2. Units and constants — 3. Uncertainty — 4. Databases (license/access caveats) — 5. Database hygiene rules — 6. Software stack — 7. Computational reporting minimums — 8. Reproducibility and data practices — 9. Quick-reference constants

## 1. Nomenclature and identifiers

- **IUPAC authorities** — Gold Book (terminology, https://goldbook.iupac.org, prefer current online version, cite per-entry DOI), Blue Book (organic, 2013), Red Book (inorganic, 2005). CIAAW (https://www.ciaaw.org) standard atomic weights are *intervals* for some elements (H, Li, B, C, N, O, Si, S, Cl, Br, Tl, Pb) — do not quote a single value without checking the current abridged table.
- **IUPAC name** — authoritative but long; distinguish the preferred IUPAC name (PIN) from acceptable alternatives.
- **SMILES** — convenient but non-unique unless canonicalized; canonicalization differs across toolkits (RDKit ≠ Daylight ≠ Open Babel in all cases).
- **InChI / InChIKey** — IUPAC's open algorithmic identifier; the 27-character InChIKey is the de facto database join key. Standard InChI normalizes tautomers — check stereochemical and isotopic layers explicitly.
- **CAS RN** — widely used but **proprietary** (CAS/ACS); treat as lookup keys, not open identifiers; beware one-substance/multiple-RN and one-RN/multiple-form ambiguities (salts, hydrates).
- **PubChem CID** — open; structure-record-specific — the same molecule can appear under multiple CIDs (protonation/isotope records) linked via "same connectivity".
- **Stereochemistry pitfalls** — CIP R/S and E/Z per IUPAC rules (2013 extensions; beware legacy software differences); SMILES chirality (`@`/`@@`) is toolkit-convention-dependent — round-trip and 3D-check. A 2D depiction or name alone may not specify tautomer, protonation state, salt form, or hydrate: always state the exact chemical species a claim refers to.

## 2. Units and constants

- **BIPM SI Brochure** (9th ed., 2019; v2.01 2022, https://www.bipm.org/en/publications/si-brochure): the SI is defined via fixed numerical values of seven defining constants (Δν_Cs, c, h, e, k, N_A, K_cd).
- **NIST SP 811** (https://www.nist.gov/pml/special-publication-811): unit symbols lowercase unless derived from a person's name (Pa, N, J, W; l/L for litre); symbols never pluralized; space between number and unit; "K" not "°K".
- **CODATA** (https://physics.nist.gov/cuu/Constants/): h, e, k, N_A are exact by definition, as are their products R = 8.314 462 618 153 24 J mol⁻¹ K⁻¹ and F = 96 485.332 123 310 0184 C mol⁻¹. Measured constants retain uncertainty (e.g., α, CODATA 2022) — always cite the adjustment year.
- **Unit traps** — 1 cal (thermochemical) = 4.184 J exactly; food "Calorie" = 1 kcal; 1 kcal/mol = 4.184 kJ/mol ≈ 349.757 cm⁻¹ ≈ 0.0433641 eV per particle. 1 atm = 101 325 Pa exactly; 1 bar = 10⁵ Pa exactly (bar ≠ atm). 1 D ≈ 3.335 64 × 10⁻³⁰ C·m. Wavenumbers (cm⁻¹) are spectroscopic, not SI. ppm/ppb are ambiguous (mass vs. volume vs. mole basis; US vs. older European "billion") — state the basis explicitly. Å and °C are accepted with SI; pH/pKa are dimensionless by convention and pH is operationally defined (IUPAC 2002), not simply −log[H⁺] outside dilute aqueous ideality.

## 3. Uncertainty (JCGM GUM/VIM)

- GUM (JCGM 100:2008): Type A (statistical) and Type B evaluations, combined standard uncertainty u_c, expanded uncertainty U = k·u_c (typically k = 2 ≈ 95 %).
- VIM (JCGM 200:2012): *accuracy* is qualitative; *measurement uncertainty* is the quantitative doubt; error ≠ uncertainty.
- Report value with standard uncertainty in parentheses, e.g., α⁻¹ = 137.035 999 177(21) (NIST/CODATA style).
- Significant figures are a communication convention, not a substitute for uncertainty analysis; propagate uncertainty rather than rounding rules when precision matters.

## 4. Databases (with license/access caveats)

| Resource | Content | Access / license caveat |
|---|---|---|
| NIST Chemistry WebBook (webbook.nist.gov) | Thermochemical, spectral (IR/MS/UV-Vis), ion energetics | Free; US gov work largely public domain, NIST disclaimer applies, some contributed data retain rights |
| NIST CODATA (physics.nist.gov/cuu) | Recommended constants | Free; cite adjustment year (2018/2022) |
| PubChem (pubchem.ncbi.nlm.nih.gov) | >100 M compound records, properties, bioassays | Free (NIH); aggregated from depositors — provenance varies; no warranty of correctness |
| ChEBI (ebi.ac.uk/chebi) | Ontology of small molecules of biological interest | Free (CC BY 4.0 for data; check current terms); nightly/monthly releases |
| ChEMBL (ebi.ac.uk/chembl) | Curated bioactivity data | Open (CC BY-SA 3.0 historically — verify current license); versioned releases |
| RCSB PDB / wwPDB (rcsb.org) | Experimental macromolecular structures | Archive data files CC0 1.0; RCSB software MIT/Apache 2.0; site text copyrighted (rcsb.org/pages/usage-policy) |
| Crystallography Open Database (crystallography.net/cod) | Open small-molecule/inorganic CIF structures | Free; records dedicated to public domain; attribution of COD and CIF authors requested |
| Materials Project (next-gen.materialsproject.org) | DFT-computed properties of >150k inorganic materials | Free with account + API key; **computed, not experimental** data; Terms of Use and citation requirements — verify before redistribution |
| ICSD / CSD (FIZ Karlsruhe / CCDC) | Curated experimental crystal structures | **Subscription/commercial licenses** — do not bulk-redistribute |
| NIOSH Pocket Guide (cdc.gov/niosh/npg) | RELs, IDLH values, hazard data | Free; US government |
| OSHA standards (osha.gov) | PELs, laboratory standard | Free; regulatory text is public |

## 5. Database hygiene rules

1. Distinguish **experimental**, **curated-from-literature**, and **computed/predicted** values (PubChem and Materials Project mix these; read the field provenance).
2. Record **version and access date** (ChEMBL 33 vs 34 can change activity values; Materials Project structures are re-relaxed across releases).
3. Prefer identifiers over names for joins (InChIKey, CID, PDB ID, mp-id).
4. Report conflicting values across databases with sources rather than silently averaging.
5. Quote spectral/thermochemical data with **reference states and conditions** (phase, temperature, pressure, solvent); a bare number without conditions is not data.

## 6. Software stack (open source)

| Tool | Role | License (verify current) |
|---|---|---|
| RDKit (rdkit.org) | Cheminformatics: descriptors, fingerprints, substructure, reactions | BSD 3-Clause |
| Open Babel (openbabel.org) | Format conversion, fingerprints, force-field utilities | GPL v2 — implications for derivative distribution |
| Psi4 (psicode.org) | Quantum chemistry (HF, DFT, MP2, coupled cluster) | LGPL v3 |
| PySCF (pyscf.org) | Python electronic structure (mean-field to correlated, periodic) | Apache 2.0 |
| CP2K (cp2k.org) | DFT / ab initio MD, condensed phase and periodic | GPL v2 (or later) |
| GROMACS (gromacs.org) | Classical biomolecular MD, high-performance | LGPL v2.1+ |
| OpenMM (openmm.org) | MD toolkit/library with GPU support | MIT |
| LAMMPS (lammps.org) | Classical materials MD; large pair-style ecosystem | GPL v2 |
| Avogadro (avogadro.cc) | Molecular editor/visualizer | BSD 3-Clause |
| Jmol/JSmol, 3Dmol.js, NGL | Visualization | Check each project (LGPL/MIT/Apache variants) |

## 7. Computational reporting minimums

For any claimed computed result report: code + exact version; method/functional/basis set or force field name + version; convergence criteria; geometry provenance; solvation model; date. "DFT calculation" is not reproducible — "PBE0/def2-TZVP, SCF 10⁻⁸, CPCM(water), Psi4 1.9" is. Cheminformatics cautions: canonicalization is toolkit-specific; descriptor implementations differ (logP variants are not interchangeable); ML predictions are not measurements — label model identity and applicability domain.

## 8. Reproducibility and data practices

1. **FAIR principles** (Wilkinson et al., 2016, *Sci Data* 3, 160018, https://doi.org/10.1038/sdata.2016.18): deposit data in domain repositories (PDB/COD for structures; Zenodo/Figshare for general data) with persistent identifiers.
2. **Version everything**: manuscripts, notebooks, environments (conda lock files, containers), data snapshots.
3. **Provenance chains**: raw instrument data → processed data → figures/tables; keep raw files immutable; script transformations, never manual edits.
4. **Exchange standards**: CIF (IUCr), PDBx/mmCIF, mzML (HUPO-PSI), JCAMP-DX (IUPAC), SD/Molfile (V2000/V3000 — note V2000's atom/bond limits and deprecated status for new work).
5. **Statistical discipline**: predefine hypotheses; report n, uncertainty (GUM-style), and software; beware p-hacking and HARKing; replicate key measurements.
6. **Replication culture**: computational results re-runnable from deposited inputs; experimental claims checked against independent literature before being treated as established.

## 9. Quick-reference constants (CODATA; cite adjustment year)

| Constant | Symbol | Value | Status |
|---|---|---|---|
| Speed of light in vacuum | c | 299 792 458 m s⁻¹ | exact (SI defining) |
| Planck constant | h | 6.626 070 15 × 10⁻³⁴ J s | exact (SI defining) |
| Elementary charge | e | 1.602 176 634 × 10⁻¹⁹ C | exact (SI defining) |
| Boltzmann constant | k | 1.380 649 × 10⁻²³ J K⁻¹ | exact (SI defining) |
| Avogadro constant | N_A | 6.022 140 76 × 10²³ mol⁻¹ | exact (SI defining) |
| Molar gas constant | R = N_A·k | 8.314 462 618 153 24 J mol⁻¹ K⁻¹ | exact (product of exact constants) |
| Faraday constant | F = N_A·e | 96 485.332 123 310 0184 C mol⁻¹ | exact (product of exact constants) |
| Fine-structure constant | α | 7.297 352 5643(11) × 10⁻³ | CODATA 2022, measured |
| Electron mass | m_e | 9.109 383 7139(28) × 10⁻³¹ kg | CODATA 2022, measured |
| Atomic mass constant | m_u | 1.660 539 068 92(52) × 10⁻²⁷ kg | CODATA 2022, measured |

Verify all digits against https://physics.nist.gov/cuu/Constants/ before quantitative use; this table is a convenience summary.
