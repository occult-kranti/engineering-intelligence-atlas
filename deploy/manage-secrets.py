#!/usr/bin/env python3
"""Create private bind-mounted runtime credentials without displaying their values.

Linux Docker deployment defaults: uid/gid 10001, directory 0700, files 0400.
The utility never contacts a provider. Run on the intended host, usually with sudo.
"""
from __future__ import annotations

import argparse
import getpass
import json
import os
from pathlib import Path
import secrets
import stat
import sys

FILES = {
    "control": "control-token",
    "openai": "openai-api-key",
    "anthropic": "anthropic-api-key",
    "github": "github-token",
    "cloud-pairing": "cloud-pairing",
    "cloud-encryption-key": "cloud-encryption-key",
}


def private_directory(directory: Path, uid: int, gid: int) -> None:
    # Do not follow a symlink while running with elevated privileges.
    current = directory
    while current != current.parent:
        if current.is_symlink():
            raise ValueError(f"Refusing a symlink in secret path: {current}")
        current = current.parent
    directory.mkdir(mode=0o700, parents=True, exist_ok=True)
    if not stat.S_ISDIR(directory.lstat().st_mode):
        raise ValueError("Secret directory is not a regular directory")
    os.chown(directory, uid, gid)
    os.chmod(directory, 0o700)


def write_secret(directory: Path, name: str, value: str, uid: int, gid: int, replace: bool) -> None:
    destination = directory / FILES[name]
    if destination.is_symlink():
        raise ValueError("Refusing a symbolic-link secret")
    if destination.exists() and not replace:
        raise ValueError("Secret already exists; use --replace only when intentionally rotating it")
    if destination.exists() and not stat.S_ISREG(destination.lstat().st_mode):
        raise ValueError("Existing secret is not a regular file")
    temporary = directory / f".{FILES[name]}.{secrets.token_hex(8)}.tmp"
    descriptor = os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o400)
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8") as stream:
            os.fchown(stream.fileno(), uid, gid)
            os.fchmod(stream.fileno(), 0o400)
            stream.write(value + "\n")
            stream.flush()
            os.fsync(stream.fileno())
        if replace:
            os.replace(temporary, destination)
        else:
            # link() does not overwrite an existing destination, even if it was
            # created after the earlier existence check.
            os.link(temporary, destination, follow_symlinks=False)
            temporary.unlink()
    finally:
        temporary.unlink(missing_ok=True)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("action", choices=("init", "set", "init-cloud-key"))
    parser.add_argument("name", nargs="?", choices=tuple(FILES))
    parser.add_argument("--directory", type=Path, default=Path(__file__).absolute().parent / "secrets")
    parser.add_argument("--uid", type=int, default=10001)
    parser.add_argument("--gid", type=int, default=10001)
    parser.add_argument("--replace", action="store_true", help="Intentionally replace this one secret")
    args = parser.parse_args()
    if args.uid < 0 or args.gid < 0:
        parser.error("uid and gid must be nonnegative")
    if args.action in ("init", "init-cloud-key") and args.name is not None:
        parser.error("init and init-cloud-key generate their named secret; omit the name")
    if args.action == "set" and args.name is None:
        parser.error("set requires one of the listed secret names")
    directory = args.directory.absolute()
    private_directory(directory, args.uid, args.gid)
    name = "control" if args.action == "init" else "cloud-encryption-key" if args.action == "init-cloud-key" else args.name
    if args.action == "init":
        value = secrets.token_urlsafe(48)
    elif args.action == "init-cloud-key":
        value = secrets.token_hex(32)
    else:
        if not sys.stdin.isatty():
            raise ValueError("Use an interactive terminal; secret input is hidden")
        value = getpass.getpass(f"New {name} secret (hidden): ").strip()
        if name == "cloud-pairing" and value.startswith("{"):
            try:
                pairing = json.loads(value)
                if not isinstance(pairing, dict) or not isinstance(pairing.get("deviceToken"), str):
                    raise ValueError()
                if pairing.get("siteAccessToken") == "":
                    del pairing["siteAccessToken"]
                value = json.dumps(pairing, separators=(",", ":"))
            except (ValueError, TypeError):
                raise ValueError("Provide the existing owner-issued device pairing JSON") from None
        maximum = 16000 if name == "cloud-pairing" else 4096
        if not value or len(value.encode("utf-8")) > maximum or any(c.isspace() for c in value):
            raise ValueError(f"Secret must be nonempty, at most {maximum} UTF-8 bytes, and contain no whitespace")
        if name == "cloud-encryption-key" and (len(value) != 64 or any(c not in "0123456789abcdefABCDEF" for c in value)):
            raise ValueError("Cloud encryption key must encode exactly 32 random bytes as 64 hexadecimal characters")
        if name == "control" and (not 32 <= len(value) <= 256 or any(not (c.isascii() and (c.isalnum() or c in "_-")) for c in value)):
            raise ValueError("Control token must contain 32–256 ASCII letters, digits, underscores or hyphens")
    write_secret(directory, name, value, args.uid, args.gid, args.replace)
    print(f"Saved {directory / FILES[name]} (owner {args.uid}:{args.gid}, mode 0400). Value not displayed.")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (OSError, ValueError) as error:
        print(f"Secret setup failed: {error}", file=sys.stderr)
        raise SystemExit(1)
