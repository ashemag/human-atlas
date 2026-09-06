"""Check part-ID propagation across validator, normal and audit integration seams."""
import ast
import importlib.util
import json
from pathlib import Path
import subprocess
import tempfile
import unittest

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
tree = ast.parse((ROOT / 'scripts/build-female-reconstruction.py').read_text())
names = {'smoothstep', 'lateral_factor', 'morph', 'morph_normals'}
nodes = [node for node in tree.body if (
    isinstance(node, ast.FunctionDef) and node.name in names
) or (
    isinstance(node, ast.Assign)
    and any(isinstance(target, ast.Name) and target.id == 'MORPH' for target in node.targets)
)]
builder = {'np': np}
exec(compile(ast.Module(body=nodes, type_ignores=[]), 'isolated-morph', 'exec'), builder)
spec = importlib.util.spec_from_file_location('audit', ROOT / 'scripts/pelvis-surface-audit.py')
audit = importlib.util.module_from_spec(spec)
spec.loader.exec_module(audit)


class MorphIntegrationTests(unittest.TestCase):
    def test_javascript_validator_matches_builder_for_mixed_part_ids(self):
        points = np.random.default_rng(519).uniform([-.2, .75, -.15], [.2, 1.24, -.04], (160, 3))
        ids = builder['MORPH']['gluteProjection']['partIds'] + [None, 'unknown', 'VH_F_broad_ligament', 'VH_F_sacrum']
        cases = [(point.tolist(), part_id) for point in points for part_id in ids]
        # Run the actual validator expression without running the asset CLI.
        code = """
const fs = require('node:fs');
const input = JSON.parse(fs.readFileSync(0, 'utf8'));
const source = fs.readFileSync('scripts/validate-atlas.mjs', 'utf8');
const expression = source.slice(source.indexOf(' const smoothstep='), source.indexOf(' const drapeShift='));
const apply = new Function('morph', expression + ';return apply;')(input.settings);
process.stdout.write(JSON.stringify(input.cases.map(([point, id]) => apply(...point, id))));
"""
        result = subprocess.run(['node', '-e', code], cwd=ROOT, input=json.dumps(dict(settings=builder['MORPH'], cases=cases)), text=True, capture_output=True, check=True)
        expected = np.array([builder['morph'](np.array([point]), part_id)[0] for point, part_id in cases])
        np.testing.assert_allclose(np.array(json.loads(result.stdout)), expected, atol=1e-12, rtol=0)

    def test_normals_follow_the_same_scoped_surface_as_positions(self):
        points = np.array([[.06, .88, -.12], [.08, .92, -.108], [.05, .79, -.075]] + [[.05, .82, z] for z in [-.120001, -.12, -.119999, -.0975, -.075001, -.075, -.074999]])
        # Test both posterior and inferior-facing planes. The second plane detects
        # errors in the dy/dz coupling introduced by the posterior fade.
        for normal, axes in [([0., 0., 1.], [0, 1]), ([0., 1., 0.], [2, 0])]:
            normals = np.tile(normal, (len(points), 1))
            for part_id in ['FJ1418', 'unknown', 'VH_F_sacrum']:
                actual = builder['morph_normals'](points, normals, part_id, h=1e-7)
                tangents = []
                for axis in axes:
                    offset = np.eye(3)[axis] * 1e-7
                    tangents.append((builder['morph'](points + offset, part_id) - builder['morph'](points - offset, part_id)) / 2e-7)
                expected = np.cross(*tangents)
                expected /= np.linalg.norm(expected, axis=1, keepdims=True)
                np.testing.assert_allclose(actual, expected, atol=2e-5, rtol=0)
            self.assertGreater(float(np.linalg.norm(builder['morph_normals'](points, normals, 'FJ1418') - builder['morph_normals'](points, normals, 'unknown'))), .01)

    def test_combined_audit_mesh_passes_each_source_id_to_control_warp(self):
        # Identical positions belong to two different structures. Only the eligible
        # structure may move posteriorly and inferiorly, even when loaded together.
        points = np.array([[.05, .82, -.09], [.051, .82, -.09], [.05, .821, -.09]], dtype='<f4')
        indices = np.array([0, 1, 2], dtype='<u4')
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            models = root / 'public/models'
            models.mkdir(parents=True)
            (models / 'mesh.bin').write_bytes(points.tobytes() + indices.tobytes())
            parts = [dict(id=part_id, chunk=0, positions=0, vertexCount=3, indices=points.nbytes, indexCount=3) for part_id in ['FJ1418', 'VH_F_sacrum']]
            (models / 'atlas.json').write_text(json.dumps(dict(parts=parts, chunks=[dict(url='/models/mesh.bin')])))
            atlas = audit.Atlas(root, 'atlas.json')
            actual, faces = atlas.mesh([p['id'] for p in parts], lambda vertices, part_id: audit.morph(vertices, builder['MORPH'], part_id))
            self.assertTrue(np.all(actual[:3, 1:] < actual[3:, 1:]))
            self.assertGreater(float(actual[3, 1] - actual[0, 1]), .001)
            self.assertGreater(float(actual[3, 2] - actual[0, 2]), .001)
            np.testing.assert_array_equal(actual[:3, 0], actual[3:, 0])
            np.testing.assert_allclose(actual[:3], builder['morph'](points.astype(float), 'FJ1418'), atol=1e-12, rtol=0)
            np.testing.assert_allclose(actual[3:], builder['morph'](points.astype(float)), atol=1e-12, rtol=0)
            np.testing.assert_array_equal(faces, [[0, 1, 2], [3, 4, 5]])


if __name__ == '__main__':
    unittest.main()
