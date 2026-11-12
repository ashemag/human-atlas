import { isTauri } from "@tauri-apps/api/core";
import { version } from "../../package.json";

export const CLIENT_DOWNLOAD_URL = "https://github.com/isunky/Anatolume/releases";

export function runtimeInfo() {
  return { native: isTauri(), version };
}

export async function setAppTitle(title: string) {
  document.title = title;
  if (isTauri()) {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    await getCurrentWindow().setTitle(title);
  }
}

export async function openExternal(url: string) {
  if (new URL(url).protocol !== "https:") throw new Error("Only HTTPS links are supported.");
  if (isTauri()) {
    const { openUrl } = await import("@tauri-apps/plugin-opener");
    await openUrl(url);
  } else {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}
