#!/usr/bin/env python3
"""Verify or materialize a pinned text-only resource pack without running it.

Linux is required for atomic no-replace publication. No package manager,
upstream installer, hook, plugin, MCP server or provider is invoked.
"""

from __future__ import annotations

import argparse
import ctypes
import errno
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import shutil
import stat
import subprocess
import sys
import tempfile

HERE = Path(__file__).absolute().parent
MODULES = ("core", "art", "design", "architecture", "programming", "engine-godot", "qa")
MAX_FILE_BYTES = 1024 * 1024
MAX_TOTAL_BYTES = 8 * 1024 * 1024
ALLOWED_GROUPS = {"agents", "skills", "commands", "rules", "docs"}


class IntegrityError(Exception):
    """A resource or path does not satisfy the reviewed lock."""


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def no_symlinks(path: Path) -> Path:
    """Reject symlinked existing path components, including the final one."""
    path = Path(os.path.abspath(path))
    current = Path(path.anchor)
    for part in path.parts[1:]:
        current /= part
        try:
            mode = current.lstat().st_mode
        except FileNotFoundError:
            continue
        if stat.S_ISLNK(mode):
            raise IntegrityError(f"Symlink rejected: {current}")
    return path


def relative_parts(value: str) -> tuple[str, ...]:
    if not isinstance(value, str) or not value or "\\" in value:
        raise IntegrityError("Invalid relative path")
    parts = value.split("/")
    if any(p in ("", ".", "..") or not re.fullmatch(r"[A-Za-z0-9_.-]+", p) for p in parts):
        raise IntegrityError(f"Unsafe relative path: {value}")
    if PurePosixPath(value).is_absolute():
        raise IntegrityError("Absolute resource path rejected")
    return tuple(parts)


def read_regular(root: Path, relative: str, limit: int = MAX_FILE_BYTES) -> bytes:
    """Read through no-follow directory descriptors, not symlink-resolved paths."""
    parts = relative_parts(relative)
    flags = os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW
    directory = os.open(no_symlinks(root), flags)
    try:
        for part in parts[:-1]:
            next_directory = os.open(part, flags, dir_fd=directory)
            os.close(directory)
            directory = next_directory
        fd = os.open(parts[-1], os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK, dir_fd=directory)
        try:
            info = os.fstat(fd)
            if not stat.S_ISREG(info.st_mode) or info.st_size > limit:
                raise IntegrityError(f"Not a bounded regular file: {relative}")
            with os.fdopen(fd, "rb", closefd=False) as stream:
                data = stream.read(limit + 1)
            if len(data) > limit:
                raise IntegrityError(f"Resource exceeds byte limit: {relative}")
            return data
        finally:
            os.close(fd)
    finally:
        os.close(directory)


def unique_object(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise IntegrityError(f"Duplicate JSON key: {key}")
        result[key] = value
    return result


def read_lock(path: Path) -> tuple[dict, str]:
    path = no_symlinks(path)
    raw = read_regular(path.parent, path.name)
    lock = json.loads(raw, object_pairs_hook=unique_object)
    if not isinstance(lock, dict):
        raise IntegrityError("Lock must be a JSON object")
    if lock.get("schemaVersion") != 1 or lock.get("modules") != list(MODULES):
        raise IntegrityError("Unsupported schema or selected module set")
    upstream = lock.get("upstream", {})
    if not isinstance(upstream, dict):
        raise IntegrityError("Invalid upstream provenance object")
    if upstream.get("repository") != "https://github.com/striderZA/OpenCodeGameStudios":
        raise IntegrityError("Unexpected upstream repository")
    if not re.fullmatch(r"[0-9a-f]{40}", upstream.get("commit", "")):
        raise IntegrityError("Invalid upstream commit")
    if not re.fullmatch(r"[0-9a-f]{64}", upstream.get("packageSha256", "")):
        raise IntegrityError("Missing package provenance hash")
    entries = lock.get("files")
    if not isinstance(entries, list) or not 1 <= len(entries) <= 500:
        raise IntegrityError("Invalid file allowlist")
    sources, destinations, seen_modules = set(), set(), set()
    total = 0
    license_seen = False
    for entry in entries:
        if not isinstance(entry, dict):
            raise IntegrityError("Invalid resource entry")
        source, destination = entry.get("source"), entry.get("destination")
        parts = relative_parts(source)
        relative_parts(destination)
        if source == "LICENSE":
            if destination != "UPSTREAM-LICENSE":
                raise IntegrityError("License destination mismatch")
            license_seen = True
        else:
            if len(parts) < 4 or parts[:2] != (".opencode", "modules") or parts[2] not in MODULES:
                raise IntegrityError(f"Source outside selected modules: {source}")
            module, tail = parts[2], parts[3:]
            if tail != ("modulefile.yaml",):
                if len(tail) < 2 or tail[0] not in ALLOWED_GROUPS or Path(tail[-1]).suffix not in {".md", ".yaml"}:
                    raise IntegrityError(f"Non-resource source rejected: {source}")
            expected = "/".join(("modules", module, *tail))
            if destination != expected:
                raise IntegrityError("Source/destination mapping mismatch")
            seen_modules.add(module)
        if source in sources or destination in destinations:
            raise IntegrityError("Duplicate source or destination")
        sources.add(source)
        destinations.add(destination)
        size = entry.get("bytes")
        if type(size) is not int or not 0 < size <= MAX_FILE_BYTES:
            raise IntegrityError("Invalid resource size")
        if not re.fullmatch(r"[0-9a-f]{64}", entry.get("sha256", "")):
            raise IntegrityError("Invalid resource hash")
        total += size
    if not license_seen or seen_modules != set(MODULES) or total > MAX_TOTAL_BYTES:
        raise IntegrityError("Missing license/module or excessive pack size")
    for module in MODULES:
        if f".opencode/modules/{module}/modulefile.yaml" not in sources:
            raise IntegrityError(f"Missing module manifest: {module}")
    return lock, sha256(raw)


def verify_source(source: Path, lock: dict) -> dict[str, bytes]:
    source = no_symlinks(source)
    if not source.is_dir():
        raise IntegrityError("Source must be an existing directory")
    env = {key: value for key, value in os.environ.items() if not key.startswith("GIT_")}
    env.update({"GIT_CONFIG_NOSYSTEM": "1", "GIT_CONFIG_GLOBAL": os.devnull, "GIT_OPTIONAL_LOCKS": "0"})
    def git_value(*args):
        result = subprocess.run(["git", "-C", str(source), *args], capture_output=True, text=True, env=env, timeout=15)
        if result.returncode:
            raise IntegrityError("Source Git provenance check failed")
        return result.stdout.strip()
    if git_value("rev-parse", "HEAD") != lock["upstream"]["commit"]:
        raise IntegrityError("Source commit differs from reviewed pin")
    if Path(git_value("rev-parse", "--show-toplevel")) != source:
        raise IntegrityError("Source must be the pinned checkout root")
    package = read_regular(source, "package.json")
    if sha256(package) != lock["upstream"]["packageSha256"]:
        raise IntegrityError("Upstream package provenance changed")
    payload = {}
    for entry in lock["files"]:
        data = read_regular(source, entry["source"])
        if len(data) != entry["bytes"] or sha256(data) != entry["sha256"]:
            raise IntegrityError(f"Source integrity mismatch: {entry['source']}")
        payload[entry["destination"]] = data
    return payload


def receipt(lock: dict, lock_hash: str) -> bytes:
    result = {"schemaVersion": 1, "upstreamCommit": lock["upstream"]["commit"],
              "lockSha256": lock_hash, "fileCount": len(lock["files"]),
              "totalBytes": sum(entry["bytes"] for entry in lock["files"]),
              "executionEnabled": False, "mode": "project-reference-resources"}
    return (json.dumps(result, indent=2, sort_keys=True) + "\n").encode()


def verify_pack(destination: Path, lock: dict, lock_hash: str) -> dict:
    destination = no_symlinks(destination)
    if not destination.is_dir():
        raise IntegrityError("Resource pack not materialized")
    expected = {entry["destination"] for entry in lock["files"]} | {"receipt.json"}
    actual = set()
    for directory, directories, files in os.walk(destination, followlinks=False):
        for name in directories + files:
            p = Path(directory) / name
            mode = p.lstat().st_mode
            if stat.S_ISLNK(mode) or not (stat.S_ISDIR(mode) or stat.S_ISREG(mode)):
                raise IntegrityError(f"Non-regular pack entry rejected: {p}")
        actual.update((Path(directory) / name).relative_to(destination).as_posix() for name in files)
    if actual != expected:
        raise IntegrityError("Resource pack has missing or unexpected files; no files overwritten")
    for entry in lock["files"]:
        data = read_regular(destination, entry["destination"])
        if len(data) != entry["bytes"] or sha256(data) != entry["sha256"]:
            raise IntegrityError(f"Modified destination protected: {entry['destination']}")
    if read_regular(destination, "receipt.json") != receipt(lock, lock_hash):
        raise IntegrityError("Resource receipt does not match lock")
    return {"status": "verified", "fileCount": len(lock["files"]), "upstreamCommit": lock["upstream"]["commit"], "executionEnabled": False}


def publish_new(stage: Path, destination: Path):
    """Use Linux renameat2(RENAME_NOREPLACE); never replace even an empty target."""
    libc = ctypes.CDLL(None, use_errno=True)
    renameat2 = getattr(libc, "renameat2", None)
    if renameat2 is None:
        raise IntegrityError("Atomic no-replace publish requires Linux renameat2")
    renameat2.argtypes = [ctypes.c_int, ctypes.c_char_p, ctypes.c_int, ctypes.c_char_p, ctypes.c_uint]
    renameat2.restype = ctypes.c_int
    if renameat2(-100, os.fsencode(stage), -100, os.fsencode(destination), 1):
        error = ctypes.get_errno()
        if error == errno.EEXIST:
            raise IntegrityError("Destination appeared during staging; no files overwritten")
        raise OSError(error, os.strerror(error))


def synchronize(source: Path, destination: Path, lock: dict, lock_hash: str) -> dict:
    destination = no_symlinks(destination)
    parent = no_symlinks(destination.parent)
    if not parent.is_dir():
        raise IntegrityError("Destination parent must already exist")
    payload = verify_source(source, lock)
    if destination.exists():
        result = verify_pack(destination, lock, lock_hash)
        result["status"] = "unchanged"
        return result
    stage = Path(tempfile.mkdtemp(prefix=f".{destination.name}.stage-", dir=parent))
    try:
        payload["receipt.json"] = receipt(lock, lock_hash)
        for relative, data in payload.items():
            target = stage.joinpath(*relative_parts(relative))
            target.parent.mkdir(parents=True, exist_ok=True)
            with target.open("xb") as stream:
                stream.write(data)
                stream.flush()
                os.fsync(stream.fileno())
            target.chmod(0o644)
        verify_pack(stage, lock, lock_hash)
        no_symlinks(parent)
        publish_new(stage, destination)
    finally:
        if stage.exists():
            shutil.rmtree(stage)
    result = verify_pack(destination, lock, lock_hash)
    result["status"] = "materialized"
    return result


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, help="Local pinned upstream checkout; required for materialization")
    parser.add_argument("--destination", type=Path, default=HERE / "resources")
    parser.add_argument("--lock", type=Path, default=HERE / "upstream.lock.json")
    parser.add_argument("--check", action="store_true", help="Verify materialized pack without source/network/execution")
    args = parser.parse_args(argv)
    try:
        lock, lock_hash = read_lock(args.lock)
        if args.check:
            result = verify_pack(args.destination, lock, lock_hash)
        else:
            if args.source is None:
                raise IntegrityError("--source is required without --check")
            result = synchronize(args.source, args.destination, lock, lock_hash)
        print(json.dumps(result, sort_keys=True))
        return 0
    except (IntegrityError, OSError, ValueError, TypeError, KeyError, subprocess.SubprocessError) as error:
        print(json.dumps({"status": "failed", "error": str(error), "executionEnabled": False}), file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
