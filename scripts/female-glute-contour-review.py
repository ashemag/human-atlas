#!/usr/bin/env python3
"""Review a scoped glute contour change using fixed source geometry proxies.

No landmark, attachment, muscle-volume or movement validation is implied.
"""
import argparse
import copy
import hashlib
import importlib.util
import json
from pathlib import Path
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('audit', ROOT/'scripts/pelvis-surface-audit.py')
audit = importlib.util.module_from_spec(spec)
spec.loader.exec_module(audit)
APPROVED_IDS = {'FJ1418', 'FJ1418M', 'FJ3513', 'FJ3606'}


def distribution(values):
    values = np.asarray(values)
    if not len(values):
        return None
    return dict(zip(['minMm', 'p05Mm', 'medianMm', 'p95Mm', 'maxMm'], [float(x)*1000 for x in np.quantile(values, [0, .05, .5, .95, 1])]))


def normals(atlas, key):
    atlas.mesh([key])
    p = atlas.parts[key]
    return np.frombuffer(atlas.buffers[p['chunk']], '<i2', p['vertexCount']*3, p['normals']).reshape(-1, 3)


def fingerprints(atlas):
    return dict(manifestSha256=audit.sha(atlas.path), chunks={atlas.data['chunks'][key]['url']: hashlib.sha256(value).hexdigest() for key, value in sorted(atlas.buffers.items())})


def run(before_root, after_root, output):
    before = audit.Atlas(before_root, 'atlas-female-reconstructed.json')
    after = audit.Atlas(after_root, 'atlas-female-reconstructed.json')
    male = audit.Atlas(ROOT, 'atlas.json')
    fit_path = after_root/'public/models/female-fit-report.json'
    fit = json.loads(fit_path.read_text())
    previous_fit_path = before_root/'public/models/female-fit-report.json'
    previous_fit = json.loads(previous_fit_path.read_text())
    assert set(fit['morph']['gluteProjection']['partIds']) == APPROVED_IDS
    assert before.parts.keys() == after.parts.keys()
    assert previous_fit['transforms'] == fit['transforms']
    assert previous_fit['tissueInsets'] == fit['tissueInsets']
    changes = []
    normals_range = [float('inf'), 0.]
    for key, p in before.parts.items():
        a, fa = before.mesh([key]); b, fb = after.mesh([key])
        na, nb = normals(before, key), normals(after, key)
        assert np.array_equal(fa, fb) and a.shape == b.shape, f'{key}: topology changed'
        assert np.isfinite(b).all(), f'{key}: nonfinite positions'
        assert np.array_equal(a[:, 0], b[:, 0]), f'{key}: lateral coordinates changed'
        lengths = np.linalg.norm(nb.astype(float)/32767, axis=1)
        assert lengths.min() > .98 and lengths.max() < 1.02, f'{key}: invalid normals'
        normals_range[0] = min(normals_range[0], float(lengths.min()))
        normals_range[1] = max(normals_range[1], float(lengths.max()))
        if key not in APPROVED_IDS:
            assert np.array_equal(a, b), f'{key}: excluded part moved'
            assert np.array_equal(na, nb), f'{key}: excluded normals changed'
            continue
        source, source_faces = male.mesh([key])
        assert source.shape == b.shape and np.array_equal(source_faces, fb), f'{key}: source topology changed'
        delta = b-a
        changed = np.any(delta != 0, axis=1)
        changes.append(dict(id=key, name=p['name'], vertices=len(b), changedVertices=int(changed.sum()), changedRatio=float(changed.mean()), yChangedVertices=int(np.count_nonzero(delta[:, 1])), zChangedVertices=int(np.count_nonzero(delta[:, 2])), normalChangedVertices=int(np.any(na != nb, axis=1).sum()), verticalChange=distribution(delta[:, 1]), depthChange=distribution(delta[:, 2]), displacement=distribution(np.linalg.norm(delta, axis=1)), verticalBoundsBeforeM=[float(a[:, 1].min()), float(a[:, 1].max())], verticalBoundsAfterM=[float(b[:, 1].min()), float(b[:, 1].max())]))

    # Select original source vertices before either glute contour is applied. Keeping
    # these indices fixed avoids silently moving the test region with the candidate.
    unscoped = copy.deepcopy(fit['morph'])
    unscoped.pop('gluteProjection')
    patches = []
    for key, side, hip, femur in [('FJ1418', 'R', 'FJ3152', 'FJ3365'), ('FJ1418M', 'L', 'FJ3288', 'FJ3259')]:
        source, _ = male.mesh([key])
        source_bones = [hip, 'FJ3393', femur]
        original_distance = audit.Surface(*male.mesh(source_bones)).distances(source)
        candidate, _ = after.mesh([key])
        base = audit.morph(source, unscoped, key).astype('<f4').astype(float)
        current_bones = [f'VH_F_{bone}_compact_bone_{side}' for bone in ['ilium', 'ischium', 'pubis']] + ['VH_F_sacrum', 'VH_F_coccyx', femur]
        target = audit.Surface(*after.mesh(current_bones))
        union = original_distance <= .005
        base_distance = target.distances(base[union])
        candidate_distance = target.distances(candidate[union])
        for threshold in [.003, .005]:
            mask = original_distance <= threshold
            within_union = original_distance[union] <= threshold
            delta = candidate[mask]-base[mask]
            patches.append(dict(id=key, name=after.parts[key]['name'], sourceBoneIds=source_bones, candidateBoneIds=current_bones, sourceProximityThresholdMm=threshold*1000, sourceVertexIndices=np.flatnonzero(mask).tolist(), vertices=int(mask.sum()), sourceBoneDistance=distribution(original_distance[mask]), addedVerticalChangeFromUnscopedBase=distribution(delta[:, 1]), addedDepthChangeFromUnscopedBase=distribution(delta[:, 2]), addedDisplacementFromUnscopedBase=distribution(np.linalg.norm(delta, axis=1)), unscopedBaseToCandidateBoneDistance=distribution(base_distance[within_union]), candidateToCandidateBoneDistance=distribution(candidate_distance[within_union]), boneDistanceChange=distribution(candidate_distance[within_union]-base_distance[within_union])))
    checks = fit['checks']
    fields = checks['minimumMorphJacobianByField']
    assert all(np.isfinite(value) and value > 0 for value in fields.values()), fields
    assert np.isfinite(checks['minimumMorphJacobian']) and checks['minimumMorphJacobian'] > 0
    report = dict(schemaVersion=1, issue='SWR-517', status='Engineering screening evidence; visual and anatomical review remain separate', method='Compare exact stored vertex/index/normal arrays with previous scoped candidate. Original BodyParts3D glute vertices within 3 or 5 mm of exact nearest original pelvic/femur bone triangle surfaces define fixed proximity patches. Compare these same vertices with the new morph with and without its scoped glute component; the unscoped control is rounded to the atlas float32 position precision.', approvedPartIds=sorted(APPROVED_IDS), parts=len(after.parts), checks=dict(allTopologyUnchanged=True, approvedSourceTopologyUnchanged=True, allLateralCoordinatesExactlyUnchanged=True, excludedPositionsAndNormalsExactlyUnchanged=True, registrationTransformsUnchanged=True, tissueInsetsUnchanged=True, normalLengthRange=normals_range, minimumSampledMorphJacobian=checks['minimumMorphJacobian'], minimumSampledMorphJacobianByField=fields), changesFromPreviousScopedCandidate=changes, sourceBoneProximityPatches=patches, inputs=dict(before=fingerprints(before), after=fingerprints(after), source=fingerprints(male), beforeFitReportSha256=audit.sha(previous_fit_path), afterFitReportSha256=audit.sha(fit_path)), morphBefore=previous_fit['morph'], morphAfter=fit['morph'], limitations=['3 and 5 mm are engineering screening cutoffs, not anatomical attachment annotations or physiological tolerances.', 'Unsigned nearest-triangle distances cannot establish valid attachments or exclude interpenetration.', 'Vertex counts and displacement quantiles are not surface-area weighted and do not measure muscle volume.', 'The unscoped base retains existing experimental source registration; it is not anatomical ground truth.', 'Recorded finite positive sampled Jacobians do not prove positivity everywhere or rule out cross-part intersections.', 'Only the explicit part IDs share the added contour; contacts with excluded tissues are not guaranteed.'])
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, indent=2)+'\n')
    print(json.dumps(dict(checks=report['checks'], changes=changes, patchSummary=[{k: v for k, v in row.items() if k not in ['sourceVertexIndices', 'sourceBoneIds', 'candidateBoneIds']} for row in patches]), indent=2))
    return report


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--before-root', type=Path, default=Path('/tmp/human-atlas-glute-scoped-candidate'))
    parser.add_argument('--after-root', type=Path, default=Path('/tmp/human-atlas-glute-rounded-final-candidate'))
    parser.add_argument('--output', type=Path, default=ROOT/'data/anatomy/female-glute-contour-review.json')
    args = parser.parse_args()
    run(args.before_root, args.after_root, args.output)
