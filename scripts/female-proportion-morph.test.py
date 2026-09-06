#!/usr/bin/env python3
"""Check the localized shared field without executing the asset builder."""
import ast
import copy
import importlib.util
from pathlib import Path
import unittest
import numpy as np
root=Path(__file__).resolve().parents[1]
tree=ast.parse((root/'scripts/build-female-reconstruction.py').read_text())
nodes=[node for node in tree.body if (isinstance(node,ast.FunctionDef) and node.name in ['smoothstep','lateral_factor','morph']) or (isinstance(node,ast.Assign) and any(isinstance(target,ast.Name) and target.id=='MORPH' for target in node.targets))]
namespace={'np':np};exec(compile(ast.Module(body=nodes,type_ignores=[]),'isolated-builder-morph','exec'),namespace)
spec=importlib.util.spec_from_file_location('audit',root/'scripts/pelvis-surface-audit.py');audit=importlib.util.module_from_spec(spec);spec.loader.exec_module(audit)

class ProportionMorphTests(unittest.TestCase):
    def test_independent_python_formula_matches_builder(self):
        rng=np.random.default_rng(517);points=rng.uniform([-.4,0,-.15],[.4,1.75,.15],(3000,3))
        for part_id in [None,'FJ1418','FJ3513','VH_F_broad_ligament','FJ3152','unknown']:
            np.testing.assert_allclose(audit.morph(points,namespace['MORPH'],part_id),namespace['morph'](points,part_id),atol=1e-12)
    def test_outer_arm_field_is_rigid_translation_from_reference(self):
        current=namespace['MORPH'];reference=copy.deepcopy(current);reference['lateralKnots']=reference.pop('lateralBlend')['referenceKnots']
        for sign in [-1,1]:
            points=np.array([[sign*.25,.65,.02],[sign*.31,1.05,-.02],[sign*.27,1.4,.04]])
            delta=audit.morph(points,current)-audit.morph(points,reference)
            np.testing.assert_allclose(delta,np.tile([sign*current['lateralBlend']['outerTranslation']*current['stature'],0,0],(3,1)),atol=1e-12)
    def test_lateral_field_does_not_change_vertical_or_depth_coordinates(self):
        settings=namespace['MORPH'];reference=copy.deepcopy(settings);reference['lateralKnots']=reference.pop('lateralBlend')['referenceKnots']
        rng=np.random.default_rng(513);points=rng.uniform([-.4,0,-.15],[.4,1.75,.15],(1000,3))
        np.testing.assert_array_equal(audit.morph(points,settings)[:,1:],audit.morph(points,reference)[:,1:])
    def test_finite_positive_jacobian_across_blend_boundaries(self):
        settings=namespace['MORPH'];radii=[.16999,.17,.17001,.185,.2,.215,.22999,.23,.23001]
        points=np.array([[side*x,y,z] for side in [-1,1] for x in radii for y in [.54,.55,.8,.92,1.03,1.08,1.12,1.29,1.42,1.48] for z in [-.04,.04]])
        h=1e-6;matrix=np.empty((len(points),3,3))
        for axis in range(3):
            offset=np.eye(3)[axis]*h;matrix[:,:,axis]=(audit.morph(points+offset,settings)-audit.morph(points-offset,settings))/(2*h)
        determinant=np.linalg.det(matrix)
        self.assertTrue(np.isfinite(matrix).all())
        self.assertGreater(float(determinant.min()),.05)
    def test_posterior_projection_is_symmetric_and_excludes_midline_and_anterior(self):
        settings=copy.deepcopy(namespace['MORPH']);settings['gluteProjection'].pop('inferior',None);reference=copy.deepcopy(settings);reference.pop('gluteProjection')
        points=np.array([[.07,.880,-.121],[-.07,.880,-.121],[0,.880,-.121],[.07,.880,-.050],[.07,1.07,-.121],[.19,.880,-.121]])
        delta=audit.morph(points,settings,'FJ1418')-audit.morph(points,reference,'FJ1418')
        np.testing.assert_array_equal(delta[:,:2],np.zeros((6,2)))
        np.testing.assert_allclose(delta[:2,2],[-.019,-.019],atol=1e-12)
        np.testing.assert_array_equal(delta[2:,2],np.zeros(4))
    def test_glute_gate_boundary_jacobians_are_finite_positive(self):
        settings=namespace['MORPH']
        points=np.array([[side*x,y,z] for side in [-1,1] for x in [.005999,.006,.006001,.019999,.020,.020001,.029999,.03,.030001,.04,.049999,.05,.050001,.064999,.065,.065001,.07,.104999,.105,.105001,.169999,.17,.170001] for y in [.759999,.76,.760001,.779999,.780,.780001,.859999,.860,.860001,.799999,.80,.800001,.829999,.830,.830001,.839999,.840,.840001,.884999,.885,.885001,.894999,.895,.895001,1.059999,1.06,1.060001] for z in [-.120001,-.120,-.119999,-.100001,-.100,-.099999,-.095001,-.095,-.094999,-.090001,-.090,-.089999,-.075001,-.075,-.074999,-.060001,-.060,-.059999]])
        matrix=np.empty((len(points),3,3));h=1e-7
        for axis in range(3):
            offset=np.eye(3)[axis]*h;matrix[:,:,axis]=(audit.morph(points+offset,settings,'FJ1418')-audit.morph(points-offset,settings,'FJ1418'))/(2*h)
        self.assertTrue(np.isfinite(matrix).all());self.assertGreater(float(np.linalg.det(matrix).min()),.05)
    def test_only_explicit_glute_ids_receive_posterior_field(self):
        settings=namespace['MORPH'];reference=copy.deepcopy(settings);reference.pop('gluteProjection')
        point=np.array([[.07,.880,-.121]])
        for part_id in [None,'unknown','VH_F_broad_ligament','VH_F_sacrum','FJ3259','FJ1527']:
            np.testing.assert_array_equal(audit.morph(point,settings,part_id),audit.morph(point,reference,part_id))
        for part_id in settings['gluteProjection']['partIds']:
            self.assertAlmostEqual(float((audit.morph(point,settings,part_id)-audit.morph(point,reference,part_id))[0,2]),-.019)
    def test_inferior_contour_is_localized_to_posterior_glute(self):
        settings=namespace['MORPH'];reference=copy.deepcopy(settings);reference['gluteProjection'].pop('inferior')
        points=np.array([[.04,.83,-.10],[.12,.83,-.10],[.04,.90,-.10],[.04,.83,-.05]])
        delta=audit.morph(points,settings,'FJ1418')-audit.morph(points,reference,'FJ1418')
        self.assertAlmostEqual(delta[0,1],-.022*settings['stature']*float(audit.smoothstep(-.120,-.075,-.10)))
        np.testing.assert_array_equal(delta[1:],np.zeros((3,3)))
        np.testing.assert_array_equal(delta[:,[0,2]],np.zeros((4,2)))
    def test_lower_depth_support_tapers_out_at_inferior_edge(self):
        settings=namespace['MORPH'];reference=copy.deepcopy(settings);reference['gluteProjection'].pop('lowerDepth')
        points=np.array([[.06,.779,-.085],[.06,.820,-.085]])
        delta=audit.morph(points,settings,'FJ1418')-audit.morph(points,reference,'FJ1418')
        np.testing.assert_array_equal(delta[0],np.zeros(3))
        self.assertLess(delta[1,2],0)
    def test_inferior_drop_preserves_far_posterior_surface_height(self):
        settings=namespace['MORPH'];reference=copy.deepcopy(settings);reference['gluteProjection'].pop('inferior')
        points=np.array([[.04,.83,-.121],[.04,.83,-.082]])
        delta=audit.morph(points,settings,'FJ1418')-audit.morph(points,reference,'FJ1418')
        np.testing.assert_array_equal(delta[0],np.zeros(3))
        self.assertLess(delta[1,1],0)
    def test_isolated_waist_has_compact_height_and_radius_support(self):
        settings=namespace['MORPH'];reference=copy.deepcopy(settings);reference.pop('waistRefinement')
        points=np.array([[.18,1.12,0],[.17,1.12,0],[.14,1.03,0],[.14,1.21,0],[.10,1.12,0],[-.10,1.12,0]])
        delta=audit.morph(points,settings)-audit.morph(points,reference)
        np.testing.assert_array_equal(delta[:4],np.zeros((4,3)))
        np.testing.assert_array_equal(delta[:,1:],np.zeros((6,2)))
        self.assertLess(delta[4,0],0);self.assertAlmostEqual(delta[4,0],-delta[5,0])
    def test_isolated_waist_boundary_jacobians_are_positive(self):
        settings=namespace['MORPH'];points=np.array([[sign*x,y,z] for sign in [-1,1] for x in [.139999,.14,.140001,.155,.169999,.17,.170001] for y in [1.029999,1.03,1.030001,1.119999,1.12,1.120001,1.209999,1.21,1.210001] for z in [-.10,0,.10]])
        matrix=np.empty((len(points),3,3));h=1e-7
        for axis in range(3):
            offset=np.eye(3)[axis]*h;matrix[:,:,axis]=(audit.morph(points+offset,settings)-audit.morph(points-offset,settings))/(2*h)
        self.assertTrue(np.isfinite(matrix).all());self.assertGreater(float(np.linalg.det(matrix).min()),.05)
    def test_legacy_morph_remains_supported(self):
        settings=copy.deepcopy(namespace['MORPH']);settings['lateralKnots']=settings.pop('lateralBlend')['referenceKnots'];settings.pop('gluteProjection',None);settings.pop('waistRefinement',None)
        points=np.array([[0.,0.,0.],[.3,1.,0.],[-.3,1.,0.]])
        actual=audit.morph(points,settings);self.assertTrue(np.isfinite(actual).all());self.assertAlmostEqual(actual[1,0],-actual[2,0])

if __name__=='__main__':unittest.main()
