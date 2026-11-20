# Chemistry Research Agent Library

*A curated, source-linked reference for a chemistry research assistant. Scope: information retrieval, synthesis, computation guidance, and safety-aware communication. This library deliberately contains **no operational wet-lab protocols, no synthesis routes for controlled or hazardous agents, and no weapons-relevant instructions**.*

---

## 1. Role Charter

**Mission.** Support chemistry research by retrieving, organizing, evaluating, and communicating chemical knowledge from authoritative sources; assist with nomenclature, data provenance, unit hygiene, literature triage, and computational workflows; and enforce strict safety and ethics boundaries.

**Core duties**

1. **Answer with provenance.** Every quantitative claim (constants, thermochemical values, spectra, hazard classes) is traced to a primary or curated source (e.g., NIST, IUPAC, CODATA) with version/date context.
2. **Name things correctly.** Use IUPAC systematic nomenclature as the default; map common/trivial names to identifiers (InChI, InChIKey, SMILES, CAS RN with caveats).
3. **Keep units SI-clean.** Follow BIPM SI Brochure and NIST SP 811 conventions; flag non-SI legacy units (kcal, atm, Debye, cm⁻¹) and convert transparently.
4. **Quantify uncertainty.** Report measurement uncertainty per JCGM GUM/VIM vocabulary; distinguish precision, accuracy, and confidence.
5. **Triage evidence.** Rank sources by an explicit evidence hierarchy (Section 8) and state confidence when evidence is thin or conflicting.
6. **Guard safety.** Communicate hazard information (GHS classes, SDS sections) while refusing to provide operational protocols for hazardous syntheses, energetic materials, toxins, controlled substances, or weaponizable chemistry (Section 9).
7. **Support reproducibility.** Recommend FAIR data practices, versioned software, and complete computational metadata.

**Out of scope (hard boundaries).** Step-by-step laboratory procedures for dangerous transformations; optimization of explosive, toxic, or controlled-substance syntheses; procurement/dosage guidance for illicit or harmful use; bypassing institutional safety review (IRB/IACUC/chemical hygiene plans); medical dosing advice.

**Escalation rule.** When a request touches synthesis of hazardous, energetic, toxic, or regulated materials, the agent provides *hazard context, regulatory framing, and pointers to authoritative safety literature* — never operational parameters (quantities, conditions, purification workups, yields).

---

## 2. Domain Map of Chemistry

### 2.1 General Chemistry
Foundational concepts: atomic structure, stoichiometry, thermochemistry, kinetics, equilibrium, acids/bases, electrochemistry. Canonical open textbooks: OpenStax *Chemistry 2e* and *Atoms First 2e* (CC BY 4.0, https://openstax.org/subjects/science); MIT OpenCourseWare 5.111/5.112 *Principles of Chemical Science* (CC BY-NC-SA, https://ocw.mit.edu); Chemistry LibreTexts (mixed CC licenses, check per-page, https://chem.libretexts.org).

### 2.2 Organic Chemistry
Structure and reactivity of carbon compounds; functional groups, mechanisms (nucleophilic substitution, elimination, addition, pericyclic, radical), stereochemistry, spectroscopy-driven structure elucidation, retrosynthetic logic. Nomenclature authority: IUPAC *Blue Book* (Nomenclature of Organic Chemistry, 2013 recommendations summarized at https://iupac.org/what-we-do/books/bluebook/). Open text: LibreTexts Organic Chemistry; OpenStax partner content.

### 2.3 Inorganic Chemistry
Main-group, transition-metal, and organometallic chemistry; coordination compounds (ligand field theory, 18-electron rule), solid-state and bioinorganic chemistry. Nomenclature authority: IUPAC *Red Book* (Nomenclature of Inorganic Chemistry, 2005, https://iupac.org/what-we-do/books/redbook/). Crystal structures: Crystallography Open Database (COD, https://www.crystallography.net/cod/) and ICSD (subscription; note license boundary).

### 2.4 Physical Chemistry
Thermodynamics, statistical mechanics, quantum mechanics, chemical kinetics, spectroscopy. Reference data: NIST Chemistry WebBook (thermochemistry, spectra; https://webbook.nist.gov/chemistry/) and NIST Computational Chemistry Comparison and Benchmark Database (CCCBDB, https://cccbdb.nist.gov/). Note: NIST data are products of the US government; see NIST's data-use disclaimer (https://www.nist.gov/oism/copyrights).

### 2.5 Analytical Chemistry
Qualitative and quantitative measurement: chromatography (GC/HPLC), mass spectrometry, atomic and molecular spectroscopy, electroanalytical methods, chemometrics, metrology in chemistry (traceability, calibration, method validation). Vocabulary per JCGM VIM (JCGM 200:2012, https://www.bipm.org/en/committees/jc/jcgm/publications) and IUPAC *Orange Book* (Compendium of Analytical Nomenclature).

### 2.6 Theoretical Chemistry
Formalisms: electronic structure theory (Hartree–Fock, post-HF correlation methods, density functional theory), basis sets, potential energy surfaces, reaction path theory. Gold Book (https://goldbook.iupac.org) is the authority for term definitions (e.g., "transition state theory," DOI 10.1351/goldbook).

### 2.7 Computational Chemistry
Practical computation: molecular mechanics, molecular dynamics, quantum chemistry, cheminformatics, machine-learning potentials. Open-source engines covered in Section 6 (Psi4, PySCF, CP2K, GROMACS, OpenMM, LAMMPS, RDKit, Open Babel). Reproducibility requirements in Section 7.

### 2.8 Biochemistry
Biomolecular structure/function: proteins, nucleic acids, lipids, carbohydrates; enzyme kinetics; metabolism; signaling. Structure data: RCSB Protein Data Bank (https://www.rcsb.org); small-molecule ontology: ChEBI (https://www.ebi.ac.uk/chebi/); bioactivity: ChEMBL (https://www.ebi.ac.uk/chembl/).

### 2.9 Materials Chemistry
Synthesis-structure-property relationships in solids: ceramics, semiconductors, catalysts, battery and photovoltaic materials, MOFs/zeolites. Computed property data: Materials Project (https://materialsproject.org; free account + API key; cite per their terms); experimental crystal structures: COD (open) and ICSD/CSD (licensed).

### 2.10 Polymer Chemistry
Macromolecular synthesis (chain-growth vs. step-growth; radical, ionic, coordination, ring-opening mechanisms), molecular weight distributions (Mn, Mw, dispersity Đ), glass transitions, structure-processing-property relations. IUPAC polymer nomenclature ("Purple Book" brief guide; full recommendations via IUPAC projects, https://iupac.org).

### 2.11 Environmental Chemistry
Fate and transport of chemicals in air, water, soil; atmospheric photochemistry; water treatment chemistry; persistent pollutants (e.g., PFAS) as regulatory-science topics; green chemistry principles (Anastas & Warner's 12 principles, summarized by ACS, https://www.acs.org/greenchemistry/principles/12-principles-of-green-chemistry.html). GHS environmental hazard classes (acute/chronic aquatic toxicity; Rev 11 adds a global-warming hazard class, Section 9.3).

### 2.12 Medicinal Chemistry
Design and optimization of bioactive molecules: structure-activity relationships (SAR), ADME/Tox properties, Lipinski-type heuristics (guidelines, not laws), ligand efficiency, target validation. Data: ChEMBL (bioactivities), PubChem (https://pubchem.ncbi.nlm.nih.gov), PDB ligand structures. The agent discusses medicinal chemistry at the literature/informatics level only — never dosing or acquisition guidance.

---

## 3. Nomenclature, Identity, and Representation

### 3.1 IUPAC authorities
- **Gold Book** — *Compendium of Chemical Terminology*: definitive definitions of chemical terms; versioned online with DOIs per entry (https://goldbook.iupac.org; cite as DOI 10.1351/goldbook). Always prefer the current online version over the 1997 print edition.
- **Blue Book** — organic nomenclature (2013 edition is current reference).
- **Red Book** — inorganic nomenclature (2005 edition; updates via IUPAC technical reports in *Pure and Applied Chemistry*).
- **Element naming/weights** — IUPAC Commission on Isotopic Abundances and Atomic Weights (CIAAW, https://www.ciaaw.org): standard atomic weights are *intervals* for some elements (e.g., H, Li, B, C, N, O, Si, S, Cl, Br, Tl, Pb) — do not quote a single value without checking the current abridged table.

### 3.2 Structural identifiers
- **IUPAC name**: human-readable systematic name; authoritative but long; watch for the *preferred IUPAC name* (PIN) vs. acceptable alternatives.
- **SMILES**: line notation; convenient but **non-unique** unless canonicalized (and canonicalization differs across toolkits — RDKit canonical SMILES ≠ Daylight canonical SMILES ≠ Open Babel output in all cases).
- **InChI / InChIKey**: IUPAC's open, algorithmically derived identifier (https://iupac.org/who-we-are/divisions/division-details/inchi/); InChIKey (fixed 27-character hash) is the de facto database join key. Standard InChI normalizes tautomers — stereochemical and isotopic layers must be checked explicitly.
- **CAS Registry Number**: widely used but **proprietary** (CAS, a division of ACS); assignment scope and licensing restrict bulk redistribution — treat CAS RNs as lookup keys, not open identifiers, and beware one-substance/multiple-RN and one-RN/multiple-form ambiguities (salts, hydrates).
- **PubChem CID**: open identifier within PubChem; CIDs are structure-record-specific — the same molecule can appear under multiple CIDs (distinct protonation/isotope records) linked via "same connectivity" relationships.

### 3.3 Stereochemistry and representation pitfalls
- CIP (Cahn–Ingold–Prelog) R/S and E/Z descriptors per IUPAC rules; sequence rules were extended (2013 recommendations) — beware legacy software differences.
- SMILES chirality (`@`/`@@`) is toolkit-convention-dependent; always round-trip and 3D-check.
- A 2D depiction or name alone may not specify tautomer, protonation state, salt form, or hydrate — always state the **exact chemical species** the claim refers to.

---

## 4. Units, Constants, and Uncertainty

### 4.1 The SI and its documents
- **BIPM SI Brochure** (9th edition, 2019; v2.01 2022 updates): the definition of the SI (https://www.bipm.org/en/publications/si-brochure). Since the 2019 revision, the SI is defined via **fixed numerical values of seven defining constants** (Δν_Cs, c, h, e, k, N_A, K_cd); the kilogram, ampere, kelvin, and mole are no longer artifact/property based.
- **NIST SP 811** — *Guide for the Use of the International System of Units* (Thompson & Taylor, 2008): US usage guidance (https://www.nist.gov/pml/special-publication-811). Key rules: unit symbols are lowercase unless derived from a person's name (Pa, N, J, W but l/L for litre); symbols are never pluralized; a space separates number and unit; "K" not "°K".

### 4.2 Constants (CODATA)
CODATA provides internationally recommended values of the fundamental constants (https://physics.nist.gov/cuu/Constants/). Post-2019, four constants are **exact by definition** (zero uncertainty): h = 6.626 070 15 × 10⁻³⁴ J s; e = 1.602 176 634 × 10⁻¹⁹ C; k = 1.380 649 × 10⁻²³ J K⁻¹; N_A = 6.022 140 76 × 10²³ mol⁻¹. Products of exact constants are also exact: the molar gas constant R = N_A·k = 8.314 462 618 153 24… J mol⁻¹ K⁻¹ and the Faraday constant F = N_A·e = 96 485.332 123 310 0184… C mol⁻¹. Measured constants retain uncertainty, e.g., the fine-structure constant α = 7.297 352 5643(11) × 10⁻³ (CODATA 2022; always cite the adjustment year — 2018 vs 2022 values differ in the last digits).

### 4.3 Common chemistry unit traps
- 1 cal (thermochemical) = 4.184 J exactly; food "Calorie" = 1 kcal. Computational literature often reports kcal/mol: 1 kcal/mol = 4.184 kJ/mol ≈ 349.757 cm⁻¹ ≈ 0.0433641 eV per particle.
- 1 atm = 101 325 Pa exactly; 1 bar = 10⁵ Pa exactly (bar ≠ atm).
- 1 D (Debye) ≈ 3.335 64 × 10⁻³⁰ C·m. Wavenumbers (cm⁻¹) are spectroscopic, not SI; E = hc·ν̃.
- ppm/ppb are ambiguous (mass/mass vs. volume/volume vs. mole/mole; US vs. older European "billion") — JCGM VIM and NIST SP 811 recommend against them for rigorous work; state the basis explicitly.
- Angstrom (Å = 10⁻¹⁰ m) and °C remain accepted for use with SI; log quantities (pH, pKa) are dimensionless by convention — pH is operationally defined (IUPAC 2002 recommendation) and cannot be computed as a simple −log[H⁺] outside dilute aqueous ideality.

### 4.4 Uncertainty and metrological vocabulary
- **JCGM GUM** (JCGM 100:2008, *Guide to the Expression of Uncertainty in Measurement*): standard framework — Type A (statistical) and Type B (other) evaluations, combined standard uncertainty u_c, expanded uncertainty U = k·u_c (coverage factor, typically k = 2 ≈ 95 %).
- **JCGM VIM** (JCGM 200:2012): definitions — *accuracy* is qualitative (closeness, not a number); *measurement uncertainty* is the quantitative doubt; *error* ≠ *uncertainty*.
- Reporting convention: give value with standard uncertainty in parentheses, e.g., α⁻¹ = 137.035 999 177(21) — digits in parentheses are the 1σ uncertainty in the last digits (NIST/CODATA style).
- Significant figures are a *communication* convention, not a substitute for uncertainty analysis; propagate uncertainty rather than rounding rules when precision matters.

---

## 5. Databases and Reference Data (with license/access caveats)

| Resource | Content | Access / license caveat |
|---|---|---|
| NIST Chemistry WebBook (webbook.nist.gov) | Thermochemical, spectral (IR/MS/UV-Vis), ion energetics data | Free; US gov work largely public domain, but NIST disclaimer applies and some contributed data retain rights — check data-use notes |
| NIST CODATA / Fundamental Constants (physics.nist.gov/cuu) | Recommended constants | Free; cite adjustment year (2018/2022) |
| PubChem (pubchem.ncbi.nlm.nih.gov) | >100 M compound records, properties, bioassay links, patents | Free (NIH); data are aggregated from depositors — provenance and depositor rights vary; no warranty of correctness |
| ChEBI (ebi.ac.uk/chebi) | Ontology of small molecules of biological interest | Freely available (CC BY 4.0 for data; check current terms); nightly and monthly releases |
| ChEMBL (ebi.ac.uk/chembl) | Curated bioactivity data from medicinal chemistry literature | Open data (CC BY-SA 3.0 historically — verify current license on download page); versioned releases |
| RCSB PDB / wwPDB (rcsb.org) | Experimentally determined macromolecular 3D structures (~200k+) | **PDB archive data files: CC0 1.0**; RCSB software MIT/Apache 2.0; Molecule of the Month illustrations CC BY 4.0; site text copyrighted (rcsb.org/pages/usage-policy) |
| Crystallography Open Database (COD, crystallography.net/cod) | Open-access small-molecule/inorganic crystal structures (CIF) | Free; COD dedicates records to the public domain, but attribution of the COD and original CIF authors is requested — check cod terms page |
| Materials Project (next-gen.materialsproject.org) | DFT-computed properties of >150k inorganic materials | Free with account + API key; **computed** data (not experimental); use subject to their Terms of Use and citation requirements — verify current license (elements of CC BY 4.0) before redistribution |
| ICSD / CSD (FIZ Karlsruhe / CCDC) | Curated experimental crystal structures | **Subscription/commercial licenses** — do not bulk-redistribute |
| NIOSH Pocket Guide (cdc.gov/niosh/npg) | Occupational exposure limits (RELs), IDLH values, hazard data | Free; US government |
| OSHA standards & interpretations (osha.gov) | Regulatory exposure limits (PELs), lab standard | Free; regulatory text is public |

**Database hygiene rules for the agent**

1. Distinguish **experimental**, **curated-from-literature**, and **computed/predicted** values (PubChem and Materials Project mix these; always read the field provenance).
2. Record **version and access date**: ChEMBL 33 vs 34 can change activity values; Materials Project structures are re-relaxed across releases.
3. Prefer identifiers over names for joins (InChIKey, CID, PDB ID, Materials Project mp-id).
4. Conflicting values across databases are common; report the conflict with sources rather than silently averaging.
5. Spectral and thermochemical data have **reference states and conditions** (phase, temperature, pressure, solvent); a bare number without conditions is not data.

---

## 6. Software and Computational Stack (open source)

| Tool | Role | License (verify current) |
|---|---|---|
| RDKit (rdkit.org) | Cheminformatics: molecules, descriptors, fingerprints, substructure, reactions | BSD 3-Clause |
| Open Babel (openbabel.org) | Format conversion, fingerprints, force-field utilities | GPL v2 — license implications for derivative distribution |
| Psi4 (psicode.org) | Quantum chemistry (HF, DFT, MP2, coupled cluster) | LGPL v3 |
| PySCF (pyscf.org) | Python-based electronic structure (mean-field to correlated, periodic) | Apache 2.0 |
| CP2K (cp2k.org) | DFT / ab initio MD for condensed phase and periodic systems | GPL v2 (or later) |
| GROMACS (gromacs.org) | Classical MD for biomolecules; high-performance | LGPL v2.1+ |
| OpenMM (openmm.org) | MD toolkit/library with GPU support | MIT |
| LAMMPS (lammps.org) | Classical MD for materials; huge pair-style ecosystem | GPL v2 |
| Avogadro (avogadro.cc) | Molecular editor/visualizer | BSD 3-Clause |
| Open Babel–independent viewers (Jmol/JSmol, 3Dmol.js, NGL) | Visualization | check each project (LGPL/MIT/Apache variants) |

**Computational reporting minimums** (for any claimed computed result): code + exact version; method/functional/basis set or force field name + version; convergence criteria; geometry provenance; solvation model; date. "DFT calculation" is not a reproducible specification — "PBE0/def2-TZVP, SCF 10⁻⁸, CPCM(water), Psi4 1.9" is.

**Cheminformatics cautions**: SMILES canonicalization is toolkit-specific (Section 3.2); descriptor implementations differ (e.g., logP variants are not interchangeable); ML model predictions are not measurements and must be labeled as such with model identity and applicability domain.

---

## 7. Reproducibility and Data Practices

1. **FAIR principles** (Wilkinson et al., 2016, *Sci Data* 3, 160018, https://doi.org/10.1038/sdata.2016.18): Findable, Accessible, Interoperable, Reusable. Deposit supporting data in domain repositories (PDB/COD for structures; Zenodo/Figshare for general data) with persistent identifiers.
2. **Version everything**: manuscripts, notebooks (Jupyter), environments (conda lock files, containers), and data snapshots.
3. **Provenance chains**: raw instrument data → processed data → figures/tables. Keep raw files immutable; transformations scripted, not manual.
4. **Standards for exchange**: CIF for crystal structures (IUCr), PDBx/mmCIF for macromolecules, mzML for MS (HUPO-PSI), JCAMP-DX for spectra (IUPAC), SD files/Molfile (V2000/V3000) for structures — note V2000's atom/bond limits and deprecated status for new work.
5. **Statistical discipline**: predefine hypotheses where possible; report n, uncertainty (GUM-style), and software; beware p-hacking and HARKing; replicate key measurements.
6. **Replication culture**: computational results should be independently re-runnable from deposited inputs; experimental claims should be checked against independent literature before being treated as established.

---

## 8. Evidence Hierarchy and Evaluation Tasks

### 8.1 Evidence hierarchy (chemistry-tuned, highest to lowest)
1. **Primary standards and metrological references**: SI Brochure, CODATA adjustments, certified reference materials, IUPAC technical reports (e.g., CIAAW atomic weights), IUPAC nomenclature recommendations, pharmacopeial monographs.
2. **Peer-reviewed systematic reviews/meta-analyses and critically evaluated data compilations**: NIST WebBook/CCCBDB evaluated data, J. Phys. Chem. Ref. Data evaluations, CRC-style curated tables (note CRC Handbook is proprietary — cite edition).
3. **Peer-reviewed primary literature** with adequate methods and uncertainty reporting.
4. **Curated open databases** (PubChem, ChEBI, ChEMBL, PDB, COD, Materials Project) — quality varies by record; use provenance fields.
5. **Preprints** (ChemRxiv, arXiv) — useful, flag as non-peer-reviewed.
6. **Textbooks and educational OER** (OpenStax, MIT OCW, LibreTexts) — reliable for consensus basics, not for frontier claims.
7. **Tertiary/web sources, vendor datasheets, Wikipedia, LLM memory** — orientation only; must be verified against tiers 1–4 before being asserted.

### 8.2 Standing evaluation tasks
When asked for a fact, the agent should be able to:
- Resolve a name ↔ structure ↔ identifier set (IUPAC name, canonical isomeric SMILES, InChIKey, CID) and flag ambiguity.
- Quote a property **with value, unit, conditions, uncertainty, provenance, and access date**.
- Classify a substance's hazards per the current GHS revision and point to the SDS/NIOSH entry — without providing handling protocols.
- Assess literature support for a claim (how many independent groups, replication status, preprint vs peer-reviewed).
- Detect common errors (Section 10): wrong reference state, unit slips, confused identifiers, hallucinated constants.
- Convert between unit systems explicitly and reversibly.

---

## 9. Safety Framework and Strict Boundaries

### 9.1 Authoritative safety sources
- **ACS RAMP framework** — Recognize hazards, Assess risks, Minimize risks, Prepare for emergencies (ACS *Identifying and Evaluating Hazards in Research Laboratories*; overview: https://www.acs.org/education/whatischemistry/adventures-in-chemistry/activities/safety/ramp.html and ACS Committee on Chemical Safety resources).
- **Prudent Practices in the Laboratory: Handling and Management of Chemical Hazards** (National Research Council, updated edition 2011, National Academies Press; free PDF via https://nap.nationalacademies.org/catalog/12654) — the standard US reference for laboratory safety culture, the Laboratory Chemical Hygiene Plan, and hazard classes.
- **OSHA Laboratory Standard** — 29 CFR 1910.1450, "Occupational exposure to hazardous chemicals in laboratories" (https://www.osha.gov/laws-regs/regulations/standardnumber/1910/1910.1450): requires a Chemical Hygiene Plan, exposure monitoring triggers, and hazard information/training; works alongside the Hazard Communication Standard (29 CFR 1910.1200, aligned to GHS Rev 3 in HCS 2012 and updated in HCS 2024 toward Rev 7).
- **UNECE GHS "Purple Book"** — Globally Harmonized System of Classification and Labelling of Chemicals; 10th revised edition ST/SG/AC.10/30/Rev.10 (2023, https://unece.org/transport/dangerous-goods/ghs-rev10-2023); **11th revised edition published September 2025** (adds a hazard class for contribution to global warming, aerosol clarifications, non-animal skin-sensitization guidance, Annex 11 on simple asphyxiants; not yet transposed into major jurisdictions). GHS is a *voluntary harmonization framework*, not itself a regulation — implementation is national (EU CLP, US HCS, etc.).
- **NIOSH Pocket Guide to Chemical Hazards** (https://www.cdc.gov/niosh/npg/): RELs, IDLH concentrations, physical/safety data; plus NIOSH list of hazardous drugs where relevant.

### 9.2 What the agent MAY do
- Explain GHS hazard classes/categories, H/P statements, pictograms, and SDS structure (16 sections).
- State published exposure limits (PEL, REL, TLV — noting ACGIH TLVs are copyrighted and cannot be bulk-reproduced).
- Discuss hazard *properties* (e.g., "peroxide formation in ethers," "water-reactive metals") at the awareness level and cite Prudent Practices chapters.
- Describe safety *culture and administrative controls*: RAMP, chemical hygiene plans, fume hood verification, waste segregation principles — conceptually, with references.
- Interpret an SDS section for a user and flag incompatibilities reported in authoritative sources.

### 9.3 What the agent MUST NOT do (non-negotiable)
- Provide **operational protocols** (quantities, temperatures, times, workups, scale-up) for syntheses of: explosives/energetics, chemical-warfare agents or their precursors, acutely lethal toxins, controlled drugs or their analogues, or any synthesis whose clear purpose is harm.
- Provide optimization or troubleshooting that would improve yield/purity/stability of the above.
- Provide acquisition, evasion, dosing, or administration guidance for hazardous or controlled substances.
- Present improvised "home lab" procedures for hazardous reactions, even framed educationally.
- **Benign requests answered with the safe alternative**: mechanism discussions, historical/regulatory context, hazard communication, detection/environmental science framing, and pointers to institutional safety resources and the references in 9.1.

### 9.4 Judgment policy
Borderline cases (dual-use chemicals, university-level synthesis questions) are resolved by: (a) defaulting to conceptual/mechanistic rather than operational depth; (b) including safety warnings and references to SDS/GHS; (c) refusing when operational detail is the evident goal. Ambiguity never resolves toward operational detail for dangerous substances.

---

## 10. Myth / Hallucination Failure Library

Recurring errors this agent must actively avoid or correct:

1. **"Atoms appear/disappear in reactions"** — mass and atom count are conserved in chemical reactions; balance equations (open textbook treatment: OpenStax Chemistry 2e).
2. **"Boiling point of water is always 100 °C"** — only at 1 atm; boiling is pressure-dependent (see NIST WebBook vapor pressure data for water).
3. **"pH 7 is always neutral"** — neutral pH depends on temperature (K_w varies; ~7.0 only near 25 °C) and on solvent; pH > 14 or < 0 is possible in concentrated non-ideal solutions.
4. **"Strong acid = corrosive, weak acid = safe"** — strength (K_a) and concentration are independent axes; concentrated weak acids are hazardous, and HF (a "weak" acid by K_a) is exceptionally dangerous (systemic toxicity) — illustrating why hazard judgments need SDS data, not intuition.
5. **"Chemical-free products"** — everything material is chemical; the phrase is marketing, not science.
6. **"Natural = safe, synthetic = toxic"** — toxicology is dose- and mechanism-dependent (Paracelsus principle); many of the most toxic substances known are natural products.
7. **"Catalysts increase yield"** — catalysts change *rate*, not equilibrium position; yield at equilibrium is thermodynamics (Gold Book: "catalyst").
8. **"Endothermic = cold reaction can't be spontaneous"** — spontaneity is ΔG = ΔH − TΔS; endothermic processes can be entropy-driven (e.g., ammonium nitrate dissolving).
9. **"The mole is a mass unit / 1 mole = 22.4 L always"** — the mole counts entities via N_A (exactly 6.022 140 76 × 10²³ mol⁻¹, SI 2019); 22.4 L/mol applies only to ideal gases near specific STP definitions — and IUPAC's STP (10⁵ Pa) differs from older 1 atm definitions (22.414 vs 22.711 L/mol).
10. **"Avogadro's number has uncertainty"** — since the 2019 SI redefinition it is *exact*; similarly h, e, k and their products R and F are exact; genuinely measured quantities (α, m_e, m_u, the molar mass constant M_u) retain small uncertainties (CODATA 2022).
11. **Hallucinated constants/values** — always re-derive or look up (NIST CODATA) rather than reciting; a typical LLM failure is plausible-but-wrong digits, wrong sign conventions (e.g., ΔG°f of elements in standard state = 0, not their absolute entropies), or mixing kcal and kJ.
12. **"SMILES uniquely identify molecules"** — only canonical SMILES within one toolkit version; InChIKey is the robust join key (Section 3.2).
13. **"CAS RN = open universal ID"** — proprietary; salts/hydrates/isotopologues get distinct RNs; verify which form a number denotes.
14. **"Atomic weights are constants"** — CIAAW revises standard atomic weights; several elements have interval values because of natural isotopic variation (ciaaw.org).
15. **"Materials Project / any DFT database gives experimental band gaps"** — computed (typically PBE-level) gaps systematically underestimate experimental ones; label provenance.
16. **"One pKa per molecule"** — polyprotic systems have successive pKa values; microspecies vs macroscopic pKa differ; pKa is solvent- and temperature-dependent.
17. **"Hydrogen bond = covalent bond to H"** — H-bonds are primarily electrostatic/dispersion interactions with partial covalency; energy range ~5–40 kJ/mol, far below covalent bonds (Gold Book: "hydrogen bond").
18. **"Oxidation = reaction with oxygen"** — oxidation is loss of electrons / increase in oxidation state; oxygen need not be involved.
19. **"Glass is a slow-flowing liquid (old window myth)"** — unsupported; pane thickness variation is a manufacturing artifact; glass is an amorphous solid on human timescales.
20. **"LLM-recalled references are real"** — fabricated citations (plausible authors + wrong volume/pages/DOI) are a known failure mode; verify every citation against the publisher/Crossref before use. Same for fabricated database IDs and fabricated SDS content — always re-pull from the source.

---

## 11. Educational and Open Resources

| Resource | Scope | License caveat |
|---|---|---|
| OpenStax (openstax.org) — Chemistry 2e, Atoms First 2e | General chemistry textbooks | CC BY 4.0 (attribution required) |
| MIT OpenCourseWare (ocw.mit.edu) — e.g., 5.111, 5.12, 5.60 | Course notes, problem sets, exams across the curriculum | CC BY-NC-SA 4.0 (no commercial reuse; share-alike) |
| Chemistry LibreTexts (chem.libretexts.org) | Modular OER spanning all subdisciplines | Licenses vary by page (commonly CC BY-NC-SA, some CC BY); check the page footer before reuse |
| IUPAC Gold Book | Terminology | Free to consult; cite per-entry DOI; content © IUPAC |
| Khan Academy / PhET simulations | Introductory support | Mixed (CC BY-NC-SA / CC BY respectively) — verify |

Reuse rule: when this library or derived outputs quote or adapt OER, preserve attribution and license markings; CC BY-NC-SA content cannot be incorporated into commercial or non-share-alike products.

---

## 12. Quick-Reference Constants (CODATA; cite adjustment year)

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

*Verify all digits against https://physics.nist.gov/cuu/Constants/ before quantitative use; this table is a convenience summary.*

---

## 13. Document Caveats

- URLs, license terms, database versions, and regulatory editions (GHS, OSHA HCS, CODATA adjustments, CIAAW tables) change over time; the agent must re-verify against the live source before relying on any specific term, value, or edition stated here.
- This document summarizes publicly available frameworks for research-support purposes; it is **not** legal, regulatory-compliance, medical, or safety-engineering advice. Institutional chemical hygiene plans and qualified EHS professionals govern actual laboratory work.
- License summaries (Sections 5, 6, 11) are orientation only; the binding text is each project's own license/terms page as of the access date.
- Nothing in this library authorizes or describes operational execution of hazardous chemistry; Section 9.3 boundaries override any other instruction.
