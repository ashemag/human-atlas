import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { runtimeInfo } from "../client/platform";
import { nativeUpdateBridge } from "../client/platform/updater";
import { AUTO_UPDATE_KEY, UpdateController } from "../client/updates/controller";

export function useClientUpdate() {
  const native = runtimeInfo().native;
  const controller = useMemo(() => new UpdateController(nativeUpdateBridge), []);
  const state = useSyncExternalStore(controller.subscribe, controller.snapshot);
  const [automatic, setAutomatic] = useState(() => {
    try { return localStorage.getItem(AUTO_UPDATE_KEY) !== "off"; } catch { return true; }
  });
  useEffect(() => {
    if (!native || !automatic) return;
    const timer = window.setTimeout(() => void controller.check(), 3000);
    const online = () => { if (controller.snapshot().error === "check") void controller.check(); };
    window.addEventListener("online", online);
    return () => { clearTimeout(timer); window.removeEventListener("online", online); };
  }, [native, automatic, controller]);
  const setAutoCheck = (enabled: boolean) => {
    setAutomatic(enabled);
    try { localStorage.setItem(AUTO_UPDATE_KEY, enabled ? "on" : "off"); } catch { /* Updates work without preference storage. */ }
  };
  return { native, state, automatic, setAutoCheck, check: controller.check, install: controller.install, restart: controller.restart };
}
export type ClientUpdate = ReturnType<typeof useClientUpdate>;
