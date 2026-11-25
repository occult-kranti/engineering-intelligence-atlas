# World architecture: evidence, chronology and structural traditions

This library is a **representative teaching collection of 62 sites and buildings**, supported by **89 primary institutional, archaeological and project-team sources**. It connects early surviving monumental evidence with recent completed buildings and a continuing construction project. It is a starting point for comparison, research and original modeling, rather than an exhaustive history of architecture.

The catalog's historical cutoff is **24 November 2026**. Source retrieval took place on **25 November 2026 UTC**: `asOf` and `accessed` deliberately record different events. The recent-project checks use milestones that occurred before the cutoff. An access date means that the page or indexed document was consulted; it does not mean a source's old narrative was freshly revised that day.

Use the [catalog](../data/monuments.json), [source register](../data/sources-history.json), [element library](../data/elements.json) and [runnable teaching samples](../samples/README.md) together. Each monument's `sourceIds` resolves to a source with a URL, publisher and concise statement of what it supports.

## Where this chronology begins

Göbekli Tepe supplies the opening interval, approximately **9600–8200 BCE**, from UNESCO's assessment. That makes it an early well-supported monumental example in this collection. It does **not** establish the first architecture, the first settlement or the first temple anywhere. Survival, excavation and the definition of “monumental” all affect such comparisons. [Source: UNESCO](https://whc.unesco.org/en/list/1572/)

A settlement's oldest evidence is not automatically a monument's date. At Tell es-Sultan, the much earlier activity deposits must be distinguished from the Neolithic wall, ditch and tower assigned to the ninth and eighth millennia BCE. The catalog dates that selected monumental phase. [Source: UNESCO](https://whc.unesco.org/en/list/1687/)

Nor should the sequence imply a single progression from “primitive” construction to a universal modern ideal. Different communities repeatedly developed and maintained combinations of earth, timber, stone and later industrial materials. Similar silhouettes can have different purposes and load paths. A ziggurat, a royal pyramid tomb, a Mesoamerican temple platform and a glazed museum entrance are useful comparisons precisely because their differences matter.

## How to read the dates

The timeline is sorted by `startYear`. Negative integers represent BCE years and positive integers represent CE years. **There is no year zero in the historical labels.** Software should not treat a simple subtraction across the BCE/CE boundary as an exact elapsed-year calculation without a calendar conversion.

The numeric endpoints support sorting and visualization; the accompanying `dateLabel`, `datePrecision` and uncertainty notes carry the historical meaning.

| Value | Interpretation | Appropriate use |
|---|---|---|
| `approximate` | A rounded date, broad phase, reign interval or uncertain attribution | Keep “c.” or the century description visible |
| `range` | An explicitly identified interval or pair of milestones | Read what the endpoints mean; they need not imply uninterrupted work |
| `year` | A documented completion or opening year used as a timeline point | Do not infer an unrecorded construction start |
| `under_construction` | Construction continues at the cutoff | The numeric endpoint records an observed year, never a forecast completion |

Several records intentionally select a narrower phase than the full life of their site:

- Hōryū-ji describes surviving early timber buildings associated with rebuilding after the 670 fire, rather than assigning every present member to an original foundation. [UNESCO](https://whc.unesco.org/en/list/660/)
- The Taj Mahal separates the mausoleum's completion from later work on the surrounding complex. [UNESCO](https://whc.unesco.org/en/list/252/)
- The present Great Mosque of Djenné is dated to its 1906–1907 reconstruction, while its older religious and urban setting remains part of the explanation. [UNESCO](https://whc.unesco.org/en/list/116/)
- A recent tower's completion year or a museum's opening year is sometimes the only milestone plotted. This is preferable to inventing a complete building schedule.

A century-wide interval is not a probability distribution or proof that work lasted a hundred years. A reign-based interval is not the same as a dated contractor's program. For a site with many components, individual-building chronology requires additional research.

## A comparative route through the collection

These groupings are reading routes through the records, not universal period names. Their dates overlap because architectural traditions coexist.

| Route | Representative records | Questions to investigate |
|---|---|---|
| Early communal monuments | Göbekli Tepe, Tell es-Sultan, Ġgantija, Newgrange, Stonehenge | What is directly preserved? What is inferred about gathering, burial, roofs or ritual? |
| Cities, platforms and royal construction | Caral, Djoser, Khufu, Mohenjo-daro, Ur | How do labor, material supply, water and social institutions support monumental work? |
| Framed halls, masonry and infrastructure | Persepolis, Parthenon, Petra, Pont du Gard, Colosseum, Pantheon | How do columns, walls, arches, vaults and hydraulic networks organize space? |
| Distinct religious building traditions | Sanchi, Hōryū-ji, Kailasa, Borobudur, Kairouan, Prambanan, Khajuraho, Thanjavur | How do circulation, ritual and craft differ between particular communities and periods? |
| Landscapes and urban institutions | Cahokia, Angkor, Lalibela, Great Zimbabwe, Nan Madol, Rapa Nui, Taputapuātea | What disappears if a monument is separated from its lived and managed landscape? |
| Courts, domes and fortified complexes | Alhambra, Forbidden City, Florence, Süleymaniye, Himeji, Taj Mahal | How do hierarchy, access, enclosure, construction sequence and repair shape the ensemble? |
| Industrial and modern experiments | Eiffel Tower, Fallingwater, Barragán House, Brasília Cathedral, Sydney Opera House, Centre Pompidou | Which design decisions depend on industrial production, structural analysis or institutional coordination? |
| Contemporary systems and reuse | Louvre Pyramid, Burj Khalifa, CCTV, Shanghai Tower, Zeitz MOCAA, Mjøstårnet, GEM, Zayed National Museum | How do geometry, fabrication, retained fabric, environmental systems and operation interact? |

Record-level references support the sites in this table. The questions are the library's teaching interpretation, not quotations or claims that the source authors used these exact categories.

## Global coverage and deliberate limits

The present regional distribution is derived from the catalog itself:

| Region | Records | Scope in this edition |
|---|---:|---|
| Africa | 10 | Egyptian and Kushite monuments, Ethiopian rock-cut churches, Maghreban and Sahelian mosques, Great Zimbabwe, and contemporary museums |
| Middle East | 7 | Early Anatolian and Levantine examples, Mesopotamian and Iranian sites, Petra, and recent UAE projects |
| Europe | 17 | Neolithic monuments, Greek and Roman works, Byzantine and Ottoman Istanbul, medieval and early-modern buildings, industrial and contemporary systems |
| South Asia | 6 | Indus urbanism and distinct Buddhist, Hindu, Jain and Mughal contexts |
| East Asia | 6 | Liao timber, Ming/Qing palatial planning, Japanese temples and castles, and contemporary towers |
| Southeast Asia | 3 | Central Javanese and Khmer religious complexes |
| North America | 6 | Mesoamerican and Mississippian monuments, a United States house, and Mexican modernism |
| South America | 3 | Early Andean platforms, Inca landscape construction, and Brazilian modernism |
| Oceania | 4 | Micronesian and Polynesian ceremonial landscapes and Sydney Opera House |

These are navigation regions, not claims about a culture's ownership or borders. Rapa Nui is grouped with Oceania while its country field identifies Chile. Taputapuātea records French Polynesia explicitly. Istanbul's entries are grouped geographically in Europe; that choice does not deny their wider Byzantine, Ottoman or transregional histories.

The edition covers 36 distinct country/territory labels. It remains selective: domestic and vernacular buildings, African and Asian regions beyond the selected examples, Indigenous traditions, industrial workplaces, housing, landscape infrastructure, and many contemporary local practices deserve expansion. A count of famous monuments is not a measure of a society's architectural contribution. Future additions should correct gaps through evidence and community expertise, not fill a quota with an unsupported “first.”

## What the engineering fields mean

`structuralSystems`, `materials` and `elements` provide searchable vocabulary. Elements are lowercase slugs, not mandatory references to a single universal typology. The narrative `engineering` field is a **qualitative interpretation** of documented form and construction. It does not claim surveyed dimensions, complete material properties, a finite-element analysis or verified construction safety.

Three comparisons help keep the interpretation precise:

1. **Construction method matters.** Cutting a room out of rock, building a thick masonry mound, and assembling a timber frame solve different problems even if each creates a sacred space.
2. **Appearance and support differ.** A decorative surface may cover another structural system. A visible diagonal, column or arch must be studied in its actual assembly before assigning a load-bearing role.
3. **Geometry is a constraint, not a complete explanation.** Sydney's spherical solution addressed repeated fabrication and the definition of the roof geometry. It did not eliminate the remaining structural, acoustic, managerial or construction problems. [Sydney Opera House](https://www.sydneyoperahouse.com/our-story/the-spherical-solution)

Historical religious and cosmological meanings belong in the record when documented. They are distinct from empirical claims about forces, material behavior or environmental performance. Visual resemblance alone is insufficient evidence of transmission, a common origin, an astronomical intention or a hidden numerical code.

Modern project pages are primary accounts of the designers' intentions and work. Their environmental claims remain attributed design descriptions unless independent measured operating evidence is added. “Timber,” “natural ventilation” or a certification label should not silently become a whole-life carbon or comfort assessment.

## Current work and completed projects

The Sagrada Família entry is deliberately marked **under construction**. An official February 2026 account confirms completion of the central tower's exterior while describing interior work continuing into 2027–2028. The record's `endYear: 2026` is an observation cutoff. [Official construction account](https://sagradafamilia.org/en/detalle/-/asset_publisher/7JWibz9G2KUY/content/una-creu-que-arriba-al-cel-de-barcelona)

Two recent museum milestones are verified separately from design descriptions:

- The Grand Egyptian Museum distinguishes earlier partial openings from its museum-wide opening on **1 November 2025**. [Museum history](https://gem.eg/en/about/museum-story)
- Zayed National Museum opened on **3 December 2025**. The official notice supersedes an older project subpage's “under construction” label. [Abu Dhabi Media Office](https://www.mediaoffice.abudhabi/en/arts-culture/zayed-national-museum-opens-to-the-public-in-saadiyat-cultural-district/)

“Extant” means that the selected building survives. It does not certify opening hours, unrestricted access, complete originality or current physical safety.

## Evidence, reconstruction and source criticism

Official sources can disagree or preserve older summaries. For Pont du Gard, the site authority's approximate 50 CE date is preferred over older introductory dating elsewhere. For Mohenjo-daro, the detailed UNESCO assessment and archaeological chronology are more informative than the brief introductory material description. Those choices are recorded in the source mappings rather than hidden.

The status field is deliberately coarse. “Reconstructed” flags a substantial episode of reassembly, rebuilding or restoration relevant to how the monument is seen; it does not mean all ancient material is lost. “Ruin” does not mean a place lacks living cultural significance. Newgrange's reconstructed quartz frontage, for example, must be distinguished from other surviving evidence. [Office of Public Works discussion](https://heritageireland.ie/assets/uploads/2018/06/heritage-ireland-issue-eight-25072018.pdf)

The source register favors monument custodians, heritage authorities, museums, archaeological researchers, and the architects or engineers responsible for modern projects. A UNESCO Tentative List submission is labeled as such; it is not presented as an inscription decision. Project-team statements remain attributed to their authors even when hosted by a professional institution.

There are no long source quotations in the catalog. Descriptions are original summaries, with concise evidence mappings. Photographs, scans, drawings and third-party models are not made reusable merely because a source page is public.

## Existing skills and runnable models

The work follows the repository's [architecture and built-heritage research skill](../../../skills/architecture-and-built-heritage-research/SKILL.md), particularly its [traditions and sources](../../../skills/architecture-and-built-heritage-research/references/traditions_and_sources.md) and [conservation and delivery](../../../skills/architecture-and-built-heritage-research/references/conservation_and_delivery.md) guidance. The [spatial 3D production skill](../../../skills/spatial-3d-production-engineering/SKILL.md) provides the adjacent workflow for original model production.

The supplied samples are original, parameterized teaching geometry. They explain selected forms and relationships; they are **not historical scans, measured surveys or authenticated reconstructions** of the listed monuments. Use the sample metadata, units and generation instructions before editing or exporting them.

When developing a site-specific reconstruction, separate observed fabric, documented lost fabric, later interventions and conjecture. Preserve the source and author of each decision. Real conservation or construction requires qualified local professionals and custodians; a runnable scene or attractive render does not establish structural adequacy, authenticity or permission to intervene.
