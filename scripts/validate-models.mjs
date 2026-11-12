import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {MODELS, MODEL_STORAGE_KEY, defaultLayers, isModelAtlas, readModel, readRecent, recentKey} from '../app/core/model-catalogue.ts';
import {atlasTools} from '../app/core/agent-tools.ts';
import {chineseExplanation, displayName} from '../client/i18n/index.ts';
import {explanation} from '../app/core/anatomy.ts';

const base = new URL('../public/models/', import.meta.url);
const read = name => JSON.parse(fs.readFileSync(new URL(name, base), 'utf8'));
const male = read('atlas.json'), female = read('atlas-female.json');
const source = read('female-source.json'), report = read('female-fit-report.json');
assert.equal(source.revision, '9e0d710fcc1d467dc758d61d6f417231cb1472fe');
assert.equal(source.license, 'CC-BY-4.0');
const recorded = new Set(source.files.map(file => file.name));
for (const name of ['atlas-female.json','female-fit-report.json',...female.chunks.map(chunk => chunk.gzip.split('/').pop())]) assert.ok(recorded.has(name), `Missing import checksum: ${name}`);
for (const file of source.files) {
  const bytes = fs.readFileSync(new URL(file.name, base));
  assert.equal(bytes.length, file.bytes);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), file.sha256, `Imported geometry changed: ${file.name}`);
}
assert.equal(isModelAtlas(male,'female'),false);
assert.equal(isModelAtlas(female,'male'),false);
assert.equal(isModelAtlas({},'female'),false);
assert.ok(isModelAtlas(male,'male') && isModelAtlas(female,'female'));
assert.notEqual(MODELS.male.manifest, MODELS.female.manifest);
assert.ok(defaultLayers('female',female).includes('mammary'));
assert.ok(!defaultLayers('male',male).includes('mammary'));
assert.ok(!defaultLayers('female',female).includes('integumentary'));
assert.ok(defaultLayers('male',male).includes('reproductive'));
assert.ok(!defaultLayers('male',male,true).includes('reproductive'));
assert.ok(!defaultLayers('male',null,true).includes('reproductive'));
assert.ok(defaultLayers('female',female).includes('mammary'));
assert.ok(!defaultLayers('female',female,true).includes('mammary'));
assert.ok(!defaultLayers('female',null,true).includes('mammary'));
assert.ok(defaultLayers('female',female,true).includes('reproductive'));
const femaleIds = new Set(female.parts.map(part => part.id));
for (const {id} of report.excluded) assert.ok(!femaleIds.has(id), `Excluded male structure present: ${id}`);
for (const part of male.parts.filter(part => part.system === 'reproductive')) assert.ok(!femaleIds.has(part.id), `Male reproductive geometry leaked: ${part.id}`);
assert.equal(new Set(male.parts.map(part => part.system)).size,15);
assert.equal(new Set(female.parts.map(part => part.system)).size,16);
assert.ok(explanation('uterus','reproductive','female').includes('uterus'));
assert.doesNotMatch(chineseExplanation('uterus','reproductive','female'),/男性|精子/);
assert.equal(displayName('Left ovary','zh-CN'),'左卵巢');

for (const query of ['子宫','卵巢','输卵管','乳腺']) {
  let selected;
  const [find,inspect] = atlasTools(female,concept => { selected = concept; });
  const matches = find.execute({query});
  assert.ok(matches.length, `Female structure unavailable in Chinese search: ${query}`);
  inspect.execute({id:matches[0].id});
  assert.ok(selected.elements.every(id => femaleIds.has(id)));
}
const uterus = female.concepts.find(concept => concept.name === 'uterus');
assert.ok(uterus);
assert.throws(() => atlasTools(male,()=>{})[1].execute({id:uterus.id}), /not present/);

const values = new Map([[MODEL_STORAGE_KEY,'female'], [recentKey('female'),JSON.stringify([uterus.id])], ['human-atlas.recent',JSON.stringify(['FMA7088'])]]);
const storage = {getItem:key => values.get(key) ?? null};
assert.equal(readModel(storage),'female');
assert.equal(readModel(storage,'?model=male'),'male');
assert.equal(readModel(storage,'?model=female'),'female');
assert.equal(readModel({getItem:()=>{throw new Error('disabled');}}),'male');
assert.deepEqual(readRecent(storage,'male'),['FMA7088']);
assert.deepEqual(readRecent(storage,'female'),[uterus.id]);
values.set(recentKey('female'),'invalid json');
assert.deepEqual(readRecent(storage,'female'),[]);
assert.deepEqual(readRecent({getItem:()=>{throw new Error('disabled');}},'female'),[]);
console.log('Verified pinned female source hashes, sex-specific geometry, independent catalogues/layers/search/history, model preference and storage failure handling.');
