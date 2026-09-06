#!/usr/bin/env python3
"""Validate the conservative -3mm inset candidate on cloned internal tissue meshes."""
import argparse
import sys
import importlib.util
import json
from pathlib import Path
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree
spec=importlib.util.spec_from_file_location('breast',Path(__file__).with_name('breast-containment-audit.py'))
breast=importlib.util.module_from_spec(spec);spec.loader.exec_module(breast)
project=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser();parser.add_argument('--root',type=Path,default=project);parser.add_argument('--baseline',type=Path,default=project/'data/anatomy/breast-containment-baseline.json');parser.add_argument('--output',type=Path,default=project/'data/anatomy/breast-candidate-validation.json')
args=parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
root=args.root;atlas=breast.audit.Atlas(root,'atlas-female-reconstructed.json')
basepath=args.baseline;base=json.loads(basepath.read_text())
fitpath=root/'public/models/female-fit-report.json';fit=json.loads(fitpath.read_text());settings=fit['morph']
if breast.audit.sha(atlas.path)!=base['inputs']['manifestSha256']:raise ValueError('Stale baseline')
for url,value in base['inputs']['chunks'].items():
    if breast.audit.sha(root/'public'/url.lstrip('/'))!=value:raise ValueError('Stale baseline chunk '+url)
results=[]

def compact(summary):return {key:value for key,value in summary.items() if key not in ['outsideSampleIndices','uncertainSampleIndices']}
def regions(envelope,points,indices):
    half=len(envelope.vertices)//2
    if not np.allclose(envelope.vertices[:half,:2],envelope.vertices[half:,:2],atol=1e-8):raise ValueError('Cannot identify paired envelope caps')
    output={name:0 for name in ['front','back','rim']}
    for i in indices:
        _,_,face,_=envelope.tree.find_nearest(Vector(points[i]));tri=envelope.faces[face]
        output['front' if (tri<half).all() else 'back' if (tri>=half).all() else 'rim']+=1
    return output
for entry in base['results']:
    key=entry['id'];vertices,faces=atlas.mesh([key]);y=vertices[:,1]/settings['stature']
    if np.max(y)>=settings['head']['ramp'][0] or abs(fit['tissueInsets'][key]+.008)>1e-12:raise ValueError('Unexpected baseline warp/inset')
    candidate=breast.shifted_inset(vertices,settings,.005)
    envelope=breast.Envelope(*atlas.mesh([entry['envelopeId']]))
    vertex_result,_,_=envelope.samples(candidate);centroids=candidate[faces].mean(axis=1);centroid_result,_,_=envelope.samples(centroids)
    interfaces=[]
    if 'ducts' in key or 'sinuses' in key:
        for external in [f"VH_F_nipple_{entry['side']}",f"VH_F_areola_{entry['side']}"]:
            v,f=atlas.mesh([external]);tree=BVHTree.FromPolygons(v.tolist(),f.tolist(),all_triangles=True)
            old=np.array([tree.find_nearest(Vector(p))[3] for p in vertices]);new=np.array([tree.find_nearest(Vector(p))[3] for p in candidate])
            patch=np.argsort(old,kind='stable')[:max(16,int(len(old)*.05))]
            interfaces.append(dict(targetId=external,definition='Closest 5% of baseline internal vertices to the external triangle surface (at least16); a geometric patch, NOT anatomically annotated duct openings.',vertices=patch.tolist(),baselinePatchDistanceMm=breast.audit.stats(old[patch]),candidateSamePatchDistanceMm=breast.audit.stats(new[patch]),baselineWholeMeshMinimumMm=float(old.min()*1000),candidateWholeMeshMinimumMm=float(new.min()*1000)))
    row=dict(id=key,insetMm=-3,preMorphDeltaZMm=5,baselineVertices=compact(entry['vertices']),candidateVertices=compact(vertex_result),baselineTriangleCentroids=compact(entry['triangleCentroids']),candidateTriangleCentroids=compact(centroid_result),candidateOutsideVertexNearestBoundary=regions(envelope,candidate,vertex_result['outsideSampleIndices']),candidateOutsideCentroidNearestBoundary=regions(envelope,centroids,centroid_result['outsideSampleIndices']),externalInterfaceScreens=interfaces)
    results.append(row);print(key,'outside',vertex_result['counts']['outside'],'centroids',centroid_result['counts']['outside'],'regions',row['candidateOutsideVertexNearestBoundary'],flush=True)
report=dict(issue='SWR-516',status='Offline candidate evidence; no production geometry changed',candidate=dict(meshIds=[r['id'] for r in results],preMorphInsetM=-.003,previousInsetM=-.008,preMorphDeltaZMm=5,externalAndSupportsUnchanged=True),baselineSha256=breast.audit.sha(basepath),fitReportSha256=breast.audit.sha(fitpath),limitations=['Candidate still has substantial posterior-envelope exits and chest-surface discrepancies; this is a partial geometric correction, not a validated breast model.','External surface-distance patches are not duct opening annotations. Better distances do not establish anatomical continuity, absence of penetration, or normal duct anatomy.','Every candidate vertex and triangle centroid is classified, but unsampled portions of triangles may cross the envelope.'],results=results)
args.output.parent.mkdir(parents=True,exist_ok=True);args.output.write_text(json.dumps(report,indent=2)+'\n')
