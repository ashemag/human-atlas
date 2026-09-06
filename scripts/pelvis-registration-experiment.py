#!/usr/bin/env python3
"""Diagnostic translation proposal; never edits production mesh geometry.

Fits geometry-only correspondences near both retained femora and L5 disc.
These are explicitly NOT annotated head centers, acetabula, or endplates.
"""
import importlib.util
import json
from pathlib import Path
import numpy as np
spec=importlib.util.spec_from_file_location('audit',Path(__file__).with_name('pelvis-surface-audit.py'))
audit=importlib.util.module_from_spec(spec);spec.loader.exec_module(audit)
root=Path(__file__).resolve().parents[1]
report=json.loads((root/'data/anatomy/pelvis-surface-audit.json').read_text())
male=audit.Atlas(root,'atlas.json');female=audit.Atlas(root,'atlas-female-reconstructed.json')
for path, expected in [(male.path, report['inputs']['maleManifestSha256']), (female.path, report['inputs']['femaleManifestSha256']), (root/'public/models/female-fit-report.json', report['inputs']['fitReportSha256'])] + [(root/path, value) for path, value in report['inputs']['chunks'].items()]:
    if audit.sha(path) != expected:
        raise RuntimeError(f'Rerun pelvis surface audit against current inputs first: {path}')
fit=json.loads((root/'public/models/female-fit-report.json').read_text())
warp=lambda vertices,part_id:audit.morph(vertices,fit['morph'],part_id)
rows={row['name']:row for row in report['results']}
anchors=['Right femur / hip envelope','Left femur / hip envelope','L5 disc / sacrum']
proposals=[]
for name in anchors:
    row=rows[name];vertices,_=female.mesh([row['sourceId']]);patch=np.array(row['controlProximityPatch']['vertexIndices'])
    control=audit.Surface(*male.mesh(row['controlTargets'],warp));current=audit.Surface(*female.mesh(row['femaleTargets']))
    vectors=np.array([control.nearest(point)[1]-current.nearest(point)[1] for point in vertices[patch]])
    proposals.append(dict(name=name,vertices=len(patch),translationM=vectors.mean(axis=0).tolist()))
# Equal weighting per joint-screen region prevents the disc's finer mesh dominating.
raw=np.mean([entry['translationM'] for entry in proposals],axis=0)
translation=raw*min(1,.005/max(np.linalg.norm(raw),1e-30))
results=[]
for name,row in rows.items():
    if 'controlProximityPatch' not in row or not row['controlProximityPatch']['count']:continue
    points,_=female.mesh([row['sourceId']]);patch=np.array(row['controlProximityPatch']['vertexIndices'])
    vertices,faces=female.mesh(row['femaleTargets']);candidate=audit.Surface(vertices+translation,faces)
    distances=candidate.distances(points[patch]);prior=row['controlProximityPatch']['female']
    results.append(dict(name=name,patchVertices=len(patch),before=prior,after=audit.stats(distances),p95ChangeMm=round(audit.stats(distances)['p95Mm']-prior['p95Mm'],4)))
    print(name,results[-1]['p95ChangeMm'],flush=True)
result=dict(issue='SWR-513',status='Rejected for production: geometry-only correspondences, no reviewed anatomical landmarks or attachment constraints',method='Mean nearest-surface correspondence displacements from three source proximity patches, equally weighted by region, translation capped at 5 mm. Uniform translation preserves pelvis internal shape, but does not validate registration.',sourceAuditSha256=audit.sha(root/'data/anatomy/pelvis-surface-audit.json'),anchorSuggestions=proposals,unboundedTranslationM=raw.tolist(),evaluatedTranslationM=translation.tolist(),productionGeometryChanged=False,limitations=['Closest points can lie on non-articular or wrong-facing surfaces.','Source proximity patches are not anatomical contact, origin, insertion, or cartilage annotations.','No rotation or local reshape was attempted; fitting a wrong global objective is not a valid anatomical correction.','Comparison scores do not certify registration even if all improve.'],results=results)
(root/'data/anatomy/pelvis-registration-experiment.json').write_text(json.dumps(result,indent=2)+'\n')
