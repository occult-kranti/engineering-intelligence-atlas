#!/usr/bin/env python3
"""Prepare a private, reviewable portfolio plan from local JSON snapshots.

No network, repository writes, native commands, model calls or source execution.
Private output is refused inside application/sibling Git checkouts. A public demo is generated
from fixed synthetic records only, never by redacting real input text.
"""
from __future__ import annotations

import argparse
import copy
import hashlib
import json
import os
from pathlib import Path
import re
import tempfile
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_PRESETS = ROOT / "company" / "portfolio-presets.json"
IDENTITY_FIELDS = ("name", "repoUrl", "source", "importedAt", "visibility", "defaultBranch")
REPOSITORY_URL = re.compile(r"https://github\.com/([A-Za-z0-9][A-Za-z0-9-]{0,38})/([A-Za-z0-9_.-]{1,100})\Z")
MAX_INPUT_BYTES = 50_000_000
PUBLIC_GROUP_KEYS = ("control-platform", "civic-intelligence", "learning-games", "evidence-archives", "scientific-labs", "audio-resonance", "pattern-symbolic", "personal-tools", "growth-and-ventures")


class PlanError(ValueError):
    pass


def no_symlink(path: Path) -> None:
    if any(part.is_symlink() for part in (path, *path.parents)):
        raise PlanError("Symlink paths are not accepted for plan inputs or outputs.")


def load_json(path: Path) -> tuple[Any, str]:
    no_symlink(path.absolute())
    if not path.is_file() or path.stat().st_size > MAX_INPUT_BYTES:
        raise PlanError("Input must be a regular local JSON file within the size limit.")
    raw = path.read_bytes()
    try:
        value = json.loads(raw)
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise PlanError("An input is not valid UTF-8 JSON.") from error
    return value, hashlib.sha256(raw).hexdigest()


def text(value: Any, field: str, maximum: int = 4000) -> str:
    if not isinstance(value, str) or not value.strip() or len(value) > maximum:
        raise PlanError(f"Invalid {field}.")
    return value


def unique_map(rows: Any, field: str, label: str) -> dict[str, dict]:
    if not isinstance(rows, list) or not rows:
        raise PlanError(f"{label} must be a nonempty list.")
    result: dict[str, dict] = {}
    for row in rows:
        if not isinstance(row, dict):
            raise PlanError(f"Invalid {label} record.")
        key = text(row.get(field), f"{label} identity", 300)
        if key.casefold() in {existing.casefold() for existing in result}:
            raise PlanError(f"Duplicate {label} identity.")
        result[key] = row
    return result


def prepare_plan(inventory: dict, briefs: list, review: dict, presets: dict, hashes: dict) -> dict:
    if not isinstance(inventory, dict) or not isinstance(review, dict) or not isinstance(presets, dict):
        raise PlanError("Inventory, review and presets must be objects.")
    groups = unique_map(presets.get("groups"), "key", "groups")
    taxonomy = set(presets.get("taxonomy", []))
    if not taxonomy or not all(isinstance(tag, str) for tag in taxonomy):
        raise PlanError("Preset taxonomy is invalid.")
    if review.get("schemaVersion") != 1 or presets.get("schemaVersion") != 1:
        raise PlanError("Unsupported review or preset schema version.")
    source_rows = inventory.get("repositories")
    if not isinstance(source_rows, list) or not source_rows:
        raise PlanError("Inventory must contain source repositories.")
    identities: dict[str, dict] = {}
    seen_urls: set[str] = set()
    for row in source_rows:
        if not isinstance(row, dict) or any(field not in row for field in IDENTITY_FIELDS):
            raise PlanError("Source repository identity is incomplete.")
        match = REPOSITORY_URL.fullmatch(text(row.get("repoUrl"), "repository URL", 300))
        if not match or match.group(2) in (".", "..") or row.get("name") != match.group(2):
            raise PlanError("Source name must exactly match its canonical GitHub URL.")
        if row.get("visibility") not in ("public", "private", "internal"):
            raise PlanError("Repository visibility must be explicit.")
        text(row.get("defaultBranch"), "default branch", 200)
        identity = "/".join(match.groups())
        if row["repoUrl"].casefold() in seen_urls:
            raise PlanError("Duplicate source repository identity.")
        seen_urls.add(row["repoUrl"].casefold())
        identities[identity] = {field: copy.deepcopy(row[field]) for field in IDENTITY_FIELDS}
    brief_by_repo = unique_map(briefs, "repository", "briefs")
    review_by_repo = unique_map(review.get("repositories"), "repository", "review")
    if set(identities) != set(brief_by_repo) or set(identities) != set(review_by_repo):
        raise PlanError("Inventory, briefs and explicit review must cover exactly the same source identities.")

    repositories = []
    for identity, source in identities.items():
        brief = brief_by_repo[identity]
        annotation = review_by_repo[identity]
        if brief.get("visibility") != source["visibility"] or brief.get("branch") != source["defaultBranch"]:
            raise PlanError("Brief visibility/branch does not match the immutable source snapshot.")
        group_key = annotation.get("groupKey")
        if group_key not in groups:
            raise PlanError("Review references an unknown parent group.")
        tags = annotation.get("taxonomy")
        if not isinstance(tags, list) or not tags or len(set(tags)) != len(tags) or not set(tags).issubset(taxonomy):
            raise PlanError("Review taxonomy must use unique preset tags.")
        result = brief.get("result")
        result = result if isinstance(result, dict) else {}
        structured = result.get("structuredContent", {})
        body = structured.get("content", "") if isinstance(structured, dict) else ""
        body = body if isinstance(body, str) and not result.get("isError") else ""
        readme_status = "available" if body else "unavailable"
        source_url = structured.get("display_url") if body else None
        source_sha = structured.get("sha") if body else None
        if body and (not isinstance(source_sha, str) or not re.fullmatch(r"[a-f0-9]{40}", source_sha)):
            raise PlanError("A supplied README requires its observed Git blob SHA.")
        if body and (not isinstance(source_url, str) or not source_url.startswith(source["repoUrl"] + "/blob/")):
            raise PlanError("README evidence must refer to its own source repository.")
        observations = annotation.get("observations")
        if not isinstance(observations, list) or not 1 <= len(observations) <= 6:
            raise PlanError("Every repository needs explicit README observations or an access limitation.")
        evidence = []
        for item in observations:
            if not isinstance(item, dict):
                raise PlanError("Invalid README observation.")
            statement = text(item.get("statement"), "observation")
            excerpt = item.get("excerpt")
            if body and (not isinstance(excerpt, str) or not excerpt or excerpt not in body or len(excerpt) > 2000):
                raise PlanError("Observation excerpt is not present in the supplied README snapshot.")
            if not body and excerpt not in (None, ""):
                raise PlanError("An unavailable README cannot supply a quotation.")
            evidence.append({"statement": statement, "excerpt": excerpt or None, "status": "readme-claim" if body else "unknown"})
        steps = annotation.get("roadmap")
        if not isinstance(steps, list) or len(steps) != 3:
            raise PlanError("Each source repository must have exactly three proposed next steps.")
        source_id = "repo-" + hashlib.sha256(source["repoUrl"].encode()).hexdigest()[:24]
        roadmap = []
        for number, step in enumerate(steps, 1):
            if not isinstance(step, dict):
                raise PlanError("Invalid roadmap step.")
            acceptance = step.get("acceptance")
            if not isinstance(acceptance, list) or not 1 <= len(acceptance) <= 6:
                raise PlanError("Each proposed step needs concrete acceptance checks.")
            for check in acceptance:
                text(check, "acceptance check", 2000)
            roadmap.append({
                "id": f"{source_id}-next-{number}", "title": text(step.get("title"), "step title", 240),
                "rationale": text(step.get("rationale"), "step rationale"), "acceptance": acceptance,
                "status": "proposed", "inferred": True,
                "basis": "inferred-from-readme" if body else "inferred-no-readme",
                "ownerEmployeeId": "donna", "scope": {"kind": "company", "sourceRepositoryId": source_id},
                "dependsOn": [] if number == 1 else [f"{source_id}-next-{number - 1}"],
                "verification": {"status": "not-run", "evidenceRefs": []},
            })
        repositories.append({
            "sourceRepositoryId": source_id, "repository": identity, "sourceRepository": source,
            "groupKey": group_key, "taxonomy": tags, "groupingBasis": "application-purpose-inferred-from-readme",
            "evidence": {"readme": {"status": readme_status, "path": "README.md", "sha": source_sha, "url": source_url}, "observations": evidence},
            "roadmap": roadmap,
        })
    return {
        "schemaVersion": 1, "classification": "private", "source": {"snapshotAt": inventory.get("fetchedAt"), **hashes},
        "method": "Explicit local review of supplied README snapshots; no source commands, tests, deployment or model requests executed.",
        "identityPolicy": "Preserve every source repository identity and visibility; parent groups are organizational overlays only.",
        "groups": [copy.deepcopy(group) for group in groups.values()], "repositories": repositories,
        "application": {"status": "prepared-not-applied", "companyResolution": "Match registered company repoUrl to sourceRepository.repoUrl; refuse missing or ambiguous matches.", "defaultRoadmapOwner": "donna", "completionRequiresEvidence": True},
    }


def synthetic_demo(presets: dict) -> dict:
    """Construct from approved public fields, never from inventory or review."""
    groups = unique_map(presets.get("groups"), "key", "groups")
    if tuple(groups) != PUBLIC_GROUP_KEYS:
        raise PlanError("Public demo groups must match the fixed generic taxonomy.")
    return {"schemaVersion": 1, "classification": "synthetic-demo", "repositories": [
        {"sourceRepositoryId": f"demo-repo-{n:02d}", "name": f"demo-app-{n:02d}",
         "repoUrl": f"https://github.com/example/demo-app-{n:02d}", "groupKey": key,
         "status": "example-not-imported", "roadmap": [
             {"title": "Define a scoped outcome", "status": "proposed"},
             {"title": "Implement one vertical slice", "status": "proposed"},
             {"title": "Verify and record the result", "status": "proposed"},
         ]} for n, key in enumerate(groups, 1)
    ]}


def write_json(path: Path, value: Any, *, private: bool, replace: bool = False) -> None:
    path = path.absolute()
    no_symlink(path)
    destination = path.resolve()
    # The hosted workspace can itself have an ambient source-control marker
    # above this application checkout. The explicitly selected sibling private
    # directory is not part of the application's publishable tree. Still reject
    # this checkout and any other actual descendant/sibling checkout.
    checkout_parents = [parent for parent in (destination.parent, *destination.parents)
                        if parent == ROOT or parent not in ROOT.parents]
    if private and any((parent / ".git").exists() for parent in checkout_parents):
        raise PlanError("Private portfolio output cannot be written inside a Git worktree.")
    if destination.exists() and not replace:
        raise PlanError("Output exists; choose a new path or explicitly use --replace.")
    destination.parent.mkdir(parents=True, exist_ok=True, mode=0o700 if private else 0o755)
    no_symlink(destination.parent)
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", dir=destination.parent, prefix=".portfolio-", suffix=".tmp", delete=False) as handle:
            temporary = Path(handle.name)
            os.fchmod(handle.fileno(), 0o600 if private else 0o644)
            json.dump(value, handle, indent=2, ensure_ascii=False, allow_nan=False)
            handle.write("\n"); handle.flush(); os.fsync(handle.fileno())
        os.replace(temporary, destination)
    finally:
        if temporary and temporary.exists():
            temporary.unlink()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--inventory", required=True, type=Path)
    parser.add_argument("--briefs", required=True, type=Path)
    parser.add_argument("--review", required=True, type=Path)
    parser.add_argument("--presets", type=Path, default=DEFAULT_PRESETS)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--demo-output", type=Path)
    parser.add_argument("--replace", action="store_true")
    args = parser.parse_args()
    try:
        inputs = [args.inventory, args.briefs, args.review, args.presets]
        destinations = [args.output] + ([args.demo_output] if args.demo_output else [])
        resolved = [path.resolve() for path in destinations]
        if len(set(resolved)) != len(resolved) or any(path in [item.resolve() for item in inputs] for path in resolved):
            raise PlanError("Outputs must be distinct from every input and from one another.")
        inventory, inventory_sha = load_json(args.inventory)
        briefs, briefs_sha = load_json(args.briefs)
        review, review_sha = load_json(args.review)
        presets, presets_sha = load_json(args.presets)
        # Public demos accept only this repository's generic, reviewable preset.
        if args.demo_output and args.presets.resolve() != DEFAULT_PRESETS.resolve():
            raise PlanError("A public demo may use only the bundled generic preset.")
        plan = prepare_plan(inventory, briefs, review, presets, {
            "inventorySha256": inventory_sha, "briefsSha256": briefs_sha,
            "reviewSha256": review_sha, "presetsSha256": presets_sha,
        })
        write_json(args.output, plan, private=True, replace=args.replace)
        if args.demo_output:
            write_json(args.demo_output, synthetic_demo(presets), private=False, replace=args.replace)
        print(f"Prepared private plan: {len(plan['repositories'])} preserved identities, {len(plan['repositories']) * 3} proposed steps. Nothing applied.")
    except (PlanError, OSError) as error:
        # Do not print input objects, credentials or private repository names.
        parser.exit(2, f"Portfolio preparation failed: {error}\n")


if __name__ == "__main__":
    main()
