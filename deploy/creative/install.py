#!/usr/bin/env python3
"""Pinned creative engine installer. Python 3.10+, Linux; no third-party modules.

Planning and checking never download, run an engine, or write files. Installation
uses a private cache and staging directory, validates the complete archive, then
publishes a version directory by one rename. Epic credentials are never read.
"""
from __future__ import annotations

import argparse
import contextlib
import datetime
try:
    import fcntl
except ImportError:  # The CLI reports unsupported hosts before any mutation.
    fcntl = None
import hashlib
import json
import os
import platform
import re
import shutil
import stat
import subprocess
import sys
import tarfile
import tempfile
import urllib.error
import urllib.parse
import urllib.request
import zipfile
from pathlib import Path, PurePosixPath

HERE = Path(__file__).resolve().parent
GIB = 1024**3
CHUNK = 1024**2
RECEIPT = ".daftar-install.json"
RESERVE = 512 * 1024**2


class InstallError(Exception):
    def __init__(self, code, message):
        self.code = code
        super().__init__(message)


def fail(code, message):
    raise InstallError(code, message)


def read_json(path):
    with Path(path).open(encoding="utf-8") as handle:
        return json.load(handle)


def digest_file(path):
    digest = hashlib.sha256()
    with Path(path).open("rb") as handle:
        for chunk in iter(lambda: handle.read(CHUNK), b""):
            digest.update(chunk)
    return digest.hexdigest()


def clean_path(value):
    path = Path(value)
    if not path.is_absolute() or ".." in path.parts:
        fail("UNSAFE_PATH", "Paths must be absolute, with no '..' components.")
    for parent in [*reversed(path.parents), path]:
        if parent.is_symlink():
            fail("UNSAFE_PATH", f"Symlink path component is not permitted: {parent}")
    return path


def managed_prefix(value):
    path = clean_path(value)
    if str(path) in {"/", "/bin", "/sbin", "/usr", "/usr/bin", "/usr/local", "/etc", "/var", "/var/lib", "/opt", "/tmp", "/home", "/root"}:
        fail("UNSAFE_PREFIX", "Choose a dedicated tool directory, such as /opt/daftar-tools.")
    if path.exists():
        secure_directory(path)
    return path


def secure_directory(path):
    clean_path(path)
    value = path.stat()
    if not stat.S_ISDIR(value.st_mode) or value.st_mode & 0o022:
        fail("UNSAFE_DIRECTORY", f"Managed directory must not be group/world writable: {path}")
    if value.st_uid not in {0, os.geteuid()}:
        fail("UNSAFE_DIRECTORY", f"Managed directory has a different owner: {path}")


def make_directory(path, mode=0o755):
    clean_path(path)
    existed = path.exists()
    path.mkdir(parents=True, exist_ok=True, mode=mode)
    secure_directory(path)
    if not existed:
        path.chmod(mode)


def privileged_ancestry(path):
    if os.geteuid() != 0:
        return
    mutable_parent = False
    for parent in [*reversed(path.parents), path]:
        try:
            info = parent.lstat()
        except FileNotFoundError:
            if mutable_parent:
                fail("UNSAFE_PRIVILEGED_PARENT", f"Create a root-owned private directory under the sticky parent before installing: {parent}")
            continue
        # A root-owned sticky directory (e.g. /tmp) protects root-owned child
        # entries. Other mutable parents can swap a checked prefix out from
        # under privileged path-based extraction, even when its leaf is private.
        if not stat.S_ISDIR(info.st_mode) or info.st_uid != 0 or (info.st_mode & 0o022 and not info.st_mode & stat.S_ISVTX):
            fail("UNSAFE_PRIVILEGED_PARENT", f"Root installation requires root-owned, non-mutable ancestors: {parent}")
        mutable_parent = bool(info.st_mode & 0o022)


def regular_file(path):
    clean_path(path)
    if not path.is_file() or path.is_symlink():
        fail("UNSAFE_FILE", f"Expected a regular file: {path}")


@contextlib.contextmanager
def install_lock(prefix):
    privileged_ancestry(prefix)
    make_directory(prefix)
    lock_path = prefix / ".install.lock"
    fd = os.open(lock_path, os.O_CREAT | os.O_RDWR | os.O_NOFOLLOW, 0o600)
    try:
        info = os.fstat(fd)
        if not stat.S_ISREG(info.st_mode) or info.st_nlink != 1 or info.st_mode & 0o022:
            fail("UNSAFE_LOCK", "Installer lock must be a private regular file.")
        try:
            fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            fail("INSTALL_BUSY", "Another installation holds this prefix lock; retry later.")
        yield
    finally:
        os.close(fd)


def nearest_existing(path):
    while not path.exists():
        path = path.parent
    return path


def disk_check(path, needed):
    free = shutil.disk_usage(nearest_existing(path)).free
    if free < needed:
        fail("INSUFFICIENT_DISK", f"Need {needed} free bytes for download, staging and reserve; found {free} at {path}.")
    return {"freeBytes": free, "requiredBytes": needed}


def cgroup_files(controller, v2_name, v1_name):
    roots = [(Path("/sys/fs/cgroup"), v2_name), (Path("/sys/fs/cgroup") / controller, v1_name)]
    paths = [base / name for base, name in roots]
    try:
        memberships = Path("/proc/self/cgroup").read_text().splitlines()
    except OSError:
        memberships = []
    for row in memberships:
        pieces = row.split(":", 2)
        if len(pieces) != 3:
            continue
        _, controllers, location = pieces
        relative = PurePosixPath(location)
        if not relative.is_absolute() or ".." in relative.parts:
            continue
        if controllers == "":
            base, name = roots[0]
        elif controller in controllers.split(","):
            base, name = roots[1]
        else:
            continue
        directory = base.joinpath(*relative.parts[1:])
        while directory.is_relative_to(base):
            paths.append(directory / name)
            if directory == base:
                break
            directory = directory.parent
    return list(dict.fromkeys(paths))


def memory_limit():
    values = []
    try:
        match = re.search(r"^MemTotal:\s+(\d+)\s+kB", Path("/proc/meminfo").read_text(), re.M)
        if match:
            values.append(int(match.group(1)) * 1024)
    except OSError:
        pass
    # Both cgroup v2 and v1; unusually large v1 values mean unlimited.
    for path in cgroup_files("memory", "memory.max", "memory.limit_in_bytes"):
        try:
            value = path.read_text().strip()
            if value.isdigit() and 0 < int(value) < 2**60:
                values.append(int(value))
        except OSError:
            pass
    return min(values) if values else None


def cpu_quota():
    values = []
    for path in cgroup_files("cpu", "cpu.max", "cpu.cfs_quota_us"):
        try:
            raw = path.read_text().strip()
            if path.name == "cpu.max":
                quota, period = raw.split()
            else:
                quota, period = raw, path.with_name("cpu.cfs_period_us").read_text().strip()
            if quota.isdigit() and period.isdigit() and int(quota) > 0 and int(period) > 0:
                values.append(int(quota) / int(period))
        except (OSError, ValueError):
            pass
    return min(values) if values else None


def preflight(spec, prefix, needed, strict_hardware=False):
    system, machine = platform.system().lower(), platform.machine().lower()
    if system != "linux" or machine not in {"x86_64", "amd64"}:
        fail("UNSUPPORTED_PLATFORM", "The engine installer supports Linux x86_64 only; no ARM/emulation download is substituted.")
    libc_name, libc_version = platform.libc_ver()
    try:
        compatible = libc_name == "glibc" and tuple(map(int, libc_version.split(".")[:2])) >= tuple(map(int, spec["minimumGlibc"].split(".")))
    except ValueError:
        compatible = False
    if not compatible:
        fail("UNSUPPORTED_LIBC", f"glibc {spec['minimumGlibc']}+ is required; found {libc_name} {libc_version}.")
    flag = spec.get("requiredCpuFlag")
    if flag:
        try:
            flags = Path("/proc/cpuinfo").read_text().split()
        except OSError:
            flags = []
        if flag not in flags:
            fail("UNSUPPORTED_CPU", f"CPU feature {flag} was not detected.")
    affinity_cpus = len(os.sched_getaffinity(0)) if hasattr(os, "sched_getaffinity") else (os.cpu_count() or 1)
    quota = cpu_quota()
    cpus = min(affinity_cpus, quota) if quota is not None else affinity_cpus
    ram = memory_limit()
    warnings = []
    recommended = spec.get("recommendedRamBytes")
    minimum = spec.get("minimumRamBytes", recommended)
    if ram is None:
        warnings.append("Effective RAM could not be determined; verify host and service limits.")
    elif ram < minimum:
        warnings.append(f"Effective RAM {ram} is below the published {minimum}-byte engine guidance; only bounded smoke jobs may fit.")
    if cpus < spec.get("minimumCpuCores", 4):
        warnings.append(f"Only {cpus} schedulable CPUs; published guidance is at least {spec.get('minimumCpuCores', 4)}.")
    if strict_hardware and warnings:
        fail("HARDWARE_BELOW_GUIDANCE", " ".join(warnings))
    gpu_nodes = [str(path) for pattern in ("/dev/dri/renderD*", "/dev/nvidia[0-9]*") for path in Path("/").glob(pattern.lstrip("/"))]
    return {"platform": system, "architecture": machine, "glibc": libc_version,
            "cpuCores": cpus, "affinityCpuCores": affinity_cpus, "cgroupCpuQuotaCores": quota,
            "effectiveRamBytes": ram, "recommendedRamBytes": recommended,
            "gpuDeviceNodes": gpu_nodes, "gpuVerified": False,
            "disk": disk_check(prefix, needed), "warnings": warnings}


def archive_spec(args, lock):
    if args.tool == "blender":
        if args.sha256 or args.version:
            fail("PINNED_RELEASE", "Blender version and SHA256 come from tools.lock.json, not CLI overrides.")
        return {**lock["blender"], "tool": "blender", "sourceTrust": "official_pinned_sha256"}
    if not args.version or not re.fullmatch(r"[0-9]+\.[0-9]+(?:\.[0-9]+)?(?:-[A-Za-z0-9._-]+)?", args.version):
        fail("OWNER_VERSION_REQUIRED", "Unreal archive import requires --version (for example 5.7.1).")
    if not args.archive or not args.sha256 or not re.fullmatch(r"[0-9a-fA-F]{64}", args.sha256):
        fail("OWNER_ARCHIVE_REQUIRED", "Unreal import requires --archive and its owner's independently verified --sha256; no Epic account access is automated.")
    archive = clean_path(args.archive)
    regular_file(archive)
    spec = {**lock["unreal"], "tool": "unreal", "version": args.version,
            "sha256": args.sha256.lower(), "sizeBytes": archive.stat().st_size,
            "archive": f"unreal-{args.version}-{args.sha256.lower()[:12]}.zip",
            "sourceTrust": "owner_supplied_sha256", "sourceName": archive.name}
    with archive_reader(archive, spec) as (entries, _):
        spec["stagingBytes"] = validate_entries(entries, spec)
    return spec


class OfficialRedirectHandler(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        value = urllib.parse.urlparse(newurl)
        if value.scheme != "https" or value.hostname != "download.blender.org" or value.username or value.password:
            fail("UNTRUSTED_REDIRECT", "Blender download redirected outside the official HTTPS host.")
        return super().redirect_request(req, fp, code, msg, headers, newurl)


def verify_archive(path, spec):
    regular_file(path)
    if path.stat().st_size != spec["sizeBytes"]:
        fail("ARCHIVE_SIZE_MISMATCH", f"Archive byte length does not match the locked {spec['sizeBytes']} bytes.")
    if digest_file(path) != spec["sha256"]:
        fail("CHECKSUM_MISMATCH", "Archive SHA256 does not match the expected digest. Nothing was installed.")


def fetch_archive(prefix, spec, source=None, opener=None):
    cache = prefix / "cache"
    make_directory(cache, 0o700)
    cache.chmod(0o700)
    final = cache / spec["archive"]
    part = final.with_name(final.name + ".part")
    metadata = part.with_name(part.name + ".json")
    for path in (final, part, metadata):
        clean_path(path)
        if path.exists() and (not path.is_file() or path.stat().st_nlink != 1):
            fail("UNSAFE_CACHE", "Archive cache entries must be regular files with one link.")
    if final.exists():
        verify_archive(final, spec)
        return final
    identity = {key: spec[key] for key in ("sha256", "sizeBytes", "archive")}
    if source:
        regular_file(source)
        # Copy into the protected cache before hashing/extracting; never extract
        # a caller-writable source path after verifying a different file handle.
        reviewed = source.stat()
        incoming_fd = os.open(source, os.O_RDONLY | os.O_NOFOLLOW)
        with os.fdopen(incoming_fd, "rb") as incoming:
            opened = os.fstat(incoming.fileno())
            if not stat.S_ISREG(opened.st_mode) or (opened.st_dev, opened.st_ino, opened.st_size) != (reviewed.st_dev, reviewed.st_ino, reviewed.st_size):
                fail("SOURCE_CHANGED", "Source archive changed while being opened.")
            if opened.st_size != spec["sizeBytes"]:
                fail("ARCHIVE_SIZE_MISMATCH", "Local archive length differs from the expected pin.")
            with part.open("wb") as outgoing:
                received = 0
                while chunk := incoming.read(min(CHUNK, spec["sizeBytes"] - received + 1)):
                    received += len(chunk)
                    if received > spec["sizeBytes"]:
                        fail("ARCHIVE_SIZE_MISMATCH", "Local archive grew while being copied.")
                    outgoing.write(chunk)
                outgoing.flush()
                os.fsync(outgoing.fileno())
    else:
        if part.exists():
            if not metadata.exists() or read_json(metadata) != identity or part.stat().st_size > spec["sizeBytes"]:
                fail("PARTIAL_IDENTITY_MISMATCH", "Partial download has different/missing pin metadata; remove only that partial file and retry.")
        metadata.write_text(json.dumps(identity) + "\n", encoding="utf-8")
        offset = part.stat().st_size if part.exists() else 0
        if offset < spec["sizeBytes"]:
            url = urllib.parse.urlparse(spec["url"])
            if url.scheme != "https" or url.hostname != "download.blender.org" or url.username or url.password:
                fail("UNTRUSTED_URL", "Only the locked official Blender HTTPS URL can be downloaded.")
            request = urllib.request.Request(spec["url"], headers={"User-Agent": "Daftar-Creative-Installer/1", "Accept-Encoding": "identity"})
            if offset:
                request.add_header("Range", f"bytes={offset}-")
            opener = opener or urllib.request.build_opener(OfficialRedirectHandler())
            with opener.open(request, timeout=45) as response:
                status = response.status
                if status == 206:
                    expected_range = f"bytes {offset}-{spec['sizeBytes'] - 1}/{spec['sizeBytes']}"
                    if response.headers.get("Content-Range") != expected_range:
                        fail("INVALID_CONTENT_RANGE", "Server did not honor the exact verified resume range.")
                elif status == 200:
                    offset = 0  # Server ignored Range: start over, never append.
                else:
                    fail("DOWNLOAD_FAILED", f"Unexpected HTTP status {status}.")
                if response.headers.get("Content-Encoding", "identity") != "identity":
                    fail("UNEXPECTED_ENCODING", "Archive response must not change content encoding.")
                length = response.headers.get("Content-Length")
                if length and int(length) != spec["sizeBytes"] - offset:
                    fail("ARCHIVE_SIZE_MISMATCH", "Server response length differs from the locked archive.")
                with part.open("ab" if offset else "wb") as outgoing:
                    received = offset
                    while chunk := response.read(CHUNK):
                        received += len(chunk)
                        if received > spec["sizeBytes"]:
                            fail("ARCHIVE_SIZE_MISMATCH", "Download exceeds the locked archive size.")
                        outgoing.write(chunk)
                    outgoing.flush()
                    os.fsync(outgoing.fileno())
    try:
        verify_archive(part, spec)
    except InstallError as error:
        if error.code == "CHECKSUM_MISMATCH":
            part.unlink(missing_ok=True)
            metadata.unlink(missing_ok=True)
        raise
    os.replace(part, final)
    metadata.unlink(missing_ok=True)
    return final


def member_path(name):
    if not name or "\x00" in name or "\\" in name or name.startswith("/") or re.match(r"^[A-Za-z]:", name):
        fail("UNSAFE_ARCHIVE_PATH", f"Unsafe archive member name: {name!r}")
    path = PurePosixPath(name)
    if ".." in path.parts or not path.parts:
        fail("UNSAFE_ARCHIVE_PATH", f"Archive traversal is forbidden: {name!r}")
    return path


def safe_link(member, target):
    if not target or "\x00" in target or "\\" in target or target.startswith("/") or re.match(r"^[A-Za-z]:", target):
        fail("UNSAFE_ARCHIVE_LINK", f"Unsafe symlink target for {member}.")
    stack = list(member.parent.parts)
    for part in PurePosixPath(target).parts:
        if part == "..":
            if not stack:
                fail("UNSAFE_ARCHIVE_LINK", f"Symlink escapes the archive: {member}")
            stack.pop()
        elif part != ".":
            stack.append(part)
    return PurePosixPath(*stack)


def validate_entries(entries, spec):
    if len(entries) > spec["maxEntries"]:
        fail("ARCHIVE_LIMIT", "Archive contains too many entries.")
    indexed, total = {}, 0
    for entry in entries:
        path = member_path(entry["name"])
        name = path.as_posix()
        if name in indexed:
            fail("DUPLICATE_ARCHIVE_PATH", f"Duplicate archive path: {name}")
        if entry["kind"] not in {"file", "dir", "symlink"}:
            fail("UNSAFE_ARCHIVE_TYPE", f"Special files and hard links are forbidden: {name}")
        if entry["size"] < 0:
            fail("ARCHIVE_LIMIT", "Archive member has a negative size.")
        total += entry["size"]
        if total > spec["maxExtractedBytes"]:
            fail("ARCHIVE_LIMIT", "Archive exceeds the expanded-byte limit.")
        entry["path"] = path
        indexed[name] = entry
    for name, entry in indexed.items():
        for ancestor in entry["path"].parents:
            parent_entry = indexed.get(ancestor.as_posix())
            if parent_entry and parent_entry["kind"] != "dir":
                fail("UNSAFE_ARCHIVE_LINK", f"Non-directory archive ancestor: {name}")
        if entry["kind"] == "symlink":
            # Official Blender libraries use relative .so link chains. Resolve
            # the entire declared chain without touching the filesystem; reject
            # cycles, absent targets, directory links and traversal pivots.
            resolved = entry
            visited = set()
            while resolved["kind"] == "symlink":
                link_name = resolved["path"].as_posix()
                if link_name in visited or len(visited) >= 128:
                    fail("UNSAFE_ARCHIVE_LINK", f"Cyclic or excessive symlink chain: {name}")
                visited.add(link_name)
                target = safe_link(resolved["path"], resolved["target"])
                resolved = indexed.get(target.as_posix())
                if not resolved:
                    fail("UNSAFE_ARCHIVE_LINK", f"Symlink target is absent from archive: {name}")
            if resolved["kind"] != "file":
                fail("UNSAFE_ARCHIVE_LINK", f"Symlink must resolve to an archived regular file: {name}")
    return total


@contextlib.contextmanager
def archive_reader(archive, spec):
    if spec["tool"] == "blender":
        with tarfile.open(archive, "r:xz") as handle:
            entries = []
            for item in handle:
                if len(entries) >= spec["maxEntries"]:
                    fail("ARCHIVE_LIMIT", "Archive contains too many entries.")
                kind = "file" if item.isfile() else "dir" if item.isdir() else "symlink" if item.issym() else "special"
                entries.append({"name": item.name, "kind": kind, "size": item.size,
                                "mode": item.mode, "mtime": item.mtime, "target": item.linkname, "item": item})
            yield entries, handle.extractfile
    else:
        with zipfile.ZipFile(archive) as handle:
            entries = []
            if len(handle.infolist()) > spec["maxEntries"]:
                fail("ARCHIVE_LIMIT", "Archive contains too many entries.")
            for item in handle.infolist():
                mode = item.external_attr >> 16
                kind = "symlink" if stat.S_ISLNK(mode) else "dir" if item.is_dir() else "file" if stat.S_IFMT(mode) in {0, stat.S_IFREG} else "special"
                if item.flag_bits & 1:
                    fail("ENCRYPTED_ARCHIVE", "Encrypted engine archives are unsupported.")
                target = ""
                if kind == "symlink":
                    if item.file_size > 4096:
                        fail("UNSAFE_ARCHIVE_LINK", "ZIP symlink target exceeds the path limit.")
                    target = handle.read(item).decode("utf-8")
                entries.append({"name": item.filename, "kind": kind, "size": item.file_size,
                                "mode": mode, "mtime": datetime.datetime(*item.date_time, tzinfo=datetime.timezone.utc).timestamp(),
                                "target": target, "item": item})
            yield entries, handle.open


def extract_archive(archive, stage, spec):
    with archive_reader(archive, spec) as (entries, open_member):
        total = validate_entries(entries, spec)
        disk_check(stage, total + RESERVE)
        for entry in entries:
            if entry["kind"] == "symlink":
                continue
            path = stage.joinpath(*entry["path"].parts)
            if entry["kind"] == "dir":
                path.mkdir(parents=True, exist_ok=True, mode=0o755)
                continue
            path.parent.mkdir(parents=True, exist_ok=True, mode=0o755)
            with open_member(entry["item"]) as incoming, path.open("xb") as outgoing:
                remaining = entry["size"]
                while remaining:
                    chunk = incoming.read(min(CHUNK, remaining))
                    if not chunk:
                        fail("TRUNCATED_ARCHIVE", f"Archive member was truncated: {entry['name']}")
                    outgoing.write(chunk)
                    remaining -= len(chunk)
                if incoming.read(1):
                    fail("ARCHIVE_SIZE_MISMATCH", "Expanded archive member exceeded its declared size.")
            path.chmod(0o755 if entry["mode"] & 0o111 else 0o644)
            # Bundled Python .pyc caches validate source mtimes. Preserving the
            # archive timestamp avoids rewriting vendor files on first launch.
            mtime = entry["mtime"]
            if not isinstance(mtime, (int, float)) or not 0 <= mtime <= 4102444800:
                fail("ARCHIVE_TIMESTAMP", "Archive timestamp is outside the supported 1970–2100 range.")
            os.utime(path, (mtime, mtime), follow_symlinks=False)
        for entry in entries:
            if entry["kind"] == "symlink":
                path = stage.joinpath(*entry["path"].parts)
                path.parent.mkdir(parents=True, exist_ok=True, mode=0o755)
                path.symlink_to(entry["target"])
        for path in stage.rglob("*"):
            if path.is_dir() and not path.is_symlink():
                path.chmod(0o755)
    if spec["tool"] == "blender":
        root = stage / spec["archiveRoot"]
        if set(p.name for p in stage.iterdir()) != {spec["archiveRoot"]} or not root.is_dir():
            fail("ENGINE_LAYOUT", "Blender archive does not have its locked release root.")
    else:
        candidates = [stage] + [p for p in stage.iterdir() if p.is_dir() and not p.is_symlink()]
        roots = [p for p in candidates if (p / spec["executable"]).is_file()]
        if len(roots) != 1:
            fail("ENGINE_LAYOUT", "Expected one Unreal root containing Engine/Binaries/Linux/UnrealEditor.")
        root = roots[0]
        if root != stage and set(stage.iterdir()) != {root}:
            fail("ENGINE_LAYOUT", "Unreal archive has unexpected files outside its engine root.")
        binary = root / spec["executable"]
        binary.chmod(0o755)  # ZIP providers sometimes omit Unix executable bits.
        discovered = discover_unreal(root)
        requested = spec["version"].split("-")[0]
        if not (discovered["version"] == requested or (requested.count(".") == 1 and discovered["version"].startswith(requested + "."))):
            fail("ENGINE_VERSION", "Owner-selected version differs from Unreal Engine/Build/Build.version.")
    validate_executable(root / spec["executable"])
    return root, total


def validate_executable(path):
    regular_file(path)
    if not os.access(path, os.X_OK):
        fail("ENGINE_NOT_EXECUTABLE", f"Engine binary has no executable permission: {path}")
    with path.open("rb") as handle:
        header = handle.read(20)
    if len(header) < 20 or header[:5] != b"\x7fELF\x02" or header[5] != 1 or int.from_bytes(header[18:20], "little") != 62:
        fail("ENGINE_BINARY_FORMAT", "Expected a 64-bit little-endian x86_64 Linux ELF engine binary.")


def inventory(root):
    files = {}
    for path in sorted(root.rglob("*")):
        name = path.relative_to(root).as_posix()
        if name == RECEIPT:
            continue
        if path.is_symlink():
            target = os.readlink(path)
            try:
                resolved = (path.parent / target).resolve()
            except RuntimeError:
                fail("UNSAFE_ARCHIVE_LINK", "Installed symlink chain contains a cycle.")
            if not resolved.is_relative_to(root.resolve()) or not resolved.is_file():
                fail("UNSAFE_ARCHIVE_LINK", "Installed symlink escapes its engine root.")
            files[name] = {"symlink": target}
        elif path.is_file():
            files[name] = {"sha256": digest_file(path), "sizeBytes": path.stat().st_size,
                           "mode": stat.S_IMODE(path.stat().st_mode)}
        elif not path.is_dir():
            fail("UNSAFE_FILE", "Engine tree contains a special file.")
    return files


def check_install(destination, spec):
    clean_path(destination)
    if not destination.exists():
        return {"ok": False, "status": "not_installed", "destination": str(destination)}
    secure_directory(destination)
    receipt_path = destination / RECEIPT
    regular_file(receipt_path)
    receipt = read_json(receipt_path)
    for key in ("tool", "version", "sha256", "sourceTrust"):
        if receipt.get(key) != spec[key]:
            fail("INSTALL_RECEIPT_MISMATCH", f"Existing install receipt differs from expected {key}; it will not be overwritten.")
    if receipt.get("files") != inventory(destination):
        fail("INSTALL_INTEGRITY_MISMATCH", "Installed files differ from their verified installation receipt; no files were overwritten.")
    validate_executable(destination / spec["executable"])
    return {"ok": True, "status": "installed_verified", "tool": spec["tool"],
            "version": spec["version"], "sha256": spec["sha256"], "sourceTrust": spec["sourceTrust"],
            "executable": str(destination / spec["executable"]), "filesVerified": len(receipt["files"]),
            "engineExecuted": False}


def install_engine(prefix, spec, archive=None, strict_hardware=False):
    destination = prefix / spec["tool"] / spec["version"]
    with install_lock(prefix):
        existing = check_install(destination, spec)
        if existing["ok"]:
            return {**existing, "status": "reused_verified"}
        needed = spec["sizeBytes"] + spec.get("stagingBytes", spec["maxExtractedBytes"]) + spec.get("freeSpaceReserveBytes", RESERVE)
        hardware = preflight(spec, prefix, needed, strict_hardware)
        archive_path = fetch_archive(prefix, spec, archive)
        parent = destination.parent
        make_directory(parent)
        with tempfile.TemporaryDirectory(prefix=".stage-", dir=parent) as temporary:
            stage = Path(temporary)
            root, total = extract_archive(archive_path, stage, spec)
            receipt = {"schemaVersion": 1, **{key: spec[key] for key in ("tool", "version", "sha256", "sourceTrust")},
                       "source": spec.get("url", spec.get("sourceName")),
                       "installedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(),
                       "archiveBytes": spec["sizeBytes"], "expandedBytes": total, "files": inventory(root)}
            receipt_path = root / RECEIPT
            with receipt_path.open("x", encoding="utf-8") as handle:
                json.dump(receipt, handle, sort_keys=True, indent=2)
                handle.write("\n")
                handle.flush()
                os.fsync(handle.fileno())
            # The stage is private while under construction. Published engines
            # must be readable by the separate unprivileged runtime identity.
            root.chmod(0o755)
            if destination.exists() or destination.is_symlink():
                fail("DESTINATION_EXISTS", "Destination appeared during installation; nothing was overwritten.")
            os.rename(root, destination)
            directory_fd = os.open(parent, os.O_RDONLY | os.O_DIRECTORY)
            try:
                os.fsync(directory_fd)
            finally:
                os.close(directory_fd)
        return {**check_install(destination, spec), "status": "installed_verified", "hardware": hardware}


def discover_unreal(engine_root):
    root = clean_path(engine_root)
    validate_executable(root / "Engine/Binaries/Linux/UnrealEditor")
    version_file = root / "Engine/Build/Build.version"
    regular_file(version_file)
    version = read_json(version_file)
    fields = [version.get(name) for name in ("MajorVersion", "MinorVersion", "PatchVersion")]
    if any(type(value) is not int or value < 0 for value in fields):
        fail("ENGINE_VERSION", "Unreal Build.version must contain numeric version components.")
    return {"ok": True, "status": "discovered_unverified_provenance", "tool": "unreal",
            "version": ".".join(map(str, fields)), "executable": str(root / "Engine/Binaries/Linux/UnrealEditor"),
            "engineExecuted": False, "accountOrLicenseVerified": False,
            "note": "Discovery verifies layout and ELF identity only. Owner must authorize this precompiled/source-built engine and its plugins."}


def graphics_profile(mode, prefix, profile):
    data = read_json(HERE / "profiles.json")
    os_release = platform.freedesktop_os_release()
    distro, version = os_release.get("ID"), os_release.get("VERSION_ID")
    if version not in data["supportedAptDistributions"].get(distro, []):
        fail("UNSUPPORTED_DISTRIBUTION", "Package profile supports the listed Debian/Ubuntu releases only.")
    packages = data["blender-runtime"] + (data["open-graphics"] if profile == "open-graphics" else [])
    replacements = data.get("packageReplacements", {}).get(f"{distro}:{version}", {})
    packages = [replacements.get(package, package) for package in packages]
    commands = [["apt-get", "update"], ["apt-get", "install", "--yes", "--no-install-recommends", *packages]]
    result = {"ok": True, "tool": "graphics", "profile": profile, "distribution": f"{distro} {version}",
              "packages": packages, "commands": commands, "packagePolicy": data["packagePolicy"]}
    if mode == "plan":
        return {**result, "status": "planned", "writes": False}
    query = ["dpkg-query", "-W", "-f=${binary:Package}\t${Version}\t${db:Status-Status}\n", *packages]
    if mode == "install":
        if os.geteuid() != 0:
            fail("ROOT_REQUIRED", "Distro package installation requires root; --plan and --check do not.")
        disk_check(prefix, 5 * GIB)
        with install_lock(prefix):
            for command in commands:
                # Keep stdout as one JSON result, sending apt progress to stderr.
                subprocess.run(command, check=True, stdout=sys.stderr, env={**os.environ, "DEBIAN_FRONTEND": "noninteractive"}, timeout=1800)
            installed = subprocess.run(query, check=True, capture_output=True, text=True, timeout=30).stdout
            receipt = {**result, "status": "installed", "resolvedPackageVersions": installed.splitlines(),
                       "installedAt": datetime.datetime.now(datetime.timezone.utc).isoformat()}
            (prefix / f"{profile}-packages.json").write_text(json.dumps(receipt, indent=2) + "\n", encoding="utf-8")
            return receipt
    queried = subprocess.run(query, check=False, capture_output=True, text=True, timeout=30)
    rows = queried.stdout.splitlines()
    installed = queried.returncode == 0 and len(rows) == len(packages) and all(row.endswith("\tinstalled") for row in rows)
    return {**result, "ok": installed, "status": "installed" if installed else "packages_missing", "resolvedPackageVersions": rows}


def parser():
    value = argparse.ArgumentParser(description=__doc__)
    mode = value.add_mutually_exclusive_group(required=True)
    mode.add_argument("--plan", action="store_true", help="Read-only plan: no downloads or directory creation")
    mode.add_argument("--check", action="store_true", help="Read-only installed-file verification or owner-engine discovery")
    mode.add_argument("--install", action="store_true", help="Install the pinned archive or requested signed distro profile")
    value.add_argument("--tool", choices=["blender", "unreal", "graphics"], default="blender")
    value.add_argument("--prefix", default="/opt/daftar-tools")
    value.add_argument("--archive", help="Absolute local archive path (optional for pinned Blender, required for Unreal import)")
    value.add_argument("--sha256", help="Owner-verified Unreal archive SHA256")
    value.add_argument("--version", help="Owner-selected Unreal version")
    value.add_argument("--engine-root", help="Discover an existing authorized Unreal build with --check")
    value.add_argument("--profile", choices=["blender-runtime", "open-graphics"], default="open-graphics")
    value.add_argument("--strict-hardware", action="store_true", help="Fail when RAM/CPU falls below published guidance")
    return value


def main(argv=None):
    args = parser().parse_args(argv)
    try:
        if platform.system().lower() != "linux":
            fail("UNSUPPORTED_PLATFORM", "This installer requires Linux; no desktop-platform substitute is installed.")
        prefix = managed_prefix(args.prefix)
        mode = "install" if args.install else "check" if args.check else "plan"
        if mode in {"plan", "install"}:
            privileged_ancestry(prefix)
        if args.engine_root:
            if args.tool != "unreal" or mode != "check" or args.archive or args.sha256 or args.version:
                fail("INVALID_OPTIONS", "--engine-root is only for --tool unreal --check without archive-import flags.")
            result = discover_unreal(args.engine_root)
        elif args.tool == "graphics":
            if args.archive or args.sha256 or args.version:
                fail("INVALID_OPTIONS", "Graphics profiles do not accept archive-import flags.")
            result = graphics_profile(mode, prefix, args.profile)
        else:
            lock = read_json(HERE / "tools.lock.json")
            spec = archive_spec(args, lock)
            source = clean_path(args.archive) if args.archive else None
            if source:
                regular_file(source)
            destination = prefix / spec["tool"] / spec["version"]
            if mode == "check":
                result = check_install(destination, spec)
            elif mode == "install":
                result = install_engine(prefix, spec, source, args.strict_hardware)
            else:
                needed = spec["sizeBytes"] + spec.get("stagingBytes", spec["maxExtractedBytes"]) + spec.get("freeSpaceReserveBytes", RESERVE)
                result = {"ok": True, "status": "planned", "tool": spec["tool"], "version": spec["version"],
                          "source": str(source) if source else spec.get("url"), "sourceTrust": spec["sourceTrust"],
                          "sha256": spec["sha256"], "archiveBytes": spec["sizeBytes"],
                          "destination": str(destination), "executable": str(destination / spec["executable"]),
                          "hardware": preflight(spec, prefix, needed, args.strict_hardware),
                          "writes": False, "engineExecuted": False}
        print(json.dumps(result, indent=2))
        return 0 if result["ok"] else 2
    except InstallError as error:
        print(json.dumps({"ok": False, "error": {"code": error.code, "message": str(error)}}))
        return 2
    except (OSError, ValueError, tarfile.TarError, zipfile.BadZipFile, subprocess.SubprocessError) as error:
        print(json.dumps({"ok": False, "error": {"code": "INSTALL_FAILED", "message": str(error)}}))
        return 2


if __name__ == "__main__":
    sys.exit(main())
