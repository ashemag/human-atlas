import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createExplosionLayout} from '../app/explosion-layout.ts';
import {PointerTap} from '../app/pointer-tap.ts';
import {atlasTools} from '../app/agent-tools.ts';
import {DEFAULT_VISIBLE,REGIONS,bodyBounds,isPartVisible,partRegion} from '../app/anatomy.ts';

for (const file of ['atlas.json']) {
  const atlas=JSON.parse(await readFile(new URL(`../public/models/${file}`,import.meta.url)));
  const groups=[atlas.parts,...[...new Set(atlas.parts.map(p=>p.system))].map(system=>atlas.parts.filter(p=>p.system===system))];
  for(const group of groups) for(const aspect of [.46,1,1.7]) {
    const layout=createExplosionLayout(group,aspect),cells=[...layout.cells.values()];
    assert.equal(cells.length,group.length);
    for(let i=0;i<cells.length;i++) {
      const a=cells[i];
      assert.ok(Math.abs(a.x)+a.width/2<=layout.width/2+1e-8);
      assert.ok(Math.abs(a.y)+a.height/2<=layout.height/2+1e-8);
      for(let j=i+1;j<cells.length;j++) {
        const b=cells[j];
        assert.ok(Math.abs(a.x-b.x)>=(a.width+b.width)/2-1e-8 || Math.abs(a.y-b.y)>=(a.height+b.height)/2-1e-8,'Exploded pieces overlap');
      }
    }
  }
  let selected=null;
  const [find,inspect]=atlasTools(atlas,c=>{selected=c;});
  const results=find.execute({query:'femur'});
  assert.ok(results.length>0);
  inspect.execute({id:results[0].id});
  const previous=selected;
  assert.throws(()=>inspect.execute({id:'nonexistent-structure'}));
  assert.equal(selected,previous);
  assert.throws(()=>find.execute({query:' '}));
  console.log(`${file}: packing at desktop/mobile aspect ratios and search/inspection contracts passed.`);
  const body=bodyBounds(atlas.parts),counts=Object.fromEntries(REGIONS.map(r=>[r.id,0]));
  for(const p of atlas.parts)counts[partRegion(p,body)]++;
  for(const r of REGIONS)assert.ok(counts[r.id]>0,`${r.name} should contain meshes`);
  assert.equal(Object.values(counts).reduce((n,v)=>n+v,0),atlas.parts.length);
  const named=Object.fromEntries(atlas.parts.map(p=>[p.name,p]));
  const expect={
   'head-neck':['Mandible','Frontal bone','Atlas','Seventh cervical vertebra','Hyoid bone'],
   torso:['Body of sternum','First thoracic vertebra','Trachea','Cavity of left ventricle'],
   abdomen:['Stomach','Spleen','Pancreas','Left kidney','Caudate lobe of liver'],
   arm:['Left humerus','Left radius','Left scapula','Left clavicle','Left hamate'],
   pelvis:['Left hip bone','Sacrum','Urinary bladder','Prostate'],
   legs:['Left femur','Left tibia','Left patella','Left talus']
  };
  for(const [region,names] of Object.entries(expect))for(const name of names){
   assert.ok(named[name],`missing landmark ${name}`);
   assert.equal(partRegion(named[name],body),region,`${name} should be in ${region}`);
  }
  const headBones=atlas.parts.filter(p=>isPartVisible(p,{visible:['skeletal'],selected:[],isolate:false,region:'head-neck'},body));
  const wholeBones=atlas.parts.filter(p=>isPartVisible(p,{visible:['skeletal'],selected:[],isolate:false,region:null},body));
  const whole=atlas.parts.filter(p=>isPartVisible(p,{visible:DEFAULT_VISIBLE,selected:[],isolate:false,region:null},body));
  assert.ok(headBones.some(p=>p.name==='Mandible'));
  assert.ok(!headBones.some(p=>p.name==='Left femur'));
  assert.ok(headBones.length<wholeBones.length);
  assert.ok(whole.length>headBones.length);
  console.log(`${file}: regional clusters cover ${REGIONS.map(r=>`${r.label} ${counts[r.id]}`).join(', ')}.`);
}
const tap=new PointerTap();
tap.down(1,10,10,5);assert.equal(tap.up(1,12,11),true);
tap.down(1,10,10,5);tap.move(1,40,10);assert.equal(tap.up(1,10,10),false);
tap.down(1,10,10,12);tap.down(2,20,20,12);assert.equal(tap.up(2,20,20),false);assert.equal(tap.up(1,10,10),false);
tap.down(1,10,10,5);tap.cancel(1);assert.equal(tap.up(1,10,10),false);
tap.down(1,10,10,5);assert.equal(tap.up(1,10,10),true);
assert.equal(createExplosionLayout([]).cells.size,0);
console.log('Tap, drag, multitouch, cancellation, and empty-view checks passed.');
