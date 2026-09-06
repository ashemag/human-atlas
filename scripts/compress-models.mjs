/** Write a gzip sibling for every chunk and record its size in the manifest.
 *
 *   node scripts/compress-models.mjs [atlas.json]
 */
import fs from 'node:fs';
import path from 'node:path';
import {gzipSync} from 'node:zlib';
const base=new URL('../public/models/',import.meta.url);
const name=process.argv[2]??'atlas.json';
const file=new URL(name,base),atlas=JSON.parse(fs.readFileSync(file));
let bytes=0;
for(const c of atlas.chunks){const compressed=gzipSync(fs.readFileSync(new URL(path.basename(c.url),base)),{level:9});c.gzip=c.url+'.gz';c.gzipBytes=compressed.length;fs.writeFileSync(new URL(path.basename(c.gzip),base),compressed);bytes+=compressed.length;}
fs.writeFileSync(file,JSON.stringify(atlas));console.log(`${name}: ${(bytes/1e6).toFixed(1)} MB compressed download`);
