"""Check exported USD against SimReady requirements.

Two layers:

- :func:`simready_problems` checks, with ``pxr`` only, the SimReady requirements
  the omniverse-asset-validator 1.18 package does not implement (SR.001, SR.002,
  SL.003, RB.001, PMT.001, VM.MAT.001, DISP.001, PS.001, kind) plus the ``atech:*``
  attributes this package promises.
- :func:`asset_validator_issues` runs NVIDIA's ``omni.asset_validator`` (package
  ``omniverse-asset-validator``) with every capability, feature and requirement
  it ships enabled.
"""

from __future__ import annotations

import struct
from pathlib import Path
from typing import Any

from atech.sim.thumbnail import SIZE_PX, thumbnail_path
from atech.sim.usd import _pxr

REQUIRED_LAYER_KEYS = ("SimReady_Metadata", "asset_name", "asset_type", "source_file", "usd_date_generated")
REQUIRED_ROOT_ATTRS = (
    "asset_type", "id", "name", "category", "size_ports", "catalog_version", "placeholders",
)


def _png_size(path: Path) -> tuple[int, int]:
    head = path.read_bytes()[:24]
    if head[:8] != b"\x89PNG\r\n\x1a\n":
        raise ValueError("not a PNG")
    return struct.unpack(">II", head[16:24])


def simready_problems(usd_path: Path) -> list[str]:
    """Human-readable problems; an empty list means every check passed."""
    px = _pxr()
    usd_path = Path(usd_path)
    stage = px.Usd.Stage.Open(str(usd_path))
    problems: list[str] = []

    def need(ok: bool, text: str) -> None:
        if not ok:
            problems.append(text)

    need(px.UsdGeom.GetStageUpAxis(stage) == px.UsdGeom.Tokens.z, "UN.006 upAxis is not Z")
    need(px.UsdGeom.GetStageMetersPerUnit(stage) == 1.0, "UN.007 metersPerUnit is not 1")
    need(px.UsdPhysics.GetStageKilogramsPerUnit(stage) == 1.0, "kilogramsPerUnit is not 1")
    root = stage.GetDefaultPrim()
    need(bool(root), "HI.004 no defaultPrim")
    if not root:
        return problems
    need(len(stage.GetPseudoRoot().GetChildren()) == 1, "HI.001 more than one root prim")
    need(px.Usd.ModelAPI(root).GetKind() == "component", "kind is not component")

    data = stage.GetRootLayer().customLayerData
    for key in REQUIRED_LAYER_KEYS:
        need(key in data, f"SR.001 customLayerData has no {key!r}")
    thumb = thumbnail_path(usd_path)
    if thumb.is_file():
        need(_png_size(thumb) == (SIZE_PX, SIZE_PX), "SR.002 thumbnail is not 256x256")
    else:
        problems.append(f"SR.002 no thumbnail at {thumb}")

    need(root.HasAPI(px.UsdPhysics.RigidBodyAPI), "RB.001 default prim has no RigidBodyAPI")
    mass = px.UsdPhysics.MassAPI(root).GetMassAttr().Get() if root.HasAPI(px.UsdPhysics.MassAPI) else None
    need(bool(mass and mass > 0), "RB.007 no physics:mass > 0 on the body")

    schemas = list(root.GetAppliedSchemas())
    need("SemanticsLabelsAPI:wikidata_qcode" in schemas, "SL.003 no SemanticsLabelsAPI:wikidata_qcode")
    labels = root.GetAttribute("semantics:labels:wikidata_qcode").Get() or []
    need(len(labels) > 0 and all(str(q).startswith("Q") and str(q)[1:].isdigit() for q in labels),
         "SL.003 wikidata_qcode labels missing or not Q-codes")

    for name in REQUIRED_ROOT_ATTRS:
        need(root.GetAttribute(f"atech:{name}").IsValid(), f"missing atech:{name}")

    gprims = colliders = 0
    for prim in stage.Traverse():
        if prim.IsA(px.UsdGeom.Gprim):
            gprims += 1
            path = prim.GetPath()
            binding = px.UsdShade.MaterialBindingAPI(prim)
            visual, _ = binding.ComputeBoundMaterial()
            need(bool(visual), f"VM.MAT.001 {path} has no bound material")
            if visual:
                shader = visual.ComputeSurfaceSource()[0]
                need(bool(shader) and shader.GetIdAttr().Get() == "UsdPreviewSurface",
                     f"{path} material is not a UsdPreviewSurface")
            need(px.UsdGeom.Gprim(prim).GetDisplayColorAttr().HasAuthoredValue(),
                 f"DISP.001 {path} has no displayColor")
            purpose = px.UsdGeom.Imageable(prim).ComputePurpose()
            if prim.HasAPI(px.UsdPhysics.CollisionAPI):
                colliders += 1
                phys, _ = binding.ComputeBoundMaterial("physics")
                need(bool(phys) and phys.GetPrim().HasAPI(px.UsdPhysics.MaterialAPI),
                     f"PMT.001 collider {path} has no physics material")
            elif purpose != px.UsdGeom.Tokens.render:
                problems.append(f"{path} is neither a collider nor a render-only (CAD) visual")
        if prim.GetTypeName() == "IsaacImuSensor":
            ancestor = prim.GetParent()
            while ancestor and not ancestor.HasAPI(px.UsdPhysics.RigidBodyAPI):
                ancestor = ancestor.GetParent()
            need(bool(ancestor) and not ancestor.IsPseudoRoot(),
                 f"PS.001 {prim.GetPath()} not under a rigid body")
    need(gprims > 0, "no geometry")
    need(colliders > 0, "no collider")
    return problems


def asset_validator_issues(usd_path: Path) -> list[tuple[str, str, str]]:
    """``(severity, requirement or rule, message)`` from omni.asset_validator.

    Raises ImportError when the ``omniverse-asset-validator`` package is missing.
    """
    import logging

    logging.getLogger("omni.asset_validator").setLevel(logging.WARNING)
    import omni.asset_validator as av  # type: ignore[import-not-found]

    engine = av.ValidationEngine()
    for capability in av.CapabilityRegistry().capabilities:
        engine.enable_capability(capability)
    for feature in av.FeatureRegistry().features:
        engine.enable_feature(feature)
    for requirement in av.RequirementsRegistry().latest_requirements:
        engine.enable_requirement(requirement)
    out: list[tuple[str, str, str]] = []
    for issue in engine.validate(str(usd_path)).issues():
        source: Any = issue.requirement.code if issue.requirement else (
            issue.rule.__name__ if issue.rule else "?"
        )
        out.append((str(issue.severity), str(source), str(issue.message)))
    return out
