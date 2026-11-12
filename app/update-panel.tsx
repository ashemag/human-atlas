import { ArrowDownToLine, Check, RefreshCw } from "lucide-react";
import { text, type Locale } from "../client/i18n";
import type { ClientUpdate } from "../hooks/use-client-update";

export default function UpdatePanel({ locale, updater }: { locale: Locale; updater: ClientUpdate }) {
  const t = (english: string) => text(english, locale);
  const { state, automatic, setAutoCheck, check, install, restart } = updater;
  const busy = ["checking", "downloading", "installing"].includes(state.status);
  const percent = state.total ? Math.min(100, Math.floor(state.downloaded / state.total * 100)) : null;
  const summary = state.status === "checking" ? t("Checking for updates…")
    : state.status === "current" ? t("You are up to date")
    : state.status === "downloading" ? t("Downloading update…")
    : state.status === "installing" ? t("Installing update…")
    : state.status === "ready" ? t("Update installed. Restart to finish.")
    : state.update ? text("Version {version} is available", locale, { version: state.update.version })
    : t("Keep Anatolume up to date");
  const failure = state.error === "check" ? t("Could not check for updates. Check your connection and try again.")
    : state.error === "download" ? t("Download or signature verification failed. Your current version is unchanged; try again.")
    : state.error === "install" ? t("Installation failed. Check that the application folder is writable, then retry.")
    : state.error === "restart" ? t("Could not restart. Close and reopen Anatolume to finish.") : null;
  return <section className="update-card" aria-labelledby="update-heading">
    <div className="update-heading"><span className="update-icon"><ArrowDownToLine size={18} /></span><div>
      <h2 id="update-heading">{t("Application updates")}</h2><p role="status" aria-live="polite">{summary}</p>
    </div>{state.status === "current" && <Check size={17} />}</div>
    {state.update && <div className="update-notes"><span>{t("What's new")}</span><pre>{state.update.notes || t("Improvements and fixes in this release.")}</pre></div>}
    {state.status === "downloading" && <div className="update-progress">
      <progress aria-label={t("Download progress")} max={100} value={percent ?? undefined} />
      <span>{percent === null ? `${(state.downloaded / 1024 / 1024).toFixed(1)} MB` : `${percent}% · ${(state.downloaded / 1024 / 1024).toFixed(1)} / ${((state.total ?? 0) / 1024 / 1024).toFixed(1)} MB`}</span>
    </div>}
    {failure && <p className="update-error" role="alert">{failure}</p>}
    <div className="update-actions">
      {state.status === "ready" ? <button className="update-primary" onClick={() => void restart()}>{t("Restart now")}</button>
        : state.update && state.error !== "check" ? <button className="update-primary" disabled={busy} onClick={() => void install()}><ArrowDownToLine size={14} />{t(state.error ? "Retry update" : busy ? "Updating…" : "Download & install")}</button> : null}
      {state.status !== "ready" && <button className="update-secondary" disabled={busy} onClick={() => void check()}><RefreshCw size={13} className={state.status === "checking" ? "update-spin" : ""} />{t("Check for updates")}</button>}
    </div>
    <label className="update-preference"><input type="checkbox" checked={automatic} onChange={event => setAutoCheck(event.target.checked)} />{t("Check automatically at startup")}</label>
    <p className="update-footnote">{t("Downloads are verified before installation. Your language and browsing history are kept.")}</p>
  </section>;
}
