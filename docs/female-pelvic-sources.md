# Female pelvic source assessment

Source inventory for [SWR-514](https://linear.app/stealth-company/issue/SWR-514) and [SWR-515](https://linear.app/stealth-company/issue/SWR-515), inspected 2026-09-06. This identifies candidates and missing provenance; it does not import geometry or approve pelvic registration.

## Bundled HRA assembly

`public/models/atlas-female.json` identifies its source as **HRA united-female v1.5**, with 888 selectable meshes and 1,073 concepts. The existing attribution points to the [HRA digital object](https://lod.humanatlas.io/ref-organ/united-female/v1.5) and its [original GLB](https://cdn.humanatlas.io/digital-objects/ref-organ/united-female/v1.5/assets/3d-vh-f-united.glb). The HRA [official reference-library terms](https://hubmapconsortium.github.io/ccf/pages/ccf-3d-reference-library.html) identify CC BY 4.0 for the 3D reference objects. [NIH entry 3DPX-020992](https://3d.nih.gov/entries/3DPX-020992) independently lists this v1.5 female assembly.

A case-insensitive name/ID inventory of all bundled parts and concepts found no separate urethra, levator ani, puborectalis, pubococcygeus/pubovisceral, iliococcygeus, coccygeus, perineal muscle/body/membrane, external anal sphincter, clitoris or labial assembly. Query terms included `urethr`, `levator`, `puborect`, `pubococc`, `pubovisc`, `iliococc`, `coccygeus`, `perine`, `sphinct`, `clitor`, `labium`, `labia`, and `vulv`. This is a naming inventory, not proof of geometric absence or a claim about every HRA release.

Relevant positive matches:

| Bundled source ID | Label / ontology |
|---|---|
| `VH_F_vagina` | Vagina; UBERON:0000996 |
| `VH_F_cervicovaginal_junction` | Cervicovaginal junction; HRA local identifier |
| `VH_F_fundus_of_urinary_bladder_dome` | Fundus of urinary bladder; UBERON:0006082 |
| `VH_F_fundus_of_urinary_bladder_base` | Fundus of urinary bladder; UBERON:0006082 |
| `VH_F_urinary_bladder_neck_smooth_muscle` | Bladder neck smooth muscle; UBERON:0004230 |
| `VH_F_trigone_of_urinary_bladder` | Trigone; UBERON:0001257 |
| `VH_F_ureteral_orifice_L`, `VH_F_ureteral_orifice_R` | Ureteral orifices, grouped in the bladder concept |

Bladder-neck muscle is not a substitute for a segmented urethra. Ureteral orifices are not the urethral outlet. None of these labels resolves the missing urinary continuity by itself.

The current HRA portal is client-rendered and the unversioned female digital-object URL returned 404 during this assessment. A newer verified downloadable female urethra/pelvic-floor asset has not been established. Do not describe v1.5 as the latest HRA release based on this result.

## Available research source: CVH5 pelvic reconstruction

[Wu et al., 2015](https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0132226) describes a female CVH5 reconstruction and serial sections, licensed CC BY 4.0. The [October correction](https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0140736) switches supplement labels, but following its S3 label alone retrieves TIFF. A full content-type and magic-byte inventory resolved the actual assets:

- Original DOI **10.1371/journal.pone.0132226.s003** is a one-page PDF with a 3D U3D annotation.
- Correction DOI **10.1371/journal.pone.0140736.s004** contains the same U3D geometry bytes.
- Their neighboring PDF assets are the 93-page serial sections.

Passive extraction established **47 model nodes with 47 geometry resources and one group node**. Source identities include pubovisceral and puborectal subdivisions, coccygeal muscle, perineal body and external anal sphincter, plus bladder/urethral lumen, submucous urethral layer, urethral compressor and urethro-vaginal sphincter. The article qualifies some subdivisions as reconstruction conventions; retain its nomenclature rather than automatically mapping it to our aliases.

The geometry payloads use **RHAdobeMeshResource compression**. Editable triangle decoding, source registration and anatomical validation remain separate work. The [source inventory and reproduction instructions](../data/anatomy/cvh5/README.md) preserve verified PDF/U3D hashes, exact node/resource IDs and transforms, passive extraction scripts, and the tool compatibility constraint. This is a verified 3D source, not yet an imported atlas addition.

## Downloadable-model candidate: NIH 3D pelvis

[3DPX-017321, version 2](https://3d.nih.gov/entries/3DPX-017321), uploaded by Emullen45, is titled “Female Pelvis with Perineal Structures and Musculature.” Its page explicitly links **CC BY 4.0**. The [download inventory](https://3d.nih.gov/entries/download/17321/2) lists one input STL (`6-1-2018%20Pelvis.stl`) and generated GLB/STL/WRL/X3D outputs.

The linked GLB asset returned HTTP 403 during inspection. Separate muscle names, urethral coverage, internal object IDs and segmentation quality could not be verified. A title and downloadable format do not establish selectable levator components or a urethra. This is a concrete candidate to inspect when access works, not yet a replacement source. NIH hosting does not by itself constitute anatomical approval.

## Next implementation steps

1. Decode one CVH5 RHAdobeMeshResource through a compatible importer and validate nonempty triangles before attempting all 47 resources. Preserve node/resource identities, transforms and attribution. If this conversion path is unavailable, inspect the NIH candidate or pursue an author-provided surface export with separately authorized contact.
2. Register any candidate to the common female pelvic reference after SWR-513's alignment work. Review pubic, obturator and coccygeal attachments with bladder/urethra, vagina and anorectum together.
3. Define nomenclature and teaching scope before mapping components. Record missing external anatomy explicitly. Require reviewed section and attachment evidence through the female-readiness checklist before claiming urinary continuity or pelvic-floor accuracy.

No source mesh was added or relabeled by this investigation. SWR-514 and SWR-515 remain open.
