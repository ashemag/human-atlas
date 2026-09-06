#!/usr/bin/env python3
"""Create orthographic, geometry-derived SVG assembly views (no anatomy annotations)."""
import importlib.util
import json
from pathlib import Path
from html import escape
import numpy as np
spec=importlib.util.spec_from_file_location('audit',Path(__file__).with_name('pelvis-surface-audit.py'))
audit=importlib.util.module_from_spec(spec);spec.loader.exec_module(audit)
root=Path(__file__).resolve().parents[1]
atlas=audit.Atlas(root,'atlas-female-reconstructed.json')
ids=[p['id'] for p in atlas.parts.values() if p['id'].startswith('VH_F_') and p['system']=='skeletal']+['FJ3259','FJ3365','FJ3168','FJ3217']
colors={'ilium':'#c5a368','ischium':'#a7aece','pubis':'#80b59c','sacrum':'#c99c95','coccyx':'#c99c95','FJ3259':'#d4cba8','FJ3365':'#d4cba8','FJ3168':'#8db3cb','FJ3217':'#c98cac'}
meshes=[]
for key in ids:
    v,f=atlas.mesh([key]);color=next(value for name,value in colors.items() if name in key)
    meshes.append((key,v,f,color))
svg=['<svg xmlns="http://www.w3.org/2000/svg" width="1440" height="660" viewBox="0 0 1440 660">', '<rect width="1440" height="660" fill="#faf9f5"/>','<style>text{font-family:Arial,sans-serif;fill:#26323c;font-size:15px}.title{font-size:23px;font-weight:bold}.sub{font-size:13px}</style>', '<text x="24" y="34" class="title">Female pelvis assembly — current mesh geometry</text>','<text x="24" y="58">Unsigned proximity screening only. These views do not validate cartilage, contact, attachments, or joint centers.</text>']
# Common vertical scale and orthographic axes; femora clipped visually to pelvis region.
for offset,label,axes,bounds in [(15,'Anterior projection (x / y)',(0,1),(-.18,.18,.75,1.01)),(485,'Lateral projection (z / y)',(2,1),(-.16,.12,.75,1.01))]:
    left,right,bottom,top=bounds;scale=430/(right-left)
    def screen(p):return (offset+15+(p[axes[0]]-left)*scale,110+(top-p[axes[1]])*scale)
    svg.append(f'<text x="{offset+15}" y="94">{label}</text>')
    svg.append(f'<clipPath id="clip{offset}"><rect x="{offset+10}" y="110" width="440" height="425"/></clipPath><g clip-path="url(#clip{offset})">')
    triangles=[]
    for key,v,f,color in meshes:
        for tri in v[f]:
            triangles.append((float(tri[:,2 if axes[0]==0 else 0].mean()),tri,color))
    for depth,tri,color in sorted(triangles,key=lambda row:row[0]):
        points=' '.join(f'{a:.2f},{b:.2f}' for a,b in map(screen,tri))
        normal=np.cross(tri[1]-tri[0],tri[2]-tri[0]);length=np.linalg.norm(normal)
        shade=.62+.38*abs(normal[2 if axes[0]==0 else 0]/length) if length>0 else .8
        rgb=[int(int(color[i:i+2],16)*shade) for i in (1,3,5)]
        fill='#'+''.join(f'{c:02x}' for c in rgb)
        svg.append(f'<polygon points="{points}" fill="{fill}" stroke="{fill}" stroke-width=".15"/>')
    svg.append('</g>')
    a,b=screen(np.array([0,.86,0]));svg.append(f'<path d="M{offset+10},{b:.2f}h440" stroke="#494a53" stroke-dasharray="5 5"/><text x="{offset+20}" y="{b-8:.2f}" class="sub">section y = 0.860 m</text>')
# Exact triangle/plane intersections instead of selecting nearby vertex slabs.
svg.append('<text x="975" y="94">Transverse section (x / z), y = 0.860 m</text>')
def section_screen(p):return (975+(p[0]+.18)*1194,140+(.07-p[2])*1600)
for key,v,f,color in meshes:
    for tri in v[f]:
        signed=tri[:,1]-.86
        if np.all(signed>=0) or np.all(signed<=0):continue
        cross=[]
        for i,j in [(0,1),(1,2),(2,0)]:
            if signed[i]*signed[j]<0:
                cross.append(tri[i]+(tri[j]-tri[i])*(-signed[i]/(signed[j]-signed[i])))
        if len(cross)==2:
            a,b=section_screen(cross[0]);c,d=section_screen(cross[1])
            svg.append(f'<path d="M{a:.2f},{b:.2f}L{c:.2f},{d:.2f}" stroke="{color}" stroke-width="1.4"/>')
svg.append('<text x="975" y="490" class="sub">Section height is a numerical plane, not an anatomical landmark.</text>')
for i,(name,color) in enumerate([('Ilium','#c5a368'),('Ischium','#a7aece'),('Pubis','#80b59c'),('Sacrum / coccyx','#c99c95'),('Femur','#d4cba8'),('L5','#8db3cb'),('L5 disc','#c98cac')]):
    x=25+i*197
    svg.append(f'<rect x="{x}" y="569" width="14" height="14" fill="{color}"/><text x="{x+20}" y="581">{escape(name)}</text>')
svg.append('<text x="24" y="620" class="sub">Sources: BodyParts3D / DBCLS; Human Reference Atlas / Visible Human female. Derived from bundled reconstructed meshes; see pelvis-surface-audit.md.</text></svg>')
(root/'docs/pelvis-surface-views.svg').write_text('\n'.join(svg)+'\n')
print('Wrote docs/pelvis-surface-views.svg')
