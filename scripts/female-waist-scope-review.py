#!/usr/bin/env python3
"""Append exact localization checks to the lateral waist proportion report."""
import argparse
import copy
import importlib.util
import json
from pathlib import Path
import numpy as np
ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('audit', ROOT/'scripts/pelvis-surface-audit.py')
audit = importlib.util.module_from_spec(spec); spec.loader.exec_module(audit)


def run(before_root, after_root, report_path):
    before = audit.Atlas(before_root, 'atlas-female-reconstructed.json')
    after = audit.Atlas(after_root, 'atlas-female-reconstructed.json')
    oldfit = json.loads((before_root/'public/models/female-fit-report.json').read_text())
    fit = json.loads((after_root/'public/models/female-fit-report.json').read_text())
    expected = copy.deepcopy(oldfit['morph'])
    expected['waistRefinement'] = dict(delta=-.095, heightRamp=[1.03, 1.12, 1.21], radialRamp=[.14, .17])
    assert expected == fit['morph'], 'More than the intended isolated waist field changed'
    assert oldfit['transforms'] == fit['transforms']
    assert oldfit['tissueInsets'] == fit['tissueInsets']
    report = json.loads(report_path.read_text())
    assert report['beforeManifestSha256'] == audit.sha(before.path)
    assert report['afterManifestSha256'] == audit.sha(after.path)
    assert before.parts.keys() == after.parts.keys()
    affected = []; glute_ids = []; arm_bones = []; arm_muscles = []
    low, high = np.array([1.03, 1.21])*fit['morph']['stature']
    for key, part in before.parts.items():
        a, fa = before.mesh([key]); b, fb = after.mesh([key])
        assert a.shape == b.shape and np.array_equal(fa, fb), key
        assert np.array_equal(a[:, 1:], b[:, 1:]), key
        outside = (a[:, 1] <= low) | (a[:, 1] >= high)
        assert np.array_equal(a[outside], b[outside]), f'{key}: change outside intended height interval'
        inside = ~outside
        if inside.any():
            y = a[inside, 1]/fit['morph']['stature']
            boundary = audit.morph(np.column_stack([np.full_like(y, .17), y, np.zeros_like(y)]), oldfit['morph'])[:, 0]
            # Compare beyond float32 rounding uncertainty at the source radial cutoff.
            radial_outside = abs(a[inside, 0]) > boundary + 2e-7
            assert np.array_equal(a[inside][radial_outside], b[inside][radial_outside]), f'{key}: change outside source radius'
        name = part['name'].lower()
        is_glute = 'gluteus' in name or key in fit['morph']['gluteProjection']['partIds']
        is_arm_bone = part['system'] == 'skeletal' and any(token in name for token in ['humerus', 'radius', 'ulna', 'scapula', 'clavicle', 'metacarpal', 'capitate', 'hamate', 'lunate', 'pisiform', 'scaphoid', 'trapezium', 'trapezoid', 'triquetral', 'finger', 'thumb'])
        if is_glute or is_arm_bone:
            assert np.array_equal(a, b), f'{key}: protected glute or arm bone geometry changed'
            oldp, newp = before.parts[key], after.parts[key]
            na = np.frombuffer(before.buffers[oldp['chunk']], '<i2', oldp['vertexCount']*3, oldp['normals'])
            nb = np.frombuffer(after.buffers[newp['chunk']], '<i2', newp['vertexCount']*3, newp['normals'])
            assert np.array_equal(na, nb), f'{key}: protected glute or arm bone normals changed'
            if is_glute: glute_ids.append(key)
            if is_arm_bone: arm_bones.append(dict(id=key, name=part['name'], vertices=len(a)))
        dx = b[:, 0]-a[:, 0]
        row = dict(id=key, name=part['name'], system=part['system'], changedVertices=int(np.count_nonzero(dx)), maxLateralDisplacementMm=float(abs(dx).max())*1000, lateralSpanBeforeMm=float(np.ptp(a[:, 0]))*1000, lateralSpanAfterMm=float(np.ptp(b[:, 0]))*1000)
        if np.any(dx): affected.append(row)
        is_arm_muscle = part['system'] == 'muscular' and any(token in name for token in ['biceps brachii', 'triceps brachii', 'brachialis', 'coracobrachialis', 'brachioradialis', 'carpi', 'pollicis', 'pronator', 'supinator', 'palmaris', 'anconeus', 'extensor indicis', 'extensor digitorum', 'flexor digitorum superficialis', 'flexor digitorum profundus']) and not any(token in name for token in ['digitorum longus', 'digitorum brevis', 'foot', 'toe'])
        if is_arm_muscle: arm_muscles.append(row)
    for name in ['deltoidEnvelope', 'iliumEnvelope', 'glutealEnvelope', 'scapulaEnvelope', 'upperThighEnvelope']:
        row = report['widths'][name]
        assert row['beforeMm'] == row['afterMm'], name
    assert len(arm_bones) >= 64, 'Upper-limb bone screening selection incomplete'
    affected.sort(key=lambda row: row['maxLateralDisplacementMm'], reverse=True)
    arm_muscles.sort(key=lambda row: row['maxLateralDisplacementMm'], reverse=True)
    report['waistLocalization'] = dict(method='Exact stored vertex/index comparison; changed output y must be inside source-height interval times stature. The waist band is below the head morph and above the localized glute field, so y/stature recovers its source-frame height.', waistRefinement=fit['morph']['waistRefinement'], sourceHeightIntervalM=[1.03, 1.21], outputHeightIntervalM=[float(low), float(high)], onlyIntendedWaistFieldAdded=True, topologyAndVerticalDepthCoordinatesUnchanged=True, outsideHeightIntervalExactlyUnchanged=True, sourceRadialSupportM=.17, radialOutputRoundingToleranceM=2e-7, outsideRadialSupportUnchanged=True, radialCheckMethod='Within the waist height band, compare stored |x| with the original monotonic lateral morph applied to source x=.17 at matching source y; this checks the support boundary without conflating source and output radii.', protectedGlutePositionsAndNormalsExactlyUnchanged=True, protectedGluteIds=glute_ids, protectedArmBonePositionsAndNormalsExactlyUnchanged=True, protectedArmBones=arm_bones, namedArmMuscleDisplacements=arm_muscles, hipShoulderGluteScapulaUpperThighEnvelopeWidthsUnchanged=True, affectedParts=affected, limitations=['Shared lateral displacement also reshapes lower ribs and abdominal organs; this is not a surface-only adjustment.', 'Displacement and mesh span are geometry proxies, not anatomy or organ function validation.'])
    report_path.write_text(json.dumps(report, indent=2)+'\n')
    print(json.dumps(dict(waist=report['widths']['waistExternalObliqueEnvelope'], affectedParts=len(affected), largestAffectedParts=affected[:12], affectedBonesAndOrgans=[row for row in affected if row['system'] in ['skeletal', 'digestive', 'urinary', 'reproductive']], minimumSampledMorphJacobian=report['minimumSampledMorphJacobian']), indent=2))


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--before-root', type=Path, default=Path('/tmp/human-atlas-glute-rounded-final-candidate'))
    parser.add_argument('--after-root', type=Path, default=Path('/tmp/human-atlas-waist-isolated-candidate'))
    parser.add_argument('--report', type=Path, default=ROOT/'data/anatomy/female-waist-slimmer-review.json')
    args = parser.parse_args(); run(args.before_root, args.after_root, args.report)
