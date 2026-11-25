"""Run inside Blender on a supplied decompressed GLB; preserve model transforms.

blender --background --factory-startup --disable-autoexec --python render_preview.py -- \
  --source /path/model.decompressed.glb --output /path/review
"""
import argparse
import hashlib
import json
import math
import sys
import time
from pathlib import Path
import bpy
from mathutils import Vector

args = argparse.ArgumentParser()
args.add_argument('--source', type=Path, required=True)
args.add_argument('--output', type=Path, required=True)
args.add_argument('--save-blend', action='store_true')
parsed = args.parse_args(sys.argv[sys.argv.index('--') + 1:])
source = parsed.source.resolve(strict=True)
if source.suffix.lower() != '.glb' or source.stat().st_size > 300 * 1024 * 1024:
    raise ValueError('Supply a bounded decompressed GLB')
parsed.output.mkdir(parents=True, exist_ok=True)
start = time.monotonic()
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(source))
meshes = [obj for obj in bpy.context.scene.objects if obj.type == 'MESH']
points = [obj.matrix_world @ Vector(corner) for obj in meshes for corner in obj.bound_box]
if not points:
    raise ValueError('No imported mesh')
minimum = Vector([min(point[axis] for point in points) for axis in range(3)])
maximum = Vector([max(point[axis] for point in points) for axis in range(3)])
centre = (minimum + maximum) / 2
radius = (maximum - minimum).length / 2
if not math.isfinite(radius) or radius <= 0:
    raise ValueError('Invalid model bounds')
triangles = 0
for obj in meshes:
    obj.data.calc_loop_triangles()
    triangles += len(obj.data.loop_triangles)
scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.device = 'CPU'
scene.cycles.samples = 8
scene.render.threads_mode = 'FIXED'
scene.render.threads = 4
scene.render.resolution_x = 512
scene.render.resolution_y = 384
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.view_settings.view_transform = 'Standard'
world = bpy.data.worlds.new('Inspection lighting')
world.use_nodes = True
world.node_tree.nodes['Background'].inputs['Color'].default_value = (.28, .30, .26, 1)
world.node_tree.nodes['Background'].inputs['Strength'].default_value = .8
scene.world = world
camera_data = bpy.data.cameras.new('Inspection camera')
camera = bpy.data.objects.new('Inspection camera', camera_data)
scene.collection.objects.link(camera)
camera.location = centre + Vector((1.15, -1.7, 1.25)).normalized() * radius * 3.5
camera.rotation_euler = (centre - camera.location).to_track_quat('-Z', 'Y').to_euler()
camera_data.type = 'ORTHO'
camera_data.ortho_scale = radius * 2.6
camera_data.clip_start = max(radius / 10000, .00001)
camera_data.clip_end = radius * 100
scene.camera = camera
light_data = bpy.data.lights.new('Inspection sun', 'SUN')
light_data.energy = 1.8
light = bpy.data.objects.new('Inspection sun', light_data)
scene.collection.objects.link(light)
light.rotation_euler = (.3, -.4, -.6)
scene.render.filepath = str(parsed.output / 'preview.png')
bpy.ops.render.render(write_still=True)
if parsed.save_blend:
    bpy.ops.wm.save_as_mainfile(filepath=str(parsed.output / 'working-copy.blend'))
receipt = {
    'schemaVersion': 1, 'sourceFile': source.name,
    'sourceSha256': hashlib.sha256(source.read_bytes()).hexdigest(),
    'blenderVersion': bpy.app.version_string,
    'blenderBuildHash': bpy.app.build_hash.decode(),
    'meshObjects': len(meshes), 'vertices': sum(len(obj.data.vertices) for obj in meshes),
    'triangles': triangles, 'modelTransformsModified': False,
    'physicalUnitsVerified': False, 'scaleOrRegistrationApplied': False,
    'boundsInBlenderSceneCoordinates': {'minimum': list(minimum), 'maximum': list(maximum)},
    'render': {'engine': 'Cycles', 'device': 'CPU', 'samples': 8, 'width': 512, 'height': 384},
    'elapsedSeconds': round(time.monotonic() - start, 3),
    'outputs': [{'file': file.name, 'bytes': file.stat().st_size, 'sha256': hashlib.sha256(file.read_bytes()).hexdigest()}
                for file in sorted(parsed.output.iterdir()) if file.name in ['preview.png', 'working-copy.blend']],
    'limits': 'Blender importer representation; compare its counts with the source. Rendering does not establish metric accuracy, source completeness or calibrated appearance.'
}
(parsed.output / 'blender-inspection.json').write_text(json.dumps(receipt, indent=2) + '\n')
print(json.dumps({'source': source.name, 'status': 'rendered', 'triangles': triangles, 'seconds': receipt['elapsedSeconds']}))
