import type { AddedLocale } from "./locales.ts";
import type { SystemId } from "../../app/core/anatomy.ts";

// Independently authored, conservative glossary; see docs/LOCALIZATION.md.
// No word-by-word translation of unverified anatomical branches.
type Names = readonly [string, string, string];
const glossary: Record<string, Names> = {
  heart: ["corazón", "心臓", "심장"],
  brain: ["encéfalo", "脳", "뇌"],
  cerebrum: ["cerebro", "大脳", "대뇌"],
  cerebellum: ["cerebelo", "小脳", "소뇌"],
  brainstem: ["tronco encefálico", "脳幹", "뇌줄기"],
  "spinal cord": ["médula espinal", "脊髄", "척수"],
  liver: ["hígado", "肝臓", "간"],
  stomach: ["estómago", "胃", "위"],
  spleen: ["bazo", "脾臓", "지라"],
  pancreas: ["páncreas", "膵臓", "이자"],
  gallbladder: ["vesícula biliar", "胆嚢", "쓸개"],
  trachea: ["tráquea", "気管", "기관"],
  esophagus: ["esófago", "食道", "식도"],
  "urinary bladder": ["vejiga urinaria", "膀胱", "방광"],
  "small intestine": ["intestino delgado", "小腸", "작은창자"],
  "large intestine": ["intestino grueso", "大腸", "큰창자"],
  duodenum: ["duodeno", "十二指腸", "샘창자"],
  jejunum: ["yeyuno", "空腸", "빈창자"],
  ileum: ["íleon", "回腸", "돌창자"],
  cecum: ["ciego", "盲腸", "막창자"],
  rectum: ["recto", "直腸", "곧창자"],
  appendix: ["apéndice vermiforme", "虫垂", "막창자꼬리"],
  "vermiform appendix": ["apéndice vermiforme", "虫垂", "막창자꼬리"],
  colon: ["colon", "結腸", "잘록창자"],
  "ascending colon": ["colon ascendente", "上行結腸", "오름잘록창자"],
  "transverse colon": ["colon transverso", "横行結腸", "가로잘록창자"],
  "descending colon": ["colon descendente", "下行結腸", "내림잘록창자"],
  "sigmoid colon": ["colon sigmoide", "S状結腸", "구불잘록창자"],
  lung: ["pulmón", "肺", "허파"],
  lungs: ["pulmones", "肺", "허파"],
  kidney: ["riñón", "腎臓", "콩팥"],
  kidneys: ["riñones", "腎臓", "콩팥"],
  "left lung": ["pulmón izquierdo", "左肺", "왼허파"],
  "right lung": ["pulmón derecho", "右肺", "오른허파"],
  "left kidney": ["riñón izquierdo", "左腎臓", "왼쪽 콩팥"],
  "right kidney": ["riñón derecho", "右腎臓", "오른쪽 콩팥"],
  thymus: ["timo", "胸腺", "가슴샘"],
  prostate: ["próstata", "前立腺", "전립샘"],
  testis: ["testículo", "精巣", "고환"],
  "left testis": ["testículo izquierdo", "左精巣", "왼쪽 고환"],
  "right testis": ["testículo derecho", "右精巣", "오른쪽 고환"],
  ovary: ["ovario", "卵巣", "난소"],
  "left ovary": ["ovario izquierdo", "左卵巣", "왼쪽 난소"],
  "right ovary": ["ovario derecho", "右卵巣", "오른쪽 난소"],
  uterus: ["útero", "子宮", "자궁"],
  vagina: ["vagina", "腟", "질"],
  "uterine tube": ["trompa uterina", "卵管", "자궁관"],
  "left uterine tube": ["trompa uterina izquierda", "左卵管", "왼쪽 자궁관"],
  "right uterine tube": ["trompa uterina derecha", "右卵管", "오른쪽 자궁관"],
  "left breast": ["mama izquierda", "左乳房", "왼쪽 유방"],
  "right breast": ["mama derecha", "右乳房", "오른쪽 유방"],
  breast: ["mama", "乳房", "유방"],
  diaphragm: ["diafragma", "横隔膜", "가로막"],
  thyroid: ["glándula tiroides", "甲状腺", "갑상샘"],
  "thyroid gland": ["glándula tiroides", "甲状腺", "갑상샘"],
  "adrenal gland": ["glándula suprarrenal", "副腎", "부신"],
  "left adrenal gland": ["glándula suprarrenal izquierda", "左副腎", "왼쪽 부신"],
  "right adrenal gland": ["glándula suprarrenal derecha", "右副腎", "오른쪽 부신"],
  "pituitary gland": ["hipófisis", "下垂体", "뇌하수체"],
  larynx: ["laringe", "喉頭", "후두"],
  pharynx: ["faringe", "咽頭", "인두"],
  tongue: ["lengua", "舌", "혀"],
  skin: ["piel", "皮膚", "피부"],
  penis: ["pene", "陰茎", "음경"],
  scrotum: ["escroto", "陰嚢", "음낭"],
  aorta: ["aorta", "大動脈", "대동맥"],
  "ascending aorta": ["aorta ascendente", "上行大動脈", "오름대동맥"],
  "descending aorta": ["aorta descendente", "下行大動脈", "내림대동맥"],
  "abdominal aorta": ["aorta abdominal", "腹大動脈", "배대동맥"],
  "superior vena cava": ["vena cava superior", "上大静脈", "위대정맥"],
  "inferior vena cava": ["vena cava inferior", "下大静脈", "아래대정맥"],
  "left atrium": ["atrio izquierdo", "左心房", "왼심방"],
  "right atrium": ["atrio derecho", "右心房", "오른심방"],
  "left ventricle": ["ventrículo izquierdo", "左心室", "왼심실"],
  "right ventricle": ["ventrículo derecho", "右心室", "오른심실"],
  skull: ["cráneo", "頭蓋", "머리뼈"],
  mandible: ["mandíbula", "下顎骨", "아래턱뼈"],
  sternum: ["esternón", "胸骨", "복장뼈"],
  sacrum: ["sacro", "仙骨", "엉치뼈"],
  coccyx: ["cóccix", "尾骨", "꼬리뼈"],
  clavicle: ["clavícula", "鎖骨", "빗장뼈"],
  scapula: ["escápula", "肩甲骨", "어깨뼈"],
  humerus: ["húmero", "上腕骨", "위팔뼈"],
  radius: ["radio", "橈骨", "노뼈"],
  ulna: ["ulna", "尺骨", "자뼈"],
  femur: ["fémur", "大腿骨", "넙다리뼈"],
  patella: ["patela", "膝蓋骨", "무릎뼈"],
  tibia: ["tibia", "脛骨", "정강뼈"],
  fibula: ["fíbula", "腓骨", "종아리뼈"],
  talus: ["talus", "距骨", "목말뼈"],
  calcaneus: ["calcáneo", "踵骨", "발꿈치뼈"],
  "hip bone": ["hueso coxal", "寛骨", "볼기뼈"],
};

// Explicitly restricted to whole, paired bones with known Spanish gender.
const pairedBones: Record<string, "m" | "f"> = {
  clavicle: "f", scapula: "f", humerus: "m", radius: "m", ulna: "f",
  femur: "m", patella: "f", tibia: "f", fibula: "f", talus: "m", calcaneus: "m", "hip bone": "m",
};
for (const [name, gender] of Object.entries(pairedBones)) {
  const [es, ja, ko] = glossary[name];
  glossary[`left ${name}`] = [`${es} ${gender === "f" ? "izquierda" : "izquierdo"}`, `左${ja}`, `왼쪽 ${ko}`];
  glossary[`right ${name}`] = [`${es} ${gender === "f" ? "derecha" : "derecho"}`, `右${ja}`, `오른쪽 ${ko}`];
}

const aliases: Record<string, Names> = {
  brain: ["cerebro", "のう", ""],
  spleen: ["", "ひぞう", "비장"],
  pancreas: ["", "すいぞう", "췌장"],
  gallbladder: ["", "たんのう", "담낭"],
  kidney: ["", "じんぞう", "신장"],
  lung: ["", "はい", "폐"],
  prostate: ["", "ぜんりつせん", "전립선"],
  "uterine tube": ["trompa de Falopio", "らんかん", "난관"],
  "urinary bladder": ["vejiga", "ぼうこう", ""],
  heart: ["", "しんぞう", ""],
  femur: ["", "だいたいこつ", "대퇴골"],
  scapula: ["omóplato", "けんこうこつ", "견갑골"],
  clavicle: ["", "さこつ", "쇄골"],
  humerus: ["", "じょうわんこつ", "상완골"],
  radius: ["", "とうこつ", "요골"],
  ulna: ["cúbito", "しゃっこつ", "척골"],
  patella: ["rótula", "しつがいこつ", "슬개골"],
  tibia: ["", "けいこつ", "경골"],
  fibula: ["peroné", "ひこつ", "비골"],
  diaphragm: ["", "おうかくまく", "횡격막"],
};
const column: Record<AddedLocale, number> = { es: 0, ja: 1, ko: 2 };
export const anatomyGlossary = glossary;
export function localizedAnatomyName(name: string, locale: AddedLocale) {
  return glossary[name.toLowerCase()]?.[column[locale]];
}
export function anatomyAliases(name: string) {
  const key = name.toLowerCase();
  // Bare aliases belong to unsided concepts. Preserve side when searching bones.
  if (aliases[key]) return aliases[key].filter(Boolean);
  const match = /^(left|right) (.+)$/.exec(key);
  if (!match || !glossary[key] || !aliases[match[2]]) return [];
  const [es, ja, ko] = aliases[match[2]];
  const left = match[1] === "left";
  return [es && `${es} ${pairedBones[match[2]] === "f" ? left ? "izquierda" : "derecha" : left ? "izquierdo" : "derecho"}`,
    ja && `${left ? "左" : "右"}${ja}`, ko && `${left ? "왼쪽" : "오른쪽"} ${ko}`].filter(Boolean);
}

export const SYSTEM_NAMES: Record<SystemId, Names> = {
  skeletal: ["Esqueleto", "骨格", "골격"], muscular: ["Músculos", "筋", "근육"],
  cardiac: ["Corazón", "心臓", "심장"], sensory: ["Órganos de los sentidos", "感覚器", "감각 기관"],
  arterial: ["Arterias", "動脈", "동맥"], venous: ["Venas", "静脈", "정맥"],
  nervous: ["Sistema nervioso", "神経系", "신경계통"], respiratory: ["Aparato respiratorio", "呼吸器系", "호흡계통"],
  digestive: ["Aparato digestivo", "消化器系", "소화계통"], urinary: ["Aparato urinario", "泌尿器系", "비뇨계통"],
  lymphatic: ["Sistema linfático", "リンパ系", "림프계통"], endocrine: ["Sistema endocrino", "内分泌系", "내분비계통"],
  reproductive: ["Aparato reproductor", "生殖器系", "생식계통"], mammary: ["Tejido mamario", "乳房組織", "유방 조직"],
  integumentary: ["Superficie corporal", "体表", "체표"], connective: ["Tejido conjuntivo", "結合組織", "결합 조직"],
};
export function localizedSystemName(id: SystemId, locale: AddedLocale) { return SYSTEM_NAMES[id][column[locale]]; }

// Original summaries, kept short and aligned across languages. Not source quotations.
export const SYSTEM_SUMMARIES: Record<SystemId, Names> = {
  skeletal: ["Los huesos sostienen el cuerpo, protegen órganos y sirven de inserción a los músculos. La médula ósea produce células sanguíneas.", "骨はからだを支え、臓器を保護し、筋の付着部となります。骨髄では血球がつくられます。", "뼈는 인체를 지지하고 장기를 보호하며 근육의 부착 부위가 됩니다. 골수에서는 혈액 세포가 생성됩니다."],
  muscular: ["Los músculos esqueléticos producen movimiento y ayudan a mantener la postura y generar calor.", "骨格筋は運動を生み出し、姿勢の維持や熱の産生を担います。", "뼈대근육은 운동을 일으키고 자세 유지와 열 생성에 기여합니다."],
  cardiac: ["El corazón impulsa la sangre hacia los pulmones y el resto del cuerpo. Las válvulas regulan la dirección del flujo.", "心臓は血液を肺と全身へ送り出します。弁は血流の向きを調整します。", "심장은 혈액을 폐와 온몸으로 보냅니다. 판막은 혈류의 방향을 조절합니다."],
  sensory: ["Los órganos de los sentidos participan en la visión, la audición, el equilibrio y otras funciones sensoriales.", "感覚器は視覚、聴覚、平衡感覚などに関わります。", "감각 기관은 시각, 청각, 평형 감각 등에 관여합니다."],
  arterial: ["Las arterias conducen la sangre desde el corazón hacia los tejidos o los pulmones.", "動脈は心臓から組織や肺へ血液を運びます。", "동맥은 심장에서 조직이나 폐로 혈액을 운반합니다."],
  venous: ["Las venas devuelven la sangre al corazón. Las venas pulmonares transportan sangre oxigenada desde los pulmones.", "静脈は血液を心臓へ戻します。肺静脈は肺から酸素を含む血液を運びます。", "정맥은 혈액을 심장으로 돌려보냅니다. 폐정맥은 폐에서 산소가 풍부한 혈액을 운반합니다."],
  nervous: ["El encéfalo, la médula espinal y los nervios procesan y transmiten señales para la sensibilidad, el movimiento y la regulación corporal.", "脳、脊髄、神経は信号を処理・伝達し、感覚、運動、身体機能の調整を担います。", "뇌, 척수와 신경은 신호를 처리하고 전달하여 감각, 운동과 신체 기능을 조절합니다."],
  respiratory: ["Las vías respiratorias conducen aire a los pulmones, donde se intercambian oxígeno y dióxido de carbono.", "気道は空気を肺へ導き、肺で酸素と二酸化炭素の交換が行われます。", "기도는 공기를 폐로 전달하며 폐에서 산소와 이산화탄소가 교환됩니다."],
  digestive: ["El aparato digestivo descompone los alimentos y absorbe nutrientes y agua. Los órganos accesorios aportan bilis y enzimas digestivas.", "消化器系は食物を分解し、栄養素と水分を吸収します。付属器官は胆汁や消化酵素を供給します。", "소화계통은 음식물을 분해하고 영양소와 물을 흡수합니다. 부속 기관은 담즙과 소화 효소를 공급합니다."],
  urinary: ["Los riñones filtran la sangre y regulan el agua y los electrolitos. La orina pasa por los uréteres hasta la vejiga y sale por la uretra.", "腎臓は血液をろ過し、水分や電解質を調節します。尿は尿管から膀胱へ運ばれ、尿道を通って排出されます。", "콩팥은 혈액을 여과하고 수분과 전해질을 조절합니다. 소변은 요관을 통해 방광으로 이동한 뒤 요도로 배출됩니다."],
  lymphatic: ["Los vasos linfáticos devuelven líquido de los tejidos a la sangre. Los ganglios y órganos linfáticos participan en las respuestas inmunitarias.", "リンパ管は組織の余分な液を血液へ戻します。リンパ節やリンパ器官は免疫反応に関わります。", "림프관은 조직의 여분의 액체를 혈액으로 돌려보냅니다. 림프절과 림프 기관은 면역 반응에 관여합니다."],
  endocrine: ["Los órganos endocrinos liberan hormonas que regulan el metabolismo, el crecimiento y la reproducción, entre otras funciones.", "内分泌器官はホルモンを分泌し、代謝、成長、生殖などを調節します。", "내분비 기관은 호르몬을 분비하여 대사, 성장, 생식 등을 조절합니다."],
  reproductive: ["Las estructuras reproductoras masculinas participan en la producción y el transporte de espermatozoides y en la secreción de hormonas sexuales.", "男性生殖器は精子の形成・輸送と性ホルモンの分泌に関わります。", "남성 생식 구조는 정자의 생성과 운반 및 성호르몬 분비에 관여합니다."],
  mammary: ["Esta capa incluye tejido mamario y de soporte. Su colocación en el modelo femenino es una adaptación experimental estimada.", "このレイヤーは乳房と支持組織を含みます。女性モデルでの配置は試験的な推定です。", "이 레이어에는 유방과 지지 조직이 포함됩니다. 여성 모델의 배치는 실험적으로 추정한 것입니다."],
  integumentary: ["La superficie corporal sirve de referencia externa. La piel protege y contribuye a la sensibilidad y la regulación de la temperatura.", "体表は外部の位置関係の参照となります。皮膚は保護、感覚、体温調節に関わります。", "체표는 외부 위치 관계를 파악하는 기준이 됩니다. 피부는 보호, 감각과 체온 조절에 관여합니다."],
  connective: ["El cartílago, los ligamentos y otros tejidos conjuntivos sostienen y conectan estructuras y contribuyen a la estabilidad articular.", "軟骨、靱帯などの結合組織は構造を支え、つなぎ、関節の安定に寄与します。", "연골, 인대 등의 결합 조직은 구조를 지지하고 연결하며 관절 안정성에 기여합니다."],
};
const ORGAN_SUMMARIES: Record<string, Names> = {
  heart: SYSTEM_SUMMARIES.cardiac,
  brain: ["El encéfalo es un órgano central del sistema nervioso. Sus regiones participan en la percepción, el movimiento, la memoria y la regulación corporal.", "脳は中枢神経系の器官です。各領域は知覚、運動、記憶、身体機能の調節に関わります。", "뇌는 중추신경계통의 기관입니다. 각 영역은 지각, 운동, 기억 및 신체 기능 조절에 관여합니다."],
  liver: ["Órgano situado principalmente bajo el diafragma derecho. Procesa nutrientes, produce bilis y sintetiza diversas proteínas de la sangre.", "主に右横隔膜の下に位置する臓器です。栄養素の処理、胆汁の生成、血液中の各種タンパク質の合成を担います。", "주로 오른쪽 가로막 아래에 위치합니다. 영양소 처리, 담즙 생성과 여러 혈액 단백질 합성을 담당합니다."],
  stomach: ["Órgano muscular entre el esófago y el intestino delgado. Almacena y mezcla los alimentos con ácido y enzimas antes de enviarlos al duodeno.", "食道と小腸の間にある筋性の器官です。食物を貯め、胃酸や酵素と混ぜて十二指腸へ送ります。", "식도와 작은창자 사이의 근육성 기관입니다. 음식물을 저장하고 위산 및 효소와 섞어 샘창자로 보냅니다."],
  spleen: ["Órgano linfático de la parte superior izquierda del abdomen. Filtra sangre, elimina células sanguíneas envejecidas y participa en la inmunidad.", "左上腹部のリンパ器官です。血液をろ過し、古い血球を除去して免疫反応に関わります。", "왼쪽 윗배의 림프 기관입니다. 혈액을 여과하고 오래된 혈액 세포를 제거하며 면역 반응에 관여합니다."],
  pancreas: ["Órgano abdominal con funciones digestivas y endocrinas. Aporta enzimas al intestino delgado y secreta insulina y glucagón.", "消化と内分泌の機能を持つ腹部の臓器です。小腸に消化酵素を供給し、インスリンやグルカゴンを分泌します。", "소화 및 내분비 기능을 가진 배안 장기입니다. 작은창자에 소화 효소를 공급하고 인슐린과 글루카곤을 분비합니다."],
  "urinary bladder": ["Órgano muscular de la pelvis que almacena la orina procedente de los riñones a través de los uréteres.", "骨盤内にある筋性の蓄尿器官です。腎臓から尿管を通って届く尿を貯めます。", "골반 안에 있는 근육성 기관으로, 콩팥에서 요관을 통해 전달된 소변을 저장합니다."],
  trachea: ["Vía aérea que conecta la laringe con los bronquios. Sus cartílagos ayudan a mantenerla abierta.", "喉頭と気管支をつなぐ気道です。軟骨が気道の開存を支えます。", "후두와 기관지를 연결하는 기도입니다. 연골이 기도를 열린 상태로 유지하는 데 도움을 줍니다."],
  diaphragm: ["Músculo que separa el tórax del abdomen. Su contracción aumenta el volumen torácico y facilita la inspiración.", "胸腔と腹腔を隔てる筋です。収縮すると胸腔容積が増え、吸気を助けます。", "가슴안과 배안을 구분하는 근육입니다. 수축하면 가슴안의 부피가 증가하여 들숨을 돕습니다."],
};
const FEMALE_REPRODUCTIVE: Names = ["Las estructuras reproductoras femeninas de este modelo incluyen ovarios, trompas uterinas, útero y vagina.", "このモデルの女性生殖器には卵巣、卵管、子宮、腟が含まれます。", "이 모델의 여성 생식 구조에는 난소, 자궁관, 자궁과 질이 포함됩니다."];
export function localizedExplanation(name: string, system: SystemId, sex: "male" | "female", locale: AddedLocale) {
  return (ORGAN_SUMMARIES[name.toLowerCase()] ?? (sex === "female" && system === "reproductive" ? FEMALE_REPRODUCTIVE : SYSTEM_SUMMARIES[system]))[column[locale]];
}
export function hasLocalizedExplanation(name: string) { return Object.hasOwn(ORGAN_SUMMARIES, name.toLowerCase()); }
