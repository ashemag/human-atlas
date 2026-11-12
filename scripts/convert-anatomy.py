"""Convert official BodyParts3D 4.0 OBJ meshes without altering topology.
Usage: python3 scripts/convert-anatomy.py OBJ_DIRECTORY CONCEPT_MAP SYSTEM_MAP
Source and attribution: public/ATTRIBUTION.md. Geometry positions change mm/Z-up
into meters/Y-up; normals become signed 16-bit and parts are grouped into chunks.
"""
import sys,json,re,struct,math
from pathlib import Path
from array import array
root=Path(__file__).resolve().parents[1]
source=Path(sys.argv[1]); metadata=json.loads(Path(sys.argv[2]).read_text()); systemdata=json.loads(Path(sys.argv[3]).read_text()) if len(sys.argv)>3 else {}
out=root/'public/models';out.mkdir(parents=True,exist_ok=True)
# Accept the research map's element records or a direct id -> system mapping.
systems=systemdata.get('systems',systemdata.get('mapping',systemdata.get('elements',systemdata.get('meshes',systemdata))))
if isinstance(systems,list): systems={x['id']:x for x in systems}
parts=[];chunks=[];blob=bytearray();chunk=0;total_triangles=0
for element in metadata['elements']:
    mesh=source/(element['id']+'.obj')
    record=systemdata.get('parts',{}).get(element['id'],{})
    vertices=[];normals=[];indices=[];name=element['name']
    for line in mesh.read_text().splitlines():
        if line.startswith('# English name : '):name=line.split(' : ',1)[1].strip() or element['name']
        elif line.startswith('v '):
            x,y,z=map(float,line.split()[1:4]);vertices.extend([x*.001,z*.001+.0781112,-y*.001-.1])
        elif line.startswith('vn '):
            x,y,z=map(float,line.split()[1:4]);normals.extend([round(x*32767),round(z*32767),round(-y*32767)])
        elif line.startswith('f '):
            face=[int(s.split('/')[0])-1 for s in line.split()[1:]]
            for j in range(1,len(face)-1):indices.extend([face[0],face[j],face[j+1]])
    assert len(normals)==len(vertices),element['id']
    assert len(vertices) and max(indices)<len(vertices)//3
    if len(blob)>7_000_000:
        (out/f'anatomy-{chunk}.bin').write_bytes(blob);chunks.append({'url':f'/models/anatomy-{chunk}.bin','bytes':len(blob)});blob=bytearray();chunk+=1
    def append(values,fmt):
        while len(blob)%4:blob.append(0)
        offset=len(blob);blob.extend(array(fmt,values).tobytes());return offset
    po=append(vertices,'f');no=append(normals,'h');io=append(indices,'I')
    bounds=[[min(vertices[i::3]) for i in range(3)],[max(vertices[i::3]) for i in range(3)]]
    system=systems.get(element['id'],'connective')
    if isinstance(system,dict):system=system.get('system',system.get('category','connective'))
    parts.append({'id':element['id'],'name':record.get('name',name),'conceptId':record.get('conceptId',element['conceptId']),'system':system,'chunk':chunk,'positions':po,'normals':no,'indices':io,'vertexCount':len(vertices)//3,'indexCount':len(indices),'bounds':bounds})
    total_triangles+=len(indices)//3
(out/f'anatomy-{chunk}.bin').write_bytes(blob);chunks.append({'url':f'/models/anatomy-{chunk}.bin','bytes':len(blob)})
manifest={'version':'BodyParts3D 4.0','sex':'male','parts':parts,'chunks':chunks,'triangles':total_triangles,'concepts':[{k:v for k,v in c.items() if k in ['id','name','elements']} for c in metadata['concepts']]}
(out/'atlas.json').write_text(json.dumps(manifest,separators=(',',':')))
print(json.dumps({'parts':len(parts),'concepts':len(manifest['concepts']),'triangles':total_triangles,'bytes':sum(c['bytes'] for c in chunks),'chunks':len(chunks),'systems':sorted(set(p['system'] for p in parts))},indent=2))
