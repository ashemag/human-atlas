// Run: node --experimental-strip-types --test scripts/female-category-toggle.test.mjs
// Explicit reviewed expectations prevent a source/generated category error from
// passing merely because the test derives its expected category from the atlas.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {SYSTEMS, DEFAULT_VISIBLE, partIsVisible} from '../app/anatomy.ts';
const read = path => JSON.parse(fs.readFileSync(new URL(path, import.meta.url)));
const atlas = read('../public/models/atlas-female-reconstructed.json');
const fit = read('../public/models/female-fit-report.json');
const source = read('../public/models/atlas-female.json');
const fixture = read('../data/anatomy/female-category-expectations.json');
const expected = new Map(Object.entries(fixture.expected).flatMap(([system, ids]) => ids.map(id => [id, system])));
const parts = new Map(atlas.parts.map(p => [p.id, p]));
const sourceParts = new Map(source.parts.map(p => [p.id, p]));
const ids = [...expected.keys()];
const base = {breastView:'tissue', explode:0, visible:[], selected:[], isolate:false, view:'front', rotate:false, reset:0};
const show = (p, state) => {
 const direct = partIsVisible(p, state);
 const cached = partIsVisible(p, state, {visible:new Set(state.visible), selected:new Set(state.selected)});
 assert.equal(cached, direct, `${p.id}: renderer lookup path disagrees with direct UI count path`);
 return direct;
};

test('the reviewed fixture covers exactly all 62 inserted IDs and both regenerated envelopes', () => {
 assert.equal(ids.length, 62);
 assert.equal(Object.values(fixture.expected).flat().length, 62, 'Expected groups must not duplicate an ID.');
 assert.deepEqual([...fit.added.map(p => p.id)].sort(), [...ids].sort());
 const inserted = atlas.parts.filter(p => p.provenance?.source !== 'BodyParts3D 4.0').map(p => p.id);
 assert.deepEqual(inserted.sort(), [...ids].sort(), 'No inserted source mesh may escape this audit.');
 assert.deepEqual([...fit.regenerated].sort(), [...fixture.regeneratedEnvelopes].sort());
 for (const id of fixture.regeneratedEnvelopes) assert.equal(expected.get(id), 'mammary');
});

test('each inserted structure has its reviewed category and a real active control-panel system', () => {
 const controls = new Map(SYSTEMS.map(s => [s.id, s]));
 for (const [id, system] of expected) {
  assert.ok(sourceParts.has(id), `${id}: missing HRA source entry`);
  assert.equal(parts.get(id)?.system, system, `${id}: incorrect primary category`);
  assert.equal(fit.added.find(p => p.id === id)?.system, system, `${id}: fit report differs`);
  assert.ok(controls.get(system)?.name, `${id}: missing named UI category`);
  assert.ok(atlas.parts.filter(p => p.system === system).length > 0, `${id}: category would be hidden by activeSystems`);
 }
});

test('every inserted part responds to exactly its primary system toggle in tissue view', () => {
 for (const [id, system] of expected) {
  const p = parts.get(id);
  assert.equal(show(p, base), false, `${id}: must hide when no layer is enabled`);
  for (const toggle of SYSTEMS) {
   assert.equal(show(p, {...base, visible:[toggle.id]}), toggle.id === system, `${id}: ${toggle.name} toggle`);
  }
 }
});

test('default female layers reveal all 56 non-surface inserted structures and keep six surfaces optional', () => {
 const s = {...base, visible:DEFAULT_VISIBLE};
 assert.equal(ids.filter(id => show(parts.get(id), s)).length, 56);
 for (const id of fixture.expected.integumentary) assert.equal(show(parts.get(id), s), false, id);
 for (const id of fixture.expected.integumentary) assert.equal(show(parts.get(id), {...s, visible:[...DEFAULT_VISIBLE,'integumentary']}), true, id);
});

test('chest presets reveal 10 tissue or 8 gland/support pieces, then hide all 16 breast pieces for pectorals', () => {
 const breasts = [...fixture.expected.mammary, ...fixture.expected.integumentary];
 // These are the final layer choices made by the three control-panel buttons.
 const tissue = {...base, breastView:'tissue', visible:['mammary','muscular']};
 const glands = {...base, breastView:'cutaway', visible:['mammary','muscular']};
 const pectorals = {...base, breastView:'muscle', visible:['muscular']};
 assert.deepEqual(breasts.filter(id => show(parts.get(id), tissue)).sort(), [...fixture.expected.mammary].sort());
 assert.deepEqual(breasts.filter(id => show(parts.get(id), glands)).sort(), fixture.expected.mammary.filter(id => !fixture.regeneratedEnvelopes.includes(id)).sort());
 for (const id of breasts) assert.equal(show(parts.get(id), pectorals), false, id);
 for (const p of atlas.parts.filter(p => p.system === 'muscular')) assert.equal(show(p, pectorals), true, p.id);
 for (const mode of ['cutaway','muscle']) {
  for (const id of [...fixture.expected.skeletal,...fixture.expected.reproductive]) {
   assert.equal(show(parts.get(id), {...base,breastView:mode,visible:[expected.get(id)]}), true, `${id}: unrelated female part hidden by chest mode`);
  }
 }
});

test('explicit selection and isolation can reveal every inserted part even when its category is disabled', () => {
 for (const id of ids) {
  for (const breastView of ['tissue','cutaway','muscle']) {
   const selected = {...base, breastView, selected:[id]};
   assert.equal(show(parts.get(id), selected), true, id);
   assert.equal(show(parts.get(id), {...selected,selected:[]}), false, id);
   const isolated = {...selected,isolate:true,visible:SYSTEMS.map(s => s.id)};
   assert.deepEqual(ids.filter(other => show(parts.get(other), isolated)), [id]);
  }
 }
});
