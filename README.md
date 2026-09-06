# Human Atlas

An interactive 3D anatomy explorer built with React, Three.js, and shadcn/ui. Take the BodyParts3D adult male reference apart into **2,234 individually selectable meshes**, explore **15 anatomical systems**, and search **3,432 named concepts**.

**[Explore the live demo](https://human-atlas-seven.vercel.app)**

## Explore

- Orbit, zoom, and select structures directly on the body.
- Toggle individual systems or use skeleton and organ presets.
- Enter a focused study mode — heart, respiratory, digestive, kidney, or reproductive — and step through its structures in order, each framed and explained.
- Switch between the male and female reference bodies.
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

Open http://localhost:3016. To build the static site, run `npm run build`; the output is in `dist/`.

## Validate

```sh
npm run check
npm run validate
npm run build
```

`npm run validate` covers `scripts/validate-atlas.mjs` (mesh buffers, names, concept
membership, and that every chunk stays system-pure), `scripts/validate-modes.mjs`
(each study mode's focus and tour resolve inside its own systems, and it stays
within its download budget), and `scripts/validate-interactions.mjs`.

Validation covers mesh buffers, names and concept membership, nonoverlapping exploded layouts at desktop and mobile aspect ratios, search and inspection contracts, and tap-versus-drag handling. Browser interaction checks have exercised selection, system controls, search, isolation, rotation, and 390×844, 320×568, and 844×390 layouts. Phone controls stay clear of the exploded inventory, and isolated structures fit the space above or beside the detail panel. Physical-device performance and real multitouch hardware have not been tested.

## Anatomy data

The viewer ships two reference bodies, switchable in the header or with `?body=male` / `?body=female`.

**Male** is **BodyParts3D 4.0**, an adult male reference anatomy, licensed **CC BY 4.0**. **Female** is the **Human Reference Atlas united-female v1.5** assembly, also **CC BY 4.0** — 888 meshes and 1,073 concepts including full female reproductive anatomy, with partial skeleton and muscle coverage. Eight placenta and umbilical structures sit under a Pregnancy reference system that is hidden by default.

Neither represents every human structure or variation. Individual source meshes are distinct from named concepts, which may group multiple meshes. Descriptions distinguish general system context from individual organ explanations.

Geometry is simplified for browser performance while retaining every source mesh. The packaged model contains 2,288,268 triangles. The whole body is approximately 33 MB of compressed geometry, but chunks are system-pure and fetched on demand, so a single system costs only its own share — from 10.8 MB for the musculature down to 0.07 MB for the urinary tract. Full credits, source links, and adaptation details are in [ATTRIBUTION.md](public/ATTRIBUTION.md).

This is an educational explorer, not a diagnostic or surgical tool.

## Focused study modes

A study mode is a guided walkthrough, not another way to switch a system on. It
narrows the atlas to the systems one topic needs, then steps through named
structures in the order they are taught — the heart mode follows blood through
right atrium, tricuspid valve, right ventricle, pulmonary valve and on around —
framing and explaining each one.

Because chunks are system-pure, entering a mode downloads only those systems: the
heart is 0.68 MB and the kidneys 0.07 MB, against 33 MB for the assembled body.

Link straight into one with `?mode=<id>` — `?mode=kidney`, `?mode=heart`,
`?mode=respiratory`, `?mode=digestive`, `?mode=reproductive`, combined with
`?body=` if needed. The mode is applied before any geometry is requested, so a deep
link never fetches the rest of the body.

Modes are declared in `app/anatomy.ts`. Each step lists candidate concept ids and
the first present in the loaded atlas wins, so one mode serves both reference
bodies; steps that resolve in neither are skipped.
`scripts/validate-modes.mjs` fails if a mode's walkthrough resolves outside its own
systems, which would silently pull in everything it was meant to avoid.

## How it works

Geometry is merged into batches. Per-structure GPU textures control translation, visibility, and selection, while component geometry supports accurate picking. Exploded layouts pack only the visible pieces. Rendering updates when the scene changes; orbit controls remain responsive without thousands of separate draw calls.

Each binary chunk holds exactly one anatomical system, and chunks load on demand as
systems become visible. `scripts/rechunk-by-system.mjs` produces that packing by
reslicing the published buffers using the byte offsets already recorded per part, so
it needs no source archive and leaves the geometry byte-identical.

The optional WebMCP tools expose anatomy search and inspection in compatible browsers. The visible interface works without them.

## Rebuilding geometry

The repository includes browser-ready geometry. Rebuilding it is optional: obtain the official BodyParts3D OBJ archive and English metadata tables, prepare the joined concepts and display-system mappings, run `scripts/convert-anatomy.py`, then `node scripts/optimize-anatomy.mjs`, `node scripts/rechunk-by-system.mjs` and `node scripts/compress-models.mjs`. Simplification uses a 0.2% relative error limit per structure.

Repacking alone does not need the source archive. `scripts/rechunk-by-system.mjs`
reslices whatever is already in `public/models`, so it can be re-run after any
change to the display-system mapping.

## Deploy

Import this repository into Vercel as a Vite project. The included `vercel.json` configures `npm ci`, `npm run build`, and the `dist` output directory. It can also be served by a static host.

## License

Original application code is released under the [MIT License](LICENSE). **The anatomy data has its own CC BY 4.0 license**; preserve the attribution when redistributing it. Third-party dependencies retain their respective licenses.

Issues and pull requests are welcome. Please include reproduction steps and browser/device details for interaction problems.
