"""Export a pinned, reviewed object allowlist without running embedded Blender scripts.

blender -b --factory-startup --disable-autoexec source.blend \
  --python scripts/extract-z-anatomy-core.py -- --out data/anatomy/z-anatomy

This is a source-coordinate research supplement, NOT a fitted/validated atlas.
Only explicit core-muscle and skeletal registration objects are exported.
"""
import argparse, hashlib, json, sys
from pathlib import Path
import bpy
import numpy as np

PIN = '0752b0e5c71f8a553115d797a5d321f7a77f8d82'
BLEND_SHA256 = '9f08a17ea0115fed80b2a73ecdf0a1bc2ab2f6956f37c593ce23d513ea35afcd'
TARGETS = {
    'Rectus abdominis muscle': 'rectus_abdominis',
    'Internal abdominal oblique muscle': 'internal_oblique',
    'Transversus abdominis muscle': 'transversus_abdominis',
    'Quadratus lumborum muscle': 'quadratus_lumborum',
    'Multifidus colli muscle': 'multifidus_cervical',
    'Multifidus thoracis muscle': 'multifidus_thoracic',
    'Multifidus lumborum muscle': 'multifidus_lumbar',
}
ANCHORS = {
    'Vertebra L1': 'FJ3157', 'Vertebra L2': 'FJ3159',
    'Vertebra L3': 'FJ3162', 'Vertebra L4': 'FJ3165', 'Vertebra L5': 'FJ3168',
    'Eleventh rib.l': 'FJ3226', 'Twelfth rib.l': 'FJ3227', 'First rib.l': 'FJ3228',
    'Eleventh rib.r': 'FJ3331', 'Twelfth rib.r': 'FJ3332', 'First rib.r': 'FJ3334',
    'Hip bone.l': 'FJ3288', 'Hip bone.r': 'FJ3152',
    'Femur.l': 'FJ3259', 'Femur.r': 'FJ3365',
    'Scapula.l': 'FJ3279', 'Scapula.r': 'FJ3384',
}

def export_object(name):
    obj = bpy.data.objects.get(name)
    if obj is None or obj.type != 'MESH':
        raise ValueError(f'Missing source mesh: {name}')
    if any(m.show_viewport for m in obj.modifiers):
        raise ValueError(f'Unreviewed active modifier: {name}')
    mesh = obj.data
    mesh.calc_loop_triangles()
    positions = np.array([v.co[:] for v in mesh.vertices], dtype=np.float64)
    normals = np.array([v.normal[:] for v in mesh.vertices], dtype=np.float64)
    matrix = np.array([list(row) for row in obj.matrix_world], dtype=np.float64)
    positions = positions @ matrix[:3, :3].T + matrix[:3, 3]
    normals = normals @ np.linalg.inv(matrix[:3, :3])
    normals /= np.linalg.norm(normals, axis=1)[:, None]
    triangles = np.array([t.vertices[:] for t in mesh.loop_triangles], dtype='<u4')
    # Negative object scales mirror many left meshes; maintain outward winding.
    if np.linalg.det(matrix[:3, :3]) < 0:
        triangles = triangles[:, [0, 2, 1]]
    if not (np.isfinite(positions).all() and np.isfinite(normals).all()):
        raise ValueError(f'Non-finite geometry: {name}')
    return positions.astype('<f4'), normals.astype('<f4'), triangles, matrix

def main():
    args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    parser = argparse.ArgumentParser(); parser.add_argument('--out', type=Path, required=True)
    out = parser.parse_args(args).out; out.mkdir(parents=True, exist_ok=True)
    source = Path(bpy.data.filepath)
    if hashlib.sha256(source.read_bytes()).hexdigest() != BLEND_SHA256:
        raise ValueError('Source hash differs from reviewed Blender source')
    if bpy.context.preferences.filepaths.use_scripts_auto_execute:
        raise ValueError('Embedded script execution must be disabled')
    requested = [(name + '.' + side, 'ZA_' + key + '_' + side, 'core', None)
                 for name, key in TARGETS.items() for side in ('l', 'r')]
    requested += [(name, source_id, 'registration', source_id) for name, source_id in ANCHORS.items()]
    blob = bytearray(); records = []
    for name, mesh_id, role, atlas_id in requested:
        p, n, t, matrix = export_object(name)
        record = dict(id=mesh_id, name=name, role=role, atlasId=atlas_id,
                      vertexCount=len(p), indexCount=t.size, objectMatrix=matrix.tolist(),
                      bounds=[p.min(axis=0).tolist(), p.max(axis=0).tolist()])
        for field, values in [('positions', p), ('normals', n), ('indices', t)]:
            record[field] = len(blob); blob.extend(values.tobytes())
        records.append(record)
    binary = out / 'core-source.bin'; binary.write_bytes(blob)
    manifest = dict(source='Z-Anatomy', commit=PIN, sourceBlendSha256=BLEND_SHA256,
                    license='CC-BY-SA-4.0', coordinateSystem='meters, Z-up, Blender world',
                    normalType='float32', indexType='uint32', binary=binary.name,
                    binarySha256=hashlib.sha256(blob).hexdigest(), bytes=len(blob), parts=records,
                    status='Source meshes extracted; registration and anatomy review required')
    (out / 'core-source.json').write_text(json.dumps(manifest, indent=2) + '\n')
    print(json.dumps(dict(coreMeshes=sum(p['role']=='core' for p in records),
                          registrationMeshes=len(ANCHORS), bytes=len(blob))))

if __name__ == '__main__': main()
