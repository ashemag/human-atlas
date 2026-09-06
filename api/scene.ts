/** Shared vocabulary between the model, the server validator, and the renderer. */
export type Side = 'left' | 'right' | 'both';
export type Role = 'primary' | 'secondary';
export type View = 'three-quarter' | 'front' | 'back' | 'side';

/** What the model is allowed to say. */
export interface ModelFocus {conceptId: string; name: string; side: Side; role: Role; label: string}
export interface ModelScene {
  focus: ModelFocus[];
  systems: string[];
  view: View;
  unmodeled: string[];
  answer: string;
}

/** What the renderer receives: ids resolved to meshes, names taken from the atlas. */
export interface ResolvedFocus {
  conceptId: string;
  name: string;
  side: Side;
  role: Role;
  label: string;
  parts: string[];
}
export interface Scene {
  focus: ResolvedFocus[];
  systems: string[];
  view: View;
  unmodeled: string[];
  answer: string;
  /** Structures the model named that failed validation. Surfaced, never silent. */
  rejected: {name: string; conceptId: string; reason: string}[];
}

export interface CatalogEntry {
  name: string;
  display?: string;
  elements: string[];
  systems: string[];
  sides: {left?: string; right?: string};
}
export interface Catalog {
  version: string;
  catalog: string;
  resolve: Record<string, CatalogEntry>;
  systems: string[];
}

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();

/** Meshes for one concept at one side.
 *
 * A sided request resolves through the side map rather than the parent, so
 * "left kidney" yields one mesh instead of two. `both` unions the sides when
 * they exist because a synthesized pair's canonical entry only carries one
 * side's meshes in `elements`.
 */
function meshesFor(entry: CatalogEntry, side: Side, resolve: Record<string, CatalogEntry>): string[] {
  const {left, right} = entry.sides;
  if (side === 'left' && left) return resolve[left]?.elements ?? entry.elements;
  if (side === 'right' && right) return resolve[right]?.elements ?? entry.elements;
  if (side === 'both' && left && right) {
    return [...new Set([...(resolve[left]?.elements ?? []), ...(resolve[right]?.elements ?? [])])];
  }
  return entry.elements;
}

/** Validate the model's scene against the atlas.
 *
 * Two checks, because they catch different failures. An id that does not exist
 * is an invented id. An id whose name disagrees with the atlas is a near-miss -
 * the model reached for a real neighbour of what it meant - and only the name
 * echo catches that. Labels rendered on screen always come from the atlas.
 */
let nameIndex: Map<string, string> | null = null;
/** Name to id, for repairing a near-miss. Built once, lazily. */
function indexNames(catalog: Catalog) {
  if (nameIndex) return nameIndex;
  nameIndex = new Map();
  for (const [id, entry] of Object.entries(catalog.resolve)) {
    const key = norm(entry.display ?? entry.name);
    if (!nameIndex.has(key)) nameIndex.set(key, id);
  }
  return nameIndex;
}

export function validateScene(model: ModelScene, catalog: Catalog): Scene {
  const focus: ResolvedFocus[] = [];
  const rejected: Scene['rejected'] = [];
  const seen = new Set<string>();
  const meshSignatures = new Set<string>();

  for (const item of model.focus ?? []) {
    let conceptId = item.conceptId;
    let entry = catalog.resolve[conceptId];

    // A mismatch means the model reached for a real neighbour of what it meant.
    // The name is the reliable half of the pair - it is what the model was
    // actually thinking - so prefer the id that name belongs to.
    if (entry && norm(item.name) !== norm(entry.display ?? entry.name)) {
      const corrected = indexNames(catalog).get(norm(item.name));
      if (corrected) { conceptId = corrected; entry = catalog.resolve[corrected]; }
      else {
        rejected.push({name: item.name, conceptId, reason: `id is "${entry.display ?? entry.name}"`});
        continue;
      }
    }
    if (!entry) {
      const corrected = indexNames(catalog).get(norm(item.name));
      if (!corrected) {
        rejected.push({name: item.name, conceptId, reason: 'no such structure in this atlas'});
        continue;
      }
      conceptId = corrected;
      entry = catalog.resolve[corrected];
    }

    const side: Side = item.side === 'left' || item.side === 'right' ? item.side : 'both';
    const key = `${conceptId}:${side}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const parts = meshesFor(entry, side, catalog.resolve);
    const truth = entry.display ?? entry.name;
    if (!parts.length) {
      rejected.push({name: truth, conceptId, reason: 'no geometry'});
      continue;
    }
    // Near-synonyms in FMA ("anterior abdominal wall", "musculature of anterior
    // abdominal wall") resolve to the same meshes; showing them separately just
    // stacks duplicate labels on one piece of geometry.
    const signature = [...parts].sort().join(',');
    if (meshSignatures.has(signature)) continue;
    meshSignatures.add(signature);

    focus.push({
      conceptId,
      name: truth,
      side,
      role: item.role === 'secondary' ? 'secondary' : 'primary',
      label: item.label?.trim() || truth,
      parts,
    });
  }

  const systems = (model.systems ?? []).filter((s) => catalog.systems.includes(s));
  const views: View[] = ['three-quarter', 'front', 'back', 'side'];
  return {
    focus,
    systems: systems.length ? systems : [...new Set(focus.flatMap((f) => catalog.resolve[f.conceptId].systems))],
    view: views.includes(model.view) ? model.view : 'three-quarter',
    unmodeled: (model.unmodeled ?? []).filter((s) => typeof s === 'string' && s.trim()).slice(0, 6),
    answer: (model.answer ?? '').trim(),
    rejected,
  };
}
