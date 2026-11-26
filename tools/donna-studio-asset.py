#!/usr/bin/env python3
"""Create Donna's procedural studio sculpture with Blender 4.3+.

SPDX-License-Identifier: MIT
All geometry, materials, lighting and camera choices are original procedural
work. No third-party textures, models, fonts or HDR environments are used.
The generated visual assets are offered under CC0-1.0.

Run from the repository root:
  blender --background --python tools/donna-studio-asset.py -- --samples 256

The script intentionally uses Cycles CPU. It does not download assets, call a
model, or represent a measured GPU benchmark. A Python installation with Pillow
is used only for PNG-to-WebP format conversion when available.
"""

import argparse
import json
import math
from pathlib import Path
import shutil
import subprocess
import sys
import time

import bpy
import _cycles
from mathutils import Vector


def args():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--samples", type=int, default=256)
    parser.add_argument("--width", type=int, default=1440)
    parser.add_argument("--time-limit", type=int, default=90)
    parser.add_argument("--output-dir", type=Path, default=Path(__file__).resolve().parents[1] / "desktop-shell/src/renderer/assets/donna-studio")
    return parser.parse_args(sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else [])


def linear(hex_color):
    values = [int(hex_color[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4 for v in values) + (1,)


def material(name, color, metal=0, roughness=0.4, transmission=0):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = linear(color)
    mat.use_nodes = True
    node = mat.node_tree.nodes.get("Principled BSDF")
    node.inputs["Base Color"].default_value = linear(color)
    node.inputs["Metallic"].default_value = metal
    node.inputs["Roughness"].default_value = roughness
    node.inputs["Transmission Weight"].default_value = transmission
    node.inputs["IOR"].default_value = 1.46
    node.inputs["Coat Weight"].default_value = 0.22
    return mat


def cube(name, location, scale, mat, bevel=0.12, rotation=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = scale
    obj.rotation_euler = tuple(math.radians(value) for value in rotation)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(mat)
    modifier = obj.modifiers.new("Soft manufactured edges", "BEVEL")
    modifier.width = bevel
    modifier.segments = 6
    modifier = obj.modifiers.new("Weighted corner normals", "WEIGHTED_NORMAL")
    modifier.keep_sharp = True
    for face in obj.data.polygons:
        face.use_smooth = True
    return obj


def sphere(name, location, radius, mat):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=32, ring_count=16, radius=radius, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(mat)
    for face in obj.data.polygons:
        face.use_smooth = True
    return obj


def rail(name, points, mat, radius=0.025):
    curve = bpy.data.curves.new(name, "CURVE")
    curve.dimensions = "3D"
    curve.resolution_u = 18
    curve.bevel_depth = radius
    curve.bevel_resolution = 3
    spline = curve.splines.new("BEZIER")
    spline.bezier_points.add(len(points) - 1)
    for point, coordinates in zip(spline.bezier_points, points):
        point.co = coordinates
        point.handle_left_type = "AUTO"
        point.handle_right_type = "AUTO"
    obj = bpy.data.objects.new(name, curve)
    bpy.context.collection.objects.link(obj)
    curve.materials.append(mat)
    return obj


def area(name, location, energy, size, color, target=(0, 0, 1.5), shape="DISK", size_y=None):
    data = bpy.data.lights.new(name, "AREA")
    data.energy = energy
    data.shape = shape
    data.size = size
    if size_y is not None:
        data.size_y = size_y
    data.color = color
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    obj.location = location
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat("-Z", "Y").to_euler()
    return obj


def main():
    config = args()
    output = config.output_dir.resolve()
    output.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.preferences.filepaths.save_version = 0
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = min(max(config.samples, 8), 256)
    denoiser_support = getattr(_cycles, "with_openimagedenoise", False)
    scene.cycles.use_denoising = bool(denoiser_support() if callable(denoiser_support) else denoiser_support)
    scene.cycles.adaptive_threshold = 0.02
    scene.cycles.time_limit = min(max(config.time_limit, 10), 180)
    scene.cycles.max_bounces = 6
    scene.cycles.transmission_bounces = 4
    scene.cycles.transparent_max_bounces = 4
    scene.cycles.seed = 31
    scene.render.threads_mode = "FIXED"
    scene.render.threads = 4
    scene.render.resolution_x = min(max(config.width, 640), 1920)
    scene.render.resolution_y = round(scene.render.resolution_x * 9 / 16)
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGB"
    scene.render.image_settings.color_depth = "8"
    scene.render.film_transparent = False
    scene.view_settings.view_transform = "AgX"
    scene.view_settings.look = "AgX - Medium High Contrast"
    scene.view_settings.exposure = 0.0
    scene.world = bpy.data.worlds.new("Night office atmosphere")
    scene.world.use_nodes = True
    scene.world.node_tree.nodes["Background"].inputs["Color"].default_value = linear("283536")
    scene.world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.20

    charcoal = material("Charcoal anodised alloy / surface", "303B3B", 0.52, 0.29)
    dark = material("Charcoal pedestal / canvas", "151E20", 0.38, 0.32)
    olive = material("Pale olive ceramic / accent", "D6ED9B", 0.12, 0.29)
    muted = material("Sage ceramic / connection", "8D9F8F", 0.18, 0.34)
    brass = material("Satin brass / detail", "DBBC7C", 0.84, 0.25)
    smoke = material("Smoked olive glass", "8EA89A", 0.0, 0.12, 0.88)
    ground = material("Night office seamless", "111719", 0.06, 0.48)

    sculpture = []
    sculpture.append(cube("Low rounded plinth", (0, 0, 0.11), (3.5, 2.8, 0.22), dark, 0.10, (0, 0, 10)))
    sculpture.append(cube("Brass inlay beneath plinth", (0, 0, 0.055), (3.32, 2.65, 0.035), brass, 0.015, (0, 0, 10)))
    # An asymmetric collection of physical modules; this is decorative sculpture,
    # never a visual claim about running jobs, agent count or neural internals.
    sculpture.append(cube("Central olive module", (0.05, -0.08, 1.73), (1.35, 1.12, 1.28), olive, 0.15, (0, 0, 14)))
    sculpture.append(cube("Central dark footing", (0.05, -0.08, 1.07), (1.13, 0.97, 0.11), charcoal, 0.035, (0, 0, 14)))
    sculpture.append(cube("Tall glass module", (1.12, 0.57, 2.73), (0.83, 0.79, 1.15), smoke, 0.11, (0, 0, -18)))
    sculpture.append(cube("Upper charcoal module", (-0.83, 0.32, 3.05), (0.87, 0.84, 0.83), charcoal, 0.11, (0, 0, -10)))
    sculpture.append(cube("Left glass module", (-1.28, -0.26, 1.25), (0.78, 0.78, 0.86), smoke, 0.10, (0, 0, 16)))
    sculpture.append(cube("Right sage module", (1.24, -0.39, 0.83), (0.82, 0.83, 0.75), muted, 0.11, (0, 0, -13)))
    sculpture.append(cube("Small olive module", (-0.27, 0.78, 0.67), (0.60, 0.59, 0.60), olive, 0.08, (0, 0, 12)))

    sculpture.append(sphere("Brass heart within high glass", (1.12, 0.57, 2.73), 0.20, brass))
    sculpture.append(sphere("Brass heart within low glass", (-1.28, -0.26, 1.25), 0.16, brass))
    sculpture.append(rail("Back sweeping rail", [(-1.28, 0.12, 0.23), (-1.67, 0.7, 1.35), (-1.15, 0.85, 2.75), (-0.84, 0.60, 3.07)], brass, 0.024))
    sculpture.append(rail("High bridge", [(-0.44, 0.36, 3.05), (0.16, 0.65, 3.47), (0.91, 0.70, 3.25), (1.12, 0.57, 2.73)], brass, 0.024))
    sculpture.append(rail("Low bridge", [(-1.28, -0.25, 1.2), (-0.78, -0.63, 0.73), (0.38, -0.71, 0.58), (1.23, -0.39, 0.85)], brass, 0.025))
    sculpture.append(rail("Core support", [(0.08, 0.15, 0.22), (0.08, 0.15, 1.10)], charcoal, 0.075))
    sculpture.append(rail("Upper connection", [(-0.62, 0.32, 2.93), (-0.38, 0.3, 2.43), (0.05, 0.15, 2.26)], brass, 0.022))
    sculpture.append(rail("Right rail", [(1.24, -0.39, 0.3), (1.71, 0.02, 1.44), (1.49, 0.63, 2.43)], brass, 0.022))
    # Three embedded ceramic details give the core a designed, tactile face.
    for index in range(3):
        sculpture.append(cube(f"Fine brass core detail {index + 1}", (-0.20 + index * 0.19, -0.626 + index * 0.047, 1.78), (0.055, 0.018, 0.32), brass, 0.008, (0, 0, 14)))

    bpy.ops.mesh.primitive_plane_add(size=200, location=(0, 0, -0.015))
    bpy.context.object.name = "Seamless dark floor"
    bpy.context.object.data.materials.append(ground)

    area("Large softbox / olive side", (-3.5, -4.0, 7.2), 1050, 5.0, (0.88, 1.0, 0.83))
    area("Tall reflected strip", (4.7, 1.5, 5.5), 1200, 3.0, (1.0, 0.86, 0.64), shape="RECTANGLE", size_y=5.0)
    area("Cool fill", (-0.7, 5.3, 4.3), 900, 4.0, (0.68, 0.84, 0.88))
    area("Front quiet fill", (2.6, -6.0, 2.8), 100, 4.0, (0.95, 0.98, 0.88))

    camera_data = bpy.data.cameras.new("Donna editorial camera")
    camera = bpy.data.objects.new("Donna editorial camera", camera_data)
    bpy.context.collection.objects.link(camera)
    camera_data.type = "ORTHO"
    camera_data.ortho_scale = 10.3
    right = Vector((14, 9, 0)).normalized()
    focal = Vector((0, 0, 1.62)) - 2.15 * right
    camera.location = focal + Vector((9, -14, 10))
    camera.rotation_euler = (focal - camera.location).to_track_quat("-Z", "Y").to_euler()
    scene.camera = camera
    scene.render.filepath = str(output / "donna-studio.png")

    # Export only the sculpture, excluding camera, floor and light rigs.
    bpy.ops.object.select_all(action="DESELECT")
    for obj in sculpture:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = sculpture[0]
    bpy.ops.object.convert(target="MESH")
    glb_exported = False
    try:
        bpy.ops.export_scene.gltf(filepath=str(output / "donna-studio.glb"), export_format="GLB", use_selection=True, export_apply=True)
        glb_exported = True
    except (AttributeError, RuntimeError) as error:
        print("Optional GLB export unavailable:", error)
    bpy.ops.object.select_all(action="DESELECT")
    bpy.ops.wm.save_as_mainfile(filepath=str(output / "donna-studio.blend"))
    started = time.monotonic()
    bpy.ops.render.render(write_still=True)
    render_seconds = round(time.monotonic() - started, 3)

    python = shutil.which("python3")
    webp_exported = False
    if python:
        conversion = subprocess.run([python, "-c", "from PIL import Image; import sys; Image.open(sys.argv[1]).save(sys.argv[2], 'WEBP', quality=94, method=6)", str(output / "donna-studio.png"), str(output / "donna-studio.webp")], capture_output=True, text=True, timeout=30)
        webp_exported = conversion.returncode == 0
        if not webp_exported:
            print("PNG-to-WebP conversion skipped:", conversion.stderr[:400])
    metadata = {
        "title": "Donna / Expert constellation",
        "purpose": "Decorative studio sculpture. Not runtime telemetry or a depiction of actual neural expert activations.",
        "creation": "Procedural Blender geometry, physically based materials, area lights and Cycles CPU rendering.",
        "blender_version": bpy.app.version_string,
        "render_engine": "CYCLES",
        "device": "CPU",
        "threads": scene.render.threads,
        "resolution": [scene.render.resolution_x, scene.render.resolution_y],
        "samples_maximum": scene.cycles.samples,
        "adaptive_threshold": scene.cycles.adaptive_threshold,
        "time_limit_seconds": scene.cycles.time_limit,
        "actual_render_wall_seconds": render_seconds,
        "denoising": scene.cycles.use_denoising,
        "color_management": "AgX / Medium High Contrast",
        "webp_exported": webp_exported,
        "glb_exported": glb_exported,
        "third_party_assets": [],
        "asset_license": "CC0-1.0",
        "source_license": "MIT",
        "source": "tools/donna-studio-asset.py",
        "palette_reference": "DESIGN.md and desktop-shell/src/renderer/studio-tokens.css",
        "composition": "16:9, sculpture on right half, left reserved for semantic HTML text.",
    }
    (output / "provenance.json").write_text(json.dumps(metadata, indent=2) + "\n")
    (output / "README.md").write_text("# Donna studio sculpture\n\nOriginal procedural artwork generated with Blender. No third-party models, textures, fonts or HDR environments are used. Visual assets are CC0-1.0; the reproducible Python source is MIT.\n\nThis is a decorative illustration, not a representation of live agent activity or measured neural expert routing. Use semantic HTML for headings, labels and real status alongside the image. The scene reserves the left portion for that content.\n\nRecreate from the repository root:\n\n```sh\nblender --background --python tools/donna-studio-asset.py -- --samples 256\n```\n\nThe script deliberately uses Cycles CPU with four threads and a bounded render time. Pillow, if installed for `python3`, creates the WebP from the PNG without changing the composition. The `.blend` contains the full editable scene; the `.glb` contains only the sculpture. See `provenance.json` for observed version and actual render settings.\n")
    print("DONNA_STUDIO_ASSET", json.dumps(metadata))


if __name__ == "__main__":
    main()
