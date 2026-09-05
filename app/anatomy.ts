export type SystemId = 'skeletal'|'muscular'|'arterial'|'venous'|'nervous'|'digestive'|'respiratory'|'urinary'|'reproductive'|'lymphatic'|'endocrine'|'integumentary'|'connective'|'sensory'|'cardiac';
export const SYSTEMS: {id:SystemId;name:string;color:string;description:string}[] = [
 {id:'skeletal',name:'Skeleton',color:'#e2d9ba',description:'Bones form the supporting framework of the body, protect organs, and provide attachment points for muscles. Their internal tissue also stores minerals and produces blood cells.'},
 {id:'muscular',name:'Muscles',color:'#a85b50',description:'Skeletal muscles generate movement by pulling on their attachments. Together with tendons, they move joints, stabilize posture, and produce heat.'},
 {id:'cardiac',name:'Heart',color:'#b96760',description:'The heart is a muscular pump with four chambers. Its valves direct blood forward through the pulmonary and systemic circuits.'},
 {id:'sensory',name:'Sensory organs',color:'#b0c8ce',description:'These structures contribute to special senses, including sight, hearing, and balance. Their specialized tissues detect stimuli and work with the nervous system to convey information.'},
 {id:'arterial',name:'Arteries',color:'#c05245',description:'The heart drives blood through the circulation. Arteries carry blood away from the heart to supply tissues or, in the pulmonary circuit, to the lungs.'},
 {id:'venous',name:'Veins',color:'#527c9f',description:'Veins return blood toward the heart. Superficial and deep networks collect blood from the tissues; the pulmonary veins bring oxygenated blood back from the lungs.'},
 {id:'nervous',name:'Nervous system',color:'#d8b565',description:'The brain, spinal cord, and peripheral nerves carry and process signals. They support sensation, movement, coordination, and automatic regulation of body functions.'},
 {id:'respiratory',name:'Respiratory',color:'#b98991',description:'The airways conduct air to the lungs, where oxygen and carbon dioxide move between air and blood. Breathing depends on pressure changes produced by respiratory muscles.'},
 {id:'digestive',name:'Digestive',color:'#b8916b',description:'The digestive tract breaks down food, absorbs nutrients and water, and moves waste onward. Accessory organs contribute bile and digestive enzymes.'},
 {id:'urinary',name:'Urinary',color:'#b47961',description:'The kidneys filter blood and regulate fluid, electrolyte, and acid–base balance. Urine travels through the ureters to the bladder and exits through the urethra.'},
 {id:'lymphatic',name:'Lymphatic',color:'#879f7c',description:'Lymphatic vessels return excess tissue fluid to the circulation. Lymph nodes and other lymphoid organs support immune surveillance and responses.'},
 {id:'endocrine',name:'Endocrine',color:'#c5a09a',description:'Endocrine organs release hormones into the blood to coordinate processes such as metabolism, growth, stress responses, and reproduction.'},
 {id:'reproductive',name:'Reproductive',color:'#bda098',description:'The male reproductive structures represented here contribute to sperm production, maturation, transport, and the production of sex hormones.'},
 {id:'integumentary',name:'Body surface',color:'#ba9b7d',description:'The body surface provides an outer anatomical reference. The integumentary system forms a protective barrier and contributes to sensation and temperature regulation.'},
 {id:'connective',name:'Connective tissue',color:'#aec3bb',description:'Cartilage, ligaments, and other connective tissues support, connect, and separate structures. Their roles include stabilizing joints and distributing mechanical loads.'},
];
export interface Part {id:string;name:string;conceptId:string;system:SystemId;chunk:number;positions:number;normals:number;indices:number;vertexCount:number;indexCount:number;bounds:[number[],number[]]}
export interface Concept {id:string;name:string;elements:string[]}
export interface Atlas {version:string;sex?:'male';source?:string;scope?:string;parts:Part[];concepts:Concept[];chunks:{url:string;bytes:number;gzip?:string;gzipBytes?:number}[];triangles:number}
export type View = 'three-quarter'|'front'|'back'|'side';
export type RegionId='head-neck'|'torso'|'abdomen'|'arm'|'pelvis'|'legs';
export const REGIONS:{id:RegionId;name:string;label:string}[]=[
 {id:'head-neck',name:'Head & neck',label:'Head'},
 {id:'torso',name:'Torso',label:'Torso'},
 {id:'abdomen',name:'Abdomen',label:'Abdomen'},
 {id:'arm',name:'Arm',label:'Arm'},
 {id:'pelvis',name:'Pelvis & hips',label:'Pelvis'},
 {id:'legs',name:'Legs',label:'Legs'},
];
export type AreaId='orbit'|'willis'|'brainstem'|'larynx'|'heart'|'lung-root'|'porta'|'celiac'|'kidneys'|'brachial-plexus'|'axilla'|'cubital'|'wrist'|'hand'|'pelvic-viscera'|'popliteal'|'foot';
export const AREAS:{id:AreaId;name:string;regions:RegionId[];match:RegExp}[]=[
 {id:'orbit',name:'Orbit',regions:['head-neck'],match:/(choroid|cornea|iris|sclera|lens|eyeball|optic nerve|optic chiasm|optic tract|ophthalmic nerve|lacrimal nerve|oculomotor|trochlear nerve|nasociliary|ciliary ganglion|ciliary nerve|frontal nerve|infratrochlear|supra-orbital nerve|supratrochlear|check ligament|levator palpebrae|trochlea of (left|right) superior oblique|(left|right) (inferior|superior|lateral|medial) rectus|(left|right) (inferior|superior) oblique)/i},
 {id:'willis',name:'Circle of Willis',regions:['head-neck'],match:/(anterior communicating|posterior communicating|precommunicating part|cerebral arterial circle|basilar artery|internal carotid|vertebral artery|postcommunicating)/i},
 {id:'brainstem',name:'Brainstem',regions:['head-neck'],match:/(medulla oblongata|^pons$|midbrain|cerebral aqueduct|(inferior|superior) colliculus|peduncle of midbrain|interpeduncular)/i},
 {id:'larynx',name:'Larynx',regions:['head-neck'],match:/(crico-arytenoid|thyro-arytenoid|arytenoid|epiglot|vocalis|cricoid|thyroid cartilage|hyoid bone|cricothyroid|vocal ligament|conus elasticus|aryepiglottic)/i},
 {id:'heart',name:'Heart',regions:['torso'],match:/(cavity of (left|right) (ventricle|atrium)|mitral|tricuspid|(aortic|pulmonary) valve|cusp of|wall of ventricle|papillary muscle|coronary (artery|sinus)|ascending aorta|arch of aorta)/i},
 {id:'lung-root',name:'Lung roots',regions:['torso'],match:/(main bronchus|pulmonary arter|pulmonary vein)/i},
 {id:'porta',name:'Porta hepatis',regions:['abdomen'],match:/(portal vein|hepatic artery|bile duct|cystic duct|hepatic duct|gallbladder|caudate lobe of liver)/i},
 {id:'celiac',name:'Celiac trunk',regions:['abdomen'],match:/(celiac trunk|celiac artery|splenic artery|left gastric|common hepatic artery|hepatic artery proper)/i},
 {id:'kidneys',name:'Kidneys',regions:['abdomen'],match:/(kidney|adrenal|suprarenal|renal arter|renal vein)/i},
 {id:'brachial-plexus',name:'Brachial plexus',regions:['arm','head-neck'],match:/(scalenus|subclavius|subclavian artery|subclavian vein|axillary artery|axillary vein|clavicle|thoraco-acromial|circumflex humeral|circumflex scapular|subscapular artery|subscapular vein|thoracodorsal artery|thoracodorsal vein|vertebral artery)/i},
 {id:'axilla',name:'Axilla',regions:['arm'],match:/(axillary (artery|vein)|subscapular|thoracodorsal|circumflex (humeral|scapular)|latissimus|teres major|teres minor|pectoralis minor)/i},
 {id:'cubital',name:'Cubital fossa',regions:['arm'],match:/(median cubital|brachialis|anconeus|ulnar recurrent|radial recurrent|ulnar collateral|recurrent interosseous)/i},
 {id:'wrist',name:'Wrist',regions:['arm'],match:/(flexor retinaculum of .+ wrist|scaphoid|lunate|triquetral|pisiform|hamate|capitate|trapezium|trapezoid)/i},
 {id:'hand',name:'Hand',regions:['arm'],match:/(finger|thumb|pollic|metacar|thenar|palmar digital|interossei of (left|right) hand|lumbricals of (left|right) hand|opponens|abductor digiti minimi of (left|right) hand|dorsal venous network of .+ hand)/i},
 {id:'pelvic-viscera',name:'Pelvic viscera',regions:['pelvis'],match:/(urinary bladder|prostate|rectum|seminal|deferent|epididymis|testis)/i},
 {id:'popliteal',name:'Popliteal fossa',regions:['legs'],match:/(popliteal|popliteus|genicular)/i},
 {id:'foot',name:'Foot',regions:['legs'],match:/\b(foot|toe|talus|calcaneus|metatars|cuneiform|navicular|cuboid|plantar|hallucis|dorsal venous arch of .+ foot)/i},
];
export interface SceneState {inspectorOpen?:boolean;explode:number;visible:SystemId[];selected:string[];isolate:boolean;region:RegionId|null;area:AreaId|null;view:View;rotate:boolean;reset:number}
/** Body-normalized Y of C7 vs T1: head/neck includes C7 and above. Arm floor sits below hanging fingertips, still above the femoral centroid. */
export const REGION_Y={head:0.835,torso:0.7,abdomen:0.56,pelvis:0.45,arm:0.41,shoulder:0.73} as const;
const ARM_LATERAL=0.22,SHOULDER_LATERAL=0.165;
const ARM_NAME=/\b(clavicle|scapula|subclavius)\b/i;
export function bodyBounds(parts:Part[]):[number[],number[]]{
 const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
 for(const p of parts)for(let i=0;i<3;i++){min[i]=Math.min(min[i],p.bounds[0][i]);max[i]=Math.max(max[i],p.bounds[1][i]);}
 return [min,max];
}
/** Assign each mesh to one region from its AABB centroid in the atlas body box. Shoulder girdle names override a too-medial clavicle/scapula. */
export function partRegion(part:Part,body:[number[],number[]]):RegionId{
 if(ARM_NAME.test(part.name))return 'arm';
 const [min,max]=body,size=[max[0]-min[0],max[1]-min[1]];
 const cx=(part.bounds[0][0]+part.bounds[1][0])/2,cy=(part.bounds[0][1]+part.bounds[1][1])/2;
 const ny=size[1]>0?(cy-min[1])/size[1]:0,lat=size[0]>0?Math.abs((cx-min[0])/size[0]-.5):0;
 if(ny>=REGION_Y.head)return 'head-neck';
 if(ny>=REGION_Y.arm&&ny<REGION_Y.head&&(lat>=ARM_LATERAL||ny>=REGION_Y.shoulder&&lat>=SHOULDER_LATERAL))return 'arm';
 if(ny>=REGION_Y.torso)return 'torso';
 if(ny>=REGION_Y.abdomen)return 'abdomen';
 if(ny>=REGION_Y.pelvis)return 'pelvis';
 return 'legs';
}
export function partInArea(part:Part,areaId:AreaId,body:[number[],number[]]){
 const area=AREAS.find(a=>a.id===areaId);if(!area||!area.match.test(part.name))return false;
 if(area.id==='hand'&&partRegion(part,body)!=='arm')return false;
 if(area.id==='foot'&&partRegion(part,body)!=='legs')return false;
 return true;
}
export function isPartVisible(part:Part,state:Pick<SceneState,'visible'|'selected'|'isolate'|'region'|'area'>,body:[number[],number[]]){
 if(state.isolate)return state.selected.includes(part.id);
 const selected=state.selected.includes(part.id);
 if(!state.visible.includes(part.system)&&!selected)return false;
 if(state.area)return selected||partInArea(part,state.area,body);
 if(state.region&&partRegion(part,body)!==state.region&&!selected)return false;
 return true;
}
export const DEFAULT_VISIBLE:SystemId[] = ['cardiac','sensory','skeletal','muscular','arterial','venous','nervous','respiratory','digestive','urinary','lymphatic','endocrine','reproductive','connective'];
export const EXPLANATIONS:Record<string,string> = {
 'heart':'A muscular pump in the chest. Its right side sends blood to the lungs; its left side sends blood through the systemic circulation.',
 'liver':'A large organ beneath the right side of the diaphragm. It processes absorbed nutrients, produces bile, and synthesizes many proteins carried in the blood.',
 'brain':'The central organ of the nervous system. Its interconnected regions support perception, movement, memory, language, and the regulation of bodily functions.',
 'stomach':'A muscular chamber between the esophagus and small intestine. It stores and mixes food with acid and enzymes before releasing it into the duodenum.',
 'spleen':'A lymphoid organ in the upper left abdomen. It filters blood, removes aging blood cells, and participates in immune responses.',
 'pancreas':'An abdominal organ with digestive and endocrine roles. It supplies enzymes to the small intestine and releases hormones including insulin and glucagon.',
 'urinary bladder':'A muscular reservoir in the pelvis that stores urine arriving from the kidneys through the ureters.',
 'trachea':'The main airway connecting the larynx to the bronchi. Its cartilage supports keep the airway open during breathing.',
 'diaphragm':'A broad muscle separating the chest and abdomen. When it contracts, it increases chest volume and helps draw air into the lungs.',
};
export function explanation(name:string,system:SystemId){return EXPLANATIONS[name.toLowerCase()] ?? SYSTEMS.find(s=>s.id===system)?.description ?? '';}
