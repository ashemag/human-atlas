"""Render current/candidate actual geometry under one orthographic camera in Blender."""
import argparse
import importlib.util
from pathlib import Path
import sys
import bpy
import numpy as np
from mathutils import Vector
spec=importlib.util.spec_from_file_location('audit',Path(__file__).with_name('pelvis-surface-audit.py'));audit=importlib.util.module_from_spec(spec);spec.loader.exec_module(audit)
root=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser();parser.add_argument('--before-root',type=Path,default=root);parser.add_argument('--after-root',type=Path,required=True);parser.add_argument('--output',type=Path,default=root/'outputs/female-proportion-comparison.png');args=parser.parse_args(sys.argv[sys.argv.index('--')+1:])
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=32;scene.cycles.use_denoising=False
scene.render.resolution_x=1300;scene.render.resolution_y=1350;scene.render.resolution_percentage=100
scene.world.color=(.55,.55,.55);scene.view_settings.view_transform='Standard'
colors={'skeletal':(.76,.70,.54,1),'muscular':(.46,.16,.125,1),'mammary':(.72,.53,.27,1)}
materials={}
for group,color in colors.items():
    material=bpy.data.materials.new(group);material.diffuse_color=color;material.use_nodes=True;bsdf=material.node_tree.nodes.get('Principled BSDF');bsdf.inputs['Base Color'].default_value=color;bsdf.inputs['Roughness'].default_value=.62;materials[group]=material
for folder,offset,label in [(args.before_root,-.40,'Current'),(args.after_root,.40,'Candidate')]:
    atlas=audit.Atlas(folder,'atlas-female-reconstructed.json')
    for group in colors:
        ids=[p['id'] for p in atlas.parts.values() if p['system']==group and (group!='mammary' or p['id'] in ['VH_F_fat_L','VH_F_fat_R'])]
        vertices,faces=atlas.mesh(ids);vertices[:,0]+=offset
        mesh=bpy.data.meshes.new(label+' '+group);mesh.from_pydata(vertices.tolist(),[],faces.tolist());mesh.update();obj=bpy.data.objects.new(mesh.name,mesh);scene.collection.objects.link(obj);obj.data.materials.append(materials[group])
        for polygon in mesh.polygons:polygon.use_smooth=True
    text=bpy.data.curves.new(label,'FONT');text.body=label;text.align_x='CENTER';text.size=.047;text.extrude=0
    obj=bpy.data.objects.new(label,text);scene.collection.objects.link(obj);obj.location=(offset,1.715,.02)
# Geometry uses y-up; the orthographic camera looks down world-z with y as screen-up.
camera=bpy.data.cameras.new('Camera');obj=bpy.data.objects.new('Camera',camera);scene.collection.objects.link(obj);obj.location=(0,.84,4);obj.rotation_euler=(0,0,0);camera.type='ORTHO';camera.ortho_scale=1.94;scene.camera=obj
for name,position,energy,size in [('Key',(-2,3,4),450,4),('Fill',(2,1,3),260,3)]:
    light=bpy.data.lights.new(name,'AREA');light.energy=energy;light.shape='DISK';light.size=size;obj=bpy.data.objects.new(name,light);scene.collection.objects.link(obj);obj.location=position;obj.rotation_euler=(Vector((0,.9,0))-obj.location).to_track_quat('-Z','Y').to_euler()
args.output.parent.mkdir(parents=True,exist_ok=True);scene.render.filepath=str(args.output);bpy.ops.render.render(write_still=True)
