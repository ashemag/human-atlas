import { gunzipSync } from "fflate";

/** Static hosts may serve .gz as a compressed response or as a gzip file.
 * Fetch already decodes Content-Encoding; inspect the payload to avoid decoding twice.
 */
export async function decodeModelResponse(
  response: Response,
  expectedBytes: number,
  compressed: boolean,
): Promise<ArrayBuffer> {
  if (!response.ok) throw new Error("An anatomy file could not be loaded.");
  const payload = await response.arrayBuffer(),
    signature = new Uint8Array(payload, 0, Math.min(2, payload.byteLength));
  const gzip = compressed && signature[0] === 0x1f && signature[1] === 0x8b;
  let buffer = payload;
  if (gzip) {
    if (typeof DecompressionStream !== "undefined") {
      buffer = await new Response(
        new Blob([payload]).stream().pipeThrough(new DecompressionStream("gzip")),
      ).arrayBuffer();
    } else {
      const decoded = gunzipSync(new Uint8Array(payload));
      buffer = decoded.buffer.slice(
        decoded.byteOffset,
        decoded.byteOffset + decoded.byteLength,
      ) as ArrayBuffer;
    }
  }
  if (buffer.byteLength !== expectedBytes)
    throw new Error("An anatomy file was incomplete. Please reload the viewer.");
  return buffer;
}
