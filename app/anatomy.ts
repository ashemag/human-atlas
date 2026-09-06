export type SystemId = 'skeletal'|'muscular'|'arterial'|'venous'|'nervous'|'digestive'|'respiratory'|'urinary'|'reproductive'|'lymphatic'|'endocrine'|'integumentary'|'connective'|'sensory'|'cardiac'|'pregnancy';
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
 {id:'pregnancy',name:'Pregnancy reference',color:'#c9a8ad',description:'Placental and umbilical structures included in the female reference assembly. They represent a pregnancy reference rather than the non-pregnant state, and are hidden unless enabled.'},
];
export interface Part {id:string;name:string;conceptId:string;system:SystemId;chunk:number;positions:number;normals:number;indices:number;vertexCount:number;indexCount:number;bounds:[number[],number[]]}
export interface Concept {id:string;name:string;elements:string[]}
export interface Atlas {version:string;sex?:'male'|'female';source?:string;scope?:string;parts:Part[];concepts:Concept[];chunks:{url:string;bytes:number;gzip?:string;gzipBytes?:number;system?:SystemId;parts?:number}[];triangles:number}
export type View = 'three-quarter'|'front'|'back'|'side';
export interface SceneState {inspectorOpen?:boolean;explode:number;visible:SystemId[];selected:string[];isolate:boolean;view:View;rotate:boolean;reset:number}
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
 'kidney':'A paired organ at the back of the abdomen. Its nephrons filter blood, reabsorb what the body needs, and produce urine that drains into the ureter.',
 'ureter':'A muscular tube carrying urine from the kidney to the bladder. Waves of contraction move urine along it rather than gravity alone.',
 'urethra':'The final passage carrying urine from the bladder out of the body.',
 'right lung':'The right lung has three lobes. Air arriving through the bronchial tree reaches alveoli, where oxygen and carbon dioxide exchange with the blood.',
 'left lung':'The left lung has two lobes, leaving room for the heart. Its bronchial tree ends in alveoli where gas exchange takes place.',
 'bronchus':'The airways branching from the trachea into each lung, dividing repeatedly into smaller passages that end at the alveoli.',
 'esophagus':'A muscular tube from the pharynx to the stomach. Coordinated waves of contraction carry swallowed food downward.',
 'small intestine':'The long, coiled segment where most chemical digestion and nutrient absorption occur, beginning at the duodenum.',
 'large intestine':'The final segment of the digestive tract. It absorbs water and salts and forms and stores the residue for elimination.',
 'duodenum':'The first part of the small intestine. Bile and pancreatic enzymes enter here to continue digestion.',
 'gallbladder':'A small sac beneath the liver that concentrates and stores bile, releasing it into the duodenum.',
 'rectum':'The terminal part of the large intestine, which stores residue before elimination.',
 'cecum':'The pouch at the start of the large intestine, where the small intestine joins it.',
 'testis':'A paired organ producing sperm and testosterone. Its seminiferous tubules are the site of sperm formation.',
 'epididymis':'A coiled duct on the testis where sperm mature and are stored before transport.',
 'seminal vesicle':'A paired gland contributing much of the fluid volume of semen, including sugars that support sperm.',
 'prostate':'A gland surrounding the start of the urethra. Its secretions form part of the seminal fluid.',
 'right atrium':'The chamber receiving deoxygenated blood from the body through the venae cavae. It empties into the right ventricle.',
 'left atrium':'The chamber receiving oxygenated blood from the lungs through the pulmonary veins. It empties into the left ventricle.',
 'right ventricle':'The chamber pumping deoxygenated blood into the pulmonary artery and on to the lungs. Its wall is thinner than the left ventricle because the pulmonary circuit is a low-pressure one.',
 'left ventricle':'The chamber pumping oxygenated blood into the aorta and around the body. Its thick muscular wall generates the pressure the systemic circuit needs.',
 'tricuspid valve':'The valve between the right atrium and right ventricle. Its three leaflets close during ventricular contraction to stop blood flowing back into the atrium.',
 'mitral valve':'The valve between the left atrium and left ventricle, also called the bicuspid valve. Its two leaflets close during ventricular contraction.',
 'pulmonary valve':'The valve at the exit of the right ventricle. Its three cusps close as the ventricle relaxes, preventing backflow from the pulmonary artery.',
 'aortic valve':'The valve at the exit of the left ventricle. Its three cusps close as the ventricle relaxes, holding blood in the aorta.',
 'ovary':'A paired organ producing ova and the hormones estrogen and progesterone. Follicles within it mature and release an ovum at ovulation.',
 'uterus':'The muscular organ in which an embryo implants and develops. Its inner lining, the endometrium, thickens and is shed across the menstrual cycle.',
 'fallopian tube':'The paired tube carrying an ovum from the ovary toward the uterus. Fertilization normally occurs in its ampulla.',
 'vagina':'The muscular canal from the cervix to the exterior, forming the birth canal and receiving the penis during intercourse.',
 'lungs':'The paired organs of gas exchange. Air reaching their alveoli exchanges oxygen and carbon dioxide with the surrounding capillaries.',
};

/** Focused study modes.
 *
 * Each mode narrows the atlas to the systems one topic actually needs, which
 * with system-pure chunks is also all that gets downloaded. `systems` is kept
 * deliberately tight: the heart concept, for example, reaches into muscular,
 * arterial and venous geometry, and pulling those in would cost 19 MB to look
 * at the chambers and valves.
 */
/** A focused study mode is a guided walkthrough, not another way to switch a
 * system on: it narrows the atlas to the systems one topic needs, then steps
 * through named structures in the order they are taught, framing and explaining
 * each. Every step lists candidate concept ids and the first present in the
 * loaded atlas wins — the two reference bodies use different vocabularies
 * (BodyParts3D is FMA, the Human Reference Atlas is HRA), and steps that
 * resolve in neither are skipped rather than duplicating a mode per body. */
export interface Mode {id:string;name:string;systems:SystemId[];summary:string;tour:string[][]}
export const MODES: Mode[] = [
 {id:'heart',name:'Heart',systems:['cardiac'],summary:'Follow blood through the four chambers and the valves that keep it moving one way.',
  tour:[['FMA7096','HRA:VH_F_right_atrium'],['FMA7234'],['FMA7098','HRA:VH_F_right_ventricle'],['FMA7246'],['FMA7097','HRA:VH_F_left_atrium'],['FMA7235'],['FMA7101','HRA:VH_F_left_ventricle'],['FMA7236'],['FMA7088','HRA:VH_F_heart']]},
 {id:'respiratory',name:'Respiratory',systems:['respiratory'],summary:'Follow air from the trachea down the bronchial tree into both lungs.',
  tour:[['FMA7394','HRA:VH_F_trachea'],['FMA7409'],['FMA7309'],['FMA7310'],['HRA:VH_F_lungs']]},
 {id:'digestive',name:'Digestive',systems:['digestive'],summary:'Follow a meal from esophagus to rectum, past the liver and pancreas.',
  tour:[['FMA7131'],['FMA7148'],['FMA7206'],['FMA7200','HRA:VH_F_small_intestine'],['FMA7201'],['FMA14541'],['FMA14544'],['FMA7197','HRA:VH_F_liver'],['FMA7202'],['FMA7198']]},
 {id:'kidney',name:'Kidney',systems:['urinary'],summary:'Follow urine from the kidney down the ureter to the bladder and out.',
  tour:[['FMA7203','HRA:VH_F_kidney'],['FMA9704','HRA:VH_F_renal_pelvis_ureter'],['FMA15900','HRA:VH_F_urinary_bladder'],['FMA19667']]},
 {id:'reproductive',name:'Reproductive',systems:['reproductive'],summary:'The reproductive tract, its gametes and the accessory structures around it.',
  tour:[['FMA7210','HRA:VH_F_ovary'],['FMA18255','HRA:VH_F_fallopian_tube'],['FMA19386','HRA:VH_F_uterus'],['FMA9600','HRA:VH_F_vagina']]},
];


/** The reference bodies this viewer ships. */
export interface Body {id:'male'|'female';label:string;file:string;source:string}
export const BODIES: Body[] = [
 {id:'male',label:'Male',file:'atlas.json',source:'BodyParts3D'},
 {id:'female',label:'Female',file:'atlas-female.json',source:'Human Reference Atlas'},
];
export function explanation(name:string,system:SystemId){return EXPLANATIONS[name.toLowerCase()] ?? SYSTEMS.find(s=>s.id===system)?.description ?? '';}

/** The steps of a mode's walkthrough that this atlas can actually show.
 *
 * A step resolves to the first of its candidate concepts present here, and is
 * kept only if that concept has geometry inside the mode's own systems — a step
 * that does not would drag in systems the mode deliberately excludes.
 */
export function tourFor(atlas:Atlas,mode:Mode):Concept[]{
 const systemOf=new Map(atlas.parts.map(p=>[p.id,p.system]));
 const byId=new Map(atlas.concepts.map(c=>[c.id,c]));
 const steps:Concept[]=[];
 for(const step of mode.tour){
  const concept=step.map(id=>byId.get(id)).find(Boolean);
  if(!concept||steps.some(s=>s.id===concept.id))continue;
  if(concept.elements.some(e=>mode.systems.includes(systemOf.get(e) as SystemId)))steps.push(concept);
 }
 return steps;
}

/** A concept's parts within the systems on screen.
 *
 * Concepts cross systems — the heart concept reaches into muscular, arterial
 * and venous geometry — so selecting one whole would fetch systems the viewer
 * has hidden. Falls back to the full concept when the filter leaves nothing.
 */
export function elementsWithin(concept:Concept,parts:Map<string,Part>,systems:SystemId[]){
 const inside=concept.elements.filter(id=>{const p=parts.get(id);return !!p&&systems.includes(p.system);});
 return inside.length?inside:concept.elements;
}
