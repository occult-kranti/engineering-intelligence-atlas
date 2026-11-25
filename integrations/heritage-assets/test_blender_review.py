"""Regression checks for comparing glTF scene instances with Blender objects.

These tests do not import Blender or create files. The fixture writer is also
used by the separately recorded actual Blender acceptance run.
"""
import copy
import importlib.util
import json
from pathlib import Path
import struct
import unittest


SPEC = importlib.util.spec_from_file_location(
    "heritage_blender_review", Path(__file__).with_name("blender-review.py")
)
HELPER = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(HELPER)


def triangle_document(instances=1):
    """A colored indexed triangle, with independently positioned instances."""
    return {
        "asset": {"version": "2.0"},
        "buffers": [{"byteLength": 84}],
        "bufferViews": [
            {"buffer": 0, "byteOffset": 0, "byteLength": 36},
            {"buffer": 0, "byteOffset": 36, "byteLength": 36},
            {"buffer": 0, "byteOffset": 72, "byteLength": 12},
        ],
        "accessors": [
            {"bufferView": 0, "componentType": 5126, "count": 3,
             "type": "VEC3", "min": [0, 0, 0], "max": [1, 1, 0]},
            {"bufferView": 1, "componentType": 5126, "count": 3, "type": "VEC3"},
            {"bufferView": 2, "componentType": 5125, "count": 3, "type": "SCALAR"},
        ],
        "meshes": [{"primitives": [{"attributes": {"POSITION": 0, "COLOR_0": 1}, "indices": 2}]}],
        "nodes": [{"mesh": 0, "name": f"triangle-{i}", "translation": [i * 10, 0, 0]}
                  for i in range(instances)],
        "scenes": [{"nodes": list(range(instances))}],
        "scene": 0,
    }


def triangle_glb(document):
    """Serialize the fixture without an exporter that could alter its scene."""
    positions = [0, 0, 0, 1, 0, 0, 0, 1, 0]
    colors = [1, 0, 0, 0, 1, 0, 0, 0, 1]
    binary = struct.pack("<18f3I", *positions, *colors, 0, 1, 2)
    encoded = json.dumps(document, separators=(",", ":")).encode("utf-8")
    encoded += b" " * (-len(encoded) % 4)
    return (struct.pack("<4sII", b"glTF", 2, 28 + len(encoded) + len(binary))
            + struct.pack("<II", len(encoded), 0x4E4F534A) + encoded
            + struct.pack("<II", len(binary), 0x004E4942) + binary)


class SceneGeometryExpectationsTests(unittest.TestCase):
    def test_shared_mesh_is_counted_for_each_active_instance(self):
        result = HELPER.scene_geometry_expectations(triangle_document(instances=2))
        self.assertEqual(result["sourceGeometryCountBasis"], "active-scene node instances")
        self.assertEqual(result["sourceMeshInstances"], 2)
        self.assertEqual(result["sourceVertexEntries"], 6)
        self.assertEqual(result["sourceIndexCount"], 6)
        self.assertEqual(result["sourceTriangles"], 2)
        self.assertEqual([x["meshIndex"] for x in result["sourceMeshReferences"]], [0, 0])

    def test_unused_mesh_declarations_and_inactive_scenes_are_excluded(self):
        document = triangle_document(instances=2)
        document["meshes"].extend([copy.deepcopy(document["meshes"][0]),
                                  copy.deepcopy(document["meshes"][0])])
        document["nodes"].append({"mesh": 1})
        document["scenes"] = [{"nodes": [2]}, {"nodes": [0, 1]}]
        document["scene"] = 1
        result = HELPER.scene_geometry_expectations(document)
        self.assertEqual(result["sourceActiveScene"], 1)
        self.assertEqual(result["sourceMeshInstances"], 2)
        self.assertEqual(result["sourceTriangles"], 2)
        self.assertEqual(result["sourceVertexEntries"], 6)
        self.assertEqual([x["nodeIndex"] for x in result["sourceMeshReferences"]], [0, 1])

    def test_nested_transforms_without_meshes_do_not_add_geometry(self):
        document = triangle_document(instances=2)
        document["nodes"].extend([{"children": [0, 1]}, {"children": [2]}])
        document["scenes"][0]["nodes"] = [3]
        result = HELPER.scene_geometry_expectations(document)
        self.assertEqual(result["sourceTriangles"], 2)
        self.assertEqual(result["sourceMeshInstances"], 2)

    def test_first_scene_is_selected_when_default_scene_is_absent(self):
        document = triangle_document()
        del document["scene"]
        self.assertEqual(HELPER.scene_geometry_expectations(document)["sourceTriangles"], 1)

    def test_multiple_scenes_without_default_are_explicitly_unsupported(self):
        document = triangle_document()
        document["scenes"].append({"nodes": []})
        del document["scene"]
        with self.assertRaisesRegex(ValueError, "Multiple scenes require an explicit default scene"):
            HELPER.scene_geometry_expectations(document)

    def test_cycle_is_rejected_before_import(self):
        document = triangle_document()
        document["nodes"][0]["children"] = [1]
        document["nodes"].append({"children": [0]})
        with self.assertRaisesRegex(ValueError, "Cyclic or multiply-parented"):
            HELPER.scene_geometry_expectations(document)

    def test_multiple_parent_and_repeated_root_are_rejected(self):
        for roots, parents in [([1, 2], [{"children": [0]}, {"children": [0]}]),
                               ([0, 0], [])]:
            with self.subTest(roots=roots):
                document = triangle_document()
                document["nodes"].extend(parents)
                document["scenes"][0]["nodes"] = roots
                with self.assertRaisesRegex(ValueError, "Cyclic or multiply-parented"):
                    HELPER.scene_geometry_expectations(document)

    def test_invalid_references_are_rejected(self):
        for reference in [-1, 9, True, "0"]:
            with self.subTest(reference=reference):
                document = triangle_document()
                document["scenes"][0]["nodes"] = [reference]
                with self.assertRaisesRegex(ValueError, "Invalid nodes reference"):
                    HELPER.scene_geometry_expectations(document)

    def test_missing_geometry_and_malformed_accessors_are_rejected(self):
        invalid_documents = []
        empty = triangle_document()
        empty["scenes"][0]["nodes"] = []
        invalid_documents.append(empty)
        for count in [0, -3, 4, True, "3"]:
            document = triangle_document()
            document["accessors"][2]["count"] = count
            invalid_documents.append(document)
        for document in invalid_documents:
            with self.subTest(document=document):
                with self.assertRaises(ValueError):
                    HELPER.scene_geometry_expectations(document)

    def test_unsupported_primitive_fails_instead_of_changing_counts(self):
        for alteration in [{"mode": 1}, {"indices": None}, {"attributes": {}}]:
            with self.subTest(alteration=alteration):
                document = triangle_document()
                document["meshes"][0]["primitives"][0].update(alteration)
                with self.assertRaises(ValueError):
                    HELPER.scene_geometry_expectations(document)


if __name__ == "__main__":
    unittest.main()
