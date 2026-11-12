import terms from "./terms.zh-CN.json" with { type: "json" };
import { chineseStructureKnowledge, chineseSearchAliases } from "../content/zh-CN.ts";
import { explanation, EXPLANATIONS, type SystemId } from "../../app/core/anatomy.ts";
import { LOCALES, isLocale, normalizeSearch, type Locale } from "./locales.ts";
import { translatedUI, SINGULAR_UI } from "./ui.translations.ts";
import { anatomyAliases, localizedAnatomyName, localizedSystemName, localizedExplanation, hasLocalizedExplanation } from "./anatomy.translations.ts";
export { LOCALES, isLocale, normalizeSearch };
export type { Locale };
const normalizedTerms = new Map(
  Object.entries(terms).map(([english, chinese]) => [english.toLowerCase(), chinese]),
);

// Stable keys preserve preferences when upgrading to Anatolume.
export const LANGUAGE_STORAGE_KEY = "human-atlas.language";
export const UI_ZH: Record<string, string> = {
  "Anatolume — 3D Anatomy Explorer": "层知 · Anatolume — 三维人体图谱",
  "Terminology & translation": "术语与翻译",
  "Localized names cover common organs and major bones. Unverified names remain in English. Translations have not been independently reviewed; source names and IDs are preserved.": "新增语言已覆盖常见器官和主要骨骼，尚未核对的名称保留英文。翻译尚未经独立专业审校，保留英文原名和源 ID 供对照。",
  "English source name": "英文原名",
  "English source name retained; localized terminology is not yet verified.": "此结构译名尚未核对，暂保留英文原名。",
  "Selection highlight": "选中高亮",
  "Rendering quality": "画质与性能",
  "Sharp": "清晰",
  "Balanced": "均衡",
  "Smooth": "流畅",
  "Adjusts 3D resolution. Higher quality can use more graphics power; smooth mode may look less sharp on high-resolution screens.": "调整 3D 渲染分辨率。清晰模式可能消耗更多图形性能；流畅模式在高分辨率屏幕上可能稍显模糊。",
  "Teal": "青绿",
  "Sky blue": "天蓝",
  "Lavender": "淡紫",
  "Amber": "琥珀",
  "Coral": "珊瑚",
  "Rose": "玫瑰",
  "Hide current structure": "隐藏当前结构",
  "Hide the selected structure; preserve visibility settings for other structures": "隐藏当前选中结构，保留其他结构的显示状态",
  "Expand a system to browse structures; switches control visibility.": "展开系统查看下级结构，开关控制各项显隐。",
  "Collapse {name} structures": "收起{name}结构",
  "Browse {name} structures": "展开{name}结构",
  "{name} structures": "{name}结构列表",
  "{shown} of {total} pieces visible": "已显示 {shown} / {total} 个零件",
  "Filter structures": "筛选结构…",
  "Filter {name} structures": "筛选{name}结构",
  "{count} structures": "{count} 项结构",
  "Click a name to inspect": "点名称查看详情",
  "Show structure: {name}": "显示结构：{name}",
  "No matching structures": "没有匹配的结构",
  "Show more ({count} remaining)": "显示更多（剩余 {count} 项）",
  "Return to the surrounding view and highlight this structure": "返回周围视图并高亮当前结构",
  "Privacy mode": "隐私模式",
  "Privacy mode: on": "隐私模式：开启",
  "Privacy mode: off": "隐私模式：关闭",
  "Open privacy settings": "打开隐私设置",
  "Click to open privacy settings": "点击打开隐私设置",
  "Sensitive structures are hidden in default views and random exploration. Search or explicit viewing from the list still allows access.": "默认视图和随机探索已隐藏敏感结构，主动搜索或从列表打开系统、部件仍可查看。",
  "Default views and random exploration include all available anatomy.": "默认视图和随机探索正常展示全部可用结构。",
  "Hide male reproductive structures, female breasts and external genitalia in default views and random exploration. Internal female organs remain visible; explicitly open a system or structure from the list, or select a search result, to view hidden structures.": "默认视图和随机探索隐藏男性生殖结构、女性乳房与外生殖器，保留子宫、卵巢等内部器官。从列表主动打开系统、部件，或搜索并选择结果后，仍可查看隐藏结构。",
  "Random exploration": "随机探索",
  "Random organ": "随机器官",
  "Download offline client": "下载离线客户端",
  "Application updates": "应用更新",
  "Keep Anatolume up to date": "获取最新功能与改进",
  "Checking for updates…": "正在检查更新…",
  "You are up to date": "当前已是最新版本",
  "Downloading update…": "正在下载更新…",
  "Installing update…": "正在安装更新…",
  "Update installed. Restart to finish.": "更新已安装，重启后生效。",
  "Version {version} is available": "发现新版本 {version}",
  "Could not check for updates. Check your connection and try again.": "暂时无法获取更新，请检查网络后重试。",
  "Download or signature verification failed. Your current version is unchanged; try again.": "下载或签名校验失败，当前版本未受影响，请重试。",
  "Installation failed. Check that the application folder is writable, then retry.": "安装未完成，请检查应用目录的写入权限后重试。",
  "Could not restart. Close and reopen Anatolume to finish.": "未能自动重启，请关闭并重新打开层知，完成更新。",
  "What's new": "更新内容",
  "Improvements and fixes in this release.": "本次更新包含功能改进与问题修复。",
  "Download progress": "下载进度",
  "Restart now": "立即重启",
  "Retry update": "重试更新",
  "Updating…": "正在更新…",
  "Download & install": "下载并安装",
  "Check for updates": "检查更新",
  "Check automatically at startup": "启动时自动检查更新",
  "Downloads are verified before installation. Your language and browsing history are kept.": "安装前校验更新包签名，保留语言偏好和浏览记录。",
  "Restart to update": "重启完成更新",
  "New version available": "发现新版本",
  "Anatomy model": "解剖模型",
  Male: "男性",
  "Female · experimental": "女性 · 实验",
  "FEMALE · EXPERIMENTAL STUDY MODEL": "女性 · 实验性学习模型",
  "Female study model · estimated anatomy": "女性学习模型 · 比例与位置为估算",
  "Female · BodyParts3D + HRA": "女性 · BodyParts3D + HRA",
  "{parts} individual meshes and {concepts} named concepts in the current model.": "当前模型包含 {parts} 个独立网格和 {concepts} 个具名概念。",
  "Derived from BodyParts3D and HRA female anatomy. Proportions and placement are estimated and have not been independently reviewed.": "基于 BodyParts3D 与 HRA 女性解剖数据改编。比例和器官位置为估算，尚未经过独立专业审校。",
  "Female model & source": "女性模型与来源",
  "Thanks to PrejudiceNeutrino for sharing the female study model and its adaptation records.": "感谢 PrejudiceNeutrino 分享女性学习模型及完整改编记录，让女性解剖探索成为可能。",
  "Female geometry is adapted from Human Atlas Enhanced by PrejudiceNeutrino and the HRA female organ set by Kristen Browne and Heidi Schlehlein. Source IDs and adaptation records are preserved.": "女性几何模型引自 PrejudiceNeutrino 的 Human Atlas Enhanced，并使用 Kristen Browne 与 Heidi Schlehlein 的 HRA 女性器官数据集。保留源标识和改编记录。",
  Anatolume: "层知",
  "Go to homepage": "返回首页",
  "A new perspective on anatomy": "换个视角，认识人体",
  "Main navigation": "主导航",
  Home: "首页",
  "3D atlas": "3D 图谱",
  "Learning guide": "学习指南",
  About: "关于",
  "About & acknowledgements": "关于与致谢",
  "See the body. Understand every layer.": "看见身体，理解每一层。",
  "Developed & maintained by": "开发与维护",
  "Continuing Anatolume with multilingual exploration, a refined interface and offline desktop access.": "持续完善层知的多语言探索、界面交互与离线桌面体验。",
  "Built on open source": "致敬开源，让知识被看见",
  "Thanks to the creators who share their work. Their code, data and tools make this atlas possible.": "感谢愿意分享的创作者。开放的代码、数据与工具，让这份人体图谱得以呈现。",
  "Original project": "原始项目",
  "Created by ashemag. Anatolume builds on this open-source 3D anatomy explorer and preserves its original copyright and license.": "由 ashemag 创建。层知基于这一开源三维人体探索项目继续开发，保留原作者的版权与许可声明。",
  "Open anatomy data": "开放解剖数据",
  "Geometry is simplified for rendering; names, identifiers and structure relationships retain their source references.": "模型经过简化以适配渲染；名称、标识符与结构关系保留源数据对应记录。",
  "Full attribution & adaptations": "完整署名与改编记录",
  "Open-source tools & community": "开源工具与社区",
  "Thank you to every maintainer, contributor and person who shares feedback.": "感谢每一位维护者、贡献者，以及愿意分享建议的使用者。",
  "View source on GitHub": "在 GitHub 查看源码",
  "YOUR INTERACTIVE ANATOMY ATLAS": "你的交互式人体图谱",
  "See the body.": "看见身体。",
  "Understand every layer.": "理解每一层。",
  "An entire world beneath the surface. Explore human anatomy in 3D, uncover its systems, and get to know each structure at your own pace.": "身体之内，藏着一个精妙的世界。转动三维模型，逐层探索人体系统，从每一个结构开始，建立自己的解剖认知。",
  "Start exploring": "开始探索",
  "How to explore": "如何使用",
  "Individual structures": "独立模型零件",
  "Anatomical systems": "人体系统",
  "Named concepts": "具名解剖概念",
  "Choose a starting point": "从你感兴趣的地方开始",
  "One click to discover": "一键进入图谱",
  "Whole body": "全身结构",
  "See how everything connects": "认识身体的整体联系",
  "Bones & support": "骨骼与支撑",
  "Explore the body's framework": "了解人体的支撑框架",
  "Internal organs": "内部器官",
  "Look beneath the surface": "探索身体深处的结构",
  "Recently explored": "最近探索",
  "LIVE 3D MODEL": "实时三维模型",
  "Drag to rotate. Click to discover.": "拖动旋转 · 点击结构即可深入探索",
  "Show exploration tools": "展开探索工具",
  "Hide exploration tools": "收起探索工具",
  "Close exploration tools": "关闭探索工具",
  "3D anatomy explorer": "人体结构探索",
  "Click a structure to discover more": "点击模型中的结构，查看详细信息",
  "Exploration tools": "探索工具",
  "Explore at your own pace": "自由探索，逐层理解",
  Oblique: "斜视",
  Front: "正面",
  Side: "侧面",
  Back: "背面",
  "No layers are visible": "当前没有显示的图层",
  "Turn on a system, or restore the whole body to keep exploring.": "打开左侧任意系统，或恢复全身结构，继续探索。",
  "Show whole body": "显示全身结构",
  Assemble: "组装",
  Separate: "分离",
  Inventory: "总览",
  "Surrounding anatomy visible": "周围结构已显示",
  "Select a result to inspect it on its own.": "选择结果：单独查看结构并打开详情。",
  "From the whole body to every detail.": "从整体，到每一个结构。",
  "Three simple steps to find your way around the atlas.": "三个简单步骤，开始认识身体的每一层。",
  "Choose your layers": "选择想看的图层",
  "Start with the whole body, bones or organs. Toggle systems to build your own view.": "从全身、骨骼或器官开始。打开或关闭人体系统，组合你自己的观察视图。",
  "Click the model or search a name. Search results open an isolated view so nothing gets in the way.": "点击模型，或搜索中文、英文名称和俗称。搜索结果会单独显示，深层结构也清晰可见。",
  "Look a little closer": "再靠近一点观察",
  "Rotate, zoom or separate the model. Open details to learn more, then show surrounding anatomy for context.": "转动、缩放或分解模型，展开详情阅读说明。切换到周围结构，理解它在人体中的位置。",
  "Open the 3D atlas": "打开 3D 图谱",
  "INTERACTIVE ANATOMY": "交互式人体解剖",
  "modeled pieces": "个模型零件",
  "Explorer panels": "浏览面板",
  "Search anatomy": "搜索解剖结构",
  "Find a structure": "查找结构",
  "About this atlas": "关于此图谱",
  "Anatomical layers": "解剖图层",
  Systems: "系统",
  "Close systems": "关闭系统面板",
  All: "全部",
  Skeleton: "骨骼",
  Organs: "器官",
  Only: "仅看",
  "Current layers": "当前图层",
  "Default layers": "默认图层",
  "Custom layers": "自定义",
  "All hidden": "全部隐藏",
  "Isolated selection": "单独查看结构",
  "Only {name}": "仅看{name}",
  "Switches show or hide; Only shows one system.": "开关控制显隐；「仅看」只显示该系统。",
  "Selected structures remain visible.": "选中结构会临时保持显示。",
  "{count} pieces": "{count} 个零件",
  "{count} systems available": "可浏览 {count} 个系统",
  "Hide {name}": "隐藏{name}",
  "Show only {name}": "仅显示{name}",
  "Show {name}": "显示{name}",
  "{count} pieces visible": "已显示 {count} 个零件",
  "Hide all": "全部隐藏",
  "Close search": "关闭搜索",
  "Clear search": "清空搜索",
  "Clear recent": "清空最近查看",
  "Recent & common structures": "最近查看与常用结构",
  "Common structures": "常用结构",
  Recent: "最近查看",
  "Anatomical search results": "解剖结构搜索结果",
  "Included systems": "包含系统：",
  "{count} matches": "找到 {count} 项结构",
  "Matched alias: {alias}": "匹配俗称：{alias}",
  "Left side": "左侧",
  "Right side": "右侧",
  "Left & right": "左 / 右",
  "Select a result to highlight it and open details.": "选择结果：高亮结构并打开详情。",
  "Left and right refer to the body's own sides.": "左右以人体自身为准。",
  "Search by localized or English name, alias or source ID.":
    "支持本地化名称、英文原名、别名和源 ID 搜索。",
  "Heart, femur, cranial nerve…": "心脏、股骨、脑神经…",
  "Search named anatomical structures": "搜索有名称的解剖结构",
  "No structures match your search.": "没有找到匹配的结构。",
  piece: "个零件",
  pieces: "个零件",
  "Showing up to 80 matches. Refine your search to find smaller structures.":
    "最多显示 80 项结果；补充关键词可查找更具体的结构。",
  "Start with a major organ, or search every named structure.":
    "可从主要器官开始，也可输入中文、英文名称或源 ID。",
  "Camera controls": "相机控制",
  "Base": "底座",
  "Show base": "显示底座",
  "Hide base": "隐藏底座",
  "three-quarter view": "四分之三视角",
  "front view": "正面视角",
  "side view": "侧面视角",
  "back view": "背面视角",
  "Pause rotation": "暂停旋转",
  "Rotate body": "旋转人体",
  "Auto rotate": "自动旋转",
  "Rotation settings": "旋转设置",
  "Rotation speed": "旋转速度",
  "Reset rotation speed": "恢复标准旋转速度",
  "Rotation direction": "旋转方向",
  "Slow": "慢速",
  "Standard": "标准",
  "Fast": "快速",
  "Clockwise": "顺时针",
  "Counterclockwise": "逆时针",
  "Reset view and layers": "重置视角和图层",
  "Reset view": "重置视角",
  "Reset view; keep layers, selection and separation": "重置视角，保留图层、选择和分解程度",
  "Reset all": "恢复全部",
  "Restore default layers, clear selection and assemble anatomy":
    "恢复默认图层和视角，取消选择并组装人体",
  "SELECTED STRUCTURE": "选中结构",
  "ANATOMICAL INVENTORY": "解剖零件总览",
  "SEPARATED STRUCTURES": "分离结构",
  "ADULT HUMAN · MALE": "成年人体 · 男性",
  "Open system layers": "打开系统图层",
  "Explode anatomy": "分解解剖结构",
  Assembled: "完整组装",
  "Every piece": "全部零件",
  "Assemble and reset": "组装并重置",
  Reset: "重置",
  "Drag to pan": "拖动平移",
  "Drag to orbit": "拖动旋转",
  "Pinch to zoom": "双指缩放",
  "Tap to inspect": "点击查看",
  "Source & credits": "来源与署名",
  "Preparing the anatomy": "正在准备解剖模型",
  "Loading {count} pieces": "正在加载 {count} 个零件",
  "Reload viewer": "重新加载",
  ANATOMY: "解剖结构",
  "System overview · structure identified from source anatomy":
    "系统概述 · 结构名称来自原始解剖数据",
  "Atlas reference": "图谱源 ID",
  "Selected pieces": "选中零件",
  "Included structures": "包含的结构",
  "And {count} more modeled pieces.": "另有 {count} 个模型零件。",
  "View anatomical source": "查看解剖数据来源",
  "Show surrounding anatomy": "显示周围结构",
  "Isolate structure": "单独查看结构",
  "Clear selection": "取消选择",
  "Expand details": "展开详情",
  "Collapse details": "收起详情",
  "Close details": "关闭详情",
  "Selected structure actions": "选中结构操作",
  "View details": "查看详情",
  "Compact width": "标准宽度",
  "Wider reading": "加宽阅读",
  "Reference & included pieces": "源信息与零件",
  "Locate structure": "定位到结构",
  "Back to overview": "返回整体",
  "Center the camera on the selection; keep surrounding layers":
    "将相机移向选中结构，保留周围图层；若被遮挡，可单独查看",
  "Isolate hides other structures; surrounding anatomy restores the current layers":
    "单独查看会隐藏其他结构；显示周围结构会恢复当前图层",
  "Clear selection and restore the overview; keep layers and separation":
    "取消选择并回到整体视角，保留当前图层和分解程度",
  "SOURCE & SCOPE": "来源与范围",
  "A body, revealed.": "探索人体的内部结构",
  "Explore the adult male reference anatomy from BodyParts3D.":
    "探索 BodyParts3D 成年男性参考解剖模型。",
  "Male · BodyParts3D": "男性 · BodyParts3D",
  "2,234 individual meshes and 3,432 named concepts from an adult male reference anatomy.":
    "包含成年男性参考解剖模型的 2,234 个独立网格和 3,432 个具名概念。",
  "This reference does not contain every human structure or variation. Named concepts can contain multiple pieces; each source mesh is rendered once.":
    "本参考模型并未包含所有人体结构或个体差异。一个具名概念可能包含多个零件；每个源网格仅渲染一次。",
  "Colors and system groupings are designed for exploration. The geometry is simplified for the web, and short explanations provide general educational context. This is an anatomical reference, not a diagnostic or surgical tool.":
    "颜色和系统分组用于辅助探索。几何数据经过简化，简短说明提供一般教学背景。本应用为解剖参考图谱，不用于诊断或手术。",
  Source: "数据来源",
  "Dataset license": "数据集许可",
  "Original geometry & metadata": "原始几何与元数据",
  "Read the source publication": "阅读原始研究论文",
  "Chinese terminology draft": "中文术语初稿",
  "Chinese names are an offline terminology draft and have not been professionally reviewed. English source names and identifiers are preserved for comparison.":
    "中文名称为离线术语初稿，尚未经过专业审校。保留英文源名称和标识符供对照及后续修订。",
  "Offline client": "离线客户端",
  "Web viewer": "网页查看器",
  Language: "语言",
  Close: "关闭",
  "BodyParts3D, © The Database Center for Life Science licensed under CC Attribution 4.0 International.":
    "BodyParts3D，© 生命科学数据库中心，依据 CC BY 4.0 国际许可授权。",
  "Application code: MIT. Anatomy data: CC BY 4.0.": "应用代码：MIT。解剖数据：CC BY 4.0。",
  "Interactive human anatomy. Drag to orbit, pinch or scroll to zoom, and tap a structure to inspect it.":
    "交互式人体解剖。拖动旋转，双指或滚轮缩放，点击结构查看详情。",
  "This browser could not start the 3D viewer. Please try a browser with WebGL enabled.":
    "无法启动三维查看器，请确认显卡驱动及 WebGL 支持正常。",
  "An anatomy file could not be loaded.": "无法加载解剖模型文件。",
  "An anatomy file was incomplete. Please reload the viewer.":
    "解剖模型文件不完整，请重新加载查看器。",
  "The anatomy catalogue could not be loaded.": "无法加载解剖模型目录。",
  "Could not assemble anatomy geometry.": "无法组装解剖模型几何数据。",
  "Could not load the anatomy.": "无法加载解剖模型。",
  "The 3D session was paused by your device. Reload to continue.":
    "设备暂停了三维会话，请重新加载后继续。",
  "The anatomy could not be loaded. Please reload the viewer.":
    "无法加载解剖模型，请重新加载查看器。",
  "Could not open this link.": "无法打开链接，请稍后重试。",
};

const SYSTEM_ZH: Record<SystemId, { name: string; description: string }> = {
  skeletal: {
    name: "骨骼",
    description:
      "骨构成人体的支撑框架，保护器官并为肌肉提供附着点。骨内组织还可储存矿物质并产生血细胞。",
  },
  muscular: {
    name: "肌肉",
    description: "骨骼肌通过牵拉附着点产生运动，并与肌腱共同驱动关节、稳定姿势和产生热量。",
  },
  cardiac: {
    name: "心脏",
    description: "心脏是具有四个腔室的肌性泵。心脏瓣膜引导血液沿肺循环和体循环向前流动。",
  },
  sensory: {
    name: "感觉器官",
    description:
      "这些结构参与视觉、听觉和平衡等特殊感觉。其特化组织感受刺激，并与神经系统共同传递信息。",
  },
  arterial: {
    name: "动脉",
    description: "心脏驱动血液循环。动脉将血液从心脏输送到组织，或在肺循环中输送到肺。",
  },
  venous: {
    name: "静脉",
    description: "静脉将血液送回心脏。浅、深静脉网络收集组织中的血液；肺静脉将含氧血从肺送回心脏。",
  },
  nervous: {
    name: "神经系统",
    description: "脑、脊髓和周围神经传递并处理信号，支持感觉、运动、协调和身体功能的自主调节。",
  },
  respiratory: {
    name: "呼吸系统",
    description:
      "气道将空气输送到肺，氧气和二氧化碳在空气与血液间交换。呼吸依赖呼吸肌产生的压力变化。",
  },
  digestive: {
    name: "消化系统",
    description: "消化道分解食物，吸收营养和水分，并向后输送废物。附属器官提供胆汁和消化酶。",
  },
  urinary: {
    name: "泌尿系统",
    description: "肾过滤血液并调节体液、电解质和酸碱平衡。尿液经输尿管进入膀胱，并通过尿道排出。",
  },
  lymphatic: {
    name: "淋巴系统",
    description: "淋巴管将多余的组织液送回血液循环。淋巴结及其他淋巴器官参与免疫监视和免疫反应。",
  },
  endocrine: {
    name: "内分泌系统",
    description: "内分泌器官向血液释放激素，协调代谢、生长、应激反应和生殖等过程。",
  },
  reproductive: {
    name: "生殖系统",
    description: "本模型中的男性生殖结构参与精子的生成、成熟和输送，并产生性激素。",
  },
  mammary: {
    name: "乳房组织",
    description: "本图层包含乳腺、乳腺导管、脂肪与支持组织。它们在女性学习模型中的改编位置属于实验性估算。",
  },
  integumentary: {
    name: "体表",
    description: "体表提供外部解剖参考。皮肤系统形成保护屏障，并参与感觉和体温调节。",
  },
  connective: {
    name: "结缔组织",
    description: "软骨、韧带及其他结缔组织支撑、连接并分隔结构，参与稳定关节和分散机械负荷。",
  },
};
const EXPLANATION_ZH: Record<string, string> = {
  heart: "位于胸部的肌性泵。右心将血液输送到肺，左心通过体循环将血液输送到全身。",
  liver: "位于膈右侧下方的大型器官，处理吸收的营养物质、产生胆汁，并合成血液中的多种蛋白质。",
  brain: "神经系统的中枢器官。相互连接的脑区支持感知、运动、记忆、语言及身体功能调节。",
  stomach: "位于食管与小肠之间的肌性腔室。储存食物，将食物与胃酸和消化酶混合，再送入十二指肠。",
  spleen: "位于左上腹的淋巴器官。过滤血液，清除衰老血细胞，并参与免疫反应。",
  pancreas: "兼有消化和内分泌作用的腹部器官。向小肠提供消化酶，释放胰岛素和胰高血糖素等激素。",
  "urinary bladder": "位于盆腔的肌性储尿器官，储存由输尿管输送而来的尿液。",
  trachea: "连接喉和支气管的主要气道，软骨支架有助于维持气道开放。",
  diaphragm: "分隔胸腔与腹腔的宽大肌肉。收缩时增加胸腔容积，帮助空气进入肺。",
};

export function text(
  english: string,
  locale: Locale,
  values: Record<string, string | number> = {},
) {
  let template = locale === "zh-CN" ? (UI_ZH[english] ?? english)
    : locale === "en" ? english : translatedUI(english, locale) ?? english;
  if ((locale === "es" || locale === "en") && Number(values.count) === 1)
    template = SINGULAR_UI[locale][english] ?? template;
  return template.replace(/\{(\w+)\}/g, (_, name: string) => String(values[name] ?? `{${name}}`));
}
export function displayName(english: string, locale: Locale) {
  return locale === "zh-CN"
    ? ((terms as Record<string, string>)[english] ??
        normalizedTerms.get(english.toLowerCase()) ??
        english)
    : locale === "en" ? english : localizedAnatomyName(english, locale) ?? english;
}
export function searchText(english: string, id: string) {
  return normalizeSearch(`${LOCALES.map(({ id: locale }) => displayName(english, locale)).join("\n")}\n${id}\n${chineseSearchAliases(english)}\n${anatomyAliases(english).join("\n")}`);
}
export function systemName(id: SystemId, english: string, locale: Locale) {
  return locale === "zh-CN" ? SYSTEM_ZH[id].name : locale === "en" ? english : localizedSystemName(id, locale);
}
export function structureExplanation(name: string, system: SystemId, sex: "male" | "female", locale: Locale) {
  if (locale === "zh-CN") return chineseExplanation(name, system, sex);
  if (locale !== "en") return localizedExplanation(name, system, sex, locale);
  return explanation(name, system, sex);
}
export function hasStructureExplanation(name: string, locale: Locale) {
  return locale === "zh-CN" ? hasChineseExplanation(name)
    : locale === "en" ? !!EXPLANATIONS[name.toLowerCase()] : hasLocalizedExplanation(name);
}
export function structureAliases(name: string) {
  return [...chineseSearchAliases(name).split("\n"), ...anatomyAliases(name)].filter(Boolean);
}
export function chineseExplanation(name: string, system: SystemId, sex: "male" | "female" = "male") {
  return (
    chineseStructureKnowledge(name)?.summary ??
    EXPLANATION_ZH[name.toLowerCase()] ??
    (sex === "female" && system === "reproductive"
      ? "本模型中的女性生殖结构包括卵巢、输卵管、子宫与阴道。"
      : SYSTEM_ZH[system].description)
  );
}
export function hasChineseExplanation(name: string) {
  return !!(chineseStructureKnowledge(name) || EXPLANATION_ZH[name.toLowerCase()]);
}
export function readLocale(storage?: Pick<Storage, "getItem">): Locale {
  try {
    const saved = storage?.getItem(LANGUAGE_STORAGE_KEY);
    return isLocale(saved) ? saved : "zh-CN";
  } catch {
    return "zh-CN";
  }
}
export function errorText(error: string, locale: Locale) {
  return text(
    UI_ZH[error] ? error : "The anatomy could not be loaded. Please reload the viewer.",
    locale,
  );
}
