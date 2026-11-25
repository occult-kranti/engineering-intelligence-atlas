"""Docs that ship inside the package, so they exist wherever the SDK is installed.

``atech guide`` prints the guide for coding agents; ``atech guide protocol`` the
wire format; ``atech guide sim`` the simulation-asset reference; ``atech guide flash`` finding
and flashing the board on Linux, macOS and Windows. ``atech new`` copies the guide into the
project as AGENTS.md / CLAUDE.md.
"""

from __future__ import annotations

from importlib.resources import files

_DOCS = {
    "guide": "guide.md",
    "protocol": "protocol.md",
    "sim": "sim_assets.md",
    "flash": "flashing.md",
}


def read_doc(name: str) -> str:
    """Text of a bundled doc: ``"guide"``, ``"protocol"``, ``"sim"`` or ``"flash"``."""
    return (files("atech.docs") / _DOCS[name]).read_text(encoding="utf-8")
