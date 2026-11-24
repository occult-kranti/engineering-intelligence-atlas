#!/usr/bin/env python3
"""Compare frozen paired skill-evaluation receipts offline; never promote or run skills."""
import argparse
import datetime as dt
import hashlib
import json
import math
import re
from pathlib import Path

HASH = re.compile(r"^[a-f0-9]{64}$")


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(",", ":"), allow_nan=False).encode()).hexdigest()


def number(value):
    if not isinstance(value, (int, float)) or isinstance(value, bool):
        return False
    try:
        return math.isfinite(value)
    except (OverflowError, ValueError):
        return False


def stamp(value):
    if not isinstance(value, str):
        raise ValueError("timestamp must be a string")
    result = dt.datetime.fromisoformat(value.replace("Z", "+00:00"))
    if result.tzinfo is None:
        raise ValueError("timestamp needs a timezone")
    return result


def evaluate(protocol, receipt):
    """Validate supplied evidence, then compare outcomes; declarations are not attestation."""
    result = {
        "schema_version": 1, "decision": "inconclusive", "automatic_promotion": False,
        "protocol_sha256": None, "receipt_sha256": None, "reasons": [], "metrics": None,
        "claim_scope": "Bounded comparison of supplied task outcomes only; the gate cannot verify judge honesty, actual execution, or generalization.",
    }
    unknown, reject = [], []
    try:
        result["protocol_sha256"] = digest(protocol)
        result["receipt_sha256"] = digest(receipt)
    except (TypeError, ValueError, RecursionError):
        result["reasons"] = ["Input is not finite canonical JSON."]
        return result
    try:
        if not isinstance(protocol, dict) or type(protocol.get("schema_version")) is not int or protocol["schema_version"] != 1:
            raise ValueError("unsupported protocol schema")
        if not isinstance(receipt, dict) or type(receipt.get("schema_version")) is not int or receipt["schema_version"] != 1:
            raise ValueError("unsupported receipt schema")
        experiment = protocol["experiment_id"]
        if not isinstance(experiment, str) or not 1 <= len(experiment) <= 200:
            raise ValueError("experiment_id is required")
        repetitions = protocol["repetitions"]
        if isinstance(repetitions, bool) or not isinstance(repetitions, int) or not 2 <= repetitions <= 20:
            raise ValueError("between two and twenty predeclared repetitions are required")
        threshold = protocol["min_mean_gain"]
        regression = protocol["max_case_regression"]
        ceiling = protocol["max_external_provider_usd"]
        if not number(threshold) or not 0 < threshold <= 1:
            raise ValueError("min_mean_gain must be in (0, 1]")
        if not number(regression) or not 0 <= regression <= 1:
            raise ValueError("max_case_regression must be in [0, 1]")
        if not number(ceiling) or ceiling < 0:
            raise ValueError("external-provider ceiling must be known and nonnegative")
        frozen = stamp(protocol["frozen_at"])
        hashes = protocol["skill_sha256"]
        if not isinstance(hashes, dict) or set(hashes) != {"baseline", "candidate"} or any(not isinstance(h, str) or not HASH.fullmatch(h) for h in hashes.values()):
            raise ValueError("both skill hashes are required")
        if hashes["baseline"] == hashes["candidate"]:
            raise ValueError("baseline and candidate skill hashes must differ")
        environment = protocol["environment"]
        if not isinstance(environment, dict) or set(environment) != {"model_id", "settings_sha256", "tools_sha256"}:
            raise ValueError("fixed model/settings/tools environment is required")
        if not isinstance(environment["model_id"], str) or not environment["model_id"].strip():
            raise ValueError("model_id is required")
        if any(not isinstance(environment[k], str) or not HASH.fullmatch(environment[k]) for k in ("settings_sha256", "tools_sha256")):
            raise ValueError("invalid environment hashes")
        cases = protocol["cases"]
        if not isinstance(cases, list) or not 2 <= len(cases) <= 200:
            raise ValueError("case manifest needs between two and two hundred cases")
        case_map = {}
        for case in cases:
            if not isinstance(case, dict) or set(case) != {"id", "split", "critical", "input_sha256", "rubric_sha256"}:
                raise ValueError("invalid case contract")
            key = case["id"]
            if not isinstance(key, str) or not 1 <= len(key) <= 200 or key in case_map:
                raise ValueError("case IDs must be nonempty and unique across splits")
            if case["split"] not in {"development", "held_out"} or not isinstance(case["critical"], bool):
                raise ValueError("invalid case split or critical flag")
            if any(not isinstance(case[k], str) or not HASH.fullmatch(case[k]) for k in ("input_sha256", "rubric_sha256")):
                raise ValueError("invalid case or rubric hash")
            case_map[key] = case
        if {c["split"] for c in cases} != {"development", "held_out"}:
            raise ValueError("disjoint development and held-out cases are required")
        development_inputs = {c["input_sha256"] for c in cases if c["split"] == "development"}
        held_out_inputs = {c["input_sha256"] for c in cases if c["split"] == "held_out"}
        if development_inputs & held_out_inputs:
            raise ValueError("task input hashes overlap development and held-out splits")
    except (KeyError, TypeError, ValueError) as exc:
        result["reasons"] = ["Invalid frozen protocol: " + str(exc)]
        return result

    if receipt.get("experiment_id") != experiment or receipt.get("protocol_sha256") != result["protocol_sha256"]:
        unknown.append("Receipt does not identify the exact frozen experiment and protocol.")
    if receipt.get("evidence_kind") != "observed_agent_runs":
        unknown.append("Synthetic, static or unclassified results do not establish agent improvement.")
    if receipt.get("independent_review") is not True:
        unknown.append("Independent outcome review is absent or unknown.")
    if receipt.get("environment_verified") is not True:
        unknown.append("Comparable model/settings/tool environment is absent or unknown.")
    if receipt.get("held_out_contaminated") is not False:
        unknown.append("Held-out contamination is present or unknown; freeze a new disjoint set.")
    tuned = receipt.get("tuning_case_ids")
    if not isinstance(tuned, list) or any(not isinstance(x, str) or x not in case_map or case_map[x]["split"] != "development" for x in tuned):
        unknown.append("Tuning IDs are missing, unknown, or overlap held-out evaluation.")
    rows = receipt.get("results")
    if not isinstance(rows, list):
        rows = []
        unknown.append("Outcome rows are missing.")
    if len(rows) > 8000:
        result["reasons"] = ["Outcome count exceeds the bounded 8,000-row review limit."]
        return result
    paired, seen = {}, set()
    external, external_known, platform_known = 0.0, True, True
    for index, row in enumerate(rows):
        label = "row " + str(index)
        try:
            if not isinstance(row, dict):
                raise ValueError("row must be an object")
            variant, cid, repetition = row["variant"], row["case_id"], row["repetition"]
            if variant not in {"baseline", "candidate"} or cid not in case_map:
                raise ValueError("unknown variant or case")
            if isinstance(repetition, bool) or not isinstance(repetition, int) or not 1 <= repetition <= repetitions:
                raise ValueError("repetition is outside the fixed range")
            key = (variant, cid, repetition)
            if key in seen:
                raise ValueError("duplicate paired outcome")
            seen.add(key)
            label = "/".join(map(str, key))
            case = case_map[cid]
            if row["skill_sha256"] != hashes[variant] or row["environment"] != environment:
                raise ValueError("skill or environment differs from the frozen protocol")
            if row["input_sha256"] != case["input_sha256"] or row["rubric_sha256"] != case["rubric_sha256"]:
                raise ValueError("task input or outcome rubric changed")
            if stamp(row["evaluated_at"]) < frozen:
                raise ValueError("evaluation predates protocol freeze")
            if row["status"] != "evaluated":
                raise ValueError("outcome is missing or unavailable")
            score = row["score"]
            if not number(score) or not 0 <= score <= 1:
                raise ValueError("score must be finite and in [0, 1]")
            if not isinstance(row["evidence_ref"], str) or not row["evidence_ref"].strip():
                raise ValueError("raw task-output evidence is missing")
            if not isinstance(row["judge_id"], str) or not row["judge_id"].strip():
                raise ValueError("judge identity is missing")
            failures = row["critical_failures"]
            if not isinstance(failures, list) or any(not isinstance(x, str) or not x.strip() for x in failures):
                raise ValueError("invalid hard-gate result")
            if variant == "candidate" and failures:
                reject.append(label + ": candidate failed a critical gate.")
            cost = row["external_provider_usd"]
            if cost is None:
                external_known = False
                unknown.append(label + ": external-provider cost is unknown.")
            elif not number(cost) or cost < 0:
                raise ValueError("invalid external-provider cost")
            else:
                external += cost
                if not math.isfinite(external):
                    external_known = False
                    reject.append("Recorded external-provider cost overflowed the finite accounting range and exceeded the ceiling.")
            for field in ("platform_usd", "platform_tokens"):
                value = row.get(field)
                if value is None:
                    platform_known = False
                elif not number(value) or value < 0:
                    raise ValueError("invalid platform telemetry")
                elif field == "platform_tokens" and not isinstance(value, int):
                    raise ValueError("platform token count must be an integer or unknown")
            paired[key] = score
        except (KeyError, TypeError, ValueError) as exc:
            external_known = False
            unknown.append(label + ": " + str(exc))
    expected = {(v, c, r) for v in ("baseline", "candidate") for c in case_map for r in range(1, repetitions + 1)}
    if set(paired) != expected:
        external_known = False
        unknown.append("Complete paired outcomes are required for every frozen case and repetition.")
    if external > ceiling + 1e-12:
        reject.append("Recorded external-provider cost exceeded the frozen ceiling.")
    result["external_provider_usd"] = external if external_known else None
    result["platform_telemetry_complete"] = platform_known
    complete = set(paired) == expected
    deltas, by_split = [], {"development": [], "held_out": []}
    for cid, case in case_map.items():
        critical_loss = case["critical"] and any(
            ("baseline", cid, r) in paired and ("candidate", cid, r) in paired
            and paired[("candidate", cid, r)] < paired[("baseline", cid, r)] - 1e-12
            for r in range(1, repetitions + 1)
        )
        if critical_loss:
            reject.append(cid + ": critical regression in a known paired repetition.")
        case_complete = all((v, cid, r) in paired for v in ("baseline", "candidate") for r in range(1, repetitions + 1))
        if case_complete:
            b = sum(paired[("baseline", cid, r)] for r in range(1, repetitions + 1)) / repetitions
            c = sum(paired[("candidate", cid, r)] for r in range(1, repetitions + 1)) / repetitions
            delta = c - b
            deltas.append({"case_id": cid, "split": case["split"], "baseline_mean": b, "candidate_mean": c, "gain": delta})
            by_split[case["split"]].append(delta)
            limit = 0.0 if case["critical"] else regression
            if delta < -limit - 1e-12 and not critical_loss:
                reject.append(cid + ": unacceptable case regression.")
    result["metrics"] = {"held_out_mean_gain": None, "case_means": deltas, "repetitions": repetitions, "paired_outcomes_complete": complete}
    if complete:
        held_gain = sum(by_split["held_out"]) / len(by_split["held_out"])
        result["metrics"]["held_out_mean_gain"] = held_gain
        if held_gain <= 0 or held_gain + 1e-12 < threshold:
            reject.append("Held-out mean gain did not meet the frozen positive threshold.")
    result["reasons"] = reject + unknown
    result["decision"] = "reject" if reject else "inconclusive" if unknown else "candidate-qualified"
    if result["decision"] == "candidate-qualified":
        result["reasons"] = ["Supplied paired outcomes meet the frozen bounded comparison; independent release review is still required."]
    return result


def load_json(path):
    def unique(pairs):
        out = {}
        for key, value in pairs:
            if key in out:
                raise ValueError("duplicate JSON key: " + key)
            out[key] = value
        return out
    raw = Path(path).read_bytes()
    if len(raw) > 4 * 1024 * 1024:
        raise ValueError("receipt/protocol exceeds the 4 MiB review bound")
    return json.loads(raw, object_pairs_hook=unique, parse_constant=lambda value: (_ for _ in ()).throw(ValueError("non-finite JSON number")))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("protocol", type=Path)
    parser.add_argument("receipt", type=Path)
    args = parser.parse_args()
    try:
        result = evaluate(load_json(args.protocol), load_json(args.receipt))
    except (OSError, UnicodeError, ValueError, RecursionError) as exc:
        result = {"schema_version": 1, "decision": "inconclusive", "automatic_promotion": False, "reasons": [str(exc)]}
    print(json.dumps(result, indent=2, allow_nan=False))
    return {"candidate-qualified": 0, "reject": 1, "inconclusive": 2}[result["decision"]]


if __name__ == "__main__":
    raise SystemExit(main())
