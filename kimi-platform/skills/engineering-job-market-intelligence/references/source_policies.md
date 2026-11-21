# Source access and provenance policies

## Contents

- Mandatory controls
- Source-specific observations
- Evidence classes
- Refresh behavior

## Mandatory controls

Policies and technical access change. Re-check robots.txt, terms, and source behavior before every new adapter and periodically before refreshes. Use official public endpoints or pages at low rates; cache responses; request only new/changed detail pages where possible. Never bypass authentication, rate limits, robots restrictions, CAPTCHAs, IP/egress controls, or explicit automated-collection prohibitions. This is operational research guidance, not legal advice; obtain qualified review for jurisdiction-specific obligations.

## Source-specific observations from 2026-11-20

These observations are historical run context, not permanent permission.

| Source | Observed official channel | Observed constraint | Required behavior |
|---|---|---|---|
| Amazon Jobs | `https://www.amazon.jobs/en/search.json` | robots.txt disallows internal paths, not the public search JSON used by the collector | Use category paging, delays, stable IDs, and crawl log; re-check robots |
| Rockstar Games | `https://boards-api.greenhouse.io/v1/boards/rockstargames/jobs?content=true` | Greenhouse robots disallowed `/embed/`; public jobs API returned all postings | Use the official public Greenhouse board feed and preserve requisition IDs |
| Meta Careers | `https://www.metacareers.com/jobs/{id}` and published sitemaps | robots.txt states that automated data collection is prohibited without express written permission | **Do not crawl without written permission.** Use manual review/job alerts or clearly labeled indexed samples |
| Google Careers | `https://www.google.com/about/careers/applications/jobs/results/` | Direct retrieval failed in the research environment; robots could not be verified | Do not automate until policy and access are verified; keep indirect samples outside live aggregates |
| Netflix Jobs | `https://jobs.netflix.com/` | HTTP 403 “Not Available,” including robots retrieval | Stop; do not use proxies/stealth or convert the failure into zero openings |

## Evidence classes

- `verified_live`: full record directly retrieved from the official source during the snapshot.
- `indexed_official_sample`: search-index text or cached official-page content with an official job URL; current live status unverified.
- `indirect_mirror`: third-party copy or summary; useful for research leads only.
- `source_failed`: coverage-log entry, not a job record.

Store `evidence_class`, `retrieved_at`, `source_url`, `official_url`, and `verification_note` on every non-live lead. Never mix leads into verified-live counts, company comparisons, or skill-frequency charts.

## Refresh behavior

Treat each run as immutable. Track added, changed, and disappeared IDs. Suppress removals for any source with a failed or incomplete run. Preserve `first_seen`, `last_seen`, `last_checked`, `removed_at`, `content_hash`, and `updated_at`. Removal from a feed is not proof that a role was filled. Keep raw text and extraction-version metadata so classifications can be recomputed without losing evidence.
