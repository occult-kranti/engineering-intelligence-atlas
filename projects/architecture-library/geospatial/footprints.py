#!/usr/bin/env python3
"""Bounded, offline GeoJSON preflight. Standard-library-only; no network or code eval."""
import argparse
from contextlib import contextmanager
from datetime import date
import hashlib
import json
import math
import os
from pathlib import Path
import re
import stat
import sys
from urllib.parse import urlsplit

MAX_INPUT_BYTES = 256 * 1024
MAX_LEDGER_BYTES = 32 * 1024
MAX_FEATURES = 32
MAX_POLYGONS = 64
MAX_RING_VERTICES = 128
MAX_TOTAL_VERTICES = 4096
MAX_HOLES = 4
MAX_SPAN_METERS = 1000.0
MAX_ORIGIN_DISTANCE_METERS = 1000.0
MIN_HEIGHT = 0.5
MAX_HEIGHT = 80.0
MAX_ABS_LATITUDE = 75.0
EARTH_RADIUS_METERS = 6371008.8
EPSILON = 1e-8
LICENSE_URLS = {
    "CC0-1.0": "https://creativecommons.org/publicdomain/zero/1.0/",
    "CC-BY-4.0": "https://creativecommons.org/licenses/by/4.0/",
    "ODbL-1.0": "https://opendatacommons.org/licenses/odbl/1-0/",
}
ID_RE = re.compile(r"[A-Za-z0-9][A-Za-z0-9._-]{0,63}\Z")


class FootprintError(ValueError):
    """Rejected input or incomplete rights evidence."""


def reject(message):
    raise FootprintError(message)


def exact_fields(value, expected, label):
    if not isinstance(value, dict) or set(value) != set(expected):
        reject(f"{label} has missing or unsupported fields")


def string(value, label, limit=500):
    if not isinstance(value, str) or not value.strip() or len(value) > limit:
        reject(f"{label} must be nonempty bounded text")
    if any(ord(character) < 32 or ord(character) == 127 for character in value):
        reject(f"{label} must not contain control characters")
    return value


def number(value, label, low, high):
    if isinstance(value, bool) or not isinstance(value, (float, int)):
        reject(f"{label} must be a finite number")
    try:
        result = float(value)
    except (OverflowError, ValueError):
        reject(f"{label} must be a finite number")
    if not math.isfinite(result) or not low <= result <= high:
        reject(f"{label} is outside its allowed range")
    return result


def position(value, label):
    if not isinstance(value, list) or len(value) != 2:
        reject(f"{label} must contain longitude and latitude only")
    return (
        number(value[0], "longitude", -180, 180),
        number(value[1], "latitude", -MAX_ABS_LATITUDE, MAX_ABS_LATITUDE),
    )


def _path_parts(raw):
    if not isinstance(raw, (str, os.PathLike)):
        reject("A path is required")
    raw = os.fspath(raw)
    if not isinstance(raw, str) or len(raw) > 4096 or not raw.startswith("/"):
        reject("Paths must be absolute POSIX paths")
    if "\\" in raw or any(ord(c) < 32 for c in raw):
        reject("Path contains forbidden characters")
    parts = raw.split("/")[1:]
    if not parts or any(part in {"", ".", ".."} for part in parts):
        reject("Path traversal or empty path components are not allowed")
    return parts


@contextmanager
def parent_descriptor(raw):
    """Walk every directory without following symlinks; hold the actual parent."""
    if os.name != "posix" or not hasattr(os, "O_NOFOLLOW"):
        reject("This example requires POSIX no-follow file operations")
    parts = _path_parts(raw)
    fd = os.open("/", os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
    try:
        for part in parts[:-1]:
            next_fd = os.open(part, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW, dir_fd=fd)
            os.close(fd)
            fd = next_fd
        yield fd, parts[-1]
    except OSError as error:
        raise FootprintError("Path is missing, inaccessible, or contains a symlink") from error
    finally:
        os.close(fd)


def read_regular(raw, limit):
    with parent_descriptor(raw) as (parent_fd, name):
        fd = os.open(name, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK, dir_fd=parent_fd)
        try:
            before = os.fstat(fd)
            if not stat.S_ISREG(before.st_mode) or not 0 < before.st_size <= limit:
                reject("Input must be a nonempty bounded regular file")
            chunks = []
            remaining = limit + 1
            while remaining:
                chunk = os.read(fd, min(65536, remaining))
                if not chunk:
                    break
                chunks.append(chunk)
                remaining -= len(chunk)
            data = b"".join(chunks)
            after = os.fstat(fd)
            fields = ("st_dev", "st_ino", "st_size", "st_mtime_ns", "st_ctime_ns")
            if len(data) > limit or len(data) != before.st_size or any(
                getattr(before, field) != getattr(after, field) for field in fields
            ):
                reject("Input changed while reading or exceeded its bound")
            return data
        finally:
            os.close(fd)


def _unique_object(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            reject("Duplicate JSON object keys are not allowed")
        result[key] = value
    return result


def parse_json(data):
    def bad_constant(_value):
        reject("Nonfinite JSON numbers are not allowed")
    try:
        return json.loads(data.decode("utf-8"), object_pairs_hook=_unique_object,
                          parse_constant=bad_constant)
    except (UnicodeError, json.JSONDecodeError, RecursionError, ValueError) as error:
        raise FootprintError("Invalid bounded JSON") from error


def sha256(data):
    return hashlib.sha256(data).hexdigest()


def _date(value, label):
    string(value, label, 10)
    try:
        parsed = date.fromisoformat(value)
    except ValueError:
        reject(f"{label} must be an ISO calendar date")
    if parsed.isoformat() != value:
        reject(f"{label} must be an ISO calendar date")


def validate_ledger(ledger, input_digest):
    exact_fields(ledger, {"schemaVersion", "datasetId", "title", "source", "rights",
                          "input", "projection", "limitations"}, "ledger")
    if type(ledger["schemaVersion"]) is not int or ledger["schemaVersion"] != 1:
        reject("Unsupported ledger schema")
    if not isinstance(ledger["datasetId"], str) or not ID_RE.fullmatch(ledger["datasetId"]):
        reject("Invalid dataset ID")
    string(ledger["title"], "title", 150)
    source = ledger["source"]
    exact_fields(source, {"kind", "publisher", "uri", "acquired", "description"}, "source")
    if not isinstance(source["kind"], str) or source["kind"] not in {"original_synthetic", "reviewed_local_dataset"}:
        reject("Only original synthetic or reviewed local datasets are supported")
    string(source["publisher"], "publisher", 150)
    string(source["description"], "source description", 1000)
    uri = string(source["uri"], "source URI", 1000)
    if source["kind"] == "original_synthetic":
        if not re.fullmatch(r"urn:daftar:synthetic:[A-Za-z0-9._-]{1,100}", uri):
            reject("Synthetic data needs its original synthetic URN")
    else:
        try:
            parsed = urlsplit(uri)
            port = parsed.port
        except ValueError:
            reject("Source URI must be a public HTTPS provenance URL")
        if (parsed.scheme != "https" or not parsed.hostname or parsed.username
                or parsed.password or parsed.query or parsed.fragment
                or port not in {None, 443}):
            reject("Source URI must be HTTPS without credentials or query parameters")
        if parsed.hostname.lower() in {
            "tile.googleapis.com", "maps.googleapis.com", "earth.google.com", "maps.google.com"
        }:
            reject("Google Maps/Earth tile sources are outside this offline example")
    _date(source["acquired"], "source date")

    rights = ledger["rights"]
    exact_fields(rights, {"licenseId", "licenseUrl", "attribution", "reviewedBy", "reviewedAt",
                         "allowDerivatives", "allowRedistribution", "allowCommercialUse",
                         "thirdPartyRestrictionsReviewed", "databaseObligationsReviewed",
                         "reviewNote"}, "rights")
    license_id = rights["licenseId"]
    if not isinstance(license_id, str) or license_id not in LICENSE_URLS:
        reject("License must be an explicitly supported reusable-data license")
    if rights["licenseUrl"] != LICENSE_URLS[license_id]:
        reject("License URL must match the selected license")
    for field in ("allowDerivatives", "allowRedistribution", "allowCommercialUse",
                  "thirdPartyRestrictionsReviewed", "databaseObligationsReviewed"):
        if rights[field] is not True:
            reject(f"Rights review is incomplete: {field}")
    string(rights["attribution"], "attribution", 2000)
    string(rights["reviewedBy"], "reviewer", 150)
    string(rights["reviewNote"], "rights review note", 2000)
    _date(rights["reviewedAt"], "review date")
    if source["kind"] == "original_synthetic" and license_id != "CC0-1.0":
        reject("The original synthetic fixture profile requires CC0-1.0")

    exact_fields(ledger["input"], {"sha256", "crs", "axisOrder", "heightUnit"}, "input")
    if ledger["input"]["sha256"] != input_digest:
        reject("Rights ledger does not match the exact GeoJSON SHA-256")
    if (ledger["input"]["crs"] != "EPSG:4326"
            or ledger["input"]["axisOrder"] != "longitude-latitude"
            or ledger["input"]["heightUnit"] != "metre"):
        reject("Input must declare EPSG:4326 longitude-latitude and metre heights")
    exact_fields(ledger["projection"], {"method", "origin"}, "projection")
    if ledger["projection"]["method"] != "local-equirectangular":
        reject("Only the fixed local-equirectangular projection is supported")
    origin = position(ledger["projection"]["origin"], "origin")
    if not isinstance(ledger["limitations"], list) or not 1 <= len(ledger["limitations"]) <= 12:
        reject("A bounded limitations list is required")
    for item in ledger["limitations"]:
        string(item, "limitation", 1000)
    return origin


def project(lon_lat, origin):
    delta_lon = lon_lat[0] - origin[0]
    if abs(delta_lon) > 180:
        reject("Antimeridian crossings are not supported")
    x = EARTH_RADIUS_METERS * math.radians(delta_lon) * math.cos(math.radians(origin[1]))
    y = EARTH_RADIUS_METERS * math.radians(lon_lat[1] - origin[1])
    if math.hypot(x, y) > MAX_ORIGIN_DISTANCE_METERS:
        reject("Footprint lies outside the one-kilometer origin radius")
    return (x, y)


def area(ring):
    return sum(a[0] * b[1] - b[0] * a[1]
               for a, b in zip(ring, ring[1:] + ring[:1])) / 2


def cross(a, b, c):
    return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])


def on_segment(a, b, point):
    return (abs(cross(a, b, point)) <= EPSILON
            and min(a[0], b[0]) - EPSILON <= point[0] <= max(a[0], b[0]) + EPSILON
            and min(a[1], b[1]) - EPSILON <= point[1] <= max(a[1], b[1]) + EPSILON)


def segments_touch(a, b, c, d):
    ab_c, ab_d, cd_a, cd_b = cross(a, b, c), cross(a, b, d), cross(c, d, a), cross(c, d, b)
    if ((ab_c > EPSILON and ab_d < -EPSILON) or (ab_c < -EPSILON and ab_d > EPSILON)) and (
        (cd_a > EPSILON and cd_b < -EPSILON) or (cd_a < -EPSILON and cd_b > EPSILON)
    ):
        return True
    return any((on_segment(a, b, c), on_segment(a, b, d),
                on_segment(c, d, a), on_segment(c, d, b)))


def edges(ring):
    return list(zip(ring, ring[1:] + ring[:1]))


def ring_location(point, ring):
    """1 inside, 0 on boundary, -1 outside."""
    inside = False
    for a, b in edges(ring):
        if on_segment(a, b, point):
            return 0
        if (a[1] > point[1]) != (b[1] > point[1]):
            at_x = a[0] + (point[1] - a[1]) * (b[0] - a[0]) / (b[1] - a[1])
            if point[0] < at_x:
                inside = not inside
    return 1 if inside else -1


def rings_touch(a, b):
    for axis in (0, 1):
        if max(p[axis] for p in a) < min(p[axis] for p in b) - EPSILON or max(p[axis] for p in b) < min(p[axis] for p in a) - EPSILON:
            return False
    return any(segments_touch(*ab, *cd) for ab in edges(a) for cd in edges(b))


def validate_ring(raw, origin, exterior):
    if not isinstance(raw, list) or not 4 <= len(raw) <= MAX_RING_VERTICES + 1:
        reject("Each ring must have 3..128 vertices plus the closing coordinate")
    points = [position(item, "ring position") for item in raw]
    if points[0] != points[-1]:
        reject("Rings must be explicitly closed")
    if len(set(points[:-1])) != len(points) - 1:
        reject("A ring has duplicate non-closing vertices")
    ring = [project(item, origin) for item in points[:-1]]
    for a, b in edges(ring):
        if math.dist(a, b) < 0.05:
            reject("Ring edges must be at least five centimeters long")
    count = len(ring)
    for index in range(count):
        before, current, after = ring[index - 1], ring[index], ring[(index + 1) % count]
        if abs(cross(before, current, after)) <= EPSILON:
            reject("Collinear or reversing adjacent ring edges are unsupported")
    ring_edges = edges(ring)
    for i, first in enumerate(ring_edges):
        for j in range(i + 1, count):
            if j == i + 1 or (i == 0 and j == count - 1):
                continue
            if segments_touch(*first, *ring_edges[j]):
                reject("Ring self-intersection or self-touching detected")
    signed = area(ring)
    if abs(signed) < 1.0:
        reject("Each exterior or hole ring needs at least one square meter of area")
    reversed_winding = (signed > 0) != exterior
    if reversed_winding:
        ring.reverse()
    return ring, reversed_winding


def validate_polygon(raw, origin):
    if not isinstance(raw, list) or not 1 <= len(raw) <= MAX_HOLES + 1:
        reject("A polygon needs one exterior and at most four holes")
    rings = []
    normalized = 0
    for index, ring_raw in enumerate(raw):
        ring, changed = validate_ring(ring_raw, origin, index == 0)
        normalized += int(changed)
        if index:
            if rings_touch(ring, rings[0]) or ring_location(ring[0], rings[0]) != 1:
                reject("A hole must lie strictly inside its exterior")
            for other in rings[1:]:
                if (rings_touch(ring, other) or ring_location(ring[0], other) != -1
                        or ring_location(other[0], ring) != -1):
                    reject("Hole rings must not touch, overlap, or nest")
        rings.append(ring)
    filled_area = sum(area(ring) for ring in rings)
    if filled_area < 1.0:
        reject("A footprint needs at least one square meter of filled area")
    return {"rings": rings, "areaSquareMeters": filled_area}, normalized


def within_polygon(point, polygon):
    return (ring_location(point, polygon["rings"][0]) == 1
            and all(ring_location(point, hole) == -1 for hole in polygon["rings"][1:]))


def polygons_overlap(a, b):
    if any(rings_touch(ar, br) for ar in a["rings"] for br in b["rings"]):
        return True
    return within_polygon(a["rings"][0][0], b) or within_polygon(b["rings"][0][0], a)


def validate_document(document, ledger, digest):
    origin = validate_ledger(ledger, digest)
    exact_fields(document, {"type", "features"}, "GeoJSON")
    if document["type"] != "FeatureCollection":
        reject("Expected a GeoJSON FeatureCollection")
    features = document["features"]
    if not isinstance(features, list) or not 1 <= len(features) <= MAX_FEATURES:
        reject("Expected between one and 32 building features")
    buildings, all_polygons, used_ids = [], [], set()
    total_vertices = normalized = holes = 0
    for feature in features:
        exact_fields(feature, {"type", "id", "properties", "geometry"}, "feature")
        if feature["type"] != "Feature":
            reject("Expected a GeoJSON Feature")
        identity = feature["id"]
        if not isinstance(identity, str) or not ID_RE.fullmatch(identity) or identity in used_ids:
            reject("Feature IDs must be distinct bounded identifiers")
        used_ids.add(identity)
        properties = feature["properties"]
        exact_fields(properties, {"name", "height", "heightBasis"}, "properties")
        name = string(properties["name"], "building name", 100)
        height = number(properties["height"], "height", MIN_HEIGHT, MAX_HEIGHT)
        if not isinstance(properties["heightBasis"], str) or properties["heightBasis"] not in {"synthetic", "measured", "published_attribute", "author_assumption"}:
            reject("Height evidence must be explicit")
        if ledger["source"]["kind"] == "original_synthetic" and properties["heightBasis"] != "synthetic":
            reject("Synthetic fixture heights must be labeled synthetic")
        geometry = feature["geometry"]
        exact_fields(geometry, {"type", "coordinates"}, "geometry")
        if geometry["type"] == "Polygon":
            raw_polygons = [geometry["coordinates"]]
        elif geometry["type"] == "MultiPolygon":
            raw_polygons = geometry["coordinates"]
            if not isinstance(raw_polygons, list) or not raw_polygons:
                reject("A MultiPolygon cannot be empty")
        else:
            reject("Only Polygon and MultiPolygon building footprints are supported")
        if len(all_polygons) + len(raw_polygons) > MAX_POLYGONS:
            reject("At most 64 polygon parts are supported")
        polygons = []
        for raw_polygon in raw_polygons:
            polygon, changed = validate_polygon(raw_polygon, origin)
            normalized += changed
            total_vertices += sum(len(ring) for ring in polygon["rings"])
            holes += len(polygon["rings"]) - 1
            if total_vertices > MAX_TOTAL_VERTICES:
                reject("Total footprint vertices exceed 4096")
            for other in all_polygons:
                if polygons_overlap(polygon, other):
                    reject("Building polygon parts may not overlap or touch")
            polygons.append(polygon)
            all_polygons.append(polygon)
        buildings.append({"id": identity, "name": name, "heightMeters": height,
                          "heightBasis": properties["heightBasis"], "polygons": polygons})
    points = [p for polygon in all_polygons for ring in polygon["rings"] for p in ring]
    bounds = [[min(p[i] for p in points), max(p[i] for p in points)] for i in (0, 1)]
    if any(high - low > MAX_SPAN_METERS for low, high in bounds):
        reject("Footprint extent must fit within one kilometer on each axis")
    return {
        "schemaVersion": 1,
        "datasetId": ledger["datasetId"],
        "synthetic": ledger["source"]["kind"] == "original_synthetic",
        "projection": {
            "method": "local-equirectangular",
            "sourceCrs": "EPSG:4326",
            "inputAxisOrder": "longitude-latitude",
            "originLongitudeLatitude": list(origin),
            "sphereRadiusMeters": EARTH_RADIUS_METERS,
            "blendAxes": {"x": "east", "y": "north", "z": "up"},
            "glbAxes": {"x": "east", "y": "up", "z": "south"},
            "heightDatum": "flat synthetic/local base at z=0; no geodetic vertical datum",
            "maxExtentMeters": MAX_SPAN_METERS,
            "maxOriginDistanceMeters": MAX_ORIGIN_DISTANCE_METERS,
            "limitations": "Small-area spherical approximation, not an EPSG projected CRS or survey transformation.",
        },
        "counts": {"features": len(buildings), "polygons": len(all_polygons),
                   "holes": holes, "vertices": total_vertices, "normalizedRingWindings": normalized},
        "boundsMeters": {"x": bounds[0], "y": bounds[1]},
        "buildings": buildings,
    }


def load_plan(source, ledger_path):
    source_bytes = read_regular(source, MAX_INPUT_BYTES)
    ledger_bytes = read_regular(ledger_path, MAX_LEDGER_BYTES)
    document, ledger = parse_json(source_bytes), parse_json(ledger_bytes)
    plan = validate_document(document, ledger, sha256(source_bytes))
    plan["inputs"] = {
        "geojson": {"name": Path(source).name, "bytes": len(source_bytes), "sha256": sha256(source_bytes)},
        "ledger": {"name": Path(ledger_path).name, "bytes": len(ledger_bytes), "sha256": sha256(ledger_bytes)},
    }
    return plan, ledger


@contextmanager
def new_output_directory(raw):
    """Exclusive new private directory, held by descriptor for Linux Blender writes."""
    with parent_descriptor(raw) as (parent_fd, name):
        try:
            os.mkdir(name, mode=0o700, dir_fd=parent_fd)
        except FileExistsError as error:
            raise FootprintError("Output already exists; overwrite is forbidden") from error
        fd = os.open(name, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW, dir_fd=parent_fd)
        try:
            yield fd
        finally:
            os.close(fd)


def write_receipt(directory_fd, name, value):
    if name != "build-receipt.json":
        reject("Only the fixed receipt filename is supported")
    data = (json.dumps(value, indent=2, allow_nan=False) + "\n").encode("utf-8")
    if len(data) > 128 * 1024:
        reject("Receipt exceeds its bound")
    fd = os.open(name, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600,
                 dir_fd=directory_fd)
    try:
        with os.fdopen(fd, "wb", closefd=False) as output:
            output.write(data)
            output.flush()
            os.fsync(fd)
    finally:
        os.close(fd)
    os.fsync(directory_fd)
    return len(data)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", required=True)
    parser.add_argument("--ledger", required=True)
    args = parser.parse_args()
    plan, _ledger = load_plan(args.source, args.ledger)
    summary = {key: value for key, value in plan.items() if key != "buildings"}
    print(json.dumps(summary, indent=2, allow_nan=False))


if __name__ == "__main__":
    try:
        main()
    except (FootprintError, OSError) as error:
        print(f"Rejected: {error}", file=sys.stderr)
        sys.exit(2)
