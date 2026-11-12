import type { Atlas, Concept } from "./anatomy.ts";
import type { ModelId } from "./model-catalogue.ts";

// Whole-organ concepts include every component mesh; paired organs use one side.
const COMMON = [
  "FMA7088", "FMA50801", "FMA7197", "FMA7148", "FMA7196", "FMA7198",
  "FMA7202", "FMA7394", "FMA7131", "FMA15900", "FMA7200", "FMA7201",
  "FMA7309", "FMA7310", "FMA7204", "FMA7205", "FMA9607",
];
const SPECIFIC: Record<ModelId, string[]> = {
  male: ["FMA7211", "FMA7212", "FMA9600"],
  female: ["HRA:VH_F_left_ovary", "HRA:VH_F_right_ovary", "HRA:VH_F_uterus"],
};

export function randomOrganCandidates(atlas: Atlas | null, model: ModelId): Concept[] {
  if (!atlas || atlas.sex !== model) return [];
  const parts = new Set(atlas.parts.map((part) => part.id));
  const concepts = new Map(atlas.concepts.map((concept) => [concept.id, concept]));
  return [...new Set([...COMMON, ...SPECIFIC[model]])].flatMap((id) => {
    const concept = concepts.get(id);
    return concept?.elements.length && concept.elements.every((element) => parts.has(element)) ? [concept] : [];
  });
}

export function pickRandomOrgan(
  candidates: Concept[], currentId?: string, previousId?: string, random = Math.random,
): Concept | undefined {
  if (!candidates.length) return undefined;
  const preferred = candidates.filter((concept) => concept.id !== currentId && concept.id !== previousId);
  // With two candidates excluded, prioritize avoiding the last random result.
  const withoutPrevious = candidates.filter((concept) => concept.id !== previousId);
  const available = preferred.length ? preferred : withoutPrevious.length ? withoutPrevious : candidates;
  return available[Math.floor(random() * available.length)];
}
