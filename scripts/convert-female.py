"""Convert the official HRA united-female v1.5 GLB into named atlas meshes.
Run: python3 scripts/convert-female.py SOURCE.glb SOURCE_PARTS.json
The source has baked, aligned Y-up meter coordinates; only translate to the stage.
"""
import json,sys,struct,math,re
from pathlib import Path
from array import array
source=Path(sys.argv[1]).read_bytes();jl=struct.unpack_from('<I',source,12)[0];doc=json.loads(source[20:20+jl]);binstart=20+jl+8;binary=memoryview(source)[binstart:]
metadata=json.loads(Path(sys.argv[2]).read_text());records={r['nodeIndex']:r for r in metadata['parts']}
out=Path(__file__).resolve().parents[1]/'public/models';chunks=[];blob=bytearray();parts=[];shift=.794760942;triangles=0
formats={5126:('f',4),5125:('I',4),5123:('H',2),5121:('B',1)}
widths={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4}
def read(index):
 a=doc['accessors'][index];view=doc['bufferViews'][a['bufferView']];fmt,sz=formats[a['componentType']];width=widths[a['type']];offset=view.get('byteOffset',0)+a.get('byteOffset',0);stride=view.get('byteStride',width*sz)
 if stride==width*sz:
  v=array(fmt);v.frombytes(binary[offset:offset+a['count']*width*sz]);return v
 values=array(fmt)
 for i in range(a['count']):values.extend(struct.unpack_from('<'+fmt*width,binary,offset+i*stride))
 return values

def flush():
 global blob
 if not blob:return
 url=f'/models/source-female-{len(chunks)}.bin';(out/url.split('/')[-1]).write_bytes(blob);chunks.append({'url':url,'bytes':len(blob)});blob=bytearray()
def append(values):
 while len(blob)%4:blob.append(0)
 offset=len(blob);blob.extend(values.tobytes());return offset
nodeparts={}
for ni,node in enumerate(doc['nodes']):
 if 'mesh' not in node:continue
 assert not any(k in node for k in ['matrix','translation','rotation','scale']),node['name']
 r=records[ni];positions=array('f');normals=array('h');indices=array('I')
 for primitive in doc['meshes'][node['mesh']]['primitives']:
  assert primitive.get('mode',4)==4
  pos=read(primitive['attributes']['POSITION']);norm=read(primitive['attributes']['NORMAL']);ind=read(primitive['indices']);base=len(positions)//3
  for i in range(1,len(pos),3):pos[i]+=shift
  positions.extend(pos);normals.extend(max(-32767,min(32767,round(v*32767))) for v in norm);indices.extend(i+base for i in ind)
 name=r.get('sourceLabel') or r['name'];name=r['name'] if name.strip() in ['','-','None','NA'] else name;system=r['system'];context=' '.join(r['parents']+[r['id'],name]).lower()
 if any(v in context for v in ['placenta','umbilical_cord','chorionic','decidua']):system='pregnancy'
 elif system=='circulatory':
  system='venous' if any(v in context for v in ['vein','venous','vena_']) else 'cardiac' if 'heart' in context else 'arterial'
 elif system=='nervous' and any(v in context for v in ['eye','ear','retina','lens','optic']):system='sensory'
 if len(blob)>6_000_000:flush()
 bounds=[[min(positions[i::3]) for i in range(3)],[max(positions[i::3]) for i in range(3)]]
 part={'id':r['id'],'name':name,'conceptId':r['ontologyId'] if r.get('ontologyId') not in [None,'','-','None','NA'] else 'HRA:'+r['id'],'system':system,'chunk':len(chunks),'positions':append(positions),'normals':append(normals),'indices':append(indices),'vertexCount':len(positions)//3,'indexCount':len(indices),'bounds':bounds}
 parts.append(part);nodeparts[ni]=part['id'];triangles+=len(indices)//3
flush()
def descendants(i):
 n=doc['nodes'][i];return ([nodeparts[i]] if i in nodeparts else [])+[p for child in n.get('children',[]) for p in descendants(child)]
concepts=[];seen=set()
for i,node in enumerate(doc['nodes']):
 elements=descendants(i)
 if not elements:continue
 extras=node.get('extras',{});name=extras.get('label') or node.get('name','Structure').replace('VH_F_','').replace('_',' ')
 if name.strip() in ['','-','None','NA']:name=re.sub(r'^(VH_F_|Allen_)','',node.get('name','Structure')).replace('_',' ')
 identity=(name,tuple(elements))
 if identity in seen:continue
 seen.add(identity);concepts.append({'id':'HRA:'+node.get('name',str(i)),'name':name,'elements':elements})
atlas={'version':'HRA united-female v1.5','sex':'female','source':'Human Reference Atlas','scope':'Female reference assembly · partial skeleton and muscle coverage','parts':parts,'concepts':concepts,'chunks':chunks,'triangles':triangles}
(out/'atlas-female.json').write_text(json.dumps(atlas,separators=(',',':')))
print(json.dumps({'parts':len(parts),'concepts':len(concepts),'triangles':triangles,'bytes':sum(c['bytes'] for c in chunks),'systems':sorted(set(p['system'] for p in parts))}))
