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

## Female source anatomy

Female source anatomy: Kristen Browne and Heidi Schlehlein, Human Reference Atlas / HuBMAP, *3D Reference Organ Set for Female v1.5* (2023). CC BY 4.0. The current female study model contains selected adapted meshes from this set, combined with adapted BodyParts3D geometry.

- Source DOI: https://doi.org/10.48539/HBM352.BTSQ.586
- Dataset: https://lod.humanatlas.io/ref-organ/united-female/v1.5
- Original GLB: https://cdn.humanatlas.io/digital-objects/ref-organ/united-female/v1.5/assets/3d-vh-f-united.glb
- License: https://creativecommons.org/licenses/by/4.0/

The source assembly has 888 meshes and 1,073 named nodes. Its original conversion translated native meter/Y-up coordinates onto the stage, welded coincident vertices, averaged source normals, simplified geometry with a 0.2% per-structure relative error bound, and quantized normals. The complete source assembly is not included in this release.

## Female study model · Human Atlas Enhanced

Derived geometry is imported from [Human Atlas Enhanced by PrejudiceNeutrino](https://github.com/PrejudiceNeutrino/human-atlas-enhanced), revision `9e0d710fcc1d467dc758d61d6f417231cb1472fe`. Its `atlas-female-reconstructed.json` is preserved here as `models/atlas-female.json`, with 2,245 meshes, 4,248 named concepts and 2,437,148 triangles. Source IDs, per-part provenance, geometry bytes, and the original fit report are retained. Anatolume changes the viewer integration and display controls, not these imported geometry files. Import SHA256 records are in `models/female-source.json`.

Thanks to [PrejudiceNeutrino](https://github.com/PrejudiceNeutrino) for sharing the female study model and its source/adaptation records. This acknowledgement supplements the original BodyParts3D and HRA rights-holder statements; their CC BY 4.0 licenses and attribution requirements remain in force.

The derived model retains 2,181 adapted BodyParts3D meshes and adds 64 adapted HRA meshes: 8 pelvis, 38 reproductive, 16 breast, and 2 anterolateral knee ligaments. Both source datasets remain CC BY 4.0 under the credits above. The male model remains separate.

Upstream adaptations include positive affine fits of the female pelvis and reproductive organs, a body morph with estimated proportions and waist/glute contour refinements, a shared per-side contour and placement of source-topology breast meshes, inverse-transpose normal transforms, recomputed bounds, and binary/gzip packing. Male-specific structures, the male urethra, male skin/hair envelope and selected pelvic-floor structures are excluded. Breast tissue is shown separately from skeletal muscle, while nipple and areolar meshes remain in the optional body-surface layer. The two HRA knee ligaments use an estimated bone-constrained local fit.

The upstream breast-source approach was inspired by [Female Atlas by Mahendra Beniwal](https://github.com/HiMahendraBeniwal/female-atlas/tree/b0a20fa3a009ca5f6bfa07b7479312e04c862af2); the imported assembly uses the credited HRA geometry, not that project's outer skin or composite meshes.

This is an experimental derived study model with estimated proportions and placement, not a scanned or independently validated female reference. Female external skin/genital surfaces and validated female urethra/pelvic-floor replacements are absent. Full upstream [adaptation and scope notes](https://github.com/PrejudiceNeutrino/human-atlas-enhanced/blob/9e0d710fcc1d467dc758d61d6f417231cb1472fe/docs/female-anatomy.md) and `models/female-fit-report.json` document its limitations. See [the Anatolume integration guide](https://github.com/isunky/Anatolume/blob/main/docs/FEMALE_MODEL.md).
