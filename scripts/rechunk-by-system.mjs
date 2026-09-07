/** Repack atlas binaries so every chunk holds exactly one anatomical system.
 *
 * The published chunks are packing batches: chunk 11 alone spans ten systems,
 * so showing the kidneys still costs the whole 33 MB download. Part records
 * already carry explicit byte offsets and element counts, so the geometry can
 * be resliced out of the shipped buffers without the source OBJ archive.
 *
 * Part order is preserved: only `chunk` and the three byte offsets change.
 *
 *   node scripts/rechunk-by-system.mjs [atlas.json] [--target-bytes=4194304]
 */
import fs from 'node:fs';
import path from 'node:path';

const base = new URL('../public/models/', import.meta.url);
const args = process.argv.slice(2);
const filename = args.find((a) => !a.startsWith('--')) ?? 'atlas.json';
const targetBytes = Number(args.find((a) => a.startsWith('--target-bytes='))?.split('=')[1] ?? 4 * 1024 * 1024);
const atlas = JSON.parse(fs.readFileSync(new URL(filename, base)));
const prefix = atlas.sex === 'female' ? 'female' : 'body';

const align = (n) => (n + 3) & ~3;
const sources = atlas.chunks.map((c) => fs.readFileSync(new URL(path.basename(c.url), base)));
for (const [i, buffer] of sources.entries()) {
  if (buffer.length !== atlas.chunks[i].bytes) {
    throw new Error(`${atlas.chunks[i].url}: expected ${atlas.chunks[i].bytes} bytes, read ${buffer.length}`);
  }
}

/** Bytes a part occupies once repacked, with each section 4-byte aligned. */
const sizeOf = (p) => align(p.vertexCount * 12) + align(p.vertexCount * 6) + align(p.indexCount * 4);

// Group by system, keeping the original part order inside each group so that
// `partIndex` and the manifest stay in lockstep with the published atlas.
const bySystem = new Map();
for (const part of atlas.parts) {
  if (!bySystem.has(part.system)) bySystem.set(part.system, []);
  bySystem.get(part.system).push(part);
}

// A system larger than the target splits across several chunks; a small one
// still gets its own file so it can be fetched alone.
const groups = [];
for (const [system, parts] of bySystem) {
  let current = [];
  let bytes = 0;
  for (const part of parts) {
    const size = sizeOf(part);
    if (current.length && bytes + size > targetBytes) {
      groups.push({ system, index: groups.filter((g) => g.system === system).length, parts: current });
      current = [];
      bytes = 0;
    }
    current.push(part);
    bytes += size;
  }
  if (current.length) groups.push({ system, index: groups.filter((g) => g.system === system).length, parts: current });
}

const chunks = [];
const written = [];
for (const [index, group] of groups.entries()) {
  const total = group.parts.reduce((sum, p) => sum + sizeOf(p), 0);
  const out = Buffer.alloc(total);
  let cursor = 0;
  for (const part of group.parts) {
    const source = sources[part.chunk];
    const positions = part.vertexCount * 12;
    const normals = part.vertexCount * 6;
    const indices = part.indexCount * 4;
    source.copy(out, cursor, part.positions, part.positions + positions);
    part.positions = cursor;
    cursor += align(positions);
    source.copy(out, cursor, part.normals, part.normals + normals);
    part.normals = cursor;
    cursor += align(normals);
    source.copy(out, cursor, part.indices, part.indices + indices);
    part.indices = cursor;
    cursor += align(indices);
    part.chunk = index;
  }
  const name = `${prefix}-${group.system}-${group.index}.bin`;
  const url = `/models/${name}`;
  chunks.push({ url, bytes: out.length, system: group.system, parts: group.parts.length });
  written.push({ name, out });
}

// Only rewrite the directory once every buffer has been built successfully, and
// only ever touch this manifest's own chunks — the directory holds more than one
// atlas, and a prefix-blind sweep here deletes the other one's geometry.
const owned = new RegExp(`^${prefix}-.*\\.bin(\\.gz)?$`);
for (const file of fs.readdirSync(base)) {
  if (owned.test(file)) fs.unlinkSync(new URL(file, base));
}
for (const { name, out } of written) fs.writeFileSync(new URL(name, base), out);

atlas.chunks = chunks;
fs.writeFileSync(new URL(filename, base), JSON.stringify(atlas));

const bytes = chunks.reduce((sum, c) => sum + c.bytes, 0);
console.log(
  `Repacked ${atlas.parts.length} parts into ${chunks.length} system-pure chunks ` +
    `(${(bytes / 1e6).toFixed(1)} MB across ${bySystem.size} systems).`,
);
