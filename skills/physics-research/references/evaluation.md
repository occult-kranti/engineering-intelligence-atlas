# Physics Research — Evaluation and Failure Checks

Default audit battery. Apply the checks relevant to the claim; when the result is consequential, state why omitted checks were omitted. These checks are hard gates: they override schedule and budget pressure.

## Universal evaluation stack

| Layer | Required checks | Typical failure signature | Corrective action |
|---|---|---|---|
| Question framing | Observable, scale, regime, decision, precision, falsifier | Broad adjectives, no units, moving target | Rewrite as a measurable claim or decision rule. |
| Units and dimensions | SI dimensions, base/derived units, coordinate convention | Hidden \(2\pi\), \(c\), \(G\), \(k_B\), \(\hbar\); mass/mole confusion | Rebuild in SI per [BIPM SI](https://www.bipm.org/en/publications/si-brochure); check constants in [CODATA](https://physics.nist.gov/cuu/Constants/). |
| Model validity | Assumptions, constitutive laws, boundary/initial conditions | Textbook formula used outside its regime | State regime; test a limiting case; find a domain-specific model. |
| Conservation | Energy, mass, charge, momentum, angular momentum, probability | Numerical drift or free-energy output | Audit fluxes, sources/sinks, boundaries, dissipation, sign conventions. |
| Symmetry/invariance | Frame, gauge, parity, time reversal, rotations/translations | Result depends on arbitrary origin, gauge, or coordinate artifact | Form invariant observables; test transformations. |
| Limiting cases | Zero field, weak coupling, small/large length, high/low temperature, classical limit | Formula diverges where physics should not | Compare to exact cases and physical asymptotics. |
| Empirical fit | Data quality, calibration, uncertainty, selection, independence | Fit uses old constants or shared systematics | Re-query current databases; compare independent instruments. |
| Statistics/inference | Estimator, uncertainty, correlation, prior, multiple comparisons, look-elsewhere | Tiny \(p\)-value, no effect size or systematic budget | Predeclare analysis; report systematic covariance. |
| Computation | Verification, convergence, conditioning, conservation, seeds, environment | Plot changes under refinement or machine change | Manufactured solution, independent solver, versioned workflow. |
| Metrology | Traceability, calibration, Type A/B, coverage, correlation | Resolution quoted as uncertainty | Rebuild from [GUM](https://www.bipm.org/en/publications/guides) and [NIST TN1297](https://nvlpubs.nist.gov/nistpubs/Legacy/TN/nbstechnicalnote1297.pdf). |
| Source evidence | Primary source, edition/version, provenance, later corrections | Secondary quotation conflicts with primary text | Retrieve scan/DOI/patent/court record; assign confidence grade. |
| Engineering/safety | Envelope, standards, failure modes, qualified owner, interlocks | Simulation or patent treated as certification | Stop and route to the responsible professional. |

## Computational verification protocol

1. Unit-test each function against a known analytic or hand-computed result.
2. Regression-test against version-controlled trusted outputs with explicit tolerances.
3. Use manufactured solutions: construct an exact solution and forcing, then measure convergence order.
4. Track conservation of mass, charge, momentum, energy, probability, or norm as the model permits.
5. Refine mesh and time step; a flat residual plot is not proof of physical accuracy.
6. Compare a second independent method or code on a nontrivial benchmark.
7. Report precision, condition number, solver tolerance, and sensitivity.
8. Save random generator, algorithm, seed, stream structure, and number of independent chains.
9. Measure strong/weak scaling, communication, memory, I/O, and load imbalance for HPC claims.
10. Archive code (Zenodo DOI), preserve source history (Software Heritage), and deposit data with stable identifiers.

Computational red flags: a solution changes materially after one refinement; smoothness from numerical diffusion rather than understood physical dissipation; converged residuals with failed global conservation; many correlated fit parameters without sensitivity analysis; an ML model that performs well only on data from the same simulator; a notebook that runs only on one machine with unpinned dependencies; error bars smaller than calibration, discretization, finite-size, or model-form uncertainty; performance claims omitting problem size, hardware, precision, compiler, parallelism, and baseline.

## Physics-specific red flags

- **Energy creation:** output exceeds source after closed-system accounting.
- **Perpetual motion:** no identified heat source, driving field, or entropy production; "free energy" confused with thermodynamic free energy.
- **Superluminal claims:** phase/group/front velocity conflated; no causal signal test.
- **Quantum overclaim:** coherence, entanglement, or "observer" language without an operational measurement model; correlation alone does not prove entanglement; simulator results extrapolated to hardware without calibration.
- **Thermal overclaim:** efficiency above Carnot without proper temperature-difference or non-equilibrium analysis.
- **Numerical artifact:** instability tracks mesh spacing, time step, precision, boundary location, or solver tolerance.
- **Detector artifact:** signal follows gain, threshold, temperature, geometry, time of day, or maintenance events.
- **Database misuse:** a computed database value treated as experiment; an evaluated cross section treated as raw data.
- **Historical overclaim:** one patent, quotation, court case, or biography turned into a universal priority claim.
- **Single-source exceptional result:** no independent replication, blind analysis, or systematic-error budget.
- **Model selection by aesthetics:** symmetry or simplicity used as evidence without empirical comparison.
- **Parameter laundering:** uncertain measured inputs hidden in fitted parameters, then quoted as independent predictions.

## Exceptional-claim test

For claims that contradict established physics, require **all** of the following before presenting them as credible:

1. a precise, quantitative claim and regime;
2. independent replication using a different apparatus or method;
3. a full uncertainty and systematic budget;
4. blind or preregistered controls where possible;
5. conservation-law and limiting-case consistency;
6. raw data, calibration records, code, and environmental logs;
7. a plausible model of how known false positives were excluded;
8. survival after hostile expert review;
9. an explicit statement of what evidence would retract the claim.

If any item is absent, label the result provisional, unverified, or unsupported — never revolutionary.

## Source contradiction protocol

1. Identify the exact proposition on which sources disagree.
2. Compare dates, editions, definitions, units, samples, and methods.
3. Prefer current curated values for constants and evaluated quantities.
4. Prefer original text for quotations, attributions, and legal holdings.
5. Preserve both positions when uncertainty remains; do not force consensus.
6. Assign confidence using the A/B/C/D/X labels from SKILL.md.
7. Record whether a contradiction changes the conclusion, a subclaim, or only wording.

## Quantitative scorecard

Score 0–4 per dimension; do not average mechanically — a zero in safety or source provenance can be decisive. Report the minimum, not only the mean.

| Score | Meaning |
|---|---|
| 0 | Missing or contradicted |
| 1 | Plausible but unchecked |
| 2 | One credible source or calculation |
| 3 | Independent support and explicit uncertainty |
| 4 | Reproducible, converged, calibrated, externally consistent, documented |

Dimensions: theory, experiment/data, computation, metrology, literature/provenance, engineering/safety, reproducibility.

## Fail-stop conditions

Stop and escalate when: required dimensions do not close; conservation is violated without a stated source/sink; uncertainty is absent for a decision-critical number; a primary source cannot be identified for a load-bearing claim; a simulation is unverified or used outside its validation domain; requested work crosses a regulated or hazardous boundary; the user asks for concealment, bypass, weaponization, or harm; the evidence is only model output, social media, or promotional material; or the result would affect health, infrastructure, public safety, or national-security-relevant systems.
