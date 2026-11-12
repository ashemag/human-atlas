// Authored Chinese learning notes. Source names and model identifiers stay unchanged.
export const READING_GUIDE = [
  {
    title: "先看整体，再看细节",
    body: "先切换“骨骼”或“器官”预设，理解大体位置；搜索结构后用“单独查看结构”观察形态，再用“显示周围结构”查看邻近关系。",
  },
  {
    title: "左右以模型本人为准",
    body: "“左”和“右”指人体自身的左右，不是屏幕左右。面对人体正面时，人体左侧通常位于画面右侧；旋转相机不会改变结构名称中的左右。",
  },
  {
    title: "分解位置不是解剖位置",
    body: "分解视图把零件移开，方便逐个辨认，移动后的距离与排列不代表真实人体位置。判断邻近关系时请先“组装并重置”。",
  },
  {
    title: "名称、概念与零件",
    body: "一个结构概念可能包含多个模型零件。“选中零件”是网格数量，不是器官数量。中文名称仍为草稿，可用英文原名和图谱源 ID 对照；普通名称或俗称也可用于搜索。",
  },
];

export const DIRECTION_TERMS = [
  ["上 / 下", "朝向头端 / 朝向足端。"],
  ["前 / 后", "朝向人体正面 / 朝向背面。"],
  ["内侧 / 外侧", "靠近身体正中线 / 远离身体正中线。"],
  ["近端 / 远端", "沿肢体等结构，靠近附着端 / 远离附着端。"],
  ["浅 / 深", "靠近体表 / 远离体表。"],
];

export type StructureKnowledge = { summary: string; observe: string; aliases: string[] };
export const STRUCTURE_KNOWLEDGE: Record<string, StructureKnowledge> = {
  clavicle: {
    summary: "锁骨位于肩部前方，连接胸骨与肩胛骨，是肩带的一部分。",
    observe: "先从正面寻找横向走行的锁骨，再查看其内侧端与胸骨、外侧端与肩胛骨的位置关系。",
    aliases: ["锁骨"],
  },
  scapula: {
    summary: "肩胛骨位于胸廓后方，呈扁平三角形，与肱骨共同构成肩关节。",
    observe: "切换到背面视角，辨认肩胛骨的轮廓；单独查看时比较前后两面的形态。",
    aliases: ["肩胛骨", "肩胛"],
  },
  humerus: {
    summary: "肱骨是上臂的长骨，上端参与肩关节，下端参与肘关节。",
    observe: "从肩部向肘部追踪骨干，比较上端的肱骨头与下端的关节区域。",
    aliases: ["上臂骨"],
  },
  radius: {
    summary: "桡骨是前臂两根长骨之一。在标准解剖姿势下，位于拇指侧。",
    observe: "同时查看桡骨和尺骨；桡骨靠近腕部的一端较宽。",
    aliases: ["前臂桡骨"],
  },
  ulna: {
    summary: "尺骨是前臂两根长骨之一。在标准解剖姿势下，位于小指侧。",
    observe: "查看靠近肘部的尺骨上端，再与相邻桡骨比较两端的形态。",
    aliases: ["前臂尺骨"],
  },
  femur: {
    summary: "股骨是大腿的长骨，上端参与髋关节，下端参与膝关节。",
    observe: "辨认股骨头、股骨颈和骨干，再查看下端与胫骨、髌骨的位置关系。",
    aliases: ["大腿骨"],
  },
  patella: {
    summary: "髌骨位于膝关节前方，是膝部的一块籽骨。",
    observe: "在正面视角定位膝部，比较髌骨与股骨下端的前后关系。",
    aliases: ["膝盖骨", "膝盖骨头"],
  },
  tibia: {
    summary: "胫骨位于小腿内侧，是小腿主要的承重骨。",
    observe: "同时查看胫骨与腓骨；比较两者粗细，并追踪胫骨从膝部到踝部的走行。",
    aliases: ["小腿胫骨", "小腿内侧骨"],
  },
  fibula: {
    summary: "腓骨位于小腿外侧，较胫骨细长，其下端形成外踝。",
    observe: "沿小腿外侧寻找细长的腓骨，并观察下端在踝部的位置。",
    aliases: ["小腿腓骨", "小腿外侧骨"],
  },
};

function structureKey(name: string) {
  return name.toLowerCase().replace(/^(left|right) /, "");
}
export function chineseStructureKnowledge(name: string): StructureKnowledge | undefined {
  const key = structureKey(name);
  return Object.hasOwn(STRUCTURE_KNOWLEDGE, key) ? STRUCTURE_KNOWLEDGE[key] : undefined;
}
const SEARCH_ALIASES = new Map<string, string>();
for (const [name, { aliases }] of Object.entries(STRUCTURE_KNOWLEDGE)) {
  SEARCH_ALIASES.set(name, aliases.join("\n"));
  for (const [side, chinese] of [
    ["left", "左"],
    ["right", "右"],
  ]) {
    SEARCH_ALIASES.set(
      `${side} ${name}`,
      [...aliases, ...aliases.map((alias) => chinese + alias)].join("\n"),
    );
  }
}
export function chineseSearchAliases(name: string) {
  return SEARCH_ALIASES.get(name.toLowerCase()) ?? "";
}

export const CONTENT_REFERENCES = [
  {
    title: "方位术语参考",
    url: "https://openstax.org/books/anatomy-and-physiology-2e/pages/1-6-anatomical-terminology",
  },
  {
    title: "肩带结构参考",
    url: "https://openstax.org/books/anatomy-and-physiology-2e/pages/8-1-the-pectoral-girdle",
  },
  {
    title: "上肢骨参考",
    url: "https://openstax.org/books/anatomy-and-physiology-2e/pages/8-2-bones-of-the-upper-limb",
  },
  {
    title: "下肢骨参考",
    url: "https://openstax.org/books/anatomy-and-physiology-2e/pages/8-4-bones-of-the-lower-limb",
  },
];
