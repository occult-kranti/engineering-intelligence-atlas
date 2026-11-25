# Which physics structures transfer to graph memory—and what does not follow

## Three distinct kinds of connection

The atlas separates an exact mathematical identity, a shared computational method and a speculative physical analogy. The first can be proved from stated definitions. The second can be engineered and evaluated for a new application. The third remains a hypothesis until an empirical mechanism and measurements support it. Graph proximity, repeated terminology or a visually similar diagram cannot replace those distinctions.

| Structure | Exact content | Useful memory-system consequence | What it does not establish |
|---|---|---|---|
| Poisson operator and graph Laplacian | Both can arise from quadratic penalties on differences under suitable discretization | Use sparse operators, boundary constraints and residual checks | A knowledge graph has electric charge |
| Normal modes and graph spectra | A symmetric operator has an orthogonal eigenbasis | Explore smooth versus localized graph signals | An eigenvalue is a biological oscillation frequency |
| Green function and impulse response | Linear response is an inverse-operator or convolution problem with specified conditions | Cache reusable responses when inputs and operator versions match | Arbitrary retrieval is linear and time invariant |
| Multipole compression | Well-separated interactions permit controlled summaries | Build hierarchical summaries with explicit error and invalidation rules | Every semantic summary has a multipole error bound |
| Spin interactions and attracting states | A designed energy and update law can select stable configurations | Test associative retrieval under noise and distractors | A notes graph reproduces a human brain |
| Gauge transport and loops | A closed transport trace can be invariant under local representation changes | Distinguish representation from invariant content | Any dependency cycle is a Wilson or Berry loop |
| Thermodynamic or resonant energy budget | Storage, input, output and dissipation must balance in the model | Measure retrieval cost, latency and refresh work explicitly | Computational efficiency creates physical energy |

The mathematical foundations are documented in [graph wavelets](https://arxiv.org/abs/0912.3848), [fast multipole methods](https://www.sciencedirect.com/science/article/pii/0021999187901409), [linear systems](https://www.feynmanlectures.caltech.edu/I_25.html), [normal modes](https://www.feynmanlectures.caltech.edu/I_49.html) and [gauge transport](https://www.tpi.uni-jena.de/~floerchinger/qft2/lecture15/). The software consequences in this table are design recommendations derived from those structures, not claims that those sources studied this repository.

## A worked example: one operator, three meanings

Take a path of three nodes with equal nonnegative edge weights:

$$
L=\begin{pmatrix}1&-1&0\\-1&2&-1\\0&-1&1\end{pmatrix}.
$$

Its eigenvalues are 0, 1 and 3. The zero mode is constant. The other two represent increasing variation across adjacent nodes. For a node vector x=(1,0,−1), Lx=x and xᵀLx=2. Directly summing the squared edge differences gives (1−0)²+(0+1)²=2, confirming the Dirichlet-energy identity. [pf-graph-energy](../FORMULA_NOTEBOOK.md#pf-graph-energy).

Now choose a time law. In diffusion, dx/dt=−αLx, that vector decays as exp(−αt). In a spring system with equal masses m, d²x/dt²=−(k/m)Lx, it oscillates at √(k/m). In a graph regularizer, minimize ‖x−y‖²+λxᵀLx; then x=(I+λL)⁻¹y and there is no physical time at all. The same eigenvalue enters three different equations, with three different interpretations and units. Calling all three “frequency memory” would hide the crucial model choice.

For knowledge retrieval, edge meaning must be chosen before filtering. A nonnegative similarity edge is compatible with a smoothing penalty. A contradiction edge is not: averaging opposing propositions can erase the disagreement. A prerequisite edge has direction and should not be silently symmetrized into similarity. An analogy edge can guide exploration but must not supply evidence that a physical claim is true. The implementation should let the reader inspect the relation type and originating sources.

## Caching: operator reuse is conditional

A linear solve b↦A⁻¹b admits reusable factorizations when A is unchanged. Change geometry, boundary conditions, material coefficients or discretization and the operator can change. Charge equilibration shows a second dependency: even if one local descriptor changes, a global conservation constraint can alter the entire solved state. [pf-qeq](../FORMULA_NOTEBOOK.md#pf-qeq), [Rappé and Goddard](https://pubs.acs.org/doi/10.1021/j100161a070).

The analogous software rule is precise: a cached answer should depend on the content/version of its evidence, query normalization, scope, retrieval parameters and model or schema version. A time-to-live alone is not enough when a dependency is edited before expiry. An answer citing a withdrawn paper or an obsolete repository state should be invalidated by that change. A cached summary should not survive merely because its title remained unchanged.

Hierarchical compression adds another issue. A multipole summary is designed to preserve a controlled set of moments, with a truncation error in a geometric regime. A language summary does not automatically enjoy that theorem. It can still be useful if it retains claim IDs, assumptions, source links, uncertainty and a route back to the underlying material. The design should treat summary expansion as retrieval of evidence, not amplification of unsupported confidence. [Multipole-method provenance](https://www.sciencedirect.com/science/article/pii/0021999187901409).

## Looping: distinguish termination, recurrence and independent evidence

A graph traversal needs a visited set or another termination rule. A dependency cycle can require a fixed-point method, a strongly connected component treatment, or a schema correction. A recurrent dynamical system can instead intentionally revisit states; convergence then needs a separate stability argument. These are different uses of a loop.

In research, a more subtle loop occurs when article A cites B, B summarizes C and C ultimately cites A. Three URLs do not equal three independent measurements. Evidence provenance should preserve this dependency. Likewise, several agent passes do not become independent experimental replications simply because their wording differs. A round can add a source, identify an error, challenge a derivation or reproduce a calculation; its value should be recorded as that concrete action.

## A productive implementation contract

The physics module supplies concepts, formulas, typed edges, sources, source-access depth and epistemic status. The wider memory engine can index those records, expose provenance, avoid propagating support along analogy links, and retain an expansion queue for incompletely researched branches. Repository and company memories should add their own scope and ownership metadata rather than reinterpret all entities as interchangeable physics nodes.

An effective review question is: **What changes in the output when an assumption is removed?** Remove positive graph weights and the quadratic energy need not be nonnegative. Remove an affine parameter and the geodesic equation gains a term. Remove a band limit and sampling no longer guarantees reconstruction. Remove source freshness and a recent-paper claim can become stale. Making these dependencies explicit is the strongest transferable lesson from the physics atlas.
