export const SELECTION_COLORS = [
  { id: "teal", name: "Teal", color: "#42aaa2", edge: "#7bdccc" },
  { id: "blue", name: "Sky blue", color: "#619bd1", edge: "#a3cfff" },
  { id: "violet", name: "Lavender", color: "#9a83c8", edge: "#d1b9f2" },
  { id: "amber", name: "Amber", color: "#c49b4b", edge: "#f3d496" },
  { id: "coral", name: "Coral", color: "#d38976", edge: "#ffc4ae" },
  { id: "rose", name: "Rose", color: "#c782a7", edge: "#f2b9d7" },
] as const;

export type SelectionColorId = (typeof SELECTION_COLORS)[number]["id"];
export const SELECTION_COLOR_STORAGE_KEY = "anatolume.selectionColor";

export function selectionColorPreset(id: unknown) {
  return SELECTION_COLORS.find((preset) => preset.id === id) ?? SELECTION_COLORS[0];
}

export function readSelectionColor(storage?: Pick<Storage, "getItem">): SelectionColorId {
  try {
    return selectionColorPreset(storage?.getItem(SELECTION_COLOR_STORAGE_KEY)).id;
  } catch {
    return SELECTION_COLORS[0].id;
  }
}
