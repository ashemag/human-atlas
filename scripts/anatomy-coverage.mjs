import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath, pathToFileURL} from 'node:url';

export const TARGETS = [
 ['rectus-abdominis','Rectus abdominis',['rectus abdominis']],
 ['internal-oblique','Internal oblique',['internal oblique','obliquus internus abdominis']],
 ['transversus-abdominis','Transversus abdominis',['transversus abdominis','transverse abdominal muscle']],
 ['multifidus','Multifidus',['multifidus','multifidi']],
 ['quadratus-lumborum','Quadratus lumborum',['quadratus lumborum']],
 ['external-oblique','External oblique',['external oblique','obliquus externus abdominis']],
 ['diaphragm','Diaphragm',['diaphragm']],
 ['psoas-major','Psoas major',['psoas major']],
 ['iliacus','Iliacus',['iliacus']],
 ['gluteus-maximus','Gluteus maximus',['gluteus maximus']],
 ['gluteus-medius','Gluteus medius',['gluteus medius']],
 ['gluteus-minimus','Gluteus minimus',['gluteus minimus']],
 ['piriformis','Piriformis',['piriformis']],
 ['puborectalis','Puborectalis',['puborectalis']],
 ['pubococcygeus','Pubococcygeus / pubovisceral muscle',['pubococcygeus','pubovisceral','pubovisceralis']],
 ['iliococcygeus','Iliococcygeus',['iliococcygeus']],
 ['coccygeus','Coccygeus',['coccygeus','ischiococcygeus']],
 ['pelvic-arch','Tendinous arch of levator ani',['tendinous arch of levator ani']],
 ['anal-sphincter','External anal sphincter',['external anal sphincter']],
 ['urethra','Urethra',['urethra']],
].map(([id,name,aliases])=>({id,name,aliases}));

const normalize=s=>String(s).toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
export function nameMatches(name,aliases){
 const n=` ${normalize(name)} `;
 return aliases.some(alias=>n.includes(` ${normalize(alias)} `));
}
export function summarizeAtlas(atlas,target){
 const parts=atlas.parts.filter(p=>nameMatches(p.name,target.aliases));
 const concepts=atlas.concepts.filter(c=>nameMatches(c.name,target.aliases));
 return {
  status:parts.length?'named_meshes_present':concepts.length?'concept_only':'not_separately_identified',
  parts:parts.map(p=>({id:p.id,name:p.name,system:p.system})),
  concepts:concepts.map(c=>({id:c.id,name:c.name,elements:c.elements})),
 };
}
export function parseTsv(text){
 return text.trim().split(/\r?\n/).slice(1).map(line=>line.split('\t'));
}
export function coverageReport(atlases,tables,meshIndex,excluded=[]){
 return TARGETS.map(target=>{
  const mappings=tables.names.filter(row=>nameMatches(row[2],target.aliases));
  const ids=new Set(mappings.map(r=>r[0]));
  const sourceElements=tables.elements.filter(row=>ids.has(row[0]));
  const archiveMeshes=meshIndex.filter(m=>nameMatches(m.name,target.aliases));
  return {...target,atlases:Object.fromEntries(Object.entries(atlases).map(([key,a])=>[key,summarizeAtlas(a,target)])),
   source:{concepts:mappings.map(([conceptId,representationId,name])=>({conceptId,representationId,name})),elementIds:[...new Set(sourceElements.map(r=>r[2]))].sort(),archiveMeshes},
   excluded:excluded.filter(p=>nameMatches(p.name,target.aliases)),
   interpretation:'Named matches establish discoverability, not segmentation accuracy. No match does not prove the tissue is geometrically absent. Source sex and registration require separate review.'};
 });
}
export function run(root){
 const sources=path.join(root,'data/anatomy/sources');
 const read=n=>fs.readFileSync(path.join(sources,n));
 const files=['isa_parts_list_e.txt','isa_element_parts.txt','mesh-name-index.json'];
 const metadata=JSON.parse(read('provenance.json'));
 const hashes=Object.fromEntries(files.map(n=>[n,createHash('sha256').update(read(n)).digest('hex')]));
 for(const n of files)if(metadata.files[n].sha256!==hashes[n])throw new Error(`Source snapshot checksum mismatch: ${n}`);
 const json=n=>JSON.parse(fs.readFileSync(path.join(root,'public/models',n)));
 const atlases={male:json('atlas.json'),female:json('atlas-female-reconstructed.json'),femaleSource:json('atlas-female.json')};
 const targets=coverageReport(atlases,{names:parseTsv(read(files[0]).toString()),elements:parseTsv(read(files[1]).toString())},JSON.parse(read(files[2])),json('female-fit-report.json').excluded);
 const archiveIds=new Set(JSON.parse(read(files[2])).map(m=>m.id));
 const maleIds=new Set(atlases.male.parts.map(m=>m.id));
 const sourceInventory={missingFromMale:[...archiveIds].filter(id=>!maleIds.has(id)),unlistedInArchive:[...maleIds].filter(id=>!archiveIds.has(id)),unnamedArchiveMeshes:metadata.archive.unnamedMeshCount};
 const report={schemaVersion:1,source:metadata,sourceInventory,limits:'This is a nomenclature and mapping audit, not anatomical certification or proof of geometric absence.',targets};
 fs.writeFileSync(path.join(root,'data/anatomy/coverage-baseline.json'),JSON.stringify(report,null,2)+'\n');
 const rows=targets.map(t=>`| ${t.name} | ${t.atlases.male.parts.length} | ${t.atlases.female.parts.length} | ${t.atlases.femaleSource.parts.length} | ${t.source.archiveMeshes.length} | ${t.excluded.length?'Explicitly omitted from female':t.atlases.female.status.replaceAll('_',' ')} |`);
 const doc=`# Teaching anatomy coverage\n\nTracked by [SWR-511](https://linear.app/stealth-company/issue/SWR-511). Run \`npm run audit:coverage\` to regenerate from the pinned source metadata and current bundled atlases.\n\nCounts are named meshes, not muscle quantity or proof of anatomical completeness. A zero means no separately named mesh was identified with the documented aliases. Merged or mislabeled tissue requires geometric review. The HRA column is the original female source, not the reconstructed model. BodyParts3D is male reference anatomy.\n\n| Target | Male | Female study | HRA source | Official BP3D archive | Finding |\n|---|---:|---:|---:|---:|---|\n${rows.join('\n')}\n\n## How to interpret this\n\nThe official archive contains ${metadata.archive.unnamedMeshCount} meshes with blank English names; these remain unresolved source labels. Source-ID comparison finds ${sourceInventory.missingFromMale.length} archive meshes missing from our male bundle and ${sourceInventory.unlistedInArchive.length} bundled meshes outside the archive.\n\n- A named mesh still needs border, side, attachment and registration review.\n- A source match omitted from the female model identifies an exclusion, not permission to relabel male pelvic anatomy as female.\n- A missing name in both source and app requires a different source or segmentation investigation; renaming an arbitrary mesh does not resolve it.\n- Source files are pinned and checksum-verified. Evidence, concepts, element IDs, archive names, aliases and exclusions are retained in \`data/anatomy/coverage-baseline.json\`.\n- The anterior abdominal-wall concepts currently resolve to the two external-oblique meshes. This inventory does not assume that those meshes constitute complete or correctly separated abdominal layers.\n\n## Sources\n\nOfficial [BodyParts3D download](https://dbarchive.biosciencedbc.jp/en/bodyparts3d/download.html), downloaded ${metadata.retrievedAt}, licensed CC BY 4.0 (see \`public/ATTRIBUTION.md\`). The source snapshot records original URLs and SHA-256 hashes. The mesh-name index records source header names, not inferred labels.\n`;
 fs.mkdirSync(path.join(root,'docs'),{recursive:true});fs.writeFileSync(path.join(root,'docs/anatomy-coverage.md'),doc);
 console.log(`Audited ${targets.length} teaching targets across three atlases. ${targets.filter(t=>t.atlases.female.status==='not_separately_identified').length} have no separately identified female-study representation. See docs/anatomy-coverage.md.`);
 return report;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)run(path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'));
