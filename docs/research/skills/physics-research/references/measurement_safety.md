# Physics Research — Measurement, Uncertainty, Safety, and Professional Gates

These gates are non-negotiable: they override schedule and budget pressure, and no approval or composition protocol can waive them.

## SI units and metrology vocabulary

- Use the [BIPM SI Brochure](https://www.bipm.org/en/publications/si-brochure) for unit definitions — the post-2019 SI based on fixed defining constants, not a pre-2019 summary.
- Use [JCGM VIM](https://jcgm.bipm.org/vim/en/) terms precisely: measurand, measurement result, calibration, traceability, accuracy, precision, repeatability, reproducibility, uncertainty.
- Use [NIST CODATA](https://physics.nist.gov/cuu/Constants/) recommended values with covariance; record the adjustment year. Use the [BIPM KCDB](https://www.bipm.org/kcdb/) for calibration and measurement capabilities.

## Uncertainty workflow (GUM / NIST TN1297)

1. **Define the measurand and model** \(y=f(x_1,\ldots,x_n)\); a naked repeated reading is not a measurement model.
2. **List input contributions:** statistical scatter, calibration, reference standard, drift, resolution, alignment, environment, loading, timebase, background, analysis choices, model terms.
3. **Evaluate Type A** components by statistics of repeated observations.
4. **Evaluate Type B** components from calibration certificates, specifications, prior data, and reasoned distributions.
5. **Propagate:** \(u_c^2(y)\approx\sum_i(\partial f/\partial x_i)^2u^2(x_i)\) for independent inputs; include covariance for correlated inputs.
6. **Choose coverage:** report standard \(u\) or expanded \(U=ku\); state \(k\) and the approximate confidence level; never claim \(k=2\) guarantees exactly 95%.
7. **Report coherently:** \(y \pm U\) with units, coverage factor, calibration date, method, and environment.
8. **Maintain traceability:** an unbroken calibration chain to recognized standards, each link with uncertainty.
9. **Review:** sensitivity ranking, independent estimate, residual analysis, interlaboratory comparison, end-to-end check with a reference artifact.

Common metrology failures: treating resolution as uncertainty; ignoring calibration uncertainty or correlation; averaging readings while drift is unmodeled; mixing \(1\sigma\), \(2\sigma\), half-width, tolerance, and maximum error; rounding the central value before propagation; more significant figures than the uncertainty supports; quoting an old CODATA/PDG value without adjustment year; calling an instrument "accurate" without measurand, range, conditions, and uncertainty; confusing repeatability with reproducibility; assuming normality for asymmetric, bounded, Poisson, or calibration-limited measurements.

## Experiment checklist

1. Define the measurand and decision threshold before data collection.
2. Draw the full chain: source → sample → sensor → amplifier → filter → digitizer → timestamp → storage → analysis.
3. Record sensor model, serial number, calibration date, range, resolution, drift, temperature coefficient, and uncertainty.
4. Measure backgrounds, blanks, dark counts, offsets, noise spectra, cross-talk, dead time, and environmental sensitivity.
5. Run controls and blind or shuffled conditions where practical.
6. Preserve raw data and immutable run metadata; separate exploratory from confirmatory analysis.
7. Predeclare analysis choices where possible; report deviations.
8. Estimate systematic uncertainties independently of statistical scatter.
9. Reproduce at least one result with a different instrument, setting, sample, analyst, or analysis route.
10. Keep an anomaly log; unexplained anomalies are results about the experiment even if they are not new physics.

## Laboratory safety boundaries

- Electrical, optical, cryogenic, pressure, vacuum, chemical, magnetic, acoustic, ionizing, and mechanical hazards require local risk assessment, authorized training, lockout/tagout, engineering controls, PPE, and emergency procedures.
- Help locate standards and reason qualitatively, but never approve an apparatus, override interlocks, calculate an operational exposure plan, or substitute for a safety officer.
- Any unattended system needs documented failure modes, alarms, shutdown behavior, thermal/pressure limits, access control, and a responsible-person contact.
- Record every hardware/software change that can alter the measurement chain.

## Non-negotiable professional boundaries

- **Life safety:** no step-by-step instructions for constructing or operating hazardous high-voltage, high-pressure, laser, radiation, explosive, or beam systems. Give hazard classes, standards, and safe references; direct the user to institutional controls.
- **Nuclear and radiological:** conceptual physics, shielding principles, non-sensitive textbook calculations, and public data are acceptable. Design optimization, procurement, operation, or evasion of controls for reactors, accelerators, critical assemblies, or weapons is not. Controls: [IAEA Safety Standards](https://www.iaea.org/resources/safety-standards), [NRC regulations](https://www.nrc.gov/reading-rm/doc-collections/cfr/), [ICRP](https://www.icrp.org/).
- **Weapons and destructive uses:** explain published physics at a high level; never provide buildability, targeting, employment, concealment, or vulnerability-defeat instructions.
- **Regulated engineering:** power systems, aircraft, medical devices, pressure vessels, lasers, and critical software require licensed engineers, local codes, and institutional review. Prepare evidence summaries and test plans; do not approve implementation.
- **Human subjects and clinical physics:** diagnostic, therapeutic, imaging, or exposure decisions belong to qualified clinicians and medical physicists ([AAPM](https://www.aapm.org/), [FDA medical devices](https://www.fda.gov/medical-devices)).
- **Historical attribution:** patents and court decisions establish legal priority in a defined jurisdiction and period, not a complete history of invention. Route historical claims through the archive-first method of the science-history-research skill.

## Engineering handoff

Physics becomes engineering when a result is used to choose a material, set an operating limit, design an instrument, estimate risk, or certify performance. Make the physics auditable and the handoff explicit; do not impersonate the responsible engineer.

Handoff package fields: requirement and use case; physical model and assumptions; input values with source and uncertainty; output quantity with unit and uncertainty; verification evidence; validation evidence and domain; limits, interlocks, excluded regimes; failure modes and observables; standards/regulations implicated; responsible discipline and required sign-off; open questions and residual risk.

Translation rules: convert predictions into requirements only after defining acceptance criteria, test methods, uncertainty, environmental envelope, and failure consequences; maintain traceability from stakeholder need → physics model → analysis/simulation → design parameter → verification test → field evidence; treat simulation as evidence only when the code is verified and the model validated for the intended regime; include operating and forbidden envelopes; distinguish proof of concept, prototype, qualification, certification, and field operation; preserve red-team results.

Engineering red flags: model output quoted without units, tolerance, or environmental conditions; textbook formula applied to a proprietary device without measuring actual material and geometry; simulation presented as certification; a patent or historical prototype treated as evidence of modern safety or performance; a single nominal calculation replacing design margin or failure-mode analysis; omitted human factors, maintenance, cybersecurity, supply-chain variation, or end-of-life behavior; any request to bypass an interlock, detector, alarm, regulator, or licensed review.
