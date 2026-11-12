import fs from 'node:fs';
import assert from 'node:assert/strict';
import {gunzipSync} from 'node:zlib';
import {SYSTEMS} from '../app/core/anatomy.ts';
import {MODELS, isModelAtlas} from '../app/core/model-catalogue.ts';

const base = new URL('../public/', import.meta.url);
const expected = {male:{parts:2234, concepts:3432}, female:{parts:2245, concepts:4248}};
assert.ok(!process.argv[2] || Object.values(MODELS).some(config => config.manifest.endsWith('/'+process.argv[2])), 'Unknown model manifest');
for (const [model, config] of Object.entries(MODELS)) {
  if (process.argv[2] && !config.manifest.endsWith('/'+process.argv[2])) continue;
  const atlas = JSON.parse(fs.readFileSync(new URL('.'+config.manifest, base)));
  assert.ok(isModelAtlas(atlas, model), `Wrong model catalogue: ${model}`);
  assert.equal(atlas.parts.length, expected[model].parts);
  assert.equal(atlas.concepts.length, expected[model].concepts);
  const ids = new Set(atlas.parts.map(part => part.id));
  assert.equal(ids.size, atlas.parts.length);
  assert.equal(new Set(atlas.concepts.map(concept => concept.id)).size, atlas.concepts.length);
  const systems = new Set(SYSTEMS.map(system => system.id));
  const files = atlas.chunks.map(chunk => {
    const compressed = fs.readFileSync(new URL('.'+chunk.gzip, base));
    assert.equal(compressed.length, chunk.gzipBytes);
    const bytes = gunzipSync(compressed);
    assert.equal(bytes.length, chunk.bytes);
    const raw = new URL('.'+chunk.url, base);
    if (fs.existsSync(raw)) assert.deepEqual(bytes, fs.readFileSync(raw));
    return bytes;
  });
  let triangles = 0;
  for (const part of atlas.parts) {
    assert.ok(part.name.trim() && part.name !== '-' && !part.name.includes('Bounds('));
    assert.ok(part.conceptId && part.conceptId !== '-');
    assert.ok(systems.has(part.system), `Unknown system: ${part.system}`);
    const bytes = files[part.chunk];
    assert.ok(bytes && part.vertexCount > 0 && part.indexCount >= 3 && part.indexCount % 3 === 0);
    for (const [offset, length, alignment] of [[part.positions, part.vertexCount*12,4], [part.normals,part.vertexCount*6,2], [part.indices,part.indexCount*4,4]]) {
      assert.ok(Number.isInteger(offset) && offset >= 0 && offset % alignment === 0 && offset+length <= bytes.length, `${part.id}: invalid buffer span`);
    }
    const positions = new Float32Array(bytes.buffer, bytes.byteOffset+part.positions, part.vertexCount*3);
    const indices = new Uint32Array(bytes.buffer, bytes.byteOffset+part.indices, part.indexCount);
    for (const index of indices) assert.ok(index < part.vertexCount, `${part.id}: invalid vertex`);
    for (let index=0;index<positions.length;index++) {
      const value = positions[index], axis=index%3;
      assert.ok(Number.isFinite(value));
      assert.ok(value >= part.bounds[0][axis]-1e-5 && value <= part.bounds[1][axis]+1e-5, `${part.id}: outside bounds`);
    }
    if (model === 'female') assert.ok(part.provenance?.source && part.provenance.sourceId && part.provenance.adaptation, `${part.id}: missing source attribution`);
    triangles += part.indexCount/3;
  }
  for (const concept of atlas.concepts) {
    assert.ok(concept.elements.length);
    for (const id of concept.elements) assert.ok(ids.has(id), `${concept.id}: missing ${id}`);
  }
  assert.equal(triangles, atlas.triangles);
  console.log(`${model}: verified ${ids.size} meshes, ${atlas.concepts.length} concept mappings, ${triangles.toLocaleString()} triangles and every compressed buffer.`);
}
