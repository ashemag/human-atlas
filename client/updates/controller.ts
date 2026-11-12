export type UpdateInfo = { version: string; notes: string };
export type UpdateProgress = { event: "download"; downloaded: number; total?: number | null } | { event: "installing" };
export type UpdateBridge = {
  check: () => Promise<UpdateInfo | null>;
  install: (progress: (event: UpdateProgress) => void) => Promise<void>;
  restart: () => Promise<void>;
};
export type UpdateStatus = "idle" | "checking" | "current" | "available" | "downloading" | "installing" | "ready" | "error";
export type UpdateSnapshot = {
  status: UpdateStatus;
  update: UpdateInfo | null;
  downloaded: number;
  total: number | null;
  error: "check" | "download" | "install" | "restart" | null;
};

export const AUTO_UPDATE_KEY = "anatolume.check-updates";

// Independent from React so retries, concurrent clicks and failures can be exercised offline.
export class UpdateController {
  private state: UpdateSnapshot = { status: "idle", update: null, downloaded: 0, total: null, error: null };
  private listeners = new Set<() => void>();
  private busy = false;
  private bridge: UpdateBridge;
  constructor(bridge: UpdateBridge) { this.bridge = bridge; }
  snapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private publish(change: Partial<UpdateSnapshot>) {
    this.state = { ...this.state, ...change };
    this.listeners.forEach(listener => listener());
  }
  check = async () => {
    if (this.busy || this.state.status === "ready") return;
    this.busy = true;
    this.publish({ status: "checking", error: null });
    try {
      const update = await this.bridge.check();
      this.publish({ status: update ? "available" : "current", update });
    } catch {
      this.publish({ status: "error", error: "check" });
    } finally { this.busy = false; }
  };
  install = async () => {
    if (this.busy || !this.state.update || this.state.status === "ready") return;
    this.busy = true;
    this.publish({ status: "downloading", downloaded: 0, total: null, error: null });
    try {
      await this.bridge.install(event => {
        if (event.event === "installing") this.publish({ status: "installing" });
        else this.publish({ downloaded: event.downloaded, total: event.total ?? null });
      });
      this.publish({ status: "ready" });
    } catch {
      this.publish({ status: "error", error: this.state.status === "installing" ? "install" : "download" });
    } finally { this.busy = false; }
  };
  restart = async () => {
    if (this.busy || this.state.status !== "ready") return;
    this.busy = true;
    this.publish({ error: null });
    try { await this.bridge.restart(); }
    catch { this.publish({ error: "restart" }); }
    finally { this.busy = false; }
  };
}
