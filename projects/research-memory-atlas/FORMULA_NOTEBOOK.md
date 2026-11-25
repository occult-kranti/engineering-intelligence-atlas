# Formula notebook

> Every equation has a domain, assumptions, source references, and a worked check. A formula is not a license to ignore its validity conditions.

## electrostatics

<a id="pf-coulomb"></a>

### Coulomb force between point charges

$$
\mathbf F_{1\leftarrow2}=\frac{q_1q_2}{4\pi\varepsilon_0}\frac{\mathbf r_1-\mathbf r_2}{|\mathbf r_1-\mathbf r_2|^3}
$$

**ID:** `pf-coulomb`

| Symbol | Meaning | Unit |
|---|---|---|
| F | force on charge 1 | N |
| q_1,q_2 | signed charges | C |
| r_1,r_2 | positions | m |
| epsilon_0 | vacuum permittivity | F/m |

**Assumptions**

- Static point charges in vacuum; positions are distinct.
- External forces may be required to hold the charges fixed.

**Derivation.** Rotational symmetry makes the field radial. Integrating Gauss flux over a sphere gives E times 4 pi r squared equal to q/epsilon_0. Multiplication by a second test charge gives the vector force; the signed product determines attraction or repulsion.

**Worked check.** Two charges of +1 nC separated by 0.10 m repel with approximately 8.99e-7 N. Doubling the separation reduces this by four, while reversing one charge reverses the direction.

**Limits and common mistakes**

- Point-charge self-energy diverges in the classical continuum model.
- Moving sources require retardation and magnetic terms; inserting a scalar dielectric constant is not valid for every interface.

**Sources:** [The Feynman Lectures on Physics: Electrostatics](https://www.feynmanlectures.caltech.edu/II_04.html); [NIST CODATA fundamental physical constants (2022 adjustment)](https://physics.nist.gov/cuu/Constants/)

<a id="pf-charge-integral"></a>

### Field of a continuous charge distribution

$$
\mathbf E(\mathbf r)=\frac{1}{4\pi\varepsilon_0}\int \rho(\mathbf r')\frac{\mathbf r-\mathbf r'}{|\mathbf r-\mathbf r'|^3}\,d^3r'
$$

**ID:** `pf-charge-integral`

| Symbol | Meaning | Unit |
|---|---|---|
| E | electric field | V/m |
| rho | volume charge density | C/m^3 |
| r,r' | observation/source positions | m |
| epsilon_0 | vacuum permittivity | F/m |

**Assumptions**

- Known static source distribution in unbounded vacuum with suitable convergence.
- Surface and line sources require their corresponding measures.

**Derivation.** Partition the source into small cells carrying dq=rho dV. Add their Coulomb fields and take the continuum limit. Differentiation under the integral is justified away from singular source points and under appropriate integrability conditions.

**Worked check.** A uniformly charged sphere has the same exterior field as a point charge at its center. Inside, enclosed charge scales as r cubed, so its radial field scales as r rather than r to the minus two.

**Limits and common mistakes**

- Do not integrate a volume density against an area measure.
- Known-charge superposition does not remove the need to solve induced charges self-consistently.

**Sources:** [The Feynman Lectures on Physics: Electrostatics](https://www.feynmanlectures.caltech.edu/II_04.html); [The Feynman Lectures on Physics: The Electric Field in Various Circumstances](https://www.feynmanlectures.caltech.edu/II_06.html)

<a id="pf-potential-gradient"></a>

### Potential difference and field

$$
\phi(b)-\phi(a)=-\int_a^b\mathbf E\cdot d\mathbf l,\qquad \mathbf E=-\nabla\phi
$$

**ID:** `pf-potential-gradient`

| Symbol | Meaning | Unit |
|---|---|---|
| phi | electric potential | V |
| E | electric field | V/m |
| l | path displacement | m |
| a,b | initial and final spatial points | m in Cartesian coordinates |

**Assumptions**

- Static fields with zero circulation on relevant loops.
- A globally single-valued potential needs suitable topology or explicit cuts.

**Derivation.** Work on a charge is q times the line integral of E. Define potential energy U=q phi so force is minus its gradient. Path independence follows from curl-free E in a simply connected region; local curl-free conditions alone do not settle every global topological question.

**Worked check.** Between plates at 0 V and 12 V separated by 3 mm, a uniform field has magnitude 4000 V/m and points from the higher potential plate toward the lower one.

**Limits and common mistakes**

- Potential is not field strength.
- Time-dependent induction makes the electric field include -partial A/partial t and generally prevents a purely scalar global description.

**Sources:** [The Feynman Lectures on Physics: The Electric Field in Various Circumstances](https://www.feynmanlectures.caltech.edu/II_06.html); [The Feynman Lectures on Physics: The Laws of Induction](https://www.feynmanlectures.caltech.edu/II_17.html)

<a id="pf-gauss"></a>

### Gauss law, integral and differential

$$
\oint_{\partial V}\mathbf E\cdot\mathbf n\,dA=\frac{Q_V}{\varepsilon_0},\qquad \nabla\cdot\mathbf E=\frac{\rho}{\varepsilon_0}
$$

**ID:** `pf-gauss`

| Symbol | Meaning | Unit |
|---|---|---|
| E | electric field | V/m |
| n | outward unit normal | 1 |
| A | area | m^2 |
| Q_V | enclosed total charge | C |
| rho | charge density | C/m^3 |
| epsilon_0 | vacuum permittivity | F/m |
| V, partial V | enclosed spatial region and its oriented boundary | region with volume measure m^3 |

**Assumptions**

- Classical vacuum Maxwell law, interpreted distributionally for idealized charges.

**Derivation.** Apply the divergence theorem to the differential law over any volume. Conversely, if the flux identity holds for every sufficiently small volume, its local density relation follows. The law does not require symmetry, but symmetry is what allows a scalar field magnitude to be pulled outside a surface integral.

**Worked check.** For a long line charge lambda, a cylindrical Gaussian surface gives E(2 pi r L)=lambda L/epsilon_0 and E=lambda/(2 pi epsilon_0 r). End effects are excluded by the infinite-line approximation.

**Limits and common mistakes**

- Zero net flux does not imply zero field.
- A Gaussian surface may enclose zero net charge despite strong dipole fields crossing it.

**Sources:** [The Feynman Lectures on Physics: Electrostatics](https://www.feynmanlectures.caltech.edu/II_04.html)

<a id="pf-poisson"></a>

### Poisson and Laplace equations

$$
-\nabla\cdot(\varepsilon\nabla\phi)=\rho_f;\qquad \nabla^2\phi=-\rho/\varepsilon_0\ \text{in vacuum}
$$

**ID:** `pf-poisson`

| Symbol | Meaning | Unit |
|---|---|---|
| phi | potential | V |
| epsilon | local scalar permittivity | F/m |
| rho_f | free charge density | C/m^3 |
| rho | total vacuum-source density | C/m^3 |
| epsilon_0 | vacuum permittivity | F/m |

**Assumptions**

- Electrostatics with a local linear constitutive law D=epsilon E.
- Boundary data and interface jump conditions are part of the problem.

**Derivation.** Substitute E=-grad phi into div D=rho_f. If epsilon is constant it leaves the derivative; if epsilon varies it must remain inside. Laplace's equation is the charge-free constant-permittivity special case, not a general replacement for all dielectric problems.

**Worked check.** In a one-dimensional interval with constant rho, phi''=-rho/epsilon and phi is quadratic. With zero rho and endpoint values 0 and V0, phi=V0 x/L is linear.

**Limits and common mistakes**

- Dropping gradients of epsilon at an interface changes the physical boundary problem.
- Pure Neumann boundary data require a compatibility condition and a reference potential.

**Sources:** [The Feynman Lectures on Physics: The Electric Field in Various Circumstances](https://www.feynmanlectures.caltech.edu/II_06.html); [The Feynman Lectures on Physics: Dielectrics](https://www.feynmanlectures.caltech.edu/II_10.html)

<a id="pf-dirichlet-uniqueness"></a>

### Energy proof of Dirichlet uniqueness

$$
\int_\Omega\varepsilon|\nabla u|^2\,dV=0\ \Longrightarrow\ u=0,\quad u=\phi_1-\phi_2,\ u|_{\partial\Omega}=0
$$

**ID:** `pf-dirichlet-uniqueness`

| Symbol | Meaning | Unit |
|---|---|---|
| u | difference of candidate potentials | V |
| epsilon | positive permittivity | F/m |
| Omega | connected domain | m^3 |
| phi_1,phi_2 | candidate potentials with identical Dirichlet data | V |
| dV | spatial volume measure | m^3 |

**Assumptions**

- Both solutions satisfy the same charge equation and Dirichlet boundary data.
- Permittivity is positive and fields have sufficient weak regularity.

**Derivation.** Subtract the equations, multiply -div(epsilon grad u)=0 by u and integrate. Integration by parts leaves a nonnegative gradient integral because u vanishes on the boundary. Therefore grad u is zero almost everywhere; connectedness and zero boundary value remove the constant.

**Worked check.** Once an image-charge construction meets the grounded-plane boundary and the prescribed source singularity, uniqueness identifies it with the physical solution in the upper half-space.

**Limits and common mistakes**

- The proof changes for Neumann conditions, where a constant remains.
- Negative, complex or nonlinear constitutive response can invalidate this particular coercive-energy argument.

**Sources:** [The Feynman Lectures on Physics: The Electric Field in Various Circumstances (Continued)](https://www.feynmanlectures.caltech.edu/II_07.html)

<a id="pf-image-plane"></a>

### Point charge over a grounded plane

$$
\phi(\rho,z)=\frac{q}{4\pi\varepsilon_0}\left[\frac{1}{\sqrt{\rho^2+(z-a)^2}}-\frac{1}{\sqrt{\rho^2+(z+a)^2}}\right],\ z>0
$$

**ID:** `pf-image-plane`

| Symbol | Meaning | Unit |
|---|---|---|
| q | physical charge | C |
| rho | cylindrical radial coordinate | m |
| z | height above plane | m |
| a | charge height | m |
| epsilon_0 | vacuum permittivity | F/m |
| phi | potential | V |

**Assumptions**

- Infinite ideal grounded plane z=0; physical charge at z=a>0; vacuum above.

**Derivation.** Place an auxiliary charge -q at z=-a. Equal distances on z=0 cancel the two potentials. The resulting function has the required source and boundary behavior; uniqueness establishes its physical validity only in z>0.

**Worked check.** The physical charge feels the image's field at separation 2a, giving downward force q squared/(16 pi epsilon_0 a squared). The actual induced charge is distributed on the plane, not concentrated at the image location.

**Limits and common mistakes**

- Using q times the entire induced potential as the assembly energy misses a factor 1/2.
- The image solution cannot be interpreted as physical charges inside the conductor.

**Sources:** [The Feynman Lectures on Physics: The Electric Field in Various Circumstances](https://www.feynmanlectures.caltech.edu/II_06.html); [The Feynman Lectures on Physics: Electrostatic Energy](https://www.feynmanlectures.caltech.edu/II_08.html)

<a id="pf-green"></a>

### Dirichlet Green-function solution

$$
-\nabla^2 G(\mathbf r,\mathbf r')=\delta(\mathbf r-\mathbf r'),\quad \phi(\mathbf r)=\varepsilon_0^{-1}\int_\Omega G\rho\,dV'\quad(\phi|_{\partial\Omega}=0)
$$

**ID:** `pf-green`

| Symbol | Meaning | Unit |
|---|---|---|
| G | Dirichlet Green kernel | 1/m |
| delta | three-dimensional delta distribution | 1/m^3 |
| rho | charge density | C/m^3 |
| phi | potential | V |
| epsilon_0 | vacuum permittivity | F/m |
| r,r_prime | observation and source positions | m |
| Omega | spatial domain of the Green problem | region with volume measure m^3 |
| dV_prime | source volume element | m^3 |

**Assumptions**

- Constant vacuum permittivity and grounded Dirichlet boundary.
- For nonzero boundary values, a boundary term or harmonic extension must be added.

**Derivation.** Invert the linear operator using its response to a unit delta source. In free three-dimensional space G=1/(4 pi distance), fixed by integrating its radial gradient over a small sphere. A bounded domain needs a Green function that also vanishes on its boundary.

**Worked check.** For a point source rho=q delta(r'-r0), the volume integral reduces to q G(r,r0)/epsilon_0, reproducing Coulomb plus any boundary correction.

**Limits and common mistakes**

- A kernel is an operator inverse with boundary and nullspace choices, not a universal similarity function.
- Singular integrals need specialized quadrature or analytic treatment.

**Sources:** [The Feynman Lectures on Physics: The Electric Field in Various Circumstances](https://www.feynmanlectures.caltech.edu/II_06.html); [The Feynman Lectures on Physics: The Electric Field in Various Circumstances (Continued)](https://www.feynmanlectures.caltech.edu/II_07.html)

<a id="pf-multipoles"></a>

### Monopole and dipole far field

$$
\phi(\mathbf r)=\frac{1}{4\pi\varepsilon_0}\left(\frac{Q}{r}+\frac{\mathbf p\cdot\hat{\mathbf r}}{r^2}+O(r^{-3})\right),\qquad \mathbf p=\int\rho(\mathbf r')\mathbf r'\,dV'
$$

**ID:** `pf-multipoles`

| Symbol | Meaning | Unit |
|---|---|---|
| phi | potential | V |
| Q | total charge | C |
| p | electric dipole moment | C m |
| r | distance from expansion origin | m |
| rho | charge density | C/m^3 |
| epsilon_0 | vacuum permittivity | F/m |
| r_prime | source coordinate relative to the chosen expansion origin | m |
| hat_r | unit observation direction | 1 |
| dV_prime | source volume element | m^3 |

**Assumptions**

- Localized distribution of extent a with observation distance r much larger than a.

**Derivation.** Taylor-expand 1/|r-r'| in the small ratio |r'|/r. Integrating the first term collects total charge; the linear term collects the first moment. Higher angular moments successively improve the approximation but require their own error control.

**Worked check.** For charges +q and -q at separation d, Q=0 and p=q d along the negative-to-positive axis. Potential then decays as 1/r squared and electric field as 1/r cubed.

**Limits and common mistakes**

- A neutral distribution's dipole is origin independent; a charged distribution's dipole generally is not.
- Near-field use without an error estimate can be poor.

**Sources:** [The Feynman Lectures on Physics: The Electric Field in Various Circumstances](https://www.feynmanlectures.caltech.edu/II_06.html)

<a id="pf-capacitance"></a>

### Capacitor response and energy

$$
C=Q/V,\qquad C_{\mathrm{plates}}=\varepsilon A/d,\qquad U=\tfrac12 CV^2=Q^2/(2C)
$$

**ID:** `pf-capacitance`

| Symbol | Meaning | Unit |
|---|---|---|
| C | capacitance | F |
| Q | plate charge magnitude | C |
| V | potential difference | V |
| epsilon | permittivity | F/m |
| A | plate area | m^2 |
| d | spacing | m |
| U | stored field energy | J |

**Assumptions**

- Linear dielectric response; parallel plates have d small relative to lateral size.
- Energy is quasistatic and reversible in the ideal model.

**Derivation.** Gauss gives E=Q/(epsilon A); integrating across the gap gives V=Ed and C=epsilon A/d. Charging from zero requires integral V(q)dq, yielding Q squared/(2C). Fixed-charge and fixed-voltage mechanical variations involve different source-work accounting.

**Worked check.** A 1 microfarad capacitor at 10 V stores 50 microjoules. Halving d at fixed Q halves the energy; at fixed V it doubles stored energy because the source supplies additional charge and work.

**Limits and common mistakes**

- A battery-connected force calculation must include battery work.
- Fringing, dispersion, breakdown and dielectric loss are omitted.

**Sources:** [The Feynman Lectures on Physics: Dielectrics](https://www.feynmanlectures.caltech.edu/II_10.html); [The Feynman Lectures on Physics: Electrostatic Energy](https://www.feynmanlectures.caltech.edu/II_08.html)

<a id="pf-field-energy"></a>

### Electrostatic field energy

$$
U=\tfrac12\int\rho\phi\,dV=\tfrac12\int\varepsilon_0|\mathbf E|^2\,dV
$$

**ID:** `pf-field-energy`

| Symbol | Meaning | Unit |
|---|---|---|
| U | energy | J |
| rho | charge density | C/m^3 |
| phi | potential | V |
| E | electric field | V/m |
| epsilon_0 | vacuum permittivity | F/m |
| dV | spatial volume element | m^3 |

**Assumptions**

- Smooth or properly regularized static sources in vacuum.
- Boundary term at infinity vanishes or is explicitly accounted for.

**Derivation.** The factor 1/2 counts each pair interaction once. Substitute rho=-epsilon_0 Laplacian phi and integrate by parts; the volume term becomes epsilon_0 times gradient phi squared. Surface terms encode boundary-source work and cannot be ignored without a decay/boundary argument.

**Worked check.** For a sphere of radius a holding charge on its surface, the exterior integral gives U=q squared/(8 pi epsilon_0 a). Sending a to zero exposes the classical self-energy divergence.

**Limits and common mistakes**

- Pair interaction energy may be negative even though full field energy is nonnegative after including self-energies.
- In nonlinear/dispersive matter, 1/2 E dot D is not a universally complete energy expression.

**Sources:** [The Feynman Lectures on Physics: Electrostatic Energy](https://www.feynmanlectures.caltech.edu/II_08.html)

<a id="pf-polarization"></a>

### Bound charge and displacement

$$
\rho_b=-\nabla\cdot\mathbf P,\quad \sigma_b=\mathbf P\cdot\mathbf n,\quad \mathbf D=\varepsilon_0\mathbf E+\mathbf P,\quad \nabla\cdot\mathbf D=\rho_f
$$

**ID:** `pf-polarization`

| Symbol | Meaning | Unit |
|---|---|---|
| P | polarization | C/m^2 |
| rho_b,rho_f | bound/free volume densities | C/m^3 |
| sigma_b | bound surface charge | C/m^2 |
| D | electric displacement | C/m^2 |
| E | electric field | V/m |
| epsilon_0 | vacuum permittivity | F/m |
| n | outward normal | 1 |

**Assumptions**

- Continuum coarse graining over microscopic dipoles; P is defined inside material.

**Derivation.** A spatially uniform dipole distribution cancels in the bulk but leaves surface poles. Unequal dipole density leaves bulk charge proportional to minus divergence. Combining free and bound charge in Gauss's law and rearranging defines D.

**Worked check.** A uniformly polarized slab with P normal to the faces has zero bulk bound charge and equal/opposite surface charges. Their field opposes P inside the slab.

**Limits and common mistakes**

- D is not a second independent force field.
- The division into free and bound charge depends on the material description and must be stated consistently.

**Sources:** [The Feynman Lectures on Physics: Dielectrics](https://www.feynmanlectures.caltech.edu/II_10.html)

<a id="pf-interface"></a>

### Electrostatic interface jumps

$$
\mathbf n\cdot(\mathbf D_2-\mathbf D_1)=\sigma_f,\qquad \mathbf n\times(\mathbf E_2-\mathbf E_1)=0
$$

**ID:** `pf-interface`

| Symbol | Meaning | Unit |
|---|---|---|
| D_1,D_2 | displacement on two sides | C/m^2 |
| E_1,E_2 | electric fields | V/m |
| sigma_f | free surface charge | C/m^2 |
| n | normal pointing from side 1 to side 2 | 1 |

**Assumptions**

- Stationary interface with no singular time-changing magnetic flux.
- The chosen normal fixes the jump sign.

**Derivation.** Integrate Gauss's law over a thin pillbox crossing the interface; side flux vanishes in the thin limit. Integrate curl-free E around a thin rectangle; the two long tangential sides survive. These equations remain valid even when normal E itself is discontinuous.

**Worked check.** With no free surface charge and scalar epsilon_2=2 epsilon_1, the normal electric field on side 2 is half that on side 1, while their tangential components agree.

**Limits and common mistakes**

- Continuity of normal E is not a universal dielectric boundary condition.
- Singular surface polarization needs careful distributional treatment.

**Sources:** [The Feynman Lectures on Physics: Dielectrics](https://www.feynmanlectures.caltech.edu/II_10.html)

<a id="pf-debye"></a>

### Debye length and screened potential

$$
\lambda_D^{-2}=\sum_s\frac{n_s q_s^2}{\varepsilon k_B T_s},\qquad \phi(r)=\frac{q}{4\pi\varepsilon r}e^{-r/\lambda_D}
$$

**ID:** `pf-debye`

| Symbol | Meaning | Unit |
|---|---|---|
| lambda_D | screening length | m |
| n_s | equilibrium species number density | 1/m^3 |
| q_s,q | species and test charges | C |
| epsilon | permittivity | F/m |
| k_B | Boltzmann constant | J/K |
| T_s | species temperature | K |
| phi | potential | V |
| r | distance | m |

**Assumptions**

- Classical weakly coupled mean-field charges in thermal equilibrium.
- Linearization requires |q_s phi| much smaller than k_B T_s.

**Derivation.** Boltzmann densities vary as n_s exp(-q_s phi/k_B T_s). Expand to first order and use neutral equilibrium to cancel the constant source. Poisson becomes (Laplacian-lambda_D^{-2})phi=-q delta/epsilon, whose radial decaying solution is the screened kernel.

**Worked check.** At r=lambda_D the screened potential is e^{-1} of the bare potential. At very small r relative to lambda_D the asymptotic expression recovers Coulomb behavior, although the weak-potential assumption can then fail.

**Limits and common mistakes**

- Strong correlations, finite ion size and large potentials invalidate elementary Debye–Hückel theory.
- A screening length is not a universal cutoff where all fields vanish.

**Sources:** [Goldstein and Keyser: Soft Matter and Biological Physics, section 2.3](https://www.damtp.cam.ac.uk/user/gold/pdfs/teaching/Handout_SMB_131125.pdf); [Neural network Poisson–Boltzmann electrostatics for biomolecular interactions](https://www.sciencedirect.com/science/article/pii/S0021999125007284)

<a id="pf-pb"></a>

### Nonlinear Poisson–Boltzmann equation

$$
-\nabla\cdot(\varepsilon\nabla\phi)=\rho_{\mathrm{fixed}}+\sum_s q_s n_s^{(0)}\exp[-q_s\phi/(k_BT)]
$$

**ID:** `pf-pb`

| Symbol | Meaning | Unit |
|---|---|---|
| phi | potential | V |
| epsilon | permittivity | F/m |
| rho_fixed | fixed source density | C/m^3 |
| q_s | species charge | C |
| n_s0 | reference number density | 1/m^3 |
| k_B | Boltzmann constant | J/K |
| T | temperature | K |

**Assumptions**

- Mean-field thermal ionic distributions with point-ion idealization and suitable chemical-potential references.

**Derivation.** Couple Poisson electrostatics to equilibrium Boltzmann occupation of each charge species. The potential now determines its own source, producing a nonlinear fixed-point problem. Dielectric boundaries and solvent-exclusion regions require separate domains and jump conditions.

**Worked check.** For symmetric monovalent electrolyte, the mobile charge is -2 e n0 sinh(e phi/k_B T). Linearizing sinh near zero recovers Debye screening with lambda_D squared=epsilon k_B T/(2 n0 e squared).

**Limits and common mistakes**

- A low PDE residual does not certify the selected dielectric model.
- Ion crowding and correlations can require models beyond PB.

**Sources:** [Goldstein and Keyser: Soft Matter and Biological Physics, section 2.3](https://www.damtp.cam.ac.uk/user/gold/pdfs/teaching/Handout_SMB_131125.pdf); [Neural network Poisson–Boltzmann electrostatics for biomolecular interactions](https://www.sciencedirect.com/science/article/pii/S0021999125007284); [Accurate and Scalable Continuum Electrostatics for Large Biomolecular Systems: The pyDelPhi Poisson–Boltzmann Framework](https://pubs.acs.org/doi/10.1021/acs.jcim.5c02818)

<a id="pf-weak-form"></a>

### Variational/finite-element weak form

$$
\int_\Omega \varepsilon\nabla\phi\cdot\nabla v\,dV=\int_\Omega\rho_f v\,dV\quad\forall v|_{\partial\Omega}=0
$$

**ID:** `pf-weak-form`

| Symbol | Meaning | Unit |
|---|---|---|
| phi | solution potential | V |
| v | test potential | V |
| epsilon | permittivity | F/m |
| rho_f | free charge density | C/m^3 |
| Omega | domain | m^3 |
| dV | spatial volume element | m^3 |

**Assumptions**

- Dirichlet boundary conditions; test functions vanish on the boundary.
- A suitable positive permittivity ensures coercivity after nullspace handling.

**Derivation.** Multiply the divergence-form Poisson equation by a test function and integrate by parts. Choose basis functions N_i and write phi=sum phi_i N_i. The matrix K_ij=integral epsilon grad N_i dot grad N_j is sparse when supports overlap locally.

**Worked check.** A one-dimensional mesh with spacing h and constant epsilon produces the familiar tridiagonal second-difference system after the standard assembly and boundary elimination.

**Limits and common mistakes**

- Minimizing an unconstrained graph energy without fixing the constant mode leaves a nullspace.
- Mesh convergence, source regularization and geometry error remain distinct.

**Sources:** [The Feynman Lectures on Physics: The Electric Field in Various Circumstances (Continued)](https://www.feynmanlectures.caltech.edu/II_07.html); [Accurate and Scalable Continuum Electrostatics for Large Biomolecular Systems: The pyDelPhi Poisson–Boltzmann Framework](https://pubs.acs.org/doi/10.1021/acs.jcim.5c02818)

<a id="pf-fd-poisson"></a>

### Five-point finite-difference Laplacian

$$
\frac{\phi_{i+1,j}+\phi_{i-1,j}+\phi_{i,j+1}+\phi_{i,j-1}-4\phi_{i,j}}{h^2}=-\frac{\rho_{i,j}}{\varepsilon}
$$

**ID:** `pf-fd-poisson`

| Symbol | Meaning | Unit |
|---|---|---|
| phi_ij | grid potential | V |
| h | uniform grid spacing | m |
| rho_ij | grid volume density in a translationally invariant model | C/m^3 |
| epsilon | permittivity | F/m |
| i,j | integer grid-point indices | 1 |

**Assumptions**

- Uniform square grid, constant epsilon, smooth solution and a two-coordinate reduction.
- Boundary treatment must preserve the intended physical problem.

**Derivation.** Expand neighboring values in Taylor series. Odd terms cancel between opposite neighbors; the second derivatives survive and fourth derivatives set leading O(h squared) truncation error. The matrix form resembles a graph Laplacian because each row compares a node with adjacent nodes.

**Worked check.** For phi=x squared+y squared the stencil gives exactly 4, equal to the analytic Laplacian at every interior point for any h. That is an exact polynomial check, not a convergence proof for arbitrary geometry.

**Limits and common mistakes**

- Discontinuous coefficients require flux-conserving stencils, not this naive constant-epsilon formula.
- A solver residual can be tiny while discretization error is large.

**Sources:** [The Feynman Lectures on Physics: The Electric Field in Various Circumstances (Continued)](https://www.feynmanlectures.caltech.edu/II_07.html)

<a id="pf-qeq"></a>

### Constrained charge-equilibration system

$$
\min_{\mathbf q}\left(\tfrac12\mathbf q^T H\mathbf q+\boldsymbol\chi^T\mathbf q\right),\quad\mathbf1^T\mathbf q=Q;\quad\begin{bmatrix}H&\mathbf1\\\mathbf1^T&0\end{bmatrix}\begin{bmatrix}\mathbf q\\\eta\end{bmatrix}=\begin{bmatrix}-\boldsymbol\chi\\Q\end{bmatrix}
$$

**ID:** `pf-qeq`

| Symbol | Meaning | Unit |
|---|---|---|
| q | atomic-charge vector | C |
| H | charge-energy Hessian | J/C^2 |
| chi | linear electronegativity-like coefficient | J/C |
| Q | total charge | C |
| eta | constraint multiplier | J/C |
| 1 | vector with every component equal to one; superscript T denotes transpose | 1 |

**Assumptions**

- Quadratic differentiable energy; Hessian positive on the charge-conserving subspace for a unique minimum.
- The model parameters are calibrated in a consistent unit convention.

**Derivation.** Introduce a Lagrange multiplier for total charge. Setting charge derivatives to zero gives Hq+chi+eta times one=0 and the last row imposes conservation. Solve the saddle-point system or eliminate the constraint; explicit matrix inversion is usually unnecessary.

**Worked check.** For two identical sites with equal chi and symmetric positive hardness, neutrality implies q1=-q2 and symmetry gives both zero. A difference in chi produces opposite charges while keeping total charge fixed.

**Limits and common mistakes**

- Unique minimized latent charges are not a unique partition of the quantum electron density.
- Global coupling changes complexity and cache invalidation relative to purely local features.

**Sources:** [Kim and Cheng: Long-range electrostatics for machine learning interatomic potentials is easier than we thought](https://arxiv.org/html/2512.18029v1); [Rappé and Goddard: Charge equilibration for molecular dynamics simulations](https://pubs.acs.org/doi/10.1021/j100161a070)

<a id="pf-log-potential"></a>

### Analytic zeros as two-dimensional charge sources

$$
\Delta\log|g(z)|=2\pi\sum_j m_j\delta^{(2)}(z-z_j)\quad\text{for holomorphic }g\text{ without poles}
$$

**ID:** `pf-log-potential`

| Symbol | Meaning | Unit |
|---|---|---|
| g | nonzero holomorphic function except isolated zeros | chosen normalization |
| z | complex coordinate | chosen coordinate unit |
| z_j | zero locations | same as z |
| m_j | zero multiplicities | 1 |
| delta2 | two-dimensional delta | coordinate unit^-2 |

**Assumptions**

- Distributional equality; g has isolated zeros and no poles in the domain.
- Logarithm is of a dimensionless normalized modulus; branch of log g is not required for log|g|.

**Derivation.** Locally factor g(z)=(z-zj)^mj h(z) with h nonzero. Log|h| is harmonic, while integrating the normal derivative of log radius around a small circle gives 2 pi. Summing multiplicities yields the distributional source. For meromorphic g, poles add negative charges.

**Worked check.** For g(z)=z squared, log|g|=2 log r. Its Laplacian vanishes away from zero but integrated flux is 4 pi, exposing why a pointwise calculation alone misses the source.

**Limits and common mistakes**

- This mathematical potential has no SI electric charge unless a physical scaling is supplied.
- The bootstrap paper uses the analogy under precise analytic constraints, not as evidence of electrical memory in software.

**Sources:** [The spinless modular bootstrap at large central charge](https://hexagonmath.org/2611.00174v1)

## frequency

<a id="pf-frequency"></a>

### Cycles, angular frequency and phase

$$
f=\frac1T,\qquad \omega=2\pi f,\qquad \theta(t)=\theta_0+\int_0^t\omega(t')\,dt',\qquad x(t)=A\cos\theta(t)
$$

**ID:** `pf-frequency`

| Symbol | Meaning | Unit |
|---|---|---|
| f | cycles per unit time | Hz=s^-1 |
| omega | angular frequency | rad s^-1 |
| T | period for a periodic signal | s |
| theta | phase | rad |
| A | amplitude | units of x |
| t | time; overdots denote time derivatives in this card | s |
| theta_0 | initial phase | rad |
| x | oscillating observable | same units as A |
| t_prime | time integration dummy variable | s |

**Assumptions**

- A repeatable phase or periodic model has been specified.
- The reciprocal period relation applies to a genuinely periodic signal; instantaneous frequency needs an explicit phase representation.

**Derivation.** One cycle advances phase by 2pi radians. Dividing that phase change by its duration gives omega=2pi/T. Integrating variable angular frequency supplies accumulated phase. Radians are dimensionless in SI dimensional algebra but should remain visible to prevent lost 2pi factors. Frequency measures a rate of change, not amplitude, energy or importance.

**Worked check.** A 440 Hz sinusoid has omega≈2764.60 rad/s and period≈2.27273 ms. A pure time shift changes its phase while leaving the frequency unchanged. Doubling amplitude doubles x but leaves f unchanged in this kinematic model.

**Limits and common mistakes**

- A spatial graph eigenvalue does not have Hz without a temporal model and scale.
- The frequency of a nonlinear signal can be definition dependent; a single number may not capture its spectrum.

**Sources:** [The Feynman Lectures on Physics: The Harmonic Oscillator](https://www.feynmanlectures.caltech.edu/I_21.html)

<a id="pf-oscillator"></a>

### Small-amplitude harmonic oscillator

$$
m\ddot x+kx=0,\qquad \omega_0=\sqrt{k/m},\qquad x=A\cos(\omega_0t+\phi),\qquad E=\frac12m\dot x^2+\frac12kx^2
$$

**ID:** `pf-oscillator`

| Symbol | Meaning | Unit |
|---|---|---|
| m | effective mass | kg |
| k | linear stiffness | N m^-1 |
| x,A | displacement and amplitude | m |
| omega_0 | natural angular frequency | rad s^-1 |
| E | oscillator energy | J |
| t | time; overdots denote time derivatives in this card | s |
| phi | initial phase offset | rad |

**Assumptions**

- Motion near a stable equilibrium; quadratic potential and constant positive mass/stiffness.
- No drive or dissipation in the stated equation.

**Derivation.** Expand a smooth potential around an equilibrium x=0: U=U0+(1/2)U''(0)x²+O(x³). The first derivative vanishes and k=U''(0)>0. Newton's law gives the equation. A trial exponential supplies roots ±i sqrt(k/m). Multiplying the equation by xdot shows dE/dt=0 and establishes energy exchange between kinetic and potential terms.

**Worked check.** For m=1 kg and k=100 N/m, omega0=10 rad/s and f0≈1.59155 Hz. At A=0.02 m, stored energy is 0.02 J and peak speed is 0.2 m/s. These values independently satisfy the energy formula.

**Limits and common mistakes**

- Large amplitude may require cubic or higher restoring terms.
- A positive stiffness is a local stability condition; k=0 needs higher-order analysis and k<0 gives exponential instability.

**Sources:** [The Feynman Lectures on Physics: The Harmonic Oscillator](https://www.feynmanlectures.caltech.edu/I_21.html)

<a id="pf-damped"></a>

### Damped free motion and quality factor

$$
\ddot x+2\gamma\dot x+\omega_0^2x=0,\quad \omega_d=\sqrt{\omega_0^2-\gamma^2},\quad x=Ae^{-\gamma t}\cos(\omega_dt+\phi),\quad Q=\frac{\omega_0}{2\gamma}
$$

**ID:** `pf-damped`

| Symbol | Meaning | Unit |
|---|---|---|
| gamma | amplitude decay rate | s^-1 |
| omega_0,omega_d | undamped and damped angular frequencies | rad s^-1 |
| Q | oscillator quality factor | 1 |
| x | displacement | m |
| t | time; overdots denote time derivatives in this card | s |
| A | initial oscillation-envelope amplitude | m |
| phi | phase offset fixed by initial data | rad |

**Assumptions**

- Linear viscous damping b=2m gamma.
- Displayed oscillatory solution requires gamma<omega0; the Q interpretation as a narrow resonance assumes weak damping.

**Derivation.** The characteristic polynomial has roots -gamma±sqrt(gamma²-omega0²). In the underdamped regime they are a conjugate pair, giving an exponentially decaying envelope. Energy averaged over a weakly damped cycle decays approximately as exp(-2gamma t). Q compares the oscillation rate to this energy-decay rate, or stored energy to loss per radian.

**Worked check.** For omega0=10 rad/s and gamma=0.1/s, Q=50 and omega_d≈9.9995 rad/s. After ten seconds the amplitude has fallen to e^-1 of its initial envelope and cycle-averaged energy to approximately e^-2.

**Limits and common mistakes**

- Amplitude lifetime, energy lifetime and linewidth differ by factors of two.
- At critical damping gamma=omega0 the cosine representation is replaced by (A+Bt)e^-gamma t.

**Sources:** [The Feynman Lectures on Physics: Resonance](https://www.feynmanlectures.caltech.edu/I_23.html)

<a id="pf-forced"></a>

### Driven response and displacement resonance

$$
m\ddot x+b\dot x+kx=F_0\cos\omega t,\quad H(\omega)=\frac{X}{F_0}=\frac1{k-m\omega^2+i b\omega},\quad |X|=\frac{F_0}{\sqrt{(k-m\omega^2)^2+b^2\omega^2}}
$$

**ID:** `pf-forced`

| Symbol | Meaning | Unit |
|---|---|---|
| X | complex displacement amplitude using exp(i omega t) | m |
| H | displacement/force transfer function | m N^-1 |
| F_0 | drive force amplitude | N |
| b | viscous damping coefficient | kg s^-1 |
| omega | drive angular frequency | rad s^-1 |
| t | time; overdots denote time derivatives in this card | s |
| m | effective mass | kg |
| k | linear stiffness | N m^-1 |
| x | real displacement | m |

**Assumptions**

- Linear time-invariant oscillator with steady sinusoidal forcing after transients decay.
- b>0 for a stable dissipative steady state.

**Derivation.** Insert x=Re[X exp(iomega t)] into the differential equation. Derivatives multiply by iomega and -omega², producing an algebraic denominator. The denominator's magnitude gives amplitude and its argument gives phase lag. Minimizing its squared magnitude yields omega_peak²=omega0²-2gamma² for displacement when that expression is positive.

**Worked check.** At omega=omega0, X=-iF0/(b omega0), so displacement lags force by pi/2. For m=1 kg, k=100 N/m, b=0.2 kg/s and F0=0.1 N, |X|=0.05 m; whether the linear model remains valid must be checked at that amplitude.

**Limits and common mistakes**

- Velocity, displacement and absorbed-power peaks need not occur at the same frequency.
- As b→0 at exact resonance there is no finite steady response; transient growth replaces the steady-state formula.

**Sources:** [The Feynman Lectures on Physics: Resonance](https://www.feynmanlectures.caltech.edu/I_23.html); [The Feynman Lectures on Physics: Linear Systems and Review](https://www.feynmanlectures.caltech.edu/I_25.html)

<a id="pf-resonant-power"></a>

### Resonant power and storage budget

$$
\frac{dE}{dt}=F(t)\dot x-b\dot x^2,\qquad \langle P_{\mathrm{in}}\rangle=\frac12b\omega^2|X|^2=\langle P_{\mathrm{loss}}\rangle\quad\text{in steady state}
$$

**ID:** `pf-resonant-power`

| Symbol | Meaning | Unit |
|---|---|---|
| E | mechanical stored energy | J |
| P_in,P_loss | input and dissipated powers | W |
| F | external force | N |
| b | viscous damping coefficient | kg s^-1 |
| X | displacement amplitude | m |
| t | time; overdots denote time derivatives in this card | s |
| omega | drive angular frequency | rad s^-1 |
| x | real oscillator displacement | m |

**Assumptions**

- Same linear oscillator and amplitude convention as pf-forced.
- No unlisted storage or energy ports; steady state refers to cycle-averaged quantities.

**Derivation.** Multiply the equation of motion by velocity. The inertial and restoring terms become time derivatives of kinetic and potential energy; damping gives a nonnegative loss. A periodic steady state returns to the same energy each cycle, so average dE/dt vanishes. Evaluate mean squared sinusoidal velocity as omega²|X|²/2 to obtain dissipated power.

**Worked check.** Using b=0.2 kg/s, omega=10 rad/s and |X|=0.05 m gives mean loss 0.025 W. Input must supply that amount; a finite load adds another positive output term and changes the amplitude. The large response reflects stored energy and low loss.

**Limits and common mistakes**

- A high Q does not create power.
- For active materials, feedback or pumping, their energy inputs must be added before asserting efficiency or gain.

**Sources:** [The Feynman Lectures on Physics: Resonance](https://www.feynmanlectures.caltech.edu/I_23.html); [The Feynman Lectures on Physics: Field Energy and Field Momentum](https://www.feynmanlectures.caltech.edu/II_27.html)

<a id="pf-normal-modes"></a>

### Coupled normal-mode eigenproblem

$$
M\ddot{\mathbf x}+K\mathbf x=0,\qquad K\boldsymbol\phi_n=\omega_n^2M\boldsymbol\phi_n,\qquad \boldsymbol\phi_m^TM\boldsymbol\phi_n=\delta_{mn}\ \text{under chosen normalization}
$$

**ID:** `pf-normal-modes`

| Symbol | Meaning | Unit |
|---|---|---|
| M | symmetric positive mass matrix | kg for displacement coordinates |
| K | symmetric stiffness matrix | N m^-1 |
| phi_n | mode shape; units depend on normalization | normalization dependent |
| omega_n | normal angular frequency | rad s^-1 |
| t | time; overdots denote time derivatives in this card | s |
| x | displacement-coordinate vector | m |
| delta_mn | Kronecker delta under the chosen mode normalization | 1 |
| m,n | mode labels, distinct from a physical mass symbol | 1 |

**Assumptions**

- Linear conservative system; M positive definite and K positive semidefinite for stability.
- Coordinate units are compatible; other generalized coordinates require transformed matrices.

**Derivation.** Substitute one separable motion x=phi exp(iomega t) into the equations. Multiplying by M^-1/2 converts the problem to a symmetric ordinary eigenproblem, proving real nonnegative omega² under the assumptions. Distinct eigenvalues give mass-weighted orthogonality. Expand initial displacement and velocity in these modes to solve the motion.

**Worked check.** Two equal masses connected only by one spring have K=k[[1,-1],[-1,1]] and M=mI. The common translation mode has omega=0; the relative mode has omega=sqrt(2k/m). Zero stiffness for translation is a symmetry, not a numerical failure.

**Limits and common mistakes**

- Nonproportional damping or non-Hermitian coupling can destroy ordinary modal orthogonality.
- Eigenvector magnitude is arbitrary until normalization or an actual excitation amplitude is assigned.

**Sources:** [The Feynman Lectures on Physics: Modes](https://www.feynmanlectures.caltech.edu/I_49.html)

<a id="pf-fourier-series"></a>

### Fourier series with a declared normalization

$$
x(t)=\sum_{n\in\mathbb{Z}}c_ne^{in\omega_0t},\qquad c_n=\frac1T\int_0^T x(t)e^{-in\omega_0t}\,dt,\qquad \omega_0=2\pi/T
$$

**ID:** `pf-fourier-series`

| Symbol | Meaning | Unit |
|---|---|---|
| x,c_n | signal and complex Fourier coefficients | same physical signal units |
| T | period | s |
| n | integer harmonic index | 1 |
| t | time; overdots denote time derivatives in this card | s |
| omega_0 | fundamental angular frequency 2pi/T | rad s^-1 |

**Assumptions**

- A T-periodic square-integrable signal; reconstruction understood in L², with stronger pointwise conditions stated when needed.

**Derivation.** Exponentials with distinct integer harmonics are orthogonal over one period. Multiply a proposed expansion by exp(-imomega0t), integrate, and only coefficient m survives. Real signals obey c_-n=conjugate(c_n). Orthogonal projection explains why finite partial sums minimize mean-square residual among expansions using the retained harmonics.

**Worked check.** For x=A cos(omega0t), c1=c-1=A/2 and all other coefficients vanish. The time-averaged square is A²/2, matching |c1|²+|c-1|². A discontinuity can produce ringing of truncated sums without creating a new physical resonance.

**Limits and common mistakes**

- Pointwise convergence at discontinuities differs from mean-square convergence.
- A visual harmonic fit does not establish the mechanism that generated a measured signal.

**Sources:** [The Feynman Lectures on Physics: Harmonics](https://www.feynmanlectures.caltech.edu/I_50.html)

<a id="pf-fourier"></a>

### Continuous Fourier transform and Parseval identity

$$
\widetilde x(f)=\int_{-\infty}^{\infty}x(t)e^{-i2\pi ft}\,dt,\qquad x(t)=\int_{-\infty}^{\infty}\widetilde x(f)e^{i2\pi ft}\,df,\qquad \int|x|^2dt=\int|\widetilde x|^2df
$$

**ID:** `pf-fourier`

| Symbol | Meaning | Unit |
|---|---|---|
| f | cyclic frequency | Hz |
| x | time-domain signal | signal units |
| x_tilde | Fourier amplitude in this convention | signal units times s |
| t | time | s |

**Assumptions**

- Integrable functions for the direct formula or an L²/distributional extension with the relevant convergence interpretation.
- Both sides use the same 2pi convention.

**Derivation.** The transform resolves a signal into continuum exponential components. The inverse follows from the delta-function orthogonality identity; Parseval follows by inserting one inverse transform into the time inner product. A time derivative becomes multiplication by i2pi f when boundary terms vanish. This turns constant-coefficient linear differential equations into algebraic ones.

**Worked check.** A time shift x(t-t0) multiplies its transform by exp(-i2pi f t0) and leaves spectral magnitude unchanged. A wider time Gaussian has a narrower frequency Gaussian, demonstrating a scale tradeoff without invoking quantum physics.

**Limits and common mistakes**

- An infinite pure sinusoid needs delta distributions, not a finite-energy transform.
- Transform amplitude, power spectrum and power spectral density have different units and normalizations.

**Sources:** [The Feynman Lectures on Physics: Harmonics](https://www.feynmanlectures.caltech.edu/I_50.html); [The Feynman Lectures on Physics: Linear Systems and Review](https://www.feynmanlectures.caltech.edu/I_25.html)

<a id="pf-convolution"></a>

### Impulse response and convolution theorem

$$
y(t)=\int_{-\infty}^{\infty}h(t-\tau)x(\tau)\,d\tau=(h*x)(t),\qquad \widetilde y(f)=\widetilde h(f)\widetilde x(f)
$$

**ID:** `pf-convolution`

| Symbol | Meaning | Unit |
|---|---|---|
| x,y | input and output signals | application dependent |
| h | impulse response | output/(input times s) |
| h_tilde | frequency response | output/input |
| t | time; overdots denote time derivatives in this card | s |
| tau | time integration dummy variable | s |
| f | cyclic frequency | Hz |
| x_tilde,y_tilde | Fourier transforms of input and output in the stated convention | corresponding signal units times s |

**Assumptions**

- Linear time-invariant system, with initial-condition response separately included.
- Causal systems have h(t)=0 for t<0; integrals must converge in an appropriate sense.

**Derivation.** Represent an input as a weighted sum of delayed impulses. Linearity permits summing responses and time invariance makes each response a shifted copy of h. Swapping transform/integration under valid conditions turns the time convolution into a product. This distinguishes memory in a dynamical response kernel from a stored list of retrieved documents.

**Worked check.** For h(t)=tau^-1 exp(-t/tau) for t≥0, the DC gain is one and the transfer function is 1/(1+i2pi f tau). A unit step produces y=1-exp(-t/tau); the same kernel acts as an exponential smoother.

**Limits and common mistakes**

- A changing retrieval graph or input-dependent cache policy is not automatically time invariant.
- Convolution with a learned kernel is a design model unless validated against the intended observations.

**Sources:** [The Feynman Lectures on Physics: Linear Systems and Review](https://www.feynmanlectures.caltech.edu/I_25.html)

<a id="pf-laplace"></a>

### Unilateral Laplace transform and oscillator poles

$$
X(s)=\int_0^\infty x(t)e^{-st}\,dt,\qquad \mathcal L[\dot x]=sX-x(0^+),\qquad H(s)=\frac1{ms^2+bs+k}
$$

**ID:** `pf-laplace`

| Symbol | Meaning | Unit |
|---|---|---|
| s | complex growth/decay frequency | s^-1 |
| X(s) | Laplace amplitude | signal units times s |
| m,b,k | oscillator coefficients | kg, kg s^-1, N m^-1 |
| t | time; overdots denote time derivatives in this card | s |
| x | time-domain response; x(0+) is its right-limit initial value | signal units |
| H(s) | zero-initial-state displacement/force transfer function | m N^-1 |

**Assumptions**

- Causal functions of suitable exponential order and a specified region of convergence.
- Transfer function describes zero-initial-state response; initial terms remain for general solutions.

**Derivation.** Integration by parts yields the derivative rule. Transform a second derivative twice, retain initial displacement and velocity, and rearrange the oscillator equation. The denominator's roots determine natural transients. For positive m,b,k both roots have negative real parts, so free transients decay; an imaginary-axis Fourier response can be evaluated where the transform has the appropriate limit.

**Worked check.** For m=1, b=2 and k=5 in compatible units, poles are -1±2i per second. The solution decays with one-second amplitude scale and oscillates at 2 rad/s. The natural undamped frequency is sqrt(5), not 2.

**Limits and common mistakes**

- Poles alone do not determine residues, input excitation, nonnormal transient growth or nonlinear stability.
- Ignoring initial conditions can give an incorrect transient even when H is correct.

**Sources:** [The Feynman Lectures on Physics: Linear Systems and Review](https://www.feynmanlectures.caltech.edu/I_25.html)

<a id="pf-dft"></a>

### Discrete Fourier transform and bin scale

$$
X_k=\sum_{n=0}^{N-1}x_ne^{-i2\pi kn/N},\qquad x_n=\frac1N\sum_{k=0}^{N-1}X_ke^{i2\pi kn/N},\qquad \Delta f=\frac{f_s}{N}
$$

**ID:** `pf-dft`

| Symbol | Meaning | Unit |
|---|---|---|
| x_n | uniformly sampled finite record | signal units |
| X_k | unscaled DFT coefficient | signal units |
| f_s | sample rate | Hz |
| N | record length | 1 |
| Delta_f | frequency-bin spacing | Hz |
| n,k | sample and frequency-bin indices | 1 |

**Assumptions**

- N samples with fixed sample interval; stated normalization applies.
- The DFT represents one period of a periodic extension of the record.

**Derivation.** Finite roots-of-unity sums are orthogonal, giving the inverse and finite Parseval relation sum|x|²=(1/N)sum|X|². Frequencies are k f_s/N with bins beyond Nyquist interpreted as negative frequencies. A fast Fourier transform computes this same transform efficiently; it is not a different physical spectrum.

**Worked check.** For f_s=1000 Hz and N=1000, bins are 1 Hz apart. Zero-padding to 4000 samples draws the same finite-record spectrum on a 0.25 Hz grid but does not quadruple the underlying observation time or resolve truly indistinguishable components.

**Limits and common mistakes**

- Bin spacing is not a complete statistical frequency-resolution or uncertainty statement.
- An unnormalized DFT amplitude grows with N; compare signals only after the correct scaling/window correction.

**Sources:** [Shannon: Communication in the Presence of Noise](https://ieeexplore.ieee.org/abstract/document/1697831/authors); [Riley and Howe: Handbook of Frequency Stability Analysis (NIST SP 1065)](https://www.nist.gov/publications/handbook-frequency-stability-analysis)

<a id="pf-sampling"></a>

### Band-limited sampling and alias equivalence

$$
x(t)=\sum_{n\in\mathbb{Z}}x(nT_s)\,\operatorname{sinc}\!\left(\frac{t-nT_s}{T_s}\right),\quad \operatorname{sinc}(u)=\frac{\sin\pi u}{\pi u},\quad f_s=1/T_s>2B
$$

**ID:** `pf-sampling`

| Symbol | Meaning | Unit |
|---|---|---|
| B | highest absolute signal frequency in a low-pass model | Hz |
| f_s | sample rate | Hz |
| T_s | sampling interval | s |
| t | time; overdots denote time derivatives in this card | s |
| x | sampled/reconstructed continuous signal | signal units |
| n | integer sample index | 1 |
| u | dimensionless sinc argument | 1 |

**Assumptions**

- Ideal signal band limit |f|≤B and ideal uniform samples over an unbounded record.
- Strict inequality avoids endpoint ambiguities in simple practical statements.

**Derivation.** Sampling replicates the continuous spectrum at integer multiples of f_s. If neighboring replicas do not overlap, an ideal low-pass interpolation filter recovers the original band. The time-domain impulse response is the sinc kernel. At sample n, exp(i2pi(f+kf_s)n/f_s)=exp(i2pi f n/f_s), proving alias indistinguishability.

**Worked check.** A 700 Hz sinusoid sampled at 1000 Hz aliases to a signed -300 Hz complex sinusoid, or a 300 Hz real cosine. Once the analog content has aliased, adding a digital filter cannot infer which original frequency was present without additional information.

**Limits and common mistakes**

- Physical anti-alias filters have transition bands; sampling just above 2B may be impractical.
- Finite duration, jitter, quantization and noise are additional errors beyond the ideal theorem.

**Sources:** [Shannon: Communication in the Presence of Noise](https://ieeexplore.ieee.org/abstract/document/1697831/authors)

<a id="pf-periodogram"></a>

### Windowed two-sided power spectral estimate

$$
\widehat S_{xx}(f_k)=\frac{\left|\sum_{n=0}^{N-1}w_nx_ne^{-i2\pi kn/N}\right|^2}{f_s\sum_{n=0}^{N-1}w_n^2},\qquad f_k=\frac{kf_s}{N}
$$

**ID:** `pf-periodogram`

| Symbol | Meaning | Unit |
|---|---|---|
| S_xx | two-sided periodogram power spectral density | signal units squared per Hz |
| w_n | dimensionless window weights | 1 |
| f_s | sample rate | Hz |
| x_n | sampled signal | signal units |
| N | number of samples | 1 |
| n,k | sample and frequency-bin indices | 1 |
| f_k | cyclic frequency of bin k | Hz |

**Assumptions**

- Uniform sampling and stated two-sided PSD convention.
- Mean/trend removal, window choice and averaging must be declared for a practical measurement.

**Derivation.** Windowing multiplies the record in time, so it convolves the underlying spectrum with the window transform. Squaring gives a power estimate; normalization by sample rate and squared window norm preserves the correct white-noise PSD scale. Integrating the discrete estimate with bin width f_s/N yields the corresponding weighted mean-square value.

**Worked check.** For a rectangular window, sum w²=N. A real signal's one-sided PSD doubles interior positive-frequency bins, but does not double DC or the Nyquist bin when present. Reporting one-sided amplitudes with a two-sided convention can introduce a factor of two error.

**Limits and common mistakes**

- A single periodogram has high variance; narrower bins alone do not guarantee a better estimate.
- A peak can reflect window leakage, aliasing, interference or a transient; mechanism identification requires controls.

**Sources:** [Riley and Howe: Handbook of Frequency Stability Analysis (NIST SP 1065)](https://www.nist.gov/publications/handbook-frequency-stability-analysis); [The Feynman Lectures on Physics: Harmonics](https://www.feynmanlectures.caltech.edu/I_50.html)

<a id="pf-wave"></a>

### Wave and Helmholtz equations

$$
\partial_t^2u=c_w^2\nabla^2u,\qquad u(\mathbf x,t)=\Re[U(\mathbf x)e^{-i\omega t}]\Rightarrow(\nabla^2+k^2)U=0,\quad k=\omega/c_w
$$

**ID:** `pf-wave`

| Symbol | Meaning | Unit |
|---|---|---|
| u,U | wave field and complex amplitude | field dependent |
| c_w | wave speed in chosen medium | m s^-1 |
| k | wavenumber magnitude | rad m^-1 |
| omega | angular frequency | rad s^-1 |
| t | time; overdots denote time derivatives in this card | s |
| x | spatial position | m |

**Assumptions**

- Linear homogeneous nondispersive isotropic medium without sources or loss.
- Boundary and initial conditions must be supplied.

**Derivation.** For a taut string, small transverse force imbalance is tension times curvature while inertia is mass per length times transverse acceleration; their ratio defines c_w². Analogous linearized conservation laws yield acoustic propagation. A single-frequency ansatz turns two time derivatives into -omega² and produces Helmholtz's spatial equation.

**Worked check.** u=A cos(kx-omega t) satisfies the wave equation when omega²=c_w²k². On a fixed string of length L, zero displacement at both ends requires k_n=npi/L and f_n=n c_w/(2L), n≥1.

**Limits and common mistakes**

- The speed c_w need not be vacuum light speed c.
- Dispersive, attenuating, anisotropic and nonlinear media require modified operators and can have complex k.

**Sources:** [The Feynman Lectures on Physics: Sound. The wave equation](https://www.feynmanlectures.caltech.edu/I_47.html); [The Feynman Lectures on Physics: Modes](https://www.feynmanlectures.caltech.edu/I_49.html)

<a id="pf-dispersion"></a>

### Phase, group velocity and beat structure

$$
v_p=\frac{\omega}{k},\qquad v_g=\frac{d\omega}{dk},\qquad \cos(\omega_1t)+\cos(\omega_2t)=2\cos\!\left(\frac{\omega_1-\omega_2}{2}t\right)\cos\!\left(\frac{\omega_1+\omega_2}{2}t\right)
$$

**ID:** `pf-dispersion`

| Symbol | Meaning | Unit |
|---|---|---|
| v_p,v_g | phase and narrowband group velocities | m s^-1 |
| omega,k | angular frequency and wavenumber | rad s^-1, rad m^-1 |
| omega_1,omega_2 | component angular frequencies | rad s^-1 |
| t | time; overdots denote time derivatives in this card | s |

**Assumptions**

- Differentiable dispersion relation for the group-velocity approximation.
- A narrow wave packet with sufficiently mild dispersion; group velocity is not always energy/information speed.

**Derivation.** A constant phase kx-omega t travels at omega/k. Expand omega(k) to first order near a carrier: the slowly varying envelope translates at the derivative. The trigonometric sum separates carrier and signed envelope for two frequencies; the magnitude of the envelope repeats at the difference frequency in cycles per second.

**Worked check.** Two tones at 440 Hz and 442 Hz yield two amplitude maxima per second. The signed envelope cosine has 1 Hz frequency but flips carrier phase, so its absolute amplitude repeats at 2 Hz. Confusing these gives a common factor-of-two error.

**Limits and common mistakes**

- A beat frequency does not imply new energy appears at that low frequency in a strictly linear spectral decomposition.
- Near absorption resonances or severe reshaping, simple group-speed interpretation can fail.

**Sources:** [The Feynman Lectures on Physics: Beats](https://www.feynmanlectures.caltech.edu/I_48.html)

<a id="pf-acoustic"></a>

### Plane-wave acoustic impedance and intensity

$$
Z_0=\rho_0c_w,\quad \widehat p=Z_0\widehat v,\quad \langle I\rangle=\frac{|\widehat p|^2}{2Z_0},\quad r_p=\frac{Z_2-Z_1}{Z_2+Z_1}
$$

**ID:** `pf-acoustic`

| Symbol | Meaning | Unit |
|---|---|---|
| Z_0 | specific acoustic impedance | Pa s m^-1 |
| rho_0 | equilibrium mass density | kg m^-3 |
| p_hat | pressure amplitude, peak not rms | Pa |
| v_hat | particle-velocity amplitude | m s^-1 |
| I | energy flux density | W m^-2 |
| r_p | normal-incidence pressure reflection coefficient | 1 |
| c_w | sound-wave speed in the medium | m s^-1 |
| Z_1,Z_2 | real positive specific impedances of incident/transmitted media | Pa s m^-1 |

**Assumptions**

- Progressive lossless plane waves; real positive impedances for the simple intensity/reflection formulas.
- Normal incidence between semi-infinite homogeneous media, continuity of pressure and normal velocity.

**Derivation.** Linearized momentum links the pressure gradient to particle acceleration, while continuity and compressibility determine c_w. For one traveling harmonic plane wave these give p=ρ0 c_w v. Average p(t)v(t) over a period for intensity. At an interface write incident plus reflected pressure and the opposite sign of reflected velocity; solve the two continuity equations.

**Worked check.** With Z1=400 and Z2=800 Pa s/m, r_p=1/3 and reflected power fraction is 1/9. The transmitted pressure amplitude is 4/3 of incident while transmitted power fraction is 8/9. Pressure amplitude above one does not violate conservation.

**Limits and common mistakes**

- Standing waves and near fields need complex impedance and phase-aware power accounting.
- Pressure enhancement at a focus or interface is not total acoustic energy amplification.

**Sources:** [The Feynman Lectures on Physics: Sound. The wave equation](https://www.feynmanlectures.caltech.edu/I_47.html)

<a id="pf-membrane"></a>

### Rectangular membrane eigenfrequencies

$$
\partial_t^2u=\frac{\mathcal T}{\sigma}\nabla^2u,\qquad f_{mn}=\frac12\sqrt{\frac{\mathcal T}{\sigma}}\sqrt{\left(\frac m{L_x}\right)^2+\left(\frac n{L_y}\right)^2},\quad m,n\ge1
$$

**ID:** `pf-membrane`

| Symbol | Meaning | Unit |
|---|---|---|
| T_calligraphic | uniform in-plane tension per length | N m^-1 |
| sigma | mass per area | kg m^-2 |
| Lx,Ly | rectangular side lengths | m |
| f_mn | modal cyclic frequency | Hz |
| u | transverse displacement | m |
| t | time; overdots denote time derivatives in this card | s |
| m,n | positive integer mode indices, not masses | 1 |

**Assumptions**

- Thin ideal membrane, small displacement, uniform isotropic tension and fixed edges.
- Bending rigidity neglected; this is not a plate equation.

**Derivation.** Balance transverse force from tension on a differential patch with its inertial force. Separate u=X(x)Y(y)T(t); fixed boundaries select sine functions with integer half-wavelengths along both axes. Their squared wavenumbers add, which yields the displayed spectrum. Nodal lines depend on the particular mode and superposition.

**Worked check.** For a square of side 1 m with sqrt(T/sigma)=100 m/s, f11≈70.71 Hz while f12=f21≈111.80 Hz. These are not integer multiples, so a two-dimensional membrane does not have the simple harmonic ladder of an ideal one-dimensional string.

**Limits and common mistakes**

- A rigid bending plate has fourth-order spatial dynamics and different dispersion/boundary conditions.
- Particle patterns in cymatics also depend on friction, airflow and particle transport; a photograph alone does not identify a unique eigenmode.

**Sources:** [The Feynman Lectures on Physics: Modes](https://www.feynmanlectures.caltech.edu/I_49.html)

<a id="pf-quantum-oscillator"></a>

### Quantum mode energies and thermal occupation

$$
E_n=\hbar\omega\left(n+\frac12\right),\qquad \Delta E=\hbar\omega=hf,\qquad \bar n=\frac1{e^{\hbar\omega/(k_BT)}-1}
$$

**ID:** `pf-quantum-oscillator`

| Symbol | Meaning | Unit |
|---|---|---|
| E_n | energy of harmonic oscillator level n | J |
| n,nbar | integer occupation and mean occupation | 1 |
| h,hbar | Planck and reduced Planck constants | J s |
| T | equilibrium temperature | K |
| omega | mode angular frequency | rad s^-1 |
| k_B | Boltzmann constant | J K^-1 |
| Delta E | spacing between neighboring oscillator levels | J |
| f | cyclic frequency omega/(2pi) | Hz |

**Assumptions**

- An approximately harmonic quantum bosonic mode; the mean occupation formula requires thermal equilibrium.
- Transition energy, occupation and zero-point offset are distinct quantities.

**Derivation.** Canonical quantization with [x,p]=i hbar permits ladder operators, giving H=hbar omega(a†a+1/2). The geometric series partition function yields Bose occupation. At kBT≫hbar omega, expansion of the exponential gives mean excitation energy approximately kBT; at low temperature occupancy falls exponentially while the zero-point contribution remains.

**Worked check.** At f=1 GHz, hf≈6.62607e-25 J, equivalent to kB times 0.04799 K. A 1 K thermal environment has mean occupation about 20.34; cooling and filtering matter for observing a near-ground-state acoustic mode.

**Limits and common mistakes**

- E=hf gives one quantum's transition energy, not total energy of any classical sound at frequency f.
- Zero-point energy cannot be extracted cyclically as free work from an equilibrium ground state.

**Sources:** [Qiao et al.: Acoustic phonon phase gates with number-resolving phonon detection](https://arxiv.org/html/2503.03898v1); [NIST CODATA fundamental physical constants (2022 adjustment)](https://physics.nist.gov/cuu/Constants/)

<a id="pf-allan"></a>

### Nonoverlapping Allan variance

$$
\bar y_k(\tau)=\frac1\tau\int_{k\tau}^{(k+1)\tau}\frac{\nu(t)-\nu_0}{\nu_0}\,dt,\qquad \sigma_y^2(\tau)=\frac12\left\langle\left(\bar y_{k+1}-\bar y_k\right)^2\right\rangle
$$

**ID:** `pf-allan`

| Symbol | Meaning | Unit |
|---|---|---|
| y,ybar | instantaneous and averaged fractional-frequency offset | 1 |
| nu,nu0 | observed and nominal frequencies | Hz |
| tau | averaging interval | s |
| sigma_y | Allan deviation | 1 |
| t | time; overdots denote time derivatives in this card | s |
| k | successive nonoverlapping averaging-block index | 1 |

**Assumptions**

- Specified averaging time, data continuity, estimator type and reference oscillator.
- Finite-record confidence depends on noise type and effective degrees of freedom.

**Derivation.** A difference of adjacent averages cancels a constant frequency offset. Squaring and averaging measures variation at the chosen averaging scale; the factor one half matches the variance of independent equal-variance averages. Taking the square root gives Allan deviation. Overlapping estimators reuse samples for better statistical efficiency but require their own denominator and uncertainty treatment.

**Worked check.** For alternating averages +a,-a,+a,-a, every adjacent difference has magnitude 2a, giving sigma_y=sqrt(2)|a|. For a constant offset y=b all differences vanish: Allan deviation is zero although the clock frequency is biased.

**Limits and common mistakes**

- Excellent stability does not prove frequency accuracy.
- Comparisons require matching averaging times, dead-time treatment and measurement bandwidth.

**Sources:** [Riley and Howe: Handbook of Frequency Stability Analysis (NIST SP 1065)](https://www.nist.gov/publications/handbook-frequency-stability-analysis); [A thorium-229 optical nuclear clock with feedback loop](https://www.nature.com/articles/s41586-026-11084-4)

<a id="pf-exceptional"></a>

### A two-mode non-Hermitian exceptional point

$$
H=\begin{pmatrix}m&i\kappa\\i\kappa&-m\end{pmatrix},\qquad H^2=(m^2-\kappa^2)I,\qquad \lambda_\pm=\pm\sqrt{m^2-\kappa^2}
$$

**ID:** `pf-exceptional`

| Symbol | Meaning | Unit |
|---|---|---|
| m,kappa | effective model coefficients with matching units | eigenvalue units |
| H | effective two-mode operator | eigenvalue units |
| lambda_pm | model eigenvalues | same units as m |
| I | two-dimensional identity matrix | 1 |

**Assumptions**

- Real m,kappa and the displayed effective matrix; physical units require a calibrated model.
- An exceptional point at |m|=|kappa| requires the matrix be nonzero.

**Derivation.** Direct matrix multiplication cancels off-diagonal terms and gives a scalar multiple of identity. The characteristic polynomial is lambda²-(m²-kappa²). At nonzero m=kappa the double eigenvalue is zero, but H has rank one and only one independent null eigenvector, so it is defective. At m=kappa=0 the zero matrix instead has two eigenvectors and is not exceptional.

**Worked check.** For m=2 and kappa=1 in common units, eigenvalues are ±sqrt(3). For m=1 and kappa=2 they are ±i sqrt(3). These effective eigenvalues do not establish total physical gain without deriving the time convention, loss background and external driving.

**Limits and common mistakes**

- A square-root spectral response is not by itself improved signal-to-noise metrology.
- Open-system mode descriptions must retain pumping, loss and radiation budgets.

**Sources:** [Xia et al.: Acoustic topological Jackiw–Rebbi states at symmetry broken interfaces](https://www.nature.com/articles/s41467-026-77579-w); [Ding et al.: Absorbing exceptional point of coherent vortex beams](https://www.nature.com/articles/s41467-026-78506-9)

<a id="pf-graph-energy"></a>

### Graph Laplacian energy, diffusion and physical modes

$$
L=D-W,\qquad \mathbf x^TL\mathbf x=\frac12\sum_{ij}w_{ij}(x_i-x_j)^2,\qquad \dot{\mathbf x}=-\alpha L\mathbf x,\qquad M\ddot{\mathbf x}+kL\mathbf x=0
$$

**ID:** `pf-graph-energy`

| Symbol | Meaning | Unit |
|---|---|---|
| W,D,L | symmetric weights, weighted degrees, combinatorial Laplacian | 1 in dimensionless graph convention |
| x | node signal or physical displacement, as specified | application dependent |
| alpha | diffusive rate coefficient | s^-1 |
| M | mass matrix for physical model | kg |
| k | spring scale for physical model | N m^-1 |
| t | time; overdots denote time derivatives in this card | s |
| w_ij | symmetric nonnegative weight of edge ij | 1 in the stated convention |
| i,j | node indices | 1 |

**Assumptions**

- Undirected graph with nonnegative symmetric weights; these assumptions guarantee a positive semidefinite L.
- The diffusion and mechanical equations are separate models using the same operator.

**Derivation.** Expand x^T(D-W)x and pair ij with ji to obtain the squared-difference energy. L times the constant vector is zero. In an eigenvector with eigenvalue lambda, diffusion decays as exp(-alpha lambda t), whereas equal-mass mechanical displacement oscillates at sqrt(k lambda/m). The algebra is shared while the empirical meaning, units and dynamics differ.

**Worked check.** For a two-node unit edge, L=[[1,-1],[-1,1]] has eigenvalues 0 and 2. The difference signal decays at 2alpha in diffusion; two equal masses oscillate at sqrt(2k/m). Neither eigenvalue alone is a frequency in Hz.

**Limits and common mistakes**

- Directed, signed or semantic relation graphs need separate operator choices; naive symmetric diffusion may erase meaning.
- Graph smoothing can blur contradictory evidence; an analogy edge must not be used as proof propagation.

**Sources:** [Hammond, Vandergheynst and Gribonval: Wavelets on Graphs via Spectral Graph Theory](https://arxiv.org/abs/0912.3848); [The Feynman Lectures on Physics: Modes](https://www.feynmanlectures.caltech.edu/I_49.html)

<a id="pf-graph-wavelet"></a>

### Spectral graph filters and localized wavelets

$$
L=U\Lambda U^T,\qquad g(sL)=U\,g(s\Lambda)\,U^T,\qquad \psi_{s,n}=g(sL)\mathbf e_n,\qquad \widehat{\mathbf x}=U^T\mathbf x
$$

**ID:** `pf-graph-wavelet`

| Symbol | Meaning | Unit |
|---|---|---|
| L | symmetric graph Laplacian | 1 under dimensionless weights |
| U | orthonormal eigenvector matrix | 1 |
| Lambda | diagonal eigenvalue matrix | 1 |
| s | graph spectral scale parameter | inverse eigenvalue units |
| e_n | indicator at node n | 1 |
| g | chosen scalar spectral filter kernel | dimensionless output in this convention |
| psi_s,n | filter response localized at node n and scale s | 1 for a unit impulse |
| x,x_hat | node signal and its graph-spectral coefficients | same signal units |
| n | node label | 1 |

**Assumptions**

- Finite undirected nonnegative-weight graph; functional calculus applied to its symmetric Laplacian.
- Kernel/scale choices and an appropriate low-pass component determine invertibility and coverage.

**Derivation.** Diagonalizing a symmetric operator defines a function of that operator by applying the function to each eigenvalue. Applying the resulting filter to a node impulse localizes its response. Large eigenvalues encode rapidly changing neighboring node values, not necessarily fast changes in time. Polynomial approximations can evaluate a filter through sparse matrix-vector products without a complete eigendecomposition.

**Worked check.** On the two-node graph, g(lambda)=exp(-s lambda) preserves the constant component and attenuates the difference by exp(-2s). A wavelet kernel chosen with g(0)=0 removes the constant component; a separate scaling function is needed to reconstruct arbitrary constants.

**Limits and common mistakes**

- Graph filtering is a mathematical tool, not evidence that a notes graph has biological neural dynamics.
- Using arbitrary relation types as nonnegative affinity weights can give a numerically valid but semantically misleading filter.

**Sources:** [Hammond, Vandergheynst and Gribonval: Wavelets on Graphs via Spectral Graph Theory](https://arxiv.org/abs/0912.3848)

## gravity

<a id="pf-newton"></a>

### Newtonian force and potential

$$
\mathbf F=-\frac{GMm}{r^3}\mathbf r,\qquad \Phi=-\frac{GM}{r},\qquad \mathbf g=-\nabla\Phi
$$

**ID:** `pf-newton`

| Symbol | Meaning | Unit |
|---|---|---|
| G | gravitational constant | m^3 kg^-1 s^-2 |
| M,m | source and test masses | kg |
| r | separation | m |
| Phi | potential per unit mass | m^2 s^-2 |
| g | acceleration | m s^-2 |
| F | gravitational force on test mass m | N |

**Assumptions**

- Isolated point masses or a spherical exterior; weak field and slow motion.
- Potential reference is zero at infinity.

**Derivation.** For a central inverse-square force, radial work gives dPhi/dr=GM/r². Integrating from infinity produces -GM/r. Multiplication by test mass returns potential energy and differentiation returns the attractive force. The potential is negative while its outward radial derivative is positive: the minus gradient points inward. The test mass cancels from acceleration, expressing universality of Newtonian free fall.

**Worked check.** At twice the radius, acceleration is one quarter as large and potential has half the magnitude. For G=6.67430e-11 SI, M=1e12 kg and r=1e3 m, g=6.67430e-5 m/s² and Phi=-0.066743 m²/s².

**Limits and common mistakes**

- A point-particle singularity does not describe the interior of an extended source.
- Relativistic stress and dynamical geometry are absent; neither c nor wave propagation is present.

**Sources:** [David Tong: Geodesics in Spacetime](https://www.damtp.cam.ac.uk/user/tong/gr/grhtml/S1.html); [NIST CODATA fundamental physical constants (2022 adjustment)](https://physics.nist.gov/cuu/Constants/)

<a id="pf-grav-poisson"></a>

### Gravitational Poisson equation

$$
\nabla^2\Phi=4\pi G\rho_m,\qquad \oint\mathbf g\cdot d\mathbf A=-4\pi GM_{\mathrm{enc}}
$$

**ID:** `pf-grav-poisson`

| Symbol | Meaning | Unit |
|---|---|---|
| Phi | Newtonian gravitational potential | m^2 s^-2 |
| rho_m | mass density | kg m^-3 |
| g | gravitational acceleration | m s^-2 |
| A | oriented surface element | m^2 |
| G | Newton gravitational constant | m^3 kg^-1 s^-2 |
| M_enc | mass enclosed by the oriented integration surface | kg |

**Assumptions**

- Newtonian continuum description with specified boundary conditions.

**Derivation.** An inward inverse-square field carries flux -4piGM across any enclosing sphere. Add fields from source elements, use the divergence theorem and substitute g=-grad Phi. For a uniform sphere, enclosed mass grows as r³, hence the interior acceleration is linear in r. Continuity of potential and its first derivative at the surface fixes the interior constant.

**Worked check.** A sphere of radius R and mass M has Phi(r)=-GM(3R²-r²)/(2R³) inside. Differentiation gives g=-GM r/R³; its Laplacian is 3GM/R³=4piG rho_m. The field vanishes at the center without the potential vanishing.

**Limits and common mistakes**

- The sign is opposite the electric-potential equation with positive charge density.
- For infinite homogeneous matter, an isolated zero-at-infinity potential is unavailable; cosmological boundary assumptions are needed.

**Sources:** [David Tong: When Gravity is Weak](https://www.damtp.cam.ac.uk/user/tong/gr/grhtml/S5.html)

<a id="pf-kepler"></a>

### Two-body orbit period and energy

$$
T^2=\frac{4\pi^2a^3}{G(M+m)},\qquad E=-\frac{GMm}{2a},\qquad v_{\mathrm{rel}}^2=G(M+m)\left(\frac2r-\frac1a\right)
$$

**ID:** `pf-kepler`

| Symbol | Meaning | Unit |
|---|---|---|
| T | orbital period | s |
| a | semimajor axis of relative orbit | m |
| E | total orbital energy in center-of-mass frame | J |
| v_rel | relative speed | m s^-1 |
| r | relative separation | m |
| G | Newton gravitational constant | m^3 kg^-1 s^-2 |
| M,m | two gravitating body masses | kg |

**Assumptions**

- Bound Newtonian two-body ellipse; negligible external forces, radiation and finite-size effects.

**Derivation.** Introduce reduced mass mu=Mm/(M+m), so the relative coordinate has kinetic energy mu v²/2 and potential -GMm/r. Conservation of angular momentum gives equal areas in equal times. Integrating one ellipse gives the period; evaluating energy at a turning point yields the semimajor-axis expression and then the vis-viva relation. The system's center-of-mass kinetic energy is excluded.

**Worked check.** For a circular orbit r=a, vis-viva reduces to v²=G(M+m)/a. Doubling a increases T by 2^(3/2), not by two, and halves the magnitude of the negative orbital energy.

**Limits and common mistakes**

- a belongs to the relative orbit, not necessarily the radius of either body's orbit around the barycenter.
- An inspiralling binary has approximately changing orbital elements rather than one exact conserved E.

**Sources:** [David Tong: Geodesics in Spacetime](https://www.damtp.cam.ac.uk/user/tong/gr/grhtml/S1.html)

<a id="pf-variational"></a>

### Euler–Lagrange equation from stationary action

$$
S[q]=\int_{t_0}^{t_1}L(q,\dot q,t)\,dt,\qquad \delta S=0\Rightarrow\frac{d}{dt}\frac{\partial L}{\partial\dot q^i}-\frac{\partial L}{\partial q^i}=0
$$

**ID:** `pf-variational`

| Symbol | Meaning | Unit |
|---|---|---|
| S | action | J s |
| L | Lagrangian | J |
| q^i | generalized coordinates | coordinate dependent |
| t | time | s |
| t_0,t_1 | fixed endpoint times of the varied trajectory | s |

**Assumptions**

- Differentiable paths and Lagrangian; endpoint variations vanish.
- Constrained systems require appropriate independent coordinates or multipliers.

**Derivation.** Set q to q+epsilon eta, differentiate the integral at epsilon=0, and integrate the eta-dot term by parts. Endpoint terms disappear. The remaining integral has arbitrary eta, so its coefficient must vanish. This proves stationarity, not positive second variation. With L=m qdot²/2-U(q), the result is m qddot=-dU/dq.

**Worked check.** For U=kq²/2 the variation produces m qddot+kq=0. A constant added to L changes S by a constant duration-dependent offset but not the motion. A total time derivative changes only endpoint data.

**Limits and common mistakes**

- Stationary action need not minimize action globally.
- A proposed learning or memory objective is a designed optimization rule unless an actual physical action has been derived.

**Sources:** [David Tong: Geodesics in Spacetime](https://www.damtp.cam.ac.uk/user/tong/gr/grhtml/S1.html)

<a id="pf-metric-time"></a>

### Metric and measured proper time

$$
ds^2=g_{\mu\nu}dx^\mu dx^\nu=-c^2d\tau^2,\qquad d\tau=dt\sqrt{1-v^2/c^2}\quad\text{in inertial Minkowski coordinates}
$$

**ID:** `pf-metric-time`

| Symbol | Meaning | Unit |
|---|---|---|
| g_munu | metric components; signature (-,+,+,+) | dimensionless if all coordinates have length |
| x^0=ct | time coordinate in length units | m |
| tau,t | proper and coordinate times | s |
| v | coordinate speed in stated inertial frame | m s^-1 |
| c | vacuum speed of light | m s^-1 |
| ds^2 | signed infinitesimal spacetime interval squared | m^2 |
| x^mu | spacetime coordinates; all-length chart in the displayed convention | m |

**Assumptions**

- Timelike worldline; positive proper-time increment.
- The displayed square-root specialization requires Minkowski inertial coordinates.

**Derivation.** Insert the flat metric diag(-1,1,1,1) and dx^i=v^i dt into ds². Dividing by -c² gives dτ²=dt²(1-v²/c²). Proper time integrates locally measured clock intervals along a path; changing coordinates changes metric components but not that integral. In curved spacetime use the general metric expression rather than the flat specialization.

**Worked check.** At v=0.6c in an inertial frame, one second of coordinate time corresponds to 0.8 seconds along the moving worldline. This compares specified paths and coordinates, not absolute slowness of one object.

**Limits and common mistakes**

- Angular coordinates are dimensionless, so their metric components carry powers of length; unit labels must follow the chart.
- Null curves have ds²=0 and no massive observer's proper-time parameter.

**Sources:** [David Tong: Geodesics in Spacetime](https://www.damtp.cam.ac.uk/user/tong/gr/grhtml/S1.html); [David Tong: Introducing Differential Geometry](https://www.damtp.cam.ac.uk/user/tong/gr/grhtml/S2.html)

<a id="pf-connection"></a>

### Levi-Civita connection

$$
\Gamma^{\rho}_{\mu\nu}=\frac12g^{\rho\sigma}\left(\partial_\mu g_{\sigma\nu}+\partial_\nu g_{\sigma\mu}-\partial_\sigma g_{\mu\nu}\right)
$$

**ID:** `pf-connection`

| Symbol | Meaning | Unit |
|---|---|---|
| Gamma | connection components | m^-1 when all coordinates have length |
| g^rhosigma | inverse metric | inverse metric-component units |
| partial_mu | coordinate derivative | inverse coordinate unit |
| g_munu | metric components; inverse is g^munu | dimensionless in all-length coordinates |

**Assumptions**

- Nondegenerate differentiable metric; metric-compatible torsion-free connection.

**Derivation.** Write metric compatibility as partial_mu g_nu sigma minus two connection contractions equals zero. Add two cyclic permutations and subtract the third. Torsion freedom identifies lower-index permutations, leaving twice the desired metric-lowered connection. Multiplying by the inverse metric gives the formula. Connection coefficients transform with an extra derivative-of-coordinate term, so they are not tensor components.

**Worked check.** Flat Euclidean polar coordinates have Gamma^r_theta theta=-r and Gamma^theta_r theta=1/r. Nonzero coefficients therefore do not prove curvature. Their different units reflect that r has length and theta does not.

**Limits and common mistakes**

- A graph edge called a connection is not automatically a differential-geometric connection.
- Nonzero connection at one point can be a coordinate effect; use curvature or measured relative acceleration.

**Sources:** [David Tong: Introducing Riemannian Geometry](https://www.damtp.cam.ac.uk/user/tong/gr/grhtml/S3.html)

<a id="pf-geodesic"></a>

### Affinely parameterized geodesic equation

$$
\frac{d^2x^\mu}{d\lambda^2}+\Gamma^\mu_{\alpha\beta}\frac{dx^\alpha}{d\lambda}\frac{dx^\beta}{d\lambda}=0
$$

**ID:** `pf-geodesic`

| Symbol | Meaning | Unit |
|---|---|---|
| lambda | affine parameter; may be proper time for timelike paths | s if proper time |
| x^mu | spacetime coordinates | chart dependent |
| Gamma | Levi-Civita connection | chart dependent |

**Assumptions**

- Freely falling structureless test object, or geometric-optics null ray, with negligible self-force.
- Parameter is affine; a general reparameterization adds a tangent term.

**Derivation.** Use the quadratic geodesic Lagrangian one half g_munu xdot^mu xdot^nu. Its Euler–Lagrange equation yields a metric multiplying acceleration plus derivatives of the metric. Contract with the inverse metric and collect the symmetric velocity product into Gamma. Proper-time normalization fixes timelike tangent norm; null trajectories instead use a suitable affine parameter.

**Worked check.** With a constant Minkowski metric, Gamma=0 and the equation gives straight worldlines x^mu=A^mu lambda+B^mu. In polar coordinates the same straight path has nonzero radial/angular coordinate accelerations that cancel the connection terms.

**Limits and common mistakes**

- A rocket, charged particle under electromagnetic force, or pressure-supported fluid element is not generally geodesic.
- Setting coordinate acceleration to zero is not a coordinate-invariant definition of free fall.

**Sources:** [David Tong: Geodesics in Spacetime](https://www.damtp.cam.ac.uk/user/tong/gr/grhtml/S1.html)

<a id="pf-curvature"></a>

### Curvature and geodesic deviation

$$
R^\rho{}_{\sigma\mu\nu}=\partial_\mu\Gamma^\rho_{\nu\sigma}-\partial_\nu\Gamma^\rho_{\mu\sigma}+\Gamma^\rho_{\mu\alpha}\Gamma^\alpha_{\nu\sigma}-\Gamma^\rho_{\nu\alpha}\Gamma^\alpha_{\mu\sigma},\qquad \frac{D^2\xi^\rho}{d\tau^2}=R^\rho{}_{\sigma\mu\nu}u^\sigma u^\mu\xi^\nu
$$

**ID:** `pf-curvature`

| Symbol | Meaning | Unit |
|---|---|---|
| R | Riemann curvature; [nabla_mu,nabla_nu]V^rho=R^rho_sigma mu nu V^sigma | m^-2 in length coordinates |
| u | four-velocity | m s^-1 in length coordinates |
| xi | infinitesimal separation | m |
| tau | proper time | s |
| Gamma | Levi-Civita connection components | m^-1 in all-length coordinates |
| D/dtau | covariant derivative along the worldline | s^-1 acting on a transported quantity |

**Assumptions**

- Nearby freely falling timelike geodesics form a smooth family; linear separation approximation.
- The displayed Riemann sign and index order define the convention.

**Derivation.** Compute the commutator of two covariant derivatives; second derivatives of the vector cancel, leaving derivative and quadratic connection terms. For a family with commuting tangent and separation fields, exchange covariant derivatives and use Du/dτ=0. This produces relative acceleration proportional to curvature and separation. The right side has m/s², as an acceleration must.

**Worked check.** In a weak static field the spatial equation reduces to xi_ddot^i≈-partial_i partial_j Phi xi^j. For Phi=-GM/r, radial neighbors separate with coefficient +2GM/r³ while two transverse separations contract with coefficient -GM/r³.

**Limits and common mistakes**

- Other books reverse Riemann's sign or index order; equations must be translated together.
- Local removal of Gamma does not remove Riemann curvature or finite-size tidal effects.

**Sources:** [David Tong: Introducing Riemannian Geometry](https://www.damtp.cam.ac.uk/user/tong/gr/grhtml/S3.html); [David Tong: When Gravity is Weak](https://www.damtp.cam.ac.uk/user/tong/gr/grhtml/S5.html)

<a id="pf-einstein"></a>

### Einstein field equations and local conservation

$$
G_{\mu\nu}+\Lambda g_{\mu\nu}=\frac{8\pi G}{c^4}T_{\mu\nu},\qquad G_{\mu\nu}=R_{\mu\nu}-\frac12Rg_{\mu\nu},\qquad \nabla^\mu T_{\mu\nu}=0
$$

**ID:** `pf-einstein`

| Symbol | Meaning | Unit |
|---|---|---|
| G_munu | Einstein tensor | m^-2 in length coordinates |
| Lambda | cosmological constant | m^-2 |
| T_munu | stress-energy components in orthonormal frame | J m^-3 |
| R | Ricci scalar | m^-2 |
| c | vacuum light speed | m s^-1 |
| G | Newton gravitational constant | m^3 kg^-1 s^-2 |
| g_munu | metric tensor components | dimensionless in all-length coordinates |
| R_munu | Ricci tensor, contraction of Riemann curvature | m^-2 in all-length coordinates |

**Assumptions**

- Classical general relativity with the declared curvature/signature convention.
- Matter equations and boundary/initial constraints must accompany the field equations.

**Derivation.** The contracted Bianchi identity gives divergence-free G. For constant Lambda the metric term also has zero covariant divergence, requiring compatible matter conservation. The coefficient is fixed by the weak, slowly varying, nonrelativistic limit recovering ∇²Phi=4piG rho_m. This is a nonlinear coupled PDE system because inverse metrics and products of metric derivatives appear in curvature.

**Worked check.** Dimensional check: G/c⁴ has units s²/(kg m); multiplication by T in kg/(m s²) gives m^-2. Vacuum T=0 does not force all Riemann components to vanish: the Schwarzschild exterior remains curved.

**Limits and common mistakes**

- Covariant local conservation does not imply one coordinate-independent globally conserved total energy in every cosmology.
- Solving only one component without constraints or gauge control can produce spurious configurations.

**Sources:** [David Tong: The Einstein Equations](https://www.damtp.cam.ac.uk/user/tong/gr/grhtml/S4.html); [David Tong: When Gravity is Weak](https://www.damtp.cam.ac.uk/user/tong/gr/grhtml/S5.html)

<a id="pf-einstein-action"></a>

### Einstein–Hilbert action

$$
S=\frac{c^3}{16\pi G}\int d^4x\,\sqrt{-g}\,(R-2\Lambda)+S_m+S_{\partial},\qquad x^0=ct
$$

**ID:** `pf-einstein-action`

| Symbol | Meaning | Unit |
|---|---|---|
| S,S_m,S_boundary | total, matter and necessary boundary actions | J s |
| g | determinant of metric | dimensionless in length coordinates |
| R,Lambda | curvature scalar and cosmological constant | m^-2 |
| d^4x | coordinate volume for all-length chart | m^4 |
| G | Newton gravitational constant | m^3 kg^-1 s^-2 |
| c | vacuum speed of light | m s^-1 |
| x^mu | spacetime coordinates including x^0=ct | m |
| t | coordinate time | s |

**Assumptions**

- Metric formulation, torsion-free connection, appropriate fixed boundary data.
- S_boundary includes the term needed for a well-posed metric boundary variation when a boundary is present.

**Derivation.** Vary the inverse metric. The determinant contributes minus one half sqrt(-g) g_munu delta g^munu. The curvature variation contributes Ricci contraction plus a total divergence. After a compatible boundary treatment and definition of the stress tensor by variation of Sm, stationarity yields the Einstein equations. This organizes the derivation but is not a substitute for specifying the matter action.

**Worked check.** c³/G has units kg/s. The curvature integral has m², so the action has kg m²/s. If instead time is integrated as dt, an extra c arises from d(ct), explaining otherwise confusing c³ versus c⁴ prefactors.

**Limits and common mistakes**

- Dropping boundary terms while varying unrestricted boundary derivatives is invalid.
- Additional higher-curvature operators describe different effective theories and can change field equations.

**Sources:** [David Tong: The Einstein Equations](https://www.damtp.cam.ac.uk/user/tong/gr/grhtml/S4.html)

<a id="pf-schwarzschild"></a>

### Schwarzschild exterior and horizon scale

$$
ds^2=-\left(1-\frac{r_s}{r}\right)c^2dt^2+\left(1-\frac{r_s}{r}\right)^{-1}dr^2+r^2d\Omega^2,\qquad r_s=\frac{2GM}{c^2}
$$

**ID:** `pf-schwarzschild`

| Symbol | Meaning | Unit |
|---|---|---|
| r_s | Schwarzschild radius | m |
| M | mass parameter | kg |
| r | areal radius: spheres have area 4pi r² | m |
| t | static exterior time coordinate | s |
| dOmega² | unit-sphere metric | 1 |
| G | Newton gravitational constant | m^3 kg^-1 s^-2 |
| c | vacuum speed of light | m s^-1 |
| ds^2 | signed infinitesimal spacetime interval squared | m^2 |

**Assumptions**

- Spherically symmetric vacuum region, Lambda=0; exterior chart r>r_s.
- A material star may end outside r_s; its interior is not this vacuum solution.

**Derivation.** Spherical symmetry permits two radial metric functions. Vacuum equations plus asymptotic normalization fix them to reciprocal factors 1-2GM/(c²r). The weak-field expansion g00≈-(1+2Phi/c²) identifies M. The coordinate coefficient diverges at r_s, but curvature invariants are finite there for nonzero mass; a regular horizon-crossing chart separates horizon geometry from chart breakdown.

**Worked check.** For M=1.98847e30 kg, r_s≈2.953 km. At r=10r_s the static clock factor is sqrt(0.9), whereas treating r_s itself as an ordinary static observer location fails.

**Limits and common mistakes**

- Astrophysical spin requires Kerr rather than this one-parameter metric.
- The Schwarzschild coordinate singularity and central curvature singularity are different phenomena.

**Sources:** [David Tong: Black Holes](https://www.damtp.cam.ac.uk/user/tong/gr/grhtml/S6.html); [NIST CODATA fundamental physical constants (2022 adjustment)](https://physics.nist.gov/cuu/Constants/)

<a id="pf-redshift"></a>

### Static gravitational frequency comparison

$$
\frac{\nu_r}{\nu_e}=\sqrt{\frac{1-r_s/r_e}{1-r_s/r_r}},\qquad \frac{\Delta\nu}{\nu}\simeq\frac{\Phi_e-\Phi_r}{c^2}
$$

**ID:** `pf-redshift`

| Symbol | Meaning | Unit |
|---|---|---|
| nu_e,nu_r | locally measured emitted/received frequencies | Hz |
| r_e,r_r | static emitter/receiver areal radii | m |
| Phi_e,Phi_r | weak-field potentials | m^2 s^-2 |
| c | vacuum speed of light | m s^-1 |
| r_s | Schwarzschild radius 2GM/c^2 | m |
| Delta_nu,nu | received-minus-emitted frequency and emitted reference frequency in the weak expression | Hz |

**Assumptions**

- Static observers and a photon in Schwarzschild exterior; no extra Doppler motion.
- Second expression assumes potential differences and velocities are small relative to relativistic scales.

**Derivation.** Stationary geometry conserves photon energy associated with the time-translation Killing field. A static observer normalizes their four-velocity by the local lapse sqrt(1-r_s/r), so measured frequency is conserved coordinate energy divided by that lapse. The ratio gives the expression; expansion to first order gives the potential difference. Frequency increases during descent into lower potential.

**Worked check.** If a photon rises by h in a nearly uniform field g, Phi_r-Phi_e≈gh and its fractional frequency change is -gh/c². For h=1 m and g=9.81 m/s² this is about -1.09e-16.

**Limits and common mistakes**

- The observer trajectory is essential; there is no universal photon frequency independent of observer.
- Clock stability at this scale is not sufficient to infer height without controlling clock systematic shifts.

**Sources:** [David Tong: Geodesics in Spacetime](https://www.damtp.cam.ac.uk/user/tong/gr/grhtml/S1.html); [A thorium-229 optical nuclear clock with feedback loop](https://www.nature.com/articles/s41586-026-11084-4)

<a id="pf-weak-orbit-tests"></a>

### Weak-field light deflection and perihelion advance

$$
\alpha\simeq\frac{4GM}{bc^2},\qquad \Delta\varpi\simeq\frac{6\pi GM}{a(1-e^2)c^2}\quad\text{per orbit}
$$

**ID:** `pf-weak-orbit-tests`

| Symbol | Meaning | Unit |
|---|---|---|
| alpha | total light deflection | rad |
| b | asymptotic impact parameter | m |
| Delta_varpi | perihelion advance | rad per orbit |
| a | semimajor axis | m |
| e | eccentricity | 1 |
| G | Newton gravitational constant | m^3 kg^-1 s^-2 |
| c | vacuum speed of light | m s^-1 |
| M | central source mass | kg |

**Assumptions**

- Weak-field Schwarzschild propagation; b≫r_s and bound orbit far from strong-field instability.
- Source and observer effectively far away for the displayed deflection.

**Derivation.** Insert conserved energy/angular momentum into the null or timelike geodesic equation. With u=1/r, the extra Schwarzschild term is proportional to GM u²/c². Perturb around a straight null path for deflection and a Kepler ellipse for apsidal advance. The perturbed orbital cosine accumulates a small phase shift, giving the quoted advance.

**Worked check.** For a circular-limit orbit at a=1000r_s, advance is approximately 3pi/1000≈0.00942 radians per orbit. Light with b=1000r_s bends by about 0.002 radians. These values are small enough for a first-order illustration, not precision inference.

**Limits and common mistakes**

- The near-circular expression is a limit; a perfectly circular orbit has no distinguished perihelion.
- Strong deflection, spin, quadrupole moments and extended lenses require more complete models.

**Sources:** [David Tong: Geodesics in Spacetime](https://www.damtp.cam.ac.uk/user/tong/gr/grhtml/S1.html)

<a id="pf-gw-strain"></a>

### Leading quadrupole gravitational-wave strain

$$
h_{ij}^{\mathrm{TT}}(t,\mathbf x)=\frac{2G}{c^4R}\,\ddot Q_{ij}^{\mathrm{TT}}(t-R/c),\qquad Q_{ij}=\int\rho_m\left(x_ix_j-\frac13r^2\delta_{ij}\right)d^3x
$$

**ID:** `pf-gw-strain`

| Symbol | Meaning | Unit |
|---|---|---|
| h_TT | transverse traceless wave strain | 1 |
| Q_ij | trace-free mass quadrupole | kg m^2 |
| R | observer-source distance | m |
| rho_m | source mass density | kg m^-3 |
| G | Newton gravitational constant | m^3 kg^-1 s^-2 |
| c | vacuum speed of light | m s^-1 |
| t | time; overdots denote time derivatives in this card | s |
| x_i,r | source Cartesian coordinates and their magnitude relative to the chosen origin | m |
| delta_ij | Kronecker delta | 1 |
| TT | transverse traceless projection relative to the outgoing direction | projection label |

**Assumptions**

- Weak, slow source and wave-zone observation R much larger than wavelength and source size.
- TT projection is with respect to propagation direction; retarded time is essential.

**Derivation.** Solve the linearized Einstein wave equation with a retarded Green function. Stress-energy conservation converts the leading spatial stress integral to half the second time derivative of the mass moment. Project transverse to the outgoing ray and remove its trace. Conserved monopole and center-of-mass motion cannot provide the leading gravitational radiation term.

**Worked check.** Units: G Qddot/(c⁴R) is dimensionless. If Qij is constant or varies only linearly in time, this leading waveform vanishes. A nonspherical rotating mass distribution can have Q oscillating at twice the orbital frequency.

**Limits and common mistakes**

- The formula does not accurately model merger/ringdown strong-field dynamics.
- A nonzero coordinate metric perturbation alone is not a measured strain; detector response and gauge-invariant tidal effect matter.

**Sources:** [David Tong: When Gravity is Weak](https://www.damtp.cam.ac.uk/user/tong/gr/grhtml/S5.html)

<a id="pf-gw-power"></a>

### Quadrupole luminosity and circular binary loss

$$
P=\frac{G}{5c^5}\left\langle\dddot Q_{ij}\dddot Q_{ij}\right\rangle,\qquad P_{\mathrm{circ}}=\frac{32G^4\mu^2 M_T^3}{5c^5r^5},\quad M_T=m_1+m_2
$$

**ID:** `pf-gw-power`

| Symbol | Meaning | Unit |
|---|---|---|
| P | radiated power | W |
| Q_ij | trace-free quadrupole defined in pf-gw-strain | kg m^2 |
| mu | reduced mass m1 m2/(m1+m2) | kg |
| M_T | total mass | kg |
| r | binary separation | m |
| G | Newton gravitational constant | m^3 kg^-1 s^-2 |
| c | vacuum speed of light | m s^-1 |
| t | time; overdots denote time derivatives in this card | s |
| m_1,m_2 | individual body masses | kg |
| P_circ | cycle-averaged circular-binary luminosity in this approximation | W |

**Assumptions**

- Slow-motion weak-field quadrupole approximation; circular binary formula averages over an orbit.
- Repeated spatial indices are summed and the quadrupole normalization is the trace-free convention above.

**Derivation.** Compute outgoing gravitational-wave energy flux and integrate over directions; the angular projection supplies the factor one fifth. For a circular binary, substitute positions relative to the center of mass into Q, differentiate three times and use Kepler omega²=GM_T/r³. Radiated power is positive, so orbital energy changes as dE_orb/dt=-P to this order.

**Worked check.** At fixed masses halving separation multiplies the circular quadrupole luminosity by 32. The Newtonian binding energy simultaneously becomes more negative. This scaling explains accelerating chirp qualitatively, while late merger needs a relativistic waveform.

**Limits and common mistakes**

- Some texts define a quadrupole three times larger, changing the prefactor by nine.
- Catalog tests compare full inference models rather than this leading formula alone.

**Sources:** [David Tong: When Gravity is Weak](https://www.damtp.cam.ac.uk/user/tong/gr/grhtml/S5.html); [LIGO–Virgo–KAGRA: GWTC-5.0 — Tests of General Relativity](https://arxiv.org/abs/2607.19293)

<a id="pf-friedmann"></a>

### Friedmann expansion and fluid conservation

$$
H^2=\frac{8\pi G}{3}\rho_m-\frac{kc^2}{a^2}+\frac{\Lambda c^2}{3},\qquad H=\frac{\dot a}{a},\qquad \dot\rho_m+3H\left(\rho_m+\frac p{c^2}\right)=0
$$

**ID:** `pf-friedmann`

| Symbol | Meaning | Unit |
|---|---|---|
| a | scale factor in this length-valued convention | m |
| k | spatial curvature sign -1,0,+1 | 1 |
| H | Hubble expansion rate | s^-1 |
| rho_m | energy density divided by c² | kg m^-3 |
| p | isotropic pressure | Pa |
| G | Newton gravitational constant | m^3 kg^-1 s^-2 |
| c | vacuum speed of light | m s^-1 |
| t | time; overdots denote time derivatives in this card | s |
| Lambda | cosmological constant, not double-counted in rho_m | m^-2 |

**Assumptions**

- FLRW homogeneous/isotropic background with a perfect fluid.
- Lambda is displayed separately and must not also be double-counted inside rho_m.

**Derivation.** Insert the FLRW metric and isotropic stress tensor into the time-time Einstein equation. Covariant matter conservation yields the continuity equation, also expressible as d(rho_m c² a³)=-p d(a³) for a comoving volume. Spatial curvature acts through the metric rather than as a material fluid. A dimensionless alternative scale factor moves units into k; conventions cannot be mixed.

**Worked check.** For k=Lambda=0 and pressureless matter, rho_m∝a^-3. Substitution into H² gives a∝t^(2/3). Radiation instead gives a∝t^(1/2). Both imply declining H in those idealized eras.

**Limits and common mistakes**

- The background equations do not predict perturbation spectra or identify the dark-matter particle.
- Fitting evolving dark energy requires an explicit dataset, likelihood and alternative-model parameterization.

**Sources:** [David Tong: Cosmology — The Expanding Universe](https://davidtong.org/teaching/cosmology/cosmohtml/S1.html); [David Tong: The Einstein Equations](https://www.damtp.cam.ac.uk/user/tong/gr/grhtml/S4.html); [DESI DR2 Results IV: Alcock–Paczyński Measurements from the Lyman Alpha Forest and Cosmological Constraints](https://arxiv.org/html/2607.27410v3)

<a id="pf-equation-state"></a>

### Equation-of-state density scaling and acceleration

$$
p=w\rho_m c^2\Rightarrow\rho_m\propto a^{-3(1+w)},\qquad \frac{\ddot a}{a}=-\frac{4\pi G}{3}\left(\rho_m+\frac{3p}{c^2}\right)+\frac{\Lambda c^2}{3}
$$

**ID:** `pf-equation-state`

| Symbol | Meaning | Unit |
|---|---|---|
| w | constant equation-of-state parameter | 1 |
| rho_m | mass-equivalent energy density | kg m^-3 |
| a | scale factor | m in chosen convention |
| p | pressure | Pa |
| G | Newton gravitational constant | m^3 kg^-1 s^-2 |
| c | vacuum speed of light | m s^-1 |
| t | time; overdots denote time derivatives in this card | s |
| Lambda | cosmological constant displayed separately from fluid density | m^-2 |

**Assumptions**

- Each component is separately conserved and has constant w for the simple power law.
- Classical homogeneous/isotropic GR background.

**Derivation.** Divide fluid conservation by rho_m and write H=adot/a. Integrating dln rho_m=-3(1+w)dln a gives the scaling. Combining the spatial Einstein equation with the time-time equation gives acceleration. With Lambda absent, a positive-density component accelerates expansion only when rho_m+3p/c² is negative, or w<-1/3.

**Worked check.** Matter w=0 dilutes as volume^-1; radiation w=1/3 has an extra factor a^-1 from photon redshift; vacuum-like w=-1 stays constant. These are distinct equations of state, not frequencies assigned to substances.

**Limits and common mistakes**

- A variable w(a) requires an exponential integral rather than this constant power.
- Evidence for an effective fitted w differs from a derivation of a fundamental microscopic field.

**Sources:** [David Tong: Cosmology — The Expanding Universe](https://davidtong.org/teaching/cosmology/cosmohtml/S1.html); [DESI DR2 Results IV: Alcock–Paczyński Measurements from the Lyman Alpha Forest and Cosmological Constraints](https://arxiv.org/html/2607.27410v3)

<a id="pf-hawking"></a>

### Schwarzschild Hawking temperature and area entropy

$$
T_H=\frac{\hbar c^3}{8\pi GMk_B},\qquad S_{\mathrm{BH}}=\frac{k_B A}{4\ell_P^2},\qquad \ell_P^2=\frac{\hbar G}{c^3},\quad A=4\pi r_s^2
$$

**ID:** `pf-hawking`

| Symbol | Meaning | Unit |
|---|---|---|
| T_H | Hawking temperature measured relative to asymptotic time | K |
| S_BH | Bekenstein–Hawking entropy | J K^-1 |
| hbar | reduced Planck constant | J s |
| k_B | Boltzmann constant | J K^-1 |
| ell_P | Planck length | m |
| G | Newton gravitational constant | m^3 kg^-1 s^-2 |
| c | vacuum speed of light | m s^-1 |
| M | Schwarzschild mass | kg |
| A | horizon area | m^2 |
| r_s | Schwarzschild radius 2GM/c^2 | m |

**Assumptions**

- Semiclassical quantum fields on an approximately stationary uncharged nonrotating black-hole background.
- Backreaction is slow and the mass is far above the Planck scale.

**Derivation.** The quantum-field mode-mixing calculation gives a thermal factor fixed by horizon surface gravity. For Schwarzschild the corresponding temperature scales inversely with mass. Inserting T_H into dS=d(Mc²)/T and integrating yields S proportional to M², equivalent to the area expression. This thermodynamic consistency check is not a replacement for the quantum-field derivation.

**Worked check.** A solar-mass Schwarzschild hole has T_H≈6.17e-8 K. Doubling mass halves its temperature and quadruples its area entropy. The sign of dT/dM gives negative heat capacity for an isolated asymptotically flat hole.

**Limits and common mistakes**

- These equations do not determine the endpoint of evaporation or resolve the information problem.
- They are theoretical semiclassical predictions; analogue-system measurements are not direct observations of astrophysical Hawking radiation.

**Sources:** [Hawking: Particle creation by black holes](https://authors.library.caltech.edu/records/2wsvj-qrt68); [David Tong: Black Holes](https://www.damtp.cam.ac.uk/user/tong/gr/grhtml/S6.html); [NIST CODATA fundamental physical constants (2022 adjustment)](https://physics.nist.gov/cuu/Constants/)

<a id="pf-bootstrap"></a>

### Reported leading spinless modular-bootstrap slope

$$
\Lambda_V=\frac{12\pi^2}{\pi^2+4\operatorname{arsinh}^2(1)}\approx9.1266,\qquad \Delta_1\le\frac{c_{\mathrm{CFT}}}{\Lambda_V}+o(c_{\mathrm{CFT}})
$$

**ID:** `pf-bootstrap`

| Symbol | Meaning | Unit |
|---|---|---|
| Lambda_V | reported optimal leading coefficient for the admissible class A-bar of Definition 2.5 | 1 |
| c_CFT | CFT central charge, not speed of light | 1 |
| Delta_1 | lowest non-vacuum Virasoro-primary scaling dimension; primaries of all spins are included | 1 |

**Assumptions**

- Cited November 2026 preprint's unitary compact 2D CFT assumptions: central charge above one and no additional currents beyond Virasoro.
- Spinless means zero-angular-potential modular-S data, summing Virasoro primaries of all spins by scaling dimension; it does not restrict the spectrum to spin-zero operators.
- Optimality is for the admissible class A-bar in Definition 2.5, which contains all finite derivative functionals; large-central-charge asymptotics.

**Derivation.** The cited work constructs upper bounds and obstructions using a complex-analytic potential built from zeros. Theorem 1 and Corollary 6 are computer-assisted; Appendix H supplies interval inequalities. We inspected the statement, admissible-class definition and scope discussion, not the complete proof or its computational certificate. Algebraically, arsinh(1)=log(1+sqrt(2)), so the slope is approximately 0.10957. A logarithmic potential encodes polynomial zero distributions through a two-dimensional Poisson identity.

**Worked check.** At c_CFT=1000 the leading term alone is about 109.57. It is not a rigorous finite-c upper bound by itself because the subleading term remains. Keeping only a leading asymptotic number can invert a close comparison.

**Limits and common mistakes**

- Equality between the optimum over A-bar and the P-to-infinity finite-derivative bootstrap bound is explicitly conjectural in Section 2.6.
- A bound on a restricted bootstrap method is not existence of a CFT attaining it.
- This is a preprint-result report with stated provenance, not our verified proof and not a complete solution of quantum gravity.

**Sources:** [The spinless modular bootstrap at large central charge](https://hexagonmath.org/2611.00174v1)

## magnetism

<a id="pf-continuity"></a>

### Charge continuity

$$
\frac{\partial\rho}{\partial t}+\nabla\cdot\mathbf J=0
$$

**ID:** `pf-continuity`

| Symbol | Meaning | Unit |
|---|---|---|
| rho | charge density | C/m^3 |
| J | current density | A/m^2 |
| t | time | s |

**Assumptions**

- Local charge conservation and differentiable/coarse-grained fields, or distributional interpretation.

**Derivation.** Charge in a fixed region changes by minus outward current through its boundary. The divergence theorem converts that integral balance into the local equation. Taking divergence of Maxwell–Ampère and using Gauss gives the same identity, which explains why the displacement-current term is necessary.

**Worked check.** If current enters a capacitor plate at 2 mA and does not leave through conduction, charge grows at 2 microcoulombs per millisecond. The gap's changing electric flux preserves Maxwell–Ampère consistency.

**Limits and common mistakes**

- Steady current requires divergence-free J, not necessarily a spatially uniform J.
- A charge density can be stationary while charges continuously flow.

**Sources:** [The Feynman Lectures on Physics: Magnetostatics](https://www.feynmanlectures.caltech.edu/II_13.html); [The Feynman Lectures on Physics: Electrostatics](https://www.feynmanlectures.caltech.edu/II_04.html)

<a id="pf-lorentz"></a>

### Lorentz force and magnetic work

$$
\mathbf F=q(\mathbf E+\mathbf v\times\mathbf B),\qquad \mathbf F_B\cdot\mathbf v=0
$$

**ID:** `pf-lorentz`

| Symbol | Meaning | Unit |
|---|---|---|
| F | force | N |
| q | charge | C |
| E | electric field | V/m |
| v | velocity | m/s |
| B | magnetic flux density | T |
| F_B | magnetic contribution q v cross B to force | N |

**Assumptions**

- Classical point-particle force law for prescribed fields.
- Radiation reaction and quantum spin coupling are separate effects.

**Derivation.** The magnetic cross product is perpendicular to v; dotting the equation with v leaves power q E dot v. A magnetic field can redirect motion and transmit forces while energy exchange in a complete electromechanical device is tracked through electric fields, moving sources and field energy.

**Worked check.** For q=1 C, speed 2 m/s and perpendicular B=3 T, magnetic force magnitude is 6 N. If motion becomes parallel to B the force vanishes despite nonzero field.

**Limits and common mistakes**

- Zero magnetic work on an ideal point charge does not mean a motor cannot do work.
- Use relativistic momentum at high velocities.

**Sources:** [The Feynman Lectures on Physics: Magnetostatics](https://www.feynmanlectures.caltech.edu/II_13.html); [The Feynman Lectures on Physics: Field Energy and Field Momentum](https://www.feynmanlectures.caltech.edu/II_27.html)

<a id="pf-biot-savart"></a>

### Biot–Savart magnetic field

$$
\mathbf B(\mathbf r)=\frac{\mu_0}{4\pi}\int \frac{\mathbf J(\mathbf r')\times(\mathbf r-\mathbf r')}{|\mathbf r-\mathbf r'|^3}\,d^3r'
$$

**ID:** `pf-biot-savart`

| Symbol | Meaning | Unit |
|---|---|---|
| B | magnetic field | T |
| J | steady current density | A/m^2 |
| r,r' | positions | m |
| mu_0 | vacuum permeability | H/m |

**Assumptions**

- Steady localized divergence-free currents in vacuum; adequate decay at infinity.

**Derivation.** In Coulomb gauge the magnetostatic vector potential solves Laplacian A=-mu_0 J. Inverting with the Coulomb kernel and taking curl yields Biot–Savart. A thin wire replaces J dV by I dl, preserving orientation of the cross product.

**Worked check.** For an infinite straight wire, angular integration gives B=mu_0 I/(2 pi r). A 1 A current at 1 cm gives approximately 20 microtesla.

**Limits and common mistakes**

- A finite isolated wire segment cannot carry a truly steady current without a return path.
- Retarded electrodynamics is required when changes propagate over relevant timescales.

**Sources:** [The Feynman Lectures on Physics: Magnetostatics](https://www.feynmanlectures.caltech.edu/II_13.html); [The Feynman Lectures on Physics: The Vector Potential](https://www.feynmanlectures.caltech.edu/II_15.html)

<a id="pf-ampere"></a>

### Ampère and Maxwell–Ampère laws

$$
\nabla\times\mathbf B=\mu_0\mathbf J+\mu_0\varepsilon_0\frac{\partial\mathbf E}{\partial t},\qquad \oint\mathbf B\cdot d\mathbf l=\mu_0I_{\mathrm{enc}}\ \text{in steady vacuum}
$$

**ID:** `pf-ampere`

| Symbol | Meaning | Unit |
|---|---|---|
| B | magnetic field | T |
| J | current density | A/m^2 |
| E | electric field | V/m |
| I_enc | enclosed current | A |
| mu_0 | permeability | H/m |
| epsilon_0 | permittivity | F/m |
| t | time | s |
| dl | oriented line element along the circulation path | m |

**Assumptions**

- Vacuum macroscopic source description; steady integral form omits displacement only when time derivative vanishes.

**Derivation.** Stokes's theorem converts circulation into curl flux. The displacement term makes divergence of the right side vanish when continuity and Gauss hold. In matter one may use H and D with free sources, but that requires consistent constitutive definitions.

**Worked check.** For a long solenoid with n turns per meter and current I, neglect exterior/fringing field to obtain B approximately mu_0 n I. With n=1000/m and I=0.1 A this is about 0.126 mT.

**Limits and common mistakes**

- The law is exact in its regime; easy extraction of B needs symmetry.
- Dropping displacement current can fail even in a capacitor with no conduction across its gap.

**Sources:** [The Feynman Lectures on Physics: Electrostatics](https://www.feynmanlectures.caltech.edu/II_04.html); [The Feynman Lectures on Physics: Magnetostatics](https://www.feynmanlectures.caltech.edu/II_13.html)

<a id="pf-vector-potential"></a>

### Vector potential and gauge change

$$
\mathbf B=\nabla\times\mathbf A,\quad\mathbf E=-\nabla\phi-\partial_t\mathbf A,\quad\mathbf A'=\mathbf A+\nabla\chi,\quad\phi'=\phi-\partial_t\chi
$$

**ID:** `pf-vector-potential`

| Symbol | Meaning | Unit |
|---|---|---|
| A | vector potential | T m |
| B | magnetic field | T |
| E | electric field | V/m |
| phi | scalar potential | V |
| chi | gauge function | V s |
| t | time | s |
| A_prime | gauge-transformed vector potential | T m |
| phi_prime | gauge-transformed scalar potential | V |

**Assumptions**

- Locally smooth potentials on a suitable patch; global topology may require overlapping patches.

**Derivation.** Curl of a gradient is zero, so B is unchanged. In E, minus grad partial_t chi cancels plus grad partial_t chi when mixed derivatives commute. A gauge condition is a representation choice, while observables are unchanged.

**Worked check.** A constant uniform B along z admits symmetric gauge A=(-By/2,Bx/2,0) and Landau gauge A=(0,Bx,0); their difference is a gradient and both produce the same curl.

**Limits and common mistakes**

- Gauge freedom is not additional extractable physical energy.
- A globally nontrivial loop can retain physical phase information even where local field vanishes.

**Sources:** [The Feynman Lectures on Physics: The Vector Potential](https://www.feynmanlectures.caltech.edu/II_15.html); [The Feynman Lectures III.21: A Seminar on Superconductivity](https://www.feynmanlectures.caltech.edu/III_21.html)

<a id="pf-dipole-torque"></a>

### Magnetic dipole moment, torque and interaction

$$
\boldsymbol\mu=I A\mathbf n,\qquad\boldsymbol\tau=\boldsymbol\mu\times\mathbf B,\qquad U_{\mathrm{int}}=-\boldsymbol\mu\cdot\mathbf B
$$

**ID:** `pf-dipole-torque`

| Symbol | Meaning | Unit |
|---|---|---|
| mu | magnetic moment | A m^2 |
| I | loop current | A |
| A | loop area | m^2 |
| n | normal by right-hand rule | 1 |
| tau | torque | N m |
| B | external field | T |
| U_int | effective dipole interaction energy | J |

**Assumptions**

- Small loop in approximately uniform external B, or permanent dipole with fixed moment.
- For externally maintained current loops, source work is included in the effective mechanical potential convention.

**Derivation.** Add Lorentz forces on loop elements. Uniform-field forces cancel in translation but their moments add to the cross-product torque. Integrating angular work gives minus mu B cos theta for the effective orientation potential.

**Worked check.** A 0.1 A loop of area 0.01 m squared has moment 0.001 A m squared. Perpendicular to a 0.2 T field, its torque is 0.0002 N m.

**Limits and common mistakes**

- Effective mechanical interaction energy is not necessarily the complete field-plus-power-supply energy.
- Spatially varying fields require force gradients and possibly higher multipoles.

**Sources:** [The Feynman Lectures on Physics: The Vector Potential](https://www.feynmanlectures.caltech.edu/II_15.html)

<a id="pf-faraday"></a>

### Faraday induction including moving circuits

$$
\mathcal E=\oint_{C(t)}(\mathbf E+\mathbf u\times\mathbf B)\cdot d\mathbf l=-\frac{d}{dt}\int_{S(t)}\mathbf B\cdot d\mathbf A
$$

**ID:** `pf-faraday`

| Symbol | Meaning | Unit |
|---|---|---|
| emf | electromotive force | V |
| E | electric field | V/m |
| u | circuit-element velocity | m/s |
| B | magnetic field | T |
| A | oriented area | m^2 |
| t | time | s |
| C(t) | oriented moving closed circuit | curve with arc length in m |
| S(t) | moving surface spanning C(t) | surface with area measure m^2 |
| dl | oriented circuit line element | m |

**Assumptions**

- Smooth moving closed circuit and compatible moving surface; orientations obey Stokes's convention.

**Derivation.** The local Maxwell law gives curl E=-partial_t B for a stationary loop. A moving boundary sweeps magnetic flux; its transport term is the motional u cross B contribution. Combining both yields the total derivative of flux and avoids attributing every emf to the same mechanism.

**Worked check.** A rod of length 0.2 m moving at 3 m/s perpendicular to a 0.5 T field produces emf B L u=0.3 V in a compatible sliding-loop geometry.

**Limits and common mistakes**

- The circuit's motion must be distinguished from the charge's drift velocity.
- Flux rule signs depend on orientation, not a verbal preference for positive current.

**Sources:** [The Feynman Lectures on Physics: The Laws of Induction](https://www.feynmanlectures.caltech.edu/II_17.html)

<a id="pf-inductor"></a>

### Inductance and stored energy

$$
\Psi=LI,\qquad V_L=L\frac{dI}{dt},\qquad U_L=\tfrac12 LI^2
$$

**ID:** `pf-inductor`

| Symbol | Meaning | Unit |
|---|---|---|
| Psi | flux linkage | Wb |
| L | inductance | H |
| I | current | A |
| V_L | passive-sign inductor voltage | V |
| U_L | stored energy | J |
| t | time | s |

**Assumptions**

- Fixed linear geometry with constant L, negligible hysteresis and radiation.
- Passive voltage/current sign convention.

**Derivation.** Induced emf opposes changing flux; with passive circuit sign convention the terminal voltage is L dI/dt. Integrate power V I over the charging trajectory: integral L I dI gives half L I squared. Nonlinear inductors instead require integrating their actual flux-linkage relation.

**Worked check.** A 10 mH inductor at 2 A stores 0.020 J. Raising current linearly at 100 A/s requires 1 V across the ideal inductive component.

**Limits and common mistakes**

- A nonlinear core can make L current dependent.
- Real coil resistance and core losses require extra energy terms.

**Sources:** [The Feynman Lectures on Physics: The Laws of Induction](https://www.feynmanlectures.caltech.edu/II_17.html); [The Feynman Lectures on Physics: Field Energy and Field Momentum](https://www.feynmanlectures.caltech.edu/II_27.html)

<a id="pf-maxwell"></a>

### Vacuum Maxwell equations

$$
\nabla\cdot\mathbf E=\rho/\varepsilon_0,\quad\nabla\cdot\mathbf B=0,\quad\nabla\times\mathbf E=-\partial_t\mathbf B,\quad\nabla\times\mathbf B=\mu_0\mathbf J+\mu_0\varepsilon_0\partial_t\mathbf E
$$

**ID:** `pf-maxwell`

| Symbol | Meaning | Unit |
|---|---|---|
| E | electric field | V/m |
| B | magnetic field | T |
| rho | charge density | C/m^3 |
| J | current density | A/m^2 |
| epsilon_0 | vacuum permittivity | F/m |
| mu_0 | vacuum permeability | H/m |
| t | time | s |

**Assumptions**

- Classical electromagnetic field theory with no magnetic monopole sources.

**Derivation.** The divergence equations constrain initial fields and the curl equations evolve them. Taking divergences shows the magnetic constraint is preserved and charge conservation preserves the electric constraint. Source-free curls combine into wave equations with c squared=1/(mu_0 epsilon_0).

**Worked check.** For a plane wave in vacuum, E and B are perpendicular to each other and propagation, with magnitudes E=c B. A 1 V/m wave therefore has B about 3.34 nT.

**Limits and common mistakes**

- Material response needs constitutive or microscopic dynamics.
- Maxwell theory alone does not determine charge trajectories or quantum particle creation.

**Sources:** [The Feynman Lectures on Physics: Electrostatics](https://www.feynmanlectures.caltech.edu/II_04.html); [The Feynman Lectures on Physics: Field Energy and Field Momentum](https://www.feynmanlectures.caltech.edu/II_27.html)

<a id="pf-poynting"></a>

### Poynting energy balance

$$
\partial_t u+\nabla\cdot\mathbf S=-\mathbf J\cdot\mathbf E,\quad u=\tfrac12\varepsilon_0 E^2+\frac{B^2}{2\mu_0},\quad \mathbf S=\frac{\mathbf E\times\mathbf B}{\mu_0}
$$

**ID:** `pf-poynting`

| Symbol | Meaning | Unit |
|---|---|---|
| u | field energy density | J/m^3 |
| S | energy flux density | W/m^2 |
| J | current density | A/m^2 |
| E | electric field | V/m |
| B | magnetic field | T |
| epsilon_0 | permittivity | F/m |
| mu_0 | permeability | H/m |
| t | time; overdots denote time derivatives in this card | s |

**Assumptions**

- Vacuum field-energy convention with all material current included in J.

**Derivation.** Dot Maxwell–Ampère with E and Faraday with B/mu_0, then subtract using div(E cross B)=B dot curl E-E dot curl B. Quadratic time derivatives collect into u, leaving work on charges as J dot E. Integrate over the full apparatus boundary to test any proposed energy gain.

**Worked check.** A driven resonator in periodic steady state has zero average stored-energy change, so average input equals dissipation plus delivered load power. Large internal circulating energy does not alter this balance.

**Limits and common mistakes**

- A measured voltage peak does not determine net power without phase and impedance.
- In dispersive media, material energy must be included explicitly.

**Sources:** [The Feynman Lectures on Physics: Field Energy and Field Momentum](https://www.feynmanlectures.caltech.edu/II_27.html)

<a id="pf-magnetization"></a>

### Magnetization and bound currents

$$
\mathbf B=\mu_0(\mathbf H+\mathbf M),\quad\mathbf J_b=\nabla\times\mathbf M,\quad\mathbf K_b=\mathbf M\times\mathbf n
$$

**ID:** `pf-magnetization`

| Symbol | Meaning | Unit |
|---|---|---|
| B | magnetic field | T |
| H | magnetic field intensity | A/m |
| M | magnetization | A/m |
| J_b | bound volume current | A/m^2 |
| K_b | bound surface current | A/m |
| n | outward normal | 1 |
| mu_0 | permeability | H/m |

**Assumptions**

- Macroscopic coarse-grained magnetic dipole description.

**Derivation.** Neighboring microscopic current loops cancel in a uniform interior, leaving surface circulation. Spatial variation leaves residual curl M in the bulk. Defining H=B/mu_0-M separates these bound currents from free ones in the static curl equation.

**Worked check.** A uniformly magnetized long cylinder along its axis has no bulk bound current but an azimuthal surface current. This is why a solenoid is a useful field analogy.

**Limits and common mistakes**

- Equivalent bound currents are a coarse-grained representation, not literal smooth microscopic wires.
- H and B differ in magnetic matter and their units differ.

**Sources:** [The Feynman Lectures on Physics: Ferromagnetism](https://www.feynmanlectures.caltech.edu/II_36.html); [The Feynman Lectures on Physics: Magnetic Materials](https://www.feynmanlectures.caltech.edu/II_37.html)

<a id="pf-paramagnet"></a>

### Independent spin-half paramagnet

$$
Z_1=2\cosh(\mu B/k_BT),\qquad M=n\mu\tanh(\mu B/k_BT)
$$

**ID:** `pf-paramagnet`

| Symbol | Meaning | Unit |
|---|---|---|
| Z_1 | one-spin partition function | 1 |
| mu | two-level moment magnitude | J/T |
| B | applied field | T |
| k_B | Boltzmann constant | J/K |
| T | temperature | K |
| M | magnetization magnitude | A/m |
| n | spin number density | 1/m^3 |

**Assumptions**

- Noninteracting two-state moments with energies -mu B and +mu B, in thermal equilibrium.
- Negligible self-field and exchange.

**Derivation.** Sum Boltzmann weights of the two Zeeman levels. The weighted mean moment is mu times the population difference, yielding tanh. For weak field expand tanh x approximately x, giving M approximately n mu squared B/(k_B T).

**Worked check.** If mu B/(k_B T)=0.01, magnetization is approximately 1% of its saturated value n mu. In the large positive-field/low-temperature limit it approaches n mu.

**Limits and common mistakes**

- This has no 1/3 factor: that factor belongs to a classical freely orientable moment model.
- Interactions near magnetic ordering invalidate independent spins.

**Sources:** [The Feynman Lectures on Physics: Paramagnetism and Magnetic Resonance](https://www.feynmanlectures.caltech.edu/II_35.html)

<a id="pf-spin-model"></a>

### Ising and Heisenberg model Hamiltonians

$$
H_{\mathrm{Ising}}=-\sum_{\langle ij\rangle}J_{ij}s_i s_j-\sum_i h_i s_i,\quad H_{\mathrm{H}}=-\sum_{\langle ij\rangle}J_{ij}\mathbf S_i\cdot\mathbf S_j
$$

**ID:** `pf-spin-model`

| Symbol | Meaning | Unit |
|---|---|---|
| H | model energy/operator | J |
| J_ij | exchange coefficient in dimensionless-spin convention | J |
| s_i | Ising spin ±1 | 1 |
| h_i | local field energy coefficient | J |
| S_i | dimensionless classical spin or quantum spin operator | 1 |
| i,j | site indices; angle-bracket pair is counted once | 1 |

**Assumptions**

- Each unordered pair is counted once; spin normalization and sign convention are explicit.
- These are models whose couplings must be justified for a material or computational task.

**Derivation.** Rotationally invariant pair interaction has leading scalar S_i dot S_j. Strong easy-axis reduction gives binary s_i. With the minus sign used here, positive J favors aligned neighbors. The same pair-energy algebra can appear in optimization or associative-memory models without making those systems physical magnets.

**Worked check.** Two Ising spins with J=1 energy unit have aligned energy -1 and anti-aligned energy +1. A single spin flip costs 2J in this two-site example.

**Limits and common mistakes**

- Using spin operators with units of hbar changes the units assigned to J.
- A toy network minimum is not evidence that the brain uses this microscopic Hamiltonian.

**Sources:** [The Feynman Lectures on Physics: Ferromagnetism](https://www.feynmanlectures.caltech.edu/II_36.html); [The Feynman Lectures on Physics: Magnetic Materials](https://www.feynmanlectures.caltech.edu/II_37.html)

<a id="pf-larmor"></a>

### Larmor and cyclotron frequencies

$$
\omega_L=|\gamma|B,\qquad \omega_c=|q|B/m,\qquad r_L=m v_\perp/(|q|B)
$$

**ID:** `pf-larmor`

| Symbol | Meaning | Unit |
|---|---|---|
| omega_L,omega_c | angular frequencies | rad/s |
| gamma | gyromagnetic ratio in B convention | rad/(s T) |
| B | uniform magnetic field | T |
| q | charge | C |
| m | particle mass | kg |
| v_perp | perpendicular speed | m/s |
| r_L | gyroradius | m |

**Assumptions**

- Nonrelativistic charged-particle orbit; uniform field; gyrofrequency formula neglects collisions.
- Spin precession has its own measured gyromagnetic ratio.

**Derivation.** Equate magnetic force |q|vB to centripetal m v squared/r to obtain radius and cyclotron rate. Spin precession instead follows torque on angular momentum with mu=gamma angular momentum. The two rates need not coincide because spin and orbital gyromagnetic ratios differ.

**Worked check.** Doubling B halves gyroradius at fixed speed and doubles angular frequency. Convert to cycles per second by dividing omega by 2 pi, not by simply relabeling its unit.

**Limits and common mistakes**

- Relativistic orbital motion requires the Lorentz factor in momentum.
- MRI/NMR and electron-spin frequencies require the correct species gamma.

**Sources:** [The Feynman Lectures on Physics: Magnetostatics](https://www.feynmanlectures.caltech.edu/II_13.html); [The Feynman Lectures on Physics: Paramagnetism and Magnetic Resonance](https://www.feynmanlectures.caltech.edu/II_35.html)

<a id="pf-llg"></a>

### Gilbert dynamics in an effective-B convention

$$
\dot{\mathbf m}=-\frac{\gamma_B}{1+\alpha^2}\left[\mathbf m\times\mathbf B_{\mathrm{eff}}+\alpha\mathbf m\times(\mathbf m\times\mathbf B_{\mathrm{eff}})\right]
$$

**ID:** `pf-llg`

| Symbol | Meaning | Unit |
|---|---|---|
| m | unit magnetization direction | 1 |
| gamma_B | positive Gilbert gyromagnetic magnitude using tesla | 1/(s T) |
| alpha | Gilbert damping | 1 |
| B_eff | effective field | T |
| t | time | s |

**Assumptions**

- Fixed magnetization magnitude, local micromagnetic continuum, no additional spin torque/noise terms.
- B_eff=mu_0 H_eff when translating the cited OOMMF H convention.

**Derivation.** Start with implicit Gilbert precession plus alpha m cross m-dot and solve for m-dot in the tangent plane to the unit sphere. The denominator 1+alpha squared converts Gilbert to explicit Landau–Lifshitz form. Cross products ensure m dot m-dot=0 analytically.

**Worked check.** With alpha=0 and fixed field, the magnetization precesses at gamma_B B while its polar angle stays fixed. Positive alpha aligns it with a static field and decreases the Zeeman energy.

**Limits and common mistakes**

- Mixing gamma in m/(A s) with B in tesla misses a permeability conversion.
- A numerical method should check norm drift, energy balance and timestep convergence.

**Sources:** [NIST OOMMF User Guide: Evolvers](https://math.nist.gov/oommf/doc/userguide21a0/userguidexml/sec_oxsEvolvers.html)

<a id="pf-skyrmion"></a>

### Skyrmion topological charge

$$
Q=\frac{1}{4\pi}\int\mathbf m\cdot(\partial_x\mathbf m\times\partial_y\mathbf m)\,dx\,dy
$$

**ID:** `pf-skyrmion`

| Symbol | Meaning | Unit |
|---|---|---|
| Q | degree/topological charge | 1 |
| m | unit magnetization field | 1 |
| x,y | spatial coordinates | m |

**Assumptions**

- Smooth unit field on a plane compactified by fixed boundary magnetization, or an appropriate closed oriented surface.

**Derivation.** The scalar triple product is the pullback of the unit sphere's area form. Integrating counts the signed area covered on that sphere; division by 4 pi gives the map's integer degree under the compactness/boundary assumptions.

**Worked check.** A constant magnetization has zero derivatives and Q=0. A texture wrapping the sphere once has Q=+1 or -1 according to orientation convention.

**Limits and common mistakes**

- Finite open boundaries, singular configurations and discrete sampling can allow changes or noninteger numerical estimates.
- Topology does not establish unlimited lifetime or practical memory endurance.

**Sources:** [Yang et al.: Embedded Skyrmion Bags in Thin Films of Chiral Magnets](https://advanced.onlinelibrary.wiley.com/doi/full/10.1002/adma.202403274)

<a id="pf-mhd-induction"></a>

### Resistive MHD induction equation

$$
\partial_t\mathbf B=\nabla\times(\mathbf v\times\mathbf B)+\eta_m\nabla^2\mathbf B,\qquad\eta_m=(\mu_0\sigma)^{-1}
$$

**ID:** `pf-mhd-induction`

| Symbol | Meaning | Unit |
|---|---|---|
| B | magnetic field | T |
| v | fluid velocity | m/s |
| eta_m | magnetic diffusivity | m^2/s |
| sigma | electrical conductivity | S/m |
| mu_0 | permeability | H/m |
| t | time | s |

**Assumptions**

- Single-fluid nonrelativistic MHD, scalar uniform conductivity and div B=0.
- Displacement current, Hall term and electron inertia omitted.

**Derivation.** Combine Ohm's law J=sigma(E+v cross B), Faraday's law and J approximately curl B/mu_0. The curl-curl identity and div B=0 turn resistive curl into a diffusion term. Ideal flux freezing is the limit eta_m=0 under smoothness conditions.

**Worked check.** With v=0 a sinusoidal field component B_k decays as exp(-eta_m k squared t). Finer spatial structure decays faster; this is diffusion, not oscillation.

**Limits and common mistakes**

- Reconnection often requires kinetic or nonideal effects beyond this simple closure.
- Electrical resistivity and magnetic diffusivity have different units despite often sharing the symbol eta.

**Sources:** [Richard Fitzpatrick: MHD Waves](https://farside.ph.utexas.edu/teaching/plasma/Plasmahtml/node107.html); [The Feynman Lectures on Physics: The Laws of Induction](https://www.feynmanlectures.caltech.edu/II_17.html)

<a id="pf-alfven"></a>

### Shear Alfvén dispersion

$$
v_A=\frac{B_0}{\sqrt{\mu_0\rho_m}},\qquad\omega^2=k_\parallel^2 v_A^2
$$

**ID:** `pf-alfven`

| Symbol | Meaning | Unit |
|---|---|---|
| v_A | Alfvén speed | m/s |
| B_0 | uniform equilibrium field magnitude | T |
| rho_m | mass density | kg/m^3 |
| mu_0 | permeability | H/m |
| omega | angular frequency | rad/s |
| k_parallel | parallel wavenumber | rad/m |

**Assumptions**

- Linear ideal MHD transverse perturbations around a uniform stationary background.

**Derivation.** Linearized induction relates transverse delta B to the fluid displacement gradient along B0. Magnetic tension supplies restoring force B0 squared/mu_0 times that second derivative, while rho_m supplies inertia. The resulting one-dimensional wave speed is v_A.

**Worked check.** For B0=1 mT and rho_m=1e-6 kg/m cubed, v_A is about 892 m/s. Halving density raises the speed by square root of two.

**Limits and common mistakes**

- At kinetic scales, dispersive and collisionless corrections change the branch.
- If the formula approaches c, relativistic MHD is required.

**Sources:** [Richard Fitzpatrick: MHD Waves](https://farside.ph.utexas.edu/teaching/plasma/Plasmahtml/node107.html)

<a id="pf-josephson"></a>

### Josephson phase-voltage and current relations

$$
I=I_c\sin\delta,\qquad\dot\delta=\frac{2eV}{\hbar},\qquad f_J=\frac{2e}{h}V
$$

**ID:** `pf-josephson`

| Symbol | Meaning | Unit |
|---|---|---|
| I,I_c | junction and critical currents | A |
| delta | gauge-invariant phase difference | rad |
| e | positive elementary charge magnitude | C |
| V | voltage under declared phase orientation | V |
| hbar,h | reduced/full Planck constants | J s |
| f_J | Josephson frequency | Hz |
| t | time; overdots denote time derivatives in this card | s |

**Assumptions**

- Ideal Josephson element; chosen phase and voltage signs are consistent.
- Dissipative/quasiparticle channels require additional circuit terms.

**Derivation.** Coupled condensate amplitudes carry a relative phase. Pair charge 2e turns a potential difference into an energy difference 2eV; quantum phase evolves at energy/hbar. The sinusoidal pair-current relation converts that phase evolution into an alternating current.

**Worked check.** At 1 microvolt, f_J is approximately 483.6 MHz. This links voltage and frequency through exact SI-defined e and h, though the experiment still has uncertainty and circuit limitations.

**Limits and common mistakes**

- An ideal dc Josephson supercurrent at zero voltage does not supply free electrical power.
- Flux, phase, voltage and geometry conventions must be explicit in loops.

**Sources:** [The Feynman Lectures III.21: A Seminar on Superconductivity](https://www.feynmanlectures.caltech.edu/III_21.html); [NIST CODATA fundamental physical constants (2022 adjustment)](https://physics.nist.gov/cuu/Constants/)

<a id="pf-nonabelian"></a>

### Non-Abelian curvature and Wilson loop

$$
F_{\mu\nu}=\partial_\mu A_\nu-\partial_\nu A_\mu-ig[A_\mu,A_\nu],\qquad W(C)=\frac1{d_R}\operatorname{Tr}_R\mathcal P\exp\!\left(ig\oint_C A_\mu dx^\mu\right)
$$

**ID:** `pf-nonabelian`

| Symbol | Meaning | Unit |
|---|---|---|
| A_mu | Hermitian gauge connection | energy in natural units |
| F_munu | gauge curvature | energy^2 in natural units |
| g | 4D gauge coupling | 1 |
| x_mu | coordinate | energy^-1 in natural units |
| d_R | representation dimension | 1 |
| W | normalized loop observable | 1 |
| P | path-ordering operation | not a numeric variable |
| C | closed oriented spacetime path | path coordinates in energy^-1 natural units |
| R | chosen representation in which the trace is taken | representation label |

**Assumptions**

- Natural units hbar=c=1; Hermitian generators and covariant derivative D_mu=partial_mu-ig A_mu.
- Representation and regularization are specified for quantum expectations.

**Derivation.** Commuting covariant derivatives gives [D_mu,D_nu]=-ig F_munu. Noncommuting generators introduce the commutator term absent in U(1). Parallel transport around a closed path transforms by conjugation, so its trace is gauge invariant.

**Worked check.** For commuting matrices the commutator vanishes and path ordering becomes unnecessary, recovering the Abelian flux-phase relation. Small plaquettes approach identity plus ig area times curvature.

**Limits and common mistakes**

- A graph cycle is not automatically a Wilson loop: it needs group-valued transport and a gauge transformation law.
- Formal continuum path integrals do not by themselves prove existence or a mass gap; the 2026 assessment separates those statements.

**Sources:** [Floerchinger: Quantum field theory 2, lecture 15 — Wegner-Wilson loops and confinement](https://www.tpi.uni-jena.de/~floerchinger/qft2/lecture15/); [Yang–Mills group: Pure Yang–Mills results and verification](https://github.com/yang-mills-group/YM)

<a id="pf-berry-phase"></a>

### Adiabatic geometric phase

$$
\gamma_n(C)=i\oint_C\langle n(\mathbf R)|\nabla_{\mathbf R}n(\mathbf R)\rangle\cdot d\mathbf R\pmod{2\pi}
$$

**ID:** `pf-berry-phase`

| Symbol | Meaning | Unit |
|---|---|---|
| gamma_n | geometric phase | rad |
| R | external Hamiltonian parameters | parameter dependent |
| n(R) | normalized instantaneous nondegenerate eigenstate | state normalization |
| C | closed parameter path | not a scalar |
| n | isolated instantaneous eigenstate label | 1 |

**Assumptions**

- Adiabatic transport of an isolated nondegenerate eigenstate; gap and evolution rate permit neglect of transitions.
- The eigenstate gauge is handled consistently along the closed loop.

**Derivation.** Insert an instantaneous eigenstate times a phase into the time-dependent Schrödinger equation and project onto that eigenstate. Besides the energy-integral dynamical phase, its changing basis contributes i times the inner product with its parameter derivative. A gauge rephasing shifts the local connection by a gradient, leaving closed-loop phase invariant modulo 2pi.

**Worked check.** A spin one half following a slowly rotated field accumulates a geometric phase whose magnitude is half the enclosed solid angle, with sign fixed by eigenstate and orientation. Reversing path orientation reverses that geometric contribution.

**Limits and common mistakes**

- Fast driving, degeneracy or dissipation requires a different treatment.
- A cycle in a repository dependency graph does not acquire a Berry phase merely because it is closed.

**Sources:** [Berry: Quantal phase factors accompanying adiabatic changes](https://doi.org/10.1098/rspa.1984.0023)

<a id="pf-vortex-energy"></a>

### Two-dimensional vortex energy–entropy estimate

$$
E[\theta]=\frac{\rho_s}{2}\int|\nabla\theta|^2d^2r,\qquad E_{n}\simeq\pi\rho_s n^2\log(L/a),\qquad F_{|n|=1}\simeq(\pi\rho_s-2k_BT)\log(L/a)
$$

**ID:** `pf-vortex-energy`

| Symbol | Meaning | Unit |
|---|---|---|
| rho_s | two-dimensional phase stiffness in stated convention | J |
| theta | compact angular order parameter | rad |
| n | integer vortex winding | 1 |
| L,a | system and core scales | m |
| T | temperature | K |
| F,E | free energy and energy | J |
| k_B | Boltzmann constant | J K^-1 |
| r | two-dimensional spatial position | m |

**Assumptions**

- Long-distance continuum XY-type model, a≪L, one isolated vortex and ignored core energy.
- The free-energy estimate is heuristic; interactions and renormalized stiffness determine the full transition.

**Derivation.** For winding n, theta=n times polar angle and gradient magnitude is |n|/r. Integrating rho_s n²/(2r²) over a circular annulus gives the logarithmic energy. A vortex can occupy roughly (L/a)² core positions, so its configurational entropy is 2kB log(L/a). Subtracting TS shows how entropy can overcome defect cost.

**Worked check.** A double-winding isolated defect has four times the logarithmic energy of a unit defect, while two widely separated unit defects have approximately twice that self-energy before mutual interactions. This motivates splitting and defect-pair analysis.

**Limits and common mistakes**

- Setting the bare coefficient to zero is not an exact prediction of Tc for an arbitrary lattice or material.
- This vortex topology differs from the two-dimensional-to-sphere winding used for magnetic skyrmions.

**Sources:** [Kosterlitz and Thouless: Ordering, metastability and phase transitions in two-dimensional systems](https://doi.org/10.1088/0022-3719/6/7/010)

## mathematics

<a id="mf-quadratic"></a>

### Quadratic equation by completing the square

$$
x=\frac{-b\pm\sqrt{b^2-4ac}}{2a}
$$

**ID:** `mf-quadratic`

| Symbol | Meaning | Unit |
|---|---|---|
| a,b,c | coefficients of ax²+bx+c | compatible powers of x |
| x | unknown | chosen variable unit |

**Assumptions**

- a is nonzero.
- Use real roots only when the discriminant is nonnegative; over complex numbers select both square roots.

**Derivation.** Divide by a and move c/a. Adding (b/2a)² makes (x+b/2a)²=(b²−4ac)/(4a²). Taking both square roots and subtracting b/2a gives the formula. The division step excludes a=0, which must instead be treated as a linear or constant equation.

**Worked check.** For x²−5x+6=0 the discriminant is 1 and the roots are 2 and 3; substitution makes each residual zero.

**Limits and common mistakes**

- Direct evaluation can lose precision when b and the square root nearly cancel; compute one root stably and obtain the other from their product c/a.

**Sources:** [Calculus, Gilbert Strang: MIT OpenCourseWare edition](https://ocw.mit.edu/courses/res-18-001-calculus-fall-2023/pages/open-textbook/)

<a id="mf-binomial"></a>

### Finite binomial theorem

$$
(a+b)^n=\sum_{k=0}^{n}\binom nk a^{n-k}b^k
$$

**ID:** `mf-binomial`

| Symbol | Meaning | Unit |
|---|---|---|
| n | nonnegative integer exponent | 1 |
| a,b | commuting quantities | same units |

**Assumptions**

- n is a nonnegative integer.
- a and b commute.

**Derivation.** Expand the product of n copies of a+b. To obtain a term with k factors b, choose k of the n positions; there are binomial(n,k) choices. Commutation lets these products share one coefficient. This finite counting argument does not establish convergence of a generalized infinite binomial series.

**Worked check.** For n=3 the coefficients 1,3,3,1 give (a+b)³=a³+3a²b+3ab²+b³.

**Limits and common mistakes**

- For noncommuting matrices AB and BA differ; the scalar formula cannot be substituted blindly.

**Sources:** [Calculus, Gilbert Strang: MIT OpenCourseWare edition](https://ocw.mit.edu/courses/res-18-001-calculus-fall-2023/pages/open-textbook/)

<a id="mf-euler"></a>

### Complex exponential and phase

$$
e^{i\theta}=\cos\theta+i\sin\theta
$$

**ID:** `mf-euler`

| Symbol | Meaning | Unit |
|---|---|---|
| θ | dimensionless phase in radians | 1 |
| i | square root of −1 | 1 |

**Assumptions**

- θ is real for the unit-circle interpretation.

**Derivation.** Separate the absolutely convergent power series for exp(iθ) into even and odd powers. The even part is cosine and the odd part is i times sine. Multiplication of exponentials then yields angle-addition rules, showing why complex multiplication represents rotations.

**Worked check.** At θ=π/2, the value is i. Multiplication by i maps the point 1 to i, a quarter turn.

**Limits and common mistakes**

- A physical frequency in hertz must enter θ as 2πft; confusing cycles with radians changes results by 2π.

**Sources:** [Calculus, Gilbert Strang: MIT OpenCourseWare edition](https://ocw.mit.edu/courses/res-18-001-calculus-fall-2023/pages/open-textbook/)

<a id="mf-rank"></a>

### Rank–nullity and lost directions

$$
\operatorname{rank}A+\dim\ker A=n,\qquad A:\mathbb{R}^n\to\mathbb{R}^m
$$

**ID:** `mf-rank`

| Symbol | Meaning | Unit |
|---|---|---|
| A | linear observation map | output unit / input unit |
| n,m | input and output dimensions | 1 |

**Assumptions**

- A is a finite-dimensional linear map.

**Derivation.** Choose a basis of the nullspace and extend it to a basis of the domain. The images of the additional vectors form a basis of the image. Therefore every input direction is either accounted for by an independent observable direction or contributes to the kernel dimension.

**Worked check.** A=[1 0] maps R² to R. Its rank is 1 and nullspace is {(0,t)}. Its sole returned singular value is positive, yet recovery of the second coordinate is impossible.

**Limits and common mistakes**

- A rectangular SVD can list only positive returned singular values while omitting nullspace directions on the larger side.

**Sources:** [Linear Algebra, Gilbert Strang, MIT 18.06SC](https://ocw.mit.edu/courses/18-06sc-linear-algebra-fall-2011/)

<a id="mf-inner"></a>

### Cauchy–Schwarz and cosine similarity

$$
|\langle x,y\rangle|\le\|x\|\|y\|,\qquad \cos\theta=\frac{x^Ty}{\|x\|\|y\|}
$$

**ID:** `mf-inner`

| Symbol | Meaning | Unit |
|---|---|---|
| x,y | vectors in a real inner-product space | common coordinate units |
| θ | angle for nonzero vectors | rad |

**Assumptions**

- The angle formula uses real nonzero vectors.
- For complex spaces use the Hermitian inner product for the inequality.

**Derivation.** For y≠0 minimize ||x−αy||² over α. Nonnegativity at the minimizer gives ||x||²−|〈x,y〉|²/||y||²≥0. In real Euclidean geometry the normalized dot product therefore lies in [−1,1] and can define an angle.

**Worked check.** x=(1,0), y=(1,1) have cosine 1/√2. x and 100x have cosine 1 even though their lengths differ by 100.

**Limits and common mistakes**

- Similarity is undefined for a zero vector and is not a probability that two claims are true or equivalent.

**Sources:** [Linear Algebra, Gilbert Strang, MIT 18.06SC](https://ocw.mit.edu/courses/18-06sc-linear-algebra-fall-2011/)

<a id="mf-det"></a>

### Two-dimensional determinant and inverse

$$
\det A=ad-bc,\quad A^{-1}=\frac1{ad-bc}\begin{pmatrix}d&-b\\-c&a\end{pmatrix}
$$

**ID:** `mf-det`

| Symbol | Meaning | Unit |
|---|---|---|
| a,b,c,d | entries of a 2×2 matrix | map-dependent |
| A | square linear map | map-dependent |

**Assumptions**

- ad−bc≠0 for the inverse.

**Derivation.** The signed area of the parallelogram spanned by the columns is ad−bc. Multiplying A by the proposed adjugate gives (ad−bc)I; division is legal exactly when the determinant is nonzero. This direct derivation shows both invertibility and volume scaling.

**Worked check.** For A=[[2,1],[1,1]], det A=1 and inverse [[1,−1],[−1,2]]. Their product is the identity.

**Limits and common mistakes**

- A nonzero determinant can coexist with severe ill-conditioning; determinant magnitude alone is a poor stability test.

**Sources:** [Linear Algebra, Gilbert Strang, MIT 18.06SC](https://ocw.mit.edu/courses/18-06sc-linear-algebra-fall-2011/)

<a id="mf-spectral"></a>

### Real symmetric spectral decomposition

$$
A=Q\Lambda Q^T,\qquad Q^TQ=I
$$

**ID:** `mf-spectral`

| Symbol | Meaning | Unit |
|---|---|---|
| A | real symmetric matrix | operator units |
| Q | orthogonal eigenvector matrix | 1 |
| Λ | diagonal eigenvalue matrix | operator units |

**Assumptions**

- A is real and symmetric.

**Derivation.** A continuous Rayleigh quotient reaches an extremum on the unit sphere. Lagrange multipliers give an eigenvector at that extremum. Symmetry leaves its orthogonal complement invariant, so induction produces an orthonormal eigenbasis. Each mode then evolves independently under polynomials in A.

**Worked check.** For [[2,−1],[−1,2]], vectors (1,1)/√2 and (1,−1)/√2 have eigenvalues 1 and 3.

**Limits and common mistakes**

- General real matrices can have complex eigenvalues or defective eigenspaces; the symmetric theorem cannot be assumed for directed adjacency matrices.

**Sources:** [Linear Algebra, Gilbert Strang, MIT 18.06SC](https://ocw.mit.edu/courses/18-06sc-linear-algebra-fall-2011/)

<a id="mf-svd"></a>

### Singular value decomposition

$$
A=U\Sigma V^*,\qquad \sigma_i^2=\lambda_i(A^*A)
$$

**ID:** `mf-svd`

| Symbol | Meaning | Unit |
|---|---|---|
| A | m×n matrix | output/input |
| U,V | unitary changes of coordinates | 1 |
| σ_i | nonnegative singular values | output/input |

**Assumptions**

- A is a finite real or complex matrix; * is conjugate transpose.

**Derivation.** The Hermitian positive semidefinite matrix A*A has an orthonormal eigenbasis. For every positive eigenvalue set u_i=Av_i/σ_i; these vectors are orthonormal. Extend the bases to account for left and right nullspaces. This yields rectangular diagonal Σ and the factorization.

**Worked check.** A=diag(3,1) sends a unit circle to an ellipse with semiaxes 3 and 1; an added zero column supplies an invisible input direction.

**Limits and common mistakes**

- SVD does not assign semantic meaning to its axes; signs and bases within repeated singular values are not unique.

**Sources:** [Linear Algebra, Gilbert Strang, MIT 18.06SC](https://ocw.mit.edu/courses/18-06sc-linear-algebra-fall-2011/)

<a id="mf-pinv"></a>

### Moore–Penrose pseudoinverse

$$
A^+=V\Sigma^+U^*,\quad x_*=A^+b
$$

**ID:** `mf-pinv`

| Symbol | Meaning | Unit |
|---|---|---|
| Σ⁺ | reciprocal positive singular values and zero otherwise | input/output |
| b | observations | output unit |
| x_* | minimum-norm least-squares estimate | input unit |

**Assumptions**

- The norm is Euclidean.
- A numerical singular-value cutoff must be declared.

**Derivation.** Rotate b into the U basis. Each nonzero singular coordinate is independently minimized by division by σ_i; zero input coordinates cannot affect the residual. Setting undetermined coordinates to zero selects the minimum-norm member of all least-squares minimizers.

**Worked check.** For A=[1 0], b=3, the pseudoinverse returns (3,0). Every (3,t) gives the same observations; t=0 is a selection convention.

**Limits and common mistakes**

- Tiny singular values amplify noise. Truncation changes the inverse problem by adding a modeling choice.

**Sources:** [Linear Algebra, Gilbert Strang, MIT 18.06SC](https://ocw.mit.edu/courses/18-06sc-linear-algebra-fall-2011/)

<a id="mf-least"></a>

### Least squares normal equations

$$
\min_x\|Ax-b\|_2^2\Rightarrow A^TAx=A^Tb
$$

**ID:** `mf-least`

| Symbol | Meaning | Unit |
|---|---|---|
| A | design matrix | output/input |
| x | parameters | input |
| b | observed outputs | output |

**Assumptions**

- Real finite matrix; full column rank is needed for a unique unconstrained solution.

**Derivation.** Expand the quadratic and differentiate: ∇f=2Aᵀ(Ax−b). Stationarity means the residual is orthogonal to every column of A. With full column rank the Hessian 2AᵀA is positive definite, so the stationary point is the unique global minimizer.

**Worked check.** Fit one constant x to observations 1,2,6. A is a column of ones and the equation is 3x=9, so x=3.

**Limits and common mistakes**

- Computing normal equations squares the condition number. QR or SVD is often numerically preferable.

**Sources:** [Linear Algebra, Gilbert Strang, MIT 18.06SC](https://ocw.mit.edu/courses/18-06sc-linear-algebra-fall-2011/)

<a id="mf-pca"></a>

### Centered covariance and PCA

$$
C=\frac{X^TX}{N-1},\quad Cv_i=\lambda_i v_i
$$

**ID:** `mf-pca`

| Symbol | Meaning | Unit |
|---|---|---|
| X | N×d centered observation matrix | feature unit after scaling |
| C | sample covariance | feature unit² |
| λ_i | variance along eigenvector | feature unit² |

**Assumptions**

- N>1 and columns are centered.
- Scaling is declared when features have different units.

**Derivation.** Variance in a unit direction v is ||Xv||²/(N−1)=vᵀCv. Maximizing this under vᵀv=1 yields Cv=λv. Orthogonal subsequent maximizations choose the remaining eigenvectors, giving a rank-k reconstruction with maximum retained variance.

**Worked check.** For centered points (−1,0),(0,0),(1,0), C=diag(1,0). One component preserves all sample variance.

**Limits and common mistakes**

- High variance can be noise or confounding. PCA compresses second-order structure, not all task-relevant information.

**Sources:** [Linear Algebra, Gilbert Strang, MIT 18.06SC](https://ocw.mit.edu/courses/18-06sc-linear-algebra-fall-2011/)

<a id="mf-cond"></a>

### Relative error and matrix condition number

$$
\kappa_2(A)=\frac{\sigma_{\max}}{\sigma_{\min}},\quad \frac{\|\delta x\|}{\|x\|}\le\kappa_2(A)\frac{\|\delta b\|}{\|b\|}
$$

**ID:** `mf-cond`

| Symbol | Meaning | Unit |
|---|---|---|
| A | invertible square matrix | output/input |
| δb,δx | perturbation in data and solution | respective units |

**Assumptions**

- A is fixed and invertible; only b is perturbed.
- The bound is worst-case and uses compatible Euclidean norms.
- b and x are nonzero, so relative error ratios are defined.

**Derivation.** Since δx=A⁻¹δb, ||δx||≤||A⁻¹||||δb||. Also ||b||=||Ax||≤||A||||x||. Combining the two inequalities yields the relative bound and κ=||A||||A⁻¹||.

**Worked check.** diag(1,10⁻⁶) has condition number 10⁶; noise in its second output can be amplified a millionfold.

**Limits and common mistakes**

- Perturbations in A require an additional denominator and a smallness condition; the displayed formula does not cover them.

**Sources:** [Linear Algebra, Gilbert Strang, MIT 18.06SC](https://ocw.mit.edu/courses/18-06sc-linear-algebra-fall-2011/)

<a id="mf-derivative"></a>

### Derivative as a controlled limit

$$
f'(x)=\lim_{h\to0}\frac{f(x+h)-f(x)}h
$$

**ID:** `mf-derivative`

| Symbol | Meaning | Unit |
|---|---|---|
| h | input increment | input unit |
| f' | local rate | output/input |

**Assumptions**

- The two-sided limit exists for an interior real point.

**Derivation.** The finite quotient measures a secant slope. A derivative exists when these slopes approach the same value from all allowed directions. The defining remainder is f(x+h)=f(x)+f′(x)h+o(h), making the linear approximation's error small relative to h.

**Worked check.** For f(x)=x², the quotient is 2x+h and the limit is 2x. For |x| at zero the one-sided quotients differ, so no derivative exists.

**Limits and common mistakes**

- A small finite-difference residual is not a proof of differentiability; numerical subtraction can also destroy small increments.

**Sources:** [Calculus, Gilbert Strang: MIT OpenCourseWare edition](https://ocw.mit.edu/courses/res-18-001-calculus-fall-2023/pages/open-textbook/)

<a id="mf-taylor"></a>

### Taylor theorem with an explicit remainder

$$
f(x+h)=\sum_{k=0}^{n}\frac{f^{(k)}(x)}{k!}h^k+\frac{f^{(n+1)}(\xi)}{(n+1)!}h^{n+1}
$$

**ID:** `mf-taylor`

| Symbol | Meaning | Unit |
|---|---|---|
| ξ | point between x and x+h | input unit |
| n | polynomial degree | 1 |

**Assumptions**

- Sufficient differentiability on the interval and continuity assumptions for the Lagrange remainder.

**Derivation.** Repeated integration of the derivative, or the mean-value theorem applied to the error, isolates the next derivative. If its magnitude is bounded by M, the error is at most M|h|^(n+1)/(n+1)!. The bound, not just the polynomial, determines a safe approximation region.

**Worked check.** For exp(h) at zero with |h|≤0.1, 1+h+h²/2 has error at most exp(0.1)|h|³/6.

**Limits and common mistakes**

- Smoothness alone does not guarantee equality to an infinite Taylor series; some smooth functions are not analytic.

**Sources:** [Calculus, Gilbert Strang: MIT OpenCourseWare edition](https://ocw.mit.edu/courses/res-18-001-calculus-fall-2023/pages/open-textbook/)

<a id="mf-chain"></a>

### Multivariable chain rule

$$
D(f\circ g)(x)=Df(g(x))Dg(x)
$$

**ID:** `mf-chain`

| Symbol | Meaning | Unit |
|---|---|---|
| g | map Rⁿ→Rᵐ | intermediate/input |
| f | map Rᵐ→Rᵏ | output/intermediate |
| D | Jacobian derivative | map-dependent |

**Assumptions**

- Both functions are differentiable at the relevant points; matrix shapes must compose.

**Derivation.** Insert the local expansion g(x+h)=g(x)+Dg(x)h+o(||h||) into the local expansion of f. The linear term is Df(g(x))Dg(x)h and the combined remainder stays smaller than ||h||. Reverse-mode differentiation transposes this product when propagating a scalar loss gradient.

**Worked check.** For g(x)=(x,x²), f(u,v)=u+3v, the derivative is [1,3]·[1,2x]ᵀ=1+6x.

**Limits and common mistakes**

- Nondifferentiable branches require subgradient or piecewise reasoning; automatic differentiation follows program semantics, which may differ from an intended model.

**Sources:** [Calculus, Gilbert Strang: MIT OpenCourseWare edition](https://ocw.mit.edu/courses/res-18-001-calculus-fall-2023/pages/open-textbook/)

<a id="mf-ftc"></a>

### Fundamental theorem of calculus

$$
\frac d{dx}\int_a^x f(t)\,dt=f(x),\quad \int_a^b F'(x)\,dx=F(b)-F(a)
$$

**ID:** `mf-ftc`

| Symbol | Meaning | Unit |
|---|---|---|
| f | integrand | quantity/input |
| F | antiderivative | quantity |
| a,b | endpoints | input |

**Assumptions**

- Continuity suffices for the first identity; suitable absolute continuity suffices for the integral identity.

**Derivation.** Changing the upper limit by h adds the integral over a short interval. Dividing by h gives its mean value, which tends to f(x) by continuity. Integrating a derivative then telescopes local changes into the total endpoint difference.

**Worked check.** Integrating 2x from 0 to 3 gives [x²]₀³=9.

**Limits and common mistakes**

- Improper endpoints and singular distributions need separate convergence or weak-form arguments.

**Sources:** [Calculus, Gilbert Strang: MIT OpenCourseWare edition](https://ocw.mit.edu/courses/res-18-001-calculus-fall-2023/pages/open-textbook/)

<a id="mf-jacobian"></a>

### Change of variables and volume

$$
\int_{\phi(U)}f(x)\,dx=\int_U f(\phi(u))|\det D\phi(u)|\,du
$$

**ID:** `mf-jacobian`

| Symbol | Meaning | Unit |
|---|---|---|
| φ | coordinate map | physical/coordinate |
| Dφ | Jacobian | physical/coordinate |
| f | density | quantity/volume |

**Assumptions**

- φ is a sufficiently regular one-to-one coordinate map except possibly negligible sets.
- Multiplicity must be handled for many-to-one mappings.

**Derivation.** A small coordinate box is sent approximately to a parallelepiped whose volume is multiplied by |det Dφ|. Summing these local contributions and taking a limit produces the integral identity.

**Worked check.** In polar coordinates (r,θ)↦(r cosθ,r sinθ), determinant r yields disk area ∫₀²π∫₀ᴿ r dr dθ=πR².

**Limits and common mistakes**

- Omitting the Jacobian corrupts densities and probabilities; a singular map cannot be inverted by this theorem.

**Sources:** [Calculus, Gilbert Strang: MIT OpenCourseWare edition](https://ocw.mit.edu/courses/res-18-001-calculus-fall-2023/pages/open-textbook/)

<a id="mf-div"></a>

### Divergence theorem

$$
\int_\Omega\nabla\cdot F\,dV=\int_{\partial\Omega}F\cdot n\,dS
$$

**ID:** `mf-div`

| Symbol | Meaning | Unit |
|---|---|---|
| F | vector flux field | quantity/(area·time) |
| n | outward unit normal | 1 |

**Assumptions**

- Ω has an appropriate piecewise smooth or Lipschitz boundary.
- F has sufficient classical or weak regularity.

**Derivation.** For a small box, opposite-face flux differences equal directional derivatives times volume to leading order. Interior faces cancel when boxes are assembled. Only the exterior boundary remains, producing the global conservation identity.

**Worked check.** For F=(x,y,z) on a radius-R ball, divergence is 3. Both sides equal 4πR³.

**Limits and common mistakes**

- Point singularities require exclusion and limiting or distributional analysis; setting divergence to zero away from a source does not remove the source.

**Sources:** [Calculus, Gilbert Strang: MIT OpenCourseWare edition](https://ocw.mit.edu/courses/res-18-001-calculus-fall-2023/pages/open-textbook/)

<a id="mf-stokes"></a>

### Generalized Stokes theorem

$$
\int_M d\omega=\int_{\partial M}\omega
$$

**ID:** `mf-stokes`

| Symbol | Meaning | Unit |
|---|---|---|
| ω | differential (k−1)-form | observable-dependent |
| M | oriented k-dimensional manifold | geometric |

**Assumptions**

- M is oriented with compatible boundary orientation; forms are sufficiently smooth and integrals converge.
- Take M compact or ω compactly supported; a noncompact decay variant requires explicitly vanishing boundary contributions at infinity, beyond convergence alone.

**Derivation.** On coordinate patches the statement reduces to one-variable integration and cancellation of internal faces. A partition of unity patches local identities into a global one. The identity d²=0 expresses that the boundary of a boundary contributes nothing.

**Worked check.** For a planar disk with 1-form ω=−y dx/2+x dy/2, dω=dx∧dy and the boundary integral equals the disk's area.

**Limits and common mistakes**

- Orientation errors flip signs; local exactness need not extend globally around holes.

**Sources:** [Introducing Differential Geometry, David Tong, section 2.4.5](https://www.davidtong.org/teaching/general-relativity/grhtml/S2)

<a id="mf-eulerlagrange"></a>

### Euler–Lagrange stationarity

$$
\frac d{dt}\frac{\partial L}{\partial\dot q}-\frac{\partial L}{\partial q}=0
$$

**ID:** `mf-eulerlagrange`

| Symbol | Meaning | Unit |
|---|---|---|
| L | Lagrangian integrand | energy in mechanics |
| q | generalized coordinate | coordinate-dependent |
| t | time | s |

**Assumptions**

- Variations vanish at fixed endpoints; L and q have required regularity.

**Derivation.** Perturb q by εη. Differentiate the action at ε=0: δS=∫(L_qη+L_qdotηdot)dt. Integration by parts moves the derivative from ηdot, leaving a boundary term that vanishes under fixed endpoints. Arbitrary interior η forces the displayed equation.

**Worked check.** L=m qdot²/2−kq²/2 gives mqddot+kq=0.

**Limits and common mistakes**

- Stationarity can be a maximum or saddle; constraints and free endpoints generate additional conditions.

**Sources:** [The Lagrangian Formalism, David Tong](https://davidtong.org/pdfs/teaching/classical-dynamics/clas2.pdf)

<a id="mf-bayes"></a>

### Bayes rule with dependent evidence awareness

$$
P(H\mid E)=\frac{P(E\mid H)P(H)}{P(E)}
$$

**ID:** `mf-bayes`

| Symbol | Meaning | Unit |
|---|---|---|
| H | hypothesis event | 1 |
| E | observed event | 1 |

**Assumptions**

- P(E)>0.
- Probabilities refer to the same model and experiment.

**Derivation.** The joint probability satisfies P(H∩E)=P(E|H)P(H)=P(H|E)P(E). Dividing by the positive marginal yields Bayes' rule. Sequential updates must use P(E₂|H,E₁), not P(E₂|H), unless conditional independence is justified.

**Worked check.** Prior 0.1, likelihood 0.8 and false-positive likelihood 0.2 give posterior 0.08/(0.08+0.18)=4/13.

**Limits and common mistakes**

- Two sites repeating one press release are dependent evidence; counting them as independent inflates confidence.

**Sources:** [MIT 18.05 Class 03: Conditional Probability, Independence, Bayes' Theorem](https://ocw.mit.edu/courses/18-05-introduction-to-probability-and-statistics-spring-2022/mit18_05_s22_lec03.pdf)

<a id="mf-cov"></a>

### Covariance and variance propagation

$$
\operatorname{Cov}(X,Y)=E[(X-EX)(Y-EY)],\quad \operatorname{Var}(a^TX)=a^T\Sigma a
$$

**ID:** `mf-cov`

| Symbol | Meaning | Unit |
|---|---|---|
| Σ | covariance matrix | coordinate units multiplied |
| a | linear combination weights | output/input |

**Assumptions**

- Second moments exist.

**Derivation.** Expand the square of aᵀ(X−EX); linearity of expectation turns pairwise products into covariance entries. Cross terms matter whenever variables are dependent, so adding marginal variances alone is generally wrong.

**Worked check.** If X=Y with variance 1, Var(X+Y)=4. Treating the copies as independent would incorrectly give 2.

**Limits and common mistakes**

- Correlation zero does not imply independence; for a symmetric nonconstant X, X and X² can be uncorrelated but dependent.

**Sources:** [MIT 18.05: Introduction to Probability and Statistics](https://ocw.mit.edu/courses/18-05-introduction-to-probability-and-statistics-spring-2022/); [Linear Algebra, Gilbert Strang, MIT 18.06SC](https://ocw.mit.edu/courses/18-06sc-linear-algebra-fall-2011/)

<a id="mf-gauss"></a>

### Multivariate Gaussian density

$$
p(x)=\frac{e^{-\frac12(x-\mu)^T\Sigma^{-1}(x-\mu)}}{(2\pi)^{d/2}\det(\Sigma)^{1/2}}
$$

**ID:** `mf-gauss`

| Symbol | Meaning | Unit |
|---|---|---|
| μ | mean vector | feature units |
| Σ | positive definite covariance | feature-unit products |
| p | density with respect to Lebesgue measure | inverse feature-volume |

**Assumptions**

- Σ is symmetric positive definite; singular Gaussians require a lower-dimensional measure.

**Derivation.** Transform a standard normal z by x=μ+Lz where LLᵀ=Σ. The quadratic form becomes ||z||² and the change-of-variables determinant contributes |det L|⁻¹=det(Σ)⁻¹/².

**Worked check.** With μ=0 and Σ=I, the coordinates are independent standard normals and the density factors.

**Limits and common mistakes**

- A Gaussian is a model assumption; observed covariance does not establish Gaussian tails or independence.

**Sources:** [MIT 18.05: Introduction to Probability and Statistics](https://ocw.mit.edu/courses/18-05-introduction-to-probability-and-statistics-spring-2022/)

<a id="mf-hoeffding"></a>

### Hoeffding bound for bounded independent samples

$$
P(|\bar X-E\bar X|\ge\epsilon)\le2e^{-2N\epsilon^2/(b-a)^2}
$$

**ID:** `mf-hoeffding`

| Symbol | Meaning | Unit |
|---|---|---|
| N | sample count | 1 |
| a,b | uniform bounds on each sample | sample unit |
| ε | deviation threshold | sample unit |

**Assumptions**

- Samples are independent and each lies in [a,b].

**Derivation.** Bound the moment-generating function of each centered bounded variable, multiply the bounds using independence, and apply the exponential Markov inequality. Optimizing the exponential parameter gives the upper tail; repeat for the lower tail and add them.

**Worked check.** For N=1000 Bernoulli observations, ε=0.1 gives a two-sided bound 2e⁻²⁰, before any multiple-comparison adjustment.

**Limits and common mistakes**

- Adaptive sampling, duplicated sources and temporal dependence invalidate the independent-sample plug-in bound.

**Sources:** [Concentration inequalities, Cosma Shalizi](https://www.stat.cmu.edu/~cshalizi/sml/21/lectures/06/lecture-06.html)

<a id="mf-entropy"></a>

### Shannon entropy

$$
H(X)=-\sum_xp(x)\log_2p(x)
$$

**ID:** `mf-entropy`

| Symbol | Meaning | Unit |
|---|---|---|
| p(x) | probability mass | 1 |
| H | average information under binary coding convention | bits |

**Assumptions**

- A discrete probability distribution is specified; define 0 log 0=0 by continuity.

**Derivation.** The information of an outcome with probability p is −log₂p. Averaging this value gives entropy. Concavity implies a uniform distribution on N outcomes has maximal entropy log₂N, while a certain outcome has entropy zero.

**Worked check.** A fair bit has entropy 1 bit. A deterministic duplicated bit adds no conditional entropy once the original is known.

**Limits and common mistakes**

- Differential entropy for continuous variables is coordinate-dependent and can be negative; it is not the same object.

**Sources:** [A Mathematical Theory of Communication, Claude Shannon](https://people.math.harvard.edu/~ctm/home/text/others/shannon/entropy/entropy.pdf); [Entropy, Relative Entropy, and Mutual Information, Tsachy Weissman](https://web.stanford.edu/class/ee376a/files/lecture_3.pdf)

<a id="mf-kl"></a>

### Relative entropy

$$
D_{KL}(p\|q)=\sum_xp(x)\log\frac{p(x)}{q(x)}\ge0
$$

**ID:** `mf-kl`

| Symbol | Meaning | Unit |
|---|---|---|
| p,q | probability distributions on one alphabet | 1 |
| D_KL | directional information divergence | nats for natural log |

**Assumptions**

- q(x)>0 wherever p(x)>0 for a finite value.

**Derivation.** Apply convexity of −log to q/p under p, or use log t≤t−1. Equality holds only when the distributions agree on the relevant support. Its asymmetry follows because changing the averaging distribution changes the expression.

**Worked check.** For p=(1,0), q=(1/2,1/2), divergence is log2; reversing them makes the value infinite.

**Limits and common mistakes**

- KL is not a metric: it is asymmetric and does not satisfy a triangle inequality.

**Sources:** [Entropy, Relative Entropy, and Mutual Information, Tsachy Weissman](https://web.stanford.edu/class/ee376a/files/lecture_3.pdf)

<a id="mf-mi"></a>

### Mutual information

$$
I(X;Y)=D_{KL}(p_{XY}\|p_Xp_Y)=H(X)-H(X\mid Y)
$$

**ID:** `mf-mi`

| Symbol | Meaning | Unit |
|---|---|---|
| X,Y | jointly distributed discrete variables | model-dependent |
| I | information shared statistically | bits or nats consistently |

**Assumptions**

- Finite entropies suffice for the entropy difference; KL form extends more generally.

**Derivation.** Expand log[p(x,y)/(p(x)p(y))] into log p(x|y)−log p(x) and average. This measures reduction in uncertainty about X after observing Y. Zero mutual information is equivalent to independence in the probability model.

**Worked check.** If Y is an exact copy of a fair bit X, I=1 bit; two independent fair bits give I=0.

**Limits and common mistakes**

- Shared information does not establish causal direction; common causes can generate it.

**Sources:** [Entropy, Relative Entropy, and Mutual Information, Tsachy Weissman](https://web.stanford.edu/class/ee376a/files/lecture_3.pdf)

<a id="mf-markov"></a>

### Markov transition and stationary distribution

$$
p_{t+1}=P^Tp_t,\quad P\mathbf1=\mathbf1,\quad P^T\pi=\pi
$$

**ID:** `mf-markov`

| Symbol | Meaning | Unit |
|---|---|---|
| P | row-stochastic transition matrix | 1 |
| p_t,π | column probability vectors | 1 |

**Assumptions**

- P has nonnegative entries and rows sum to one.
- Finite irreducibility and aperiodicity ensure convergence to a unique stationary distribution.

**Derivation.** The probability of arriving at j is the sum over departure states i of p_t(i)P_ij. A stationary vector is unchanged by this linear map. Existence alone does not imply convergence: periodic chains can keep oscillating.

**Worked check.** P=[[0,1],[1,0]] has stationary π=(1/2,1/2) but an initial point mass alternates forever.

**Limits and common mistakes**

- A memory process is Markov only relative to its chosen state; omitted history can break the assumption.

**Sources:** [MIT 18.05: Introduction to Probability and Statistics](https://ocw.mit.edu/courses/18-05-introduction-to-probability-and-statistics-spring-2022/); [The PageRank Citation Ranking: Bringing Order to the Web](https://cs.brown.edu/courses/csci2531/papers/pagerank.pdf)

<a id="mf-walks"></a>

### Adjacency powers count walks

$$
(A^k)_{ij}=\#\{\text{length-k walks from }i\text{ to }j\}
$$

**ID:** `mf-walks`

| Symbol | Meaning | Unit |
|---|---|---|
| A | 0/1 adjacency matrix of a finite graph | 1 |
| k | number of edges in walk | 1 |

**Assumptions**

- Unweighted finite graph; matrix orientation is fixed.
- For weighted graphs the entries sum products of edge weights instead.

**Derivation.** For k=1 the claim is the adjacency definition. Multiplying A^k by A sums over the penultimate vertex, appending one edge to each existing walk. Induction proves the result.

**Worked check.** In a two-vertex graph with one undirected edge, A²=I: each vertex has one two-step return walk.

**Limits and common mistakes**

- Walks may repeat vertices and edges. They are not simple paths or independent lines of evidence.

**Sources:** [Essential spectral theory and graph drawing, Daniel Spielman](https://www.cs.yale.edu/homes/spielman/561/lect02-18.pdf)

<a id="mf-lap"></a>

### Graph Laplacian energy

$$
L=D-W=B^T C B,\quad x^TLx=\sum_{\{i,j\}}w_{ij}(x_i-x_j)^2
$$

**ID:** `mf-lap`

| Symbol | Meaning | Unit |
|---|---|---|
| W | symmetric nonnegative adjacency weights | conductance if physical |
| D | weighted degree diagonal | same as W |
| B | edge-by-vertex signed incidence matrix | 1 |
| C | edge-weight diagonal | same as W |

**Assumptions**

- Undirected graph with nonnegative weights; sum counts each undirected edge once.

**Derivation.** Expand xᵀDx−xᵀWx and group the symmetric i,j terms. Each pair becomes w_ij(x_i−x_j)². Every summand is nonnegative, and constant signals have zero energy. For a connected graph these are exactly the nullspace directions.

**Worked check.** For a three-vertex unit-weight path and x=(1,0,0), the energy is (1−0)²+(0−0)²=1.

**Limits and common mistakes**

- Signed or directed relations require different operators; mixing contradicts and supports edges as positive diffusion weights erases meaning.

**Sources:** [Essential spectral theory and graph drawing, Daniel Spielman](https://www.cs.yale.edu/homes/spielman/561/lect02-18.pdf)

<a id="mf-normalized"></a>

### Normalized Laplacian

$$
\mathcal L=I-D^{-1/2}WD^{-1/2}
$$

**ID:** `mf-normalized`

| Symbol | Meaning | Unit |
|---|---|---|
| D | positive weighted degrees | weight |
| ℒ | normalized Laplacian | 1 |

**Assumptions**

- Undirected nonnegative graph with no isolated vertices, or an explicit isolated-vertex convention.

**Derivation.** Change variables x=D⁻¹/²y in the unnormalized quadratic form. Degree normalization compensates for different total incident weights. Its spectrum lies in [0,2], linking random-walk mixing with normalized cuts.

**Worked check.** For a single edge connecting two vertices, ℒ=[[1,−1],[−1,1]], with eigenvalues 0 and 2.

**Limits and common mistakes**

- Normalization changes which notions of smoothness and importance are emphasized; it is not universally preferable.

**Sources:** [Conductance, the Normalized Laplacian, and Cheeger's Inequality, Daniel Spielman](https://www.cs.yale.edu/homes/spielman/561/lect11-18.pdf)

<a id="mf-pagerank"></a>

### Personalized PageRank as a convergent recurrence

$$
r=\alpha P^Tr+(1-\alpha)v=(1-\alpha)(I-\alpha P^T)^{-1}v
$$

**ID:** `mf-pagerank`

| Symbol | Meaning | Unit |
|---|---|---|
| α | continuation probability | 1 |
| v | restart probability vector | 1 |
| P | row-stochastic transition including dangling-node repair | 1 |

**Assumptions**

- 0≤α<1; v is nonnegative and sums to one; every row of P sums to one.

**Derivation.** The recurrence alternates graph-following with restart. Because αPᵀ contracts the ℓ₁ norm by at most α, the fixed point is unique. Expanding the inverse gives a geometrically damped sum of walk distributions, so long loops cannot add unlimited mass.

**Worked check.** For a two-state swap chain, α=0.8, v=(1,0), solve r₁=.8r₂+.2 and r₂=.8r₁: r=(5/9,4/9).

**Limits and common mistakes**

- High graph rank is not credibility. Typed relations, permissions and source validity must be filtered before ranking.

**Sources:** [The PageRank Citation Ranking: Bringing Order to the Web](https://cs.brown.edu/courses/csci2531/papers/pagerank.pdf)

<a id="mf-resistance"></a>

### Effective electrical resistance

$$
R_{ij}=(e_i-e_j)^TL^+(e_i-e_j)
$$

**ID:** `mf-resistance`

| Symbol | Meaning | Unit |
|---|---|---|
| L | conductance Laplacian | siemens |
| e_i-e_j | unit source/sink vector | unit current convention |
| R_ij | effective resistance | ohm |

**Assumptions**

- Connected undirected network with positive conductances; or restrict to one connected component.

**Derivation.** Inject unit current at i and remove it at j. Solve Lv=e_i−e_j in the zero-mean gauge. The potential drop v_i−v_j equals resistance by Ohm's law, giving the pseudoinverse quadratic form.

**Worked check.** Two unit resistors in series have resistance 2; two parallel unit resistors have resistance 1/2.

**Limits and common mistakes**

- A semantic graph only borrows this geometry; edge weights are not electrical conductances unless physically defined.

**Sources:** [Essential spectral theory and graph drawing, Daniel Spielman](https://www.cs.yale.edu/homes/spielman/561/lect02-18.pdf)

<a id="mf-cheeger"></a>

### Cheeger inequality for an undirected weighted graph

$$
\frac{\lambda_2(\mathcal L)}2\le\phi(G)\le\sqrt{2\lambda_2(\mathcal L)}
$$

**ID:** `mf-cheeger`

| Symbol | Meaning | Unit |
|---|---|---|
| λ₂ | second normalized-Laplacian eigenvalue | 1 |
| φ | minimum edge conductance over nontrivial cuts | 1 |

**Assumptions**

- Finite connected undirected graph with nonnegative weights; conductance uses weighted volume.

**Derivation.** Testing the Rayleigh quotient on a centered cut indicator gives the lower relation. Sweeping a second eigenvector and integrating threshold-cut contributions yields a cut with conductance bounded by the square root expression. The two sides connect discrete bottlenecks with continuous energy.

**Worked check.** A graph connected by one very weak bridge has a low-conductance cut and small λ₂, so mixing across the bridge is slow.

**Limits and common mistakes**

- The square-root gap is real; a spectral heuristic is an approximation, not an exact minimum-cut certificate.

**Sources:** [Conductance, the Normalized Laplacian, and Cheeger's Inequality, Daniel Spielman](https://www.cs.yale.edu/homes/spielman/561/lect11-18.pdf)

<a id="mf-diffusion"></a>

### Heat diffusion on a graph

$$
\dot x=-Lx,\quad x(t)=e^{-tL}x(0)=\sum_k e^{-t\lambda_k}\langle q_k,x(0)\rangle q_k
$$

**ID:** `mf-diffusion`

| Symbol | Meaning | Unit |
|---|---|---|
| t | diffusion parameter | inverse weight if dimensional |
| λ_k,q_k | Laplacian eigenpairs | weight,1 |

**Assumptions**

- Finite symmetric Laplacian; time and weights use compatible units.

**Derivation.** Diagonalize L and solve each scalar ODE c′_k=−λ_kc_k. Nonnegative eigenvalues ensure all nonconstant modes decay. The zero eigenmode preserves the component-wise mean under the unnormalized model.

**Worked check.** For one unit edge, the difference x₁−x₂ decays as e⁻²ᵗ while the sum stays constant.

**Limits and common mistakes**

- Diffusion smooths contradictions as readily as useful evidence unless edge types and conflict records are preserved.

**Sources:** [Essential spectral theory and graph drawing, Daniel Spielman](https://www.cs.yale.edu/homes/spielman/561/lect02-18.pdf)

<a id="mf-bellman"></a>

### Shortest-path Bellman recurrence

$$
d(v)=\min_{(u,v)\in E}[d(u)+w(u,v)],\qquad d(s)=0
$$

**ID:** `mf-bellman`

| Symbol | Meaning | Unit |
|---|---|---|
| w | edge cost | cost unit |
| d | minimum path cost from s | cost unit |

**Assumptions**

- No reachable negative cycle when seeking finite unconstrained distances.
- An initialization and update scheme consistent with the graph class is needed.

**Derivation.** Any nonempty shortest route to v ends with an edge u→v; its prefix must be shortest to u, or replacing the prefix would improve the route. This optimal-substructure argument yields the recurrence and underlies dynamic programming.

**Worked check.** Edges s→a cost 2, a→b cost 3, s→b cost 8 produce d(b)=min(8,2+3)=5.

**Limits and common mistakes**

- Dijkstra additionally needs nonnegative edges; the recurrence alone does not authorize it on arbitrary weights.

**Sources:** [Algorithms, chapter 8: Shortest Paths, Jeff Erickson](https://jeffe.cs.illinois.edu/teaching/algorithms/book/08-sssp.pdf)

<a id="mf-newton"></a>

### Newton root iteration

$$
x_{k+1}=x_k-\frac{f(x_k)}{f'(x_k)}
$$

**ID:** `mf-newton`

| Symbol | Meaning | Unit |
|---|---|---|
| x_k | iterate | input unit |
| f | residual function | output unit |

**Assumptions**

- Derivative exists and is nonzero at iterates.
- Quadratic local convergence needs a simple root and smoothness near it.

**Derivation.** Approximate f(x_k+h) by f(x_k)+f′(x_k)h and choose the linearized residual to vanish. The resulting correction is −f/f′. Near a simple root, the omitted Taylor term is quadratic, explaining the local rate.

**Worked check.** For f(x)=x²−2 and x₀=1, iterates are 1.5, 1.41666…, 1.414215….

**Limits and common mistakes**

- The iteration can diverge, cycle or cross a domain boundary; damping and bracketing address specific risks.

**Sources:** [Calculus, Gilbert Strang: MIT OpenCourseWare edition](https://ocw.mit.edu/courses/res-18-001-calculus-fall-2023/pages/open-textbook/)

<a id="mf-gradient"></a>

### Gradient descent descent bound

$$
x^+=x-\eta\nabla f(x),\quad f(x^+)\le f(x)-\eta(1-L\eta/2)\|\nabla f(x)\|^2
$$

**ID:** `mf-gradient`

| Symbol | Meaning | Unit |
|---|---|---|
| η | step size | input²/objective |
| L | gradient Lipschitz constant | objective/input² |

**Assumptions**

- f has L-Lipschitz gradient on the relevant region.
- 0<η<2/L makes the displayed guaranteed decrease positive.

**Derivation.** The smoothness inequality is f(y)≤f(x)+∇f(x)ᵀ(y−x)+(L/2)||y−x||². Substitute y=x−η∇f(x) and collect the linear and quadratic terms. Convexity is not needed for this one-step decrease, but it matters for global optimality guarantees.

**Worked check.** For f(x)=x²/2, L=1 and η=1, one step takes any x to zero.

**Limits and common mistakes**

- In nonconvex optimization a small gradient can indicate a saddle or poor local optimum; noisy gradients require another analysis.

**Sources:** [Convex Optimization, Stephen Boyd and Lieven Vandenberghe](https://web.stanford.edu/~boyd/cvxbook/)

<a id="mf-kkt"></a>

### KKT optimality conditions

$$
\nabla f(x)+\sum_i\lambda_i\nabla g_i(x)+A^T\nu=0,\quad \lambda_i g_i(x)=0
$$

**ID:** `mf-kkt`

| Symbol | Meaning | Unit |
|---|---|---|
| g_i | inequality constraints g_i≤0 | chosen units |
| λ_i | nonnegative dual multipliers | objective/constraint |
| Ax=b | equality constraints | chosen units |

**Assumptions**

- For this gradient form, f and each g_i are differentiable; nonsmooth problems require subgradient conditions. Include primal feasibility, λ_i≥0 and complementary slackness.
- Convexity and a constraint qualification such as Slater's condition give the standard necessity/sufficiency setting.

**Derivation.** Form the Lagrangian f+Σλ_i g_i+νᵀ(Ax−b). At a saddle point, stationarity in x and complementary slackness ensure that inactive constraints exert no dual force. Feasibility then connects the primal optimum with a dual certificate.

**Worked check.** Minimize x² subject to x≥1. Write g=1−x; optimum x=1 has stationarity 2x−λ=0, so λ=2.

**Limits and common mistakes**

- For nonconvex problems KKT conditions can hold at nonglobal points; without a constraint qualification necessity can fail.

**Sources:** [Convex Optimization, Stephen Boyd and Lieven Vandenberghe](https://web.stanford.edu/~boyd/cvxbook/)

<a id="mf-cg"></a>

### Conjugate-gradient condition-number bound

$$
\|e_k\|_A\le2\left(\frac{\sqrt\kappa-1}{\sqrt\kappa+1}\right)^k\|e_0\|_A
$$

**ID:** `mf-cg`

| Symbol | Meaning | Unit |
|---|---|---|
| A | symmetric positive definite matrix | operator unit |
| e_k | solution error | input unit |
| κ | spectral condition number | 1 |

**Assumptions**

- Exact arithmetic and standard CG on SPD A.
- The A-norm is sqrt(eᵀAe).

**Derivation.** CG minimizes the energy error over a Krylov subspace. Its error is a polynomial in A applied to the initial error, constrained to equal one at zero. A scaled Chebyshev polynomial controls that polynomial over the eigenvalue interval and gives the bound.

**Worked check.** With κ=9 the ratio is (3−1)/(3+1)=1/2; the bound is 2·2⁻ᵏ times initial A-error.

**Limits and common mistakes**

- Finite precision and indefinite or nonsymmetric matrices require separate methods or analysis; preconditioners must preserve the chosen solver's assumptions.

**Sources:** [An Introduction to the Conjugate Gradient Method Without the Agonizing Pain, Jonathan Shewchuk](https://www.cs.cmu.edu/afs/cs/Web/People/quake-papers/painless-conjugate-gradient.pdf)

<a id="mf-difference"></a>

### Centered second derivative

$$
f''(x)=\frac{f(x+h)-2f(x)+f(x-h)}{h^2}+O(h^2)
$$

**ID:** `mf-difference`

| Symbol | Meaning | Unit |
|---|---|---|
| h | grid spacing | input unit |
| f'' | curvature | output/input² |

**Assumptions**

- Four derivatives exist and are bounded locally.

**Derivation.** Add the Taylor series at x+h and x−h. Odd powers cancel; the leading remaining difference is h²f″(x), with h⁴f⁽⁴⁾/12 as the next term. Division by h² gives second-order truncation error.

**Worked check.** For f(x)=x² the stencil returns exactly 2 at every nonzero h in exact arithmetic.

**Limits and common mistakes**

- Very small h amplifies rounding and measurement noise by h⁻²; smaller spacing is not automatically more accurate.

**Sources:** [Finite Difference Methods for PDEs, Per-Olof Persson](https://persson.berkeley.edu/math228b/html/finite_difference_methods_for_PDEs.html)

<a id="mf-weakpoisson"></a>

### Weak Poisson formulation

$$
-\Delta u=f,\ u|_{\partial\Omega}=0\quad\Rightarrow\quad\int_\Omega\nabla u\cdot\nabla v=\int_\Omega fv\ \ \forall v\in H_0^1(\Omega)
$$

**ID:** `mf-weakpoisson`

| Symbol | Meaning | Unit |
|---|---|---|
| u | potential or scalar field | field unit |
| f | source | field/length² |
| v | test function | chosen field unit |

**Assumptions**

- Domain and source permit a weak solution; homogeneous Dirichlet data.
- The gradient bilinear form is coercive on H₀¹ under a Poincaré inequality.

**Derivation.** Multiply the PDE by v and integrate. Integration by parts moves one derivative from u to v; the boundary term vanishes because the trace of v is zero. This lowers the smoothness required of u and produces the finite-element stiffness matrix after choosing a basis.

**Worked check.** On (0,1), f=2 gives u=x(1−x). Direct differentiation yields −u″=2, and u vanishes at both endpoints.

**Limits and common mistakes**

- Changing to pure Neumann conditions introduces a constant nullspace and a source compatibility condition.

**Sources:** [Notes on Partial Differential Equations, John K. Hunter](https://www.math.ucdavis.edu/~hunter/pdes/pde_notes.pdf)

<a id="mf-cfl"></a>

### Explicit heat-scheme stability

$$
u_j^{n+1}=u_j^n+r(u_{j+1}^n-2u_j^n+u_{j-1}^n),\qquad 0\le r=\kappa\Delta t/\Delta x^2\le\tfrac12
$$

**ID:** `mf-cfl`

| Symbol | Meaning | Unit |
|---|---|---|
| κ | diffusivity | m²/s |
| Δt,Δx | time and grid spacing | s,m |
| r | dimensionless time step | 1 |

**Assumptions**

- One-dimensional constant-coefficient heat equation on a uniform mesh with compatible boundary handling; κ≥0, Δt>0 and Δx>0.
- The stability statement is for this explicit Euler-centered scheme.

**Derivation.** Insert a discrete Fourier mode e^(ijθ). Its amplification factor is 1−4r sin²(θ/2). Requiring its magnitude not exceed one for every θ gives 0≤r≤1/2. This connects time-step restrictions directly to the highest resolved frequency.

**Worked check.** With κ=1 and Δx=0.1, take Δt≤0.005 for the stated scheme.

**Limits and common mistakes**

- Other dimensions and discretizations have different restrictions; implicit stability does not remove accuracy requirements.

**Sources:** [Finite Difference Methods for PDEs, Per-Olof Persson](https://persson.berkeley.edu/math228b/html/finite_difference_methods_for_PDEs.html)

<a id="mf-contraction"></a>

### Fixed-point convergence and stopping bound

$$
\|T(x)-T(y)\|\le q\|x-y\|,\ q<1,\quad \|x_k-x_*\|\le\frac{q}{1-q}\|x_k-x_{k-1}\|
$$

**ID:** `mf-contraction`

| Symbol | Meaning | Unit |
|---|---|---|
| T | self-map on a complete metric space | state/state |
| q | contraction factor | 1 |

**Assumptions**

- T maps a nonempty complete space to itself and has a global contraction factor q in [0,1).

**Derivation.** Successive differences shrink geometrically. The tail distance from x_k to the limiting fixed point is bounded by the geometric sum of future differences, giving q/(1−q) times the last difference. Completeness places the limit inside the space, and contraction proves uniqueness.

**Worked check.** For T(x)=0.5x+1, the unique fixed point is 2 and the last-step error bound equals the size of the previous change.

**Limits and common mistakes**

- Empirical stability over a few steps does not prove contraction; a budget stop is not a convergence certificate.

**Sources:** [The Contraction Mapping Theorem, Hunter and Nachtergaele](https://www.math.ucdavis.edu/~hunter/book/ch3.pdf)

<a id="mf-tikhonov"></a>

### Ridge/Tikhonov regularization

$$
x_\lambda=(A^TA+\lambda I)^{-1}A^Tb,\qquad \lambda>0
$$

**ID:** `mf-tikhonov`

| Symbol | Meaning | Unit |
|---|---|---|
| λ | quadratic penalty coefficient | A² units after declared scaling |
| x_λ | regularized estimate | input |

**Assumptions**

- Minimize ||Ax−b||²+λ||x||² with compatible units and finite real A.

**Derivation.** Differentiate the penalized objective to get (AᵀA+λI)x=Aᵀb. In SVD coordinates each inverse gain becomes σ/(σ²+λ), bounded even for small σ. Stability is obtained by shrinking the recovered components toward the zero-centered prior preference.

**Worked check.** For a scalar A=0.001 and λ=0.01, the gain is about 0.1 instead of the unregularized 1000.

**Limits and common mistakes**

- Regularization adds bias and requires a scale-dependent λ; it does not create observations of the nullspace.

**Sources:** [Convex Optimization, Stephen Boyd and Lieven Vandenberghe](https://web.stanford.edu/~boyd/cvxbook/); [Linear Algebra, Gilbert Strang, MIT 18.06SC](https://ocw.mit.edu/courses/18-06sc-linear-algebra-fall-2011/)

<a id="mf-lowrank"></a>

### Optimal truncated SVD error

$$
A_k=\sum_{i=1}^k\sigma_i u_iv_i^*,\quad\|A-A_k\|_F^2=\sum_{i>k}\sigma_i^2
$$

**ID:** `mf-lowrank`

| Symbol | Meaning | Unit |
|---|---|---|
| A_k | rank-k approximation | A units |
| σ_i | ordered singular values | A units |

**Assumptions**

- Singular values ordered nonincreasingly; the objective is unweighted Frobenius norm.

**Derivation.** Orthogonality of singular components makes squared error add across discarded modes. The min-max characterization of singular values shows no rank-k matrix can remove more of this error under the same norm.

**Worked check.** For diag(5,2,1), the best rank 1 Frobenius error is √(4+1)=√5.

**Limits and common mistakes**

- Frobenius-optimal compression need not preserve rare but important events, permissions, exact facts or downstream decisions.

**Sources:** [Linear Algebra, Gilbert Strang, MIT 18.06SC](https://ocw.mit.edu/courses/18-06sc-linear-algebra-fall-2011/)

<a id="mf-simpson"></a>

### Composite Simpson integration error

$$
\int_a^b f(x)dx\approx\frac h3[f_0+f_N+4\!\sum_{j\ odd}f_j+2\!\sum_{j\ even,\ 0<j<N}f_j]
$$

**ID:** `mf-simpson`

| Symbol | Meaning | Unit |
|---|---|---|
| h | uniform spacing (b−a)/N | input |
| N | even number of subintervals | 1 |

**Assumptions**

- N is even; f has bounded fourth derivative for the standard error bound.

**Derivation.** Fit a quadratic across each adjacent pair of subintervals and integrate that interpolant. Symmetry makes the rule exact even for cubic polynomials. Summing local remainders yields absolute error at most (b−a)h⁴ max|f⁽⁴⁾|/180.

**Worked check.** On [0,1], f=x², N=2 gives (0.5/3)(0+4·0.25+1)=1/3 exactly.

**Limits and common mistakes**

- Discontinuities or unresolved oscillation invalidate the smooth-error estimate; blindly refining without checking the function class is insufficient.

**Sources:** [Calculus, Gilbert Strang: MIT OpenCourseWare edition](https://ocw.mit.edu/courses/res-18-001-calculus-fall-2023/pages/open-textbook/)

<a id="mf-cauchy"></a>

### Cauchy integral formula

$$
f(z_0)=\frac1{2\pi i}\oint_\gamma\frac{f(z)}{z-z_0}\,dz
$$

**ID:** `mf-cauchy`

| Symbol | Meaning | Unit |
|---|---|---|
| γ | positively oriented simple closed contour | complex length |
| f | holomorphic function inside and on contour | value unit |

**Assumptions**

- f is holomorphic on a neighborhood of the contour and its interior; z₀ lies inside.

**Derivation.** Subtract f(z₀) from f(z) so the apparent singularity at z₀ is removable. The contour integral of the resulting holomorphic quotient vanishes. The remaining integral of 1/(z−z₀) is 2πi by one full winding.

**Worked check.** For f(z)=z² and a unit circle centered at zero, the formula returns f(0)=0.

**Limits and common mistakes**

- Poles inside the contour add residues; real differentiability alone is not sufficient.

**Sources:** [Cauchy's Integral Formula and Power and Laurent Series Expansion, Yum-Tong Siu](https://people.math.harvard.edu/~siu/math113/5_cauchy_integral_formula_power_and_laurent_series_expansion.pdf)

<a id="mf-fourier"></a>

### Fourier transform and Plancherel convention

$$
\hat f(\omega)=\int_\mathbb{R} f(t)e^{-i\omega t}dt,\quad\int|f|^2dt=\frac1{2\pi}\int|\hat f|^2d\omega
$$

**ID:** `mf-fourier`

| Symbol | Meaning | Unit |
|---|---|---|
| t | independent time coordinate | s |
| ω | angular frequency | rad/s |
| fhat | transform amplitude | f unit·s |

**Assumptions**

- Use L¹∩L² for a classical integral; extend to L² in the norm sense.

**Derivation.** Complex exponentials act as generalized orthogonal modes. The inverse under this convention contains 1/(2π); consistency of the pair forces the same factor in the energy identity. Substituting a Gaussian provides an explicit check of normalization.

**Worked check.** For f(t)=exp(−t²/2), fhat(ω)=√(2π)exp(−ω²/2), and both sides equal √π.

**Limits and common mistakes**

- Frequency in cycles per second uses a different exponent and normalization. A finite window causes leakage and finite resolution.
- Hunter uses an alternative 2π normalization; converting to the notebook's unnormalized forward transform moves the factor 1/(2π) into its one-dimensional Plancherel identity.

**Sources:** [Notes on Partial Differential Equations, John K. Hunter](https://www.math.ucdavis.edu/~hunter/pdes/pde_notes.pdf)

<a id="mf-heatkernel"></a>

### Heat equation spectral solution

$$
\partial_tu=\kappa\Delta u,\quad\hat u(k,t)=e^{-\kappa|k|^2t}\hat u(k,0)
$$

**ID:** `mf-heatkernel`

| Symbol | Meaning | Unit |
|---|---|---|
| κ | diffusion coefficient | m²/s |
| k | spatial wavevector | rad/m |
| t | time | s |

**Assumptions**

- Constant κ>0; whole-space or compatible Fourier basis boundary model.

**Derivation.** A spatial Fourier transform turns Δ into multiplication by −|k|². Each mode obeys an exponential-decay ODE. High-frequency modes decay faster, explaining smoothing and the instability of naively multiplying noisy late data by e^(κ|k|²t) to reverse time.

**Worked check.** On a periodic interval, initial sin(3x) evolves as e^(−9κt)sin(3x).

**Limits and common mistakes**

- A forward heat semigroup is dissipative; numerical reversal is not a physical memory restoration mechanism.

**Sources:** [Notes on Partial Differential Equations, John K. Hunter](https://www.math.ucdavis.edu/~hunter/pdes/pde_notes.pdf)

<a id="mf-wave"></a>

### Wave equation dispersion relation

$$
u_{tt}=c^2\Delta u,\quad u=e^{i(k\cdot x-\omega t)}\Rightarrow\omega^2=c^2|k|^2
$$

**ID:** `mf-wave`

| Symbol | Meaning | Unit |
|---|---|---|
| c | wave speed | m/s |
| k | wavevector | rad/m |
| ω | angular frequency | rad/s |

**Assumptions**

- Linear homogeneous isotropic nondispersive medium with constant c.

**Derivation.** Differentiate the plane wave twice in time to get −ω²u and apply the Laplacian to get −|k|²u. Matching coefficients gives the dispersion relation. Superposition holds because the equation is linear.

**Worked check.** A one-dimensional mode with wavelength λ has |k|=2π/λ and ordinary frequency f=c/λ.

**Limits and common mistakes**

- Material dispersion, nonlinearities and boundaries alter the relation or allowed modes; identical frequency does not imply identical physical channel.

**Sources:** [Notes on Partial Differential Equations, John K. Hunter](https://www.math.ucdavis.edu/~hunter/pdes/pde_notes.pdf)

<a id="mf-sobolev"></a>

### Integer Sobolev norm

$$
\|u\|_{H^s(\Omega)}^2=\sum_{|\alpha|\le s}\|D^\alpha u\|_{L^2(\Omega)}^2
$$

**ID:** `mf-sobolev`

| Symbol | Meaning | Unit |
|---|---|---|
| s | nonnegative integer derivative order | 1 |
| α | multi-index | 1 |
| u | function with weak derivatives | field unit |

**Assumptions**

- s is an integer here; weak derivatives through order s are square integrable.
- For dimensional physical variables introduce reference length scales before adding differently dimensioned derivative norms.

**Derivation.** The norm controls both a function and its derivatives in mean square. A Cauchy sequence in this norm converges with its weak derivatives, giving a Hilbert space useful for existence proofs and variational methods.

**Worked check.** A smooth compactly supported function belongs to every finite-order Hˢ. A jump function in one dimension has a delta derivative and generally is not H¹.

**Limits and common mistakes**

- Hˢ regularity is not pointwise Cˢ regularity; embeddings require dimension-dependent thresholds and domain assumptions.

**Sources:** [Notes on Partial Differential Equations, John K. Hunter](https://www.math.ucdavis.edu/~hunter/pdes/pde_notes.pdf)

<a id="mf-laplacebeltrami"></a>

### Metric Laplacian on a manifold

$$
\Delta_gu=\frac1{\sqrt{|g|}}\partial_i\left(\sqrt{|g|}\,g^{ij}\partial_ju\right)
$$

**ID:** `mf-laplacebeltrami`

| Symbol | Meaning | Unit |
|---|---|---|
| g_ij | metric tensor | length² per coordinate² |
| \|g\| | absolute determinant of metric matrix | coordinate-dependent |
| gⁱʲ | inverse metric | inverse metric units |

**Assumptions**

- For the elliptic Laplace–Beltrami operator use a positive-definite Riemannian metric.
- The analogous Lorentzian expression is a wave operator with sign conventions.

**Derivation.** The gradient raises the derivative index with gⁱʲ. Divergence measures flux using the volume density √|g|. Combining the two gives the coordinate expression, ensuring the result is independent of the chosen chart.

**Worked check.** In polar plane coordinates g=diag(1,r²), the formula becomes u_rr+r⁻¹u_r+r⁻²u_θθ.

**Limits and common mistakes**

- Coordinate singularities such as r=0 need regularity conditions; they are not automatically curvature singularities.

**Sources:** [General Relativity, chapter 3: Differential Geometry, David Tong](https://davidtong.org/pdfs/teaching/general-relativity/gr3.pdf)

<a id="mf-curvature"></a>

### Curvature as a covariant-derivative commutator

$$
R(X,Y)Z=\nabla_X\nabla_YZ-\nabla_Y\nabla_XZ-\nabla_{[X,Y]}Z
$$

**ID:** `mf-curvature`

| Symbol | Meaning | Unit |
|---|---|---|
| ∇ | connection | inverse length in physical coordinates |
| X,Y,Z | vector fields | coordinate-dependent |
| R | curvature operator | inverse length² for orthonormal directions |

**Assumptions**

- Smooth connection and vector fields; this equation declares the sign convention.

**Derivation.** Two successive transports in different directions generally disagree. Subtract the reversed order and remove the discrepancy due merely to the noncommuting coordinate vector fields. The remainder is tensorial, defining curvature independently of the extension of local vectors.

**Worked check.** The standard flat connection in Cartesian Euclidean space has R=0, even when curvilinear coordinates make connection coefficients nonzero.

**Limits and common mistakes**

- Different texts reverse the sign; comparing Ricci or Einstein equations requires a consistent convention throughout.

**Sources:** [General Relativity, chapter 3: Differential Geometry, David Tong](https://davidtong.org/pdfs/teaching/general-relativity/gr3.pdf)

<a id="mf-homology"></a>

### Homology: cycles modulo boundaries

$$
H_k=\ker\partial_k/\operatorname{im}\partial_{k+1},\quad\partial_k\partial_{k+1}=0
$$

**ID:** `mf-homology`

| Symbol | Meaning | Unit |
|---|---|---|
| ∂_k | boundary map from k-chains | 1 |
| H_k | kth homology group or vector space | algebraic |

**Assumptions**

- A chain complex with consecutive boundary maps composing to zero.
- Choose coefficient ring or field explicitly.

**Derivation.** A cycle has no boundary, so it lies in ker ∂. Some cycles already bound a higher-dimensional cell and should not count as holes. Since every boundary is a cycle, quotienting by im ∂ is well-defined.

**Worked check.** A triangular wire graph has one independent 1-cycle. Adding its filled triangular face makes that cycle a boundary, so it vanishes in H₁.

**Limits and common mistakes**

- A cycle in a citation graph is not automatically a topological hole in a scientifically meaningful complex.

**Sources:** [Algebraic Topology, Allen Hatcher](https://pi.math.cornell.edu/~hatcher/AT/ATpage.html)

<a id="mf-eulerchar"></a>

### Euler characteristic of a finite complex

$$
\chi=\sum_k(-1)^kc_k=\sum_k(-1)^k\beta_k
$$

**ID:** `mf-eulerchar`

| Symbol | Meaning | Unit |
|---|---|---|
| c_k | number of k-cells | 1 |
| β_k | dimension of kth homology over a chosen field | 1 |

**Assumptions**

- Finite cell or simplicial complex; Betti numbers use a fixed coefficient field.

**Derivation.** Apply rank–nullity to every boundary matrix. The image-rank terms cancel pairwise in the alternating sum, leaving equality between cell counts and homology dimensions. This is a compact check on a chain-complex implementation.

**Worked check.** A tetrahedron surface has V−E+F=4−6+4=2, matching β₀=1, β₁=0, β₂=1.

**Limits and common mistakes**

- Euler characteristic loses information: spaces with the same value can have different topology.

**Sources:** [Algebraic Topology, Allen Hatcher](https://pi.math.cornell.edu/~hatcher/AT/ATpage.html)

<a id="mf-representation"></a>

### Group representations preserve composition

$$
\rho(gh)=\rho(g)\rho(h),\quad\rho(e)=I
$$

**ID:** `mf-representation`

| Symbol | Meaning | Unit |
|---|---|---|
| ρ | homomorphism G→GL(V) | 1 |
| g,h | group elements | abstract |

**Assumptions**

- Matrices are invertible and belong to one scalar field and vector space.

**Derivation.** A group action on a vector space is linear when each group element acts by an invertible linear map. Applying h then g must agree with applying gh, so matrix multiplication matches group composition.

**Worked check.** Planar rotations R(θ) satisfy R(θ+φ)=R(θ)R(φ). Their generator at zero is [[0,−1],[1,0]].

**Limits and common mistakes**

- Different representations can describe the same abstract group; matrix dimension is not group order.

**Sources:** [Fields and Galois Theory, J. S. Milne, version 5.10](https://www.jmilne.org/math/CourseNotes/ft.html)

<a id="mf-galois"></a>

### Finite Galois correspondence

$$
E\longmapsto\operatorname{Gal}(L/E),\qquad H\longmapsto L^H,\qquad [L:E]=|\operatorname{Gal}(L/E)|
$$

**ID:** `mf-galois`

| Symbol | Meaning | Unit |
|---|---|---|
| L/K | finite Galois field extension | abstract |
| E | intermediate field | abstract |
| H | automorphism subgroup | abstract |

**Assumptions**

- L/K is finite, normal and separable.

**Derivation.** Automorphisms fixing E form a subgroup. Conversely the elements fixed by a subgroup form a field. Normality and separability ensure enough automorphisms for these constructions to be inverse, reversing inclusion.

**Worked check.** Q(√2)/Q has two automorphisms, fixing or negating √2, and degree 2.

**Limits and common mistakes**

- For a nongalois extension the simple correspondence and cardinality equality need modification.

**Sources:** [Fields and Galois Theory, J. S. Milne, version 5.10](https://www.jmilne.org/math/CourseNotes/ft.html)

<a id="mf-zeta"></a>

### Zeta Dirichlet series and Euler product

$$
\zeta(s)=\sum_{n=1}^\infty n^{-s}=\prod_{p\ \mathrm{prime}}(1-p^{-s})^{-1},\quad\Re s>1
$$

**ID:** `mf-zeta`

| Symbol | Meaning | Unit |
|---|---|---|
| s | complex argument | 1 |
| p | prime integer | 1 |

**Assumptions**

- Absolute convergence for Re(s)>1.
- Values elsewhere use analytic continuation, not this convergent series.

**Derivation.** Expand each prime factor as a geometric series. Unique factorization identifies every finite prime-power product with exactly one positive integer. Absolute convergence justifies regrouping and taking the infinite product limit.

**Worked check.** At s=2, ζ(2)=π²/6; partial sums approach it from below.

**Limits and common mistakes**

- Substituting s=−1 into the divergent series is invalid; analytic continuation does not make ordinary summation of positive integers negative.

**Sources:** [NIST DLMF 25.2: Definition and Expansions of the Riemann zeta function](https://dlmf.nist.gov/25.2)

<a id="mf-elliptic"></a>

### Short Weierstrass curve and nonsingularity

$$
y^2=x^3+ax+b,\qquad\Delta=-16(4a^3+27b^2)\ne0
$$

**ID:** `mf-elliptic`

| Symbol | Meaning | Unit |
|---|---|---|
| a,b | field coefficients | algebraic |
| Δ | curve discriminant | algebraic |

**Assumptions**

- Field characteristic is neither 2 nor 3 for this normal form.
- Include the point at infinity for the projective elliptic curve and group law.

**Derivation.** A singular point must make both partial derivatives of y²−x³−ax−b vanish. Eliminating x and y yields 4a³+27b²=0. Excluding this condition gives a nonsingular cubic with a well-defined geometric group structure after choosing the point at infinity.

**Worked check.** y²=x³−x has Δ=64, so it is nonsingular in characteristic 0.

**Limits and common mistakes**

- A curve equation is not a solution to the full Birch–Swinnerton-Dyer conjecture; arithmetic ranks require additional tools.

**Sources:** [Elliptic Curves, J. S. Milne, first edition](https://www.jmilne.org/math/Books/ectext6.pdf)

<a id="mf-naturality"></a>

### Naturality square

$$
G(f)\circ\eta_X=\eta_Y\circ F(f)
$$

**ID:** `mf-naturality`

| Symbol | Meaning | Unit |
|---|---|---|
| F,G | functors between fixed categories | abstract |
| η_X | component map F(X)→G(X) | abstract |
| f | morphism X→Y | abstract |

**Assumptions**

- Composition domains and codomains agree for every f.

**Derivation.** A family of component maps is coherent only if converting before or after applying any source morphism gives the same result. This equation makes that requirement explicit and prevents arbitrary object-by-object correspondences from masquerading as a structure-preserving transformation.

**Worked check.** Double-dual evaluation maps on finite-dimensional vector spaces commute with every linear map, giving a natural transformation to the double-dual functor.

**Limits and common mistakes**

- A diagram that merely looks symmetric does not establish naturality; every relevant morphism must satisfy the condition.

**Sources:** [Basic Category Theory, Tom Leinster, version 2](https://arxiv.org/abs/1612.09375v2)

<a id="mf-yoneda"></a>

### Yoneda lemma

$$
\operatorname{Nat}(\operatorname{Hom}(A,-),F)\cong F(A)
$$

**ID:** `mf-yoneda`

| Symbol | Meaning | Unit |
|---|---|---|
| A | object of a locally small category | abstract |
| F | covariant functor to Set | abstract |

**Assumptions**

- Category is locally small and F is covariant for the displayed form.

**Derivation.** Map a natural transformation η to η_A(id_A). Conversely an element x∈F(A) defines η_B(f)=F(f)(x). Functoriality establishes naturality, and evaluating at identity shows these constructions are inverse.

**Worked check.** For vector spaces, natural ways of evaluating maps out of A are determined by the image of a distinguished element under those maps.

**Limits and common mistakes**

- The lemma concerns formal morphism structure, not the claim that every object or memory is completely known from finite observed associations.

**Sources:** [Basic Category Theory, Tom Leinster, version 2](https://arxiv.org/abs/1612.09375v2)

<a id="mf-permanent"></a>

### Permanent versus determinant

$$
\operatorname{per}(A)=\sum_{\sigma\in S_n}\prod_i a_{i,\sigma(i)},\qquad\det(A)=\sum_{\sigma\in S_n}\operatorname{sgn}(\sigma)\prod_i a_{i,\sigma(i)}
$$

**ID:** `mf-permanent`

| Symbol | Meaning | Unit |
|---|---|---|
| A | n×n matrix over a field | algebraic |
| S_n | permutation group | abstract |

**Assumptions**

- For complexity claims state the arithmetic field and the circuit model.

**Derivation.** Both expressions sum one selected entry from each row and column. The determinant includes cancellation by permutation sign, enabling elimination-based algorithms. The permanent removes that sign and measures weighted perfect matchings of a bipartite graph.

**Worked check.** For a 2×2 matrix, permanent is ad+bc while determinant is ad−bc. In characteristic 2 these coincide.

**Limits and common mistakes**

- An arithmetic VP/VNP separation does not automatically imply Boolean P≠NP; characteristic 2 is a material exception for permanent bounds.

**Sources:** [VP ≠ VNP over every field: statement and research artifact](https://github.com/anthropics/formal-math/tree/11b6c7e3c927df2658f513b6b68ea7f8929c62c5/vp-vnp)

<a id="mf-dagtime"></a>

### Critical path in a dependency DAG

$$
T(v)=c(v)+\max_{u\to v}T(u)
$$

**ID:** `mf-dagtime`

| Symbol | Meaning | Unit |
|---|---|---|
| c(v) | duration or cost of task v | time |
| T(v) | earliest completion with unlimited parallel capacity | time |

**Assumptions**

- Finite DAG; tasks wait for all predecessors; independent tasks can run concurrently without resource contention.
- Use maximum of an empty predecessor set as0.

**Derivation.** A task cannot start before the slowest predecessor finishes. Add its own duration and compute in topological order. The maximum completion among terminal tasks is a lower bound for schedules with limited workers.

**Worked check.** Two independent tasks lasting 2 and 5 followed by a3-unit merge need 8 units, even though total work is10.

**Limits and common mistakes**

- Limited agents, locks, API quotas and shared hardware can make the actual schedule longer; this bound is not a cost or runtime guarantee.

**Sources:** [Algorithms, chapter 8: Shortest Paths, Jeff Erickson](https://jeffe.cs.illinois.edu/teaching/algorithms/book/08-sssp.pdf)

## memory

<a id="gf-adjacency"></a>

### Adjacency and weighted degree

$$
A_{ij}=w_{ij},\qquad d_i=\sum_j A_{ij},\qquad D=\operatorname{diag}(d_i)
$$

**ID:** `gf-adjacency`

| Symbol | Meaning | Unit |
|---|---|---|
| A | edge-weight matrix | dimensionless |
| d_i | outgoing weighted degree | dimensionless |

**Assumptions**

- Declare whether rows encode outgoing edges.
- Weights are nonnegative for a random-walk interpretation.

**Derivation.** Place each edge weight at its row and column. Summing a row counts outgoing weight; this is bookkeeping, not an inferred relationship.

**Worked check.** A unit-weight path of three vertices has degrees (1,2,1) when represented as an undirected graph.

**Limits and common mistakes**

- A directed graph generally has different incoming and outgoing degree.

**Sources:** [The PageRank Citation Ranking: Bringing Order to the Web](https://ilpubs.stanford.edu/422/)

<a id="gf-laplacian"></a>

### Combinatorial Laplacian

$$
L=D-A,\qquad L\mathbf 1=0
$$

**ID:** `gf-laplacian`

| Symbol | Meaning | Unit |
|---|---|---|
| L | graph difference operator | dimensionless |
| A | symmetric adjacency | dimensionless |

**Assumptions**

- Undirected graph with nonnegative weights.

**Derivation.** Row i acts on x by summing w_ij(x_i-x_j); a constant signal produces zero differences.

**Worked check.** For the three-vertex path, L=[[1,-1,0],[-1,2,-1],[0,-1,1]], with eigenvalues 0,1,3.

**Limits and common mistakes**

- L is singular on each connected component. A directed version needs a separately stated convention.

**Sources:** [Daftar graph-memory implementation and executed tests](https://github.com/occult-kranti/engineering-intelligence-atlas/tree/main/projects/research-memory-atlas)

<a id="gf-dirichlet"></a>

### Dirichlet quadratic form

$$
x^TLx=\frac12\sum_{i,j}w_{ij}(x_i-x_j)^2
$$

**ID:** `gf-dirichlet`

| Symbol | Meaning | Unit |
|---|---|---|
| x | vertex signal | signal unit |
| w_ij | symmetric weight | weight unit |

**Assumptions**

- Symmetric nonnegative weights.
- The double sum counts both orientations.

**Derivation.** Expand the square and collect the two degree terms; symmetry turns both into x^TDx, while cross terms give twice x^TAx.

**Worked check.** For path values (1,0,-1), the two undirected edge differences both equal 1, hence x^TLx=2.

**Limits and common mistakes**

- Units are weight times signal squared. Calling this physical energy requires an additional physical model.

**Sources:** [Daftar graph-memory implementation and executed tests](https://github.com/occult-kranti/engineering-intelligence-atlas/tree/main/projects/research-memory-atlas)

<a id="gf-grounded"></a>

### Grounded Poisson problem

$$
L_{II}u_I=b_I-L_{IB}u_B
$$

**ID:** `gf-grounded`

| Symbol | Meaning | Unit |
|---|---|---|
| I | interior vertex indices | dimensionless |
| B | fixed boundary indices | dimensionless |
| u | potential-like signal | signal unit |
| b | source vector | weight × signal |

**Assumptions**

- Every connected component of interior vertices reaches a fixed boundary.
- Boundary values and compatible source units are specified.

**Derivation.** Partition Lu=b into interior and boundary blocks; move the known boundary term to the right. The grounded interior operator is positive definite under the connectivity assumption.

**Worked check.** For a three-point path with endpoints 1 and 0 and no interior source, 2u_middle=1, so u_middle=0.5.

**Limits and common mistakes**

- Without grounding or compatibility constraints, inversion is not unique or may be inconsistent.

**Sources:** [Daftar graph-memory implementation and executed tests](https://github.com/occult-kranti/engineering-intelligence-atlas/tree/main/projects/research-memory-atlas)

<a id="gf-heat"></a>

### Graph heat flow

$$
\frac{dx}{dt}=-\kappa Lx,\qquad x(t)=e^{-\kappa Lt}x(0)
$$

**ID:** `gf-heat`

| Symbol | Meaning | Unit |
|---|---|---|
| t | time or algorithmic diffusion scale | s or declared iteration scale |
| kappa | diffusion coefficient | inverse time when L is dimensionless |

**Assumptions**

- Fixed symmetric nonnegative graph.
- Linear dynamics.

**Derivation.** Diagonalize L=UΛUᵀ; each mode obeys a scalar decay equation with solution exp(-κλt).

**Worked check.** A mode with λ=2 and κ=1 s^-1 decays to exp(-2)≈0.1353 of its initial amplitude after 1 s.

**Limits and common mistakes**

- Smoothing can remove a rare but essential distinction. A diffusion parameter is not automatically a biological timescale.

**Sources:** [Daftar graph-memory implementation and executed tests](https://github.com/occult-kranti/engineering-intelligence-atlas/tree/main/projects/research-memory-atlas)

<a id="gf-graph-wave"></a>

### Graph wave modes

$$
\ddot x+\omega_0^2 Lx=0,\qquad \omega_k=\omega_0\sqrt{\lambda_k}
$$

**ID:** `gf-graph-wave`

| Symbol | Meaning | Unit |
|---|---|---|
| omega_0 | chosen dynamical scale | rad/s |
| lambda_k | Laplacian eigenvalue | dimensionless |
| omega_k | mode angular frequency | rad/s |

**Assumptions**

- A physical or simulated second-order dynamical law is explicitly posited.
- L is positive semidefinite.

**Derivation.** Project onto each eigenvector to obtain an independent harmonic-oscillator equation.

**Worked check.** For path eigenvalue λ=3 and ω0=2 rad/s, the mode has ω=2√3 rad/s.

**Limits and common mistakes**

- A note graph alone has no clock, mass, stiffness, or measured acoustic frequency.

**Sources:** [Daftar graph-memory implementation and executed tests](https://github.com/occult-kranti/engineering-intelligence-atlas/tree/main/projects/research-memory-atlas)

<a id="gf-transition"></a>

### Row-stochastic transition

$$
P_{ij}=A_{ij}/d_i\quad(d_i>0)
$$

**ID:** `gf-transition`

| Symbol | Meaning | Unit |
|---|---|---|
| P_ij | one-step transition probability | dimensionless |
| d_i | outgoing weight | dimensionless |

**Assumptions**

- Nonnegative weights.
- A separate redistribution rule is defined for dangling rows.

**Derivation.** Divide each outgoing weight by the row sum, producing total probability one.

**Worked check.** Weights (2,1) yield outgoing probabilities (2/3,1/3).

**Limits and common mistakes**

- Negative relations cannot be inserted as negative probabilities. Keep contradicts as a separate semantic channel.

**Sources:** [The PageRank Citation Ranking: Bringing Order to the Web](https://ilpubs.stanford.edu/422/)

<a id="gf-ppr"></a>

### Personalized PageRank

$$
p_{t+1}=\alpha P^Tp_t+(1-\alpha)s,\qquad p_*=(1-\alpha)(I-\alpha P^T)^{-1}s
$$

**ID:** `gf-ppr`

| Symbol | Meaning | Unit |
|---|---|---|
| s | query seed distribution | dimensionless |
| p | probability mass over eligible vertices | dimensionless |
| alpha | walk probability | dimensionless |

**Assumptions**

- 0≤α<1.
- P is row-stochastic after dangling-node handling.
- s is nonnegative and sums to one.

**Derivation.** At a fixed point, collect terms in p. Invertibility follows because the spectral radius of αPᵀ is below one. The Neumann series sums walks of every length with geometric damping.

**Worked check.** For two alternating vertices, seed (1,0), and α=0.85, p=(1/1.85,0.85/1.85)≈(0.54054,0.45946).

**Limits and common mistakes**

- Stationary mass measures graph affinity. It is not probability that a scientific claim is correct.

**Sources:** [HippoRAG: Neurobiologically Inspired Long-Term Memory for Large Language Models](https://arxiv.org/abs/2405.14831); [The PageRank Citation Ranking: Bringing Order to the Web](https://ilpubs.stanford.edu/422/)

<a id="gf-ppr-error"></a>

### PageRank residual bound

$$
\lVert p_t-p_*\rVert_1\leq\frac{\lVert p_{t+1}-p_t\rVert_1}{1-\alpha}
$$

**ID:** `gf-ppr-error`

| Symbol | Meaning | Unit |
|---|---|---|
| p_t | current iterate | dimensionless |
| p_* | unique fixed point | dimensionless |
| alpha | contraction factor bound | dimensionless |

**Assumptions**

- Stochastic transition with 0≤α<1.

**Derivation.** The future increments are bounded by a geometric sequence. Sum their norms to bound the distance from the current iterate to the limit.

**Worked check.** At α=0.85 and residual 10^-10, this bound is at most 6.67×10^-10.

**Limits and common mistakes**

- An iteration cap can stop before this bound is small; record residual and iteration count.

**Sources:** [Daftar graph-memory implementation and executed tests](https://github.com/occult-kranti/engineering-intelligence-atlas/tree/main/projects/research-memory-atlas)

<a id="gf-idf"></a>

### Positive inverse document frequency

$$
\operatorname{idf}(t)=\log\left(1+\frac{N-n_t+0.5}{n_t+0.5}\right)
$$

**ID:** `gf-idf`

| Symbol | Meaning | Unit |
|---|---|---|
| N | eligible document count | dimensionless |
| n_t | eligible documents containing term t | dimensionless |

**Assumptions**

- Compute statistics only over authorized active documents.
- Natural logarithm is used.

**Derivation.** The smoothed frequency ratio increases as a term becomes rarer; the outer 1 keeps this common BM25 variant positive.

**Worked check.** With N=100 and n_t=1, idf=ln(1+99.5/1.5)≈4.210.

**Limits and common mistakes**

- Changing the corpus changes IDF. It does not measure the truth or novelty of a claim.

**Sources:** [The Probabilistic Relevance Framework: BM25 and Beyond](https://doi.org/10.1561/1500000019)

<a id="gf-bm25"></a>

### BM25 retrieval score

$$
S(q,d)=\sum_{t\in q}\operatorname{idf}(t)\frac{f_{t,d}(k_1+1)}{f_{t,d}+k_1(1-b+b|d|/\overline{|d|})}
$$

**ID:** `gf-bm25`

| Symbol | Meaning | Unit |
|---|---|---|
| f_t,d | term count | dimensionless |
| k_1 | term saturation parameter | dimensionless |
| b | length-normalization parameter | dimensionless |
| \|d\| | document token count | tokens |

**Assumptions**

- Chosen tokenizer and document construction are fixed.
- Implementation uses k1=1.2 and b=0.75.

**Derivation.** The fractional term grows with term frequency but saturates. Length normalization changes the denominator according to relative document length.

**Worked check.** If a document has average length and term frequency 1, the fraction equals 1, leaving exactly its IDF contribution.

**Limits and common mistakes**

- These constants are a baseline, not optimized for this corpus. Repeated labels receive deliberate extra weight.

**Sources:** [The Probabilistic Relevance Framework: BM25 and Beyond](https://doi.org/10.1561/1500000019)

<a id="gf-cosine"></a>

### Cosine similarity

$$
\operatorname{sim}(x,y)=\frac{x^Ty}{\lVert x\rVert_2\lVert y\rVert_2}
$$

**ID:** `gf-cosine`

| Symbol | Meaning | Unit |
|---|---|---|
| x,y | nonzero embedding vectors | dimensionless |
| sim | directional similarity | dimensionless |

**Assumptions**

- Both vectors have nonzero norm.
- Both come from the same compatible embedding space.

**Derivation.** Divide the inner product by magnitudes to isolate the angle between vectors.

**Worked check.** Vectors (1,0) and (1,1) have cosine 1/√2≈0.7071.

**Limits and common mistakes**

- High similarity can link incompatible claims. Embeddings are a documented future adapter, not used in the implemented baseline.

**Sources:** [From RAG to Memory: Non-Parametric Continual Learning for Large Language Models](https://arxiv.org/html/2502.14802v2)

<a id="gf-rrf"></a>

### Weighted reciprocal rank fusion

$$
R(d)=\sum_j\frac{w_j}{c+r_j(d)}
$$

**ID:** `gf-rrf`

| Symbol | Meaning | Unit |
|---|---|---|
| r_j | one-based rank in retrieval channel j | dimensionless |
| w_j | declared channel weight | dimensionless |
| c | rank damping constant | dimensionless |

**Assumptions**

- Missing items contribute zero.
- Ranks start at one.

**Derivation.** Replace incomparable raw scores with reciprocal rank contributions, then sum channels. The implemented weights are 1 for lexical and 0.7 for graph, with c=60.

**Worked check.** An item ranked first in both channels scores 1.7/61≈0.027869; this is a ranking score, not 2.79% confidence.

**Limits and common mistakes**

- Weights need held-out evaluation; a dense graph can still introduce irrelevant linked items.

**Sources:** [Reciprocal Rank Fusion outperforms Condorcet and individual Rank Learning Methods](https://cormack.uwaterloo.ca/cormack/cormacksigir09-rrf.pdf)

<a id="gf-mmr"></a>

### Relevance and redundancy tradeoff

$$
d_* =\arg\max_{d\notin S}\left[\lambda\,r(q,d)-(1-\lambda)\max_{s\in S}\operatorname{sim}(d,s)\right]
$$

**ID:** `gf-mmr`

| Symbol | Meaning | Unit |
|---|---|---|
| S | already selected evidence set | dimensionless |
| lambda | relevance-diversity preference | dimensionless |

**Assumptions**

- Comparable, bounded relevance and similarity scales.
- 0≤λ≤1.

**Derivation.** A greedy step rewards query relevance and penalizes similarity to selected evidence. This defines an engineering policy rather than a general optimum.

**Worked check.** At λ=0.7, relevance 0.9 and maximum redundancy 0.8 give 0.63-0.24=0.39.

**Limits and common mistakes**

- Not implemented in the initial retrieval core; retained as an evaluable extension.

**Sources:** [Daftar graph-memory implementation and executed tests](https://github.com/occult-kranti/engineering-intelligence-atlas/tree/main/projects/research-memory-atlas)

<a id="gf-entropy"></a>

### Shannon entropy of a declared distribution

$$
H(X)=-\sum_x p(x)\log_2 p(x)
$$

**ID:** `gf-entropy`

| Symbol | Meaning | Unit |
|---|---|---|
| p(x) | probability of outcome x | dimensionless |
| H | uncertainty | bits |

**Assumptions**

- A normalized distribution and outcome space are specified.
- Use 0 log 0=0 by continuity.

**Derivation.** Weight each outcome's self-information by its probability. This measures uncertainty of that distribution, not semantic wisdom.

**Worked check.** A fair binary variable has entropy 1 bit; a deterministic variable has entropy 0.

**Limits and common mistakes**

- Low entropy may reflect unwarranted certainty. It is not evidence quality.

**Sources:** [Daftar graph-memory implementation and executed tests](https://github.com/occult-kranti/engineering-intelligence-atlas/tree/main/projects/research-memory-atlas)

<a id="gf-latency"></a>

### Expected local cache latency

$$
\mathbb{E}[T]=hT_{\mathrm{hit}}+(1-h)T_{\mathrm{miss}}
$$

**ID:** `gf-latency`

| Symbol | Meaning | Unit |
|---|---|---|
| h | observed hit fraction | dimensionless |
| T_hit | complete hit latency | ms |
| T_miss | complete miss latency | ms |

**Assumptions**

- Hit and miss latencies include the same measurement boundaries.
- Workload hit fraction is representative.

**Derivation.** Condition total expectation on the two disjoint cases. If miss cost is measured after lookup instead, add the lookup cost separately.

**Worked check.** With h=0.8, a 2 ms hit and a 40 ms complete miss, E[T]=9.6 ms.

**Limits and common mistakes**

- Mean latency does not describe p95 or concurrent queueing. These numbers are an example, not a measured product result.

**Sources:** [Daftar graph-memory implementation and executed tests](https://github.com/occult-kranti/engineering-intelligence-atlas/tree/main/projects/research-memory-atlas)

<a id="gf-amat"></a>

### Two-level average memory access time

$$
T_{\mathrm{avg}}=T_1+m_1(T_2+m_2T_3)
$$

**ID:** `gf-amat`

| Symbol | Meaning | Unit |
|---|---|---|
| T_1,T_2,T_3 | incremental tier access costs | time |
| m_1 | tier-1 miss probability | dimensionless |
| m_2 | conditional tier-2 miss probability | dimensionless |

**Assumptions**

- Each lower-tier cost is incurred only after an upper-tier miss.
- Use incremental costs, not complete inclusive timings.

**Derivation.** Expand a decision tree: every request pays T1, m1 of requests pay T2, and m1m2 pay T3.

**Worked check.** T1=1, T2=10, T3=100, m1=0.1, m2=0.2 yield 4 time units.

**Limits and common mistakes**

- Correlated workloads and overlapping asynchronous fetches require a different timing model.

**Sources:** [Efficient stack distance computation for priority replacement policies](https://research.ibm.com/publications/efficient-stack-distance-computation-for-priority-replacement-policies)

<a id="gf-ttl-probability"></a>

### Poisson-update freshness model

$$
\Pr(\text{at least one update in }t)=1-e^{-\lambda t}
$$

**ID:** `gf-ttl-probability`

| Symbol | Meaning | Unit |
|---|---|---|
| lambda | assumed update rate | updates/s |
| t | cache age | s |

**Assumptions**

- Updates are modeled as a homogeneous Poisson process.

**Derivation.** The no-update probability is the zero-count Poisson mass exp(-λt); subtract from one.

**Worked check.** With λ=1 update/hour and age 0.5 hour, probability of an intervening update is about 0.3935.

**Limits and common mistakes**

- Real source changes are often bursty or adversarial. Versioned invalidation is stronger than this heuristic.

**Sources:** [Daftar graph-memory implementation and executed tests](https://github.com/occult-kranti/engineering-intelligence-atlas/tree/main/projects/research-memory-atlas)

<a id="gf-lru-distance"></a>

### Fully associative LRU hit condition

$$
\text{hit at capacity }C\iff d_{\mathrm{reuse}}<C
$$

**ID:** `gf-lru-distance`

| Symbol | Meaning | Unit |
|---|---|---|
| d_reuse | distinct other items since previous access | dimensionless |
| C | capacity | uniform-sized items |

**Assumptions**

- Fully associative LRU.
- Uniform-sized entries and no external invalidation.
- First use has infinite reuse distance.

**Derivation.** Every distinct intervening item moves the reused entry down one position in the recency stack; capacity C retains the first C positions.

**Worked check.** Trace A,B,C,A has reuse distance 2 for the last A: it misses at capacity 2 and hits at capacity 3.

**Limits and common mistakes**

- The supplied persisted cache is FIFO and does not claim this LRU guarantee.

**Sources:** [Efficient stack distance computation for priority replacement policies](https://research.ibm.com/publications/efficient-stack-distance-computation-for-priority-replacement-policies)

<a id="gf-cache-key"></a>

### Complete cache dependency key

$$
K=\operatorname{SHA256}(\operatorname{canon}(q,V,A,S,P,T,\theta))
$$

**ID:** `gf-cache-key`

| Symbol | Meaning | Unit |
|---|---|---|
| q | query and result bounds | dimensionless |
| V | source snapshot identity | dimensionless |
| A | algorithm version | dimensionless |
| S | authorized scope set | dimensionless |
| P | policy version | dimensionless |
| T | active temporal subgraph | dimensionless |
| theta | retrieval parameters | dimensionless |

**Assumptions**

- Canonical serialization is deterministic.
- All output-relevant dependencies are included.
- Cryptographic hash collisions are assumed negligible.

**Derivation.** Treat the result as a function of declared inputs. Equal keys justify reuse only insofar as the serialization captures every relevant input.

**Worked check.** A source URL correction changes V and therefore the key even when the node summary text is unchanged.

**Limits and common mistakes**

- A digest does not validate the source, authenticate a caller, or prove semantic equivalence.

**Sources:** [Daftar graph-memory implementation and executed tests](https://github.com/occult-kranti/engineering-intelligence-atlas/tree/main/projects/research-memory-atlas)

<a id="gf-budget-knapsack"></a>

### Evidence selection under a byte budget

$$
\max_{z_i\in\{0,1\}}\sum_i u_i z_i\quad\text{s.t.}\quad\sum_i b_i z_i\le B
$$

**ID:** `gf-budget-knapsack`

| Symbol | Meaning | Unit |
|---|---|---|
| u_i | declared utility | dimensionless |
| b_i | serialized evidence size | bytes |
| B | context allowance | bytes |

**Assumptions**

- Utilities and sizes are specified.
- Independent additive utility is an approximation.

**Derivation.** A constrained subset problem formalizes why not every retrieved item fits. The implementation greedily tries ranked packets and checks actual UTF-8 bytes.

**Worked check.** With sizes 6 and 5 and budget 5, only the second item fits, regardless of the first item's better rank.

**Limits and common mistakes**

- Greedy rank order does not solve general knapsack optimally; correlated evidence requires nonadditive utility.

**Sources:** [Daftar graph-memory implementation and executed tests](https://github.com/occult-kranti/engineering-intelligence-atlas/tree/main/projects/research-memory-atlas)

<a id="gf-bfs"></a>

### Traversal complexity

$$
T_{\mathrm{BFS}}=O(|V_r|+|E_r|),\qquad M=O(|V_r|)
$$

**ID:** `gf-bfs`

| Symbol | Meaning | Unit |
|---|---|---|
| V_r | visited vertices | dimensionless |
| E_r | examined edges | dimensionless |

**Assumptions**

- Adjacency lists and a visited set.
- Constant-time set operations are an average-case assumption.

**Derivation.** Each vertex enters the queue once and each relevant adjacency is examined a bounded number of times.

**Worked check.** In a cycle A→B→C→A, the visited set stops the fourth enqueue of A.

**Limits and common mistakes**

- Building the eligible subgraph and adjacency has its own whole-graph cost; report that in end-to-end benchmarks.

**Sources:** [Daftar graph-memory implementation and executed tests](https://github.com/occult-kranti/engineering-intelligence-atlas/tree/main/projects/research-memory-atlas)

<a id="gf-topological"></a>

### DAG topological condition

$$
|\operatorname{Kahn}(G)|=|V|\iff G\text{ is a DAG}
$$

**ID:** `gf-topological`

| Symbol | Meaning | Unit |
|---|---|---|
| G | finite directed prerequisite graph | dimensionless |
| V | vertices | dimensionless |

**Assumptions**

- Remove vertices of zero indegree and their outgoing edges.

**Derivation.** A finite acyclic directed graph has a zero-indegree vertex. A cycle leaves each of its vertices with an incoming edge, preventing complete elimination.

**Worked check.** A requires B and B requires A gives no valid topological order; C depending on A can also remain blocked.

**Limits and common mistakes**

- Remaining blocked vertices are not necessarily all members of a cycle.

**Sources:** [Daftar graph-memory implementation and executed tests](https://github.com/occult-kranti/engineering-intelligence-atlas/tree/main/projects/research-memory-atlas)

<a id="gf-hebb"></a>

### Simple Hebbian weight construction

$$
W_{ij}=\frac1N\sum_{\mu=1}^{P}\xi_i^{(\mu)}\xi_j^{(\mu)},\qquad W_{ii}=0
$$

**ID:** `gf-hebb`

| Symbol | Meaning | Unit |
|---|---|---|
| xi | stored binary patterns | dimensionless |
| N | number of units | dimensionless |
| P | number of patterns | dimensionless |

**Assumptions**

- A specified binary-pattern associative model.
- This is a theoretical rule, not a universal synaptic law.

**Derivation.** Correlated components contribute positive weights and opposite components negative weights; summing patterns superposes their associations.

**Worked check.** For one pattern (1,-1), the off-diagonal weights are -1/2 under N=2 normalization.

**Limits and common mistakes**

- Interference and spurious attractors occur. Coactivation does not imply causal evidence.

**Sources:** [Neural networks and physical systems with emergent collective computational abilities](https://pmc.ncbi.nlm.nih.gov/articles/PMC346238/)

<a id="gf-hopfield-energy"></a>

### Binary Hopfield Lyapunov function

$$
E(s)=-\frac12s^TWs+\theta^Ts
$$

**ID:** `gf-hopfield-energy`

| Symbol | Meaning | Unit |
|---|---|---|
| s_i | binary unit state, ±1 | dimensionless |
| W | symmetric coupling matrix | dimensionless |
| theta | threshold vector | dimensionless |

**Assumptions**

- W=Wᵀ and diagonal zero.
- Asynchronous single-unit updates align with the local field.

**Derivation.** If only state i changes, ΔE=-(s_i'−s_i)(Σ_j W_ij s_j−θ_i). Choosing the state aligned with the field makes this nonpositive.

**Worked check.** Two positively coupled units lower this function by agreeing rather than disagreeing, for zero thresholds.

**Limits and common mistakes**

- Synchronous updates can oscillate. The function is not automatically a joule-valued physical energy.

**Sources:** [Neural networks and physical systems with emergent collective computational abilities](https://pmc.ncbi.nlm.nih.gov/articles/PMC346238/)

<a id="gf-attention"></a>

### Scaled dot-product attention

$$
\operatorname{Attention}(Q,K,V)=\operatorname{softmax}(QK^T/\sqrt{d_k})V
$$

**ID:** `gf-attention`

| Symbol | Meaning | Unit |
|---|---|---|
| Q,K,V | query, key, and value matrices | dimensionless |
| d_k | key dimension | dimensionless |

**Assumptions**

- Matrix dimensions are compatible.
- Softmax operates across available keys, with any mask explicitly stated.

**Derivation.** Dot products give compatibility logits; scaling moderates their growth with dimension, softmax normalizes, and the resulting weights mix values.

**Worked check.** For two equal unmasked logits, each value receives weight 1/2.

**Limits and common mistakes**

- A KV cache stores intermediate tensors; it is different from external source-linked memory.

**Sources:** [Attention Is All You Need](https://papers.neurips.cc/paper_files/paper/2017/hash/3f5ee243547dee91fbd053c1c4a845aa-Abstract.html); [Hopfield Networks is All You Need](https://arxiv.org/abs/2008.02217)

<a id="gf-retention"></a>

### Exponential retrieval-priority heuristic

$$
w(t)=w_0e^{-t/\tau}
$$

**ID:** `gf-retention`

| Symbol | Meaning | Unit |
|---|---|---|
| w_0 | initial priority | dimensionless |
| tau | chosen decay timescale | time |
| t | elapsed time | time |

**Assumptions**

- A software prioritization rule is explicitly chosen.

**Derivation.** Solve dw/dt=−w/τ. This defines a convenient recency prior; it is not fitted biological evidence.

**Worked check.** After time τ, weight is w0/e≈0.3679w0.

**Limits and common mistakes**

- Never let an arbitrary decay delete provenance or turn an established theorem false.

**Sources:** [Daftar graph-memory implementation and executed tests](https://github.com/occult-kranti/engineering-intelligence-atlas/tree/main/projects/research-memory-atlas)

<a id="gf-precision"></a>

### Evidence precision and recall

$$
\operatorname{Precision}=\frac{|R\cap G|}{|R|},\qquad\operatorname{Recall}=\frac{|R\cap G|}{|G|}
$$

**ID:** `gf-precision`

| Symbol | Meaning | Unit |
|---|---|---|
| R | retrieved evidence IDs | dimensionless |
| G | judged relevant evidence IDs | dimensionless |

**Assumptions**

- Gold relevance and evidence units are specified.
- Define behavior for empty denominators before evaluation.

**Derivation.** Precision asks how much retrieved evidence is relevant; recall asks how much relevant evidence was found.

**Worked check.** Retrieving 5 items, 3 relevant, from 4 relevant items gives precision 0.6 and recall 0.75.

**Limits and common mistakes**

- Gold labels can be incomplete; duplicate passages must not inflate independent support.

**Sources:** [LongMemEval: Benchmarking Chat Assistants on Long-Term Interactive Memory](https://arxiv.org/abs/2410.10813); [The evolution of GraphRAG: Advancing systems and evaluation together](https://www.microsoft.com/en-us/research/story/the-evolution-of-graphrag-advancing-systems-and-evaluation-together/)

<a id="gf-ndcg"></a>

### Discounted cumulative gain

$$
\operatorname{DCG}@k=\sum_{i=1}^k\frac{2^{rel_i}-1}{\log_2(i+1)},\qquad\operatorname{nDCG}@k=\operatorname{DCG}@k/\operatorname{IDCG}@k
$$

**ID:** `gf-ndcg`

| Symbol | Meaning | Unit |
|---|---|---|
| rel_i | declared relevance grade | dimensionless |
| IDCG | ideal score under the same labels | dimensionless |

**Assumptions**

- Nonnegative relevance grades.
- Define the all-zero relevance case.

**Derivation.** Higher-ranked relevant items contribute more. Divide by the best available ordering to normalize the score.

**Worked check.** For binary relevance (1,0,1), DCG@3=1+0+1/2=1.5.

**Limits and common mistakes**

- Metric choice does not certify answer correctness or source trustworthiness.

**Sources:** [Daftar graph-memory implementation and executed tests](https://github.com/occult-kranti/engineering-intelligence-atlas/tree/main/projects/research-memory-atlas)

<a id="gf-brier"></a>

### Brier calibration score

$$
B=\frac1n\sum_{i=1}^n(p_i-y_i)^2
$$

**ID:** `gf-brier`

| Symbol | Meaning | Unit |
|---|---|---|
| p_i | predicted event probability | dimensionless |
| y_i | binary observed outcome | dimensionless |
| n | number of evaluated predictions | dimensionless |

**Assumptions**

- A well-defined population of binary outcomes.
- Predictions precede observed outcomes.

**Derivation.** Use the squared error of probabilistic predictions and average over evaluated cases.

**Worked check.** Predictions (0.8,0.2) for outcomes (1,0) have Brier score 0.04.

**Limits and common mistakes**

- Graph ranks and RRF scores are not probabilities and must not be inserted directly as calibrated confidence.

**Sources:** [Daftar graph-memory implementation and executed tests](https://github.com/occult-kranti/engineering-intelligence-atlas/tree/main/projects/research-memory-atlas)

<a id="gf-novelty-loop"></a>

### Measured improvement in a fixed loop

$$
\Delta U_k=U(\text{system}_{k+1};D)-U(\text{system}_{k};D)
$$

**ID:** `gf-novelty-loop`

| Symbol | Meaning | Unit |
|---|---|---|
| D | frozen evaluation data and criteria | dimensionless |
| U | declared utility metric | dimensionless |
| k | revision index | dimensionless |

**Assumptions**

- Hold evaluation data and judging procedure fixed within a comparison.
- Track resource cost and regressions separately.

**Derivation.** Evaluate both revisions on the same criterion, then subtract. This distinguishes observed progress from activity counts.

**Worked check.** Recall increasing from 0.60 to 0.65 is a five-percentage-point change on that evaluation; it is not proof of universal improvement.

**Limits and common mistakes**

- Repeated tuning on the same cases can overfit; retain held-out questions and report uncertainty.

**Sources:** [The evolution of GraphRAG: Advancing systems and evaluation together](https://www.microsoft.com/en-us/research/story/the-evolution-of-graphrag-advancing-systems-and-evaluation-together/)
