"""Run only with a verified Blender binary; writes a tiny CPU scene to -- OUTPUT.

blender --background --factory-startup --disable-autoexec --threads 2 \
  --python-exit-code 1 --python deploy/creative/smoke_blender.py -- /absolute/output
"""
import hashlib
import json
from pathlib import Path
import sys
import time

sys.dont_write_bytecode = True

import bpy


def main():
    args = sys.argv[sys.argv.index("--") + 1:]
    if len(args) != 1:
        raise ValueError("Provide one new, absolute output directory after --")
    target = Path(args[0])
    if not target.is_absolute() or ".." in target.parts or target.exists():
        raise ValueError("Output must be a new absolute directory without '..'")
    if any(parent.is_symlink() for parent in target.parents):
        raise ValueError("Output ancestors must not be symlinks")
    target.mkdir(parents=True, mode=0o700)
    started = time.monotonic()
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = 4
    scene.cycles.use_denoising = False
    scene.render.threads_mode = "FIXED"
    scene.render.threads = 2
    scene.render.resolution_x = 96
    scene.render.resolution_y = 96
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.filepath = str(target / "render.png")
    bpy.ops.wm.save_as_mainfile(filepath=str(target / "scene.blend"))
    bpy.ops.render.render(write_still=True)
    bpy.ops.export_scene.gltf(filepath=str(target / "scene.glb"), export_format="GLB")
    artifacts = []
    for path in sorted(target.iterdir()):
        if not path.is_file() or path.stat().st_size == 0:
            raise RuntimeError("Smoke artifact is missing or empty")
        artifacts.append({"name": path.name, "bytes": path.stat().st_size,
                          "sha256": hashlib.sha256(path.read_bytes()).hexdigest()})
    result = {"ok": True, "blenderVersion": bpy.app.version_string,
              "engine": "CYCLES", "device": "CPU", "threads": 2, "samples": 4,
              "width": 96, "height": 96, "elapsedSeconds": round(time.monotonic() - started, 3),
              "artifacts": artifacts, "gpuTested": False, "vpsProvisioned": False}
    (target / "receipt.json").write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print("DAFTAR_CREATIVE_SMOKE=" + json.dumps(result, sort_keys=True))


if __name__ == "__main__":
    main()
