/** Verify a manifest against its binaries.
 *
 *   node scripts/validate-atlas.mjs [atlas.json]
 */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const filename=process.argv[2]??'atlas.json';
const base=new URL('../public/models/',import.meta.url),atlas=JSON.parse(fs.readFileSync(new URL(filename,base)));
assert.ok(atlas.parts.length>0&&atlas.concepts.length>0);
const ids=new Set(atlas.parts.map(p=>p.id));assert.equal(ids.size,atlas.parts.length);
const files=atlas.chunks.map(c=>{const b=fs.readFileSync(new URL(path.basename(c.url),base));assert.equal(b.length,c.bytes);return b;});
let tris=0;
for(const p of atlas.parts){assert.ok(p.name.trim()&&p.name!=='-'&&!p.name.includes('Bounds('));assert.ok(p.conceptId!=='-');assert.ok(p.system);const b=files[p.chunk];assert.ok(p.indices+p.indexCount*4<=b.length);const pos=new Float32Array(b.buffer,b.byteOffset+p.positions,p.vertexCount*3),indices=new Uint32Array(b.buffer,b.byteOffset+p.indices,p.indexCount);assert.ok(indices.length>=3);for(const i of indices)assert.ok(i<p.vertexCount,`${p.id}: invalid vertex`);for(const value of pos)assert.ok(Number.isFinite(value));tris+=p.indexCount/3;}
for(const c of atlas.concepts){assert.ok(c.elements.length);for(const id of c.elements)assert.ok(ids.has(id),`${c.id}: missing ${id}`);}
assert.equal(tris,atlas.triangles);
// Chunks must stay system-pure, or a single system can no longer be fetched
// on its own and the focused study modes silently download everything.
const systems=new Set();
for(const [index,chunk] of atlas.chunks.entries()){
 const members=atlas.parts.filter(p=>p.chunk===index);
 assert.ok(members.length,`chunk ${index}: no parts`);
 const present=new Set(members.map(p=>p.system));
 assert.equal(present.size,1,`chunk ${index}: mixes ${[...present].join(', ')}`);
 assert.equal(chunk.system,members[0].system,`chunk ${index}: declares ${chunk.system}, holds ${members[0].system}`);
 assert.equal(chunk.parts,members.length,`chunk ${index}: declares ${chunk.parts} parts, holds ${members.length}`);
 systems.add(chunk.system);
}
assert.equal(systems.size,new Set(atlas.parts.map(p=>p.system)).size);
const gzip=atlas.chunks.reduce((sum,c)=>sum+(c.gzipBytes??c.bytes),0);
const largest=Math.max(...[...systems].map(s=>atlas.chunks.filter(c=>c.system===s).reduce((sum,c)=>sum+(c.gzipBytes??c.bytes),0)));
console.log(`Verified ${ids.size} individually indexed meshes, ${atlas.concepts.length} complete concept mappings, ${tris.toLocaleString()} triangles, and every binary buffer.`);
console.log(`${atlas.chunks.length} system-pure chunks across ${systems.size} systems: ${(gzip/1e6).toFixed(1)} MB for the whole body, ${(largest/1e6).toFixed(1)} MB for its largest single system.`);
