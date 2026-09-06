# Anatomy data attribution

BodyParts3D, © The Database Center for Life Science licensed under CC Attribution 4.0 International.

- License: https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html (updated 2025-02-27)
- Dataset: https://dbarchive.biosciencedbc.jp/en/bodyparts3d/download.html
- License terms: https://creativecommons.org/licenses/by/4.0/
- Source geometry: `isa_BP3D_4.0_obj_99.zip`, BodyParts3D 4.0.
- English names and relationships: IS-A and PART-OF concept, element, and inclusion tables from the same archive.
- Publication: Mitsuhashi et al. (2009), BodyParts3D: 3D structure database for anatomical concepts. https://doi.org/10.1093/nar/gkn613

Adaptations: axes and units converted from millimeters/Z-up to meters/Y-up; translated to rest at the stage; geometry simplified using meshoptimizer with 0.2% relative error limit per structure; normals quantized to signed 16-bit; packed into binary chunks; curated display system groupings and colors. The source contains 2,234 individual OBJ meshes; all remain represented. The combined hierarchy contains 3,432 named FMA concepts, which may reference multiple meshes. Original source identity is preserved in the manifest.

Source OBJ comments mention an older CC BY-SA 2.1 Japan license. The official current database license linked above supersedes that legacy text and explicitly permits redistribution and adaptation under CC BY 4.0.

BodyParts3D represents an adult male reference anatomy based on TARO MRI and anatomical illustration refinements. It is not a complete model of every possible human anatomical structure or variation. This interface is educational and is not a clinical tool.

## Female anatomy

Female reference anatomy: Kristen Browne and Heidi Schlehlein, Human Reference Atlas / HuBMAP, *3D Reference Organ Set for Female v1.5* (2023). CC BY 4.0. Geometry adapted for this viewer.

- Source DOI: https://doi.org/10.48539/HBM352.BTSQ.586
- Dataset: https://lod.humanatlas.io/ref-organ/united-female/v1.5
- Original GLB: https://cdn.humanatlas.io/digital-objects/ref-organ/united-female/v1.5/assets/3d-vh-f-united.glb
- License: https://creativecommons.org/licenses/by/4.0/

Adaptations: translated native meter/Y-up coordinates onto the stage, coincident vertices welded and source normals averaged, geometry simplified with a 0.2% per-structure relative error bound, and normals quantized. Colors and display systems are curated for this interface. All 888 source meshes are represented, with 1,073 source nodes available as selectable individual or compound concepts.

This is a reference assembly with whole-body surface and selected organs, including female reproductive anatomy. Its skeleton and muscle coverage is partial. It is not a complete model of every human structure or a single-person scan. Eight placenta/umbilical structures are classified under Pregnancy reference and hidden by default.

## Female study prototype

`atlas-female-reconstructed.json` retains 2,181 BodyParts3D 4.0 meshes (source topology unchanged) and adds 62 adapted HRA female meshes (8 pelvis, 38 reproductive, 16 breast). Both sources retain the CC BY 4.0 attribution above. The original male and HRA female atlases remain available separately.

Adaptations: the HRA female pelvis (compact bone shells, sacrum, coccyx) is affinely fitted to the male hip bone envelope and replaces the male hip bones and sacrum; the two breast fat bodies are regenerated as feathered heightfields on the chest wall from the HRA adipose thickness profile; female reproductive geometry is affinely placed using the HRA and BodyParts3D bladder bounds as alignment proxies; the breast assembly is placed at the fourth intercostal level and draped onto the chest wall with a stored depth-shift grid. The whole assembly, retained BodyParts3D meshes included, is reshaped by a shared whole-body field toward estimated female proportions (stature, shoulders, thorax, waist, pelvis, skull), with a torso-limited additional waist refinement. An explicitly scoped posterior and inferior contour applies to the bilateral gluteus maximus and inferior gluteal vein meshes. The breast-envelope surface material adds illustrative lobulated tissue detail. Normals use the inverse-transpose Jacobian, bounds are recomputed, and all geometry is packed into `female-base-*.bin` chunks. Male-specific geometry and selected pelvic-floor structures are excluded from the new manifest.

This is an experimental study model with estimated proportions, not independently validated female anatomy. Original source IDs and adaptation notes are preserved on every part. Morph parameters, the drape grid, placement transforms, landmarks, and exclusions are recorded in `models/female-fit-report.json`; the builder is `scripts/build-female-reconstruction.py`.

## Coverage audit source metadata

`data/anatomy/sources` contains pinned BodyParts3D English IS-A name/element tables and an index of official OBJ header identities. BodyParts3D, © The Database Center for Life Science licensed under CC Attribution 4.0 International. Source URLs, retrieval date and SHA-256 hashes are in `provenance.json`. The original archive retains historical license text in its OBJ headers; the current official license page specifies CC BY 4.0. Blank source names remain blank rather than being inferred.
