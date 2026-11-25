#!/usr/bin/env python3
"""Build reviewed local footprints using Blender 4.5; fixed operations, no network."""
import argparse
from datetime import datetime, timezone
import hashlib
import json
import math
import os
from pathlib import Path
import stat
import struct
import sys

sys.dont_write_bytecode = True
HERE = Path(__file__).absolute().parent
sys.path.insert(0, str(HERE))
from footprints import (FootprintError, load_plan, new_output_directory, read_regular,
                        sha256, write_receipt)

MAX_ARTIFACT_BYTES = 1_000_000
PALETTE = [(0.19, 0.43, 0.56), (0.70, 0.42, 0.20), (0.26, 0.55, 0.43), (0.48, 0.50, 0.65)]


def artifact(directory_fd, name, media_type):
    fd = os.open(name, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK, dir_fd=directory_fd)
    try:
        before = os.fstat(fd)
        if not stat.S_ISREG(before.st_mode) or not 0 < before.st_size < MAX_ARTIFACT_BYTES:
            raise FootprintError("Generated artifact is not a bounded regular file")
        digest = hashlib.sha256()
        count = 0
        while True:
            data = os.read(fd, 65536)
            if not data:
                break
            count += len(data)
            if count > MAX_ARTIFACT_BYTES:
                raise FootprintError("Generated artifact grew beyond its bound")
            digest.update(data)
        after = os.fstat(fd)
        if count != before.st_size or any(
            getattr(before, field) != getattr(after, field)
            for field in ("st_size", "st_mtime_ns", "st_ctime_ns")
        ):
            raise FootprintError("Generated artifact changed during hashing")
        return {"path": name, "bytes": count, "sha256": digest.hexdigest(), "mediaType": media_type}
    finally:
        os.close(fd)


def inspect_glb(directory_fd, expected_ids):
    fd = os.open("city-block.glb", os.O_RDONLY | os.O_NOFOLLOW, dir_fd=directory_fd)
    try:
        with os.fdopen(fd, "rb", closefd=False) as source:
            data = source.read(MAX_ARTIFACT_BYTES + 1)
    finally:
        os.close(fd)
    if not 20 <= len(data) <= MAX_ARTIFACT_BYTES:
        raise FootprintError("Invalid bounded GLB")
    magic, version, length = struct.unpack_from("<4sII", data)
    if magic != b"glTF" or version != 2 or length != len(data):
        raise FootprintError("Invalid GLB header")
    chunks, offset = [], 12
    while offset < length:
        if offset + 8 > length:
            raise FootprintError("Truncated GLB chunk")
        size, kind = struct.unpack_from("<I4s", data, offset)
        offset += 8
        if size % 4 or offset + size > length:
            raise FootprintError("Invalid GLB chunk bound")
        chunks.append((kind, data[offset:offset + size]))
        offset += size
    if [kind for kind, _ in chunks] != [b"JSON", b"BIN\x00"]:
        raise FootprintError("Expected one embedded JSON and binary GLB chunk")
    model = json.loads(chunks[0][1].decode("utf-8"))
    if any("uri" in item for item in model.get("buffers", []) + model.get("images", [])):
        raise FootprintError("Exported GLB must not depend on external files")
    nodes = [node for node in model.get("nodes", []) if "mesh" in node]
    if {node.get("extras", {}).get("source_feature_id") for node in nodes} != expected_ids or len(nodes) != len(expected_ids):
        raise FootprintError("GLB feature identities do not match the reviewed input")
    triangles = positions = 0
    for mesh in model.get("meshes", []):
        for primitive in mesh["primitives"]:
            count = model["accessors"][primitive["indices"]]["count"]
            if primitive.get("mode", 4) != 4 or type(count) is not int or count % 3:
                raise FootprintError("Expected indexed GLB triangles")
            triangles += count // 3
            positions += model["accessors"][primitive["attributes"]["POSITION"]]["count"]
    return {"version": version, "meshCount": len(model.get("meshes", [])),
            "buildingNodes": len(nodes), "triangles": triangles,
            "primitivePositionVertices": positions, "externalResources": 0}


def build(plan, ledger, directory_fd, preview):
    import bpy
    import bmesh
    from mathutils import Vector

    if bpy.app.version[:2] != (4, 5):
        raise FootprintError("This reviewed example requires Blender 4.5.x")
    if not sys.platform.startswith("linux") or not Path(f"/proc/self/fd/{directory_fd}").is_dir():
        raise FootprintError("This build entry point requires Linux /proc directory descriptors")
    destination = f"/proc/self/fd/{directory_fd}"
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.preferences.filepaths.use_scripts_auto_execute = False
    scene = bpy.context.scene
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.scale_length = 1
    scene.unit_settings.length_unit = "METERS"
    scene["dataset_id"] = plan["datasetId"]
    scene["input_crs"] = "EPSG:4326; GeoJSON longitude,latitude"
    scene["projection"] = json.dumps(plan["projection"], separators=(",", ":"))
    scene["rights_ledger_sha256"] = plan["inputs"]["ledger"]["sha256"]
    scene["synthetic"] = plan["synthetic"]
    scene["purpose"] = "Reviewed offline footprint massing; not a survey or detailed architecture"

    def material(name, color):
        result = bpy.data.materials.new(name)
        result.use_nodes = True
        result.diffuse_color = (*color, 1)
        shader = result.node_tree.nodes.get("Principled BSDF")
        shader.inputs["Base Color"].default_value = (*color, 1)
        shader.inputs["Roughness"].default_value = 0.82
        return result

    materials = [material(f"original_palette_{i}", color) for i, color in enumerate(PALETTE)]
    building_objects, geometry_checks = [], []
    for index, building in enumerate(plan["buildings"]):
        curve = bpy.data.curves.new(f"footprint_{building['id']}", "CURVE")
        curve.dimensions = "2D"
        curve.resolution_u = 1
        curve.fill_mode = "BOTH"
        curve.bevel_depth = 0
        curve.use_fill_caps = True
        curve.extrude = building["heightMeters"] / 2
        for polygon in building["polygons"]:
            for ring in polygon["rings"]:
                spline = curve.splines.new("POLY")
                spline.points.add(len(ring) - 1)
                for target, (x, y) in zip(spline.points, ring):
                    target.co = (x, y, 0, 1)
                spline.use_cyclic_u = True
        obj = bpy.data.objects.new(f"building_{building['id']}", curve)
        scene.collection.objects.link(obj)
        obj.location.z = building["heightMeters"] / 2
        obj.data.materials.append(materials[index % len(materials)])
        obj["source_feature_id"] = building["id"]
        obj["source_label"] = building["name"]
        obj["height_basis"] = building["heightBasis"]
        obj["height_meters"] = building["heightMeters"]
        obj["dataset_id"] = plan["datasetId"]
        obj["license_id"] = ledger["rights"]["licenseId"]
        obj["source_sha256"] = plan["inputs"]["geojson"]["sha256"]
        obj["synthetic"] = plan["synthetic"]
        bpy.ops.object.select_all(action="DESELECT")
        obj.select_set(True)
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.convert(target="MESH")
        obj = bpy.context.object
        obj.data.update()

        # Real mesh acceptance catches accidental courtyard filling or missing caps.
        mesh = bmesh.new()
        try:
            mesh.from_mesh(obj.data)
            # Curve conversion can duplicate coincident cap/side vertices.
            # 0.1mm accommodates Blender float32 conversion at this bounded scale.
            # It remains 500 times smaller than the minimum accepted input edge.
            bmesh.ops.remove_doubles(mesh, verts=list(mesh.verts), dist=1e-4)
            bmesh.ops.recalc_face_normals(mesh, faces=list(mesh.faces))
            if not mesh.faces or not all(edge.is_manifold for edge in mesh.edges):
                bad_edges = sum(not edge.is_manifold for edge in mesh.edges)
                raise FootprintError(f"Generated building {building['id']} is not closed: {bad_edges} nonmanifold edges")
            actual_volume = abs(mesh.calc_volume(signed=True))
            mesh.to_mesh(obj.data)
            obj.data.update()
        finally:
            mesh.free()
        expected_volume = sum(polygon["areaSquareMeters"] for polygon in building["polygons"]) * building["heightMeters"]
        relative_error = abs(actual_volume - expected_volume) / expected_volume
        if not math.isfinite(actual_volume) or relative_error > 1e-4:
            raise FootprintError("Generated footprint volume does not match its exterior minus holes")
        geometry_checks.append({
            "featureId": building["id"],
            "meshVertices": len(obj.data.vertices),
            "meshFaces": len(obj.data.polygons),
            "closedManifold": True,
            "expectedVolumeCubicMeters": expected_volume,
            "actualVolumeCubicMeters": actual_volume,
            "relativeVolumeError": relative_error,
        })
        building_objects.append(obj)

    xmin, xmax = plan["boundsMeters"]["x"]
    ymin, ymax = plan["boundsMeters"]["y"]
    center = Vector(((xmin + xmax) / 2, (ymin + ymax) / 2, 0))
    span = max(xmax - xmin, ymax - ymin, 30)
    highest = max(item["heightMeters"] for item in plan["buildings"])

    # Presentation ground is original schematic geometry and excluded from GLB.
    ground_data = bpy.data.meshes.new("original_presentation_ground")
    margin = span * 0.12
    ground_data.from_pydata(
        [(xmin - margin, ymin - margin, -0.1), (xmax + margin, ymin - margin, -0.1),
         (xmax + margin, ymax + margin, -0.1), (xmin - margin, ymax + margin, -0.1)],
        [], [(0, 1, 2, 3)])
    ground_data.update()
    ground = bpy.data.objects.new("presentation_ground_not_dem", ground_data)
    scene.collection.objects.link(ground)
    ground.data.materials.append(material("original_ground", (0.13, 0.17, 0.20)))
    ground["purpose"] = "Original presentation plane; no terrain or map source"

    camera_data = bpy.data.cameras.new("preview_camera")
    camera = bpy.data.objects.new("preview_camera", camera_data)
    scene.collection.objects.link(camera)
    target = center + Vector((0, 0, highest * 0.25))
    camera.location = center + Vector((span * 0.8, -span * 1.05, span * 0.95))
    camera.rotation_euler = (target - camera.location).to_track_quat("-Z", "Y").to_euler()
    camera_data.type = "ORTHO"
    camera_data.ortho_scale = span * 1.65
    camera_data.clip_end = 5000
    scene.camera = camera
    sun_data = bpy.data.lights.new("original_sun", "SUN")
    sun_data.energy = 2.0
    sun_data.angle = math.radians(8)
    sun = bpy.data.objects.new("original_sun", sun_data)
    scene.collection.objects.link(sun)
    sun.rotation_euler = (math.radians(28), math.radians(-22), math.radians(-38))
    world = bpy.data.worlds.new("original_studio_world")
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.18, 0.22, 0.28, 1)
    world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.7
    scene.world = world

    bpy.ops.object.select_all(action="DESELECT")
    for obj in building_objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = building_objects[0]
    bpy.ops.export_scene.gltf(
        filepath=f"{destination}/city-block.glb", export_format="GLB",
        use_selection=True, export_extras=True, export_animations=False,
        export_cameras=False, export_lights=False, export_apply=True, export_yup=True)

    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = 16
    scene.cycles.use_denoising = False
    scene.render.threads_mode = "FIXED"
    scene.render.threads = 2
    scene.render.resolution_x = scene.render.resolution_y = 256
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.image_settings.color_depth = "8"
    scene.render.use_compositing = False
    scene.render.use_sequencer = False
    scene.use_nodes = False
    scene.render.film_transparent = False
    if preview:
        scene.render.filepath = f"{destination}/preview.png"
        bpy.ops.render.render(write_still=True)
    scene.render.filepath = "//preview.png"
    bpy.ops.wm.save_as_mainfile(filepath=f"{destination}/city-block.blend",
                               compress=True, check_existing=False, relative_remap=False)

    bpy.context.view_layer.update()
    for obj in building_objects:
        obj.data.calc_loop_triangles()
    coordinates = [obj.matrix_world @ Vector(corner) for obj in building_objects for corner in obj.bound_box]
    world_min = [min(point[axis] for point in coordinates) for axis in range(3)]
    world_max = [max(point[axis] for point in coordinates) for axis in range(3)]
    actual_geometry = {
        "sceneObjects": len(scene.objects),
        "sceneMeshObjects": sum(obj.type == "MESH" for obj in scene.objects),
        "buildingObjects": len(building_objects),
        "buildingMeshVertices": sum(len(obj.data.vertices) for obj in building_objects),
        "buildingMeshFaces": sum(len(obj.data.polygons) for obj in building_objects),
        "buildingTriangles": sum(len(obj.data.loop_triangles) for obj in building_objects),
        "buildingBoundsMeters": {"min": world_min, "max": world_max},
        "buildingDimensionsMeters": [high - low for low, high in zip(world_min, world_max)],
        "coincidentVertexWeldToleranceMeters": 0.0001,
    }
    glb_check = inspect_glb(directory_fd, {item["id"] for item in plan["buildings"]})
    if glb_check["triangles"] != actual_geometry["buildingTriangles"]:
        raise FootprintError("GLB triangle count differs from the accepted building meshes")

    expected_files = {"city-block.blend", "city-block.glb"} | ({"preview.png"} if preview else set())
    if set(os.listdir(directory_fd)) != expected_files:
        raise FootprintError("Unexpected files appeared in the new output directory")
    outputs = [
        artifact(directory_fd, "city-block.blend", "application/x-blender"),
        artifact(directory_fd, "city-block.glb", "model/gltf-binary"),
    ]
    if preview:
        outputs.append(artifact(directory_fd, "preview.png", "image/png"))
    receipt = {
        "schemaVersion": 1,
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "datasetId": plan["datasetId"],
        "synthetic": plan["synthetic"],
        "purpose": "Offline reviewed GeoJSON building massing",
        "blenderVersion": bpy.app.version_string,
        "inputs": plan["inputs"],
        "generator": {
            file: sha256(read_regular(str(HERE / file), 128 * 1024))
            for file in ("footprints.py", "import_blender.py")
        },
        "source": ledger["source"],
        "rights": ledger["rights"],
        "projection": plan["projection"],
        "counts": plan["counts"],
        "boundsMeters": plan["boundsMeters"],
        "geometryChecks": geometry_checks,
        "actualGeometry": actual_geometry,
        "glbCheck": glb_check,
        "outputs": outputs,
        "limitations": ledger["limitations"] + [
            plan["projection"]["limitations"],
            "Flat base only. No DEM, building roofs, interiors, facade reconstruction or survey accuracy is inferred.",
            "The GLB includes buildings only; the blend also contains an original ground plane, camera and light.",
            "Rights metadata completeness is checked; its truth and legal sufficiency require the data owner's review.",
        ],
    }
    receipt_size = len((json.dumps(receipt, indent=2, allow_nan=False) + "\n").encode("utf-8"))
    if sum(output["bytes"] for output in outputs) + receipt_size > MAX_ARTIFACT_BYTES:
        raise FootprintError("Total artifacts and receipt exceed one megabyte")
    write_receipt(directory_fd, "build-receipt.json", receipt)
    return {"ok": True, "features": len(building_objects),
            "artifacts": len(outputs), "artifactBytes": sum(item["bytes"] for item in outputs),
            "receiptBytes": receipt_size}


def main():
    arguments = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", required=True)
    parser.add_argument("--ledger", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--preview", action="store_true")
    args = parser.parse_args(arguments)
    plan, ledger = load_plan(args.source, args.ledger)
    with new_output_directory(args.output) as fd:
        result = build(plan, ledger, fd, args.preview)
    print("FOOTPRINT_RESULT=" + json.dumps(result, separators=(",", ":")), flush=True)


if __name__ == "__main__":
    try:
        main()
    except (FootprintError, OSError) as error:
        print(f"Rejected: {error}", file=sys.stderr)
        raise SystemExit(2) from error
