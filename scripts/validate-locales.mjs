import assert from 'node:assert/strict';
import fs from 'node:fs';
// TypeScript 7 does not yet expose the compiler API used by this validator.
import ts from '@typescript/typescript6';
import {displayName, text, searchText, readLocale, UI_ZH, LANGUAGE_STORAGE_KEY, LOCALES, normalizeSearch, structureExplanation} from '../client/i18n/index.ts';
import {UI_TRANSLATIONS} from '../client/i18n/ui.translations.ts';
import {anatomyGlossary, SYSTEM_NAMES} from '../client/i18n/anatomy.translations.ts';
import {anatomySearchIndex, matchedSearchAlias} from '../app/core/anatomy-search.ts';
import {randomOrganCandidates} from '../app/core/random-organ.ts';

const atlases = ['atlas.json', 'atlas-female.json'].map(name => JSON.parse(fs.readFileSync(new URL(`../public/models/${name}`, import.meta.url), 'utf8')));
const terms = JSON.parse(fs.readFileSync(new URL('../client/i18n/terms.zh-CN.json', import.meta.url), 'utf8'));
const names = new Set(atlases.flatMap(atlas => [...atlas.parts, ...atlas.concepts].map(part => part.name)));
assert.equal(Object.keys(terms).length, names.size);
const ordinals = {first:'第一',second:'第二',third:'第三',fourth:'第四',fifth:'第五',sixth:'第六',seventh:'第七',eighth:'第八',ninth:'第九',tenth:'第十',eleventh:'第十一',twelfth:'第十二'};
for (const english of names) {
  const chinese = terms[english];
  assert.ok(chinese?.trim(), `Missing term: ${english}`);
  assert.match(chinese, /[\u3400-\u9fff]/, `Not translated: ${english}`);
  assert.doesNotMatch(chinese, /[a-z]/i, `Untranslated token: ${english}`);
  for (const [word, translation] of Object.entries({left:'左',right:'右',...ordinals})) {
    if (new RegExp(`\\b${word}\\b`, 'i').test(english)) assert.ok(chinese.includes(translation), `Qualifier lost: ${english}`);
  }
  assert.equal(displayName(english, 'en'), english);
}
assert.equal(displayName('Heart', 'zh-CN'), '心脏');
assert.equal(displayName('Left femur', 'zh-CN'), '左股骨');
assert.equal(displayName('Right femur', 'zh-CN'), '右股骨');
assert.ok(searchText('Heart', 'FMA7088').includes('心脏'));
assert.ok(searchText('Heart', 'FMA7088').includes('fma7088'));
assert.equal(readLocale({getItem:key => key === LANGUAGE_STORAGE_KEY ? 'en' : null}), 'en');
assert.equal(readLocale({getItem:() => 'invalid'}), 'zh-CN');
assert.equal(readLocale({getItem:() => {throw new Error('Storage disabled');}}), 'zh-CN');
for (const [english, chinese] of Object.entries(UI_ZH)) {
  assert.ok(chinese.trim());
  assert.deepEqual([...english.matchAll(/\{(\w+)\}/g)].map(m=>m[1]).sort(), [...chinese.matchAll(/\{(\w+)\}/g)].map(m=>m[1]).sort());
}
assert.deepEqual(LOCALES.map(l=>l.id),['zh-CN','en','es','ja','ko']);
assert.deepEqual(Object.keys(UI_TRANSLATIONS).sort(),Object.keys(UI_ZH).sort(),'Every UI key is translated in all three added locales');
for (const {id:locale} of LOCALES) {
  assert.equal(readLocale({getItem:()=>locale}),locale,'Persisted locale round-trips without altering other preferences');
  assert.equal(displayName('Unverified anatomical branch',locale),'Unverified anatomical branch','Unverified anatomy is not guessed');
  if(locale==='en'||locale==='zh-CN') continue;
  for(const [key,values] of Object.entries(UI_TRANSLATIONS)) {
    const column={es:0,ja:1,ko:2}[locale];
    assert.ok(values[column]?.trim(),`${locale}: ${key}`);
    assert.deepEqual([...key.matchAll(/\{(\w+)\}/g)].map(m=>m[1]).sort(),[...values[column].matchAll(/\{(\w+)\}/g)].map(m=>m[1]).sort(),`${locale}: placeholders preserved`);
    assert.equal(text(key,locale),values[column]);
  }
  for(const [name,values] of Object.entries(anatomyGlossary)) {
    assert.equal(displayName(name,locale),displayName(name.toUpperCase(),locale),'Terminology lookup is case-insensitive');
    assert.ok(values.every(value=>value.trim()));
    if(name.startsWith('left ')) assert.ok(displayName(name,locale).includes({es:'izquierd',ja:'左',ko:'왼'}[locale]),`${locale}: left qualifier preserved`);
    if(name.startsWith('right ')) assert.ok(displayName(name,locale).includes({es:'derech',ja:'右',ko:'오른'}[locale]),`${locale}: right qualifier preserved`);
  }
  for(const atlas of atlases) {
    const index=anatomySearchIndex(atlas);
    for(const organ of randomOrganCandidates(atlas,atlas.sex)) assert.notEqual(displayName(organ.name,locale),organ.name,`${locale}: all random organs have localized names`);
    for(const system of Object.keys(SYSTEM_NAMES)) assert.ok(structureExplanation('unverified branch',system,atlas.sex,locale));
    for(const [query,id] of [[{es:'corazon',ja:'しんぞう',ko:'심장'}[locale],'FMA7088'],[{es:'femur izquierdo',ja:'左大腿骨',ko:'왼쪽 대퇴골'}[locale],'FMA24475']]) {
      assert.ok(index.get(id).searchable.includes(normalizeSearch(query)),`${locale}: translated or alias search reaches correct ID`);
    }
    assert.equal(index.get('FMA24474')?.searchable.includes(normalizeSearch({es:'femur izquierdo',ja:'左大腿骨',ko:'왼쪽 대퇴골'}[locale])),false,'Left alias never matches the right counterpart');
    assert.ok(structureExplanation('uterus','reproductive','female',locale).includes({es:'ovarios',ja:'卵巣',ko:'난소'}[locale]),'Female description never uses male overview');
  }
}
assert.equal(normalizeSearch('CORAZÓN'),normalizeSearch('corazon'));
assert.equal(text('{count} pieces','es',{count:1}),'1 componente');
assert.equal(text('{count} pieces','es',{count:2}),'2 componentes');
assert.equal(text('{count} matches','en',{count:1}),'1 match');
assert.equal(normalizeSearch('ＦＭＡ７０８８'),normalizeSearch('FMA7088'));
assert.ok(searchText('left femur','FMA24475').includes(normalizeSearch('대퇴골')));
assert.equal(matchedSearchAlias(anatomySearchIndex(atlases[0]).get('FMA24475'),'왼쪽 대퇴골'),'왼쪽 대퇴골');
assert.equal(text('Show only {name}', 'zh-CN', {name:'心脏'}), '仅显示心脏');
assert.equal(text('Anatolume', 'zh-CN'), '层知');
assert.equal(text('Anatolume', 'en'), 'Anatolume');
for (const name of ['app/page.tsx','app/scene.tsx','app/about.tsx','app/update-panel.tsx']) {
  const source = ts.createSourceFile(name, fs.readFileSync(new URL(`../${name}`, import.meta.url), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const visit = node => {
    if (ts.isCallExpression(node) && ['t','text'].includes(node.expression.getText(source)) && ts.isStringLiteral(node.arguments[0])) {
      assert.ok(UI_ZH[node.arguments[0].text], `Missing UI string: ${node.arguments[0].text}`);
    }
    if (ts.isJsxText(node) && /[a-z]/i.test(node.text)) {
      assert.ok(['BodyParts3D','English','3D'].includes(node.text.trim()), `Untranslated JSX text: ${node.text.trim()}`);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
}
console.log(`Verified ${names.size} Chinese draft terms, ${Object.keys(anatomyGlossary).length} three-language glossary entries, ${Object.keys(UI_ZH).length} UI strings, five-language search, qualifiers and language storage.`);
