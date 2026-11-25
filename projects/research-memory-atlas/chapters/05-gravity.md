# Gravity: inverse-square dynamics, spacetime geometry and bounded frontier claims

## Conventions and scope

This chapter uses metric signature (−,+,+,+), takes x⁰=ct when all coordinates are given in length units, and declares a Riemann convention in the formula catalogue. Newtonian density is mass per volume; cosmological density is energy density divided by c² unless explicitly stated. These choices eliminate many apparent disagreements caused by a missing c², a different scale-factor normalization or a curvature-sign reversal. The foundational route follows [Tong's general-relativity course](https://www.damtp.cam.ac.uk/user/tong/gr/grhtml/) with SI restored explicitly.

The chapter develops a path to current research, not a complete classification of every gravity theory. Strong-field numerics, cosmological inference and quantum gravity each require their own statistical or mathematical machinery. A compact formula can define an entire research program without solving it.

## 1. The Newtonian model is already a boundary problem

Newtonian gravity shares an inverse-distance Green kernel with electrostatics, but the force is attractive for positive masses and the potential obeys ∇²Φ=+4πGρₘ. The acceleration is −∇Φ. This is an exact correspondence between mathematical operator forms under different source conventions; it does not identify mass with electric charge. [pf-newton](../FORMULA_NOTEBOOK.md#pf-newton), [pf-grav-poisson](../FORMULA_NOTEBOOK.md#pf-grav-poisson), [Tong, weak gravity](https://www.damtp.cam.ac.uk/user/tong/gr/grhtml/S5.html).

**Worked tidal calculation.** For Φ=−GM/r, the Hessian is

$$
\partial_i\partial_j\Phi=\frac{GM}{r^3}(\delta_{ij}-3\hat r_i\hat r_j).
$$

Two nearby falling particles have relative acceleration −(Hessian Φ)**ξ**. Radial separation therefore stretches with coefficient 2GM/r³, while either transverse separation compresses with coefficient −GM/r³. The trace vanishes outside the source, agreeing with the vacuum Poisson equation. Transforming into a frame falling with one particle removes its local acceleration but cannot remove this relative effect across the pair. That is the Newtonian precursor of curvature. [pf-curvature](../FORMULA_NOTEBOOK.md#pf-curvature), [Tong, Riemannian geometry](https://www.damtp.cam.ac.uk/user/tong/gr/grhtml/S3.html).

For two bodies, relative and center-of-mass coordinates separate the dynamics. The reduced mass handles relative kinetic energy; the total mass enters the relative orbital frequency. Energy and angular momentum reduce the central-force problem to one radial degree of freedom. Confusing one body's barycentric radius with the relative semimajor axis creates a mass-ratio error even when Kepler's formula looks familiar. [pf-kepler](../FORMULA_NOTEBOOK.md#pf-kepler), [Tong, geodesics and orbital limits](https://www.damtp.cam.ac.uk/user/tong/gr/grhtml/S1.html).

## 2. Variational mechanics is the bridge to geometry

Stationary action provides a reusable derivation method. Perturb a path, integrate its velocity-variation term by parts, impose endpoint conditions and use the arbitrariness of the remaining variation. This gives Euler–Lagrange equations. The word stationary matters: some physical paths are saddle points, so “nature always minimizes action” is too strong. [pf-variational](../FORMULA_NOTEBOOK.md#pf-variational).

In relativity, the metric converts coordinate displacements into invariant intervals. For a timelike worldline, dτ²=−ds²/c² gives the proper time a comoving ideal clock measures. Coordinate time is a label attached to a chart; it need not coincide with every clock. In flat inertial coordinates the metric produces familiar special-relativistic time dilation. In curved geometry, the full metric and observer path must be used. [pf-metric-time](../FORMULA_NOTEBOOK.md#pf-metric-time), [Tong, differential geometry](https://www.damtp.cam.ac.uk/user/tong/gr/grhtml/S2.html).

To differentiate a vector field while retaining its geometric meaning, introduce a connection. Metric compatibility and zero torsion determine the Levi-Civita connection. A geodesic has tangent vector transported parallel to itself, giving an acceleration term plus a connection term. Connection components can be nonzero in flat polar coordinates; curvature is the tensorial obstruction that remains after coordinate effects are separated. [pf-connection](../FORMULA_NOTEBOOK.md#pf-connection), [pf-geodesic](../FORMULA_NOTEBOOK.md#pf-geodesic).

**A useful invariance check.** In a flat plane, a straight path written in Cartesian coordinates has zero coordinate acceleration. In polar coordinates the radial coordinate generally accelerates and the angular coordinate generally changes nonuniformly. The polar connection terms cancel those coordinate accelerations. Therefore “nonzero coordinate acceleration” is not a sufficient detector of a physical force. Likewise, a complicated graph layout does not establish curved physical space; a metric and operational interpretation would first be required.

## 3. Einstein's equations are a constrained dynamical system

The stress-energy tensor contains energy density, momentum density and stresses. Einstein's equations relate those quantities to curvature, with a possible cosmological constant. In length coordinates, curvature has units m⁻² and the factor G/c⁴ turns energy density into the same units. The contracted Bianchi identity makes the geometric side covariantly divergence free, demanding compatible matter conservation. [pf-einstein](../FORMULA_NOTEBOOK.md#pf-einstein), [Tong, Einstein equations](https://www.damtp.cam.ac.uk/user/tong/gr/grhtml/S4.html).

The Einstein–Hilbert action packages this structure. Varying the metric produces both bulk terms and boundary terms; a well-posed variation requires the correct boundary data and corresponding boundary action. It is not legitimate to drop a boundary divergence merely because the final equation is familiar. The chosen matter action determines its own equations and stress tensor. [pf-einstein-action](../FORMULA_NOTEBOOK.md#pf-einstein-action).

The Newtonian limit is a nontrivial consistency check. A weak, static metric has g₀₀≈−(1+2Φ/c²). For slowly moving particles, the geodesic equation recovers acceleration −∇Φ, while the field equations recover Poisson's equation. Thus Newtonian theory appears as a controlled regime rather than an unrelated rule. Conversely, a solution outside that regime cannot be justified by extrapolating one weak-field formula indefinitely. [Tong's weak-field derivation](https://www.damtp.cam.ac.uk/user/tong/gr/grhtml/S5.html).

Numerical relativity adds initial constraints, gauge conditions, stable evolution formulations, mesh control and waveform extraction. The existence of a numerical plot is insufficient: constraint violations and resolution convergence must be assessed. This atlas maps that branch and explains why it is needed, while leaving a full formulation-by-formulation derivation to the expansion queue.

## 4. Exact solutions and observable effects

The Schwarzschild metric describes the spherically symmetric vacuum exterior with zero cosmological constant. It also describes the exterior of a suitable spherical star, so it is not synonymous with a black hole at every radius. Its mass parameter sets rₛ=2GM/c². The coefficient singularity at rₛ is removable by a suitable chart, whereas the central curvature singularity is a different issue. Rotating objects require additional structure such as the Kerr solution. [pf-schwarzschild](../FORMULA_NOTEBOOK.md#pf-schwarzschild), [Tong, black holes](https://www.damtp.cam.ac.uk/user/tong/gr/grhtml/S6.html).

The redshift calculation illustrates the role of observers. A stationary spacetime conserves an energy associated with its time symmetry. A static observer's locally measured frequency divides that conserved quantity by a position-dependent normalization. Emitter and receiver therefore obtain a frequency ratio depending on their locations and motions. In the weak stationary limit, light climbing through a potential difference ΔΦ loses a fraction ΔΦ/c² of its frequency. A one-metre height difference near Earth's surface is an illustrative fractional scale near 10⁻¹⁶; interpreting clock data at that scale requires systematic control as well as stability. [pf-redshift](../FORMULA_NOTEBOOK.md#pf-redshift), [Tong, geodesics](https://www.damtp.cam.ac.uk/user/tong/gr/grhtml/S1.html).

Light deflection and perihelion advance follow from null and timelike geodesics. The leading formulas have explicit weak-field conditions and depend on impact parameter or orbital eccentricity. Strong lensing, spin and finite-source effects require extensions. A formula with a small expansion parameter should carry the parameter's estimated size whenever used for a numerical claim. [pf-weak-orbit-tests](../FORMULA_NOTEBOOK.md#pf-weak-orbit-tests).

## 5. Gravitational waves connect derivatives to data

Linearizing the metric around a background produces a wave equation after gauge control. Conservation laws remove monopole radiation and constrain dipole behavior, leaving a changing mass quadrupole as the leading slow-motion source. The radiative strain is proportional to its second time derivative; emitted power depends on the squared third derivative. The exact definition of the trace-free quadrupole fixes the prefactor. [pf-gw-strain](../FORMULA_NOTEBOOK.md#pf-gw-strain), [pf-gw-power](../FORMULA_NOTEBOOK.md#pf-gw-power), [Tong, weak gravity](https://www.damtp.cam.ac.uk/user/tong/gr/grhtml/S5.html).

For a circular binary, the leading luminosity grows as separation to the power −5. Combining negative orbital-energy loss with the Kepler relation produces increasing orbital frequency: a chirp. The approximation explains the mechanism, but late inspiral, merger and ringdown need more accurate relativistic waveforms and calibrated detector response. A catalogue's conclusion depends on its likelihood, event selection, waveform assumptions and noise treatment.

The selected current paper [GWTC-5.0: Tests of General Relativity, July 2026](https://arxiv.org/abs/2607.19293) reports seven test families across 168 cumulative events and overall agreement with GR within stated limits. The source was inspected at abstract and collaboration-summary depth, not independently reanalysed. This constrains tested deviations; it is not a theorem excluding every alternative theory or a proof that the low-energy theory remains exact at arbitrary scales.

## 6. Cosmology: expansion, inference and model dependence

Homogeneity and isotropy reduce the background geometry to a scale factor and curvature sign. The Friedmann equation describes its rate; stress-energy conservation describes dilution and pressure work. A length-valued scale factor with k=−1,0,+1 is used in the catalogue. A dimensionless scale factor is equally legitimate if the curvature parameter's units change consistently. [pf-friedmann](../FORMULA_NOTEBOOK.md#pf-friedmann), [Tong, The Expanding Universe](https://davidtong.org/teaching/cosmology/cosmohtml/S1.html).

For a separately conserved component with constant p=wρc², integration gives ρ∝a⁻³⁽¹⁺ʷ⁾. Matter dilution comes from growing volume; radiation has an additional redshift factor; a vacuum-like component has constant density. Acceleration depends on ρ+3p/c², so negative enough pressure can accelerate expansion without a local repulsive force law between ordinary masses. [pf-equation-state](../FORMULA_NOTEBOOK.md#pf-equation-state).

Distances, redshifts, clustering and growth constrain these models statistically. The [DESI DR2 Lyα full-shape analysis, July/August 2026](https://arxiv.org/html/2607.27410v3) adds Alcock–Paczyński information near effective redshift 2.33. Its individual Lyα constraint moves toward ΛCDM, while combined-model preferences depend on dataset combinations. This is why a current atlas must retain dates and inference context rather than preserve only an earlier “dark energy evolves” headline. Neither microscopic dark-matter identity nor a fundamental dark-energy mechanism follows from the background formula alone.

## 7. Quantum and AI-assisted frontier: what is and is not established

Hawking's semiclassical calculation assigns temperature to an approximately stationary black hole. Together with the first-law relation it yields area entropy. A solar-mass Schwarzschild example has a very low predicted temperature; inverse mass scaling and negative heat capacity follow algebraically. These relations do not determine the final evaporation state or resolve the information problem. [pf-hawking](../FORMULA_NOTEBOOK.md#pf-hawking), [Hawking, 1975](https://authors.library.caltech.edu/records/2wsvj-qrt68).

Entanglement experiments are often proposed to probe gravitational mediation. The inference depends on assumptions about the mediator, locality and how matter is represented. [Aziz and Howl's paper, including its 2026 revision](https://arxiv.org/html/2510.19714v3), argues that specified classical-gravity/QFT constructions can generate entanglement. This is a theoretical challenge to a class of interpretations, not an observed discovery that gravity is classical or a settled universal impossibility result for quantum-gravity tests.

Two November 2026 preprints require equally precise scope. [The Hawking–Page transition at weak coupling](https://hexagonmath.org/2611.00175v1) reports a negative weak-coupling quartic coefficient in a specified large-N supersymmetric thermal gauge theory, supporting a first-order transition there. It does not establish the same behavior at every coupling. [The spinless modular bootstrap at large central charge](https://hexagonmath.org/2611.00174v1) reports a computer-assisted optimal leading slope in its admissible class Ā for the lightest non-vacuum Virasoro-primary dimension. “Spinless” sums primaries of all spins by dimension. Equality with the infinite-order finite-derivative optimum remains conjectural; [pf-bootstrap](../FORMULA_NOTEBOOK.md#pf-bootstrap) records this distinction and computes the constant. Both are preprints with disclosed AI provenance and partial human-understanding status; their proofs were not independently replayed here. The [provider announcement](https://www.anthropic.com/research/claude-black-hole-physics) is provenance, not a substitute for the mathematical statements.

The open research branches remain substantial: ultraviolet completion, black-hole information, singularity resolution, observational discriminants, quantum measurement interpretation, dark-matter microphysics and dark-energy mechanism. A network should keep these as explicit open questions with prerequisite paths and conflicting evidence where appropriate. It should not turn a highly connected node into a solved problem.
