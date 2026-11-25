# Magnetism: currents, quantum order, topology and controlled memory states

## The organizing distinction

Magnetism spans several levels that should remain distinct: fields created by prescribed currents; energy and momentum exchanged by time-dependent electromagnetic fields; microscopic magnetic moments; collective ordered phases; and devices that write, retain and read a state. A result at one level does not automatically establish a result at the next. In particular, imaging a stable texture or measuring a band splitting is different from demonstrating an integrated memory with measured retention, endurance, error rate and energy cost. Foundational entry: [Feynman, Magnetostatics](https://www.feynmanlectures.caltech.edu/II_13.html).

## 1. Currents, continuity and force

Charge conservation relates current divergence to changing charge density: ∂ρ/∂t+∇·**J**=0. A truly steady current has zero divergence, including all return paths. The familiar drawing of an isolated current segment is a field-calculation idealization, not a complete stationary circuit. A wire that delivers charge somewhere must have a consistent source, sink or return path in the physical description. [pf-continuity](formula-catalogue.md#pf-continuity).

The magnetic part of the Lorentz force is q**v**×**B**. Its scalar product with velocity vanishes, so it bends an ideal particle trajectory without doing instantaneous mechanical work. Electric fields can change the particle's kinetic energy. This does not mean magnets can never exchange energy with mechanical systems: moving conductors, changing currents, source circuits and induced electric fields provide the relevant work channels. See [pf-lorentz](formula-catalogue.md#pf-lorentz) and [Feynman's induction treatment](https://www.feynmanlectures.caltech.edu/II_17.html).

**Worked circular motion.** In a uniform magnetic field, a nonrelativistic particle with perpendicular speed v has centripetal force mv²/r=|q|vB. Therefore r=mv/(|q|B) and the orbital angular frequency is |q|B/m. Radius grows with speed while the nonrelativistic cyclotron frequency does not. A parallel velocity adds translation along the field, giving a helix. Once relativistic momentum matters, the mass-times-speed expression must be replaced and the frequency changes. This calculation is an application of the Lorentz-force card, not an all-plasma model.

## 2. Magnetostatic solutions and gauge freedom

Biot–Savart integrates the contribution of a localized steady current distribution. Ampère's law converts circulation of **B** around a loop into enclosed current, but it gives the field algebraically only when symmetry controls the integrand. For a long straight wire, cylindrical symmetry gives B=μ₀I/(2πr). For a finite arbitrary conductor, choosing a convenient loop does not manufacture symmetry. [pf-biot-savart](formula-catalogue.md#pf-biot-savart), [pf-ampere](formula-catalogue.md#pf-ampere), [magnetostatic source](https://www.feynmanlectures.caltech.edu/II_13.html).

Because ∇·**B**=0, a vector potential can locally represent **B**=∇×**A**. Adding ∇χ to **A** leaves **B** unchanged. A gauge condition removes redundant representation degrees of freedom when solving equations, but gauge choice does not change the observable field. Multiply connected domains and quantum phase experiments require care beyond an elementary local argument. [pf-vector-potential](formula-catalogue.md#pf-vector-potential), [Feynman, The Vector Potential](https://www.feynmanlectures.caltech.edu/II_15.html).

For a small current loop, the magnetic moment is current times oriented area. In a prescribed external field its torque is **m**×**B** and an appropriate orientation energy is −**m**·**B**. If currents and positions are allowed to change together, the power supplies must be included in energy bookkeeping. Differentiating a field-energy expression while silently holding the wrong control variable fixed can predict the wrong mechanical force. [pf-dipole-torque](formula-catalogue.md#pf-dipole-torque).

## 3. Time dependence closes the conservation laws

Faraday's law connects changing magnetic flux with electric circulation. For a moving loop, the motional term **v**×**B** participates in electromotive force. Inductance summarizes a quasistatic flux-current relation; an ideal linear inductor stores ½LI² and opposes changes through a voltage L dI/dt. These relations are not license to ignore radiation, resistance, saturation or changing geometry. [pf-faraday](formula-catalogue.md#pf-faraday), [pf-inductor](formula-catalogue.md#pf-inductor).

Ampère's original steady-current form cannot be the full time-dependent law because its divergence would force ∇·**J**=0 at all times. Adding ε₀∂**E**/∂t in vacuum and using Gauss's law restores charge continuity. This is an example of a constraint selecting the required structure of an equation. The complete vacuum Maxwell system then yields waves with c=1/√(μ₀ε₀). The constants must be interpreted under modern SI: c is exact, while μ₀ and ε₀ are connected to measured electromagnetic constants rather than both separately exact. [pf-maxwell](formula-catalogue.md#pf-maxwell), [NIST constants](https://physics.nist.gov/cuu/Constants/).

**Deriving the energy budget.** Dot the Ampère–Maxwell equation with **E**, dot Faraday's law with **B**/μ₀, and subtract using

$$\nabla\cdot(\mathbf E\times\mathbf B)=\mathbf B\cdot(\nabla\times\mathbf E)-\mathbf E\cdot(\nabla\times\mathbf B).$$

The result is ∂u/∂t+∇·**S**=−**J**·**E**, with vacuum u=(ε₀E²+B²/μ₀)/2 and **S**=**E**×**B**/μ₀. The equation specifies storage, transport and transfer to matter. A resonator can concentrate energy spatially while obeying this budget. An apparent gain must be assessed across a closed boundary and a full time interval, including sources and stored-energy changes. [pf-poynting](formula-catalogue.md#pf-poynting), [Feynman, Field Energy and Field Momentum](https://www.feynmanlectures.caltech.edu/II_27.html).

## 4. From moments to statistical order

Magnetization **M** is magnetic moment per volume. Its curl and boundary cross-product act as equivalent bound currents in a macroscopic description. Defining **H**=**B**/μ₀−**M** separates free-current bookkeeping from magnetization, but a constitutive law is still required. Linear isotropic susceptibility is useful only within its domain; hysteresis and domain rearrangement cannot be reconstructed from one constant χ. [pf-magnetization](formula-catalogue.md#pf-magnetization), [Feynman, Ferromagnetism](https://www.feynmanlectures.caltech.edu/II_36.html).

For independent two-state magnetic moments, the partition function is Z=2cosh(μB/kBT). Differentiating its logarithm gives M=nμtanh(μB/kBT). At weak field this is nμ²B/(kBT), while at high field it saturates. The factor for a classical continuously oriented moment differs; importing the classical 1/3 into a two-state model mixes models. [pf-paramagnet](formula-catalogue.md#pf-paramagnet), [Feynman, Paramagnetism and Magnetic Resonance](https://www.feynmanlectures.caltech.edu/II_35.html).

Collective magnetism requires interactions. Ising variables retain a discrete component, whereas a Heisenberg model uses vector or spin-operator couplings. Exchange sign, lattice geometry, dimensionality, anisotropy, disorder and competing couplings determine possible phases. Frustration means local interaction preferences cannot all be simultaneously satisfied; it does not simply mean “complex network.” A finite graph with an energy function also differs from an infinite system with a thermodynamic phase transition. [pf-spin-model](formula-catalogue.md#pf-spin-model), [Feynman, Magnetic Materials](https://www.feynmanlectures.caltech.edu/II_37.html).

The computational connection to associative memory is specific: pairwise interaction energies can produce many attracting configurations under a chosen dynamics. Whether those configurations encode intended memories, retain capacity under noise, or correspond to a biological circuit must be established separately. The physics graph therefore marks the Ising-to-graph comparison as an **analogy**, preventing it from acting as evidence for a brain-level identity.

## 5. Dynamics, defects and protected quantities

Landau–Lifshitz–Gilbert dynamics combines precession with dissipative relaxation of magnetization. Its effective field derives from an energy functional containing exchange, anisotropy, applied-field and demagnetizing terms as needed. Unit-length dynamics should preserve |**m**|; damping should decrease the stated energy when no drive supplies work. Those provide useful numerical checks. The γ convention must specify whether the effective field is **H** in A/m or **B** in tesla. [pf-llg](formula-catalogue.md#pf-llg), [NIST OOMMF evolvers](https://math.nist.gov/oommf/doc/userguide21a0/userguidexml/sec_oxsEvolvers.html).

A skyrmion charge integrates how a two-dimensional magnetization texture wraps the sphere of directions. Integer quantization needs smoothness and boundary conditions that compactify or appropriately fix the domain. A topology label therefore does not imply immunity to boundary escape, singular configurations, heating or destructive drive. The [2024 skyrmion-bag experiment](https://advanced.onlinelibrary.wiley.com/doi/full/10.1002/adma.202403274) supplies a material-specific example; geometry, field and temperature limit its stability. [pf-skyrmion](formula-catalogue.md#pf-skyrmion).

Two other topological ideas deserve separate nodes. A Berry phase is acquired by a quantum state transported adiabatically around a parameter loop; it requires eigenstates and a transport law, not merely a drawn cycle. A two-dimensional vortex has winding of an angular order parameter around a defect. Its energy grows logarithmically with size, as does its placement entropy, motivating a vortex-unbinding mechanism. Neither winding construction is identical to skyrmion charge. [pf-berry-phase](formula-catalogue.md#pf-berry-phase), [Berry, 1984](https://doi.org/10.1098/rspa.1984.0023); [pf-vortex-energy](formula-catalogue.md#pf-vortex-energy), [Kosterlitz and Thouless, 1973](https://doi.org/10.1088/0022-3719/6/7/010).

## 6. Plasma and superconducting bridges

MHD couples fluid inertia to electromagnetic stress under a continuum closure. Combining resistive Ohm's law with induction produces advection/stretching of **B** plus magnetic diffusion. Setting fluid velocity to zero leaves exponential decay of each spatial Fourier component; it does not create an oscillation. Adding fluid inertia and magnetic tension produces Alfvén waves. The fluid approximation must be reconsidered near kinetic scales or when predicted speeds approach c. [pf-mhd-induction](formula-catalogue.md#pf-mhd-induction), [pf-alfven](formula-catalogue.md#pf-alfven), [Fitzpatrick's MHD-wave notes](https://farside.ph.utexas.edu/teaching/plasma/Plasmahtml/node107.html).

Superconductivity introduces a coherent quantum phase. The Josephson phase rate relates voltage to an energy difference for charge 2e, providing a precise frequency-voltage conversion. An ideal zero-voltage supercurrent has zero electrical power IV; it is not an energy source. Circuit resistance, capacitance, magnetic flux and quasiparticle channels determine actual device dynamics. [pf-josephson](formula-catalogue.md#pf-josephson), [Feynman, A Seminar on Superconductivity](https://www.feynmanlectures.caltech.edu/III_21.html).

## 7. Selected 2024–2026 frontier and proof-status boundaries

[MnTe evidence in 2024](https://www.nature.com/articles/s41586-023-06907-7) and [Co₁/₄TaSe₂ in 2026](https://www.nature.com/articles/s41467-026-76784-x) study altermagnetic spin splitting. [Electrical reading and switching in PtTe₂/CrSb](https://www.nature.com/articles/s41563-026-02721-4) advances the device-control question. Those source records are indexed publisher coverage in this pass; they establish specific reported demonstrations, not audited production-memory metrics. Compensated magnetization alone does not identify an altermagnet because the symmetry and momentum dependence matter.

Non-Abelian gauge theory generalizes an electromagnetic connection to matrix-valued fields. The commutator term makes curvature nonlinear. A Wilson loop traces group-valued transport around a closed path, cancelling endpoint gauge transformations. A software graph cycle is not a Wilson loop without this additional structure. [pf-nonabelian](formula-catalogue.md#pf-nonabelian), [gauge-theory lecture](https://www.tpi.uni-jena.de/~floerchinger/qft2/lecture15/).

The current 2026 status must be stated narrowly. The [Yang–Mills assessment repository](https://github.com/yang-mills-group/YM) and [November 9 committee statement](https://www.kitp.ucsb.edu/sites/default/files/3rd-Statement-About-Quantum-YangMills-Theory_Nov-9.pdf) endorse the described four-dimensional scaling-limit existence construction. The repository explicitly excludes a mass-gap proof and uniqueness of the infinite-volume limit. This atlas inspected the assessment and reproduction instructions but did not rebuild the proof package. “Existence,” “mass gap,” “formalized component,” “independent assessment” and “locally replayed verification” remain separate graph attributes.

## Questions that test understanding

1. Where does energy enter when a moving magnetic system performs mechanical work?
2. Which γ and field-unit convention does a micromagnetic simulation use?
3. What boundary or smoothness assumption protects a stated topological charge?
4. Which extra measurements turn a switching demonstration into a useful memory specification?
5. What exact statement remains unproved when an existence construction excludes the mass gap?
