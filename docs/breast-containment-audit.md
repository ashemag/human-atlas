# Breast assembly: containment audit and partial inset correction

[SWR-516](https://linear.app/stealth-company/issue/SWR-516) remains **In Progress**. A geometric placement defect has been partially corrected: the six internal lobe, main duct, and sinus meshes used an extra **−8 mm** posterior inset before the shared body morph. They now use **−3 mm**. During that inset correction, source vertex counts and triangle indices were unchanged; nipple/areola, suspensory supports, and regenerated outer envelopes were unchanged. A later shared proportion revision reshaped the assembly along with the body; its current audit is distinguished below.

This is an improvement to an estimated assembly, not a completed or anatomically validated breast model. The current proportion revision has **3,806 confidently outside internal vertices and 7,745 outside triangle centroids**, so further registration work is required. The historical post-inset correction measured 3,805 and 7,748 respectively; those preserved results have not been overwritten.

## Interpretation and measurements

The regenerated `VH_F_fat_L/R` meshes serve as the **outer illustrative breast envelope** in this viewer. They are not occupied-volume segmentations of interlobar adipose tissue. Screening whether glands and ducts lie inside that outer presentation envelope does **not** imply that glands should be histologically contained inside adipose tissue.

The audit measures every internal vertex and every triangle centroid against actual envelope triangles using Blender's BVH:

- Nearest-triangle distances identify a 0.2 mm boundary uncertainty band.
- Five oblique ray directions classify interior/exterior. At least three non-ambiguous rays must agree; edge/vertex hits, nearly tangential hits, insufficient votes, and disagreements are uncertain.
- Envelope boundary edges, non-manifold edges, inconsistent winding, and degenerate triangles are checked. Invalid topology prevents confident containment classification.
- Suspensory supports are excluded because they connect beyond the envelope toward the chest. External nipple, areola, and areolar tubercle structures are excluded from the internal-tissue test.

Closed, consistently oriented topology alone does not prove an envelope has no self-intersections. Vertex/centroid samples do not guarantee containment of every triangle interior or volume. Thresholds are engineering tolerances, not clinical criteria. Duct endpoints also require anatomical interface review.

## Historical −8 mm to −3 mm inset correction

All 9,402 confidently outside baseline vertices were nearest the verified **back cap** of the procedural envelope; none were nearest the front or rim. Some lobe samples were more than 10 mm behind that envelope surface. This localized the defect to posterior placement rather than an exposed breast contour problem.

| Internal structure | Baseline outside vertices | Post-inset outside vertices | Baseline outside centroids | Post-inset outside centroids |
| --- | ---: | ---: | ---: | ---: |
| Left lobes | 4,244 | 2,022 | 8,730 | 4,139 |
| Left main ducts | 488 | 79 | 940 | 156 |
| Left sinuses | 0 | 0 | 0 | 0 |
| Right lobes | 4,200 | 1,638 | 8,579 | 3,333 |
| Right main ducts | 470 | 66 | 936 | 120 |
| Right sinuses | 0 | 0 | 0 | 0 |
| **Total** | **9,402** | **3,805** | **19,185** | **7,748** |

This reduces confidently outside vertex and centroid counts by about **60%**. Both sinus meshes had every post-inset vertex and centroid confidently inside the envelope. Remaining outside samples in the offline candidate were all nearest the back cap; there were no new front or rim exits.

The historical inset-correction production candidate was compared against **all 2,243 parts**. Exactly the six approved internal meshes changed position, all triangle indices are identical, every other part's positions are exactly unchanged, and the whole-body morph is unchanged. The largest position difference from the offline candidate is **0.00000626 mm**. One left-lobe vertex that was outside in the offline calculation becomes ray-uncertain after float32 serialization; it is retained as uncertain, producing 3,805 rather than 3,806 confidently outside vertices. All outside centroid counts match the offline prediction.

## Current proportion revision

The [proportion revision](female-proportion-review.md) progressed through wider hips/narrower shoulders, a slimmer waist, shoulder/glute rebalancing, a rounded gluteal contour, and a further localized waist narrowing. All passes retain the six **−3 mm** internal insets. The current audit describes the approved localized-waist model published on 2026-09-07.

The audit was raycast against the isolated candidate before publication. After approval, its manifest and both audited binary-chunk hashes were verified to match the published files exactly, and that measured report was promoted to the current audit. Raycasting was not redundantly repeated after identical assets were published. The preceding production report was preserved separately before promotion, and all five historical baseline/correction reports remain byte-identical.

| Revision | Outside vertices | Outside centroids | Uncertain vertices | Uncertain centroids |
| --- | ---: | ---: | ---: | ---: |
| At `5488c7e` | 3,805 | 7,748 | 2 | 5 |
| First proportion pass | 3,806 | 7,745 | 2 | 4 |
| Slimmer-waist pass | 3,806 | 7,744 | 2 | 5 |
| Glute/shoulder rebalance | 3,806 | 7,744 | 4 | 5 |
| Rounded-glute pass | 3,806 | 7,744 | 4 | 5 |
| **Current localized-waist pass** | **3,806** | **7,745** | **4** | **4** |

Compared with the rounded-glute pass, **every per-structure vertex classification count is unchanged**. One left-lobe centroid changes from ray-uncertain to confidently outside: outside **4,135 → 4,136**, uncertain **3 → 2**. It was not previously classified inside; nevertheless, the additional confidently outside sample is reported rather than hidden as an improvement. Every other centroid classification count is unchanged. Boundary totals remain **733 vertices and 1,538 centroids**. Both sinus meshes still have every sampled vertex and centroid confidently inside, with no boundary or uncertain samples.

Earlier small confidence changes remain visible in the history: the glute/shoulder pass moved two left-lobe vertices from inside to uncertain, while the rounded-glute pass reproduced all six full breast audit results exactly. The preceding waist pass had moved one left-lobe centroid from outside to uncertain. None of these shifts established an anatomical correction.

| Revision | Largest outside vertex distance | Largest outside centroid distance |
| --- | ---: | ---: |
| At `5488c7e` | 7.8086 mm | 7.7799 mm |
| First proportion pass | 7.8158 mm | 7.7867 mm |
| Slimmer-waist pass | 7.8001 mm | 7.7715 mm |
| Glute/shoulder and rounded-glute passes | 7.8001 mm | 7.7715 mm |
| **Current localized-waist pass** | **7.7800 mm** | **7.7518 mm** |

Both current maxima occur at the left lobes. They decrease by **0.0201 mm** and **0.0197 mm** from the rounded-glute pass, while the confidently outside centroid count increases by one. This does not resolve the remaining posterior placement defects or validate containment. The same 0.2 mm boundary band and floating-point ray rules apply.

Audited manifest SHA-256 values:

- At `5488c7e`: `44c57151d3ea87badd028def6a9668bd43a39cca601bc29af44363978728cc33`.
- First proportion pass: `7a5392a16813de680ecd4dc24ad6da570f649ba9c71ff3b8dd58610e6767b3cc`.
- Slimmer-waist pass: `c8989ebb399f504637ca3be63ff760b942e7f455d071e3ecfaffd4d3104dc8ca`.
- Glute/shoulder revision: `cca7104dda95b8bef896f9b4e42a51bddf157866e8f451bfb76f488bbcf1e11b`.
- Rounded-glute revision: `e753425a2c6bffcde9e2dc6478e37f96c2e4bec20f2f5ce1a1a0bdef0233eabf`.
- Current localized-waist revision: `9b6f0fc90c80e4cd50a7ec65fa9d43ddeb0d6e5d79b6d1b9a78105443610730b`.

Both breast chunks read by the current audit, `female-base-13.bin` and `female-base-14.bin`, have new hashes recorded in the JSON and verified against the published binary files. All five historical baseline, post-correction, sweep, candidate-validation, and production-comparison files remain byte-for-byte unchanged. The nine analytic containment tests last passed during the glute/shoulder revision; no broader test rerun accompanied this targeted candidate audit.

## Why −3 mm was selected

An isolated sweep reduced the extra inset in 1 mm steps. It preserved each source mesh and applied the change before the recorded whole-body morph; no clipping or per-vertex squeezing was used.

| Extra inset before morph | Outside vertices | Vertices posterior to projected chest surface |
| --- | ---: | ---: |
| −8 mm (baseline) | 9,402 | 14,034 |
| −7 mm | 8,248 | 12,854 |
| −6 mm | 7,072 | 11,747 |
| −5 mm | 5,847 | 10,717 |
| −4 mm | 4,835 | 9,618 |
| **−3 mm (selected candidate)** | **3,806** | **8,436** |
| −2 mm | 3,023 | 7,381 |
| −1 mm | 3,385 | 6,321 |
| 0 mm | 4,400 | 5,300 |

These are **offline candidate** vertex measurements. The chest screen casts a ray through each unchanged x/y position against the actual frontmost selected chest musculoskeletal triangles, using the same source-part selection as the builder. It does not use the builder's blurred or nearest-filled grid. Being posterior to that surface is a projected geometric discrepancy, not a closed-volume muscle-penetration diagnosis; the selected meshes do not establish complete chest anatomy.

Removing the inset entirely improves the posterior position but produces **1,932 outside sinus vertices**, where the baseline had none. The −2 mm candidate has fewer aggregate outside samples, but its duct counts worsen relative to −3 mm and 190 sinus vertices enter the boundary band. The −3 mm candidate improves each lobe and duct group, keeps both sinuses confidently inside, and introduces no front/rim escapes in the sampled candidate geometry.

For ducts and sinuses, the nearest 5% of baseline vertices to each unchanged nipple and areola were also tracked. Every patch's median and p95 surface distance improves with the selected candidate; nipple patch medians fall from roughly 3.5–3.9 mm to 1.3–1.5 mm. These are reproducible geometric patches, **not annotations of actual duct openings**. Better proximity does not prove continuity or absence of overlap.

## Reproduce and preserve evidence

Use Blender 4.0.2 as provisioned by [setup-blender-review.sh](../scripts/setup-blender-review.sh), or a compatible Blender installation with NumPy and `mathutils.bvhtree`:

```bash
blender --background --factory-startup --disable-autoexec --python-exit-code 1 \
  --python scripts/breast-containment-test.py
blender --background --factory-startup --disable-autoexec --python-exit-code 1 \
  --python scripts/breast-containment-audit.py -- \
  --output data/anatomy/breast-containment-audit.json
```

Nine analytic tests cover known inside/outside/boundary points, ambiguous vertex/edge rays, broken topology, inconsistent orientation, ray disagreement/insufficient votes, separate uncertainty counts, and exact equivalence between an offline inset adjustment and applying that adjustment before the shared morph.

Evidence artifacts:

- [Immutable baseline](../data/anatomy/breast-containment-baseline.json): captured before the correction; do not replace it with a new audit. Its source manifests/binary hashes match the pre-correction model assets at commit `81e8651`.
- [Current audit](../data/anatomy/breast-containment-audit.json): measured on the localized-waist candidate and promoted after exact published-input verification; regenerate after future geometry changes.
- [Verified post-correction audit](../data/anatomy/breast-containment-after.json): immutable historical inset-correction candidate output measured before publication; it does not describe the later proportion revision.
- [Full inset sweep](../data/anatomy/breast-inset-experiment.json): comparisons against the preserved baseline.
- [Conservative candidate validation](../data/anatomy/breast-candidate-validation.json): every vertex and centroid, boundary localization, and external interface distances.
- [All-part production comparison](../data/anatomy/breast-production-compare.json): verifies only the six intended meshes changed and the generated positions match the offline candidate.

To audit a separately generated candidate, pass `--root /path/to/candidate` and an explicit `--output`; that root must contain `public/models/atlas-female-reconstructed.json` and its referenced binary chunks. Offline sweep and candidate validation also accept `--root`, `--baseline`, and `--output`. Their root must contain the **preserved −8 mm baseline assets**, not the corrected model; input hashes reject stale or mismatched baselines. Production comparison accepts `--before-root`, `--after-root`, and `--output`.

## Still required

Review the remaining posterior lobe/duct placements, the relationship to actual chest tissues, and the envelope dimensions together. Establish source-supported duct/nipple interfaces and suspensory attachments rather than optimizing containment alone. Preserve the source anatomy and document any future local reshaping or envelope changes. This issue cannot be completed from improved containment counts or breast appearance alone.
