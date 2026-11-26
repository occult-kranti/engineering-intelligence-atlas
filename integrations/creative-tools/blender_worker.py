"""Fixed Daftar Blender adapter. Never evaluates caller Python or saved text blocks.

The service starts Blender with factory settings and automatic script execution
disabled. Reviewed .blend inputs must embed their resources. This adapter is not
a sandbox for hostile Blender files; the deployment still needs OS isolation.
"""
import json
import importlib.util
import sys
import time
from pathlib import Path

import bpy

sys.dont_write_bytecode = True

# Import only the reviewed sibling helper, independent of the project directory.
device_spec = importlib.util.spec_from_file_location("daftar_blender_device", Path(__file__).with_name("blender_device.py"))
device_module = importlib.util.module_from_spec(device_spec)
device_spec.loader.exec_module(device_module)


def bounded(value, minimum, maximum):
    if isinstance(value, bool) or not isinstance(value, int) or not minimum <= value <= maximum:
        raise ValueError("Invalid bounded render setting")
    return value


def main():
    arguments = sys.argv[sys.argv.index("--") + 1:]
    if len(arguments) not in {4, 5}:
        raise ValueError("Expected fixed creative arguments")
    operation, source, destination, raw = arguments[:4]
    render_policy = json.loads(arguments[4]) if len(arguments) == 5 else {"backend": "CPU", "deviceIndex": 0}
    if not isinstance(render_policy, dict) or set(render_policy) != {"backend", "deviceIndex"}:
        raise ValueError("Expected reviewed device policy")
    if operation not in {"blender.inspect", "blender.render", "blender.export_glb"}:
        raise ValueError("Unsupported Blender operation")
    parameters = json.loads(raw)
    source = Path(source)
    destination = Path(destination)
    if not source.is_file() or source.is_symlink() or not destination.is_dir() or destination.is_symlink():
        raise ValueError("Unsafe fixed adapter paths")
    if source.suffix.lower() != ".blend":
        raise ValueError("Expected a blend document")
    bpy.context.preferences.filepaths.use_scripts_auto_execute = False
    bpy.ops.wm.open_mainfile(filepath=str(source), load_ui=False, use_scripts=False)

    # Relative dependencies would resolve against a different directory in the
    # staged copy. Reject them instead of silently reading another host path.
    if len(bpy.data.libraries):
        raise ValueError("Linked libraries must be made local before review")
    for image in bpy.data.images:
        if image.source not in {"GENERATED", "VIEWER"} and not image.packed_file:
            raise ValueError("Pack all image resources before review")
    for group in (bpy.data.sounds, bpy.data.movieclips, bpy.data.volumes, bpy.data.cache_files):
        if any(getattr(item, "filepath", "") for item in group):
            raise ValueError("External media and caches are not enabled")
    for font in bpy.data.fonts:
        if font.filepath and font.filepath != "<builtin>" and not getattr(font, "packed_file", None):
            raise ValueError("Pack external fonts before review")
    if len(bpy.data.objects) > 10000 or sum(len(mesh.vertices) for mesh in bpy.data.meshes) > 2000000:
        raise ValueError("Document geometry exceeds the bounded adapter limit")
    for scene in bpy.data.scenes:
        scene.render.use_compositing = False
        scene.render.use_sequencer = False
        scene.use_nodes = False
        scene.render.threads_mode = "FIXED"
        scene.render.threads = 2

    scene = bpy.context.scene
    if operation == "blender.inspect":
        result = {
            "format": "blend", "blenderVersion": bpy.app.version_string,
            "objects": len(bpy.data.objects), "meshes": len(bpy.data.meshes),
            "materials": len(bpy.data.materials), "scenes": len(bpy.data.scenes),
            "cameras": len(bpy.data.cameras), "lights": len(bpy.data.lights),
            "frameStart": scene.frame_start, "frameEnd": scene.frame_end,
        }
        with (destination / "inspection.json").open("x", encoding="utf-8") as output:
            json.dump(result, output, separators=(",", ":"))
    elif operation == "blender.render":
        frame = bounded(parameters["frame"], 0, 100000)
        width = bounded(parameters["width"], 16, 2048)
        height = bounded(parameters["height"], 16, 2048)
        samples = bounded(parameters["samples"], 1, 64)
        if scene.camera is None:
            raise ValueError("A reviewed render camera is required")
        scene.render.engine = "CYCLES"
        try:
            device = device_module.select_cycles_device(bpy, scene, render_policy["backend"], render_policy["deviceIndex"])
        except device_module.DeviceSelectionError:
            print("DAFTAR_DEVICE_ERROR=GPU_DEVICE_UNAVAILABLE", file=sys.stderr, flush=True)
            raise
        scene.cycles.samples = samples
        scene.cycles.use_denoising = False
        scene.render.resolution_x = width
        scene.render.resolution_y = height
        scene.render.resolution_percentage = 100
        scene.render.image_settings.file_format = "PNG"
        scene.render.image_settings.color_mode = "RGBA"
        scene.render.image_settings.color_depth = "8"
        scene.render.use_file_extension = True
        scene.render.filepath = str(destination / "render.png")
        scene.frame_set(frame)
        started = time.monotonic()
        bpy.ops.render.render(write_still=True)
        result = {"format": "png", "frame": frame, "width": width,
                  "height": height, "samples": samples, "engine": "CYCLES",
                  **device, "renderDurationSeconds": round(time.monotonic() - started, 6)}
    else:
        bpy.ops.export_scene.gltf(filepath=str(destination / "scene.glb"),
                                  export_format="GLB", export_animations=False,
                                  export_apply=False, use_selection=False)
        result = {"format": "glb", "objects": len(bpy.data.objects)}
    print("DAFTAR_RESULT=" + json.dumps(result, separators=(",", ":")), flush=True)


if __name__ == "__main__":
    main()
