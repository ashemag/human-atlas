#!/usr/bin/env python3
"""Measure the SAME baseline pelvis proximity-patch vertices after the silhouette change."""
import argparse
import importlib.util
import json
from pathlib import Path
import numpy as np
spec=importlib.util.spec_from_file_location('audit',Path(__file__).with_name('pelvis-surface-audit.py'));audit=importlib.util.module_from_spec(spec);spec.loader.exec_module(audit)
root=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser();parser.add_argument('--baseline',type=Path,default=root/'data/anatomy/female-proportion-pelvis-baseline.json');parser.add_argument('--root',type=Path,default=root);parser.add_argument('--output',type=Path,default=root/'data/anatomy/female-proportion-pelvis-comparison.json');args=parser.parse_args()
before=json.loads(args.baseline.read_text());atlas=audit.Atlas(args.root,'atlas-female-reconstructed.json');cache={};results=[]
for row in before['results']:
    patch=row.get('controlProximityPatch')
    if not patch or not patch['count']:continue
    ids=tuple(row['femaleTargets'])
    if ids not in cache:cache[ids]=audit.Surface(*atlas.mesh(ids))
    vertices,_=atlas.mesh([row['sourceId']]);indices=np.array(patch['vertexIndices'],dtype=int)
    distances=cache[ids].distances(vertices[indices]);after=audit.stats(distances)
    results.append(dict(name=row['name'],sourceId=row['sourceId'],targetIds=list(ids),fixedBaselinePatchVertices=len(indices),before=patch['female'],afterSamePatch=after,p95ChangeMm=round(after['p95Mm']-patch['female']['p95Mm'],4),medianChangeMm=round(after['medianMm']-patch['female']['medianMm'],4)))
    print(row['name'],results[-1]['p95ChangeMm'],flush=True)
report=dict(issue='SWR-517',method='Exact nearest target-triangle distances at the SAME source vertex indices selected by the pre-proportion pelvis control proximity patches. Avoids conflating a changed screening patch with a placement change.',beforeAuditSha256=audit.sha(args.baseline),beforeManifestSha256=before['inputs']['femaleManifestSha256'],afterManifestSha256=audit.sha(atlas.path),results=results,limitations=['These are unannotated geometric proximity patches, not anatomical origin/insertion or articular-surface landmarks.','Distances remain unsigned and sample-based; they do not establish absence of intersections or valid attachment physiology.','The comparison measures effects of a visual body morph on an already unvalidated source registration.'])
args.output.parent.mkdir(parents=True,exist_ok=True);args.output.write_text(json.dumps(report,indent=2)+'\n')
