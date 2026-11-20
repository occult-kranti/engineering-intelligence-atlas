# Structured data

All observations are point-in-time snapshots dated 2026-11-20 unless a file records an earlier upstream review date.

| File | Contents | Primary use |
|---|---|---|
| `engineering_capability_and_resource_database.xlsx` | 109 role charters, 296 resources, 35 agent repositories, 125 skill/plugin records, topics, communities, and 42 research papers | Role design, hiring scorecards, learning paths, and tool discovery |
| `public_engineering_jobs_snapshot_2026-11-20.xlsx` | 10,560 verified live records (10,544 Amazon in 14 selected categories plus Rockstar's full 16-record board), 15 separately labeled indirect/indexed leads, summaries, crawl log, and dictionary | Filtering, reconciliation, and qualitative role/requirement analysis |
| `public_engineering_jobs_snapshot_2026-11-20.json.gz` | Gzip-compressed raw JSON snapshot with source fields and crawl logs | Programmatic reuse and future snapshot diffs |
| `reverse_engineered_software_landscape.xlsx` | 29,873 source occurrences, 22,522 in-scope repository/resource groups, 191 excluded rows retained for audit, source provenance, 20 clusters, acquisition log, and dictionary | Reverse-engineering/recreation landscape analysis |
| `reviewed_models.json` | Seven metadata-reviewed local-model entries with pinned revisions, exact files/bytes, licenses, runtime requirements, and exclusions | Desktop model planning; not proof of hardware fit or safe remote-code execution |
| `scientific_and_model_research_library.xlsx` | Seven dedicated science/model charters, 15 skills, 4,163 resource occurrences, 3,813 unique URLs, 105 model entries, all 3,030 game records, and 73 evaluation rows | Scientific/model research, evaluation, and provenance filtering |
| `scientific_research_index.json` | Machine-readable index of agents, skills, counts, evidence classes, and source reports | Application integration and integrity checks |
| `skill_registry_audit.json` | Non-executing inventory of the fifteen skill folders, file hashes, metadata checks, and review signals | Activation review; not a malware scan or safety certification |

## Integrity rules

- The Amazon snapshot is category-selected, not a census of all Amazon jobs. Meta, Google, and Netflix are absent from verified aggregates because collection was prohibited, unverified, or blocked; their 15 leads are not live-posting evidence.
- Role-family and skill counts are deterministic multi-label signals, not employer certifications, market demand, or individual productivity measures.
- Reverse-engineering counts describe five catalogs, not the internet. Automated index rows and popularity-biased topic samples remain separate from source-reviewed records.
- Repository visibility, stars, and uploader-supplied license strings do not establish quality, adoption, security, or redistribution rights. Review the exact project and folder license before reuse.
- No downloaded project code, unknown sample, ROM, proprietary asset, or leaked source is included or executed.

Use the `engineering-job-market-intelligence` skill's snapshot and diff scripts for a future refresh. Re-check source terms and robots rules before every collection, and suppress disappearance conclusions when a current run has source failures.
