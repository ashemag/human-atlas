import fs from 'node:fs';
import {gzipSync,gunzipSync} from 'node:zlib';
const base=new URL('../public/models/',import.meta.url);
for(const name of fs.readdirSync(base).filter(n=>['atlas.json','atlas-female.json'].includes(n))){
 const path=new URL(name,base),atlas=JSON.parse(fs.readFileSync(path));
 let bytes=0;
 let changed=false;
 for(const c of atlas.chunks){const raw=new URL(c.url.split('/').pop(),base);if(!fs.existsSync(raw)){const compressed=fs.readFileSync(new URL(c.gzip.split('/').pop(),base));if(compressed.length!==c.gzipBytes||gunzipSync(compressed).length!==c.bytes)throw new Error(`Incomplete imported chunk: ${c.gzip}`);bytes+=compressed.length;continue;}const compressed=gzipSync(fs.readFileSync(raw),{level:9});c.gzip=c.url+'.gz';c.gzipBytes=compressed.length;fs.writeFileSync(new URL(c.gzip.split('/').pop(),base),compressed);bytes+=compressed.length;changed=true;}
 if(changed)fs.writeFileSync(path,JSON.stringify(atlas));console.log(`${name}: ${(bytes/1e6).toFixed(1)} MB compressed download`);
}
