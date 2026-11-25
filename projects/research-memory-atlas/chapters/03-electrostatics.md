# Electrostatics: sources, constraints, computation and learned long-range structure

## What this chapter establishes

Electrostatics starts with a source and ends with a boundary-value problem. Charge alone does not determine a unique numerical potential until the domain, material law, boundary conditions and reference convention are stated. That organizing idea scales from a pair of charges to dielectrics, biological continuum models and machine-learned atomistic potentials. The accompanying catalogue provides individual records with SI variables, derivation sketches, checked examples and failure conditions; this chapter connects those records into a working method. Foundational reference: [Feynman, Electrostatics](https://www.feynmanlectures.caltech.edu/II_04.html).

The concept graph uses four-part paths such as `electrostatics → Boundary-value theory → Elliptic equations → Poisson equation` and `electrostatics → Computation and frontier → Learned long-range models → Latent electrostatics`. Four levels are a navigational choice, not a claim that physics has a unique canonical hierarchy. The full list is in `nodes.json`; `prerequisite_of` points from the earlier concept toward the later one.

## 1. From force to potential

For a stationary charge in homogeneous vacuum, the Coulomb field is radial and falls as inverse distance squared. Superposition allows a finite set of charges to become a volume, surface or line integral. Always match the source measure to its units: volume density is C/m³, surface density C/m² and line density C/m. Substituting one into the wrong measure can produce a plausible diagram and an incorrect dimension. See [pf-coulomb](../FORMULA_NOTEBOOK.md#pf-coulomb) and [pf-charge-integral](../FORMULA_NOTEBOOK.md#pf-charge-integral).

The electrostatic force does conservative work, so introduce a scalar potential with **E** = −∇φ. A volt is a joule per coulomb. Field is a spatial derivative of potential and therefore has units V/m; multiplying a field by a distance estimates a voltage only when the field and path are sufficiently controlled. An equipotential curve is orthogonal to the field where both are smooth. A constant potential shift changes no force. These distinctions prevent a common conceptual collapse in which charge, voltage, field intensity and stored energy are treated as interchangeable. [Potential construction](https://www.feynmanlectures.caltech.edu/II_06.html), [pf-potential-gradient](../FORMULA_NOTEBOOK.md#pf-potential-gradient).

**Worked spherical calculation.** A total charge Q spread uniformly through a sphere of radius R has density 3Q/(4πR³). A Gaussian sphere at r<R encloses Qr³/R³, giving E(r)=Qr/(4πεR³). Outside, E(r)=Q/(4πεr²). Integrating inward from φ(∞)=0 gives

$$
\phi(r)=\begin{cases}
\dfrac{Q}{8\pi\varepsilon R}\left(3-\dfrac{r^2}{R^2}\right),&r<R,\\
\dfrac{Q}{4\pi\varepsilon r},&r\ge R.
\end{cases}
$$

The field vanishes at the center, but the potential reaches a finite maximum there for Q>0. Differentiating the interior expression gives ∇²φ=−3Q/(4πεR³)=−ρ/ε. Potential and normal field are continuous because there is no separate surface sheet. For a conducting sphere with the same charge, by contrast, charge resides on the surface and the interior potential is constant. Identical total charge does not imply identical interior physics. This calculation synthesizes [Gauss-law foundations](https://www.feynmanlectures.caltech.edu/II_04.html) and [boundary methods](https://www.feynmanlectures.caltech.edu/II_07.html).

## 2. Why boundaries belong in the theorem

Gauss's law gives ∇·**E**=ρ/ε. Combining it with **E**=−∇φ yields Poisson's equation; setting the source to zero gives Laplace's equation. Specifying values of φ on a closed boundary is a Dirichlet problem. Specifying its normal derivative is a Neumann problem. A pure Neumann problem needs compatibility between total source and boundary flux and leaves an arbitrary additive constant. Mixed boundaries need their own existence and uniqueness conditions. [pf-gauss](../FORMULA_NOTEBOOK.md#pf-gauss), [pf-poisson](../FORMULA_NOTEBOOK.md#pf-poisson), [Feynman boundary analysis](https://www.feynmanlectures.caltech.edu/II_07.html).

The uniqueness proof is an especially useful reusable pattern. Suppose two solutions have identical charge and Dirichlet boundary data. Their difference u is harmonic and vanishes at the boundary. Multiply ∇²u=0 by u and integrate by parts:

$$
0=\int_\Omega u\nabla^2u\,dV
=\int_{\partial\Omega}u\partial_nu\,dA-\int_\Omega|\nabla u|^2dV.
$$

The boundary term is zero; the integral of a nonnegative quantity must vanish, so u is constant, then zero. This is more powerful than a picture of field lines: any candidate solution satisfying the equation and prescribed boundary is the solution in that domain. [pf-dirichlet-uniqueness](../FORMULA_NOTEBOOK.md#pf-dirichlet-uniqueness).

**Image-charge example.** A charge q at height a above a grounded plane has the same upper-half-space potential as q together with a fictitious −q reflected beneath the plane. The construction is valid because the potential vanishes on the plane and the real-domain source is correct; uniqueness supplies the proof. The attraction is q²/(16πεa²). The physical induced surface charge is not a literal point charge beneath the conductor. The assembly energy is −q²/(16πεa), carrying a half-factor relative to q times the induced potential because the induced distribution changes during assembly. [pf-image-plane](../FORMULA_NOTEBOOK.md#pf-image-plane), [energy discussion](https://www.feynmanlectures.caltech.edu/II_08.html).

A Green function is an impulse response for the spatial operator **and its boundary conditions**. It is not just the free-space inverse distance kernel reused everywhere. A multipole expansion is instead a controlled far-field representation: the monopole summarizes total charge, the dipole summarizes its first moment, and higher moments resolve finer angular structure. A zero monopole does not mean zero field. The truncation is useful only when the observation distance exceeds the source extent sufficiently for the needed accuracy. [pf-green](../FORMULA_NOTEBOOK.md#pf-green), [pf-multipoles](../FORMULA_NOTEBOOK.md#pf-multipoles), [potential methods](https://www.feynmanlectures.caltech.edu/II_06.html).

## 3. Matter changes the closure

Polarization **P** records a coarse-grained dipole density. Its divergence gives bound volume charge and its normal component gives bound surface charge. Defining **D**=ε₀**E**+**P** lets Gauss's law count free charge, but **D** is not an independent substitute for a material law. A linear isotropic dielectric uses **P**=ε₀χₑ**E**; an anisotropic medium needs a tensor. Hysteresis, nonlinear response, dispersion and microscopic interfaces can invalidate that simple closure. [Feynman, Dielectrics](https://www.feynmanlectures.caltech.edu/II_10.html), [pf-polarization](../FORMULA_NOTEBOOK.md#pf-polarization).

At an ordinary electrostatic interface, tangential **E** is continuous, while the jump in normal **D** equals free surface charge. A jump in permittivity therefore changes the normal field even without free interface charge. In numerical work, flux continuity should be built into the discretization. Treating every interface point as if ε were a globally constant scalar can violate the governing conservation law. [pf-interface](../FORMULA_NOTEBOOK.md#pf-interface).

The energy formula U=½∫**E**·**D** dV belongs to a linear, nondispersive, quasistatically assembled material model. For a nonlinear reversible material, the charging integral ∫**E**·d**D** is the relevant starting point. For irreversible media, a state function may not account for all losses. Capacitance is a geometry-and-material relation between conductor charges and potentials; multi-conductor systems naturally have a capacitance matrix rather than a single scalar. [pf-field-energy](../FORMULA_NOTEBOOK.md#pf-field-energy), [pf-capacitance](../FORMULA_NOTEBOOK.md#pf-capacitance), [electrostatic energy](https://www.feynmanlectures.caltech.edu/II_08.html).

## 4. Screening is a model of responsive particles

Debye screening comes from mobile charges responding thermally to potential. Write species densities as nₛ=nₛ₀ exp(−qₛφ/kBT), insert them into Poisson's equation, then linearize only when |qₛφ|≪kBT. The neutral reference cancels the constant source term; the first-order term produces a positive inverse screening length squared. The resulting screened potential is proportional to exp(−r/λD)/r. Without the small-potential condition, the nonlinear Poisson–Boltzmann problem must be treated directly. [pf-debye](../FORMULA_NOTEBOOK.md#pf-debye), [pf-pb](../FORMULA_NOTEBOOK.md#pf-pb).

This continuum picture neglects some correlations, ion-size effects, chemical specificity and atomic solvent structure. It can still be useful when those omissions are controlled against the observable of interest. The question is not whether the numerical residual is small alone; it is whether the continuum approximation, interface geometry, boundary placement and charge parameterization are adequate. The [pyDelPhi paper](https://pubs.acs.org/doi/10.1021/acs.jcim.5c02818) and [neural Poisson–Boltzmann paper](https://www.sciencedirect.com/science/article/pii/S0021999125007284), both published online in 2025 with 2026 journal issues, are selected implementation frontiers. An author-hosted pyDelPhi PDF was sampled; the neural paper was inspected through indexed publisher and author-affiliated abstracts. Performance rankings and independent benchmark replication are not claimed. The classical screening derivation is cross-checked against [Goldstein and Keyser, section 2.3](https://www.damtp.cam.ac.uk/user/gold/pdfs/teaching/Handout_SMB_131125.pdf).

## 5. Numerical operators, compression and invalidation

The five-point finite-difference stencil is a local comparison operator. Taylor expansion gives a leading second-order spatial truncation error for a smooth solution on a uniform grid. A small linear-system residual proves that the discretized equations were solved accurately; it does not prove the continuum solution is accurate. Refine the mesh, move the outer boundary and test interfaces separately. The exact polynomial φ=x²+y² is a useful implementation check because the stencil returns its Laplacian exactly, yet that one check is not a convergence theorem. [pf-fd-poisson](../FORMULA_NOTEBOOK.md#pf-fd-poisson).

The finite-element weak form moves derivatives from the solution onto a test function through integration by parts. This permits a broader function space, accommodates geometry and gives an energy interpretation. Boundary-element methods instead exploit a suitable Green kernel to move unknowns to boundaries; they may reduce dimensionality but produce dense interactions unless compressed. Multipole methods compress well-separated interactions hierarchically. The original [Greengard–Rokhlin paper](https://www.sciencedirect.com/science/article/pii/0021999187901409) supplies primary provenance for fast many-particle evaluation; this atlas does not reproduce its timings. [pf-weak-form](../FORMULA_NOTEBOOK.md#pf-weak-form).

Ewald methods split a periodic long-range sum into rapidly convergent real- and reciprocal-space contributions plus self/boundary corrections. Charge neutrality and the chosen periodic boundary convention are part of the problem. A local update can have a global electrostatic effect. Consequently, a computational cache must track the dependencies of compressed summaries, reciprocal grids or charge-equilibration states; “only one atom changed” does not guarantee only its nearest-neighbor result changed. Historical provenance: [Ewald, 1921](https://onlinelibrary.wiley.com/doi/10.1002/andp.19213690304); modern author discussion: [Kim and Cheng, 2025/2026](https://arxiv.org/html/2512.18029v1).

## 6. Selected frontier: learned charges and physical inductive structure

The [Latent Ewald Summation research paper](https://www.nature.com/articles/s41467-025-63852-x) and [author perspective](https://arxiv.org/html/2512.18029v1) combine learned local features with long-range electrostatic structure. The central modeling distinction is between a latent quantity useful for energy/force prediction and a unique physically measurable atomic charge. The latter is not guaranteed. Global charge redistribution, dielectric heterogeneity and distributed computation remain explicit limitations. Abstract or author-selected results support a method description, not a universal superiority claim.

Charge equilibration makes that global dependence concrete. Minimize a quadratic energy subject to total charge; the Lagrange multiplier produces a coupled saddle-point linear system. A change in one environment can alter charges throughout the model. For software memory, the useful transfer is a dependency rule: derived cached quantities must be keyed by all effective inputs, including global constraints and parameter versions. That is a design lesson from a mathematical structure, not a claim that a repository stores Coulomb fields. [pf-qeq](../FORMULA_NOTEBOOK.md#pf-qeq), [Rappé and Goddard, 1991](https://pubs.acs.org/doi/10.1021/j100161a070).

## Questions that test understanding

1. Why does the same total charge produce different fields inside a uniformly charged sphere and a conducting shell?
2. Which exact boundary condition makes a proposed image solution valid, and in what domain?
3. How can a nearly zero solver residual coexist with a materially wrong electrostatic energy?
4. Which cache dependencies become global when a total-charge constraint is introduced?
5. What observation would distinguish an adequate continuum dielectric model from a merely well-converged numerical solution?

Complete answers should name the assumptions before manipulating formulas. The linked formula cards provide the necessary steps; the coverage ledger identifies deeper topics still awaiting dedicated source review.
