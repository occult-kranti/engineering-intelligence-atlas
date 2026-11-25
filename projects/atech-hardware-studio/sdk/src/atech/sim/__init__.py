"""Simulation assets for Atech modules and boards: USD (SimReady), MJCF and URDF.

Physical data lives in ``sim.yaml`` next to each catalog ``module.yaml`` and in
``catalog/data/boards/sim/<id>.sim.yaml``. Box sizes are the bounds of Atech's CAD
where a model exists; masses (and the fields each file lists under
``placeholders:``) are guesses until Atech publishes datasheets. Reference:
``atech/docs/sim_assets.md``.

The real CAD can replace the box visuals (:mod:`atech.sim.meshes`); it is not
bundled. USD export and reading the CAD need ``pip install "atech[sim]"``
(usd-core, trimesh).
"""

from atech.sim.export import FORMATS, export, export_spec, parse_formats
from atech.sim.meshes import (
    CadVisual,
    MeshesUnavailableError,
    MeshLibrary,
    MeshPart,
    fetch_glb_dir,
    mesh_library,
)
from atech.sim.mjcf import (
    board_mjcf_body,
    module_mjcf_body,
    module_mjcf_sensors,
    spec_mjcf_assets,
    spec_mjcf_body,
    spec_mjcf_sensors,
    spec_mjcf_xml,
)
from atech.sim.model import MassProperties, mass_properties, module_pose_on_board
from atech.sim.spec import (
    BoxPart,
    DeviceBlock,
    Frame,
    PortFrame,
    SimSpec,
    SimSpecError,
    load_board_sim,
    load_module_sim,
    sim_board_ids,
    sim_module_ids,
)
from atech.sim.urdf import board_urdf_link, module_urdf_link, spec_urdf, spec_urdf_link
from atech.sim.usd import UsdUnavailableError, usd_available, write_usd

__all__ = [
    "FORMATS",
    "BoxPart",
    "CadVisual",
    "DeviceBlock",
    "Frame",
    "MassProperties",
    "MeshLibrary",
    "MeshPart",
    "MeshesUnavailableError",
    "PortFrame",
    "SimSpec",
    "SimSpecError",
    "UsdUnavailableError",
    "board_mjcf_body",
    "board_urdf_link",
    "export",
    "export_spec",
    "fetch_glb_dir",
    "load_board_sim",
    "load_module_sim",
    "mass_properties",
    "mesh_library",
    "module_mjcf_body",
    "module_mjcf_sensors",
    "module_pose_on_board",
    "module_urdf_link",
    "parse_formats",
    "sim_board_ids",
    "sim_module_ids",
    "spec_mjcf_assets",
    "spec_mjcf_body",
    "spec_mjcf_sensors",
    "spec_mjcf_xml",
    "spec_urdf",
    "spec_urdf_link",
    "usd_available",
    "write_usd",
]
