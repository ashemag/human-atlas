import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createExplosionLayout,createSystemSeparationLayout} from '../app/core/explosion-layout.ts';
import {PointerTap} from '../app/core/pointer-tap.ts';
import {atlasTools} from '../app/core/agent-tools.ts';
import {randomOrganCandidates,pickRandomOrgan} from '../app/core/random-organ.ts';
import {privacyHiddenParts,isPartVisible,readPrivacyMode,PRIVACY_MODE_STORAGE_KEY} from '../app/core/privacy-mode.ts';
import {systemStructures,clearStructureOverrides,explicitSystemOverrides,hideSelectedStructure} from '../app/core/structure-layers.ts';
import {prepareShaders} from '../app/core/shader-preparation.ts';

{
  const controller = new AbortController();
  let calls = 0;
  await prepareShaders(false, () => { calls++; return Promise.resolve(); }, controller.signal);
  assert.equal(calls, 0, 'Unsupported contexts skip shader prewarming');
  await prepareShaders(true, () => { calls++; return Promise.resolve(); }, controller.signal);
  assert.equal(calls, 1, 'Supported contexts prewarm shaders');
  await prepareShaders(true, () => Promise.reject(new Error('compile failed')), controller.signal);
  await prepareShaders(true, () => new Promise(() => {}), controller.signal, 5);
  const cancelled = new AbortController();
  const pending = prepareShaders(true, () => new Promise(() => {}), cancelled.signal, 1000);
  cancelled.abort();
  await pending;
  await prepareShaders(true, () => { throw new Error('aborted work must not start'); }, cancelled.signal);
  console.log('Shader prewarming supports fallback, timeout and cancellation.');
}

for (const file of ['atlas.json', 'atlas-female.json']) {
  const atlas=JSON.parse(await readFile(new URL(`../public/models/${file}`,import.meta.url)));
  const structures=systemStructures(atlas);
  const groupedIds=[...structures.values()].flatMap(items=>items.flatMap(c=>c.elements));
  assert.equal(groupedIds.length,atlas.parts.length,'Every part belongs to one child structure');
  assert.equal(new Set(groupedIds).size,atlas.parts.length,'No duplicated geometry in child lists');
  for(const [system,items] of structures) {
    assert.equal(new Set(items.map(c=>c.id)).size,items.length,'Concept IDs are unique within a system');
    for(const c of items) assert.ok(c.name && c.elements.every(id=>atlas.parts.some(p=>p.id===id && p.system===system)),'Child groups never include another system');
  }
  const samplePart=atlas.parts[0];
  assert.equal(isPartVisible(samplePart,new Set(),new Set(),false,new Set(),{[samplePart.id]:true}),true,'An item can be shown independently of its system');
  assert.equal(isPartVisible(samplePart,new Set([samplePart.system]),new Set([samplePart.id]),false,new Set(),{[samplePart.id]:false}),false,'An item switch can hide a selected structure');
  assert.equal(isPartVisible(samplePart,new Set(),new Set(),true,new Set(),{[samplePart.id]:true}),false,'Individual overrides do not leak into isolation');
  assert.equal(isPartVisible(samplePart,new Set([samplePart.system]),new Set(),false,new Set([samplePart.id]),{[samplePart.id]:true}),true,'Explicit item viewing respects the privacy exception');
  const overrides={[samplePart.id]:false,other:true};
  assert.deepEqual(clearStructureOverrides(overrides,[samplePart.id]),{other:true});
  assert.equal(overrides[samplePart.id],false,'Clearing overrides does not mutate previous state');
  const model=atlas.sex;
  const organs=randomOrganCandidates(atlas,model);
  assert.deepEqual(privacyHiddenParts(atlas,false),[]);
  const hidden=new Set(privacyHiddenParts(atlas,true));
  const allSystems=new Set(atlas.parts.map(p=>p.system));
  const heart=organs.find(c=>c.id==='FMA7088');
  assert.ok(heart?.elements.length>1, 'Use a complete multi-part organ for visibility regression');
  const otherPart=atlas.parts.find(p=>!heart.elements.includes(p.id));
  for (const isolate of [false,true]) {
    const before={visible:[...allSystems],selected:heart.elements,isolate,focus:2,focusContext:true,rotate:true,explode:0,view:'front',reset:0,partVisibility:{[otherPart.id]:false,[heart.elements[0]]:true}};
    const after=hideSelectedStructure(before);
    assert.ok(heart.elements.every(id=>!isPartVisible(atlas.parts.find(p=>p.id===id),allSystems,new Set(after.selected),after.isolate,hidden,after.partVisibility)), 'Details hide every component of the selected organ');
    assert.equal(after.partVisibility[otherPart.id],false, 'Unrelated visibility overrides remain intact');
    assert.deepEqual(after.visible,before.visible, 'Existing system layers are preserved');
    assert.equal(after.isolate,false, 'Hiding an isolated target restores surrounding layers');
    assert.equal(after.focus,0);
    assert.equal(after.focusContext,false);
    assert.equal(after.rotate,false);
    assert.equal(before.partVisibility[heart.elements[0]],true, 'Hiding does not mutate the previous state');
    const reopened=clearStructureOverrides(after.partVisibility,heart.elements);
    assert.ok(heart.elements.every(id=>isPartVisible(atlas.parts.find(p=>p.id===id),allSystems,new Set(heart.elements),true,hidden,reopened)), 'Explicitly reopening the organ restores all selected components');
    assert.equal(hideSelectedStructure({...before,selected:[]}).partVisibility,before.partVisibility, 'An empty selection leaves overrides untouched');
  }
  for (const system of allSystems) {
    const enabled=explicitSystemOverrides(atlas,system,true,hidden);
    const systemParts=atlas.parts.filter(p=>p.system===system);
    assert.ok(systemParts.every(p=>isPartVisible(p,new Set([system]),new Set(),false,hidden,enabled)), 'Explicit system viewing includes protected structures');
    assert.ok(atlas.parts.filter(p=>p.system!==system).every(p=>!isPartVisible(p,new Set([system]),new Set(),false,hidden,enabled)), 'Only does not reveal other systems');
    const disabled=explicitSystemOverrides(atlas,system,false,hidden,enabled);
    assert.ok(systemParts.every(p=>!isPartVisible(p,new Set(),new Set(),false,hidden,disabled)), 'Turning off the system removes privacy exceptions');
    assert.ok(systemParts.filter(p=>hidden.has(p.id)).every(p=>!isPartVisible(p,allSystems,new Set(),false,hidden,{})), 'Default view still hides private structures after exceptions are cleared');
  }
  const visibleDefault=atlas.parts.filter(p=>isPartVisible(p,allSystems,new Set(),false,hidden));
  if(model==='male') {
    assert.ok(hidden.size>12,'Privacy also hides genital vessels outside the reproductive system');
    for(const part of atlas.parts.filter(p=>p.system==='reproductive' || /penis|testicular/i.test(p.name))) {
      assert.ok(hidden.has(part.id),`Sensitive structure not hidden: ${part.name}`);
      assert.equal(isPartVisible(part,allSystems,new Set(),false,hidden),false);
      assert.equal(isPartVisible(part,allSystems,new Set(),true,hidden),false);
      assert.equal(isPartVisible(part,new Set(),new Set([part.id]),true,hidden),true,'Explicit search selection remains available');
      assert.equal(isPartVisible(part,allSystems,new Set([part.id]),false,hidden),true,'Explicit selection can be shown with surroundings');
      assert.equal(isPartVisible(part,allSystems,new Set(),false,new Set()),true,'Turning privacy off restores the structure');
    }
    assert.ok(visibleDefault.some(p=>p.conceptId==='FMA7148'),'Unrelated organs remain visible');
    assert.equal(organs.filter(c=>!c.elements.some(id=>hidden.has(id))).length,17,'Private organs are excluded from random exploration');
  } else {
    assert.equal(hidden.size,16,'All breast meshes, nipples, areolae and areolar tubercles are hidden');
    for(const part of atlas.parts.filter(p=>p.system==='mammary' || /^VH_F_(nipple|areola|areolar_tubercles)_/.test(p.id))) {
      assert.ok(hidden.has(part.id),`Breast structure not hidden: ${part.name}`);
      assert.equal(isPartVisible(part,allSystems,new Set(),false,hidden),false);
      assert.equal(isPartVisible(part,new Set(),new Set([part.id]),true,hidden),true,'Explicit female selection remains available');
      assert.equal(isPartVisible(part,allSystems,new Set(),false,new Set()),true,'Turning privacy off restores female structures');
    }
    for(const part of atlas.parts.filter(p=>p.system==='reproductive')) {
      assert.ok(!hidden.has(part.id),`Internal female organ incorrectly hidden: ${part.name}`);
      assert.equal(isPartVisible(part,allSystems,new Set(),false,hidden),true);
    }
    assert.equal(visibleDefault.length,atlas.parts.length-hidden.size);
    assert.equal(organs.filter(c=>!c.elements.some(id=>hidden.has(id))).length,20,'Female internal organs remain in random exploration');
    // The current model has no separate external genital meshes. Check the rule
    // with anatomy fixtures so future additions cannot reveal those by default.
    const sample=atlas.parts[0];
    const external=['clitoris','Left labium majus','Right labium minus','vulva'];
    const keep=['uterus','ovary','vagina','Superior labial artery'];
    const fixture={...atlas,parts:[...external,...keep].map((name,i)=>({...sample,id:`privacy-${i}`,name,system:'reproductive'}))};
    assert.deepEqual(privacyHiddenParts(fixture,true),external.map((_,i)=>`privacy-${i}`));
  }
  assert.equal(organs.length,20,`${model}: all common and model-specific organs are available`);
  assert.equal(new Set(organs.map(c=>c.id)).size,organs.length);
  const partIds=new Set(atlas.parts.map(p=>p.id));
  for(const organ of organs) assert.ok(organ.elements.length && organ.elements.every(id=>partIds.has(id)));
  assert.ok(organs.find(c=>c.id==='FMA7088').elements.length>1,'The whole heart includes its component meshes');
  assert.ok(!organs.some(c=>['FMA7203','FMA7210','HRA:VH_F_ovary','PART_FJ1895'].includes(c.id)),'Avoid bilateral groups and duplicate organ fragments');
  assert.equal(organs.filter(c=>c.id.startsWith('HRA:')).length,model==='female'?3:0);
  assert.equal(organs.filter(c=>['FMA7211','FMA7212','FMA9600'].includes(c.id)).length,model==='male'?3:0);
  assert.deepEqual(randomOrganCandidates(atlas,model==='male'?'female':'male'),[]);
  const broken={...atlas,parts:atlas.parts.filter(p=>p.id!==organs[0].elements[0])};
  assert.ok(!randomOrganCandidates(broken,model).some(c=>c.id===organs[0].id),'Incomplete organs are excluded');
  const duplicated={...atlas,concepts:[...atlas.concepts,organs[0]]};
  assert.equal(randomOrganCandidates(duplicated,model).length,organs.length);
  let previousOrgan;
  for(let i=0;i<100;i++) {
    const current=organs[(i+3)%organs.length].id;
    const next=pickRandomOrgan(organs,current,previousOrgan,()=>((i*17)%100)/100);
    assert.ok(next && next.id!==current && next.id!==previousOrgan);
    previousOrgan=next.id;
  }
  // Midpoints of equal probability intervals must select each eligible organ once.
  const eligible=organs.slice(2);
  assert.deepEqual(eligible.map((_,i)=>pickRandomOrgan(organs,organs[0].id,organs[1].id,()=>(i+.5)/eligible.length).id),eligible.map(c=>c.id));
  console.log(`${model}: whole-organ candidates, complete geometry, sex-specific filtering and nonrepeating random selection passed.`);
  const groups=[atlas.parts,...[...new Set(atlas.parts.map(p=>p.system))].map(system=>atlas.parts.filter(p=>p.system===system))];
  for (const parts of [...groups, visibleDefault]) {
    const layout=createSystemSeparationLayout(parts);
    const boxes=[...layout.offsets].map(([system,offset])=>{
      const members=parts.filter(p=>p.system===system);
      return {min:Math.min(...members.map(p=>p.bounds[0][0]))+offset,max:Math.max(...members.map(p=>p.bounds[1][0]))+offset};
    });
    for(let i=0;i<boxes.length;i++) {
      assert.ok(boxes[i].min>=-layout.width/2-1e-8 && boxes[i].max<=layout.width/2+1e-8,'Separated systems fit their layout bounds');
      if(i) assert.ok(boxes[i].min-boxes[i-1].max>=.025-1e-8,'Complete systems have a clear gap in the front view');
    }
  }
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
}
assert.deepEqual(randomOrganCandidates(null,'male'),[]);
assert.equal(createSystemSeparationLayout([]).width,0);
assert.equal(createSystemSeparationLayout([]).height,0);
assert.equal(systemStructures(null).size,0);
assert.deepEqual(privacyHiddenParts(null,true),[]);
assert.equal(readPrivacyMode(),false);
assert.equal(readPrivacyMode({getItem:()=>null}),false);
assert.equal(readPrivacyMode({getItem:()=> 'invalid'}),false);
assert.equal(readPrivacyMode({getItem:()=>{throw new Error('Storage blocked');}}),false);
assert.equal(readPrivacyMode({getItem:key=>key===PRIVACY_MODE_STORAGE_KEY?'true':null}),true);
assert.equal(readPrivacyMode({getItem:()=> 'false'}),false);
assert.equal(pickRandomOrgan([]),undefined);
const one={id:'one',name:'one',elements:['mesh']},two={id:'two',name:'two',elements:['mesh2']};
assert.equal(pickRandomOrgan([one],'one','one',()=>0),one);
assert.equal(pickRandomOrgan([one,two],'two','one',()=>0),two);
assert.equal(pickRandomOrgan([one,two],'one','one',()=>0),two);
const tap=new PointerTap();
tap.down(1,10,10,5);assert.equal(tap.up(1,12,11),true);
tap.down(1,10,10,5);tap.move(1,40,10);assert.equal(tap.up(1,10,10),false);
tap.down(1,10,10,12);tap.down(2,20,20,12);assert.equal(tap.up(2,20,20),false);assert.equal(tap.up(1,10,10),false);
tap.down(1,10,10,5);tap.cancel(1);assert.equal(tap.up(1,10,10),false);
tap.down(1,10,10,5);assert.equal(tap.up(1,10,10),true);
assert.equal(createExplosionLayout([]).cells.size,0);
console.log('Tap, drag, multitouch, cancellation, and empty-view checks passed.');
