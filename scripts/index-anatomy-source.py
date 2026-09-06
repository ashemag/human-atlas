"""Index official OBJ header identities without loading or modifying mesh geometry.
Usage: python3 scripts/index-anatomy-source.py ARCHIVE.zip OUTPUT.json
"""
import json,re,sys,zipfile
from pathlib import Path
with zipfile.ZipFile(sys.argv[1]) as archive:
    records=[]
    for filename in sorted(archive.namelist()):
        if not filename.endswith('.obj'):continue
        with archive.open(filename) as stream:
            header=stream.read(8192).decode('utf-8',errors='replace')
        def field(label):
            m=re.search(r'^# '+re.escape(label)+r' : (.*)$',header,re.M)
            return m.group(1).strip() if m else None
        record=dict(id=field('File ID'),name=field('English name'),conceptId=field('Concept ID'),file=filename)
        if not record['id']:raise ValueError('Missing source ID: '+filename)
        record['name']=record['name'] or None
        records.append(record)
    if len({r['id'] for r in records})!=len(records):raise ValueError('Duplicate source mesh IDs')
Path(sys.argv[2]).write_text(json.dumps(records,indent=2)+'\n')
print(f'Indexed {len(records)} source meshes')
