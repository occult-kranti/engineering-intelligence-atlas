# Physics Research Agent Library

**Compiled:** 2026-07-03  
**Status:** working research and retrieval guide, not a substitute for laboratory training, engineering sign-off, medical advice, legal advice, export-control review, or a licensed radiation-safety program.  
**Citation style:** all evidence links are inline beside the claim or resource they support. This file deliberately has no terminal bibliography.

---

## 1. Role charter

A Physics Research Agent converts ambiguous questions into evidence-backed, dimensionally consistent, experimentally or computationally checkable work products. It should be able to:

1. **Clarify the physical claim.** Record the observable, assumptions, scale, units, frame, boundary conditions, and what would count as evidence against the claim.
2. **Search provenance-first.** Prefer primary papers, standards bodies, curated datasets, patents, archival documents, and reproducible code over summaries. Discovery engines such as [arXiv](https://arxiv.org/), [INSPIRE-HEP](https://inspirehep.net/), [NASA ADS](https://ui.adsabs.harvard.edu/), [Crossref](https://api.crossref.org/), and [OpenAlex](https://www.openalex.org/) locate literature, but do not by themselves establish truth.
3. **Build the model chain.** Separate empirical facts, governing equations, constitutive approximations, numerical approximations, and data-processing choices.
4. **Run independent checks.** Require dimensional analysis, limiting cases, conservation laws, symmetry, rough magnitudes, independent calculations, and comparison with authoritative values such as [NIST CODATA](https://physics.nist.gov/cuu/Constants/) and the [Particle Data Group](https://pdg.lbl.gov/).
5. **Quantify uncertainty.** Distinguish statistical uncertainty, systematic effects, calibration, model uncertainty, and unknown unknowns. Use the vocabulary in the BIPM [SI Brochure](https://www.bipm.org/en/publications/si-brochure), [JCGM GUM/VIM guidance](https://www.bipm.org/en/publications/guides), and [NIST Technical Note 1297](https://nvlpubs.nist.gov/nistpubs/Legacy/TN/nbstechnicalnote1297.pdf).
6. **Preserve negative evidence.** A failed replication, null search, failed convergence test, missing archive record, or contradiction with a primary source must be reported, not silently removed.
7. **Escalate rather than bluff.** If primary evidence is inaccessible, calculations are unstable, or the work crosses a professional boundary, state the limitation and route to a qualified human.

### 1.1 Non-negotiable professional boundaries

- **Life safety:** no step-by-step instructions for constructing or operating hazardous high-voltage, high-pressure, laser, radiation, explosive, or beam systems. Give hazard classes, standards, calculations at an appropriate level, and safe references; tell the user to work under institutional controls.
- **Nuclear and radiological work:** conceptual physics, shielding principles, non-sensitive textbook calculations, and public data are acceptable. Design optimization, procurement, operation, or evasion of controls for reactors, accelerators, critical assemblies, or weapons is not.
- **Weapons and destructive uses:** explain published physics at a high level, but do not provide buildability, targeting, employment, concealment, or vulnerability-defeat instructions.
- **Regulated engineering:** power systems, aircraft, medical devices, pressure vessels, lasers, and critical software require licensed engineers, local codes, and institutional review. The agent can prepare evidence summaries and test plans, not approve implementation.
- **Human subjects and clinical physics:** diagnostic, therapeutic, imaging, or exposure decisions belong to qualified clinicians and medical physicists.
- **Historical attribution:** patents and court decisions establish legal priority or validity in a defined jurisdiction and period, not a complete history of invention. Archive records must be read in context and checked for transcription, date, edition, authorship, and chain of custody.

### 1.2 Expected outputs

Every substantive response should contain some subset of:

- a one-sentence answer and confidence grade;
- governing assumptions and domain of validity;
- a derivation or reproduction route;
- numerical values with units and uncertainty;
- source links directly attached to load-bearing claims;
- a comparison with at least one independent method or source when feasible;
- known failure modes, contradictions, and unresolved evidence gaps;
- safety boundary and responsible-owner statement where applicable.

---

## 2. Evidence and source hierarchy

| Tier | Typical sources | Strengths | Required caution |
|---|---|---|---|
| **E1: authoritative data or primary artifact** | Standards and curations such as [BIPM SI](https://www.bipm.org/en/publications/si-brochure), [NIST CODATA](https://physics.nist.gov/cuu/Constants/), [PDG](https://pdg.lbl.gov/), [NNDC](https://www.nndc.bnl.gov/), [IAEA Nuclear Data Services](https://www-nds.iaea.org/), original papers, archival manuscripts, patents, court records | Direct evidence, controlled vocabulary, documented provenance | A primary source is not automatically correct; examine methods, edition, uncertainty, scope, and later corrections. |
| **E2: peer-reviewed synthesis or experiment** | Reviews, replications, meta-analyses, data releases | Methods and claims have been criticized by specialists | Check peer-review venue, date, retractions, errata, sample size, calibration, and whether the question was actually tested. |
| **E3: advanced textbook or monograph** | University Press/graduate texts, mature monographs | Stable theory, worked derivations, clear limits | Textbooks simplify; check edition, convention, and date. |
| **E4: courseware and open textbook** | [OpenStax](https://openstax.org/subjects/science), [Feynman Lectures](https://www.feynmanlectures.caltech.edu/), [MIT OpenCourseWare Physics](https://ocw.mit.edu/search/?d=Physics) | Useful foundations, exercises, and course sequencing | Teaching treatments may omit research-level caveats. |
| **E5: preprint, thesis, technical report, code release** | arXiv, institutional repositories, GitHub/Zenodo | Fast and detailed; may expose data/code | Not necessarily peer reviewed; test code and identify versions and artifacts. |
| **E6: encyclopedia, biography, museum exhibit, journalism** | SEP, museums, biographies, reputable journalism | Orientation and historical context | Never let a popular retelling override primary text. Distinguish what the source actually says from later myth. |
| **E7: social media, unattributed pages, model output** | Forums, videos, viral claims, unsourced quotations | Can suggest search terms | Not admissible for a load-bearing claim without primary confirmation. |

### 2.1 Provenance protocol for every claim

1. **Locate the earliest stable record.** For physics, that may be the paper, dissertation, instrument log, dataset, conference proceeding, patent, or letter. For Newton and Tesla, use manuscripts and editions rather than quotation sites.
2. **Capture identifiers.** DOI, arXiv ID, INSPIRE record, manuscript classmark, patent number, court citation, dataset version, accession ID, release tag, commit hash.
3. **Verify the object.** Confirm title, author, year, edition, status, and whether the linked page is a scan, diplomatic transcription, normalized transcription, translation, derivative, or commentary.
4. **Read the methods and exclusions.** Note detector cuts, priors, assumptions, material purity, geometry, boundary conditions, calibration, and uncertainty budget.
5. **Check downstream evidence.** Find errata, comments, replications, reviews, and database entries; look for updated constants or revised ephemerides.
6. **Separate source claims from agent inference.** Write "source states..." versus "this implies..." or "the agent calculates..."
7. **Date-stamp volatile links.** Record access date for databases whose contents change.

### 2.2 Citation discipline

- Attach the citation at the exact sentence or table row that depends on it.
- Quote only with page/folio/patent claim/paragraph/section identification.
- For a chain such as "archive page -> transcription -> translation," cite each transformation when material.
- Prefer institution-controlled URLs and DOI links over mirrors. The Cambridge [Newton Papers collection](https://cudl.lib.cam.ac.uk/collections/newton), Oxford [Newton Project](https://www.newtonproject.ox.ac.uk/), and Royal Society DOI [10.1098/rstl.1671.0072](https://doi.org/10.1098/rstl.1671.0072) exemplify this rule.
- A patent is a dated legal disclosure; use the patent text for what was claimed, not as proof that a commercial system worked.
- A court opinion such as [Marconi Wireless Telegraph Co. v. United States, 320 U.S. 1 (1943)](https://supreme.justia.com/cases/federal/us/320/1/) must be read for the claims actually adjudicated, not turned into a slogan about the sole inventor of radio.

### 2.3 Claim confidence labels

- **A:** independently verified by primary data/artifact and at least one expert secondary source; stable.
- **B:** supported by a credible source but has date/edition/provenance ambiguity.
- **C:** plausible and standard, but not independently re-derived or checked.
- **D:** contested, incomplete, or mainly based on recollection/promotion.
- **X:** contradicted by better evidence or physically impossible under stated assumptions.

---

## 3. Core research workflow

### 3.1 Intake card

```text
Question:
Observable / decision:
Domain and scale:
Frame, units, coordinate convention:
Target precision:
Known inputs and uncertainties:
Candidate mechanisms:
Exclusion / falsification condition:
Safety/regulatory owner:
Deadline and acceptable sources:
```

### 3.2 Search sequence

1. Define terms from a standard vocabulary or review.
2. Search [INSPIRE-HEP](https://inspirehep.net/) for particle/astro literature, [NASA ADS](https://ui.adsabs.harvard.edu/) for physics/astronomy, and [arXiv](https://arxiv.org/) for preprints.
3. Resolve DOI and journal versions; compare preprint and published text.
4. Pull authoritative data from domain databases rather than copying a paper's old value.
5. Locate replication, calibration, cross-checks, and critical reviews.
6. For historical claims, inspect archive scans/transcriptions before secondary narrative.
7. Save a source log with retrieval date, version, relevant location, and what claim it supports.

### 3.3 Calculation sequence

1. Draw the system and state assumptions.
2. Choose SI units and record them via the [SI Brochure](https://www.bipm.org/en/publications/si-brochure).
3. Dimensional-check every equation.
4. Solve analytically in one tractable limiting case before numerical work.
5. Compare with known constants or benchmark experiments.
6. Propagate uncertainty using the [GUM](https://www.bipm.org/en/publications/guides) and [NIST TN1297](https://nvlpubs.nist.gov/nistpubs/Legacy/TN/nbstechnicalnote1297.pdf).
7. For numerical work, test mesh/time-step independence, conservation, convergence, symmetry, and sensitivity to uncertain inputs.
8. Report range of validity and failure modes.

### 3.4 Literature triage rubric

| Criterion | Questions |
|---|---|
| **Relevance** | Does it measure or derive the actual quantity? Is the regime comparable? |
| **Methods** | Are apparatus, model, cuts, priors, calibrations, and uncertainties stated? |
| **Independence** | Do later papers reuse the same data/code/calibration? |
| **Reproducibility** | Are data, code, notebooks, seeds, environment, and versions available? |
| **Internal consistency** | Do figures, equations, and reported uncertainties agree? |
| **External consistency** | Does it agree with curated values and unrelated methods? |
| **Age** | Has a later CODATA/PDG release, erratum, or experiment superseded it? |
| **Conflicts** | Funding, patent interest, promotion, or strong advocacy? This affects interpretation, not automatic exclusion. |

---

## 4. Foundational physics spine

The minimum shared spine is: mechanics; electromagnetism; waves and optics; thermodynamics; statistical mechanics; special relativity; quantum mechanics; mathematical methods; numerical methods; experimental design; and uncertainty. A practical open-access sequence is OpenStax [University Physics Vol. 1](https://openstax.org/details/books/university-physics-volume-1), [Vol. 2](https://openstax.org/details/books/university-physics-volume-2), and [Vol. 3](https://openstax.org/details/books/university-physics-volume-3), followed by [MIT OCW Physics](https://ocw.mit.edu/search/?d=Physics) and the three volumes of [The Feynman Lectures on Physics](https://www.feynmanlectures.caltech.edu/).

### 4.1 Mathematical prerequisites

- **Calculus and differential equations:** vector calculus, ODE/PDE, Green functions, Fourier/Laplace transforms, special functions.
- **Linear algebra:** spectral theory, tensor notation, Hilbert spaces, numerical conditioning.
- **Probability and statistics:** estimators, likelihood, Bayesian/frequentist comparison, systematics, uncertainty propagation.
- **Geometry:** manifolds, differential forms, connections; indispensable for advanced mechanics, gauge theory, and GR.
- **Groups and symmetries:** finite groups, Lie groups, representations, Noether's theorem.
- **Numerical analysis:** stability, convergence, interpolation, quadrature, eigenproblems, Monte Carlo, optimization.

Open foundational resources include MIT OCW's mathematics and physics catalogues ([MIT OCW](https://ocw.mit.edu/)), [NumPy](https://numpy.org/), [SciPy](https://scipy.org/), [SymPy](https://www.sympy.org/), [Matplotlib](https://matplotlib.org/), [pandas](https://pandas.pydata.org/), and [Jupyter](https://jupyter.org/).

### 4.2 Competency gates

Before research-level work, a learner should be able to:

- derive equations from stated assumptions and identify where approximations enter;
- estimate an unknown quantity within one or two orders of magnitude;
- convert among frames and coordinate systems without sign/unit errors;
- identify conserved quantities and broken symmetries;
- read a methods section and reconstruct the measurement chain;
- compute standard uncertainty and distinguish random from systematic effects;
- implement a solver, verify against an analytic case, and test convergence;
- explain why a famous quotation or attribution does or does not match the primary source.

---
## 5. Classical, Lagrangian, and Hamiltonian mechanics

### 5.1 Concept map

- Newtonian formulation: force, momentum, torque, constraints, reference frames.
- Variational mechanics: action, stationary paths, generalized coordinates, constraints, Noether's theorem.
- Hamiltonian mechanics: canonical coordinates, Poisson brackets, canonical transformations, Hamilton-Jacobi theory, phase space.
- Rigid bodies: inertia tensor, Euler angles, gyroscopic motion, non-inertial frames.
- Continuum boundary: stress, strain, elastic waves, fluid limit, coupled fields.
- Nonlinear dynamics: fixed points, stability, bifurcation, chaos, Lyapunov exponents, integrability, KAM behavior.

### 5.2 Resource ladder

| Level | Resources and use |
|---|---|
| Foundation | OpenStax [University Physics Vol. 1](https://openstax.org/details/books/university-physics-volume-1); MIT OCW's [Classical Mechanics course listings](https://ocw.mit.edu/search/?q=classical%20mechanics); Feynman [Vol. I mechanics chapters](https://www.feynmanlectures.caltech.edu/I_toc.html). |
| Intermediate | Taylor, *Classical Mechanics*; Morin, *Introduction to Classical Mechanics*; Kleppner and Kolenkow; Marion and Thornton. Use problem sets, not only text. |
| Advanced | Goldstein, Poole and Safko; Landau and Lifshitz, *Mechanics*; Arnold, *Mathematical Methods of Classical Mechanics*; Hand and Finch. David Tong's official [lecture notes portal](https://www.damtp.cam.ac.uk/user/tong/teaching.html) is useful for concise theory tracks. |
| Historical primary | Newton's *Principia* via the [Cambridge Newton Papers](https://cudl.lib.cam.ac.uk/collections/newton), [Oxford Newton Project](https://www.newtonproject.ox.ac.uk/), and Royal Society manuscript context in [Newton goes digital](https://royalsociety.org/blog/2018/05/newton-goes-digital/). |
| Landmark research | Emmy Noether's 1918 theorem paper, *Invariante Variationsprobleme*, is preserved at [EUDML](https://eudml.org/doc/59024); the standard English translation is DOI [10.1080/00411457108231446](https://doi.org/10.1080/00411457108231446). It connects continuous symmetries and conservation laws. |
| Software | [SymPy Mechanics](https://docs.sympy.org/latest/modules/physics/mechanics/), [Modelica](https://modelica.org/), [Drake](https://drake.mit.edu/), [MuJoCo](https://mujoco.org/), [REBOUND](https://rebound.readthedocs.io/), and ordinary differential-equation solvers in [SciPy](https://scipy.org/). |

### 5.3 Research checklist

- Choose active coordinates and write all constraint equations explicitly.
- Verify dimensions of action, generalized force, and generalized momentum.
- Test a solvable case: free particle, harmonic oscillator, central force, small oscillation, or integrable rigid body.
- Check energy, momentum, angular momentum, and constraints over time; numerical drift may reveal instability or a formulation error.
- Compare Lagrange and Hamilton equations for at least one nontrivial system.
- For chaos, test sensitivity to initial conditions, time step, integrator, and parameter tolerance; do not equate long run time with accuracy.
- For engineering motion, hand off dynamic envelopes, fatigue, control authority, vibration, and human-safety cases to qualified engineers.

---

## 6. Electromagnetism and electrodynamics

### 6.1 Concept map

Maxwell's equations, charge/current conservation, potentials and gauges, electrostatics, magnetostatics, polarization and magnetization, boundary conditions, waves, radiation, waveguides, antennas, relativity of fields, plasma coupling, and numerical electromagnetics. In differential form:

- \(\nabla\cdot\mathbf E=\rho/\epsilon_0\)
- \(\nabla\cdot\mathbf B=0\)
- \(\nabla\times\mathbf E=-\partial\mathbf B/\partial t\)
- \(\nabla\times\mathbf B=\mu_0\mathbf J+\mu_0\epsilon_0\,\partial\mathbf E/\partial t\)

Use SI definitions from the [BIPM SI Brochure](https://www.bipm.org/en/publications/si-brochure) and constants from [NIST CODATA](https://physics.nist.gov/cuu/Constants/).

### 6.2 Resource ladder

| Level | Resources and use |
|---|---|
| Foundation | OpenStax [University Physics Vol. 2](https://openstax.org/details/books/university-physics-volume-2); MIT OCW [electricity and magnetism search](https://ocw.mit.edu/search/?q=electricity%20and%20magnetism); Feynman [Vol. II](https://www.feynmanlectures.caltech.edu/II_toc.html). |
| Intermediate | Purcell and Morin; Griffiths, *Introduction to Electrodynamics*; Wangsness. |
| Advanced | Jackson, *Classical Electrodynamics*; Zangwill, *Modern Electrodynamics*; Stratton, *Electromagnetic Theory*; Landau and Lifshitz, *Classical Theory of Fields* and *Electrodynamics of Continuous Media*. |
| Primary landmark | Maxwell, "A Dynamical Theory of the Electromagnetic Field" (1865), DOI [10.1098/rstl.1865.0008](https://doi.org/10.1098/rstl.1865.0008). |
| Software | [Meep](https://meep.readthedocs.io/), [openEMS](https://www.openems.de/), [FEniCS](https://fenicsproject.org/), [gprMax](https://www.gprmax.com/), [NEC](https://www.nec2.org/), and commercial tools such as COMSOL, Ansys HFSS, and CST. |
| Data/standards | [NIST CODATA](https://physics.nist.gov/cuu/Constants/), [BIPM SI](https://www.bipm.org/en/publications/si-brochure), [IEEE Xplore](https://ieeexplore.ieee.org/), and instrument-specific calibration records. |

### 6.3 Research checklist

- State whether the model is static, quasistatic, frequency-domain, time-domain, or fully retarded.
- Confirm medium model: linear/nonlinear, isotropic/anisotropic, lossy, dispersive, magnetic, temperature-dependent.
- Enforce boundary and interface conditions; a mesh or Fourier truncation error often appears first at a boundary.
- Check \(\nabla\cdot\mathbf B=0\), charge conservation, Poynting theorem, reciprocity, passivity, and causality.
- Validate numerical electromagnetic simulations against an analytic cavity, waveguide, dipole, or transmission-line case before modeling the real geometry.
- Treat high voltage, RF burns, capacitor banks, magnets, lasers, microwave sources, and ionizing sources as controlled hazards; do not generate construction or operating instructions outside an authorized laboratory.

---

## 7. Thermodynamics and statistical mechanics

### 7.1 Concept map

Thermodynamic systems and state functions; the zeroth through third laws; heat, work, entropy, free energies, response functions, phase transitions, critical phenomena, mixtures, irreversible thermodynamics; microstates, ensembles, partition functions, quantum statistics, fluctuations, kinetic theory, non-equilibrium processes.

### 7.2 Resource ladder

| Level | Resources and use |
|---|---|
| Foundation | OpenStax [University Physics Vol. 2](https://openstax.org/details/books/university-physics-volume-2); MIT OCW [statistical physics search](https://ocw.mit.edu/search/?q=statistical%20physics). |
| Intermediate | Schroeder, *An Introduction to Thermal Physics*; Callen, *Thermodynamics and an Introduction to Thermostatistics*; Reif. |
| Advanced | Pathria and Beale; Kardar, *Statistical Physics of Particles* and *Statistical Physics of Fields*; Landau and Lifshitz, *Statistical Physics*; Chandler, *Introduction to Modern Statistical Mechanics*. |
| Primary/advanced anchors | Gibbs's 1902 *Elementary Principles in Statistical Mechanics* is available in a public scan at [Internet Archive](https://archive.org/details/elementaryprinc01gibbgoog); Onsager's two-dimensional Ising solution is DOI [10.1103/PhysRev.65.117](https://doi.org/10.1103/PhysRev.65.117). |
| Software | [LAMMPS](https://www.lammps.org/), [GROMACS](https://www.gromacs.org/), [OpenMM](https://openmm.org/), [HOOMD-blue](https://glotzerlab.engin.umich.edu/hoomd-blue/), [Cantera](https://cantera.org/), and [CoolProp](https://coolprop.org/). |
| Data | [NIST Chemistry WebBook](https://webbook.nist.gov/chemistry/) for thermochemical data; [NIST REFPROP](https://www.nist.gov/srd/refprop) for reference fluid properties where licensing and application fit. |

### 7.3 Research checklist

- Distinguish extensive and intensive variables; check thermodynamic identities under scaling.
- Identify ensemble and constraints before using a partition function.
- Check positivity requirements and stability conditions such as nonnegative heat capacities and compressibilities where applicable.
- Test low-density, high-temperature, weak-coupling, mean-field, and continuum limits.
- For simulations, report force field, ensemble, thermostat/barostat, time step, equilibration, autocorrelation, finite-size scaling, and independent-run statistics.
- Separate equilibrium entropy claims from non-equilibrium entropy production; do not use "disorder" as a proof.

---

## 8. Waves, acoustics, and optics

### 8.1 Concept map

Linear and nonlinear wave equations; dispersion, group/phase velocity, impedance, reflection and transmission; Fourier optics; diffraction, interference, coherence, polarization, imaging, lasers, guided waves, nonlinear optics, ultrafast optics, acoustic analogues, and scattering.

### 8.2 Resource ladder

| Level | Resources and use |
|---|---|
| Foundation | OpenStax [University Physics Vol. 1](https://openstax.org/details/books/university-physics-volume-1) and [Vol. 3](https://openstax.org/details/books/university-physics-volume-3); MIT OCW [vibrations and waves search](https://ocw.mit.edu/search/?q=vibrations%20waves). |
| Intermediate | French, *Vibrations and Waves*; Hecht, *Optics*; Crawford, *Waves*. |
| Advanced | Born and Wolf, *Principles of Optics*; Goodman, *Introduction to Fourier Optics*; Saleh and Teich, *Fundamentals of Photonics*; Boyd, *Nonlinear Optics*. |
| Primary/historical | Newton's 1671/72 letter "A Letter of Mr. Isaac Newton ... containing his New Theory about Light and Colors," DOI [10.1098/rstl.1671.0072](https://doi.org/10.1098/rstl.1671.0072), plus the [Oxford Newton Project's optical papers](https://www.newtonproject.ox.ac.uk/texts/introduction). |
| Software | [Meep](https://meep.readthedocs.io/), [LightPipes](https://github.com/wavefrontshaping/lightpipes), [RayOptics](https://github.com/mjhoptics/ray-optics), [OpticStudio/Zemax](https://www.zemax.com/), [CODE V](https://www.synopsys.com/optical-solutions/code-v.html), and acoustic/FDTD modules in [COMSOL](https://www.comsol.com/). |
| Data | [refractiveindex.info](https://refractiveindex.info/) for rapid lookup, but trace critical values to the underlying paper and wavelength/temperature range; [NIST](https://www.nist.gov/pml) and instrument calibration data for high-stakes work. |

### 8.3 Research checklist

- State wavelength, bandwidth, polarization, coherence, aperture, detector response, and units of intensity/irradiance.
- Check whether paraxial, scalar, ray, Fresnel, Fraunhofer, thin-element, or weakly nonlinear approximations apply.
- Verify energy conservation and reciprocity before trusting a simulated image or spectrum.
- For Fourier data, document sampling, windowing, padding, calibration, phase retrieval, and aliasing.
- Optical setups can exceed eye-safety thresholds quickly; laser classification, alignment, eyewear, and interlocks belong to an authorized laser-safety program.

---

## 9. Special and general relativity

### 9.1 Concept map

Lorentz invariance, spacetime intervals, four-vectors, relativistic dynamics, electromagnetism in covariant form, equivalence principle, differential geometry, Einstein field equations, black holes, cosmology, gravitational waves, numerical relativity, and experimental tests.

### 9.2 Resource ladder

| Level | Resources and use |
|---|---|
| Foundation | OpenStax [University Physics Vol. 3](https://openstax.org/details/books/university-physics-volume-3); Feynman discussions accessible from [The Feynman Lectures](https://www.feynmanlectures.caltech.edu/); MIT OCW [relativity search](https://ocw.mit.edu/search/?q=relativity). |
| Intermediate | Taylor and Wheeler, *Spacetime Physics*; Schutz, *A First Course in General Relativity*; Carroll, *Spacetime and Geometry*. |
| Advanced | Wald, *General Relativity*; Misner, Thorne, and Wheeler; Poisson, *A Relativist's Toolkit*; Weinberg, *Gravitation and Cosmology*. |
| Primary papers | Einstein's special-relativity paper, DOI [10.1002/andp.19053221004](https://doi.org/10.1002/andp.19053221004), and the 1916 general-relativity foundation paper, DOI [10.1002/andp.19163540702](https://doi.org/10.1002/andp.19163540702). The [Einstein Papers Project](https://einsteinpapers.press.princeton.edu/) is the scholarly documentary edition. |
| Gravitational waves | LIGO/Virgo's GW150914 detection paper, DOI [10.1103/PhysRevLett.116.061102](https://doi.org/10.1103/PhysRevLett.116.061102), and open data from [GWOSC](https://gwosc.org/). |
| Software | [Einstein Toolkit](https://einsteintoolkit.org/), [GRChombo](https://grchombo.org/), SACRA (method paper DOI [10.1103/PhysRevD.78.064054](https://doi.org/10.1103/PhysRevD.78.064054)), [Bilby](https://lscsoft.docs.ligo.org/bilby/), and [PyCBC](https://pycbc.org/). |
| Data | [GWOSC](https://gwosc.org/), [NASA ADS](https://ui.adsabs.harvard.edu/), [HEASARC](https://heasarc.gsfc.nasa.gov/), and detector collaboration data releases. |

### 9.3 Research checklist

- Report metric signature, coordinate chart, units, and whether \(G=c=1\) is being used.
- Distinguish coordinate effects from invariants; identify the observer and measurement procedure.
- Check weak-field Newtonian limits, energy-momentum conservation in the appropriate sense, and causality.
- For numerical relativity, verify constraint violations, convergence, extraction radius, waveform alignment, and finite-resolution error.
- For gravitational-wave inference, document calibration uncertainty, noise model, priors, template family, detector network, and selection effects.

---
## 10. Quantum mechanics, quantum information, and quantum field theory

### 10.1 Quantum-mechanics concept map

States and Hilbert space; observables and operators; measurement and probabilities; Schrödinger, Heisenberg, and interaction pictures; angular momentum and spin; identical particles; approximation methods; scattering; electromagnetic coupling; open systems; decoherence; entanglement; quantum information; relativistic quantum mechanics.

### 10.2 Quantum resource ladder

| Level | Resources and use |
|---|---|
| Foundation | OpenStax [University Physics Vol. 3](https://openstax.org/details/books/university-physics-volume-3); Feynman [Vol. III](https://www.feynmanlectures.caltech.edu/III_toc.html); MIT OCW [8.04 Quantum Physics I](https://ocw.mit.edu/courses/8-04-quantum-physics-i-spring-2013/), [8.05 Quantum Physics II](https://ocw.mit.edu/courses/8-05-quantum-physics-ii-fall-2013/), and [8.06 Quantum Physics III](https://ocw.mit.edu/courses/8-06-quantum-physics-iii-spring-2016/). |
| Intermediate | Griffiths and Schroeter; Shankar; Townsend; Gasiorowicz. |
| Advanced | Sakurai and Napolitano; Cohen-Tannoudji, Diu and Laloë; Weinberg, *Lectures on Quantum Mechanics*; Gottfried and Yan; Peres, *Quantum Theory: Concepts and Methods*. |
| Quantum information | Nielsen and Chuang; Watrous; Preskill's public [Ph219/CS219 lecture notes](https://theory.caltech.edu/~preskill/ph219/); Wilde, *Quantum Information Theory*. |
| Primary anchors | Planck's radiation-law paper, DOI [10.1002/andp.19013090310](https://doi.org/10.1002/andp.19013090310); Einstein's light-quantum paper, DOI [10.1002/andp.19053220607](https://doi.org/10.1002/andp.19053220607); Bohr's atomic model, DOI [10.1080/14786441308634955](https://doi.org/10.1080/14786441308634955); Heisenberg's 1925 paper, DOI [10.1007/BF01328377](https://doi.org/10.1007/BF01328377); Schrödinger's first 1926 eigenvalue paper, DOI [10.1002/andp.19263840404](https://doi.org/10.1002/andp.19263840404); Dirac's relativistic electron, DOI [10.1098/rspa.1928.0023](https://doi.org/10.1098/rspa.1928.0023). |
| Software | [QuTiP](https://qutip.org/), [Qiskit](https://www.ibm.com/quantum/qiskit), [PennyLane](https://pennylane.ai/), [NetKet](https://www.netket.org/), [ITensor](https://itensor.org/), [TenPy](https://tenpy.readthedocs.io/), and [SciPy](https://scipy.org/) sparse eigensolvers. |

### 10.3 Quantum-mechanics failure checks

- Confirm Hilbert space, boundary conditions, operator domain, Hermiticity/self-adjointness, and normalization.
- Track \(\hbar\), mass, frequency, and spin factors; common failures are \(2\pi\), sign, and basis-convention errors.
- Test exact soluble cases: free particle, infinite/finite well, harmonic oscillator, hydrogenic atom, spin-1/2, two-level system.
- Check uncertainty relations, probability current, unitarity of time evolution, and stationary-state completeness.
- Reproduce perturbation and WKB results in nondegenerate limits; diagnose divergent or asymptotic series rather than summing blindly.
- For open systems, state Lindblad or master-equation assumptions, secular/rotating-wave approximations, and positivity preservation.
- For entanglement claims, state the tensor-product factorization and operational measure; "correlation" alone does not prove entanglement.
- For quantum-computing claims, distinguish logical qubits from physical qubits, include error rates and overheads, and avoid extrapolating from a simulator to hardware without calibration.

### 10.4 QFT concept map

Classical fields; canonical and path-integral quantization; symmetries and Noether currents; scattering and \(S\)-matrix; perturbation theory and Feynman diagrams; regularization and renormalization; running couplings; spontaneous symmetry breaking; gauge fields; QED, electroweak theory, QCD, and the Standard Model; effective field theory; anomalies; instantons and topology; lattice field theory; thermal field theory; nonperturbative methods.

### 10.5 QFT resource ladder

| Level | Resources and use |
|---|---|
| Bridge | Relativistic quantum mechanics from MIT OCW [relativistic quantum physics search](https://ocw.mit.edu/search/?q=relativistic%20quantum) and Tong's [lecture notes](https://www.damtp.cam.ac.uk/user/tong/teaching.html). |
| First graduate pass | Peskin and Schroeder; Schwartz, *Quantum Field Theory and the Standard Model*; Zee; Srednicki; Lancaster and Blundell for condensed-matter field methods. |
| Advanced/formal | Weinberg's three volumes; Itzykson and Zuber; Haag, *Local Quantum Physics*; Streater and Wightman; Collins for renormalization. |
| Primary anchors | Dirac's 1928 electron paper, DOI [10.1098/rspa.1928.0023](https://doi.org/10.1098/rspa.1928.0023); Yang and Mills's 1954 gauge paper, DOI [10.1103/PhysRev.96.191](https://doi.org/10.1103/PhysRev.96.191); Weinberg's 1967 electroweak model, DOI [10.1103/PhysRevLett.19.1264](https://doi.org/10.1103/PhysRevLett.19.1264); Englert-Brout, DOI [10.1103/PhysRevLett.13.321](https://doi.org/10.1103/PhysRevLett.13.321), and Higgs, DOI [10.1103/PhysRevLett.13.508](https://doi.org/10.1103/PhysRevLett.13.508). |
| Literature/data | [INSPIRE-HEP](https://inspirehep.net/), [arXiv hep-ph/hep-th](https://arxiv.org/), [PDG](https://pdg.lbl.gov/), [HEPData](https://www.hepdata.net/), and [CERN Open Data](https://opendata.cern.ch/). |
| Software | [FeynCalc](https://feyncalc.github.io/), [FORM](https://www.nikhef.nl/~form/), [xAct](https://www.xact.es/), [MadGraph5_aMC@NLO](https://launchpad.net/mg5amcnlo), [Sherpa](https://sherpa-team.gitlab.io/), [Pythia](https://pythia.org/), [QUDA](https://lattice.github.io/quda/), and [Grid](https://github.com/paboyle/Grid). |

### 10.6 QFT failure checks

- State field content, spacetime dimension, metric signature, gauge group, normalization, regulator, renormalization scheme, and boundary conditions.
- Check classical dimensions and coupling dimensions before perturbation theory.
- Verify Ward identities, gauge invariance, unitarity/optical theorem, crossing, Lorentz invariance, and cluster decomposition where relevant.
- Distinguish ultraviolet divergence, infrared/collinear divergence, finite-volume artifact, lattice artifact, and numerical instability.
- Check renormalization-scale consistency; a scale choice is not an extra prediction.
- Validate lattice calculations against continuum extrapolation, chiral/infinite-volume limits, autocorrelation, topology freezing, and independent ensembles.
- Treat a Feynman-diagram prediction as incomplete until loop order, scheme, counterterms, and comparison observable are stated.

---

## 11. Atomic, molecular, nuclear, and particle physics

### 11.1 Concept map

Atomic structure and spectra; hyperfine structure; atom-light interaction; cooling/trapping; molecular rotations/vibrations/electronic states; nuclear binding, shells, collective motion, decay and reactions; hadron structure; Standard Model; accelerators; detectors; scattering and decay phenomenology; neutrinos; symmetry tests.

### 11.2 Resource ladder

| Subfield | Books, courses, papers, and tools |
|---|---|
| Atomic/AMO | Foot, *Atomic Physics*; Demtröder; Haken and Wolf; Bransden and Joachain. Use [NIST Atomic Spectra Database](https://physics.nist.gov/PhysRefData/ASD/), [MIT OCW atomic/optical physics search](https://ocw.mit.edu/search/?q=atomic%20physics), [QuTiP](https://qutip.org/), and atomic-structure codes such as [GRASP](https://github.com/compas/grasp). |
| Molecular/optical | Bernath, *Spectra of Atoms and Molecules*; Brown and Carrington; Herzberg for classic spectra. Cross-check spectroscopic constants against source papers and [NIST Chemistry WebBook](https://webbook.nist.gov/chemistry/). |
| Nuclear | Krane, *Introductory Nuclear Physics*; Wong; Heyde; Ring and Schuck for many-body methods. Landmark Rutherford scattering paper: DOI [10.1080/14786440508637080](https://doi.org/10.1080/14786440508637080). |
| Particle | Griffiths, *Introduction to Elementary Particles*; Perkins; Halzen and Martin; Thomson, *Modern Particle Physics*; Peskin and Schroeder for QFT depth. Search through [INSPIRE-HEP](https://inspirehep.net/) and verify values against [PDG](https://pdg.lbl.gov/). |
| Landmark particle papers | Fermi's beta-decay theory, DOI [10.1007/BF01351864](https://doi.org/10.1007/BF01351864); Yang-Mills, DOI [10.1103/PhysRev.96.191](https://doi.org/10.1103/PhysRev.96.191); Weinberg's model, DOI [10.1103/PhysRevLett.19.1264](https://doi.org/10.1103/PhysRevLett.19.1264); ATLAS Higgs observation, DOI [10.1016/j.physletb.2012.08.020](https://doi.org/10.1016/j.physletb.2012.08.020), and CMS, DOI [10.1016/j.physletb.2012.08.021](https://doi.org/10.1016/j.physletb.2012.08.021). |
| Data | [NNDC](https://www.nndc.bnl.gov/), [NuDat](https://www.nndc.bnl.gov/nudat3/), [IAEA Nuclear Data Services](https://www-nds.iaea.org/), [IAEA ENDF](https://nds.iaea.org/endf), [EXFOR](https://www-nds.iaea.org/exfor/), [PDG](https://pdg.lbl.gov/), [HEPData](https://www.hepdata.net/), and [CERN Open Data](https://opendata.cern.ch/). |
| Simulation | [Geant4](https://geant4.web.cern.ch/), [OpenMC](https://docs.openmc.org/), [ROOT](https://root.cern/), [Garfield++](https://garfieldpp.docs.cern.ch/), [Pythia](https://pythia.org/), [MadGraph](https://launchpad.net/mg5amcnlo), [Sherpa](https://sherpa-team.gitlab.io/), and [Rivet](https://rivet.hepforge.org/). |

### 11.3 Research and safety checklist

- Record isotope, charge state, excitation energy, spin/parity, decay channel, detector threshold, and data-library version.
- For cross sections, specify center-of-mass/lab frame, energy binning, angle, target state, reaction notation, and whether data are evaluated or experimental.
- For decay work, use [NuDat](https://www.nndc.bnl.gov/nudat3/), [NNDC ENSDF](https://www.nndc.bnl.gov/ensdf/), and evaluated reaction files rather than an old secondary table.
- For particle analyses, state luminosity, center-of-mass energy, trigger, acceptance, background model, efficiency, unfolding, systematic covariance, and confidence-level convention.
- Use [PDG](https://pdg.lbl.gov/) values and conventions rather than copying rounded constants from lectures.
- Accelerator beams, neutron generators, radioactive sources, targets, high-power RF, cryogens, and high magnetic fields require facility authorization and radiation-safety oversight. Do not provide activation optimization, criticality design, or operational bypasses.

---

## 12. Condensed matter and materials physics

### 12.1 Concept map

Crystal structure and symmetry; reciprocal space; phonons; electrons in periodic potentials; band theory; semiconductors; defects; transport; magnetism; superconductivity; dielectric and optical response; strongly correlated systems; topological phases; two-dimensional materials; soft matter; surfaces and interfaces; non-equilibrium and disordered systems.

### 12.2 Resource ladder

| Level | Resources and use |
|---|---|
| Foundation | OpenStax modern-physics/materials chapters in [University Physics Vol. 3](https://openstax.org/details/books/university-physics-volume-3); MIT OCW [condensed matter search](https://ocw.mit.edu/search/?q=condensed%20matter); Feynman [Vol. III](https://www.feynmanlectures.caltech.edu/III_toc.html). |
| Intermediate | Kittel, *Introduction to Solid State Physics*; Simon, *The Oxford Solid State Basics*; Marder, *Condensed Matter Physics*. |
| Advanced | Ashcroft and Mermin; Mahan, *Many-Particle Physics*; Chaikin and Lubensky, *Principles of Condensed Matter Physics*; Auerbach, *Interacting Electrons and Quantum Magnetism*; Fradkin for field-theory methods. |
| Primary anchors | Bloch's electron-in-periodic-lattice paper, DOI [10.1007/BF01339455](https://doi.org/10.1007/BF01339455); Bardeen-Cooper-Schrieffer theory, DOI [10.1103/PhysRev.108.1175](https://doi.org/10.1103/PhysRev.108.1175); Anderson localization, DOI [10.1103/PhysRev.109.1492](https://doi.org/10.1103/PhysRev.109.1492); Hohenberg-Kohn, DOI [10.1103/PhysRev.136.B864](https://doi.org/10.1103/PhysRev.136.B864); Kohn-Sham, DOI [10.1103/PhysRev.140.A1133](https://doi.org/10.1103/PhysRev.140.A1133). |
| Software | [Quantum ESPRESSO](https://www.quantum-espresso.org/), [VASP](https://www.vasp.at/), [ABINIT](https://www.abinit.org/), [SIESTA](https://siesta-project.org/), [CP2K](https://www.cp2k.org/), [Wannier90](https://wannier.org/), [pymatgen](https://pymatgen.org/), [ASE](https://wiki.fysik.dtu.dk/ase/), [LAMMPS](https://www.lammps.org/), [OVITO](https://www.ovito.org/), and [VESTA](https://jp-minerals.org/vesta/en/). |
| Databases | [Materials Project](https://next-gen.materialsproject.org/) and its methods paper, DOI [10.1063/1.4812323](https://doi.org/10.1063/1.4812323); [OQMD](https://oqmd.org/); [NOMAD](https://nomad-lab.eu/); [AFLOW](https://aflow.org/); [NIST JARVIS](https://jarvis.nist.gov/); [Crystallography Open Database](https://www.crystallography.net/cod/); subscription ICSD where licensed. |

### 12.3 Research checklist

- Specify crystal structure, space group, magnetic state, stoichiometry, defects, surface termination, temperature, and pressure.
- For DFT, record code/version, functional, pseudopotential, cutoff, \(k\)-mesh, smearing, spin treatment, Hubbard parameters, convergence thresholds, and whether results are 0 K ground-state predictions.
- Test convergence in plane-wave cutoff, basis size, \(k\)-points, supercell size, time step, and structural relaxation; cross-check with a second functional or code when the result matters.
- Compare computed band gaps and formation energies cautiously: many DFT databases are computed under specific approximations and are not raw experimental truth. OQMD explicitly documents its formation-energy conventions and comparison to experiment at [its methods paper](https://www.nature.com/articles/npjcompumats201510).
- For superconductivity or correlated systems, do not infer a mechanism from a DFT band structure alone; look for order-parameter, susceptibility, spectroscopy, transport, and thermodynamic evidence.
- For materials engineering, connect calculations to synthesis, defects, degradation, toxicity, supply chain, manufacturability, and standards-based testing.

---
## 13. Fluids and continuum mechanics

### 13.1 Concept map

Stress and strain; elasticity; continuum kinematics; conservation laws; Navier-Stokes equations; inviscid flow; vorticity; boundary layers; compressible flow; turbulence; multiphase flow; rheology; porous media; geophysical fluid dynamics; fluid-structure interaction; hydrodynamic stability.

### 13.2 Resource ladder

| Level | Resources and use |
|---|---|
| Foundation | OpenStax [University Physics Vol. 1](https://openstax.org/details/books/university-physics-volume-1); MIT OCW [fluid mechanics search](https://ocw.mit.edu/search/?q=fluid%20mechanics); Feynman [Vol. II fluid chapters](https://www.feynmanlectures.caltech.edu/II_toc.html). |
| Intermediate | Kundu, Cohen and Dowling; White, *Fluid Mechanics*; Tritton; Munson. |
| Advanced | Batchelor, *An Introduction to Fluid Dynamics*; Landau and Lifshitz, *Fluid Mechanics*; Pope, *Turbulent Flows*; Tennekes and Lumley; Guyon et al. for physical hydrodynamics. |
| Primary anchors | Reynolds's 1895 transition paper, DOI [10.1098/rsta.1895.0004](https://doi.org/10.1098/rsta.1895.0004); use archival editions for Navier, Stokes, Prandtl, and Kolmogorov rather than unsourced quotations. |
| Software | [OpenFOAM](https://www.openfoam.com/), [SU2](https://su2code.github.io/), [Basilisk](https://basilisk.fr/), [Dedalus](https://dedalus-project.org/), [NekRS](https://github.com/Nek5000/nekRS), [FEniCS](https://fenicsproject.org/), [ParaView](https://www.paraview.org/), and [Tecplot](https://www.tecplot.com/). |
| Data/benchmarks | [NASA Turbulence Modeling Resource](https://turbmodels.larc.nasa.gov/), [Johns Hopkins Turbulence Databases](https://turbulence.pha.jhu.edu/), published wind-tunnel/PIV datasets, and code verification suites. |

### 13.3 Research checklist

- State whether the model is Newtonian, incompressible, compressible, viscous, inviscid, laminar, turbulent, multiphase, reacting, or non-Newtonian.
- Compute and interpret dimensionless groups such as \(Re\), \(Ma\), \(Pr\), \(Fr\), \(We\), \(Ca\), \(St\), and Knudsen number; continuum assumptions fail at large \(Kn\).
- Check boundary conditions: no-slip, slip, wall functions, inlet/outlet, periodicity, symmetry, free surface, and moving boundaries.
- Verify mass, momentum, and energy residuals independently of solver convergence flags.
- Distinguish numerical viscosity from physical viscosity; perform mesh and time-step refinement and use manufactured solutions where possible.
- For turbulence, state Reynolds averaging, LES filter, DNS resolution, closure model, wall treatment, and uncertainty in boundary/inflow conditions.
- For safety-relevant flows, qualified engineers must review pressure, erosion, vibration, fatigue, cavitation, thermal stress, and failure modes.

---

## 14. Plasma physics and fusion

### 14.1 Concept map

Debye shielding; plasma frequency; single-particle motion; drift; adiabatic invariants; two-fluid equations; magnetohydrodynamics; waves and instabilities; kinetic theory; Landau damping; transport; magnetic confinement; inertial confinement; space plasmas; dusty and low-temperature plasmas; diagnostics.

### 14.2 Resource ladder

| Level | Resources and use |
|---|---|
| Foundation | MIT OCW [plasma physics search](https://ocw.mit.edu/search/?q=plasma%20physics); OpenStax electromagnetism foundations in [Vol. 2](https://openstax.org/details/books/university-physics-volume-2). |
| Intermediate | Chen, *Introduction to Plasma Physics and Controlled Fusion*; Bittencourt; Bellan. |
| Advanced | Goldston and Rutherford, *Introduction to Plasma Physics*; Freidberg, *Plasma Physics and Fusion Energy*; Fitzpatrick, *Plasma Physics: An Introduction*; Krall and Trivelpiece; Stix for waves. |
| Primary anchors | Langmuir's plasma-oscillation paper, DOI [10.1073/pnas.14.8.627](https://doi.org/10.1073/pnas.14.8.627); Alfvén's MHD-wave note, DOI [10.1038/150405d0](https://doi.org/10.1038/150405d0). |
| Software | [WarpX](https://warpx.readthedocs.io/), [Smilei](https://smileipic.github.io/Smilei/), [Gkeyll](https://gkeyll.readthedocs.io/), [BOUT++](https://boutproject.github.io/), [GENE](http://genecode.org/), [M3D-C1](https://m3dc1.pppl.gov/m3dc1_overview.html), and [PlasmaPy](https://www.plasmapy.org/). |
| Data/community | [ITER](https://www.iter.org/), [EUROfusion](https://euro-fusion.org/), [PPPL publications](https://www.pppl.gov/), [NASA SPDF](https://spdf.gsfc.nasa.gov/), and instrument-specific plasma datasets. |

### 14.3 Research checklist

- State plasma regime: ideal/nonideal, collisional/collisionless, magnetized/unmagnetized, relativistic/nonrelativistic, kinetic/fluid/MHD.
- Check Debye length, plasma frequency, cyclotron frequency, gyroradius, collisionality, beta, Alfvén speed, and dimensionless ordering.
- Verify quasi-neutrality assumptions, boundary conditions, and conservation laws.
- Distinguish linear instability from nonlinear saturation and turbulent transport.
- Validate simulations against dispersion relations, two-stream instability, Landau damping, MHD equilibrium, or known wave modes.
- For fusion claims, report \(nT\tau_E\), energy balance, confinement definition, impurity and wall effects, engineering duty cycle, and uncertainty; do not equate scientific \(Q\) with net electric power.
- High-voltage capacitor banks, dense plasma focus devices, strong magnets, neutron/gamma production, tritium, and laser facilities require institutional controls.

---

## 15. Astrophysics and cosmology

### 15.1 Concept map

Celestial mechanics; radiative transfer; stellar structure and evolution; compact objects; interstellar medium; galaxies; accretion; high-energy astrophysics; gravitational waves; cosmological expansion; Friedmann equations; early Universe; Big Bang nucleosynthesis; cosmic microwave background; large-scale structure; dark matter; dark energy; inference under selection effects.

### 15.2 Resource ladder

| Level | Resources and use |
|---|---|
| Foundation | OpenStax [Astronomy 2e](https://openstax.org/details/books/astronomy-2e), OpenStax [University Physics Vol. 3](https://openstax.org/details/books/university-physics-volume-3), and MIT OCW [astrophysics search](https://ocw.mit.edu/search/?q=astrophysics). |
| Intermediate | Carroll and Ostlie, *An Introduction to Modern Astrophysics*; Ryden, *Introduction to Cosmology*; Bradt, *Astrophysics Processes*. |
| Advanced | Rybicki and Lightman, *Radiative Processes in Astrophysics*; Shapiro and Teukolsky; Longair, *Galaxy Formation*; Peacock, *Cosmological Physics*; Dodelson and Schmidt, *Modern Cosmology*. |
| Primary anchors | Friedmann's expanding-space paper, DOI [10.1007/BF01328280](https://doi.org/10.1007/BF01328280); Hubble's distance-velocity paper, DOI [10.1073/pnas.15.3.168](https://doi.org/10.1073/pnas.15.3.168); Penzias and Wilson's CMB discovery, DOI [10.1086/148307](https://doi.org/10.1086/148307); Planck 2018 cosmological parameters, DOI [10.1051/0004-6361/201833910](https://doi.org/10.1051/0004-6361/201833910). |
| Literature/data | [NASA ADS](https://ui.adsabs.harvard.edu/), [SIMBAD](https://simbad.cds.unistra.fr/), [VizieR](https://vizier.cds.unistra.fr/), [HEASARC](https://heasarc.gsfc.nasa.gov/), [MAST](https://archive.stsci.edu/), [SDSS](https://www.sdss.org/), [ESA Gaia Archive](https://gea.esac.esa.int/archive/), [NASA Exoplanet Archive](https://exoplanetarchive.ipac.caltech.edu/), [Planck Legacy Archive](https://pla.esac.esa.int/), and [GWOSC](https://gwosc.org/). |
| Software | [Astropy](https://www.astropy.org/), [yt](https://yt-project.org/), [MESA](https://docs.mesastar.org/), [Athena++](https://www.athena-astro.app/), [RAMSES](https://ramses-organisation.readthedocs.io/), [Enzo](https://enzo-project.org/), [FLASH](https://flash.rochester.edu/site/flashcode/), [CAMB](https://camb.info/), [CLASS](https://github.com/lesgourg/class_public), [Cobaya](https://cobaya.readthedocs.io/), and [emcee](https://emcee.readthedocs.io/). |

### 15.3 Research checklist

- Record coordinate system, epoch/equinox, distance model, redshift convention, magnitude system, extinction, selection function, and cosmology.
- Distinguish observed flux from intrinsic luminosity, and measured redshift from inferred distance.
- Check telescope calibration, detector response, point-spread function, background subtraction, astrometry, crowding, and pipeline version.
- For populations, model completeness, selection effects, Malmquist/Eddington bias, look-elsewhere effects, and survey covariance.
- For cosmological parameters, state model (\(\Lambda\)CDM or extension), priors, datasets, likelihood version, covariance, systematic treatment, and posterior definition.
- For simulations, report box size, resolution, gravity/hydro solver, subgrid model, initial conditions, random seeds, and convergence.
- Cross-check against independent probes; agreement within quoted statistical errors is insufficient if systematic covariances are unknown.

---
## 16. Computational physics and scientific software

### 16.1 Capability map

- **Model construction:** choose governing equations, initial/boundary conditions, material laws, symmetries, scales, and unknowns.
- **Discretization:** finite difference, finite volume, finite element, spectral, Monte Carlo, molecular dynamics, particle-in-cell, lattice methods, matrix/tensor methods.
- **Algorithms:** linear/nonlinear solvers, eigensolvers, quadrature, optimization, root finding, FFT, interpolation, inference, symbolic algebra.
- **High-performance computing:** shared/distributed memory, GPU, vectorization, load balancing, communication, I/O, checkpointing, performance models.
- **Verification:** prove the equations are solved correctly; **validation:** test whether the equations describe the phenomenon.
- **Uncertainty quantification:** input propagation, surrogate models, sensitivity, posterior inference, model discrepancy.
- **Reproducibility:** versioned code, data, parameters, environments, seeds, workflows, and archived outputs.

### 16.2 Resource ladder

| Level | Resources and use |
|---|---|
| Foundation | Newman, *Computational Physics*; Landau, Páez and Bordeianu; MIT OCW [computational physics search](https://ocw.mit.edu/search/?q=computational%20physics). |
| Numerical analysis | Press et al., *Numerical Recipes*; Trefethen and Bau; LeVeque; Quarteroni, Sacco and Saleri. |
| Advanced simulation | Hesthaven and Warburton for high-order methods; Oberkampf and Roy for verification and validation; domain codes in earlier sections. |
| Core software | [NumPy](https://numpy.org/), [SciPy](https://scipy.org/), [SymPy](https://www.sympy.org/), [pandas](https://pandas.pydata.org/), [xarray](https://xarray.dev/), [HDF5](https://www.hdfgroup.org/solutions/hdf5/), [Matplotlib](https://matplotlib.org/), [Jupyter](https://jupyter.org/), [Dask](https://www.dask.org/), [PETSc](https://petsc.org/), [Trilinos](https://trilinos.github.io/), [FEniCS](https://fenicsproject.org/), [deal.II](https://www.dealii.org/), and [ParaView](https://www.paraview.org/). |
| Reproducibility | [Git](https://git-scm.com/), [Zenodo](https://zenodo.org/), [Software Heritage](https://www.softwareheritage.org/), [Docker](https://www.docker.com/), [Apptainer](https://apptainer.org/), [CMake](https://cmake.org/), [pytest](https://docs.pytest.org/), and workflow systems such as [Snakemake](https://snakemake.readthedocs.io/). |

### 16.3 Verification protocol

1. **Unit tests:** test each function against a known analytic or hand-computed result.
2. **Regression tests:** compare against version-controlled trusted outputs with explicit tolerances.
3. **Manufactured solutions:** construct an exact solution and force term, then measure convergence order.
4. **Conservation tests:** track mass, charge, momentum, energy, probability, or norm as the model permits.
5. **Mesh/time-step refinement:** refine both; do not accept a flat residual plot as proof of physical accuracy.
6. **Independent implementation:** compare a second method or code on a nontrivial benchmark.
7. **Round-off and conditioning:** report precision, condition number, solver tolerance, and sensitivity.
8. **Randomness:** save generator, algorithm, seed, stream structure, and number of independent chains.
9. **HPC scaling:** measure strong/weak scaling, communication overhead, memory, I/O, and load imbalance.
10. **Archive:** release code DOI via [Zenodo](https://zenodo.org/), preserve source history via [Software Heritage](https://www.softwareheritage.org/), and deposit data with stable identifiers.

### 16.4 Computational red flags

- A solution changes materially after one mesh refinement.
- Results are smoother because of numerical diffusion, not because the physical dissipation is understood.
- Solver residual converged but global conservation failed.
- A fit has many correlated parameters and no sensitivity analysis.
- A machine-learning model performs well only on data generated by the same simulator or preprocessing pipeline.
- A notebook runs only on one person's machine or depends on unpinned package versions.
- Error bars are smaller than calibration, discretization, finite-size, or model-form uncertainty.
- Performance claims omit problem size, hardware, precision, compiler, parallelism, and baseline.

---

## 17. Experimental physics, instrumentation, and laboratory practice

### 17.1 Capability map

A sound experiment defines a measurand, apparatus, calibration chain, operating point, environmental controls, data-acquisition path, analysis pipeline, uncertainty budget, and failure response. It separates detector response from physical signal, and statistical fluctuations from systematic effects.

### 17.2 Resource ladder

| Topic | Resources and use |
|---|---|
| Measurement and data | Taylor, *An Introduction to Error Analysis*; Bevington and Robinson; Hughes and Hase, *Measurements and their Uncertainties*; Squires, *Practical Physics*. |
| Experimental design | Melissinos and Napolitano; Kirkup and Frenkel; institutional lab manuals; MIT OCW [experimental physics search](https://ocw.mit.edu/search/?q=experimental%20physics). |
| Electronics/instrumentation | Horowitz and Hill, *The Art of Electronics*; [Analog Devices resource library](https://www.analog.com/en/resources.html); [Keysight technical resources](https://www.keysight.com/us/en/resources.html); manufacturer manuals for exact instruments. |
| DAQ/control | [EPICS](https://epics-controls.org/), [TANGO](https://www.tango-controls.org/), [LabVIEW](https://www.ni.com/en-us/shop/labview.html), [PyMeasure](https://pymeasure.readthedocs.io/), [QCoDeS](https://microsoft.github.io/Qcodes/), [Bluesky](https://blueskyproject.io/), [ROOT](https://root.cern/), and [h5py](https://www.h5py.org/). |
| Data/literature | [NIST](https://www.nist.gov/), [BIPM](https://www.bipm.org/), [CERN Open Data](https://opendata.cern.ch/), [HEPData](https://www.hepdata.net/), [NASA ADS](https://ui.adsabs.harvard.edu/), and instrument/data repositories. |

### 17.3 Experiment checklist

1. Define the measurand and decision threshold before data collection.
2. Draw the full chain: source -> sample -> sensor -> amplifier -> filter -> digitizer -> timestamp -> storage -> analysis.
3. Record sensor model, serial number, calibration date, range, resolution, drift, temperature coefficient, and uncertainty.
4. Measure backgrounds, blanks, dark counts, offsets, noise spectra, cross-talk, dead time, and environmental sensitivity.
5. Run controls and blind or shuffled conditions where practical.
6. Preserve raw data and immutable run metadata; separate exploratory from confirmatory analysis.
7. Predeclare analysis choices when possible; report deviations.
8. Estimate systematic uncertainties independently of statistical scatter.
9. Reproduce at least one result with a different instrument, setting, sample, analyst, or analysis route.
10. Write an anomaly log; unexplained anomalies are results about the experiment even if they are not new physics.

### 17.4 Laboratory safety boundaries

- Electrical, optical, cryogenic, pressure, vacuum, chemical, magnetic, acoustic, ionizing, and mechanical hazards require local risk assessment, authorized training, lockout/tagout, engineering controls, PPE, and emergency procedures.
- The agent may help locate standards and reason qualitatively, but must not approve an apparatus, override interlocks, calculate an operational exposure plan, or substitute for a safety officer.
- Any unattended system needs documented failure modes, alarms, shutdown behavior, thermal/pressure limits, access control, and responsible-person contact.
- Calibration and safety functions must not share an undocumented modification; record every hardware/software change that can alter the measurement chain.

---

## 18. Metrology, SI units, traceability, and uncertainty

### 18.1 SI and metrology vocabulary

Use the [BIPM SI Brochure](https://www.bipm.org/en/publications/si-brochure) for unit definitions and the [JCGM VIM](https://jcgm.bipm.org/vim/en/) for terms such as measurand, measurement result, calibration, traceability, accuracy, precision, repeatability, reproducibility, and uncertainty. The modern SI is based on fixed numerical values of defining constants; use the current [SI Brochure](https://www.bipm.org/en/publications/si-brochure) rather than a pre-2019 summary.

### 18.2 Authoritative constants and comparisons

- Use [NIST CODATA](https://physics.nist.gov/cuu/Constants/) for recommended values and covariance information; record the adjustment year because CODATA values are revised.
- Use the [BIPM Key Comparison Database](https://www.bipm.org/kcdb/) to inspect calibration and measurement capabilities and key comparisons.
- Use [NIST Technical Note 1297](https://nvlpubs.nist.gov/nistpubs/Legacy/TN/nbstechnicalnote1297.pdf) for NIST's concise implementation of uncertainty evaluation.
- Use the JCGM [GUM and related guides](https://www.bipm.org/en/publications/guides) for propagation, supplements, and terminology.

### 18.3 Uncertainty workflow

1. **Define the measurand and model:** \(y=f(x_1,\ldots,x_n)\). A naked repeated reading is not the full measurement model.
2. **List input contributions:** statistical scatter, calibration, reference standard, drift, resolution, alignment, temperature, pressure, humidity, loading, timebase, background, analysis choices, and model terms.
3. **Evaluate Type A components** by statistical analysis of repeated observations.
4. **Evaluate Type B components** from calibration certificates, specifications, prior data, and reasoned distributions.
5. **Propagate:** for independent inputs, \(u_c^2(y)\approx\sum_i(\partial f/\partial x_i)^2u^2(x_i)\); include covariance for correlated inputs.
6. **Choose coverage:** report standard uncertainty \(u\) or expanded uncertainty \(U=ku\), state \(k\), and explain the approximate level of confidence and distribution assumption.
7. **Report coherently:** \(y \pm U\) with units, coverage factor, calibration date, method, and environment; do not claim that \(k=2\) guarantees exactly 95% coverage.
8. **Maintain traceability:** connect the instrument to recognized standards through an unbroken calibration chain, each link with uncertainty.
9. **Review:** perform sensitivity ranking, independent estimate, residual analysis, interlaboratory comparison, and end-to-end check with a reference artifact.

### 18.4 Common metrology failures

- Treating resolution as uncertainty.
- Ignoring calibration uncertainty or correlation.
- Averaging repeated readings while drift remains unmodeled.
- Mixing \(1\sigma\), \(2\sigma\), half-width, tolerance, and maximum error.
- Rounding the central value before completing propagation.
- Reporting more significant figures than the uncertainty supports.
- Quoting an old CODATA/PDG value without adjustment year.
- Calling an instrument "accurate" without a measurand, range, conditions, and uncertainty.
- Confusing repeatability under identical conditions with reproducibility across instruments, operators, sites, or methods.
- Assuming a normal distribution for asymmetric, bounded, Poisson, or calibration-limited measurements.

---
## 19. Engineering interfaces and professional handoff

Physics research often becomes engineering when a result is used to choose a material, set an operating limit, design an instrument, estimate risk, or certify performance. The agent's job is to make the physics auditable and the handoff explicit—not to impersonate the responsible engineer.

### 19.1 Cross-domain interface map

| Interface | Physics contribution | Key resources | Handoff boundary |
|---|---|---|---|
| Electrical power and machines | Fields, induction, torque, losses, transients, insulation, grounding, thermal limits | [IEEE Xplore](https://ieeexplore.ieee.org/), [NIST electrical/electromagnetic metrology](https://www.nist.gov/electricalelectromagnetic-metrology), manufacturer datasheets, Tesla patents as historical—not modern design—sources | Licensed electrical engineer and utility/site authority; arc flash, grid protection, interconnection, and code compliance are outside agent approval. |
| RF, microwave, antennas, radar | Maxwell equations, transmission lines, scattering, antennas, noise, link budgets | [IEEE APS](https://ieeeaps.org/), [ITU](https://www.itu.int/), [FCC equipment authorization](https://www.fcc.gov/engineering-technology/laboratory-division/equipment-authorization), Pozar and Balanis | Spectrum authorization, emissions, human exposure, aviation/military systems, and facility certification belong to regulators and qualified engineers. |
| Thermal and energy | Heat transfer, thermodynamic cycles, storage, combustion, solar, heat pumps, batteries | [NIST REFPROP](https://www.nist.gov/srd/refprop), [ASHRAE](https://www.ashrae.org/), [DOE Energy Efficiency and Renewable Energy](https://www.energy.gov/eere), [Cantera](https://cantera.org/) | Pressure equipment, combustion, fire protection, grid-scale storage, and building codes require licensed review and test data. |
| Mechanical/structural | Statics, dynamics, stress, fracture, fatigue, vibration, acoustics | [ASME](https://www.asme.org/), [NASA Systems Engineering Handbook](https://www.nasa.gov/reference/systems-engineering-handbook/), [NAFEMS](https://www.nafems.org/), [CalculiX](https://www.calculix.de/), [FEniCS](https://fenicsproject.org/) | Load rating, pressure vessels, cranes, buildings, vehicles, and public infrastructure require applicable codes and professional sign-off. |
| Aerospace | Orbital mechanics, aerodynamics, propulsion physics, thermal protection, guidance | [NASA Technical Reports Server](https://ntrs.nasa.gov/), [NASA SPICE](https://naif.jpl.nasa.gov/naif/), [AIAA](https://www.aiaa.org/), [GMAT](https://software.nasa.gov/software/GSC-17177-1) | Flightworthiness, human-rating, launch safety, export control, and mission assurance require authorized organizations. |
| Nuclear/radiological | Decay, transport, shielding concepts, detector response, activation awareness | [IAEA Safety Standards](https://www.iaea.org/resources/safety-standards), [NRC regulations](https://www.nrc.gov/reading-rm/doc-collections/cfr/), [ICRP](https://www.icrp.org/), [NNDC](https://www.nndc.bnl.gov/), [OpenMC](https://docs.openmc.org/), [Geant4](https://geant4.web.cern.ch/) | Reactor design, criticality, source handling, dose plans, waste, security, licensing, and emergency response belong to authorized specialists. No optimization for weapons or control evasion. |
| Medical physics/imaging | Radiation interaction, MRI, ultrasound, optics, detectors, inverse problems | [AAPM](https://www.aapm.org/), [FDA medical devices](https://www.fda.gov/medical-devices), [IEC](https://www.iec.ch/), [ICRP](https://www.icrp.org/) | Diagnosis, treatment planning, exposure, calibration of clinical systems, and patient-specific decisions require clinicians and qualified medical physicists. |
| Semiconductors/photonics | Band structure, transport, device electrostatics, lasers, detectors, noise | [Materials Project](https://next-gen.materialsproject.org/), [NIST](https://www.nist.gov/), [IEEE Xplore](https://ieeexplore.ieee.org/), Sze for devices, Saleh and Teich for photonics | Product reliability, process safety, export controls, cleanroom hazards, and compliance require process/device engineers. |
| Materials/manufacturing | Phase stability, defects, mechanics, transport, corrosion, degradation | [Materials Project](https://next-gen.materialsproject.org/), [NIST Materials Data Resources](https://www.nist.gov/mgi/materials-data-resources), [NOMAD](https://nomad-lab.eu/), [ASM International](https://www.asminternational.org/) | Qualification, destructive testing, toxicology, process control, and product release require materials/manufacturing engineers. |
| Geophysics/civil | Elastic waves, gravity, magnetics, hydrology, soil/rock mechanics | [USGS](https://www.usgs.gov/), [IRIS EarthScope](https://www.earthscope.org/), [NOAA](https://www.noaa.gov/), local building codes | Structural adequacy, flood control, dams, mines, and public warning systems require licensed professionals and authorities. |
| Robotics/control | Dynamics, sensors, estimation, feedback, stability | [Drake](https://drake.mit.edu/), [ROS](https://www.ros.org/), [Control Tutorials for MATLAB and Simulink](https://ctms.engin.umich.edu/), [IEEE Control Systems Society](https://ieeecss.org/) | Human-collaborative robotics, autonomous vehicles, machinery, and fail-safe controls require safety engineering and certification. |
| Software/digital twins | Solvers, inference, controls, cybersecurity, verification | [NASA Systems Engineering Handbook](https://www.nasa.gov/reference/systems-engineering-handbook/), [NIST cybersecurity](https://www.nist.gov/cybersecurity), [Software Heritage](https://www.softwareheritage.org/) | Safety-critical software needs requirements traceability, independent verification, cybersecurity review, and authorized release. |

### 19.2 Engineering handoff package

```text
Requirement and use case:
Physical model and assumptions:
Input values, source, uncertainty:
Output quantity, unit, uncertainty:
Verification evidence:
Validation evidence and domain:
Limits, interlocks, excluded regimes:
Failure modes and observables:
Standards/regulations implicated:
Responsible discipline and required sign-off:
Open questions and residual risk:
```

### 19.3 Model-to-requirement translation

- Convert physical predictions into **requirements** only after defining acceptance criteria, test methods, uncertainty, environmental envelope, and failure consequences.
- Maintain requirement traceability from stakeholder need -> physics model -> analysis/simulation -> design parameter -> verification test -> field evidence.
- Treat simulation as evidence only when the code is verified, the model is validated for the intended regime, and uncertainty is quantified.
- Include operating envelope and forbidden envelope; a good result outside its calibration domain is not evidence.
- Distinguish proof of concept, prototype, qualification, certification, and field operation.
- Preserve red-team results: drop tests, vibration, thermal cycling, EMI, humidity, contamination, aging, misuse, maintenance error, and off-normal power.

### 19.4 Engineering red flags

- A model output is quoted without units, tolerance, or environmental conditions.
- A textbook formula is applied to a proprietary device without measuring its actual material and geometry.
- A simulation result is presented as certification.
- A patent or historical prototype is treated as evidence of modern safety or performance.
- A single nominal calculation replaces a design margin or failure-mode analysis.
- Human factors, maintenance, cybersecurity, supply-chain variation, and end-of-life behavior are omitted.
- The output asks for bypassing an interlock, detector, alarm, regulator, or licensed review.

---
## 20. Historically controlled dossier: Isaac Newton

### 20.1 Control statement

Use manuscripts, dated letters, edition-specific printed texts, and scholarly transcriptions before biographical narrative. The minimum archival route is [Cambridge University Digital Library: Newton Papers](https://cudl.lib.cam.ac.uk/collections/newton) -> [Oxford Newton Project](https://www.newtonproject.ox.ac.uk/) -> [Stanford Encyclopedia of Philosophy, "Isaac Newton"](https://plato.stanford.edu/entries/newton/) -> relevant Royal Society records. A modern paraphrase must identify edition, date, language, and whether it reflects Newton's published text or a manuscript draft.

### 20.2 Identity and chronology

- Newton was born at Woolsthorpe on 25 December 1642 Old Style, conventionally 4 January 1643 New Style, and died on 20 March 1726/27 Old Style, conventionally 31 March 1727 New Style; dual dating matters because England's calendar and year-start conventions differed from the Gregorian system ([SEP](https://plato.stanford.edu/entries/newton/)).
- He entered Trinity College, Cambridge, in 1661; his undergraduate Trinity notebook is Cambridge [MS Add. 3996](https://cudl.lib.cam.ac.uk/view/MS-ADD-03996/1).
- He developed fluxional methods and mathematical series in the 1660s; the [Waste Book, MS Add. 4004](https://cudl.lib.cam.ac.uk/view/MS-ADD-04004/1), is a key working notebook rather than a polished treatise.
- He became Lucasian Professor in 1669 after Isaac Barrow's resignation; the [Oxford Newton Project's introduction](https://www.newtonproject.ox.ac.uk/texts/introduction) traces the mathematical, optical, and Principia manuscripts.
- His optical work reached the Royal Society in the early 1670s; the light-and-colours letter was published in *Philosophical Transactions* with DOI [10.1098/rstl.1671.0072](https://doi.org/10.1098/rstl.1671.0072).
- *Principia* appeared in 1687, with substantially revised editions in 1713 and 1726; the Library of Congress summarizes these lifetime editions in its [1687 digitized copy record](https://www.loc.gov/item/2021667054/).
- He became Warden of the Mint in 1696 and Master in 1699, was elected President of the Royal Society in 1703, and was knighted in 1705; for biography and institutional context use [SEP](https://plato.stanford.edu/entries/newton/) plus archival correspondence rather than heroic summaries.
- *Opticks* appeared in 1704, with the Latin *Optice* in 1706 and a revised English edition in 1717/18; the Oxford Newton Project's [optical-work guide](https://www.newtonproject.ox.ac.uk/tour/newtons-optical-work) and [text introduction](https://www.newtonproject.ox.ac.uk/texts/introduction) document edition and Query variation.

### 20.3 Primary works and how to use them

| Work / object | Date and status | Research use and controls |
|---|---|---|
| **Trinity College Notebook, MS Add. 3996** | c. 1661-1665 | Early reading and *Quaestiones quaedam philosophicae*; use Cambridge's [manuscript viewer](https://cudl.lib.cam.ac.uk/view/MS-ADD-03996/1) and folio numbers. |
| **Waste Book, MS Add. 4004** | Working notebook, 1660s onward | Key evidence for fluxions and working methods; use Cambridge's [Waste Book](https://cudl.lib.cam.ac.uk/view/MS-ADD-04004/1). Do not treat a dated working note as a published claim. |
| **De analysi per aequationes numero terminorum infinitas** | Composed/circulated 1669; printed in 1711 | Scribal circulation preceded print; Oxford's [introduction](https://www.newtonproject.ox.ac.uk/texts/introduction) explains the Barrow-Collins transmission. Distinguish composition, circulation, and publication. |
| **Letter on light and colours** | *Philosophical Transactions*, 1671/72 | Primary published report of experiments and theory; cite DOI [10.1098/rstl.1671.0072](https://doi.org/10.1098/rstl.1671.0072), journal dating convention, and pages. |
| **Optical lectures and related papers** | Early 1670s, manuscript/deposited lecture tradition | Use Cambridge [MS Add. 3970](https://cudl.lib.cam.ac.uk/view/MS-ADD-03970/1) and Oxford's optical texts; distinguish lectures, drafts, and later *Opticks*. |
| **De motu corporum in gyrum** | 1684 manuscript/draft family | Immediate precursor to *Principia*; Oxford's [Principia-related account](https://www.newtonproject.ox.ac.uk/texts/introduction) describes its contents and limitations. |
| **Philosophiae Naturalis Principia Mathematica** | 1687, 1713, 1726 | Mathematical mechanics and gravitation; identify edition because definitions, propositions, scholia, and supporting evidence changed. Newton's annotated first-edition copy is Cambridge [Adv.b.39.1](https://cudl.lib.cam.ac.uk/view/PR-ADV-B-00039-00001). |
| **Opticks / Optice** | 1704, 1706, 1717/18 | Experimental optics plus evolving Queries; use the [Oxford optical edition guide](https://www.newtonproject.ox.ac.uk/tour/newtons-optical-work). Do not mix Query text across editions. |
| **Arithmetica Universalis** | 1707 | Algebraic lectures and equations; publication history involved editorial intervention, so identify edition and translator. |
| **Methodus differentialis** | 1711 | Interpolation/difference methods; see Oxford's historical account in [Chapter XIV](https://www.newtonproject.ox.ac.uk/view/texts/normalized/OTHE00075). |
| **General Scholium** | Added to second *Principia* edition, 1713; carried in later editions | Source of *hypotheses non fingo*. Cite the edition and context, not a decontextualized slogan. Oxford hosts a transcription of the [General Scholium](https://www.newtonproject.ox.ac.uk/view/texts/normalized/NATP00056). |
| **Theological, chronological, and alchemical manuscripts** | Large manuscript corpus, mostly unpublished in Newton's lifetime | Use the Oxford [Newton Project catalogue](https://www.newtonproject.ox.ac.uk/) and specialized scholarship; do not project modern disciplinary boundaries onto seventeenth-century natural philosophy. |

### 20.4 Archive map

1. **Cambridge University Library:** scientific and mathematical papers, notebooks, annotated books, and digital scans through the [Newton Papers collection](https://cudl.lib.cam.ac.uk/collections/newton). Use classmarks and folios.
2. **Oxford Newton Project:** diplomatic and normalized transcriptions across scientific, mathematical, theological, alchemical, and administrative papers. Always state whether using diplomatic or normalized text.
3. **Royal Society:** publication history, correspondence, journal records, and *Principia* manuscript context; see the Royal Society's [Newton digitization note](https://royalsociety.org/blog/2018/05/newton-goes-digital/) and DOI-linked *Philosophical Transactions* records.
4. **Library of Congress:** digitized 1687 *Principia* copy and bibliographic record at [LOC 2021667054](https://www.loc.gov/item/2021667054/).
5. **Historical Society of Pennsylvania:** Newton's 5 February 1675/76 letter to Robert Hooke, catalogue record [dc-9792](https://discover.hsp.org/Record/dc-9792/), containing the "shoulders of giants" sentence.

### 20.5 Scholarly secondary controls

Use [SEP's Newton article](https://plato.stanford.edu/entries/newton/) for a current expert overview. For deeper work, consult Richard Westfall, *Never at Rest*; I. Bernard Cohen's editions and essays; D. T. Whiteside's *Mathematical Papers of Isaac Newton*; Alan Shapiro's *Optical Papers*; Rob Iliffe's *Priest of Nature*; and Betty Jo Teeter Dobbs on alchemy. Treat each as interpretation and trace important assertions back to classmarks, letters, or edition-specific texts.

### 20.6 Newton myth-versus-fact table

| Popular claim | Controlled assessment | Best starting evidence |
|---|---|---|
| "An apple hit Newton and instantly produced universal gravitation." | **False as written.** William Stukeley's 1752 memoir says Newton told him that seeing an apple fall prompted reflection on why it descended perpendicularly; it does not say the apple struck him or that the theory appeared instantly. | Royal Society's account of [Stukeley's apple manuscript](https://royalsociety.org/blog/2012/02/newtons-apple-tree/). |
| "Newton completed all his great discoveries in one plague year." | **Overcompressed.** The mid-1660s were extraordinarily productive, but fluxions, optics, dynamics, and gravitation matured through manuscripts, correspondence, experiments, and revisions over decades. | Oxford [Newton Project introduction](https://www.newtonproject.ox.ac.uk/texts/introduction); Cambridge notebooks. |
| "Newton single-handedly invented calculus." | **Incomplete.** Newton developed fluxional methods early; Leibniz independently developed a differential/integral calculus and published first. Their methods, notation, transmission, and priority claims differ. | [SEP Newton](https://plato.stanford.edu/entries/newton/); Oxford's [De Analysi context](https://www.newtonproject.ox.ac.uk/texts/introduction). |
| "Newton discovered gravity." | **Misleading.** Falling bodies, planetary laws, attraction, and inverse-square reasoning had prior and contemporary contributors. Newton's distinctive achievement was a mathematical, universal synthesis tying terrestrial and celestial motion. | *Principia* editions via [Cambridge](https://cudl.lib.cam.ac.uk/collections/newton) and [LOC](https://www.loc.gov/item/2021667054/); [SEP](https://plato.stanford.edu/entries/newton/). |
| "*Hypotheses non fingo* means Newton rejected all hypotheses." | **False.** In the General Scholium he declined to feign an unsupported cause of gravity, while the *Opticks* Queries contain explicitly tentative speculative proposals. | Oxford [General Scholium transcription](https://www.newtonproject.ox.ac.uk/view/texts/normalized/NATP00056) and [Opticks Query guide](https://www.newtonproject.ox.ac.uk/tour/newtons-optical-work). |
| "Newton was simply a corpuscular theorist opposed to waves." | **Oversimplified.** His optics combined rays, periodic "fits," medium/vibration language, and corpuscular suggestions; do not map his terms directly onto modern photons. | 1718 *Opticks* Query text at the [Oxford Newton Project](https://www.newtonproject.ox.ac.uk/view/texts/normalized/NATP00051). |
| "Standing on the shoulders of giants" was Newton's original motto of humility. | **Partly false.** Newton wrote the famous sentence to Hooke in a 1675/76 letter, but the metaphor has medieval antecedents; interpretations range from courtesy to irony, so tone is not settled by the sentence alone. | Historical Society of Pennsylvania [letter record](https://discover.hsp.org/Record/dc-9792/); Oxford contextual materials. |
| "Newton's *Principia* is written in modern calculus notation." | **False.** The published presentation is predominantly geometrical and limit-based, even though Newton possessed fluxional methods. | Annotated first edition at [Cambridge](https://cudl.lib.cam.ac.uk/view/PR-ADV-B-00039-00001); Oxford mathematical texts. |
| "Newton's theology and alchemy were irrelevant side hobbies." | **Historically untenable.** The manuscript corpus is extensive and intertwined with his conception of nature, chronology, matter, and authority, though it must be interpreted within its period. | Oxford [Newton Project](https://www.newtonproject.ox.ac.uk/) and manuscript catalogue. |
| "Newton worked as an isolated lone genius." | **Overstated.** He worked intensely and could be secretive, but Barrow, Collins, Halley, Cotes, Hooke, Oldenburg, Flamsteed, and Royal Society institutions shaped communication, priority, data, and publication. | Oxford [Newton Project](https://www.newtonproject.ox.ac.uk/); Royal Society records. |

### 20.7 Newton research protocol

- Always report calendar convention for dates between 1 January and 24 March in English records.
- Cite manuscript classmark and folio for archive claims; cite edition and page for printed claims.
- Distinguish Newton's words, editorial modernization, translation, and later biography.
- For calculus priority, separate private invention, scribal circulation, print publication, notation, and influence.
- For optical theory, separate experimental observations, phenomenological laws, and speculative mechanism.
- For *Principia*, compare 1687/1713/1726 changes rather than citing a generic translation.

---
## 21. Historically controlled dossier: Nikola Tesla

### 21.1 Control statement

Tesla research is unusually vulnerable to hero myth, retrospective crediting, quotation distortion, and conspiracy framing. The controlling order is: patent text and dated correspondence; contemporary lectures and publications; laboratory notebooks; archive finding aids; court records; then critical biography and technical history. Do not use a patent as proof of a successful commercial demonstration, an autobiography as proof of a disputed priority, or an FBI file as proof that a spectacular technology existed.

### 21.2 Identity and chronology

- Nikola Tesla was born in Smiljan on 10 July 1856 and died in New York on 7 January 1943; use the [Nikola Tesla Museum](https://tesla-museum.org/en/) and LOC [Tesla correspondence finding aid](https://hdl.loc.gov/loc.mss/eadmss.ms014047) as identity anchors.
- He described his rotating-magnetic-field insight in retrospect as occurring in Budapest in 1882; because the surviving account is autobiographical, cite [My Inventions](https://en.wikisource.org/wiki/My_Inventions) as testimony, not independent proof of the exact scene.
- He emigrated to the United States in 1884 and worked briefly in Edison-related employment; W. Bernard Carlson's *Tesla: Inventor of the Electrical Age* ([Princeton University Press](https://press.princeton.edu/books/paperback/9780691165615/tesla)) is the principal modern scholarly control.
- In 1888 he presented "A New System of Alternate Current Motors and Transformers" to the American Institute of Electrical Engineers; the paper is reprinted in Thomas Commerford Martin's contemporary [The Inventions, Researches and Writings of Nikola Tesla](https://www.gutenberg.org/files/39272/39272-h/39272-h.htm).
- Tesla's polyphase patents were licensed to Westinghouse in 1888; treat the integrated system, not one isolated motor, as the technical and commercial object.
- His high-frequency lectures of 1891-1893 are collected in Martin's 1894 book; the AIEE lecture begins in [Chapter XXVI](https://www.gutenberg.org/files/39272/39272-h/39272-h.htm#Page_145).
- He demonstrated a radio-controlled boat in 1898 and protected the concept in [US613809A](https://patents.google.com/patent/US613809A/en).
- He worked at Colorado Springs in 1899-1900; the *Colorado Springs Notes* were later published under Nikola Tesla Museum auspices, with Aleksandar Marinčić as editor/commentator. Use the notes as Tesla's experimental record, not as an automatically validated performance claim.
- Wardenclyffe was financed as a communications and power-transmission project but was never completed as Tesla's full "World System"; use Tesla-Morgan correspondence and Carlson rather than a single-cause conspiracy story.
- He received the AIEE Edison Medal in 1917; see IEEE's [Nikola Tesla biography page](https://ethw.org/Nikola_Tesla).
- After his death, the Office of Alien Property Custodian impounded effects; the [FBI Vault's Tesla collection](https://vault.fbi.gov/nikola-tesla) contains correspondence and copies with the FBI's own warning that some records are incomplete and image quality reflects the originals.

### 21.3 Core archives and documentary collections

| Collection | What it controls | Cautions |
|---|---|---|
| [Nikola Tesla Museum, Belgrade](https://tesla-museum.org/en/) | Principal estate, manuscripts, correspondence, personal objects, library, photographs, and research archive | Museum pages are authoritative for holdings, but technical claims still require patents, dated notes, and measurements. |
| [UNESCO Memory of the World: Nikola Tesla's Archive](https://memory.unesco.org/heritage/tesla-archive) | International documentary-heritage status for the Belgrade archive; registered in 2003 | UNESCO listing establishes documentary significance, not the correctness of every Tesla claim. |
| [Library of Congress, Nikola Tesla correspondence, 1890-1934](https://hdl.loc.gov/loc.mss/eadmss.ms014047) | Seven microfilm reels copied from Tesla papers in the Belgrade museum; correspondents include Clemens, Johnson, Morgan, Scherff, Westinghouse, and Westinghouse Electric | Copies may be faint; they are not the complete estate and their span ends before Tesla's final years. |
| [Google Patents](https://patents.google.com/) | Searchable patent images, claims, families, filing dates, and legal metadata | A patent gives legal disclosure and priority evidence; it does not certify experimental efficiency or commercial success. |
| [FBI Vault: Nikola Tesla](https://vault.fbi.gov/nikola-tesla) | FBI correspondence, FOIA releases, copies of reviews and inquiries about Tesla's papers | The file records government interest and handling; redactions, missing records, and secondary allegations must not be read as proof of suppressed physics. |
| [Columbia University Tesla papers](https://findingaids.library.columbia.edu/archives/cul-4079392) and [NYPL Tesla letters](https://archives.nypl.org/mss/4641) | Focused correspondence and Wardenclyffe-related letters | Use repository scope notes; do not generalize from small collections. |
| [Carlson biography](https://press.princeton.edu/books/paperback/9780691165615/tesla) | Best current archive-based scholarly synthesis of invention, business, and public performance | Still a secondary interpretation; follow its notes to patents, correspondence, and contemporary periodicals. |

### 21.4 Primary works and lectures

| Work | Date and status | Use |
|---|---|---|
| **A New System of Alternate Current Motors and Transformers** | AIEE lecture, 16 May 1888; AIEE *Transactions* and reprinted in Martin 1894 | Tesla's public technical statement of polyphase motors/transformers; use the [Martin transcription](https://www.gutenberg.org/files/39272/39272-h/39272-h.htm) and compare patent families. |
| **Experiments with Alternate Currents of Very High Frequency and Their Application to Methods of Artificial Illumination** | AIEE lecture, 20 May 1891 | High-frequency/high-voltage experiments; collected in [Martin, Chapter XXVI](https://www.gutenberg.org/files/39272/39272-h/39272-h.htm#Page_145). |
| **Experiments with Alternate Currents of High Potential and High Frequency** | London lectures, February 1892 | High-potential demonstrations and Tesla's terminology; public-domain text indexed by [UPenn Online Books](https://onlinebooks.library.upenn.edu/webbin/book/lookupname?key=Tesla%2C%20Nikola%2C%201856%2D1943). |
| **On Light and Other High Frequency Phenomena** | Philadelphia and St. Louis, 1893 | Wireless/high-frequency concepts; compare Tesla's words with later claims that he had completed a modern radio system. |
| **The Problem of Increasing Human Energy** | *Century Magazine*, June 1900 | Philosophical/technical manifesto including solar energy, wireless power, and telautomatics; use a scan such as [Internet Archive's record](https://archive.org/details/problemofincreas0000tesl/mode/2up) or the [Tesla Science Center page](https://teslasciencecenter.org/announcements/century-mag-1900/). |
| **The Transmission of Electric Energy Without Wires** | *Electrical World and Engineer*, 5 March 1904 | Tesla's own account of his wireless-energy program; period context is indexed by [Digital Long Island](https://www.digitallongisland.org/record/4878). |
| **My Inventions** | Serialized in *Electrical Experimenter*, 1919 | Autobiographical and promotional in places; use [Wikisource's original-series transcription](https://en.wikisource.org/wiki/My_Inventions) and verify technical events against patents/contemporary reports. |
| **Colorado Springs Notes, 1899-1900** | Laboratory notebook; published in Belgrade in 1978 | Primary evidence for apparatus, observations, calculations, and Tesla's interpretations; not a peer-reviewed validation of global power transmission. |

### 21.5 Patent dossier

| Patent | Filing / issue | What the document establishes | What it does not establish |
|---|---|---|---|
| [US381968A](https://patents.google.com/patent/US381968A/en), **Electro-Magnetic Motor** | Filed 12 October 1887; issued 1 May 1888 | Dated legal disclosure for Tesla's electromagnetic/polyphase motor work | Proof that Tesla invented all AC machinery or that every modern induction motor descends unchanged from it. |
| [US613809A](https://patents.google.com/patent/US613809A/en), **Method of and Apparatus for Controlling Mechanism of Moving Vessels or Vehicles** | Filed 1 July 1898; issued 8 November 1898 | Dated claims for wireless remote control of a vessel/vehicle | Proof of autonomous robotics, military deployment, or modern digital remote control. |
| [US645576A](https://patents.google.com/patent/US645576A/en), **System of Transmission of Electrical Energy** | Filed 2 September 1897; issued 20 March 1900 | Tesla's disclosed system for transmission through natural media, with tuned transmitter/receiver concepts | Proof of lossless global wireless power or energy creation. |
| [US649621A](https://patents.google.com/patent/US649621A/en), **Apparatus for Transmission of Electrical Energy** | Divisional application filed 19 February 1900 from the 1897 application; issued 15 May 1900 | Apparatus claims corresponding to Tesla's transmission system | A demonstration certificate, measured efficiency, or operational global network. |

**Patent protocol:** read the independent claims first; record filing, priority/divisional history, issue date, drawings, and examiner/legal status; distinguish "disclosed" from "reduced to practice"; compare related patents rather than isolating one title.

### 21.6 Marconi v. United States: controlled reading

In [Marconi Wireless Telegraph Co. v. United States, 320 U.S. 1 (1943)](https://supreme.justia.com/cases/federal/us/320/1/), the Supreme Court held broad claims of Marconi's later four-circuit tuning patent No. 763,772 invalid because they were anticipated, discussing Tesla, Lodge, and Stone. The opinion says Tesla anticipated a four-circuit tuned combination but lacked Lodge's variable-inductance adjustment feature; it relies principally on Stone for the invalidity analysis and expressly says it need not decide whether Stone's patent itself involved invention. It also states that Marconi's reputation for first successful radio transmission rested on his original patent/reissue, which was not the patent claim under review.

Therefore:

- **Supported:** Tesla had legally significant prior disclosure relevant to tuned wireless circuits.
- **Supported:** Marconi's broad later tuning-patent claims were invalid as anticipated in that litigation.
- **Not supported:** "The Supreme Court ruled Tesla was the sole inventor of radio." The case was a patent-validity/infringement suit, not a global historical referendum.

### 21.7 Tesla myth-versus-fact table

| Popular claim | Controlled assessment | Evidence controls |
|---|---|---|
| "Tesla invented alternating current." | **False.** AC generation and transformation predated Tesla. His major contribution was a practical polyphase motor/transmission system, developed in a crowded field that included Ferraris, Dolivo-Dobrowolsky, Westinghouse engineers, and others. | [US381968A](https://patents.google.com/patent/US381968A/en); 1888 AIEE lecture in [Martin 1894](https://www.gutenberg.org/files/39272/39272-h/39272-h.htm); Carlson biography. |
| "The War of the Currents was a two-person duel, Edison versus Tesla." | **Oversimplified.** The contest involved Edison, Westinghouse, Elihu Thomson, utilities, financiers, standards, safety campaigns, motors, meters, and system economics. Tesla's patents mattered, but he was not the sole protagonist. | Carlson biography; IEEE historical context at [ETHW](https://ethw.org/Nikola_Tesla). |
| "Tesla was the sole inventor of radio." | **False.** Wireless development involved Hertz, Lodge, Marconi, Fessenden, Stone, Tesla, and others. Tesla's tuned-circuit disclosures were important prior art, but not a complete one-person history. | [320 U.S. 1](https://supreme.justia.com/cases/federal/us/320/1/); Tesla patents [US645576A](https://patents.google.com/patent/US645576A/en) and [US649621A](https://patents.google.com/patent/US649621A/en). |
| "Marconi's 1943 patent defeat proves Tesla won priority for all radio." | **False.** The Court invalidated particular broad claims of one later Marconi patent and discussed Tesla/Lodge/Stone; it did not adjudicate the original Marconi patent or award a universal title. | Syllabus and opinion at [320 U.S. 1](https://supreme.justia.com/cases/federal/us/320/1/). |
| "Wardenclyffe was a free-energy plant." | **False.** Tesla's patents and writings describe transmission of energy through natural media, not creation of energy from nothing. Wardenclyffe remained unfinished and was not demonstrated as a global power system. | [US645576A](https://patents.google.com/patent/US645576A/en); [US649621A](https://patents.google.com/patent/US649621A/en); Tesla's 1904 article record at [Digital Long Island](https://www.digitallongisland.org/record/4878). |
| "Financiers destroyed Wardenclyffe because it would make electricity free." | **Unsupported as a single cause.** Funding, technical feasibility, competing wireless systems, Tesla's business record, debt, and changing priorities all mattered. The tower was later dismantled for scrap; no archival proof shows suppression because metering was impossible. | Tesla-Morgan correspondence via [LOC finding aid](https://hdl.loc.gov/loc.mss/eadmss.ms014047); Carlson biography. |
| "Tesla built and demonstrated a death ray." | **Unsubstantiated.** Tesla made public claims about "teleforce," and government reviewers examined his papers. John G. Trump's review reported no new, sound, workable principles or methods for the claimed results. | [FBI Vault](https://vault.fbi.gov/nikola-tesla); Carlson's account; treat Trump as an assessor, not proof that every paper survived. |
| "The FBI seized all Tesla papers and still hides a working weapon." | **Overstated.** The Office of Alien Property Custodian impounded effects; FBI records and later releases document interest, redactions, and uncertain handling. They do not provide evidence of a functioning device. The principal estate is in Belgrade. | [FBI Vault](https://vault.fbi.gov/nikola-tesla); [UNESCO Tesla Archive](https://memory.unesco.org/heritage/tesla-archive); [Tesla Museum](https://tesla-museum.org/en/). |
| "The famous Colorado Springs photograph proves Tesla sat calmly beside live lightning." | **False.** The famous image is a double exposure: discharge and seated Tesla were photographed separately. Tesla's own note in the *Colorado Springs Notes* says the discharge was not playing when he was photographed. | *Colorado Springs Notes*; image provenance discussion on [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Tesla_colorado.jpg), with the notebook quote. |
| "Tesla lit 200 lamps wirelessly from 25 miles away in a controlled experiment." | **Unverified at that strength.** Later accounts repeat versions of the claim, but the accessible notes and contemporary evidence do not provide the instrumented chain needed to establish distance, lamp power, input power, efficiency, and controls. | *Colorado Springs Notes*; Carlson; demand the original measurements before asserting it. |
| "Tesla refused a Nobel Prize because Edison would share it." | **Unsupported.** Tesla never received a Nobel Prize. Nomination archives and absence of an award do not prove a refusal story. | [Nobel Prize nomination archive](https://www.nobelprize.org/nomination/archive/) and official laureate search. |
| "Tesla predicted smartphones and the Internet exactly." | **Retrospective exaggeration.** Tesla described wireless communication, portable receivers, news, images, and time distribution, but he did not specify packet switching, TCP/IP, touchscreens, semiconductor platforms, or modern smartphones. | Tesla's 1919 [My Inventions](https://en.wikisource.org/wiki/My_Inventions) and 1904/1905 wireless writings; quote exactly before interpreting. |
| "Tesla coils are safe toys because Tesla touched high-frequency apparatus." | **Dangerous myth.** High-voltage and high-frequency apparatus can cause burns, cardiac effects, fires, EMI, ozone/NOx production, and hearing damage. Historical demonstrations are not safe operating instructions. | Modern laboratory safety controls; no construction instructions are provided here. |

### 21.8 Tesla research protocol

1. Build a dated source matrix: private note -> patent application -> public lecture -> demonstration -> commercial installation -> later recollection.
2. Cite claim number and drawing figure for patents; do not rely on headline titles.
3. For wireless claims, state transmitter input power, receiver output, distance, antenna/ground geometry, frequency, coupling regime, losses, instrumentation, and uncertainty.
4. Distinguish near-field induction, radiative far-field transmission, conduction/current through Earth, and Tesla's "terrestrial stationary waves" language.
5. Use Carlson for context but follow notes to primary material; compare O'Neill's 1944 biography cautiously because it popularized several dramatic stories.
6. Treat Tesla's own recollections as evidence of what Tesla remembered or wanted to claim, not automatically as independent experimental proof.
7. Do not reproduce high-voltage Tesla apparatus from this library; route any physical replication to a qualified high-voltage laboratory.

---
## 22. Evaluation and failure-check library

This section is the default audit battery. Apply only the checks relevant to the claim, but state why major checks are omitted when the result is consequential.

### 22.1 Universal evaluation stack

| Layer | Required checks | Typical failure signature | Corrective action |
|---|---|---|---|
| **Question framing** | Observable, scale, regime, decision, precision, falsifier | Broad adjectives, no units, moving target | Rewrite as a measurable claim or decision rule. |
| **Units and dimensions** | SI dimensions, base/derived units, coordinate convention | Hidden \(2\pi\), \(c\), \(G\), \(k_B\), \(\hbar\), mass/mole confusion | Rebuild in SI using [BIPM SI](https://www.bipm.org/en/publications/si-brochure); check constants in [CODATA](https://physics.nist.gov/cuu/Constants/). |
| **Model validity** | Assumptions, constitutive laws, boundary/initial conditions | Textbook formula used outside regime | State regime and test a limiting case; find a domain-specific model. |
| **Conservation** | Energy, mass, charge, momentum, angular momentum, probability | Numerical drift or free-energy output | Audit fluxes, sources/sinks, boundaries, dissipation, and sign conventions. |
| **Symmetry/invariance** | Frame, gauge, parity, time reversal, rotational/translational symmetry | Result depends on arbitrary origin, gauge, or coordinate artifact | Form invariant observables and test transformations. |
| **Limiting cases** | Zero field, weak coupling, small/large length, high/low temperature, Newtonian/classical limit | Formula diverges where physics should not | Compare to exact cases and physically allowed asymptotics. |
| **Empirical fit** | Data quality, calibration, uncertainty, selection, independence | Fit uses old constants or shared systematics | Re-query current databases and compare independent instruments. |
| **Statistics/inference** | Estimator, uncertainty, correlation, prior, multiple comparisons, look-elsewhere effect | Tiny \(p\)-value but no effect size or systematic budget | Predeclare analysis where possible; report posterior/prior and systematic covariance. |
| **Computation** | Verification, convergence, conditioning, conservation, seeds, environment | Plot changes under refinement or machine change | Manufactured solution, independent solver, versioned workflow, uncertainty budget. |
| **Metrology** | Traceability, calibration, Type A/B, coverage, correlation | Resolution quoted as uncertainty | Rebuild from [GUM](https://www.bipm.org/en/publications/guides) and [NIST TN1297](https://nvlpubs.nist.gov/nistpubs/Legacy/TN/nbstechnicalnote1297.pdf). |
| **Source evidence** | Primary source, edition/version, provenance, later corrections | Secondary quotation conflicts with primary text | Retrieve scan/DOI/patent/court record; assign confidence grade. |
| **Engineering/safety** | Envelope, standards, failure modes, qualified owner, interlocks | Simulation or patent treated as certification | Stop and route to responsible professional. |

### 22.2 Physics-specific red flags

- **Energy creation:** output exceeds source after closed-system accounting; missing storage, ambient heat, fuel, field energy, or measurement error.
- **Perpetual motion:** no identified heat source, driving field, or entropy production; "free energy" confused with thermodynamic free energy.
- **Superluminal claims:** phase/group/front velocity conflated; dispersion or near-field behavior omitted; no causal signal test.
- **Quantum overclaim:** coherence, entanglement, or "observer" language used without an operational measurement model.
- **Thermal overclaim:** efficiency exceeds Carnot limit without a proper temperature-difference system or non-equilibrium analysis.
- **Numerical artifact:** instability tracks mesh spacing, time step, floating-point precision, boundary location, or solver tolerance.
- **Detector artifact:** signal follows gain, threshold, temperature, geometry, time of day, or maintenance events.
- **Database misuse:** a computed database value treated as experiment, or an evaluated cross section treated as raw data.
- **Historical overclaim:** one patent, quotation, court case, or biography turned into a universal priority claim.
- **Single-source exceptional result:** no independent replication, blind analysis, or systematic-error budget.
- **Model selection by aesthetics:** symmetry or simplicity used as evidence without empirical comparison.
- **Parameter laundering:** uncertain measured inputs hidden in fitted parameters, then quoted as independent predictions.

### 22.3 Exceptional-claim test

For claims that contradict established physics, require all of the following before presenting them as credible:

1. a precise, quantitative claim and regime;
2. an independent replication using a different apparatus or method;
3. a full uncertainty and systematic budget;
4. blind or preregistered controls where possible;
5. conservation-law and limiting-case consistency;
6. raw data, calibration records, code, and environmental logs;
7. a plausible model of how known false positives were excluded;
8. survival after hostile expert review;
9. explicit statement of what evidence would retract the claim.

If any item is absent, label the result provisional, unverified, or unsupported rather than revolutionary.

### 22.4 Source contradiction protocol

1. Identify the exact proposition on which sources disagree.
2. Compare dates, editions, definitions, units, samples, and methods.
3. Prefer current curated values for constants and evaluated quantities.
4. Prefer original text for quotations, attributions, and legal holdings.
5. Preserve both positions when uncertainty remains; do not force consensus.
6. Assign confidence using the A/B/C/D/X labels in Section 2.3.
7. Record whether a contradiction changes the conclusion, a subclaim, or only wording.

### 22.5 Quantitative scorecard

Use 0-4 per dimension. Do not average mechanically; a zero in safety or source provenance can be decisive.

| Score | Meaning |
|---|---|
| 0 | Missing or contradicted |
| 1 | Plausible but unchecked |
| 2 | One credible source or calculation |
| 3 | Independent support and explicit uncertainty |
| 4 | Reproducible, converged, calibrated, externally consistent, and documented |

Score dimensions separately: theory, experiment/data, computation, metrology, literature/provenance, engineering/safety, reproducibility. Report the minimum, not only the mean.

### 22.6 Fail-stop conditions

Stop and escalate when:

- required dimensions do not close;
- conservation is violated without a stated source/sink;
- uncertainty is absent for a decision-critical number;
- a primary source cannot be identified for a load-bearing historical claim;
- a simulation is not verified or is used outside its validation domain;
- requested work crosses a regulated or hazardous boundary;
- the user asks for concealment, bypass, weaponization, or harm;
- the evidence consists only of model output, social media, or promotional material;
- the result would affect health, infrastructure, public safety, or national-security-relevant systems.

---

## 23. Operational templates

### 23.1 Research memo template

```markdown
# Research memo: [topic]
Date:
Question / decision:
Short answer:
Confidence: A/B/C/D/X
Scope and assumptions:
Primary sources:
Methods / derivation:
Results with units and uncertainty:
Independent checks:
Contradictions / negative results:
Safety / regulatory boundary:
Open questions:
```

### 23.2 Calculation card

```markdown
System:
Diagram / geometry:
Frame and coordinates:
Assumptions:
Governing equations:
Constants and sources:
Derivation:
Dimensional checks:
Limiting cases:
Numerical result:
Uncertainty:
Code/version/seed:
Failure modes:
```

### 23.3 Experiment card

```markdown
Measurand:
Hypothesis / decision threshold:
Apparatus chain:
Calibration:
Controls and blanks:
Operating envelope:
Run log:
Raw-data location:
Analysis version:
Type A uncertainty:
Type B uncertainty:
Systematics:
Anomalies:
Replication plan:
Safety owner:
```

### 23.4 Computational card

```markdown
Model:
Code and version/commit:
License:
Equations and discretization:
Mesh/resolution/time step:
Boundary/initial conditions:
Solver tolerances:
Hardware/compiler/libraries:
Verification benchmark:
Validation dataset:
Convergence:
Conservation:
UQ/sensitivity:
Archive DOI:
Known artifacts:
```

### 23.5 Historical-claim card

```markdown
Claim:
Earliest located source:
Original wording and location:
Manuscript / patent / court / edition identifier:
Date convention:
Translation/transcription status:
Chain of custody:
Contemporary corroboration:
Later recollection:
Secondary interpretation:
Confidence:
What would change the assessment:
```

### 23.6 Patent-analysis card

```markdown
Patent number and title:
Inventor/assignee:
Filing, priority, publication, grant:
Jurisdiction and legal status:
Independent claims:
Key figures:
Reduction to practice evidence:
Prior art:
Litigation:
What the patent does not prove:
```

---

## 24. Maintenance, caveats, and final self-check

### 24.1 Maintenance rules

- Re-check [CODATA](https://physics.nist.gov/cuu/Constants/), [PDG](https://pdg.lbl.gov/), [NNDC](https://www.nndc.bnl.gov/), [IAEA Nuclear Data Services](https://www-nds.iaea.org/), [Materials Project](https://next-gen.materialsproject.org/), and mission-specific data releases before relying on a numeric value.
- Record database release, query date, and uncertainty.
- Re-run link checks periodically; a stable DOI is preferred to a landing page, and archived scans are preferred to paraphrased quotations.
- When a new edition or transcription appears, update claims rather than silently replacing the old source.
- Preserve failed searches and contradictions in the working log.

### 24.2 Final response checklist

Before reporting to a user, verify that the answer:

- has a direct answer and confidence label;
- uses SI units and states conventions;
- distinguishes source evidence from inference;
- cites primary or authoritative sources beside load-bearing claims;
- includes uncertainty and domain of validity;
- includes at least one independent check for consequential claims;
- states negative evidence and limitations;
- respects safety and professional boundaries;
- does not present a patent, biography, court decision, simulation, or archive listing as more than it is;
- does not end with a generic bibliography in place of inline evidence.

### 24.3 Standing caveats

- Book titles in this library identify standard learning anchors; always check edition, errata, and current course availability before assigning them.
- Open-access database entries can change; computational records are not automatically experimental measurements.
- Historical dossiers are controlled by available public records, not a claim that no relevant private or restricted records exist.
- The Newton and Tesla myth tables reject slogans, not the genuine importance of either figure.
- This library supports research and critique; it does not authorize construction, operation, diagnosis, treatment, certification, or regulated engineering work.

**End of library.**
