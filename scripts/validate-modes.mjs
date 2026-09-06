/** Check that every focused study mode stays focused.
 *
 * A mode is only worth having if it does something the system toggles cannot:
 * walk an ordered set of named structures inside a narrow set of systems, and
 * download nothing else. Concepts routinely cross systems — the heart concept
 * reaches into muscular, arterial and venous geometry — so a step resolving
 * outside its own mode would quietly pull in everything the mode avoids.
 *
 *   node scripts/validate-modes.mjs [atlas.json]
 */
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {EXPLANATIONS,MODES,SYSTEMS,tourFor} from '../app/anatomy.ts';

const BUDGET_BYTES=5e6;
const filename=process.argv[2]??'atlas.json';
const atlas=JSON.parse(await readFile(new URL(`../public/models/${filename}`,import.meta.url)));
const known=new Set(SYSTEMS.map(s=>s.id));
const present=new Set(atlas.parts.map(p=>p.system));

assert.equal(new Set(MODES.map(m=>m.id)).size,MODES.length,'Duplicate mode id');
for(const mode of MODES){
 assert.ok(mode.name.trim()&&mode.summary.trim(),`${mode.id}: needs a name and a summary`);
 assert.ok(mode.systems.length,`${mode.id}: no systems`);
 for(const system of mode.systems)assert.ok(known.has(system),`${mode.id}: unknown system ${system}`);
 assert.ok(mode.tour.length&&mode.tour.every(step=>step.length),`${mode.id}: every tour step needs at least one candidate`);
 if(!mode.systems.every(s=>present.has(s)))continue; // Not represented in this atlas; the UI hides it.

 // tourFor already drops steps that are absent or that reach outside the mode,
 // so what survives is exactly what a viewer of this atlas would be walked
 // through. A mode with nothing left is a mode that should not be offered.
 const tour=tourFor(atlas,mode);
 assert.ok(tour.length,`${mode.id}: no tour step resolves inside ${mode.systems.join(', ')} in ${filename}`);

 // A step whose name has no explanation falls back to the system overview, which
 // reads the same on every step of the walkthrough. Some Human Reference Atlas
 // names have no counterpart, so this reports coverage rather than failing.
 const explained=tour.filter(c=>EXPLANATIONS[c.name.toLowerCase()]).length;
 assert.ok(explained,`${mode.id}: no tour step has its own explanation in ${filename}`);

 const bytes=atlas.chunks.filter(c=>mode.systems.includes(c.system)).reduce((sum,c)=>sum+(c.gzipBytes??c.bytes),0);
 assert.ok(bytes>0,`${mode.id}: no chunks serve ${mode.systems.join(', ')}`);
 assert.ok(bytes<=BUDGET_BYTES,`${mode.id}: downloads ${(bytes/1e6).toFixed(1)} MB, over the ${(BUDGET_BYTES/1e6).toFixed(0)} MB budget`);
 console.log(`  ${mode.name.padEnd(13)} ${(bytes/1e6).toFixed(2).padStart(5)} MB · ${String(tour.length).padStart(2)}/${mode.tour.length} steps · ${explained}/${tour.length} explained · ${tour.map(c=>c.name).join(' → ')}`);
}
console.log(`${filename}: verified ${MODES.length} focused study modes.`);
