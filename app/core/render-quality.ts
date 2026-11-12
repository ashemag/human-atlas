export const RENDER_QUALITY_STORAGE_KEY = "anatolume.renderQuality";
export type RenderQuality = "sharp" | "balanced" | "smooth";

export function readRenderQuality(storage?: Pick<Storage, "getItem">): RenderQuality {
  try {
    const value = storage?.getItem(RENDER_QUALITY_STORAGE_KEY);
    return value === "sharp" || value === "smooth" ? value : "balanced";
  } catch {
    return "balanced";
  }
}

// Keep the previous pixel-ratio limits as the default on both screen sizes.
export function renderPixelRatio(quality: RenderQuality, deviceRatio: number, compact: boolean): number {
  const ratio = Number.isFinite(deviceRatio) && deviceRatio > 0 ? deviceRatio : 1;
  if (quality === "smooth") return Math.min(ratio * 0.8, 1);
  const cap = quality === "sharp" ? (compact ? 2 : 3) : (compact ? 1.5 : 2);
  return Math.min(ratio, cap);
}
