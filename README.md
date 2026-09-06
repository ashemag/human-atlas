# Human Atlas

An interactive 3D anatomy explorer built with React, Three.js, and shadcn/ui. Explore the BodyParts3D male reference (**2,234 meshes, 3,432 named concepts**) or a female study prototype (**2,243 meshes, 4,246 concepts**) derived from the BodyParts3D framework, fitted HRA female organs and pelvis, an illustrated breast body, and a whole-body morph toward estimated female proportions. The HRA female source atlas still ships for validation and rebuilds but is not offered in the viewer.

**[Explore the live demo](https://human-atlas-seven.vercel.app)**

## Explore

- Switch between male reference anatomy and the experimental female study model.
- Orbit, zoom, and select structures directly on the body.
- Toggle individual systems or use skeleton and organ presets.
- Move from assembled anatomy to a spaced inventory of every visible piece.
- Search anatomical names and source identifiers.
- Isolate a selected structure and read its details.
- Use compact controls and detail panels on mobile.

## Run locally

Requires Node.js 22.13 or newer. No API keys or accounts are needed.

```sh
npm ci
npm run dev
```

Open http://localhost:3016; `/` responds with HTTP 307 and redirects to `/male`. Go directly to http://localhost:3016/female or http://localhost:3016/male to load that model. Vite development and preview servers use the same redirect, preserving query parameters. To build the static site, run `npm run build`; the output is in `dist/`.

## Validate

```sh
npm run check
node scripts/validate-atlas.mjs
node scripts/validate-atlas.mjs atlas-female.json
node scripts/validate-atlas.mjs atlas-female-reconstructed.json
node scripts/validate-interactions.mjs
npm run build
```

Validation covers mesh buffers, names and concept membership, nonoverlapping exploded layouts at desktop and mobile aspect ratios, search and inspection contracts, and tap-versus-drag handling. Browser interaction checks have exercised selection, system controls, search, isolation, rotation, and 390×844, 320×568, and 844×390 layouts. Phone controls stay clear of the exploded inventory, and isolated structures fit the space above or beside the detail panel. Physical-device performance and real multitouch hardware have not been tested.

## Anatomy data

The male viewer uses **BodyParts3D 4.0**, an adult male reference anatomy, licensed **CC BY 4.0**. It does not represent every human structure or variation. Individual source meshes are distinct from named concepts, which may group multiple meshes. Descriptions distinguish general system context from individual organ explanations.

Geometry is simplified for browser performance while retaining every source mesh. The packaged model contains 2,288,268 triangles and downloads approximately 33 MB of compressed geometry. Full credits, source links, and adaptation details are in [ATTRIBUTION.md](public/ATTRIBUTION.md).

> **The female model is a derived study model, not a scanned reference.** The male atlas is BodyParts3D, an actual adult male reference model. This project has not integrated a complete validated female source. The female model reuses the male skeleton, muscles, and shared organs, swaps in the HRA female pelvis and reproductive organs, adds an illustrated breast body, and reshapes the assembly with an estimated whole-body field plus localized contour refinements. Its proportions are estimates guided by ecorché illustrations, not measurements of a real body.

The female option retains **2,181 BodyParts3D meshes** with their source topology, adds **62 fitted HRA female meshes** (the female pelvis in place of the male one, reproductive organs, and breast tissue draped onto the chest wall with a regenerated fat body), and reshapes the assembly with a shared whole-body field, a torso-limited waist refinement, and an explicitly scoped glute contour toward estimated female proportions: about 1.62 m stature, narrower shoulders, a wider pelvis, and a smaller skull. Male-specific structures and selected shared pelvic-floor structures are omitted. Those shared structures remain unresolved coverage gaps. Proportions are artistic estimates, bounding-box fits do not validate joint or muscle attachments, and organ placement is experimental, with visible source provenance. It downloads approximately 35 MB of compressed geometry. See [the reconstruction documentation](docs/female-anatomy.md) for the pipeline, exclusions, and limitations.

The current female model supports static exploration of displayed structures. It has no validated pose, muscle activation or movement-mechanics system for yoga/Pilates instruction. The [coverage report](docs/anatomy-coverage.md) and [female documentation](docs/female-anatomy.md) describe unresolved anatomy and proportion assumptions.

`npm run validate:female-readiness` is a separate teaching-release gate and currently **must fail**: independent anatomy and movement reviews are outstanding. It checks atlas integrity, current target discoverability, revision-bound review artifacts and declared teaching scope. `npm run test:female-readiness` verifies the gate itself; passing tests do not approve anatomy. See the [review evidence instructions](data/anatomy/reviews/README.md).

This is an educational explorer, not a diagnostic or surgical tool.

## How it works

Geometry is merged into batches. Per-structure GPU textures control translation, visibility, and selection, while component geometry supports accurate picking. Exploded layouts pack only the visible pieces. Rendering updates when the scene changes; orbit controls remain responsive without thousands of separate draw calls.

The optional WebMCP tools expose anatomy search and inspection in compatible browsers. The visible interface works without them.

## Rebuilding geometry

The repository includes browser-ready geometry. Rebuilding it is optional: obtain the official BodyParts3D OBJ archive and English metadata tables, prepare the joined concepts and display-system mappings, run `scripts/convert-anatomy.py`, then `node scripts/optimize-anatomy.mjs` and `node scripts/compress-models.mjs`. Simplification uses a 0.2% relative error limit per structure.

To rebuild the female geometry, `python3 scripts/convert-female.py SOURCE.glb SOURCE_PARTS.json` expects the official HRA united-female v1.5 GLB and a curated node-to-system metadata map. That external metadata map is not bundled, so the restored binary assets are currently the reproducible checkout path. Run `node scripts/optimize-anatomy.mjs atlas-female.json` after conversion; `node scripts/compress-models.mjs` compresses both atlases.

Rebuild the experimental female additions with `python3 scripts/build-female-reconstruction.py` (requires NumPy). This uses the already bundled source atlases and writes a separate manifest and chunks; do not run the source simplifier on the composed reconstruction.

## Deploy

Import this repository into Vercel as a Vite project. The included `vercel.json` configures `npm ci`, `npm run build`, and the `dist` output directory. The configuration rewrites `/female` and `/male` to the app entry so direct links and refreshes work. It also temporarily redirects `/` to `/male` (HTTP 307). Other static hosts need this server-side redirect and the same two rewrites to `/index.html`.

## License

Original application code is released under the [MIT License](LICENSE). **The anatomy data has its own CC BY 4.0 license**; preserve the attribution when redistributing it. Third-party dependencies retain their respective licenses.

Issues and pull requests are welcome. Please include reproduction steps and browser/device details for interaction problems.
