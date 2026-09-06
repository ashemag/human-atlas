"""Render matched front/back/side views of two anatomy revisions for silhouette review."""
import argparse, importlib.util, sys
from pathlib import Path
import bpy
import numpy as np
from mathutils import Vector
spec=importlib.util.spec_from_file_location('audit',Path(__file__).with_name('pelvis-surface-audit.py'));audit=importlib.util.module_from_spec(spec);spec.loader.exec_module(audit)
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--before-root',type=Path,required=True)
parser.add_argument('--after-root',type=Path,required=True)
parser.add_argument('--output-dir',type=Path,required=True)
parser.add_argument('--closeup',action='store_true',help='Frame pelvis and upper thigh for contour review.')
parser.add_argument('--views',nargs='+',choices=['front','back','side'],default=['front','back','side'])
args=parser.parse_args(sys.argv[sys.argv.index('--')+1:]);args.output_dir.mkdir(parents=True,exist_ok=True)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=24;scene.cycles.use_denoising=False
scene.render.resolution_x=1050;scene.render.resolution_y=1250;scene.render.resolution_percentage=100
scene.world.color=(.55,.55,.55);scene.view_settings.view_transform='Standard'
colors={'skeletal':(.76,.70,.54,1),'muscular':(.46,.16,.125,1),'mammary':(.72,.53,.27,1)}
materials={}
for group,color in colors.items():
 material=bpy.data.materials.new(group);material.use_nodes=True;bsdf=material.node_tree.nodes.get('Principled BSDF');bsdf.inputs['Base Color'].default_value=color;bsdf.inputs['Roughness'].default_value=.7;materials[group]=material
models=[]
for folder,offset,label in [(args.before_root,-.38,'Before'),(args.after_root,.38,'After')]:
 offset=offset*.58 if args.closeup else offset
 atlas=audit.Atlas(folder,'atlas-female-reconstructed.json');objects=[]
 for group in colors:
  ids=[p['id'] for p in atlas.parts.values() if p['system']==group and (group!='mammary' or p['id'] in ['VH_F_fat_L','VH_F_fat_R'])]
  vertices,faces=atlas.mesh(ids)
  mesh=bpy.data.meshes.new(label+' '+group);mesh.from_pydata(vertices.tolist(),[],faces.tolist());mesh.update();obj=bpy.data.objects.new(mesh.name,mesh);scene.collection.objects.link(obj);obj.data.materials.append(materials[group]);objects.append(obj)
  for polygon in mesh.polygons:polygon.use_smooth=True
 models.append((objects,offset))
 text=bpy.data.curves.new(label,'FONT');text.body=label;text.align_x='CENTER';text.size=.025 if args.closeup else .045
 obj=bpy.data.objects.new(label,text);scene.collection.objects.link(obj);obj.location=(offset,1.28,.5) if args.closeup else (offset,1.72,.1)
camera=bpy.data.cameras.new('Camera');obj=bpy.data.objects.new('Camera',camera);scene.collection.objects.link(obj);obj.location=(0,.84,4);camera.type='ORTHO';camera.ortho_scale=.95 if args.closeup else 1.94;scene.camera=obj
if args.closeup:obj.location.y=.84
for name,position,energy,size in [('Key',(-2,3,4),450,4),('Fill',(2,1,3),240,3)]:
 light=bpy.data.lights.new(name,'AREA');light.energy=energy;light.shape='DISK';light.size=size;obj=bpy.data.objects.new(name,light);scene.collection.objects.link(obj);obj.location=position;obj.rotation_euler=(Vector((0,.9,0))-obj.location).to_track_quat('-Z','Y').to_euler()
# Rotate both models around the original y-up body axis, then place them side by side.
# This retains identical framing, size and light direction for each corresponding view.
for view in args.views:
 angle={'front':0,'back':np.pi,'side':np.pi/2}[view]
 for objects,offset in models:
  for obj in objects:obj.rotation_euler=(0,float(angle),0);obj.location=(offset,0,0)
 scene.render.filepath=str(args.output_dir/(view+'.png'));bpy.ops.render.render(write_still=True)
