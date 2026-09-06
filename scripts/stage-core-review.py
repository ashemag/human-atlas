"""Copy only public geometry/library assets into an isolated local review directory.

python3 scripts/stage-core-review.py
python3 -m http.server 3018 --bind 127.0.0.1 --directory /tmp/human-atlas-core-review-public
Open http://localhost:3018/docs/core-registration-review.html
"""
import argparse,json,shutil
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser();parser.add_argument('--out',type=Path,default=Path('/tmp/human-atlas-core-review-public'))
out=parser.parse_args().out;out.mkdir(parents=True,exist_ok=True)
files=['docs/core-registration-review.html','data/anatomy/z-anatomy/core-source.json',
       'data/anatomy/z-anatomy/core-source.bin','data/anatomy/z-anatomy/registration-review.json',
       'node_modules/three/build/three.module.js','node_modules/three/examples/jsm/controls/OrbitControls.js']
for name in files:
    target=out/name;target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(ROOT/name,target)
manifest=json.loads((ROOT/'public/models/atlas.json').read_text());(out/'models').mkdir(exist_ok=True)
shutil.copyfile(ROOT/'public/models/atlas.json',out/'models/atlas.json')
selected=[p for p in manifest['parts'] if (p['system']=='skeletal' and p['bounds'][1][1]>.79 and p['bounds'][0][1]<1.53) or p['id'] in ['FJ1452','FJ1452M']]
for i in set(p['chunk'] for p in selected):
    name=manifest['chunks'][i]['url'].lstrip('/');shutil.copyfile(ROOT/'public'/name,out/name)
print(f'Staged explicit public geometry and library files in {out}')
