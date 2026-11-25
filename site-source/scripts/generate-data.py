#!/usr/bin/env python3
"""Build-time data generator for the Engineering Intelligence Atlas.

Reads verified research inputs from ../.work and emits typed static
TypeScript modules under src/data. No runtime Python or network
dependency: the app bundles only the emitted files.
"""
import csv
import json
import sys
from pathlib import Path

WORK = Path(__file__).resolve().parents[2] / ".work"
OUT = Path(__file__).resolve().parents[1] / "src" / "data"
sys.path.insert(0, str(WORK))

import roles_data  # noqa: E402
import ecosystem_data  # noqa: E402
import indexed_leads  # noqa: E402

OUT.mkdir(parents=True, exist_ok=True)


def ts(obj):
    return json.dumps(obj, ensure_ascii=False, indent=2)


def write(name, header, body):
    path = OUT / name
    path.write_text(header + body + "\n", encoding="utf-8")
    print(f"wrote {path.name}: {path.stat().st_size} bytes")


# ---------------------------------------------------------------- roles
roles = [
    {
        "function": r["function"],
        "name": r["name"],
        "mission": r["mission"],
        "outputs": r["outputs"],
        "skills": r["skills"],
        "senior": r["senior"],
        "interfaces": r["interfaces"],
        "source": r["source"],
    }
    for r in roles_data.ROLES
]
print(f"roles: {len(roles)}")
write(
    "roles.ts",
    "import type { Role } from './types';\n\nexport const ROLES: Role[] = ",
    ts(roles) + ";",
)

# ---------------------------------------------------------------- resources
# Canonical public metadata is committed; no scratch-module dependency.
resource_catalog_path = Path(__file__).resolve().parents[2] / "company" / "role-library" / "resource-catalog.json"
resource_catalog = json.loads(resource_catalog_path.read_text(encoding="utf-8"))
resource_fields = ("domain", "name", "type", "level", "url", "purpose", "prereqs", "access", "license", "caveat", "verified")
resources = [{key: item[key] for key in resource_fields} for item in resource_catalog["resources"]]
print(f"resources: {len(resources)}")
write(
    "resources.ts",
    "import type { Resource } from './types';\n\nexport const RESOURCES: Resource[] = ",
    ts(resources) + ";",
)

# ---------------------------------------------------------------- ecosystem
repos = [
    {
        "domain": r["domain"],
        "repository": r["repository"],
        "url": r["url"],
        "official": r["official"],
        "purpose": r["purpose"],
        "status": r["status"],
        "license": r["license"],
        "pushedAt": r["pushed_at"] or None,
        "stars": r["stars_snapshot"] if isinstance(r["stars_snapshot"], int) else None,
        "verified": r["verified"],
        "caveat": r["caveat"],
    }
    for r in ecosystem_data.AGENT_REPOS
]
skills = [
    {
        "vendor": s["vendor"],
        "name": s["name"],
        "url": s["url"],
        "type": s["type"],
        "status": s["status"],
        "license": s["license"],
        "verified": s["verified"],
        "caveat": s["caveat"],
    }
    for s in ecosystem_data.SKILLS
]
topics = [
    {
        "domain": t["domain"],
        "tags": t["tags"],
        "query": t["query"],
        "url": t["url"],
        "verified": t["verified"],
        "caveat": t["caveat"],
    }
    for t in ecosystem_data.TOPICS
]
communities = [
    {
        "domain": c["domain"],
        "name": c["name"],
        "platform": c["platform"],
        "url": c["url"],
        "official": c["official"],
        "access": c["access"],
        "verified": c["verified"],
        "caveat": c["caveat"],
    }
    for c in ecosystem_data.COMMUNITIES
]
print(
    f"ecosystem: repos={len(repos)} skills={len(skills)} "
    f"topics={len(topics)} communities={len(communities)}"
)
header = (
    "import type { AgentRepo, SkillEntry, TopicSearch, Community } from './types';\n\n"
)
body = (
    f"export const AGENT_REPOS: AgentRepo[] = {ts(repos)};\n\n"
    f"export const SKILL_ENTRIES: SkillEntry[] = {ts(skills)};\n\n"
    f"export const TOPIC_SEARCHES: TopicSearch[] = {ts(topics)};\n\n"
    f"export const COMMUNITIES: Community[] = {ts(communities)};\n"
)
write("ecosystem.ts", header, body)

# ---------------------------------------------------------------- leads
leads = [
    {
        "company": l["company"],
        "title": l["title"],
        "family": l["family"],
        "location": l["location"],
        "qualificationSummary": l["qualification_summary"],
        "officialUrl": l["official_url"],
        "evidenceUrl": l["evidence_url"],
        "evidenceClass": l["evidence_class"],
        "retrieved": l["retrieved"],
        "liveStatus": l["live_status"],
        "note": l["note"],
    }
    for l in indexed_leads.LEADS
]
assert len(leads) == 15, len(leads)
write(
    "leads.ts",
    "import type { Lead } from './types';\n\nexport const LEADS: Lead[] = ",
    ts(leads) + ";",
)

# ---------------------------------------------------------------- papers (dedupe by URL)
papers = []
seen = set()
collection_names = {
    "scholar_react.csv": "Reasoning + acting agents",
    "scholar_multiagent.csv": "Multi-agent systems",
    "scholar_agent_security.csv": "Agent skill security",
}
for fname, label in collection_names.items():
    with open(WORK / fname, newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            url = (row.get("url") or "").strip()
            if not url or url in seen:
                continue
            seen.add(url)
            try:
                citations = int(row.get("citations") or 0)
            except ValueError:
                citations = 0
            papers.append(
                {
                    "title": (row.get("title") or "").strip(),
                    "authors": (row.get("authors") or "").strip(),
                    "year": (row.get("year") or "").strip(),
                    "citations": citations,
                    "publicationInfo": (row.get("publication_info") or "").strip(),
                    "url": url,
                    "collection": label,
                }
            )
write(
    "papers.ts",
    "import type { Paper } from './types';\n\nexport const PAPERS: Paper[] = ",
    ts(papers) + ";",
)
print(f"papers after URL dedupe: {len(papers)}")

# ---------------------------------------------------------------- jobs
analysis = json.loads((WORK / "jobs_analysis.json").read_text())
raw = json.loads((WORK / "current_public_jobs_amazon_rockstar.json").read_text())
records = raw["records"]
assert len(records) == 10560, len(records)

rockstar_board = []
amazon_by_cat = {}
for r in records:
    if r["company"] == "Rockstar Games":
        rockstar_board.append(
            {
                "title": r["title"],
                "url": r["url"],
                "locations": r.get("locations") or [],
                "department": r.get("department") or "",
                "postedDate": r.get("posted_date") or "",
            }
        )
    else:
        cat = r.get("category") or "Uncategorized"
        amazon_by_cat.setdefault(cat, []).append(
            {
                "title": r["title"],
                "url": r["url"],
                "locations": (r.get("locations") or [])[:3],
                "postedDate": r.get("posted_date") or "",
            }
        )
assert len(rockstar_board) == 16, len(rockstar_board)
print(f"amazon categories: {len(amazon_by_cat)}")
# representative links: first 3 records per Amazon category (snapshot order)
amazon_samples = {c: v[:3] for c, v in sorted(amazon_by_cat.items())}

jobs = {
    "retrievedAt": analysis["retrieved_at"],
    "recordCount": analysis["record_count"],
    "companies": analysis["companies"],
    "titleFamilyCounts": analysis["title_family_counts"],
    "contentFamilyCounts": analysis["content_family_counts"],
    "skillsByTitleFamily": {
        k: {"jobCount": v["job_count"], "topSkills": v["top_skills"]}
        for k, v in analysis["skills_by_title_family"].items()
    },
    "amazonCategoryCounts": analysis["amazon_category_counts"],
    "rockstarDepartmentCounts": analysis["rockstar_department_counts"],
    "seniorityByCompany": analysis["seniority_by_company"],
    "examples": analysis["examples"],
    "limitations": raw.get("limitations") or [],
    "rockstarBoard": rockstar_board,
    "amazonSamples": amazon_samples,
}
write(
    "jobs.ts",
    "import type { JobsEvidence } from './types';\n\nexport const JOBS: JobsEvidence = ",
    ts(jobs) + ";",
)

# ---------------------------------------------------------------- reverse engineering
interop = json.loads((WORK / "interoperability.json").read_text())
games = json.loads((WORK / "games.json").read_text())
catalog = json.loads((WORK / "awesome_rea_catalog.json").read_text())
repo_index = json.loads((WORK / "awesome_rea_repository_index.json").read_text())
snapshot = json.loads((WORK / "rea_topic_snapshot.json").read_text())

assert interop["meta"]["n"] == 17667
assert games["total"] == 3013 and len(games["mods"]) == 17
assert catalog["meta"]["resource_count"] == 5191
assert len(snapshot["records"]) == 485

showcase_ids = {"rea-dxball-case", "rea-th04-case", "rea-notion-case"}
showcases = [
    {
        "name": r["name"],
        "url": r["url"],
        "targets": r.get("targets") or [],
        "evidenceClass": r.get("evidence_class"),
        "description": r.get("description_en") or "",
    }
    for r in catalog["resources"]
    if r["id"] in showcase_ids
]
assert len(showcases) == 3

cap = repo_index["meta"]["canonical_capture"]["counts"]
top_snapshot = sorted(
    snapshot["records"], key=lambda r: -(r.get("stars") or 0)
)[:12]
reverse = {
    "interoperability": {
        "n": interop["meta"]["n"],
        "updated": interop["meta"]["updated"],
        "categories": [
            {"name": c[0], "slug": c[2], "count": c[3]} for c in interop["meta"]["cats"]
        ],
        "rowCount": len(interop["rows"]),
    },
    "games": {
        "generatedAt": games["generated_at"],
        "total": games["total"],
        "browserPlayable": games["browser_playable"],
        "uniqueGames": games["unique_games"],
        "counts": games["counts"],
        "inactiveCounts": games["inactive_counts"],
        "inactiveCutoff": games["inactive_cutoff"],
        "active": games["active"],
        "inactive": games["inactive"],
        "topics": games["topics"],
        "modCount": len(games["mods"]),
        "sources": games["sources"],
    },
    "reaCatalog": {
        "siteUrl": catalog["meta"]["site_url"],
        "repositoryUrl": catalog["meta"]["repository_url"],
        "resourceCount": catalog["meta"]["resource_count"],
        "independentIntegrationCount": catalog["meta"]["independent_integration_count"],
        "paperCount": catalog["meta"]["paper_count"],
        "latestReview": catalog["meta"]["latest_review"],
        "verificationNote": catalog["meta"]["verification_note"],
        "sourceIndex": catalog["meta"]["source_index"],
    },
    "repositoryIndex": {
        "uniqueRepos": cap["unique_repos"],
        "successfulScans": cap["successful_readme_scans"],
        "attemptedScans": cap["attempted_readme_scans"],
        "failed": cap["failed"],
        "status": repo_index["meta"]["canonical_capture"]["status"],
        "completedAt": repo_index["meta"]["canonical_capture"]["completed_at"],
        "publishedSelection": repo_index["meta"].get("published_selection_count"),
    },
    "topicSnapshot": {
        "retrievedAt": snapshot["retrieved_at"],
        "method": snapshot["method"],
        "recordCount": len(snapshot["records"]),
        "top": [
            {
                "fullName": r["full_name"],
                "url": r["url"],
                "description": r.get("description") or "",
                "stars": r.get("stars") or 0,
                "language": r.get("language") or "",
                "license": r.get("license") or "",
                "archived": bool(r.get("archived")),
            }
            for r in top_snapshot
        ],
    },
    "officialShowcases": showcases,
}
# ------------------------------------------------- reverse analysis (clusters)
import pickle  # noqa: E402

norm = pickle.load(open(WORK / "normalized.pkl", "rb"))
cl = pickle.load(open(WORK / "clusters.pkl", "rb"))
records_n = norm["records"]
uniq_n = norm["uniq"]

from collections import Counter  # noqa: E402

per_source = Counter(x["source"] for x in records_n)
tier_counts = Counter(u["best_tier"] for u in uniq_n)

# Corrected 2026-11-20 pass figures, recomputed from the corrected artifacts
# (in-scope unique population 22,522 after removing 189 excluded-only Tier-4
# projects; all 29,873 source occurrences retained).
multi_source = sum(1 for u in uniq_n if u.get("n_sources", 0) >= 2)
assert multi_source == 5139, multi_source
language_blank = sum(
    1
    for x in records_n
    if x.get("source") in ("interoperability", "rea_topic_snapshot")
    and not (x.get("language") or "").strip()
)
assert language_blank == 1216, language_blank
games_link_status = Counter(
    str(x.get("link_status")) for x in records_n if x.get("source") == "games"
)
assert games_link_status.get("200") == 3028, games_link_status
clusters = [
    {
        "clusterId": c["cluster_id"],
        "rank": c["rank"],
        "nDocs": c["n_docs"],
        "topTerms": c["top_terms"],
        "reps": [
            {"name": r["name"], "url": r["url"], "description": r["description"]}
            for r in c["reps"]
        ],
    }
    for c in cl["clusters"]
]
reverse["analysis"] = {
    "sourceOccurrences": len(records_n),
    "uniqueProjects": len(uniq_n),
    # Multi-source corroborated core (recomputed under repository-root
    # grouping; was 5,136 before the 2026-11-20 correction pass).
    "multiSourceProjects": multi_source,
    # Language is recorded only by the interoperability catalog and the topic
    # snapshot; blank means unknown/not recorded (was misreported as 12,937).
    "languageBlank": language_blank,
    "clusterCount": len(clusters),
    "perSourceOccurrences": [
        {"source": norm["SRC_LABEL"][k], "count": v}
        for k, v in sorted(per_source.items(), key=lambda kv: -kv[1])
    ],
    "tierLabels": norm["TIER_LABEL"],
    "tierCounts": [
        {"tier": int(t), "label": norm["TIER_LABEL"][t], "count": tier_counts[t]}
        for t in sorted(tier_counts)
    ],
    "overlapPairs": [
        {"pair": k, "count": v}
        for k, v in sorted(norm["overlap"].items(), key=lambda kv: -kv[1])
        if k.split("|")[0] != k.split("|")[1]
    ][:6],
    # Corrected final workbook/analysis figures (supersede raw games.json
    # aggregates): 3,030 game-catalog records = 3,013 games + 17 mods.
    "gamesFinal": {
        "totalRecords": 3030,
        "games": 3013,
        "mods": 17,
        "typeCounts": {
            "static-recomp": 1009,
            "decompilation": 920,
            "engine-remake": 409,
            "source-port": 364,
            "disassembly": 238,
            "browser-port": 57,
            "tool": 16,
        },
        "activity": {"active": 2613, "inactive": 356, "unknown": 61},
        "activityCutoff": games["inactive_cutoff"],
        # Corrected link-check figures: 3,028 x 200, 1 x 401, 1 x 403.
        "linkStatus": dict(sorted(games_link_status.items())),
        "linkExceptions": {
            "401": "grand-theft-auto-v",
            "403": "super-mario-64-multiplayer",
        },
        "linkOkDisclosure": (
            "upstream link_ok=True for all 3,030 rows; a link-checked row "
            "does not mean the link is accessible"
        ),
    },
    # Corrected cluster audit: mixed/approximate themes by cluster ID.
    "mixedClusters": [5, 8, 9, 15, 19],
}
reverse["clusters"] = clusters
print(
    f"reverse analysis: {len(records_n)} occurrences, {len(uniq_n)} unique, {len(clusters)} clusters"
)
write(
    "reverse.ts",
    "import type { ReverseEvidence } from './types';\n\nexport const REVERSE: ReverseEvidence = ",
    ts(reverse) + ";",
)
print("done")
