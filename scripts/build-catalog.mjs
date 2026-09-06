/** Build the grounding catalog the language model selects from.
 *
 * Three reductions. None of them removes an id from `resolve`, so every
 * structure stays addressable; they only shape what the prompt lists.
 *  - Laterality collapse. "left kidney"/"right kidney" fold into "kidney" and
 *    the model returns a side. This removes the most likely near-miss: adjacent
 *    FMA ids differing only by side.
 *  - Deep structural variants ("trunk of branch of ...") drop out.
 *  - FMA's upper ontology drops out. "anatomical entity" covers all 2,234
 *    meshes and "artery" covers 562; offering those invites an answer that
 *    lights up half the body. Size alone does not separate them - "heart" is 83
 *    meshes and legitimate - so classes are matched by name.
 */
import {readFileSync, writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

const path = (rel) => fileURLToPath(new URL(rel, import.meta.url));
const atlas = JSON.parse(readFileSync(path('../public/models/atlas.json'), 'utf8'));
const parts = new Map(atlas.parts.map((p) => [p.id, p]));
const byName = new Map(atlas.concepts.map((c) => [c.name.toLowerCase(), c]));

const DEEP = /^(zone|part|segment|branch|tributary|surface|margin|border|wall|lumen|cavity|region|subdivision|set|trunk) of /i;
const LEADING_SIDE = /^(left|right) (.+)$/i;
const EMBEDDED_SIDE = /^(.*) (left|right) (.*)$/i;

/** FMA upper-ontology classes: real concepts, useless as visualization targets. */
const CLASS_TERMS = [
  /^(physical |material )?anatomical (entity|structure|cluster|set)$/i,
  /^(human body|body proper|body compartment|bodily fluid)$/i,
  /^organ( component| region| segment| part| cavity| subdivision)?$/i,
  /^cardinal (organ|body) part$/i,
  /^(long|short|flat|irregular|sesamoid|pneumatized) bone$/i,
  /^(head|neck|body|zone|region|segment) of organ$/i,
  /\b(organ|tree organ|organ component)$/i,
  /^(tissue|cell|portion of tissue|acellular anatomical structure)$/i,
  /^(artery|vein|nerve|muscle|bone|cartilage|ligament|lymphatic vessel|capillary)$/i,
  /^(vasculature|vascular tree|nerve tree|skeletal system|muscular system|cardiovascular system)/i,
  /^(anatomical|general|immaterial) /i,
];
/** Backstop for containers the name rules miss. */
const MAX_MESHES = 150;

function sideOf(concept) {
  const leading = concept.name.match(LEADING_SIDE);
  if (leading) {
    const parent = byName.get(leading[2].toLowerCase());
    if (parent) return {side: leading[1].toLowerCase(), parent};
  }
  const embedded = concept.name.match(EMBEDDED_SIDE);
  if (embedded) {
    const parent = byName.get(`${embedded[1]} ${embedded[3]}`.toLowerCase());
    if (parent) return {side: embedded[2].toLowerCase(), parent};
  }
  return null;
}

const systemsOf = (concept) => concept.elements.map((e) => parts.get(e)?.system).filter(Boolean);
/** One home per concept, so nothing is listed twice. */
function dominantSystem(concept) {
  const tally = new Map();
  for (const system of systemsOf(concept)) tally.set(system, (tally.get(system) ?? 0) + 1);
  return [...tally].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0];
}

const resolve = {};
for (const concept of atlas.concepts) {
  resolve[concept.id] = {
    name: concept.name,
    elements: concept.elements,
    systems: [...new Set(systemsOf(concept))],
    sides: {},
  };
}
let folded = 0;
for (const concept of atlas.concepts) {
  const variant = sideOf(concept);
  if (!variant) continue;
  resolve[variant.parent.id].sides[variant.side] = concept.id;
  folded++;
}

const isClass = (c) => CLASS_TERMS.some((re) => re.test(c.name)) || c.elements.length > MAX_MESHES;

/** Pairs like "left pectoralis major"/"right pectoralis major" that have no bare
 * parent concept. Synthesize one so the prompt carries a single sided entry
 * instead of two adjacent ids the model has to choose between. */
const orphanPairs = new Map();
for (const concept of atlas.concepts) {
  const leading = concept.name.match(LEADING_SIDE);
  if (!leading || byName.has(leading[2].toLowerCase())) continue;
  const bare = leading[2];
  if (!orphanPairs.has(bare)) orphanPairs.set(bare, {});
  orphanPairs.get(bare)[leading[1].toLowerCase()] = concept;
}
const synthesized = new Set();
let paired = 0;
for (const [bare, sides] of orphanPairs) {
  if (!sides.left || !sides.right) continue;
  const canonical = sides.right;
  resolve[canonical.id].display = bare;
  resolve[canonical.id].sides = {left: sides.left.id, right: sides.right.id};
  synthesized.add(canonical.id);
  synthesized.add(sides.left.id);
  paired++;
}

const hidden = {side: 0, deep: 0, klass: 0, paired: 0};
const listed = atlas.concepts.filter((c) => {
  if (sideOf(c)) { hidden.side++; return false; }
  if (synthesized.has(c.id)) {
    // Keep only the canonical half of a synthesized pair.
    if (resolve[c.id].display) return !DEEP.test(resolve[c.id].display) && !isClass({name: resolve[c.id].display, elements: c.elements});
    hidden.paired++; return false;
  }
  if (DEEP.test(c.name)) { hidden.deep++; return false; }
  if (isClass(c)) { hidden.klass++; return false; }
  return true;
});

const grouped = new Map();
for (const concept of listed) {
  const system = dominantSystem(concept);
  if (!system) continue;
  if (!grouped.has(system)) grouped.set(system, []);
  grouped.get(system).push(concept);
}

const displayOf = (c) => resolve[c.id].display ?? c.name;
const meshCount = (c) => {
  const {sides} = resolve[c.id];
  if (sides.left && sides.right) {
    return new Set([...resolve[sides.left].elements, ...resolve[sides.right].elements]).size;
  }
  return c.elements.length;
};

const lines = [];
for (const [system, concepts] of [...grouped].sort((a, b) => b[1].length - a[1].length)) {
  lines.push(`## ${system}`);
  for (const concept of concepts.sort((a, b) => displayOf(a).localeCompare(displayOf(b)))) {
    const {sides} = resolve[concept.id];
    const both = sides.left && sides.right ? ' [L/R]' : '';
    lines.push(`${concept.id}	${displayOf(concept)}${both}	${meshCount(concept)}`);
  }
  lines.push('');
}
const catalog = lines.join('\n');

writeFileSync(path('../api/catalog.json'), JSON.stringify({
  version: atlas.version,
  catalog,
  resolve,
  systems: [...grouped.keys()].sort(),
}));

console.log(`concepts total        ${atlas.concepts.length}`);
console.log(`hidden: side ${hidden.side}  deep ${hidden.deep}  upper-ontology ${hidden.klass}  merged-pairs ${hidden.paired}`);
console.log(`orphan L/R pairs merged ${paired}`);
console.log(`listed in prompt      ${listed.length} across ${grouped.size} systems`);
console.log(`catalog size          ${catalog.length} chars ~ ${Math.round(catalog.length / 3.6)} tokens`);
