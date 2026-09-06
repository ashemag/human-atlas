import fs from 'node:fs';
import {gzipSync} from 'node:zlib';
const base=new URL('../public/models/',import.meta.url);
for(const name of fs.readdirSync(base).filter(n=>/^atlas(?:-female(?:-reconstructed)?)?\.json$/.test(n))){
 const path=new URL(name,base),atlas=JSON.parse(fs.readFileSync(path));
 let bytes=0;
 for(const c of atlas.chunks){const compressed=gzipSync(fs.readFileSync(new URL(c.url.split('/').pop(),base)),{level:9});c.gzip=c.url+'.gz';c.gzipBytes=compressed.length;fs.writeFileSync(new URL(c.gzip.split('/').pop(),base),compressed);bytes+=compressed.length;}
 fs.writeFileSync(path,JSON.stringify(atlas));console.log(`${name}: ${(bytes/1e6).toFixed(1)} MB compressed download`);
}
