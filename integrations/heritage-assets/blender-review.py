"""Import a verified, decompressed heritage GLB in a fresh background Blender process.

This is an editor acceptance report, not a survey or a claim that Blender retains
every face. The source-preserving GLB and Node receipts remain the interchange
evidence if Blender removes faces during import.
"""
import argparse
import hashlib
import json
import math
import os
from pathlib import Path
import struct
import sys


def checked_path(value, missing_leaf=False):
    path = Path(value)
    if not path.is_absolute() or ".." in path.parts:
        raise ValueError("Use an absolute path without traversal")
    for part in [*reversed(path.parents), path]:
        if part.is_symlink():
            raise ValueError("Symbolic links are not accepted")
        if not part.exists() and not (missing_leaf and part == path):
            raise ValueError("Missing path ancestor or input")
    return path


def scene_geometry_expectations(document):
    """Count indexed triangles on the active scene's node instances.

    A glTF mesh can be used by several nodes or by none. Blender's scene-object
    totals must therefore be compared with active node references, not with the
    number of mesh declarations in the file. Nodes belonging only to another
    scene and unreferenced mesh declarations do not contribute to these counts.
    """
    tables = {}
    for name in ("scenes", "nodes", "meshes", "accessors"):
        rows = document.get(name, [])
        if not isinstance(rows, list):
            raise ValueError(f"Invalid {name} array")
        tables[name] = rows

    if "scene" not in document and len(tables["scenes"]) > 1:
        raise ValueError("Multiple scenes require an explicit default scene for this helper")

    def row(name, index):
        rows = tables[name]
        if type(index) is not int or not 0 <= index < len(rows) or not isinstance(rows[index], dict):
            raise ValueError(f"Invalid {name} reference")
        return rows[index]

    def accessor_count(index):
        count = row("accessors", index).get("count")
        if type(count) is not int or count <= 0:
            raise ValueError("Invalid accessor count")
        return count

    scene_index = document.get("scene", 0)
    scene = row("scenes", scene_index)
    roots = scene.get("nodes", [])
    if not isinstance(roots, list):
        raise ValueError("Invalid active scene roots")
    pending, seen, mesh_counts, instances = list(reversed(roots)), set(), {}, []
    vertices = indices = 0
    while pending:
        node_index = pending.pop()
        node = row("nodes", node_index)
        if node_index in seen:
            raise ValueError("Cyclic or multiply-parented active scene node")
        seen.add(node_index)
        children = node.get("children", [])
        if not isinstance(children, list):
            raise ValueError("Invalid node children")
        pending.extend(reversed(children))
        if "mesh" not in node:
            continue
        mesh_index = node["mesh"]
        mesh = row("meshes", mesh_index)
        if mesh_index not in mesh_counts:
            primitives = mesh.get("primitives", [])
            if not isinstance(primitives, list) or not primitives:
                raise ValueError("Active mesh has no primitives")
            mesh_vertices = mesh_indices = 0
            for primitive in primitives:
                if not isinstance(primitive, dict) or primitive.get("mode", 4) != 4 or "indices" not in primitive:
                    raise ValueError("Only indexed triangular meshes are supported")
                attributes = primitive.get("attributes", {})
                if not isinstance(attributes, dict) or "POSITION" not in attributes:
                    raise ValueError("Active mesh has no POSITION accessor")
                primitive_indices = accessor_count(primitive["indices"])
                if primitive_indices % 3:
                    raise ValueError("Triangle index count is not divisible by three")
                mesh_vertices += accessor_count(attributes["POSITION"])
                mesh_indices += primitive_indices
            mesh_counts[mesh_index] = (mesh_vertices, mesh_indices)
        mesh_vertices, mesh_indices = mesh_counts[mesh_index]
        vertices += mesh_vertices
        indices += mesh_indices
        instances.append({"nodeIndex": node_index, "meshIndex": mesh_index,
                          "vertexEntries": mesh_vertices, "indexCount": mesh_indices,
                          "triangles": mesh_indices // 3})
    if not instances:
        raise ValueError("Active scene has no mesh instances")
    return {"sourceGeometryCountBasis": "active-scene node instances",
            "sourceActiveScene": scene_index, "sourceMeshInstances": len(instances),
            "sourceMeshReferences": instances, "sourceVertexEntries": vertices,
            "sourceIndexCount": indices, "sourceTriangles": indices // 3}


def main():
    import bpy
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", required=True)
    parser.add_argument("--sha256", required=True)
    parser.add_argument("--output", required=True, help="New output directory; never overwritten")
    args = parser.parse_args(sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else [])
    if not bpy.app.background:
        raise ValueError("Run in a new background Blender process; do not modify a live scene")
    source = checked_path(args.input)
    if not source.is_file() or source.stat().st_size > 600 * 1024**2:
        raise ValueError("Input must be a bounded regular file")
    data = source.read_bytes()
    actual_hash = hashlib.sha256(data).hexdigest()
    if actual_hash != args.sha256:
        raise ValueError("Input SHA256 mismatch")
    if len(data) < 20 or struct.unpack_from("<4sII", data) != (b"glTF", 2, len(data)):
        raise ValueError("Invalid GLB header")
    length, kind = struct.unpack_from("<II", data, 12)
    if kind != 0x4E4F534A or length > 8 * 1024**2 or length + 20 > len(data):
        raise ValueError("Invalid JSON chunk")
    document = json.loads(data[20:20+length])
    if "EXT_meshopt_compression" in document.get("extensionsUsed", []):
        raise ValueError("Run preserve.mjs decompress first; this helper does not decode meshopt")
    for group in ["buffers", "images"]:
        if any("uri" in row for row in document.get(group, [])):
            raise ValueError("External resources are not accepted")
    expected = scene_geometry_expectations(document)
    output = checked_path(args.output, missing_leaf=True)
    output.mkdir(mode=0o700)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    import_arguments = {"filepath": str(source)}
    if "import_scene_as_collection" in bpy.ops.import_scene.gltf.get_rna_type().properties:
        import_arguments["import_scene_as_collection"] = True
    elif len(document["scenes"]) > 1:
        raise ValueError("This Blender importer cannot isolate multiple glTF scene collections")
    bpy.ops.import_scene.gltf(**import_arguments)
    bpy.context.view_layer.update()
    # The importer retains inactive glTF scenes as excluded collections. Scene
    # objects include those collections; the active view layer does not.
    meshes = [o for o in bpy.context.view_layer.objects if o.type == "MESH"]
    all_scene_meshes = sum(o.type == "MESH" for o in bpy.context.scene.objects)
    low, high = [math.inf] * 3, [-math.inf] * 3
    triangles = vertices = 0
    colors = []
    for obj in meshes:
        obj.data.calc_loop_triangles()
        triangles += len(obj.data.loop_triangles)
        vertices += len(obj.data.vertices)
        colors.append({"object": obj.name, "attributes": [{"name": a.name, "domain": a.domain, "dataType": a.data_type} for a in obj.data.color_attributes]})
        for vertex in obj.data.vertices:
            point = obj.matrix_world @ vertex.co
            if not all(math.isfinite(x) for x in point):
                raise ValueError("Imported nonfinite coordinate")
            for axis in range(3):
                low[axis], high[axis] = min(low[axis], point[axis]), max(high[axis], point[axis])
    if not meshes:
        raise ValueError("No mesh imported")
    blend = output / "scene.blend"
    bpy.ops.wm.save_as_mainfile(filepath=str(blend), compress=True)
    receipt = {"schemaVersion": 1, "blenderVersion": bpy.app.version_string,
               "sourceSha256": actual_hash, "sourceBytes": len(data), **expected,
               "importedGeometryCountBasis": "active-view-layer mesh objects",
               "importedMeshObjects": len(meshes), "importedVertexEntries": vertices,
               "excludedSceneMeshObjects": all_scene_meshes - len(meshes),
               "importedTriangles": triangles,
               "triangleCountDifference": triangles - expected["sourceTriangles"],
               "faceRemovalCause": "not established" if triangles != expected["sourceTriangles"] else None,
               "vertexColors": colors,
               "worldBounds": {"min": low, "max": high,
                               "dimensions": [high[i]-low[i] for i in range(3)],
                               "units": "unverified source units; Blender glTF axis convention applied by importer"},
               "surveyScaleVerified": False,
               "blend": {"file": blend.name, "bytes": blend.stat().st_size,
                         "sha256": hashlib.sha256(blend.read_bytes()).hexdigest()}}
    (output / "blender-receipt.json").write_text(json.dumps(receipt, indent=2) + "\n")
    print(json.dumps(receipt))


if __name__ == "__main__":
    main()
