# Female pelvis assembly: independent surface audit

[SWR-513](https://linear.app/stealth-company/issue/SWR-513) remains **In Progress**. This work adds repeatable geometric evidence and tests an isolated registration proposal. It does not certify the pelvis, change production geometry, or finish the anatomical correction.

## Reproduce

Requires Python 3 and NumPy, already used by the reconstruction builder. Run from the repository root:

```bash
python3 scripts/pelvis-surface-audit-test.py
python3 scripts/pelvis-surface-audit.py
python3 scripts/pelvis-registration-experiment.py
python3 scripts/pelvis-surface-views.py
```

Outputs are [surface measurements](../data/anatomy/pelvis-surface-audit.json), [registration experiment](../data/anatomy/pelvis-registration-experiment.json), and [assembly views](pelvis-surface-views.svg). The surface audit records manifest, fit-report, and used binary-chunk SHA-256 hashes. Regenerate after changing any mesh or transform; old measurements do not describe new geometry.

## What is measured

The 39 screens cover both femur/hip assemblies, 32 muscle/pelvis relationships, L5 and its disc against the sacrum, both ilium/sacrum assemblies, and the two pubis meshes. Every query vertex is measured against actual target **triangle surfaces** using an AABB hierarchy and exact point-to-triangle distance; this is not a comparison of bounding boxes or nearest vertices.

The control is the original male geometry transformed with the stored female body morph. For each retained femur, muscle, vertebra, and disc, the checker verifies identical triangle indices and reproduces current vertices within 0.0002 mm. This isolates the effect of replacing the bones from the shared whole-body warp, without treating the original assembly as validated ground truth.

A **control proximity patch** contains the query vertices within 3 mm of the control bones. Their indices are recorded, and those same vertices are measured against the replacement female bones. The 3 mm patch threshold and 5 mm review threshold are engineering screening values, not physiological tolerances. A proximity patch is **not** an annotated muscle origin, insertion, articular surface, or femoral-head landmark.

## Findings

These values are the 95th percentile of female distances for each *control proximity patch*, not distances across a whole muscle:

| Screen | Right p95 | Left p95 | Interpretation |
| --- | ---: | ---: | --- |
| Femur / hip envelope | 9.27 mm | 8.94 mm | A tiny overall minimum does not demonstrate congruence across the nearby femur surface. |
| Gluteus maximus / hip and sacrum | 25.10 mm | 25.15 mm | Large displacement of formerly nearby surface regions requires local review. |
| Piriformis / hip and sacrum | 13.33 mm | 13.01 mm | Whole-bone replacement has changed nearby relationships. |
| Semitendinosus / hip | 13.31 mm | 14.32 mm | Review the relevant attachment regions before teaching movement. |
| Long head of biceps femoris / hip | 14.37 mm | 15.71 mm | On the left, even the smallest sampled whole-mesh distance is 5.63 mm. |

For the L5 disc, 465 of the 619 control-patch vertices are now more than 5 mm from the female sacrum; patch p95 is 12.89 mm. Its overall minimum is only 0.018 mm. This directly illustrates why a single closest-point distance can conceal poor assembly correspondence.

The female ilium/sacrum and pubis/pubis minimum sample distances are below 0.3 mm. These minima **do not establish healthy SI joint or symphysis spacing**. The closest locations might be wrong-facing surfaces, segment boundaries, or intersections.

## A small registration proposal was tested and rejected

The separate experiment computes nearest-surface correspondence displacements on the right femur, left femur, and L5-disc control proximity patches. Each region has equal weight so the more densely sampled disc does not dominate. A translation cap of 5 mm prevents an unbounded proposal. No production asset is written.

The candidate translation is **(+0.43, −0.85, +0.38) mm** in model x/y/z. It improves 17 of 36 patch p95 values and worsens 19:

| Screen | Current p95 | Candidate p95 |
| --- | ---: | ---: |
| Right femur | 9.27 mm | 9.15 mm |
| Left femur | 8.94 mm | 9.23 mm |
| L5 disc | 12.89 mm | 12.12 mm |
| Left long-head biceps femoris | 15.71 mm | 15.98 mm |

The geometric correspondence suggestions conflict: femur patches suggest roughly 0.80–1.23 mm superior movement; the disc patch suggests 4.58 mm inferior movement. A single translation cannot follow both suggestions. The experiment uses unannotated nearest points and does not justify rotating, deforming, or reattaching anatomy. **The candidate is rejected for production.** Even uniformly better scores would not establish anatomical accuracy.

## Effect of the silhouette adjustment

These current tables and views describe the published [isolated waist refinement](female-waist-slimmer-review.md), which retains the preceding rounded glute contour. The control applies the stored universal body field and the explicit posterior/inferior source-ID allowlist; bone controls do not receive the optional glute components. All retained query vertices still reproduce the published meshes within 0.0002 mm.

A separate [comparison using identical original patch vertex indices](../data/anatomy/female-proportion-pelvis-comparison.json) avoids confusing changed threshold membership with an actual proximity change. Relative to the original pre-proportion baseline, all 36 matched patch p95 distances remain slightly larger, by **0.0001–0.3262 mm**. The largest increase is right gemellus superior, 9.918 → 10.244 mm; left adductor magnus increases 0.289 mm and left semitendinosus 0.261 mm. L5 disc increases only 0.005 mm, and gluteus maximus is almost unchanged on its fixed proximity patch.

Reducing the previous lateral hip flare reduces the maximum accumulated gap worsening from 0.759 to 0.326 mm. The [preceding waist-stage comparison](../data/anatomy/female-waist-pelvis-comparison.json) is preserved. This does not establish correct attachment registration: the large underlying cross-source gaps remain. The rounded contour redistributes depth and lowers selected inferior glute vertices by up to 16.77 mm, while all coordinates and normals outside the four glute muscle/vein IDs remain identical to the preceding scoped model. The latest waist pass preserves the checked glute geometry exactly. Its fixed-patch p95 measurements do not change from the preceding contour revision at the report’s 0.0001 mm precision. Gluteus-maximus patch p95 values remain 25.0972/25.1516 mm; a nearly unchanged patch p95 is not proof that the whole reshaped muscle is anatomically valid.

The current report is pinned to published manifest `9b6f0fc90c80e4cd50a7ec65fa9d43ddeb0d6e5d79b6d1b9a78105443610730b`. It recomputed **37 screens** and reused only the unchanged L5-disc/sacrum and right/left-pubis screens after verifying prior manifest/fit/chunk hashes, matching screen kind and source/target IDs, and exact indexed query, control, and target vertex/triangle identity. The [prior rounded-contour audit](../data/anatomy/pelvis-surface-audit-glute-rounded.json) is preserved, and the current report records its hash and the reused/recomputed names. Reuse requires schema 1 and the same 3/5 mm thresholds. A normal run without reuse options still computes all screens from scratch.

The current audit recomputes its 3 mm source-proximity patches for changed geometry under the applicable field, so their counts can differ from the preserved baseline. Use the fixed-index comparison when attributing a change to the shape passes. These discrepancies remain part of SWR-513.

## Evidence required before changing registration

No reviewed anatomical surface annotations or attachment coordinates were found in the bundled manifests or fit report. The next correction needs annotations in both source frames, preserving their provenance and triangle/barycentric locations:

1. Bilateral femoral-head articular surface regions and corresponding acetabular surface/rim regions, with an independently reviewed definition of the fitted center and orientation. Record fit residuals and excluded neck/trochanter vertices; do not substitute femur bounding-box corners or whole-hip closest points.
2. Sacral superior and L5/disc opposing surface regions, distinguished from posterior processes. Review their relative orientation and spacing together with both hips.
3. Opposing SI joint and symphysis surface regions, distinguished from neighboring bone segmentation boundaries. Account for the connective structures represented or omitted in the source.
4. Source-supported attachment regions for gluteals, iliacus, adductors, hamstrings, and deep rotators, including the femoral insertions and any tendon/ligament mediation. Whole-muscle proximity to an entire hip bone is insufficient.
5. A reviewed target subject/reference build and correspondence between donors. Use those constraints to compare rigid registration, local adjustments, attachment relocation, and body proportion effects; retain any rejected candidate results.

This follows the distinction in [OpenSim's scaling documentation](https://opensimconfluence.atlassian.net/wiki/spaces/OpenSim/pages/53089158/How%2BScaling%2BWorks): anatomical marker correspondence, joint frames, muscle attachment positions, and wrapping geometry are explicit parts of scaling. Our meshes currently provide no equivalent validated annotation or kinematic model.

## Visual and numerical limits

![Current pelvis assembly in anterior, lateral, and transverse section views](pelvis-surface-views.svg)

The SVG is generated directly from current indexed triangles. The transverse section uses exact triangle intersections with the numerical plane y = 0.860 m. That plane is not labeled as a clinical/anatomical landmark. Femora are cropped for the assembly view. Colors only distinguish structures.

Distances are unsigned: they cannot diagnose penetration, and intersecting or nested surfaces can still yield small values. Source vertices are not uniform area samples; minimum sample distance is an upper bound on continuous surface separation. This is not a collision test, continuous Hausdorff measurement, cartilage-gap assessment, or physiological validation. The five analytic tests verify triangle interiors, edge/vertex cases, degeneracy, hierarchy agreement with an exhaustive oracle, and the limitation of unsigned samples across an intersection.

The bone sources are BodyParts3D/DBCLS and HRA/Visible Human female. Their source attribution and licenses remain in [ATTRIBUTION](../public/ATTRIBUTION.md). [NIH's HRA female pelvis record](https://3d.nih.gov/entries/3DPX-020984) documents the Visible Human origin; it does not validate this project's cross-source registration.
