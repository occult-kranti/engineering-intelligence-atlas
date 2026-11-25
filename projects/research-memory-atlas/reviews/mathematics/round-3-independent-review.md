# Round 3: independent review of selected physics formulas and frontier claims

Reviewer: mathematics/AI audit agent, independent of the physics artifact author. Review date: 25 November 2026. This is a bounded, targeted review of the final physics artifacts in the adjacent `physics` directory; it is not a certification of every formula or a replication of any research paper. No physics files were changed during this review.

## Decision and actionable findings

The eight selected formula records have consistent mathematics and units under the conventions stated below. Eight independent numerical spot checks passed. Two **P2 precision repairs** are recommended for the bootstrap record, and two **P3 documentation improvements** for the periodogram record. No P0 or P1 defect was found in the sampled material. A pass applies only to the inspected formula and scope; it does not propagate automatically to every descendant node or linked paper.

Severity convention: P0 blocks use because the result is dangerously or fundamentally wrong; P1 is a substantive mathematical or evidential error; P2 is an important scope ambiguity; P3 improves reproducibility or pedagogy.

| ID | Severity | Affected record | Finding and concrete repair |
|---|---|---|---|
| R3-PHY-01 | P2 | `pf-bootstrap`, variable `Delta_1` | Define the gap as the lowest **non-vacuum Virasoro-primary** dimension. The current nonidentity wording omits a defining restriction. “Spinless” aggregates all spins; it does not restrict operators to spin zero. |
| R3-PHY-02 | P2 | `pf-bootstrap`, assumptions; `ps-bootstrap-ai`, scope | Name admissible class \(\bar A\), Definition 2.5. Its optimum is not proved equal to the limiting finite-derivative optimum; section 2.6 makes that equality conjectural. Cite Theorem 1 and Corollary 6, and retain the computer-assisted/preprint qualification. |
| R3-PHY-03 | P3 | `pf-periodogram`, `source_ids` | The normalization is correct. Add a directly relevant spectral-estimation reference, such as the official [SciPy periodogram documentation](https://docs.scipy.org/doc/scipy/reference/generated/scipy.signal.periodogram.html), especially its density/spectrum normalization note. Existing general harmonics and clock-stability references do not make the exact normalization readily traceable. |
| R3-PHY-04 | P3 | `pf-periodogram`, assumptions and frequency labels | State \(f_s>0\), integer \(N\ge1\), a real window with \(\sum_nw_n^2>0\), and finite samples. Label \(kf_s/N\) modulo \(f_s\); bins above half the sample rate represent wrapped negative frequencies in a conventional two-sided plot. The algebra is periodic and correct, but the plotted interpretation needs this sentence. |

The bootstrap repairs are supported by the [original paper](https://hexagonmath.org/pdf/2611.00174v1), abstract, section 2.1, Definition 2.5, section 2.6 and Theorem 1. They change the interpretation of the statement, not its displayed leading constant. The physics author was notified while the review was in progress. This report records proposed repairs, not a claim that the author has already applied them.

## Eight formula checks

| Formula ID | Independent check | Outcome and limits |
|---|---|---|
| `pf-green` | Apply \(-\nabla^2\) to the volume integral and check the free-space kernel \(1/(4\pi r)\). The kernel has units \(\mathrm m^{-1}\), the delta function \(\mathrm m^{-3}\), and the resulting potential volts. | Pass. A bounded domain needs the Dirichlet kernel for that domain. The record already states the necessary boundary correction for nonzero boundary values. |
| `pf-faraday` | Combine Maxwell–Faraday with the transport of magnetic flux through a moving boundary. Both the electric circulation and motional contribution have voltage units. The rod example gives \(0.5\times0.2\times3=0.3\,\mathrm V\). | Pass for a smooth compatible moving loop and surface, with Maxwell's divergence constraint and consistent orientation. Sliding contacts and changing circuit topology require care beyond this formula's smooth-loop derivation. |
| `pf-llg` | Check \(\mathbf m\cdot\dot{\mathbf m}=0\). For a fixed effective field, differentiate reduced Zeeman energy \(-\mathbf m\cdot\mathbf B\). Independently compare the explicit equation with NIST's Gilbert/LL conversion. | Pass. For \(\alpha\ge0\), the damping contribution decreases energy. The record correctly separates a gyromagnetic coefficient using tesla from the coefficient using \(\mathrm A/\mathrm m\). |
| `pf-curvature` | Derive the separation equation from the stated commutator convention and commuting tangent/separation vector fields. Check the weak-field limit against the Hessian of \(-GM/r\). | Pass. The positive displayed curvature contraction is correct for its index order. Radial separation accelerates with \(+2GM/r^3\); transverse separations have \(-GM/r^3\). Reversing an author's Riemann convention without also translating the deviation equation would create an error. |
| `pf-friedmann` | Check all terms have units \(\mathrm s^{-2}\) with length-valued \(a\) and dimensionless \(k\). Derive continuity from \(d(\rho_m c^2a^3)=-p\,d(a^3)\); integrate pressureless and radiation cases. | Pass. The separate cosmological constant and mass-equivalent density are consistent. The matter and radiation powers \(t^{2/3}\), \(t^{1/2}\) follow only for the stated flat, zero-\(\Lambda\) idealizations. |
| `pf-bootstrap` | Independently calculate the coefficient and inspect theorem scope. | Constant and asymptotic warning pass; apply R3-PHY-01/02. No proof or interval-certificate replay was performed. |
| `pf-periodogram` | Derive its integrated power from discrete Parseval and independently compute both two-sided and one-sided versions for a real, windowed signal. | Pass. Both sums reproduce the window-weighted mean square, not necessarily the unwindowed record variance. See R3-PHY-03/04 for source and plotting precision. |
| `pf-allan` | Evaluate the definition for constant bias and alternating adjacent averages. | Pass. Constant offset gives zero Allan deviation; alternating \(\pm a\) gives \(\sqrt2|a|\). The record appropriately distinguishes stability from accuracy and identifies the nonoverlapping convention. |

These are independent algebraic checks. The Green, Faraday, curvature, Friedmann and Allan rows do not assert a new line-by-line inspection of every source cited by the author.

### Verification details that matter

For Gilbert dynamics, the cross products are tangent to the unit sphere, so norm conservation is algebraic. With a fixed field and positive gyromagnetic magnitude,

\[
\frac{d}{dt}(-\mathbf m\cdot\mathbf B)
=-\frac{\gamma_B\alpha}{1+\alpha^2}
\lVert\mathbf m\times\mathbf B\rVert^2.
\]

This is a check of the sign and damping factor; it is not a numerical integration test or a convergence study. The convention translation agrees with the official [NIST OOMMF evolver equations (7.2)–(7.3)](https://math.nist.gov/oommf/doc/userguide21a0/userguidexml/sec_oxsEvolvers.html).

For the periodogram let \(z_n=w_nx_n\), and use an unnormalized forward DFT. Discrete Parseval yields

\[
\sum_{k=0}^{N-1}|Z_k|^2=N\sum_{n=0}^{N-1}|z_n|^2.
\]

Multiplying the record's PSD by its bin width \(\Delta f=f_s/N\) and summing gives

\[
\sum_k\widehat S_{xx}(f_k)\Delta f
=\frac{\sum_n w_n^2|x_n|^2}{\sum_nw_n^2}.
\]

For real data and a real window, conjugate symmetry permits folding the negative frequencies onto positive frequencies. DC and an even-length Nyquist bin have no distinct partner. This explains the factor of two and the exceptional bins without appealing to a plotting convention.

The independent numerical record is [round-3-physics-numeric-checks.json](round-3-physics-numeric-checks.json). Its eight checks are tangent norm, Gilbert energy sign, two-sided Parseval, one-sided Parseval, bootstrap constant, alternating Allan averages, constant-bias Allan averages, and Newtonian tidal eigenvalues. They use ordinary floating point and test examples; they are not formal proofs. Representative results: the periodogram integral is 0.7344491444172104 versus a direct weighted mean square of 0.7344491444172103; the curvature check returns eigenvalues \((-0.2125,-0.2125,0.425)\).

## Four current-frontier claims

| Record | Actual material inspected independently | Adjudication |
|---|---|---|
| `ps-desi2026` | [DESI DR2 IV, v3](https://arxiv.org/html/2607.27410v3): abstract, AP measurement, model-comparison section and conclusion. | The atlas's qualified summary is supported. The individual Ly-alpha distance point moves closer to the reference \(\Lambda\)CDM prediction, while combined-model preferences depend on data combinations. The atlas does not turn this into a decisive proof for or against evolving dark energy. |
| `ps-gwtc5` | [GWTC-5.0 tests preprint](https://arxiv.org/abs/2607.19293): complete author abstract and bibliographic metadata. | The cumulative 168-event count and seven test families are supported, as is overall consistency with GR. This review did not check every test's event-selection table. The abstract itself notes analysis-specific limitations, so the atlas's systematic-error qualification is necessary. |
| `ps-bootstrap-ai` | [Primary PDF](https://hexagonmath.org/pdf/2611.00174v1): selected definitions, theorem statements, certification and numerical-proof dependency descriptions; [provenance page](https://hexagonmath.org/2611.00174v1). | The central coefficient is supported; apply the scope repairs above. Existence of extremal CFTs is not established. No independent proof replay is claimed. |
| `ps-nuclear-clock` | Indexed [publisher abstract/method excerpts](https://www.nature.com/articles/s41586-026-11084-4) and [PubMed metadata](https://pubmed.ncbi.nlm.nih.gov/42844480/). | The described feedback-loop nuclear-frequency reference is supported at this access depth. The atlas correctly avoids claiming demonstrated superiority over all atomic clocks. Full-paper access was unsuccessful in this review, so a full uncertainty-budget audit remains outside the result. |

All four are source-based claim checks. None is an experimental, cosmological-likelihood, waveform-analysis, or theorem-prover replication. Absence of a detected error is narrower than independent confirmation of the research result.

## Access depth and failures

- **Bootstrap:** the 131-page PDF was searchable and selected sections were read, not the entire proof. The theorem's computer-assisted dependency was identified; no certificate code or interval-arithmetic computation was rerun.
- **DESI:** full HTML was accessible. The source URL pins v3; its original submission and later revision are distinct dates. The atlas labels the original publication date, which is reasonable provided the version URL remains visible.
- **GWTC5:** abstract-level claims were checked. Full event-by-event analysis was not inspected.
- **Nuclear clock:** the publisher direct open failed; the PMC mirror returned a browser-check page. Search-indexed publisher material and PubMed supported the limited statement. This agrees with the author's disclosed access depth.
- **OOMMF:** directly read the official evolver equations and units, including the relation between Gilbert and Landau–Lifshitz gyromagnetic conventions.
- **Spectral estimation:** directly read the official SciPy periodogram documentation and its normalization note. A follow-up click into the spectral-analysis guide failed; that deeper section is not counted as inspected.
- **Allan source:** attempted direct access to NIST SP1065 at `https://tf.nist.gov/general/pdf/2220.pdf`, but retrieval timed out. The Allan row therefore rests on an independent evaluation of the displayed definition, not a newly completed source audit.

## Scope retained for integration

The scientific boundaries already present in the physics atlas should survive rendering and graph export: source access depth, preprint status, formula assumptions, variable conventions, and explicit non-replication fields. These qualifiers are part of a claim's content. A search result or graph node that strips them can turn a correct technical statement into a misleading general claim.

The physics author or integrating parent should record the actual repair disposition after making changes. This review does not pre-approve unseen revisions or certify unsampled formulas.
