"""Measure a rigid registration of source core supplement against shared bones.

python3 scripts/register-z-anatomy-core.py
Only writes research metrics; it does not install meshes into an atlas. Fit uses
five lumbar vertebrae and bilateral ribs 11/12, with other bones held out.
Surface-vertex distances are sampling-dependent, not anatomical attachment proof.
"""
import hashlib,json
from pathlib import Path
import numpy as np
ROOT=Path(__file__).resolve().parents[1]
SOURCE=ROOT/'data/anatomy/z-anatomy'
FIT_IDS={'FJ3157','FJ3159','FJ3162','FJ3165','FJ3168','FJ3226','FJ3227','FJ3331','FJ3332'}
AXIS=np.array([[1,0,0],[0,0,1],[0,-1,0]],dtype=float)

def nearest(source,target):
    # Bound temporary memory; preserve target mesh identity during ICP.
    indices=[]; distances=[]
    for block in np.array_split(source,max(1,(len(source)+63)//64)):
        squared=((block[:,None,:]-target[None,:,:])**2).sum(axis=2)
        idx=squared.argmin(axis=1);indices.extend(idx);distances.extend(np.sqrt(squared[np.arange(len(idx)),idx]))
    return target[indices],np.array(distances)

def rigid(source,target):
    a=source.mean(axis=0);b=target.mean(axis=0)
    u,_,vt=np.linalg.svd((source-a).T@(target-b))
    rotation=vt.T@u.T
    if np.linalg.det(rotation)<0:
        vt[-1]*=-1;rotation=vt.T@u.T
    return rotation,b-rotation@a

def main():
    manifest=json.loads((SOURCE/'core-source.json').read_text());blob=(SOURCE/manifest['binary']).read_bytes()
    assert hashlib.sha256(blob).hexdigest()==manifest['binarySha256']
    atlas=json.loads((ROOT/'public/models/atlas.json').read_text());parts={p['id']:p for p in atlas['parts']}
    buffers=[(ROOT/('public'+c['url'])).read_bytes() for c in atlas['chunks']]
    pairs=[]
    for p in manifest['parts']:
        if p['role']!='registration':continue
        s=np.frombuffer(blob,'<f4',p['vertexCount']*3,p['positions']).reshape(-1,3).astype(float)@AXIS.T
        q=parts[p['atlasId']];t=np.frombuffer(buffers[q['chunk']],'<f4',q['vertexCount']*3,q['positions']).reshape(-1,3).astype(float)
        s=s[np.linspace(0,len(s)-1,min(400,len(s)),dtype=int)]
        pairs.append((p,s,t))
    fitting=[(p,s,t) for p,s,t in pairs if p['atlasId'] in FIT_IDS]
    rotation=np.eye(3);offset=np.mean([t.mean(axis=0)-s.mean(axis=0) for p,s,t in fitting],axis=0)
    for iteration in range(40):
        originals=[];matches=[]
        for _,s,t in fitting:
            transformed=s@rotation.T+offset
            match,distance=nearest(transformed,t)
            keep=distance<=np.quantile(distance,.8)
            originals.append(s[keep]);matches.append(match[keep])
        new_rotation,new_offset=rigid(np.concatenate(originals),np.concatenate(matches))
        delta=np.linalg.norm(new_offset-offset)+np.linalg.norm(new_rotation-rotation)
        rotation,offset=new_rotation,new_offset
        if delta<1e-9:break
    result=[]
    for p,s,t in pairs:
        mapped=s@rotation.T+offset
        _,forward=nearest(mapped,t)
        sampled=t[np.linspace(0,len(t)-1,min(400,len(t)),dtype=int)]
        _,backward=nearest(sampled,mapped)
        distances=np.concatenate([forward,backward])
        result.append(dict(sourceObject=p['name'],atlasId=p['atlasId'],usedForFit=p['atlasId'] in FIT_IDS,
                           rmsMm=float(np.sqrt(np.mean(distances**2))*1000),medianMm=float(np.median(distances)*1000),
                           p95Mm=float(np.quantile(distances,.95)*1000),maxMm=float(distances.max()*1000)))
    report=dict(method='Rigid trimmed nearest-vertex ICP by corresponding bone; fixed meter scale',
                limitations=['Sampling-dependent vertex distances, not point-to-surface distances.',
                             'Source bones differ in shape; a low residual does not validate muscle attachments.',
                             'No female fit or anatomy review performed; no atlas geometry modified.'],
                iterations=iteration+1,sourceBinarySha256=manifest['binarySha256'],
                sourceWorldToAtlasMatrix=[*(np.column_stack([rotation@AXIS,offset]).tolist()),[0,0,0,1]],
                scale=1,determinant=float(np.linalg.det(rotation@AXIS)),metrics=result,
                reviewStatus='Needs visual registration and attachment review before integration')
    (SOURCE/'registration-review.json').write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps(report,indent=2))

if __name__=='__main__':main()
