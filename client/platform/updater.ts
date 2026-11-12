import { Channel, invoke } from "@tauri-apps/api/core";
import type { UpdateBridge, UpdateProgress } from "../updates/controller";

export const nativeUpdateBridge: UpdateBridge = {
  check: () => invoke("check_update"),
  install: async onProgress => {
    const progress = new Channel<UpdateProgress>();
    progress.onmessage = onProgress;
    await invoke("install_update", { progress });
  },
  restart: () => invoke("restart_updated_app"),
};
