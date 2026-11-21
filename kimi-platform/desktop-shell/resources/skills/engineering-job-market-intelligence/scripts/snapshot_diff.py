#!/usr/bin/env python3
"""Compare two public-jobs JSON snapshots without inferring removals after failure.

Both snapshots are streamed with ijson (one pass per file) into a temporary
disk-backed SQLite index, so neither snapshot is ever fully loaded into
Python memory. The output schema and comparison semantics are identical to
the original in-memory implementation.
"""
import argparse
import datetime as dt
import json
import sqlite3
import tempfile
from pathlib import Path

try:
    import ijson
    from ijson.common import ObjectBuilder
except ImportError as exc:
    raise SystemExit(
        "error: snapshot_diff.py requires the 'ijson' package (with the "
        "yajl2_c backend) to stream large snapshots; install it with "
        "'pip install ijson'."
    ) from exc

COMPARE_FIELDS = ("title", "url", "locations", "employment_type", "department", "category", "posted_date", "updated_at", "description", "responsibilities", "basic_qualifications", "preferred_qualifications")

def key(record):
    return (record.get("source", ""), record.get("company", ""), str(record.get("source_job_id", "")))

class SnapshotError(Exception):
    """Raised when a snapshot file cannot be opened or parsed."""

def scan_snapshot(path, on_record):
    """Stream one snapshot in a single ijson pass.

    Calls on_record(record) for every entry of the top-level "records" array
    and returns (retrieved_at, failures) for the top-level metadata fields.
    Never materializes the full file in memory.
    """
    retrieved_at = None
    failures = []
    try:
        fh = open(path, "rb")
    except OSError as exc:
        raise SnapshotError(f"cannot open snapshot {path}: {exc}") from exc
    with fh:
        try:
            events = ijson.parse(fh)
            prefix, event, _ = next(events)
            if (prefix, event) != ("", "start_map"):
                raise SnapshotError(f"snapshot {path} must contain a top-level JSON object")
            builder = None
            builder_is_record = False
            depth = 0
            for prefix, event, value in events:
                if builder is not None:
                    builder.event(event, value)
                    if event in ("start_map", "start_array"):
                        depth += 1
                    elif event in ("end_map", "end_array"):
                        depth -= 1
                        if depth == 0:
                            item = builder.value
                            builder = None
                            if builder_is_record:
                                on_record(item)
                            else:
                                failures.append(item)
                    continue
                if prefix in ("records.item", "failures.item"):
                    if event in ("start_map", "start_array"):
                        builder = ObjectBuilder()
                        builder_is_record = prefix == "records.item"
                        depth = 1
                        builder.event(event, value)
                    elif prefix == "records.item":
                        on_record(value)
                    else:
                        failures.append(value)
                elif prefix == "retrieved_at" and event == "string":
                    retrieved_at = value
        except ijson.JSONError as exc:
            raise SnapshotError(f"snapshot {path} is not valid JSON: {exc}") from exc
    return retrieved_at, failures

def load_index(conn, table, path):
    """Stream a snapshot into a disk-backed SQLite table keyed by
    (source, company, source_job_id). Later duplicates replace earlier
    ones, matching dict-comprehension semantics of the original tool."""
    conn.execute(
        f"CREATE TABLE {table} ("
        "source TEXT NOT NULL, company TEXT NOT NULL, source_job_id TEXT NOT NULL, "
        "record TEXT NOT NULL, "
        "PRIMARY KEY (source, company, source_job_id)) WITHOUT ROWID"
    )
    insert = f"INSERT OR REPLACE INTO {table} VALUES (?, ?, ?, ?)"
    batch = []
    def on_record(record):
        if not isinstance(record, dict):
            raise SnapshotError(f"snapshot {path} contains a non-object record: {record!r}")
        batch.append((*key(record), json.dumps(record, ensure_ascii=False)))
        if len(batch) >= 256:
            conn.executemany(insert, batch)
            batch.clear()
    retrieved_at, failures = scan_snapshot(path, on_record)
    if batch:
        conn.executemany(insert, batch)
    conn.commit()
    return retrieved_at, failures

JOIN_ON = "o.source = n.source AND o.company = n.company AND o.source_job_id = n.source_job_id"

def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--previous", required=True, type=Path)
    p.add_argument("--current", required=True, type=Path)
    p.add_argument("--output", required=True, type=Path)
    args = p.parse_args()
    try:
        with tempfile.TemporaryDirectory(prefix="snapshot_diff_") as tmp:
            conn = sqlite3.connect(str(Path(tmp) / "index.db"))
            conn.execute("PRAGMA journal_mode = OFF")
            conn.execute("PRAGMA synchronous = OFF")
            conn.execute("PRAGMA temp_store = MEMORY")
            old_retrieved_at, _old_failures = load_index(conn, "old", args.previous)
            new_retrieved_at, failures = load_index(conn, "new", args.current)

            added = [json.loads(r) for (r,) in conn.execute(
                f"SELECT n.record FROM new n LEFT JOIN old o ON {JOIN_ON} "
                "WHERE o.source IS NULL ORDER BY n.source, n.company, n.source_job_id")]

            changed = []
            for source, company, source_job_id, old_json, new_json in conn.execute(
                    f"SELECT o.source, o.company, o.source_job_id, o.record, n.record "
                    f"FROM old o JOIN new n ON {JOIN_ON} "
                    "ORDER BY o.source, o.company, o.source_job_id"):
                old_r = json.loads(old_json)
                new_r = json.loads(new_json)
                fields = [f for f in COMPARE_FIELDS if old_r.get(f) != new_r.get(f)]
                if fields:
                    changed.append({"key": (source, company, source_job_id), "changed_fields": fields, "previous": old_r, "current": new_r})

            incomplete = bool(failures)
            removed = [] if incomplete else [json.loads(r) for (r,) in conn.execute(
                f"SELECT o.record FROM old o LEFT JOIN new n ON {JOIN_ON} "
                "WHERE n.source IS NULL ORDER BY o.source, o.company, o.source_job_id")]
            conn.close()
    except SnapshotError as exc:
        raise SystemExit(f"error: {exc}") from exc

    output = {
        "generated_at": dt.datetime.now(dt.timezone.utc).isoformat(),
        "previous_retrieved_at": old_retrieved_at, "current_retrieved_at": new_retrieved_at,
        "summary": {"added": len(added), "changed": len(changed), "removed_or_disappeared": len(removed), "removals_suppressed_for_incomplete_current_run": incomplete},
        "added": added, "changed": changed, "removed_or_disappeared": removed,
        "current_failures": failures,
        "note": "Disappearance is not proof a vacancy was filled. Removals are suppressed whenever the current run reports a source failure."
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(output, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(output["summary"], indent=2))

if __name__ == "__main__":
    main()
