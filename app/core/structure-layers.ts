import type { Atlas, Concept, SceneState, SystemId } from "./anatomy.ts";

// Explicit visibility overrides take precedence over selection and privacy rules.
export function hideSelectedStructure(state: SceneState): SceneState {
  if (!state.selected.length) return state;
  return {
    ...state,
    selected: [],
    isolate: false,
    focus: 0,
    focusContext: false,
    rotate: false,
    partVisibility: {
      ...state.partVisibility,
      ...Object.fromEntries(state.selected.map((id) => [id, false])),
    },
  };
}

// The source data has system membership and concept IDs, but no reliable
// parent/child organ tree. List its actual structures without inventing one.
export function systemStructures(atlas: Atlas | null): Map<SystemId, Concept[]> {
  const systems = new Map<SystemId, Map<string, Concept>>();
  const concepts = new Map(atlas?.concepts.map((c) => [c.id, c]));
  for (const part of atlas?.parts ?? []) {
    let structures = systems.get(part.system);
    if (!structures) systems.set(part.system, structures = new Map());
    const id = part.conceptId || part.id;
    let structure = structures.get(id);
    if (!structure) structures.set(id, structure = { id, name: concepts.get(id)?.name ?? part.name, elements: [] });
    if (!structure.elements.includes(part.id)) structure.elements.push(part.id);
  }
  return new Map([...systems].map(([id, structures]) => [id, [...structures.values()]]));
}

export function clearStructureOverrides(overrides: Readonly<Record<string, boolean>> | undefined, ids: readonly string[]) {
  const next = { ...overrides };
  for (const id of ids) delete next[id];
  return next;
}

// A system switch is an explicit viewing request, including its private parts.
// Only protected parts need overrides; ordinary parts follow the system layer.
export function explicitSystemOverrides(
  atlas: Atlas | null, system: SystemId, enabled: boolean,
  hidden: ReadonlySet<string>, overrides?: Readonly<Record<string, boolean>>,
) {
  const ids = atlas?.parts.filter((part) => part.system === system).map((part) => part.id) ?? [];
  const next = clearStructureOverrides(overrides, ids);
  if (enabled) for (const id of ids) if (hidden.has(id)) next[id] = true;
  return next;
}
