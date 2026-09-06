#!/usr/bin/env python3
"""Compare reductions of the stored extra breast inset; no production geometry edits."""
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
parser=argparse.ArgumentParser();parser.add_argument('--root',type=Path,default=project);parser.add_argument('--baseline',type=Path,default=project/'data/anatomy/breast-containment-baseline.json');parser.add_argument('--output',type=Path,default=project/'data/anatomy/breast-inset-experiment.json')
args=parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
root=args.root;atlas=breast.audit.Atlas(root,'atlas-female-reconstructed.json');male=breast.audit.Atlas(root,'atlas.json')
baseline_path=args.baseline;baseline=json.loads(baseline_path.read_text());fitpath=root/'public/models/female-fit-report.json';fit=json.loads(fitpath.read_text())
if breast.audit.sha(atlas.path)!=baseline['inputs']['manifestSha256']:raise ValueError('Stale containment baseline manifest')
for url,value in baseline['inputs']['chunks'].items():
    if breast.audit.sha(root/'public'/url.lstrip('/'))!=value:raise ValueError('Stale containment baseline chunk '+url)
chest_ids=[p['id'] for p in male.parts.values() if p['system'] in ('muscular','skeletal','connective') and p['bounds'][1][2]>.02 and p['bounds'][0][1]<1.50 and p['bounds'][1][1]>1.02 and abs(p['bounds'][0][0]+p['bounds'][1][0])/2<.26 and 'papillary' not in p['name'] and p['name']!='Diaphragm' and p['id'] in atlas.parts]
chest_v,chest_f=atlas.mesh(chest_ids);chest=BVHTree.FromPolygons(chest_v.tolist(),chest_f.tolist(),all_triangles=True);ray_top=float(chest_v[:,2].max()+.1)

def anterior_chest_depth(points):
    out=np.full(len(points),np.nan)
    for i,point in enumerate(points):
        hit,normal,index,_=chest.ray_cast(Vector((point[0],point[1],ray_top)),Vector((0,0,-1)))
        if hit is not None and abs(normal.z)>1e-5:out[i]=hit.z
    return out

def chest_stats(points,depths):
    valid=np.isfinite(depths);depth=depths-points[:,2];behind=valid&(depth>breast.BOUNDARY)
    return dict(samples=len(points),supportedProjectionSamples=int(valid.sum()),posteriorToAnteriorSurface=int(behind.sum()),unsupportedProjectionSamples=int((~valid).sum()),posteriorDepthMm=breast.audit.stats(depth[behind]) if behind.any() else None)

prepared=[]
for entry in baseline['results']:
    key=entry['id'];vertices,faces=atlas.mesh([key]);envelope=breast.Envelope(*atlas.mesh([entry['envelopeId']]))
    half=len(envelope.vertices)//2
    if len(envelope.vertices)%2 or not np.allclose(envelope.vertices[:half,:2],envelope.vertices[half:,:2],atol=1e-8) or not np.all(envelope.vertices[:half,2]>=envelope.vertices[half:,2]):raise ValueError('Envelope no longer has verified corresponding front/back caps')
    regions={name:[] for name in ['front','back','rim']}
    for index in entry['vertices']['outsideSampleIndices']:
        point,_,face,distance=envelope.tree.find_nearest(Vector(vertices[index]));indices=envelope.faces[face]
        region='front' if (indices<half).all() else 'back' if (indices>=half).all() else 'rim'
        regions[region].append(distance)
    region_report={name:dict(samples=len(values),outsideDepthMm=breast.audit.stats(np.array(values)) if values else None) for name,values in regions.items()}
    settings=fit['morph'];y=vertices[:,1]/settings['stature']
    if np.max(y)>=settings['head']['ramp'][0]:raise ValueError('Head warp would invalidate the simple pre-morph inset reversal')
    nose=settings['nose'];r2=((vertices[:,0]-nose['center'][0])/nose['radius'][0])**2+((y-nose['center'][1])/nose['radius'][1])**2
    if (r2<1).any():raise ValueError('Nose warp would invalidate the inset reversal')
    d=settings['thoraxDepth'];ramp=d['ramp'];weight=breast.audit.smoothstep(ramp[0],ramp[1],y)*(1-breast.audit.smoothstep(ramp[2],ramp[3],y))
    depth_scale=settings['stature']*(1+(d['scale']-1)*weight)
    if abs(fit['tissueInsets'][key]+.008)>1e-12:raise ValueError('Expected stored -8mm tissue inset; regenerate experiment logic for changed baseline')
    depths=anterior_chest_depth(vertices)
    prepared.append(dict(entry=entry,vertices=vertices,faces=faces,envelope=envelope,depthScale=depth_scale,chestDepths=depths,regions=region_report))
    print('Baseline regions',key,{key:value['samples'] for key,value in region_report.items()},flush=True)

report=dict(issue='SWR-516',status='Candidate comparison only; no correction selected or production meshes edited',baselineSha256=breast.audit.sha(baseline_path),fitReportSha256=breast.audit.sha(fitpath),method='Reduce the existing extra -8 mm pre-morph inset in 1 mm steps. Preserve vertex topology and original x/y. Apply the exact torso depth/stature derivative to cloned positions; no surface clipping or per-vertex squeezing.',chestScreen=dict(method='At each unchanged x/y, downward ray from beyond the selected chest mesh bounds finds the frontmost actual musculoskeletal triangle. Positive depth means posterior to this modeled anterior surface; not a closed-volume penetration diagnosis.',selection='Same original source-part bound/system/name predicate used by the reconstruction chest projector, measured on current retained geometry; no blur or nearest-filled grid.',ids=chest_ids,boundaryToleranceMm=breast.BOUNDARY*1000),baselineRegions=[dict(id=p['entry']['id'],nearestEnvelopeBoundary=p['regions']) for p in prepared],candidates=[],limitations=['Procedural envelope containment is a rendering-assembly criterion, not adipose/gland histology or anatomical certification.','All three internal tissue groups shift coherently for each candidate; external nipples/areola and suspensory ligaments are not moved.','Moving ducts/sinuses can affect their continuity with unchanged nipple anatomy; that interface requires separate validation.','Posterior-to-chest-surface depth is a projected geometric test; it does not classify tissue-volume intersections or complete chest anatomy.','Candidate sweep initially measures all source vertices; triangle centroids must be checked for any candidate proposed for production.'])
output=args.output;output.parent.mkdir(parents=True,exist_ok=True)
for reduction in range(9):
    candidate=dict(insetMm=-8+reduction,reductionMm=reduction,parts=[])
    for p in prepared:
        entry=p['entry'];points=breast.shifted_inset(p['vertices'],fit['morph'],reduction*.001)
        if reduction==0:
            summary={key:value for key,value in entry['vertices'].items() if key not in ['outsideSampleIndices','uncertainSampleIndices']}
        else:
            summary,_,_=p['envelope'].samples(points);summary={key:value for key,value in summary.items() if key not in ['outsideSampleIndices','uncertainSampleIndices']}
        candidate['parts'].append(dict(id=entry['id'],vertices=summary,chest=chest_stats(points,p['chestDepths'])))
    report['candidates'].append(candidate);output.write_text(json.dumps(report,indent=2)+'\n')
    print('Inset',candidate['insetMm'],'outside',sum(p['vertices']['counts']['outside'] for p in candidate['parts']),'posteriorChest',sum(p['chest']['posteriorToAnteriorSurface'] for p in candidate['parts']),flush=True)
