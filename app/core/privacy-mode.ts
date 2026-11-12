import type { Atlas, Part } from "./anatomy.ts";

export const PRIVACY_MODE_STORAGE_KEY = "anatolume.privacy-mode";

export function readPrivacyMode(storage?: Pick<Storage, "getItem">): boolean {
  try { return storage?.getItem(PRIVACY_MODE_STORAGE_KEY) === "true"; }
  catch { return false; }
}

export function privacyHiddenParts(atlas: Atlas | null, enabled: boolean): string[] {
  if (!enabled || !atlas || !atlas.sex) return [];
  // Genital vessels and nerves can belong to circulatory or nervous systems.
  return atlas.parts.filter((part) => atlas.sex === "male"
    ? part.system === "reproductive" || /\b(penis|penile|scrotum|scrotal|testis|testicular|epididymis|epididymal|prostate|prostatic|spermatic|deferent|seminal|bulbourethral)\b/i.test(part.name)
    // Preserve internal female organs, including the uterus, ovaries and vagina.
    : part.system === "mammary" || /\b(breast|mammary|nipples?|areolae?|lactiferous|vulva|vulvar|clitoris|clitoral|labia|labium)\b|\bareolar tubercle\b/i.test(part.name),
  ).map((part) => part.id);
}

export function isPartVisible(
  part: Part, visible: ReadonlySet<string>, selected: ReadonlySet<string>,
  isolate: boolean, hidden: ReadonlySet<string>,
  overrides?: Readonly<Record<string, boolean>>,
): boolean {
  if (overrides?.[part.id] === false) return false;
  // Explicit selection is allowed; default layers never reveal protected parts.
  if (selected.has(part.id)) return true;
  if (!isolate && overrides?.[part.id] === true) return true;
  return !isolate && visible.has(part.system) && !hidden.has(part.id);
}
