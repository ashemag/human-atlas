# Teaching anatomy coverage

Tracked by [SWR-511](https://linear.app/stealth-company/issue/SWR-511). Run `npm run audit:coverage` to regenerate from the pinned source metadata and current bundled atlases.

Counts are named meshes, not muscle quantity or proof of anatomical completeness. A zero means no separately named mesh was identified with the documented aliases. Merged or mislabeled tissue requires geometric review. The HRA column is the original female source, not the reconstructed model. BodyParts3D is male reference anatomy.

| Target | Male | Female study | HRA source | Official BP3D archive | Finding |
|---|---:|---:|---:|---:|---|
| Rectus abdominis | 0 | 0 | 0 | 0 | not separately identified |
| Internal oblique | 0 | 0 | 0 | 0 | not separately identified |
| Transversus abdominis | 0 | 0 | 0 | 0 | not separately identified |
| Multifidus | 0 | 0 | 0 | 0 | not separately identified |
| Quadratus lumborum | 0 | 0 | 0 | 0 | not separately identified |
| External oblique | 2 | 2 | 0 | 2 | named meshes present |
| Diaphragm | 1 | 1 | 0 | 1 | named meshes present |
| Psoas major | 2 | 2 | 0 | 2 | named meshes present |
| Iliacus | 2 | 2 | 0 | 2 | named meshes present |
| Gluteus maximus | 2 | 2 | 0 | 2 | named meshes present |
| Gluteus medius | 2 | 2 | 0 | 2 | named meshes present |
| Gluteus minimus | 2 | 2 | 0 | 2 | named meshes present |
| Piriformis | 2 | 2 | 0 | 2 | named meshes present |
| Puborectalis | 3 | 0 | 0 | 3 | Explicitly omitted from female |
| Pubococcygeus / pubovisceral muscle | 3 | 0 | 0 | 3 | Explicitly omitted from female |
| Iliococcygeus | 3 | 0 | 0 | 3 | Explicitly omitted from female |
| Coccygeus | 3 | 0 | 0 | 3 | Explicitly omitted from female |
| Tendinous arch of levator ani | 4 | 0 | 0 | 3 | Explicitly omitted from female |
| External anal sphincter | 3 | 0 | 0 | 3 | Explicitly omitted from female |
| Urethra | 1 | 0 | 0 | 1 | Explicitly omitted from female |

## How to interpret this

The official archive contains 17 meshes with blank English names; these remain unresolved source labels. Source-ID comparison finds 0 archive meshes missing from our male bundle and 0 bundled meshes outside the archive.

- A named mesh still needs border, side, attachment and registration review.
- A source match omitted from the female model identifies an exclusion, not permission to relabel male pelvic anatomy as female.
- A missing name in both source and app requires a different source or segmentation investigation; renaming an arbitrary mesh does not resolve it.
- Source files are pinned and checksum-verified. Evidence, concepts, element IDs, archive names, aliases and exclusions are retained in `data/anatomy/coverage-baseline.json`.
- The anterior abdominal-wall concepts currently resolve to the two external-oblique meshes. This inventory does not assume that those meshes constitute complete or correctly separated abdominal layers.

## Sources

Official [BodyParts3D download](https://dbarchive.biosciencedbc.jp/en/bodyparts3d/download.html), downloaded 2026-09-06, licensed CC BY 4.0 (see `public/ATTRIBUTION.md`). The source snapshot records original URLs and SHA-256 hashes. The mesh-name index records source header names, not inferred labels.
