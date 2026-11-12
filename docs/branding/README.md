# 层知 · Anatolume 品牌资源

- `anatolume-logo-v1.png`：命名讨论中选定的完整中英文 Logo，保留原稿，用于 README 与应用页眉。
- `../../public/branding/anatolume-logo.png`：完整中英文 Logo 的高分辨率原稿副本。
- `../../public/branding/anatolume-logo.webp`：网页与客户端页眉、关于页使用的 640 × 320 轻量版本，保留透明背景，以无损 WebP 编码。显示尺寸不变；CSS 仅收起原稿的透明留白。
- `anatolume-app-icon.png`：由原稿提取的独立人体标志，浅色底用于网页图标和桌面图标。移除字标以保证小尺寸可读性。
- `../../public/branding/`：完整品牌图片与 32、48、180、256 像素应用图标。
- `../../src-tauri/icons/`：Windows ICO、macOS ICNS 及各平台 PNG，由 Tauri CLI 从同一应用图标生成。

更新应用图标后，在仓库根目录重新生成：

```powershell
npm run tauri -- icon docs/branding/anatolume-app-icon.png
npm run tauri -- icon docs/branding/anatolume-app-icon.png -o public/branding -p 32 -p 48 -p 180 -p 256
Copy-Item src-tauri/icons/icon.ico public/favicon.ico
```

应用图标通过 ImageGen 从原 Logo 提取：保留圆形头部、深玉绿色外层、鼠尾草绿色内层及 A 形人体负空间；移除字标、亮绿色边缘和纹理，使用不透明浅色底，居中留白。完整原稿及设计提示见 `anatolume-logo-v1.prompt.md`。
