import { DEFAULT_VISIBLE, type Atlas, type SystemId } from "./anatomy.ts";

export type ModelId = "male" | "female";
export const MODEL_STORAGE_KEY = "anatolume.model";
export const MODELS = {
  male: { manifest: "/models/atlas.json", source: "BodyParts3D", experimental: false },
  female: { manifest: "/models/atlas-female.json", source: "BodyParts3D + HRA", experimental: true },
} as const;

export function readModel(storage?: Pick<Storage, "getItem">, query = ""): ModelId {
  const requested = new URLSearchParams(query).get("model");
  if (requested === "female" || requested === "male") return requested;
  try { return storage?.getItem(MODEL_STORAGE_KEY) === "female" ? "female" : "male"; }
  catch { return "male"; }
}

export function recentKey(model: ModelId) { return `anatolume.recent.${model}`; }
export function readRecent(storage: Pick<Storage, "getItem"> | undefined, model: ModelId): string[] {
  try {
    const saved: unknown = JSON.parse(storage?.getItem(recentKey(model)) ??
      (model === "male" ? storage?.getItem("human-atlas.recent") : null) ?? "[]");
    return Array.isArray(saved) ? [...new Set(saved.filter((id): id is string => typeof id === "string"))].slice(0, 6) : [];
  } catch { return []; }
}

export function defaultLayers(model: ModelId, atlas?: Atlas | null, privacyMode = false): SystemId[] {
  const available = atlas ? new Set(atlas.parts.map((part) => part.system)) : null;
  return DEFAULT_VISIBLE.filter((id) => !(privacyMode && (model === "male" ? id === "reproductive" : id === "mammary")) &&
    (available ? available.has(id) : id !== "mammary" || model === "female"));
}

// Reject a wrong model catalogue instead of falling back to male geometry.
export function isModelAtlas(value: unknown, model: ModelId): value is Atlas {
  if (!value || typeof value !== "object") return false;
  const atlas = value as Atlas;
  return atlas.sex === model && Array.isArray(atlas.parts) && atlas.parts.length > 0 &&
    Array.isArray(atlas.concepts) && atlas.concepts.length > 0 && Array.isArray(atlas.chunks) && atlas.chunks.length > 0;
}
