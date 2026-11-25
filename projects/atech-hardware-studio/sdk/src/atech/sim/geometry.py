"""Small, dependency-free 3-D maths for the exporters.

Quaternions are ``(w, x, y, z)``, the MuJoCo order. Matrices are row-major tuples.
"""

from __future__ import annotations

import math
from collections.abc import Iterable

Vec3 = tuple[float, float, float]
Quat = tuple[float, float, float, float]
Mat3 = tuple[Vec3, Vec3, Vec3]

IDENTITY_QUAT: Quat = (1.0, 0.0, 0.0, 0.0)


# ------------------------------------------------------------------ rotations


def quat_from_rpy_deg(rpy_deg: Vec3) -> Quat:
    """Roll about x, then pitch about y, then yaw about z (fixed axes; URDF rpy)."""
    r, p, y = (math.radians(a) / 2.0 for a in rpy_deg)
    cr, sr = math.cos(r), math.sin(r)
    cp, sp = math.cos(p), math.sin(p)
    cy, sy = math.cos(y), math.sin(y)
    return quat_normalize((
        cr * cp * cy + sr * sp * sy,
        sr * cp * cy - cr * sp * sy,
        cr * sp * cy + sr * cp * sy,
        cr * cp * sy - sr * sp * cy,
    ))


def quat_normalize(q: Quat) -> Quat:
    n = math.sqrt(sum(c * c for c in q))
    if n == 0.0:
        raise ValueError("zero quaternion")
    w, x, y, z = (c / n for c in q)
    if w < 0.0:  # one canonical sign keeps exported files stable
        w, x, y, z = -w, -x, -y, -z
    return (w, x, y, z)


def quat_mul(a: Quat, b: Quat) -> Quat:
    aw, ax, ay, az = a
    bw, bx, by, bz = b
    return (
        aw * bw - ax * bx - ay * by - az * bz,
        aw * bx + ax * bw + ay * bz - az * by,
        aw * by - ax * bz + ay * bw + az * bx,
        aw * bz + ax * by - ay * bx + az * bw,
    )


def quat_conj(q: Quat) -> Quat:
    return (q[0], -q[1], -q[2], -q[3])


def quat_rotate(q: Quat, v: Vec3) -> Vec3:
    _w, x, y, z = quat_mul(quat_mul(q, (0.0, v[0], v[1], v[2])), quat_conj(q))
    return (x, y, z)


def quat_to_matrix(q: Quat) -> Mat3:
    w, x, y, z = q
    return (
        (1 - 2 * (y * y + z * z), 2 * (x * y - w * z), 2 * (x * z + w * y)),
        (2 * (x * y + w * z), 1 - 2 * (x * x + z * z), 2 * (y * z - w * x)),
        (2 * (x * z - w * y), 2 * (y * z + w * x), 1 - 2 * (x * x + y * y)),
    )


def matrix_to_quat(m: Mat3) -> Quat:
    """Rotation matrix (proper, det +1) to a unit quaternion."""
    trace = m[0][0] + m[1][1] + m[2][2]
    if trace > 0.0:
        s = math.sqrt(trace + 1.0) * 2.0
        q = (0.25 * s, (m[2][1] - m[1][2]) / s, (m[0][2] - m[2][0]) / s, (m[1][0] - m[0][1]) / s)
    elif m[0][0] > m[1][1] and m[0][0] > m[2][2]:
        s = math.sqrt(1.0 + m[0][0] - m[1][1] - m[2][2]) * 2.0
        q = ((m[2][1] - m[1][2]) / s, 0.25 * s, (m[0][1] + m[1][0]) / s, (m[0][2] + m[2][0]) / s)
    elif m[1][1] > m[2][2]:
        s = math.sqrt(1.0 + m[1][1] - m[0][0] - m[2][2]) * 2.0
        q = ((m[0][2] - m[2][0]) / s, (m[0][1] + m[1][0]) / s, 0.25 * s, (m[1][2] + m[2][1]) / s)
    else:
        s = math.sqrt(1.0 + m[2][2] - m[0][0] - m[1][1]) * 2.0
        q = ((m[1][0] - m[0][1]) / s, (m[0][2] + m[2][0]) / s, (m[1][2] + m[2][1]) / s, 0.25 * s)
    return quat_normalize(q)


def compose(parent_pos: Vec3, parent_quat: Quat, child_pos: Vec3, child_quat: Quat) -> tuple[Vec3, Quat]:
    """Pose of ``child`` (given in ``parent``) expressed in the parent's parent."""
    rotated = quat_rotate(parent_quat, child_pos)
    pos = (parent_pos[0] + rotated[0], parent_pos[1] + rotated[1], parent_pos[2] + rotated[2])
    return pos, quat_normalize(quat_mul(parent_quat, child_quat))


def invert(pos: Vec3, quat: Quat) -> tuple[Vec3, Quat]:
    inv_q = quat_conj(quat)
    p = quat_rotate(inv_q, pos)
    return (-p[0], -p[1], -p[2]), quat_normalize(inv_q)


# -------------------------------------------------------------------- inertia


def box_inertia_diag(mass_kg: float, size_m: Vec3) -> Vec3:
    """Principal moments of a solid box about its centre, kg*m^2."""
    x, y, z = size_m
    k = mass_kg / 12.0
    return (k * (y * y + z * z), k * (x * x + z * z), k * (x * x + y * y))


def composite_inertia(boxes: Iterable[tuple[float, Vec3, Vec3]]) -> tuple[float, Vec3, Mat3]:
    """Total mass, centre of mass and inertia tensor about the COM.

    ``boxes`` yields ``(mass_kg, size_m, centre_m)`` for axis-aligned boxes.
    """
    items = list(boxes)
    mass = sum(m for m, _, _ in items)
    com = tuple(sum(m * c[i] for m, _, c in items) / mass for i in range(3))
    tensor = [[0.0] * 3 for _ in range(3)]
    for m, size, centre in items:
        diag = box_inertia_diag(m, size)
        d = tuple(centre[i] - com[i] for i in range(3))
        d2 = d[0] * d[0] + d[1] * d[1] + d[2] * d[2]
        for i in range(3):
            for j in range(3):
                own = diag[i] if i == j else 0.0
                tensor[i][j] += own + m * ((d2 if i == j else 0.0) - d[i] * d[j])
    t = tuple(tuple(row) for row in tensor)
    return mass, com, t  # type: ignore[return-value]


def principal_axes(tensor: Mat3) -> tuple[Vec3, Quat]:
    """Eigen-decompose a symmetric 3x3 tensor (Jacobi): moments and the rotation
    whose columns are the principal axes, as a quaternion."""
    a = [list(row) for row in tensor]
    v = [[1.0 if i == j else 0.0 for j in range(3)] for i in range(3)]
    for _ in range(50):
        off = max(abs(a[0][1]), abs(a[0][2]), abs(a[1][2]))
        if off < 1e-18:
            break
        for p, q in ((0, 1), (0, 2), (1, 2)):
            if abs(a[p][q]) < 1e-30:
                continue
            theta = (a[q][q] - a[p][p]) / (2.0 * a[p][q])
            t = math.copysign(1.0, theta) / (abs(theta) + math.sqrt(theta * theta + 1.0))
            c = 1.0 / math.sqrt(t * t + 1.0)
            s = t * c
            for k in range(3):
                akp, akq = a[k][p], a[k][q]
                a[k][p] = c * akp - s * akq
                a[k][q] = s * akp + c * akq
            for k in range(3):
                apk, aqk = a[p][k], a[q][k]
                a[p][k] = c * apk - s * aqk
                a[q][k] = s * apk + c * aqk
            for k in range(3):
                vkp, vkq = v[k][p], v[k][q]
                v[k][p] = c * vkp - s * vkq
                v[k][q] = s * vkp + c * vkq
    moments = (a[0][0], a[1][1], a[2][2])
    det = (
        v[0][0] * (v[1][1] * v[2][2] - v[1][2] * v[2][1])
        - v[0][1] * (v[1][0] * v[2][2] - v[1][2] * v[2][0])
        + v[0][2] * (v[1][0] * v[2][1] - v[1][1] * v[2][0])
    )
    if det < 0.0:  # keep a right-handed frame
        for k in range(3):
            v[k][2] = -v[k][2]
    m = tuple(tuple(row) for row in v)
    return moments, matrix_to_quat(m)  # type: ignore[arg-type]


# ----------------------------------------------------------------------- mesh

# Faces of a unit box, counter-clockwise seen from outside (right-handed).
_BOX_FACES: tuple[tuple[tuple[int, int, int, int], Vec3], ...] = (
    ((0, 3, 2, 1), (0.0, 0.0, -1.0)),
    ((4, 5, 6, 7), (0.0, 0.0, 1.0)),
    ((0, 1, 5, 4), (0.0, -1.0, 0.0)),
    ((2, 3, 7, 6), (0.0, 1.0, 0.0)),
    ((0, 4, 7, 3), (-1.0, 0.0, 0.0)),
    ((1, 2, 6, 5), (1.0, 0.0, 0.0)),
)


def box_mesh(size_m: Vec3, centre_m: Vec3) -> tuple[list[Vec3], list[int], list[int], list[Vec3]]:
    """Points, face vertex counts, face vertex indices and face-varying normals."""
    hx, hy, hz = (s / 2.0 for s in size_m)
    cx, cy, cz = centre_m
    points: list[Vec3] = [
        (cx - hx, cy - hy, cz - hz),
        (cx + hx, cy - hy, cz - hz),
        (cx + hx, cy + hy, cz - hz),
        (cx - hx, cy + hy, cz - hz),
        (cx - hx, cy - hy, cz + hz),
        (cx + hx, cy - hy, cz + hz),
        (cx + hx, cy + hy, cz + hz),
        (cx - hx, cy + hy, cz + hz),
    ]
    counts: list[int] = []
    indices: list[int] = []
    normals: list[Vec3] = []
    for face, normal in _BOX_FACES:
        counts.append(4)
        indices.extend(face)
        normals.extend([normal] * 4)
    return points, counts, indices, normals


def bounds(parts: Iterable[tuple[Vec3, Vec3]]) -> tuple[Vec3, Vec3]:
    """Axis-aligned bounds of boxes given as ``(size_m, centre_m)``."""
    lo = [math.inf] * 3
    hi = [-math.inf] * 3
    for size, centre in parts:
        for i in range(3):
            lo[i] = min(lo[i], centre[i] - size[i] / 2.0)
            hi[i] = max(hi[i], centre[i] + size[i] / 2.0)
    return (lo[0], lo[1], lo[2]), (hi[0], hi[1], hi[2])
