"""Analytic tests; run with the same Blender command as the containment audit."""
import importlib.util
from pathlib import Path
import unittest
import numpy as np
spec=importlib.util.spec_from_file_location('breast',Path(__file__).with_name('breast-containment-audit.py'))
breast=importlib.util.module_from_spec(spec);spec.loader.exec_module(breast)

class ContainmentTests(unittest.TestCase):
    def setUp(self):
        self.vertices=np.array([[-1.,-1,-1],[1.,-1,-1],[1.,1,-1],[-1.,1,-1],[-1.,-1,1],[1.,-1,1],[1.,1,1],[-1.,1,1]])
        self.faces=np.array([[0,2,1],[0,3,2],[4,5,6],[4,6,7],[0,1,5],[0,5,4],[1,2,6],[1,6,5],[2,3,7],[2,7,6],[3,0,4],[3,4,7]])
        self.envelope=breast.Envelope(self.vertices,self.faces)
    def test_inside_outside_boundary(self):
        self.assertTrue(self.envelope.valid)
        self.assertEqual(self.envelope.classify(np.array([.11,.13,.17]))[0],'inside')
        kind,distance,point,_=self.envelope.classify(np.array([2.,.2,.3]));self.assertEqual(kind,'outside');self.assertAlmostEqual(distance,1.)
        np.testing.assert_allclose(point,[1,.2,.3],atol=1e-6)
        self.assertEqual(self.envelope.classify(np.array([1.0001,.2,.3]))[0],'boundary')
    def test_vertex_ray_is_ambiguous(self):
        self.assertIsNone(self.envelope.ray_parity(np.zeros(3),np.array([1.,1,1])/np.sqrt(3)))
    def test_shared_edge_ray_is_ambiguous(self):
        self.assertIsNone(self.envelope.ray_parity(np.zeros(3),np.array([1.,1,0])/np.sqrt(2)))
    def test_missing_face_does_not_certify_inside(self):
        envelope=breast.Envelope(self.vertices,self.faces[:-1]);self.assertFalse(envelope.valid)
        self.assertEqual(envelope.classify(np.array([.11,.13,.17]))[0],'uncertain')
    def test_inconsistent_orientation_is_invalid(self):
        faces=self.faces.copy();faces[0]=faces[0,::-1]
        self.assertFalse(breast.Envelope(self.vertices,faces).valid)
    def test_ray_disagreement_is_uncertain(self):
        values=iter([1,1,0,1,1]);self.envelope.ray_parity=lambda *_:next(values)
        self.assertEqual(self.envelope.classify(np.array([.11,.13,.17]))[0],'uncertain')
    def test_too_few_reliable_rays_is_uncertain(self):
        values=iter([1,1,None,None,None]);self.envelope.ray_parity=lambda *_:next(values)
        self.assertEqual(self.envelope.classify(np.array([.11,.13,.17]))[0],'uncertain')
    def test_inset_change_matches_shared_morph(self):
        import json
        settings=json.loads((Path(__file__).resolve().parents[1]/'public/models/female-fit-report.json').read_text())['morph']
        original=np.array([[.1,1.27,.05],[-.1,1.17,.06],[.08,1.36,.07]])
        current=breast.audit.morph(original,settings)
        changed=original.copy();changed[:,2]+=.005
        np.testing.assert_allclose(breast.shifted_inset(current,settings,.005),breast.audit.morph(changed,settings),atol=1e-12)
        with self.assertRaises(ValueError):breast.shifted_inset(np.array([[0.,1.6,0.]]),settings,.005)
    def test_summary_keeps_boundary_separate(self):
        # Boundary uncertainty must not be counted as an internal or protruding sample.
        result,_,_=self.envelope.samples(np.array([[2.,.2,.3],[.11,.13,.17],[1.,.2,.3]]))
        self.assertEqual(result['counts'],dict(inside=1,outside=1,boundary=1,uncertain=0))

if __name__=='__main__':
    result=unittest.TextTestRunner().run(unittest.defaultTestLoader.loadTestsFromTestCase(ContainmentTests))
    if not result.wasSuccessful():raise RuntimeError('Containment tests failed')
