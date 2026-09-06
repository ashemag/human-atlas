# Contributing

Thanks for looking at Human Atlas. Issues and pull requests are welcome.

## Getting set up

Node 22.13 or newer (`.nvmrc` pins the floor). No API keys or accounts are needed.

```sh
npm ci
npm run dev     # http://localhost:3016
```

## Before opening a pull request

```sh
npm run check   # tsc --noEmit
npm run lint    # oxlint, warnings are errors
npm run build

node scripts/validate-atlas.mjs
node scripts/validate-interactions.mjs
```

CI runs all of these on Node 22.13 and 24. The atlas validator reads the committed
binaries, so it catches a manifest that has drifted from its geometry — the failure
that would otherwise surface only when a viewer fetches the chunk.

For interaction changes, say in the pull request which flows you exercised and on
what. Browser checks so far have covered selection, system controls, search,
isolation, rotation, and 390×844, 320×568 and 844×390 layouts. Physical-device
performance and real multitouch hardware have not been tested, so those claims need
evidence.

## House style

The application code is written deliberately dense — packed declarations, few line
breaks, comments reserved for things the code cannot say. Match the file you are
editing rather than the conventions of another project.

`oxfmt` is installed as a dependency but **the repository is not oxfmt-formatted**,
and there is no format script. Running it across the tree rewrites all 74 source
files and destroys that style. If you want it for a file you are writing from
scratch, that is your call; do not reformat existing files in a pull request that
is about something else.

`oxlint` is different: the tree is clean, so `npm run lint` treats warnings as
errors and CI enforces it.

## Anatomy data

Geometry and the manifests in `public/models` are generated. If you change how they
are packed, re-run the validator and say in the pull request what the numbers were
before and after — download size is a user-facing property of this project, not an
implementation detail.

The data carries its own licence. `public/ATTRIBUTION.md` is not boilerplate:
BodyParts3D is CC BY 4.0 and attribution has to survive into the shipped interface.
Keep the About sheet's source links intact.

## Scope

This is an educational anatomy explorer, not a diagnostic or surgical tool, and the
copy should keep saying so. Descriptions should distinguish general system context
from specific structure explanations, and should not overstate what a simplified
reference body can show.
