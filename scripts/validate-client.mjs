import assert from 'node:assert/strict';
import fs from 'node:fs';
import {gzipSync} from 'node:zlib';
import {decodeModelResponse} from '../app/core/model-download.ts';
import {readVersions} from './release-version.mjs';
import {MODELS} from '../app/core/model-catalogue.ts';

const sample = new TextEncoder().encode('Anatolume · 心脏');
const gzip = gzipSync(sample);
const original = globalThis.DecompressionStream;
for (const native of [true, false]) {
  globalThis.DecompressionStream = native ? original : undefined;
  const decoded = await decodeModelResponse(new Response(gzip), sample.byteLength, true);
  assert.deepEqual(new Uint8Array(decoded), sample);
  const alreadyDecoded = await decodeModelResponse(new Response(sample, {headers:{'Content-Encoding':'gzip'}}), sample.byteLength, true);
  assert.deepEqual(new Uint8Array(alreadyDecoded), sample);
}
globalThis.DecompressionStream = original;
await assert.rejects(decodeModelResponse(new Response(sample, {status:404}), sample.byteLength, false));
await assert.rejects(decodeModelResponse(new Response(sample), sample.byteLength + 1, false), /incomplete/);
await assert.rejects(decodeModelResponse(new Response(gzip.subarray(0,12)), sample.byteLength, true));
const root = new URL('../', import.meta.url);
let modelChunks = 0;
for (const {manifest} of Object.values(MODELS)) {
  const atlas = JSON.parse(fs.readFileSync(new URL(`dist-client${manifest}`, root), 'utf8'));
  for (const chunk of atlas.chunks) {
    assert.ok(chunk.gzip);
    assert.ok(!fs.existsSync(new URL(`dist-client${chunk.url}`, root)), 'Raw models must not enter the client package');
    const binary = fs.readFileSync(new URL(`dist-client${chunk.gzip}`, root));
    assert.equal(binary.byteLength, chunk.gzipBytes);
    const decoded = await decodeModelResponse(new Response(binary), chunk.bytes, true);
    assert.equal(decoded.byteLength, chunk.bytes);
  }
  modelChunks += atlas.chunks.length;
}
for (const name of ['female-source.json','female-fit-report.json']) assert.ok(fs.existsSync(new URL(`dist-client/models/${name}`, root)), `Missing female source record: ${name}`);
assert.ok(fs.existsSync(new URL('dist-client/ATTRIBUTION.md', root)));
const config = JSON.parse(fs.readFileSync(new URL('src-tauri/tauri.conf.json', root), 'utf8'));
const manifest = JSON.parse(fs.readFileSync(new URL('package.json', root), 'utf8'));
assert.equal(config.version, manifest.version);
assert.equal(readVersions(), manifest.version);
assert.equal(config.build.frontendDist, '../dist-client');
assert.deepEqual(config.bundle.targets, ['nsis']);
const capability = JSON.parse(fs.readFileSync(new URL('src-tauri/capabilities/main.json', root), 'utf8'));
const linkPermission = capability.permissions.find(permission => permission.identifier === 'opener:allow-open-url');
const aboutSource = fs.readFileSync(new URL('app/about.tsx', root), 'utf8');
const aboutLinks = new Set([...aboutSource.matchAll(/"(https:\/\/[^"\s]+)"/g)].map(match => new URL(match[1]).href));
for (const url of aboutLinks) {
  assert.ok(linkPermission.allow.some(({url: allowed}) => allowed.endsWith('*') ? url.startsWith(allowed.slice(0,-1)) : url === new URL(allowed).href), `About link blocked by native permissions: ${url}`);
}
console.log(`Verified ${aboutLinks.size} author and credit links are available in the native client.`);
console.log(`Verified native/fallback gzip decoding, error cases, ${modelChunks} offline model chunks and Windows bundle configuration.`);
