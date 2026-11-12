# Cloudflare Pages · 连接 GitHub 自动构建

本项目使用 React + Vite，Pages 直接构建静态站点。仓库：<https://github.com/isunky/Anatolume>。

生产站点：[层知 · Anatolume](https://anatolume.sunky.net/)。已连接 `main` 分支，启用生产自动构建和分支预览。

## 连接设置

在 Cloudflare 控制台进入 **Workers & Pages → 创建应用 → Pages → 连接 Git**，选择 `isunky/Anatolume`。首次连接时需为 Cloudflare GitHub App 授予此仓库访问权限。

| 设置 | 值 |
| --- | --- |
| 生产分支 | `main` |
| 框架预设 | React (Vite) |
| 根目录 | 留空，使用仓库根目录 |
| 构建命令 | `npm ci && npm run build:pages` |
| 构建输出目录 | `dist` |
| Node 版本 | `26`，仓库 `.node-version` 已指定 |
| 环境变量 | `SKIP_DEPENDENCY_INSTALL=1`，生产和预览均设置 |

使用 Pages 的 Git 构建设置；根目录必须包含 `package.json` 和 `vite.config.ts`，不要选 `web/`。`SKIP_DEPENDENCY_INSTALL=1` 跳过平台自动安装，由构建命令中的 `npm ci` 严格按锁文件安装。

连接后，推送 `main` 自动更新生产站点，其他分支可启用预览部署。此流程无需在 GitHub Actions 添加 Cloudflare API Token。

## 构建与资源

```sh
npm ci
npm run build:pages
```

`wrangler.toml` 指定 Pages 项目名称、`dist/` 输出目录和兼容日期。构建命令仍在 Pages 控制台设置。

专用构建仅上传压缩模型，移除重复的原始 `.bin`；程序已支持浏览器自动解压和手动 gzip 解压。`scripts/prepare-pages.mjs` 检查每个模型的压缩/解压字节数、Logo、署名文件，以及 Pages 单文件 25 MiB、免费计划 20,000 文件限制；超限或文件不完整时构建失败。

`dist/version.json` 记录仓库版本和 `CF_PAGES_COMMIT_SHA`，可与 Cloudflare 部署所用提交核对。Pages 使用其检出的版本；GitHub Actions 成功发布后的版本提交会将仓库版本同步到下一个版本。

网站使用 `#explore` 路由，Pages 的静态托管可直接使用。模型、图标和前端资源已兼容根域名与子目录部署。

## 常见问题

| 现象 | 检查项 |
| --- | --- |
| 找不到仓库 | 检查 Cloudflare GitHub App 对 `isunky/Anatolume` 的仓库访问授权。 |
| Node 版本错误 | 使用当前 Pages v3 构建环境；删除旧的 `NODE_VERSION` 覆盖值，或设为 `26`。 |
| 找不到 `package.json` | 将构建根目录恢复为仓库根目录。 |
| 报单文件超限 | 保持 `npm run build:pages`，检查新增资源；大型文件需拆分或使用独立对象存储。 |
| 构建成功但页面空白 | 输出目录应为 `dist`；确认是 Pages Git 项目，并检查浏览器控制台。 |
| 三维模型加载失败 | 检查 `models/atlas.json` 和各 `.bin.gz` 的请求是否成功，保留 gzip 响应处理。 |

官方文档：[构建配置](https://developers.cloudflare.com/pages/configuration/build-configuration/)、[Node 版本与依赖安装](https://developers.cloudflare.com/pages/configuration/build-image/)、[Git 集成](https://developers.cloudflare.com/pages/configuration/git-integration/)、[文件限制](https://developers.cloudflare.com/pages/platform/limits/)。
