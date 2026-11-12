import * as T from "three";

export type DrawBatch = {
  mesh: T.Mesh;
  source: Uint32Array;
  index: T.BufferAttribute;
  spans: { part: number; start: number; count: number; visible: number }[];
};

// Keep original merged indices on the CPU; submit visible parts only.
export function updateDrawBatches(batches: DrawBatch[], partVisibility: Uint8Array) {
  for (const batch of batches) {
    if (!batch.spans.some((span) => span.visible !== partVisibility[span.part])) continue;
    const target = batch.index.array as Uint32Array;
    let count = 0;
    for (const span of batch.spans) {
      span.visible = partVisibility[span.part];
      if (!partVisibility[span.part]) continue;
      target.set(batch.source.subarray(span.start, span.start + span.count), count);
      count += span.count;
    }
    batch.mesh.visible = count > 0;
    batch.mesh.geometry.setDrawRange(0, count);
    // No upload or draw call is needed for an entirely hidden batch.
    if (count > 0) batch.index.needsUpdate = true;
  }
}
