#!/usr/bin/env python3
import importlib.util
from pathlib import Path
import unittest
import numpy as np
spec=importlib.util.spec_from_file_location('audit',Path(__file__).with_name('pelvis-surface-audit.py'))
audit=importlib.util.module_from_spec(spec);spec.loader.exec_module(audit)

class SurfaceTests(unittest.TestCase):
    def test_nearest_is_triangle_interior_not_nearest_vertex(self):
        surface=audit.Surface(np.array([[0.,0,0],[4.,0,0],[0.,4,0]]),np.array([[0,1,2]]))
        distance,point=surface.nearest(np.array([1.,1.,2.]))
        self.assertAlmostEqual(distance,2.)
        np.testing.assert_allclose(point,[1,1,0])
    def test_edge_and_vertex_regions(self):
        surface=audit.Surface(np.array([[0.,0,0],[1.,0,0],[0.,1,0]]),np.array([[0,1,2]]))
        for query,expected in [([1.,1.,0.],[.5,.5,0.]),([-1.,-1.,0.],[0,0,0])]:
            _,point=surface.nearest(np.array(query));np.testing.assert_allclose(point,expected)
    def test_degenerate_triangle(self):
        points,dist=audit.closest_on_triangles(np.array([1.,2,0]),np.array([[[0.,0,0],[2.,0,0],[2.,0,0]]]))
        np.testing.assert_allclose(points,[[1,0,0]]);self.assertAlmostEqual(dist[0],4.)
    def test_hierarchy_matches_exhaustive_oracle(self):
        rng=np.random.default_rng(1234);vertices=rng.normal(size=(180,3));faces=np.arange(180).reshape(-1,3)
        surface=audit.Surface(vertices,faces)
        for point in rng.normal(size=(20,3)):
            _,squared=audit.closest_on_triangles(point,vertices[faces])
            self.assertAlmostEqual(surface.nearest(point)[0],np.sqrt(squared.min()),places=12)
    def test_unsigned_intersection_is_not_collision_proof(self):
        # Two separated vertex samples can miss a crossing between samples.
        surface=audit.Surface(np.array([[-1.,-1,0],[1.,-1,0],[0.,1,0]]),np.array([[0,1,2]]))
        self.assertTrue(np.all(surface.distances(np.array([[0.,0,-1],[0.,0,1]])) == 1))

if __name__=='__main__':unittest.main()
