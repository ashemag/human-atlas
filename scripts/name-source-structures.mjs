/** Give every structure a readable name and a concept reference.
 *
 * The Human Reference Atlas ships 210 structures — Allen brain regions and
 * skeletal detail — whose English labels are absent from the metadata tables,
 * leaving `name` and `conceptId` as "-". Their source identifiers already spell
 * the anatomy out (`Allen_head_of_caudate_L`), so the label is derivable rather
 * than lost, and the atlas validator refuses a "-" name for good reason: it
 * reaches the search index and the detail panel.
 *
 *   node scripts/name-source-structures.mjs [atlas-female.json]
 */
import fs from 'node:fs';

const base = new URL('../public/models/', import.meta.url);
const filename = process.argv[2] ?? 'atlas-female.json';
const path = new URL(filename, base);
const atlas = JSON.parse(fs.readFileSync(path));

// Source prefixes carry provenance, not anatomy: VH_F_ is the female reference
// body, Allen_ a brain region from the Allen atlas.
const PREFIXES = [/^VH_[MF]_/, /^Allen_/];
const SIDES = { L: 'left', R: 'right' };

function readableName(id) {
  let rest = id;
  for (const prefix of PREFIXES) rest = rest.replace(prefix, '');
  const segments = rest.split('_').filter(Boolean);
  let side = '';
  if (segments.length > 1 && SIDES[segments.at(-1)]) side = SIDES[segments.pop()];
  const words = segments.join(' ').replace(/\s+/g, ' ').trim();
  if (!words) return '';
  const name = words.charAt(0).toUpperCase() + words.slice(1);
  return side ? `${name} (${side})` : name;
}

const named = new Map();
let parts = 0;
for (const part of atlas.parts) {
  if (part.name.trim() && part.name !== '-') continue;
  const name = readableName(part.id);
  if (!name) throw new Error(`${part.id}: no name could be derived`);
  part.name = name;
  // The manifest is the only record of source identity, so the concept
  // reference points back at the source id rather than being invented.
  if (part.conceptId === '-') part.conceptId = `HRA:${part.id}`;
  named.set(part.id, name);
  parts += 1;
}

let concepts = 0;
for (const concept of atlas.concepts) {
  if (concept.name.trim() && concept.name !== '-') continue;
  const name = concept.elements.map((id) => named.get(id)).find(Boolean) ?? readableName(concept.id.replace(/^HRA:/, ''));
  if (!name) throw new Error(`${concept.id}: no name could be derived`);
  concept.name = name;
  concepts += 1;
}

fs.writeFileSync(path, JSON.stringify(atlas));
console.log(`${filename}: named ${parts} structures and ${concepts} concepts from their source identifiers.`);
