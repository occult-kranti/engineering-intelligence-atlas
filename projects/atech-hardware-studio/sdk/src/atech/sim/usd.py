"""USD (``.usda``, or ``.usdc`` with real CAD) export following the NVIDIA SimReady conventions for a prop.

``pxr`` (the ``usd-core`` wheel, ``pip install "atech[sim]"``) is imported only
when a USD file is written. Attribute reference: ``src/atech/docs/sim_assets.md``.
"""

from __future__ import annotations

import datetime as _dt
from pathlib import Path
from typing import TYPE_CHECKING, Any

from atech import __version__
from atech.sim.geometry import bounds, box_mesh
from atech.sim.meshes import Pbr
from atech.sim.model import mass_properties
from atech.sim.spec import DeviceBlock, Frame, SimSpec
from atech.sim.thumbnail import write_thumbnail

if TYPE_CHECKING:
    from atech.sim.meshes import CadVisual, MeshPart

ATTR_NS = "atech"


class UsdUnavailableError(RuntimeError):
    """``pxr`` is not installed."""


def _pxr() -> Any:
    try:
        from pxr import Gf, Kind, Sdf, Usd, UsdGeom, UsdPhysics, UsdShade, Vt
    except ImportError as exc:
        raise UsdUnavailableError(
            "USD export needs the OpenUSD Python bindings (pxr). Install them with "
            "`pip install \"atech[sim]\"` (or `pip install usd-core`)."
        ) from exc

    class _Mods:
        pass

    mods = _Mods()
    for name, mod in (
        ("Gf", Gf), ("Kind", Kind), ("Sdf", Sdf), ("Usd", Usd), ("UsdGeom", UsdGeom),
        ("UsdPhysics", UsdPhysics), ("UsdShade", UsdShade),
        ("Vt", Vt),
    ):
        setattr(mods, name, mod)
    return mods


def usd_available() -> bool:
    try:
        _pxr()
    except UsdUnavailableError:
        return False
    return True


def _set_pose(px: Any, prim: Any, frame: Frame) -> None:
    xf = px.UsdGeom.Xformable(prim)
    xf.AddTranslateOp().Set(px.Gf.Vec3d(*frame.pos_m))
    w, x, y, z = frame.quat_wxyz
    xf.AddOrientOp().Set(px.Gf.Quatf(w, px.Gf.Vec3f(x, y, z)))


def _attr(px: Any, prim: Any, name: str, value: Any, doc: str) -> None:
    """Author one custom ``atech:*`` attribute with its documentation string."""
    t = px.Sdf.ValueTypeNames
    if isinstance(value, bool):
        type_name = t.Bool
    elif isinstance(value, int):
        type_name = t.Int
    elif isinstance(value, float):
        type_name = t.Double
    elif isinstance(value, str):
        type_name = t.String
    elif isinstance(value, (list, tuple)) and all(isinstance(v, str) for v in value):
        type_name, value = t.StringArray, list(value)
    elif isinstance(value, (list, tuple)) and all(
        isinstance(v, int) and not isinstance(v, bool) for v in value
    ):
        type_name, value = t.IntArray, list(value)
    elif isinstance(value, (list, tuple)):
        type_name, value = t.DoubleArray, [float(v) for v in value]
    else:
        raise TypeError(f"cannot author {name}={value!r}")
    attr = prim.CreateAttribute(f"{ATTR_NS}:{name}", type_name, custom=True)
    attr.Set(value)
    attr.SetDocumentation(doc)


def _labels(px: Any, prim: Any, taxonomy: str, labels: tuple[str, ...]) -> None:
    """``SemanticsLabelsAPI:<taxonomy>`` + ``token[] semantics:labels:<taxonomy>``.

    Authored by hand (same result as ``UsdSemantics.LabelsAPI.Apply``) so that
    usd-core builds without the UsdSemantics module work too.
    """
    if not labels:
        return
    prim.AddAppliedSchema(f"SemanticsLabelsAPI:{taxonomy}")
    prim.CreateAttribute(
        f"semantics:labels:{taxonomy}", px.Sdf.ValueTypeNames.TokenArray, custom=False
    ).Set(list(labels))


def _materials(px: Any, stage: Any, root_path: Any, spec: SimSpec) -> tuple[dict[str, Any], Any]:
    looks = px.UsdGeom.Scope.Define(stage, root_path.AppendChild("looks"))
    used = sorted({p.color for p in spec.parts})
    visual: dict[str, Any] = {}
    for key in used:
        path = looks.GetPath().AppendChild(f"{key}_material")
        visual[key] = _preview_material(px, stage, path, spec.colors[key], 0.6)
    phys = px.UsdShade.Material.Define(stage, looks.GetPath().AppendChild("physics_material"))
    api = px.UsdPhysics.MaterialAPI.Apply(phys.GetPrim())
    api.CreateStaticFrictionAttr(spec.physics_material.static_friction)
    api.CreateDynamicFrictionAttr(spec.physics_material.dynamic_friction)
    api.CreateRestitutionAttr(spec.physics_material.restitution)
    return visual, phys


def _preview_material(px: Any, stage: Any, path: Any, rgba: tuple, roughness: float) -> Any:
    r, g, b, a = rgba
    mat = px.UsdShade.Material.Define(stage, path)
    shader = px.UsdShade.Shader.Define(stage, mat.GetPath().AppendChild("preview_surface"))
    shader.CreateIdAttr("UsdPreviewSurface")
    shader.CreateInput("diffuseColor", px.Sdf.ValueTypeNames.Color3f).Set(px.Gf.Vec3f(r, g, b))
    shader.CreateInput("roughness", px.Sdf.ValueTypeNames.Float).Set(roughness)
    shader.CreateInput("metallic", px.Sdf.ValueTypeNames.Float).Set(0.0)
    if a < 1.0:
        shader.CreateInput("opacity", px.Sdf.ValueTypeNames.Float).Set(a)
    mat.CreateSurfaceOutput().ConnectToSource(shader.ConnectableAPI(), "surface")
    return mat


TEXTURE_DIR = "textures"


def _f(value: float) -> float:
    return round(float(value), 4)


def _texture_shader(
    px: Any, stage: Any, mat_path: Any, name: str, file: str, scale: tuple[float, ...], st_reader: Any
) -> Any:
    tex = px.UsdShade.Shader.Define(stage, mat_path.AppendChild(name))
    tex.CreateIdAttr("UsdUVTexture")
    tex.CreateInput("file", px.Sdf.ValueTypeNames.Asset).Set(px.Sdf.AssetPath(file))
    tex.CreateInput("sourceColorSpace", px.Sdf.ValueTypeNames.Token).Set("sRGB")
    tex.CreateInput("wrapS", px.Sdf.ValueTypeNames.Token).Set("clamp")
    tex.CreateInput("wrapT", px.Sdf.ValueTypeNames.Token).Set("clamp")
    tex.CreateInput("scale", px.Sdf.ValueTypeNames.Float4).Set(px.Gf.Vec4f(*(_f(c) for c in scale)))
    tex.CreateInput("st", px.Sdf.ValueTypeNames.Float2).ConnectToSource(st_reader.ConnectableAPI(), "result")
    tex.CreateOutput("rgb", px.Sdf.ValueTypeNames.Float3)
    return tex


def pbr_material(
    px: Any, stage: Any, path: Any, mp: MeshPart, *, texture_files: dict[str, str] | None = None
) -> Any:
    """A UsdPreviewSurface carrying one CAD part's glTF PBR.

    - ``diffuseColor`` = baseColorFactor (linear), ``metallic``, ``roughness`` as in the GLB.
    - ``emissiveColor`` = emissiveFactor x KHR_materials_emissive_strength (lit LEDs, screen art).
    - alphaMode BLEND: ``opacity`` = the base colour alpha and ``opacityThreshold`` = 0
      (translucent, not a cutout); MASK: ``opacityThreshold`` = alphaCutoff. ``ior`` from
      KHR_materials_ior.
    - UsdPreviewSurface has no transmission. A transmissive material (the glass lids:
      alpha 0.42, transmission 0.92) is a surface covering ``alpha`` of the area that lets
      ``transmission`` of the light on that area through, so the part that does not let
      light through is ``opacity`` = alpha x (1 - transmission); the rest is see-through
      (the transmission's tint and blur are lost, the specular stays). Using the alpha alone
      ignores the transmission and turns the clear lids into frosted white slabs. The
      glTF numbers are kept on the Material as ``atech:gltf:alpha`` and
      ``atech:gltf:transmission`` for renderers that can rebuild real glass.
    - KHR_materials_unlit (silkscreen) has no preview-surface equivalent: diffuse only,
      flagged ``atech:gltf:unlit``.
    - Textures (``texture_files``: ``{"base_color" | "emissive": relative path}``) are
      sampled through ``primvars:st``, scaled by the factor they multiply in glTF.
    """
    pbr = mp.pbr if mp.pbr is not None else Pbr(base_color=mp.rgba_linear, metallic=0.0, roughness=0.5)
    texture_files = texture_files or {}
    mat = px.UsdShade.Material.Define(stage, path)
    shader = px.UsdShade.Shader.Define(stage, mat.GetPath().AppendChild("preview_surface"))
    shader.CreateIdAttr("UsdPreviewSurface")
    t = px.Sdf.ValueTypeNames
    r, g, b, a = pbr.base_color
    st_reader = None
    if texture_files:
        st_reader = px.UsdShade.Shader.Define(stage, mat.GetPath().AppendChild("st_reader"))
        st_reader.CreateIdAttr("UsdPrimvarReader_float2")
        st_reader.CreateInput("varname", t.String).Set("st")
        st_reader.CreateOutput("result", t.Float2)
    diffuse = shader.CreateInput("diffuseColor", t.Color3f)
    if "base_color" in texture_files:
        tex = _texture_shader(px, stage, mat.GetPath(), "base_color_texture", texture_files["base_color"],
                              (r, g, b, a), st_reader)
        diffuse.ConnectToSource(tex.ConnectableAPI(), "rgb")
    else:
        diffuse.Set(px.Gf.Vec3f(_f(r), _f(g), _f(b)))
    shader.CreateInput("metallic", t.Float).Set(_f(pbr.metallic))
    shader.CreateInput("roughness", t.Float).Set(_f(pbr.roughness))
    emissive = shader.CreateInput("emissiveColor", t.Color3f)
    if "emissive" in texture_files:
        tex = _texture_shader(px, stage, mat.GetPath(), "emissive_texture", texture_files["emissive"],
                              (*pbr.emissive, 1.0), st_reader)
        emissive.ConnectToSource(tex.ConnectableAPI(), "rgb")
    else:
        emissive.Set(px.Gf.Vec3f(*(_f(c) for c in pbr.emissive)))
    if pbr.alpha_mode == "BLEND":
        shader.CreateInput("opacity", t.Float).Set(_f(a * (1.0 - pbr.transmission)))
        shader.CreateInput("opacityThreshold", t.Float).Set(0.0)
    elif pbr.alpha_mode == "MASK":
        shader.CreateInput("opacity", t.Float).Set(_f(a))
        shader.CreateInput("opacityThreshold", t.Float).Set(_f(pbr.alpha_cutoff))
    if pbr.ior is not None:
        shader.CreateInput("ior", t.Float).Set(_f(pbr.ior))
    mat.CreateSurfaceOutput().ConnectToSource(shader.ConnectableAPI(), "surface")
    prim = mat.GetPrim()
    _attr(px, prim, "gltf:material", mp.material, "Name of the glTF material in the Atech CAD.")
    if pbr.transmission > 0:
        _attr(px, prim, "gltf:transmission", _f(pbr.transmission),
              "KHR_materials_transmission factor (0..1). UsdPreviewSurface has no transmission: "
              "the preview surface's opacity is alpha x (1 - transmission).")
    if pbr.alpha_mode != "OPAQUE":
        _attr(px, prim, "gltf:alpha", _f(a), f"glTF baseColorFactor alpha (alphaMode {pbr.alpha_mode}).")
    if pbr.unlit:
        _attr(px, prim, "gltf:unlit", True, "KHR_materials_unlit: shown as plain diffuse here.")
    return mat


def _write_textures(cad: CadVisual, folder: Path, prefix: str) -> dict[str, dict[str, Path]]:
    """``{part name: {"base_color" | "emissive": file}}``; stale ``<prefix>_*`` images are removed."""
    folder = Path(folder)
    if folder.is_dir():
        for old in folder.glob(f"{prefix}_*"):
            old.unlink()
    out: dict[str, dict[str, Path]] = {}
    for mp in cad.parts:
        if mp.pbr is None or mp.uvs is None:
            continue
        for kind, tex in (("base_color", mp.pbr.base_color_texture), ("emissive", mp.pbr.emissive_texture)):
            if tex is None:
                continue
            folder.mkdir(parents=True, exist_ok=True)
            file = folder / f"{prefix}_{mp.name}_{kind}{tex.suffix}"
            file.write_bytes(tex.data)
            out.setdefault(mp.name, {})[kind] = file
    if folder.is_dir() and not any(folder.iterdir()):
        folder.rmdir()
    return out


def _write_textures_none(folder: Path, prefix: str) -> None:
    """Remove the images an earlier CAD export of this asset left (a box-only re-export)."""
    if Path(folder).is_dir():
        for old in Path(folder).glob(f"{prefix}_*"):
            old.unlink()
        if not any(Path(folder).iterdir()):
            Path(folder).rmdir()


def add_cad_visual(
    stage: Any, root_path: Any, cad: CadVisual, *, textures: dict[str, dict[str, str]] | None = None
) -> list[Any]:
    """Author ``root_path/geometry/<part>_cad_mesh`` (purpose render, no collider) and
    ``root_path/looks/<part>_cad_material`` (the part's glTF PBR) for every CAD part.

    ``textures`` maps a part name to ``{"base_color" | "emissive": asset path}`` as the
    layer should reference it (see :func:`write_usd`, which writes the images).
    Returns the mesh prims.
    """
    px = _pxr()
    return _cad_geometry(px, stage, px.Sdf.Path(str(root_path)), cad, textures or {})


def _cad_geometry(
    px: Any, stage: Any, root_path: Any, cad: CadVisual, textures: dict[str, dict[str, str]] | None = None
) -> list[Any]:
    """Render-purpose meshes, one per CAD material; no colliders (the boxes are)."""
    import numpy as np

    textures = textures or {}
    looks = root_path.AppendChild("looks")
    geo = root_path.AppendChild("geometry")
    meshes = []
    for mp in cad.parts:
        material = pbr_material(
            px, stage, looks.AppendChild(f"{mp.name}_cad_material"), mp, texture_files=textures.get(mp.name)
        )
        mesh = px.UsdGeom.Mesh.Define(stage, geo.AppendChild(f"{mp.name}_cad_mesh"))
        meshes.append(mesh.GetPrim())
        verts = np.asarray(mp.vertices, dtype=np.float64)
        faces = np.asarray(mp.faces, dtype=np.int64)
        tri = verts[faces]
        normals = np.cross(tri[:, 1] - tri[:, 0], tri[:, 2] - tri[:, 0])
        normals /= np.linalg.norm(normals, axis=1, keepdims=True)
        mesh.CreatePointsAttr(px.Vt.Vec3fArray.FromNumpy(verts.astype(np.float32)))
        mesh.CreateFaceVertexCountsAttr(px.Vt.IntArray.FromNumpy(np.full(len(faces), 3, dtype=np.int32)))
        mesh.CreateFaceVertexIndicesAttr(px.Vt.IntArray.FromNumpy(faces.reshape(-1).astype(np.int32)))
        mesh.CreateNormalsAttr(px.Vt.Vec3fArray.FromNumpy(np.repeat(normals, 3, axis=0).astype(np.float32)))
        mesh.SetNormalsInterpolation(px.UsdGeom.Tokens.faceVarying)
        mesh.CreateSubdivisionSchemeAttr(px.UsdGeom.Tokens.none)
        mesh.CreateOrientationAttr(px.UsdGeom.Tokens.rightHanded)
        mesh.CreateDoubleSidedAttr(bool(mp.pbr is not None and mp.pbr.double_sided))
        mesh.CreatePurposeAttr(px.UsdGeom.Tokens.render)
        lo, hi = mp.bounds_m
        mesh.CreateExtentAttr([px.Gf.Vec3f(*lo), px.Gf.Vec3f(*hi)])
        r, g, b, a = mp.rgba_linear
        mesh.CreateDisplayColorPrimvar(px.UsdGeom.Tokens.constant).Set([px.Gf.Vec3f(r, g, b)])
        mesh.CreateDisplayOpacityPrimvar(px.UsdGeom.Tokens.constant).Set([a])
        if mp.uvs is not None:
            st = px.UsdGeom.PrimvarsAPI(mesh.GetPrim()).CreatePrimvar(
                "st", px.Sdf.ValueTypeNames.TexCoord2fArray, px.UsdGeom.Tokens.faceVarying
            )
            values, index = np.unique(np.asarray(mp.uvs, dtype=np.float32).reshape(-1, 2), axis=0,
                                      return_inverse=True)  # indexed (SimReady VG.009)
            st.Set(px.Vt.Vec2fArray.FromNumpy(values))
            st.SetIndices(px.Vt.IntArray.FromNumpy(index.reshape(-1).astype(np.int32)))
        px.UsdShade.MaterialBindingAPI.Apply(mesh.GetPrim()).Bind(material)
    return meshes


def _geometry(
    px: Any, stage: Any, root_path: Any, spec: SimSpec, visual: dict, phys: Any, *, guide: bool = False
) -> None:
    """The ``sim.yaml`` boxes: colliders, and the visuals too unless ``guide``
    (CAD present: the boxes get purpose ``guide`` and stay out of renders)."""
    geo = px.UsdGeom.Xform.Define(stage, root_path.AppendChild("geometry"))
    for part in spec.parts:
        mesh = px.UsdGeom.Mesh.Define(stage, geo.GetPath().AppendChild(f"{part.name}_mesh"))
        points, counts, indices, normals = box_mesh(part.size_m, part.pos_m)
        mesh.CreatePointsAttr([px.Gf.Vec3f(*p) for p in points])
        mesh.CreateFaceVertexCountsAttr(counts)
        mesh.CreateFaceVertexIndicesAttr(indices)
        mesh.CreateNormalsAttr([px.Gf.Vec3f(*n) for n in normals])
        mesh.SetNormalsInterpolation(px.UsdGeom.Tokens.faceVarying)
        mesh.CreateSubdivisionSchemeAttr(px.UsdGeom.Tokens.none)
        mesh.CreateOrientationAttr(px.UsdGeom.Tokens.rightHanded)
        mesh.CreateDoubleSidedAttr(False)
        if guide:
            mesh.CreatePurposeAttr(px.UsdGeom.Tokens.guide)
        lo, hi = bounds([(part.size_m, part.pos_m)])
        mesh.CreateExtentAttr([px.Gf.Vec3f(*lo), px.Gf.Vec3f(*hi)])
        r, g, b, a = spec.colors[part.color]
        mesh.CreateDisplayColorPrimvar(px.UsdGeom.Tokens.constant).Set([px.Gf.Vec3f(r, g, b)])
        mesh.CreateDisplayOpacityPrimvar(px.UsdGeom.Tokens.constant).Set([a])
        prim = mesh.GetPrim()
        px.UsdPhysics.CollisionAPI.Apply(prim)
        px.UsdPhysics.MeshCollisionAPI.Apply(prim).CreateApproximationAttr(
            px.UsdPhysics.Tokens.convexHull
        )
        binding = px.UsdShade.MaterialBindingAPI.Apply(prim)
        binding.Bind(visual[part.color])
        binding.Bind(phys, px.UsdShade.Tokens.weakerThanDescendants, "physics")


def _device(px: Any, stage: Any, root_path: Any, role: str, block: DeviceBlock) -> None:
    prim = px.UsdGeom.Xform.Define(stage, root_path.AppendChild(role)).GetPrim()
    _set_pose(px, prim, block.frame)
    _attr(px, prim, f"{role}:type", block.type, f"Kind of {role}; see sim_assets.md for each type.")
    if block.chip:
        _attr(px, prim, f"{role}:chip", block.chip, "Part number of the chip on the module.")
    for key, value in block.params.items():
        _attr(px, prim, f"{role}:{key}", value, f"{role} parameter from sim.yaml; unit in the name.")
    if block.type == "imu":
        # Isaac Sim's IMU prim (SimReady Sensor-IMU profile, PS.001: under a rigid
        # body). Typed by name only: usd-core does not ship the Isaac schema, and no
        # Isaac-specific attribute is authored.
        stage.DefinePrim(prim.GetPath().AppendChild("imu_sensor"), "IsaacImuSensor")


def _ports(px: Any, stage: Any, root_path: Any, spec: SimSpec) -> None:
    from atech.catalog import get_board

    board = get_board(spec.id)
    by_id = {p.id: p for p in board.ports}
    ports = px.UsdGeom.Xform.Define(stage, root_path.AppendChild("ports"))
    for pf in spec.ports:
        prim = px.UsdGeom.Xform.Define(stage, ports.GetPath().AppendChild(pf.port_id)).GetPrim()
        _set_pose(px, prim, pf.frame)
        _attr(px, prim, "port:id", pf.port_id, "Port id as in the board YAML and project.yaml.")
        _attr(px, prim, "port:face", pf.face, "Board face the port is on: top | bottom.")
        _attr(px, prim, "port:reserved", pf.port_id in board.reserved,
              "True for USB-C / Reset positions that cannot take a module.")
        spec_port = by_id.get(pf.port_id)
        if spec_port is not None:
            _attr(px, prim, "port:interfaces", list(spec_port.compatible_interfaces),
                  "Interfaces the port supports (i2c, digital, gpio, analog, uart).")
            if spec_port.side:
                _attr(px, prim, "port:side", spec_port.side, "The board YAML's side: field.")


def write_usd(
    spec: SimSpec,
    path: Path,
    *,
    date: str | None = None,
    thumbnail: bool = True,
    cad: CadVisual | None = None,
) -> list[Path]:
    """Write ``path`` (``.usda`` text or ``.usdc`` crate) and, by default, its SimReady thumbnail.

    With ``cad``, the visuals are its meshes (purpose ``render``) and the boxes
    stay as colliders with purpose ``guide``.
    """
    px = _pxr()
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    # Build in memory and export: Stage.CreateNew fails when this process already
    # has a layer open at ``path`` (a viewer or a sim that loaded the last export).
    stage = px.Usd.Stage.CreateInMemory()
    px.UsdGeom.SetStageUpAxis(stage, px.UsdGeom.Tokens.z)
    px.UsdGeom.SetStageMetersPerUnit(stage, 1.0)
    px.UsdPhysics.SetStageKilogramsPerUnit(stage, 1.0)

    root_path = px.Sdf.Path(f"/{spec.asset_name}")
    root = px.UsdGeom.Xform.Define(stage, root_path).GetPrim()
    stage.SetDefaultPrim(root)
    model = px.Usd.ModelAPI(root)
    model.SetKind(px.Kind.Tokens.component)
    model.SetAssetName(spec.asset_name)
    model.SetAssetVersion(__version__)

    layer = stage.GetRootLayer()
    layer.customLayerData = {
        "SimReady_Metadata": {},
        "asset_name": spec.asset_name,
        "asset_type": f"atech_{spec.kind}",
        "source_file": spec.source_file,
        "usd_date_generated": date or _dt.date.today().isoformat(),
    }
    layer.documentation = (
        f"{spec.name}: Atech {spec.kind} asset generated by atech {__version__} (atech.sim). "
        "Fields listed in atech:placeholders are guesses until Atech publishes datasheets."
    )

    # Physics: one rigid body; mass and inertia from the parts at uniform density.
    px.UsdPhysics.RigidBodyAPI.Apply(root)
    mp = mass_properties(spec)
    mass_api = px.UsdPhysics.MassAPI.Apply(root)
    mass_api.CreateMassAttr(mp.mass_kg)
    mass_api.CreateCenterOfMassAttr(px.Gf.Vec3f(*mp.com_m))
    mass_api.CreateDiagonalInertiaAttr(px.Gf.Vec3f(*mp.principal_moments_kgm2))
    w, x, y, z = mp.principal_axes_quat
    mass_api.CreatePrincipalAxesAttr(px.Gf.Quatf(w, px.Gf.Vec3f(x, y, z)))

    # Semantics (SimReady SL.003) plus a plain class label for Replicator.
    _labels(px, root, "wikidata_qcode", spec.semantic_qcodes)
    _labels(px, root, "class", spec.semantic_classes)

    _attr(px, root, "asset_type", spec.kind, "module | board.")
    _attr(px, root, "id", spec.id, "Catalog id (module.yaml id / board YAML id).")
    _attr(px, root, "name", spec.name, "Human-readable catalog name.")
    _attr(px, root, "category", spec.category, "module.yaml category, or 'board'.")
    _attr(px, root, "size_ports", spec.size_ports,
          "Module: ports it spans (1 or 2). Board: number of module ports.")
    if spec.interface:
        _attr(px, root, "interface", spec.interface, "module.yaml interface: i2c | gpio | analog | uart.")
    if spec.i2c_address is not None:
        _attr(px, root, "i2c_address", spec.i2c_address, "7-bit I2C address (decimal int).")
    _attr(px, root, "catalog_version", __version__, "Version of the atech package that wrote the asset.")
    _attr(px, root, "placeholders", list(spec.placeholders),
          "sim.yaml fields that are guesses, not Atech data.")
    if cad is not None:
        _attr(px, root, "visual:source", cad.source, "The Atech CAD file the visual meshes come from.")
        _attr(px, root, "visual:sha256", cad.sha256, "sha256 of that CAD file.")

    visual, phys = _materials(px, stage, root_path, spec)
    _geometry(px, stage, root_path, spec, visual, phys, guide=cad is not None)
    texture_files: list[Path] = []
    if cad is not None:
        images = _write_textures(cad, path.parent / TEXTURE_DIR, path.stem)
        texture_files = [f for kinds in images.values() for f in kinds.values()]
        rel = {part: {k: f"./{TEXTURE_DIR}/{f.name}" for k, f in kinds.items()} for part, kinds in images.items()}
        _cad_geometry(px, stage, root_path, cad, rel)
    else:
        _write_textures_none(path.parent / TEXTURE_DIR, path.stem)

    connector = px.UsdGeom.Xform.Define(stage, root_path.AppendChild("connector")).GetPrim()
    _set_pose(px, connector, spec.connector)
    _attr(px, connector, "connector:type", "atech_port" if spec.kind == "module" else "board_mount",
          "atech_port: mates with a board port frame. board_mount: where the board is fixed.")
    _attr(px, connector, "connector:span_ports", spec.size_ports if spec.kind == "module" else 0,
          "Ports the connector spans (modules); 0 for a board.")

    if spec.sensor:
        _device(px, stage, root_path, "sensor", spec.sensor)
    if spec.actuator:
        _device(px, stage, root_path, "actuator", spec.actuator)
    if spec.kind == "board":
        _ports(px, stage, root_path, spec)

    if not layer.Export(str(path)):
        raise OSError(f"could not write {path}")
    opened = px.Sdf.Layer.Find(str(path))
    if opened is not None:
        opened.Reload(force=True)  # stages already open on ``path`` see the new file
    written = [path, *texture_files]
    if thumbnail:
        written.append(write_thumbnail(spec, path))
    return written
