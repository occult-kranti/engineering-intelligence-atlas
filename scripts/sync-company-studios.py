#!/usr/bin/env python3
"""Check or project the exact public static surface of Daftar company studios.

Default mode is read-only. --write copies only named assets and never removes
unexpected files. CLI tooling, test artifacts, runtime output and weights are
not public studio assets. No package installation or network access occurs.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import tempfile


ROOT = Path(__file__).resolve().parents[1]
SOURCE = Path("projects/threejs-game-studio")
MANIFEST = SOURCE / "static-assets.json"
TARGETS = {
    "hosted": Path("cloud-workspace/public/studios/threejs"),
    "preview": Path("site-source/public/desktop-preview/studios/threejs"),
    "desktop": Path("desktop-shell/dist/renderer/studios/threejs"),
}
MAX_FILE_BYTES = 2_000_000


class ProjectionError(Exception):
    pass


def plain_path(path: Path, root: Path) -> None:
    """Check every repository-relative component without following symlinks."""
    try:
        parts = path.relative_to(root).parts
    except ValueError as error:
        raise ProjectionError("A projection path is outside the repository.") from error
    current = root
    for part in parts:
        if part in {"..", "."}:
            raise ProjectionError("Traversal is not a projection path.")
        current = current / part
        if current.is_symlink():
            raise ProjectionError(f"Refusing symlink: {current.relative_to(root)}")


def asset_names(root: Path) -> tuple[str, ...]:
    """The Node build and this script consume the same reviewed allowlist."""
    path = root / MANIFEST
    plain_path(path, root)
    if not path.is_file() or path.stat().st_size > 16384:
        raise ProjectionError("The static asset manifest is missing or oversized.")
    try:
        manifest = json.loads(path.read_text("utf-8"))
    except (ValueError, UnicodeError) as error:
        raise ProjectionError("The static asset manifest is not valid UTF-8 JSON.") from error
    if not isinstance(manifest, dict) or manifest.get("schema_version") != 1 or not isinstance(manifest.get("files"), list):
        raise ProjectionError("Unsupported static asset manifest schema.")
    assets = tuple(manifest["files"])
    if not 1 <= len(assets) <= 64 or not all(isinstance(name, str) for name in assets) or len(set(assets)) != len(assets):
        raise ProjectionError("The static asset allowlist must contain unique bounded file names.")
    for name in assets:
        relative = PurePosixPath(name)
        if not name or relative.is_absolute() or str(relative) != name or "\\" in name or ":" in name or any(part in {".", ".."} or part.startswith(".") for part in relative.parts):
            raise ProjectionError("The static asset manifest contains a non-relative or traversal path.")
        if len(relative.parts) > 1 and relative.parts[0] not in {"assets", "vendor"}:
            raise ProjectionError("Only assets/ and vendor/ are permitted static subdirectories.")
        if relative.suffix not in {".html", ".css", ".mjs", ".js", ".md", ".svg", ".png", ".webp"} and relative.name not in {"LICENSE", "THREE-LICENSE"}:
            raise ProjectionError("A non-static file was added to the public allowlist.")
    return assets


def read_assets(root: Path, assets: tuple[str, ...]) -> dict[str, bytes]:
    output = {}
    for name in assets:
        source = root / SOURCE / name
        plain_path(source, root)
        if not source.is_file():
            raise ProjectionError(f"Missing source asset: {SOURCE / name}")
        with source.open("rb") as handle:
            data = handle.read(MAX_FILE_BYTES + 1)
        if len(data) > MAX_FILE_BYTES:
            raise ProjectionError(f"Source asset exceeds the bounded static-file size: {name}")
        output[name] = data
    return output


def verify_target_tree(destination: Path, root: Path, assets: tuple[str, ...]) -> None:
    plain_path(destination, root)
    if not destination.exists():
        return
    if not destination.is_dir():
        raise ProjectionError(f"Projection destination is not a directory: {destination.relative_to(root)}")
    directories = {str(parent) for name in assets for parent in PurePosixPath(name).parents if str(parent) != "."}
    unexpected = []
    for item in sorted(destination.rglob("*")):
        plain_path(item, root)
        relative = item.relative_to(destination).as_posix()
        if (item.is_dir() and relative not in directories) or (not item.is_dir() and relative not in assets):
            unexpected.append(relative)
    if unexpected:
        sample = ", ".join(unexpected[:12])
        raise ProjectionError(f"Unexpected files/directories in {destination.relative_to(root)}: {sample}. No files were deleted.")


def sync(root: Path, targets: list[str], write: bool = False) -> dict:
    root = root.resolve()
    target_names = sorted(set(targets))
    if not target_names or any(name not in TARGETS for name in target_names):
        raise ProjectionError("Choose hosted, preview and/or desktop as the projection target.")
    assets = asset_names(root)
    source = read_assets(root, assets)
    # Preflight every destination before writing any destination.
    for name in target_names:
        verify_target_tree(root / TARGETS[name], root, assets)
    receipt = {"mode": "write" if write else "check", "files_per_target": len(assets), "bytes_per_target": sum(map(len, source.values())), "source_sha256": hashlib.sha256(b"".join(name.encode()+b"\0"+hashlib.sha256(source[name]).digest() for name in assets)).hexdigest(), "targets": []}
    success = True
    for name in target_names:
        destination = root / TARGETS[name]
        differences = []
        written = 0
        for asset, data in source.items():
            path = destination / asset
            plain_path(path, root)
            if path.exists() and not path.is_file():
                raise ProjectionError(f"Asset destination is not a regular file: {path.relative_to(root)}")
            same = path.is_file() and path.stat().st_size == len(data) and path.read_bytes() == data
            if same:
                continue
            differences.append(asset)
            if write:
                path.parent.mkdir(parents=True, exist_ok=True)
                plain_path(path, root)
                temporary = None
                try:
                    with tempfile.NamedTemporaryFile(dir=path.parent, prefix=".studio-projection-", delete=False) as handle:
                        temporary = Path(handle.name)
                        handle.write(data)
                    temporary.chmod(0o644)
                    os.replace(temporary, path)
                    written += 1
                finally:
                    if temporary is not None and temporary.exists():
                        temporary.unlink()
        matches = all((destination / asset).is_file() and (destination / asset).stat().st_size == len(data) and (destination / asset).read_bytes() == data for asset, data in source.items())
        success = success and matches
        receipt["targets"].append({"target": name, "path": TARGETS[name].as_posix(), "matches_source": matches, "written": written, "differences_before_write": differences})
    receipt["status"] = "matched" if success else "out_of_date"
    return receipt


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--check", action="store_true", help="Read-only exact projection check (default).")
    mode.add_argument("--write", action="store_true", help="Write missing/changed allowlisted static files; refuse unexpected files.")
    parser.add_argument("--target", choices=tuple(TARGETS), action="append", help="Repeat for hosted, preview and desktop. Defaults to both hosted and preview.")
    args = parser.parse_args()
    try:
        receipt = sync(ROOT, args.target or ["hosted", "preview"], args.write)
    except (ProjectionError, OSError) as error:
        print(json.dumps({"status": "rejected", "detail": str(error)}, indent=2))
        return 1
    print(json.dumps(receipt, indent=2))
    return 0 if receipt["status"] == "matched" else 1


if __name__ == "__main__":
    raise SystemExit(main())
