# CVH5 female pelvic source

The pinned publisher PDF contains one genuine 3D annotation with a 10,392,492-byte U3D stream. `scene-index.json` records **47 model nodes**, **47 geometry resources** and **one group node**, `CVH5_116`. These are parsed declarations, not triangle counts or anatomical approval. The 47 source models include `Skin`; the article's stated 46 structures should not be treated as a contradicting mesh count without its structure definitions.

`provenance.json` contains the full author attribution, CC BY 4.0 source-license links, both usable publisher PDF URLs and SHA-256 checksums, U3D checksum and derived-index checksum. The original `0132226.s003` and corrected `0140736.s004` PDFs embed identical U3D bytes. `supplement-inventory.json` records content types and initial magic bytes for all 16 original/correction supplements; misleading captions and filenames are why the full inventory was necessary. No publisher PDF, embedded script or geometry binary is bundled here.

## Reproduce passive extraction

Requires Python with `pypdf==6.17.0`. Download one pinned PDF into a temporary directory; the extraction script rejects other PDF checksums. For example, from the repository root:

```sh
python3 - <<'PY'
import json, pathlib, urllib.request
pins = json.loads(pathlib.Path('data/anatomy/cvh5/provenance.json').read_text())
path = pathlib.Path('/tmp/cvh5-source.pdf')
path.write_bytes(urllib.request.urlopen(pins['pdfSources'][0]['url']).read())
PY
python3 -B scripts/index-cvh5-source.py /tmp/cvh5-source.pdf --u3d-output /tmp/cvh5-source.u3d --index-output /tmp/cvh5-scene-index.json
python3 -B scripts/index-cvh5-source-test.py
```

Compare the resulting index to `data/anatomy/cvh5/scene-index.json`. The extractor reads `/3D` annotation data with a passive PDF parser; it never launches a viewer, evaluates JavaScript, loads an extension plugin or decodes a mesh payload. It writes only the verified U3D stream and declaration metadata. Keep later geometry conversion separate from registration and anatomy review.

## Node identity and geometry distinction

The source model-node name is its identifier in the index; no FMA/UBERON mapping is invented. Exact names, including significant trailing spaces, are preserved. Each model points to a separately named source geometry resource such as `mesh (24)`. Group nodes have parents/transforms but no geometry resource. The index preserves parent matrices and resource payload hashes.

Examples of source models include pubovisceral inner/external layers, puborectal deep/superficial parts, coccygeal muscle, external anal sphincter, perineal body, bladder and urethral lumen, submucous urethral layer, urethral compressor, urethro-vaginal sphincter and cavernous body of clitoris. Their presence as named geometry resources is established; decoded triangle content, segmentation quality, model units/scale after conversion and attachment accuracy remain to be verified.

## Conversion constraint and next step

All 47 geometry payloads use declaration block `0x100`, registered as **RHAdobeMeshResource** with GUID `96a804a6-3fb9-43c5-b2df-2a31b5569340`, vendor Right Hemisphere Adobe Systems. These are extension-compressed meshes, not the standard U3D CLOD mesh blocks. A successful scene-node index is therefore insufficient to claim editable geometry extraction.

- [MeshLab's U3D plugin](https://github.com/cnr-isti-vclab/meshlab/blob/71e7b0b53cd98f520f84cb17b31bac6f1ef947cc/src/meshlabplugins/io_u3d/io_u3d.cpp) has an empty `importFormats()` list and provides U3D/IDTF export. Installing MeshLab alone is not a verified import route.
- The [open Intel-derived U3D library](https://github.com/ningfei/u3d/tree/5c141d9f0d366357e2b7cf93af2eade284a334be) includes a scene loader. Its [load manager](https://github.com/ningfei/u3d/blob/5c141d9f0d366357e2b7cf93af2eade284a334be/RTL/Component/Importing/CIFXLoadManager.cpp) substitutes a dummy modifier when an extension decoder cannot be created. This inspection did not establish an RHAdobeMesh decoder in that source, and its IDTFConverter primarily converts IDTF into U3D. Compiling it is not yet evidence that it will extract this file's triangles.
- [Open Design Alliance's importer documentation](https://www.opendesign.com/blog/2019/october/reading-and-rendering-u3d-files) explicitly supports RHAdobeMesh through `OdU3D2PrcImport`. This is a concrete compatibility lead, but that SDK has not been acquired, run or licensed for this project. Its availability is not proof of successful OBJ/GLB export of this source.

The bounded next step is a compatibility test of one nonempty source mesh through an available importer that explicitly supports this extension, followed by preservation of all 47 node/resource identities, transforms and geometry checks. An author-provided surface export is an alternative if separately authorized contact is wanted. No author has been contacted, no SDK installed and no source triangles imported in this assessment. Whole-pelvis fitting remains dependent on SWR-513.
