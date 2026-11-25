#!/usr/bin/env python3
"""Independently reopen generated Blender/glTF files and verify the manifest.

Run with Blender 4.5 --background --factory-startup --disable-autoexec
--python-exit-code 1 --python verify_samples.py -- --input /absolute/generated.
No source file is modified. The report destination must not already exist.
"""
import argparse
import hashlib
import json
import math
from pathlib import Path
import struct
import sys
import time


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def private_path(root, relative):
    path = Path(relative)
    if path.is_absolute() or ".." in path.parts:
        raise ValueError("Manifest contains an unsafe path")
    if path.parts[:2] != ("samples", "generated"):
        raise ValueError("Manifest path is outside the generated collection")
    result = root.joinpath(*path.parts[2:])
    if any(p.is_symlink() for p in [result, *result.parents]):
        raise ValueError("Symlinked input is not accepted")
    if not result.is_file():
        raise ValueError(f"Missing artifact: {relative}")
    return result


def measures():
    import bpy
    bpy.context.view_layer.update()
    meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    points, triangles, vertices = [], 0, 0
    for obj in meshes:
        obj.data.calc_loop_triangles()
        points.extend(obj.matrix_world @ v.co for v in obj.data.vertices)
        triangles += len(obj.data.loop_triangles)
        vertices += len(obj.data.vertices)
        if any(triangle.area < 1e-10 for triangle in obj.data.loop_triangles):
            raise ValueError("Reopened mesh has a degenerate triangle")
    if not points or any(not math.isfinite(value) for point in points for value in point):
        raise ValueError("Reopened geometry is empty or non-finite")
    return {"objectCount": len(meshes), "triangleCount": triangles, "vertexCount": vertices,
        "min": [min(point[i] for point in points) for i in range(3)],
        "max": [max(point[i] for point in points) for i in range(3)]}


def same_geometry(actual, expected, check_vertices=False):
    for key in ["objectCount", "triangleCount"] + (["vertexCount"] if check_vertices else []):
        if actual[key] != expected[key]:
            raise ValueError(f"Reopened {key} differs: {actual[key]} != {expected[key]}")
    for key in ["min", "max"]:
        if any(abs(a - b) > 0.0002 for a, b in zip(actual[key], expected["boundsMeters"][key])):
            raise ValueError("Reopened bounds differ by more than 0.2 mm")


def inspect_glb(path):
    data = path.read_bytes()
    if len(data) < 28:
        raise ValueError("GLB is too short")
    magic, version, length = struct.unpack_from("<4sII", data)
    if (magic, version, length) != (b"glTF", 2, len(data)):
        raise ValueError("Invalid GLB header")
    chunks, position = [], 12
    while position < len(data):
        size, kind = struct.unpack_from("<I4s", data, position)
        position += 8
        if size % 4 or position + size > len(data):
            raise ValueError("Invalid GLB chunk length")
        chunks.append((kind, data[position:position + size]))
        position += size
    if [kind for kind, _ in chunks] != [b"JSON", b"BIN\x00"]:
        raise ValueError("Expected a self-contained JSON+BIN GLB")
    document = json.loads(chunks[0][1])
    if document["asset"]["version"] != "2.0" or document.get("extensionsRequired"):
        raise ValueError("Unexpected glTF version or required extension")
    if any("uri" in value for kind in ["buffers", "images"] for value in document.get(kind, [])):
        raise ValueError("GLB references an external resource")
    if document.get("images") or document.get("animations") or document.get("cameras"):
        raise ValueError("Unexpected image, animation or camera in teaching GLB")
    triangles = 0
    for mesh in document["meshes"]:
        for primitive in mesh["primitives"]:
            accessor = document["accessors"][primitive["indices"]]
            if primitive.get("mode", 4) != 4 or accessor["count"] % 3:
                raise ValueError("Expected triangle primitives")
            triangles += accessor["count"] // 3
    return {"format": "glTF 2.0 GLB", "triangleCount": triangles, "externalResources": 0}


def main():
    import bpy
    args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", required=True)
    parser.add_argument("--report", help="New report file; defaults to input/inspection.json")
    options = parser.parse_args(args)
    raw = Path(options.input)
    if not raw.is_absolute() or ".." in raw.parts or any(p.is_symlink() for p in [raw, *raw.parents]):
        raise ValueError("--input must be absolute and symlink-free")
    root = raw.resolve(strict=True)
    report = Path(options.report) if options.report else root / "inspection.json"
    if not report.is_absolute() or ".." in report.parts or any(p.is_symlink() for p in [report, *report.parents]):
        raise ValueError("Report must be absolute and symlink-free")
    if report.exists() or not report.parent.is_dir():
        raise ValueError("Report must be a new file beneath an existing directory")
    started = time.monotonic()
    manifest = json.loads((root / "manifest.json").read_text())
    if manifest["sampleCount"] < 1 or manifest["totalArtifactBytes"] > 8_000_000:
        raise ValueError("Invalid collection count or size")
    listed = set()
    for record in manifest["files"]:
        if record["path"] in listed:
            raise ValueError("Duplicate manifest path")
        listed.add(record["path"])
        path = private_path(root, record["path"])
        if path.stat().st_size != record["bytes"] or sha256(path) != record["sha256"]:
            raise ValueError(f"Manifest size/hash mismatch: {record['path']}")
    records = []
    metadata_paths = sorted(root.glob("*/metadata.json"))
    if len(metadata_paths) != manifest["sampleCount"] or len(listed) != 4 * len(metadata_paths):
        raise ValueError("Manifest must contain four files for every sample")
    for metadata_path in metadata_paths:
        expected = json.loads(metadata_path.read_text())
        for kind in ["blend", "glb", "preview"]:
            item = expected["files"][kind]
            path = private_path(root, item["path"])
            if path.stat().st_size != item["bytes"] or sha256(path) != item["sha256"]:
                raise ValueError("Per-sample file record differs from actual artifact")
        blend = private_path(root, expected["files"]["blend"]["path"])
        bpy.ops.wm.open_mainfile(filepath=str(blend), load_ui=False, use_scripts=False)
        if bpy.context.scene.unit_settings.system != "METRIC" or bpy.context.scene.unit_settings.scale_length != 1.0:
            raise ValueError("Blender source must use metres")
        if bpy.context.scene.get("study_id") != expected["id"] or bpy.data.texts or bpy.data.libraries:
            raise ValueError("Unexpected study identity, embedded scripts or linked libraries")
        if bpy.context.scene.render.filepath != "//preview.png" or any(i.filepath for i in bpy.data.images):
            raise ValueError("Source contains unexpected external file references")
        blend_measures = measures()
        same_geometry(blend_measures, expected, check_vertices=True)
        glb = private_path(root, expected["files"]["glb"]["path"])
        glb_info = inspect_glb(glb)
        if glb_info["triangleCount"] != expected["triangleCount"]:
            raise ValueError("GLB triangle count differs from Blender source")
        bpy.ops.wm.read_factory_settings(use_empty=True)
        bpy.ops.import_scene.gltf(filepath=str(glb))
        same_geometry(measures(), expected)
        preview = private_path(root, expected["files"]["preview"]["path"])
        image = bpy.data.images.load(str(preview), check_existing=False)
        if tuple(image.size) != (384, 384):
            raise ValueError("Preview must decode to 384 by 384 pixels")
        pixels = list(image.pixels)
        if max(pixels[0::4]) - min(pixels[0::4]) < 0.1:
            raise ValueError("Preview lacks visible image variation")
        records.append({"id": expected["id"], "status": "passed", "blendReopened": True,
            "glbReimported": True, "previewDecoded": True, "hashesMatch": True,
            "objectCount": blend_measures["objectCount"], "triangleCount": blend_measures["triangleCount"],
            "dimensionsMeters": expected["dimensionsMeters"], "externalResources": 0})
        print("INSPECTED " + expected["id"], flush=True)
    result = {"schemaVersion": 1, "status": "passed", "blenderVersion": bpy.app.version_string,
        "blenderBuildHash": bpy.app.build_hash.decode(), "sampleCount": len(records),
        "verifiedFileHashes": len(listed), "boundsToleranceMeters": 0.0002,
        "inspectionSeconds": round(time.monotonic() - started, 3),
        "manifestSha256": sha256(root / "manifest.json"), "inspectorSha256": sha256(Path(__file__)),
        "checks": ["All manifest and metadata hashes match", "All Blender sources reopened with scripts disabled",
            "All sources use metres and contain no embedded text scripts or linked libraries",
            "All GLBs parsed and reimported without external resources",
            "Object and triangle counts match; bounds match within 0.2 mm",
            "Finite, nondegenerate geometry", "All PNGs decoded at 384 x 384 with nonblank image content"],
        "samples": records,
        "limitations": ["No structural, construction, heritage accuracy, watertightness or manufacturing certification.",
            "This checks saved geometry and interoperability; visual review is recorded separately in README.md."]}
    with report.open("x", encoding="utf-8") as handle:
        handle.write(json.dumps(result, indent=2) + "\n")
    print("INSPECTION_COMPLETE " + json.dumps({k: result[k] for k in ["sampleCount", "verifiedFileHashes", "inspectionSeconds"]}), flush=True)


if __name__ == "__main__":
    main()
