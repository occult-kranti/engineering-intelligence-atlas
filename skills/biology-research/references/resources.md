# Biology Research Resources — Databases, Versioning, and Licenses

Compiled 2026-11-20. Databases, models, and taxonomy change constantly: record the release/version and access date for every record used (e.g., UniProt release, AlphaFold model version, GBIF download DOI).

## Versioning and citation discipline

- Record accession IDs, database release/version, and access date for every retrieved record.
- Cite GBIF downloads by their minted DOI per [GBIF citation guidelines](https://www.gbif.org/citation-guidelines).
- AlphaFold DB: record model version (v6 current as of 2026); predictions are not experimental structures — interpret pLDDT/PAE and check sync against current UniProt sequences; [AlphaSync](https://alphasync.stjude.org) tracks currency for 41 species.
- Taxonomy: cross-check names across NCBI Taxonomy, Catalogue of Life, and GBIF Backbone; flag synonym conflicts; follow the applicable nomenclatural code (ICN/ICZN/ICNP/SeqCode).
- Preprints (bioRxiv/medRxiv/EcoEvoRxiv) are not peer-reviewed — always label them as such.
- Refresh database versions, the AI-model landscape, and biosecurity governance notes at least quarterly.

## Dry-lab evidence workflow data layer

1. Frame question → 2. Anchor in open textbooks/reviews → 3. Locate primary evidence (PubMed/Europe PMC/OpenAlex; systematic reviews first) → 4. Pull structured data from primary databases via APIs → 5. Check reproducibility signals (data/code availability, preregistration, independent replication, cross-database consistency) → 6. Assess statistics (power, multiple testing, effect sizes/CIs; flag p-hacking, pseudoreplication, HARKing) → 7. Synthesize with inline citations and confidence → 8. Safety screen → 9. Provenance footer with access dates.

## Access and license quick reference

| Resource type | Examples | Typical access/license |
|---|---|---|
| OpenStax textbooks | Biology 2e, Microbiology, A&P 2e | Free, CC BY 4.0 |
| NCBI Bookshelf | MBoC 4e, Immunobiology 5e, Medical Microbiology 4e | Free to read/search; publisher copyright; not redistributable |
| MIT OCW / MITx | 7.00x, 7.03x, 7.28x, HST.508 | Free; OCW CC BY-NC-SA; MITx free audit, paid certificate |
| MSMB / R4DS / ISLR | Statistics texts | Free online, author-sanctioned (CC or free PDF) |
| NCBI / Ensembl / UniProt / PDB / GBIF / CoL | Core data | Free/open (CC0/CC-BY or public domain); cite per guidelines |
| AlphaFold DB | Structure predictions | Free (CC BY 4.0); predictions are not experimental structures |
| UK Biobank / dbGaP / PhysioNet (clinical) | Human data | Registered/credentialed; fees possible; strict terms |
| Commercial texts | Alberts 7e, Kandel 6e, Lodish 9e | Paid/library; older editions often legally free |
| AlphaFold 3 Server / ESM-3 | AI models | Free tier, non-commercial terms, license gates |
| Addgene plasmids | Physical materials | Institutional MTA required; educational content free |

## Agent-facing access patterns

- Prefer official REST APIs and bulk downloads: NCBI E-utilities and [`ncbi-datasets` CLI](https://www.ncbi.nlm.nih.gov/datasets/), UniProt/Ensembl/GBIF/Open Tree REST APIs, `gget`, and emerging MCP servers (e.g., the Ensembl MCP server) for agentic database access.
- Respect rate limits and terms of service; never use registered-access data (UK Biobank, dbGaP, PhysioNet clinical sets) outside its credentialed scope.
- Reproducibility: pin software via Conda/Bioconda or containers; use nf-core/Snakemake pipelines with CI-tested versions; archive code with Zenodo DOIs or Software Heritage.
