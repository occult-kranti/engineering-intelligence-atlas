# Physics Research Resources — Evidence Hierarchy, Search, and Data

Compiled 2026-11-20. Prefer primary and authoritative hosts; record versions, releases, and access dates.

## Evidence and source hierarchy

| Tier | Typical sources | Required caution |
|---|---|---|
| E1: authoritative data or primary artifact | [BIPM SI](https://www.bipm.org/en/publications/si-brochure), [NIST CODATA](https://physics.nist.gov/cuu/Constants/), [PDG](https://pdg.lbl.gov/), [NNDC](https://www.nndc.bnl.gov/), [IAEA NDS](https://www-nds.iaea.org/), original papers, archival manuscripts, patents, court records | A primary source is not automatically correct; examine methods, edition, uncertainty, scope, and later corrections. |
| E2: peer-reviewed synthesis or experiment | Reviews, replications, meta-analyses, data releases | Check venue, date, retractions, errata, sample size, calibration, and whether the question was actually tested. |
| E3: advanced textbook or monograph | Graduate texts, mature monographs | Textbooks simplify; check edition, convention, and date. |
| E4: courseware and open textbook | [OpenStax](https://openstax.org/subjects/science), [Feynman Lectures](https://www.feynmanlectures.caltech.edu/), [MIT OCW](https://ocw.mit.edu/search/?d=Physics) | Teaching treatments omit research-level caveats. |
| E5: preprint, thesis, technical report, code release | arXiv, institutional repositories, GitHub/Zenodo | Not necessarily peer reviewed; identify versions and artifacts. |
| E6: encyclopedia, biography, museum exhibit, journalism | SEP, museums, reputable journalism | Never let a popular retelling override primary text. |
| E7: social media, unattributed pages, model output | Forums, videos, viral claims | Not admissible for a load-bearing claim without primary confirmation. |

## Discovery engines

- [arXiv](https://arxiv.org/) — preprints; compare preprint and published versions.
- [INSPIRE-HEP](https://inspirehep.net/) — particle and astro-particle literature.
- [NASA ADS](https://ui.adsabs.harvard.edu/) — physics and astronomy literature.
- [Crossref](https://api.crossref.org/) and [OpenAlex](https://www.openalex.org/) — metadata and citation graphs.
- Discovery engines locate literature; they do not establish truth.

## Authoritative data services

- Constants/units: [NIST CODATA](https://physics.nist.gov/cuu/Constants/) (record adjustment year), [BIPM SI Brochure](https://www.bipm.org/en/publications/si-brochure), [BIPM Key Comparison Database](https://www.bipm.org/kcdb/).
- Particle/nuclear: [PDG](https://pdg.lbl.gov/), [NNDC](https://www.nndc.bnl.gov/), [NuDat](https://www.nndc.bnl.gov/nudat3/), [IAEA Nuclear Data Services](https://www-nds.iaea.org/), [ENDF](https://nds.iaea.org/endf), [EXFOR](https://www-nds.iaea.org/exfor/), [HEPData](https://www.hepdata.net/), [CERN Open Data](https://opendata.cern.ch/).
- Atomic/chemical/thermal: [NIST Atomic Spectra Database](https://physics.nist.gov/PhysRefData/ASD/), [NIST Chemistry WebBook](https://webbook.nist.gov/chemistry/), [NIST REFPROP](https://www.nist.gov/srd/refprop), [refractiveindex.info](https://refractiveindex.info/) (trace critical values to the underlying paper).
- Materials: [Materials Project](https://next-gen.materialsproject.org/), [OQMD](https://oqmd.org/), [NOMAD](https://nomad-lab.eu/), [AFLOW](https://aflow.org/), [NIST JARVIS](https://jarvis.nist.gov/), [Crystallography Open Database](https://www.crystallography.net/cod/).
- Astronomy: [SIMBAD](https://simbad.cds.unistra.fr/), [VizieR](https://vizier.cds.unistra.fr/), [HEASARC](https://heasarc.gsfc.nasa.gov/), [MAST](https://archive.stsci.edu/), [SDSS](https://www.sdss.org/), [ESA Gaia Archive](https://gea.esac.esa.int/archive/), [NASA Exoplanet Archive](https://exoplanetarchive.ipac.caltech.edu/), [Planck Legacy Archive](https://pla.esac.esa.int/), [GWOSC](https://gwosc.org/).

## Provenance protocol for every claim

1. Locate the earliest stable record: paper, dissertation, instrument log, dataset, proceeding, patent, or letter.
2. Capture identifiers: DOI, arXiv ID, INSPIRE record, manuscript classmark, patent number, dataset version, release tag, commit hash.
3. Verify the object: title, author, year, edition, status, and whether the page is a scan, transcription, translation, derivative, or commentary.
4. Read methods and exclusions: detector cuts, priors, assumptions, material purity, geometry, boundary conditions, calibration, uncertainty budget.
5. Check downstream evidence: errata, comments, replications, reviews, updated constants, revised ephemerides.
6. Separate source claims from agent inference: write "source states..." versus "the agent calculates...".
7. Date-stamp volatile links and database queries.

## Literature triage rubric

| Criterion | Questions |
|---|---|
| Relevance | Does it measure or derive the actual quantity? Is the regime comparable? |
| Methods | Are apparatus, model, cuts, priors, calibrations, and uncertainties stated? |
| Independence | Do later papers reuse the same data, code, or calibration? |
| Reproducibility | Are data, code, notebooks, seeds, environment, and versions available? |
| Internal consistency | Do figures, equations, and reported uncertainties agree? |
| External consistency | Does it agree with curated values and unrelated methods? |
| Age | Has a later CODATA/PDG release, erratum, or experiment superseded it? |
| Conflicts | Funding, patent interest, promotion, or advocacy? Affects interpretation, not automatic exclusion. |

## Reproducibility and archiving stack

- Versioned code ([Git](https://git-scm.com/)), archived releases ([Zenodo](https://zenodo.org/) DOIs), source preservation ([Software Heritage](https://www.softwareheritage.org/)), containers ([Docker](https://www.docker.com/), [Apptainer](https://apptainer.org/)), build/test tooling ([CMake](https://cmake.org/), [pytest](https://docs.pytest.org/)), workflow systems ([Snakemake](https://snakemake.readthedocs.io/)).
- Record database release, query date, and uncertainty for every numeric value. A stable DOI beats a landing page; an archived scan beats a paraphrased quotation.
