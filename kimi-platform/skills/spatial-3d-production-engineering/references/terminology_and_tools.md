# Terminology and tool routing

## Contents

- 4D/5D meanings
- Tool selection
- Licensing and interoperability

## 4D/5D meanings

| Context | Working meaning | Required clarification |
|---|---|---|
| Time-based 3D media | Geometry, animation, simulation, capture, or volumetric content varying over time | Specify timeline, frame/sample rate, duration, cache format, and playback/interaction needs |
| BIM | 4D links model elements to schedule; 5D adds cost/estimating information | Specify information requirements, model-element mapping, schedule/cost data, and validation owner |
| 4D printing | Fabricated objects whose shape/properties change over time in response to stimuli | Identify material, stimulus, mechanism, reversible behavior, and experimental validation |
| “5D printing” | May be vendor/marketing language for multi-axis or non-planar deposition, not a universal dimensional standard | Ask for machine/process/axes/toolpath definition; do not infer a standardized technology |
| Higher BIM dimensions | Sustainability/facility-management/safety/other labels vary by vendor/framework | Do not assume consensus beyond 5D; specify information requirements instead |

## Tool selection

| Need | Candidate tools and official sources | Selection cautions |
|---|---|---|
| Visual 3D/asset production | Blender — https://www.blender.org/ and manual https://docs.blender.org/manual/en/latest/ | GPL software; user artwork is separate; add-ons need review. Not a tolerance-grade engineering certification tool |
| Parametric CAD | FreeCAD — https://freecad.org/; OpenSCAD — https://openscad.org/; CadQuery — https://cadquery.readthedocs.io/; build123d — https://build123d.readthedocs.io/ | Choose by B-rep/CSG/parametric needs, kernel behavior, scripting, export, and validation |
| Slicing/toolpaths | PrusaSlicer — https://github.com/prusa3d/PrusaSlicer; OrcaSlicer — https://github.com/OrcaSlicer/OrcaSlicer; Cura — https://github.com/Ultimaker/Cura | AGPL/LGPL components differ; machine/material/profile compatibility and output review are mandatory |
| Firmware/operations | Marlin — https://github.com/MarlinFirmware/Marlin; Klipper — https://github.com/Klipper3d/klipper; OctoPrint — https://github.com/OctoPrint/OctoPrint | GPL/AGPL; physical safety and network access need explicit controls |
| Real-time web 3D | Three.js — https://threejs.org/; Babylon.js — https://www.babylonjs.com/ | MIT/Apache respectively; profile target devices and provide accessible fallback |
| XR | WebXR — https://immersive-web.github.io/webxr/; OpenXR — https://www.khronos.org/openxr/ | Browser/runtime/device support, ergonomics, privacy, and input accessibility vary |
| Game/immersive engines | Godot — https://godotengine.org/; Unity — https://unity.com/; Unreal — https://www.unrealengine.com/ | Godot MIT; Unity proprietary; Unreal source-available/EULA. Check current commercial terms |
| Scene/asset interchange | OpenUSD — https://openusd.org/; glTF — https://www.khronos.org/gltf/; glTF Validator — https://github.com/KhronosGroup/glTF-Validator | Check extensions, units, coordinates, versions, and composed-scene semantics |
| Volumetric/simulation | OpenVDB — https://www.openvdb.org/; Blender simulation tools; OpenFOAM — https://www.openfoam.com/ | Visual plausibility is not physical validation; preserve caches and settings |
| BIM/openBIM | buildingSMART — https://www.buildingsmart.org/standards/; IfcOpenShell — https://github.com/IfcOpenShell/IfcOpenShell; Bonsai — https://bonsaibim.org/ | Specify IFC/IDS/BCF requirements and tool support; do not reduce BIM to a 3D model |

## Licensing and interoperability

Do not infer redistribution rights from a public repository or a parent project. Review the root license, per-folder notices, dependencies, model/assets, fonts, proprietary tools, output-sharing terms, and network-copyleft implications. Source-available and proprietary are not OSI open source. For linked standards and commercial software, record edition/version and access terms rather than copying content into deliverables.
