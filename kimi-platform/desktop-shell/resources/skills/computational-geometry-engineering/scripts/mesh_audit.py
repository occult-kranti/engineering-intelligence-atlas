#!/usr/bin/env python3
"""Read-only triangulated-asset precheck; never certifies printability or physical correctness."""
import argparse
import datetime as dt
import hashlib
import json
import math
from pathlib import Path


def finite(value):
    try:
        value = float(value)
        return value if math.isfinite(value) else None
    except (TypeError, ValueError):
        return None


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--input', required=True, type=Path)
    p.add_argument('--units', required=True, help='User-supplied units; never inferred by this tool')
    p.add_argument('--tolerance', required=True, type=float, help='User-supplied modeling tolerance in those units')
    p.add_argument('--output', required=True, type=Path)
    args = p.parse_args()
    if args.tolerance <= 0:
        p.error('tolerance must be positive')
    if not args.input.is_file():
        p.error('input must be an existing file')
    if args.output.exists():
        p.error('output exists; choose a new report path')
    try:
        import trimesh
    except ImportError:
        p.error('trimesh is required: install it in the analysis environment before running')
    sha = hashlib.sha256()
    with args.input.open('rb') as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b''):
            sha.update(chunk)
    loaded = trimesh.load(args.input, process=False)
    if isinstance(loaded, trimesh.Scene):
        meshes = list(loaded.geometry.values())
    else:
        meshes = [loaded]
    reports = []
    for index, mesh in enumerate(meshes):
        if not hasattr(mesh, 'vertices') or not hasattr(mesh, 'faces'):
            reports.append({'index': index, 'type': type(mesh).__name__, 'error': 'not a triangulated mesh with vertices/faces'})
            continue
        vertices = int(len(mesh.vertices))
        faces = int(len(mesh.faces))
        area_faces = getattr(mesh, 'area_faces', [])
        min_face_area = finite(min(area_faces)) if len(area_faces) else None
        reports.append({
            'index': index, 'type': type(mesh).__name__, 'vertices': vertices, 'faces': faces,
            'bounds': mesh.bounds.tolist() if hasattr(mesh, 'bounds') else None,
            'extents': mesh.extents.tolist() if hasattr(mesh, 'extents') else None,
            'is_watertight': bool(mesh.is_watertight),
            'is_winding_consistent': bool(mesh.is_winding_consistent),
            'is_volume': bool(mesh.is_volume),
            'volume_in_user_units_cubed': finite(mesh.volume),
            'euler_number': int(mesh.euler_number) if hasattr(mesh, 'euler_number') else None,
            'minimum_face_area_in_user_units_squared': min_face_area,
            'possible_zero_area_faces': bool(min_face_area is not None and min_face_area <= args.tolerance ** 2),
        })
    report = {
        'schema_version': '1.0', 'created_at': dt.datetime.now(dt.timezone.utc).isoformat(),
        'input': str(args.input.resolve()), 'sha256': sha.hexdigest(), 'bytes': args.input.stat().st_size,
        'user_supplied_units': args.units, 'user_supplied_tolerance': args.tolerance,
        'library': {'name': 'trimesh', 'version': getattr(trimesh, '__version__', 'unknown')},
        'processing': 'read-only load with process=False; no repair or modification',
        'mesh_count': len(meshes), 'meshes': reports,
        'not_tested_or_not_proven': ['actual units or scale', 'self-intersection completeness', 'printability or manufacturing readiness', 'dimensional accuracy or tolerances', 'structural/physical correctness', 'safety or certification'],
        'interpretation': 'Signals only. Watertight=true is one narrow topology property; false can be intentional for open surfaces. Qualified domain validation remains required.'
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.output.open('x', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    print(json.dumps({'output': str(args.output), 'mesh_count': len(meshes), 'sha256': report['sha256']}, indent=2))


if __name__ == '__main__':
    main()
