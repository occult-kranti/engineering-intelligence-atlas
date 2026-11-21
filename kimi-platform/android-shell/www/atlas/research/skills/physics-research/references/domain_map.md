# Physics Domain Map

Canonical texts, courses, software, and data per area, foundational → research. Levels: F=foundational, U=undergraduate, G=graduate, R=research. Compiled 2026-11-20 from the physics research library; verify edition, errata, and database release before citing.

## 0. Foundational spine and prerequisites

- Spine: mechanics; electromagnetism; waves/optics; thermodynamics; statistical mechanics; special relativity; quantum mechanics; mathematical and numerical methods; experimental design; uncertainty.
- Open sequence: OpenStax University Physics [Vol. 1](https://openstax.org/details/books/university-physics-volume-1), [Vol. 2](https://openstax.org/details/books/university-physics-volume-2), [Vol. 3](https://openstax.org/details/books/university-physics-volume-3); [MIT OCW Physics](https://ocw.mit.edu/search/?d=Physics); [The Feynman Lectures](https://www.feynmanlectures.caltech.edu/).
- Prerequisites: vector calculus and ODE/PDE, linear algebra and Hilbert spaces, probability/statistics, differential geometry for GR/gauge theory, groups and representations, numerical analysis.

## 1. Classical, Lagrangian, and Hamiltonian mechanics

- F: OpenStax Vol. 1; [MIT OCW classical mechanics](https://ocw.mit.edu/search/?q=classical%20mechanics); Feynman Vol. I.
- U: Taylor; Morin; Kleppner and Kolenkow; Marion and Thornton.
- G–R: Goldstein, Poole and Safko; Landau and Lifshitz, *Mechanics*; Arnold; Hand and Finch; Tong's [lecture notes](https://www.damtp.cam.ac.uk/user/tong/teaching.html).
- Primary: Newton's *Principia* via [Cambridge Newton Papers](https://cudl.lib.cam.ac.uk/collections/newton) and [Oxford Newton Project](https://www.newtonproject.ox.ac.uk/); Noether 1918, DOI [10.1007/BF01444867](https://doi.org/10.1007/BF01444867).
- Software: [SymPy Mechanics](https://docs.sympy.org/latest/modules/physics/mechanics/), [Modelica](https://modelica.org/), [Drake](https://drake.mit.edu/), [MuJoCo](https://mujoco.org/), [REBOUND](https://rebound.readthedocs.io/).

## 2. Electromagnetism and electrodynamics

- F: OpenStax Vol. 2; MIT OCW [E&M search](https://ocw.mit.edu/search/?q=electricity%20and%20magnetism); Feynman Vol. II.
- U: Purcell and Morin; Griffiths; Wangsness.
- G–R: Jackson; Zangwill; Stratton; Landau and Lifshitz, *Classical Theory of Fields* and *Electrodynamics of Continuous Media*.
- Primary: Maxwell 1865, DOI [10.1098/rstl.1865.0008](https://doi.org/10.1098/rstl.1865.0008).
- Software: [Meep](https://meep.readthedocs.io/), [openEMS](https://www.openems.de/), [FEniCS](https://fenicsproject.org/), [gprMax](https://www.gprmax.com/), [NEC](https://www.nec2.org/); commercial: COMSOL, Ansys HFSS, CST.

## 3. Thermodynamics and statistical mechanics

- F: OpenStax Vol. 2; MIT OCW [statistical physics search](https://ocw.mit.edu/search/?q=statistical%20physics).
- U: Schroeder; Callen; Reif.
- G–R: Pathria and Beale; Kardar (both volumes); Landau and Lifshitz, *Statistical Physics*; Chandler.
- Primary: Gibbs 1902 ([Internet Archive scan](https://archive.org/details/elementaryprinc01gibbgoog)); Onsager 1944, DOI [10.1103/PhysRev.65.117](https://doi.org/10.1103/PhysRev.65.117).
- Software: [LAMMPS](https://www.lammps.org/), [GROMACS](https://www.gromacs.org/), [OpenMM](https://openmm.org/), [HOOMD-blue](https://glotzerlab.engin.umich.edu/hoomd-blue/), [Cantera](https://cantera.org/), [CoolProp](https://coolprop.org/).

## 4. Waves, acoustics, and optics

- F: OpenStax Vols. 1 and 3; MIT OCW [vibrations and waves](https://ocw.mit.edu/search/?q=vibrations%20waves).
- U: French; Hecht; Crawford.
- G–R: Born and Wolf; Goodman; Saleh and Teich; Boyd.
- Primary: Newton's 1671/72 light-and-colours letter, DOI [10.1098/rstl.1671.0072](https://doi.org/10.1098/rstl.1671.0072).
- Software: [Meep](https://meep.readthedocs.io/), [LightPipes](https://github.com/wavefrontshaping/lightpipes), [RayOptics](https://github.com/mjhoptics/ray-optics), Zemax, CODE V.

## 5. Special and general relativity

- F–U: Taylor and Wheeler; Schutz; Carroll.
- G–R: Wald; Misner, Thorne and Wheeler; Poisson; Weinberg.
- Primary: Einstein 1905, DOI [10.1002/andp.19053221004](https://doi.org/10.1002/andp.19053221004); Einstein 1916, DOI [10.1002/andp.19163540702](https://doi.org/10.1002/andp.19163540702); [Einstein Papers Project](https://einsteinpapers.press.princeton.edu/); GW150914, DOI [10.1103/PhysRevLett.116.061102](https://doi.org/10.1103/PhysRevLett.116.061102).
- Software/data: [Einstein Toolkit](https://einsteintoolkit.org/), [GRChombo](https://grchombo.org/), [Bilby](https://lscsoft.docs.ligo.org/bilby/), [PyCBC](https://pycbc.org/), [GWOSC](https://gwosc.org/).

## 6. Quantum mechanics and quantum information

- F: OpenStax Vol. 3; Feynman Vol. III; MIT OCW [8.04](https://ocw.mit.edu/courses/8-04-quantum-physics-i-spring-2013/), [8.05](https://ocw.mit.edu/courses/8-05-quantum-physics-ii-fall-2013/), [8.06](https://ocw.mit.edu/courses/8-06-quantum-physics-iii-spring-2016/).
- U: Griffiths and Schroeter; Shankar; Townsend; Gasiorowicz.
- G–R: Sakurai and Napolitano; Cohen-Tannoudji, Diu and Laloë; Weinberg, *Lectures on Quantum Mechanics*; Peres.
- Quantum information: Nielsen and Chuang; Watrous; Preskill's [Ph219/CS219 notes](https://theory.caltech.edu/~preskill/ph219/); Wilde.
- Primary anchors: Planck 1901, DOI [10.1002/andp.19013090310](https://doi.org/10.1002/andp.19013090310); Einstein 1905 light-quantum, DOI [10.1002/andp.19053220607](https://doi.org/10.1002/andp.19053220607); Heisenberg 1925, DOI [10.1007/BF01328377](https://doi.org/10.1007/BF01328377); Schrödinger 1926, DOI [10.1002/andp.19263840404](https://doi.org/10.1002/andp.19263840404); Dirac 1928, DOI [10.1098/rspa.1928.0023](https://doi.org/10.1098/rspa.1928.0023).
- Software: [QuTiP](https://qutip.org/), [Qiskit](https://www.ibm.com/quantum/qiskit), [PennyLane](https://pennylane.ai/), [NetKet](https://www.netket.org/), [ITensor](https://itensor.org/), [TenPy](https://tenpy.readthedocs.io/).

## 7. Quantum field theory and the Standard Model

- Bridge: Tong's [notes](https://www.damtp.cam.ac.uk/user/tong/teaching.html).
- G: Peskin and Schroeder; Schwartz; Zee; Srednicki; Lancaster and Blundell.
- R/formal: Weinberg's three volumes; Itzykson and Zuber; Haag; Streater and Wightman; Collins.
- Primary anchors: Yang–Mills 1954, DOI [10.1103/PhysRev.96.191](https://doi.org/10.1103/PhysRev.96.191); Weinberg 1967, DOI [10.1103/PhysRevLett.19.1264](https://doi.org/10.1103/PhysRevLett.19.1264); Englert–Brout [10.1103/PhysRevLett.13.321](https://doi.org/10.1103/PhysRevLett.13.321) and Higgs [10.1103/PhysRevLett.13.508](https://doi.org/10.1103/PhysRevLett.13.508).
- Software: [FeynCalc](https://feyncalc.github.io/), [FORM](https://www.nikhef.nl/~form/), [xAct](https://www.xact.es/), [MadGraph5_aMC@NLO](https://launchpad.net/mg5amcnlo), [Sherpa](https://sherpa-team.gitlab.io/), [Pythia](https://pythia.org/), [QUDA](https://lattice.github.io/quda/), [Grid](https://github.com/paboyle/Grid).

## 8. Atomic, molecular, nuclear, and particle physics

- AMO: Foot; Demtröder; Bransden and Joachain; [NIST Atomic Spectra Database](https://physics.nist.gov/PhysRefData/ASD/); [GRASP](https://github.com/compas/grasp).
- Molecular/optical: Bernath; Brown and Carrington; Herzberg; cross-check with [NIST Chemistry WebBook](https://webbook.nist.gov/chemistry/).
- Nuclear: Krane; Wong; Heyde; Ring and Schuck; Rutherford scattering, DOI [10.1080/14786440508637080](https://doi.org/10.1080/14786440508637080).
- Particle: Griffiths; Perkins; Halzen and Martin; Thomson; landmark papers Fermi beta decay [10.1007/BF01351864](https://doi.org/10.1007/BF01351864), ATLAS [10.1016/j.physletb.2012.08.020](https://doi.org/10.1016/j.physletb.2012.08.020) and CMS [10.1016/j.physletb.2012.08.021](https://doi.org/10.1016/j.physletb.2012.08.021) Higgs observations.
- Data: [NNDC](https://www.nndc.bnl.gov/), [NuDat](https://www.nndc.bnl.gov/nudat3/), [IAEA NDS](https://www-nds.iaea.org/), [EXFOR](https://www-nds.iaea.org/exfor/), [PDG](https://pdg.lbl.gov/), [HEPData](https://www.hepdata.net/), [CERN Open Data](https://opendata.cern.ch/).
- Simulation: [Geant4](https://geant4.web.cern.ch/), [OpenMC](https://docs.openmc.org/), [ROOT](https://root.cern/), [Garfield++](https://garfieldpp.web.cern.ch/garfieldpp/), [Rivet](https://rivet.hepforge.org/).

## 9. Condensed matter and materials

- F–U: Kittel; Simon, *The Oxford Solid State Basics*; Marder.
- G–R: Ashcroft and Mermin; Mahan; Chaikin and Lubensky; Auerbach; Fradkin.
- Primary anchors: Bloch [10.1007/BF01339455](https://doi.org/10.1007/BF01339455); BCS [10.1103/PhysRev.108.1175](https://doi.org/10.1103/PhysRev.108.1175); Anderson localization [10.1103/PhysRev.109.1492](https://doi.org/10.1103/PhysRev.109.1492); Hohenberg–Kohn [10.1103/PhysRev.136.B864](https://doi.org/10.1103/PhysRev.136.B864); Kohn–Sham [10.1103/PhysRev.140.A1133](https://doi.org/10.1103/PhysRev.140.A1133).
- Software: [Quantum ESPRESSO](https://www.quantum-espresso.org/), [VASP](https://www.vasp.at/), [ABINIT](https://www.abinit.org/), [SIESTA](https://siesta-project.org/), [CP2K](https://www.cp2k.org/), [Wannier90](https://wannier.org/), [pymatgen](https://pymatgen.org/), [ASE](https://wiki.fysik.dtu.dk/ase/), [OVITO](https://www.ovito.org/), [VESTA](https://jp-minerals.org/vesta/en/).
- Databases: [Materials Project](https://next-gen.materialsproject.org/), [OQMD](https://oqmd.org/), [NOMAD](https://nomad-lab.eu/), [AFLOW](https://aflow.org/), [NIST JARVIS](https://jarvis.nist.gov/), [Crystallography Open Database](https://www.crystallography.net/cod/). Computed values are approximation-dependent predictions, not experimental truth.

## 10. Fluids and continuum mechanics

- F–U: Kundu, Cohen and Dowling; White; Tritton; Munson.
- G–R: Batchelor; Landau and Lifshitz, *Fluid Mechanics*; Pope; Tennekes and Lumley.
- Primary: Reynolds 1895, DOI [10.1098/rsta.1895.0004](https://doi.org/10.1098/rsta.1895.0004).
- Software: [OpenFOAM](https://www.openfoam.com/), [SU2](https://su2code.github.io/), [Basilisk](https://basilisk.fr/), [Dedalus](https://dedalus-project.org/), [NekRS](https://github.com/Nek5000/nekRS), [FEniCS](https://fenicsproject.org/), [ParaView](https://www.paraview.org/).
- Benchmarks: [NASA Turbulence Modeling Resource](https://turbmodels.larc.nasa.gov/), [Johns Hopkins Turbulence Databases](https://turbulence.pha.jhu.edu/).

## 11. Plasma physics and fusion

- U: Chen; Bittencourt; Bellan.
- G–R: Goldston and Rutherford; Freidberg; Fitzpatrick; Krall and Trivelpiece; Stix.
- Primary: Langmuir 1928, DOI [10.1073/pnas.14.8.627](https://doi.org/10.1073/pnas.14.8.627); Alfvén 1942, DOI [10.1038/150405d0](https://doi.org/10.1038/150405d0).
- Software: [WarpX](https://warpx.readthedocs.io/), [Smilei](https://smileipic.github.io/Smilei/), [Gkeyll](https://gkeyll.readthedocs.io/), [BOUT++](https://boutproject.github.io/), [GENE](http://genecode.org/), [PlasmaPy](https://www.plasmapy.org/).
- Community/data: [ITER](https://www.iter.org/), [EUROfusion](https://euro-fusion.org/), [NASA SPDF](https://spdf.gsfc.nasa.gov/). For fusion claims, report \(nT\tau_E\) and energy balance; never equate scientific \(Q\) with net electric power.

## 12. Astrophysics and cosmology

- F: OpenStax [Astronomy 2e](https://openstax.org/details/books/astronomy-2e); MIT OCW [astrophysics search](https://ocw.mit.edu/search/?q=astrophysics).
- U: Carroll and Ostlie; Ryden; Bradt.
- G–R: Rybicki and Lightman; Shapiro and Teukolsky; Peacock; Dodelson and Schmidt.
- Primary anchors: Friedmann 1922, DOI [10.1007/BF01328280](https://doi.org/10.1007/BF01328280); Hubble 1929, DOI [10.1073/pnas.15.3.168](https://doi.org/10.1073/pnas.15.3.168); Penzias–Wilson 1965, DOI [10.1086/148307](https://doi.org/10.1086/148307); Planck 2018 parameters, DOI [10.1051/0004-6361/201833910](https://doi.org/10.1051/0004-6361/201833910).
- Data: [NASA ADS](https://ui.adsabs.harvard.edu/), [SIMBAD](https://simbad.cds.unistra.fr/), [VizieR](https://vizier.cds.unistra.fr/), [HEASARC](https://heasarc.gsfc.nasa.gov/), [MAST](https://archive.stsci.edu/), [SDSS](https://www.sdss.org/), [ESA Gaia](https://gea.esac.esa.int/archive/), [NASA Exoplanet Archive](https://exoplanetarchive.ipac.caltech.edu/), [Planck Legacy Archive](https://pla.esac.esa.int/), [GWOSC](https://gwosc.org/).
- Software: [Astropy](https://www.astropy.org/), [yt](https://yt-project.org/), [MESA](https://docs.mesastar.org/), [Athena++](https://www.athena-astro.app/), [RAMSES](https://ramses-organisation.readthedocs.io/), [CAMB](https://camb.info/), [CLASS](https://lesgourg.github.io/class_public/class.html), [Cobaya](https://cobaya.readthedocs.io/), [emcee](https://emcee.readthedocs.io/).

## 13. Computational physics

- U: Newman, *Computational Physics*; Landau, Páez and Bordeianu; MIT OCW [computational physics search](https://ocw.mit.edu/search/?q=computational%20physics).
- Numerical analysis: Press et al.; Trefethen and Bau; LeVeque; Quarteroni, Sacco and Saleri.
- Advanced: Hesthaven and Warburton; Oberkampf and Roy for verification and validation.
- Core stack: [NumPy](https://numpy.org/), [SciPy](https://scipy.org/), [SymPy](https://www.sympy.org/), [pandas](https://pandas.pydata.org/), [xarray](https://xarray.dev/), [HDF5](https://www.hdfgroup.org/solutions/hdf5/), [Dask](https://www.dask.org/), [PETSc](https://petsc.org/), [Trilinos](https://trilinos.github.io/), [deal.II](https://www.dealii.org/), [Jupyter](https://jupyter.org/), [Matplotlib](https://matplotlib.org/).

## 14. Experimental physics and instrumentation

- Measurement/data analysis: Taylor, *An Introduction to Error Analysis*; Bevington and Robinson; Hughes and Hase; Squires.
- Design: Melissinos and Napolitano; Kirkup and Frenkel; MIT OCW [experimental physics search](https://ocw.mit.edu/search/?q=experimental%20physics).
- Electronics: Horowitz and Hill; [Analog Devices library](https://www.analog.com/en/resources/technical-library.html); [Keysight resources](https://www.keysight.com/us/en/resources.html); manufacturer manuals for exact instruments.
- DAQ/control: [EPICS](https://epics-controls.org/), [TANGO](https://www.tango-controls.org/), [LabVIEW](https://www.ni.com/en-us/shop/labview.html), [PyMeasure](https://pymeasure.readthedocs.io/), [QCoDeS](https://microsoft.github.io/Qcodes/), [Bluesky](https://blueskyproject.io/), [ROOT](https://root.cern/), [h5py](https://www.h5py.org/).
