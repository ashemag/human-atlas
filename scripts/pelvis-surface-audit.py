#!/usr/bin/env python3
"""Independent pelvis surface proximity screen; numpy only, no anatomy pass/fail."""
import argparse
import hashlib
import heapq
import json
from pathlib import Path
import numpy as np

ROOT = Path(__file__).resolve().parents[1]

def closest_on_triangles(point, triangles):
    """Exact nearest points, including degenerate triangles via their edges."""
    a, b, c = triangles[:, 0], triangles[:, 1], triangles[:, 2]
    ab, ac = b-a, c-a
    n = np.cross(ab, ac)
    n2 = np.sum(n*n, axis=1)
    q = point - n * (np.sum((point-a)*n, axis=1)/np.maximum(n2, 1e-30))[:, None]
    v = q-a
    aa, bb, cc = np.sum(ab*ab, axis=1), np.sum(ab*ac, axis=1), np.sum(ac*ac, axis=1)
    av, cv = np.sum(ab*v, axis=1), np.sum(ac*v, axis=1)
    det = aa*cc-bb*bb
    s = (cc*av-bb*cv)/np.maximum(det, 1e-30)
    t = (aa*cv-bb*av)/np.maximum(det, 1e-30)
    inside = (n2 > 1e-24) & (s >= 0) & (t >= 0) & (s+t <= 1)
    candidates = [q]
    for start, end in ((a,b),(b,c),(c,a)):
        edge = end-start
        frac = np.clip(np.sum((point-start)*edge, axis=1)/np.maximum(np.sum(edge*edge,axis=1),1e-30),0,1)
        candidates.append(start+edge*frac[:,None])
    candidates = np.stack(candidates, axis=1)
    dist2 = np.sum((candidates-point)**2, axis=2)
    dist2[~inside,0] = np.inf
    best = np.argmin(dist2,axis=1)
    return candidates[np.arange(len(triangles)),best], dist2[np.arange(len(triangles)),best]

class Surface:
    """AABB hierarchy prunes candidates; final distances use triangle surfaces."""
    def __init__(self, vertices, faces):
        self.triangles = vertices[faces]
        self.nodes = []
        self._build(np.arange(len(faces)))

    def _build(self, ids):
        triangles = self.triangles[ids]
        low, high = triangles.min(axis=(0,1)), triangles.max(axis=(0,1))
        index = len(self.nodes)
        self.nodes.append(None)
        if len(ids) <= 24:
            self.nodes[index] = (low,high,ids,None)
        else:
            axis = np.argmax(high-low)
            ids = ids[np.argsort(triangles.mean(axis=1)[:,axis],kind='stable')]
            mid = len(ids)//2
            self.nodes[index] = (low,high,None,(self._build(ids[:mid]),self._build(ids[mid:])))
        return index

    def nearest(self, point):
        queue = [(0.,0)]
        best, nearest = np.inf, None
        while queue:
            lower, index = heapq.heappop(queue)
            if lower > best:
                break
            low, high, ids, children = self.nodes[index]
            if ids is not None:
                points, distances = closest_on_triangles(point,self.triangles[ids])
                i = int(np.argmin(distances))
                if distances[i] < best:
                    best, nearest = float(distances[i]), points[i]
            else:
                for child in children:
                    lo, hi, _, _ = self.nodes[child]
                    delta = np.maximum(np.maximum(lo-point,point-hi),0)
                    bound = float(delta@delta)
                    if bound <= best:
                        heapq.heappush(queue,(bound,child))
        return np.sqrt(best), nearest

    def distances(self, vertices):
        return np.array([self.nearest(p)[0] for p in vertices])

class Atlas:
    def __init__(self, root, filename):
        self.root = root
        self.path = root/'public/models'/filename
        self.data = json.loads(self.path.read_text())
        self.parts = {p['id']:p for p in self.data['parts']}
        self.buffers = {}

    def mesh(self, ids, transform=None):
        vertices, faces, offset = [], [], 0
        for key in ids:
            p = self.parts[key]
            chunk = p['chunk']
            if chunk not in self.buffers:
                self.buffers[chunk] = (self.root/'public'/self.data['chunks'][chunk]['url'].lstrip('/')).read_bytes()
            buf = self.buffers[chunk]
            v = np.frombuffer(buf,'<f4',p['vertexCount']*3,p['positions']).reshape(-1,3).astype(float)
            if transform:
                v = transform(v,key)
            f = np.frombuffer(buf,'<u4',p['indexCount'],p['indices']).reshape(-1,3).astype(int)
            vertices.append(v);faces.append(f+offset);offset += len(v)
        return np.concatenate(vertices), np.concatenate(faces)

def smoothstep(a,b,x):
    t = np.clip((x-a)/(b-a),0,1)
    return t*t*(3-2*t)

def morph(points, settings, part_id=None):
    """Reconstruct the documented control warp without importing the mesh builder."""
    x,y,z = points.T
    knots = settings['lateralKnots']
    factor = np.full_like(y,knots[-1][1])
    factor[y < knots[0][0]] = knots[0][1]
    for (y0,s0),(y1,s1) in zip(knots,knots[1:]):
        factor = np.where((y>=y0)&(y<y1),s0+(s1-s0)*smoothstep(y0,y1,y),factor)
    radius = settings['lateralRadius']
    dx = np.sign(x)*(factor-1)*radius*np.tanh(abs(x)/radius)
    blend = settings.get('lateralBlend')
    if blend:
        knots = blend['referenceKnots']; reference = np.full_like(y, knots[-1][1])
        reference[y < knots[0][0]] = knots[0][1]
        for (y0,s0),(y1,s1) in zip(knots,knots[1:]):
            reference = np.where((y>=y0)&(y<y1),s0+(s1-s0)*smoothstep(y0,y1,y),reference)
        weight = smoothstep(blend['innerRadius'],blend['outerRadius'],abs(x))
        ramp = blend['heightRamp']
        outer = np.sign(x)*blend['outerTranslation']*smoothstep(ramp[0],ramp[1],y)*(1-smoothstep(ramp[2],ramp[3],y))
        dx = (reference-1)*radius*np.tanh(x/radius)+(1-weight)*(factor-reference)*radius*np.tanh(x/radius)+weight*outer
    waist = settings.get('waistRefinement')
    if waist:
        ramp=waist['heightRamp']
        weight=smoothstep(ramp[0],ramp[1],y)*(1-smoothstep(ramp[1],ramp[2],y))
        weight*=1-smoothstep(*waist['radialRamp'],abs(x))
        dx+=waist['delta']*radius*np.tanh(x/radius)*weight
    depth = settings['thoraxDepth']; ramp = depth['ramp']
    dz = z*(depth['scale']-1)*smoothstep(ramp[0],ramp[1],y)*(1-smoothstep(ramp[2],ramp[3],y))
    dy = np.zeros_like(y)
    glute = settings.get('gluteProjection')
    if glute and part_id in glute.get('partIds',[]):
        r2 = ((abs(x)-glute['centerX'])/glute['radiusX'])**2+((y-glute['centerY'])/glute['radiusY'])**2
        midline = smoothstep(*glute['midlineRamp'],abs(x))
        posterior = 1-smoothstep(*glute['depthRamp'],z)
        lower = glute.get('lowerDepth')
        if lower:
            low = (1-smoothstep(*lower['heightFade'],y))*(1-smoothstep(*lower['depthRamp'],z))
            if 'heightRise' in lower:low *= smoothstep(*lower['heightRise'],y)
            posterior = posterior+low-posterior*low
        dz -= glute['amplitude']*(1-smoothstep(0,1,r2))*midline*posterior
        inferior = glute.get('inferior')
        if inferior:
            ramp = inferior['heightRamp']
            weight = smoothstep(*inferior['midlineRamp'],abs(x))*(1-smoothstep(*inferior['lateralFade'],abs(x)))
            weight *= smoothstep(ramp[0],ramp[1],y)*(1-smoothstep(ramp[2],ramp[3],y))*(1-smoothstep(*inferior['depthRamp'],z))
            if 'posteriorFade' in inferior:weight *= smoothstep(*inferior['posteriorFade'],z)
            dy -= inferior['amplitude']*weight
    q = np.stack([x+dx,y+dy,z+dz],axis=1)
    nose = settings['nose']
    r2 = ((x-nose['center'][0])/nose['radius'][0])**2+((y-nose['center'][1])/nose['radius'][1])**2
    weight = (1-smoothstep(0,1,r2))*smoothstep(nose['plane']-nose['rampDepth'],nose['plane']+nose['rampDepth'],z)
    q[:,2] -= weight*(1-nose['scale'])*(z-nose['plane'])
    head = settings['head']; weight = smoothstep(*head['ramp'],y)[:,None]
    return (q-weight*(1-head['scale'])*(q-np.array(head['center'])))*settings['stature']

def stats(distances):
    return {key:round(float(value)*1000,4) for key,value in zip(('minMm','p05Mm','medianMm','p95Mm','maxMm'),np.quantile(distances,[0,.05,.5,.95,1]))}

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def run(root,reuse_root=None,reuse_audit=None):
    male = Atlas(root,'atlas.json'); female = Atlas(root,'atlas-female-reconstructed.json')
    fitpath = root/'public/models/female-fit-report.json'
    fit = json.loads(fitpath.read_text())
    warp = lambda points,part_id: morph(points,fit['morph'],part_id)
    prior = None; reused = []; recomputed = []
    if reuse_root is not None and reuse_audit is not None:
        prior = json.loads(reuse_audit.read_text())
        if (prior.get('schemaVersion'),prior.get('patchThresholdMm'),prior.get('reviewDistanceMm')) != (1,3,5):
            raise ValueError('Reuse requires current schemaVersion=1, patchThresholdMm=3 and reviewDistanceMm=5')
        old_male = Atlas(reuse_root,'atlas.json'); old_female = Atlas(reuse_root,'atlas-female-reconstructed.json')
        old_fitpath = reuse_root/'public/models/female-fit-report.json'
        expected = [(old_male.path,prior['inputs']['maleManifestSha256']),(old_female.path,prior['inputs']['femaleManifestSha256']),(old_fitpath,prior['inputs']['fitReportSha256'])]
        expected += [(reuse_root/path,value) for path,value in prior['inputs']['chunks'].items()]
        for path,value in expected:
            if sha(path) != value:raise ValueError(f'Reuse input hash mismatch: {path}')
        old_settings = json.loads(old_fitpath.read_text())['morph']
        old_warp = lambda points,part_id:morph(points,old_settings,part_id)
        prior_rows = {row['name']:row for row in prior['results']}
    def identical_mesh(first,second):
        return all(np.array_equal(a,b) for a,b in zip(first,second))
    target_cache = {}
    def target(atlas, ids, control=False):
        key = (atlas.path.name,tuple(ids),control)
        if key not in target_cache:
            target_cache[key] = Surface(*atlas.mesh(ids,warp if control else None))
        return target_cache[key]
    rows = []
    muscles = ['gluteus maximus','gluteus medius','gluteus minimus','iliacus','adductor brevis','adductor longus','adductor magnus','adductor minimus','piriformis','obturator internus','obturator externus','gemellus inferior','gemellus superior','semimembranosus','semitendinosus']
    for side, code, hip, femur in [('Right','R','FJ3152','FJ3365'),('Left','L','FJ3288','FJ3259')]:
        bones = [f'VH_F_{bone}_compact_bone_{code}' for bone in ['ilium','ischium','pubis']]
        rows.append((side+' femur / hip envelope','joint_screen',femur,[hip],bones))
        for name in muscles:
            p = next(p for p in male.parts.values() if p['name'].lower() == (side+' '+name).lower())
            control_bones, female_bones = ([hip],bones)
            if name in ['gluteus maximus','piriformis']:
                control_bones = [hip,'FJ3393']; female_bones = bones+['VH_F_sacrum','VH_F_coccyx']
            rows.append((p['name'],'muscle_screen',p['id'],control_bones,female_bones))
        p = next(p for p in male.parts.values() if p['name'].lower() == f'long head of {side.lower()} biceps femoris')
        rows.append((p['name'],'muscle_screen',p['id'],[hip],bones))
    rows += [('L5 / sacrum','joint_screen','FJ3168',['FJ3393'],['VH_F_sacrum']),('L5 disc / sacrum','joint_screen','FJ3217',['FJ3393'],['VH_F_sacrum'])]
    results = []
    for label,kind,source_id,old_ids,new_ids in rows:
        a, faces = male.mesh([source_id],warp); b, female_faces = female.mesh([source_id])
        if not np.array_equal(faces,female_faces) or a.shape != b.shape:
            raise ValueError(f'No vertex correspondence for {source_id}')
        error = float(np.max(np.linalg.norm(a-b,axis=1)))
        if error > 2e-7:
            raise ValueError(f'Control warp does not reproduce retained {source_id}: {error} m')
        prior_row = prior_rows.get(label) if prior is not None else None
        matching_ids = prior_row is not None and prior_row.get('kind')==kind and prior_row.get('sourceId')==source_id and prior_row.get('controlTargets')==old_ids and prior_row.get('femaleTargets')==new_ids
        if matching_ids:
            old_query = old_male.mesh([source_id],old_warp)
            old_current_query = old_female.mesh([source_id])
            unchanged = identical_mesh((a,faces),old_query) and identical_mesh((b,female_faces),old_current_query)
            unchanged = unchanged and identical_mesh(male.mesh(old_ids,warp),old_male.mesh(old_ids,old_warp))
            unchanged = unchanged and identical_mesh(female.mesh(new_ids),old_female.mesh(new_ids))
            if unchanged:
                results.append(prior_rows[label]);reused.append(label)
                print(label,'reused after exact query/control/target identity checks',flush=True)
                continue
        recomputed.append(label)
        old = target(male,old_ids,True).distances(a)
        new = target(female,new_ids).distances(b)
        patch = old <= .003
        minindex = int(np.argmin(new))
        nearest = target(female,new_ids).nearest(b[minindex])[1]
        results.append(dict(name=label,kind=kind,sourceId=source_id,controlTargets=old_ids,femaleTargets=new_ids,vertices=len(a),retainedWarpMaxResidualMm=error*1000,control=stats(old),female=stats(new),closestFemalePointM=b[minindex].tolist(),closestTargetPointM=nearest.tolist(),controlProximityPatch=dict(definition='All retained source vertices within 3 mm of control bone triangle surfaces; a screening region, not an annotated anatomical attachment.',count=int(patch.sum()),vertexIndices=np.flatnonzero(patch).tolist(),control=stats(old[patch]) if patch.any() else None,female=stats(new[patch]) if patch.any() else None,femaleOver5Mm=int((new[patch]>.005).sum()))))
        print(label, 'minimum mm',results[-1]['female']['minMm'],'patch',int(patch.sum()),flush=True)
    # These replacement-only screens cannot claim equivalent point correspondence.
    for label,source_ids,target_ids in [('Right ilium / sacrum',['VH_F_ilium_compact_bone_R'],['VH_F_sacrum']),('Left ilium / sacrum',['VH_F_ilium_compact_bone_L'],['VH_F_sacrum']),('Right / left pubis',['VH_F_pubis_compact_bone_R'],['VH_F_pubis_compact_bone_L'])]:
        prior_row = prior_rows.get(label) if prior is not None else None
        matching_ids = prior_row is not None and prior_row.get('kind')=='replacement_surface_screen' and prior_row.get('sourceIds')==source_ids and prior_row.get('femaleTargets')==target_ids
        if matching_ids and identical_mesh(female.mesh(source_ids),old_female.mesh(source_ids)) and identical_mesh(female.mesh(target_ids),old_female.mesh(target_ids)):
            results.append(prior_rows[label]);reused.append(label)
            print(label,'reused after exact source/target identity checks',flush=True)
            continue
        recomputed.append(label)
        a,_ = female.mesh(source_ids);surface = target(female,target_ids);distance = surface.distances(a)
        index = int(np.argmin(distance))
        results.append(dict(name=label,kind='replacement_surface_screen',sourceIds=source_ids,femaleTargets=target_ids,vertices=len(a),female=stats(distance),closestFemalePointM=a[index].tolist(),closestTargetPointM=surface.nearest(a[index])[1].tolist()))
    report = dict(schemaVersion=1,issue='SWR-513',status='Screening evidence; anatomical registration remains unvalidated',method='Exact unsigned distance from every query mesh vertex to the nearest target triangle, using an AABB hierarchy. Not vertex-to-vertex distances. Minimum is a sampled upper bound on continuous surface separation.',control='Original BodyParts3D bone and retained mesh geometry transformed with the stored female body morph. Retained vertex correspondence checked to 0.0002 mm.',patchThresholdMm=3,reviewDistanceMm=5,thresholdMeaning='Engineering screening thresholds only; not physiological cartilage, tendon or joint tolerances.',limitations=['Nearest surface is not necessarily an anatomical attachment or articular surface.','Unsigned distances do not diagnose interpenetration; intersecting or nested shells can give misleadingly small distances.','Samples are vertices and are not area-weighted; no continuous-surface Hausdorff or collision claim.','Bone meshes omit cartilage/ligament/tendon contact information; gaps may be physiological or source segmentation differences.','No manually annotated femoral-head center, acetabulum, ASIS/PSIS, sacral endplate, or muscle origin/insertion landmarks are bundled.','The male control itself is not validated; this measures changes introduced by replacement, not ground truth.'],inputs=dict(maleManifestSha256=sha(male.path),femaleManifestSha256=sha(female.path),fitReportSha256=sha(fitpath),chunks={str(atlas.root/'public'/atlas.data['chunks'][key]['url'].lstrip('/')).replace(str(root)+'/',''):hashlib.sha256(value).hexdigest() for atlas in [male,female] for key,value in atlas.buffers.items()}),results=results)
    if prior is not None:report['verifiedReuse']=dict(sourceAuditSha256=sha(reuse_audit),sourceManifestSha256=prior['inputs']['femaleManifestSha256'],method='Reused only when screen kind and source/target IDs match, and actual indexed query/control/target vertex coordinates and triangle indices are exactly equal in both source frames; prior schema, thresholds and input file hashes verified before use.',reusedScreens=reused,recomputedScreens=recomputed)
    output = root/'data/anatomy/pelvis-surface-audit.json';output.parent.mkdir(parents=True,exist_ok=True);output.write_text(json.dumps(report,indent=2)+'\n')
    return report

if __name__ == '__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--root',type=Path,default=ROOT);parser.add_argument('--reuse-root',type=Path);parser.add_argument('--reuse-audit',type=Path);args=parser.parse_args();
    if (args.reuse_root is None) != (args.reuse_audit is None):parser.error('--reuse-root and --reuse-audit must be supplied together')
    run(args.root,args.reuse_root,args.reuse_audit)
