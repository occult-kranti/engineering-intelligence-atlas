"""Write asset files for modules and boards in one or more formats."""

from __future__ import annotations

import shutil
from collections.abc import Callable, Iterable, Sequence
from pathlib import Path
from typing import TYPE_CHECKING

from atech.sim.mjcf import spec_mjcf_xml
from atech.sim.spec import SimSpec, load_board_sim, load_module_sim
from atech.sim.urdf import spec_urdf

if TYPE_CHECKING:
    from atech.sim.meshes import CadVisual, MeshLibrary

FORMATS = ("usd", "mjcf", "urdf")


def parse_formats(text: str) -> list[str]:
    """``"usd,mjcf"`` → ``["usd", "mjcf"]``; raises ValueError on an unknown one."""
    out: list[str] = []
    for item in (t.strip().lower() for t in text.split(",")):
        if not item:
            continue
        if item not in FORMATS:
            raise ValueError(f"unknown format {item!r}; choose from {', '.join(FORMATS)}")
        if item not in out:
            out.append(item)
    if not out:
        raise ValueError(f"no format given; choose from {', '.join(FORMATS)}")
    return out


def _write_meshes(cad: CadVisual, folder: Path) -> list[Path]:
    from atech.sim.meshes import write_stl

    return [write_stl(mp, folder / f"{mp.name}.stl") for mp in cad.parts]


def _clear_stale(out_dir: Path, asset: str, fmt: str, *, keep_suffix: str = "") -> None:
    """Remove what an earlier export of ``asset`` left that this one does not rewrite.

    Re-exporting into the same ``--out`` with or without CAD must not leave a
    second root USD (``.usda`` next to ``.usdc``) or STLs of materials the asset
    no longer has. Only files this exporter names for ``asset`` are touched.
    """
    if fmt == "usd":
        folder = out_dir / "usd" / asset
        for suffix in (".usda", ".usdc"):
            if suffix == keep_suffix:
                continue
            (folder / f"{asset}{suffix}").unlink(missing_ok=True)
            (folder / ".thumbs" / "256x256" / f"{asset}{suffix}.png").unlink(missing_ok=True)
    else:
        meshes = out_dir / fmt / "meshes" / asset
        if meshes.is_dir():
            shutil.rmtree(meshes)


def export_spec(
    spec: SimSpec,
    formats: Sequence[str],
    out_dir: Path,
    *,
    date: str | None = None,
    cad: CadVisual | None = None,
) -> list[Path]:
    """Files for one asset. Layout under ``out_dir``::

        usd/<asset>/<asset>.usda   (+ .thumbs/256x256/<asset>.usda.png); .usdc with cad
        mjcf/<asset>.xml           (+ mjcf/meshes/<asset>/<material>.stl with cad)
        urdf/<asset>.urdf          (+ urdf/meshes/<asset>/<material>.stl with cad)

    With ``cad`` the visuals are the CAD meshes (inline in the USD, which is then
    a binary ``.usdc``: large arrays belong in crate files); collisions and inertia
    stay the ``sim.yaml`` boxes.
    """
    out_dir = Path(out_dir)
    mesh_dir = f"meshes/{spec.asset_name}"
    written: list[Path] = []
    for fmt in formats:
        if fmt == "usd":
            from atech.sim.usd import write_usd

            suffix = ".usdc" if cad is not None else ".usda"
            target = out_dir / "usd" / spec.asset_name / f"{spec.asset_name}{suffix}"
            _clear_stale(out_dir, spec.asset_name, fmt, keep_suffix=suffix)
            written += write_usd(spec, target, date=date, cad=cad)
        elif fmt == "mjcf":
            target = out_dir / "mjcf" / f"{spec.asset_name}.xml"
            target.parent.mkdir(parents=True, exist_ok=True)
            _clear_stale(out_dir, spec.asset_name, fmt)
            if cad is not None:
                written += _write_meshes(cad, target.parent / mesh_dir)
            target.write_text(spec_mjcf_xml(spec, cad=cad, mesh_dir=mesh_dir), encoding="utf-8")
            written.append(target)
        elif fmt == "urdf":
            target = out_dir / "urdf" / f"{spec.asset_name}.urdf"
            target.parent.mkdir(parents=True, exist_ok=True)
            _clear_stale(out_dir, spec.asset_name, fmt)
            if cad is not None:
                written += _write_meshes(cad, target.parent / mesh_dir)
            target.write_text(spec_urdf(spec, cad=cad, mesh_dir=mesh_dir), encoding="utf-8")
            written.append(target)
        else:
            raise ValueError(f"unknown format {fmt!r}; choose from {', '.join(FORMATS)}")
    return written


def export(
    module_ids: Iterable[str],
    formats: Sequence[str],
    out_dir: Path,
    *,
    board_ids: Iterable[str] = (),
    date: str | None = None,
    modules_path: Path | None = None,
    meshes: MeshLibrary | None = None,
    on_note: Callable[[str, str], None] | None = None,
) -> list[Path]:
    """Export catalog modules (and boards) and return every file written.

    Every spec is loaded and checked before anything is written, so a bad id or
    ``sim.yaml`` fails without leaving half an export behind. ``modules_path`` is a
    project's custom modules folder (``<id>/module.yaml`` + ``<id>/sim.yaml``).
    ``meshes`` (:func:`atech.sim.meshes.mesh_library`) puts the real CAD on every
    asset it has a model for; ``on_note(asset_name, text)`` hears which ones.
    """
    formats = list(formats)
    for fmt in formats:
        if fmt not in FORMATS:
            raise ValueError(f"unknown format {fmt!r}; choose from {', '.join(FORMATS)}")
    specs = [load_module_sim(m, modules_path) for m in module_ids] + [load_board_sim(b) for b in board_ids]
    out_dir = Path(out_dir)
    if out_dir.exists() and not out_dir.is_dir():
        raise NotADirectoryError(f"output path {out_dir} exists and is not a directory")
    if "usd" in formats:
        from atech.sim.usd import _pxr

        _pxr()  # fail fast with the install hint
    visuals: list[CadVisual | None] = []
    for spec in specs:
        cad, note = meshes.visual(spec) if meshes is not None else (None, "")
        visuals.append(cad)
        if note and on_note is not None:
            on_note(spec.asset_name, note)
    written: list[Path] = []
    for spec, cad in zip(specs, visuals, strict=True):
        written += export_spec(spec, formats, out_dir, date=date, cad=cad)
    return written
