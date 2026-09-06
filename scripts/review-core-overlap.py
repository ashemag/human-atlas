"""Sample containment of registered core vertices in existing external obliques.

This detects a potential duplicate-volume integration problem; it does not identify
muscle tissue or validate registration. Ray parity assumes closed target surfaces.
"""
import json
from pathlib import Path
import numpy as np
ROOT=Path(__file__).resolve().parents[1]

def inside(points,vertices,triangles):
    tri=vertices[triangles];a,b,c=tri[:,0],tri[:,1],tri[:,2]
    e1=b-a;e2=c-a
    denominator=e1[:,0]*e2[:,1]-e1[:,1]*e2[:,0]
    valid=np.abs(denominator)>1e-14
    a,e1,e2,denominator=a[valid],e1[valid],e2[valid],denominator[valid]
    answer=[]
    for p in points:
        d=p[:2]-a[:,:2]
        u=(d[:,0]*e2[:,1]-d[:,1]*e2[:,0])/denominator
        v=(e1[:,0]*d[:,1]-e1[:,1]*d[:,0])/denominator
        hit=(u>=0)&(v>=0)&(u+v<=1)
        zs=a[hit,2]+u[hit]*e1[hit,2]+v[hit]*e2[hit,2]
        # Merge shared-edge intersections to avoid counting the same surface twice.
        zs=np.unique(np.round(zs,8));answer.append(int(np.sum(zs>p[2]+1e-7))%2==1)
    return np.array(answer)

def main():
    directory=ROOT/'data/anatomy/z-anatomy';m=json.loads((directory/'core-source.json').read_text())
    b=(directory/m['binary']).read_bytes();r=json.loads((directory/'registration-review.json').read_text());matrix=np.array(r['sourceWorldToAtlasMatrix'])
    atlas=json.loads((ROOT/'public/models/atlas.json').read_text());buffers=[(ROOT/('public'+c['url'])).read_bytes() for c in atlas['chunks']]
    existing=[];target_checks=[]
    for p in atlas['parts']:
        if p['id'] not in ('FJ1452','FJ1452M'):continue
        data=buffers[p['chunk']];v=np.frombuffer(data,'<f4',p['vertexCount']*3,p['positions']).reshape(-1,3).astype(float)
        t=np.frombuffer(data,'<u4',p['indexCount'],p['indices']).reshape(-1,3)
        _,remap=np.unique(v,axis=0,return_inverse=True); welded=remap[t]
        edges=np.sort(np.concatenate([welded[:,[0,1]],welded[:,[1,2]],welded[:,[2,0]]]),axis=1);_,counts=np.unique(edges,axis=0,return_counts=True)
        target_checks.append(dict(id=p['id'],boundaryEdges=int((counts==1).sum()),nonmanifoldEdges=int((counts>2).sum())))
        existing.append((p,v,t))
    if any(t['boundaryEdges'] or t['nonmanifoldEdges'] for t in target_checks):
        report=dict(status='Containment not evaluated: retained target meshes are not closed manifolds',targetChecks=target_checks,limitations=['Ray-parity volume containment is invalid for these target surfaces.','Visual overlap requires anatomical boundary review before additive integration.'])
        (directory/'overlap-review.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2));return
    rows=[]
    for p in m['parts']:
        if p['role']!='core':continue
        pos=np.frombuffer(b,'<f4',p['vertexCount']*3,p['positions']).reshape(-1,3).astype(float)
        pos=pos[np.linspace(0,len(pos)-1,min(400,len(pos)),dtype=int)]@matrix[:3,:3].T+matrix[:3,3]
        enclosed=np.zeros(len(pos),dtype=bool)
        for q,v,t in existing:enclosed|=inside(pos,v,t)
        rows.append(dict(sourceObject=p['name'],sampledVertices=len(pos),insideExistingExternalOblique=int(enclosed.sum()),fractionInside=float(enclosed.mean())))
    report=dict(method='Positive AP-axis ray parity against closed retained FJ1452/FJ1452M meshes',
                limitations=['Candidate registration is provisional.', 'Deterministic vertex sampling is not a volume measurement.',
                             'Containment flags overlapping geometry, not confirmed tissue identity or incorrect anatomy.'],metrics=rows)
    (directory/'overlap-review.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2))
if __name__=='__main__':main()
