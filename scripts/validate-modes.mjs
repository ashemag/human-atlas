/** Check that every focused study mode stays focused.
 *
 * A mode is only worth having if entering it downloads its systems and nothing
 * else. Concepts routinely cross systems — the heart concept reaches into
 * muscular, arterial and venous geometry — so a mode whose focus resolves to
 * no part inside its own systems would fall back to the full element list and
 * quietly pull in everything it was meant to avoid.
 *
 *   node scripts/validate-modes.mjs [atlas.json]
 */
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {MODES,SYSTEMS} from '../app/anatomy.ts';

const BUDGET_BYTES=5e6;
const filename=process.argv[2]??'atlas.json';
const atlas=JSON.parse(await readFile(new URL(`../public/models/${filename}`,import.meta.url)));
const parts=new Map(atlas.parts.map(p=>[p.id,p]));
const concepts=new Map(atlas.concepts.map(c=>[c.id,c]));
const known=new Set(SYSTEMS.map(s=>s.id));
const present=new Set(atlas.parts.map(p=>p.system));

assert.equal(new Set(MODES.map(m=>m.id)).size,MODES.length,'Duplicate mode id');
for(const mode of MODES){
 assert.ok(mode.name.trim()&&mode.summary.trim(),`${mode.id}: needs a name and a summary`);
 assert.ok(mode.systems.length,`${mode.id}: no systems`);
 for(const system of mode.systems)assert.ok(known.has(system),`${mode.id}: unknown system ${system}`);
 if(!mode.systems.every(s=>present.has(s)))continue; // Not represented in this atlas; the UI hides it.

 const focus=concepts.get(mode.focus);
 assert.ok(focus,`${mode.id}: focus concept ${mode.focus} is missing`);
 const inside=focus.elements.filter(id=>mode.systems.includes(parts.get(id)?.system));
 assert.ok(inside.length,`${mode.id}: focus "${focus.name}" has no part inside ${mode.systems.join(', ')}`);

 for(const id of mode.tour){
  const concept=concepts.get(id);
  assert.ok(concept,`${mode.id}: tour concept ${id} is missing`);
  assert.ok(concept.elements.some(e=>mode.systems.includes(parts.get(e)?.system)),`${mode.id}: tour concept "${concept.name}" lies outside the mode`);
 }

 const bytes=atlas.chunks.filter(c=>mode.systems.includes(c.system)).reduce((sum,c)=>sum+(c.gzipBytes??c.bytes),0);
 assert.ok(bytes>0,`${mode.id}: no chunks serve ${mode.systems.join(', ')}`);
 assert.ok(bytes<=BUDGET_BYTES,`${mode.id}: downloads ${(bytes/1e6).toFixed(1)} MB, over the ${(BUDGET_BYTES/1e6).toFixed(0)} MB budget`);
 console.log(`  ${mode.name.padEnd(13)} ${mode.systems.join(', ').padEnd(14)} ${(bytes/1e6).toFixed(2)} MB · focus "${focus.name}" (${inside.length}/${focus.elements.length} pieces in mode) · ${mode.tour.length} tour concepts`);
}
console.log(`Verified ${MODES.length} focused study modes.`);
