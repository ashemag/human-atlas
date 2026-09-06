import fs from 'node:fs';
import assert from 'node:assert/strict';
const filename=process.argv[2]??'atlas.json',female=filename.startsWith('atlas-female'),reconstructed=filename==='atlas-female-reconstructed.json';
const base=new URL('../public/models/',import.meta.url),atlas=JSON.parse(fs.readFileSync(new URL(filename,base)));
assert.equal(atlas.parts.length,reconstructed?2243:female?888:2234);assert.equal(atlas.concepts.length,reconstructed?4246:female?1073:3432);
const ids=new Set(atlas.parts.map(p=>p.id));assert.equal(ids.size,reconstructed?2243:female?888:2234);
const files=atlas.chunks.map(c=>{const b=fs.readFileSync(new URL(c.url.split('/').pop(),base));assert.equal(b.length,c.bytes);return b;});
if(female){assert.equal(atlas.sex,'female');assert.equal(atlas.parts.filter(p=>p.system==='pregnancy').length,reconstructed?0:8);for(const label of ['uterus','ovary','vagina'])assert.ok(atlas.parts.some(p=>p.name.toLowerCase().includes(label)));assert.ok(!atlas.parts.some(p=>/prostate|testis|penis/i.test(p.name)));}
if(reconstructed){
 const source=JSON.parse(fs.readFileSync(new URL('atlas.json',base)));
 const femaleSource=JSON.parse(fs.readFileSync(new URL('atlas-female.json',base)));
 const sourceParts=new Map(source.parts.map(p=>[p.id,p]));
 const femaleParts=new Map(femaleSource.parts.map(p=>[p.id,p]));
 const report=JSON.parse(fs.readFileSync(new URL('female-fit-report.json',base)));
 const sourceFiles=source.chunks.map(c=>fs.readFileSync(new URL(c.url.split('/').pop(),base)));
 const femaleFiles=femaleSource.chunks.map(c=>fs.readFileSync(new URL(c.url.split('/').pop(),base)));
 // Re-apply the recorded whole-body morph and breast drape (same definitions as the builder).
 const morph=report.morph,drape=report.drape;
 const smoothstep=(a,b,t)=>{const u=Math.min(1,Math.max(0,(t-a)/(b-a)));return u*u*(3-2*u);};
 const lateral=(y,k=morph.lateralKnots)=>{if(y<k[0][0])return k[0][1];for(let i=0;i<k.length-1;i++){const [y0,s0]=k[i],[y1,s1]=k[i+1];if(y>=y0&&y<y1)return s0+(s1-s0)*smoothstep(y0,y1,y);}return k[k.length-1][1];};
 const apply=(x,y,z,partId)=>{
  const R=morph.lateralRadius,t=morph.thoraxDepth,h=morph.head;
  let dx=Math.sign(x)*(lateral(y)-1)*R*Math.tanh(Math.abs(x)/R);
  const blend=morph.lateralBlend;
  if(blend){
   const reference=lateral(y,blend.referenceKnots),factor=lateral(y),weight=smoothstep(blend.innerRadius,blend.outerRadius,Math.abs(x)),r=blend.heightRamp;
   const outer=Math.sign(x)*blend.outerTranslation*smoothstep(r[0],r[1],y)*(1-smoothstep(r[2],r[3],y));
   dx=(reference-1)*R*Math.tanh(x/R)+(1-weight)*(factor-reference)*R*Math.tanh(x/R)+weight*outer;
  }
  const waist=morph.waistRefinement;
  if(waist){const r=waist.heightRamp;const weight=smoothstep(r[0],r[1],y)*(1-smoothstep(r[1],r[2],y))*(1-smoothstep(...waist.radialRamp,Math.abs(x)));dx+=waist.delta*R*Math.tanh(x/R)*weight;}
  const w=smoothstep(t.ramp[0],t.ramp[1],y)*(1-smoothstep(t.ramp[2],t.ramp[3],y));
  let qx=x+dx,qy=y,qz=z+z*(t.scale-1)*w;
  const g=morph.gluteProjection;
  if(g?.partIds?.includes(partId)){
   const r2=((Math.abs(x)-g.centerX)/g.radiusX)**2+((y-g.centerY)/g.radiusY)**2;
   let posterior=1-smoothstep(...g.depthRamp,z);
   if(g.lowerDepth){let low=(1-smoothstep(...g.lowerDepth.heightFade,y))*(1-smoothstep(...g.lowerDepth.depthRamp,z));if(g.lowerDepth.heightRise)low*=smoothstep(...g.lowerDepth.heightRise,y);posterior=posterior+low-posterior*low;}
   const gate=(1-smoothstep(0,1,r2))*smoothstep(...g.midlineRamp,Math.abs(x))*posterior;qz-=g.amplitude*gate;
   if(g.inferior){const i=g.inferior,r=i.heightRamp;let weight=smoothstep(...i.midlineRamp,Math.abs(x))*(1-smoothstep(...i.lateralFade,Math.abs(x)))*smoothstep(r[0],r[1],y)*(1-smoothstep(r[2],r[3],y))*(1-smoothstep(...i.depthRamp,z));if(i.posteriorFade)weight*=smoothstep(...i.posteriorFade,z);qy-=i.amplitude*weight;}
  }
  const n=morph.nose;if(n){const r2=((x-n.center[0])/n.radius[0])**2+((y-n.center[1])/n.radius[1])**2,wn=(1-smoothstep(0,1,r2))*smoothstep(n.plane-n.rampDepth,n.plane+n.rampDepth,z);qz-=wn*(1-n.scale)*(z-n.plane);}
  const wh=smoothstep(h.ramp[0],h.ramp[1],y)*(1-h.scale);
  qx-=wh*(qx-h.center[0]);qy-=wh*(qy-h.center[1]);qz-=wh*(qz-h.center[2]);
  return [qx*morph.stature,qy*morph.stature,qz*morph.stature];
 };
 const drapeShift=(x,y)=>{
  const fx=Math.min(Math.max((x-drape.origin[0])/drape.cell,0),drape.columns-1.000001),fy=Math.min(Math.max((y-drape.origin[1])/drape.cell,0),drape.rows-1.000001);
  const x0=Math.floor(fx),y0=Math.floor(fy),tx=fx-x0,ty=fy-y0,g=drape.values;
  return g[y0][x0]*(1-tx)*(1-ty)+g[y0][x0+1]*tx*(1-ty)+g[y0+1][x0]*(1-tx)*ty+g[y0+1][x0+1]*tx*ty;
 };
 assert.equal(drape.values.length,drape.rows);assert.ok(drape.values.every(r=>r.length===drape.columns));
 let retained=0,added=0,maxError=0;
 const check=(expected,actual,label)=>{for(let i=0;i<expected.length;i++){const e=Math.abs(expected[i]-actual[i]);maxError=Math.max(maxError,e);assert.ok(e<2e-4,`${label}: vertex mismatch ${e}`);}};
 for(const p of atlas.parts){
  const positions=new Float32Array(files[p.chunk].buffer,files[p.chunk].byteOffset+p.positions,p.vertexCount*3);
  const normals=new Int16Array(files[p.chunk].buffer,files[p.chunk].byteOffset+p.normals,p.vertexCount*3);
  for(let i=0;i<normals.length;i+=3){const l=Math.hypot(normals[i],normals[i+1],normals[i+2])/32767;assert.ok(l>.98&&l<1.02,`${p.id}: unnormalized normal`);}
  if(sourceParts.has(p.id)){
   const ref=sourceParts.get(p.id);
   assert.equal(p.provenance.source,'BodyParts3D 4.0');assert.equal(p.name,ref.name);assert.equal(p.system,ref.system);assert.equal(p.conceptId,ref.conceptId);
   assert.equal(p.vertexCount,ref.vertexCount);assert.equal(p.indexCount,ref.indexCount);
   const original=new Float32Array(sourceFiles[ref.chunk].buffer,sourceFiles[ref.chunk].byteOffset+ref.positions,ref.vertexCount*3);
   const originalIndices=new Uint32Array(sourceFiles[ref.chunk].buffer,sourceFiles[ref.chunk].byteOffset+ref.indices,ref.indexCount);
   const indices=new Uint32Array(files[p.chunk].buffer,files[p.chunk].byteOffset+p.indices,p.indexCount);
   assert.deepEqual(indices,originalIndices,`${p.id}: topology changed`);
   const expected=new Float32Array(original.length);
   for(let i=0;i<original.length;i+=3){const q=apply(original[i],original[i+1],original[i+2],p.id);expected[i]=q[0];expected[i+1]=q[1];expected[i+2]=q[2];}
   check(expected,positions,p.id);retained++;
  } else {
   const reference=femaleParts.get(p.id);assert.ok(reference);
   assert.equal(p.provenance.source,'HRA united-female v1.5');
   const entry=report.added.find(a=>a.id===p.id);assert.ok(entry,`${p.id}: not in fit report`);assert.equal(entry.system,p.system);
   assert.ok(['reproductive','mammary','skeletal','integumentary'].includes(p.system));
   const transform=report.transforms[entry.transform];assert.ok(transform);
   if(report.regenerated.includes(p.id)){
    // Regenerated breast fat: a closed heightfield body, every edge shared by exactly two triangles.
    const indices=new Uint32Array(files[p.chunk].buffer,files[p.chunk].byteOffset+p.indices,p.indexCount),edges=new Map();
    for(let t=0;t<indices.length;t+=3)for(let k=0;k<3;k++){const a=indices[t+k],b=indices[t+(k+1)%3],key=a<b?`${a}:${b}`:`${b}:${a}`;edges.set(key,(edges.get(key)??0)+1);}
    for(const count of edges.values())assert.equal(count,2,`${p.id}: breast fat body is not a closed surface`);
    const directions=new Map();let volume=0;
    for(let t=0;t<indices.length;t+=3){
     const ia=indices[t]*3,ib=indices[t+1]*3,ic=indices[t+2]*3;
     volume+=positions[ia]*(positions[ib+1]*positions[ic+2]-positions[ib+2]*positions[ic+1])+positions[ia+1]*(positions[ib+2]*positions[ic]-positions[ib]*positions[ic+2])+positions[ia+2]*(positions[ib]*positions[ic+1]-positions[ib+1]*positions[ic]);
     for(let k=0;k<3;k++){const a=indices[t+k],b=indices[t+(k+1)%3],key=a<b?`${a}:${b}`:`${b}:${a}`;directions.set(key,(directions.get(key)??0)+(a<b?1:-1));}
    }
    assert.ok(volume>0,`${p.id}: inverted outer surface`);
    for(const direction of directions.values())assert.equal(direction,0,`${p.id}: inconsistent surface winding`);
    assert.ok(p.bounds[0][1]>1.0&&p.bounds[1][1]<1.4&&Math.abs(p.bounds[0][2])<.2,`${p.id}: breast fat outside the chest`);
   } else {
    assert.equal(p.vertexCount,reference.vertexCount);assert.equal(p.indexCount,reference.indexCount);
    const original=new Float32Array(femaleFiles[reference.chunk].buffer,femaleFiles[reference.chunk].byteOffset+reference.positions,reference.vertexCount*3);
    const expected=new Float32Array(original.length);
    for(let i=0;i<original.length;i+=3){
     let x=original[i]*transform.scale[0]+transform.offset[0],y=original[i+1]*transform.scale[1]+transform.offset[1],z=original[i+2]*transform.scale[2]+transform.offset[2];
     if(entry.transform==='mammary')z+=drapeShift(x,y)+(report.tissueInsets?.[p.id]??0);
     const q=apply(x,y,z,p.id);expected[i]=q[0];expected[i+1]=q[1];expected[i+2]=q[2];
    }
    check(expected,positions,p.id);
   }
   added++;
  }
  for(let axis=0;axis<3;axis++){let lo=Infinity,hi=-Infinity;for(let i=axis;i<positions.length;i+=3){lo=Math.min(lo,positions[i]);hi=Math.max(hi,positions[i]);}assert.ok(Math.abs(lo-p.bounds[0][axis])<1e-6&&Math.abs(hi-p.bounds[1][axis])<1e-6,`${p.id}: stale bounds`);}
 }
 assert.equal(retained,2181);assert.equal(added,62);
 for(const [maleId,replacementIds] of Object.entries(report.replacements)){assert.ok(!ids.has(maleId),'Replaced male pelvis bone still present');for(const id of replacementIds)assert.ok(ids.has(id),`Missing pelvis replacement ${id}`);}
 for(const name of ['Left ilium','Right ilium','Left ischium','Right ischium','Left pubis','Right pubis','Sacrum','Coccyx'])assert.ok(atlas.parts.some(p=>p.name===name&&p.system==='skeletal'),`Missing ${name}`);
 assert.equal(report.retained.length,retained);assert.equal(report.added.length,added);
 for(const id of report.retained)assert.ok(ids.has(id));
 for(const p of report.excluded)assert.ok(!ids.has(p.id));
 assert.ok(!atlas.parts.some(p=>/penis|testicular|testis|prostat|seminal|deferent|epididym|spermatic|perineal|levator ani/i.test(p.name)));
 assert.ok(!ids.has('FJ2810')&&!ids.has('FJ3148'),'Male skin or urethra retained');
 for(const name of ['Left humerus','Right humerus','Left radius','Right radius','Left ulna','Right ulna','Left femur','Right femur','Left tibia','Right tibia','Left fibula','Right fibula']){
  const p=source.parts.find(p=>p.name===name);assert.ok(ids.has(p.id),'Missing original limb bone');
 }
 for(const p of atlas.parts)assert.ok(atlas.concepts.some(c=>c.elements.includes(p.id)),'Unsearchable structure');
 assert.equal(new Set(atlas.concepts.map(c=>c.id)).size,atlas.concepts.length);
 assert.ok(report.checks.minimumTransformDeterminant>0);assert.ok(report.checks.minimumMorphJacobian>0,'Morph folds space');
 assert.ok(report.checks.breastWallMaxResidualM<.002,'Breast tissue floats off the chest wall');
 for(const p of atlas.parts.filter(p=>/VH_F_(nipple|areola)/.test(p.id)))assert.equal(p.system,'integumentary',`${p.id}: nipple and areola stay in the optional Body surface layer`);
 assert.equal(atlas.parts.filter(p=>p.system==='integumentary').length,6,'Expected six optional breast surface structures');
 const l=report.landmarks;assert.ok(l.stature.after<l.stature.before&&l.biacromialWidth.after<l.biacromialWidth.before&&l.biIliacWidth.after>l.biacromialWidth.after*.9,'Female proportions not applied');
 console.log(`Every retained mesh keeps its source topology and follows the recorded female morph (max deviation ${(maxError*1000).toFixed(3)} mm); fitted female meshes match their transforms and drape; male-specific anatomy is excluded.`);
}
let tris=0;
for(const p of atlas.parts){assert.ok(p.name.trim()&&p.name!=='-'&&!p.name.includes('Bounds('));assert.ok(p.conceptId!=='-');assert.ok(p.system);const b=files[p.chunk];assert.ok(p.indices+p.indexCount*4<=b.length);const pos=new Float32Array(b.buffer,b.byteOffset+p.positions,p.vertexCount*3),indices=new Uint32Array(b.buffer,b.byteOffset+p.indices,p.indexCount);assert.ok(indices.length>=3);for(const i of indices)assert.ok(i<p.vertexCount,`${p.id}: invalid vertex`);for(const value of pos)assert.ok(Number.isFinite(value));tris+=p.indexCount/3;}
for(const c of atlas.concepts){assert.ok(c.elements.length);for(const id of c.elements)assert.ok(ids.has(id),`${c.id}: missing ${id}`);}
assert.equal(tris,atlas.triangles);
console.log(`Verified ${ids.size} individually indexed meshes, ${atlas.concepts.length} complete concept mappings, ${tris.toLocaleString()} triangles, and every binary buffer.`);
