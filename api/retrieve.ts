import type {Catalog} from './scene';

export interface CatalogRow {conceptId: string; name: string; system: string; meshes: number; paired: boolean}

/** Parse the generated catalog back into rows for retrieval. */
export function readRows(catalog: Catalog): CatalogRow[] {
  const rows: CatalogRow[] = [];
  let system = '';
  for (const line of catalog.catalog.split('\n')) {
    if (line.startsWith('## ')) { system = line.slice(3).trim(); continue; }
    if (!line.includes('\t')) continue;
    const [conceptId, label, meshes] = line.split('\t');
    rows.push({
      conceptId,
      name: label.replace(' [L/R]', ''),
      system,
      meshes: Number(meshes) || 1,
      paired: label.includes('[L/R]'),
    });
  }
  return rows;
}

const STOP = new Set(['of', 'the', 'a', 'an', 'and', 'in', 'to', 'my', 'is', 'are', 'part', 'zone', 'segment', 'branch', 'left', 'right', 'body']);
/** Crude singularisation. People ask about "obliques" and "kidneys"; the atlas
 * names them "external oblique" and "kidney". Applied to both sides, so it only
 * has to be consistent, not linguistically correct. */
const stem = (word: string) => (word.length > 4 && word.endsWith('ies') ? `${word.slice(0, -3)}y`
  : word.length > 3 && word.endsWith('s') && !word.endsWith('ss') ? word.slice(0, -1) : word);
const words = (text: string) => text.toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').split(/[\s-]+/)
  .filter((w) => w.length > 2 && !STOP.has(w)).map(stem);
const stemmed = (text: string) => words(text).join(' ');

/** Inverse document frequency over catalog names, so "kidney" outweighs "artery". */
function buildIdf(rows: CatalogRow[]) {
  const seen = new Map<string, number>();
  for (const row of rows) for (const word of new Set(words(row.name))) seen.set(word, (seen.get(word) ?? 0) + 1);
  const idf = new Map<string, number>();
  for (const [word, count] of seen) idf.set(word, Math.log(rows.length / count));
  return idf;
}

export interface Shortlist {rows: CatalogRow[]; absent: string[]}

/** Score catalog rows against the structures the model proposed.
 *
 * The proposed names come from the model's own anatomical knowledge, so this is
 * a lexical join between "what is involved in a pushup" and "what this atlas
 * happens to contain". A proposed name that scores nothing anywhere is reported
 * as absent - which is a firmer signal than asking the model to notice a gap in
 * a long list, because it is measured rather than observed.
 */
export function shortlist(rows: CatalogRow[], proposed: string[], question: string, limit = 160): Shortlist {
  const idf = buildIdf(rows);
  const scores = new Map<string, number>();
  const absent: string[] = [];

  const add = (id: string, score: number) => scores.set(id, Math.max(scores.get(id) ?? 0, score));

  for (const raw of proposed) {
    const term = raw.toLowerCase().trim();
    if (!term) continue;
    const termWords = words(term);
    if (!termWords.length) continue;
    let best = 0;
    for (const row of rows) {
      const name = row.name.toLowerCase();
      const nameStem = stemmed(name), termStem = stemmed(term);
      let score = 0;
      if (name === term || nameStem === termStem) score = 100;
      else if (name.includes(term) || (termStem && nameStem.includes(termStem))) score = 60 + term.length / name.length * 20;
      else {
        const rowWords = new Set(words(name));
        let overlap = 0, total = 0;
        for (const word of termWords) {
          total += idf.get(word) ?? 1;
          if (rowWords.has(word)) overlap += idf.get(word) ?? 1;
        }
        if (overlap > 0) score = (overlap / Math.max(total, 0.001)) * 40;
      }
      // A broad grouping is a worse answer than a specific structure.
      if (score > 0) score -= Math.log10(row.meshes + 1) * 3;
      if (score > 0) { add(row.conceptId, score); best = Math.max(best, score); }
    }
    if (best < 25) absent.push(raw.trim());
  }

  // Loose terms straight from the question, so an unproposed structure named
  // outright by the user still surfaces.
  for (const word of words(question)) {
    for (const row of rows) {
      if (words(row.name).includes(word)) add(row.conceptId, 20 - Math.log10(row.meshes + 1) * 3);
    }
  }

  const byId = new Map(rows.map((r) => [r.conceptId, r]));
  const ranked = [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([id]) => byId.get(id)!)
    .filter(Boolean);
  return {rows: ranked, absent};
}

/** Does this atlas contain anything by this name?
 *
 * Used to check the model's own "not in this model" claims before they reach
 * the user. Saying a structure is missing when it is present is worse than not
 * finding it, so the claim is verified rather than trusted.
 */
/** Category words. People say "oblique muscles" where the atlas says "external
 * oblique", so the head word carries no evidence either way. */
const GENERIC = new Set(['muscle', 'nerve', 'bone', 'artery', 'vein', 'organ', 'tissue', 'group', 'region', 'area', 'joint', 'gland', 'tendon', 'ligament']);

export function present(rows: CatalogRow[], term: string): boolean {
  const needle = stemmed(term);
  if (!needle) return false;
  if (rows.some((row) => {
    const name = stemmed(row.name);
    return name === needle || name.includes(needle) || needle.includes(name);
  })) return true;

  // Phrase matching alone misses "oblique muscles" against "external oblique".
  // Requiring every distinguishing word to land in one name is what separates
  // that from "rectus abdominis", whose "rectus" is shared only with the eye's
  // lateral rectus, and from "sciatic nerve", which shares nothing at all.
  const distinguishing = words(term).filter((word) => !GENERIC.has(word));
  if (!distinguishing.length) return false;
  return rows.some((row) => {
    const name = new Set(words(row.name));
    return distinguishing.every((word) => name.has(word));
  });
}

/** Compact system overview, so the model always knows the shape of the atlas. */
export function systemIndex(rows: CatalogRow[]): string {
  const tally = new Map<string, number>();
  for (const row of rows) tally.set(row.system, (tally.get(row.system) ?? 0) + 1);
  return [...tally].sort((a, b) => b[1] - a[1]).map(([system, n]) => `${system} (${n})`).join(', ');
}

export function renderRows(rows: CatalogRow[]): string {
  const grouped = new Map<string, CatalogRow[]>();
  for (const row of rows) {
    if (!grouped.has(row.system)) grouped.set(row.system, []);
    grouped.get(row.system)!.push(row);
  }
  const lines: string[] = [];
  for (const [system, group] of grouped) {
    lines.push(`## ${system}`);
    for (const row of group.sort((a, b) => a.name.localeCompare(b.name))) {
      lines.push(`${row.conceptId}\t${row.name}${row.paired ? ' [L/R]' : ''}\t${row.meshes}`);
    }
  }
  return lines.join('\n');
}
