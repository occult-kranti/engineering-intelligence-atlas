"""Offline, deterministic stdlib mirror of the shared assistant contract.

Mirrors app/contracts/assistant.ts (contractVersion 1) closely enough to
route repositories, validate action proposals, check schedules, and build
study queues OFFLINE. Pure Python 3 stdlib: no network, no I/O beyond the
files the caller passes in, no clocks, no randomness, no third-party code.

The runtime contract (TypeScript/zod) is the source of truth. This module is
a verification and triage aid for proposals and routing plans; it never
executes actions, never imports or clones repositories, and never makes
provider or paid calls.
"""

from __future__ import annotations

import hashlib
import json
import re
from typing import Any, Optional

CONTRACT_VERSION = 1


class ContractError(Exception):
    """Mirror of AssistantContractError: machine-checkable code + message."""

    def __init__(self, code: str, message: str) -> None:
        super().__init__(f"{code}: {message}")
        self.code = code


# ── Canonical JSON + SHA-256 (byte-parity with the TS contract) ──


def canonical_json(value: Any) -> str:
    """Sorted-key, compact JSON identical to canonicalJson in enterprise.ts."""
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def sha256_hex(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


SHA256_RE = re.compile(r"^[0-9a-f]{64}$")
COMMIT_SHA_RE = re.compile(r"^[0-9a-f]{40}$")
ENTERPRISE_KEY_RE = re.compile(r"^[a-z][a-z0-9-]*$")

# ── Scopes and gates ─────────────────────────────────────────────

ASSISTANT_SCOPES = ("enterprise", "company", "department", "office")
SCOPE_RANK = {"enterprise": 0, "company": 1, "department": 2, "office": 3}

ASSISTANT_GATES = (
    "plan-approval",
    "credentials",
    "external-writes",
    "code-execution",
    "physical-action",
    "high-risk",
    "live-provider-confirmation",
)

ASSISTANT_DEFINITIONS = ("donna", "company-operations-assistant", "department-coordinator", "repository-integration-steward")

DEFINITION_SCOPE = {
    "donna": "enterprise",
    "company-operations-assistant": "company",
    "department-coordinator": "department",
    "repository-integration-steward": "enterprise",
}

PROPOSAL_STATUSES = ("proposed", "approved", "rejected", "executed", "failed", "cancelled")

# ── Closed action set and policies (mirror of ASSISTANT_ACTION_POLICIES) ──

# (risk, requiresApproval, gates, drainAndPreserve, external, structural)
ACTION_POLICIES = {
    "queue.add": ("low", False, (), False, False, False),
    "queue.reorder": ("low", False, (), False, False, False),
    "worker.hire": ("medium", True, ("plan-approval",), False, False, False),
    "worker.pause": ("low", False, (), False, False, False),
    "worker.resume": ("low", False, (), False, False, False),
    "worker.fire": ("high", True, ("high-risk", "plan-approval"), True, False, False),
    "department.pause": ("medium", True, ("plan-approval",), False, False, False),
    "department.resume": ("medium", True, ("plan-approval",), False, False, False),
    "department.archive": ("high", True, ("high-risk", "plan-approval"), True, False, True),
    "company.pause": ("medium", True, ("plan-approval",), False, False, False),
    "company.resume": ("medium", True, ("plan-approval",), False, False, False),
    "company.archive": ("high", True, ("high-risk", "plan-approval"), True, False, True),
    "cache.invalidate": ("low", False, (), False, False, False),
    "schedule.upsert": ("medium", True, ("plan-approval",), False, False, False),
    "schedule.pause": ("low", False, (), False, False, False),
    "schedule.resume": ("low", False, (), False, False, False),
    "schedule.delete": ("medium", False, (), False, False, False),
    "schedule.run_now": ("medium", True, ("plan-approval",), False, False, False),
    "study.enqueue": ("low", False, (), False, False, False),
    "repository.import": ("high", True, ("external-writes", "credentials", "high-risk"), False, True, False),
    "repository.assign": ("medium", True, ("plan-approval",), False, False, False),
    "repository.propose_structure": ("high", True, ("high-risk", "plan-approval"), False, False, True),
    "knowledge.transfer": ("medium", True, ("plan-approval",), False, False, False),
    "program.pump": ("high", True, ("plan-approval", "live-provider-confirmation"), False, False, False),
}

FORBIDDEN_PAYLOAD_KEYS = frozenset(
    k.lower()
    for k in (
        "exec", "execute", "command", "shell", "script", "code",
        "credentials", "credential", "secret", "token", "password",
        "privatekey", "chainofthought", "cot",
    )
)


def _scan_forbidden(value: Any, depth: int, budget: list) -> Optional[str]:
    if depth > 8 or budget[0] <= 0 or not isinstance(value, (dict, list)):
        return None
    items = value.items() if isinstance(value, dict) else enumerate(value)
    for key, child in items:
        budget[0] -= 1
        if isinstance(value, dict) and str(key).lower() in FORBIDDEN_PAYLOAD_KEYS:
            return str(key)
        nested = _scan_forbidden(child, depth + 1, budget)
        if nested is not None:
            return nested
        if budget[0] <= 0:
            return None
    return None


def build_proposal(
    proposal_id: str,
    scope: str,
    actor: str,
    action: str,
    payload: dict,
    expected_version: int,
    proposed_at: int,
) -> dict:
    """Mirror of createAssistantProposal: policy-derived risk/approval/hash."""
    policy = ACTION_POLICIES.get(action)
    if policy is None:
        raise ContractError("unknown-action", f'action "{action}" is not in the closed action set')
    return {
        "contractVersion": CONTRACT_VERSION,
        "id": proposal_id,
        "scope": scope,
        "actor": actor,
        "action": action,
        "payload": payload,
        "risk": policy[0],
        "payloadHash": sha256_hex(canonical_json(payload)),
        "expectedVersion": expected_version,
        "requiresApproval": policy[1],
        "status": "proposed",
        "proposedAt": proposed_at,
        "decidedAt": None,
        "executedAt": None,
        "resultSummary": "",
    }


def validate_action(proposal: dict, approval: Optional[dict]) -> dict:
    """Mirror of validateAssistantAction. Raises ContractError; returns proposal.

    approval: None or {"approved": bool, "confirmedGates": [gate, ...]}.
    """
    if not isinstance(proposal, dict):
        raise ContractError("invalid-shape", "proposal must be a JSON object")
    if proposal.get("contractVersion") != CONTRACT_VERSION:
        raise ContractError(
            "unsupported-version",
            f'contractVersion {proposal.get("contractVersion")!r} is not {CONTRACT_VERSION}',
        )
    action = proposal.get("action")
    policy = ACTION_POLICIES.get(action)
    if policy is None:
        raise ContractError("unknown-action", f'action "{action}" is not in the closed action set')
    # Minimal structural validation (the zod schema is authoritative).
    for field in ("id", "scope", "actor", "payload", "risk", "payloadHash", "expectedVersion", "requiresApproval", "status", "proposedAt"):
        if field not in proposal:
            raise ContractError("invalid-shape", f"missing required field {field!r}")
    if proposal["scope"] not in ASSISTANT_SCOPES:
        raise ContractError("invalid-shape", f'unknown scope {proposal["scope"]!r}')
    if proposal["actor"] not in ASSISTANT_DEFINITIONS:
        raise ContractError("invalid-shape", f'unknown actor {proposal["actor"]!r}')
    if proposal["risk"] not in ("low", "medium", "high"):
        raise ContractError("invalid-shape", f'unknown risk {proposal["risk"]!r}')
    if proposal["status"] not in PROPOSAL_STATUSES:
        raise ContractError("invalid-shape", f'unknown status {proposal["status"]!r}')
    if not isinstance(proposal["payload"], dict):
        raise ContractError("invalid-shape", "payload must be a JSON object")
    if not isinstance(proposal["payloadHash"], str) or not SHA256_RE.match(proposal["payloadHash"]):
        raise ContractError("invalid-shape", "payloadHash must be 64 lowercase hex chars")
    if not isinstance(proposal["expectedVersion"], int) or proposal["expectedVersion"] < 1:
        raise ContractError("invalid-shape", "expectedVersion must be a positive integer")

    expected_hash = sha256_hex(canonical_json(proposal["payload"]))
    if proposal["payloadHash"] != expected_hash:
        raise ContractError(
            "payload-hash-mismatch",
            f'payloadHash {proposal["payloadHash"]} does not match {expected_hash}',
        )
    if proposal["risk"] != policy[0] or proposal["requiresApproval"] != policy[1]:
        raise ContractError(
            "policy-mismatch",
            f'risk/requiresApproval must come from the declared policy for "{action}"',
        )
    if SCOPE_RANK[DEFINITION_SCOPE[proposal["actor"]]] > SCOPE_RANK[proposal["scope"]]:
        raise ContractError(
            "scope-violation",
            f'{proposal["actor"]} (scope {DEFINITION_SCOPE[proposal["actor"]]}) cannot act at scope {proposal["scope"]}',
        )
    forbidden = _scan_forbidden(proposal["payload"], 0, [256])
    if forbidden is not None:
        raise ContractError(
            "forbidden-side-effect",
            f'payload key "{forbidden}" is forbidden (no side effects, secrets, or reasoning in proposals)',
        )
    if policy[3]:  # drainAndPreserve
        if proposal["payload"].get("drain") is not True or proposal["payload"].get("preserveArtifacts") is not True:
            raise ContractError(
                "drain-preserve-required",
                f'"{action}" requires payload {{"drain": true, "preserveArtifacts": true}} so in-flight work drains and artifacts are preserved',
            )
    if policy[1]:  # requiresApproval
        if approval is None or not approval.get("approved"):
            raise ContractError("approval-required", f'"{action}" ({policy[0]} risk) requires human approval')
        confirmed = approval.get("confirmedGates") or []
        for gate in policy[2]:
            if gate not in confirmed:
                raise ContractError(
                    "gate-not-confirmed",
                    f'"{action}" requires explicit confirmation of the "{gate}" gate',
                )
    return proposal


# ── Generic work queues ──────────────────────────────────────────

QUEUE_ITEM_KINDS = ("company-run", "study", "repository-triage", "custom")
QUEUE_ITEM_STATUSES = ("queued", "dispatched", "done", "dropped")


def create_queue_item(item_id: str, queue_id: str, item_kind: str, ref_id: str, position: int, payload: dict, title: str = "") -> dict:
    """Mirror of createQueueItem: queued status, version 1, hashed payload."""
    if item_kind not in QUEUE_ITEM_KINDS:
        raise ContractError("invalid-shape", f'unknown queue item kind {item_kind!r}')
    return {
        "contractVersion": CONTRACT_VERSION,
        "id": item_id,
        "queueId": queue_id,
        "itemKind": item_kind,
        "refId": ref_id,
        "title": title,
        "position": position,
        "status": "queued",
        "payloadHash": sha256_hex(canonical_json(payload)),
        "version": 1,
    }


def reorder_queue_items(items: list, ordered_ids: list) -> list:
    """Mirror of reorderQueueItems: named ids first, rest keep relative order.

    Positions are re-assigned densely 1..n; inputs are not mutated; item
    versions are untouched (the queue version is the OCC token). Raises on
    unknown/duplicate ids or mixed queue ids.
    """
    queue_ids = {item["queueId"] for item in items}
    if len(queue_ids) > 1:
        raise ContractError("mixed-queues", "reorder_queue_items requires items from a single queue")
    by_id = {}
    for item in items:
        if item["id"] in by_id:
            raise ContractError("duplicate-item", f'duplicate queue item id "{item["id"]}"')
        by_id[item["id"]] = item
    seen = set()
    reordered = []
    for item_id in ordered_ids:
        if item_id in seen:
            raise ContractError("duplicate-item", f'duplicate id "{item_id}" in the reorder list')
        item = by_id.get(item_id)
        if item is None:
            raise ContractError("unknown-item", f'reorder references unknown queue item "{item_id}"')
        seen.add(item_id)
        reordered.append(item)
    rest = sorted(
        (item for item in items if item["id"] not in seen),
        key=lambda item: (item["position"], item["id"]),
    )
    return [{**item, "position": index + 1} for index, item in enumerate(reordered + rest)]


# ── Cache invalidation targets ───────────────────────────────────

CACHE_NAMESPACES = ("skill-excerpts", "blueprint", "snapshot", "repository-metadata")


def build_cache_invalidation_report(namespace: str, scope_key: str, removed_keys: int, invalidated_at: int) -> dict:
    """Mirror of buildCacheInvalidationReport: counts only, never content."""
    if namespace not in CACHE_NAMESPACES:
        raise ContractError("invalid-shape", f'unknown cache namespace {namespace!r}')
    if not ENTERPRISE_KEY_RE.match(scope_key):
        raise ContractError("invalid-shape", "scopeKey must be lowercase kebab-case starting with a letter")
    return {
        "contractVersion": CONTRACT_VERSION,
        "namespace": namespace,
        "scopeKey": scope_key,
        "removedKeys": removed_keys,
        "invalidatedAt": invalidated_at,
    }


# ── Company / department lifecycle ───────────────────────────────

COMPANY_LIFECYCLE_STATUSES = ("active", "paused", "archived")
DEPARTMENT_LIFECYCLE_STATUSES = ("active", "paused", "archived")

# ── GitHub intake modes ──────────────────────────────────────────

GITHUB_INTAKE_MODES = ("public-anonymous", "credentialed-approved")


def validate_repository_intake(request: dict) -> dict:
    """Mirror of validateRepositoryIntake (credential rules enforced in code).

    "public-anonymous" reads confirmed public metadata with no credentials;
    "credentialed-approved" uses a vault credential record and is only valid
    under an approved repository.import proposal.
    """
    mode = request.get("intakeMode")
    if mode not in GITHUB_INTAKE_MODES:
        raise ContractError("invalid-shape", f'unknown intake mode {mode!r}')
    credential = request.get("credentialRecordId")
    if mode == "credentialed-approved" and credential is None:
        raise ContractError(
            "credentials-required",
            "credentialed-approved intake requires a vault credential record id (and an approved repository.import proposal)",
        )
    if mode == "public-anonymous" and credential is not None:
        raise ContractError("credential-not-permitted", "public-anonymous intake must not use credentials")
    return request


# ── Emergency stop (intentionally NOT an assistant action) ───────

EMERGENCY_STOP_ACTION_ID = "emergency.stop"
EMERGENCY_STOP_NOTE = (
    "Emergency stop is intentionally absent from ASSISTANT_ACTIONS: it is "
    "ungated, immediate, and never an assistant proposal."
)


# ── Deterministic assistant jobs and schedules ───────────────────

# (effect, providerCalls, paidCalls, executesProposals) — all always False.
JOB_POLICIES = {
    "ledger_refresh": ("refresh-ledger", False, False, False),
    "cache_refresh": ("refresh-cache", False, False, False),
    "program_pump_mock": ("pump-approved-mock", False, False, False),
    "repository_sync": ("propose-repository-drift", False, False, False),
    "study_plan": ("create-study-drafts", False, False, False),
}

SCHEDULE_BOUNDS = {
    "minIntervalMs": 60_000,
    "maxIntervalMs": 30 * 24 * 60 * 60 * 1000,
    "maxCatchUpRuns": 1,
}

ZERO_RESERVATION = {"maxTokens": 0, "maxCalls": 0, "maxMinutes": 0, "maxCostUsdMicros": 0}


def schedule_next_run(job: dict, now: int) -> Optional[int]:
    """Mirror of scheduleNextRun: bounded; missed intervals skipped in one step."""
    if not job.get("enabled"):
        return None
    max_runs = job.get("maxRuns")
    if max_runs is not None and job.get("runCount", 0) >= max_runs:
        return None
    schedule = job["schedule"]
    if schedule["type"] == "one-time":
        return schedule["runAt"] if job.get("runCount", 0) == 0 else None
    interval = min(
        max(schedule["intervalMs"], SCHEDULE_BOUNDS["minIntervalMs"]),
        SCHEDULE_BOUNDS["maxIntervalMs"],
    )
    anchor = schedule["anchorAt"] if job.get("lastRunAt") is None else job["lastRunAt"] + interval
    nxt = anchor
    if nxt <= now:
        missed = (now - nxt) // interval + 1
        nxt += missed * interval
    return nxt


# ── Study queue ──────────────────────────────────────────────────

STUDY_QUEUE_CAP = 32


def build_study_queue(skill_id: str, resources: list, goal: str, evaluation: str = "", cap: Optional[int] = None) -> list:
    """Mirror of buildStudyQueue: dedupe first-occurrence, capped, free drafts."""
    effective_cap = min(max(1, STUDY_QUEUE_CAP if cap is None else cap), STUDY_QUEUE_CAP)
    seen = set()
    items = []
    for resource in resources:
        ref = resource["ref"]
        if ref in seen:
            continue
        seen.add(ref)
        if len(items) >= effective_cap:
            break
        items.append(
            {
                "id": f"{skill_id}:{sha256_hex(ref)[:12]}",
                "skillId": skill_id,
                "resourceRef": ref,
                "topic": resource.get("topic", ""),
                "goal": goal,
                "evaluation": evaluation,
                "status": "draft",
                "providerCalls": False,
            }
        )
    return items


# ── Repository routing (mirror of routeRepository) ───────────────

# (discipline, companyKey, departmentKey, skillId, keywords)
REPO_ROUTING_RULES = (
    ("cybersecurity", "ai-cyber", "svc-cybersecurity", "defensive-reverse-engineering",
     ("security", "vulnerability", "exploit", "red-team", "reverse-engineering", "malware", "pentest", "cryptography", "ctf")),
    ("ai-research", "ai-cyber", "svc-ai-research", "ai-research-frontier",
     ("machine-learning", "deep-learning", "llm", "transformer", "neural", "inference", "fine-tuning", "embedding", "diffusion")),
    ("backend-engineering", "software", "svc-backend-engineering", "architecture-database-backend-engineering",
     ("backend", "api", "database", "postgres", "sql", "server", "rest", "graphql", "microservice", "orm")),
    ("computational-geometry", "software", "svc-computational-geometry", "computational-geometry-engineering",
     ("geometry", "mesh", "cad", "triangulation", "voronoi", "computational-geometry", "polygon", "spatial-index")),
    ("design", "civilization-design", "svc-design", "ui-ux-research-design-engineering",
     ("ui", "ux", "react", "css", "design", "component", "frontend", "tailwind", "figma", "accessibility")),
    ("music-production", "music", "svc-music-production", "music-theory-production-engineering",
     ("audio", "music", "midi", "synthesizer", "dsp", "sound", "composition", "mixing", "daw")),
    ("mathematics", "ai-cyber", "svc-mathematics", "mathematics-research",
     ("mathematics", "algebra", "topology", "number-theory", "proof", "combinatorics", "optimization")),
)

NEW_DOMAIN_HINTS = ("robotics", "biotech", "quantum", "aerospace", "embedded", "blockchain", "hardware", "autonomous")

PERMISSIVE_LICENSES = ("mit", "apache-2.0", "bsd-2-clause", "bsd-3-clause", "0bsd", "isc", "cc0-1.0", "unlicense", "zlib")

NEW_STRUCTURE_CONFIDENCE = 0.25


def repo_routing_confidence(matches: int) -> float:
    return min(90, 40 + 15 * matches) / 100


def _normalize_repo_text(metadata: dict) -> str:
    parts = [metadata["name"], metadata.get("description", ""), metadata.get("language") or ""]
    parts.extend(metadata.get("topics") or [])
    normalized = re.sub(r"[^a-z0-9]+", "-", " ".join(parts).lower())
    return f"-{normalized}-"


def _count_matches(normalized: str, keywords) -> tuple:
    matched = [kw for kw in keywords if f"-{kw}-" in normalized]
    return len(matched), matched


def validate_metadata(metadata: dict) -> None:
    """Minimal structural validation of confirmed public metadata."""
    required = ("url", "owner", "name", "archived", "defaultBranch", "commitSha", "visibility")
    for field in required:
        if field not in metadata:
            raise ContractError("invalid-metadata", f"missing required field {field!r}")
    if not isinstance(metadata["commitSha"], str) or not COMMIT_SHA_RE.match(metadata["commitSha"]):
        raise ContractError("invalid-metadata", "commitSha must be the full 40-character default-branch HEAD sha")
    if metadata["visibility"] not in ("public", "private", "internal"):
        raise ContractError("invalid-metadata", f'unknown visibility {metadata["visibility"]!r}')


def route_repository(metadata: dict) -> dict:
    """Mirror of routeRepository: pure, deterministic, honest routing.

    Returns a RepoAssignmentPlan-shaped dict (always a proposal; applying it
    requires the repository.assign / repository.propose_structure gate).
    """
    validate_metadata(metadata)
    notes = ["proposal only: no automatic import, clone, or role creation"]
    license_id = metadata.get("license")
    license_id = license_id.lower() if isinstance(license_id, str) else None
    permissive = license_id is not None and license_id in PERMISSIVE_LICENSES
    redistribution_allowed = bool(permissive and not metadata["archived"] and metadata["visibility"] == "public")
    if license_id is None:
        notes.append("no license declared: read-only; redistribution forbidden")
    elif not permissive:
        notes.append(f'license "{license_id}" is not on the permissive allowlist: read-only; redistribution forbidden')

    base = {
        "contractVersion": CONTRACT_VERSION,
        "url": metadata["url"],
        "commitSha": metadata["commitSha"],
        "readOnly": True,
        "redistributionAllowed": False,
    }

    def plan(status, company, department, discipline, skill, confidence, rationale, extra_notes=None, read_only=True, redistribution=False):
        return {
            **base,
            "status": status,
            "companyKey": company,
            "departmentKey": department,
            "discipline": discipline,
            "skillId": skill,
            "confidence": confidence,
            "rationale": rationale,
            "readOnly": read_only,
            "redistributionAllowed": redistribution,
            "notes": notes + (extra_notes or []),
        }

    if metadata["visibility"] != "public":
        return plan(
            "quarantined", None, None, None, None, 0,
            "repository is not public; only confirmed public metadata reads are permitted, so it is quarantined for human triage",
            ["non-public visibility: quarantined; metadata reads confirmed only"],
        )

    normalized = _normalize_repo_text(metadata)
    best = None
    for rule in REPO_ROUTING_RULES:
        count, matched = _count_matches(normalized, rule[4])
        if count > 0 and (best is None or count > best[0]):
            best = (count, matched, rule)

    if metadata["archived"]:
        archived_notes = ["archived upstream: quarantined read-only reference"]
        if best is None:
            return plan(
                "quarantined", None, None, None, None, 0,
                "repository is archived upstream and no declared routing rule matched; quarantined as a read-only reference",
                archived_notes,
            )
        count, _, rule = best
        return plan(
            "quarantined", rule[1], rule[2], rule[0], rule[3], repo_routing_confidence(count),
            f"repository is archived upstream; best-effort route to {rule[1]}/{rule[2]} is recorded read-only and quarantined",
            archived_notes,
        )

    if best is None:
        hint_count, hints = _count_matches(normalized, NEW_DOMAIN_HINTS)
        if hint_count > 0:
            return plan(
                "proposed_new_structure", None, None, None, None, NEW_STRUCTURE_CONFIDENCE,
                f"matches new-domain hint(s) [{', '.join(hints)}] outside the existing seven disciplines; explicit low-confidence proposal for new structure — never auto-creates companies, departments, or roles",
                ["low-confidence explicit proposal; human approval via repository.propose_structure required"],
            )
        return plan(
            "quarantined", None, None, None, None, 0,
            "no declared routing rule matched; quarantined for human triage (no invented companies, departments, or roles)",
        )

    count, matched, rule = best
    return plan(
        "assigned", rule[1], rule[2], rule[0], rule[3], repo_routing_confidence(count),
        f"matched keyword(s) [{', '.join(matched)}] for the declared {rule[0]} rule → {rule[1]}/{rule[2]} (skill {rule[3]})",
        read_only=not redistribution_allowed,
        redistribution=redistribution_allowed,
    )
