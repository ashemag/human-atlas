import { ArrowUpRight, Check, Code2, Download, EyeOff, Heart, Monitor, Palette } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useRef } from "react";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { text, type Locale } from "../client/i18n";
import { CLIENT_DOWNLOAD_URL, runtimeInfo } from "../client/platform";
import { staticAssetUrl } from "./core/static-asset";
import UpdatePanel from "./update-panel";
import type { ClientUpdate } from "../hooks/use-client-update";
import { SELECTION_COLORS, type SelectionColorId } from "./core/selection-colors";
import type { RenderQuality } from "./core/render-quality";

const tools = [
  ["React", "https://react.dev/"],
  ["Three.js", "https://threejs.org/"],
  ["Tauri", "https://tauri.app/"],
  ["Vite", "https://vite.dev/"],
  ["Tailwind CSS", "https://tailwindcss.com/"],
  ["Base UI", "https://base-ui.com/"],
  ["Lucide", "https://lucide.dev/"],
  ["meshoptimizer", "https://github.com/zeux/meshoptimizer"],
];

export default function About({ locale, open, onOpenChange, updater, privacyMode, onPrivacyModeChange, focusPrivacy = false, selectionColor, onSelectionColorChange, renderQuality, onRenderQualityChange }: {
  locale: Locale;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  updater: ClientUpdate;
  privacyMode: boolean;
  onPrivacyModeChange: (enabled: boolean) => void;
  focusPrivacy?: boolean;
  selectionColor: SelectionColorId;
  onSelectionColorChange: (color: SelectionColorId) => void;
  renderQuality: RenderQuality;
  onRenderQualityChange: (quality: RenderQuality) => void;
}) {
  const t = (english: string) => text(english, locale);
  const runtime = runtimeInfo();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const privacySwitchRef = useRef<HTMLButtonElement>(null);
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent closeLabel={t("Close")} initialFocus={focusPrivacy ? privacySwitchRef : headingRef} className="about-sheet credits-sheet glass">
        <div className="credits-brand">
          <div className="credits-heading">
            <SheetTitle ref={headingRef} tabIndex={-1} className="credits-title">{t("About & acknowledgements")}</SheetTitle>
            <SheetDescription>{t("See the body. Understand every layer.")}</SheetDescription>
            <div className="credits-version">{t(runtime.native ? "Offline client" : "Web viewer")}<span>·</span>{runtime.version}</div>
          </div>
          <div className="credits-logo"><img src={staticAssetUrl("/branding/anatolume-logo.webp")} width={640} height={320} alt="层知 · Anatolume" /></div>
        </div>
        <section className="privacy-preference" data-targeted={focusPrivacy || undefined} aria-labelledby="privacy-heading">
          <div><h2 id="privacy-heading"><EyeOff size={17} />{t("Privacy mode")}</h2><Switch ref={privacySwitchRef} checked={privacyMode} onCheckedChange={onPrivacyModeChange} aria-labelledby="privacy-heading" aria-describedby="privacy-description" /></div>
          <p id="privacy-description">{t("Hide male reproductive structures, female breasts and external genitalia in default views and random exploration. Internal female organs remain visible; explicitly open a system or structure from the list, or select a search result, to view hidden structures.")}</p>
        </section>
        <section className="quality-preference" aria-labelledby="quality-heading">
          <h2 id="quality-heading"><Monitor size={17} aria-hidden="true" />{t("Rendering quality")}</h2>
          <div className="quality-options" role="group" aria-labelledby="quality-heading">
            <button type="button" aria-pressed={renderQuality === "sharp"} onClick={() => onRenderQualityChange("sharp")}>{t("Sharp")}</button>
            <button type="button" aria-pressed={renderQuality === "balanced"} onClick={() => onRenderQualityChange("balanced")}>{t("Balanced")}</button>
            <button type="button" aria-pressed={renderQuality === "smooth"} onClick={() => onRenderQualityChange("smooth")}>{t("Smooth")}</button>
          </div>
          <p>{t("Adjusts 3D resolution. Higher quality can use more graphics power; smooth mode may look less sharp on high-resolution screens.")}</p>
        </section>
        <section className="selection-preference" aria-labelledby="selection-color-heading">
          <h2 id="selection-color-heading"><Palette size={17} aria-hidden="true" />{t("Selection highlight")}</h2>
          <div className="selection-color-options" role="group" aria-labelledby="selection-color-heading">
            {SELECTION_COLORS.map((preset) => <button key={preset.id} type="button" className="selection-color-option" aria-label={t(preset.name)} title={t(preset.name)} aria-pressed={selectionColor === preset.id} onClick={() => onSelectionColorChange(preset.id)}>
              <span className="selection-color-swatch" style={{ backgroundColor: preset.color }} aria-hidden="true">{selectionColor === preset.id && <Check size={13} strokeWidth={2.5} />}</span>
            </button>)}
          </div>
        </section>
        {updater.native && <UpdatePanel locale={locale} updater={updater} />}
        {!runtime.native && <a className="credits-download" href={CLIENT_DOWNLOAD_URL} target="_blank" rel="noopener noreferrer">
          <span className="credits-download-icon"><Download size={20} /></span>
          <span><strong>{t("Download offline client")}</strong></span>
          <ArrowUpRight size={17} />
        </a>}

        <section className="credits-section" aria-labelledby="terminology-heading">
          <h2 id="terminology-heading">{t("Terminology & translation")}</h2>
          <p>{t("Localized names cover common organs and major bones. Unverified names remain in English. Translations have not been independently reviewed; source names and IDs are preserved.")}</p>
          <a className="credit-text-link" href="https://github.com/isunky/Anatolume/blob/main/docs/LOCALIZATION.md" target="_blank" rel="noreferrer">{t("Full attribution & adaptations")}<ArrowUpRight size={13} /></a>
        </section>

        <section className="author-card" aria-labelledby="author-heading">
          <div className="author-card-heading"><span className="author-monogram" aria-hidden="true">{"S"}</span>
            <div><span className="credits-kicker">{t("Developed & maintained by")}</span><h2 id="author-heading">{"Sunky"}</h2></div>
          </div>
          <p>{t("Continuing Anatolume with multilingual exploration, a refined interface and offline desktop access.")}</p>
          <a className="author-website" href="https://github.com/isunky/Anatolume" target="_blank" rel="noreferrer"><Code2 size={16} /><span>{"isunky/Anatolume"}</span><ArrowUpRight size={15} /></a>
        </section>

        <section className="credits-section" aria-labelledby="credits-heading">
          <h2 id="credits-heading"><Heart size={17} />{t("Built on open source")}</h2>
          <p>{t("Thanks to the creators who share their work. Their code, data and tools make this atlas possible.")}</p>
          <div className="credit-card">
            <div className="credit-card-heading"><span className="credits-kicker">{t("Original project")}</span><span className="credit-license">{"MIT"}</span></div>
            <a className="credit-project" href="https://github.com/ashemag/human-atlas" target="_blank" rel="noreferrer"><strong>{"Human Atlas"}</strong><ArrowUpRight size={15} /></a>
            <p>{t("Created by ashemag. Anatolume builds on this open-source 3D anatomy explorer and preserves its original copyright and license.")}</p>
          </div>
          <div className="credit-card">
            <div className="credit-card-heading"><span className="credits-kicker">{t("Open anatomy data")}</span><span className="credit-license">{"CC BY 4.0"}</span></div>
            <a className="credit-project" href="https://dbarchive.biosciencedbc.jp/en/bodyparts3d/download.html" target="_blank" rel="noreferrer"><strong>{"BodyParts3D"}</strong><ArrowUpRight size={15} /></a>
            <p>{t("BodyParts3D, © The Database Center for Life Science licensed under CC Attribution 4.0 International.")}</p>
            <p>{t("Geometry is simplified for rendering; names, identifiers and structure relationships retain their source references.")}</p>
            <a className="credit-text-link" href="https://github.com/isunky/Anatolume/blob/main/public/ATTRIBUTION.md" target="_blank" rel="noreferrer">{t("Full attribution & adaptations")}<ArrowUpRight size={13} /></a>
          </div>
          <div className="credit-card">
            <div className="credit-card-heading"><span className="credits-kicker">{t("Female model & source")}</span><span className="credit-license">{"CC BY 4.0"}</span></div>
            <a className="credit-project" href="https://github.com/PrejudiceNeutrino/human-atlas-enhanced" target="_blank" rel="noreferrer"><strong>{"Human Atlas Enhanced"}</strong><ArrowUpRight size={15} /></a>
            <p>{t("Thanks to PrejudiceNeutrino for sharing the female study model and its adaptation records.")}</p>
            <a className="credit-text-link" href="https://github.com/PrejudiceNeutrino" target="_blank" rel="noreferrer">{"PrejudiceNeutrino"}<ArrowUpRight size={13} /></a>
            <p>{t("Female geometry is adapted from Human Atlas Enhanced by PrejudiceNeutrino and the HRA female organ set by Kristen Browne and Heidi Schlehlein. Source IDs and adaptation records are preserved.")}</p>
            <a className="credit-text-link" href="https://lod.humanatlas.io/ref-organ/united-female/v1.5" target="_blank" rel="noreferrer">{"Human Reference Atlas / HuBMAP"}<ArrowUpRight size={13} /></a>
            <p>{t("Derived from BodyParts3D and HRA female anatomy. Proportions and placement are estimated and have not been independently reviewed.")}</p>
          </div>
        </section>

        <section className="credits-section" aria-labelledby="tools-heading">
          <h2 id="tools-heading"><Code2 size={17} />{t("Open-source tools & community")}</h2>
          <div className="credit-tools">{tools.map(([name, url]) => <a href={url} key={name} target="_blank" rel="noreferrer">{name}<ArrowUpRight size={12} /></a>)}</div>
          <p>{t("Thank you to every maintainer, contributor and person who shares feedback.")}</p>
        </section>
        <div className="credits-bottom">
          <a href="https://github.com/isunky/Anatolume" target="_blank" rel="noreferrer"><Code2 size={16} />{t("View source on GitHub")}<ArrowUpRight size={14} /></a>
          <p>{t("Application code: MIT. Anatomy data: CC BY 4.0.")}</p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
