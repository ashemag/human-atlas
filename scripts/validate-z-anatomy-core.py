"""Validate the extracted source supplement; report defects without hiding them."""
import hashlib,json
from pathlib import Path
import numpy as np
ROOT=Path(__file__).resolve().parents[1]

def main():
    directory=ROOT/'data/anatomy/z-anatomy'
    manifest=json.loads((directory/'core-source.json').read_text())
    blob=(directory/manifest['binary']).read_bytes()
    assert len(blob)==manifest['bytes']
    assert hashlib.sha256(blob).hexdigest()==manifest['binarySha256']
    expected={f'ZA_{name}_{side}' for name in ('rectus_abdominis','internal_oblique','transversus_abdominis','quadratus_lumborum','multifidus_cervical','multifidus_thoracic','multifidus_lumbar') for side in ('l','r')}
    assert {p['id'] for p in manifest['parts'] if p['role']=='core'}==expected
    assert len({p['id'] for p in manifest['parts']})==len(manifest['parts'])
    rows=[]
    for p in manifest['parts']:
        v=np.frombuffer(blob,'<f4',p['vertexCount']*3,p['positions']).reshape(-1,3)
        n=np.frombuffer(blob,'<f4',p['vertexCount']*3,p['normals']).reshape(-1,3)
        t=np.frombuffer(blob,'<u4',p['indexCount'],p['indices']).reshape(-1,3)
        assert np.isfinite(v).all() and np.isfinite(n).all() and t.max()<len(v),p['name']
        assert np.allclose(np.linalg.norm(n,axis=1),1,atol=1e-5),p['name']
        assert np.allclose([v.min(axis=0),v.max(axis=0)],p['bounds']),p['name']
        if p['role']!='core':continue
        edges=np.sort(np.concatenate([t[:,[0,1]],t[:,[1,2]],t[:,[2,0]]]),axis=1)
        _,count=np.unique(edges,axis=0,return_counts=True)
        face=np.cross(v[t[:,1]]-v[t[:,0]],v[t[:,2]]-v[t[:,0]])
        magnitude=np.linalg.norm(face,axis=1)
        dots=(face*n[t].mean(axis=1)).sum(axis=1)
        rows.append(dict(name=p['name'],vertices=len(v),triangles=len(t),boundaryEdges=int((count==1).sum()),
                         nonmanifoldEdges=int((count>2).sum()),degenerateTriangles=int((magnitude<1e-12).sum()),
                         normalDisagreements=int((dots<-1e-12).sum())))
    (directory/'geometry-review.json').write_text(json.dumps(rows,indent=2)+'\n')
    print(f'Validated {len(manifest["parts"])} source meshes; core topology defects remain reported, not silently repaired.')
    for r in rows:
        if r['boundaryEdges'] or r['nonmanifoldEdges'] or r['degenerateTriangles']: print(json.dumps(r))

if __name__=='__main__':main()
