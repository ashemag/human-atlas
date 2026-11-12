/** Resolve atlas paths against the deployment directory, including Pages subpaths. */
export function staticAssetUrl(
  asset: string,
  base = import.meta.env.BASE_URL,
  documentUrl = document.baseURI,
): string {
  return new URL(asset.replace(/^\/+/, ""), new URL(base, documentUrl)).href;
}
