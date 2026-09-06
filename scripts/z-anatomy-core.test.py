"""Numerical registration tests independent of source model naming."""
import importlib.util,unittest
from pathlib import Path
import numpy as np
spec=importlib.util.spec_from_file_location('registration',Path(__file__).with_name('register-z-anatomy-core.py'))
registration=importlib.util.module_from_spec(spec);spec.loader.exec_module(registration)

class RegistrationTests(unittest.TestCase):
    def test_recovers_known_rigid_transform(self):
        source=np.array([[0,0,0],[1,0,0],[0,2,0],[0,0,3],[2,3,4]],dtype=float)
        angle=.37
        wanted=np.array([[np.cos(angle),-np.sin(angle),0],[np.sin(angle),np.cos(angle),0],[0,0,1]])
        offset=np.array([.3,-.2,.05]);target=source@wanted.T+offset
        actual,translation=registration.rigid(source,target)
        np.testing.assert_allclose(actual,wanted,atol=1e-12)
        np.testing.assert_allclose(translation,offset,atol=1e-12)
    def test_reflection_is_not_accepted_as_rotation(self):
        source=np.array([[0,0,0],[1,0,0],[0,2,0],[0,0,3]],dtype=float)
        target=source*np.array([-1,1,1]);rotation,_=registration.rigid(source,target)
        self.assertAlmostEqual(np.linalg.det(rotation),1)
    def test_nearest_preserves_correspondence_and_distances(self):
        source=np.array([[0,0,0],[9,0,0]],dtype=float)
        target=np.array([[10,0,0],[-2,0,0],[4,0,0]],dtype=float)
        selected,distance=registration.nearest(source,target)
        np.testing.assert_array_equal(selected,[[-2,0,0],[10,0,0]])
        np.testing.assert_array_equal(distance,[2,1])

if __name__=='__main__':unittest.main()
