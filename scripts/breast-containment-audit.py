#!/usr/bin/env python3
"""Run with Blender --background --factory-startup --disable-autoexec --python.
Screen modeled gland/duct/sinus geometry against the procedural outer envelope.
No generated mesh is edited. Outer envelope is a presentation volume, not histology.
"""
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
import sys
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('pelvis_audit',Path(__file__).with_name('pelvis-surface-audit.py'))
audit=importlib.util.module_from_spec(spec);spec.loader.exec_module(audit)
DIRECTIONS=np.array([[1,.371,.137],[-.219,1,.413],[.173,-.281,1],[.677,.291,-1],[-1,.527,-.313]],dtype=float)
DIRECTIONS/=np.linalg.norm(DIRECTIONS,axis=1)[:,None]
BOUNDARY=.0002
ADVANCE=.000001

def shifted_inset(vertices, settings, delta):
    """Apply a pre-morph z inset change to current torso vertices exactly.

    Torso x/y are independent of z. Head/nose domains are rejected rather than
    applying this derivative where the warp has additional dependencies.
    """
    y = vertices[:, 1] / settings['stature']
    if np.max(y) >= settings['head']['ramp'][0]:
        raise ValueError('Head warp domain is unsupported for torso inset reversal')
    nose = settings['nose']
    if np.any(abs(y - nose['center'][1]) <= nose['radius'][1]):
        raise ValueError('Nose warp domain is unsupported for torso inset reversal')
    depth = settings['thoraxDepth']; ramp = depth['ramp']
    weight = audit.smoothstep(ramp[0], ramp[1], y) * (1 - audit.smoothstep(ramp[2], ramp[3], y))
    result = vertices.copy()
    result[:, 2] += delta * settings['stature'] * (1 + (depth['scale'] - 1) * weight)
    return result

class Envelope:
    def __init__(self,vertices,faces):
        self.vertices=vertices;self.faces=faces;self.triangles=vertices[faces]
        self.tree=BVHTree.FromPolygons(vertices.tolist(),faces.tolist(),all_triangles=True,epsilon=0.)
        edges=np.concatenate([faces[:,[0,1]],faces[:,[1,2]],faces[:,[2,0]]])
        undirected=np.sort(edges,axis=1)
        _,inverse,counts=np.unique(undirected,axis=0,return_inverse=True,return_counts=True)
        orientation=np.bincount(inverse,weights=np.where(edges[:,0]<edges[:,1],1,-1))
        self.topology=dict(vertices=len(vertices),triangles=len(faces),boundaryEdges=int((counts==1).sum()),nonManifoldEdges=int((counts>2).sum()),inconsistentlyOrientedEdges=int((orientation!=0).sum()),degenerateTriangles=int((np.linalg.norm(np.cross(self.triangles[:,1]-self.triangles[:,0],self.triangles[:,2]-self.triangles[:,0]),axis=1)<1e-12).sum()),signedVolumeM3=float(np.einsum('ij,ij->i',self.triangles[:,0],np.cross(self.triangles[:,1],self.triangles[:,2])).sum()/6))
        self.valid=all(self.topology[key]==0 for key in ['boundaryEdges','nonManifoldEdges','inconsistentlyOrientedEdges','degenerateTriangles'])

    def ray_parity(self,point,direction):
        origin=Vector(point);direction=Vector(direction);hits=0
        for _ in range(100):
            position,normal,index,distance=self.tree.ray_cast(origin,direction)
            if position is None:return hits%2
            tri=self.triangles[index];ab=tri[1]-tri[0];ac=tri[2]-tri[0];v=np.array(position)-tri[0]
            aa,bb,cc=np.dot(ab,ab),np.dot(ab,ac),np.dot(ac,ac)
            determinant=aa*cc-bb*bb
            if determinant<=1e-24:return None
            s=(cc*np.dot(ab,v)-bb*np.dot(ac,v))/determinant
            t=(aa*np.dot(ac,v)-bb*np.dot(ab,v))/determinant
            # Edge/vertex hits and nearly tangential rays are ambiguous, never silently counted.
            if min(s,t,1-s-t)<1e-5 or abs(normal.dot(direction))<1e-5:return None
            hits+=1;origin=position+direction*ADVANCE
        return None

    def classify(self,point):
        position,normal,index,distance=self.tree.find_nearest(Vector(point))
        if position is None:raise ValueError('Envelope has no triangles')
        if distance<=BOUNDARY:return 'boundary',float(distance),np.array(position),0
        if not self.valid:return 'uncertain',float(distance),np.array(position),0
        votes=[self.ray_parity(point,direction) for direction in DIRECTIONS]
        valid=[vote for vote in votes if vote is not None]
        if len(valid)<3 or len(set(valid))!=1:return 'uncertain',float(distance),np.array(position),len(valid)
        return ('inside' if valid[0] else 'outside'),float(distance),np.array(position),len(valid)

    def samples(self,points):
        results=[self.classify(point) for point in points]
        kinds=np.array([entry[0] for entry in results]);distances=np.array([entry[1] for entry in results]);counts={kind:int((kinds==kind).sum()) for kind in ['inside','outside','boundary','uncertain']}
        outside=np.flatnonzero(kinds=='outside')
        maxindex=int(outside[np.argmax(distances[outside])]) if len(outside) else None
        report=dict(samples=len(points),counts=counts,outsideDistanceMm=audit.stats(distances[outside]) if len(outside) else None,outsideSampleIndices=outside.tolist(),uncertainSampleIndices=np.flatnonzero(kinds=='uncertain').tolist(),maximumOutsidePointM=points[maxindex].tolist() if maxindex is not None else None,nearestEnvelopePointM=results[maxindex][2].tolist() if maxindex is not None else None)
        return report,kinds,distances

def run(root, output=None):
    atlas=audit.Atlas(root,'atlas-female-reconstructed.json');results=[];excluded=[]
    for side in ['L','R']:
        envelope_id=f'VH_F_fat_{side}';envelope=Envelope(*atlas.mesh([envelope_id]))
        for structure in ['mammary_lobes','main_lactiferous_ducts','main_lactiferous_sinuses']:
            key=f'VH_F_{structure}_{side}';vertices,faces=atlas.mesh([key]);centroids=vertices[faces].mean(axis=1)
            vertices_report,classes,distance=envelope.samples(vertices)
            centroid_report,_,_=envelope.samples(centroids)
            results.append(dict(id=key,name=atlas.parts[key]['name'],side=side,envelopeId=envelope_id,envelopeTopology=envelope.topology,vertices=vertices_report,triangleCentroids=centroid_report))
            print(key,'vertices',vertices_report['counts'],'centroids',centroid_report['counts'],flush=True)
        for p in atlas.parts.values():
            if p['id'].endswith('_'+side) and any(word in p['id'] for word in ['suspensory_ligaments','nipple','areola']):
                excluded.append(dict(id=p['id'],name=p['name'],reason='Suspensory supports can extend to the chest; full-envelope containment is not a valid requirement.' if 'suspensory' in p['id'] else 'External nipple/areola anatomy is intentionally outside the internal tissue containment screen.'))
    report=dict(schemaVersion=1,issue='SWR-516',status='Geometric presentation screening only; tissue placement and anatomical validity remain unreviewed',method='Actual-triangle nearest distance and five oblique BVH ray parities at every vertex and every triangle centroid. At least three non-ambiguous unanimous rays required; near-edge/tangent hits ignored. Topologically invalid envelopes produce uncertainty. No mesh edits.',boundaryToleranceMm=BOUNDARY*1000,rayAdvanceMm=ADVANCE*1000,rayDirections=DIRECTIONS.tolist(),interpretation='Procedural adipose envelope is treated as the proposed outer breast presentation volume. This does not mean glandular tissue is histologically contained within adipose tissue, or that all duct endpoints must terminate inside this envelope.',limitations=['Vertex and centroid samples do not prove complete triangle/volume containment or absence of crossings between samples.','Closed oriented manifold topology does not prove an envelope is free of self-intersection; contradictory ray votes are uncertain.','Ray casting is floating-point and ignores ambiguous edge/vertex/tangent intersections; boundary band is 0.2 mm.','Unsigned surface distance becomes an outside protrusion depth only when ray classification is confidently outside.','Ducts communicate with external nipple structures; any apparent duct exit needs local anatomical review, not automatic clipping.','Containment in an artist-created envelope is not anatomical validation; the envelope itself may be undersized or misplaced.'],inputs=dict(manifestSha256=audit.sha(atlas.path),chunks={atlas.data['chunks'][key]['url']:hashlib.sha256(value).hexdigest() for key,value in atlas.buffers.items()}),excluded=excluded,results=results)
    output=output or root/'data/anatomy/breast-containment-audit.json';output.parent.mkdir(parents=True,exist_ok=True);output.write_text(json.dumps(report,indent=2)+'\n')
    return report

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--root',type=Path,default=ROOT);parser.add_argument('--output',type=Path)
    args=parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []);run(args.root,args.output)
