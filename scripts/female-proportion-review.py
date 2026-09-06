#!/usr/bin/env python3
"""Compare measured mesh extents for a lateral-only silhouette candidate.
These extents are reproducible geometry proxies, not clinical landmarks.
"""
import argparse
import importlib.util
import json
from pathlib import Path
import numpy as np
spec=importlib.util.spec_from_file_location('audit',Path(__file__).with_name('pelvis-surface-audit.py'))
audit=importlib.util.module_from_spec(spec);spec.loader.exec_module(audit)
root=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser();parser.add_argument('--before-root',type=Path,default=root);parser.add_argument('--reference',action='append');parser.add_argument('--after-root',type=Path,required=True);parser.add_argument('--output',type=Path,default=root/'data/anatomy/female-proportion-review.json');args=parser.parse_args()
before=audit.Atlas(args.before_root,'atlas-female-reconstructed.json');after=audit.Atlas(args.after_root,'atlas-female-reconstructed.json')
oldfit=json.loads((args.before_root/'public/models/female-fit-report.json').read_text());fit=json.loads((args.after_root/'public/models/female-fit-report.json').read_text())
assert before.parts.keys()==after.parts.keys()
meshes={};max_yz=0.;changed=0
for key in before.parts:
    a,fa=before.mesh([key]);b,fb=after.mesh([key]);assert a.shape==b.shape and np.array_equal(fa,fb),key
    error=float(np.max(abs(a[:,1:]-b[:,1:])));max_yz=max(error,max_yz);assert error==0,key
    changed+=int(not np.array_equal(a,b));meshes[key]=(a,b)
assert oldfit['tissueInsets']==fit['tissueInsets']
assert oldfit['transforms']==fit['transforms']

def width(ids,band=None):
    arrays=[]
    for index in [0,1]:
        v=np.concatenate([meshes[key][index] for key in ids])
        if band:v=v[(v[:,1]>=band[0])&(v[:,1]<=band[1])]
        arrays.append(float(np.ptp(v[:,0])))
    return dict(ids=ids,heightBandM=band,beforeMm=arrays[0]*1000,afterMm=arrays[1]*1000,changePercent=(arrays[1]/arrays[0]-1)*100)

groups={
 'deltoidEnvelope': [p['id'] for p in before.parts.values() if 'deltoid' in p['name'].lower() and p['system']=='muscular'],
 'iliumEnvelope': ['VH_F_ilium_compact_bone_L','VH_F_ilium_compact_bone_R'],
 'glutealEnvelope': [p['id'] for p in before.parts.values() if 'gluteus' in p['name'].lower() and p['system']=='muscular'],
 'scapulaEnvelope': [p['id'] for p in before.parts.values() if p['name'].lower() in ['left scapula','right scapula']],
 'upperThighEnvelope': [p['id'] for p in before.parts.values() if any(term in p['name'].lower() for term in ['vastus lateralis','rectus femoris','adductor magnus']) and p['system']=='muscular'],
 'waistExternalObliqueEnvelope': [p['id'] for p in before.parts.values() if 'external oblique' in p['name'].lower() and p['system']=='muscular'],
}
widths={name:width(ids,[.70,.83] if name=='upperThighEnvelope' else [1.055,1.09] if name=='waistExternalObliqueEnvelope' else None) for name,ids in groups.items()}

def diameter(vertices):
    squared=np.sum(vertices*vertices,axis=1);best=(-1,None)
    for start in range(0,len(vertices),256):
        distances=squared[start:start+256,None]+squared[None,:]-2*vertices[start:start+256]@vertices.T
        flat=int(np.argmax(distances));i,j=np.unravel_index(flat,distances.shape)
        if distances[i,j]>best[0]:best=(float(distances[i,j]),(start+i,j))
    return np.sqrt(max(best[0],0)),best[1]
limbs=[]
for key,p in before.parts.items():
    if p['name'].lower() not in [side+' '+bone for side in ['left','right'] for bone in ['humerus','radius','ulna','femur','tibia','fibula']]:continue
    a,b=meshes[key];old,indices=diameter(a);new,_=diameter(b)
    limbs.append(dict(id=key,name=p['name'],beforeMaxMeshSpanMm=old*1000,afterMaxMeshSpanMm=new*1000,changePercent=(new/old-1)*100,baselineFarthestVertexIndices=[int(value) for value in indices],sameEndpointDistanceAfterMm=float(np.linalg.norm(b[indices[0]]-b[indices[1]]))*1000,verticalSpanExactlyUnchanged=True))
report=dict(issue='SWR-517',status='Visual-reference proportion candidate; not a population or anatomical standard',references=args.reference or ['https://as2.ftcdn.net/v2/jpg/15/60/68/51/1000_F_1560685187_zEMPM1N0EJRxhuaZdNMZYvFaaz7TCT7n.jpg','https://as2.ftcdn.net/v2/jpg/14/70/93/01/1000_F_1470930188_f4Jov2p3B4BavIshxjOOmDtyqsGCGvyQ.jpg'],beforeManifestSha256=audit.sha(before.path),afterManifestSha256=audit.sha(after.path),morphBefore=oldfit['morph'],morphAfter=fit['morph'],parts=len(meshes),changedParts=changed,topologyUnchanged=True,allVerticalAndDepthCoordinatesExactlyUnchanged=max_yz==0,extraBreastInsetsUnchanged=True,sourceRegistrationTransformsUnchanged=True,minimumSampledMorphJacobian=fit['checks']['minimumMorphJacobian'],widths=widths,glutealToDeltoidWidthRatio=dict(before=widths['glutealEnvelope']['beforeMm']/widths['deltoidEnvelope']['beforeMm'],after=widths['glutealEnvelope']['afterMm']/widths['deltoidEnvelope']['afterMm']),limbMeshSpans=limbs,limitations=['Mesh envelope widths and maximum pairwise vertex distances are geometric proxies, not annotated anatomical landmarks or joint-center lengths.','Unchanged vertical coordinates do not imply every 3D distance is unchanged; lateral redistribution can slightly alter limb mesh spans.','One shared continuous spatial morph preserves coincidence of points, not anatomical validation of their initial placement.','A sampled positive Jacobian rules out only sampled local foldovers, not all distortions or physiological problems.','Illustration proportions guide an artistic reference build, not a universal female-body shape.'])
args.output.parent.mkdir(parents=True,exist_ok=True);args.output.write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({key:report[key] for key in ['widths','glutealToDeltoidWidthRatio','limbMeshSpans','minimumSampledMorphJacobian']},indent=2))
