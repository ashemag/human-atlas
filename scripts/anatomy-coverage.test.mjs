import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {nameMatches,summarizeAtlas,coverageReport,parseTsv} from './anatomy-coverage.mjs';

test('matches side-qualified anatomical names without conflating neighboring muscles',()=>{
 assert.ok(nameMatches('Left RECTUS-abdominis',['rectus abdominis']));
 assert.ok(nameMatches('Set of lumbar multifidi',['multifidus','multifidi']));
 assert.ok(!nameMatches('Left iliococcygeus',['coccygeus']));
 assert.ok(!nameMatches('Urethral sphincter',['urethra']));
 assert.ok(!nameMatches(null,['multifidus']));
});
test('a concept referring to another muscle is not evidence of a separate mesh',()=>{
 const a={parts:[{id:'oblique',name:'External oblique',system:'muscular'}],concepts:[{id:'rectus',name:'Rectus abdominis',elements:['oblique']}]};
 const r=summarizeAtlas(a,{aliases:['rectus abdominis']});
 assert.equal(r.status,'concept_only');assert.equal(r.parts.length,0);assert.deepEqual(r.concepts[0].elements,['oblique']);
 assert.equal(summarizeAtlas(a,{aliases:['multifidus']}).status,'not_separately_identified');
});
test('retains source mappings and explicit exclusions independently of app discoverability',()=>{
 const empty={parts:[],concepts:[]};
 const report=coverageReport({female:empty},{names:[['FMA1','BP1','Left puborectalis']],elements:[['FMA1','Left puborectalis','FJ1']]},[{id:'FJ1',name:'Left puborectalis'}],[{id:'FJ1',name:'Left puborectalis',reason:'omitted'}]);
 const r=report.find(x=>x.id==='puborectalis');
 assert.equal(r.atlases.female.status,'not_separately_identified');assert.deepEqual(r.source.elementIds,['FJ1']);assert.equal(r.source.archiveMeshes.length,1);assert.equal(r.excluded.length,1);
});
test('parses official tabular data with CRLF and blank fields',()=>{
 assert.deepEqual(parseTsv('id\tname\tmesh\r\nFMA1\t\tFJ1\r\n'),[['FMA1','','FJ1']]);
});
test('bundled male atlas retains every official archive mesh ID',()=>{
 const read=p=>JSON.parse(fs.readFileSync(new URL(p,import.meta.url)));
 const source=read('../data/anatomy/sources/mesh-name-index.json');const male=read('../public/models/atlas.json');
 assert.equal(new Set(source.map(m=>m.id)).size,source.length);
 assert.deepEqual(source.map(m=>m.id).sort(),male.parts.map(m=>m.id).sort());
 assert.ok(source.some(m=>m.name===null),'Preserve the source’s unnamed meshes as unresolved labels');
});
