#!/usr/bin/env python3
"""Collect public job postings from official Amazon Jobs and Greenhouse boards.

Writes a versioned JSON snapshot with full public posting text, normalized fields,
role-family title/content signals, and a crawl log. It never bypasses access
controls and stops a source on HTTP 401/403.
"""
from __future__ import annotations

import argparse
import datetime as dt
import html
import json
import re
import sys
import time
import urllib.robotparser
from pathlib import Path
from typing import Any, Iterable
from urllib.parse import urlparse

import requests
from bs4 import BeautifulSoup
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

SCHEMA_VERSION = "1.0"
USER_AGENT = "EngineeringJobMarketIntelligence/1.0 (public-careers-research)"
AMAZON_CATEGORIES = [
    "Software Development",
    "Systems, Quality, & Security Engineering",
    "Applied Science",
    "Design",
    "Data Science",
    "Research Science",
    "Business Intelligence",
    "Hardware Development",
    "Database Administration",
    "Economics",
    "Editorial, Writing, & Content Management",
    "Project/Program/Product Management--Technical",
    "Solutions Architect",
    "Operations, IT, & Support Engineering",
]

FAMILY_PATTERNS = {
    "ai_ml": r"\b(?:artificial intelligence|machine learning|deep learning|gen\s?ai|llm|large language model|nlp|computer vision|recommendation systems?|mlops|applied scientist)\b",
    "cybersecurity": r"\b(?:cyber\s?security|information security|application security|product security|security engineer|security analyst|threat intelligence|threat detection|vulnerability|incident response|detection engineering|malware|digital forensics?|reverse engineering|anti[- ]cheat|cheat software|game security|security compliance)\b",
    "ui_ux_design_research": r"\b(?:ux|ui[/ ]?ux|user experience|user research|ux research|product design|interaction design|visual design|experience design|design technologist|design systems?|ui designer)\b",
    "game_design": r"\b(?:game designer|gameplay designer|level designer|mission designer|quest designer|narrative designer|game systems designer|gameplay systems designer|technical game designer|world designer|game economy designer)\b",
    "game_engineering_art": r"\b(?:gameplay (?:programmer|engineer)|game engineer|game developer|gameplay engineer|graphics programmer|rendering engineer|engine programmer|tools programmer|technical artist|animation programmer|audio programmer|game security|anti[- ]cheat|cheat software)\b",
    "research_science": r"\b(?:research scientist|research engineer|researcher|research intern|research assistant|economist|postdoctoral researcher)\b",
    "frontend_mobile": r"\b(?:front[ -]?end|frontend|ui engineer|web engineer|web developer|ios engineer|android engineer|mobile engineer|client engineer|react developer)\b",
    "backend_fullstack": r"\b(?:back[ -]?end|backend|full[ -]?stack|software (?:development )?engineer|software developer|sde|api engineer|distributed systems|server engineer)\b",
    "data_analytics": r"\b(?:data engineer|data scientist|analytics engineer|business intelligence|data analyst|data platform|etl|database engineer|database administrator)\b",
    "platform_sre_infra": r"\b(?:site reliability|\bsre\b|devops|platform engineer|infrastructure engineer|cloud engineer|systems engineer|network engineer|production engineer|build engineer|release engineer)\b",
    "quality_engineering": r"\b(?:quality assurance|quality engineer|\bqa\b|sdet|software engineer in test|test engineer|testing engineer)\b",
    "technical_product_program": r"\b(?:technical program manager|technical product manager|product manager|program manager|technical producer|game producer)\b",
    "documentation_content": r"\b(?:technical writer|documentation engineer|content designer|ux writer|content strategist)\b",
}

SKILL_PATTERNS = {
    "Python": r"\bpython\b", "C++": r"\bc\+\+\b", "C#": r"\bc#\b",
    "Java": r"\bjava\b(?!\s*script)", "JavaScript": r"\bjavascript\b",
    "TypeScript": r"\btypescript\b", "Go": r"\b(?:golang|\bgo)\b",
    "Rust": r"\brust\b", "SQL": r"\bsql\b", "PyTorch": r"\bpytorch\b",
    "TensorFlow": r"\btensorflow\b", "JAX": r"\bjax\b", "scikit-learn": r"\bscikit[- ]learn\b",
    "Kubernetes": r"\bkubernetes\b|\bk8s\b", "Docker": r"\bdocker\b", "Linux": r"\blinux\b",
    "AWS": r"\baws\b|\bamazon web services\b", "Azure": r"\bazure\b", "Google Cloud": r"\bgcp\b|\bgoogle cloud\b",
    "React": r"\breact\b", "Node.js": r"\bnode(?:\.js|js)\b", "GraphQL": r"\bgraphql\b",
    "REST APIs": r"\brest(?:ful)?\b|\brest api", "OpenAPI": r"\bopenapi\b", "gRPC": r"\bgrpc\b",
    "Kafka": r"\bkafka\b", "Spark": r"\bspark\b", "Flink": r"\bflink\b", "Airflow": r"\bairflow\b",
    "dbt": r"\bdbt\b", "Terraform": r"\bterraform\b", "CI/CD": r"\bci\s*/\s*cd\b|continuous integration|continuous delivery",
    "Distributed systems": r"\bdistributed systems?\b", "Observability": r"\bobservability\b",
    "OpenTelemetry": r"\bopen\s?telemetry\b", "Prometheus": r"\bprometheus\b", "Grafana": r"\bgrafana\b",
    "SLOs": r"\bslos?\b|service level objectives?", "Incident response": r"\bincident response\b",
    "Threat modeling": r"\bthreat model(?:ing|ling)?\b", "Penetration testing": r"\bpenetration test(?:ing)?\b|\bpentest(?:ing)?\b",
    "Vulnerability management": r"\bvulnerability (?:management|scanning|assessment)", "IAM": r"\biam\b|identity and access management",
    "Cryptography": r"\bcryptograph(?:y|ic)\b", "SAST": r"\bsast\b|static application security testing",
    "DAST": r"\bdast\b|dynamic application security testing", "SCA": r"\bsca\b|software composition analysis",
    "CodeQL": r"\bcodeql\b", "Semgrep": r"\bsemgrep\b", "OWASP": r"\bowasp\b",
    "SIEM": r"\bsiem\b", "SOAR": r"\bsoar\b", "EDR": r"\bedr\b|endpoint detection and response",
    "Reverse engineering": r"\breverse engineer(?:ing)?\b", "Malware analysis": r"\bmalware analys(?:is|e)\b",
    "Ghidra": r"\bghidra\b", "YARA": r"\byara\b", "Frida": r"\bfrida\b",
    "Figma": r"\bfigma\b", "Prototyping": r"\bprototyp(?:e|ing)\b", "Usability testing": r"\busability test(?:ing)?\b",
    "User research": r"\buser research\b", "Accessibility": r"\baccessibility\b|\bwcag\b", "Design systems": r"\bdesign systems?\b",
    "RAG": r"\brag\b|retrieval[- ]augmented generation", "MCP": r"\bmcp\b|model context protocol",
    "LangChain": r"\blangchain\b", "LangGraph": r"\blanggraph\b", "vLLM": r"\bvllm\b",
    "Model evaluation": r"\bmodel evaluation\b|\bllm evaluation\b|\beval(?:uation)? (?:suite|framework|pipeline)s?\b",
    "Unreal Engine": r"\bunreal engine\b|\bue[45]\b", "Unity": r"\bunity\b", "Vulkan": r"\bvulkan\b",
    "Direct3D/D3D12": r"\bdirect\s?3d\b|\bd3d12\b", "Metal": r"\bmetal\b", "HLSL": r"\bhlsl\b",
    "RenderDoc": r"\brenderdoc\b", "PIX": r"\bpix\b", "3D mathematics": r"\b3d math(?:ematics)?\b|linear algebra",
}


def clean_html(value: str | None) -> str:
    if not value:
        return ""
    text = BeautifulSoup(html.unescape(value), "html.parser").get_text("\n")
    lines = [re.sub(r"\s+", " ", line).strip() for line in text.splitlines()]
    return "\n".join(line for line in lines if line)


def classify(title: str, category: str, text: str) -> list[str]:
    # Title matches are strong; content matches are included only for core requested families.
    title_text = f"{title}\n{category}"
    families = []
    for family, pattern in FAMILY_PATTERNS.items():
        if re.search(pattern, title_text, re.I):
            families.append(family)
    for family in ("ai_ml", "cybersecurity", "ui_ux_design_research", "game_design", "game_engineering_art", "research_science"):
        pattern = FAMILY_PATTERNS[family]
        if family not in families and len(re.findall(pattern, text, re.I)) >= 2:
            families.append(family)
    return families or ["other_or_unclear"]


def seniority_signal(title: str) -> str:
    rules = [
        ("internship", r"\bintern(?:ship)?\b|\bco-?op\b"),
        ("executive", r"\b(?:vice president|\bvp\b|chief|head of)\b"),
        ("director", r"\bdirector\b"), ("manager", r"\bmanager\b|\bem\b"),
        ("distinguished_fellow", r"\bdistinguished\b|\bfellow\b"),
        ("principal", r"\bprincipal\b"), ("staff", r"\bstaff\b"),
        ("lead", r"\blead\b|\btech lead\b"), ("senior", r"\bsenior\b|\bsr\.?\b|\biii\b"),
        ("associate_entry", r"\bassociate\b|\bjunior\b|\bentry[ -]?level\b|\bgraduate\b|\bearly career\b"),
    ]
    for label, pattern in rules:
        if re.search(pattern, title, re.I):
            return label
    return "not_stated_or_midlevel_title"


def extract_skills(text: str) -> list[str]:
    return sorted(name for name, pattern in SKILL_PATTERNS.items() if re.search(pattern, text, re.I))


def years_signals(text: str) -> list[str]:
    vals = re.findall(r"(?<!\d)(\d{1,2})\s*\+?\s*(?:years|yrs)\b", text, re.I)
    return sorted(set(vals), key=int)


def base_record(source: str, company: str) -> dict[str, Any]:
    return {
        "source": source, "company": company, "source_job_id": "", "requisition_id": "",
        "title": "", "url": "", "locations": [], "employment_type": "", "department": "",
        "category": "", "team": "", "posted_date": "", "updated_at": "",
        "description": "", "responsibilities": "", "basic_qualifications": "",
        "preferred_qualifications": "", "role_families": [], "seniority_signal": "",
        "skills_mentioned": [], "years_experience_signals": [],
    }


def finalize(rec: dict[str, Any]) -> dict[str, Any]:
    text = "\n".join(str(rec.get(k, "")) for k in ("title", "category", "description", "responsibilities", "basic_qualifications", "preferred_qualifications"))
    rec["role_families"] = classify(rec["title"], rec.get("category", ""), text)
    rec["seniority_signal"] = seniority_signal(rec["title"])
    rec["skills_mentioned"] = extract_skills(text)
    rec["years_experience_signals"] = years_signals(text)
    return rec


class Collector:
    def __init__(self, delay: float, timeout: int):
        self.delay = delay
        self.timeout = timeout
        self.session = requests.Session()
        self.session.headers.update({"User-Agent": USER_AGENT, "Accept": "application/json,text/html;q=0.9,*/*;q=0.8"})
        retry = Retry(total=3, connect=3, read=3, backoff_factor=1.0, status_forcelist=(429, 500, 502, 503, 504), allowed_methods=("GET",), respect_retry_after_header=True)
        self.session.mount("https://", HTTPAdapter(max_retries=retry))
        self.logs: list[dict[str, Any]] = []

    def robots_allowed(self, url: str) -> bool:
        parsed = urlparse(url)
        robots_url = f"{parsed.scheme}://{parsed.netloc}/robots.txt"
        try:
            r = self.session.get(robots_url, timeout=self.timeout)
            if r.status_code in (401, 403):
                self.logs.append({"url": robots_url, "status": r.status_code, "result": "robots_unavailable_access_denied"})
                return False
            if r.status_code >= 400:
                self.logs.append({"url": robots_url, "status": r.status_code, "result": "robots_not_published"})
                return True
            rp = urllib.robotparser.RobotFileParser()
            rp.parse(r.text.splitlines())
            allowed = rp.can_fetch(USER_AGENT, url)
            self.logs.append({"url": robots_url, "status": r.status_code, "result": "allowed" if allowed else "disallowed"})
            return allowed
        except requests.RequestException as exc:
            self.logs.append({"url": robots_url, "result": "robots_check_failed", "error": type(exc).__name__})
            return False

    def get_json(self, url: str, params: dict[str, Any] | None = None) -> Any:
        time.sleep(self.delay)
        response = self.session.get(url, params=params, timeout=self.timeout)
        self.logs.append({"url": response.url, "status": response.status_code, "bytes": len(response.content)})
        if response.status_code in (401, 403):
            raise PermissionError(f"Access denied ({response.status_code}); stop this source: {response.url}")
        response.raise_for_status()
        return response.json()

    def amazon(self, categories: Iterable[str], max_pages: int | None) -> list[dict[str, Any]]:
        endpoint = "https://www.amazon.jobs/en/search.json"
        if not self.robots_allowed(endpoint):
            raise PermissionError("Amazon robots policy could not authorize this crawl")
        records: dict[str, dict[str, Any]] = {}
        for category in categories:
            offset = 0
            pages = 0
            while True:
                data = self.get_json(endpoint, {"category[]": category, "result_limit": 100, "offset": offset})
                jobs = data.get("jobs", [])
                hits = int(data.get("hits", 0))
                for job in jobs:
                    rec = base_record("Amazon Jobs API", "Amazon")
                    extra_locations = []
                    for item in job.get("locations", []):
                        if isinstance(item, dict):
                            extra_locations.append(item.get("location", ""))
                        elif isinstance(item, str):
                            try:
                                parsed = json.loads(item)
                                extra_locations.append(parsed.get("location", ""))
                            except json.JSONDecodeError:
                                extra_locations.append(item)
                    locations = [job.get("location", "")] + extra_locations
                    team = job.get("team") or ""
                    if isinstance(team, dict):
                        team = team.get("name") or team.get("title") or ""
                    rec.update({
                        "source_job_id": str(job.get("id_icims") or job.get("id") or ""),
                        "requisition_id": str(job.get("id_icims") or ""),
                        "title": job.get("title", ""),
                        "url": "https://www.amazon.jobs" + job.get("job_path", ""),
                        "locations": list(dict.fromkeys(x for x in locations if x)),
                        "employment_type": job.get("job_schedule_type") or "",
                        "department": team,
                        "category": job.get("job_category") or category,
                        "posted_date": job.get("posted_date") or "",
                        "updated_at": job.get("updated_time") or "",
                        "description": clean_html(job.get("description")),
                        "basic_qualifications": clean_html(job.get("basic_qualifications")),
                        "preferred_qualifications": clean_html(job.get("preferred_qualifications")),
                    })
                    records[rec["url"] or rec["source_job_id"]] = finalize(rec)
                pages += 1
                offset += len(jobs)
                if not jobs or offset >= hits or (max_pages is not None and pages >= max_pages):
                    break
        return list(records.values())

    def greenhouse(self, board: str) -> list[dict[str, Any]]:
        endpoint = f"https://boards-api.greenhouse.io/v1/boards/{board}/jobs"
        if not self.robots_allowed(endpoint):
            raise PermissionError("Greenhouse robots policy could not authorize this crawl")
        data = self.get_json(endpoint, {"content": "true"})
        records = []
        for job in data.get("jobs", []):
            content = clean_html(job.get("content"))
            company_name = {"rockstargames": "Rockstar Games"}.get(board, board)
            rec = base_record("Greenhouse public board API", company_name)
            rec.update({
                "source_job_id": str(job.get("id", "")),
                "requisition_id": str(job.get("requisition_id") or ""),
                "title": job.get("title", ""), "url": job.get("absolute_url", ""),
                "locations": [job.get("location", {}).get("name", "")],
                "department": "; ".join(d.get("name", "") for d in job.get("departments", [])),
                "category": "; ".join(d.get("name", "") for d in job.get("departments", [])),
                "posted_date": job.get("first_published") or "", "updated_at": job.get("updated_at") or "",
                "description": content,
            })
            records.append(finalize(rec))
        return records


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--amazon", action="store_true")
    parser.add_argument("--greenhouse-board", action="append", default=[])
    parser.add_argument("--category", action="append", dest="categories")
    parser.add_argument("--max-pages-per-category", type=int)
    parser.add_argument("--delay", type=float, default=0.35)
    args = parser.parse_args()
    if not args.amazon and not args.greenhouse_board:
        parser.error("select --amazon or at least one --greenhouse-board")
    collector = Collector(max(args.delay, 0.1), 45)
    records: list[dict[str, Any]] = []
    failures = []
    if args.amazon:
        try:
            records.extend(collector.amazon(args.categories or AMAZON_CATEGORIES, args.max_pages_per_category))
        except Exception as exc:
            failures.append({"source": "Amazon", "error": str(exc)})
    for board in args.greenhouse_board:
        try:
            records.extend(collector.greenhouse(board))
        except Exception as exc:
            failures.append({"source": board, "error": str(exc)})
    payload = {
        "schema_version": SCHEMA_VERSION,
        "retrieved_at": dt.datetime.now(dt.timezone.utc).isoformat(),
        "records": records,
        "record_count": len(records),
        "crawl_log": collector.logs,
        "failures": failures,
        "limitations": [
            "A snapshot proves what the source returned at retrieval time, not that a vacancy remains open later.",
            "Role families and skills are deterministic extraction signals, not employer-certified labels.",
            "Sources returning 401/403 are stopped and logged; no access-control bypass is attempted.",
        ],
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({"output": str(args.output), "record_count": len(records), "failures": failures}, indent=2))
    return 1 if not records and failures else 0


if __name__ == "__main__":
    sys.exit(main())
