"""Refresh the GLBs that ship with ``atech view`` from an atech-module-renders release.

    python -m atech.view.bundle v1.15        # a tag of atechdotdev/atech-module-renders

For SDK maintainers: it needs the GitHub CLI logged in with access to ``atechdotdev``
(the release is private). It replaces ``src/atech/view/glb/`` with the release's
``glb_meshopt/`` models and ``manifest.json`` and records the tag and the zip's sha256
in ``release.json``. Then run ``pytest tests/test_view.py``: it checks every model the
viewer uses against its ``sim.yaml`` size, which is what makes the placement right.
"""

from __future__ import annotations

import hashlib
import json
import re
import shutil
import subprocess
import sys
import tempfile
import zipfile
from pathlib import Path

from atech.sim.meshes import RELEASE_ASSET
from atech.view.scene import glb_dir

REPO = "atechdotdev/atech-module-renders"
FOLDER = "glb_meshopt"
_NAME = re.compile(r"^[a-z0-9-]+\.glb$")


def refresh(tag: str, target: Path | None = None) -> Path:
    target = target or glb_dir()
    with tempfile.TemporaryDirectory() as tmp:
        subprocess.run(["gh", "release", "download", tag, "--repo", REPO, "-p", RELEASE_ASSET, "-D", tmp],
                       check=True)
        archive = Path(tmp) / RELEASE_ASSET
        sha = hashlib.sha256(archive.read_bytes()).hexdigest()
        with zipfile.ZipFile(archive) as z:
            models = {}
            manifest = None
            for info in z.infolist():
                parts = Path(info.filename).parts
                if len(parts) >= 2 and parts[-2] == FOLDER and _NAME.match(parts[-1]):
                    models[parts[-1]] = z.read(info)
                elif parts and parts[-1] == "manifest.json":
                    manifest = z.read(info)
        if not models or manifest is None:
            raise SystemExit(f"{RELEASE_ASSET} of {tag} has no {FOLDER}/*.glb or no manifest.json")
    for old in target.glob("*.glb"):
        old.unlink()
    for name, data in sorted(models.items()):
        (target / name).write_bytes(data)
    (target / "manifest.json").write_bytes(manifest)
    (target / "release.json").write_text(json.dumps(
        {"repo": REPO, "tag": tag, "asset": RELEASE_ASSET, "folder": FOLDER, "zip_sha256": sha}, indent=2) + "\n")
    return target


def main(argv: list[str]) -> int:
    if len(argv) != 1:
        print(__doc__, file=sys.stderr)
        return 2
    if shutil.which("gh") is None:
        print("error: the GitHub CLI (gh) is needed", file=sys.stderr)
        return 1
    out = refresh(argv[0])
    print(f"{len(list(out.glob('*.glb')))} models from {REPO} {argv[0]} in {out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
