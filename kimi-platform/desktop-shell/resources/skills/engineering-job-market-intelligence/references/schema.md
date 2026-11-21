# Snapshot schema and classification contract

## Contents

- Envelope
- Posting fields
- Derived signals
- Longitudinal fields

## Envelope

The collector writes JSON with `schema_version`, `retrieved_at` (UTC), `records`, `record_count`, `crawl_log`, `failures`, and `limitations`. Keep this envelope intact for reproducibility.

## Posting fields

| Field | Meaning |
|---|---|
| source / company | Official source channel and employer label |
| source_job_id / requisition_id | Stable identifiers supplied by the source; requisition may join multi-location openings |
| title / url | Unmodified title and canonical public posting URL |
| locations / employment_type | Public location and schedule fields; preserve multiple locations |
| department / category / team | Source labels; do not normalize away the original |
| posted_date / updated_at | Source-provided timestamps; missing means not supplied |
| description / responsibilities | Public role text; empty responsibility field means no separately parsed section |
| basic_qualifications / preferred_qualifications | Minimum/basic versus preferred evidence when the source supplies separate fields |
| role_families | Multi-label deterministic title/content classification; not employer-certified |
| seniority_signal | Title-language signal only; not a cross-company level conversion |
| skills_mentioned | Controlled dictionary matches anywhere in retained role text; mention does not prove requirement |
| years_experience_signals | Numeric year expressions found in text; not a minimum or verified requirement by itself |

## Classification semantics

Title/category matches are stronger than content matches. The current collector adds selected content families after at least two pattern matches, which identifies relevance but not necessarily the job’s primary craft. For primary-role analysis, recompute or store title/category matches separately. For skill analysis, distinguish basic/minimum, preferred, responsibilities, and generic company boilerplate whenever the source allows it.

## Longitudinal fields

A production store should add `evidence_class`, `first_seen`, `last_seen`, `last_checked`, `removed_at`, `status`, `content_hash`, `extraction_version`, `official_url`, `verification_note`, and `raw_snapshot_reference`. Use `(source, company, source_job_id)` as the posting key and requisition ID for secondary role-level deduplication. Never silently drop the original location-specific rows.
