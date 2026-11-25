"""Real Atech CAD for the visual geometry of exported assets.

The meshes are NOT bundled with the SDK: they come from the private release
``atechdotdev/atech-module-renders`` (asset ``atech_module_glb.zip``, folder
``glb_plain/``, one ``<slug>.glb`` per module or board, exported from Atech's
production STEP files). Point the exporter at an unzipped ``glb_plain/`` folder
(``atech sim-assets --meshes DIR``) or let it download the release with the
user's GitHub CLI (``--fetch [TAG]``, cached under ``~/.cache/atech``).

GLB frame: metres, +y up, origin at the footprint centre, shell bottom on y = 0,
outer (board-edge) face toward -z. Converted here to the asset frame (+z up):
glTF ``(x, y, z) -> (x, -z, y)``, so the outer face points toward +y.

Only the visuals change. Collision shapes, mass and inertia stay the ``sim.yaml``
boxes, whose sizes are the bounds of the same CAD. A model whose bounds disagree
with the ``sim.yaml`` box by more than :data:`BOUNDS_TOLERANCE_M` is not used (the
board port frames would no longer sit on it); the exporter says why.

Needs ``trimesh`` (``pip install "atech[sim]"``), imported only when a GLB is read.
"""

from __future__ import annotations

import hashlib
import os
import re
import shutil
import subprocess
import tempfile
import zipfile
from collections.abc import Callable
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from atech.sim.geometry import Vec3, bounds
from atech.sim.spec import SimSpec

RELEASE_REPO = "atechdotdev/atech-module-renders"
RELEASE_ASSET = "atech_module_glb.zip"
DEFAULT_TAG = "v1.7"
GLB_FOLDER = "glb_plain"
BOUNDS_TOLERANCE_M = 0.001

# Catalog module id -> model slug in the release (studio p2p/hw_models.py MODULE_SLUG).
MODULE_SLUG: dict[str, str] = {
    "distance_sensor": "distance-sensor",
    "icm40608": "orientation-sensor",
    "aht20": "temp-sensor",
    "neopixel": "led-grid",
    "button": "button",
    "rotary_encoder": "knob",
    "speaker": "speaker",
    "microphone": "microphone",
    "st7735_tft": "screen",
    "dc_motor": "dc-motor",
    "micro_sd_card": "micro-sd",
    "st7789_tft": "big-screen",
    # sim-only products (catalog/data/products)
    "usb_c": "usb-c",
    "camera": "camera",
}
BOARD_SLUG: dict[str, str] = {"14port": "frame-2", "10port": "motherboard-10port", "8port": "motherboard-8port"}
#: Atech CAD that is not in the release yet -> where it comes from. Used when the mesh
#: folder has it, else the asset gets its derived model. Converted to the release's
#: frame by docs/hardware/obj_to_release_glb.py.
NOT_IN_RELEASE: dict[str, str] = {
    "motherboard-8port": "atechdotdev/frontend public/models/6portboard.obj (Node 8 Position Motherboard)",
}

# glTF +y up -> asset +z up: (x, y, z) -> (x, -z, y)
_Y_UP_TO_Z_UP = ((1.0, 0.0, 0.0, 0.0), (0.0, 0.0, -1.0, 0.0), (0.0, 1.0, 0.0, 0.0), (0.0, 0.0, 0.0, 1.0))
_TAG = re.compile(r"[A-Za-z0-9][A-Za-z0-9._-]*")
_MIN_FACE_AREA_M2 = 1e-14


class MeshesUnavailableError(RuntimeError):
    """The CAD meshes cannot be read or fetched (no trimesh, no folder, no gh, ...)."""


@dataclass(frozen=True)
class Texture:
    """An image a glTF material samples, as the GLB stores it (bytes are not re-encoded)."""

    mime: str  # "image/png" | "image/jpeg"
    data: bytes

    @property
    def suffix(self) -> str:
        return ".jpg" if self.mime == "image/jpeg" else ".png"


@dataclass(frozen=True)
class Pbr:
    """A glTF 2.0 metallic-roughness material, as the GLB defines it (colours linear).

    Defaults are the glTF spec's (metallic and roughness 1 when the factor is absent).
    ``emissive`` already includes ``KHR_materials_emissive_strength``.
    """

    base_color: tuple[float, float, float, float] = (1.0, 1.0, 1.0, 1.0)
    metallic: float = 1.0
    roughness: float = 1.0
    emissive: tuple[float, float, float] = (0.0, 0.0, 0.0)
    alpha_mode: str = "OPAQUE"  # OPAQUE | MASK | BLEND
    alpha_cutoff: float = 0.5
    transmission: float = 0.0  # KHR_materials_transmission
    ior: float | None = None  # KHR_materials_ior
    unlit: bool = False  # KHR_materials_unlit
    double_sided: bool = False
    base_color_texture: Texture | None = None
    emissive_texture: Texture | None = None

    @property
    def textured(self) -> bool:
        return self.base_color_texture is not None or self.emissive_texture is not None


@dataclass(frozen=True, eq=False)
class MeshPart:
    """All triangles of one CAD material, in the asset frame (+z up, metres)."""

    name: str  # identifier made from the glTF material name, e.g. "black_m"
    material: str  # the glTF material name as in the GLB
    rgba_linear: tuple[float, float, float, float]  # glTF baseColorFactor (linear)
    rgba_srgb: tuple[float, float, float, float]  # the same colour encoded sRGB (MJCF, URDF)
    vertices: Any  # numpy (N, 3) float64
    faces: Any  # numpy (M, 3) int64, counter-clockwise seen from outside
    pbr: Pbr | None = None  # the full glTF material (None: only the colour is known)
    uvs: Any = None  # textured parts: numpy (M, 3, 2) per face corner, USD st (origin bottom-left)

    @property
    def bounds_m(self) -> tuple[Vec3, Vec3]:
        lo, hi = self.vertices.min(axis=0), self.vertices.max(axis=0)
        return (tuple(float(v) for v in lo), tuple(float(v) for v in hi))  # type: ignore[return-value]


@dataclass(frozen=True, eq=False)
class CadVisual:
    """The CAD that replaces an asset's box visuals."""

    slug: str
    source: str  # e.g. "atechdotdev/atech-module-renders glb_plain/button.glb"
    sha256: str  # of the .glb file
    parts: tuple[MeshPart, ...] = field(default_factory=tuple)

    @property
    def bounds_m(self) -> tuple[Vec3, Vec3]:
        los = [p.bounds_m[0] for p in self.parts]
        his = [p.bounds_m[1] for p in self.parts]
        return (
            tuple(min(v[i] for v in los) for i in range(3)),  # type: ignore[return-value]
            tuple(max(v[i] for v in his) for i in range(3)),
        )


def slug_for(spec: SimSpec) -> str | None:
    """Release model slug for a module or board, or None when there is no CAD."""
    table = BOARD_SLUG if spec.kind == "board" else MODULE_SLUG
    return table.get(spec.id)


def _trimesh() -> Any:
    try:
        import numpy  # noqa: F401
        import trimesh
    except ImportError as exc:
        raise MeshesUnavailableError(
            "Reading the Atech CAD (.glb) needs trimesh. Install it with "
            "`pip install \"atech[sim]\"` (or `pip install trimesh`)."
        ) from exc
    return trimesh


def _identifier(material: str, taken: set[str]) -> str:
    name = re.sub(r"[^a-z0-9]+", "_", material.lower()).strip("_") or "material"
    if not name[0].isalpha():
        name = f"m_{name}"
    base, n = name, 2
    while name in taken:
        name, n = f"{base}_{n}", n + 1
    taken.add(name)
    return name


def _linear_to_srgb(c: float) -> float:
    c = min(1.0, max(0.0, c))
    return 12.92 * c if c <= 0.0031308 else 1.055 * c ** (1 / 2.4) - 0.055


def _rgba(geom: Any) -> tuple[str, tuple[float, float, float, float]]:
    material = getattr(geom.visual, "material", None)
    name = getattr(material, "name", None) or "default"
    factor = getattr(material, "baseColorFactor", None)
    if factor is None:
        return name, (0.5, 0.5, 0.5, 1.0)
    import numpy as np

    raw = np.asarray(factor)
    values = [float(v) for v in raw]
    if raw.dtype.kind in "ui":  # trimesh stores the factor as uint8 (0..255)
        values = [v / 255.0 for v in values]
    r, g, b, a = (values + [1.0])[:4]
    return name, (r, g, b, a)


# ------------------------------------------------------------ glTF materials
#
# trimesh keeps only the base colour of a material and does not dequantize
# normalized texture coordinates (KHR_mesh_quantization), so the materials, and
# the triangles of textured materials, are read from the GLB's own JSON + BIN.

_COMPONENT = {5120: "i1", 5121: "u1", 5122: "<i2", 5123: "<u2", 5125: "<u4", 5126: "<f4"}
_NORMALIZER = {5120: 127.0, 5121: 255.0, 5122: 32767.0, 5123: 65535.0}
_WIDTH = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4, "MAT4": 16}


def _glb_chunks(path: Path) -> tuple[dict, bytes]:
    import json
    import struct

    data = Path(path).read_bytes()
    if len(data) < 20 or data[:4] != b"glTF":
        raise MeshesUnavailableError(f"{path} is not a binary glTF (.glb)")
    gltf: dict | None = None
    binary = b""
    offset = 12
    while offset + 8 <= len(data):
        length, kind = struct.unpack("<II", data[offset:offset + 8])
        chunk = data[offset + 8:offset + 8 + length]
        if kind == 0x4E4F534A:  # JSON
            gltf = json.loads(chunk)
        elif kind == 0x004E4942:  # BIN
            binary = chunk
        offset += 8 + length
    if gltf is None:
        raise MeshesUnavailableError(f"{path} has no JSON chunk")
    return gltf, binary


def _accessor(gltf: dict, binary: bytes, index: int) -> Any:
    """An accessor as float64 (normalized integers mapped to [0, 1] / [-1, 1])."""
    import numpy as np

    acc = gltf["accessors"][index]
    width = _WIDTH[acc["type"]]
    dtype = np.dtype(_COMPONENT[acc["componentType"]])
    count = acc["count"]
    if "bufferView" not in acc:
        return np.zeros((count, width))
    view = gltf["bufferViews"][acc["bufferView"]]
    stride = view.get("byteStride") or dtype.itemsize * width
    start = view.get("byteOffset", 0) + acc.get("byteOffset", 0)
    raw = np.ndarray((count, width), dtype=dtype, buffer=binary, offset=start, strides=(stride, dtype.itemsize))
    out = raw.astype(np.float64)
    if acc.get("normalized") and acc["componentType"] in _NORMALIZER:
        out = np.maximum(out / _NORMALIZER[acc["componentType"]], -1.0)
    return out


def _texture(gltf: dict, binary: bytes, info: dict | None) -> Texture | None:
    if not info:
        return None
    tex = gltf.get("textures", [])[info["index"]]
    image = gltf.get("images", [])[tex["source"]]
    if "bufferView" not in image:
        return None  # an external image file: not part of a .glb release
    view = gltf["bufferViews"][image["bufferView"]]
    start = view.get("byteOffset", 0)
    return Texture(mime=image.get("mimeType", "image/png"), data=bytes(binary[start:start + view["byteLength"]]))


def _pbr(gltf: dict, binary: bytes, material: dict) -> Pbr:
    pmr = material.get("pbrMetallicRoughness", {})
    ext = material.get("extensions", {})
    strength = float(ext.get("KHR_materials_emissive_strength", {}).get("emissiveStrength", 1.0))
    emissive = tuple(float(c) * strength for c in material.get("emissiveFactor", (0.0, 0.0, 0.0)))
    ior = ext.get("KHR_materials_ior", {}).get("ior")
    return Pbr(
        base_color=tuple(float(c) for c in pmr.get("baseColorFactor", (1.0, 1.0, 1.0, 1.0))),  # type: ignore[arg-type]
        metallic=float(pmr.get("metallicFactor", 1.0)),
        roughness=float(pmr.get("roughnessFactor", 1.0)),
        emissive=emissive,  # type: ignore[arg-type]
        alpha_mode=str(material.get("alphaMode", "OPAQUE")),
        alpha_cutoff=float(material.get("alphaCutoff", 0.5)),
        transmission=float(ext.get("KHR_materials_transmission", {}).get("transmissionFactor", 0.0)),
        ior=None if ior is None else float(ior),
        unlit="KHR_materials_unlit" in ext,
        double_sided=bool(material.get("doubleSided", False)),
        base_color_texture=_texture(gltf, binary, pmr.get("baseColorTexture")),
        emissive_texture=_texture(gltf, binary, material.get("emissiveTexture")),
    )


def _node_matrices(gltf: dict) -> list[tuple[Any, int]]:
    """``(world matrix, mesh index)`` for every node instancing a mesh in the default scene."""
    import numpy as np

    def local(node: dict) -> Any:
        if "matrix" in node:
            return np.array(node["matrix"], dtype=float).reshape(4, 4).T  # column-major
        t = np.eye(4)
        x, y, z, w = node.get("rotation", (0.0, 0.0, 0.0, 1.0))
        rot = np.array([
            [1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
            [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
            [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)],
        ])
        t[:3, :3] = rot * np.array(node.get("scale", (1.0, 1.0, 1.0)))
        t[:3, 3] = node.get("translation", (0.0, 0.0, 0.0))
        return t

    nodes = gltf.get("nodes", [])
    scenes = gltf.get("scenes") or [{"nodes": list(range(len(nodes)))}]
    roots = scenes[gltf.get("scene", 0)].get("nodes", [])
    out: list[tuple[Any, int]] = []
    stack = [(i, np.eye(4)) for i in roots]
    while stack:
        index, parent = stack.pop()
        node = nodes[index]
        world = parent @ local(node)
        if "mesh" in node:
            out.append((world, node["mesh"]))
        stack.extend((c, world) for c in node.get("children", []))
    return out


def _uv_transform(uv: Any, info: dict) -> Any:
    """KHR_texture_transform (offset, rotation, scale) on glTF uvs."""
    import numpy as np

    tt = info.get("extensions", {}).get("KHR_texture_transform")
    if not tt:
        return uv
    sx, sy = tt.get("scale", (1.0, 1.0))
    ox, oy = tt.get("offset", (0.0, 0.0))
    r = float(tt.get("rotation", 0.0))
    c, s = np.cos(r), np.sin(r)
    u, v = uv[:, 0] * sx, uv[:, 1] * sy
    return np.column_stack([c * u + s * v + ox, -s * u + c * v + oy])


def _textured_triangles(gltf: dict, binary: bytes, material_index: int, convert: Any) -> tuple[Any, Any, Any]:
    """Vertices, faces and per-corner USD st of every primitive using ``material_index``."""
    import numpy as np

    material = gltf["materials"][material_index]
    info = material.get("pbrMetallicRoughness", {}).get("baseColorTexture") or material.get("emissiveTexture")
    verts_all, faces_all, uv_all = [], [], []
    count = 0
    for world, mesh_index in _node_matrices(gltf):
        matrix = convert @ world
        for prim in gltf["meshes"][mesh_index].get("primitives", []):
            if prim.get("material") != material_index or prim.get("mode", 4) != 4:
                continue
            attrs = prim["attributes"]
            pos = _accessor(gltf, binary, attrs["POSITION"])
            verts = pos @ matrix[:3, :3].T + matrix[:3, 3]
            if "indices" in prim:
                faces = _accessor(gltf, binary, prim["indices"]).astype(np.int64).reshape(-1, 3)
            else:
                faces = np.arange(len(pos), dtype=np.int64).reshape(-1, 3)
            if np.linalg.det(matrix[:3, :3]) < 0:
                faces = faces[:, ::-1]
            uv_key = f"TEXCOORD_{info.get('texCoord', 0)}"
            uv = _uv_transform(_accessor(gltf, binary, attrs[uv_key]), info) if uv_key in attrs else np.zeros(
                (len(pos), 2)
            )
            st = np.column_stack([uv[:, 0], 1.0 - uv[:, 1]])  # glTF origin top-left -> USD bottom-left
            verts_all.append(verts)
            faces_all.append(faces + count)
            uv_all.append(st[faces])
            count += len(verts)
    if not verts_all:
        return np.zeros((0, 3)), np.zeros((0, 3), dtype=np.int64), np.zeros((0, 3, 2))
    return np.vstack(verts_all), np.vstack(faces_all), np.vstack(uv_all)


def read_glb(path: Path) -> list[MeshPart]:
    """One :class:`MeshPart` per material of a GLB, converted to +z up, with its glTF PBR."""
    trimesh = _trimesh()
    import numpy as np

    try:
        scene = trimesh.load(Path(path), force="scene")
        gltf, binary = _glb_chunks(Path(path))
    except MeshesUnavailableError:
        raise
    except Exception as exc:  # trimesh raises many types for a bad file
        raise MeshesUnavailableError(f"cannot read {path}: {exc}") from exc
    convert = np.array(_Y_UP_TO_Z_UP)
    gltf_materials = {m.get("name"): (i, m) for i, m in enumerate(gltf.get("materials", []))}
    pbrs = {name: _pbr(gltf, binary, m) for name, (_, m) in gltf_materials.items() if name}
    grouped: dict[str, list[tuple[Any, Any]]] = {}
    colours: dict[str, tuple[float, float, float, float]] = {}
    uv_parts: dict[str, Any] = {}
    for name, pbr in pbrs.items():
        if pbr.textured:  # its triangles come from the GLB itself, with their texture coordinates
            verts, faces, uvs = _textured_triangles(gltf, binary, gltf_materials[name][0], convert)
            if len(faces):
                grouped[name] = [(verts, faces)]
                colours[name] = pbr.base_color
                uv_parts[name] = uvs
    for node in sorted(scene.graph.nodes_geometry):
        transform, geom_name = scene.graph[node]
        geom = scene.geometry[geom_name]
        if not isinstance(geom, trimesh.Trimesh) or len(geom.faces) == 0:
            continue
        material, rgba = _rgba(geom)
        if material in uv_parts:
            continue
        matrix = convert @ np.asarray(transform, dtype=float)
        verts = np.asarray(geom.vertices, dtype=float) @ matrix[:3, :3].T + matrix[:3, 3]
        faces = np.asarray(geom.faces, dtype=np.int64)
        if np.linalg.det(matrix[:3, :3]) < 0:  # a mirroring node flips the winding
            faces = faces[:, ::-1]
        grouped.setdefault(material, []).append((verts, faces))
        colours.setdefault(material, rgba)
    taken: set[str] = set()
    parts: list[MeshPart] = []
    for material in sorted(grouped):
        chunks = grouped[material]
        offsets = np.cumsum([0] + [len(v) for v, _ in chunks[:-1]])
        verts = np.vstack([v for v, _ in chunks])
        faces = np.vstack([f + o for (_, f), o in zip(chunks, offsets, strict=True)])
        # GLBs split vertices per face for flat shading; merge co-located ones
        # (SimReady VG.016) and drop the faces that collapse or have no area.
        verts, inverse = np.unique(verts, axis=0, return_inverse=True)
        faces = inverse.reshape(-1)[faces]
        tri = verts[faces]
        area = np.linalg.norm(np.cross(tri[:, 1] - tri[:, 0], tri[:, 2] - tri[:, 0]), axis=1) / 2.0
        keep = (area > _MIN_FACE_AREA_M2) & (faces[:, 0] != faces[:, 1]) & (faces[:, 1] != faces[:, 2]) & (
            faces[:, 0] != faces[:, 2]
        )
        faces = faces[keep]
        if len(faces) == 0:
            continue
        uvs = uv_parts[material][keep] if material in uv_parts else None
        used, faces = np.unique(faces, return_inverse=True)
        faces = faces.reshape(-1, 3)
        r, g, b, a = colours[material]
        srgb = (_linear_to_srgb(r), _linear_to_srgb(g), _linear_to_srgb(b), a)
        parts.append(MeshPart(
            name=_identifier(material, taken),
            material=material,
            rgba_linear=tuple(round(c, 4) for c in (r, g, b, a)),  # type: ignore[arg-type]
            rgba_srgb=tuple(round(c, 4) for c in srgb),  # type: ignore[arg-type]
            vertices=verts[used],
            faces=faces.astype(np.int64),
            pbr=pbrs.get(material),
            uvs=uvs,
        ))
    if not parts:
        raise MeshesUnavailableError(f"{path} has no triangles")
    return parts


class MeshLibrary:
    """A ``glb_plain/`` folder: finds and converts the model for an asset."""

    def __init__(self, glb_dir: Path, *, label: str | None = None) -> None:
        glb_dir = Path(glb_dir).expanduser()
        if not glb_dir.is_dir():
            raise MeshesUnavailableError(f"--meshes {glb_dir}: not a folder")
        if not any(glb_dir.glob("*.glb")):
            raise MeshesUnavailableError(
                f"--meshes {glb_dir}: no .glb files (expected the {GLB_FOLDER}/ folder of "
                f"{RELEASE_ASSET} from {RELEASE_REPO})"
            )
        self.glb_dir = glb_dir
        self.label = label or f"{RELEASE_REPO} {GLB_FOLDER}"
        self._cache: dict[str, CadVisual] = {}

    def _release(self, slug: str) -> CadVisual | None:
        """The release model ``<slug>.glb``, read once; None when the folder lacks it."""
        path = self.glb_dir / f"{slug}.glb"
        if not path.is_file():
            return None
        if slug not in self._cache:
            self._cache[slug] = CadVisual(
                slug=slug,
                source=(f"{NOT_IN_RELEASE[slug]}, as {slug}.glb" if slug in NOT_IN_RELEASE
                        else f"{self.label}/{slug}.glb"),
                sha256=hashlib.sha256(path.read_bytes()).hexdigest(),
                parts=tuple(read_glb(path)),
            )
        return self._cache[slug]

    def visual(self, spec: SimSpec) -> tuple[CadVisual | None, str]:
        """``(visual, note)``: the CAD for ``spec``, or None and why it is not used.

        An asset the release has no model for gets a derived one (``derived.py``): the
        shell of a release model plus its own ``sim.yaml`` parts, marked as not Atech CAD.
        """
        slug = slug_for(spec)
        if slug in NOT_IN_RELEASE and self._release(slug) is None:
            slug = None
        if slug is None:
            from atech.sim.derived import derived_board, derived_module

            def donor(name: str) -> tuple[tuple[MeshPart, ...], str] | None:
                cad = self._release(name)
                return None if cad is None else (cad.parts, cad.sha256)

            return (derived_board if spec.kind == "board" else derived_module)(spec, donor)
        cad = self._release(slug)
        if cad is None:
            return None, f"{slug}.glb not in {self.glb_dir}; boxes"
        box_lo, box_hi = bounds((p.size_m, p.pos_m) for p in spec.parts)
        cad_lo, cad_hi = cad.bounds_m
        worst = max(abs(a - b) for a, b in zip((*box_lo, *box_hi), (*cad_lo, *cad_hi), strict=True))
        if worst > BOUNDS_TOLERANCE_M:
            return None, (
                f"{slug}.glb bounds {_mm(cad_lo, cad_hi)} disagree with the sim.yaml boxes "
                f"{_mm(box_lo, box_hi)} by {worst * 1000:.1f} mm; boxes"
            )
        return cad, f"real CAD ({slug}.glb, {len(cad.parts)} materials)"


def _mm(lo: Vec3, hi: Vec3) -> str:
    return "[" + ", ".join(f"{(h - l) * 1000:.1f}" for l, h in zip(lo, hi, strict=True)) + "] mm"


# -------------------------------------------------------------------- fetch


def default_cache_dir() -> Path:
    """``$ATECH_CACHE_DIR``, else ``$XDG_CACHE_HOME/atech``, else ``~/.cache/atech``."""
    if os.environ.get("ATECH_CACHE_DIR"):
        return Path(os.environ["ATECH_CACHE_DIR"]).expanduser()
    base = os.environ.get("XDG_CACHE_HOME") or str(Path.home() / ".cache")
    return Path(base).expanduser() / "atech"


def fetch_glb_dir(
    tag: str = DEFAULT_TAG,
    *,
    cache_dir: Path | None = None,
    run: Callable[..., Any] = subprocess.run,
) -> Path:
    """Download the release's GLBs with ``gh`` once; return the cached ``glb_plain/``.

    The release is private: ``gh`` must be logged in with access to
    ``atechdotdev``. Only ``glb_plain/*.glb`` members are extracted, by base name.
    """
    if not _TAG.fullmatch(tag):
        raise MeshesUnavailableError(f"--fetch {tag!r}: not a release tag")
    target = (cache_dir or default_cache_dir()) / "module-renders" / tag / GLB_FOLDER
    if target.is_dir() and any(target.glob("*.glb")):
        return target
    gh = shutil.which("gh")
    if gh is None:
        raise MeshesUnavailableError(
            f"--fetch needs the GitHub CLI `gh`, logged in with access to {RELEASE_REPO} "
            f"(private). Or download {RELEASE_ASSET} yourself and pass --meshes <its {GLB_FOLDER}/>."
        )
    with tempfile.TemporaryDirectory() as tmp:
        cmd = [gh, "release", "download", tag, "-R", RELEASE_REPO, "-p", RELEASE_ASSET, "-D", tmp, "--clobber"]
        proc = run(cmd, capture_output=True, text=True)
        if proc.returncode != 0:
            detail = (proc.stderr or proc.stdout or "").strip()
            raise MeshesUnavailableError(
                f"`gh release download {tag} -R {RELEASE_REPO}` failed: {detail or 'no output'}. "
                f"The repo is private: `gh auth status` must show access to atechdotdev."
            )
        zip_path = Path(tmp) / RELEASE_ASSET
        if not zip_path.is_file():
            raise MeshesUnavailableError(f"gh reported success but {RELEASE_ASSET} is not in {tmp}")
        staging = target.with_name(f".{GLB_FOLDER}.partial")
        if staging.exists():
            shutil.rmtree(staging)
        staging.mkdir(parents=True)
        count = 0
        with zipfile.ZipFile(zip_path) as zf:
            for info in zf.infolist():
                parts = Path(info.filename).parts
                if info.is_dir() or GLB_FOLDER not in parts[:-1] or not parts[-1].endswith(".glb"):
                    continue
                name = Path(parts[-1]).name  # base name only: nothing escapes the folder
                with zf.open(info) as src, open(staging / name, "wb") as dst:
                    shutil.copyfileobj(src, dst)
                count += 1
        if count == 0:
            shutil.rmtree(staging)
            raise MeshesUnavailableError(f"{RELEASE_ASSET} of {tag} has no {GLB_FOLDER}/*.glb")
        if target.exists():
            shutil.rmtree(target)
        staging.rename(target)
    return target


def mesh_library(meshes: Path | None = None, fetch: str | None = None, **kwargs: Any) -> MeshLibrary | None:
    """The library for ``--meshes DIR`` / ``--fetch TAG``; None when neither is given."""
    if meshes is not None and fetch is not None:
        raise MeshesUnavailableError("pass --meshes or --fetch, not both")
    if meshes is not None:
        return MeshLibrary(Path(meshes))
    if fetch is not None:
        return MeshLibrary(fetch_glb_dir(fetch, **kwargs), label=f"{RELEASE_REPO}@{fetch} {GLB_FOLDER}")
    return None


def write_stl(part: MeshPart, path: Path) -> Path:
    """Binary STL of one part (deterministic: fixed header, no timestamps)."""
    import struct

    import numpy as np

    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    tri = part.vertices[part.faces].astype(np.float32)
    normals = np.cross(tri[:, 1] - tri[:, 0], tri[:, 2] - tri[:, 0])
    lengths = np.linalg.norm(normals, axis=1, keepdims=True)
    normals = np.divide(normals, lengths, out=np.zeros_like(normals), where=lengths > 0)
    record = np.zeros(len(tri), dtype=[("n", "<f4", 3), ("v", "<f4", (3, 3)), ("attr", "<u2")])
    record["n"], record["v"] = normals, tri
    header = f"atech sim-assets {part.material}".encode()[:80].ljust(80, b" ")
    path.write_bytes(header + struct.pack("<I", len(tri)) + record.tobytes())
    return path
