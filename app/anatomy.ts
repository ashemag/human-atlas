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
export interface Atlas {version:string;sex?:'male';source?:string;scope?:string;parts:Part[];concepts:Concept[];chunks:{url:string;bytes:number;gzip?:string;gzipBytes?:number;system?:SystemId;parts?:number}[];triangles:number}
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
};

/** Focused study modes.
 *
 * Each mode narrows the atlas to the systems one topic actually needs, which
 * with system-pure chunks is also all that gets downloaded. `systems` is kept
 * deliberately tight: the heart concept, for example, reaches into muscular,
 * arterial and venous geometry, and pulling those in would cost 19 MB to look
 * at the chambers and valves.
 */
export interface Mode {id:string;name:string;systems:SystemId[];focus:string;summary:string;tour:string[]}
export const MODES: Mode[] = [
 {id:'heart',name:'Heart',systems:['cardiac'],focus:'FMA7088',summary:'Chambers, valves and septa of the four-chambered pump.',tour:['FMA7088']},
 {id:'respiratory',name:'Respiratory',systems:['respiratory'],focus:'FMA7394',summary:'The airway from the trachea through the bronchial tree into both lungs.',tour:['FMA7394','FMA7409','FMA7309','FMA7310']},
 {id:'digestive',name:'Digestive',systems:['digestive'],focus:'FMA7148',summary:'The tract from esophagus to rectum, with the liver and pancreas.',tour:['FMA7131','FMA7148','FMA7206','FMA7200','FMA7201','FMA14544','FMA7197','FMA7202','FMA7198']},
 {id:'kidney',name:'Kidney',systems:['urinary'],focus:'FMA7203',summary:'Kidneys, ureters, bladder and urethra as one drainage path.',tour:['FMA7203','FMA9704','FMA15900','FMA19667']},
 {id:'reproductive',name:'Reproductive',systems:['reproductive'],focus:'FMA7210',summary:'Sperm production, maturation and transport, and the accessory glands.',tour:['FMA7210','FMA18255','FMA19386','FMA9600']},
];
export function explanation(name:string,system:SystemId){return EXPLANATIONS[name.toLowerCase()] ?? SYSTEMS.find(s=>s.id===system)?.description ?? '';}
