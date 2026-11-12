import fs from 'node:fs';

const base = new URL('../', import.meta.url);
const atlases = ['atlas.json', 'atlas-female.json'].map(name => JSON.parse(fs.readFileSync(new URL(`public/models/${name}`, base), 'utf8')));
const names = [...new Set(atlases.flatMap(atlas => [...atlas.parts, ...atlas.concepts].map(part => part.name)))].sort();
const lexicon = Object.fromEntries(fs.readFileSync(new URL('client/i18n/lexicon.txt', base), 'utf8')
  .split('\n').filter(line => !line.trim().startsWith('#')).join(' ')
  .split(';').map(entry => entry.trim()).filter(Boolean).map(entry => entry.split('=')));
const phrases = JSON.parse(fs.readFileSync(new URL('client/i18n/phrases.json', base), 'utf8'));
const phraseEntries = Object.entries(phrases).sort((a, b) => b[0].length - a[0].length);
const missing = new Set();

function simple(text) {
  const tokens = text.toLowerCase().replaceAll('-', ' ').match(/[a-z]+|\d+|[^\w\s]/g) ?? [];
  const result = [];
  for (let cursor = 0; cursor < tokens.length;) {
    const phrase = phraseEntries.find(([english]) => {
      const words = english.split(' ');
      return words.every((word, i) => tokens[cursor + i] === word);
    });
    if (phrase) { result.push(phrase[1]); cursor += phrase[0].split(' ').length; continue; }
    const token = tokens[cursor++];
    if (/^[a-z]+$/.test(token) && !lexicon[token]) missing.add(token);
    result.push(lexicon[token] ?? token);
  }
  return result.join('').replaceAll('肌肌', '肌').replaceAll('牙牙', '牙');
}

function translate(text) {
  const canonical = text.toLowerCase().trim();
  if (phrases[canonical]) return phrases[canonical];
  // Keep possessive relations explicit through reversed noun phrases, preserving all qualifiers.
  const components = canonical.split(/\s+of\s+/);
  return components.map(simple).reverse().join('的');
}

const terms = Object.fromEntries(names.map(name => [name, translate(name)]));
if (missing.size) throw new Error(`Untranslated anatomical stems: ${[...missing].sort().join(', ')}`);
fs.writeFileSync(new URL('client/i18n/terms.zh-CN.json', base), JSON.stringify(terms, null, 2) + '\n');
fs.writeFileSync(new URL('client/i18n/terms.metadata.json', base), JSON.stringify({
  status: 'draft', source: 'BodyParts3D 4.0 and HRA female study model English names',
  method: 'Offline anatomical stem dictionary, reviewed compound terms, and qualifier-preserving composition.',
  entries: names.length, models: atlases.map(atlas => ({sex:atlas.sex, parts:atlas.parts.length, concepts:atlas.concepts.length})),
  reviewNote: 'Full Chinese draft; not professionally reviewed. Preserve English names and source identifiers when correcting terms.',
}, null, 2) + '\n');
console.log(`Generated ${names.length} Chinese draft names; ${Object.keys(lexicon).length} anatomical stems, ${phraseEntries.length} compound terms.`);
