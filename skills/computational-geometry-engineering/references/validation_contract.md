# Geometry validation contract

## Required metadata

Record artifact hash/path; source and license; representation; units and uncertainty; coordinate reference system/handedness/up axis/origin; bounds/extents; expected dimensions; modeling and acceptable-error tolerances; topology/manifold expectations; target downstream tool/process; validation method/version; and responsible reviewer.

## Checks by category

- **Schema/format:** parse successfully; use the target format’s validator where available; retain warnings.
- **Units/transform:** verify units, scale, origin, handedness, axis, orientation, and conversion round-trip.
- **Bounds/dimensions:** compare bounding box and critical dimensions against requirements.
- **Topology:** vertices/edges/faces/components, boundary/non-manifold elements, winding/normals, Euler/genus where useful, duplicate/degenerate elements.
- **Geometry quality:** self-intersection, inverted/degenerate regions, curvature/feature preservation, resolution/approximation error.
- **Numerical behavior:** conditioning, precision, convergence, robust-predicate failures, reproducibility across seeds/platforms.
- **Domain acceptance:** structural/physical simulation, clearance/interference, manufacturing constraints, user experience, accessibility, or other task-specific tests.

## Mesh-audit limitations

The bundled utility reports basic file, bounds, face/vertex, watertight, winding, volume, and related signals through trimesh. It does not prove units, identify every self-intersection, certify printability, validate structural or physical behavior, or establish engineering correctness. Treat `is_watertight=false` as an investigation signal, not automatic irrelevance; a valid open surface may be intentional. Treat `true` as one narrow property only.

## Report language

Use “observed,” “computed,” “consistent with,” “failed check,” “not tested,” and “requires domain validation.” Include exact tool versions, input hash, parameters, and limitations. Never convert a warning-free report into “safe,” “certified,” “production-ready,” or “manufacturing-approved” without the responsible authority’s separate evidence.
