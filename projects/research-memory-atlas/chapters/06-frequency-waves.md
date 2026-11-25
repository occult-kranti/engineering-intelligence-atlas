# Frequency and waves: oscillation, spectra, geometry and quantum control

## Frequency is a property of a defined observable

Frequency describes how a phase or repetitive observable changes with time. It is not an independent universal substance. A physical statement needs the observable, its units, an amplitude, a coupling mechanism, a measurement procedure and a dynamical model. Cycles per second and radians per second differ by 2π. An energy, a graph eigenvalue or a visual pattern cannot acquire units of hertz merely by being labelled a frequency. [pf-frequency](../FORMULA_NOTEBOOK.md#pf-frequency), [Feynman, The Harmonic Oscillator](https://www.feynmanlectures.caltech.edu/I_21.html).

This chapter follows a progression from one degree of freedom to many, from time records to spectral estimates, from spatial PDEs to boundary modes, and finally to quantum devices and open-system frontiers. The formula catalogue gives the assumptions and units for every step.

## 1. Why harmonic motion appears so widely

Near a stable smooth equilibrium, the first nonzero potential term is often quadratic. Its derivative is a linear restoring force. Mass provides inertia, so the equation becomes mẍ+kx=0 and the natural angular frequency is √(k/m). This is a local approximation, not an assertion that every system is globally sinusoidal. Higher-order terms can shift frequency with amplitude, couple harmonics or create bifurcations. [pf-oscillator](../FORMULA_NOTEBOOK.md#pf-oscillator).

**Worked energy cycle.** For m=1 kg, k=100 N/m and amplitude 0.02 m, the total oscillator energy is 0.02 J. At an extreme, velocity is zero and the energy is elastic. At equilibrium, displacement is zero and the speed is 0.2 m/s, giving the same kinetic energy. The oscillation frequency is approximately 1.59 Hz. Increasing amplitude by two increases energy by four while leaving this linear-model frequency unchanged. The frequency-energy relation therefore cannot be interpreted without saying whether the system is a classical mode or a single quantum transition.

Damping introduces a decay timescale. In the viscous model, amplitude decays as exp(−γt), while cycle-averaged energy decays approximately twice as fast in the weakly damped regime. Critical and overdamped motion have different solution forms. A quality factor Q quantifies storage relative to loss under a stated convention; it does not specify stored energy without amplitude or input. [pf-damped](../FORMULA_NOTEBOOK.md#pf-damped), [Feynman, Resonance](https://www.feynmanlectures.caltech.edu/I_23.html).

## 2. Resonance is a driven response with an energy budget

A sinusoidal ansatz transforms the driven oscillator equation into an algebraic complex response. The real and imaginary terms encode stiffness/inertia mismatch and dissipative lag. The measured variable matters: displacement, velocity and dissipated-power peaks can occur at different frequencies. At zero damping and exact resonance, the finite steady-response formula breaks down; the transient amplitude grows instead. [pf-forced](../FORMULA_NOTEBOOK.md#pf-forced).

Multiply the motion equation by velocity to obtain dE/dt=Fv−bv². The average energy change over a steady cycle is zero, so input power balances dissipation plus any extracted load power. A high amplitude in a low-loss resonator is compatible with small power input because energy circulates between storage forms. Connecting a load changes both the budget and the response. [pf-resonant-power](../FORMULA_NOTEBOOK.md#pf-resonant-power), [electromagnetic conservation counterpart](https://www.feynmanlectures.caltech.edu/II_27.html).

**A useful experimental question set.** What is driving the system? What is stored? What is dissipated? What crosses the measurement boundary? How long was the transient? Was voltage, pressure or displacement mistaken for power? These questions should precede a claim of unusual amplification. A local amplitude enhancement can reflect focusing, impedance transformation or standing-wave interference, while total energy remains conserved. No healing, consciousness or free-energy conclusion follows from the resonance equations alone.

## 3. Many oscillators introduce linear algebra

For coupled conservative coordinates, write **M**ẍ+**K**x=0. A normal-mode ansatz gives **K**φ=ω²**M**φ. Positive mass and nonnegative stiffness ensure real nonnegative squared frequencies. Different mode shapes are orthogonal in the mass-weighted inner product, not necessarily under an arbitrary Euclidean normalization. A zero mode can express a symmetry, such as translation of an unconstrained system. [pf-normal-modes](../FORMULA_NOTEBOOK.md#pf-normal-modes), [Feynman, Modes](https://www.feynmanlectures.caltech.edu/I_49.html).

Two equal masses joined by one spring already illustrate the essential distinction. Their common displacement mode has no restoring force; their difference mode stretches the spring and oscillates at √(2k/m). Add boundary springs and the spectrum changes. Geometry, coupling and constraints all enter the eigenproblem. A frequency list without the matrices and boundary conditions is therefore not a full mode specification.

This also explains degeneracy. A square membrane can have distinct mode shapes sharing one frequency because of symmetry. Arbitrary linear combinations within that eigenspace are also modes in the ideal model. Small asymmetry can split the degeneracy. A photograph of one driven pattern does not uniquely reconstruct the underlying mode basis.

## 4. Fourier and Laplace transforms solve different questions

Fourier series expand periodic signals in orthogonal harmonics. Fourier transforms extend the idea to a continuum of frequencies with a declared normalization. Parseval's identity preserves the squared norm between time and spectral representations. An infinite sinusoid is represented by delta distributions, not a finite-energy spectral bump. Finite measurement duration supplies a different object: a windowed record. [pf-fourier-series](../FORMULA_NOTEBOOK.md#pf-fourier-series), [pf-fourier](../FORMULA_NOTEBOOK.md#pf-fourier), [Feynman, Harmonics](https://www.feynmanlectures.caltech.edu/I_50.html).

The Laplace transform adds a complex growth/decay parameter and retains initial-condition terms. Its poles organize transients and stability of a linear time-invariant system. A transfer function alone describes the zero-initial-state response; a system with stored initial energy has an additional response. The frequency response on an imaginary-axis slice must respect the region of convergence. [pf-laplace](../FORMULA_NOTEBOOK.md#pf-laplace), [Feynman, Linear Systems](https://www.feynmanlectures.caltech.edu/I_25.html).

Convolution represents a linear time-invariant system as a sum of shifted impulse responses. It is a mathematical memory kernel: output depends on past input through a prescribed weighting. A document cache is a different kind of memory unless a specific kernel model is being implemented. For an exponential kernel, the same equation describes an ordinary low-pass filter or a designed smoothing rule. Similar algebra does not establish common empirical mechanism. [pf-convolution](../FORMULA_NOTEBOOK.md#pf-convolution).

## 5. Digital spectra require an observation model

Uniform sampling identifies frequencies that differ by an integer multiple of the sample rate. A 700 Hz cosine sampled at 1000 samples per second is indistinguishable from a suitable 300 Hz cosine. No digital filter can recover which one existed before sampling without additional information. Analog anti-alias filtering and a bandwidth assumption are therefore part of the measurement. [pf-sampling](../FORMULA_NOTEBOOK.md#pf-sampling), [Shannon's original communication paper](https://ieeexplore.ieee.org/abstract/document/1697831/authors).

The discrete Fourier transform maps N samples to N coefficients. Its spacing fₛ/N follows from record duration. Zero-padding provides denser interpolation of the same finite-record spectrum; it does not create new observation time. Windowing trades sidelobe leakage against effective main-lobe width. A single periodogram is noisy, and averaging changes variance and resolution. [pf-dft](../FORMULA_NOTEBOOK.md#pf-dft), [pf-periodogram](../FORMULA_NOTEBOOK.md#pf-periodogram).

**Worked normalization check.** With an unscaled DFT, a perfectly bin-centered real cosine of amplitude A has two coefficients of magnitude NA/2. Dividing each magnitude by N yields A/2 in the two-sided amplitude spectrum. A one-sided convention combines the symmetric pair to report A, except at DC and a possible Nyquist bin. Squared amplitudes must be converted using the appropriate power-density normalization; they cannot simply inherit every amplitude convention. The formula catalogue states one coherent two-sided PSD definition.

Spectral uncertainty is not one number. Finite record length, window shape, sample-clock error, noise statistics, missing samples and model mismatch all contribute. A narrow-looking plot is not sufficient evidence of a stable oscillator or two resolvable tones. For clock work, Allan deviation compares adjacent averaged fractional frequencies across an averaging timescale. It cancels constant bias, so a biased clock can have excellent stability. [pf-allan](../FORMULA_NOTEBOOK.md#pf-allan), [NIST Handbook of Frequency Stability Analysis](https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication1065.pdf).

## 6. Waves couple space to time

The simplest wave equation balances inertia against a spatial restoring operator. A plane-wave substitution defines a dispersion relation ω(k). Phase velocity ω/k describes moving phase fronts; group velocity dω/dk describes a narrow envelope under suitable conditions. In strongly dispersive or absorptive systems, that envelope can reshape, so a group-velocity number is not automatically signal or energy speed. [pf-wave](../FORMULA_NOTEBOOK.md#pf-wave), [pf-dispersion](../FORMULA_NOTEBOOK.md#pf-dispersion), [Feynman, Beats](https://www.feynmanlectures.caltech.edu/I_48.html).

Two nearby sinusoidal frequencies factor into a carrier and a signed envelope. Two tones at 440 and 442 Hz produce two amplitude maxima per second. The signed envelope cosine has half the difference frequency but flips carrier phase, making its absolute amplitude repeat at the full difference. This resolves a common factor-of-two ambiguity. In a strictly linear spectral decomposition, the low beat rate is a property of the envelope, not a newly generated low-frequency carrier with independent energy.

At one fixed temporal frequency the wave equation becomes a Helmholtz boundary problem. Fixed strings, membranes and cavities select spatial eigenfunctions. A rectangular membrane adds squared wavenumbers in two directions, producing frequencies that generally are not integer multiples of one fundamental. A bending plate involves a fourth-order spatial operator, so its spectrum cannot be obtained by reusing a membrane formula without justification. [pf-membrane](../FORMULA_NOTEBOOK.md#pf-membrane), [Feynman, Modes](https://www.feynmanlectures.caltech.edu/I_49.html).

In acoustics, plane-wave pressure and particle velocity are related by specific impedance ρc. Interface continuity yields reflection and transmission. A transmitted pressure amplitude can exceed the incident amplitude while transmitted power remains below incident power because the impedances differ. This is a practical example of why amplitude and energy must not be conflated. [pf-acoustic](../FORMULA_NOTEBOOK.md#pf-acoustic), [Feynman, Sound and the Wave Equation](https://www.feynmanlectures.caltech.edu/I_47.html).

## 7. Quantum frequency and current devices

Quantizing a harmonic mode yields discrete energies ℏω(n+½). The energy spacing is hf, but the total energy depends on occupation. For thermal equilibrium the mean occupation is Bose distributed; a low-frequency mode can have many thermal quanta even at temperatures that sound cold in everyday language. Coherent control requires adequate preparation, coupling, isolation and measurement. [pf-quantum-oscillator](../FORMULA_NOTEBOOK.md#pf-quantum-oscillator).

The [2025 acoustic-phonon phase-gate preprint](https://arxiv.org/html/2503.03898v1) demonstrates phase control and number-resolving detection in a circuit-coupled acoustic setting. Its reported 98.1% noise-floor-limited interference visibility is not automatically a logical gate fidelity; measurement correction and conditioning matter. The result connects mode dynamics to quantum information while leaving scalability and complete error budgets as distinct questions.

The [2026 thorium-229 nuclear clock paper](https://www.nature.com/articles/s41586-026-11084-4) reports feedback-loop operation on a nuclear optical transition. The source was inspected through indexed publisher abstract/method excerpts. The achievement concerns a controlled frequency reference; it does not, by its title alone, establish the best accuracy, stability or reproducibility across all clock technologies. Those metrics need separate numerical evidence and uncertainty budgets.

## 8. Metamaterials, topology and exceptional points

Engineered periodic or subwavelength structures modify effective wave response. Band gaps, interface states, loss and symmetry can be designed, but effective models have bandwidth and homogenization limits. The [September 2026 acoustic Jackiw–Rebbi-interface paper](https://www.nature.com/articles/s41467-026-77579-w) supplies a specific experimental/model example. The [October 2026 absorbing-exceptional-point paper](https://www.nature.com/articles/s41467-026-78506-9) studies coherent absorption under controlled illumination. Directional intensity or absorption is not energy creation.

An elementary non-Hermitian 2×2 model makes an exceptional point concrete. At a nonzero parameter combination, two eigenvalues and their eigenvectors coalesce. A zero matrix with two equal eigenvalues does not qualify because it still has a complete eigenbasis. Spectral sensitivity near a degeneracy does not automatically improve measurement signal-to-noise after noise, loss and coupling are accounted for. [pf-exceptional](../FORMULA_NOTEBOOK.md#pf-exceptional).

## 9. The exact graph bridge

For a symmetric nonnegative weighted graph, **L**=**D**−**W** satisfies

$$\mathbf x^T\mathbf L\mathbf x=\frac12\sum_{ij}w_{ij}(x_i-x_j)^2\ge0.$$

This is an exact algebraic identity. Its eigenvectors describe smooth and rapidly varying node signals relative to the chosen edges. If the time law is diffusion, each nonconstant component decays. If the time law is an inertial spring model, it oscillates. The operator alone does not choose between those dynamics and has no intrinsic SI frequency. [pf-graph-energy](../FORMULA_NOTEBOOK.md#pf-graph-energy).

Graph wavelets apply spectral kernels to localized node indicators. Their scale parameter is a graph spectral scale, not a biological rhythm. Polynomial approximations make sparse filtering possible without full diagonalization. [pf-graph-wavelet](../FORMULA_NOTEBOOK.md#pf-graph-wavelet), [Hammond, Vandergheynst and Gribonval](https://arxiv.org/abs/0912.3848).

For a knowledge system, this can help find neighborhoods, multiscale context or smooth signals over a deliberately constructed affinity graph. Semantic edges such as “contradicts,” “supersedes” and “is an analogy for” cannot all be treated as attractive physical couplings. The memory implementation must preserve those meanings, even if a force-directed visualization places their nodes close together.
