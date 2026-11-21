#!/usr/bin/env python3
"""Create a non-executing, JSON evidence-intake and hashing record for an authorized file."""
import argparse
import datetime as dt
import hashlib
import json
import mimetypes
import os
from pathlib import Path


def utc_now():
    return dt.datetime.now(dt.timezone.utc).isoformat()


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--target", required=True, type=Path)
    p.add_argument("--authorization-ref", required=True)
    p.add_argument("--scope", required=True)
    p.add_argument("--output", required=True, type=Path)
    p.add_argument("--analyst", default="not supplied")
    p.add_argument("--allowed-actions", default="static analysis only")
    p.add_argument("--prohibited-actions", default="execution, network egress, external upload")
    p.add_argument("--dynamic-authorized", action="store_true")
    args = p.parse_args()

    target = args.target.expanduser()
    if not target.is_file() or target.is_symlink():
        p.error("target must be an existing regular, non-symlink file")
    if not args.authorization_ref.strip() or not args.scope.strip():
        p.error("authorization reference and scope are required")
    output = args.output.expanduser().resolve()
    if output == target.resolve():
        p.error("output must not overwrite the target")
    if output.exists():
        p.error("output already exists; preserve it and choose a new intake filename")

    hashes = {"sha256": hashlib.sha256(), "sha1": hashlib.sha1(), "md5": hashlib.md5()}
    size = 0
    first_bytes = bytearray()
    with target.open("rb") as f:
        while True:
            chunk = f.read(1024 * 1024)
            if not chunk:
                break
            if len(first_bytes) < 32:
                first_bytes.extend(chunk[:32-len(first_bytes)])
            size += len(chunk)
            for h in hashes.values():
                h.update(chunk)
    stat = target.stat()
    record = {
        "schema_version": "1.0",
        "created_at": utc_now(),
        "target": {
            "path": str(target.resolve()), "filename": target.name, "size_bytes": size,
            "mime_type_guess": mimetypes.guess_type(target.name)[0] or "unknown",
            "first_32_bytes_hex": bytes(first_bytes).hex(),
            "filesystem_modified_at": dt.datetime.fromtimestamp(stat.st_mtime, dt.timezone.utc).isoformat(),
            "hashes": {name: h.hexdigest() for name, h in hashes.items()},
            "hash_note": "SHA-256 is primary; MD5/SHA-1 are for correlation only, not collision-resistant integrity proof."
        },
        "authorization": {
            "reference": args.authorization_ref, "scope": args.scope,
            "allowed_actions": args.allowed_actions, "prohibited_actions": args.prohibited_actions,
            "dynamic_authorized": bool(args.dynamic_authorized)
        },
        "custody": [{"at": utc_now(), "actor": args.analyst, "action": "read-only intake and hashing; target was not executed"}],
        "handling": {"execute_on_host": False, "external_upload_authorized": False, "work_on_copy_required": True},
        "limitations": ["Filesystem timestamps may not represent original acquisition time.", "Magic bytes and MIME guesses require format-aware corroboration."]
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open("x", encoding="utf-8") as f:
        json.dump(record, f, ensure_ascii=False, indent=2)
    print(json.dumps({"output": str(output), "sha256": record["target"]["hashes"]["sha256"], "size_bytes": size, "dynamic_authorized": record["authorization"]["dynamic_authorized"]}, indent=2))

if __name__ == "__main__":
    main()
