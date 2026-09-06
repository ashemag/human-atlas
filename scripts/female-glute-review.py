#!/usr/bin/env python3
"""Measure the front/back/side proportion candidate, including actual AP ray gaps.
Widths and ray gaps are engineering geometry screens, not anatomical landmarks.
"""
import argparse
import importlib.util
import json
from pathlib import Path
import numpy as np
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('audit',ROOT/'scripts/pelvis-surface-audit.py');audit=importlib.util.module_from_spec(spec);spec.loader.exec_module(audit)
parser=argparse.ArgumentParser();parser.add_argument('--before-root',type=Path,default=Path('/tmp/human-atlas-waist-candidate'));parser.add_argument('--after-root',type=Path,default=Path('/tmp/human-atlas-glute-scoped-candidate'));parser.add_argument('--output',type=Path,default=ROOT/'data/anatomy/female-glute-review.json');args=parser.parse_args()
before=audit.Atlas(args.before_root,'atlas-female-reconstructed.json');after=audit.Atlas(args.after_root,'atlas-female-reconstructed.json')
oldfit=json.loads((args.before_root/'public/models/female-fit-report.json').read_text());fit=json.loads((args.after_root/'public/models/female-fit-report.json').read_text())
assert before.parts.keys()==after.parts.keys()
meshes={};affected=[];skeletal=[]
for key,p in before.parts.items():
    a,fa=before.mesh([key]);b,fb=after.mesh([key]);assert a.shape==b.shape and np.array_equal(fa,fb),key
    assert np.array_equal(a[:,1],b[:,1]),key
    dz=b[:,2]-a[:,2];delta=b-a
    assert float(dz.max())<1e-8,key
    meshes[key]=(a,b)
    row=dict(id=key,name=p['name'],system=p['system'],vertices=p['vertexCount'],depthChangedVertices=int(np.count_nonzero(dz)),maximumPosteriorChangeMm=float(-dz.min())*1000,maximumLateralChangeMm=float(abs(delta[:,0]).max())*1000)
    if row['depthChangedVertices']:affected.append(row)
    if p['system']=='skeletal' and np.any(delta):skeletal.append(row)
assert oldfit['tissueInsets']==fit['tissueInsets'] and oldfit['transforms']==fit['transforms']
# The posterior gate must not deform bones, the lumbar spine, or anterior organs.
assert not any(row['system']=='skeletal' for row in affected),affected
allowlist=fit['morph']['gluteProjection']['partIds']
assert all(row['id'] in allowlist for row in affected),affected
protected_changes=[row for row in affected if row['system'] in ['reproductive','digestive','urinary']]
assert not protected_changes,protected_changes

def width(ids,band=None):
    out=[]
    for stage in [0,1]:
        v=np.concatenate([meshes[key][stage] for key in ids])
        if band:v=v[(v[:,1]>=band[0])&(v[:,1]<=band[1])]
        out.append(float(np.ptp(v[:,0]))*1000)
    return dict(ids=ids,heightBandM=band,beforeMm=out[0],afterMm=out[1],changePercent=(out[1]/out[0]-1)*100)
groups={name:[p['id'] for p in before.parts.values() if match(p)] for name,match in {
    'deltoidEnvelope':lambda p:'deltoid' in p['name'].lower() and p['system']=='muscular',
    'iliumEnvelope':lambda p:p['id'] in ['VH_F_ilium_compact_bone_L','VH_F_ilium_compact_bone_R'],
    'glutealEnvelope':lambda p:'gluteus' in p['name'].lower() and p['system']=='muscular',
    'waistExternalObliqueEnvelope':lambda p:'external oblique' in p['name'].lower() and p['system']=='muscular',
}.items()}
widths={key:width(ids,[1.055,1.09] if key.startswith('waist') else None) for key,ids in groups.items()}

# Exact AP ray intersections with pelvic-bone triangles, evaluated at the same x/y
# as each muscle query vertex. This compares matching-height/lateral locations,
# rather than subtracting unrelated global z extrema. A missed ray is excluded.
def posterior_ray_depth(points,triangles):
    a,b,c=triangles[:,0],triangles[:,1],triangles[:,2];ab=b-a;ac=c-a
    det=ab[:,0]*ac[:,1]-ac[:,0]*ab[:,1];valid=abs(det)>1e-14
    result=np.full(len(points),np.nan)
    for i,p in enumerate(points):
        dx=p[0]-a[:,0];dy=p[1]-a[:,1]
        u=np.divide(dx*ac[:,1]-ac[:,0]*dy,det,out=np.zeros_like(det),where=valid)
        v=np.divide(ab[:,0]*dy-dx*ab[:,1],det,out=np.zeros_like(det),where=valid)
        hit=valid&(u>=-1e-8)&(v>=-1e-8)&(u+v<=1+1e-8)
        if hit.any():result[i]=np.min((a[:,2]+u*ab[:,2]+v*ac[:,2])[hit])
    return result
bone_ids=[p['id'] for p in before.parts.values() if p['system']=='skeletal' and p['id'].startswith('VH_F_')]
triangles=[]
for atlas in [before,after]:
    v,f=atlas.mesh(bone_ids);triangles.append(v[f])
sections=[]
for key in ['FJ1418','FJ1418M']:
    a,b=meshes[key]
    # Select the same posterior muscle vertices based only on the before model.
    mask=(a[:,2]<-.090)&(a[:,1]>=.79)&(a[:,1]<=.94)&(abs(a[:,0])>=.03)
    ids=np.flatnonzero(mask);old=posterior_ray_depth(a[ids],triangles[0]);new=posterior_ray_depth(b[ids],triangles[1]);valid=np.isfinite(old)&np.isfinite(new)
    oldgap=old[valid]-a[ids[valid],2];newgap=new[valid]-b[ids[valid],2]
    sections.append(dict(id=key,name=before.parts[key]['name'],queryVertexIndices=ids[valid].tolist(),selectedVertices=len(ids),raysHittingBonesBothStages=int(valid.sum()),beforeGapMm=audit.stats(oldgap),afterGapMm=audit.stats(newgap),addedProjectionMm=audit.stats(a[ids[valid],2]-b[ids[valid],2])))
report=dict(issue='SWR-517',status='Candidate pending three-view visual review; not an anatomical standard',references=['https://as2.ftcdn.net/v2/jpg/00/77/91/69/1000_F_77916955_HK9TuhgkxYxzm4SC3uvUbdCKZyRZ83FG.jpg'],referenceLocalPath='/tmp/human-atlas-proportion-references/reference-77916955.jpg',beforeManifestSha256=audit.sha(before.path),afterManifestSha256=audit.sha(after.path),morphBefore=oldfit['morph'],morphAfter=fit['morph'],parts=len(meshes),topologyUnchanged=True,allVerticalCoordinatesExactlyUnchanged=True,allSkeletalDepthCoordinatesExactlyUnchanged=True,extraBreastInsetsUnchanged=True,sourceRegistrationTransformsUnchanged=True,minimumSampledMorphJacobian=fit['checks']['minimumMorphJacobian'],widths=widths,glutealToDeltoidWidthRatio=dict(before=widths['glutealEnvelope']['beforeMm']/widths['deltoidEnvelope']['beforeMm'],after=widths['glutealEnvelope']['afterMm']/widths['deltoidEnvelope']['afterMm']),posteriorPartIds=allowlist,partsWithPosteriorDepthChange=affected,protectedOrganDepthChanges=protected_changes,posteriorOrganExclusionPassed=not protected_changes,skeletalPartsWithLateralChange=skeletal,apRayTargetBoneIds=bone_ids,gluteToPelvisMatchingAPRayGaps=sections,limitations=['Reference-guided artistic contour, not calibrated anatomy or a population standard.','The universal lateral field is shared; the posterior component is explicitly restricted to bilateral gluteus maximus and inferior gluteal vein source IDs. Coincidence with excluded tissue is not guaranteed.','AP ray gaps use exact triangle intersections at matched x/y. Rays may meet anterior pubis when no posterior bone lies there; these gaps are not muscle thickness or annotated attachments. Selected mesh vertices are nonuniform samples.','Lateral skeletal displacement is measured separately; zero added bone depth does not imply zero bone movement.','Sampled Jacobians and topology do not validate muscle volume, attachments, joint mechanics or absence of all collisions.'])
args.output.write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({key:report[key] for key in ['widths','glutealToDeltoidWidthRatio','partsWithPosteriorDepthChange','gluteToPelvisMatchingAPRayGaps','minimumSampledMorphJacobian']},indent=2))
