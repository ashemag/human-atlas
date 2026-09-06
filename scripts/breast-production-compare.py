#!/usr/bin/env python3
"""Verify candidate output matches the approved six-part inset correction.
Run with Blender. The before root must retain the original -8mm source geometry.
"""
import argparse
import importlib.util
import json
from pathlib import Path
import sys
import numpy as np
spec=importlib.util.spec_from_file_location('breast',Path(__file__).with_name('breast-containment-audit.py'))
breast=importlib.util.module_from_spec(spec);spec.loader.exec_module(breast)
parser=argparse.ArgumentParser();parser.add_argument('--before-root',type=Path,required=True);parser.add_argument('--after-root',type=Path,required=True);parser.add_argument('--output',type=Path,required=True)
args=parser.parse_args(sys.argv[sys.argv.index('--')+1:])
before=breast.audit.Atlas(args.before_root,'atlas-female-reconstructed.json');after=breast.audit.Atlas(args.after_root,'atlas-female-reconstructed.json')
fit=json.loads((args.before_root/'public/models/female-fit-report.json').read_text());newfit=json.loads((args.after_root/'public/models/female-fit-report.json').read_text())
expected={f'VH_F_{structure}_{side}' for structure in ['mammary_lobes','main_lactiferous_ducts','main_lactiferous_sinuses'] for side in ['L','R']}
if before.parts.keys()!=after.parts.keys():raise ValueError('Part inventory changed')
if fit['morph']!=newfit['morph']:raise ValueError('Whole-body morph unexpectedly changed')
changed=[];maxerror=0.;results=[]
for key in before.parts:
    original,oldfaces=before.mesh([key]);current,newfaces=after.mesh([key])
    if original.shape!=current.shape or not np.array_equal(oldfaces,newfaces):raise ValueError('Topology changed: '+key)
    differs=not np.array_equal(original,current)
    if differs:changed.append(key)
    if key in expected:
        if fit['tissueInsets'][key]!=-.008 or newfit['tissueInsets'][key]!=-.003:raise ValueError('Unexpected inset metadata: '+key)
        predicted=breast.shifted_inset(original,fit['morph'],.005)
        residual=float(np.linalg.norm(predicted-current,axis=1).max());maxerror=max(maxerror,residual)
        if residual>2e-7:raise ValueError('Cloned candidate mismatch: '+key)
        results.append(dict(id=key,maxClonedPositionResidualMm=residual*1000))
    elif differs:raise ValueError('Unexpected position change: '+key)
    elif before.parts[key]['system']!=after.parts[key]['system']:raise ValueError('Unexpected system change: '+key)
if set(changed)!=expected:raise ValueError('Changed part set does not match the six approved internal tissues')
report=dict(issue='SWR-516',passed=True,parts=len(before.parts),triangles=after.data['triangles'],changedParts=changed,topologyUnchanged=True,otherPartPositionsExactlyUnchanged=True,wholeBodyMorphUnchanged=True,maxClonedPositionResidualMm=maxerror*1000,toleranceMm=.0002,beforeManifestSha256=breast.audit.sha(before.path),afterManifestSha256=breast.audit.sha(after.path),results=results,limitations=['This verifies the implemented correction matches the offline geometric candidate; it does not certify anatomy, internal connectivity, normal direction, or complete volume containment.'])
args.output.parent.mkdir(parents=True,exist_ok=True);args.output.write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2))
