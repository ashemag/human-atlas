# 女性学习模型

页眉的模型选项可在男性参考模型和「女性 · 实验」之间切换。两套模型均支持中文/英文搜索、系统显隐、单独查看、相机定位与分解；模型偏好保存在本机，最近浏览按模型分别保存。网址中的 `?model=female` 可直接打开女性模型，追加 `#explore` 进入探索界面。

## 来源与范围

女性资源引自 [PrejudiceNeutrino / Human Atlas Enhanced](https://github.com/PrejudiceNeutrino/human-atlas-enhanced)，固定版本为 [`9e0d710`](https://github.com/PrejudiceNeutrino/human-atlas-enhanced/tree/9e0d710fcc1d467dc758d61d6f417231cb1472fe)。原始文件为 `public/models/atlas-female-reconstructed.json`，在本仓库保存为 `public/models/atlas-female.json`。几何、来源标识、改编记录和 `female-fit-report.json` 原样保留；模型压缩文件的 SHA256 记录在 `public/models/female-source.json`。

| 模型 | 可选网格 | 具名概念 | 图层 | 三角形 |
| --- | ---: | ---: | ---: | ---: |
| 男性 · BodyParts3D | 2,234 | 3,432 | 15 | 2,288,268 |
| 女性 · 实验性学习模型 | 2,245 | 4,248 | 16 | 2,437,148 |

女性模型保留 2,181 个改编的 BodyParts3D 网格，并加入 64 个 HRA 女性网格（骨盆 8、生殖器官 38、乳房组织 16、膝韧带 2）。男性特有结构、男性尿道及部分盆底结构由上游明确排除，不会作为女性模型的后备几何。乳房组织有独立图层；乳头、乳晕等体表网格默认隐藏，搜索选中后可单独观察。

**这是一套实验性衍生学习模型。** 体型比例、骨盆配准、器官位置和轮廓经过估算改编，尚未完成独立解剖审校。它不等于扫描获得的完整女性参考人体；仍缺少女性外部皮肤、生殖器外表面及已验证的女性尿道/盆底替代结构。完整限制和构建方法见[上游女性模型说明](https://github.com/PrejudiceNeutrino/human-atlas-enhanced/blob/9e0d710fcc1d467dc758d61d6f417231cb1472fe/docs/female-anatomy.md)。

## 许可与署名

BodyParts3D © The Database Center for Life Science，CC BY 4.0。HRA / HuBMAP 女性器官集由 Kristen Browne 与 Heidi Schlehlein 提供，*3D Reference Organ Set for Female v1.5*（2023），[DOI](https://doi.org/10.48539/HBM352.BTSQ.586)，CC BY 4.0。衍生模型由 PrejudiceNeutrino / Human Atlas Enhanced 改编。完整来源与改编记录见 [ATTRIBUTION.md](../public/ATTRIBUTION.md)。

## 资源与校验

只随包提供该学习模型的 17 个 gzip 几何文件，不携带额外的原始二进制副本。女性压缩资源约 35.4 MB；两套模型均从当前部署目录加载，切换时取消旧加载并释放场景，Web、GitHub Pages、Cloudflare Pages 和离线桌面前端均包含两套资源。

```sh
npm run validate:atlas
npm run validate:models
npm run validate:locales
npm run ci:check
```

检查覆盖两个目录的映射、索引、边界、压缩文件长度、来源校验、模型独立性、中文检索和各平台资产。更新女性资源时应从明确的上游修订整体导入 manifest、fit report 和其引用的全部 gzip 文件，然后同步来源修订与 SHA256；请勿将男性模型优化脚本直接用于这套已改编资源。
