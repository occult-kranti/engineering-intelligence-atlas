# Physics coverage, access limits and expansion queue

Research cutoff: **2026-11-25 UTC**. This is a substantial foundational-to-frontier atlas with selected current research. It does **not** claim to enumerate every formula, every subfield, every current paper or a universally best method.

## What is present

The first generated and checked release contains **141 concept records, 82 formula records, 147 typed concept edges and 62 sources**. Of the sources, 25 are original research papers/preprints under the registry's research categories; the remaining entries include author educational sources, official constants/documentation, a metrology handbook, an author perspective, an independent assessment, a committee statement and a provider announcement. Publication-year counts are not substituted for access-depth claims.

| Domain | Formula cards | Principal developed branches | Mapped or bounded branches |
|---|---:|---|---|
| Electrostatics | 19 | Point/continuous charges, potential, Gauss/Poisson, uniqueness, images, Green functions, multipoles, capacitance/energy, dielectrics, interfaces, Debye/PB, finite differences/elements, charge equilibration, logarithmic potential | Boundary elements, Ewald implementation variants, electrochemical interfaces, full machine-learning benchmark comparison |
| Magnetism | 22 | Current continuity, Lorentz/Biot–Savart/Ampère, vector potential, induction, Maxwell, Poynting, magnetization, paramagnetism, spin models, Larmor/LLG, skyrmion charge, MHD/Alfvén, Josephson, gauge curvature/Wilson loops, Berry phase, vortex energy | Full spin-wave theory, quantum spin liquids, material-specific exchange models, kinetic reconnection, device endurance/integration, full Yang–Mills proof replay |
| Gravity | 19 | Newton/Poisson/orbits, variational mechanics, metric/connection/geodesic/curvature, Einstein equations/action, Schwarzschild/redshift/lensing, quadrupole waves, Friedmann fluids, black-hole thermodynamics, restricted bootstrap coefficient | Kerr derivation, numerical-relativity formulations, complete cosmological likelihood analysis, quantum-gravity frameworks, source-paper proof replay |
| Frequency/waves | 22 | Frequency/phase, harmonic/damped/driven systems, energy budgets, modes, Fourier/Laplace/convolution, DFT/sampling/PSD, waves/dispersion/acoustics/membranes, quantum occupation, Allan deviation, exceptional points, graph spectra/wavelets | Plate theory, nonlinear/chaotic oscillators, soliton integrability, full statistical spectral estimation, device-specific quantum error budgets |

All concept paths currently contain four navigational levels. This gives a structured starting taxonomy, not evidence of equal depth at every leaf. Some nodes are explicitly `mapped-for-expansion`. The formula count includes grouped related equations in one card; it is not a count of independent theorems.

## Source-access distinctions

Every source records its URL, publication date/year when verified, access date, source type, access depth, summary and limitations. The atlas distinguishes these cases:

- **Selected full HTML/PDF sections inspected:** official educational sources; LES author perspective; DESI Lyα analysis; gravity-entanglement discussion; phonon-gate conclusions/measurement correction; acoustic-interface results; source equations in OOMMF; selected skyrmion experiment sections; pyDelPhi author-hosted PDF.
- **Abstract or indexed publisher evidence:** several recent materials papers, neural PB, GWTC-5.0 with its collaboration summary, the nuclear-clock paper and absorbing-exceptional-point paper. Claims remain at the level supported by those excerpts.
- **Assessment/provenance inspected:** Yang–Mills repository README and committee statement; November black-hole preprint abstracts and disclosed provenance; provider announcement. No local Lean rebuild or independent reconstruction of multi-loop/bootstrap proofs occurred.
- **Historical bibliographic provenance:** Ewald's original German paper was located through publisher metadata, not fully translated. Modern mechanism descriptions are separately cross-checked against accessible author material.

The pyDelPhi and neural PB papers illustrate why date fields need care: both have 2025 online dates and 2026 journal issues. Their `year` fields now follow the journal year while `publication_date` and limitations preserve online dates. A final metadata check established the nuclear-clock paper's online date as 2026-10-07 using the publisher and PubMed, and the LES benchmark paper's date as 2025-10-01 using publisher metadata.

## Current frontier corrections retained in the graph

1. The cited November 2026 Yang–Mills assessment endorses the stated existence construction but explicitly excludes a mass-gap proof and uniqueness of the infinite-volume limit. The atlas does not repeat a stale blanket claim that no four-dimensional existence progress has occurred, and does not inflate existence into the full mass-gap result.
2. DESI's 2026 Lyα full-shape result cannot be reduced to an earlier single headline about evolving dark energy. Dataset combinations and alternative-model assumptions remain part of the inference.
3. The November Hawking–Page result has weak-coupling and theory-specific scope. The modular-bootstrap result has CFT, functional-class and asymptotic restrictions. AI provenance and reported checking do not equal a local proof replay.
4. Acoustic interference visibility is not automatically a logical gate fidelity. Clock stability is not automatically accuracy. A topological label is not arbitrary-perturbation immunity. A high resonant amplitude is not net power gain.

See the primary URLs in the field chapters and `sources.json`. These corrections are factual distinctions, not assessments of institutional trustworthiness.

## Reproducible work and its limits

`validate_physics.py` checks ID uniqueness, reference resolution, four-level taxonomy, formula-card completeness, analogy typing, prerequisite acyclicity and chapter links. Its original numerical examples check a finite-difference refinement ratio, charge conservation in a small equilibrium system, oscillator power balance, graph Dirichlet energy, alias equivalence, Allan bias behavior, black-hole scales and the bootstrap constant's arithmetic. Results are written to `validation.json`.

These checks detect concrete data and example errors. They do not verify every formula symbol, certify experiments, reproduce author benchmarks, establish a formal theorem, or show that a numerical method is optimal. No measurement data from a laboratory were collected in this task. No historical scientist, Claude instance or external named expert participated in this atlas's agent team.

## Prioritized deep expansion queue

| Priority | Branch | Next substantive work | Completion evidence needed |
|---|---|---|---|
| 1 | Formula and source review | Independent sign/unit/assumption audit, especially gauge, curvature, interface and spectral conventions | Concrete issue list, corrections, rerun integrity checks |
| 1 | Graph-memory transfer | Evaluate retrieval and invalidation on actual repository questions with distractors and changed sources | Query set, provenance, cache-hit/refresh results, failure examples |
| 2 | Computational electrostatics | Derive Ewald/PME/FMM error controls; compare finite-element, finite-difference and boundary-element solvers on matched geometry | Reproducible convergence and cost curves, declared boundary/charge conventions |
| 2 | Correlated magnetic matter | Develop spin waves, exchange extraction, critical phenomena, spin liquids, magnon bands and Chern response | Primary-paper sets plus model-specific derivations and experimental limits |
| 2 | Relativity numerics | ADM/3+1 constraints, BSSN/generalized-harmonic evolution, wave extraction, merger waveform calibration | Constraint/convergence studies and source-data provenance |
| 2 | Wave/statistical inference | Wavelets beyond graph kernels, multitaper spectra, nonstationary inference, nonnormal response and realistic noise | Confidence/coverage calibration, numerical examples, error-budget comparisons |
| 3 | Quantum-gravity approaches | Separate effective field theory, holography, string, loop/spinfoam, asymptotic-safety and causal approaches | Framework-specific assumptions, actual proved statements, observational discriminants |
| 3 | Nonlinear waves | Duffing, synchronization, chaos, KdV/NLS solitons, turbulence and nonlinear acoustics | Stability/bifurcation derivations and reproducible numerical experiments |
| 3 | Extended geometry/materials | Plates, shells, elasticity, electrochemistry, nonlocal dielectrics, Casimir and fluctuational electrodynamics | Correct governing operators, material conditions and original paper coverage |

The mathematics and AI-problem-status chapters are handled by a separate team member; this module only supplies the physics-facing bridges and precise local scope. The software memory engine is integrated by the parent task. No changes outside this module's assigned directory were made by this worker.
