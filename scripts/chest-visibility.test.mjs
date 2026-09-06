// Run: node --experimental-strip-types --test scripts/chest-visibility.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DEFAULT_VISIBLE, partIsVisible} from '../app/anatomy.ts';

const readAtlas = name => JSON.parse(fs.readFileSync(new URL(`../public/models/${name}`, import.meta.url)));
const female = readAtlas('atlas-female-reconstructed.json');
const male = readAtlas('atlas.json');
const allSystems = [...new Set(female.parts.map(p => p.system))];
const base = {breastView: 'tissue', explode: 0, visible: DEFAULT_VISIBLE, selected: [], isolate: false, view: 'front', rotate: false, reset: 0};
const state = changes => ({...base, ...changes});
const fat = female.parts.filter(p => /^VH_F_fat_[LR]$/.test(p.id));
const mammary = female.parts.filter(p => p.system === 'mammary');
const nippleSurface = female.parts.filter(p => p.system === 'integumentary' && /nipple|areola/i.test(p.id));
const oldVisibility = (p, s) => s.isolate ? s.selected.includes(p.id) : s.visible.includes(p.system) || s.selected.includes(p.id);

test('default tissue view preserves existing layer visibility for the bundled female model', () => {
 assert.equal(fat.length, 2, 'Both breast envelopes must exist for the preset tests to be meaningful.');
 assert.ok(mammary.length > fat.length, 'There must be internal breast structures to reveal.');
 for (const visible of [DEFAULT_VISIBLE, [], allSystems, ['muscular']]) {
  const s = state({visible});
  for (const p of female.parts) assert.equal(partIsVisible(p, s), oldVisibility(p, s), p.id);
 }
});

test('gland view removes both fat envelopes while retaining enabled internal breast structures', () => {
 const s = state({breastView: 'cutaway', visible: ['mammary']});
 for (const p of fat) assert.equal(partIsVisible(p, s), false, p.id);
 for (const p of mammary.filter(p => !fat.includes(p))) assert.equal(partIsVisible(p, s), true, p.id);
 const hidden = state({breastView: 'cutaway', visible: []});
 for (const p of mammary) assert.equal(partIsVisible(p, hidden), false, p.id);
});

test('pectoral view hides breast and nipple surfaces without hiding enabled skeletal muscles', () => {
 assert.ok(nippleSurface.length > 0, 'Nipple surfaces are present in the optional surface layer.');
 const s = state({breastView: 'muscle', visible: allSystems});
 for (const p of [...mammary, ...nippleSurface]) assert.equal(partIsVisible(p, s), false, p.id);
 for (const p of female.parts.filter(p => p.system === 'muscular')) assert.equal(partIsVisible(p, s), true, p.id);
});

test('search selection reveals hidden breast structures and clearing it restores the chest filter', () => {
 const selected = [fat[0].id, mammary.find(p => !fat.includes(p)).id];
 for (const breastView of ['cutaway', 'muscle']) {
  const s = state({breastView, selected, visible: []});
  for (const id of selected) {
   const p = female.parts.find(p => p.id === id);
   assert.equal(partIsVisible(p, s), true, id);
   assert.equal(partIsVisible(p, {...s, selected: []}), false, id);
  }
  assert.equal(partIsVisible(fat[1], s), false, 'Selection must not reveal the unselected opposite envelope.');
 }
});

test('isolation shows exactly selected parts across chest views, including hidden layers', () => {
 const selected = [fat[0].id, female.parts.find(p => p.system === 'skeletal').id];
 for (const breastView of ['tissue', 'cutaway', 'muscle']) {
  const s = state({breastView, selected, isolate: true, visible: []});
  assert.deepEqual(female.parts.filter(p => partIsVisible(p, s)).map(p => p.id).sort(), [...selected].sort());
  assert.equal(female.parts.filter(p => partIsVisible(p, {...s, selected: [], visible: allSystems})).length, 0);
 }
});

test('male visibility retains its previous semantics for every chest-view state', () => {
 const selected = male.parts.filter((_, i) => i % 37 === 0).map(p => p.id);
 const maleSystems = [...new Set(male.parts.map(p => p.system))];
 for (const breastView of ['tissue', 'cutaway', 'muscle']) {
  for (const visible of [[], DEFAULT_VISIBLE, maleSystems, ['skeletal']]) {
   for (const isolate of [false, true]) {
    const s = state({breastView, selected, visible, isolate});
    for (const p of male.parts) assert.equal(partIsVisible(p, s), oldVisibility(p, s), `${p.id}: ${breastView}/${isolate}`);
   }
  }
 }
});

test('visibility checks do not mutate the selection or enabled layers', () => {
 const selected = Object.freeze([fat[0].id]);
 const visible = Object.freeze(['mammary']);
 const s = Object.freeze(state({breastView: 'muscle', selected, visible}));
 assert.equal(partIsVisible(fat[0], s), true);
 assert.deepEqual(selected, [fat[0].id]);
 assert.deepEqual(visible, ['mammary']);
});
