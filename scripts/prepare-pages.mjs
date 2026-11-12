import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {gunzipSync} from 'node:zlib';
import {MODELS} from '../app/core/model-catalogue.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
const dist = path.join(root, 'dist');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
let modelChunks = 0;
for (const {manifest} of Object.values(MODELS)) {
  const atlas = JSON.parse(fs.readFileSync(path.join(dist, manifest), 'utf8'));
  assert.ok(atlas.chunks.length > 0, 'The Pages build must include the anatomy models');
  for (const chunk of atlas.chunks) {
    assert.ok(chunk.gzip?.startsWith('/models/'), 'Every Pages model must have a compressed asset');
    const compressed = fs.readFileSync(path.join(dist, chunk.gzip));
    assert.equal(compressed.length, chunk.gzipBytes, `Incomplete compressed model: ${chunk.gzip}`);
    assert.equal(gunzipSync(compressed).length, chunk.bytes, `Incomplete decoded model: ${chunk.gzip}`);
    assert.ok(!fs.existsSync(path.join(dist, chunk.url)), 'Pages should deploy compressed models only');
  }
  modelChunks += atlas.chunks.length;
}
for (const asset of ['index.html', 'ATTRIBUTION.md', 'models/female-source.json', 'models/female-fit-report.json', 'branding/256x256.png', 'favicon.ico']) {
  assert.ok(fs.existsSync(path.join(dist, asset)), `Missing Pages asset: ${asset}`);
}
const source = process.env.CF_PAGES_COMMIT_SHA || execFileSync('git', ['rev-parse', 'HEAD'], {cwd: root, encoding: 'utf8'}).trim();
assert.match(source, /^[a-f0-9]{40}$/i, 'Pages must identify the source commit');
fs.writeFileSync(path.join(dist, 'version.json'), JSON.stringify({version: manifest.version, source}, null, 2) + '\n');

// Cloudflare Pages Free limits: https://developers.cloudflare.com/pages/platform/limits/
let count = 0;
let bytes = 0;
let largest = 0;
function inspect(directory) {
  for (const entry of fs.readdirSync(directory, {withFileTypes: true})) {
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) inspect(filename);
    else {
      const size = fs.statSync(filename).size;
      assert.ok(size <= 25 * 1024 * 1024, `Pages asset exceeds 25 MiB: ${path.relative(dist, filename)}`);
      count++;
      bytes += size;
      largest = Math.max(largest, size);
    }
  }
}
inspect(dist);
assert.ok(count <= 20_000, `Pages build exceeds 20,000 files: ${count}`);
console.log(`Pages ready: ${count} files, ${(bytes / 1024 / 1024).toFixed(1)} MiB total, ${(largest / 1024 / 1024).toFixed(1)} MiB largest; ${modelChunks} compressed model chunks verified. Version ${manifest.version}, source ${source}.`);
