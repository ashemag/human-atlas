# 自动版本与全平台发布

CI 和发布由两个独立的 GitHub Actions 工作流负责：推送代码时自动检查；只有手动启动发布工作流才会更新版本、构建安装包并发布。

## CI：提交时自动运行

工作流：[Continuous integration](../.github/workflows/ci.yml)。推送任意分支或更新 PR 后自动运行类型、术语、模型和交互检查，以及 Web、Cloudflare Pages 和桌面前端构建。CI 不修改版本号、不构建桌面安装包、不创建标签或 GitHub Release。

## 发布：手动启动完整流程

工作流：[Manual version, build and release](../.github/workflows/release.yml)。在 GitHub 打开 **Actions → Manual version, build and release → Run workflow**，选择 `main` 和版本增幅：

| 选择 | 示例 |
| --- | --- |
| `patch`（默认） | `0.1.0` → `0.1.1` |
| `minor` | `0.1.9` → `0.2.0` |
| `major` | `0.1.9` → `1.0.0` |

也可以使用 GitHub CLI：

```sh
gh workflow run release.yml --repo isunky/Anatolume --ref main -f bump=patch
gh workflow run release.yml --repo isunky/Anatolume --ref main -f bump=minor
```

发布按顺序自动完成：

1. 根据项目版本、完整标签历史和所选增幅，规划一个版本，并同步 npm、Tauri 与 Rust 的五个版本文件。
2. 运行完整检查，构建 Windows x64 安装版和便携版、macOS universal DMG，以及 Web 静态 ZIP。
3. 签名桌面更新包，校验产物的源码、签名和版本，生成 `latest.json` 更新清单、SHA256 校验清单和构建报告。
4. 在 Release notes 中列出上一个版本以来的提交摘要，并附完整变更链接。发布说明简短标明各平台下载包、数据许可与签名状况。
5. 一次性推送版本提交和 `vX.Y.Z` 标签；所有资源上传成功后才公开 GitHub Release。
6. 将同次运行构建的 Web 页面部署到 [GitHub Pages](https://isunky.github.io/Anatolume/)。

版本基于源码版本和现有正式 `vX.Y.Z` 标签中较大的值递增。`0.x` 在 GitHub 标为 **Pre-release**，主版本达到 `1` 后为正式版。版本提交只修改项目版本，不升级依赖。

## 发布附件

| 文件 | 使用方式 |
| --- | --- |
| `Anatolume_X.Y.Z_x64-setup.exe` | Windows x64 安装版；缺少 WebView2 时联网下载运行时 |
| `Anatolume_X.Y.Z_Windows-x64-portable.zip` | Windows 便携版；解压后运行，需已安装 WebView2 |
| `Anatolume_X.Y.Z_macOS-universal.dmg` | macOS 11+，兼容 Intel 和 Apple Silicon |
| `Anatolume_X.Y.Z_Web.zip` | Web 静态部署包，支持根目录和子目录 |
| `Anatolume_X.Y.Z_macOS-universal.app.tar.gz` | macOS 应用内更新包，兼容 Intel 和 Apple Silicon |
| `*.sig` | Windows 安装包、便携 ZIP 和 macOS 更新包的签名；包含签名保护的版本号 |
| `latest.json` | 客户端更新清单：版本、简洁更新内容和各平台签名、下载地址 |
| `SHA256SUMS` | 发布包、签名和更新清单的 SHA256 校验值 |
| `BUILD-REPORT.md` | 发布版本、源码、平台和校验信息 |

**macOS 用户建议从源码自行构建。** 自动生成的 DMG 未经过 Apple 公证；Windows 程序没有 Authenticode 代码签名。更新包的 Minisign 签名用于应用内校验，不替代系统代码签名。首次打开可能需要在系统安全设置中手动允许。

## 客户端自动更新

客户端默认在启动 3 秒后检查正式版更新；离线浏览不依赖检查成功。在“关于与致谢 → 应用更新”可关闭启动检查或手动检查。发现新版时，底部入口显示提示，面板列出本次更新内容；点击“下载并安装”后显示下载进度。Windows 安装版安装完自动重启；便携版与 macOS 安装后点击“立即重启”。网络恢复后会重试之前失败的自动检查。

- Windows 安装版使用 NSIS 更新包；便携版通过同目录的 `anatolume-portable.json` 标识选择独立 ZIP，校验后仅替换可执行文件，继续保持便携使用方式。请保留该标识文件，并确保程序所在目录可写。
- macOS 使用同一份通用 `.app.tar.gz`。从 DMG 启动或 Applications 目录不可写时，请先将应用复制到用户可写的 Applications 目录。自行构建的客户端仍信任本仓库官方更新密钥；若维护独立发行版，需要更换公钥与更新地址，或关闭自动检查。
- 更新源固定为 `https://github.com/isunky/Anatolume/releases/latest/download/latest.json`，仅检查比当前版本新的正式版，不接收 Pre-release 或降级更新。GitHub 不可达时可稍后重试或手动下载。
- 原生端验证下载签名及签名绑定的版本，再开始安装。发布端也校验同一公钥下的包和版本；所有平台资源上传成功后才公开 Release。
- 语言偏好、模型选择与最近浏览记录继续使用原有本机存储。网页版本继续通过站点部署更新。

旧客户端没有更新模块，需要先手动安装第一个支持自动更新的版本。此后手动启动发布工作流即可自动产出并发布客户端可识别的更新。

### 发布签名密钥

GitHub 仓库 Secrets 需设置 `TAURI_SIGNING_PRIVATE_KEY` 和 `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`。公钥以内容形式提交在 `src-tauri/tauri.conf.json` 中。CI 的基础检查不需要私钥；只有手动发布的桌面构建与便携包签名步骤读取 Secrets。

维护者应在仓库之外备份原始私钥及密码。**后续发布继续使用同一密钥，不要重新生成或覆盖；丢失后，已安装客户端无法验证新密钥签名的更新。** 当前本机密钥位于用户目录 `.tauri/anatolume-updater.key`，密码以 Windows DPAPI 加密保存在 `.tauri/anatolume-updater-password.dpapi`；加密密码文件仅能由当前 Windows 用户解密，迁移时需单独备份密码到密码管理器。

本地构建官方更新包时，将私钥内容或路径放入 `TAURI_SIGNING_PRIVATE_KEY` 环境变量，并设置 `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`，再运行 `npm run client:build`。Windows 便携包用 `node scripts/release-assets.mjs windows` 生成并签名，需同时设置发布版本与 GitHub 工作流来源信息。

自行构建且不生成签名更新包时，Windows 使用 `npm run client:build -- --config src-tauri/tauri.local.conf.json`，macOS 使用 `npm run client:build:mac -- --config src-tauri/tauri.local.conf.json`。本地配置关闭更新包产出，应用仍保留官方更新检查。缺少有效签名的包不能进入官方自动更新发布流程。

## 失败与重试

- 发布工作流只在手动选择 `main` 时创建版本和发布。其他分支不会发布。
- 检查或构建失败时，不提交版本、不创建标签、不发布 Release。
- 如果该运行的标签已经创建，使用 **Re-run failed jobs / Re-run all jobs** 会复用原版本。发布失败时优先重试原运行。
- 如果 Release 已发布但 Pages 部署失败，重试 Pages 任务即可，不产生新版本。
- 新的手动运行会规划下一个版本。请等当前发布完成后再启动下一次发布。
- 版本提交通过 `GITHUB_TOKEN` 推送，不会触发另一轮 push 工作流；普通代码提交照常触发 CI。原子推送会拒绝覆盖新的 `main` 提交。

工作流仅在发布任务授予 `contents: write`；Pages 部署单独获得 `pages: write` 和 OIDC 权限。若之后启用 `main` 分支保护，需要允许发布机器人按仓库规则更新版本提交。

## 本地开发

```sh
npm ci
npm run ci:check
```

普通本地 `npm run client:build` 使用仓库中已同步的版本，不会创建标签或发布。
