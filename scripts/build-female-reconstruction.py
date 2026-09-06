"""Build a female study prototype from the BodyParts3D framework and HRA female organs.

Run: python3 scripts/build-female-reconstruction.py (requires numpy).

Pipeline
1. Omit male-specific BodyParts3D structures from the manifest.
2. Fit HRA female reproductive organs and breast tissue into the base pelvis and chest.
3. Drape the breast assembly onto the retained chest wall so it rests on the pectoral muscles.
4. Apply one smooth whole-body morph (stature, shoulders, thorax, waist, pelvis, head) to
   every mesh. Separately recorded posterior and inferior contour components apply only to explicitly listed glute meshes; pelvic organs and bones do not receive them.

The morph is a continuous displacement field whose Jacobian is checked on a finite sample
grid. This checks for sampled foldovers, not anatomical attachment correctness. Parameters
are recorded in the fit report and re-applied by scripts/validate-atlas.mjs to verify every vertex. This is a study prototype
with estimated female proportions, not an anatomically validated female atlas.
"""
from pathlib import Path
import argparse, copy, glob, gzip, json, os, re
import numpy as np

ROOT=Path(__file__).resolve().parents[1]
INPUT=ROOT/'public/models'
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--output-dir',type=Path,default=INPUT,help='Write a candidate to a separate directory before publishing it.')
OUT=parser.parse_args().output_dir.resolve()
OUT.mkdir(parents=True,exist_ok=True)
male=json.loads((INPUT/'atlas.json').read_text())
female=json.loads((INPUT/'atlas-female.json').read_text())
mp={p['id']:p for p in male['parts']}
fp={p['id']:p for p in female['parts']}
male_buffers=[(ROOT/('public'+c['url'])).read_bytes() for c in male['chunks']]
source_buffers=[(ROOT/('public'+c['url'])).read_bytes() for c in female['chunks']]

def read(buffers,p):
    b=buffers[p['chunk']]
    pos=np.frombuffer(b,'<f4',p['vertexCount']*3,p['positions']).reshape(-1,3).astype(np.float64)
    nrm=np.frombuffer(b,'<i2',p['vertexCount']*3,p['normals']).reshape(-1,3).astype(np.float64)/32767
    idx=np.frombuffer(b,'<u4',p['indexCount'],p['indices']).copy()
    return pos,nrm,idx

# ---------------------------------------------------------------- 1. exclusions
excluded_pattern=re.compile(r'penis|testicular|testis|scrot|prostat|seminal|deferent|epididym|spermatic|ejaculat|cremaster|bulbospong|ischiocav|perineal|coccygeus|puborectalis|levator ani|sphincter',re.I)
# The male pelvis is replaced by the HRA female pelvis (compact bone shells, sacrum, coccyx).
replacements={
 'FJ3152':['VH_F_ilium_compact_bone_R','VH_F_ischium_compact_bone_R','VH_F_pubis_compact_bone_R'],
 'FJ3288':['VH_F_ilium_compact_bone_L','VH_F_ischium_compact_bone_L','VH_F_pubis_compact_bone_L'],
 'FJ3393':['VH_F_sacrum','VH_F_coccyx'],
}
pelvis_names={'VH_F_ilium_compact_bone_R':'Right ilium','VH_F_ischium_compact_bone_R':'Right ischium','VH_F_pubis_compact_bone_R':'Right pubis','VH_F_ilium_compact_bone_L':'Left ilium','VH_F_ischium_compact_bone_L':'Left ischium','VH_F_pubis_compact_bone_L':'Left pubis','VH_F_sacrum':'Sacrum','VH_F_coccyx':'Coccyx'}
retained=[];excluded=[]
for p in male['parts']:
    reason=('Replaced by the HRA female pelvis' if p['id'] in replacements else
            'Male body surface omitted' if p['system']=='integumentary' else
            'Male reproductive anatomy omitted' if p['system']=='reproductive' else
            'Male urethra omitted; no validated female replacement bundled' if p['id']=='FJ3148' else
            'Sex-specific or pelvic-floor structure omitted' if excluded_pattern.search(p['name']) else None)
    if reason:excluded.append(dict(id=p['id'],name=p['name'],reason=reason))
    else:retained.append(copy.deepcopy(p))

def smoothstep(a,b,t):
    u=np.clip((t-a)/(b-a),0,1);return u*u*(3-2*u)
def bounds_of(parts):
    b=np.array([p['bounds'] for p in parts]);return b[:,0].min(axis=0),b[:,1].max(axis=0)
def bounds_fit(source_parts,target_parts):
    lo,hi=bounds_of(source_parts);tlo,thi=bounds_of(target_parts)
    scale=(thi-tlo)/(hi-lo);return scale,tlo-lo*scale

# ---------------------------------------------------------------- 2. affine fits
# One transform for the whole reproductive assembly preserves its internal alignment. The HRA
# bladder envelope is matched to the retained bladder as a placement proxy.
bladder_ids=['VH_F_fundus_of_urinary_bladder_dome','VH_F_fundus_of_urinary_bladder_base']
bladder_bounds=np.array([fp[i]['bounds'] for i in bladder_ids])
lo=bladder_bounds[:,0].min(axis=0);hi=bladder_bounds[:,1].max(axis=0)
target=np.array(mp['FJ3149']['bounds'])
pelvic_scale=(target[1]-target[0])/(hi-lo)
pelvic_offset=target[0]-lo*pelvic_scale
# Breast assembly: keep HRA size, place the nipple line near the fourth intercostal space of the
# base chest (about 71% of stature, matching its relative height in the HRA body).
breast_scale=np.array([1.03,.8,.35])
breast_offset=np.array([.009,.284,.115])
# Female pelvis: match hip bone envelopes as an initial placement proxy.
# This does not establish acetabular contact, landmark alignment, or muscle attachments.
hip_ids=[i for k in ('FJ3152','FJ3288') for i in replacements[k]]
pelvis_scale,pelvis_offset=bounds_fit([fp[i] for i in hip_ids],[mp['FJ3152'],mp['FJ3288']])
transforms={
 'reproductive':dict(scale=pelvic_scale.tolist(),offset=pelvic_offset.tolist(),basis='HRA bladder bounds aligned to retained BodyParts3D bladder bounds'),
 'mammary':dict(scale=breast_scale.tolist(),offset=breast_offset.tolist(),basis='HRA tissue compressed in height and depth, then fitted beneath the reference-guided breast contour'),
 'pelvis':dict(scale=pelvis_scale.tolist(),offset=pelvis_offset.tolist(),basis='HRA hip bone bounds aligned to BodyParts3D hip bone bounds; sacrum and coccyx share the transform')
}
pelvis_ids=[i for ids in replacements.values() for i in ids]
selected=[p for p in female['parts'] if p['system']=='reproductive' or (p['system']=='integumentary' and p['id']!='VH_F_skin') or p['id'] in pelvis_ids]

# Assemble every mesh in the base coordinate frame before deformation.
meshes=[]  # dict(part, pos, nrm, idx, provenance)
for p in retained:
    pos,nrm,idx=read(male_buffers,p)
    meshes.append(dict(part=p,pos=pos,nrm=nrm,idx=idx,provenance={'source':'BodyParts3D 4.0','sourceId':p['id'],'adaptation':'Retained reference geometry; reshaped by the shared female body morph'}))
for source in selected:
    group='pelvis' if source['id'] in pelvis_ids else 'mammary' if source['system']=='integumentary' else 'reproductive'
    t=transforms[group];scale=np.array(t['scale']);offset=np.array(t['offset'])
    pos,nrm,idx=read(source_buffers,source)
    pos=pos*scale+offset
    nrm=nrm/scale;nrm/=np.maximum(np.linalg.norm(nrm,axis=1,keepdims=True),1e-20)
    p=copy.deepcopy(source);p['system']='skeletal' if group=='pelvis' else group
    if group=='pelvis':p['name']=pelvis_names[source['id']]
    meshes.append(dict(part=p,pos=pos,nrm=nrm,idx=idx,group=group,provenance={'source':'HRA united-female v1.5','sourceId':source['id'],'adaptation':('Female pelvis fitted to the BodyParts3D hip bone envelope, replacing the male pelvis' if group=='pelvis' else 'Female reference anatomy fitted to the BodyParts3D framework'+(' and draped onto the chest wall' if group=='mammary' else ''))+'; experimental placement reshaped by the shared female body morph'}))

# ---------------------------------------------------------------- 3. breast drape
# Build a depth map of the anterior chest wall (front-most z of chest muscles and bones on a
# regular x/y grid), a matching map of the breast assembly's posterior envelope, and shift each
# breast column in z so the assembly rests a few millimetres into the wall instead of floating.
CELL=.004;GX0,GX1,GY0,GY1=-.24,.24,1.02,1.50
NX=int(round((GX1-GX0)/CELL))+1;NY=int(round((GY1-GY0)/CELL))+1
def cell_index(pos):
    ix=np.clip(np.rint((pos[:,0]-GX0)/CELL).astype(int),0,NX-1);iy=np.clip(np.rint((pos[:,1]-GY0)/CELL).astype(int),0,NY-1);return ix,iy
def project(items,reducer):
    # Rasterize every triangle onto the grid (barycentric depth at cell centres), so cells between
    # the sparse vertices of simplified meshes are covered too. reducer is max (front) or min (back).
    grid=np.full((NY,NX),np.nan);pick=np.fmax if reducer is max else np.fmin
    for m in items:
        pos=m['pos'];tri=pos[m['idx'].reshape(-1,3)]
        for a,b,c in tri:
            if max(a[1],b[1],c[1])<GY0 or min(a[1],b[1],c[1])>GY1 or max(a[0],b[0],c[0])<GX0 or min(a[0],b[0],c[0])>GX1:continue
            i0=max(0,int(np.ceil((min(a[0],b[0],c[0])-GX0)/CELL)));i1=min(NX-1,int(np.floor((max(a[0],b[0],c[0])-GX0)/CELL)))
            j0=max(0,int(np.ceil((min(a[1],b[1],c[1])-GY0)/CELL)));j1=min(NY-1,int(np.floor((max(a[1],b[1],c[1])-GY0)/CELL)))
            if i1<i0 or j1<j0:continue
            xs=GX0+np.arange(i0,i1+1)*CELL;ys=GY0+np.arange(j0,j1+1)*CELL;X,Y=np.meshgrid(xs,ys)
            det=(b[0]-a[0])*(c[1]-a[1])-(c[0]-a[0])*(b[1]-a[1])
            if abs(det)<1e-12:continue
            u=((X-a[0])*(c[1]-a[1])-(c[0]-a[0])*(Y-a[1]))/det;v=((b[0]-a[0])*(Y-a[1])-(X-a[0])*(b[1]-a[1]))/det
            inside=(u>=-1e-9)&(v>=-1e-9)&(u+v<=1+1e-9)
            if not inside.any():continue
            z=a[2]+u*(b[2]-a[2])+v*(c[2]-a[2])
            sub=grid[j0:j1+1,i0:i1+1];sub[inside]=pick(sub[inside],z[inside])
    # Vertices still count, so tiny meshes thinner than a cell are not lost.
    for m in items:
        pos=m['pos'];ix,iy=cell_index(pos)
        keep=(pos[:,0]>=GX0)&(pos[:,0]<=GX1)&(pos[:,1]>=GY0)&(pos[:,1]<=GY1)
        np.fmax.at(grid,(iy[keep],ix[keep]),pos[keep,2]) if reducer is max else np.fmin.at(grid,(iy[keep],ix[keep]),pos[keep,2])
    return grid
def fill_nearest(grid):
    filled=grid.copy();mask=~np.isnan(filled)
    while not mask.all():
        grown=filled.copy()
        for dy,dx in [(1,0),(-1,0),(0,1),(0,-1)]:
            shifted=np.roll(filled,(dy,dx),axis=(0,1));shifted_mask=np.roll(mask,(dy,dx),axis=(0,1))
            take=(~mask)&shifted_mask&np.isnan(grown);grown[take]=shifted[take]
        filled=grown;mask=~np.isnan(filled)
    return filled
def blur(grid,sigma):
    radius=int(3*sigma);k=np.exp(-np.arange(-radius,radius+1)**2/(2*sigma**2));k/=k.sum()
    out=np.apply_along_axis(lambda r:np.convolve(np.pad(r,radius,mode='edge'),k,'valid'),1,grid)
    return np.apply_along_axis(lambda c:np.convolve(np.pad(c,radius,mode='edge'),k,'valid'),0,out)
chest=[m for m in meshes if m['part']['system'] in('muscular','skeletal','connective') and m['part']['bounds'][1][2]>.02 and m['part']['bounds'][0][1]<GY1 and m['part']['bounds'][1][1]>GY0 and abs(m['part']['bounds'][0][0]+m['part']['bounds'][1][0])/2<.26 and 'papillary' not in m['part']['name'] and m['part']['name']!='Diaphragm']
wall=blur(fill_nearest(project(chest,max)),1.)
breast=[m for m in meshes if m['part']['system']=='mammary']
envelope=project(breast,min);covered=~np.isnan(envelope)
# A small standoff keeps the front of the thin upper breast clear of the muscle after smoothing;
# the max filter lets "push forward" win locally so the pectoral ridge never pokes through.
EMBED=-.002
shift=np.where(covered,wall-EMBED-envelope,np.nan)
def max_filter(grid,radius):
    out=grid.copy()
    for dy in range(-radius,radius+1):
        for dx in range(-radius,radius+1):
            out=np.fmax(out,np.roll(grid,(dy,dx),axis=(0,1)))
    return out
# Reference-guided surface: a broad lower mound and a longer, shallow upper slope.
# These are artistic contour estimates, not measured anatomy from the stock illustrations.
X,Y=np.meshgrid(GX0+np.arange(NX)*CELL,GY0+np.arange(NY)*CELL)
profile=dict(centerX=.100,centerY=1.268,radiusX=.068,upperRadius=.070,lowerRadius=.070,projection=.034)
U=(np.abs(X)-profile['centerX'])/profile['radiusX']
V=(Y-profile['centerY'])/np.where(Y>profile['centerY'],profile['upperRadius'],profile['lowerRadius'])
R2=U*U+V*V
thickness=profile['projection']*np.maximum(0,1-R2)**0.85
# Use a smooth chest base so small rib and muscle ridges do not imprint on the mound.
base_wall=blur(wall,6.)
blend=np.maximum(0,1-R2)**2
# Keep the exposed contour in front of the chest, then bring its narrow rim
# back to the wall. A smooth maximum avoids sharp muscle-shaped intersections.
contour=base_wall+thickness
clearance=wall+.0015
delta=contour-clearance
outer=.5*(contour+clearance+np.sqrt(delta*delta+.004**2))
rim=smoothstep(.86,1.,np.sqrt(R2))
surface=outer*(1-rim)+clearance*rim
# Place the source areola near the surface and carry ducts/lobes with it. Its source
# depth is shared on both sides; the nipple remains slightly proud of the adipose shell.
drape_grid=surface-(.081*breast_scale[2]+breast_offset[2])
def bilinear(grid,pos):
    fx=np.clip((pos[:,0]-GX0)/CELL,0,NX-1.000001);fy=np.clip((pos[:,1]-GY0)/CELL,0,NY-1.000001)
    x0=np.floor(fx).astype(int);y0=np.floor(fy).astype(int);tx=fx-x0;ty=fy-y0
    return (grid[y0,x0]*(1-tx)*(1-ty)+grid[y0,x0+1]*tx*(1-ty)+grid[y0+1,x0]*(1-tx)*ty+grid[y0+1,x0+1]*tx*ty)
tissue_insets={}
for m in breast:
    # Keep ducts, lobes and ligaments under the outer contour. Only the nipple and
    # areolar surface should emerge; all structures remain selectable individually.
    external=any(k in m['part']['id'] for k in ('nipple','areola'))
    # Independent containment screening found the extra 8 mm shift buried internal
    # tissue behind the envelope. A 3 mm inset improves each lobe/duct group without
    # creating anterior sinus exits. Supports keep their prior placement; this remains
    # a partial geometric correction, not anatomically validated tissue registration.
    internal=any(k in m['part']['id'] for k in ('mammary_lobes','main_lactiferous_ducts','main_lactiferous_sinuses'))
    inset=0. if external else -.003 if internal else -.008
    tissue_insets[m['part']['id']]=inset
    m['pos']=m['pos'].copy();m['pos'][:,2]+=bilinear(drape_grid,m['pos'])+inset
    tri=m['idx'].reshape(-1,3);pos=m['pos'];n=np.zeros_like(pos)
    fn=np.cross(pos[tri[:,1]]-pos[tri[:,0]],pos[tri[:,2]]-pos[tri[:,0]])
    for k in range(3):np.add.at(n,tri[:,k],fn)
    lengths=np.linalg.norm(n,axis=1,keepdims=True)
    m['nrm']=np.where(lengths>1e-15,n/np.maximum(lengths,1e-20),m['nrm'])
drape=dict(cell=CELL,origin=[GX0,GY0],columns=NX,rows=NY,embed=EMBED,values=np.round(drape_grid,6).tolist())

# Generate a closed outer adipose envelope with its back embedded in the chest.
# Internal HRA structures retain their topology and follow the recorded displacement grid.
UNDERCUT=.004
# Sculpted fat lobules: jittered seed points across the pad, each a rounded bump, so the surface
# reads as lobulated adipose tissue under the scene lighting (as in ecorche illustrations)
# instead of a smooth shell. Bumps fade at the rim and around the areola.
LOBULE=dict(spacing=.0105,sigma=.0042,amplitude=.0,seed=7)  # smooth surface; the reference style draws fibres, not lobules
def lobule_seeds(side):
    rng=np.random.default_rng(LOBULE['seed']+(0 if side=='left' else 1));cx=profile['centerX']*(1 if side=='left' else -1)
    sp=LOBULE['spacing'];pts=[]
    for j,y in enumerate(np.arange(profile['centerY']-.1,profile['centerY']+.1,sp*.87)):
        for x in np.arange(cx-.1,cx+.1,sp):
            pts.append([x+(sp/2 if j%2 else 0)+rng.uniform(-.25,.25)*sp,y+rng.uniform(-.25,.25)*sp])
    return np.array(pts)
def areola_center(side):
    a=[m for m in breast if m['part']['id']==('VH_F_areola_L' if side=='left' else 'VH_F_areola_R')][0]['pos'];return a[:,:2].mean(axis=0)
def lobules(xy,side):
    seeds=lobule_seeds(side);d2=((xy[:,None,0]-seeds[None,:,0])**2+(xy[:,None,1]-seeds[None,:,1])**2)
    bump=np.exp(-d2/(2*LOBULE['sigma']**2)).sum(axis=1);bump=bump/bump.max()
    cx=profile['centerX']*(1 if side=='left' else -1)
    u=(xy[:,0]-cx)/profile['radiusX'];v=(xy[:,1]-profile['centerY'])/np.where(xy[:,1]>profile['centerY'],profile['upperRadius'],profile['lowerRadius'])
    fade=1-smoothstep(.55,.95,np.sqrt(u*u+v*v))
    ac=areola_center(side);fade=fade*smoothstep(.012,.024,np.hypot(xy[:,0]-ac[0],xy[:,1]-ac[1]))
    return LOBULE['amplitude']*(bump-.55)*fade
def breast_surface_mesh(side,front,back):
    # Concentric rings give a smooth perimeter rather than a staircase cut from a grid.
    rings=64;segments=192;cx=profile['centerX']*(1 if side=='left' else -1)
    xy=[[cx,profile['centerY'],0.]]
    for ring in range(1,rings+1):
        r=ring/rings
        for j in range(segments):
            t=2*np.pi*j/segments;v=np.sin(t)
            xy.append([cx+profile['radiusX']*r*np.cos(t),profile['centerY']+r*v*(profile['upperRadius'] if v>=0 else profile['lowerRadius']),0.])
    xy=np.array(xy);f=xy.copy();b=xy.copy()
    f[:,2]=bilinear(front,xy)+lobules(xy,side);b[:,2]=bilinear(back,xy);count=len(f)
    pos=np.concatenate([f,b]);tri=[]
    for j in range(segments):tri.append([0,1+j,1+(j+1)%segments])
    for ring in range(1,rings):
        for j in range(segments):
            a=1+(ring-1)*segments+j;b=1+(ring-1)*segments+(j+1)%segments
            c=b+segments;d=a+segments;tri.extend([[a,c,b],[a,d,c]])
    tri += [[c+count,b+count,a+count] for a,b,c in tri.copy()]
    start=1+(rings-1)*segments
    for j in range(segments):
        a=start+j;b=start+(j+1)%segments
        tri.extend([[a,a+count,b+count],[a,b+count,b]])
    idx=np.array(tri,dtype=np.uint32);n=np.zeros_like(pos)
    fn=np.cross(pos[idx[:,1]]-pos[idx[:,0]],pos[idx[:,2]]-pos[idx[:,0]])
    for k in range(3):np.add.at(n,idx[:,k],fn)
    n/=np.maximum(np.linalg.norm(n,axis=1,keepdims=True),1e-20)
    return pos,n,idx.reshape(-1)
regenerated=[]
for m in breast:
    if 'Interlobar adipose' not in m['part']['name']:continue
    side='left' if m['part']['id'].endswith('_L') else 'right'
    side_mask=X>0 if side=='left' else X<0
    front=surface;back=np.minimum(surface,wall)-UNDERCUT
    mask=(R2<.99)&side_mask
    pos,nrm,idx=breast_surface_mesh(side,front,back)
    m.update(pos=pos,nrm=nrm,idx=idx)
    m['part']['name']=f'Adipose tissue of {side} breast'
    m['provenance']['adaptation']='Reference-guided smooth breast body on the pectoralis, replacing the HRA adipose envelope; estimated shape reshaped by the shared female body morph'
    regenerated.append(m['part']['id'])
gap_before=float(np.nanmedian(shift));residual=np.where(covered,wall-EMBED-(envelope+drape_grid),np.nan);gap_after=float(np.median((back-wall)[R2<.99]));gap_max=float(np.max((back-wall)[R2<.99]))

# ---------------------------------------------------------------- 4. whole-body morph
# Lateral width factor by height (base frame, before stature scaling). Between knots the
# factor follows a smoothstep so the field is continuous and slopes stay gentle along the arms.
MORPH=dict(
 stature=.95,
 # User-reference silhouette pass: broader pelvis/upper hips and narrower shoulder cap.
 # Artistic proportions, not a population measurement. The Sketchfab/comparison waist pass
 # keeps the slim waist; a three-view pass rebalances hip width and posterior glute contour.
 lateralKnots=[[0.,1.],[.55,1.],[.80,1.08],[.92,1.15],[1.03,1.15],[1.12,.955],[1.21,.96],[1.29,.93],[1.42,.88],[1.48,.88],[1.60,1.]],
 # Retain the existing limb field outside the torso, with a nearly rigid 3 mm inward arm shift.
 # Blend the new torso silhouette smoothly rather than sending hip widening into the forearms.
 lateralBlend=dict(referenceKnots=[[0.,1.],[.55,1.],[.80,1.05],[.92,1.10],[1.03,1.10],[1.21,.96],[1.29,.95],[1.42,.91],[1.48,.91],[1.60,1.]],innerRadius=.17,outerRadius=.23,outerTranslation=-.003,heightRamp=[.45,.55,1.48,1.60]),
 waistRefinement=dict(delta=-.095,heightRamp=[1.03,1.12,1.21],radialRamp=[.14,.17]),
 lateralRadius=.17,  # beyond this |x| the lateral change saturates into a translation, so arms move with the torso instead of being squeezed
 thoraxDepth=dict(scale=.96,ramp=[1.05,1.15,1.35,1.45]),
 # Posterior and inferior contour for explicitly listed glute muscles and their inferior veins.
 # Paired lobes fade at the midline and rim. Explicit IDs exclude misplaced pelvic ligaments.
 # An illustration-guided soft-tissue contour, not a measured female muscle volume.
 gluteProjection=dict(partIds=['FJ1418','FJ1418M','FJ3513','FJ3606'],scope='BodyParts3D bilateral gluteus maximus and inferior gluteal veins only; posterior/inferior components excluded from bones, pelvic organs, ligaments and lumbar muscles',amplitude=.020,centerX=.070,centerY=.880,radiusX=.100,radiusY=.180,midlineRamp=[.030,.050],depthRamp=[-.120,-.095],lowerDepth=dict(heightRise=[.780,.860],heightFade=[.830,.895],depthRamp=[-.100,-.060]),inferior=dict(amplitude=.022,posteriorFade=[-.120,-.075],midlineRamp=[.006,.020],lateralFade=[.065,.105],heightRamp=[.760,.800,.840,.885],depthRamp=[-.090,-.060])),
 head=dict(scale=.95,center=[0.,1.61,-.03],ramp=[1.44,1.56]),
 # Lower nasal bridge and projection: depth beyond the face plane is compressed inside a smooth
 # window around the nose (nasal bones and cartilages), giving a flatter East Asian profile.
 nose=dict(plane=.062,scale=.52,center=[0.,1.578],radius=[.03,.045],rampDepth=.012),
)
def lateral_factor(y,knots=None):
    knots=MORPH['lateralKnots'] if knots is None else knots;out=np.full_like(y,knots[-1][1])
    out=np.where(y<knots[0][0],knots[0][1],out)
    for (y0,s0),(y1,s1) in zip(knots,knots[1:]):
        inside=(y>=y0)&(y<y1);out=np.where(inside,s0+(s1-s0)*smoothstep(y0,y1,y),out)
    return out
def morph(p,part_id=None):
    x,y,z=p[:,0],p[:,1],p[:,2];R=MORPH['lateralRadius']
    factor=lateral_factor(y);dx=(factor-1)*R*np.tanh(x/R)
    blend=MORPH.get('lateralBlend')
    if blend:
        reference=lateral_factor(y,blend['referenceKnots'])
        w=smoothstep(blend['innerRadius'],blend['outerRadius'],np.abs(x));r=blend['heightRamp']
        outer=np.sign(x)*blend['outerTranslation']*smoothstep(r[0],r[1],y)*(1-smoothstep(r[2],r[3],y))
        dx=(reference-1)*R*np.tanh(x/R)+(1-w)*(factor-reference)*R*np.tanh(x/R)+w*outer
    waist=MORPH.get('waistRefinement')
    if waist:
        r=waist['heightRamp'];weight=smoothstep(r[0],r[1],y)*(1-smoothstep(r[1],r[2],y))
        weight*=1-smoothstep(*waist['radialRamp'],np.abs(x))
        dx+=waist['delta']*R*np.tanh(x/R)*weight
    t=MORPH['thoraxDepth'];w=smoothstep(t['ramp'][0],t['ramp'][1],y)*(1-smoothstep(t['ramp'][2],t['ramp'][3],y))
    dz=z*(t['scale']-1)*w
    dy=np.zeros_like(y)
    g=MORPH.get('gluteProjection')
    if g and part_id in g['partIds']:
        r2=((np.abs(x)-g['centerX'])/g['radiusX'])**2+((y-g['centerY'])/g['radiusY'])**2
        posterior=1-smoothstep(*g['depthRamp'],z)
        lower=g.get('lowerDepth')
        if lower:
            low=(1-smoothstep(*lower['heightFade'],y))*(1-smoothstep(*lower['depthRamp'],z))
            if 'heightRise' in lower:low*=smoothstep(*lower['heightRise'],y)
            posterior=posterior+low-posterior*low
        gate=(1-smoothstep(0.,1.,r2))*smoothstep(*g['midlineRamp'],np.abs(x))*posterior
        dz-=g['amplitude']*gate
        inferior=g.get('inferior')
        if inferior:
            r=inferior['heightRamp']
            weight=smoothstep(*inferior['midlineRamp'],np.abs(x))*(1-smoothstep(*inferior['lateralFade'],np.abs(x)))
            weight*=smoothstep(r[0],r[1],y)*(1-smoothstep(r[2],r[3],y))*(1-smoothstep(*inferior['depthRamp'],z))
            if 'posteriorFade' in inferior:weight*=smoothstep(*inferior['posteriorFade'],z)
            dy-=inferior['amplitude']*weight
    q=np.stack([x+dx,y+dy,z+dz],axis=1)
    n=MORPH['nose'];r2=((x-n['center'][0])/n['radius'][0])**2+((y-n['center'][1])/n['radius'][1])**2
    wn=(1-smoothstep(0.,1.,r2))*smoothstep(n['plane']-n['rampDepth'],n['plane']+n['rampDepth'],z)
    q[:,2]=q[:,2]-wn*(1-n['scale'])*(z-n['plane'])
    h=MORPH['head'];wh=smoothstep(h['ramp'][0],h['ramp'][1],y)[:,None]
    q=q-wh*(1-h['scale'])*(q-np.array(h['center']))
    return q*MORPH['stature']
def morph_normals(p,n,part_id=None,h=1e-4):
    base=morph(p,part_id);J=np.empty((len(p),3,3))
    for axis in range(3):
        d=np.zeros(3);d[axis]=h;J[:,:,axis]=(morph(p+d,part_id)-base)/h
    cof=np.linalg.inv(J).transpose(0,2,1)
    out=np.einsum('nij,nj->ni',cof,n);return out/np.maximum(np.linalg.norm(out,axis=1,keepdims=True),1e-20)
# Jacobian sanity: sample the field over the body volume.
grid=np.stack(np.meshgrid(np.linspace(-.35,.35,29),np.linspace(0,1.75,71),np.linspace(-.15,.15,13),indexing='ij'),-1).reshape(-1,3)
# Screen both base field and the optional glute field. All eligible IDs use the same field.
min_dets={}
for label,part_id in [('shared',None),('glute','FJ1418')]:
    J=np.empty((len(grid),3,3));base=morph(grid,part_id)
    for axis in range(3):
        d=np.zeros(3);d[axis]=1e-4;J[:,:,axis]=(morph(grid+d,part_id)-base)/1e-4
    min_dets[label]=float(np.linalg.det(J).min());assert min_dets[label]>0,min_dets
min_det=min(min_dets.values())
for m in meshes:
    part_id=m['part']['id']
    if part_id in MORPH['gluteProjection']['partIds']:
        m['provenance']['adaptation']+='; illustration-guided posterior and inferior glute contour (explicit part-ID scope)'
    m['nrm']=morph_normals(m['pos'],m['nrm'],part_id);m['pos']=morph(m['pos'],part_id)

# ---------------------------------------------------------------- write atlas
for stale in glob.glob(str(OUT/'female-base-*.bin*')):os.remove(stale)
atlas=copy.deepcopy(male)
atlas.update(version='Female study prototype v3',sex='female',source='BodyParts3D framework + HRA female anatomy',scope='Estimated female proportions; experimental organ placement',reconstruction=True,parts=[],concepts=[],chunks=[])
chunks=atlas['chunks'];blob=bytearray()
def flush():
    global blob
    if not blob:return
    name=f'female-base-{len(chunks)}.bin';data=bytes(blob)
    compressed=gzip.compress(data,compresslevel=9,mtime=0)
    (OUT/name).write_bytes(data);(OUT/(name+'.gz')).write_bytes(compressed)
    chunks.append(dict(url=f'/models/{name}',bytes=len(data),gzip=f'/models/{name}.gz',gzipBytes=len(compressed)))
    blob=bytearray()
def append(a):
    while len(blob)%4:blob.append(0)
    offset=len(blob);blob.extend(a.tobytes());return offset
added=[]
for m in meshes:
    if len(blob)>4_000_000:flush()
    pos=m['pos'].astype('<f4');nrm=np.rint(m['nrm']*32767).astype('<i2');idx=m['idx'].astype('<u4')
    p=copy.deepcopy(m['part'])
    if m.get('group')=='mammary' and any(k in p['id'] for k in ('nipple','areola')):p['system']='integumentary'
    p.update(chunk=len(chunks),vertexCount=len(pos),indexCount=len(idx),positions=append(pos),normals=append(nrm),indices=append(idx),bounds=[pos.min(axis=0).tolist(),pos.max(axis=0).tolist()],provenance=m['provenance'])
    atlas['parts'].append(p)
    if p['provenance']['source']!='BodyParts3D 4.0':p['group']=m['group'];added.append(p)
flush()

# Concepts must remain complete. Never relabel a truncated male body concept as female or
# leave hidden genital members in a compound selection.
retained_ids={p['id'] for p in retained}
for c in male['concepts']:
    if c['elements'] and all(e in retained_ids or e in replacements for e in c['elements']):
        atlas['concepts'].append(dict(c,elements=[r for e in c['elements'] for r in (replacements.get(e) or [e])]))
selected_ids={p['id'] for p in selected}
for c in female['concepts']:
    if c['elements'] and set(c['elements'])<=selected_ids:atlas['concepts'].append(copy.deepcopy(c))
for p in atlas['parts']:
    if not any(c['elements']==[p['id']] for c in atlas['concepts']):
        atlas['concepts'].append(dict(id='PART_'+p['id'],name=p['name'],elements=[p['id']]))
assert len({c['id'] for c in atlas['concepts']})==len(atlas['concepts'])
atlas['triangles']=sum(p['indexCount']//3 for p in atlas['parts'])
atlas['optimized']={'method':'Optimized BodyParts3D framework and affine-fitted optimized HRA female meshes, reshaped by a shared female body morph plus an explicit-ID posterior glute contour','preservedMeshes':len(atlas['parts'])}
atlas.pop('sourceTriangles',None)
atlas['reconstructionReport']='/models/female-fit-report.json'

def extent(name,axis):
    ps=[p for p in atlas['parts'] if p['name']==name];src=[mp[p['id']] for p in ps]
    return dict(before=round(max(q['bounds'][1][axis] for q in src)-min(q['bounds'][0][axis] for q in src),4),after=round(max(q['bounds'][1][axis] for q in ps)-min(q['bounds'][0][axis] for q in ps),4))
def span(names,axis,after_names=None):
    src=[p for p in male['parts'] if p['name'] in names];ps=[p for p in atlas['parts'] if p['name'] in (after_names or names)]
    return dict(before=round(max(q['bounds'][1][axis] for q in src)-min(q['bounds'][0][axis] for q in src),4),after=round(max(q['bounds'][1][axis] for q in ps)-min(q['bounds'][0][axis] for q in ps),4))
landmarks=dict(
 stature=dict(before=round(max(q['bounds'][1][1] for q in mp.values()),4),after=round(max(p['bounds'][1][1] for p in atlas['parts']),4)),
 biacromialWidth=span(['Left scapula','Right scapula'],0),
 biIliacWidth=span(['Left hip bone','Right hip bone'],0,['Left ilium','Right ilium']),
 headWidth=span(['Left parietal bone','Right parietal bone'],0),
 chestDepth=extent('Body of sternum',2),
)
report=dict(method='BodyParts3D framework with fitted and draped HRA female structures, shared whole-body morph plus explicit-ID posterior glute contour',reviewStatus='Experimental; proportions estimated, organ placement unreviewed',transforms=transforms,morph=MORPH,drape=drape,breastProfile=profile,lobules=LOBULE,tissueInsets=tissue_insets,regenerated=regenerated,replacements=replacements,landmarks=landmarks,retained=[p['id'] for p in retained],added=[dict(id=p['id'],name=p['name'],system=p['system'],transform=p['group']) for p in added],excluded=excluded,checks=dict(retainedGeometryUnchanged=False,limbProportionsUnchanged=False,minimumMorphJacobian=min_det,minimumMorphJacobianByField=min_dets,minimumTransformDeterminant=float(min(np.prod(t['scale']) for t in transforms.values())),breastWallGapBeforeDrapeM=gap_before,breastWallGapAfterDrapeM=gap_after,breastWallMaxResidualM=gap_max),parts=len(atlas['parts']),concepts=len(atlas['concepts']),triangles=atlas['triangles'])
for p in atlas['parts']:p.pop('group',None)
(OUT/'atlas-female-reconstructed.json').write_text(json.dumps(atlas,separators=(',',':')))
(OUT/'female-fit-report.json').write_text(json.dumps(report,indent=2))
print(json.dumps({k:report[k] for k in ['checks','landmarks','parts','concepts','triangles']},indent=2))
print('Retained',len(retained),'base meshes; added',len(added),'female meshes; excluded',len(excluded),'base meshes')
print('Compressed MB',sum(c['gzipBytes'] for c in chunks)/1e6)
