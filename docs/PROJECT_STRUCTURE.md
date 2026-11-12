# 核心代码与 CI

## 模块职责

| 位置 | 职责 |
| --- | --- |
| `web/main.tsx` | React 入口与全局样式 |
| `app/page.tsx` | 页面、图层/搜索/详情状态与客户端桥接 |
| `app/scene.tsx` | Three.js 场景初始化、加载、相机、按需帧调度与清理 |
| `app/core/anatomy.ts` | 数据模型、系统定义、默认图层和解释 |
| `app/core/explosion-layout.ts` | 可见零件的分解布局 |
| `app/core/pointer-tap.ts` | 点击、拖动、多指和取消状态 |
| `app/core/model-download.ts` | 模型响应与 gzip 解压 |
| `app/core/model-catalogue.ts` | 双模型目录、默认图层、模型与浏览历史存储 |
| `app/core/agent-tools.ts` | 搜索/检查工具契约 |
| `app/core/anatomy-search.ts` | 搜索索引、所属系统/左右信息与俗称匹配提示 |
| `app/rendering/materials.ts` | 系统材质、位置/选择纹理和着色器 |
| `app/rendering/draw-batches.ts` | 可见索引压紧和绘制范围 |
| `client/` | 中英文与平台桥接 |
| `client/updates/controller.ts` / `hooks/use-client-update.ts` | 更新状态、启动检查、进度和失败重试 |
| `src-tauri/src/updater.rs` | 签名与版本校验、安装版更新、便携替换和重启 |
| `client/content/zh-CN.ts` | 中文阅读引导、基础知识、搜索别名与参考来源 |
| `src-tauri/` | 原生窗口、权限与打包 |
| `scripts/release-version.mjs` | SemVer 规划、重试复用与五个版本文件同步 |
| `scripts/release-assets.mjs` | Windows 安装/便携、macOS、Web 打包和平台来源/校验合并 |
| `scripts/updater-signature.mjs` | 发布包与签名版本的 Minisign 校验 |
| `scripts/release-notes.mjs` | 按上一个发布标签生成简明更新摘要与完整变更链接 |
| `scripts/publish-release.mjs` | 原子版本提交/标签与全平台 Release 发布 |
| `scripts/prepare-pages.mjs` | Cloudflare Pages 模型/文件限制检查与版本来源记录 |
| `wrangler.toml` / `.node-version` | Pages 输出目录、兼容日期与 Node 版本 |

数据与交互模块不创建 WebGL 上下文。渲染模块不管理 React 状态；资源由场景创建并统一释放。模型 ID、源数据和已有 UI 保持不变。模型转换、压缩与检查脚本继续放在 `scripts/`。

## 统一检查入口

Node.js 26 或更高版本，安装锁文件依赖后执行：

```sh
npm ci
npm run ci:check
```

入口 `scripts/ci-check.mjs` 依次执行下列已有检查和构建，任何一步失败立即返回非零退出码。使用 npm 的 JavaScript 入口启动子进程，兼容 Windows/Linux，无需 shell 拼接。

1. `check`：TypeScript。
2. `validate:release`：版本递增、版本文件同步、标签排序、重试和安装包校验。
3. `validate:updater`：更新检查、并发操作、下载/安装/重启失败重试及签名配置。
4. `validate:locales`：术语覆盖、文案、双语搜索和语言存储。
5. `validate:atlas`：男性/女性模型映射、边界与压缩二进制数据。
6. `validate:models`：女性来源校验、性别特定几何、模型独立性、中文检索与浏览历史。
7. `validate:interactions`：双模型布局与交互契约。
8. `build`：网页构建。
9. `build:pages`：Cloudflare Pages 构建、两套压缩模型与文件限制检查。
10. `build:client`：客户端前端构建。
11. `validate:client`：解压异常、两套模型打包资产、版本一致性和 Windows 配置。

## GitHub Actions

`.github/workflows/ci.yml` 在所有分支的推送与 PR 更新时运行：安装锁文件依赖后执行 `npm run ci:check`，完成类型、术语、数据和交互检查，并构建 Web、Cloudflare Pages 与桌面前端。该工作流不改版本、不打安装包、不发布。

`.github/workflows/release.yml` 仅可手动启动。选择 `main` 和 patch/minor/major 后，工作流规划同一版本并并行构建 Windows 安装版/便携版、macOS 通用版和 Web ZIP，校验来源与 SHA256，生成上个标签以来的提交摘要，然后同步版本文件、提交版本、创建标签并发布 GitHub Release。发布完成后部署同次运行的 Pages artifact。版本同步提交通过 `GITHUB_TOKEN` 写入，不会再次触发 CI；后续普通提交照常自动运行 CI。完整规则见 [自动版本与发布指南](RELEASE.md)。CI 不包含真实设备操作或性能测量。
