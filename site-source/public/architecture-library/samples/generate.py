#!/usr/bin/env python3
"""Original schematic geometry. Run with Blender --background --factory-startup.

No third-party assets, network, external programs or project scripts are loaded.
The output directory must be new, absolute, and beneath symlink-free ancestors.
"""
import argparse
import hashlib
import json
import math
import os
from pathlib import Path
import random
import sys
import time

HERE = Path(__file__).resolve().parent
SEED = 20261124
GLOBAL_LIMITATIONS = [
    "Original schematic teaching study; not a measured site reconstruction or construction design.",
    "Geometry and materials illustrate relationships only. No structural, code, conservation or fabrication approval.",
    "No external textures, scans, terrain, photogrammetry, copyrighted asset packs or Google tiles are included.",
]


def digest(path):
    h = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def new_output(raw):
    path = Path(raw)
    if not path.is_absolute() or ".." in path.parts:
        raise ValueError("--output must be an absolute path without parent traversal")
    for ancestor in [*reversed(path.parents), path]:
        if ancestor.is_symlink():
            raise ValueError("--output and its ancestors must not be symlinks")
    if not path.parent.is_dir():
        raise ValueError("--output parent must already be a directory")
    # mkdir is exclusive: even an empty existing destination is never reused.
    path.mkdir(mode=0o755, exist_ok=False)
    return path


def material(name, rgb):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*rgb, 1)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*rgb, 1)
    bsdf.inputs["Roughness"].default_value = 0.78
    return mat


def attach(obj, name, mat):
    obj.name = name
    obj.data.materials.append(MATS[mat])
    obj["purpose"] = "original schematic teaching geometry"
    return obj


def box(name, location, size, mat="stone"):
    bpy.ops.mesh.primitive_cube_add(size=1, location=location)
    obj = attach(bpy.context.object, name, mat)
    obj.dimensions = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return obj


def mesh(name, vertices, faces, mat="stone"):
    data = bpy.data.meshes.new(name)
    data.from_pydata(vertices, [], faces)
    data.update()
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    return attach(obj, name, mat)


def cylinder(name, location, radius, depth, mat="stone", vertices=20, top=None):
    bpy.ops.mesh.primitive_cone_add(vertices=vertices, radius1=radius,
        radius2=radius if top is None else top, depth=depth, location=location)
    return attach(bpy.context.object, name, mat)


def beam(name, a, b, width=0.12, mat="steel", depth=None):
    a, b = Vector(a), Vector(b)
    obj = box(name, (a + b) / 2, (width, depth or width, (b - a).length), mat)
    obj.rotation_mode = "QUATERNION"
    obj.rotation_quaternion = (b - a).to_track_quat("Z", "Y")
    return obj


def line(name, points, width=0.12, mat="steel"):
    for i, (a, b) in enumerate(zip(points, points[1:])):
        beam(f"{name}_{i:02}", a, b, width, mat)


def frustum(name, base, top, z, height, mat="stone"):
    vertices = [(x * side / 2, y * side / 2, level)
        for side, level in [(base, z), (top, z + height)]
        for x, y in [(-1, -1), (1, -1), (1, 1), (-1, 1)]]
    return mesh(name, vertices, [(0, 3, 2, 1), (4, 5, 6, 7),
        (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)], mat)


def wedge(name, radius, thickness, start, end, z, y, length, mat="stone", angle=0, center=(0, 0)):
    vertices = []
    for yy in [y - length / 2, y + length / 2]:
        for r, t in [(radius, start), (radius, end), (radius + thickness, end), (radius + thickness, start)]:
            x, zed = r * math.cos(t), z + r * math.sin(t)
            vertices.append((center[0] + x * math.cos(angle) - yy * math.sin(angle),
                center[1] + x * math.sin(angle) + yy * math.cos(angle), zed))
    return mesh(name, vertices, [(0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4),
        (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)], mat)


def arch(name, radius, z, y=0, length=0.45, segments=13, angle=0, center=(0, 0), thickness=0.3):
    for j in range(segments):
        wedge(f"{name}_voussoir_{j:02}", radius, thickness,
            j * math.pi / segments + 0.004, (j + 1) * math.pi / segments - 0.004,
            z, y, length, "accent" if j == segments // 2 else "stone", angle, center)


def ring_model(p):
    n, r, h = p["posts"], p["radius"], p["postHeight"]
    points = []
    for i in range(n):
        t = i * math.tau / n
        x, y = r * math.cos(t), r * math.sin(t)
        obj = box(f"upright_{i:02}", (x, y, h / 2), (0.7, 0.85, h))
        obj.rotation_euler.z = t
        points.append((x, y, h + 0.27))
    for i in range(n):
        beam(f"lintel_{i:02}", points[i], points[(i + 1) % n], 0.52, "stone", 0.72)


def stepped(p):
    h = p["height"] / p["tiers"]
    for i in range(p["tiers"]):
        side = p["base"] * (1 - i * 0.135)
        box(f"tier_{i + 1}", (0, 0, (i + 0.5) * h), (side, side, h))


def pyramid(p):
    b = p["base"] / 2
    mesh("four_faces", [(-b, -b, 0), (b, -b, 0), (b, b, 0), (-b, b, 0), (0, 0, p["height"])],
        [(0, 3, 2, 1), (0, 1, 4), (1, 2, 4), (2, 3, 4), (3, 0, 4)])


def terrace(p):
    rise = p["height"] / p["tiers"]
    for i in range(p["tiers"]):
        base = p["base"] - i * 1.35
        frustum(f"platform_{i + 1}", base, base - 0.6, i * rise, rise)
    run = p["base"] / 2 - 1.0
    for i in range(p["stairs"]):
        z = (i + 1) * p["height"] / p["stairs"]
        y = -p["base"] / 2 - 0.7 + (i + 0.5) * run / p["stairs"]
        box(f"stair_{i + 1:02}", (0, y, z / 2), (2.0, run / p["stairs"] + 0.012, z), "accent")
    z = p["height"]
    for x in [-1.2, 1.2]:
        for y in [-1.2, 1.2]:
            box("summit_post", (x, y, z + 0.7), (0.3, 0.3, 1.4))
    box("summit_canopy", (0, 0, z + 1.5), (3.0, 3.0, 0.25), "stoneLight")


def colonnade(p):
    n, spacing, h = p["columnsPerRow"], p["spacing"], p["columnHeight"]
    width = (n - 1) * spacing + 1.9
    for j in range(2):
        box(f"stylobate_{j}", (0, 0, 0.12 + j * 0.18), (width - j * 0.35, 4.8 - j * 0.35, 0.18))
    for i in range(n):
        for y in [-1.4, 1.4]:
            x = (i - (n - 1) / 2) * spacing
            cylinder("tapered_shaft", (x, y, 0.39 + h / 2), 0.34, h, top=0.28)
            cylinder("capital_echinus", (x, y, h + 0.49), 0.3, 0.2, top=0.45, mat="stoneLight")
            box("capital_abacus", (x, y, h + 0.64), (0.95, 0.95, 0.13), "stoneLight")
    for y in [-1.4, 1.4]:
        box("architrave", (0, y, h + 0.85), (width - 0.7, 0.72, 0.3))
        box("frieze", (0, y, h + 1.12), (width - 0.65, 0.76, 0.24), "accent")
        box("cornice", (0, y, h + 1.3), (width - 0.35, 1.0, 0.14), "stoneLight")


def barrel(p):
    r, z, length = p["radius"], p["springHeight"], p["length"]
    for x in [-r - 0.23, r + 0.23]:
        box("support_wall", (x, 0, z / 2), (0.55, length, z))
    for i in range(p["rings"]):
        arch(f"ring_{i:02}", r, z, -length / 2 + (i + 0.5) * length / p["rings"],
            length / p["rings"] - 0.025, p["voussoirs"])


def dome(p):
    r, z, thickness = p["radius"], p["springHeight"], p["thickness"]
    count, rings = 48, 12
    theta0 = math.asin(p["oculusRadius"] / r)
    vertices, faces = [], []
    for radius in [r, r + thickness]:
        for i in range(rings + 1):
            t = theta0 + (math.pi / 2 - theta0) * i / rings
            for j in range(count):
                a = math.tau * j / count
                vertices.append((radius * math.sin(t) * math.cos(a), radius * math.sin(t) * math.sin(a), z + radius * math.cos(t)))
    layer = (rings + 1) * count
    for offset in [0, layer]:
        for i in range(rings):
            for j in range(count):
                a, b = offset + i * count + j, offset + i * count + (j + 1) % count
                face = (a, b, b + count, a + count)
                faces.append(tuple(reversed(face)) if offset == layer else face)
    for i in [0, rings]:
        for j in range(count):
            a, b = i * count + j, i * count + (j + 1) % count
            face = (a, a + layer, b + layer, b)
            faces.append(tuple(reversed(face)) if i == rings else face)
    mesh("dome_shell_with_open_oculus", vertices, faces, "accent")
    # Leave a front display gap in the drum; it is declared in the limitations.
    for i in range(36):
        angle = math.tau * i / 36
        if abs((angle + math.pi / 2 + math.pi) % math.tau - math.pi) < 0.57:
            continue
        rr = r + thickness / 2
        obj = box("drum_segment", (rr * math.cos(angle), rr * math.sin(angle), z / 2), (0.58, 0.36, z))
        obj.rotation_euler.z = angle + math.pi / 2


def pointed(name, a, b, rise, segments):
    points = []
    for i in range(segments + 1):
        t = i / segments
        v = Vector(a).lerp(Vector(b), t)
        v.z += rise * math.sqrt(max(0, 1 - (0.5 + abs(t - 0.5)) ** 2)) / math.sqrt(0.75)
        points.append(v)
    line(name, points, 0.16, "accent")


def gothic(p):
    b, z = p["bay"] / 2, p["springHeight"]
    corners = [(-b, -b, z), (b, -b, z), (b, b, z), (-b, b, z)]
    for x, y, _ in corners:
        box("pier", (x, y, z / 2), (0.45, 0.45, z))
        box("springer", (x, y, z), (0.62, 0.62, 0.16), "stoneLight")
    for i in range(4):
        pointed(f"edge_arch_{i}", corners[i], corners[(i + 1) % 4], p["rise"], p["ribSegments"])
    for i in range(2):
        pointed(f"diagonal_rib_{i}", corners[i], corners[i + 2], p["rise"], p["ribSegments"])
    for sign in [-1, 1]:
        for y in [-b, b]:
            x = sign * (b + 1.7)
            box("outer_buttress", (x, y, 1.5), (0.65, 0.65, 3.0))
            cylinder("buttress_pinnacle", (x, y, 3.35), 0.38, 0.7, "stoneLight", 4, 0.02)
            points = []
            for i in range(10):
                t = i / 9
                points.append((x + (sign * b - x) * t, y, 2.8 + 1.6 * t + 0.25 * math.sin(math.pi * t)))
            line("flying_buttress", points, 0.25, "stone")


def vimana(p):
    base = p["base"]
    box("sanctum_massing", (0, 0, 1.0), (base, base, 2.0))
    box("entry_recess_marker", (0, -base / 2 - 0.01, 0.9), (0.9, 0.025, 1.4), "shadow")
    for i in range(p["tiers"]):
        size = base * (1 - i * 0.105)
        z = 2.0 + i * p["tierHeight"]
        frustum(f"diminishing_tala_{i + 1}", size, size - 0.3, z, p["tierHeight"])
        box("projecting_cornice", (0, 0, z + p["tierHeight"] - 0.05), (size + 0.15, size + 0.15, 0.12), "stoneLight")
        for x in [-size / 2 + 0.12, size / 2 - 0.12]:
            for y in [-size / 2 + 0.12, size / 2 - 0.12]:
                box("abstract_corner_pilaster", (x, y, z + 0.22), (0.18, 0.18, 0.4), "accent")
    z = 2 + p["tiers"] * p["tierHeight"]
    cylinder("abstract_octagonal_crown", (0, 0, z + 0.28), 0.84, 0.56, "stoneLight", 8, 0.38)
    cylinder("finial", (0, 0, z + 0.73), 0.15, 0.4, "accent", 12, 0.06)


def timber(p):
    w, d, h = p["width"], p["depth"], p["postHeight"]
    for x in [-w / 2, 0, w / 2]:
        for y in [-d / 2, d / 2]:
            cylinder("timber_column", (x, y, h / 2), 0.13, h, "wood")
            cylinder("stone_foot", (x, y, 0.08), 0.23, 0.16, "stoneLight")
            for j in range(p["bracketLevels"]):
                z = h + j * 0.18
                box("bearing_block", (x, y, z + 0.03), (0.25, 0.25, 0.16), "accent")
                box("bracket_arm_x", (x, y, z + 0.12), (0.5 + j * 0.3, 0.16, 0.13), "wood")
                box("bracket_arm_y", (x, y, z + 0.13), (0.16, 0.5 + j * 0.3, 0.13), "wood")
    z = h + 0.6
    for y in [-d / 2, d / 2]:
        beam("longitudinal_beam", (-w / 2 - 0.2, y, z), (w / 2 + 0.2, y, z), 0.19, "wood")
    for x in [-w / 2, 0, w / 2]:
        beam("cross_beam", (x, -d / 2, z), (x, d / 2, z), 0.2, "wood")
    width, halfdepth = w + 1.4, d / 2 + 0.9
    for side in [-1, 1]:
        points = []
        for j in range(6):
            t = j / 5
            y = side * halfdepth * t
            roofz = z + 0.9 * (1 - t) + 0.28 * t ** 4
            points.append((y, roofz))
            beam("purlin", (-width / 2, y, roofz - 0.08), (width / 2, y, roofz - 0.08), 0.09, "wood")
        # Keep the near roof covering open so the bracket system is visible.
        for j in range(5 if side == 1 else 0):
            y1, z1 = points[j]
            y2, z2 = points[j + 1]
            mesh("roof_strip", [(-width / 2, y1, z1), (width / 2, y1, z1),
                (width / 2, y2, z2), (-width / 2, y2, z2)], [(0, 1, 2, 3)], "roof")


def courtyard(p):
    n, span, z = p["baysPerSide"], p["span"], p["springHeight"]
    size = n * span
    for side in range(4):
        angle = side * math.pi / 2
        center = (size / 2 * math.sin(angle), -size / 2 * math.cos(angle))
        for j in range(n):
            offset = (j - (n - 1) / 2) * span
            cc = (center[0] + offset * math.cos(angle), center[1] + offset * math.sin(angle))
            arch(f"arcade_{side}_{j}", span / 2 - 0.15, z, length=0.35, segments=9, angle=angle, center=cc, thickness=0.2)
        for j in range(n):
            offset = j * span - size / 2
            x, y = center[0] + offset * math.cos(angle), center[1] + offset * math.sin(angle)
            cylinder("arcade_column", (x, y, z / 2), 0.15, z, "stoneLight", 16)
        a = (center[0] - size / 2 * math.cos(angle), center[1] - size / 2 * math.sin(angle), z + span / 2 + 0.13)
        b = (center[0] + size / 2 * math.cos(angle), center[1] + size / 2 * math.sin(angle), z + span / 2 + 0.13)
        beam("arcade_coping", a, b, 0.22, "stone", 0.5)
    box("open_court_marker", (0, 0, 0.015), (size - 1.1, size - 1.1, 0.03), "court")


def diagrid(p):
    w, h = p["width"] / 2, p["height"]
    corners = [(-w, -w), (w, -w), (w, w), (-w, w)]
    for floor in range(p["floors"] + 1):
        box("floor_plate", (0, 0, h * floor / p["floors"] + 0.05), (2 * w, 2 * w, 0.1), "stoneLight")
    box("core_marker", (0, 0, h / 2), (0.7, 0.7, h), "accent")
    for module in range(p["modules"]):
        lo, hi = module * h / p["modules"], (module + 1) * h / p["modules"]
        for side in range(4):
            a, b = corners[side], corners[(side + 1) % 4]
            beam("diagonal_rising", (*a, lo), (*b, hi), 0.16, "steel")
            beam("diagonal_falling", (*b, lo), (*a, hi), 0.16, "steel")
            beam("perimeter_tie", (*a, hi), (*b, hi), 0.14, "steel")


def gridshell(p):
    n, width, depth = p["grid"], p["width"], p["depth"]
    nodes = {}
    for i in range(n):
        for j in range(n):
            u, v = 2 * i / (n - 1) - 1, 2 * j / (n - 1) - 1
            nodes[i, j] = (u * width / 2, v * depth / 2, 2.5 + p["rise"] * (1 - u * u) * (1 - v * v))
    for i in range(n):
        line(f"lath_u_{i}", [nodes[i, j] for j in range(n)], 0.1, "wood")
        line(f"lath_v_{i}", [nodes[j, i] for j in range(n)], 0.1, "accent")
    corners = [nodes[0, 0], nodes[n - 1, 0], nodes[n - 1, n - 1], nodes[0, n - 1]]
    for i, a in enumerate(corners):
        beam("edge_support", a, corners[(i + 1) % 4], 0.2, "steel")
        beam("corner_column", (a[0], a[1], 0), a, 0.2, "steel")


def spaceframe(p):
    n, spacing, height, depth = p["grid"], p["spacing"], p["supportHeight"], p["depth"]
    top, bottom = {}, {}
    for i in range(n):
        for j in range(n):
            top[i, j] = ((i - (n - 1) / 2) * spacing, (j - (n - 1) / 2) * spacing, height + depth)
    for i in range(n - 1):
        for j in range(n - 1):
            bottom[i, j] = ((i - (n - 2) / 2) * spacing, (j - (n - 2) / 2) * spacing, height)
            for a, b in [(i, j), (i + 1, j), (i, j + 1), (i + 1, j + 1)]:
                beam("web_diagonal", bottom[i, j], top[a, b], 0.065, "accent")
    for label, nodes in [("upper", top), ("lower", bottom)]:
        for (i, j), point in nodes.items():
            bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=0.1, location=point)
            attach(bpy.context.object, f"{label}_node", "stoneLight")
            for key in [(i + 1, j), (i, j + 1)]:
                if key in nodes:
                    beam(f"{label}_chord", point, nodes[key], 0.075, "steel")
    for key in [(0, 0), (n - 2, 0), (n - 2, n - 2), (0, n - 2)]:
        x, y, z = bottom[key]
        beam("support_column", (x, y, 0), (x, y, z), 0.18, "steel")


BUILDERS = {
    "megalithic-ring": ring_model, "egyptian-stepped-pyramid": stepped,
    "egyptian-smooth-pyramid": pyramid, "mesoamerican-terrace-stair": terrace,
    "classical-colonnade": colonnade, "arch-barrel-vault": barrel,
    "dome-oculus": dome, "gothic-rib-buttress": gothic, "dravida-tower": vimana,
    "chinese-timber-bracket-bay": timber, "courtyard-arcade": courtyard,
    "modern-diagrid": diagrid, "gridshell-canopy": gridshell, "space-frame": spaceframe,
}


def metrics():
    bpy.context.view_layer.update()
    objects = sorted((o for o in bpy.context.scene.objects if o.type == "MESH"), key=lambda o: o.name)
    points, triangles, vertices, geometry = [], 0, 0, []
    for obj in objects:
        obj.data.calc_loop_triangles()
        coords = [tuple(round(c, 7) for c in obj.matrix_world @ v.co) for v in obj.data.vertices]
        if not all(math.isfinite(c) for point in coords for c in point):
            raise ValueError("Non-finite generated coordinate")
        if any(t.area < 1e-10 for t in obj.data.loop_triangles):
            raise ValueError(f"Degenerate triangle in {obj.name}")
        points.extend(coords)
        triangles += len(obj.data.loop_triangles)
        vertices += len(obj.data.vertices)
        geometry.append([obj.name, coords, [list(t.vertices) for t in obj.data.loop_triangles]])
    lo = [min(p[i] for p in points) for i in range(3)]
    hi = [max(p[i] for p in points) for i in range(3)]
    return {"objectCount": len(objects), "vertexCount": vertices, "triangleCount": triangles,
        "dimensionsMeters": [round(b - a, 6) for a, b in zip(lo, hi)],
        "boundsMeters": {"min": lo, "max": hi},
        "geometrySha256": hashlib.sha256(json.dumps(geometry, separators=(",", ":")).encode()).hexdigest()}


def setup_preview(scene, bounds, config):
    lo, hi = Vector(bounds["min"]), Vector(bounds["max"])
    center, size = (lo + hi) / 2, max(hi - lo)
    bpy.ops.object.camera_add(location=center + Vector((1.35, -1.8, 1.35)) * size)
    camera = bpy.context.object
    camera.name = "PREVIEW_camera"
    camera.rotation_euler = (center - camera.location).to_track_quat("-Z", "Y").to_euler()
    camera.data.type = "ORTHO"
    camera.data.ortho_scale = size * 1.6
    camera.data.clip_end = size * 20
    scene.camera = camera
    for name, direction, power in [("key", (-0.7, -1, 1.8), 75), ("fill", (1.5, 0.7, 1), 45)]:
        bpy.ops.object.light_add(type="AREA", location=center + Vector(direction) * size)
        light = bpy.context.object
        light.name = "PREVIEW_" + name
        light.data.energy = size * size * power
        light.data.shape = "DISK"
        light.data.size = size * 1.1
        light.rotation_euler = (center - light.location).to_track_quat("-Z", "Y").to_euler()
    scene.world.use_nodes = True
    scene.world.node_tree.nodes["Background"].inputs[0].default_value = (0.065, 0.085, 0.115, 1)
    scene.world.node_tree.nodes["Background"].inputs[1].default_value = 0.4
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = config["samples"]
    scene.cycles.seed = SEED
    scene.cycles.use_denoising = True
    scene.render.threads_mode = "FIXED"
    scene.render.threads = config["threads"]
    scene.render.resolution_x = config["width"]
    scene.render.resolution_y = config["height"]
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGB"
    scene.render.image_settings.compression = 90
    scene.view_settings.view_transform = "AgX"


def generate(preset, root, config):
    global MATS
    started = time.monotonic()
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.world = bpy.data.worlds.new("Procedural studio world")
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.scale_length = 1.0
    scene.unit_settings.length_unit = "METERS"
    random.seed(SEED)
    MATS = {name: material(name, rgb) for name, rgb in {
        "stone": (0.64, 0.50, 0.33), "stoneLight": (0.82, 0.75, 0.61),
        "accent": (0.16, 0.44, 0.44), "steel": (0.17, 0.26, 0.32),
        "wood": (0.40, 0.21, 0.095), "roof": (0.20, 0.32, 0.33),
        "court": (0.28, 0.38, 0.36), "shadow": (0.085, 0.10, 0.13),
        "plinth": (0.15, 0.19, 0.24)}.items()}
    BUILDERS[preset["id"]](preset["parameters"])
    model = metrics()
    lo, hi = model["boundsMeters"]["min"], model["boundsMeters"]["max"]
    box("DISPLAY_plinth", ((lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, -0.09),
        (hi[0] - lo[0] + 0.8, hi[1] - lo[1] + 0.8, 0.18), "plinth")
    info = metrics()
    if info["triangleCount"] > 20000 or info["objectCount"] > 400:
        raise ValueError("Sample geometry budget exceeded")
    setup_preview(scene, info["boundsMeters"], config["render"])
    scene["study_id"] = preset["id"]
    scene["source_kind"] = "original-procedural-schematic"
    scene["limitations"] = " | ".join(GLOBAL_LIMITATIONS + preset["limitations"])
    target = root / preset["id"]
    target.mkdir()
    bpy.ops.object.select_all(action="DESELECT")
    for obj in scene.objects:
        if obj.type == "MESH":
            obj.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(target / "sample.glb"), export_format="GLB",
        use_selection=True, export_yup=True, export_animations=False, export_cameras=False,
        export_lights=False, export_extras=True, export_apply=True)
    scene.render.filepath = str(target / "preview.png")
    bpy.ops.render.render(write_still=True)
    # Save only portable relative output references, never scratch/user paths.
    scene.render.filepath = "//preview.png"
    bpy.ops.wm.save_as_mainfile(filepath=str(target / "sample.blend"), compress=True, check_existing=False)
    files = {kind: {"path": f"samples/generated/{preset['id']}/{filename}",
        "bytes": (target / filename).stat().st_size, "sha256": digest(target / filename)}
        for kind, filename in [("blend", "sample.blend"), ("glb", "sample.glb"), ("preview", "preview.png")]}
    info.update({"schemaVersion": 1, "id": preset["id"], "name": preset["name"],
        "sourceKind": "original-procedural-schematic", "isSiteReconstruction": False,
        "isConstructionDesign": False, "units": "metres", "blenderCoordinates": "right-handed Z-up",
        "glbCoordinates": "right-handed Y-up (Blender glTF axis conversion)",
        "dimensionsIncludeDisplayPlinth": True, "seed": SEED, "parameters": preset["parameters"],
        "blenderVersion": bpy.app.version_string, "blenderBuildHash": bpy.app.build_hash.decode(),
        "generatorSha256": digest(HERE / "generate.py"), "presetsSha256": digest(HERE / "presets.json"),
        "sourceIds": preset["sourceIds"], "elementIds": preset["elementIds"], "externalAssets": [],
        "limitations": GLOBAL_LIMITATIONS + preset["limitations"], "files": files,
        "render": dict(config["render"], device="CPU"), "generationSeconds": round(time.monotonic() - started, 3),
        "validation": {"finiteCoordinates": True, "nondegenerateTriangles": True,
            "budgetPassed": True, "fileReopenStatus": "See inspection.json for independent reopen results"}})
    (target / "metadata.json").write_text(json.dumps(info, indent=2) + "\n", encoding="utf-8")
    return info


def main():
    global bpy, Vector
    args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", help="New absolute destination; its parent must exist")
    parser.add_argument("--ids", default="all", help="all or comma-separated preset IDs")
    parser.add_argument("--list", action="store_true", help="List presets without creating output")
    options = parser.parse_args(args)
    config = json.loads((HERE / "presets.json").read_text(encoding="utf-8"))
    if options.list:
        print(json.dumps({"seed": SEED, "presets": config["presets"]}, indent=2))
        return
    if not options.output:
        parser.error("--output is required unless --list is used")
    ids = list(BUILDERS) if options.ids == "all" else options.ids.split(",")
    if len(set(ids)) != len(ids) or any(id_ not in BUILDERS for id_ in ids):
        parser.error("Unknown or duplicate sample ID")
    import bpy
    from mathutils import Vector
    if bpy.app.version[:2] != (4, 5):
        raise ValueError("Validated generator requires Blender 4.5.x")
    root = new_output(options.output)
    started, records = time.monotonic(), []
    try:
        for preset in config["presets"]:
            if preset["id"] not in ids:
                continue
            record = generate(preset, root, config)
            records.append(record)
            total = sum(p.stat().st_size for p in root.rglob("*") if p.is_file())
            if total > 8_000_000:
                raise ValueError(f"Collection artifact budget exceeded: {total} bytes")
            print("SAMPLE_READY " + json.dumps({"id": record["id"], "triangles": record["triangleCount"], "collectionBytes": total}), flush=True)
    except Exception as error:
        (root / "generation-failed.json").write_text(json.dumps({"status": "failed", "completedIds": [r["id"] for r in records], "error": str(error)}, indent=2) + "\n")
        raise
    manifest = {"schemaVersion": 1, "status": "generated", "sourceKind": "original-procedural-schematic",
        "seed": SEED, "blenderVersion": bpy.app.version_string, "sampleCount": len(records),
        "generationSeconds": round(time.monotonic() - started, 3), "externalAssets": [],
        "files": [{"path": f"samples/generated/{p.relative_to(root).as_posix()}", "bytes": p.stat().st_size,
            "sha256": digest(p)} for p in sorted(root.rglob("*")) if p.is_file()],
        "limitations": GLOBAL_LIMITATIONS,
        "validation": "Generated and checked in memory; run verify_samples.py to reopen every blend and GLB."}
    manifest["totalArtifactBytes"] = sum(row["bytes"] for row in manifest["files"])
    (root / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print("GENERATION_COMPLETE " + json.dumps({k: manifest[k] for k in ["sampleCount", "totalArtifactBytes", "generationSeconds"]}), flush=True)


if __name__ == "__main__":
    main()
