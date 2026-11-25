"""Meaningful geometry, rights and filesystem-boundary checks; no Blender required."""
import copy
import json
import math
import os
from pathlib import Path
import sys
import tempfile
import struct
import unittest

sys.dont_write_bytecode = True
HERE = Path(__file__).absolute().parent
sys.path.insert(0, str(HERE.parent))
import footprints as fp

FIXTURES = HERE.parent / "fixtures"
SOURCE = FIXTURES / "synthetic-city-block.geojson"
LEDGER = FIXTURES / "synthetic-city-block.rights.json"


def rectangle(x0, y0, x1, y1):
    return [[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]]


class GeometryTests(unittest.TestCase):
    def setUp(self):
        self.data = json.loads(SOURCE.read_text())
        self.ledger = json.loads(LEDGER.read_text())

    def check(self):
        raw = json.dumps(self.data, allow_nan=True).encode()
        self.ledger["input"]["sha256"] = fp.sha256(raw)
        return fp.validate_document(self.data, self.ledger, fp.sha256(raw))

    def rejected(self, phrase=None):
        with self.assertRaisesRegex(fp.FootprintError, phrase or "."):
            self.check()

    def test_original_fixture_has_courtyard_and_multipart_building(self):
        plan, ledger = fp.load_plan(str(SOURCE), str(LEDGER))
        self.assertTrue(plan["synthetic"])
        self.assertEqual(plan["counts"], {
            "features": 4, "polygons": 5, "holes": 1,
            "vertices": 26, "normalizedRingWindings": 0,
        })
        self.assertEqual(ledger["source"]["kind"], "original_synthetic")
        self.assertLess(plan["boundsMeters"]["x"][1] - plan["boundsMeters"]["x"][0], 140)

    def test_projection_is_local_metric_and_origin_recorded(self):
        x, y = fp.project((0.001, 0.001), (0, 0))
        self.assertAlmostEqual(x, 111.19508023, places=6)
        self.assertAlmostEqual(y, x, places=10)
        plan = self.check()
        self.assertEqual(plan["projection"]["originLongitudeLatitude"], [0, 0])
        self.assertEqual(plan["projection"]["glbAxes"], {"x": "east", "y": "up", "z": "south"})

    def test_reversed_winding_is_normalized_without_filling_holes(self):
        normal = self.check()["buildings"][1]["polygons"][0]["areaSquareMeters"]
        for ring in self.data["features"][1]["geometry"]["coordinates"]:
            ring.reverse()
        plan = self.check()
        self.assertEqual(plan["counts"]["normalizedRingWindings"], 2)
        polygon = plan["buildings"][1]["polygons"][0]
        self.assertAlmostEqual(polygon["areaSquareMeters"], normal)
        self.assertGreater(fp.area(polygon["rings"][0]), 0)
        self.assertLess(fp.area(polygon["rings"][1]), 0)

    def test_explicit_crs_and_axis_order_required(self):
        for field, value in (("crs", "EPSG:3857"), ("axisOrder", "latitude-longitude"),
                             ("heightUnit", "feet")):
            with self.subTest(field=field):
                original = self.ledger["input"][field]
                self.ledger["input"][field] = value
                self.rejected("EPSG:4326")
                self.ledger["input"][field] = original

    def test_geojson_crs_extension_is_not_silently_used(self):
        self.data["crs"] = {"name": "EPSG:3857"}
        self.rejected("unsupported fields")

    def test_nonfinite_boolean_and_3d_positions_rejected(self):
        ring = self.data["features"][0]["geometry"]["coordinates"][0]
        for bad in ([float("nan"), 0], [0, float("inf")], [False, 0], [0, 0, 12]):
            with self.subTest(bad=bad):
                ring[1] = bad
                self.rejected()

    def test_height_bounds_and_type(self):
        for bad in (0, -1, 81, True, "12", float("inf")):
            with self.subTest(bad=bad):
                self.data["features"][0]["properties"]["height"] = bad
                self.rejected("height")

    def test_ring_must_close_and_not_repeat_vertices(self):
        ring = self.data["features"][0]["geometry"]["coordinates"][0]
        ring[-1] = [-0.00055, -0.00034]
        self.rejected("closed")
        ring[-1] = ring[0]
        ring[2] = ring[1]
        self.rejected("duplicate")

    def test_self_intersection_is_rejected(self):
        self.data["features"][0]["geometry"]["coordinates"] = [
            [[-0.00055, -0.00035], [-0.00015, -0.00005],
             [-0.00055, -0.00005], [-0.00015, -0.00035], [-0.00055, -0.00035]]]
        self.rejected("self-intersection")

    def test_collinear_and_degenerate_rings_are_rejected(self):
        self.data["features"][0]["geometry"]["coordinates"] = [
            [[-0.00055, -0.00035], [-0.00035, -0.00035], [-0.00015, -0.00035],
             [-0.00015, -0.00005], [-0.00055, -0.00005], [-0.00055, -0.00035]]]
        self.rejected("Collinear")

    def test_holes_cannot_escape_touch_or_nest(self):
        polygon = self.data["features"][1]["geometry"]["coordinates"]
        valid = copy.deepcopy(polygon)
        for hole in (rectangle(0.0008, -0.0003, 0.0009, -0.0001),
                     rectangle(0.0001, -0.0003, 0.0003, -0.0001)):
            with self.subTest(hole=hole):
                polygon[:] = [valid[0], hole]
                self.rejected("strictly inside")
        polygon[:] = valid + [rectangle(0.00030, -0.00023, 0.00040, -0.00017)]
        self.rejected("nest")

    def test_overlapping_features_rejected(self):
        other = copy.deepcopy(self.data["features"][0])
        other["id"] = "duplicate-location"
        self.data["features"].append(other)
        self.rejected("overlap or touch")

    def test_feature_ids_and_unknown_geometry_rejected(self):
        self.data["features"][1]["id"] = self.data["features"][0]["id"]
        self.rejected("distinct")
        self.data["features"][1]["id"] = "courtyard"
        self.data["features"][0]["geometry"]["type"] = "LineString"
        self.rejected("Only Polygon")

    def test_small_area_and_origin_limits(self):
        self.data["features"] = [self.data["features"][0]]
        self.data["features"][0]["geometry"]["coordinates"] = [rectangle(-0.005, -0.0001, 0.005, 0.0001)]
        self.rejected("extent")
        self.ledger["projection"]["origin"] = [10, 10]
        self.rejected("origin radius")
        self.ledger["projection"]["origin"] = [0, 76]
        self.rejected("latitude")

    def test_antimeridian_crossing_rejected(self):
        with self.assertRaisesRegex(fp.FootprintError, "Antimeridian"):
            fp.project((-179.999, 0), (179.999, 0))

    def test_feature_and_polygon_count_caps(self):
        feature = self.data["features"][0]
        self.data["features"] = [feature] * 33
        self.rejected("32")
        self.data["features"] = [feature]
        feature["geometry"] = {"type": "MultiPolygon", "coordinates": [[rectangle(0, 0, 0.0001, 0.0001)]] * 65}
        self.rejected("64")

    def test_ring_vertex_cap(self):
        points = [[0.001 * math.cos(i * math.tau / 129),
                   0.001 * math.sin(i * math.tau / 129)] for i in range(129)]
        self.data["features"][0]["geometry"]["coordinates"] = [points + [points[0]]]
        self.rejected("128")

    def test_tiny_but_nondegenerate_area_rejected(self):
        self.data["features"][0]["geometry"]["coordinates"] = [rectangle(0, 0, 0.000001, 0.000001)]
        self.rejected("square meter")

    def test_total_vertex_cap_on_many_valid_separate_polygons(self):
        polygons = []
        scale = math.degrees(1 / fp.EARTH_RADIUS_METERS)
        for i in range(33):
            cx, cy = -300 + (i % 11) * 60, -60 + (i // 11) * 60
            points = [[(cx + 8 * math.cos(j * math.tau / 128)) * scale,
                       (cy + 8 * math.sin(j * math.tau / 128)) * scale] for j in range(128)]
            polygons.append([points + [points[0]]])
        self.data["features"] = [self.data["features"][0]]
        self.data["features"][0]["geometry"] = {"type": "MultiPolygon", "coordinates": polygons}
        self.rejected("4096")

    def test_rights_must_explicitly_allow_the_intended_derivative(self):
        for field in ("allowDerivatives", "allowRedistribution", "allowCommercialUse",
                      "thirdPartyRestrictionsReviewed", "databaseObligationsReviewed"):
            with self.subTest(field=field):
                self.ledger["rights"][field] = False
                self.rejected("incomplete")
                self.ledger["rights"][field] = True

    def test_restricted_or_mismatched_license_rejected(self):
        self.ledger["rights"]["licenseId"] = "CC-BY-NC-4.0"
        self.rejected("supported reusable")
        self.ledger["rights"]["licenseId"] = "CC0-1.0"
        self.ledger["rights"]["licenseUrl"] = "https://example.com/permission"
        self.rejected("License URL")

    def test_reviewed_local_odbl_requires_complete_ledger(self):
        self.ledger["source"].update(kind="reviewed_local_dataset", uri="https://www.openstreetmap.org/copyright")
        self.ledger["rights"].update(licenseId="ODbL-1.0", licenseUrl=fp.LICENSE_URLS["ODbL-1.0"])
        self.assertFalse(self.check()["synthetic"])
        self.ledger["rights"]["databaseObligationsReviewed"] = False
        self.rejected("incomplete")

    def test_google_tile_source_and_credential_urls_rejected(self):
        self.ledger["source"]["kind"] = "reviewed_local_dataset"
        for uri in ("https://tile.googleapis.com/v1/3dtiles/root.json",
                    "https://user:password@example.com/data", "https://example.com/data?token=secret"):
            with self.subTest(uri=uri):
                self.ledger["source"]["uri"] = uri
                self.rejected()

    def test_metadata_is_data_and_unexpected_types_are_rejected(self):
        self.data["features"][0]["properties"]["name"] = "__import__('os').system('not executed')"
        self.assertIn("__import__", self.check()["buildings"][0]["name"])
        self.data["features"][0]["properties"]["heightBasis"] = []
        self.rejected()
        self.data["features"][0]["properties"]["heightBasis"] = "synthetic"
        self.ledger["source"]["kind"] = {}
        self.rejected()


class FilesystemTests(unittest.TestCase):
    def test_hash_binding_detects_input_change(self):
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / "data.geojson"
            source.write_bytes(SOURCE.read_bytes() + b" ")
            with self.assertRaisesRegex(fp.FootprintError, "SHA-256"):
                fp.load_plan(str(source), str(LEDGER))

    def test_duplicate_keys_and_nonfinite_json_are_rejected(self):
        for raw in (b'{"type":"a","type":"b"}', b'{"value":NaN}', b'{"value":Infinity}'):
            with self.subTest(raw=raw), self.assertRaises(fp.FootprintError):
                fp.parse_json(raw)

    def test_oversized_file_and_fifo_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "large"
            path.write_bytes(b"x" * (fp.MAX_LEDGER_BYTES + 1))
            with self.assertRaises(fp.FootprintError):
                fp.read_regular(str(path), fp.MAX_LEDGER_BYTES)
            fifo = Path(directory) / "pipe"
            os.mkfifo(fifo)
            with self.assertRaises(fp.FootprintError):
                fp.read_regular(str(fifo), 100)

    def test_symlink_leaf_and_ancestor_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "leaf").symlink_to(SOURCE)
            (root / "parent").symlink_to(FIXTURES, target_is_directory=True)
            for path in (root / "leaf", root / "parent" / SOURCE.name):
                with self.subTest(path=path), self.assertRaises(fp.FootprintError):
                    fp.read_regular(str(path), fp.MAX_INPUT_BYTES)

    def test_relative_traversal_and_empty_path_components_rejected(self):
        for path in ("data.geojson", str(FIXTURES) + "/../fixtures/" + SOURCE.name,
                     str(FIXTURES) + "//" + SOURCE.name):
            with self.subTest(path=path), self.assertRaises(fp.FootprintError):
                fp.read_regular(path, fp.MAX_INPUT_BYTES)

    def test_existing_output_and_symlink_parent_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            existing = root / "existing"
            existing.mkdir()
            with self.assertRaisesRegex(fp.FootprintError, "already exists"):
                with fp.new_output_directory(str(existing)):
                    self.fail("Existing output was reused")
            (root / "link").symlink_to(existing, target_is_directory=True)
            with self.assertRaises(fp.FootprintError):
                with fp.new_output_directory(str(root / "link" / "output")):
                    self.fail("Symlink parent was followed")

    def test_receipt_write_is_exclusive_and_anchored_after_parent_replacement(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            parent, held, other = root / "parent", root / "held", root / "other"
            parent.mkdir()
            other.mkdir()
            with fp.new_output_directory(str(parent / "output")) as fd:
                parent.rename(held)
                parent.symlink_to(other, target_is_directory=True)
                fp.write_receipt(fd, "build-receipt.json", {"ok": True})
                with self.assertRaises(FileExistsError):
                    fp.write_receipt(fd, "build-receipt.json", {"ok": False})
            self.assertTrue((held / "output" / "build-receipt.json").is_file())
            self.assertEqual(list(other.iterdir()), [])


class GeneratedArtifactTests(unittest.TestCase):
    def setUp(self):
        self.directory = HERE.parent / "generated"
        self.receipt = json.loads((self.directory / "build-receipt.json").read_text())

    def test_artifact_hashes_and_total_size(self):
        expected = {"city-block.blend", "city-block.glb", "preview.png"}
        self.assertEqual({item["path"] for item in self.receipt["outputs"]}, expected)
        total = (self.directory / "build-receipt.json").stat().st_size
        for item in self.receipt["outputs"]:
            data = (self.directory / item["path"]).read_bytes()
            self.assertEqual(len(data), item["bytes"])
            self.assertEqual(fp.sha256(data), item["sha256"])
            total += len(data)
        self.assertLessEqual(total, 1_000_000)
        png = (self.directory / "preview.png").read_bytes()
        self.assertEqual(png[:8], b"\x89PNG\r\n\x1a\n")
        self.assertEqual(struct.unpack_from(">II", png, 16), (256, 256))

    def test_receipt_pins_current_inputs_and_generator(self):
        for key, path in (("geojson", SOURCE), ("ledger", LEDGER)):
            self.assertEqual(fp.sha256(path.read_bytes()), self.receipt["inputs"][key]["sha256"])
        for name, digest in self.receipt["generator"].items():
            self.assertEqual(fp.sha256((HERE.parent / name).read_bytes()), digest)
        self.assertTrue(self.receipt["synthetic"])
        self.assertTrue(all(item["closedManifold"] and item["relativeVolumeError"] <= 1e-4
                            for item in self.receipt["geometryChecks"]))

    def test_glb_is_embedded_and_matches_mesh_receipt(self):
        import import_blender as builder
        ids = {feature["id"] for feature in json.loads(SOURCE.read_text())["features"]}
        fd = os.open(self.directory, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
        try:
            actual = builder.inspect_glb(fd, ids)
        finally:
            os.close(fd)
        self.assertEqual(actual, self.receipt["glbCheck"])
        self.assertEqual(actual["triangles"], self.receipt["actualGeometry"]["buildingTriangles"])
        self.assertEqual(actual["meshCount"], 4)


if __name__ == "__main__":
    unittest.main()
