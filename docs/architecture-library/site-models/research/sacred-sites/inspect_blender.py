"""Run with Blender --background --factory-startup --disable-autoexec --python.
Preserve the source mesh; export an inspection GLB and a neutral colour preview.
"""
import argparse, hashlib, json, math, pathlib, sys, time
import bpy
import numpy as np
from mathutils import Vector
p=argparse.ArgumentParser();p.add_argument('--input',required=True,type=pathlib.Path);p.add_argument('--output',required=True,type=pathlib.Path);a=p.parse_args(sys.argv[sys.argv.index('--')+1:])
if not a.input.is_absolute() or not a.input.is_file() or not a.output.is_absolute() or a.output.exists():raise ValueError('Existing absolute input and new absolute output required')
a.output.mkdir()
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
source_triangles=0;source_repeated_indices=0
with a.input.open('rb') as f:
 for line in f:
  if line.startswith(b'f '):
   indices=[v.split(b'/')[0] for v in line.split()[1:]];source_triangles+=len(indices)-2;source_repeated_indices+=int(len(set(indices))!=len(indices))
t0=time.monotonic();bpy.ops.wm.obj_import(filepath=str(a.input),forward_axis='Y',up_axis='Z')
meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
assert meshes,'No mesh imported'
rows=[];mins=[];maxs=[]
for obj in meshes:
 m=obj.data;m.calc_loop_triangles();coords=np.empty(len(m.vertices)*3,dtype=np.float32);m.vertices.foreach_get('co',coords);coords=coords.reshape(-1,3)
 assert np.isfinite(coords).all(),'Non-finite mesh';assert obj.matrix_world==obj.matrix_world.__class__.Identity(4),'Unexpected source transform'
 lo=coords.min(axis=0);hi=coords.max(axis=0);mins.append(lo);maxs.append(hi)
 colours=[{'name':c.name,'domain':c.domain,'type':c.data_type,'elements':len(c.data)} for c in m.color_attributes]
 rows.append({'name':obj.name,'vertices':len(m.vertices),'polygons':len(m.polygons),'triangles':len(m.loop_triangles),'colourAttributes':colours,'uvLayers':len(m.uv_layers),'sourceBounds':{'minimum':lo.tolist(),'maximum':hi.tolist()},'matrixWorld':[list(row) for row in obj.matrix_world]})
 # Source OBJ declares an unavailable MTL. Bind existing captured vertex colours.
 if m.color_attributes:
  mat=bpy.data.materials.new('Captured_vertex_colour');mat.use_nodes=True;mat.node_tree.nodes.clear()
  output=mat.node_tree.nodes.new('ShaderNodeOutputMaterial');emission=mat.node_tree.nodes.new('ShaderNodeEmission');attr=mat.node_tree.nodes.new('ShaderNodeVertexColor');attr.layer_name=m.color_attributes[0].name;mat.node_tree.links.new(attr.outputs['Color'],emission.inputs['Color']);mat.node_tree.links.new(emission.outputs[0],output.inputs['Surface']);m.materials.clear();m.materials.append(mat)
for o in bpy.context.scene.objects:o.select_set(o in meshes)
bpy.context.view_layer.objects.active=meshes[0]
bpy.ops.export_scene.gltf(filepath=str(a.output/'converted.glb'),export_format='GLB',use_selection=True,export_apply=False,export_yup=True,export_normals=True,export_texcoords=True,export_vertex_color='ACTIVE')
receipt={'schemaVersion':1,'blenderVersion':bpy.app.version_string,'blenderBuildHash':bpy.app.build_hash.decode(),'sourceFile':a.input.name,'sourceSha256':hashlib.sha256(a.input.read_bytes()).hexdigest(),'sourceUnits':'unverified; no metric rescale or normalization applied','sourceAxisConvention':'unverified; XYZ imported unchanged using Y-forward/Z-up setting','displayMaterial':'captured per-vertex colour via emission; no image textures synthesized','glTFConvention':'standard Y-up conversion by Blender exporter','meshes':rows,'meshCount':len(meshes),'vertices':sum(r['vertices'] for r in rows),'triangles':sum(r['triangles'] for r in rows),'importAndExportSeconds':round(time.monotonic()-t0,3),'lodReductionApplied':False}
receipt.update({'assetRole':'inspection derivative; raw OBJ is source master','sourceTriangles':source_triangles,'sourceFacesWithRepeatedVertexIndex':source_repeated_indices,'removedFacesOnImport':source_triangles-receipt['triangles'],'strictSourceTriangleEquality':source_triangles==receipt['triangles']})
lo=np.min(mins,axis=0);hi=np.max(maxs,axis=0);center=Vector(((lo+hi)/2).tolist());extent=float(np.max(hi-lo));camera_data=bpy.data.cameras.new('EvidenceCamera');camera=bpy.data.objects.new('EvidenceCamera',camera_data);bpy.context.collection.objects.link(camera);camera.location=center+Vector((1.25,-1.5,1.0))*extent;camera.rotation_euler=(center-camera.location).to_track_quat('-Z','Y').to_euler();camera_data.type='ORTHO';camera_data.ortho_scale=extent*1.55;camera_data.clip_end=extent*20;bpy.context.scene.camera=camera
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=4;scene.render.resolution_x=512;scene.render.resolution_y=384;scene.render.resolution_percentage=100;scene.render.image_settings.file_format='PNG';scene.render.filepath=str(a.output/'preview.png');scene.world.color=(0.05,0.05,0.05);scene.view_settings.view_transform='Standard';bpy.ops.render.render(write_still=True)
receipt['elapsedSeconds']=round(time.monotonic()-t0,3);receipt['outputs']=[{'file':f.name,'bytes':f.stat().st_size,'sha256':hashlib.sha256(f.read_bytes()).hexdigest()} for f in [a.output/'converted.glb',a.output/'preview.png']]
(a.output/'blender-inspection.json').write_text(json.dumps(receipt,indent=2)+'\n');print('SACRED_SITE_INSPECTION '+json.dumps(receipt),flush=True)
