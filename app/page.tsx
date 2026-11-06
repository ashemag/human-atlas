import { flushSync } from "react-dom";
import {
  READING_GUIDE,
  DIRECTION_TERMS,
  CONTENT_REFERENCES,
  chineseStructureKnowledge,
} from "../client/content/zh-CN";
import {
  text,
  displayName,
  systemName,
  readLocale,
  errorText,
  LANGUAGE_STORAGE_KEY,
  LOCALES,
  normalizeSearch,
  structureExplanation,
  hasStructureExplanation,
  type Locale,
} from "../client/i18n";
import { CLIENT_DOWNLOAD_URL, openExternal, runtimeInfo, setAppTitle } from "../client/platform";
import { registerAtlasTools } from "./core/agent-tools";
import { staticAssetUrl } from "./core/static-asset";
import { MODELS, MODEL_STORAGE_KEY, defaultLayers, isModelAtlas, readModel, readRecent, recentKey, type ModelId } from "./core/model-catalogue";
import { anatomySearchIndex, matchedSearchAlias, type SearchEntry } from "./core/anatomy-search";
import { pickRandomOrgan, randomOrganCandidates } from "./core/random-organ";
import { isPartVisible, privacyHiddenParts, readPrivacyMode, PRIVACY_MODE_STORAGE_KEY } from "./core/privacy-mode";
import { readSelectionColor, SELECTION_COLOR_STORAGE_KEY } from "./core/selection-colors";
import { InputGroupButton } from "@/components/ui/input-group";
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  ArrowUpRight,
  ArrowLeft,
  ArrowRight,
  Bone,
  BookOpen,
  Compass,
  Download,
  Eye,
  EyeOff,
  Heart,
  MousePointer2,
  PanelLeftClose,
  PanelLeftOpen,
  PersonStanding,
  ChevronDown,
  ChevronRight,
  Focus,
  Info,
  Layers3,
  Pause,
  RotateCcw,
  RotateCw,
  Search,
  Shuffle,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { ControlTooltip } from "./control-tooltip";
import { Switch } from "@/components/ui/switch";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import {
  Combobox,
  ComboboxInput,
  ComboboxList,
  ComboboxItem,
  ComboboxEmpty,
} from "@/components/ui/combobox";
const AnatomyScene = lazy(() => import("./scene"));
const SystemLayers = lazy(() => import("./system-layers"));
import { systemStructures, clearStructureOverrides, explicitSystemOverrides, hideSelectedStructure } from "./core/structure-layers";
const About = lazy(() => import("./about"));
import { useClientUpdate } from "../hooks/use-client-update";
import {
  DEFAULT_VISIBLE,
  SYSTEMS,
  type Atlas,
  type Concept,
  type SceneState,
  type SystemId,
  type View,
} from "./core/anatomy";
const initial: SceneState = {
  explode: 0,
  visible: DEFAULT_VISIBLE,
  selected: [],
  isolate: false,
  view: "three-quarter",
  rotate: false,
  reset: 0,
};
const ORGAN_SYSTEMS: SystemId[] = [
  "cardiac",
  "respiratory",
  "digestive",
  "urinary",
  "endocrine",
  "reproductive",
  "mammary",
];
function syncHomeScroll(element: HTMLElement | null) {
  if (!element) return;
  element.parentElement?.style.setProperty("--home-scroll", `${element.scrollTop}px`);
}

export default function Home() {
  const updater = useClientUpdate();
  const [selectionColor, setSelectionColor] = useState(() => {
    try { return readSelectionColor(localStorage); } catch { return readSelectionColor(); }
  });
  useEffect(() => {
    try { localStorage.setItem(SELECTION_COLOR_STORAGE_KEY, selectionColor); }
    catch { /* Color selection remains available without persistent storage. */ }
  }, [selectionColor]);
  const [showBase, setShowBase] = useState(() => {
    try { return localStorage.getItem("anatolume.showBase") !== "false"; }
    catch { return true; }
  });
  useEffect(() => {
    try { localStorage.setItem("anatolume.showBase", String(showBase)); }
    catch { /* The display setting still works without persistent storage. */ }
  }, [showBase]);
  const [privacyMode, setPrivacyMode] = useState(() => {
    try { return readPrivacyMode(localStorage); } catch { return false; }
  });
  useEffect(() => {
    try { localStorage.setItem(PRIVACY_MODE_STORAGE_KEY, String(privacyMode)); }
    catch { /* Viewing remains available without persistent storage. */ }
  }, [privacyMode]);
  const [model, setModel] = useState<ModelId>(() => {
    try { return readModel(localStorage, location.search); }
    catch { return readModel(undefined, location.search); }
  });
  const [locale, setLocale] = useState<Locale>(() => {
    try {
      return readLocale(window.localStorage);
    } catch {
      return "zh-CN";
    }
  });
  const [linkError, setLinkError] = useState(false);
  const [creditsOpen, setCreditsOpen] = useState(false);
  const [focusPrivacy, setFocusPrivacy] = useState(false);
  const t = (english: string, values: Record<string, string | number> = {}) =>
    text(english, locale, values);
  const dn = (english?: string) => (english ? displayName(english, locale) : "");
  const sn = (system: (typeof SYSTEMS)[number]) => systemName(system.id, system.name, locale);
  useEffect(() => {
    document.documentElement.lang = locale;
    const title = text("Anatolume — 3D Anatomy Explorer", locale);
    void setAppTitle(title).catch(() => { /* The browser title remains available if the native bridge is unavailable. */ });
    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, locale);
    } catch {
      /* Browsing remains available if storage is disabled. */
    }
  }, [locale]);
  const externalClick = (event: React.MouseEvent) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const anchor = target.closest("a[href]");
    if (!(anchor instanceof HTMLAnchorElement) || !runtimeInfo().native) return;
    event.preventDefault();
    setLinkError(false);
    void openExternal(anchor.href).catch(() => setLinkError(true));
  };
  const detailTitle = useRef<HTMLHeadingElement>(null);
  const [detailCompact, setDetailCompact] = useState(false);
  const [detailWide, setDetailWide] = useState(false);
  const [detailElement, setDetailElement] = useState<HTMLDivElement | null>(null);
  const [detailLayout, setDetailLayout] = useState("");
  useEffect(() => {
    if (!detailElement) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setDetailLayout(`${Math.round(width)}:${Math.round(height)}`);
    });
    observer.observe(detailElement);
    return () => observer.disconnect();
  }, [detailElement]);
  const searchInput = useRef<HTMLInputElement>(null);
  const highlightedConcept = useRef<Concept | undefined>(undefined);
  const previousRandomOrgan = useRef<string | undefined>(undefined);
  const [recentIds, setRecentIds] = useState<string[]>(() => {
    try { return readRecent(localStorage, model); } catch { return []; }
  });
  useEffect(() => {
    try {
      localStorage.setItem(recentKey(model), JSON.stringify(recentIds));
      localStorage.setItem(MODEL_STORAGE_KEY, model);
    } catch { /* Storage is optional. */ }
  }, [model, recentIds]);
  const [screen, setScreen] = useState<"home" | "explore">(() => location.hash === "#explore" ? "explore" : "home");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  useEffect(() => {
    const search = new URLSearchParams(location.search);
    search.set("model", model);
    history.replaceState(null, "", `${location.pathname}?${search}${screen === "explore" ? "#explore" : ""}`);
  }, [screen, model]);
  const [atlas, setAtlas] = useState<Atlas | null>(null),
    [state, setState] = useState(initial),
    [progress, setProgress] = useState(0),
    [error, setError] = useState(""),
    [panel, setPanel] = useState<"layers" | "search" | null>(() => innerWidth >= 768 ? "layers" : null),
    [details, setDetails] = useState(false),
    [about, setAbout] = useState(false),
    [query, setQuery] = useState(""),
    [chosen, setChosen] = useState<Concept | null>(null);
  useEffect(() => {
    const compact = matchMedia("(max-width: 767px)");
    const resizePanels = () => {
      if (compact.matches) {
        setPanel(null);
        setDetailCompact(true);
      } else {
        setPanel((current) => current ?? "layers");
        setDetailCompact(false);
      }
    };
    compact.addEventListener("change", resizePanels);
    return () => compact.removeEventListener("change", resizePanels);
  }, []);
  useEffect(() => {
    const abort = new AbortController();
    previousRandomOrgan.current = undefined;
    setProgress(0);
    setError("");
    setAtlas(null);
    setChosen(null);
    setDetails(false);
    setState({ ...initial, visible: defaultLayers(model, null, privacyMode) });
    fetch(staticAssetUrl(MODELS[model].manifest), { signal: abort.signal })
      .then((r) => {
        if (!r.ok) throw new Error("The anatomy catalogue could not be loaded.");
        return r.json();
      })
      .then((data: unknown) => {
        if (abort.signal.aborted) return;
        if (!isModelAtlas(data, model)) throw new Error("The anatomy catalogue could not be loaded.");
        setState({ ...initial, visible: defaultLayers(model, data, privacyMode) });
        setAtlas(data);
      })
      .catch((e) => {
        if (!abort.signal.aborted) setError(e.message);
      });
    return () => abort.abort();
  }, [model]);
  const changeModel = (next: ModelId) => {
    if (next === model) return;
    setAtlas(null);
    setProgress(0);
    setError("");
    setChosen(null);
    setDetails(false);
    setQuery("");
    highlightedConcept.current = undefined;
    setState({ ...initial, visible: defaultLayers(next, null, privacyMode) });
    try { setRecentIds(readRecent(localStorage, next)); } catch { setRecentIds([]); }
    setModel(next);
  };
  const hiddenParts = useMemo(() => privacyHiddenParts(atlas, privacyMode), [atlas, privacyMode]);
  const hiddenPartIds = useMemo(() => new Set(hiddenParts), [hiddenParts]);
  const defaultVisible = useMemo(() => defaultLayers(model, atlas, privacyMode), [model, atlas, privacyMode]);
  const randomOrgans = useMemo(() => randomOrganCandidates(atlas, model).filter((concept) => !concept.elements.some((id) => hiddenPartIds.has(id))), [atlas, model, hiddenPartIds]);
  const randomReady = progress >= 100 && !error && randomOrgans.length > 0;
  const organVisible = useMemo(() => ORGAN_SYSTEMS.filter((id) => !(privacyMode && (model === "male" ? id === "reproductive" : id === "mammary")) && (!atlas || atlas.parts.some((p) => p.system === id))), [atlas, privacyMode, model]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (
        e.key === "/" &&
        !(e.target instanceof HTMLInputElement) &&
        !(e.target instanceof HTMLTextAreaElement)
      ) {
        e.preventDefault();
        setScreen("explore");
        setSidebarCollapsed(false);
        setPanel("search");
        requestAnimationFrame(() => searchInput.current?.focus());
        if (innerWidth < 768) setDetails(false);
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  const parts = useMemo(() => new Map(atlas?.parts.map((p) => [p.id, p])), [atlas]);
  const searchIndex = useMemo(
    () => (atlas ? anatomySearchIndex(atlas) : new Map<string, SearchEntry>()),
    [atlas],
  );
  const counts = useMemo(
    () =>
      Object.fromEntries(
        SYSTEMS.map((s) => [s.id, atlas?.parts.filter((p) => p.system === s.id).length ?? 0]),
      ),
    [atlas],
  );
  const activeSystems = SYSTEMS.filter((s) => counts[s.id] > 0);
  const structuresBySystem = useMemo(() => systemStructures(atlas), [atlas]);
  const matchesLayers = (ids: SystemId[]) =>
    !state.isolate &&
    !Object.keys(state.partVisibility ?? {}).length &&
    state.visible.length === ids.length &&
    ids.every((id) => state.visible.includes(id));
  const allLayers = matchesLayers(activeSystems.map((s) => s.id));
  const skeletonLayers = matchesLayers(["skeletal"]);
  const organLayers = matchesLayers(organVisible);
  const singleSystem = activeSystems.find((s) => matchesLayers([s.id]));
  const layerStatus = state.isolate
    ? t("Isolated selection")
    : Object.keys(state.partVisibility ?? {}).length
      ? t("Custom layers")
    : !state.visible.length
      ? t("All hidden")
      : allLayers
        ? t("All")
        : skeletonLayers
          ? t("Skeleton")
          : organLayers
            ? t("Organs")
            : matchesLayers(defaultVisible)
              ? t("Default layers")
              : singleSystem
                ? t("Only {name}", { name: sn(singleSystem) })
                : t("Custom layers");
  const applyLayers = (visible: SystemId[], explicitSystem?: SystemId) => {
    setDetails(false);
    setChosen(null);
    setState((s) => ({ ...s, visible, selected: [], isolate: false, focus: 0,
      partVisibility: explicitSystem ? explicitSystemOverrides(atlas, explicitSystem, true, hiddenPartIds) : {},
    }));
  };
  const selectedParts = state.selected.map((id) => parts.get(id)).filter((p) => !!p),
    selected = selectedParts[0],
    system = SYSTEMS.find((s) => s.id === selected?.system);
  const visiblePartIds = useMemo(() => {
    const visible = new Set(state.visible), selection = new Set(state.selected);
    return new Set(atlas?.parts.filter((part) => isPartVisible(part, visible, selection, state.isolate, hiddenPartIds, state.partVisibility)).map((p) => p.id));
  }, [atlas, state.visible, state.selected, state.isolate, hiddenPartIds, state.partVisibility]);
  const visibleCount = visiblePartIds.size;
  const changePrivacyMode = (enabled: boolean) => {
    setPrivacyMode(enabled);
    setChosen(null);
    setDetails(false);
    setState((s) => ({ ...initial, visible: defaultLayers(model, atlas, enabled), reset: s.reset + 1 }));
  };
  const searchResults = useMemo(() => {
    if (!atlas) return { items: [] as Concept[], total: 0 };
    const term = normalizeSearch(query);
    if (!term) {
      const popular = [
        "heart",
        "brain",
        "liver",
        "stomach",
        "spleen",
        "pancreas",
        "urinary bladder",
        "trachea",
      ]
        .map((name) => atlas.concepts.find((c) => c.name.toLowerCase() === name))
        .filter((x): x is Concept => !!x);
      const recent = recentIds.flatMap((id) => searchIndex.get(id)?.concept ?? []);
      return { items: [...recent, ...popular.filter((c) => !recentIds.includes(c.id))], total: 0 };
    }
    const matches = atlas.concepts
      .filter((c) => searchIndex.get(c.id)?.searchable.includes(term))
      .sort((a, b) => a.name.length - b.name.length);
    return { items: matches.slice(0, 80), total: matches.length };
  }, [atlas, query, recentIds, searchIndex]);
  const results = searchResults.items;
  const remember = (id: string) =>
    setRecentIds((ids) => [id, ...ids.filter((existing) => existing !== id)].slice(0, 6));
  const choose = (c: Concept) => {
    setScreen("explore");
    if (innerWidth >= 768 && innerWidth < 900) setSidebarCollapsed(true);
    setDetailCompact(innerWidth < 768);
    remember(c.id);
    setChosen(c);
    setState((s) => ({ ...s, selected: c.elements, isolate: true, explode: 0, rotate: false, focus: 0, partVisibility: clearStructureOverrides(s.partVisibility, c.elements) }));
    setDetails(true);
    if (innerWidth < 768) setPanel(null);
  };
  const chooseRandomOrgan = () => {
    if (!randomReady) return;
    const concept = pickRandomOrgan(randomOrgans, chosen?.id, previousRandomOrgan.current);
    if (!concept) return;
    previousRandomOrgan.current = concept.id;
    choose(concept);
  };
  useEffect(() => {
    if (!atlas) return;
    return registerAtlasTools(atlas, (c) => flushSync(() => choose(c)));
  }, [atlas]);
  const choosePart = (id: string) => {
    const p = parts.get(id);
    if (!p) return;
    setScreen("explore");
    if (innerWidth >= 768 && innerWidth < 900) setSidebarCollapsed(true);
    setDetailCompact(innerWidth < 768);
    remember(p.conceptId);
    setChosen({ id: p.conceptId, name: p.name, elements: [id] });
    setState((s) => ({ ...s, selected: [id], rotate: false, focus: 0, partVisibility: clearStructureOverrides(s.partVisibility, [id]) }));
    setDetails(true);
    if (innerWidth < 768) setPanel(null);
  };
  const toggle = (id: SystemId, enabled: boolean) => {
    setDetails(false);
    setState((s) => ({
      ...s,
      selected: [],
      isolate: false,
      focus: 0,
      visible: enabled ? [...new Set([...s.visible, id])] : s.visible.filter((x) => x !== id),
      partVisibility: explicitSystemOverrides(atlas, id, enabled, hiddenPartIds, s.partVisibility),
    }));
  };
  const toggleStructure = (structure: Concept, enabled: boolean) => {
    setDetails(false);
    setChosen(null);
    setState((s) => ({ ...s, selected: [], isolate: false, focus: 0,
      partVisibility: { ...s.partVisibility, ...Object.fromEntries(structure.elements.map((id) => [id, enabled])) },
    }));
  };
  const reset = () => {
    setState((s) => ({ ...initial, visible: defaultVisible, reset: s.reset + 1 }));
    setChosen(null);
    setDetails(false);
    setPanel(innerWidth >= 768 ? "layers" : null);
    setQuery("");
  };
  const resetView = () => {
    setState((s) => ({
      ...s,
      view: s.explode > 0.8 ? "front" : initial.view,
      rotate: false,
      focus: 0,
      reset: s.reset + 1,
    }));
  };
  const openPanel = (next: "layers" | "search") => {
    setScreen("explore");
    setSidebarCollapsed(false);
    if (innerWidth < 768) setDetails(false);
    setPanel((p) => innerWidth < 768 && p === next ? null : next);
    if (next === "search") requestAnimationFrame(() => searchInput.current?.focus());
  };
  const startExploring = (visible?: SystemId[]) => {
    setScreen("explore");
    setSidebarCollapsed(false);
    setPanel(innerWidth >= 768 ? "layers" : null);
    if (visible) {
      setChosen(null);
      setDetails(false);
      setState((s) => ({ ...initial, visible, reset: s.reset + 1 }));
    }
  };
  const goHome = () => {
    setScreen("home");
    setDetails(false);
    setPanel(null);
    setState((s) => ({ ...initial, visible: defaultVisible, reset: s.reset + 1 }));
    setChosen(null);
  };
  const returnToOverview = () => {
    setChosen(null);
    setDetails(false);
    setState((s) => ({
      ...s,
      selected: [],
      isolate: false,
      focus: 0,
      rotate: false,
      view: s.explode > 0.8 ? "front" : initial.view,
      reset: s.reset + 1,
    }));
  };
  return (
    <TooltipProvider delay={350}>
    <main className={`studio mode-${screen} ${panel === "search" ? "is-search" : ""} ${sidebarCollapsed ? "sidebar-collapsed" : ""} ${details && selectedParts.length ? "has-inspector" : ""} ${detailWide ? "inspector-wide" : ""}`} onClick={externalClick}>
      {atlas && (
        <Suspense fallback={null}><AnatomyScene
          key={model}
          atlas={atlas}
          locale={locale}
          state={{
            ...state,
            selectionColor,
            showBase,
            hiddenParts,
            inspectorOpen: details && selectedParts.length > 0,
            inspectorLayout: detailLayout,
          }}
          onSelect={choosePart}
          onProgress={(n) => {
            setProgress(n);
            if (n === 100) setError("");
          }}
          onError={setError}
        /></Suspense>
      )}
      <div className="vignette" />
      <header className="app-header">
        <button className="brand" onClick={goHome} aria-label={t("Go to homepage")}>
          <img className="brand-logo" src={staticAssetUrl("/branding/anatolume-logo.webp")} width={640} height={320} alt="层知 · Anatolume" />
        </button>
        <nav className="primary-nav" aria-label={t("Main navigation")}>
          <button className={screen === "home" ? "active" : ""} onClick={goHome} aria-current={screen === "home" ? "page" : undefined}>{t("Home")}</button>
          <button className={screen === "explore" ? "active" : ""} onClick={() => startExploring()} aria-current={screen === "explore" ? "page" : undefined}>{t("3D atlas")}</button>
          <button onClick={() => setAbout(true)}>{t("Learning guide")}</button>
          <button className="about-nav" onClick={() => setCreditsOpen(true)}>{t("About")}</button>
        </nav>
      <div className="model-choice">
        <label className="sr-only" htmlFor="atlas-model">{t("Anatomy model")}</label>
        <select id="atlas-model" value={model} onChange={(event) => changeModel(event.target.value as ModelId)}>
          <option value="male">{t("Male")}</option>
          <option value="female">{t("Female · experimental")}</option>
        </select>
      </div>
      <div className="language-choice">
        <label className="sr-only" htmlFor="atlas-language">{t("Language")}</label>
        <select
          id="atlas-language"
          value={locale}
          onChange={(e) => setLocale(e.target.value as Locale)}
        >
          {LOCALES.map(({ id, label }) => <option key={id} value={id}>{label}</option>)}
        </select>
      </div>
      <nav className="top-actions" aria-label={t("Explorer panels")}>
        <ControlTooltip label={t("Random organ")} side="bottom">
          <Button variant="ghost" className="header-random" disabled={!randomReady} onClick={chooseRandomOrgan} aria-label={t("Random exploration")}><Shuffle size={17} /><span>{t("Random exploration")}</span></Button>
        </ControlTooltip>
        <ControlTooltip label={t("Search anatomy")} side="bottom">
        <Button
          variant="ghost"
          className={`header-search ${panel === "search" && screen === "explore" ? "active" : ""}`}
          onClick={() => openPanel("search")}
          aria-label={t("Search anatomy")}
        >
          <Search size={18} />
          <span>{t("Search anatomy")}</span>
          <kbd>/</kbd>
        </Button>
        </ControlTooltip>
        <ControlTooltip label={updater.native && updater.state.update ? t(updater.state.status === "ready" ? "Restart to update" : "New version available") : t("About this atlas")} side="bottom">
        <Button
          variant="ghost"
          className={`icon-button header-about ${updater.native && updater.state.update ? "has-update" : ""}`}
          aria-label={t("About this atlas")}
          onClick={() => {
            setCreditsOpen(true);
          }}
        >
          <Info size={18} />
        </Button>
        </ControlTooltip>
      </nav>
      </header>
      {linkError && <div className="link-status glass" role="status">{t("Could not open this link.")}</div>}
      {screen === "home" && (
        <section ref={syncHomeScroll} className="home-screen" aria-label={t("Home")} onScroll={(event) => syncHomeScroll(event.currentTarget)}>
          <div className="home-intro">
            <div className="home-eyebrow"><span className="status-dot" />{t("YOUR INTERACTIVE ANATOMY ATLAS")}</div>
            <h1>{t("See the body.")}<br /><span>{t("Understand every layer.")}</span></h1>
            <p className="home-description">{t("An entire world beneath the surface. Explore human anatomy in 3D, uncover its systems, and get to know each structure at your own pace.")}</p>
            <div className="home-cta">
              <Button className="start-button" onClick={() => startExploring(defaultVisible)}>{t("Start exploring")}<ArrowRight size={19} /></Button>
              <button className="guide-button" onClick={() => setAbout(true)}><BookOpen size={18} />{t("How to explore")}</button>
              {!updater.native && <a className="guide-button download-button" href={CLIENT_DOWNLOAD_URL} target="_blank" rel="noopener noreferrer"><Download size={18} /><span>{t("Download offline client")}</span></a>}
            </div>
            <div className="home-stats">
              <div><strong>{atlas?.parts.length.toLocaleString(locale) ?? "—"}</strong><span>{t("Individual structures")}</span></div>
              <div><strong>{atlas ? activeSystems.length : "—"}</strong><span>{t("Anatomical systems")}</span></div>
              <div><strong>{atlas?.concepts.length.toLocaleString(locale) ?? "—"}</strong><span>{t("Named concepts")}</span></div>
            </div>
            <div className="home-paths">
              <div className="home-section-title"><span>{t("Choose a starting point")}</span><small>{t("One click to discover")}</small></div>
              {([
                { icon: PersonStanding, title: "Whole body", description: "See how everything connects", visible: defaultVisible, tone: "teal" },
                { icon: Bone, title: "Bones & support", description: "Explore the body's framework", visible: ["skeletal"] as SystemId[], tone: "sand" },
                { icon: Heart, title: "Internal organs", description: "Look beneath the surface", visible: organVisible, tone: "rose" },
              ]).map(({ icon: Icon, title, description, visible, tone }) => (
                <button className={`home-path ${tone}`} key={title} onClick={() => startExploring(visible)}>
                  <span className="path-icon"><Icon size={22} strokeWidth={1.6} /></span>
                  <span><strong>{t(title)}</strong><small>{t(description)}</small></span><ArrowUpRight size={18} />
                </button>
              ))}
            </div>
            {recentIds.length > 0 && atlas && <div className="home-recent"><span>{t("Recently explored")}</span><div>{recentIds.flatMap((id) => searchIndex.get(id)?.concept ?? []).slice(0, 3).map((c) => <button key={c.id} onClick={() => choose(c)}>{dn(c.name)}<ArrowUpRight size={12} /></button>)}</div></div>}
          </div>
          <div className="hero-label"><span className="status-dot" />{t("LIVE 3D MODEL")}<span>{MODELS[model].source}</span></div>
          <div className="hero-model-caption"><span>{t(model === "female" ? "FEMALE · EXPERIMENTAL STUDY MODEL" : "ADULT HUMAN · MALE")}</span><p><MousePointer2 size={14} />{t("Drag to rotate. Click to discover.")}</p></div>
        </section>
      )}
      {screen === "explore" && <>
      <div className="scene-heading">
        <ControlTooltip label={sidebarCollapsed ? t("Show exploration tools") : t("Hide exploration tools")} side="right">
        <button className="sidebar-toggle" onClick={() => setSidebarCollapsed((v) => !v)} aria-label={sidebarCollapsed ? t("Show exploration tools") : t("Hide exploration tools")}>
          {sidebarCollapsed ? <PanelLeftOpen size={19} /> : <PanelLeftClose size={19} />}
        </button>
        </ControlTooltip>
        <div><h1>{t("3D anatomy explorer")}</h1><span>{t(model === "female" ? "Female study model · estimated anatomy" : "Click a structure to discover more")}</span></div>
        <span className="scene-status"><span className="status-dot" />{layerStatus}</span>
      </div>
      <aside className={`workspace-sidebar glass ${panel ? "mobile-open" : ""}`} aria-label={t("Exploration tools")}>
        <div className="sidebar-head"><span title={t("Explore at your own pace")}><Compass size={17} />{t("Exploration tools")}</span><button className="mobile-only icon-button" onClick={() => setPanel(null)} aria-label={t("Close exploration tools")}><X size={18} /></button></div>
        <div className="sidebar-tabs">
          <button className={panel !== "search" ? "active" : ""} aria-pressed={panel !== "search"} onClick={() => setPanel("layers")}><Layers3 size={16} />{t("Systems")}</button>
          <button className={panel === "search" ? "active" : ""} aria-pressed={panel === "search"} onClick={() => setPanel("search")}><Search size={16} />{t("Find a structure")}<kbd>/</kbd></button>
        </div>
      {panel !== "search" && (
      <section
        className="layers-panel"
        aria-label={t("Anatomical layers")}
      >
        <div className="panel-heading">
          <span className="layer-heading-title">
            {t("Anatomical layers")}
            <TooltipProvider delay={250}>
              <Tooltip>
                <TooltipTrigger render={<Button variant="ghost" className="layer-help-trigger" aria-label={t("Expand a system to browse structures; switches control visibility.")} />}>
                  <Info size={14} aria-hidden="true" />
                </TooltipTrigger>
                <TooltipContent side="right" className="layer-help-tooltip">
                  {t("Expand a system to browse structures; switches control visibility.")}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </span>
          <Badge
            variant="secondary"
            className="desktop-only small-number"
            title={t("{count} systems available", { count: activeSystems.length })}
          >
            {activeSystems.length}
          </Badge>
        </div>
        <div className="layer-presets">
          <Button
            variant="ghost"
            aria-pressed={matchesLayers(defaultVisible)}
            onClick={() => applyLayers(defaultVisible)}
          >
            <svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
              <circle cx="12" cy="3.5" r="2" />
              <path d="M9.5 7.5h5c.9 0 1.6.5 1.9 1.3l2.1 5a1 1 0 0 1-1.8.8L15 11v4l1 6h-2.5L12 16.5 10.5 21H8l1-6v-4l-1.7 3.6a1 1 0 0 1-1.8-.8l2.1-5c.3-.8 1-1.3 1.9-1.3Z" />
            </svg>{t("Whole body")}
          </Button>
          <Button
            variant="ghost"
            aria-pressed={skeletonLayers}
            onClick={() => applyLayers(["skeletal"])}
          >
            <Bone size={17} />{t("Skeleton")}
          </Button>
          <Button
            variant="ghost"
            aria-pressed={organLayers}
            onClick={() => applyLayers(organVisible)}
          >
            <Heart size={17} />{t("Organs")}
          </Button>
        </div>
        <div className="layer-context">
          <p className="layer-status" role="status">
            <span>{t("Current layers")}</span>
            <strong>{layerStatus}</strong>
          </p>
          <p id="layer-help" className="sr-only">
            {t("Expand a system to browse structures; switches control visibility.")}
          </p>
          {selectedParts.some((p) => !state.visible.includes(p.system)) && !state.isolate && (
            <p className="layer-help">{t("Selected structures remain visible.")}</p>
          )}
        </div>
        <Suspense fallback={null}>
          <SystemLayers key={model} locale={locale} structures={structuresBySystem} visibleIds={visiblePartIds} selectedId={selectedParts.length ? chosen?.id : undefined}
            ready={progress >= 100 && !error} isOnly={(id) => !state.isolate && visiblePartIds.size > 0 &&
              (atlas?.parts.every((part) => visiblePartIds.has(part.id) === (part.system === id)) ?? false)}
            onSystem={toggle} onOnly={(id) => applyLayers([id], id)} onStructure={toggleStructure} onInspect={choose} />
        </Suspense>
        <div className="panel-foot">
          <span>{t("{count} pieces visible", { count: visibleCount.toLocaleString(locale) })}</span>
          <Button variant="ghost" onClick={() => applyLayers([])}>
            {t("Hide all")}
          </Button>
        </div>
      </section>
      )}
      {panel === "search" && (
        <section className="search-panel" aria-label={t("Find a structure")}>
          <div className="panel-heading">
            <span>{t("Find a structure")}</span>
            <Button
              variant="ghost"
              className="icon-button"
              onClick={() => { setPanel(innerWidth >= 768 ? "layers" : null); setQuery(""); }}
              aria-label={t("Close search")}
            >
              <X size={18} />
            </Button>
          </div>
          <Combobox<Concept>
            items={results}
            inline
            autoHighlight
            onItemHighlighted={(value) => { highlightedConcept.current = value; }}
            value={null}
            onValueChange={(value) => {
              if (value) choose(value);
            }}
            inputValue={query}
            onInputValueChange={(value) => {
              highlightedConcept.current = undefined;
              setQuery(value);
            }}
            itemToStringLabel={(c) => dn(c.name)}
            filter={null}
          >
            <ComboboxInput
              ref={searchInput}
              autoFocus
              placeholder={t("Heart, femur, cranial nerve…")}
              aria-label={t("Search named anatomical structures")}
              showTrigger={false}
              aria-describedby="search-help"
              onKeyDown={(event) => {
                if (event.key === "Escape") setPanel(innerWidth >= 768 ? "layers" : null);
                if (event.key === "Enter" && !event.nativeEvent.isComposing) {
                  const concept = results.find((item) => item.id === highlightedConcept.current?.id) ?? results[0];
                  if (concept) {
                    event.preventDefault();
                    choose(concept);
                  }
                }
              }}
              endAdornment={
                query && (
                  <InputGroupButton
                    className="search-clear"
                    variant="ghost"
                    aria-label={t("Clear search")}
                    title={t("Clear search")}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => {
                      setQuery("");
                      searchInput.current?.focus();
                    }}
                  >
                    <X size={14} />
                  </InputGroupButton>
                )
              }
            />
            <p id="search-help" className="search-help">
              {t("Select a result to inspect it on its own.")}
              <br />
              {t("Left and right refer to the body's own sides.")}
            </p>
            <div className="search-result-summary">
              <span role="status">
                {query.trim()
                  ? t("{count} matches", { count: searchResults.total })
                  : recentIds.length
                    ? t("Recent & common structures")
                    : t("Common structures")}
              </span>
              {!query.trim() && recentIds.length > 0 && (
                <Button variant="ghost" onClick={() => setRecentIds([])}>
                  {t("Clear recent")}
                </Button>
              )}
            </div>
            <div className="anatomy-search-results search-inline">
              <ComboboxEmpty className="search-empty block p-0">
                {t("No structures match your search.")}
              </ComboboxEmpty>
              <ComboboxList className="search-list" aria-label={t("Anatomical search results")}>
                {(c: Concept) => {
                  const entry = searchIndex.get(c.id);
                  const alias = entry && matchedSearchAlias(entry, query);
                  const side = entry?.side;
                  return (
                    <ComboboxItem key={c.id} value={c} className="search-result">
                      <span className="search-result-body">
                        <span className="search-result-title">
                          <span className="search-result-name">{dn(c.name)}</span>
                          {side && (
                            <span className="search-side">
                              {side === "both"
                                ? t("Left & right")
                                : side === "left"
                                  ? t("Left side")
                                  : t("Right side")}
                            </span>
                          )}
                        </span>
                        {locale !== "en" && dn(c.name) !== c.name && <span className="search-source-name">{c.name}</span>}
                        <span className="search-result-context">
                          <span>{t("Included systems")}</span>
                          {entry?.systems.map((id) => {
                            const system = SYSTEMS.find((s) => s.id === id)!;
                            return (
                              <span className="search-system" key={id}>
                                <span className="system-dot" style={{ background: system.color }} />
                                {sn(system)}
                              </span>
                            );
                          })}
                          <span>{t("{count} pieces", { count: c.elements.length })}</span>
                          {!query.trim() && recentIds.includes(c.id) && (
                            <span className="search-recent">{t("Recent")}</span>
                          )}
                        </span>
                        {alias && (
                          <span className="search-alias">
                            {t("Matched alias: {alias}", { alias })}
                          </span>
                        )}
                        <span className="search-source-id">
                          {t("Atlas reference")}: {c.id}
                        </span>
                      </span>
                      <ChevronRight size={14} aria-hidden="true" />
                    </ComboboxItem>
                  );
                }}
              </ComboboxList>
            </div>
          </Combobox>
          <p className="search-note">
            {query
              ? searchResults.total > 80
                ? t("Showing up to 80 matches. Refine your search to find smaller structures.")
                : t("Search by localized or English name, alias or source ID.")
              : t("Start with a major organ, or search every named structure.")}
          </p>
        </section>
      )}
      </aside>
      {selectedParts.length > 0 && !details && !about && !creditsOpen && (
        <div
          className="selection-summary glass"
          role="group"
          aria-label={t("Selected structure actions")}
        >
          <Button
            variant="ghost"
            className="selection-open"
            onClick={() => {
              setDetailCompact(false);
              setDetails(true);
            }}
          >
            <Info size={16} />
            <span>
              {dn(chosen?.name)}
              <small>{t("View details")}</small>
            </span>
          </Button>
          <Button variant="ghost" onClick={returnToOverview}>
            <ArrowLeft size={15} />
            {t("Back to overview")}
          </Button>
        </div>
      )}
      {progress === 100 && visibleCount === 0 && <div className="empty-scene glass"><Layers3 size={30} /><h2>{t("No layers are visible")}</h2><p>{t("Turn on a system, or restore the whole body to keep exploring.")}</p><Button onClick={() => applyLayers(defaultVisible)}>{t("Show whole body")}</Button></div>}
      <div className="scene-controls">
      <nav className="view-controls glass" aria-label={t("Camera controls")}>
        {(["three-quarter", "front", "side", "back"] as View[]).map((v, i) => (
          <Button
            variant="ghost"
            key={v}
            className={state.view === v ? "active" : ""}
            aria-pressed={state.view === v}
            disabled={state.explode > 0.8 && v !== "front"}
            onClick={() =>
              setState((s) => ({ ...s, view: v, reset: s.reset + 1, rotate: false, focus: 0 }))
            }
            title={t(`${v} view`)}
            aria-label={t(`${v} view`)}
          >
            <span>{t(["Oblique", "Front", "Side", "Back"][i])}</span>
          </Button>
        ))}
        <i />
        <div className={`rotation-control${state.rotate ? " is-rotating" : ""}`}>
        <Button
          variant="ghost"
          disabled={state.explode >= 0.4}
          aria-label={state.rotate ? t("Pause rotation") : t("Rotate body")}
          aria-pressed={state.rotate}
          title={t("Auto rotate")}
          className={state.rotate ? "active" : ""}
          onClick={() => setState((s) => ({ ...s, rotate: !s.rotate }))}
        >
          {state.rotate ? <Pause size={17} /> : state.rotationDirection === "counterclockwise" ? <RotateCcw size={18} /> : <RotateCw size={18} />}
          <span className="rotate-label">{t("Auto rotate")}</span>
        </Button>
        <Popover>
          <PopoverTrigger render={<Button variant="ghost" className="rotation-settings-trigger" disabled={state.explode >= 0.4} aria-label={t("Rotation settings")} title={t("Rotation settings")} />}>
            <ChevronDown size={13} />
          </PopoverTrigger>
          <PopoverContent className="rotation-settings" side="top" align="end" sideOffset={10}>
            <PopoverTitle>{t("Rotation settings")}</PopoverTitle>
            <fieldset>
              <legend>{t("Rotation speed")}</legend>
              <div className="rotation-speed-heading">
                <button type="button" onClick={() => setState((s) => ({ ...s, rotationSpeed: 1 }))} title={t("Reset rotation speed")} >{t("Standard")} 10%</button>
                <output>{Math.round((state.rotationSpeed ?? 1) * 10)}%</output>
              </div>
              <Slider className="rotation-speed-slider" aria-label={t("Rotation speed")} aria-valuetext={`${Math.round((state.rotationSpeed ?? 1) * 10)}%`} min={1} max={100} step={1} largeStep={10} value={[(state.rotationSpeed ?? 1) * 10]} onValueChange={(value) => setState((s) => ({ ...s, rotationSpeed: (Array.isArray(value) ? value[0] : value) / 10 }))} />
              <div className="rotation-speed-endpoints"><span>1%</span><span>100%</span></div>
            </fieldset>
            <fieldset>
              <legend>{t("Rotation direction")}</legend>
              <div className="rotation-options">
                {(["clockwise", "counterclockwise"] as const).map((direction, i) => (
                  <label key={direction}>
                    <input type="radio" name="rotation-direction" value={direction} checked={(state.rotationDirection ?? "clockwise") === direction} onChange={() => setState((s) => ({ ...s, rotationDirection: direction }))} />
                    <span>{i === 0 ? <RotateCw size={14} /> : <RotateCcw size={14} />}{t(i === 0 ? "Clockwise" : "Counterclockwise")}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          </PopoverContent>
        </Popover>
        </div>
        <ControlTooltip label={t("Reset view; keep layers, selection and separation")}>
        <Button
          variant="ghost"
          className="view-reset"
          aria-label={t("Reset view")}
          onClick={resetView}
        >
          <RotateCcw size={17} />
          <span>{t("Reset view")}</span>
        </Button>
        </ControlTooltip>
        <ControlTooltip label={t(showBase ? "Hide base" : "Show base")}>
        <Button
          variant="ghost"
          className={`base-toggle${showBase ? " active" : ""}`}
          aria-pressed={showBase}
          aria-label={t(showBase ? "Hide base" : "Show base")}
          onClick={() => setShowBase((shown) => !shown)}
        >
          {showBase ? <Eye size={16} /> : <EyeOff size={16} />}
          <span>{t("Base")}</span>
        </Button>
        </ControlTooltip>
      </nav>
      <div className="scene-caption">
        <span className="caption-line" />
        <span>
          {state.isolate
            ? dn(chosen?.name) || t("SELECTED STRUCTURE")
            : state.explode > 0.95
              ? t("ANATOMICAL INVENTORY")
              : state.explode > 0.05
                ? t("SEPARATED STRUCTURES")
                : t(model === "female" ? "FEMALE · EXPERIMENTAL STUDY MODEL" : "ADULT HUMAN · MALE")}
        </span>
        <span className="caption-line" />
      </div>
      <div className="bottom-dock glass">
        <Button
          variant="ghost"
          className="mobile-only dock-layers"
          onClick={() => openPanel("layers")}
          aria-label={t("Open system layers")}
        >
          <Layers3 size={20} />
          <span>{t("Systems")}</span>
        </Button>
        <div className="explode-control">
          <div className="explode-label">
            <label id="explode-label"><Layers3 size={17} />{t("Explode anatomy")}</label>
            <div className="explode-steps">{[0, 50, 100].map((amount) => <button key={amount} aria-pressed={Math.round(state.explode * 100) === amount} onClick={() => setState((s) => ({ ...s, explode: amount / 100, view: amount > 80 ? "front" : s.view, rotate: false, focus: 0 }))}>{t(amount === 0 ? "Assemble" : amount === 50 ? "Separate" : "Inventory")}</button>)}</div>
            <output>
              {Math.round(state.explode * 100)}
              <span>%</span>
            </output>
          </div>
          <Slider
            aria-labelledby="explode-label"
            min={0}
            max={100}
            step={1}
            value={[state.explode * 100]}
            onValueChange={(v) =>
              setState((s) => ({
                ...s,
                explode: (Array.isArray(v) ? v[0] : v) / 100,
                view: (Array.isArray(v) ? v[0] : v) > 80 ? "front" : s.view,
                rotate: false,
                focus: 0,
              }))
            }
          />
          <div className="slider-endpoints">
            <span>{t("Assembled")}</span>
            <span>{t("Every piece")}</span>
          </div>
        </div>
        <Button
          variant="ghost"
          className="dock-reset"
          onClick={reset}
          aria-label={t("Reset all")}
          title={t("Restore default layers, clear selection and assemble anatomy")}
        >
          <RotateCcw size={18} />
          <span>{t("Reset all")}</span>
        </Button>
      </div>
      </div>
      </>}
      <footer className="studio-footer">
        <span className={`footer-status ${updater.native ? "" : "is-web"}`}><span className="status-dot" />{updater.native && t("Offline client")}<span className="footer-data">{MODELS[model].source}{" · "}{t("{count} pieces visible", { count: visibleCount.toLocaleString(locale) })}</span></span>
        <TooltipProvider delay={250}>
          <Tooltip disabled={creditsOpen}>
            <TooltipTrigger render={<Button variant="ghost" className={`footer-privacy ${privacyMode ? "is-active" : ""}`} aria-label={t(privacyMode ? "Privacy mode: on" : "Privacy mode: off")} onClick={() => { setFocusPrivacy(true); setCreditsOpen(true); }} />}>
              {privacyMode ? <EyeOff size={16} /> : <Eye size={16} />}
            </TooltipTrigger>
            <TooltipContent className="privacy-status-tooltip" side="top" align="end" sideOffset={10}>
              <strong>{t(privacyMode ? "Privacy mode: on" : "Privacy mode: off")}</strong>
              <span>{t(privacyMode ? "Sensitive structures are hidden in default views and random exploration. Search or explicit viewing from the list still allows access." : "Default views and random exploration include all available anatomy.")}</span>
              <small>{t("Click to open privacy settings")}</small>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </footer>
      {progress < 100 && !error && (
        <div className="loading glass" role="status">
          <Activity size={18} />
          <div>
            <strong>{t("Preparing the anatomy")}</strong>
            <span>
              {progress}% ·{" "}
              {t("Loading {count} pieces", {
                count: atlas?.parts.length.toLocaleString(locale) ?? "2,234",
              })}
            </span>
            <div className="loading-track">
              <i style={{ width: `${progress}%` }} />
            </div>
          </div>
        </div>
      )}
      {error && (
        <div className="loading glass error" role="alert">
          <p>{errorText(error, locale)}</p>
          <Button variant="ghost" onClick={() => location.reload()}>
            {t("Reload viewer")}
          </Button>
        </div>
      )}
      <Sheet
        open={details && selectedParts.length > 0}
        modal={false}
        disablePointerDismissal
        onOpenChange={setDetails}
      >
        <SheetContent
          ref={setDetailElement}
          closeLabel={t("Close details")}
          initialFocus={detailTitle}
          className={`detail-sheet glass ${state.isolate ? "is-isolated" : ""} ${detailCompact ? "is-compact" : ""} ${detailWide ? "is-wide" : ""}`}
          showCloseButton={true}
          showOverlay={false}
        >
          <div className="detail-header">
            <div className="detail-accent" style={{ background: system?.color }} />
            <div className="eyebrow">{system ? sn(system) : t("ANATOMY")}</div>
            <SheetTitle ref={detailTitle} tabIndex={-1} className="structure-title">
              {dn(chosen?.name)}
            </SheetTitle>
            {locale !== "en" && chosen && dn(chosen.name) !== chosen.name && <p className="source-name" title={t("English source name")}>{chosen.name}</p>}
            <div className="detail-mode"><Layers3 size={13} />{state.isolate ? t("Isolated selection") : t("Surrounding anatomy visible")}</div>
            <div className="detail-display-controls">
              <Button
                variant="ghost"
                onClick={() => setDetailCompact((compact) => !compact)}
                aria-expanded={!detailCompact}
                aria-controls="structure-detail-content"
              >
                <ChevronDown size={14} className={detailCompact ? "" : "expanded"} />
                {detailCompact ? t("Expand details") : t("Collapse details")}
              </Button>
              {!detailCompact && (
                <Button
                  variant="ghost"
                  className="detail-width-control"
                  aria-pressed={detailWide}
                  onClick={() => setDetailWide((wide) => !wide)}
                >
                  {detailWide ? t("Compact width") : t("Wider reading")}
                </Button>
              )}
            </div>
          </div>
          <div
            id="structure-detail-content"
            hidden={detailCompact}
            className="detail-scroll"
            key={chosen?.id}
          >
            <SheetDescription className="structure-description">
              {chosen && selected
                ? structureExplanation(chosen.name, selected.system, model, locale)
                : ""}
            </SheetDescription>
            {chosen &&
              !hasStructureExplanation(chosen.name, locale) && (
                <span className="context-note">
                  {t("System overview · structure identified from source anatomy")}
                </span>
              )}
            {chosen && locale !== "en" && locale !== "zh-CN" && dn(chosen.name) === chosen.name && (
              <span className="context-note">{t("English source name retained; localized terminology is not yet verified.")}</span>
            )}
            {locale === "zh-CN" && chosen && chineseStructureKnowledge(chosen.name) && (
              <section className="learning-note" aria-label="观察提示">
                <h3>观察提示</h3>
                <p>{chineseStructureKnowledge(chosen.name)!.observe}</p>
              </section>
            )}
            <details className="detail-reference">
              <summary>{t("Reference & included pieces")}</summary>
              <div className="structure-meta">
                <span>
                  {t("Atlas reference")}
                  <strong>{chosen?.id}</strong>
                </span>
                <span>
                  {t("Selected pieces")}
                  <strong>{state.selected.length.toLocaleString(locale)}</strong>
                </span>
              </div>
              {selectedParts.length > 1 && (
                <div className="member-list">
                  <h3>{t("Included structures")}</h3>
                  {selectedParts.slice(0, 50).map((p) => (
                    <Button variant="ghost" key={p.id} onClick={() => choosePart(p.id)}>
                      <span>{dn(p.name)}</span>
                      <ChevronRight size={14} />
                    </Button>
                  ))}
                  {selectedParts.length > 50 && (
                    <p>
                      {t("And {count} more modeled pieces.", { count: selectedParts.length - 50 })}
                    </p>
                  )}
                </div>
              )}
              {model === "female" && <p className="context-note">{t("Derived from BodyParts3D and HRA female anatomy. Proportions and placement are estimated and have not been independently reviewed.")}</p>}
              {[...new Set(selectedParts.map((part) => part.provenance?.source.startsWith("HRA") ? "HRA" : "BodyParts3D"))].map((source) => (
                <a key={source} className="source-link" href={source === "HRA" ? "https://lod.humanatlas.io/ref-organ/united-female/v1.5" : "https://lifesciencedb.jp/bp3d/"} target="_blank" rel="noreferrer">
                  {t("View anatomical source")} · {source}<ArrowUpRight size={14} />
                </a>
              ))}
            </details>
          </div>
          <div className="detail-actions">
            <Button
              className="primary-action locate-action"
              disabled={progress < 100 || !!error}
              title={t(state.isolate ? "Return to the surrounding view and highlight this structure" : "Center the camera on the selection; keep surrounding layers")}
              onClick={() => {
                setState((s) => ({ ...s, isolate: false, focusContext: s.isolate || !!(s.focusContext && s.focus), focus: (s.focus ?? 0) + 1, rotate: false }));
              }}
            >
              <Focus size={18} />
              {t("Locate structure")}
            </Button>
            <Button
              variant="outline"
              className={`isolate-action ${state.isolate ? "active" : ""}`}
              aria-pressed={state.isolate}
              title={t(
                "Isolate hides other structures; surrounding anatomy restores the current layers",
              )}
              onClick={() =>
                setState((s) => ({
                  ...s,
                  isolate: !s.isolate,
                  explode: 0,
                  focus: 0,
                  rotate: false,
                }))
              }
            >
              <Layers3 size={18} />
              {state.isolate ? t("Show surrounding anatomy") : t("Isolate structure")}
            </Button>
            <div className="detail-utility-actions">
              <Button
                variant="ghost"
                className="secondary-action"
                title={t("Hide the selected structure; preserve visibility settings for other structures")}
                onClick={() => {
                  setState(hideSelectedStructure);
                  setChosen(null);
                  setDetails(false);
                }}
              >
                <EyeOff size={15} />
                {t("Hide current structure")}
              </Button>
              <Button
                variant="ghost"
                className="secondary-action"
                title={t("Clear selection and restore the overview; keep layers and separation")}
                onClick={returnToOverview}
              >
                <ArrowLeft size={15} />
                {t("Back to overview")}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
      <Suspense fallback={null}><About locale={locale} open={creditsOpen} onOpenChange={(open) => { setCreditsOpen(open); if (!open) setFocusPrivacy(false); }} updater={updater} privacyMode={privacyMode} onPrivacyModeChange={changePrivacyMode} focusPrivacy={focusPrivacy} selectionColor={selectionColor} onSelectionColorChange={setSelectionColor} /></Suspense>
      <Sheet open={about} onOpenChange={setAbout}>
        <SheetContent closeLabel={t("Close")} className="about-sheet glass">
          <div className="eyebrow"><BookOpen size={15} />{t("Learning guide")}</div>
          <SheetTitle className="structure-title">{t("From the whole body to every detail.")}</SheetTitle>
          <SheetDescription>
            {t("Three simple steps to find your way around the atlas.")}
          </SheetDescription>
          <div className="guide-steps">
            {([
              ["Choose your layers", "Start with the whole body, bones or organs. Toggle systems to build your own view."],
              ["Find a structure", "Click the model or search a name. Search results open an isolated view so nothing gets in the way."],
              ["Look a little closer", "Rotate, zoom or separate the model. Open details to learn more, then show surrounding anatomy for context."],
            ]).map(([title, description], index) => <div className="guide-step" key={title}><span>{index + 1}</span><div><strong>{t(title)}</strong><p>{t(description)}</p></div></div>)}
            <Button onClick={() => { setAbout(false); startExploring(); }}>{t("Open the 3D atlas")}<ArrowRight size={16} /></Button>
          </div>
          <div className="about-copy">
            {locale === "zh-CN" && (
              <section className="reading-guide" aria-label="中文阅读指南">
                <h3>中文阅读指南</h3>
                {READING_GUIDE.map((item) => (
                  <details key={item.title}>
                    <summary>{item.title}</summary>
                    <p>{item.body}</p>
                  </details>
                ))}
                <details>
                  <summary>常用解剖方位词</summary>
                  <p>
                    以下方位以标准解剖姿势为参照：身体直立、面向前方，手掌朝前。模型的姿势和相机角度可能与这一参照不同。
                  </p>
                  <dl>
                    {DIRECTION_TERMS.map(([term, description]) => (
                      <div key={term}>
                        <dt>{term}</dt>
                        <dd>{description}</dd>
                      </div>
                    ))}
                  </dl>
                </details>
                <details>
                  <summary>内容参考</summary>
                  <p>
                    中文学习说明为自行编写的简要内容，解剖事实参考 {"OpenStax"}
                    教材，可联网查看以下页面。
                  </p>
                  {CONTENT_REFERENCES.map((reference) => (
                    <a key={reference.url} href={reference.url} target="_blank" rel="noreferrer">
                      {reference.title} <ArrowUpRight size={14} />
                    </a>
                  ))}
                </details>
              </section>
            )}
            <p className="client-edition">
              {t(runtimeInfo().native ? "Offline client" : "Web viewer")} · {runtimeInfo().version}
            </p>
            <h3>{t("Terminology & translation")}</h3>
            <p>
              {t(
                "Localized names cover common organs and major bones. Unverified names remain in English. Translations have not been independently reviewed; source names and IDs are preserved.",
              )}
            </p>
            <p>
              <strong>{t(model === "female" ? "Female · BodyParts3D + HRA" : "Male · BodyParts3D")}</strong>
              <br />
              {t(
                "{parts} individual meshes and {concepts} named concepts in the current model.",
                { parts: atlas?.parts.length.toLocaleString(locale) ?? "—", concepts: atlas?.concepts.length.toLocaleString(locale) ?? "—" },
              )}
            </p>
            {model === "female" && <p>{t("Derived from BodyParts3D and HRA female anatomy. Proportions and placement are estimated and have not been independently reviewed.")}</p>}
            <p>
              {t(
                "This reference does not contain every human structure or variation. Named concepts can contain multiple pieces; each source mesh is rendered once.",
              )}
            </p>
            <p>
              {t(
                "Colors and system groupings are designed for exploration. The geometry is simplified for the web, and short explanations provide general educational context. This is an anatomical reference, not a diagnostic or surgical tool.",
              )}
            </p>
            <h3>{t("Source")}</h3>
            <p>
              {t(
                "BodyParts3D, © The Database Center for Life Science licensed under CC Attribution 4.0 International.",
              )}
            </p>
            <a
              href="https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html"
              target="_blank"
              rel="noreferrer"
            >
              {t("Dataset license")} <ArrowUpRight size={14} />
            </a>
            <a
              href="https://dbarchive.biosciencedbc.jp/en/bodyparts3d/download.html"
              target="_blank"
              rel="noreferrer"
            >
              {t("Original geometry & metadata")} <ArrowUpRight size={14} />
            </a>
            <a
              href="https://academic.oup.com/nar/article/37/suppl_1/D782/1000752"
              target="_blank"
              rel="noreferrer"
            >
              {t("Read the source publication")} <ArrowUpRight size={14} />
            </a>
            <p>{t("Application code: MIT. Anatomy data: CC BY 4.0.")}</p>
          </div>
        </SheetContent>
      </Sheet>
    </main>
    </TooltipProvider>
  );
}
