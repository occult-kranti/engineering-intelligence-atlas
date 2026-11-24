"""A 256x256 top-down PNG of an asset (SimReady SR.002 asks for one), pure Python.

It is a flat orthographic drawing of the box parts seen from +z, not a render.
"""

from __future__ import annotations

import struct
import zlib
from pathlib import Path

from atech.sim.spec import SimSpec

SIZE_PX = 256
_MARGIN_PX = 16
_BACKGROUND = (226, 228, 232)


def _png(width: int, height: int, rows: list[bytearray]) -> bytes:
    def chunk(tag: bytes, data: bytes) -> bytes:
        body = tag + data
        return struct.pack(">I", len(data)) + body + struct.pack(">I", zlib.crc32(body) & 0xFFFFFFFF)

    raw = b"".join(b"\x00" + bytes(r) for r in rows)
    header = struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)
    return (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", header)
        + chunk(b"IDAT", zlib.compress(raw, 9))
        + chunk(b"IEND", b"")
    )


def render_top_view(spec: SimSpec) -> bytes:
    """PNG bytes, 256x256, RGB."""
    rows = [bytearray(_BACKGROUND * SIZE_PX) for _ in range(SIZE_PX)]
    xs = [p.pos_m[0] + s * p.size_m[0] / 2 for p in spec.parts for s in (-1, 1)]
    ys = [p.pos_m[1] + s * p.size_m[1] / 2 for p in spec.parts for s in (-1, 1)]
    span = max(max(xs) - min(xs), max(ys) - min(ys))
    scale = (SIZE_PX - 2 * _MARGIN_PX) / span
    cx, cy = (max(xs) + min(xs)) / 2, (max(ys) + min(ys)) / 2

    def to_px(x: float, y: float) -> tuple[int, int]:
        col = round(SIZE_PX / 2 + (x - cx) * scale)
        row = round(SIZE_PX / 2 - (y - cy) * scale)  # image rows grow downwards
        return col, row

    for part in sorted(spec.parts, key=lambda p: p.pos_m[2] + p.size_m[2] / 2):
        rgba = spec.colors[part.color]
        alpha = rgba[3]
        fill = tuple(
            round(255 * (c * alpha + (b / 255) * (1 - alpha)))
            for c, b in zip(rgba[:3], _BACKGROUND, strict=True)
        )
        edge = tuple(max(0, round(c * 0.6)) for c in fill)
        c0, r0 = to_px(part.pos_m[0] - part.size_m[0] / 2, part.pos_m[1] + part.size_m[1] / 2)
        c1, r1 = to_px(part.pos_m[0] + part.size_m[0] / 2, part.pos_m[1] - part.size_m[1] / 2)
        c0, c1 = max(0, c0), min(SIZE_PX - 1, max(c0, c1 - 1))
        r0, r1 = max(0, r0), min(SIZE_PX - 1, max(r0, r1 - 1))
        for r in range(r0, r1 + 1):
            row = rows[r]
            for c in range(c0, c1 + 1):
                colour = edge if r in (r0, r1) or c in (c0, c1) else fill
                row[3 * c:3 * c + 3] = bytes(colour)
    return _png(SIZE_PX, SIZE_PX, rows)


def thumbnail_path(asset_file: Path) -> Path:
    """``<dir>/.thumbs/256x256/<file name>.png``, the SimReady location."""
    return asset_file.parent / ".thumbs" / f"{SIZE_PX}x{SIZE_PX}" / f"{asset_file.name}.png"


def write_thumbnail(spec: SimSpec, asset_file: Path) -> Path:
    out = thumbnail_path(asset_file)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_bytes(render_top_view(spec))
    return out
