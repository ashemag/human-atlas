export const LOCALES = [
  { id: "zh-CN", label: "简体中文" },
  { id: "en", label: "English" },
  { id: "es", label: "Español" },
  { id: "ja", label: "日本語" },
  { id: "ko", label: "한국어" },
] as const;

export type Locale = (typeof LOCALES)[number]["id"];
export type AddedLocale = "es" | "ja" | "ko";
export function isLocale(value: unknown): value is Locale {
  return LOCALES.some((locale) => locale.id === value);
}
// Shared by all search surfaces, including accent-insensitive Spanish queries.
export function normalizeSearch(value: string) {
  return value.normalize("NFKC").toLowerCase().normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "").normalize("NFC").trim();
}
