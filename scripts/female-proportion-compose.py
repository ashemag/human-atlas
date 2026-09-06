#!/usr/bin/env python3
"""Combine two hash-linked, measured passes without fabricating intermediate data."""
import copy
import importlib.util
import json
from pathlib import Path
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'data/anatomy'
spec = importlib.util.spec_from_file_location('audit', ROOT / 'scripts/pelvis-surface-audit.py')
audit = importlib.util.module_from_spec(spec)
spec.loader.exec_module(audit)
first_path = DATA / 'female-proportion-first-pass.json'
waist_path = DATA / 'female-waist-review.json'
first = json.loads(first_path.read_text())
waist = json.loads(waist_path.read_text())
atlas = audit.Atlas(ROOT, 'atlas-female-reconstructed.json')
assert first['afterManifestSha256'] == waist['beforeManifestSha256']
assert waist['afterManifestSha256'] == audit.sha(atlas.path)
report = copy.deepcopy(waist)
report['status'] = 'Published after visual review; illustration-guided proportions, not an anatomical standard'
report['method'] = 'Composition of two independently measured, hash-linked passes. Original widths/spans come from the first pass; final widths/spans come from the waist pass. Original farthest-vertex endpoint distances are measured again on the final meshes.'
report['measurementPasses'] = [dict(report=path.name, sha256=audit.sha(path)) for path in [first_path, waist_path]]
report['beforeManifestSha256'] = first['beforeManifestSha256']
report['morphBefore'] = first['morphBefore']
report['references'] = list(dict.fromkeys(first['references'] + waist['references']))
report['changedPartsByPass'] = [first['changedParts'], waist['changedParts']]
del report['changedParts']
assert first['parts'] == waist['parts']
for key in ['topologyUnchanged', 'allVerticalAndDepthCoordinatesExactlyUnchanged', 'extraBreastInsetsUnchanged', 'sourceRegistrationTransformsUnchanged']:
    assert first[key] and waist[key]
for key, row in report['widths'].items():
    original = first['widths'][key]
    assert original['afterMm'] == row['beforeMm']
    assert original['ids'] == row['ids'] and original['heightBandM'] == row['heightBandM']
    row['beforeMm'] = original['beforeMm']
    row['changePercent'] = (row['afterMm'] / row['beforeMm'] - 1) * 100
report['glutealToDeltoidWidthRatio']['before'] = first['glutealToDeltoidWidthRatio']['before']
original_limbs = {row['id']: row for row in first['limbMeshSpans']}
for row in report['limbMeshSpans']:
    original = original_limbs[row['id']]
    assert original['afterMaxMeshSpanMm'] == row['beforeMaxMeshSpanMm']
    row['beforeMaxMeshSpanMm'] = original['beforeMaxMeshSpanMm']
    row['changePercent'] = (row['afterMaxMeshSpanMm'] / row['beforeMaxMeshSpanMm'] - 1) * 100
    indices = original['baselineFarthestVertexIndices']
    row['baselineFarthestVertexIndices'] = indices
    vertices, _ = atlas.mesh([row['id']])
    row['sameEndpointDistanceAfterMm'] = float(np.linalg.norm(vertices[indices[0]] - vertices[indices[1]])) * 1000
(DATA / 'female-proportion-review.json').write_text(json.dumps(report, indent=2) + '\n')
print('Final net waist change:', report['widths']['waistExternalObliqueEnvelope']['changePercent'])
print('Final limb span changes:', [(row['name'], row['changePercent']) for row in report['limbMeshSpans']])
